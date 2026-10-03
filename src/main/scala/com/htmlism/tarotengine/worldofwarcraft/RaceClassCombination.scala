package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

final case class RaceClassCombination(race: Race, className: CharacterClass, faction: Option[Faction])

object RaceClassCombination:
  given Decoder[RaceClassCombination] =
    Decoder.forProduct3("race", "class", "faction")(RaceClassCombination.apply)
