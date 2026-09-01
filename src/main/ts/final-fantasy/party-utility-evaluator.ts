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
  readonly excludedEquipmentKeys: ReadonlySet<string>
  readonly monkEquipmentMultiplier: number
  readonly spellEffect: Readonly<Record<MagicDefinition["effect"]["kind"], number>>
  readonly spellPotency: Readonly<Record<MagicDefinition["effect"]["kind"], number>>
  readonly spellAccuracy: number
  readonly allEnemiesBonus: number
  readonly restrictedTargetPenalty: number
  readonly firstPartyCapabilityBonus: number
  readonly specialistRoleMultiplier: number
  readonly coveredRedMageMultiplier: number
  readonly duplicateDamageMultiplier: number
  readonly duplicateRecoveryMultiplier: number
  readonly duplicateSupportMultiplier: number
  readonly attackBuffPhysicalTargetMultiplier: number
  readonly attackBuffUnarmedMonkTargetMultiplier: number
  readonly attackBuffHybridTargetMultiplier: number
  readonly attackBuffNoTargetMultiplier: number
  readonly spellSlotOpportunityCosts: readonly [number, number, number]
}

export const defaultPartyUtilityPolicy: PartyUtilityPolicy = Object.freeze({
  weaponAttack: 4,
  weaponAccuracy: 1,
  weaponCriticalRate: 1,
  armorDefense: 4,
  armorWeightPenalty: 1,
  excludedEquipmentKeys: new Set(["nunchaku"]),
  monkEquipmentMultiplier: 0,
  spellEffect: Object.freeze({
    "restore-hp": 50,
    revive: 50,
    "cure-status": 20,
    damage: 20,
    "raise-defense": 25,
    "raise-evasion": 20,
    "raise-resistance": 30,
    "raise-attack": 35,
    "multiply-attack-count": 60,
    "inflict-status": 25,
    "lower-attack-count": 20,
    "lower-evasion": 5,
    "increase-flee": 0,
    "exit-dungeon": 0,
    "teleport-floor": 0,
  }),
  spellPotency: Object.freeze({
    "restore-hp": 1,
    revive: 1,
    "cure-status": 0,
    damage: 1,
    "raise-defense": 2,
    "raise-evasion": 0.125,
    "raise-resistance": 0,
    "raise-attack": 2,
    "multiply-attack-count": 0,
    "inflict-status": 0,
    "lower-attack-count": 0,
    "lower-evasion": 0.5,
    "increase-flee": 0,
    "exit-dungeon": 0,
    "teleport-floor": 0,
  }),
  spellAccuracy: 0.125,
  allEnemiesBonus: 10,
  restrictedTargetPenalty: 10,
  firstPartyCapabilityBonus: 15,
  specialistRoleMultiplier: 1.15,
  coveredRedMageMultiplier: 0.75,
  duplicateDamageMultiplier: 0.5,
  duplicateRecoveryMultiplier: 0.6,
  duplicateSupportMultiplier: 0.15,
  attackBuffPhysicalTargetMultiplier: 0.8,
  attackBuffUnarmedMonkTargetMultiplier: 1,
  attackBuffHybridTargetMultiplier: 0.75,
  attackBuffNoTargetMultiplier: 0,
  spellSlotOpportunityCosts: Object.freeze([0, 8, 28] as const),
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
    // - excluded equipment and Monk equipment receive no recommendation value; this model treats
    //   Monks as item-free because it does not carry the level needed for an early-game crossover
    //
    // Spell components:
    // - begin with spellEffect[effect.kind]
    // - add potency * spellPotency[effect.kind] when the effect has potency
    // - add accuracy * spellAccuracy when the effect has accuracy
    // - add allEnemiesBonus for all-enemies spells
    // - subtract restrictedTargetPenalty when damage has targetFamily
    // - reward the first party-wide copy of a capability, then diminish duplicate damage,
    //   recovery, and support/control at different rates
    // - prefer school specialists; Red Mages retain full value only when they are covering a
    //   school that has no specialist in the party
    // - charge escalating opportunity costs as each character fills a level's three slots
    // - scale attack buffs by the best actual recipient: an unarmed Monk, a physical attacker,
    //   a hybrid Red Mage, or no viable target
    //
    // Emit one ScoreComponent per equipped item and learned spell. Component keys must be
    // `${character.id}:equipment:${slot}` and `${character.id}:magic:${spell}`. Reasons must
    // name the concrete mechanics that produced the value. Reject equipped or learned keys
    // absent from the supplied catalog. Sum components for PartyScore.total.
    const components: ScoreComponent[] = []
    const learnedMagic = party.characters.flatMap((character) =>
      [...character.learnedSpells].map((spellKey) => {
        const magic = this.#magic.get(spellKey)
        if (magic === undefined) {
          throw new Error(`Unknown Final Fantasy magic state key: ${spellKey}`)
        }

        return { character, magic }
      }),
    )
    const partySchools = new Set(
      party.characters.flatMap((character) => specialistSchool(character.baseClass)),
    )
    const primaryCapabilities = selectPrimaryCapabilities(learnedMagic, partySchools, this.#policy)
    const spellLevelCounts = countSpellLevels(learnedMagic)

    for (const character of party.characters) {
      for (const [slot, itemKey] of Object.entries(character.equipment)) {
        const equipment = this.#equipment.get(itemKey)
        if (equipment === undefined) {
          throw new Error(`Unknown Final Fantasy equipment state key: ${itemKey}`)
        }
        if (equipment.slot !== slot) {
          throw new Error(`Final Fantasy equipment state key ${itemKey} does not match slot ${slot}`)
        }
        components.push(scoreEquipment(character, equipment, this.#policy))
      }

      for (const spellKey of character.learnedSpells) {
        const magic = this.#magic.get(spellKey)!
        const capability = magicCapabilityKey(magic)
        const primary = primaryCapabilities.get(capability)
        const levelCount = spellLevelCounts.get(spellLevelKey(character.id, magic.level)) ?? 0
        components.push(scoreMagic(
          character,
          magic,
          primary?.character.id === character.id && primary.magic.key === magic.key,
          party.characters,
          partySchools,
          levelCount,
          this.#policy,
        ))
      }
    }

    return {
      total: components.reduce((sum, component) => sum + component.value, 0),
      components,
    }
  }
}

function scoreEquipment(
  character: PartyState["characters"][number],
  equipment: WeaponDefinition | ArmorDefinition,
  policy: PartyUtilityPolicy,
): ScoreComponent {
  let value: number
  let reasons: string[]

  if (equipment.slot === "weapon") {
    const attackValue = equipment.attack * policy.weaponAttack
    const accuracyValue = equipment.accuracy * policy.weaponAccuracy
    const criticalValue = equipment.criticalRate * policy.weaponCriticalRate
    value = attackValue + accuracyValue + criticalValue
    reasons = [`${equipment.name} weapon attack ${equipment.attack}*${policy.weaponAttack} + accuracy ${equipment.accuracy}*${policy.weaponAccuracy} + critical rate ${equipment.criticalRate}*${policy.weaponCriticalRate}`]
  } else {
    const defenseValue = equipment.defense * policy.armorDefense
    const weightPenalty = equipment.weight * policy.armorWeightPenalty
    value = defenseValue - weightPenalty
    reasons = [`${equipment.name} armor defense ${equipment.defense}*${policy.armorDefense} - weight ${equipment.weight}*${policy.armorWeightPenalty}`]
  }

  if (policy.excludedEquipmentKeys.has(equipment.key)) {
    value = 0
    reasons.push("excluded from recommendations")
  } else if (character.baseClass === "monk") {
    value *= policy.monkEquipmentMultiplier
    reasons.push(`Monk item-free multiplier ${policy.monkEquipmentMultiplier}`)
  }

  return {
    key: `${character.id}:equipment:${equipment.slot}`,
    value,
    reason: reasons.join("; "),
  }
}

function scoreMagic(
  character: PartyState["characters"][number],
  magic: MagicDefinition,
  primaryCapability: boolean,
  party: PartyState["characters"],
  partySchools: ReadonlySet<MagicDefinition["school"]>,
  spellLevelCount: number,
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
  if ("accuracy" in effect && effect.accuracy !== undefined) {
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

  const roleMultiplier = spellRoleMultiplier(character.baseClass, magic.school, partySchools, policy)
  if (roleMultiplier !== 1) {
    value *= roleMultiplier
    reasons.push(`${spellRoleLabel(character.baseClass, magic.school, partySchools)} multiplier ${roleMultiplier}`)
  }

  if (primaryCapability) {
    value += policy.firstPartyCapabilityBonus
    reasons.push(`first party capability bonus ${policy.firstPartyCapabilityBonus}`)
  } else {
    const duplicateMultiplier = duplicateMagicMultiplier(magic, policy)
    value *= duplicateMultiplier
    reasons.push(`duplicate ${magicResponsibility(magic)} multiplier ${duplicateMultiplier}`)
  }

  if (effect.kind === "raise-attack" || effect.kind === "multiply-attack-count") {
    const targetFit = attackBuffTargetFit(party, policy)
    value *= targetFit.multiplier
    reasons.push(`${targetFit.label} multiplier ${targetFit.multiplier}`)
  }

  const slotCost = spellSlotCostShare(spellLevelCount, policy)
  value -= slotCost
  reasons.push(`level ${magic.level} slots ${spellLevelCount}/3; opportunity cost ${slotCost}`)

  return {
    key: `${character.id}:magic:${magic.key}`,
    value,
    reason: reasons.join("; "),
  }
}

interface LearnedMagic {
  readonly character: PartyState["characters"][number]
  readonly magic: MagicDefinition
}

interface AttackBuffTargetFit {
  readonly multiplier: number
  readonly label: string
}

function attackBuffTargetFit(
  party: PartyState["characters"],
  policy: PartyUtilityPolicy,
): AttackBuffTargetFit {
  if (party.some((character) =>
    character.baseClass === "monk" && character.equipment.weapon === undefined,
  )) {

    return {
      multiplier: policy.attackBuffUnarmedMonkTargetMultiplier,
      label: "unarmed Monk double-hit target",
    }
  }
  if (party.some((character) =>
    character.baseClass === "warrior"
    || character.baseClass === "thief"
    || character.baseClass === "monk",
  )) {

    return {
      multiplier: policy.attackBuffPhysicalTargetMultiplier,
      label: "physical attacker target",
    }
  }
  if (party.some((character) => character.baseClass === "red-mage")) {

    return {
      multiplier: policy.attackBuffHybridTargetMultiplier,
      label: "Red Mage hybrid target",
    }
  }

  return {
    multiplier: policy.attackBuffNoTargetMultiplier,
    label: "no physical attack target",
  }
}

function selectPrimaryCapabilities(
  learnedMagic: readonly LearnedMagic[],
  partySchools: ReadonlySet<MagicDefinition["school"]>,
  policy: PartyUtilityPolicy,
): ReadonlyMap<string, LearnedMagic> {
  const primary = new Map<string, LearnedMagic>()
  for (const learned of [...learnedMagic].sort((left, right) => {
    const roleDifference = spellRoleMultiplier(
      right.character.baseClass,
      right.magic.school,
      partySchools,
      policy,
    ) - spellRoleMultiplier(
      left.character.baseClass,
      left.magic.school,
      partySchools,
      policy,
    )

    return roleDifference
      || left.character.id.localeCompare(right.character.id)
      || left.magic.key.localeCompare(right.magic.key)
  })) {
    const capability = magicCapabilityKey(learned.magic)
    if (!primary.has(capability)) {
      primary.set(capability, learned)
    }
  }

  return primary
}

function countSpellLevels(learnedMagic: readonly LearnedMagic[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const { character, magic } of learnedMagic) {
    const key = spellLevelKey(character.id, magic.level)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

function spellLevelKey(characterId: string, level: number): string {
  return `${characterId}:${level}`
}

function specialistSchool(baseClass: string): readonly MagicDefinition["school"][] {
  if (baseClass === "white-mage") {

    return ["white"]
  }
  if (baseClass === "black-mage") {

    return ["black"]
  }

  return []
}

function spellRoleMultiplier(
  baseClass: string,
  school: MagicDefinition["school"],
  partySchools: ReadonlySet<MagicDefinition["school"]>,
  policy: PartyUtilityPolicy,
): number {
  if (specialistSchool(baseClass).includes(school)) {

    return policy.specialistRoleMultiplier
  }
  if (baseClass === "red-mage" && partySchools.has(school)) {

    return policy.coveredRedMageMultiplier
  }

  return 1
}

function spellRoleLabel(
  baseClass: string,
  school: MagicDefinition["school"],
  partySchools: ReadonlySet<MagicDefinition["school"]>,
): string {
  return specialistSchool(baseClass).includes(school)
    ? "school specialist"
    : partySchools.has(school) ? "Red Mage shared responsibility" : "role fit"
}

function duplicateMagicMultiplier(
  magic: MagicDefinition,
  policy: PartyUtilityPolicy,
): number {
  const responsibility = magicResponsibility(magic)
  if (responsibility === "damage") {

    return policy.duplicateDamageMultiplier
  }
  if (responsibility === "recovery") {

    return policy.duplicateRecoveryMultiplier
  }

  return policy.duplicateSupportMultiplier
}

function magicResponsibility(magic: MagicDefinition): "damage" | "recovery" | "support/control" {
  if (magic.effect.kind === "damage") {

    return "damage"
  }
  if (
    magic.effect.kind === "restore-hp"
    || magic.effect.kind === "revive"
    || magic.effect.kind === "cure-status"
  ) {

    return "recovery"
  }

  return "support/control"
}

function spellSlotCostShare(spellCount: number, policy: PartyUtilityPolicy): number {
  if (spellCount < 1) {
    throw new Error(`Final Fantasy spell level count must be positive: ${spellCount}`)
  }
  const totalCost = policy.spellSlotOpportunityCosts
    .slice(0, spellCount)
    .reduce((sum, cost) => sum + cost, 0)

  return totalCost / spellCount
}

function magicCapabilityKey(magic: MagicDefinition): string {
  const effect = magic.effect
  const discriminators: string[] = [effect.kind]
  if (effect.kind === "damage") {
    discriminators.push(effect.element ?? "", effect.targetFamily ?? "")
  }
  if (effect.kind === "inflict-status") {
    discriminators.push(effect.status, effect.element ?? "", String(effect.maximumTargetHp ?? ""))
  }
  if (effect.kind === "cure-status") {
    discriminators.push(effect.status)
  }
  if (effect.kind === "raise-resistance") {
    discriminators.push(effect.element)
  }
  if (effect.kind === "restore-hp" || effect.kind === "revive") {
    discriminators.push(magic.target)
  }

  return discriminators.join(":")
}
