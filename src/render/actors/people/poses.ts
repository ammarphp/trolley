/**
 * Procedural poses. Every pose is a function of (seeded style, time) that
 * writes bone rotations into a Frame, in "body space" (the root bone's local
 * frame: standing, facing +z). Lying poses rotate the root afterwards; the
 * runtime then grounds the figure on its support markers.
 *
 * Nothing here keeps state between frames except what the caller passes in,
 * so a pose can be sampled at any time (the crowd baker relies on that).
 */
import * as THREE from "three";
import type { Pose } from "../../api.ts";
import type { Body } from "./anatomy.ts";
import { B, Frame, addRot, aimHead, bodyPoint, bodyXf, orientBody, rot, solveLimb, xf, type Xf } from "./rig.ts";
import { secondGrip, type HeldProp } from "./props.ts";
import type { StandStyle, WorkKind } from "./roles.ts";

export interface PoseStyle {
  phase: number;
  tempo: number;
  stand: StandStyle;
  work: WorkKind;
  right: HeldProp | null;
  left: HeldProp | null;
  /** Variant picks: 0..1 values used by poses to choose sub-styles. */
  v1: number;
  v2: number;
  v3: number;
  /** Tied / lying: head toward -x (−1) or +x (+1). */
  headSide: 1 | -1;
  /** Sit on a seat of this height (0 = the ground). */
  seat: number;
  /** Lie on a surface of this height (0 = the ground). */
  surface: number;
  seed: number;
}

export interface PoseInput {
  body: Body;
  rest: THREE.Vector3[];
  style: PoseStyle;
  /** Look / point target in mesh space (the person's local frame), or null. */
  targetMesh: THREE.Vector3 | null;
  /** The same target in body space; filled in by evaluatePose. */
  target?: THREE.Vector3 | null;
  /** Struggle / agitation 0..1. */
  agitation: number;
}

const _tb = new THREE.Vector3();
const _rq = new THREE.Quaternion();
/** Express the mesh-space target in body space, given the frame's root. */
function refreshTarget(f: Frame, inp: PoseInput): THREE.Vector3 | null {
  if (!inp.targetMesh) return (inp.target = null);
  _rq.copy(f.q[B.root]!).invert();
  inp.target = _tb.copy(inp.targetMesh).sub(f.p[B.root]!).applyQuaternion(_rq);
  return inp.target;
}

export interface Support {
  markers: number[];
  height: number;
}

// ---------------------------------------------------------------- utilities

const TAU = Math.PI * 2;
const D = Math.PI / 180;

function hash(n: number): number {
  const h = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return h - Math.floor(h);
}
/** Smooth value noise in [-1, 1]. */
export function vnoise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i + seed * 17.13);
  const b = hash(i + 1 + seed * 17.13);
  return (a + (b - a) * u) * 2 - 1;
}
function bump(p: number, c: number, w: number): number {
  let d = p - c;
  d -= Math.round(d);
  return Math.exp(-(d * d) / (w * w));
}
function smooth(x: number): number {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _x1 = xf();
const _x2 = xf();

function spinePt(f: Frame, x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  return bodyPoint(f, B.spine, _t.set(x, y, z), out);
}

/** Place a prop bone so its origin/orientation land at a body-space transform. */
export function placeProp(f: Frame, bone: number, pos: THREE.Vector3, q: THREE.Quaternion): void {
  const parent = bone === B.propR ? B.handR : B.handL;
  bodyXf(f, parent, _x1);
  _q2.copy(_x1.q).invert();
  f.q[bone]!.copy(_q2).multiply(q);
  f.p[bone]!.copy(pos).sub(_x1.p).applyQuaternion(_q2);
}

/** Body-space transform of the grip (prop bone at rest offset). */
function gripXf(f: Frame, prop: number, out: Xf): Xf {
  return bodyXf(f, prop, out);
}

function arm(side: 1 | -1) {
  return side > 0 ? { up: B.armL, lo: B.foreL, hand: B.handL, prop: B.propL } : { up: B.armR, lo: B.foreR, hand: B.handR, prop: B.propR };
}
function leg(side: 1 | -1) {
  return side > 0 ? { up: B.thighL, lo: B.shinL, foot: B.footL } : { up: B.thighR, lo: B.shinR, foot: B.footR };
}

/** Reach a wrist to a body-space target with the elbow toward `pole`. */
function reach(f: Frame, b: Body, side: 1 | -1, target: THREE.Vector3, pole: THREE.Vector3): void {
  const a = arm(side);
  solveLimb(f, a.up, a.lo, b.upperArm, b.foreArm, target, pole, "arm");
}
/** Put the grip point (not the wrist) on a body-space target: two passes. */
function grip(f: Frame, b: Body, side: 1 | -1, target: THREE.Vector3, pole: THREE.Vector3): void {
  const a = arm(side);
  _w.copy(target);
  for (let k = 0; k < 2; k++) {
    solveLimb(f, a.up, a.lo, b.upperArm, b.foreArm, _w, pole, "arm");
    bodyXf(f, a.hand, _x2);
    // wrist -> grip offset in body space
    _v.copy(f.p[a.prop]!).applyQuaternion(_x2.q);
    _w.copy(target).sub(_v);
  }
}

/** Plant a foot (ankle target) flat with a yaw, knee toward `pole`. */
function plant(f: Frame, b: Body, side: 1 | -1, ankle: THREE.Vector3, yaw: number, pole: THREE.Vector3, pitch = 0): void {
  const l = leg(side);
  solveLimb(f, l.up, l.lo, b.thigh, b.shin, ankle, pole, "leg");
  _q.setFromEuler(_e.set(pitch, yaw, 0, "YXZ"));
  orientBody(f, l.foot, _q);
}

function legFK(f: Frame, side: 1 | -1, hip: number, knee: number, ankle: number, abd = 0, twist = 0): void {
  const l = leg(side);
  rot(f, l.up, -hip, twist * side, abd * side, "YZX");
  rot(f, l.lo, knee);
  rot(f, l.foot, ankle);
}

function armFK(f: Frame, side: 1 | -1, flex: number, abd: number, elbow: number, twist = 0): void {
  const a = arm(side);
  rot(f, a.up, -flex, twist * side, abd * side, "YXZ");
  rot(f, a.lo, -elbow);
}

// ------------------------------------------------------------------ markers

export const MK = {
  heelL: 0,
  toeL: 1,
  heelR: 2,
  toeR: 3,
  kneeL: 4,
  kneeR: 5,
  buttL: 6,
  buttR: 7,
  skull: 8,
  bladeL: 9,
  bladeR: 10,
  calfL: 11,
  calfR: 12,
  heelBL: 13,
  heelBR: 14,
  sideShL: 15,
  sideShR: 16,
  sideHipL: 17,
  sideHipR: 18,
  sideKneeL: 19,
  sideKneeR: 20,
  sideHeadL: 21,
  sideHeadR: 22,
} as const;

export function markerDefs(b: Body): Array<{ bone: number; p: THREE.Vector3 }> {
  const toe = b.footLen - b.heel - 0.02;
  return [
    { bone: B.footL, p: new THREE.Vector3(0, -b.ankleY, -b.heel * 0.7) },
    { bone: B.footL, p: new THREE.Vector3(0, -b.ankleY, toe) },
    { bone: B.footR, p: new THREE.Vector3(0, -b.ankleY, -b.heel * 0.7) },
    { bone: B.footR, p: new THREE.Vector3(0, -b.ankleY, toe) },
    { bone: B.shinL, p: new THREE.Vector3(0, -0.035, b.kneeR * 1.1) },
    { bone: B.shinR, p: new THREE.Vector3(0, -0.035, b.kneeR * 1.1) },
    { bone: B.pelvis, p: new THREE.Vector3(b.hipX, b.crotchY - b.hipY + 0.02, -b.hipB * 0.75) },
    { bone: B.pelvis, p: new THREE.Vector3(-b.hipX, b.crotchY - b.hipY + 0.02, -b.hipB * 0.75) },
    { bone: B.head, p: new THREE.Vector3(0, b.headH * 0.44, -b.headD * 0.95) },
    { bone: B.spine, p: new THREE.Vector3(0.09, b.shoulderY - b.waistY - 0.1, -b.chestB - 0.02) },
    { bone: B.spine, p: new THREE.Vector3(-0.09, b.shoulderY - b.waistY - 0.1, -b.chestB - 0.02) },
    { bone: B.shinL, p: new THREE.Vector3(0, -b.shin * 0.35, -b.calfR * 1.1) },
    { bone: B.shinR, p: new THREE.Vector3(0, -b.shin * 0.35, -b.calfR * 1.1) },
    { bone: B.footL, p: new THREE.Vector3(0, -b.ankleY * 0.5, -b.heel * 1.1) },
    { bone: B.footR, p: new THREE.Vector3(0, -b.ankleY * 0.5, -b.heel * 1.1) },
    { bone: B.armL, p: new THREE.Vector3(b.deltR * 1.1, -0.04, 0) },
    { bone: B.armR, p: new THREE.Vector3(-b.deltR * 1.1, -0.04, 0) },
    { bone: B.pelvis, p: new THREE.Vector3(b.hipW, -0.03, 0) },
    { bone: B.pelvis, p: new THREE.Vector3(-b.hipW, -0.03, 0) },
    { bone: B.shinL, p: new THREE.Vector3(b.kneeR, 0, 0) },
    { bone: B.shinR, p: new THREE.Vector3(-b.kneeR, 0, 0) },
    { bone: B.head, p: new THREE.Vector3(b.headW, b.headH * 0.44, 0) },
    { bone: B.head, p: new THREE.Vector3(-b.headW, b.headH * 0.44, 0) },
  ];
}

const FEET = [MK.heelL, MK.toeL, MK.heelR, MK.toeR];
const KNEES = [MK.kneeL, MK.kneeR, MK.toeL, MK.toeR];
const SEAT = [MK.buttL, MK.buttR, MK.heelL, MK.heelR, MK.toeL, MK.toeR];
const LYING = [
  MK.skull,
  MK.bladeL,
  MK.bladeR,
  MK.buttL,
  MK.buttR,
  MK.calfL,
  MK.calfR,
  MK.heelBL,
  MK.heelBR,
  MK.sideShL,
  MK.sideShR,
  MK.sideHipL,
  MK.sideHipR,
  MK.sideKneeL,
  MK.sideKneeR,
  MK.sideHeadL,
  MK.sideHeadR,
];

// ---------------------------------------------------------------- the poses

/** Lying on the back across x: face up, head toward style.headSide. */
export function lyingRoot(f: Frame, b: Body, headSide: 1 | -1, centreY = 0.55): void {
  // Rx(-90) turns the face (+z) up; Ry(±90) swings the head (+y -> -z) to ±x.
  _q.setFromAxisAngle(_v.set(1, 0, 0), -Math.PI / 2);
  _q2.setFromAxisAngle(_v.set(0, 1, 0), headSide > 0 ? -Math.PI / 2 : Math.PI / 2);
  f.q[B.root]!.copy(_q2).multiply(_q);
  // Centre the body (about the lower back) on the origin.
  _v.set(0, b.H * centreY, 0).applyQuaternion(f.q[B.root]!);
  f.p[B.root]!.set(-_v.x, 0, -_v.z);
}

function breathe(f: Frame, t: number, st: PoseStyle, amt = 1): void {
  const br = Math.sin((t / (3.6 + st.v2)) * TAU + st.phase * 6);
  addRot(f, B.spine, -0.012 * br * amt);
  addRot(f, B.neck, 0.01 * br * amt);
}

/** Idle head: looks around slowly; glances at the target if one is given. */
function idleHead(f: Frame, t: number, st: PoseStyle, target: THREE.Vector3 | null, calm = 1): void {
  const s = st.seed;
  const yaw = vnoise(t * 0.13 + s, s) * 0.55 * calm + vnoise(t * 0.5 + s * 3, s + 1) * 0.06;
  const pitch = vnoise(t * 0.11 + s * 2, s + 2) * 0.12 + 0.04;
  addRot(f, B.neck, pitch * 0.4, yaw * 0.35, 0, "YXZ");
  rot(f, B.head, pitch * 0.6, yaw * 0.65, vnoise(t * 0.09, s + 5) * 0.06, "YXZ");
  if (target) {
    const glance = smooth((vnoise(t * 0.08 + 11, s + 7) - 0.1) * 3);
    if (glance > 0.01) aimHead(f, target, glance);
  }
}

function standBase(f: Frame, inp: PoseInput, t: number, calm = 1): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  // Contrapposto: weight settles on one leg for a while, then shifts. The
  // pelvis drops on the free side, the shoulders counter-tilt, the head
  // rebalances; the free leg bends and turns out a little.
  const bias = st.v2 > 0.5 ? 0.55 : -0.55;
  const shift = vnoise(t * 0.06 + st.seed, st.seed) * 1.4 + bias;
  const w = THREE.MathUtils.clamp(shift, -1, 1) * calm;
  const stance = 0.035 + st.v1 * 0.05;
  f.p[B.pelvis]!.set(w * 0.035 * s, b.hipY - 0.014 - Math.abs(w) * 0.016, 0.0);
  rot(f, B.pelvis, 0.02, w * 0.06, -w * 0.075, "YXZ");
  const stoop = b.stoop;
  rot(f, B.spine, 0.035 + stoop * 0.3, -w * 0.05, w * 0.095, "YXZ");
  breathe(f, t, st);
  const relaxed = w > 0 ? -1 : 1; // the unweighted leg
  for (const side of [1, -1] as const) {
    const free = side === relaxed;
    const fwd = free ? 0.07 + Math.abs(w) * 0.06 : -0.015;
    const out = free ? 0.035 * Math.abs(w) : 0;
    _t.set(side * (b.hipX + (stance + out) * s), b.ankleY, fwd * s);
    plant(f, b, side, _t, side * (free ? 0.28 : 0.1 + st.v3 * 0.08), _pole.set(side * (free ? 0.45 : 0.15), 0, 1));
  }
  // Head rebalances over the weight-bearing foot.
  rot(f, B.neck, 0, 0, -w * 0.05);
  if (stoop > 0.1) {
    addRot(f, B.neck, -stoop * 0.12);
    addRot(f, B.head, -stoop * 0.12);
  }
}

/** Arms for idle standing styles. */
function standArms(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  const sway = Math.sin((t / (3.6 + st.v2)) * TAU + st.phase * 6) * 0.015;
  const style = st.stand;
  const armForSide = (side: 1 | -1) => (side > 0 ? st.left : st.right);
  for (const side of [1, -1] as const) {
    const held = armForSide(side);
    const a = arm(side);
    if (held) {
      holdIdle(f, inp, side, held, t);
      continue;
    }
    switch (style) {
      case "pockets": {
        spinePt(f, side * (b.hipW * 0.82), b.hipY - b.waistY - 0.03 * s, b.hipF * 0.55, _w);
        reach(f, b, side, _w, _pole.set(side * 1, -0.2, -0.7));
        rot(f, a.hand, 0, 0, side * 0.2);
        break;
      }
      case "hips": {
        spinePt(f, side * (b.waistW + 0.03 * s), 0.0, 0.01 * s, _w);
        reach(f, b, side, _w, _pole.set(side * 1, -0.6, -0.7));
        rot(f, a.hand, 0.3, 0, -side * 0.4);
        break;
      }
      case "behind": {
        spinePt(f, side * 0.035 * s, -0.06 * s, -(b.waistB + 0.07 * s), _w);
        reach(f, b, side, _w, _pole.set(side * 0.9, -0.3, -0.4));
        break;
      }
      case "crossed": {
        const top = side > 0 ? 0.0 : 0.035;
        spinePt(f, -side * 0.1 * s, b.shoulderY - b.waistY - 0.2 * s - top, b.chestF + 0.07 * s + top * 0.8, _w);
        reach(f, b, side, _w, _pole.set(side * 1, -0.6, -0.2));
        rot(f, a.hand, 0, 0, -side * 0.3);
        break;
      }
      case "hold":
      case "hang":
      default: {
        hangArm(f, b, side, sway, st.v1);
      }
    }
  }
}

/**
 * A relaxed arm: hangs by gravity from the shoulder, elbow soft, the hand
 * coming to rest against the side of the thigh rather than floating clear.
 */
function hangArm(f: Frame, b: Body, side: 1 | -1, sway: number, v: number): void {
  const s = b.H / 1.78;
  const a = arm(side);
  bodyXf(f, a.up, _x1);
  const L = (b.upperArm + b.foreArm) * (0.965 - v * 0.02);
  _w.set(_x1.p.x, _x1.p.y - L, _x1.p.z + 0.035 * s + sway);
  // Keep clear of the hip / thigh.
  bodyPoint(f, B.pelvis, _t.set(side * (b.hipW + b.wristR + 0.018 * s), 0, 0), _v);
  if (side * _w.x < side * _v.x) _w.x = _v.x;
  reach(f, b, side, _w, _pole.set(side * 0.35, 0, -1));
  rot(f, a.hand, 0.08, -side * 0.25, -side * 0.05);
}

/** One hand holding an idle prop. */
function holdIdle(f: Frame, inp: PoseInput, side: 1 | -1, held: HeldProp, t: number): void {
  const b = inp.body;
  const s = b.H / 1.78;
  const a = arm(side);
  switch (held) {
    case "clipboard":
    case "tablet":
    case "folder": {
      // Held against the body at the chest/waist, board upright.
      spinePt(f, side * 0.13 * s, 0.1 * s, b.chestF + 0.1 * s, _w);
      reach(f, b, side, _w, _pole.set(side * 0.6, -1, -0.2));
      bodyXf(f, a.prop, _x1);
      _q.setFromEuler(_e.set(-0.25, -side * 0.35, 0, "YXZ"));
      placeProp(f, a.prop, _x1.p, _q.premultiply(bodyXf(f, B.spine, _x2).q));
      return;
    }
    case "cane":
    case "umbrella":
    case "iv-pole": {
      spinePt(f, side * (b.hipW + 0.1 * s), b.hipY - b.waistY + 0.02 * s, 0.18 * s, _w);
      reach(f, b, side, _w, _pole.set(side * 0.5, 0, -1));
      bodyXf(f, a.prop, _x1);
      _q.identity();
      placeProp(f, a.prop, _x1.p, _q);
      return;
    }
    case "rifle": {
      // Low ready: both hands on the rifle, muzzle down and forward.
      spinePt(f, -0.1 * s, -0.02 * s, b.chestF + 0.16 * s, _w);
      grip(f, b, -1, _w, _pole.set(-1, -0.5, -0.5));
      bodyXf(f, B.propR, _x1);
      _q.setFromEuler(_e.set(0.55, 0.35, 0, "YXZ"));
      placeProp(f, B.propR, _x1.p, _q.premultiply(bodyXf(f, B.spine, _x2).q));
      const g2 = secondGrip("rifle")!;
      bodyXf(f, B.propR, _x1);
      _w.copy(g2).applyQuaternion(_x1.q).add(_x1.p);
      reach(f, b, 1, _w, _pole.set(1, -0.8, 0));
      return;
    }
    case "sign": {
      // Resting the placard on the shoulder / holding it low.
      spinePt(f, side * 0.2 * s, 0.05 * s, 0.22 * s, _w);
      grip(f, b, side, _w, _pole.set(side * 1, -0.6, -0.4));
      bodyXf(f, a.prop, _x1);
      _q.setFromEuler(_e.set(0.1, 0, side * 0.12));
      placeProp(f, a.prop, _x1.p, _q);
      if (side < 0) {
        _w.set(0, -0.3, 0).applyQuaternion(_q).add(_x1.p);
        reach(f, b, 1, _w, _pole.set(1, -0.6, -0.4));
      }
      return;
    }
    case "teddy": {
      spinePt(f, side * 0.1 * s, 0.12 * s, b.chestF + 0.07 * s, _w);
      reach(f, b, side, _w, _pole.set(side, -1, -0.2));
      bodyXf(f, a.prop, _x1);
      placeProp(f, a.prop, _x1.p, bodyXf(f, B.spine, _x2).q);
      return;
    }
    case "bundle": {
      spinePt(f, side * 0.16 * s, 0.05 * s, b.chestF + 0.12 * s, _w);
      reach(f, b, side, _w, _pole.set(side, -1, -0.3));
      bodyXf(f, a.prop, _x1);
      placeProp(f, a.prop, _x1.p, bodyXf(f, B.spine, _x2).q);
      return;
    }
    case "lamp": {
      armFK(f, side, 0.35, 0.12, 0.9);
      bodyXf(f, a.prop, _x1);
      placeProp(f, a.prop, _x1.p, _q.identity());
      return;
    }
    default: {
      // Hanging carries: briefcase, suitcase, medic bag, toolbox, baton.
      const heavy = held === "suitcase" || held === "toolbox" ? 1 : 0;
      armFK(f, side, 0.02, 0.1 + heavy * 0.06, 0.05);
      addRot(f, B.spine, 0, 0, side * heavy * 0.04);
      bodyXf(f, a.prop, _x1);
      _q.setFromEuler(_e.set(0, side * 0.05, side * heavy * 0.05));
      placeProp(f, a.prop, _x1.p, _q);
      void t;
    }
  }
}

// -------------------------------------------------------------------- walk

function walkLegs(f: Frame, inp: PoseInput, t: number, speed = 1): number {
  const b = inp.body;
  const st = inp.style;
  const T = (b.age === "child" ? 0.85 : b.age === "elder" ? 1.3 : 1.08) * st.tempo / speed;
  const p = (t / T + st.phase) % 1;
  const amp = (b.age === "elder" ? 16 : 21) * D * Math.min(1.1, speed);
  f.p[B.pelvis]!.set(0, b.hipY, 0);
  rot(f, B.pelvis, 0, Math.sin(p * TAU) * 5 * D, Math.cos(p * TAU * 2) * 2 * D, "YXZ");
  for (const side of [1, -1] as const) {
    const q = (p + (side > 0 ? 0 : 0.5)) % 1;
    const hip = 6 * D + amp * Math.cos(q * TAU) + 6 * D * bump(q, 0.85, 0.08);
    const knee = (4 + 14 * bump(q, 0.1, 0.07) + 58 * bump(q, 0.7, 0.13)) * D;
    const footWorld = (-14 * bump(q, 0.0, 0.05) + 30 * bump(q, 0.6, 0.07) - 6 * bump(q, 0.88, 0.08)) * D;
    const ankle = footWorld + hip - knee;
    legFK(f, side, hip, knee, ankle, 0.02, 0.06);
  }
  rot(f, B.spine, 0.05 + b.stoop * 0.3, -Math.sin(p * TAU) * 7 * D, 0, "YXZ");
  return p;
}

function walkArms(f: Frame, inp: PoseInput, p: number): void {
  const b = inp.body;
  const st = inp.style;
  for (const side of [1, -1] as const) {
    const held = side > 0 ? st.left : st.right;
    if (held) {
      holdIdle(f, inp, side, held, p);
      continue;
    }
    // Left arm swings with the right leg.
    const q = (p + (side > 0 ? 0.5 : 0)) % 1;
    const sw = Math.cos(q * TAU);
    armFK(f, side, (b.age === "elder" ? 10 : 17) * D * sw + 2 * D, 0.1, (16 + 14 * Math.max(0, sw)) * D, 0.1);
  }
}

// -------------------------------------------------------------------- work

function workPose(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  switch (st.work) {
    case "swing":
      return swingTool(f, inp, t);
    case "dig":
      return digTool(f, inp, t);
    case "tend":
      return tendPose(f, inp, t);
    case "write": {
      standBase(f, inp, t, 0.5);
      // Board in the left hand, writing with the right.
      spinePt(f, 0.06 * s, 0.14 * s, b.chestF + 0.2 * s, _w);
      reach(f, b, 1, _w, _pole.set(1, -1, -0.3));
      bodyXf(f, B.propL, _x1);
      _q.setFromEuler(_e.set(-0.9, -1.35, 0, "YXZ"));
      placeProp(f, B.propL, _x1.p, _q.premultiply(bodyXf(f, B.spine, _x2).q));
      const wr = Math.sin(t * 7 + st.phase * 9) * 0.015;
      spinePt(f, -0.05 * s + wr, 0.2 * s + Math.sin(t * 3.1) * 0.01, b.chestF + 0.24 * s, _w);
      reach(f, b, -1, _w, _pole.set(-1, -1, -0.2));
      const look = smooth((vnoise(t * 0.15, st.seed) + 0.3) * 2);
      rot(f, B.neck, 0.25 * look, 0, 0);
      rot(f, B.head, 0.35 * look, 0.05, 0);
      if (inp.target && look < 0.5) aimHead(f, inp.target, 1 - look * 2);
      return;
    }
    case "scan": {
      standBase(f, inp, t, 0.6);
      standArms(f, inp, t);
      const yaw = vnoise(t * 0.2, st.seed) * 0.7;
      addRot(f, B.spine, 0, yaw * 0.25);
      rot(f, B.neck, 0.02, yaw * 0.35);
      rot(f, B.head, 0.03, yaw * 0.5);
      if (inp.target) aimHead(f, inp.target, 0.5);
      return;
    }
    case "lift":
    default:
      return liftPose(f, inp, t);
  }
}

function swingTool(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  const T = 1.75 * st.tempo;
  const u = (t / T + st.phase) % 1;
  // Handle angle from vertical (radians, + forward): overhead-behind -> strike.
  let phi: number;
  let bend: number;
  const STRIKE = 2.05;
  const TOP = -0.6;
  if (u < 0.46) {
    // Raise: lift the head of the tool back over the shoulder.
    const k = smooth(u / 0.46);
    phi = THREE.MathUtils.lerp(STRIKE, TOP, k);
    bend = THREE.MathUtils.lerp(0.5, -0.12, k);
  } else if (u < 0.58) {
    // Cock at the top.
    phi = TOP - Math.sin(((u - 0.46) / 0.12) * Math.PI) * 0.08;
    bend = -0.12;
  } else if (u < 0.7) {
    // Strike: accelerating down.
    const k = Math.pow((u - 0.58) / 0.12, 1.8);
    phi = THREE.MathUtils.lerp(TOP, STRIKE, k);
    bend = THREE.MathUtils.lerp(-0.12, 0.5, k);
  } else {
    // Impact and a small rebound before the next lift.
    phi = STRIKE - Math.sin(((u - 0.7) / 0.3) * Math.PI) * 0.12;
    bend = 0.5;
  }
  // Staggered stance, knees soften at the strike.
  f.p[B.pelvis]!.set(0.0, b.hipY - 0.03 - bend * 0.08 * s, -0.05 * s);
  rot(f, B.pelvis, 0.12 * bend, 0.12, 0, "YXZ");
  rot(f, B.spine, 0.1 + bend * 0.5, -0.12, 0, "YXZ");
  for (const side of [1, -1] as const) {
    const fwd = side > 0 ? 0.26 : -0.2;
    _t.set(side * (b.hipX + 0.08 * s), b.ankleY, fwd * s);
    plant(f, b, side, _t, side * 0.25, _pole.set(side * 0.3, 0, 1));
  }
  // Hands on an arc in front of the chest, tool continuing outward.
  const psi = phi * 0.92;
  const R = 0.46 * s;
  const cyRel = b.shoulderY - b.waistY - 0.04 * s;
  spinePt(f, -0.02, cyRel + Math.cos(psi) * R, 0.06 * s + Math.sin(psi) * R, _w);
  grip(f, b, -1, _w, _pole.set(-1, -0.4, -0.6));
  // Tool orientation: +z along the handle (outward), +y the strike direction.
  bodyXf(f, B.spine, _x2);
  const dz = _v.set(0, Math.cos(phi), Math.sin(phi)).applyQuaternion(_x2.q).normalize();
  const dy = _t.set(0, -Math.sin(phi), Math.cos(phi)).applyQuaternion(_x2.q).normalize();
  const dx = new THREE.Vector3().crossVectors(dy, dz).normalize();
  _m.makeBasis(dx, dy, dz);
  _q.setFromRotationMatrix(_m);
  bodyXf(f, B.propR, _x1);
  placeProp(f, B.propR, _x1.p, _q);
  _w.set(0, 0, 0.28).applyQuaternion(_q).add(_x1.p);
  reach(f, b, 1, _w, _pole.set(1, -0.4, -0.6));
  rot(f, B.neck, 0.15 + bend * 0.2, 0.08);
  rot(f, B.head, 0.1 + bend * 0.25, 0.05);
}

function digTool(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  const T = 2.4 * st.tempo;
  const u = (t / T + st.phase) % 1;
  // Key poses: push (blade in the ground), lift, toss to the left, return.
  const keys = [
    { u: 0.0, bend: 0.75, ang: 1.05, twist: 0.0, hy: -0.12, hz: 0.28 },
    { u: 0.3, bend: 0.8, ang: 1.1, twist: 0.0, hy: -0.16, hz: 0.3 },
    { u: 0.52, bend: 0.4, ang: 0.35, twist: 0.1, hy: 0.0, hz: 0.3 },
    { u: 0.68, bend: 0.35, ang: 0.15, twist: 0.6, hy: 0.06, hz: 0.28 },
    { u: 0.82, bend: 0.5, ang: 0.6, twist: 0.2, hy: -0.04, hz: 0.28 },
    { u: 1.0, bend: 0.75, ang: 1.05, twist: 0.0, hy: -0.12, hz: 0.28 },
  ];
  let k0 = keys[0]!;
  let k1 = keys[1]!;
  for (let i = 0; i < keys.length - 1; i++) {
    if (u >= keys[i]!.u && u <= keys[i + 1]!.u) {
      k0 = keys[i]!;
      k1 = keys[i + 1]!;
      break;
    }
  }
  const k = smooth((u - k0.u) / Math.max(1e-4, k1.u - k0.u));
  const L = (a: number, c: number) => a + (c - a) * k;
  const bend = L(k0.bend, k1.bend);
  const ang = L(k0.ang, k1.ang);
  const twist = L(k0.twist, k1.twist);
  f.p[B.pelvis]!.set(0, b.hipY - 0.06 * s - bend * 0.1 * s, -0.08 * s);
  rot(f, B.pelvis, bend * 0.25, 0.15, 0, "YXZ");
  rot(f, B.spine, bend * 0.55, twist, 0, "YXZ");
  for (const side of [1, -1] as const) {
    const fwd = side > 0 ? 0.24 : -0.16;
    _t.set(side * (b.hipX + 0.1 * s), b.ankleY, fwd * s);
    plant(f, b, side, _t, side * 0.3, _pole.set(side * 0.4, 0, 1));
  }
  // Right hand on the grip near the hip; shaft points forward-down.
  spinePt(f, -0.08 * s, L(k0.hy, k1.hy) * s, L(k0.hz, k1.hz) * s, _w);
  grip(f, b, -1, _w, _pole.set(-1, 0, -0.5));
  bodyXf(f, B.spine, _x2);
  const dz = _v.set(0.12, -Math.sin(ang), Math.cos(ang)).normalize().applyQuaternion(_x2.q);
  const up = _t.set(0, 1, 0);
  const dx = new THREE.Vector3().crossVectors(up, dz).normalize();
  const dy = new THREE.Vector3().crossVectors(dz, dx).normalize();
  _m.makeBasis(dx, dy, dz);
  _q.setFromRotationMatrix(_m);
  bodyXf(f, B.propR, _x1);
  placeProp(f, B.propR, _x1.p, _q);
  _w.copy(secondGrip(st.right ?? "shovel") ?? new THREE.Vector3(0, 0, 0.5)).applyQuaternion(_q).add(_x1.p);
  reach(f, b, 1, _w, _pole.set(1, -0.5, -0.3));
  rot(f, B.neck, 0.2, 0.05);
  rot(f, B.head, 0.2, 0.0);
}

function kneelLegs(f: Frame, b: Body, oneKnee: boolean, sitBack: number): void {
  const s = b.H / 1.78;
  f.p[B.pelvis]!.set(0, b.kneeR + b.thigh * (0.97 - sitBack * 0.35), -0.02 * s);
  for (const side of [1, -1] as const) {
    if (oneKnee && side > 0) {
      // Forward leg: foot planted, shin vertical, thigh forward.
      legFK(f, side, 1.45, 1.5, 0.05, 0.08);
    } else {
      legFK(f, side, 0.05 + sitBack * 0.6, 1.62 + sitBack * 0.9, 0.95, 0.05);
    }
  }
}

function tendPose(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  kneelLegs(f, b, st.v1 > 0.5, 0.15);
  const press = Math.max(0, Math.sin((t * 1.8 + st.phase) * TAU));
  rot(f, B.pelvis, 0.2, 0, 0);
  rot(f, B.spine, 0.5 + press * 0.08, 0, 0);
  _w.set(0, 0.34 * s - press * 0.035, 0.46 * s);
  reach(f, b, 1, _w.clone().setX(0.03), _pole.set(1, 0, -0.3));
  reach(f, b, -1, _w.setX(-0.03), _pole.set(-1, 0, -0.3));
  rot(f, B.neck, 0.35, 0);
  rot(f, B.head, 0.25, 0);
}

function liftPose(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  const T = 3.2 * st.tempo;
  const u = (t / T + st.phase) % 1;
  const down = smooth(Math.sin(u * Math.PI) * 1.4);
  f.p[B.pelvis]!.set(0, b.hipY - down * 0.32 * s, -down * 0.18 * s);
  rot(f, B.pelvis, down * 0.3, 0, 0);
  rot(f, B.spine, 0.05 + down * 0.5, 0, 0);
  for (const side of [1, -1] as const) {
    _t.set(side * (b.hipX + 0.07 * s), b.ankleY, 0.02);
    plant(f, b, side, _t, side * 0.2, _pole.set(side * 0.3, 0, 1));
  }
  for (const side of [1, -1] as const) {
    _w.set(side * 0.16 * s, THREE.MathUtils.lerp(0.95, 0.2, down) * s, THREE.MathUtils.lerp(0.25, 0.42, down) * s);
    reach(f, b, side, _w, _pole.set(side, -0.2, -0.5));
  }
  rot(f, B.neck, 0.2 * down, 0);
  rot(f, B.head, 0.2 * down, 0);
}

// ------------------------------------------------------------ public entry

/**
 * Evaluate a pose. Returns the support for grounding (markers + height), or
 * null when the pose positions the root itself.
 */
export function evaluatePose(pose: Pose, f: Frame, inp: PoseInput, t: number): Support | null {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  let target = refreshTarget(f, inp);
  switch (pose) {
    case "stand":
    case "queue":
    case "watch": {
      const calm = pose === "stand" ? 1 : 0.4;
      standBase(f, inp, t, calm);
      standArms(f, inp, t);
      if (pose === "watch") {
        rot(f, B.neck, 0, 0);
        rot(f, B.head, 0, 0);
        if (target) aimHead(f, target, 1);
      } else if (pose === "queue") {
        rot(f, B.neck, 0.12 + vnoise(t * 0.1, st.seed) * 0.05, vnoise(t * 0.07, st.seed + 3) * 0.2);
        rot(f, B.head, 0.14, vnoise(t * 0.09, st.seed + 4) * 0.25);
        addRot(f, B.spine, 0.03);
      } else idleHead(f, t, st, target);
      return { markers: FEET, height: 0 };
    }
    case "walk": {
      const p = walkLegs(f, inp, t);
      walkArms(f, inp, p);
      rot(f, B.neck, 0.04, vnoise(t * 0.2, st.seed) * 0.15);
      rot(f, B.head, 0.05 - b.stoop * 0.1, vnoise(t * 0.25, st.seed + 1) * 0.2);
      if (target) aimHead(f, target, 0.6 * smooth(vnoise(t * 0.1 + 5, st.seed) * 2));
      return { markers: FEET, height: 0 };
    }
    case "carry": {
      const p = walkLegs(f, inp, t, 0.85);
      const held = st.right;
      const oneHanded = held === "suitcase" || held === "medic-bag" || held === "lamp" || held === "toolbox" || held === "briefcase";
      if (held === "sign") {
        holdSign(f, inp, t, 0.35);
      } else if (oneHanded || !held) {
        walkArms(f, inp, p);
      } else {
        // Box / crate / bundle / teddy carried in front with both arms.
        const big = held === "crate" || held === "box";
        bodyXf(f, B.spine, _x2);
        const pos = spinePt(f, 0, b.shoulderY - b.waistY - (big ? 0.34 : 0.3) * s, b.chestF + (big ? 0.2 : 0.14) * s, new THREE.Vector3());
        const half = big ? 0.2 : 0.14;
        for (const side of [1, -1] as const) {
          _w.set(side * half * s, big ? 0.0 : 0.02, 0).applyQuaternion(_x2.q).add(pos);
          reach(f, b, side, _w, _pole.set(side, -0.6, -0.6));
          rot(f, arm(side).hand, 0, 0, side * 0.4);
        }
        placeProp(f, B.propR, _v.set(0, big ? 0.15 : 0.1, 0).applyQuaternion(_x2.q).add(pos), _x2.q);
        addRot(f, B.spine, -0.06);
      }
      rot(f, B.neck, 0.08, 0);
      rot(f, B.head, 0.06, vnoise(t * 0.2, st.seed) * 0.15);
      return { markers: FEET, height: 0 };
    }
    case "work":
      workPose(f, inp, t);
      return st.work === "tend" ? { markers: KNEES, height: 0 } : { markers: FEET, height: 0 };
    case "wave": {
      standBase(f, inp, t, 0.7);
      standArms(f, inp, t);
      const side: 1 | -1 = st.right ? 1 : -1;
      const osc = Math.sin((t * 2.3 + st.phase) * TAU);
      bodyXf(f, arm(side).up, _x1);
      _w.set(side * (0.26 + osc * 0.1) * s, 0.44 * s, 0.12 * s).add(_x1.p);
      reach(f, b, side, _w, _pole.set(side, -0.5, 0.2));
      rot(f, arm(side).hand, 0, 0, side * osc * 0.3);
      addRot(f, B.spine, 0, 0, -side * 0.05);
      if (target) aimHead(f, target, 1);
      else idleHead(f, t, st, null, 0.3);
      return { markers: FEET, height: 0 };
    }
    case "point": {
      standBase(f, inp, t, 0.5);
      standArms(f, inp, t);
      const side: 1 | -1 = st.right ? 1 : -1;
      const a = arm(side);
      bodyXf(f, a.up, _x1);
      const dir = target ? _v.copy(target).sub(_x1.p) : _v.set(side * 0.5, 0.1, 1);
      dir.normalize();
      if (dir.z < -0.2) dir.z = -0.2;
      dir.normalize();
      addRot(f, B.spine, 0.03, Math.atan2(dir.x, dir.z) * 0.25);
      bodyXf(f, a.up, _x1);
      _w.copy(dir).multiplyScalar((b.upperArm + b.foreArm) * 0.97).add(_x1.p);
      reach(f, b, side, _w, _pole.set(side * 0.3, -1, -0.2));
      if (target) aimHead(f, target, 1);
      else aimHead(f, _w.copy(dir).multiplyScalar(10).add(_x1.p), 1);
      return { markers: FEET, height: 0 };
    }
    case "hold-sign": {
      standBase(f, inp, t, 0.4);
      holdSign(f, inp, t, 1);
      return { markers: FEET, height: 0 };
    }
    case "sit": {
      const seat = st.seat;
      breathe(f, t, st);
      if (seat > 0.05) {
        f.p[B.pelvis]!.set(0, seat + 0.1 * s, -0.06 * s);
        rot(f, B.pelvis, -0.12, 0, 0);
        rot(f, B.spine, 0.1 + b.stoop * 0.25, 0, 0);
        for (const side of [1, -1] as const) {
          _t.set(side * (b.hipX + 0.03), b.ankleY, (b.thigh * 0.85 + st.v1 * 0.1) * 1);
          plant(f, b, side, _t, side * 0.1, _pole.set(side * 0.2, 0.2, 1));
        }
        for (const side of [1, -1] as const) {
          bodyPoint(f, leg(side).lo, _t.set(0, -0.02, 0.02), _w);
          _w.y += 0.03;
          _w.z -= 0.12 * s;
          _w.x -= side * 0.02;
          reach(f, b, side, _w, _pole.set(side, -0.4, -0.6));
          rot(f, arm(side).hand, 1.2, 0, 0);
        }
        idleHead(f, t, st, target);
        return { markers: [MK.heelL, MK.heelR, MK.toeL, MK.toeR], height: 0 };
      }
      if (st.v2 > 0.45) {
        // Knees drawn up, arms around them.
        f.p[B.pelvis]!.set(0, 0.12 * s, -0.08 * s);
        rot(f, B.pelvis, -0.35, 0, 0);
        rot(f, B.spine, 0.3 + b.stoop * 0.2, 0, 0);
        for (const side of [1, -1] as const) {
          _t.set(side * (b.hipX + 0.02), b.ankleY, 0.36 * s);
          plant(f, b, side, _t, side * 0.1, _pole.set(side * 0.15, 1, 0.6));
        }
        for (const side of [1, -1] as const) {
          bodyPoint(f, leg(-side as 1 | -1).lo, _t.set(0, -0.12 * s, 0.05), _w);
          reach(f, b, side, _w, _pole.set(side, -0.3, 0.2));
        }
      } else {
        // Legs out, leaning back on the hands.
        f.p[B.pelvis]!.set(0, 0.12 * s, 0);
        rot(f, B.pelvis, 0.15, 0, 0);
        rot(f, B.spine, -0.35, 0, 0);
        for (const side of [1, -1] as const) legFK(f, side, 1.5 + (side > 0 ? 0 : -0.25), side > 0 ? 0.15 : 0.7, -0.1 - (side > 0 ? 0 : 0.2), 0.08);
        for (const side of [1, -1] as const) {
          _w.set(side * 0.22 * s, 0.04, -0.3 * s);
          reach(f, b, side, _w, _pole.set(side * 0.3, 0, -1));
        }
      }
      idleHead(f, t, st, target);
      return { markers: [MK.buttL, MK.buttR], height: 0 };
    }
    case "kneel": {
      breathe(f, t, st);
      const one = st.v3 > 0.7;
      kneelLegs(f, b, one, st.v2 > 0.6 ? 0.8 : 0.1);
      rot(f, B.spine, 0.12 + b.stoop * 0.2, 0, 0);
      const plead = st.v1 > 0.66;
      for (const side of [1, -1] as const) {
        if (plead) {
          spinePt(f, side * 0.12 * s, b.shoulderY - b.waistY + 0.12 * s, 0.3 * s, _w);
          reach(f, b, side, _w, _pole.set(side, -1, -0.2));
          rot(f, arm(side).hand, -0.6, 0, 0);
        } else if (st.v1 > 0.33) {
          spinePt(f, side * 0.012, 0.2 * s, b.chestF + 0.1 * s, _w);
          reach(f, b, side, _w, _pole.set(side, -1, 0));
          rot(f, arm(side).hand, 0, 0, -side * 0.9);
        } else {
          bodyPoint(f, leg(side).up, _t.set(0, -b.thigh * 0.6, b.thighR), _w);
          reach(f, b, side, _w, _pole.set(side, -0.3, -1));
        }
      }
      if (target) aimHead(f, target, plead ? 1 : 0.5);
      else {
        rot(f, B.neck, plead ? -0.15 : 0.3, 0);
        rot(f, B.head, plead ? -0.2 : 0.35, 0);
      }
      return { markers: KNEES, height: 0 };
    }
    case "cower": {
      const tr = (vnoise(t * 9, st.seed) * 0.5 + vnoise(t * 17, st.seed + 1) * 0.5) * (0.4 + inp.agitation * 0.6);
      f.p[B.pelvis]!.set(0, 0.44 * s, -0.16 * s);
      rot(f, B.pelvis, 0.5, 0, 0);
      for (const side of [1, -1] as const) {
        _t.set(side * (b.hipX + 0.06 * s), b.ankleY, 0.08 * s);
        plant(f, b, side, _t, side * 0.3, _pole.set(side * 0.35, 0.3, 1));
      }
      rot(f, B.spine, 0.62 + tr * 0.04, tr * 0.03, 0);
      rot(f, B.neck, 0.35, 0);
      rot(f, B.head, 0.4 + tr * 0.05, 0);
      bodyXf(f, B.head, _x1);
      for (const side of [1, -1] as const) {
        _w.set(side * 0.06 * s, 0.13 * s, -0.02).applyQuaternion(_x1.q).add(_x1.p);
        reach(f, b, side, _w, _pole.set(side * 0.3, -0.4, 1));
        rot(f, arm(side).hand, 0.5, 0, 0);
      }
      if (target && inp.agitation > 0.5) aimHead(f, target, 0.35);
      return { markers: FEET, height: 0 };
    }
    case "tied": {
      tiedPose(f, inp, t);
      return { markers: LYING, height: 0 };
    }
    case "lie": {
      lyingRoot(f, b, st.headSide);
      target = refreshTarget(f, inp);
      const br = Math.sin((t / 4.2) * TAU + st.phase * 6);
      rot(f, B.spine, -0.02 * br, 0, 0);
      armFK(f, 1, 0.1, 0.22 + st.v1 * 0.3, 0.3 + st.v2 * 0.5);
      armFK(f, -1, st.v3 > 0.5 ? 0.9 : 0.1, 0.18, st.v3 > 0.5 ? 1.9 : 0.4);
      const bent = st.v2 > 0.55;
      legFK(f, 1, bent ? 0.7 : 0.05, bent ? 1.2 : 0.05, bent ? 0.5 : 0.6, 0.06);
      legFK(f, -1, 0.05, 0.08, 0.65, 0.1);
      rot(f, B.pelvis, 0, 0, 0);
      rot(f, B.neck, 0.12, 0);
      rot(f, B.head, 0.08, (st.v1 - 0.5) * 0.9);
      if (target) aimHead(f, target, 0.5, 1.2, 0.3);
      return { markers: LYING, height: st.surface };
    }
    case "wheelchair": {
      breathe(f, t, st);
      const seat = 0.5;
      f.p[B.pelvis]!.set(0, seat + 0.1 * s, -0.04 * s);
      rot(f, B.pelvis, -0.1, 0, 0);
      rot(f, B.spine, 0.05 + b.stoop * 0.3, 0, 0);
      for (const side of [1, -1] as const) {
        _t.set(side * 0.1, 0.11 + b.ankleY, 0.36);
        plant(f, b, side, _t, 0, _pole.set(0, 0.4, 1), -0.1);
      }
      const push = smooth((vnoise(t * 0.12, st.seed) - 0.2) * 3);
      const pp = Math.sin(t * 2.2 + st.phase) * 0.5 + 0.5;
      for (const side of [1, -1] as const) {
        const onRim = new THREE.Vector3(side * 0.3, 0.72 - pp * 0.08 * push, -0.1 + pp * 0.25 * push);
        const onLap = new THREE.Vector3(side * 0.12, seat + 0.18, 0.2);
        _w.copy(onLap).lerp(onRim, push);
        reach(f, b, side, _w, _pole.set(side, -0.3, -1));
      }
      idleHead(f, t, st, target);
      return null;
    }
  }
}

function holdSign(f: Frame, inp: PoseInput, t: number, height: number): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  const pump = Math.max(0, Math.sin((t * 0.9 + st.phase) * TAU)) * 0.07 * height;
  spinePt(f, -0.21 * s, b.shoulderY - b.waistY + (0.0 + 0.4 * height) * s + pump, b.chestF + 0.06 * s, _w);
  grip(f, b, -1, _w, _pole.set(-1, -0.4, -0.3));
  bodyXf(f, B.propR, _x1);
  _q.setFromEuler(_e.set(-0.04, 0, vnoise(t * 0.5, st.seed) * 0.05));
  placeProp(f, B.propR, _x1.p, _q);
  _w.set(0, -0.42, 0).applyQuaternion(_q).add(_x1.p);
  reach(f, b, 1, _w, _pole.set(1, -1, -0.4));
  rot(f, B.neck, -0.05, vnoise(t * 0.2, st.seed) * 0.1);
  rot(f, B.head, -0.04, vnoise(t * 0.23, st.seed + 2) * 0.2);
  if (inp.target) aimHead(f, inp.target, 0.6);
}

function tiedPose(f: Frame, inp: PoseInput, t: number): void {
  const b = inp.body;
  const st = inp.style;
  const k = THREE.MathUtils.clamp(0.25 + inp.agitation * 0.75, 0, 1);
  lyingRoot(f, b, st.headSide);
  const onSide = st.v3 > 0.45;
  if (onSide) {
    // Rolled onto one side, facing the way the trolley comes (+z).
    const roll = 1.15;
    _q2.setFromAxisAngle(_v.set(0, 1, 0), roll);
    _q.copy(f.q[B.root]!).multiply(_q2);
    const face = _v.set(0, 0, 1).applyQuaternion(_q);
    if (face.z < 0) {
      _q2.setFromAxisAngle(_v.set(0, 1, 0), -roll);
      _q.copy(f.q[B.root]!).multiply(_q2);
    }
    f.q[B.root]!.copy(_q);
    _v.set(0, b.H * 0.55, 0).applyQuaternion(_q);
    f.p[B.root]!.set(-_v.x, 0, -_v.z);
  }
  refreshTarget(f, inp);
  // Bursts of struggle: pull against the ropes, rest, pull again.
  const burst = smooth((vnoise(t * 0.45, st.seed) + 0.2) * 2) * k;
  const tug = Math.sin(t * 5.2 + st.phase * 7) * burst;
  const twist = vnoise(t * 1.3, st.seed + 1) * burst;
  rot(f, B.pelvis, -0.05 + tug * 0.03, twist * 0.1, 0);
  rot(f, B.spine, -0.06 - burst * 0.1 + tug * 0.04, -twist * 0.18, twist * 0.05);
  // Arms pinned to the sides by the chest coil.
  armFK(f, 1, 0.04 + tug * 0.03, 0.05, 0.12 + burst * 0.1);
  armFK(f, -1, 0.04 - tug * 0.03, 0.05, 0.12 + burst * 0.1);
  rot(f, B.handL, 0.2, 0, -0.2);
  rot(f, B.handR, 0.2, 0, 0.2);
  // Bound ankles: both legs move together.
  const kneeUp = Math.max(0, vnoise(t * 0.7, st.seed + 2)) * burst + (onSide ? 0.55 : 0);
  const kick = Math.sin(t * 4.1 + st.phase) * burst * 0.08;
  for (const side of [1, -1] as const) legFK(f, side, 0.04 + kneeUp * 0.5 + kick, kneeUp * 0.8, 0.55 - kneeUp * 0.3, -0.005);
  if (onSide) addRot(f, B.spine, 0.25, 0, 0);
  // Head lifts and turns toward the target (the trolley).
  const lift = 0.2 + burst * 0.35;
  rot(f, B.neck, lift * 0.6, 0);
  rot(f, B.head, lift * 0.4, 0);
  if (inp.target) aimHead(f, inp.target, 0.4 + k * 0.6, 1.4, 0.5);
  else {
    rot(f, B.neck, lift * 0.6, vnoise(t * 0.6, st.seed + 3) * 0.6);
    rot(f, B.head, lift * 0.4, vnoise(t * 0.8, st.seed + 4) * 0.5);
  }
}

/**
 * Startle guard layered over any upright pose: shoulders rise, the body
 * rocks back, free hands come up in front of the face. `f` is modified in
 * place and should then be blended over the base pose by the envelope.
 */
export function flinchGuard(f: Frame, inp: PoseInput, t: number, crouch: boolean): void {
  const b = inp.body;
  const st = inp.style;
  const s = b.H / 1.78;
  f.p[B.armL]!.y += 0.035 * s;
  f.p[B.armR]!.y += 0.035 * s;
  if (crouch) {
    f.p[B.pelvis]!.y -= 0.05 * s;
    f.p[B.pelvis]!.z -= 0.05 * s;
  }
  addRot(f, B.spine, -0.1 + vnoise(t * 12, st.seed) * 0.03, 0, 0);
  addRot(f, B.neck, 0.12, 0, 0);
  for (const side of [1, -1] as const) {
    const held = side > 0 ? st.left : st.right;
    if (held && held !== "clipboard" && held !== "tablet" && held !== "folder" && held !== "teddy") {
      // A laden hand stays low; the elbow just tightens.
      addRot(f, arm(side).lo, -0.35, 0, 0);
      continue;
    }
    spinePt(f, side * 0.07 * s, b.shoulderY - b.waistY + 0.16 * s, b.chestF + 0.2 * s, _w);
    reach(f, b, side, _w, _pole.set(side * 0.7, -1, -0.2));
    rot(f, arm(side).hand, -0.5, 0, -side * 0.3);
  }
}
