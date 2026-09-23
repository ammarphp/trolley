import assert from "node:assert/strict";
import test from "node:test";
import {
  FRONT_BUFFER_DISTANCE,
  LOOP_CONTACT_DISTANCE,
  LOOP_BRAKE_DISTANCE,
  LOOP_MAIN_DISTANCE,
  railTravelPlan,
  railTravelAt,
  railPose,
  RouteGeometry,
  cabinEye,
  localPoint,
  project,
} from "./geometry.ts";
import { bindCampaignPhysics } from "../content/campaign-physics.ts";
import { SLICE_NODES } from "../content/slice.ts";
import { STAGE2_ADDITIONAL } from "../content/campaign/stage2.ts";

test("all four rail cases draw the threatened people in semantic option order", () => {
  const nodes = [...SLICE_NODES, ...STAGE2_ADDITIONAL];
  for (const reversed of [false, true]) {
    const input = structuredClone(nodes);
    if (reversed) input.forEach((n) => n.options.reverse());
    const bound = bindCampaignPhysics(input);
    for (const [id, main, count] of [
      ["S2-01", "stay", 5],
      ["S2-02", "stay", 1],
      ["S2-03", "continue", 5],
      ["S2-04", "main", 5],
    ] as const) {
      const n = bound.find((n) => n.id === id)!;
      assert.deepEqual(n.scene.figures, {
        left: n.options[0].id === main ? count : 1,
        right: n.options[1].id === main ? count : 1,
      });
      assert.deepEqual(n.scene.figureKind, { left: "person", right: "person" });
      assert.ok(
        n.options.every((o) => !o.effects.some((e) => e.kind === "casualties")),
      );
    }
    assert.deepEqual(
      input,
      reversed
        ? nodes.map((n) => ({
            ...structuredClone(n),
            options: [...structuredClone(n.options)].reverse(),
          }))
        : nodes,
    );
  }
});

test("a physical stop never passes the obstruction and visibly holds before resolving", () => {
  for (const side of ["left", "right"] as const)
    for (const [stop, contact] of [
      ["siding-worker", LOOP_CONTACT_DISTANCE],
      ["independent-brake", LOOP_BRAKE_DISTANCE],
    ] as const) {
      const plan = railTravelPlan(side, stop, false);
      assert.equal(plan.endDistance + FRONT_BUFFER_DISTANCE, contact);
      let previous = 0;
      for (let elapsed = 0; elapsed < 6; elapsed += 0.01) {
        const state = railTravelAt(plan, elapsed, false);
        assert.ok(state.distance >= previous - 1e-10);
        assert.ok(state.distance <= contact - FRONT_BUFFER_DISTANCE);
        previous = state.distance;
      }
      const arrival = railTravelAt(plan, plan.travelDuration, false);
      assert.equal(arrival.holding, true);
      assert.equal(arrival.complete, false);
      const held = railTravelAt(
        plan,
        plan.travelDuration + plan.holdDuration / 2,
        false,
      );
      assert.equal(held.distance, arrival.distance);
      assert.equal(held.complete, false);
      assert.equal(
        railTravelAt(plan, plan.travelDuration + plan.holdDuration, false)
          .complete,
        true,
      );
    }
});

test("brake stop follows the worker, while unblocked loop reaches the group beyond the join", () => {
  const worker = railTravelPlan("left", "siding-worker", false);
  const brake = railTravelPlan("left", "independent-brake", false);
  const through = railTravelPlan("left", null, false);
  assert.ok(worker.endDistance < LOOP_CONTACT_DISTANCE);
  assert.ok(brake.endDistance > LOOP_CONTACT_DISTANCE);
  assert.ok(brake.endDistance < LOOP_BRAKE_DISTANCE);
  assert.ok(through.endDistance > LOOP_MAIN_DISTANCE);
  assert.equal(railTravelPlan(undefined, null, false).endDistance, 26);
});

test("a stopped turn retains its precise world pose when the next scene begins", () => {
  for (const side of ["left", "right"] as const) {
    const route = new RouteGeometry();
    route.pose = { x: 43, z: -12, heading: 1.37 };
    route.loopSide = side;
    const start = { ...route.pose };
    const plan = railTravelPlan(side, "siding-worker", false);
    route.begin(side);
    const stopped = route.sample(1, plan.endDistance);
    assert.deepEqual(stopped, railPose(start, side, plan.endDistance, side));
    assert.notEqual(stopped.heading, start.heading);
    assert.deepEqual(route.finish(plan.endDistance), stopped);
    route.loopSide = undefined;
    route.begin(side);
    assert.deepEqual(route.sample(0), stopped);
  }
});

test("reduced motion uses a static outcome, including if motion is re-enabled mid-transition", () => {
  const plan = railTravelPlan("right", "independent-brake", true);
  const start = railTravelAt(plan, 0, true);
  assert.equal(start.distance, plan.endDistance);
  assert.equal(start.complete, false);
  assert.equal(railTravelAt(plan, 0.04, false).distance, plan.endDistance);
  assert.equal(railTravelAt(plan, 0.08, true).holding, true);
  assert.equal(railTravelAt(plan, 0.16, true).complete, true);
});

test("both loop stops retain the contact and downstream group inside the windshield", () => {
  // A real translated/rotated origin catches screen-space shortcuts. The eye is
  // always mounted behind the same physical pose, not switched when a stop lands.
  const start = { x: 39, z: -24, heading: 1.83 };
  for (const side of ["left", "right"] as const)
    for (const [stop, contact] of [
      ["siding-worker", LOOP_CONTACT_DISTANCE],
      ["independent-brake", LOOP_BRAKE_DISTANCE],
    ] as const) {
      const plan = railTravelPlan(side, stop, false);
      const physical = railPose(start, side, plan.endDistance, side);
      const eye = cabinEye(physical);
      for (const target of [
        railPose(start, side, contact, side),
        railPose(
          start,
          side === "left" ? "right" : "left",
          LOOP_MAIN_DISTANCE,
          side,
        ),
      ]) {
        const local = localPoint(target, eye);
        assert.ok(local.z > 1);
        const screen = project(local, 650, 380);
        assert.ok(screen.x > 650 * 0.12 && screen.x < 650 * 0.88);
        assert.ok(screen.y > 380 * 0.23 && screen.y < 380 * 0.73);
      }
      const route = new RouteGeometry();
      route.pose = start;
      route.loopSide = side;
      route.begin(side);
      assert.deepEqual(cabinEye(route.finish(plan.endDistance)), eye);
    }
});
