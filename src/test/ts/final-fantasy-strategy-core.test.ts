import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildFinalFantasyStrategyEngine,
  canUseItem,
  createParty,
  createPartyMember,
  describeFinalFantasyStrategyCatalog,
  partyLabel,
  promotePartyMember,
} from "../../main/ts/final-fantasy-strategy-core.ts"
import {
  loadFinalFantasyStrategyDefinitions,
  loadFinalFantasyStrategyEngine,
} from "../../main/ts/final-fantasy-strategy-data.ts"

const loadProjectFile = (path: string): Promise<string> =>
  readFile(new URL(`../../../${path}`, import.meta.url), "utf8")

const definitions = await loadFinalFantasyStrategyDefinitions(loadProjectFile)
const engine = await loadFinalFantasyStrategyEngine(loadProjectFile)
const member = (job: string, ...spells: string[]) =>
  createPartyMember(engine.catalog, job, spells)
const party = (
  members: ReturnType<typeof member>[],
  inventory: "potion"[] = [],
) => createParty(members, inventory)
const adviceFor = (
  boss: string,
  members: ReturnType<typeof member>[],
  inventory: "potion"[] = [],
) => engine.guideFor(party(members, inventory), boss).fragments.map((fragment) => fragment.advice)

test("loads and validates the complete YAML strategy catalog", () => {
  assert.equal(engine.catalog.jobs.size, 12)
  assert.equal(engine.catalog.spells.size, 22)
  assert.equal(engine.bosses.length, 18)
  assert.equal(engine.ruleCount, 66)
  assert.deepEqual(
    engine.bosses.filter((boss) => boss.tags.includes("undead")).map((boss) => boss.boss),
    ["vampire", "lich"],
  )
  assert.equal(
    describeFinalFantasyStrategyCatalog(),
    "TypeScript connected; 4 YAML catalogs configured.",
  )
})

test("catalog metadata owns capabilities, spell permissions, and every promotion", () => {
  const redMage = engine.catalog.jobs.get("red-mage")
  const cure = engine.catalog.spells.get("cure")

  assert.equal(redMage?.name, "Red Mage")
  assert.equal(redMage?.plural, "Red Mages")
  assert(redMage?.capabilities.has("physical-damage"))
  assert.deepEqual(
    [...(cure?.learnableBy ?? [])],
    ["white-mage", "red-mage", "knight", "white-wizard", "red-wizard"],
  )
  assert(cure?.attributes.has("healing"))
  assert.deepEqual(
    ["warrior", "thief", "monk", "red-mage", "white-mage", "black-mage"]
      .map((id) => engine.catalog.jobs.get(id)?.promotion),
    ["knight", "ninja", "master", "red-wizard", "white-wizard", "black-wizard"],
  )
})

test("promotion preserves learned spells and is idempotent", () => {
  const whiteMage = member("white-mage", "cure", "dia")
  const whiteWizard = promotePartyMember(engine.catalog, whiteMage)

  assert.equal(whiteWizard.job.id, "white-wizard")
  assert.deepEqual([...whiteWizard.learnedSpells].map((spell) => spell.id), ["cure", "dia"])
  assert.equal(promotePartyMember(engine.catalog, whiteWizard), whiteWizard)
})

test("party construction rejects unknown jobs, spells, and illegal learning", () => {
  assert.throws(() => member("mime"), /Unknown Final Fantasy class: mime/)
  assert.throws(() => member("warrior", "ultima"), /Unknown Final Fantasy spell: ultima/)
  assert.throws(() => member("warrior", "cure"), /Warrior cannot learn: Cure/)
})

test("spell permissions cover overlapping and promotion-specific spellbooks", () => {
  assert.doesNotThrow(() => member(
    "red-mage",
    "cure",
    "fire",
    "blizzard",
    "thunder",
    "sleep",
    "protect",
    "silence",
    "temper",
    "haste",
    "slow",
  ))
  assert.doesNotThrow(() => member("knight", "nulshock", "nulblaze"))
  assert.doesNotThrow(() => member("black-wizard", "flare", "saber"))
  assert.throws(() => member("knight", "nulfrost"), /Knight cannot learn: NulFrost/)
  assert.throws(() => member("black-mage", "flare"), /Black Mage cannot learn: Flare/)
})

test("party labels sort learned spells and shared items belong to the party", () => {
  const warrior = member("warrior")
  const mage = member("red-mage", "fire", "cure")
  const group = party([warrior, mage], ["potion"])

  assert.equal(partyLabel(group), "Warrior / Red Mage [Cure, Fire]")
  assert(canUseItem(group, warrior, "potion"))
  assert(canUseItem(group, mage, "potion"))
  assert(!canUseItem(group, member("thief"), "potion"))
})

test("Garland advice follows YAML order and learned capabilities", () => {
  const trained = engine.guideFor(party([
    member("warrior"),
    member("thief"),
    member("white-mage", "cure"),
    member("black-mage", "thunder"),
  ]), "GARLAND")

  assert.equal(trained.boss, "garland")
  assert.deepEqual(trained.fragments.map((fragment) => fragment.section), ["opening", "party-edge", "safety"])
  assert(trained.fragments.some((fragment) => fragment.advice.includes("Black Mage spend MP")))
  assert(trained.fragments.some((fragment) => fragment.advice.includes("Keep the White Mage attacking")))

  const untrained = adviceFor("garland", [
    member("warrior"), member("thief"), member("white-mage"), member("black-mage"),
  ])
  assert(untrained.some((advice) => advice.includes("no in-party healing")))
  assert(!untrained.some((advice) => advice.includes("elemental spell") || advice.includes("recovery spell")))
})

test("conditions compose counts, spell attributes, items, and negation", () => {
  const withoutPotion = adviceFor("garland", [member("thief"), member("monk")])
  const withPotion = adviceFor("garland", [member("warrior"), member("warrior"), member("black-mage")], ["potion"])

  assert(withoutPotion.some((advice) => advice.includes("damage race")))
  assert(withPotion.some((advice) => advice.includes("both Warriors and the Black Mage can use Potions")))
  assert(!withPotion.some((advice) => advice.includes("no in-party healing")))
})

test("spell templates name all contributing classes and respect learned spells", () => {
  const advice = adviceFor("pirates", [
    member("warrior"), member("red-mage", "sleep"), member("black-mage", "sleep"),
  ])
  const untrained = adviceFor("pirates", [member("warrior"), member("black-mage")])

  assert(advice.some((line) => line.includes("the Red Mage and the Black Mage cast Sleep")))
  assert(!untrained.some((line) => line.includes("cast Sleep") || line.includes("elemental magic")))
})

test("preferred attacker selection uses catalog priority", () => {
  const advice = adviceFor("piscodemons", [
    member("monk"), member("warrior"), member("black-mage", "temper", "haste"),
  ])

  assert(advice.some((line) => line.includes("Black Mage cast Temper")))
  assert(advice.some((line) => line.includes("Black Mage cast Haste on the Warrior")))
})

test("Astos uses Silence when learned and Slow only as a fallback", () => {
  const silence = adviceFor("astos", [member("warrior"), member("white-mage", "silence"), member("black-mage", "slow")])
  const slow = adviceFor("astos", [member("warrior"), member("red-mage", "slow")])

  assert(silence.some((line) => line.includes("White Mage cast Silence immediately")))
  assert(!silence.some((line) => line.includes("try Slow")))
  assert(slow.some((line) => line.includes("Red Mage try Slow")))
})

test("enemy tags share undead rules without inventing unlearned spells", () => {
  const trained = [member("warrior"), member("white-mage", "dia"), member("black-mage", "fire")]
  const vampire = adviceFor("vampire", trained)
  const lich = adviceFor("lich", trained)
  const noFire = adviceFor("vampire", [member("black-mage", "blizzard")])

  assert(vampire.some((line) => line.includes("Vampire is undead") && line.includes("cast Fire")))
  assert(lich.some((line) => line.includes("Lich is undead") && line.includes("cast Dia")))
  assert(!noFire.some((line) => line.includes("cast Fire")))
})

test("Lich combines spell-specific defenses with its no-healer fallback", () => {
  const defended = adviceFor("lich", [member("white-mage", "protect", "blink")])
  const damageRace = adviceFor("lich", [
    member("thief"), member("thief"), member("monk"), member("monk"),
  ])

  assert(defended.some((line) => line.includes("White Mage cast Protect")))
  assert(defended.some((line) => line.includes("White Mage cast Blink")))
  assert(damageRace.some((line) => line.includes("strict damage race")))
  assert(!damageRace.some((line) => line.includes("reserve enough healing")))
})

test("boss-specific, group, and rematch rules stay distinct", () => {
  const members = [
    member("warrior"),
    member("white-mage", "cure", "dia", "protect"),
    member("black-mage", "fire", "thunder", "haste", "temper"),
  ]

  assert(adviceFor("dragon zombies", members).some((line) => line.includes("cast Dia into the undead pair")))
  assert(adviceFor("kraken", members).some((line) => line.includes("lightning weakness")))
  assert(adviceFor("kraken (rematch)", members).some((line) => line.includes("lightning weakness is gone")))
  assert(adviceFor("chaos", members).some((line) => line.includes("cast Haste on the Warrior")))
})

test("promoted casters activate every late-game rule family", () => {
  const members = [
    member("knight", "cure", "protect", "nulshock", "nulblaze"),
    member("ninja", "haste", "temper"),
    member("white-wizard", "cure", "nulfrost", "nuldeath", "protera", "invisira", "life"),
    member("black-wizard", "flare", "saber"),
  ]
  const marilith = adviceFor("marilith", members)
  const tiamat = adviceFor("tiamat", members)
  const astos = adviceFor("astos", members)

  for (const phrase of ["cast NulBlaze", "cast Protera", "cast Invisira"]) {
    assert(marilith.some((line) => line.includes(phrase)), phrase)
  }
  for (const phrase of ["cast NulShock", "cast NulFrost", "use Flare", "cast Saber on themselves"]) {
    assert(tiamat.some((line) => line.includes(phrase)), phrase)
  }
  assert(astos.some((line) => line.includes("cast NulDeath")))
  assert(astos.some((line) => line.includes("reserve a Life charge")))
})

test("every configured boss has deterministic baseline coverage", () => {
  const baseline = party([
    member("warrior"), member("thief"), member("white-mage"), member("black-mage"),
  ])

  for (const definition of engine.bosses) {
    const first = engine.guideFor(baseline, definition.boss)
    const second = engine.guideFor(baseline, definition.boss)
    assert(first.fragments.length > 0, definition.boss)
    assert.deepEqual(first, second)
  }
  assert.deepEqual(engine.guideFor(baseline, "missing boss").fragments, [])
})

test("catalog validation rejects duplicate IDs and dangling references", () => {
  const duplicateClass = structuredClone(definitions)
  duplicateClass.classes[1]!.class = duplicateClass.classes[0]!.class
  assert.throws(() => buildFinalFantasyStrategyEngine(duplicateClass), /Duplicate class ids/)

  const danglingSpell = structuredClone(definitions)
  danglingSpell.spells[0]!.learnableBy.push("mime")
  assert.throws(() => buildFinalFantasyStrategyEngine(danglingSpell), /references unknown classes: mime/)

  const danglingGroup = structuredClone(definitions)
  danglingGroup.strategy.bossGroups.invalid = ["missing boss"]
  assert.throws(() => buildFinalFantasyStrategyEngine(danglingGroup), /reference unknown bosses/)
})

test("rule validation rejects malformed targeting, conditions, sections, and templates", () => {
  const malformedTarget = structuredClone(definitions)
  malformedTarget.strategy.rules[0]!.bossGroup = "physical-buff"
  assert.throws(() => buildFinalFantasyStrategyEngine(malformedTarget), /exactly one of boss/)

  const invalidCount = structuredClone(definitions)
  invalidCount.strategy.rules[1]!.when = { capability: "physical-damage", atLeast: 0 }
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidCount), /positive integer/)

  const invalidSection = structuredClone(definitions)
  invalidSection.strategy.rules[0]!.section = "victory"
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidSection), /Unknown guide section/)

  const invalidToken = structuredClone(definitions)
  invalidToken.strategy.rules[0]!.advice = "Use {{members:telepathy}}"
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidToken), /Unknown member selector/)
})

test("closed vocabularies reject unknown attributes, tags, spells, and bosses", () => {
  const invalidCapability = structuredClone(definitions)
  invalidCapability.classes[0]!.attributes = ["luck"]
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidCapability), /Unknown class attribute: luck/)

  const invalidSpellAttribute = structuredClone(definitions)
  invalidSpellAttribute.spells[0]!.attributes = ["holy"]
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidSpellAttribute), /Unknown spell attribute: holy/)

  const invalidTag = structuredClone(definitions)
  invalidTag.bosses[0]!.tags = ["dragon"]
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidTag), /Unknown enemy tag: dragon/)

  const invalidSpell = structuredClone(definitions)
  invalidSpell.strategy.rules[0]!.when = { spell: "ultima" }
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidSpell), /Unknown rule spell: ultima/)

  const invalidBoss = structuredClone(definitions)
  invalidBoss.strategy.rules[0]!.boss = "missing boss"
  assert.throws(() => buildFinalFantasyStrategyEngine(invalidBoss), /Unknown rule boss: missing boss/)
})

test("YAML decoding reports empty, malformed, and structurally invalid documents", async () => {
  await assert.rejects(
    loadFinalFantasyStrategyEngine(async (path) => path.endsWith("classes.yaml") ? "" : loadProjectFile(path)),
    /YAML data is empty/,
  )
  await assert.rejects(
    loadFinalFantasyStrategyEngine(async (path) => path.endsWith("classes.yaml") ? "[unterminated" : loadProjectFile(path)),
    /Invalid data\/final-fantasy-classes.yaml/,
  )
  await assert.rejects(
    loadFinalFantasyStrategyEngine(async (path) => path.endsWith("classes.yaml") ? "classes: nope" : loadProjectFile(path)),
    /classes must be an array/,
  )
})
