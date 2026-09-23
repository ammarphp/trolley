# Bounded artifact and publication audit

## Final documentation refresh

The coordinator rebuilt after updating the public methodology text. The JavaScript, CSS, index, config and build-manifest digests below are unchanged; inventory remains 34 files and all local Markdown links were checked again with zero missing targets. The final metadata is in [reference-build-hashes.json](reference-build-hashes.json). No code, collection setting or publication gate changed during this documentation refresh.

## Latest build snapshot — 23 September 2026, 05:43 UTC

The coordinator's final local build was inspected without rebuilding it. After the final control-color CSS correction, its digests, file inventory and collection configuration were refreshed at 05:43 UTC. It still contains **34 files**, including six Markdown documents. The 05:37 inspection found **zero broken local Markdown links**; the previous 17-link finding below is resolved. The legacy runtime under `dist/src/` is expected; executable spike/review/playback tools are absent. The refreshed inventory again contains no PDFs/books, ZIP archives, raw reports/replays, capability JSON, database files, recorded motion media or symlinks.

The build remains `development-slice`, with **340,920 critical gzip bytes**. Its collector URL is empty and `collectorV2Enabled` is false. The 05:37 inspection confirmed both supplied book PDFs were ignored. Its bounded scan of **292 source-publication-candidate/built text files**, skipping 37 binary files, found no high-confidence credential patterns or populated capability JSON fields. Values were not printed. Those broader checks were not repeated for the final CSS-only correction. This is the same limited pattern-based inspection described below, not a general security certification.

| Final inspected artifact | SHA-256 |
| --- | --- |
| `dist/game.js` | `78b25371fcda3d61b32f7503c486d4bdec6f5ed54222054ec3234d5451909787` |
| `dist/game.css` | `ebaeecb877fa13b2a7b685bb2ef5e87620b1ba0d8ab54fcd9b10126db1f2d3d7` |
| `dist/index.html` | `8a2dc5dda13ae104b0675466599481fe88e1132175c7d4419856ef6c95da13f8` |
| `dist/config.json` | `926142c7f4fa98992e355cef8bf3c18820d384ea270b605844375df7dc9a90cf` |
| `dist/build-manifest.json` | `ae7efe255c9fffdb6fe543a55c803eedf6f3b2a5d5f4fc1dd83210b631a7efa9` |

The current receipt edition is `f42837ffe56285a23baf113d82e3867db2d74799fb6049515071731d0df9eb16`; the prior in-progress `89f849e2` edition is now bundled as an exact frozen replay archive. [Receipt equivalence](receipt-equivalence.json) distinguishes the historical 11,000-run audit from fresh paired witness replay. Source status pages were being refreshed by the coordinator at inspection; the copied public documents retain development/legacy labels and do not claim the full campaign or release is certified. The publication guard remains required. Any later rebuild changes the artifact snapshot and requires fresh digest/boundary verification.

## Earlier inspected artifact and guard implementation

23 September 2026. Local inspection of the existing build and working tree. No rebuild, credential disclosure, remote request, workflow dispatch, deployment or source/application change was performed during inspection. A separate bounded repair adds the workflow publication guard documented below. The owner has requested another design revision; this is an audit of the inspected artifact, not acceptance of the next visual build.

## Inspected artifact

The existing `dist/` contains 55 files. No supplied books/PDFs, raw reports or replays, capability JSON, databases, review/playback pages, spike executables, local motion media or symlinks were found. The copied spike Markdown files describe development evidence; the executable spike/review tools are absent. The handoff ZIP contains 25 members and no PDF or credential-named member; it is not in `dist`.

`dist/config.json` has an empty collector URL and `collectorV2Enabled: false`. The build manifest declares `development-slice`, engine 2.0.0, content 2.0.0-slice.1 and 302,825 critical gzip bytes. Local configuration does not establish the remote repository variables or deployed-service state.

| Artifact | SHA-256 at inspection |
| --- | --- |
| `dist/game.js` | `28494f8336a16f24a0c9bc92bdd1a01c5239807f25cc294aa4925a56023bfbf1` |
| `dist/game.css` | `0ec99f443cae8ba561250fc58118c6cc4585e4eaeea9601bfe260a53e0e02c4f` |
| `dist/index.html` | `a0d6be94b7256296ea26d762d09cf9f07ad81102e12d0997aa6d4aa61821792d` |
| `dist/config.json` | `926142c7f4fa98992e355cef8bf3c18820d384ea270b605844375df7dc9a90cf` |
| `dist/build-manifest.json` | `be8701221337e37433c422f3dd319dbd9c511c5e4732c70a8d0a6e985bda038e` |

## Source-publication and credential checks

Both supplied book PDFs match `.gitignore`'s `/beta version/*.pdf` rule. `dist`, local build/runtime stores, environment files, databases and the recorded motion/spike bundle are also ignored. Three synthetic replay JSON fixtures and two local review HTML pages remain unignored source-publication candidates. They are absent from `dist`; the replay fixtures contain campaign/input evidence and no detected capability fields. Preserve their explicit synthetic provenance when curating the eventual Git commit.

A read-only pattern scan covered 244 Git-publication-candidate and built text files; 24 binary files were skipped. It found no high-confidence GitHub/service-token, AWS access-key or private-key marker, and no populated JSON secret/run-token/withdrawal-key/admin-key/API-key/password field. Values were not printed. This bounded scan cannot establish that arbitrary encoded secrets or binary metadata are absent; it is not a general security certification.

## Findings retained for integration

1. The 26 copied Markdown files contain 17 broken local links: nine point into deliberately excluded reports, four into research, two into source, one into collector and one into tests. Examples include `dist/README.md` lines 56/62 and `dist/docs/plan/IMPLEMENTATION_STATUS.md` lines 12–15. Preserve the exclusions; curate the public documentation or link to appropriate repository pages. This packet does not edit the build or public documentation.
2. The inspected build's status document still reports 79 tests and pending new browser QA, while the source handoff had advanced to 89 tests and was being refreshed. These are stale, conservative evidence statements, not new completion claims. Rebuild documentation only after the coordinator finalizes the current review packet.
3. Reviewed source status documents keep the full-model, visual, operational and release gates open. Legacy architecture/deployment/privacy/methodology pages carry explicit v1 notices. No full-campaign or v2-release certification was found in the reviewed current status pages.
4. Before repair, both main pushes and the hourly aggregate workflow could publish a development build. Collection being disabled did not prevent this deployment path. The guard below addresses this local workflow defect; remote environment protection settings were not inspected.

## Publication guard repair and validation

The only workflow changes are in `.github/workflows/pages.yml` and `.github/workflows/aggregate.yml`. Both derive a default-false job output from the built manifest. Only exact `profile: production` permits Pages configuration/upload and downstream deployment. Development and unknown profiles are visibly held; invalid/missing JSON fails closed. Scheduled aggregate downloads also require the production output. Manual dispatch and repository variables have no profile override.

Both YAML files parsed successfully with the installed Ruby Psych 3.1.0 parser. Structural checks verified the guard output binding, conditional Pages configuration/upload, downstream deployment condition, both conditional aggregate downloads, absence of manual-dispatch override inputs, and identical embedded guard code. Psych uses YAML 1.1, so the validation harness accounted for its boolean interpretation of the `on` key.

The exact guard shell extracted from each workflow was executed with Node 24 in isolated temporary directories: **24/24 checks passed** across 12 manifest/configuration cases per workflow. The inspected current manifest, `development-slice`, an unknown profile, absent profile, `null`, an array, a non-string profile, and `production ` with trailing whitespace all withheld publication. Missing files and malformed JSON failed with exit status 1 and publication disabled. Only exact `production` enabled the job output. A development profile remained held with production-looking override environment variables, and each case emitted the expected visible job-summary explanation. The temporary directories were removed.

No application rebuild, remote Actions run or deployment was performed. This verifies the local guard and workflow structure, not remote environment protections or production readiness.
