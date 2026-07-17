package com.htmlism.tarotengine.web

import scalatags.Text
import scalatags.Text.all.*

import com.htmlism.tarotengine.chronotrigger.ChapterState
import com.htmlism.tarotengine.chronotrigger.ChronoTriggerQuestData
import com.htmlism.tarotengine.chronotrigger.Roster
import com.htmlism.tarotengine.chronotrigger.SideQuestState

object TarotEngineRoutesHtml:
  private val chronoTriggerStyles =
    """
      |body {
      |  --party-column-width: 22rem;
      |  --side-quest-indent: 1rem;
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
      |.side-quest {
      |  margin-left: var(--side-quest-indent);
      |}
      |
      |.flag-list {
      |  display: flex;
      |  flex-wrap: wrap;
      |  gap: 0.5rem;
      |  padding-top: 0.5rem;
      |  margin: 0 0 1rem;
      |}
      |
      |.flag-pill {
      |  display: inline-flex;
      |  align-items: center;
      |  padding: 0.25rem 0.75rem;
      |  border: 1px solid;
      |  border-radius: 999px;
      |  font-size: 0.85rem;
      |  font-weight: 700;
      |  line-height: 1.4;
      |  letter-spacing: 0.01em;
      |  box-shadow: inset 0 1px 0 #ffffffa6, 0 1px 3px #17203326;
      |}
      |
      |.flag-active {
      |  background: linear-gradient(135deg, #475569 0%, #1e293b 52%, #020617 100%);
      |  border-color: #0f172a;
      |  color: #ffffff;
      |  box-shadow: inset 0 1px 0 #ffffff59, 0 2px 5px #0206174d;
      |}
      |
      |.flag-inactive {
      |  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #e2e8f0 100%);
      |  border-color: #cbd5e1;
      |  color: #94a3b8;
      |  box-shadow: inset 0 1px 0 #ffffff, 0 1px 3px #64748b26;
      |}
      |
      |.roster-table {
      |  border-collapse: collapse;
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
      |.roster-table td {
      |  padding-right: 1rem;
      |  vertical-align: top;
      |}
      |
      |.roster-table th:first-child,
      |.roster-table td:first-child {
      |  width: var(--party-column-width);
      |}
      |
      |.side-quest .roster-table th:first-child,
      |.side-quest .roster-table td:first-child {
      |  width: calc(var(--party-column-width) - var(--side-quest-indent));
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

  private def partyProgression(roster: Roster, selectedParty: List[String]): Text.TypedTag[String] =
    val pinned   = roster.pinned
    val selected = selectedParty.filterNot(pinned.contains)

    if pinned.isEmpty then
      div(cls := "party-line")(
        characterList(selectedParty)
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

  private def partyTable(roster: Roster, selectedParty: List[String]): Text.TypedTag[String] =
    val partyHeading =
      if selectedParty.size > roster.pinned.size then "Selected Party"
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
            partyProgression(roster, selectedParty)
          ),
          td(cls := "available-party")(
            characterList(roster.available)
          )
        )
      )
    )

  private def sideQuest(sideQuestState: SideQuestState): Text.TypedTag[String] =
    div(cls := "side-quest")(
      h3(sideQuestState.title),
      partyTable(sideQuestState.roster, sideQuestState.selectedParty)
    )

  private def chapterFlagPills(
      chapterState: ChapterState,
      flags: Map[String, Boolean]
  ): List[Text.TypedTag[String]] =
    val relevantFlagNames =
      List(chapterState.chapter.rosterChanges, chapterState.chapter.completionChanges)
        .flatMap(_.toList)
        .flatMap(_.toList)
        .flatMap(_.when.toList.flatMap(_.values.toSortedMap.keys))
        .distinct
        .sorted

    relevantFlagNames.flatMap: name =>
      flags
        .get(name)
        .map: value =>
          val stateClass =
            if value then "flag-pill flag-active"
            else "flag-pill flag-inactive"

          span(cls := stateClass)(s"$name: $value")

  private def chronoTriggerChapter(
      chapterState: ChapterState,
      flags: Map[String, Boolean]
  ): Text.TypedTag[String] =
    val chapterFlags = chapterFlagPills(chapterState, flags)

    tag("section")(
      h2(chapterState.chapter.title),
      if chapterState.sideQuestStates.isEmpty then partyTable(chapterState.roster, chapterState.selectedParty)
      else chapterState.sideQuestStates.map(sideQuest),
      if chapterFlags.isEmpty then frag()
      else div(cls := "flag-list")(chapterFlags)
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
        div(cls := "flag-list")(
          questData
            .flags
            .toList
            .sortBy(_._1)
            .map: (name, value) =>
              val stateClass =
                if value then "flag-pill flag-active"
                else "flag-pill flag-inactive"

              span(cls := stateClass)(s"$name: $value")
        ),
        tag("main")(
          questData.chapterStates.map(chronoTriggerChapter(_, questData.flags))
        )
      )
    )
