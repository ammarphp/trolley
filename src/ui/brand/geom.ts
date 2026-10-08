/**
 * 2D geometry for pen drawings: rings (polygons), analytic hatching, convex
 * clipping, smoothing and hulls. Hatching is computed exactly against the
 * polygon, so every stroke stops at its contour like a technical pen would,
 * and no clipPath ids are needed.
 */
import { n } from "./svg.ts";
import type { Rng } from "../../render/core/rng.ts";

export type Pt = readonly [number, number];
export type Ring = readonly Pt[];
export type Seg = readonly [Pt, Pt];

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const DEG = Math.PI / 180;

export function rect(x: number, y: number, w: number, h: number): Ring {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

export function circle(cx: number, cy: number, r: number, seg = 40): Ring {
  return ellipse(cx, cy, r, r, seg);
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, seg = 40, rot = 0): Ring {
  const out: Pt[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** Arc points from a0 to a1 (radians, SVG orientation: y down). */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, seg = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = lerp(a0, a1, i / seg);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function regular(cx: number, cy: number, r: number, sides: number, rot = -Math.PI / 2): Ring {
  const out: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function star(cx: number, cy: number, r0: number, r1: number, points: number, rot = -Math.PI / 2): Ring {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 ? r1 : r0;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function translate(ring: Ring, dx: number, dy: number): Ring {
  return ring.map(([x, y]) => [x + dx, y + dy] as Pt);
}

export function scaleRing(ring: Ring, sx: number, sy: number, ox = 0, oy = 0): Ring {
  return ring.map(([x, y]) => [ox + (x - ox) * sx, oy + (y - oy) * sy] as Pt);
}

export function rotateRing(ring: Ring, a: number, ox = 0, oy = 0): Ring {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return ring.map(([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    return [ox + dx * c - dy * s, oy + dx * s + dy * c] as Pt;
  });
}

export function bounds(rings: readonly Ring[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1 };
}

/* ---------------------------------------------------------------- paths */

export function poly(ring: Ring | readonly Pt[], close = true): string {
  if (!ring.length) return "";
  let d = `M${n(ring[0]![0])} ${n(ring[0]![1])}`;
  for (let i = 1; i < ring.length; i++) d += `L${n(ring[i]![0])} ${n(ring[i]![1])}`;
  return close ? d + "Z" : d;
}

export function polys(rings: readonly Ring[]): string {
  return rings.map((r) => poly(r, true)).join("");
}

/** Catmull-Rom spline through points as cubic Béziers. */
export function smooth(points: readonly Pt[], close = false, tension = 1): string {
  const p = points;
  const len = p.length;
  if (len < 3) return poly(p, close);
  const get = (i: number): Pt => (close ? p[(i + len) % len]! : p[Math.max(0, Math.min(len - 1, i))]!);
  let d = `M${n(p[0]![0])} ${n(p[0]![1])}`;
  const last = close ? len : len - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const k = tension / 6;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return close ? d + "Z" : d;
}

/** Sample a closed smooth curve as a ring (for hatching organic shapes). */
export function smoothRing(points: readonly Pt[], per = 6): Ring {
  const len = points.length;
  const out: Pt[] = [];
  for (let i = 0; i < len; i++) {
    const p0 = points[(i - 1 + len) % len]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % len]!;
    const p3 = points[(i + 2) % len]!;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

export function segs(list: readonly Seg[]): string {
  let d = "";
  for (const [a, b] of list) d += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
  return d;
}

/* ------------------------------------------------------------- hatching */

export interface HatchOptions {
  /** Phase offset of the first line, in units of spacing (0..1). */
  phase?: number;
  /** Variable spacing: called with t in 0..1 across the hatch direction. */
  spacingAt?: (t: number) => number;
  /** Shorten each stroke end randomly by up to this much (pen lift). */
  jitter?: number;
  rng?: Rng;
  /** Inset from the contour at each end (keeps a hair of white by the line). */
  inset?: number;
  /** Drop strokes shorter than this. */
  minLength?: number;
  /** Break long strokes into dashes: [dash, gap]. */
  dash?: readonly [number, number];
}

/**
 * Parallel strokes at `angle` degrees (0 = horizontal, 90 = vertical),
 * `spacing` apart, clipped exactly to the even-odd union of `rings`.
 */
export function hatch(rings: readonly Ring[], angle: number, spacing: number, o: HatchOptions = {}): Seg[] {
  const a = angle * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Rotate so hatch lines become horizontal: u along the line, v across it.
  const rot = rings.map((r) => r.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca] as Pt));
  let v0 = Infinity,
    v1 = -Infinity;
  for (const r of rot)
    for (const p of r) {
      if (p[1] < v0) v0 = p[1];
      if (p[1] > v1) v1 = p[1];
    }
  if (!Number.isFinite(v0) || spacing <= 0) return [];
  const out: Seg[] = [];
  const phase = o.phase ?? 0.5;
  const inset = o.inset ?? 0;
  const minLength = o.minLength ?? 0.25;
  const span = Math.max(1e-6, v1 - v0);
  let v = o.spacingAt ? v0 + o.spacingAt(0) * phase : Math.ceil((v0 - phase * spacing) / spacing) * spacing + phase * spacing;
  if (!o.spacingAt && v < v0) v += spacing;
  let guard = 0;
  while (v < v1 && guard++ < 4000) {
    const xs: number[] = [];
    for (const r of rot) {
      for (let i = 0; i < r.length; i++) {
        const p = r[i]!;
        const q = r[(i + 1) % r.length]!;
        if ((p[1] <= v && q[1] > v) || (q[1] <= v && p[1] > v)) {
          xs.push(p[0] + ((v - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
        }
      }
    }
    xs.sort((m, k) => m - k);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      let u0 = xs[i]! + inset;
      let u1 = xs[i + 1]! - inset;
      if (o.jitter && o.rng) {
        u0 += o.rng.next() * o.jitter;
        u1 -= o.rng.next() * o.jitter;
      }
      if (u1 - u0 < minLength) continue;
      const back = (u: number): Pt => [u * ca - v * sa, u * sa + v * ca];
      if (o.dash) {
        const [dl, gl] = o.dash;
        let u = u0 + (o.rng ? o.rng.next() * gl : 0);
        while (u < u1) {
          const e = Math.min(u1, u + dl);
          if (e - u > minLength) out.push([back(u), back(e)]);
          u = e + gl;
        }
      } else out.push([back(u0), back(u1)]);
    }
    v += o.spacingAt ? Math.max(0.2, o.spacingAt(clamp((v - v0) / span))) : spacing;
  }
  return out;
}

/** Sutherland–Hodgman: clip `subject` by a convex `clip` ring. */
export function clipConvex(subject: Ring, clip: Ring): Ring {
  let out: Pt[] = subject.slice();
  // Orientation of the clip ring.
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i]!;
    const q = clip[(i + 1) % clip.length]!;
    area += p[0] * q[1] - q[0] * p[1];
  }
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const inside = (p: Pt) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]!;
      const prev = input[(j - 1 + input.length) % input.length]!;
      const ci = inside(cur);
      const pi = inside(prev);
      if (ci) {
        if (!pi) out.push(intersect(prev, cur, a, b));
        out.push(cur);
      } else if (pi) out.push(intersect(prev, cur, a, b));
    }
  }
  return out;
}

/** Keep the part of `ring` on the side of line a→b where cross >= 0 (left in y-down). */
export function clipHalf(ring: Ring, a: Pt, b: Pt): Ring {
  const out: Pt[] = [];
  const side = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let j = 0; j < ring.length; j++) {
    const cur = ring[j]!;
    const prev = ring[(j - 1 + ring.length) % ring.length]!;
    const ci = side(cur) >= 0;
    const pi = side(prev) >= 0;
    if (ci) {
      if (!pi) out.push(intersect(prev, cur, a, b));
      out.push(cur);
    } else if (pi) out.push(intersect(prev, cur, a, b));
  }
  return out;
}

export function intersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt {
  const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
  if (Math.abs(d) < 1e-9) return p2;
  const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d;
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}

/** Andrew's monotone chain convex hull. */
export function hull(points: readonly Pt[]): Ring {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Organic blob: a circle whose radius wobbles with seeded harmonics. */
export function blob(cx: number, cy: number, rx: number, ry: number, rng: Rng, wobble = 0.12, count = 11): Pt[] {
  const out: Pt[] = [];
  const ph = rng.next() * 6.28;
  const h2 = rng.range(0.4, 1);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + ph;
    const k = 1 + wobble * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + h2 * 4) * 0.3 + (rng.next() - 0.5) * 0.9);
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}
