package com.htmlism.tarotengine.learning

/** Alternatives: Hamming, Jaccard, learned feature scales. */
sealed trait Distance:
  def between(left: FeatureVector, right: FeatureVector): Double

object Distance:
  val euclidean: Distance =
    WeightedEuclidean.constant(1.0)

  final class WeightedEuclidean private (weightsFor: Int => Vector[Double]) extends Distance:
    def between(left: FeatureVector, right: FeatureVector): Double =
      require(left.values.size == right.values.size, "Feature vectors must have equal dimensions")
      require(left.values.forall(_.isFinite) && right.values.forall(_.isFinite), "Feature values must be finite")

      val weights =
        weightsFor(left.values.size)

      require(weights.size == left.values.size, "Weights must match the feature dimensions")

      left
        .values
        .zip(right.values)
        .zip(weights)
        .foldLeft(0.0):
          case (distance, ((a, b), weight)) =>
            val difference =
              if weight == 0.0 then 0.0 else math.sqrt(weight) * (a - b)

            math.hypot(distance, difference)

  object WeightedEuclidean:
    def apply(weights: Vector[Double]): WeightedEuclidean =
      require(weights.forall(weight => weight.isFinite && weight >= 0.0), "Weights must be nonnegative and finite")

      new WeightedEuclidean(_ => weights)

    def constant(weight: Double): WeightedEuclidean =
      require(weight.isFinite && weight >= 0.0, "Weight must be nonnegative and finite")

      new WeightedEuclidean(size => Vector.fill(size)(weight))

  /** Each group contributes its weight times its mean squared feature difference. */
  final case class GroupNormalizedEuclidean(layout: FeatureLayout) extends Distance:
    private val weighted =
      WeightedEuclidean(
        layout.groups.flatMap(group => Vector.fill(group.features.size)(group.weight / group.features.size))
      )

    def between(left: FeatureVector, right: FeatureVector): Double =
      weighted.between(left, right)
