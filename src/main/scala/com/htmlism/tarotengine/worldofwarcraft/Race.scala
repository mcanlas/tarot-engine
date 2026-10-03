package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

enum Race(val yamlName: String):
  case Dwarf    extends Race("Dwarf")
  case Gnome    extends Race("Gnome")
  case Human    extends Race("Human")
  case NightElf extends Race("Night Elf")
  case Orc      extends Race("Orc")
  case Tauren   extends Race("Tauren")
  case Troll    extends Race("Troll")
  case Undead   extends Race("Undead")
  case Skyborne extends Race("Skyborne")

object Race:
  given Decoder[Race] = Decoder
    .decodeString
    .emap: value =>
      Race
        .values
        .find(_.yamlName == value)
        .toRight(s"Unknown WoW Forever race: $value")
