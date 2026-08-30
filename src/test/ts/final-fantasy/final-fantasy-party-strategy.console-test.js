import { readFile } from "node:fs/promises"

import {
  loadFinalFantasyPartyStrategyEngine,
} from "./party-strategy.ts"

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
  console.error("Usage: node src/test/ts/final-fantasy/final-fantasy-party-strategy.console-test.js <positive integer occurrences>")
  process.exitCode = 1
} else {
  const engine = await loadFinalFantasyPartyStrategyEngine(loadProjectFile)

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const party = engine.createRandomParty()
    const strategy = engine.analyze(party)

    console.log(`\n=== FF1 run ${occurrence + 1} ===`)
    console.log(engine.render(strategy))
  }

  console.log(`\nCompleted ${occurrences} random FF1 strategy runs.`)
}
