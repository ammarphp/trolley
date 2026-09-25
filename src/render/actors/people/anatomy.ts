/**
 * Human proportions for the ink figures.
 *
 * All measurements are metres in the standing rest pose, origin at the floor
 * between the feet, facing +Z (the figure's left hand is +X). Adult canons
 * follow the usual 7.5-head figure (anthropometric landmark heights as
 * fractions of stature); children are drawn at ~6 heads with short legs and a
 * large cranium, elders slightly shrunken with a forward stoop.
 */
import type { Rng } from "../../core/rng.ts";

export type AgeClass = "adult" | "child" | "elder";

export interface Body {
  age: AgeClass;
  /** Stature, floor to crown. */
  H: number;
  /** 0 = broad-shouldered, narrow-hipped; 1 = narrow-shouldered, wide-hipped with a bust. */
  fem: number;
  /** Width multiplier for torso and limbs (0.9 slim .. 1.35 heavy). */
  girth: number;
  /** Extra forward mass at the belly (0..1). */
  belly: number;
  /** Habitual forward stoop (0..1). */
  stoop: number;

  // ------------------------------------------------ joint heights (rest)
  hipY: number; // hip joint centres
  waistY: number; // spine pivot, navel height
  neckY: number; // base of the neck (top of the torso part)
  headY: number; // head pivot (atlas), just behind the jaw
  shoulderY: number; // shoulder joint centres
  kneeY: number;
  ankleY: number;
  crotchY: number;
  crownY: number;

  hipX: number; // half distance between hip joints
  shoulderX: number; // half distance between shoulder joints

  // ------------------------------------------------ segments
  thigh: number;
  shin: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  footLen: number;
  footW: number;
  heel: number; // heel behind the ankle joint

  // ------------------------------------------------ radii
  thighR: number;
  kneeR: number;
  calfR: number;
  ankleR: number;
  deltR: number;
  upperArmR: number;
  elbowR: number;
  foreArmR: number;
  wristR: number;
  neckR: number;

  // ------------------------------------------------ head
  headW: number; // half width
  headH: number; // chin to crown
  headD: number; // half depth

  // ------------------------------------------------ torso half-widths / depths (front, back)
  hipW: number;
  hipF: number;
  hipB: number;
  waistW: number;
  waistF: number;
  waistB: number;
  chestW: number;
  chestF: number;
  chestB: number;
  shoulderW: number; // half width across the acromions
}

export interface BodyOptions {
  age?: AgeClass;
  /** Force a height (m). */
  height?: number;
  fem?: number;
  girth?: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Draw a plausible body. The rng decides everything not pinned by options. */
export function makeBody(rng: Rng, options: BodyOptions = {}): Body {
  const age = options.age ?? "adult";
  const fem = options.fem ?? (rng.chance(0.5) ? rng.range(0.72, 1) : rng.range(0, 0.22));
  let H: number;
  if (options.height !== undefined) H = options.height;
  else if (age === "child") H = rng.range(1.12, 1.42);
  else if (age === "elder") H = 1.72 - fem * 0.12 + rng.gauss() * 0.045;
  else H = 1.79 - fem * 0.13 + rng.gauss() * 0.055;
  H = clamp(H, age === "child" ? 1.0 : 1.5, 1.95);

  const girth = options.girth ?? clamp(1 + rng.gauss() * 0.1 + (age === "elder" ? 0.04 : 0) - (age === "child" ? 0.04 : 0), 0.86, 1.34);
  const belly = age === "child" ? 0 : clamp((girth - 1) * 2.4 + rng.range(-0.1, 0.25) + (age === "elder" ? 0.2 : 0), 0, 1);
  const stoop = age === "elder" ? rng.range(0.45, 1) : age === "child" ? 0 : rng.range(0, 0.25);

  // Head size: nearly constant in absolute terms, so short people have
  // proportionally larger heads. Children ~6 heads, adults ~7.5.
  const heads = age === "child" ? 5.7 + (H - 1.1) * 2.2 : age === "elder" ? 7.15 : 7.35 + (H - 1.7) * 1.2;
  const headH = H / heads;
  const s = H / 1.78; // linear scale relative to the reference adult
  const w = girth; // width scale

  // Landmark fractions of stature (adult reference; child legs are shorter).
  const legFrac = age === "child" ? 0.47 : 0.505;
  const hipY = H * legFrac;
  const chinY = H - headH;
  const neckY = chinY - headH * 0.26; // base of the neck at the front (sternal notch ~)
  const shoulderY = neckY - headH * 0.2;
  const waistY = hipY + (shoulderY - hipY) * 0.34;
  const ankleY = H * (age === "child" ? 0.045 : 0.04);
  const kneeY = ankleY + (hipY - ankleY) * 0.49;

  const femW = 1 - fem;
  const shoulderHalf = H * (0.118 * femW + 0.106 * fem) * (age === "child" ? 0.92 : 1) * (0.9 + 0.1 * w);
  const hipHalf = H * (0.093 * femW + 0.104 * fem) * w * (age === "child" ? 0.92 : 1);

  const armTotal = shoulderY - H * (age === "child" ? 0.4 : 0.375); // shoulder joint to fingertip
  const hand = armTotal * 0.25;
  const upperArm = armTotal * 0.42;
  const foreArm = armTotal * 0.33;

  const body: Body = {
    age,
    H,
    fem,
    girth: w,
    belly,
    stoop,
    hipY,
    waistY,
    neckY,
    headY: chinY + headH * 0.06,
    shoulderY,
    kneeY,
    ankleY,
    crotchY: hipY - H * 0.045,
    crownY: H,
    hipX: hipHalf * 0.5,
    shoulderX: shoulderHalf * 0.9,
    thigh: hipY - kneeY,
    shin: kneeY - ankleY,
    upperArm,
    foreArm,
    hand,
    footLen: H * 0.152,
    footW: H * 0.055 * (0.95 + 0.05 * w),
    heel: H * 0.03,
    thighR: 0.083 * s * w * (1 + fem * 0.08),
    kneeR: 0.05 * s * (0.9 + 0.1 * w),
    calfR: 0.056 * s * w,
    ankleR: 0.033 * s,
    deltR: 0.056 * s * (0.8 + 0.2 * w) * (1 - fem * 0.14),
    upperArmR: 0.048 * s * w * (1 - fem * 0.1),
    elbowR: 0.036 * s * (0.9 + 0.1 * w),
    foreArmR: 0.039 * s * w * (1 - fem * 0.1),
    wristR: 0.026 * s,
    neckR: 0.058 * s * (0.85 + 0.15 * w) * (1 - fem * 0.12),
    headW: headH * 0.335,
    headH,
    headD: headH * 0.42,
    hipW: hipHalf,
    hipF: 0.1 * s * w,
    hipB: 0.12 * s * w * (1 + fem * 0.1),
    waistW: H * (0.082 * femW + 0.07 * fem) * w * (1 + belly * 0.18),
    waistF: 0.1 * s * w * (1 + belly * 0.55),
    waistB: 0.088 * s * w,
    chestW: H * (0.092 * femW + 0.084 * fem) * (0.92 + 0.08 * w),
    chestF: 0.112 * s * (0.9 + 0.1 * w) * (1 + fem * 0.12),
    chestB: 0.1 * s * (0.92 + 0.08 * w),
    shoulderW: shoulderHalf,
  };
  if (age === "child") {
    body.waistF *= 1.05;
    body.chestF *= 0.95;
  }
  return body;
}
