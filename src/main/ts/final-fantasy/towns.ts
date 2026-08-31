import { parse } from "yaml"

export const finalFantasyTownsYamlFile = "data/final-fantasy/towns.yaml"

export type FinalFantasyShopType =
  | "weapons"
  | "armor"
  | "white-magic"
  | "black-magic"

export interface FinalFantasyShopWareDefinition {
  readonly key: string
  readonly name: string
  readonly price: number
}

export interface FinalFantasyShopDefinition {
  readonly type: FinalFantasyShopType
  readonly wares: readonly FinalFantasyShopWareDefinition[]
}

export interface FinalFantasyTownDefinition {
  readonly key: string
  readonly name: string
  readonly shops: readonly FinalFantasyShopDefinition[]
}

export interface FinalFantasyTownDefinitions {
  readonly towns: readonly FinalFantasyTownDefinition[]
}

export type FinalFantasyTownYamlTextLoader = (path: string) => Promise<string>

const shopTypes = new Set<FinalFantasyShopType>([
  "weapons",
  "armor",
  "white-magic",
  "black-magic",
])

export async function loadFinalFantasyTowns(
  loadText: FinalFantasyTownYamlTextLoader,
): Promise<FinalFantasyTownDefinitions> {
  const text = await loadText(finalFantasyTownsYamlFile)

  if (text.trim().length === 0) {
    throw new Error(`YAML data is empty: ${finalFantasyTownsYamlFile}`)
  }

  try {

    return decodeFinalFantasyTowns(parse(text))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid ${finalFantasyTownsYamlFile}: ${message}`)
  }
}

export function decodeFinalFantasyTowns(value: unknown): FinalFantasyTownDefinitions {
  const document = requireRecord(value, "Final Fantasy towns")

  return {
    towns: requireArray(document.towns, "Final Fantasy towns.towns").map(decodeTown),
  }
}

function decodeTown(value: unknown, index: number): FinalFantasyTownDefinition {
  const path = `Final Fantasy towns.towns[${index}]`
  const record = requireRecord(value, path)

  return {
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    shops: requireArray(record.shops, `${path}.shops`)
      .map((shop, shopIndex) => decodeShop(shop, `${path}.shops[${shopIndex}]`)),
  }
}

function decodeShop(value: unknown, path: string): FinalFantasyShopDefinition {
  const record = requireRecord(value, path)

  return {
    type: requireShopType(record.type, `${path}.type`),
    wares: requireArray(record.wares, `${path}.wares`)
      .map((ware, wareIndex) => decodeWare(ware, `${path}.wares[${wareIndex}]`)),
  }
}

function decodeWare(value: unknown, path: string): FinalFantasyShopWareDefinition {
  const record = requireRecord(value, path)

  return {
    key: requireString(record.key, `${path}.key`),
    name: requireString(record.name, `${path}.name`),
    price: requireNonNegativeInteger(record.price, `${path}.price`),
  }
}

function requireShopType(value: unknown, path: string): FinalFantasyShopType {
  const shopType = requireString(value, path)
  if (!shopTypes.has(shopType as FinalFantasyShopType)) {
    throw new Error(`${path} must be a known Final Fantasy shop type`)
  }

  return shopType as FinalFantasyShopType
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

function requireNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer`)
  }

  return value
}
