import { readFile } from "node:fs/promises"

import {
  loadFinalFantasyPartyStrategyEngine,
} from "./final-fantasy-party-strategy.ts"

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
  console.error("Usage: npm run test:party-strategy-console -- <positive integer occurrences>")
  process.exitCode = 1
} else {
  const engine = await loadFinalFantasyPartyStrategyEngine(loadProjectFile)
  const sizeCounts = new Map([1, 2, 3, 4].map((size) => [size, 0]))
  const classCounts = new Map(engine.classIds.map((classId) => [classId, 0]))
  const ruleCounts = new Map(engine.ruleIds.map((ruleId) => [ruleId, 0]))
  const uniqueParties = new Set()
  const anomalies = []
  let memberCount = 0

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const party = engine.createRandomParty()
    const strategy = engine.analyze(party)
    const strengths = strategy.observations.filter(({ kind }) => kind === "strength")
    const weaknesses = strategy.observations.filter(({ kind }) => kind === "weakness")

    sizeCounts.set(party.length, (sizeCounts.get(party.length) ?? 0) + 1)
    memberCount += party.length
    party.forEach((classId) => classCounts.set(classId, (classCounts.get(classId) ?? 0) + 1))
    strategy.observations.forEach(({ ruleId }) =>
      ruleCounts.set(ruleId, (ruleCounts.get(ruleId) ?? 0) + 1))
    uniqueParties.add([...party].sort().join("/"))

    if (strengths.length === 0 || weaknesses.length === 0) {
      anomalies.push(`${party.join("/")}: ${strengths.length} strengths, ${weaknesses.length} weaknesses`)
    }
  }

  const percent = (count, total) => `${(100 * count / total).toFixed(2)}%`
  const formatCounts = (counts, total) => [...counts]
    .map(([name, count]) => `  ${name}: ${count} (${percent(count, total)})`)
    .join("\n")
  const missedRules = [...ruleCounts].filter(([, count]) => count === 0).map(([ruleId]) => ruleId)

  console.log(`Analyzed ${occurrences} random parties (${memberCount} member slots).`)
  console.log(`Unique unordered parties: ${uniqueParties.size} / 209`)
  console.log(`Party sizes:\n${formatCounts(sizeCounts, occurrences)}`)
  console.log(`Classes by member slot:\n${formatCounts(classCounts, memberCount)}`)
  console.log(`Rule activations:\n${formatCounts(ruleCounts, occurrences)}`)
  console.log(`Rules not reached: ${missedRules.length === 0 ? "none" : missedRules.join(", ")}`)
  console.log(`Parties missing a strength or weakness: ${anomalies.length}`)

  if (anomalies.length > 0) {
    console.log(anomalies.slice(0, 10).map((anomaly) => `  ${anomaly}`).join("\n"))
    process.exitCode = 1
  }
}
