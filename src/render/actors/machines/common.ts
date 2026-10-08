/**
 * Shared machinery for vehicles and machines.
 *
 *   Rig        rigid-part skinning: every part binds 100% to one bone, so a
 *              vehicle with rolling wheels (or a robot with limbs) is one
 *              SkinnedMesh and one draw call.
 *   LampSet    emissive pigment lamps whose level can be switched per frame
 *              (beacons, server status lamps, cursors) in one draw call.
 *   Decals     inked canvas atlases (lettering, stencils, dials) laid on
 *              surfaces as UV-mapped planes, one draw call per asset.
 *   shapes     engineered primitives: profile extrusions with wheel arches,
 *              lofted hulls, tyres and rims, louvres, bolt rings, springs.
 *
 * Everything faces +Z, is measured in metres, and stands on y = 0.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit, composeMatrix, extrude, lathe, normalise, type PartOptions, type Tone } from "../../core/geometry.ts";
import { createInkCanvas, inkMaterial, paintGeometry, textureCache } from "../../core/ink-material.ts";
import { ACCENT, TONE, type AccentName } from "../../core/palette.ts";
import type { EnvironmentTarget } from "../../api.ts";
import { createNoise } from "../../core/noise.ts";

export type V2 = [number, number];
export type V3 = [number, number, number];
export type Tick = (dt: number, t: number) => void;

/** Object-space hatch periods (metres) by asset class. */
export const HATCH = {
  vehicle: 0.042,
  heavy: 0.055,
  rail: 0.06,
  machine: 0.03,
  fine: 0.02,
} as const;

/** Object ids: distinct ids draw a pen line where actors meet the ground. */
export const OBJECT_ID = {
  vehicle: 0.52,
  rail: 0.53,
  machine: 0.56,
  robot: 0.58,
  lamp: 0.61,
  drone: 0.63,
} as const;

export function toneOf(t: Tone): number {
  return typeof t === "number" ? t : TONE[t];
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ------------------------------------------------------------- materials

export function bodyMaterial(hatch: number, objectId: number = OBJECT_ID.vehicle, hatchAngle = 0): THREE.Material {
  return inkMaterial({ vertexInk: true, hatchSpace: "object", hatch, objectId, hatchAngle });
}

/** Lamps ignore lighting: their tone and pigment are exactly what is set. */
export function lampMaterial(objectId: number = OBJECT_ID.lamp): THREE.Material {
  return inkMaterial({ vertexInk: true, hatchSpace: "object", flat: true, objectId, hatch: HATCH.fine, edge: 0.7 });
}

export function decalMaterial(texture: THREE.Texture, hatch: number, objectId: number): THREE.Material {
  return inkMaterial({ map: texture, hatchSpace: "object", hatch, objectId });
}

// ------------------------------------------------------------ conditions

/** The state of the world an actor is drawn in. */
export type Condition = "normal" | "wreck" | "pristine";

export function resolveCondition(env: Partial<EnvironmentTarget> | undefined, explicit?: Condition): Condition {
  if (explicit) return explicit;
  if (!env) return "normal";
  if ((env.ruin ?? 0) > 0.7 || (env.fire ?? 0) > 0.8) return "wreck";
  if ((env.perfection ?? 0) > 0.6 || (env.uniformity ?? 0) > 0.75) return "pristine";
  return "normal";
}

/**
 * Burn a merged geometry: soot patches (seeded noise over triangle
 * centroids) push tones toward ink, and all pigment is lost.
 */
export function scorch(geometry: THREE.BufferGeometry, seed: number | string, amount = 1): void {
  const ink = geometry.getAttribute("inkAttr") as THREE.BufferAttribute | undefined;
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!ink) return;
  const noise = createNoise(`scorch:${seed}`);
  const arr = ink.array as Float32Array;
  const tri = geometry.index ? null : 3;
  const n = pos.count;
  const step = tri ?? 1;
  for (let i = 0; i < n; i += step) {
    let cx = 0,
      cy = 0,
      cz = 0;
    const m = Math.min(step, n - i);
    for (let j = 0; j < m; j++) {
      cx += pos.getX(i + j);
      cy += pos.getY(i + j);
      cz += pos.getZ(i + j);
    }
    cx /= m;
    cy /= m;
    cz /= m;
    const v = noise.fbm2(cx * 0.9 + cz * 0.3, cy * 1.1 - cz * 0.7, 3) * 0.5 + 0.5;
    const soot = Math.max(0, Math.min(1, (v - 0.2) * 2.2)) * amount;
    for (let j = 0; j < m; j++) {
      const k = (i + j) * 3;
      arr[k] = Math.min(1, arr[k]! + (0.97 - arr[k]!) * soot + 0.2 * amount);
      arr[k + 1] = 0;
      arr[k + 2] = 0;
    }
  }
  ink.needsUpdate = true;
}

// ------------------------------------------------------------------- rig

/**
 * Bones with identity rest rotations; parts are authored in each bone's
 * local frame (origin at the joint) and bound rigidly to it.
 */
export class Rig {
  readonly bones: THREE.Bone[] = [];
  private kits: Kit[] = [];
  private rest: THREE.Vector3[] = [];
  private index = new Map<string, number>();

  constructor() {
    this.bone("root", null, [0, 0, 0]);
  }

  bone(name: string, parent: string | null, offset: V3): THREE.Bone {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(offset[0], offset[1], offset[2]);
    const base = parent === null ? new THREE.Vector3() : this.rest[this.idx(parent)]!;
    this.rest.push(base.clone().add(b.position));
    if (parent !== null) this.bones[this.idx(parent)]!.add(b);
    this.index.set(name, this.bones.length);
    this.bones.push(b);
    this.kits.push(new Kit());
    return b;
  }

  has(name: string): boolean {
    return this.index.has(name);
  }

  private idx(name: string): number {
    const i = this.index.get(name);
    if (i === undefined) throw new Error(`machines rig: no bone "${name}"`);
    return i;
  }

  get(name: string): THREE.Bone {
    return this.bones[this.idx(name)]!;
  }

  kit(name = "root"): Kit {
    return this.kits[this.idx(name)]!;
  }

  restOf(name: string): THREE.Vector3 {
    return this.rest[this.idx(name)]!.clone();
  }

  build(material: THREE.Material): THREE.SkinnedMesh {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < this.bones.length; i++) {
      const kit = this.kits[i]!;
      if (kit.empty) continue;
      const g = kit.build();
      const r = this.rest[i]!;
      g.translate(r.x, r.y, r.z);
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
    if (!merged) throw new Error("machines rig: merge failed");
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(merged, material);
    mesh.add(this.bones[0]!);
    // Bind at the rest pose (identity rotations), then restore any pose the
    // builder set, so a pose authored before build() is not baked into the
    // bind matrices.
    const posed = this.bones.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
    this.bones.forEach((b, i) => {
      b.quaternion.identity();
      const parent = this.rest[this.bones.indexOf(b.parent as THREE.Bone)];
      if (parent) b.position.copy(this.rest[i]!).sub(parent);
      else b.position.copy(this.rest[i]!);
    });
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(this.bones));
    this.bones.forEach((b, i) => {
      b.quaternion.copy(posed[i]!.q);
      b.position.copy(posed[i]!.p);
    });
    mesh.updateMatrixWorld(true);
    const bs = merged.boundingSphere!.clone();
    bs.radius *= 1.2;
    mesh.boundingSphere = bs;
    return mesh;
  }
}

// ----------------------------------------------------------------- lamps

export interface LampOptions extends PartOptions {
  accent?: AccentName;
  /** Tone when dark (default "light"). */
  off?: Tone;
  /** Tone when lit (default "paper"). */
  on?: Tone;
  /** Initial level 0..1 (default 0). */
  level?: number;
}

/** A set of individually switchable lamps drawn as one flat-lit mesh. */
export class LampSet {
  private parts: THREE.BufferGeometry[] = [];
  private ranges: Array<[number, number]> = [];
  private spec: Array<{ off: number; on: number; accent: number; level: number }> = [];
  private levels: number[] = [];
  private vcount = 0;
  private attr: THREE.BufferAttribute | null = null;
  private dirty = false;
  mesh: THREE.Mesh | null = null;

  get size(): number {
    return this.ranges.length;
  }

  add(geometry: THREE.BufferGeometry, opts: LampOptions = {}): number {
    const g = normalise(geometry.clone());
    g.applyMatrix4(composeMatrix(opts));
    paintGeometry(g, 0);
    const n = g.getAttribute("position").count;
    this.ranges.push([this.vcount, n]);
    this.vcount += n;
    this.parts.push(g);
    this.spec.push({
      off: toneOf(opts.off ?? "light"),
      on: toneOf(opts.on ?? "paper"),
      accent: ACCENT[opts.accent ?? "none"],
      level: opts.level ?? 0,
    });
    this.levels.push(-1);
    return this.ranges.length - 1;
  }

  build(objectId: number = OBJECT_ID.lamp): THREE.Mesh | null {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error("machines lamps: merge failed");
    merged.computeBoundingSphere();
    this.attr = merged.getAttribute("inkAttr") as THREE.BufferAttribute;
    this.mesh = new THREE.Mesh(merged, lampMaterial(objectId));
    this.mesh.name = "lamps";
    this.mesh.castShadow = false;
    this.mesh.userData.castShadow = false;
    for (let i = 0; i < this.spec.length; i++) this.set(i, this.spec[i]!.level);
    this.commit();
    return this.mesh;
  }

  set(i: number, level: number): void {
    if (!this.attr) {
      // Before build: becomes the initial level.
      this.spec[i]!.level = level;
      return;
    }
    const l = clamp01(level);
    if (Math.abs(this.levels[i]! - l) < 0.004) return;
    this.levels[i] = l;
    const s = this.spec[i]!;
    const [start, n] = this.ranges[i]!;
    const tone = s.off + (s.on - s.off) * l;
    const amt = s.accent ? l : 0;
    const arr = this.attr.array as Float32Array;
    for (let v = start; v < start + n; v++) {
      arr[v * 3] = tone;
      arr[v * 3 + 1] = amt;
      arr[v * 3 + 2] = s.accent;
    }
    this.dirty = true;
  }

  commit(): void {
    if (this.dirty && this.attr) this.attr.needsUpdate = true;
    this.dirty = false;
  }
}

// ---------------------------------------------------------------- decals

const atlasCache = textureCache<THREE.Texture>(24);

/**
 * An inked canvas atlas, drawn once per key and shared by every instance.
 * Draw black for ink and #e00 for signal pigment on a transparent ground.
 * Returns null outside a browser (tests), in which case decals are skipped.
 */
export function inkAtlas(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const hit = atlasCache.get(key);
  if (hit) return hit;
  const { ctx, texture } = createInkCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  texture.needsUpdate = true;
  atlasCache.set(key, texture);
  return texture;
}

/** Draw text fitted into a box (canvas pixels). */
export function fitText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { weight?: number; family?: string; color?: string; align?: "center" | "left" | "right"; condense?: number } = {},
): void {
  const family = opts.family ?? `"Helvetica Neue", Helvetica, Arial, sans-serif`;
  const weight = opts.weight ?? 700;
  let size = h;
  g.font = `${weight} ${size}px ${family}`;
  const condense = opts.condense ?? 1;
  const mw = g.measureText(text).width * condense;
  if (mw > w) size = (size * w) / mw;
  g.save();
  g.font = `${weight} ${Math.floor(size)}px ${family}`;
  g.fillStyle = opts.color ?? "#000";
  g.textBaseline = "middle";
  const align = opts.align ?? "center";
  const tx = align === "center" ? x + w / 2 : align === "left" ? x : x + w;
  g.translate(tx, y + h / 2);
  g.scale(condense, 1);
  g.textAlign = align;
  g.fillText(text, 0, 0);
  g.restore();
}

/**
 * UV-mapped planes into one atlas. Planes face +Z before their transform.
 * A plane may be bound to a named bone: it is then authored in the rig's
 * rest (mesh) space and skinned with the body, so labels ride moving parts.
 */
export class Decals {
  private parts: THREE.BufferGeometry[] = [];
  private boneNames: Array<string | null> = [];
  constructor(
    private texW: number,
    private texH: number,
  ) {}

  /** rect = [x, y, w, h] in atlas pixels; size = [w, h] in metres. */
  add(rect: [number, number, number, number], size: V2, opts: PartOptions = {}, flipU = false, bone: string | null = null): this {
    const g = new THREE.PlaneGeometry(size[0], size[1]).toNonIndexed();
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i);
      if (flipU) u = 1 - u;
      const v = uv.getY(i);
      uv.setXY(i, (rect[0] + u * rect[2]) / this.texW, 1 - (rect[1] + (1 - v) * rect[3]) / this.texH);
    }
    g.applyMatrix4(composeMatrix(opts));
    this.parts.push(g);
    this.boneNames.push(bone);
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  get skinned(): boolean {
    return this.boneNames.some((b) => b !== null);
  }

  build(texture: THREE.Texture | null, hatch: number, objectId: number): THREE.Mesh | null {
    if (!texture || !this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, decalMaterial(texture, hatch, objectId));
    mesh.name = "decals";
    mesh.castShadow = false;
    mesh.userData.castShadow = false;
    return mesh;
  }

  /** A skinned decal mesh sharing `body`'s skeleton (planes in rest space). */
  buildSkinned(texture: THREE.Texture | null, hatch: number, objectId: number, body: THREE.SkinnedMesh): THREE.SkinnedMesh | null {
    if (!texture || !this.parts.length) return null;
    const bones = body.skeleton.bones;
    const parts = this.parts.map((g, i) => {
      const c = g.clone();
      const name = this.boneNames[i] ?? "root";
      const bi = Math.max(0, bones.findIndex((b) => b.name === name));
      const n = c.getAttribute("position").count;
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) {
        si[v * 4] = bi;
        sw[v * 4] = 1;
      }
      c.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      c.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      return c;
    });
    const merged = mergeGeometries(parts, false);
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(merged, decalMaterial(texture, hatch, objectId));
    mesh.name = "decals";
    mesh.castShadow = false;
    mesh.userData.castShadow = false;
    mesh.bind(body.skeleton, body.bindMatrix);
    if (body.boundingSphere) mesh.boundingSphere = body.boundingSphere.clone();
    return mesh;
  }
}

// ---------------------------------------------------------------- shapes

/**
 * Extrude a 2D outline by depth along z (centred) with a chamfer that stays
 * inside the outline: the side walls land exactly on the authored contour
 * and the total depth is exactly `depth`.
 */
export function extrudeExact(outline: V2[], depth: number, bevel = 0, holes: V2[][] = []): THREE.BufferGeometry {
  // An inward chamfer and holes do not mix in ExtrudeGeometry.
  if (holes.length) bevel = 0;
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const inner = Math.max(0.002, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: inner,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -inner / 2);
  return g;
}

/** Side-profile extrusion: outline in (z, y), extruded across x (centred). */
export function sideExtrude(outline: V2[], width: number, bevel = 0, holes: V2[][] = []): THREE.BufferGeometry {
  const g = extrudeExact(outline, width, bevel, holes);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Cross-section extrusion: outline in (x, y), extruded along z (centred). */
export function crossExtrude(outline: V2[], length: number, bevel = 0, holes: V2[][] = []): THREE.BufferGeometry {
  return extrudeExact(outline, length, bevel, holes);
}

export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Rounded rectangle outline centred at (cx, cy). */
export function roundRect(cx: number, cy: number, w: number, h: number, r: number, n = 3): V2[] {
  const hw = w / 2,
    hh = h / 2;
  const rr = Math.min(r, hw * 0.999, hh * 0.999);
  if (rr <= 0.0005)
    return [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ];
  return [
    ...arc(cx + hw - rr, cy - hh + rr, rr, -Math.PI / 2, 0, n),
    ...arc(cx + hw - rr, cy + hh - rr, rr, 0, Math.PI / 2, n),
    ...arc(cx - hw + rr, cy + hh - rr, rr, Math.PI / 2, Math.PI, n),
    ...arc(cx - hw + rr, cy - hh + rr, rr, Math.PI, Math.PI * 1.5, n),
  ];
}

/**
 * The bottom edge of a side profile, from rear (low z) to front (high z),
 * interrupted by wheel arches around each axle.
 */
export function archedSill(zRear: number, zFront: number, sillY: number, axles: Array<{ z: number; r: number; y: number }>, n = 9): V2[] {
  const out: V2[] = [[zRear, sillY]];
  const sorted = [...axles].sort((a, b) => a.z - b.z);
  for (const ax of sorted) {
    const s = Math.asin(Math.max(-1, Math.min(1, (sillY - ax.y) / ax.r)));
    out.push(...arc(ax.z, ax.y, ax.r, Math.PI - s, s, n));
  }
  out.push([zFront, sillY]);
  return out;
}

/** Sutherland–Hodgman clip of a polygon to lo <= p[axis] <= hi. */
export function clipPoly(poly: V2[], axis: 0 | 1, lo: number, hi: number): V2[] {
  const clipOne = (pts: V2[], keep: (p: V2) => boolean, value: number): V2[] => {
    const out: V2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const ka = keep(a),
        kb = keep(b);
      if (ka) out.push(a);
      if (ka !== kb) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  };
  let p = clipOne(poly, (q) => q[axis] >= lo, lo);
  p = clipOne(p, (q) => q[axis] <= hi, hi);
  return p;
}

function signedArea(poly: V2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!,
      q = poly[(i + 1) % poly.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Drop near-duplicate and near-collinear vertices. */
export function simplifyPoly(poly: V2[], minEdge = 0.004, minTurn = 0.03): V2[] {
  let pts: V2[] = [];
  for (const p of poly) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > minEdge) pts.push(p);
  }
  if (pts.length > 2 && Math.hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![1] - pts[pts.length - 1]![1]) < minEdge) pts.pop();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!,
        b = pts[i]!,
        c = pts[(i + 1) % pts.length]!;
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        vx = c[0] - b[0],
        vy = c[1] - b[1];
      const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
      if (turn < minTurn) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** Inset a convex polygon by d (drops degenerate and collinear vertices first). */
export function insetPoly(poly: V2[], d: number): V2[] {
  const pts = simplifyPoly(poly, Math.max(0.004, d * 0.6));
  const ccw = signedArea(pts) > 0;
  const n = pts.length;
  const lines: Array<{ p: V2; d: V2 }> = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i]!,
      b = pts[(i + 1) % n]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // Inward normal.
    const nx = ccw ? -dy / len : dy / len;
    const ny = ccw ? dx / len : -dx / len;
    lines.push({ p: [a[0] + nx * d, a[1] + ny * d], d: [dx, dy] });
  }
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i + n - 1) % n]!,
      l2 = lines[i]!;
    const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
    if (Math.abs(den) < 1e-9) {
      out.push(l2.p);
      continue;
    }
    const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
    out.push([l1.p[0] + l1.d[0] * t, l1.p[1] + l1.d[1] * t]);
  }
  return out;
}

/**
 * A faceted solid through cross-sections (x, y) at increasing z. Every
 * section has the same point count, counter-clockwise seen from +z.
 * Both ends are capped with a fan (sections must be star-shaped).
 */
export function loft(sections: Array<{ z: number; pts: V2[] }>, caps = true): THREE.BufferGeometry {
  const pos: number[] = [];
  const tri = (a: V3, b: V3, c: V3) => pos.push(...a, ...b, ...c);
  const n = sections[0]!.pts.length;
  for (let s = 0; s < sections.length - 1; s++) {
    const A = sections[s]!,
      B = sections[s + 1]!;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0: V3 = [A.pts[i]![0], A.pts[i]![1], A.z];
      const a1: V3 = [A.pts[j]![0], A.pts[j]![1], A.z];
      const b0: V3 = [B.pts[i]![0], B.pts[i]![1], B.z];
      const b1: V3 = [B.pts[j]![0], B.pts[j]![1], B.z];
      tri(a0, a1, b1);
      tri(a0, b1, b0);
    }
  }
  if (caps) {
    const first = sections[0]!,
      last = sections[sections.length - 1]!;
    const cf: V3 = centroid(first.pts, first.z);
    const cl: V3 = centroid(last.pts, last.z);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(cf, [first.pts[j]![0], first.pts[j]![1], first.z], [first.pts[i]![0], first.pts[i]![1], first.z]);
      tri(cl, [last.pts[i]![0], last.pts[i]![1], last.z], [last.pts[j]![0], last.pts[j]![1], last.z]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function centroid(pts: V2[], z: number): V3 {
  let x = 0,
    y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length, z];
}

/** Lathe from (radius, axial) pairs, with its axis turned to +X. */
export function latheX(profile: V2[], segments: number): THREE.BufferGeometry {
  const g = lathe(profile, segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** A cylinder whose axis runs along X. */
export function cylX(r: number, len: number, seg = 12, rBottom = r): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, rBottom, len, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** A cylinder whose axis runs along Z. */
export function cylZ(r: number, len: number, seg = 12, rBack = r): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, rBack, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Straight bar between two points. */
export function bar(a: V3, b: V3, r: number, seg = 6): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a),
    vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyQuaternion(q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/** Square-section bar between two points (struts, rails, lattice members). */
export function beam(a: V3, b: V3, w: number, h = w): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a),
    vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.BoxGeometry(w, len, h);
  const dir = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/** Tube through points with a fixed radius (cables, hoses, pipes). */
export function pipe(points: V3[], r: number, segments = 16, radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal",
  );
  return new THREE.TubeGeometry(curve, segments, r, radial, false);
}

/** Ring of small bolt heads (boxes) facing +X around the X axis. */
export function boltRingX(k: Kit, n: number, ringR: number, boltR: number, x: number, len: number, tone: Tone, at: V3 = [0, 0, 0], phase = 0): void {
  const g = new THREE.BoxGeometry(len, boltR * 1.8, boltR * 1.8);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    k.add(g, { tone, position: [at[0] + x, at[1] + Math.sin(a) * ringR, at[2] + Math.cos(a) * ringR], rotation: [-a, 0, 0] });
  }
}

/** Horizontal louvre slats across a w x h opening facing +Z (origin at centre). */
export function louvre(w: number, h: number, slats: number, depth = 0.04, frameTone: Tone = "deep", slatTone: Tone = "paper"): THREE.BufferGeometry {
  const k = new Kit();
  k.add(new THREE.BoxGeometry(w, h, depth), { tone: frameTone, position: [0, 0, -depth / 2] });
  const pitch = h / slats;
  for (let i = 0; i < slats; i++) {
    const y = -h / 2 + pitch * (i + 0.5);
    k.add(new THREE.BoxGeometry(w * 0.96, pitch * 0.42, depth * 0.9), { tone: slatTone, position: [0, y, 0.004], rotation: [-0.5, 0, 0] });
  }
  return k.build();
}

/** Mirror a part across x = 0 (adds both halves). */
export function sym(k: Kit, g: THREE.BufferGeometry, opts: PartOptions & { position: V3 }): void {
  const r = opts.rotation as V3 | undefined;
  k.add(g, opts);
  const p = opts.position;
  k.add(g, {
    ...opts,
    position: [-p[0], p[1], p[2]],
    rotation: r ? [r[0], -r[1], -r[2]] : undefined,
  });
}

/** Mirror a geometry across x = 0 with correct winding. */
export function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = g.index ? g.toNonIndexed() : g.clone();
  m.scale(-1, 1, 1);
  const pos = m.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const x = pos.getX(i + 1),
      y = pos.getY(i + 1),
      z = pos.getZ(i + 1);
    pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    pos.setXYZ(i + 2, x, y, z);
  }
  if (m.getAttribute("inkAttr")) {
    const ink = m.getAttribute("inkAttr") as THREE.BufferAttribute;
    for (let i = 0; i < ink.count; i += 3) {
      const a = [ink.getX(i + 1), ink.getY(i + 1), ink.getZ(i + 1)];
      ink.setXYZ(i + 1, ink.getX(i + 2), ink.getY(i + 2), ink.getZ(i + 2));
      ink.setXYZ(i + 2, a[0]!, a[1]!, a[2]!);
    }
  }
  m.deleteAttribute("normal");
  m.computeVertexNormals();
  return m;
}

/** Coil spring suggested by a zig-zag lathe (cheap, reads at distance). */
export function coilSpring(r: number, h: number, turns: number, wire: number, seg = 8): THREE.BufferGeometry {
  const prof: V2[] = [];
  const steps = turns * 2;
  for (let i = 0; i <= steps; i++) prof.push([i % 2 ? r - wire : r + wire * 0.5, (h * i) / steps]);
  return lathe(prof, seg);
}

/** A handwheel (valve wheel) in the XY plane, facing +Z. */
export function handwheel(r: number, rim: number, spokes: number): THREE.BufferGeometry {
  const k = new Kit();
  k.add(new THREE.TorusGeometry(r, rim, 5, 18));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    k.add(bar([0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], rim * 0.7, 5));
  }
  k.add(new THREE.CylinderGeometry(rim * 2.2, rim * 2.2, rim * 3, 8), { rotation: [Math.PI / 2, 0, 0] });
  return k.build();
}

/** Ink-and-paper hazard bands on a w x h plate facing +Z (origin at centre). */
export function hazardPlate(w: number, h: number, bands: number, accent: AccentName | null, depth = 0.01, angle = 0.785): THREE.BufferGeometry {
  const k = new Kit();
  k.add(new THREE.BoxGeometry(w, h, depth), { tone: "paper", ...(accent ? { accent } : {}) });
  // Diagonal bands clipped to the plate by building each as a sheared quad.
  const pitch = (w + h) / bands;
  const tan = Math.tan(angle);
  for (let i = 0; i < bands + 2; i++) {
    const x0 = -w / 2 - h / tan + pitch * i;
    const quad: V2[] = [
      [x0, -h / 2],
      [x0 + pitch / 2, -h / 2],
      [x0 + pitch / 2 + h / tan, h / 2],
      [x0 + h / tan, h / 2],
    ];
    let q = clipPoly(quad, 0, -w / 2, w / 2);
    if (q.length < 3) continue;
    q = clipPoly(q, 1, -h / 2, h / 2);
    if (q.length < 3) continue;
    k.add(extrude(q, depth * 0.2), { tone: "solid", position: [0, 0, depth / 2 + depth * 0.1] });
  }
  return k.build();
}

// ---------------------------------------------------------------- wheels

export type WheelStyle = "alloy" | "steel" | "truck" | "offroad" | "tractor" | "military";

export interface WheelSpec {
  r: number;
  w: number;
  /** Rim (wheel) radius; the tyre wall is r - rim. */
  rim: number;
  style: WheelStyle;
  seg?: number;
  /** Deflated / burnt: tyre removed, rim only. */
  bare?: boolean;
}

/**
 * A road wheel: tyre, rim and hub. Axis along X, outer face toward +X,
 * centred on the origin.
 */
export function wheelGeometry(spec: WheelSpec): THREE.BufferGeometry {
  const { r, w, rim, style } = spec;
  const seg = spec.seg ?? 16;
  const k = new Kit();
  const hw = w / 2;
  const wall = r - rim;
  const rugged = style === "offroad" || style === "military" || style === "tractor";
  if (!spec.bare) {
    const tread: V2[] = rugged
      ? [
          [rim, -hw * 0.86],
          [rim + wall * 0.5, -hw * 1.02],
          [r - wall * 0.08, -hw * 0.94],
          [r, -hw * 0.7],
          [r, hw * 0.7],
          [r - wall * 0.08, hw * 0.94],
          [rim + wall * 0.5, hw * 1.02],
          [rim, hw * 0.86],
        ]
      : [
          [rim, -hw * 0.88],
          [rim + wall * 0.55, -hw * 1.0],
          [r - wall * 0.12, -hw * 0.94],
          [r, -hw * 0.66],
          [r, hw * 0.66],
          [r - wall * 0.12, hw * 0.94],
          [rim + wall * 0.55, hw * 1.0],
          [rim, hw * 0.88],
        ];
    k.add(latheX(tread, seg), { tone: "deep" });
    // Lugs on off-road and military tyres: alternating blocks.
    if (style === "offroad" || style === "military") {
      const lugs = seg;
      const lug = new THREE.BoxGeometry(hw * 0.85, wall * 0.18, (Math.PI * 2 * r) / lugs / 2.1);
      for (let i = 0; i < lugs; i++) {
        const a = (i / lugs) * Math.PI * 2;
        const side = i % 2 ? 1 : -1;
        k.add(lug, {
          tone: "deep",
          position: [side * hw * 0.4, Math.sin(a) * (r + wall * 0.03), Math.cos(a) * (r + wall * 0.03)],
          rotation: [-a, 0, 0],
        });
      }
    }
    if (style === "tractor") {
      // Chevron lugs: bars angled across the tread, climbing onto the shoulder.
      const lugs = seg;
      for (let i = 0; i < lugs; i++) {
        const a = (i / lugs) * Math.PI * 2;
        for (const side of [-1, 1]) {
          const lug = new THREE.BoxGeometry(hw * 1.05, wall * 0.22, w * 0.11);
          lug.rotateY(side * 0.6);
          lug.translate(side * hw * 0.48, 0, 0);
          k.add(lug, { tone: "deep", position: [0, Math.sin(a + side * 0.08) * (r + wall * 0.04), Math.cos(a + side * 0.08) * (r + wall * 0.04)], rotation: [-a - side * 0.08, 0, 0] });
        }
      }
    }
  }
  // Rim and hub.
  const face = hw * 0.6;
  const dish = (profile: V2[], tone: Tone) => k.add(latheX(profile, seg), { tone });
  switch (style) {
    case "alloy": {
      dish(
        [
          [rim * 1.02, -hw * 0.7],
          [rim * 1.02, face + 0.01],
          [rim * 0.86, face - 0.03],
          [rim * 0.001, face - 0.03],
        ],
        "pale",
      );
      k.add(cylX(rim * 0.84, 0.01, seg), { tone: "solid", position: [face - 0.028, 0, 0] });
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.BoxGeometry(0.03, rim * 0.7, rim * 0.2);
        sp.translate(0, rim * 0.48, 0);
        k.add(sp, { tone: "paper", position: [face - 0.012, 0, 0], rotation: [(i / 5) * Math.PI * 2, 0, 0] });
      }
      k.add(cylX(rim * 0.24, 0.05, 8), { tone: "paper", position: [face - 0.005, 0, 0] });
      break;
    }
    case "steel":
    case "truck": {
      dish(
        [
          [rim * 1.03, -hw * 0.7],
          [rim * 1.03, face],
          [rim * 0.9, face - 0.012],
          [rim * 0.5, face - 0.06],
          [rim * 0.001, face - 0.03],
        ],
        "light",
      );
      const holes = 6;
      for (let i = 0; i < holes; i++) {
        const a = (i / holes) * Math.PI * 2 + 0.2;
        k.add(new THREE.BoxGeometry(0.02, rim * 0.16, rim * 0.16), { tone: "solid", position: [face - 0.03, Math.sin(a) * rim * 0.68, Math.cos(a) * rim * 0.68], rotation: [-a, 0, 0] });
      }
      if (style === "truck") {
        k.add(cylX(rim * 0.2, rim * 0.28, 8, rim * 0.28), { tone: "mid", position: [face + rim * 0.06, 0, 0] });
        boltRingX(k, 6, rim * 0.34, rim * 0.04, face - 0.02, 0.04, "dark");
      } else {
        k.add(cylX(rim * 0.3, 0.04, 8), { tone: "pale", position: [face - 0.02, 0, 0] });
      }
      break;
    }
    case "offroad":
    case "military": {
      dish(
        [
          [rim * 1.02, -hw * 0.7],
          [rim * 1.02, face],
          [rim * 0.86, face - 0.01],
          [rim * 0.78, face - 0.05],
          [rim * 0.001, face - 0.05],
        ],
        style === "military" ? "dark" : "light",
      );
      if (style === "offroad") boltRingX(k, 8, rim * 0.93, rim * 0.035, face + 0.005, 0.03, "deep");
      k.add(cylX(rim * 0.32, 0.12, 8, rim * 0.36), { tone: style === "military" ? "mid" : "pale", position: [face + 0.0, 0, 0] });
      break;
    }
    case "tractor": {
      dish(
        [
          [rim * 1.03, -hw * 0.7],
          [rim * 1.03, face],
          [rim * 0.94, face - 0.02],
          [rim * 0.9, face - 0.12],
          [rim * 0.001, face - 0.12],
        ],
        "pale",
      );
      boltRingX(k, 8, rim * 0.93, rim * 0.028, face - 0.015, 0.03, "dark");
      k.add(cylX(rim * 0.36, 0.1, 10), { tone: "light", position: [face - 0.08, 0, 0] });
      k.add(cylX(rim * 0.18, 0.12, 8), { tone: "mid", position: [face - 0.02, 0, 0] });
      boltRingX(k, 5, rim * 0.28, rim * 0.035, face - 0.03, 0.04, "deep");
      break;
    }
  }
  return k.build();
}

/** Rotate a +X-facing geometry so it faces -X (left-hand side). */
export function flipToLeft(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const c = g.clone();
  c.rotateY(Math.PI);
  return c;
}

// ---------------------------------------------------------------- misc

/** A deterministic number from a seed for variants. */
export function seedNumber(seed: number | string): number {
  if (typeof seed === "number") return Math.abs(Math.floor(seed));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function triangles(root: THREE.Object3D): { triangles: number; drawCalls: number } {
  let tris = 0,
    calls = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const g = m.geometry;
    const n = g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    tris += n * inst;
    calls++;
  });
  root.traverse((o) => {
    const l = o as THREE.LineSegments;
    if (l.isLineSegments) calls++;
  });
  return { triangles: Math.round(tris), drawCalls: calls };
}
