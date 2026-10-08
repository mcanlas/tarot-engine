package com.htmlism.tarotengine.worldofwarcraft

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import cats.effect.ExitCode
import cats.effect.IO
import cats.effect.Resource
import weaver.*

object WowDataLoaderSpec extends SimpleIOSuite:
  private def yamlFile(contents: String): Resource[IO, Path] =
    Resource
      .make(IO.blocking(Files.createTempFile("wow-journal-", ".yaml")))(path =>
        IO.blocking(Files.deleteIfExists(path)).void
      )
      .evalTap(path => IO.blocking(Files.writeString(path, contents, StandardCharsets.UTF_8)).void)

  test("load classpath catalogs with typed names, starting areas, and sparse feature maps"):
    for
      races <- WowDataLoader.loadRaces

      combinations <- WowDataLoader.loadRaceClassCombinations

      classes <- WowDataLoader.loadClassTalentSpecs
    yield expect.same(Race.values.toSet, races.map(_.race).toSet) &&
      expect.same(Race.values.length, races.size) &&
      expect.same(Some("Zephras Isle"), races.find(_.race == Race.Skyborne).map(_.startingArea)) &&
      expect.same(56, combinations.size) &&
      expect.same(CharacterClass.values.toSet, classes.map(_.className).toSet) &&
      expect.same(27, classes.flatMap(_.specs).size) &&
      expect(classes.flatMap(_.specs).exists(_.features.isEmpty)) &&
      expect(combinations.exists(_.faction.contains(Faction.Horde)))

  test("load a journal file using the renamed spec keys"):
    val yaml = """- faction: Alliance
                 |  race: Human
                 |  class: Warlock
                 |  primarySpec: Affliction
                 |  secondarySpec: Demonology
                 |  professions: [Tailoring, Engineering]
                 |  checkpoints: []
                 |""".stripMargin

    yamlFile(yaml).use: path =>
      WowDataLoader
        .loadJournal(path)
        .map: journal =>
          expect.same(
            List(
              AltJournalEntry(
                Faction.Alliance,
                Race.Human,
                CharacterClass.Warlock,
                Spec.Affliction,
                Spec.Demonology,
                Set(Profession.Tailoring, Profession.Engineering),
                Nil
              )
            ),
            journal
          )

  test("decoding failures identify the input path and preserve their cause"):
    yamlFile("- faction: Unknown").use: path =>
      WowDataLoader
        .loadJournal(path)
        .attempt
        .map:
          case Left(error) => expect(error.getMessage.contains(path.toString)) && expect(error.getCause != null)
          case Right(_)    => failure("Invalid journal unexpectedly loaded")

  test("missing files fail with the requested path"):
    yamlFile("[]").use: path =>
      val missingPath = path.resolveSibling(path.getFileName.toString + ".missing")

      WowDataLoader
        .loadJournal(missingPath)
        .attempt
        .map:
          case Left(error) => expect(error.getMessage.contains(missingPath.toString))
          case Right(_)    => failure("Missing journal unexpectedly loaded")

  test("the app rejects missing and extra journal arguments"):
    for
      missing <- AltRecommendationApp.run(Nil)

      extra <- AltRecommendationApp.run(List("one.yaml", "two.yaml"))
    yield expect.same(ExitCode.Error, missing) && expect.same(ExitCode.Error, extra)

  test("the app returns an error exit code when a journal cannot be decoded"):
    yamlFile("not a journal array").use: path =>
      AltRecommendationApp
        .run(List(path.toString))
        .map: exitCode =>
          expect.same(ExitCode.Error, exitCode)

  test("invalid path parsing is suspended and handled as an IO failure"):
    val result = AltRecommendationApp.run(List("invalid\u0000path"))

    result.map(exitCode => expect.same(ExitCode.Error, exitCode))
