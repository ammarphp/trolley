export type Side = "left" | "right";
export interface Point {
  x: number;
  z: number;
}
export interface Pose extends Point {
  heading: number;
}
export interface RouteSegment {
  start: Pose;
  side: Side;
  length: number;
  angle: number;
  loopSide?: Side;
}

export const clamp = (value: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, value));
export const wrap = (value: number, period: number) =>
  ((value % period) + period) % period;
export const smoothstep = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (value: number) => {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** A heading-eased arc, integrated with a fixed midpoint quadrature. No random state. */
export function routePose(segment: RouteSegment, distance: number): Pose {
  const length = Math.max(0.001, segment.length);
  const d = clamp(distance, 0, length);
  const direction = segment.side === "left" ? -1 : 1;
  const steps = Math.max(1, Math.ceil(d * 8));
  const step = d / steps;
  let x = segment.start.x,
    z = segment.start.z;
  for (let i = 0; i < steps; i++) {
    const heading =
      segment.start.heading +
      direction * segment.angle * smootherstep(((i + 0.5) * step) / length);
    x += Math.sin(heading) * step;
    z += Math.cos(heading) * step;
  }
  return {
    x,
    z,
    heading:
      segment.start.heading +
      direction * segment.angle * smootherstep(d / length),
  };
}

export function localPoint(point: Point, camera: Pose): Point {
  const dx = point.x - camera.x,
    dz = point.z - camera.z;
  return {
    x: dx * Math.cos(camera.heading) - dz * Math.sin(camera.heading),
    z: dx * Math.sin(camera.heading) + dz * Math.cos(camera.heading),
  };
}

export function offsetPoint(pose: Pose, offset: number): Point {
  return {
    x: pose.x + Math.cos(pose.heading) * offset,
    z: pose.z - Math.sin(pose.heading) * offset,
  };
}

export function advance(pose: Pose, distance: number): Pose {
  return {
    x: pose.x + Math.sin(pose.heading) * distance,
    z: pose.z + Math.cos(pose.heading) * distance,
    heading: pose.heading,
  };
}

/** The eye is behind the controller/front contact point in the same rigid cabin.
 * This offset applies throughout travel, including an ordinary reading hold;
 * stopping never moves the camera backwards or changes the physical route pose.
 */
export const CABIN_EYE_OFFSET = 5.5;
export function cabinEye(pose: Pose): Pose {
  return advance(pose, -CABIN_EYE_OFFSET);
}

export function junctionPose(start: Pose, side: Side, distance: number): Pose {
  if (distance <= 8) return advance(start, distance);
  const segment = { start: advance(start, 8), side, length: 18, angle: 0.52 };
  if (distance <= 26) return routePose(segment, distance - 8);
  return advance(routePose(segment, 18), distance - 26);
}

/** A real returning siding: tangent-continuous at both ends, not an X crossing. */
export function railPose(
  start: Pose,
  side: Side,
  distance: number,
  loopSide?: Side,
): Pose {
  if (!loopSide) return junctionPose(start, side, distance);
  if (side !== loopSide || distance <= 8 || distance >= 26)
    return advance(start, distance);
  const t = (distance - 8) / 18,
    sign = side === "left" ? -1 : 1;
  const offset = sign * 3 * Math.sin(Math.PI * t) ** 2;
  const slope = ((sign * 3 * Math.PI) / 18) * Math.sin(2 * Math.PI * t);
  return {
    x:
      start.x +
      Math.sin(start.heading) * distance +
      Math.cos(start.heading) * offset,
    z:
      start.z +
      Math.cos(start.heading) * distance -
      Math.sin(start.heading) * offset,
    heading: start.heading + Math.atan(slope),
  };
}

/** Perspective in normalized screen units. Valid only in front of the near plane. */
export function project(point: Point, width: number, height: number) {
  const denominator = Math.max(0.55, point.z + 1.2);
  const scale = 1 / denominator;
  return {
    x: width * 0.5 + point.x * width * 0.74 * scale,
    y: height * 0.23 + height * 3.8 * scale,
    scale,
  };
}

/** Staging distances shared by track targets, brakes and the camera stop. */
export const LOOP_CONTACT_DISTANCE = 17;
export const LOOP_BRAKE_DISTANCE = 22;
export const LOOP_MAIN_DISTANCE = 30;
export const FRONT_BUFFER_DISTANCE = 1.2;
export interface RailTravelPlan {
  endDistance: number;
  travelDuration: number;
  holdDuration: number;
  stoppedBy: string | null;
  staticTravel: boolean;
}
export function railTravelPlan(
  loopSide: Side | undefined,
  stoppedBy: string | null,
  reducedMotion: boolean,
): RailTravelPlan {
  // Unknown future stop IDs stay at the first contact, never beyond an obstruction.
  const contact =
    stoppedBy === "independent-brake"
      ? LOOP_BRAKE_DISTANCE
      : LOOP_CONTACT_DISTANCE;
  return {
    endDistance: stoppedBy
      ? contact - FRONT_BUFFER_DISTANCE
      : loopSide
        ? LOOP_MAIN_DISTANCE + 4
        : 26,
    travelDuration: reducedMotion ? 0.08 : 2.2,
    holdDuration: stoppedBy ? (reducedMotion ? 0.08 : 0.55) : 0,
    stoppedBy,
    staticTravel: reducedMotion,
  };
}
export function railTravelAt(
  plan: RailTravelPlan,
  elapsed: number,
  reducedMotion: boolean,
) {
  const fraction = clamp(elapsed / plan.travelDuration);
  // Physical stops decelerate to zero; the visible hold never overshoots contact.
  const progress = plan.stoppedBy ? 1 - (1 - fraction) ** 3 : fraction;
  return {
    distance:
      reducedMotion || plan.staticTravel
        ? plan.endDistance
        : plan.endDistance * progress,
    holding: Boolean(plan.stoppedBy) && elapsed >= plan.travelDuration,
    complete: elapsed >= plan.travelDuration + plan.holdDuration,
  };
}

/** Maintains the cumulative world pose; committing does not recenter heading. */
export class RouteGeometry {
  pose: Pose = { x: 0, z: 0, heading: 0 };
  segment: RouteSegment | null = null;
  loopSide?: Side;
  begin(side: Side) {
    if (this.segment) return this.segment;
    this.segment = {
      start: { ...this.pose },
      side,
      length: 18,
      angle: 0.52,
      ...(this.loopSide ? { loopSide: this.loopSide } : {}),
    };
    return this.segment;
  }
  sample(progress: number, endDistance = 26) {
    return this.segment
      ? railPose(
          this.pose,
          this.segment.side,
          clamp(progress) * endDistance,
          this.segment.loopSide,
        )
      : { ...this.pose };
  }
  finish(endDistance = 26) {
    if (this.segment)
      this.pose = railPose(
        this.pose,
        this.segment.side,
        endDistance,
        this.segment.loopSide,
      );
    this.segment = null;
    return { ...this.pose };
  }
}
