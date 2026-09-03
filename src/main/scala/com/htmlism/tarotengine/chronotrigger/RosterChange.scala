package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder

sealed trait RosterChange:
  def when: Option[FlagCondition]

object RosterChange:
  final case class Pin(char: String, when: Option[FlagCondition]) extends RosterChange

  object Pin:
    def apply(char: String): Pin =
      Pin(char, None)

  final case class Unpin(char: String, when: Option[FlagCondition]) extends RosterChange

  object Unpin:
    def apply(char: String): Unpin =
      Unpin(char, None)

  final case class Remove(char: String, when: Option[FlagCondition]) extends RosterChange

  object Remove:
    def apply(char: String): Remove =
      Remove(char, None)

  final case class Add(char: String, when: Option[FlagCondition]) extends RosterChange

  object Add:
    def apply(char: String): Add =
      Add(char, None)

  given Decoder[RosterChange] = Decoder.instance: cursor =>
    cursor
      .get[Option[FlagCondition]]("when")
      .flatMap: when =>
        cursor
          .get[String]("pin")
          .map(Pin(_, when))
          .orElse(cursor.get[String]("unpin").map(Unpin(_, when)))
          .orElse(cursor.get[String]("remove").map(Remove(_, when)))
          .orElse(cursor.get[String]("add").map(Add(_, when)))
