# trolley.

**A short ride. A very long way down.**

You drive a trolley. Every decision is a fork in the track, and you choose it with a lever. At first the stakes are a paper cup of coffee and a stack of compliance forms. Then they are five workers and one. Then a clinic's scheduling system, a certification you are asked to sign before anyone has tested the thing it certifies, and an assistant who is *so* helpful. By the end of the day the question is no longer whom to spare. It is whether anyone still has the authority to choose.

*trolley.* is an AI-safety parable in seven stages, drawn in pen and ink in real time. It runs in the browser, needs no account, and makes no calls to a live model.

- **Play:** [ammarphp.github.io/trolley](https://ammarphp.github.io/trolley/)
- **Rendering write-up:** [Drawing a moving world in ink](docs/render/RENDERING.md)
- **Why the overhaul:** [ADR 006](docs/decisions/006-ink-world-overhaul.md)

## What it is

**A game.**
- You play in first person from the cab.
- The world never stops moving. When a fork appears, the trolley eases toward it and never quite arrives, so there is no deadline.
- You choose a track on the windshield or drag the lever itself, then pull.
- Behind you the landscape moves through a single day:
  - from dawn fields, cows and rivers;
  - through towns, clinics and depots;
  - into data halls, pylons and cooling towers;
  - then surveillance, storms and fire;
  - and finally ruin, or an immaculate order with no one in it.
- The only view of the controller is your own face, in the left side mirror. It changes.
- Every other glitch in the drawing is scripted and deliberate, and pause always works.

**A parable with a thesis.**
- Morrow, a fictional assistant from a fictional lab, arrives in stage 3. It is useful, honest and candid about its limits, and it keeps being given more to do.
- The game's warning is structural rather than villainous: capability races, evaluations that stop testing what is deployed, fallbacks retired because they were expensive, and authority transferred because transferring it produced real benefits.
- Catastrophe is possible. So are costly restraint and accountable, useful AI.
- There are eight ending families.

**A reproducible research artifact.**
- The whole campaign runs headlessly from a seed and an action log, and it produces a JSON record for every decision.
- Replays are verified byte for byte.
- The research layer separates what published work shows from what the fiction invents. Every number is authored fiction, not a forecast.

## The world, briefly

| Stage | Setting | New in the cab and interface |
|---|---|---|
| 1 | Dawn over farmland | The lever, the mirror, a paper cup |
| 2 | Morning on the line | The classical problems (Foot, Thomson): switches, loops, brakes, consent, risk |
| 3 | Town and clinic | Morrow installs itself on the dash; the wire (news and posts) begins |
| 4 | The build-out | Instruments: GDP, reported capability, fatalities; the rails speed up |
| 5 | Dependence | Mergers, audits, fallbacks retired; early endings become possible |
| 6 | The control gap | Storms, seized authority, a lever that registers but does not route |
| 7 | Aftermath | Whatever remains, and who decides for it |

A full journey is 27–43 decisions drawn from 154 authored dilemmas. That is roughly 30–45 minutes, depending on the route and on how long you read.

## How it is built

| Path | What lives there |
|---|---|
| `src/simulation/`, `src/contracts/`, `src/content/` | The deterministic causal engine and the 154-node campaign (unchanged by the overhaul; content hashes pinned) |
| `src/presentation/derive.ts` | A pure projection from the campaign to what should be seen: environment channels, the controller's face, glass damage, scripted disruptions |
| `src/render/core/` | The ink pipeline: hatching and stippling materials, contour composite, palette, geometry kit |
| `src/render/world/` | Track network and turnouts, the journey, scenery streaming, tableaux, tunnels |
| `src/render/actors/`, `structures/`, `props/`, `world/nature/`, `world/terrain/`, `world/sky/` | The procedural asset library: people, animals, machines, buildings, trees, ground, sky and weather |
| `src/render/cabin/`, `src/render/portrait/` | The first-person cab and the face in the mirror |
| `src/render/staging/` | What stands on each branch of all 154 forks |
| `src/audio/` | Original synthesized score and rail ambience |
| `src/ui/` | The HUD, Morrow's window, instruments, the wire, glossary, debrief |
| `src/ui/brand/`, `src/ui/wire/` | The fictional world's institutions, marks and ambient news |
| `research/`, `docs/` | Sources, methodology, decisions, privacy |

Every asset is original procedural TypeScript geometry. There are no downloaded models, textures or samples. Fonts are Geist and Geist Mono (SIL OFL), self-hosted.

## Run it

Use Node 24 and pnpm 11.19.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Then open `http://127.0.0.1:4173`. Other commands:

```sh
pnpm check                      # strict types, unit/integration tests, static build
pnpm test:browser               # the browser suite (WebGL2 via Metal or SwiftShader)
node scripts/lab.mjs --serve    # the asset lab: every *.lab.ts scene
node scripts/lab-shot.mjs <scene> --file <lab file> --out shot.png
node scripts/capture.mjs        # play a run and photograph it
node scripts/perf.mjs --dpr 2   # frame times in the running game
pnpm simulate -- --runs 1000 --policy random
```

## Controls

- Choose a track: click its tag on the windshield, press ← or →, or drag the lever in the cab.
- Pull the lever to commit: click **Pull the lever**, press Enter or Space, or release the dragged lever fully to one side.
- Escape cancels a selection. Nothing is ever chosen for you by waiting.
- Pause, settings and your record are always available, including during the horror.

**Settings:**
- Less motion (no optic flow)
- Less graphic detail (no blood)
- No flashing
- Sound and volume
- Drawing quality
- Scene descriptions for screen readers

## Privacy and research

- Your run stays in this browser. No account, no identifier, no model calls. Optional collection code exists but is disabled in this release.
- Shared statistics appear only for genuine eligible aggregates of at least 20 runs, and are never invented.
- See [privacy](docs/PRIVACY.md) and [methodology](docs/METHODOLOGY_V2.md).

This is a warning, not a forecast, a study or a morality score. The mechanisms it dramatizes are drawn from published research, which is cited in the game's sources drawer and in `research/`. Its numbers, people, institutions and probabilities are authored fiction.

## Licence

Code and original artwork are MIT licensed. Geist fonts are SIL OFL 1.1. Third-party dependencies keep their own licences. Cited research is not included under the project's licence.
