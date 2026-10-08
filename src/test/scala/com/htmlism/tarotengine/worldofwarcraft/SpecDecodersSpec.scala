package com.htmlism.tarotengine.worldofwarcraft

import io.circe.yaml.parser
import weaver.*

object SpecDecodersSpec extends FunSuite:
  private val journalYaml = """- faction: Alliance
                            |  race: Human
                            |  class: Warlock
                            |  primarySpec: Affliction
                            |  secondarySpec: Demonology
                            |  professions: [Tailoring, Engineering]
                            |  checkpoints: []
                            |""".stripMargin

  test("journal uses primarySpec and secondarySpec with typed spec values"):
    val expected = List(
      AltJournalEntry(
        Faction.Alliance,
        Race.Human,
        CharacterClass.Warlock,
        Spec.Affliction,
        Spec.Demonology,
        Set(Profession.Tailoring, Profession.Engineering),
        Nil
      )
    )

    expect.same(Right(expected), parser.parse(journalYaml).flatMap(_.as[List[AltJournalEntry]]))

  test("old journal keys do not silently replace the required spec keys"):
    val oldYaml = journalYaml.replace("primarySpec:", "primary:").replace("secondarySpec:", "secondary:")

    expect(parser.parse(oldYaml).flatMap(_.as[List[AltJournalEntry]]).isLeft)

  test("shared spec names preserve their owning class in the catalog"):
    val yaml = """- class: Paladin
                 |  features: {}
                 |  specs:
                 |    - name: Protection
                 |      features: {mana: 1}
                 |- class: Warrior
                 |  features: {}
                 |  specs:
                 |    - name: Protection
                 |      features: {rage: 1}
                 |""".stripMargin

    val expected = List(
      ClassTalentSpecs(CharacterClass.Paladin, Map.empty, List(TalentSpec(Spec.Protection, Map("mana" -> 1)))),
      ClassTalentSpecs(CharacterClass.Warrior, Map.empty, List(TalentSpec(Spec.Protection, Map("rage" -> 1))))
    )

    expect.same(Right(expected), parser.parse(yaml).flatMap(_.as[List[ClassTalentSpecs]]))

  test("decode multiword spec names and reject unknown names"):
    expect.same(Right(Spec.FeralCombat), parser.parse("Feral Combat").flatMap(_.as[Spec])) &&
    expect.same(Right(Spec.BeastMastery), parser.parse("Beast Mastery").flatMap(_.as[Spec])) &&
    expect(parser.parse("Prot").flatMap(_.as[Spec]).isLeft) &&
    expect(parser.parse(journalYaml.replace("Affliction", "Unknown")).flatMap(_.as[List[AltJournalEntry]]).isLeft)
