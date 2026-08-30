import { readFile } from "node:fs/promises"

import {
  createRandomPartyBossStrategy,
  loadFinalFantasyPartyStrategyEngine,
  renderBossStrategy,
} from "./party-strategy.ts"
import { loadFinalFantasyStrategyEngine } from "../../../main/ts/final-fantasy/strategy-data.ts"

const loadProjectFile = (path) =>
  readFile(new URL(`../../../../${path}`, import.meta.url), "utf8")

const [occurrencesText, ...extraArgs] = process.argv.slice(2)
const occurrences = Number(occurrencesText)

if (
  extraArgs.length > 0
  || occurrencesText === undefined
  || !Number.isSafeInteger(occurrences)
  || occurrences < 1
) {
  console.error("Usage: node src/test/ts/final-fantasy/party-strategy.console-test.js <positive integer occurrences>")
  process.exitCode = 1
} else {
  const [partyEngine, bossEngine] = await Promise.all([
    loadFinalFantasyPartyStrategyEngine(loadProjectFile),
    loadFinalFantasyStrategyEngine(loadProjectFile),
  ])

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const strategy = createRandomPartyBossStrategy(partyEngine, bossEngine)

    console.log(`\n=== FF1 run ${occurrence + 1} ===`)
    console.log(partyEngine.render(strategy.partyStrategy))
    console.log("\nRandom boss strategy:")
    console.log(renderBossStrategy(strategy))
  }

  console.log(`\nCompleted ${occurrences} random FF1 strategy runs.`)
}
