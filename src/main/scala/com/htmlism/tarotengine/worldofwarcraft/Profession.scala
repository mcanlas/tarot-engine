package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

/** Primary professions occupying the journal's two profession slots. */
enum Profession:
  case Alchemy
  case Blacksmithing
  case Enchanting
  case Engineering
  case Herbalism
  case Leatherworking
  case Mining
  case Skinning
  case Tailoring

object Profession:
  given Decoder[Profession] = Decoder
    .decodeString
    .emap: value =>
      Profession
        .values
        .find(_.toString == value)
        .toRight(s"Unknown WoW Forever primary profession: $value")
