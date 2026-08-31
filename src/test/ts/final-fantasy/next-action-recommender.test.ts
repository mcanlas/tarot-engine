import assert from "node:assert/strict"
import test from "node:test"

import {
  applyAction,
  NextActionRecommender,
  type PartyEvaluator,
} from "../../../main/ts/final-fantasy/next-action-recommender.ts"
import type {
  CharacterState,
  NextAction,
  PartyState,
} from "../../../main/ts/final-fantasy/next-action-provider.ts"
import type { TownDefinition } from "../../../main/ts/final-fantasy/towns.ts"

const character = (id: string): CharacterState => ({
  id,
  baseClass: "warrior",
  promoted: false,
  equipment: {},
  learnedSpells: new Set(),
})

const town: TownDefinition = { key: "cornelia", name: "Cornelia", shops: [] }
const evaluate: PartyEvaluator = () => ({ total: 0, components: [] })
const knifeAction: NextAction = {
  kind: "bind-equipment",
  characterId: "fighter",
  item: "knife",
  slot: "weapon",
  price: 4,
}
const rapierAction: NextAction = {
  kind: "bind-equipment",
  characterId: "fighter",
  item: "rapier",
  slot: "weapon",
  price: 8,
}
const staffAction: NextAction = {
  kind: "bind-equipment",
  characterId: "fighter",
  item: "staff",
  slot: "weapon",
  price: 4,
}
const cureAction: NextAction = {
  kind: "learn-spell",
  characterId: "fighter",
  spell: "cure",
  price: 50,
}

test("applies equipment without mutating the prior party", () => {
  const initial: PartyState = { characters: [character("fighter")], gil: 100 }
  const next = applyAction(initial, {
    kind: "bind-equipment",
    characterId: "fighter",
    item: "rapier",
    slot: "weapon",
    price: 8,
  })

  assert.deepEqual(initial.characters[0]!.equipment, {})
  assert.equal(initial.gil, 100)
  assert.deepEqual(next.characters[0]!.equipment, { weapon: "rapier" })
  assert.equal(next.gil, 92)
})

test("applies spell learning without mutating the prior set", () => {
  const initial: PartyState = { characters: [character("mage")], gil: 100 }
  const next = applyAction(initial, {
    kind: "learn-spell",
    characterId: "mage",
    spell: "cure",
    price: 50,
  })

  assert.deepEqual([...initial.characters[0]!.learnedSpells], [])
  assert.deepEqual([...next.characters[0]!.learnedSpells], ["cure"])
  assert.equal(next.gil, 50)
})

test("rejects unaffordable actions and unknown characters", () => {
  const initial: PartyState = { characters: [character("fighter")], gil: 4 }

  assert.throws(
    () => applyAction(initial, {
      kind: "bind-equipment",
      characterId: "fighter",
      item: "rapier",
      slot: "weapon",
      price: 8,
    }),
    /unaffordable Final Fantasy action/,
  )
  assert.throws(
    () => applyAction(initial, {
      kind: "bind-equipment",
      characterId: "missing",
      item: "knife",
      slot: "weapon",
      price: 4,
    }),
    /Unknown Final Fantasy action character: missing/,
  )
})

test("stops explicitly when the legal action provider is empty", () => {
  const provider = {
    availableActions: () => [],
  }
  const recommender = new NextActionRecommender(provider, evaluate)

  assert.deepEqual(
    recommender.recommend({ characters: [character("fighter")], gil: 100 }, town),
    { kind: "stop", reason: "no-legal-action", scoreDelta: 0 },
  )
})

test("chooses the legal action with the greatest positive marginal score", () => {
  const provider = {
    availableActions: () => [knifeAction, rapierAction],
  }
  const evaluator: PartyEvaluator = (party) => {
    const weapon = party.characters[0]?.equipment.weapon
    const total = weapon === "rapier" ? 8 : weapon === "knife" ? 4 : 0

    return {
      total,
      components: [{ key: "fixture-score", value: total, reason: `weapon:${weapon ?? "none"}` }],
    }
  }
  const recommender = new NextActionRecommender(provider, evaluator)

  assert.deepEqual(
    recommender.recommend({ characters: [character("fighter")], gil: 100 }, town),
    {
      kind: "take-action",
      action: rapierAction,
      scoreDelta: 8,
      components: [{ key: "fixture-score", value: 8, reason: "weapon:rapier" }],
    },
  )
})

test("preserves legal action order when positive marginal scores tie", () => {
  const provider = {
    availableActions: () => [staffAction, rapierAction],
  }
  const evaluator: PartyEvaluator = (party) => {
    const weapon = party.characters[0]?.equipment.weapon
    const total = weapon === undefined ? 0 : 5

    return {
      total,
      components: [{ key: "fixture-score", value: total, reason: `weapon:${weapon ?? "none"}` }],
    }
  }
  const recommender = new NextActionRecommender(provider, evaluator)

  assert.deepEqual(
    recommender.recommend({ characters: [character("fighter")], gil: 100 }, town),
    {
      kind: "take-action",
      action: staffAction,
      scoreDelta: 5,
      components: [{ key: "fixture-score", value: 5, reason: "weapon:staff" }],
    },
  )
})

test("stops when every legal action has a non-positive marginal score", () => {
  const provider = {
    availableActions: () => [knifeAction, rapierAction],
  }
  const evaluator: PartyEvaluator = () => ({
    total: 10,
    components: [],
  })
  const recommender = new NextActionRecommender(provider, evaluator)

  assert.deepEqual(
    recommender.recommend({ characters: [character("fighter")], gil: 100 }, town),
    { kind: "stop", reason: "no-positive-action", scoreDelta: 0 },
  )
})

test("folds recommendations into an ordered plan ending in stop", () => {
  const provider = {
    availableActions: (party: PartyState) => {
      const fighter = party.characters[0]!
      if (fighter.equipment.weapon === undefined) {

        return [rapierAction]
      }
      if (!fighter.learnedSpells.has("cure")) {

        return [cureAction]
      }

      return []
    },
  }
  const evaluator: PartyEvaluator = (party) => {
    const fighter = party.characters[0]!
    const weaponValue = fighter.equipment.weapon === "rapier" ? 8 : 0
    const spellValue = fighter.learnedSpells.has("cure") ? 50 : 0
    const total = weaponValue + spellValue

    return {
      total,
      components: [{ key: "fixture-score", value: total, reason: "injected evaluator total" }],
    }
  }
  const recommender = new NextActionRecommender(provider, evaluator)

  assert.deepEqual(
    recommender.recommendPlan({ characters: [character("fighter")], gil: 100 }, town),
    [
      {
        kind: "take-action",
        action: rapierAction,
        scoreDelta: 8,
        components: [{ key: "fixture-score", value: 8, reason: "injected evaluator total" }],
      },
      {
        kind: "take-action",
        action: cureAction,
        scoreDelta: 50,
        components: [{ key: "fixture-score", value: 58, reason: "injected evaluator total" }],
      },
      { kind: "stop", reason: "no-legal-action", scoreDelta: 0 },
    ],
  )
})
