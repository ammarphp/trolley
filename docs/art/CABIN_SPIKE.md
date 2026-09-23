# Cabin illustration and motion spike

Status: revised after the owner's substantial visual steering. The September 23 geometric redesign supersedes the first spike's composition and mirror/hand treatment. See `GEOMETRIC_REDESIGN.md`. The owner has approved the wider work, not these final rendered frames. No visual gate is implied.

## Three reference compositions

1. **Ordinary work.** Warm white paper, near-black ink, broad empty sky, a small field and awkward animals. A fixed cabin, visible rear controller, mirror and physical lever make this a place to inhabit. Motion belongs to the track and world, not to a trolley icon sliding sideways.
2. **Useful assistance.** The same cabin and countryside, now with a working clinic, power distribution and orderly service machinery. Benefits look genuinely good. Institutional changes appear as small physical additions rather than a dashboard covering the windshield.
3. **Control without ownership.** The cabin still works. Earlier damage, fatigue and a permitted actuator remain; an immaculate machine landscape can coexist with bodily harm. Late drawn injury has a separate reduced-graphic representation. The scene does not change real controls or claim a physical effect from elapsed wall time.

## Style rules

- White/off-white ground, near-black ink, subdued field green and restrained brick red. Dark mass and shadow are hatched or filled sparingly.
- Authored curved silhouettes and line irregularity; no randomized per-frame stroke jitter. Three weight tiers, bold foreground and finer distance.
- Figures are expressive, awkward, adult stick figures with individually posed limbs. Machines inherit the same drawn language.
- Frame and controller remain stable. The controller has a cap, rear collar, shoulder yoke and uniform. There is no animated hand. The high mirror reflects the receding track and landscape, rather than a face from an impossible angle.
- Rails and sparse passing verge marks are rebuilt per frame. A single shared approach becomes a defined two-branch turnout. Cabin art and landmarks retain stable geometry; animated figures select prebuilt stepped poses. Only the physical lever changes position during a control action.
- DOM is responsible for all readable prompts, choices, controls, real statistics and accessibility. The canvas never owns game state.

## Composition reservation

The driving view now occupies the central column, approximately 50% of the desktop shell. Prompt and choices live above and below the canvas in normal document flow. The upper portion of the illustration is entirely available to the landscape. The lower cabin rim is a quiet physical background. The controller is cropped at the lower edge; the right-side lever and rear-scene mirror remain recognizable. DOM instruments and dispatch occupy separate panels controlled by the UI integration.

## Gate and limits

Before production art: inspect beginning/benefit/late frames at desktop and phone, then a 100-junction recording. Test pause, held reading, alternating and repeated turns, reduced motion, reduced graphics and silent play. Measure an actual declared device, not only emulation. Renderer success is not owner approval.

All illustration geometry is original source authored in `src/presentation/ink-art.ts` and `glyph-catalogue.ts`; it is not a complete production asset library. Optional ambient sound is original WebAudio synthesis in `src/presentation/rail-audio.ts`, with no samples or external recordings.

References used for implementation: [Pixi WebGL renderer](https://pixijs.com/8.x/guides/components/renderers), [stable Graphics geometry](https://pixijs.com/8.x/guides/components/scene-objects/graphics), [performance guidance](https://pixijs.com/8.x/guides/concepts/performance-tips).
