# Geometric cabin revision

September 23, 2026. Implementation following new owner visual feedback. This document records the revised renderer, not owner acceptance or a completed production art catalogue.

## Composition and source

The renderer retains the existing `createCabinScene` API and never changes simulation state. The root UI owns the central column and all prompt, route, toggle, dispatch and instrument text. The canvas contains a stable cabin with a rear-view uniformed controller, a compact physical lever, a mirror showing the railway behind, and a forward two-route landscape. The host's existing ResizeObserver continues to handle DOM relocation and new dimensions; no new scene instance is required when the shell moves the host.

- `ink-art.ts`: original vector structures, cabin, cap, rear collar/yoke, epaulettes, fixtures and physical surfaces; `InkGlyph` selects prebuilt poses.
- `glyph-catalogue.ts`: original cow, deer, pig, dog, rabbit and sheep drawings, each with four stepped walking/hopping poses; person and robot figures also have four poses. Human clothing has three silhouette variants. Calm, alert, injured and vacant appearances support stage progression. These are reusable source drawings, not external art or image-generation outputs.
- `visual-state.ts`: stage and consequence damage determine visual onset. Wall-clock time only animates scenery and gait; it cannot produce an injury or advance horror.
- `geometry.ts`: common approach, separated eased branches and cumulative world pose. Turns now reach ±0.52 radians, giving route objects useful separation in the smaller canvas.

There are 20 supported artwork kinds, eight of which have stepped pose sets. The 640 state/frame/reduced combinations used in the path-parsing regression are combinatorial checks; they are **not** 640 distinct authored assets or approved scenarios.

## Ink and depth

Foreground rail strokes are 2.4–3.2 CSS pixels according to host width, without tapering into weak foreground lines. Dense distant sleepers are omitted below 3.3 pixels of projected separation, and far rail segments fade. A shared rail pair is drawn once before the turnout; a point machine, frog and guard rails identify the switch. The physical branches share an approach and separate monotonically rather than crossing back over one another.

The live first revision exposed a Pixi SVG inheritance constraint: a child path's `stroke-width` was discarded unless that child also declared `stroke`. The cabin wrapper now supplies explicit child stroke colors with the intended widths. Main cabin contours are approximately 2–2.5 pixels in the reviewed 603-pixel-wide integrated view; smaller hatching remains lighter. This is visual inspection, not a pixel-measurement certificate.

Landscape population was reduced to 20 staggered placements with wider verge offsets. Distant animated figures are withheld when their projected scale cannot show a legible pose. Near objects retain their authored geometry. The cow landmark no longer overwrites the rabbit slot, preserving species variety.

## Gradual damage and reduced modes

Stage 1–2 permit no accumulated wear. Stages 3–5 gradually increase the fraction of consequence damage shown. Explicit red injury marks require both stage 6 or later and consequence damage above 0.6. Earlier structural cracks and repairs do not become full red injury merely because the player waited. An immaculate late biome can instead use vacant figures.

Less motion holds all animal/person poses and suppresses continuous travel; route commitments retain their short semantic transition. Less graphic detail replaces injury marks with non-red bandaging/torn-cloth marks and retains damaged structures. Scene descriptions describe the rear view, route geometry and representation mode. Composed left/right labels now strip terminal punctuation before adding a final period, addressing the doubled-punctuation finding in the previous reduced-mode check.

There is no animated hand, camera shake, random frame jitter or screen flash. The physical lever remains latching. Removing the moving hand is deliberate owner steering, not a change to the semantic commit contract.

## Failure behavior and validation

An initial art/GPU construction failure emits a developer warning, cleans up initialized audio/RAF/listeners/observers, and falls back to a static semantic scene. The host exposes `data-renderer-fallback="true"`; fallback is observable and must not be reported as successful renderer validation. `createFallbackScene` is exported for the UI's error recovery.

The initial rabbit path had a missing coordinate separator and failed in the browser despite a clean TypeScript check. It was repaired. A regression now sends every authored catalogue state/frame/reduced combination and all cabin paths through the actual Pixi `GraphicsPath` parser. This complements runtime browser inspection rather than replacing it.

Targeted checks include cumulative heading over 100 turns, shared approach and monotonic separation, endpoint tangent continuity, projection invariance, long negative cosmetic wrapping, deterministic distinct gait poses, reduced-graphic substitution, stage injury gates, and actual Pixi path parsing.

The first corrected integrated desktop frame was inspected at approximately 603 pixels of canvas width without a fallback. It showed heavier consistent cabin outlines, the separated turnout, sparse legible animals, rear-scene mirror and stationary uniformed controller. Root independently reviews the full narrative flow and responsive shell. New motion evidence is recorded separately below; the first spike's video is not evidence for this geometry.

## Current evidence and open gates

The revised local fixture uses a 620-pixel-wide canvas with the same 603:392 aspect as the integrated desktop illustration. Its DOM fixture controls are not part of the recorded canvas. The fixture is excluded from the public build. Recording output uses the distinct name `trolley-cabin-geometric-100-turns.webm`.

The new live recording completed **100/100 turns** on September 23. It exercised repeated and alternating directions across all four fixture views. Actual benefit and scarred-world frames were inspected during recording. The browser's captured warning/error query returned `[]`. The video was downloaded through the fixture's visible download link and copied into the ignored validation directory at approximately 04:43 UTC.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `reports/validation/motion/trolley-cabin-geometric-100-turns.webm` | 20,345,249 | `360b00d96b85c1e2ca1dd6b88dd08c6f383559c151e6b2dafff73df516f01b23` |
| `reports/validation/screenshots/geometric-motion-benefit.png` | 56,217 | `1449364f3938d7f5f497a95f585af6fa187b05cbcb2d8e6935682dabf7ca86cb` |
| `reports/validation/screenshots/geometric-motion-late.png` | 60,572 | `101b97abd2054c2c899877d81ae94540bbc56b69ade9054f8cb31e07b1d2f38d` |
| `reports/validation/screenshots/geometric-static-late.png` | 64,730 | `879ba9dcdf223857a1cce26c941e299ce567c244dc65af30661005ebc8aae4a3` |
| `reports/validation/screenshots/geometric-reduced-late.png` | 64,654 | `a001da1e92d48fee41bc96116562e1d75ebaef06db2ae9b98916e22a59e9e500` |

A direct EBML structural read found VP9, 1236 × 802 video pixels, 6,636 video blocks in 66 clusters, and a final block timestamp of 221.242 seconds. This is the actual 618 × 401 interior canvas at device-pixel ratio 2; the CSS wrapper includes a one-pixel border. These are structural metadata and live-run evidence, not a claim that the saved video has been decoded end to end. The separately compiled fixture bundle was 552,889 bytes with SHA-256 `fb6af8aa17779fb416a11bee0b8ebc4d2f8d43907b1d3decf3586100309898d4`.

After the recording, the fixture was switched through its visible stage controls to the scarred view with Reduced motion enabled. Toggling Reduced graphics preserved the same route, figures, cracks and actuator while changing red injury marks into non-red cloth/bandage marks. Both versions were inspected and saved. These are same-scene renderer checks, not proof of full campaign narrative equivalence. Both temporary browser tabs were then closed, without changing the global viewport.

The final renderer source passed strict TypeScript checking and all ten targeted presentation tests. Owner art review, real device/assistive-technology testing, a new full performance budget, and full campaign late-graphic equivalence remain open. The earlier spike's frame timing sample and recording do not certify this new artwork or geometry.

### Complete saved-file playback

The new saved WebM subsequently passed a complete, naturally ending playback in the Codex in-app Chromium browser. This closes the saved-file playback gap for **this new recording only**. It does not retroactively validate the older recording that crashed its review tab.

The local `reports/review/playback.html` wrapper loaded the original WebM through native `<video controls muted>`. The visible **Play from beginning (muted)** button was activated once at `2026-09-23T04:46:55.658Z`. No seek or pause control was activated. The decoded middle and late images were visually inspected while the file played. The video emitted its natural `ended` event at `2026-09-23T04:50:36.935Z`.

Final visible/native state:

- `currentTime: 221.242`, `duration: 221.242`, `ended: true`, `paused: true`, `muted: true`, `readyState: 4`.
- `videoWidth: 1236`, `videoHeight: 802`, `playRequests: 1`, `seekActions: 0`, `error: null`.
- Native playback quality reported 6,636 total frames and 42 dropped presentation frames, approximately 0.63%. Completion is verified; frame-perfect presentation and a renderer performance budget are **not** claimed.
- The media event log showed an initial `waiting`/`canplay` pair at 0.011 seconds, followed immediately by `playing`. Its only later `pause` occurred together with `ended` at the final timestamp. No stall or media error was recorded.
- The captured browser warning/error query returned `[]`. The original Downloads file and review copy were byte-identical. The built `dist` contained no WebM, spike, or playback-wrapper files.

The final decoded frame and completion state are saved as `reports/validation/screenshots/geometric-playback-final-frame.png` and `geometric-playback-complete.png`. The temporary playback tab was closed after inspection. The review wrapper is a local validation artifact, not game code or participant telemetry.

Completion screenshot: 54,578 bytes, SHA-256 `333d4437045cc06c09bb6c6c0c5ca70d1bfe3540f802eb856bca6ff2561103c5`. Final-frame screenshot: 76,518 bytes, SHA-256 `1628cb77e4ee0a721a1fa84b56fa3ed5389efd74adbf3f7d999d5ed515b63816`.
