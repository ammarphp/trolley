/**
 * Trees: five deciduous species with real branching structure and clumped
 * canopies, two conifers, dead (drought-bleached) and burnt trees, and
 * uniform orchard rows.
 *
 * Proportions follow field-grown specimens:
 *   oak       14-19 m, crown wider than tall, massive bole, crooked limbs
 *   poplar    20-27 m Lombardy column, 3.5-5 m wide, steep branches from low
 *   birch     12-17 m, slender white stem with black lenticels, weeping tips
 *   willow    10-13.5 m weeping, curtain of branchlets to within 1 m of ground
 *   fruit     4.5-6.2 m apple, short crooked trunk, low domed crown
 *   spruce    16-24 m narrow cone of drooping tiers
 *   pine      15-21 m Scots pine: tall bare bole, flat cushion pads on top
 */
import * as THREE from "three";
import { Kit, cylinder, cone as coneGeo, type Tone } from "../../core/geometry.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import { Skeleton, along, assemble, centroid, fillCrown, groupClusters, mergeParts, path, twigFan, withSolidUv, type Cluster, type Limb } from "./plant.ts";
import type { CellKind } from "./atlas.ts";
import { TAU, UP, alignY, blob, clamp01, dirFrom, lerp, randomUnit, rod, taperTube, v3 } from "./shapes.ts";

export type DeciduousSpecies = "oak" | "poplar" | "birch" | "willow" | "fruit-tree";

// ------------------------------------------------------------------ oak

/** Hang a group of clusters on a limb: secondaries, clumps, winter twigs. */
function dressGroup(
  sk: Skeleton,
  rng: Rng,
  limb: Limb,
  group: Cluster[],
  opts: { stretch?: [number, number, number]; flatBottom?: number; flatTop?: number; twigs?: number; twigR?: number; droop?: number; up?: number; lump?: number; kind?: CellKind; twiglets?: number } = {},
): void {
  for (const q of group) {
    const from = along(limb, rng.range(0.45, 0.92));
    const mid = from.p.clone().lerp(q.c, 0.5).add(v3(0, q.r * 0.2, 0)).add(randomUnit(rng).multiplyScalar(q.r * 0.12));
    sk.limb({ pts: [from.p, mid, q.c.clone()], r0: Math.max(0.045, from.r * 0.6), r1: 0.03, level: 2, radial: 3, segments: 2, showBelow: 0.9 });
    sk.clump(rng, q.c, q.r, {
      detail: 4,
      stretch: opts.stretch ?? [1.1, 0.86, 1.1],
      flatBottom: opts.flatBottom ?? 0.7,
      flatTop: opts.flatTop,
      lump: opts.lump ?? 0.22,
      outward: q.dir,
      frags: 2,
      fragDetail: 4,
      kind: opts.kind ?? "broad",
      flatCard: q.dir.y < -0.35 || q.dir.y > 0.6,
    });
    twigFan(sk, rng, q.c, q.dir, q.r * 1.05, opts.twigs ?? 3, opts.twigR ?? 0.035, { up: opts.up ?? 0.25, spread: 0.7, twiglets: opts.twiglets ?? 0.55, droop: opts.droop ?? 0 });
  }
}

function oak(rng: Rng): Skeleton {
  const sk = new Skeleton("pale", "paper");
  const H = rng.range(14, 18.5);
  const W = H * rng.range(1.08, 1.28);
  const hb = rng.range(2.3, 3.2);
  const rB = rng.range(0.46, 0.6);
  const lean = v3(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3));
  const F = v3(lean.x, hb, lean.z);
  const F2 = v3(lean.x * 1.4 + rng.range(-0.3, 0.3), hb + H * 0.18, lean.z * 1.4 + rng.range(-0.3, 0.3));
  const trunk = sk.limb({
    pts: [v3(0, 0, 0), v3(lean.x * 0.25, hb * 0.45, lean.z * 0.25), F, F2],
    r0: rB,
    r1: rB * 0.5,
    level: 0,
    radial: 9,
    segments: 6,
    flare: 0.7,
    gnarl: 0.1,
  });
  const crownBase = hb + rng.range(1.0, 1.8);
  const C = v3(lean.x, crownBase + (H - crownBase) * 0.47, lean.z);
  const radii = v3(W / 2, (H - crownBase) * 0.55, (W / 2) * rng.range(0.88, 1));
  const k = W / 19;
  const clusters = fillCrown(rng, { centre: C, radii, count: 42, size: [1.75 * k, 2.4 * k], shell: 0.42, bottom: crownBase, lobes: 0.18, up: 0.2, pack: 0.55 });
  const az0 = rng.range(0, TAU);
  const groups = groupClusters(clusters, 5, az0, 0.8);
  for (const g of groups) {
    const cen = centroid(g);
    const high = cen.y > C.y;
    const start = along(trunk, high ? rng.range(0.78, 0.98) : rng.range(0.5, 0.66)).p;
    const end = cen.clone().lerp(C, 0.3);
    const toE = end.clone().sub(start);
    const horiz = v3(toE.x, 0, toE.z);
    const d = horiz.length();
    horiz.normalize();
    // Oak limbs go out low, elbow, then climb: the characteristic crook.
    const p1 = start.clone().addScaledVector(horiz, d * 0.36).add(v3(0, toE.y * (high ? 0.3 : 0.04), 0)).add(randomUnit(rng).multiplyScalar(0.35));
    const p2 = start.clone().addScaledVector(horiz, d * 0.7).add(v3(0, toE.y * (high ? 0.66 : 0.34), 0)).add(randomUnit(rng).multiplyScalar(0.45));
    const r0 = rB * rng.range(0.42, 0.52);
    const limb = sk.limb({ pts: [start, p1, p2, end], r0, r1: r0 * 0.32, level: 1, radial: 5, segments: 5, gnarl: 0.07 });
    dressGroup(sk, rng, limb, g, { twigs: 1, twigR: 0.04, twiglets: 0.9 });
  }
  return sk;
}

// --------------------------------------------------------------- poplar

function poplar(rng: Rng): Skeleton {
  const sk = new Skeleton("light", "paper");
  const H = rng.range(20, 27);
  const W = rng.range(3.8, 5);
  const rB = rng.range(0.32, 0.42);
  const env = (f: number) => (W / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp01(f), 0.72))), 0.7);
  const sway = v3(rng.range(-0.4, 0.4), 0, rng.range(-0.4, 0.4));
  const leader = sk.limb({
    pts: [v3(0, 0, 0), v3(sway.x * 0.2, H * 0.3, sway.z * 0.2), v3(sway.x * 0.6, H * 0.65, sway.z * 0.6), v3(sway.x, H * 0.99, sway.z)],
    r0: rB,
    r1: 0.03,
    level: 0,
    radial: 7,
    segments: 7,
    flare: 0.45,
    gnarl: 0.05,
  });
  // Clusters packed into the spindle: small, upright tufts.
  const clusters: Cluster[] = [];
  let attempts = 2000;
  while (clusters.length < 60 && attempts-- > 0) {
    const f = rng.range(0.1, 0.97);
    const e = env(f);
    const az = rng.range(0, TAU);
    const frac = Math.sqrt(rng.range(0.25, 1));
    const r = rng.range(0.85, 1.15) * lerp(0.75, 1, Math.min(1, e / 1.8));
    const c = v3(sway.x * f + Math.cos(az) * Math.max(0, e * frac - r * 0.4), H * f, sway.z * f + Math.sin(az) * Math.max(0, e * frac - r * 0.4));
    if (clusters.some((o) => o.c.distanceTo(c) < (o.r + r) * 0.6)) continue;
    clusters.push({ c, r, frac, dir: v3(Math.cos(az), 0.35, Math.sin(az)).normalize() });
  }
  clusters.sort((p, q) => p.c.y - q.c.y);
  // Bare structure: steep branches from low on the stem (the broom).
  const perBranch = 3;
  for (let i = 0; i < clusters.length; i += perBranch) {
    const g = clusters.slice(i, i + perBranch);
    const cen = centroid(g);
    const f = cen.y / H;
    const start = along(leader, Math.max(0.03, f * 0.72)).p;
    const tip = cen.clone().add(v3(0, 1.2, 0)).addScaledVector(v3(cen.x - sway.x * f, 0, cen.z - sway.z * f), 0.25);
    const mid = start.clone().lerp(tip, 0.5).addScaledVector(v3(tip.x - start.x, 0, tip.z - start.z), 0.25);
    const limb = sk.limb({ pts: [start, mid, tip], r0: rB * 0.26 * (1 - f * 0.6), r1: 0.025, level: 1, radial: 4, segments: 3 });
    for (const q of g) {
      sk.clump(rng, q.c, q.r, { detail: 3, stretch: [1, 1.5, 1], flatBottom: 0.85, lump: 0.2, outward: q.dir, frags: 2, fragDetail: 3, kind: "upright" });
      const s = along(limb, rng.range(0.5, 0.9)).p;
      const d = q.dir.clone().setY(0).multiplyScalar(0.22).add(v3(0, 1, 0)).normalize();
      sk.limb({ pts: [s, s.clone().addScaledVector(d, rng.range(1.3, 2.3))], r0: 0.028, r1: 0.008, level: 3, radial: 3, segments: 1, showBelow: 0.85 });
    }
  }
  sk.clump(rng, v3(sway.x, H * 0.95, sway.z), W * 0.2, { stretch: [1, 2.2, 1], flatBottom: 0.9, lump: 0.15, outward: v3(0, 1, 0), detail: 3, kind: "upright" });
  return sk;
}

// ---------------------------------------------------------------- birch

function birchBark(sk: Skeleton, rng: Rng, stem: Limb): void {
  const curve = new THREE.CatmullRomCurve3(stem.pts, false, "centripetal", 0.5);
  // Dark fissured base collar with a ragged top edge.
  const collarH = rng.range(0.5, 1.1);
  const collar = new THREE.CylinderGeometry(stem.r0 * 1.1, stem.r0 * 1.32, collarH, 9, 2, true);
  collar.translate(0, collarH / 2, 0);
  const pos = collar.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > collarH * 0.9) pos.setY(i, collarH * rng.range(0.55, 1.15));
    else if (pos.getY(i) > collarH * 0.4) pos.setY(i, pos.getY(i) * rng.range(0.8, 1.1));
  }
  collar.computeVertexNormals();
  sk.extra({ geo: collar, tone: "solid", matrix: new THREE.Matrix4().makeTranslation(stem.pts[0]!.x, -0.05, stem.pts[0]!.z) });
  // Horizontal lenticel dashes, denser low, gone near the crown top.
  const count = rng.int(12, 18);
  for (let i = 0; i < count; i++) {
    const t = Math.pow(rng.range(0.06, 0.8), 1.3);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = (stem.r0 + (stem.r1 - stem.r0) * t) * 1.06 + 0.004;
    const h = rng.range(0.03, 0.09) * (1 + (1 - t));
    const arc = rng.range(0.7, 2.1);
    const g = new THREE.CylinderGeometry(r, r, h, 4, 1, true, rng.range(0, TAU), arc);
    sk.extra({ geo: g, tone: "solid", matrix: alignY(p, tan) });
  }
}

function birch(rng: Rng, stems: number): Skeleton {
  const sk = new Skeleton("paper", "paper");
  const H = rng.range(12.5, 16.5);
  const W = H * rng.range(0.4, 0.46);
  const scale = stems > 1 ? 0.78 : 1;
  const az0 = rng.range(0, TAU);
  for (let s = 0; s < stems; s++) {
    const saz = az0 + (s * TAU) / stems + rng.range(-0.3, 0.3);
    const splay = stems > 1 ? rng.range(0.07, 0.13) : rng.range(0, 0.04);
    const base = stems > 1 ? v3(Math.cos(saz) * 0.2, 0, Math.sin(saz) * 0.2) : v3();
    const Hs = H * (s === 0 ? 1 : rng.range(0.78, 0.92));
    const topOff = v3(Math.cos(saz) * Hs * splay, 0, Math.sin(saz) * Hs * splay);
    const rB = rng.range(0.17, 0.23) * scale;
    const stem = sk.limb({
      pts: [
        base,
        base.clone().add(topOff.clone().multiplyScalar(0.3)).add(v3(rng.range(-0.15, 0.15), Hs * 0.33, rng.range(-0.15, 0.15))),
        base.clone().add(topOff.clone().multiplyScalar(0.65)).add(v3(rng.range(-0.25, 0.25), Hs * 0.66, rng.range(-0.25, 0.25))),
        base.clone().add(topOff).add(v3(0, Hs * 0.98, 0)),
      ],
      r0: rB,
      r1: 0.02,
      level: 0,
      radial: 7,
      segments: 7,
      flare: 0.35,
    });
    birchBark(sk, rng, stem);
    const bole = rng.range(0.24, 0.32);
    const cBase = Hs * bole;
    const C = base.clone().add(topOff.clone().multiplyScalar(0.62)).add(v3(0, cBase + (Hs - cBase) * 0.5, 0));
    if (stems > 1) C.add(v3(Math.cos(saz), 0, Math.sin(saz)).multiplyScalar(W * 0.12));
    const radii = v3((W / 2) * scale, (Hs - cBase) * 0.54, (W / 2) * scale);
    // An airy oval: clusters kept apart so the stem and limbs show through.
    const clusters = fillCrown(rng, {
      centre: C,
      radii,
      count: Math.round(26 * (stems > 1 ? 0.6 : 1)),
      size: [0.85 * scale, 1.15 * scale],
      shell: 0.35,
      bottom: cBase,
      lobes: 0.24,
      up: 0.05,
      pack: 0.95,
    });
    const nb = stems > 1 ? 5 : 8;
    const groups = groupClusters(clusters, nb, rng.range(0, TAU), 0.85);
    for (const g of groups) {
      const cen = centroid(g);
      const f = clamp01((cen.y - base.y) / Hs);
      const from = along(stem, clamp01(f * 0.82 - 0.04));
      const out = v3(cen.x - from.p.x, 0, cen.z - from.p.z);
      const Lb = Math.max(1.2, out.length() * 1.25);
      out.normalize();
      // Birch limbs rise, then their tips hang.
      const tip = cen.clone().addScaledVector(out, Lb * 0.25);
      tip.y -= 0.4;
      const mid = from.p.clone().lerp(tip, 0.5).add(v3(0, Lb * 0.18, 0));
      const limb = sk.limb({ pts: [from.p, mid, tip], r0: Math.max(0.03, from.r * 0.45), r1: 0.018, level: 1, radial: 4, segments: 3 });
      for (const q of g) {
        const at = along(limb, rng.range(0.5, 0.95));
        sk.limb({ pts: [at.p, at.p.clone().lerp(q.c, 0.5).add(v3(0, 0.15, 0)), q.c.clone()], r0: 0.025, r1: 0.012, level: 2, radial: 3, segments: 2, showBelow: 0.9 });
        sk.clump(rng, q.c, q.r, { detail: 3, stretch: [1, 1.2, 1], flatBottom: 1, flatTop: 0.8, lump: 0.28, outward: q.dir.clone().add(v3(0, -0.4, 0)), frags: 2, fragDetail: 3, kind: "droop" });
        twigFan(sk, rng, q.c, q.dir, q.r * 1.3, stems > 1 ? 1 : 2, 0.02, { up: -0.3, spread: 0.45, droop: 0.6, twiglets: stems > 1 ? 0.8 : 0.5 });
      }
    }
  }
  return sk;
}

// --------------------------------------------------------------- willow

interface Arch {
  az: number;
  R: number;
  top: number;
  keep: number;
}

/**
 * The weeping curtain: a pleated skirt hung from the arches, ragged at the
 * hem, parting between some arches. Pleats give the vertical strands.
 */
function willowCurtain(rng: Rng, centre: THREE.Vector3, arches: Arch[], L: number): THREE.BufferGeometry | null {
  if (L < 0.2) return null;
  const sorted = [...arches].sort((p, q) => p.az - q.az);
  const n = sorted.length;
  const at = (theta: number): { R: number; top: number } => {
    // Cosine interpolation between neighbouring arches (wrapping).
    let i = 0;
    while (i < n && sorted[i]!.az <= theta) i++;
    const a0 = sorted[(i - 1 + n) % n]!;
    const a1 = sorted[i % n]!;
    let span = a1.az - a0.az;
    let dt = theta - a0.az;
    if (span <= 0) span += TAU;
    if (dt < 0) dt += TAU;
    const t = (1 - Math.cos(Math.PI * clamp01(dt / span))) / 2;
    return { R: lerp(a0.R, a1.R, t), top: lerp(a0.top, a1.top, t) };
  };
  const samples = 64;
  const rings = 5;
  const pleats = 26;
  const pos: number[] = [];
  const idx: number[] = [];
  const hemRaise = (1 - clamp01((L - 0.2) / 0.7)) * 0.55;
  const cols: number[] = [];
  const hems: number[] = [];
  for (let i = 0; i <= samples; i++) hems.push(rng.range(0.4, 1.3) + (i % 2 ? rng.range(0.4, 1.4) : 0) + (rng.chance(0.15) ? rng.range(0.8, 1.8) : 0));
  hems[samples] = hems[0]!;
  const theta0 = rng.range(0, TAU);
  for (let i = 0; i <= samples; i++) {
    const theta = theta0 + (i / samples) * TAU;
    const th = ((theta % TAU) + TAU) % TAU;
    const { R, top } = at(th);
    const hem = lerp(hems[i]!, top, hemRaise);
    cols.push(pos.length / 3);
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      const u = (i / samples) * TAU;
      const pleat = (0.3 * Math.sin(u * pleats + 2.2 * Math.sin(u * 3)) + 0.14 * Math.sin(u * 47 + 1.3)) * Math.pow(t, 0.6);
      const r = R * lerp(0.7, 1.12, Math.pow(t, 0.75)) + pleat;
      const y = lerp(top, hem, t) + (t === 0 ? 0 : 0);
      pos.push(centre.x + Math.cos(theta) * r, y, centre.z + Math.sin(theta) * r);
    }
  }
  // Panels: strips of columns; some drop out as the leaves go.
  const panelSize = 4;
  for (let i = 0; i < samples; i++) {
    const panel = Math.floor(i / panelSize);
    const keep = ((Math.sin(panel * 12.9898 + centre.x) * 43758.5453) % 1 + 1) % 1;
    if (keep > lerp(-0.1, 0.9, clamp01((L - 0.2) / 0.65))) continue;
    for (let j = 0; j < rings; j++) {
      const a = cols[i]! + j;
      const b = cols[i + 1]! + j;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normals must face outward: flip if the winding produced inward normals.
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const p0 = new THREE.Vector3().fromBufferAttribute(g.getAttribute("position") as THREE.BufferAttribute, idx[0]!);
  const n0 = new THREE.Vector3().fromBufferAttribute(nrm, idx[0]!);
  if (n0.dot(p0.sub(centre).setY(0)) < 0) {
    for (let k = 0; k < idx.length; k += 3) {
      const tmp = idx[k + 1]!;
      idx[k + 1] = idx[k + 2]!;
      idx[k + 2] = tmp;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

interface WillowPlan {
  sk: Skeleton;
  centre: THREE.Vector3;
  arches: Arch[];
}

function willow(rng: Rng): WillowPlan {
  const sk = new Skeleton("light", "paper");
  const H = rng.range(10, 13.5);
  const W = rng.range(12, 15);
  const rB = rng.range(0.45, 0.6);
  const hb = rng.range(1.8, 2.5);
  const lean = v3(rng.range(-0.35, 0.35), 0, rng.range(-0.35, 0.35));
  const F = v3(lean.x, hb, lean.z);
  const trunk = sk.limb({
    pts: [v3(), v3(lean.x * 0.3 + rng.range(-0.1, 0.1), hb * 0.5, lean.z * 0.3), F],
    r0: rB,
    r1: rB * 0.78,
    level: 0,
    radial: 9,
    segments: 4,
    flare: 0.65,
    gnarl: 0.14,
  });
  const n = rng.int(5, 6);
  const az0 = rng.range(0, TAU);
  const arches: Arch[] = [];
  for (let i = 0; i < n; i++) {
    const az = az0 + (i * TAU) / n + rng.range(-0.25, 0.25);
    const out = v3(Math.cos(az), 0, Math.sin(az));
    const start = along(trunk, rng.range(0.75, 1)).p;
    const reach = W * rng.range(0.22, 0.3);
    const topY = H * rng.range(0.84, 0.97);
    const p1 = start.clone().addScaledVector(out, reach * 0.22).add(v3(0, (topY - hb) * 0.5, 0));
    const p2 = start.clone().addScaledVector(out, reach * 0.6).add(v3(0, (topY - hb) * 0.92, 0));
    const tip = start.clone().addScaledVector(out, reach).add(v3(0, topY - hb - 0.4, 0));
    const r0 = rB * rng.range(0.48, 0.58);
    const limb = sk.limb({ pts: [start, p1, p2, tip], r0, r1: r0 * 0.28, level: 1, radial: 6, segments: 5, gnarl: 0.08 });
    arches.push({ az: ((az % TAU) + TAU) % TAU, R: (reach + W * 0.12) * rng.range(0.85, 1.15), top: topY - 0.9, keep: rng.next() });
    // Winter whips: long pendulous strands from the arch.
    for (let w = 0; w < 5; w++) {
      const s = along(limb, rng.range(0.62, 1)).p;
      const wOut = out.clone().add(randomUnit(rng).multiplyScalar(0.7));
      wOut.y = 0;
      wOut.normalize();
      const endY = rng.range(0.6, 2.2);
      const pts = [
        s,
        s.clone().addScaledVector(wOut, 1.1).add(v3(0, 0.45, 0)),
        s.clone().addScaledVector(wOut, 1.9).add(v3(0, -(s.y - endY) * 0.25, 0)),
        s.clone().addScaledVector(wOut, 2.3).add(v3(0, -(s.y - endY) * 0.65, 0)),
        v3(s.x + wOut.x * 2.45, endY, s.z + wOut.z * 2.45),
      ];
      sk.limb({ pts, r0: 0.05, r1: 0.016, level: 3, radial: 3, segments: 4, showBelow: 0.7 });
    }
  }
  // The dome: a flattened cap of clusters over the arches.
  const dome = fillCrown(rng, {
    centre: v3(lean.x, H * 0.6, lean.z),
    radii: v3(W * 0.4, H * 0.4, W * 0.4),
    count: 40,
    size: [1.4, 1.9],
    shell: 0.45,
    bottom: H * 0.5,
    lobes: 0.12,
    up: 0.7,
    pack: 0.7,
  });
  for (const q of dome) {
    sk.clump(rng, q.c, q.r, { detail: 3, stretch: [1.15, 0.8, 1.15], flatBottom: 0.7, lump: 0.2, outward: q.dir, frags: 2, fragDetail: 3, kind: "broad", flatCard: q.dir.y > 0.6 });
  }
  return { sk, centre: F.clone().setY(0), arches };
}

function buildWillow(rng: Rng, leaves: number): THREE.BufferGeometry {
  const plan = willow(rng);
  // The curtain: strand cards hung round the rim of the dome, facing outward.
  const cr = rng.fork("curtain");
  const sorted = [...plan.arches].sort((p, q) => p.az - q.az);
  const n = sorted.length;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const az = (i / count) * TAU + cr.range(-0.08, 0.08);
    // Interpolate the arch ring.
    let j = 0;
    while (j < n && sorted[j]!.az <= az) j++;
    const a0 = sorted[(j - 1 + n) % n]!;
    const a1 = sorted[j % n]!;
    let span = a1.az - a0.az;
    let dt = az - a0.az;
    if (span <= 0) span += TAU;
    if (dt < 0) dt += TAU;
    const t = (1 - Math.cos(Math.PI * clamp01(dt / span))) / 2;
    const R = lerp(a0.R, a1.R, t) * cr.range(0.9, 1.04);
    // The curtain starts under the dome's edge, higher where an arch rises.
    const top = lerp(a0.top, a1.top, t) + cr.range(-2.2, 0.2);
    const hem = cr.range(0.5, 1.9);
    const w = cr.range(2.6, 3.4);
    const c = v3(plan.centre.x + Math.cos(az) * R, top, plan.centre.z + Math.sin(az) * R);
    plan.sk.clump(cr, c, w / 2, {
      kind: "curtain",
      cards: 2,
      aspect: (top - hem) / w,
      yaw: Math.PI / 2 - az,
      yawSpread: 0.5,
      outward: v3(Math.cos(az), 0, Math.sin(az)),
      frags: 0,
    });
  }
  return assemble(plan.sk, leaves);
}

// ----------------------------------------------------------- fruit tree

function fruitTree(rng: Rng): Skeleton {
  const sk = new Skeleton("light", "paper");
  const H = rng.range(4.5, 6.2);
  const W = rng.range(5.4, 7.2);
  const rB = rng.range(0.14, 0.19);
  const hb = rng.range(1.0, 1.4);
  const F = v3(rng.range(-0.3, 0.3), hb, rng.range(-0.3, 0.3));
  const trunk = sk.limb({
    pts: [v3(), v3(F.x * 0.2 + rng.range(-0.12, 0.12), hb * 0.4, F.z * 0.2 + rng.range(-0.12, 0.12)), v3(F.x * 0.7, hb * 0.8, F.z * 0.7), F],
    r0: rB,
    r1: rB * 0.8,
    level: 0,
    radial: 7,
    segments: 5,
    flare: 0.5,
    gnarl: 0.16,
  });
  const C = v3(F.x, hb + (H - hb) * 0.56, F.z);
  const clusters = fillCrown(rng, { centre: C, radii: v3(W / 2, (H - hb) * 0.46, W / 2), count: 20, size: [0.95, 1.25], shell: 0.4, bottom: hb + 0.5, lobes: 0.14, up: 0.3, pack: 0.66 });
  const n = rng.int(3, 4);
  const groups = groupClusters(clusters, n, rng.range(0, TAU), 0.85);
  for (const g of groups) {
    const cen = centroid(g);
    const start = along(trunk, rng.range(0.85, 1)).p;
    const end = cen.clone().lerp(C, 0.2);
    const pts = path(start, end, rng, 3, 0.12, 0.15);
    const limb = sk.limb({ pts, r0: rB * 0.7, r1: 0.035, level: 1, radial: 5, segments: 5, gnarl: 0.12 });
    dressGroup(sk, rng, limb, g, { twigs: 2, twigR: 0.025, up: 0.8, stretch: [1.15, 0.85, 1.15] });
  }
  return sk;
}

// --------------------------------------------------------------- spruce

/** One drooping tier of a spruce: an upper skirt and a shadowed underside, toothed hem. */
function spruceTier(R: number, h: number, teeth: number, rng: Rng): THREE.BufferGeometry {
  const n = teeth * 2;
  const droop = R * 0.2;
  const pos: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  };
  const apex = push(0, h, 0);
  const mid: number[] = [];
  const rimU: number[] = [];
  const rimL: number[] = [];
  const under: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-0.08, 0.08);
    const tooth = i % 2 === 0;
    const rr = tooth ? R * rng.range(0.95, 1.08) : R * rng.range(0.66, 0.76);
    const y = tooth ? -droop * rng.range(0.8, 1.2) : droop * 0.25;
    const c = Math.cos(a),
      s = Math.sin(a);
    mid.push(push(c * R * 0.5, h * 0.42, s * R * 0.5));
    rimU.push(push(c * rr, y, s * rr));
    rimL.push(push(c * rr, y, s * rr));
    under.push(push(c * R * 0.28, h * 0.3, s * R * 0.28));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(apex, mid[j]!, mid[i]!);
    idx.push(mid[i]!, mid[j]!, rimU[j]!, mid[i]!, rimU[j]!, rimU[i]!);
    idx.push(rimL[i]!, rimL[j]!, under[j]!, rimL[i]!, under[j]!, under[i]!);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function spruceGeometry(rng: Rng, opts: { dead?: boolean; burnt?: boolean } = {}): THREE.BufferGeometry {
  const k = new Kit();
  const H = rng.range(16, 24);
  const W = H * rng.range(0.3, 0.36);
  const rB = rng.range(0.25, 0.34);
  const y0 = rng.range(0.9, 1.8);
  const bark: Tone = opts.burnt ? "solid" : opts.dead ? "pale" : "mid";
  const topBreak = opts.dead || opts.burnt ? rng.range(0.7, 0.88) : 1;
  const Ht = H * topBreak;
  k.add(taperTube([v3(), v3(rng.range(-0.1, 0.1), H * 0.5, rng.range(-0.1, 0.1)), v3(0, Ht, 0)], rB, opts.dead || opts.burnt ? rB * (1 - topBreak) + 0.04 : 0.02, {
    radial: 7,
    segments: 4,
    flare: 0.35,
    cap: opts.dead || opts.burnt,
  }), { tone: bark });
  if (opts.dead || opts.burnt) {
    // Ghost spruce: whorls of short, stiff dead branches, longer below.
    let y = y0 * 0.6;
    while (y < Ht - 0.4) {
      const f = y / H;
      const whorl = rng.int(3, 5);
      const az0 = rng.range(0, TAU);
      for (let i = 0; i < whorl; i++) {
        if (rng.chance(opts.burnt ? 0.45 : 0.3)) continue;
        const az = az0 + (i * TAU) / whorl;
        const len = (W / 2) * (1 - f) * rng.range(0.35, 0.8) * (opts.burnt ? 0.6 : 1);
        const d = dirFrom(az, Math.PI / 2 + rng.range(0.05, 0.35));
        const s = v3(0, y, 0);
        k.add(taperTube([s, s.clone().addScaledVector(d, len)], 0.05 * (1 - f) + 0.015, 0.01, { radial: 3, segments: 1 }), { tone: bark });
      }
      y += rng.range(0.7, 1.1);
    }
    return k.build();
  }
  let y = y0;
  const tiers: Array<{ y: number; R: number; h: number }> = [];
  while (y < H - 1.6) {
    const f = (y - y0) / (H - y0);
    const spacing = lerp(1.55, 0.85, f) * rng.range(0.9, 1.1);
    const R = (W / 2) * Math.pow(1 - f, 0.95) * rng.range(0.92, 1.06) + 0.3;
    tiers.push({ y, R, h: spacing * 1.7 });
    y += spacing;
  }
  for (const t of tiers) {
    const g = spruceTier(t.R, t.h, t.R > 1.4 ? 8 : 6, rng);
    g.rotateY(rng.range(0, TAU));
    k.add(g, { tone: "light", position: [0, t.y, 0] });
  }
  k.add(coneGeo(0.35, 2.0, 6), { tone: "light", position: [0, H - 1.0, 0] });
  k.add(taperTube([v3(0, H - 1.2, 0), v3(0, H + 0.6, 0)], 0.04, 0.01, { radial: 3, segments: 1 }), { tone: "mid" });
  return k.build();
}

// ----------------------------------------------------------------- pine

function pine(rng: Rng): Skeleton {
  const sk = new Skeleton("light", "light");
  const H = rng.range(15, 21);
  const rB = rng.range(0.24, 0.32);
  const crownBase = H * rng.range(0.55, 0.66);
  const kink = v3(rng.range(-0.6, 0.6), 0, rng.range(-0.6, 0.6));
  const trunk = sk.limb({
    pts: [v3(), v3(kink.x * 0.2, H * 0.35, kink.z * 0.2), v3(kink.x * 0.6, H * 0.7, kink.z * 0.6), v3(kink.x, H * 0.94, kink.z)],
    r0: rB,
    r1: 0.06,
    level: 0,
    radial: 7,
    segments: 6,
    flare: 0.35,
    gnarl: 0.05,
  });
  // Dead lower branch stubs on the bole.
  for (let i = 0; i < rng.int(5, 8); i++) {
    const at = along(trunk, rng.range(0.2, crownBase / H - 0.05));
    const d = dirFrom(rng.range(0, TAU), Math.PI / 2 + rng.range(-0.1, 0.4));
    sk.limb({ pts: [at.p, at.p.clone().addScaledVector(d, rng.range(0.3, 0.9))], r0: 0.045, r1: 0.02, level: 1, radial: 3, segments: 1, cap: true });
  }
  const n = rng.int(5, 7);
  const az0 = rng.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const f = lerp(crownBase / H, 0.9, (i + rng.range(0, 0.7)) / n);
    const at = along(trunk, f / 0.94);
    const az = az0 + i * 2.39996 + rng.range(-0.3, 0.3);
    const out = v3(Math.cos(az), 0, Math.sin(az));
    const L = rng.range(2.2, 4) * (1 - (f - 0.55) * 0.9);
    const tip = at.p.clone().addScaledVector(out, L).add(v3(0, L * rng.range(0.12, 0.4), 0));
    const mid = at.p.clone().addScaledVector(out, L * 0.45).add(v3(0, L * rng.range(-0.05, 0.1), 0)).add(randomUnit(rng).multiplyScalar(0.25));
    const limb = sk.limb({ pts: [at.p, mid, tip], r0: at.r * 0.55, r1: 0.04, level: 1, radial: 5, segments: 4, gnarl: 0.08 });
    const pads = rng.chance(0.5) ? 2 : 1;
    for (let j = 0; j < pads; j++) {
      const pp = along(limb, j === 0 ? 0.95 : rng.range(0.55, 0.7)).p;
      const r = rng.range(1.5, 2.3) * (j === 0 ? 1 : 0.75);
      // A pine pad: a flat cushion of needle-masses, drawn as squat leaf cards.
      for (let c = 0; c < 3; c++) {
        const off = randomUnit(rng).multiply(v3(r * 0.55, r * 0.12, r * 0.5));
        sk.clump(rng, pp.clone().add(v3(0, r * 0.22, 0)).add(off), r * rng.range(0.62, 0.78), {
          stretch: [1.25, 0.58, 1.1],
          outward: out.clone().add(v3(0, 0.5, 0)),
          evergreen: true,
          kind: "broad",
          frags: 0,
          flatCard: c === 0,
        });
      }
    }
  }
  for (let c = 0; c < 4; c++) {
    const off = randomUnit(rng).multiply(v3(1.1, 0.25, 1.1));
    sk.clump(rng, v3(kink.x, H * 0.95, kink.z).add(off), rng.range(1.2, 1.5), { stretch: [1.2, 0.6, 1.2], evergreen: true, kind: "broad", frags: 0, flatCard: c === 0 });
  }
  return sk;
}

// ----------------------------------------------------------- dead trees

/**
 * Strip a skeleton to a dead tree: no foliage, few twigs, broken secondaries
 * and some limbs snapped with blunt caps.
 */
function kill(sk: Skeleton, rng: Rng, tone: Tone, severity: number): Skeleton {
  const out = new Skeleton(tone, tone);
  for (const l of sk.limbs) {
    if (l.level === 3) {
      if (rng.chance(severity * 0.9 + 0.1)) continue;
      out.limb({ ...l, showBelow: undefined, tone });
      continue;
    }
    if (l.level >= 1 && rng.chance(l.level === 1 ? severity * 0.45 : severity * 0.7)) {
      const t = rng.range(0.35, 0.8);
      const curve = new THREE.CatmullRomCurve3(l.pts, false, "centripetal", 0.5);
      const pts: THREE.Vector3[] = [];
      const m = Math.max(2, l.pts.length);
      for (let i = 0; i < m; i++) pts.push(curve.getPointAt((i / (m - 1)) * t));
      out.limb({ ...l, pts, r1: l.r0 + (l.r1 - l.r0) * t, cap: true, tone, showBelow: undefined });
      continue;
    }
    out.limb({ ...l, tone, showBelow: undefined });
  }
  for (const e of sk.extras) out.extra({ ...e, tone: tone === "solid" ? "solid" : e.tone });
  return out;
}

/** A broken snag: trunk snapped at 3-7 m with splinters and limb stubs. */
function snag(rng: Rng, tone: Tone, height: number, rB: number, splitTop: boolean): THREE.BufferGeometry {
  const k = new Kit();
  const lean = v3(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3));
  const top = v3(lean.x, height, lean.z);
  const trunk: Limb = { pts: [v3(), v3(lean.x * 0.3, height * 0.5, lean.z * 0.3), top], r0: rB, r1: rB * 0.72, level: 0 };
  k.add(taperTube(trunk.pts, trunk.r0, trunk.r1, { radial: 9, segments: 4, flare: 0.6, gnarl: 0.14, cap: true }), { tone });
  // Splinters at the break.
  const n = splitTop ? 2 : rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU);
    const s = top.clone().add(v3(Math.cos(a) * rB * 0.45, -0.05, Math.sin(a) * rB * 0.45));
    const len = splitTop ? rng.range(1.5, 3.2) : rng.range(0.35, 1.2);
    const d = v3(Math.cos(a) * (splitTop ? 0.2 : 0.12), 1, Math.sin(a) * (splitTop ? 0.2 : 0.12)).normalize();
    k.add(taperTube([s, s.clone().addScaledVector(d, len)], rB * (splitTop ? 0.45 : 0.28), 0.01, { radial: 4, segments: 1 }), { tone });
  }
  // Limb stubs.
  for (let i = 0; i < rng.int(2, 3); i++) {
    const at = along(trunk, rng.range(0.45, 0.9));
    const d = dirFrom(rng.range(0, TAU), rng.range(0.6, 1.1));
    const len = rng.range(0.6, 1.8);
    const end = at.p.clone().addScaledVector(d, len);
    k.add(taperTube([at.p, at.p.clone().lerp(end, 0.5).add(v3(0, 0.1, 0)), end], at.r * 0.45, at.r * 0.3, { radial: 5, segments: 2, cap: true }), { tone });
  }
  return k.build();
}

// --------------------------------------------------------------- orchard

function orchardTree(rng: Rng, style: number): Skeleton {
  // Built once per row, then copied: every tree identical.
  const sk = new Skeleton("light", "paper");
  const stemH = style === 1 ? 2.1 : 1.3;
  sk.limb({ pts: [v3(), v3(0, stemH + 0.3, 0)], r0: 0.09, r1: 0.07, level: 0, radial: 6, segments: 1, flare: 0.3 });
  // Stake and tie.
  sk.extra({ geo: rod(v3(0.28, -0.3, 0), v3(0.28, 1.5, 0), 0.03, 4), tone: "light" });
  sk.extra({ geo: rod(v3(0.02, 1.2, 0), v3(0.28, 1.2, 0), 0.02, 3), tone: "solid" });
  if (style === 0) {
    const top = v3(0, stemH, 0);
    for (let i = 0; i < 4; i++) {
      const az = (i * TAU) / 4 + 0.4;
      const out = v3(Math.cos(az), 0, Math.sin(az));
      const tip = top.clone().addScaledVector(out, 1.3).add(v3(0, 1.0, 0));
      const limb = sk.limb({ pts: [top, top.clone().addScaledVector(out, 0.6).add(v3(0, 0.3, 0)), tip], r0: 0.06, r1: 0.025, level: 1, radial: 4, segments: 3 });
      void limb;
      sk.clump(rng, tip.clone().add(v3(0, 0.3, 0)), 1.0, { stretch: [1.1, 0.9, 1.1], flatBottom: 0.6, lump: 0.12, outward: out.clone().add(v3(0, 0.5, 0)), kind: "broad", frags: 0 });
      sk.clump(rng, tip.clone().add(v3(-out.x * 0.5, 0.9, -out.z * 0.5)), 0.9, { stretch: [1.1, 0.9, 1.1], outward: out.clone().add(v3(0, 1, 0)), kind: "broad", frags: 0, flatCard: true });
      twigFan(sk, rng, tip, v3(0, 1, 0), 0.9, 3, 0.02, { up: 0.6, spread: 0.3, twiglets: 0 });
    }
    sk.clump(rng, top.clone().add(v3(0, 2.1, 0)), 1.05, { stretch: [1.1, 0.9, 1.1], flatBottom: 0.6, lump: 0.12, outward: v3(0, 1, 0), kind: "broad", frags: 0, flatCard: true });
    twigFan(sk, rng, top.clone().add(v3(0, 0.4, 0)), v3(0, 1, 0), 1.8, 3, 0.03, { up: 0.8, spread: 0.2, twiglets: 0.3 });
  } else if (style === 1) {
    // Lollipop standard: a perfect clipped sphere.
    sk.limb({ pts: [v3(0, stemH, 0), v3(0, stemH + 1.3, 0)], r0: 0.06, r1: 0.03, level: 1, radial: 5, segments: 1 });
    for (let i = 0; i < 5; i++) {
      const az = (i * TAU) / 5;
      const s = v3(0, stemH + 0.25, 0);
      sk.limb({ pts: [s, s.clone().add(v3(Math.cos(az) * 0.9, 0.8, Math.sin(az) * 0.9))], r0: 0.035, r1: 0.012, level: 2, radial: 3, segments: 1, showBelow: 0.7 });
    }
    sk.clump(rng, v3(0, stemH + 1.25, 0), 1.3, { stretch: [1, 1, 1], flatBottom: 1, lump: 0, detail: 2, frags: 0 });
  } else if (style === 2) {
    // Clipped cone.
    sk.limb({ pts: [v3(0, stemH, 0), v3(0, stemH + 3.2, 0)], r0: 0.06, r1: 0.015, level: 1, radial: 5, segments: 1 });
  }
  return sk;
}

function orchardRow(rng: Rng, variant: number, leaves: number): THREE.BufferGeometry {
  const style = variant % 5;
  const spacing = style === 0 || style === 3 ? 5 : 4;
  const count = ORCHARD_TILE / spacing;
  const L = clamp01(leaves);
  const parts: THREE.BufferGeometry[] = [];
  let unit: THREE.BufferGeometry;
  if (style === 2) {
    const u = new Kit();
    const s = lerp(0.35, 1, L);
    if (L > 0.05) {
      const c = new THREE.LatheGeometry(
        [new THREE.Vector2(0, 0), new THREE.Vector2(1.15 * s, 0.05), new THREE.Vector2(0.9 * s, 1.0 * s), new THREE.Vector2(0.001, 3.1 * s)],
        14,
      );
      u.add(c, { tone: "pale", position: [0, 1.4, 0] });
    }
    unit = mergeParts([assemble(orchardTree(rng, 2), L), ...(u.empty ? [] : [withSolidUv(u.build())])]);
  } else if (style === 3) {
    // Espalier: trees trained flat along wires between posts.
    const u = new Kit();
    u.add(taperTube([v3(), v3(0, 2.1, 0)], 0.08, 0.04, { radial: 5, segments: 1, flare: 0.3 }), { tone: "light" });
    for (const tier of [0.7, 1.3, 1.9]) {
      for (const side of [-1, 1]) {
        const pts = [v3(0, tier - 0.25, 0), v3(side * 0.5, tier, 0), v3(side * 2.35, tier + 0.04, 0)];
        u.add(taperTube(pts, 0.045, 0.02, { radial: 4, segments: 3 }), { tone: "light" });
        for (let i = 0; i < 4; i++) {
          const x = side * (0.6 + i * 0.48);
          if (L > 0.05 && rng.chance(0.4 + 0.6 * L)) {
            u.add(blob(0.32 * lerp(0.5, 1, L), { detail: 3, lump: 0.2, stretch: [1.2, 0.8, 0.8], seed: i + tier * 7 }), { tone: "pale", position: [x, tier + 0.12, 0] });
          } else {
            u.add(taperTube([v3(x, tier, 0), v3(x + side * 0.05, tier + 0.35, 0)], 0.018, 0.006, { radial: 3, segments: 1 }), { tone: "light" });
          }
        }
      }
    }
    unit = withSolidUv(u.build());
    const posts = new Kit();
    for (let i = 0; i < count; i++) {
      const x = -ORCHARD_TILE / 2 + i * spacing;
      posts.add(taperTube([v3(x, -0.2, -0.05), v3(x, 2.25, -0.05)], 0.06, 0.05, { radial: 5, segments: 1 }), { tone: "light" });
    }
    for (const tier of [0.7, 1.3, 1.9]) posts.add(rod(v3(-ORCHARD_TILE / 2, tier, -0.05), v3(ORCHARD_TILE / 2, tier, -0.05), 0.008, 3), { tone: "solid" });
    parts.push(withSolidUv(posts.build()));
  } else if (style === 4) {
    // Young whips in spiral guards: a new planting.
    const u = new Kit();
    u.add(cylinder(0.075, 0.08, 1.2, 8, true), { tone: "paper", position: [0, 0.6, 0] });
    u.add(cylinder(0.078, 0.078, 0.04, 8, true), { tone: "mid", position: [0, 1.18, 0] });
    u.add(rod(v3(0.1, -0.3, 0), v3(0.1, 1.35, 0), 0.018, 4), { tone: "light" });
    u.add(taperTube([v3(0, 0.9, 0), v3(0.05, 1.8, 0.02), v3(0.02, 2.5, 0)], 0.02, 0.006, { radial: 3, segments: 3 }), { tone: "light" });
    if (L > 0.05) {
      for (let i = 0; i < 3; i++) u.add(blob(0.2 * lerp(0.5, 1, L), { detail: 3, lump: 0.2, seed: i }), { tone: "pale", position: [0.04 + (i - 1) * 0.12, 1.9 + i * 0.22, 0] });
    }
    unit = withSolidUv(u.build());
  } else {
    unit = assemble(orchardTree(rng, style), L);
  }
  for (let i = 0; i < count; i++) {
    const x = -ORCHARD_TILE / 2 + spacing / 2 + i * spacing;
    const g = unit.clone();
    g.translate(x, 0, 0);
    parts.push(g);
  }
  return mergeParts(parts);
}

// ---------------------------------------------------------------- public

export const DECIDUOUS_VARIANTS = 4;
export const DECIDUOUS_VARIANT_NAMES = ["specimen A", "specimen B", "specimen C", "specimen D"] as const;
export const CONIFER_VARIANTS = 4;
/** Orchard rows repeat along X every 20 m. */
export const ORCHARD_TILE = 20;

export function buildDeciduous(species: DeciduousSpecies, variant: number, leaves: number): THREE.BufferGeometry {
  const rng = createRng(`nature:${species}:${variant}`);
  switch (species) {
    case "oak":
      return assemble(oak(rng), leaves);
    case "poplar":
      return assemble(poplar(rng), leaves);
    case "birch":
      return assemble(birch(rng, variant % 3 === 2 ? 3 : 1), leaves);
    case "willow":
      return buildWillow(rng, leaves);
    case "fruit-tree":
      return assemble(fruitTree(rng), leaves);
  }
}

export function buildConifer(kind: "spruce" | "pine", variant: number): THREE.BufferGeometry {
  const rng = createRng(`nature:${kind}:${variant}`);
  return kind === "spruce" ? spruceGeometry(rng) : assemble(pine(rng), 1);
}

export const DEAD_VARIANTS = ["stag-headed oak", "broken snag", "leaning birch", "ghost spruce"] as const;

/** Drought-killed, bleached trees. */
export function buildDeadTree(variant: number): THREE.BufferGeometry {
  const v = variant % DEAD_VARIANTS.length;
  const rng = createRng(`nature:tree-dead:${variant}`);
  if (v === 0) return assemble(kill(oak(rng.fork("oak")), rng, "pale", 0.55), 0);
  if (v === 1) return snag(rng, "pale", rng.range(4.5, 7), rng.range(0.4, 0.55), false);
  if (v === 2) {
    const g = assemble(kill(birch(rng.fork("birch"), 1), rng, "paper", 0.6), 0);
    g.rotateZ(rng.range(0.1, 0.16));
    g.rotateY(rng.range(0, TAU));
    return g;
  }
  return spruceGeometry(rng.fork("spruce"), { dead: true });
}

export const BURNT_VARIANTS = ["charred oak", "split snag", "charred pine poles", "smouldering stump", "burnt spruce"] as const;

/** Fire-killed trees: charred solid ink, with ember at the smouldering base. */
export function buildBurntTree(variant: number): THREE.BufferGeometry {
  const v = variant % BURNT_VARIANTS.length;
  const rng = createRng(`nature:tree-burnt:${variant}`);
  if (v === 0) return assemble(kill(oak(rng.fork("oak")), rng, "solid", 0.8), 0);
  if (v === 1) return snag(rng, "solid", rng.range(5, 8), rng.range(0.38, 0.5), true);
  if (v === 2) {
    const k = new Kit();
    for (let i = 0; i < 3; i++) {
      const base = v3(rng.range(-1.6, 1.6), 0, rng.range(-1.6, 1.6));
      const h = rng.range(8, 13);
      const top = base.clone().add(v3(rng.range(-0.5, 0.5), h, rng.range(-0.5, 0.5)));
      k.add(taperTube([base, base.clone().lerp(top, 0.5).add(v3(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2))), top], rng.range(0.18, 0.26), 0.06, { radial: 6, segments: 3, flare: 0.3, cap: true }), {
        tone: "solid",
      });
      for (let j = 0; j < rng.int(2, 4); j++) {
        const s = base.clone().lerp(top, rng.range(0.5, 0.95));
        const d = dirFrom(rng.range(0, TAU), rng.range(1.2, 1.9));
        k.add(taperTube([s, s.clone().addScaledVector(d, rng.range(0.4, 1.3))], 0.05, 0.02, { radial: 3, segments: 1, cap: true }), { tone: "solid" });
      }
    }
    return k.build();
  }
  if (v === 3) {
    const k = new Kit();
    k.addGeometry(snag(rng, "solid", rng.range(1.8, 2.8), rng.range(0.42, 0.55), false));
    // Glowing cracks at the foot and a low mound of ash.
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, TAU);
      const r = rng.range(0.45, 0.7);
      k.add(blob(rng.range(0.07, 0.13), { detail: 3, lump: 0.3, seed: i, stretch: [1, 0.7, 1] }), {
        tone: "paper",
        accent: "ember",
        position: [Math.cos(a) * r, rng.range(0.05, 0.5), Math.sin(a) * r],
      });
    }
    k.add(blob(1.3, { detail: 1, lump: 0.2, flatBottom: 0.05, flatTop: 0.12, seed: 3 }), { tone: "pale" });
    return k.build();
  }
  return spruceGeometry(rng.fork("spruce"), { burnt: true });
}

export const ORCHARD_VARIANTS = ["standard apple row", "lollipop standards", "clipped cones", "espalier on wires", "whips in guards"] as const;

export function buildOrchardRow(variant: number, leaves: number): THREE.BufferGeometry {
  // The rng is keyed by style only: every row of a style is the same row.
  const rng = createRng(`nature:orchard:${variant % ORCHARD_VARIANTS.length}`);
  return orchardRow(rng, variant, leaves);
}

export { UP };
