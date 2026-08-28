package com.htmlism.tarotengine.finalfantasy.vibe

import weaver.*

object VibeAppSpec extends SimpleIOSuite:
  import Job.*

  test("every configured boss has baseline strategy coverage"):
    VibeApp
      .loadBosses
      .map: bosses =>
        val party = Party(List(Warrior, Thief, WhiteMage, BlackMage).map(PartyMember(_)))

        forEach(bosses): definition =>
          expect(
            FinalFantasyStrategyGuide
              .guide
              .forPartyAndBoss(party, definition.boss)
              .fragments
              .nonEmpty
          )
