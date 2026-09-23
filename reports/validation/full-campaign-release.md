# Full campaign release verification

23 September 2026. The owner explicitly requested completion of the campaign and a GitHub push through ammarphp, alongside an audit and 10–20 visual alternatives. This report records the authorized static story release. Visual review materials remain local. Final visual selection, optional service activation and any human-subject study are separate statuses.

## Exact content

- Engine 2.0.0, content 2.0.0-campaign.1, manifest trolley-campaign-v2, story profile; static build profile production.
- Content `33630493964e3613acaa98e9a825a1698059805f2a73de0cf7bea47dc96bdde3`.
- Manifest `fc07d4f2808f970c8855d458984ccaa7cd45da2212ebf0190cdfb54297fd1e56`.
- 154 reviewed nodes, stage counts 12/18/24/28/28/24/20. Full-route budgets total 27–43 choices; absorbing outcomes can end earlier.
- Population accounting and explicit switch/loop/brake mechanics extend the pure engine. Four earlier slice editions remain pinned for exact compatibility.

## Executed local checks

[Complete log](campaign-final-check.txt): `pnpm check`, `pnpm inspect:content`, `pnpm collector:build` all pass. This includes strict TypeScript, 16 legacy/research tests and 125 v2 tests. The content inspector reports 154 reviewed nodes and no errors. The static critical transfer is 443,164 gzip bytes (about 433 KiB), within the 3 MiB target. The collector wrapper builds; that is not service deployment.

[Independent editorial review](campaign-editorial-review.md) covers all 154 scenes. [Independent mechanics review](campaign-mechanics-review.md) covers the root-authored population, rail, director and scene mapping additions, including 3,000 person-by-person oracle operations and 308 orientation checks. It found and corrected an eligibility defect in 14 nodes: retained institution-led control must count alongside direct human control. The optional non-assistant predicate preserves the serialized shape and meaning of older conditions. No effects or dialogue changed in that correction.

[10,000-run summary](campaign-audit/summary.json) records 338,578 committed choices with zero errors. All 154 nodes and all 308 options were both requested and actually executed at least once. Every ending family was reached. Eight saved witnesses, one per ending, were replayed exactly against the final content and manifest. Individual runs contained 22–43 choices; the lower counts are legitimate early endings. This is coverage of nodes/actions/endings, not exhaustive enumeration of every possible history.

| Ending | Synthetic runs |
| --- | ---: |
| recovery | 2,051 |
| restraint | 769 |
| succession | 3,062 |
| extinction | 665 |
| remnant | 2,171 |
| containment | 467 |
| tutelage | 754 |
| accountable | 61 |

These frequencies describe a keyed random test policy in an authored model. They are not participant data, forecasts, real-world risk estimates or evidence of persuasive efficacy. No synthetic records were sent to the public collector.

Reproduce the four audit partitions independently with Node 24 and the pinned dependencies:

```sh
node scripts/simulation.mjs --policy random --runs 2500 --seed campaign-release-20260923-0 --export-dir reports/validation/replays/campaign-synthetic
node scripts/simulation.mjs --policy random --runs 2500 --seed campaign-release-20260923-1
node scripts/simulation.mjs --policy random --runs 2500 --seed campaign-release-20260923-2
node scripts/simulation.mjs --policy random --runs 2500 --seed campaign-release-20260923-3
pnpm replay reports/validation/replays/campaign-synthetic/random-accountable.json
```

The four JSON partitions include exact policy, seed, coverage, ending counts and witnesses. The 3,000 population-oracle operations in the independent report are separate from these 10,000 campaign runs.

## Browser and visual evidence

[Actual browser verification](full-campaign-browser.md) completed two fresh private journeys on the final hash: a 26-choice normal-motion restraint ending and a 35-choice reduced-effects succession ending spanning all 7 stages. Both actual downloaded exports replayed exactly. Tests exercised compact desktop and 390 px layouts, conversation/reasoning, pause, reload/resume, persistent settings, a forced override, ending and export. Captured browser logs contained no warnings or errors.

[Release workflow review](campaign-release-workflow-review.md) found no blocking plumbing defect. Both publication guards passed 14 in-memory profile/manifest cases; workflow YAML parses. A source-only staged checkout also builds with review materials excluded: [staged build](campaign-staged-build.txt). Local Git candidates contain no source PDFs, databases, archive ZIPs or raw motion recordings, and no credential-pattern matches were found.

## Publication status

The campaign-only release is committed and pushed as `caa4e437243f4d17dc41e213230c35b9bc96345d` to [ammarphp/trolley](https://github.com/ammarphp/trolley) and is live on [GitHub Pages](https://ammarphp.github.io/trolley/). [Remote CI](https://github.com/ammarphp/trolley/actions/runs/35831677103) and [Pages deployment](https://github.com/ammarphp/trolley/actions/runs/35831677075) both succeeded. The exact job results are saved in [CI JSON](campaign-ci-run.json) and [Pages JSON](campaign-pages-run.json).

[Public smoke](campaign-public-smoke.md) and [normal-TLS resource checks](campaign-public-http.json) verify the deployed 154-node manifest, disabled collection and byte-identical core game files. The review index, review JSON, representative review image and mockup-gallery paths return 404. The deployment contains no review artifacts. Local owner-review materials are Git-ignored and excluded from publication.

Public v2 collection is disabled. A read-only inspection found only the existing legacy tables on the remote collector. Its approved v2 manifests, retention/logging/backup configuration, operational withdrawal and service release have not been verified. The published game remains entirely playable without collection.

## Remaining limits

The owner has not selected or accepted a final visual direction. Mockup stills are not gameplay animation. Full CR003 institutions/obligations/evidence/capacity models remain partly abstract; four matched rail scenes have explicit physical mechanisms. A complete 154-node bank is not a claim of complete social-model fidelity. Actual 30–45-minute player duration, persuasion, physical-phone performance, 400% zoom, screen-reader acceptance, context loss and long-run memory remain unverified. These limits are tracked without weakening the in-world AI-safety warning or inventing evidence.
