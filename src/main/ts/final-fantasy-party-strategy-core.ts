import type {
  CapabilityId,
  FinalFantasyCatalog,
  Job,
} from "./final-fantasy-strategy-core.ts"

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

export type PartyStrategyConditionDefinition =
  | "always"
  | { job: string; atLeast?: number }
  | { capability: string; atLeast?: number }
  | { sizeAtLeast: number }
  | { distinctJobsAtLeast: number }
  | { repeatedJobAtLeast: number }
  | { all: PartyStrategyConditionDefinition[] }
  | { not: PartyStrategyConditionDefinition }

export interface PartyStrategyRuleDefinition {
  id: string
  kind: PartyObservationKind
  when: PartyStrategyConditionDefinition
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

  constructor(catalog: FinalFantasyCatalog, definitions: readonly PartyStrategyRuleDefinition[]) {
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

function buildRule(
  definition: PartyStrategyRuleDefinition,
  catalog: FinalFantasyCatalog,
): PartyRule {
  if (definition.kind !== "strength" && definition.kind !== "weakness") {
    throw new Error(`Unknown party strategy kind: ${definition.kind}`)
  }

  return {
    id: definition.id,
    kind: definition.kind,
    matches: buildCondition(definition.when, catalog),
    statement: definition.statement,
  }
}

function buildCondition(
  definition: PartyStrategyConditionDefinition,
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
