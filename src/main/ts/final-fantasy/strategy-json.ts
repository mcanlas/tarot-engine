import {
  type BossDefinition,
  type BossStrategyDefinition,
  type BossStrategyRuleDefinition,
  type ClassDefinition,
  type FinalFantasyStrategyDefinitions,
  type PartyConditionDefinition,
  type SpellDefinition,
} from "./strategy-core.ts"
import type {
  PartyStrategyConditionDefinition,
  PartyStrategyRuleDefinition,
} from "./party-strategy-core.ts"

export interface FinalFantasyStrategyPayload {
  definitions: FinalFantasyStrategyDefinitions
  partyRules: PartyStrategyRuleDefinition[]
}

export function decodeStrategyPayload(value: unknown): FinalFantasyStrategyPayload {
  const payload = requireRecord(value, "strategy payload")

  return {
    definitions: {
      classes: requireArray(payload.classes, "classes").map(decodeClass),
      spells: requireArray(payload.spells, "spells").map(decodeSpell),
      bosses: requireArray(payload.bosses, "bosses").map(decodeBoss),
      strategy: decodeBossStrategy(payload.strategy),
    },
    partyRules: decodePartyRules(payload.partyStrategy),
  }
}

function decodeClass(value: unknown, index: number): ClassDefinition {
  const record = requireRecord(value, `classes[${index}]`)
  const promotion = requireRecord(record.promotion, `classes[${index}].promotion`)

  return {
    class: requireString(record.class, `classes[${index}].class`),
    name: requireString(record.name, `classes[${index}].name`),
    plural: requireString(record.plural, `classes[${index}].plural`),
    attackerPriority: requireNumber(record.attackerPriority, `classes[${index}].attackerPriority`),
    frontlineSuitability: requireString(
      record.frontlineSuitability,
      `classes[${index}].frontlineSuitability`,
    ),
    promotion: {
      class: requireString(promotion.class, `classes[${index}].promotion.class`),
      name: requireString(promotion.name, `classes[${index}].promotion.name`),
      plural: requireString(promotion.plural, `classes[${index}].promotion.plural`),
    },
    attributes: requireStringArray(record.attributes, `classes[${index}].attributes`),
  }
}

function decodeSpell(value: unknown, index: number): SpellDefinition {
  const record = requireRecord(value, `spells[${index}]`)

  return {
    spell: requireString(record.spell, `spells[${index}].spell`),
    name: requireString(record.name, `spells[${index}].name`),
    learnableBy: requireStringArray(record.learnableBy, `spells[${index}].learnableBy`),
    attributes: requireStringArray(record.attributes, `spells[${index}].attributes`),
  }
}

function decodeBoss(value: unknown, index: number): BossDefinition {
  const record = requireRecord(value, `bosses[${index}]`)

  return {
    key: requireString(record.key, `bosses[${index}].key`),
    name: requireString(record.name, `bosses[${index}].name`),
    ...(record.templateName === undefined
      ? {}
      : { templateName: requireString(record.templateName, `bosses[${index}].templateName`) }),
    tags: record.tags === undefined ? [] : requireStringArray(record.tags, `bosses[${index}].tags`),
    traits: record.traits === undefined
      ? []
      : requireStringArray(record.traits, `bosses[${index}].traits`),
  }
}

function decodeBossStrategy(value: unknown): BossStrategyDefinition {
  const record = requireRecord(value, "strategy")

  return {
    rules: requireArray(record.rules, "strategy.rules").map(decodeBossRule),
  }
}

function decodeBossRule(value: unknown, index: number): BossStrategyRuleDefinition {
  const path = `strategy.rules[${index}]`
  const record = requireRecord(value, path)

  return {
    ...(record.boss === undefined ? {} : { boss: requireString(record.boss, `${path}.boss`) }),
    ...(record.bossTag === undefined ? {} : { bossTag: requireString(record.bossTag, `${path}.bossTag`) }),
    ...(record.bossTrait === undefined
      ? {}
      : { bossTrait: requireString(record.bossTrait, `${path}.bossTrait`) }),
    section: requireString(record.section, `${path}.section`),
    when: decodeBossCondition(record.when, `${path}.when`),
    advice: requireString(record.advice, `${path}.advice`),
  }
}

function decodeBossCondition(value: unknown, path: string): PartyConditionDefinition {
  if (value === "always") {
    return value
  }
  const record = requireRecord(value, path)
  const operations = [
    "job",
    "capability",
    "spell",
    "spellAttribute",
    "item",
    "front",
    "frontSpell",
    "all",
    "not",
  ]
    .filter((key) => record[key] !== undefined)
  requireSingleOperation(operations, path)
  const operation = operations[0]

  if (operation === "all") {
    return { all: requireArray(record.all, `${path}.all`).map((item, index) => decodeBossCondition(item, `${path}.all[${index}]`)) }
  }
  if (operation === "not") {
    return { not: decodeBossCondition(record.not, `${path}.not`) }
  }
  if (operation === "item") {
    return { item: requireString(record.item, `${path}.item`) }
  }
  if (operation === "front") {
    return { front: requireString(record.front, `${path}.front`) }
  }
  if (operation === "frontSpell") {
    return { frontSpell: requireString(record.frontSpell, `${path}.frontSpell`) }
  }
  const atLeast = record.atLeast === undefined ? {} : { atLeast: requireNumber(record.atLeast, `${path}.atLeast`) }

  if (operation === "job") return { job: requireString(record.job, `${path}.job`), ...atLeast }
  if (operation === "capability") return { capability: requireString(record.capability, `${path}.capability`), ...atLeast }
  if (operation === "spell") return { spell: requireString(record.spell, `${path}.spell`), ...atLeast }

  return { spellAttribute: requireString(record.spellAttribute, `${path}.spellAttribute`), ...atLeast }
}

function decodePartyRules(value: unknown): PartyStrategyRuleDefinition[] {
  const document = requireRecord(value, "party strategy")

  return requireArray(document.rules, "party strategy.rules").map((value, index) => {
    const path = `party strategy.rules[${index}]`
    const record = requireRecord(value, path)
    const kind = requireString(record.kind, `${path}.kind`)
    if (kind !== "strength" && kind !== "weakness") {
      throw new Error(`${path}.kind must be strength or weakness`)
    }

    return {
      id: requireString(record.id, `${path}.id`),
      kind,
      when: decodePartyCondition(record.when, `${path}.when`),
      statement: requireString(record.statement, `${path}.statement`),
    }
  })
}

function decodePartyCondition(value: unknown, path: string): PartyStrategyConditionDefinition {
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
  requireSingleOperation(operations, path)
  const operation = operations[0]

  if (operation === "all") {
    return { all: requireArray(record.all, `${path}.all`).map((item, index) => decodePartyCondition(item, `${path}.all[${index}]`)) }
  }
  if (operation === "not") {
    return { not: decodePartyCondition(record.not, `${path}.not`) }
  }
  if (operation === "sizeAtLeast") return { sizeAtLeast: requireNumber(record.sizeAtLeast, `${path}.sizeAtLeast`) }
  if (operation === "distinctJobsAtLeast") return { distinctJobsAtLeast: requireNumber(record.distinctJobsAtLeast, `${path}.distinctJobsAtLeast`) }
  if (operation === "repeatedJobAtLeast") return { repeatedJobAtLeast: requireNumber(record.repeatedJobAtLeast, `${path}.repeatedJobAtLeast`) }
  if (operation === "sameMemberCapabilities") {
    return {
      sameMemberCapabilities: requireStringArray(
        record.sameMemberCapabilities,
        `${path}.sameMemberCapabilities`,
      ),
    }
  }
  if (operation === "front") return { front: requireString(record.front, `${path}.front`) }
  if (operation === "behindFront") {
    return { behindFront: requireString(record.behindFront, `${path}.behindFront`) }
  }

  const atLeast = record.atLeast === undefined ? {} : { atLeast: requireNumber(record.atLeast, `${path}.atLeast`) }

  return operation === "job"
    ? { job: requireString(record.job, `${path}.job`), ...atLeast }
    : { capability: requireString(record.capability, `${path}.capability`), ...atLeast }
}

function requireSingleOperation(operations: string[], path: string): void {
  if (operations.length !== 1) {
    throw new Error(`${path} must have exactly one operation`)
  }
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

function requireStringArray(value: unknown, path: string): string[] {
  return requireArray(value, path).map((item, index) => requireString(item, `${path}[${index}]`))
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`)
  }

  return value
}
