package com.htmlism.tarotengine.chronotrigger

import scala.util.Random

import cats.data.NonEmptyList
import weaver.*

object ChronoTriggerQuestDataSpec extends FunSuite:
  private def chapter(title: String, changes: RosterChange*): Chapter =
    Chapter(
      title,
      bosses            = None,
      partyRestrictions = None,
      sideQuests        = None,
      rosterChanges     = NonEmptyList.fromList(changes.toList)
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

    val result = ChronoTriggerQuestData.simulate(chapters).runA(Random(123)).value

    expect(result.chapterStates.forall(_.selectedParty.size <= 3)) &&
    expect:
      result
        .chapterStates
        .forall: chapterState =>
          chapterState.roster.pinned.forall(chapterState.selectedParty.contains)
