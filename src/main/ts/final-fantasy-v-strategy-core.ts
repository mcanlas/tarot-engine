export const finalFantasyVStrategyYamlFiles = Object.freeze({
  jobs: "data/final-fantasy-v-jobs.yaml",
})

export type FinalFantasyVCrystalId = "none" | "wind" | "water" | "fire" | "earth"

export type FinalFantasyVAbilityType = "active" | "passive"

export interface FinalFantasyVAbilityRankDefinition {
  rank: number
  jobLevel: number
  abp: number
}

interface FinalFantasyVAbilityDefinitionBase {
  key: string
  name: string
  type: string
  assignable?: boolean
}

export interface FinalFantasyVFlatAbilityDefinition extends FinalFantasyVAbilityDefinitionBase {
  level: number
  abp: number
}

export interface FinalFantasyVRankedAbilityDefinition extends FinalFantasyVAbilityDefinitionBase {
  innateRank: number
  ranks: FinalFantasyVAbilityRankDefinition[]
}

export type FinalFantasyVAbilityDefinition =
  | FinalFantasyVFlatAbilityDefinition
  | FinalFantasyVRankedAbilityDefinition

export interface FinalFantasyVJobDefinition {
  key: string
  name: string
  crystal: string
  innates: string[]
  abilities: FinalFantasyVAbilityDefinition[]
}

export interface FinalFantasyVAbilityRank {
  rank: number
  jobLevel: number
  abp: number
}

interface FinalFantasyVAbilityBase {
  id: string
  name: string
  type: FinalFantasyVAbilityType
  jobId: string
  assignable: boolean
}

export interface FinalFantasyVFlatAbility extends FinalFantasyVAbilityBase {
  kind: "flat"
  level: number
  abp: number
}

export interface FinalFantasyVRankedAbility extends FinalFantasyVAbilityBase {
  kind: "ranked"
  innateRank: number
  ranks: readonly FinalFantasyVAbilityRank[]
}

export type FinalFantasyVAbility = FinalFantasyVFlatAbility | FinalFantasyVRankedAbility

export interface FinalFantasyVJob {
  id: string
  name: string
  crystal: FinalFantasyVCrystalId
  innates: ReadonlySet<FinalFantasyVAbility>
  abilities: readonly FinalFantasyVAbility[]
}

export interface FinalFantasyVStrategyCatalog {
  jobs: ReadonlyMap<string, FinalFantasyVJob>
  abilities: ReadonlyMap<string, FinalFantasyVAbility>
}

const crystals = new Set<FinalFantasyVCrystalId>(["none", "wind", "water", "fire", "earth"])
const abilityTypes = new Set<FinalFantasyVAbilityType>(["active", "passive"])

export function buildFinalFantasyVStrategyCatalog(
  definitions: readonly FinalFantasyVJobDefinition[],
): FinalFantasyVStrategyCatalog {
  rejectDuplicates("job", definitions.map((definition) => definition.key))
  rejectDuplicates(
    "ability",
    definitions.flatMap((definition) => definition.abilities.map((ability) => ability.key)),
  )

  const abilities = new Map<string, FinalFantasyVAbility>()
  const jobs = new Map<string, FinalFantasyVJob>()

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

export function describeFinalFantasyVStrategyCatalog(
  catalog: FinalFantasyVStrategyCatalog,
): string {
  const activeCount = [...catalog.abilities.values()]
    .filter((ability) => ability.type === "active").length
  const passiveCount = catalog.abilities.size - activeCount
  const assignableCount = [...catalog.abilities.values()]
    .filter((ability) => ability.assignable).length

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
  definition: FinalFantasyVAbilityDefinition,
): FinalFantasyVAbility {
  const common = {
    id: definition.key,
    name: definition.name,
    type: requireAbilityType(definition.type),
    jobId,
    assignable: definition.assignable ?? true,
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

function validateRanks(definition: FinalFantasyVRankedAbilityDefinition): void {
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

function requireCrystal(value: string): FinalFantasyVCrystalId {
  if (!crystals.has(value as FinalFantasyVCrystalId)) {
    throw new Error(`Unknown Final Fantasy V crystal: ${value}`)
  }

  return value as FinalFantasyVCrystalId
}

function requireAbilityType(value: string): FinalFantasyVAbilityType {
  if (!abilityTypes.has(value as FinalFantasyVAbilityType)) {
    throw new Error(`Unknown Final Fantasy V ability type: ${value}`)
  }

  return value as FinalFantasyVAbilityType
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

// TODO(boulder-2): enumerate legal loadouts from learned ranks, mastered jobs,
// job innates, and the distinct normal/Freelancer/Mime slot rules.
