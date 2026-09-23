# T026/T027 preliminary evidence

This record describes a bounded illustration/motion spike, not an approved visual direction, complete campaign or G3 certification.

Historical record: this is the first spike. The September 23 owner-directed redesign removed the animated hand and face mirror, revised the controller, line weight, figures and rail geometry, and produced a separate 100-turn recording. Current implementation and evidence are in `GEOMETRIC_REDESIGN.md`; do not apply the old motion/performance observations below to the new renderer.

## Implemented

- Stable original line-drawn cabin and rear controller, mirror expressions, latching lever, hand/lever connection, state-driven landscape families, target kinds and optional landmarks.
- Pixi8/WebGL renderer with semantic/static SVG fallback; no input ownership or domain-state effects.
- Cumulative world path, matched approach/turn transition, uninterrupted cosmetic travel while reading, no route choice from waiting.
- Pause, reduced motion, reduced graphics, and optional original synthesized rail sound.
- Developer-only standalone harness at `public/assets/v2/spike.html`, compiled separately from `src/presentation/spike.ts`. It must be excluded from a public release artifact.

## Checks actually run

2026-09-22 local workstation, Codex in-app browser, 1280×720 viewport:

- Inspected beginning, useful-clinic, and scarred-authority frames. Fixed overlapping route targets, a disconnected drawn hand, and negative-modulo scenery wrapping found in review.
- Browser console error/warning query returned an empty list on these frames and during the repeated-turn run.
- A 180-frame requestAnimationFrame measurement during repeated transitions observed p95 17.60ms, p99 17.70ms, maximum 17.70ms, with `document.hidden=false`. This is a short desktop browser scheduling sample, not a full supported-device or renderer profiling certification.
- Five geometry tests passed: 100 mixed turns preserve cumulative pose; endpoint tangent continuity; local coordinate invariance; easing boundaries; negative travel wrapping over a long hold.
- Isolated strict TypeScript check passed for scene, geometry tests and harness.
- The first 100-turn browser smoke sequence reached `Motion stress: 100/100 turns`, with checkpoint inspection, pause/resume and no console warnings/errors. A second 100-turn run recorded the actual canvas through `captureStream(30)` and `MediaRecorder`. It completed and downloaded successfully. This separate run also had no captured console warnings/errors.
- Inspected 390×844 portrait composition and corrected stretched anatomy. The renderer now separates controller and mirror geometry because Pixi8's SVG parser ignores group transforms. This is viewport inspection, not a physical phone performance test.
- Inspected the integrated development app at 1280×800 and 390×844. A left choice followed by another left choice correctly required fresh selection and a grip commit each time. The desktop frame retained its connected hand and cabin composition. Phone review found detached route arrows, information controls crossing the landscape, and an instruction crossing the controller; these DOM/CSS issues were reported to the integration owner. The viewport override was reset after review.

## Recorded artifact

Local artifact: `reports/validation/motion/trolley-cabin-100-turns.webm`. Exclude this 31,406,547-byte review file from the Pages build and normal source history. SHA-256: `50b6c130c84282cdf2ddf0a79916bee8747fb315fbba6a49d6cf12e386ee9716`.

Browser metadata reports 2560×1440 video pixels (1280×720 CSS pixels at device-pixel ratio 2). A direct EBML read found 6,591 video blocks in 66 clusters; the final video timestamp is 221.479 seconds. MediaRecorder's original file omits a finite duration index, so this timestamp is not a claimed muxer-provided total duration. The recorded source predates the later idle sky/lever geometry cache and optional wind-audio addition; its motion geometry is unchanged.

A frame at 217.8 seconds decoded and was visually inspected in the browser. The reviewer tab crashed when native playback was started, so complete saved-file playback has **not** passed. That failure does not establish whether the file, native media control, or browser caused the crash. The live recording itself completed with checkpoint inspection. `docs/art/evidence/motion-review.html` is an optional local review wrapper; full external-player playback remains a gate.

## Remaining gates

Complete saved-file playback review of the recorded 100-junction sequence; 10-minute held-decision observation; full integrated input tests; actual phone GPU/performance and memory measurements; context-loss exercise; complete reduced-motion/graphics/muted journeys; owner frame review. No NVDA, VoiceOver, participant comprehension, physical phone or owner-approval claim is made here. Late visceral body/aftermath coverage remains a production art task after the visual gate.

The local fixture does not initialize a run, contact a collector or upload participant data. The generated JS bundle is a local QA artifact and should not be committed as a hand-edited source file.
