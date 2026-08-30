import { readFile } from "node:fs/promises"

import { parse } from "yaml"

import {
  buildFinalFantasyVStrategyCatalog,
  decodeFinalFantasyVJobs,
  decodeFinalFantasyVPartyStrategy,
  FinalFantasyVPartyStrategyEngine,
  finalFantasyVSlotCount,
  finalFantasyVStrategyYamlFiles,
  validateFinalFantasyVLoadout,
} from "../../../main/ts/final-fantasy-v/index.ts"

const characterSlots = ["bartz", "lenna", "faris", "galuf-or-krile"]

const [occurrencesText, ...extraArgs] = process.argv.slice(2)
const occurrences = Number(occurrencesText)

if (
  extraArgs.length > 0
  || occurrencesText === undefined
  || !Number.isSafeInteger(occurrences)
  || occurrences < 1
) {
  console.error("Usage: node src/test/ts/final-fantasy-v/party-strategy.console-test.js <positive integer occurrences>")
  process.exitCode = 1
} else {
  const jobsYaml = await readFile(finalFantasyVStrategyYamlFiles.jobs, "utf8")
  const catalog = buildFinalFantasyVStrategyCatalog(decodeFinalFantasyVJobs(parse(jobsYaml)))
  const strategyYaml = await readFile(finalFantasyVStrategyYamlFiles.partyStrategy, "utf8")
  const rules = decodeFinalFantasyVPartyStrategy(parse(strategyYaml))
  const engine = new FinalFantasyVPartyStrategyEngine(catalog, rules)
  const jobIds = [...catalog.jobs.keys()]
  const abilityIds = [...catalog.abilities.keys()]
  const learningState = {
    learnedAbilities: [...catalog.abilities.values()].map((ability) => ability.kind === "flat"
      ? { kind: "flat", abilityId: ability.id }
      : { kind: "ranked", abilityId: ability.id, rank: ability.ranks.at(-1).rank }),
    masteredJobIds: new Set(),
  }
  let analyzedCount = 0

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    const candidate = createRandomPartyCandidate(jobIds, abilityIds)

    console.log(`\n=== FFV run ${occurrence + 1} ===`)
    const strategy = runStrategy(candidate, occurrence + 1)
    if (strategy === undefined) {
      continue
    }

    analyzedCount += 1
    console.log(`Party: ${formatCandidate(candidate)}`)
    console.log("Strategy:")
    console.log(strategy.observations.length === 0
      ? "- No interactions identified by the current rules."
      : strategy.observations.map((observation) => {
        const kind = observation.kind === "setup" ? "Setup" : "Tradeoff"
        const members = observation.memberIds.join(", ")

        return `- ${kind} (${members}): ${observation.statement}`
      }).join("\n"))
  }

  console.log(`\nCompleted ${occurrences} random FFV candidates: ${analyzedCount} analyzed, ${occurrences - analyzedCount} invalid.`)

  // This generator chooses from four narrative character slots, resolving the shared Galuf/Krile
  // slot with a final coin flip. It deliberately knows nothing about valid loadout rules, so excess
  // slots, repeated abilities, and other illegal combinations remain expected random output and are
  // validated only at the strategy boundary below.
  function createRandomPartyCandidate(availableJobIds, availableAbilityIds) {
    const partySize = randomIndex(4) + 1
    const selectedCharacterSlots = sampleWithoutReplacement(characterSlots, partySize)

    return selectedCharacterSlots.map((characterSlot) => {
      const jobId = randomItem(availableJobIds)

      return {
        characterId: characterSlot === "galuf-or-krile"
          ? randomItem(["galuf", "krile"])
          : characterSlot,
        jobId,
        assignmentIds: Array.from(
          { length: randomIndex(finalFantasyVSlotCount(jobId) + 1) },
          () => randomItem(availableAbilityIds),
        ),
      }
    })
  }

  function runStrategy(candidate, occurrence) {
    const members = []

    // Random candidates may be invalid. Validate loadouts here because the strategy engine accepts
    // only branded legal loadouts; log invalid outcomes and return without strategy output.
    for (const candidateMember of candidate) {
      const validation = validateFinalFantasyVLoadout(
        {
          jobId: candidateMember.jobId,
          assignments: candidateMember.assignmentIds.map((abilityId) => ({ abilityId })),
        },
        learningState,
        catalog,
      )
      if (validation.kind === "invalid") {
        logInvalid(
          occurrence,
          candidate,
          validation.errors.map(({ kind }) => kind),
        )

        return undefined
      }
      members.push({ characterId: candidateMember.characterId, loadout: validation.value })
    }

    try {
      // Party-level validity (unique characters and the Galuf/Krile timeline) is asserted here.
      return engine.analyze(members)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const reason = message.startsWith("Duplicate Final Fantasy V party member")
        ? "duplicate-party-member"
        : message.startsWith("Galuf and Krile") ? "galuf-krile-overlap" : message
      logInvalid(occurrence, candidate, [reason])

      return undefined
    }
  }

  function logInvalid(occurrence, candidate, reasons) {
    const uniqueReasons = [...new Set(reasons)]
    console.log(`Skipped invalid candidate ${occurrence}: ${formatCandidate(candidate)}; ${uniqueReasons.join(", ")}`)
  }
}

function randomIndex(length) {
  return Math.floor(Math.random() * length)
}

function randomItem(values) {
  return values[randomIndex(values.length)]
}

function sampleWithoutReplacement(values, count) {
  const shuffled = [...values]

  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + randomIndex(shuffled.length - index)
    const selected = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = selected
  }

  return shuffled.slice(0, count)
}

function formatCandidate(candidate) {
  return candidate
    .map(({ characterId, jobId, assignmentIds }) =>
      `${characterId}:${jobId}[${assignmentIds.join(",")}]`)
    .join(" / ")
}
