package com.htmlism.tarotengine.web

import cats.data.NonEmptyList
import cats.data.NonEmptyMap
import weaver.*

import com.htmlism.tarotengine.chronotrigger.Chapter
import com.htmlism.tarotengine.chronotrigger.ChapterState
import com.htmlism.tarotengine.chronotrigger.ChronoTriggerQuestData
import com.htmlism.tarotengine.chronotrigger.FlagCondition
import com.htmlism.tarotengine.chronotrigger.Roster
import com.htmlism.tarotengine.chronotrigger.RosterChange
import com.htmlism.tarotengine.chronotrigger.SecretTripleTech

object TarotEngineRoutesHtmlSpec extends FunSuite:
  private val chapter = Chapter(
    "Test Chapter",
    bosses            = None,
    partyRestrictions = None,
    sideQuests        = None,
    rosterChanges     = None,
    completionChanges = None
  )

  private def render(
      selectedParty: List[String],
      secretTripleTechs: List[SecretTripleTech]
  ): String =
    render(chapter, selectedParty, secretTripleTechs, Map.empty)

  private def render(
      renderedChapter: Chapter,
      selectedParty: List[String],
      secretTripleTechs: List[SecretTripleTech],
      flags: Map[String, Boolean]
  ): String =
    val roster = Roster(List.empty, List.empty)
    val state  = ChapterState(renderedChapter, roster, roster, selectedParty, List.empty)
    val data   = ChronoTriggerQuestData(flags, List(state), secretTripleTechs)

    TarotEngineRoutesHtml.chronoTrigger(data).render

  test("secret triple tech parties render a compact rock line with the tech name as hover text"):
    val tech        = SecretTripleTech("Omega Flare", ("Lucca", "Robo", "Magus"), "Blue")
    val html        = render(List("Magus", "Lucca", "Robo"), List(tech))
    val sectionHtml = html.drop(html.indexOf("<section"))

    expect(html.contains("rock-designation rock-blue")) &&
    expect(html.contains("Blue Rock")) &&
    expect(html.contains("title=\"Omega Flare\"")) &&
    expect(!html.contains("rock-tech-name")) &&
    expect(sectionHtml.indexOf("</table>") < sectionHtml.indexOf("rock-designation")) &&
    expect(html.contains("secret-triple-tech-grid")) &&
    expect(html.contains("href=\"/chrono-trigger.css\"")) &&
    expect(html.contains("secret-triple-tech-party"))

  test("base triple tech parties render a non-rock designation"):
    val html = render(List("Chrono", "Marle", "Lucca"), List.empty)

    expect(html.contains("triple-tech-base")) &&
    expect(html.contains("Triple Tech")) &&
    expect(!html.contains("class=\"triple-tech-designation rock-designation"))

  test("triple tech designation appears left of chapter boolean pills"):
    val condition       = FlagCondition(NonEmptyMap.one("save-chrono", true))
    val chapterWithFlag = chapter.copy(
      completionChanges = Some(
        NonEmptyList.one(RosterChange.Add("Chrono", Some(condition)))
      )
    )
    val html = render(
      chapterWithFlag,
      List("Chrono", "Marle", "Lucca"),
      List.empty,
      Map("save-chrono" -> true)
    )
    val sectionHtml      = html.drop(html.indexOf("<section"))
    val designationIndex = sectionHtml.indexOf("triple-tech-base")
    val flagIndex        = sectionHtml.indexOf("flag-pill flag-active")

    expect(designationIndex >= 0) &&
    expect(flagIndex > designationIndex)
