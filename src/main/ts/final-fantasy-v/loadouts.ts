import type {
  FinalFantasyVAbility,
  FinalFantasyVJob,
  FinalFantasyVStrategyCatalog,
} from "./catalog.ts"

export type FinalFantasyVLearnedAbility =
  | { readonly kind: "flat"; readonly abilityId: string }
  | { readonly kind: "ranked"; readonly abilityId: string; readonly rank: number }

export interface FinalFantasyVLearningState {
  readonly learnedAbilities: readonly FinalFantasyVLearnedAbility[]
  readonly masteredJobIds: ReadonlySet<string>
}

export interface FinalFantasyVAbilityAssignment {
  readonly abilityId: string
}

export type FinalFantasyVResolvedAbility =
  | { readonly kind: "flat"; readonly abilityId: string }
  | { readonly kind: "ranked"; readonly abilityId: string; readonly rank: number }

export interface FinalFantasyVLoadoutInput {
  readonly jobId: string
  readonly assignments: readonly FinalFantasyVAbilityAssignment[]
}

export type FinalFantasyVDraftSlot =
  | { readonly kind: "undecided" }
  | { readonly kind: "empty" }
  | { readonly kind: "assigned"; readonly ability: FinalFantasyVAbilityAssignment }

const loadoutDraftBrand: unique symbol = Symbol("FinalFantasyVLoadoutDraft")

export type FinalFantasyVLoadoutDraft = Readonly<{
  jobId: string
  slots: readonly FinalFantasyVDraftSlot[]
  [loadoutDraftBrand]: true
}>

const legalLoadoutBrand: unique symbol = Symbol("FinalFantasyVLegalLoadout")

export type FinalFantasyVLegalLoadout = Readonly<{
  jobId: string
  assignments: readonly FinalFantasyVResolvedAbility[]
  innateAbilities: readonly FinalFantasyVResolvedAbility[]
  [legalLoadoutBrand]: true
}>

export type FinalFantasyVLoadoutError =
  | { readonly kind: "unknown-job"; readonly jobId: string }
  | { readonly kind: "unknown-ability"; readonly abilityId: string }
  | { readonly kind: "unknown-learned-ability"; readonly abilityId: string }
  | { readonly kind: "unknown-mastered-job"; readonly jobId: string }
  | { readonly kind: "duplicate-learned-ability"; readonly abilityId: string }
  | {
      readonly kind: "learned-ability-kind-mismatch"
      readonly abilityId: string
      readonly expected: "flat" | "ranked"
    }
  | {
      readonly kind: "invalid-learned-rank"
      readonly abilityId: string
      readonly rank: number
    }
  | { readonly kind: "too-many-assignments"; readonly maximum: number }
  | { readonly kind: "ability-not-learned"; readonly abilityId: string }
  | { readonly kind: "ability-not-assignable"; readonly abilityId: string }
  | {
      readonly kind: "wrong-job"
      readonly abilityId: string
      readonly requiredJobId: "mime"
    }
  | { readonly kind: "duplicate-assignment"; readonly abilityId: string }
  | { readonly kind: "overlaps-innate"; readonly abilityId: string }
  | { readonly kind: "invalid-slot-index"; readonly slotIndex: number }
  | { readonly kind: "undecided-slot"; readonly slotIndex: number }

export type FinalFantasyVValidation<T> =
  | { readonly kind: "valid"; readonly value: T }
  | {
      readonly kind: "invalid"
      readonly errors: readonly [FinalFantasyVLoadoutError, ...FinalFantasyVLoadoutError[]]
    }

export type FinalFantasyVLoadoutProgress =
  | { readonly kind: "partial"; readonly draft: FinalFantasyVLoadoutDraft }
  | { readonly kind: "complete"; readonly loadout: FinalFantasyVLegalLoadout }

export function finalFantasyVSlotCount(jobId: string): number {
  if (jobId === "freelancer") {
    return 2
  }
  if (jobId === "mime") {
    return 3
  }
  return 1
}

export function validateFinalFantasyVLoadout(
  input: FinalFantasyVLoadoutInput,
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVValidation<FinalFantasyVLegalLoadout> {
  const errors = validateLearningState(state, catalog)
  const job = catalog.jobs.get(input.jobId)

  if (job === undefined) {
    errors.push({ kind: "unknown-job", jobId: input.jobId })
  } else if (input.assignments.length > finalFantasyVSlotCount(job.id)) {
    errors.push({ kind: "too-many-assignments", maximum: finalFantasyVSlotCount(job.id) })
  }

  const innateAbilities = job === undefined
    ? []
    : effectiveInnateAbilities(job, state, catalog)
  const innateAbilityIds = new Set(innateAbilities.map((ability) => ability.abilityId))
  const learnedAbilities = new Map(
    state.learnedAbilities.map((ability) => [ability.abilityId, ability]),
  )
  const seenAssignments = new Set<string>()
  const resolvedAssignments: FinalFantasyVResolvedAbility[] = []

  for (const assignment of input.assignments) {
    const ability = catalog.abilities.get(assignment.abilityId)

    if (ability === undefined) {
      errors.push({ kind: "unknown-ability", abilityId: assignment.abilityId })
      continue
    }

    if (seenAssignments.has(ability.id)) {
      errors.push({ kind: "duplicate-assignment", abilityId: ability.id })
    }
    seenAssignments.add(ability.id)

    const learned = learnedAbilities.get(ability.id)
    if (ability.assignment === "never") {
      errors.push({ kind: "ability-not-assignable", abilityId: ability.id })
    } else if (ability.assignment === "mime-only" && job?.id !== "mime") {
      errors.push({ kind: "wrong-job", abilityId: ability.id, requiredJobId: "mime" })
    } else if (ability.assignment === "learned" && learned === undefined) {
      errors.push({ kind: "ability-not-learned", abilityId: ability.id })
    } else {
      const resolved = resolveAssignedAbility(ability, learned)
      if (resolved !== undefined) {
        resolvedAssignments.push(resolved)
      }
    }

    if (innateAbilityIds.has(ability.id)) {
      errors.push({ kind: "overlaps-innate", abilityId: ability.id })
    }
  }

  if (errors.length > 0) {
    return invalid(errors)
  }

  return {
    kind: "valid",
    value: {
      jobId: input.jobId,
      assignments: resolvedAssignments,
      innateAbilities,
      [legalLoadoutBrand]: true,
    },
  }
}

export function createFinalFantasyVLoadoutDraft(
  jobId: string,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVValidation<FinalFantasyVLoadoutDraft> {
  if (!catalog.jobs.has(jobId)) {
    return invalid([{ kind: "unknown-job", jobId }])
  }

  return {
    kind: "valid",
    value: {
      jobId,
      slots: Array.from(
        { length: finalFantasyVSlotCount(jobId) },
        (): FinalFantasyVDraftSlot => ({ kind: "undecided" }),
      ),
      [loadoutDraftBrand]: true,
    },
  }
}

export function updateFinalFantasyVLoadoutDraft(
  draft: FinalFantasyVLoadoutDraft,
  slotIndex: number,
  slot: FinalFantasyVDraftSlot,
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVValidation<FinalFantasyVLoadoutDraft> {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= draft.slots.length) {
    return invalid([{ kind: "invalid-slot-index", slotIndex }])
  }

  const slots = draft.slots.map((existing, index) => index === slotIndex ? slot : existing)
  const assignments = assignedAbilities(slots)
  const validation = validateFinalFantasyVLoadout(
    { jobId: draft.jobId, assignments },
    state,
    catalog,
  )

  if (validation.kind === "invalid") {
    return validation
  }

  return {
    kind: "valid",
    value: { jobId: draft.jobId, slots, [loadoutDraftBrand]: true },
  }
}

export function finalizeFinalFantasyVLoadout(
  draft: FinalFantasyVLoadoutDraft,
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVValidation<FinalFantasyVLegalLoadout> {
  const undecided = draft.slots
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .filter(({ slot }) => slot.kind === "undecided")
    .map(({ slotIndex }): FinalFantasyVLoadoutError => ({ kind: "undecided-slot", slotIndex }))

  if (undecided.length > 0) {
    return invalid(undecided)
  }

  return validateFinalFantasyVLoadout(
    { jobId: draft.jobId, assignments: assignedAbilities(draft.slots) },
    state,
    catalog,
  )
}

export function advanceFinalFantasyVLoadoutDraft(
  draft: FinalFantasyVLoadoutDraft,
  slotIndex: number,
  slot: Exclude<FinalFantasyVDraftSlot, { readonly kind: "undecided" }>,
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVValidation<FinalFantasyVLoadoutProgress> {
  const updated = updateFinalFantasyVLoadoutDraft(draft, slotIndex, slot, state, catalog)
  if (updated.kind === "invalid") {
    return updated
  }

  if (updated.value.slots.some((candidate) => candidate.kind === "undecided")) {
    return { kind: "valid", value: { kind: "partial", draft: updated.value } }
  }

  const finalized = finalizeFinalFantasyVLoadout(updated.value, state, catalog)
  return finalized.kind === "invalid"
    ? finalized
    : { kind: "valid", value: { kind: "complete", loadout: finalized.value } }
}

export function enumerateFinalFantasyVLegalLoadouts(
  jobId: string,
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVValidation<readonly FinalFantasyVLegalLoadout[]> {
  const empty = validateFinalFantasyVLoadout({ jobId, assignments: [] }, state, catalog)
  if (empty.kind === "invalid") {
    return empty
  }

  const candidates = [...catalog.abilities.values()]
    .filter((ability) => canAssign(
      ability,
      jobId,
      state,
      new Set(empty.value.innateAbilities.map((innate) => innate.abilityId)),
    ))
    .map((ability) => ({ abilityId: ability.id }))
  const inputs = assignmentCombinations(candidates, finalFantasyVSlotCount(jobId))
  const loadouts: FinalFantasyVLegalLoadout[] = []

  for (const assignments of inputs) {
    const validation = validateFinalFantasyVLoadout({ jobId, assignments }, state, catalog)
    if (validation.kind === "invalid") {
      return validation
    }
    loadouts.push(validation.value)
  }

  return { kind: "valid", value: loadouts }
}

function validateLearningState(
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVLoadoutError[] {
  const errors: FinalFantasyVLoadoutError[] = []
  const seen = new Set<string>()

  for (const learned of state.learnedAbilities) {
    const ability = catalog.abilities.get(learned.abilityId)
    if (ability === undefined) {
      errors.push({ kind: "unknown-learned-ability", abilityId: learned.abilityId })
      continue
    }
    if (seen.has(learned.abilityId)) {
      errors.push({ kind: "duplicate-learned-ability", abilityId: learned.abilityId })
    }
    seen.add(learned.abilityId)

    if (ability.kind !== learned.kind) {
      errors.push({
        kind: "learned-ability-kind-mismatch",
        abilityId: learned.abilityId,
        expected: ability.kind,
      })
    } else if (learned.kind === "ranked" && ability.kind === "ranked"
      && !ability.ranks.some((rank) => rank.rank === learned.rank)) {
      errors.push({
        kind: "invalid-learned-rank",
        abilityId: learned.abilityId,
        rank: learned.rank,
      })
    }
  }

  for (const jobId of state.masteredJobIds) {
    if (!catalog.jobs.has(jobId)) {
      errors.push({ kind: "unknown-mastered-job", jobId })
    }
  }

  return errors
}

function effectiveInnateAbilities(
  job: FinalFantasyVJob,
  state: FinalFantasyVLearningState,
  catalog: FinalFantasyVStrategyCatalog,
): FinalFantasyVResolvedAbility[] {
  const innateAbilities = new Map(
    [...job.innates].map((ability) => [ability.id, resolveInnateAbility(ability)]),
  )

  if (job.id !== "freelancer" && job.id !== "mime") {
    return [...innateAbilities.values()]
  }

  for (const masteredJobId of state.masteredJobIds) {
    const masteredJob = catalog.jobs.get(masteredJobId)
    if (masteredJob === undefined) {
      continue
    }
    for (const ability of masteredJob.innates) {
      if (ability.type === "passive" && ability.id !== "berserk") {
        innateAbilities.set(ability.id, resolveInnateAbility(ability))
      }
    }
  }

  return [...innateAbilities.values()]
}

function resolveAssignedAbility(
  ability: FinalFantasyVAbility,
  learned: FinalFantasyVLearnedAbility | undefined,
): FinalFantasyVResolvedAbility | undefined {
  if (ability.kind === "flat") {
    return { kind: "flat", abilityId: ability.id }
  }
  if (learned?.kind === "ranked") {
    return { kind: "ranked", abilityId: ability.id, rank: learned.rank }
  }
  return undefined
}

function resolveInnateAbility(ability: FinalFantasyVAbility): FinalFantasyVResolvedAbility {
  return ability.kind === "flat"
    ? { kind: "flat", abilityId: ability.id }
    : { kind: "ranked", abilityId: ability.id, rank: ability.innateRank }
}

function canAssign(
  ability: FinalFantasyVAbility,
  jobId: string,
  state: FinalFantasyVLearningState,
  innateAbilityIds: ReadonlySet<string>,
): boolean {
  if (innateAbilityIds.has(ability.id) || ability.assignment === "never") {
    return false
  }
  if (ability.assignment === "mime-only") {
    return jobId === "mime"
  }
  return state.learnedAbilities.some((learned) => learned.abilityId === ability.id)
}

function assignedAbilities(
  slots: readonly FinalFantasyVDraftSlot[],
): FinalFantasyVAbilityAssignment[] {
  return slots.flatMap((slot) => slot.kind === "assigned" ? [slot.ability] : [])
}

function assignmentCombinations(
  candidates: readonly FinalFantasyVAbilityAssignment[],
  maximum: number,
): FinalFantasyVAbilityAssignment[][] {
  const combinations: FinalFantasyVAbilityAssignment[][] = []

  function visit(start: number, chosen: FinalFantasyVAbilityAssignment[]): void {
    combinations.push([...chosen])
    if (chosen.length === maximum) {
      return
    }
    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index]!
      chosen.push(candidate)
      visit(index + 1, chosen)
      chosen.pop()
    }
  }

  visit(0, [])
  return combinations
}

function invalid<T>(
  errors: readonly FinalFantasyVLoadoutError[],
): FinalFantasyVValidation<T> {
  if (errors.length === 0) {
    throw new Error("Invalid validation requires at least one error")
  }
  return {
    kind: "invalid",
    errors: errors as readonly [FinalFantasyVLoadoutError, ...FinalFantasyVLoadoutError[]],
  }
}
