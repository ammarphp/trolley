/**
 * Feature strokes: the lines an illustrator draws on top of the modelled
 * form. Brows as individual hairs, lid creases, the alar crease and nostril,
 * the mouth line and its corners, folds and wrinkles driven by expression,
 * the ear's anatomy, hair, stubble, and the cap's badge, cord and buttons.
 *
 * Face features are authored in head-local frontal coordinates (x, y) and
 * snapped onto the skin, so they follow the modelled relief, turn with the
 * head, and hide behind the nose or cheek like any other stroke.
 */
import { createRng, type Rng } from "../core/rng.ts";
import { mouthLineY } from "./face-field.ts";
import { clamp, lerp, m3Apply, m3Mul, posePoint, project, rotX, rotY, smoothstep, type V3 } from "./math.ts";
import { Ribbons } from "./engrave.ts";
import type { BustScene } from "./scene.ts";
import { CAP, bandPoint, peakPoint } from "./surfaces.ts";

export interface Proj {
  x: number;
  y: number;
  z: number;
  vis: boolean;
}

const tmp = new Float32Array(3);

/** Projects head-local / bust-frame points and strokes them with visibility. */
export class FeaturePen {
  readonly sc: BustScene;
  readonly ink: Ribbons;
  readonly white: Ribbons;
  tol = 0.35;
  /** Stroke weight multiplier (features are drawn for the mirror's reduced size). */
  weight = 1;
  constructor(sc: BustScene, ink: Ribbons, white: Ribbons) {
    this.sc = sc;
    this.ink = ink;
    this.white = white;
  }

  /** Head-local point → screen (posed with the head). */
  headPoint(p: V3): Proj {
    const q = posePoint(this.sc.headPose, p);
    return this.bustPoint(q);
  }
  bustPoint(q: V3): Proj {
    project(this.sc.cam, q[0], q[1], q[2], tmp, 0);
    const x = tmp[0]!,
      y = tmp[1]!,
      z = tmp[2]!;
    const zb = this.sc.zbuf.at(x, y);
    return { x, y, z, vis: z <= zb + this.tol };
  }
  /** Face-coordinate point snapped onto the skin. */
  face(x: number, y: number, lift = 0.02): Proj {
    return this.headPoint(this.sc.shape.onFace(x, y, lift));
  }

  /** Resample a polyline of 2D control points by arc length (Catmull-Rom). */
  static curve(ctrl: Array<[number, number]>, step: number): Array<[number, number]> {
    if (ctrl.length < 2) return ctrl.slice();
    const out: Array<[number, number]> = [];
    const n = ctrl.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)]!,
        p1 = ctrl[i]!,
        p2 = ctrl[i + 1]!,
        p3 = ctrl[Math.min(n - 1, i + 2)]!;
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const m = Math.max(1, Math.ceil(segLen / step));
      for (let k = 0; k < m; k++) {
        const t = k / m,
          t2 = t * t,
          t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(ctrl[n - 1]!);
    return out;
  }

  /** Stroke a face-coordinate curve. `width(t)` in px along the curve. */
  faceStroke(ctrl: Array<[number, number]>, width: (t: number) => number, o: { lift?: number; white?: boolean; step?: number; taper?: number } = {}): void {
    const pts = FeaturePen.curve(ctrl, o.step ?? 0.07);
    const out = o.white ? this.white : this.ink;
    out.begin();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i]!;
      const p = this.face(x, y, o.lift ?? 0.03);
      const w = width(n > 1 ? i / (n - 1) : 0) * this.weight;
      if (!p.vis || w < 0.2) {
        out.end(o.taper ?? 0.5);
        continue;
      }
      out.push(p.x, p.y, w);
    }
    out.end(o.taper ?? 0.5);
  }

  /** Stroke head-local 3D points (already on or near the skin). */
  headStroke(pts: V3[], width: (t: number) => number, o: { snap?: boolean; lift?: number; white?: boolean; taper?: number } = {}): void {
    const out = o.white ? this.white : this.ink;
    out.begin();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const q = o.snap ? this.sc.shape.snap(pts[i]!, o.lift ?? 0.03) : pts[i]!;
      const p = this.headPoint(q);
      const w = width(n > 1 ? i / (n - 1) : 0) * this.weight;
      if (!p.vis || w < 0.2) {
        out.end(o.taper ?? 0.5);
        continue;
      }
      out.push(p.x, p.y, w);
    }
    out.end(o.taper ?? 0.5);
  }

  bustStroke(pts: V3[], width: (t: number) => number, o: { white?: boolean; taper?: number } = {}): void {
    const out = o.white ? this.white : this.ink;
    out.begin();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.bustPoint(pts[i]!);
      const w = width(n > 1 ? i / (n - 1) : 0) * this.weight;
      if (!p.vis || w < 0.2) {
        out.end(o.taper ?? 0.5);
        continue;
      }
      out.push(p.x, p.y, w);
    }
    out.end(o.taper ?? 0.5);
  }

  /** Filled polygon from face-coordinate points (all-or-nothing visibility by majority). */
  faceFill(ctrl: Array<[number, number]>, o: { lift?: number; white?: boolean } = {}): void {
    const pts = ctrl.map(([x, y]) => this.face(x, y, o.lift ?? 0.03));
    const visible = pts.filter((p) => p.vis).length;
    if (visible < pts.length * 0.6) return;
    const path = (o.white ? this.white : this.ink).path;
    path.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i]!.x, pts[i]!.y);
    path.closePath();
  }

  headFill(pts3: V3[], o: { white?: boolean; snap?: boolean } = {}): void {
    const pts = pts3.map((p) => this.headPoint(o.snap ? this.sc.shape.snap(p, 0.04) : p));
    const visible = pts.filter((p) => p.vis).length;
    if (visible < pts.length * 0.6) return;
    const path = (o.white ? this.white : this.ink).path;
    path.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i]!.x, pts[i]!.y);
    path.closePath();
  }
}

const bell = (t: number, peak = 0.5, p = 1) => {
  const u = t < peak ? t / peak : (1 - t) / (1 - peak);
  return Math.pow(clamp(u), p);
};

/** Brow shape (face coords) for one side, with expression applied. */
function browCurve(sc: BustScene, s: number): { pts: Array<[number, number]>; thick: (u: number) => number } {
  const { id, ex } = sc;
  const xs = [1.3, 2.15, 3.05, 3.95, 4.72, 5.35];
  const arch = 0.18 + 0.28 * id.browArch;
  const base = sc.shape.lm.browY - 0.62 + id.browHeight * 0.3;
  const ys = [0.0, 0.28, 0.46 + arch * 0.4, 0.5 + arch * 0.55, 0.36 + arch * 0.3, 0.1];
  const knit = ex.browKnit;
  const pts: Array<[number, number]> = xs.map((x, i) => {
    const inner = 1 - smoothstep(1.3, 3.6, x);
    const outer = smoothstep(3.2, 5.3, x);
    let y = base + ys[i]! + ex.browInner * 1.25 * inner + ex.browOuter * 0.8 * outer - knit * 0.12 * inner;
    // Grief: the inner head tilts up, the tail falls: the "omega" brow.
    y += ex.grief * 0.12 * (inner - outer) * (1 - ex.dissoc * 0.6);
    const xx = x - knit * 0.18 * inner;
    return [s * xx, y];
  });
  const th = id.browThick;
  return {
    pts,
    thick: (u) => th * (0.34 * (1 - u) + 0.1 + 0.08 * Math.sin(u * Math.PI)),
  };
}

export function drawFeatures(sc: BustScene, pen: FeaturePen): void {
  const gen = drawFeaturesSteps(sc, pen);
  while (!gen.next().done);
}

export function* drawFeaturesSteps(sc: BustScene, pen: FeaturePen): Generator<void, void> {
  const { id, ex, shape } = sc;
  const rng = createRng(id.seed ^ 0x5eed);
  const fp = shape.fp;
  const lm = shape.lm;
  const aft = 1 - ex.after * 0.75; // afterimage fades the likeness

  for (const s of [1, -1]) {
    const near = s > 0 ? 1 : 0.85;
    drawBrow(sc, pen, s, rng.fork(`brow${s}`), aft);
    yield;
    // Upper lid crease: rises with shock, sinks under hooding and fatigue.
    const ex0 = s * lm.eyeL[0];
    const lift = 0.1 * ex.shock - 0.18 * ex.fatigue - 0.25 * id.hooded;
    const cy = lm.eyeL[1];
    const crease: Array<[number, number]> = [
      [s * (Math.abs(ex0) - 1.12), cy + 0.62],
      [s * (Math.abs(ex0) - 0.6), cy + 1.02 + lift * 0.6],
      [s * Math.abs(ex0), cy + 1.14 + lift],
      [s * (Math.abs(ex0) + 0.62), cy + 1.02 + lift * 0.7],
      [s * (Math.abs(ex0) + 1.18), cy + 0.66],
    ];
    const creaseW = (1.6 - 0.6 * id.hooded) * near * aft;
    pen.faceStroke(crease, (t) => creaseW * bell(t, 0.55, 0.7) + 0.2);
    // A second, fainter fold above for tired, heavy lids.
    if (ex.fatigue + ex.age > 0.5)
      pen.faceStroke(
        crease.map(([x, y]) => [x * 1.02, y + 0.32]),
        (t) => (ex.fatigue * 0.6 + ex.age * 0.4 - 0.25) * 1.3 * bell(t, 0.5, 1) * aft,
      );
    // Bags under the eyes: the lid's lower fold, the puffed pouch hatched
    // with short curved strokes, and the tear-trough line beneath it.
    if (ex.bags > 0.08) {
      const b = ex.bags;
      const bx = Math.abs(ex0);
      pen.faceStroke(
        [
          [s * (bx - 1.05), cy - 0.92],
          [s * (bx - 0.2), cy - 1.3 - 0.12 * b],
          [s * (bx + 0.75), cy - 1.14 - 0.06 * b],
          [s * (bx + 1.25), cy - 0.8],
        ],
        (t) => b * 1.9 * bell(t, 0.45, 0.8) * aft,
      );
      if (b > 0.3) {
        for (let k = 0; k < 3; k++) {
          const o = 0.18 + k * 0.14;
          pen.faceStroke(
            [
              [s * (bx - 0.75), cy - 0.95 - o],
              [s * (bx + 0.05), cy - 1.2 - o - 0.1 * b],
              [s * (bx + 0.85), cy - 1.02 - o],
            ],
            (t) => (b - 0.25) * (1.1 - k * 0.25) * bell(t, 0.5, 1) * aft,
          );
        }
        pen.faceStroke(
          [
            [s * (bx - 1.05), cy - 1.45],
            [s * (bx - 0.1), cy - 1.9 - 0.08 * b],
            [s * (bx + 0.9), cy - 1.72],
          ],
          (t) => (b - 0.25) * 1.05 * bell(t, 0.45, 1.1) * aft,
        );
      }
    }
    // Crow's feet.
    if (ex.crowFeet > 0.12) {
      const ox = Math.abs(ex0) + 1.35,
        oy = cy + 0.08;
      const n = 2 + Math.round(ex.crowFeet * 2);
      for (let k = 0; k < n; k++) {
        const ang = lerp(0.55, -0.55, k / Math.max(1, n - 1)) + rng.range(-0.08, 0.08);
        const len = 0.45 + 0.3 * ex.crowFeet + rng.range(-0.1, 0.1);
        const x0 = ox + 0.15,
          y0 = oy + Math.sin(ang) * 0.2;
        pen.faceStroke(
          [
            [s * x0, y0],
            [s * (x0 + Math.cos(ang) * len * 0.55), y0 + Math.sin(ang) * len * 0.55 + 0.03],
            [s * (x0 + Math.cos(ang) * len), y0 + Math.sin(ang) * len],
          ],
          (t) => ex.crowFeet * 1.0 * (1 - t) * aft,
        );
      }
    }
    // Nasolabial fold.
    const mw = lm.mouthW;
    const ym = mouthLineY(fp, mw);
    const nl = ex.nasolabial;
    pen.faceStroke(
      [
        [s * (lm.alaX + 0.62), lm.alaY + 0.5],
        [s * (lm.alaX + 0.98), lm.alaY - 0.55],
        [s * (mw + 0.42 + 0.2 * ex.cheekRaise), ym + 0.25 + ex.mouthCorner * 0.3],
        [s * (mw + 0.5), ym - 0.85],
      ],
      (t) => (0.15 + 0.25 * id.masc + 1.6 * nl) * near * bell(t, 0.3, 0.8) * aft,
    );
    // Marionette lines.
    const mar = clamp(ex.age * 0.55 + ex.frown * 0.45 + ex.grief * 0.35 - 0.25);
    if (mar > 0.02)
      pen.faceStroke(
        [
          [s * (mw + 0.05), ym - 0.35],
          [s * (mw + 0.2), ym - 1.2],
          [s * (mw + 0.15), ym - 2.1],
        ],
        (t) => mar * 1.5 * bell(t, 0.3, 1) * aft,
      );
    // Alar crease and nostril.
    const ax = lm.alaX,
      ay = lm.alaY;
    pen.faceStroke(
      [
        [s * (ax - 0.1), ay + 0.72],
        [s * (ax + 0.55), ay + 0.45],
        [s * (ax + 0.78), ay - 0.12],
        [s * (ax + 0.45), ay - 0.62],
        [s * (ax - 0.15), ay - 0.72],
      ],
      (t) => (0.6 + 1.5 * smoothstep(0.2, 0.75, t)) * aft,
    );
    pen.faceFill(
      [
        [s * (ax - 0.2), ay - 0.64],
        [s * (ax - 0.55), ay - 0.56],
        [s * (ax - 0.88), ay - 0.66],
        [s * (ax - 0.62), ay - 0.76],
        [s * (ax - 0.3), ay - 0.76],
      ],
      { lift: 0.05 },
    );
    // Philtrum ridges.
    pen.faceStroke(
      [
        [s * 0.34, lm.noseTipY - 1.55],
        [s * 0.4, ym + 0.95],
        [s * 0.46, ym + 0.72],
      ],
      (t) => 0.7 * bell(t, 0.7, 1) * aft,
    );
    // Mouth-corner marks.
    const cx = mw,
      cyM = ym;
    const up = ex.mouthCorner;
    pen.faceStroke(
      [
        [s * (cx - 0.25), cyM + 0.02],
        [s * (cx + 0.1), cyM + up * 0.25],
        [s * (cx + 0.28), cyM + up * 0.55 + (up > 0 ? 0.1 : -0.12)],
      ],
      (t) => (1.2 + 0.6 * Math.abs(up)) * (1 - t * 0.7) * aft,
    );
  }

  yield;
  // Mouth: the parting line, heavy at the centre, lifting at the corners.
  {
    const mw = lm.mouthW;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const x = lerp(-mw, mw, i / 16);
      pts.push([x, mouthLineY(fp, Math.abs(x)) + 0.01]);
    }
    const open = ex.mouthOpen;
    pen.faceStroke(pts, (t) => (1.1 + 2.1 * Math.pow(Math.sin(t * Math.PI), 0.55) + open * 6 * Math.sin(t * Math.PI)) * aft, { lift: 0.08 });
    // Lower lip shadow and the mentolabial crease.
    const ly = mouthLineY(fp, 0) - 1.02 * id.lipFull - open * 0.5;
    pen.faceStroke(
      [
        [-1.05, ly + 0.12],
        [-0.4, ly - 0.02],
        [0.4, ly - 0.02],
        [1.05, ly + 0.12],
      ],
      (t) => 1.25 * bell(t, 0.5, 0.8) * aft,
    );
    pen.faceStroke(
      [
        [-0.9, ly - 0.72],
        [0, ly - 0.86],
        [0.9, ly - 0.72],
      ],
      (t) => (0.5 + 0.5 * ex.grief) * bell(t, 0.5, 1) * aft,
    );
    // Lips modelled the engraver's way: the upper lip, facing down, carries a
    // few curved strokes; the lower lip is left bright with a dark underside.
    for (let k = 0; k < 4; k++) {
      const f = (k + 1) / 5;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 10; i++) {
        const x = lerp(-mw * 0.82, mw * 0.82, i / 10);
        const y0 = mouthLineY(fp, Math.abs(x));
        const top = mouthLineY(fp, 0) + 0.55 * id.lipFull - 0.35 * (Math.abs(x) / mw) ** 2 + (y0 - mouthLineY(fp, 0));
        pts.push([x, lerp(y0 + 0.08, top, f)]);
      }
      pen.faceStroke(pts, (t) => (0.95 - f * 0.45) * Math.pow(Math.sin(Math.PI * t), 0.6) * aft, { lift: 0.06 });
    }
    for (let k = 0; k < 3; k++) {
      const f = k / 3;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 8; i++) {
        const x = lerp(-mw * 0.6, mw * 0.6, i / 8);
        pts.push([x, ly + 0.16 - f * 0.12 + 0.12 * (Math.abs(x) / mw) ** 2]);
      }
      pen.faceStroke(pts, (t) => (0.8 - f * 0.25) * Math.sin(Math.PI * t) * aft, { lift: 0.06 });
    }
    // Upper lip vermilion border, faint.
    const uy = mouthLineY(fp, 0) + 0.62 * id.lipFull;
    pen.faceStroke(
      [
        [-mw * 0.72, uy - 0.2],
        [-0.45, uy + 0.12],
        [0, uy - 0.02],
        [0.45, uy + 0.12],
        [mw * 0.72, uy - 0.2],
      ],
      (t) => 0.75 * bell(t, 0.5, 0.6) * aft,
    );
  }

  // Forehead furrows between brow and band.
  if (ex.forehead > 0.1) {
    for (let k = 0; k < 2; k++) {
      const y = 2.55 + k * 0.45;
      const f = ex.forehead;
      const omega = ex.grief * 0.25;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 10; i++) {
        const x = lerp(-3.2, 3.2, i / 10);
        pts.push([x, y + omega * Math.exp(-(x * x) / 1.2) + rng.range(-0.04, 0.04)]);
      }
      pen.faceStroke(pts, (t) => f * (1.05 - k * 0.3) * (0.4 + 0.6 * Math.sin(t * Math.PI)) * aft);
    }
  }
  // Glabellar furrows.
  if (ex.browKnit > 0.15) {
    for (const s of [1, -1])
      pen.faceStroke(
        [
          [s * 0.42, 1.35],
          [s * 0.36, 1.85],
          [s * 0.48, 2.35],
        ],
        (t) => ex.browKnit * 1.4 * bell(t, 0.5, 0.8) * aft,
      );
  }
  yield;
  if (id.moustache) drawMoustache(sc, pen, rng.fork("tache"), aft);
  // A mole: a small individual mark that makes the face this face.
  if (id.mole) {
    const p = pen.face(id.mole[0], id.mole[1], 0.05);
    if (p.vis) {
      pen.ink.path.moveTo(p.x + 1.7, p.y);
      pen.ink.path.arc(p.x, p.y, 1.7 * aft, 0, Math.PI * 2);
    }
  }
  // Stubble: stipple on the beard.
  if (ex.stubble > 0.02) stubble(sc, pen, rng.fork("stubble"), ex.stubble * aft);
  // Chin dimpling in grief.
  if (ex.grief > 0.35) {
    const r2 = rng.fork("chin");
    const n = Math.round((ex.grief - 0.3) * 30);
    for (let k = 0; k < n; k++) {
      const x = r2.range(-1.3, 1.3),
        y = r2.range(-11.0, -9.6);
      pen.faceStroke(
        [
          [x, y],
          [x + 0.12, y - 0.06],
        ],
        () => 0.8 * aft,
      );
    }
  }
  yield;
  drawEar(sc, pen, 1);
  yield;
  const w0 = pen.weight;
  pen.weight = Math.min(w0, 1.15);
  drawHair(sc, pen, rng.fork("hair"));
  pen.weight = w0;
}

/**
 * A full chevron moustache: it spans the whole upper lip and droops just past
 * the mouth corners, parted at the philtrum, drawn as visible hair strokes
 * that sweep down and outward (never a solid block).
 */
function drawMoustache(sc: BustScene, pen: FeaturePen, rng: Rng, aft: number): void {
  const fp = sc.shape.fp;
  const lm = sc.shape.lm;
  const mw = lm.mouthW + 0.35;
  const tone = (0.55 + 0.35 * sc.id.hairTone) * (1 - 0.5 * sc.id.grey);
  const top = lm.noseTipY - 1.5;
  for (let k = 0; k < 200; k++) {
    const u = rng.range(-1, 1);
    if (Math.abs(u) < 0.05) continue; // the parting
    const ax = Math.abs(u) * mw;
    const x = u * mw;
    const ym = mouthLineY(fp, Math.min(ax, lm.mouthW));
    // Root: from under the nose down to the lip, following the lip's curve.
    const rootTop = top - 0.25 * (ax / mw) ** 2 - 0.5 * smoothstep(0.6, 1, ax / mw);
    const y0 = lerp(ym + 0.3, rootTop, Math.pow(rng.next(), 0.8));
    const len = rng.range(0.5, 0.85) * (0.8 + 0.4 * (ax / mw));
    const a = -Math.PI / 2 - Math.sign(u) * (0.3 + 0.75 * Math.abs(u)) + rng.range(-0.12, 0.12);
    const dx = Math.cos(a) * len,
      dy = Math.sin(a) * len;
    const endY = Math.max(ym - 0.12 - 0.35 * smoothstep(0.75, 1, ax / mw), y0 + dy);
    pen.faceStroke(
      [
        [x, y0],
        [x + dx * 0.55, y0 + dy * 0.5],
        [x + dx, endY],
      ],
      (t) => (0.95 * (1 - t * 0.7) * tone + 0.12) * aft,
      { step: 0.1, taper: 0.8, lift: 0.1 },
    );
  }
}

/** Round wire spectacles, drawn on the per-frame overlay above the eyes. */
export function drawSpectacles(sc: BustScene, pen: FeaturePen): void {
  const lm = sc.shape.lm;
  const shape = sc.shape;
  pen.tol = 0.8;
  const rim = (s: number): V3[] => {
    const cx = s * Math.abs(lm.eyeL[0]),
      cy = lm.eyeL[1] - 0.05;
    const pts: V3[] = [];
    for (let k = 0; k <= 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = cx + Math.cos(a) * 1.55,
        y = cy + Math.sin(a) * 1.35;
      // The lens plane follows the face's curve, ~1.4 cm proud of the skin.
      const z = shape.faceDepth(s * Math.max(Math.abs(x), 1.2), cy) * 0 + 8.95 - 0.12 * (Math.abs(x) - 2.2) ** 2 * 0.25;
      pts.push([x, y, z]);
    }
    return pts;
  };
  for (const s of [1, -1]) {
    const r = rim(s);
    pen.headStroke(r, (t) => 1.5 + 0.5 * Math.max(0, Math.sin(t * Math.PI * 2 - 1.2)));
    // Glint across the lens.
    const g0 = r[5]!,
      g1 = r[13]!;
    const mid: V3 = [(g0[0] + g1[0]) / 2 - s * 0.35, (g0[1] + g1[1]) / 2 - 0.35, (g0[2] + g1[2]) / 2 + 0.05];
    pen.headStroke([g0, mid, g1], (t) => 2.4 * Math.sin(Math.PI * t), { white: true });
    // Temple arm back toward the ear.
    const outer = r[s > 0 ? 0 : 20]!;
    const ear = s > 0 ? lm.earL : lm.earR;
    pen.headStroke(
      [outer, [outer[0] + s * 0.9, outer[1] + 0.25, outer[2] - 1.2], [ear[0] + s * 0.45, ear[1] + 2.0, ear[2] + 0.4]],
      (t) => 1.4 - 0.4 * t,
      { lift: 0.3 },
    );
  }
  // Bridge over the nose.
  pen.headStroke(
    [
      [Math.abs(lm.eyeL[0]) - 1.5, lm.eyeL[1] + 0.25, 8.95],
      [0.6, lm.eyeL[1] + 0.55, 9.55],
      [-0.6, lm.eyeL[1] + 0.55, 9.55],
      [-(Math.abs(lm.eyeL[0]) - 1.5), lm.eyeL[1] + 0.25, 8.95],
    ],
    () => 1.5,
  );
}

function drawBrow(sc: BustScene, pen: FeaturePen, s: number, rng: Rng, aft: number): void {
  const { id } = sc;
  const { pts, thick } = browCurve(sc, s);
  const curve = FeaturePen.curve(pts, 0.05);
  const n = curve.length;
  const hairs = Math.round(140 * id.browThick);
  const tone = (0.75 + 0.5 * id.hairTone) * (1 - 0.35 * id.grey * sc.ex.age);
  // Outline of the brow mass as a soft lower edge (engravers anchor it).
  pen.faceStroke(
    pts.map(([x, y], i) => [x, y - thick(i / (pts.length - 1)) * 0.7] as [number, number]),
    (t) => 0.9 * tone * bell(t, 0.3, 0.5) * aft,
  );
  for (let k = 0; k < hairs; k++) {
    // Denser at the head, sparse at the tail.
    const u = Math.pow(rng.next(), 1.25);
    // An old scar leaves a hairless notch in the brow.
    if (id.browScar === s && Math.abs(u - 0.58) < 0.045) continue;
    const i = Math.min(n - 1, Math.floor(u * (n - 1)));
    const [cx, cy] = curve[i]!;
    const th = thick(u);
    const v = rng.range(-1, 1);
    const x0 = cx,
      y0 = cy + v * th * 0.8;
    // Growth direction: up at the head, lateral-up on the body, down at the tail.
    const ang = u < 0.12 ? lerp(1.35, 0.9, u / 0.12) : u < 0.62 ? lerp(0.62, 0.22, (u - 0.12) / 0.5) : lerp(0.18, -0.35, (u - 0.62) / 0.38);
    const a = ang + rng.range(-0.18, 0.18) - v * 0.12;
    const len = (0.38 + 0.22 * (1 - u)) * rng.range(0.8, 1.15);
    const dx = s * Math.cos(a) * len,
      dy = Math.sin(a) * len;
    pen.faceStroke(
      [
        [x0, y0],
        [x0 + dx * 0.5, y0 + dy * 0.5 + 0.02],
        [x0 + dx, y0 + dy],
      ],
      (t) => (1.35 * (1 - t * 0.85) * tone + 0.15) * aft,
      { step: 0.12, taper: 0.8 },
    );
  }
}

function stubble(sc: BustScene, pen: FeaturePen, rng: Rng, amount: number): void {
  const lm = sc.shape.lm;
  const fp = sc.shape.fp;
  const n = Math.round(1700 * amount);
  const path = pen.ink.path;
  for (let k = 0; k < n; k++) {
    const x = rng.range(-6.2, 6.2);
    const y = rng.range(-12.6, -2.8);
    const ax = Math.abs(x);
    const ym = mouthLineY(fp, Math.min(ax, lm.mouthW));
    // Beard mask: below the cheek line, not on the lips, not on the nose.
    const cheekLine = -3.4 - 0.25 * ax - 1.2 * smoothstep(3.5, 6.5, ax) * -1;
    if (y > cheekLine) continue;
    if (ax < lm.mouthW + 0.1 && y < ym + 0.72 && y > ym - 1.0) continue;
    if (ax < lm.alaX + 0.7 && y > lm.alaY - 0.8) continue;
    if (ax > 5.6 && y > -6) continue;
    const p = pen.face(x, y, 0.05);
    if (!p.vis) continue;
    // A bristle: a tiny tapered dash growing downward and slightly outward.
    const len = rng.range(0.9, 1.7) * (0.6 + 0.4 * amount);
    const a = Math.PI / 2 + rng.range(-0.5, 0.5) + (x > 0 ? -0.25 : 0.25);
    const ux = Math.cos(a) * len,
      uy = Math.sin(a) * len;
    const w = rng.range(0.22, 0.34);
    path.moveTo(p.x - uy * w, p.y + ux * w);
    path.lineTo(p.x + ux, p.y + uy);
    path.lineTo(p.x + uy * w, p.y - ux * w);
    path.closePath();
  }
}

const EAR_OUTLINE: Array<[number, number]> = [
  [1.0, -0.75],
  [1.75, -0.35],
  [2.02, 0.25],
  [1.72, 0.95],
  [0.95, 1.25],
  [0.0, 1.2],
  [-0.9, 0.95],
  [-1.8, 0.62],
  [-2.55, 0.35],
  [-2.95, -0.05],
  [-2.8, -0.45],
  [-2.25, -0.55],
];

function earFrame(sc: BustScene, s: number): (v: number, w: number) => V3 {
  const lm = sc.shape.lm;
  const es = sc.id.earSize;
  const rot = m3Mul(rotX(lm.earTilt), rotY(s * 0.32));
  const up = m3Apply(rot, [0, 1, 0]);
  const back = m3Apply(rot, [0, 0, -1]);
  const c: V3 = [s * 7.0, -0.55 * es, -1.2];
  return (v, w) => [c[0] + (up[0] * v + back[0] * w) * es, c[1] + (up[1] * v + back[1] * w) * es, c[2] + (up[2] * v + back[2] * w) * es];
}

/** Screen polygon of the near ear (for reserving it from the light hatching). */
export function earPolygon(sc: BustScene): Array<[number, number]> {
  const E = earFrame(sc, 1);
  const tmpP = new Float32Array(3);
  return FeaturePen.curve([...EAR_OUTLINE, [1.0, -0.75]], 0.25).map(([v, w]) => {
    const q = posePoint(sc.headPose, sc.shape.snap(E(v * 0.92, w * 0.9), 0.05));
    project(sc.cam, q[0], q[1], q[2], tmpP, 0);
    return [tmpP[0]!, tmpP[1]!] as [number, number];
  });
}

/** The near ear: helix, antihelix, concha and lobe, drawn on the ear plate. */
function drawEar(sc: BustScene, pen: FeaturePen, s: number): void {
  const E = earFrame(sc, s);
  const outline = EAR_OUTLINE;
  const sm = FeaturePen.curve(outline, 0.08).map(([v, w]) => sc.shape.snap(E(v, w), 0.05));
  // A thin paper halo separates the ear from the hair and shadow around it.
  pen.headStroke(sm, (t) => 3.2 + 1.4 * smoothstep(0.25, 0.7, t), { taper: 0.9, white: true });
  pen.headStroke(sm, (t) => 1.3 + 1.0 * smoothstep(0.25, 0.7, t), { taper: 0.6 });
  // Inner helix rim.
  const inner = FeaturePen.curve(
    outline.slice(1, 8).map(([v, w]) => [v * 0.82 - 0.05, w * 0.78 - 0.02] as [number, number]),
    0.08,
  ).map(([v, w]) => sc.shape.snap(E(v, w), 0.05));
  pen.headStroke(inner, (t) => 0.9 * bell(t, 0.5, 0.6));
  // Antihelix: a Y from the lower concha up to the fossa.
  const anti = FeaturePen.curve(
    [
      [-1.2, 0.2],
      [-0.4, 0.55],
      [0.5, 0.62],
      [1.25, 0.28],
    ],
    0.08,
  ).map(([v, w]) => sc.shape.snap(E(v, w), 0.05));
  pen.headStroke(anti, (t) => 1.2 * bell(t, 0.4, 0.6));
  // Concha: the dark bowl, and the tragus in front of it.
  const concha: Array<[number, number]> = [
    [-0.15, -0.3],
    [-0.05, 0.05],
    [-0.45, 0.3],
    [-0.95, 0.22],
    [-1.05, -0.1],
    [-0.7, -0.32],
  ];
  pen.headFill(
    FeaturePen.curve(concha, 0.12).map(([v, w]) => E(v, w)),
    { snap: true },
  );
  const tragus = FeaturePen.curve(
    [
      [-0.2, -0.6],
      [-0.65, -0.52],
      [-1.05, -0.58],
    ],
    0.08,
  ).map(([v, w]) => sc.shape.snap(E(v, w), 0.05));
  pen.headStroke(tragus, (t) => 1.3 * bell(t, 0.5, 0.6));
  const lobe = FeaturePen.curve(
    [
      [-1.9, -0.15],
      [-2.35, 0.1],
      [-2.5, 0.35],
    ],
    0.08,
  ).map(([v, w]) => sc.shape.snap(E(v, w), 0.05));
  pen.headStroke(lobe, (t) => 0.8 * bell(t, 0.5, 1));
}

/** Screen-space outlined ribbon: white body, black edges (cords, piping). */
function outlinedRibbon(pen: FeaturePen, pts: Array<[number, number, boolean]>, width: number, ticks: number): void {
  const n = pts.length;
  if (n < 2) return;
  const white = pen.white;
  white.begin();
  for (const [x, y, v] of pts) {
    if (!v) {
      white.end(1);
      continue;
    }
    white.push(x, y, width);
  }
  white.end(1);
  const edgeA: Array<[number, number, boolean]> = [];
  const edgeB: Array<[number, number, boolean]> = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!,
      b = pts[Math.min(n - 1, i + 1)]!;
    let tx = b[0] - a[0],
      ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const [x, y, v] = pts[i]!;
    edgeA.push([x - ty * width * 0.5, y + tx * width * 0.5, v]);
    edgeB.push([x + ty * width * 0.5, y - tx * width * 0.5, v]);
  }
  for (const e of [edgeA, edgeB]) {
    pen.ink.begin();
    for (const [x, y, v] of e) {
      if (!v) {
        pen.ink.end();
        continue;
      }
      pen.ink.push(x, y, 0.9);
    }
    pen.ink.end();
  }
  // Braid ticks.
  if (ticks > 0) {
    let acc = 0;
    for (let i = 1; i < n; i++) {
      const [x0, y0, v0] = pts[i - 1]!;
      const [x1, y1, v1] = pts[i]!;
      acc += Math.hypot(x1 - x0, y1 - y0);
      if (acc < ticks || !v0 || !v1) continue;
      acc = 0;
      const tx = x1 - x0,
        ty = y1 - y0;
      const l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l,
        ny = tx / l;
      pen.ink.begin();
      pen.ink.push(x1 + nx * width * 0.45 - (tx / l) * 1.2, y1 + ny * width * 0.45 - (ty / l) * 1.2, 0.8);
      pen.ink.push(x1 - nx * width * 0.45 + (tx / l) * 1.2, y1 - ny * width * 0.45 + (ty / l) * 1.2, 0.8);
      pen.ink.end(1);
    }
  }
}

/** Cap: the winged-wheel badge, the chin cord and its buttons, peak glints. */
export function drawCapDetails(sc: BustScene, pen: FeaturePen): void {
  const oldTol = pen.tol;
  pen.tol = 0.6;
  // Peak glints: white strokes across the patent leather where it faces the light.
  for (const [t, w] of [
    [0.34, 2.2],
    [0.52, 1.2],
  ] as Array<[number, number]>) {
    const pts: V3[] = [];
    for (let i = 0; i <= 24; i++) pts.push(peakPoint(lerp(-0.95, 0.35, i / 24), t, 0.05));
    pen.headStroke(pts, (u) => w * Math.pow(Math.sin(Math.PI * u), 0.7), { white: true });
  }
  // Chin cord across the band front, from button to button.
  const cord: Array<[number, number, boolean]> = [];
  for (let i = 0; i <= 40; i++) {
    const p = pen.headPoint(bandPoint(lerp(-1.32, 1.32, i / 40), 0.3, 0.34));
    cord.push([p.x, p.y, p.vis]);
  }
  outlinedRibbon(pen, cord, 4.2, 3.2);
  for (const a of [-1.34, 1.34]) {
    const p = pen.headPoint(bandPoint(a, 0.3, 0.42));
    if (!p.vis) continue;
    pen.white.path.moveTo(p.x + 3.4, p.y);
    pen.white.path.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
    pen.ink.begin();
    for (let k = 0; k <= 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      pen.ink.push(p.x + Math.cos(ang) * 3.4, p.y + Math.sin(ang) * 3.4, 0.9);
    }
    pen.ink.end(1);
    pen.ink.path.moveTo(p.x + 1, p.y);
    pen.ink.path.arc(p.x, p.y, 1, 0, Math.PI * 2);
  }
  // Badge: a winged wheel on the band front.
  const B = (u: number, v: number): V3 => bandPoint(u / 10.2, 0.56 + v / CAP.bandH, 0.4);
  const disc: V3[] = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    disc.push(B(Math.cos(a) * 0.68, Math.sin(a) * 0.68));
  }
  pen.headFill(disc, { white: true });
  for (const s of [-1, 1]) {
    const wing: V3[] = [
      B(s * 0.55, 0.28),
      B(s * 1.2, 0.72),
      B(s * 1.9, 0.86),
      B(s * 2.25, 0.62),
      B(s * 1.85, 0.3),
      B(s * 1.3, 0.02),
      B(s * 0.62, -0.18),
    ];
    pen.headFill(wing, { white: true });
    pen.headStroke([...wing, wing[0]!], () => 0.8);
    for (let f = 0; f < 4; f++) {
      const y = 0.66 - f * 0.2;
      pen.headStroke([B(s * (0.75 + f * 0.05), y - 0.25), B(s * (1.35 + f * 0.12), y + 0.02), B(s * (1.95 - f * 0.1), y + 0.1)], (u) => 0.75 * (1 - u * 0.5));
    }
  }
  pen.headStroke([...disc, disc[0]!], () => 1.0);
  const rim: V3[] = [];
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    rim.push(B(Math.cos(a) * 0.46, Math.sin(a) * 0.46));
  }
  pen.headStroke(rim, () => 0.7);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    pen.headStroke([B(Math.cos(a) * 0.14, Math.sin(a) * 0.14), B(Math.cos(a) * 0.46, Math.sin(a) * 0.46)], () => 0.6);
  }
  pen.headFill(
    Array.from({ length: 10 }, (_, k) => B(Math.cos((k / 10) * Math.PI * 2) * 0.13, Math.sin((k / 10) * Math.PI * 2) * 0.13)),
  );
  pen.tol = oldTol;
}

/**
 * The neck's anatomy: the sternocleidomastoid running from behind the ear
 * to the collar notch, and (for heavier builds) the larynx; a few neck
 * creases with age. Drawn on the neck tube in bust coordinates.
 */
export function drawNeckDetails(sc: BustScene, pen: FeaturePen): void {
  const g = sc.neck;
  const { ex, id } = sc;
  const at = (a: number, t: number): { p: V3; ok: boolean } => {
    // Sample the neck grid at angle a (0 = front) and height fraction t.
    const nu = g.nu,
      nv = g.nv;
    const fi = ((((a - Math.PI) / (Math.PI * 2)) % 1) + 1) % 1 * nu;
    const fj = t * (nv - 1);
    const i0 = Math.floor(fi) % nu,
      j0 = Math.min(nv - 2, Math.floor(fj));
    const k = j0 * nu + i0;
    return { p: [g.px[k]! + g.nx[k]! * 0.08, g.py[k]! + (fj - j0) * (g.py[k + nu]! - g.py[k]!), g.pz[k]! + g.nz[k]! * 0.08], ok: g.facing[k]! > 0.12 };
  };
  const scm: V3[] = [];
  for (let k = 0; k <= 16; k++) {
    const t = lerp(0.72, 0.3, k / 16);
    const a = lerp(1.5, 0.35, Math.pow(k / 16, 0.9));
    const s = at(a, t);
    if (s.ok) scm.push(s.p);
  }
  if (scm.length > 3) pen.bustStroke(scm, (t) => 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.2)) * (1 - ex.after * 0.7));
  // Neck creases deepen with age and fatigue.
  const crease = clamp(ex.age * 0.8 + ex.fatigue * 0.3 - 0.35);
  if (crease > 0.02) {
    for (const t of [0.52, 0.62]) {
      const pts: V3[] = [];
      for (let k = 0; k <= 14; k++) {
        const s = at(lerp(-0.2, 1.2, k / 14), t + 0.02 * Math.sin(k));
        if (s.ok) pts.push(s.p);
      }
      if (pts.length > 3) pen.bustStroke(pts, (u) => crease * 1.3 * Math.sin(Math.PI * u));
    }
  }
  void id;
}

/** Uniform: shoulder seam and epaulette, and the shirt collar's stitching. */
export function drawUniformDetails(sc: BustScene, pen: FeaturePen): void {
  const info = sc.torsoInfo;
  void info;
  // An enamel pin on the near lapel: the company's winged wheel in miniature.
  const lap = sc.grids.find((g) => g.name === "lapelL");
  if (lap) {
    const i = Math.round(lap.nu * 0.55),
      j = Math.round(lap.nv * 0.22);
    const k = j * lap.nu + i;
    const pin = pen.bustPoint([lap.px[k]!, lap.py[k]!, lap.pz[k]! + 0.3]);
    if (pin.vis && lap.facing[k]! > 0.1) {
      const r = 3.6;
      pen.white.path.moveTo(pin.x + r, pin.y);
      pen.white.path.ellipse(pin.x, pin.y, r, r * 0.9, 0, 0, Math.PI * 2);
      pen.ink.begin();
      for (let q = 0; q <= 18; q++) {
        const a = (q / 18) * Math.PI * 2;
        pen.ink.push(pin.x + Math.cos(a) * r, pin.y + Math.sin(a) * r * 0.9, 1.0);
      }
      pen.ink.end(1);
      pen.ink.path.moveTo(pin.x + 1.2, pin.y);
      pen.ink.path.arc(pin.x, pin.y, 1.2, 0, Math.PI * 2);
      for (const s of [-1, 1]) {
        pen.ink.begin();
        pen.ink.push(pin.x + s * 1.6, pin.y - 0.4, 0.9);
        pen.ink.push(pin.x + s * 3.0, pin.y - 1.6, 0.4);
        pen.ink.end(1);
      }
    }
  }
  // Collar stitching: a dashed line just inside each leaf's edge.
  for (const leaf of [sc.collar.leafL, sc.collar.leafR]) {
    const j = Math.floor((leaf.nv - 1) * 0.8);
    let on = true;
    let acc = 0;
    pen.ink.begin();
    for (let i = 0; i < leaf.nu; i++) {
      const k = j * leaf.nu + i;
      const p = pen.bustPoint([leaf.px[k]!, leaf.py[k]!, leaf.pz[k]!]);
      const vis = p.vis && leaf.facing[k]! > 0.05;
      if (i > 0) acc += 1;
      if (acc > 2) {
        acc = 0;
        on = !on;
        pen.ink.end(1);
      }
      if (!vis || !on) {
        pen.ink.end(1);
        continue;
      }
      pen.ink.push(p.x, p.y, 0.7);
    }
    pen.ink.end(1);
  }
}

/** Short hair under the cap: sideburn, temple and the back above the nape. */
function drawHair(sc: BustScene, pen: FeaturePen, rng: Rng): void {
  const { id, ex } = sc;
  const tone = id.hairTone;
  const s = 1;
  // Hair patch boundaries in head-local coords (sitter's left side).
  const bandY = (z: number) => lerp(CAP.y0b, CAP.y0f, clamp((z + 10) / 20));
  // Short back and sides: a neat sideburn and a close-cropped band behind the
  // ear. Hair is drawn as strokes that follow the growth, lighter at the
  // hairline so it fades into skin rather than stopping at an edge.
  const long = id.longHair;
  const grey = clamp(id.grey * (0.6 + 0.8 * ex.age));
  const strokes = Math.round((long ? 360 : 300) * (0.5 + 0.5 * tone));
  for (let k = 0; k < strokes; k++) {
    const th = rng.range(long ? 1.15 : 1.25, 2.95);
    const z = Math.cos(th) * 9.5 - 0.6;
    const x = s * Math.sin(th) * 7.8;
    const top = bandY(z) - 0.1;
    let bottom: number;
    if (long) {
      // Gathered back: a soft temple line, hair drawn over the top of the ear
      // and down behind it toward a knot at the nape.
      if (th < 1.5) bottom = 1.2 - (1.5 - th) * 2;
      else if (th < 2.0) bottom = 0.6 - Math.sin(((th - 1.5) / 0.5) * Math.PI) * 0.4;
      else bottom = -4.2 + (th - 2.0) * 0.5;
    } else if (th < 1.55) bottom = 0.2 - 0.9 * (1.55 - th) * 3; // sideburn, to mid-ear
    else if (th < 1.95) bottom = 1.3 + Math.sin(((th - 1.55) / 0.4) * Math.PI) * 0.4; // above the ear
    else bottom = -3.2 + (th - 1.95) * 0.8; // behind the ear toward the nape
    if (bottom >= top) continue;
    const y = rng.range(bottom, top);
    const ez = z - -1.2,
      ey = y + 0.55;
    if (!long && Math.abs(ez) < 2.0 && ey < 2.3 && ey > -3.4 && th > 1.45 && th < 1.98) continue;
    const len = rng.range(0.28, 0.55) * (long ? 2.6 : 1);
    const dirZ = long ? -0.95 : th < 1.55 ? 0.12 : -0.3;
    const dirY = long ? -0.35 : -1;
    const curl = id.hairCurl * rng.range(-0.6, 0.6);
    const p0: V3 = [x, y, z];
    const p1: V3 = [x, y + dirY * len * 0.5, z + dirZ * len * 0.5 + curl * 0.15];
    const p2: V3 = [x, y + dirY * len, z + dirZ * len + curl * 0.1];
    const edge = smoothstep(bottom, bottom + 0.9, y);
    // Grey hairs are drawn thin and sparse: the paper shows through.
    const g = th < 1.9 ? grey : grey * 0.6;
    if (g > 0.05 && rng.next() < g * 0.5) continue;
    const w = (0.45 + 0.6 * tone) * (0.35 + 0.65 * edge) * (1 - ex.after * 0.6) * (1 - 0.55 * g);
    pen.headStroke([p0, p1, p2], (t) => w * (1 - t * 0.8), { snap: true, lift: 0.06, taper: 0.7 });
  }
  // Fatigue: a few loose strands escaping the band at the temple.
  const loose = Math.round(ex.fatigue * 5 + ex.dissoc * 3);
  for (let k = 0; k < loose; k++) {
    const th = rng.range(1.0, 1.5);
    const z = Math.cos(th) * 9.6 - 0.6;
    const x = Math.sin(th) * 7.7;
    const y0 = bandY(z) - 0.1;
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push([x + 0.2 * t, y0 - t * rng.range(1.4, 2.4), z + Math.sin(t * 3 + k) * 0.35]);
    }
    pen.headStroke(pts, (t) => 0.7 * (1 - t) * tone, { snap: true, lift: 0.1 });
  }
}
