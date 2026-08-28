# TODO

## Final Fantasy strategy

The current engine renders every matching strategy rule in declaration order. The following ideas are not implemented.

Rank favors changes that can ship independently and noticeably improve the guide. `Deployment` measures how safely the idea can be introduced in a small iteration; `Contribution` estimates its effect on strategy quality.

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

### Suggested first slice

Implement rank 1 for Astos: put Silence and Slow in one opening-disruption choice group, select Silence when both are available, and preserve stable deterministic ordering. Add the resolution trace at the same boundary if it stays small.
