package com.htmlism.tarotengine.finalfantasy.vibe

import weaver.*

object VibeAppSpec extends SimpleIOSuite:
  import Job.*

  test("every configured boss has baseline boss strategy coverage"):
    VibeApp
      .loadBossStrategy
      .map: bossStrategy =>
        val party = Party(List(Warrior, Thief, WhiteMage, BlackMage).map(PartyMember(_)))

        forEach(bossStrategy.bosses): definition =>
          expect(
            bossStrategy
              .guide
              .forPartyAndBoss(party, definition.boss)
              .fragments
              .nonEmpty
          )
