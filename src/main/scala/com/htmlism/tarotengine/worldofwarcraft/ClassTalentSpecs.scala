package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

final case class ClassTalentSpecs(className: CharacterClass, features: Map[String, Int], specs: List[TalentSpec])

object ClassTalentSpecs:
  given Decoder[ClassTalentSpecs] =
    Decoder.forProduct3("class", "features", "specs")(ClassTalentSpecs.apply)
