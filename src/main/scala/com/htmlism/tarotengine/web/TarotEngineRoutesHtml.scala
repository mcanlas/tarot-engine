package com.htmlism.tarotengine.web

import scalatags.Text
import scalatags.Text.all.*

import com.htmlism.tarotengine.chronotrigger.ChapterState
import com.htmlism.tarotengine.chronotrigger.ChronoTriggerQuestData

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

  private def displayList(xs: List[String]): String =
    xs.mkString("[", ", ", "]")

  private def chronoTriggerChapter(chapterState: ChapterState): Text.TypedTag[String] =
    tag("section")(
      h2(chapterState.chapter.title),
      p(s"pinned=${displayList(chapterState.roster.pinned)}"),
      p(s"available=${displayList(chapterState.roster.available)}"),
      p(s"selected party=${displayList(chapterState.selectedParty)}")
    )

  def chronoTrigger(questData: ChronoTriggerQuestData): Text.TypedTag[String] =
    html(
      head(
        meta(charset := "UTF-8"),
        tag("title")("Chrono Trigger")
      ),
      body(
        h1("Chrono Trigger"),
        p(s"Loaded ${questData.chapterStates.size} chapters"),
        tag("main")(
          questData.chapterStates.map(chronoTriggerChapter)
        )
      )
    )
