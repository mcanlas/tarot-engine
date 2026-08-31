import type {
  NextAction,
  PartyState,
} from "./next-action-provider.ts"
import type { TownDefinition } from "./towns.ts"

export interface ActionProvider {
  availableActions(party: PartyState, town: TownDefinition): readonly NextAction[]
}

export interface ScoreComponent {
  readonly key: string
  readonly value: number
  readonly reason: string
}

export interface PartyScore {
  readonly total: number
  readonly components: readonly ScoreComponent[]
}

export type PartyEvaluator = (party: PartyState) => PartyScore

export interface TakeActionRecommendation {
  readonly kind: "take-action"
  readonly action: NextAction
  readonly scoreDelta: number
  readonly components: readonly ScoreComponent[]
}

export interface StopRecommendation {
  readonly kind: "stop"
  readonly reason: "no-legal-action" | "no-positive-action"
  readonly scoreDelta: 0
}

export type NextActionRecommendation =
  | TakeActionRecommendation
  | StopRecommendation

export class NextActionRecommender {
  readonly #actionProvider: ActionProvider
  readonly #evaluate: PartyEvaluator

  constructor(actionProvider: ActionProvider, evaluate: PartyEvaluator) {
    this.#actionProvider = actionProvider
    this.#evaluate = evaluate
  }

  recommend(party: PartyState, town: TownDefinition): NextActionRecommendation {
    const actions = this.#actionProvider.availableActions(party, town)
    if (actions.length === 0) {

      return { kind: "stop", reason: "no-legal-action", scoreDelta: 0 }
    }

    const currentScore = this.#evaluate(party)
    let bestRecommendation: TakeActionRecommendation | undefined

    for (const action of actions) {
      const nextScore = this.#evaluate(applyAction(party, action))
      const scoreDelta = nextScore.total - currentScore.total
      if (
        scoreDelta > 0
        && (bestRecommendation === undefined || scoreDelta > bestRecommendation.scoreDelta)
      ) {
        bestRecommendation = {
          kind: "take-action",
          action,
          scoreDelta,
          components: nextScore.components,
        }
      }
    }

    return bestRecommendation ?? { kind: "stop", reason: "no-positive-action", scoreDelta: 0 }
  }

  recommendPlan(party: PartyState, town: TownDefinition): readonly NextActionRecommendation[] {
    const recommendations: NextActionRecommendation[] = []
    const seenPartyStates = new Set<string>([serializePartyState(party)])
    let currentParty = party

    while (true) {
      const recommendation = this.recommend(currentParty, town)
      recommendations.push(recommendation)
      if (recommendation.kind === "stop") {

        return recommendations
      }

      currentParty = applyAction(currentParty, recommendation.action)
      const serializedParty = serializePartyState(currentParty)
      if (seenPartyStates.has(serializedParty)) {
        throw new Error("Repeated Final Fantasy party state while recommending next actions")
      }
      seenPartyStates.add(serializedParty)
    }
  }
}

export function applyAction(party: PartyState, action: NextAction): PartyState {
  if (party.gil < action.price) {
    throw new Error(`Cannot apply unaffordable Final Fantasy action costing ${action.price} gil`)
  }

  let matchedCharacter = false
  const characters = party.characters.map((character) => {
    if (character.id !== action.characterId) {

      return character
    }
    matchedCharacter = true

    if (action.kind === "bind-equipment") {

      return {
        ...character,
        equipment: { ...character.equipment, [action.slot]: action.item },
      }
    }

    return {
      ...character,
      learnedSpells: new Set([...character.learnedSpells, action.spell]),
    }
  })

  if (!matchedCharacter) {
    throw new Error(`Unknown Final Fantasy action character: ${action.characterId}`)
  }

  return {
    characters,
    gil: party.gil - action.price,
  }
}

function serializePartyState(party: PartyState): string {
  return JSON.stringify({
    gil: party.gil,
    characters: party.characters.map((character) => ({
      id: character.id,
      baseClass: character.baseClass,
      promoted: character.promoted,
      equipment: Object.fromEntries(
        Object.entries(character.equipment)
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
      learnedSpells: [...character.learnedSpells].sort(),
    })),
  })
}
