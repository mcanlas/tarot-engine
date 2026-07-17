package com.htmlism.tarotengine.web

import scalatags.Text
import scalatags.Text.all.*

import com.htmlism.tarotengine.chronotrigger.ChapterState
import com.htmlism.tarotengine.chronotrigger.ChronoTriggerQuestData

object TarotEngineRoutesHtml:
  private val chronoTriggerStyles =
    """
      |body {
      |  max-width: 72rem;
      |  margin: 0 auto;
      |  padding: 2rem;
      |  font-family: system-ui, sans-serif;
      |  color: #172033;
      |}
      |
      |section {
      |  padding: 1rem 0;
      |  border-top: 1px solid #dbe3ef;
      |}
      |
      |.roster-table {
      |  width: 100%;
      |  border-collapse: collapse;
      |  table-layout: fixed;
      |}
      |
      |.roster-table th {
      |  padding: 0 1rem 0.5rem 0;
      |  color: #64748b;
      |  font-size: 0.8rem;
      |  letter-spacing: 0.08em;
      |  text-align: left;
      |  text-transform: uppercase;
      |}
      |
      |.roster-table th:first-child,
      |.roster-table td:first-child {
      |  width: 62%;
      |}
      |
      |.roster-table td {
      |  padding-right: 1rem;
      |  vertical-align: top;
      |}
      |
      |.party-line {
      |  display: flex;
      |  align-items: center;
      |  gap: 0.5rem;
      |}
      |
      |.party-chevron {
      |  color: #64748b;
      |  font-size: 1.35rem;
      |  font-weight: 800;
      |  letter-spacing: -0.15rem;
      |}
      |
      |.character-list {
      |  display: flex;
      |  flex-wrap: wrap;
      |  gap: 0.4rem;
      |}
      |
      |.character-pill {
      |  display: inline-flex;
      |  align-items: center;
      |  padding: 0.2rem 0.65rem;
      |  border: 1px solid;
      |  border-radius: 999px;
      |  font-weight: 700;
      |  line-height: 1.4;
      |  box-shadow: inset 0 1px 0 #ffffffa6, 0 1px 3px #17203326;
      |}
      |
      |.available-party .character-pill {
      |  opacity: 0.3;
      |}
      |
      |.chrono-lightning {
      |  background: linear-gradient(135deg, #fffbd1 0%, #fde047 55%, #facc15 100%);
      |  border-color: #eab308;
      |  color: #713f12;
      |}
      |.marle-ice {
      |  background: linear-gradient(135deg, #ecfeff 0%, #a5f3fc 55%, #67e8f9 100%);
      |  border-color: #22d3ee;
      |  color: #164e63;
      |}
      |.lucca-fire {
      |  background: linear-gradient(135deg, #fff1f2 0%, #fca5a5 55%, #fb7185 100%);
      |  border-color: #ef4444;
      |  color: #7f1d1d;
      |}
      |.frog-forest {
      |  background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 55%, #4ade80 100%);
      |  border-color: #4ade80;
      |  color: #14532d;
      |}
      |.robo-tech {
      |  background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%);
      |  border-color: #64748b;
      |  color: #1e293b;
      |}
      |.ayla-physical {
      |  background: linear-gradient(135deg, #fffaf0 0%, #e7d7bd 55%, #c7ae8a 100%);
      |  border-color: #9a7b55;
      |  color: #4a3522;
      |}
      |.magus-shadow {
      |  background: linear-gradient(135deg, #a855f7 0%, #6b21a8 55%, #1e1b4b 100%);
      |  border-color: #c084fc;
      |  color: #faf5ff;
      |}
      |.empty-roster { color: #64748b; font-style: italic; }
      |""".stripMargin

  val index: Text.TypedTag[String] =
    html(
      head(
        meta(charset := "UTF-8"),
        tag("title")("tarot-engine")
      ),
      body(
        ul(
          li(
            a(href := "/final-fantasy-vi")("Final Fantasy VI")
          ),
          li(
            a(href := "/chrono-trigger")("Chrono Trigger")
          )
        )
      )
    )

  private def characterTheme(character: String): String =
    character match
      case "Chrono" => "chrono-lightning"
      case "Marle"  => "marle-ice"
      case "Lucca"  => "lucca-fire"
      case "Frog"   => "frog-forest"
      case "Robo"   => "robo-tech"
      case "Ayla"   => "ayla-physical"
      case "Magus"  => "magus-shadow"

  private def characterPill(character: String): Text.TypedTag[String] =
    span(cls := s"character-pill ${characterTheme(character)}")(character)

  private def characterList(characters: List[String]): Text.TypedTag[String] =
    if characters.isEmpty then span(cls := "empty-roster")("none")
    else
      span(cls := "character-list")(
        characters.map(characterPill)
      )

  private def partyProgression(chapterState: ChapterState): Text.TypedTag[String] =
    val pinned   = chapterState.roster.pinned
    val selected = chapterState.selectedParty.filterNot(pinned.contains)

    if pinned.isEmpty then
      div(cls := "party-line")(
        characterList(chapterState.selectedParty)
      )
    else if selected.isEmpty then
      div(cls := "party-line")(
        characterList(pinned)
      )
    else
      div(cls := "party-line")(
        characterList(pinned),
        span(cls := "party-chevron", attr("aria-hidden") := "true")("››"),
        characterList(selected)
      )

  private def partyTable(chapterState: ChapterState): Text.TypedTag[String] =
    val partyHeading =
      if chapterState.selectedParty.size > chapterState.roster.pinned.size then "Selected Party"
      else "Party"

    table(cls := "roster-table")(
      thead(
        tr(
          th(partyHeading),
          th("Available")
        )
      ),
      tbody(
        tr(
          td(
            partyProgression(chapterState)
          ),
          td(cls := "available-party")(
            characterList(chapterState.roster.available)
          )
        )
      )
    )

  private def chronoTriggerChapter(chapterState: ChapterState): Text.TypedTag[String] =
    tag("section")(
      h2(chapterState.chapter.title),
      partyTable(chapterState)
    )

  def chronoTrigger(questData: ChronoTriggerQuestData): Text.TypedTag[String] =
    html(
      head(
        meta(charset := "UTF-8"),
        tag("title")("Chrono Trigger"),
        tag("style")(raw(chronoTriggerStyles))
      ),
      body(
        h1("Chrono Trigger"),
        p(s"Loaded ${questData.chapterStates.size} chapters"),
        tag("main")(
          questData.chapterStates.map(chronoTriggerChapter)
        )
      )
    )
