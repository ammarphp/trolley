# Historical validation: archived 8ac27217 bundle

These results belong to the archived content bundle. They do not certify the revised narrative. The original report follows.

# Headless slice validation

Status: G2 development slice evidence, following the final authority and predicate corrections. This is not approval of the full campaign or publication release.

The [JSON report](headless-slice-8ac27217.json) contains the exact command, counts and complete seed/input/final-hash witnesses. Content hash: `8ac27217117bf5b4394d5cfe2ffcf15309e50ae2a1a0880d26c610c9af94a614`.

All 18 saved witnesses across the mechanical and policy reports were independently replayed against the current bundle; every ending and final state hash matched. All reported count totals were checked.

## Mechanical route probe

Command: `node scripts/simulation.mjs --runs 10000 --policy enumerate --seed eight-endings`.

**10,000 runs, 130,670 commits, zero errors**, with 10–14 decisions per run. All eight families were reached: restraint 2,432; remnant 2,832; accountable continuity 384; tutelage 1,088; devastated survival 411; extinction 185; succession 2,092; human containment 576.

This covers the first 10,000 fourteen-bit input patterns, each with a distinct seed. Early endings leave unused bits. It does not exhaust stochastic outcomes. This fresh audit supersedes the prior bundle's report.

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

These add **1,000 runs**. The benefits policy preserves useful bounded AI and accountable institutions. The recovery policy follows a real crisis-exposed route into devastated survival when the terminal incident does not occur; it is not an optimal or guaranteed survival strategy. Its 106/19 split and the race policy's 95/30 split use different fixed seeds, so their difference is not a causal policy-effect estimate. Dependence exposes attempted manual recovery after fallback loss. Tutelage, containment and succession distinguish materially different distributions of power.

## Tests and authority corrections

`node --test tests/v2/engine.test.ts tests/v2/golden-fixtures.test.ts` passed **29 tests**: 18 engine and 11 supported semantic tests. They include eight actual-content ending witnesses and full replay, care-scope appointment, transfer versus ratification, immutable transitions, stale inputs, side semantics, observation boundaries, RNG isolation, delayed effects, grant lineage and casualty conservation.

Manual recovery requires staff, a recorded drill and no lost-fallback fact. Accountable continuity requires both public records and a trained successor. Ratifying existing AI government does not create a second takeover; it transfers the remaining recovery office and records acceptance of the already-existing government. A local signature can execute without override even when political control was already lost.

`node node_modules/typescript/bin/tsc --noEmit` exited successfully. The RNG golden vector was independently verified with Python hashlib. Persistence, rather than a pure deterministic transition function, owns atomic installation of a new revision.

## Limits

These are authored-model audits, not real AI-risk estimates or human-response statistics. [F01–F16 coverage](fixture-coverage.md) records the full-model gaps. Primitive tests do not implement named victims, institution lifecycles, evidence artifacts, one-action grants, credentials, scoped evaluations or distinct successor identities. The full 154-candidate inventory, 27–43-choice story, 30–45-minute duration, collection deployment and production readiness are not certified. See [SEMANTICS](../../docs/architecture/SEMANTICS.md) for CR001 and deferred contracts.

Rerun when content or transition semantics change. Never relabel historical output as results from a newer bundle.
