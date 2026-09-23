# UI replacement map

Owner revision: `docs/decisions/003-reference-and-conversation-redirection.md`.

| Change | Owning module | Contract |
| --- | --- | --- |
| Dilemma, option, assistant and bulletin copy | `src/content/prose.json`, `editorial.ts`, `slice.ts` | Allowlisted prose overlay on schema-validated mechanics. Editing prose creates a new content hash; preserve prior bundles for existing saves. |
| Replaceable side panels | `src/ui/panels.ts` | Receives view values, authored questions/history and explicit callbacks. It cannot commit choices or mutate campaign state. |
| Interface voice and execution receipts | `src/ui/copy.ts` | Distinguishes freely chosen, imposed-but-agreed and actually overridden actions. No authored text is executed as code. |
| Safe semantic elements | `src/ui/dom.ts` | Small text-based element helpers; no unsafe authored HTML. |
| Lever gestures | `src/ui/lever-input.ts` | Cancellable, disposable pointer handler. Cancellation releases capture and suppresses a trailing click; only the owning app callback can request a commit. |
| Page composition and input | `src/ui/app.ts` | Applies engine commands, persists before animation, and supplies panel/scene view models. Route selection and lever commitment are separate. |
| Layout, typography and density | `src/ui/shell.css`, `game.css` | Shell layout plus reusable controls; three desktop columns; normal-flow prompt, world, routes, toggle. At 900px, play, conversation and reports stack. No narrative element is positioned over canvas. |
| Illustration catalogue and states | `src/presentation/glyph-catalogue.ts`, `ink-art.ts`, `technical-art.ts`, `environment-art.ts` | Original layered cabin, terrain and architecture geometry, species/variant/pose/mood/damage, no gameplay authority. |
| Railway and camera | `src/presentation/geometry.ts`, `cabin-scene.ts` | Persistent world pose and geometry. Cosmetic time never advances fictional time. |
| Intensity curve | `src/presentation/visual-state.ts` | Maps supplied causal state to visual treatment, independently respects reduced graphic detail. |
| Persistence and replay editions | `src/persistence/`, `src/content/registry.ts` | Exact bundle lookup, immutable archive, conflict-aware local save. Unknown versions remain exportable; never reinterpret an old choice under new text. |

The canvas host is one persistent element moved into the current view, retaining its Pixi instance and resize observer. Main text takes natural height. Canvas has its own bounded row. Buttons wrap within independent cells; side panels scroll internally and never share a coordinate system with the drawing. The semantic DOM remains the real interaction surface, including reduced-motion mode.

The assistant is authored, with constrained suggested questions. There is no free-text box or remote model. Responses have local Thinking/streaming states, a full-reply shortcut and an expandable authored assessment. Only fully delivered replies are recorded as advice exposure; committing while one is pending cancels it. Reduced motion reveals the reply immediately. The panel owns disposable animation state, never gameplay state. The conversation shows recent exchanges from the current run, reconstructed from its pinned narrative bundle. News contains authored events from the run; no fabricated player statistics appear in these panels.

Instrument bars are reported fictional values: GDP index 0–2000, capability index 0–1000, fatalities 0–8 billion. Exact displayed values remain visible even if a bar is saturated. These are neither forecasts nor latent access to the simulation's hidden truth. Their accessible names explain the scale.

For a new panel, add a semantic renderer and input view type, then assign it a layout region. Avoid adding an absolute overlay to `#scene`. Keep deep explanations in the accessible information panel or run record. For a new content edition, register the exact pinned bundle and verify saved-run replay before changing the default.
