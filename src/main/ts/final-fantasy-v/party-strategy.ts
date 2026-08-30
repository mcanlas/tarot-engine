import type {
  FinalFantasyVAbilityType,
  FinalFantasyVStrategyCatalog,
} from "./catalog.ts"
import type { FinalFantasyVLegalLoadout, FinalFantasyVResolvedAbility } from "./loadouts.ts"

export const finalFantasyVCharacterIds = ["bartz", "lenna", "galuf", "faris", "krile"] as const

export type FinalFantasyVCharacterId = typeof finalFantasyVCharacterIds[number]

export interface FinalFantasyVPartyMember {
  readonly characterId: FinalFantasyVCharacterId
  readonly loadout: FinalFantasyVLegalLoadout
}

export type FinalFantasyVPartyObservationKind = "setup" | "tradeoff"

export interface FinalFantasyVPartyObservation {
  readonly ruleId: string
  readonly kind: FinalFantasyVPartyObservationKind
  readonly statement: string
  readonly memberIds: readonly FinalFantasyVCharacterId[]
}

export interface FinalFantasyVPartyStrategy {
  readonly members: readonly {
    readonly characterId: FinalFantasyVCharacterId
    readonly jobId: string
  }[]
  readonly observations: readonly FinalFantasyVPartyObservation[]
}

export type FinalFantasyVMemberSelectorDefinition =
  | { readonly job: string }
  | { readonly assignment: string; readonly atLeastRank?: number }
  | { readonly assignmentOneOf: readonly string[] }
  | { readonly innate: string; readonly atLeastRank?: number }
  | { readonly assignmentType: FinalFantasyVAbilityType }

export type FinalFantasyVPartyStrategyConditionDefinition =
  | { readonly sameMember: readonly FinalFantasyVMemberSelectorDefinition[] }
  | { readonly distinctMembers: readonly FinalFantasyVMemberSelectorDefinition[] }

export interface FinalFantasyVPartyStrategyRuleDefinition {
  readonly id: string
  readonly kind: FinalFantasyVPartyObservationKind
  readonly when: FinalFantasyVPartyStrategyConditionDefinition
  readonly statement: string
}

interface CompiledRule {
  readonly id: string
  readonly kind: FinalFantasyVPartyObservationKind
  readonly statement: string
  readonly match: (
    members: readonly FinalFantasyVPartyMember[],
  ) => readonly FinalFantasyVPartyMember[] | undefined
}

type MemberSelector = (member: FinalFantasyVPartyMember) => boolean

export class FinalFantasyVPartyStrategyEngine {
  readonly ruleIds: readonly string[]
  readonly #rules: readonly CompiledRule[]

  constructor(
    catalog: FinalFantasyVStrategyCatalog,
    definitions: readonly FinalFantasyVPartyStrategyRuleDefinition[],
  ) {
    rejectDuplicateRuleIds(definitions)
    this.#rules = definitions.map((rule) => compileRule(rule, catalog))
    this.ruleIds = this.#rules.map((rule) => rule.id)
  }

  analyze(members: readonly FinalFantasyVPartyMember[]): FinalFantasyVPartyStrategy {
    validateParty(members)

    const observations = this.#rules.flatMap((rule): FinalFantasyVPartyObservation[] => {
      const witnesses = rule.match(members)
      if (witnesses === undefined) {
        return []
      }

      return [{
        ruleId: rule.id,
        kind: rule.kind,
        statement: rule.statement,
        memberIds: witnesses.map((member) => member.characterId),
      }]
    })

    return {
      members: members.map((member) => ({
        characterId: member.characterId,
        jobId: member.loadout.jobId,
      })),
      observations,
    }
  }
}

function compileRule(
  definition: FinalFantasyVPartyStrategyRuleDefinition,
  catalog: FinalFantasyVStrategyCatalog,
): CompiledRule {
  if (definition.kind !== "setup" && definition.kind !== "tradeoff") {
    throw new Error(`Unknown Final Fantasy V party strategy kind: ${definition.kind}`)
  }
  if ("sameMember" in definition.when) {
    if (definition.when.sameMember.length < 2) {
      throw new Error(`Rule ${definition.id} must combine at least two same-member selectors`)
    }
    const selectors = definition.when.sameMember.map((selector) =>
      compileSelector(selector, catalog))

    return {
      ...definition,
      match: (members) => {
        const member = members.find((candidate) =>
          selectors.every((selector) => selector(candidate)))

        return member === undefined ? undefined : [member]
      },
    }
  }

  if (definition.when.distinctMembers.length < 2) {
    throw new Error(`Rule ${definition.id} must combine at least two distinct-member selectors`)
  }
  const selectors = definition.when.distinctMembers.map((selector) =>
    compileSelector(selector, catalog))

  return {
    ...definition,
    match: (members) => matchDistinctMembers(members, selectors),
  }
}

function compileSelector(
  definition: FinalFantasyVMemberSelectorDefinition,
  catalog: FinalFantasyVStrategyCatalog,
): MemberSelector {
  if ("job" in definition) {
    const job = catalog.jobs.get(definition.job)
    if (job === undefined) {
      throw new Error(`Unknown Final Fantasy V strategy job: ${definition.job}`)
    }
    return (member) => member.loadout.jobId === job.id
  }

  if ("assignmentType" in definition) {
    return (member) => member.loadout.assignments.some((resolved) =>
      catalog.abilities.get(resolved.abilityId)?.type === definition.assignmentType)
  }

  if ("assignmentOneOf" in definition) {
    if (definition.assignmentOneOf.length === 0) {
      throw new Error("Final Fantasy V strategy assignmentOneOf must not be empty")
    }
    const abilityIds = new Set(definition.assignmentOneOf.map((abilityId) => {
      if (!catalog.abilities.has(abilityId)) {
        throw new Error(`Unknown Final Fantasy V strategy ability: ${abilityId}`)
      }

      return abilityId
    }))

    return (member) => member.loadout.assignments.some((resolved) =>
      abilityIds.has(resolved.abilityId))
  }

  const abilityId = "assignment" in definition ? definition.assignment : definition.innate
  const ability = catalog.abilities.get(abilityId)
  if (ability === undefined) {
    throw new Error(`Unknown Final Fantasy V strategy ability: ${abilityId}`)
  }
  const atLeastRank = requireRank(definition.atLeastRank, ability.id)
  const source = "assignment" in definition ? "assignments" : "innateAbilities"

  return (member) => member.loadout[source]
    .some((resolved) => resolved.abilityId === ability.id && hasRank(resolved, atLeastRank))
}

function matchDistinctMembers(
  members: readonly FinalFantasyVPartyMember[],
  selectors: readonly MemberSelector[],
): readonly FinalFantasyVPartyMember[] | undefined {
  const chosen: FinalFantasyVPartyMember[] = []

  function visit(selectorIndex: number): boolean {
    if (selectorIndex === selectors.length) {
      return true
    }
    const selector = selectors[selectorIndex]!
    for (const member of members) {
      if (chosen.includes(member) || !selector(member)) {
        continue
      }
      chosen.push(member)
      if (visit(selectorIndex + 1)) {
        return true
      }
      chosen.pop()
    }

    return false
  }

  return visit(0) ? chosen : undefined
}

function hasRank(ability: FinalFantasyVResolvedAbility, atLeastRank: number | undefined): boolean {
  return atLeastRank === undefined
    || (ability.kind === "ranked" && ability.rank >= atLeastRank)
}

function requireRank(value: number | undefined, abilityId: string): number | undefined {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    throw new Error(`Strategy rank for ${abilityId} must be a positive integer`)
  }

  return value
}

function rejectDuplicateRuleIds(
  definitions: readonly FinalFantasyVPartyStrategyRuleDefinition[],
): void {
  const duplicates = definitions
    .map((definition) => definition.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate Final Fantasy V party strategy rule ids: ${[
      ...new Set(duplicates),
    ].join(", ")}`)
  }
}

function validateParty(members: readonly FinalFantasyVPartyMember[]): void {
  if (members.length < 1 || members.length > 4) {
    throw new Error("Expected 1 to 4 Final Fantasy V party members")
  }
  const characterIds = members.map((member) => member.characterId)
  const unknown = characterIds.find((id) =>
    !finalFantasyVCharacterIds.includes(id as FinalFantasyVCharacterId))
  if (unknown !== undefined) {
    throw new Error(`Unknown Final Fantasy V character: ${unknown}`)
  }
  const duplicate = characterIds.find((id, index) => characterIds.indexOf(id) !== index)
  if (duplicate !== undefined) {
    throw new Error(`Duplicate Final Fantasy V party member: ${duplicate}`)
  }
  if (characterIds.includes("galuf") && characterIds.includes("krile")) {
    throw new Error("Galuf and Krile cannot be active party members at the same time")
  }
}
