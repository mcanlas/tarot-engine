export const strategyYamlFiles = Object.freeze({
  bossStrategy: "data/final-fantasy-v/boss-strategy.yaml",
  bosses: "data/final-fantasy-v/bosses.yaml",
  jobs: "data/final-fantasy-v-jobs.yaml",
  partyStrategy: "data/final-fantasy-v-party-strategy.yaml",
})

export type CrystalId =
  | "none"
  | "wind"
  | "water-1"
  | "fire-1"
  | "fire-2"
  | "earth"
  | "water-2"

export const crystalUnlockOrdinal = Object.freeze({
  none: 0,
  wind: 1,
  "water-1": 2,
  "fire-1": 3,
  "fire-2": 4,
  earth: 5,
  "water-2": 6,
} satisfies Readonly<Record<CrystalId, number>>)

export type GalufAvailability = "must" | "can" | "cannot"

export const galufAvailabilityByCrystal = Object.freeze({
  none: "must",
  wind: "must",
  "water-1": "must",
  "fire-1": "must",
  "fire-2": "must",
  earth: "can",
  "water-2": "cannot",
} satisfies Readonly<Record<CrystalId, GalufAvailability>>)

export type AbilityType = "active" | "passive"

export type AssignmentPolicy = "learned" | "mime-only" | "never"

export interface AbilityRankDefinition {
  rank: number
  jobLevel: number
  abp: number
}

interface AbilityDefinitionBase {
  key: string
  name: string
  type: string
  assignment?: string
}

export interface FlatAbilityDefinition extends AbilityDefinitionBase {
  level: number
  abp: number
}

export interface RankedAbilityDefinition extends AbilityDefinitionBase {
  innateRank: number
  ranks: AbilityRankDefinition[]
}

export type AbilityDefinition =
  | FlatAbilityDefinition
  | RankedAbilityDefinition

export interface JobDefinition {
  key: string
  name: string
  crystal: string
  innates: string[]
  abilities: AbilityDefinition[]
}

export interface AbilityRank {
  rank: number
  jobLevel: number
  abp: number
}

interface AbilityBase {
  id: string
  name: string
  type: AbilityType
  jobId: string
  assignment: AssignmentPolicy
}

export interface FlatAbility extends AbilityBase {
  kind: "flat"
  level: number
  abp: number
}

export interface RankedAbility extends AbilityBase {
  kind: "ranked"
  innateRank: number
  ranks: readonly AbilityRank[]
}

export type Ability = FlatAbility | RankedAbility

export interface Job {
  id: string
  name: string
  crystal: CrystalId
  innates: ReadonlySet<Ability>
  abilities: readonly Ability[]
}

export interface StrategyCatalog {
  jobs: ReadonlyMap<string, Job>
  abilities: ReadonlyMap<string, Ability>
}

export function jobIsAvailableThroughCrystal(
  job: Job,
  availableThroughCrystal: CrystalId,
): boolean {
  return crystalUnlockOrdinal[job.crystal]
    <= crystalUnlockOrdinal[availableThroughCrystal]
}

const crystals = new Set<CrystalId>([
  "none",
  "wind",
  "water-1",
  "fire-1",
  "fire-2",
  "earth",
  "water-2",
])
const abilityTypes = new Set<AbilityType>(["active", "passive"])

export function buildStrategyCatalog(
  definitions: readonly JobDefinition[],
): StrategyCatalog {
  rejectDuplicates("job", definitions.map((definition) => definition.key))
  rejectDuplicates(
    "ability",
    definitions.flatMap((definition) => definition.abilities.map((ability) => ability.key)),
  )

  const abilities = new Map<string, Ability>()
  const jobs = new Map<string, Job>()

  for (const definition of definitions) {
    const jobAbilities = definition.abilities.map((ability) =>
      buildAbility(definition.key, ability),
    )
    const abilitiesById = new Map(jobAbilities.map((ability) => [ability.id, ability]))
    rejectDuplicates("innate ability", definition.innates)

    const innates = definition.innates.map((id) => {
      const ability = abilitiesById.get(id)
      if (ability === undefined) {
        throw new Error(`Unknown innate ability for ${definition.key}: ${id}`)
      }

      return ability
    })

    for (const ability of jobAbilities) {
      abilities.set(ability.id, ability)
    }

    jobs.set(definition.key, {
      id: definition.key,
      name: definition.name,
      crystal: requireCrystal(definition.crystal),
      innates: new Set(innates),
      abilities: jobAbilities,
    })
  }

  return { jobs, abilities }
}

export function describeStrategyCatalog(
  catalog: StrategyCatalog,
): string {
  const activeCount = [...catalog.abilities.values()]
    .filter((ability) => ability.type === "active").length
  const passiveCount = catalog.abilities.size - activeCount
  const assignableCount = [...catalog.abilities.values()]
    .filter((ability) => ability.assignment !== "never").length

  return [
    `${catalog.jobs.size} jobs`,
    `${catalog.abilities.size} ability identities`,
    `${activeCount} active`,
    `${passiveCount} passive`,
    `${assignableCount} assignable`,
  ].join("; ")
}

function buildAbility(
  jobId: string,
  definition: AbilityDefinition,
): Ability {
  const common = {
    id: definition.key,
    name: definition.name,
    type: requireAbilityType(definition.type),
    jobId,
    assignment: requireAssignmentPolicy(definition.assignment ?? "learned"),
  }

  if ("ranks" in definition) {
    validateRanks(definition)

    return {
      ...common,
      kind: "ranked",
      innateRank: definition.innateRank,
      ranks: definition.ranks.map((rank) => ({ ...rank })),
    }
  }

  requireNonNegativeInteger(definition.level, `${definition.key}.level`)
  requireNonNegativeInteger(definition.abp, `${definition.key}.abp`)

  return {
    ...common,
    kind: "flat",
    level: definition.level,
    abp: definition.abp,
  }
}

function validateRanks(definition: RankedAbilityDefinition): void {
  if (definition.ranks.length === 0) {
    throw new Error(`${definition.key}.ranks must not be empty`)
  }

  definition.ranks.forEach((rank, index) => {
    const expectedRank = index + 1
    requirePositiveInteger(rank.rank, `${definition.key}.ranks[${index}].rank`)
    requirePositiveInteger(rank.jobLevel, `${definition.key}.ranks[${index}].jobLevel`)
    requireNonNegativeInteger(rank.abp, `${definition.key}.ranks[${index}].abp`)
    if (rank.rank !== expectedRank) {
      throw new Error(`${definition.key}.ranks must be contiguous from 1`)
    }
  })

  const finalRank = definition.ranks.at(-1)?.rank
  if (definition.innateRank !== finalRank) {
    throw new Error(`${definition.key}.innateRank must equal its highest rank`)
  }
}

function rejectDuplicates(kind: string, ids: readonly string[]): void {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${kind} keys: ${[...new Set(duplicates)].join(", ")}`)
  }
}

function requireCrystal(value: string): CrystalId {
  if (!crystals.has(value as CrystalId)) {
    throw new Error(`Unknown Final Fantasy V crystal: ${value}`)
  }

  return value as CrystalId
}

function requireAbilityType(value: string): AbilityType {
  if (!abilityTypes.has(value as AbilityType)) {
    throw new Error(`Unknown Final Fantasy V ability type: ${value}`)
  }

  return value as AbilityType
}

function requireAssignmentPolicy(value: string): AssignmentPolicy {
  if (value !== "learned" && value !== "mime-only" && value !== "never") {
    throw new Error(`Unknown Final Fantasy V assignment policy: ${value}`)
  }

  return value
}

function requirePositiveInteger(value: number, path: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${path} must be a positive integer`)
  }
}

function requireNonNegativeInteger(value: number, path: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer`)
  }
}
