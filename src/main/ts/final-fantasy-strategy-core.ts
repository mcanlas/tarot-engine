export const finalFantasyStrategyYamlFiles = Object.freeze({
  classes: "data/final-fantasy-classes.yaml",
  spells: "data/final-fantasy-spells.yaml",
  bosses: "data/final-fantasy-bosses.yaml",
  bossStrategy: "data/final-fantasy-boss-strategy.yaml",
})

export type YamlTextLoader = (path: string) => Promise<string>

export interface YamlDocument {
  path: string
  text: string
}

export interface FinalFantasyStrategyData {
  classes: YamlDocument
  spells: YamlDocument
  bosses: YamlDocument
  bossStrategy: YamlDocument
}

export function describeFinalFantasyStrategyCatalog(): string {
  const catalogCount = Object.keys(finalFantasyStrategyYamlFiles).length

  return `TypeScript connected; ${catalogCount} YAML catalogs configured.`
}

async function loadYamlDocument(
  path: string,
  loadText: YamlTextLoader,
): Promise<YamlDocument> {
  const text = await loadText(path)

  if (text.trim().length === 0) {
    throw new Error(`YAML data is empty: ${path}`)
  }

  return { path, text }
}

export async function loadFinalFantasyStrategyData(
  loadText: YamlTextLoader,
): Promise<FinalFantasyStrategyData> {
  const [classes, spells, bosses, bossStrategy] = await Promise.all([
    loadYamlDocument(finalFantasyStrategyYamlFiles.classes, loadText),
    loadYamlDocument(finalFantasyStrategyYamlFiles.spells, loadText),
    loadYamlDocument(finalFantasyStrategyYamlFiles.bosses, loadText),
    loadYamlDocument(finalFantasyStrategyYamlFiles.bossStrategy, loadText),
  ])

  return { classes, spells, bosses, bossStrategy }
}
