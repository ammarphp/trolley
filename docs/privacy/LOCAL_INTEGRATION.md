# Actual local browser and collector integration

23 September 2026, 04:13–04:16 UTC. The requested private-play, opt-in, slice exclusion, stop-sharing and withdrawal checks passed in an actual Chrome tab operated through CUA. This is distinct from the automated SQLite/fake-indexeddb tests. No production endpoint or live participant collection was used.

The tested page was a copy of the current `dist` in `.build/local-collection-ui`. Only that copy's `config.json` changed: `collectorV2Enabled: true` and `collectorUrl: http://127.0.0.1:8789`. The original build configuration stayed disabled. The UI ran at `http://127.0.0.1:4195`; the repository's actual `collector/local.mjs` and `collector/entry.js` served an isolated `.build/local-collection.sqlite` with that sole allowed origin, explicit v2 enablement and the slice manifest allowlist. The server loaded the source TypeScript with Node 24's experimental transform-types flag. No substitute handler or mocked browser transport was used.

Pinned evidence:

| Artifact | SHA-256 |
|---|---|
| Slice manifest | `7951ee7818c9e965fa5dc1a4c7b1a412e4abe503a0d2d0594bd867d59c600ffd` |
| Slice content | `8ac27217117bf5b4394d5cfe2ffcf15309e50ae2a1a0880d26c610c9af94a614` |
| Tested `game.js` | `b55474adf6ab23bf8b10c631f442b37590c9e97edc5243af1f1b114553544f02` |

The copy was taken at 04:12:46 UTC, after the lead's private-comparison request guard was rebuilt. The in-app browser was unavailable, so the actual interaction used Chrome. All clicks used the visible accessibility tree. Nothing was committed through a test-only application API.

## Results

HTTP counts include CORS OPTIONS requests. Passive instrumentation at the local HTTP server recorded only method and pathname. It omitted query strings, request/response bodies and headers, and replaced withdrawal's run-specific path with `/v2/runs/:run`. Database inspection returned counts and status fields only. No capability, capability hash, run ID, seed or raw journal was printed or added to this report.

| Checkpoint | Collector requests, cumulative | Stored runs | Stored events | Public eligible choices / cells |
|---|---:|---:|---:|---:|
| Initial screen; share checkbox visibly unchecked | 0 | 0 | 0 | 0 / 0 |
| Private Start and one committed choice | 0 | 0 | 0 | 0 / 0 |
| Fresh run screen; sharing checked but Start not pressed | 0 | 0 | 0 | 0 / 0 |
| Opted-in Start | 4 | 1 | 1 | 0 / 0 |
| First shared choice committed | 7 | 1 | 2 | 0 / 0 |
| Second shared choice committed | 12 | 1 | 4 | 0 / 0 |
| Sharing stopped; next choice committed privately | 12 | 1 | 4 | 0 / 0 |
| Withdrawal confirmed | 14 | 1 tombstone | 0 | 0 / 0 |

The private first choice reached the completed outcome and continuation control. Returning to the new-run screen showed sharing unchecked again. Checking it did not register a run. Only the subsequent Start sent registration/exposure requests.

The one remotely registered run had server-derived profile `slice`. After two committed choices it contained exactly two `node_exposed` and two `decision_committed` events. The reconstructed server journal contained two decisions. There were no eligible public choices or aggregate cells; these test observations did not enter public comparisons.

Stop-sharing displayed “Sharing stopped. Previously accepted records remain until withdrawal.” Advancing and committing another choice added no collector request, including no comparison GET. The remote event count stayed four and the remote journal stayed at two decisions. This verifies the actual UI guard as well as upload suppression.

Withdrawal remained available after opt-out. The UI displayed “Withdrawal confirmed. This run will not enter future aggregates.” The service retained one withdrawn tombstone, with zero stored events, zero stored campaign snapshots and zero stored manifests. Choices/cells remained zero throughout. This test therefore establishes payload deletion and continued exclusion, not invalidation of an existing public n≥20 cell; the latter is covered separately by collector integration tests.

After withdrawal, the final method/path totals were one registration POST, four event POSTs, two aggregate GETs, one DELETE, and six OPTIONS requests. There were no legacy registrations. [Machine-readable evidence](../../reports/validation/local-collection.json) contains only the bounded counts, statuses and artifact hashes.

## Finding and limits

One persistent copy defect was reported to the lead. After stop-sharing, Settings said “This run stays on your device” even though its previously accepted events remained stored. The transient notice was accurate. The persistent status should distinguish never-shared local play from stopped sharing with earlier records awaiting withdrawal. This report records the tested bundle; it does not certify a later copy change without a new check.

The lead was asked to retain regression assertions in the root-owned browser script for zero collector requests during private play and after opt-out. This actual CUA test should not be replaced by a claim that a client-only fake-transport test covers the UI guard.

Both test servers were stopped after verifying their exact process commands, and the test tab was closed. A final listener check found no server on 8789 or 4195. Only these test processes were stopped. Temporary database and instrumented runner files remain under ignored `.build/`; no raw database or event payload is a public artifact.

This does not validate deployed Cloudflare/D1 behavior, provider logs/backups, scheduler execution, production authorization, a full campaign, real participant effects, other browsers or accessibility/device gates. The handler and wrapper worked locally with real HTTP/CORS and actual browser input; production collection remains disabled.
