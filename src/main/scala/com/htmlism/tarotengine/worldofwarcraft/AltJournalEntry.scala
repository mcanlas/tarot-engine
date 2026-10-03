package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

final case class AltJournalEntry(
    faction: Faction,
    race: Race,
    className: CharacterClass,
    primarySpec: Spec,
    secondarySpec: Spec,
    professions: Set[Profession]
)

object AltJournalEntry:
  given Decoder[AltJournalEntry] = Decoder.forProduct6(
    "faction",
    "race",
    "class",
    "primarySpec",
    "secondarySpec",
    "professions"
  )(AltJournalEntry.apply)
