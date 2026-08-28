package com.htmlism.tarotengine.finalfantasy.vibe

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import cats.effect.IO
import cats.effect.IOApp
import io.circe.Decoder
import io.circe.generic.semiauto.deriveDecoder
import io.circe.yaml.parser

final case class BossDefinition(boss: String)

object BossDefinition:
  given Decoder[BossDefinition] = deriveDecoder[BossDefinition]

final case class DemoScenario(title: String, party: Party)

object VibeApp extends IOApp.Simple:
  import Item.*
  import Job.*
  import Spell.*

  private[vibe] val demoScenarios =
    List(
      DemoScenario(
        "Four White Mages with Dia",
        Party.withItems(
          List(
            PartyMember.whiteMage(Cure, Heal, Dia, Protect, Blink, Silence),
            PartyMember.whiteMage(Cure, Heal, Protect, Blink),
            PartyMember.whiteMage(Cure, Heal, Protect, Blink),
            PartyMember.whiteMage(Cure, Heal, Protect, Blink)
          ),
          Potion
        )
      ),
      DemoScenario(
        "Warrior, Thief, White Mage, and Black Mage",
        Party.withItems(
          List(
            PartyMember(Warrior),
            PartyMember(Thief),
            PartyMember.whiteMage(Cure, Heal, Protect, Blink, Silence),
            PartyMember.blackMage(Fire, Thunder, Sleep, Temper, Haste, Slow)
          ),
          Potion
        )
      ),
      DemoScenario(
        "Two Warriors, Monk, and Red Mage",
        Party(
          List(
            PartyMember(Warrior),
            PartyMember(Warrior),
            PartyMember(Monk),
            PartyMember.redMage(Cure, Fire, Protect, Silence, Temper, Haste, Slow)
          )
        )
      ),
      DemoScenario(
        "Warrior, Thief, and lightly trained Mages",
        Party.withItems(
          List(
            PartyMember(Warrior),
            PartyMember(Thief),
            PartyMember.whiteMage(),
            PartyMember.blackMage(Blizzard)
          ),
          Potion
        )
      ),
      DemoScenario(
        "Four Black Mages with split spellbooks",
        Party(
          List(
            PartyMember.blackMage(Sleep, Slow),
            PartyMember.blackMage(Fire, Temper),
            PartyMember.blackMage(Blizzard, Haste),
            PartyMember.blackMage(Thunder)
          )
        )
      ),
      DemoScenario(
        "Four Red Mages with split spellbooks",
        Party(
          List(
            PartyMember.redMage(Cure, Silence),
            PartyMember.redMage(Fire, Temper),
            PartyMember.redMage(Sleep, Haste),
            PartyMember.redMage(Blizzard, Thunder, Protect, Slow)
          )
        )
      ),
      DemoScenario(
        "Dia and Fire casters without healing",
        Party(
          List(
            PartyMember.whiteMage(Dia, Silence),
            PartyMember.whiteMage(Dia, Blink),
            PartyMember.blackMage(Fire, Temper),
            PartyMember.blackMage(Fire, Sleep, Haste)
          )
        )
      ),
      DemoScenario(
        "Promoted endgame party",
        Party(
          List(
            PartyMember.knight(Cure, Protect, NulShock, NulBlaze),
            PartyMember.ninja(Temper, Haste),
            PartyMember.whiteWizard(Cure, NulFrost, NulDeath, Protera, Invisira, Life),
            PartyMember.blackWizard(Flare, Saber)
          )
        )
      ),
      DemoScenario(
        "Four untrained Black Mages",
        Party(List.fill(4)(PartyMember.blackMage()))
      ),
      DemoScenario(
        "Four Thieves",
        Party(List.fill(4)(PartyMember(Thief)))
      ),
      DemoScenario(
        "Solo Thief with Potion",
        Party.withItems(List(PartyMember(Thief)), Potion)
      )
    )

  private[vibe] val loadBosses: IO[List[BossDefinition]] =
    for
      yaml <- IO.blocking(
        Files.readString(Path.of("data", "final-fantasy-bosses.yaml"), StandardCharsets.UTF_8)
      )
      bosses <- IO.fromEither(parser.parse(yaml).flatMap(_.as[List[BossDefinition]]))
    yield bosses

  private def renderGuide(party: Party, boss: String): String =
    val guide   = FinalFantasyStrategyGuide.guide.forPartyAndBoss(party, boss)
    val heading = s"  ${guide.boss.capitalize}"
    val advice  = guide
      .fragments
      .map(fragment => s"    ${fragment.section.label}: ${fragment.advice}")
      .mkString("\n")

    s"$heading\n$advice"

  private def renderScenario(scenario: DemoScenario, bosses: List[String]): String =
    val guides = bosses.map(renderGuide(scenario.party, _)).mkString("\n")
    val items  =
      if scenario.party.inventory.isEmpty then "none"
      else scenario.party.inventory.toList.map(_.label).sorted.mkString(", ")

    s"Scenario: ${scenario.title}\nParty: ${scenario.party.label}\nItems: $items\n$guides"

  val run: IO[Unit] =
    for
      definitions <- loadBosses
      demoBosses   = definitions.map(_.boss)
      output       = demoScenarios.map(renderScenario(_, demoBosses)).mkString("\n\n")
      _           <- IO.println(s"Ruleset: Final Fantasy Pixel Remaster\n\n$output")
    yield ()
