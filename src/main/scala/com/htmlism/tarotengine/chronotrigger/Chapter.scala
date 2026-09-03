package com.htmlism.tarotengine.chronotrigger

import cats.data.NonEmptyList
import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder

/**
  * @param rosterChanges
  *   changes applied on entry; they determine the roster used during this chapter
  * @param completionChanges
  *   changes applied after this chapter; their result is carried into the next chapter
  */
final case class Chapter(
    title: String,
    bosses: Option[NonEmptyList[String]],
    partyRestrictions: Option[NonEmptyList[String]],
    sideQuests: Option[NonEmptyList[SideQuest]],
    rosterChanges: Option[NonEmptyList[RosterChange]],
    completionChanges: Option[NonEmptyList[RosterChange]]
)

object Chapter:
  given Decoder[Chapter] = deriveDecoder[Chapter]
