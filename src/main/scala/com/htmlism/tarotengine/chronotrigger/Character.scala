package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder

enum Character:
  case Crono
  case Marle
  case Lucca
  case Frog
  case Robo
  case Ayla
  case Magus

object Character:
  given Decoder[Character] = Decoder
    .decodeString
    .emap: value =>
      Character
        .values
        .find(_.toString == value)
        .toRight(s"Unknown Chrono Trigger character: $value")
