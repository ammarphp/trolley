# V2 collector integration

This code is locally testable and disabled by default. It does not activate a service, approve a content release, migrate legacy data, or implement a formal study.

`handler(request, env)` serves `/v2/runs`, `/v2/events`, `/v2/aggregates`, `/v2/snapshot`, `/v2/health`, and authenticated run withdrawal. It requires a D1-compatible `DB`. Collection additionally requires `V2_ENABLED === 'true'`, a server-owned `V2_BUNDLES` list of `{manifest, nodes}`, and the manifest's SHA-256 in `V2_APPROVED_MANIFEST_HASHES`. Request data cannot install or approve a bundle. All current development slice/test profiles are excluded from public free-choice cells. Test fixtures marked reviewed exist only in the isolated test database and are not production content approvals.

Use a built server bundle at deployment, not content or dependencies downloaded during a request. Keep legacy routes and credentials separate. The exported schema creates only `v2_*` tables; root integration owns migration/deployment orchestration and legacy cutover. The static client receives no administrative key.

`cleanupV2(env)` is a private maintenance function. Wire it to the approved authenticated daily integration before claiming retention is operational. It removes events and reconstructed campaign snapshots older than 365 days and invalidates their aggregate cells. Run IDs, capability hashes and minimal tombstones remain to prevent delayed requests from recreating removed runs. The function has no public HTTP route.

Registration uses an affirmative Start and run-specific capability. The server replays allowlisted input events against the approved engine/content. Client-supplied outcome, comparison-hash, complete campaign, free text and personal identifiers are rejected by strict schemas. The server stores the reconstructed campaign privately, so it can still contain the accepted run's complete choice and consequence history. This storage is deleted on withdrawal/expiry. No remote identity spans runs. A forged client can submit plausible human-labeled runs: these are recorded runs, not authenticated people.

Cells require an approved story profile, human-labeled input, a genuinely free human execution, and exact material comparison context. They release at n≥20, then at least an hour and twenty newly eligible runs since their prior release. A cell invalidated by withdrawal stays unavailable until the same release conditions are met again. There is no arbitrary-filter or public raw-event endpoint. This is not differential privacy.

The client must call `recordExposure` when a decision is actually visible, including resumed redisplay, `recordAdvice` with the engine-provided reply ID when displayed, and `recordDecision` after commitment with the actual record. The latter uses its saved previous exposure, even though the engine has already prepared the next decision. `aggregateKeyFor` uses that same saved context. `telemetryStatus` reports pending events; `run.queue.length` includes local metadata and is not an upload count.

The development slice supports enrollment only at a fresh opted-in Start. Prospective mid-run enrollment remains CR002 unfinished work. Calling the API on a private/imported history does not silently send that history. Opt-out aborts/cancels queued network work; withdrawal is confirmed only after the server acknowledges it. If a deletion beats registration, its authenticated tombstone prevents the delayed registration from restoring collection.

The client checks the local save version before each upload. A `SaveConflictError` stops sharing, aborts requests, clears pending events and retry timers, and is rethrown to the UI. The open campaign and capability remain available for export and withdrawal; it cannot overwrite the winning tab's save. `telemetryStatus(...).saveConflictError` and its error message identify this condition. Background retries handle the rejection without rescheduling. A conflicting local save does not block a capability-authenticated remote withdrawal. Requests already accepted before conflict detection remain subject to withdrawal; the local version check and remote request are not one atomic transaction.

`tests/v2/collector.test.ts` uses the shared real SQLite adapter and isolated fixtures, with no network or live database. These tests do not establish deployed provider logging, backups, scheduled cleanup, approved content, abuse resistance under load, or static snapshot withdrawal. See `docs/privacy/v2-collection-design.md` for those release gates and honest publication limits.

## Public aggregate snapshot

`GET /v2/snapshot` returns only cells that were already released, remain valid, have a published n≥20, and retain at least twenty contributions. Any membership marked withdrawn/expired or older than the retention window withholds the entire cell even if scheduled cleanup has not run. The GET does not run cleanup, count pending contributions for publication, or release a new cell. A qualified but unpublished cell is absent. There are no run totals, run numbers, IDs, seeds, event rows, journals, capability hashes or timestamps of individual activity in the response. A `comparisonKey` is exactly the existing public aggregate key, including its material fictional context and presentation profile; no extra private key is introduced.

The JSON shape is:

```ts
{
  schemaVersion: 2,
  status: 'live-validity-checked',
  generation: string, // opaque 64-character token, not an activity counter
  generatedAt: string, // ISO time at which this page's validity was checked
  expiresAt: string, // generatedAt + one hour; a display freshness limit
  unit: 'recorded_run',
  eligibilityVersion: 2,
  minimumRuns: 20,
  publicationRule: string,
  withdrawalNotice: string,
  cells: Array<{comparisonKey: string; n: number; counts: Record<string, number>; asOf: string}>,
  nextCursor: string | null,
  complete: boolean
}
```

Each page contains at most 100 cells and 256 KiB, including its metadata and cursor. `limit` may reduce the row cap. A nonempty `nextCursor` is the last returned public cell key; URL-encode it and request `?cursor=…&generation=…`. No other filters are accepted. `complete` describes pagination, not completion of a campaign, full sampling of visitors, or current release of every qualified cell. An empty completed page reports no currently exportable cells without exposing how many runs or unpublished contexts exist.

Publication/invalidation triggers replace a random generation value whenever a published cell changes; the effective token also changes at the UTC retention-date boundary. The endpoint checks generation before and after each page. A subsequent page requires the same generation. If publication or withdrawal intervenes, it returns 409 and the build must discard its partial result and restart. Corrupt published counts fail closed with 503 and disclose no row. A build should use a bounded retry count, deduplicate by public comparison key, then make a final small request with that generation before deploying. An HTTP error is not an empty successful snapshot.

`refreshAggregatesV2(env, limit = 100)` is a private scheduled helper, not a public route. It checks candidate contexts against the existing n≥20, twenty-new-run and hourly release rules. It returns `{status, considered, released, hasMore}`, without candidate keys. Disabled configuration is a no-op. Run `cleanupV2` first, then call refresh in a bounded loop when `hasMore` is true. Every call considers at most 100 contexts. The integration owns authentication, scheduling, bounded retries, backlog reporting and the decision to deploy; none is activated by this module.

For GitHub Pages, fetch these pages into the deployment artifact and replace the previous complete snapshot. Do not merge old invalidated cells into a new snapshot or commit count histories to Git. Preserve each cell's `asOf` and the earliest page expiry when combining pages. `generatedAt` means validity was checked then; it does not mean all counts were just recounted, since the privacy release batch may leave a cell's `asOf` much older. Suppress or explicitly mark a static copy after `expiresAt`; do not present it as a live comparison. A live validity check is necessary if the displayed cell must honor current withdrawals.

The generation check prevents mixing incompatible pages during a fetch. It cannot recall an already fetched, deployed, cached or downloaded result, nor prevent a withdrawal immediately after the final check. Previously published count differences and overlapping contexts can still support inference. Thresholding, batched releases and these snapshot controls are not differential privacy. Provider behavior, real D1 migrations/triggers and the actual deployment workflow still require operational verification.
