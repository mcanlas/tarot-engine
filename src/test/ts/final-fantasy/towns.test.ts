import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parse } from "yaml"

import {
  cumulativeTown,
  decodeTowns,
  townsYamlFile,
  loadTowns,
} from "../../../main/ts/final-fantasy/towns.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

test("loads seeded town shops", async () => {
  const definitions = await loadTowns(loadProjectFile)

  assert.equal(townsYamlFile, "data/final-fantasy/towns.yaml")
  assert.deepEqual(definitions, {
    towns: [
      {
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
      },
      {
        key: "provoka",
        name: "Provoka",
        shops: [
          {
            type: "weapons",
            wares: ["hammer", "broadsword", "battle-axe", "scimitar"],
          },
          {
            type: "armor",
            wares: ["leather-armor", "chain-mail", "iron-armor", "leather-shield", "gloves"],
          },
          {
            type: "white-magic",
            wares: ["blindna", "silence", "nulshock", "invis"],
          },
          {
            type: "black-magic",
            wares: ["blizzard", "dark", "temper", "slow"],
          },
        ],
      },
    ],
  })
})

test("seeds catalog records for every town ware key", async () => {
  const [definitions, itemDocument, magicDocument] = await Promise.all([
    loadTowns(loadProjectFile),
    loadProjectFile("data/final-fantasy/items.yaml").then(parse),
    loadProjectFile("data/final-fantasy/magic.yaml").then(parse),
  ])
  const itemKeys = new Set(itemDocument.items.map((item: { key: string }) => item.key))
  const magicKeys = new Set(magicDocument.magic.map((spell: { key: string }) => spell.key))

  assert.deepEqual([...itemKeys], [
    "nunchaku",
    "knife",
    "staff",
    "rapier",
    "hammer",
    "broadsword",
    "battle-axe",
    "scimitar",
    "clothes",
    "leather-armor",
    "chain-mail",
    "iron-armor",
    "leather-shield",
    "gloves",
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
    "blindna",
    "silence",
    "nulshock",
    "invis",
    "blizzard",
    "dark",
    "temper",
    "slow",
  ])
  for (const town of definitions.towns) {
    for (const shop of town.shops) {
      const keys = shop.type === "weapons" || shop.type === "armor" ? itemKeys : magicKeys
      assert(shop.wares.every((key) => keys.has(key)))
    }
  }
})

test("resolves ordinal town access through the selected town", async () => {
  const definitions = await loadTowns(loadProjectFile)

  assert.deepEqual(cumulativeTown(definitions, "cornelia"), definitions.towns[0])
  assert.deepEqual(cumulativeTown(definitions, "provoka"), {
    key: "provoka",
    name: "Provoka",
    shops: [
      {
        type: "weapons",
        wares: [
          "nunchaku",
          "knife",
          "staff",
          "rapier",
          "hammer",
          "broadsword",
          "battle-axe",
          "scimitar",
        ],
      },
      {
        type: "armor",
        wares: [
          "clothes",
          "leather-armor",
          "chain-mail",
          "iron-armor",
          "leather-shield",
          "gloves",
        ],
      },
      {
        type: "white-magic",
        wares: ["cure", "dia", "protect", "blink", "blindna", "silence", "nulshock", "invis"],
      },
      {
        type: "black-magic",
        wares: ["fire", "sleep", "focus", "thunder", "blizzard", "dark", "temper", "slow"],
      },
    ],
  })
  assert.throws(
    () => cumulativeTown(definitions, "elfheim"),
    /elfheim is missing from the Final Fantasy town catalog/,
  )
})

test("rejects malformed town, shop, and ware fields", () => {
  assert.throws(
    () => decodeTowns([]),
    /Final Fantasy towns must be an object/,
  )
  assert.throws(
    () => decodeTowns({ towns: {} }),
    /Final Fantasy towns.towns must be an array/,
  )
  assert.throws(
    () => decodeTowns({ towns: [{ key: "", name: "Cornelia", shops: [] }] }),
    /towns\[0\]\.key must be a non-empty string/,
  )
  assert.throws(
    () => decodeTowns({ towns: [{ key: "cornelia", name: "Cornelia", shops: [{}] }] }),
    /shops\[0\]\.type must be a non-empty string/,
  )
  assert.throws(
    () => decodeTowns({
      towns: [{ key: "cornelia", name: "Cornelia", shops: [{ type: "items", wares: [] }] }],
    }),
    /shops\[0\]\.type must be a known Final Fantasy shop type/,
  )
  assert.throws(
    () => decodeTowns({
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
    loadTowns(async () => "  "),
    /YAML data is empty: data\/final-fantasy\/towns.yaml/,
  )
  await assert.rejects(
    loadTowns(async () => "towns: ["),
    /Invalid data\/final-fantasy\/towns.yaml/,
  )
})
