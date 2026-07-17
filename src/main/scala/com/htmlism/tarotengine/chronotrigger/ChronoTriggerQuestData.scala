package com.htmlism.tarotengine.chronotrigger

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import scala.collection.immutable.SortedMap
import scala.util.Random

import cats.data.NonEmptyList
import cats.data.NonEmptyMap
import cats.effect.IO
import cats.syntax.traverse.*
import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder
import io.circe.yaml.parser

final case class ChronoTriggerDefinition(
    randomFlags: List[String],
    chapters: List[Chapter],
    secretTripleTechs: List[SecretTripleTech]
)

final case class SecretTripleTech(name: String, characters: (String, String, String), rockColor: String)

object SecretTripleTech:
  given Decoder[SecretTripleTech] = deriveDecoder[SecretTripleTech]

sealed trait TripleTechDesignation

object TripleTechDesignation:
  final case class Secret(tech: SecretTripleTech) extends TripleTechDesignation

  case object Base extends TripleTechDesignation

  def forParty(
      selectedParty: List[String],
      secretTripleTechs: List[SecretTripleTech]
  ): Option[TripleTechDesignation] =
    secretTripleTechs
      .find: tech =>
        selectedParty.size == 3 && tech.characters.toList.toSet == selectedParty.toSet
      .map(Secret.apply)
      .orElse:
        Option.when(selectedParty.contains("Chrono") && !selectedParty.contains("Magus"))(Base)

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

final case class SideQuest(title: String, required: Option[String])

final case class Roster(pinned: List[String], available: List[String])

final case class SideQuestState(title: String, roster: Roster, selectedParty: List[String])

final case class ChapterState(
    chapter: Chapter,
    roster: Roster,
    rosterAfterCompletion: Roster,
    selectedParty: List[String],
    sideQuestStates: List[SideQuestState]
)

final case class FlagCondition(values: NonEmptyMap[String, Boolean])

object FlagCondition:
  given Decoder[FlagCondition] = Decoder[Map[String, Boolean]].emap: values =>
    NonEmptyMap
      .fromMap(SortedMap.from(values))
      .map(FlagCondition.apply)
      .toRight("A flag condition must contain at least one flag")

sealed trait RosterChange:
  def when: Option[FlagCondition]

object RosterChange:
  final case class Pin(char: String, when: Option[FlagCondition]) extends RosterChange

  object Pin:
    def apply(char: String): Pin =
      Pin(char, None)

  final case class Unpin(char: String, when: Option[FlagCondition]) extends RosterChange

  object Unpin:
    def apply(char: String): Unpin =
      Unpin(char, None)

  final case class Remove(char: String, when: Option[FlagCondition]) extends RosterChange

  object Remove:
    def apply(char: String): Remove =
      Remove(char, None)

  final case class Add(char: String, when: Option[FlagCondition]) extends RosterChange

  object Add:
    def apply(char: String): Add =
      Add(char, None)

  given Decoder[RosterChange] = Decoder.instance: cursor =>
    cursor
      .get[Option[FlagCondition]]("when")
      .flatMap: when =>
        cursor
          .get[String]("pin")
          .map(Pin(_, when))
          .orElse(cursor.get[String]("unpin").map(Unpin(_, when)))
          .orElse(cursor.get[String]("remove").map(Remove(_, when)))
          .orElse(cursor.get[String]("add").map(Add(_, when)))

object Chapter:
  given Decoder[Chapter] = deriveDecoder[Chapter]

object SideQuest:
  given Decoder[SideQuest] = deriveDecoder[SideQuest]

object ChronoTriggerDefinition:
  given Decoder[ChronoTriggerDefinition] = deriveDecoder[ChronoTriggerDefinition]

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
