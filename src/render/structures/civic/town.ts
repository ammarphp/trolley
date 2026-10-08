/**
 * Town structures: church, school, library, clinic, hospital, courthouse,
 * a terrace of town houses.
 */
import * as THREE from "three";
import { cone, cylinder, extrude, jitter, lathe, type Tone } from "../../core/geometry.ts";
import type { Arch, M4, Opening, P2 } from "./arch.ts";
import { at, frame, openingPoly } from "./arch.ts";
import { RUIN, smooth } from "./condition.ts";
import { growthFrom, hedge } from "./flora.ts";
import { bay, dormer, massing, porch, type BlockResult } from "./massing.ts";

const W = (x: number, y: number, w: number, h: number, extra: Partial<Opening> = {}): Opening => ({ x, y, w, h, kind: "window", win: "sash", ...extra });
const D = (x: number, w: number, h: number, extra: Partial<Opening> = {}): Opening => ({ x, y: 0, w, h, kind: "door", door: "panel", ...extra });
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ helpers

/** Stepped buttress against a face frame at x. */
function buttress(a: Arch, face: M4, x: number, h: number, depth = 0.9): void {
  if (a.ruin >= RUIN.shell && a.fork(`but${x}`).next() < 0.5) return;
  a.box(face, x, 0, depth / 2, 0.75, h * 0.55, depth, "paper");
  a.cbox(face, x, h * 0.55 + 0.18, depth / 2 - 0.12, 0.75, 0.5, depth * 0.8, "pale", { rot: [0.7, 0, 0] });
  a.box(face, x, h * 0.55, depth * 0.3, 0.6, h * 0.35, depth * 0.6, "paper");
  a.cbox(face, x, h * 0.9 + 0.12, depth * 0.22, 0.6, 0.4, depth * 0.5, "pale", { rot: [0.8, 0, 0] });
}

/** Crenellated parapet around a square top (block frame at y). */
function battlements(a: Arch, f: M4, w: number, d: number, y: number): void {
  const sides: Array<[number, number, number, number]> = [
    [0, d / 2 - 0.25, w, 0],
    [0, -d / 2 + 0.25, w, 0],
    [w / 2 - 0.25, 0, d - 1, 1],
    [-w / 2 + 0.25, 0, d - 1, 1],
  ];
  for (const [x, z, len, rot] of sides) {
    const sf = frame(x, y, z, rot ? Math.PI / 2 : 0, f);
    a.box(sf, 0, 0, 0, len + (rot ? 0 : 0.1), 0.55, 0.5, "paper");
    a.box(sf, 0, 0.55, 0, len + (rot ? 0 : 0.2), 0.12, 0.62, "pale");
    const n = Math.max(2, Math.floor(len / 1.05));
    for (let i = 0; i < n; i++) {
      const mx = -len / 2 + (len / n) * (i + 0.5);
      if (i % 2 === 0) a.box(sf, mx, 0.67, 0, len / n, 0.75, 0.5, "paper");
    }
  }
}

/** Classical column: base, shaft with entasis, capital. */
function column(a: Arch, f: M4 | null, x: number, y: number, z: number, h: number, r: number): void {
  a.box(f, x, y, z, r * 2.6, r * 0.5, r * 2.6, "pale");
  a.add(
    lathe(
      [
        [r * 1.12, 0],
        [r * 1.05, r * 0.3],
        [r, r * 0.45],
        [r * 0.98, h * 0.35],
        [r * 0.86, h - r * 0.9],
        [r * 0.9, h - r * 0.75],
        [r * 1.25, h - r * 0.35],
        [r * 1.25, h - r * 0.3],
      ],
      14,
    ),
    f,
    { tone: "paper", position: [x, y + r * 0.5, z] },
  );
  a.box(f, x, y + r * 0.5 + h - r * 0.32, z, r * 2.7, r * 0.32, r * 2.7, "pale");
}

/** A pediment (triangular gable) in a face frame spanning w at height y. */
function pediment(a: Arch, face: M4, x: number, y: number, w: number, rise: number, depth: number, z = 0): void {
  a.add(
    extrude(
      [
        [x - w / 2, 0],
        [x + w / 2, 0],
        [x, rise],
      ],
      depth,
    ),
    face,
    { tone: "paper", position: [0, y, z + depth / 2] },
  );
  // Raking cornices.
  const len = Math.hypot(w / 2, rise);
  const ang = Math.atan2(rise, w / 2);
  for (const s of [-1, 1]) {
    a.cbox(face, x + (s * w) / 4, y + rise / 2 + 0.12, z + depth / 2 + 0.05, len + 0.3, 0.22, depth + 0.3, "pale", { rot: [0, 0, -s * ang] });
  }
  a.box(face, x, y - 0.1, z + depth / 2 + 0.05, w + 0.4, 0.22, depth + 0.3, "pale");
}

/** Headstones in a loose grid (block frame). */
function graves(a: Arch, x0: number, z0: number, cols: number, rows: number, sp: number): void {
  const g = a.fork(`graves${x0}${z0}`);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (g.next() < 0.18) continue;
      const x = x0 + c * sp + g.range(-0.3, 0.3);
      const z = z0 - r * sp * 0.8 + g.range(-0.2, 0.2);
      const tilt: [number, number, number] = [g.range(-0.12, 0.12), g.range(-0.2, 0.2), g.range(-0.1, 0.1)];
      const kind = g.int(0, 3);
      if (kind === 0) {
        // Cross.
        a.box(null, x, 0, z, 0.12, 1.1, 0.12, "paper", { rot: tilt });
        a.box(null, x, 0.7, z, 0.5, 0.12, 0.12, "paper", { rot: tilt });
      } else if (kind === 1) {
        a.box(null, x, 0, z, 0.9, 0.2, 1.8, "pale");
        a.box(null, x, 0.2, z - 0.8, 0.8, 0.7, 0.12, "paper", { rot: tilt });
      } else {
        const hh = g.range(0.7, 1.1);
        a.box(null, x, 0, z, 0.6, hh, 0.1, "paper", { rot: tilt });
        a.add(cylinder(0.3, 0.3, 0.1, 10, false), null, { tone: "paper", position: [x, hh, z], rotation: [Math.PI / 2, 0, 0] });
      }
    }
  }
}

/** A low boundary wall with coping from (x0,z) to (x1,z), leaving a gap. */
function lowWall(a: Arch, x0: number, x1: number, z: number, h: number, gap?: [number, number], railings = false): void {
  const spans: Array<[number, number]> = gap ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]];
  const g = a.fork(`wall${x0}${z}`);
  for (const [p, q] of spans) {
    const n = Math.max(1, Math.round((q - p) / 3));
    for (let i = 0; i < n; i++) {
      const sa = p + ((q - p) * i) / n;
      const sb = p + ((q - p) * (i + 1)) / n;
      const hh = a.ruin > 0.5 ? h * (1 - g.next() * a.ruin * 0.8) : h;
      a.box(null, (sa + sb) / 2, 0, z, sb - sa, hh, 0.45, "paper");
      if (hh >= h - 0.01) a.box(null, (sa + sb) / 2, hh, z, sb - sa, 0.1, 0.56, "pale");
      if (railings && a.ruin < 0.5) {
        for (let x = sa + 0.12; x < sb; x += 0.24) a.add(cylinder(0.018, 0.018, 1.0, 3, true), null, { tone: "deep", position: [x, hh + 0.6, z] });
        a.box(null, (sa + sb) / 2, hh + 1.05, z, sb - sa, 0.05, 0.05, "deep");
        a.box(null, (sa + sb) / 2, hh + 0.25, z, sb - sa, 0.04, 0.04, "deep");
      }
    }
  }
  if (gap) for (const x of gap) a.box(null, x, 0, z, 0.6, h + 0.5, 0.6, "paper");
}

/** A projecting blade sign on a face frame at x: readable along the street and the line. */
function blade(a: Arch, face: M4, x: number, y0: number, h: number, out: number, text: string): void {
  if (a.ruin > 0.85) return;
  const bf = frame(x, 0, out / 2 + 0.05, Math.PI / 2, face);
  a.box(bf, 0, y0, 0, out + 0.1, h + 0.14, 0.16, "paper");
  a.box(face, x, y0 + h * 0.3, 0.1, 0.12, 0.12, 0.2, "mid");
  a.box(face, x, y0 + h * 0.8, 0.1, 0.12, 0.12, 0.2, "mid");
  for (const s of [1, -1]) a.sign(frame(0, 0, 0, s > 0 ? 0 : Math.PI, bf), { kind: "blade", text, cross: true }, 0, y0 + h / 2, out, h, 0.085, false);
}

/** Freestanding sign on two posts, facing +z, centred at (x, z). */
function pylon(a: Arch, x: number, z: number, text: string, sub: string | undefined, w: number, h: number, y: number, rot = 0): void {
  const f = frame(x, 0, z, rot);
  for (const s of [-1, 1]) a.box(f, (s * w) / 2.6, 0, 0, 0.12, y + h / 2, 0.12, "mid");
  a.sign(f, { kind: "board", text, sub, cross: true }, 0, y, w, h, 0.07);
}

// ------------------------------------------------------------------- church

export function church(a: Arch, variant: number): void {
  const g = a.rng;
  if (variant === 2) {
    chapel(a);
    return;
  }
  // Nave with a west tower, a lower chancel and a south porch.
  const nw = g.range(16, 18.5);
  const nd = 8;
  const nh = 6.4;
  const t = 0.8;
  const lancet = (x: number, y = 1.9, w = 1.1, h = 3.2): Opening => ({ x, y, w, h, kind: "window", win: "lancet", head: "pointed", dress: "arch" });
  const porchX = -nw / 2 + 3.2;
  const nave = massing(a, {
    w: nw,
    d: nd,
    h: nh,
    t,
    roof: "gable",
    ridge: "x",
    pitch: 52,
    roofTone: "mid",
    roofOpts: { eave: 0.35, verge: 0.3 },
    front: [{ x: porchX, y: 0, w: 1.3, h: 2.7, kind: "door", door: "plank", head: "pointed", dress: "arch" }, lancet(0), lancet(nw / 2 - 3.2)],
    back: [lancet(-nw / 2 + 3.4), lancet(0), lancet(nw / 2 - 3.2)],
    right: [],
    omit: ["left"],
    bands: [{ y: 0, h: 0.6, p: 0.1, tone: "pale" }],
    courses: { every: 0.42, block: 0.95, indicate: 0.62 },
    label: "nave",
  });
  for (const x of [-nw / 2 + 1.6, -1.6, 1.8, nw / 2 - 1.3]) {
    if (Math.abs(x - porchX) < 1.8) continue;
    buttress(a, nave.faces.front, x, nh);
    buttress(a, nave.faces.back, -x, nh);
  }
  // Chancel.
  const cw = 7;
  const cd = 6.2;
  const ch = 5.2;
  const chancel = massing(a, {
    x: nw / 2 + cw / 2 - 0.02,
    w: cw,
    d: cd,
    h: ch,
    t: 0.75,
    roof: "gable",
    ridge: "x",
    pitch: 52,
    roofTone: "mid",
    roofOpts: { eave: 0.3, verge: 0.3 },
    front: [lancet(-1.4, 1.8, 0.9, 2.8), { x: 1.6, y: 0, w: 0.9, h: 2.2, kind: "door", door: "plank", head: "pointed" }],
    back: [lancet(0, 1.8, 0.9, 2.8)],
    right: [{ x: 0, y: 1.6, w: 2.6, h: 5.0, kind: "window", win: "lancet", head: "pointed", dress: "arch" }],
    omit: ["left"],
    bands: [{ y: 0, h: 0.6, p: 0.1, tone: "pale" }],
    label: "chancel",
  });
  // Cross on the east gable.
  if (a.ruin < RUIN.gutted) {
    const apex = ch + (cd / 2) * Math.tan(52 * DEG);
    a.box(null, nw / 2 + cw + 0.05, apex, 0, 0.14, 1.1, 0.14, "paper");
    a.box(null, nw / 2 + cw + 0.05, apex + 0.6, 0, 0.14, 0.14, 0.6, "paper");
  }
  void chancel;
  // South porch.
  const pf = frame(porchX, 0, nd / 2 + 1.6);
  massing(a, { w: 3.4, d: 3.2, h: 3.0, t: 0.45, roof: "gable", ridge: "z", pitch: 50, roofTone: "mid", front: [{ x: 0, y: 0, w: 1.5, h: 2.5, kind: "door", door: "open", head: "pointed", dress: "arch" }], omit: ["back"], label: "porch" }, pf);
  // West tower.
  const tw = 6.2;
  const th = g.range(16.5, 19);
  const tx = -nw / 2 - tw / 2 + 0.02;
  const belfry = (x = 0): Opening => ({ x, y: th - 4.6, w: 1.2, h: 2.6, kind: "window", win: "louvre", head: "pointed", dress: "arch" });
  const tower = massing(a, {
    x: tx,
    w: tw,
    d: tw,
    h: th,
    t: 0.9,
    roof: "none",
    front: [lancet(0, 5.5, 0.8, 2.2), belfry()],
    back: [belfry()],
    left: [{ x: 0, y: 0, w: 1.5, h: 3.2, kind: "door", door: "plank", head: "pointed", dress: "arch" }, lancet(0, 5.5, 1.4, 3.2), belfry()],
    right: [belfry()],
    bands: [
      { y: 0, h: 0.7, p: 0.12, tone: "pale" },
      { y: 4.8, h: 0.16, p: 0.1 },
      { y: th - 5.4, h: 0.16, p: 0.1 },
      { y: th - 0.35, h: 0.35, p: 0.18 },
    ],
    courses: { every: 0.45, block: 1.0, indicate: 0.5 },
    label: "tower",
  });
  // Diagonal buttresses at the west corners.
  for (const sz of [-1, 1]) {
    const bf = frame(tx - tw / 2, 0, (sz * tw) / 2, sz > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4);
    buttress(a, bf, 0, th * 0.55, 1.0);
  }
  a.flatRoof(tower.f, tw - 1.6, tw - 1.6, th, { label: "tower-flat", coping: false });
  const topY = th;
  if (a.ruin < RUIN.gutted) {
    if (variant === 0) {
      battlements(a, tower.f, tw + 0.2, tw + 0.2, topY);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          a.box(tower.f, (sx * tw) / 2, topY, (sz * tw) / 2, 0.7, 1.6, 0.7, "paper");
          a.add(cone(0.42, 2.2, 4), tower.f, { tone: "light", position: [(sx * tw) / 2, topY + 2.7, (sz * tw) / 2], rotation: [0, Math.PI / 4, 0] });
        }
      // Flagpole.
      a.add(cylinder(0.05, 0.07, 4, 5), tower.f, { tone: "mid", position: [tw / 2 - 1.2, topY + 2, -tw / 2 + 1.2] });
    } else {
      // Broach spire with lucarnes.
      const sh = th * 0.95;
      const sr = tw / 2 - 0.2;
      a.add(cylinder(0.08, sr, sh, 8), tower.f, { tone: "light", position: [0, topY + sh / 2, 0], rotation: [0, Math.PI / 8, 0] });
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          a.add(cone(1.25, 2.6, 3), tower.f, { tone: "light", position: [(sx * tw) / 2 - sx * 0.85, topY + 1.3, (sz * tw) / 2 - sz * 0.85], rotation: [0, Math.atan2(sx, sz) + Math.PI, 0] });
        }
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        const lf = frame(Math.sin(ang) * (sr * 0.62), topY + sh * 0.2, Math.cos(ang) * (sr * 0.62), ang, tower.f);
        a.box(lf, 0, 0, 0, 0.9, 1.4, 1.0, "light");
        a.box(lf, 0, 0.1, 0.45, 0.5, 0.9, 0.12, "solid");
        a.add(extrude([[-0.55, 0], [0.55, 0], [0, 0.7]], 1.1), lf, { tone: "light", position: [0, 1.4, 0] });
      }
      a.add(cylinder(0.03, 0.03, 1.4, 4), tower.f, { tone: "mid", position: [0, topY + sh + 0.6, 0] });
      a.box(tower.f, 0, topY + sh + 1.0, 0, 0.7, 0.08, 0.08, "mid");
    }
  } else if (a.ruin < RUIN.shell) {
    battlements(a, tower.f, tw + 0.2, tw + 0.2, topY);
  }
  // Clock on the tower's south face.
  if (a.ruin < 0.7) {
    const cf = frame(0, 0, 0, 0, tower.faces.front);
    const time = a.ruin > 0.2 ? "03:14" : a.sealed ? "12:00" : "10:10";
    a.cbox(cf, 0, th - 7.4, 0.06, 2.3, 2.3, 0.12, "paper");
    a.sign(cf, { kind: "clock", text: time }, 0, th - 7.4, 1.9, 1.9, 0.13, false, new THREE.CircleGeometry(0.95, 24));
  }
  // Churchyard: boundary wall with a lychgate, headstones, a yew.
  const wz = nd / 2 + 9;
  const wx0 = tx - tw / 2 - 3;
  const wx1 = nw / 2 + cw + 3;
  lowWall(a, wx0, wx1, wz, 1.1, [porchX - 1.4, porchX + 1.4]);
  if (a.ruin < RUIN.shell) {
    const lf = frame(porchX, 0, wz);
    for (const sx of [-1.2, 1.2]) for (const sz of [-0.9, 0.9]) a.box(lf, sx, 0, sz, 0.2, 2.2, 0.2, "light");
    a.roof(frame(0, 2.2, 0, 0, lf), 3.0, 2.2, { pitch: 50, eave: 0.3, verge: 0.3, t: 0.1, gutter: false, tone: "mid", label: "lych" });
  }
  graves(a, porchX + 3.2, wz - 1.8, 6, 3, 2.2);
  graves(a, tx - 1.5, wz - 1.8, 2, 3, 2.0);
  graves(a, nw / 2 + 1.5, -nd / 2 - 3, 5, 2, 2.2);
  const gr = growthFrom(a);
  if (!gr.uniform) {
    const yx = porchX - 4.2;
    const yz = nd / 2 + 5;
    a.rod(null, [yx, 0, yz], [yx, 1.4, yz], 0.3, "mid", 7);
    if (gr.dead < 0.7)
      for (let i = 0; i < 5; i++) {
        const gy = a.fork(`yew${i}`);
        a.add(jitter(new THREE.IcosahedronGeometry(1.5 - i * 0.12, 1), 0.2, i + 3), null, { tone: "dark", position: [yx + gy.range(-0.8, 0.8), 2.2 + i * 0.85, yz + gy.range(-0.8, 0.8)], scale: [1.1, 0.8, 1.1] });
      }
  }
}

function chapel(a: Arch): void {
  // Nonconformist chapel: gable front with a date tablet and a bellcote.
  const w = 11;
  const d = 16;
  const h = 7.6;
  const pitch = 36;
  const tall = (x: number, y = 2.4): Opening => ({ x, y, w: 1.4, h: 3.6, kind: "window", win: "fan", head: "round", dress: "arch" });
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.6,
    roof: "gable",
    ridge: "z",
    pitch,
    roofTone: "mid",
    roofOpts: { eave: 0.4, verge: 0.4 },
    front: [tall(-3.2), tall(3.2), { x: 0, y: 0.6, w: 1.6, h: 3.0, kind: "door", door: "panel", head: "round", dress: "arch", doorTone: "solid" }, { x: 0, y: h + 0.6, w: 1.2, h: 1.2, kind: "window", win: "fan", head: "round" }],
    left: at([-5, -1.7, 1.7, 5], { y: 2.4, w: 1.3, h: 3.6, kind: "window", win: "fan", head: "round", dress: "arch" }),
    right: at([-5, -1.7, 1.7, 5], { y: 2.4, w: 1.3, h: 3.6, kind: "window", win: "fan", head: "round", dress: "arch" }),
    back: [{ x: 3, y: 0, w: 1.0, h: 2.2, kind: "door", door: "plank" }],
    quoins: true,
    bands: [{ y: 0, h: 0.6, p: 0.08, tone: "pale" }, { y: h - 0.3, h: 0.3, p: 0.16 }],
    pipes: true,
    label: "chapel",
  });
  a.sign(b.faces.front, { kind: "carved", text: "BETHEL 1862" }, 0, h - 0.95, 3.6, 0.55, 0.03);
  a.cbox(b.faces.front, 0, h - 0.95, 0.03, 3.9, 0.8, 0.05, "pale");
  // Pedimented door case on columns.
  for (const s of [-1, 1]) column(a, b.faces.front, s * 1.25, 0.6, 0.35, 3.1, 0.16);
  a.box(b.faces.front, 0, 3.85, 0.35, 3.2, 0.3, 0.6, "paper");
  pediment(a, b.faces.front, 0, 4.15, 3.2, 0.8, 0.5, 0.1);
  // Steps to the raised door.
  // Bellcote on the apex.
  if (a.ruin < RUIN.gutted) {
    const apex = h + (w / 2) * Math.tan(pitch * DEG);
    const bf = frame(0, apex - 0.6, d / 2 - 0.4);
    for (const s of [-1, 1]) a.box(bf, s * 0.55, 0, 0, 0.3, 1.8, 0.5, "paper");
    a.add(lathe([[0.02, 0], [0.3, 0.05], [0.26, 0.4], [0.12, 0.6], [0, 0.62]], 10), bf, { tone: "mid", position: [0, 0.75, 0] });
    a.add(extrude([[-0.95, 0], [0.95, 0], [0, 0.7]], 0.7), bf, { tone: "mid", position: [0, 1.8, 0] });
  }
  // Iron railings in front.
  lowWall(a, -w / 2 - 1.5, w / 2 + 1.5, d / 2 + 3.5, 0.5, [-1.2, 1.2], true);
}

// ------------------------------------------------------------------- school

export function school(a: Arch, variant: number): void {
  const g = a.rng;
  if (variant === 1) {
    modernSchool(a);
    return;
  }
  if (variant === 2) {
    // Village school room with a bellcote, and the schoolhouse beside it.
    const sw = 8;
    const sd = 14;
    const sh = 4.6;
    const s = massing(a, {
      x: -4,
      w: sw,
      d: sd,
      h: sh,
      t: 0.55,
      roof: "gable",
      ridge: "z",
      pitch: 52,
      roofTone: "mid",
      front: [
        { x: -1.3, y: 1.0, w: 1.0, h: 3.4, kind: "window", win: "lancet", head: "pointed", dress: "arch" },
        { x: 0, y: 1.0, w: 1.0, h: 3.9, kind: "window", win: "lancet", head: "pointed", dress: "arch" },
        { x: 1.3, y: 1.0, w: 1.0, h: 3.4, kind: "window", win: "lancet", head: "pointed", dress: "arch" },
      ],
      left: at([-4.5, -1.5, 1.5, 4.5], { y: 1.1, w: 1.2, h: 2.4, kind: "window", win: "casement" }),
      right: [{ x: 5.5, y: 0, w: 1.1, h: 2.3, kind: "door", door: "plank", head: "pointed", dress: "arch" }, W(2.5, 1.1, 1.2, 2.4, { win: "casement" })],
      quoins: true,
      label: "schoolroom",
    });
    a.sign(s.faces.front, { kind: "carved", text: "VILLAGE SCHOOL 1874" }, 0, sh + 1.5, 2.8, 0.42, 0.03);
    if (a.ruin < RUIN.gutted) {
      const apex = sh + (sw / 2) * Math.tan(52 * DEG);
      const bf = frame(-4, apex - 0.5, sd / 2 - 0.35);
      for (const x of [-0.45, 0.45]) a.box(bf, x, 0, 0, 0.25, 1.5, 0.45, "paper");
      a.add(lathe([[0.02, 0], [0.26, 0.05], [0.22, 0.35], [0.1, 0.52], [0, 0.54]], 10), bf, { tone: "mid", position: [0, 0.6, 0] });
      a.add(extrude([[-0.8, 0], [0.8, 0], [0, 0.6]], 0.6), bf, { tone: "mid", position: [0, 1.5, 0] });
    }
    const house = massing(a, {
      x: 5.2,
      z: -1.5,
      w: 8,
      d: 7,
      h: 5.4,
      t: 0.5,
      roof: "gable",
      ridge: "x",
      pitch: 42,
      roofTone: "mid",
      front: [W(-1.8, 0.9, 1.1, 1.5), D(1.4, 1.0, 2.2, { doorTone: "dark" }), W(-1.8, 3.4, 1.1, 1.3), W(1.4, 3.4, 1.1, 1.3)],
      back: [W(-1.5, 0.9, 1.0, 1.4), W(1.5, 3.4, 1.0, 1.2)],
      right: [W(0, 1.0, 1.0, 1.3)],
      omit: ["left"],
      quoins: true,
      pipes: true,
      label: "schoolhouse",
    });
    a.chimney(house.f, 3.5, 0, 4.4, house.top + 0.9, 0.8, 0.6, 2);
    porch(a, house.faces.front, 1.4, { w: 1.9, d: 1.3, h: 2.4, label: "shporch" });
    lowWall(a, -10, 11, 10, 0.9, [-5, -3]);
    return;
  }
  // Victorian board school: a central range between gabled cross-wings, very
  // tall windows, a bell turret on the ridge, separate entrances.
  const L = g.range(26, 29);
  const wingW = 7.6;
  const range = massing(a, {
    w: L - 0.1,
    d: 8.4,
    h: 5.4,
    t: 0.5,
    roof: "gable",
    ridge: "x",
    pitch: 48,
    roofTone: "mid",
    front: [W(-1.8, 1.3, 1.4, 3.3, { win: "casement" }), W(1.8, 1.3, 1.4, 3.3, { win: "casement" }), D(-(L / 2 - wingW - 1.4), 1.2, 2.5, { doorTone: "dark" }), D(L / 2 - wingW - 1.4, 1.2, 2.5, { doorTone: "dark" })],
    back: [W(-2.6, 1.3, 1.4, 3.3, { win: "casement" }), W(0, 1.3, 1.4, 3.3, { win: "casement" }), W(2.6, 1.3, 1.4, 3.3, { win: "casement" })],
    omit: ["left", "right"],
    bands: [{ y: 0, h: 0.5, p: 0.07, tone: "light" }],
    label: "range",
  });
  const labels = ["BOYS", "GIRLS"];
  for (const s of [-1, 1]) {
    const wx = s * (L / 2 - wingW / 2);
    const wing = massing(a, {
      x: wx,
      z: 1.8,
      w: wingW,
      d: 12,
      h: 5.8,
      t: 0.55,
      roof: "gable",
      ridge: "z",
      pitch: 50,
      roofTone: "mid",
      front: [
        W(-2.0, 1.3, 1.25, 3.6, { win: "casement" }),
        W(0, 1.3, 1.25, 4.0, { win: "casement" }),
        W(2.0, 1.3, 1.25, 3.6, { win: "casement" }),
        { x: 0, y: 6.9, w: 1.3, h: 1.3, kind: "window", win: "fan", head: "round", dress: "arch" },
      ],
      back: [W(-1.6, 1.3, 1.2, 3.2, { win: "casement" }), W(1.6, 1.3, 1.2, 3.2, { win: "casement" })],
      left: s > 0 ? [] : at([-3.5, 0, 3.5], { y: 1.3, w: 1.2, h: 3.2, kind: "window", win: "casement" }),
      right: s < 0 ? [] : at([-3.5, 0, 3.5], { y: 1.3, w: 1.2, h: 3.2, kind: "window", win: "casement" }),
      bands: [{ y: 0, h: 0.5, p: 0.07, tone: "light" }],
      pipes: true,
      label: `wing${s}`,
    });
    a.chimney(wing.f, 0, -4.2, 5, wing.top + 0.6, 0.9, 0.7, 2);
    const dx = -s * (L / 2 - wingW - 1.4);
    a.sign(range.faces.front, { kind: "carved", text: labels[s < 0 ? 0 : 1]! }, -dx, 3.05, 1.5, 0.34, 0.035);
    a.box(range.faces.front, -dx, 2.85, 0.02, 1.8, 0.45, 0.04, "pale");
  }
  a.sign(frame(0, 0, 0, 0, range.faces.front), { kind: "carved", text: "BOARD SCHOOL 1891" }, 0, 5.05, 3.4, 0.36, 0.02);
  // Bell turret (flèche) on the ridge.
  if (a.ruin < RUIN.gutted) {
    const ry = 5.4 + 4.2 * Math.tan(48 * DEG);
    const bf = frame(0, ry - 0.5, 0);
    a.box(bf, 0, 0, 0, 1.5, 2.3, 1.5, "paper");
    for (let i = 0; i < 4; i++) {
      const ff = frame(0, 0, 0, (i * Math.PI) / 2, bf);
      a.box(ff, 0, 0.9, 0.73, 0.7, 1.0, 0.04, "solid");
      for (let k = 0; k < 4; k++) a.cbox(ff, 0, 1.0 + k * 0.23, 0.76, 0.66, 0.03, 0.12, "light", { rot: [0.6, 0, 0] });
    }
    a.roof(frame(0, 2.3, 0, 0, bf), 1.5, 1.5, { hip: true, pitch: 62, eave: 0.2, verge: 0.2, t: 0.08, gutter: false, tone: "mid", label: "flèche" });
    a.add(cylinder(0.03, 0.03, 1.4, 4), bf, { tone: "mid", position: [0, 4.6, 0] });
  }
  // Playground wall with railings.
  lowWall(a, -L / 2 - 1, L / 2 + 1, 12.5, 0.8, [-2, 2], true);
}

function modernSchool(a: Arch): void {
  // 1950s single-storey school: ribbon glazing to the light, a thin roof
  // slab, a taller hall with a monopitch roof, a canopied entrance.
  const L = 34;
  const d = 10;
  const h = 3.9;
  const b = massing(a, {
    w: L,
    d,
    h,
    t: 0.3,
    roof: "flat",
    parapet: 0.25,
    front: [{ x: -2, y: 0.8, w: L - 6.5, h: 2.5, kind: "window", win: "ribbon", pitch: 1.45 }, { x: L / 2 - 1.8, y: 0, w: 2.2, h: 2.5, kind: "door", door: "glazed" }],
    back: [{ x: 0, y: 2.3, w: L - 3, h: 1.0, kind: "window", win: "ribbon", pitch: 1.5, sill: false }],
    right: [{ x: 0, y: 0.8, w: 5, h: 2.5, kind: "window", win: "ribbon", pitch: 1.25 }],
    label: "classrooms",
  });
  // Roof slab oversailing all round: the building's strong shadow line.
  if (a.ruin < RUIN.gutted) a.box(b.f, 0, h + 0.2, 0.3, L + 1.6, 0.28, d + 2.2, "paper");
  // Vertical fins between classrooms.
  for (let i = 0; i <= 5; i++) {
    const x = -L / 2 + 0.5 + i * ((L - 7) / 5);
    a.box(b.faces.front, x, 0, 0.35, 0.18, h + 0.2, 0.7, "paper");
  }
  // Hall with a rising monopitch roof.
  const hall = massing(a, {
    x: -L / 2 - 7.05,
    z: -1,
    w: 12,
    d: 14,
    h: 5.6,
    t: 0.35,
    roof: "lean",
    pitch: 12,
    roofTone: "light",
    rot: Math.PI / 2,
    back: [{ x: 0, y: 4.5, w: 10, h: 2.0, kind: "window", win: "ribbon", pitch: 1.6, sill: false }],
    left: [{ x: -3, y: 0, w: 2.0, h: 2.4, kind: "door", door: "glazed" }, { x: 2.5, y: 0.8, w: 7, h: 3.6, kind: "window", win: "ribbon", pitch: 1.2 }],
    right: [{ x: 0, y: 0.8, w: 10, h: 3.6, kind: "window", win: "ribbon", pitch: 1.2 }],
    omit: ["front"],
    label: "hall",
  });
  a.sign(hall.faces.left, { kind: "board", text: "MERIDIAN PRIMARY SCHOOL" }, 1.0, 5.05, 7.5, 0.75, 0.05);
  // Entrance canopy on slender posts.
  const cf = frame(L / 2 - 1.8, 0, d / 2);
  if (a.ruin < RUIN.shell) {
    a.box(cf, 0, 2.9, 1.6, 4.2, 0.22, 3.4, "paper");
    for (const s of [-1, 1]) a.add(cylinder(0.07, 0.07, 2.9, 8), cf, { tone: "mid", position: [s * 1.8, 1.45, 3.0] });
  }
  // Bicycle shelter and a painted hopscotch-free playground edge.
  const bs = frame(-4, 0, d / 2 + 7);
  if (a.ruin < RUIN.gutted && !a.sealed) {
    for (const x of [-3, 0, 3]) a.box(bs, x, 0, -0.8, 0.1, 2.2, 0.1, "mid");
    a.box(bs, 0, 2.2, 0, 7, 0.1, 2.2, "light", { rot: [-0.12, 0, 0] });
    for (let i = 0; i < 6; i++) a.add(new THREE.TorusGeometry(0.3, 0.025, 4, 12), bs, { tone: "mid", position: [-2.5 + i * 1.0, 0.3, 0.2], rotation: [0, Math.PI / 2, 0] });
  }
}

// ------------------------------------------------------------------ library

export function library(a: Arch, variant: number): void {
  if (variant === 1) {
    // 1930s municipal library: flat roof, tall slot windows, a glazed stair
    // tower and raised letters.
    const w = 26;
    const d = 13;
    const h = 7.2;
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.45,
      roof: "flat",
      parapet: 0.9,
      front: at([-11, -8.8, -6.6, -4.4, 4.4, 6.6, 8.8, 11], { y: 1.2, w: 1.0, h: 4.8, kind: "window", win: "industrial", grid: [1, 6], dress: "none" }),
      back: at([-8, -4, 0, 4, 8], { y: 1.5, w: 2.4, h: 3.8, kind: "window", win: "industrial", dress: "none" }),
      left: at([-3, 0, 3], { y: 1.2, w: 1.0, h: 4.8, kind: "window", win: "industrial", grid: [1, 6], dress: "none" }),
      right: at([-3, 0, 3], { y: 1.2, w: 1.0, h: 4.8, kind: "window", win: "industrial", grid: [1, 6], dress: "none" }),
      bands: [{ y: 0, h: 0.9, p: 0.1, tone: "light" }, { y: h + 0.55, h: 0.35, p: 0.12 }],
      label: "lib30",
    });
    const e = massing(a, {
      z: d / 2 + 1.2,
      w: 7,
      d: 2.4,
      h: 9.6,
      t: 0.4,
      roof: "flat",
      parapet: 0.4,
      front: [{ x: 0, y: 3.4, w: 2.2, h: 5.2, kind: "window", win: "industrial", grid: [3, 8], dress: "none" }, { x: 0, y: 0, w: 2.6, h: 2.7, kind: "door", door: "glazed" }],
      omit: ["back"],
      label: "entrance",
    });
    if (a.ruin < RUIN.shell) a.box(e.faces.front, 0, 2.9, 0.8, 4.8, 0.22, 1.6, "paper");
    a.sign(e.faces.front, { kind: "painted", text: "LIBRARY" }, 0, 9.0, 5.8, 0.9, 0.02);
    void b;
    return;
  }
  // Carnegie library: podium, tetrastyle portico, round-headed windows,
  // inscription frieze, dome on a drum.
  const w = 24;
  const d = 15;
  const h = 8.6;
  const pod = 1.3;
  const tall = (x: number): Opening => ({ x, y: pod + 1.3, w: 1.8, h: 4.2, kind: "window", win: "fan", head: "round", dress: "key" });
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.6,
    roof: "flat",
    parapet: 1.1,
    front: [tall(-8.8), tall(-5.8), tall(5.8), tall(8.8), { x: 0, y: pod, w: 2.0, h: 3.6, kind: "door", door: "panel", head: "round", dress: "key", doorTone: "deep" }],
    back: at([-8, -4, 0, 4, 8], { y: pod + 1.3, w: 1.6, h: 3.8, kind: "window", win: "fan", head: "round", dress: "key" }),
    left: at([-4, 0, 4], { y: pod + 1.3, w: 1.8, h: 4.2, kind: "window", win: "fan", head: "round", dress: "key" }),
    right: at([-4, 0, 4], { y: pod + 1.3, w: 1.8, h: 4.2, kind: "window", win: "fan", head: "round", dress: "key" }),
    bands: [
      { y: 0, h: pod, p: 0.14, tone: "pale" },
      { y: h - 1.4, h: 1.0, p: 0.06 },
      { y: h - 0.4, h: 0.4, p: 0.3 },
    ],
    quoins: true,
    label: "carnegie",
  });
  a.sign(b.faces.front, { kind: "carved", text: "PUBLIC LIBRARY" }, 0, h - 0.9, 8.5, 0.62, 0.07);
  // Portico with four columns and a pediment, on steps.
  const pf = b.faces.front;
  const pw = 9.4;
  const pdp = 3.6;
  a.box(pf, 0, 0, pdp / 2, pw + 0.4, pod, pdp, "pale");
  for (let i = 0; i < 6; i++) a.box(pf, 0, 0, pdp + 0.3 + (5 - i) * 0.32, pw - 1 + (6 - i) * 0.2, (pod * (i + 1)) / 6, 0.34, "pale");
  if (a.ruin < RUIN.shell) {
    for (const x of [-3.9, -1.3, 1.3, 3.9]) column(a, pf, x, pod, pdp - 0.6, h - pod - 1.35, 0.38);
    a.box(pf, 0, h - 1.4, pdp / 2 - 0.2, pw + 0.4, 1.05, pdp + 0.2, "paper");
    pediment(a, pf, 0, h - 0.35, pw + 0.6, 2.3, pdp + 0.3, -0.3);
  }
  // Dome on a drum.
  if (a.ruin < RUIN.gutted) {
    const df = frame(0, h + 1.1, -1);
    a.add(cylinder(3.3, 3.3, 2.6, 24), df, { tone: "paper", position: [0, 1.3, 0] });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const wf = frame(Math.sin(ang) * 3.28, 0, Math.cos(ang) * 3.28, ang, df);
      a.box(wf, 0, 0.6, 0, 0.7, 1.4, 0.1, a.c.lit > 0.3 ? "pale" : "dark", a.c.lit > 0.3 ? { accent: "amber", amt: 0.8 } : {});
    }
    a.add(cylinder(3.55, 3.55, 0.3, 24), df, { tone: "pale", position: [0, 2.75, 0] });
    a.add(lathe(Array.from({ length: 9 }, (_, i) => [3.4 * Math.cos((i / 8) * (Math.PI / 2)), 3.1 * Math.sin((i / 8) * (Math.PI / 2))] as [number, number]), 24), df, { tone: "light", position: [0, 2.9, 0] });
    a.add(cylinder(0.55, 0.6, 1.1, 10), df, { tone: "paper", position: [0, 6.4, 0] });
    a.add(cone(0.7, 0.8, 10), df, { tone: "light", position: [0, 7.35, 0] });
  }
}

// ------------------------------------------------------------------- clinic

export function clinic(a: Arch, variant: number): void {
  if (variant === 1) {
    clinicVilla(a);
    return;
  }
  if (variant === 2) {
    clinicPost(a);
    return;
  }
  // The Meridian Clinic: a white modernist building with a two-storey block,
  // ribbon windows under a sun hood, a canopy entrance and a sign pylon.
  const L = 26;
  const d = 11;
  const h = 4.1;
  const b = massing(a, {
    x: 3,
    w: L - 10,
    d,
    h,
    t: 0.35,
    roof: "flat",
    parapet: 0.35,
    front: [{ x: -1.6, y: 0.95, w: 8.0, h: 1.9, kind: "window", win: "ribbon", pitch: 1.3 }, { x: 5.2, y: 0, w: 2.6, h: 2.7, kind: "door", door: "glazed" }],
    back: [{ x: 0, y: 1.0, w: 12, h: 1.7, kind: "window", win: "ribbon", pitch: 1.5 }],
    right: [{ x: 1.6, y: 0.95, w: 5.5, h: 1.9, kind: "window", win: "ribbon", pitch: 1.4 }, { x: -3.6, y: 0, w: 2.2, h: 2.6, kind: "door", door: "shutter" }],
    omit: ["left"],
    label: "clinic-low",
  });
  const up = massing(a, {
    x: -8,
    w: 10,
    d: d + 0.6,
    h: 7.8,
    t: 0.35,
    roof: "flat",
    parapet: 0.4,
    front: [{ x: 0, y: 0.95, w: 8.2, h: 1.9, kind: "window", win: "ribbon", pitch: 1.35 }, { x: 0, y: 4.75, w: 8.2, h: 1.8, kind: "window", win: "ribbon", pitch: 1.35 }],
    back: [{ x: 0, y: 1.0, w: 8, h: 1.7, kind: "window", win: "ribbon", pitch: 1.6 }, { x: 0, y: 4.8, w: 8, h: 1.7, kind: "window", win: "ribbon", pitch: 1.6 }],
    left: [{ x: 2.5, y: 0.95, w: 3.2, h: 1.9, kind: "window", win: "ribbon", pitch: 1.6 }, { x: -3.2, y: 1.2, w: 0.9, h: 5.4, kind: "window", win: "industrial", grid: [1, 7] }],
    label: "clinic-high",
  });
  // Sun hoods over the ribbon windows: long thin shelves casting a line of shade.
  if (a.ruin < RUIN.shell) {
    a.box(b.faces.front, -1.6, 3.0, 0.4, 8.6, 0.1, 0.8, "paper");
    a.box(up.faces.front, 0, 2.95, 0.4, 8.8, 0.1, 0.8, "paper");
    a.box(up.faces.front, 0, 6.7, 0.4, 8.8, 0.1, 0.8, "paper");
  }
  blade(a, up.faces.front, 4.3, 3.2, 4.6, 1.15, "CLINIC");
  // Entrance canopy with the name on its fascia.
  const cf = frame(3 + 5.2, 0, d / 2);
  if (a.ruin < RUIN.shell) {
    a.box(cf, 0, 3.05, 1.7, 5.6, 0.34, 3.6, "paper");
    for (const s of [-1, 1]) a.add(cylinder(0.09, 0.09, 3.05, 8), cf, { tone: "mid", position: [s * 2.4, 1.52, 3.2] });
  }
  a.sign(cf, { kind: "board", text: "MERIDIAN CLINIC", cross: true }, 0, 3.22, 4.6, 0.46, 3.52);
  // Ramp with handrails to the door.
  if (!a.sealed) {
    a.cbox(cf, -4.3, 0.12, 1.2, 4.4, 0.08, 1.4, "pale", { rot: [0, 0, 0.05] });
    for (const z of [0.55, 1.85]) {
      a.beam(cf, [-6.4, 0.9, z], [-2.2, 1.1, z], 0.05, 0.05, "mid");
      for (const x of [-6.3, -4.3, -2.3]) a.box(cf, x, 0, z, 0.05, 1.0 + (x + 6.3) * 0.05, 0.05, "mid");
    }
  }
  // Sign pylon at the road.
  pylon(a, 12, d / 2 + 6.5, "MERIDIAN CLINIC", "GENERAL PRACTICE · DAY UNIT", 3.2, 1.2, 2.3, -0.35);
  // Ambulance bay canopy on the right end.
  const af = frame(3 + (L - 10) / 2, 0, 0, Math.PI / 2);
  if (a.ruin < RUIN.shell) {
    a.box(af, -3.6, 3.6, 3.2, 5.6, 0.25, 6.4, "paper");
    for (const x of [-6, -1.2]) a.add(cylinder(0.1, 0.1, 3.6, 8), af, { tone: "mid", position: [x, 1.8, 6.0] });
  }
  // Roof plant.
  if (a.ruin < RUIN.gutted) {
    a.box(up.f, 1.5, 7.8, -1.5, 3, 1.4, 2.2, "light");
    for (let i = 0; i < 5; i++) a.quad(frame(1.5, 0, -0.4, 0, up.f), -1.2 + i * 0.6, 8.5, 0.001, 0.035, 1.2, "solid");
    a.add(cylinder(0.25, 0.25, 1.8, 10), up.f, { tone: "light", position: [-3, 8.7, 2] });
  }
  if (a.ruin >= RUIN.gutted) a.rubble(null, 12, d / 2 + 4, 3, 2, 0.4, "pylon", 0.6);
}

function clinicVilla(a: Arch): void {
  // A Victorian villa turned surgery, with a flat-roofed modern extension.
  const v = massing(a, {
    x: -6,
    w: 10.5,
    d: 9.5,
    h: 6.4,
    t: 0.45,
    roof: "hip",
    pitch: 33,
    roofTone: "mid",
    roofOpts: { eave: 0.55 },
    front: [D(2.3, 1.1, 2.5, { doorTone: "solid", dress: "hood" }), W(-2.4, 3.8, 1.2, 1.7), W(2.3, 3.8, 1.2, 1.7)],
    back: [W(-2.4, 0.9, 1.1, 1.7), W(2.4, 0.9, 1.1, 1.7), W(-2.4, 3.8, 1.1, 1.6), W(2.4, 3.8, 1.1, 1.6)],
    left: [W(-2, 0.9, 1.1, 1.7), W(2, 0.9, 1.1, 1.7), W(0, 3.8, 1.1, 1.6)],
    bands: [{ y: 0, h: 0.5, p: 0.07, tone: "light" }, { y: 3.25, h: 0.14, p: 0.06 }],
    quoins: true,
    pipes: true,
    label: "villa",
  });
  bay(a, v.faces.front, -2.4, { w: 2.6, p: 0.75, storeys: 1, label: "vbay" });
  for (const x of [-3, 3]) a.chimney(v.f, x, -0.5, 5.5, v.top + 0.8, 0.8, 0.6, 2);
  const e = massing(a, {
    x: 5.3,
    z: 0.5,
    w: 12,
    d: 8.5,
    h: 3.8,
    t: 0.3,
    roof: "flat",
    parapet: 0.3,
    front: [{ x: -2.2, y: 0.9, w: 6.2, h: 1.8, kind: "window", win: "ribbon", pitch: 1.25 }, { x: 3.6, y: 0, w: 2.4, h: 2.6, kind: "door", door: "glazed" }],
    right: [{ x: 0, y: 0.9, w: 5, h: 1.8, kind: "window", win: "ribbon", pitch: 1.25 }],
    back: [{ x: 0, y: 0.9, w: 8, h: 1.6, kind: "window", win: "ribbon", pitch: 1.6 }],
    omit: ["left"],
    label: "extension",
  });
  a.sign(e.faces.front, { kind: "board", text: "MERIDIAN CLINIC", cross: true }, -0.6, 3.35, 5.8, 0.55, 0.06);
  blade(a, v.faces.front, 4.9, 2.2, 3.6, 1.0, "CLINIC");
  if (a.ruin < RUIN.shell) a.box(e.faces.front, 3.6, 2.8, 0.9, 3.4, 0.2, 1.8, "paper");
  pylon(a, 10, 9, "MERIDIAN CLINIC", "SURGERY HOURS 8–6", 2.6, 1.0, 1.9, -0.3);
  const gr = growthFrom(a);
  hedge(a, null, -12, 8, 5, 8, 1.1, a.fork("hedge"), gr);
}

export function clinicPost(a: Arch): void {
  // A prefab rural health post: panelled walls, a verandah, a water tank.
  const w = 18;
  const d = 7.5;
  const h = 3.2;
  const ops: Opening[] = [W(-6.5, 0.9, 1.4, 1.2, { win: "casement", dress: "none" }), W(-3.2, 0.9, 1.4, 1.2, { win: "casement", dress: "none" }), D(0, 1.2, 2.2, { door: "glazed" }), W(3.2, 0.9, 1.4, 1.2, { win: "casement", dress: "none" }), W(6.5, 0.9, 1.4, 1.2, { win: "casement", dress: "none" })];
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.2,
    roof: "gable",
    ridge: "x",
    pitch: 14,
    roofTone: "light",
    roofOpts: { eave: 0.6, verge: 0.5, t: 0.08 },
    front: ops,
    back: at([-6, -2, 2, 6], { y: 1.0, w: 1.3, h: 1.1, kind: "window", win: "casement", dress: "none" }),
    left: [W(0, 1.0, 1.2, 1.1, { win: "casement", dress: "none" })],
    right: [D(0, 1.0, 2.1, { door: "plank" })],
    bands: [{ y: 0, h: 0.5, p: 0.05, tone: "light" }],
    label: "post",
  });
  // Panel joints.
  for (let x = -w / 2 + 1.2; x < w / 2; x += 1.2) {
    if (ops.some((o) => Math.abs(o.x - x) < o.w / 2 + 0.1)) continue;
    a.quad(b.faces.front, x, h / 2 + 0.25, 0.004, 0.025, h - 0.5, "solid");
  }
  // Verandah.
  const vf = frame(0, 0, d / 2 + 1.3);
  if (a.ruin < RUIN.shell) {
    a.box(vf, 0, 0, 0, w, 0.3, 2.6, "pale");
    for (let x = -w / 2 + 0.3; x <= w / 2; x += 3) a.box(vf, x, 0.3, 1.1, 0.12, 2.4, 0.12, "paper");
    a.leanRoof(frame(0, 2.7, 0, 0, vf), w + 0.2, 2.6, { pitch: 6, eave: 0.2, verge: 0.1, t: 0.07, tone: "light", label: "verandah" });
  }
  a.sign(vf, { kind: "board", text: "MERIDIAN CLINIC", sub: "HEALTH POST", cross: true }, 0, 2.55, 5.2, 0.62, 1.44);
  // Pole sign with the cross, like a pharmacy's, at the verandah end.
  const ps = frame(-w / 2 - 1.2, 0, d / 2 + 2.4);
  a.add(cylinder(0.08, 0.1, 5.2, 6), ps, { tone: "mid", position: [0, 2.6, 0] });
  if (a.ruin < 0.8) for (const s of [1, -1]) a.sign(frame(0, 0, 0, s > 0 ? -0.6 : Math.PI - 0.6, ps), { kind: "blade", text: "", cross: true }, 0, 4.7, 1.1, 1.2, 0.07, s > 0);
  // Solar panels and a water tank on a stand.
  if (a.ruin < RUIN.gutted) {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Matrix4().makeRotationX(-(14 * DEG));
      m.setPosition(-5 + i * 2.1, h + 0.72, 1.5);
      a.add(new THREE.BoxGeometry(1.9, 0.05, 1.1), m, { tone: "deep" });
    }
  }
  const tf = frame(w / 2 + 2.2, 0, -1.5);
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) a.box(tf, sx, 0, sz, 0.12, 3.0, 0.12, "light");
  a.box(tf, 0, 3.0, 0, 1.9, 0.12, 1.9, "light");
  if (a.ruin < 0.7) a.add(cylinder(0.9, 0.9, 1.9, 14), tf, { tone: "paper", position: [0, 4.05, 0] });
  for (let y = 3.3; y < 5; y += 0.4) a.add(cylinder(0.92, 0.92, 0.04, 14, true), tf, { tone: "light", position: [0, y, 0] });
}

// ----------------------------------------------------------------- hospital

export function hospital(a: Arch, variant: number): void {
  if (variant === 1) {
    pavilionHospital(a);
    return;
  }
  // Modern general hospital: a two-storey podium under a five-storey ward
  // slab, roof plant, a flue, a big entrance canopy.
  const pw = 66;
  const pd = 30;
  const ph = 8;
  const ribbon = (w: number, y: number, pitch = 1.5): Opening => ({ x: 0, y, w, h: 1.8, kind: "window", win: "ribbon", pitch, lite: true, sill: false });
  const podium = massing(a, {
    w: pw,
    d: pd,
    h: ph,
    t: 0.4,
    roof: "flat",
    parapet: 0.8,
    front: [{ ...ribbon(24, 1.0), x: -19 }, { ...ribbon(24, 1.0), x: 21 }, { ...ribbon(pw - 4, 4.8) }, { x: 1, y: 0, w: 6, h: 3.0, kind: "door", door: "glazed" }],
    back: [ribbon(pw - 4, 1.0), ribbon(pw - 4, 4.8)],
    left: [ribbon(pd - 4, 1.0), ribbon(pd - 4, 4.8)],
    right: [{ ...ribbon(12, 1.0), x: 7 }, { x: -5, y: 0, w: 4.5, h: 3.4, kind: "door", door: "shutter" }, ribbon(pd - 4, 4.8)],
    bands: [{ y: 3.9, h: 0.5, p: 0.12 }],
    label: "podium",
  });
  const floors = 5;
  const fh = 3.6;
  const slabOps = (w: number): Opening[] => Array.from({ length: floors }, (_, i) => ({ ...ribbon(w, 1.0 + i * fh, 1.8) }));
  const slab = massing(
    a,
    {
      z: -3,
      w: 54,
      d: 16,
      h: floors * fh + 0.4,
      t: 0.4,
      roof: "flat",
      parapet: 0.9,
      front: slabOps(50),
      back: slabOps(50),
      left: [{ x: 0, y: 0.8, w: 1.2, h: floors * fh - 1.2, kind: "window", win: "industrial", grid: [1, floors * 2], lite: true }],
      right: [{ x: 0, y: 0.8, w: 1.2, h: floors * fh - 1.2, kind: "window", win: "industrial", grid: [1, floors * 2], lite: true }],
      label: "slab",
    },
    frame(0, ph, 0),
  );
  // Floor-edge bands between the ribbons.
  if (a.ruin < RUIN.shell) {
    for (let i = 1; i < floors; i++) {
      a.box(slab.faces.front, 0, i * fh + 0.35, 0.12, 54, 0.3, 0.24, "paper");
      a.box(slab.faces.back, 0, i * fh + 0.35, 0.12, 54, 0.3, 0.24, "paper");
    }
  }
  const top = ph + floors * fh + 0.4;
  // Stair cores at the slab ends, rising past the roof with a glazed slot.
  for (const s of [-1, 1]) {
    massing(
      a,
      {
        x: s * 28.4,
        z: -3,
        w: 4.2,
        d: 7,
        h: floors * fh + 3.2,
        t: 0.35,
        roof: "flat",
        parapet: 0.4,
        front: [{ x: 0, y: 1.0, w: 1.0, h: floors * fh + 0.8, kind: "window", win: "industrial", grid: [1, floors * 2 + 1], lite: true }],
        omit: [s < 0 ? "right" : "left"],
        label: `core${s}`,
      },
      frame(0, ph, 0),
    );
  }
  // Sun fins over the ward ribbons: a rhythm of thin shelves.
  if (a.ruin < RUIN.shell) for (let i = 0; i < floors; i++) a.box(slab.faces.front, 0, 1.0 + i * fh + 2.05, 0.45, 50, 0.08, 0.9, "paper");
  // Roof plant, lift towers and a flue.
  if (a.ruin < RUIN.gutted) {
    a.box(null, -12, top, -4, 12, 3.2, 8, "light");
    a.box(null, 14, top, -2, 5, 4.2, 5, "paper");
    const lf = frame(-12, 0, 0);
    for (let i = 0; i < 10; i++) a.quad(lf, -5.4 + i * 1.2, top + 1.6, 0.001, 0.05, 2.8, "solid");
    a.add(cylinder(0.8, 0.9, 9, 14), null, { tone: "light", position: [24, top + 4.5, -8] });
    a.add(cylinder(0.95, 0.95, 0.4, 14), null, { tone: "mid", position: [24, top + 9.1, -8] });
    // Helipad marking on the slab roof: a ring.
    a.add(new THREE.RingGeometry(3.2, 3.6, 24), new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(-2, top + 0.02, -3), { tone: "mid" });
  }
  // Entrance canopy with the name.
  const cf = frame(1, 0, pd / 2);
  if (a.ruin < RUIN.shell) {
    a.box(cf, 0, 4.0, 3.5, 16, 0.5, 7.4, "paper");
    for (const x of [-7, -2.3, 2.3, 7]) a.add(cylinder(0.22, 0.22, 4.0, 10), cf, { tone: "paper", position: [x, 2.0, 6.6] });
  }
  a.sign(cf, { kind: "board", text: "MERIDIAN HOSPITAL" }, 0, 4.25, 11, 0.5, 7.22);
  a.sign(podium.faces.right, { kind: "enamel", text: "EMERGENCY" }, -5, 4.1, 3.6, 0.55, 0.06);
  a.sign(slab.faces.front, { kind: "painted", text: "MERIDIAN" }, 18, floors * fh + 0.05, 9, 1.1, 0.02);
  pylon(a, -26, pd / 2 + 8, "MERIDIAN HOSPITAL", "EMERGENCY · OUTPATIENTS", 4.4, 1.3, 2.6, 0.25);
}

function pavilionHospital(a: Arch): void {
  // Victorian pavilion plan: an administration block with a clock tower,
  // long ward pavilions either side, sanitary towers at their ends.
  const adm = massing(a, {
    w: 18,
    d: 13,
    h: 11,
    t: 0.6,
    roof: "hip",
    pitch: 30,
    roofTone: "mid",
    roofOpts: { eave: 0.5 },
    front: [
      ...at([-6.2, -3.6, 3.6, 6.2], { y: 1.2, w: 1.2, h: 2.2, kind: "window", win: "sash", dress: "key" }),
      ...at([-6.2, -3.6, 0, 3.6, 6.2], { y: 4.8, w: 1.2, h: 2.2, kind: "window", win: "sash", dress: "key" }),
      ...at([-6.2, -3.6, 0, 3.6, 6.2], { y: 8.1, w: 1.1, h: 1.9, kind: "window", win: "sash", dress: "plain" }),
      { x: 0, y: 0.5, w: 2.0, h: 3.1, kind: "door", door: "panel", head: "round", dress: "key", doorTone: "solid" },
    ],
    back: at([-6, -2, 2, 6], { y: 4.8, w: 1.2, h: 2.2, kind: "window", win: "sash" }),
    bands: [{ y: 0, h: 0.8, p: 0.1, tone: "light" }, { y: 4.1, h: 0.2, p: 0.08 }, { y: 7.5, h: 0.2, p: 0.08 }, { y: 10.6, h: 0.4, p: 0.25 }],
    quoins: true,
    label: "admin",
  });
  a.sign(adm.faces.front, { kind: "carved", text: "MERIDIAN HOSPITAL" }, 0, 3.75, 6.2, 0.5, 0.04);
  for (const x of [-5.5, 5.5]) a.chimney(adm.f, x, 0, 10, adm.top + 0.3, 1.0, 0.7, 3);
  // Clock tower rising from the front centre.
  const tf = frame(0, 0, 6.5 + 1.5);
  const tower = massing(a, {
    w: 4.4,
    d: 3,
    h: 21,
    t: 0.5,
    roof: "hip",
    pitch: 58,
    roofTone: "mid",
    roofOpts: { eave: 0.35 },
    front: [{ x: 0, y: 0, w: 2.0, h: 3.1, kind: "door", door: "panel", head: "round", dress: "key", doorTone: "solid" }, { x: 0, y: 4.8, w: 1.2, h: 2.4, kind: "window", win: "sash", head: "round" }, { x: 0, y: 8.4, w: 1.1, h: 2.2, kind: "window", win: "sash", head: "round" }, { x: 0, y: 17.4, w: 1.2, h: 2.6, kind: "window", win: "louvre", head: "round", dress: "arch" }],
    left: [{ x: 0, y: 17.4, w: 1.0, h: 2.6, kind: "window", win: "louvre", head: "round", dress: "arch" }],
    right: [{ x: 0, y: 17.4, w: 1.0, h: 2.6, kind: "window", win: "louvre", head: "round", dress: "arch" }],
    bands: [{ y: 0, h: 0.8, p: 0.1, tone: "light" }, { y: 11.2, h: 0.3, p: 0.16 }, { y: 16.6, h: 0.3, p: 0.16 }],
    label: "clock",
  }, tf);
  if (a.ruin < 0.7) {
    a.sign(tower.faces.front, { kind: "clock", text: a.ruin > 0.2 ? "03:14" : "10:10" }, 0, 14, 2.2, 2.2, 0.08, false, new THREE.CircleGeometry(1.1, 24));
    a.cbox(tower.faces.front, 0, 14, 0.04, 2.7, 2.7, 0.08, "pale");
  }
  // Ward pavilions.
  for (const s of [-1, 1]) {
    const wf = frame(s * 25, 0, -2);
    const pairs: Opening[] = [];
    for (let k = 0; k < 6; k++) {
      const x = -12.5 + k * 5;
      for (const y of [1.1, 4.9]) pairs.push({ x, y, w: 1.35, h: 2.6, kind: "window", win: "sash", lite: true });
    }
    const ward = massing(a, {
      w: 32,
      d: 10,
      h: 8,
      t: 0.5,
      roof: "gable",
      ridge: "x",
      pitch: 35,
      roofTone: "mid",
      front: pairs,
      back: pairs,
      bands: [{ y: 0, h: 0.8, p: 0.1, tone: "light" }],
      omit: [s < 0 ? "right" : "left"],
      label: `ward${s}`,
    }, wf);
    for (const x of [-7, 7]) a.chimney(ward.f, x, 0, 7, ward.top + 0.6, 0.9, 0.6, 2);
    // Sanitary tower at the far end.
    massing(a, {
      x: s * 18,
      w: 4.5,
      d: 4.5,
      h: 11.5,
      t: 0.45,
      roof: "hip",
      pitch: 45,
      roofTone: "mid",
      front: at([0], { y: 1.4, w: 0.8, h: 1.8, kind: "window", win: "sash" }).concat(at([0], { y: 5.2, w: 0.8, h: 1.8, kind: "window", win: "sash" })),
      right: s > 0 ? at([0], { y: 5.2, w: 0.8, h: 1.8, kind: "window", win: "sash" }) : [],
      left: s < 0 ? at([0], { y: 5.2, w: 0.8, h: 1.8, kind: "window", win: "sash" }) : [],
      omit: [s < 0 ? "right" : "left"],
      bands: [{ y: 0, h: 0.8, p: 0.1, tone: "light" }, { y: 11.1, h: 0.4, p: 0.2 }],
      label: `san${s}`,
    }, wf);
  }
}

// --------------------------------------------------------------- courthouse

export function courthouse(a: Arch, variant: number): void {
  if (variant === 1) {
    // Italianate county court with a clock tower.
    const b = massing(a, {
      w: 30,
      d: 17,
      h: 10.5,
      t: 0.6,
      roof: "hip",
      pitch: 24,
      roofTone: "mid",
      roofOpts: { eave: 0.9 },
      front: [
        ...at([-12, -8.5, -5, 5, 8.5, 12], { y: 1.4, w: 1.5, h: 3.2, kind: "window", win: "sash", head: "round", dress: "key" }),
        ...at([-12, -8.5, -5, 5, 8.5, 12], { y: 6.1, w: 1.4, h: 2.9, kind: "window", win: "sash", head: "round", dress: "key" }),
      ],
      back: at([-10, -5, 0, 5, 10], { y: 6.1, w: 1.4, h: 2.9, kind: "window", win: "sash", head: "round" }),
      left: at([-4.5, 0, 4.5], { y: 1.4, w: 1.4, h: 3.0, kind: "window", win: "sash", head: "round", dress: "key" }),
      right: at([-4.5, 0, 4.5], { y: 1.4, w: 1.4, h: 3.0, kind: "window", win: "sash", head: "round", dress: "key" }),
      bands: [{ y: 0, h: 1.0, p: 0.14, tone: "pale" }, { y: 5.3, h: 0.24, p: 0.1 }, { y: 10.1, h: 0.4, p: 0.35 }],
      quoins: true,
      label: "court",
    });
    const tower = massing(a, {
      z: 6.5,
      w: 6.2,
      d: 5,
      h: 25,
      t: 0.6,
      roof: "hip",
      pitch: 40,
      roofTone: "mid",
      roofOpts: { eave: 0.6 },
      front: [{ x: 0, y: 0.8, w: 2.4, h: 3.8, kind: "door", door: "panel", head: "round", dress: "key", doorTone: "solid" }, { x: 0, y: 6.1, w: 1.5, h: 2.9, kind: "window", win: "sash", head: "round", dress: "key" }, { x: -1.2, y: 20.2, w: 1.0, h: 2.8, kind: "window", win: "louvre", head: "round" }, { x: 1.2, y: 20.2, w: 1.0, h: 2.8, kind: "window", win: "louvre", head: "round" }],
      left: [{ x: 0, y: 20.2, w: 1.2, h: 2.8, kind: "window", win: "louvre", head: "round" }],
      right: [{ x: 0, y: 20.2, w: 1.2, h: 2.8, kind: "window", win: "louvre", head: "round" }],
      bands: [{ y: 0, h: 1.0, p: 0.14, tone: "pale" }, { y: 10.1, h: 0.4, p: 0.3 }, { y: 14.2, h: 0.25, p: 0.15 }, { y: 19.4, h: 0.3, p: 0.2 }, { y: 24.6, h: 0.4, p: 0.4 }],
      quoins: true,
      omit: ["back"],
      label: "ctower",
    });
    a.sign(tower.faces.front, { kind: "carved", text: "COUNTY COURT" }, 0, 5.1, 4.8, 0.5, 0.04);
    if (a.ruin < 0.7) {
      for (const [face, off] of [
        [tower.faces.front, 0],
        [tower.faces.left, 0],
        [tower.faces.right, 0],
      ] as const) {
        a.cbox(face, off, 16.8, 0.05, 3.0, 3.0, 0.1, "pale");
        a.sign(face, { kind: "clock", text: a.ruin > 0.2 ? "03:14" : a.sealed ? "12:00" : "10:10" }, off, 16.8, 2.5, 2.5, 0.1, false, new THREE.CircleGeometry(1.25, 24));
      }
    }
    // Steps up to the tower door.
    a.box(tower.faces.front, 0, 0, 0.8, 5, 0.8, 1.6, "pale");
    for (let i = 0; i < 4; i++) a.box(tower.faces.front, 0, 0, 1.6 + (3 - i) * 0.3, 5 + (4 - i) * 0.3, 0.2 * (i + 1), 0.3, "pale");
    void b;
    return;
  }
  // Neoclassical court: podium, grand stair, hexastyle portico with a
  // pediment, pedimented windows, a dome with a lantern.
  const w = 34;
  const d = 20;
  const pod = 1.8;
  const h = 12.5;
  const tall = (x: number, y: number, dress: Opening["dress"], hh = 3.4): Opening => ({ x, y, w: 1.5, h: hh, kind: "window", win: "sash", dress });
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.7,
    roof: "flat",
    parapet: 1.3,
    front: [...[-14.5, -11, 11, 14.5].map((x) => tall(x, pod + 1.2, "pediment")), ...[-14.5, -11, 11, 14.5].map((x) => tall(x, pod + 6.2, "key", 2.8)), ...[-3.2, 0, 3.2].map((x): Opening => ({ x, y: pod, w: 2.0, h: 4.4, kind: "door", door: "panel", head: "round", dress: "key", doorTone: "deep" }))],
    back: [-12, -6, 0, 6, 12].map((x) => tall(x, pod + 1.2, "hood")),
    left: [-6, 0, 6].map((x) => tall(x, pod + 1.2, "pediment")).concat([-6, 0, 6].map((x) => tall(x, pod + 6.2, "key", 2.8))),
    right: [-6, 0, 6].map((x) => tall(x, pod + 1.2, "pediment")).concat([-6, 0, 6].map((x) => tall(x, pod + 6.2, "key", 2.8))),
    bands: [
      { y: 0, h: pod, p: 0.18, tone: "pale" },
      { y: pod + 5.2, h: 0.3, p: 0.12 },
      { y: h - 1.3, h: 0.9, p: 0.08 },
      { y: h - 0.4, h: 0.4, p: 0.4 },
    ],
    quoins: true,
    label: "court",
  });
  const pf = b.faces.front;
  const pw = 15;
  const pdp = 5;
  // Podium and grand stair.
  a.box(pf, 0, 0, pdp / 2, pw + 1.2, pod, pdp, "pale");
  const steps = 9;
  for (let i = 0; i < steps; i++) a.box(pf, 0, 0, pdp + 0.2 + (steps - 1 - i) * 0.34, pw - 1 + (steps - i) * 0.25, (pod * (i + 1)) / steps, 0.36, "pale");
  for (const s of [-1, 1]) a.box(pf, s * (pw / 2 + 0.2), 0, pdp + 1.5, 1.0, pod + 0.6, 3.2, "paper");
  if (a.ruin < RUIN.shell) {
    for (let i = 0; i < 6; i++) column(a, pf, -6.25 + i * 2.5, pod, pdp - 0.7, h - pod - 1.35, 0.46);
    a.box(pf, 0, h - 1.4, pdp / 2 - 0.3, pw + 0.4, 1.3, pdp + 0.2, "paper");
    pediment(a, pf, 0, h - 0.1, pw + 0.8, 3.0, pdp + 0.4, -0.5);
  }
  a.sign(pf, { kind: "carved", text: "COURT OF JUSTICE" }, 0, h - 0.75, 9, 0.62, pdp + 0.12);
  // Dome on a drum with a lantern.
  if (a.ruin < RUIN.gutted) {
    const df = frame(0, h + 1.3, -2);
    a.add(cylinder(5.2, 5.2, 3.6, 28), df, { tone: "paper", position: [0, 1.8, 0] });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const wf = frame(Math.sin(ang) * 5.18, 0, Math.cos(ang) * 5.18, ang, df);
      if (i % 2 === 0) a.box(wf, 0, 0.7, 0, 0.9, 2.0, 0.1, a.c.lit > 0.3 ? "pale" : "dark", a.c.lit > 0.3 ? { accent: "amber", amt: 0.8 } : {});
      else a.box(wf, 0, 0, 0.1, 0.5, 3.6, 0.3, "paper");
    }
    a.add(cylinder(5.5, 5.5, 0.4, 28), df, { tone: "pale", position: [0, 3.8, 0] });
    a.add(lathe(Array.from({ length: 11 }, (_, i) => [5.3 * Math.cos((i / 10) * (Math.PI / 2)), 4.6 * Math.sin((i / 10) * (Math.PI / 2))] as [number, number]), 28), df, { tone: "light", position: [0, 4.0, 0] });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rib = lathe([[0.001, 0], [0.12, 0.02]], 3);
      void rib;
      a.add(new THREE.TorusGeometry(5.32, 0.07, 3, 20, Math.PI / 2), frame(0, 4.0, 0, ang, df), { tone: "mid", rotation: [0, 0, 0] });
    }
    a.add(cylinder(0.9, 0.95, 1.8, 10), df, { tone: "paper", position: [0, 9.4, 0] });
    a.add(cone(1.1, 1.2, 10), df, { tone: "light", position: [0, 10.9, 0] });
    a.add(cylinder(0.04, 0.04, 1.2, 4), df, { tone: "mid", position: [0, 12.0, 0] });
  }
  // Flagpoles either side of the stair.
  for (const s of [-1, 1]) a.add(cylinder(0.06, 0.09, 10, 6), pf, { tone: "mid", position: [s * (pw / 2 + 3.5), 5, pdp + 3] });
}

// ------------------------------------------------------------- town houses

export function townHouses(a: Arch, variant: number): void {
  const g = a.rng;
  const n = variant === 2 ? g.int(4, 5) : g.int(4, 6);
  const identical = a.c.identical || a.sealed;
  if (variant === 2) {
    // Gable-fronted merchants' houses with stepped, bell and neck gables.
    const hw = 5.6;
    const total = n * hw;
    for (let i = 0; i < n; i++) {
      const gi = a.fork(`gable${identical ? 0 : i}`);
      const x = -total / 2 + hw * (i + 0.5);
      const storeys = identical ? 3 : gi.int(3, 4);
      const sh = 3.1;
      const h = storeys * sh + 0.4;
      const kind = identical ? 0 : gi.int(0, 2);
      const rise = 5.2;
      const top = gableProfile(kind, hw, h, rise);
      const ops: Opening[] = [];
      for (let s = 0; s < storeys; s++) {
        for (const wx of s === 0 ? [-1.5] : [-1.5, 1.5]) ops.push({ x: wx, y: s * sh + (s === 0 ? 0.9 : 0.7), w: 1.15, h: s === 0 ? 1.9 : 1.8, kind: "window", win: "georgian", dress: "key" });
      }
      ops.push({ x: 1.3, y: 0.35, w: 1.2, h: 2.5, kind: "door", door: "panel", doorTone: identical ? "deep" : gi.pick(["deep", "solid", "dark", "mid"] as const), dress: "hood" });
      ops.push({ x: 0, y: h + 1.4, w: 1.1, h: 1.4, kind: "window", win: "georgian" });
      ops.push({ x: 0, y: h + 3.4, w: 0.7, h: 0.8, kind: "window", win: "casement", head: "round", dress: "none" });
      const hf = frame(x, 0, 0);
      const t = 0.45;
      a.wall(frame(0, 0, 5.5, 0, hf), { len: hw - 0.02, h, t, top, ops, label: `tf${i}`, bands: [{ y: 0, h: 0.35, p: 0.06, tone: "light" }] });
      a.wall(frame(0, 0, -5.5, Math.PI, hf), { len: hw - 0.02, h, t, top: gableProfile(0, hw, h, rise * 0.6), ops: [W(0, 3.8, 1.1, 1.6)], label: `tb${i}` });
      if (i === 0 || i === n - 1) {
        const side = i === 0 ? -1 : 1;
        a.wall(frame(side * (hw / 2 - 0.01), 0, 0, side * (Math.PI / 2), hf), { len: 11 - 2 * t, h, t, label: `ts${i}` });
      }
      // Roof ridge runs front to back.
      a.roof(frame(0, h, 0, Math.PI / 2, hf), 10.6, hw - 0.7, { pitch: 52, eave: 0.05, verge: 0.0, t: 0.12, fascia: false, barge: false, tone: "light", label: `troof${i}` });
      if (i > 0) a.chimney(hf, -hw / 2, -2.5, h, h + ((hw - 0.7) / 2) * Math.tan(52 * DEG) + 1.0, 0.6, 0.9, 2);
    }
    if (a.ruin >= RUIN.gutted) a.rubble(null, 0, 0, total / 2, 4, 0.6, "terrace", 1.5);
    return;
  }
  const hw = variant === 0 ? 5.4 : 5.0;
  const storeys = variant === 0 ? 3 : 2;
  const sh = variant === 0 ? 3.2 : 3.0;
  const raised = variant === 0 ? 0.8 : 0.3;
  const h = raised + storeys * sh;
  const total = n * hw;
  const d = variant === 0 ? 10 : 9;
  const front: Opening[] = [];
  const back: Opening[] = [];
  const doorTones: Tone[] = ["solid", "deep", "dark", "mid", "light"];
  for (let i = 0; i < n; i++) {
    const gi = a.fork(`house${identical ? 0 : i}`);
    const x0 = -total / 2 + hw * i;
    const mirror = !identical && i % 2 === 1;
    const doorX = x0 + (mirror ? hw - 1.1 : 1.1);
    const winX = x0 + (mirror ? 1.9 : hw - 1.9);
    front.push({ x: doorX, y: raised, w: 1.1, h: 2.6, kind: "door", door: "panel", head: variant === 0 ? "round" : "flat", doorTone: identical ? "deep" : gi.pick(doorTones), dress: variant === 0 ? "key" : "hood" });
    if (variant === 0) front.push({ x: winX, y: raised + 0.6, w: 1.2, h: 2.1, kind: "window", win: "georgian", dress: "key" });
    for (let s = 1; s < storeys; s++) {
      const hh = s === 1 && variant === 0 ? 2.4 : 1.8;
      for (const wx of [doorX, winX]) front.push({ x: wx, y: raised + s * sh + 0.6, w: 1.15, h: hh, kind: "window", win: variant === 0 ? "georgian" : "sash", dress: variant === 0 ? (s === 1 ? "pediment" : "plain") : "plain" });
    }
    for (let s = 0; s < storeys; s++) back.push({ x: x0 + hw / 2, y: raised + s * sh + 0.6, w: 1.1, h: 1.6, kind: "window", win: "sash" });
  }
  const b = massing(a, {
    w: total,
    d,
    h,
    t: 0.45,
    roof: variant === 0 ? "flat" : "gable",
    ridge: "x",
    parapet: 1.1,
    pitch: 34,
    roofTone: "mid",
    roofOpts: { eave: 0.3, verge: 0.2 },
    front,
    back,
    bands: variant === 0 ? [{ y: 0, h: raised, p: 0.08, tone: "light" }, { y: raised + sh - 0.25, h: 0.18, p: 0.08 }, { y: h + 0.35, h: 0.3, p: 0.18 }] : [{ y: 0, h: 0.45, p: 0.06, tone: "light" }],
    label: "terrace",
  });
  if (variant === 0) {
    // Mansard behind the parapet with a dormer per house.
    if (a.ruin < RUIN.gutted) {
      a.roof(frame(0, h + 0.4, 0, 0, b.f), total - 0.9, d - 2.2, { pitch: 45, eave: 0, verge: 0, t: 0.12, fascia: false, barge: false, tone: "mid", label: "mansard" });
      for (let i = 0; i < n; i++) {
        if (identical || a.fork(`dorm${i}`).next() < 0.8) dormer(a, frame(0, h + 0.4, 0, 0, b.f), -total / 2 + hw * (i + 0.5), d / 2 - 1.1, 45, { w: 1.3, h: 1.6, setback: 0.2, label: `tdorm${i}` });
      }
    }
    // Area railings and steps.
    if (a.ruin < RUIN.shell) {
      for (let x = -total / 2 + 0.1; x < total / 2; x += 0.24) a.add(cylinder(0.018, 0.018, 1.05, 3, true), b.faces.front, { tone: "deep", position: [x, 0.52, 1.6] });
      a.box(b.faces.front, 0, 1.0, 1.6, total, 0.05, 0.06, "deep");
    }
  } else {
    for (let i = 0; i < n; i++) {
      const mirror = !identical && i % 2 === 1;
      const winX = -total / 2 + hw * i + (mirror ? 1.9 : hw - 1.9);
      bay(a, b.faces.front, winX, { w: 2.4, p: 0.7, storeys: 1, storeyH: 3.0, y: 0.3, label: `tbay${i}` });
      // Front garden wall with a gate gap.
      const doorX = -total / 2 + hw * i + (mirror ? hw - 1.1 : 1.1);
      const gf = frame(0, 0, 3.2, 0, b.faces.front);
      const x0 = -total / 2 + hw * i;
      if (a.ruin < 0.8) {
        a.box(gf, (x0 + doorX - 0.6) / 2, 0, 0, doorX - 0.6 - x0, 0.75, 0.25, "paper");
        a.box(gf, (doorX + 0.6 + x0 + hw) / 2, 0, 0, x0 + hw - doorX - 0.6, 0.75, 0.25, "paper");
      }
    }
  }
  // Party-wall chimney stacks.
  for (let i = 0; i <= n; i++) {
    if (a.fork(`stack${i}`).next() < 0.15 && !identical) continue;
    const x = -total / 2 + hw * i;
    const yTop = variant === 0 ? h + 0.4 + ((d - 2.2) / 2) * Math.tan(45 * DEG) + 0.9 : b.top + 0.6;
    a.chimney(b.f, Math.max(-total / 2 + 0.5, Math.min(total / 2 - 0.5, x)), variant === 0 ? 0 : 0, h - 1, yTop, 1.4, 0.7, i === 0 || i === n ? 2 : 4);
  }
  if (variant === 0) for (let i = 0; i < n; i++) a.downpipe(b.faces.front, -total / 2 + hw * (i + 1) - 0.12, h + 0.3, 0.2);
}

/** Top profile for a gable-fronted house front (from +x to -x). */
function gableProfile(kind: number, w: number, h: number, rise: number): P2[] {
  const hw = w / 2;
  if (kind === 0) {
    // Stepped (crow-stepped) gable.
    const steps = 5;
    const pts: P2[] = [[hw, h]];
    for (let i = 0; i < steps; i++) {
      const x = hw - ((i + 1) / (steps + 1)) * hw;
      const yA = h + (rise * i) / steps + rise / steps;
      pts.push([pts[pts.length - 1]![0], yA]);
      pts.push([x, yA]);
    }
    pts.push([pts[pts.length - 1]![0], h + rise + 0.6]);
    const right = pts;
    const left = right
      .slice()
      .reverse()
      .map(([x, y]) => [-x, y] as P2);
    return [...right, ...left.slice(1)];
  }
  if (kind === 1) {
    // Bell gable: scrolls rising to a round-topped crown.
    const pts: P2[] = [[hw, h]];
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = hw - (hw - 1.0) * t;
      const y = h + rise * 0.75 * Math.sin((t * Math.PI) / 2) ** 0.6;
      pts.push([x, y]);
    }
    for (let i = 1; i <= 6; i++) {
      const ang = (i / 6) * Math.PI;
      pts.push([Math.cos(ang) * 1.0, h + rise * 0.75 + Math.sin(ang) * 0.8]);
    }
    for (let i = n - 1; i >= 0; i--) {
      const t = i / n;
      const x = -(hw - (hw - 1.0) * t);
      const y = h + rise * 0.75 * Math.sin((t * Math.PI) / 2) ** 0.6;
      pts.push([x, y]);
    }
    return dedupe(pts);
  }
  // Neck gable: shoulders then a tall narrow neck with a pediment.
  return [
    [hw, h],
    [hw, h + 0.5],
    [1.4, h + rise * 0.45],
    [1.4, h + rise * 0.9],
    [0, h + rise * 1.1],
    [-1.4, h + rise * 0.9],
    [-1.4, h + rise * 0.45],
    [-hw, h + 0.5],
    [-hw, h],
  ];
}

function dedupe(pts: P2[]): P2[] {
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) > 1e-3);
}

export type { BlockResult };
void smooth;
void openingPoly;
