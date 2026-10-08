# Implementation checkpoint — 7 October 2026

The 154-dilemma campaign runs in a new real-time ink world ([ADR 006](../decisions/006-ink-world-overhaul.md)). The simulation, the content bank and its hashes are unchanged: current content is `33630493964e3613acaa98e9a825a1698059805f2a73de0cf7bea47dc96bdde3`, manifest `fc07d4f2808f970c8855d458984ccaa7cd45da2212ebf0190cdfb54297fd1e56`, version `2.0.0-campaign.1`, and four earlier slice bundles keep exact replay.

## Implemented

| Area | Evidence and practical boundary |
| --- | --- |
| Campaign | 154 reviewed nodes in stage counts 12/18/24/28/28/24/20; phased openings, optional middles and mandatory resolutions; 27–43-choice journeys with legitimate earlier endings; eight ending families. [Bank](../narrative/CAMPAIGN_BANK.md). |
| Rendering | Three.js world drawn as pen and ink: hatching and stippling from real lighting and shadows, contours from inverse-depth creases, a closed palette of meaningful pigments. One continuous journey with constant-radius turnouts, an approach that never reaches the fork, stage tunnels, telegraph routes, river crossings with bridges, and streamed scenery driven by environment channels. [Write-up](../render/RENDERING.md). |
| Asset library | Procedural people with poses and roles, animals, vehicles and machines, props and documents, civic and industrial buildings, trees and ground cover, terrain, sky and weather, the cab, and the controller's face in the left mirror. Each family has a lab sheet and a cab's-eye view. [Conventions](../render/ASSET_KIT.md). |
| Staging | Every fork of all 154 nodes is staged, outside the hashed bank. Staging checks pass for stages 1–7 (`scripts/staging-check-*.mjs`). |
| Interface | Glass HUD over the world: dispatch card, windshield route tags pinned to each branch, a lever dock that mirrors the cab's lever, Morrow's window, instruments, the wire, glossary cards, scripted disruptions and an editorial debrief. [Module map](../architecture/UI_MODULES.md). |
| Audio | Original synthesized score and rail ambience; `scripts/audio-check.mjs` renders every cue offline with no clipping or NaN. |
| Persistence and research contracts | Commit → record → persist before animation; advice counted only once fully shown; the active clock runs only while a decision is visible; `Preferences` stays four booleans; collection stays disabled. Saved runs resume into the same world, face and glass. |

## Verification on this checkpoint

- `pnpm typecheck`, `pnpm test` (16 legacy and 246 v2 tests) and `pnpm build` pass.
- `pnpm test:browser` passes against the WebGL2 ink renderer: explicit choice, cancellation, crash-resume, pause, HUD layout, phone reflow, ending, charts and private/opt-out request isolation.
- `pnpm inspect:content` reports 154 executable and reviewed nodes with no errors; `pnpm collector:build` builds the wrapper without provisioning anything.
- Frame times measured headless on Apple silicon (Metal) at 1440×900: 16.7 ms median through the first decisions, with occasional single dropped frames.
- Full runs were played and photographed with `scripts/capture.mjs`; stage transitions, tunnels, crossings and the ending were inspected frame by frame.

## Open scope

- Physical-device performance, VoiceOver/NVDA/Safari, 400% zoom, long-run memory and WebGL context loss remain to be verified on real hardware.
- A 30–45-minute experience has not been established by timed human playtesting.
- Runs recorded under the old renderer are not comparable with runs under this one; any future comparison must be keyed by presentation version.
- The broader CR003 institutional, obligation and capacity-ledger model is not fully implemented; some policy distinctions remain facts over coarse permissions.
- The optional collection service requires its own deployment, retention and withdrawal verification before it is enabled. Formal study recruitment is inactive.
