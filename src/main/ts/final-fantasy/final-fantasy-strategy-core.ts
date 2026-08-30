export const finalFantasyStrategyYamlFiles = Object.freeze({
  classes: "data/final-fantasy-classes.yaml",
  spells: "data/final-fantasy-spells.yaml",
  bosses: "data/final-fantasy-bosses.yaml",
  bossStrategy: "data/final-fantasy-boss-strategy.yaml",
})

export type CapabilityId = "physical-damage" | "healing" | "offensive-magic"

export type SpellAttributeId = "healing" | "offensive-magic" | "elemental" | "anti-undead"

export type ItemId = "potion"

export type EnemyTagId = "undead"

export type GuideSectionId = "opening" | "party-edge" | "safety"

export interface PromotionDefinition {
  class: string
  name: string
  plural: string
}

export interface ClassDefinition {
  class: string
  name: string
  plural: string
  attackerPriority: number
  promotion: PromotionDefinition
  attributes: string[]
}

export interface SpellDefinition {
  spell: string
  name: string
  learnableBy: string[]
  attributes: string[]
}

export interface BossDefinition {
  key: string
  name: string
  templateName?: string
  tags: string[]
}

export type PartyConditionDefinition =
  | "always"
  | { job: string; atLeast?: number }
  | { capability: string; atLeast?: number }
  | { spell: string; atLeast?: number }
  | { spellAttribute: string; atLeast?: number }
  | { item: string }
  | { all: PartyConditionDefinition[] }
  | { not: PartyConditionDefinition }

export interface BossStrategyRuleDefinition {
  boss?: string
  bossGroup?: string
  bossTag?: string
  section: string
  when: PartyConditionDefinition
  advice: string
}

export interface BossStrategyDefinition {
  bossGroups: Record<string, string[]>
  rules: BossStrategyRuleDefinition[]
}

export interface FinalFantasyStrategyDefinitions {
  classes: ClassDefinition[]
  spells: SpellDefinition[]
  bosses: BossDefinition[]
  strategy: BossStrategyDefinition
}

export interface Job {
  id: string
  name: string
  plural: string
  attackerPriority: number
  capabilities: ReadonlySet<CapabilityId>
  promotion?: string
}

export interface Spell {
  id: string
  name: string
  learnableBy: ReadonlySet<string>
  attributes: ReadonlySet<SpellAttributeId>
}

export interface FinalFantasyCatalog {
  jobs: ReadonlyMap<string, Job>
  spells: ReadonlyMap<string, Spell>
}

export interface PartyMember {
  job: Job
  learnedSpells: ReadonlySet<Spell>
}

export interface Party {
  members: readonly PartyMember[]
  inventory: ReadonlySet<ItemId>
}

export interface GuideFragment {
  section: GuideSectionId
  advice: string
}

export interface BossGuide {
  boss: string
  fragments: readonly GuideFragment[]
}

interface BossProfile { key: string; name: string; templateName: string; tags: ReadonlySet<EnemyTagId> }
type PartyCondition = (party: Party) => boolean
type BossCondition = (boss: BossProfile) => boolean
interface MemberSelector {
  select: (party: Party) => readonly PartyMember[]
  qualifier?: string | ((count: number) => string)
}

type AdvicePart = string | ((party: Party, boss: BossProfile) => string)
interface BossStrategyRule {
  bossMatches: BossCondition
  section: GuideSectionId
  partyMatches: PartyCondition
  advice: readonly AdvicePart[]
}

const capabilities = new Set<CapabilityId>(["physical-damage", "healing", "offensive-magic"])
const spellAttributes = new Set<SpellAttributeId>(["healing", "offensive-magic", "elemental", "anti-undead"])
const items = new Set<ItemId>(["potion"])
const enemyTags = new Set<EnemyTagId>(["undead"])
const guideSections = new Set<GuideSectionId>(["opening", "party-edge", "safety"])

export function describeFinalFantasyStrategyCatalog(): string {

  return `TypeScript connected; ${Object.keys(finalFantasyStrategyYamlFiles).length} YAML catalogs configured.`
}

export class FinalFantasyStrategyEngine {
  readonly catalog: FinalFantasyCatalog
  readonly bosses: readonly BossDefinition[]
  readonly ruleCount: number
  readonly #bossProfiles: ReadonlyMap<string, BossProfile>
  readonly #rules: readonly BossStrategyRule[]

  constructor(
    catalog: FinalFantasyCatalog,
    bosses: readonly BossDefinition[],
    bossProfiles: ReadonlyMap<string, BossProfile>,
    rules: readonly BossStrategyRule[],
  ) {
    this.catalog = catalog
    this.bosses = bosses
    this.ruleCount = rules.length
    this.#bossProfiles = bossProfiles
    this.#rules = rules
  }

  guideFor(party: Party, bossKey: string): BossGuide {
    const boss = this.#bossProfiles.get(bossKey) ?? {
      key: bossKey,
      name: bossKey,
      templateName: bossKey,
      tags: new Set<EnemyTagId>(),
    }
    const fragments = this.#rules.flatMap((rule) =>
      rule.bossMatches(boss) && rule.partyMatches(party)
        ? [{ section: rule.section, advice: renderAdvice(rule.advice, party, boss) }]
        : [],
    )

    return { boss: boss.key, fragments }
  }
}

export function buildFinalFantasyStrategyEngine(
  definitions: FinalFantasyStrategyDefinitions,
): FinalFantasyStrategyEngine {
  const catalog = buildFinalFantasyCatalog(definitions.classes, definitions.spells)
  const bossProfiles = buildBossProfiles(definitions.bosses)
  validateBossGroups(definitions.strategy.bossGroups, bossProfiles)
  const rules = definitions.strategy.rules.map((rule, index) =>
    buildRule(rule, index, catalog, definitions.strategy.bossGroups, bossProfiles),
  )

  return new FinalFantasyStrategyEngine(catalog, definitions.bosses, bossProfiles, rules)
}

export function createPartyMember(
  catalog: FinalFantasyCatalog,
  jobId: string,
  learnedSpellIds: readonly string[] = [],
): PartyMember {
  const job = requireJob(catalog, jobId)
  const learnedSpells = learnedSpellIds.map((spellId) => requireSpell(catalog, spellId))
  const invalid = learnedSpells.filter((spell) => !spell.learnableBy.has(job.id))
  if (invalid.length > 0) {
    throw new Error(`${job.name} cannot learn: ${invalid.map((spell) => spell.name).join(", ")}`)
  }

  return { job, learnedSpells: new Set(learnedSpells) }
}

export function promotePartyMember(
  catalog: FinalFantasyCatalog,
  member: PartyMember,
): PartyMember {
  if (member.job.promotion === undefined) {

    return member
  }

  return { job: requireJob(catalog, member.job.promotion), learnedSpells: member.learnedSpells }
}

export function createParty(
  members: readonly PartyMember[],
  inventory: readonly ItemId[] = [],
): Party {

  return { members: [...members], inventory: new Set(inventory) }
}

export function partyMemberLabel(member: PartyMember): string {
  const spells = [...member.learnedSpells].map((spell) => spell.name).sort().join(", ")

  return spells.length === 0 ? member.job.name : `${member.job.name} [${spells}]`
}

export function partyLabel(party: Party): string {

  return party.members.map(partyMemberLabel).join(" / ")
}

export function canUseItem(party: Party, member: PartyMember, item: ItemId): boolean {

  return party.members.includes(member) && party.inventory.has(item)
}

export function buildFinalFantasyCatalog(
  classDefinitions: readonly ClassDefinition[],
  spellDefinitions: readonly SpellDefinition[],
): FinalFantasyCatalog {
  rejectDuplicates("class", classDefinitions.flatMap((definition) => [definition.class, definition.promotion.class]))
  rejectDuplicates("spell", spellDefinitions.map((definition) => definition.spell))
  const jobs = new Map<string, Job>()
  for (const definition of classDefinitions) {
    const jobCapabilities = new Set(definition.attributes.map(requireCapability))
    jobs.set(definition.class, {
      id: definition.class,
      name: definition.name,
      plural: definition.plural,
      attackerPriority: definition.attackerPriority,
      capabilities: jobCapabilities,
      promotion: definition.promotion.class,
    })
    jobs.set(definition.promotion.class, {
      id: definition.promotion.class,
      name: definition.promotion.name,
      plural: definition.promotion.plural,
      attackerPriority: definition.attackerPriority,
      capabilities: jobCapabilities,
    })
  }
  const spells = new Map<string, Spell>()
  for (const definition of spellDefinitions) {
    const unknownJobs = definition.learnableBy.filter((id) => !jobs.has(id))
    if (unknownJobs.length > 0) {
      throw new Error(`Spell ${definition.spell} references unknown classes: ${unknownJobs.join(", ")}`)
    }
    spells.set(definition.spell, {
      id: definition.spell,
      name: definition.name,
      learnableBy: new Set(definition.learnableBy),
      attributes: new Set(definition.attributes.map(requireSpellAttribute)),
    })
  }

  return { jobs, spells }
}

function buildBossProfiles(definitions: readonly BossDefinition[]): ReadonlyMap<string, BossProfile> {
  const keys = definitions.map((definition) => definition.key)
  rejectDuplicates("boss", keys)

  return new Map(definitions.map((definition) => {
    return [definition.key, {
      key: definition.key,
      name: definition.name,
      templateName: definition.templateName ?? definition.name,
      tags: new Set(definition.tags.map(requireEnemyTag)),
    }]
  }))
}

function buildRule(
  definition: BossStrategyRuleDefinition,
  index: number,
  catalog: FinalFantasyCatalog,
  bossGroups: Readonly<Record<string, string[]>>,
  bossProfiles: ReadonlyMap<string, BossProfile>,
): BossStrategyRule {

  return {
    bossMatches: buildBossCondition(definition, index, bossGroups, bossProfiles),
    section: requireGuideSection(definition.section),
    partyMatches: buildPartyCondition(definition.when, catalog),
    advice: parseAdvice(definition.advice, catalog),
  }
}

function buildBossCondition(
  definition: BossStrategyRuleDefinition,
  index: number,
  bossGroups: Readonly<Record<string, string[]>>,
  bossProfiles: ReadonlyMap<string, BossProfile>,
): BossCondition {
  const alternatives = [definition.boss, definition.bossGroup, definition.bossTag]
    .filter((value) => value !== undefined)
  if (alternatives.length !== 1) {
    throw new Error(`Rule ${index + 1} must define exactly one of boss, bossGroup, or bossTag`)
  }

  if (definition.boss !== undefined) {
    const key = definition.boss

    if (!bossProfiles.has(key)) {
      throw new Error(`Unknown rule boss: ${definition.boss}`)
    }

    return (boss) => boss.key === key
  }

  if (definition.bossGroup !== undefined) {
    const names = bossGroups[definition.bossGroup]

    if (names === undefined) {
      throw new Error(`Unknown boss group: ${definition.bossGroup}`)
    }

    const keys = new Set(names)

    return (boss) => keys.has(boss.key)
  }

  const tag = requireEnemyTag(definition.bossTag ?? "")

  return (boss) => boss.tags.has(tag)
}

function buildPartyCondition(
  definition: PartyConditionDefinition,
  catalog: FinalFantasyCatalog,
): PartyCondition {
  if (definition === "always") {

    return () => true
  }

  const operations = ["job", "capability", "spell", "spellAttribute", "item", "all", "not"]
    .filter((key) => key in definition)

  if (operations.length !== 1) {
    throw new Error("A boss strategy condition must have exactly one operation")
  }

  if ("job" in definition) {
    const job = requireJob(catalog, definition.job, "Unknown rule class")
    const atLeast = requireCount(definition.atLeast)

    return (party) => party.members.filter((member) => member.job.id === job.id).length >= atLeast
  }

  if ("capability" in definition) {
    const capability = requireCapability(definition.capability)
    const atLeast = requireCount(definition.atLeast)

    return (party) => party.members.filter((member) => memberCapabilities(member).has(capability)).length >= atLeast
  }

  if ("spell" in definition) {
    const spell = requireSpell(catalog, definition.spell, "Unknown rule spell")
    const atLeast = requireCount(definition.atLeast)

    return (party) => party.members.filter((member) => member.learnedSpells.has(spell)).length >= atLeast
  }

  if ("spellAttribute" in definition) {
    const matchingSpells = spellsWithAttribute(catalog, requireSpellAttribute(definition.spellAttribute))
    const atLeast = requireCount(definition.atLeast)

    return (party) => party.members.filter((member) =>
      [...member.learnedSpells].some((spell) => matchingSpells.has(spell)),
    ).length >= atLeast
  }

  if ("item" in definition) {
    const item = requireItem(definition.item)

    return (party) => party.inventory.has(item)
  }

  if ("all" in definition) {
    const conditions = definition.all.map((condition) => buildPartyCondition(condition, catalog))

    return (party) => conditions.every((condition) => condition(party))
  }

  const condition = buildPartyCondition(definition.not, catalog)

  return (party) => !condition(party)
}

function parseAdvice(advice: string, catalog: FinalFantasyCatalog): readonly AdvicePart[] {
  const parts: AdvicePart[] = []
  let offset = 0
  for (const match of advice.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const start = match.index

    if (start > offset) {
      parts.push(advice.slice(offset, start))
    }

    parts.push(parseAdviceToken(match[1] ?? "", catalog))
    offset = start + match[0].length
  }

  if (offset < advice.length) {
    parts.push(advice.slice(offset))
  }

  return parts
}

function parseAdviceToken(token: string, catalog: FinalFantasyCatalog): Exclude<AdvicePart, string> {
  const parts = token.split(":")

  if (parts.length === 1 && parts[0] === "boss") {

    return (_party, boss) => boss.templateName
  }

  if (parts[0] !== "members") {
    throw new Error(`Unknown advice token: {{${token}}}`)
  }

  const selector = buildMemberSelector(parts.slice(1), catalog)

  return (party) => formatMembers(party, selector)
}

function buildMemberSelector(parts: readonly string[], catalog: FinalFantasyCatalog): MemberSelector {
  if (parts.length === 1 && parts[0] === "all") {

    return { select: (party) => party.members }
  }

  if (parts.length === 1 && parts[0] === "preferred-physical-attacker") {

    return {
      select: (party) => [...party.members]
        .filter((member) => memberCapabilities(member).has("physical-damage"))
        .sort((left, right) => left.job.attackerPriority - right.job.attackerPriority)
        .slice(0, 1),
    }
  }
  if (parts.length === 2 && parts[0] === "capability") {
    const capability = requireCapability(parts[1] ?? "")
    const qualifier = capability === "healing" ? "with recovery magic"
      : capability === "offensive-magic" ? "with offensive magic" : ""

    return {
      select: (party) => party.members.filter((member) => memberCapabilities(member).has(capability)),
      qualifier,
    }
  }
  if (parts.length === 2 && parts[0] === "knows") {
    const spell = requireSpell(catalog, parts[1] ?? "", "Unknown advice spell")

    return {
      select: (party) => party.members.filter((member) => member.learnedSpells.has(spell)),
      qualifier: (count) => count === 1 ? `who knows ${spell.name}` : `who know ${spell.name}`,
    }
  }
  if (parts.length === 2 && parts[0] === "knows-attribute") {
    const matchingSpells = spellsWithAttribute(catalog, requireSpellAttribute(parts[1] ?? ""))

    return {
      select: (party) => party.members.filter((member) =>
        [...member.learnedSpells].some((spell) => matchingSpells.has(spell)),
      ),
      qualifier: "with relevant learned spells",
    }
  }
  if (parts.length === 2 && parts[0] === "can-use") {
    const item = requireItem(parts[1] ?? "")

    return {
      select: (party) => party.members.filter((member) => canUseItem(party, member, item)),
    }
  }
  throw new Error(`Unknown member selector: ${parts.join(":")}`)
}

function formatMembers(party: Party, selector: MemberSelector): string {
  const selectedJobs = selector.select(party).map((member) => member.job)
  const distinctJobs = selectedJobs.filter(
    (job, index) => selectedJobs.findIndex((candidate) => candidate.id === job.id) === index,
  )
  const groups = distinctJobs.map((job) => {
    const selectedCount = selectedJobs.filter((candidate) => candidate.id === job.id).length
    const partyCount = party.members.filter((member) => member.job.id === job.id).length
    const allSelected = selectedCount === partyCount
    const base = selectedCount === 1 ? `the ${job.name}`
      : selectedCount === 2 && allSelected ? `both ${job.plural}`
      : allSelected ? `all ${selectedCount} ${job.plural}`
      : `the ${selectedCount} ${job.plural}`
    const qualifier = allSelected || selector.qualifier === undefined ? ""
      : typeof selector.qualifier === "function" ? selector.qualifier(selectedCount)
      : selector.qualifier

    return qualifier.length === 0 ? base : `${base} ${qualifier}`
  })

  if (groups.length === 0) {

    return "no party member"
  }

  if (groups.length === 1) {

    return groups[0] ?? "no party member"
  }

  if (groups.length === 2) {

    return `${groups[0]} and ${groups[1]}`
  }

  return `${groups.slice(0, -1).join(", ")}, and ${groups.at(-1)}`
}

function renderAdvice(parts: readonly AdvicePart[], party: Party, boss: BossProfile): string {

  return parts.map((part) => typeof part === "string" ? part : part(party, boss)).join("")
}

function memberCapabilities(member: PartyMember): ReadonlySet<CapabilityId> {
  const result = new Set(member.job.capabilities)

  if ([...member.learnedSpells].some((spell) => spell.attributes.has("healing"))) {
    result.add("healing")
  }

  if ([...member.learnedSpells].some((spell) => spell.attributes.has("offensive-magic"))) {
    result.add("offensive-magic")
  }

  return result
}

function spellsWithAttribute(catalog: FinalFantasyCatalog, attribute: SpellAttributeId): ReadonlySet<Spell> {

  return new Set([...catalog.spells.values()].filter((spell) => spell.attributes.has(attribute)))
}

function validateBossGroups(
  groups: Readonly<Record<string, string[]>>,
  bosses: ReadonlyMap<string, BossProfile>,
): void {
  const unknown = Object.entries(groups).flatMap(([group, names]) => names
    .filter((key) => !bosses.has(key))
    .map((key) => `${group} -> ${key}`))
  if (unknown.length > 0) {
    throw new Error(`Boss groups reference unknown bosses: ${unknown.sort().join(", ")}`)
  }
}

function rejectDuplicates(kind: string, ids: readonly string[]): void {
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort()

  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${kind} ids: ${duplicates.join(", ")}`)
  }
}

function requireJob(catalog: FinalFantasyCatalog, id: string, prefix = "Unknown Final Fantasy class"): Job {
  const job = catalog.jobs.get(id)

  if (job === undefined) {
    throw new Error(`${prefix}: ${id}`)
  }

  return job
}
function requireSpell(catalog: FinalFantasyCatalog, id: string, prefix = "Unknown Final Fantasy spell"): Spell {
  const spell = catalog.spells.get(id)

  if (spell === undefined) {
    throw new Error(`${prefix}: ${id}`)
  }

  return spell
}
function requireCount(value: number | undefined): number {
  const count = value ?? 1

  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Condition count must be a positive integer: ${count}`)
  }

  return count
}
function requireCapability(id: string): CapabilityId {
  if (!capabilities.has(id as CapabilityId)) {
    throw new Error(`Unknown class attribute: ${id}`)
  }

  return id as CapabilityId
}
function requireSpellAttribute(id: string): SpellAttributeId {
  if (!spellAttributes.has(id as SpellAttributeId)) {
    throw new Error(`Unknown spell attribute: ${id}`)
  }

  return id as SpellAttributeId
}
function requireItem(id: string): ItemId {
  if (!items.has(id as ItemId)) {
    throw new Error(`Unknown item: ${id}`)
  }

  return id as ItemId
}
function requireEnemyTag(id: string): EnemyTagId {
  if (!enemyTags.has(id as EnemyTagId)) {
    throw new Error(`Unknown enemy tag: ${id}`)
  }

  return id as EnemyTagId
}
function requireGuideSection(id: string): GuideSectionId {
  if (!guideSections.has(id as GuideSectionId)) {
    throw new Error(`Unknown guide section: ${id}`)
  }

  return id as GuideSectionId
}
