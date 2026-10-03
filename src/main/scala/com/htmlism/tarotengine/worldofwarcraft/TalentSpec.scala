package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder

final case class TalentSpec(name: Spec, features: Map[String, Int])

object TalentSpec:
  given Decoder[TalentSpec] = deriveDecoder[TalentSpec]
