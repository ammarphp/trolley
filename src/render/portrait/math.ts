/**
 * Small, allocation-light vector helpers for the portrait's software
 * renderer. Everything here is in the "bust frame": centimetres, origin at
 * the midpoint between the ear canals, +y up, +z the direction the face
 * points, +x the sitter's LEFT (so a frontal viewer sees +x on their right).
 */

export type V3 = [number, number, number];

/** Labels for profiling the time-sliced build (lab only; costs nothing). */
export const BUILD_TRACE = { label: "" };

export const DEG = Math.PI / 180;

export function v3(x: number, y: number, z: number): V3 {
  return [x, y, z];
}
export function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function scale(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function len(a: V3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function norm(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function clamp(x: number, lo = 0, hi = 1): number {
  return x < lo ? lo : x > hi ? hi : x;
}
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
/** Polynomial smooth maximum (union of radial distances). */
export function smax(a: number, b: number, k: number): number {
  if (k <= 0) return Math.max(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return a + (b - a) * h + k * h * (1 - h);
}
/** Polynomial smooth minimum. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Row-major 3x3 rotation. */
export type M3 = [number, number, number, number, number, number, number, number, number];

export function m3Identity(): M3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}
export function m3Mul(a: M3, b: M3): M3 {
  const r = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return r;
}
export function m3Apply(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
export function m3Transpose(m: M3): M3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
export function rotX(a: number): M3 {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
export function rotY(a: number): M3 {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
export function rotZ(a: number): M3 {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
/** Rotation from yaw (about y), pitch (about x), roll (about z), applied roll→pitch→yaw. */
export function rotYPR(yaw: number, pitch: number, roll: number): M3 {
  return m3Mul(rotY(yaw), m3Mul(rotX(pitch), rotZ(roll)));
}

/** A rigid transform: p' = R (p - pivot) + pivot + offset. */
export interface Pose {
  r: M3;
  pivot: V3;
  offset: V3;
}
export function poseIdentity(): Pose {
  return { r: m3Identity(), pivot: [0, 0, 0], offset: [0, 0, 0] };
}
export function posePoint(p: Pose, v: V3): V3 {
  const q = m3Apply(p.r, [v[0] - p.pivot[0], v[1] - p.pivot[1], v[2] - p.pivot[2]]);
  return [q[0] + p.pivot[0] + p.offset[0], q[1] + p.pivot[1] + p.offset[1], q[2] + p.pivot[2] + p.offset[2]];
}
export function poseDir(p: Pose, v: V3): V3 {
  return m3Apply(p.r, v);
}

/**
 * Pinhole camera looking at the sitter from the mirror. Screen y grows
 * downward; depth is the distance along the view axis in centimetres.
 */
export interface Cam {
  pos: V3;
  right: V3;
  up: V3;
  fwd: V3;
  f: number;
  cx: number;
  cy: number;
}

export function lookCam(pos: V3, target: V3, f: number, cx: number, cy: number, roll = 0): Cam {
  const fwd = norm(sub(target, pos));
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  if (roll) {
    const c = Math.cos(roll),
      s = Math.sin(roll);
    const r2 = add(scale(right, c), scale(up, s));
    const u2 = add(scale(up, c), scale(right, -s));
    right = r2;
    up = u2;
  }
  return { pos, right, up, fwd, f, cx, cy };
}

/** Project into (sx, sy, depth). */
export function project(c: Cam, x: number, y: number, z: number, out: Float32Array, o: number): void {
  const dx = x - c.pos[0],
    dy = y - c.pos[1],
    dz = z - c.pos[2];
  const zc = dx * c.fwd[0] + dy * c.fwd[1] + dz * c.fwd[2];
  const xc = dx * c.right[0] + dy * c.right[1] + dz * c.right[2];
  const yc = dx * c.up[0] + dy * c.up[1] + dz * c.up[2];
  const iz = c.f / Math.max(zc, 1e-3);
  out[o] = c.cx + xc * iz;
  out[o + 1] = c.cy - yc * iz;
  out[o + 2] = zc;
}

export function projectV(c: Cam, p: V3): [number, number, number] {
  const tmp = new Float32Array(3);
  project(c, p[0], p[1], p[2], tmp, 0);
  return [tmp[0]!, tmp[1]!, tmp[2]!];
}

/** Unit vector from a point toward the camera. */
export function toCam(c: Cam, p: V3): V3 {
  return norm(sub(c.pos, p));
}

/** Deterministic hash noise in [0,1) for 1-3 integer-ish inputs. */
export function hash3(a: number, b = 0, c = 0): number {
  let h = Math.imul((a * 73856093) ^ (b * 19349663) ^ (c * 83492791), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000003) / 1000003;
}

/** Smooth 1D value noise in [-1, 1]. */
export function vnoise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash3(i, seed) * 2 - 1;
  const b = hash3(i + 1, seed) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
