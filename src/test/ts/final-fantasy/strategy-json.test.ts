import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parse } from "yaml"

import { FinalFantasyPartyStrategyEngine } from "../../../main/ts/final-fantasy/party-strategy-core.ts"
import {
  buildFinalFantasyStrategyEngine,
  createFullToolkitParty,
} from "../../../main/ts/final-fantasy/strategy-core.ts"
import { decodeStrategyPayload } from "../../../main/ts/final-fantasy/strategy-json.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

test("browser payload preserves ordered party and boss-position rules", async () => {
  const [classes, spells, bosses, strategy, partyStrategy] = await Promise.all([
    loadYaml("data/final-fantasy-classes.yaml"),
    loadYaml("data/final-fantasy-spells.yaml"),
    loadYaml("data/final-fantasy-bosses.yaml"),
    loadYaml("data/final-fantasy-boss-strategy.yaml"),
    loadYaml("data/final-fantasy-party-strategy.yaml"),
  ])
  const payload = decodeStrategyPayload({ classes, spells, bosses, strategy, partyStrategy })
  const bossEngine = buildFinalFantasyStrategyEngine(payload.definitions)
  const partyEngine = new FinalFantasyPartyStrategyEngine(bossEngine.catalog, payload.partyRules)
  const classIds = ["white-mage", "warrior"]
  const partyRules = partyEngine.analyze(classIds).observations
    .map((observation) => observation.ruleId)
  const hybridRules = partyEngine.analyze(["red-mage"]).observations
    .map((observation) => observation.ruleId)
  const bossAdvice = bossEngine
    .guideFor(createFullToolkitParty(bossEngine.catalog, classIds), "kraken")
    .fragments.map((fragment) => fragment.advice)

  assert(partyRules.includes("fragile-front"))
  assert(partyRules.includes("primary-frontliner-behind"))
  assert(hybridRules.includes("hybrid-action-bottleneck"))
  assert(bossAdvice.some((advice) => advice.includes("cast Protect on the White Mage")))
  assert(bossAdvice.some((advice) => advice.includes("White Mage cast Blink early")))
})

async function loadYaml(path: string): Promise<unknown> {
  return parse(await loadProjectFile(path))
}
