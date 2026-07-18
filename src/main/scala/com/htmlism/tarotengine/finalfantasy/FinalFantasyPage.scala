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
        p(id := "party-count", attr("aria-live") := "polite")("Generating parties..."),
        form(id := "party-controls", cls := "party-controls")(
          label(attr("for") := "party-size")("Party size"),
          select(id := "party-size", name := "party-size")(
            option(value := "4")("4"),
            option(value := "3")("3"),
            option(value := "2")("2"),
            option(value := "1")("1")
          ),
          fieldset(cls := "party-style-options")(
            legend("Party style"),
            label(cls := "radio-option")(
              input(
                tpe             := "radio",
                name            := "party-style",
                value           := "unique-parties",
                attr("checked") := "checked"
              ),
              "Unique Parties"
            ),
            label(cls := "radio-option")(
              input(tpe := "radio", name := "party-style", value := "all-formations"),
              "All Formations"
            )
          )
        ),
        tag("main")(
          table(cls := "party-table")(
            tbody(id := "party-combinations")
          )
        ),
        script(tpe := "module", src := "/final-fantasy-app.js")
      )
    )
