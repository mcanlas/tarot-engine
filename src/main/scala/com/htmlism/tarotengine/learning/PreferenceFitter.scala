package com.htmlism.tarotengine.learning

trait PreferenceFitter:
  def fit[A: FeatureEncoder](
      comparisons: List[Comparison[A]],
      kernel: Kernel
  ): Either[String, PreferenceModel[A]]
