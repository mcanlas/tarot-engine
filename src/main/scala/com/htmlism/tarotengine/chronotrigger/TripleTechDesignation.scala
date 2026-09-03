package com.htmlism.tarotengine.chronotrigger

sealed trait TripleTechDesignation

object TripleTechDesignation:
  final case class Secret(tech: SecretTripleTech) extends TripleTechDesignation

  case object Base extends TripleTechDesignation

  def forParty(
      selectedParty: List[Character],
      secretTripleTechs: List[SecretTripleTech]
  ): Option[TripleTechDesignation] =
    Option
      .when(selectedParty.size == 3):
        secretTripleTechs
          .find: tech =>
            tech.characters.toList.toSet == selectedParty.toSet
          .map(Secret.apply)
          .orElse:
            Option.when(selectedParty.contains(Character.Crono) && !selectedParty.contains(Character.Magus))(Base)
      .flatten
