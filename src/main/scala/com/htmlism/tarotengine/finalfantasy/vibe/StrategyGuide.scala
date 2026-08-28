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

enum Item(val label: String):
  case Potion extends Item("Potion")

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

enum GuideSection(val label: String):
  case Opening   extends GuideSection("Opening")
  case PartyEdge extends GuideSection("Party-specific tactic")
  case Safety    extends GuideSection("Safety")

enum EnemyTag:
  case Undead

final case class BossProfile(name: String, tags: Set[EnemyTag])

object BossProfile:
  def fromName(name: String): BossProfile =
    val normalizedName = name.toLowerCase
    val tags           =
      if Set("vampire", "lich").contains(normalizedName) then Set(EnemyTag.Undead)
      else Set.empty

    BossProfile(normalizedName, tags)

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

final case class StrategyRule(
    boss: BossQuery,
    section: GuideSection,
    when: PartyQuery,
    advice: AdviceTemplate
)

object StrategyRule:
  def apply(
      boss: BossQuery,
      section: GuideSection,
      when: PartyQuery,
      advice: String
  ): StrategyRule =
    new StrategyRule(boss, section, when, AdviceTemplate.static(advice))

final case class GuideFragment(section: GuideSection, advice: String)

final case class BossGuide(boss: String, fragments: List[GuideFragment])

final class StrategyGuide(rules: List[StrategyRule]):
  def forPartyAndBoss(party: Party, bossName: String): BossGuide =
    val boss      = BossProfile.fromName(bossName)
    val fragments = rules.collect:
      case rule if rule.boss.matches(boss) && rule.when.matches(party) =>
        GuideFragment(rule.section, rule.advice.render(party, boss))

    BossGuide(boss.name, fragments)

object FinalFantasyStrategyGuide:
  import AdvicePart.*
  import BossQuery.*
  import Capability.*
  import EnemyTag.*
  import GuideSection.*
  import Item.*
  import PartyQuery.*
  import Spell.*

  private val noHealer =
    Not(HasCapability(Healing, 1))

  private val noHealerWithPotion =
    all(noHealer, HasItem(Potion))

  private val noHealerWithoutPotion =
    all(noHealer, Not(HasItem(Potion)))

  private val hasPhysicalAttacker =
    HasCapability(PhysicalDamage, 1)

  private val physicalBuffBosses =
    Set(
      "marilith",
      "warmech",
      "tiamat",
      "lich (rematch)",
      "marilith (rematch)",
      "kraken (rematch)",
      "tiamat (rematch)",
      "chaos"
    )

  private val physicalDefenseBosses =
    Set("marilith", "kraken", "warmech", "marilith (rematch)", "kraken (rematch)", "chaos")

  private val enduranceBosses =
    Set("warmech", "tiamat", "lich (rematch)", "marilith (rematch)", "kraken (rematch)", "tiamat (rematch)", "chaos")

  private val lightningThreatBosses =
    Set("blue dragon", "tiamat", "kraken (rematch)", "tiamat (rematch)", "chaos")

  private val fireThreatBosses =
    Set("marilith", "tiamat", "marilith (rematch)", "tiamat (rematch)", "chaos")

  private val iceThreatBosses =
    Set("lich", "tiamat", "tiamat (rematch)", "chaos")

  private val instantDeathBosses =
    Set("astos", "evil eye", "lich (rematch)", "marilith (rematch)", "tiamat (rematch)")

  private val resistantEndgameBosses =
    Set("warmech", "tiamat", "lich (rematch)", "marilith (rematch)", "kraken (rematch)", "tiamat (rematch)", "chaos")

  private def knowsWithPhysicalTarget(spell: Spell): PartyQuery =
    all(HasSpell(spell, 1), hasPhysicalAttacker)

  private def template(parts: AdvicePart*): AdviceTemplate =
    AdviceTemplate.of(parts*)

  val rules: List[StrategyRule] =
    List(
      StrategyRule(
        Named("garland"),
        Opening,
        Always,
        template(
          Text("Have "),
          Members(MemberSelector.AllMembers),
          Text(" focus on "),
          BossName,
          Text("; there are no extra enemies to manage.")
        )
      ),
      StrategyRule(
        Named("garland"),
        PartyEdge,
        HasCapability(PhysicalDamage, atLeast = 3),
        template(
          Text("Have "),
          Members(MemberSelector.WithCapability(PhysicalDamage)),
          Text(" lean into basic attacks; setup costs more turns than it saves.")
        )
      ),
      StrategyRule(
        Named("garland"),
        PartyEdge,
        hasAnySpell(1, Spell.elemental.toSeq*),
        template(
          Text("Have "),
          Members(MemberSelector.knowsAny(Spell.elemental.toSeq*)),
          Text(" spend MP on a learned elemental spell instead of making a weak physical attack.")
        )
      ),
      StrategyRule(
        Named("garland"),
        Safety,
        hasAnySpell(1, Spell.healing.toSeq*),
        template(
          Text("Keep "),
          Members(MemberSelector.WithCapability(Healing)),
          Text(" attacking until someone is near half health, then use a learned recovery spell.")
        )
      ),
      StrategyRule(
        Named("garland"),
        Safety,
        noHealerWithPotion,
        template(
          Text("With no recovery spell, "),
          Members(MemberSelector.CanUse(Potion)),
          Text(" can use Potions from shared inventory.")
        )
      ),
      StrategyRule(
        Named("garland"),
        Safety,
        noHealerWithoutPotion,
        "You have no in-party healing, so arrive rested and treat this as a damage race."
      ),
      StrategyRule(
        Named("pirates"),
        Opening,
        Always,
        template(
          Text("Have "),
          Members(MemberSelector.AllMembers),
          Text(" remove one Pirate at a time so the enemy side gets fewer attacks each round.")
        )
      ),
      StrategyRule(
        Named("pirates"),
        PartyEdge,
        HasSpell(Sleep, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Sleep)),
          Text(" cast Sleep to control the full crowd, then clean up awake targets first.")
        )
      ),
      StrategyRule(
        Named("pirates"),
        PartyEdge,
        hasAnySpell(1, Spell.elemental.toSeq*),
        template(
          Text("Have "),
          Members(MemberSelector.knowsAny(Spell.elemental.toSeq*)),
          Text(" conserve learned elemental magic unless basic attacks fall behind.")
        )
      ),
      StrategyRule(
        Named("pirates"),
        PartyEdge,
        HasCapability(PhysicalDamage, atLeast = 2),
        template(
          Text("Have "),
          Members(MemberSelector.WithCapability(PhysicalDamage)),
          Text(" use basic attacks and conserve MP.")
        )
      ),
      StrategyRule(
        Named("pirates"),
        Safety,
        HasCapability(Healing, 1),
        template(
          Text("Do not heal preemptively; have "),
          Members(MemberSelector.WithCapability(Healing)),
          Text(" recover only if focused damage puts someone at risk.")
        )
      ),
      StrategyRule(
        Named("pirates"),
        Safety,
        noHealer,
        "Without healing, crowd control and quickly reducing the Pirate count are your defenses."
      ),
      StrategyRule(
        Named("piscodemons"),
        Opening,
        Always,
        template(
          Text("Have "),
          Members(MemberSelector.AllMembers),
          Text(" focus on one Piscodemon at a time; every defeat immediately reduces incoming physical attacks.")
        )
      ),
      StrategyRule(
        Named("piscodemons"),
        PartyEdge,
        knowsWithPhysicalTarget(Temper),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Temper)),
          Text(" cast Temper on "),
          Members(MemberSelector.WithCapability(PhysicalDamage)),
          Text("; weapon damage is more reliable here than most offensive magic.")
        )
      ),
      StrategyRule(
        Named("piscodemons"),
        PartyEdge,
        knowsWithPhysicalTarget(Haste),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Haste)),
          Text(" cast Haste on "),
          Members(MemberSelector.PreferredPhysicalAttacker),
          Text(" to shorten the dangerous opening rounds.")
        )
      ),
      StrategyRule(
        Named("piscodemons"),
        PartyEdge,
        all(HasSpell(Thunder, 1), Not(hasPhysicalAttacker)),
        template(
          Text("With no physical attacker, have "),
          Members(MemberSelector.Knows(Thunder)),
          Text(" cast Thunder; avoid the Piscodemons' resistance to Fire and Blizzard.")
        )
      ),
      StrategyRule(
        Named("astos"),
        Opening,
        Always,
        template(
          BossName,
          Text(" opens with lethal magic, so disruption or a fast knockout matters more than attrition.")
        )
      ),
      StrategyRule(
        Named("astos"),
        PartyEdge,
        HasSpell(Silence, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Silence)),
          Text(" cast Silence immediately; if it lands, Astos loses Death and the rest of his spell list.")
        )
      ),
      StrategyRule(
        Named("astos"),
        PartyEdge,
        knowsWithPhysicalTarget(Temper),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Temper)),
          Text(" cast Temper on "),
          Members(MemberSelector.WithCapability(PhysicalDamage)),
          Text(" to end the fight before Astos gets more spell turns.")
        )
      ),
      StrategyRule(
        Named("astos"),
        PartyEdge,
        knowsWithPhysicalTarget(Haste),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Haste)),
          Text(" cast Haste on "),
          Members(MemberSelector.PreferredPhysicalAttacker),
          Text(" for the quickest knockout line.")
        )
      ),
      StrategyRule(
        Named("astos"),
        Safety,
        all(HasSpell(Slow, 1), Not(HasSpell(Silence, 1))),
        template(
          Text("Without Silence, have "),
          Members(MemberSelector.Knows(Slow)),
          Text(" try Slow to blunt Astos's physical attacks; it will not prevent Death.")
        )
      ),
      StrategyRule(
        Named("vampire"),
        Opening,
        Always,
        template(BossName, Text(" is a short burst fight: exploit its weaknesses before paralysis creates bad turns."))
      ),
      StrategyRule(
        Named("lich"),
        Opening,
        Always,
        template(
          BossName,
          Text(" is the first sustained boss fight here; keep everyone healthy enough to survive its spell sequence.")
        )
      ),
      StrategyRule(
        HasTag(Undead),
        PartyEdge,
        HasSpell(Dia, 1),
        template(
          BossName,
          Text(" is undead; have "),
          Members(MemberSelector.Knows(Dia)),
          Text(" cast Dia for direct anti-undead damage.")
        )
      ),
      StrategyRule(
        HasTag(Undead),
        PartyEdge,
        HasSpell(Fire, 1),
        template(
          BossName,
          Text(" is undead and weak to fire; have "),
          Members(MemberSelector.Knows(Fire)),
          Text(" cast Fire as the default action.")
        )
      ),
      StrategyRule(
        Named("lich"),
        Safety,
        HasSpell(Protect, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Protect)),
          Text(" cast Protect to raise an ally's defense before settling into recovery duty.")
        )
      ),
      StrategyRule(
        Named("lich"),
        Safety,
        HasSpell(Blink, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Blink)),
          Text(" cast Blink for personal evasion, but do not treat it as protection from Lich's spells.")
        )
      ),
      StrategyRule(
        Named("lich"),
        Safety,
        HasCapability(Healing, 1),
        template(
          Text("Have "),
          Members(MemberSelector.WithCapability(Healing)),
          Text(" reserve enough healing for recovery after Lich's party-wide magic.")
        )
      ),
      StrategyRule(
        Named("lich"),
        Safety,
        noHealer,
        "With no healer, Lich becomes a strict damage race; arrive fully stocked and commit your strongest attacks."
      ),
      StrategyRule(
        Named("marilith"),
        Opening,
        Always,
        "Marilith applies sustained physical pressure; establish your defenses before committing everyone to offense."
      ),
      StrategyRule(
        Named("evil eye"),
        Opening,
        Always,
        "Evil Eye is dangerous because of its disabling magic, so treat the encounter as an immediate damage race."
      ),
      StrategyRule(
        Named("dragon zombies"),
        Opening,
        Always,
        "Focus both Dragon Zombies on one target at a time so the second half of the fight has fewer incoming attacks."
      ),
      StrategyRule(
        Named("kraken"),
        Opening,
        Always,
        "Kraken's physical offense is the immediate threat; stabilize the front line and concentrate damage."
      ),
      StrategyRule(
        Named("blue dragon"),
        Opening,
        Always,
        "Blue Dragon is a compact burst fight; use reliable single-target damage and preserve enough recovery for the climb ahead."
      ),
      StrategyRule(
        Named("warmech"),
        Opening,
        Always,
        "Warmech can overwhelm the whole party quickly; open with your strongest defense, recovery, and focused damage."
      ),
      StrategyRule(
        Named("tiamat"),
        Opening,
        Always,
        "Tiamat resists broad elemental offense, so build the plan around physical damage and sustained recovery."
      ),
      StrategyRule(
        Named("lich (rematch)"),
        Opening,
        Always,
        "The Lich rematch punishes a depleted party; restore the group quickly and save decisive damage for safe turns."
      ),
      StrategyRule(
        Named("marilith (rematch)"),
        Opening,
        Always,
        "The Marilith rematch adds late-game lethality to its physical pressure; protect the front line and end it cleanly."
      ),
      StrategyRule(
        Named("kraken (rematch)"),
        Opening,
        Always,
        "The Kraken rematch is an endurance check; keep recovery ahead of its physical pressure while focusing damage."
      ),
      StrategyRule(
        Named("tiamat (rematch)"),
        Opening,
        Always,
        "The Tiamat rematch is the last resource check before Chaos; lean on reliable damage and avoid wasteful casting."
      ),
      StrategyRule(
        Named("chaos"),
        Opening,
        Always,
        "Chaos is a sustained final fight; establish offense and defense early, then keep healing ahead of incoming damage."
      ),
      StrategyRule(
        Named("marilith"),
        PartyEdge,
        HasSpell(Sleep, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Sleep)),
          Text(" try Sleep; unlike most bosses, Marilith can lose turns to it.")
        )
      ),
      StrategyRule(
        Named("evil eye"),
        PartyEdge,
        hasPhysicalAttacker,
        template(
          Text("Have "),
          Members(MemberSelector.PreferredPhysicalAttacker),
          Text(" attack immediately rather than spend a turn setting up against Evil Eye.")
        )
      ),
      StrategyRule(
        Named("evil eye"),
        PartyEdge,
        all(Not(hasPhysicalAttacker), HasCapability(OffensiveMagic, 1)),
        template(
          Text("With no physical attacker, have "),
          Members(MemberSelector.WithCapability(OffensiveMagic)),
          Text(" spend learned attack magic immediately before Evil Eye can disable the party.")
        )
      ),
      StrategyRule(
        Named("dragon zombies"),
        PartyEdge,
        HasSpell(Dia, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Dia)),
          Text(" cast Dia into the undead pair while the rest of the party focuses one target.")
        )
      ),
      StrategyRule(
        Named("dragon zombies"),
        PartyEdge,
        HasSpell(Fire, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Fire)),
          Text(" use Fire against the Dragon Zombies instead of basic mage attacks.")
        )
      ),
      StrategyRule(
        Named("kraken"),
        PartyEdge,
        HasSpell(Thunder, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Thunder)),
          Text(" exploit Kraken's lightning weakness with Thunder.")
        )
      ),
      StrategyRule(
        Named("blue dragon"),
        PartyEdge,
        HasSpell(Fire, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Fire)),
          Text(" exploit Blue Dragon's fire weakness with Fire.")
        )
      ),
      StrategyRule(
        Named("tiamat"),
        PartyEdge,
        hasAnySpell(1, Spell.elemental.toSeq*),
        template(
          Text("Have "),
          Members(MemberSelector.knowsAny(Spell.elemental.toSeq*)),
          Text(" conserve elemental MP against Tiamat's resistances and support the physical plan instead.")
        )
      ),
      StrategyRule(
        Named("lich (rematch)"),
        PartyEdge,
        HasSpell(Fire, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Fire)),
          Text(" conserve Fire; the rematch no longer has Lich's original fire weakness.")
        )
      ),
      StrategyRule(
        Named("marilith (rematch)"),
        PartyEdge,
        hasAnySpell(1, Spell.elemental.toSeq*),
        template(
          Text("Have "),
          Members(MemberSelector.knowsAny(Spell.elemental.toSeq*)),
          Text(" save elemental MP; the rematch resists Fire, Blizzard, and Thunder.")
        )
      ),
      StrategyRule(
        Named("kraken (rematch)"),
        PartyEdge,
        HasSpell(Thunder, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Thunder)),
          Text(" conserve Thunder; Kraken's lightning weakness is gone in the rematch.")
        )
      ),
      StrategyRule(
        namedAny(physicalBuffBosses.toSeq*),
        PartyEdge,
        knowsWithPhysicalTarget(Haste),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Haste)),
          Text(" cast Haste on "),
          Members(MemberSelector.PreferredPhysicalAttacker),
          Text(" for the main damage line against "),
          BossName,
          Text(".")
        )
      ),
      StrategyRule(
        namedAny(physicalBuffBosses.toSeq*),
        PartyEdge,
        knowsWithPhysicalTarget(Temper),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Temper)),
          Text(" cast Temper on "),
          Members(MemberSelector.PreferredPhysicalAttacker),
          Text(" once Haste or the opening defense is covered.")
        )
      ),
      StrategyRule(
        namedAny(physicalDefenseBosses.toSeq*),
        Safety,
        HasSpell(Protect, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Protect)),
          Text(" use Protect to blunt repeated physical hits from "),
          BossName,
          Text(".")
        )
      ),
      StrategyRule(
        namedAny(enduranceBosses.toSeq*),
        Safety,
        HasCapability(Healing, 1),
        template(
          Text("Have "),
          Members(MemberSelector.WithCapability(Healing)),
          Text(" preserve recovery turns and MP; this fight is too long to treat as a pure damage race.")
        )
      ),
      StrategyRule(
        namedAny(enduranceBosses.toSeq*),
        Safety,
        noHealer,
        template(
          Text("With no recovery magic, have "),
          Members(MemberSelector.AllMembers),
          Text(" commit to a short buff-and-burst line; "),
          BossName,
          Text(" will win a long fight.")
        )
      ),
      StrategyRule(
        namedAny(lightningThreatBosses.toSeq*),
        Safety,
        HasSpell(NulShock, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(NulShock)),
          Text(" cast NulShock before the party is exposed to repeated lightning damage from "),
          BossName,
          Text(".")
        )
      ),
      StrategyRule(
        namedAny(fireThreatBosses.toSeq*),
        Safety,
        HasSpell(NulBlaze, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(NulBlaze)),
          Text(" cast NulBlaze early to halve the party's fire damage.")
        )
      ),
      StrategyRule(
        namedAny(iceThreatBosses.toSeq*),
        Safety,
        HasSpell(NulFrost, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(NulFrost)),
          Text(" cast NulFrost before committing to offense so party-wide ice damage is easier to heal through.")
        )
      ),
      StrategyRule(
        namedAny(instantDeathBosses.toSeq*),
        Safety,
        HasSpell(NulDeath, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(NulDeath)),
          Text(" cast NulDeath before "),
          BossName,
          Text(" gets repeated chances to remove a party member instantly.")
        )
      ),
      StrategyRule(
        namedAny(instantDeathBosses.toSeq*),
        Safety,
        HasSpell(Life, 1),
        template(
          Text("Keep "),
          Members(MemberSelector.Knows(Life)),
          Text(" alive and reserve a Life charge to recover from an instant knockout.")
        )
      ),
      StrategyRule(
        namedAny(physicalDefenseBosses.toSeq*),
        Safety,
        HasSpell(Protera, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Protera)),
          Text(" cast Protera so the whole party can withstand "),
          BossName,
          Text("'s repeated physical hits.")
        )
      ),
      StrategyRule(
        namedAny(physicalDefenseBosses.toSeq*),
        Safety,
        HasSpell(Invisira, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Invisira)),
          Text(" cast Invisira to raise the whole party's evasion before the long physical exchange.")
        )
      ),
      StrategyRule(
        namedAny(resistantEndgameBosses.toSeq*),
        PartyEdge,
        HasSpell(Flare, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Flare)),
          Text(" use Flare as reliable non-elemental offense against "),
          BossName,
          Text(".")
        )
      ),
      StrategyRule(
        namedAny(resistantEndgameBosses.toSeq*),
        PartyEdge,
        HasSpell(Saber, 1),
        template(
          Text("Have "),
          Members(MemberSelector.Knows(Saber)),
          Text(" cast Saber on themselves when their best contribution is a self-buffed physical attack.")
        )
      )
    )

  val guide = StrategyGuide(rules)
