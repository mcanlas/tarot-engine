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
import com.htmlism.tarotengine.finalfantasy.FinalFantasyDynamicStrategyPage
import com.htmlism.tarotengine.finalfantasy.FinalFantasyVIPage

object TarotEngineRoutesHtmlSpec extends FunSuite:
  test("index renders assigned and unassigned tiles and loads its stylesheet"):
    val html = TarotEngineRoutesHtml.index.render

    expect(html.contains("<h1><span aria-hidden=\"true\">✦</span> Tarot Engine</h1>")) &&
    expect(html.contains("Party Generator")) &&
    expect(html.contains("Character Roster")) &&
    expect(html.contains("Quest Randomizer")) &&
    expect(html.split("Dynamic Strategy").length == 3) &&
    expect(html.split("tile-placeholder").length == 6) &&
    expect(html.split("Come back later!").length == 6) &&
    expect(html.contains("tile-slot-slate")) &&
    expect(html.contains("tile-slot-granite")) &&
    expect(html.contains("tile-slot-copper")) &&
    expect(html.split("class=\"tile-arrow\"").length == 6) &&
    expect(!html.contains("↗")) &&
    expect(html.contains("href=\"/tarot-engine.css\"")) &&
    expect(html.contains("href=\"/final-fantasy\"")) &&
    expect(html.contains("href=\"/final-fantasy-vi\"")) &&
    expect(html.contains("href=\"/chrono-trigger\"")) &&
    expect(html.contains("href=\"/final-fantasy/dynamic-strategy\"")) &&
    expect(html.contains("class=\"app-tile tile-strategy\"")) &&
    expect(html.contains("href=\"/chrono-trigger-vibe\"")) &&
    expect(html.split("app-tile ").length == 11) &&
    expect(!html.contains("src=\"/tarot-engine-app.js\""))

  test("Final Fantasy dynamic strategy mounts its TypeScript entry point"):
    val html = FinalFantasyDynamicStrategyPage.html.render

    expect(html.contains("<h1>Final Fantasy Dynamic Strategy</h1>")) &&
    expect(html.contains("data-strategy-status=\"\"")) &&
    expect(html.contains("Waiting for TypeScript…")) &&
    expect(html.contains("src=\"/final-fantasy-strategy-app.js\"")) &&
    expect(html.contains("type=\"module\""))

  test("Final Fantasy VI renders all 14 playable characters as themed pills"):
    val html       = FinalFantasyVIPage.html.render
    val characters =
      List(
        "Terra",
        "Locke",
        "Cyan",
        "Shadow",
        "Edgar",
        "Sabin",
        "Celes",
        "Strago",
        "Relm",
        "Setzer",
        "Mog",
        "Gau",
        "Gogo",
        "Umaro"
      )

    expect(characters.forall(html.contains)) &&
    expect(html.split("character-pill").length == 15) &&
    expect(html.contains("href=\"/final-fantasy-vi.css\""))

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
