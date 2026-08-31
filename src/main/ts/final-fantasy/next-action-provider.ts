import type { FinalFantasyCatalog, Job } from "./strategy-core.ts"
import type { FinalFantasyShopType, FinalFantasyTownDefinition } from "./towns.ts"

export type FinalFantasyEquipmentSlot = "weapon" | "body" | "shield" | "head" | "arms"

export interface FinalFantasyEquipmentDefinition {
  readonly key: string
  readonly name: string
  readonly slot: FinalFantasyEquipmentSlot
  readonly price: number
  readonly canEquip: readonly string[]
}

export interface FinalFantasyMagicDefinition {
  readonly key: string
  readonly name: string
  readonly school: "white" | "black"
  readonly level: number
  readonly price: number
}

export interface FinalFantasyNextActionCatalog {
  readonly equipment: readonly FinalFantasyEquipmentDefinition[]
  readonly magic: readonly FinalFantasyMagicDefinition[]
}

export interface FinalFantasyCharacterState {
  readonly id: string
  readonly baseClass: string
  readonly promoted: boolean
  readonly equipment: Readonly<Partial<Record<FinalFantasyEquipmentSlot, string>>>
  readonly learnedSpells: ReadonlySet<string>
}

export interface FinalFantasyPartyState {
  readonly characters: readonly FinalFantasyCharacterState[]
  readonly gil: number
}

export interface FinalFantasyLearnSpellAction {
  readonly kind: "learn-spell"
  readonly characterId: string
  readonly spell: string
  readonly price: number
}

export interface FinalFantasyBindEquipmentAction {
  readonly kind: "bind-equipment"
  readonly characterId: string
  readonly item: string
  readonly slot: FinalFantasyEquipmentSlot
  readonly price: number
  readonly replaces?: string
}

export type FinalFantasyNextAction =
  | FinalFantasyLearnSpellAction
  | FinalFantasyBindEquipmentAction

const maximumPartySize = 4
const maximumSpellsPerLevel = 3

export class FinalFantasyNextActionProvider {
  readonly #strategyCatalog: FinalFantasyCatalog
  readonly #equipment: ReadonlyMap<string, FinalFantasyEquipmentDefinition>
  readonly #magic: ReadonlyMap<string, FinalFantasyMagicDefinition>

  constructor(
    strategyCatalog: FinalFantasyCatalog,
    actionCatalog: FinalFantasyNextActionCatalog,
  ) {
    this.#strategyCatalog = strategyCatalog
    this.#equipment = uniqueByKey("equipment", actionCatalog.equipment)
    this.#magic = uniqueByKey("magic", actionCatalog.magic)
  }

  availableActions(
    party: FinalFantasyPartyState,
    town: FinalFantasyTownDefinition,
  ): readonly FinalFantasyNextAction[] {
    validateParty(party)
    const characters = party.characters.map((character) => ({
      state: character,
      activeJob: resolveActiveJob(this.#strategyCatalog, character),
    }))

    // TODO: Add a reached-town watermark to party state and derive which town catalogs are
    // unlocked. For now the caller provides the complete Cornelia catalog directly.
    return town.shops.flatMap((shop) => shop.wares.flatMap(
      (ware): FinalFantasyNextAction[] => {
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
  character: FinalFantasyCharacterState,
  equipment: FinalFantasyEquipmentDefinition,
): FinalFantasyBindEquipmentAction {
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
  character: FinalFantasyCharacterState,
  level: number,
  magic: ReadonlyMap<string, FinalFantasyMagicDefinition>,
): number {
  return [...character.learnedSpells]
    .filter((spell) => magic.get(spell)?.level === level)
    .length
}

function resolveActiveJob(
  catalog: FinalFantasyCatalog,
  character: FinalFantasyCharacterState,
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

function validateParty(party: FinalFantasyPartyState): void {
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
  equipment: ReadonlyMap<string, FinalFantasyEquipmentDefinition>,
  key: string,
  shopType: "weapons" | "armor",
): FinalFantasyEquipmentDefinition {
  const item = equipment.get(key)
  const slotMatchesShop = item !== undefined
    && (shopType === "weapons" ? item.slot === "weapon" : item.slot !== "weapon")
  if (item === undefined || !slotMatchesShop) {
    throw new Error(`${shopType} ware ${key} is missing matching equipment data`)
  }

  return item
}

function requireMagic(
  magic: ReadonlyMap<string, FinalFantasyMagicDefinition>,
  key: string,
  shopType: Exclude<FinalFantasyShopType, "weapons" | "armor">,
): FinalFantasyMagicDefinition {
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
