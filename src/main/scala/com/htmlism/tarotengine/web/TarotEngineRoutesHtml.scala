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
  private case class LandingTile(
      kicker: String,
      emoji: String,
      title: String,
      description: String,
      theme: String,
      href: String
  )

  private case class GameSeries(
      slug: String,
      name: String,
      emoji: String,
      platform: String,
      releaseYear: String,
      theme: String,
      apps: List[LandingTile]
  )

  private val gameSeries = List(
    GameSeries(
      "final-fantasy-vi",
      "Final Fantasy VI",
      "🎭",
      "SNES",
      "1994",
      "tile-ffvi",
      List(
        LandingTile(
          "Final Fantasy VI",
          "👥",
          "Character Roster",
          "All 14 playable characters",
          "tile-ffvi",
          "/final-fantasy-vi"
        )
      )
    ),
    GameSeries(
      "chrono-trigger",
      "Chrono Trigger",
      "⏳",
      "SNES",
      "1995",
      "tile-chrono",
      List(
        LandingTile(
          "Chrono Trigger",
          "🌀",
          "Quest Randomizer",
          "Random parties and side quests",
          "tile-chrono",
          "/chrono-trigger"
        )
      )
    ),
    GameSeries("final-fantasy-v", "Final Fantasy V", "💎", "SNES", "1992", "tile-slot-lime", List.empty),
    GameSeries(
      "final-fantasy",
      "Final Fantasy",
      "⚔️",
      "NES",
      "1987",
      "tile-ff",
      List(
        LandingTile(
          "Final Fantasy",
          "🛡️",
          "Party Generator",
          "Generate all party combinations",
          "tile-ff",
          "/final-fantasy"
        ),
        LandingTile(
          "Final Fantasy",
          "🔮",
          "Dynamic Strategy",
          "Party-specific advice",
          "tile-strategy",
          "/final-fantasy/dynamic-strategy"
        )
      )
    ),
    GameSeries(
      "final-fantasy-tactics",
      "Final Fantasy Tactics",
      "♟️",
      "PlayStation",
      "1997",
      "tile-strategy",
      List.empty
    ),
    GameSeries(
      "final-fantasy-tactics-advance",
      "Final Fantasy Tactics Advance",
      "🛡️",
      "Game Boy Advance",
      "2003",
      "tile-slot-coral",
      List.empty
    ),
    GameSeries(
      "final-fantasy-tactics-a2",
      "Final Fantasy Tactics A2",
      "📜",
      "Nintendo DS",
      "2007",
      "tile-slot-copper",
      List.empty
    )
  )

  private def commonHead(pageTitle: String, stylesheet: Option[String]) =
    head(
      tag("title")(pageTitle),
      meta(name := "viewport", content := "width=device-width, initial-scale=1"),
      stylesheet.map(path => link(rel := "stylesheet", href := path))
    )

  private def linkedTile(tile: LandingTile): Text.TypedTag[String] =
    a(cls := s"app-tile ${tile.theme}", href := tile.href)(
      span(cls := "tile-kicker")(tile.kicker),
      span(cls := "tile-emoji", attr("aria-hidden") := "true")(tile.emoji),
      span(cls := "tile-copy")(
        span(cls := "tile-title")(tile.title),
        span(cls := "tile-description")(tile.description)
      ),
      span(cls := "tile-arrow", attr("aria-hidden") := "true")("→")
    )

  private def landingPage(
      pageTitle: String,
      heading: Frag,
      backLink: Option[Text.TypedTag[String]],
      tiles: Seq[Frag]
  ): Text.TypedTag[String] =
    html(
      commonHead(pageTitle, Some("/tarot-engine.css")),
      body(cls := "landing-page")(
        div(cls := "aurora aurora-one", attr("aria-hidden") := "true"),
        div(cls := "aurora aurora-two", attr("aria-hidden") := "true"),
        header(cls := "hero")(
          backLink,
          h1(heading)
        ),
        tag("main")(cls := "app-grid")(tiles)
      )
    )

  val index: Text.TypedTag[String] =
    val tiles = gameSeries.map: series =>
      linkedTile(
        LandingTile(
          series.platform,
          series.emoji,
          series.name,
          series.releaseYear,
          s"series-tile ${series.theme}",
          s"/series/${series.slug}"
        )
      )

    landingPage(
      "Tarot Engine",
      frag(span(attr("aria-hidden") := "true")("✦"), " Tarot Engine"),
      None,
      tiles
    )

  def series(slug: String): Option[Text.TypedTag[String]] =
    gameSeries
      .find(_.slug == slug)
      .map: selectedSeries =>
        val tiles =
          if selectedSeries.apps.nonEmpty then selectedSeries.apps.map(linkedTile)
          else
            List(
              tag("article")(cls := s"app-tile tile-placeholder ${selectedSeries.theme}")(
                span(cls := "tile-kicker")(selectedSeries.name),
                span(cls := "tile-emoji", attr("aria-hidden") := "true")("❔"),
                span(cls := "tile-copy")(
                  span(cls := "tile-title")("Unknown"),
                  span(cls := "tile-description")("Come back later!")
                )
              )
            )

        landingPage(
          s"${selectedSeries.name} · Tarot Engine",
          frag(span(attr("aria-hidden") := "true")(selectedSeries.emoji), s" ${selectedSeries.name}"),
          Some(a(cls := "back-link", href := "/")("← All games")),
          tiles
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
    val designation =
      TripleTechDesignation.forParty(selectedParty, secretTripleTechs)

    assert(designation.isEmpty || selectedParty.size == 3, "Triple tech badge requires a three-member party")

    designation match
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
      commonHead("Chrono Trigger", Some("/chrono-trigger.css")),
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
