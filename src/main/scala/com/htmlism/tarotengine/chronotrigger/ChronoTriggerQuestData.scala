package com.htmlism.tarotengine.chronotrigger

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import scala.util.Random

import cats.data.NonEmptyList
import cats.effect.IO
import cats.syntax.traverse.*
import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder
import io.circe.yaml.parser

final case class Chapter(
    title: String,
    bosses: Option[NonEmptyList[String]],
    partyRestrictions: Option[NonEmptyList[String]],
    sideQuests: Option[NonEmptyList[String]],
    rosterChanges: Option[NonEmptyList[RosterChange]]
)

final case class Roster(pinned: List[String], available: List[String])

final case class ChapterState(chapter: Chapter, roster: Roster, selectedParty: List[String])

sealed trait RosterChange

object RosterChange:
  final case class Pin(char: String) extends RosterChange

  final case class Unpin(char: String) extends RosterChange

  final case class Remove(char: String) extends RosterChange

  final case class Add(char: String) extends RosterChange

  given Decoder[RosterChange] = Decoder.instance: cursor =>
    cursor
      .get[String]("pin")
      .map(Pin.apply)
      .orElse(cursor.get[String]("unpin").map(Unpin.apply))
      .orElse(cursor.get[String]("remove").map(Remove.apply))
      .orElse(cursor.get[String]("add").map(Add.apply))

object Chapter:
  given Decoder[Chapter] = deriveDecoder[Chapter]

final case class ChronoTriggerQuestData(chapterStates: List[ChapterState])

object ChronoTriggerQuestData:
  private val yamlPath =
    Path.of("data", "chrono-trigger.yaml")

  private val initialRoster =
    Roster(pinned = List.empty, available = List.empty)

  private def applyChange(roster: Roster, change: RosterChange): Roster =
    change match
      case RosterChange.Pin(char) =>
        roster.copy(
          pinned    = (roster.pinned :+ char).distinct,
          available = roster.available.filterNot(_ == char)
        )

      case RosterChange.Unpin(char) =>
        roster.copy(
          pinned    = roster.pinned.filterNot(_ == char),
          available = (roster.available :+ char).distinct
        )

      case RosterChange.Remove(char) =>
        roster.copy(
          pinned    = roster.pinned.filterNot(_ == char),
          available = roster.available.filterNot(_ == char)
        )

      case RosterChange.Add(char) =>
        roster.copy(available = (roster.available :+ char).distinct)

  private def applyChapter(roster: Roster, chapter: Chapter): Roster =
    chapter
      .rosterChanges
      .fold(roster): changes =>
        changes.foldLeft(roster)(applyChange)

  private def rosterStates(chapters: List[Chapter]): List[(Chapter, Roster)] =
    val rosters =
      chapters
        .scanLeft(initialRoster):
          case (roster, chapter) => applyChapter(roster, chapter)
        .drop(1)

    chapters.zip(rosters)

  private def selectParty(roster: Roster): Rng[List[String]] =
    val openSlots = (3 - roster.pinned.size).max(0)

    Rng
      .shuffle(roster.available)
      .map(roster.pinned ++ _.take(openSlots))

  private[chronotrigger] def simulate(chapters: List[Chapter]): Rng[ChronoTriggerQuestData] =
    rosterStates(chapters)
      .traverse:
        case (chapter, roster) =>
          selectParty(roster).map(ChapterState(chapter, roster, _))
      .map(ChronoTriggerQuestData.apply)

  val build: IO[ChronoTriggerQuestData] =
    for
      yaml      <- IO.blocking(Files.readString(yamlPath, StandardCharsets.UTF_8))
      chapters  <- IO.fromEither(parser.parse(yaml).flatMap(_.as[List[Chapter]]))
      random    <- IO(Random())
      questData <- IO(simulate(chapters).runA(random).value)
    yield questData
