/**
 * News plates, part C: markets, machines, science and the weather.
 */
import { INK, PAPER, PIGMENT } from "./palette.ts";
import type { Pen } from "./pen.ts";
import type { Rng } from "../../render/core/rng.ts";
import { circle, clipHalf, lerp, lerpPt, rect, smooth, type Pt, type Ring } from "./geom.ts";
import {
  Cam,
  LINE,
  PH,
  PW,
  allPoints,
  box,
  castShadow,
  clipAbove,
  cloud,
  cylinder,
  dotText,
  drawFace,
  drawShadow,
  drawSolid,
  faceAt,
  figure,
  gabled,
  plume,
  tree,
  visibleFaces,
  water,
  type Face,
  type V3,
} from "./kit.ts";
import { billows, faceQuad, steps, type Plate } from "./thumbs-a.ts";


/* ------------------------------------------------------------- charts */

function chartFrame(pen: Pen, x0: number, y0: number, x1: number, y1: number): void {
  // Engraved chart paper: fine grid, heavier axes, tick marks.
  const grid: Array<[Pt, Pt]> = [];
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 12) grid.push([[x, y0], [x, y1]]);
  for (let y = y0; y <= y1 + 0.01; y += (y1 - y0) / 6) grid.push([[x0, y], [x1, y]]);
  pen.segs(grid, 0.2);
  pen.line(x0, y1, x1, y1, LINE.edge);
  pen.line(x0, y0, x0, y1, LINE.edge);
  const ticks: Array<[Pt, Pt]> = [];
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 12) ticks.push([[x, y1], [x, y1 + 1.4]]);
  for (let y = y0; y <= y1 + 0.01; y += (y1 - y0) / 6) ticks.push([[x0 - 1.4, y], [x0, y]]);
  pen.segs(ticks, 0.35);
}

function candles(pen: Pen, rng: Rng, x0: number, x1: number, yTop: number, yBot: number, trend: number): Pt[] {
  const n = 22;
  const w = (x1 - x0) / n;
  let v = trend > 0 ? 0.25 : 0.8;
  const pts: Pt[] = [];
  const hollow: string[] = [];
  const solid: string[] = [];
  const wicks: Array<[Pt, Pt]> = [];
  for (let i = 0; i < n; i++) {
    const open = v;
    v = Math.max(0.05, Math.min(0.95, v + trend * (0.72 / n) * (trend > 0 ? 0.4 + (i / n) * 1.4 : 1) + rng.range(-0.05, 0.05) - (i === n - 3 && trend < 0 ? 0.12 : 0)));
    const close = v;
    const hi = Math.max(open, close) + rng.range(0.01, 0.05);
    const lo = Math.min(open, close) - rng.range(0.01, 0.05);
    const cx = x0 + (i + 0.5) * w;
    const Y = (t: number) => lerp(yBot, yTop, t);
    wicks.push([[cx, Y(hi)], [cx, Y(lo)]]);
    const top = Y(Math.max(open, close));
    const bot = Y(Math.min(open, close));
    const d = `M${(cx - w * 0.32).toFixed(2)} ${top.toFixed(2)}h${(w * 0.64).toFixed(2)}V${Math.max(bot, top + 0.6).toFixed(2)}h${(-w * 0.64).toFixed(2)}Z`;
    (close >= open ? hollow : solid).push(d);
    pts.push([cx, Y(close)]);
  }
  pen.segs(wicks, 0.4);
  pen.path(hollow.join(""), { fill: PAPER, stroke: INK, w: 0.45 });
  pen.path(solid.join(""), { fill: INK });
  return pts;
}

function arrow(pen: Pen, a: Pt, b: Pt, w: number, color: string): void {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const hl = w * 3.4;
  const back: Pt = [b[0] - Math.cos(ang) * hl, b[1] - Math.sin(ang) * hl];
  pen.line(a[0], a[1], back[0], back[1], w, color, "butt");
  const n: Pt = [-Math.sin(ang) * hl * 0.6, Math.cos(ang) * hl * 0.6];
  pen.fill([b, [back[0] + n[0], back[1] + n[1]], [back[0] - n[0], back[1] - n[1]]], color);
}

export const chartUp: Plate = (pen, rng) => {
  chartFrame(pen, 18, 12, 148, 84);
  const pts = candles(pen, rng, 20, 146, 16, 82, 1);
  // Moving average and the area under it, hatched.
  const avg: Pt[] = pts.map((p, i) => {
    const k = pts.slice(Math.max(0, i - 3), i + 1);
    return [p[0], k.reduce((s, q) => s + q[1], 0) / k.length + 2];
  });
  pen.hatch([...avg, [avg[avg.length - 1]![0], 84], [avg[0]![0], 84]], 45, 2.2, 0.24);
  pen.path(smooth(avg), { stroke: INK, w: 0.9 });
  arrow(pen, [112, 46], [150, 8], 1.8, INK);
  dotText(pen, "+18.4%", 22, 90, 0.9);
};

export const chartDown: Plate = (pen, rng) => {
  chartFrame(pen, 18, 12, 148, 84);
  const pts = candles(pen, rng, 20, 146, 16, 82, -1);
  const avg: Pt[] = pts.map((p, i) => {
    const k = pts.slice(Math.max(0, i - 3), i + 1);
    return [p[0], k.reduce((s, q) => s + q[1], 0) / k.length - 2];
  });
  pen.hatch([...avg, [avg[avg.length - 1]![0], 84], [avg[0]![0], 84]], -45, 2.2, 0.24);
  pen.path(smooth(avg), { stroke: INK, w: 0.9 });
  arrow(pen, [106, 40], [150, 90], 2.2, PIGMENT.signal);
  dotText(pen, "-31.2%", 22, 90, 0.9);
};

/* ------------------------------------------------------------- ticker */

export const ticker: Plate = (pen, rng, variant) => {
  // A dot-matrix board on a trading floor wall; the tape reads our world.
  const board: Ring = rect(4, 16, 152, 50);
  pen.shape(board, INK, null);
  pen.shape(rect(2.5, 14.5, 155, 53), "none", INK, 0.6);
  const rows: Array<[string, boolean]> = variant
    ? [["VELA 412.8 ^18.4", true], ["ORRN 96.1 v2.1", false], ["HLBD 233.0 ^9.1", true]]
    : [["TSSY 58.3 v0.8", false], ["VELA 412.8 ^18.4", true], ["CRAIL 12.4 v4.2", false]];
  let y = 21;
  for (const [txt, up] of rows) {
    const parts = txt.split(" ");
    let x = 8;
    x += dotText(pen, parts[0]!, x, y, 1.05, PAPER) + 4;
    x += dotText(pen, parts[1]!, x, y, 1.05, PAPER) + 4;
    dotText(pen, parts[2]!, x, y, 1.05, up ? PAPER : PIGMENT.signal);
    y += 14.5;
  }
  // Scanline texture across the board.
  pen.hatch(board, 0, 1.05, 0.2, PAPER);
  // Floor below: desks and screens in silhouette.
  pen.line(0, 80, PW, 80, LINE.edge);
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 26 + rng.range(-2, 2);
    pen.shape(rect(x, 72, 20, 8), PAPER, INK, 0.5);
    pen.hatch(rect(x, 72, 20, 8), 90, 0.8, 0.26);
    pen.shape(rect(x + 3, 64, 6, 7), INK, null);
    pen.shape(rect(x + 11, 64, 6, 7), INK, null);
    pen.line(x + 6, 71, x + 6, 72, 0.5);
    pen.line(x + 14, 71, x + 14, 72, 0.5);
  }
  for (let i = 0; i < 4; i++) figure(pen, 18 + i * 38 + rng.range(-4, 4), 96, 22, { pose: rng.chance(0.4) ? "phone" : "back", dir: rng.chance(0.5) ? 1 : -1, halo: 1.2 });
};

/* ------------------------------------------------------------- chip */

export const chip: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-1.7, 2.5, 2.7], target: [0.05, 0, -0.1], fov: 34 });
  // Board traces running out from under the package, with vias.
  const traces: Array<[Pt, Pt]> = [];
  const vias: Pt[] = [];
  for (let i = -9; i <= 9; i++) {
    const side = i * 0.11;
    const run = 1.2 + (i % 3) * 0.3;
    const a = cam.p([side, 0, 0.5]);
    const b = cam.p([side, 0, 0.5 + run * 0.4]);
    const c = cam.p([side + (i < 0 ? -1 : 1) * run * 0.5, 0, 0.5 + run * 0.4 + 0.3]);
    traces.push([a, b], [b, c]);
    vias.push(c);
    const d = cam.p([0.5, 0, side]);
    const e = cam.p([0.5 + run * 0.5, 0, side]);
    traces.push([d, e]);
    vias.push(e);
    const f = cam.p([-0.5, 0, side]);
    const g = cam.p([-0.5 - run * 0.45, 0, side - 0.2]);
    traces.push([f, g]);
    vias.push(g);
  }
  pen.segs(traces, 0.4);
  for (const v of vias) pen.circle(v[0], v[1], 0.8, { fill: PAPER, stroke: INK, w: 0.35 });
  // Package: substrate, lid and pins.
  const sub = box([0, 0, 0], [1.1, 0.05, 1.1], 0);
  drawSolid(pen, cam, sub, {}, 0.7);
  const pins: Array<[Pt, Pt]> = [];
  for (let k = 0; k < 24; k++) {
    const t = -0.5 + (k + 0.5) / 24;
    pins.push([cam.p([t * 1.05, 0.02, 0.55]), cam.p([t * 1.05, 0, 0.62])]);
    pins.push([cam.p([-0.55, 0.02, t * 1.05]), cam.p([-0.62, 0, t * 1.05])]);
  }
  pen.segs(pins, 0.55);
  const lid = box([0, 0.05, 0], [0.8, 0.07, 0.8], 0);
  drawSolid(pen, cam, lid, { spacing: 0.7 }, LINE.contour);
  const top = lid[4]!;
  // Die: a grid of cores, one lit.
  const n = 6;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const u0 = 0.14 + (i / n) * 0.72;
      const v0 = 0.14 + (j / n) * 0.72;
      const r = [faceAt(top, u0 + 0.01, v0 + 0.01), faceAt(top, u0 + 0.72 / n - 0.01, v0 + 0.01), faceAt(top, u0 + 0.72 / n - 0.01, v0 + 0.72 / n - 0.01), faceAt(top, u0 + 0.01, v0 + 0.72 / n - 0.01)].map((p) => cam.p(p));
      const lit = i === 2 + variant && j === 3;
      pen.shape(r, lit ? PIGMENT.cyan : PAPER, INK, 0.3);
      if (!lit && (i + j) % 2 === 0) pen.hatch(r, 45, 0.7, 0.22);
    }
  // Engraved marking.
  const m0 = cam.p(faceAt(top, 0.14, 0.08));
  const m1 = cam.p(faceAt(top, 0.6, 0.08));
  pen.line(m0[0], m0[1], m1[0], m1[1], 0.5);
  void rng;
};

/* --------------------------------------------------------- satellite */

export const satellite: Plate = (pen, rng, variant) => {
  // Stars.
  const stars: string[] = [];
  for (let i = 0; i < 60; i++) {
    const x = rng.range(0, PW);
    const y = rng.range(0, 64);
    const r = rng.range(0.25, 0.6);
    stars.push(`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`);
  }
  pen.path(stars.join(""), { fill: INK });
  // Earth's limb with atmosphere lines.
  const R = 260;
  const cx = 80;
  const cy = 64 + R;
  const limb: Pt[] = [];
  for (let a = -0.5; a <= 0.5; a += 0.02) limb.push([cx + Math.sin(a) * R, cy - Math.cos(a) * R]);
  const disc: Ring = [...limb, [PW + 20, PH + 20], [-20, PH + 20]];
  pen.shape(disc, PAPER, INK, LINE.edge);
  for (let k = 1; k < 4; k++) {
    const arc: Pt[] = limb.map(([x, y]) => [cx + (x - cx) * (1 + k * 0.012), cy + (y - cy) * (1 + k * 0.012)]);
    pen.stroke(arc, 0.22);
  }
  pen.hatch(disc, 20, 1.3, 0.26, INK, { spacingAt: (t) => lerp(3, 1, t) });
  // Cloud swirls on the planet.
  pen.path(`M20 88q12 -6 26 -2t26 -2M92 84q10 -4 20 0t22 -1M40 96q14 -4 30 0`, { stroke: INK, w: 0.4 });
  // The satellite: bus, two wings of cells, a dish.
  const cam = new Cam({ eye: [2.6, 1.6, 9], target: [0, 0.1, 0], fov: 38 });
  const bus = box([0, -0.6, 0], [1.1, 1.3, 1.1], 0.5);
  const wing = (dir: number) => {
    const pts: V3[] = [
      [dir * 0.8, 0, 0.3],
      [dir * 4.6, 0, 0.3 + dir * 0.4],
      [dir * 4.6, 0.02, -0.9 + dir * 0.4],
      [dir * 0.8, 0.02, -0.9],
    ];
    const f: Face = { pts, n: [0, 1, 0.2], role: "roof" };
    const r = pts.map((p) => cam.p(p));
    pen.shape(r, PAPER, INK, LINE.detail);
    const cells: Array<[Pt, Pt]> = [];
    for (let i = 1; i < 9; i++) cells.push([cam.p(faceAt(f, i / 9, 0)), cam.p(faceAt(f, i / 9, 1))]);
    for (let j = 1; j < 3; j++) cells.push([cam.p(faceAt(f, 0, j / 3)), cam.p(faceAt(f, 1, j / 3))]);
    pen.segs(cells, 0.3);
    pen.hatch(r, 70, 0.9, 0.26);
    const strut = [cam.p([dir * 0.55, -0.1, -0.3]), cam.p([dir * 0.8, 0, -0.3])];
    pen.line(strut[0]![0], strut[0]![1], strut[1]![0], strut[1]![1], 0.6);
  };
  wing(-1);
  drawSolid(pen, cam, bus, { spacing: 0.7 }, LINE.contour);
  const front = visibleFaces(cam, bus).find((f) => f.role === "wall");
  if (front) for (const v of [0.3, 0.55, 0.8]) {
    const a = cam.p(faceAt(front, 0, v));
    const b = cam.p(faceAt(front, 1, v));
    pen.line(a[0], a[1], b[0], b[1], 0.25);
  }
  wing(1);
  const dc = cam.p([0.2, 0.9, 0.4]);
  pen.line(cam.p([0.2, 0.05, 0.3])[0], cam.p([0.2, 0.05, 0.3])[1], dc[0], dc[1], 0.6);
  pen.path(`M${dc[0] - 6} ${dc[1] - 1}A6.5 3.2 -18 0 0 ${dc[0] + 6} ${dc[1] - 3}Z`, { fill: PAPER, stroke: INK, w: 0.6 });
  pen.hatch([[dc[0] - 6, dc[1] - 1], [dc[0] + 6, dc[1] - 3], [dc[0] + 3, dc[1] + 1.4], [dc[0] - 3, dc[1] + 1.8]], 80, 0.8, 0.26);
  void variant;
};

/* -------------------------------------------------------------- drones */

function quad(pen: Pen, x: number, y: number, s: number, tilt = 0): void {
  // A quadcopter seen from a little above: X frame, four rotor discs, a gimbal.
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const P = (u: number, v: number): Pt => [x + u * s * c - v * s * 0.45 * sn, y + u * s * sn * 0.3 + v * s * 0.45];
  const arms: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const back = arms.filter(([, v]) => v < 0);
  const fwd = arms.filter(([, v]) => v > 0);
  const rotor = ([u, v]: [number, number]) => {
    const p = P(u, v);
    pen.path(`M${p[0] - s * 0.62} ${p[1]}a${s * 0.62} ${s * 0.2} 0 1 0 ${s * 1.24} 0a${s * 0.62} ${s * 0.2} 0 1 0 ${-s * 1.24} 0`, { fill: PAPER, stroke: INK, w: Math.max(0.3, s * 0.04) });
    pen.line(p[0] - s * 0.5, p[1] + s * 0.03, p[0] + s * 0.5, p[1] - s * 0.03, Math.max(0.3, s * 0.05));
    pen.line(p[0], p[1], p[0], p[1] + s * 0.14, Math.max(0.3, s * 0.08));
  };
  for (const a of back) rotor(a);
  for (const [u, v] of arms) {
    const p = P(u, v);
    pen.line(x, y + s * 0.12, p[0], p[1] + s * 0.14, Math.max(0.5, s * 0.1));
  }
  pen.path(`M${x - s * 0.4} ${y}q${s * 0.4} ${-s * 0.3} ${s * 0.8} 0l${-s * 0.1} ${s * 0.36}h${-s * 0.6}Z`, { fill: INK });
  pen.circle(x, y + s * 0.5, s * 0.16, { fill: PAPER, stroke: INK, w: Math.max(0.3, s * 0.05) });
  pen.circle(x + s * 0.04, y + s * 0.52, s * 0.06, { fill: INK });
  for (const a of fwd) rotor(a);
  pen.line(x - s * 0.3, y + s * 0.3, x - s * 0.42, y + s * 0.62, Math.max(0.3, s * 0.05));
  pen.line(x + s * 0.3, y + s * 0.3, x + s * 0.42, y + s * 0.62, Math.max(0.3, s * 0.05));
}

export const drone: Plate = (pen, rng, variant) => {
  const hy = 74;
  pen.line(0, hy, PW, hy, LINE.detail);
  // Rooftops of a town far below.
  for (let i = 0; i < 12; i++) {
    const x = i * 14 + rng.range(-3, 3);
    const w = rng.range(8, 12);
    const h = rng.range(3, 7);
    pen.shape([[x, hy], [x, hy - h], [x + w / 2, hy - h - 3], [x + w, hy - h], [x + w, hy]], PAPER, INK, 0.4);
    pen.hatch([[x + w / 2, hy - h - 3], [x + w, hy - h], [x + w, hy], [x + w / 2, hy]], 90, 0.9, 0.25);
  }
  const grass: Array<[Pt, Pt]> = [];
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, PW);
    const y = rng.range(hy + 4, PH);
    grass.push([[x, y], [x + rng.range(3, 8), y]]);
  }
  pen.segs(grass, 0.28);
  quad(pen, 128, 22, 4, 0.1);
  quad(pen, 22, 30, 3, -0.1);
  quad(pen, 70 + variant * 6, 42, 17, 0.06);
  // Downwash lines.
  pen.segs(
    [
      [[56, 54], [52, 64]],
      [[62, 55], [60, 66]],
      [[80, 55], [82, 66]],
      [[86, 54], [90, 63]],
    ],
    0.3,
  );
};

export const swarm: Plate = (pen, rng, variant) => {
  const hy = 82;
  // Skyline silhouette.
  let x = 0;
  const sky: Pt[] = [[0, hy]];
  while (x < PW) {
    const w = rng.range(6, 14);
    const h = rng.range(6, 22);
    sky.push([x, hy - h], [x + w, hy - h]);
    x += w;
  }
  sky.push([PW, hy], [PW, PH], [0, PH]);
  pen.shape(sky, PAPER, INK, LINE.detail);
  pen.hatch(sky, 90, 0.9, 0.28);
  // The swarm: a river of small craft following a flow field.
  const marks: string[] = [];
  for (let i = 0; i < 520; i++) {
    const t = rng.next();
    const spread = rng.gauss();
    const bx = t * 190 - 15;
    const by = 46 + Math.sin(t * 5 + variant) * 16 - t * 10 + spread * (5 + 7 * Math.sin(t * 3.1));
    const s = 0.55 + rng.next() * 0.55;
    marks.push(`M${(bx - s).toFixed(1)} ${(by - s * 0.5).toFixed(1)}l${(2 * s).toFixed(1)} ${s.toFixed(1)}M${(bx - s).toFixed(1)} ${(by + s * 0.5).toFixed(1)}l${(2 * s).toFixed(1)} ${(-s).toFixed(1)}`);
  }
  pen.path(marks.join(""), { stroke: INK, w: 0.34 });
  quad(pen, 132, 22, 5, 0.1);
};

/* -------------------------------------------------------------- robots */

function robot(pen: Pen, x: number, y: number, h: number, lit = false): void {
  const U = h / 10;
  if (h < 14) {
    // Far rank: one silhouette per unit, with the visor slit cut in paper.
    const P = (u: number, v: number) => `${(x + u * U).toFixed(1)} ${(y - v * U).toFixed(1)}`;
    const d = `M${P(-0.65, 0)}L${P(-0.65, 4.5)}L${P(-1, 4.6)}L${P(-1.05, 5.4)}L${P(-1.7, 5.6)}L${P(-1.7, 8.3)}L${P(-0.6, 8.5)}L${P(-0.7, 9.6)}L${P(0.7, 9.6)}L${P(0.6, 8.5)}L${P(1.7, 8.3)}L${P(1.7, 5.6)}L${P(1.05, 5.4)}L${P(1, 4.6)}L${P(0.65, 4.5)}L${P(0.65, 0)}L${P(0.08, 0)}L${P(0.05, 4.2)}L${P(-0.05, 4.2)}L${P(-0.08, 0)}Z`;
    pen.path(d, { fill: PAPER, stroke: INK, w: Math.max(0.3, U * 0.14) });
    pen.line(x - 0.45 * U, y - 9.1 * U, x + 0.45 * U, y - 9.1 * U, Math.max(0.3, U * 0.25), INK, "butt");
    pen.line(x + 0.25 * U, y - 5.5 * U, x + 0.25 * U, y - 8.2 * U, Math.max(0.3, U * 0.35), INK, "butt");
    return;
  }
  const P = (u: number, v: number): Pt => [x + u * U, y - v * U];
  const R = (u0: number, v0: number, u1: number, v1: number): Ring => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
  const w = Math.max(0.3, U * 0.12);
  // Legs.
  for (const s of [-1, 1]) {
    pen.shape(R(s * 0.35 - 0.3, 0, s * 0.35 + 0.3, 2.3), PAPER, INK, w);
    pen.shape(R(s * 0.35 - 0.34, 2.4, s * 0.35 + 0.34, 4.5), PAPER, INK, w);
    pen.shape(R(s * 0.35 - 0.42, 0, s * 0.35 + 0.46, 0.35), INK, null);
  }
  // Pelvis and torso.
  pen.shape(R(-1, 4.5, 1, 5.3), PAPER, INK, w);
  pen.shape([P(-1.35, 8.3), P(1.35, 8.3), P(1.05, 5.4), P(-1.05, 5.4)], PAPER, INK, w);
  pen.hatch([P(0.2, 8.3), P(1.35, 8.3), P(1.05, 5.4), P(0.2, 5.4)], 90, Math.max(0.6, U * 0.35), 0.26);
  pen.shape(R(-0.55, 6.4, 0.55, 7.6), PAPER, INK, w * 0.8);
  if (lit) pen.circle(x, y - 7 * U, U * 0.22, { fill: PIGMENT.cyan });
  // Arms.
  for (const s of [-1, 1]) {
    pen.shape(R(s * 1.45 - 0.25, 6.2, s * 1.45 + 0.25, 8.2), PAPER, INK, w);
    pen.shape(R(s * 1.5 - 0.22, 4.4, s * 1.5 + 0.22, 6.1), PAPER, INK, w);
  }
  // Head: rounded block with a visor slit.
  pen.line(x, y - 8.3 * U, x, y - 8.7 * U, w * 1.5);
  pen.shape(`M${P(-0.6, 8.7)[0]} ${P(-0.6, 8.7)[1]}h${1.2 * U}q${0.2 * U} 0 ${0.2 * U} ${-0.2 * U}v${-0.9 * U}q0 ${-0.2 * U} ${-0.2 * U} ${-0.2 * U}h${-1.2 * U}q${-0.2 * U} 0 ${-0.2 * U} ${0.2 * U}v${0.9 * U}q0 ${0.2 * U} ${0.2 * U} ${0.2 * U}Z`, PAPER, INK, w);
  pen.shape(R(-0.55, 9.2, 0.55, 9.45), INK, null);
}

export const robots: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-4.2, 1.7, 7.5], target: [1.6, 1.5, -20], fov: 50 });
  const hy = cam.horizon();
  // Warehouse: columns and roof trusses receding.
  for (let z = -18; z > -90; z -= 12) {
    for (const xx of [-8, 12]) {
      const a = cam.p([xx, 0, z]);
      const b = cam.p([xx, 9, z]);
      pen.line(a[0], a[1], b[0], b[1], Math.min(1.1, Math.max(0.3, cam.scale([xx, 0, z]) * 0.3)));
    }
    const l = cam.p([-8, 9, z]);
    const r = cam.p([12, 9, z]);
    const m = cam.p([2, 11, z]);
    pen.stroke([l, m, r], 0.35);
    pen.line(l[0], l[1], r[0], r[1], 0.35);
  }
  pen.line(0, hy, PW, hy, 0.25);
  // Floor grid.
  const floor: Array<[Pt, Pt]> = [];
  for (let xx = -8; xx <= 12; xx += 2) floor.push([cam.p([xx, 0, 6]), cam.p([xx, 0, -90])]);
  pen.segs(floor, 0.2);
  // Ranks of identical units.
  const units: V3[] = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) units.push([-3 + c * 2.2, 0, -4 - r * 3.4]);
  units.sort((a, b) => cam.depth(b) - cam.depth(a));
  for (const u of units) {
    const p = cam.p(u);
    robot(pen, p[0], p[1], 1.8 * cam.scale(u), false);
  }
  const lead: V3 = [-1.9, 0, 3.6];
  const lp = cam.p(lead);
  robot(pen, lp[0], lp[1], 1.8 * cam.scale(lead), true);
  void rng;
  void variant;
};

/* ------------------------------------------------------------- missile */

export const missile: Plate = (pen, rng, variant) => {
  const hy = 80;
  // Hills and a treeline.
  const hillPts: Pt[] = [];
  for (let x = -5; x <= PW + 5; x += 8) hillPts.push([x, hy - 4 - Math.sin(x * 0.04 + variant) * 3 - Math.sin(x * 0.11) * 1.5]);
  pen.path(smooth(hillPts), { stroke: INK, w: LINE.detail });
  // Launch: a column of exhaust billowing at the base, the trail climbing.
  const base: Pt = [58, hy - 5];
  const top: Pt = [104, 16];
  // Ground cloud at the pad.
  billows(pen, [[base[0] - 12, base[1] + 1, 7], [base[0] + 11, base[1] + 1.5, 6.5], [base[0] - 21, base[1] + 3, 5], [base[0] + 19, base[1] + 3, 4.6], [base[0], base[1] - 2, 7.5]], 0.45);
  // The climb: a tapered, lumpy column of smoke along the trajectory.
  const at = (t: number) => lerpPt(base, top, t * t * 0.85 + t * 0.15);
  const centre: Pt[] = [];
  const left: Pt[] = [];
  const right: Pt[] = [];
  const ph = rng.range(0, 6);
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const c = at(t);
    const d = at(Math.min(1, t + 0.01));
    const e = at(Math.max(0, t - 0.01));
    const ang = Math.atan2(d[1] - e[1], d[0] - e[0]);
    const w = lerp(6.4, 0.7, Math.sqrt(t)) * (1 + 0.16 * Math.sin(t * 46 + ph) + 0.08 * Math.sin(t * 97 + ph * 2));
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    centre.push(c);
    left.push([c[0] + nx * w, c[1] + ny * w]);
    right.push([c[0] - nx * w, c[1] - ny * w]);
  }
  const column: Pt[] = [...left, ...right.slice().reverse()];
  pen.path(smooth(column, true), { fill: PAPER, stroke: INK, w: LINE.detail });
  pen.hatch([...centre, ...left.slice().reverse()], 58, 1.05, LINE.hatch);
  // The missile itself at the head of the trail.
  const ang = Math.atan2(top[1] - lerpPt(base, top, 0.85)[1], top[0] - lerpPt(base, top, 0.85)[0]);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (u: number, v: number): Pt => [top[0] + u * c - v * s, top[1] + u * s + v * c];
  const L = 12;
  const r = 1.1;
  pen.shape([P(0, -r), P(L * 0.8, -r), P(L, 0), P(L * 0.8, r), P(0, r)], PAPER, INK, 0.6);
  pen.hatch([P(0, 0), P(L * 0.8, 0), P(L, 0), P(L * 0.8, r), P(0, r)], 20, 0.6, 0.26);
  pen.shape([P(0, -r), P(-2.4, -r * 2.6), P(1.6, -r)], INK, null);
  pen.shape([P(0, r), P(-2.4, r * 2.6), P(1.6, r)], INK, null);
  pen.path(`M${P(-0.2, -0.7)[0]} ${P(-0.2, -0.7)[1]}L${P(-4.4, 0)[0]} ${P(-4.4, 0)[1]}L${P(-0.2, 0.7)[0]} ${P(-0.2, 0.7)[1]}Z`, { fill: PIGMENT.ember });
  // Trees in front of the launch site.
  for (let i = 0; i < 14; i++) tree(pen, i * 12 + rng.range(-2, 2), hy + rng.range(0, 3), rng.range(7, 11), rng, i % 3 ? "conifer" : "round");
  pen.line(0, hy + 2, PW, hy + 2, LINE.hatch);
  // A second, distant trail.
  pen.path(`M130 ${hy - 6}C134 60 142 42 150 30`, { stroke: INK, w: 0.6, dash: "1.2 1.2" });
};

/* ---------------------------------------------------------- lab bench */

export const lab: Plate = (pen, rng, variant) => {
  const bench = 80;
  pen.shape(rect(-2, bench, PW + 4, 4), PAPER, INK, LINE.edge);
  pen.hatch(rect(-2, bench + 4, PW + 4, 30), 90, 0.9, 0.3);
  pen.line(-2, bench + 4, PW + 2, bench + 4, LINE.edge);
  // Tiled splashback.
  const tiles: Array<[Pt, Pt]> = [];
  for (let y = 8; y < bench; y += 12) tiles.push([[0, y], [PW, y]]);
  for (let yy = 0; yy < 7; yy++) for (let x = (yy % 2) * 8; x < PW; x += 16) tiles.push([[x, 8 + yy * 12], [x, Math.min(bench, 20 + yy * 12)]]);
  pen.segs(tiles, 0.2);
  // Erlenmeyer flask with liquid.
  const ex = 34;
  const flask = `M${ex - 3} ${bench - 34}V${bench - 22}L${ex - 14} ${bench - 2}Q${ex - 15} ${bench} ${ex - 12} ${bench}H${ex + 12}Q${ex + 15} ${bench} ${ex + 14} ${bench - 2}L${ex + 3} ${bench - 22}V${bench - 34}`;
  pen.path(flask, { fill: PAPER, stroke: INK, w: LINE.edge });
  const liquid: Ring = [
    [ex - 9.6, bench - 10],
    [ex + 9.6, bench - 10],
    [ex + 14, bench - 2],
    [ex + 12, bench],
    [ex - 12, bench],
    [ex - 14, bench - 2],
  ];
  pen.hatch(liquid, 0, 0.9, 0.3);
  pen.line(ex - 9.6, bench - 10, ex + 9.6, bench - 10, 0.5);
  pen.line(ex - 4.2, bench - 34, ex + 4.2, bench - 34, 0.9);
  for (const b of [
    [ex - 3, bench - 6, 1],
    [ex + 4, bench - 4, 0.7],
    [ex + 1, bench - 13, 0.6],
  ] as const)
    pen.circle(b[0], b[1], b[2], { fill: PAPER, stroke: INK, w: 0.3 });
  // Beaker with graduations.
  const bx = 70;
  pen.path(`M${bx - 9} ${bench - 26}L${bx - 8} ${bench}H${bx + 8}L${bx + 9} ${bench - 26}M${bx - 9} ${bench - 26}l-1.6 -1.2`, { fill: PAPER, stroke: INK, w: LINE.edge });
  const grads: Array<[Pt, Pt]> = [];
  for (let k = 1; k < 6; k++) grads.push([[bx - 7, bench - k * 4], [bx - (k % 2 ? 3 : 5), bench - k * 4]]);
  pen.segs(grads, 0.35);
  pen.hatch([[bx - 8.4, bench - 12], [bx + 8.4, bench - 12], [bx + 8, bench], [bx - 8, bench]], 90, 1, 0.28);
  // Rack of test tubes.
  const rx = 104;
  pen.shape(rect(rx - 4, bench - 12, 34, 3), PAPER, INK, 0.6);
  pen.shape(rect(rx - 4, bench - 3, 34, 3), PAPER, INK, 0.6);
  for (let i = 0; i < 5; i++) {
    const tx = rx + i * 6.4;
    const level = rng.range(6, 16);
    pen.path(`M${tx - 2} ${bench - 30}V${bench - 5}a2 2 0 0 0 4 0V${bench - 30}`, { fill: PAPER, stroke: INK, w: 0.55 });
    pen.hatch([[tx - 2, bench - 3 - level], [tx + 2, bench - 3 - level], [tx + 2, bench - 5], [tx, bench - 3], [tx - 2, bench - 5]], 90, 0.7, 0.26);
    pen.line(tx - 2.6, bench - 30, tx + 2.6, bench - 30, 0.6);
  }
  pen.shape(rect(rx - 4, bench - 12, 34, 3), PAPER, INK, 0.6);
  pen.line(rx - 3, bench - 12, rx - 3, bench, 0.8);
  pen.line(rx + 29, bench - 12, rx + 29, bench, 0.8);
  // Pipette resting across.
  pen.line(128, bench - 4, 156, bench - 16, 1.2);
  pen.line(128, bench - 4, 156, bench - 16, 0.5, PAPER);
  // Label on the flask.
  pen.shape(rect(ex - 6, bench - 20, 12, 5), PAPER, INK, 0.4);
  pen.line(ex - 4, bench - 17.5, ex + 3, bench - 17.5, 0.5);
  void variant;
};

/* --------------------------------------------------------- medicine */

export const medicine: Plate = (pen, rng, variant) => {
  // A double helix across the plate; a capsule and vial in front of it.
  const strands: [Pt[], Pt[]] = [[], []];
  const rungs: Array<[Pt, Pt]> = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = -6 + t * 172;
    const yc = 58 - t * 34;
    const ph = t * Math.PI * 7 + variant;
    const a: Pt = [x, yc + Math.sin(ph) * 12];
    const b: Pt = [x, yc - Math.sin(ph) * 12];
    strands[0].push(a);
    strands[1].push(b);
    if (i % 4 === 0) rungs.push([a, b]);
  }
  pen.segs(rungs, 0.3);
  pen.stroke(strands[0], 1.2);
  pen.stroke(strands[1], 1.2);
  pen.stroke(strands[1], 0.4, PAPER);
  // Capsule, split.
  const cap = (x: number, y: number, ang: number, fillHalf: boolean) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const P = (u: number, v: number): Pt => [x + u * c - v * s, y + u * s + v * c];
    const half: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI / 2 + (k / 12) * Math.PI;
      half.push(P(-8 + Math.cos(a) * 5, Math.sin(a) * 5));
    }
    const ring: Ring = [P(0, -5), ...half.reverse(), P(0, 5)];
    pen.shape(ring, fillHalf ? INK : PAPER, INK, 0.7);
    if (!fillHalf) pen.hatch(ring, (ang * 180) / Math.PI + 90, 1.2, 0.28);
  };
  cap(64, 78, -0.4, true);
  cap(84, 70, -0.4 + Math.PI, false);
  for (let i = 0; i < 12; i++) pen.circle(72 + rng.range(-3, 5), 76 + rng.range(-3, 3), rng.range(0.5, 1), { fill: INK });
  // Vial with a crimped cap.
  const vx = 124;
  const vy = 88;
  pen.path(`M${vx - 6} ${vy}V${vy - 20}q0 -3 3 -3h6q3 0 3 3V${vy}Z`, { fill: PAPER, stroke: INK, w: LINE.edge });
  pen.shape(rect(vx - 4, vy - 28, 8, 5), INK, null);
  pen.shape(rect(vx - 6, vy - 14, 12, 7), PAPER, INK, 0.4);
  pen.line(vx - 4, vy - 10.5, vx + 3, vy - 10.5, 0.5);
  pen.hatch([[vx + 2, vy], [vx + 2, vy - 20], [vx + 6, vy - 20], [vx + 6, vy]], 90, 0.7, 0.26);
  pen.line(0, 92, PW, 92, 0.3);
};

/* ----------------------------------------------------------- physics */

export const physics: Plate = (pen, rng, variant) => {
  // A bubble-chamber plate: tracks from one vertex, spirals, fiducial crosses.
  const v: Pt = [74 + variant * 6, 54];
  const tracks: string[] = [];
  for (let i = 0; i < 14; i++) {
    const ang = rng.range(-Math.PI, Math.PI);
    const curv = rng.range(-0.018, 0.018);
    let x = v[0];
    let y = v[1];
    let a = ang;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const len = rng.range(40, 110);
    for (let s = 0; s < len; s += 2) {
      a += curv * 2;
      x += Math.cos(a) * 2;
      y += Math.sin(a) * 2;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    tracks.push(d);
  }
  pen.path(tracks.join(""), { stroke: INK, w: 0.45 });
  // Spirals: slowing electrons.
  const spiral = (cx: number, cy: number, r0: number, turns: number, dir: number) => {
    let d = "";
    for (let k = 0; k <= turns * 60; k++) {
      const t = k / 60;
      const r = r0 * Math.exp(-t * 0.55);
      const a = dir * t * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d += `${k ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    pen.path(d, { stroke: INK, w: 0.55 });
  };
  spiral(v[0] + 22, v[1] - 14, 12, 3.5, 1);
  spiral(v[0] - 30, v[1] + 12, 9, 3, -1);
  spiral(v[0] + 40, v[1] + 20, 6, 2.5, 1);
  // A pair from a neutral decay: a V with no incoming track.
  const n: Pt = [v[0] + 30, v[1] - 30];
  pen.path(`M${n[0]} ${n[1]}q10 -6 22 -8M${n[0]} ${n[1]}q6 -10 8 -22`, { stroke: INK, w: 0.6 });
  pen.line(v[0], v[1], n[0], n[1], 0.5, INK, "butt");
  pen.path(`M${v[0]} ${v[1]}L${n[0]} ${n[1]}`, { stroke: PAPER, w: 0.5, dash: "1.2 1.4" });
  // Fiducials and the vertex.
  const cross: Array<[Pt, Pt]> = [];
  for (const [x, y] of [
    [12, 12],
    [148, 12],
    [12, 88],
    [148, 88],
  ] as const)
    cross.push([[x - 3, y], [x + 3, y]], [[x, y - 3], [x, y + 3]]);
  pen.segs(cross, 0.5);
  pen.circle(v[0], v[1], 1.4, { fill: INK });
  // Bubble texture.
  for (let i = 0; i < 40; i++) pen.circle(rng.range(0, PW), rng.range(0, PH), rng.range(0.2, 0.45), { fill: INK });
  dotText(pen, "G-7", 126, 90, 0.8);
};

/* -------------------------------------------------------------- cyber */

export const cyber: Plate = (pen, rng, variant) => {
  // A wall of screens with code; one line is the breach.
  const screens: Ring[] = [];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) screens.push(rect(8 + c * 50, 8 + r * 38, 46, 34));
  const breachAt = 1 + variant;
  for (const [i, sc] of screens.entries()) {
    const breach = i === breachAt;
    pen.shape(sc, breach ? INK : PAPER, INK, LINE.edge);
    if (!breach) pen.hatch(sc, 0, 1.9, 0.2);
    const x0 = sc[0]![0] + 4;
    const y0 = sc[0]![1] + 5;
    const fg = breach ? PAPER : INK;
    for (let l = 0; l < 7; l++) {
      const indent = (l % 3) * 3;
      const len = rng.range(10, 32);
      const red = breach && l === 4;
      pen.line(x0 + indent, y0 + l * 3.8, x0 + indent + len, y0 + l * 3.8, 1.2, red ? PIGMENT.signal : fg, "butt");
      if (!red && rng.chance(0.5)) pen.line(x0 + indent + len + 2, y0 + l * 3.8, x0 + indent + len + 2 + rng.range(3, 8), y0 + l * 3.8, 1.2, fg, "butt");
    }
    // Monitor stand.
    pen.line(sc[0]![0] + 23, sc[2]![1], sc[0]![0] + 23, sc[2]![1] + 2.4, 0.8);
  }
  // The open padlock in front.
  const px = 80;
  const py = 70;
  pen.path(`M${px - 9} ${py - 8}V${py - 18}a9 9 0 0 1 18 0V${py - 14}`, { fill: "none", stroke: PAPER, w: 7.2 });
  pen.path(`M${px - 9} ${py - 8}V${py - 18}a9 9 0 0 1 18 0V${py - 14}`, { fill: "none", stroke: INK, w: 4.2 });
  pen.path(`M${px - 9} ${py - 8}V${py - 18}a9 9 0 0 1 18 0V${py - 14}`, { fill: "none", stroke: PAPER, w: 1.6 });
  pen.shape(`M${px - 15} ${py - 9}h30v22q0 3 -3 3h-24q-3 0 -3 -3Z`, PAPER, INK, LINE.contour);
  pen.hatch([[px + 3, py - 9], [px + 15, py - 9], [px + 15, py + 16], [px + 3, py + 16]], 90, 0.8, 0.3);
  pen.circle(px, py + 1, 2.4, { fill: INK });
  pen.shape([[px - 1, py + 2], [px + 1, py + 2], [px + 1.6, py + 8], [px - 1.6, py + 8]], INK, null);
};

/* -------------------------------------------------------------- flood */

export const flood: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-3, 2.2, 10], target: [2, 3, -30], fov: 50 });
  const hy = cam.horizon();
  const level = 1.9;
  // Water first: surface strokes denser toward the horizon.
  water(pen, rng, hy + 0.5, PH);
  pen.line(0, hy, PW, hy, LINE.detail);
  const houses: Array<[number, number, number]> = [
    [-12, -22, 0.25],
    [0, -34, -0.1],
    [11, -20, 0.35],
    [23, -40, 0.1],
    [-26, -44, 0],
  ];
  houses.sort((a, b) => cam.depth([b[0], 0, b[1]]) - cam.depth([a[0], 0, a[1]]));
  for (const [x, z, yaw] of houses) {
    const faces = gabled([x, 0, z], [8, 5.2, 6.5], 3, yaw, 0.5);
    const above = faces.map((f) => clipAbove(f, level)).filter((f): f is Face => !!f);
    // Reflection: the house mirrored in the water, as sparse broken strokes.
    const mirrored: Face[] = above.map((f) => ({ pts: f.pts.map(([px, py, pz]) => [px, 2 * level - py, pz] as V3), n: f.n, role: f.role }));
    const reflSegs: Array<[Pt, Pt]> = [];
    for (const f of mirrored) {
      const r = f.pts.map((p) => cam.p(p));
      let minY = Infinity,
        maxY = -Infinity,
        minX = Infinity,
        maxX = -Infinity;
      for (const [px, py] of r) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      for (let y = minY; y < maxY; y += 1.1) if (rng.chance(0.6)) reflSegs.push([[minX + rng.range(0, 2), y], [maxX - rng.range(0, 2), y]]);
    }
    pen.segs(reflSegs, 0.26);
    for (const f of visibleFaces(cam, above)) {
      drawFace(pen, cam, f, { spacing: 1 });
      if (f.role === "wall" && f.n[2] > 0.3)
        for (const u of [0.25, 0.7]) faceQuad(pen, cam, f, u - 0.08, 0.72, u + 0.08, 0.92, INK);
    }
    // Waterline ripple.
    const wl: Pt[] = above.filter((f) => f.role === "wall").flatMap((f) => f.pts.filter((p) => Math.abs(p[1] - level) < 0.01)).map((p) => cam.p(p));
    if (wl.length > 1) {
      wl.sort((a, b) => a[0] - b[0]);
      pen.line(wl[0]![0] - 1.5, wl[0]![1] + 0.4, wl[wl.length - 1]![0] + 1.5, wl[wl.length - 1]![1] + 0.4, 0.5);
    }
  }
  // A rowing boat with one figure.
  const bp = cam.p([2.5, level, -9]);
  const k = cam.scale([2.5, level, -9]);
  const hull: Ring = [
    [bp[0] - 2.2 * k, bp[1] - 0.45 * k],
    [bp[0] + 2.2 * k, bp[1] - 0.55 * k],
    [bp[0] + 1.5 * k, bp[1] + 0.12 * k],
    [bp[0] - 1.6 * k, bp[1] + 0.12 * k],
  ];
  figure(pen, bp[0] - 0.2 * k, bp[1] - 0.1 * k, 1.35 * k, { pose: "sit", dir: -1, halo: 0.6 });
  pen.shape(hull, PAPER, INK, 0.6);
  pen.hatch([lerpPt(hull[0]!, hull[3]!, 0.4), lerpPt(hull[1]!, hull[2]!, 0.4), hull[2]!, hull[3]!], 0, 0.55, 0.26);
  pen.line(bp[0] - 1.8 * k, bp[1] - 1 * k, bp[0] + 0.6 * k, bp[1] + 0.5 * k, 0.5);
  // Rain, only in the sky.
  pen.hatch(rect(0, 0, PW, hy - 2), 80, 5, 0.2, INK, { dash: [2, 6] });
  void variant;
};

/* --------------------------------------------------------------- fire */

export const fire: Plate = (pen, rng, variant) => {
  const hy = 70;
  // Smoke column, dark and leaning.
  plume(pen, 70 + variant * 10, hy - 8, { height: 70, drift: 44, width: 14, rng, dark: 0.7 });
  // The ridge and its burning trees.
  const ridge: Pt[] = [];
  for (let x = -5; x <= PW + 5; x += 6) ridge.push([x, hy - 10 + Math.sin(x * 0.035) * 8 + Math.sin(x * 0.13) * 2]);
  const land: Ring = [...ridge, [PW + 5, PH + 2], [-5, PH + 2]];
  pen.shape(land, PAPER, INK, LINE.detail);
  pen.hatch(land, 18, 2.3, 0.3, INK, { jitter: 0.8 });
  const flames: string[] = [];
  for (let i = 0; i < 22; i++) {
    const x = 20 + i * 5.6 + rng.range(-1.5, 1.5);
    const gy = lerp(ridge[Math.floor((x + 5) / 6)]![1], ridge[Math.min(ridge.length - 1, Math.floor((x + 5) / 6) + 1)]![1], ((x + 5) % 6) / 6);
    const h = rng.range(6, 15) * (1 - Math.abs(i - 11) / 16);
    const w = rng.range(2.4, 4.2);
    const lean = rng.range(1, 3);
    flames.push(`M${(x - w).toFixed(1)} ${gy.toFixed(1)}C${(x - w).toFixed(1)} ${(gy - h * 0.5).toFixed(1)} ${(x + lean - 1).toFixed(1)} ${(gy - h * 0.6).toFixed(1)} ${(x + lean).toFixed(1)} ${(gy - h).toFixed(1)}C${(x + lean * 0.3).toFixed(1)} ${(gy - h * 0.5).toFixed(1)} ${(x + w).toFixed(1)} ${(gy - h * 0.4).toFixed(1)} ${(x + w).toFixed(1)} ${gy.toFixed(1)}Z`);
    // Charred trunk.
    pen.line(x, gy, x + 0.3, gy - h * 0.8, 0.7);
  }
  pen.path(flames.join(""), { fill: PIGMENT.ember, stroke: INK, w: 0.35 });
  // Sparks.
  for (let i = 0; i < 26; i++) pen.circle(rng.range(40, 140), rng.range(20, hy - 10), rng.range(0.3, 0.6), { fill: PIGMENT.ember });
  // Foreground: a road with a fire engine's silhouette and a fence.
  pen.line(0, 90, PW, 88, LINE.edge);
  pen.shape([[18, 88.6], [18, 81], [30, 81], [33, 84], [38, 84], [38, 88.4]], INK, null);
  pen.circle(22, 89, 2, { fill: PAPER, stroke: INK, w: 0.6 });
  pen.circle(34, 88.7, 2, { fill: PAPER, stroke: INK, w: 0.6 });
  pen.line(16, 80, 30, 77, 0.8);
  pen.circle(31.5, 80.5, 0.9, { fill: PIGMENT.amber });
};

/* ------------------------------------------------------------ drought */

export const drought: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0, 1.7, 6], target: [0, 1.2, -30], fov: 50 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.detail);
  // The sun, drawn as an engraved disc of concentric rings.
  const sx = 118 - variant * 70;
  for (let r = 1; r <= 9; r += 2) pen.circle(sx, 20, r, { fill: "none", stroke: INK, w: 0.3 });
  pen.circle(sx, 20, 10.5, { fill: "none", stroke: INK, w: 0.7 });
  // Cracked mud: a jittered net of plates on the ground plane, curling at the edges.
  const cell = 1.3;
  const nx = 34;
  const nz = 22;
  const vtx: V3[][] = [];
  for (let j = 0; j <= nz; j++) {
    const row: V3[] = [];
    for (let i = 0; i <= nx; i++) row.push([-22 + i * cell + rng.range(-0.42, 0.42) * cell, 0, 5 - j * cell + rng.range(-0.42, 0.42) * cell]);
    vtx.push(row);
  }
  const near: Array<[Pt, Pt]> = [];
  const far: Array<[Pt, Pt]> = [];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const a = vtx[j]![i]!;
      const list = a[2] > -6 ? near : far;
      if (i < nx && rng.chance(0.93)) list.push([cam.p(a), cam.p(vtx[j]![i + 1]!)]);
      if (j < nz && rng.chance(0.93)) list.push([cam.p(a), cam.p(vtx[j + 1]![i]!)]);
      if (i < nx && j < nz && rng.chance(0.18)) list.push([cam.p(a), cam.p(vtx[j + 1]![i + 1]!)]);
    }
  pen.segs(near, 0.55);
  pen.segs(far, 0.32);
  // Shadowed lips of the nearest cracks.
  const lips: Array<[Pt, Pt]> = near.filter(() => rng.chance(0.35)).map(([p, q]) => [[p[0], p[1] + 0.5], [q[0], q[1] + 0.5]] as [Pt, Pt]);
  pen.segs(lips, 0.3);
  // A dead tree and a dry orchard row on the horizon.
  const tp = cam.p([-5, 0, -8]);
  tree(pen, tp[0], tp[1], 34, rng, "bare");
  for (let i = 0; i < 9; i++) {
    const p: V3 = [4 + i * 5, 0, -60];
    const q = cam.p(p);
    tree(pen, q[0], q[1], 7 * cam.scale(p), rng, "bare");
  }
  // Cattle skull? No: an empty trough.
  const tr = box([6, 0, -4], [2.4, 0.6, 0.8], 0.3);
  drawSolid(pen, cam, tr, {}, 0.7);
};

/* ------------------------------------------------------------ orchard */

export const orchard: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [2.75, 2.1, 10], target: [2.75, 1.5, -30], fov: 50 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.detail);
  const trees: V3[] = [];
  for (let row = -3; row <= 3; row++) for (let k = 0; k < 11; k++) trees.push([row * 5.5 + (row > 0 ? 1.5 : -1.5), 0, 2 - k * 7]);
  trees.sort((a, b) => cam.depth(b) - cam.depth(a));
  // Grass rows between the trees.
  const rows: Array<[Pt, Pt]> = [];
  for (let row = -3; row <= 3; row++) rows.push([cam.p([row * 5.5, 0, 9]), cam.p([row * 5.5, 0, -90])]);
  pen.segs(rows, 0.3);
  for (const t of trees) {
    const p = cam.p(t);
    tree(pen, p[0], p[1], 4.2 * cam.scale(t), rng, "orchard");
  }
  // Farmhouse at the end of the rows.
  const house = gabled([2, 0, -96], [10, 6, 8], 3.6, 0.3, 0.6);
  drawSolid(pen, cam, house, {}, 0.6);
  // A ladder against the nearest tree, and a picker.
  const lp = cam.p([5.2, 0, -5.4]);
  const k = cam.scale([5.2, 0, -5.4]);
  pen.line(lp[0], lp[1], lp[0] + k * 0.9, lp[1] - k * 2.8, 0.7);
  pen.line(lp[0] + k * 0.5, lp[1], lp[0] + k * 1.4, lp[1] - k * 2.8, 0.7);
  for (let i = 1; i < 6; i++) pen.line(lp[0] + (i / 6) * k * 0.9, lp[1] - (i / 6) * k * 2.8, lp[0] + k * 0.5 + (i / 6) * k * 0.9, lp[1] - (i / 6) * k * 2.8, 0.45);
  figure(pen, lp[0] + k * 0.5, lp[1] - k * 1.2, 1.7 * k, { pose: "arm", dir: 1, halo: 0.8 });
  // Crates.
  for (let i = 0; i < 3; i++) {
    const c = box([0.6 + i * 0.7, 0, 1.6 - i * 0.3], [0.6, 0.35, 0.45], 0.2);
    drawSolid(pen, cam, c, { spacing: 0.8 }, 0.6);
  }
  void variant;
};

/* -------------------------------------------------------------- money */

export const money: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0, 4.2, 9], target: [0, 0.6, 0], fov: 40 });
  // Circular flow: an ellipse of arrows around three stacks.
  const R = 3.3;
  const ring: Pt[] = [];
  for (let k = 0; k <= 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    ring.push(cam.p([Math.cos(a) * R, 0.02, Math.sin(a) * R]));
  }
  pen.stroke(ring, 2.4, INK, true);
  pen.stroke(ring, 1, PAPER, true);
  for (const a0 of [0.35, 0.35 + (Math.PI * 2) / 3, 0.35 + (Math.PI * 4) / 3]) {
    const p = cam.p([Math.cos(a0) * R, 0.02, Math.sin(a0) * R]);
    const q = cam.p([Math.cos(a0 + 0.15) * R, 0.02, Math.sin(a0 + 0.15) * R]);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const s = 3.6;
    pen.fill(
      [
        [q[0] + Math.cos(ang) * s, q[1] + Math.sin(ang) * s],
        [q[0] + Math.cos(ang + 2.4) * s, q[1] + Math.sin(ang + 2.4) * s],
        [q[0] + Math.cos(ang - 2.4) * s, q[1] + Math.sin(ang - 2.4) * s],
      ],
      INK,
    );
  }
  // A banknote lying in the middle, engraved.
  const note: V3[] = [
    [-1.1, 0.01, 0.6],
    [1.1, 0.01, 0.6],
    [1.1, 0.01, -0.5],
    [-1.1, 0.01, -0.5],
  ];
  const nr = note.map((p) => cam.p(p));
  pen.shape(nr, PAPER, INK, 0.6);
  const inner = [lerpPt(nr[0]!, nr[2]!, 0.08), lerpPt(nr[1]!, nr[3]!, 0.08), lerpPt(nr[2]!, nr[0]!, 0.08), lerpPt(nr[3]!, nr[1]!, 0.08)];
  pen.shape(inner, "none" as string, INK, 0.3);
  const oval = cam.p([0.45, 0.01, 0.05]);
  pen.path(`M${oval[0] - 4} ${oval[1]}a4 2.2 0 1 0 8 0a4 2.2 0 1 0 -8 0`, { stroke: INK, w: 0.4, fill: PAPER });
  pen.hatch(inner, 0, 0.8, 0.22);
  pen.path(`M${oval[0] - 4} ${oval[1]}a4 2.2 0 1 0 8 0a4 2.2 0 1 0 -8 0`, { stroke: INK, w: 0.4, fill: PAPER });
  // Coin stacks at the three stations.
  const stack = (x: number, z: number, n: number) => {
    const h = n * 0.16;
    cylinder(pen, cam, [x, 0, z], 0.62, 0, h, { tone: 0.35, w: 0.5, topVisible: true });
    // Coin edges: the near half of each rim.
    const edges: Array<[Pt, Pt]> = [];
    for (let i = 1; i < n; i++) {
      let prev: Pt | null = null;
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI;
        const q = cam.p([x + Math.cos(a) * 0.62, i * 0.16, z + Math.sin(a) * 0.62]);
        if (prev) edges.push([prev, q]);
        prev = q;
      }
    }
    pen.segs(edges, 0.25);
    const top = cam.p([x, h, z]);
    const k = cam.scale([x, h, z]);
    pen.path(`M${top[0] - k * 0.3} ${top[1]}a${k * 0.3} ${k * 0.1} 0 1 0 ${k * 0.6} 0a${k * 0.3} ${k * 0.1} 0 1 0 ${-k * 0.6} 0`, { stroke: INK, w: 0.3 });
  };
  const stations: Array<[number, number, number]> = [
    [Math.cos(Math.PI * 0.5) * R, Math.sin(Math.PI * 0.5) * R, 9],
    [Math.cos(Math.PI * 0.5 + 2.094) * R, Math.sin(Math.PI * 0.5 + 2.094) * R, 12],
    [Math.cos(Math.PI * 0.5 + 4.189) * R, Math.sin(Math.PI * 0.5 + 4.189) * R, 15],
  ];
  stations.sort((a, b) => a[1] - b[1]);
  for (const [x, z, n] of stations) stack(x, z, n + variant);
  void rng;
};

