/**
 * Track lines: arc-length parametrised curves in the world XZ plane, grown
 * forward from a programme of eased curves and straights.
 *
 * Heading convention: heading 0 travels toward -Z. Positive heading turns
 * right (+X). forward = (sin h, -cos h), right = (cos h, sin h).
 * Curvature is eased with smootherstep so tangents stay continuous at every
 * join (no kinks at the fork or where one bend hands over to the next).
 */
import type { Rng } from "../../core/rng.ts";

export interface TrackPose {
  x: number;
  z: number;
  heading: number;
}

export type TrackSegment =
  | { kind: "straight"; length: number }
  | { kind: "curve"; length: number; turn: number }
  /** Constant curvature, as in a real turnout leaving the toe. */
  | { kind: "arc"; length: number; turn: number };

const STEP = 1; // metres between stored samples

function smootherstepDerivative(t: number): number {
  // d/dt of 6t^5 - 15t^4 + 10t^3
  return 30 * t * t * (t - 1) * (t - 1);
}

export class TrackLine {
  readonly id: number;
  readonly origin: TrackPose;
  /** Packed (x, z, heading) per metre. */
  private data: Float64Array;
  private count = 0;
  private queue: TrackSegment[] = [];
  private segment: TrackSegment | null = null;
  private segmentS = 0;
  private generator: ((line: TrackLine) => TrackSegment) | null;
  /** How far along this line the pen has drawn (renderer visibility). */
  drawTo = 0;
  /** Stop growing the drawing beyond this (e.g. the stem at a junction toe). */
  drawLimit = Infinity;
  /** Lines stop being extended once abandoned. */
  abandoned = false;
  readonly rng: Rng;

  constructor(id: number, origin: TrackPose, rng: Rng, program: TrackSegment[] = [], generator: ((line: TrackLine) => TrackSegment) | null = null) {
    this.id = id;
    this.origin = { ...origin };
    this.rng = rng;
    this.queue = [...program];
    this.generator = generator;
    this.data = new Float64Array(3 * 1024);
    this.push(origin.x, origin.z, origin.heading);
    this.extendTo(2);
  }

  get length(): number {
    return (this.count - 1) * STEP;
  }

  private push(x: number, z: number, h: number): void {
    if (this.count * 3 + 3 > this.data.length) {
      const next = new Float64Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.count * 3] = x;
    this.data[this.count * 3 + 1] = z;
    this.data[this.count * 3 + 2] = h;
    this.count++;
  }

  private nextSegment(): TrackSegment {
    const queued = this.queue.shift();
    if (queued) return queued;
    if (this.generator) return this.generator(this);
    return { kind: "straight", length: 200 };
  }

  /** Grow the line until it is at least `s` metres long. */
  extendTo(s: number): void {
    while (this.length < s) {
      if (!this.segment || this.segmentS >= this.segment.length - 1e-9) {
        this.segment = this.nextSegment();
        this.segmentS = 0;
      }
      const i = this.count - 1;
      let x = this.data[i * 3]!;
      let z = this.data[i * 3 + 1]!;
      let h = this.data[i * 3 + 2]!;
      // Integrate one metre with sub-steps for accuracy on tight curves.
      const sub = 4;
      for (let k = 0; k < sub; k++) {
        const ds = STEP / sub;
        let kappa = 0;
        const seg = this.segment;
        if (seg.kind === "curve") {
          const tMid = Math.min(1, (this.segmentS + ds / 2) / seg.length);
          kappa = (seg.turn * smootherstepDerivative(tMid)) / seg.length;
        } else if (seg.kind === "arc") {
          kappa = seg.turn / seg.length;
        }
        const hMid = h + (kappa * ds) / 2;
        x += Math.sin(hMid) * ds;
        z -= Math.cos(hMid) * ds;
        h += kappa * ds;
        this.segmentS += ds;
      }
      this.push(x, z, h);
    }
  }

  /** Pose at arc length s (clamped to what has been generated). */
  pose(s: number, out: TrackPose = { x: 0, z: 0, heading: 0 }): TrackPose {
    if (s > this.length) this.extendTo(s);
    const f = Math.max(0, Math.min(this.length, s)) / STEP;
    const i = Math.min(this.count - 2, Math.floor(f));
    const t = f - i;
    const a = i * 3;
    const b = a + 3;
    out.x = this.data[a]! + (this.data[b]! - this.data[a]!) * t;
    out.z = this.data[a + 1]! + (this.data[b + 1]! - this.data[a + 1]!) * t;
    out.heading = this.data[a + 2]! + (this.data[b + 2]! - this.data[a + 2]!) * t;
    return out;
  }

  /** Position offset laterally (+ right) from the centreline at s. */
  offset(s: number, lateral: number, out: TrackPose = { x: 0, z: 0, heading: 0 }): TrackPose {
    this.pose(s, out);
    out.x += Math.cos(out.heading) * lateral;
    out.z += Math.sin(out.heading) * lateral;
    return out;
  }

  /** Iterate stored samples in [s0, s1]. */
  *samples(s0: number, s1: number): Generator<[number, number, number, number]> {
    const i0 = Math.max(0, Math.floor(s0 / STEP));
    const i1 = Math.min(this.count - 1, Math.ceil(s1 / STEP));
    for (let i = i0; i <= i1; i++) yield [i * STEP, this.data[i * 3]!, this.data[i * 3 + 1]!, this.data[i * 3 + 2]!];
  }
}

/** A gently meandering country line: long straights, sweeping bends. */
export function meander(rng: Rng, restless = 0): (line: TrackLine) => TrackSegment {
  let turnNext = rng.chance(0.5);
  return () => {
    turnNext = !turnNext;
    if (!turnNext) return { kind: "straight", length: rng.range(70, 220) };
    const magnitude = rng.range(0.12, 0.34 + restless * 0.2);
    return { kind: "curve", length: rng.range(140, 320), turn: (rng.chance(0.5) ? 1 : -1) * magnitude };
  };
}

/** Programme for a branch diverging to one side of a symmetric fork. */
export function branchProgramme(side: -1 | 1, theta: number, rng: Rng): TrackSegment[] {
  // A tight turnout radius (~40 m) so the two routes separate while their
  // occupants are still close enough to see, then a long easing back.
  return [
    { kind: "arc", length: 25, turn: side * theta },
    { kind: "straight", length: rng.range(24, 40) },
    { kind: "curve", length: rng.range(110, 170), turn: -side * theta * rng.range(0.55, 0.85) },
  ];
}
