# Integrated browser evidence

Status: a real development-slice playthrough and targeted interaction checks passed. This is not the full campaign, owner approval, assistive-technology certification or release gate.

Performed in the Codex in-app browser on the local workstation against `http://127.0.0.1:4181/`, 22–23 September2026 local date. Desktop viewport1280×800; portrait viewport390×844. No physical phone was used. The final route uses content hash `8ac27217117bf5b4394d5cfe2ffcf15309e50ae2a1a0880d26c610c9af94a614` and engine2.0.0. A sequence of local builds fixed issues found during inspection; screenshots identify their scope below.

## Actual interactions

- Source library opened successfully, including AI sources with explicit reading limits. An earlier mixed string/array limitation field was corrected before this check. Empty scene claim lists no longer attribute an opening joke to all research sources.
- An unarmed lever did not commit. Selecting a route then Escape cancelled it. ArrowLeft followed by Enter committed one decision; the next decision was unarmed. Separate experience-agent checks exercised repeated same-side choices.
- The opening stayed uncommitted from `2026-09-23T03:42:27.003Z` to `03:52:30.286Z`:603.283seconds. The visible prompt was identical and the lever remained unarmed. Start/end frames show different scenery positions. At the end `document.hidden` was false. This was a reading-hold observation, not a continuous frame/memory trace. UI changes were built on disk during this interval but the held tab was intentionally not reloaded.
- A fresh current-content run completed all14decisions. The useful assistant answered an explicit question; later its answer changed with effective authority. The clinic role covered care. Sources, pause and settings remained usable.
- The run granted standing permissions and successor deployment, preserved and practiced the manual network, and continued the race. At decision11, requested `stop` was executed as `continue` by the assistant. The consequence explicitly reported the override and the scene moved along the executed route. At decision12, the maintained fallback restored control. Training a successor and returning the key yielded accountable continuity.
- A mid-run reload resumed decision7 with the same side mapping and an unarmed lever. It did not recommit earlier decisions. The completed ending could later be reopened through Saved records.
- Phone review found no horizontal overflow at390CSSpx. Information buttons now sit below the picture; arrows are inside route controls, and news is below the grip/instruments. These repairs followed inspection of earlier overlapping layouts. The current portrait screenshot shows the repaired layout.
- The completed debrief displayed two run-specific SVG charts and the distinction between requested and executed action. Captured warning/error queries were empty on the exercised route.
- Replay export did not download from one long-lived reviewer tab; no browser console error explained it. Export was independently verified in a fresh tab using the same completed save. Ordinary record export also succeeded there. This browser-context issue remains recorded, not represented as universally resolved.
- The downloaded replay was copied as an explicitly synthetic agent-run fixture and independently re-executed with `pnpm replay reports/validation/replays/browser-accountable.json reports/validation/browser-run-summary.json`. It reproduced the full record, ending and hashes exactly. The summary retains the one overridden request. No private collection key is in the replay.

## Other actual integration evidence

`docs/persistence/BROWSER_CHECK.md` records the successful two-tab conflict/export/reload test and download hashes. `docs/accessibility/REDUCED_MODE_CHECK.md`, when present, records the separate full reduced-effects journey. Automated tests cover consent/no-network rules, collector replay, suppression, snapshots and save-conflict upload cancellation using isolated test databases. They are not live-service tests.

The public v2 collector configuration was false throughout. No live submission, deployment or participant recruitment was performed. The CI browser script `tests/browser-v2.mjs` was authored; local UI checks used CUA instead of running that script. No remote GitHub Actions run is claimed.

## Actual screenshots

| Artifact | What it shows |
| --- | --- |
| `screenshots/desktop-opening.png` | Opening cabin; before small final grip-label positioning adjustment |
| `screenshots/desktop-reading-hold.png` | Same uncommitted decision after the603second hold |
| `screenshots/desktop-benefit.png` | Clinical benefit decision; before phone/news placement refinements |
| `screenshots/phone-permission.png` | Repaired390×844 permission screen |
| `screenshots/desktop-control-loss.png` | Conditional loss-of-control setup |
| `screenshots/overridden-consequence.png` | Actual override with mechanical intervention and clear wording |
| `screenshots/desktop-ending.png` | Accountable ending and per-run plots |
| `screenshots/save-conflict.png` | Real stale-tab recovery dialog |

The local review page `reports/review/index.html` combines representative frames, the playable preview and the100turnrecording. It is not included in Pages.

## Still unverified

Physical-phone GPU/frame/texture/memory budgets; Safari/Firefox and real VoiceOver/NVDA use;400%zoom; full320pxlayout; context loss; full saved-video playback after one native-player crash; long-run memory growth; formal owner visual/feel review; production campaign pacing and late visceral art; live-service provider/logging/retention/withdrawal behavior. These remain open even though the exercised workflows and local test suite pass.
