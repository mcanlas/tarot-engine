package com.htmlism.tarotengine.chronotrigger

import scala.collection.immutable.SortedMap

import cats.data.NonEmptyMap
import io.circe.Decoder

final case class FlagCondition(values: NonEmptyMap[String, Boolean])

object FlagCondition:
  given Decoder[FlagCondition] = Decoder[Map[String, Boolean]].emap: values =>
    NonEmptyMap
      .fromMap(SortedMap.from(values))
      .map(FlagCondition.apply)
      .toRight("A flag condition must contain at least one flag")
