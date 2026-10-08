/**
 * Refuge structures: the gated emergency shelter (a school, a clinic and a
 * garden behind a fence residents cannot open) and the relief camp.
 *
 * The shelter is Morrow's: its fence and gate are immaculate, its fence tops
 * crank inward (it keeps people in, not out), and its cameras carry the
 * cobalt status light. Inside, it is inhabited: windows are lit after dark
 * and the garden is the one patch of living green left in the scene.
 */
import * as THREE from "three";
import { cone, cylinder, extrude, jitter } from "../../core/geometry.ts";
import type { Arch, M4, Opening, V3 } from "./arch.ts";
import { at, frame } from "./arch.ts";
import { RUIN } from "./condition.ts";
import { growthFrom } from "./flora.ts";
import { massing } from "./massing.ts";
import { garden } from "./rural.ts";
import { clinicPost } from "./town.ts";

const W = (x: number, y: number, w: number, h: number, extra: Partial<Opening> = {}): Opening => ({ x, y, w, h, kind: "window", win: "sash", ...extra });

// -------------------------------------------------------------- shelter fence

/** Weld-mesh security fence segments, tops cranked toward `inward`. */
function securityFence(a: Arch, segments: Array<[number, number, number, number]>, inward: [number, number], h = 3.2): void {
  const g = a.fork("fence");
  const breach = a.c.ruin;
  for (const [x0, z0, x1, z1] of segments) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.1) continue;
    const dx = (x1 - x0) / len;
    const dz = (z1 - z0) / len;
    // Inward normal: the side of the segment facing the compound centre.
    let nx = -dz;
    let nz = dx;
    if (nx * (inward[0] - (x0 + x1) / 2) + nz * (inward[1] - (z0 + z1) / 2) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const n = Math.max(1, Math.round(len / 3.6));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (breach > 0.5 && g.next() < (breach - 0.4) * 0.6) continue;
      a.box(null, x, 0, z, 0.12, h, 0.12, "mid");
      // Cranked top, leaning over the inside.
      a.beam(null, [x, h - 0.05, z], [x + nx * 0.55, h + 0.55, z + nz * 0.55], 0.06, 0.06, "mid");
    }
    for (const y of [0.1, h * 0.5, h - 0.1]) a.beam(null, [x0, y, z0], [x1, y, z1], 0.05, 0.05, "mid");
    for (let s = 0; s < 3; s++) {
      const off = 0.18 + s * 0.18;
      a.rod(null, [x0 + nx * off, h + off, z0 + nz * off], [x1 + nx * off, h + off, z1 + nz * off], 0.012, "deep", 3);
    }
    // Mesh wires: the fence reads as a grey veil at distance.
    const m = Math.max(1, Math.round(len / 1.8));
    for (let k = 0; k < m; k++) {
      const t = (k + 0.5) / m;
      if (breach > 0.55 && g.next() < breach - 0.45) continue;
      a.add(cylinder(0.014, 0.014, h - 0.2, 3, true), null, { tone: "deep", position: [x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t] });
    }
  }
}

function floodlight(a: Arch, x: number, z: number, aim: number, h = 10): void {
  a.add(cylinder(0.12, 0.18, h, 8), null, { tone: "light", position: [x, h / 2, z] });
  a.box(null, x, 0, z, 0.6, 0.4, 0.6, "pale");
  const on = a.c.night > 0.3 && a.c.ruin < 0.6;
  const hf = frame(x, h, z, aim);
  a.box(hf, 0, 0, 0, 1.4, 0.12, 0.2, "mid");
  for (const s of [-0.45, 0.45]) a.cbox(hf, s, -0.15, 0.25, 0.5, 0.36, 0.3, on ? "pale" : "light", { rot: [0.5, 0, 0], ...(on ? { accent: "amber" as const, amt: 0.95 } : {}) });
  camera(a, frame(x, h - 1.4, z, aim + 0.4));
}

/** A camera on a bracket with the cobalt status dot. */
function camera(a: Arch, f: M4): void {
  a.box(f, 0, 0, 0.1, 0.08, 0.08, 0.3, "mid");
  a.cbox(f, 0, 0.1, 0.4, 0.22, 0.2, 0.5, "paper", { rot: [0.3, 0, 0] });
  a.cbox(f, 0.06, 0.2, 0.63, 0.05, 0.05, 0.05, "paper", { accent: "cobalt", amt: 1 });
}

// ------------------------------------------------------------------- shelter

export function shelter(a: Arch, variant: number): void {
  const c = a.c;
  const W2 = variant === 0 ? 72 : 56;
  const D2 = variant === 0 ? 54 : 44;
  const gateW = 7;
  const gz = D2 / 2;
  const inside = {
    sealed: false,
    identical: true,
    abandoned: 0,
    ruin: c.ruin * 0.5,
    lit: Math.max(c.lit, c.night * 0.7),
    order: 0,
  };
  // The fence and gate are always maintained.
  a.withCondition({ ruin: c.ruin * 0.35, sealed: false }, () => {
    const gx = gateW / 2 + 0.4;
    securityFence(
      a,
      [
        [-W2 / 2, gz, -gx, gz],
        [gx, gz, W2 / 2, gz],
        [W2 / 2, gz, W2 / 2, -D2 / 2],
        [W2 / 2, -D2 / 2, -W2 / 2, -D2 / 2],
        [-W2 / 2, -D2 / 2, -W2 / 2, gz],
      ],
      [0, 0],
    );
    // Gate: two mesh leaves between heavy posts, under a gantry.
    for (const s of [-1, 1]) {
      a.box(null, (s * gateW) / 2 + s * 0.2, 0, gz, 0.4, 4.4, 0.4, "paper");
      const lf = frame((s * gateW) / 4, 0, gz);
      a.box(lf, 0, 0.1, 0, gateW / 2 - 0.1, 0.08, 0.08, "mid");
      a.box(lf, 0, 3.0, 0, gateW / 2 - 0.1, 0.08, 0.08, "mid");
      a.box(lf, 0, 1.55, 0, gateW / 2 - 0.1, 0.06, 0.06, "mid");
      for (let k = 0; k <= 8; k++) a.add(cylinder(0.02, 0.02, 3.0, 3, true), lf, { tone: "deep", position: [-gateW / 4 + 0.05 + (k * (gateW / 2 - 0.1)) / 8, 1.6, 0] });
      a.cbox(lf, 0, 1.55, 0, Math.hypot(gateW / 2, 2.9) - 0.2, 0.06, 0.06, "mid", { rot: [0, 0, Math.atan2(2.9, gateW / 2) * s] });
    }
    // Lock box with the cobalt light, and a camera on each post.
    a.box(null, 0.12, 1.2, gz + 0.12, 0.3, 0.4, 0.18, "light");
    a.cbox(null, 0.12, 1.5, gz + 0.22, 0.08, 0.05, 0.03, "paper", { accent: "cobalt", amt: 1 });
    for (const s of [-1, 1]) camera(a, frame((s * gateW) / 2 + s * 0.2, 4.2, gz + 0.1, s * 0.5));
    a.box(null, 0, 4.4, gz, gateW + 1.2, 0.5, 0.4, "paper");
    a.sign(frame(0, 0, gz + 0.2), { kind: "enamel", text: "PROTECTED SETTLEMENT 7" }, 0, 4.65, 6.4, 0.62, 0.05);
    // The notice: once facing the line, once facing the residents.
    const nf = frame(gateW / 2 + 2.6, 0, gz + 0.6);
    for (const s of [-0.7, 0.7]) a.box(nf, s, 0, 0, 0.1, 2.1, 0.1, "mid");
    a.sign(nf, { kind: "notice", text: "NOTICE", sub: "YOUR SAFETY REMAINS THE PRIORITY" }, 0, 1.75, 1.7, 1.25, 0.07);
    a.sign(frame(-gateW / 2 - 2.6, 0, gz - 0.6, Math.PI), { kind: "notice", text: "NOTICE", sub: "YOUR SAFETY REMAINS THE PRIORITY" }, 0, 1.75, 1.7, 1.25, 0.07);
    for (const s of [-0.7, 0.7]) a.box(frame(-gateW / 2 - 2.6, 0, gz - 0.6, Math.PI), s, 0, 0, 0.1, 2.1, 0.1, "mid");
    // Floodlights.
    const lights: Array<[number, number, number]> = [
      [-W2 / 2 + 1, gz - 1, -2.4],
      [W2 / 2 - 1, gz - 1, 2.4],
      [W2 / 2 - 1, -D2 / 2 + 1, 0.8],
      [-W2 / 2 + 1, -D2 / 2 + 1, -0.8],
    ];
    for (const [x, z, aim] of lights) floodlight(a, x, z, aim);
  });
  // Inside: inhabited, lit, tended.
  a.withCondition(inside, () => {
    // Paths.
    a.box(null, 0, 0, gz / 2 - 2, 3, 0.03, gz + 2, "pale");
    a.box(null, 0, 0, -4, W2 - 16, 0.03, 2.6, "pale");
    if (variant === 0) {
      a.within(frame(-17, 0, 9), () => shelterSchool(a, 24));
      a.within(frame(19, 0, 10), () => clinicPost(a));
      a.within(frame(0, 0, -1.5, 0), () => garden(a, 0, true));
      for (const x of [-18, 18]) a.within(frame(x, 0, -17), () => housingBlock(a, 26, `h${x}`));
      // Water tank on a stand.
      const tf = frame(W2 / 2 - 6, 0, -D2 / 2 + 7);
      for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) a.box(tf, sx, 0, sz, 0.18, 7, 0.18, "light");
      a.add(cylinder(2.0, 2.0, 3.2, 16), tf, { tone: "paper", position: [0, 8.6, 0] });
      a.add(cone(2.2, 0.8, 16), tf, { tone: "light", position: [0, 10.6, 0] });
    } else {
      a.within(frame(-12, 0, 7), () => shelterSchool(a, 20));
      a.within(frame(12, 0, 6), () => garden(a, 1, true));
      for (let i = 0; i < 4; i++) a.within(frame(-18 + i * 11, 0, -13, 0), () => nissen(a, `n${i}`));
    }
    // An empty flagpole by the path: nothing is flown here.
    a.add(cylinder(0.06, 0.09, 9, 6), null, { tone: "mid", position: [3.4, 4.5, gz - 5] });
    a.add(new THREE.SphereGeometry(0.12, 6, 4), null, { tone: "mid", position: [3.4, 9.05, gz - 5] });
  });
}

/** A single-storey school with its long glazed wall to the light (+Z). */
function shelterSchool(a: Arch, L: number): void {
  const d = 9;
  const h = 3.8;
  const b = massing(a, {
    w: L,
    d,
    h,
    t: 0.3,
    roof: "lean",
    pitch: 8,
    roofTone: "light",
    roofOpts: { eave: 1.2, verge: 0.5, t: 0.1 },
    front: [{ x: -1.2, y: 0.7, w: L - 5, h: 2.4, kind: "window", win: "ribbon", pitch: 1.35 }, { x: L / 2 - 1.5, y: 0, w: 1.8, h: 2.4, kind: "door", door: "glazed" }],
    back: [{ x: 0, y: h + 0.3, w: L - 3, h: 0.8, kind: "window", win: "ribbon", pitch: 1.6, sill: false }],
    left: [W(0, 1.0, 1.4, 1.4, { win: "casement", dress: "none" })],
    right: [W(0, 1.0, 1.4, 1.4, { win: "casement", dress: "none" })],
    label: "sschool",
  });
  a.sign(b.faces.front, { kind: "board", text: "SCHOOL" }, -1.2, h + 0.25, 2.6, 0.5, 0.45);
  for (let i = 0; i <= 4; i++) a.box(b.faces.front, -L / 2 + 0.4 + i * ((L - 5.5) / 4), 0, 0.3, 0.16, h + 0.1, 0.6, "paper");
}

/** Two-storey modular housing with an open gallery and stairs. */
function housingBlock(a: Arch, L: number, label: string): void {
  const d = 8;
  const h = 6.2;
  const units = Math.round(L / 4);
  const front: Opening[] = [];
  for (let s = 0; s < 2; s++)
    for (let u = 0; u < units; u++) {
      const x = -L / 2 + (L / units) * (u + 0.5);
      front.push({ x: x - 0.9, y: s * 3.1, w: 0.95, h: 2.1, kind: "door", door: "flush", doorTone: "light" });
      front.push(W(x + 0.6, s * 3.1 + 0.95, 1.4, 1.2, { win: "casement", dress: "none", lite: true }));
    }
  const b = massing(a, {
    w: L,
    d,
    h,
    t: 0.25,
    roof: "flat",
    parapet: 0.3,
    front: front.map((o) => (o.kind === "door" && o.y > 0 ? { ...o, y: o.y } : o)),
    back: at(Array.from({ length: units }, (_, u) => -L / 2 + (L / units) * (u + 0.5)), { y: 1.0, w: 1.2, h: 1.1, kind: "window", win: "plain", dress: "none", lite: true }),
    label,
  });
  // Gallery deck, rail and a stair at one end.
  a.box(b.faces.front, 0, 3.0, 0.8, L + 0.2, 0.18, 1.6, "paper");
  a.box(b.faces.front, 0, 3.95, 1.55, L + 0.2, 0.06, 0.06, "mid");
  for (let x = -L / 2; x <= L / 2 + 0.01; x += 2) {
    a.box(b.faces.front, x, 0, 1.5, 0.12, 3.0, 0.12, "paper");
    a.box(b.faces.front, x, 3.18, 1.55, 0.05, 0.8, 0.05, "mid");
  }
  const sf = frame(L / 2 + 0.8, 0, 0.9, 0, b.faces.front);
  for (let i = 0; i < 16; i++) a.box(sf, 0, (i * 3.1) / 16, -0.6 + i * 0.26 - 3, 1.0, 3.1 / 16 + 0.001, 0.28, "light");
}

/** A corrugated Nissen hut: the emergency architecture of every century. */
function nissen(a: Arch, label: string): void {
  const L = 12;
  const r = 2.9;
  const g = a.fork(label);
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI * (i / segs);
    const a1 = Math.PI * ((i + 1) / segs);
    if (a.c.ruin > 0.3 && g.next() < a.c.ruin - 0.2) continue;
    a.beam(null, [0, Math.sin(a0) * r, Math.cos(a0) * r], [0, Math.sin(a1) * r, Math.cos(a1) * r], L, 0.05, "light");
  }
  for (let x = -L / 2 + 0.5; x < L / 2; x += 0.6) {
    for (let i = 0; i < segs; i++) {
      const a0 = Math.PI * (i / segs);
      const a1 = Math.PI * ((i + 1) / segs);
      if ((i + Math.round(x * 10)) % 3 !== 0) continue;
      a.beam(null, [x, Math.sin(a0) * (r + 0.03), Math.cos(a0) * (r + 0.03)], [x, Math.sin(a1) * (r + 0.03), Math.cos(a1) * (r + 0.03)], 0.03, 0.02, "mid");
    }
  }
  for (const s of [-1, 1]) {
    const ef = frame((s * L) / 2, 0, 0, (s * Math.PI) / 2);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= segs; i++) pts.push([Math.cos(Math.PI * (i / segs)) * r, Math.sin(Math.PI * (i / segs)) * r]);
    a.add(extrude(pts, 0.12), ef, { tone: "paper", position: [0, 0, 0.06] });
    if (s > 0) {
      a.box(ef, 0, 0, 0.14, 1.0, 2.0, 0.06, "light");
      const lit = a.c.lit > g.next();
      for (const x of [-1.6, 1.6]) a.box(ef, x, 1.0, 0.14, 0.7, 0.8, 0.06, lit ? "pale" : "dark", lit ? { accent: "amber", amt: 0.9 } : {});
    }
  }
  a.add(cylinder(0.1, 0.1, 1.4, 6), null, { tone: "deep", position: [-3, r + 0.4, 0.9] });
}

// ---------------------------------------------------------------------- camp

export function camp(a: Arch, variant: number): void {
  const c = a.c;
  const g = a.fork(`camp${variant}`);
  const collapsed = (i: number) => c.ruin > 0.3 + a.fork(`tc${i}`).next() * 0.5 || (c.abandoned > 0.5 && a.fork(`ta${i}`).next() < c.abandoned * 0.7);
  if (variant === 1) {
    // Bell tents in a ring around a fire and a tarp kitchen.
    const n = 9;
    const R = 13;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + 0.2;
      bellTent(a, Math.cos(ang) * R, Math.sin(ang) * R, ang + Math.PI / 2 + Math.PI, collapsed(i), g);
    }
    fire(a, 0, 0);
    tarpKitchen(a, frame(0, 0, -5.5));
    for (const s of [-1, 1]) {
      const bf = frame(s * 3.2, 0, 1.5, s * 0.5);
      a.add(cylinder(0.22, 0.22, 2.4, 8), bf, { tone: "light", position: [0, 0.25, 0], rotation: [0, 0, Math.PI / 2] });
    }
    return;
  }
  // Rows of ridge tents, a field kitchen marquee, water, latrines, lines.
  const rows = 3;
  const cols = 5;
  let idx = 0;
  const uniform = c.sealed || c.order > 0.5;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = -16 + k * 7.2 + (uniform ? 0 : g.range(-0.4, 0.4));
      const z = -4 - r * 7 + (uniform ? 0 : g.range(-0.4, 0.4));
      ridgeTent(a, x, z, uniform ? 0 : g.range(-0.08, 0.08), collapsed(idx++), g);
    }
  }
  marquee(a, frame(8, 0, 10));
  // Water bladder and tap stand.
  const wf = frame(-10, 0, 9);
  a.add(cylinder(2.0, 2.0, 1.0, 16), wf, { tone: "light", position: [0, 0.5, 0], scale: [1.4, 0.9, 1] });
  a.rod(wf, [2.8, 0.3, 0], [4.8, 0.3, 0], 0.06, "mid");
  a.box(wf, 4.8, 0, 0, 0.14, 1.1, 0.14, "mid");
  a.box(wf, 4.8, 1.0, 0, 1.6, 0.08, 0.08, "mid");
  for (const x of [4.2, 4.6, 5.0, 5.4]) a.box(wf, x, 0.85, 0.08, 0.05, 0.15, 0.1, "mid");
  for (let i = 0; i < 6; i++) a.box(wf, 3.9 + (i % 3) * 0.4, 0, 0.9 + Math.floor(i / 3) * 0.35, 0.3, 0.45, 0.18, "light");
  // Latrines.
  for (let i = 0; i < 4; i++) {
    const lf = frame(22 + i * 1.3, 0, -18);
    a.box(lf, 0, 0, 0, 1.15, 2.3, 1.2, "paper");
    a.add(cone(0.72, 0.25, 4), lf, { tone: "light", position: [0, 2.42, 0], rotation: [0, Math.PI / 4, 0] });
    a.box(lf, 0, 0.1, 0.61, 0.8, 1.9, 0.02, "light");
    a.add(cylinder(0.05, 0.05, 0.6, 5), lf, { tone: "mid", position: [0.35, 2.6, -0.3] });
  }
  // Washing lines.
  if (!uniform && c.ruin < 0.6) {
    for (const z of [-26, -29]) {
      a.box(null, -12, 0, z, 0.1, 2.2, 0.1, "light");
      a.box(null, 0, 0, z, 0.1, 2.2, 0.1, "light");
      a.rod(null, [-12, 2.05, z], [0, 2.05, z], 0.01, "mid", 3);
      for (let x = -11.3; x < -0.6; x += g.range(0.6, 1.1)) {
        const hh = g.range(0.4, 0.9);
        a.quad(frame(x, 0, z), 0, 2.05 - hh / 2, 0, g.range(0.3, 0.7), hh, g.pick(["paper", "pale", "light"] as const));
        a.quad(frame(x, 0, z, Math.PI), 0, 2.05 - hh / 2, 0, 0.5, hh, "pale");
      }
    }
  }
  if (!uniform) fire(a, -3, 11);
  a.sign(frame(-24, 0, 12, 0.3), { kind: "board", text: "RELIEF CAMP", sub: "REGISTRATION · WATER · FOOD" }, 0, 2.0, 3.6, 0.9, 0.06);
  for (const s of [-1.3, 1.3]) a.box(frame(-24, 0, 12, 0.3), s, 0, 0, 0.1, 2.5, 0.1, "mid");
}

function ridgeTent(a: Arch, x: number, z: number, rot: number, down: boolean, g: import("../../core/rng.ts").Rng): void {
  const f = frame(x, 0, z, rot);
  const L = 4.2;
  const w = 3.4;
  const wall = 0.6;
  const ridge = 2.2;
  if (down) {
    // Collapsed: a slumped sheet over a broken pole.
    a.add(jitter(new THREE.BoxGeometry(L, 0.5, w + 0.8, 4, 1, 3), 0.18, x + z), f, { tone: "pale", position: [0, 0.25, 0] });
    a.beam(f, [-L / 2 - 0.4, 0.1, 0], [0.4, 1.3, 0.2], 0.05, 0.05, "mid");
    return;
  }
  const slope = Math.hypot(w / 2, ridge - wall);
  const ang = Math.atan2(ridge - wall, w / 2);
  for (const s of [-1, 1]) {
    a.cbox(f, 0, (ridge + wall) / 2, (s * w) / 4, L + 0.3, 0.04, slope + 0.2, "paper", { rot: [s * ang, 0, 0] });
    a.box(f, 0, 0, (s * w) / 2, L, wall, 0.04, "paper");
  }
  for (const e of [-1, 1]) {
    const ef = frame((e * L) / 2, 0, 0, (e * Math.PI) / 2, f);
    a.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, wall], [0, ridge], [-w / 2, wall]], 0.04), ef, { tone: e > 0 ? "paper" : "pale" });
    if (e > 0) {
      // Door flap: pinned back, a dark triangle inside.
      a.add(extrude([[-0.55, 0], [0.55, 0], [0, ridge - 0.25]], 0.02), ef, { tone: "solid", position: [0, 0, 0.03] });
      a.add(extrude([[0.05, 0], [0.7, 0], [0.05, ridge - 0.3]], 0.02), ef, { tone: "pale", position: [0, 0, 0.06], rotation: [0, -0.6, 0] });
    }
    a.beam(f, [(e * L) / 2, 0, 0], [(e * L) / 2, ridge + 0.25, 0], 0.05, 0.05, "mid");
    // Guy ropes from the pole tops and the wall corners.
    a.rod(f, [(e * (L / 2)), ridge + 0.2, 0], [e * (L / 2 + 1.6), 0, 0], 0.012, "mid", 3);
    for (const s of [-1, 1]) a.rod(f, [e * (L / 2 - 0.2), wall + 0.1, (s * w) / 2], [e * (L / 2 - 0.2) + e * 0.4, 0, s * (w / 2 + 1.1)], 0.01, "mid", 3);
  }
  if (g.next() < 0.35) a.box(f, L / 2 + 0.6, 0, 0.9, 0.6, 0.4, 0.4, "light");
}

function bellTent(a: Arch, x: number, z: number, rot: number, down: boolean, g: import("../../core/rng.ts").Rng): void {
  const f = frame(x, 0, z, rot);
  const r = 2.5;
  if (down) {
    a.add(jitter(new THREE.CylinderGeometry(r * 1.1, r * 1.2, 0.4, 12, 1), 0.2, x), f, { tone: "pale", position: [0, 0.2, 0] });
    return;
  }
  a.add(cylinder(r, r, 0.7, 14, true), f, { tone: "paper", position: [0, 0.35, 0] });
  a.add(cone(r + 0.1, 2.5, 14), f, { tone: "paper", position: [0, 0.7 + 1.25, 0] });
  a.add(cylinder(0.04, 0.04, 0.6, 4), f, { tone: "mid", position: [0, 3.4, 0] });
  const df = frame(0, 0, r - 0.02, 0, f);
  a.add(extrude([[-0.45, 0], [0.45, 0], [0.2, 1.6], [-0.2, 1.6]], 0.02), df, { tone: "solid", position: [0, 0, 0.02] });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    a.rod(f, [Math.cos(ang) * (r + 0.05), 0.7, Math.sin(ang) * (r + 0.05)], [Math.cos(ang) * (r + 1.2), 0, Math.sin(ang) * (r + 1.2)], 0.01, "mid", 3);
  }
  void g;
}

function fire(a: Arch, x: number, z: number): void {
  const c = a.c;
  if (c.ruin > 0.6 || c.sealed) return;
  const burning = c.abandoned < 0.4 && c.night > 0.25;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    a.add(new THREE.IcosahedronGeometry(0.2, 0), null, { tone: "light", position: [x + Math.cos(ang) * 0.75, 0.12, z + Math.sin(ang) * 0.75] });
  }
  for (let i = 0; i < 4; i++) a.beam(null, [x + Math.cos(i * 1.6) * 0.6, 0.05, z + Math.sin(i * 1.6) * 0.6], [x, 0.55, z], 0.08, 0.08, "deep");
  if (burning) a.add(cone(0.35, 0.9, 6), null, { tone: "pale", position: [x, 0.7, z], accent: "ember", accentAmount: 0.95 });
}

function tarpKitchen(a: Arch, f: M4): void {
  for (const [x, z] of [
    [-3, 1.5],
    [3, 1.5],
    [-3, -1.5],
    [3, -1.5],
  ] as const)
    a.box(f, x, 0, z, 0.1, z > 0 ? 2.3 : 2.9, 0.1, "light");
  if (a.c.ruin < 0.5) a.cbox(f, 0, 2.6, 0, 6.6, 0.04, 3.6, "pale", { rot: [0.16, 0, 0] });
  a.box(f, 0, 0.75, -0.6, 4, 0.08, 0.8, "light");
  for (const x of [-1.4, 0, 1.4]) a.add(cylinder(0.3, 0.26, 0.5, 10), f, { tone: "mid", position: [x, 1.05, -0.6] });
}

function marquee(a: Arch, f: M4): void {
  const L = 11;
  const w = 6.5;
  const eave = 2.4;
  const ridge = 3.9;
  const r = a.c.ruin;
  for (let x = -L / 2; x <= L / 2 + 0.01; x += L / 3)
    for (const s of [-1, 1]) a.box(f, x, 0, (s * w) / 2, 0.1, eave, 0.1, "light");
  for (const x of [-L / 2, 0, L / 2]) a.box(f, x, 0, 0, 0.12, ridge, 0.12, "light");
  if (r < 0.55) {
    const slope = Math.hypot(w / 2, ridge - eave);
    const ang = Math.atan2(ridge - eave, w / 2);
    for (const s of [-1, 1]) {
      a.cbox(f, 0, (ridge + eave) / 2 + 0.05, (s * w) / 4, L + 0.4, 0.04, slope + 0.2, "paper", { rot: [s * ang, 0, 0] });
      // Scalloped valance along the eaves.
      const vf = frame(0, eave, (s * (w / 2 + 0.08)), s > 0 ? 0 : Math.PI, f);
      const pts: Array<[number, number]> = [
        [-L / 2 - 0.2, 0.1],
        [L / 2 + 0.2, 0.1],
      ];
      const n = 22;
      for (let i = n; i >= 0; i--) pts.push([-L / 2 - 0.2 + ((L + 0.4) * i) / n, i % 2 ? -0.3 : -0.15]);
      a.add(extrude(pts, 0.02), vf, { tone: "paper" });
    }
    for (const e of [-1, 1]) a.add(extrude([[-w / 2, 0], [w / 2, 0], [0, ridge - eave]], 0.03), frame((e * L) / 2, eave, 0, (e * Math.PI) / 2, f), { tone: "paper" });
  }
  a.sign(frame(0, 0, w / 2 + 0.1, 0, f), { kind: "board", text: "FIELD KITCHEN" }, 0, eave + 0.55, 3.4, 0.5, 0.05);
  if (a.sealed) return;
  // Trestles, pots on burners, gas bottles, crates and sacks.
  for (const x of [-3.2, 0, 3.2]) {
    a.box(f, x, 0.8, 1.2, 2.6, 0.06, 0.9, "light");
    for (const s of [-1.1, 1.1]) a.box(f, x + s, 0, 1.2, 0.06, 0.8, 0.8, "mid");
  }
  for (const x of [-3.5, -1.5, 0.5, 2.5]) {
    a.box(f, x, 0, -1.5, 0.7, 0.45, 0.7, "deep");
    a.add(cylinder(0.42, 0.38, 0.6, 12), f, { tone: "mid", position: [x, 0.75, -1.5] });
    a.add(cylinder(0.16, 0.16, 0.55, 8), f, { tone: "light", position: [x + 0.55, 0.28, -2.3] });
  }
  for (let i = 0; i < 8; i++) a.box(f, L / 2 - 1.2 + (i % 2) * 0.62, Math.floor(i / 2) * 0.4, -2.3 + Math.floor(i / 4) * 0.1, 0.6, 0.38, 0.45, "light");
  for (let i = 0; i < 5; i++) a.add(jitter(new THREE.BoxGeometry(0.8, 0.35, 0.5, 2, 1, 1), 0.05, i), f, { tone: "pale", position: [-L / 2 + 1 + i * 0.35, 0.2 + (i % 2) * 0.3, -2.2], rotation: [0, 0.3 * i, 0] });
}

export type { V3 };
void RUIN;
void growthFrom;
