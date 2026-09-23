import assert from "node:assert/strict";
import test from "node:test";
import {
  RouteGeometry,
  routePose,
  localPoint,
  project,
  smootherstep,
  wrap,
  junctionPose,
} from "./geometry.ts";

test("100 alternating and repeated turns retain position and cumulative heading", () => {
  const path = new RouteGeometry();
  let expectedHeading = 0;
  for (let i = 0; i < 100; i++) {
    const side = i % 7 < 5 ? "left" : "right";
    const start = { ...path.pose };
    const segment = path.begin(side);
    assert.deepEqual(path.sample(0), start);
    assert.equal(path.begin(side), segment);
    const end = path.sample(1);
    assert.deepEqual(path.finish(), end);
    expectedHeading += side === "left" ? -0.52 : 0.52;
    assert.ok(Math.abs(path.pose.heading - expectedHeading) < 1e-10);
    assert.ok(Number.isFinite(path.pose.x) && Number.isFinite(path.pose.z));
    assert.ok(Math.hypot(end.x - start.x, end.z - start.z) > 17);
  }
  assert.notEqual(path.pose.heading, 0);
});

test("the two routes share one approach and separate monotonically after the turnout", () => {
  const start = { x: 19, z: -4, heading: 1.2 };
  for (const distance of [0, 2, 4, 6, 8])
    assert.deepEqual(
      junctionPose(start, "left", distance),
      junctionPose(start, "right", distance),
    );
  let previous = 0;
  for (let distance = 8; distance <= 60; distance += 0.5) {
    const left = localPoint(junctionPose(start, "left", distance), start);
    const right = localPoint(junctionPose(start, "right", distance), start);
    const separation = right.x - left.x;
    assert.ok(separation >= previous - 1e-9);
    assert.ok(left.x <= 1e-9 && right.x >= -1e-9);
    previous = separation;
  }
  assert.ok(previous > 30);
});

test("pose and tangent are continuous at both junction ends", () => {
  const segment = {
    start: { x: 3, z: 9, heading: 0.4 },
    side: "right" as const,
    length: 18,
    angle: 0.31,
  };
  const e = 1e-4;
  const first = routePose(segment, 0),
    next = routePose(segment, e);
  const before = routePose(segment, 18 - e),
    end = routePose(segment, 18);
  assert.ok(
    Math.abs(Math.atan2(next.x - first.x, next.z - first.z) - 0.4) < 1e-4,
  );
  assert.ok(
    Math.abs(Math.atan2(end.x - before.x, end.z - before.z) - 0.71) < 0.004,
  );
  assert.deepEqual(first, segment.start);
});

test("local projection is invariant under translated and rotated world origins", () => {
  const local = localPoint(
    { x: 12, z: 5 },
    { x: 10, z: 5, heading: Math.PI / 2 },
  );
  assert.ok(Math.abs(local.x) < 1e-12);
  assert.ok(Math.abs(local.z - 2) < 1e-12);
  const screen = project(local, 1440, 900);
  assert.ok(Math.abs(screen.x - 720) < 1e-9);
});

test("easing clamps and has stationary end derivatives", () => {
  assert.equal(smootherstep(-1), 0);
  assert.equal(smootherstep(2), 1);
  assert.ok(smootherstep(0.001) < 1e-7);
  assert.ok(1 - smootherstep(0.999) < 1e-7);
});

test("cosmetic scenery wraps for negative travel over a long reading hold", () => {
  for (let i = 0; i < 100000; i += 31)
    assert.ok(wrap(-i * 0.13, 76) >= 0 && wrap(-i * 0.13, 76) < 76);
  assert.ok(Math.abs(wrap(-0.1, 76) - 75.9) < 1e-9);
});
