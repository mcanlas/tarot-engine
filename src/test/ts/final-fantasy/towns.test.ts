import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

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
          wares: [
            { key: "nunchaku", name: "Nunchaku", price: 8 },
            { key: "knife", name: "Knife", price: 4 },
            { key: "staff", name: "Staff", price: 4 },
            { key: "rapier", name: "Rapier", price: 8 },
            { key: "hammer", name: "Hammer", price: 8 },
          ],
        },
        {
          type: "armor",
          wares: [
            { key: "clothes", name: "Clothes", price: 8 },
            { key: "leather-armor", name: "Leather Armor", price: 40 },
            { key: "chain-mail", name: "Chain Mail", price: 65 },
          ],
        },
        {
          type: "white-magic",
          wares: [
            { key: "cure", name: "Cure", price: 50 },
            { key: "dia", name: "Dia", price: 50 },
            { key: "protect", name: "Protect", price: 50 },
            { key: "blink", name: "Blink", price: 50 },
          ],
        },
        {
          type: "black-magic",
          wares: [
            { key: "fire", name: "Fire", price: 50 },
            { key: "sleep", name: "Sleep", price: 50 },
            { key: "focus", name: "Focus", price: 50 },
            { key: "thunder", name: "Thunder", price: 50 },
          ],
        },
      ],
    }],
  })
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
        shops: [{ type: "weapons", wares: [{ key: "knife", name: "Knife", price: -1 }] }],
      }],
    }),
    /wares\[0\]\.price must be a non-negative integer/,
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
