/**
 * Public and shared types for fauna.
 */
import type * as THREE from "three";
import type { AnimalId, EnvironmentTarget } from "../../api.ts";
import type { BodyBuild, BuildCtx } from "./body.ts";

export type Behavior = "graze" | "walk" | "alert" | "flee" | "rest";
export type Reaction = "flinch" | "struck";

/** Per-species locomotion and posture for four-legged animals. */
export interface QuadMotion {
  /** Walk: speed (m/s) and stride frequency (Hz) at that speed. */
  walk: [speed: number, freq: number];
  trot: [speed: number, freq: number];
  run: [speed: number, freq: number];
  runGait: "gallop" | "bound" | "trot";
  /** Moves by hopping at every speed (rabbits). */
  hop?: boolean;
  /** Leg lengths (m) used to turn stride length into swing angle. */
  foreLen: number;
  hindLen: number;
  /** Swing-phase flexion multiplier (1 = cattle). */
  flex: number;
  /** Muzzle height to reach when grazing / rooting / sniffing. */
  grazeY: number;
  /** Share of the grazing reach taken by neck1, neck2, head. */
  reach: [number, number, number];
  /** Alert head carriage (neck1, neck2, head pitch; negative = up). */
  alert: [number, number, number];
  /** Relaxed standing head carriage. */
  stand: [number, number, number];
  /** Resting posture. */
  lie: "sternal" | "sphinx" | "doze" | "loaf" | "side";
  /** Body drop (m) when lying. */
  lieDrop: number;
  /** Tail: idle swish amplitude, carriage when running (pitch, negative = raised). */
  tailSwish: number;
  tailRun: number;
  /** Tail curl / wag style. */
  tailStyle: "hang" | "wag" | "curl" | "flag" | "scut";
  /** Readiness to bolt (0 placid .. 1 skittish). */
  skittish: number;
  /** Half-width of the body, for lying on the side. */
  halfWidth: number;
  /** Uniform size variation. */
  scaleVar: number;
  /** Ear carriage [roll up, turn forward] at rest and when alert. */
  earRest: [number, number];
  earAlert: [number, number];
}

export interface BirdMotion {
  walkSpeed: number;
  walkFreq: number;
  runSpeed: number;
  /** Hops instead of walking (crow on the ground, sparrow). */
  hops: boolean;
  /** Can take off and fly away. */
  flies: boolean;
  flySpeed: number;
  flapFreq: number;
  /** Peck/graze reach height of the beak. */
  grazeY: number;
  reach: [number, number, number];
  alert: [number, number, number];
  stand: [number, number, number];
  /** Body drop when sitting. */
  sitDrop: number;
  skittish: number;
  scaleVar: number;
  /** Walk has a waddle (roll) amplitude. */
  waddle: number;
  /** Head holds still in space while the body walks (chickens). */
  headStabilise: boolean;
  /** "rotate": the spread wing folds by pose (corvids); "overlay": a modelled folded wing, spread wings only when flapping. */
  wingFold?: "rotate" | "overlay";
}

export interface SpeciesDef {
  id: AnimalId;
  kind: "quad" | "bird";
  build(ctx: BuildCtx): BodyBuild;
  /** Coat variants available in the atlas. */
  variants: number;
  /** Hatch period (m). */
  hatch: number;
  pattern?: "stipple";
  quad?: QuadMotion;
  bird?: BirdMotion;
  /** Drought gives a thin variant. */
  thinVariant: boolean;
}

export interface AnimalSpec {
  seed: number | string;
  behavior?: Behavior;
  /** World point to watch (read live every tick; pass the trolley's position vector). */
  lookAt?: THREE.Vector3 | null;
  /** Environment: drought > 0.5 builds a thin, listless animal; storm > 0.6 makes it bolt. */
  env?: Partial<EnvironmentTarget>;
  /** Wander radius (m) around the spawn point for walking/grazing. Default depends on behaviour. */
  roam?: number;
  /** Level of detail: 1 near (default), 0.5 far. `auto` swaps by camera distance. */
  detail?: number | "auto";
  /** Leave a pool after a strike (default true). */
  blood?: boolean;
  /** Ground height lookup in world space, for walkers on uneven terrain. */
  heightAt?: (x: number, z: number) => number;
  /** Override the coat variant. */
  variant?: number;
  /** Animate in place (lineups, animals tethered to a tableau spot). */
  anchored?: boolean;
  /** A carcass (drought, ruin): lying on its side from the start, no blood. */
  dead?: boolean;
}

export interface AnimalUserData {
  tick: (dt: number, t: number) => void;
  react: (kind: Reaction, direction?: THREE.Vector3) => void;
  setBehavior: (b: Behavior) => void;
  setLookAt: (target: THREE.Vector3 | null) => void;
  /** Less graphic detail switches blood pools off (and removes one already formed). */
  setBlood: (on: boolean) => void;
  species: AnimalId;
  behavior: Behavior;
  struck: boolean;
  /** Forward speed (m/s) of the walk cycle. */
  walkSpeed: number;
  mesh: THREE.SkinnedMesh;
  /** The moving frame inside the returned object (locomotion offsets it). */
  mover: THREE.Object3D;
  /** Approximate height at the withers / back. */
  height: number;
}
