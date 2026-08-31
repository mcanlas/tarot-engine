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

const equipmentSlots = ["weapon", "body", "shield", "head", "arms"]

const [occurrencesText, townKey = "cornelia", verbosity, ...extraArgs] = process.argv.slice(2)
const occurrences = Number(occurrencesText)
const verbose = verbosity === "verbose"
const compactActionWidth = 60

if (
  extraArgs.length > 0
  || (verbosity !== undefined && !verbose)
  || occurrencesText === undefined
  || !Number.isSafeInteger(occurrences)
  || occurrences < 1
) {
  console.error("Usage: node src/test/ts/final-fantasy/next-action.console-test.js <positive integer occurrences> [town key] [verbose]")
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
  const actionCatalog = {
    equipment: equipment.map((item) => ({ ...item, price: 0 })),
    magic: magic.map((spell) => ({ ...spell, price: 0 })),
  }
  const itemNames = new Map(equipment.map((item) => [item.key, item.name]))
  const spellNames = new Map(magic.map((spell) => [spell.key, spell.name]))
  const weaponCatalog = equipment.filter((item) => item.slot === "weapon")
  const town = cumulativeTown(towns, townKey)

  const provider = new NextActionProvider(strategyCatalog, actionCatalog)
  const evaluator = new PartyUtilityEvaluator(actionCatalog)
  const recommender = new NextActionRecommender(provider, evaluator.evaluate)

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const party = {
      gil: 0,
      characters: emptyCharacters(weaponCatalog, ...partyEngine.createRandomParty()),
    }

    console.log(`\n=== FF1 next-action run ${occurrence + 1} ===`)
    console.log(`Town: ${town.name}`)
    console.log(`Starting party (spell sets are empty; weapon slot is a coin flip): ${
      party.characters.map((character) => character.id).join(" / ")
    }`)
    console.log(`\n${formatEquipmentTable(party.characters, itemNames)}\n`)
    const jobWidth = Math.max("JOB".length, ...party.characters.map(({ id }) => id.length))
    if (!verbose) {
      console.log(`${"#".padStart(2)} | ${"JOB".padEnd(jobWidth)} | ${"ACTION".padEnd(compactActionWidth)} | ${"UTILITY".padStart(7)}`)
    }

    let currentParty = party
    let step = 1

    while (true) {
      const recommendation = recommender.recommend(currentParty, town)
      if (recommendation.kind === "stop") {
        console.log(`\nStop: ${formatStopReason(recommendation.reason)}.`)
        break
      }

      const actionText = formatAction(recommendation.action, itemNames, spellNames)
      currentParty = applyAction(currentParty, recommendation.action)
      if (verbose) {
        const componentKey = recommendation.action.kind === "learn-spell"
          ? `${recommendation.action.characterId}:magic:${recommendation.action.spell}`
          : `${recommendation.action.characterId}:equipment:${recommendation.action.slot}`
        const component = recommendation.components.find(({ key }) => key === componentKey)

        console.log(`\n${step}. ${actionText}`)
        console.log(`   Marginal utility: +${recommendation.scoreDelta}`)
        if (component !== undefined) {
          console.log(`   Why: ${component.reason}`)
        }
      } else {
        const actionDescription = formatActionDescription(
          recommendation.action,
          itemNames,
          spellNames,
        )
        console.log(`${String(step).padStart(2)} | ${recommendation.action.characterId.padEnd(jobWidth)} | ${actionDescription.padEnd(compactActionWidth)} | ${formatUtility(recommendation.scoreDelta).padStart(7)}`)
      }
      step += 1
    }
  }

  console.log(`\nCompleted ${occurrences} random FF1 next-action runs.`)
}

function emptyCharacters(weaponCatalog, ...baseClasses) {
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
      weaponCatalog,
    )
  })
}

function emptyCharacter(id, baseClass, weaponCatalog) {
  return {
    id,
    baseClass,
    promoted: false,
    equipment: randomStartingWeaponEquipment(baseClass, weaponCatalog),
    learnedSpells: new Set(),
  }
}

function randomStartingWeaponEquipment(baseClass, weaponCatalog) {
  if (baseClass === "monk") {
    return {}
  }

  const legalWeapons = weaponCatalog.filter((weapon) => weapon.canEquip.includes(baseClass))
  if (legalWeapons.length === 0 || Math.random() < 0.5) {
    return {}
  }

  const weapon = legalWeapons[Math.floor(Math.random() * legalWeapons.length)]

  return { weapon: weapon.key }
}

function formatEquipmentTable(characters, itemNames) {
  const jobHeader = "JOB"
  const jobWidth = Math.max(jobHeader.length, ...characters.map(({ id }) => id.length))
  const columns = equipmentSlots.map((slot) => {
    const header = slot.toUpperCase()
    const values = characters.map((character) => formatEquipmentSlot(character.equipment[slot], itemNames))

    return { header, width: Math.max(header.length, ...values.map((value) => value.length)), values }
  })

  const headerRow = [jobHeader.padEnd(jobWidth), ...columns.map(({ header, width }) => header.padEnd(width))]
    .join(" | ")
  const rows = characters.map((character, index) => [
    character.id.padEnd(jobWidth),
    ...columns.map(({ values, width }) => values[index].padEnd(width)),
  ].join(" | "))

  return [headerRow, ...rows].map((line) => `  ${line}`).join("\n")
}

function formatEquipmentSlot(itemKey, itemNames) {
  return itemKey === undefined ? "-" : (itemNames.get(itemKey) ?? itemKey)
}

function formatAction(action, itemNames, spellNames) {
  return `${action.characterId} ${formatActionDescription(action, itemNames, spellNames)}`
}

function formatActionDescription(action, itemNames, spellNames) {
  if (action.kind === "learn-spell") {
    const spellName = spellNames.get(action.spell) ?? action.spell

    return `learns ${spellName}`
  }

  const itemName = itemNames.get(action.item) ?? action.item
  const replacement = action.replaces === undefined
    ? ""
    : `, replacing ${itemNames.get(action.replaces) ?? action.replaces}`

  return `equips ${itemName}${replacement}`
}

function formatUtility(score) {
  return `+${score.toFixed(2).replace(/\.?0+$/, "")}`
}

function formatStopReason(reason) {
  return reason === "no-legal-action"
    ? "no legal action remains"
    : "no action has positive marginal utility"
}
