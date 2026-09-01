import type {
  CapabilityId,
  StrategyCatalog,
  FrontlineSuitabilityId,
  Job,
} from "./strategy-core.ts"

export type PartyObservationKind = "strength" | "weakness"

export interface PartyObservation {
  ruleId: string
  kind: PartyObservationKind
  statement: string
}

export interface PartyStrategy {
  party: readonly string[]
  promoted: boolean
  observations: readonly PartyObservation[]
}

export interface RandomPartyState {
  classIds: readonly string[]
  promoted: boolean
}

export type PartyStrategyConditionDefinition =
  | "always"
  | { job: string; atLeast?: number }
  | { capability: string; atLeast?: number }
  | { sizeAtLeast: number }
  | { distinctJobsAtLeast: number }
  | { repeatedJobAtLeast: number }
  | { sameMemberCapabilities: string[] }
  | { front: string }
  | { behindFront: string }
  | { all: PartyStrategyConditionDefinition[] }
  | { not: PartyStrategyConditionDefinition }

export interface PartyStrategyRuleDefinition {
  id: string
  kind: PartyObservationKind
  when: PartyStrategyConditionDefinition
  statement: string
}

interface PartyMemberProfile {
  baseJob: Job
  job: Job
  capabilities: ReadonlySet<CapabilityId>
}

interface PartyRule {
  id: string
  kind: PartyObservationKind
  matches: (party: readonly PartyMemberProfile[]) => boolean
  statement: string
}

export class PartyStrategyEngine {
  readonly classIds: readonly string[]
  readonly ruleIds: readonly string[]
  readonly ruleCount: number
  readonly #catalog: StrategyCatalog
  readonly #rules: readonly PartyRule[]

  constructor(catalog: StrategyCatalog, definitions: readonly PartyStrategyRuleDefinition[]) {
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

  analyze(classNames: readonly string[], promoted = false): PartyStrategy {
    if (classNames.length < 1 || classNames.length > 4) {
      throw new Error("Expected 1 to 4 character classes.")
    }

    const party = classNames.map((className) => this.#profileFor(className, promoted))
    const observations = this.#rules
      .filter((rule) => rule.matches(party))
      .map(({ id: ruleId, kind, statement }) => ({ ruleId, kind, statement }))

    return { party: party.map((member) => member.baseJob.id), promoted, observations }
  }

  createRandomParty(random: () => number = Math.random): RandomPartyState {
    const partySize = randomIndex(4, random) + 1
    const classIds = Array.from(
      { length: partySize },
      () => this.classIds[randomIndex(this.classIds.length, random)] ?? "",
    )

    return { classIds, promoted: randomIndex(2, random) === 1 }
  }

  render(strategy: PartyStrategy): string {
    const lines = [
      `Party (front first; class promotion: ${strategy.promoted ? "yes" : "no"}): ${strategy.party
        .map((id) => this.#activeJob(id, strategy.promoted).name)
        .join(" / ")}`,
    ]

    for (const kind of ["strength", "weakness"] as const) {
      const statements = strategy.observations.filter((observation) => observation.kind === kind)
      lines.push(`${kind === "strength" ? "Strengths" : "Weaknesses"}:`)
      lines.push(...(statements.length === 0
        ? ["- None identified by the current rules."]
        : statements.map((observation) => `- ${observation.statement}`)))
    }

    return lines.join("\n")
  }

  #profileFor(id: string, promoted: boolean): PartyMemberProfile {
    const baseJob = this.#requireStartingJob(id)
    const job = this.#activeJob(id, promoted)
    const capabilities = new Set(job.capabilities)

    const spellCapabilities = [
      "healing",
      "offensive-magic",
      "defensive-magic",
      "physical-support",
      "control-magic",
      "anti-undead",
    ] as const
    for (const spell of this.#catalog.spells.values()) {
      if (!spell.learnableBy.has(job.id)) {
        continue
      }
      for (const capability of spellCapabilities) {
        if (spell.attributes.has(capability)) {
          capabilities.add(capability)
        }
      }
    }

    return { baseJob, job, capabilities }
  }

  #activeJob(id: string, promoted: boolean): Job {
    const baseJob = this.#requireStartingJob(id)
    if (!promoted) {

      return baseJob
    }
    const promotion = baseJob.promotion
    if (promotion === undefined) {
      throw new Error(`Character class ${baseJob.id} does not have a promotion`)
    }
    const activeJob = this.#catalog.jobs.get(promotion)
    if (activeJob === undefined) {
      throw new Error(`Unknown promotion for ${baseJob.id}: ${baseJob.promotion}`)
    }

    return activeJob
  }

  #requireStartingJob(id: string): Job {
    const job = this.#catalog.jobs.get(id)
    if (job === undefined || job.promotion === undefined) {
      throw new Error(`Unknown character class: ${id}. Expected one of: ${this.classIds.join(", ")}.`)
    }

    return job
  }
}

function randomIndex(length: number, random: () => number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`Random source must return a number from 0 up to, but not including, 1: ${value}`)
  }

  return Math.floor(value * length)
}

function buildRule(
  definition: PartyStrategyRuleDefinition,
  catalog: StrategyCatalog,
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
  catalog: StrategyCatalog,
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

    return (party) => party.filter((member) => member.baseJob.id === definition.job).length >= atLeast
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

    return (party) => new Set(party.map((member) => member.baseJob.id)).size >= count
  }
  if ("repeatedJobAtLeast" in definition) {
    const count = requireCount(definition.repeatedJobAtLeast)

    return (party) => party.some((member) =>
      party.filter((candidate) => candidate.baseJob.id === member.baseJob.id).length >= count,
    )
  }
  if ("sameMemberCapabilities" in definition) {
    const required = [...new Set(definition.sameMemberCapabilities.map(requireCapability))]
    if (required.length < 2) {
      throw new Error("sameMemberCapabilities must combine at least two distinct capabilities")
    }

    return (party) => party.some((member) =>
      required.every((capability) => member.capabilities.has(capability)))
  }
  if ("front" in definition) {
    const suitability = requireFrontlineSuitability(definition.front)

    return (party) => party[0]?.job.frontlineSuitability === suitability
  }
  if ("behindFront" in definition) {
    const suitability = requireFrontlineSuitability(definition.behindFront)

    return (party) => party.slice(1)
      .some((member) => member.job.frontlineSuitability === suitability)
  }
  if ("all" in definition) {
    const conditions = definition.all.map((condition) => buildCondition(condition, catalog))

    return (party) => conditions.every((condition) => condition(party))
  }

  const condition = buildCondition(definition.not, catalog)

  return (party) => !condition(party)
}

function requireCapability(value: string): CapabilityId {
  if (
    value !== "physical-damage"
    && value !== "healing"
    && value !== "offensive-magic"
    && value !== "defensive-magic"
    && value !== "physical-support"
    && value !== "control-magic"
    && value !== "anti-undead"
  ) {
    throw new Error(`Unknown party strategy capability: ${value}`)
  }

  return value
}

function requireFrontlineSuitability(value: string): FrontlineSuitabilityId {
  if (value !== "primary" && value !== "fallback" && value !== "fragile") {
    throw new Error(`Unknown party strategy front-line suitability: ${value}`)
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
