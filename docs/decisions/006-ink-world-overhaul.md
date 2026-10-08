# ADR 006: A real-time ink world and a glass interface

25 September 2026. The owner reviewed the campaign release and found the presentation below the project's ambition: the asset library looked juvenile; the page did not read as a serious technical project, a credible AI-safety artifact, or an emotionally evocative work. They asked for the most ambitious version of the project, delivered as one thorough overhaul, and published through `ammarphp/trolley`.

This decision supersedes the "No React/Vite/3D rewrite" clause in `docs/plan/ACCEPTED_PLAN.md` and the layout constraint that kept the drawing in a half-width card. It keeps every simulation, content, persistence, telemetry and privacy boundary from ADR 001–005.

## Decision

1. **Rendering.** Replace the Pixi 2.5D sprite renderer with a Three.js (r186, MIT) world rendered as pen and ink:
   - Materials write *ink coverage* rather than colour. Coverage is computed from Lambert lighting and shadow maps as procedural hatching or stippling.
   - A composite pass draws contours from the Laplacian of inverse depth, normal creases and object ids, fading them with distance.
   - Pigment is a closed palette of seven meanings (`src/render/core/palette.ts`).
2. **The world.**
   - A streamed rail network with constant-radius turnouts.
   - An asymptotic approach, so reading time is unlimited while the world keeps moving.
   - World scatter whose density follows continuous environment channels derived from the campaign.
   - A staged tableau on every fork (authored per node, outside the hashed content bank).
   - Stage tunnels.
   - A first-person cab whose left mirror shows the controller's face.
3. **Interface.** A full-viewport world behind a glass HUD:
   - a dispatch card for the prompt;
   - route tags pinned to each branch on the windshield;
   - a lever dock that mirrors the 3D lever (which also responds to direct drag);
   - Morrow's window on the left, clear of the mirror;
   - instruments and the wire on the right;
   - self-hosted Geist and Geist Mono.
4. **Audio.** An original synthesized score and rail ambience (Web Audio). No sample files.
5. **Presentation director.** `src/presentation/derive.ts` is a pure function from the immutable Campaign to a `StageView`. Resume and replay therefore reproduce the same world, face, glass and cues. The renderer never reads or writes simulation state and never draws simulation randomness.

## Boundaries kept

- Content hashes are unchanged. Staging, cues and entity art live in presentation modules keyed by node and option id. Saved runs from `2.0.0-campaign.1` resume unchanged.
- `Preferences` (the telemetry profile) remains four booleans. New display settings (no flashing, drawing quality, volume) live in a separate local key and never enter comparison keys.
- Scripted disruptions (freeze, false dawn, logo flash, reply revision, jam) are diegetic:
  - they never block the main thread, drop input, or alter the journal;
  - pause and settings stay live;
  - flashes respect a no-flashing setting.
- Collection remains disabled. The stats chip shows only genuine eligible aggregates at n ≥ 20.
- Stage tunnels hold the next dilemma until the cab is out of the far portal (14 s at most, skippable with any key or a click). The decision is not interactive while held, and the active clock starts only when it is revealed, so time spent in the tunnel never counts as deliberation. Reduced motion skips the tunnel entirely.

## Consequences

- The research stimulus has changed. Aggregates recorded against the Pixi renderer are not directly comparable with runs under this renderer. Any future comparison must be keyed by presentation version.
- WebGL2 is required for the drawn world. Browsers without it get a static drawing with the same controls and descriptions (`src/render/fallback.ts`). CI runs the browser suite on SwiftShader.
- Tests that pinned the Pixi glyph catalogue were retired with it. The renderer-agnostic geometry, stop physics and stage-gate tests remain. New tests cover the journey and the presentation director.
