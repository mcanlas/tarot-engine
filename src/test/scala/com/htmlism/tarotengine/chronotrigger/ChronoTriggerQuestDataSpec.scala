package com.htmlism.tarotengine.chronotrigger

import scala.util.Random

import cats.data.NonEmptyList
import cats.data.NonEmptyMap
import weaver.*

object ChronoTriggerQuestDataSpec extends FunSuite:
  private def when(flag: String, value: Boolean): Option[FlagCondition] =
    Some(FlagCondition(NonEmptyMap.one(flag, value)))

  private def definition(chapters: Chapter*): ChronoTriggerDefinition =
    ChronoTriggerDefinition(List.empty, chapters.toList, List.empty)

  private def chapter(title: String, changes: RosterChange*): Chapter =
    Chapter(
      title,
      bosses            = None,
      partyRestrictions = None,
      sideQuests        = None,
      rosterChanges     = NonEmptyList.fromList(changes.toList),
      completionChanges = None
    )

  test("simulate selects at most three party members and always includes pinned members"):
    val chapters = List(
      chapter(
        "The Millennial Fair",
        RosterChange.Pin("Crono"),
        RosterChange.Add("Marle"),
        RosterChange.Add("Lucca"),
        RosterChange.Add("Frog"),
        RosterChange.Add("Robo")
      ),
      chapter("The Queen Returns")
    )

    val result = ChronoTriggerQuestData.simulate(definition(chapters*)).runA(Random(123)).value

    forEach(result.chapterStates): chapterState =>
      expect(chapterState.selectedParty.size <= 3) &&
        forEach(chapterState.roster.pinned): char =>
          exists(chapterState.selectedParty): selected =>
            expect.same(char, selected)

  test("simulate shuffles side quests and selects a party for each one"):
    val sideQuests = NonEmptyList.of(
      SideQuest("The Sunstone", None),
      SideQuest("The End of Ozzie", Some("Robo")),
      SideQuest("Robo's Origins", None)
    )
    val chapters = List(
      chapter(
        "The Millennial Fair",
        RosterChange.Pin("Crono"),
        RosterChange.Add("Marle"),
        RosterChange.Add("Lucca"),
        RosterChange.Add("Frog"),
        RosterChange.Add("Robo")
      ),
      Chapter(
        "The Fated Hour",
        bosses            = None,
        partyRestrictions = None,
        sideQuests        = Some(sideQuests),
        rosterChanges     = None,
        completionChanges = None
      )
    )

    val result          = ChronoTriggerQuestData.simulate(definition(chapters*)).runA(Random(123)).value
    val sideQuestStates = result.chapterStates.flatMap(_.sideQuestStates)
    val otherSideQuests = sideQuestStates.filterNot(_.title == "The End of Ozzie")
    val validParties    = forEach(sideQuestStates): sideQuestState =>
      expect(sideQuestState.selectedParty.size <= 3) &&
        exists(sideQuestState.selectedParty): selected =>
          expect.same("Crono", selected)
    val roboRequired = exists(sideQuestStates): sideQuestState =>
      val roboPinned = exists(sideQuestState.roster.pinned): pinned =>
        expect.same("Robo", pinned)
      val roboSelected = exists(sideQuestState.selectedParty): selected =>
        expect.same("Robo", selected)

      expect.same("The End of Ozzie", sideQuestState.title) && roboPinned && roboSelected
    val roboNotRequiredElsewhere = forEach(otherSideQuests): sideQuestState =>
      forEach(sideQuestState.roster.pinned): pinned =>
        expect(pinned != "Robo")

    expect.same(sideQuests.toList.map(_.title).sorted, sideQuestStates.map(_.title).sorted) &&
    expect(sideQuests.toList.map(_.title) != sideQuestStates.map(_.title)) &&
    validParties &&
    roboRequired &&
    roboNotRequiredElsewhere

  test("simulate applies chapter completion changes whose flag conditions match"):
    val chapters = List(
      chapter("The Millennial Fair", RosterChange.Pin("Chrono")),
      Chapter(
        "The New King",
        bosses            = None,
        partyRestrictions = None,
        sideQuests        = None,
        rosterChanges     = Some(NonEmptyList.one(RosterChange.Remove("Chrono"))),
        completionChanges = Some(
          NonEmptyList.one(RosterChange.Add("Magus", when("fight-magus", false)))
        )
      ),
      Chapter(
        "The Time Egg",
        bosses            = None,
        partyRestrictions = None,
        sideQuests        = None,
        rosterChanges     = None,
        completionChanges = Some(
          NonEmptyList.one(RosterChange.Add("Chrono", when("save-chrono", true)))
        )
      ),
      chapter("The Fated Hour")
    )
    val flags  = Map("fight-magus" -> false, "save-chrono" -> true)
    val result = ChronoTriggerQuestData.simulate(definition(chapters*), flags).runA(Random(123)).value

    expect.same(flags, result.flags) &&
    expect.same(List.empty, result.chapterStates(1).roster.available) &&
    expect.same(List("Magus"), result.chapterStates(1).rosterAfterCompletion.available) &&
    expect.same(List("Magus"), result.chapterStates(2).roster.available) &&
    expect.same(List("Magus", "Chrono"), result.chapterStates(2).rosterAfterCompletion.available) &&
    expect.same(List("Magus", "Chrono"), result.chapterStates(3).roster.available)

  test("simulate skips chapter completion changes whose flag conditions do not match"):
    val chapters = List(
      Chapter(
        "The New King",
        bosses            = None,
        partyRestrictions = None,
        sideQuests        = None,
        rosterChanges     = None,
        completionChanges = Some(
          NonEmptyList.one(RosterChange.Add("Magus", when("fight-magus", false)))
        )
      ),
      Chapter(
        "The Time Egg",
        bosses            = None,
        partyRestrictions = None,
        sideQuests        = None,
        rosterChanges     = None,
        completionChanges = Some(
          NonEmptyList.one(RosterChange.Add("Chrono", when("save-chrono", true)))
        )
      )
    )
    val flags  = Map("fight-magus" -> true, "save-chrono" -> false)
    val result = ChronoTriggerQuestData.simulate(definition(chapters*), flags).runA(Random(123)).value

    forEach(result.chapterStates): chapterState =>
      expect(chapterState.roster.available.isEmpty)

  test("a matching secret party receives its rock designation regardless of order"):
    val tech = SecretTripleTech("Omega Flare", ("Lucca", "Robo", "Magus"), "Blue")

    expect.same(
      Some(TripleTechDesignation.Secret(tech)),
      TripleTechDesignation.forParty(List("Magus", "Lucca", "Robo"), List(tech))
    )

  test("a party with Chrono and without Magus receives the base triple tech designation"):
    val designation = TripleTechDesignation.forParty(
      List("Chrono", "Marle", "Lucca"),
      List.empty
    )

    expect.same(Some(TripleTechDesignation.Base), designation)

  test("a non-secret party containing both Chrono and Magus has no triple tech"):
    val designation = TripleTechDesignation.forParty(
      List("Chrono", "Magus", "Marle"),
      List.empty
    )

    expect.same(None, designation)
