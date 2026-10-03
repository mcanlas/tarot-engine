package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

enum Faction:
  case Alliance
  case Horde

object Faction:
  given Decoder[Faction] = Decoder
    .decodeString
    .emap: value =>
      Faction
        .values
        .find(_.toString == value)
        .toRight(s"Unknown WoW Forever faction: $value")
