import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { parse } from "yaml"

import type {
  CapabilityId,
  FinalFantasyCatalog,
  Job,
} from "../../main/ts/final-fantasy-strategy-core.ts"
import {
  loadFinalFantasyCatalog,
  type YamlTextLoader,
} from "../../main/ts/final-fantasy-strategy-data.ts"

export const partyStrategyYamlFile = "data/final-fantasy-party-strategy.yaml"

export type PartyObservationKind = "strength" | "weakness"

export interface PartyObservation {
  ruleId: string
  kind: PartyObservationKind
  statement: string
}

export interface PartyStrategy {
  party: readonly string[]
  observations: readonly PartyObservation[]
}

type PartyConditionDefinition =
  | "always"
  | { job: string; atLeast?: number }
  | { capability: string; atLeast?: number }
  | { sizeAtLeast: number }
  | { distinctJobsAtLeast: number }
  | { repeatedJobAtLeast: number }
  | { all: PartyConditionDefinition[] }
  | { not: PartyConditionDefinition }

interface PartyRuleDefinition {
  id: string
  kind: PartyObservationKind
  when: PartyConditionDefinition
  statement: string
}

interface PartyMemberProfile {
  job: Job
  capabilities: ReadonlySet<CapabilityId>
}

interface PartyRule {
  id: string
  kind: PartyObservationKind
  matches: (party: readonly PartyMemberProfile[]) => boolean
  statement: string
}

export class FinalFantasyPartyStrategyEngine {
  readonly classIds: readonly string[]
  readonly ruleIds: readonly string[]
  readonly ruleCount: number
  readonly #catalog: FinalFantasyCatalog
  readonly #rules: readonly PartyRule[]

  constructor(catalog: FinalFantasyCatalog, definitions: readonly PartyRuleDefinition[]) {
    this.#catalog = catalog
    this.classIds = [...catalog.jobs.values()]
      .filter((job) => job.promotion !== undefined)
      .map((job) => job.id)
    const duplicateRuleIds = definitions
      .map((definition) => definition.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index)
    if (duplicateRuleIds.length > 0) {
      throw new Error(`Duplicate party strategy rule ids: ${[...new Set(duplicateRuleIds)].join(", ")}`)
    }
    this.#rules = definitions.map((definition) => buildRule(definition, catalog))
    this.ruleIds = this.#rules.map((rule) => rule.id)
    this.ruleCount = this.#rules.length
  }

  analyze(classNames: readonly string[]): PartyStrategy {
    if (classNames.length < 1 || classNames.length > 4) {
      throw new Error("Expected 1 to 4 character classes.")
    }

    const party = classNames.map((className) => this.#profileFor(className))
    const observations = this.#rules
      .filter((rule) => rule.matches(party))
      .map(({ id: ruleId, kind, statement }) => ({ ruleId, kind, statement }))

    return { party: party.map((member) => member.job.id), observations }
  }

  render(strategy: PartyStrategy): string {
    const lines = [`Party: ${strategy.party.map((id) => this.#requireStartingJob(id).name).join(" / ")}`]

    for (const kind of ["strength", "weakness"] as const) {
      const statements = strategy.observations.filter((observation) => observation.kind === kind)
      lines.push(`${kind === "strength" ? "Strengths" : "Weaknesses"}:`)
      lines.push(...(statements.length === 0
        ? ["- None identified by the current rules."]
        : statements.map((observation) => `- ${observation.statement}`)))
    }

    return lines.join("\n")
  }

  #profileFor(id: string): PartyMemberProfile {
    const job = this.#requireStartingJob(id)
    const capabilities = new Set(job.capabilities)

    for (const spell of this.#catalog.spells.values()) {
      if (!spell.learnableBy.has(job.id)) {
        continue
      }
      if (spell.attributes.has("healing")) {
        capabilities.add("healing")
      }
      if (spell.attributes.has("offensive-magic")) {
        capabilities.add("offensive-magic")
      }
    }

    return { job, capabilities }
  }

  #requireStartingJob(id: string): Job {
    const job = this.#catalog.jobs.get(id)
    if (job === undefined || job.promotion === undefined) {
      throw new Error(`Unknown character class: ${id}. Expected one of: ${this.classIds.join(", ")}.`)
    }

    return job
  }
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

function buildRule(definition: PartyRuleDefinition, catalog: FinalFantasyCatalog): PartyRule {
  return {
    id: definition.id,
    kind: definition.kind,
    matches: buildCondition(definition.when, catalog),
    statement: definition.statement,
  }
}

function buildCondition(
  definition: PartyConditionDefinition,
  catalog: FinalFantasyCatalog,
): (party: readonly PartyMemberProfile[]) => boolean {
  if (definition === "always") {
    return () => true
  }
  if ("job" in definition) {
    const job = catalog.jobs.get(definition.job)
    if (job === undefined || job.promotion === undefined) {
      throw new Error(`Unknown party strategy class: ${definition.job}`)
    }
    const atLeast = requireCount(definition.atLeast)

    return (party) => party.filter((member) => member.job.id === definition.job).length >= atLeast
  }
  if ("capability" in definition) {
    const capability = requireCapability(definition.capability)
    const atLeast = requireCount(definition.atLeast)

    return (party) => party.filter((member) => member.capabilities.has(capability)).length >= atLeast
  }
  if ("sizeAtLeast" in definition) {
    const size = requireCount(definition.sizeAtLeast)

    return (party) => party.length >= size
  }
  if ("distinctJobsAtLeast" in definition) {
    const count = requireCount(definition.distinctJobsAtLeast)

    return (party) => new Set(party.map((member) => member.job.id)).size >= count
  }
  if ("repeatedJobAtLeast" in definition) {
    const count = requireCount(definition.repeatedJobAtLeast)

    return (party) => party.some((member) =>
      party.filter((candidate) => candidate.job.id === member.job.id).length >= count,
    )
  }
  if ("all" in definition) {
    const conditions = definition.all.map((condition) => buildCondition(condition, catalog))

    return (party) => conditions.every((condition) => condition(party))
  }

  const condition = buildCondition(definition.not, catalog)

  return (party) => !condition(party)
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

  const atLeast = record.atLeast === undefined
    ? {}
    : { atLeast: requireNumber(record.atLeast, `${path}.atLeast`) }

  return operations[0] === "job"
    ? { job: requireString(record.job, `${path}.job`), ...atLeast }
    : { capability: requireString(record.capability, `${path}.capability`), ...atLeast }
}

function requireCapability(value: string): CapabilityId {
  if (value !== "physical-damage" && value !== "healing" && value !== "offensive-magic") {
    throw new Error(`Unknown party strategy capability: ${value}`)
  }

  return value
}

function requireCount(value: number | undefined): number {
  const count = value ?? 1
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Party strategy count must be a positive integer: ${count}`)
  }

  return count
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
  readFile(new URL(`../../../${path}`, import.meta.url), "utf8")

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const engine = await loadFinalFantasyPartyStrategyEngine(loadProjectFile)
    runConsole(engine, process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
