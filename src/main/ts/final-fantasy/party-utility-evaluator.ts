import type {
  ArmorDefinition,
  MagicDefinition,
  NextActionCatalog,
  PartyState,
  WeaponDefinition,
} from "./next-action-provider.ts"
import type {
  PartyEvaluator,
  PartyScore,
  ScoreComponent,
} from "./next-action-recommender.ts"

export interface PartyUtilityPolicy {
  readonly weaponAttack: number
  readonly weaponAccuracy: number
  readonly weaponCriticalRate: number
  readonly armorDefense: number
  readonly armorWeightPenalty: number
  readonly spellEffect: Readonly<Record<MagicDefinition["effect"]["kind"], number>>
  readonly spellPotency: Readonly<Record<MagicDefinition["effect"]["kind"], number>>
  readonly spellAccuracy: number
  readonly allEnemiesBonus: number
  readonly restrictedTargetPenalty: number
  readonly duplicateCapabilityMultiplier: number
}

export const defaultPartyUtilityPolicy: PartyUtilityPolicy = Object.freeze({
  weaponAttack: 4,
  weaponAccuracy: 1,
  weaponCriticalRate: 1,
  armorDefense: 4,
  armorWeightPenalty: 1,
  spellEffect: Object.freeze({
    "restore-hp": 50,
    "cure-status": 20,
    damage: 20,
    "raise-defense": 25,
    "raise-evasion": 20,
    "raise-resistance": 30,
    "raise-attack": 35,
    "inflict-status": 25,
    "lower-attack-count": 20,
    "lower-evasion": 5,
  }),
  spellPotency: Object.freeze({
    "restore-hp": 1,
    "cure-status": 0,
    damage: 1,
    "raise-defense": 2,
    "raise-evasion": 0.125,
    "raise-resistance": 0,
    "raise-attack": 2,
    "inflict-status": 0,
    "lower-attack-count": 0,
    "lower-evasion": 0.5,
  }),
  spellAccuracy: 0.125,
  allEnemiesBonus: 10,
  restrictedTargetPenalty: 10,
  duplicateCapabilityMultiplier: 0.5,
})

export class PartyUtilityEvaluator {
  readonly #equipment: ReadonlyMap<string, WeaponDefinition | ArmorDefinition>
  readonly #magic: ReadonlyMap<string, MagicDefinition>
  readonly #policy: PartyUtilityPolicy

  constructor(
    catalog: NextActionCatalog,
    policy: PartyUtilityPolicy = defaultPartyUtilityPolicy,
  ) {
    this.#equipment = new Map(catalog.equipment.map((equipment) => [equipment.key, equipment]))
    this.#magic = new Map(catalog.magic.map((magic) => [magic.key, magic]))
    this.#policy = policy
  }

  readonly evaluate: PartyEvaluator = (party: PartyState): PartyScore => {
    // Equipment components:
    // - weapon = attack * weaponAttack + accuracy * weaponAccuracy
    //   + criticalRate * weaponCriticalRate
    // - armor = defense * armorDefense - weight * armorWeightPenalty
    //
    // Spell components:
    // - begin with spellEffect[effect.kind]
    // - add potency * spellPotency[effect.kind] when the effect has potency
    // - add accuracy * spellAccuracy when the effect has accuracy
    // - add allEnemiesBonus for all-enemies spells
    // - subtract restrictedTargetPenalty when damage has targetFamily
    // - identify duplicate capabilities by effect kind plus element, target family, or status;
    //   multiply the second and later party-wide copies by duplicateCapabilityMultiplier
    //
    // Emit one ScoreComponent per equipped item and learned spell. Component keys must be
    // `${character.id}:equipment:${slot}` and `${character.id}:magic:${spell}`. Reasons must
    // name the concrete mechanics that produced the value. Reject equipped or learned keys
    // absent from the supplied catalog. Sum components for PartyScore.total.
    const components: ScoreComponent[] = []
    const seenCapabilities = new Map<string, number>()

    for (const character of party.characters) {
      for (const [slot, itemKey] of Object.entries(character.equipment)) {
        const equipment = this.#equipment.get(itemKey)
        if (equipment === undefined) {
          throw new Error(`Unknown Final Fantasy equipment state key: ${itemKey}`)
        }
        if (equipment.slot !== slot) {
          throw new Error(`Final Fantasy equipment state key ${itemKey} does not match slot ${slot}`)
        }
        components.push(scoreEquipment(character.id, equipment, this.#policy))
      }

      for (const spellKey of character.learnedSpells) {
        const magic = this.#magic.get(spellKey)
        if (magic === undefined) {
          throw new Error(`Unknown Final Fantasy magic state key: ${spellKey}`)
        }
        const capability = magicCapabilityKey(magic)
        const duplicateCount = seenCapabilities.get(capability) ?? 0
        seenCapabilities.set(capability, duplicateCount + 1)
        components.push(scoreMagic(character.id, magic, duplicateCount > 0, this.#policy))
      }
    }

    return {
      total: components.reduce((sum, component) => sum + component.value, 0),
      components,
    }
  }
}

function scoreEquipment(
  characterId: string,
  equipment: WeaponDefinition | ArmorDefinition,
  policy: PartyUtilityPolicy,
): ScoreComponent {
  if (equipment.slot === "weapon") {
    const attackValue = equipment.attack * policy.weaponAttack
    const accuracyValue = equipment.accuracy * policy.weaponAccuracy
    const criticalValue = equipment.criticalRate * policy.weaponCriticalRate
    const value = attackValue + accuracyValue + criticalValue

    return {
      key: `${characterId}:equipment:${equipment.slot}`,
      value,
      reason: `${equipment.name} weapon attack ${equipment.attack}*${policy.weaponAttack} + accuracy ${equipment.accuracy}*${policy.weaponAccuracy} + critical rate ${equipment.criticalRate}*${policy.weaponCriticalRate}`,
    }
  }

  const defenseValue = equipment.defense * policy.armorDefense
  const weightPenalty = equipment.weight * policy.armorWeightPenalty
  const value = defenseValue - weightPenalty

  return {
    key: `${characterId}:equipment:${equipment.slot}`,
    value,
    reason: `${equipment.name} armor defense ${equipment.defense}*${policy.armorDefense} - weight ${equipment.weight}*${policy.armorWeightPenalty}`,
  }
}

function scoreMagic(
  characterId: string,
  magic: MagicDefinition,
  duplicateCapability: boolean,
  policy: PartyUtilityPolicy,
): ScoreComponent {
  const effect = magic.effect
  let value = policy.spellEffect[effect.kind]
  const reasons = [`${magic.name} ${effect.kind} base ${policy.spellEffect[effect.kind]}`]

  if ("potency" in effect) {
    const potencyWeight = policy.spellPotency[effect.kind]
    const potencyValue = effect.potency * potencyWeight
    value += potencyValue
    reasons.push(`potency ${effect.potency}*${potencyWeight}`)
  }
  if ("accuracy" in effect) {
    const accuracyValue = effect.accuracy * policy.spellAccuracy
    value += accuracyValue
    reasons.push(`accuracy ${effect.accuracy}*${policy.spellAccuracy}`)
  }
  if (magic.target === "all-enemies") {
    value += policy.allEnemiesBonus
    reasons.push(`all-enemies bonus ${policy.allEnemiesBonus}`)
  }
  if (effect.kind === "damage" && effect.targetFamily !== undefined) {
    value -= policy.restrictedTargetPenalty
    reasons.push(`${effect.targetFamily} restriction -${policy.restrictedTargetPenalty}`)
  }
  if (duplicateCapability) {
    value *= policy.duplicateCapabilityMultiplier
    reasons.push(`duplicate capability multiplier ${policy.duplicateCapabilityMultiplier}`)
  }

  return {
    key: `${characterId}:magic:${magic.key}`,
    value,
    reason: reasons.join("; "),
  }
}

function magicCapabilityKey(magic: MagicDefinition): string {
  const effect = magic.effect
  const discriminators: string[] = [effect.kind]
  if (effect.kind === "damage") {
    discriminators.push(effect.element ?? "", effect.targetFamily ?? "")
  }
  if (effect.kind === "inflict-status") {
    discriminators.push(effect.status)
  }
  if (effect.kind === "cure-status") {
    discriminators.push(effect.status)
  }
  if (effect.kind === "raise-resistance") {
    discriminators.push(effect.element)
  }

  return discriminators.join(":")
}
