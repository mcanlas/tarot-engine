package com.htmlism.tarotengine.finalfantasy.vibe

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import scala.util.Try

import io.circe.Decoder
import io.circe.yaml.parser

final case class PromotionDefinition(id: String, name: String, plural: String)

object PromotionDefinition:
  given Decoder[PromotionDefinition] = Decoder.instance: cursor =>
    for
      id     <- cursor.get[String]("class")
      name   <- cursor.get[String]("name")
      plural <- cursor.get[String]("plural")
    yield PromotionDefinition(id, name, plural)

final case class ClassDefinition(
    id: String,
    name: String,
    plural: String,
    attackerPriority: Int,
    attributes: List[String],
    promotion: PromotionDefinition
)

object ClassDefinition:
  given Decoder[ClassDefinition] = Decoder.instance: cursor =>
    for
      id         <- cursor.get[String]("class")
      name       <- cursor.get[String]("name")
      plural     <- cursor.get[String]("plural")
      priority   <- cursor.get[Int]("attackerPriority")
      attributes <- cursor.get[List[String]]("attributes")
      promotion  <- cursor.get[PromotionDefinition]("promotion")
    yield ClassDefinition(id, name, plural, priority, attributes, promotion)

final case class SpellDefinition(
    id: String,
    name: String,
    learnableBy: List[String],
    attributes: List[String]
)

object SpellDefinition:
  given Decoder[SpellDefinition] = Decoder.instance: cursor =>
    for
      id          <- cursor.get[String]("spell")
      name        <- cursor.get[String]("name")
      learnableBy <- cursor.get[List[String]]("learnableBy")
      attributes  <- cursor.get[List[String]]("attributes")
    yield SpellDefinition(id, name, learnableBy, attributes)

final case class FinalFantasyCatalog(
    classes: Map[String, Job],
    spells: Map[String, Spell]
):
  @SuppressWarnings(Array("org.wartremover.warts.Throw"))
  def job(id: String): Job =
    classes.getOrElse(id, throw new NoSuchElementException(s"Unknown Final Fantasy class: $id"))

  @SuppressWarnings(Array("org.wartremover.warts.Throw"))
  def spell(id: String): Spell =
    spells.getOrElse(id, throw new NoSuchElementException(s"Unknown Final Fantasy spell: $id"))

  def promotionFor(job: Job): Option[Job] =
    job.promotion.flatMap(classes.get)

object FinalFantasyData:
  @SuppressWarnings(Array("org.wartremover.warts.Throw"))
  lazy val catalog: FinalFantasyCatalog =
    load().fold(message => throw new IllegalStateException(message), identity)

  def load(): Either[String, FinalFantasyCatalog] =
    for
      classDefinitions <- decodeFile[List[ClassDefinition]](Path.of("data", "final-fantasy-classes.yaml"))
      spellDefinitions <- decodeFile[List[SpellDefinition]](Path.of("data", "final-fantasy-spells.yaml"))
      catalog          <- buildCatalog(classDefinitions, spellDefinitions)
    yield catalog

  private def decodeFile[A: Decoder](path: Path): Either[String, A] =
    Try(Files.readString(path, StandardCharsets.UTF_8))
      .toEither
      .left
      .map(error => s"Unable to read $path: ${error.getMessage}")
      .flatMap: yaml =>
        parser.parse(yaml).flatMap(_.as[A]).left.map(error => s"Invalid $path: ${error.getMessage}")

  private def buildCatalog(
      classDefinitions: List[ClassDefinition],
      spellDefinitions: List[SpellDefinition]
  ): Either[String, FinalFantasyCatalog] =
    for
      _ <- rejectDuplicates(
        "class",
        classDefinitions.flatMap(definition => List(definition.id, definition.promotion.id))
      )
      _       <- rejectDuplicates("spell", spellDefinitions.map(_.id))
      classes <- traverse(classDefinitions): definition =>
        traverse(definition.attributes)(Capability.fromId).map: attributes =>
          List(
            definition.id -> Job(
              definition.id,
              definition.name,
              definition.plural,
              definition.attackerPriority,
              attributes.toSet,
              Some(definition.promotion.id)
            ),
            definition.promotion.id -> Job(
              definition.promotion.id,
              definition.promotion.name,
              definition.promotion.plural,
              definition.attackerPriority,
              attributes.toSet,
              None
            )
          )
      classMap = classes.flatten.toMap
      spells  <- traverse(spellDefinitions): definition =>
        val unknownClasses = definition.learnableBy.filterNot(classMap.contains)

        if unknownClasses.nonEmpty then
          Left(s"Spell ${definition.id} references unknown classes: ${unknownClasses.mkString(", ")}")
        else
          traverse(definition.attributes)(SpellAttribute.fromId).map: attributes =>
            definition.id -> Spell(
              definition.id,
              definition.name,
              definition.learnableBy.toSet,
              attributes.toSet
            )
      spellMap = spells.toMap
    yield FinalFantasyCatalog(classMap, spellMap)

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
