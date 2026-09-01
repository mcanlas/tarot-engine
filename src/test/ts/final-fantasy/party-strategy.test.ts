import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  createRandomPartyBossStrategy,
  loadPartyStrategyEngine,
  partyStrategyYamlFile,
  renderBossStrategy,
  runConsole,
} from "./party-strategy.ts"
import { loadStrategyEngine } from "../../../main/ts/final-fantasy/strategy-data.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

const engine = await loadPartyStrategyEngine(loadProjectFile)
const bossEngine = await loadStrategyEngine(loadProjectFile)

function orderedPartyFormations(classIds: readonly string[]): string[][] {
  const parties: string[][] = []

  const appendParty = (party: string[], remaining: number): void => {
    if (remaining === 0) {
      parties.push(party)

      return
    }

    for (const classId of classIds) {
      appendParty([...party, classId], remaining - 1)
    }
  }

  for (let size = 1; size <= 4; size += 1) {
    appendParty([], size)
  }

  return parties
}

test("loads class facts from existing catalogs and party rules from their own YAML", () => {
  assert.deepEqual(engine.classIds, [
    "warrior",
    "thief",
    "monk",
    "red-mage",
    "white-mage",
    "black-mage",
  ])
  assert.equal(engine.ruleCount, 31)
  assert.equal(partyStrategyYamlFile, "data/final-fantasy/party-strategy.yaml")
})

test("derives a balanced party's capabilities from classes and potential spells", () => {
  const strategy = engine.analyze(["warrior", "red-mage", "white-mage", "black-mage"])
  const matchedRules = strategy.observations.map((observation) => observation.ruleId)

  assert.deepEqual(strategy.party, ["warrior", "red-mage", "white-mage", "black-mage"])
  assert(matchedRules.includes("physical-core"))
  assert(matchedRules.includes("recovery"))
  assert(matchedRules.includes("magical-offense"))
  assert(matchedRules.includes("magical-depth"))
  assert(matchedRules.includes("mixed-offense"))
  assert(matchedRules.includes("defensive-support"))
  assert(matchedRules.includes("physical-amplification"))
  assert(matchedRules.includes("battlefield-control"))
  assert(matchedRules.includes("anti-undead-specialist"))
  assert(matchedRules.includes("hybrid-action-bottleneck"))
  assert(matchedRules.includes("diverse-roster"))
  assert(!engine.ruleIds.includes("warrior-front-line"))
})

test("does not treat White Mage's undead-only Dia as general magical offense", () => {
  const matchedRules = engine.analyze(["white-mage"])
    .observations.map((observation) => observation.ruleId)

  assert(matchedRules.includes("recovery"))
  assert(matchedRules.includes("defensive-support"))
  assert(matchedRules.includes("anti-undead-specialist"))
  assert(matchedRules.includes("no-magical-offense"))
  assert(!matchedRules.includes("magical-offense"))
})

test("applies YAML-authored tradeoff rules to a small physical party", () => {
  const matchedRules = engine.analyze(["thief", "monk"])
    .observations.map((observation) => observation.ruleId)

  assert(matchedRules.includes("physical-core"))
  assert(matchedRules.includes("no-recovery"))
  assert(matchedRules.includes("no-magical-offense"))
  assert(matchedRules.includes("unsupported-physical-core"))
  assert(matchedRules.includes("no-front-line-specialist"))
})

test("covers all 1,554 ordered party formations and activates every authored rule", () => {
  const parties = orderedPartyFormations(engine.classIds)
  const activatedRules = new Set<string>()

  assert.equal(parties.length, 1_554)

  for (const party of parties) {
    const strategy = engine.analyze(party)
    const strengths = strategy.observations.filter((observation) => observation.kind === "strength")
    const weaknesses = strategy.observations.filter((observation) => observation.kind === "weakness")

    assert(strengths.length > 0, `${party.join("/")} has no strength`)
    assert(weaknesses.length > 0, `${party.join("/")} has no weakness`)
    assert.equal(
      new Set(strategy.observations.map((observation) => observation.statement)).size,
      strategy.observations.length,
      `${party.join("/")} repeats a statement`,
    )
    strategy.observations.forEach((observation) => activatedRules.add(observation.ruleId))
  }

  assert.deepEqual([...activatedRules].sort(), [...engine.ruleIds].sort())
})

test("treats the first member as an immutable front position", () => {
  const protectedFront = engine.analyze(["warrior", "white-mage"])
  const exposedCaster = engine.analyze(["white-mage", "warrior"])
  const protectedRules = protectedFront.observations.map((observation) => observation.ruleId)
  const exposedRules = exposedCaster.observations.map((observation) => observation.ruleId)

  assert(protectedRules.includes("primary-frontline"))
  assert(!protectedRules.includes("fragile-front"))
  assert(exposedRules.includes("primary-frontliner-behind"))
  assert(exposedRules.includes("fragile-front"))
  assert(exposedRules.includes("fragile-front-support"))
  assert.notDeepEqual(exposedFrontFormation(exposedCaster), exposedFrontFormation(protectedFront))
})

function exposedFrontFormation(strategy: ReturnType<typeof engine.analyze>): readonly string[] {
  return strategy.observations
    .filter((observation) => observation.ruleId.includes("front"))
    .map((observation) => observation.ruleId)
}

test("accepts every supported party size and rejects invalid input", () => {
  for (const party of [
    ["warrior"],
    ["warrior", "thief"],
    ["warrior", "thief", "monk"],
    ["warrior", "thief", "monk", "red-mage"],
  ]) {
    assert.equal(engine.analyze(party).party.length, party.length)
  }

  assert.throws(() => engine.analyze([]), /Expected 1 to 4 character classes/)
  assert.throws(
    () => engine.analyze(["warrior", "thief", "monk", "red-mage", "white-mage"]),
    /Expected 1 to 4 character classes/,
  )
  assert.throws(() => engine.analyze(["mime"]), /Unknown character class: mime/)
  assert.throws(() => engine.analyze(["knight"]), /Unknown character class: knight/)
})

test("creates random parties with equally sized probability ranges", () => {
  const values = [
    0, 0, 0,
    0.25, 0.2, 0.4, 0.6,
    0.5, 0.6, 0.7, 0.9, 0.49,
    0.75, 0, 0.2, 0.4, 0.999999, 0.5,
  ]
  const random = (): number => values.shift() ?? 0

  assert.deepEqual(engine.createRandomParty(random), {
    classIds: ["warrior"],
    promoted: false,
  })
  assert.deepEqual(engine.createRandomParty(random), {
    classIds: ["thief", "monk"],
    promoted: true,
  })
  assert.deepEqual(engine.createRandomParty(random), {
    classIds: ["red-mage", "white-mage", "black-mage"],
    promoted: false,
  })
  assert.deepEqual(engine.createRandomParty(random), {
    classIds: ["warrior", "thief", "monk", "black-mage"],
    promoted: true,
  })
})

test("rejects values outside the random source contract", () => {
  assert.throws(() => engine.createRandomParty(() => -0.01), /Random source must return/)
  assert.throws(() => engine.createRandomParty(() => 1), /Random source must return/)
  assert.throws(() => engine.createRandomParty(() => Number.NaN), /Random source must return/)
})

test("pairs each random party with a random boss and a party-specific guide", () => {
  const values = [0, 0.999999, 0.5, 0.52]
  const strategy = createRandomPartyBossStrategy(
    engine,
    bossEngine,
    () => values.shift() ?? 0,
  )
  const rendered = renderBossStrategy(strategy)

  assert.deepEqual(strategy.partyStrategy.party, ["black-mage"])
  assert.equal(strategy.partyStrategy.promoted, true)
  assert.equal(strategy.boss.key, "kraken")
  assert.match(rendered, /^Boss: Kraken\nOpening:/)
  assert.match(rendered, /Black Wizard exploit Kraken's weakness with their strongest learned lightning spell/)
  assert.doesNotMatch(rendered, /White Mage|cast Dia/)
})

test("renders console output without exposing rule mechanics", () => {
  const rendered = engine.render(engine.analyze(["red-mage"]))

  assert.match(rendered, /^Party \(front first; class promotion: no\): Red Mage\nStrengths:/)
  assert.match(rendered, /Physical and magical offense/)
  assert.match(rendered, /Weaknesses:/)
  assert.match(rendered, /no backup action/)
  assert.doesNotMatch(rendered, /None identified/)

  const output: string[] = []
  runConsole(engine, ["black-mage"], (line) => output.push(line))
  assert.match(output[0], /^Party \(front first; class promotion: no\): Black Mage\nStrengths:/)
  assert.match(output[0], /Without a conventional healer/)
  assert.match(output[0], /no backup action/)

  const promoted = engine.render(engine.analyze(["warrior", "black-mage"], true))
  assert.match(
    promoted,
    /^Party \(front first; class promotion: yes\): Knight \/ Black Wizard\nStrengths:/,
  )
})

test("rejects invalid or unreachable YAML rule definitions", async () => {
  const loadWithStrategy = (strategy: string) => loadPartyStrategyEngine(
    (path) => path === partyStrategyYamlFile ? Promise.resolve(strategy) : loadProjectFile(path),
  )

  await assert.rejects(
    loadWithStrategy(`rules:
  - id: duplicate
    kind: strength
    when: always
    statement: One.
  - id: duplicate
    kind: weakness
    when: always
    statement: Two.
`),
    /Duplicate party strategy rule ids: duplicate/,
  )
  await assert.rejects(
    loadWithStrategy(`rules:
  - id: promoted-class
    kind: strength
    when:
      job: knight
    statement: Invalid.
`),
    /Unknown party strategy class: knight/,
  )
  await assert.rejects(
    loadWithStrategy(`rules:
  - id: unknown-capability
    kind: strength
    when:
      capability: time-magic
    statement: Invalid.
`),
    /Unknown party strategy capability: time-magic/,
  )
  await assert.rejects(
    loadWithStrategy(`rules:
  - id: trivial-same-member
    kind: strength
    when:
      sameMemberCapabilities:
        - hp-recovery
    statement: Invalid.
`),
    /sameMemberCapabilities must combine at least two distinct capabilities/,
  )
  await assert.rejects(
    loadWithStrategy(`rules:
  - id: impossible-front
    kind: strength
    when:
      front: invincible
    statement: Invalid.
`),
    /Unknown party strategy front-line suitability: invincible/,
  )
})
