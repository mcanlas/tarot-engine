package com.htmlism.tarotengine.learning

trait Kernel:
  /**
    * covariance between vectors encoded under the same layout
    */
  def covariance(left: FeatureVector, right: FeatureVector): Double

object Kernel:
  def compare[A: FeatureEncoder](left: A, right: A, kernel: Kernel): Either[String, Double] =
    val encoder = FeatureEncoder[A]

    for
      leftFeatures <- encoder.encode(left)

      rightFeatures <- encoder.encode(right)

      _ <- Either.cond(
        leftFeatures.values.size == encoder.featureNames.size &&
          rightFeatures.values.size == encoder.featureNames.size,
        (),
        "Encoded vectors must match the encoder's feature layout"
      )
    yield kernel.covariance(leftFeatures, rightFeatures)
