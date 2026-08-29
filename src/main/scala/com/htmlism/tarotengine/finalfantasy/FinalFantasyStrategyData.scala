package com.htmlism.tarotengine.finalfantasy

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import cats.effect.IO
import cats.syntax.parallel.*
import io.circe.Json
import io.circe.yaml.parser

object FinalFantasyStrategyData:
  private val files =
    List(
      "classes"       -> "final-fantasy-classes.yaml",
      "spells"        -> "final-fantasy-spells.yaml",
      "bosses"        -> "final-fantasy-bosses.yaml",
      "strategy"      -> "final-fantasy-boss-strategy.yaml",
      "partyStrategy" -> "final-fantasy-party-strategy.yaml"
    )

  private def loadFile(fileName: String): IO[Json] =
    for
      yaml <- IO.blocking(Files.readString(Path.of("data", fileName), StandardCharsets.UTF_8))
      json <- IO.fromEither(parser.parse(yaml))
    yield json

  val load: IO[Json] =
    files
      .parTraverse: (name, fileName) =>
        loadFile(fileName).map(name -> _)
      .map(values => Json.obj(values*))
