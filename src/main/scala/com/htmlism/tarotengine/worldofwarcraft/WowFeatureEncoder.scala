package com.htmlism.tarotengine.worldofwarcraft

import com.htmlism.tarotengine.learning.FeatureEncoder
import com.htmlism.tarotengine.learning.FeatureVector

final class WowFeatureEncoder private (catalog: List[ClassTalentSpecs], races: List[RaceDefinition])
    extends FeatureEncoder[AltJournalEntry]:
  private val startingAreas = races.map(row => row.race -> row.startingArea).toMap

  private val classes =
    catalog.map(row => row.className -> row).toMap

  private val flagNames = catalog
    .flatMap(row => row.features.keys ++ row.specs.flatMap(_.features.keys))
    .distinct
    .sorted
    .toVector

  val features: Vector[BuildFeature] =
    Faction.values.toVector.map(BuildFeature.FactionIs.apply) ++
      Race.values.toVector.map(BuildFeature.RaceIs.apply) ++
      startingAreas.values.toVector.distinct.sorted.map(BuildFeature.StartingAreaIs.apply) ++
      CharacterClass.values.toVector.map(BuildFeature.ClassIs.apply) ++
      Profession.values.toVector.map(BuildFeature.ProfessionIs.apply) ++
      flagNames.map(BuildFeature.PrimaryFlag.apply) ++
      flagNames.map(BuildFeature.SecondaryFlag.apply)

  val featureNames: Vector[String] = features.map:
    case BuildFeature.FactionIs(faction)       => s"faction.$faction"
    case BuildFeature.RaceIs(race)             => s"race.${race.yamlName}"
    case BuildFeature.StartingAreaIs(name)     => s"startingArea.$name"
    case BuildFeature.ClassIs(className)       => s"class.$className"
    case BuildFeature.ProfessionIs(profession) => s"profession.$profession"
    case BuildFeature.PrimaryFlag(name)        => s"primary.$name"
    case BuildFeature.SecondaryFlag(name)      => s"secondary.$name"

  def encode(value: AltJournalEntry): Either[String, FeatureVector] =
    for
      definition <- classes.get(value.className).toRight(s"No catalog entry for ${value.className}")

      primary <- definition
        .specs
        .find(_.name == value.primarySpec)
        .toRight(s"${value.primarySpec.yamlName} is not a spec of ${value.className}")

      secondary <- definition
        .specs
        .find(_.name == value.secondarySpec)
        .toRight(s"${value.secondarySpec.yamlName} is not a spec of ${value.className}")

      _ <- Either.cond(value.primarySpec != value.secondarySpec, (), "Primary and secondary specs must differ")

      _ <- Either.cond(value.professions.size == 2, (), "A build must have two distinct primary professions")
    yield
      val primaryFlags   = definition.features ++ primary.features
      val secondaryFlags = definition.features ++ secondary.features

      FeatureVector.fromValues(features.map:
        case BuildFeature.FactionIs(faction)       => bit(value.faction == faction)
        case BuildFeature.RaceIs(race)             => bit(value.race == race)
        case BuildFeature.StartingAreaIs(name)     => bit(startingAreas(value.race) == name)
        case BuildFeature.ClassIs(className)       => bit(value.className == className)
        case BuildFeature.ProfessionIs(profession) => bit(value.professions.contains(profession))
        case BuildFeature.PrimaryFlag(name)        => primaryFlags.getOrElse(name, 0).toDouble
        case BuildFeature.SecondaryFlag(name)      => secondaryFlags.getOrElse(name, 0).toDouble)

  private def bit(enabled: Boolean) =
    if enabled then 1.0 else 0.0

object WowFeatureEncoder:
  def fromCatalog(catalog: List[ClassTalentSpecs], races: List[RaceDefinition]): Either[String, WowFeatureEncoder] =
    if catalog.isEmpty then Left("The class/spec catalog must be nonempty")
    else if catalog.map(_.className).distinct.size != catalog.size then Left("The catalog contains duplicate classes")
    else if catalog.exists(row => row.specs.map(_.name).distinct.size != row.specs.size) then
      Left("The catalog contains duplicate specs within a class")
    else if catalog.exists(row =>
        (row.features.values ++ row.specs.flatMap(_.features.values)).exists(v => v != 0 && v != 1)
      )
    then Left("Catalog feature values must be 0 or 1")
    else if races.map(_.race).distinct.size != races.size then Left("The race catalog contains duplicate races")
    else if races.map(_.race).toSet != Race.values.toSet then
      Left("The race catalog must contain every WoW Forever race")
    else if races.exists(row => row.startingArea.trim.isEmpty) then Left("Starting areas must be nonempty")
    else Right(new WowFeatureEncoder(catalog, races))
