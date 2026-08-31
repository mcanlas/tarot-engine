import { parse } from "yaml"

export const townsYamlFile = "data/final-fantasy/towns.yaml"

export type ShopType =
  | "weapons"
  | "armor"
  | "white-magic"
  | "black-magic"

export interface ShopDefinition {
  readonly type: ShopType
  readonly wares: readonly string[]
}

export interface TownDefinition {
  readonly key: string
  readonly name: string
  readonly shops: readonly ShopDefinition[]
}

export interface TownDefinitions {
  readonly towns: readonly TownDefinition[]
}

export type TownYamlTextLoader = (path: string) => Promise<string>

const shopTypes = new Set<ShopType>([
  "weapons",
  "armor",
  "white-magic",
  "black-magic",
])

export async function loadTowns(
  loadText: TownYamlTextLoader,
): Promise<TownDefinitions> {
  const text = await loadText(townsYamlFile)

  if (text.trim().length === 0) {
    throw new Error(`YAML data is empty: ${townsYamlFile}`)
  }

  try {

    return decodeTowns(parse(text))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid ${townsYamlFile}: ${message}`)
  }
}

export function decodeTowns(value: unknown): TownDefinitions {
  const document = requireRecord(value, "Final Fantasy towns")

  return {
    towns: requireArray(document.towns, "Final Fantasy towns.towns").map(decodeTown),
  }
}

function decodeTown(value: unknown, index: number): TownDefinition {
  const path = `Final Fantasy towns.towns[${index}]`
  const record = requireRecord(value, path)

  return {
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    shops: requireArray(record.shops, `${path}.shops`)
      .map((shop, shopIndex) => decodeShop(shop, `${path}.shops[${shopIndex}]`)),
  }
}

function decodeShop(value: unknown, path: string): ShopDefinition {
  const record = requireRecord(value, path)

  return {
    type: requireShopType(record.type, `${path}.type`),
    wares: requireArray(record.wares, `${path}.wares`)
      .map((ware, wareIndex) => requireString(ware, `${path}.wares[${wareIndex}]`)),
  }
}

function requireShopType(value: unknown, path: string): ShopType {
  const shopType = requireString(value, path)
  if (!shopTypes.has(shopType as ShopType)) {
    throw new Error(`${path} must be a known Final Fantasy shop type`)
  }

  return shopType as ShopType
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
