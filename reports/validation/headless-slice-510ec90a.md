# Headless slice validation

Status: G2 development-slice evidence for the revised narrative. This is not approval of the full campaign, revised visual experience or publication release.

The [JSON report](headless-slice.json) records exact commands, source-file digests, counts and seed/input/final-hash witnesses. Content hash: `510ec90a46d1e15c0d0a77ce5386e3951460bbff70d5d137538e3246b23a1649`. Manifest hash: `7951ee7818c9e965fa5dc1a4c7b1a412e4abe503a0d2d0594bd867d59c600ffd`.

## Current content and archive

The [structured comparison](content-revision.json) finds **120 changed prose leaves, three exact reviewed claim-set changes, and zero mechanical changes** against the archived bundle. Prompts can still change interpretation; this does not substitute for narrative or source review. News and consequence text participate in state/journal hashes, so the new witnesses were actually rerun.

The original `8ac27217` bundle remains available through exact registry lookup. Its saved browser artifact replays to the identical complete campaign via [the CLI check](archive-replay-check.json). A [fresh synthetic current-content artifact](replays/registry-current-synthetic.json) also passes [CLI replay](current-replay-check.json). Unknown hashes reject, returned bundles are isolated from caller mutation, and lookup never bypasses manifest/edition validation. Historical headless results are preserved [separately](headless-slice-8ac27217.md).

## Mechanical route probe

Command: `node scripts/simulation.mjs --runs 10000 --policy enumerate --seed eight-endings`.

**10,000 runs, 130,670 commits, 0 errors**, with 10–14 decisions per run. Endings: restraint: 2,432; remnant: 2,832; accountable: 384; tutelage: 1,088; recovery: 411; extinction: 185; succession: 2,092; containment: 576.

This covers the first 10,000 fourteen-bit input patterns, each with a distinct seed. Early endings leave unused bits. It does not exhaust stochastic outcomes.

## Eight policy probes

Each command is `node scripts/simulation.mjs --runs 125 --policy NAME --seed policy-NAME`. The [CLI](../../scripts/simulation.mjs) and JSON record explicit semantic choices and descriptions.

| Policy | Completed runs | Endings | Errors |
| --- | ---: | --- | ---: |
| cautious | 125 | restraint: 125 | 0 |
| race | 125 | recovery: 95; extinction: 30 | 0 |
| benefits | 125 | accountable: 125 | 0 |
| recovery | 125 | recovery: 106; extinction: 19 | 0 |
| dependence | 125 | remnant: 125 | 0 |
| tutelage | 125 | tutelage: 125 | 0 |
| containment | 125 | containment: 125 | 0 |
| succession | 125 | succession: 125 | 0 |

These add **1,000 runs**. The benefits policy preserves useful bounded AI and accountable institutions. Recovery follows a real crisis-exposed route into devastated survival if the terminal incident does not occur. Policy seeds differ, so the observed race/recovery frequency difference is not a causal policy-effect estimate. Dependence, tutelage, containment and succession expose different distributions of authority.

All **18 saved witnesses** across enumeration and policy reports were independently reconstructed against the current bundle. Every ending and final state hash matched; report count totals were checked.

## Tests

`node --test tests/v2/engine.test.ts tests/v2/golden-fixtures.test.ts` passed **29/29**. `node scripts/test-v2.mjs` automatically discovered the new registry tests and passed **79/79**. Full TypeScript checking passed. Actual command output is retained in [engine/golden results](engine-golden-tests.txt) and [integration results](v2-integration-tests.txt).

Manual recovery still requires staff, a recorded drill and no lost-fallback fact. Accountable continuity requires records and a trained successor. Ratification after loss of government transfers the remaining recovery office without fabricating a second takeover. A locally executable signature does not establish political freedom.

## Limits

These are authored-model audits, not real AI-risk estimates or human-response statistics. [F01–F16 coverage](fixture-coverage.md) retains full-model gaps. Primitive tests do not implement named victims, institutional lifecycles, evidence artifacts, one-action grants, credentials, scoped evaluations or distinct successor identities. CR003 remains a proposal.

The full 154-candidate inventory, 27–43-choice story, 30–45-minute duration, redesigned browser/accessibility experience, collection deployment and production readiness are not certified. No public collector was used. Rerun when content or transition semantics change; never relabel historical results as a new bundle's evidence.
