# Cabin presentation contract

The scene accepts a view model and exposes presentation actions only. Domain effects, outcomes, consent, timers and input commitment belong to the engine/UI.

`createCabinScene(host, settings)` resolves to `update(view)`, `commit(side, executor)`, `pause(bool)`, `settings(patch)`, `describe()` and `destroy()`.

`commit` animates an already committed route. Its promise resolves when the visual transition completes. A repeated call during the transition returns the existing transition promise. Pausing suspends visual travel and completion; destruction resolves an outstanding transition so UI teardown cannot hang. Reduced motion changes the presentation, not the result.

The physical handle latches to the last committed side. New-decision arming is a UI state, independent of physical position. Tap either route then tap the grip is the universal input. Dragging to the opposite detent is an optional shortcut. Waiting and pressing an unarmed grip never choose a route. There is no hidden outward microgesture for repeating a side.

Canceling pointer input, blur, settings or Escape cannot call `commit`. The main UI must keep both semantic options, a truthful current-course label, and separate attempted/executed action records. The renderer cannot fabricate an override.

The renderer uses a cumulative planar path. Its local camera is sampled from that path; selected junctions never reset global heading to zero. Travel during an uncommitted decision loops cosmetic sleepers and verge details without moving the junction closer. The global path advances only for a visual commit.

Accessibility: semantic text remains outside the canvas, no reliance on sound, separate reduced motion and reduced graphic settings. `describe()` returns an accurate compact description of the current scene; callers choose when to announce it. No continuous live-region noise.

Fallback after GPU failure is a static SVG illustration plus the same semantic UI. This is not a claim that Pixi has a Canvas2D backend.
