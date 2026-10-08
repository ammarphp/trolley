/**
 * Planting for civic plots: fruit trees, crops, sunflowers, hedges.
 * Merged into the owning structure's geometry. Living green (the `leaf`
 * pigment) is used sparingly and only while the land is alive.
 */
import * as THREE from "three";
import { cone, cylinder, jitter } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";
import type { Arch, M4, V3 } from "./arch.ts";

export interface Growth {
  /** 0..1 foliage. */
  leaves: number;
  /** 0..1 blossom (white crowns). */
  bloom: number;
  /** 0..1 dead / scorched. */
  dead: number;
  /** Uniform synthetic order: identical lollipop trees. */
  uniform: boolean;
  /** 0..1 living-green pigment amount for crops. */
  green: number;
}

export function growthFrom(a: Arch): Growth {
  const c = a.c;
  const dead = Math.max(c.drought * 0.9, c.ruin > 0.45 ? (c.ruin - 0.45) * 1.8 : 0, c.fire * 0.8);
  return {
    leaves: Math.max(0, c.leaves * (1 - Math.min(1, dead))),
    bloom: c.bloom,
    dead: Math.min(1, dead),
    uniform: c.sealed || c.order > 0.5,
    green: Math.max(0, Math.min(1, c.vegetation * (1 - dead) - 0.2)) * 0.55,
  };
}

/** A pruned fruit tree (apple/pear/plum) at (x, z) in frame f. */
export function fruitTree(a: Arch, f: M4 | null, x: number, z: number, scale: number, g: Rng, gr: Growth): void {
  const s = scale;
  if (gr.uniform) {
    // Machine order: a stick and a perfect ball, every one the same.
    a.add(cylinder(0.09, 0.11, 1.9, 6), f, { tone: "light", position: [x, 0.95, z] });
    a.add(new THREE.IcosahedronGeometry(1.35, 1), f, { tone: "pale", position: [x, 2.9, z] });
    return;
  }
  const trunkH = (1.3 + g.range(-0.2, 0.3)) * s;
  const lean = g.range(-0.12, 0.12);
  const top: V3 = [x + lean * trunkH, trunkH, z + g.range(-0.1, 0.1)];
  a.rod(f, [x, 0, z], top, 0.16 * s, "light", 7);
  const limbs = 3 + g.int(0, 1);
  const tips: V3[] = [];
  for (let i = 0; i < limbs; i++) {
    const ang = (i / limbs) * Math.PI * 2 + g.range(-0.4, 0.4);
    const out = (1.2 + g.range(0, 0.6)) * s;
    const up = (1.0 + g.range(0, 0.8)) * s;
    const tip: V3 = [top[0] + Math.cos(ang) * out, top[1] + up, top[2] + Math.sin(ang) * out];
    const broken = gr.dead > 0.5 && g.next() < gr.dead - 0.4;
    if (broken) {
      const mid: V3 = [(top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2, (top[2] + tip[2]) / 2];
      a.rod(f, top, mid, 0.08 * s, "mid", 5);
      continue;
    }
    a.rod(f, top, tip, 0.085 * s, "light", 5);
    tips.push(tip);
    if (gr.leaves < 0.35) {
      // Winter or dead: show the twig structure the crown would hide.
      for (let k = 0; k < 2; k++) {
        const a2 = ang + g.range(-0.9, 0.9);
        const t2: V3 = [tip[0] + Math.cos(a2) * 0.8 * s, tip[1] + g.range(0.3, 0.9) * s, tip[2] + Math.sin(a2) * 0.8 * s];
        a.rod(f, tip, t2, 0.04 * s, gr.dead > 0.5 ? "mid" : "light", 4);
      }
    }
  }
  if (gr.leaves < 0.25) return;
  const k = 0.55 + 0.45 * gr.leaves;
  const tone = gr.bloom > 0.55 ? "pale" : gr.dead > 0.3 ? "mid" : "light";
  // Crown: a lumpy mass of lobes clustered around the limb tips, flattened
  // underneath like a pruned apple, so light and shade break it into clumps.
  // A few smooth lobes: facet lines would read as low-poly, not foliage.
  const lobes: Array<[number, number, number, number]> = [[top[0], top[1] + 1.35 * s, top[2], 1.45]];
  for (const t of tips.slice(0, 3)) lobes.push([t[0] * 0.85 + top[0] * 0.15, t[1] + 0.05 * s, t[2] * 0.85 + top[2] * 0.15, 1.05]);
  for (let i = 0; i < lobes.length; i++) {
    const [bx, by, bz, rr] = lobes[i]!;
    const r = rr * s * k * g.range(0.92, 1.08);
    const geo = jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.08, g.next() * 100);
    a.add(geo, f, { tone, position: [bx, by + 0.2 * s, bz], scale: [1, 0.8, 1] });
  }
}

/** A row of vegetables along x from x0 to x1 at z (bed frame). */
export function cropRow(a: Arch, f: M4, x0: number, x1: number, z: number, kind: "cabbage" | "leek" | "potato", g: Rng, gr: Growth): void {
  const green = gr.green;
  const acc = green > 0.05 ? { accent: "leaf" as const, amt: green } : {};
  const n = Math.max(2, Math.floor((x1 - x0) / (kind === "leek" ? 0.4 : 0.55)));
  if (kind === "potato") {
    // Earthed-up ridge with leafy tops.
    a.cbox(f, (x0 + x1) / 2, 0.12, z, x1 - x0, 0.2, 0.34, "light", { rot: [Math.PI / 4, 0, 0] });
    if (gr.leaves > 0.2 && gr.dead < 0.6)
      for (let i = 0; i < n; i += 2) a.add(jitter(new THREE.OctahedronGeometry(0.24, 0), 0.06, i + z), f, { tone: "pale", position: [x0 + ((i + 0.5) * (x1 - x0)) / n, 0.32, z], scale: [1.4, 0.7, 1], ...acc });
    return;
  }
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n + g.range(-0.04, 0.04);
    if (gr.dead > 0.6 && g.next() < gr.dead) continue;
    if (kind === "cabbage") a.add(jitter(new THREE.OctahedronGeometry(0.21, 0), 0.05, x * 7 + z), f, { tone: "pale", position: [x, 0.2, z], scale: [1, 0.75, 1], ...acc });
    else a.add(cone(0.05, 0.55, 3), f, { tone: "light", position: [x, 0.3, z], ...acc });
  }
}

/** A sunflower: stalk, two leaves, a disc of solid ink ringed by white petals. */
export function sunflower(a: Arch, f: M4, x: number, z: number, h: number, g: Rng, gr: Growth): void {
  const dead = gr.dead > 0.4;
  a.add(cylinder(0.025, 0.035, h, 4, true), f, { tone: "light", position: [x, h / 2, z] });
  const face = new THREE.Matrix4().makeRotationX(dead ? 1.2 : -0.25 + g.range(-0.15, 0.15));
  face.setPosition(x, h, z + 0.05);
  const ff = f.clone().multiply(face);
  if (!dead) {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.32 : 0.16;
      pts.push(new THREE.Vector2(Math.cos(ang) * r, Math.sin(ang) * r));
    }
    a.add(new THREE.ShapeGeometry(new THREE.Shape(pts), 1), ff, { tone: "paper", position: [0, 0, 0.02] });
  }
  a.add(cylinder(0.13, 0.13, 0.06, 7), ff, { tone: dead ? "deep" : "solid", position: [0, 0, 0.05], rotation: [Math.PI / 2, 0, 0] });
  for (const s of [-1, 1]) {
    const leaf = new THREE.CircleGeometry(0.14, 5);
    a.add(leaf, f, { tone: "pale", position: [x + s * 0.14, h * 0.55, z], rotation: [0, 0, s * 0.6], scale: [1.6, 0.8, 1] });
  }
}

/** A clipped hedge along a line (frame f), height h. */
export function hedge(a: Arch, f: M4 | null, x0: number, z0: number, x1: number, z1: number, h: number, g: Rng, gr: Growth): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.6));
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    if (gr.dead > 0.5 && g.next() < gr.dead - 0.3) continue;
    const geo = jitter(new THREE.BoxGeometry(len / n + 0.25, h * g.range(0.9, 1.05), 0.9, 2, 1, 1), 0.08, i + x);
    a.add(geo, f, { tone: gr.dead > 0.4 ? "light" : "pale", position: [x, (h * 0.95) / 2, z], rotation: [0, -ang, 0] });
  }
}
