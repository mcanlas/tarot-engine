package com.htmlism.tarotengine.learning

import scala.util.Try

import weaver.*

object RbfKernelSpec extends FunSuite:
  private def vector(values: Double*) = FeatureVector.fromValues(values.toVector)

  private def expectFailure[A](value: => A) = expect(Try(value).isFailure)

  test("known distance, length scale, variance, and symmetry"):
    val kernel = RbfKernel(lengthScale = 5.0, variance = 2.0)
    val left   = vector(0.0, 0.0)
    val right  = vector(3.0, 4.0)

    expect(math.abs(kernel.covariance(left, right) - 1.2130613194252668) < 1e-12) &&
    expect.same(2.0, kernel.covariance(left, left)) &&
    expect.same(kernel.covariance(left, right), kernel.covariance(right, left))

  test("tiny positive length scales preserve self similarity and suppress distant points"):
    val kernel = RbfKernel(lengthScale = 1e-300, variance = 1.0)

    expect.same(1.0, kernel.covariance(vector(0.0), vector(0.0))) &&
    expect.same(0.0, kernel.covariance(vector(0.0), vector(1.0)))

  test("construction and copy reject nonpositive and nonfinite parameters"):
    val kernel = RbfKernel(lengthScale = 1.0, variance = 1.0)

    forEach(List(0.0, -1.0, Double.NaN, Double.PositiveInfinity)): invalid =>
      expectFailure(RbfKernel(lengthScale = invalid, variance = 1.0)) &&
        expectFailure(RbfKernel(lengthScale = 1.0, variance = invalid)) &&
        expectFailure(kernel.copy(lengthScale = invalid)) &&
        expectFailure(kernel.copy(variance = invalid))

  test("reject mismatched dimensions and nonfinite coordinates"):
    val kernel = RbfKernel(lengthScale = 1.0, variance = 1.0)

    expectFailure(kernel.covariance(vector(0.0), vector(0.0, 1.0))) &&
    expectFailure(kernel.covariance(vector(Double.NaN), vector(0.0)))

  test("compare domain values through one encoder and propagate encoding errors"):
    given FeatureEncoder[Double] with
      val featureNames = Vector("value")

      def encode(value: Double): Either[String, FeatureVector] =
        Either.cond(value.isFinite, vector(value), "Value must be finite")

    val kernel = RbfKernel(lengthScale = 1.0, variance = 1.0)

    expect(Kernel.compare(0.0, 1.0, kernel).exists(value => math.abs(value - 0.6065306597126334) < 1e-12)) &&
    expect.same(Left("Value must be finite"), Kernel.compare(Double.NaN, 1.0, kernel))

  test("domain comparisons reject vectors that disagree with the encoder's layout"):
    given FeatureEncoder[Int] with
      val featureNames = Vector("one", "two")

      def encode(value: Int): Either[String, FeatureVector] = Right(vector(value.toDouble))

    expect(Kernel.compare(0, 1, RbfKernel(lengthScale = 1.0, variance = 1.0)).isLeft)
