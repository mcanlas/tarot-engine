import type {
  FinalFantasyVAbilityDefinition,
  FinalFantasyVAbilityRankDefinition,
  FinalFantasyVJobDefinition,
} from "./final-fantasy-v-strategy-core.ts"

export function decodeFinalFantasyVJobs(value: unknown): FinalFantasyVJobDefinition[] {
  return requireArray(value, "Final Fantasy V jobs").map(decodeJob)
}

function decodeJob(value: unknown, index: number): FinalFantasyVJobDefinition {
  const path = `Final Fantasy V jobs[${index}]`
  const record = requireRecord(value, path)

  return {
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    crystal: requireString(record.crystal, `${path}.crystal`),
    innates: requireStringArray(record.innates, `${path}.innates`),
    abilities: requireArray(record.abilities, `${path}.abilities`)
      .map((ability, abilityIndex) => decodeAbility(ability, `${path}.abilities[${abilityIndex}]`)),
  }
}

function decodeAbility(value: unknown, path: string): FinalFantasyVAbilityDefinition {
  const record = requireRecord(value, path)
  const common = {
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    type: requireString(record.type, `${path}.type`),
    ...(record.assignable === undefined
      ? {}
      : { assignable: requireBoolean(record.assignable, `${path}.assignable`) }),
  }

  if (record.ranks !== undefined) {
    if (record.level !== undefined || record.abp !== undefined) {
      throw new Error(`${path} cannot mix ranks with level or abp`)
    }

    return {
      ...common,
      innateRank: requireNumber(record.innateRank, `${path}.innateRank`),
      ranks: requireArray(record.ranks, `${path}.ranks`)
        .map((rank, rankIndex) => decodeRank(rank, `${path}.ranks[${rankIndex}]`)),
    }
  }

  if (record.innateRank !== undefined) {
    throw new Error(`${path}.innateRank requires ranks`)
  }

  return {
    ...common,
    level: requireNumber(record.level, `${path}.level`),
    abp: requireNumber(record.abp, `${path}.abp`),
  }
}

function decodeRank(value: unknown, path: string): FinalFantasyVAbilityRankDefinition {
  const record = requireRecord(value, path)

  return {
    rank: requireNumber(record.rank, `${path}.rank`),
    jobLevel: requireNumber(record.jobLevel, `${path}.jobLevel`),
    abp: requireNumber(record.abp, `${path}.abp`),
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
  return requireArray(value, path)
    .map((item, index) => requireString(item, `${path}[${index}]`))
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`)
  }

  return value
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`)
  }

  return value
}
