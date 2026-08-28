# tarot-engine

Small deterministic tools and strategy experiments for classic RPGs

## Contents

- [Web apps](#web-apps)
  - [Final Fantasy party generator](#final-fantasy-party-generator)
  - [Final Fantasy VI roster](#final-fantasy-vi-roster)
  - [Chrono Trigger quest randomizer](#chrono-trigger-quest-randomizer)
- [Console apps](#console-apps)
  - [Final Fantasy strategy guide](#final-fantasy-strategy-guide)
- [Run locally](#run-locally)

## Web apps

### Final Fantasy party generator

[`/final-fantasy`](http://localhost:8083/final-fantasy) generates parties of one to four characters from the six original classes. Controls switch between unique combinations and all ordered formations, with optional required-class filters.

### Final Fantasy VI roster

[`/final-fantasy-vi`](http://localhost:8083/final-fantasy-vi) presents the canonical 14-character playable roster as a themed character grid.

### Chrono Trigger quest randomizer

[`/chrono-trigger`](http://localhost:8083/chrono-trigger) simulates chapter progression, roster changes, randomized side-quest parties, boolean story flags, and base or secret triple-tech designations.

## Console apps

### Final Fantasy strategy guide

The Final Fantasy strategy guide generates deterministic, party-specific advice across 18 boss encounters. Its YAML-backed catalog models six starting classes and their required promotions, 22 spells, learned-spell permissions, shared items, and rules for offense, recovery, buffs, resistances, and rematches.

## Run locally

Install the browser build tools after checkout or lockfile changes:

```bash
npm ci
```

Scala compilation, tests, and staging compile TypeScript automatically

Start the web service:

```bash
sbt stage && ./target/universal/stage/bin/tarot-engine
```

The service starts on [http://localhost:8083](http://localhost:8083)

Run the console strategy guide:

```bash
sbt "runMain com.htmlism.tarotengine.finalfantasy.vibe.VibeApp"
```

Run the test suite:

```bash
npm run test:js
sbt testQuick
```
