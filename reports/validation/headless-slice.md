# Headless slice validation

Status: G2 development-slice evidence for the corrected receipt edition. This is not approval of the full campaign, revised visual experience or publication release.

The [JSON report](headless-slice.json) records exact commands, source digests, counts and seed/input/final-hash witnesses. Current content hash: `f42837ffe56285a23baf113d82e3867db2d74799fb6049515071731d0df9eb16`. Historical full-audit content hash: `89f849e23d76ae1e921ecae5f9a3c850d82f5414f6af55ffd46c1ccd6c93ba87`. Manifest hash: `7951ee7818c9e965fa5dc1a4c7b1a412e4abe503a0d2d0594bd867d59c600ffd`.

## Current content and archives

The [structured comparison](content-revision.json) proves one change: the S6-10 executed-continue receipt now begins “The schedule keeps running.” This avoids assigning consent when the player requested a stop and was overridden. Every other manifest/node field is identical, including all effect parameters and conditional-receipt predicates. The [equivalence record](receipt-equivalence.json) pins the exact old/new text, canonical whole-bundle comparison and unchanged transition/RNG/CLI source digests.

The current edition is mechanically bound to the **actually executed 89f849e2 audit**, whose 10,000 route probes and 1,000 policy runs remain labeled with their original hash. They were not rerun or relabeled. All 18 selected witnesses were freshly executed in both editions: complete world/domain history matched, with only edition identity and the corrected receipt/research-context key differing. Current full campaigns were exported and replayed exactly.

The 89f849e2 resolved bundle is now frozen with literal versions and registered alongside 510ec90a and 8ac27217. Existing runs retain their original text and replay. Historical [89f849e2](headless-slice-89f849e2.md), [510ec90a](headless-slice-510ec90a.md) and [8ac27217](headless-slice-8ac27217.md) reports remain separate.

## Historical mechanical route probe

Command: `node scripts/simulation.mjs --runs 10000 --policy enumerate --seed eight-endings`.

**10,000 runs, 130,670 commits, 0 errors**, with 10–14 decisions per run. Endings: restraint: 2,432; remnant: 2,832; accountable: 384; tutelage: 1,088; recovery: 411; extinction: 185; succession: 2,092; containment: 576.

This covers the first 10,000 fourteen-bit input patterns, each with a distinct seed. Early endings leave unused bits. It does not exhaust stochastic outcomes. Source digests stayed unchanged during that audit; transition/RNG/CLI digests still match the corrected edition.

## Historical eight policy probes

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

These add **1,000 runs**. The benefits policy preserves bounded AI benefits and accountable institutions. Recovery follows a crisis-exposed route into devastated survival when the terminal incident does not occur. Policy seeds differ, so frequency differences between policies are not causal-effect estimates.

All **18 saved witnesses** were freshly reconstructed in the archived and corrected editions. Every ending, world, causal history and final state hash matched. Each corrected full campaign replayed exactly. [Eight current synthetic full-run artifacts and all verification results](receipt-witness-replay-check.json) provide one saved artifact per ending. They are test evidence, never participant data.

## Tests

`node --test tests/v2/engine.test.ts tests/v2/golden-fixtures.test.ts tests/v2/editorial.test.ts tests/v2/content-registry.test.ts` passed **44/44**: 29 engine/supported-golden tests, six editorial tests and nine registry tests. `node scripts/test-v2.mjs` passed **106/106**, including nine advisor DOM/timer contract tests. TypeScript checking passed. Actual output is retained in [engine/golden/editorial results](engine-golden-tests.txt) and [integration results](v2-integration-tests.txt).

Editorial tests reject invalid slots and guards, keep mechanical fields immutable, distinguish requested and executed choices, resolve successful/alternate/ineligible incidents correctly, include due delays, honor first-match priority, and preserve exact replay. Handler tests cover completion/cancellation, scroll position, focus transfer, reduced motion and restored history; they are not real-browser or screen-reader certification.

## Limits

These are authored-model audits, not real AI-risk estimates or human-response statistics. [F01–F16 coverage](fixture-coverage.md) retains its full-model gaps. Primitive tests do not implement named victims, institutional lifecycles, evidence artifacts, one-action grants, credentials, scoped evaluations or distinct successor identities. CR003 remains a proposal.

The full 154-candidate inventory, 27–43-choice story, 30–45-minute duration, browser/accessibility experience, collection deployment and production readiness are not certified. No public collector was used. Rerun when content or transition semantics change; never relabel historical results as a new bundle's evidence.
