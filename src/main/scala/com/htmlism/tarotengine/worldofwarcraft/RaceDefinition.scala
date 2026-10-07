package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

final case class RaceDefinition(race: Race, startingArea: String)

object RaceDefinition:
  given Decoder[RaceDefinition] = Decoder.forProduct2("race", "startingArea")(RaceDefinition.apply)
