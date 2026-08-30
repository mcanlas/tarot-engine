import { parse } from "yaml"

import {
  buildFinalFantasyCatalog,
  buildFinalFantasyStrategyEngine,
  finalFantasyStrategyYamlFiles,
  type BossDefinition,
  type BossStrategyDefinition,
  type BossStrategyRuleDefinition,
  type ClassDefinition,
  type FinalFantasyStrategyDefinitions,
  type FinalFantasyStrategyEngine,
  type FinalFantasyCatalog,
  type PartyConditionDefinition,
  type SpellDefinition,
} from "./strategy-core.ts"

export type YamlTextLoader = (path: string) => Promise<string>

export async function loadFinalFantasyCatalog(
  loadText: YamlTextLoader,
): Promise<FinalFantasyCatalog> {
  const [classes, spells] = await Promise.all([
    loadYaml(finalFantasyStrategyYamlFiles.classes, loadText),
    loadYaml(finalFantasyStrategyYamlFiles.spells, loadText),
  ])

  return buildFinalFantasyCatalog(
    requireArray(classes, "classes").map(decodeClass),
    requireArray(spells, "spells").map(decodeSpell),
  )
}

export async function loadFinalFantasyStrategyEngine(
  loadText: YamlTextLoader,
): Promise<FinalFantasyStrategyEngine> {

  return buildFinalFantasyStrategyEngine(
    await loadFinalFantasyStrategyDefinitions(loadText),
  )
}

export async function loadFinalFantasyStrategyDefinitions(
  loadText: YamlTextLoader,
): Promise<FinalFantasyStrategyDefinitions> {
  const [classes, spells, bosses, strategy] = await Promise.all([
    loadYaml(finalFantasyStrategyYamlFiles.classes, loadText),
    loadYaml(finalFantasyStrategyYamlFiles.spells, loadText),
    loadYaml(finalFantasyStrategyYamlFiles.bosses, loadText),
    loadYaml(finalFantasyStrategyYamlFiles.bossStrategy, loadText),
  ])

  return decodeDefinitions({ classes, spells, bosses, strategy })
}

export function decodeDefinitions(documents: {
  classes: unknown
  spells: unknown
  bosses: unknown
  strategy: unknown
}): FinalFantasyStrategyDefinitions {

  return {
    classes: requireArray(documents.classes, "classes").map(decodeClass),
    spells: requireArray(documents.spells, "spells").map(decodeSpell),
    bosses: requireArray(documents.bosses, "bosses").map(decodeBoss),
    strategy: decodeStrategy(documents.strategy),
  }
}

async function loadYaml(path: string, loadText: YamlTextLoader): Promise<unknown> {
  const text = await loadText(path)

  if (text.trim().length === 0) {
    throw new Error(`YAML data is empty: ${path}`)
  }

  try {

    return parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid ${path}: ${message}`)
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

function decodeStrategy(value: unknown): BossStrategyDefinition {
  const record = requireRecord(value, "strategy")

  return {
    rules: requireArray(record.rules, "strategy.rules").map(decodeRule),
  }
}

function decodeRule(value: unknown, index: number): BossStrategyRuleDefinition {
  const record = requireRecord(value, `strategy.rules[${index}]`)

  return {
    ...(record.boss === undefined ? {} : { boss: requireString(record.boss, `strategy.rules[${index}].boss`) }),
    ...(record.bossTag === undefined ? {} : { bossTag: requireString(record.bossTag, `strategy.rules[${index}].bossTag`) }),
    ...(record.bossTrait === undefined
      ? {}
      : { bossTrait: requireString(record.bossTrait, `strategy.rules[${index}].bossTrait`) }),
    section: requireString(record.section, `strategy.rules[${index}].section`),
    when: decodeCondition(record.when, `strategy.rules[${index}].when`),
    advice: requireString(record.advice, `strategy.rules[${index}].advice`),
  }
}

function decodeCondition(value: unknown, path: string): PartyConditionDefinition {
  if (typeof value === "string") {
    if (value !== "always") {
      throw new Error(`Unknown boss strategy condition: ${value}`)
    }

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

  if (operations.length !== 1) {
    throw new Error(`${path} must have exactly one operation`)
  }

  const operation = operations[0]

  if (operation === "all") {
    const conditions = requireArray(record.all, `${path}.all`)
      .map((condition, index) => decodeCondition(condition, `${path}.all[${index}]`))

    return { all: conditions }
  }

  if (operation === "not") {

    return { not: decodeCondition(record.not, `${path}.not`) }
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

  const atLeast = record.atLeast === undefined
    ? {}
    : { atLeast: requireNumber(record.atLeast, `${path}.atLeast`) }

  if (operation === "job") {

    return { job: requireString(record.job, `${path}.job`), ...atLeast }
  }

  if (operation === "capability") {

    return { capability: requireString(record.capability, `${path}.capability`), ...atLeast }
  }

  if (operation === "spell") {

    return { spell: requireString(record.spell, `${path}.spell`), ...atLeast }
  }

  return {
    spellAttribute: requireString(record.spellAttribute, `${path}.spellAttribute`),
    ...atLeast,
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
