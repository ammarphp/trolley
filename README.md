# trolley.

A dark comedy about small decisions, useful machines, and the people who still get to make the next decision.

You sit behind a rail controller. The world keeps moving. Choose a track, then move the lever. A spilled coffee becomes a dispatch problem, a helpful assistant becomes infrastructure, and infrastructure becomes a government. Earlier choices determine whether control can still be recovered. Catastrophe is possible; useful, accountable AI and costly restraint are possible too.

**Campaign release:** this revision contains 154 authored scenes across seven stages, with a deterministic causal engine, original cabin animation, local saves and exact replay. A full-length route selects 27–43 decisions; early endings can shorten it. Thirty to forty-five minutes remains a pacing target, not a measured completion time. The owner has authorized the GitHub push and Pages release through [ammarphp/trolley](https://github.com/ammarphp/trolley). The [release evidence](reports/validation/full-campaign-release.md) records the final checks, hashes and deployment result as they are completed; authorization is not evidence that deployment already succeeded. The optional public collector remains disabled.


## Run

Use Node 24 and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4173`. If that port is occupied, use `PORT=4181 pnpm dev`. No API key, model service, account or collector is needed. The static game uses relative URLs and can be hosted beneath a GitHub Pages repository path.

```sh
pnpm check                         # strict types, unit/integration tests, static build
pnpm simulate -- --profile campaign --runs 10000 --policy random --seed campaign-audit
pnpm simulate -- --profile slice --runs 10000 --policy enumerate --seed slice-audit
pnpm collector:build               # compile optional service; does not deploy
pnpm preview                       # serve dist/
pnpm exec playwright install chromium
pnpm test:browser                   # browser CI suite
```

The simulator defaults to the full campaign. Enumeration is restricted to the old slice; it is not a complete search of the campaign. Named policies use explicit anchor choices and synthetic intent priorities for other scenes, not a model of human behavior. Actual test evidence, including its limits, is in [reports/validation](reports/validation). A written test command is not evidence that it ran. The browser CI suite, manual desktop/phone-viewport inspection and physical-device accessibility testing are separate checks.

## Controls

- Select either route, then press **Toggle lever**. The drawn lever reflects the executed route.
- Arrow keys select a route. Enter or Space on the grip commits it. Escape cancels selection.
- The lever stays where it was left, but each new decision starts unarmed. Waiting never chooses for you.
- **Keep going** leaves the consequence and starts the next decision. There is no reading deadline.
- Pause, settings and the run record remain available during the horror. Less motion, less graphic detail and sound are independent settings.
- The information button beside the dilemma opens context, the scene description and sources. Morrow's conversation and the news feed enter at stage three, with selectable questions instead of a text box. The meters enter at stage four.

Your place is saved locally when browser storage is available. Reopening the page offers resume. Replay export includes the pinned content version and causal journal; exports exclude the private withdrawal key. Supported archived slice bundles remain available for exact replay and resume. Unknown content is rejected or kept exportable, rather than silently rewritten as campaign history.

## What exists

The v2 game separates a pure deterministic simulation from its observations, input, animation, persistence and telemetry. Prepared decisions are immutable; commitments are version checked and atomic. SHA-256 keyed randomness separates route selection from fictional incidents. A replay must reproduce every recorded decision and state hash. Cosmetic motion cannot draw an incident, advance a fictional day or kill anyone.

The full bank covers useful advice, bounded clinical benefits, incentives and financing pressure, permission creep, misleading assurance, maintained fallbacks, verified coordination, conditional loss of control, and the return or transfer of power. Eight ending families have explicit predicates. Earlier slice witnesses and tests remain historical evidence; the current full-campaign witnesses and coverage belong to the [release report](reports/validation/full-campaign-release.md). All incident probabilities and numeric outcomes are authored fiction, not estimates of real AI risk or judgments about a player.

Four early rail cases now resolve ordered contact, loop re-entry and independent brakes against distinct population cohorts, including identified fictional workers. Removing the stopping obstruction changes the causal outcome; drawing a curved rail alone does not. Most later casualties still use anonymous counts, and named characters in prose do not automatically become persistent simulated people. The [campaign review](reports/validation/campaign-editorial-review.md) distinguishes these implemented mechanics from remaining full-model obligations.

The original illustration system uses technical line art, a rear view of the uniformed controller, stationary hands, a toggling lever, persistent world movement and changing environments. Sound is original browser synthesis. Earlier renderer and motion checks remain in [motion evidence](docs/art/SPIKE_EVIDENCE.md); they do not substitute for inspecting the full campaign. Further visual refinement and device review remain open.

## Run collection

Sharing is **disabled for this release**. Collector code exists, but publishing the game does not activate it. With a separately configured and approved service, a player could opt in when starting a fresh run. Each shared run gets a fresh random identifier and capability key. There is no user, visitor or cross-run identity in the application. Ten runs by one person are ten runs, not ten people.

Only allowlisted decision/exposure events are sent. No name, free text, fingerprint or application-stored IP address is collected. Hosting providers can process connection metadata separately. Collection failure never blocks play. Public comparable cells require at least twenty eligible runs; test, development, delegated and overridden records are excluded. Suppression is not differential privacy or a guarantee of anonymity. Withdrawal affects stored events and future releases; it cannot recall copies already downloaded.

The optional v2 service validates decisions by replaying the server's approved content. Its own tables and routes are separate from v1. The deployment wrapper closes new v1 submissions while preserving old withdrawal and aggregate access. Scheduled retention and aggregate-refresh code exists; no v2 service has been activated by this implementation. GitHub Actions writes aggregate snapshots into the Pages artifact, not into Git history. See [collection design](docs/privacy/v2-collection-design.md) and [service integration](collector/v2/README.md).

The legacy implementation remains at `legacy.html`, with new sharing disabled in this branch. Its templates, exports and tests are retained. It is not counted as finished v2 content.

## Research and boundaries

[Research dossiers](research/README.md), the [public source registry](research/registry/public-sources.json), [model semantics](docs/architecture/SEMANTICS.md), and [methodology](docs/METHODOLOGY_V2.md) distinguish published mechanisms, authored assumptions, software verification and any future participant evidence. The local books are reading inputs, not redistributable assets; they are excluded from source publication and the build.

This game is an AI-safety warning. It is not a controlled study, psychological diagnosis, real-world forecast or morality score. Formal recruitment and efficacy claims require a separate study protocol. No participant results have been invented or inferred from synthetic campaigns.

## Repository

| Path | Purpose |
|---|---|
| `src/contracts/` | Runtime-validated nodes, permissions, effects and records |
| `src/simulation/` | Pure transitions, routing, incidents, endings and replay |
| `src/content/campaign/` | The 154 authored scenes and campaign assembly |
| `src/content/archive/` | Pinned prior content for exact replay |
| `src/presentation/` | Original cabin, world geometry, line art and audio |
| `src/ui/` | Semantic DOM, lever controls and debrief |
| `src/persistence/` | Local runs, saves and safe exports |
| `src/telemetry/` | Consent, bounded retry queue and public comparisons |
| `collector/v2/` | Optional validation, storage, withdrawal and suppression |
| `research/` | Evidence, candidate inventory and analysis specifications |
| `docs/plan/` | Accepted plan, task ledger and implementation status |
| `reports/validation/` | Actual checks and reproducible evidence |

Code and original artwork are MIT licensed. Third-party dependencies retain their own licenses; cited research is not included under the project's license. No source book or third-party illustration is bundled.
