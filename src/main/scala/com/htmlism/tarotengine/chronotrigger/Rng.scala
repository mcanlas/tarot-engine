package com.htmlism.tarotengine.chronotrigger

import scala.util.Random

import cats.data.State

type Rng[A] = State[Random, A]

object Rng:
  def shuffle[A](xs: List[A]): Rng[List[A]] =
    State: random =>
      random -> random.shuffle(xs)
