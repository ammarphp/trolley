/**
 * Architectural vocabulary for civic structures.
 *
 * Walls are real slabs extruded with holes, so every opening has reveals
 * (the recess shades itself), with sills and lintels that project from the
 * face. Roofs are plates with thickness, overhanging eaves and verges,
 * fascias, gutters and bargeboards, so the eave line casts a shadow and the
 * verge reads as a thin edge. Every part is merged into one geometry with
 * per-part tone; only inked signs and animated parts are separate meshes.
 *
 * Coordinates: metres, Y up, the building faces +Z, origin at base centre.
 * A "face frame" puts local z = 0 on a wall's outer face with +z pointing
 * outside and +x to the right of a viewer standing outside.
 *
 * Condition-dependent randomness always comes from `fork(label)` streams so a
 * building keeps its design (variant, window rhythm) while ruin or order vary.
 */
import * as THREE from "three";
import { Kit, block, cylinder, extrude, type Tone, type PartOptions } from "../../core/geometry.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import type { AccentName } from "../../core/palette.ts";
import type { Rng } from "../../core/rng.ts";
import { type Condition, RUIN, clamp01, smooth } from "./condition.ts";
import { signMesh, weather, type SignDesign } from "./signs.ts";

export type P2 = [number, number];
export type V3 = [number, number, number];
export type M4 = THREE.Matrix4;

export type WindowStyle = "sash" | "casement" | "industrial" | "plain" | "lancet" | "fan" | "ribbon" | "shop" | "cabin" | "louvre" | "georgian" | "slit" | "blind";
export type DoorStyle = "panel" | "plank" | "double" | "glazed" | "shutter" | "open" | "sliding" | "flush";
export type Head = "flat" | "round" | "segment" | "pointed";
export type Dress = "none" | "plain" | "key" | "hood" | "pediment" | "arch";

export interface Opening {
  /** Centre along the wall (local x). */
  x: number;
  /** Sill or threshold height. */
  y: number;
  w: number;
  h: number;
  kind: "window" | "door";
  head?: Head;
  win?: WindowStyle;
  door?: DoorStyle;
  dress?: Dress;
  sill?: boolean;
  shutters?: boolean;
  /** Depth of the frame behind the face. */
  reveal?: number;
  doorTone?: Tone;
  /** Never boarded, broken or sealed (louvres, open cart arches). */
  fixed?: boolean;
  /** Industrial grid override: columns, rows. */
  grid?: [number, number];
  /** Ribbon mullion spacing. */
  pitch?: number;
  /** Cheap unit for long repetitive facades: no frame ring or dressing. */
  lite?: boolean;
  /** Cut the hole only (arches of bridges, open arcades). */
  bare?: boolean;
}

export interface Band {
  y: number;
  h: number;
  /** Projection from the face. */
  p: number;
  tone?: Tone;
}

export interface WallSpec {
  len: number;
  /** Eave (or parapet) height. */
  h: number;
  t?: number;
  /** Gable rise above h at the centre. */
  apex?: number;
  /** Custom top profile from x = +len/2 to x = -len/2 (replaces h/apex). */
  top?: P2[];
  tone?: Tone;
  ops?: Opening[];
  bands?: Band[];
  /** How far bands extend past the wall ends (to wrap corners). */
  ext?: number;
  label: string;
  /** Immune to ruin (e.g. the stack of a chimney breast). */
  intact?: boolean;
  /** Do not add interior void panels behind broken openings. */
  noLiner?: boolean;
  /** Masonry coursing drawn as joint lines (indication, not full coverage). */
  courses?: Courses;
}

export interface Courses {
  /** Course height. */
  every: number;
  /** Block length for vertical joints (0 = none). */
  block?: number;
  /** 0..1: how much of the texture is left out (indication). */
  indicate?: number;
  tone?: Tone;
  from?: number;
  to?: number;
  /** Stroke width in metres: size it for the distance the wall is seen at. */
  w?: number;
}

/** x-range of a polygon's intersection with the horizontal line y. */
function polyXRange(poly: P2[], y: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [xa, ya] = poly[i]!;
    const [xb, yb] = poly[(i + 1) % poly.length]!;
    if ((y >= ya && y <= yb) || (y >= yb && y <= ya)) {
      const t = ya === yb ? 0 : (y - ya) / (yb - ya);
      const x = xa + (xb - xa) * t;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

export interface RoofSpec {
  pitch: number;
  eave?: number;
  verge?: number;
  t?: number;
  tone?: Tone;
  fascia?: boolean;
  gutter?: boolean;
  barge?: boolean;
  ridge?: boolean;
  hip?: boolean;
  label: string;
  /** Never damaged. */
  intact?: boolean;
}

export interface RoofResult {
  /** Rise of the roof underside at the ridge above the wall head. */
  rise: number;
  /** Height of the ridge top above the wall head. */
  top: number;
  /** Horizontal eave overhang used. */
  eave: number;
}

type OpState = "intact" | "lit" | "broken" | "boarded" | "sealed";

/** A local frame: translate then rotate about Y, optionally inside a parent. */
export function frame(x: number, y: number, z: number, rotY = 0, parent?: M4): M4 {
  const m = new THREE.Matrix4().makeRotationY(rotY);
  m.setPosition(x, y, z);
  return parent ? parent.clone().multiply(m) : m;
}

/** Evenly spaced openings along a wall of length `len`. */
export function row(len: number, n: number, base: Omit<Opening, "x">, margin = 0): Opening[] {
  const usable = len - margin * 2;
  const step = usable / n;
  return Array.from({ length: n }, (_, i) => ({ ...base, x: -usable / 2 + step * (i + 0.5) }));
}

/** Openings at explicit x positions. */
export function at(xs: number[], base: Omit<Opening, "x">): Opening[] {
  return xs.map((x) => ({ ...base, x }));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Outline of an opening, inset by `inset`, CCW starting bottom-left. */
export function openingPoly(op: Opening, inset: number): P2[] {
  const head = op.head ?? "flat";
  const x0 = op.x - op.w / 2 + inset;
  const x1 = op.x + op.w / 2 - inset;
  const y0 = op.y + inset;
  const top = op.y + op.h - inset;
  const xc = op.x;
  const pts: P2[] = [
    [x0, y0],
    [x1, y0],
  ];
  if (head === "flat") {
    pts.push([x1, top], [x0, top]);
    return pts;
  }
  if (head === "round") {
    const r0 = op.w / 2;
    const cy = op.y + op.h - r0;
    const r = r0 - inset;
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * i) / n;
      pts.push([xc + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }
  if (head === "segment") {
    const s = op.w * 0.13;
    const hw = op.w / 2;
    const R = (hw * hw + s * s) / (2 * s);
    const cy = op.y + op.h - R;
    const Ri = R - inset;
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const x = lerp(x1, x0, i / n);
      const dx = x - xc;
      pts.push([x, cy + Math.sqrt(Math.max(0, Ri * Ri - dx * dx))]);
    }
    return pts;
  }
  // pointed (two-centred) arch
  const Rp = op.w * 0.9;
  const hw = op.w / 2;
  const rise = Math.sqrt(Rp * Rp - (Rp - hw) * (Rp - hw));
  const ys = op.y + op.h - rise;
  const Ri = Rp - inset;
  const cR = op.x + hw - Rp; // centre of the right-hand arc (on the left)
  const cL = op.x - hw + Rp;
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const x = lerp(x1, xc, i / n);
    const dx = x - cR;
    pts.push([x, ys + Math.sqrt(Math.max(0, Ri * Ri - dx * dx))]);
  }
  for (let i = 1; i <= n; i++) {
    const x = lerp(xc, x0, i / n);
    const dx = x - cL;
    pts.push([x, ys + Math.sqrt(Math.max(0, Ri * Ri - dx * dx))]);
  }
  return pts;
}

/** Height where the straight jambs of an opening end. */
function springing(op: Opening): number {
  const head = op.head ?? "flat";
  if (head === "round") return op.y + op.h - op.w / 2;
  if (head === "segment") return op.y + op.h - op.w * 0.13;
  if (head === "pointed") {
    const Rp = op.w * 0.9;
    const hw = op.w / 2;
    return op.y + op.h - Math.sqrt(Rp * Rp - (Rp - hw) * (Rp - hw));
  }
  return op.y + op.h;
}

function topAt(top: P2[], x: number): number {
  // top runs from +x to -x
  for (let i = 0; i < top.length - 1; i++) {
    const [xa, ya] = top[i]!;
    const [xb, yb] = top[i + 1]!;
    if ((x <= xa && x >= xb) || (x >= xa && x <= xb)) {
      const t = xa === xb ? 0 : (x - xa) / (xb - xa);
      return lerp(ya, yb, t);
    }
  }
  return x > top[0]![0] ? top[0]![1] : top[top.length - 1]![1];
}

function minTop(top: P2[], x0: number, x1: number): number {
  let m = Math.min(topAt(top, x0), topAt(top, x1));
  for (const [x, y] of top) if (x > x0 && x < x1) m = Math.min(m, y);
  return m;
}

/** Drop duplicate and collinear/back-tracking points (they poison extrusion bevels). */
export function sanitize(poly: P2[]): P2[] {
  const out: P2[] = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (q && Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[1] - q[1]) < 1e-3) continue;
    out.push([p[0], p[1]]);
  }
  while (out.length > 3) {
    const a = out[0]!;
    const b = out[out.length - 1]!;
    if (Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3) out.pop();
    else break;
  }
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length]!;
      const b = out[i]!;
      const c = out[(i + 1) % out.length]!;
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) < 1e-7) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}

function finite(g: THREE.BufferGeometry): boolean {
  const arr = g.getAttribute("position").array;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i] as number)) return false;
  return true;
}

/** Extrude with sanitised outlines; falls back to fewer holes, then null. */
export function safeExtrude(outline: P2[], depth: number, holes: P2[][] = []): THREE.BufferGeometry | null {
  const o = sanitize(outline);
  if (o.length < 3) return null;
  const hs = holes.map(sanitize).filter((h) => h.length >= 3);
  let g = extrude(o, depth, 0, hs);
  if (finite(g)) return g;
  g = extrude(o, depth, 0, []);
  return finite(g) ? g : null;
}

/** Turn a closed surface inside out (for the inner face of hollow ruins). */
export function inverted(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute | undefined;
  for (let i = 0; i < pos.count; i += 3) {
    for (const attr of [pos, nrm]) {
      if (!attr) continue;
      const x = attr.getX(i + 1), y = attr.getY(i + 1), z = attr.getZ(i + 1);
      attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
      attr.setXYZ(i + 2, x, y, z);
    }
  }
  if (nrm) for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  return g;
}

export function shape(poly: P2[]): THREE.BufferGeometry {
  if (poly.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  return new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))), 1);
}

/** Irregular star-shaped blob (always a simple polygon). */
function blob(cx: number, cy: number, rx: number, ry: number, n: number, rng: Rng, rough = 0.45): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2) / n;
    const k = 1 - rough + rough * rng.next();
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

export class Arch {
  readonly k = new Kit();
  readonly extras: THREE.Object3D[] = [];
  /** Animation callbacks for moving parts (sails, wheels). */
  readonly ticks: Array<(dt: number, t: number) => void> = [];
  private opCount = 0;
  /** Wall height remaining above the opening being dressed. */
  private clear = 1;
  /** Debris chunks left for this building (keeps big ruins in budget). */
  private rubbleLeft = 110;
  /** Default glass tone. */
  glass: Tone = "dark";
  /** Default tone for doors. */
  doorTone: Tone = "deep";
  /** Whether the building currently has a roof over its rooms. */
  roofed = true;

  private cond: Condition;

  constructor(
    readonly rng: Rng,
    c: Condition,
    readonly id: string,
  ) {
    this.cond = c;
    this.roofed = c.ruin < RUIN.gutted;
  }

  get c(): Condition {
    return this.cond;
  }

  /** Build part of the structure under a different condition (compounds). */
  withCondition(patch: Partial<Condition>, fn: () => void): void {
    const prev = this.cond;
    const prevRoofed = this.roofed;
    this.cond = { ...prev, ...patch };
    this.roofed = this.cond.ruin < RUIN.gutted;
    try {
      fn();
    } finally {
      this.cond = prev;
      this.roofed = prevRoofed;
    }
  }

  fork(label: string): Rng {
    return this.rng.fork(label);
  }

  get sealed(): boolean {
    return this.c.sealed;
  }

  get ruin(): number {
    return this.c.ruin;
  }

  // ------------------------------------------------------------- primitives

  /** Frame applied to everything added (for sub-buildings inside compounds). */
  private base: M4 | null = null;

  /** Build a sub-assembly inside frame m (e.g. a school inside a compound). */
  within(m: M4, fn: () => void): void {
    const prev = this.base;
    this.base = prev ? prev.clone().multiply(m) : m.clone();
    try {
      fn();
    } finally {
      this.base = prev;
    }
  }

  private place(f: M4 | null): M4 | null {
    if (!this.base) return f;
    return f ? this.base.clone().multiply(f) : this.base;
  }

  add(g: THREE.BufferGeometry, f: M4 | null, o: PartOptions = {}): void {
    const m = this.place(f);
    this.k.add(g, m ? { ...o, matrix: m } : o);
  }

  /** Box resting on its base centre (x, y, z) in frame f. */
  box(f: M4 | null, x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone = "paper", o: { rot?: V3; accent?: AccentName; amt?: number } = {}): void {
    this.add(block(w, h, d), f, { tone, position: [x, y, z], rotation: o.rot, accent: o.accent, accentAmount: o.amt });
  }

  /** Box centred on (x, y, z). */
  cbox(f: M4 | null, x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone = "paper", o: { rot?: V3; accent?: AccentName; amt?: number } = {}): void {
    this.add(new THREE.BoxGeometry(w, h, d), f, { tone, position: [x, y, z], rotation: o.rot, accent: o.accent, accentAmount: o.amt });
  }

  /** A flat quad facing +z in frame f. */
  quad(f: M4 | null, x: number, y: number, z: number, w: number, h: number, tone: Tone = "paper", o: { accent?: AccentName; amt?: number; rotZ?: number } = {}): void {
    this.add(new THREE.PlaneGeometry(w, h), f, { tone, position: [x, y, z], rotation: [0, 0, o.rotZ ?? 0], accent: o.accent, accentAmount: o.amt });
  }

  /** A square-section member from a to b. */
  beam(f: M4 | null, a: V3, b: V3, w: number, h: number, tone: Tone = "paper", o: { accent?: AccentName; amt?: number } = {}): void {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-4) return;
    const dir = vb.clone().sub(va).normalize();
    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4().lookAt(va, vb, up);
    m.setPosition(va.clone().add(vb).multiplyScalar(0.5));
    const full = f ? f.clone().multiply(m) : m;
    this.add(new THREE.BoxGeometry(w, h, len), full, { tone, accent: o.accent, accentAmount: o.amt });
  }

  /** A round member from a to b. */
  rod(f: M4 | null, a: V3, b: V3, r: number, tone: Tone = "paper", seg = 6): void {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    const full = f ? f.clone().multiply(m) : m;
    this.add(cylinder(r, r, len, seg, true), full, { tone });
  }

  // ------------------------------------------------------------------ walls

  /**
   * A wall slab in face frame f (outer face at z = 0, thickness toward -z),
   * with openings cut through it and dressed.
   */
  wall(f: M4, s: WallSpec): void {
    const t = s.t ?? 0.4;
    const len = s.len;
    const ops = s.ops ?? [];
    let top: P2[] = s.top
      ? s.top
      : s.apex
        ? [
            [len / 2, s.h],
            [0, s.h + s.apex],
            [-len / 2, s.h],
          ]
        : [
            [len / 2, s.h],
            [-len / 2, s.h],
          ];
    const doors = ops.filter((o) => o.kind === "door" && o.y <= 0.02).sort((a, b) => a.x - b.x);
    if (this.c.ruin >= RUIN.gutted && !s.intact) top = this.ruinTop(top, s, doors);

    const outline: P2[] = [[-len / 2, 0]];
    for (const d of doors) {
      const poly = openingPoly(d, 0);
      outline.push(poly[0]!, ...poly.slice(2).reverse(), poly[1]!);
    }
    outline.push([len / 2, 0], ...top);
    // Drop duplicated closing point if the top already ends at the start.
    const holes: P2[][] = [];
    const live: Array<{ op: Opening; idx: number; clear: number }> = [];
    for (const op of ops) {
      const idx = this.opCount++;
      const x0 = op.x - op.w / 2;
      const x1 = op.x + op.w / 2;
      const isNotch = op.kind === "door" && op.y <= 0.02;
      const rawClear = minTop(top, x0 - 0.12, x1 + 0.12) - (op.y + op.h);
      const clear = Number.isFinite(rawClear) ? rawClear : 0;
      if (isNotch) {
        live.push({ op, idx, clear });
        continue;
      }
      if (clear < 0.18 || x0 < -len / 2 + 0.05 || x1 > len / 2 - 0.05) {
        // Lost to the collapse: the wall simply ends lower here.
        continue;
      }
      holes.push(openingPoly(op, 0));
      live.push({ op, idx, clear });
    }
    const wallGeo = safeExtrude(outline, t, holes);
    if (wallGeo) this.add(wallGeo, f, { tone: s.tone ?? "paper", position: [0, 0, -t / 2] });

    // Bands: plinths, string courses, cornices.
    for (const b of s.bands ?? []) this.band(f, s, b, top, ops);
    if (s.courses && !this.sealed) this.coursing(f, s, top, ops);

    for (const { op, idx, clear } of live) {
      if (op.bare) continue;
      const st = this.stateOf(op, idx);
      this.clear = clear;
      if (op.kind === "door") this.doorUnit(f, op, t, st, idx, s);
      else this.windowUnit(f, op, t, st, idx, s);
    }
  }

  private band(f: M4, s: WallSpec, b: Band, top: P2[], ops: Opening[]): void {
    // Full-length walls wrap the corner by the band's projection; walls that
    // stop between returns extend through the return's thickness instead.
    const ext = s.ext ?? b.p;
    const start = -s.len / 2 - ext;
    const end = s.len / 2 + ext;
    // Split around openings that cross the band.
    const cuts = ops
      .filter((o) => o.y < b.y + b.h && o.y + o.h > b.y)
      .map((o) => [o.x - o.w / 2 - 0.04, o.x + o.w / 2 + 0.04] as [number, number])
      .sort((a, c) => a[0] - c[0]);
    const spans: Array<[number, number]> = [];
    let x = start;
    for (const [c0, c1] of cuts) {
      if (c0 > x) spans.push([x, c0]);
      x = Math.max(x, c1);
    }
    if (x < end) spans.push([x, end]);
    for (const [a, c] of spans) {
      // Skip where the wall has collapsed below the band.
      const n = Math.max(1, Math.ceil((c - a) / 1.2));
      if (this.c.ruin >= RUIN.gutted && !s.intact) {
        // Keep the band only where the wall still stands, in merged runs.
        let runStart: number | null = null;
        for (let i = 0; i <= n; i++) {
          const sa = lerp(a, c, i / n);
          const sc = lerp(a, c, (i + 1) / n);
          const ok = i < n && minTop(top, Math.max(-s.len / 2, sa), Math.min(s.len / 2, sc)) > b.y + b.h + 0.05;
          if (ok && runStart === null) runStart = sa;
          if (!ok && runStart !== null) {
            this.box(f, (runStart + sa) / 2, b.y, b.p / 2 - 0.01, sa - runStart, b.h, b.p + 0.02, b.tone ?? "paper");
            runStart = null;
          }
        }
      } else if (c - a > 0.05) {
        this.box(f, (a + c) / 2, b.y, b.p / 2 - 0.01, c - a, b.h, b.p + 0.02, b.tone ?? "paper");
      }
    }
  }

  private coursing(f: M4, s: WallSpec, top: P2[], ops: Opening[]): void {
    const c = s.courses!;
    const g = this.fork(`courses:${s.label}`);
    // Joint lines are pen strokes: solid ink, thin, and left out in places.
    const tone = c.tone ?? "solid";
    const ind = c.indicate ?? 0.35;
    const lw = c.w ?? 0.04;
    const maxTop = Math.max(...top.map((p) => p[1]));
    const polys = ops.map((o) => openingPoly(o, -0.06));
    const y1 = Math.min(c.to ?? maxTop, maxTop);
    let row = 0;
    for (let y = (c.from ?? 0) + c.every; y < y1 - 0.05; y += c.every, row++) {
      // Where the wall stands at this height.
      const spans: Array<[number, number]> = [];
      let start: number | null = null;
      const step = 0.25;
      for (let x = -s.len / 2; x <= s.len / 2 + 1e-6; x += step) {
        const ok = topAt(top, x) > y + 0.06;
        if (ok && start === null) start = x;
        if ((!ok || x + step > s.len / 2 + 1e-6) && start !== null) {
          spans.push([start, ok ? s.len / 2 : x - step]);
          start = null;
        }
      }
      // Minus the openings.
      const blocked = polys.map((p) => polyXRange(p, y)).filter((r): r is [number, number] => !!r);
      const segs: Array<[number, number]> = [];
      for (const [a0, a1] of spans) {
        let cuts = blocked.filter(([b0, b1]) => b1 > a0 && b0 < a1).sort((p, q) => p[0] - q[0]);
        let x = a0;
        for (const [b0, b1] of cuts) {
          if (b0 > x) segs.push([x, b0]);
          x = Math.max(x, b1);
        }
        if (x < a1) segs.push([x, a1]);
        cuts = [];
      }
      for (const [p, q] of segs) {
        // Break long runs and leave some out: suggested, not ruled.
        let x = p;
        while (x < q - 0.2) {
          const run = Math.min(q - x, g.range(1.5, 4.5));
          if (g.next() > ind) this.quad(f, x + run / 2, y, 0.004, run, lw, tone);
          if (c.block && g.next() > ind * 1.4) {
            const off = row % 2 === 0 ? 0 : c.block / 2;
            for (let bx = Math.ceil((x - off) / c.block) * c.block + off; bx < x + run - 0.1; bx += c.block) {
              if (g.next() > 0.45) this.quad(f, bx, y - c.every / 2, 0.004, lw * 0.85, c.every - 0.02, tone);
            }
          }
          x += run + (g.next() < ind ? g.range(0.4, 2.0) : 0);
        }
      }
    }
  }

  private ruinTop(top: P2[], s: WallSpec, doors: Opening[]): P2[] {
    const r = this.c.ruin;
    const g = this.fork(`wall:${s.label}`);
    const len = s.len;
    const eave = s.h;
    const gableLoss = smooth(0.45, 0.72, r);
    const dropMax = eave * 0.78 * smooth(0.6, 1.0, r);
    const nCtrl = Math.max(3, Math.ceil(len / 2.2) + 2);
    const ctrl = Array.from({ length: nCtrl }, () => g.next());
    const breach = r > 0.78 && g.next() < 0.75;
    const bc = g.range(-len * 0.3, len * 0.3);
    const bw = g.range(1.2, Math.max(1.6, len * 0.25));
    const n = Math.max(4, Math.min(36, Math.ceil(len / 0.5)));
    const res: P2[] = [];
    for (let i = 0; i <= n; i++) {
      const x = len / 2 - (len * i) / n;
      const y0 = topAt(top, x);
      const above = Math.max(0, y0 - eave);
      const u = ((x + len / 2) / len) * (nCtrl - 1);
      const i0 = Math.min(nCtrl - 2, Math.floor(u));
      const fr = u - i0;
      const nz = lerp(ctrl[i0]!, ctrl[i0 + 1]!, (1 - Math.cos(fr * Math.PI)) / 2);
      const endGuard = 0.45 + 0.55 * smooth(0, 1.6, Math.min(x + len / 2, len / 2 - x));
      let y = y0 - above * clamp01(gableLoss * (0.55 + 0.6 * nz));
      y -= dropMax * Math.pow(nz, 1.4) * endGuard;
      if (breach) y -= Math.max(0, 1 - Math.abs(x - bc) / bw) * eave * 0.9;
      if (i > 0 && i < n) y += (g.next() - 0.5) * 0.3 * smooth(0.5, 0.8, r);
      let floor = 0.35;
      for (const d of doors) {
        if (x > d.x - d.w / 2 - 0.35 && x < d.x + d.w / 2 + 0.35) floor = Math.max(floor, d.y + d.h + 0.35);
      }
      res.push([x, Math.min(y0, Math.max(floor, y))]);
    }
    // Masonry breaks along its courses: quantise into steps with short
    // raking runs between them.
    const course = 0.26;
    const stepped: P2[] = [];
    for (let i = 0; i < res.length; i++) {
      const [x, y] = res[i]!;
      const orig = topAt(top, x);
      const q = y >= orig - 0.02 ? y : Math.max(0.3, Math.floor(y / course) * course);
      stepped.push([x, q]);
      const next = res[i + 1];
      if (next && g.next() < 0.7) {
        const dx = next[0] - x;
        stepped.push([x + dx * g.range(0.45, 0.75), q]);
      }
    }
    return stepped;
  }

  private stateOf(op: Opening, idx: number): OpState {
    const g = this.fork(`op${idx}`);
    const u1 = g.next();
    const u2 = g.next();
    const u3 = g.next();
    const c = this.c;
    if (op.fixed || op.win === "louvre" || op.win === "slit" || op.win === "blind" || op.door === "open") return "intact";
    if (c.sealed) return "sealed";
    if (c.ruin > RUIN.scuffed + 0.5 * u1) return "broken";
    if (c.abandoned > 0) {
      const frac = op.y < 1.6 ? 0.95 : op.y < 4.5 ? 0.45 : 0.2;
      if (u2 < frac * c.abandoned) return "boarded";
      if (u2 < c.abandoned * 1.05) return "broken";
    }
    if (op.kind === "window" && c.lit > u3) return "lit";
    return "intact";
  }

  // --------------------------------------------------------------- windows

  private liner(f: M4, op: Opening, t: number, idx: number, noLiner?: boolean, clear = 1): void {
    // A dark interior behind a broken opening. Once the roof is gone the
    // rooms are open to the sky, so only low, well-covered openings keep it.
    if (noLiner || this.c.ruin >= RUIN.shell) return;
    if (!this.roofed && clear < 0.5) return;
    const g = this.fork(`liner${idx}`);
    const fire = this.c.fire > 0.25 && g.next() < this.c.fire * 0.8;
    const grow = this.roofed ? 0.5 : 0.12;
    this.quad(f, op.x, op.y + op.h / 2, -t - (this.roofed ? 0.45 : 0.3), op.w + grow, op.h + grow, fire ? "light" : this.roofed ? "solid" : "deep", fire ? { accent: "ember", amt: 0.95 } : {});
  }

  private scorch(f: M4, op: Opening, idx: number): void {
    // Soot plume licking up from an opening: widest a little above the
    // head, drawn as a hatched stain rather than a solid shape.
    const c = this.c;
    const heat = Math.max(c.fire, smooth(0.35, 0.8, c.ruin) * 0.7);
    if (heat < 0.15) return;
    const g = this.fork(`scorch${idx}`);
    if (g.next() > heat * 0.8) return;
    const y1 = op.y + op.h;
    const w = op.w + 0.1;
    const room = Number.isFinite(this.clear) ? this.clear : 0;
    const tall = Math.min(room - 0.05, (0.9 + g.next() * 1.4) * (0.6 + heat));
    if (!(tall >= 0.35)) return;
    const n = 5;
    const right: P2[] = [];
    const left: P2[] = [];
    for (let i = 0; i <= n; i++) {
      const tt = i / n;
      const bulge = Math.sin(Math.min(1, tt * 1.35) * Math.PI * 0.85);
      const half = (w / 2) * (0.95 + 0.55 * bulge) * (1 - tt * 0.55) + g.range(-0.06, 0.06);
      const y = y1 - 0.02 + tall * tt;
      const lean = 0.25 * tt * tt * (g.next() - 0.3);
      right.push([op.x + lean + half, y]);
      left.push([op.x + lean - half * (0.9 + g.range(-0.1, 0.1)), y]);
    }
    const poly: P2[] = [left[0]!, right[0]!, ...right.slice(1), ...left.slice(1).reverse()];
    this.add(shape(poly), f, { tone: heat > 0.5 ? "deep" : "dark", position: [0, 0, 0.034] });
  }

  private dress(f: M4, op: Opening, isDoor: boolean): void {
    if (this.sealed) return;
    const dress = op.dress ?? (isDoor ? "none" : "plain");
    const head = op.head ?? "flat";
    const y1 = op.y + op.h;
    if (dress === "none") return;
    if (head === "round" || head === "segment" || head === "pointed" || dress === "arch") {
      // Voussoir ring standing proud of the face.
      const outer = openingPoly({ ...op, x: op.x, y: op.y, w: op.w + 0.34, h: op.h + 0.17 }, 0);
      const inner = openingPoly(op, 0);
      const sp = springing(op);
      const ring = [...outer.filter(([, y]) => y >= sp - 1e-3)];
      const innerArc = [...inner.filter(([, y]) => y >= sp - 1e-3)].reverse();
      if (ring.length > 2 && innerArc.length > 2) {
        const poly: P2[] = [...ring, ...innerArc];
        this.add(extrude(poly, 0.05), f, { tone: "pale", position: [0, 0, 0.025] });
      }
      if (dress === "key" || head === "round") this.box(f, op.x, y1 - 0.08, 0.025, 0.24, 0.34, 0.05, "pale");
      return;
    }
    if (dress === "plain" || dress === "key") {
      this.box(f, op.x, y1, 0.025, op.w + 0.3, 0.22, 0.05, "pale");
      if (dress === "key") this.box(f, op.x, y1 - 0.06, 0.04, 0.26, 0.34, 0.08, "pale");
      return;
    }
    if (dress === "hood") {
      this.box(f, op.x, y1 + 0.12, 0.09, op.w + 0.44, 0.1, 0.18, "paper");
      this.box(f, op.x, y1 + 0.03, 0.05, op.w + 0.34, 0.09, 0.1, "paper");
      for (const sx of [-1, 1]) this.box(f, op.x + sx * (op.w / 2 + 0.12), y1 - 0.25, 0.06, 0.1, 0.37, 0.12, "paper");
      return;
    }
    if (dress === "pediment") {
      const w = op.w + 0.5;
      this.box(f, op.x, y1 + 0.06, 0.08, w, 0.12, 0.16, "paper");
      this.add(
        extrude(
          [
            [op.x - w / 2, 0],
            [op.x + w / 2, 0],
            [op.x, 0.34],
          ],
          0.14,
        ),
        f,
        { tone: "paper", position: [0, y1 + 0.18, 0.07] },
      );
    }
  }

  private windowUnit(f: M4, op: Opening, t: number, st: OpState, idx: number, s: WallSpec): void {
    const R = op.reveal ?? Math.min(0.16, t * 0.45);
    const style = op.win ?? "sash";
    const sealed = st === "sealed";
    if (sealed) {
      // Blanked flush-ish: a ghost of a window, crisp but empty.
      this.add(extrude(openingPoly(op, 0), 0.05), f, { tone: "light", position: [0, 0, -0.085] });
      return;
    }
    if (style === "blind") {
      // A recessed panel: the wall's own material set back.
      this.add(shape(openingPoly(op, 0)), f, { tone: "paper", position: [0, 0, -Math.min(0.14, t * 0.4)] });
      if (op.sill !== false) this.box(f, op.x, op.y - 0.065, 0.02, op.w + 0.16, 0.07, 0.12, "pale");
      if (!op.lite) this.dress(f, op, false);
      return;
    }
    if (style === "slit") {
      // An unglazed vent: just the dark inside.
      this.quad(f, op.x, op.y + op.h / 2, -t + 0.02, op.w + 0.1, op.h + 0.1, "solid");
      return;
    }
    if (op.sill !== false && style !== "ribbon") this.box(f, op.x, op.y - 0.065, (0.075 - R) / 2, op.w + 0.16, 0.07, R + 0.075, "pale");
    if (!op.lite) this.dress(f, op, false);
    if (op.shutters && st !== "broken") {
      for (const sx of [-1, 1]) {
        const sw = op.w / 2;
        const tilt = st === "boarded" ? 0 : 0;
        this.box(f, op.x + sx * (op.w / 2 + sw / 2 + 0.05), op.y, 0.03, sw, op.h - 0.05, 0.04, "light", { rot: [0, tilt, 0] });
        for (let k = 1; k < 3; k++) this.quad(f, op.x + sx * (op.w / 2 + sw / 2 + 0.05), op.y + (op.h * k) / 3, 0.052, sw - 0.06, 0.03, "solid");
      }
    }
    if (style === "louvre") {
      const n = Math.max(3, Math.round(op.h / 0.2));
      for (let i = 0; i < n; i++) {
        const y = op.y + ((i + 0.5) / n) * op.h;
        this.cbox(f, op.x, y, -R, op.w - 0.04, 0.03, 0.2, "light", { rot: [0.6, 0, 0] });
      }
      this.quad(f, op.x, op.y + op.h / 2, -R - 0.15, op.w, op.h, "solid");
      return;
    }
    const fw = style === "ribbon" || style === "shop" ? 0.06 : 0.075;
    const outer = openingPoly(op, 0);
    const inner = openingPoly(op, fw);
    const gz = -R - 0.05;
    if (st === "broken") {
      const g = this.fork(`brk${idx}`);
      if (g.next() < 0.6) this.add(extrude(outer, 0.07, 0, [inner]), f, { tone: "paper", position: [0, 0, -R - 0.035] });
      if (g.next() < 0.5) {
        // A shard left in a corner.
        const x0 = op.x - op.w / 2 + fw;
        const y0 = op.y + fw;
        const sw = op.w * g.range(0.25, 0.5);
        const sh = op.h * g.range(0.2, 0.45);
        this.add(
          shape([
            [x0, y0],
            [x0 + sw, y0],
            [x0, y0 + sh],
          ]),
          f,
          { tone: this.glass, position: [0, 0, gz] },
        );
      }
      this.liner(f, op, t, idx, s.noLiner, this.clear);
      this.scorch(f, op, idx);
      return;
    }
    // Steel windows have no timber frame: the glazing grid is the frame.
    if (!op.lite && style !== "industrial" && style !== "ribbon") this.add(extrude(outer, 0.07, 0, [inner]), f, { tone: "paper", position: [0, 0, -R - 0.035] });
    const lit = st === "lit";
    this.add(shape(inner), f, lit ? { tone: "pale", accent: "amber", accentAmount: 0.92, position: [0, 0, gz] } : { tone: this.glass, position: [0, 0, gz] });
    this.bars(f, op, style, fw, gz + 0.006);
    if (st === "boarded") this.boards(f, op, idx, false);
  }

  private bars(f: M4, op: Opening, style: WindowStyle, fw: number, z: number): void {
    const iw = op.w - fw * 2;
    const x0 = op.x - iw / 2;
    const y0 = op.y + fw;
    const topY = op.y + op.h - fw;
    const ih = topY - y0;
    const sp = springing(op);
    const bar = 0.05;
    switch (style) {
      case "sash": {
        const mid = (op.head ?? "flat") === "flat" ? y0 + ih * 0.5 : y0 + (sp - y0) * 0.55;
        this.quad(f, op.x, mid, z, iw, 0.07);
        if (op.w > 0.75) this.quad(f, op.x, (y0 + topY) / 2, z, bar, ih);
        break;
      }
      case "georgian": {
        const cols = 3;
        const rows = 4;
        for (let i = 1; i < cols; i++) this.quad(f, x0 + (iw * i) / cols, (y0 + topY) / 2, z, 0.04, ih);
        for (let j = 1; j < rows; j++) this.quad(f, op.x, y0 + (ih * j) / rows, z, iw, j === 2 ? 0.07 : 0.04);
        break;
      }
      case "casement": {
        if (op.w > 0.85) this.quad(f, op.x, (y0 + topY) / 2, z, 0.06, ih);
        this.quad(f, op.x, y0 + ih * 0.7, z, iw, 0.06);
        break;
      }
      case "industrial":
      case "cabin": {
        const cols = op.grid?.[0] ?? Math.max(2, Math.round(iw / (style === "cabin" ? 0.34 : 0.42)));
        const rows = op.grid?.[1] ?? Math.max(2, Math.round((sp - y0) / (style === "cabin" ? 0.36 : 0.4)));
        for (let i = 1; i < cols; i++) this.quad(f, x0 + (iw * i) / cols, (y0 + topY) / 2, z, 0.038, ih);
        for (let j = 1; j < rows; j++) this.quad(f, op.x, y0 + ((sp - y0) * j) / rows, z, iw, 0.038);
        if ((op.head ?? "flat") !== "flat") this.quad(f, op.x, sp, z, iw, 0.05);
        break;
      }
      case "lancet": {
        if (op.w > 0.7) this.quad(f, op.x, (y0 + topY) / 2, z, 0.06, ih);
        for (let j = 1; j < 4; j++) this.quad(f, op.x, y0 + ((sp - y0) * j) / 4, z, iw, 0.03);
        break;
      }
      case "fan": {
        this.quad(f, op.x, sp, z, iw, 0.06);
        for (const k of [-1, 1]) this.quad(f, op.x + (k * iw) / 6, (y0 + sp) / 2, z, 0.045, sp - y0);
        this.quad(f, op.x, y0 + (sp - y0) * 0.5, z, iw, 0.045);
        const r = op.w / 2 - fw;
        for (const a of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
          const cx = op.x + (Math.cos(a) * r) / 2;
          const cy = sp + (Math.sin(a) * r) / 2;
          this.quad(f, cx, cy, z, 0.04, r, "paper", { rotZ: a - Math.PI / 2 });
        }
        break;
      }
      case "ribbon": {
        const pitch = op.pitch ?? 1.25;
        const n = Math.max(1, Math.round(iw / pitch));
        for (let i = 1; i < n; i++) this.quad(f, x0 + (iw * i) / n, (y0 + topY) / 2, z, 0.08, ih);
        break;
      }
      case "shop": {
        this.quad(f, op.x, y0 + ih * 0.78, z, iw, 0.07);
        if (op.w > 2) for (const k of [-1, 1]) this.quad(f, op.x + (k * iw) / 6, (y0 + topY) / 2, z, 0.06, ih);
        break;
      }
      default:
        break;
    }
  }

  private boards(f: M4, op: Opening, idx: number, door: boolean): void {
    const g = this.fork(`board${idx}`);
    const n = Math.min(door ? 4 : 3, Math.max(2, Math.round(op.h / (door ? 0.55 : 0.5))));
    for (let i = 0; i < n; i++) {
      const y = op.y + ((i + 0.5) / n) * op.h;
      this.cbox(f, op.x + g.range(-0.05, 0.05), y, 0.02, op.w + 0.22, 0.2, 0.035, "light", { rot: [0, 0, g.range(-0.09, 0.09)] });
    }
    if (door || g.next() < 0.4) {
      const d = Math.hypot(op.w, op.h);
      this.cbox(f, op.x, op.y + op.h / 2, 0.045, 0.18, d * 0.92, 0.03, "light", { rot: [0, 0, Math.atan2(op.w, op.h) * (g.next() < 0.5 ? 1 : -1)] });
    }
  }

  // ----------------------------------------------------------------- doors

  private doorUnit(f: M4, op: Opening, t: number, st: OpState, idx: number, s: WallSpec): void {
    const style = op.door ?? "panel";
    const R = op.reveal ?? Math.min(0.14, t * 0.4);
    const tone = op.doorTone ?? this.doorTone;
    const g = this.fork(`door${idx}`);
    // Steps up to a raised threshold.
    if (op.y > 0.05 && op.y <= 1.3) {
      const n = Math.max(1, Math.round(op.y / 0.16));
      const rise = op.y / n;
      for (let i = 0; i < n; i++) {
        const depth = 0.32 * (n - i);
        this.box(f, op.x, rise * i, depth / 2 - 0.02, op.w + 0.5 + (n - i) * 0.12, rise + 0.001, depth + 0.02, "pale");
      }
    } else if (op.y <= 0.05 && (style === "panel" || style === "glazed")) {
      this.box(f, op.x, 0, 0.14, op.w + 0.3, 0.12, 0.3, "pale");
    }
    if (st === "sealed") {
      this.add(extrude(openingPoly(op, 0), 0.05), f, { tone: "pale", position: [0, 0, -0.085] });
      // A single cobalt status strip: the building answers to Morrow now.
      this.cbox(f, op.x, op.y + op.h + 0.25, 0.035, Math.min(0.9, op.w * 0.6), 0.09, 0.07, "paper", { accent: "cobalt", amt: 1 });
      return;
    }
    if (style !== "open" && style !== "shutter" && style !== "sliding") {
      // Architrave.
      this.box(f, op.x - op.w / 2 - 0.05, op.y, 0.02, 0.1, op.h + 0.05, 0.04, "paper");
      this.box(f, op.x + op.w / 2 + 0.05, op.y, 0.02, 0.1, op.h + 0.05, 0.04, "paper");
      if ((op.head ?? "flat") === "flat") this.box(f, op.x, op.y + op.h, 0.02, op.w + 0.3, 0.12, 0.05, "paper");
    }
    this.dress(f, op, true);
    const zLeaf = -R - 0.03;
    const x0 = op.x - op.w / 2;
    const broken = st === "broken";
    if (style === "open") {
      this.quad(f, op.x, op.y + op.h / 2, -t - 0.6, op.w + 0.6, op.h + 0.4, "solid");
      return;
    }
    if (broken) {
      this.liner(f, op, t, idx, s.noLiner, this.clear);
      this.scorch(f, op, idx);
      if (g.next() < 0.5 && style !== "shutter") {
        // Left ajar, hanging from its hinge.
        const w = op.w * (style === "double" ? 0.5 : 1);
        const hinge = new THREE.Matrix4().makeRotationY(-g.range(0.5, 1.2));
        hinge.setPosition(x0 + 0.03, op.y, zLeaf);
        const hf = f.clone().multiply(hinge);
        this.box(hf, w / 2, 0.02, 0, w - 0.04, op.h - 0.1, 0.05, style === "plank" || style === "double" ? "light" : tone);
      }
      return;
    }
    const leafH = style === "panel" && op.h > 2.35 && (op.head ?? "flat") === "flat" ? op.h - 0.42 : op.h;
    const iw = op.w - 0.04;
    switch (style) {
      case "flush": {
        this.box(f, op.x, op.y, zLeaf, iw, op.h, 0.05, tone);
        this.box(f, op.x + iw * 0.3, op.y + op.h * 0.45, zLeaf + 0.03, 0.05, 0.2, 0.03, "mid");
        break;
      }
      case "panel": {
        this.box(f, op.x, op.y, zLeaf, iw, leafH, 0.05, tone);
        const pw = iw * 0.34;
        for (const sx of [-1, 1]) {
          this.box(f, op.x + sx * iw * 0.23, op.y + leafH * 0.1, zLeaf + 0.03, pw, leafH * 0.36, 0.015, tone);
          this.box(f, op.x + sx * iw * 0.23, op.y + leafH * 0.52, zLeaf + 0.03, pw, leafH * 0.38, 0.015, tone);
        }
        if (leafH < op.h - 0.1) {
          this.quad(f, op.x, op.y + leafH + (op.h - leafH) / 2, zLeaf, iw - 0.06, op.h - leafH - 0.08, this.glass);
          this.box(f, op.x, op.y + leafH, zLeaf + 0.01, iw, 0.08, 0.06, "paper");
        } else if ((op.head ?? "flat") !== "flat") {
          const inner = openingPoly(op, 0.05).filter(([, y]) => y >= springing(op) - 1e-3);
          if (inner.length > 2) this.add(shape(inner), f, { tone: this.glass, position: [0, 0, zLeaf + 0.03] });
        }
        break;
      }
      case "glazed": {
        this.box(f, op.x, op.y, zLeaf - 0.02, iw, op.h, 0.02, this.glass);
        const leaves = op.w > 1.4 ? 2 : 1;
        for (let i = 0; i <= leaves; i++) this.box(f, x0 + 0.02 + (iw * i) / leaves, op.y, zLeaf, 0.09, op.h, 0.06, "paper");
        this.box(f, op.x, op.y + op.h - 0.1, zLeaf, iw, 0.1, 0.06, "paper");
        this.box(f, op.x, op.y, zLeaf, iw, 0.2, 0.06, "paper");
        this.box(f, op.x, op.y + op.h * 0.78, zLeaf, iw, 0.07, 0.06, "paper");
        break;
      }
      case "plank":
      case "double": {
        const leaves = style === "double" ? 2 : 1;
        const lw = iw / leaves;
        for (let l = 0; l < leaves; l++) {
          const cx = x0 + 0.02 + lw * (l + 0.5);
          this.box(f, cx, op.y, zLeaf, lw - 0.02, op.h - 0.02, 0.05, "light");
          const nb = Math.max(2, Math.round(lw / 0.22));
          for (let b = 1; b < nb; b++) this.quad(f, cx - lw / 2 + (lw * b) / nb, op.y + op.h / 2, zLeaf + 0.026, 0.022, op.h - 0.06, "solid");
          for (const fy of [0.12, 0.5, 0.88]) this.box(f, cx, op.y + op.h * fy - 0.09, zLeaf + 0.04, lw - 0.1, 0.18, 0.035, "light");
          const dz = Math.atan2(op.h * 0.38, lw - 0.12) * (l === 0 ? 1 : -1);
          const blen = Math.hypot(op.h * 0.38, lw - 0.12);
          for (const fy of [0.31, 0.69]) this.cbox(f, cx, op.y + op.h * fy, zLeaf + 0.042, blen, 0.14, 0.03, "light", { rot: [0, 0, dz] });
        }
        break;
      }
      case "sliding": {
        const lw = op.w + 0.2;
        this.box(f, op.x - 0.1, op.y, 0.08, lw, op.h + 0.05, 0.06, "light");
        const nb = Math.max(2, Math.round(lw / 0.25));
        for (let b = 1; b < nb; b++) this.quad(f, op.x - 0.1 - lw / 2 + (lw * b) / nb, op.y + op.h / 2, 0.111, 0.022, op.h - 0.04, "solid");
        this.box(f, op.x - 0.1, op.y + op.h * 0.46, 0.13, lw - 0.1, 0.16, 0.03, "light");
        this.cbox(f, op.x + op.w * 0.3, op.y + op.h + 0.12, 0.08, op.w * 2.1, 0.1, 0.08, "dark");
        break;
      }
      case "shutter": {
        this.box(f, op.x, op.y, -R, iw, op.h, 0.04, "pale");
        const n = Math.max(3, Math.round(op.h / 0.32));
        for (let i = 1; i < n; i++) this.quad(f, op.x, op.y + (op.h * i) / n, -R + 0.021, iw, 0.028, "solid");
        this.box(f, op.x, op.y + op.h, 0.14, op.w + 0.3, 0.42, 0.28, "paper");
        break;
      }
      default:
        break;
    }
    if (st === "boarded") this.boards(f, op, idx, true);
  }

  // ------------------------------------------------------------------ roofs

  /**
   * Gable or hipped roof in roof frame f (origin on the wall head at the
   * block centre, ridge along x). `L` is the length along the ridge and `D`
   * the span, both measured to the outer wall faces.
   */
  roof(f: M4, L: number, D: number, s: RoofSpec): RoofResult {
    const th = (s.pitch * Math.PI) / 180;
    const T = s.t ?? 0.14;
    const e = s.eave ?? 0.38;
    const v = s.verge ?? 0.3;
    const R = (D / 2) * Math.tan(th);
    const Vs = (D / 2 + e) / Math.cos(th);
    const v0 = -T * Math.tan(th);
    const tone = s.tone ?? "light";
    const hip = !!s.hip && L >= D * 0.999;
    const hr = hip ? (L - D) / 2 : 0;
    const Lr = L + 2 * v;
    const ridgeTop = R + T / Math.cos(th);
    const r = s.intact ? 0 : this.c.ruin;
    for (const side of [1, -1] as const) {
      const hw = hip ? (vv: number) => hr + vv * Math.cos(th) + T : () => Lr / 2;
      this.plate(f, [0, R, 0], side, th, T, hw, v0, Vs, tone, `${s.label}:${side}`, r, D / 2 / Math.cos(th));
      if (s.fascia !== false) this.eaveTrim(f, side, th, T, e, D, hip ? L + 2 * e : Lr, s.gutter !== false && !this.sealed, r, `${s.label}:${side}`);
    }
    if (hip) {
      for (const end of [1, -1] as const) {
        const ef = f.clone().multiply(frame(end * hr, 0, 0, (end * Math.PI) / 2));
        this.plate(ef, [0, R, 0], 1, th, T, (vv) => Math.max(0.001, vv * Math.cos(th) + T), 0, Vs, tone, `${s.label}:end${end}`, r, D / 2 / Math.cos(th));
        if (s.fascia !== false) this.eaveTrim(ef, 1, th, T, e, D, D + 2 * e, s.gutter !== false && !this.sealed, r, `${s.label}:e${end}`);
        // Hip rafters' caps.
        if (s.ridge !== false && r < RUIN.gutted) {
          for (const sz of [1, -1]) {
            const a: V3 = [end * hr, ridgeTop, 0];
            const b: V3 = [end * (L / 2 + e), -e * Math.tan(th) + T, sz * (D / 2 + e)];
            this.beam(f, a, b, 0.16, 0.12, "mid");
          }
        }
      }
    } else if (s.barge !== false && !this.sealed) {
      for (const side of [1, -1] as const) {
        for (const end of [1, -1]) {
          const m = this.plateMatrix(f, [0, R, 0], side, th, T);
          if (r >= RUIN.gutted && this.fork(`barge${s.label}${side}${end}`).next() < r) continue;
          this.add(new THREE.BoxGeometry(0.04, Vs - v0, 0.26), m, { tone: "paper", position: [end * (Lr / 2 - 0.02), (v0 + Vs) / 2, -T / 2 - 0.12] });
        }
      }
    }
    if (s.ridge !== false && r < RUIN.gutted) {
      const len = hip ? hr * 2 + 0.2 : Lr + 0.04;
      if (len > 0.05) this.cbox(f, 0, ridgeTop - 0.03, 0, len, 0.17, 0.17, "mid", { rot: [Math.PI / 4, 0, 0] });
    }
    // Ridge beam, visible once the covering has gone.
    if (r >= RUIN.damaged && r < RUIN.shell) {
      const len = hip ? Math.max(0.3, hr * 2) : L - 0.2;
      this.cbox(f, 0, R - 0.12, 0, len, 0.24, 0.12, "light");
    }
    return { rise: R, top: ridgeTop, eave: e };
  }

  /** A single-pitch roof: high edge at z = -D/2 (against a wall), low eave at z = +D/2. */
  leanRoof(f: M4, L: number, D: number, s: RoofSpec): RoofResult {
    const th = (s.pitch * Math.PI) / 180;
    const T = s.t ?? 0.12;
    const e = s.eave ?? 0.3;
    const v = s.verge ?? 0.15;
    const R = D * Math.tan(th);
    const Vs = (D + e) / Math.cos(th);
    const r = s.intact ? 0 : this.c.ruin;
    // Underside passes through the low wall head (z = D/2, y = 0) and meets
    // the high wall at z = -D/2.
    this.plate(f, [0, R, -D / 2], 1, th, T, () => L / 2 + v, 0, Vs, s.tone ?? "light", s.label, r, D / Math.cos(th));
    if (s.fascia !== false) this.eaveTrim(f, 1, th, T, e, D, L + 2 * v, s.gutter !== false && !this.sealed, r, s.label);
    return { rise: R, top: R + T, eave: e };
  }

  private plateMatrix(f: M4, origin: V3, side: 1 | -1, th: number, T: number): M4 {
    const a = new THREE.Vector3(-side, 0, 0);
    const d = new THREE.Vector3(0, -Math.sin(th), side * Math.cos(th));
    const n = new THREE.Vector3(0, Math.cos(th), side * Math.sin(th));
    const m = new THREE.Matrix4().makeBasis(a, d, n);
    m.setPosition(origin[0] + n.x * (T / 2), origin[1] + n.y * (T / 2), origin[2] + n.z * (T / 2));
    return f.clone().multiply(m);
  }

  /**
   * One roof plate in plate coordinates (u along the ridge, v down the
   * slope from the ridge, thickness T), with ruin: holes, fragments,
   * exposed and broken rafters.
   */
  private plate(f: M4, origin: V3, side: 1 | -1, th: number, T: number, hw: (v: number) => number, v0: number, Vs: number, tone: Tone, label: string, r: number, wallV: number): void {
    const m = this.plateMatrix(f, origin, side, th, T);
    const g = this.fork(`plate:${label}`);
    const rafter = (u: number, va: number, vb: number, sag = 0) => {
      if (vb - va < 0.2) return;
      const len = vb - va;
      this.add(new THREE.BoxGeometry(0.07, len, 0.15), m, { tone: this.c.fire > 0.3 || r >= RUIN.gutted ? "dark" : "light", position: [u, (va + vb) / 2, -T / 2 - 0.075 - sag], rotation: [sag * 0.3, 0, 0] });
    };
    const full = (): P2[] => {
      const a = hw(v0);
      const b = hw(Vs);
      return a < 0.01
        ? [
            [-b, Vs],
            [b, Vs],
            [0, v0],
          ]
        : [
            [-b, Vs],
            [b, Vs],
            [a, v0],
            [-a, v0],
          ];
    };
    const ext = hw(Vs);
    const small = ext * 2 * (Vs - v0) < 14;
    if (r < RUIN.damaged || (small && r < RUIN.gutted)) {
      this.add(extrude(full(), T), m, { tone });
      return;
    }
    if (r < RUIN.gutted) {
      const sev = (r - RUIN.damaged) / (RUIN.gutted - RUIN.damaged);
      const holes: P2[][] = [];
      const want = 1 + Math.floor(g.next() * (1.5 + 3 * sev));
      const spans: Array<[number, number, number, number]> = [];
      for (let tries = 0; tries < 24 && holes.length < want; tries++) {
        const ru = 0.5 + g.next() * (0.6 + 1.8 * sev);
        const rv = Math.min(0.42 * wallV, 0.45 + g.next() * (0.4 + 1.2 * sev));
        const vc = g.range(Math.max(0.35, v0) + rv, wallV - 0.25 - rv);
        const lim = hw(vc - rv) - 0.35 - ru;
        if (lim <= 0 || vc - rv < 0.2) continue;
        const uc = g.range(-lim, lim);
        if (spans.some(([a, b, c, d]) => Math.abs(uc - a) < ru + b + 0.3 && Math.abs(vc - c) < rv + d + 0.3)) continue;
        spans.push([uc, ru, vc, rv]);
        holes.push(blob(uc, vc, ru, rv, 10, g, 0.5));
      }
      const pg = safeExtrude(full(), T, holes);
      if (pg) this.add(pg, m, { tone });
      for (const [uc, ru, vc, rv] of spans) {
        for (let u = uc - ru - 0.3; u <= uc + ru + 0.3; u += 0.7) {
          const snap = Math.round(u / 0.7) * 0.7;
          const broken = g.next() < 0.35 * sev;
          rafter(snap, v0 + 0.1, broken ? vc + g.range(-rv, rv) : wallV, 0);
        }
        // Loose slates at the lip of the hole.
        for (let i = 0; i < 3; i++) {
          const a = g.next() * Math.PI * 2;
          this.add(new THREE.BoxGeometry(0.34, 0.24, 0.02), m, { tone, position: [uc + Math.cos(a) * ru * 0.9, vc + Math.sin(a) * rv * 0.9, T / 2 + 0.01], rotation: [0.15, 0.1, g.range(-0.6, 0.6)] });
        }
      }
      return;
    }
    // Gutted: fragments along the eave, a skeleton of rafters above.
    const sev = smooth(RUIN.gutted, 0.95, r);
    const step = 0.5;
    const n = Math.max(2, Math.min(40, Math.ceil((ext * 2) / step)));
    const keeps: number[] = [];
    const ctrl = Array.from({ length: Math.ceil(n / 5) + 2 }, () => g.next());
    for (let i = 0; i <= n; i++) {
      const cu = (i / n) * (ctrl.length - 1);
      const i0 = Math.min(ctrl.length - 2, Math.floor(cu));
      const nz = lerp(ctrl[i0]!, ctrl[i0 + 1]!, cu - i0);
      keeps.push(clamp01((0.75 - sev * 0.95) * (0.3 + nz)) + (g.next() - 0.5) * 0.06);
    }
    let startI = -1;
    const flush = (a: number, b: number) => {
      if (b - a < 2) return;
      const poly: P2[] = [];
      for (let i = a; i <= b; i++) {
        const u = -ext + (2 * ext * i) / n;
        poly.push([u, Vs]);
      }
      for (let i = b; i >= a; i--) {
        const u = -ext + (2 * ext * i) / n;
        const vv = Vs - keeps[i]! * (Vs - Math.max(0, v0));
        const lim = hw(vv);
        poly.push([Math.max(-lim, Math.min(lim, u)), Math.min(Vs - 0.12, vv)]);
      }
      // Clamp the eave corners to the plate's half-width.
      const lim = hw(Vs);
      for (const p of poly) p[0] = Math.max(-lim, Math.min(lim, p[0]));
      const fg = safeExtrude(poly, T);
      if (fg) this.add(fg, m, { tone });
    };
    for (let i = 0; i <= n; i++) {
      const ok = keeps[i]! > 0.1;
      if (ok && startI < 0) startI = i;
      if ((!ok || i === n) && startI >= 0) {
        flush(startI, ok ? i : i - 1);
        startI = -1;
      }
    }
    const keepFrac = r >= RUIN.shell ? 0 : 0.55 - smooth(0.5, RUIN.shell, r) * 0.35;
    const rStep = Math.max(0.6, (2 * ext) / 28);
    for (let u = -ext + 0.4; u <= ext - 0.4; u += rStep) {
      if (g.next() > keepFrac) continue;
      const lim = hw(v0 + 0.2);
      if (Math.abs(u) > lim) continue;
      const vb = wallV;
      const va = g.next() < 0.6 + sev * 0.3 ? lerp(v0 + 0.1, vb, g.range(0.2, 0.85)) : v0 + 0.1;
      rafter(u, va, vb, 0);
    }
  }

  private eaveTrim(f: M4, side: 1 | -1, th: number, T: number, e: number, D: number, len: number, gutter: boolean, r: number, label: string): void {
    const zEdge = side * (D / 2 + e + T * Math.sin(th) + 0.018);
    const yLow = -e * Math.tan(th);
    const yTop = yLow + T * Math.cos(th);
    const g = this.fork(`eave:${label}`);
    const segs = r >= RUIN.damaged ? Math.max(1, Math.round(len / 1.6)) : 1;
    const sl = len / segs;
    let runStart = -1;
    for (let i = 0; i <= segs; i++) {
      const keep = i < segs && (segs === 1 || g.next() >= (r - 0.15) * 1.3);
      if (keep && runStart < 0) runStart = i;
      if (!keep && runStart >= 0) {
        const x0 = -len / 2 + sl * runStart;
        const x1 = -len / 2 + sl * i;
        this.box(f, (x0 + x1) / 2, yLow - 0.18, zEdge, x1 - x0, yTop - yLow + 0.18, 0.036, "paper");
        if (gutter) this.box(f, (x0 + x1) / 2, yLow - 0.16, zEdge + side * 0.08, x1 - x0, 0.12, 0.12, "dark");
        runStart = -1;
      }
    }
  }

  /** Flat roof slab inside parapet walls, with coping. */
  flatRoof(f: M4, W: number, D: number, y: number, o: { t?: number; coping?: boolean; parapetTop?: number; tone?: Tone; label: string }): void {
    const r = this.c.ruin;
    const g = this.fork(`flat:${o.label}`);
    if (r < RUIN.gutted || g.next() > r) this.box(f, 0, y - (o.t ?? 0.3), 0, W - 0.02, o.t ?? 0.3, D - 0.02, o.tone ?? "pale");
    if (o.coping !== false && o.parapetTop !== undefined && r < RUIN.gutted) {
      const ct = 0.1;
      const cy = o.parapetTop;
      this.box(f, 0, cy, D / 2 - 0.2, W + 0.12, ct, 0.52, "pale");
      this.box(f, 0, cy, -D / 2 + 0.2, W + 0.12, ct, 0.52, "pale");
      this.box(f, W / 2 - 0.2, cy, 0, 0.52, ct, D - 0.3, "pale");
      this.box(f, -W / 2 + 0.2, cy, 0, 0.52, ct, D - 0.3, "pale");
    }
  }

  // --------------------------------------------------------------- details

  /** Brick or stone stack with oversailing courses and pots. */
  chimney(f: M4 | null, x: number, z: number, y0: number, y1: number, w = 0.75, d = 0.55, pots = 2, tone: Tone = "paper"): void {
    if (this.sealed) return;
    const g = this.fork(`chim${x.toFixed(2)}:${z.toFixed(2)}`);
    const r = this.c.ruin;
    let top = y1;
    if (r > 0.85 && g.next() < 0.4) top = lerp(y0, y1, g.range(0.5, 0.85));
    this.box(f, x, y0, z, w, top - y0, d, tone);
    if (top < y1) return;
    this.box(f, x, y1 - 0.36, z, w + 0.1, 0.1, d + 0.1, tone);
    this.box(f, x, y1 - 0.13, z, w + 0.16, 0.13, d + 0.16, tone);
    for (let i = 0; i < pots; i++) {
      if (r > 0.15 && g.next() < r * 1.2) continue;
      const px = x + (pots === 1 ? 0 : lerp(-w / 2 + 0.2, w / 2 - 0.2, i / (pots - 1)));
      const ph = 0.45 + g.next() * 0.2;
      this.add(cylinder(0.1, 0.13, ph, 6, true), f, { tone: "light", position: [px, y1 + ph / 2, z] });
      this.add(cylinder(0.14, 0.14, 0.06, 6, true), f, { tone: "light", position: [px, y1 + ph - 0.03, z] });
      this.add(new THREE.CircleGeometry(0.1, 6), f, { tone: "solid", position: [px, y1 + ph - 0.01, z], rotation: [-Math.PI / 2, 0, 0] });
    }
  }

  /** A downpipe on a wall face (face frame), from the gutter to the ground. */
  downpipe(f: M4, x: number, yTop: number, eaveOut: number, h0 = 0): void {
    if (this.sealed) return;
    const g = this.fork(`pipe${x.toFixed(2)}${yTop.toFixed(2)}`);
    const r = this.c.ruin;
    if (r > 0.3 && g.next() < r) {
      if (g.next() < 0.5) this.cbox(f, x + 0.4, 0.06, 0.6, 0.1, 0.1, yTop * 0.5, "dark", { rot: [0, 0.4, 0] });
      return;
    }
    this.box(f, x, h0, 0.08, 0.1, yTop - 0.45 - h0, 0.1, "dark");
    this.box(f, x, yTop - 0.5, 0.09, 0.24, 0.26, 0.2, "dark");
    this.beam(f, [x, yTop - 0.26, 0.1], [x, yTop - 0.02, eaveOut], 0.09, 0.09, "dark");
    this.box(f, x, h0, 0.14, 0.14, 0.12, 0.26, "dark");
    for (let y = h0 + 1.2; y < yTop - 0.8; y += 1.6) this.box(f, x, y, 0.06, 0.16, 0.05, 0.14, "dark");
  }

  /** Corner quoins on a rectangular block (block frame, footprint w x d). */
  quoins(f: M4, w: number, d: number, h: number, tone: Tone = "pale"): void {
    const r = this.c.ruin;
    const lim = r >= RUIN.gutted ? h * (1 - smooth(0.55, 1, r) * 0.7) : h;
    const q = 0.03;
    // Only the two street corners: the backs of buildings beside the line
    // are rarely seen, and quoins are the most expensive trim per metre.
    for (const sx of [-1, 1]) {
      for (const sz of [1]) {
        let y = 0.05;
        let i = 0;
        while (y + 0.28 < lim) {
          const longX = i % 2 === 0;
          const ax = longX ? 0.5 : 0.28;
          const az = longX ? 0.28 : 0.5;
          this.box(f, sx * (w / 2 - ax / 2 + q / 2), y, sz * (d / 2 - az / 2 + q / 2), ax + q, 0.34, az + q, tone);
          y += 0.4;
          i++;
        }
      }
    }
  }

  /** Rubble heap (block frame) centred on (x, z) spread over rx x rz. */
  rubble(f: M4 | null, x: number, z: number, rx: number, rz: number, amount: number, label: string, maxH = 1.2): void {
    if (amount <= 0.01) return;
    const g = this.fork(`rubble:${label}`);
    const n = Math.min(this.rubbleLeft, Math.round(6 + amount * 34));
    if (n <= 0) return;
    this.rubbleLeft -= n;
    for (let i = 0; i < n; i++) {
      const a = g.next() * Math.PI * 2;
      const rr = Math.sqrt(g.next());
      const px = x + Math.cos(a) * rx * rr;
      const pz = z + Math.sin(a) * rz * rr;
      const s = g.range(0.18, 0.55) * (1.2 - rr * 0.6);
      const y = maxH * amount * (1 - rr) * g.range(0.2, 0.9);
      const tone: Tone = g.pick(["paper", "pale", "light", "paper", "mid"] as const);
      const geo = g.next() < 0.5 ? new THREE.IcosahedronGeometry(s, 0) : new THREE.BoxGeometry(s * 1.6, s * 0.7, s);
      this.add(geo, f, { tone, position: [px, y, pz], rotation: [g.next() * 3, g.next() * 3, g.next() * 3], scale: [1, g.range(0.5, 0.9), 1] });
    }
    const beams = this.rubbleLeft > 0 ? Math.round(amount * 4) : Math.round(amount * 2);
    for (let i = 0; i < beams; i++) {
      const a = g.next() * Math.PI;
      const len = g.range(1.5, 3.5);
      const px = x + g.range(-rx, rx) * 0.6;
      const pz = z + g.range(-rz, rz) * 0.6;
      const lift = g.range(0.1, 0.9) * amount;
      this.beam(
        f,
        [px - (Math.cos(a) * len) / 2, 0.05, pz - (Math.sin(a) * len) / 2],
        [px + (Math.cos(a) * len) / 2, lift, pz + (Math.sin(a) * len) / 2],
        0.14,
        0.12,
        g.next() < 0.5 ? "light" : "deep",
      );
    }
  }

  // ------------------------------------------------------------------ signs

  /** A sign on a face frame, centred at (x, y), standing `z` off the face. */
  sign(f: M4, design: SignDesign, x: number, y: number, w: number, h: number, z = 0.04, backing = true, geometry?: THREE.BufferGeometry): void {
    const g = this.fork(`sign:${design.text}`);
    let d = design;
    let tilt = 0;
    if (design.kind === "clock") {
      // Clocks keep their face; callers stop them at the hour of the damage.
    } else if (this.sealed && design.kind === "blade") {
      d = { kind: "blade", text: "", cross: false };
    } else if (this.sealed) {
      d = { ...design, kind: design.kind === "carved" ? "carved" : "board", text: `FACILITY ${String(1 + (Math.abs(this.rng.seed) % 40)).padStart(2, "0")}`, sub: undefined, cross: false, serif: false };
    } else if (this.c.ruin > 0.25) {
      if (this.c.ruin > 0.8 && g.next() < 0.6) return;
      d = { ...design, text: weather(design.text, (this.c.ruin - 0.2) * 0.6, g) };
      tilt = design.kind === "carved" || design.kind === "painted" ? 0 : g.range(-0.12, 0.12) * this.c.ruin;
    } else if (this.c.abandoned > 0.5 && design.kind !== "carved") {
      tilt = g.range(-0.05, 0.05);
    }
    if (backing && d.kind !== "painted" && d.kind !== "carved") {
      this.cbox(f, x, y, z / 2, w + 0.12, h + 0.12, Math.max(0.03, z), d.kind === "enamel" ? "deep" : "paper", { rot: [0, 0, tilt] });
    }
    const mesh = signMesh(d, w, h, geometry);
    if (!mesh) return;
    const local = new THREE.Matrix4().makeRotationZ(tilt);
    local.setPosition(x, y, z + 0.006);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(this.place(f)!).multiply(local);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.matrixAutoUpdate = true;
    this.extras.push(mesh);
  }

  /** A separate mesh for a moving part (object-space hatching). */
  moving(k: Kit, hatch = 0.06): THREE.Mesh {
    const mesh = new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatchSpace: "object", hatch }));
    this.extras.push(mesh);
    return mesh;
  }

  // ----------------------------------------------------------------- output

  finish(hatch = 0.14): THREE.Group {
    const group = new THREE.Group();
    const geo = this.k.build();
    const mesh = new THREE.Mesh(geo, inkMaterial({ vertexInk: true, hatch }));
    mesh.name = `civic:${this.id}`;
    group.add(mesh);
    for (const e of this.extras) group.add(e);
    group.name = `civic:${this.id}`;
    if (this.ticks.length) {
      const ticks = this.ticks;
      group.userData.tick = (dt: number, t: number) => {
        for (const f of ticks) f(dt, t);
      };
    }
    return group;
  }
}

