import type { FinalFantasyVCrystalId } from "./catalog.ts"

export interface FinalFantasyVMainStoryBossDefinition {
  readonly ordinal: number
  readonly key: string
  readonly name: string
  readonly jobsUnlocked: FinalFantasyVCrystalId
}

export interface FinalFantasyVOptionalBossDefinition {
  readonly key: string
  readonly name: string
  readonly earliestAfterEncounter: string
  readonly jobsUnlocked: FinalFantasyVCrystalId
}

export interface FinalFantasyVBossDefinitions {
  readonly mainStory: readonly FinalFantasyVMainStoryBossDefinition[]
  readonly optional: readonly FinalFantasyVOptionalBossDefinition[]
}

export type FinalFantasyVBossEncounter =
  | (FinalFantasyVMainStoryBossDefinition & { readonly kind: "main-story" })
  | (FinalFantasyVOptionalBossDefinition & { readonly kind: "optional" })

export interface FinalFantasyVBossCatalog {
  readonly encounters: readonly FinalFantasyVBossEncounter[]
  readonly encountersById: ReadonlyMap<string, FinalFantasyVBossEncounter>
}

export type FinalFantasyVBossSelection =
  | { readonly kind: "fixed"; readonly bossId: string }
  | { readonly kind: "random"; readonly random: () => number }

export const currentFinalFantasyVBossSelection = Object.freeze({
  kind: "fixed",
  bossId: "karlabos",
} satisfies FinalFantasyVBossSelection)

export function buildFinalFantasyVBossCatalog(
  definitions: FinalFantasyVBossDefinitions,
): FinalFantasyVBossCatalog {
  const expectedOrdinals = definitions.mainStory.map((_encounter, index) => index + 1)
  const actualOrdinals = definitions.mainStory.map((encounter) => encounter.ordinal)
  if (!actualOrdinals.every((ordinal, index) => ordinal === expectedOrdinals[index])) {
    throw new Error("Final Fantasy V main-story boss ordinals must be contiguous from 1")
  }

  const encounters: FinalFantasyVBossEncounter[] = [
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

export function selectFinalFantasyVBoss(
  catalog: FinalFantasyVBossCatalog,
  selection: FinalFantasyVBossSelection = currentFinalFantasyVBossSelection,
): FinalFantasyVBossEncounter {
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
