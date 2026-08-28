import {
  describeFinalFantasyStrategyCatalog,
} from "./final-fantasy-strategy-core.js"

const status = document.querySelector<HTMLElement>("[data-strategy-status]")

if (status !== null) {
  status.textContent = describeFinalFantasyStrategyCatalog()
  status.dataset.typescript = "ready"
}
