package com.htmlism.tarotengine.finalfantasy

import scalatags.Text
import scalatags.Text.all.*

object FinalFantasyDynamicStrategyPage:
  val html: Text.TypedTag[String] =
    tag("html")(
      head(
        tag("title")("Final Fantasy Party Strategy"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        link(rel  := "stylesheet", href  := "/final-fantasy-strategy.css")
      ),
      body(cls := "strategy-page")(
        div(cls := "strategy-glow strategy-glow-one", attr("aria-hidden") := "true"),
        div(cls := "strategy-glow strategy-glow-two", attr("aria-hidden") := "true"),
        tag("main")(cls := "strategy-shell")(
          header(cls := "strategy-hero")(
            div(cls := "strategy-eyebrow")(
              span(cls := "eyebrow-mark", attr("aria-hidden") := "true")("✦"),
              "Final Fantasy I"
            ),
            h1("Party strategy, built around your lineup"),
            p(cls := "strategy-intro")(
              "Choose four classes to see the party's strengths and tradeoffs, then select a boss for a tailored fight plan."
            ),
            div(cls := "catalog-badges", attr("aria-label") := "Strategy catalog")(
              span(cls := "catalog-badge")("6 classes"),
              span(cls := "catalog-badge")("20 party rules"),
              span(cls := "catalog-badge")("18 bosses"),
              span(cls := "catalog-badge")("66 boss rules")
            )
          ),
          tag("section")(cls := "party-builder", attr("aria-labelledby") := "party-builder-title")(
            div(cls := "section-heading")(
              div(
                p(cls := "section-index")("01 / Build your party"),
                h2(id := "party-builder-title")("Four slots. One shared plan.")
              ),
              p(cls := "section-note")("Starting classes · full class toolkit assumed")
            ),
            form(id := "strategy-controls", cls := "strategy-controls")(
              (1 to 4).map: slot =>
                label(cls := s"party-slot party-slot-$slot")(
                  span(cls := "slot-number")(f"$slot%02d"),
                  span(cls := "slot-label")(s"Party member $slot"),
                  select(
                    name                    := "party-member",
                    attr("data-party-slot") := slot.toString,
                    attr("aria-label")      := s"Party member $slot"
                  )
                )
            ),
            div(cls := "party-signature", attr("data-party-signature") := "", attr("aria-live") := "polite")
          ),
          tag("section")(cls := "party-analysis", attr("aria-labelledby") := "party-analysis-title")(
            div(cls := "section-heading")(
              div(
                p(cls := "section-index")("02 / Party profile"),
                h2(id := "party-analysis-title")("What this lineup does well—and where it bends")
              )
            ),
            div(cls := "analysis-grid")(
              tag("article")(cls := "analysis-panel analysis-strengths")(
                div(cls := "analysis-title-row")(
                  span(cls := "analysis-icon", attr("aria-hidden") := "true")("↑"),
                  h3("Strengths"),
                  span(cls := "count-badge", attr("data-strength-count") := "")("0")
                ),
                ul(cls := "advice-list", attr("data-party-strengths") := "")
              ),
              tag("article")(cls := "analysis-panel analysis-weaknesses")(
                div(cls := "analysis-title-row")(
                  span(cls := "analysis-icon", attr("aria-hidden") := "true")("!"),
                  h3("Tradeoffs"),
                  span(cls := "count-badge", attr("data-weakness-count") := "")("0")
                ),
                ul(cls := "advice-list", attr("data-party-weaknesses") := "")
              )
            )
          ),
          tag("section")(cls := "boss-strategy", attr("aria-labelledby") := "boss-strategy-title")(
            div(cls := "boss-heading")(
              div(
                p(cls := "section-index")("03 / Boss strategy"),
                h2(id := "boss-strategy-title")("Tune the plan for the fight")
              ),
              label(cls := "boss-picker")(
                span("Boss"),
                select(id := "boss-select", name := "boss", attr("data-boss-select") := "")
              )
            ),
            div(cls := "boss-banner")(
              div(
                p(cls := "boss-kicker")("Selected encounter"),
                h3(attr("data-boss-name") := "")("Choose a boss")
              ),
              div(cls := "boss-rule-count", attr("data-boss-rule-count") := "")
            ),
            div(cls := "boss-advice-grid", attr("data-boss-advice") := "")
          ),
          p(cls := "strategy-status", attr("data-strategy-status") := "", attr("role") := "status")(
            "Loading strategy data…"
          )
        ),
        script(tpe := "module", src := "/final-fantasy/final-fantasy-strategy-app.js")
      )
    )
