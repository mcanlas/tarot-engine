import type { FinalFantasyVAbilityType } from "./catalog.ts"
import type {
  FinalFantasyVMemberSelectorDefinition,
  FinalFantasyVPartyObservationKind,
  FinalFantasyVPartyStrategyConditionDefinition,
  FinalFantasyVPartyStrategyRuleDefinition,
} from "./party-strategy.ts"

export function decodeFinalFantasyVPartyStrategy(
  value: unknown,
): FinalFantasyVPartyStrategyRuleDefinition[] {
  const document = requireRecord(value, "Final Fantasy V party strategy")

  return requireArray(document.rules, "Final Fantasy V party strategy.rules")
    .map(decodeRule)
}

function decodeRule(value: unknown, index: number): FinalFantasyVPartyStrategyRuleDefinition {
  const path = `Final Fantasy V party strategy.rules[${index}]`
  const record = requireRecord(value, path)

  return {
    id: requireString(record.id, `${path}.id`),
    kind: requireKind(record.kind, `${path}.kind`),
    when: decodeCondition(record.when, `${path}.when`),
    statement: requireString(record.statement, `${path}.statement`),
  }
}

function decodeCondition(
  value: unknown,
  path: string,
): FinalFantasyVPartyStrategyConditionDefinition {
  const record = requireRecord(value, path)
  const operations = ["sameMember", "distinctMembers"]
    .filter((operation) => record[operation] !== undefined)
  if (operations.length !== 1) {
    throw new Error(`${path} must have exactly one operation`)
  }
  const operation = operations[0]!
  const selectors = requireArray(record[operation], `${path}.${operation}`)
    .map((selector, index) => decodeSelector(selector, `${path}.${operation}[${index}]`))

  return operation === "sameMember" ? { sameMember: selectors } : { distinctMembers: selectors }
}

function decodeSelector(value: unknown, path: string): FinalFantasyVMemberSelectorDefinition {
  const record = requireRecord(value, path)
  const operations = ["job", "assignment", "assignmentOneOf", "innate", "assignmentType"]
    .filter((operation) => record[operation] !== undefined)
  if (operations.length !== 1) {
    throw new Error(`${path} must have exactly one selector`)
  }
  const operation = operations[0]!
  if (operation === "job") {
    rejectRank(record, path)

    return { job: requireString(record.job, `${path}.job`) }
  }
  if (operation === "assignmentType") {
    rejectRank(record, path)

    return { assignmentType: requireAbilityType(record.assignmentType, `${path}.assignmentType`) }
  }
  if (operation === "assignmentOneOf") {
    rejectRank(record, path)

    return {
      assignmentOneOf: requireArray(record.assignmentOneOf, `${path}.assignmentOneOf`)
        .map((ability, index) => requireString(
          ability,
          `${path}.assignmentOneOf[${index}]`,
        )),
    }
  }
  const atLeastRank = record.atLeastRank === undefined
    ? {}
    : { atLeastRank: requireNumber(record.atLeastRank, `${path}.atLeastRank`) }

  return operation === "assignment"
    ? { assignment: requireString(record.assignment, `${path}.assignment`), ...atLeastRank }
    : { innate: requireString(record.innate, `${path}.innate`), ...atLeastRank }
}

function rejectRank(record: Record<string, unknown>, path: string): void {
  if (record.atLeastRank !== undefined) {
    throw new Error(`${path}.atLeastRank requires an assignment or innate selector`)
  }
}

function requireAbilityType(value: unknown, path: string): FinalFantasyVAbilityType {
  const type = requireString(value, path)
  if (type !== "active" && type !== "passive") {
    throw new Error(`${path} must be active or passive`)
  }

  return type
}

function requireKind(value: unknown, path: string): FinalFantasyVPartyObservationKind {
  const kind = requireString(value, path)
  if (kind !== "setup" && kind !== "tradeoff") {
    throw new Error(`${path} must be setup or tradeoff`)
  }

  return kind
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`)
  }

  return value as Record<string, unknown>
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`)
  }

  return value
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`)
  }

  return value
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`)
  }

  return value
}
