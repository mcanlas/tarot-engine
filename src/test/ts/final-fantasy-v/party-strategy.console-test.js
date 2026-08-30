import { readFile } from "node:fs/promises"

import { parse } from "yaml"

import {
  buildFinalFantasyVBossCatalog,
  buildFinalFantasyVStrategyCatalog,
  createRandomFinalFantasyVParty,
  createRandomFinalFantasyVStoryParty,
  decodeFinalFantasyVBosses,
  decodeFinalFantasyVBossStrategy,
  decodeFinalFantasyVJobs,
  decodeFinalFantasyVPartyStrategy,
  FinalFantasyVBossStrategyEngine,
  FinalFantasyVPartyStrategyEngine,
  finalFantasyVStoryAvailability,
  finalFantasyVStrategyYamlFiles,
  validateFinalFantasyVLoadout,
} from "../../../main/ts/final-fantasy-v/index.ts"

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
  const partyEngine = new FinalFantasyVPartyStrategyEngine(
    catalog,
    decodeFinalFantasyVPartyStrategy(parse(strategyYaml)),
  )
  const bossesYaml = await readFile(finalFantasyVStrategyYamlFiles.bosses, "utf8")
  const bossCatalog = buildFinalFantasyVBossCatalog(decodeFinalFantasyVBosses(parse(bossesYaml)))
  const bossStrategyYaml = await readFile(finalFantasyVStrategyYamlFiles.bossStrategy, "utf8")
  const bossEngine = new FinalFantasyVBossStrategyEngine(
    catalog,
    bossCatalog,
    decodeFinalFantasyVBossStrategy(parse(bossStrategyYaml)),
  )
  const allAbilityIds = [...catalog.abilities.keys()]
  const allLearningState = learningStateFor(allAbilityIds)
  let randomPartyAnalyzed = 0
  let randomStoryPartyAnalyzed = 0

  for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
    console.log(`\n=== FFV run ${occurrence + 1} ===`)

    console.log("\nRandom party")
    const randomParty = createRandomFinalFantasyVParty(catalog)
    const randomPartyResult = runStrategy(
      "Random party",
      randomParty.members,
      allLearningState,
      occurrence + 1,
    )
    if (randomPartyResult !== undefined) {
      randomPartyAnalyzed += 1
      printResult(randomParty.members, randomPartyResult)
    }

    console.log("\nRandom story party")
    const randomStoryParty = createRandomFinalFantasyVStoryParty(catalog, bossCatalog)
    const availability = finalFantasyVStoryAvailability(catalog, randomStoryParty.boss)
    const storyLearningState = learningStateFor(availability.abilityIds)
    const randomStoryPartyResult = runStrategy(
      "Random story party",
      randomStoryParty.members,
      storyLearningState,
      occurrence + 1,
      randomStoryParty.boss,
    )
    if (randomStoryPartyResult !== undefined) {
      randomStoryPartyAnalyzed += 1
      printResult(
        randomStoryParty.members,
        randomStoryPartyResult,
        randomStoryParty.boss,
      )
    }
  }

  console.log([
    `\nCompleted ${occurrences} FFV runs with 2 parts each.`,
    `Random party: ${randomPartyAnalyzed} analyzed, ${occurrences - randomPartyAnalyzed} invalid.`,
    `Random story party: ${randomStoryPartyAnalyzed} analyzed, ${occurrences - randomStoryPartyAnalyzed} invalid.`,
  ].join("\n"))

  function learningStateFor(abilityIds) {
    return {
      learnedAbilities: abilityIds.map((abilityId) => {
        const ability = catalog.abilities.get(abilityId)
        if (ability === undefined) {
          throw new Error(`Unknown generated Final Fantasy V ability: ${abilityId}`)
        }

        return ability.kind === "flat"
          ? { kind: "flat", abilityId: ability.id }
          : { kind: "ranked", abilityId: ability.id, rank: ability.ranks.at(-1).rank }
      }),
      masteredJobIds: new Set(),
    }
  }

  function runStrategy(label, candidate, learningState, occurrence, boss) {
    const members = []

    // Both random generators deliberately allow nonsensical ability assignments. Validate those
    // candidates here so the legal-loadout boundary remains part of the stress test.
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
          label,
          occurrence,
          candidate,
          validation.errors.map(({ kind }) => kind),
        )

        return undefined
      }
      members.push({ characterId: candidateMember.characterId, loadout: validation.value })
    }

    try {
      return {
        partyStrategy: partyEngine.analyze(members),
        bossStrategy: boss !== undefined && bossEngine.hasProfile(boss.key)
          ? bossEngine.evaluate(boss.key, members)
          : undefined,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const reason = message.startsWith("Duplicate Final Fantasy V party member")
        ? "duplicate-party-member"
        : message.startsWith("Galuf and Krile") ? "galuf-krile-overlap" : message
      logInvalid(label, occurrence, candidate, [reason])

      return undefined
    }
  }

  function printResult(candidate, result, boss) {
    if (boss !== undefined) {
      console.log(`Boss: ${boss.name} (${boss.jobsUnlocked})`)
    }
    console.log(`Party: ${formatCandidate(candidate)}`)
    console.log("Party strategy:")
    console.log(result.partyStrategy.observations.length === 0
      ? "- No interactions identified by the current rules."
      : result.partyStrategy.observations.map((observation) => {
        const kind = observation.kind === "setup" ? "Setup" : "Tradeoff"
        const members = observation.memberIds.join(", ")

        return `- ${kind} (${members}): ${observation.statement}`
      }).join("\n"))

    if (boss !== undefined && result.bossStrategy === undefined) {
      console.log("Boss strategy: No encoded profile for this encounter.")
    } else if (result.bossStrategy !== undefined) {
      const score = result.bossStrategy.score
      console.log(`Boss score: tempo ${score.tempo}, safety ${score.safety}, reliability ${score.reliability}`)
      console.log(result.bossStrategy.matchedRules.length === 0
        ? "- No boss rules matched."
        : result.bossStrategy.matchedRules.map((rule) => `- ${rule.statement}`).join("\n"))
    }
  }

  function logInvalid(label, occurrence, candidate, reasons) {
    const uniqueReasons = [...new Set(reasons)]
    console.log(`Skipped invalid ${label} ${occurrence}: ${formatCandidate(candidate)}; ${uniqueReasons.join(", ")}`)
  }
}

function formatCandidate(candidate) {
  return candidate
    .map(({ characterId, jobId, assignmentIds }) =>
      `${characterId}:${jobId}[${assignmentIds.join(",")}]`)
    .join(" / ")
}
