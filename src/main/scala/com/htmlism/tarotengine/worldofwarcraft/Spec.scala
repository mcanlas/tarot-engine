package com.htmlism.tarotengine.worldofwarcraft

import io.circe.Decoder

/** A talent tree name; use the owning class to resolve names shared by multiple classes. */
enum Spec(val yamlName: String):
  case Balance       extends Spec("Balance")
  case FeralCombat   extends Spec("Feral Combat")
  case Restoration   extends Spec("Restoration")
  case BeastMastery  extends Spec("Beast Mastery")
  case Marksmanship  extends Spec("Marksmanship")
  case Survival      extends Spec("Survival")
  case Arcane        extends Spec("Arcane")
  case Fire          extends Spec("Fire")
  case Frost         extends Spec("Frost")
  case Holy          extends Spec("Holy")
  case Protection    extends Spec("Protection")
  case Retribution   extends Spec("Retribution")
  case Discipline    extends Spec("Discipline")
  case Shadow        extends Spec("Shadow")
  case Assassination extends Spec("Assassination")
  case Combat        extends Spec("Combat")
  case Subtlety      extends Spec("Subtlety")
  case Elemental     extends Spec("Elemental")
  case Enhancement   extends Spec("Enhancement")
  case Affliction    extends Spec("Affliction")
  case Demonology    extends Spec("Demonology")
  case Destruction   extends Spec("Destruction")
  case Arms          extends Spec("Arms")
  case Fury          extends Spec("Fury")

object Spec:
  given Decoder[Spec] = Decoder
    .decodeString
    .emap: value =>
      Spec
        .values
        .find(_.yamlName == value)
        .toRight(s"Unknown WoW Forever spec: $value")
