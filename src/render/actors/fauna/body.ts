/**
 * Shared types for species builders and the helpers that tie a lofted
 * surface to anatomical landmarks.
 */
import * as THREE from "three";
import type { LoftMesh } from "./loft.ts";
import type { RigDef } from "./rig.ts";
import type { SpeciesAtlas } from "./coat.ts";

export interface BuildCtx {
  /** Coat variant index. */
  variant: number;
  /** 0 healthy .. 1 drought-thin (ribs, hollow flank, prominent hips). */
  thin: number;
  /** Ring/segment multiplier: 1 near, ~0.5 far. */
  detail: number;
  atlas: SpeciesAtlas;
  /** Stable per-variant seed for geometric asymmetries. */
  seed: number;
}

export interface BodyBuild {
  geometry: THREE.BufferGeometry;
  rig: RigDef;
  /** Bone rest positions in mesh space. */
  rest: THREE.Vector3[];
  /** Rest position of the muzzle / beak tip (for grazing and pecking reach). */
  muzzle: THREE.Vector3;
  /** Height at the withers / back (m). */
  height: number;
  /** Nose-to-tail length (m). */
  length: number;
}

/** Surface point and outward direction of a loft at (s, theta). */
export function surface(l: LoftMesh, s: number, theta: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const p = l.pointAt(s, theta);
  const f = l.frameAt(s);
  const n = p.clone().sub(f.c);
  // Remove the tangential part so the direction is truly outward.
  n.addScaledVector(f.t, -n.dot(f.t)).normalize();
  return { p, n };
}
