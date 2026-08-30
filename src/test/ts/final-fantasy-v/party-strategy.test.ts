import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { parse } from "yaml"

import {
  buildFinalFantasyVStrategyCatalog,
  decodeFinalFantasyVJobs,
  decodeFinalFantasyVPartyStrategy,
  FinalFantasyVPartyStrategyEngine,
  finalFantasyVStrategyYamlFiles,
  validateFinalFantasyVLoadout,
  type FinalFantasyVCharacterId,
  type FinalFantasyVLearnedAbility,
  type FinalFantasyVMemberSelectorDefinition,
  type FinalFantasyVPartyMember,
  type FinalFantasyVPartyStrategyRuleDefinition,
} from "../../../main/ts/final-fantasy-v/index.ts"

const jobsYaml = await readFile("data/final-fantasy-v-jobs.yaml", "utf8")
const catalog = buildFinalFantasyVStrategyCatalog(decodeFinalFantasyVJobs(parse(jobsYaml)))
const strategyYaml = await readFile(finalFantasyVStrategyYamlFiles.partyStrategy, "utf8")
const rules = decodeFinalFantasyVPartyStrategy(parse(strategyYaml))
const engine = new FinalFantasyVPartyStrategyEngine(catalog, rules)

test("loads Wind, Water, and Fire party strategy rules from YAML", () => {
  assert.equal(finalFantasyVStrategyYamlFiles.partyStrategy, "data/final-fantasy-v-party-strategy.yaml")
  assert.equal(rules.length, 47)
  assert.deepEqual(engine.ruleIds, rules.map((rule) => rule.id))
})

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
    "cover-guard-fortress",
  ])
  assert.deepEqual(strategy.observations.map((observation) => observation.memberIds), [
    ["lenna", "faris"],
    ["bartz", "lenna"],
    ["bartz"],
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

test("covers representative Water command tradeoffs", () => {
  const berserker = engine.analyze([
    member("galuf", "berserker", [ranked("white-magic", 2)]),
  ])
  assert.deepEqual(berserker.observations.map((observation) => observation.ruleId), [
    "berserker-active-command-lockout",
  ])

  const summoner = engine.analyze([
    member("lenna", "summoner", [flat("call")]),
  ])
  assert.deepEqual(summoner.observations.map((observation) => observation.ruleId), [
    "summon-call-fallback",
  ])

  const redMage = engine.analyze([
    member("faris", "red-mage", [flat("dualcast")]),
  ])
  assert.deepEqual(redMage.observations.map((observation) => observation.ruleId), [
    "red-mage-dualcast",
  ])
})

test("finds Water ability interactions within and across members", () => {
  const quickSummoner = engine.analyze([
    member("krile", "time-mage", [ranked("summon", 5)]),
  ])
  assert.deepEqual(quickSummoner.observations.map((observation) => observation.ruleId), [
    "quick-summon-chain",
  ])

  const relay = engine.analyze([
    member("lenna", "summoner"),
    member("krile", "mime"),
  ])
  assert.deepEqual(relay.observations.map((observation) => observation.ruleId), [
    "mime-summon-relay",
  ])
  assert.deepEqual(relay.observations[0]?.memberIds, ["lenna", "krile"])
})

test("accounts for every ability through the Fire crystal", () => {
  const contributedCrystals = new Set(["wind", "water", "fire"])
  const contributedAbilityIds = [...catalog.jobs.values()]
    .filter((job) => contributedCrystals.has(job.crystal))
    .flatMap((job) => job.abilities.map((ability) => ability.id))
    .sort()
  const referencedAbilityIds = new Set(rules.flatMap((rule) =>
    selectors(rule.when).flatMap((selector) => {
      if ("assignment" in selector) {
        return [selector.assignment]
      }
      if ("innate" in selector) {
        return [selector.innate]
      }

      return []
    })))

  assert.deepEqual(
    contributedAbilityIds.filter((abilityId) => !referencedAbilityIds.has(abilityId)),
    [],
  )
})

test("keeps every authored rule through Fire reachable with legal loadouts", () => {
  const parties: FinalFantasyVPartyMember[][] = [
    [member("bartz", "white-mage", [ranked("black-magic", 3)])],
    [member("bartz", "black-mage", [ranked("white-magic", 3)])],
    [member("bartz", "monk", [ranked("white-magic", 3)])],
    [member("bartz", "white-mage"), member("lenna", "black-mage")],
    [member("bartz", "knight"), member("lenna", "white-mage")],
    [member("galuf", "berserker", [ranked("white-magic", 3)])],
    [member("galuf", "berserker", [flat("counter")])],
    [member("galuf", "freelancer", [flat("equip-axes"), flat("two-handed")])],
    [member("galuf", "mystic-knight", [ranked("white-magic", 3)])],
    [member("galuf", "mystic-knight", [flat("two-handed")])],
    [member("bartz", "time-mage"), member("galuf", "berserker")],
    [member("krile", "time-mage", [ranked("summon", 5)])],
    [member("krile", "freelancer", [flat("equip-rods"), ranked("black-magic", 6)])],
    [member("krile", "summoner", [flat("call")])],
    [member("krile", "red-mage", [flat("dualcast")])],
    [member("krile", "freelancer", [flat("dualcast"), ranked("summon", 5)])],
    [member("krile", "mime", [flat("attack"), flat("items")])],
    [member("lenna", "summoner"), member("krile", "mime")],
    [member("bartz", "black-mage", [flat("equip-armor")])],
    [member("bartz", "white-mage", [flat("equip-shields")])],
    [member("bartz", "blue-mage", [flat("equip-swords")])],
    [member("bartz", "monk", [flat("focus")])],
    [member("bartz", "monk", [flat("chakra")])],
    [member("bartz", "mime", [
      flat("hp-plus-10-percent"),
      flat("hp-plus-20-percent"),
      flat("hp-plus-30-percent"),
    ])],
    [member("bartz", "geomancer", [flat("find-passages")])],
    [member("bartz", "geomancer", [flat("sprint")])],
    [member("bartz", "ninja", [flat("vigilance")])],
    [member("bartz", "thief", [flat("mug")])],
    [member("bartz", "freelancer", [flat("flee"), flat("smoke")])],
    [member("bartz", "freelancer", [flat("check"), flat("scan")])],
    [member("bartz", "blue-mage"), member("lenna", "beastmaster", [flat("control")])],
    [member("bartz", "freelancer", [flat("blue-magic"), flat("dualcast")])],
    [member("bartz", "mime", [
      flat("mp-plus-10-percent"),
      flat("mp-plus-30-percent"),
    ])],
    [member("bartz", "freelancer", [flat("calm"), flat("control")])],
    [member("bartz", "freelancer", [flat("equip-whips"), flat("control")])],
    [member("bartz", "geomancer", [ranked("summon", 3)])],
    [member("bartz", "knight", [flat("image")])],
    [member("bartz", "ninja", [flat("two-handed")])],
    [member(
      "bartz",
      "freelancer",
      [ranked("spellblade", 3), flat("rapid-fire")],
      ["ninja"],
    )],
    [member("bartz", "bard", [flat("hide-reveal")])],
    [member("bartz", "freelancer", [flat("equip-harps"), ranked("summon", 3)])],
    [member("bartz", "freelancer", [flat("animals"), flat("call")])],
    [member("bartz", "ranger", [flat("rapid-fire")])],
    [member("bartz", "freelancer", [flat("equip-bows"), flat("two-handed")])],
  ]
  const activatedRuleIds = new Set(parties.flatMap((party) =>
    engine.analyze(party).observations.map((observation) => observation.ruleId)))

  assert.deepEqual([...activatedRuleIds].sort(), [...engine.ruleIds].sort())
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

test("validates the intentionally interaction-only vocabulary", () => {
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

test("defensively decodes YAML rule structure", () => {
  assert.throws(
    () => decodeFinalFantasyVPartyStrategy({}),
    /party strategy.rules must be an array/,
  )
  assert.throws(
    () => decodeFinalFantasyVPartyStrategy({ rules: [{
      id: "both",
      kind: "setup",
      when: { sameMember: [], distinctMembers: [] },
      statement: "Invalid.",
    }] }),
    /must have exactly one operation/,
  )
  assert.throws(
    () => decodeFinalFantasyVPartyStrategy({ rules: [{
      id: "both",
      kind: "setup",
      when: { sameMember: [{ job: "knight", assignment: "guard" }] },
      statement: "Invalid.",
    }] }),
    /must have exactly one selector/,
  )
  assert.throws(
    () => decodeFinalFantasyVPartyStrategy({ rules: [{
      id: "type",
      kind: "setup",
      when: { sameMember: [{ assignmentType: "magic" }, { job: "knight" }] },
      statement: "Invalid.",
    }] }),
    /must be active or passive/,
  )
  assert.throws(
    () => decodeFinalFantasyVPartyStrategy({ rules: [{
      id: "rank",
      kind: "setup",
      when: { sameMember: [{ job: "knight", atLeastRank: 2 }, { job: "monk" }] },
      statement: "Invalid.",
    }] }),
    /atLeastRank requires an assignment or innate selector/,
  )
})

function member(
  characterId: FinalFantasyVCharacterId,
  jobId: string,
  learnedAbilities: readonly FinalFantasyVLearnedAbility[] = [],
  masteredJobIds: readonly string[] = [],
): FinalFantasyVPartyMember {
  const validation = validateFinalFantasyVLoadout(
    { jobId, assignments: learnedAbilities.map(({ abilityId }) => ({ abilityId })) },
    { learnedAbilities, masteredJobIds: new Set(masteredJobIds) },
    catalog,
  )
  assert.equal(validation.kind, "valid")

  return { characterId, loadout: validation.value }
}

function ranked(abilityId: string, rank: number): FinalFantasyVLearnedAbility {
  return { kind: "ranked", abilityId, rank }
}

function flat(abilityId: string): FinalFantasyVLearnedAbility {
  return { kind: "flat", abilityId }
}

function selectors(
  when: FinalFantasyVPartyStrategyRuleDefinition["when"],
): readonly FinalFantasyVMemberSelectorDefinition[] {
  return "sameMember" in when ? when.sameMember : when.distinctMembers
}

function rule(
  id: string,
  when: FinalFantasyVPartyStrategyRuleDefinition["when"],
): FinalFantasyVPartyStrategyRuleDefinition {
  return { id, kind: "setup", when, statement: "Test statement." }
}
