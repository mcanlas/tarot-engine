import type { BossCatalog } from "./bosses.ts"
import type { Ability, StrategyCatalog } from "./catalog.ts"
import type { ResolvedAbility } from "./loadouts.ts"
import type { PartyMember } from "./party-strategy.ts"

export type Element =
  | "fire"
  | "ice"
  | "lightning"
  | "wind"
  | "water"
  | "earth"
  | "poison"
  | "holy"

export type BossThreat =
  | "physical-damage"
  | "magical-damage"
  | "hp-collapse"
  | "paralysis"
  | "poison"
  | "darkness"
  | "silence"
  | "sleep"
  | "instant-death"
  | "confusion"
  | "slow"
  | "sap"
  | "mp-pressure"
  | "level-reduction"

export type BossTrait =
  | "form-shifting"
  | "counterattacks"
  | "multiple-targets"
  | "reinforcement"
  | "elemental-absorption"
  | "target-decoys"
  | "timed-encounter"
  | "status-vulnerable"
  | "self-healing"

export type BossScoreDimension = "tempo" | "safety" | "reliability"

export interface BossProfileDefinition {
  readonly boss: string
  readonly targetCount: number
  readonly vulnerabilities: readonly Element[]
  readonly traits: readonly BossTrait[]
  readonly threats: readonly {
    readonly source: string
    readonly kind: BossThreat
  }[]
}

export interface BossStrategyAssumptionDefinition {
  readonly id: string
  readonly statement: string
}

export interface BossCapabilityProviderDefinition {
  readonly ability: string
  readonly atLeastRank?: number
}

export interface BossCapabilityDefinition {
  readonly key: string
  readonly providers: readonly BossCapabilityProviderDefinition[]
}

export type BossFactDefinition =
  | { readonly vulnerability: Element }
  | { readonly threat: BossThreat }
  | { readonly trait: BossTrait }

export interface BossPartyConditionDefinition {
  readonly capability: string
  readonly atLeastMembers?: number
  readonly atMostMembers?: number
}

export interface BossRuleDefinition {
  readonly id: string
  readonly when: {
    readonly boss: BossFactDefinition
    readonly party: BossPartyConditionDefinition
  }
  readonly score: Readonly<Partial<Record<BossScoreDimension, number>>>
  readonly statement: string
}

export interface BossStrategyDefinitions {
  readonly bosses: readonly BossProfileDefinition[]
  readonly assumptions: readonly BossStrategyAssumptionDefinition[]
  readonly capabilities: readonly BossCapabilityDefinition[]
  readonly rules: readonly BossRuleDefinition[]
}

export interface BossMatchedRule {
  readonly ruleId: string
  readonly statement: string
  readonly score: Readonly<Partial<Record<BossScoreDimension, number>>>
}

export interface BossEvaluation {
  readonly bossId: string
  readonly assumptions: readonly BossStrategyAssumptionDefinition[]
  readonly capabilityMembers: Readonly<Record<string, number>>
  readonly score: Readonly<Record<BossScoreDimension, number>>
  readonly matchedRules: readonly BossMatchedRule[]
}

interface CompiledCapability {
  readonly key: string
  readonly providers: readonly {
    readonly ability: Ability
    readonly atLeastRank?: number
  }[]
}

export class BossStrategyEngine {
  readonly #bossProfiles: ReadonlyMap<string, BossProfileDefinition>
  readonly #assumptions: readonly BossStrategyAssumptionDefinition[]
  readonly #capabilities: ReadonlyMap<string, CompiledCapability>
  readonly #rules: readonly BossRuleDefinition[]

  constructor(
    strategyCatalog: StrategyCatalog,
    bossCatalog: BossCatalog,
    definitions: BossStrategyDefinitions,
  ) {
    rejectDuplicates("boss profile", definitions.bosses.map((boss) => boss.boss))
    rejectDuplicates("boss assumption", definitions.assumptions.map((assumption) => assumption.id))
    rejectDuplicates("capability", definitions.capabilities.map((capability) => capability.key))
    rejectDuplicates("boss rule", definitions.rules.map((rule) => rule.id))

    for (const profile of definitions.bosses) {
      if (!bossCatalog.encountersById.has(profile.boss)) {
        throw new Error(`Unknown Final Fantasy V boss strategy profile: ${profile.boss}`)
      }
    }
    this.#bossProfiles = new Map(definitions.bosses.map((profile) => [profile.boss, profile]))
    this.#assumptions = definitions.assumptions

    this.#capabilities = new Map(definitions.capabilities.map((capability) => [
      capability.key,
      {
        key: capability.key,
        providers: capability.providers.map((provider) => {
          const ability = requireAbility(strategyCatalog, provider.ability)

          return {
            ability,
            ...validateProviderRank(ability, provider.atLeastRank),
          }
        }),
      },
    ]))

    for (const rule of definitions.rules) {
      if (!this.#capabilities.has(rule.when.party.capability)) {
        throw new Error(`Unknown Final Fantasy V boss capability: ${rule.when.party.capability}`)
      }
      validateMemberBounds(rule)
      if (Object.keys(rule.score).length === 0) {
        throw new Error(`Final Fantasy V boss rule ${rule.id} must score a dimension`)
      }
    }
    this.#rules = definitions.rules
  }

  hasProfile(bossId: string): boolean {
    return this.#bossProfiles.has(bossId)
  }

  evaluate(
    bossId: string,
    members: readonly PartyMember[],
  ): BossEvaluation {
    const boss = this.#bossProfiles.get(bossId)
    if (boss === undefined) {
      throw new Error(`No Final Fantasy V boss strategy profile for: ${bossId}`)
    }

    const capabilityMembers = Object.fromEntries([...this.#capabilities].map(([key, capability]) => [
      key,
      members.filter((member) => memberHasCapability(member, capability)).length,
    ]))
    const matchedRules = this.#rules
      .filter((rule) => bossMatches(boss, rule.when.boss)
        && partyMatches(capabilityMembers, rule.when.party))
      .map((rule): BossMatchedRule => ({
        ruleId: rule.id,
        statement: rule.statement,
        score: rule.score,
      }))
    const score: Record<BossScoreDimension, number> = {
      tempo: 0,
      safety: 0,
      reliability: 0,
    }
    for (const matched of matchedRules) {
      for (const dimension of bossScoreDimensions) {
        score[dimension] += matched.score[dimension] ?? 0
      }
    }

    return {
      bossId,
      assumptions: this.#assumptions,
      capabilityMembers,
      score,
      matchedRules,
    }
  }
}

export const bossScoreDimensions = Object.freeze([
  "tempo",
  "safety",
  "reliability",
] as const satisfies readonly BossScoreDimension[])

function requireAbility(
  catalog: StrategyCatalog,
  abilityId: string,
): Ability {
  const ability = catalog.abilities.get(abilityId)
  if (ability === undefined) {
    throw new Error(`Unknown Final Fantasy V boss capability ability: ${abilityId}`)
  }

  return ability
}

function validateProviderRank(
  ability: Ability,
  atLeastRank: number | undefined,
): { readonly atLeastRank?: number } {
  if (atLeastRank === undefined) {
    return {}
  }
  if (!Number.isInteger(atLeastRank) || atLeastRank < 1) {
    throw new Error(`Boss capability rank for ${ability.id} must be a positive integer`)
  }
  if (ability.kind !== "ranked" || !ability.ranks.some((rank) => rank.rank === atLeastRank)) {
    throw new Error(`Invalid boss capability rank for ${ability.id}: ${atLeastRank}`)
  }

  return { atLeastRank }
}

function validateMemberBounds(rule: BossRuleDefinition): void {
  const { atLeastMembers, atMostMembers } = rule.when.party
  if (atLeastMembers === undefined && atMostMembers === undefined) {
    throw new Error(`Final Fantasy V boss rule ${rule.id} must bound capability members`)
  }
  for (const [name, value] of Object.entries({ atLeastMembers, atMostMembers })) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 4)) {
      throw new Error(`Final Fantasy V boss rule ${rule.id} ${name} must be from 0 through 4`)
    }
  }
  if (atLeastMembers !== undefined && atMostMembers !== undefined
    && atLeastMembers > atMostMembers) {
    throw new Error(`Final Fantasy V boss rule ${rule.id} has inverted member bounds`)
  }
}

function memberHasCapability(
  member: PartyMember,
  capability: CompiledCapability,
): boolean {
  const abilities = [...member.loadout.assignments, ...member.loadout.innateAbilities]

  return capability.providers.some((provider) => abilities.some((ability) =>
    ability.abilityId === provider.ability.id
      && resolvedAbilityHasRank(ability, provider.atLeastRank)))
}

function resolvedAbilityHasRank(
  ability: ResolvedAbility,
  atLeastRank: number | undefined,
): boolean {
  return atLeastRank === undefined
    || (ability.kind === "ranked" && ability.rank >= atLeastRank)
}

function bossMatches(
  boss: BossProfileDefinition,
  fact: BossFactDefinition,
): boolean {
  if ("vulnerability" in fact) {
    return boss.vulnerabilities.includes(fact.vulnerability)
  }
  if ("threat" in fact) {
    return boss.threats.some((threat) => threat.kind === fact.threat)
  }

  return boss.traits.includes(fact.trait)
}

function partyMatches(
  capabilityMembers: Readonly<Record<string, number>>,
  condition: BossPartyConditionDefinition,
): boolean {
  const count = capabilityMembers[condition.capability] ?? 0

  return count >= (condition.atLeastMembers ?? 0)
    && count <= (condition.atMostMembers ?? Number.POSITIVE_INFINITY)
}

function rejectDuplicates(kind: string, ids: readonly string[]): void {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate Final Fantasy V ${kind} ids: ${[...new Set(duplicates)].join(", ")}`)
  }
}
