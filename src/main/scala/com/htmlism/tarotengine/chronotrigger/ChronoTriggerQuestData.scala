package com.htmlism.tarotengine.chronotrigger

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import scala.util.Random

import cats.data.NonEmptyList
import cats.effect.IO
import cats.syntax.traverse.*
import io.circe.yaml.parser

final case class ChronoTriggerQuestData(
    flags: Map[String, Boolean],
    chapterStates: List[ChapterState],
    secretTripleTechs: List[SecretTripleTech]
)

object ChronoTriggerQuestData:
  private val yamlPath =
    Path.of("data", "chrono-trigger.yaml")

  private val initialRoster =
    Roster(pinned = List.empty, available = List.empty)

  private def conditionMatches(flags: Map[String, Boolean], change: RosterChange): Boolean =
    change
      .when
      .forall:
        _.values
          .toSortedMap
          .forall:
            case (name, expected) => flags.get(name).contains(expected)

  private def pin(roster: Roster, char: String): Roster =
    roster.copy(
      pinned    = (roster.pinned :+ char).distinct,
      available = roster.available.filterNot(_ == char)
    )

  private def applyChange(roster: Roster, change: RosterChange): Roster =
    change match
      case RosterChange.Pin(char, _) =>
        pin(roster, char)

      case RosterChange.Unpin(char, _) =>
        roster.copy(
          pinned    = roster.pinned.filterNot(_ == char),
          available = (roster.available :+ char).distinct
        )

      case RosterChange.Remove(char, _) =>
        roster.copy(
          pinned    = roster.pinned.filterNot(_ == char),
          available = roster.available.filterNot(_ == char)
        )

      case RosterChange.Add(char, _) =>
        roster.copy(available = (roster.available :+ char).distinct)

  private def applyChanges(
      flags: Map[String, Boolean],
      roster: Roster,
      changes: Option[NonEmptyList[RosterChange]]
  ): Roster =
    changes
      .fold(roster): changes =>
        changes
          .filter(conditionMatches(flags, _))
          .foldLeft(roster)(applyChange)

  private def rosterStates(chapters: List[Chapter], flags: Map[String, Boolean]): List[(Chapter, Roster, Roster)] =
    chapters
      .foldLeft(initialRoster -> List.empty[(Chapter, Roster, Roster)]):
        case ((previousRoster, states), chapter) =>
          val chapterRoster   = applyChanges(flags, previousRoster, chapter.rosterChanges)
          val completedRoster = applyChanges(flags, chapterRoster, chapter.completionChanges)

          completedRoster -> ((chapter, chapterRoster, completedRoster) :: states)
      ._2
      .reverse

  private def selectParty(roster: Roster): Rng[List[String]] =
    val openSlots = (3 - roster.pinned.size).max(0)

    Rng
      .shuffle(roster.available)
      .map(roster.pinned ++ _.take(openSlots))

  private def selectSideQuests(
      sideQuests: NonEmptyList[SideQuest],
      roster: Roster
  ): Rng[List[SideQuestState]] =
    Rng
      .shuffle(sideQuests.toList)
      .flatMap:
        _.traverse: sideQuest =>
          val sideQuestRoster = sideQuest
            .required
            .fold(roster): char =>
              pin(roster, char)

          selectParty(sideQuestRoster).map(SideQuestState(sideQuest.title, sideQuestRoster, _))

  private def chooseFlags(names: List[String]): Rng[Map[String, Boolean]] =
    names
      .distinct
      .traverse: name =>
        Rng.nextBoolean.map(name -> _)
      .map(_.toMap)

  private[chronotrigger] def simulate(
      definition: ChronoTriggerDefinition,
      flags: Map[String, Boolean]
  ): Rng[ChronoTriggerQuestData] =
    rosterStates(definition.chapters, flags)
      .traverse:
        case (chapter, roster, rosterAfterCompletion) =>
          chapter.sideQuests match
            case None =>
              selectParty(roster).map(ChapterState(chapter, roster, rosterAfterCompletion, _, List.empty))

            case Some(sideQuests) =>
              selectSideQuests(sideQuests, roster)
                .map(ChapterState(chapter, roster, rosterAfterCompletion, List.empty, _))
      .map(ChronoTriggerQuestData(flags, _, definition.secretTripleTechs))

  private[chronotrigger] def simulate(definition: ChronoTriggerDefinition): Rng[ChronoTriggerQuestData] =
    chooseFlags(definition.randomFlags).flatMap(simulate(definition, _))

  val load: IO[ChronoTriggerDefinition] =
    for
      yaml       <- IO.blocking(Files.readString(yamlPath, StandardCharsets.UTF_8))
      definition <- IO.fromEither(parser.parse(yaml).flatMap(_.as[ChronoTriggerDefinition]))
    yield definition

  def build(definition: ChronoTriggerDefinition, random: Random): IO[ChronoTriggerQuestData] =
    IO(simulate(definition).runA(random).value)
