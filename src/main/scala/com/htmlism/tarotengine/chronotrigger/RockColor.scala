package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder

enum RockColor:
  case Black
  case Gold
  case Blue
  case White
  case Silver

object RockColor:
  given Decoder[RockColor] = Decoder
    .decodeString
    .emap: value =>
      RockColor
        .values
        .find(_.toString == value)
        .toRight(s"Unknown Chrono Trigger rock color: $value")
