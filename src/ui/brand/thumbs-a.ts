/**
 * News plates, part A: infrastructure and the built world.
 * Each plate draws into a 160 x 100 pen with a seeded rng.
 */
import { INK, PAPER, PIGMENT } from "./palette.ts";
import type { Pen } from "./pen.ts";
import type { Rng } from "../../render/core/rng.ts";
import { lerp, lerpPt, poly, rect, type Pt, type Ring } from "./geom.ts";
import {
  Cam,
  LINE,
  PH,
  PW,
  allPoints,
  box,
  castShadow,
  crowd,
  drawFace,
  drawShadow,
  drawSolid,
  faceAt,
  figure,
  gabled,
  plume,
  cloud,
  tree,
  visibleFaces,
  water,
  type Face,
  type V3,
} from "./kit.ts";

export type Plate = (pen: Pen, rng: Rng, variant: number) => void;

/* ---------------------------------------------------------- helpers */

/** Draw a quad on a face in face (u, v) coordinates. */
export function faceQuad(pen: Pen, cam: Cam, f: Face, u0: number, v0: number, u1: number, v1: number, fill = INK, stroke: string | null = null, w: number = LINE.hatch): Ring {
  const ring = [faceAt(f, u0, v0), faceAt(f, u1, v0), faceAt(f, u1, v1), faceAt(f, u0, v1)].map((p) => cam.p(p));
  pen.shape(ring, fill, stroke, w);
  return ring;
}

/** Lines across a face at constant v (floors, louvres) or constant u (mullions). */
export function faceLines(pen: Pen, cam: Cam, f: Face, axis: "u" | "v", values: readonly number[], w: number = LINE.hatch, from = 0, to = 1): void {
  const segs: Array<[Pt, Pt]> = [];
  for (const t of values) {
    const a = axis === "v" ? faceAt(f, from, t) : faceAt(f, t, from);
    const b = axis === "v" ? faceAt(f, to, t) : faceAt(f, t, to);
    segs.push([cam.p(a), cam.p(b)]);
  }
  pen.segs(segs, w);
}

export const steps = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => lerp(a, b, (i + 0.5) / n));

/** A lattice transmission pylon at a ground point, drawn at projected scale. */
export function pylon(pen: Pen, cam: Cam, at: V3, height: number, yaw = 0): Pt[] {
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const P = (x: number, y: number, z: number): Pt => cam.p([at[0] + x * cs + z * sn, at[1] + y, at[2] - x * sn + z * cs]);
  const base = height * 0.16;
  const waist = height * 0.045;
  const segs: Array<[Pt, Pt]> = [];
  const lvls = [0, 0.3, 0.55, 0.72, 0.86, 1];
  const half = (t: number) => lerp(base, waist, Math.min(1, t / 0.72));
  for (const side of [-1, 1]) {
    for (let i = 0; i < lvls.length - 1; i++) {
      const t0 = lvls[i]!;
      const t1 = lvls[i + 1]!;
      segs.push([P(side * half(t0), t0 * height, 0), P(side * half(t1), t1 * height, 0)]);
    }
  }
  for (let i = 0; i < lvls.length - 1; i++) {
    const t0 = lvls[i]!;
    const t1 = lvls[i + 1]!;
    segs.push([P(-half(t0), t0 * height, 0), P(half(t1), t1 * height, 0)]);
    segs.push([P(half(t0), t0 * height, 0), P(-half(t1), t1 * height, 0)]);
    segs.push([P(-half(t1), t1 * height, 0), P(half(t1), t1 * height, 0)]);
  }
  // Cross-arms at three levels.
  const arms: Array<[number, number]> = [
    [0.72, 0.34],
    [0.86, 0.26],
    [1, 0.18],
  ];
  const tips: Pt[] = [];
  for (const [t, span] of arms) {
    const y = t * height;
    const s = span * height;
    segs.push([P(-s, y, 0), P(s, y, 0)]);
    segs.push([P(-s, y, 0), P(-half(t), y - height * 0.05, 0)]);
    segs.push([P(s, y, 0), P(half(t), y - height * 0.05, 0)]);
    tips.push(P(-s, y - height * 0.035, 0), P(s, y - height * 0.035, 0));
  }
  segs.push([P(0, height, 0), P(0, height * 1.06, 0)]);
  const w = Math.max(0.3, Math.min(0.7, cam.scale(at) * 0.18));
  pen.segs(segs, w);
  return tips;
}

/** Catenary wires between two sets of tips. */
export function wires(pen: Pen, a: readonly Pt[], b: readonly Pt[], sag: number, w = 0.3): void {
  let d = "";
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const p = a[i]!;
    const q = b[i]!;
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2 + sag;
    d += `M${p[0].toFixed(2)} ${p[1].toFixed(2)}Q${mx.toFixed(2)} ${(my + sag).toFixed(2)} ${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
  }
  pen.path(d, { stroke: INK, w });
}

/** Chain-link fence along a ground line. */
export function fence(pen: Pen, cam: Cam, a: V3, b: V3, height: number, posts: number): void {
  const segs: Array<[Pt, Pt]> = [];
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const g: V3 = [lerp(a[0], b[0], t), 0, lerp(a[2], b[2], t)];
    const p0 = cam.p(g);
    const p1 = cam.p([g[0], height, g[2]]);
    segs.push([p0, p1]);
    top.push(p1);
    bottom.push(cam.p([g[0], 0.1, g[2]]));
  }
  pen.segs(segs, LINE.detail);
  pen.stroke(top, LINE.detail);
  pen.stroke(bottom, LINE.hatch);
  // Mesh: diagonal strokes between posts.
  const mesh: Ring = [...top, ...bottom.slice().reverse()];
  pen.hatch(mesh, 60, 1.5, 0.22);
  pen.hatch(mesh, 120, 1.5, 0.22);
  // Barbed top wire.
  const barb = top.map(([x, y]) => [x, y - 0.8] as Pt);
  pen.stroke(barb, 0.3);
}


/* ------------------------------------------------------------ plates */

export const dataCentre: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-74, 30, 92], target: [26, 0, -78], fov: 34 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  const ridge: Pt[] = [];
  for (let x = -4; x <= PW + 4; x += 10) ridge.push([x, hy - 1.5 - Math.abs(Math.sin(x * 0.045 + variant * 2)) * 3 - rng.range(0, 1)]);
  pen.path(`M${ridge.map((p) => p.join(" ")).join("L")}`, { stroke: INK, w: LINE.hatch });
  // The feed: a pylon line marching in from the far right to the campus substation.
  const line: V3[] = [
    [330, 0, -520],
    [250, 0, -380],
    [170, 0, -240],
  ];
  const tips = line.map((at) => pylon(pen, cam, at, 34, -0.9));
  for (let i = 0; i < tips.length - 1; i++) wires(pen, tips[i]!, tips[i + 1]!, 0.6, 0.26);
  const halls: Face[][] = [box([2, 0, -40], [30, 14, 130]), box([44, 0, -40], [30, 14, 130]), box([86, 0, -52], [30, 16, 106])];
  for (const h of halls) drawShadow(pen, castShadow(cam, allPoints(h)), 1.05);
  for (let i = halls.length - 1; i >= 0; i--) {
    const faces = halls[i]!;
    drawSolid(pen, cam, faces, { spacing: 1.15 });
    for (const f of visibleFaces(cam, faces)) {
      if (f.role === "wall" && f.n[0] < -0.5) {
        faceLines(pen, cam, f, "v", [0.62, 0.7, 0.78, 0.86], 0.26);
        faceLines(pen, cam, f, "u", steps(0, 1, 26), 0.22, 0, 0.55);
        if (i === 0)
          for (const u of steps(0.04, 0.96, 12)) {
            const p = cam.p(faceAt(f, u, 0.34));
            pen.circle(p[0], p[1], 0.62, { fill: PIGMENT.cyan });
          }
      }
      if (f.role === "wall" && f.n[2] > 0.5) {
        faceQuad(pen, cam, f, 0.38, 0, 0.62, 0.36, INK);
        faceLines(pen, cam, f, "v", [0.62, 0.7, 0.78, 0.86], 0.26);
      }
      if (f.role === "top") {
        for (const v of steps(0.03, 0.97, 11))
          for (const u of [0.28, 0.72]) {
            const unit = box(faceAt(f, u, v), [7, 2, 5.2]);
            drawSolid(pen, cam, unit, { w: LINE.hatch, spacing: 0.9 }, 0.45);
            const top = unit[4]!;
            for (const k of [0.3, 0.7]) {
              const c = cam.p(faceAt(top, k, 0.5));
              const r = cam.scale(faceAt(top, k, 0.5)) * 1.3;
              pen.path(`M${c[0] - r} ${c[1]}a${r} ${r * 0.5} 0 1 0 ${2 * r} 0a${r} ${r * 0.5} 0 1 0 ${-2 * r} 0`, { fill: INK });
            }
          }
      }
    }
  }
  // Access road with a guard hut, and the perimeter fence.
  const road: Ring = [cam.p([-24, 0, 130]), cam.p([-14, 0, 130]), cam.p([-14, 0, 44]), cam.p([-24, 0, 44])];
  pen.shape(road, PAPER, INK, LINE.detail);
  const hut = box([-30, 0, 50], [5, 3, 4]);
  drawSolid(pen, cam, hut, {}, 0.6);
  fence(pen, cam, [-80, 0, 46], [140, 0, 46], 3, 22);
  const gate = [cam.p([-24, 1.2, 46]), cam.p([-14, 1.2, 46])];
  pen.line(gate[0]![0], gate[0]![1], gate[1]![0], gate[1]![1], 0.8, PIGMENT.signal, "butt");
};

export const city: Plate = (pen, rng, variant) => {
  // Skyline across the river, engraved: towers, their reflections, the far bank.
  const cam = new Cam({ eye: [0, 4, 260], target: [0, 44, 0], fov: 38 });
  const bankY = cam.p([0, 0, 40])[1];
  const towers: Array<[number, number, number, number, number, number]> = [
    // x, z, w, d, h, yaw
    [-120, -60, 26, 22, 70, 0.3],
    [-78, -20, 22, 22, 118, 0.25],
    [-40, -90, 30, 26, 150, 0.2],
    [-6, -10, 24, 20, 96, 0.35],
    [30, -70, 26, 26, 176, 0.28],
    [66, -30, 22, 20, 124, 0.22],
    [100, -80, 28, 24, 88, 0.3],
    [132, -20, 20, 20, 58, 0.26],
    [-150, 10, 30, 20, 34, 0.2],
    [150, 20, 34, 20, 30, 0.3],
    [-100, 30, 40, 20, 24, 0.2],
    [40, 30, 50, 20, 28, 0.25],
  ];
  const order = towers.map((t) => ({ t, z: cam.depth([t[0], 0, t[1]]) })).sort((a, b) => b.z - a.z);
  for (const { t } of order) {
    const [x, z, w, d, h, yaw] = t;
    const faces = box([x, 0, z], [w, h, d], yaw + variant * 0.05);
    drawSolid(pen, cam, faces, { spacing: 1.1 });
    for (const f of visibleFaces(cam, faces)) {
      if (f.role !== "wall") continue;
      const lit = f.n[0] < 0;
      faceLines(pen, cam, f, "v", steps(0, 1, Math.round(h / 9)), lit ? 0.24 : 0.2);
      if (lit) faceLines(pen, cam, f, "u", steps(0, 1, Math.max(2, Math.round(w / 7))), 0.2);
    }
    if (h > 170) {
      const top = cam.p([x, h, z]);
      pen.line(top[0], top[1], top[0], top[1] - 9, 0.5);
      pen.circle(top[0], top[1] - 9.4, 0.7, { fill: PIGMENT.signal });
    }
  }
  // The river: paper over the bank, then reflections and ripples.
  pen.fill(rect(0, bankY, PW, PH - bankY), PAPER);
  pen.line(0, bankY, PW, bankY, LINE.edge);
  const refl: Array<[Pt, Pt]> = [];
  for (const { t } of order) {
    const [x, z, w, , h] = t;
    const c = cam.p([x, 0, z]);
    const s = cam.scale([x, 0, z]);
    const half = (w / 2) * s;
    for (let yy = bankY + 1.2; yy < Math.min(PH, bankY + h * s * 0.35); yy += 1.1) {
      if (rng.chance(0.55)) {
        const x0 = c[0] - half + rng.range(0, half);
        refl.push([[x0, yy], [x0 + rng.range(1.5, half * 1.4), yy]]);
      }
    }
  }
  pen.segs(refl, 0.3);
  water(pen, rng, bankY + 18, PH);
  // A barge.
  const bx = 28 + variant * 70;
  pen.shape([[bx, 84], [bx + 26, 84], [bx + 23, 88], [bx + 2, 88]], PAPER, INK, LINE.detail);
  pen.shape(rect(bx + 18, 80, 5, 4), PAPER, INK, LINE.detail);
  pen.hatch([[bx + 2, 86], [bx + 24.4, 86], [bx + 23, 88], [bx + 2, 88]], 0, 0.7, 0.3);
};

export const grid: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0, 1.8, 30], target: [14, 9, -60], fov: 48 });
  const hy = cam.horizon();
  // Ploughed field: furrows run out to the middle distance and stop.
  const furrows: Array<[Pt, Pt]> = [];
  for (let i = -30; i <= 30; i++) furrows.push([cam.p([i * 3.2, 0, 29]), cam.p([i * 3.2, 0, -90 - Math.abs(i) * 2])]);
  pen.segs(furrows, 0.28);
  pen.line(0, hy, PW, hy, LINE.detail);
  for (let i = 0; i < 14; i++) {
    const p: V3 = [-180 + i * 26 + rng.range(-6, 6), 0, -420];
    const [x, y] = cam.p(p);
    tree(pen, x, y, 12 * cam.scale(p) * rng.range(0.8, 1.3), rng, i % 4 === 0 ? "poplar" : "round");
  }
  const line: V3[] = [
    [-38, 0, -80],
    [0, 0, -150],
    [38, 0, -220],
    [76, 0, -290],
    [114, 0, -360],
    [152, 0, -430],
  ];
  const tips: Pt[][] = [];
  for (let i = line.length - 1; i >= 0; i--) tips[i] = pylon(pen, cam, line[i]!, 40, -0.5);
  for (let i = 0; i < line.length - 1; i++) wires(pen, tips[i]!, tips[i + 1]!, 1.6 - i * 0.25, 0.3);
  const a = tips[0]![4]!;
  const b = tips[1]![4]!;
  for (let k = 0; k < 5; k++) {
    const t = 0.16 + k * 0.06 + rng.range(-0.015, 0.015);
    const x = lerp(a[0], b[0], t);
    const y = lerp(a[1], b[1], t) + Math.sin(t * Math.PI) * 3 - 1.1;
    pen.path(`M${(x - 0.8).toFixed(2)} ${y.toFixed(2)}a0.8 0.9 0 1 1 1.6 0Z`, { fill: INK });
  }
  void variant;
};

export const storm: Plate = (pen, rng, variant) => {
  const hy = 80;
  const cx = 70 + variant * 14;
  // Anvil: a long flat-topped shelf streaming downwind.
  const anvil = `M${cx - 40} 22C${cx - 30} 12 ${cx - 6} 7 ${cx + 22} 6C${cx + 52} 5 ${cx + 84} 8 ${cx + 104} 12C${cx + 90} 16 ${cx + 60} 18 ${cx + 36} 22C${cx + 20} 25 ${cx - 16} 26 ${cx - 40} 22Z`;
  pen.path(anvil, { fill: PAPER, stroke: INK, w: LINE.edge });
  const anvilRing: Ring = [
    [cx - 40, 22],
    [cx - 20, 10],
    [cx + 22, 6],
    [cx + 70, 7],
    [cx + 104, 12],
    [cx + 60, 18],
    [cx + 36, 22],
    [cx - 10, 25.5],
  ];
  pen.hatch(anvilRing, 4, 1, LINE.hatch, INK, { spacingAt: (t) => lerp(2.8, 0.9, t), inset: 0.6 });
  // The tower: broad overlapping billows, lit from the left.
  const puffs: Array<[number, number, number]> = [
    [cx - 26, 52, 12],
    [cx - 8, 50, 14],
    [cx + 14, 51, 13],
    [cx + 32, 53, 11],
    [cx - 18, 38, 12],
    [cx + 4, 35, 14],
    [cx + 24, 39, 11],
    [cx - 8, 24, 11],
    [cx + 12, 22, 11],
  ];
  billows(pen, puffs, 0.55);
  // Dark base and rain curtain.
  const base: Ring = [
    [cx - 44, 58],
    [cx + 46, 58],
    [cx + 40, 64],
    [cx - 38, 64],
  ];
  pen.shape(base, PAPER, INK, LINE.detail);
  pen.hatch(base, 0, 0.7, LINE.hatch);
  pen.hatch(base, 64, 1, LINE.hatch);
  const rain: Ring = [
    [cx - 34, 64],
    [cx + 8, 64],
    [cx - 2, hy],
    [cx - 48, hy],
  ];
  pen.hatch(rain, 76, 1.2, 0.32, INK, { dash: [4, 1.8] });
  const bolt: Pt[] = [
    [cx + 24, 64],
    [cx + 20, 69.5],
    [cx + 24.5, 70.6],
    [cx + 17, 80],
  ];
  pen.stroke(bolt, 2.8, INK, false, { join: "miter", cap: "butt" });
  pen.stroke(bolt, 1.1, PAPER, false, { join: "miter", cap: "butt" });
  pen.line(0, hy, PW, hy, LINE.edge);
  const house = (x: number, s: number) => {
    const r: Ring = [
      [x, hy],
      [x, hy - 4 * s],
      [x + 3.5 * s, hy - 7 * s],
      [x + 7 * s, hy - 4 * s],
      [x + 7 * s, hy],
    ];
    pen.shape(r, PAPER, INK, LINE.detail);
    pen.hatch([[x + 3.5 * s, hy - 7 * s], [x + 7 * s, hy - 4 * s], [x + 7 * s, hy], [x + 3.5 * s, hy]], 90, 0.7, 0.3);
  };
  house(130, 1);
  house(140, 0.8);
  for (const [x, h] of [
    [120, 9],
    [150, 8],
    [16, 6],
    [24, 5],
  ] as const)
    tree(pen, x, hy, h, rng, "round");
  const grass: Array<[Pt, Pt]> = [];
  for (let i = 0; i < 46; i++) {
    const x = rng.range(0, PW);
    const y = rng.range(hy + 5, PH);
    grass.push([[x, y], [x + 1.8, y - rng.range(1.4, 3)]]);
  }
  pen.segs(grass, 0.34);
};

/** Cumulus billows: paper union, outer arcs only, lee-side hatching phase-locked across puffs. */
export function billows(pen: Pen, puffs: ReadonlyArray<readonly [number, number, number]>, dark = 0.4): void {
  for (const [cx, cy, r] of puffs) pen.circle(cx, cy, r, { fill: PAPER });
  let d = "";
  for (let i = 0; i < puffs.length; i++) {
    const [cx, cy, r] = puffs[i]!;
    let drawing = false;
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      const covered = puffs.some(([qx, qy, qr], j) => j !== i && (px - qx) ** 2 + (py - qy) ** 2 < (qr * 0.98) ** 2);
      if (!covered) {
        d += `${drawing ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
        drawing = true;
      } else drawing = false;
    }
  }
  pen.path(d, { stroke: INK, w: LINE.detail });
  for (const [cx, cy, r] of puffs) {
    const ring: Ring = Array.from({ length: 28 }, (_, k) => [cx + Math.cos((k / 28) * 6.283) * r, cy + Math.sin((k / 28) * 6.283) * r] as Pt);
    // Lee side (right and below) for each billow.
    const lee = ring.filter(([x, y]) => (x - cx) * 0.8 + (y - cy) * 0.6 > r * 0.05);
    if (lee.length > 2) pen.hatch(lee, 62, dark > 0.5 ? 0.95 : 1.3, LINE.hatch, INK, { phase: 0.5 });
  }
}

export const rail: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [0, 2.6, 8], target: [2, 1.6, -60], fov: 48 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  // Fields and poplars at the horizon.
  for (let i = 0; i < 9; i++) {
    const p: V3 = [-70 + i * 16 + rng.range(-4, 4), 0, -180 - rng.range(0, 40)];
    const [x, y] = cam.p(p);
    tree(pen, x, y, 22 * cam.scale(p), rng, i % 3 === 1 ? "round" : "poplar");
  }
  const g = 1.435;
  const toe = -16;
  const R = 80;
  const route = (branch: boolean) => (z: number) => (!branch || z > toe ? 0 : R - Math.sqrt(Math.max(0, R * R - (toe - z) ** 2)));
  const drawRoute = (fx: (z: number) => number, from: number) => {
    // Ballast shoulders.
    for (const side of [-1, 1]) {
      const pts: Pt[] = [];
      for (let z = from; z > -400; z -= 2) pts.push(cam.p([fx(z) + side * 1.9, 0.02, z]));
      pen.stroke(pts, 0.3);
    }
    const sl: Array<[Pt, Pt]> = [];
    let last = Infinity;
    for (let z = from; z > -400; z -= 0.65) {
      const a = cam.p([fx(z) - 1.3, 0.14, z]);
      const b = cam.p([fx(z) + 1.3, 0.14, z]);
      if (last - a[1] < 0.9) continue;
      last = a[1];
      sl.push([a, b]);
    }
    pen.segs(sl, 0.42);
    for (const side of [-1, 1]) {
      const pts: Pt[] = [];
      for (let z = from; z > -400; z -= 1.5) pts.push(cam.p([fx(z) + (side * g) / 2, 0.22, z]));
      pen.stroke(pts, 0.85);
    }
  };
  drawRoute(route(true), toe);
  drawRoute(route(false), 8);
  // Telegraph poles on the right, wires sagging between them.
  const tops: Pt[][] = [];
  for (let z = -24; z > -260; z -= 26) {
    const b = cam.p([5.2, 0, z]);
    const t = cam.p([5.2, 7, z]);
    const s = cam.scale([5.2, 0, z]);
    pen.line(b[0], b[1], t[0], t[1], Math.max(0.3, s * 0.22));
    pen.line(t[0] - s * 0.7, t[1] + s * 0.3, t[0] + s * 0.7, t[1] + s * 0.3, Math.max(0.25, s * 0.1));
    tops.push([[t[0] - s * 0.6, t[1] + s * 0.3], [t[0] + s * 0.6, t[1] + s * 0.3]]);
  }
  for (let i = 0; i < tops.length - 1; i++) wires(pen, tops[i]!, tops[i + 1]!, 0.6, 0.25);
  // Home signal at the toe.
  const sp: V3 = [-2.8, 0, toe + 3];
  const sb = cam.p(sp);
  const st = cam.p([-2.8, 4.4, toe + 3]);
  const ss = cam.scale(sp);
  pen.line(sb[0], sb[1], st[0], st[1], ss * 0.16);
  pen.shape(rect(st[0] - ss * 0.36, st[1] - ss * 1.2, ss * 0.72, ss * 1.25), INK, null);
  pen.circle(st[0], st[1] - ss * 0.86, ss * 0.2, { fill: PIGMENT.signal });
  pen.circle(st[0], st[1] - ss * 0.32, ss * 0.2, { fill: PAPER });
  // Lever frame box at the toe.
  const lb = box([2.6, 0, toe + 1], [0.9, 0.7, 0.6], 0.2);
  drawSolid(pen, cam, lb, {}, 0.6);
};

export const protest: Plate = (pen, rng, variant) => {
  // From a wall above the square: a sea of heads and placards before the ministry.
  const cam = new Cam({ eye: [0, 4.6, 16], target: [0, 3.2, -30], fov: 50 });
  const facade = box([0, 0, -42], [80, 20, 6], 0);
  const front = facade[0]!;
  drawFace(pen, cam, front, { tone: 0 });
  const portico = [faceAt(front, 0.04, 0.1), faceAt(front, 0.96, 0.1), faceAt(front, 0.96, 0.72), faceAt(front, 0.04, 0.72)].map((p) => cam.p(p));
  pen.hatch(portico, 90, 0.75, LINE.hatch);
  const cols = 10;
  for (let i = 0; i < cols; i++) {
    const u = 0.07 + (i / (cols - 1)) * 0.86;
    const r = faceQuad(pen, cam, front, u - 0.017, 0.1, u + 0.017, 0.72, PAPER, INK, LINE.detail);
    pen.hatch([lerpPt(r[0]!, r[1]!, 0.6), r[1]!, r[2]!, lerpPt(r[3]!, r[2]!, 0.6)], 90, 0.55, 0.28);
    faceQuad(pen, cam, front, u - 0.022, 0.1, u + 0.022, 0.13, PAPER, INK, 0.3);
    faceQuad(pen, cam, front, u - 0.022, 0.69, u + 0.022, 0.72, PAPER, INK, 0.3);
  }
  faceQuad(pen, cam, front, 0, 0.72, 1, 0.86, PAPER, INK, LINE.detail);
  faceLines(pen, cam, front, "v", [0.77, 0.81], 0.3);
  const pl = cam.p(faceAt(front, 0.12, 0.86));
  const pr = cam.p(faceAt(front, 0.88, 0.86));
  const apex: Pt = [(pl[0] + pr[0]) / 2, pl[1] - (pr[0] - pl[0]) * 0.15];
  pen.shape([pl, pr, apex], PAPER, INK, LINE.edge);
  pen.stroke([lerpPt(pl, apex, 0.1), lerpPt(pr, apex, 0.1), lerpPt(apex, [(pl[0] + pr[0]) / 2, pl[1]], 0.12)], 0.3, INK, true);
  // Flag on the roof.
  const fp = cam.p([0, 20 + 8.5, -42]);
  const fb = cam.p([0, 20 + 3.6, -42]);
  pen.line(fb[0], fb[1], fp[0], fp[1], 0.5);
  pen.path(`M${fp[0]} ${fp[1]}q3 -1 6 0.4q3 1.2 6 0v4q-3 1.2 -6 0q-3 -1.4 -6 -0.4Z`, { fill: PAPER, stroke: INK, w: 0.4 });
  for (let k = 0; k < 5; k++) {
    const a = cam.p([-44, 0.9 - k * 0.22, -38.6 + k * 1]);
    const b = cam.p([44, 0.9 - k * 0.22, -38.6 + k * 1]);
    pen.line(a[0], a[1], b[0], b[1], 0.35);
  }
  crowd(pen, cam, rng, { count: 190, x0: -24, x1: 24, z0: -34, z1: -1, poses: ["stand", "back", "sign", "arm", "sign", "back", "both", "phone", "back"], accent: PIGMENT.signal, accentEvery: 67 });
  // A banner carried at the front, held at chest height.
  const z = 2.5;
  const x0 = -4.2;
  const x1 = 4.2;
  crowd(pen, cam, rng, { count: 5, x0: x0 + 0.4, x1: x1 - 0.4, z0: z - 1.6, z1: z - 0.6, poses: ["walk", "stand"] });
  for (const x of [x0, x1]) {
    const p: V3 = [x, 0, z + 0.3];
    const f = cam.p(p);
    figure(pen, f[0], f[1], 1.74 * cam.scale(p), { pose: "walk", dir: x < 0 ? 1 : -1, halo: 0.8 });
  }
  const q = [cam.p([x0, 0.85, z]), cam.p([x1, 0.85, z]), cam.p([x1, 1.6, z]), cam.p([x0, 1.6, z])];
  pen.shape(q, PAPER, INK, LINE.edge);
  const bw = q[1]![0] - q[0]![0];
  const y0 = q[3]![1];
  const y1 = q[0]![1];
  pen.segs(
    [
      [[q[3]![0] + bw * 0.08, lerp(y0, y1, 0.36)], [q[3]![0] + bw * 0.92, lerp(y0, y1, 0.36)]],
      [[q[3]![0] + bw * 0.2, lerp(y0, y1, 0.68)], [q[3]![0] + bw * 0.8, lerp(y0, y1, 0.68)]],
    ],
    2.2,
  );
  void variant;
};

export const nuclear: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-240, 10, 420], target: [0, 70, 0], fov: 32 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  const towers: V3[] = [
    [120, 0, -80],
    [0, 0, 0],
  ];
  for (const t of towers) {
    const top = cam.p([t[0], 130, t[2]]);
    const s = cam.scale(t);
    plume(pen, top[0], top[1] + 3, { height: 70 * s, drift: 60 * s, width: 30 * s, rng, puffs: 9, dark: 0.25 });
  }
  for (const t of towers) hyperboloid(pen, cam, t, 130, 52, 32, 37);
  const blk = box([-150, 0, 100], [60, 30, 44], 0.25);
  drawShadow(pen, castShadow(cam, allPoints(blk)));
  drawSolid(pen, cam, blk);
  const dc = cam.p([-150, 30, 100]);
  const ds = cam.scale([-150, 30, 100]);
  const r = 17 * ds;
  const dome: Pt[] = Array.from({ length: 25 }, (_, i) => {
    const a = Math.PI + (i / 24) * Math.PI;
    return [dc[0] + Math.cos(a) * r, dc[1] + Math.sin(a) * r * 0.92] as Pt;
  });
  pen.shape(dome, PAPER, INK, LINE.edge);
  pen.hatch(dome.filter((p) => p[0] > dc[0] - r * 0.1).concat([[dc[0] - r * 0.1, dc[1]]]), 80, 0.9, LINE.hatch);
  fence(pen, cam, [-260, 0, 200], [80, 0, 230], 4, 16);
  for (let i = 0; i < 8; i++) {
    const p: V3 = [-300 + i * 30, 0, 260 + rng.range(-10, 10)];
    const [x, y] = cam.p(p);
    tree(pen, x, y, 12 * cam.scale(p), rng, "round");
  }
  void variant;
};

/** Hyperboloid cooling tower: silhouette from sampled rings, hatched on the lee side. */
export function hyperboloid(pen: Pen, cam: Cam, at: V3, height: number, rBase: number, rWaist: number, rTop: number): void {
  const rAt = (t: number) => {
    const waistT = 0.72;
    if (t < waistT) return lerp(rBase, rWaist, Math.sin((t / waistT) * (Math.PI / 2)) ** 0.9);
    const u = (t - waistT) / (1 - waistT);
    return lerp(rWaist, rTop, u * u);
  };
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = t * height;
    const r = rAt(t);
    let lo: Pt = [Infinity, 0];
    let hi: Pt = [-Infinity, 0];
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const p = cam.p([at[0] + Math.cos(a) * r, y, at[2] + Math.sin(a) * r]);
      if (p[0] < lo[0]) lo = p;
      if (p[0] > hi[0]) hi = p;
    }
    left.push(lo);
    right.push(hi);
  }
  // Rim ellipse at the top.
  const rim: Pt[] = [];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    rim.push(cam.p([at[0] + Math.cos(a) * rTop, height, at[2] + Math.sin(a) * rTop]));
  }
  const body: Ring = [...left, ...right.slice().reverse()];
  pen.shape(body, PAPER, INK, LINE.edge);
  // Lee side: from 55% across to the right edge.
  const lee: Ring = [...left.map((p, i) => [lerp(p[0], right[i]![0], 0.58), p[1]] as Pt), ...right.slice().reverse()];
  pen.hatch(lee, 90, 0.95, LINE.hatch);
  const deep: Ring = [...left.map((p, i) => [lerp(p[0], right[i]![0], 0.82), p[1]] as Pt), ...right.slice().reverse()];
  pen.hatch(deep, 90, 0.95, LINE.hatch, INK, { phase: 0 });
  pen.stroke(rim, LINE.detail, INK, true);
  // Inner rim shadow.
  const inner = rim.filter((_, i) => i < 20);
  pen.hatch([...inner], 0, 0.7, 0.25);
  // Base colonnade.
  const segs: Array<[Pt, Pt]> = [];
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    const p0: V3 = [at[0] + Math.cos(a) * rBase, 0, at[2] + Math.sin(a) * rBase];
    if (!cam.facing([Math.cos(a), 0, Math.sin(a)], p0)) continue;
    segs.push([cam.p(p0), cam.p([p0[0] * 0.96 + at[0] * 0.04, height * 0.05, p0[2] * 0.96 + at[2] * 0.04])]);
  }
  pen.segs(segs, 0.3);
}

export const morrowBillboard: Plate = (pen, rng, variant) => {
  const cam = new Cam({ eye: [-3, 1.5, 6], target: [3.4, 5.4, -18], fov: 50 });
  const hy = cam.horizon();
  pen.line(0, hy, PW, hy, LINE.hatch);
  const road: Ring = [cam.p([-3.6, 0, 10]), cam.p([3.6, 0, 10]), cam.p([3.6, 0, -600]), cam.p([-3.6, 0, -600])];
  pen.shape(road, PAPER, INK, LINE.detail);
  const dashes: Array<[Pt, Pt]> = [];
  for (let z = 8; z > -300; z -= 9) dashes.push([cam.p([0, 0, z]), cam.p([0, 0, z - 4])]);
  pen.segs(dashes, 0.7);
  for (let i = 0; i < 6; i++) {
    const p: V3 = [-12 - i * 1.5, 0, -40 - i * 30];
    const [x, y] = cam.p(p);
    tree(pen, x, y, 9 * cam.scale(p), rng, "poplar");
  }
  // The billboard: a board on two legs with a catwalk.
  const W = 13;
  const Hh = 5.6;
  const bx = 6;
  const bz = -16;
  const by = 4.4;
  for (const x of [bx - 4, bx + 4]) {
    const a = cam.p([x, 0, bz - 0.4]);
    const b = cam.p([x, by, bz - 0.4]);
    pen.line(a[0], a[1], b[0], b[1], 1.3);
    pen.line(a[0] + 0.6, a[1], b[0] + 0.6, b[1], 0.35);
  }
  const face: Face = { pts: [[bx - W / 2, by, bz], [bx + W / 2, by, bz], [bx + W / 2, by + Hh, bz], [bx - W / 2, by + Hh, bz]], n: [0, 0, 1], role: "wall" };
  const back: Face = { pts: [[bx - W / 2, by, bz - 0.5], [bx + W / 2, by, bz - 0.5], [bx + W / 2, by + Hh, bz - 0.5], [bx - W / 2, by + Hh, bz - 0.5]], n: [0, 0, 1], role: "wall" };
  const edge = [cam.p(face.pts[1]!), cam.p(back.pts[1]!), cam.p(back.pts[2]!), cam.p(face.pts[2]!)];
  pen.shape(edge, PAPER, INK, LINE.detail);
  pen.hatch(edge, 90, 0.6, 0.3);
  const ring = face.pts.map((p) => cam.p(p));
  pen.shape(ring, PAPER, INK, LINE.contour);
  const P = (u: number, v: number) => cam.p(faceAt(face, u, v));
  // Catwalk and lamps.
  const c0 = cam.p([bx - W / 2, by - 0.15, bz + 0.9]);
  const c1 = cam.p([bx + W / 2, by - 0.15, bz + 0.9]);
  pen.line(c0[0], c0[1], c1[0], c1[1], 0.6);
  const rails: Array<[Pt, Pt]> = [];
  for (let i = 0; i <= 12; i++) {
    const x = bx - W / 2 + (W * i) / 12;
    rails.push([cam.p([x, by - 0.15, bz + 0.9]), cam.p([x, by + 0.75, bz + 0.9])]);
  }
  rails.push([cam.p([bx - W / 2, by + 0.75, bz + 0.9]), cam.p([bx + W / 2, by + 0.75, bz + 0.9])]);
  pen.segs(rails, 0.28);
  for (const u of [0.18, 0.5, 0.82]) {
    const p = P(u, 1);
    const q = cam.p([bx - W / 2 + W * u, by + Hh + 0.9, bz + 0.8]);
    pen.line(p[0], p[1], q[0], q[1], 0.45);
    pen.shape(rect(q[0] - 0.9, q[1] - 0.4, 1.8, 0.8), INK, null);
  }
  // Morrow, in cobalt: the dawn with its pupil.
  const c = P(0.25, 0.36);
  const e = P(0.25 + 0.11, 0.36);
  const r = e[0] - c[0];
  pen.path(`M${c[0] - r} ${c[1]}A${r} ${r} 0 0 1 ${c[0] + r} ${c[1]}Z`, { fill: PIGMENT.cobalt });
  pen.circle(c[0], c[1] - r * 0.42, r * 0.22, { fill: PAPER });
  const lidR = r * 1.55;
  const a0 = (205 * Math.PI) / 180;
  const a1 = (335 * Math.PI) / 180;
  pen.path(`M${c[0] + Math.cos(a0) * lidR} ${c[1] + Math.sin(a0) * lidR}A${lidR} ${lidR} 0 0 1 ${c[0] + Math.cos(a1) * lidR} ${c[1] + Math.sin(a1) * lidR}`, { stroke: PIGMENT.cobalt, w: r * 0.22 });
  pen.line(c[0] - r * 1.75, c[1], c[0] + r * 1.75, c[1], r * 0.22, PIGMENT.cobalt);
  // Headline and small print.
  const line = (u0: number, u1: number, v: number, w: number, color: string) => {
    const a = P(u0, v);
    const b = P(u1, v);
    pen.line(a[0], a[1], b[0], b[1], w, color, "butt");
  };
  line(0.5, 0.93, 0.66, 2.1, PIGMENT.cobalt);
  line(0.5, 0.84, 0.5, 2.1, PIGMENT.cobalt);
  line(0.5, 0.78, 0.3, 0.6, INK);
  line(0.5, 0.7, 0.22, 0.6, INK);
  // Someone underneath, stopped, looking up at it.
  const wp: V3 = [1.6, 0, -8];
  const w = cam.p(wp);
  figure(pen, w[0], w[1], 1.72 * cam.scale(wp), { pose: "stand", dir: 1, coat: true });
  const wp2: V3 = [-1.2, 0, -26];
  const w2 = cam.p(wp2);
  figure(pen, w2[0], w2[1], 1.7 * cam.scale(wp2), { pose: "walk", dir: -1 });
  void variant;
};

/** Painter-friendly re-exports so other plate files can build on part A. */
export { gabled, poly };
