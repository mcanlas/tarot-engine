import type { StrategyCatalog, Job } from "./strategy-core.ts"
import type { ShopType, TownDefinition } from "./towns.ts"

export type EquipmentSlot = "weapon" | "body" | "shield" | "head" | "arms"

interface EquipmentDefinitionBase {
  readonly key: string
  readonly name: string
  readonly price: number
  readonly canEquip: readonly string[]
}

export interface WeaponDefinition extends EquipmentDefinitionBase {
  readonly slot: "weapon"
  readonly attack: number
  readonly accuracy: number
  readonly criticalRate: number
}

export interface ArmorDefinition extends EquipmentDefinitionBase {
  readonly slot: Exclude<EquipmentSlot, "weapon">
  readonly defense: number
  readonly weight: number
}

export type EquipmentDefinition = WeaponDefinition | ArmorDefinition

export type MagicTarget = "self" | "single-ally" | "single-enemy" | "all-enemies"

export type MagicEffect =
  | { readonly kind: "restore-hp"; readonly potency: number }
  | {
      readonly kind: "damage"
      readonly potency: number
      readonly accuracy: number
      readonly element?: "fire" | "lightning"
      readonly targetFamily?: "undead"
    }
  | { readonly kind: "raise-defense"; readonly potency: number }
  | { readonly kind: "raise-evasion"; readonly potency: number }
  | { readonly kind: "inflict-status"; readonly status: "sleep"; readonly accuracy: number }
  | { readonly kind: "lower-evasion"; readonly potency: number; readonly accuracy: number }

export interface MagicDefinition {
  readonly key: string
  readonly name: string
  readonly school: "white" | "black"
  readonly level: number
  readonly price: number
  readonly target: MagicTarget
  readonly effect: MagicEffect
}

export interface NextActionCatalog {
  readonly equipment: readonly EquipmentDefinition[]
  readonly magic: readonly MagicDefinition[]
}

export interface CharacterState {
  readonly id: string
  readonly baseClass: string
  readonly promoted: boolean
  readonly equipment: Readonly<Partial<Record<EquipmentSlot, string>>>
  readonly learnedSpells: ReadonlySet<string>
}

export interface PartyState {
  readonly characters: readonly CharacterState[]
  readonly gil: number
}

export interface LearnSpellAction {
  readonly kind: "learn-spell"
  readonly characterId: string
  readonly spell: string
  readonly price: number
}

export interface BindEquipmentAction {
  readonly kind: "bind-equipment"
  readonly characterId: string
  readonly item: string
  readonly slot: EquipmentSlot
  readonly price: number
  readonly replaces?: string
}

export type NextAction =
  | LearnSpellAction
  | BindEquipmentAction

const maximumPartySize = 4
const maximumSpellsPerLevel = 3

export class NextActionProvider {
  readonly #strategyCatalog: StrategyCatalog
  readonly #equipment: ReadonlyMap<string, EquipmentDefinition>
  readonly #magic: ReadonlyMap<string, MagicDefinition>

  constructor(
    strategyCatalog: StrategyCatalog,
    actionCatalog: NextActionCatalog,
  ) {
    this.#strategyCatalog = strategyCatalog
    this.#equipment = uniqueByKey("equipment", actionCatalog.equipment)
    this.#magic = uniqueByKey("magic", actionCatalog.magic)
    for (const equipment of this.#equipment.values()) {
      if (equipment.slot === "weapon") {
        requireNonNegativeInteger(equipment.attack, `equipment ${equipment.key} attack`)
        requireNonNegativeInteger(equipment.accuracy, `equipment ${equipment.key} accuracy`)
        requireNonNegativeInteger(
          equipment.criticalRate,
          `equipment ${equipment.key} critical rate`,
        )
      } else {
        requireNonNegativeInteger(equipment.defense, `equipment ${equipment.key} defense`)
        requireNonNegativeInteger(equipment.weight, `equipment ${equipment.key} weight`)
      }
    }
    for (const magic of this.#magic.values()) {
      validateMagicMechanics(magic)
    }
  }

  availableActions(
    party: PartyState,
    town: TownDefinition,
  ): readonly NextAction[] {
    validateParty(party)
    const characters = party.characters.map((character) => ({
      state: character,
      activeJob: resolveActiveJob(this.#strategyCatalog, character),
    }))

    // TODO: Add a reached-town watermark to party state and derive which town catalogs are
    // unlocked. For now the caller provides the complete Cornelia catalog directly.
    return town.shops.flatMap((shop) => shop.wares.flatMap(
      (ware): NextAction[] => {
        if (shop.type === "weapons" || shop.type === "armor") {
          const equipment = requireEquipment(this.#equipment, ware, shop.type)

          return party.gil < equipment.price
            ? []
            : characters.flatMap(({ state, activeJob }) =>
              equipment.canEquip.includes(activeJob.id)
              && state.equipment[equipment.slot] !== equipment.key
                ? [bindEquipment(state, equipment)]
                : [],
            )
        }

        const magic = requireMagic(this.#magic, ware, shop.type)
        const spell = this.#strategyCatalog.spells.get(magic.key)
        if (spell === undefined) {
          throw new Error(`Magic ${magic.key} is missing from the Final Fantasy spell catalog`)
        }

        return party.gil < magic.price
          ? []
          : characters.flatMap(({ state, activeJob }) =>
            spell.learnableBy.has(activeJob.id)
            && !state.learnedSpells.has(spell.id)
            && learnedSpellCountAtLevel(state, magic.level, this.#magic) < maximumSpellsPerLevel
              ? [{
                  kind: "learn-spell" as const,
                  characterId: state.id,
                  spell: spell.id,
                  price: magic.price,
                }]
              : [],
          )
      },
    ))
  }
}

function bindEquipment(
  character: CharacterState,
  equipment: EquipmentDefinition,
): BindEquipmentAction {
  const replaced = character.equipment[equipment.slot]

  return {
    kind: "bind-equipment",
    characterId: character.id,
    item: equipment.key,
    slot: equipment.slot,
    price: equipment.price,
    ...(replaced === undefined ? {} : { replaces: replaced }),
  }
}

function learnedSpellCountAtLevel(
  character: CharacterState,
  level: number,
  magic: ReadonlyMap<string, MagicDefinition>,
): number {
  return [...character.learnedSpells]
    .filter((spell) => magic.get(spell)?.level === level)
    .length
}

function resolveActiveJob(
  catalog: StrategyCatalog,
  character: CharacterState,
): Job {
  const baseJob = catalog.jobs.get(character.baseClass)
  if (baseJob === undefined || baseJob.promotion === undefined) {
    throw new Error(`${character.id} must have an unpromoted base class`)
  }
  if (!character.promoted) {

    return baseJob
  }

  const promotedJob = catalog.jobs.get(baseJob.promotion)
  if (promotedJob === undefined) {
    throw new Error(`Unknown promotion for ${character.baseClass}: ${baseJob.promotion}`)
  }

  return promotedJob
}

function validateParty(party: PartyState): void {
  if (party.characters.length < 1 || party.characters.length > maximumPartySize) {
    throw new Error("Final Fantasy party state must contain 1 to 4 characters")
  }
  if (!Number.isFinite(party.gil) || party.gil < 0) {
    throw new Error("Final Fantasy party gil must be a non-negative finite number")
  }
  const ids = party.characters.map((character) => character.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error("Final Fantasy party character IDs must be unique")
  }
}

function requireEquipment(
  equipment: ReadonlyMap<string, EquipmentDefinition>,
  key: string,
  shopType: "weapons" | "armor",
): EquipmentDefinition {
  const item = equipment.get(key)
  const slotMatchesShop = item !== undefined
    && (shopType === "weapons" ? item.slot === "weapon" : item.slot !== "weapon")
  if (item === undefined || !slotMatchesShop) {
    throw new Error(`${shopType} ware ${key} is missing matching equipment data`)
  }

  return item
}

function requireMagic(
  magic: ReadonlyMap<string, MagicDefinition>,
  key: string,
  shopType: Exclude<ShopType, "weapons" | "armor">,
): MagicDefinition {
  const spell = magic.get(key)
  const expectedSchool = shopType === "white-magic" ? "white" : "black"
  if (spell === undefined || spell.school !== expectedSchool) {
    throw new Error(`${shopType} ware ${key} is missing matching magic data`)
  }

  return spell
}

function uniqueByKey<T extends { readonly key: string }>(
  label: string,
  definitions: readonly T[],
): ReadonlyMap<string, T> {
  const result = new Map<string, T>()
  for (const definition of definitions) {
    if (result.has(definition.key)) {
      throw new Error(`Duplicate Final Fantasy ${label} key: ${definition.key}`)
    }
    result.set(definition.key, definition)
  }

  return result
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Final Fantasy ${label} must be a non-negative integer`)
  }
}

function validateMagicMechanics(magic: MagicDefinition): void {
  const targets = new Set<MagicTarget>(["self", "single-ally", "single-enemy", "all-enemies"])
  if (!targets.has(magic.target)) {
    throw new Error(`Final Fantasy magic ${magic.key} must have a known target`)
  }

  switch (magic.effect.kind) {
    case "restore-hp":
    case "raise-defense":
    case "raise-evasion":
      requireNonNegativeInteger(magic.effect.potency, `magic ${magic.key} potency`)
      return
    case "damage":
    case "lower-evasion":
      requireNonNegativeInteger(magic.effect.potency, `magic ${magic.key} potency`)
      requireNonNegativeInteger(magic.effect.accuracy, `magic ${magic.key} accuracy`)
      return
    case "inflict-status":
      requireNonNegativeInteger(magic.effect.accuracy, `magic ${magic.key} accuracy`)
      return
    default: {
      const unknownEffect: never = magic.effect
      throw new Error(`Final Fantasy magic ${magic.key} has an unknown effect: ${String(unknownEffect)}`)
    }
  }
}
