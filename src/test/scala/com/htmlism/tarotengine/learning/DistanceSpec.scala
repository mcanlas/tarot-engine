package com.htmlism.tarotengine.learning

import scala.util.Try

import weaver.*

object DistanceSpec extends FunSuite:
  private def vector(values: Double*) =
    FeatureVector.fromValues(values.toVector)

  test("weighted distance uses weights on squared differences"):
    val distance =
      Distance.WeightedEuclidean(Vector(4.0, 1.0))
    val left =
      vector(0.0, 0.0)
    val right =
      vector(3.0, 4.0)

    expect.same(math.sqrt(52.0), distance.between(left, right)) &&
    expect.same(distance.between(left, right), distance.between(right, left))

  test("Euclidean is unit-weighted distance for any dimension"):
    expect.same(5.0, Distance.euclidean.between(vector(0.0, 0.0), vector(3.0, 4.0))) &&
    expect.same(2.0, Distance.euclidean.between(vector(1.0), vector(3.0))) &&
    expect.same(0.0, Distance.euclidean.between(vector(), vector()))

  test("zero weights ignore coordinates even when subtraction overflows"):
    expect.same(
      3.0,
      Distance.WeightedEuclidean(Vector(0.0, 1.0)).between(vector(-Double.MaxValue, 0.0), vector(Double.MaxValue, 3.0))
    )

  test("reject invalid weights and mismatched layouts"):
    forEach(List(-1.0, Double.NaN, Double.PositiveInfinity)): weight =>
      expect(Try(Distance.WeightedEuclidean(Vector(weight))).isFailure) &&
        expect(Try(Distance.WeightedEuclidean.constant(weight)).isFailure)

  test("reject wrong weight counts, vector dimensions, and nonfinite values"):
    expect(Try(Distance.WeightedEuclidean(Vector(1.0)).between(vector(0.0, 0.0), vector(1.0, 1.0))).isFailure) &&
    expect(Try(Distance.euclidean.between(vector(0.0), vector(0.0, 1.0))).isFailure) &&
    expect(Try(Distance.euclidean.between(vector(Double.NaN), vector(0.0))).isFailure)

  test("Euclidean preserves very small and very large finite distances"):
    expect.same(1e-200, Distance.euclidean.between(vector(0.0), vector(1e-200))) &&
    expect.same(1e200, Distance.euclidean.between(vector(0.0), vector(1e200)))

  test("group normalization balances groups with different numbers of features"):
    val layout =
      FeatureLayout(
        Vector(
          FeatureGroup("mechanics", 1.0, Vector("bolts", "pets", "healing", "mobility")),
          FeatureGroup("race", 1.0, Vector("race"))
        )
      )
    val distance =
      Distance.GroupNormalizedEuclidean(layout)
    val origin =
      vector(0.0, 0.0, 0.0, 0.0, 0.0)

    expect.same(Vector("bolts", "pets", "healing", "mobility", "race"), layout.featureNames) &&
    expect.same(1.0, distance.between(origin, vector(1.0, 1.0, 1.0, 1.0, 0.0))) &&
    expect.same(1.0, distance.between(origin, vector(0.0, 0.0, 0.0, 0.0, 1.0)))

  test("group weights control influence and zero disables a group"):
    val distance =
      Distance.GroupNormalizedEuclidean(
        FeatureLayout(
          Vector(
            FeatureGroup("mechanics", 4.0, Vector("bolts", "pets")),
            FeatureGroup("talents", 0.0, Vector("talent"))
          )
        )
      )

    expect.same(2.0, distance.between(vector(0.0, 0.0, 0.0), vector(1.0, 1.0, 100.0)))

  test("group normalization is unchanged when a feature group is duplicated within itself"):
    val single =
      Distance.GroupNormalizedEuclidean(FeatureLayout(Vector(FeatureGroup("mechanics", 1.0, Vector("bolts")))))
    val expanded =
      Distance.GroupNormalizedEuclidean(
        FeatureLayout(Vector(FeatureGroup("mechanics", 1.0, Vector("bolts-a", "bolts-b", "bolts-c", "bolts-d"))))
      )

    expect.same(
      single.between(vector(0.0), vector(1.0)),
      expanded.between(vector(0.0, 0.0, 0.0, 0.0), vector(1.0, 1.0, 1.0, 1.0))
    )

  test("layouts reject ambiguous names, empty groups, and invalid group weights"):
    val group =
      FeatureGroup("mechanics", 1.0, Vector("bolts"))

    expect(Try(FeatureGroup("mechanics", 1.0, Vector.empty)).isFailure) &&
    expect(Try(FeatureGroup("mechanics", -1.0, Vector("bolts"))).isFailure) &&
    expect(Try(FeatureGroup("mechanics", Double.NaN, Vector("bolts"))).isFailure) &&
    expect(Try(FeatureGroup("", 1.0, Vector("bolts"))).isFailure) &&
    expect(Try(FeatureGroup("mechanics", 1.0, Vector(""))).isFailure) &&
    expect(Try(FeatureLayout(Vector(group, group))).isFailure) &&
    expect(Try(FeatureLayout(Vector(group, FeatureGroup("other", 1.0, Vector("bolts"))))).isFailure)

  test("group-normalized distance rejects vectors outside its layout"):
    val distance =
      Distance.GroupNormalizedEuclidean(FeatureLayout(Vector(FeatureGroup("mechanics", 1.0, Vector("bolts")))))

    expect(Try(distance.between(vector(0.0, 0.0), vector(1.0, 1.0))).isFailure)
