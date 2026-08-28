# Final Fantasy boss strategy guide

The console app lives in `com.htmlism.tarotengine.finalfantasy.vibe`. It loads its classes, spells, chronological boss list, enemy tags, boss groups, and ordered boss-strategy rules from the `data/final-fantasy-*.yaml` catalogs.

## Current state

- The boss catalog covers 18 encounters from Garland through Chaos, including explicit `(rematch)` designations for the four past Fiends.
- Six required promotion records produce 12 catalog jobs: the six starting classes plus Knight, Ninja, Master, Red Wizard, White Wizard, and Black Wizard.
- Promoting a `PartyMember` preserves learned spells, and every spell validates its `learnableBy` class IDs against the expanded catalog.
- The spell catalog contains 22 spells. Its later-game boss-strategy vocabulary includes elemental nullification, instant-death protection and revival, party-wide defense and evasion, Flare, and Saber.
- The 66 rules in `data/final-fantasy-boss-strategy.yaml` render deterministically in YAML order across `Opening`, `PartyEdge`, and `Safety` sections. Advice reacts to the party's jobs, capabilities, learned spells, and shared Potions.
- Collection-backed query nodes retain their canonical `List`/`Set` constructors and also expose fluent varargs helpers such as `all`, `hasAnySpell`, `namedAny`, and `knowsAny`.
- Tests load the YAML catalogs, require non-empty advice for every configured boss, verify all promotion mappings, and exercise every added spell-rule family.

## Roadmap

These ideas are **not implemented**. The current engine renders every matching `BossStrategyRule` in declaration order.

Rank favors changes that can ship independently and noticeably improve the guide. `Deployment` measures how safely the idea can be introduced in a small iteration; `Contribution` estimates its effect on boss-strategy quality.

| Rank | Idea | Deployment | Contribution | Reminder |
| ---: | --- | :---: | :---: | --- |
| 1 | Rule identity, priority, and choice groups | +++ | +++ | Give each rule a stable ID. Within a named tactical choice, select the highest-priority eligible rule instead of rendering every alternative. |
| 2 | Combat phases | +++ | +++ | Order advice as preparation, opening, setup, main loop, recovery, and fallback rather than as a flat list of sections. |
| 3 | Resolution trace | +++ | ++ | Record why each rule was eligible, selected, or rejected. This makes increasingly dense rule sets explainable and testable. |
| 4 | Presentation budget | +++ | ++ | Resolve tactics first, then cap or summarize lower-value advice so a valid guide does not become an exhaustive wall of text. |
| 5 | Structured tactics | ++ | +++ | Have rules nominate actions such as `Cast(Silence, caster, boss)` rather than immediately producing prose; render text afterward. |
| 6 | Actor and target assignment | ++ | +++ | Select a concrete caster, attacker, buff target, and backup instead of naming every member who technically qualifies. |
| 7 | Ranked capabilities | ++ | +++ | Replace boolean capabilities with deterministic scores so the engine can distinguish stronger attackers, healers, and controllers. |
| 8 | Action-economy conflicts | + | +++ | Detect when one member is assigned several opening actions and compare setup cost with likely fight length. |
| 9 | Threat and counter model | + | +++ | Describe boss threats independently, then rank party tactics by how well they counter instant death, crowds, physical bursts, statuses, and similar concerns. |
| 10 | Explicit fallback branches | + | +++ | Render deterministic plans such as “cast Silence; if it misses, use Haste and rush” instead of discarding every lower-ranked option. |

## Suggested first slice

Implement rank 1 for Astos: put Silence and Slow in one opening-disruption choice group, select Silence when both are available, and preserve stable deterministic ordering. Add the resolution trace at the same boundary if it stays small.
