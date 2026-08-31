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
    magic("blink", "white", "self", { kind: "raise-evasion", potency: 80 }),
    magic("fire", "black", "single-enemy", {
      kind: "damage",
      potency: 10,
      accuracy: 24,
      element: "fire",
    }),
    magic("sleep", "black", "all-enemies", {
      kind: "inflict-status",
      status: "sleep",
      accuracy: 24,
    }),
    magic("focus", "black", "single-enemy", {
      kind: "lower-evasion",
      potency: 20,
      accuracy: 64,
    }),
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
  assert.equal(defaultPartyUtilityPolicy.spellEffect.damage, 20)
  assert.equal(defaultPartyUtilityPolicy.spellPotency["restore-hp"], 1)
  assert.equal(defaultPartyUtilityPolicy.spellPotency["raise-defense"], 2)
  assert.equal(defaultPartyUtilityPolicy.spellPotency["raise-evasion"], 0.125)
  assert.equal(defaultPartyUtilityPolicy.spellAccuracy, 0.125)
  assert.equal(defaultPartyUtilityPolicy.allEnemiesBonus, 10)
  assert.equal(defaultPartyUtilityPolicy.restrictedTargetPenalty, 10)
  assert.equal(defaultPartyUtilityPolicy.duplicateCapabilityMultiplier, 0.5)
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

test("scores every magic effect shape and target modifier", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([
      character("mage", {
        learnedSpells: new Set(["cure", "dia", "protect", "blink", "fire", "sleep", "focus"]),
      }),
    ])),
    {
      total: 274,
      components: [
        {
          key: "mage:magic:cure",
          value: 66,
          reason: "cure restore-hp base 50; potency 16*1",
        },
        {
          key: "mage:magic:dia",
          value: 43,
          reason: "dia damage base 20; potency 20*1; accuracy 24*0.125; all-enemies bonus 10; undead restriction -10",
        },
        {
          key: "mage:magic:protect",
          value: 41,
          reason: "protect raise-defense base 25; potency 8*2",
        },
        {
          key: "mage:magic:blink",
          value: 30,
          reason: "blink raise-evasion base 20; potency 80*0.125",
        },
        {
          key: "mage:magic:fire",
          value: 33,
          reason: "fire damage base 20; potency 10*1; accuracy 24*0.125",
        },
        {
          key: "mage:magic:sleep",
          value: 38,
          reason: "sleep inflict-status base 25; accuracy 24*0.125; all-enemies bonus 10",
        },
        {
          key: "mage:magic:focus",
          value: 23,
          reason: "focus lower-evasion base 5; potency 20*0.5; accuracy 64*0.125",
        },
      ],
    },
  )
})

test("diminishes duplicate capabilities across different party members", () => {
  const evaluator = new PartyUtilityEvaluator(catalog)

  assert.deepEqual(
    evaluator.evaluate(party([
      character("black-mage", { learnedSpells: new Set(["fire"]) }),
      character("black-wizard", { learnedSpells: new Set(["fire"]) }),
    ])),
    {
      total: 49.5,
      components: [
        {
          key: "black-mage:magic:fire",
          value: 33,
          reason: "fire damage base 20; potency 10*1; accuracy 24*0.125",
        },
        {
          key: "black-wizard:magic:fire",
          value: 16.5,
          reason: "fire damage base 20; potency 10*1; accuracy 24*0.125; duplicate capability multiplier 0.5",
        },
      ],
    },
  )
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
): MagicDefinition {
  return { key, name: key, school, level: 1, price: 50, target, effect }
}
