import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  describeFinalFantasyStrategyCatalog,
  finalFantasyStrategyYamlFiles,
  loadFinalFantasyStrategyData,
} from "../../main/ts/final-fantasy-strategy-core.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../${path}`, import.meta.url), "utf8")

test("loads the Final Fantasy strategy YAML catalogs", async () => {
  const data = await loadFinalFantasyStrategyData(loadProjectFile)

  assert.deepEqual(
    Object.values(finalFantasyStrategyYamlFiles),
    Object.values(data).map((document) => document.path),
  )
  assert.match(data.classes.text, /^- class: warrior/)
  assert.match(data.spells.text, /^- spell:/)
  assert.match(data.bosses.text, /^- boss: garland/)
  assert.match(data.bossStrategy.text, /^bossGroups:/)
  assert.equal(
    describeFinalFantasyStrategyCatalog(),
    "TypeScript connected; 4 YAML catalogs configured.",
  )
})
