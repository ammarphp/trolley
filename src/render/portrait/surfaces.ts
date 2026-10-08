/**
 * Parametric surfaces of the bust: head (radial field), neck, torso and
 * jacket, shirt collar, tie, and the peaked cap. Every builder writes posed
 * bust-frame positions and outward normals into a Grid; albedo per vertex
 * encodes the materials (white shirt, dark serge, black mohair band).
 */
import { HEAD_C, HeadShape, dirOf } from "./head.ts";
import { clamp, lerp, norm, posePoint, poseDir, smoothstep, sub, type Pose, type V3 } from "./math.ts";
import { Grid } from "./raster.ts";
import type { Expr, Identity } from "./rig.ts";

export const IDS = {
  head: 1,
  neck: 2,
  torso: 3,
  collar: 4,
  tie: 5,
  capCrown: 6,
  capTop: 7,
  capBand: 8,
  capPeak: 9,
  eyes: 10,
  hair: 11,
} as const;

export const HEAD_TH: [number, number] = [-1.5, 2.65];
export const HEAD_PH: [number, number] = [-1.42, 1.15];

export interface HeadGrid extends Grid {
  /** Radial distance per vertex (head-local), for cavity estimation. */
  R?: Float32Array;
}

export function buildHeadGrid(shape: HeadShape, pose: Pose, nt = 230, np = 160): HeadGrid {
  const gen = buildHeadGridSteps(shape, pose, nt, np);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

export function* buildHeadGridSteps(shape: HeadShape, pose: Pose, nt = 220, np = 156): Generator<void, HeadGrid> {
  const g: HeadGrid = new Grid(IDS.head, nt, np, "head");
  const R = new Float32Array(nt * np);
  const c = HEAD_C;
  const cp = posePoint(pose, c);
  for (let j = 0; j < np; j++) {
    if (j % 9 === 8) yield;
    const phi = lerp(HEAD_PH[0], HEAD_PH[1], j / (np - 1));
    g.vs[j] = phi;
    for (let i = 0; i < nt; i++) {
      const theta = lerp(HEAD_TH[0], HEAD_TH[1], i / (nt - 1));
      if (j === 0) g.us[i] = theta;
      const d = dirOf(theta, phi);
      const r = shape.radius(d[0], d[1], d[2]);
      const k = j * nt + i;
      R[k] = r;
      const p = posePoint(pose, [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]);
      g.px[k] = p[0];
      g.py[k] = p[1];
      g.pz[k] = p[2];
    }
  }
  g.R = R;
  g.computeNormals((k) => [g.px[k]! - cp[0], g.py[k]! - cp[1], g.pz[k]! - cp[2]]);
  // Cavity: how far the skin sits below its blurred neighbourhood.
  const blur = boxBlur(R, nt, np, 4);
  const blur2 = boxBlur(R, nt, np, 9);
  for (let k = 0; k < g.n; k++) {
    const a = blur[k]! - R[k]!;
    const b = blur2[k]! - R[k]!;
    g.cav[k] = clamp(a * 2.2 + b * 0.8, 0, 1);
  }
  return g;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < h; j++) {
    let acc = 0;
    let n = 0;
    for (let i = -r; i <= r; i++) {
      const ii = Math.min(w - 1, Math.max(0, i));
      acc += src[j * w + ii]!;
      n++;
    }
    for (let i = 0; i < w; i++) {
      tmp[j * w + i] = acc / n;
      const add = Math.min(w - 1, i + r + 1),
        rem = Math.max(0, i - r);
      acc += src[j * w + add]! - src[j * w + rem]!;
    }
  }
  for (let i = 0; i < w; i++) {
    let acc = 0;
    let n = 0;
    for (let j = -r; j <= r; j++) {
      const jj = Math.min(h - 1, Math.max(0, j));
      acc += tmp[jj * w + i]!;
      n++;
    }
    for (let j = 0; j < h; j++) {
      out[j * w + i] = acc / n;
      const add = Math.min(h - 1, j + r + 1),
        rem = Math.max(0, j - r);
      acc += tmp[add * w + i]! - tmp[rem * w + i]!;
    }
  }
  return out;
}

/** The neck's centre line and radii at height y (bust frame). */
export interface NeckFrame {
  base: V3;
  top: V3;
  at(y: number): { cz: number; rx: number; rz: number; t: number };
  /** Radius of the neck ellipse in direction a (0 = front). */
  radius(y: number, a: number): number;
}

export function neckFrame(id: Identity, ex: Expr): NeckFrame {
  // The cervical column leans forward: the base sits behind the head.
  const base: V3 = [0, -24, -3.0];
  const top: V3 = [0, -5.0, -1.6 + 0.35 * ex.headPitch * 10];
  const s = id.neck;
  const at = (y: number) => {
    const t = clamp((y - base[1]) / (top[1] - base[1]));
    return {
      t,
      cz: lerp(base[2], top[2], t),
      rx: (5.0 + 0.8 * (1 - t) ** 2) * s,
      rz: (5.4 + 0.9 * (1 - t) ** 3) * s,
    };
  };
  return {
    base,
    top,
    at,
    radius(y, a) {
      const f = at(y);
      return 1 / Math.sqrt((Math.sin(a) / f.rx) ** 2 + (Math.cos(a) / f.rz) ** 2);
    },
  };
}

/** Neck: a tapered elliptical tube leaning forward from the shoulders. */
export function buildNeck(id: Identity, ex: Expr): Grid {
  const nu = 72,
    nv = 40;
  const g = new Grid(IDS.neck, nu, nv, "neck");
  g.wrapU = true;
  const nf = neckFrame(id, ex);
  const base = nf.base,
    top = nf.top;
  for (let j = 0; j < nv; j++) {
    const t = j / (nv - 1);
    g.vs[j] = t;
    const cy = lerp(base[1], top[1], t);
    const { cz, rx, rz } = nf.at(cy);
    for (let i = 0; i < nu; i++) {
      const a = Math.PI + (i / nu) * Math.PI * 2; // seam at the back
      if (j === 0) g.us[i] = a;
      let x = Math.sin(a) * rx;
      let z = Math.cos(a) * rz;
      // Sternocleidomastoid ridges and a larynx for heavier builds.
      const front = Math.cos(a);
      const scm = Math.exp(-((Math.abs(Math.sin(a)) - 0.62) ** 2) / 0.03) * 0.25 * smoothstep(0.2, 0.9, t) * Math.max(0, front);
      const af = Math.atan2(Math.sin(a), Math.cos(a));
      const larynx = id.masc * 0.55 * Math.exp(-(af * af) / 0.08) * Math.exp(-((t - 0.52) ** 2) / 0.02);
      x *= 1 + scm * 0.4;
      z += (scm + larynx) * Math.max(0, front) * 1.2;
      g.set(i, j, [x, cy, cz + z]);
    }
  }
  g.computeNormals((k) => {
    const j = Math.floor(k / nu);
    const t = j / (nv - 1);
    return [g.px[k]!, 0, g.pz[k]! - lerp(base[2], top[2], t)];
  });
  g.alb.fill(id.skin);
  return g;
}

/**
 * Torso with jacket: a star-shaped field around a chest centre. Albedo
 * paints the jacket (dark serge), the shirt V (white) and lapel facings.
 */
export interface TorsoInfo {
  /** Albedo function in torso-local coords (for the V opening). */
  vHalfWidth(y: number): number;
  vTopY: number;
  /** Radially snap a bust-frame point onto the jacket. */
  snap(p: V3, lift?: number): V3;
}

export function buildTorso(id: Identity): { grid: Grid; info: TorsoInfo; frontZ: (x: number, y: number) => number } {
  const nu = 150,
    nv = 90;
  const g = new Grid(IDS.torso, nu, nv, "torso");
  const C: V3 = [0, -32.5, -1.5];
  const sh = 1 + (id.masc - 0.5) * 0.08;
  const TH: [number, number] = [-2.3, 2.7];
  const PH: [number, number] = [-0.95, 1.35];
  const vTopY = -20.4;
  const vHalfWidth = (y: number) => {
    // Opening of the jacket front: from the collar notch down the chest.
    const t = clamp((vTopY - y) / 14);
    return 3.1 + t * 3.4;
  };
  const radius = (d: V3) => {
    // Chest: a broad superellipsoid; shoulders drop from the neck base.
    const ax = 19.5 * sh,
      ay = 13.5,
      az = 10.8;
    const ex = 2.6;
    const q = (Math.abs(d[0]) / ax) ** ex + (Math.abs(d[1]) / ay) ** ex + (Math.abs(d[2]) / az) ** ex;
    let r = 1 / q ** (1 / ex);
    const up = Math.max(0, d[1]);
    const side = Math.abs(d[0]);
    r *= 1 - 0.2 * up * up * (1 - side * 0.55);
    // A tailored shoulder: a firm, slightly squared line rather than a pad.
    const shoulder = Math.exp(-((side - 0.8) ** 2) / 0.03) * Math.exp(-((d[1] - 0.42) ** 2) / 0.04);
    return r + shoulder * 0.6;
  };
  for (let j = 0; j < nv; j++) {
    const phi = lerp(PH[0], PH[1], j / (nv - 1));
    g.vs[j] = phi;
    for (let i = 0; i < nu; i++) {
      const theta = lerp(TH[0], TH[1], i / (nu - 1));
      if (j === 0) g.us[i] = theta;
      const d = dirOf(theta, phi);
      const r = radius(d);
      const p: V3 = [C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r];
      g.set(i, j, p);
      let alb = 0.5;
      const hw = vHalfWidth(p[1]);
      if (p[2] > C[2] + 3 && Math.abs(p[0]) < hw && p[1] < vTopY + 1) alb = 0.0;
      g.alb[j * nu + i] = alb;
    }
  }
  g.computeNormals((k) => [g.px[k]! - C[0], g.py[k]! - C[1], g.pz[k]! - C[2]]);
  const frontZ = (x: number, y: number) => {
    // Bisection along +z for the chest surface in front of the centre;
    // -Infinity when (x, y) is above the chest (no surface there).
    const inside = (z: number) => {
      const rel: V3 = [x - C[0], y - C[1], z - C[2]];
      const l = Math.hypot(rel[0], rel[1], rel[2]) || 1;
      return l < radius([rel[0] / l, rel[1] / l, rel[2] / l]);
    };
    let lo = C[2],
      hi = C[2] + 16;
    if (!inside(lo)) return -Infinity;
    for (let it = 0; it < 22; it++) {
      const z = (lo + hi) / 2;
      if (inside(z)) lo = z;
      else hi = z;
    }
    return (lo + hi) / 2;
  };
  /** Radially snap a point onto the jacket surface (+ lift). */
  const snap = (p: V3, lift = 0): V3 => {
    const rel: V3 = [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
    const l = Math.hypot(rel[0], rel[1], rel[2]) || 1;
    const d: V3 = [rel[0] / l, rel[1] / l, rel[2] / l];
    const r = radius(d) + lift;
    return [C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r];
  };
  return { grid: g, info: { vHalfWidth, vTopY, snap }, frontZ };
}

/**
 * Lapels: the jacket's turned-back facings, lying on the chest either side
 * of the V, notched where they meet the collar.
 */
export function buildLapels(info: TorsoInfo, frontZ: (x: number, y: number) => number): Grid[] {
  const out: Grid[] = [];
  for (const s of [1, -1]) {
    const nu = 14,
      nv = 26;
    const g = new Grid(IDS.torso, nu, nv, s > 0 ? "lapelL" : "lapelR");
    for (let j = 0; j < nv; j++) {
      const v = j / (nv - 1);
      const y = lerp(info.vTopY + 0.4, -33, v);
      const inner = info.vHalfWidth(y);
      // Width: broad under the notch, tapering to the button below the frame.
      const width = lerp(6.2, 0.4, smoothstep(0.05, 1, v)) - 1.4 * (1 - smoothstep(0, 0.12, v));
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        const x = s * (inner + Math.max(0.3, width) * u);
        const fz = frontZ(x, y);
        const roll = 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - v * 0.5);
        g.set(i, j, [x, y, (isFinite(fz) ? fz : -2) + 0.3 + roll]);
        g.us[i] = u;
        g.vs[j] = v;
        if (!isFinite(fz)) g.valid[j * nu + i] = 0;
      }
    }
    g.computeNormals(() => [s * 0.2, 0.3, 1]);
    g.alb.fill(0.46);
    out.push(g);
  }
  return out;
}

/**
 * Shirt collar leaves, tie knot and blade, and the jacket's collar, all in
 * the bust frame around the neck.
 */
export interface CollarGeometry {
  leafL: Grid;
  leafR: Grid;
  jacketL: Grid;
  jacketR: Grid;
  knot: Grid;
  tie: Grid;
  shirt: Grid;
  /** Collar point tips (for accent strokes). */
  points: V3[];
}

export function buildCollar(id: Identity, ex: Expr, torsoFrontZ: (x: number, y: number) => number): CollarGeometry {
  const nf = neckFrame(id, ex);
  const leaf = (side: number): Grid => {
    const nu = 56,
      nv = 10;
    const g = new Grid(IDS.collar, nu, nv, side > 0 ? "leafL" : "leafR");
    for (let j = 0; j < nv; j++) {
      const t = j / (nv - 1);
      const aFront = lerp(0.2, 0.5, t);
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        const a = lerp(aFront, Math.PI, Math.pow(u, 1.25));
        const yFold = -15.4 + 1.4 * smoothstep(0.2, 2.3, a);
        const yEdge = -17.1 - 0.5 * (1 - smoothstep(1.2, 3.1, a)) - 2.3 * (1 - smoothstep(0.5, 1.3, a));
        const y = lerp(yFold, yEdge, t);
        const f = nf.at(y);
        const rN = nf.radius(y, a);
        const r = rN + lerp(0.28, 0.95, t) + 0.16 * Math.sin(Math.PI * t * 0.85) + 0.35 * (1 - smoothstep(0.2, 0.9, a)) * t;
        g.set(i, j, [side * Math.sin(a) * r, y, f.cz + Math.cos(a) * r]);
        g.us[i] = u;
        g.vs[j] = t;
      }
    }
    g.computeNormals((k) => {
      const y = g.py[k]!;
      return [g.px[k]!, 0.35, g.pz[k]! - nf.at(y).cz];
    });
    g.alb.fill(0);
    return g;
  };
  const jacket = (side: number): Grid => {
    const nu = 48,
      nv = 8;
    const g = new Grid(IDS.torso, nu, nv, side > 0 ? "jacketL" : "jacketR");
    for (let j = 0; j < nv; j++) {
      const t = j / (nv - 1);
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        const a = lerp(0.62, Math.PI, Math.pow(u, 1.1));
        const yTop = -15.5 - 1.2 * (1 - smoothstep(1.0, 3.0, a)) - 3.4 * (1 - smoothstep(0.62, 1.35, a));
        const y = yTop - t * 4.2;
        const f = nf.at(y);
        const rN = nf.radius(y, a);
        const r = rN + lerp(1.55, 3.6, t * t) + 0.2 * Math.sin(Math.PI * t);
        g.set(i, j, [side * Math.sin(a) * r, y, f.cz + Math.cos(a) * r]);
        g.us[i] = u;
        g.vs[j] = t;
      }
    }
    g.computeNormals((k) => [g.px[k]!, 0.6, g.pz[k]! - nf.at(g.py[k]!).cz]);
    g.alb.fill(0.5);
    return g;
  };
  // Tie knot: a tapered, rounded block on the front of the neck.
  const knot = new Grid(IDS.tie, 28, 10, "knot");
  knot.wrapU = true;
  for (let j = 0; j < 10; j++) {
    const v = j / 9;
    const y = lerp(-15.5, -18.4, v);
    const f = nf.at(y);
    const hw = lerp(1.65, 1.0, v);
    const hd = lerp(0.75, 0.55, v);
    const cz = f.cz + f.rz + 0.35 + hd * 0.6;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const e = 3;
      const sx = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e),
        sz = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e);
      knot.set(i, j, [sx * hw, y + 0.15 * Math.sin(v * Math.PI) * ca, cz + sz * hd]);
      knot.us[i] = a;
      knot.vs[j] = v;
    }
  }
  knot.computeNormals((k) => {
    const f = nf.at(knot.py[k]!);
    return [knot.px[k]!, 0, knot.pz[k]! - (f.cz + f.rz + 0.7)];
  });
  knot.alb.fill(0.82);
  // Tie blade down the shirt front: over the neck base, then the chest.
  const tie = new Grid(IDS.tie, 12, 30, "tie");
  for (let j = 0; j < 30; j++) {
    const v = j / 29;
    const y = lerp(-18.2, -31, v);
    const hw = lerp(1.05, 3.1, Math.pow(v, 0.9));
    const nfy = nf.at(y);
    const neckFront = nfy.cz + nfy.rz + 0.35;
    for (let i = 0; i < 12; i++) {
      const u = lerp(-1, 1, i / 11);
      const x = u * hw;
      const z = Math.max(neckFront, torsoFrontZ(x, y)) + 0.4 + 0.3 * (1 - u * u);
      tie.set(i, j, [x, y, z]);
      tie.us[i] = u;
      tie.vs[j] = v;
    }
  }
  tie.computeNormals(() => [0, 0.2, 1]);
  tie.alb.fill(0.8);
  // Shirt front under the collar: covers the neck base down to the chest.
  const shirt = new Grid(IDS.collar, 30, 12, "shirt");
  for (let j = 0; j < 12; j++) {
    const v = j / 11;
    const y = lerp(-16.4, -23.5, v);
    for (let i = 0; i < 30; i++) {
      const a = lerp(-1.05, 1.05, i / 29);
      const f = nf.at(y);
      const r = nf.radius(y, a) + 0.28 + 0.9 * v * v;
      shirt.set(i, j, [Math.sin(a) * r, y, f.cz + Math.cos(a) * r]);
      shirt.us[i] = a;
      shirt.vs[j] = v;
    }
  }
  shirt.computeNormals((k) => [shirt.px[k]!, 0.1, shirt.pz[k]! - nf.at(shirt.py[k]!).cz]);
  shirt.alb.fill(0);
  const pts: V3[] = [];
  const L = leaf(1),
    R = leaf(-1);
  for (const g of [L, R]) {
    const k = (g.nv - 1) * g.nu;
    pts.push([g.px[k]!, g.py[k]!, g.pz[k]!]);
  }
  return { leafL: L, leafR: R, jacketL: jacket(1), jacketR: jacket(-1), knot, tie, shirt, points: pts };
}

/**
 * The cap: band (black mohair), crown quarters (serge), top plate, and the
 * glossy peak. Built in head-local coords and posed with the head.
 */
export interface CapGeometry {
  band: Grid;
  crown: Grid;
  top: Grid;
  peak: Grid;
  /** Head-local points for the badge, cord and buttons. */
  badgeCentre: V3;
  badgeNormal: V3;
  bandFront: (theta: number, h: number) => V3;
  peakEdge: V3[];
  cordPts: V3[];
  buttons: V3[];
}

export const CAP = {
  cz: -0.6,
  rx: 8.05,
  rz: 10.05,
  y0f: 4.45, // band bottom at the front (worn a little back)
  y0b: 2.3, // band bottom at the back
  bandH: 3.9,
  topRx: 9.9,
  topRz: 11.7,
  topY: 11.6,
  tilt: 0.05,
};

function bandPoint(theta: number, h: number, outset = 0): V3 {
  // theta: 0 = front (+z). h: 0 bottom .. 1 top of band.
  const x = Math.sin(theta) * (CAP.rx + outset);
  const z = CAP.cz + Math.cos(theta) * (CAP.rz + outset);
  const front = (Math.cos(theta) + 1) / 2;
  const y0 = lerp(CAP.y0b, CAP.y0f, front);
  return [x, y0 + h * CAP.bandH, z];
}

export const PEAK_SPAN = 1.28;

/** Head-local point on the cap peak: a = angle around the band, t = 0 band .. 1 edge. */
export function peakPoint(a: number, t: number, lift = 0): V3 {
  const b = bandPoint(a, 0.02, 0.1);
  const reach = 4.7 * Math.cos((a / PEAK_SPAN) * (Math.PI / 2)) ** 0.7;
  const outDir = norm([Math.sin(a) * (CAP.rz / CAP.rx), 0, Math.cos(a) * (CAP.rx / CAP.rz)]);
  const drop = 0.4; // slope of the peak (radians below horizontal)
  const d = reach * t;
  // Curls down slightly toward its edge.
  const curl = 0.35 * t * t * reach * 0.2;
  return [b[0] + outDir[0] * d * Math.cos(drop), b[1] - d * Math.sin(drop) - curl + lift, b[2] + outDir[2] * d * Math.cos(drop)];
}

export { bandPoint };

export function buildCap(pose: Pose): CapGeometry {
  const pp = (p: V3) => posePoint(pose, p);
  const nu = 120;
  // Band.
  const band = new Grid(IDS.capBand, nu, 10, "capBand");
  band.wrapU = true;
  for (let j = 0; j < 10; j++)
    for (let i = 0; i < nu; i++) {
      const a = Math.PI + (i / nu) * Math.PI * 2; // seam at the back
      const h = j / 9;
      // Slight outward belly.
      band.set(i, j, pp(bandPoint(a, h, 0.12 * Math.sin(h * Math.PI))));
      band.us[i] = a;
      band.vs[j] = h;
    }
  const cc = pp([0, 6, CAP.cz]);
  band.computeNormals((k) => [band.px[k]! - cc[0], 0, band.pz[k]! - cc[2]]);
  band.alb.fill(0.84);

  // Crown quarters: from band top to the crown edge, bulging outward.
  const crown = new Grid(IDS.capCrown, nu, 16, "capCrown");
  crown.wrapU = true;
  for (let j = 0; j < 16; j++)
    for (let i = 0; i < nu; i++) {
      const a = Math.PI + (i / nu) * Math.PI * 2; // seam at the back
      const t = j / 15;
      const b = bandPoint(a, 1, 0.05);
      const front = (Math.cos(a) + 1) / 2;
      const topY = CAP.topY + (front - 0.5) * 2 * 0.9; // front sits higher (saddle)
      const e: V3 = [Math.sin(a) * CAP.topRx, topY, CAP.cz + 0.6 + Math.cos(a) * CAP.topRz];
      // Ease: the quarters flare outward then roll over the wire at the edge.
      const s = smoothstep(0, 1, t);
      const bulge = Math.sin(t * Math.PI) * 0.55;
      const x = lerp(b[0], e[0], Math.pow(t, 0.75)) + Math.sin(a) * bulge;
      const z = lerp(b[2], e[2], Math.pow(t, 0.75)) + Math.cos(a) * bulge;
      const y = lerp(b[1], e[1], s);
      crown.set(i, j, pp([x, y, z]));
      crown.us[i] = a;
      crown.vs[j] = t;
    }
  crown.computeNormals((k) => [crown.px[k]! - cc[0], (crown.py[k]! - cc[1]) * 0.3, crown.pz[k]! - cc[2]]);
  crown.alb.fill(0.5);

  // Top plate: a gently domed ellipse (polar grid).
  const top = new Grid(IDS.capTop, nu, 14, "capTop");
  top.wrapU = true;
  for (let j = 0; j < 14; j++)
    for (let i = 0; i < nu; i++) {
      const a = Math.PI + (i / nu) * Math.PI * 2; // seam at the back
      const r = 1 - j / 13; // j=0 rim, j=13 centre
      const front = (Math.cos(a) + 1) / 2;
      const rimY = CAP.topY + (front - 0.5) * 2 * 0.9;
      const y = lerp(rimY, CAP.topY + 0.55, 1 - r * r) + 0.02;
      top.set(i, j, pp([Math.sin(a) * CAP.topRx * r, y, CAP.cz + 0.6 + Math.cos(a) * CAP.topRz * r]));
      top.us[i] = a;
      top.vs[j] = r;
    }
  const up = poseDir(pose, [0, 1, 0]);
  top.computeNormals(() => up);
  top.alb.fill(0.5);

  // Peak: a crescent plate from the band's lower edge, sloping down.
  const pu = 60,
    pv = 12;
  const peak = new Grid(IDS.capPeak, pu, pv, "capPeak");
  peak.twoSided = true;
  const span = 1.28;
  const edge: V3[] = [];
  for (let j = 0; j < pv; j++)
    for (let i = 0; i < pu; i++) {
      const a = lerp(-span, span, i / (pu - 1));
      const t = j / (pv - 1);
      const p = peakPoint(a, t);
      peak.set(i, j, pp(p));
      peak.us[i] = a;
      peak.vs[j] = t;
      if (j === pv - 1) edge.push(p);
    }
  const peakUp = poseDir(pose, norm([0, 1, 0.6]));
  peak.computeNormals(() => peakUp);
  peak.alb.fill(1);

  const badgeCentre = bandPoint(0, 1.45, 0.3);
  const cordPts: V3[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = lerp(-1.3, 1.3, i / 40);
    cordPts.push(bandPoint(a, 0.28, 0.32));
  }
  return {
    band,
    crown,
    top,
    peak,
    badgeCentre,
    badgeNormal: [0, 0.15, 1],
    bandFront: (theta, h) => bandPoint(theta, h, 0.14),
    peakEdge: edge,
    cordPts,
    buttons: [bandPoint(-1.3, 0.28, 0.35), bandPoint(1.3, 0.28, 0.35)],
  };
}

export { sub };
