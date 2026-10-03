package com.htmlism.tarotengine.worldofwarcraft

import io.circe.yaml.parser
import weaver.*

object EnumDecodersSpec extends FunSuite:
  test("decode canonical YAML names, including the spaced race name"):
    expect.same(Right(CharacterClass.Warlock), parser.parse("Warlock").flatMap(_.as[CharacterClass])) &&
    expect.same(Right(Faction.Alliance), parser.parse("Alliance").flatMap(_.as[Faction])) &&
    expect.same(Right(Race.NightElf), parser.parse("Night Elf").flatMap(_.as[Race])) &&
    expect.same(Right(Race.Skyborne), parser.parse("Skyborne").flatMap(_.as[Race]))

  test("profession arrays decode as unordered sets"):
    val expected = Right(Set(Profession.Tailoring, Profession.Engineering))

    expect.same(expected, parser.parse("[Tailoring, Engineering]").flatMap(_.as[Set[Profession]])) &&
    expect.same(expected, parser.parse("[Engineering, Tailoring]").flatMap(_.as[Set[Profession]]))

  test("reject unknown names rather than accepting arbitrary strings"):
    expect(parser.parse("Death Knight").flatMap(_.as[CharacterClass]).isLeft) &&
    expect(parser.parse("Neutral").flatMap(_.as[Faction]).isLeft) &&
    expect(parser.parse("NightElf").flatMap(_.as[Race]).isLeft) &&
    expect(parser.parse("Cooking").flatMap(_.as[Profession]).isLeft)

  test("names are case sensitive and must be strings"):
    expect(parser.parse("warlock").flatMap(_.as[CharacterClass]).isLeft) &&
    expect(parser.parse("42").flatMap(_.as[Race]).isLeft)
