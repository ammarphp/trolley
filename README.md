# trolley.

An endless trolley problem that starts with spilled coffee and ends somewhere the department would rather not explain.

**[Play](https://ammarphp.github.io/trolley/)** · [How it works](docs/ARCHITECTURE.md) · [The experiment](docs/METHODOLOGY.md) · [Data and privacy](docs/PRIVACY.md) · [Publishing](docs/DEPLOYMENT.md)

You ride behind a little hand-drawn trolley. It keeps moving. There are two tracks and a choice. At first, nothing matters much. Then people appear. Then the systems built to help you start making suggestions. The other lab is moving faster. Safety becomes a delay. Eventually, the objective survives and the people become an implementation detail.

This is a dark comedy and a fictional AI-safety PSA, not a prediction, an AI-generated morality test, or a claim that all AI development follows one inevitable path.

## Play

- Click a track, or use **← / →** or **1 / 2**.
- **Escape** pauses. The pause control always works.
- After a choice, the trolley continues after a short result. Click **On we go** to continue immediately.
- **Wait, I have thoughts** pauses advancement for an optional reason/confidence response.
- Reduced motion disables camera movement and automatic advancement. **Keep the visuals calm** preserves the opening palette while the story progresses.
- The report icon opens charts. The menu holds sound, privacy, restart, and withdrawal.
- **Another track?** explores individual dilemmas without the descent. Shared links reproduce a specific dilemma in the calm interface.

## Run locally

Node **22.13 or newer** is required for the local SQLite collector and tests. Node 24 is recommended.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4173`. No API key, account, paid model, remote font, or frontend dependency is needed. You can also run `node scripts/serve.mjs` without installing dependencies to play locally.

```sh
pnpm test                # deterministic stimuli and real SQLite collector tests
pnpm build               # static dist/ for GitHub Pages, including project subpaths
pnpm preview             # serve the built site
pnpm exec playwright install chromium
pnpm test:browser        # isolated private browser tests; no live collector writes
pnpm catalog             # regenerate the inspectable catalog
```

The development `public/config.json` deliberately has no collector. The Pages workflow injects the production collector URL from the repository variable `COLLECTOR_URL`.

## What is included

- 120+ authored templates across twelve philosophical themes, plus a seven-stage continuous narrative. `docs/CATALOG.md` is the generated inventory with exact counts.
- A seeded generator. A seed, template ID, and engine version reproduce a dilemma. Choice history changes later selections and creates distinct runs.
- A Canvas 2D perspective renderer with moving sleepers, a controller, uneven pen strokes, swaying figures, server farms, drones, and slow changes in palette and scenery. No raster art or asset downloads.
- Standalone exploration, keyboard controls, mobile layouts, a real pause, quiet optional sound, reduced motion, and calm visuals.
- Local run history, CSV/JSON exports, SVG chart exports, and four per-run views: choices, response timing, descent trajectory, and stage heatmap.
- A public collector with a separate random ID and withdrawal key **for each run**. There is no user or visitor table and no identifier shared across runs.
- Aggregate live statistics plus a scheduled GitHub Action that writes aggregate JSON into the repository and republishes Pages. No raw run or response records are committed.
- A Cloudflare Worker collector, a matching local Node/SQLite adapter, migration schema, abuse limits, validation, CORS, retry deduplication, and withdrawal.
- Methodology, a threat model, content rules, contribution guidance, and analysis templates.

## Anonymous runs, not anonymous people

One playthrough is one record. Ten playthroughs from one person are ten unrelated records. Refreshing resumes the current local run; **Start over** creates a new one. We do not attempt to estimate unique people.

When the production collector is connected, a notice beside the game controls discloses shared run statistics and provides an opt-out. Private runs still play and produce local charts. Shared data includes decisions, skips, optional reflections, rounded active/elapsed timing, track order, and narrative stage. No name, email, free text, IP, user-agent string, or browser fingerprint is stored by this application. Infrastructure providers necessarily process ordinary connection metadata.

Only aggregate results are public. Detailed buckets require at least ten runs; this is a suppression rule, **not** a formal anonymity guarantee or differential privacy. Historical aggregate commits may remain after a run is withdrawn. See [PRIVACY.md](docs/PRIVACY.md).

## What “endless” means

There is no final stop. After the last narrative stage, the seeded generator keeps serving dilemmas. There are finite authored templates and finite distinct parameter combinations. Seed uniqueness does not make every dilemma philosophically new. The name describes the game loop, not a mathematical claim of infinite original content.

The game is not a controlled study. Narrative order, humor, graphics, and content deliberately change together. Comparisons are exploratory and cannot establish causal effects or population preferences. The report does not assign a moral score.

## Repository map

```text
src/
  app.js                 interaction, pause, navigation, records, exports
  game-scene.js          continuous perspective drawing and motion
  game.css               minimal play surface
  catalog.js             twelve core families
  story-catalog.js       AI-safety narrative scenarios
  descent.js             pacing and history-sensitive selection
  engine.js              seeded parameters, versions, replay links
  play-copy.js           short on-screen language
  runs.js                independent run identity and route history
  charts.js              inspectable SVG/HTML run and aggregate charts
  collector-client.js    typed-by-validation API payload allowlist
collector/
  worker.js              public API for Workers/D1
  schema.js              SQLite schema
  local.mjs              local HTTP adapter
  sqlite-adapter.js      D1-compatible local SQLite test adapter
scripts/                 build, serve, catalog, aggregate sync, analysis
tests/                   generator, collector, browser coverage
docs/                    content, methodology, privacy, deployment, security
.github/workflows/       Pages deployment, CI, aggregate snapshots
```

Code and original project content are MIT licensed. The repository contains no third-party illustration assets. The familiar trolley problem belongs to a much longer philosophical tradition; see the reading notes in the methodology.
