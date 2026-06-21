package com.htmlism.tarotengine.web

import scalatags.Text
import scalatags.Text.all.*

object TarotEngineRoutesHtml:
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
