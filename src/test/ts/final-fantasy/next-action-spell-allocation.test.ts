import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parse } from "yaml"

import {
  type CharacterState,
  type EquipmentDefinition,
  type MagicDefinition,
  NextActionProvider,
  type NextActionCatalog,
  type PartyState,
} from "../../../main/ts/final-fantasy/next-action-provider.ts"
import {
  applyAction,
  NextActionRecommender,
} from "../../../main/ts/final-fantasy/next-action-recommender.ts"
import {
  PartyUtilityEvaluator,
} from "../../../main/ts/final-fantasy/party-utility-evaluator.ts"
import { loadStrategyCatalog } from "../../../main/ts/final-fantasy/strategy-data.ts"
import {
  cumulativeTown,
  loadTowns,
  type TownDefinition,
} from "../../../main/ts/final-fantasy/towns.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

interface ProvokaScenario {
  readonly catalog: NextActionCatalog
  readonly provider: NextActionProvider
  readonly town: TownDefinition
}

async function loadScenario(townKey: string): Promise<ProvokaScenario> {
  const [strategyCatalog, towns, itemText, magicText] = await Promise.all([
    loadStrategyCatalog(loadProjectFile),
    loadTowns(loadProjectFile),
    loadProjectFile("data/final-fantasy/items.yaml"),
    loadProjectFile("data/final-fantasy/magic.yaml"),
  ])
  const catalog = {
    equipment: (parse(itemText) as { items: EquipmentDefinition[] }).items,
    magic: (parse(magicText) as { magic: MagicDefinition[] }).magic,
  }

  return {
    catalog,
    provider: new NextActionProvider(strategyCatalog, catalog),
    town: cumulativeTown(towns, townKey),
  }
}

const loadProvokaScenario = (): Promise<ProvokaScenario> => loadScenario("provoka")

test("multiple Red Mages divide Provoka coverage instead of cloning control loadouts", async () => {
  const scenario = await loadProvokaScenario()
  const finalParty = recommendAll(scenario, [
    character("red-1", "red-mage"),
    character("red-2", "red-mage"),
  ])
  const [first, second] = finalParty.characters

  assert.deepEqual([...first!.learnedSpells], [
    "cure", "temper", "silence", "sleep", "slow", "thunder",
  ])
  assert.deepEqual([...second!.learnedSpells], [
    "blizzard", "protect", "dark", "fire", "nulshock", "cure",
  ])
  assert.deepEqual(
    duplicatedSpells(finalParty),
    ["cure"],
    "recovery can be redundant, but control and support should have one responsible caster",
  )
  assertThreeSpellsPerLevel(finalParty, scenario.catalog.magic)
})

test("Red Red White Black gives core school work to specialists and gaps to Red Mages", async () => {
  const scenario = await loadProvokaScenario()
  const finalParty = recommendAll(scenario, [
    character("red-1", "red-mage"),
    character("red-2", "red-mage"),
    character("white", "white-mage"),
    character("black", "black-mage"),
  ])
  const byId = new Map(finalParty.characters.map((member) => [member.id, member]))

  assert.deepEqual([...byId.get("white")!.learnedSpells], [
    "cure", "silence", "dia", "nulshock",
  ])
  assert.deepEqual([...byId.get("black")!.learnedSpells], [
    "temper", "sleep", "blizzard", "fire",
  ])
  assert.deepEqual([...byId.get("red-1")!.learnedSpells], [
    "protect", "dark", "invis", "focus", "cure",
  ])
  assert.deepEqual([...byId.get("red-2")!.learnedSpells], [
    "slow", "thunder", "blindna", "cure",
  ])
  assert.deepEqual(duplicatedSpells(finalParty), ["cure"])
  assertThreeSpellsPerLevel(finalParty, scenario.catalog.magic)
})

test("Elfheim recommendations value Haste and party healing without spending a slot on Fear", async () => {
  const scenario = await loadScenario("elfheim")
  const finalParty = recommendAll(scenario, [
    character("warrior", "warrior"),
    character("white", "white-mage"),
    character("black", "black-mage"),
  ], 50_000)
  const byId = new Map(finalParty.characters.map((member) => [member.id, member]))

  assert(byId.get("black")!.learnedSpells.has("haste"))
  assert(byId.get("white")!.learnedSpells.has("heal"))
  assert(!byId.get("white")!.learnedSpells.has("fear"))
  assertThreeSpellsPerLevel(finalParty, scenario.catalog.magic)
})

function recommendAll(
  scenario: ProvokaScenario,
  characters: readonly CharacterState[],
  gil = 5_000,
): PartyState {
  const evaluator = new PartyUtilityEvaluator(scenario.catalog)
  const recommender = new NextActionRecommender(scenario.provider, evaluator.evaluate)
  let party: PartyState = { characters, gil }

  for (const recommendation of recommender.recommendPlan(party, scenario.town)) {
    if (recommendation.kind === "take-action") {
      party = applyAction(party, recommendation.action)
    }
  }

  return party
}

function character(id: string, baseClass: string): CharacterState {
  return {
    id,
    baseClass,
    promoted: false,
    equipment: {},
    learnedSpells: new Set(),
  }
}

function duplicatedSpells(party: PartyState): readonly string[] {
  const counts = new Map<string, number>()
  for (const character of party.characters) {
    for (const spell of character.learnedSpells) {
      counts.set(spell, (counts.get(spell) ?? 0) + 1)
    }
  }

  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([spell]) => spell)
    .sort()
}

function assertThreeSpellsPerLevel(
  party: PartyState,
  magicDefinitions: readonly MagicDefinition[],
): void {
  const levelBySpell = new Map(magicDefinitions.map((magic) => [magic.key, magic.level]))
  for (const character of party.characters) {
    const counts = new Map<number, number>()
    for (const spell of character.learnedSpells) {
      const level = levelBySpell.get(spell)!
      counts.set(level, (counts.get(level) ?? 0) + 1)
    }
    assert([...counts.values()].every((count) => count <= 3))
  }
}
