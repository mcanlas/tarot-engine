import type { CrystalId } from "./catalog.ts"

export interface MainStoryBossDefinition {
  readonly ordinal: number
  readonly key: string
  readonly name: string
  readonly jobsUnlocked: CrystalId
}

export interface OptionalBossDefinition {
  readonly key: string
  readonly name: string
  readonly earliestAfterEncounter: string
  readonly jobsUnlocked: CrystalId
}

export interface BossDefinitions {
  readonly mainStory: readonly MainStoryBossDefinition[]
  readonly optional: readonly OptionalBossDefinition[]
}

export type BossEncounter =
  | (MainStoryBossDefinition & { readonly kind: "main-story" })
  | (OptionalBossDefinition & { readonly kind: "optional" })

export interface BossCatalog {
  readonly encounters: readonly BossEncounter[]
  readonly encountersById: ReadonlyMap<string, BossEncounter>
}

export type BossSelection =
  | { readonly kind: "fixed"; readonly bossId: string }
  | { readonly kind: "random"; readonly random: () => number }

export const currentBossSelection = Object.freeze({
  kind: "fixed",
  bossId: "karlabos",
} satisfies BossSelection)

export function buildBossCatalog(
  definitions: BossDefinitions,
): BossCatalog {
  const expectedOrdinals = definitions.mainStory.map((_encounter, index) => index + 1)
  const actualOrdinals = definitions.mainStory.map((encounter) => encounter.ordinal)
  if (!actualOrdinals.every((ordinal, index) => ordinal === expectedOrdinals[index])) {
    throw new Error("Final Fantasy V main-story boss ordinals must be contiguous from 1")
  }

  const encounters: BossEncounter[] = [
    ...definitions.mainStory.map((encounter) => ({ ...encounter, kind: "main-story" as const })),
    ...definitions.optional.map((encounter) => ({ ...encounter, kind: "optional" as const })),
  ]
  const duplicateIds = encounters
    .map((encounter) => encounter.key)
    .filter((id, index, ids) => ids.indexOf(id) !== index)
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate Final Fantasy V boss keys: ${[...new Set(duplicateIds)].join(", ")}`)
  }

  const encountersById = new Map(encounters.map((encounter) => [encounter.key, encounter]))
  const unknownPredecessors = definitions.optional
    .map((encounter) => encounter.earliestAfterEncounter)
    .filter((id) => !encountersById.has(id))
  if (unknownPredecessors.length > 0) {
    throw new Error(
      `Unknown Final Fantasy V optional boss predecessors: ${[
        ...new Set(unknownPredecessors),
      ].join(", ")}`,
    )
  }

  return { encounters, encountersById }
}

export function selectBoss(
  catalog: BossCatalog,
  selection: BossSelection = currentBossSelection,
): BossEncounter {
  if (selection.kind === "fixed") {
    const encounter = catalog.encountersById.get(selection.bossId)
    if (encounter === undefined) {
      throw new Error(`Unknown Final Fantasy V selected boss: ${selection.bossId}`)
    }

    return encounter
  }

  const value = selection.random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("Final Fantasy V boss random source must return a number from 0 through 1")
  }
  const encounter = catalog.encounters[Math.floor(value * catalog.encounters.length)]
  if (encounter === undefined) {
    throw new Error("Cannot select a Final Fantasy V boss from an empty catalog")
  }

  return encounter
}
