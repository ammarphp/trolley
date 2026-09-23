# V2 run collection design — not a deployment claim

This is the implementation contract for the authorized rebuild. The local v2 handler and client have isolated SQLite integration tests. They remain disabled in deployment configuration and have not been activated or audited on the service. The legacy collector uses notice-and-opt-out sharing. Do not claim operational v2 behavior until network, service and migration checks establish it.

## Consent and local operation

Start creates a local run. An unchecked “Share this run's choices” control supplies an affirmative choice for that run only. Nothing registers remotely before both Start and that choice. A fresh run requires a fresh choice; resuming a run retains its consent state. The fiction cannot edit consent, withdrawal, pause, exit or accessibility settings.

Private play retains the complete campaign, save, debrief and exports. No earlier exposure, decision or legacy local run uploads automatically. The approved plan includes prospective mid-run opt-in with partial coverage. **CR002 development-slice deferral:** this implementation allows sharing only for a freshly started run. Stop-sharing/withdrawal remains available during a run. To enable sharing after private play, begin a new run and select sharing afresh. The client rejects enrollment from a private or imported history, including a private first exposure before any committed decision. Prospective enrollment remains unfinished because it requires a separately validated partial-run replay protocol; it must not reconstruct private history by uploading that history.

Use fresh random run IDs and capability keys, with no shared person/device ID. Store only the capability hash remotely. Keep keys out of exports, logs, URLs, repository files and error messages. No names, email, free text, demographic profile, fingerprint, IP/forwarded-IP headers or user-agent strings belong in application event storage. Transport omits cookies and referrers. Providers nevertheless handle connection metadata; their logging, retention and backups require an operational audit.

## Versioned service boundary

Retain the existing Worker/D1 service boundary, subject to verified owner access and operations. Introduce separate v2 tables and routes. The static client receives no administrative secret or direct database write capability.

| Route | Minimal behavior |
|---|---|
| `POST /v2/runs` | Idempotent registration of fresh run ID/key, affirmative notice version and manifest: engine/content version, manifest/content hashes and seed; derive profile from the server's approved bundle; return public run number and accepted manifest hash |
| `POST /v2/events` | Strict allowlisted batch, maximum 32 events/64 KiB, authenticated to one run; event ID plus sequence deduplicates retries; contradictory reuse rejects |
| `GET /v2/aggregates?key=…` | Approved comparison keys only; counts, n, denominator, versions, window, as-of and eligibility policy; no arbitrary filter or raw journal endpoint |
| `GET /v2/snapshot` | Paginated previously released valid cells only; bounded size, dated freshness, generation-checked pagination; never releases pending cells |
| `DELETE /v2/runs/:id` | Capability-authenticated deletion; repeat valid requests succeed; retain minimum tombstone to reject delayed submissions |
| `GET /v2/health` | Non-sensitive availability/version only |

Event types are `node_exposed`, `advice_exposed`, `decision_committed`, `reflection_added` and `run_ended`. Decisions/exposures are immutable. Reflections append independently. Store intended action, actual execution/actor and material observation context where relevant; record relative active times rounded to 100 ms, without client wall-clock timestamps. Server validation derives context from approved content/replay rather than trusting a client-supplied comparison hash alone.

The client sends no raw campaign/journal object. The server reconstructs and privately retains a campaign snapshot from the approved bundle, seed and accepted inputs. This derived snapshot includes earlier choices and consequences and is subject to the same withdrawal and retention rules as events. Four presentation switches are captured on each exposure: reduced motion, reduced graphics, audio and descriptions. Changed switches produce a new exposure profile entry; unchanged redisplay is idempotent. Comparison cells retain that ordered exposure history, advisor IDs, semantic side layout, approved content and engine context. No display dimensions or device capabilities are collected. Each run has at most 2,000 accepted observation events, in addition to the client queue limit.

CORS limits browser origins; it does not authenticate a human. Capability authentication, schema and replay checks, quotas and rate limits are separate defenses. A forged client can manufacture plausible runs. Do not advertise verified human participants.

## Comparable statistics

The comparison key includes node revision, semantic options, parameters, material presented facts, authority, advisor exposure, timing regime, and profile/treatment. Count the first eligible free choice once per run/cell. Forced, delegated, overridden, skipped, imported, staff and marked agent records have separate categories. They never enter the free-choice percentage.

Display percentages only after commitment, with n≥20 recorded runs. Below the threshold return an insufficient-data state without exact cell counts. Never relax comparability to manufacture enough data. Exact cells may remain sparse indefinitely. Describe runs, not independent people or public moral agreement.

Poll hourly, cache dated releases, and republish a detailed cell only after twenty newly eligible distinct run IDs since its preceding release. These measures reduce small-update exposure; they are not differential privacy and do not rule out inference from overlapping cells, external knowledge or archived releases. Keep real statistics outside the fictional bot feed and manipulation layer.

## Withdrawal, retention and publication

On confirmed withdrawal, delete stored events and reconstructed snapshots, reject delayed writes, and invalidate affected live aggregate cells. A lost successful deletion response must be safe to retry. A withdrawal received before an in-flight registration reserves an authenticated tombstone, preventing that registration from resurrecting the run. An incorrect capability is an error, not proof that no data existed. Missing collector configuration after any registration attempt cannot be reported as confirmed remote withdrawal. Opt-out cancels queued work immediately and aborts active requests where possible; an already accepted request may require withdrawal. Clearing the only local key can make a run impossible to identify for withdrawal; explain this before erasure and offer a separate private key backup.

Raw v2 events expire after 365 days. A daily authenticated maintenance job triggered by GitHub Actions performs cleanup; service credentials remain confined to Actions and the Worker environment. Verify successful scheduling and backup retention before making an operational deletion guarantee. Keep only minimum registration/tombstone metadata required by documented counts and retry denial; do not preserve whole withdrawn journals as audit records.

Stop committing new count snapshots into Git history. The GitHub integration fetches approved aggregates into build output for Pages deployment. Existing commits and downloaded copies cannot be recalled. A replaced Pages file, CDN cache or browser copy may also remain externally available.

The honest withdrawal promise is: the collector removes the run's events and excludes them from newly generated summaries after confirmed deletion; live cells are invalidated; the Pages snapshot changes on the next successful deployment. Previously published/downloaded aggregate outputs may remain. If a newly displayed detailed cell must always honor current invalidation, require a live validity check and hide the cell when that check fails; an offline snapshot cannot guarantee current withdrawal enforcement.

## Legacy separation and failure behavior

Keep legacy records labeled with their original notice and engine version. Never relabel them as v2 affirmative-consent data or merge them into v2 cells. At cutover reject new legacy registrations/responses with a recoverable upgrade response, but retain legacy withdrawal. Preserve local v1 export and deletion keys; migration must be transactional and must not silently discard a save.

Bound the upload queue to seven days/2,000 events, with exponential backoff and jitter. Expired/dropped batches are reported as coverage loss, not silently marked shared. Missing storage falls back to in-memory play with truthful save status. Network failure, 429, expired credentials and malformed responses never block a decision or affect fictional outcomes.

## Release evidence required

Verify traffic before Start; unchecked/default/private play; resume/restart; rejection of private-history enrollment; opt-out during registration/upload; repeat withdrawal; delayed writes; exact n=19/20 cells; duplicate and conflicting events; legacy exports; queue expiry; quota failure; no secrets/raw events in build or Git; stale snapshot labeling; scheduled retention; and actual provider log/backup disclosures. Prospective opt-in needs its own future protocol and tests under CR002. All development tests use isolated data. A formal-study profile remains disabled pending its separately frozen protocol and activation decision.
