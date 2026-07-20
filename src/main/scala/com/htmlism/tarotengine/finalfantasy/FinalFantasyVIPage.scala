package com.htmlism.tarotengine.finalfantasy

import scalatags.Text
import scalatags.Text.all.*

object FinalFantasyVIPage:
  private val characters =
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

  private def characterTheme(character: String): String =
    character.toLowerCase

  private def characterPill(character: String): Text.TypedTag[String] =
    span(cls := s"character-pill character-${characterTheme(character)}")(character)

  val html: Text.TypedTag[String] =
    tag("html")(
      head(
        tag("title")("Final Fantasy VI"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        link(rel  := "stylesheet", href  := "/final-fantasy-vi.css")
      ),
      body(
        h1("Final Fantasy VI"),
        p(cls := "roster-intro")("The 14 playable characters"),
        tag("main")(
          div(cls := "character-grid")(
            characters.map: character =>
              div(cls := "character-card")(characterPill(character))
          )
        )
      )
    )
