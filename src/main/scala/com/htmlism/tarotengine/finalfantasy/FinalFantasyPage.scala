package com.htmlism.tarotengine.finalfantasy

import scalatags.Text
import scalatags.Text.all.*

object FinalFantasyPage:
  val html: Text.TypedTag[String] =
    tag("html")(
      head(
        tag("title")("Final Fantasy"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        link(rel  := "stylesheet", href  := "/final-fantasy.css")
      ),
      body(
        h1("Final Fantasy"),
        p("A plain JavaScript landing page."),
        tag("section")(
          h2("Job Classes"),
          div(cls := "job-list")(
            span(cls := "job-pill job-warrior")("Warrior"),
            span(cls := "job-pill job-thief")("Thief"),
            span(cls := "job-pill job-black-belt")("Black Belt"),
            span(cls := "job-pill job-red-mage")("Red Mage"),
            span(cls := "job-pill job-white-mage")("White Mage"),
            span(cls := "job-pill job-black-mage")("Black Mage")
          )
        ),
        p(
          "Selected game: ",
          strong(id := "selected-game")("Final Fantasy I")
        ),
        button(id := "next-game", tpe := "button")("Next game"),
        script(tpe := "module", src := "/final-fantasy-app.js")
      )
    )
