package com.htmlism.tarotengine.worldofwarcraft

import cats.effect.ExitCode
import cats.effect.IO
import cats.effect.IOApp

object AltRecommendationApp extends IOApp:
  def run(args: List[String]): IO[ExitCode] =
    // TODO: require one journal path argument, load both local catalogs and the journal, and report counts.
    IO.raiseError(new NotImplementedError(s"TODO: load WoW data with ${args.size} command-line arguments"))
