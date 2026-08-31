import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { parse } from "yaml"
import {
  buildStrategyCatalog,
  decodeJobs,
  crystalUnlockOrdinal,
  jobIsAvailableThroughCrystal,
} from "../../../main/ts/final-fantasy-v/index.ts"

const jobsYaml = readFileSync("data/final-fantasy-v-jobs.yaml", "utf8")
const catalog = buildStrategyCatalog(decodeJobs(parse(jobsYaml)))

test("orders FFV crystal job unlocks", () => {
  assert.deepEqual(crystalUnlockOrdinal, {
    none: 0,
    wind: 1,
    "water-1": 2,
    "fire-1": 3,
    "fire-2": 4,
    earth: 5,
    "water-2": 6,
  })
})

test("queries jobs available through a crystal unlock batch", () => {
  const availableAtWater = [...catalog.jobs.values()]
    .filter((job) => jobIsAvailableThroughCrystal(job, "water-1"))
    .map((job) => job.id)

  assert.deepEqual(availableAtWater, [
    "freelancer",
    "knight",
    "monk",
    "thief",
    "white-mage",
    "black-mage",
    "blue-mage",
    "berserker",
    "mystic-knight",
    "time-mage",
    "summoner",
    "red-mage",
  ])

  const availableAtInitialFire = [...catalog.jobs.values()]
    .filter((job) => jobIsAvailableThroughCrystal(job, "fire-1"))
    .map((job) => job.id)
  assert.equal(availableAtInitialFire.includes("beastmaster"), true)
  assert.equal(availableAtInitialFire.includes("bard"), false)
  assert.equal(availableAtInitialFire.includes("ranger"), false)
  assert.equal(availableAtInitialFire.includes("mime"), false)

  const availableAtBlackChocobo = [...catalog.jobs.values()]
    .filter((job) => jobIsAvailableThroughCrystal(job, "fire-2"))
    .map((job) => job.id)
  assert.equal(availableAtBlackChocobo.includes("bard"), true)
  assert.equal(availableAtBlackChocobo.includes("ranger"), true)
})
