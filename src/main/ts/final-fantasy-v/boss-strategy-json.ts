import {
  bossScoreDimensions,
  type BossCapabilityDefinition,
  type BossCapabilityProviderDefinition,
  type BossFactDefinition,
  type BossPartyConditionDefinition,
  type BossProfileDefinition,
  type BossRuleDefinition,
  type BossScoreDimension,
  type BossStrategyAssumptionDefinition,
  type BossStrategyDefinitions,
  type BossTrait,
  type BossThreat,
  type Element,
} from "./boss-strategy.ts"

const elements = new Set<Element>([
  "fire",
  "ice",
  "lightning",
  "wind",
  "water",
  "earth",
  "poison",
  "holy",
])
const threats = new Set<BossThreat>([
  "physical-damage",
  "magical-damage",
  "hp-collapse",
  "paralysis",
  "poison",
  "darkness",
  "silence",
  "sleep",
  "instant-death",
  "confusion",
  "slow",
  "sap",
  "mp-pressure",
  "level-reduction",
])
const traits = new Set<BossTrait>([
  "form-shifting",
  "counterattacks",
  "multiple-targets",
  "reinforcement",
  "elemental-absorption",
  "target-decoys",
  "timed-encounter",
  "status-vulnerable",
  "self-healing",
])

export function decodeBossStrategy(
  value: unknown,
): BossStrategyDefinitions {
  const document = requireRecord(value, "Final Fantasy V boss strategy")

  return {
    bosses: requireArray(document.bosses, "Final Fantasy V boss strategy.bosses")
      .map(decodeBoss),
    assumptions: requireArray(
      document.assumptions,
      "Final Fantasy V boss strategy.assumptions",
    ).map(decodeAssumption),
    capabilities: requireArray(
      document.capabilities,
      "Final Fantasy V boss strategy.capabilities",
    ).map(decodeCapability),
    rules: requireArray(document.rules, "Final Fantasy V boss strategy.rules").map(decodeRule),
  }
}

function decodeBoss(value: unknown, index: number): BossProfileDefinition {
  const path = `Final Fantasy V boss strategy.bosses[${index}]`
  const record = requireRecord(value, path)

  return {
    boss: requireString(record.boss, `${path}.boss`),
    targetCount: requirePositiveInteger(record.targetCount, `${path}.targetCount`),
    vulnerabilities: requireArray(record.vulnerabilities, `${path}.vulnerabilities`)
      .map((element, elementIndex) => requireElement(
        element,
        `${path}.vulnerabilities[${elementIndex}]`,
      )),
    traits: requireArray(record.traits, `${path}.traits`)
      .map((trait, traitIndex) => requireTrait(trait, `${path}.traits[${traitIndex}]`)),
    threats: requireArray(record.threats, `${path}.threats`)
      .map((threat, threatIndex) => decodeThreat(
        threat,
        `${path}.threats[${threatIndex}]`,
      )),
  }
}

function decodeThreat(
  value: unknown,
  path: string,
): BossProfileDefinition["threats"][number] {
  const record = requireRecord(value, path)

  return {
    source: requireString(record.source, `${path}.source`),
    kind: requireThreat(record.kind, `${path}.kind`),
  }
}

function decodeAssumption(
  value: unknown,
  index: number,
): BossStrategyAssumptionDefinition {
  const path = `Final Fantasy V boss strategy.assumptions[${index}]`
  const record = requireRecord(value, path)

  return {
    id: requireString(record.id, `${path}.id`),
    statement: requireString(record.statement, `${path}.statement`),
  }
}

function decodeCapability(
  value: unknown,
  index: number,
): BossCapabilityDefinition {
  const path = `Final Fantasy V boss strategy.capabilities[${index}]`
  const record = requireRecord(value, path)

  return {
    key: requireString(record.key, `${path}.key`),
    providers: requireArray(record.providers, `${path}.providers`)
      .map((provider, providerIndex) => decodeProvider(
        provider,
        `${path}.providers[${providerIndex}]`,
      )),
  }
}

function decodeProvider(
  value: unknown,
  path: string,
): BossCapabilityProviderDefinition {
  const record = requireRecord(value, path)

  return {
    ability: requireString(record.ability, `${path}.ability`),
    ...(record.atLeastRank === undefined
      ? {}
      : { atLeastRank: requireNumber(record.atLeastRank, `${path}.atLeastRank`) }),
  }
}

function decodeRule(value: unknown, index: number): BossRuleDefinition {
  const path = `Final Fantasy V boss strategy.rules[${index}]`
  const record = requireRecord(value, path)
  const when = requireRecord(record.when, `${path}.when`)

  return {
    id: requireString(record.id, `${path}.id`),
    when: {
      boss: decodeBossFact(when.boss, `${path}.when.boss`),
      party: decodePartyCondition(when.party, `${path}.when.party`),
    },
    score: decodeScore(record.score, `${path}.score`),
    statement: requireString(record.statement, `${path}.statement`),
  }
}

function decodeBossFact(value: unknown, path: string): BossFactDefinition {
  const record = requireRecord(value, path)
  const operations = ["vulnerability", "threat", "trait"]
    .filter((operation) => record[operation] !== undefined)
  if (operations.length !== 1) {
    throw new Error(`${path} must define exactly one boss fact`)
  }

  if (operations[0] === "vulnerability") {
    return { vulnerability: requireElement(record.vulnerability, `${path}.vulnerability`) }
  }
  if (operations[0] === "threat") {
    return { threat: requireThreat(record.threat, `${path}.threat`) }
  }

  return { trait: requireTrait(record.trait, `${path}.trait`) }
}

function decodePartyCondition(
  value: unknown,
  path: string,
): BossPartyConditionDefinition {
  const record = requireRecord(value, path)

  return {
    capability: requireString(record.capability, `${path}.capability`),
    ...(record.atLeastMembers === undefined
      ? {}
      : { atLeastMembers: requireNumber(record.atLeastMembers, `${path}.atLeastMembers`) }),
    ...(record.atMostMembers === undefined
      ? {}
      : { atMostMembers: requireNumber(record.atMostMembers, `${path}.atMostMembers`) }),
  }
}

function decodeScore(
  value: unknown,
  path: string,
): Readonly<Partial<Record<BossScoreDimension, number>>> {
  const record = requireRecord(value, path)
  const unknown = Object.keys(record).filter((key) =>
    !bossScoreDimensions.includes(key as BossScoreDimension))
  if (unknown.length > 0) {
    throw new Error(`${path} has unknown dimensions: ${unknown.join(", ")}`)
  }

  return Object.fromEntries(Object.entries(record).map(([dimension, score]) => [
    dimension,
    requireNumber(score, `${path}.${dimension}`),
  ]))
}

function requireElement(value: unknown, path: string): Element {
  const element = requireString(value, path)
  if (!elements.has(element as Element)) {
    throw new Error(`${path} must be a known element`)
  }

  return element as Element
}

function requireThreat(value: unknown, path: string): BossThreat {
  const threat = requireString(value, path)
  if (!threats.has(threat as BossThreat)) {
    throw new Error(`${path} must be a known boss threat`)
  }

  return threat as BossThreat
}

function requireTrait(value: unknown, path: string): BossTrait {
  const trait = requireString(value, path)
  if (!traits.has(trait as BossTrait)) {
    throw new Error(`${path} must be a known boss trait`)
  }

  return trait as BossTrait
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

function requirePositiveInteger(value: unknown, path: string): number {
  const number = requireNumber(value, path)
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${path} must be a positive integer`)
  }

  return number
}
