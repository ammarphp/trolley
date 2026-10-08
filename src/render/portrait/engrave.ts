/**
 * Engraving: turns shaded surface grids into pen strokes.
 *
 * Hatch lines are straight lines in each grid's (screen-normalised)
 * parameter space, so on the surface they wrap the form like a burin line.
 * Their width swells with tone; below a family's threshold the line lifts
 * off the paper, above it the line thickens until neighbours merge. Every
 * sample is tested against the depth buffer, so strokes stop exactly where a
 * nearer form covers them. Contours are the zero set of N·V (silhouettes)
 * plus chosen parameter boundaries (cap edges, collar edges).
 */
import { clamp, vnoise1 } from "./math.ts";
import type { DepthBuffer, Grid } from "./raster.ts";

export interface HatchFamily {
  /** Line direction in normalised parameter space (0 = constant u, π/2 = constant v). */
  angle: number;
  /** Line spacing in pixels (approximate, on screen). */
  spacing: number;
  /** Tone at which the line appears / reaches full width. */
  t0: number;
  t1: number;
  /** Maximum stroke width in px. */
  maxW: number;
  gamma?: number;
  phase?: number;
  /** Perpendicular wobble in px. */
  wobble?: number;
  /** Minimum width drawn; below this the pen lifts. */
  minW?: number;
  /** Seed for per-line variation. */
  seed?: number;
  /**
   * Engraver's dashes: in light halftones the line breaks into short dashes
   * (staggered line to line, giving the dot-and-lozenge texture) and joins
   * up as the tone deepens. `period` px; continuous above `solid` tone.
   */
  dash?: { period: number; solid: number };
}

export interface HatchOptions {
  /** Depth tolerance (cm) for visibility. */
  tol?: number;
  /** Added to tone before the ramp. */
  toneBias?: number;
  /** Optional per-sample tone override/modifier. */
  toneFn?: (tone: number, sx: number, sy: number, fi: number, fj: number) => number;
  /** Skip samples where this returns true (e.g. inside eye openings). */
  skip?: (sx: number, sy: number, fi: number, fj: number) => boolean;
  /** Restrict to a parameter window [fi0, fi1] x [fj0, fj1]. */
  window?: [number, number, number, number];
  /** Scale widths where lines converge (grazing surfaces). */
  convergence?: boolean;
  /** Extra tone margin for the active-cell cull (when toneFn can darken). */
  margin?: number;
}

/** A sampled point on a grid. */
export interface GridSample {
  sx: number;
  sy: number;
  sz: number;
  tone: number;
  lit: number;
  facing: number;
  ok: boolean;
}

const S: GridSample = { sx: 0, sy: 0, sz: 0, tone: 0, lit: 0, facing: 0, ok: false };

/** Bilinear sample at fractional grid indices. Returns a shared object. */
export function sampleGrid(g: Grid, fi: number, fj: number): GridSample {
  const { nu, nv } = g;
  if (g.wrapU) fi = ((fi % nu) + nu) % nu;
  if (fi < 0 || fj < 0 || fj > nv - 1 || (!g.wrapU && fi > nu - 1)) {
    S.ok = false;
    return S;
  }
  let i0 = Math.floor(fi),
    j0 = Math.floor(fj);
  if (j0 >= nv - 1) j0 = nv - 2;
  if (!g.wrapU && i0 >= nu - 1) i0 = nu - 2;
  const i1 = g.wrapU ? (i0 + 1) % nu : i0 + 1;
  const tu = fi - i0,
    tv = fj - j0;
  const a = j0 * nu + i0,
    b = j0 * nu + i1,
    c = (j0 + 1) * nu + i1,
    d = (j0 + 1) * nu + i0;
  if (!g.valid[a] || !g.valid[b] || !g.valid[c] || !g.valid[d]) {
    S.ok = false;
    return S;
  }
  const wa = (1 - tu) * (1 - tv),
    wb = tu * (1 - tv),
    wc = tu * tv,
    wd = (1 - tu) * tv;
  S.sx = g.sx[a]! * wa + g.sx[b]! * wb + g.sx[c]! * wc + g.sx[d]! * wd;
  S.sy = g.sy[a]! * wa + g.sy[b]! * wb + g.sy[c]! * wc + g.sy[d]! * wd;
  S.sz = g.sz[a]! * wa + g.sz[b]! * wb + g.sz[c]! * wc + g.sz[d]! * wd;
  S.tone = g.tone[a]! * wa + g.tone[b]! * wb + g.tone[c]! * wc + g.tone[d]! * wd;
  S.lit = g.lit[a]! * wa + g.lit[b]! * wb + g.lit[c]! * wc + g.lit[d]! * wd;
  S.facing = g.facing[a]! * wa + g.facing[b]! * wb + g.facing[c]! * wc + g.facing[d]! * wd;
  S.ok = true;
  return S;
}

/** Average screen length of one grid step along u and v, over visible vertices. */
export function gridMetric(g: Grid): { lu: number; lv: number } {
  let su = 0,
    sv = 0,
    n = 0;
  const { nu, nv } = g;
  for (let j = 0; j < nv - 1; j += 2)
    for (let i = 0; i < nu - 1; i += 2) {
      const k = j * nu + i;
      if (!g.valid[k] || (!g.twoSided && g.facing[k]! < 0.15)) continue;
      const ku = k + 1,
        kv = k + nu;
      su += Math.hypot(g.sx[ku]! - g.sx[k]!, g.sy[ku]! - g.sy[k]!);
      sv += Math.hypot(g.sx[kv]! - g.sx[k]!, g.sy[kv]! - g.sy[k]!);
      n++;
    }
  if (!n) return { lu: 1, lv: 1 };
  return { lu: Math.max(0.05, su / n), lv: Math.max(0.05, sv / n) };
}

/** Accumulates filled ribbons (variable-width strokes) into one Path2D. */
export class Ribbons {
  readonly path = new Path2D();
  count = 0;
  private xs: number[] = [];
  private ys: number[] = [];
  private ws: number[] = [];
  private bufL: number[] = [];
  private bufR: number[] = [];

  begin(): void {
    this.xs.length = 0;
    this.ys.length = 0;
    this.ws.length = 0;
  }
  push(x: number, y: number, w: number): void {
    const n = this.xs.length;
    if (n > 0) {
      const dx = x - this.xs[n - 1]!,
        dy = y - this.ys[n - 1]!;
      if (dx * dx + dy * dy < 0.25) return;
    }
    this.xs.push(x);
    this.ys.push(y);
    this.ws.push(w);
  }
  get length(): number {
    return this.xs.length;
  }
  /** Close the current run into a filled ribbon. */
  end(taper = 0.6): void {
    const n = this.xs.length;
    if (n === 0) return;
    if (n < 2) {
      if (n === 1 && this.ws[0]! > 0.9) {
        const r = this.ws[0]! * 0.5;
        this.path.moveTo(this.xs[0]! + r, this.ys[0]!);
        this.path.arc(this.xs[0]!, this.ys[0]!, r, 0, Math.PI * 2);
        this.count++;
      }
      this.begin();
      return;
    }
    // Decimate: keep points where the stroke turns or swells, and at least
    // every few pixels. Path2D vertices are the expensive part.
    const xs = this.xs,
      ys = this.ys,
      ws = this.ws;
    const keep: number[] = [0];
    let last = 0;
    for (let i = 1; i < n - 1; i++) {
      const dx = xs[i]! - xs[last]!,
        dy = ys[i]! - ys[last]!;
      const d2 = dx * dx + dy * dy;
      const ex = xs[i + 1]! - xs[i]!,
        ey = ys[i + 1]! - ys[i]!;
      const cr = Math.abs(dx * ey - dy * ex) / (Math.sqrt(d2 * (ex * ex + ey * ey)) + 1e-6);
      if (d2 > 49 || cr > 0.05 || Math.abs(ws[i]! - ws[last]!) > 0.22) {
        keep.push(i);
        last = i;
      }
    }
    keep.push(n - 1);
    const m = keep.length;
    const L = this.bufL,
      R = this.bufR;
    for (let q = 0; q < m; q++) {
      const i = keep[q]!;
      const i0 = keep[Math.max(0, q - 1)]!,
        i1 = keep[Math.min(m - 1, q + 1)]!;
      let tx = xs[i1]! - xs[i0]!,
        ty = ys[i1]! - ys[i0]!;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      let w = ws[i]! * 0.5;
      if (q === 0 || q === m - 1) w *= taper;
      L[q * 2] = xs[i]! - ty * w;
      L[q * 2 + 1] = ys[i]! + tx * w;
      R[q * 2] = xs[i]! + ty * w;
      R[q * 2 + 1] = ys[i]! - tx * w;
    }
    const p = this.path;
    p.moveTo(L[0]!, L[1]!);
    for (let q = 1; q < m; q++) p.lineTo(L[q * 2]!, L[q * 2 + 1]!);
    for (let q = m - 1; q >= 0; q--) p.lineTo(R[q * 2]!, R[q * 2 + 1]!);
    p.closePath();
    this.count++;
    this.begin();
  }
}

/**
 * Cells where a family could draw: valid, facing the camera (unless
 * two-sided), and dark enough at some corner. Returns the mask and the
 * bounding window of active cells.
 */
function activeCells(g: Grid, t0: number, bias: number): { mask: Uint8Array; win: [number, number, number, number] } | null {
  const { nu, nv } = g;
  const cols = g.wrapU ? nu : nu - 1;
  const mask = new Uint8Array(nu * nv);
  let i0 = Infinity,
    i1 = -Infinity,
    j0 = Infinity,
    j1 = -Infinity;
  for (let j = 0; j < nv - 1; j++)
    for (let i = 0; i < cols; i++) {
      const ii = (i + 1) % nu;
      const a = j * nu + i,
        b = j * nu + ii,
        c = (j + 1) * nu + ii,
        d = (j + 1) * nu + i;
      if (!g.valid[a] || !g.valid[b] || !g.valid[c] || !g.valid[d]) continue;
      if (!g.twoSided && g.facing[a]! < 0 && g.facing[b]! < 0 && g.facing[c]! < 0 && g.facing[d]! < 0) continue;
      const tm = Math.max(g.tone[a]!, g.tone[b]!, g.tone[c]!, g.tone[d]!) + bias;
      if (tm < t0 - 0.02) continue;
      mask[a] = 1;
      if (i < i0) i0 = i;
      if (i + 1 > i1) i1 = i + 1;
      if (j < j0) j0 = j;
      if (j + 1 > j1) j1 = j + 1;
    }
  if (i1 < i0) return null;
  return { mask, win: [i0, i1, j0, j1] };
}

/** Hatch one family over a grid. */
export function hatchGrid(g: Grid, fam: HatchFamily, zbuf: DepthBuffer, out: Ribbons, o: HatchOptions = {}): void {
  const gen = hatchGridSteps(g, fam, zbuf, out, o, 1 << 30);
  while (!gen.next().done);
}

/** Hatch one family, yielding every `linesPerYield` lines. */
export function* hatchGridSteps(g: Grid, fam: HatchFamily, zbuf: DepthBuffer, out: Ribbons, o: HatchOptions = {}, linesPerYield = 18): Generator<void, void> {
  const act = activeCells(g, fam.t0, (o.toneBias ?? 0) + (o.margin ?? 0.04));
  if (!act) return;
  const mask = act.mask;
  const { lu, lv } = gridMetric(g);
  const ca = Math.cos(fam.angle),
    sa = Math.sin(fam.angle);
  const [wi0, wi1, wj0, wj1] = act.win;
  const Umin = wi0 * lu,
    Umax = wi1 * lu;
  const Vmin = wj0 * lv,
    Vmax = wj1 * lv;
  // Range of c = U cos a + V sin a over the window corners.
  const cs = [Umin * ca + Vmin * sa, Umax * ca + Vmin * sa, Umin * ca + Vmax * sa, Umax * ca + Vmax * sa];
  const cMin = Math.min(...cs),
    cMax = Math.max(...cs);
  const dU = -sa,
    dV = ca; // along-line direction
  const tol = o.tol ?? 0.35;
  const bias = o.toneBias ?? 0;
  const minW = fam.minW ?? 0.3;
  const gamma = fam.gamma ?? 1;
  const phase = fam.phase ?? 0;
  const wob = fam.wobble ?? 0;
  const seed = fam.seed ?? 1;
  const win = o.window;
  const step = 1.5;
  let lineIdx = 0;
  for (let c = cMin + (((phase % fam.spacing) + fam.spacing) % fam.spacing); c <= cMax; c += fam.spacing, lineIdx++) {
    if (lineIdx % linesPerYield === linesPerYield - 1) yield;
    // Base point on the line and s-range inside the rectangle.
    const bx = c * ca,
      by = c * sa;
    let s0 = -Infinity,
      s1 = Infinity;
    const clip = (p: number, d: number, lo: number, hi: number) => {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) {
          s0 = 1;
          s1 = 0;
        }
        return;
      }
      let a = (lo - p) / d,
        b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      s0 = Math.max(s0, a);
      s1 = Math.min(s1, b);
    };
    clip(bx, dU, Umin, Umax);
    clip(by, dV, Vmin, Vmax);
    if (!(s1 > s0)) continue;
    const lineSeed = seed * 131 + lineIdx * 17.3;
    const breathe = 0.85 + 0.3 * ((Math.sin(lineIdx * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
    out.begin();
    for (let s = s0; s <= s1; s += step) {
      const U = bx + dU * s,
        V = by + dV * s;
      const fi = U / lu,
        fj = V / lv;
      if (win && (fi < win[0] || fi > win[1] || fj < win[2] || fj > win[3])) {
        out.end();
        continue;
      }
      const ci = Math.min(g.nu - 1, Math.max(0, Math.floor(fi))),
        cj = Math.min(g.nv - 1, Math.max(0, Math.floor(fj)));
      if (!mask[cj * g.nu + ci]) {
        out.end();
        continue;
      }
      const smp = sampleGrid(g, fi, fj);
      if (!smp.ok || (!g.twoSided && smp.facing < 0.0)) {
        out.end();
        continue;
      }
      const zb = zbuf.at(smp.sx, smp.sy);
      if (smp.sz > zb + tol) {
        out.end();
        continue;
      }
      if (o.skip && o.skip(smp.sx, smp.sy, fi, fj)) {
        out.end();
        continue;
      }
      let tone = smp.tone + bias;
      if (o.toneFn) tone = o.toneFn(tone, smp.sx, smp.sy, fi, fj);
      let w = clamp((tone - fam.t0) / (fam.t1 - fam.t0));
      if (gamma !== 1) w = Math.pow(w, gamma);
      w *= fam.maxW * breathe * (1 + 0.14 * vnoise1(s * 0.06, lineSeed));
      if (o.convergence !== false && !g.twoSided) w *= 0.45 + 0.55 * clamp(smp.facing * 3);
      if (fam.dash) {
        const duty = clamp((tone - fam.t0) / Math.max(0.01, fam.dash.solid - fam.t0));
        if (duty < 1) {
          const ph = (s / fam.dash.period + (lineIdx % 2) * 0.5 + lineSeed * 0.013) % 1;
          const on = ph < 0.06 + 0.94 * duty * duty;
          if (!on) {
            out.end(0.7);
            continue;
          }
          // Dashes are a little fuller than a thinning line would be.
          w = Math.max(w, fam.maxW * (0.12 + 0.22 * duty));
        }
      }
      if (w < minW) {
        out.end();
        continue;
      }
      let x = smp.sx,
        y = smp.sy;
      if (wob) {
        const n = vnoise1(s * 0.035, lineSeed + 3) * wob;
        // Perpendicular in screen space is unknown here; nudge along y/x mix.
        x += n * 0.6;
        y += n * 0.8;
      }
      out.push(x, y, w);
    }
    out.end();
  }
}

/** Silhouette polylines (zero set of facing) in fractional grid coordinates. */
export function silhouettes(g: Grid, level = 0): Array<Array<[number, number]>> {
  const { nu, nv, facing, valid } = g;
  const cols = g.wrapU ? nu : nu - 1;
  const segs: Array<[number, number, number, number, string, string]> = [];
  const f = (i: number, j: number) => facing[j * nu + (i % nu)]! - level;
  for (let j = 0; j < nv - 1; j++)
    for (let i = 0; i < cols; i++) {
      const i1 = (i + 1) % nu;
      const ka = j * nu + i,
        kb = j * nu + i1,
        kc = (j + 1) * nu + i1,
        kd = (j + 1) * nu + i;
      if (!valid[ka] || !valid[kb] || !valid[kc] || !valid[kd]) continue;
      const a = f(i, j),
        b = f(i + 1, j),
        c = f(i + 1, j + 1),
        d = f(i, j + 1);
      const pts: Array<[number, number, string]> = [];
      if (a * b < 0) pts.push([i + a / (a - b), j, `h${j}_${i}`]);
      if (b * c < 0) pts.push([i + 1, j + b / (b - c), `v${j}_${(i + 1) % nu}`]);
      if (d * c < 0) pts.push([i + d / (d - c), j + 1, `h${j + 1}_${i}`]);
      if (a * d < 0) pts.push([i, j + a / (a - d), `v${j}_${i}`]);
      if (pts.length === 2) segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1], pts[0]![2], pts[1]![2]]);
      else if (pts.length === 4) {
        segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1], pts[0]![2], pts[1]![2]]);
        segs.push([pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1], pts[2]![2], pts[3]![2]]);
      }
    }
  // Chain segments by shared edge keys.
  const byKey = new Map<string, number[]>();
  segs.forEach((s, idx) => {
    for (const key of [s[4], s[5]]) {
      const l = byKey.get(key);
      if (l) l.push(idx);
      else byKey.set(key, [idx]);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines: Array<Array<[number, number]>> = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const seg = segs[s0]!;
    const line: Array<[number, number]> = [
      [seg[0], seg[1]],
      [seg[2], seg[3]],
    ];
    // Extend forward from seg end key, then backward from start key.
    for (const dir of [1, -1]) {
      let key = dir === 1 ? seg[5] : seg[4];
      for (;;) {
        const cand = (byKey.get(key) ?? []).find((x) => !used[x]);
        if (cand === undefined) break;
        used[cand] = 1;
        const sg = segs[cand]!;
        let pt: [number, number], next: string;
        if (sg[4] === key) {
          pt = [sg[2], sg[3]];
          next = sg[5];
        } else {
          pt = [sg[0], sg[1]];
          next = sg[4];
        }
        if (dir === 1) line.push(pt);
        else line.unshift(pt);
        key = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface ContourStyle {
  width: number;
  /** Extra width on the shadow side (scaled by 1 - lit). */
  shadowBoost?: number;
  tol?: number;
  minW?: number;
}

/** Draw a grid-space polyline as a visibility-tested contour ribbon. */
export function strokeGridLine(g: Grid, pts: Array<[number, number]>, zbuf: DepthBuffer, out: Ribbons, st: ContourStyle): void {
  const tol = st.tol ?? 0.6;
  const boost = st.shadowBoost ?? 0.8;
  out.begin();
  for (let k = 0; k < pts.length; k++) {
    const [fi, fj] = pts[k]!;
    // Resample long segments.
    const next = pts[k + 1];
    const sub = next ? Math.max(1, Math.ceil(segLen(g, fi, fj, next[0], next[1]) / 1.5)) : 1;
    for (let q = 0; q < sub; q++) {
      const t = q / sub;
      const ffi = next ? fi + (next[0] - fi) * t : fi;
      const ffj = next ? fj + (next[1] - fj) * t : fj;
      const smp = sampleGrid(g, ffi, ffj);
      if (!smp.ok) {
        out.end();
        continue;
      }
      const zb = zbuf.near(smp.sx, smp.sy, 1);
      if (smp.sz > zb + tol) {
        out.end();
        continue;
      }
      const w = st.width + boost * (1 - smp.lit);
      if (w < (st.minW ?? 0.3)) {
        out.end();
        continue;
      }
      out.push(smp.sx, smp.sy, w);
    }
  }
  out.end(0.35);
}

function segLen(g: Grid, i0: number, j0: number, i1: number, j1: number): number {
  const a = sampleGrid(g, i0, j0);
  if (!a.ok) return 1;
  const ax = a.sx,
    ay = a.sy;
  const b = sampleGrid(g, i1, j1);
  if (!b.ok) return 1;
  return Math.hypot(b.sx - ax, b.sy - ay);
}

/** Row/column boundary of a grid as a polyline of fractional indices. */
export function gridRow(g: Grid, j: number, i0 = 0, i1 = g.wrapU ? g.nu : g.nu - 1): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = i0; i <= i1; i++) pts.push([i, j]);
  return pts;
}
export function gridCol(g: Grid, i: number, j0 = 0, j1 = g.nv - 1): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let j = j0; j <= j1; j++) pts.push([i, j]);
  return pts;
}

/** Stroke an arbitrary screen-space polyline with a width profile. */
export function strokeScreen(out: Ribbons, pts: Array<[number, number]>, width: (t: number) => number, taper = 0.4): void {
  out.begin();
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const t = n > 1 ? k / (n - 1) : 0;
    out.push(pts[k]![0], pts[k]![1], width(t));
  }
  out.end(taper);
}
