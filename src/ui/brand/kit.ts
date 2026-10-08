/**
 * Drawing kit for the news plates (thumbnails): a small pinhole camera so
 * buildings sit in true perspective, faces hatched by their angle to the sun,
 * cast shadows on the ground, and a set of entourage glyphs (figures, trees,
 * clouds, smoke) drawn in screen space at projected scale.
 *
 * Plates are 160 x 100 units. Line weights: contour 0.9, inner edges 0.6,
 * detail 0.45, hatching 0.32. Tone comes from light, not from fills.
 */
import { INK, PAPER } from "./palette.ts";
import { Pen } from "./pen.ts";
import { clamp, clipHalf, hull, lerp, poly, smooth, smoothRing, type Pt, type Ring } from "./geom.ts";
import type { Rng } from "../../render/core/rng.ts";

export const PW = 160;
export const PH = 100;

export const LINE = { contour: 1.05, edge: 0.6, detail: 0.5, hatch: 0.36 } as const;

/* ------------------------------------------------------------ vectors */

export type V3 = readonly [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Sun from the upper left, slightly toward the viewer (who looks down -Z). */
export const SUN: V3 = norm([-0.62, 0.7, 0.36]);

/* ------------------------------------------------------------- camera */

export class Cam {
  readonly eye: V3;
  private f: V3;
  private r: V3;
  private u: V3;
  private focal: number;
  constructor(o: { eye: V3; target: V3; fov?: number; w?: number; h?: number }) {
    this.eye = o.eye;
    this.f = norm(sub(o.target, o.eye));
    this.r = norm(cross(this.f, [0, 1, 0]));
    this.u = cross(this.r, this.f);
    const fov = ((o.fov ?? 40) * Math.PI) / 180;
    this.focal = (o.h ?? PH) / 2 / Math.tan(fov / 2);
    this.w = o.w ?? PW;
    this.h = o.h ?? PH;
  }
  readonly w: number;
  readonly h: number;
  depth(p: V3): number {
    return dot(sub(p, this.eye), this.f);
  }
  p(p: V3): Pt {
    const d = sub(p, this.eye);
    const z = Math.max(0.05, dot(d, this.f));
    return [this.w / 2 + (dot(d, this.r) * this.focal) / z, this.h / 2 - (dot(d, this.u) * this.focal) / z];
  }
  /** Screen length of a vertical metre at p. */
  scale(p: V3): number {
    return this.focal / Math.max(0.05, this.depth(p));
  }
  /** Screen y of the horizon. */
  horizon(): number {
    const far: V3 = [this.eye[0] + this.f[0] * 1e5, this.eye[1], this.eye[2] + this.f[2] * 1e5];
    return this.p(far)[1];
  }
  facing(n: V3, at: V3): boolean {
    return dot(n, sub(this.eye, at)) > 0;
  }
  /** Clip a 3D polygon to the part in front of the camera (depth >= near). */
  clipNear(pts: readonly V3[], near = 0.3): V3[] {
    const out: V3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const da = this.depth(a) - near;
      const db = this.depth(b) - near;
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) out.push(mix3(a, b, da / (da - db)));
    }
    return out;
  }
}

/* ------------------------------------------------------------- solids */

/** A planar quad: pts are bottom-left, bottom-right, top-right, top-left seen from outside. */
export interface Face {
  pts: readonly V3[];
  n: V3;
  role: "wall" | "roof" | "top";
}

export function faceAt(f: Face, u: number, v: number): V3 {
  const [a, b, c, d] = f.pts as [V3, V3, V3, V3];
  return mix3(mix3(a, b, u), mix3(d, c, u), v);
}

export function faceCenter(f: Face): V3 {
  let s: V3 = [0, 0, 0];
  for (const p of f.pts) s = add(s, p);
  return mul(s, 1 / f.pts.length);
}

/** Axis-aligned (then yawed) box standing on y = y0. */
export function box(c: V3, size: V3, yaw = 0): Face[] {
  const [w, h, d] = size;
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const P = (x: number, y: number, z: number): V3 => [c[0] + x * cs + z * sn, c[1] + y, c[2] - x * sn + z * cs];
  const R = (x: number, z: number): V3 => [x * cs + z * sn, 0, -x * sn + z * cs];
  const x0 = -w / 2,
    x1 = w / 2,
    z0 = -d / 2,
    z1 = d / 2;
  return [
    { pts: [P(x0, 0, z1), P(x1, 0, z1), P(x1, h, z1), P(x0, h, z1)], n: R(0, 1), role: "wall" }, // front +Z
    { pts: [P(x1, 0, z1), P(x1, 0, z0), P(x1, h, z0), P(x1, h, z1)], n: R(1, 0), role: "wall" }, // right +X
    { pts: [P(x1, 0, z0), P(x0, 0, z0), P(x0, h, z0), P(x1, h, z0)], n: R(0, -1), role: "wall" }, // back
    { pts: [P(x0, 0, z0), P(x0, 0, z1), P(x0, h, z1), P(x0, h, z0)], n: R(-1, 0), role: "wall" }, // left
    { pts: [P(x0, h, z1), P(x1, h, z1), P(x1, h, z0), P(x0, h, z0)], n: [0, 1, 0], role: "top" },
  ];
}

/** Gabled house: box walls plus two roof planes, ridge along X. */
export function gabled(c: V3, size: V3, ridge: number, yaw = 0, eave = 0.4): Face[] {
  const [w, h, d] = size;
  const walls = box(c, size, yaw).filter((f) => f.role === "wall");
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const P = (x: number, y: number, z: number): V3 => [c[0] + x * cs + z * sn, c[1] + y, c[2] - x * sn + z * cs];
  const R = (x: number, y: number, z: number): V3 => norm([x * cs + z * sn, y, -x * sn + z * cs]);
  const x0 = -w / 2 - eave * 0.5,
    x1 = w / 2 + eave * 0.5,
    z0 = -d / 2 - eave,
    z1 = d / 2 + eave;
  const eh = h - eave * (ridge / (d / 2));
  const slope = ridge / (d / 2);
  const out: Face[] = [...walls];
  // Gable triangles on the side walls (as degenerate quads).
  out.push({ pts: [P(x1 - eave * 0.5, h, d / 2), P(x1 - eave * 0.5, h, -d / 2), P(x1 - eave * 0.5, h + ridge, 0), P(x1 - eave * 0.5, h + ridge, 0)], n: R(1, 0, 0), role: "wall" });
  out.push({ pts: [P(x0 + eave * 0.5, h, -d / 2), P(x0 + eave * 0.5, h, d / 2), P(x0 + eave * 0.5, h + ridge, 0), P(x0 + eave * 0.5, h + ridge, 0)], n: R(-1, 0, 0), role: "wall" });
  out.push({ pts: [P(x0, eh, z1), P(x1, eh, z1), P(x1, h + ridge, 0), P(x0, h + ridge, 0)], n: R(0, 1, slope), role: "roof" });
  out.push({ pts: [P(x1, eh, z0), P(x0, eh, z0), P(x0, h + ridge, 0), P(x1, h + ridge, 0)], n: R(0, 1, -slope), role: "roof" });
  return out;
}

/** 0 (lit) .. 1 (deep shadow) from the face normal and the sun. */
export function shade(n: V3, light: V3 = SUN): number {
  const k = dot(norm(n), light);
  if (k > 0.3) return 0;
  if (k > 0.1) return 0.16;
  if (k > -0.15) return 0.34;
  if (k > -0.42) return 0.52;
  return 0.68;
}

export interface FaceStyle {
  tone?: number;
  w?: number;
  fill?: string;
  hatchW?: number;
  spacing?: number;
  noOutline?: boolean;
}

/** Draw a face: paper, contour, and hatching along its own vertical (walls) or slope (roofs). */
export function drawFace(pen: Pen, cam: Cam, f: Face, s: FaceStyle = {}): Ring {
  const pts = f.pts.some((p) => cam.depth(p) < 0.3) ? cam.clipNear(f.pts) : f.pts;
  if (pts.length < 3) return [];
  const ring = pts.map((p) => cam.p(p));
  pen.shape(ring, s.fill ?? PAPER, s.noOutline ? null : INK, s.w ?? LINE.edge);
  const t = s.tone ?? shade(f.n);
  if (t > 0.02) {
    const a = ring[0]!;
    const b = ring[1]!;
    const bottom: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const top: Pt = [(ring[3]![0] + ring[2]![0]) / 2, (ring[3]![1] + ring[2]![1]) / 2];
    const vAng = (Math.atan2(top[1] - bottom[1], top[0] - bottom[0]) * 180) / Math.PI;
    const uAng = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const first = f.role === "wall" ? vAng : uAng;
    const second = f.role === "wall" ? uAng : vAng;
    const base = s.spacing ?? 1.25;
    const sp = t < 0.25 ? base * 2.2 : t < 0.45 ? base * 1.4 : base;
    pen.hatch(ring, first, sp, s.hatchW ?? LINE.hatch, INK, { inset: 0.15 });
    if (t > 0.6) pen.hatch(ring, second, base * 1.3, s.hatchW ?? LINE.hatch, INK, { inset: 0.15, phase: 0.3 });
  }
  return ring;
}

/** Visible faces of a solid, far to near. */
export function visibleFaces(cam: Cam, faces: readonly Face[]): Face[] {
  // Walls first (far to near), then roofs and tops, which always sit over them.
  const rank = (f: Face) => (f.role === "wall" ? 0 : 1);
  return faces
    .filter((f) => cam.facing(f.n, faceCenter(f)))
    .sort((a, b) => rank(a) - rank(b) || cam.depth(faceCenter(b)) - cam.depth(faceCenter(a)));
}

/** Draw a solid's visible faces, then restate its silhouette with the heavier contour pen. */
export function drawSolid(pen: Pen, cam: Cam, faces: readonly Face[], s: FaceStyle = {}, contour: number = LINE.contour): Ring {
  const rings: Ring[] = [];
  for (const f of visibleFaces(cam, faces)) rings.push(drawFace(pen, cam, f, s));
  const outline = hull(rings.flat());
  if (contour > 0 && outline.length > 2) pen.stroke(outline, contour, INK, true);
  return outline;
}

/** Screen-space ground shadow of a set of 3D points (convex hull of their footprints). */
export function castShadow(cam: Cam, pts: readonly V3[], light: V3 = SUN, groundY = 0): Ring {
  const out: Pt[] = [];
  for (const p of pts) {
    const k = (p[1] - groundY) / light[1];
    out.push(cam.p([p[0] - light[0] * k, groundY, p[2] - light[2] * k]));
    out.push(cam.p([p[0], groundY, p[2]]));
  }
  return hull(out);
}

export function allPoints(faces: readonly Face[]): V3[] {
  return faces.flatMap((f) => f.pts as V3[]);
}

export function drawShadow(pen: Pen, ring: Ring, spacing = 1.05, angle = 18): void {
  pen.hatch(ring, angle, spacing, LINE.hatch, INK);
}

/* ---------------------------------------------------------- painter */

export class Painter {
  private items: Array<{ z: number; draw: (pen: Pen) => void }> = [];
  add(z: number, draw: (pen: Pen) => void): void {
    this.items.push({ z, draw });
  }
  render(pen: Pen): void {
    this.items.sort((a, b) => b.z - a.z);
    for (const it of this.items) it.draw(pen);
    this.items = [];
  }
}

/* ------------------------------------------------------------ figures */

export type Pose = "stand" | "walk" | "arm" | "sign" | "both" | "phone" | "sit" | "back" | "headset" | "carry" | "reach" | "podium";

export interface FigureOptions {
  pose?: Pose;
  /** Facing: 1 to the right, -1 to the left. */
  dir?: 1 | -1;
  style?: "solid" | "outline";
  coat?: boolean;
  /** Width multiplier for build. */
  build?: number;
  /** Paper halo so overlapping crowd figures stay legible. */
  halo?: number;
  color?: string;
  /** Placard fill (paper default); pigment for a single accented sign. */
  signFill?: string;
  phase?: number;
}

/**
 * A human figure of screen height h standing at (x, y). Architectural
 * entourage proportions: head 1/8, shoulders at 0.82, hips at 0.5.
 */
export function figure(pen: Pen, x: number, y: number, h: number, o: FigureOptions = {}): void {
  if (h < 7 && (o.style ?? "solid") === "solid" && o.pose !== "sign") {
    // Distant figure: a single mark (head, body, a split for the legs).
    const dir = o.dir ?? 1;
    const f = (u: number) => (x + u * h * dir).toFixed(1);
    const g = (v: number) => (y + v * h).toFixed(1);
    const arms = o.pose === "arm" || o.pose === "both" || o.pose === "phone";
    const d =
      `M${f(-0.13)} ${g(-0.8)}L${f(0.13)} ${g(-0.8)}L${f(0.11)} ${g(0)}L${f(0.02)} ${g(0)}L${f(0)} ${g(-0.4)}L${f(-0.02)} ${g(0)}L${f(-0.11)} ${g(0)}Z` +
      `M${f(-0.07)} ${g(-0.92)}a${(0.07 * h).toFixed(1)} ${(0.07 * h).toFixed(1)} 0 1 0 ${(0.14 * h * dir).toFixed(1)} 0a${(0.07 * h).toFixed(1)} ${(0.07 * h).toFixed(1)} 0 1 0 ${(-0.14 * h * dir).toFixed(1)} 0Z` +
      (arms ? `M${f(0.08)} ${g(-0.78)}L${f(0.2)} ${g(-1.12)}L${f(0.14)} ${g(-1.12)}L${f(0.04)} ${g(-0.78)}Z` : "");
    pen.path(d, o.halo ? { fill: o.color ?? INK, stroke: PAPER, w: o.halo, join: "round", order: "stroke" } : { fill: o.color ?? INK });
    if (o.pose === "headset") pen.line(x - 0.06 * h, y - 0.92 * h, x + 0.07 * h, y - 0.92 * h, Math.max(0.3, h * 0.04), PAPER, "butt");
    return;
  }
  const pose = o.pose ?? "stand";
  const dir = o.dir ?? 1;
  const b = o.build ?? 1;
  const color = o.color ?? INK;
  const P = (px: number, py: number): Pt => [x + px * h * dir, y + py * h];
  const headR = 0.066;
  const headY = -0.915;
  const sh = 0.125 * b;
  const hip = 0.095 * b;
  const shoulderY = -0.8;
  const hipY = pose === "sit" ? -0.36 : -0.47;
  const coat = o.coat ? 0.2 : 0;
  // Torso (and coat skirt).
  const torso: Pt[] = [
    P(-sh, shoulderY + 0.02),
    P(-sh * 0.55, shoulderY - 0.025),
    P(sh * 0.55, shoulderY - 0.025),
    P(sh, shoulderY + 0.02),
    P(hip + coat * 0.3, hipY + coat),
    P(-hip - coat * 0.3, hipY + coat),
  ];
  const parts: Pt[][] = [torso];
  // Legs.
  const leg = (fromX: number, toX: number, toY = 0, w = 0.058) => {
    parts.push([P(fromX - w, hipY), P(fromX + w, hipY), P(toX + w * 0.72, toY), P(toX - w * 0.72, toY)]);
  };
  if (pose === "walk") {
    leg(-0.04, -0.13);
    leg(0.04, 0.14);
  } else if (pose === "sit") {
    parts.push([P(-0.08, hipY - 0.02), P(0.2, hipY - 0.02), P(0.2, hipY + 0.07), P(-0.08, hipY + 0.07)]);
    leg(0.17, 0.17, 0, 0.05);
  } else {
    leg(-0.045, -0.055);
    leg(0.045, 0.06);
  }
  // Arms: [shoulder -> hand].
  const arm = (side: number, hx: number, hy: number, w = 0.036) => {
    const s = P(side * (sh - 0.02), shoulderY + 0.02);
    const e = P(hx, hy);
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * w * h;
    const ny = (dx / l) * w * h;
    parts.push([
      [s[0] + nx, s[1] + ny],
      [e[0] + nx * 0.7, e[1] + ny * 0.7],
      [e[0] - nx * 0.7, e[1] - ny * 0.7],
      [s[0] - nx, s[1] - ny],
    ]);
  };
  let sign: Ring | null = null;
  switch (pose) {
    case "arm":
      arm(-1, -0.15, -0.46);
      arm(1, 0.2, -1.14);
      break;
    case "both":
      arm(-1, -0.2, -1.14);
      arm(1, 0.2, -1.14);
      break;
    case "sign": {
      arm(-1, -0.07, -1.12);
      arm(1, 0.07, -1.12);
      const sw = 0.32 + (o.phase ?? 0) * 0.06;
      sign = [P(-sw / 2, -1.44), P(sw / 2, -1.44), P(sw / 2, -1.15), P(-sw / 2, -1.15)];
      parts.push([P(-0.012, -1.16), P(0.012, -1.16), P(0.012, -0.9), P(-0.012, -0.9)]);
      break;
    }
    case "phone":
      arm(-1, -0.15, -0.46);
      arm(1, 0.14, -1.08);
      parts.push([P(0.1, -1.19), P(0.19, -1.19), P(0.19, -1.06), P(0.1, -1.06)]);
      break;
    case "reach":
      arm(-1, -0.15, -0.47);
      arm(1, 0.36, -0.7);
      break;
    case "podium":
      arm(-1, -0.2, -0.62);
      arm(1, 0.2, -0.62);
      break;
    case "carry":
      arm(-1, -0.16, -0.5);
      arm(1, 0.17, -0.52);
      parts.push([P(0.12, -0.56), P(0.27, -0.56), P(0.27, -0.36), P(0.12, -0.36)]);
      break;
    case "sit":
      arm(-1, 0.1, -0.44);
      arm(1, 0.16, -0.44);
      break;
    default:
      arm(-1, -0.15, -0.47);
      arm(1, 0.15, -0.47);
  }
  const d = parts.map((p) => poly(p)).join("") + circleD(P(0, headY)[0], P(0, headY)[1], headR * h);
  if (o.halo && (o.style ?? "solid") !== "solid") pen.path(d, { fill: "none", stroke: PAPER, w: o.halo, join: "round" });
  if ((o.style ?? "solid") === "solid") {
    // The paper halo is the stroke painted under the fill: one element per figure.
    pen.path(d, o.halo ? { fill: color, stroke: PAPER, w: o.halo, join: "round", order: "stroke" } : { fill: color });
    if (pose === "headset") {
      // A headset: a paper visor band across the face, a strap over the crown.
      const hc = P(0.018, headY - 0.004);
      pen.path(rectD(hc[0] - 0.062 * h, hc[1] - 0.022 * h, 0.124 * h, 0.044 * h), { fill: PAPER });
    }
  } else {
    pen.path(d, { fill: PAPER, stroke: color, w: LINE.detail });
    // Shadow side: hatch everything right of the figure's axis.
    const rings = parts.map((p) => clipHalf(p, [x + 0.02 * h, y + 1], [x + 0.02 * h, y - 2 * h]));
    for (const r of rings) if (r.length > 2) pen.hatch(r, 70, Math.max(0.6, h * 0.035), LINE.hatch * 0.9);
  }
  if (sign) {
    pen.shape(sign, o.signFill ?? PAPER, INK, Math.max(0.35, h * 0.014));
    if (!o.signFill || o.signFill === PAPER) {
      const s0 = sign[0]!;
      const s2 = sign[2]!;
      const lines: Array<[Pt, Pt]> = [];
      const rows = h > 14 ? 2 : 1;
      for (let i = 0; i < rows; i++) {
        const ty = lerp(s0[1], s2[1], (i + 1) / (rows + 1));
        lines.push([
          [lerp(s0[0], s2[0], 0.2), ty],
          [lerp(s0[0], s2[0], 0.8 - i * 0.18), ty],
        ]);
      }
      pen.segs(lines, Math.max(0.35, h * 0.022));
    }
  }
}

function circleD(cx: number, cy: number, r: number): string {
  return `M${(cx - r).toFixed(2)} ${cy.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`;
}
function rectD(x: number, y: number, w: number, h: number): string {
  return `M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}Z`;
}

/** A crowd along a band of the ground, sorted back to front. */
export function crowd(
  pen: Pen,
  cam: Cam,
  rng: Rng,
  o: { count: number; x0: number; x1: number; z0: number; z1: number; poses?: readonly Pose[]; accent?: string; accentEvery?: number; heights?: [number, number]; style?: "solid" | "outline"; dir?: 1 | -1 },
): void {
  const people: Array<{ p: V3; pose: Pose; dir: 1 | -1; ht: number; accent: boolean; ph: number }> = [];
  for (let i = 0; i < o.count; i++) {
    const p: V3 = [rng.range(o.x0, o.x1), 0, rng.range(o.z0, o.z1)];
    people.push({
      p,
      pose: o.poses ? rng.pick(o.poses) : "stand",
      dir: o.dir ?? (rng.chance(0.5) ? 1 : -1),
      ht: rng.range(o.heights?.[0] ?? 1.62, o.heights?.[1] ?? 1.86),
      accent: !!o.accent && i % (o.accentEvery ?? 9) === 4,
      ph: rng.next(),
    });
  }
  people.sort((a, b) => cam.depth(b.p) - cam.depth(a.p));
  for (const q of people) {
    const [sx, sy] = cam.p(q.p);
    const h = q.ht * cam.scale(q.p);
    figure(pen, sx, sy, h, { pose: q.pose, dir: q.dir, halo: Math.max(0.5, h * 0.05), style: o.style, signFill: q.accent ? o.accent : undefined, phase: q.ph });
  }
}

/* -------------------------------------------------------------- trees */

export type TreeKind = "round" | "poplar" | "conifer" | "bare" | "orchard";

export function tree(pen: Pen, x: number, y: number, h: number, rng: Rng, kind: TreeKind = "round"): void {
  if (h < 1.6) return;
  if (kind === "bare") return bareTree(pen, x, y, h, rng);
  if (h < 5) {
    // Too small for a trunk and hatching: a single mark.
    const r = kind === "poplar" ? [h * 0.16, h * 0.44] : [h * 0.32, h * 0.34];
    pen.path(`M${(x - r[0]!).toFixed(1)} ${(y - h + r[1]!).toFixed(1)}a${r[0]!.toFixed(1)} ${r[1]!.toFixed(1)} 0 1 0 ${(2 * r[0]!).toFixed(1)} 0a${r[0]!.toFixed(1)} ${r[1]!.toFixed(1)} 0 1 0 ${(-2 * r[0]!).toFixed(1)} 0M${x.toFixed(1)} ${(y - h * 0.3).toFixed(1)}V${y.toFixed(1)}`, { fill: PAPER, stroke: INK, w: 0.4 });
    return;
  }
  const trunkH = kind === "conifer" ? h * 0.12 : kind === "orchard" ? h * 0.36 : h * 0.34;
  const tw = Math.max(0.5, h * (kind === "orchard" ? 0.035 : 0.045));
  pen.shape([[x - tw, y], [x + tw, y], [x + tw * 0.6, y - trunkH - h * 0.05], [x - tw * 0.6, y - trunkH - h * 0.05]], PAPER, INK, LINE.detail);
  pen.hatch([[x, y], [x + tw, y], [x + tw * 0.6, y - trunkH], [x, y - trunkH]], 90, 0.7, LINE.hatch);
  let ring: Ring;
  if (kind === "conifer") {
    const pts: Pt[] = [];
    const tiers = 5;
    const top = y - h;
    const base = y - trunkH;
    pts.push([x, top]);
    for (let i = 1; i <= tiers; i++) {
      const ty = lerp(top, base, i / tiers);
      const hw = h * 0.2 * (i / tiers) + h * 0.03;
      pts.push([x + hw, ty], [x + hw * 0.45, ty - h * 0.02]);
    }
    const right = pts.slice(1);
    const left = right.map(([px, py]) => [2 * x - px, py] as Pt).reverse();
    ring = [pts[0]!, ...right, ...left];
    pen.shape(ring, PAPER, INK, LINE.detail);
  } else {
    const rx = kind === "poplar" ? h * 0.16 : kind === "orchard" ? h * 0.36 : h * 0.34;
    const ry = kind === "poplar" ? h * 0.44 : kind === "orchard" ? h * 0.3 : h * 0.36;
    const cy = y - h + ry;
    const pts = blobPts(x, cy, rx, ry, rng, kind === "poplar" ? 9 : 12);
    ring = smoothRing(pts, 5);
    pen.path(smooth(pts, true), { fill: PAPER, stroke: INK, w: LINE.detail });
  }
  // Shadow side: away from the sun (right), plus a band under the crown.
  const cx = x + h * 0.02;
  const half = clipHalf(ring, [cx, y + 10], [cx + h * 0.25, y - h * 2]);
  if (half.length > 2) pen.hatch(half, 62, Math.max(0.75, h * 0.045), LINE.hatch);
  if (h >= 10) {
    const under = clipHalf(ring, [x + h, y - h * 0.5], [x - h, y - h * 0.5]);
    if (under.length > 2) pen.hatch(under, -28, Math.max(0.9, h * 0.06), LINE.hatch, INK, { phase: 0.2 });
  }
}

function blobPts(cx: number, cy: number, rx: number, ry: number, rng: Rng, count: number): Pt[] {
  const out: Pt[] = [];
  const ph = rng.next() * 6.28;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + ph;
    const k = 1 + 0.09 * Math.sin(a * 3 + ph) + (rng.next() - 0.5) * 0.14;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

function bareTree(pen: Pen, x: number, y: number, h: number, rng: Rng): void {
  const segs: Array<[Pt, Pt, number]> = [];
  const grow = (p: Pt, ang: number, len: number, w: number, depth: number) => {
    const q: Pt = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
    segs.push([p, q, w]);
    if (depth <= 0) return;
    const n = depth > 2 ? 2 : rng.int(1, 2);
    for (let i = 0; i < n + 1; i++) {
      const spread = rng.range(0.25, 0.6) * (i % 2 ? 1 : -1);
      grow(q, ang + spread, len * rng.range(0.58, 0.76), w * 0.66, depth - 1);
    }
  };
  grow([x, y], -Math.PI / 2 + rng.range(-0.08, 0.08), h * 0.38, Math.max(0.6, h * 0.05), 4);
  // Batch strokes into a few weight classes: one element each.
  const classes = new Map<number, Array<[Pt, Pt]>>();
  for (const [a, b, w] of segs) {
    const k = Math.max(0.3, Math.round(w * 4) / 4);
    if (!classes.has(k)) classes.set(k, []);
    classes.get(k)!.push([a, b]);
  }
  for (const [w, list] of classes) pen.segs(list, w);
}

/* ------------------------------------------------------------- clouds */

/** Cumulus: scalloped top, flat base, hatched underside. */
export function cloud(pen: Pen, x: number, y: number, w: number, h: number, rng: Rng, dark = 0): void {
  const bumps: Array<[number, number]> = [];
  const n = Math.max(3, Math.round(w / (h * 0.8)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const edge = Math.sin(t * Math.PI);
    bumps.push([x + t * w + rng.range(-0.1, 0.1) * (w / n), h * (0.35 + 0.65 * edge) * rng.range(0.8, 1.1)]);
  }
  const top: Pt[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const px = x + (w * i) / steps;
    let best = y;
    for (const [bx, r] of bumps) {
      const dx = px - bx;
      if (Math.abs(dx) < r) best = Math.min(best, y - Math.sqrt(r * r - dx * dx) * 0.9);
    }
    top.push([px, best]);
  }
  const ring: Ring = [...top, [x + w, y], [x, y]];
  pen.shape(ring, PAPER, INK, LINE.detail);
  const shadeBand = clipHalf(ring, [x + w + 5, y - h * (0.28 + dark * 0.5)], [x - 5, y - h * (0.28 + dark * 0.5)]);
  if (shadeBand.length > 2) pen.hatch(shadeBand, 0, dark > 0.5 ? 0.8 : 1.2, LINE.hatch);
  if (dark > 0.3) pen.hatch(ring, 60, dark > 0.7 ? 0.9 : 1.4, LINE.hatch, INK, { phase: 0.4 });
  if (dark > 0.7) pen.hatch(ring, -50, 1.1, LINE.hatch, INK, { phase: 0.7 });
}

/* -------------------------------------------------------------- smoke */

/**
 * A plume of overlapping puffs rising from (x, y). Puff outlines are drawn
 * only where they are on the outside of the plume, like an engraver's smoke.
 */
export function plume(pen: Pen, x: number, y: number, o: { height: number; drift: number; width: number; rng: Rng; dark?: number; puffs?: number }): void {
  // Walk up the plume, stepping by a fraction of the local puff radius so
  // neighbouring puffs always overlap into one body.
  const puffs: Array<[number, number, number]> = [];
  let t = 0;
  let guard = 0;
  while (t <= 1 && guard++ < 40) {
    const r = o.width * (0.32 + t * 0.8) * o.rng.range(0.88, 1.12);
    puffs.push([x + o.drift * t * t + o.rng.range(-0.25, 0.25) * r, y - o.height * t - r * 0.35, r]);
    t += (r * 0.62) / Math.max(1, o.height);
  }
  // Paper fill of the union.
  for (const [cx, cy, r] of puffs) pen.circle(cx, cy, r, { fill: PAPER });
  // Visible arcs.
  let d = "";
  for (let i = 0; i < puffs.length; i++) {
    const [cx, cy, r] = puffs[i]!;
    let drawing = false;
    const steps = 36;
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      const covered = puffs.some(([qx, qy, qr], j) => j !== i && (px - qx) ** 2 + (py - qy) ** 2 < (qr * 0.985) ** 2);
      if (!covered) {
        d += `${drawing ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
        drawing = true;
      } else drawing = false;
    }
  }
  pen.path(d, { stroke: INK, w: LINE.detail });
  // Shade the lee side of every puff with phase-locked hatching (reads as one union).
  const dark = o.dark ?? 0.3;
  for (const [cx, cy, r] of puffs) {
    const ring: Ring = Array.from({ length: 24 }, (_, k) => [cx + Math.cos((k / 24) * 6.283) * r, cy + Math.sin((k / 24) * 6.283) * r] as Pt);
    const lee = clipHalf(ring, [cx - r * 0.1, cy + r * 2], [cx + r * 0.9, cy - r * 2]);
    if (lee.length > 2) pen.hatch(lee, 55, dark > 0.5 ? 0.85 : 1.25, LINE.hatch, INK, { phase: 0.5 });
    if (dark > 0.5) pen.hatch(ring, -35, 1.3, LINE.hatch, INK, { phase: 0.1 });
  }
}

/* -------------------------------------------------------------- ground */

/** Horizon line and a few receding ground strokes. */
export function ground(pen: Pen, cam: Cam, o: { furrows?: number; spread?: number; x?: number; z0?: number; z1?: number; w?: number } = {}): void {
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.detail * 0.8);
  const n = o.furrows ?? 0;
  for (let i = 0; i < n; i++) {
    const x = (o.x ?? 0) + (i - (n - 1) / 2) * (o.spread ?? 6);
    const a = cam.p([x, 0, o.z0 ?? -8]);
    const b = cam.p([x, 0, o.z1 ?? -400]);
    pen.line(a[0], a[1], b[0], b[1], LINE.hatch);
  }
}

/** Water: broken horizontal strokes, denser toward the horizon. */
export function water(pen: Pen, rng: Rng, y0: number, y1: number, x0 = 0, x1 = PW): void {
  const segs: Array<[Pt, Pt]> = [];
  let y = y0 + 0.6;
  let gap = 0.9;
  while (y < y1) {
    let x = x0 + rng.range(0, 6);
    while (x < x1) {
      const len = rng.range(2.5, 9) * (0.6 + (y - y0) / Math.max(1, y1 - y0));
      if (rng.chance(0.78)) segs.push([[x, y], [Math.min(x1, x + len), y]]);
      x += len + rng.range(1, 4);
    }
    y += gap;
    gap *= 1.1;
  }
  pen.segs(segs, LINE.hatch);
}

/** Hills: a smooth silhouette with paper fill and hatched flank. */
export function hills(pen: Pen, pts: readonly Pt[], base: number, spacing = 1.6): void {
  const ring: Ring = [...pts, [pts[pts.length - 1]![0], base], [pts[0]![0], base]];
  pen.fill(ring, PAPER);
  pen.path(smooth(pts, false), { stroke: INK, w: LINE.detail });
  pen.hatch(ring, 20, spacing, LINE.hatch, INK, { jitter: 0.8 });
}

export const tone01 = (v: number) => clamp(v);

/* ---------------------------------------------------------- cylinders */

/** Vertical cylinder: silhouette, visible rim arcs, lee-side hatching. */
export function cylinder(pen: Pen, cam: Cam, c: V3, r: number, y0: number, y1: number, o: { tone?: number; w?: number; topVisible?: boolean } = {}): Ring {
  const n = 40;
  const ring = (y: number) => Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [c[0] + Math.cos(a) * r, y, c[2] + Math.sin(a) * r] as V3;
  });
  const bottom = ring(y0).map((p) => cam.p(p));
  const top = ring(y1).map((p) => cam.p(p));
  const all = [...bottom, ...top];
  const outline = hull(all);
  pen.shape(outline, PAPER, INK, o.w ?? LINE.edge);
  // Lee side hatch: right 45% of the silhouette.
  let minX = Infinity,
    maxX = -Infinity;
  for (const p of all) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
  }
  const t = o.tone ?? 0.4;
  if (t > 0) {
    const cut = lerp(minX, maxX, 0.55);
    const lee = clipHalf(outline, [cut, 1e4], [cut, -1e4]);
    if (lee.length > 2) pen.hatch(lee, 90, t > 0.5 ? 0.8 : 1.1, LINE.hatch);
    if (t > 0.5) {
      const deep = clipHalf(outline, [lerp(minX, maxX, 0.8), 1e4], [lerp(minX, maxX, 0.8), -1e4]);
      if (deep.length > 2) pen.hatch(deep, 90, 0.8, LINE.hatch, INK, { phase: 0 });
    }
  }
  const eyeAbove = cam.eye[1] > y1;
  if (eyeAbove || o.topVisible) pen.stroke(top, LINE.detail, INK, true);
  else {
    // Only the near half of the top rim shows.
    const near = ring(y1).filter((p) => cam.facing([p[0] - c[0], 0, p[2] - c[2]], p)).map((p) => cam.p(p));
    near.sort((a, b) => a[0] - b[0]);
    pen.stroke(near, LINE.detail);
  }
  const nearB = ring(y0).filter((p) => cam.facing([p[0] - c[0], 0, p[2] - c[2]], p)).map((p) => cam.p(p));
  nearB.sort((a, b) => a[0] - b[0]);
  pen.stroke(nearB, LINE.detail);
  return outline;
}

/** Hemispherical dome on a base circle at height y, with ribs. */
export function dome(pen: Pen, cam: Cam, c: V3, r: number, y: number, ribs = 10): Ring {
  const pts: Pt[] = [];
  const rows = 10;
  for (let i = 0; i <= rows; i++) {
    const phi = (i / rows) * (Math.PI / 2);
    const rr = r * Math.cos(phi);
    const yy = y + r * Math.sin(phi);
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      pts.push(cam.p([c[0] + Math.cos(a) * rr, yy, c[2] + Math.sin(a) * rr]));
    }
  }
  const outline = hull(pts);
  pen.shape(outline, PAPER, INK, LINE.edge);
  // Ribs: meridians on the side facing the camera.
  const segs: Array<[Pt, Pt]> = [];
  for (let k = 0; k < ribs * 2; k++) {
    const a = (k / (ribs * 2)) * Math.PI * 2;
    const base: V3 = [c[0] + Math.cos(a) * r, y, c[2] + Math.sin(a) * r];
    if (!cam.facing([Math.cos(a), 0.3, Math.sin(a)], base)) continue;
    let prev = cam.p(base);
    for (let i = 1; i <= rows; i++) {
      const phi = (i / rows) * (Math.PI / 2);
      const q = cam.p([c[0] + Math.cos(a) * r * Math.cos(phi), y + r * Math.sin(phi), c[2] + Math.sin(a) * r * Math.cos(phi)]);
      segs.push([prev, q]);
      prev = q;
    }
  }
  pen.segs(segs, LINE.hatch);
  let minX = Infinity,
    maxX = -Infinity;
  for (const p of outline) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
  }
  const lee = clipHalf(outline, [lerp(minX, maxX, 0.6), 1e4], [lerp(minX, maxX, 0.6), -1e4]);
  if (lee.length > 2) pen.hatch(lee, 80, 0.95, LINE.hatch);
  return outline;
}

/** Clip a 3D face to the half-space y >= level (keeps what stands above water). */
export function clipAbove(f: Face, level: number): Face | null {
  const out: V3[] = [];
  const pts = f.pts;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const ain = a[1] >= level;
    const bin = b[1] >= level;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (level - a[1]) / (b[1] - a[1]);
      out.push(mix3(a, b, t));
    }
  }
  if (out.length < 3) return null;
  return { pts: out, n: f.n, role: f.role };
}

/* ------------------------------------------------------- dot matrix */

const DOT_FONT: Record<string, string> = {
  A: "01110100011000111111100011000110001",
  B: "11110100011000111110100011000111110",
  C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111",
  F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111",
  H: "10001100011000111111100011000110001",
  I: "01110001000010000100001000010001110",
  K: "10001100101010011000101001001010001",
  L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001",
  N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000",
  R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100",
  W: "10001100011000110101101011010101010",
  X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100",
  "0": "01110100011001110101110011000101110",
  "1": "00100011000010000100001000010001110",
  "2": "01110100010000100010001000100011111",
  "3": "11111000100010000010000011000101110",
  "4": "00010001100101010010111110001000010",
  "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110",
  "7": "11111000010001000100010000100001000",
  "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100",
  ".": "00000000000000000000000000110001100",
  "%": "11000110010001000100010001001100011",
  "-": "00000000000000011111000000000000000",
  "+": "00000001000010011111001000010000000",
  "^": "00100011101111111111000000000000000",
  v: "00000000001111111111011100010000000",
  " ": "00000000000000000000000000000000000",
};

/** Text as a 5x7 dot matrix of discs (for tickers and signboards). */
export function dotText(pen: Pen, str: string, x: number, y: number, pitch: number, color: string = INK): number {
  let d = "";
  let cx = x;
  const r = pitch * 0.36;
  for (const ch of str.toUpperCase()) {
    const key = ch === "▲" ? "^" : ch === "▼" ? "v" : ch;
    const bits = DOT_FONT[key] ?? DOT_FONT[" "]!;
    for (let i = 0; i < 35; i++) {
      if (bits[i] !== "1") continue;
      const px = cx + (i % 5) * pitch;
      const py = y + Math.floor(i / 5) * pitch;
      d += `M${(px - r).toFixed(2)} ${py.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
    }
    cx += pitch * 6;
  }
  pen.path(d, { fill: color });
  return cx - x;
}
