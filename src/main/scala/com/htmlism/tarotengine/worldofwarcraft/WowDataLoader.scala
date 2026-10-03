package com.htmlism.tarotengine.worldofwarcraft

import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import cats.effect.IO
import cats.effect.Resource
import io.circe.Decoder
import io.circe.yaml.parser

object WowDataLoader:
  def loadRaceClassCombinations: IO[List[RaceClassCombination]] =
    loadResource[List[RaceClassCombination]]("world-of-warcraft-forever/class-race-combinations.yaml")

  def loadClassTalentSpecs: IO[List[ClassTalentSpecs]] =
    loadResource[List[ClassTalentSpecs]]("world-of-warcraft-forever/talent-specs.yaml")

  def loadJournal(path: Path): IO[List[AltJournalEntry]] =
    decodeYaml[List[AltJournalEntry]](IO.blocking(Files.readString(path, StandardCharsets.UTF_8)), path.toString)

  private def loadResource[A: Decoder](name: String) =
    val contents = Resource
      .fromAutoCloseable(
        IO.blocking(Option(getClass.getResourceAsStream(s"/$name")))
          .flatMap(stream => IO.fromOption(stream)(new IOException(s"Missing classpath resource: $name")))
      )
      .use(stream => IO.blocking(new String(stream.readAllBytes(), StandardCharsets.UTF_8)))

    decodeYaml[A](contents, s"classpath:$name")

  private def decodeYaml[A: Decoder](contents: IO[String], source: String) =
    (for
      yaml <- contents

      value <- IO.fromEither(parser.parse(yaml).flatMap(_.as[A]))
    yield value)
      .handleErrorWith: error =>
        IO.raiseError(new IOException(s"Could not load $source: ${error.getMessage}", error))
