import test from "node:test";
import assert from "node:assert/strict";
import { Journey, HOLD_BEFORE_TOE, PASSAGE_END, STOP_BUFFER, type Stake } from "../../src/render/world/journey.ts";
import { TrackNetwork } from "../../src/render/world/track/network.ts";
import { TrackLine } from "../../src/render/world/track/path.ts";
import { createRng } from "../../src/render/core/rng.ts";

const run = (j: Journey, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) j.tick(dt);
};

test("an undecided fork is approached forever but never reached", () => {
  const j = new Journey("approach");
  run(j, 1);
  j.prepare("d1", []);
  run(j, 240);
  assert.equal(j.phase, "approach");
  assert.ok(j.toToe >= HOLD_BEFORE_TOE - 0.05, `stopped ${j.toToe.toFixed(2)} m before the toe`);
  assert.ok(j.toToe < HOLD_BEFORE_TOE + 1.5, "and it did arrive at the hold point");
  assert.ok(j.rig.speed >= 0 && j.rig.speed < 0.2, "crawling, not stopped dead");
});

test("the approach is brisk: close enough to read within ~16 s", () => {
  const j = new Journey("brisk");
  run(j, 1);
  j.prepare("d1", []);
  run(j, 16);
  assert.ok(j.toToe < HOLD_BEFORE_TOE + 6, `after 16 s the toe is ${j.toToe.toFixed(1)} m away`);
});

test("commit resolves after passage and lands on the executed branch", async () => {
  const j = new Journey("passage");
  run(j, 1);
  const junction = j.prepare("d1", []);
  run(j, 20);
  let resolved = false;
  const p = j.commit("right", null).then(() => (resolved = true));
  for (let i = 0; i < 60 * 20 && !resolved; i++) {
    j.tick(1 / 60);
    await Promise.resolve();
  }
  await p;
  assert.ok(resolved);
  assert.equal(j.rig.line, junction.right);
  assert.ok(j.rig.s >= PASSAGE_END - 0.5);
  assert.equal(j.phase, "cruise");
  assert.equal(junction.left.abandoned, true);
});

test("contacts fire once, only for stakes on the executed side", async () => {
  const hits: Array<[string, number]> = [];
  const j = new Journey("contacts", { onContact: (side, s) => hits.push([side, s]) });
  run(j, 1);
  const stakes: Stake[] = [
    { side: "left", s: 26, struck: true },
    { side: "left", s: 27, struck: true },
    { side: "right", s: 26, struck: true },
    { side: "left", s: 30, struck: false },
  ];
  j.prepare("d1", stakes);
  run(j, 20);
  const p = j.commit("left", null);
  for (let i = 0; i < 60 * 20; i++) {
    j.tick(1 / 60);
    await Promise.resolve();
  }
  await p;
  assert.deepEqual(hits, [
    ["left", 26],
    ["left", 27],
  ]);
});

test("a brake stop halts short of the obstruction and never overshoots", async () => {
  const j = new Journey("brake");
  run(j, 1);
  const junction = j.prepare("d1", [{ side: "left", s: 26, struck: true }]);
  run(j, 18);
  let maxS = 0;
  const p = j.commit("left", { s: 26 });
  for (let i = 0; i < 60 * 25; i++) {
    j.tick(1 / 60);
    if (j.rig.line === junction.left) maxS = Math.max(maxS, j.rig.s);
    await Promise.resolve();
  }
  await p;
  assert.equal(j.phase, "stopped");
  assert.ok(maxS <= 26 - STOP_BUFFER + 0.2, `max ${maxS.toFixed(2)} stays behind the stop point`);
});

test("reduced motion cuts: no optic flow, and commit resolves at once", async () => {
  const j = new Journey("still");
  j.reducedMotion = true;
  run(j, 2);
  const before = j.rig.s;
  const junction = j.prepare("d1", [{ side: "left", s: 26, struck: true }]);
  assert.equal(j.toToe, HOLD_BEFORE_TOE, "cut straight to the hold point");
  run(j, 5);
  assert.ok(Math.abs(j.toToe - HOLD_BEFORE_TOE) < 1e-6, "and stayed there");
  void before;
  await j.commit("left", null);
  assert.equal(j.rig.line, junction.left);
});

test("settle() resolves an in-flight passage (pause and destroy safety)", async () => {
  const j = new Journey("settle");
  run(j, 1);
  j.prepare("d1", []);
  run(j, 20);
  const p = j.commit("left", null);
  j.settle();
  await p;
  assert.equal(j.phase, "cruise");
});

test("prepare() is idempotent for the same decision", () => {
  const j = new Journey("idem");
  run(j, 1);
  const a = j.prepare("d1", []);
  const b = j.prepare("d1", [{ side: "left", s: 25, struck: true }]);
  assert.equal(a, b);
});

test("fork branches separate clearly where the stakes stand", () => {
  const n = new TrackNetwork("sep");
  const j = n.createJunction(100, "k");
  const l = j.left.pose(30);
  const r = j.right.pose(30);
  assert.ok(Math.hypot(l.x - r.x, l.z - r.z) > 14, "more than 14 m apart 30 m past the toe");
  // Tangent continuity at the toe: branches leave along the stem's heading.
  assert.ok(Math.abs(j.left.pose(0).heading - j.stem.pose(100).heading) < 1e-9);
});

test("track lines are deterministic from their seed", () => {
  const a = new TrackLine(1, { x: 0, z: 0, heading: 0 }, createRng("x"), [], null);
  const b = new TrackLine(1, { x: 0, z: 0, heading: 0 }, createRng("x"), [], null);
  a.extendTo(500);
  b.extendTo(500);
  assert.deepEqual(a.pose(437.3), b.pose(437.3));
});

test("a long line of stakes is met in full before the passage completes", async () => {
  const hits: number[] = [];
  const j = new Journey("long-line", { onContact: (_side, s) => hits.push(s) });
  run(j, 1);
  // Thirty people along the branch, the last well beyond the usual passage length.
  const stakes: Stake[] = Array.from({ length: 30 }, (_, i) => ({ side: "left" as const, s: 15 + i * 1.6, struck: true }));
  j.prepare("d1", stakes);
  run(j, 20);
  let resolved = false;
  const p = j.commit("left", null).then(() => (resolved = true));
  for (let i = 0; i < 60 * 30 && !resolved; i++) {
    j.tick(1 / 60);
    await Promise.resolve();
  }
  await p;
  assert.equal(hits.length, 30, "every stake on the taken branch was met");
  assert.ok(j.rig.s >= stakes.at(-1)!.s, "and the trolley is past the last of them");
});

test("in reduced motion a long line of stakes is met in full by the cut", async () => {
  const hits: number[] = [];
  const j = new Journey("long-line-cut", { onContact: (_side, s) => hits.push(s) });
  j.reducedMotion = true;
  const stakes: Stake[] = Array.from({ length: 30 }, (_, i) => ({ side: "right" as const, s: 15 + i * 1.6, struck: true }));
  j.prepare("d1", stakes);
  await j.commit("right", null);
  assert.equal(hits.length, 30);
});

test("a fork laid beyond the drawn frontier is joined by drawn track before the cab arrives", () => {
  const j = new Journey("far-toe");
  run(j, 1);
  const junction = j.prepare("d1", [], { minToe: j.rig.s + 320 });
  for (let i = 0; i < 60 * 90 && j.toToe > HOLD_BEFORE_TOE + 1; i++) {
    j.tick(1 / 60);
    // The pen always stays ahead of the cab.
    assert.ok(junction.stem.drawTo >= Math.min(junction.toe, j.rig.s + 20), `drawn to ${junction.stem.drawTo.toFixed(1)} with the cab at ${j.rig.s.toFixed(1)}`);
  }
  assert.ok(junction.stem.drawTo >= junction.toe - 0.5, "the stem is drawn all the way to the toe");
  assert.ok(junction.stem.drawTo <= junction.toe + 1e-6, "and not beyond it");
});

test("switching to less motion mid-approach cuts to the hold point", () => {
  const j = new Journey("cut-to-hold");
  run(j, 1);
  const junction = j.prepare("d1", [], { minToe: j.rig.s + 300 });
  run(j, 3);
  assert.ok(j.toToe > HOLD_BEFORE_TOE + 50, "still well short of the fork");
  j.reducedMotion = true;
  j.cutToHold();
  assert.ok(Math.abs(j.toToe - HOLD_BEFORE_TOE) < 1e-6, `at the hold point (${j.toToe.toFixed(2)} m)`);
  assert.equal(j.rig.speed, 0);
  assert.ok(junction.stem.drawTo >= junction.toe - 1e-6, "the stem is drawn to the toe");
});
