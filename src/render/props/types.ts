import type * as THREE from "three";
import type { Rng } from "../core/rng.ts";

export interface BuildCtx {
  rng: Rng;
  seed: string;
  label?: string;
  /** Stable variant index chosen from the seed (builders take it modulo their count). */
  variant: number;
  /** Paper objects that will be stood up drop loose items (a pen) that would look glued on. */
  pose?: "flat" | "propped";
}

export interface Footprint {
  width: number;
  depth: number;
  height: number;
}

/**
 * How the object expects to be placed:
 *  - "surface": base on whatever it rests on (a rail head, a sleeper, the ground).
 *  - "track": origin is the rail-top plane at the centre of the track; it spans both rails.
 *  - "ground": stands on the formation beside the line (posts, furniture).
 */
export type Placement = "surface" | "track" | "ground";

export interface Built {
  object: THREE.Group;
  footprint: Footprint;
  /**
   * How much a requested readability scale applies (0 = never enlarge, keep
   * real size beside people; 1 = full). Furniture and anything a person could
   * sit in or carry is kept near real size.
   */
  scalable: number;
  placement: Placement;
}
