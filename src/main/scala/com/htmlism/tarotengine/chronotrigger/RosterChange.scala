package com.htmlism.tarotengine.chronotrigger

import io.circe.Decoder

sealed trait RosterChange:
  def when: Option[FlagCondition]

object RosterChange:
  final case class Pin(char: Character, when: Option[FlagCondition]) extends RosterChange

  object Pin:
    def apply(char: Character): Pin =
      Pin(char, None)

  final case class Unpin(char: Character, when: Option[FlagCondition]) extends RosterChange

  object Unpin:
    def apply(char: Character): Unpin =
      Unpin(char, None)

  final case class Remove(char: Character, when: Option[FlagCondition]) extends RosterChange

  object Remove:
    def apply(char: Character): Remove =
      Remove(char, None)

  final case class Add(char: Character, when: Option[FlagCondition]) extends RosterChange

  object Add:
    def apply(char: Character): Add =
      Add(char, None)

  given Decoder[RosterChange] = Decoder.instance: cursor =>
    cursor
      .get[Option[FlagCondition]]("when")
      .flatMap: when =>
        cursor
          .get[Character]("pin")
          .map(Pin(_, when))
          .orElse(cursor.get[Character]("unpin").map(Unpin(_, when)))
          .orElse(cursor.get[Character]("remove").map(Remove(_, when)))
          .orElse(cursor.get[Character]("add").map(Add(_, when)))
