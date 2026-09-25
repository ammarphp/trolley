/**
 * Geometry kit for procedural assets.
 *
 * Every builder composes "parts": primitive geometries that are transformed,
 * painted with an ink tone/accent (the `inkAttr` attribute) and merged into
 * one BufferGeometry. One asset = one geometry = one draw call, with per-part
 * albedo preserved. Use `new Kit()` then `kit.add(...)` and `kit.build()`.
 */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "./ink-material.ts";
import type { AccentName, ToneName } from "./palette.ts";

export type Tone = number | ToneName;

export interface PartOptions {
  tone?: Tone;
  accent?: AccentName;
  accentAmount?: number;
  position?: THREE.Vector3Like | [number, number, number];
  rotation?: THREE.Euler | [number, number, number];
  scale?: number | [number, number, number];
  /** Pre-built matrix, applied after position/rotation/scale. */
  matrix?: THREE.Matrix4;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function composeMatrix(opts: PartOptions): THREE.Matrix4 {
  const p = opts.position;
  if (Array.isArray(p)) tmpPos.set(p[0], p[1], p[2]);
  else if (p) tmpPos.set(p.x, p.y, p.z);
  else tmpPos.set(0, 0, 0);
  const r = opts.rotation;
  if (Array.isArray(r)) tmpEuler.set(r[0], r[1], r[2]);
  else if (r) tmpEuler.copy(r);
  else tmpEuler.set(0, 0, 0);
  tmpQuat.setFromEuler(tmpEuler);
  const s = opts.scale;
  if (Array.isArray(s)) tmpScale.set(s[0], s[1], s[2]);
  else tmpScale.setScalar(s ?? 1);
  const m = new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale);
  if (opts.matrix) m.premultiply(opts.matrix);
  return m;
}

/** Normalise a geometry so it can merge with any other kit part. */
export function normalise(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "inkAttr") g.deleteAttribute(name);
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}

export class Kit {
  private parts: THREE.BufferGeometry[] = [];

  add(geometry: THREE.BufferGeometry, opts: PartOptions = {}): this {
    const g = normalise(geometry.clone());
    g.applyMatrix4(composeMatrix(opts));
    if (!g.getAttribute("inkAttr") || opts.tone !== undefined || opts.accent !== undefined) {
      paintGeometry(g, opts.tone ?? "paper", opts.accent ?? "none", opts.accentAmount);
    }
    this.parts.push(g);
    return this;
  }

  /** Add an already-built kit's output (e.g. a sub-assembly). */
  addGeometry(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): this {
    const g = normalise(geometry.clone());
    if (matrix) g.applyMatrix4(matrix);
    if (!g.getAttribute("inkAttr")) paintGeometry(g, "paper");
    this.parts.push(g);
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  build(options: { weld?: boolean } = {}): THREE.BufferGeometry {
    if (!this.parts.length) return new THREE.BufferGeometry();
    let merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error("Kit merge failed: incompatible parts");
    if (options.weld) merged = mergeVertices(merged, 1e-4);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
}

// ---------------------------------------------------------------- primitives

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Box whose origin sits on its base (y = 0). */
export function block(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

export function cylinder(rTop: number, rBottom: number, h: number, segments = 12, open = false): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);
}

export function sphere(r: number, w = 14, h = 10): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, w, h);
}

export function capsule(r: number, length: number, cap = 5, radial = 10): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(r, length, cap, radial);
}

export function cone(r: number, h: number, segments = 12): THREE.BufferGeometry {
  return new THREE.ConeGeometry(r, h, segments);
}

/** Surface of revolution from [radius, height] pairs (bottom to top). */
export function lathe(profile: Array<[number, number]>, segments = 16): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    segments,
  );
}

/** Tube along a list of points (Catmull-Rom). */
export function tube(points: Array<[number, number, number]>, radius: number, segments = 16, radial = 6, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed);
  return new THREE.TubeGeometry(curve, segments, radius, radial, closed);
}

/** Extrude a 2D outline (x, y) by depth along z, centred on z. */
export function extrude(outline: Array<[number, number]>, depth: number, bevel = 0, holes: Array<Array<[number, number]>> = []): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Gable roof prism: width across x, ridge along z. Origin at eave level. */
export function gable(width: number, depth: number, rise: number, overhang = 0.3): THREE.BufferGeometry {
  const w = width / 2 + overhang;
  return extrude(
    [
      [-w, 0],
      [w, 0],
      [0, rise],
    ],
    depth + overhang * 2,
  );
}

/** A thin flat panel lying in the XY plane (facing +z). */
export function panel(w: number, h: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(w, h);
}

/** Deform a geometry's vertices in place. */
export function deform(geometry: THREE.BufferGeometry, fn: (v: THREE.Vector3, i: number) => void): THREE.BufferGeometry {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Apply a stable pseudo-random jitter so hand-made shapes are never perfect. */
export function jitter(geometry: THREE.BufferGeometry, amount: number, seed = 1): THREE.BufferGeometry {
  const g = geometry.index ? mergeVertices(geometry.clone(), 1e-5) : geometry;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
    const r = h - Math.floor(h) - 0.5;
    const h2 = Math.sin(x * 93.9898 + y * 67.345 + z * 11.135 + seed * 2.3) * 24634.6345;
    const r2 = h2 - Math.floor(h2) - 0.5;
    const h3 = Math.sin(x * 43.332 + y * 12.123 + z * 91.123 + seed * 7.7) * 12345.6789;
    const r3 = h3 - Math.floor(h3) - 0.5;
    pos.setXYZ(i, x + r * amount, y + r2 * amount, z + r3 * amount);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export const DEG = Math.PI / 180;
