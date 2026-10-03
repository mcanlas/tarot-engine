package com.htmlism.tarotengine.learning

trait Kernel:
  /** covariance between vectors encoded under the same layout */
  def covariance(left: FeatureVector, right: FeatureVector): Double
