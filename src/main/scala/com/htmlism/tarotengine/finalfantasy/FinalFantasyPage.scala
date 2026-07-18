package com.htmlism.tarotengine.finalfantasy

import scalatags.Text
import scalatags.Text.all.*

object FinalFantasyPage:
  private val jobs =
    List("Warrior", "Thief", "Black Belt", "Red Mage", "White Mage", "Black Mage")

  private def hasFilter(filterId: String) =
    select(id := filterId, name := "has-job")(
      option(value := "")("--"),
      jobs
        .zipWithIndex
        .map: (job, index) =>
          option(value := index.toString)(job)
    )

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
          div(cls := "control-group")(
            label(cls := "control-label", attr("for") := "party-size")("Party size"),
            select(id := "party-size", name := "party-size")(
              option(value := "4")("4"),
              option(value := "3")("3"),
              option(value := "2")("2"),
              option(value := "1")("1")
            )
          ),
          div(cls := "control-group")(
            span(id := "has-label", cls := "control-label")("Has"),
            div(
              cls                     := "control-stack",
              attr("role")            := "group",
              attr("aria-labelledby") := "has-label"
            )(
              hasFilter("has-job-1"),
              hasFilter("has-job-2"),
              hasFilter("has-job-3")
            )
          ),
          div(cls := "control-group")(
            span(id := "party-style-label", cls := "control-label")("Party style"),
            div(
              cls                     := "control-stack",
              attr("role")            := "radiogroup",
              attr("aria-labelledby") := "party-style-label"
            )(
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
