# tarot-engine

Small deterministic tools and strategy experiments for classic RPGs

## Contents

- [Web apps](#web-apps)
  - [Final Fantasy party generator](#final-fantasy-party-generator)
  - [Final Fantasy dynamic strategy](#final-fantasy-dynamic-strategy)
  - [Final Fantasy VI roster](#final-fantasy-vi-roster)
  - [Chrono Trigger quest randomizer](#chrono-trigger-quest-randomizer)
- [Project planning](#project-planning)
- [Run locally](#run-locally)

## Web apps

### Final Fantasy party generator

[`/final-fantasy`](http://localhost:8083/final-fantasy) generates parties of one to four characters from the six original classes. Controls switch between unique combinations and all ordered formations, with optional required-class filters.

### Final Fantasy dynamic strategy

[`/final-fantasy/dynamic-strategy`](http://localhost:8083/final-fantasy/dynamic-strategy) mounts the TypeScript browser entry point for the YAML-backed, party-specific strategy engine. The page is intentionally a nominal UI while the engine and its validation live in independently tested TypeScript modules.

### Final Fantasy VI roster

[`/final-fantasy-vi`](http://localhost:8083/final-fantasy-vi) presents the canonical 14-character playable roster as a themed character grid.

### Chrono Trigger quest randomizer

[`/chrono-trigger`](http://localhost:8083/chrono-trigger) simulates chapter progression, roster changes, randomized side-quest parties, boolean story flags, and base or secret triple-tech designations.

## Project planning

See the [Final Fantasy strategy roadmap](TODO.md#final-fantasy-strategy).

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

Run the test suite:

```bash
npm run test:js
sbt test
```
