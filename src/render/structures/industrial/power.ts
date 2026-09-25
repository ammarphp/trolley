/**
 * Energy infrastructure: cooling towers, the power station, substations,
 * high-voltage pylon lines, wind turbines and solar farms.
 */
import * as THREE from "three";
import { Kit, cylinder, gable, lathe } from "../../core/geometry.ts";
import { createNoise } from "../../core/noise.ts";
import type { Rng } from "../../core/rng.ts";
import { Build, actorMaterial, catenary, fence, latticeMast, rectPath, scaffold, towerCrane, type Vec3 } from "./common.ts";
import { createPlume } from "./effects.ts";

// =================================================================== cooling tower

export interface CoolingTowerSpec {
  height: number;
  baseR: number;
  throatR: number;
  throatAt: number;
}

function hyperbolicRadius(s: CoolingTowerSpec, y: number): number {
  const y0 = s.throatAt * s.height;
  const k = s.baseR / s.throatR;
  const c = y0 / Math.sqrt(k * k - 1);
  return s.throatR * Math.sqrt(1 + ((y - y0) / c) ** 2);
}

/**
 * A natural-draught hyperbolic cooling tower on a ring of raking columns.
 * Returns the top centre and radius for a steam plume.
 */
export function coolingTowerShell(b: Build, cx: number, cz: number, s: CoolingTowerSpec, opts: { upTo?: number; broken?: boolean; seed?: number } = {}): { top: Vec3; topR: number } {
  const noise = createNoise(`ct-${cx}-${cz}-${opts.seed ?? 0}`);
  const lintel = s.height * 0.085;
  const topY = s.height * (opts.upTo ?? 1);
  const rings = 22;
  const seg = 56;
  // Outer shell, painted per vertex with weathering streaks below the rim.
  const prof: Array<[number, number]> = [];
  for (let i = 0; i <= rings; i++) {
    const y = lintel + ((topY - lintel) * i) / rings;
    prof.push([hyperbolicRadius(s, y), y]);
  }
  const shell = lathe(prof, seg);
  const pos = shell.getAttribute("position") as THREE.BufferAttribute;
  const ink = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const hN = Math.max(0, (y - lintel) / (s.height - lintel));
    // Vertical rain streaks hanging from the rim, stronger in bands.
    const streak = Math.max(0, noise.n2(Math.cos(a) * 9 + Math.sin(a) * 3, Math.sin(a) * 9) * 0.5 + noise.n2(a * 14, 3.1) * 0.5);
    let tone = b.pristine ? 0.04 : 0.1 + streak * 0.2 * Math.pow(hN, 1.6);
    // Splash band just above the lintel.
    if (!b.pristine) tone += 0.08 * (1 - Math.min(1, (y - lintel) / 6));
    // Scorch: long soot runs down from the torn crown, not blotches.
    if (b.ruin) tone += 0.34 * Math.max(0, noise.n2(a * 11, y * 0.006)) * Math.pow(hN, 0.7) + 0.06;
    let yy = y;
    if (opts.broken && i >= pos.count - (seg + 1) * 3) {
      // Jagged broken crown: the last rings are torn down unevenly.
      const tear = Math.max(0, noise.n2(a * 2.2, 7.7) * 0.5 + 0.5);
      yy = y - tear * s.height * 0.22;
    }
    pos.setY(i, yy);
    ink[i * 3] = Math.min(0.9, tone);
  }
  shell.setAttribute("inkAttr", new THREE.BufferAttribute(ink, 3));
  shell.computeVertexNormals();
  b.add(shell, { position: [cx, 0, cz] });
  // Inner face, seen through the column ring and at a broken crown.
  const inner: Array<[number, number]> = [];
  for (let i = 0; i <= 8; i++) {
    const y = lintel + ((topY - lintel) * i) / 8;
    inner.push([hyperbolicRadius(s, y) - 0.6, y]);
  }
  const innerGeo = lathe(inner.reverse(), 28);
  b.add(innerGeo, { tone: "dark", position: [cx, 0, cz] });
  // Lintel ring beam.
  const lr = hyperbolicRadius(s, lintel);
  b.add(lathe([[lr + 0.5, lintel - 1.3], [lr + 0.5, lintel + 0.2], [lr - 0.8, lintel + 0.2], [lr - 0.8, lintel - 1.3], [lr + 0.5, lintel - 1.3]], seg), { tone: "pale", position: [cx, 0, cz] });
  // Raking column pairs (the diagonal X lattice at the base).
  const N = Math.round(lr * 0.95);
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const gr = lr + 1.6;
    const g0: Vec3 = [cx + Math.cos(a0) * gr, 0, cz + Math.sin(a0) * gr];
    const t1: Vec3 = [cx + Math.cos(a1) * lr, lintel - 1.2, cz + Math.sin(a1) * lr];
    const g1: Vec3 = [cx + Math.cos(a1) * gr, 0, cz + Math.sin(a1) * gr];
    const t0: Vec3 = [cx + Math.cos(a0) * lr, lintel - 1.2, cz + Math.sin(a0) * lr];
    b.beam(g0, t1, 0.75, "light");
    b.beam(g1, t0, 0.75, "light");
  }
  // Pond basin wall and the dark fill pack inside.
  b.add(lathe([[lr + 3.2, 0], [lr + 3.9, 0], [lr + 3.9, 1.3], [lr + 3.2, 1.3], [lr + 3.2, 0]], seg), { tone: "pale", position: [cx, 0, cz] });
  b.cyl(lr - 1.5, lintel * 0.55, cx, 0.2, cz, "solid", 20);
  // Access ladder up the flank and rim beacons.
  const la = Math.PI * 1.1;
  const ladder: Vec3[] = [];
  for (let i = 0; i <= 12; i++) {
    const y = lintel + ((topY - lintel) * i) / 12;
    const r = hyperbolicRadius(s, y) + 0.25;
    ladder.push([cx + Math.cos(la) * r, y, cz + Math.sin(la) * r]);
  }
  b.polyline(ladder, true);
  const tr = hyperbolicRadius(s, topY);
  if (!opts.broken && !b.ruin) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      b.lamp(cx + Math.cos(a) * (tr + 0.4), topY - 0.6, cz + Math.sin(a) * (tr + 0.4), 1.1, "signal", true);
    }
  }
  return { top: [cx, topY, cz], topR: tr };
}

export function buildCoolingTower(b: Build, seed: Rng): THREE.Group {
  const twin = b.pristine ? true : seed.chance(0.55);
  const H = 118 + seed.range(-4, 8);
  const spec: CoolingTowerSpec = { height: H, baseR: H * 0.4, throatR: H * 0.235, throatAt: 0.79 };
  const centres: Array<[number, number]> = twin
    ? [
        [-spec.baseR * 1.18, 0],
        [spec.baseR * 1.18, b.pristine ? 0 : -spec.baseR * 0.5],
      ]
    : [[0, 0]];
  const plumes: Array<{ top: Vec3; topR: number }> = [];
  centres.forEach(([x, z], i) => {
    if (b.building && i === centres.length - 1) {
      const res = coolingTowerShell(b, x, z, spec, { upTo: 0.52, seed: i });
      // Climbing formwork ring and working platform at the rising edge.
      const y = res.top[1];
      b.add(lathe([[res.topR + 1.4, y - 2.5], [res.topR + 1.4, y + 1], [res.topR - 1.2, y + 1], [res.topR - 1.2, y - 2.5], [res.topR + 1.4, y - 2.5]], 48), { tone: "dark", position: [x, 0, z] });
      towerCrane(b, x + res.topR + 8, z + 4, y + 30, 55, Math.PI * 0.8);
      return;
    }
    const broken = b.ruin && (i === 0 || seed.chance(0.5));
    const res = coolingTowerShell(b, x, z, spec, { broken, seed: i });
    if (!b.ruin) plumes.push(res);
  });
  // Pump house and the warm-water culverts between tower and plant.
  const ph = b.pristine ? "paper" : "pale";
  b.box(22, 9, 14, 0, 0, spec.baseR + 22, ph);
  b.box(23, 0.8, 15, 0, 9, spec.baseR + 22, "light");
  for (let i = 0; i < 4; i++) b.rod([-6 + i * 4, 2, spec.baseR + 15], [-6 + i * 4, 2, spec.baseR + 3], 0.9, "light", 8);
  const drift = seed.range(60, 110);
  for (const p of plumes) {
    const plume = createPlume({
      origin: [p.top[0], p.top[1] - 4, p.top[2]],
      rng: seed.fork(`plume${p.top[0]}`),
      count: 56,
      life: 80,
      height: 240,
      r0: p.topR * 0.42,
      r1: p.topR * 1.05,
      drift: [drift, -drift * 0.35],
      wander: p.topR * 0.6,
      sourceRadius: p.topR * 0.7,
      tone: 0,
      toneTop: 0,
      thinFrom: 0.5,
      hatch: 0.9,
    });
    b.effect(plume);
  }
  const w = twin ? spec.baseR * 4.8 : spec.baseR * 2.3;
  return b.finish({ width: w, depth: spec.baseR * 2.6 + 30, height: H }, "cooling-tower");
}

// =================================================================== pylons

/** Double-circuit lattice suspension tower: arm heights and half-lengths. */
const PYLON = {
  height: 51,
  arms: [
    { y: 27, half: 8.2 },
    { y: 35, half: 9.8 },
    { y: 43, half: 7.6 },
  ],
  insulator: 3.8,
  peak: 51,
  span: 170,
};

export interface PylonAttachments {
  /** Recommended distance between towers along the line (m). */
  span: number;
  /** Overall tower height (m). */
  height: number;
  /** Mid-span sag of the phase conductors (m). */
  sag: number;
  /**
   * Phase-conductor hang points (bottom of each insulator string) in the
   * tower's local frame: tower base at origin, arms along ±X, the line runs
   * along Z. Six points: three per side, bottom to top.
   */
  conductors: Vec3[];
  /** Earth-wire clamp points at the peak. */
  earth: Vec3[];
}

export function getPylonAttachments(): PylonAttachments {
  const conductors: Vec3[] = [];
  for (const side of [-1, 1]) for (const a of PYLON.arms) conductors.push([side * (a.half - 0.4), a.y - PYLON.insulator, 0]);
  return {
    span: PYLON.span,
    height: PYLON.height,
    sag: 6.5,
    conductors,
    earth: [
      [-2.4, PYLON.peak, 0],
      [2.4, PYLON.peak, 0],
    ],
  };
}

/** One lattice tower at (x, z) with an optional lean (ruin). */
export function pylonTower(b: Build, x: number, z: number, opts: { ry?: number; collapsed?: boolean } = {}): void {
  if (opts.collapsed) {
    // A toppled tower: body lying across the ground, arms crumpled.
    const L = 30;
    const dir = b.rng.range(-0.4, 0.4);
    const tip: Vec3 = [x + Math.sin(dir) * L, 1.2, z + Math.cos(dir) * L];
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      b.beam([x + dx * 4.5, 0, z + dz * 4.5], [tip[0] + dx * 1.2, tip[1] + (dz + 1) * 1.1, tip[2] + dx * 0.4], 0.3, "dark");
    }
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      const p = [x + (tip[0] - x) * t, 1 + 3 * (1 - t), z + (tip[2] - z) * t] as Vec3;
      b.line([p[0] - 3 * (1 - t), p[1] + 2, p[2]], [p[0] + 3 * (1 - t), 0.2, p[2] + 2]);
      b.line([p[0] + 3 * (1 - t), p[1] + 2, p[2]], [p[0] - 3 * (1 - t), 0.2, p[2] + 2]);
    }
    b.beam([tip[0] - 9, 1, tip[2]], [tip[0] + 9, 2.5, tip[2] + 3], 0.3, "dark");
    b.box(1.6, 1, 1.6, x - 4.5, 0, z - 4.5, "light");
    b.box(1.6, 1, 1.6, x + 4.5, 0, z + 4.5, "light");
    return;
  }
  const tone = "mid";
  // Concrete footings.
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const)
    b.box(1.4, 0.6, 1.4, x + dx * 4.6, 0, z + dz * 4.6, "light");
  // Body: waist at the lower arm, then a slimmer upper body to the peak.
  latticeMast(b, x, z, 27, 9.4, 3.2, { panels: 5, leg: 0.34, tone, fine: true });
  latticeMast(b, x, z, PYLON.peak - 27 - 2, 3.2, 2.0, { panels: 5, leg: 0.26, tone, y0: 27, fine: true });
  // Anti-climbing guard.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.line([x + Math.cos(a) * 3.8, 5.6, z + Math.sin(a) * 3.8], [x + Math.cos(a) * 4.6, 6.4, z + Math.sin(a) * 4.6], true);
  }
  // Cross-arms: triangular lattice girders, insulator strings at the tips.
  for (const arm of PYLON.arms) {
    const bodyHalf = arm.y < 28 ? 1.6 : 1.6 - ((arm.y - 27) / 24) * 0.6;
    for (const side of [-1, 1]) {
      const root = side * bodyHalf;
      const tipX = side * arm.half;
      b.beam([x + root, arm.y, z - 1.2], [x + tipX, arm.y, z - 0.2], 0.22, tone);
      b.beam([x + root, arm.y, z + 1.2], [x + tipX, arm.y, z + 0.2], 0.22, tone);
      b.beam([x + root, arm.y + 3.2, z], [x + tipX, arm.y + 0.2, z], 0.2, tone);
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps,
          t1 = (s + 1) / steps;
        const bx0 = x + root + (tipX - root) * t0,
          bx1 = x + root + (tipX - root) * t1;
        b.line([bx0, arm.y, z], [bx1, arm.y + 3.2 * (1 - t1) + 0.2, z]);
        b.line([bx0, arm.y, z - 1.2 + t0], [bx0, arm.y, z + 1.2 - t0], true);
      }
      // Insulator string (a stack of discs) and the conductor clamp.
      const ix = x + side * (arm.half - 0.4);
      b.rod([ix, arm.y - 0.1, z], [ix, arm.y - PYLON.insulator, z], 0.22, "dark", 8);
      for (let d = 0; d < 6; d++) b.cyl(0.42, 0.12, ix, arm.y - 0.6 - d * 0.52, z, "mid", 8);
    }
  }
  // Earth-wire peak.
  b.beam([x - 2.6, PYLON.peak, z], [x + 2.6, PYLON.peak, z], 0.22, tone);
  b.beam([x - 1, PYLON.peak - 2, z], [x - 2.6, PYLON.peak, z], 0.2, tone);
  b.beam([x + 1, PYLON.peak - 2, z], [x + 2.6, PYLON.peak, z], 0.2, tone);
  // Danger plate.
  b.box(0.6, 0.5, 0.05, x, 3, z + 4.2, "paper", { accent: "signal", accentAmount: 0.8 });
}

/** A run of towers with sagging phase conductors. The line runs along Z. */
export function buildPylonLine(b: Build, seed: Rng): THREE.Group {
  const count = b.pristine ? 5 : seed.int(4, 5);
  const span = PYLON.span;
  const att = getPylonAttachments();
  const z0 = (span * (count - 1)) / 2;
  const positions: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const wobble = b.pristine ? 0 : seed.range(-3, 3);
    positions.push([wobble, z0 - i * span]);
  }
  const fallen = b.ruin ? seed.int(1, count - 2) : -1;
  positions.forEach(([x, z], i) => pylonTower(b, x, z, { collapsed: i === fallen }));
  for (let i = 0; i < count - 1; i++) {
    const [xa, za] = positions[i]!;
    const [xb, zb] = positions[i + 1]!;
    const broken = b.ruin && (i === fallen || i + 1 === fallen);
    const pts = [...att.conductors, ...att.earth];
    pts.forEach((p, j) => {
      const isEarth = j >= att.conductors.length;
      const a: Vec3 = [xa + p[0], p[1], za + p[2]];
      const c: Vec3 = [xb + p[0], p[1], zb + p[2]];
      if (broken) {
        // Snapped conductors trailing to the ground.
        const from = i === fallen ? c : a;
        const toward = i === fallen ? a : c;
        const end: Vec3 = [from[0] + (toward[0] - from[0]) * 0.45 + seed.range(-3, 3), 0.1, from[2] + (toward[2] - from[2]) * 0.45];
        b.polyline(catenary(from, end, 4, 12));
        return;
      }
      b.polyline(catenary(a, c, isEarth ? att.sag * 0.8 : att.sag, 22));
      // Spacer dampers on the twin-bundle conductors.
      if (!isEarth) for (let s = 1; s < 4; s++) {
        const t = s / 4;
        const q: Vec3 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - att.sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t];
        b.line([q[0] - 0.25, q[1], q[2]], [q[0] + 0.25, q[1], q[2]], true);
      }
    });
  }
  b.blinkPeriod = 2.0;
  return b.finish({ width: 24, depth: span * (count - 1) + 20, height: PYLON.height }, "pylon-line");
}

// =================================================================== substation

function transformer(b: Build, x: number, z: number, scale: number, ry = 0): void {
  const s = scale;
  const c = Math.cos(ry),
    sn = Math.sin(ry);
  const P = (lx: number, lz: number): [number, number] => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  b.box(5.4 * s, 0.5, 3.6 * s, x, 0, z, "light", { ry });
  b.box(4.2 * s, 3.6 * s, 2.6 * s, x, 0.5, z, b.wear("pale"), { ry });
  // Radiator banks: a ribbed block either side, ribs drawn as fine lines.
  for (const side of [-1, 1]) {
    const [rx, rz] = P(0, side * 1.75 * s);
    b.box(3.8 * s, 3 * s, 0.9 * s, rx, 0.7, rz, "mid", { ry });
    for (let i = 0; i < 7; i++) {
      const [fx, fz] = P(-1.8 * s + i * 0.6 * s, side * 2.22 * s);
      b.line([fx, 0.75, fz], [fx, 0.65 + 3 * s, fz], true);
    }
  }
  // Conservator tank and bushings.
  const [cx, cz] = P(-1.5 * s, 0);
  b.add(cylinder(0.45 * s, 0.45 * s, 2.4 * s, 8), { tone: "pale", position: [cx, 4.8 * s + 0.6, cz], rotation: [Math.PI / 2, ry, 0] });
  for (let i = 0; i < 3; i++) {
    const [ux, uz] = P(0.4 * s + i * 0.9 * s, 0.4 * s);
    b.cyl(0.16 * s, 2.2 * s, ux, 4.1 * s + 0.5, uz, "mid", 6, 0.1 * s);
    b.cyl(0.26 * s, 0.12, ux, 4.5 * s + 0.5, uz, "dark", 6);
  }
}

function gantry(b: Build, x: number, z: number, span: number, h: number, alongX = true): void {
  const half = span / 2;
  const a: [number, number] = alongX ? [x - half, z] : [x, z - half];
  const c: [number, number] = alongX ? [x + half, z] : [x, z + half];
  latticeMast(b, a[0], a[1], h, 1.1, 0.8, { panels: Math.round(h / 2.6), leg: 0.14, fine: true });
  latticeMast(b, c[0], c[1], h, 1.1, 0.8, { panels: Math.round(h / 2.6), leg: 0.14, fine: true });
  // Lattice beam across the top.
  const y = h;
  b.beam([a[0], y, a[1]], [c[0], y, c[1]], 0.18, "mid");
  b.beam([a[0], y - 1.2, a[1]], [c[0], y - 1.2, c[1]], 0.14, "mid");
  const n = Math.round(span / 1.5);
  for (let i = 0; i < n; i++) {
    const t0 = i / n,
      t1 = (i + 1) / n;
    const p0: Vec3 = [a[0] + (c[0] - a[0]) * t0, y, a[1] + (c[1] - a[1]) * t0];
    const p1: Vec3 = [a[0] + (c[0] - a[0]) * t1, y - 1.2, a[1] + (c[1] - a[1]) * t1];
    b.line(p0, p1, true);
  }
  // Strain insulators dropping to the busbar.
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const px = a[0] + (c[0] - a[0]) * t,
      pz = a[1] + (c[1] - a[1]) * t;
    b.rod([px, y - 1.2, pz], [px, y - 3.4, pz], 0.14, "dark", 6);
  }
}

function postInsulator(b: Build, x: number, z: number, h: number): void {
  b.box(0.5, h * 0.55, 0.5, x, 0, z, "light");
  b.cyl(0.14, h * 0.45, x, h * 0.55, z, "mid", 6);
  for (let d = 0; d < 2; d++) b.cyl(0.24, 0.08, x, h * 0.62 + d * h * 0.16, z, "dark", 6);
}

export function substationYard(b: Build, cx: number, cz: number, w: number, d: number, opts: { fence?: boolean } = {}): Vec3 {
  // Gravel yard.
  b.box(w, 0.08, d, cx, 0, cz, "pale");
  const rows = Math.max(2, Math.round(w / 16));
  const gantryH = 14;
  for (let i = 0; i < rows; i++) {
    const gx = cx - w / 2 + 8 + (i * (w - 16)) / Math.max(1, rows - 1);
    if (b.ruin && b.rng.chance(0.35)) {
      b.beam([gx, 0, cz - d / 2 + 6], [gx + 6, 2, cz - d / 2 + 16], 0.4, "dark");
      continue;
    }
    gantry(b, gx, cz - d / 2 + 9, 12, gantryH, false);
    for (let j = 0; j < 3; j++) postInsulator(b, gx - 3 + j * 3, cz - d / 2 + 18, 5);
    for (let j = 0; j < 3; j++) postInsulator(b, gx - 3 + j * 3, cz - d / 2 + 24, 5);
    // Busbars.
    for (let j = 0; j < 3; j++) b.line([gx - 3 + j * 3, 5.2, cz - d / 2 + 3], [gx - 3 + j * 3, 5.2, cz - d / 2 + 26]);
  }
  // Main transformers in blast-walled bays (plinths wait empty while building).
  const tN = Math.max(1, Math.round(w / 22));
  for (let i = 0; i < tN; i++) {
    const tx = cx - w / 2 + 11 + (i * (w - 22)) / Math.max(1, tN - 1);
    if (b.building && i % 2 === 1) {
      b.box(6.8, 0.6, 4.6, tx, 0, cz + d / 2 - 12, "light");
      for (let k = 0; k < 4; k++) b.line([tx - 3 + k * 2, 0.6, cz + d / 2 - 14], [tx - 3 + k * 2, 2.2, cz + d / 2 - 14]);
    } else transformer(b, tx, cz + d / 2 - 12, 1.25);
    b.box(0.5, 7, 9, tx - 6.5, 0, cz + d / 2 - 12, b.wear("light"));
    b.box(0.5, 7, 9, tx + 6.5, 0, cz + d / 2 - 12, b.wear("light"));
  }
  // Control building.
  b.box(14, 4.6, 7, cx + w / 2 - 10, 0, cz - 2, b.wear("paper"));
  b.box(14.6, 0.5, 7.6, cx + w / 2 - 10, 4.6, cz - 2, "light");
  for (let i = 0; i < 4; i++) b.box(1.4, 1, 0.08, cx + w / 2 - 15 + i * 3.2, 2.2, cz + 1.53, b.glass);
  // Cable trench covers.
  b.box(w - 8, 0.12, 1, cx, 0, cz + 2, "light");
  if (opts.fence !== false)
    fence(b, rectPath(cx, cz, w + 4, d + 4), { height: 2.6, postGap: 3.5, outrigger: true, gaps: [[w / 2 - 3, w / 2 + 3]], damage: b.ruin ? 0.4 : 0 });
  return [cx - w / 2 + 8, gantryH, cz - d / 2 + 9];
}

export function buildSubstation(b: Build): THREE.Group {
  const w = b.rng.range(58, 76);
  const d = 52;
  const tie = substationYard(b, 0, 0, w, d);
  if (b.building) towerCrane(b, w / 2 - 6, d / 2 - 22, 30, 34, 2.6);
  const g = b.finish({ width: w + 8, depth: d + 8, height: 16 }, "substation");
  g.userData.gridTie = tie;
  return g;
}

// =================================================================== power station

function chimney(b: Build, x: number, z: number, h: number, r0: number, r1: number): Vec3 {
  const rings = 10;
  const prof: Array<[number, number]> = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    prof.push([r0 + (r1 - r0) * t, h * t]);
  }
  prof.push([r1 - 0.6, h]);
  const g = lathe(prof, 24);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const ink = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / h;
    // Soot-stained crown band; otherwise clean concrete.
    ink[i * 3] = b.pristine ? 0 : y > 0.93 ? 0.72 : y > 0.88 ? 0.2 : 0.03;
  }
  g.setAttribute("inkAttr", new THREE.BufferAttribute(ink, 3));
  b.add(g, { position: [x, 0, z] });
  // Gallery platforms with pen-line railings.
  for (const t of [0.62, 0.9]) {
    const y = h * t;
    const r = r0 + (r1 - r0) * t + 1.2;
    b.cyl(r, 0.5, x, y, z, "light", 20);
    const ring: Vec3[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ring.push([x + Math.cos(a) * r, y + 1.1, z + Math.sin(a) * r]);
    }
    b.polyline(ring, true);
    if (!b.ruin) for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.lamp(x + Math.cos(a) * r, y + 1.4, z + Math.sin(a) * r, 0.9, "signal", true);
    }
  }
  return [x, h, z];
}

export function buildPowerStation(b: Build, seed: Rng): THREE.Group {
  const twin = seed.chance(0.6) || b.pristine;
  // Turbine hall: long, tall, clerestory glazing and a shallow pitched roof.
  const hallL = 118,
    hallW = 36,
    hallH = 30;
  const hz = 20;
  if (b.building) {
    // Steel frame going up, cladding on the first third.
    for (let i = 0; i <= 12; i++) {
      const x = -hallL / 2 + (i * hallL) / 12;
      for (const z of [hz - hallW / 2, hz + hallW / 2]) b.box(0.9, hallH, 0.9, x, 0, z, "mid");
      b.beam([x, hallH, hz - hallW / 2], [x, hallH + 4, hz], 0.5, "mid");
      b.beam([x, hallH + 4, hz], [x, hallH, hz + hallW / 2], 0.5, "mid");
    }
    b.box(hallL * 0.35, hallH, hallW, -hallL / 2 + hallL * 0.175, 0, hz, "paper");
    for (const z of [hz - hallW / 2, hz + hallW / 2]) b.beam([-hallL / 2, hallH, z], [hallL / 2, hallH, z], 0.6, "mid");
    towerCrane(b, 10, hz + hallW / 2 + 12, hallH + 30, 50, 2.4);
    towerCrane(b, -30, hz - hallW / 2 - 14, hallH + 45, 58, 0.6);
  } else {
    b.box(hallL, hallH, hallW, 0, 0, hz, b.wear("paper"));
    b.add(gable(hallW, hallL, 4.5, 0.5), { tone: b.ruin ? "dark" : "light", position: [0, hallH, hz], rotation: [0, Math.PI / 2, 0] });
    // Clerestory glazing band and panel ribs.
    b.box(hallL + 0.2, 4, hallW + 0.2, 0, hallH - 7, hz, b.glass);
    for (let i = 0; i <= 16; i++) {
      const x = -hallL / 2 + (i * hallL) / 16;
      b.box(0.8, hallH, 0.5, x, 0, hz + hallW / 2 + 0.2, "paper");
      b.box(0.8, hallH, 0.5, x, 0, hz - hallW / 2 - 0.2, "paper");
    }
    // Big doors at the gable end.
    b.box(0.3, 14, 12, hallL / 2 + 0.1, 0, hz, "light");
    if (b.ruin) {
      // Roof burnt through in two places.
      b.box(26, 5, hallW + 1.4, -20, hallH - 0.5, hz, "solid");
      b.box(14, 4, hallW + 1.4, 30, hallH - 0.5, hz, "solid");
    }
  }
  // Boiler house: taller, with open steelwork crown and ducts.
  const bx = -20,
    bz = -22,
    bw = 54,
    bd = 40,
    bh = 58;
  if (!b.building) {
    b.box(bw, bh, bd, bx, 0, bz, b.wear("pale"));
    for (let i = 0; i <= 9; i++) b.box(0.7, bh, 0.5, bx - bw / 2 + (i * bw) / 9, 0, bz + bd / 2 + 0.2, "paper");
    for (let y = 12; y < bh; y += 11.5) b.box(bw + 0.4, 0.6, bd + 0.4, bx, y, bz, "light");
    // Steel crown.
    for (let i = 0; i <= 6; i++) {
      const x = bx - bw / 2 + (i * bw) / 6;
      b.box(0.6, 8, 0.6, x, bh, bz - bd / 2, "mid");
      b.box(0.6, 8, 0.6, x, bh, bz + bd / 2, "mid");
    }
    b.beam([bx - bw / 2, bh + 8, bz - bd / 2], [bx + bw / 2, bh + 8, bz - bd / 2], 0.6, "mid");
    b.beam([bx - bw / 2, bh + 8, bz + bd / 2], [bx + bw / 2, bh + 8, bz + bd / 2], 0.6, "mid");
    b.box(bw * 0.6, 6, bd * 0.6, bx, bh, bz, "light");
  } else {
    latticeMast(b, bx, bz, bh * 0.7, 30, 30, { panels: 6, leg: 0.8, solidBracing: true });
  }
  // Precipitators with hopper pyramids on columns.
  const px = 30,
    pz = -30;
  for (let u = 0; u < 2; u++) {
    const x = px + u * 18;
    b.box(15, 16, 26, x, 12, pz, b.wear("paper"));
    for (let i = 0; i < 3; i++) {
      const hop = new THREE.ConeGeometry(4.6, 6, 4, 1);
      b.add(hop, { tone: "light", position: [x, 9, pz - 8.6 + i * 8.6], rotation: [Math.PI, Math.PI / 4, 0] });
    }
    for (const [dx, dz] of [
      [-7, -12],
      [7, -12],
      [-7, 12],
      [7, 12],
    ])
      b.box(0.8, 12, 0.8, x + dx, 0, pz + dz, "mid");
  }
  // Flue duct to the stacks.
  b.box(40, 7, 7, 55, 20, pz, "pale");
  // Coal conveyor gallery on trestles.
  const c0: Vec3 = [95, 4, 60],
    c1: Vec3 = [bx + bw / 2, bh * 0.75, bz + 10];
  b.beam(c0, c1, 4.2, "paper", 3.4);
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const x = c0[0] + (c1[0] - c0[0]) * t,
      y = c0[1] + (c1[1] - c0[1]) * t,
      z = c0[2] + (c1[2] - c0[2]) * t;
    latticeMast(b, x, z, y - 2, 3, 2.2, { panels: Math.max(2, Math.round(y / 5)), leg: 0.25 });
  }
  // Stacks.
  const stacks: Vec3[] = [];
  const sh = 150 + seed.range(-5, 15);
  const sx = [80];
  if (twin) sx.push(104);
  for (const x of sx) {
    if (b.building && x !== 80) continue;
    const h = b.building ? sh * 0.6 : b.ruin && x !== 80 ? sh * 0.55 : sh;
    stacks.push(chimney(b, x, pz, h, 8, 5.2));
    if (b.building) scaffold(b, x, pz, 12, 12, h, 4, 3);
  }
  // Switchyard and a few transformers on the front.
  for (let i = 0; i < 3; i++) transformer(b, -40 + i * 14, hz + hallW / 2 + 12, 1.1);
  if (!b.building && !b.ruin)
    stacks.forEach((s, i) => {
      const plume = createPlume({
        origin: [s[0], s[1], s[2]],
        rng: seed.fork(`stack${i}`),
        count: 22,
        life: 30,
        height: 110,
        r0: 4.5,
        r1: 18,
        drift: [70, -30],
        wander: 6,
        tone: b.pristine ? 0 : 0.3,
        toneTop: b.pristine ? 0 : 0.14,
        thinFrom: 0.35,
        hatch: 0.6,
      });
      b.effect(plume);
    });
  if (b.ruin) {
    const smoke = createPlume({ origin: [-20, hallH, hz], rng: seed.fork("ruinsmoke"), count: 18, life: 24, height: 90, r0: 5, r1: 16, drift: [50, -20], tone: 0.62, toneTop: 0.4, thinFrom: 0.4, hatch: 0.5 });
    b.effect(smoke);
  }
  fence(b, rectPath(15, 0, 230, 150), { height: 2.8, postGap: 5, gaps: [[115 + 90, 115 + 100]], damage: b.ruin ? 0.35 : 0 });
  return b.finish({ width: 240, depth: 160, height: sh }, "power-station");
}

// =================================================================== wind turbines

function bladeGeometry(len: number): THREE.BufferGeometry {
  // Tapered, slightly twisted blade along +Y from the hub.
  const k = new Kit();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n,
      t1 = (i + 1) / n;
    const chord0 = t0 < 0.18 ? 1.2 + t0 * 18 : 4.2 * (1 - t0) + 0.5;
    const chord1 = t1 < 0.18 ? 1.2 + t1 * 18 : 4.2 * (1 - t1) + 0.5;
    const seg = new THREE.CylinderGeometry(0.5, 0.5, len / n, 6, 1, false);
    seg.scale(1, 1, 0.28);
    // Scale x by chord, applied as a taper within the segment.
    const pos = seg.getAttribute("position") as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const yy = pos.getY(v) / (len / n) + 0.5;
      const c = chord0 + (chord1 - chord0) * yy;
      const thick = t0 < 0.18 ? c * 0.9 : 1;
      pos.setX(v, pos.getX(v) * c);
      pos.setZ(v, pos.getZ(v) * thick);
    }
    seg.computeVertexNormals();
    k.add(seg, { tone: "paper", position: [0.35 * (1 - t0), len * (t0 + t1) * 0.5, 0], rotation: [0, 0.35 * (1 - t0), 0] });
  }
  return k.build();
}

interface RotorSlot {
  x: number;
  z: number;
  hub: number;
  yaw: number;
  phase: number;
  spin: number;
}

function rotorGeometry(rotorR: number, broken: boolean): THREE.BufferGeometry {
  const rk = new Kit();
  rk.add(new THREE.SphereGeometry(1.6, 10, 8), { tone: "paper", scale: [1, 1, 1.5] });
  const blade = bladeGeometry(rotorR);
  for (let i = 0; i < 3; i++) {
    if (broken && i === 2) continue;
    const g = blade.clone();
    if (broken && i === 1) {
      // Snapped blade: cut off a little beyond the root.
      const pos = g.getAttribute("position") as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) pos.setY(v, Math.min(pos.getY(v), rotorR * 0.42 + pos.getX(v) * 0.6));
      g.computeVertexNormals();
    }
    rk.addGeometry(g, new THREE.Matrix4().makeRotationZ((i * Math.PI * 2) / 3));
  }
  return rk.build();
}

function turbine(b: Build, x: number, z: number, hub: number, rotorR: number, yaw: number, opts: { collapsed?: boolean }): void {
  if (opts.collapsed) {
    // Buckled tower folded at mid height, nacelle in the field.
    const fold = hub * 0.45;
    b.add(lathe([[2.4, 0], [1.9, fold]], 14), { tone: "paper", position: [x, 0, z] });
    const dir = yaw + 0.6;
    const end: Vec3 = [x + Math.sin(dir) * (hub - fold), 2.2, z + Math.cos(dir) * (hub - fold)];
    b.rod([x, fold, z], end, 1.7, "paper", 12);
    b.box(10, 4, 4, end[0], 0, end[2], "light", { ry: dir });
    for (let i = 0; i < 2; i++) b.beam([end[0], 1, end[2]], [end[0] + Math.cos(dir + i * 2) * rotorR, 0.6, end[2] + Math.sin(dir + i * 2) * rotorR], 1.2, "paper", 0.4);
    return;
  }
  // Tapered tubular tower, base flange, door.
  b.add(lathe([[2.5, 0], [2.3, hub * 0.4], [1.75, hub - 2]], 16), { tone: b.wear("paper"), position: [x, 0, z] });
  b.cyl(3.4, 1.2, x, 0, z, "light", 12);
  b.box(1.2, 2.4, 0.2, x + Math.sin(yaw) * 2.5, 0.8, z + Math.cos(yaw) * 2.5, "dark", { ry: yaw });
  // Nacelle: static once yawed, so it merges into the body.
  const k = new Kit();
  k.add(new THREE.BoxGeometry(4.2, 4.2, 12), { tone: "paper", position: [0, 0, -2.2] });
  k.add(new THREE.BoxGeometry(4.3, 0.5, 12.1), { tone: "light", position: [0, -2, -2.2] });
  k.add(new THREE.BoxGeometry(1.2, 1, 1.5), { tone: "mid", position: [1, 2.5, -7] });
  b.k.addGeometry(k.build(), new THREE.Matrix4().makeRotationY(yaw).setPosition(x, hub, z));
  b.lamp(x, hub + 2.9, z, 0.9, "signal", true);
}

export function buildWindTurbines(b: Build, seed: Rng): THREE.Group {
  const n = b.pristine ? 5 : seed.int(3, 5);
  const gap = 150;
  const rotorR = 58;
  const yaw = b.pristine ? 0 : seed.range(-0.5, 0.5);
  const phase0 = seed.next() * 6;
  const slots: RotorSlot[] = [];
  const brokenSlots: RotorSlot[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap + (b.pristine ? 0 : seed.range(-15, 15));
    const z = b.pristine ? 0 : seed.range(-40, 40);
    const hub = b.pristine ? 92 : 88 + seed.range(-4, 6);
    const ph = b.pristine ? phase0 : seed.next() * 6;
    const ty = yaw + (b.pristine ? 0 : seed.range(-0.08, 0.08));
    const collapsed = b.ruin && i === 1;
    const broken = b.ruin && !collapsed && seed.chance(0.5);
    if (b.building && i === n - 1) {
      // Tower sections standing, nacelle and a blade waiting on the ground.
      b.add(lathe([[2.5, 0], [2.2, hub * 0.55]], 16), { tone: "paper", position: [x, 0, z] });
      b.box(10, 4, 4, x + 16, 0, z + 6, "light");
      b.add(new THREE.CylinderGeometry(1.8, 2, 28, 12), { tone: "paper", position: [x - 18, 2, z + 12], rotation: [0, 0, Math.PI / 2] });
      towerCrane(b, x + 12, z - 10, hub + 20, 42, 2.2, { slew: true });
      continue;
    }
    turbine(b, x, z, hub, rotorR, ty, { collapsed });
    if (collapsed) continue;
    // Pristine rotors turn in perfect unison; ruined ones hang still.
    const slot: RotorSlot = { x: x + Math.sin(ty) * 4.6, z: z + Math.cos(ty) * 4.6, hub, yaw: ty, phase: ph, spin: b.ruin ? 0 : 1.35 };
    (broken ? brokenSlots : slots).push(slot);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, "YXZ");
  const pv = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  for (const [list, broken] of [
    [slots, false],
    [brokenSlots, true],
  ] as const) {
    if (!list.length) continue;
    const rotors = new THREE.InstancedMesh(rotorGeometry(rotorR, broken), actorMaterial(0.2), list.length);
    rotors.name = broken ? "rotors-broken" : "rotors";
    rotors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pose = (t: number) => {
      list.forEach((sl, i) => {
        e.set(0, sl.yaw, sl.phase - t * sl.spin);
        q.setFromEuler(e);
        m.compose(pv.set(sl.x, sl.hub, sl.z), q, one);
        rotors.setMatrixAt(i, m);
      });
      rotors.instanceMatrix.needsUpdate = true;
    };
    pose(0);
    rotors.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 90, 0), gap * n * 0.5 + rotorR + 60);
    b.group.add(rotors);
    if (list.some((sl) => sl.spin)) b.tick((_dt, t) => pose(t));
  }
  b.blinkPeriod = 2.0;
  return b.finish({ width: gap * (n - 1) + 130, depth: 120, height: 150 }, "wind-turbines");
}

// =================================================================== solar farm

export function buildSolarFarm(b: Build, seed: Rng): THREE.Group {
  const rows = b.pristine ? 14 : seed.int(10, 13);
  const len = b.pristine ? 150 : seed.range(90, 130);
  const pitch = 8.5;
  const tilt = 0.5;
  const tableD = 4.2;
  const panelKit = new Kit();
  for (let r = 0; r < rows; r++) {
    const z = (r - (rows - 1) / 2) * pitch;
    const installed = b.building ? r < rows * 0.45 : true;
    const nTables = Math.round(len / 20);
    for (let t = 0; t < nTables; t++) {
      const x0 = -len / 2 + t * 20 + 0.6;
      const tw = 19;
      const cx = x0 + tw / 2;
      if (b.ruin && seed.chance(0.3)) {
        // Wrecked table: panels slewed off the rack.
        panelKit.add(new THREE.BoxGeometry(tw * 0.6, 0.08, tableD), { tone: "deep", position: [cx + seed.range(-3, 3), 0.4, z + 1.5], rotation: [seed.range(-1, 1), seed.range(-0.3, 0.3), seed.range(-0.4, 0.4)] });
        b.rod([cx - 4, 0, z], [cx - 4, 1.4, z + 0.6], 0.06, "mid");
        continue;
      }
      // Rack legs drawn as pen strokes; end frames solid.
      for (let p = 0; p <= 4; p++) {
        const px = x0 + (p * tw) / 4;
        if (p === 0 || p === 4) {
          b.box(0.12, 1.05, 0.12, px, 0, z + 1.2, "mid");
          b.box(0.12, 2.35, 0.12, px, 0, z - 1.1, "mid");
        } else {
          b.line([px, 0, z + 1.2], [px, 1.05, z + 1.2]);
          b.line([px, 0, z - 1.1], [px, 2.35, z - 1.1]);
        }
      }
      b.line([x0, 2.35, z - 1.2], [x0 + tw, 2.35, z - 1.2]);
      if (!installed) continue;
      // Panel table: near-black cells, pale frame, a white cell grid drawn over.
      panelKit.add(new THREE.BoxGeometry(tw, 0.07, tableD), { tone: b.pristine ? "deep" : 0.9, position: [cx, 1.7, z], rotation: [tilt, 0, 0] });
      panelKit.add(new THREE.BoxGeometry(tw, 0.1, 0.06), { tone: "paper", position: [cx, 1.7 + Math.sin(tilt) * tableD * 0.5, z - Math.cos(tilt) * tableD * 0.5] });
      const lo = (px: number): Vec3 => [px, 1.7 - Math.sin(tilt) * tableD * 0.5 + 0.07, z + Math.cos(tilt) * tableD * 0.5];
      const hi = (px: number): Vec3 => [px, 1.7 + Math.sin(tilt) * tableD * 0.5 + 0.07, z - Math.cos(tilt) * tableD * 0.5];
      for (let c = 1; c < 10; c++) {
        const px = x0 + (c * tw) / 10;
        b.paperLines.push(...lo(px), ...hi(px));
      }
      const mid = (t: number, px: number): Vec3 => {
        const a = lo(px),
          c = hi(px);
        return [px, a[1] + (c[1] - a[1]) * t + 0.01, a[2] + (c[2] - a[2]) * t];
      };
      b.paperLines.push(...mid(0.5, x0), ...mid(0.5, x0 + tw));
    }
  }
  b.k.addGeometry(panelKit.build());
  // Inverter stations and the fence.
  for (let i = 0; i < 2; i++) {
    const x = -len / 2 + len * (0.3 + i * 0.4);
    b.box(6, 3, 2.6, x, 0, (rows * pitch) / 2 + 5, b.wear("paper"));
    b.box(6.4, 0.3, 3, x, 3, (rows * pitch) / 2 + 5, "light");
    transformer(b, x + 7, (rows * pitch) / 2 + 5, 0.6);
  }
  fence(b, rectPath(0, 2, len + 16, rows * pitch + 20), { height: 2.4, postGap: 4, damage: b.ruin ? 0.3 : 0, solid: b.pristine });
  return b.finish({ width: len + 20, depth: rows * pitch + 24, height: 4 }, "solar-farm");
}

export { transformer, gantry, chimney };
