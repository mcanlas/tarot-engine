package com.htmlism.tarotengine.worldofwarcraft

import cats.effect.IO
import weaver.*

import com.htmlism.tarotengine.learning.FeatureVector.*

object WowFeatureEncoderSpec extends SimpleIOSuite:
  private def build(faction: Faction, race: Race) =
    AltJournalEntry(
      faction,
      race,
      CharacterClass.Warrior,
      Spec.Arms,
      Spec.Fury,
      Set(Profession.Mining, Profession.Blacksmithing),
      Nil
    )

  test("shared starting areas reduce distance while preserving distinct race identities"):
    for
      classes <- WowDataLoader.loadClassTalentSpecs

      races <- WowDataLoader.loadRaces

      encoder <- IO.fromEither(WowFeatureEncoder.fromCatalog(classes, races).left.map(new IllegalArgumentException(_)))
    yield
      def distance(faction: Faction, left: Race, right: Race) =
        for
          a <- encoder.encode(build(faction, left))
          b <- encoder.encode(build(faction, right))
        yield a.values.zip(b.values).map { case (x, y) => (x - y) * (x - y) }.sum

      expect.same(Right(2.0), distance(Faction.Horde, Race.Orc, Race.Troll)) &&
      expect.same(Right(4.0), distance(Faction.Horde, Race.Orc, Race.Tauren)) &&
      expect.same(Right(2.0), distance(Faction.Alliance, Race.Gnome, Race.Dwarf)) &&
      expect.same(Right(4.0), distance(Faction.Alliance, Race.Gnome, Race.Human)) &&
      expect.same(
        7,
        encoder.features.count {
          case BuildFeature.StartingAreaIs(_) => true
          case _                              => false
        }
      ) &&
      expect.same(Right(encoder.featureNames.size), encoder.encode(build(Faction.Horde, Race.Troll)).map(_.values.size))

  test("race catalogs reject missing races, duplicates, and empty starting areas"):
    for
      classes <- WowDataLoader.loadClassTalentSpecs

      races <- WowDataLoader.loadRaces
    yield expect(WowFeatureEncoder.fromCatalog(classes, races.drop(1)).isLeft) &&
      expect(WowFeatureEncoder.fromCatalog(classes, races ++ races.take(1)).isLeft) &&
      expect(WowFeatureEncoder.fromCatalog(classes, races.map(_.copy(startingArea = " "))).isLeft)
