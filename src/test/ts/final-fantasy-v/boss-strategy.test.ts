import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { parse } from "yaml"

import {
  buildFinalFantasyVBossCatalog,
  buildFinalFantasyVStrategyCatalog,
  currentFinalFantasyVBossSelection,
  decodeFinalFantasyVBosses,
  decodeFinalFantasyVBossStrategy,
  decodeFinalFantasyVJobs,
  FinalFantasyVBossStrategyEngine,
  finalFantasyVJobIsAvailableThroughCrystal,
  finalFantasyVStrategyYamlFiles,
  selectFinalFantasyVBoss,
  validateFinalFantasyVLoadout,
  type FinalFantasyVBossStrategyDefinitions,
  type FinalFantasyVCharacterId,
  type FinalFantasyVPartyMember,
} from "../../../main/ts/final-fantasy-v/index.ts"

const jobs = decodeFinalFantasyVJobs(parse(await readFile(
  finalFantasyVStrategyYamlFiles.jobs,
  "utf8",
)))
const strategyCatalog = buildFinalFantasyVStrategyCatalog(jobs)
const bossDefinitions = decodeFinalFantasyVBosses(parse(await readFile(
  finalFantasyVStrategyYamlFiles.bosses,
  "utf8",
)))
const bossCatalog = buildFinalFantasyVBossCatalog(bossDefinitions)
const bossStrategyDefinitions = decodeFinalFantasyVBossStrategy(parse(await readFile(
  finalFantasyVStrategyYamlFiles.bossStrategy,
  "utf8",
)))
const engine = new FinalFantasyVBossStrategyEngine(
  strategyCatalog,
  bossCatalog,
  bossStrategyDefinitions,
)
const learningState = {
  learnedAbilities: [...strategyCatalog.abilities.values()].map((ability) => ability.kind === "flat"
    ? { kind: "flat" as const, abilityId: ability.id }
    : {
        kind: "ranked" as const,
        abilityId: ability.id,
        rank: ability.ranks.at(-1)!.rank,
      }),
  masteredJobIds: new Set<string>(),
}

test("loads ten main-story and two optional boss encounters", () => {
  assert.equal(finalFantasyVStrategyYamlFiles.bosses, "data/final-fantasy-v/bosses.yaml")
  assert.equal(bossDefinitions.mainStory.length, 10)
  assert.equal(bossDefinitions.optional.length, 2)
  assert.deepEqual(bossCatalog.encounters.map((boss) => boss.key), [
    "karlabos",
    "siren",
    "magissa-and-forza",
    "garula",
    "liquid-flame",
    "iron-claw",
    "ifrit",
    "byblos",
    "sandworm",
    "cray-claw",
    "shiva-and-ice-commanders",
    "ramuh",
  ])
})

test("pins current boss selection to Karlabos while retaining a random policy", () => {
  assert.deepEqual(currentFinalFantasyVBossSelection, { kind: "fixed", bossId: "karlabos" })
  assert.equal(selectFinalFantasyVBoss(bossCatalog).key, "karlabos")
  assert.equal(selectFinalFantasyVBoss(
    bossCatalog,
    { kind: "random", random: () => 0 },
  ).key, "karlabos")
  assert.equal(selectFinalFantasyVBoss(
    bossCatalog,
    { kind: "random", random: () => 0.9999 },
  ).key, "ramuh")
})

test("uses Karlabos progression to expose only Freelancer and Wind jobs", () => {
  const karlabos = selectFinalFantasyVBoss(bossCatalog)
  const availableJobs = [...strategyCatalog.jobs.values()]
    .filter((job) => finalFantasyVJobIsAvailableThroughCrystal(job, karlabos.jobsUnlocked))
    .map((job) => job.id)

  assert.deepEqual(availableJobs, [
    "freelancer",
    "knight",
    "monk",
    "thief",
    "white-mage",
    "black-mage",
    "blue-mage",
  ])
})

test("scores Karlabos from mechanical facts and party capabilities", () => {
  assert.equal(engine.hasProfile("karlabos"), true)
  assert.deepEqual(
    bossCatalog.encounters.filter((boss) => !engine.hasProfile(boss.key)),
    [],
  )
  const evaluation = engine.evaluate("karlabos", [
    member("bartz", "black-mage"),
    member("lenna", "white-mage"),
  ])

  assert.equal(evaluation.capabilityMembers["lightning-offense"], 1)
  assert.equal(evaluation.capabilityMembers.recovery, 1)
  assert.equal(evaluation.capabilityMembers["physical-mitigation"], 0)
  assert.deepEqual(evaluation.assumptions.map((assumption) => assumption.id), [
    "available-ranked-spells-owned",
  ])
  assert.deepEqual(evaluation.score, { tempo: 3, safety: 2, reliability: 0 })
  assert.deepEqual(evaluation.matchedRules.map((rule) => rule.ruleId), [
    "exploit-lightning-weakness",
    "recovery-answers-hp-collapse",
    "single-recovery-paralysis-risk",
    "status-control-exploits-susceptibility",
  ])
})

test("distinguishes concentrated offense, recovery redundancy, and item-only recovery", () => {
  const redundant = engine.evaluate("karlabos", [
    member("bartz", "black-mage"),
    member("faris", "black-mage"),
    member("lenna", "white-mage"),
    member("galuf", "white-mage"),
  ])
  assert.deepEqual(redundant.score, { tempo: 4, safety: 2, reliability: 4 })

  const itemOnly = engine.evaluate("karlabos", [member("bartz", "knight")])
  assert.deepEqual(itemOnly.score, { tempo: 0, safety: 0, reliability: 0 })
  assert.deepEqual(itemOnly.matchedRules.map((rule) => rule.ruleId), [
    "physical-mitigation-answers-attacks",
    "item-only-hp-collapse-response",
  ])
})

test("uses encounter traits to differentiate all current boss profiles", () => {
  assert.deepEqual(
    bossStrategyDefinitions.bosses.map((boss) => boss.boss),
    bossCatalog.encounters.map((boss) => boss.key),
  )
  const windParty = [
    member("bartz", "black-mage"),
    member("lenna", "white-mage"),
    member("galuf", "knight"),
    member("faris", "monk"),
  ]
  for (const boss of bossCatalog.encounters) {
    assert.ok(
      engine.evaluate(boss.key, windParty).matchedRules.length > 0,
      `${boss.key} should activate at least one strategy rule for a milestone-valid party`,
    )
  }

  const liquidFlame = engine.evaluate("liquid-flame", [member("bartz", "berserker")])
  assert.deepEqual(liquidFlame.score, { tempo: 0, safety: 0, reliability: -4 })
  assert.deepEqual(liquidFlame.matchedRules.map((rule) => rule.ruleId), [
    "uncontrolled-offense-risks-counters",
    "uncontrolled-offense-risks-form-shifts",
  ])

  const sandworm = engine.evaluate("sandworm", [member("bartz", "berserker")])
  assert.deepEqual(sandworm.score, { tempo: 0, safety: -1, reliability: -5 })
  assert.deepEqual(sandworm.matchedRules.map((rule) => rule.ruleId), [
    "uncontrolled-offense-risks-counters",
    "uncontrolled-offense-risks-decoys",
  ])
})

test("rejects invalid boss selection and catalog relationships", () => {
  assert.throws(
    () => selectFinalFantasyVBoss(bossCatalog, { kind: "fixed", bossId: "missing" }),
    /Unknown Final Fantasy V selected boss: missing/,
  )
  assert.throws(
    () => selectFinalFantasyVBoss(bossCatalog, { kind: "random", random: () => 1 }),
    /random source must return a number from 0 through 1/,
  )
  assert.throws(
    () => buildFinalFantasyVBossCatalog({
      ...bossDefinitions,
      mainStory: [{ ...bossDefinitions.mainStory[0]!, ordinal: 2 }],
    }),
    /ordinals must be contiguous/,
  )
  assert.throws(
    () => buildFinalFantasyVBossCatalog({
      ...bossDefinitions,
      optional: [{
        ...bossDefinitions.optional[0]!,
        earliestAfterEncounter: "missing",
      }],
    }),
    /optional boss predecessors: missing/,
  )
  assert.throws(
    () => buildFinalFantasyVBossCatalog({
      mainStory: bossDefinitions.mainStory,
      optional: [{
        ...bossDefinitions.optional[0]!,
        key: bossDefinitions.mainStory[0]!.key,
      }],
    }),
    /Duplicate Final Fantasy V boss keys: karlabos/,
  )
})

test("defensively validates boss and boss-strategy YAML", () => {
  assert.throws(() => decodeFinalFantasyVBosses({}), /encounters must be an array/)
  assert.throws(
    () => decodeFinalFantasyVBosses({ encounters: [{}], optionalEncounters: [] }),
    /ordinal must be a positive integer/,
  )
  assert.throws(
    () => decodeFinalFantasyVBosses({
      encounters: [{ ordinal: 1, key: "boss", name: "Boss", jobsUnlocked: "unknown" }],
      optionalEncounters: [],
    }),
    /known Final Fantasy V crystal unlock/,
  )
  assert.throws(() => decodeFinalFantasyVBossStrategy({}), /bosses must be an array/)
  assert.throws(
    () => decodeFinalFantasyVBossStrategy({
      bosses: [{
        boss: "karlabos",
        targetCount: 1,
        vulnerabilities: ["unknown"],
        traits: [],
        threats: [],
      }],
      assumptions: [],
      capabilities: [],
      rules: [],
    }),
    /must be a known element/,
  )
  assert.throws(
    () => decodeFinalFantasyVBossStrategy({
      bosses: [{
        boss: "karlabos",
        targetCount: 1,
        vulnerabilities: [],
        traits: ["unknown"],
        threats: [],
      }],
      assumptions: [],
      capabilities: [],
      rules: [],
    }),
    /must be a known boss trait/,
  )
  assert.throws(
    () => decodeFinalFantasyVBossStrategy({
      bosses: [],
      assumptions: [],
      capabilities: [],
      rules: [{
        id: "bad",
        when: {
          boss: { vulnerability: "lightning", threat: "paralysis" },
          party: { capability: "recovery", atLeastMembers: 1 },
        },
        score: { speed: 1 },
        statement: "Bad.",
      }],
    }),
    /exactly one boss fact/,
  )
})

test("validates compiled boss strategy references and bounds", () => {
  assert.throws(
    () => new FinalFantasyVBossStrategyEngine(
      strategyCatalog,
      bossCatalog,
      patchStrategy({ bosses: [{ ...bossStrategyDefinitions.bosses[0]!, boss: "missing" }] }),
    ),
    /Unknown Final Fantasy V boss strategy profile: missing/,
  )
  assert.throws(
    () => new FinalFantasyVBossStrategyEngine(
      strategyCatalog,
      bossCatalog,
      patchStrategy({ capabilities: [{ key: "bad", providers: [{ ability: "missing" }] }] }),
    ),
    /Unknown Final Fantasy V boss capability ability: missing/,
  )
  assert.throws(
    () => new FinalFantasyVBossStrategyEngine(
      strategyCatalog,
      bossCatalog,
      patchStrategy({ rules: [{
        ...bossStrategyDefinitions.rules[0]!,
        when: {
          ...bossStrategyDefinitions.rules[0]!.when,
          party: { capability: "missing", atLeastMembers: 1 },
        },
      }] }),
    ),
    /Unknown Final Fantasy V boss capability: missing/,
  )
  assert.throws(
    () => new FinalFantasyVBossStrategyEngine(
      strategyCatalog,
      bossCatalog,
      patchStrategy({ rules: [{
        ...bossStrategyDefinitions.rules[0]!,
        when: {
          ...bossStrategyDefinitions.rules[0]!.when,
          party: { capability: "lightning-offense", atLeastMembers: 3, atMostMembers: 2 },
        },
      }] }),
    ),
    /inverted member bounds/,
  )
  assert.throws(() => engine.evaluate("missing", []), /No Final Fantasy V boss strategy profile/)
})

function member(
  characterId: FinalFantasyVCharacterId,
  jobId: string,
): FinalFantasyVPartyMember {
  const result = validateFinalFantasyVLoadout({ jobId, assignments: [] }, learningState, strategyCatalog)
  assert.equal(result.kind, "valid")
  if (result.kind === "invalid") {
    throw new Error("Expected test loadout to be valid")
  }

  return { characterId, loadout: result.value }
}

function patchStrategy(
  patch: Partial<FinalFantasyVBossStrategyDefinitions>,
): FinalFantasyVBossStrategyDefinitions {
  return { ...bossStrategyDefinitions, ...patch }
}
