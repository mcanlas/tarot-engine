package com.htmlism.tarotengine.learning

final case class FeatureGroup(name: String, weight: Double, features: Vector[String]):
  require(name.trim.nonEmpty, "Feature groups must have names")
  require(weight.isFinite && weight >= 0.0, "Group weights must be nonnegative and finite")
  require(features.nonEmpty, "Feature groups must contain features")
  require(features.forall(_.trim.nonEmpty), "Features must have names")

final case class FeatureLayout(groups: Vector[FeatureGroup]):
  val featureNames: Vector[String] =
    groups.flatMap(_.features)

  require(groups.map(_.name).distinct.size == groups.size, "Feature group names must be unique")
  require(featureNames.distinct.size == featureNames.size, "Feature names must be unique across the layout")
