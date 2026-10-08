/**
 * The head as a star-shaped radial field around a centre inside the skull.
 *
 * R(dir) is the distance from HEAD_C to the skin along `dir`: the smooth
 * union of (a) the frontal face relief from face-field.ts, solved along the
 * ray, and (b) skull ellipsoids for the cranium, jaw, cheek sides, nape,
 * ears and eyelid mounds, plus radial bumps for soft tissue (bags, jowls).
 * Radial fields make hatching easy: latitude and longitude lines wrap the
 * form like an engraver's burin lines, and every feature curve can be
 * snapped onto the skin by projecting it from the centre.
 *
 * Head-local frame: cm, origin between the ear canals, +y up, +z the face,
 * +x the sitter's left.
 */
import { FaceTable, faceHalfWidth, faceParams, mouthLineY, type FaceParams } from "./face-field.ts";
import { clamp, cross, len, m3Transpose, norm, rotX, rotY, m3Mul, smax, smoothstep, sub, type M3, type V3 } from "./math.ts";
import type { Expr, Identity } from "./rig.ts";

export const HEAD_C: V3 = [0, -2.2, 0.6];

interface Ell {
  c: V3;
  r: V3;
  inv: M3 | null;
  k: number;
  axis: V3;
  cosCone: number;
  name: string;
}

interface Bump {
  b: V3;
  e1: V3;
  e2: V3;
  su: number;
  sv: number;
  amp: number;
  cosCut: number;
}

export interface Landmarks {
  eyeL: V3;
  eyeR: V3;
  eyeRadius: number;
  mouthL: V3;
  mouthR: V3;
  stomY: number;
  noseTipY: number;
  alaX: number;
  alaY: number;
  earL: V3;
  earR: V3;
  browY: number;
  earTilt: number;
  mouthW: number;
}

function ell(name: string, c: V3, r: V3, k: number, rot?: M3): Ell {
  const rel = sub(c, HEAD_C);
  const d = len(rel);
  const rmax = Math.max(r[0], r[1], r[2]);
  const inside = d <= rmax * 1.02;
  const cone = inside ? Math.PI : Math.asin(Math.min(1, (rmax + k) / d)) + 0.05;
  return {
    name,
    c,
    r,
    inv: rot ? m3Transpose(rot) : null,
    k,
    axis: d > 1e-6 ? [rel[0] / d, rel[1] / d, rel[2] / d] : [0, 0, 1],
    cosCone: inside ? -2 : Math.cos(Math.min(Math.PI, cone)),
  };
}

function tangentBasis(b: V3): { e1: V3; e2: V3 } {
  const c = cross([0, 1, 0], b);
  const e1 = len(c) < 1e-4 ? ([1, 0, 0] as V3) : norm(c);
  const e2 = cross(b, e1);
  return { e1, e2 };
}

function bump(p: V3, suCm: number, svCm: number, amp: number): Bump {
  const rel = sub(p, HEAD_C);
  const d = len(rel);
  const b: V3 = [rel[0] / d, rel[1] / d, rel[2] / d];
  const { e1, e2 } = tangentBasis(b);
  const su = suCm / d,
    sv = svCm / d;
  return { b, e1, e2, su, sv, amp, cosCut: Math.cos(Math.min(1.4, 3.2 * Math.max(su, sv))) };
}

export class HeadShape {
  readonly ells: Ell[] = [];
  readonly bumps: Bump[] = [];
  readonly lm: Landmarks;
  readonly fp: FaceParams;
  private faceK = 1.4;

  constructor(id: Identity, ex: Expr) {
    const m = id.masc;
    const fp = faceParams(id, ex);
    this.fp = fp;
    const E = this.ells;
    // Skull masses all contain HEAD_C so every ray exits them exactly once.
    E.push(ell("cranium", [0, 3.3, -1.9], [7.3 + 0.1 * m, 9.6, 8.7], 1.2));
    E.push(ell("midhead", [0, -3.4, 0.0], [6.45 * id.jawW ** 0.5, 5.6, 6.0], 1.6));
    E.push(ell("zygomatic", [0, -1.0, 1.0], [6.95 * id.cheek ** 0.4, 2.6, 6.2], 1.3));
    E.push(ell("jaw", [0, -5.3, 1.2], [5.25 * id.jawW, 6.3, 6.0 + 0.15 * m], 1.6, rotX(0.36)));
    E.push(ell("nape", [0, -5.2, -3.0], [5.4, 5.0, 6.2], 2.0));
    const eyeX = 3.08 * id.eyeSpacing;
    const eyeR = 1.2 * id.eyeSize;
    const eyeZ = 6.3;
    for (const s of [-1, 1]) E.push(ell("eyelid", [s * eyeX, 0.1, eyeZ], [eyeR + 0.14, eyeR + 0.14, eyeR + 0.14], 0.55));
    const earTilt = -0.22;
    const es = id.earSize;
    for (const s of [-1, 1]) {
      // Ear: the upper shell and the lobe, tilted back, flat against the head.
      const rot = m3Mul(rotX(earTilt), rotY(s * 0.32));
      E.push(ell("ear", [s * 7.0, -0.2 * es, -1.2], [0.75, 2.35 * es, 1.75 * es], 0.5, rot));
      E.push(ell("lobe", [s * 6.95, -2.75 * es, -0.55], [0.55, 0.9 * es, 0.85 * es], 0.45, rot));
    }

    const B = this.bumps;
    for (const s of [-1, 1]) {
      if (ex.bags > 0.01) {
        // Eye bags: a bulge under the lower lid, then the tear trough below.
        B.push(bump([s * (eyeX + 0.2), -1.4, 7.4], 1.05, 0.34, 0.22 * ex.bags));
        B.push(bump([s * (eyeX - 0.2), -2.0, 7.5], 1.25, 0.26, -0.16 * ex.bags));
      }
      if (ex.jowl > 0.01) B.push(bump([s * 4.1, -9.5, 5.4], 1.25, 1.0, 0.24 * ex.jowl));
    }
    if (ex.browInner > 0.01) for (const s of [-1, 1]) B.push(bump([s * 1.4, 2.3, 8.9], 0.85, 0.75, 0.1 * ex.browInner));

    const stomY = fp.stomY;
    const mw = 2.45 * id.mouthW + 0.2 * ex.cheekRaise;
    this.lm = {
      eyeL: [eyeX, 0.1, eyeZ],
      eyeR: [-eyeX, 0.1, eyeZ],
      eyeRadius: eyeR,
      mouthL: [mw, mouthLineY(fp, mw), 8.3],
      mouthR: [-mw, mouthLineY(fp, mw), 8.3],
      stomY,
      noseTipY: -3.8 * id.noseLen,
      alaX: 1.42 * id.noseW,
      alaY: -4.35 * id.noseLen - 0.2,
      earL: [7.1, -0.8, -1.05],
      earR: [-7.1, -0.8, -1.05],
      browY: 1.75,
      earTilt,
      mouthW: mw,
    };
  }

  private table: FaceTable | null = null;

  /** Build the relief table in steps (call before sampling in a time-sliced build). */
  *prepare(): Generator<void, void> {
    if (this.table) return;
    const t = new FaceTable(this.fp, true);
    yield* t.fill(this.fp);
    this.table = t;
  }

  /** Frontal relief with falloff above the brow line and below the chin. */
  faceDepth(x: number, y: number): number {
    if (!this.table) {
      const gen = this.prepare();
      while (!gen.next().done);
    }
    if (!this.table) return -1e9;
    let z = this.table.at(x, y);
    if (y > 7.5) z -= (y - 7.5) ** 2 * 2;
    if (y < -13.5) z -= (-13.5 - y) ** 2 * 2;
    return z;
  }

  /** Radial distance to the face relief along a ray (NaN if the ray misses it). */
  private faceRadius(dx: number, dy: number, dz: number): number {
    if (dz < 0.03) return NaN;
    const o = HEAD_C;
    const f = (r: number) => o[2] + r * dz - this.faceDepth(o[0] + r * dx, o[1] + r * dy);
    let a = 3,
      b = 17;
    let fa = f(a),
      fb = f(b);
    if (fa > 0 || fb < 0) return NaN;
    // Illinois regula falsi.
    let side = 0;
    let c = a;
    for (let i = 0; i < 18; i++) {
      c = (a * fb - b * fa) / (fb - fa);
      const fc = f(c);
      if (Math.abs(fc) < 0.004) break;
      if (fc > 0) {
        b = c;
        fb = fc;
        if (side === -1) fa *= 0.5;
        side = -1;
      } else {
        a = c;
        fa = fc;
        if (side === 1) fb *= 0.5;
        side = 1;
      }
    }
    return c;
  }

  /** Distance from HEAD_C to the skin along unit direction (dx,dy,dz). */
  radius(dx: number, dy: number, dz: number): number {
    // 1. Skull masses.
    let R = this.ellipsoids(dx, dy, dz, true, 0);
    // 2. The face relief, handed over to the skull at the sides of the face
    //    (blended radially so the two meet without a wall or a crease).
    const rf = this.faceRadius(dx, dy, dz);
    if (rf === rf) {
      const px = HEAD_C[0] + dx * rf,
        py = HEAD_C[1] + dy * rf;
      const u = Math.abs(px) / faceHalfWidth(this.fp, py);
      const side = Math.max(smoothstep(0.66, 1.04, u), 1 - smoothstep(0.02, 0.2, dz));
      const joined = smax(R, rf, this.faceK);
      R = joined + (R - joined) * side;
    }
    // 3. Lids and ears on top.
    R = this.ellipsoids(dx, dy, dz, false, R);
    for (const b of this.bumps) {
      const cd = dx * b.b[0] + dy * b.b[1] + dz * b.b[2];
      if (cd < b.cosCut) continue;
      const u = (dx * b.e1[0] + dy * b.e1[1] + dz * b.e1[2]) / b.su;
      const v = (dx * b.e2[0] + dy * b.e2[1] + dz * b.e2[2]) / b.sv;
      const q = u * u + v * v;
      if (q > 12) continue;
      R += b.amp * Math.exp(-q);
    }
    return R;
  }

  private ellipsoids(dx: number, dy: number, dz: number, skull: boolean, R0: number): number {
    const o = HEAD_C;
    let R = R0;
    let first = R0 <= 0;
    for (const e of this.ells) {
      if ((e.name === "eyelid" || e.name === "ear" || e.name === "lobe") === skull) continue;
      if (e.cosCone > -1.5 && dx * e.axis[0] + dy * e.axis[1] + dz * e.axis[2] < e.cosCone) continue;
      let ox = o[0] - e.c[0],
        oy = o[1] - e.c[1],
        oz = o[2] - e.c[2];
      let vx = dx,
        vy = dy,
        vz = dz;
      if (e.inv) {
        const m = e.inv;
        const a = m[0] * ox + m[1] * oy + m[2] * oz;
        const b = m[3] * ox + m[4] * oy + m[5] * oz;
        const c = m[6] * ox + m[7] * oy + m[8] * oz;
        ox = a;
        oy = b;
        oz = c;
        const va = m[0] * vx + m[1] * vy + m[2] * vz;
        const vb = m[3] * vx + m[4] * vy + m[5] * vz;
        const vc = m[6] * vx + m[7] * vy + m[8] * vz;
        vx = va;
        vy = vb;
        vz = vc;
      }
      ox /= e.r[0];
      oy /= e.r[1];
      oz /= e.r[2];
      vx /= e.r[0];
      vy /= e.r[1];
      vz /= e.r[2];
      const A = vx * vx + vy * vy + vz * vz;
      const Bq = 2 * (ox * vx + oy * vy + oz * vz);
      const C = ox * ox + oy * oy + oz * oz - 1;
      const disc = Bq * Bq - 4 * A * C;
      // Rays that miss a part get a continuous "virtual exit" that falls away
      // quickly, so smooth unions never jump at a part's silhouette.
      const sq = Math.sqrt(Math.abs(disc));
      const tExit = disc >= 0 ? (-Bq + sq) / (2 * A) : (-Bq - 3 * sq) / (2 * A);
      if (tExit <= 0) continue;
      if (first) {
        R = tExit;
        first = false;
        continue;
      }
      R = smax(R, tExit, e.k);
    }
    return R;
  }

  /** Snap a head-local point radially onto the skin (plus an outward offset). */
  snap(p: V3, lift = 0): V3 {
    const rel = sub(p, HEAD_C);
    const d = len(rel) || 1;
    const dx = rel[0] / d,
      dy = rel[1] / d,
      dz = rel[2] / d;
    const r = this.radius(dx, dy, dz) + lift;
    return [HEAD_C[0] + dx * r, HEAD_C[1] + dy * r, HEAD_C[2] + dz * r];
  }

  /**
   * Snap a point onto the face relief along +z (frontal projection); better
   * than radial snapping for curves drawn on the front of the face.
   */
  onFace(x: number, y: number, lift = 0): V3 {
    const p = this.snap([x, y, this.faceDepth(x, y)], lift);
    return p;
  }
}

/** Unit direction for longitude θ (0 = face, +π/2 = sitter's left) and latitude φ. */
export function dirOf(theta: number, phi: number): V3 {
  const c = Math.cos(phi);
  return [c * Math.sin(theta), Math.sin(phi), c * Math.cos(theta)];
}

export function angOf(p: V3): { theta: number; phi: number } {
  const rel = sub(p, HEAD_C);
  const d = len(rel) || 1;
  return { theta: Math.atan2(rel[0], rel[2]), phi: Math.asin(clamp(rel[1] / d, -1, 1)) };
}
