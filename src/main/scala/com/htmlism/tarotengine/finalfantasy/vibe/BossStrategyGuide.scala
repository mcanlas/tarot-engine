package com.htmlism.tarotengine.finalfantasy.vibe

final case class Job(
    id: String,
    label: String,
    pluralLabel: String,
    attackerPriority: Int,
    capabilities: Set[Capability],
    promotion: Option[String]
)

object Job:
  lazy val Warrior: Job     = FinalFantasyData.catalog.job("warrior")
  lazy val Thief: Job       = FinalFantasyData.catalog.job("thief")
  lazy val Monk: Job        = FinalFantasyData.catalog.job("monk")
  lazy val RedMage: Job     = FinalFantasyData.catalog.job("red-mage")
  lazy val WhiteMage: Job   = FinalFantasyData.catalog.job("white-mage")
  lazy val BlackMage: Job   = FinalFantasyData.catalog.job("black-mage")
  lazy val Knight: Job      = FinalFantasyData.catalog.job("knight")
  lazy val Ninja: Job       = FinalFantasyData.catalog.job("ninja")
  lazy val Master: Job      = FinalFantasyData.catalog.job("master")
  lazy val RedWizard: Job   = FinalFantasyData.catalog.job("red-wizard")
  lazy val WhiteWizard: Job = FinalFantasyData.catalog.job("white-wizard")
  lazy val BlackWizard: Job = FinalFantasyData.catalog.job("black-wizard")

enum SpellAttribute(val id: String):
  case Healing        extends SpellAttribute("healing")
  case OffensiveMagic extends SpellAttribute("offensive-magic")
  case Elemental      extends SpellAttribute("elemental")
  case AntiUndead     extends SpellAttribute("anti-undead")

object SpellAttribute:
  def fromId(id: String): Either[String, SpellAttribute] =
    SpellAttribute.values.find(_.id == id).toRight(s"Unknown spell attribute: $id")

final case class Spell(id: String, label: String, learnableBy: Set[String], attributes: Set[SpellAttribute])

object Spell:
  lazy val Cure: Spell     = FinalFantasyData.catalog.spell("cure")
  lazy val Heal: Spell     = FinalFantasyData.catalog.spell("heal")
  lazy val Dia: Spell      = FinalFantasyData.catalog.spell("dia")
  lazy val Fire: Spell     = FinalFantasyData.catalog.spell("fire")
  lazy val Blizzard: Spell = FinalFantasyData.catalog.spell("blizzard")
  lazy val Thunder: Spell  = FinalFantasyData.catalog.spell("thunder")
  lazy val Sleep: Spell    = FinalFantasyData.catalog.spell("sleep")
  lazy val Protect: Spell  = FinalFantasyData.catalog.spell("protect")
  lazy val Blink: Spell    = FinalFantasyData.catalog.spell("blink")
  lazy val Silence: Spell  = FinalFantasyData.catalog.spell("silence")
  lazy val Temper: Spell   = FinalFantasyData.catalog.spell("temper")
  lazy val Haste: Spell    = FinalFantasyData.catalog.spell("haste")
  lazy val Slow: Spell     = FinalFantasyData.catalog.spell("slow")
  lazy val NulShock: Spell = FinalFantasyData.catalog.spell("nulshock")
  lazy val NulBlaze: Spell = FinalFantasyData.catalog.spell("nulblaze")
  lazy val NulFrost: Spell = FinalFantasyData.catalog.spell("nulfrost")
  lazy val NulDeath: Spell = FinalFantasyData.catalog.spell("nuldeath")
  lazy val Protera: Spell  = FinalFantasyData.catalog.spell("protera")
  lazy val Invisira: Spell = FinalFantasyData.catalog.spell("invisira")
  lazy val Flare: Spell    = FinalFantasyData.catalog.spell("flare")
  lazy val Life: Spell     = FinalFantasyData.catalog.spell("life")
  lazy val Saber: Spell    = FinalFantasyData.catalog.spell("saber")

  lazy val healing: Set[Spell] =
    FinalFantasyData.catalog.spells.values.filter(_.attributes.contains(SpellAttribute.Healing)).toSet

  lazy val elemental: Set[Spell] =
    FinalFantasyData.catalog.spells.values.filter(_.attributes.contains(SpellAttribute.Elemental)).toSet

  lazy val offensive: Set[Spell] =
    FinalFantasyData.catalog.spells.values.filter(_.attributes.contains(SpellAttribute.OffensiveMagic)).toSet

enum Item(val id: String, val label: String):
  case Potion extends Item("potion", "Potion")

object Item:
  def fromId(id: String): Either[String, Item] =
    Item.values.find(_.id == id).toRight(s"Unknown item: $id")

final case class PartyMember private (job: Job, learnedSpells: Set[Spell]):
  def label: String =
    val spellList = learnedSpells.toList.map(_.label).sorted.mkString(", ")

    if spellList.isEmpty then job.label
    else s"${job.label} [$spellList]"

  def promote: PartyMember =
    job
      .promotion
      .fold(this): promotion =>
        new PartyMember(FinalFantasyData.catalog.job(promotion), learnedSpells)

object PartyMember:
  def apply(job: Job): PartyMember =
    new PartyMember(job, Set.empty)

  def whiteMage(spells: Spell*): PartyMember =
    withSpells(Job.WhiteMage, spells)

  def blackMage(spells: Spell*): PartyMember =
    withSpells(Job.BlackMage, spells)

  def redMage(spells: Spell*): PartyMember =
    withSpells(Job.RedMage, spells)

  def knight(spells: Spell*): PartyMember =
    withSpells(Job.Knight, spells)

  def ninja(spells: Spell*): PartyMember =
    withSpells(Job.Ninja, spells)

  def redWizard(spells: Spell*): PartyMember =
    withSpells(Job.RedWizard, spells)

  def whiteWizard(spells: Spell*): PartyMember =
    withSpells(Job.WhiteWizard, spells)

  def blackWizard(spells: Spell*): PartyMember =
    withSpells(Job.BlackWizard, spells)

  private def withSpells(job: Job, spells: Seq[Spell]): PartyMember =
    val invalid = spells.filterNot(_.learnableBy.contains(job.id))

    require(invalid.isEmpty, s"${job.label} cannot learn: ${invalid.map(_.label).mkString(", ")}")

    new PartyMember(job, spells.toSet)

enum Capability(val id: String):
  case PhysicalDamage extends Capability("physical-damage")
  case Healing        extends Capability("healing")
  case OffensiveMagic extends Capability("offensive-magic")

object Capability:
  def fromId(id: String): Either[String, Capability] =
    Capability.values.find(_.id == id).toRight(s"Unknown class attribute: $id")

  def forMember(member: PartyMember): Set[Capability] =
    val spellCapabilities =
      Set.from(
        Option.when(member.learnedSpells.exists(_.attributes.contains(SpellAttribute.Healing)))(Healing) ++
          Option.when(member.learnedSpells.exists(_.attributes.contains(SpellAttribute.OffensiveMagic)))(OffensiveMagic)
      )

    member.job.capabilities ++ spellCapabilities

final case class Party(members: List[PartyMember], inventory: Set[Item]):
  def count(job: Job): Int =
    members.count(_.job == job)

  def count(capability: Capability): Int =
    members.count(Capability.forMember(_).contains(capability))

  def count(spell: Spell): Int =
    members.count(_.learnedSpells.contains(spell))

  def countAny(spells: Set[Spell]): Int =
    members.count(_.learnedSpells.exists(spells.contains))

  def hasItem(item: Item): Boolean =
    inventory.contains(item)

  def canUse(member: PartyMember, item: Item): Boolean =
    members.contains(member) && hasItem(item)

  def label: String =
    members.map(_.label).mkString(" / ")

object Party:
  def apply(members: List[PartyMember]): Party =
    new Party(members, Set.empty)

  def withItems(members: List[PartyMember], items: Item*): Party =
    new Party(members, items.toSet)

enum PartyQuery:
  case Always
  case HasJob(job: Job, atLeast: Int)
  case HasCapability(capability: Capability, atLeast: Int)
  case HasSpell(spell: Spell, atLeast: Int)
  case HasAnySpell(spells: Set[Spell], atLeast: Int)
  case HasItem(item: Item)
  case All(queries: List[PartyQuery])
  case Not(query: PartyQuery)

  def matches(party: Party): Boolean =
    this match
      case Always =>
        true

      case HasJob(job, atLeast) =>
        party.count(job) >= atLeast

      case HasCapability(capability, atLeast) =>
        party.count(capability) >= atLeast

      case HasSpell(spell, atLeast) =>
        party.count(spell) >= atLeast

      case HasAnySpell(spells, atLeast) =>
        party.countAny(spells) >= atLeast

      case HasItem(item) =>
        party.hasItem(item)

      case All(queries) =>
        queries.forall(_.matches(party))

      case Not(query) =>
        !query.matches(party)

object PartyQuery:
  def all(queries: PartyQuery*): PartyQuery =
    All(queries.toList)

  def hasAnySpell(atLeast: Int, spells: Spell*): PartyQuery =
    HasAnySpell(spells.toSet, atLeast)

enum GuideSection(val id: String, val label: String):
  case Opening   extends GuideSection("opening", "Opening")
  case PartyEdge extends GuideSection("party-edge", "Party-specific tactic")
  case Safety    extends GuideSection("safety", "Safety")

object GuideSection:
  def fromId(id: String): Either[String, GuideSection] =
    GuideSection.values.find(_.id == id).toRight(s"Unknown guide section: $id")

enum EnemyTag(val id: String):
  case Undead extends EnemyTag("undead")

object EnemyTag:
  def fromId(id: String): Either[String, EnemyTag] =
    EnemyTag.values.find(_.id == id).toRight(s"Unknown enemy tag: $id")

final case class BossProfile(name: String, tags: Set[EnemyTag])

object BossProfile:
  def unclassified(name: String): BossProfile =
    BossProfile(name.toLowerCase, Set.empty)

enum BossQuery:
  case Named(name: String)
  case NamedAny(names: Set[String])
  case HasTag(tag: EnemyTag)

  def matches(boss: BossProfile): Boolean =
    this match
      case Named(name)     => boss.name == name
      case NamedAny(names) => names.contains(boss.name)
      case HasTag(tag)     => boss.tags.contains(tag)

object BossQuery:
  def namedAny(names: String*): BossQuery =
    NamedAny(names.toSet)

enum MemberSelector:
  case AllMembers
  case PreferredPhysicalAttacker
  case WithCapability(capability: Capability)
  case Knows(spell: Spell)
  case KnowsAny(spells: Set[Spell])
  case CanUse(item: Item)

  def select(party: Party): List[PartyMember] =
    this match
      case AllMembers =>
        party.members

      case PreferredPhysicalAttacker =>
        party
          .members
          .filter(Capability.forMember(_).contains(Capability.PhysicalDamage))
          .sortBy(_.job.attackerPriority)
          .take(1)

      case WithCapability(capability) =>
        party.members.filter(Capability.forMember(_).contains(capability))

      case Knows(spell) =>
        party.members.filter(_.learnedSpells.contains(spell))

      case KnowsAny(spells) =>
        party.members.filter(_.learnedSpells.exists(spells.contains))

      case CanUse(item) =>
        party.members.filter(party.canUse(_, item))

object MemberSelector:
  def knowsAny(spells: Spell*): MemberSelector =
    KnowsAny(spells.toSet)

enum AdvicePart:
  case Text(value: String)
  case BossName
  case Members(selector: MemberSelector)

final case class AdviceTemplate(parts: List[AdvicePart]):
  def render(party: Party, boss: BossProfile): String =
    parts
      .map:
        case AdvicePart.Text(value) =>
          value

        case AdvicePart.BossName =>
          boss.name.capitalize

        case AdvicePart.Members(selector) =>
          AdviceTemplate.formatMembers(party, selector)
      .mkString

object AdviceTemplate:
  def static(advice: String): AdviceTemplate =
    AdviceTemplate(List(AdvicePart.Text(advice)))

  def of(parts: AdvicePart*): AdviceTemplate =
    AdviceTemplate(parts.toList)

  private def formatMembers(party: Party, selector: MemberSelector): String =
    val jobs   = selector.select(party).map(_.job)
    val groups = jobs
      .distinct
      .map: job =>
        val selectedCount = jobs.count(_ == job)
        val partyCount    = party.members.count(_.job == job)
        val allSelected   = selectedCount == partyCount
        val base          = (selectedCount, allSelected) match
          case (1, _)         => s"the ${job.label}"
          case (2, true)      => s"both ${job.pluralLabel}"
          case (count, true)  => s"all $count ${job.pluralLabel}"
          case (count, false) => s"the $count ${job.pluralLabel}"
        val qualifier = Option.when(!allSelected)(selectorQualifier(selector, selectedCount))

        base + qualifier.filter(_.nonEmpty).fold("")(value => s" $value")

    groups match
      case Nil =>
        "no party member"

      case one :: Nil =>
        one

      case first :: second :: Nil =>
        s"$first and $second"

      case many =>
        val (leading, trailing) = many.splitAt(many.size - 1)

        trailing
          .headOption
          .fold(leading.mkString(", "))(finalGroup => s"${leading.mkString(", ")}, and $finalGroup")

  private def selectorQualifier(selector: MemberSelector, selectedCount: Int): String =
    selector match
      case MemberSelector.Knows(spell) =>
        if selectedCount == 1 then s"who knows ${spell.label}"
        else s"who know ${spell.label}"

      case MemberSelector.KnowsAny(_) =>
        "with relevant learned spells"

      case MemberSelector.WithCapability(Capability.Healing) =>
        "with recovery magic"

      case MemberSelector.WithCapability(Capability.OffensiveMagic) =>
        "with offensive magic"

      case MemberSelector.AllMembers | MemberSelector.PreferredPhysicalAttacker |
          MemberSelector.WithCapability(Capability.PhysicalDamage) | MemberSelector.CanUse(_) =>
        ""

final case class BossStrategyRule(
    boss: BossQuery,
    section: GuideSection,
    when: PartyQuery,
    advice: AdviceTemplate
)

object BossStrategyRule:
  def apply(
      boss: BossQuery,
      section: GuideSection,
      when: PartyQuery,
      advice: String
  ): BossStrategyRule =
    new BossStrategyRule(boss, section, when, AdviceTemplate.static(advice))

final case class GuideFragment(section: GuideSection, advice: String)

final case class BossGuide(boss: String, fragments: List[GuideFragment])

final class BossStrategyGuide(rules: List[BossStrategyRule], bossProfiles: Map[String, BossProfile]):
  def forPartyAndBoss(party: Party, bossName: String): BossGuide =
    val normalizedName = bossName.toLowerCase
    val boss           = bossProfiles.getOrElse(normalizedName, BossProfile.unclassified(normalizedName))
    val fragments      = rules.collect:
      case rule if rule.boss.matches(boss) && rule.when.matches(party) =>
        GuideFragment(rule.section, rule.advice.render(party, boss))

    BossGuide(boss.name, fragments)
