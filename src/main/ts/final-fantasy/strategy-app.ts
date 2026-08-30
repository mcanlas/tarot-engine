import {
  FinalFantasyPartyStrategyEngine,
  type PartyObservation,
} from "./party-strategy-core.ts"
import {
  buildFinalFantasyStrategyEngine,
  createFullToolkitParty,
  type FinalFantasyStrategyEngine,
  type GuideSectionId,
  type Party,
} from "./strategy-core.ts"
import { decodeStrategyPayload } from "./strategy-json.ts"

const sectionLabels: Readonly<Record<GuideSectionId, string>> = {
  opening: "Opening",
  "party-edge": "Party edge",
  safety: "Safety",
}

const defaults = ["warrior", "thief", "white-mage", "black-mage"]

async function loadStrategy(): Promise<void> {
  const response = await fetch("/api/final-fantasy/strategy")
  if (!response.ok) {
    throw new Error(`Strategy request failed with status ${response.status}`)
  }

  const payload = decodeStrategyPayload(await response.json())
  const bossEngine = buildFinalFantasyStrategyEngine(payload.definitions)
  const partyEngine = new FinalFantasyPartyStrategyEngine(bossEngine.catalog, payload.partyRules)
  const controls = requireElement<HTMLFormElement>("#strategy-controls")
  const selects = [...controls.querySelectorAll<HTMLSelectElement>("[data-party-slot]")]
  const bossSelect = requireElement<HTMLSelectElement>("[data-boss-select]")

  populatePartySelects(selects, bossEngine)
  populateBossSelect(bossSelect, bossEngine)

  const render = (): void => {
    const classIds = selects.map((select) => select.value)
    const party = createFullToolkitParty(bossEngine.catalog, classIds)
    const profile = partyEngine.analyze(classIds)

    selects.forEach(updateSelectTheme)
    renderPartySignature(party)
    renderObservations(profile.observations)
    renderBossGuide(party, bossSelect.value, bossEngine)
  }

  controls.addEventListener("change", render)
  bossSelect.addEventListener("change", render)
  render()

  const status = requireElement<HTMLElement>("[data-strategy-status]")
  status.textContent = "Strategy updates automatically when the party or boss changes."
  status.dataset.typescript = "ready"
}

function populatePartySelects(
  selects: readonly HTMLSelectElement[],
  engine: FinalFantasyStrategyEngine,
): void {
  const jobs = [...engine.catalog.jobs.values()].filter((job) => job.promotion !== undefined)

  selects.forEach((select, index) => {
    select.replaceChildren(...jobs.map((job) => option(job.id, job.name)))
    select.value = defaults[index] ?? jobs[0]?.id ?? ""
  })
}

function populateBossSelect(select: HTMLSelectElement, engine: FinalFantasyStrategyEngine): void {
  select.replaceChildren(...engine.bosses.map((boss) => option(boss.key, boss.name)))
}

function renderPartySignature(party: Party): void {
  const container = requireElement<HTMLElement>("[data-party-signature]")
  const label = document.createElement("span")
  label.className = "signature-label"
  label.textContent = "Current lineup"
  const members = party.members.map((member, index) => {
    const badge = document.createElement("span")
    badge.className = `job-badge job-${member.job.id}`
    badge.textContent = `${index + 1}. ${member.job.name}`

    return badge
  })

  container.replaceChildren(label, ...members)
}

function renderObservations(observations: readonly PartyObservation[]): void {
  renderObservationList("strength", observations, "[data-party-strengths]", "[data-strength-count]")
  renderObservationList("weakness", observations, "[data-party-weaknesses]", "[data-weakness-count]")
}

function renderObservationList(
  kind: PartyObservation["kind"],
  observations: readonly PartyObservation[],
  listSelector: string,
  countSelector: string,
): void {
  const matching = observations.filter((observation) => observation.kind === kind)
  const list = requireElement<HTMLUListElement>(listSelector)
  const count = requireElement<HTMLElement>(countSelector)

  list.replaceChildren(...matching.map((observation) => {
    const item = document.createElement("li")
    const marker = document.createElement("span")
    marker.className = "advice-marker"
    marker.setAttribute("aria-hidden", "true")
    const statement = document.createElement("span")
    statement.textContent = observation.statement
    item.append(marker, statement)

    return item
  }))
  count.textContent = String(matching.length)
}

function renderBossGuide(
  party: Party,
  bossKey: string,
  engine: FinalFantasyStrategyEngine,
): void {
  const guide = engine.guideFor(party, bossKey)
  const boss = engine.bosses.find((candidate) => candidate.key === bossKey)
  const name = requireElement<HTMLElement>("[data-boss-name]")
  const count = requireElement<HTMLElement>("[data-boss-rule-count]")
  const advice = requireElement<HTMLElement>("[data-boss-advice]")

  name.textContent = boss?.name ?? guide.boss
  count.textContent = `${guide.fragments.length} active ${guide.fragments.length === 1 ? "rule" : "rules"}`

  const sections: GuideSectionId[] = ["opening", "party-edge", "safety"]
  const cards = sections.flatMap((section) => {
    const fragments = guide.fragments.filter((fragment) => fragment.section === section)
    if (fragments.length === 0) {
      return []
    }

    const card = document.createElement("article")
    card.className = `boss-advice-card boss-advice-${section}`
    const heading = document.createElement("div")
    heading.className = "boss-advice-heading"
    const badge = document.createElement("span")
    badge.className = "section-badge"
    badge.textContent = sectionLabels[section]
    const ruleCount = document.createElement("span")
    ruleCount.className = "section-rule-count"
    ruleCount.textContent = String(fragments.length).padStart(2, "0")
    heading.append(badge, ruleCount)
    const list = document.createElement("ol")
    list.className = "boss-rule-list"
    list.append(...fragments.map((fragment) => {
      const item = document.createElement("li")
      item.textContent = fragment.advice

      return item
    }))
    card.append(heading, list)

    return [card]
  })

  advice.replaceChildren(...cards)
}

function updateSelectTheme(select: HTMLSelectElement): void {
  select.className = `job-select job-${select.value}`
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement("option")
  element.value = value
  element.textContent = label

  return element
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) {
    throw new Error(`Missing strategy element: ${selector}`)
  }

  return element
}

loadStrategy().catch((error: unknown) => {
  const status = document.querySelector<HTMLElement>("[data-strategy-status]")
  if (status !== null) {
    status.textContent = error instanceof Error ? error.message : "The strategy data could not be loaded."
    status.dataset.typescript = "error"
  }
})
