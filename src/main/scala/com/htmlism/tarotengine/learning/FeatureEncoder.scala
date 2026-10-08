package com.htmlism.tarotengine.learning

trait FeatureEncoder[A]:
  /**
    * coordinate names in the order used by every encoded vector
    */
  def featureNames: Vector[String]

  def encode(value: A): Either[String, FeatureVector]

object FeatureEncoder:
  def apply[A](using encoder: FeatureEncoder[A]): FeatureEncoder[A] =
    encoder
