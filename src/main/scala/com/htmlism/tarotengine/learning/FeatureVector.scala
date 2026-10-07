package com.htmlism.tarotengine.learning

/** numeric coordinates under an encoder's feature layout */
opaque type FeatureVector = Vector[Double]

object FeatureVector:
  private[tarotengine] def fromValues(values: Vector[Double]): FeatureVector =
    values

  extension (features: FeatureVector) def values: Vector[Double] = features
