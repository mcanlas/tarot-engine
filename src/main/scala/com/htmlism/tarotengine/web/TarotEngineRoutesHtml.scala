package com.htmlism.tarotengine.web

import scalatags.Text
import scalatags.Text.all.*

import com.htmlism.tarotengine.chronotrigger.ChapterState
import com.htmlism.tarotengine.chronotrigger.ChronoTriggerQuestData
import com.htmlism.tarotengine.chronotrigger.Roster
import com.htmlism.tarotengine.chronotrigger.SecretTripleTech
import com.htmlism.tarotengine.chronotrigger.SideQuestState
import com.htmlism.tarotengine.chronotrigger.TripleTechDesignation

object TarotEngineRoutesHtml:
  private def commonHead(pageTitle: String) =
    head(
      tag("title")(pageTitle),
      meta(name := "viewport", content := "width=device-width, initial-scale=1"),
      link(rel  := "stylesheet", href  := "/app.css")
    )

  val index: Text.TypedTag[String] =
    html(
      commonHead("tarot-engine"),
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

  private def rockTheme(color: String): String =
    color match
      case "Black"  => "rock-black"
      case "Gold"   => "rock-gold"
      case "Blue"   => "rock-blue"
      case "White"  => "rock-white"
      case "Silver" => "rock-silver"

  private def secretTripleTechRock(tech: SecretTripleTech): Text.TypedTag[String] =
    span(
      cls           := s"triple-tech-designation rock-designation ${rockTheme(tech.rockColor)}",
      attr("title") := tech.name
    )(
      span(cls := "rock-facet", attr("aria-hidden") := "true")("◆"),
      span(cls := "rock-name")(s"${tech.rockColor} Rock")
    )

  private def tripleTechDesignation(
      selectedParty: List[String],
      secretTripleTechs: List[SecretTripleTech]
  ): Option[Text.TypedTag[String]] =
    TripleTechDesignation.forParty(selectedParty, secretTripleTechs) match
      case None =>
        None

      case Some(TripleTechDesignation.Base) =>
        Some(
          span(cls := "triple-tech-designation triple-tech-base")(
            span(cls := "triple-tech-sigil", attr("aria-hidden") := "true")("✦✦✦"),
            "Triple Tech"
          )
        )

      case Some(TripleTechDesignation.Secret(tech)) =>
        Some(secretTripleTechRock(tech))

  private def statusLine(
      designation: Option[Text.TypedTag[String]],
      flagPills: List[Text.TypedTag[String]]
  ): Frag =
    val contents = designation.toList ++ flagPills

    if contents.isEmpty then frag()
    else div(cls := "flag-list")(contents)

  private def partyProgression(
      roster: Roster,
      selectedParty: List[String]
  ): Text.TypedTag[String] =
    val pinned       = roster.pinned
    val selected     = selectedParty.filterNot(pinned.contains)
    val partyMembers =
      if pinned.isEmpty then characterList(selectedParty)
      else if selected.isEmpty then characterList(pinned)
      else
        frag(
          characterList(pinned),
          span(cls := "party-chevron", attr("aria-hidden") := "true")("››"),
          characterList(selected)
        )

    div(cls := "party-line")(partyMembers)

  private def partyTable(
      roster: Roster,
      selectedParty: List[String]
  ): Text.TypedTag[String] =
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

  private def sideQuest(
      sideQuestState: SideQuestState,
      secretTripleTechs: List[SecretTripleTech]
  ): Text.TypedTag[String] =
    val designation = tripleTechDesignation(sideQuestState.selectedParty, secretTripleTechs)

    div(cls := "side-quest")(
      h3(sideQuestState.title),
      partyTable(sideQuestState.roster, sideQuestState.selectedParty),
      statusLine(designation, List.empty)
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
      flags: Map[String, Boolean],
      secretTripleTechs: List[SecretTripleTech]
  ): Text.TypedTag[String] =
    val chapterFlags   = chapterFlagPills(chapterState, flags)
    val chapterContent =
      if chapterState.sideQuestStates.isEmpty then
        frag(
          partyTable(chapterState.roster, chapterState.selectedParty),
          statusLine(
            tripleTechDesignation(chapterState.selectedParty, secretTripleTechs),
            chapterFlags
          )
        )
      else
        frag(
          chapterState.sideQuestStates.map(sideQuest(_, secretTripleTechs)),
          statusLine(None, chapterFlags)
        )

    tag("section")(
      h2(chapterState.chapter.title),
      chapterContent
    )

  private def secretTripleTechReference(
      secretTripleTechs: List[SecretTripleTech]
  ): Text.TypedTag[String] =
    tag("section")(
      cls := "secret-triple-tech-reference",
      h2("Secret Triple Techs"),
      div(cls := "secret-triple-tech-grid")(
        secretTripleTechs.map: tech =>
          div(cls := "secret-triple-tech-column")(
            secretTripleTechRock(tech),
            div(cls := "secret-triple-tech-party")(
              tech.characters.toList.map(characterPill)
            )
          )
      )
    )

  def chronoTrigger(questData: ChronoTriggerQuestData): Text.TypedTag[String] =
    html(
      commonHead("Chrono Trigger"),
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
          questData.chapterStates.map(chronoTriggerChapter(_, questData.flags, questData.secretTripleTechs)),
          secretTripleTechReference(questData.secretTripleTechs)
        )
      )
    )
