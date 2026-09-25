/**
 * Rigid-part skinning for the figure kit.
 *
 * Every part is authored in the local frame of one bone (origin at the joint,
 * rest rotations are identity so limbs hang along -y and the figure faces +z)
 * and bound 100% to that bone. One person is one SkinnedMesh: one draw call
 * with jointed motion.
 *
 * Also here: pose frames, forward kinematics in "body space" (the root bone's
 * local frame), a two-bone IK solver for arms and legs, head aiming, and a CPU
 * bake that freezes a posed person into static geometry for instanced crowds.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit, type PartOptions } from "../../core/geometry.ts";
import type { Body } from "./anatomy.ts";

export const B = {
  root: 0,
  pelvis: 1,
  spine: 2,
  neck: 3,
  head: 4,
  armL: 5,
  foreL: 6,
  handL: 7,
  armR: 8,
  foreR: 9,
  handR: 10,
  thighL: 11,
  shinL: 12,
  footL: 13,
  thighR: 14,
  shinR: 15,
  footR: 16,
  coatL: 17,
  coatR: 18,
  propR: 19,
  propL: 20,
  /** Top-level: wheelchairs, stretchers, dropped hats, rope anchors. */
  furniture: 21,
  /** Top-level: the pool that spreads after a strike. */
  pool: 22,
} as const;
export type BoneName = keyof typeof B;
export const BONE_COUNT = 23;
export const PARENT: readonly number[] = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 1, 11, 12, 1, 14, 15, 1, 1, 10, 7, -1, -1];

/** Parent-relative rest offsets. */
export function restOffsets(b: Body): THREE.Vector3[] {
  const s = b.H / 1.78;
  const o: THREE.Vector3[] = Array.from({ length: BONE_COUNT }, () => new THREE.Vector3());
  o[B.pelvis]!.set(0, b.hipY, 0);
  o[B.spine]!.set(0, b.waistY - b.hipY, -0.012 * s);
  o[B.neck]!.set(0, b.neckY - b.waistY, -0.018 * s);
  o[B.head]!.set(0, b.headY - b.neckY, 0.012 * s);
  o[B.armL]!.set(b.shoulderX, b.shoulderY - b.waistY, -0.012 * s);
  o[B.armR]!.set(-b.shoulderX, b.shoulderY - b.waistY, -0.012 * s);
  o[B.foreL]!.set(0, -b.upperArm, 0);
  o[B.foreR]!.set(0, -b.upperArm, 0);
  o[B.handL]!.set(0, -b.foreArm, 0);
  o[B.handR]!.set(0, -b.foreArm, 0);
  o[B.thighL]!.set(b.hipX, 0, 0);
  o[B.thighR]!.set(-b.hipX, 0, 0);
  o[B.shinL]!.set(0, -b.thigh, 0);
  o[B.shinR]!.set(0, -b.thigh, 0);
  o[B.footL]!.set(0, -b.shin, 0);
  o[B.footR]!.set(0, -b.shin, 0);
  o[B.coatL]!.set(b.hipW * 0.42, b.waistY - b.hipY - 0.02 * s, 0);
  o[B.coatR]!.set(-b.hipW * 0.42, b.waistY - b.hipY - 0.02 * s, 0);
  o[B.propR]!.set(0, -b.hand * 0.34, 0.004);
  o[B.propL]!.set(0, -b.hand * 0.34, 0.004);
  return o;
}

/** Rest positions in mesh space (rest rotations are identity). */
export function restWorld(offsets: THREE.Vector3[]): THREE.Vector3[] {
  const w: THREE.Vector3[] = offsets.map(() => new THREE.Vector3());
  for (let i = 0; i < BONE_COUNT; i++) {
    const p = PARENT[i]!;
    w[i]!.copy(offsets[i]!);
    if (p >= 0) w[i]!.add(w[p]!);
  }
  return w;
}

/** Collects parts per bone, in bone-local coordinates. */
export class PartSink {
  readonly kits: Kit[] = Array.from({ length: BONE_COUNT }, () => new Kit());
  add(bone: number, geometry: THREE.BufferGeometry, opts: PartOptions = {}): this {
    this.kits[bone]!.add(geometry, opts);
    return this;
  }
  /** Merge all parts into one skinned geometry. */
  build(world: THREE.Vector3[]): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < BONE_COUNT; i++) {
      const kit = this.kits[i]!;
      if (kit.empty) continue;
      const g = kit.build();
      g.translate(world[i]!.x, world[i]!.y, world[i]!.z);
      const n = g.getAttribute("position").count;
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) {
        si[v * 4] = i;
        sw[v * 4] = 1;
      }
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false);
    if (!merged) throw new Error("people: skinned merge failed");
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
}

// ------------------------------------------------------------------- frames

export class Frame {
  readonly q: THREE.Quaternion[] = Array.from({ length: BONE_COUNT }, () => new THREE.Quaternion());
  readonly p: THREE.Vector3[] = Array.from({ length: BONE_COUNT }, () => new THREE.Vector3());
  readonly s: number[] = new Array<number>(BONE_COUNT).fill(1);
  reset(rest: THREE.Vector3[]): this {
    for (let i = 0; i < BONE_COUNT; i++) {
      this.q[i]!.identity();
      this.p[i]!.copy(rest[i]!);
      this.s[i] = 1;
    }
    return this;
  }
  copy(o: Frame): this {
    for (let i = 0; i < BONE_COUNT; i++) {
      this.q[i]!.copy(o.q[i]!);
      this.p[i]!.copy(o.p[i]!);
      this.s[i] = o.s[i]!;
    }
    return this;
  }
  /** this = mix(this, o, t) */
  blend(o: Frame, t: number): this {
    if (t <= 0) return this;
    if (t >= 1) return this.copy(o);
    for (let i = 0; i < BONE_COUNT; i++) {
      this.q[i]!.slerp(o.q[i]!, t);
      this.p[i]!.lerp(o.p[i]!, t);
      this.s[i] = this.s[i]! + (o.s[i]! - this.s[i]!) * t;
    }
    return this;
  }
  apply(bones: THREE.Bone[]): void {
    for (let i = 0; i < BONE_COUNT; i++) {
      const b = bones[i]!;
      b.quaternion.copy(this.q[i]!);
      b.position.copy(this.p[i]!);
      const s = this.s[i]!;
      b.scale.setScalar(s < 1e-4 ? 1e-4 : s);
    }
  }
}

const _e = new THREE.Euler();
/** Set a bone rotation from Euler angles in radians. */
export function rot(f: Frame, bone: number, x: number, y = 0, z = 0, order: THREE.EulerOrder = "XYZ"): void {
  f.q[bone]!.setFromEuler(_e.set(x, y, z, order));
}
/** Post-multiply an extra local rotation onto a bone. */
export function addRot(f: Frame, bone: number, x: number, y = 0, z = 0, order: THREE.EulerOrder = "XYZ"): void {
  _q.setFromEuler(_e.set(x, y, z, order));
  f.q[bone]!.multiply(_q);
}
const _q = new THREE.Quaternion();

export interface Xf {
  p: THREE.Vector3;
  q: THREE.Quaternion;
}
export const xf = (): Xf => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() });

/**
 * Transform of `bone` in body space (the root bone's local frame), composed
 * from the frame's local rotations/offsets. Scale is ignored.
 */
export function bodyXf(f: Frame, bone: number, out: Xf): Xf {
  const chain: number[] = [];
  for (let i = bone; i > 0; i = PARENT[i]!) chain.push(i);
  out.p.set(0, 0, 0);
  out.q.identity();
  for (let k = chain.length - 1; k >= 0; k--) {
    const i = chain[k]!;
    const off = _v.copy(f.p[i]!).applyQuaternion(out.q);
    out.p.add(off);
    out.q.multiply(f.q[i]!);
  }
  return out;
}
const _v = new THREE.Vector3();

/** A point given in `bone`'s local frame, expressed in body space. */
export function bodyPoint(f: Frame, bone: number, local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  bodyXf(f, bone, _x);
  return out.copy(local).applyQuaternion(_x.q).add(_x.p);
}
const _x = xf();

const _S = new THREE.Vector3();
const _T = new THREE.Vector3();
const _P = new THREE.Vector3();
const _d = new THREE.Vector3();
const _pp = new THREE.Vector3();
const _E = new THREE.Vector3();
const _u = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _X = new THREE.Vector3();
const _Y = new THREE.Vector3();
const _Z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _px = xf();
const _qi = new THREE.Quaternion();

/**
 * Two-bone IK. `target` (body space) is where the distal joint (wrist or
 * ankle) should go. `pole` (body space direction) is where the middle joint
 * (elbow/knee) should point. Arms bend forward about local x (negative), legs
 * bend backward (positive). Returns false when the target was out of reach
 * (the limb is then fully extended toward it).
 */
export function solveLimb(
  f: Frame,
  upper: number,
  lower: number,
  a: number,
  b: number,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  kind: "arm" | "leg",
): boolean {
  const parent = PARENT[upper]!;
  bodyXf(f, parent, _px);
  _qi.copy(_px.q).invert();
  // Work in the parent's local frame.
  _S.copy(f.p[upper]!);
  _T.copy(target).sub(_px.p).applyQuaternion(_qi);
  _P.copy(pole).applyQuaternion(_qi).normalize();
  _d.subVectors(_T, _S);
  let dist = _d.length();
  const reach = dist <= a + b - 1e-4;
  dist = THREE.MathUtils.clamp(dist, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  _d.normalize();
  _pp.copy(_P).addScaledVector(_d, -_P.dot(_d));
  if (_pp.lengthSq() < 1e-8) _pp.set(0, 0, kind === "arm" ? -1 : 1).addScaledVector(_d, -_d.z);
  _pp.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _E.copy(_S).addScaledVector(_d, a * cosA).addScaledVector(_pp, a * sinA);
  _u.subVectors(_E, _S).normalize();
  const endPoint = _fw.copy(_S).addScaledVector(_d, dist);
  _fw.subVectors(endPoint, _E).normalize();
  const cosE = THREE.MathUtils.clamp(_u.dot(_fw), -1, 1);
  const flex = Math.acos(cosE);
  // Basis: local -y along the upper segment; local +z toward the side the
  // lower segment swings to (arms) or away from it (legs).
  _Y.copy(_u).negate();
  _Z.copy(_fw).addScaledVector(_u, -_fw.dot(_u));
  if (_Z.lengthSq() < 1e-8) _Z.copy(_pp).negate();
  _Z.normalize();
  if (kind === "leg") _Z.negate();
  _X.crossVectors(_Y, _Z).normalize();
  _Z.crossVectors(_X, _Y).normalize();
  _m.makeBasis(_X, _Y, _Z);
  f.q[upper]!.setFromRotationMatrix(_m);
  f.q[lower]!.setFromAxisAngle(_axisX, kind === "arm" ? -flex : flex);
  return reach;
}
const _axisX = new THREE.Vector3(1, 0, 0);

/** Set a bone's local rotation so its body-space orientation equals `q`. */
export function orientBody(f: Frame, bone: number, q: THREE.Quaternion): void {
  bodyXf(f, PARENT[bone]!, _px);
  f.q[bone]!.copy(_px.q).invert().multiply(q);
}

/** Aim the head (split with the neck) at a body-space point. */
export function aimHead(f: Frame, target: THREE.Vector3, weight = 1, limitYaw = 1.4, limitPitch = 0.7): void {
  bodyXf(f, B.neck, _px);
  _qi.copy(_px.q).invert();
  _T.copy(target).sub(_px.p).applyQuaternion(_qi);
  _T.y -= 0.12;
  const yaw = THREE.MathUtils.clamp(Math.atan2(_T.x, _T.z), -limitYaw, limitYaw) * weight;
  const pitch = THREE.MathUtils.clamp(-Math.atan2(_T.y, Math.hypot(_T.x, _T.z)), -limitPitch, limitPitch) * weight;
  _q.setFromEuler(_e.set(pitch * 0.35, yaw * 0.4, 0, "YXZ"));
  f.q[B.neck]!.multiply(_q);
  _q.setFromEuler(_e.set(pitch * 0.65, yaw * 0.6, 0, "YXZ"));
  f.q[B.head]!.multiply(_q);
}

// ---------------------------------------------------------------- skeleton

export function createSkeleton(offsets: THREE.Vector3[]): { bones: THREE.Bone[]; tops: THREE.Bone[] } {
  const bones: THREE.Bone[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const bone = new THREE.Bone();
    bone.name = (Object.keys(B) as BoneName[])[i]!;
    bone.position.copy(offsets[i]!);
    bones.push(bone);
  }
  const tops: THREE.Bone[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const p = PARENT[i]!;
    if (p >= 0) bones[p]!.add(bones[i]!);
    else tops.push(bones[i]!);
  }
  return { bones, tops };
}

/**
 * Freeze a posed skinned mesh into plain geometry (position, normal,
 * inkAttr) for instancing. The mesh must be unparented or at identity.
 */
export function bakeSkinned(mesh: THREE.SkinnedMesh): THREE.BufferGeometry {
  mesh.updateMatrixWorld(true);
  const skeleton = mesh.skeleton;
  skeleton.update();
  const src = mesh.geometry;
  const pos = src.getAttribute("position") as THREE.BufferAttribute;
  const nrm = src.getAttribute("normal") as THREE.BufferAttribute;
  const ink = src.getAttribute("inkAttr") as THREE.BufferAttribute;
  const si = src.getAttribute("skinIndex") as THREE.BufferAttribute;
  const mats: THREE.Matrix4[] = skeleton.bones.map((bone, i) => new THREE.Matrix4().multiplyMatrices(bone.matrixWorld, skeleton.boneInverses[i]!));
  const nmats = mats.map((m) => new THREE.Matrix3().getNormalMatrix(m));
  const n = pos.count;
  const P = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  let keep = 0;
  const outIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    const bi = si.getX(i);
    v.fromBufferAttribute(pos, i).applyMatrix4(mats[bi]!);
    w.fromBufferAttribute(nrm, i).applyMatrix3(nmats[bi]!).normalize();
    P[i * 3] = v.x;
    P[i * 3 + 1] = v.y;
    P[i * 3 + 2] = v.z;
    N[i * 3] = w.x;
    N[i * 3 + 1] = w.y;
    N[i * 3 + 2] = w.z;
  }
  // Drop triangles whose bone is hidden (scaled to ~0).
  const hidden = skeleton.bones.map((bone) => bone.getWorldScale(v).x < 0.01);
  for (let t = 0; t < n; t += 3) {
    if (hidden[si.getX(t)]) continue;
    outIdx.push(t, t + 1, t + 2);
    keep += 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  out.setAttribute("inkAttr", ink.clone());
  if (keep < n) out.setIndex(outIdx);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
