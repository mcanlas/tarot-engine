import {
  describeFinalFantasyStrategyCatalog,
} from "./final-fantasy-strategy-core.ts"

const status = document.querySelector<HTMLElement>("[data-strategy-status]")

if (status !== null) {
  status.textContent = describeFinalFantasyStrategyCatalog()
  status.dataset.typescript = "ready"
}
