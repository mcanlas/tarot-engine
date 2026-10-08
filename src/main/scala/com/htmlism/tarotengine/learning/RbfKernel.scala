package com.htmlism.tarotengine.learning

/**
  * RBF means "radial basis function": a rule based on the distance between two feature vectors.
  *
  * A kernel describes how strongly a Gaussian process connects the preference scores of two inputs. With this kernel,
  * nearby feature vectors have a stronger connection, so an observation about one build can inform a similar build.
  *
  * The result is called covariance: the model's assumed relationship between those preference scores. Identical vectors
  * produce `variance`; as the vectors move farther apart, the result approaches zero.
  *
  * The selected distance is divided by `lengthScale`. The result is `variance * exp(-0.5 * scaledDistance squared)`.
  *
  * For example, with variance 1 and length scale 1, the vectors [0] and [1] have covariance about 0.607. Increasing the
  * length scale to 2 raises it to about 0.882: the same difference creates a stronger connection.
  *
  * @param lengthScale
  *   the distance over which inputs remain strongly connected; larger values connect more distant inputs
  * @param variance
  *   the scale of variation in the model's preference scores; also the covariance of an input with itself
  */
final case class RbfKernel(lengthScale: Double, variance: Double, distance: Distance) extends Kernel:
  require(lengthScale.isFinite && lengthScale > 0.0, "RBF length scale must be positive and finite")
  require(variance.isFinite && variance > 0.0, "RBF variance must be positive and finite")

  def covariance(left: FeatureVector, right: FeatureVector): Double =
    val scaledDistance =
      distance.between(left, right) / lengthScale

    variance * math.exp(-0.5 * scaledDistance * scaledDistance)

object RbfKernel:
  def apply(lengthScale: Double, variance: Double): RbfKernel =
    new RbfKernel(lengthScale, variance, Distance.euclidean)
