package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder

final case class SideQuest(title: String, required: Option[Character])

object SideQuest:
  given Decoder[SideQuest] = deriveDecoder[SideQuest]
