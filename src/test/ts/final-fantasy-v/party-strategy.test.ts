import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { parse } from "yaml"

import {
  buildFinalFantasyVStrategyCatalog,
  decodeFinalFantasyVJobs,
  FinalFantasyVPartyStrategyEngine,
  finalFantasyVWindPartyStrategyRules,
  validateFinalFantasyVLoadout,
  type FinalFantasyVCharacterId,
  type FinalFantasyVLearnedAbility,
  type FinalFantasyVPartyMember,
  type FinalFantasyVPartyStrategyRuleDefinition,
} from "../../../main/ts/final-fantasy-v/index.ts"

const jobsYaml = await readFile("data/final-fantasy-v-jobs.yaml", "utf8")
const catalog = buildFinalFantasyVStrategyCatalog(decodeFinalFantasyVJobs(parse(jobsYaml)))
const engine = new FinalFantasyVPartyStrategyEngine(catalog, finalFantasyVWindPartyStrategyRules)

test("analyzes sparse membership while requiring an interesting setup", () => {
  const krile = member("krile", "white-mage", [ranked("black-magic", 3)])
  const strategy = engine.analyze([krile])

  assert.deepEqual(strategy.members, [{ characterId: "krile", jobId: "white-mage" }])
  assert.deepEqual(strategy.observations.map((observation) => observation.ruleId), [
    "white-mage-black-magic-flex",
  ])
  assert.deepEqual(strategy.observations[0]?.memberIds, ["krile"])
  assert.match(strategy.observations[0]?.statement ?? "", /compete for the same turns and MP/)
})

test("does not emit trivial class or innate-ability descriptions", () => {
  assert.deepEqual(engine.analyze([member("krile", "white-mage")]).observations, [])
  assert.deepEqual(engine.analyze([member("krile", "black-mage")]).observations, [])
  assert(!engine.ruleIds.some((id) => id === "can-use-white-magic" || id === "can-use-black-magic"))
})

test("finds same-member hybrids and records only the member that enables them", () => {
  const strategy = engine.analyze([
    member("bartz", "monk", [ranked("white-magic", 2)]),
    member("lenna", "thief"),
  ])

  assert.deepEqual(strategy.observations.map((observation) => observation.ruleId), [
    "barehanded-white-magic-sustain",
  ])
  assert.deepEqual(strategy.observations[0]?.memberIds, ["bartz"])
})

test("supports a full party and reports distinct-member interactions", () => {
  const members = [
    member("bartz", "knight"),
    member("lenna", "white-mage"),
    member("faris", "black-mage"),
    member("krile", "monk"),
  ]
  const strategy = engine.analyze(members)

  assert.deepEqual(strategy.members.map((member) => member.characterId), [
    "bartz",
    "lenna",
    "faris",
    "krile",
  ])
  assert.deepEqual(strategy.observations.map((observation) => observation.ruleId), [
    "dedicated-white-and-black-actions",
    "knight-shelters-white-mage",
  ])
  assert.deepEqual(strategy.observations.map((observation) => observation.memberIds), [
    ["lenna", "faris"],
    ["bartz", "lenna"],
  ])
})

test("matches distinct-member rules independent of party order", () => {
  const forward = engine.analyze([
    member("bartz", "black-mage"),
    member("lenna", "white-mage"),
  ]).observations
  const reversed = engine.analyze([
    member("lenna", "white-mage"),
    member("bartz", "black-mage"),
  ]).observations

  assert.deepEqual(reversed, forward)
})

test("rejects impossible or ambiguous party membership", () => {
  const krile = member("krile", "monk")

  assert.throws(() => engine.analyze([]), /Expected 1 to 4/)
  assert.throws(() => engine.analyze([krile, krile]), /Duplicate.*krile/)
  assert.throws(
    () => engine.analyze([member("galuf", "knight"), krile]),
    /Galuf and Krile cannot be active party members at the same time/,
  )
  assert.throws(
    () => engine.analyze([
      member("bartz", "knight"),
      member("lenna", "white-mage"),
      member("galuf", "monk"),
      member("faris", "thief"),
      krile,
    ]),
    /Expected 1 to 4/,
  )
})

test("validates the intentionally narrow Wind interaction vocabulary", () => {
  assert.throws(
    () => new FinalFantasyVPartyStrategyEngine(catalog, [
      rule("trivial", { sameMember: [{ job: "white-mage" }] }),
    ]),
    /must combine at least two same-member selectors/,
  )
  assert.throws(
    () => new FinalFantasyVPartyStrategyEngine(catalog, [
      rule("trivial", { distinctMembers: [{ job: "white-mage" }] }),
    ]),
    /must combine at least two distinct-member selectors/,
  )
  assert.throws(
    () => new FinalFantasyVPartyStrategyEngine(catalog, [
      rule("unknown", { sameMember: [{ job: "missing" }, { assignment: "white-magic" }] }),
    ]),
    /Unknown Final Fantasy V strategy job: missing/,
  )
  assert.throws(
    () => new FinalFantasyVPartyStrategyEngine(catalog, [
      rule("later-crystal", { sameMember: [{ job: "berserker" }, { assignment: "white-magic" }] }),
    ]),
    /only support Wind jobs: berserker/,
  )
  assert.throws(
    () => new FinalFantasyVPartyStrategyEngine(catalog, [
      rule("bad-rank", {
        sameMember: [{ job: "white-mage" }, { assignment: "black-magic", atLeastRank: 0 }],
      }),
    ]),
    /rank for black-magic must be a positive integer/,
  )
  assert.throws(
    () => new FinalFantasyVPartyStrategyEngine(catalog, [
      rule("duplicate", { distinctMembers: [{ job: "white-mage" }, { job: "black-mage" }] }),
      rule("duplicate", { distinctMembers: [{ job: "knight" }, { job: "monk" }] }),
    ]),
    /Duplicate Final Fantasy V party strategy rule ids: duplicate/,
  )
})

function member(
  characterId: FinalFantasyVCharacterId,
  jobId: string,
  learnedAbilities: readonly FinalFantasyVLearnedAbility[] = [],
): FinalFantasyVPartyMember {
  const validation = validateFinalFantasyVLoadout(
    { jobId, assignments: learnedAbilities.map(({ abilityId }) => ({ abilityId })) },
    { learnedAbilities, masteredJobIds: new Set() },
    catalog,
  )
  assert.equal(validation.kind, "valid")

  return { characterId, loadout: validation.value }
}

function ranked(abilityId: string, rank: number): FinalFantasyVLearnedAbility {
  return { kind: "ranked", abilityId, rank }
}

function rule(
  id: string,
  when: FinalFantasyVPartyStrategyRuleDefinition["when"],
): FinalFantasyVPartyStrategyRuleDefinition {
  return { id, kind: "setup", when, statement: "Test statement." }
}
