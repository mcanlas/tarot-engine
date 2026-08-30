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
  test("index renders one linked tile for each game series"):
    val html = TarotEngineRoutesHtml.index.render

    expect(html.contains("<h1><span aria-hidden=\"true\">✦</span> Tarot Engine</h1>")) &&
    expect(html.contains("Final Fantasy VI")) &&
    expect(html.contains("Chrono Trigger")) &&
    expect(html.contains("Final Fantasy V")) &&
    expect(html.contains("Final Fantasy Tactics")) &&
    expect(html.contains("Final Fantasy Tactics Advance")) &&
    expect(html.contains("Final Fantasy Tactics A2")) &&
    expect(html.split("SNES").length == 4) &&
    expect(html.contains("NES")) &&
    expect(html.contains("PlayStation")) &&
    expect(html.contains("Game Boy Advance")) &&
    expect(html.contains("Nintendo DS")) &&
    expect(html.contains("1992")) &&
    expect(html.contains("1994")) &&
    expect(html.contains("1995")) &&
    expect(html.contains("1987")) &&
    expect(html.contains("1997")) &&
    expect(html.contains("2003")) &&
    expect(html.contains("2007")) &&
    expect(!html.contains("Game series")) &&
    expect(html.split("class=\"tile-arrow\"").length == 8) &&
    expect(html.split("app-tile ").length == 8) &&
    expect(!html.contains("tile-placeholder")) &&
    expect(!html.contains("Party Generator")) &&
    expect(!html.contains("↗")) &&
    expect(html.contains("href=\"/tarot-engine.css\"")) &&
    expect(html.contains("href=\"/series/final-fantasy\"")) &&
    expect(html.contains("href=\"/series/final-fantasy-vi\"")) &&
    expect(html.contains("href=\"/series/chrono-trigger\"")) &&
    expect(!html.contains("src=\"/tarot-engine-app.js\""))

  test("series pages render app tiles and a route back to the game index"):
    val html = TarotEngineRoutesHtml.series("final-fantasy").fold("")(_.render)

    expect(html.contains("<title>Final Fantasy · Tarot Engine</title>")) &&
    expect(html.contains("href=\"/\">← All games</a>")) &&
    expect(html.contains("Party Generator")) &&
    expect(html.contains("href=\"/final-fantasy\"")) &&
    expect(html.contains("Dynamic Strategy")) &&
    expect(html.contains("href=\"/final-fantasy/dynamic-strategy\"")) &&
    expect(html.split("class=\"tile-arrow\"").length == 3) &&
    expect(!html.contains("tile-placeholder"))

  test("series pages without apps render a factual empty state"):
    val html = TarotEngineRoutesHtml.series("final-fantasy-v").fold("")(_.render)

    expect(html.contains("Final Fantasy V")) &&
    expect(html.contains("❔")) &&
    expect(html.contains("Unknown")) &&
    expect(html.contains("Come back later!")) &&
    expect(html.contains("tile-placeholder")) &&
    expect(!html.contains("class=\"tile-arrow\"")) &&
    expect(TarotEngineRoutesHtml.series("not-a-game").isEmpty)

  test("Final Fantasy dynamic strategy renders the party and boss workspace"):
    val html = FinalFantasyDynamicStrategyPage.html.render

    expect(html.contains("<h1>Party strategy, built around your lineup</h1>")) &&
    expect(html.split("data-party-slot").length == 5) &&
    expect(html.contains("data-party-strengths")) &&
    expect(html.contains("data-party-weaknesses")) &&
    expect(html.contains("data-boss-select")) &&
    expect(html.contains("href=\"/final-fantasy-strategy.css\"")) &&
    expect(html.contains("data-strategy-status=\"\"")) &&
    expect(html.contains("Loading strategy data…")) &&
    expect(html.contains("src=\"/final-fantasy/final-fantasy-strategy-app.js\"")) &&
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
