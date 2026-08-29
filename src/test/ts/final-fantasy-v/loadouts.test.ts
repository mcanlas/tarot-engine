import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { parse } from "yaml"

import {
  advanceFinalFantasyVLoadoutDraft,
  buildFinalFantasyVStrategyCatalog,
  createFinalFantasyVLoadoutDraft,
  decodeFinalFantasyVJobs,
  describeFinalFantasyVStrategyCatalog,
  enumerateFinalFantasyVLegalLoadouts,
  finalizeFinalFantasyVLoadout,
  finalFantasyVSlotCount,
  updateFinalFantasyVLoadoutDraft,
  validateFinalFantasyVLoadout,
  type FinalFantasyVLearningState,
  type FinalFantasyVLoadoutError,
} from "../../../main/ts/final-fantasy-v/index.ts"

const jobsYaml = await readFile("data/final-fantasy-v-jobs.yaml", "utf8")
const catalog = buildFinalFantasyVStrategyCatalog(decodeFinalFantasyVJobs(parse(jobsYaml)))

const state = learningState([
  { kind: "ranked", abilityId: "white-magic", rank: 3 },
  { kind: "flat", abilityId: "focus" },
  { kind: "flat", abilityId: "two-handed" },
  { kind: "flat", abilityId: "barehanded" },
  { kind: "flat", abilityId: "berserk" },
])

test("decodes the FFV catalog with explicit assignment policies", () => {
  assert.equal(
    describeFinalFantasyVStrategyCatalog(catalog),
    "22 jobs; 77 ability identities; 44 active; 33 passive; 76 assignable",
  )
  assert.equal(catalog.abilities.get("focus")?.assignment, "learned")
  assert.equal(catalog.abilities.get("kick")?.assignment, "never")
  assert.equal(catalog.abilities.get("attack")?.assignment, "mime-only")
})

test("validates representative legal and illegal assignments", () => {
  const legal = validateFinalFantasyVLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "focus" }] },
    state,
    catalog,
  )
  assert.equal(legal.kind, "valid")
  if (legal.kind === "valid") {
    assert.deepEqual(legal.value.assignments, [{ kind: "flat", abilityId: "focus" }])
    assert.deepEqual(
      legal.value.innateAbilities.find(({ abilityId }) => abilityId === "white-magic"),
      { kind: "ranked", abilityId: "white-magic", rank: 6 },
    )
  }

  const ranked = validateFinalFantasyVLoadout(
    { jobId: "black-mage", assignments: [{ abilityId: "white-magic" }] },
    state,
    catalog,
  )
  assert.equal(ranked.kind, "valid")
  if (ranked.kind === "valid") {
    assert.deepEqual(ranked.value.assignments, [
      { kind: "ranked", abilityId: "white-magic", rank: 3 },
    ])
  }

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "white-magic" }] },
    state,
    catalog,
  )), ["overlaps-innate"])

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "kick" }] },
    state,
    catalog,
  )), ["ability-not-assignable"])

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "rapid-fire" }] },
    state,
    catalog,
  )), ["ability-not-learned"])

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "attack" }] },
    state,
    catalog,
  )), ["wrong-job"])

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    {
      jobId: "white-mage",
      assignments: [{ abilityId: "focus" }, { abilityId: "focus" }],
    },
    state,
    catalog,
  )), ["too-many-assignments", "duplicate-assignment"])

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    { jobId: "missing", assignments: [{ abilityId: "missing" }] },
    state,
    catalog,
  )), ["unknown-job", "unknown-ability"])
})

test("inherits passive innates for Freelancer and Mime but excludes Berserk", () => {
  const mastered = learningState(state.learnedAbilities, ["monk", "berserker"])
  const inherited = validateFinalFantasyVLoadout(
    { jobId: "freelancer", assignments: [{ abilityId: "barehanded" }] },
    mastered,
    catalog,
  )
  assert.deepEqual(errorKinds(inherited), ["overlaps-innate"])

  const berserk = validateFinalFantasyVLoadout(
    { jobId: "freelancer", assignments: [{ abilityId: "berserk" }] },
    mastered,
    catalog,
  )
  assert.equal(berserk.kind, "valid")

  const mime = validateFinalFantasyVLoadout(
    {
      jobId: "mime",
      assignments: [{ abilityId: "attack" }, { abilityId: "items" }],
    },
    mastered,
    catalog,
  )
  assert.equal(mime.kind, "valid")
})

test("reports malformed learning state as data", () => {
  const malformed = learningState([
    { kind: "flat", abilityId: "missing" },
    { kind: "flat", abilityId: "white-magic" },
    { kind: "ranked", abilityId: "white-magic", rank: 99 },
  ], ["missing"])

  assert.deepEqual(errorKinds(validateFinalFantasyVLoadout(
    { jobId: "knight", assignments: [] },
    malformed,
    catalog,
  )), [
    "unknown-learned-ability",
    "learned-ability-kind-mismatch",
    "duplicate-learned-ability",
    "invalid-learned-rank",
    "unknown-mastered-job",
  ])
})

test("keeps partial drafts valid while rejecting contradictions immediately", () => {
  const created = createFinalFantasyVLoadoutDraft("freelancer", catalog)
  assert.equal(created.kind, "valid")
  if (created.kind === "invalid") {
    return
  }

  assert.equal(finalFantasyVSlotCount("freelancer"), 2)
  assert.equal(finalFantasyVSlotCount("mime"), 3)
  assert.equal(finalFantasyVSlotCount("knight"), 1)
  assert.deepEqual(errorKinds(finalizeFinalFantasyVLoadout(created.value, state, catalog)), [
    "undecided-slot",
    "undecided-slot",
  ])

  const first = advanceFinalFantasyVLoadoutDraft(
    created.value,
    0,
    { kind: "assigned", ability: { abilityId: "focus" } },
    state,
    catalog,
  )
  assert.equal(first.kind, "valid")
  assert.equal(first.kind === "valid" ? first.value.kind : undefined, "partial")
  if (first.kind !== "valid" || first.value.kind !== "partial") {
    return
  }

  const completed = advanceFinalFantasyVLoadoutDraft(
    first.value.draft,
    1,
    { kind: "empty" },
    state,
    catalog,
  )
  assert.equal(completed.kind, "valid")
  assert.equal(completed.kind === "valid" ? completed.value.kind : undefined, "complete")

  assert.deepEqual(errorKinds(updateFinalFantasyVLoadoutDraft(
    created.value,
    2,
    { kind: "empty" },
    state,
    catalog,
  )), ["invalid-slot-index"])

  const whiteMage = createFinalFantasyVLoadoutDraft("white-mage", catalog)
  assert.equal(whiteMage.kind, "valid")
  if (whiteMage.kind === "valid") {
    assert.deepEqual(errorKinds(updateFinalFantasyVLoadoutDraft(
      whiteMage.value,
      0,
      { kind: "assigned", ability: { abilityId: "white-magic" } },
      state,
      catalog,
    )), ["overlaps-innate"])
    assert.deepEqual(errorKinds(advanceFinalFantasyVLoadoutDraft(
      whiteMage.value,
      -1,
      { kind: "empty" },
      state,
      catalog,
    )), ["invalid-slot-index"])
  }

  assert.deepEqual(errorKinds(createFinalFantasyVLoadoutDraft("missing", catalog)), [
    "unknown-job",
  ])
})

test("enumerates only legal unordered loadouts, including intentionally empty slots", () => {
  assert.deepEqual(errorKinds(enumerateFinalFantasyVLegalLoadouts(
    "missing",
    state,
    catalog,
  )), ["unknown-job"])

  const whiteMage = enumerateFinalFantasyVLegalLoadouts("white-mage", state, catalog)
  assert.equal(whiteMage.kind, "valid")
  if (whiteMage.kind === "valid") {
    assert.deepEqual(
      whiteMage.value.map((loadout) => loadout.assignments.map(({ abilityId }) => abilityId)),
      [[], ["two-handed"], ["focus"], ["barehanded"], ["berserk"]],
    )
  }

  const mimeState = learningState([{ kind: "flat", abilityId: "focus" }])
  const mime = enumerateFinalFantasyVLegalLoadouts("mime", mimeState, catalog)
  assert.equal(mime.kind, "valid")
  assert.equal(mime.kind === "valid" ? mime.value.length : 0, 8)
})

function learningState(
  learnedAbilities: FinalFantasyVLearningState["learnedAbilities"],
  masteredJobIds: readonly string[] = [],
): FinalFantasyVLearningState {
  return { learnedAbilities, masteredJobIds: new Set(masteredJobIds) }
}

function errorKinds(
  validation: { readonly kind: "valid" } | {
    readonly kind: "invalid"
    readonly errors: readonly FinalFantasyVLoadoutError[]
  },
): FinalFantasyVLoadoutError["kind"][] {
  return validation.kind === "valid" ? [] : validation.errors.map(({ kind }) => kind)
}
