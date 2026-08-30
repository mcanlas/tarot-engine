import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { parse } from "yaml"

import {
  FinalFantasyPartyStrategyEngine,
  type PartyStrategy,
  type PartyStrategyConditionDefinition as PartyConditionDefinition,
  type PartyStrategyRuleDefinition as PartyRuleDefinition,
} from "../../../main/ts/final-fantasy/party-strategy-core.ts"
import {
  createFullToolkitParty,
  type BossDefinition,
  type BossGuide,
  type FinalFantasyStrategyEngine,
  type GuideSectionId,
} from "../../../main/ts/final-fantasy/strategy-core.ts"
import {
  loadFinalFantasyCatalog,
  type YamlTextLoader,
} from "../../../main/ts/final-fantasy/strategy-data.ts"

export const partyStrategyYamlFile = "data/final-fantasy-party-strategy.yaml"

export interface RandomPartyBossStrategy {
  partyStrategy: PartyStrategy
  boss: BossDefinition
  bossGuide: BossGuide
}

export async function loadFinalFantasyPartyStrategyEngine(
  loadText: YamlTextLoader,
): Promise<FinalFantasyPartyStrategyEngine> {
  const [catalog, strategyText] = await Promise.all([
    loadFinalFantasyCatalog(loadText),
    loadText(partyStrategyYamlFile),
  ])
  const document = parse(strategyText)

  return new FinalFantasyPartyStrategyEngine(catalog, decodeRules(document))
}

export function runConsole(
  engine: FinalFantasyPartyStrategyEngine,
  args: readonly string[],
  write: (line: string) => void = console.log,
): void {
  write(engine.render(engine.analyze(args)))
}

export function createRandomPartyBossStrategy(
  partyEngine: FinalFantasyPartyStrategyEngine,
  bossEngine: FinalFantasyStrategyEngine,
  random: () => number = Math.random,
): RandomPartyBossStrategy {
  const classIds = partyEngine.createRandomParty(random)
  const boss = bossEngine.selectRandomBoss(random)
  const party = createFullToolkitParty(bossEngine.catalog, classIds)

  return {
    partyStrategy: partyEngine.analyze(classIds),
    boss,
    bossGuide: bossEngine.guideFor(party, boss.key),
  }
}

export function renderBossStrategy(strategy: RandomPartyBossStrategy): string {
  const lines = [`Boss: ${strategy.boss.name}`]
  const sections: readonly GuideSectionId[] = ["opening", "party-edge", "safety"]

  for (const section of sections) {
    const fragments = strategy.bossGuide.fragments.filter((fragment) => fragment.section === section)
    if (fragments.length === 0) {
      continue
    }
    lines.push(`${section === "party-edge" ? "Party edge" : capitalize(section)}:`)
    lines.push(...fragments.map((fragment) => `- ${fragment.advice}`))
  }

  return lines.join("\n")
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

function decodeRules(value: unknown): PartyRuleDefinition[] {
  const document = requireRecord(value, "party strategy")

  return requireArray(document.rules, "party strategy.rules").map((rule, index) => {
    const path = `party strategy.rules[${index}]`
    const record = requireRecord(rule, path)
    const kind = requireString(record.kind, `${path}.kind`)
    if (kind !== "strength" && kind !== "weakness") {
      throw new Error(`${path}.kind must be strength or weakness`)
    }

    return {
      id: requireString(record.id, `${path}.id`),
      kind,
      when: decodeCondition(record.when, `${path}.when`),
      statement: requireString(record.statement, `${path}.statement`),
    }
  })
}

function decodeCondition(value: unknown, path: string): PartyConditionDefinition {
  if (value === "always") {
    return value
  }
  const record = requireRecord(value, path)
  const operations = [
    "job",
    "capability",
    "sizeAtLeast",
    "distinctJobsAtLeast",
    "repeatedJobAtLeast",
    "sameMemberCapabilities",
    "front",
    "behindFront",
    "all",
    "not",
  ]
    .filter((key) => record[key] !== undefined)
  if (operations.length !== 1) {
    throw new Error(`${path} must have exactly one operation`)
  }

  if (operations[0] === "all") {
    return {
      all: requireArray(record.all, `${path}.all`)
        .map((condition, index) => decodeCondition(condition, `${path}.all[${index}]`)),
    }
  }
  if (operations[0] === "not") {
    return { not: decodeCondition(record.not, `${path}.not`) }
  }
  if (operations[0] === "sizeAtLeast") {
    return { sizeAtLeast: requireNumber(record.sizeAtLeast, `${path}.sizeAtLeast`) }
  }
  if (operations[0] === "distinctJobsAtLeast") {
    return {
      distinctJobsAtLeast: requireNumber(record.distinctJobsAtLeast, `${path}.distinctJobsAtLeast`),
    }
  }
  if (operations[0] === "repeatedJobAtLeast") {
    return {
      repeatedJobAtLeast: requireNumber(record.repeatedJobAtLeast, `${path}.repeatedJobAtLeast`),
    }
  }
  if (operations[0] === "sameMemberCapabilities") {
    return {
      sameMemberCapabilities: requireArray(
        record.sameMemberCapabilities,
        `${path}.sameMemberCapabilities`,
      ).map((capability, index) => requireString(
        capability,
        `${path}.sameMemberCapabilities[${index}]`,
      )),
    }
  }
  if (operations[0] === "front") {
    return { front: requireString(record.front, `${path}.front`) }
  }
  if (operations[0] === "behindFront") {
    return { behindFront: requireString(record.behindFront, `${path}.behindFront`) }
  }

  const atLeast = record.atLeast === undefined
    ? {}
    : { atLeast: requireNumber(record.atLeast, `${path}.atLeast`) }

  return operations[0] === "job"
    ? { job: requireString(record.job, `${path}.job`), ...atLeast }
    : { capability: requireString(record.capability, `${path}.capability`), ...atLeast }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`)
  }

  return value as Record<string, unknown>
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`)
  }

  return value
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`)
  }

  return value
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`)
  }

  return value
}

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const engine = await loadFinalFantasyPartyStrategyEngine(loadProjectFile)
    runConsole(engine, process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
