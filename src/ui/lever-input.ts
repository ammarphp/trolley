import type { Side } from "../contracts/index.ts";

export interface LeverActions {
  busy: () => boolean;
  /** The side the lever stands on now (the armed route), or null at the centre. */
  current: () => Side | null;
  preview: (side: Side | null) => void;
  commit: (side: Side) => void;
}
export interface LeverHandle {
  cancel: () => void;
  dispose: () => void;
}
/**
 * Optional drag shortcut. Ordinary route buttons and toggle remain independent.
 * Like the lever in the cab, a drag commits the side it is pulled toward once
 * it travels far enough; a short drag or a cancellation leaves things as they were.
 */
export function wireDrag(
  grip: HTMLButtonElement,
  actions: LeverActions,
): LeverHandle {
  let drag: { id: number; x: number } | null = null;
  let suppress = false;
  let disposed = false;
  /** An Enter/Space press on the grip that has not been released yet. */
  let keyHeld = false;
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
    // Only a gesture under way (a drag, a held key) can produce a stray click.
    // Swallowing a later, unrelated activation would eat an assistive-technology "press".
    if (drag || keyHeld) suppress = true;
    release();
    actions.preview(actions.current());
  };
  grip.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || drag || actions.busy()) return;
      suppress = false;
      drag = { id: event.pointerId, x: event.clientX };
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
      const crossed = Math.abs(dx) > 35;
      release();
      if (crossed) {
        suppress = true;
        actions.commit(next);
      } else actions.preview(actions.current());
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
      if (!event.repeat && (event.key === "Enter" || event.key === " ")) {
        suppress = false;
        keyHeld = true;
      }
    },
    options,
  );
  grip.addEventListener(
    "keyup",
    (event) => {
      if (event.key === "Enter" || event.key === " ") keyHeld = false;
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
