package com.htmlism.tarotengine.finalfantasy.vibe

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import scala.util.Try
import scala.util.matching.Regex

import io.circe.Decoder
import io.circe.DecodingFailure
import io.circe.HCursor
import io.circe.generic.semiauto.deriveDecoder
import io.circe.yaml.parser

final case class BossDefinition(boss: String, tags: List[String])

object BossDefinition:
  given Decoder[BossDefinition] = Decoder.instance: cursor =>
    for
      boss <- cursor.get[String]("boss")
      tags <- cursor.get[Option[List[String]]]("tags").map(_.getOrElse(Nil))
    yield BossDefinition(boss, tags)

private enum PartyConditionDefinition:
  case Always
  case HasJob(id: String, atLeast: Int)
  case HasCapability(id: String, atLeast: Int)
  case HasSpell(id: String, atLeast: Int)
  case HasSpellAttribute(id: String, atLeast: Int)
  case HasItem(id: String)
  case All(conditions: List[PartyConditionDefinition])
  case Not(condition: PartyConditionDefinition)

private object PartyConditionDefinition:
  private val discriminators =
    Set("job", "capability", "spell", "spellAttribute", "item", "all", "not")

  given Decoder[PartyConditionDefinition] = Decoder.instance: cursor =>
    cursor.value.asString match
      case Some("always") =>
        Right(PartyConditionDefinition.Always)

      case Some(other) =>
        Left(DecodingFailure(s"Unknown boss strategy condition: $other", cursor.history))

      case None =>
        discriminator(cursor, discriminators).flatMap:
          case "job" =>
            count(cursor, "job").map(PartyConditionDefinition.HasJob.apply)

          case "capability" =>
            count(cursor, "capability").map(PartyConditionDefinition.HasCapability.apply)

          case "spell" =>
            count(cursor, "spell").map(PartyConditionDefinition.HasSpell.apply)

          case "spellAttribute" =>
            count(cursor, "spellAttribute").map(PartyConditionDefinition.HasSpellAttribute.apply)

          case "item" =>
            cursor.get[String]("item").map(PartyConditionDefinition.HasItem.apply)

          case "all" =>
            cursor.get[List[PartyConditionDefinition]]("all").map(PartyConditionDefinition.All.apply)

          case "not" =>
            cursor.get[PartyConditionDefinition]("not").map(PartyConditionDefinition.Not.apply)

          case other =>
            Left(DecodingFailure(s"Unknown boss strategy condition: $other", cursor.history))

  private def count(cursor: HCursor, field: String): Decoder.Result[(String, Int)] =
    for
      id      <- cursor.get[String](field)
      atLeast <- cursor.get[Option[Int]]("atLeast").map(_.getOrElse(1))
    yield id -> atLeast

  private def discriminator(cursor: HCursor, supported: Set[String]): Decoder.Result[String] =
    val present = cursor.keys.toList.flatten.filter(supported.contains).toList

    present match
      case one :: Nil => Right(one)
      case _          => Left(DecodingFailure("A boss strategy condition must have exactly one operation", cursor.history))

private final case class BossStrategyRuleDefinition(
    boss: Option[String],
    bossGroup: Option[String],
    bossTag: Option[String],
    section: String,
    when: PartyConditionDefinition,
    advice: String
)

private object BossStrategyRuleDefinition:
  given Decoder[BossStrategyRuleDefinition] = deriveDecoder[BossStrategyRuleDefinition]

private final case class BossStrategyFileDefinition(
    bossGroups: Map[String, List[String]],
    rules: List[BossStrategyRuleDefinition]
)

private object BossStrategyFileDefinition:
  given Decoder[BossStrategyFileDefinition] = deriveDecoder[BossStrategyFileDefinition]

final case class FinalFantasyBossStrategyData(
    bosses: List[BossDefinition],
    guide: BossStrategyGuide,
    ruleCount: Int
)

object FinalFantasyBossStrategyData:
  private val bossesPath   = Path.of("data", "final-fantasy-bosses.yaml")
  private val rulesPath    = Path.of("data", "final-fantasy-boss-strategy.yaml")
  private val token: Regex = "\\{\\{([^{}]+)\\}\\}".r

  def load(): Either[String, FinalFantasyBossStrategyData] =
    for
      catalog     <- FinalFantasyData.load()
      bosses      <- decodeFile[List[BossDefinition]](bossesPath)
      definitions <- decodeFile[BossStrategyFileDefinition](rulesPath)
      data        <- build(catalog, bosses, definitions)
    yield data

  private def build(
      catalog: FinalFantasyCatalog,
      bosses: List[BossDefinition],
      definitions: BossStrategyFileDefinition
  ): Either[String, FinalFantasyBossStrategyData] =
    for
      _         <- rejectDuplicates("boss", bosses.map(_.boss.toLowerCase))
      profiles  <- traverse(bosses)(buildProfile)
      profileMap = profiles.map(profile => profile.name -> profile).toMap
      _         <- validateBossGroups(definitions.bossGroups, profileMap.keySet)
      rules     <- traverse(definitions.rules)(buildRule(catalog, definitions.bossGroups, profileMap.keySet, _))
    yield FinalFantasyBossStrategyData(bosses, BossStrategyGuide(rules, profileMap), rules.size)

  private def buildProfile(definition: BossDefinition): Either[String, BossProfile] =
    traverse(definition.tags)(EnemyTag.fromId).map: tags =>
      BossProfile(definition.boss.toLowerCase, tags.toSet)

  private def buildRule(
      catalog: FinalFantasyCatalog,
      bossGroups: Map[String, List[String]],
      knownBosses: Set[String],
      definition: BossStrategyRuleDefinition
  ): Either[String, BossStrategyRule] =
    for
      boss      <- buildBossQuery(definition, bossGroups, knownBosses)
      section   <- GuideSection.fromId(definition.section)
      condition <- buildCondition(catalog, definition.when)
      advice    <- buildAdvice(catalog, definition.advice)
    yield BossStrategyRule(boss, section, condition, advice)

  private def buildBossQuery(
      definition: BossStrategyRuleDefinition,
      bossGroups: Map[String, List[String]],
      knownBosses: Set[String]
  ): Either[String, BossQuery] =
    val alternatives =
      definition.boss.map("boss" -> _).toList ++
        definition.bossGroup.map("bossGroup" -> _).toList ++
        definition.bossTag.map("bossTag" -> _).toList

    alternatives match
      case ("boss", name) :: Nil =>
        val normalized = name.toLowerCase

        Either.cond(knownBosses.contains(normalized), BossQuery.Named(normalized), s"Unknown rule boss: $name")

      case ("bossGroup", id) :: Nil =>
        bossGroups
          .get(id)
          .toRight(s"Unknown boss group: $id")
          .map(names => BossQuery.NamedAny(names.map(_.toLowerCase).toSet))

      case ("bossTag", id) :: Nil =>
        EnemyTag.fromId(id).map(BossQuery.HasTag.apply)

      case _ =>
        Left("A boss strategy rule must define exactly one of boss, bossGroup, or bossTag")

  private def buildCondition(
      catalog: FinalFantasyCatalog,
      definition: PartyConditionDefinition
  ): Either[String, PartyQuery] =
    definition match
      case PartyConditionDefinition.Always =>
        Right(PartyQuery.Always)

      case PartyConditionDefinition.HasJob(id, atLeast) =>
        catalog.classes.get(id).toRight(s"Unknown rule class: $id").map(PartyQuery.HasJob(_, atLeast))

      case PartyConditionDefinition.HasCapability(id, atLeast) =>
        Capability.fromId(id).map(PartyQuery.HasCapability(_, atLeast))

      case PartyConditionDefinition.HasSpell(id, atLeast) =>
        catalog.spells.get(id).toRight(s"Unknown rule spell: $id").map(PartyQuery.HasSpell(_, atLeast))

      case PartyConditionDefinition.HasSpellAttribute(id, atLeast) =>
        spellsWithAttribute(catalog, id).map(PartyQuery.HasAnySpell(_, atLeast))

      case PartyConditionDefinition.HasItem(id) =>
        Item.fromId(id).map(PartyQuery.HasItem.apply)

      case PartyConditionDefinition.All(conditions) =>
        traverse(conditions)(buildCondition(catalog, _)).map(PartyQuery.All.apply)

      case PartyConditionDefinition.Not(condition) =>
        buildCondition(catalog, condition).map(PartyQuery.Not.apply)

  private def buildAdvice(catalog: FinalFantasyCatalog, value: String): Either[String, AdviceTemplate] =
    val matches                                          = token.findAllMatchIn(value).toList
    val initial: Either[String, (Int, List[AdvicePart])] = Right(0 -> Nil)

    matches
      .foldLeft(initial): (accumulated, matched) =>
        for
          state          <- accumulated
          (offset, parts) = state
          parsed         <- parseAdviceToken(catalog, matched.group(1))
          textPart        = Option.when(matched.start > offset)(AdvicePart.Text(value.substring(offset, matched.start))).toList
        yield matched.end -> (parts ++ textPart :+ parsed)
      .map: (offset, parts) =>
        val trailing = Option.when(offset < value.length)(AdvicePart.Text(value.substring(offset))).toList

        AdviceTemplate(parts ++ trailing)

  private def parseAdviceToken(catalog: FinalFantasyCatalog, value: String): Either[String, AdvicePart] =
    value.split(":").toList match
      case "boss" :: Nil =>
        Right(AdvicePart.BossName)

      case "members" :: selectorParts =>
        buildMemberSelector(catalog, selectorParts).map(AdvicePart.Members.apply)

      case _ =>
        Left(s"Unknown advice token: {{$value}}")

  private def buildMemberSelector(
      catalog: FinalFantasyCatalog,
      parts: List[String]
  ): Either[String, MemberSelector] =
    parts match
      case "all" :: Nil =>
        Right(MemberSelector.AllMembers)

      case "preferred-physical-attacker" :: Nil =>
        Right(MemberSelector.PreferredPhysicalAttacker)

      case "capability" :: id :: Nil =>
        Capability.fromId(id).map(MemberSelector.WithCapability.apply)

      case "knows" :: id :: Nil =>
        catalog.spells.get(id).toRight(s"Unknown advice spell: $id").map(MemberSelector.Knows.apply)

      case "knows-attribute" :: id :: Nil =>
        spellsWithAttribute(catalog, id).map(MemberSelector.KnowsAny.apply)

      case "can-use" :: id :: Nil =>
        Item.fromId(id).map(MemberSelector.CanUse.apply)

      case _ =>
        Left(s"Unknown member selector: ${parts.mkString(":")}")

  private def spellsWithAttribute(
      catalog: FinalFantasyCatalog,
      id: String
  ): Either[String, Set[Spell]] =
    SpellAttribute
      .fromId(id)
      .map: attribute =>
        catalog.spells.values.filter(_.attributes.contains(attribute)).toSet

  private def validateBossGroups(
      groups: Map[String, List[String]],
      knownBosses: Set[String]
  ): Either[String, Unit] =
    val unknown = groups
      .toList
      .flatMap: (group, bosses) =>
        bosses.map(_.toLowerCase).filterNot(knownBosses.contains).map(name => s"$group -> $name")

    Either.cond(unknown.isEmpty, (), s"Boss groups reference unknown bosses: ${unknown.sorted.mkString(", ")}")

  private def decodeFile[A: Decoder](path: Path): Either[String, A] =
    Try(Files.readString(path, StandardCharsets.UTF_8))
      .toEither
      .left
      .map(error => s"Unable to read $path: ${error.getMessage}")
      .flatMap: yaml =>
        parser.parse(yaml).flatMap(_.as[A]).left.map(error => s"Invalid $path: ${error.getMessage}")

  private def rejectDuplicates(kind: String, ids: List[String]): Either[String, Unit] =
    val duplicates =
      ids.groupBy(identity).collect { case (id, occurrences) if occurrences.size > 1 => id }.toList.sorted

    Either.cond(duplicates.isEmpty, (), s"Duplicate $kind ids: ${duplicates.mkString(", ")}")

  private def traverse[A, B](values: List[A])(f: A => Either[String, B]): Either[String, List[B]] =
    values.foldRight[Either[String, List[B]]](Right(Nil)): (value, accumulated) =>
      for
        result  <- f(value)
        results <- accumulated
      yield result :: results

object FinalFantasyBossStrategyGuide:
  def load(): Either[String, FinalFantasyBossStrategyData] =
    FinalFantasyBossStrategyData.load()

  @SuppressWarnings(Array("org.wartremover.warts.Throw"))
  lazy val data: FinalFantasyBossStrategyData =
    load().fold(message => throw new IllegalStateException(message), identity)

  lazy val guide: BossStrategyGuide =
    data.guide
