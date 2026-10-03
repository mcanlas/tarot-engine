package com.htmlism.tarotengine.worldofwarcraft

import io.circe.yaml.parser
import weaver.*

object RaceClassCombinationDecoderSpec extends FunSuite:
  test("decode class from its YAML key and allow an absent faction"):
    val yaml = """race: Night Elf
                 |class: Druid
                 |""".stripMargin

    expect.same(
      Right(RaceClassCombination(Race.NightElf, CharacterClass.Druid, None)),
      parser.parse(yaml).flatMap(_.as[RaceClassCombination])
    )

  test("preserve an explicit faction and reject unknown faction values"):
    val yaml = """race: Skyborne
                 |class: Mage
                 |faction: Alliance
                 |""".stripMargin

    expect.same(
      Right(RaceClassCombination(Race.Skyborne, CharacterClass.Mage, Some(Faction.Alliance))),
      parser.parse(yaml).flatMap(_.as[RaceClassCombination])
    ) &&
    expect(parser.parse(yaml.replace("Alliance", "Unknown")).flatMap(_.as[RaceClassCombination]).isLeft)
