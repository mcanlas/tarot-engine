package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

final case class AltCheckpoint(
    level: Int,
    observation: Option[String],
    preferredOver: List[String]
)

object AltCheckpoint:
  given Decoder[AltCheckpoint] =
    Decoder.forProduct3("level", "observation", "preferredOver")(AltCheckpoint.apply)
