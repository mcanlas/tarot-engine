import {
  selectFinalFantasyVBoss,
  type FinalFantasyVBossCatalog,
  type FinalFantasyVBossEncounter,
} from "./bosses.ts"
import {
  finalFantasyVGalufAvailabilityByCrystal,
  finalFantasyVJobIsAvailableThroughCrystal,
  type FinalFantasyVGalufAvailability,
  type FinalFantasyVStrategyCatalog,
} from "./catalog.ts"
import { finalFantasyVSlotCount } from "./loadouts.ts"
import type { FinalFantasyVCharacterId } from "./party-strategy.ts"

export interface FinalFantasyVRandomPartyMemberCandidate {
  readonly characterId: FinalFantasyVCharacterId
  readonly jobId: string
  readonly assignmentIds: readonly string[]
}

export interface FinalFantasyVRandomParty {
  readonly members: readonly FinalFantasyVRandomPartyMemberCandidate[]
}

export interface FinalFantasyVRandomStoryParty extends FinalFantasyVRandomParty {
  readonly boss: FinalFantasyVBossEncounter
}

export interface FinalFantasyVStoryAvailability {
  readonly characterIds: readonly FinalFantasyVCharacterId[]
  readonly galufAvailability: FinalFantasyVGalufAvailability
  readonly jobIds: readonly string[]
  readonly abilityIds: readonly string[]
}

type CharacterSlot = FinalFantasyVCharacterId | "galuf-or-krile"

const randomPartyCharacterSlots: readonly CharacterSlot[] = [
  "bartz",
  "lenna",
  "faris",
  "galuf-or-krile",
]

export function createRandomFinalFantasyVParty(
  catalog: FinalFantasyVStrategyCatalog,
  random: () => number = Math.random,
): FinalFantasyVRandomParty {
  return {
    members: createRandomPartyMembers(
      randomPartyCharacterSlots,
      [...catalog.jobs.keys()],
      [...catalog.abilities.keys()],
      random,
    ),
  }
}

export function createRandomFinalFantasyVStoryParty(
  strategyCatalog: FinalFantasyVStrategyCatalog,
  bossCatalog: FinalFantasyVBossCatalog,
  random: () => number = Math.random,
): FinalFantasyVRandomStoryParty {
  const boss = selectFinalFantasyVBoss(bossCatalog, { kind: "random", random })
  const availability = finalFantasyVStoryAvailability(strategyCatalog, boss)

  return {
    boss,
    members: createRandomLoadoutsForCharacters(
      finalFantasyVCanonicalStoryCharacterIds(availability.galufAvailability),
      availability.jobIds,
      availability.abilityIds,
      random,
    ),
  }
}

export function finalFantasyVStoryAvailability(
  catalog: FinalFantasyVStrategyCatalog,
  boss: FinalFantasyVBossEncounter,
): FinalFantasyVStoryAvailability {
  const jobs = [...catalog.jobs.values()]
    .filter((job) => finalFantasyVJobIsAvailableThroughCrystal(job, boss.jobsUnlocked))
  const jobIds = jobs.map((job) => job.id)
  const jobIdSet = new Set(jobIds)
  const galufAvailability = finalFantasyVGalufAvailabilityByCrystal[boss.jobsUnlocked]

  return {
    characterIds: galufAvailability === "must"
      ? ["bartz", "lenna", "galuf", "faris"]
      : galufAvailability === "cannot"
        ? ["bartz", "lenna", "krile", "faris"]
        : ["bartz", "lenna", "galuf", "krile", "faris"],
    galufAvailability,
    jobIds,
    abilityIds: [...catalog.abilities.values()]
      .filter((ability) => jobIdSet.has(ability.jobId))
      .map((ability) => ability.id),
  }
}

export function finalFantasyVCanonicalStoryCharacterIds(
  galufAvailability: FinalFantasyVGalufAvailability,
): readonly FinalFantasyVCharacterId[] {
  return galufAvailability === "cannot"
    ? ["bartz", "lenna", "krile", "faris"]
    : ["bartz", "lenna", "galuf", "faris"]
}

function createRandomPartyMembers(
  characterSlots: readonly CharacterSlot[],
  jobIds: readonly string[],
  abilityIds: readonly string[],
  random: () => number,
): FinalFantasyVRandomPartyMemberCandidate[] {
  const partySize = randomIndex(characterSlots.length, random) + 1
  const selectedCharacterSlots = sampleWithoutReplacement(characterSlots, partySize, random)

  return selectedCharacterSlots.map((characterSlot) => {
    const jobId = randomItem(jobIds, random)
    const characterId = characterSlot === "galuf-or-krile"
      ? randomItem(["galuf", "krile"] as const, random)
      : characterSlot

    return createRandomLoadoutForCharacter(characterId, jobId, abilityIds, random)
  })
}

function createRandomLoadoutsForCharacters(
  characterIds: readonly FinalFantasyVCharacterId[],
  jobIds: readonly string[],
  abilityIds: readonly string[],
  random: () => number,
): FinalFantasyVRandomPartyMemberCandidate[] {
  return characterIds.map((characterId) => createRandomLoadoutForCharacter(
    characterId,
    randomItem(jobIds, random),
    abilityIds,
    random,
  ))
}

function createRandomLoadoutForCharacter(
  characterId: FinalFantasyVCharacterId,
  jobId: string,
  abilityIds: readonly string[],
  random: () => number,
): FinalFantasyVRandomPartyMemberCandidate {
  return {
    characterId,
    jobId,
    assignmentIds: Array.from(
      { length: randomIndex(finalFantasyVSlotCount(jobId) + 1, random) },
      () => randomItem(abilityIds, random),
    ),
  }
}

function randomItem<T>(values: readonly T[], random: () => number): T {
  const value = values[randomIndex(values.length, random)]
  if (value === undefined) {
    throw new Error("Cannot choose from an empty Final Fantasy V random candidate pool")
  }

  return value
}

function randomIndex(length: number, random: () => number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("Final Fantasy V party random source must return a number from 0 through 1")
  }

  return Math.floor(value * length)
}

function sampleWithoutReplacement<T>(
  values: readonly T[],
  count: number,
  random: () => number,
): T[] {
  const shuffled = [...values]

  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + randomIndex(shuffled.length - index, random)
    const selected = shuffled[index]!
    shuffled[index] = shuffled[swapIndex]!
    shuffled[swapIndex] = selected
  }

  return shuffled.slice(0, count)
}
