package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder

final case class ChronoTriggerDefinition(
    randomFlags: List[String],
    chapters: List[Chapter],
    secretTripleTechs: List[SecretTripleTech]
)

object ChronoTriggerDefinition:
  given Decoder[ChronoTriggerDefinition] = deriveDecoder[ChronoTriggerDefinition]
