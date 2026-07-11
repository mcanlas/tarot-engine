package com.htmlism.tarotengine

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import scala.util.Random

import cats.data.NonEmptyList
import cats.effect.IO
import cats.effect.IOApp
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

object ChronoTriggerYamlApp extends IOApp.Simple:
  private val initialRoster =
    Roster(pinned = List.empty, available = List.empty)

  private val yamlPath =
    Path.of("data", "chrono-trigger.yaml")

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

  private def displayRoster(chapter: Chapter, roster: Roster): String =
    val pinned    = roster.pinned.mkString(", ")
    val available = roster.available.mkString(", ")

    s"${chapter.title}: pinned=[$pinned], available=[$available]"

  private def selectParty(roster: Roster, random: Random): List[String] =
    val openSlots = (3 - roster.pinned.size).max(0)

    roster.pinned ++ random.shuffle(roster.available).take(openSlots)

  private def printRosterStates(chapters: List[Chapter], random: Random): IO[Unit] =
    val lines = rosterStates(chapters).flatMap:
      case (chapter, roster) =>
        val party = selectParty(roster, random).mkString(", ")

        List(
          displayRoster(chapter, roster),
          s"selected party=[$party]"
        )

    IO.println(lines.mkString("\n"))

  val run: IO[Unit] =
    for
      yaml     <- IO.blocking(Files.readString(yamlPath, StandardCharsets.UTF_8))
      chapters <- IO.fromEither(parser.parse(yaml).flatMap(_.as[List[Chapter]]))
      random   <- IO(Random())
      _        <- IO.println(s"Loaded ${chapters.size} Chrono Trigger chapters")
      _        <- printRosterStates(chapters, random)
    yield ()
