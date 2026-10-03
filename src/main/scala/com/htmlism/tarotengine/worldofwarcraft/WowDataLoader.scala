package com.htmlism.tarotengine.worldofwarcraft

import java.nio.file.Path

import cats.effect.IO

object WowDataLoader:
  def loadRaceClassCombinations(path: Path): IO[List[RaceClassCombination]] =
    IO.raiseError(new NotImplementedError(s"TODO: load race/class combinations from $path"))

  def loadClassTalentSpecs(path: Path): IO[List[ClassTalentSpecs]] =
    IO.raiseError(new NotImplementedError(s"TODO: load class talent specs from $path"))

  def loadJournal(path: Path): IO[List[AltJournalEntry]] =
    IO.raiseError(new NotImplementedError(s"TODO: load the alt journal from $path"))
