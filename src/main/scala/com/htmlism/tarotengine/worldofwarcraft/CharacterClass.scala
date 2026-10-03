package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

enum CharacterClass:
  case Druid
  case Hunter
  case Mage
  case Paladin
  case Priest
  case Rogue
  case Shaman
  case Warlock
  case Warrior

object CharacterClass:
  given Decoder[CharacterClass] = Decoder
    .decodeString
    .emap: value =>
      CharacterClass
        .values
        .find(_.toString == value)
        .toRight(s"Unknown WoW Forever class: $value")
