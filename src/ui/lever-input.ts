import type { Side } from "../contracts/index.ts";

export interface LeverActions {
  busy: () => boolean;
  latched: () => Side;
  preview: (side: Side) => void;
  commit: (side: Side) => void;
}
export interface LeverHandle {
  cancel: () => void;
  dispose: () => void;
}
/** Optional drag shortcut. Ordinary route buttons and toggle remain independent. */
export function wireDrag(
  grip: HTMLButtonElement,
  actions: LeverActions,
): LeverHandle {
  let drag: { id: number; x: number; side: Side } | null = null;
  let suppress = false;
  let disposed = false;
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const release = () => {
    const active = drag;
    // Clear first: releasing capture can synchronously dispatch its loss event.
    drag = null;
    grip.classList.remove("dragging");
    if (active && grip.hasPointerCapture(active.id))
      grip.releasePointerCapture(active.id);
  };
  const cancel = () => {
    if (disposed) return;
    suppress = true;
    release();
    actions.preview(actions.latched());
  };
  grip.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || drag || actions.busy()) return;
      suppress = false;
      drag = { id: event.pointerId, x: event.clientX, side: actions.latched() };
      grip.setPointerCapture(event.pointerId);
      grip.classList.add("dragging");
    },
    options,
  );
  grip.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 35) actions.preview(dx > 0 ? "right" : "left");
    },
    options,
  );
  grip.addEventListener(
    "pointerup",
    (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (actions.busy()) {
        cancel();
        return;
      }
      const dx = event.clientX - drag.x;
      const next: Side = dx > 0 ? "right" : "left";
      const crossed = Math.abs(dx) > 35 && next !== drag.side;
      release();
      if (crossed) {
        suppress = true;
        actions.commit(next);
      } else actions.preview(actions.latched());
    },
    options,
  );
  grip.addEventListener(
    "pointercancel",
    (event) => {
      if (drag?.id === event.pointerId) cancel();
    },
    options,
  );
  grip.addEventListener(
    "lostpointercapture",
    (event) => {
      if (drag?.id === event.pointerId) cancel();
    },
    options,
  );
  grip.addEventListener(
    "keydown",
    (event) => {
      // A new keyboard activation must work even when the cancelled pointer did
      // not produce a click. Repeats are still part of the earlier gesture.
      if (!event.repeat && (event.key === "Enter" || event.key === " "))
        suppress = false;
    },
    options,
  );
  grip.addEventListener(
    "click",
    (event) => {
      if (suppress) {
        suppress = false;
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    { ...options, capture: true },
  );
  return {
    cancel,
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      controller.abort();
    },
  };
}
