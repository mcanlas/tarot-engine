import { finalFantasyVCrystalUnlockOrdinal } from "./catalog.ts"
import type {
  FinalFantasyVBossDefinitions,
  FinalFantasyVMainStoryBossDefinition,
  FinalFantasyVOptionalBossDefinition,
} from "./bosses.ts"
import type { FinalFantasyVCrystalId } from "./catalog.ts"

export function decodeFinalFantasyVBosses(value: unknown): FinalFantasyVBossDefinitions {
  const document = requireRecord(value, "Final Fantasy V bosses")

  return {
    mainStory: requireArray(document.encounters, "Final Fantasy V bosses.encounters")
      .map(decodeMainStoryBoss),
    optional: requireArray(
      document.optionalEncounters,
      "Final Fantasy V bosses.optionalEncounters",
    ).map(decodeOptionalBoss),
  }
}

function decodeMainStoryBoss(
  value: unknown,
  index: number,
): FinalFantasyVMainStoryBossDefinition {
  const path = `Final Fantasy V bosses.encounters[${index}]`
  const record = requireRecord(value, path)

  return {
    ordinal: requirePositiveInteger(record.ordinal, `${path}.ordinal`),
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    jobsUnlocked: requireCrystal(record.jobsUnlocked, `${path}.jobsUnlocked`),
  }
}

function decodeOptionalBoss(
  value: unknown,
  index: number,
): FinalFantasyVOptionalBossDefinition {
  const path = `Final Fantasy V bosses.optionalEncounters[${index}]`
  const record = requireRecord(value, path)

  return {
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    earliestAfterEncounter: requireString(
      record.earliestAfterEncounter,
      `${path}.earliestAfterEncounter`,
    ),
    jobsUnlocked: requireCrystal(record.jobsUnlocked, `${path}.jobsUnlocked`),
  }
}

function requireCrystal(value: unknown, path: string): FinalFantasyVCrystalId {
  const crystal = requireString(value, path)
  if (!(crystal in finalFantasyVCrystalUnlockOrdinal)) {
    throw new Error(`${path} must be a known Final Fantasy V crystal unlock`)
  }

  return crystal as FinalFantasyVCrystalId
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

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${path} must be a positive integer`)
  }

  return value
}
