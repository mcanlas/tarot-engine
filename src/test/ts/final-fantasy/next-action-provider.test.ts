import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parse } from "yaml"

import {
  NextActionProvider,
  type CharacterState,
  type EquipmentDefinition,
  type MagicDefinition,
  type NextAction,
  type NextActionCatalog,
  type PartyState,
} from "../../../main/ts/final-fantasy/next-action-provider.ts"
import {
  type StrategyCatalog,
} from "../../../main/ts/final-fantasy/strategy-core.ts"
import {
  loadStrategyCatalog,
} from "../../../main/ts/final-fantasy/strategy-data.ts"
import {
  loadTowns,
  type TownDefinition,
} from "../../../main/ts/final-fantasy/towns.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

const character = (
  id: string,
  baseClass: string,
  overrides: Partial<CharacterState> = {},
): CharacterState => ({
  id,
  baseClass,
  promoted: false,
  equipment: {},
  learnedSpells: new Set(),
  ...overrides,
})

const party = (
  characters: readonly CharacterState[],
  gil = 100,
): PartyState => ({ characters, gil })

interface LoadedProvider {
  readonly catalog: StrategyCatalog
  readonly actionCatalog: NextActionCatalog
  readonly cornelia: TownDefinition
  readonly provider: NextActionProvider
}

async function loadProvider(): Promise<LoadedProvider> {
  const [catalog, towns, itemText, magicText] = await Promise.all([
    loadStrategyCatalog(loadProjectFile),
    loadTowns(loadProjectFile),
    loadProjectFile("data/final-fantasy/items.yaml"),
    loadProjectFile("data/final-fantasy/magic.yaml"),
  ])
  const equipment = (parse(itemText) as { items: EquipmentDefinition[] }).items
  const magic = (parse(magicText) as { magic: MagicDefinition[] }).magic
  const actionCatalog = { equipment, magic }
  const cornelia = towns.towns[0]!

  return {
    catalog,
    actionCatalog,
    cornelia,
    provider: new NextActionProvider(catalog, actionCatalog),
  }
}

const actionKey = (action: NextAction): string =>
  action.kind === "learn-spell"
    ? `${action.characterId}:learn:${action.spell}`
    : `${action.characterId}:bind:${action.item}`

test("provides every legal Cornelia action for a mixed party", async () => {
  const { provider, cornelia } = await loadProvider()
  const actions = provider.availableActions(party([
    character("garland", "warrior"),
    character("sarah", "white-mage"),
    character("matoya", "black-mage"),
    character("bahamut", "monk"),
  ]), cornelia)

  assert.equal(actions.length, 25)
  assert.deepEqual(actions.map(actionKey), [
    "bahamut:bind:nunchaku",
    "garland:bind:knife",
    "matoya:bind:knife",
    "garland:bind:staff",
    "sarah:bind:staff",
    "matoya:bind:staff",
    "bahamut:bind:staff",
    "garland:bind:rapier",
    "garland:bind:hammer",
    "sarah:bind:hammer",
    "garland:bind:clothes",
    "sarah:bind:clothes",
    "matoya:bind:clothes",
    "bahamut:bind:clothes",
    "garland:bind:leather-armor",
    "bahamut:bind:leather-armor",
    "garland:bind:chain-mail",
    "sarah:learn:cure",
    "sarah:learn:dia",
    "sarah:learn:protect",
    "sarah:learn:blink",
    "matoya:learn:fire",
    "matoya:learn:sleep",
    "matoya:learn:focus",
    "matoya:learn:thunder",
  ])
})

test("loads Pixel Remaster combat stats for seeded weapons", async () => {
  const { actionCatalog } = await loadProvider()

  assert.deepEqual(
    actionCatalog.equipment
      .filter((equipment) => equipment.slot === "weapon")
      .map(({ key, attack, accuracy, criticalRate }) => ({
        key,
        attack,
        accuracy,
        criticalRate,
      })),
    [
      { key: "nunchaku", attack: 12, accuracy: 0, criticalRate: 1 },
      { key: "knife", attack: 5, accuracy: 10, criticalRate: 2 },
      { key: "staff", attack: 6, accuracy: 0, criticalRate: 3 },
      { key: "rapier", attack: 9, accuracy: 5, criticalRate: 4 },
      { key: "hammer", attack: 9, accuracy: 0, criticalRate: 5 },
      { key: "broadsword", attack: 15, accuracy: 10, criticalRate: 6 },
      { key: "battle-axe", attack: 16, accuracy: 5, criticalRate: 7 },
      { key: "scimitar", attack: 10, accuracy: 10, criticalRate: 8 },
      { key: "iron-nunchaku", attack: 16, accuracy: 0, criticalRate: 9 },
      { key: "dagger", attack: 7, accuracy: 10, criticalRate: 10 },
      { key: "crosier", attack: 14, accuracy: 0, criticalRate: 11 },
      { key: "saber", attack: 13, accuracy: 5, criticalRate: 12 },
    ],
  )
})

test("loads Pixel Remaster defense and weight for seeded armor", async () => {
  const { actionCatalog } = await loadProvider()

  assert.deepEqual(
    actionCatalog.equipment
      .filter((equipment) => equipment.slot !== "weapon")
      .map(({ key, defense, weight }) => ({ key, defense, weight })),
    [
      { key: "clothes", defense: 1, weight: 2 },
      { key: "leather-armor", defense: 4, weight: 8 },
      { key: "chain-mail", defense: 15, weight: 15 },
      { key: "iron-armor", defense: 24, weight: 23 },
      { key: "leather-shield", defense: 2, weight: 0 },
      { key: "gloves", defense: 1, weight: 1 },
      { key: "copper-armlet", defense: 4, weight: 1 },
      { key: "iron-shield", defense: 4, weight: 0 },
      { key: "leather-cap", defense: 1, weight: 1 },
      { key: "helm", defense: 3, weight: 3 },
    ],
  )
})

test("loads explicit seeded magic mechanics", async () => {
  const { actionCatalog } = await loadProvider()

  assert.deepEqual(
    actionCatalog.magic.map(({ key, target, effect }) => ({ key, target, effect })),
    [
      { key: "cure", target: "single-ally", effect: { kind: "restore-hp", potency: 16 } },
      {
        key: "dia",
        target: "all-enemies",
        effect: { kind: "damage", potency: 20, accuracy: 24, targetFamily: "undead" },
      },
      {
        key: "protect",
        target: "single-ally",
        effect: { kind: "raise-defense", potency: 8 },
      },
      { key: "blink", target: "self", effect: { kind: "raise-evasion", potency: 80 } },
      {
        key: "fire",
        target: "single-enemy",
        effect: { kind: "damage", potency: 10, accuracy: 24, element: "fire" },
      },
      {
        key: "sleep",
        target: "all-enemies",
        effect: { kind: "inflict-status", status: "sleep", accuracy: 24 },
      },
      {
        key: "focus",
        target: "single-enemy",
        effect: { kind: "lower-evasion", potency: 20, accuracy: 64 },
      },
      {
        key: "thunder",
        target: "single-enemy",
        effect: { kind: "damage", potency: 10, accuracy: 24, element: "lightning" },
      },
      {
        key: "blindna",
        target: "single-ally",
        effect: { kind: "cure-status", status: "darkness" },
      },
      {
        key: "silence",
        target: "all-enemies",
        effect: { kind: "inflict-status", status: "silence", accuracy: 24 },
      },
      {
        key: "nulshock",
        target: "all-allies",
        effect: { kind: "raise-resistance", element: "lightning" },
      },
      {
        key: "invis",
        target: "single-ally",
        effect: { kind: "raise-evasion", potency: 40 },
      },
      {
        key: "blizzard",
        target: "single-enemy",
        effect: { kind: "damage", potency: 20, accuracy: 24, element: "ice" },
      },
      {
        key: "dark",
        target: "all-enemies",
        effect: { kind: "inflict-status", status: "darkness", accuracy: 24 },
      },
      {
        key: "temper",
        target: "single-ally",
        effect: { kind: "raise-attack", potency: 14 },
      },
      {
        key: "slow",
        target: "all-enemies",
        effect: { kind: "lower-attack-count", accuracy: 64 },
      },
      { key: "cura", target: "single-ally", effect: { kind: "restore-hp", potency: 33 } },
      {
        key: "diara",
        target: "all-enemies",
        effect: { kind: "damage", potency: 40, accuracy: 24, targetFamily: "undead" },
      },
      {
        key: "nulblaze",
        target: "all-allies",
        effect: { kind: "raise-resistance", element: "fire" },
      },
      { key: "heal", target: "all-allies", effect: { kind: "restore-hp", potency: 12 } },
      {
        key: "fira",
        target: "all-enemies",
        effect: { kind: "damage", potency: 30, accuracy: 24, element: "fire" },
      },
      {
        key: "hold",
        target: "single-enemy",
        effect: { kind: "inflict-status", status: "paralysis", accuracy: 64 },
      },
      {
        key: "thundara",
        target: "all-enemies",
        effect: { kind: "damage", potency: 30, accuracy: 24, element: "lightning" },
      },
      {
        key: "focara",
        target: "all-enemies",
        effect: { kind: "lower-evasion", potency: 20, accuracy: 64 },
      },
      {
        key: "poisona",
        target: "single-ally",
        effect: { kind: "cure-status", status: "poison" },
      },
      { key: "fear", target: "all-enemies", effect: { kind: "increase-flee" } },
      {
        key: "nulfrost",
        target: "all-allies",
        effect: { kind: "raise-resistance", element: "ice" },
      },
      {
        key: "vox",
        target: "single-ally",
        effect: { kind: "cure-status", status: "silence" },
      },
      {
        key: "sleepra",
        target: "single-enemy",
        effect: { kind: "inflict-status", status: "sleep", accuracy: 64 },
      },
      {
        key: "haste",
        target: "single-ally",
        effect: { kind: "multiply-attack-count", factor: 2 },
      },
      {
        key: "confuse",
        target: "all-enemies",
        effect: { kind: "inflict-status", status: "confusion", accuracy: 64 },
      },
      {
        key: "blizzara",
        target: "all-enemies",
        effect: { kind: "damage", potency: 40, accuracy: 24, element: "ice" },
      },
      { key: "life", target: "single-ally", effect: { kind: "restore-hp", potency: 1 } },
      {
        key: "protera",
        target: "all-allies",
        effect: { kind: "raise-defense", potency: 20 },
      },
      {
        key: "invisira",
        target: "all-allies",
        effect: { kind: "raise-evasion", potency: 60 },
      },
      {
        key: "nuldeath",
        target: "all-allies",
        effect: { kind: "raise-evasion", potency: 30 },
      },
      { key: "saber", target: "self", effect: { kind: "raise-attack", potency: 20 } },
      {
        key: "flare",
        target: "single-enemy",
        effect: { kind: "damage", potency: 60, accuracy: 24 },
      },
    ],
  )
})

test("provides every Elfheim level 3 and 4 spell to eligible specialists", async () => {
  const { provider } = await loadProvider()
  const towns = await loadTowns(loadProjectFile)
  const elfheim = towns.towns.find((town) => town.key === "elfheim")!
  const actions = provider.availableActions(party([
    character("white", "white-mage"),
    character("black", "black-mage"),
  ], 10_000), elfheim)

  assert.deepEqual(actions.filter((action) => action.kind === "learn-spell").map(actionKey), [
    "white:learn:cura",
    "white:learn:diara",
    "white:learn:nulblaze",
    "white:learn:heal",
    "white:learn:poisona",
    "white:learn:fear",
    "white:learn:nulfrost",
    "white:learn:vox",
    "black:learn:fira",
    "black:learn:hold",
    "black:learn:thundara",
    "black:learn:focara",
    "black:learn:sleepra",
    "black:learn:haste",
    "black:learn:confuse",
    "black:learn:blizzara",
  ])
})

test("resolves promotion independently from a character's base class", async () => {
  const { provider, cornelia } = await loadProvider()
  const novice = character("bikke", "thief")
  const ninja = character("bikke", "thief", { promoted: true })

  assert.deepEqual(
    provider.availableActions(party([novice]), cornelia).map(actionKey),
    [
      "bikke:bind:knife",
      "bikke:bind:rapier",
      "bikke:bind:clothes",
      "bikke:bind:leather-armor",
    ],
  )
  assert.deepEqual(
    provider.availableActions(party([ninja]), cornelia).map(actionKey),
    [
      "bikke:bind:nunchaku",
      "bikke:bind:knife",
      "bikke:bind:staff",
      "bikke:bind:rapier",
      "bikke:bind:hammer",
      "bikke:bind:clothes",
      "bikke:bind:leather-armor",
      "bikke:bind:chain-mail",
      "bikke:learn:fire",
      "bikke:learn:sleep",
      "bikke:learn:focus",
      "bikke:learn:thunder",
    ],
  )
})

test("excludes full spell levels and existing equipment bindings", async () => {
  const { provider, cornelia } = await loadProvider()
  const mage = character("astos", "black-mage", {
    equipment: { weapon: "knife" },
    learnedSpells: new Set(["fire", "sleep", "focus"]),
  })

  assert.deepEqual(provider.availableActions(party([mage]), cornelia), [
    {
      kind: "bind-equipment",
      characterId: "astos",
      item: "staff",
      slot: "weapon",
      price: 4,
      replaces: "knife",
    },
    {
      kind: "bind-equipment",
      characterId: "astos",
      item: "clothes",
      slot: "body",
      price: 8,
    },
  ])
})

test("only returns individually affordable actions", async () => {
  const { provider, cornelia } = await loadProvider()

  assert.deepEqual(
    provider.availableActions(party([character("astos", "black-mage")], 4), cornelia)
      .map(actionKey),
    ["astos:bind:knife", "astos:bind:staff"],
  )
})

test("rejects invalid party state", async () => {
  const { actionCatalog, catalog, provider, cornelia } = await loadProvider()
  const duplicate = character("same", "warrior")

  assert.throws(
    () => provider.availableActions(party([]), cornelia),
    /must contain 1 to 4 characters/,
  )
  assert.throws(
    () => provider.availableActions(party(Array.from(
      { length: 5 },
      (_, index) => character(String(index), "warrior"),
    )), cornelia),
    /must contain 1 to 4 characters/,
  )
  assert.throws(
    () => provider.availableActions(party([duplicate, duplicate]), cornelia),
    /character IDs must be unique/,
  )
  assert.throws(
    () => provider.availableActions(party([character("garland", "warrior")], -1), cornelia),
    /gil must be a non-negative finite number/,
  )
  assert.throws(
    () => provider.availableActions(party([character("garland", "warrior")], Infinity), cornelia),
    /gil must be a non-negative finite number/,
  )
  assert.throws(
    () => provider.availableActions(party([character("sarah", "white-wizard")]), cornelia),
    /must have an unpromoted base class/,
  )

  const catalogWithoutNinja = {
    ...catalog,
    jobs: new Map([...catalog.jobs].filter(([key]) => key !== "ninja")),
  }
  const missingPromotionProvider = new NextActionProvider(
    catalogWithoutNinja,
    actionCatalog,
  )
  assert.throws(
    () => missingPromotionProvider.availableActions(
      party([character("bikke", "thief", { promoted: true })]),
      cornelia,
    ),
    /Unknown promotion for thief: ninja/,
  )
})

test("rejects inconsistent action catalogs and town wares", async () => {
  const { catalog, actionCatalog, cornelia } = await loadProvider()

  assert.throws(
    () => new NextActionProvider(catalog, {
      ...actionCatalog,
      equipment: [actionCatalog.equipment[0]!, actionCatalog.equipment[0]!],
    }),
    /Duplicate Final Fantasy equipment key: nunchaku/,
  )
  assert.throws(
    () => new NextActionProvider(catalog, {
      ...actionCatalog,
      magic: [actionCatalog.magic[0]!, actionCatalog.magic[0]!],
    }),
    /Duplicate Final Fantasy magic key: cure/,
  )
  assert.throws(
    () => new NextActionProvider(catalog, {
      ...actionCatalog,
      equipment: actionCatalog.equipment.map((equipment) =>
        equipment.key === "nunchaku" ? { ...equipment, attack: -1 } : equipment,
      ),
    }),
    /nunchaku attack must be a non-negative integer/,
  )
  assert.throws(
    () => new NextActionProvider(catalog, {
      ...actionCatalog,
      equipment: actionCatalog.equipment.map((equipment) =>
        equipment.key === "clothes" ? { ...equipment, weight: -1 } : equipment,
      ),
    }),
    /clothes weight must be a non-negative integer/,
  )
  assert.throws(
    () => new NextActionProvider(catalog, {
      ...actionCatalog,
      magic: actionCatalog.magic.map((magic) =>
        magic.key === "fire"
          ? { ...magic, effect: { ...magic.effect, accuracy: -1 } }
          : magic,
      ) as MagicDefinition[],
    }),
    /fire accuracy must be a non-negative integer/,
  )

  const warrior = party([character("garland", "warrior")])
  const equipmentProvider = new NextActionProvider(catalog, {
    ...actionCatalog,
    equipment: actionCatalog.equipment.filter((item) => item.key !== "nunchaku"),
  })
  assert.throws(
    () => equipmentProvider.availableActions(warrior, cornelia),
    /weapons ware nunchaku is missing matching equipment data/,
  )

  const magicProvider = new NextActionProvider(catalog, {
    ...actionCatalog,
    magic: actionCatalog.magic.map((magic) =>
      magic.key === "cure" ? { ...magic, school: "black" as const } : magic,
    ),
  })
  assert.throws(
    () => magicProvider.availableActions(warrior, cornelia),
    /white-magic ware cure is missing matching magic data/,
  )

  const catalogWithoutFocus = {
    ...catalog,
    spells: new Map([...catalog.spells].filter(([key]) => key !== "focus")),
  }
  const spellProvider = new NextActionProvider(catalogWithoutFocus, actionCatalog)
  assert.throws(
    () => spellProvider.availableActions(warrior, cornelia),
    /Magic focus is missing from the Final Fantasy spell catalog/,
  )
})
