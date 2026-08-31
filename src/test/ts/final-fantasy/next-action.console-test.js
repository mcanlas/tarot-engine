import { readFile } from "node:fs/promises"

import { parse } from "yaml"

import {
  NextActionProvider,
} from "../../../main/ts/final-fantasy/next-action-provider.ts"
import {
  applyAction,
  NextActionRecommender,
} from "../../../main/ts/final-fantasy/next-action-recommender.ts"
import {
  PartyUtilityEvaluator,
} from "../../../main/ts/final-fantasy/party-utility-evaluator.ts"
import { loadStrategyCatalog } from "../../../main/ts/final-fantasy/strategy-data.ts"
import { cumulativeTown, loadTowns } from "../../../main/ts/final-fantasy/towns.ts"
import { loadPartyStrategyEngine } from "./party-strategy.ts"

const loadProjectFile = (path) =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

const [occurrencesText, townKey = "cornelia", ...extraArgs] = process.argv.slice(2)
const occurrences = Number(occurrencesText)

if (
  extraArgs.length > 0
  || occurrencesText === undefined
  || !Number.isSafeInteger(occurrences)
  || occurrences < 1
) {
  console.error("Usage: node src/test/ts/final-fantasy/next-action.console-test.js <positive integer occurrences> [town key]")
  process.exitCode = 1
} else {
  const [partyEngine, strategyCatalog, towns, itemText, magicText] = await Promise.all([
    loadPartyStrategyEngine(loadProjectFile),
    loadStrategyCatalog(loadProjectFile),
    loadTowns(loadProjectFile),
    loadProjectFile("data/final-fantasy/items.yaml"),
    loadProjectFile("data/final-fantasy/magic.yaml"),
  ])
  const equipment = parse(itemText).items
  const magic = parse(magicText).magic
  const actionCatalog = { equipment, magic }
  const itemNames = new Map(equipment.map((item) => [item.key, item.name]))
  const spellNames = new Map(magic.map((spell) => [spell.key, spell.name]))
  const town = cumulativeTown(towns, townKey)

  const provider = new NextActionProvider(strategyCatalog, actionCatalog)
  const evaluator = new PartyUtilityEvaluator(actionCatalog)
  const recommender = new NextActionRecommender(provider, evaluator.evaluate)

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const party = {
      gil: 5_000,
      characters: emptyCharacters(...partyEngine.createRandomParty()),
    }

    console.log(`\n=== FF1 next-action run ${occurrence + 1} ===`)
    console.log(`Town: ${town.name}`)
    console.log(`Starting gil: ${party.gil}`)
    console.log(`Starting party (all equipment and spell sets are empty): ${
      party.characters.map((character) => character.id).join(" / ")
    }`)

    let currentParty = party
    let step = 1

    while (true) {
      const recommendation = recommender.recommend(currentParty, town)
      if (recommendation.kind === "stop") {
        console.log(`\nStop: ${formatStopReason(recommendation.reason)}.`)
        console.log(`Final gil: ${currentParty.gil}`)
        break
      }

      const componentKey = recommendation.action.kind === "learn-spell"
        ? `${recommendation.action.characterId}:magic:${recommendation.action.spell}`
        : `${recommendation.action.characterId}:equipment:${recommendation.action.slot}`
      const component = recommendation.components.find(({ key }) => key === componentKey)

      console.log(`\n${step}. ${formatAction(recommendation.action, itemNames, spellNames)}`)
      console.log(`   Marginal utility: +${recommendation.scoreDelta}`)
      if (component !== undefined) {
        console.log(`   Why: ${component.reason}`)
      }

      currentParty = applyAction(currentParty, recommendation.action)
      console.log(`   Gil remaining: ${currentParty.gil}`)
      step += 1
    }
  }

  console.log(`\nCompleted ${occurrences} random FF1 next-action runs.`)
}

function emptyCharacters(...baseClasses) {
  const duplicateClasses = new Set(
    baseClasses.filter((baseClass, index) => baseClasses.indexOf(baseClass) !== index),
  )
  const classCounts = new Map()

  return baseClasses.map((baseClass) => {
    const count = (classCounts.get(baseClass) ?? 0) + 1

    classCounts.set(baseClass, count)
    return emptyCharacter(
      duplicateClasses.has(baseClass) ? `${baseClass}-${count}` : baseClass,
      baseClass,
    )
  })
}

function emptyCharacter(id, baseClass) {
  return {
    id,
    baseClass,
    promoted: false,
    equipment: {},
    learnedSpells: new Set(),
  }
}

function formatAction(action, itemNames, spellNames) {
  if (action.kind === "learn-spell") {
    const spellName = spellNames.get(action.spell) ?? action.spell

    return `${action.characterId} learns ${spellName} for ${action.price} gil`
  }

  const itemName = itemNames.get(action.item) ?? action.item
  const replacement = action.replaces === undefined
    ? ""
    : `, replacing ${itemNames.get(action.replaces) ?? action.replaces}`

  return `${action.characterId} equips ${itemName} in ${action.slot}${replacement} for ${action.price} gil`
}

function formatStopReason(reason) {
  return reason === "no-legal-action"
    ? "no legal affordable action remains"
    : "no action has positive marginal utility"
}
