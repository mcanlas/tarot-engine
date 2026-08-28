import {
  loadFinalFantasyStrategyData,
  type FinalFantasyStrategyData,
  type YamlTextLoader,
} from "./final-fantasy-strategy-core.js"

export function startFinalFantasyStrategyApp(
  loadText: YamlTextLoader,
): Promise<FinalFantasyStrategyData> {
  return loadFinalFantasyStrategyData(loadText)
}
