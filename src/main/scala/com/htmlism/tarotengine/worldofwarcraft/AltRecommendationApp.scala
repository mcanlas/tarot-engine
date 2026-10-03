package com.htmlism.tarotengine.worldofwarcraft

import java.nio.file.Path

import cats.effect.ExitCode
import cats.effect.IO
import cats.effect.IOApp
import cats.effect.std.Console

object AltRecommendationApp extends IOApp:
  def run(args: List[String]): IO[ExitCode] =
    args match
      case journalPathArg :: Nil =>
        (for
          journalPath <- parseJournalPath(journalPathArg)

          combinations <- WowDataLoader.loadRaceClassCombinations

          classes <- WowDataLoader.loadClassTalentSpecs

          journal <- WowDataLoader
            .loadJournal(journalPath)

          _ <- IO.println(
            s"Loaded ${combinations.size} race/class combinations, ${classes.size} classes, " +
              s"${classes.map(_.specs.size).sum} specs, and ${journal.size} journal entries."
          )
        yield ExitCode.Success).handleErrorWith: error =>
          Console[IO]
            .errorln(error.getMessage)
            .as(ExitCode.Error)

      case _ =>
        Console[IO]
          .errorln("Usage: AltRecommendationApp <alt-journal.yaml>")
          .as(ExitCode.Error)

  /** suspends path parsing and captures invalid paths as effect failures */
  private def parseJournalPath(value: String) =
    IO(Path.of(value))
