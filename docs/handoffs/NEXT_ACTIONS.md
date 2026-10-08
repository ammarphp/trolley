# Resume here

Read the [current status](../plan/IMPLEMENTATION_STATUS.md) and [ADR 006](../decisions/006-ink-world-overhaul.md). Owner-review audits and mockups stay local and Git-ignored.

The bank has 154 reviewed nodes, seven stages and eight ending families. Content hashes are pinned; never silently replay a saved run against changed content.

## Priorities

1. **Write the scenarios.** The pipeline now renders any node: prose lives in the content bank, staging in `src/render/staging/`. New or rewritten prose creates a new content hash, so register the new bundle and keep the old ones for saved runs.
2. **Playtest with people.** Time real sessions, watch where readers stall, and check that the approach never feels like a deadline.
3. **Close device evidence.** Physical phones and low-end laptops, screen readers, 400% zoom, long runs and WebGL context loss.
4. **Tune the world.** Prop readability at the hold point, the density of lineside detail in late stages, and the rhythm of crossings and tunnels across a full run.
5. **Activate collection only as a separate verified deployment.** Public collection stays off until the service, retention, logging and withdrawal are verified.

## Commands

Use Node 24 and pnpm 11.19.

```sh
pnpm check                     # types, unit tests, build
pnpm test:browser              # browser suite on the ink renderer
node scripts/staging-check-1-2.mjs   # also -3-4 and -5-7
node scripts/audio-check.mjs
node scripts/capture.mjs --motion --out test-results/capture
node scripts/perf.mjs --decisions 8
pnpm inspect:content
pnpm collector:build
```
