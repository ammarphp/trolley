/**
 * News plates, part B: civic life and people.
 */
import { INK, PAPER, PIGMENT } from "./palette.ts";
import type { Pen } from "./pen.ts";
import { lerp, lerpPt, rect, smooth, type Pt, type Ring } from "./geom.ts";
import {
  Cam,
  LINE,
  PH,
  PW,
  allPoints,
  box,
  castShadow,
  crowd,
  cylinder,
  dome,
  drawFace,
  drawShadow,
  drawSolid,
  faceAt,
  figure,
  gabled,
  plume,
  tree,
  visibleFaces,
  type Face,
  type V3,
} from "./kit.ts";
import { faceLines, faceQuad, steps, type Plate } from "./thumbs-a.ts";

/* -------------------------------------------------------- parliament */

export const parliament: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-62, 3, 118], target: [2, 17, 0], fov: 38 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  const wingL = box([-62, 0, 6], [44, 16, 30], 0);
  const wingR = box([62, 0, 6], [44, 16, 30], 0);
  const centre = box([0, 0, 0], [80, 20, 40], 0);
  for (const b of [wingR, centre, wingL]) drawShadow(pen, castShadow(cam, allPoints(b)), 1.1);
  const drawBlock = (faces: Face[], cols: number) => {
    drawSolid(pen, cam, faces, { spacing: 1.1 });
    for (const f of visibleFaces(cam, faces)) {
      if (f.role !== "wall") continue;
      const front = f.n[2] > 0.5;
      faceLines(pen, cam, f, "v", [0.1, 0.82, 0.88], 0.3);
      const n = front ? cols : Math.round(cols * 0.5);
      for (const u of steps(0.03, 0.97, n)) faceQuad(pen, cam, f, u - 0.012, 0.28, u + 0.012, 0.66, front ? INK : PAPER, front ? null : INK, 0.25);
    }
  };
  drawBlock(wingR, 11);
  drawBlock(wingL, 11);
  drawBlock(centre, 16);
  // Portico with pediment on the centre block.
  const front = centre[0]!;
  const por = box([0, 0, 24], [38, 17, 8], 0);
  drawSolid(pen, cam, por, { tone: 0 }, LINE.edge);
  const pf = por[0]!;
  const shadow = [faceAt(pf, 0.02, 0.06), faceAt(pf, 0.98, 0.06), faceAt(pf, 0.98, 0.8), faceAt(pf, 0.02, 0.8)].map((p) => cam.p(p));
  pen.hatch(shadow, 90, 0.7, LINE.hatch);
  for (const u of steps(0.04, 0.96, 8)) {
    const r = faceQuad(pen, cam, pf, u - 0.022, 0.06, u + 0.022, 0.8, PAPER, INK, 0.35);
    pen.hatch([lerpPt(r[0]!, r[1]!, 0.55), r[1]!, r[2]!, lerpPt(r[3]!, r[2]!, 0.55)], 90, 0.5, 0.26);
  }
  const pl = cam.p(faceAt(pf, 0, 1));
  const pr = cam.p(faceAt(pf, 1, 1));
  const apex: Pt = [(pl[0] + pr[0]) / 2, (pl[1] + pr[1]) / 2 - (pr[0] - pl[0]) * 0.17];
  pen.shape([pl, pr, apex], PAPER, INK, LINE.edge);
  void front;
  // Drum, dome and lantern.
  cylinder(pen, cam, [0, 0, -2], 15, 20, 30, { tone: 0.45 });
  const drumFaces: Pt[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const p: V3 = [Math.cos(a) * 15, 21.5, -2 + Math.sin(a) * 15];
    if (cam.facing([Math.cos(a), 0, Math.sin(a)], p)) drumFaces.push(cam.p(p));
  }
  const drumSegs: Array<[Pt, Pt]> = drumFaces.map((p) => [p, [p[0], p[1] - (cam.p([0, 28.5, -2])[1] - cam.p([0, 21.5, -2])[1]) * -1]] as [Pt, Pt]);
  pen.segs(drumSegs, 0.4);
  dome(pen, cam, [0, 0, -2], 15.5, 30, 8);
  cylinder(pen, cam, [0, 0, -2], 2.6, 45, 50, { tone: 0.4 });
  const lt = cam.p([0, 50, -2]);
  const lh = cam.p([0, 60, -2]);
  pen.line(lt[0], lt[1], lh[0], lh[1], 0.5);
  const fw = 5 + variant;
  pen.path(`M${lh[0]} ${lh[1]}q${fw / 2} -0.8 ${fw} 0.3v3.2q${-fw / 2} 0.8 ${-fw} -0.3Z`, { fill: PAPER, stroke: INK, w: 0.4 });
  // Forecourt: lamps and a few people.
  for (const x of [-24, 24]) {
    const b = cam.p([x, 0, 44]);
    const t = cam.p([x, 6, 44]);
    pen.line(b[0], b[1], t[0], t[1], 0.5);
    pen.circle(t[0], t[1], 0.9, { fill: PAPER, stroke: INK, w: 0.4 });
  }
  for (let i = 0; i < 9; i++) {
    const p: V3 = [rng.range(-40, 40), 0, rng.range(40, 70)];
    const s = cam.p(p);
    figure(pen, s[0], s[1], 1.75 * cam.scale(p), { pose: rng.chance(0.5) ? "walk" : "stand", dir: rng.chance(0.5) ? 1 : -1 });
  }
};

/* -------------------------------------------------------- courthouse */

export const courthouse: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-12, 1.6, 50], target: [0, 10, 0], fov: 40 });
  const body = box([0, 3, -8], [44, 22, 16], 0);
  drawSolid(pen, cam, body, { spacing: 1.1 });
  for (const f of visibleFaces(cam, body))
    if (f.role === "wall") for (const u of steps(0.05, 0.95, f.n[2] > 0.5 ? 9 : 4)) faceQuad(pen, cam, f, u - 0.02, 0.2, u + 0.02, 0.62, INK);
  // Stepped plinth.
  for (let k = 0; k < 7; k++) {
    const st = box([0, k * 0.43, 9 - k * 0.55], [36 - k * 0.4, 0.43, 6], 0);
    for (const f of visibleFaces(cam, st)) drawFace(pen, cam, f, { w: 0.35, tone: f.n[1] > 0.5 ? 0 : f.n[0] > 0.5 ? 0.5 : 0 });
  }
  // Portico: six columns and a deep shadow.
  const por = box([0, 3, 4.2], [28, 15, 7], 0);
  const pf = por[0]!;
  const back = [faceAt(pf, 0, 0), faceAt(pf, 1, 0), faceAt(pf, 1, 1), faceAt(pf, 0, 1)].map((p) => cam.p([p[0], p[1], p[2] - 6]));
  pen.shape(back, PAPER, INK, LINE.detail);
  pen.hatch(back, 90, 0.7, LINE.hatch);
  pen.hatch(back, 20, 1.3, LINE.hatch);
  const door = [faceAt(pf, 0.42, 0), faceAt(pf, 0.58, 0), faceAt(pf, 0.58, 0.5), faceAt(pf, 0.42, 0.5)].map((p) => cam.p([p[0], p[1], p[2] - 6]));
  pen.shape(door, INK, null);
  for (const u of steps(0.02, 0.98, 6)) {
    const r = [faceAt(pf, u - 0.035, 0), faceAt(pf, u + 0.035, 0), faceAt(pf, u + 0.03, 0.88), faceAt(pf, u - 0.03, 0.88)].map((p) => cam.p(p));
    pen.shape(r, PAPER, INK, LINE.detail);
    pen.hatch([lerpPt(r[0]!, r[1]!, 0.58), r[1]!, r[2]!, lerpPt(r[3]!, r[2]!, 0.58)], 90, 0.45, 0.26);
    const flutes: Array<[Pt, Pt]> = [0.3, 0.45].map((t) => [lerpPt(r[0]!, r[1]!, t), lerpPt(r[3]!, r[2]!, t)] as [Pt, Pt]);
    pen.segs(flutes, 0.2);
    const cap = [faceAt(pf, u - 0.045, 0.88), faceAt(pf, u + 0.045, 0.88), faceAt(pf, u + 0.045, 0.92), faceAt(pf, u - 0.045, 0.92)].map((p) => cam.p(p));
    pen.shape(cap, PAPER, INK, 0.35);
  }
  const ent = [faceAt(pf, -0.02, 0.92), faceAt(pf, 1.02, 0.92), faceAt(pf, 1.02, 1.04), faceAt(pf, -0.02, 1.04)].map((p) => cam.p(p));
  pen.shape(ent, PAPER, INK, LINE.edge);
  const pl = cam.p(faceAt(pf, -0.02, 1.04));
  const pr = cam.p(faceAt(pf, 1.02, 1.04));
  const apex: Pt = [(pl[0] + pr[0]) / 2, (pl[1] + pr[1]) / 2 - (pr[0] - pl[0]) * 0.2];
  pen.shape([pl, pr, apex], PAPER, INK, LINE.edge);
  // Scales in the tympanum.
  const sc: Pt = [apex[0], lerp(apex[1], pl[1], 0.62)];
  const sw = (pr[0] - pl[0]) * 0.1;
  pen.line(sc[0], sc[1] - sw * 0.5, sc[0], sc[1] + sw * 0.5, 0.45);
  pen.line(sc[0] - sw, sc[1] - sw * 0.35, sc[0] + sw, sc[1] - sw * 0.35, 0.45);
  for (const s of [-1, 1]) pen.path(`M${sc[0] + s * sw - sw * 0.3} ${sc[1] + sw * 0.1}a${sw * 0.3} ${sw * 0.2} 0 0 0 ${sw * 0.6} 0Z`, { fill: INK });
  // People on the steps.
  for (let i = 0; i < 7; i++) {
    const k = rng.int(0, 6);
    const p: V3 = [rng.range(-14, 14), k * 0.43 + 0.43, 9 - k * 0.55 + 1.5];
    const s = cam.p(p);
    figure(pen, s[0], s[1], 1.75 * cam.scale(p), { pose: rng.pick(["stand", "walk", "carry"] as const), dir: rng.chance(0.5) ? 1 : -1, halo: 0.5 });
  }
  void variant;
};

/* ---------------------------------------------------- press conference */

export const press: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0.3, 2.3, 5.2], target: [0, 1.5, -4], fov: 46 });
  // Backdrop with a repeating mark pattern.
  const wall: Ring = [cam.p([-6, 0, -5]), cam.p([6, 0, -5]), cam.p([6, 4, -5]), cam.p([-6, 4, -5])];
  pen.shape(wall, PAPER, INK, LINE.detail);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 4; j++) {
      const c = cam.p([-5.4 + i * 1.5 + (j % 2) * 0.75, 0.9 + j * 0.8, -5]);
      const r = cam.scale([0, 0, -5]) * 0.13;
      pen.shape(rect(c[0] - r, c[1] - r, r * 2, r * 2), "none", INK, 0.35);
      pen.line(c[0] - r * 0.55, c[1], c[0] + r * 0.55, c[1], 0.5);
      pen.line(c[0] + r * 1.6, c[1] - r * 0.3, c[0] + r * 4, c[1] - r * 0.3, 0.45);
      pen.line(c[0] + r * 1.6, c[1] + r * 0.4, c[0] + r * 3.2, c[1] + r * 0.4, 0.3);
    }
  // Flags on poles either side, draped.
  for (const x of [-2.6, 2.6]) {
    const b = cam.p([x, 0, -4.4]);
    const t = cam.p([x, 2.7, -4.4]);
    pen.line(b[0], b[1], t[0], t[1], 0.7);
    pen.circle(t[0], t[1] - 0.7, 0.8, { fill: INK });
    const s = cam.scale([x, 0, -4.4]);
    const dir = x < 0 ? 1 : -1;
    const drape: Ring = [
      [t[0], t[1] + 0.4],
      [t[0] + dir * s * 0.62, t[1] + s * 0.18],
      [t[0] + dir * s * 0.52, t[1] + s * 1.3],
      [t[0] + dir * s * 0.24, t[1] + s * 1.95],
      [t[0], t[1] + s * 1.62],
    ];
    pen.shape(drape, PAPER, INK, 0.5);
    const folds: Array<[Pt, Pt]> = [0.3, 0.55, 0.8].map((k) => [lerpPt(drape[0]!, drape[1]!, k), lerpPt(drape[4]!, drape[3]!, k)] as [Pt, Pt]);
    pen.segs(folds, 0.3);
    pen.hatch([drape[0]!, lerpPt(drape[0]!, drape[1]!, 0.45), lerpPt(drape[4]!, drape[3]!, 0.45), drape[4]!], 90, 0.8, 0.28);
  }
  // Speaker at the lectern.
  const sp = cam.p([0, 0, -3.0]);
  figure(pen, sp[0], sp[1], 1.86 * cam.scale([0, 0, -3.0]), { pose: "podium", dir: 1, coat: true, halo: 0.8 });
  const lect = box([0, 0, -2.6], [0.95, 1.18, 0.6], 0);
  drawSolid(pen, cam, lect, { spacing: 0.9 }, LINE.edge);
  const lf = lect[0]!;
  const mark = cam.p(faceAt(lf, 0.5, 0.64));
  const mr = cam.scale([0, 1, -2.3]) * 0.17;
  pen.circle(mark[0], mark[1], mr, { fill: INK });
  pen.path(`M${mark[0] - mr * 0.6} ${mark[1] + mr * 0.2}A${mr * 0.6} ${mr * 0.6} 0 0 1 ${mark[0] + mr * 0.6} ${mark[1] + mr * 0.2}Z`, { fill: PAPER });
  for (let k = -3; k <= 3; k++) {
    const base = cam.p([k * 0.05, 1.2, -2.35]);
    const tip = cam.p([k * 0.16, 1.36 + Math.abs(k) * 0.015, -2.12]);
    pen.line(base[0], base[1], tip[0], tip[1], 0.45);
    pen.circle(tip[0], tip[1], 1, { fill: INK });
  }
  // A few heads in the foreground corners, phones raised.
  const heads: Array<[number, number, "back" | "phone"]> = [
    [-2.4, 0.9, "back"],
    [-1.5, 1.6, "phone"],
    [-3.2, 1.9, "back"],
    [2.3, 1.2, "back"],
    [3.2, 1.8, "back"],
    [1.4, 2.1, "back"],
  ];
  const sorted = heads.map(([x, z, pose]) => ({ p: [x, 0, z] as V3, pose })).sort((a, b) => cam.depth(b.p) - cam.depth(a.p));
  for (const h of sorted) {
    const s = cam.p(h.p);
    figure(pen, s[0], s[1], 1.72 * cam.scale(h.p), { pose: h.pose, dir: h.p[0] < 0 ? 1 : -1, halo: 1.2 });
  }
  void rng;
  void variant;
};

/* ------------------------------------------------------------ treaty */

export const treaty: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0.4, 1.5, 4.4], target: [0, 1.25, -3], fov: 44 });
  // Curtained backdrop: folds as paired strokes with shaded troughs.
  const wall: Ring = [cam.p([-6, 0, -3.6]), cam.p([6, 0, -3.6]), cam.p([6, 4.4, -3.6]), cam.p([-6, 4.4, -3.6])];
  pen.shape(wall, PAPER, INK, LINE.detail);
  for (let x = -6; x < 6; x += 0.6) {
    const trough: Ring = [cam.p([x + 0.32, 0, -3.6]), cam.p([x + 0.5, 0, -3.6]), cam.p([x + 0.5, 4.4, -3.6]), cam.p([x + 0.32, 4.4, -3.6])];
    pen.hatch(trough, 90, 0.7, 0.26);
    pen.line(cam.p([x + 0.3, 0, -3.6])[0], cam.p([x + 0.3, 0, -3.6])[1], cam.p([x + 0.3, 4.4, -3.6])[0], cam.p([x + 0.3, 4.4, -3.6])[1], 0.3);
  }
  for (const x of [-1.9, 1.9]) {
    const b = cam.p([x, 0, -3.1]);
    const t = cam.p([x, 2.75, -3.1]);
    pen.line(b[0], b[1], t[0], t[1], 0.7);
    pen.circle(t[0], t[1] - 0.7, 0.9, { fill: INK });
    const s = cam.scale([x, 0, -3.1]);
    const dir = x < 0 ? 1 : -1;
    const drape: Ring = [
      [t[0], t[1] + 0.4],
      [t[0] + dir * s * 0.62, t[1] + s * 0.18],
      [t[0] + dir * s * 0.52, t[1] + s * 1.3],
      [t[0] + dir * s * 0.24, t[1] + s * 1.95],
      [t[0], t[1] + s * 1.62],
    ];
    pen.shape(drape, PAPER, INK, 0.5);
    const folds: Array<[Pt, Pt]> = [0.3, 0.55, 0.8].map((k) => [lerpPt(drape[0]!, drape[1]!, k), lerpPt(drape[4]!, drape[3]!, k)] as [Pt, Pt]);
    pen.segs(folds, 0.3);
    pen.hatch([drape[0]!, lerpPt(drape[0]!, drape[1]!, 0.45), lerpPt(drape[4]!, drape[3]!, 0.45), drape[4]!], 90, x < 0 ? 0.7 : 1.3, 0.28);
  }
  for (const [x, dir] of [
    [-0.58, 1],
    [0.58, -1],
  ] as const) {
    const p: V3 = [x, 0, -1.5];
    const s = cam.p(p);
    figure(pen, s[0], s[1], 1.8 * cam.scale(p), { pose: "reach", dir, coat: true, halo: 1 });
  }
  const table = box([0, 0, -0.5], [3.6, 0.78, 1.1], 0);
  drawSolid(pen, cam, table, { tone: 0 }, LINE.edge);
  const tf = table[0]!;
  const cloth = [faceAt(tf, 0, 0.05), faceAt(tf, 1, 0.05), faceAt(tf, 1, 1), faceAt(tf, 0, 1)].map((p) => cam.p(p));
  for (let i = 1; i < 12; i++) {
    const a = lerpPt(cloth[0]!, cloth[1]!, i / 12);
    const b = lerpPt(cloth[3]!, cloth[2]!, i / 12);
    pen.line(a[0], a[1], b[0], b[1], i % 2 ? 0.3 : 0.2);
  }
  for (const x of [-1, 1]) {
    const d = [cam.p([x - 0.28, 0.79, -0.25]), cam.p([x + 0.28, 0.79, -0.25]), cam.p([x + 0.28, 0.79, -0.7]), cam.p([x - 0.28, 0.79, -0.7])];
    pen.shape(d, PAPER, INK, 0.45);
    pen.segs([0.3, 0.5, 0.7].map((t) => [lerpPt(d[3]!, d[0]!, t), lerpPt(d[2]!, d[1]!, t * 0.8)] as [Pt, Pt]), 0.28);
  }
  const pa = cam.p([0.25, 0.8, -0.35]);
  const pb = cam.p([0.6, 0.82, -0.6]);
  pen.line(pa[0], pa[1], pb[0], pb[1], 1);
  void rng;
  void variant;
};

/* ------------------------------------------------------------- ballot */

export const ballot: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-0.75, 1.32, 1.6], target: [0.05, 1.0, -0.3], fov: 40 });
  // Booths behind, drawn light.
  for (let i = 0; i < 3; i++) {
    const x = -1.9 + i * 1.3;
    const bth = box([x, 0, -2.8], [1.1, 1.95, 0.9], 0);
    for (const f of visibleFaces(cam, bth)) drawFace(pen, cam, f, { tone: f.n[0] > 0.5 ? 0.34 : 0, w: LINE.detail });
    const f = bth[0]!;
    const cur = [faceAt(f, 0.08, 0.04), faceAt(f, 0.92, 0.04), faceAt(f, 0.92, 0.8), faceAt(f, 0.08, 0.8)].map((p) => cam.p(p));
    pen.shape(cur, PAPER, INK, 0.3);
    for (let k = 1; k < 7; k++) {
      const a = lerpPt(cur[0]!, cur[1]!, k / 7);
      const b = lerpPt(cur[3]!, cur[2]!, k / 7);
      pen.line(a[0], a[1], b[0], b[1], 0.22);
    }
    if (i === 1) {
      const feet = cam.p([x - 0.12, 0, -2.3]);
      const k = cam.scale([x, 0, -2.3]);
      pen.shape(rect(feet[0], feet[1] - k * 0.1, k * 0.14, k * 0.1), INK, null);
      pen.shape(rect(feet[0] + k * 0.2, feet[1] - k * 0.1, k * 0.14, k * 0.1), INK, null);
    }
  }
  // Table.
  const table = box([0.1, 0, -0.3], [1.3, 0.74, 0.7], 0);
  for (const f of visibleFaces(cam, table)) drawFace(pen, cam, f, { tone: f.n[1] > 0.5 ? 0 : f.n[0] > 0.5 ? 0.52 : 0.16 });
  // The box.
  const bb = box([0.1, 0.74, -0.3], [0.5, 0.44, 0.42], 0);
  drawSolid(pen, cam, bb, { spacing: 0.75 }, LINE.contour);
  const top = bb[4]!;
  const slot = [faceAt(top, 0.2, 0.44), faceAt(top, 0.8, 0.44), faceAt(top, 0.8, 0.56), faceAt(top, 0.2, 0.56)].map((p) => cam.p(p));
  pen.shape(slot, INK, null);
  const front = bb[0]!;
  const label = [faceAt(front, 0.18, 0.42), faceAt(front, 0.82, 0.42), faceAt(front, 0.82, 0.74), faceAt(front, 0.18, 0.74)].map((p) => cam.p(p));
  pen.shape(label, PAPER, INK, 0.45);
  const l1 = [lerpPt(label[3]!, label[0]!, 0.35), lerpPt(label[2]!, label[1]!, 0.35)];
  const l2 = [lerpPt(label[3]!, label[0]!, 0.68), lerpPt(label[2]!, label[1]!, 0.68)];
  pen.line(lerp(l1[0]![0], l1[1]![0], 0.14), lerp(l1[0]![1], l1[1]![1], 0.14), lerp(l1[0]![0], l1[1]![0], 0.86), lerp(l1[0]![1], l1[1]![1], 0.86), 1.2, INK, "butt");
  pen.line(lerp(l2[0]![0], l2[1]![0], 0.24), lerp(l2[0]![1], l2[1]![1], 0.24), lerp(l2[0]![0], l2[1]![0], 0.76), lerp(l2[0]![1], l2[1]![1], 0.76), 0.6, INK, "butt");
  // Seal on a string.
  const seal = cam.p(faceAt(front, 0.92, 0.98));
  pen.path(`M${seal[0]} ${seal[1]}q1 4 0.4 7`, { stroke: INK, w: 0.35 });
  pen.circle(seal[0] + 0.4, seal[1] + 8, 1.5, { fill: INK });
  // A folded ballot, half into the slot, its cross showing.
  const s0 = cam.p(faceAt(top, 0.36, 0.5));
  const s1 = cam.p(faceAt(top, 0.64, 0.5));
  const k = cam.scale(faceAt(top, 0.5, 0.5));
  const up = k * 0.2;
  const paper: Ring = [s0, s1, [s1[0] + k * 0.02, s1[1] - up], [s0[0] - k * 0.01, s0[1] - up * 0.96]];
  pen.shape(paper, PAPER, INK, 0.6);
  pen.line(paper[3]![0], lerp(paper[3]![1], paper[0]![1], 0.35), paper[2]![0], lerp(paper[2]![1], paper[1]![1], 0.35), 0.3);
  const xc: Pt = [lerp(paper[0]![0], paper[1]![0], 0.62), lerp(paper[2]![1], paper[1]![1], 0.62)];
  const xs = up * 0.16;
  pen.segs(
    [
      [[xc[0] - xs, xc[1] - xs], [xc[0] + xs, xc[1] + xs]],
      [[xc[0] + xs, xc[1] - xs], [xc[0] - xs, xc[1] + xs]],
    ],
    0.9,
  );
  pen.shape(rect(xc[0] - xs * 1.6 - up * 0.34, xc[1] - xs * 1.4, xs * 2.6, xs * 2.8), "none" as string, INK, 0.3);
  // Floor line.
  const fl = [cam.p([-3, 0, 0.6]), cam.p([3, 0, 0.6])];
  pen.line(fl[0]![0], fl[0]![1], fl[1]![0], fl[1]![1], 0.3);
  void rng;
  void variant;
};

/* -------------------------------------------------------------- queue */

export const queue: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [3.4, 1.6, 6], target: [-1.6, 1.4, -24], fov: 50 });
  const hy = cam.horizon();
  // The wall and its courses.
  const wall: Face = { pts: [[-1.8, 0, 4], [-1.8, 0, -60], [-1.8, 4.2, -60], [-1.8, 4.2, 4]], n: [1, 0, 0], role: "wall" };
  drawFace(pen, cam, wall, { tone: 0.16 });
  const courses: Array<[Pt, Pt]> = [];
  for (let y = 0.3; y < 4.2; y += 0.3) courses.push([cam.p([-1.8, y, 4]), cam.p([-1.8, y, -60])]);
  pen.segs(courses, 0.22);
  // Door at the head of the queue, with a sign.
  const door: Face = { pts: [[-1.78, 0, -28], [-1.78, 0, -29.4], [-1.78, 2.3, -29.4], [-1.78, 2.3, -28]], n: [1, 0, 0], role: "wall" };
  const dr = door.pts.map((p) => cam.p(p));
  pen.shape(dr, INK, null);
  const sign = [cam.p([-1.76, 2.6, -27.6]), cam.p([-1.76, 2.6, -29.8]), cam.p([-1.76, 3.3, -29.8]), cam.p([-1.76, 3.3, -27.6])];
  pen.shape(sign, PAPER, INK, 0.4);
  pen.line(lerp(sign[0]![0], sign[1]![0], 0.2), lerp(sign[0]![1], sign[3]![1], 0.5), lerp(sign[0]![0], sign[1]![0], 0.8), lerp(sign[1]![1], sign[2]![1], 0.5), 0.8);
  // Pavement edge.
  const kerb: Array<[Pt, Pt]> = [[cam.p([1.6, 0, 4]), cam.p([1.6, 0, -60])]];
  pen.segs(kerb, LINE.detail);
  pen.line(0, hy, PW, hy, LINE.hatch);
  // The queue: one after another, all the way down.
  const people: V3[] = [];
  for (let z = -27; z < 5; z += rng.range(0.75, 1.05)) people.push([-0.9 + rng.range(-0.2, 0.25), 0, z]);
  people.sort((a, b) => cam.depth(b) - cam.depth(a));
  for (const p of people) {
    const s = cam.p(p);
    figure(pen, s[0], s[1], rng.range(1.6, 1.86) * cam.scale(p), { pose: rng.pick(["stand", "stand", "phone", "back", "carry"] as const), dir: -1, coat: rng.chance(0.6), halo: 0.6 });
  }
  // Drizzle, only in the air above the queue.
  pen.hatch(rect(0, 0, PW, hy - 6), 78, 4.6, 0.2, INK, { dash: [2, 6] });
  // Lamp post across the street.
  const lb = cam.p([4.2, 0, -8]);
  const lt = cam.p([4.2, 5, -8]);
  pen.line(lb[0], lb[1], lt[0], lt[1], 0.8);
  pen.line(lt[0], lt[1], lt[0] - 4, lt[1] + 1, 0.6);
  pen.shape(rect(lt[0] - 5.5, lt[1] + 0.6, 3, 1.4), INK, null);
  void variant;
};

/* ------------------------------------------------------------ concert */

export const concert: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-7, 3.2, 13], target: [4, 2.4, -8], fov: 50 });
  // Stage: an empty, lit deck under a truss. Nobody is on it.
  const deck = box([6, 0, -16], [24, 1.3, 9], 0);
  drawSolid(pen, cam, deck, { spacing: 0.9 });
  const mouth: Ring = [cam.p([-6, 1.3, -20.4]), cam.p([18, 1.3, -20.4]), cam.p([18, 10, -20.4]), cam.p([-6, 10, -20.4])];
  pen.shape(mouth, PAPER, INK, LINE.edge);
  pen.hatch(mouth, 90, 0.8, LINE.hatch);
  // A pool of light on the empty deck.
  const pool: Pt[] = [];
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    pool.push(cam.p([6 + Math.cos(a) * 3.2, 1.31, -16 + Math.sin(a) * 2.2]));
  }
  pen.shape(pool, PAPER, INK, 0.3);
  const beamTop = cam.p([6, 10, -15]);
  pen.path(`M${beamTop[0]} ${beamTop[1]}L${pool[14]![0]} ${pool[14]![1]}M${beamTop[0]} ${beamTop[1]}L${pool[0]![0]} ${pool[0]![1]}`, { stroke: INK, w: 0.3 });
  const t0 = cam.p([-6, 10.2, -15]);
  const t1 = cam.p([18, 10.2, -15]);
  pen.line(t0[0], t0[1], t1[0], t1[1], 1.4);
  for (let i = 0; i < 7; i++) {
    const l = cam.p([-4 + i * 3.6, 9.9, -15]);
    pen.shape(rect(l[0] - 0.9, l[1], 1.8, 1.4), INK, null);
  }
  // The audience: every head wears a headset, every face turned the same way.
  crowd(pen, cam, rng, { count: 90, x0: -12, x1: 14, z0: -10, z1: 8, poses: ["headset", "headset", "headset", "headset", "both"], dir: 1, heights: [1.62, 1.86] });
  void variant;
};

/* ----------------------------------------------------------- memorial */

export const memorial: Plate = (pen, rng, variant) => {
  // Steps with candles, flowers and a blank framed photograph. Quiet.
  const stepY = [64, 74, 86];
  for (const [i, y] of stepY.entries()) {
    pen.line(0, y, PW, y, LINE.edge);
    pen.hatch(rect(0, y, PW, 2.2), 0, 0.7, 0.28);
    void i;
  }
  // The photograph, leaning.
  const fr: Ring = [
    [66, 64],
    [96, 64],
    [93, 26],
    [69, 26],
  ];
  pen.shape(fr, PAPER, INK, LINE.edge);
  const inner: Ring = [
    [69.5, 60.5],
    [92.5, 60.5],
    [90.3, 29.5],
    [71.7, 29.5],
  ];
  pen.shape(inner, PAPER, INK, 0.4);
  pen.hatch([fr[0]!, fr[1]!, inner[1]!, inner[0]!], 0, 0.7, 0.28);
  pen.hatch([fr[1]!, fr[2]!, inner[2]!, inner[1]!], 80, 0.7, 0.28);
  // Ribbon across the corner.
  pen.path(`M86 26L93 33L93 37L82 26Z`, { fill: INK });
  // Candles: pillars and tea lights, with small ember flames.
  const candles: Array<[number, number, number, number]> = [
    [30, 64, 3.2, 14],
    [40, 64, 2.6, 9],
    [110, 64, 3, 12],
    [120, 64, 2.4, 7],
    [22, 74, 2.8, 8],
    [50, 74, 2.2, 5],
    [104, 74, 3, 10],
    [134, 74, 2.4, 6],
    [60, 86, 2.6, 3],
    [96, 86, 2.6, 3],
    [140, 86, 2.6, 3],
  ];
  for (const [x, y, r, h] of candles) {
    const body: Ring = [
      [x - r, y],
      [x - r, y - h],
      [x + r, y - h],
      [x + r, y],
    ];
    pen.shape(body, PAPER, INK, LINE.detail);
    pen.hatch([[x + r * 0.2, y], [x + r * 0.2, y - h], [x + r, y - h], [x + r, y]], 90, 0.6, 0.26);
    pen.path(`M${x - r} ${y - h}a${r} ${r * 0.35} 0 0 0 ${2 * r} 0`, { stroke: INK, w: 0.35 });
    pen.line(x, y - h, x, y - h - 1.4, 0.35);
    pen.path(`M${x} ${y - h - 5.2}C${x + 1.3} ${y - h - 3.2} ${x + 1.1} ${y - h - 1.4} ${x} ${y - h - 1.2}C${x - 1.1} ${y - h - 1.4} ${x - 1.3} ${y - h - 3.2} ${x} ${y - h - 5.2}Z`, { fill: PIGMENT.ember });
  }
  // Wrapped bouquets lying on the steps.
  const bouquet = (x: number, y: number, len: number, ang: number) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const P = (u: number, v: number): Pt => [x + u * c - v * s, y + u * s + v * c];
    const cone: Ring = [P(0, 0), P(len, -len * 0.28), P(len, len * 0.28)];
    pen.shape(cone, PAPER, INK, 0.45);
    pen.hatch(cone, (ang * 180) / Math.PI + 60, 1.2, 0.26);
    for (let k = 0; k < 6; k++) {
      const q = P(len + rng.range(0, 3), rng.range(-len * 0.32, len * 0.32));
      pen.circle(q[0], q[1], rng.range(1.3, 2), { fill: PAPER, stroke: INK, w: 0.4 });
      pen.circle(q[0], q[1], 0.45, { fill: INK });
    }
  };
  bouquet(46, 86, 13, -0.25);
  bouquet(116, 86, 12, -2.9);
  bouquet(12, 64, 10, -0.1);
  // A folded note.
  pen.shape([[124, 84], [134, 83], [134.5, 86], [124.5, 86]], PAPER, INK, 0.4);
  void variant;
};

/* ------------------------------------------------------------- pram */

export const pram: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0, 1.4, 9], target: [0, 0.9, -10], fov: 44 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  // Park path curving away.
  const pathL: Pt[] = [];
  const pathR: Pt[] = [];
  for (let z = 9; z > -120; z -= 2) {
    const x = Math.sin(z * 0.03) * 4;
    pathL.push(cam.p([x - 1.4, 0, z]));
    pathR.push(cam.p([x + 1.4, 0, z]));
  }
  pen.stroke(pathL, LINE.detail);
  pen.stroke(pathR, LINE.detail);
  // Trees and a lamp.
  for (const [x, z, k] of [
    [-9, -30, "round"],
    [8, -44, "round"],
    [-14, -70, "poplar"],
    [16, -90, "round"],
    [-4, -110, "round"],
  ] as const) {
    const p: V3 = [x, 0, z];
    const s = cam.p(p);
    tree(pen, s[0], s[1], 11 * cam.scale(p), rng, k);
  }
  const lb = cam.p([3.6, 0, -6]);
  const lt = cam.p([3.6, 3.8, -6]);
  pen.line(lb[0], lb[1], lt[0], lt[1], 0.9);
  pen.path(`M${lt[0] - 2.4} ${lt[1] + 2}L${lt[0] - 1.4} ${lt[1] - 1}H${lt[0] + 1.4}L${lt[0] + 2.4} ${lt[1] + 2}Z`, { fill: PAPER, stroke: INK, w: 0.5 });
  // Empty bench.
  const bench = box([4.6, 0.42, -3], [1.8, 0.08, 0.5], -0.3);
  drawSolid(pen, cam, bench, {}, 0.6);
  const back = box([4.7, 0.6, -3.25], [1.8, 0.45, 0.06], -0.3);
  drawSolid(pen, cam, back, {}, 0.6);
  for (const dx of [-0.8, 0.8]) {
    const a = cam.p([4.6 + dx * 0.95, 0, -3 + dx * 0.29]);
    const b = cam.p([4.6 + dx * 0.95, 0.44, -3 + dx * 0.29]);
    pen.line(a[0], a[1], b[0], b[1], 0.7);
  }
  // The pram, empty, parked on the path, with its long shadow.
  const base = cam.p([-0.9, 0, 4.6]);
  const k = cam.scale([-0.9, 0, 4.6]);
  const X = (u: number) => base[0] + u * k;
  const Y = (v: number) => base[1] - v * k;
  pen.hatch([[X(-0.2), Y(0)], [X(0.9), Y(0)], [X(2.6), Y(-0.28)], [X(1.2), Y(-0.28)]], 12, 0.8, 0.3);
  const wheel = (u: number, r: number) => {
    pen.circle(X(u), Y(r), r * k, { fill: PAPER, stroke: INK, w: 0.7 });
    pen.circle(X(u), Y(r), r * k * 0.18, { fill: INK });
    const sp: Array<[Pt, Pt]> = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sp.push([[X(u), Y(r)], [X(u) + Math.cos(a) * r * k, Y(r) + Math.sin(a) * r * k]]);
    }
    pen.segs(sp, 0.22);
  };
  wheel(0.02, 0.2);
  wheel(0.66, 0.24);
  pen.path(`M${X(0.02)} ${Y(0.2)}L${X(0.34)} ${Y(0.42)}L${X(0.66)} ${Y(0.24)}`, { stroke: INK, w: 0.6 });
  const basket = `M${X(-0.14)} ${Y(0.52)}C${X(-0.14)} ${Y(0.36)} ${X(0.06)} ${Y(0.34)} ${X(0.34)} ${Y(0.34)}H${X(0.72)}C${X(0.84)} ${Y(0.34)} ${X(0.88)} ${Y(0.42)} ${X(0.86)} ${Y(0.66)}H${X(-0.14)}Z`;
  pen.path(basket, { fill: PAPER, stroke: INK, w: LINE.edge });
  pen.hatch([[X(0.4), Y(0.34)], [X(0.72), Y(0.34)], [X(0.86), Y(0.42)], [X(0.86), Y(0.66)], [X(0.4), Y(0.66)]], 90, 0.7, 0.28);
  const hood = `M${X(0.86)} ${Y(0.66)}C${X(0.9)} ${Y(1.02)} ${X(0.6)} ${Y(1.16)} ${X(0.34)} ${Y(1.08)}L${X(0.46)} ${Y(0.66)}Z`;
  pen.path(hood, { fill: PAPER, stroke: INK, w: LINE.edge });
  pen.hatch([[X(0.86), Y(0.66)], [X(0.9), Y(0.9)], [X(0.72), Y(1.08)], [X(0.46), Y(1.1)], [X(0.46), Y(0.66)]], 60, 0.65, 0.3);
  pen.path(`M${X(0.5)} ${Y(0.66)}L${X(0.62)} ${Y(1.08)}M${X(0.66)} ${Y(0.66)}L${X(0.78)} ${Y(1.02)}`, { stroke: INK, w: 0.3 });
  pen.path(`M${X(-0.14)} ${Y(0.62)}L${X(-0.42)} ${Y(1.02)}L${X(-0.56)} ${Y(1.02)}`, { stroke: INK, w: 0.9 });
  void variant;
};

/* -------------------------------------------------------- resignation */

export const resignation: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-0.72, 1.4, 1.05], target: [0.12, 0.86, -0.2], fov: 44 });
  // Desk edge and surface grain.
  const desk: Ring = [cam.p([-2, 0.74, 0.5]), cam.p([2, 0.74, 0.5]), cam.p([2, 0.74, -1.4]), cam.p([-2, 0.74, -1.4])];
  pen.shape(desk, PAPER, INK, LINE.detail);
  const grain: Array<[Pt, Pt]> = [];
  for (let z = 0.42; z > 0.1; z -= 0.08) grain.push([cam.p([-2, 0.74, z]), cam.p([2, 0.74, z])]);
  pen.segs(grain, 0.2);
  const edge: Ring = [cam.p([-2, 0.74, 0.5]), cam.p([2, 0.74, 0.5]), cam.p([2, 0.7, 0.5]), cam.p([-2, 0.7, 0.5])];
  pen.shape(edge, INK, null);
  // Monitor off to the back, dark.
  const mon = box([-0.9, 0.74, -1], [0.62, 0.42, 0.04], 0.3);
  drawSolid(pen, cam, mon, { tone: 0.7 }, 0.6);
  // The box, flaps open.
  const bx: V3 = [0.12, 0.74, -0.2];
  const w = 0.46;
  const d = 0.34;
  const h = 0.3;
  const cardboard = box(bx, [w, h, d], 0.12);
  drawSolid(pen, cam, cardboard, { spacing: 0.9 }, LINE.contour);
  const top = cardboard[4]!;
  const c = (u: number, v: number) => faceAt(top, u, v);
  const inside = [c(0, 0), c(1, 0), c(1, 1), c(0, 1)].map((p) => cam.p(p));
  pen.shape(inside, PAPER, INK, 0.5);
  pen.hatch(inside, 30, 0.7, 0.28);
  // Flaps tipped outward.
  const flap = (a: V3, b: V3, out: V3) => {
    const q = [a, b, [b[0] + out[0], b[1] + out[1], b[2] + out[2]] as V3, [a[0] + out[0], a[1] + out[1], a[2] + out[2]] as V3].map((p) => cam.p(p));
    pen.shape(q, PAPER, INK, 0.5);
    pen.hatch(q, 80, 1.2, 0.26);
  };
  flap(c(0, 0), c(1, 0), [0, 0.12, 0.13]);
  flap(c(1, 0), c(1, 1), [0.14, 0.1, 0.02]);
  flap(c(0, 1), c(0, 0), [-0.14, 0.12, -0.02]);
  // Contents: a plant, a mug, a framed photo, a rolled poster.
  const plant = cam.p(c(0.25, 0.55));
  const ps = cam.scale(c(0.25, 0.55));
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32;
    const tip: Pt = [plant[0] + Math.cos(a) * ps * 0.28, plant[1] - ps * 0.1 + Math.sin(a) * ps * 0.3];
    pen.path(`M${plant[0]} ${plant[1]}Q${(plant[0] + tip[0]) / 2 - 1} ${(plant[1] + tip[1]) / 2} ${tip[0]} ${tip[1]}Q${(plant[0] + tip[0]) / 2 + 1} ${(plant[1] + tip[1]) / 2 + 1} ${plant[0]} ${plant[1]}Z`, { fill: PAPER, stroke: INK, w: 0.4 });
  }
  const photo = [c(0.5, 0.75), c(0.85, 0.72), c(0.86, 0.72), c(0.51, 0.75)].map((p) => cam.p(p));
  const ph = ps * 0.2;
  const frame: Ring = [photo[0]!, photo[1]!, [photo[1]![0] + 1, photo[1]![1] - ph], [photo[0]![0] + 1, photo[0]![1] - ph]];
  pen.shape(frame, PAPER, INK, LINE.detail);
  pen.shape([lerpPt(frame[0]!, frame[2]!, 0.12), lerpPt(frame[1]!, frame[3]!, 0.12), lerpPt(frame[2]!, frame[0]!, 0.12), lerpPt(frame[3]!, frame[1]!, 0.12)], PAPER, INK, 0.3);
  const mug = cam.p(c(0.72, 0.3));
  const mr = ps * 0.06;
  pen.shape(rect(mug[0] - mr, mug[1] - mr * 2.2, mr * 2, mr * 2.2), PAPER, INK, 0.5);
  pen.path(`M${mug[0] + mr} ${mug[1] - mr * 1.8}a${mr * 0.7} ${mr * 0.6} 0 0 1 0 ${mr * 1.2}`, { stroke: INK, w: 0.5 });
  const roll0 = cam.p(c(0.1, 0.2));
  pen.line(roll0[0], roll0[1], roll0[0] - ps * 0.2, roll0[1] - ps * 0.34, 2.2);
  pen.line(roll0[0], roll0[1], roll0[0] - ps * 0.2, roll0[1] - ps * 0.34, 1.2, PAPER);
  // Lanyard and badge left on the desk.
  const bp = cam.p([0.62, 0.745, 0.2]);
  pen.path(`M${bp[0] - 10} ${bp[1] - 2}C${bp[0] - 6} ${bp[1] + 4} ${bp[0] - 2} ${bp[1] + 3} ${bp[0]} ${bp[1] - 1}`, { stroke: INK, w: 0.8 });
  pen.shape(rect(bp[0] - 1, bp[1] - 1.5, 6, 8), PAPER, INK, 0.5);
  pen.shape(rect(bp[0] + 0.4, bp[1] + 0.2, 2.4, 2.8), INK, null);
  pen.line(bp[0] + 0.4, bp[1] + 4.6, bp[0] + 4, bp[1] + 4.6, 0.4);
  void rng;
  void variant;
};

/* ----------------------------------------------------------- hospital */

export const hospital: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-58, 2, 78], target: [-2, 12, -6], fov: 42 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  const main = box([0, 0, -18], [56, 26, 22], 0.25);
  const low = box([-34, 0, 4], [30, 8, 18], 0.25);
  for (const b of [main, low]) drawShadow(pen, castShadow(cam, allPoints(b)));
  const draw = (faces: Face[], floors: number) => {
    drawSolid(pen, cam, faces, { spacing: 1.1 });
    for (const f of visibleFaces(cam, faces)) {
      if (f.role !== "wall") continue;
      for (const v of steps(0.04, 0.96, floors)) {
        const band = [faceAt(f, 0.03, v - 0.25 / floors), faceAt(f, 0.97, v - 0.25 / floors), faceAt(f, 0.97, v + 0.2 / floors), faceAt(f, 0.03, v + 0.2 / floors)].map((p) => cam.p(p));
        pen.shape(band, PAPER, INK, 0.3);
        pen.hatch(band, 90, f.n[0] > 0 ? 0.6 : 1.1, 0.24);
      }
    }
  };
  draw(main, 7);
  draw(low, 2);
  // Rooftop sign: a white cross on an ink square (never a red cross).
  const sb = box([12, 26, -10], [7, 7, 1], 0.25);
  drawSolid(pen, cam, sb, { tone: 0.6 }, 0.6);
  const sf = sb[0]!;
  const cr = (u0: number, v0: number, u1: number, v1: number) => [faceAt(sf, u0, v0), faceAt(sf, u1, v0), faceAt(sf, u1, v1), faceAt(sf, u0, v1)].map((p) => cam.p(p));
  pen.shape(cr(0.08, 0.08, 0.92, 0.92), INK, null);
  pen.shape(cr(0.38, 0.2, 0.62, 0.8), PAPER, null);
  pen.shape(cr(0.2, 0.38, 0.8, 0.62), PAPER, null);
  // Entrance canopy.
  const can = box([-10, 4.2, 0], [16, 0.6, 6], 0.25);
  drawSolid(pen, cam, can, { tone: 0.2 }, 0.7);
  for (const u of [-7, 7]) {
    const a = cam.p([-10 + u * 0.97, 0, 2.5 + u * 0.25]);
    const b = cam.p([-10 + u * 0.97, 4.2, 2.5 + u * 0.25]);
    pen.line(a[0], a[1], b[0], b[1], 0.6);
  }
  // Ambulance at the doors: a box van with a chequered band.
  const van = box([-4, 0, 12], [6, 2.7, 2.3], 0.25 + Math.PI / 2 - 0.3);
  drawSolid(pen, cam, van, { tone: 0 }, LINE.edge);
  for (const f of visibleFaces(cam, van)) {
    if (f.role !== "wall") continue;
    for (let i = 0; i < 10; i++) if (i % 2 === 0) faceQuad(pen, cam, f, i / 10, 0.38, (i + 1) / 10, 0.52, INK);
    if (f.n[0] < -0.3 || f.n[2] > 0.6) faceQuad(pen, cam, f, 0.06, 0.62, 0.3, 0.88, INK);
  }
  const bar = cam.p([-4, 2.9, 12]);
  pen.shape(rect(bar[0] - 2, bar[1] - 1, 4, 1.2), PIGMENT.amber, INK, 0.3);
  for (const wx of [-2, 2]) {
    const wp = cam.p([-4 + wx * 0.7, 0.4, 12 + wx * 0.72]);
    pen.circle(wp[0], wp[1], 1.4, { fill: INK });
  }
  for (let i = 0; i < 4; i++) {
    const p: V3 = [-18 + i * 3 + rng.range(-1, 1), 0, 8 + rng.range(-1, 3)];
    const s = cam.p(p);
    figure(pen, s[0], s[1], 1.75 * cam.scale(p), { pose: i === 1 ? "carry" : "walk", dir: rng.chance(0.5) ? 1 : -1 });
  }
  tree(pen, 150, hy + 3, 20, rng, "round");
  void variant;
};

/* ------------------------------------------------------------ factory */

export const factory: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-50, 10, 74], target: [-2, 12, -18], fov: 46 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  // Chimney smoke first (it sits behind everything).
  const stacks: V3[] = [
    [22, 0, -34],
    [34, 0, -34],
    [46, 0, -34],
  ];
  for (const s of stacks) {
    const t = cam.p([s[0], 46, s[2]]);
    const k = cam.scale(s);
    plume(pen, t[0], t[1], { height: 34 * k, drift: 26 * k, width: 5 * k, rng, dark: 0.3 });
  }
  const shed = box([0, 0, -10], [70, 10, 40], 0);
  drawShadow(pen, castShadow(cam, allPoints(shed)));
  drawSolid(pen, cam, shed, { spacing: 1.1 });
  const front = shed[0]!;
  for (const u of steps(0.02, 0.98, 5)) faceQuad(pen, cam, front, u - 0.07, 0, u + 0.07, 0.62, PAPER, INK, 0.4);
  for (const u of steps(0.02, 0.98, 5)) {
    const r = [faceAt(front, u - 0.07, 0), faceAt(front, u + 0.07, 0), faceAt(front, u + 0.07, 0.62), faceAt(front, u - 0.07, 0.62)].map((p) => cam.p(p));
    pen.hatch(r, 0, 0.8, 0.26);
  }
  const side = visibleFaces(cam, shed).find((f) => f.n[0] < -0.5);
  if (side) faceLines(pen, cam, side, "v", [0.5, 0.56], 0.3);
  // Sawtooth roof: north lights facing away, glazed faces hatched.
  const teeth = 7;
  for (let i = 0; i < teeth; i++) {
    const z0 = -30 + (i * 40) / teeth;
    const z1 = z0 + 40 / teeth;
    const a: V3 = [-35, 10, z1];
    const b: V3 = [35, 10, z1];
    const c: V3 = [35, 15, z0 + 0.6];
    const d: V3 = [-35, 15, z0 + 0.6];
    const slope: Face = { pts: [a, b, c, d], n: [0, 0.8, 0.6], role: "roof" };
    drawFace(pen, cam, slope, { tone: 0 });
    const glass: Ring = [cam.p(d), cam.p(c), cam.p([35, 10, z0]), cam.p([-35, 10, z0])];
    pen.shape(glass, PAPER, INK, 0.4);
    pen.hatch(glass, 90, 0.9, 0.28);
    const tri: Ring = [cam.p([-35, 10, z0]), cam.p(a), cam.p(d)];
    pen.shape(tri, PAPER, INK, 0.4);
  }
  for (const s of stacks) cylinder(pen, cam, s, 2.2, 0, 46, { tone: 0.5 });
  // Water tower.
  const wt: V3 = [-48, 0, -26];
  for (const [dx, dz] of [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ]) {
    const a = cam.p([wt[0] + dx, 0, wt[2] + dz]);
    const b = cam.p([wt[0] + dx * 0.7, 16, wt[2] + dz * 0.7]);
    pen.line(a[0], a[1], b[0], b[1], 0.5);
  }
  cylinder(pen, cam, wt, 4.4, 16, 22, { tone: 0.4 });
  const cone = [cam.p([wt[0] - 4.6, 22, wt[2]]), cam.p([wt[0], 25.5, wt[2]]), cam.p([wt[0] + 4.6, 22, wt[2]])];
  pen.shape(cone, PAPER, INK, 0.5);
  // Lorries at the dock.
  for (let i = 0; i < 2; i++) {
    const lorry = box([-12 + i * 16, 0, 16], [4, 3.6, 10], 0.02);
    drawSolid(pen, cam, lorry, { spacing: 0.8 }, 0.8);
  }
  void variant;
};

export { gabled, smooth };
