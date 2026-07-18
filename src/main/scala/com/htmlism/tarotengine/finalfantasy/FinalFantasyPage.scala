package com.htmlism.tarotengine.finalfantasy

import scalatags.Text
import scalatags.Text.all.*

object FinalFantasyPage:
  val html: Text.TypedTag[String] =
    tag("html")(
      head(
        tag("title")("Final Fantasy"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1")
      ),
      body(
        h1("Final Fantasy"),
        p("A plain JavaScript landing page."),
        p(
          "Selected game: ",
          strong(id := "selected-game")("Final Fantasy I")
        ),
        button(id := "next-game", tpe := "button")("Next game"),
        script(tpe := "module", src := "/final-fantasy-app.js")
      )
    )
