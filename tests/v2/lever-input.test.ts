import test from "node:test";
import assert from "node:assert/strict";
import { wireDrag } from "../../src/ui/lever-input.ts";
import type { Side } from "../../src/contracts/index.ts";

// Event-handler contract harness; this is not a browser/pointer-device test.
class Grip extends EventTarget {
  classes = new Set<string>();
  captured = new Set<number>();
  classList = {
    add: (value: string) => this.classes.add(value),
    remove: (value: string) => this.classes.delete(value),
  };
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
    this.pointer("lostpointercapture", 0, id);
  }
  pointer(type: string, x: number, id = 1) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: id, button: 0, clientX: x });
    this.dispatchEvent(event);
  }
  key(key: string, repeat = false) {
    const event = new Event("keydown");
    Object.assign(event, { key, repeat });
    this.dispatchEvent(event);
  }
  click() {
    const event = new Event("click", { cancelable: true });
    this.dispatchEvent(event);
    return event.defaultPrevented;
  }
}
function fixture() {
  const grip = new Grip(),
    commits: Side[] = [],
    previews: Side[] = [];
  let ordinaryClicks = 0,
    busy = false;
  const handle = wireDrag(grip as unknown as HTMLButtonElement, {
    busy: () => busy,
    latched: () => "right",
    preview: (side) => previews.push(side),
    commit: (side) => commits.push(side),
  });
  // A browser runs the capture listener before the ordinary click handler.
  grip.addEventListener("click", () => ordinaryClicks++);
  return {
    grip,
    handle,
    commits,
    previews,
    clicks: () => ordinaryClicks,
    setBusy: (value: boolean) => {
      busy = value;
    },
  };
}

test("Escape-equivalent cancellation blocks release and its delayed trailing click", async () => {
  const f = fixture();
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointermove", 0);
  f.handle.cancel();
  assert.equal(f.grip.hasPointerCapture(1), false);
  assert.equal(f.grip.classes.has("dragging"), false);
  assert.equal(f.previews.at(-1), "right");
  f.grip.pointer("pointerup", 0);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(f.grip.click(), true);
  assert.deepEqual(f.commits, []);
  assert.equal(f.clicks(), 0);
});

test("a noncrossing ordinary click remains available to the two-phase control", () => {
  const f = fixture();
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointerup", 103);
  assert.equal(f.grip.click(), false);
  assert.equal(f.clicks(), 1);
  assert.deepEqual(f.commits, []);
  assert.equal(f.grip.hasPointerCapture(1), false);
});

test("a normal crossing commits once and consumes its trailing click", async () => {
  const f = fixture();
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointermove", 0);
  f.grip.pointer("pointerup", 0);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(f.commits, ["left"]);
  assert.equal(f.grip.click(), true);
  assert.equal(f.clicks(), 0);
  assert.equal(f.grip.click(), false, "the suppressed click is consumed once");
  assert.equal(f.clicks(), 1);
});

test("new pointer or keyboard activation clears an unconsumed cancellation", () => {
  const f = fixture();
  f.handle.cancel();
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointerup", 100);
  assert.equal(f.grip.click(), false);
  for (const key of ["Enter", " "]) {
    f.handle.cancel();
    f.grip.key(key);
    assert.equal(f.grip.click(), false);
  }
  f.handle.cancel();
  f.grip.key("Enter", true);
  assert.equal(f.grip.click(), true, "a held key is not a new gesture");
  assert.equal(f.clicks(), 3);
});

test("pointer cancellation and unexpected capture loss both prevent commitment", () => {
  for (const event of ["pointercancel", "lostpointercapture"]) {
    const f = fixture();
    f.grip.pointer("pointerdown", 100);
    f.grip.pointer("pointermove", 0);
    f.grip.pointer(event, 0);
    f.grip.pointer("pointerup", 0);
    assert.equal(f.grip.click(), true);
    assert.deepEqual(f.commits, []);
    assert.equal(f.clicks(), 0);
    assert.equal(f.grip.hasPointerCapture(1), false);
  }
});

test("dispose releases capture and removes all drag callbacks idempotently", () => {
  const f = fixture();
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointermove", 0);
  f.handle.dispose();
  assert.equal(f.grip.hasPointerCapture(1), false);
  const previews = [...f.previews];
  f.handle.dispose();
  f.handle.cancel();
  f.grip.pointer("pointerup", 0);
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointermove", 0);
  f.grip.pointer("pointerup", 0);
  assert.deepEqual(f.commits, []);
  assert.deepEqual(f.previews, previews);
  assert.equal(f.grip.hasPointerCapture(1), false);
});

test("an unrelated pointer cannot finish the gesture, and becoming busy cancels it", () => {
  const f = fixture();
  f.grip.pointer("pointerdown", 100);
  f.grip.pointer("pointerup", 0, 2);
  assert.equal(f.grip.hasPointerCapture(1), true);
  f.setBusy(true);
  f.grip.pointer("pointerup", 0);
  assert.equal(f.grip.click(), true);
  assert.deepEqual(f.commits, []);
});
