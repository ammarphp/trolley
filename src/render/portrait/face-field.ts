/**
 * The face as a frontal relief z = Z(x, y) in head-local centimetres.
 *
 * A face is mostly frontal: its profile, the way it wraps around at each
 * height, and a handful of anatomical masses (brow ridge, orbits, cheek
 * bones, nose, muzzle, lips, chin). Authoring it as a height field keeps
 * every form smooth and directly controllable. head.ts solves the radial
 * intersection with this field and blends it with the skull ellipsoids.
 */
import { clamp, smoothstep } from "./math.ts";
import type { Expr, Identity } from "./rig.ts";

/** Catmull-Rom through (x, y) samples; xs must be ascending. */
export function spline(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[n - 1]!) return ys[n - 1]!;
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]!) i++;
  const x0 = xs[i]!,
    x1 = xs[i + 1]!;
  const t = (x - x0) / (x1 - x0);
  const p0 = ys[Math.max(0, i - 1)]!,
    p1 = ys[i]!,
    p2 = ys[i + 1]!,
    p3 = ys[Math.min(n - 1, i + 2)]!;
  // Non-uniform spacing: scale tangents by segment lengths.
  const xm = xs[Math.max(0, i - 1)]!,
    xp = xs[Math.min(n - 1, i + 2)]!;
  const m1 = ((p2 - p0) / Math.max(1e-6, x1 - xm)) * (x1 - x0);
  const m2 = ((p3 - p1) / Math.max(1e-6, xp - x0)) * (x1 - x0);
  const t2 = t * t,
    t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
}

function table(pairs: Array<[number, number]>): { xs: number[]; ys: number[] } {
  const s = [...pairs].sort((a, b) => a[0] - b[0]);
  return { xs: s.map((p) => p[0]), ys: s.map((p) => p[1]) };
}

// Midline depth of the underlying face (no nose/lips/chin mass).
const ZC = table([
  [8.0, 6.2],
  [6.5, 7.9],
  [5.0, 8.6],
  [3.5, 9.0],
  [2.2, 9.2],
  [1.2, 9.05],
  [0.3, 8.55],
  [-1.0, 8.3],
  [-2.5, 8.5],
  [-4.0, 8.95],
  [-5.2, 9.5],
  [-6.3, 9.75],
  [-7.2, 9.6],
  [-8.2, 9.35],
  [-9.0, 8.95],
  [-10.0, 9.2],
  [-11.0, 8.85],
  [-11.7, 7.95],
  [-12.2, 6.6],
  [-12.8, 4.2],
  [-13.6, 1.0],
]);
// Half-width of the frontal plane (where the face turns to the side).
const HW = table([
  [8.0, 5.2],
  [5.0, 6.0],
  [3.5, 6.2],
  [2.2, 6.3],
  [1.0, 6.35],
  [0.0, 6.45],
  [-1.5, 6.5],
  [-3.0, 6.3],
  [-4.5, 6.0],
  [-6.0, 5.6],
  [-7.2, 5.35],
  [-8.5, 4.95],
  [-9.5, 4.35],
  [-10.6, 3.45],
  [-11.6, 2.5],
  [-12.6, 1.9],
  [-13.6, 1.6],
]);
// Depth where the frontal plane meets the side of the head.
const ZS = table([
  [8.0, 3.2],
  [3.5, 3.8],
  [0.0, 3.6],
  [-3.0, 3.4],
  [-6.0, 3.6],
  [-9.0, 3.4],
  [-11.0, 5.0],
  [-13.0, 3.0],
  [-14.0, 0.5],
]);
// Flatness of the frontal plane (higher = flatter).
const PX = table([
  [8.0, 2.1],
  [3.0, 2.35],
  [0.0, 2.7],
  [-3.0, 2.45],
  [-6.0, 1.95],
  [-9.0, 1.9],
  [-12.0, 1.8],
]);
// Nose projection above the base plane and its half-width.
const NOSE_H = table([
  [1.1, 0.0],
  [0.45, 0.3],
  [-0.5, 0.82],
  [-1.5, 1.45],
  [-2.5, 2.05],
  [-3.3, 2.62],
  [-3.8, 2.8],
  [-4.3, 2.42],
  [-4.8, 1.55],
  [-5.2, 0.55],
  [-5.6, 0.0],
]);
const NOSE_W = table([
  [1.1, 0.9],
  [0.0, 0.76],
  [-1.5, 0.72],
  [-3.0, 0.84],
  [-3.7, 1.0],
  [-4.3, 1.08],
  [-5.0, 1.0],
  [-5.6, 0.9],
]);

export interface FaceParams {
  masc: number;
  cheek: number;
  noseW: number;
  noseLen: number;
  noseBridge: number;
  noseTip: number;
  lipFull: number;
  mouthW: number;
  chin: number;
  jaw: number;
  faceLen: number;
  browRidge: number;
  // Expression.
  stomY: number;
  corner: number;
  mouthOpen: number;
  cheekRaise: number;
  hollow: number;
  nasolabial: number;
  pout: number;
  grief: number;
}

export function faceParams(id: Identity, ex: Expr): FaceParams {
  return {
    masc: id.masc,
    cheek: id.cheek,
    noseW: id.noseW,
    noseLen: id.noseLen,
    noseBridge: id.noseBridge,
    noseTip: id.noseTip,
    lipFull: id.lipFull,
    mouthW: id.mouthW,
    chin: id.chin,
    jaw: id.jawW,
    faceLen: id.faceLen,
    browRidge: 0.45 + 0.35 * id.masc,
    stomY: -7.2 * id.faceLen - ex.mouthOpen * 0.4,
    corner: ex.mouthCorner,
    mouthOpen: ex.mouthOpen,
    cheekRaise: ex.cheekRaise,
    hollow: ex.hollow,
    nasolabial: ex.nasolabial,
    pout: 0.15 * ex.grief + 0.1 * ex.frown,
    grief: ex.grief,
  };
}

/** Mouth line height at |x| (corners rise with a smile, fall with a frown). */
export function mouthLineY(fp: FaceParams, ax: number): number {
  const mw = 2.5 * fp.mouthW;
  const u = clamp(ax / mw, 0, 1.3);
  // Cupid's-bow dip at the centre is tiny; corners carry the expression.
  return fp.stomY + fp.corner * Math.pow(u, 2.3) - 0.04 * Math.exp(-(ax * ax) / 0.2);
}

const g2 = (x: number, s: number) => Math.exp(-(x * x) / (s * s));

/**
 * The relief tabulated on a regular grid (x >= 0; the face is symmetric).
 * Ray solves read it bilinearly, which is ~20x cheaper than evaluating it.
 */
export class FaceTable {
  static readonly X1 = 9.6;
  static readonly Y0 = -15.6;
  static readonly Y1 = 9.6;
  static readonly H = 0.075;
  readonly nx: number;
  readonly ny: number;
  readonly z: Float32Array;
  constructor(fp: FaceParams, lazy = false) {
    const h = FaceTable.H;
    this.nx = Math.ceil(FaceTable.X1 / h) + 1;
    this.ny = Math.ceil((FaceTable.Y1 - FaceTable.Y0) / h) + 1;
    this.z = new Float32Array(this.nx * this.ny);
    if (!lazy) {
      const gen = this.fill(fp);
      while (!gen.next().done);
    }
  }
  /** Fill the table, yielding every few rows (spreads the work over frames). */
  *fill(fp: FaceParams): Generator<void, void> {
    const h = FaceTable.H;
    for (let j = 0; j < this.ny; j++) {
      if (j % 40 === 39) yield;
      const y = FaceTable.Y0 + j * h;
      for (let i = 0; i < this.nx; i++) this.z[j * this.nx + i] = faceZ(fp, i * h, y);
    }
  }
  at(x: number, y: number): number {
    const h = FaceTable.H;
    let fx = Math.abs(x) / h;
    let fy = (y - FaceTable.Y0) / h;
    if (fx > this.nx - 1.001) fx = this.nx - 1.001;
    if (fy < 0) fy = 0;
    if (fy > this.ny - 1.001) fy = this.ny - 1.001;
    const i = fx | 0,
      j = fy | 0;
    const tx = fx - i,
      ty = fy - j;
    const k = j * this.nx + i;
    const z = this.z;
    const a = z[k]! + (z[k + 1]! - z[k]!) * tx;
    const b = z[k + this.nx]! + (z[k + this.nx + 1]! - z[k + this.nx]!) * tx;
    let v = a + (b - a) * ty;
    // Beyond the table the relief keeps falling away.
    const over = Math.abs(x) - FaceTable.X1;
    if (over > 0) v -= over * 6;
    return v;
  }
}

/** Half-width of the frontal plane at height y (head-local). */
export function faceHalfWidth(fp: FaceParams, y0: number): number {
  const y = y0 / fp.faceLen;
  const lower = smoothstep(-4.5, -7.5, y);
  const mid = smoothstep(-5.5, -3.5, y) * smoothstep(2, 0.5, y);
  return spline(HW.xs, HW.ys, y) * (1 + (fp.jaw - 1) * lower) * (1 + (fp.cheek - 1) * 0.3 * mid);
}

/** Frontal depth of the skin at (x, y). */
export function faceZ(fp: FaceParams, x: number, y0: number): number {
  const y = y0 / fp.faceLen;
  const ax = Math.abs(x);
  const zc = spline(ZC.xs, ZC.ys, y);
  const lower = smoothstep(-4.5, -7.5, y);
  const mid = smoothstep(-5.5, -3.5, y) * smoothstep(2, 0.5, y);
  const hw = spline(HW.xs, HW.ys, y) * (1 + (fp.jaw - 1) * lower) * (1 + (fp.cheek - 1) * 0.3 * mid);
  const zs = spline(ZS.xs, ZS.ys, y);
  // Softer jaws are rounder at the angle; heavier ones squarer.
  const p = spline(PX.xs, PX.ys, y) * (1 + (fp.masc - 0.6) * 0.25 * lower);
  const u = ax / hw;
  // Past the half-width the relief turns away sharply; the skull takes over.
  let z = u <= 1 ? zs + (zc - zs) * (1 - Math.pow(u, p)) : zs - (u - 1) * p * (zc - zs) - (u - 1) ** 2 * 10;

  // Brow ridge (bone): strongest over the inner-middle of each orbit.
  const browW = smoothstep(6.3, 3.6, ax) * (0.72 + 0.28 * smoothstep(0.2, 2.2, ax));
  z += fp.browRidge * browW * g2(y - 1.75, 0.8);
  // Orbits.
  const oy = y - 0.55;
  z -= 1.4 * Math.exp(-(((ax - 3.0) / 1.6) ** 2) - (oy / (oy > 0 ? 1.05 : 0.85)) ** 2);
  z -= 0.45 * Math.exp(-(((ax - 1.85) / 0.6) ** 2) - ((y - 0.2) / 0.7) ** 2);
  // Temples.
  z -= (0.25 + 0.3 * fp.hollow) * Math.exp(-(((ax - 5.8) / 1.0) ** 2) - ((y - 2.6) / 1.6) ** 2);
  // Cheekbones and the cheek apples (raised by a smile).
  z += 0.72 * fp.cheek * Math.exp(-(((ax - 4.45) / 1.55) ** 2) - ((y + 1.85) / 1.3) ** 2);
  const apY = -3.3 + 0.55 * fp.cheekRaise;
  z += (0.35 + 0.35 * fp.cheekRaise - 0.25 * fp.hollow) * Math.exp(-(((ax - 3.25) / 1.35) ** 2) - ((y - apY) / 1.35) ** 2);
  // Hollow under the cheekbone.
  z -= (0.1 + 0.4 * fp.hollow) * Math.exp(-(((ax - 4.7) / 1.2) ** 2) - ((y + 5.4) / 1.5) ** 2);

  // Muzzle: the dental arch.
  z += 0.5 * Math.exp(-((x / 3.2) ** 2) - ((y + 6.7) / 2.3) ** 2);

  // Nose.
  const ny = (y + 0.3) / fp.noseLen - 0.3 - fp.noseTip * 0.1;
  const nh = spline(NOSE_H.xs, NOSE_H.ys, ny) * (1 + (fp.noseLen - 1) * 0.8);
  if (nh > 0) {
    const nw = spline(NOSE_W.xs, NOSE_W.ys, ny) * fp.noseW;
    const nu = ax / nw;
    if (nu < 1.6) {
      const prof = nu < 1 ? (1 - nu * nu) ** 1.35 : 0;
      const hump = fp.noseBridge * 0.22 * g2(ny + 1.6, 0.9);
      z += (nh + hump * (1 - nu)) * prof;
    }
  }
  // Alae (nostril wings) and the groove around them.
  const alaX = 1.42 * fp.noseW,
    alaY = -4.35 * fp.noseLen - 0.2;
  const da = Math.hypot((ax - alaX) / 0.78, (y - alaY) / 0.64);
  z += 1.05 * Math.exp(-da * da);
  z -= 0.28 * Math.exp(-(((da - 1.25) / 0.28) ** 2)) * smoothstep(-0.2, 0.6, ax - alaX + (y - alaY) * 0.3);

  // Lips follow the mouth line.
  const ym = mouthLineY(fp, ax);
  const mw = 2.45 * fp.mouthW + 0.2 * fp.cheekRaise;
  const lipW = smoothstep(mw + 0.15, mw - 0.9, ax);
  const lf = fp.lipFull;
  // Philtrum: a shallow groove with ridges.
  const phY = smoothstep(ym + 0.55, ym + 1.0, y) * smoothstep(-4.6 * fp.noseLen - 0.8, -5.3 * fp.noseLen - 0.3, y);
  z += phY * (0.07 * g2(ax - 0.42, 0.18) - 0.06 * g2(x, 0.25));
  // Upper lip vermilion (cupid's bow via the height of its upper border).
  const upperC = ym + 0.46 * lf + 0.1 * g2(ax - 0.45, 0.35) - 0.08 * g2(x, 0.25);
  z += 0.38 * lf * lipW * Math.exp(-(((y - upperC) / 0.34) ** 2)) * (1 - 0.35 * fp.cheekRaise);
  // Lower lip.
  const lowerC = ym - 0.62 * lf - fp.mouthOpen * 0.5;
  z += (0.44 + fp.pout) * lf * smoothstep(mw - 0.1, mw - 1.1, ax) * Math.exp(-(((y - lowerC) / 0.44) ** 2));
  // The mouth line itself.
  z -= (0.24 + fp.mouthOpen * 1.5) * smoothstep(mw + 0.45, mw - 0.4, ax) * Math.exp(-(((y - ym) / (0.12 + fp.mouthOpen * 0.8)) ** 2));
  // Mentolabial sulcus and chin.
  z -= 0.42 * Math.exp(-((x / 2.3) ** 2) - ((y - (lowerC - 1.15)) / 0.5) ** 2);
  z += (0.55 + fp.chin * 0.45) * Math.exp(-((x / (1.9 + 0.5 * fp.masc)) ** 2) - ((y + 10.15) / 1.15) ** 2);
  z += 0.12 * fp.grief * Math.exp(-((x / 1.2) ** 2) - ((y + 9.8) / 0.8) ** 2);

  // Nasolabial fold: groove from the ala to past the mouth corner, cheek fat
  // bulging over it on the lateral side.
  const nlDepth = (0.03 + 0.04 * fp.masc) + 0.3 * fp.nasolabial;
  if (ax > 1.0) {
    const t = clamp((alaY + 0.4 - y) / (alaY + 0.4 - (ym - 1.3)));
    const fx = alaX + 0.55 + t * (mw - alaX - 0.15 + 0.2 * fp.cheekRaise) + Math.sin(t * Math.PI) * 0.35;
    const d = ax - fx;
    const inRange = smoothstep(-0.2, 0.15, t) * smoothstep(1.2, 0.85, t);
    z -= nlDepth * Math.exp(-((d / 0.28) ** 2)) * inRange;
    z += nlDepth * 0.7 * Math.exp(-(((d - 0.55) / 0.45) ** 2)) * inRange;
  }
  return z;
}
