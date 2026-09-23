# V2 build and deployment boundary

The release contains the 154-node, seven-stage campaign. The owner has authorized the GitHub push and Pages publication to `ammarphp/trolley`; [decision 004](../decisions/004-full-campaign-and-design-review.md) supersedes the previous local-only instruction. The editorially reviewed campaign uses the `story` profile. Final build, route, browser, artifact and remote deployment evidence is recorded in [the full-campaign release report](../../reports/validation/full-campaign-release.md) as that work completes. This document does not establish that the remote site has already updated. Public collection remains disabled.

## Static build

Node 24, pnpm 11.19.0: `pnpm install --frozen-lockfile`, then `pnpm check`. Serve `dist/` with `PORT=4181 pnpm preview`. All game and data URLs are relative. CI additionally installs Chromium and runs the authored browser suite. Inspect the actual browser and evidence report; a green build alone does not establish release acceptance.

The build includes the campaign, bundled dependencies, public assets, selected documentation and the legacy page. Owner-review materials, including the visual audit and design gallery, remain local and Git-ignored. No reports folder is deployed to Pages. The build fails if review material enters that artifact.

The build excludes source books/PDFs, local databases, telemetry secrets, developer renderer harnesses and local motion-review wrappers. Original unbundled v1 assets remain for legacy export/withdrawal compatibility. Initial critical gzip transfer is checked against 3 MiB; this budget does not measure the total size of optional gallery images. The final artifact audit must inspect the actual output after the final build, including the new review folders.

The builder emits exact manifest/content hashes, node count, reviewed count, stage budgets and collector state in `dist/build-manifest.json`. A `story` campaign maps to `production`; an unfinished test campaign maps to `development-campaign`. Both publishing workflows require the exact production profile. Manual workflow dispatch and repository variables cannot bypass that source-controlled guard. See [release authorization and guard](RELEASE_HOLD.md).

`collectorV2Enabled` is false for this release. The Pages and scheduled workflows read `COLLECTOR_URL`, `COLLECTOR_V2_ENABLED`, and public operator/contact configuration. A configured URL alone never enables v2. Keep `COLLECTOR_V2_ENABLED` unset or false during this release. Enabling the frontend would still be insufficient to approve a server content manifest, and is not part of the authorized static release.

## Campaign validation and compatibility

`pnpm simulate -- --profile campaign --runs 10000 --policy random --seed campaign-audit` runs a diverse synthetic probe. Campaign is the default profile. `--policy enumerate` is deliberately slice-only because the full campaign can exceed 32 decisions; use `--profile slice` to reproduce historical enumeration. Named campaign policies combine explicit anchor decisions with authored intent priorities for optional scenes. Their frequencies are software coverage evidence, not human-response statistics or AI-risk forecasts.

The campaign selects 27–43 decisions for a full-length route, with earlier terminal outcomes possible. The bank's existence does not validate the 30–45 minute pacing target. Ordered rail contact, obstruction and independent braking are currently bound to four early cases, using distinct cohorts and identified fictional workers. Later mass-casualty events generally use anonymous counts. The [editorial review](../../reports/validation/campaign-editorial-review.md) records remaining causal-model limits; it must not be reported as complete F01/F03/F04 coverage.

Exact historical content bundles remain available through the registry for supported saved slice runs. A campaign run is not reconstructed by relabeling a slice journal. Unknown hashes must fail explicitly or remain exportable. Keep export/replay checks tied to the content bundle that actually generated each run, including after prose-only changes.

## Service package

`pnpm collector:build` creates `.build/collector/worker.js` from `collector/entry.js`. The wrapper preserves legacy GETs and POST `/withdraw`, rejects new legacy POST `/runs` and `/responses`, and routes `/v2/*` to the new handler. Legacy tables and v2 tables are separate. `node scripts/build-collector.mjs --sites` additionally prepares the repository's existing Sites package when its local hosting metadata already exists; this option does not publish.

`pnpm collector:dev` runs the same wrapper against local SQLite. V2 remains off unless `V2_ENABLED=true` is explicit, and registrations still require an approved manifest hash. Never send synthetic test submissions to the public collector. Tests use separate in-memory databases and clearly synthetic manifests. Development, test, delegated and overridden records remain excluded from public human-response comparison cells; publishing the story profile does not itself approve any server manifest.

The example Wrangler configuration points to `entry.js`, leaves both activation and manifest approvals empty, and proposes an hourly scheduled handler. The handler cleans retained v2 data and, when enabled, refreshes up to 100 eligible candidate cells. `hasMore` in the refresh result identifies backlog; scale scheduling only after observing supported service limits. Deployment, provider logging, region, operator ownership, backup retention, quotas and actual scheduled execution still need operational verification. This release does not claim those collector checks have passed.

## Pages snapshots

The existing v1 snapshot script now writes `dist/aggregate.json`; it never commits counts to Git. The v2 script `node scripts/sync-v2-aggregates.mjs` follows `/v2/snapshot` pages, strictly validates fields, enforces transfer limits and rechecks a publication generation before writing `dist/aggregate-v2.json` atomically. A withdrawal or publication during pagination aborts the build. No run-level payload or capability enters this artifact.

Only already released cells are downloadable. A scheduled private refresh applies the twenty-eligible-run, twenty-new-run and hourly release rules. The static copy expires after one hour. The game may show an unexpired saved copy when the live service is unavailable, with an explicit historical-copy notice. Live suppression takes precedence. Public copies already downloaded cannot be recalled after withdrawal.

When the production guard passes, the aggregate workflow can build and publish a Pages artifact directly, with repository `contents: read` and deployment-scoped Pages/OIDC permissions. V2 snapshot reads additionally require explicit collector activation, which remains off. No personal access token or count-commit loop is needed. If a required download fails, the job fails before deploying a partial replacement. Scheduled GitHub runs are not guaranteed to execute at an exact time; the UI does not invent freshness.

## Authorized release and rollback

Record the exact commit, manifest/content hashes, release profile, checks and owner authorization before publishing. Run the current campaign's checks and inspect the deployed path before marking it deployed. Retain unresolved visual acceptance, full-model semantics and physical-device accessibility limits explicitly in the release report; do not convert a phone-sized desktop viewport into a physical-device test. Static publication is separate from collector activation, which remains held for operational review.

For rollback, redeploy the prior known-good Pages workflow artifact or tagged source. Disable v2 new submissions independently if necessary while preserving capability-based withdrawals. Do not reuse a changed manifest/version to make old saves appear compatible. Keep a versioned content bundle for every accepted run whose replay/retention obligations remain active.
