# Technical ink reference revision

23 September 2026. This supersedes the earlier geometric revision as the active art direction. The owner rejected the earlier scene as too sparse and immature. The prior 100-turn video is historical engineering evidence, not acceptance of this artwork.

## Direction and reference use

The supplied clean cabin reference (`85a2ae75`), detailed cabin reference (`cad07729`) and late industrial reference (`caed01c8`) were viewed directly. The useful cues are a built windshield frame, dimensional surfaces, a layered railway landscape, varied line weights, restrained red, and a coherent material language that can deteriorate. Literal text, names, statistics, excessive labels, implausible mirror faces and the references' exact compositions are not copied.

All delivered drawings are original vector construction. There are no imported textures or raster reference images in the renderer. The cabin remains a stable third-person view from behind a uniformed conductor. The physical lever moves; no hand does. The high mirror shows the railway behind.

## Implementation

- `src/presentation/technical-art.ts` supplies the shared ink/material palette and original metal construction. The cabin has nested windshield seals, bevelled side pillars, a sloped dashboard, inset instrument panels, recessed gauges, fasteners, vents, a task lamp, conduit, edge highlights and limited fixed etched wear. The conductor has a rear cap fastening, rear collar/yoke, shoulder seams and coat folds. The unlabelled gauges are decorative hardware and make no independent claims about campaign state; the semantic UI owns actual values.
- `src/presentation/environment-art.ts` supplies layered sky/hills/terrain and a distant settlement that becomes infrastructure. Structural sprites now include dimensional houses, clinic, server buildings, ruins, varied trees, bare trees and machine columns. Irregular architectural clusters replace isolated skyline bars. Industrial pipes, broken roofs and smoke distinguish later environments; immaculate architecture has regular roof forms and does not receive generic damage cracks. Original hatching, shaded side faces, roofing, windows, ducts, porches, branches and foundations distinguish these objects.
- `src/presentation/glyph-catalogue.ts` uses slimmer adult human proportions, clothing variants and articulated machine joints. Cow, deer, pig, dog, rabbit and sheep now use more natural haunch/chest/neck contours, outlined jointed legs, hooves or feet, and smaller anatomical marks. Species-specific four-pose gaits and reduced-graphic states are retained.
- `src/presentation/cabin-scene.ts` projects ballast beds, small deterministic gravel marks, dimensional sleepers and metal rail highlights onto the existing route geometry. The point machine, frog and guard rails remain visible. A dimensional red mechanical grip replaces the flat lever. Distant backdrop parallax is slight; the cabin does not shake.
- `src/presentation/ink-art.ts` composes the new sources with the existing cached sprite lifecycle. Scene API, controls, content, authority rules and simulation state are unchanged.

The shared approach is still drawn once. Branches share the turnout then separate monotonically. Cosmetic time drives travel and authored gait frames only. It cannot cause new injury, make a route choice, or advance a narrative stage. Reduced motion holds travel and poses; reduced graphics substitutes non-red cloth/bandage marks for graphic injury while retaining consequence damage.

## Validation boundary

The first implementation passes strict TypeScript checking and all ten targeted presentation tests. The actual Pixi `GraphicsPath` parser now checks every cabin path, all 49 biome/stage backdrops, all structural variants, and the existing catalogue state/frame/reduced combinations. This guards against the previously encountered SVG path failure, but does not prove composition, GPU performance, or rendering fidelity.

An initial integrated desktop view was inspected in the actual Chromium renderer, followed by all four visible developer-fixture biomes (field, lab, scarred and pristine). The captured warning/error queries were empty and the scenes rendered normally. The review prompted a more coherent rear-mirror landscape, roofed distant farm buildings, stronger foliage hierarchy, more natural animal silhouettes and architectural skyline clusters. In the scarred fixture with Less motion enabled, toggling Less graphic detail visibly removed red injury marks while preserving figures, damaged buildings, cracks and route geometry. These are bounded renderer observations, not complete campaign equivalence tests.

The final post-polish field, clinic, scarred and pristine frames were inspected in the actual renderer. A new 100-turn, four-biome capture completed with no browser warnings/errors. The saved-file playback check is recorded separately below. Owner visual acceptance, a new performance budget, real-phone inspection and assistive-technology review remain open. No old recording is being relabelled as evidence for the new art. No deployment or publishability claim is made.


## Fresh recording and final frame evidence

The developer fixture was rebuilt after the final animal and skyline changes. Its bundle is 565,354 bytes with SHA-256 `dbbb8a659204fcdee55fc191c49260a611be68c6331591282dabf3b76850bbdb`. It retains the narrow central-canvas desktop composition. The capture contains only the rendered canvas, with no fixture controls, participant records or live aggregate data.

The visible **Record 100 turns** control completed all 100 consecutive commitments through field, lab, scarred and pristine views. No art source or viewport changes occurred during capture. Native browser warnings/errors queried during and after the run were empty. Downloaded recording:

- `reports/validation/motion/trolley-cabin-reference-100-turns.webm`
- 22,366,026 bytes.
- SHA-256 `39629f1656d7fb9a2be90d5a6ad8daa9668ecb66d663af2c3d5b48626d721da1`.
- Native initial decoding reports 1236 × 802 pixels.

This is a new recording. The `geometric` and first `cabin` recordings retain their original filenames and historical status. The WebM is ignored by Git, and the production build excludes the fixture and local evidence/review pages.

Final frame evidence is saved in `reports/validation/screenshots/`:

- `reference-benefit.png`: clinic, proportional adult figures, dimensional buildings and the final architectural skyline.
- `reference-pristine.png`: regular clean architecture, robots and persistent cabin wear.
- `reference-scarred.png` and `reference-scarred-reduced.png`: same frozen scene and route with normal versus reduced graphic detail. Injury marks change to non-red substitutes; architecture, cracks, actuator and route remain legible.

These are renderer-fixture checks. They do not establish campaign branching correctness, a physical phone performance budget, screen-reader usability, or owner approval.

### Saved-file playback

`reports/review/reference-playback.html` loads the original saved file through a muted native HTML video element. Its visible **Play from beginning (muted)** control was activated once at `2026-09-23T05:22:55.622Z`. The file reached its natural end at `2026-09-23T05:26:37.323Z`. No seek or pause control was used. The final native state was:

- `currentTime = duration = 221.676`, `ended: true`, `paused: true`, `muted: true`, `readyState: 4`.
- `videoWidth: 1236`, `videoHeight: 802`, `playRequests: 1`, `seekActions: 0`, `error: null`.
- 6,572 total frames and 113 dropped presentation frames reported by the native player, approximately 1.72%. Complete playback is established; frame-perfect presentation and a renderer performance budget are not.
- The event log recorded initial buffering at 0.014 seconds and a `waiting`/`canplay` pair lasting roughly 3 milliseconds at 31.520 seconds. It recorded no `stalled` or media error. The final `pause` coincided with the natural `ended` event.
- The captured browser warning/error query was empty. The original Downloads file and the local review copy are byte-identical.

`reference-playback-complete.png` records readable native state and the event log. `reference-playback-final-frame.png` shows the final decoded scene and native 3:41 / 3:41 control state. Both are under `reports/validation/screenshots/` and were visually inspected after saving. The natural playback closes the saved-file decoding gate for this new recording only. It does not grant owner approval or establish real-device performance.
