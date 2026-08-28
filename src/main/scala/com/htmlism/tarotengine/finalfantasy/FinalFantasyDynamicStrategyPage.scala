package com.htmlism.tarotengine.finalfantasy

import scalatags.Text
import scalatags.Text.all.*

object FinalFantasyDynamicStrategyPage:
  val html: Text.TypedTag[String] =
    tag("html")(
      head(
        tag("title")("Final Fantasy Dynamic Strategy"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1")
      ),
      body(
        tag("main")(
          h1("Final Fantasy Dynamic Strategy"),
          p(attr("data-strategy-status") := "")("Waiting for TypeScript…")
        ),
        script(tpe := "module", src := "/final-fantasy-strategy-app.js")
      )
    )
