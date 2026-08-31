import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parse } from "yaml"

import {
  decodeFinalFantasyTowns,
  finalFantasyTownsYamlFile,
  loadFinalFantasyTowns,
} from "../../../main/ts/final-fantasy/towns.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

test("loads Cornelia's four seeded shops", async () => {
  const definitions = await loadFinalFantasyTowns(loadProjectFile)

  assert.equal(finalFantasyTownsYamlFile, "data/final-fantasy/towns.yaml")
  assert.deepEqual(definitions, {
    towns: [{
      key: "cornelia",
      name: "Cornelia",
      shops: [
        {
          type: "weapons",
          wares: ["nunchaku", "knife", "staff", "rapier", "hammer"],
        },
        {
          type: "armor",
          wares: ["clothes", "leather-armor", "chain-mail"],
        },
        {
          type: "white-magic",
          wares: ["cure", "dia", "protect", "blink"],
        },
        {
          type: "black-magic",
          wares: ["fire", "sleep", "focus", "thunder"],
        },
      ],
    }],
  })
})

test("seeds catalog records for every Cornelia ware key", async () => {
  const [definitions, itemDocument, magicDocument] = await Promise.all([
    loadFinalFantasyTowns(loadProjectFile),
    loadProjectFile("data/final-fantasy/items.yaml").then(parse),
    loadProjectFile("data/final-fantasy/magic.yaml").then(parse),
  ])
  const itemKeys = new Set(itemDocument.items.map((item: { key: string }) => item.key))
  const magicKeys = new Set(magicDocument.magic.map((spell: { key: string }) => spell.key))
  const [weapons, armor, whiteMagic, blackMagic] = definitions.towns[0]!.shops

  assert.deepEqual([...itemKeys], [
    "nunchaku",
    "knife",
    "staff",
    "rapier",
    "hammer",
    "clothes",
    "leather-armor",
    "chain-mail",
  ])
  assert.deepEqual([...magicKeys], [
    "cure",
    "dia",
    "protect",
    "blink",
    "fire",
    "sleep",
    "focus",
    "thunder",
  ])
  assert(weapons!.wares.every((key) => itemKeys.has(key)))
  assert(armor!.wares.every((key) => itemKeys.has(key)))
  assert(whiteMagic!.wares.every((key) => magicKeys.has(key)))
  assert(blackMagic!.wares.every((key) => magicKeys.has(key)))
})

test("rejects malformed town, shop, and ware fields", () => {
  assert.throws(
    () => decodeFinalFantasyTowns([]),
    /Final Fantasy towns must be an object/,
  )
  assert.throws(
    () => decodeFinalFantasyTowns({ towns: {} }),
    /Final Fantasy towns.towns must be an array/,
  )
  assert.throws(
    () => decodeFinalFantasyTowns({ towns: [{ key: "", name: "Cornelia", shops: [] }] }),
    /towns\[0\]\.key must be a non-empty string/,
  )
  assert.throws(
    () => decodeFinalFantasyTowns({ towns: [{ key: "cornelia", name: "Cornelia", shops: [{}] }] }),
    /shops\[0\]\.type must be a non-empty string/,
  )
  assert.throws(
    () => decodeFinalFantasyTowns({
      towns: [{ key: "cornelia", name: "Cornelia", shops: [{ type: "items", wares: [] }] }],
    }),
    /shops\[0\]\.type must be a known Final Fantasy shop type/,
  )
  assert.throws(
    () => decodeFinalFantasyTowns({
      towns: [{
        key: "cornelia",
        name: "Cornelia",
        shops: [{ type: "weapons", wares: [{ key: "knife" }] }],
      }],
    }),
    /wares\[0\] must be a non-empty string/,
  )
})

test("reports empty and invalid town YAML", async () => {
  await assert.rejects(
    loadFinalFantasyTowns(async () => "  "),
    /YAML data is empty: data\/final-fantasy\/towns.yaml/,
  )
  await assert.rejects(
    loadFinalFantasyTowns(async () => "towns: ["),
    /Invalid data\/final-fantasy\/towns.yaml/,
  )
})
