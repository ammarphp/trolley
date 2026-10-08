# Interface and rendering modules

The interface is a full-viewport drawn world behind a glass HUD ([ADR 006](../decisions/006-ink-world-overhaul.md)). The semantic DOM stays the real interaction surface: every control in the world (route tags, the lever) has an accessible DOM twin, and nothing the renderer does can commit a choice or touch campaign state.

| Concern | Module | Contract |
| --- | --- | --- |
| Page composition, input and the research order | `src/ui/app.ts` | Applies engine commands. Commit → record → persist happens before any animation. Route selection and lever commitment are separate steps. The active clock runs only while a decision is visible and the page has attention; after a stage change it starts when the decision is revealed beyond the tunnel. |
| The world host | `src/ui/world-host.ts` | Creates the ink renderer (or the static fallback) and projects the campaign into it through the presentation director. The only place the UI touches rendering. |
| Presentation director | `src/presentation/derive.ts` | Pure function from the immutable campaign to a `StageView`: environment channels, time of day, the controller's face, glass damage, receipts, scripted cues and the staging of the current fork. |
| Renderer contract | `src/render/api.ts` | `WorldRenderer`: `update`, `commit`, `setLever`, `pause`, `settings`, `describe`, anchors for the HUD, lever input, `whenClear` (resolves once a stage tunnel is behind the cab). `commit` always resolves, including when paused, in reduced motion or after context loss. |
| The ink world | `src/render/world-renderer.ts`, `src/render/world/` | Track network and journey, scenery, tableaux, tunnels, lineside poles and wires, river crossings, the cab and its camera. Cosmetic time never advances fictional time; cosmetic randomness is seeded. |
| Asset seam | `src/render/assets.ts`, `src/render/assets-real.ts` | The director asks for things by id; the provider builds them from the procedural library. A placeholder provider keeps the renderer runnable in tests. |
| Fork staging | `src/render/staging/` | What stands on each branch of all 154 forks, keyed by node and option id, outside the hashed content bank. |
| Morrow's window | `src/ui/components/morrow/` | Receives authored questions, history and callbacks. Only fully delivered replies count as advice exposure; committing while one is pending cancels it. No free text, no remote model. |
| Instruments | `src/ui/components/instruments/` | Reported fictional values with their provenance (GDP index, capability, fatalities; population, power, care and food from stage 5). Hidden before stage 4. Never the simulation's hidden truth. |
| The wire | `src/ui/components/wire/`, `src/ui/wire/`, `src/ui/brand/` | Authored news plus a seeded ambient feed of fictional outlets and accounts that turns to bots as the run goes on. Presentation only; it never reaches the journal. |
| Glossary and history cards | `src/ui/components/glossary/`, `src/ui/content/` | Hover and focus definitions with registry-honest sources; dilemma history cards. |
| Debrief | `src/ui/components/debrief/` | The ending as an editorial debrief: causal receipts, hidden facts revealed after the fact, and an authority timeline. |
| Interface voice | `src/ui/copy.ts` | Distinguishes freely chosen, imposed-but-agreed and actually overridden actions. No authored text is executed as code. |
| Lever gestures | `src/ui/lever-input.ts` | Cancellable, disposable pointer handler. Cancellation releases capture and suppresses a trailing click; only the app can request a commit. |
| Layout and type | `src/ui/theme.css`, `shell.css`, `game.css` | Tokens, the glass HUD and component styles. Geist and Geist Mono, self-hosted. Narrow screens stack the HUD over a shorter world. |
| Persistence and replay editions | `src/persistence/`, `src/content/registry.ts` | Exact bundle lookup, immutable archive, conflict-aware local save. Never reinterpret an old choice under new text. |

## Rules for changes

- A new panel gets a semantic renderer and an input view type, and is placed by the HUD layout (`positionHud` in `app.ts`), which keeps panels clear of the face mirror and the route tags.
- Anything shown over the world must have a DOM equivalent reachable by keyboard and screen reader. The world itself is described in words by `WorldRenderer.describe()`.
- Display preferences (no flashing, drawing quality, volume) live in their own local key. `Preferences` stays exactly four booleans, because it feeds comparison keys.
- For a new content edition, register the exact pinned bundle and verify saved-run replay before changing the default.
