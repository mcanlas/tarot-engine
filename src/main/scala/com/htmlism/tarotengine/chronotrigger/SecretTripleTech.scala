package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder

final case class SecretTripleTech(name: String, characters: (Character, Character, Character), rockColor: RockColor)

object SecretTripleTech:
  given Decoder[SecretTripleTech] = deriveDecoder[SecretTripleTech]
