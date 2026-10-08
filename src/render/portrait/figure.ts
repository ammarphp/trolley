/**
 * Draws the bust (everything except the per-frame eyes, tears and glass) as
 * ink on a transparent canvas: hatching per surface, silhouettes, collar and
 * cap edges, then the feature strokes that carry the likeness.
 *
 * `figureSteps` is a generator so the work can be spread across frames; each
 * step fills its own strokes, so no step holds a huge path.
 */
import { Ribbons, gridRow, gridCol, hatchGridSteps, silhouettes, strokeGridLine, type HatchFamily, type HatchOptions } from "./engrave.ts";
import type { DepthBuffer, Grid } from "./raster.ts";
import { FeaturePen, drawFeaturesSteps, drawCapDetails, drawNeckDetails, drawUniformDetails, earPolygon } from "./features.ts";
import { BUILD_TRACE, hash3 } from "./math.ts";
import type { BustScene } from "./scene.ts";

const HALF_PI = Math.PI / 2;

export interface FigureStyle {
  /** Global tone bias (late stages hatch denser). */
  bias: number;
  /** Stroke weight multiplier. */
  weight: number;
}

function families(kind: string, st: FigureStyle): HatchFamily[] {
  const w = st.weight;
  switch (kind) {
    // Spacing and weights are set for the mirror's size on screen (the
    // canvas is seen at 1/2-1/4 scale): open lines in the lights, lines that
    // swell until they close into solid ink in the core shadows.
    case "head":
      return [
        { angle: HALF_PI, spacing: 5.0, t0: 0.18, t1: 0.9, maxW: 3.9 * w, gamma: 1.25, wobble: 0.25, seed: 1, dash: { period: 6, solid: 0.38 } },
        { angle: HALF_PI - 0.62, spacing: 5.4, t0: 0.48, t1: 0.95, maxW: 3.4 * w, gamma: 1.2, seed: 2 },
        { angle: HALF_PI + 0.7, spacing: 5.8, t0: 0.7, t1: 1.0, maxW: 3.4 * w, seed: 3 },
      ];
    case "neck":
      return [
        { angle: HALF_PI, spacing: 5.1, t0: 0.2, t1: 0.9, maxW: 3.8 * w, gamma: 1.25, seed: 4, dash: { period: 6, solid: 0.42 } },
        { angle: HALF_PI - 0.6, spacing: 5.5, t0: 0.52, t1: 0.96, maxW: 3.3 * w, seed: 5 },
        { angle: HALF_PI + 0.7, spacing: 6.0, t0: 0.74, t1: 1.0, maxW: 3.3 * w, seed: 6 },
      ];
    // Wool serge: straight diagonal twill-like lines across the form rather
    // than meridians, which would read as a padded dome.
    case "torso":
      return [
        { angle: 0.95, spacing: 4.6, t0: 0.2, t1: 0.9, maxW: 3.4 * w, gamma: 1.2, seed: 7, wobble: 0.3 },
        { angle: -0.45, spacing: 5.0, t0: 0.55, t1: 0.95, maxW: 3.2 * w, seed: 8 },
        { angle: 0.2, spacing: 5.4, t0: 0.78, t1: 1.0, maxW: 3.2 * w, seed: 9 },
      ];
    case "capBand":
      return [
        { angle: HALF_PI, spacing: 2.6, t0: 0.2, t1: 0.95, maxW: 2.3 * w, seed: 10 },
        { angle: 0, spacing: 3.2, t0: 0.86, t1: 1.02, maxW: 2.2 * w, seed: 11 },
      ];
    case "capCrown":
      return [
        { angle: HALF_PI + 0.28, spacing: 3.5, t0: 0.2, t1: 0.95, maxW: 2.3 * w, seed: 12 },
        { angle: HALF_PI - 0.5, spacing: 4.0, t0: 0.6, t1: 1.02, maxW: 2.1 * w, seed: 13 },
        { angle: 0.1, spacing: 4.6, t0: 0.82, t1: 1.05, maxW: 2.0 * w, seed: 14 },
      ];
    case "capTop":
      return [
        { angle: HALF_PI, spacing: 3.6, t0: 0.2, t1: 0.95, maxW: 2.2 * w, seed: 15 },
        { angle: 0, spacing: 4.2, t0: 0.6, t1: 1.02, maxW: 2.0 * w, seed: 16 },
      ];
    case "capPeak":
      return [];
    case "lapelL":
    case "lapelR":
      return [
        { angle: 0, spacing: 4.2, t0: 0.2, t1: 0.92, maxW: 3.2 * w, seed: 27 },
        { angle: 1.0, spacing: 4.8, t0: 0.6, t1: 1.0, maxW: 3.0 * w, seed: 28 },
      ];
    case "shirt":
    case "leafL":
    case "leafR":
      return [
        { angle: HALF_PI, spacing: 3.2, t0: 0.2, t1: 1.0, maxW: 1.9 * w, seed: 19 },
        { angle: 0.3, spacing: 3.6, t0: 0.6, t1: 1.05, maxW: 1.7 * w, seed: 20 },
      ];
    case "jacketL":
    case "jacketR":
      return [
        { angle: 0, spacing: 3.4, t0: 0.2, t1: 0.95, maxW: 2.3 * w, seed: 21 },
        { angle: HALF_PI, spacing: 3.8, t0: 0.6, t1: 1.02, maxW: 2.1 * w, seed: 22 },
      ];
    case "knot":
      return [
        { angle: 0, spacing: 2.4, t0: 0.2, t1: 0.95, maxW: 2.2 * w, seed: 23 },
        { angle: HALF_PI, spacing: 2.8, t0: 0.85, t1: 1.02, maxW: 2.0 * w, seed: 24 },
      ];
    case "tie":
      return [
        { angle: 0.9, spacing: 2.6, t0: 0.2, t1: 0.95, maxW: 2.2 * w, seed: 25 },
        { angle: -0.6, spacing: 3.0, t0: 0.84, t1: 1.02, maxW: 2.0 * w, seed: 26 },
      ];
    default:
      return [{ angle: HALF_PI, spacing: 4.5, t0: 0.2, t1: 1, maxW: 2.4 * w, seed: 18 }];
  }
}

/** Solid ink over every visible cell of a grid (patent-leather peak). */
function fillGrid(g: Grid, zb: DepthBuffer, out: Ribbons, tol: number): void {
  const { nu, nv } = g;
  const p = out.path;
  for (let j = 0; j < nv - 1; j++)
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i,
        b = a + 1,
        c = a + nu + 1,
        d = a + nu;
      const cx = (g.sx[a]! + g.sx[c]!) / 2,
        cy = (g.sy[a]! + g.sy[c]!) / 2,
        cz = (g.sz[a]! + g.sz[c]!) / 2;
      if (cz > zb.near(cx, cy, 1) + tol) continue;
      const grow = (x: number, y: number): [number, number] => {
        const dx = x - cx,
          dy = y - cy;
        const l = Math.hypot(dx, dy) || 1;
        return [x + (dx / l) * 0.4, y + (dy / l) * 0.4];
      };
      const A = grow(g.sx[a]!, g.sy[a]!),
        B = grow(g.sx[b]!, g.sy[b]!),
        C = grow(g.sx[c]!, g.sy[c]!),
        D = grow(g.sx[d]!, g.sy[d]!);
      p.moveTo(A[0], A[1]);
      p.lineTo(B[0], B[1]);
      p.lineTo(C[0], C[1]);
      p.lineTo(D[0], D[1]);
      p.closePath();
    }
}

/** Smooth 2D value noise in [0,1] for the afterimage's erasure. */
function vnoise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const fx = x - xi,
    fy = y - yi;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash3(xi, yi, seed),
    b = hash3(xi + 1, yi, seed),
    c = hash3(xi, yi + 1, seed),
    d = hash3(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function drawFigure(ctx: CanvasRenderingContext2D, sc: BustScene, st: FigureStyle = { bias: 0, weight: 1 }): void {
  const gen = figureSteps(ctx, sc, st);
  while (!gen.next().done);
}

export function* figureSteps(ctx: CanvasRenderingContext2D, sc: BustScene, st: FigureStyle = { bias: 0, weight: 1 }): Generator<void, void> {
  const zb = sc.zbuf;
  const after = sc.ex.after;
  // The afterimage: the likeness dissolves back into paper, patch by patch.
  const erase =
    after > 0.02
      ? (sx: number, sy: number) => {
          const n = vnoise2(sx * 0.045, sy * 0.045, 7) * 0.7 + vnoise2(sx * 0.16, sy * 0.16, 9) * 0.3;
          return n < after * 0.95;
        }
      : undefined;
  // Paper: the figure is opaque white wherever any surface was rasterised
  // (dilated by a pixel so the contour ink sits on paper, not on the sky).
  const T = BUILD_TRACE;
  T.label = "paper";
  {
    const { w, h } = sc;
    const img = ctx.createImageData(w, h);
    const d = zb.depth;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let on = d[y * w + x]! < Infinity;
        if (!on) {
          on = (x > 0 && d[y * w + x - 1]! < Infinity) || (x < w - 1 && d[y * w + x + 1]! < Infinity) || (y > 0 && d[(y - 1) * w + x]! < Infinity) || (y < h - 1 && d[(y + 1) * w + x]! < Infinity);
        }
        if (on) {
          const k = (y * w + x) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = img.data[k + 3] = 255;
        }
      }
    ctx.putImageData(img, 0, 0);
  }
  yield;
  ctx.fillStyle = "#000";
  // The ear is kept lighter than the shadow around it: the first (light)
  // family skips it, darker families still model its hollows.
  const ear = earPolygon(sc);
  let ex0 = Infinity,
    ex1 = -Infinity,
    ey0 = Infinity,
    ey1 = -Infinity;
  for (const [x, y] of ear) {
    ex0 = Math.min(ex0, x);
    ex1 = Math.max(ex1, x);
    ey0 = Math.min(ey0, y);
    ey1 = Math.max(ey1, y);
  }
  const inEar = (x: number, y: number) => {
    if (x < ex0 || x > ex1 || y < ey0 || y > ey1) return false;
    let inside = false;
    for (let i = 0, j = ear.length - 1; i < ear.length; j = i++) {
      const [xi, yi] = ear[i]!,
        [xj, yj] = ear[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (const g of sc.grids) {
    for (const f of families(g.name, st)) {
      const ink = new Ribbons();
      const opts: HatchOptions = { toneBias: st.bias };
      if (g.name === "head" || g.name === "neck") opts.skip = erase;
      if (g.name === "head" && f.seed === 1) opts.skip = (x, y) => inEar(x, y) || (erase ? erase(x, y) : false);
      if (g.name === "head" && f.seed !== 1) {
        const prev = opts.skip;
        opts.toneFn = (tone, x, y) => (inEar(x, y) ? tone - 0.18 : tone);
        opts.skip = prev;
      }
      T.label = `hatch ${g.name} ${f.seed}`;
      yield* hatchGridSteps(g, f, zb, ink, opts);
      yield;
      T.label = `fill ${g.name} ${f.seed}`;
      ctx.fill(ink.path);
      yield;
    }
  }
  // Silhouettes, traced just inside the limb so the depth test is robust.
  T.label = "silhouettes";
  const lines = new Ribbons();
  for (const g of sc.grids) {
    if (g.twoSided) continue;
    const isHead = g.name === "head";
    for (const pl of silhouettes(g, 0.06))
      strokeGridLine(g, pl, zb, lines, { width: (isHead ? 1.7 : 1.9) * st.weight * (isHead ? 1 - after * 0.6 : 1), shadowBoost: isHead ? 0.6 : 0.9, tol: 0.5 });
    if (g.n > 3000) yield;
  }
  T.label = "fill silhouettes";
  ctx.fill(lines.path);
  yield;
  // Collar, jacket collar and tie edges; the patent peak.
  T.label = "edges";
  const edges = new Ribbons();
  const col = sc.collar;
  const ew = 1.4 * st.weight;
  for (const leaf of [col.leafL, col.leafR]) {
    strokeGridLine(leaf, gridRow(leaf, leaf.nv - 1), zb, edges, { width: 1.5 * ew, shadowBoost: 0.7 });
    strokeGridLine(leaf, gridCol(leaf, 0), zb, edges, { width: 1.4 * ew, shadowBoost: 0.7 });
    strokeGridLine(leaf, gridRow(leaf, 0), zb, edges, { width: 1.1 * ew, shadowBoost: 0.5 });
  }
  for (const jc of [col.jacketL, col.jacketR]) {
    strokeGridLine(jc, gridRow(jc, 0), zb, edges, { width: 1.5 * ew, shadowBoost: 0.8 });
    strokeGridLine(jc, gridCol(jc, 0), zb, edges, { width: 1.5 * ew, shadowBoost: 0.8 });
  }
  for (const lp of sc.grids.filter((g) => g.name.startsWith("lapel"))) {
    strokeGridLine(lp, gridCol(lp, 0), zb, edges, { width: 1.6 * ew, shadowBoost: 0.6 });
    strokeGridLine(lp, gridCol(lp, lp.nu - 1), zb, edges, { width: 1.3 * ew, shadowBoost: 0.6 });
    strokeGridLine(lp, gridRow(lp, 0), zb, edges, { width: 1.3 * ew, shadowBoost: 0.6 });
  }
  strokeGridLine(col.tie, gridCol(col.tie, 0), zb, edges, { width: 1.3 * ew, shadowBoost: 0.5 });
  strokeGridLine(col.tie, gridCol(col.tie, col.tie.nu - 1), zb, edges, { width: 1.3 * ew, shadowBoost: 0.5 });
  const cap = sc.cap;
  fillGrid(cap.peak, zb, edges, 1.2);
  strokeGridLine(cap.band, gridRow(cap.band, 0), zb, edges, { width: 1.6 * ew, shadowBoost: 0.6 });
  strokeGridLine(cap.band, gridRow(cap.band, cap.band.nv - 1), zb, edges, { width: 1.3 * ew, shadowBoost: 0.6 });
  strokeGridLine(cap.crown, gridRow(cap.crown, cap.crown.nv - 1), zb, edges, { width: 1.8 * ew, shadowBoost: 0.8 });
  strokeGridLine(cap.peak, gridRow(cap.peak, cap.peak.nv - 1), zb, edges, { width: 2.0 * ew, shadowBoost: 0.5, tol: 1 });
  strokeGridLine(cap.peak, gridCol(cap.peak, 0), zb, edges, { width: 1.6 * ew, shadowBoost: 0.5, tol: 1 });
  strokeGridLine(cap.peak, gridCol(cap.peak, cap.peak.nu - 1), zb, edges, { width: 1.6 * ew, shadowBoost: 0.5, tol: 1 });
  yield;
  T.label = "fill edges";
  ctx.fill(edges.path);
  yield;
  // Features, then the white-on-black details (badge, cord, glints) and
  // their black detailing on top.
  T.label = "features";
  const featInk = new Ribbons();
  const featWhite = new Ribbons();
  const pen = new FeaturePen(sc, featInk, featWhite);
  pen.weight = 1.45 * st.weight;
  yield* drawFeaturesSteps(sc, pen);
  yield;
  T.label = "cap details";
  const capInk = new Ribbons();
  const capWhite = new Ribbons();
  const capPen = new FeaturePen(sc, capInk, capWhite);
  drawCapDetails(sc, capPen);
  yield;
  T.label = "uniform details";
  drawUniformDetails(sc, capPen);
  capPen.weight = 1.3;
  drawNeckDetails(sc, capPen);
  yield;
  T.label = "fill features";
  ctx.fillStyle = "#fff";
  ctx.fill(featWhite.path);
  ctx.fill(capWhite.path);
  ctx.fillStyle = "#000";
  ctx.fill(featInk.path);
  ctx.fill(capInk.path);
}
