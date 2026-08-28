package com.htmlism.tarotengine.finalfantasy.vibe

import weaver.*

object BossStrategyGuideSpec extends FunSuite:
  import Capability.*
  import GuideSection.*
  import Item.*
  import Job.*
  import PartyQuery.*
  import Spell.*

  private def untrained(jobs: Job*): Party =
    Party(jobs.toList.map(PartyMember(_)))

  test("boss-strategy YAML owns all ordered rules and enemy tags"):
    val loaded = FinalFantasyBossStrategyGuide.load()

    expect(
      loaded.exists: data =>
        val tagsByBoss = data.bosses.map(definition => definition.boss -> definition.tags).toMap

        data.ruleCount == 66 &&
        tagsByBoss.get("vampire").contains(List("undead")) &&
        tagsByBoss.get("lich").contains(List("undead")) &&
        tagsByBoss.get("garland").contains(Nil)
    )

  test("Final Fantasy YAML owns class attributes and spell learnability"):
    val loaded = FinalFantasyData.load()

    expect(
      loaded.exists: catalog =>
        val redMage = catalog.job("red-mage")
        val cure    = catalog.spell("cure")

        redMage.label == "Red Mage" &&
        redMage.pluralLabel == "Red Mages" &&
        redMage.capabilities.contains(PhysicalDamage) &&
        cure.learnableBy == Set("white-mage", "red-mage", "knight", "white-wizard", "red-wizard") &&
        cure.attributes.contains(SpellAttribute.Healing)
    )

  test("class data requires and resolves every promotion"):
    val catalog = FinalFantasyData.catalog

    expect.same(12, catalog.classes.size) &&
    expect.same(Some(Knight), catalog.promotionFor(Warrior)) &&
    expect.same(Some(Ninja), catalog.promotionFor(Thief)) &&
    expect.same(Some(Master), catalog.promotionFor(Monk)) &&
    expect.same(Some(RedWizard), catalog.promotionFor(RedMage)) &&
    expect.same(Some(WhiteWizard), catalog.promotionFor(WhiteMage)) &&
    expect.same(Some(BlackWizard), catalog.promotionFor(BlackMage)) &&
    expect.same(None, catalog.promotionFor(Knight))

  test("party members retain learned spells when promoted"):
    val whiteMage = PartyMember.whiteMage(Cure, Dia)
    val promoted  = whiteMage.promote

    expect.same(WhiteWizard, promoted.job) &&
    expect.same(Set(Cure, Dia), promoted.learnedSpells) &&
    expect.same(promoted, promoted.promote)

  test("new spells retain promotion-aware class permissions"):
    expect(NulShock.learnableBy.contains(Knight.id)) &&
    expect(NulBlaze.learnableBy.contains(RedWizard.id)) &&
    expect(!NulFrost.learnableBy.contains(Knight.id)) &&
    expect.same(Set(BlackWizard.id), Flare.learnableBy) &&
    expect.same(Set(BlackWizard.id), Saber.learnableBy) &&
    expect(Life.learnableBy.contains(WhiteMage.id)) &&
    expect(NulDeath.learnableBy.contains(WhiteWizard.id))

  test("party queries compose job, capability, and negation conditions"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember.redMage(Cure, Protect),
        PartyMember.whiteMage(Cure),
        PartyMember.blackMage(Fire)
      )
    )
    val query = all(
      HasCapability(PhysicalDamage, atLeast = 2),
      HasJob(BlackMage, 1),
      HasSpell(Fire, 1),
      Not(HasJob(Monk, 1))
    )

    expect(query.matches(party))

  test("fluent collection constructors preserve their canonical enum values"):
    val first  = HasSpell(Fire, 1)
    val second = HasSpell(Thunder, 1)

    expect.same(All(List(first, second)), all(first, second)) &&
    expect.same(HasAnySpell(Set(Fire, Thunder), 2), hasAnySpell(2, Fire, Thunder)) &&
    expect.same(BossQuery.NamedAny(Set("kraken", "tiamat")), BossQuery.namedAny("kraken", "tiamat")) &&
    expect.same(MemberSelector.KnowsAny(Set(Fire, Thunder)), MemberSelector.knowsAny(Fire, Thunder))

  test("Garland advice reacts to a balanced party in declaration order"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember(Thief),
        PartyMember.whiteMage(Cure),
        PartyMember.blackMage(Thunder)
      )
    )
    val guide = FinalFantasyBossStrategyGuide.guide.forPartyAndBoss(party, "garland")

    expect.same(
      List(Opening, PartyEdge, Safety),
      guide.fragments.map(_.section)
    ) &&
    expect(guide.fragments.exists(_.advice.contains("Have the Black Mage spend MP on a learned elemental spell"))) &&
    expect(guide.fragments.exists(_.advice.contains("Keep the White Mage attacking"))) &&
    expect(!guide.fragments.exists(_.advice.contains("no in-party healing")))

  test("a mage job without learned spells does not unlock spell advice"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember(Thief),
        PartyMember.whiteMage(),
        PartyMember.blackMage()
      )
    )
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "garland")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("no in-party healing"))) &&
    expect(!advice.exists(_.contains("elemental spell"))) &&
    expect(!advice.exists(_.contains("recovery spell")))

  test("Pirates advice reacts to learned magic rather than a Black Mage job"):
    val withLit = Party(
      List(PartyMember(Warrior), PartyMember(Thief), PartyMember.whiteMage(), PartyMember.blackMage(Thunder))
    )
    val withoutSpells =
      Party(List(PartyMember(Warrior), PartyMember(Thief), PartyMember.whiteMage(), PartyMember.blackMage()))

    def conservesMagic(party: Party) =
      FinalFantasyBossStrategyGuide
        .guide
        .forPartyAndBoss(party, "pirates")
        .fragments
        .exists(_.advice.contains("elemental magic"))

    expect(conservesMagic(withLit)) && expect(!conservesMagic(withoutSpells))

  test("Red and Black Mages can independently learn Sleep"):
    val redParty   = Party(List(PartyMember(Warrior), PartyMember.redMage(Sleep)))
    val blackParty = Party(List(PartyMember(Warrior), PartyMember.blackMage(Sleep)))

    def mentionsSleep(party: Party) =
      FinalFantasyBossStrategyGuide
        .guide
        .forPartyAndBoss(party, "pirates")
        .fragments
        .exists(_.advice.contains("cast Sleep"))

    expect(mentionsSleep(redParty)) && expect(mentionsSleep(blackParty))

  test("templates name every class that contributes the referenced spell"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember.redMage(Sleep),
        PartyMember.blackMage(Sleep)
      )
    )
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "pirates")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("Have the Red Mage and the Black Mage cast Sleep")))

  test("Red Mage supports its overlapping white and black spell list"):
    val redMage = PartyMember.redMage(Cure, Fire, Blizzard, Thunder, Sleep, Protect)

    expect.same(Set[Spell](Cure, Fire, Blizzard, Thunder, Sleep, Protect), redMage.learnedSpells)

  test("Silence, Temper, Haste, and Slow have the correct caster overlap"):
    val whiteMage = PartyMember.whiteMage(Silence)
    val blackMage = PartyMember.blackMage(Temper, Haste, Slow)
    val redMage   = PartyMember.redMage(Silence, Temper, Haste, Slow)

    expect.same(Set[Spell](Silence), whiteMage.learnedSpells) &&
    expect.same(Set[Spell](Temper, Haste, Slow), blackMage.learnedSpells) &&
    expect.same(Set[Spell](Silence, Temper, Haste, Slow), redMage.learnedSpells)

  test("Piscodemon advice assigns Temper and Haste to their learned casters"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember(Monk),
        PartyMember.blackMage(Temper, Haste)
      )
    )
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "piscodemons")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("Have the Black Mage cast Temper"))) &&
    expect(advice.exists(_.contains("Have the Black Mage cast Haste on the Warrior")))

  test("Astos advice prioritizes Silence and suppresses the Slow fallback"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember.whiteMage(Silence),
        PartyMember.blackMage(Slow)
      )
    )
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "astos")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("Have the White Mage cast Silence immediately"))) &&
    expect(!advice.exists(_.contains("try Slow")))

  test("Astos advice uses Slow only when nobody learned Silence"):
    val party  = Party(List(PartyMember(Warrior), PartyMember.redMage(Slow)))
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "astos")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("have the Red Mage try Slow")))

  test("White Mage supports Protect and Blink"):
    val party  = Party(List(PartyMember.whiteMage(Protect, Blink)))
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "lich")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("Have the White Mage cast Protect"))) &&
    expect(advice.exists(_.contains("Have the White Mage cast Blink")))

  test("White Mage can learn Dia and contributes anti-undead advice"):
    val party = Party(List(PartyMember(Warrior), PartyMember.whiteMage(Dia)))

    def adviceFor(boss: String) =
      FinalFantasyBossStrategyGuide
        .guide
        .forPartyAndBoss(party, boss)
        .fragments
        .map(_.advice)

    expect(adviceFor("vampire").exists(_.contains("have the White Mage cast Dia"))) &&
    expect(adviceFor("lich").exists(_.contains("have the White Mage cast Dia")))

  test("every party member can use an item from shared inventory"):
    val members = List(PartyMember(Warrior), PartyMember.whiteMage(), PartyMember.blackMage())
    val party   = Party.withItems(members, Potion)

    forEach(members): member =>
      expect(party.canUse(member, Potion))

  test("item templates name all eligible party members and pluralize duplicate jobs"):
    val members = List(PartyMember(Warrior), PartyMember(Warrior), PartyMember.blackMage())
    val party   = Party.withItems(members, Potion)
    val advice  = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "garland")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("both Warriors and the Black Mage can use Potions")))

  test("Vampire and Lich inherit the same undead advice"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember(Thief),
        PartyMember.whiteMage(Cure),
        PartyMember.blackMage(Fire)
      )
    )

    def partyEdges(boss: String) =
      FinalFantasyBossStrategyGuide
        .guide
        .forPartyAndBoss(party, boss)
        .fragments
        .filter(_.section == PartyEdge)
        .map(_.advice)

    val vampireAdvice = partyEdges("vampire")
    val lichAdvice    = partyEdges("lich")

    expect(vampireAdvice.exists(_.contains("Vampire is undead"))) &&
    expect(lichAdvice.exists(_.contains("Lich is undead"))) &&
    forEach(vampireAdvice ++ lichAdvice): advice =>
      expect(advice.contains("have the Black Mage cast Fire"))

  test("an unlearned Fire spell does not contribute undead advice"):
    val party = Party(
      List(PartyMember(Warrior), PartyMember(Thief), PartyMember.whiteMage(Cure), PartyMember.blackMage(Blizzard))
    )
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "vampire")
      .fragments
      .map(_.advice)

    expect(!advice.exists(_.contains("cast Fire")))

  test("Lich adds a boss-specific no-healer warning"):
    val party  = untrained(Thief, Thief, Monk, Monk)
    val advice = FinalFantasyBossStrategyGuide
      .guide
      .forPartyAndBoss(party, "lich")
      .fragments
      .map(_.advice)

    expect(advice.exists(_.contains("strict damage race"))) &&
    expect(!advice.exists(_.contains("reserve enough healing")))

  test("later boss advice reacts to weaknesses, rematches, and party support"):
    val party = Party(
      List(
        PartyMember(Warrior),
        PartyMember.whiteMage(Cure, Dia, Protect),
        PartyMember.blackMage(Fire, Thunder, Haste, Temper)
      )
    )

    def adviceFor(boss: String) =
      FinalFantasyBossStrategyGuide
        .guide
        .forPartyAndBoss(party, boss)
        .fragments
        .map(_.advice)

    expect(adviceFor("dragon zombies").exists(_.contains("cast Dia into the undead pair"))) &&
    expect(adviceFor("kraken").exists(_.contains("lightning weakness"))) &&
    expect(adviceFor("kraken (rematch)").exists(_.contains("lightning weakness is gone"))) &&
    expect(adviceFor("chaos").exists(_.contains("cast Haste on the Warrior"))) &&
    expect(adviceFor("chaos").exists(_.contains("preserve recovery turns and MP")))

  test("promoted casters unlock every new defensive and offensive rule family"):
    val party = Party(
      List(
        PartyMember.knight(Cure, Protect, NulShock, NulBlaze),
        PartyMember.ninja(Haste, Temper),
        PartyMember.whiteWizard(Cure, NulFrost, NulDeath, Protera, Invisira, Life),
        PartyMember.blackWizard(Flare, Saber)
      )
    )

    def adviceFor(boss: String) =
      FinalFantasyBossStrategyGuide
        .guide
        .forPartyAndBoss(party, boss)
        .fragments
        .map(_.advice)

    val marilith = adviceFor("marilith")
    val tiamat   = adviceFor("tiamat")
    val astos    = adviceFor("astos")

    expect(marilith.exists(_.contains("cast NulBlaze"))) &&
    expect(marilith.exists(_.contains("cast Protera"))) &&
    expect(marilith.exists(_.contains("cast Invisira"))) &&
    expect(tiamat.exists(_.contains("cast NulShock"))) &&
    expect(tiamat.exists(_.contains("cast NulFrost"))) &&
    expect(tiamat.exists(_.contains("use Flare"))) &&
    expect(tiamat.exists(_.contains("cast Saber on themselves"))) &&
    expect(astos.exists(_.contains("cast NulDeath"))) &&
    expect(astos.exists(_.contains("reserve a Life charge")))

  test("the same party and boss always produce the same guide"):
    val party = untrained(Thief, Thief, Monk, Monk)
    val guide = FinalFantasyBossStrategyGuide.guide

    expect.same(
      guide.forPartyAndBoss(party, "pirates"),
      guide.forPartyAndBoss(party, "pirates")
    )

  test("the console demo includes varied party shapes"):
    val parties = VibeApp.demoScenarios.map(_.party)
    val hasSolo = exists(parties): party =>
      expect.same(1, party.members.size)
    val hasOnlyBlackMages = exists(parties): party =>
      expect(party.members.nonEmpty && party.members.forall(_.job == BlackMage))
    val hasOnlyThieves = exists(parties): party =>
      expect(party.members.nonEmpty && party.members.forall(_.job == Thief))
    val hasAntiUndeadWithoutHealing = exists(parties): party =>
      expect(party.members.exists(_.learnedSpells.contains(Dia))) &&
        expect.same(0, party.count(Capability.Healing))

    expect(VibeApp.demoScenarios.size >= 10) &&
    hasSolo &&
    hasOnlyBlackMages &&
    hasOnlyThieves &&
    hasAntiUndeadWithoutHealing
