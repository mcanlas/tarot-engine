import {
  selectBoss,
  type BossCatalog,
  type BossEncounter,
} from "./bosses.ts"
import {
  galufAvailabilityByCrystal,
  jobIsAvailableThroughCrystal,
  type GalufAvailability,
  type StrategyCatalog,
} from "./catalog.ts"
import { slotCount } from "./loadouts.ts"
import type { CharacterId } from "./party-strategy.ts"

export interface RandomPartyMemberCandidate {
  readonly characterId: CharacterId
  readonly jobId: string
  readonly assignmentIds: readonly string[]
}

export interface RandomParty {
  readonly members: readonly RandomPartyMemberCandidate[]
}

export interface RandomStoryParty extends RandomParty {
  readonly boss: BossEncounter
}

export interface StoryAvailability {
  readonly characterIds: readonly CharacterId[]
  readonly galufAvailability: GalufAvailability
  readonly jobIds: readonly string[]
  readonly abilityIds: readonly string[]
}

type CharacterSlot = CharacterId | "galuf-or-krile"

const randomPartyCharacterSlots: readonly CharacterSlot[] = [
  "bartz",
  "lenna",
  "faris",
  "galuf-or-krile",
]

export function createRandomParty(
  catalog: StrategyCatalog,
  random: () => number = Math.random,
): RandomParty {
  return {
    members: createRandomPartyMembers(
      randomPartyCharacterSlots,
      [...catalog.jobs.keys()],
      [...catalog.abilities.keys()],
      random,
    ),
  }
}

export function createRandomStoryParty(
  strategyCatalog: StrategyCatalog,
  bossCatalog: BossCatalog,
  random: () => number = Math.random,
): RandomStoryParty {
  const boss = selectBoss(bossCatalog, { kind: "random", random })
  const availability = storyAvailability(strategyCatalog, boss)

  return {
    boss,
    members: createRandomLoadoutsForCharacters(
      canonicalStoryCharacterIds(availability.galufAvailability),
      availability.jobIds,
      availability.abilityIds,
      random,
    ),
  }
}

export function storyAvailability(
  catalog: StrategyCatalog,
  boss: BossEncounter,
): StoryAvailability {
  const jobs = [...catalog.jobs.values()]
    .filter((job) => jobIsAvailableThroughCrystal(job, boss.jobsUnlocked))
  const jobIds = jobs.map((job) => job.id)
  const jobIdSet = new Set(jobIds)
  const galufAvailability = galufAvailabilityByCrystal[boss.jobsUnlocked]

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

export function canonicalStoryCharacterIds(
  galufAvailability: GalufAvailability,
): readonly CharacterId[] {
  return galufAvailability === "cannot"
    ? ["bartz", "lenna", "krile", "faris"]
    : ["bartz", "lenna", "galuf", "faris"]
}

function createRandomPartyMembers(
  characterSlots: readonly CharacterSlot[],
  jobIds: readonly string[],
  abilityIds: readonly string[],
  random: () => number,
): RandomPartyMemberCandidate[] {
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
  characterIds: readonly CharacterId[],
  jobIds: readonly string[],
  abilityIds: readonly string[],
  random: () => number,
): RandomPartyMemberCandidate[] {
  return characterIds.map((characterId) => createRandomLoadoutForCharacter(
    characterId,
    randomItem(jobIds, random),
    abilityIds,
    random,
  ))
}

function createRandomLoadoutForCharacter(
  characterId: CharacterId,
  jobId: string,
  abilityIds: readonly string[],
  random: () => number,
): RandomPartyMemberCandidate {
  return {
    characterId,
    jobId,
    assignmentIds: Array.from(
      { length: randomIndex(slotCount(jobId) + 1, random) },
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
