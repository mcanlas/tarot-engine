import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { parse } from "yaml"

import {
  buildFinalFantasyVBossCatalog,
  buildFinalFantasyVStrategyCatalog,
  createRandomFinalFantasyVParty,
  createRandomFinalFantasyVStoryParty,
  decodeFinalFantasyVBosses,
  decodeFinalFantasyVJobs,
  finalFantasyVCanonicalStoryCharacterIds,
  finalFantasyVCrystalUnlockOrdinal,
  finalFantasyVGalufAvailabilityByCrystal,
  finalFantasyVStoryAvailability,
  finalFantasyVStrategyYamlFiles,
} from "../../../main/ts/final-fantasy-v/index.ts"

const strategyCatalog = buildFinalFantasyVStrategyCatalog(decodeFinalFantasyVJobs(parse(
  await readFile(finalFantasyVStrategyYamlFiles.jobs, "utf8"),
)))
const bossCatalog = buildFinalFantasyVBossCatalog(decodeFinalFantasyVBosses(parse(
  await readFile(finalFantasyVStrategyYamlFiles.bosses, "utf8"),
)))

test("random party preserves unconstrained catalog-wide generation", () => {
  const party = createRandomFinalFantasyVParty(strategyCatalog, () => 0.9999)

  assert.equal(party.members.length, 4)
  assert(party.members.some((member) => member.characterId === "krile"))
  assert(party.members.every((member) => strategyCatalog.jobs.has(member.jobId)))
  assert(party.members.some((member) =>
    finalFantasyVCrystalUnlockOrdinal[
      strategyCatalog.jobs.get(member.jobId)!.crystal
    ] > finalFantasyVCrystalUnlockOrdinal.wind))
})

test("random story party selects its boss before filtering its candidate pools", () => {
  const values = [0.4]
  const random = () => values.shift() ?? 0.9999
  const story = createRandomFinalFantasyVStoryParty(strategyCatalog, bossCatalog, random)
  const availability = finalFantasyVStoryAvailability(strategyCatalog, story.boss)

  assert.equal(story.boss.key, "liquid-flame")
  assert.equal(story.boss.jobsUnlocked, "water-1")
  assert.equal(availability.galufAvailability, "must")
  assert.deepEqual(story.members.map((member) => member.characterId), [
    "bartz",
    "lenna",
    "galuf",
    "faris",
  ])
  assert(story.members.every((member) => availability.characterIds.includes(member.characterId)))
  assert(story.members.every((member) => availability.jobIds.includes(member.jobId)))
  assert(story.members.flatMap((member) => member.assignmentIds)
    .every((abilityId) => availability.abilityIds.includes(abilityId)))
})

test("every current random story boss produces milestone-valid characters, jobs, and abilities", () => {
  bossCatalog.encounters.forEach((_boss, index) => {
    let first = true
    const random = () => {
      if (first) {
        first = false
        return (index + 0.5) / bossCatalog.encounters.length
      }

      return 0.75
    }
    const story = createRandomFinalFantasyVStoryParty(strategyCatalog, bossCatalog, random)
    const availability = finalFantasyVStoryAvailability(strategyCatalog, story.boss)

    assert.equal(story.boss.key, bossCatalog.encounters[index]!.key)
    assert.deepEqual(story.members.map((member) => member.characterId), [
      "bartz",
      "lenna",
      "galuf",
      "faris",
    ])
    assert(story.members.every((member) => availability.characterIds.includes(member.characterId)))
    assert(story.members.every((member) => availability.jobIds.includes(member.jobId)))
    assert(story.members.flatMap((member) => member.assignmentIds)
      .every((abilityId) => availability.abilityIds.includes(abilityId)))
    assert(!story.members.some((member) => member.characterId === "krile"))
  })
})

test("crystal progression owns Galuf availability independently of bosses", () => {
  assert.deepEqual(finalFantasyVGalufAvailabilityByCrystal, {
    none: "must",
    wind: "must",
    "water-1": "must",
    "fire-1": "must",
    "fire-2": "must",
    earth: "can",
    "water-2": "cannot",
  })

  const template = bossCatalog.encounters[0]!
  assert.deepEqual(
    finalFantasyVStoryAvailability(
      strategyCatalog,
      { ...template, jobsUnlocked: "earth" },
    ).characterIds,
    ["bartz", "lenna", "galuf", "krile", "faris"],
  )
  assert.deepEqual(
    finalFantasyVStoryAvailability(
      strategyCatalog,
      { ...template, jobsUnlocked: "water-2" },
    ).characterIds,
    ["bartz", "lenna", "krile", "faris"],
  )
  assert.deepEqual(finalFantasyVCanonicalStoryCharacterIds("must"), [
    "bartz", "lenna", "galuf", "faris",
  ])
  assert.deepEqual(finalFantasyVCanonicalStoryCharacterIds("can"), [
    "bartz", "lenna", "galuf", "faris",
  ])
  assert.deepEqual(finalFantasyVCanonicalStoryCharacterIds("cannot"), [
    "bartz", "lenna", "krile", "faris",
  ])
})

test("both random generators reject invalid random sources", () => {
  assert.throws(
    () => createRandomFinalFantasyVParty(strategyCatalog, () => -0.1),
    /party random source must return a number from 0 through 1/,
  )
  assert.throws(
    () => createRandomFinalFantasyVStoryParty(strategyCatalog, bossCatalog, () => 1),
    /boss random source must return a number from 0 through 1/,
  )
})
