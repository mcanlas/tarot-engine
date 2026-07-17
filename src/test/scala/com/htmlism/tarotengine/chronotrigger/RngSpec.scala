package com.htmlism.tarotengine.chronotrigger

import scala.util.Random

import weaver.*

object RngSpec extends FunSuite:
  test("nextBoolean is deterministic for a given seed"):
    val control = Random(123)

    expect.same(control.nextBoolean(), Rng.nextBoolean.runA(Random(123)).value)

  test("shuffle is deterministic for a given seed"):
    val values = List("Crono", "Marle", "Lucca", "Frog", "Robo")

    val first  = Rng.shuffle(values).runA(Random(123)).value
    val second = Rng.shuffle(values).runA(Random(123)).value

    expect.same(first, second) &&
    expect.same(values.sorted, first.sorted)

  test("shuffle composes while threading one Random instance"):
    val values  = List(1, 2, 3, 4, 5, 6)
    val program =
      for
        first  <- Rng.shuffle(values)
        second <- Rng.shuffle(values)
      yield first -> second

    val control  = Random(123)
    val expected = control.shuffle(values) -> control.shuffle(values)

    expect.same(expected, program.runA(Random(123)).value)
