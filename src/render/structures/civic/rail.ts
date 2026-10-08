/**
 * Railway structures: station, signal box, depot, warehouse, dispatch
 * office, and the bridge that carries the line over a river gap.
 *
 * Trackside buildings face the line with their front (+Z). They publish
 * `userData.trackside = { edgeZ, height }`: the platform/front edge line and
 * its height above y = 0, so the world renderer can set the track centreline at
 * edgeZ + TRACK_OFFSET.
 */
import * as THREE from "three";
import { Kit, cone, cylinder, extrude, type Tone } from "../../core/geometry.ts";
import type { Arch, M4, Opening, P2, V3 } from "./arch.ts";
import { at, frame, row } from "./arch.ts";
import { RUIN, smooth } from "./condition.ts";
import { massing } from "./massing.ts";
import { weatherboard } from "./rural.ts";

/** Distance from a platform edge to the centreline of the adjacent track. */
export const TRACK_OFFSET = 1.45;

export interface Trackside {
  /** z of the platform edge (or the front line of the building). */
  edgeZ: number;
  /** Height of the platform surface above y = 0. */
  height: number;
}

export interface BridgeSpec {
  /** Along-track length from abutment face to abutment face. */
  span: number;
  /** Overall length including abutments. */
  length: number;
  /** Top of the deck (where ballast sits) above the river bed (y = 0). */
  deckHeight: number;
  /** Width of the deck between parapets or trusses. */
  deckWidth: number;
  /** The line runs along this axis through the origin. */
  axis: "z";
  kind: "masonry-arch" | "through-truss" | "plate-girder";
}

const W = (x: number, y: number, w: number, h: number, extra: Partial<Opening> = {}): Opening => ({ x, y, w, h, kind: "window", win: "sash", ...extra });
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ helpers

/** A sawtooth valance: the fretted board edge of a platform canopy. */
function valance(a: Arch, f: M4, x0: number, x1: number, y: number, z: number, depth = 0.55): void {
  const tooth = 0.18;
  const pts: P2[] = [
    [x0, y],
    [x1, y],
  ];
  const n = Math.max(2, Math.round((x1 - x0) / tooth));
  const top: P2[] = [];
  for (let i = n; i >= 0; i--) {
    const x = x0 + ((x1 - x0) * i) / n;
    top.push([x, y - (i % 2 === 0 ? depth : depth * 0.62)]);
  }
  // Outline: straight top edge, zig-zag bottom.
  const poly: P2[] = [pts[0]!, ...top.reverse(), pts[1]!].reverse();
  a.add(extrude(poly, 0.04), f, { tone: "paper", position: [0, 0, z] });
}

/** Cast-iron column with a capital and spandrel brackets. */
function ironColumn(a: Arch, f: M4, x: number, z: number, h: number, bracket: number): void {
  a.add(cylinder(0.08, 0.1, h, 8), f, { tone: "mid", position: [x, h / 2, z] });
  a.box(f, x, 0, z, 0.3, 0.2, 0.3, "mid");
  a.box(f, x, h - 0.18, z, 0.26, 0.18, 0.26, "mid");
  if (bracket > 0) {
    for (const s of [-1, 1]) a.beam(f, [x, h - 0.9, z], [x + s * bracket, h - 0.05, z], 0.05, 0.05, "mid");
    a.beam(f, [x, h - 0.9, z], [x, h - 0.05, z - bracket * 0.8], 0.05, 0.05, "mid");
  }
}

/** Platform lamp: post and lantern (amber at night). */
function lamp(a: Arch, f: M4 | null, x: number, z: number, h = 3.4): void {
  a.add(cylinder(0.05, 0.07, h, 6), f, { tone: "mid", position: [x, h / 2, z] });
  a.box(f, x, 0, z, 0.2, 0.3, 0.2, "mid");
  const lit = a.c.night > 0.4 && a.c.ruin < 0.4 && !a.sealed;
  if (a.ruin < 0.5) {
    a.box(f, x, h, z, 0.34, 0.42, 0.34, lit ? "pale" : "light", lit ? { accent: "amber", amt: 0.95 } : {});
    a.add(cone(0.3, 0.26, 4), f, { tone: "mid", position: [x, h + 0.55, z], rotation: [0, Math.PI / 4, 0] });
  }
}

function bench(a: Arch, f: M4 | null, x: number, z: number, rot = 0): void {
  const bf = frame(x, 0, z, rot, f ?? undefined);
  a.box(bf, 0, 0.42, 0, 1.8, 0.06, 0.42, "light");
  a.box(bf, 0, 0.55, -0.2, 1.8, 0.45, 0.05, "light", { rot: [-0.15, 0, 0] });
  for (const s of [-0.75, 0.75]) a.box(bf, s, 0, 0, 0.06, 0.45, 0.42, "deep");
}

/** Short lengths of siding rail on sleepers, from z0 to z1 at x. */
function railStub(a: Arch, x: number, z0: number, z1: number, y = 0): void {
  const len = Math.abs(z1 - z0);
  const zc = (z0 + z1) / 2;
  for (let z = Math.min(z0, z1) + 0.3; z < Math.max(z0, z1); z += 0.7) a.box(null, x, y, z, 2.5, 0.14, 0.24, "light");
  for (const s of [-0.7175, 0.7175]) a.box(null, x + s, y + 0.14, zc, 0.07, 0.14, len, "mid");
}

// ------------------------------------------------------------------ station

export function station(a: Arch, variant: number): Trackside {
  const P = 1.1;
  const g = a.rng;
  const bw = variant === 0 ? g.range(15, 17) : 24;
  const bd = variant === 0 ? 6.5 : 9;
  const bh = variant === 0 ? 4.1 : 7.4;
  const platDepth = variant === 0 ? 5 : 6.5;
  const edgeZ = bd / 2 + platDepth;
  const platLen = variant === 0 ? 64 : 90;
  // Platform: a raised deck with coping along the edge and ramps at the ends.
  const pb = -bd / 2 - 2.5;
  a.box(null, 0, 0, (pb + edgeZ) / 2 - 0.06, platLen, P - 0.02, edgeZ - pb - 0.12, "pale");
  a.box(null, 0, P - 0.14, edgeZ - 0.3, platLen, 0.16, 0.72, "paper");
  a.quad(frame(0, 0, edgeZ - 0.12), 0, (P - 0.14) / 2, 0.005, platLen, P - 0.14, "mid");
  for (const s of [-1, 1]) {
    const rf = frame((s * platLen) / 2, 0, (pb + edgeZ) / 2, s > 0 ? 0 : Math.PI);
    a.add(extrude([[0, 0], [7, 0], [0, P]], edgeZ - pb), rf, { tone: "paper", rotation: [0, 0, 0] });
  }
  const pf = frame(0, P, 0);
  const lit = (i: number) => a.c.lit > a.fork(`slit${i}`).next();
  if (variant === 0) {
    // Country station: hipped booking hall with tall stacks and a canopy.
    const front: Opening[] = [
      W(-5.2, 0.9, 1.1, 1.8, { head: "segment", dress: "arch" }),
      W(-2.8, 0.9, 1.1, 1.8, { head: "segment", dress: "arch" }),
      { x: 0, y: 0, w: 1.2, h: 2.5, kind: "door", door: "panel", head: "segment", dress: "arch", doorTone: "deep" },
      W(2.8, 0.9, 1.1, 1.8, { head: "segment", dress: "arch" }),
      { x: 5.6, y: 0, w: 1.6, h: 2.5, kind: "door", door: "double", head: "segment", dress: "arch" },
    ];
    const b = massing(
      a,
      {
        w: bw,
        d: bd,
        h: bh,
        t: 0.45,
        roof: "hip",
        pitch: 34,
        roofTone: "mid",
        roofOpts: { eave: 0.55 },
        front,
        back: [W(-4.5, 0.9, 1.1, 1.8, { head: "segment", dress: "arch" }), { x: 0, y: 0, w: 1.3, h: 2.6, kind: "door", door: "panel", head: "segment", dress: "arch", doorTone: "deep" }, W(4.5, 0.9, 1.1, 1.8, { head: "segment", dress: "arch" })],
        left: [W(0, 0.9, 1.0, 1.7, { head: "segment", dress: "arch" })],
        right: [W(0, 0.9, 1.0, 1.7, { head: "segment", dress: "arch" })],
        bands: [{ y: 0, h: 0.45, p: 0.07, tone: "light" }, { y: 2.95, h: 0.15, p: 0.05 }],
        quoins: true,
        pipes: true,
        label: "booking",
      },
      pf,
    );
    for (const x of [-4.2, 4.2]) a.chimney(b.f, x, 0, bh - 1, b.top + 1.3, 0.8, 0.6, 2);
    a.sign(b.faces.back, { kind: "board", text: "BOOKING OFFICE" }, 0, 2.95, 2.6, 0.36, 0.05);
    // Canopy on iron columns with a fretted valance.
    const cl = bw + 8;
    const cd = platDepth - 0.9;
    const ch = 3.3;
    const cf = frame(0, 0, bd / 2, 0, pf);
    if (a.ruin < RUIN.shell) {
      for (let x = -cl / 2 + 1.5; x <= cl / 2 - 1.4; x += 4.2) ironColumn(a, cf, x, cd - 0.4, ch, 0.8);
      a.box(cf, 0, ch - 0.02, cd - 0.4, cl, 0.24, 0.22, "light");
      a.leanRoof(frame(0, ch + 0.22, cd / 2, 0, cf), cl, cd, { pitch: 9, eave: 0.2, verge: 0.1, t: 0.1, tone: "light", fascia: false, label: "canopy" });
      valance(a, frame(0, 0, cd + 0.2, 0, cf), -cl / 2, cl / 2, ch + 0.3, 0);
      for (const s of [-1, 1]) valance(a, frame((s * cl) / 2, 0, cd / 2, s * (Math.PI / 2), cf), -cd / 2 - 0.2, cd / 2 + 0.2, ch + 0.45, 0);
      // Hanging platform clock.
      const kf = frame(-2.5, 0, cd - 0.5, 0, cf);
      a.beam(kf, [0, ch, 0], [0, ch - 0.5, 0], 0.05, 0.05, "mid");
      a.add(cylinder(0.42, 0.42, 0.22, 16), kf, { tone: "mid", position: [0, ch - 0.9, 0], rotation: [Math.PI / 2, 0, 0] });
      a.sign(kf, { kind: "clock", text: a.ruin > 0.2 ? "03:14" : "06:40" }, 0, ch - 0.9, 0.7, 0.7, 0.12, false, new THREE.CircleGeometry(0.35, 16));
    }
    // Nameboards at each end, lamps, benches, a lamp hut.
    for (const s of [-1, 1]) nameboard(a, pf, s * (cl / 2 + 6), edgeZ - 1.4, "MERIDIAN");
    for (let x = -platLen / 2 + 4; x < platLen / 2 - 3; x += 9) if (Math.abs(x) > cl / 2) lamp(a, pf, x, edgeZ - 0.9);
    bench(a, pf, -4, bd / 2 + 0.5);
    bench(a, pf, 3.5, bd / 2 + 0.5);
    const hut = massing(a, { x: bw / 2 + 7, z: -0.5, w: 3.2, d: 2.6, h: 2.5, t: 0.15, roof: "gable", ridge: "x", pitch: 30, roofTone: "light", front: [{ x: 0.5, y: 0, w: 0.8, h: 1.9, kind: "door", door: "plank" }], left: [W(0, 1.0, 0.6, 0.6, { win: "casement" })], label: "lamphut" }, pf);
    weatherboard(a, hut.faces.front, 3.2, 0, 2.5, [{ x: 0.5, y: 0, w: 0.8, h: 1.9, kind: "door" }], 0, 0.24, "light");
    fence(a, pb, -platLen / 2 + 7, -bw / 2 - 1, P);
    fence(a, pb, bw / 2 + 1, platLen / 2 - 7, P);
    void lit;
    return { edgeZ, height: P };
  }
  // Town station: two storeys, a clock turret, a ridge-and-furrow canopy.
  const front: Opening[] = [];
  for (const x of [-9.6, -6.4, -3.2, 3.2, 6.4, 9.6]) front.push(W(x, 1.0, 1.3, 2.4, { head: "round", dress: "key", win: "fan" }), W(x, 4.6, 1.2, 2.0, { head: "segment", dress: "arch" }));
  front.push({ x: 0, y: 0, w: 2.4, h: 3.2, kind: "door", door: "glazed", head: "round", dress: "key" }, W(0, 4.6, 1.5, 2.1, { head: "round", dress: "key", win: "fan" }));
  const back: Opening[] = [];
  for (const x of [-9.6, -5, 5, 9.6]) back.push(W(x, 1.0, 1.3, 2.4, { head: "round", dress: "key" }), W(x, 4.6, 1.2, 2.0, { head: "segment" }));
  back.push({ x: 0, y: 0, w: 3.0, h: 3.4, kind: "door", door: "panel", head: "round", dress: "key", doorTone: "deep" });
  const b = massing(
    a,
    {
      w: bw,
      d: bd,
      h: bh,
      t: 0.5,
      roof: "hip",
      pitch: 30,
      roofTone: "mid",
      roofOpts: { eave: 0.7 },
      front,
      back,
      left: at([-2, 2], { y: 1.0, w: 1.2, h: 2.3, kind: "window", win: "sash", head: "round", dress: "key" }),
      right: at([-2, 2], { y: 1.0, w: 1.2, h: 2.3, kind: "window", win: "sash", head: "round", dress: "key" }),
      bands: [{ y: 0, h: 0.5, p: 0.08, tone: "light" }, { y: 3.8, h: 0.24, p: 0.1 }, { y: bh - 0.3, h: 0.3, p: 0.25 }],
      quoins: true,
      pipes: true,
      label: "townstation",
    },
    pf,
  );
  for (const x of [-7.5, 7.5]) a.chimney(b.f, x, 0, bh - 1, b.top + 1.0, 1.0, 0.7, 3);
  // Clock turret on the ridge, facing the forecourt and the platform.
  if (a.ruin < RUIN.gutted) {
    const tf = frame(0, bh + 1.2, 0, 0, pf);
    a.box(tf, 0, 0, 0, 2.4, 3.2, 2.4, "paper");
    a.box(tf, 0, 3.2, 0, 2.7, 0.2, 2.7, "pale");
    for (const s of [1, -1]) {
      a.sign(frame(0, 0, s * 1.21, s > 0 ? 0 : Math.PI, tf), { kind: "clock", text: a.ruin > 0.2 ? "03:14" : "06:40" }, 0, 1.8, 1.7, 1.7, 0.01, false, new THREE.CircleGeometry(0.85, 20));
    }
    a.roof(frame(0, 3.4, 0, 0, tf), 2.6, 2.6, { hip: true, pitch: 55, eave: 0.25, verge: 0.25, t: 0.08, gutter: false, tone: "mid", label: "turret" });
    a.add(cylinder(0.03, 0.03, 1.4, 4), tf, { tone: "mid", position: [0, 6.2, 0] });
  }
  a.sign(b.faces.back, { kind: "carved", text: "MERIDIAN STATION" }, 0, 3.55, 6.5, 0.45, 0.06);
  // Ridge-and-furrow canopy.
  const cl = 60;
  const cd = platDepth - 0.8;
  const ch = 3.9;
  const cf = frame(0, 0, bd / 2, 0, pf);
  if (a.ruin < RUIN.shell) {
    for (let x = -cl / 2 + 1; x <= cl / 2 - 0.9; x += 5) ironColumn(a, cf, x, cd - 0.5, ch, 0.9);
    a.box(cf, 0, ch - 0.02, cd - 0.5, cl, 0.3, 0.25, "light");
    a.box(cf, 0, ch - 0.02, 0.3, cl, 0.3, 0.25, "light");
    const bay = 3.0;
    const g2 = a.fork("ridges");
    for (let x = -cl / 2 + bay / 2; x < cl / 2; x += bay) {
      if (a.ruin > 0.2 && g2.next() < a.ruin * 1.3) continue;
      a.roof(frame(x, ch + 0.28, cd / 2, Math.PI / 2, cf), cd + 0.4, bay - 0.05, { pitch: 30, eave: 0.02, verge: 0.2, t: 0.07, fascia: false, gutter: false, barge: false, ridge: false, tone: "pale", label: `rf${x}`, intact: true });
    }
    valance(a, frame(0, 0, cd + 0.2, 0, cf), -cl / 2, cl / 2, ch + 0.45, 0, 0.6);
  }
  for (const s of [-1, 1]) nameboard(a, pf, s * (cl / 2 + 6), edgeZ - 1.4, "MERIDIAN");
  a.sign(cf, { kind: "enamel", text: "WAY OUT" }, 4, ch - 0.55, 1.4, 0.35, cd - 0.4);
  for (let x = -platLen / 2 + 4; x < platLen / 2 - 3; x += 9) if (Math.abs(x) > cl / 2) lamp(a, pf, x, edgeZ - 0.9);
  for (const x of [-12, -4, 4, 12]) bench(a, pf, x, bd / 2 + 0.5);
  fence(a, pb, -platLen / 2 + 7, -bw / 2 - 1, P);
  fence(a, pb, bw / 2 + 1, platLen / 2 - 7, P);
  return { edgeZ, height: P };
}

function nameboard(a: Arch, f: M4, x: number, z: number, name: string): void {
  if (a.ruin > 0.8 && a.fork(`nb${x}`).next() < 0.6) return;
  const nf = frame(x, 0, z, 0, f);
  for (const s of [-1, 1]) a.box(nf, s * 1.55, 0, 0, 0.14, 2.3, 0.14, "deep");
  a.sign(nf, { kind: "enamel", text: name }, 0, 1.95, 3.4, 0.62, 0.08);
}

/** Paling fence along the back of a platform (x0..x1 at z), on the deck at height y. */
function fence(a: Arch, z: number, x0: number, x1: number, y: number): void {
  if (x1 <= x0) return;
  const g = a.fork(`fence${x0}`);
  const f = frame(0, y, z + 0.2);
  for (const yy of [0.35, 1.1]) a.box(f, (x0 + x1) / 2, yy, 0.05, x1 - x0, 0.08, 0.05, "light");
  for (let x = x0; x < x1; x += 0.22) {
    if (a.ruin > 0.4 && g.next() < a.ruin - 0.2) continue;
    a.quad(f, x, 0.68, 0.09, 0.09, 1.36, "light");
    a.quad(f, x + 0.05, 0.68, 0.095, 0.022, 1.36, "solid");
  }
  for (let x = x0; x <= x1; x += 2.4) a.box(f, x, 0, 0, 0.1, 1.3, 0.1, "light");
}

// --------------------------------------------------------------- signal box

export function signalBox(a: Arch, variant: number): Trackside {
  const g = a.rng;
  const w = variant === 2 ? 12 : g.range(7.2, 8.6);
  const d = variant === 2 ? 5 : 3.9;
  const base = variant === 2 ? 3.4 : 3.3;
  const cab = 3.1;
  const litBand = a.c.night > 0.3 && a.c.ruin < 0.35 && !a.sealed && a.c.abandoned < 0.5;
  // Locking room.
  const lockOps: Opening[] =
    variant === 1
      ? [W(-w / 4, 1.0, 0.9, 1.1, { win: "casement", dress: "none" }), W(w / 4, 1.0, 0.9, 1.1, { win: "casement", dress: "none" })]
      : row(w, 3, { y: 1.0, w: 1.0, h: 1.3, kind: "window", win: "industrial", head: variant === 2 ? "flat" : "segment", dress: variant === 2 ? "none" : "arch" }, 0.8);
  const lb = massing(a, {
    w,
    d,
    h: base,
    t: variant === 1 ? 0.18 : 0.35,
    tone: "paper",
    roof: "none",
    front: lockOps,
    right: variant === 2 ? [{ x: 0, y: 0, w: 1.0, h: 2.2, kind: "door", door: "panel", doorTone: "deep" }] : [{ x: 0, y: 0, w: 0.9, h: 1.9, kind: "door", door: "plank" }],
    bands: variant === 1 ? [] : [{ y: 0, h: 0.4, p: 0.06, tone: "light" }, { y: base - 0.18, h: 0.18, p: 0.08 }],
    label: "locking",
  });
  if (variant === 1) weatherboard(a, lb.faces.front, w, 0, base, lockOps, 0, 0.26, "light");
  // Operating floor with continuous glazing.
  const cf = frame(0, base, 0);
  const glazing = (len: number): Opening[] => [{ x: 0, y: 1.05, w: len - 0.7, h: 1.6, kind: "window", win: "cabin", grid: [Math.round((len - 0.7) / 0.62), 2], sill: false, dress: "none" }];
  if (variant === 2) {
    massing(
      a,
      {
        w,
        d,
        h: cab,
        t: 0.25,
        roof: "flat",
        parapet: 0.1,
        front: [{ x: 0, y: 0.9, w: w - 0.8, h: 1.9, kind: "window", win: "ribbon", pitch: 1.2, sill: false }],
        left: [{ x: 0, y: 0.9, w: d - 0.8, h: 1.9, kind: "window", win: "ribbon", pitch: 1.2, sill: false }],
        right: [{ x: 0, y: 0.9, w: d - 0.8, h: 1.9, kind: "window", win: "ribbon", pitch: 1.2, sill: false }],
        label: "powerbox",
      },
      cf,
    );
    if (a.ruin < RUIN.gutted) a.box(cf, 0, cab + 0.1, 0.3, w + 2.0, 0.3, d + 2.4, "paper");
    a.sign(lb.faces.front, { kind: "enamel", text: "MERIDIAN POWER BOX" }, 0, base - 0.55, 5.0, 0.55, 0.05);
  } else {
    const hip = variant === 0;
    const cb = massing(
      a,
      {
        w,
        d,
        h: cab,
        t: 0.15,
        roof: hip ? "hip" : "gable",
        ridge: "x",
        pitch: hip ? 30 : 38,
        roofTone: "mid",
        roofOpts: { eave: 0.65, verge: 0.5 },
        front: glazing(w),
        left: [...glazing(d).map((o): Opening => ({ ...o, w: 2.0, x: 0.55, grid: [3, 2] })), { x: -1.2, y: 0, w: 0.8, h: 2.1, kind: "door", door: "plank" }],
        right: glazing(d),
        back: [W(0, 1.2, 0.8, 1.0, { win: "casement", dress: "none" })],
        label: "cabin",
      },
      cf,
    );
    weatherboard(a, cb.faces.front, w, 0, 1.0, [], 0, 0.25, "light");
    weatherboard(a, cb.faces.right, d, 0, 1.0, [], 0, 0.25, "light");
    if (litBand) {
      // The frame lamps and block shelf glow through the cabin windows.
      a.quad(cb.faces.front, 0, 1.85, -0.35, w - 1, 1.5, "pale", { accent: "amber", amt: 0.85 });
    }
    // Finials.
    if (a.ruin < RUIN.gutted) {
      for (const s of [-1, 1]) a.add(cone(0.08, 0.7, 4), cf, { tone: "mid", position: [s * (hip ? (w - d) / 2 : w / 2 + 0.5), cab + (d / 2) * Math.tan((hip ? 30 : 38) * DEG) + 0.55, 0] });
      a.add(cylinder(0.09, 0.09, 1.6, 6), cf, { tone: "deep", position: [w / 2 - 1.2, cab + 1.9, -0.8] });
      a.add(cone(0.2, 0.2, 6), cf, { tone: "deep", position: [w / 2 - 1.2, cab + 2.8, -0.8] });
    }
    // Window-cleaning walkway along the front.
    if (a.ruin < RUIN.shell) {
      a.box(cf, 0, -0.08, d / 2 + 0.35, w + 0.4, 0.08, 0.7, "light");
      for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) {
        a.beam(cf, [x, -0.9, d / 2], [x, -0.08, d / 2 + 0.65], 0.07, 0.07, "light");
        a.box(cf, x, 0, d / 2 + 0.66, 0.05, 0.95, 0.05, "light");
      }
      a.box(cf, 0, 0.92, d / 2 + 0.66, w + 0.4, 0.05, 0.05, "light");
    }
    // External stair to the door on the left end.
    const sx = -w / 2;
    if (a.ruin < RUIN.shell) {
      const sf = frame(sx - 0.7, 0, 0);
      const run = 4.2;
      for (const xx of [-0.55, 0.55]) a.beam(sf, [xx, 0, -d / 2 - run + 0.2], [xx, base, -d / 2 + 0.7], 0.06, 0.24, "light");
      const n = Math.round(base / 0.2);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        a.cbox(sf, 0, base * t, -d / 2 - run + 0.2 + (run + 0.5) * t, 1.1, 0.05, 0.28, "light");
      }
      a.box(sf, 0, base - 0.08, -d / 2 + 1.3, 1.2, 0.08, 1.4, "light");
      for (const s of [-0.55, 0.55]) a.beam(sf, [s, 1.0, -d / 2 - run + 0.2], [s, base + 1.0, -d / 2 + 0.7], 0.05, 0.05, "light");
      a.box(sf, 0, 0, -d / 2 + 1.3, 0.14, base, 0.14, "light");
    }
    a.sign(frame(0, 0, 0.02, 0, cb.faces.front), { kind: "enamel", text: variant === 0 ? "MERIDIAN JCN" : "MERIDIAN EAST" }, 0, 0.55, 3.2, 0.5, 0.03);
  }
  return { edgeZ: d / 2 + 0.7, height: 0 };
}

// -------------------------------------------------------------------- depot

export function depot(a: Arch, variant: number): Trackside {
  const g = a.rng;
  if (variant === 1) {
    // Modern portal-frame maintenance depot with roller shutters.
    const w = 27;
    const d = 58;
    const h = 8;
    const doors = [-8.5, 0, 8.5].map((x): Opening => ({ x, y: 0, w: 5.2, h: 6.6, kind: "door", door: "shutter" }));
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.3,
      tone: "paper",
      roof: "gable",
      ridge: "z",
      pitch: 8,
      roofTone: "light",
      roofOpts: { eave: 0.25, verge: 0.25, t: 0.1 },
      front: doors,
      left: [{ x: 0, y: 5.2, w: d - 8, h: 1.2, kind: "window", win: "ribbon", pitch: 3, sill: false }],
      right: [{ x: 0, y: 5.2, w: d - 8, h: 1.2, kind: "window", win: "ribbon", pitch: 3, sill: false }, { x: 18, y: 0, w: 1.0, h: 2.2, kind: "door", door: "panel", doorTone: "mid" }],
      bands: [{ y: 0, h: 1.0, p: 0.05, tone: "light" }],
      label: "shed",
    });
    // Vertical cladding ribs.
    for (const [face, len, ops] of [
      [b.faces.front, w, doors],
      [b.faces.left, d, []],
      [b.faces.right, d, []],
    ] as const) {
      for (let x = -len / 2 + 0.6; x < len / 2; x += 0.9) {
        if ((ops as readonly Opening[]).some((o) => Math.abs(o.x - x) < o.w / 2 + 0.25)) continue;
        a.quad(face, x, 3.0 + 1.0, 0.004, 0.026, 6.0, "solid");
      }
    }
    a.sign(b.faces.front, { kind: "board", text: "DEPOT 4" }, 0, 7.6, 7, 1.1, 0.05);
    for (const x of [-8.5, 0, 8.5]) railStub(a, x, d / 2 + 14, d / 2 - 6);
    // Fuel tank on cradles.
    const tf = frame(w / 2 + 4, 0, 10, Math.PI / 2);
    for (const x of [-2.5, 2.5]) a.box(tf, x, 0, 0, 0.5, 1.1, 2.2, "light");
    if (a.ruin < 0.7) a.add(cylinder(1.3, 1.3, 7.5, 16), tf, { tone: "paper", position: [0, 2.3, 0], rotation: [0, 0, Math.PI / 2] });
    return { edgeZ: d / 2, height: 0 };
  }
  if (variant === 2) {
    // Northlight workshop: a sawtooth front, glazed north faces.
    const bays = 5;
    const bayW = 6.4;
    const w = bays * bayW;
    const d = 32;
    const h = 6;
    const rise = 3.2;
    const top: P2[] = [];
    for (let i = bays; i >= 1; i--) {
      const x1 = -w / 2 + bayW * i;
      const x0 = x1 - bayW;
      top.push([x1, h], [x1, h + rise], [x0 + (i === 1 ? 0 : 0.02), h]);
    }
    const dedup = top.filter((p, i) => i === 0 || p[0] !== top[i - 1]![0] || p[1] !== top[i - 1]![1]);
    const doors: Opening[] = [{ x: -w / 2 + bayW * 1.5, y: 0, w: 4.6, h: 5.2, kind: "door", door: "sliding" }, { x: w / 2 - bayW * 1.5, y: 0, w: 4.6, h: 5.2, kind: "door", door: "sliding" }, { x: 0, y: 1.2, w: 4.4, h: 3.2, kind: "window", win: "industrial", grid: [6, 4] }];
    const ff = frame(0, 0, d / 2);
    a.wall(ff, { len: w, h, t: 0.4, top: dedup, ops: doors, label: "sawfront", bands: [{ y: 0, h: 0.7, p: 0.06, tone: "light" }] });
    a.wall(frame(0, 0, -d / 2, Math.PI), { len: w, h, t: 0.4, top: dedup.map(([x, y]) => [-x, y] as P2), ops: at([-9.6, 0, 9.6], { y: 1.4, w: 3.6, h: 3.0, kind: "window", win: "industrial", grid: [5, 4] }), label: "sawback" });
    for (const s of [-1, 1]) a.wall(frame((s * w) / 2, 0, 0, (s * Math.PI) / 2), { len: d - 0.8, h, t: 0.4, ops: [-9, -3, 3, 9].map((x) => W(x, 1.4, 3.0, 3.2, { win: "industrial", grid: [4, 4] })), label: `sawside${s}`, bands: [{ y: 0, h: 0.7, p: 0.06, tone: "light" }] });
    const r = a.ruin;
    const gs = a.fork("saw");
    for (let i = 0; i < bays; i++) {
      const x0 = -w / 2 + bayW * i;
      if (r > 0.3 && gs.next() < r) continue;
      // Shallow slope from ridge (right) down to the valley (left); glazed steep face.
      const slope = Math.hypot(bayW, rise);
      const ang = Math.atan2(rise, bayW);
      a.cbox(null, x0 + bayW / 2, h + rise / 2 + 0.08, 0, slope + 0.1, 0.12, d + 0.3, "light", { rot: [0, 0, ang] });
      const gf = frame(x0 + bayW, h, 0, Math.PI / 2);
      for (let z = -d / 2 + 0.8; z < d / 2; z += 1.2) a.quad(gf, z, rise / 2, -0.01, 0.06, rise, "paper");
      a.quad(gf, 0, rise / 2, -0.02, d, rise - 0.1, a.c.lit > 0.4 ? "pale" : "dark", a.c.lit > 0.4 ? { accent: "amber", amt: 0.7 } : {});
    }
    a.sign(ff, { kind: "painted", text: "DEPOT 4 · WORKSHOPS" }, 0, h - 0.8, 12, 0.9, 0.01);
    return { edgeZ: d / 2, height: 0 };
  }
  // Brick engine shed: three arched roads, pilasters, a smoke vent ridge.
  const roads = 3;
  const rw = 6.6;
  const w = roads * rw + 1.2;
  const d = g.range(42, 48);
  const h = 7.2;
  const pitch = 27;
  const arches = [-rw, 0, rw].map((x): Opening => ({ x, y: 0, w: 4.4, h: 5.9, kind: "door", door: "open", head: "round", dress: "arch" }));
  const sideWins: Opening[] = [];
  for (let z = -d / 2 + 3.6; z < d / 2 - 2; z += 4.5) sideWins.push({ x: z, y: 1.8, w: 1.6, h: 3.6, kind: "window", win: "industrial", head: "round", dress: "arch", lite: true });
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.6,
    roof: "gable",
    ridge: "z",
    pitch,
    roofTone: "mid",
    roofOpts: { eave: 0.35, verge: 0.3 },
    front: [...arches, { x: 0, y: h + 1.6, w: 1.6, h: 1.6, kind: "window", win: "fan", head: "round", dress: "arch" }],
    back: [...arches.map((o) => ({ ...o, door: "plank" as const, doorTone: "light" as const }))],
    left: sideWins,
    right: sideWins,
    bands: [{ y: 0, h: 0.8, p: 0.08, tone: "light" }, { y: h - 0.4, h: 0.4, p: 0.2 }],
    courses: { every: 0.45, indicate: 0.62 },
    label: "shed",
  });
  // Pilasters.
  for (const x of [-w / 2 + 0.5, -rw / 2, rw / 2, w / 2 - 0.5]) a.box(b.faces.front, x, 0, 0.16, 0.9, h, 0.32, "paper");
  for (const s of [-1, 1]) for (let z = -d / 2 + 1.35; z <= d / 2; z += 4.5) a.box(s > 0 ? b.faces.right : b.faces.left, z, 0, 0.14, 0.7, h, 0.28, "paper");
  a.sign(b.faces.front, { kind: "painted", text: "DEPOT 4" }, 0, h + 0.55, 4.6, 0.9, 0.02);
  // Smoke vent: a raised louvred ridge.
  if (a.ruin < RUIN.gutted) {
    const ry = h + (w / 2) * Math.tan(pitch * DEG);
    const vf = frame(0, ry - 0.35, 0);
    a.box(vf, 0, 0, 0, 2.4, 1.3, d - 4, "light");
    for (const s of [-1, 1]) for (let z = -d / 2 + 2.5; z < d / 2 - 2; z += 0.9) a.quad(frame(s * 1.21, 0, z, (s * Math.PI) / 2, vf), 0, 0.65, 0, 0.5, 0.9, "deep");
    a.roof(frame(0, 1.3, 0, Math.PI / 2, vf), d - 4, 2.4, { pitch: 27, eave: 0.35, verge: 0.2, t: 0.08, gutter: false, tone: "mid", label: "vent" });
  }
  for (const x of [-rw, 0, rw]) railStub(a, x, d / 2 + 16, d / 2 - 8);
  // Water crane beside the yard throat.
  const wc = frame(w / 2 + 3, 0, d / 2 + 6);
  a.add(cylinder(0.3, 0.4, 3.8, 10), wc, { tone: "mid", position: [0, 1.9, 0] });
  a.beam(wc, [0, 3.7, 0], [-2.6, 3.7, 0], 0.26, 0.26, "mid");
  a.rod(wc, [-2.6, 3.6, 0], [-2.8, 1.6, 0.2], 0.14, "deep", 6);
  return { edgeZ: d / 2, height: 0 };
}

// ---------------------------------------------------------------- warehouse

export function warehouse(a: Arch, variant: number): void {
  if (variant === 1) {
    // Railway goods shed: road canopy, sliding doors, an office lean-to.
    const w = 30;
    const d = 12;
    const h = 6;
    const doors = [-8, 0, 8].map((x): Opening => ({ x, y: 0, w: 3.4, h: 3.8, kind: "door", door: "sliding" }));
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.5,
      roof: "gable",
      ridge: "x",
      pitch: 24,
      roofTone: "mid",
      roofOpts: { eave: 0.4 },
      front: [...doors, ...[-12, -4, 4, 12].map((x) => W(x, 4.3, 1.4, 1.1, { win: "industrial", head: "segment", dress: "arch" }))],
      back: [-11, -5.5, 0, 5.5, 11].map((x) => W(x, 3.0, 1.6, 1.8, { win: "industrial", head: "segment", dress: "arch" })),
      left: [{ x: 0, y: 0, w: 4.6, h: 5.2, kind: "door", door: "open", head: "segment", dress: "arch" }],
      right: [W(0, 3.0, 1.5, 1.6, { win: "industrial" })],
      bands: [{ y: 0, h: 0.8, p: 0.08, tone: "light" }],
      label: "goods",
    });
    a.sign(b.faces.left, { kind: "painted", text: "GOODS" }, 0, h + 1.0, 3.6, 0.9, 0.02);
    for (let x = -w / 2 - 16; x < -w / 2 + 2; x += 0.7) a.box(null, x, 0, 0, 0.24, 0.14, 2.5, "light");
    for (const s of [-0.7175, 0.7175]) a.box(null, -w / 2 - 7, 0.14, s, 18, 0.14, 0.07, "mid");
    // Road-side canopy on brackets.
    if (a.ruin < RUIN.shell) {
      const cf = b.faces.front;
      a.box(cf, 0, 4.1, 1.6, w - 1, 0.14, 3.2, "light", { rot: [0.1, 0, 0] });
      for (let x = -w / 2 + 1; x < w / 2; x += 3.5) a.beam(cf, [x, 3.0, 0.05], [x, 4.05, 3.0], 0.1, 0.1, "light");
      a.box(cf, 0, 0, 1.0, w, 1.1, 2.0, "pale");
    }
    massing(a, { x: w / 2 + 2.4, z: 1, w: 4.8, d: 5, h: 3.2, t: 0.35, roof: "lean", pitch: 18, roofTone: "mid", rot: Math.PI / 2, front: [W(0, 1.0, 1.1, 1.3)], right: [{ x: 0.8, y: 0, w: 0.9, h: 2.1, kind: "door", door: "panel", doorTone: "deep" }], omit: ["back"], label: "office" });
    a.chimney(null, w / 2 + 3.5, -0.8, 2.5, 5.2, 0.6, 0.6, 1);
    return;
  }
  if (variant === 2) {
    // Modern distribution shed with dock doors.
    const w = 42;
    const d = 26;
    const h = 9.5;
    const docks = [-15, -9, -3, 3, 9].map((x): Opening => ({ x, y: 1.25, w: 3.0, h: 3.2, kind: "door", door: "shutter" }));
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.3,
      roof: "flat",
      parapet: 0.8,
      front: docks,
      back: [{ x: 0, y: 0, w: 5, h: 5, kind: "door", door: "shutter" }],
      left: [{ x: 0, y: 7.4, w: d - 4, h: 1.0, kind: "window", win: "ribbon", pitch: 3, sill: false }],
      right: [{ x: 0, y: 7.4, w: d - 4, h: 1.0, kind: "window", win: "ribbon", pitch: 3, sill: false }],
      label: "dist",
    });
    for (const [face, len, ops] of [
      [b.faces.front, w, docks],
      [b.faces.left, d - 0.6, []],
      [b.faces.right, d - 0.6, []],
    ] as const) {
      for (let y = 1.0; y < h + 0.6; y += 1.05) {
        const spans: Array<[number, number]> = [];
        let x = -len / 2;
        for (const o of [...(ops as readonly Opening[])].sort((p, q) => p.x - q.x)) {
          if (y > o.y - 0.1 && y < o.y + o.h + 0.5) {
            spans.push([x, o.x - o.w / 2 - 0.2]);
            x = o.x + o.w / 2 + 0.2;
          }
        }
        spans.push([x, len / 2]);
        for (const [p, q] of spans) if (q - p > 0.2) a.quad(face, (p + q) / 2, y, 0.004, q - p, 0.026, "solid");
      }
    }
    for (const x of [-15, -9, -3, 3, 9]) {
      a.box(b.faces.front, x, 0, 0.5, 3.4, 1.25, 1.0, "light");
      for (const s of [-1, 1]) a.box(b.faces.front, x + s * 1.55, 1.0, 0.1, 0.25, 0.4, 0.2, "deep");
      if (a.ruin < RUIN.shell) a.box(b.faces.front, x, 4.7, 0.6, 3.6, 0.12, 1.2, "paper");
    }
    massing(a, { x: w / 2 - 5, z: d / 2 + 3, w: 10, d: 6, h: 7, t: 0.25, roof: "flat", parapet: 0.4, front: [{ x: 0, y: 0.8, w: 8.5, h: 2.2, kind: "window", win: "ribbon", pitch: 1.4 }, { x: 0, y: 4.2, w: 8.5, h: 2.2, kind: "window", win: "ribbon", pitch: 1.4 }], right: [{ x: 0, y: 0, w: 1.8, h: 2.4, kind: "door", door: "glazed" }], omit: ["back"], label: "officeblock" });
    a.sign(b.faces.front, { kind: "board", text: "UNIT 7" }, -17.5, h - 1.2, 3.6, 1.1, 0.05);
    return;
  }
  // Victorian four-storey warehouse with stacked loading doors and a lucam.
  const w = 22;
  const d = 14;
  const storeys = 4;
  const sh = 3.3;
  const h = storeys * sh + 0.4;
  const front: Opening[] = [];
  for (let s = 0; s < storeys; s++) {
    for (const x of [-8.4, -4.8, 4.8, 8.4]) front.push(W(x, s * sh + 0.9, 1.3, 1.8, { win: "industrial", head: "segment", dress: "arch", grid: [3, 3] }));
    front.push({ x: 0, y: s === 0 ? 1.2 : s * sh + 0.3, w: 2.0, h: s === 0 ? 2.8 : 2.4, kind: "door", door: "double" });
  }
  const back: Opening[] = [];
  for (let s = 0; s < storeys; s++) for (const x of [-7.5, -2.5, 2.5, 7.5]) back.push(W(x, s * sh + 0.9, 1.3, 1.8, { win: "industrial", head: "segment", lite: true }));
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.55,
    roof: "gable",
    ridge: "x",
    pitch: 30,
    roofTone: "mid",
    front,
    back,
    left: [0, 1, 2, 3].map((s) => W(0, s * sh + 0.9, 1.3, 1.8, { win: "industrial", head: "segment", lite: true })),
    right: [0, 1, 2, 3].map((s) => W(0, s * sh + 0.9, 1.3, 1.8, { win: "industrial", head: "segment", lite: true })),
    bands: [{ y: 0, h: 1.2, p: 0.08, tone: "light" }, { y: h - 0.35, h: 0.35, p: 0.2 }],
    label: "warehouse",
  });
  a.sign(b.faces.front, { kind: "painted", text: "HOLT & SONS", sub: "GRAIN · SEED · FEED" }, -6.6, h - 1.6, 6.4, 1.3, 0.01);
  a.sign(b.faces.front, { kind: "painted", text: "EST. 1879" }, 6.6, h - 1.35, 3.6, 0.7, 0.01);
  if (a.ruin < RUIN.gutted) {
    massing(a, { z: d / 2 + 0.6, w: 3.2, d: 1.2, h: 2.2, t: 0.15, roof: "gable", ridge: "z", pitch: 40, roofTone: "mid", roofOpts: { eave: 0.2, verge: 0.2, gutter: false }, omit: ["back"], label: "cathead" }, frame(0, h - 0.8, 0));
    a.beam(null, [0, h + 1.2, d / 2 + 1.1], [0, h + 1.2, d / 2 + 2.3], 0.2, 0.22, "light");
    a.rod(null, [0, h + 1.1, d / 2 + 2.2], [0, 2.5, d / 2 + 2.2], 0.02, "deep", 4);
    a.box(null, 0, 2.2, d / 2 + 2.2, 0.5, 0.35, 0.4, "light");
  }
  // Loading dock and a canopy on brackets.
  a.box(b.faces.front, 0, 0, 1.2, w - 2, 1.2, 2.4, "pale");
  if (a.ruin < RUIN.shell) {
    a.box(b.faces.front, 0, 4.15, 1.4, w - 2, 0.12, 2.8, "light", { rot: [0.12, 0, 0] });
    for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 3.3) a.beam(b.faces.front, [x, 3.0, 0.05], [x, 4.1, 2.6], 0.1, 0.1, "light");
    for (let i = 0; i < 6; i++) a.box(b.faces.front, -6 + (i % 3) * 0.9, 1.2 + Math.floor(i / 3) * 0.55, 1.4, 0.8, 0.5, 0.6, "light");
  }
}

// ---------------------------------------------------------- dispatch office

export function dispatchOffice(a: Arch, variant: number): Trackside {
  if (variant === 1) {
    // Victorian office with an oriel over the line and a later radio mast.
    const w = 12;
    const d = 8;
    const h = 6.6;
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.45,
      roof: "gable",
      ridge: "x",
      pitch: 40,
      roofTone: "mid",
      front: [W(-3.5, 1.0, 1.1, 1.7, { head: "segment", dress: "arch" }), { x: 0, y: 0, w: 1.1, h: 2.4, kind: "door", door: "panel", doorTone: "deep", dress: "hood" }, W(3.5, 1.0, 1.1, 1.7, { head: "segment", dress: "arch" }), W(-3.5, 4.2, 1.1, 1.5, { head: "segment", dress: "arch" })],
      back: [W(-3, 1.0, 1.1, 1.6), W(3, 1.0, 1.1, 1.6), W(0, 4.2, 1.1, 1.4)],
      left: [W(0, 1.0, 1.0, 1.6), W(0, 4.2, 1.0, 1.4)],
      right: [W(0, 4.2, 1.0, 1.4)],
      bands: [{ y: 0, h: 0.45, p: 0.06, tone: "light" }, { y: 3.4, h: 0.16, p: 0.06 }],
      quoins: true,
      pipes: true,
      label: "office",
    });
    a.chimney(b.f, -w / 2 + 0.6, 0, h - 1, b.top + 1.0, 0.9, 0.6, 2);
    // Oriel: a glazed box cantilevered over the line on brackets.
    const of = frame(2.8, 0, 0, 0, b.faces.front);
    if (a.ruin < RUIN.shell) {
      a.box(of, 0, 3.5, 0.65, 3.8, 0.3, 1.3, "paper");
      for (const s of [-1, 1]) a.beam(of, [s * 1.6, 2.3, 0.05], [s * 1.6, 3.5, 1.2], 0.14, 0.14, "paper");
      const lit = a.c.night > 0.3 && a.c.ruin < 0.35 && !a.sealed;
      a.box(of, 0, 3.8, 0.65, 3.6, 2.0, 1.2, lit ? "pale" : a.sealed ? "light" : "dark", lit ? { accent: "amber", amt: 0.85 } : {});
      for (let x = -1.5; x <= 1.5; x += 0.75) a.box(of, x, 3.8, 1.27, 0.08, 2.0, 0.04, "paper");
      a.box(of, 0, 5.8, 0.65, 4.0, 0.3, 1.45, "paper");
    }
    a.sign(b.faces.front, { kind: "board", text: "DISPATCH OFFICE" }, -2.4, 2.9, 3.2, 0.42, 0.05);
    radioMast(a, w / 2 + 3.2, -1.5, 0, 19, 7);
    // Relay room lean-to.
    massing(a, { x: -w / 2 - 2.2, w: 4.4, d: 6, h: 3.0, t: 0.3, roof: "flat", parapet: 0.3, rot: 0, front: [{ x: 0, y: 0, w: 0.9, h: 2.1, kind: "door", door: "panel", doorTone: "mid" }], left: [W(0, 1.2, 1.0, 0.8, { win: "industrial" })], omit: ["right"], label: "relay" });
    return { edgeZ: d / 2 + 1.3, height: 0 };
  }
  // Streamline moderne control office: ribbon windows, a round stair tower,
  // a clock, lettering on the parapet, a lattice radio mast.
  const w = 17;
  const d = 10;
  const h = 7.4;
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.35,
    roof: "flat",
    parapet: 0.8,
    front: [{ x: -1.5, y: 0.9, w: 11, h: 1.6, kind: "window", win: "ribbon", pitch: 1.1 }, { x: -1.5, y: 4.4, w: 11, h: 1.9, kind: "window", win: "ribbon", pitch: 1.1 }, { x: 6.3, y: 0, w: 1.8, h: 2.5, kind: "door", door: "glazed" }],
    back: [{ x: 0, y: 0.9, w: 12, h: 1.4, kind: "window", win: "ribbon", pitch: 1.5 }, { x: 0, y: 4.4, w: 12, h: 1.4, kind: "window", win: "ribbon", pitch: 1.5 }],
    right: [{ x: 0, y: 4.4, w: 6, h: 1.9, kind: "window", win: "ribbon", pitch: 1.1 }],
    bands: [{ y: 0.5, h: 0.12, p: 0.05 }, { y: 2.8, h: 0.2, p: 0.08 }, { y: 3.9, h: 0.12, p: 0.05 }, { y: 6.6, h: 0.2, p: 0.08 }],
    label: "control",
  });
  // Round stair tower at the front-left corner.
  const tx = -w / 2 + 0.6;
  const tz = d / 2 - 0.6;
  const tr = 2.3;
  const th = h + 3.4;
  const r = a.ruin;
  const tTop = r >= RUIN.gutted ? th * (1 - smooth(0.5, 1, r) * 0.5) : th;
  a.add(cylinder(tr, tr, tTop, 20), null, { tone: "paper", position: [tx, tTop / 2, tz] });
  for (const y of [2.8, 6.6]) a.add(cylinder(tr + 0.07, tr + 0.07, 0.2, 20, true), null, { tone: "paper", position: [tx, y + 0.1, tz] });
  const lit = a.c.lit > 0.3;
  for (let k = -1; k <= 1; k++) {
    const ang = -0.3 + k * 0.28;
    const wf = frame(tx + Math.sin(ang) * tr, 0, tz + Math.cos(ang) * tr, ang);
    a.box(wf, 0, 1.0, -0.05, 0.5, Math.min(tTop - 1.6, th - 2.2), 0.12, lit ? "pale" : a.sealed ? "light" : "dark", lit ? { accent: "amber", amt: 0.8 } : {});
  }
  if (tTop >= th) {
    a.add(cylinder(tr + 0.2, tr + 0.2, 0.25, 20), null, { tone: "pale", position: [tx, th + 0.12, tz] });
    const cf = frame(tx + 0.5, 0, tz + tr - 0.35, 0.35);
    a.cbox(cf, 0, th - 1.5, 0.4, 1.9, 1.9, 0.2, "paper");
    a.sign(cf, { kind: "clock", text: r > 0.2 ? "03:14" : "06:40" }, 0, th - 1.5, 1.6, 1.6, 0.52, false, new THREE.CircleGeometry(0.8, 20));
  }
  a.sign(b.faces.front, { kind: "painted", text: "RAIL DISPATCH" }, 1.5, h + 0.4, 7.5, 0.72, 0.02);
  // Canopy over the door.
  if (r < RUIN.shell) a.box(b.faces.front, 6.3, 2.75, 0.7, 2.8, 0.14, 1.4, "paper");
  radioMast(a, 4, -1.5, h + 0.8, 13);
  return { edgeZ: d / 2, height: 0 };
}

/** Square lattice radio mast with guy wires and a dish or two. */
function radioMast(a: Arch, x: number, z: number, y0: number, h: number, reach = 3.4): void {
  if (a.ruin > 0.7) return;
  const s = 0.45;
  const lean = a.ruin > 0.35 ? 0.12 : 0;
  const corners: Array<[number, number]> = [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s],
  ];
  for (const [cx, cz] of corners) a.rod(null, [x + cx, y0, z + cz], [x + cx * 0.6 + lean * h, y0 + h, z + cz * 0.6], 0.035, "mid", 4);
  for (let y = 1.2; y < h; y += 1.3) {
    const t = y / h;
    const k = 1 - 0.4 * t;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i]!;
      const [bx, bz] = corners[(i + 1) % 4]!;
      a.rod(null, [x + ax * k + lean * y, y0 + y, z + az * k], [x + bx * (k - 0.05) + lean * (y + 1.2), y0 + y + 1.2, z + bz * (k - 0.05)], 0.015, "mid", 3);
    }
  }
  for (const [cx, cz] of corners) a.rod(null, [x + lean * h * 0.8, y0 + h * 0.8, z], [x + (cx / s) * reach, y0, z + (cz / s) * reach], 0.008, "mid", 3);
  a.add(cylinder(0.02, 0.02, 3, 4), null, { tone: "mid", position: [x + lean * h, y0 + h + 1.5, z] });
  const df = frame(x + 0.4 + lean * h * 0.85, y0 + h * 0.85, z + 0.3, 0.6);
  a.add(new THREE.SphereGeometry(0.55, 10, 5, 0, Math.PI * 2, 0, Math.PI / 3), df, { tone: "paper", rotation: [Math.PI / 2, 0, 0] });
}

// ------------------------------------------------------------------- bridge

export function bridge(a: Arch, variant: number): BridgeSpec {
  if (variant === 1) return trussBridge(a);
  if (variant === 2) return girderBridge(a);
  // Masonry arch viaduct: three round arches, cutwater piers, parapets.
  const arches = 3;
  const span = 12;
  const pier = 2.6;
  const abut = 5;
  const H = 12;
  const deckW = 7.4;
  const L = arches * span + (arches - 1) * pier + abut * 2;
  const deckTop = H;
  // The elevation is one thick wall (the deck width) with arch notches cut
  // from its base: the soffits become real barrel vaults.
  const spring = 5.5;
  const ops: Opening[] = [];
  for (let i = 0; i < arches; i++) {
    const zc = -L / 2 + abut + span / 2 + i * (span + pier);
    ops.push({ x: zc, y: 0, w: span, h: spring + span / 2, kind: "door", door: "open", head: "round", bare: true });
  }
  const f = frame(deckW / 2, 0, 0, Math.PI / 2);
  a.wall(f, { len: L, h: deckTop, t: deckW, ops, label: "viaduct", bands: [{ y: deckTop - 1.3, h: 0.35, p: 0.22, tone: "pale" }], courses: { every: 0.62, block: 1.5, indicate: 0.3, w: 0.075, to: deckTop - 1.4 } });
  // Voussoir rings on both faces.
  for (const side of [1, -1]) {
    const ff = frame((side * deckW) / 2, 0, 0, (side * Math.PI) / 2);
    for (const o of ops) {
      const r0 = o.w / 2;
      const r1 = r0 + 0.8;
      const cy = spring;
      const pts: P2[] = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const t = (Math.PI * i) / n;
        pts.push([o.x * side + Math.cos(t) * r1, cy + Math.sin(t) * r1]);
      }
      for (let i = n; i >= 0; i--) {
        const t = (Math.PI * i) / n;
        pts.push([o.x * side + Math.cos(t) * r0, cy + Math.sin(t) * r0]);
      }
      a.add(extrude(pts, 0.12), ff, { tone: "pale", position: [0, 0, 0.06] });
      a.box(ff, o.x * side, spring + r0 - 0.1, 0.1, 0.8, 1.1, 0.2, "pale");
      // Voussoir joints radiating from the arch centre.
      const nv = 17;
      for (let i = 1; i < nv; i++) {
        const t = (Math.PI * i) / nv;
        const rm = (r0 + r1) / 2;
        if (Math.abs(t - Math.PI / 2) < 0.12) continue;
        a.quad(ff, o.x * side + Math.cos(t) * rm, cy + Math.sin(t) * rm, 0.125, 0.065, r1 - r0, "solid", { rotZ: t - Math.PI / 2 });
      }
    }
    // Cutwaters on the piers, with pilasters rising to the parapet.
    for (let i = 0; i < arches - 1; i++) {
      const zc = (-L / 2 + abut + span + pier / 2 + i * (span + pier)) * side;
      a.add(extrude([[-pier / 2, 0], [pier / 2, 0], [0, 2.2]], spring - 0.6), frame(zc, 0, 0, 0, ff), { tone: "paper", position: [0, (spring - 0.6) / 2, 0], rotation: [Math.PI / 2, 0, 0] });
      a.add(cone(pier / 2 + 0.05, 1.4, 4), frame(zc, spring - 0.6, 1.0, 0, ff), { tone: "light", position: [0, 0.7, 0], rotation: [0, Math.PI / 4, 0], scale: [1, 1, 0.9] });
      a.box(ff, zc, spring + 0.8, 0.15, pier - 0.4, deckTop - spring - 2.1, 0.3, "paper");
    }
  }
  // Parapets with coping.
  for (const s of [-1, 1]) {
    a.box(null, (s * (deckW - 0.5)) / 2, deckTop - 0.6, 0, 0.5, 1.7, L, "paper");
    a.box(null, (s * (deckW - 0.5)) / 2, deckTop + 1.1, 0, 0.66, 0.16, L + 0.1, "pale");
  }
  // Wing walls splaying out at the abutments.
  for (const e of [-1, 1]) for (const s of [-1, 1]) a.box(frame((s * (deckW + 3.5)) / 2, 0, (e * L) / 2 - e * 1.5, s * e * 0.5), 0, 0, 0, 0.9, deckTop + 0.4, 6, "paper");
  if (a.ruin >= RUIN.shell) {
    // A broken span: the middle arch's crown gone.
    a.rubble(null, 0, 0, deckW * 0.6, span * 0.4, 1, "span", 3);
  }
  return { span: L - abut * 2, length: L, deckHeight: deckTop, deckWidth: deckW - 1.0, axis: "z", kind: "masonry-arch" };
}

function trussBridge(a: Arch): BridgeSpec {
  // Two Pratt through-truss spans on masonry piers and abutments.
  const spans = 2;
  const sl = 30;
  const H = 10;
  const deckW = 5.4;
  const th = 6.2;
  const panels = 6;
  const pierW = 3;
  const L = spans * sl + (spans - 1) * pierW;
  const r = a.ruin;
  const g = a.fork("truss");
  // Masonry.
  for (const z of [-L / 2 - 2.5, L / 2 + 2.5]) a.box(null, 0, 0, z, deckW + 3, H - 0.25, 5, "paper");
  for (let i = 1; i < spans; i++) {
    const zc = -L / 2 + i * sl + (i - 0.5) * pierW;
    a.box(null, 0, 0, zc, deckW + 1.8, H - 0.9, pierW, "paper");
    for (const s of [-1, 1]) a.add(extrude([[-pierW / 2, 0], [pierW / 2, 0], [0, 2.0]], H - 0.9), frame((s * (deckW + 1.8)) / 2, (H - 0.9) / 2, zc, (s * Math.PI) / 2), { tone: "paper", rotation: [Math.PI / 2, 0, 0] });
    a.box(null, 0, H - 1.0, zc, deckW + 2.2, 0.3, pierW + 0.4, "pale");
  }
  const bottom = H - 0.4;
  for (let sIdx = 0; sIdx < spans; sIdx++) {
    const z0 = -L / 2 + sIdx * (sl + pierW);
    const brokenSpan = r >= RUIN.shell && sIdx === 1;
    const sag = brokenSpan ? 4 : 0;
    const y = (z: number) => bottom - sag * Math.sin(((z - z0) / sl) * Math.PI);
    // Deck and floor beams.
    if (!brokenSpan || g.next() < 0.5) a.box(null, 0, y(z0 + sl / 2) - 0.25, z0 + sl / 2, deckW, 0.4, sl, "light");
    for (const side of [-1, 1]) {
      const x = (side * deckW) / 2;
      const pts: V3[] = [];
      for (let p = 0; p <= panels; p++) pts.push([x, y(z0 + (sl * p) / panels), z0 + (sl * p) / panels]);
      // Bottom chord.
      for (let p = 0; p < panels; p++) a.beam(null, pts[p]!, pts[p + 1]!, 0.3, 0.35, "mid");
      // Top chord (between the end posts) and inclined end posts.
      const top = (p: number): V3 => [x, y(z0 + (sl * p) / panels) + th, z0 + (sl * p) / panels];
      for (let p = 1; p < panels - 1; p++) if (!(r > 0.4 && g.next() < r - 0.3)) a.beam(null, top(p), top(p + 1), 0.34, 0.34, "mid");
      a.beam(null, pts[0]!, top(1), 0.34, 0.34, "mid");
      a.beam(null, pts[panels]!, top(panels - 1), 0.34, 0.34, "mid");
      // Verticals and Pratt diagonals toward the centre.
      for (let p = 1; p < panels; p++) {
        if (r > 0.4 && g.next() < r - 0.3) continue;
        a.beam(null, pts[p]!, top(p), 0.18, 0.22, "mid");
        const toward = p < panels / 2 ? p + 1 : p - 1;
        if (p !== panels / 2 || true) {
          if (p < panels / 2) a.beam(null, top(p), pts[toward]!, 0.14, 0.14, "mid");
          else if (p > panels / 2) a.beam(null, top(p), pts[toward]!, 0.14, 0.14, "mid");
        }
      }
    }
    // Top lateral bracing and portal struts.
    for (let p = 1; p < panels; p++) {
      const zz = z0 + (sl * p) / panels;
      if (r > 0.4 && g.next() < r) continue;
      a.beam(null, [-deckW / 2, y(zz) + th, zz], [deckW / 2, y(zz) + th, zz], 0.16, 0.2, "mid");
      if (p < panels - 1) {
        const z2 = z0 + (sl * (p + 1)) / panels;
        a.beam(null, [-deckW / 2, y(zz) + th, zz], [deckW / 2, y(z2) + th, z2], 0.06, 0.06, "mid");
      }
    }
    for (const pz of [1, panels - 1]) {
      const zz = z0 + (sl * pz) / panels;
      a.beam(null, [-deckW / 2, y(zz) + th - 1.2, zz], [deckW / 2, y(zz) + th - 1.2, zz], 0.3, 0.9, "mid");
    }
  }
  return { span: L, length: L + 10, deckHeight: bottom + 0.15, deckWidth: deckW - 0.6, axis: "z", kind: "through-truss" };
}

function girderBridge(a: Arch): BridgeSpec {
  // Low plate-girder bridge: three spans on stone piers over a small river.
  const spans = 3;
  const sl = 14;
  const H = 5.5;
  const deckW = 4.8;
  const gh = 1.6;
  const L = spans * sl;
  const r = a.ruin;
  for (const z of [-L / 2 - 2, L / 2 + 2]) a.box(null, 0, 0, z, deckW + 2.4, H - 0.15, 4, "paper");
  for (let i = 1; i < spans; i++) {
    const zc = -L / 2 + i * sl;
    a.box(null, 0, 0, zc, deckW + 1.2, H - 0.3, 1.8, "paper");
    a.box(null, 0, H - 0.4, zc, deckW + 1.5, 0.25, 2.1, "pale");
    for (const s of [-1, 1]) a.add(extrude([[-0.9, 0], [0.9, 0], [0, 1.6]], H - 0.3), frame((s * (deckW + 1.2)) / 2, (H - 0.3) / 2, zc, (s * Math.PI) / 2), { tone: "paper", rotation: [Math.PI / 2, 0, 0] });
  }
  for (let i = 0; i < spans; i++) {
    const zc = -L / 2 + sl * (i + 0.5);
    const broken = r >= RUIN.shell && i === 1;
    const drop = broken ? 3 : 0;
    const tilt = broken ? 0.18 : 0;
    for (const s of [-1, 1]) {
      const f = frame((s * deckW) / 2, H - 0.15 - drop, zc);
      a.cbox(f, 0, gh / 2 - 0.3, 0, 0.22, gh, sl - 0.1, "light", { rot: [tilt, 0, 0] });
      a.cbox(f, 0, gh - 0.3, 0, 0.5, 0.06, sl - 0.1, "mid", { rot: [tilt, 0, 0] });
      a.cbox(f, 0, -0.3, 0, 0.5, 0.06, sl - 0.1, "mid", { rot: [tilt, 0, 0] });
      for (let z = -sl / 2 + 1.2; z < sl / 2; z += 1.4) a.quad(frame(s * 0.12, 0, z, (s * Math.PI) / 2, f), 0, gh / 2 - 0.3, 0, 0.035, gh - 0.1, "solid");
    }
    a.box(frame(0, H - 0.45 - drop, zc), 0, 0, 0, deckW, 0.3, sl - 0.1, "light", { rot: [tilt, 0, 0] });
  }
  return { span: L, length: L + 8, deckHeight: H - 0.15, deckWidth: deckW - 0.4, axis: "z", kind: "plate-girder" };
}

export type { Tone };
void Kit;
