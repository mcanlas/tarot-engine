import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { parse } from "yaml"

import {
  advanceLoadoutDraft,
  buildStrategyCatalog,
  createLoadoutDraft,
  decodeJobs,
  describeStrategyCatalog,
  enumerateLegalLoadouts,
  finalizeLoadout,
  slotCount,
  updateLoadoutDraft,
  validateLoadout,
  type LearningState,
  type LoadoutError,
} from "../../../main/ts/final-fantasy-v/index.ts"

const jobsYaml = await readFile("data/final-fantasy-v-jobs.yaml", "utf8")
const catalog = buildStrategyCatalog(decodeJobs(parse(jobsYaml)))

const state = learningState([
  { kind: "ranked", abilityId: "white-magic", rank: 3 },
  { kind: "flat", abilityId: "focus" },
  { kind: "flat", abilityId: "two-handed" },
  { kind: "flat", abilityId: "barehanded" },
  { kind: "flat", abilityId: "berserk" },
])

test("decodes the FFV catalog with explicit assignment policies", () => {
  assert.equal(
    describeStrategyCatalog(catalog),
    "22 jobs; 77 ability identities; 44 active; 33 passive; 76 assignable",
  )
  assert.equal(catalog.abilities.get("focus")?.assignment, "learned")
  assert.equal(catalog.abilities.get("kick")?.assignment, "never")
  assert.equal(catalog.abilities.get("attack")?.assignment, "mime-only")
})

test("validates representative legal and illegal assignments", () => {
  const legal = validateLoadout(
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

  const ranked = validateLoadout(
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

  assert.deepEqual(errorKinds(validateLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "white-magic" }] },
    state,
    catalog,
  )), ["overlaps-innate"])

  assert.deepEqual(errorKinds(validateLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "kick" }] },
    state,
    catalog,
  )), ["ability-not-assignable"])

  assert.deepEqual(errorKinds(validateLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "rapid-fire" }] },
    state,
    catalog,
  )), ["ability-not-learned"])

  assert.deepEqual(errorKinds(validateLoadout(
    { jobId: "white-mage", assignments: [{ abilityId: "attack" }] },
    state,
    catalog,
  )), ["wrong-job"])

  assert.deepEqual(errorKinds(validateLoadout(
    {
      jobId: "white-mage",
      assignments: [{ abilityId: "focus" }, { abilityId: "focus" }],
    },
    state,
    catalog,
  )), ["too-many-assignments", "duplicate-assignment"])

  assert.deepEqual(errorKinds(validateLoadout(
    { jobId: "missing", assignments: [{ abilityId: "missing" }] },
    state,
    catalog,
  )), ["unknown-job", "unknown-ability"])
})

test("inherits passive innates for Freelancer and Mime but excludes Berserk", () => {
  const mastered = learningState(state.learnedAbilities, ["monk", "berserker"])
  const inherited = validateLoadout(
    { jobId: "freelancer", assignments: [{ abilityId: "barehanded" }] },
    mastered,
    catalog,
  )
  assert.deepEqual(errorKinds(inherited), ["overlaps-innate"])

  const berserk = validateLoadout(
    { jobId: "freelancer", assignments: [{ abilityId: "berserk" }] },
    mastered,
    catalog,
  )
  assert.equal(berserk.kind, "valid")

  const mime = validateLoadout(
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

  assert.deepEqual(errorKinds(validateLoadout(
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
  const created = createLoadoutDraft("freelancer", catalog)
  assert.equal(created.kind, "valid")
  if (created.kind === "invalid") {
    return
  }

  assert.equal(slotCount("freelancer"), 2)
  assert.equal(slotCount("mime"), 3)
  assert.equal(slotCount("knight"), 1)
  assert.deepEqual(errorKinds(finalizeLoadout(created.value, state, catalog)), [
    "undecided-slot",
    "undecided-slot",
  ])

  const first = advanceLoadoutDraft(
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

  const completed = advanceLoadoutDraft(
    first.value.draft,
    1,
    { kind: "empty" },
    state,
    catalog,
  )
  assert.equal(completed.kind, "valid")
  assert.equal(completed.kind === "valid" ? completed.value.kind : undefined, "complete")

  assert.deepEqual(errorKinds(updateLoadoutDraft(
    created.value,
    2,
    { kind: "empty" },
    state,
    catalog,
  )), ["invalid-slot-index"])

  const whiteMage = createLoadoutDraft("white-mage", catalog)
  assert.equal(whiteMage.kind, "valid")
  if (whiteMage.kind === "valid") {
    assert.deepEqual(errorKinds(updateLoadoutDraft(
      whiteMage.value,
      0,
      { kind: "assigned", ability: { abilityId: "white-magic" } },
      state,
      catalog,
    )), ["overlaps-innate"])
    assert.deepEqual(errorKinds(advanceLoadoutDraft(
      whiteMage.value,
      -1,
      { kind: "empty" },
      state,
      catalog,
    )), ["invalid-slot-index"])
  }

  assert.deepEqual(errorKinds(createLoadoutDraft("missing", catalog)), [
    "unknown-job",
  ])
})

test("enumerates only legal unordered loadouts, including intentionally empty slots", () => {
  assert.deepEqual(errorKinds(enumerateLegalLoadouts(
    "missing",
    state,
    catalog,
  )), ["unknown-job"])

  const whiteMage = enumerateLegalLoadouts("white-mage", state, catalog)
  assert.equal(whiteMage.kind, "valid")
  if (whiteMage.kind === "valid") {
    assert.deepEqual(
      whiteMage.value.map((loadout) => loadout.assignments.map(({ abilityId }) => abilityId)),
      [[], ["two-handed"], ["focus"], ["barehanded"], ["berserk"]],
    )
  }

  const mimeState = learningState([{ kind: "flat", abilityId: "focus" }])
  const mime = enumerateLegalLoadouts("mime", mimeState, catalog)
  assert.equal(mime.kind, "valid")
  assert.equal(mime.kind === "valid" ? mime.value.length : 0, 8)
})

function learningState(
  learnedAbilities: LearningState["learnedAbilities"],
  masteredJobIds: readonly string[] = [],
): LearningState {
  return { learnedAbilities, masteredJobIds: new Set(masteredJobIds) }
}

function errorKinds(
  validation: { readonly kind: "valid" } | {
    readonly kind: "invalid"
    readonly errors: readonly LoadoutError[]
  },
): LoadoutError["kind"][] {
  return validation.kind === "valid" ? [] : validation.errors.map(({ kind }) => kind)
}
