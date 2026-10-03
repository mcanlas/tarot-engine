package com.htmlism.tarotengine.worldofwarcraft

enum BuildFeature:
  case FactionIs(faction: Faction)
  case RaceIs(race: Race)
  case ClassIs(className: CharacterClass)
  case ProfessionIs(profession: Profession)
  case PrimaryFlag(name: String)
  case SecondaryFlag(name: String)
