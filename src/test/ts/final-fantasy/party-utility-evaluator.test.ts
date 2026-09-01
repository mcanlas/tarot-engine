import assert from "node:assert/strict"
import test from "node:test"

import type {
  CharacterState,
  MagicDefinition,
  NextAction,
  NextActionCatalog,
  PartyState,
} from "../../../main/ts/final-fantasy/next-action-provider.ts"
import {
  NextActionRecommender,
} from "../../../main/ts/final-fantasy/next-action-recommender.ts"
import {
  defaultPartyUtilityPolicy,
  PartyUtilityEvaluator,
} from "../../../main/ts/final-fantasy/party-utility-evaluator.ts"
import type { TownDefinition } from "../../../main/ts/final-fantasy/towns.ts"

const catalog: NextActionCatalog = {
  equipment: [
    {
      key: "nunchaku",
      name: "Nunchaku",
      slot: "weapon",
      price: 8,
      attack: 12,
      accuracy: 0,
      criticalRate: 10,
      canEquip: ["monk"],
    },
    {
      key: "staff",
      name: "Staff",
      slot: "weapon",
      price: 4,
      attack: 6,
      accuracy: 0,
      criticalRate: 1,
      canEquip: ["monk"],
    },
    {
      key: "rapier",
      name: "Rapier",
      slot: "weapon",
      price: 8,
      attack: 9,
      accuracy: 5,
      criticalRate: 10,
      canEquip: ["warrior"],
    },
    {
      key: "hammer",
      name: "Hammer",
      slot: "weapon",
      price: 8,
      attack: 9,
      accuracy: 0,
      criticalRate: 1,
      canEquip: ["warrior"],
    },
    {
      key: "chain-mail",
      name: "Chain Mail",
      slot: "body",
      price: 65,
      defense: 15,
      weight: 15,
      canEquip: ["warrior"],
    },
    {
      key: "leather-armor",
      name: "Leather Armor",
      slot: "body",
      price: 40,
      defense: 4,
      weight: 8,
      canEquip: ["monk"],
    },
    {
      key: "buckler",
      name: "Buckler",
      slot: "shield",
      price: 12,
      defense: 2,
      weight: 0,
      canEquip: ["monk"],
    },
    {
      key: "leather-cap",
      name: "Leather Cap",
      slot: "head",
      price: 65,
      defense: 1,
      weight: 1,
      canEquip: ["monk"],
    },
    {
      key: "gloves",
      name: "Gloves",
      slot: "arms",
      price: 50,
      defense: 1,
      weight: 1,
      canEquip: ["monk"],
    },
  ],
  magic: [
    magic("cure", "white", "single-ally", { kind: "restore-hp", potency: 16 }),
    magic("dia", "white", "all-enemies", {
      kind: "damage",
      potency: 20,
      accuracy: 24,
      targetFamily: "undead",
    }),
    magic("protect", "white", "single-ally", { kind: "raise-defense", potency: 8 }),
    magic("blink", "white", "self", { kind: "raise-evasion", potency: 80 }, 2),
    magic("fire", "black", "single-enemy", {
      kind: "damage",
      potency: 10,
      accuracy: 24,
      element: "fire",
    }, 2),
    magic("sleep", "black", "all-enemies", {
      kind: "inflict-status",
      status: "sleep",
      accuracy: 24,
    }, 2),
    magic("focus", "black", "single-enemy", {
      kind: "lower-evasion",
      potency: 20,
      accuracy: 64,
    }, 3),
    magic("temper", "black", "single-ally", { kind: "raise-attack", potency: 14 }, 2),
  ],
}
const town: TownDefinition = { key: "cornelia", name: "Cornelia", shops: [] }
const rapierAction: NextAction = {
  kind: "bind-equipment",
  characterId: "fighter",
  item: "rapier",
  slot: "weapon",
  price: 8,
}
const fireAction: NextAction = {
  kind: "learn-spell",
  characterId: "fighter",
  spell: "fire",
  price: 50,
}
const nunchakuAction: NextAction = {
  kind: "bind-equipment",
  characterId: "monk",
  item: "nunchaku",
  slot: "weapon",
  price: 8,
}
const staffAction: NextAction = {
  kind: "bind-equipment",
  characterId: "monk",
  item: "staff",
  slot: "weapon",
  price: 4,
}
const leatherArmorAction: NextAction = {
  kind: "bind-equipment",
  characterId: "monk",
  item: "leather-armor",
  slot: "body",
  price: 40,
}
const monkEquipmentActions: readonly NextAction[] = [
  nunchakuAction,
  staffAction,
  leatherArmorAction,
  {
    kind: "bind-equipment",
    characterId: "monk",
    item: "buckler",
    slot: "shield",
    price: 12,
  },
  {
    kind: "bind-equipment",
    characterId: "monk",
    item: "leather-cap",
    slot: "head",
    price: 65,
  },
  {
    kind: "bind-equipment",
    characterId: "monk",
    item: "gloves",
    slot: "arms",
    price: 50,
  },
]

const character = (
  id: string,
  overrides: Partial<CharacterState> = {},
): CharacterState => ({
  id,
  baseClass: "warrior",
  promoted: false,
  equipment: {},
  learnedSpells: new Set(),
  ...overrides,
})

test("exposes an explicit default policy", () => {
  assert.equal(defaultPartyUtilityPolicy.weaponAttack, 4)
  assert.equal(defaultPartyUtilityPolicy.weaponAccuracy, 1)
  assert.equal(defaultPartyUtilityPolicy.weaponCriticalRate, 1)
  assert.equal(defaultPartyUtilityPolicy.armorDefense, 4)
  assert.equal(defaultPartyUtilityPolicy.armorWeightPenalty, 1)
  assert(defaultPartyUtilityPolicy.excludedEquipmentKeys.has("nunchaku"))
  assert.equal(defaultPartyUtilityPolicy.monkEquipmentMultiplier, 0)
  assert.equal(defaultPartyUtilityPolicy.spellEffect.damage, 20)
  assert.equal(defaultPartyUtilityPolicy.spellEffect.revive, 100)
  assert.equal(defaultPartyUtilityPolicy.spellEffect["multiply-attack-count"], 60)
  assert.equal(defaultPartyUtilityPolicy.spellEffect["increase-flee"], 0)
  assert.equal(defaultPartyUtilityPolicy.spellEffect["exit-dungeon"], 0)
  assert.equal(defaultPartyUtilityPolicy.spellEffect["teleport-floor"], 0)
  assert.equal(defaultPartyUtilityPolicy.spellPotency["restore-hp"], 1)
  assert.equal(defaultPartyUtilityPolicy.spellPotency["raise-defense"], 2)
  assert.equal(defaultPartyUtilityPolicy.spellPotency["raise-evasion"], 0.125)
  assert.equal(defaultPartyUtilityPolicy.spellAccuracy, 0.125)
  assert.equal(defaultPartyUtilityPolicy.allEnemiesBonus, 10)
  assert.equal(defaultPartyUtilityPolicy.restrictedTargetPenalty, 10)
  assert.equal(defaultPartyUtilityPolicy.firstPartyCapabilityBonus, 15)
  assert.equal(defaultPartyUtilityPolicy.specialistRoleMultiplier, 1.15)
  assert.equal(defaultPartyUtilityPolicy.coveredRedMageMultiplier, 0.75)
  assert.equal(defaultPartyUtilityPolicy.duplicateDamageMultiplier, 0.5)
  assert.equal(defaultPartyUtilityPolicy.duplicateRecoveryMultiplier, 0.6)
  assert.equal(defaultPartyUtilityPolicy.duplicateSupportMultiplier, 0.15)
  assert.equal(defaultPartyUtilityPolicy.attackBuffPhysicalTargetMultiplier, 0.8)
  assert.equal(defaultPartyUtilityPolicy.attackBuffUnarmedMonkTargetMultiplier, 1)
  assert.equal(defaultPartyUtilityPolicy.attackBuffHybridTargetMultiplier, 0.75)
  assert.equal(defaultPartyUtilityPolicy.attackBuffNoTargetMultiplier, 0)
  assert.equal(defaultPartyUtilityPolicy.instantDeathMultiplier, 0.15)
  assert.equal(defaultPartyUtilityPolicy.maximumTargetHpMultiplier, 0.5)
  assert(defaultPartyUtilityPolicy.bossIndependentZeroEffects.has("exit-dungeon"))
  assert.deepEqual(defaultPartyUtilityPolicy.spellSlotOpportunityCosts, [0, 8, 28])
})

test("scores a character with empty equipment and spells at zero", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([character("fighter")])),
    { total: 0, components: [] },
  )
})

test("scores weapon attack, accuracy, and critical rate with inspectable reasons", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([
      character("fighter", { equipment: { weapon: "rapier" } }),
    ])),
    {
      total: 51,
      components: [{
        key: "fighter:equipment:weapon",
        value: 51,
        reason: "Rapier weapon attack 9*4 + accuracy 5*1 + critical rate 10*1",
      }],
    },
  )
})

test("scores armor defense against its weight penalty", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([
      character("fighter", { equipment: { body: "chain-mail" } }),
    ])),
    {
      total: 45,
      components: [{
        key: "fighter:equipment:body",
        value: 45,
        reason: "Chain Mail armor defense 15*4 - weight 15*1",
      }],
    },
  )
})

test("keeps Monks item-free and excludes Nunchaku from recommendations", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)
  const monk = character("monk", { baseClass: "monk" })
  const recommender = new NextActionRecommender({
    availableActions: () => monkEquipmentActions,
  }, evaluator.evaluate)

  assert.deepEqual(recommender.recommend(party([monk]), town), {
    kind: "stop",
    reason: "no-positive-action",
    scoreDelta: 0,
  })
  assert.deepEqual(
    evaluator.evaluate(party([character("monk", {
      baseClass: "monk",
      equipment: { weapon: "nunchaku" },
    })])).components,
    [{
      key: "monk:equipment:weapon",
      value: 0,
      reason: "Nunchaku weapon attack 12*4 + accuracy 0*1 + critical rate 10*1; excluded from recommendations",
    }],
  )
  assert.deepEqual(
    evaluator.evaluate(party([character("monk", {
      baseClass: "monk",
      equipment: {
        body: "leather-armor",
        shield: "buckler",
        head: "leather-cap",
        arms: "gloves",
      },
    })])).components,
    [
      {
        key: "monk:equipment:body",
        value: 0,
        reason: "Leather Armor armor defense 4*4 - weight 8*1; Monk item-free multiplier 0",
      },
      {
        key: "monk:equipment:shield",
        value: 0,
        reason: "Buckler armor defense 2*4 - weight 0*1; Monk item-free multiplier 0",
      },
      {
        key: "monk:equipment:head",
        value: 0,
        reason: "Leather Cap armor defense 1*4 - weight 1*1; Monk item-free multiplier 0",
      },
      {
        key: "monk:equipment:arms",
        value: 0,
        reason: "Gloves armor defense 1*4 - weight 1*1; Monk item-free multiplier 0",
      },
    ],
  )
})

test("scores every magic effect shape and target modifier", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([
      character("mage", {
        learnedSpells: new Set(["cure", "dia", "protect", "blink", "fire", "sleep", "focus"]),
      }),
    ])),
    {
      total: 307,
      components: [
        {
          key: "mage:magic:cure",
          value: 69,
          reason: "cure restore-hp base 50; potency 16*1; first party capability bonus 15; level 1 slots 3/3; opportunity cost 12",
        },
        {
          key: "mage:magic:dia",
          value: 46,
          reason: "dia damage base 20; potency 20*1; accuracy 24*0.125; all-enemies bonus 10; undead restriction -10; first party capability bonus 15; level 1 slots 3/3; opportunity cost 12",
        },
        {
          key: "mage:magic:protect",
          value: 44,
          reason: "protect raise-defense base 25; potency 8*2; first party capability bonus 15; level 1 slots 3/3; opportunity cost 12",
        },
        {
          key: "mage:magic:blink",
          value: 33,
          reason: "blink raise-evasion base 20; potency 80*0.125; first party capability bonus 15; level 2 slots 3/3; opportunity cost 12",
        },
        {
          key: "mage:magic:fire",
          value: 36,
          reason: "fire damage base 20; potency 10*1; accuracy 24*0.125; first party capability bonus 15; level 2 slots 3/3; opportunity cost 12",
        },
        {
          key: "mage:magic:sleep",
          value: 41,
          reason: "sleep inflict-status base 25; accuracy 24*0.125; all-enemies bonus 10; first party capability bonus 15; level 2 slots 3/3; opportunity cost 12",
        },
        {
          key: "mage:magic:focus",
          value: 38,
          reason: "focus lower-evasion base 5; potency 20*0.5; accuracy 64*0.125; first party capability bonus 15; level 3 slots 1/3; opportunity cost 0",
        },
      ],
    },
  )
})

test("discounts constrained status magic and zeroes exploration-only effects", () => {
  const constrainedCatalog: NextActionCatalog = {
    equipment: [],
    magic: [
      magic("death", "black", "single-enemy", {
        kind: "inflict-status",
        status: "death",
        accuracy: 32,
      }, 6),
      magic("stun", "black", "single-enemy", {
        kind: "inflict-status",
        status: "paralysis",
        accuracy: 64,
        maximumTargetHp: 300,
      }, 6),
      magic("exit", "white", "party", { kind: "exit-dungeon" }, 6),
    ],
  }
  const evaluator = new PartyUtilityEvaluator(constrainedCatalog)
  const score = evaluator.evaluate(party([
    character("mage", { learnedSpells: new Set(["death", "stun", "exit"]) }),
  ]))

  assert.equal(score.components.find((component) => component.key.endsWith(":death"))?.value, -5.4)
  assert.equal(score.components.find((component) => component.key.endsWith(":stun"))?.value, 12)
  assert.equal(score.components.find((component) => component.key.endsWith(":exit"))?.value, 0)
  assert.match(
    score.components.find((component) => component.key.endsWith(":death"))!.reason,
    /instant-death reliability multiplier 0\.15/,
  )
  assert.match(
    score.components.find((component) => component.key.endsWith(":stun"))!.reason,
    /target HP <= 300 multiplier 0\.5/,
  )
  assert.match(
    score.components.find((component) => component.key.endsWith(":exit"))!.reason,
    /no boss-independent combat utility/,
  )
})

test("rewards first-party coverage and strongly diminishes duplicate control", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([
      character("first", { learnedSpells: new Set(["sleep"]) }),
      character("second", { learnedSpells: new Set(["sleep"]) }),
    ])),
    {
      total: 58.7,
      components: [
        {
          key: "first:magic:sleep",
          value: 53,
          reason: "sleep inflict-status base 25; accuracy 24*0.125; all-enemies bonus 10; first party capability bonus 15; level 2 slots 1/3; opportunity cost 0",
        },
        {
          key: "second:magic:sleep",
          value: 5.7,
          reason: "sleep inflict-status base 25; accuracy 24*0.125; all-enemies bonus 10; duplicate support/control multiplier 0.15; level 2 slots 1/3; opportunity cost 0",
        },
      ],
    },
  )
})

test("gives specialists responsibility before a Red Mage when that school is covered", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)
  const score = evaluator.evaluate(party([
    character("red", { baseClass: "red-mage", learnedSpells: new Set(["fire"]) }),
    character("black", { baseClass: "black-mage", learnedSpells: new Set(["fire"]) }),
  ]))

  assert.deepEqual(score.components, [
    {
      key: "red:magic:fire",
      value: 12.375,
      reason: "fire damage base 20; potency 10*1; accuracy 24*0.125; Red Mage shared responsibility multiplier 0.75; duplicate damage multiplier 0.5; level 2 slots 1/3; opportunity cost 0",
    },
    {
      key: "black:magic:fire",
      value: 52.949999999999996,
      reason: "fire damage base 20; potency 10*1; accuracy 24*0.125; school specialist multiplier 1.15; first party capability bonus 15; level 2 slots 1/3; opportunity cost 0",
    },
  ])
})

test("rates Temper by its best actual physical recipient", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)
  const temperScore = (characters: readonly CharacterState[]): number =>
    evaluator.evaluate(party(characters)).components
      .find(({ key }) => key === "caster:magic:temper")!.value
  const caster = character("caster", {
    baseClass: "black-mage",
    learnedSpells: new Set(["temper"]),
  })

  const noTarget = temperScore([caster])
  const redMageTarget = temperScore([caster, character("red", { baseClass: "red-mage" })])
  const warriorTarget = temperScore([caster, character("warrior")])
  const thiefTarget = temperScore([caster, character("thief", { baseClass: "thief" })])
  const unarmedMonkTarget = temperScore([caster, character("monk", { baseClass: "monk" })])

  assert.equal(noTarget, 0)
  assert.equal(redMageTarget, 65.58749999999999)
  assert.equal(warriorTarget, 69.96)
  assert.equal(thiefTarget, warriorTarget)
  assert.equal(unarmedMonkTarget, 87.44999999999999)
})

test("rejects equipment and spells absent from the supplied catalog", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.throws(
    () => evaluator.evaluate(party([
      character("fighter", { equipment: { weapon: "masamune" } }),
    ])),
    /Unknown Final Fantasy equipment state key: masamune/,
  )
  assert.throws(
    () => evaluator.evaluate(party([
      character("fighter", { learnedSpells: new Set(["flare"]) }),
    ])),
    /Unknown Final Fantasy magic state key: flare/,
  )
  assert.throws(
    () => evaluator.evaluate(party([
      character("fighter", { equipment: { body: "rapier" } }),
    ])),
    /Final Fantasy equipment state key rapier does not match slot body/,
  )
})

test("drives NextActionRecommender from real catalog mechanics without a fixture evaluator", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)
  const recommender = new NextActionRecommender({
    availableActions: () => [fireAction, rapierAction],
  }, evaluator.evaluate)

  assert.deepEqual(
    recommender.recommend(party([character("fighter")]), town),
    {
      kind: "take-action",
      action: rapierAction,
      scoreDelta: 51,
      components: [{
        key: "fighter:equipment:weapon",
        value: 51,
        reason: "Rapier weapon attack 9*4 + accuracy 5*1 + critical rate 10*1",
      }],
    },
  )
})

function party(characters: readonly CharacterState[]): PartyState {
  return { characters, gil: 1_000 }
}

function magic(
  key: string,
  school: MagicDefinition["school"],
  target: MagicDefinition["target"],
  effect: MagicDefinition["effect"],
  level = 1,
): MagicDefinition {
  return { key, name: key, school, level, price: 50, target, effect }
}
