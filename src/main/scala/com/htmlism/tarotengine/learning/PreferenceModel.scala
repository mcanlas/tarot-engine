package com.htmlism.tarotengine.learning

trait PreferenceModel[A]:
  def predict(value: A): Either[String, Prediction]

  def probabilityPreferred(left: A, right: A): Either[String, Double]
