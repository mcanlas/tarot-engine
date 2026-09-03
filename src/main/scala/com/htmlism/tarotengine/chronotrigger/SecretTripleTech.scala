package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder

final case class SecretTripleTech(name: String, characters: (String, String, String), rockColor: String)

object SecretTripleTech:
  given Decoder[SecretTripleTech] = deriveDecoder[SecretTripleTech]
