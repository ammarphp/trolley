/**
 * Rocks, boulders and stumps. Stones are faceted (flat-shaded cleavage
 * planes) so each face takes its own hatch density like an engraved rock.
 * Stumps carry growth rings as shallow terraces the contour pass picks up.
 */
import * as THREE from "three";
import { Kit, cylinder } from "../../core/geometry.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import { TAU, blade, stone, taperTube, v3 } from "./shapes.ts";

export const ROCK_VARIANTS = ["stone cluster", "field stone", "flat slab", "scree", "half-buried pair"] as const;
export const BOULDER_VARIANTS = ["erratic", "split boulder", "outcrop", "standing stone", "tumbled pile"] as const;
export const STUMP_VARIANTS = ["sawn stump", "sawn stump, large", "broken stump", "log pile", "felled trunk"] as const;

const mod = (v: number, n: number) => ((v % n) + n) % n;

export function buildRock(variant: number): THREE.BufferGeometry {
  const v = mod(variant, ROCK_VARIANTS.length);
  const rng = createRng(`nature:rock:${variant}`);
  const k = new Kit();
  const place = (size: [number, number, number], x: number, z: number, tone: "paper" | "pale" = "pale") => {
    const g = stone(size, rng, { cuts: rng.int(2, 4) });
    g.rotateY(rng.range(0, TAU));
    k.add(g, { tone, position: [x, 0, z] });
  };
  switch (ROCK_VARIANTS[v]) {
    case "stone cluster":
      place([0.55, 0.38, 0.45], 0, 0);
      place([0.3, 0.22, 0.28], 0.42, 0.15, "paper");
      place([0.22, 0.16, 0.2], -0.3, 0.3, "paper");
      place([0.18, 0.12, 0.16], 0.15, -0.35);
      break;
    case "field stone":
      place([0.8, 0.5, 0.65], 0, 0);
      break;
    case "flat slab": {
      const g = stone([1.3, 0.28, 0.9], rng, { cuts: 4, lump: 0.12, sink: 0.25 });
      k.add(g, { tone: "paper" });
      break;
    }
    case "scree":
      for (let i = 0; i < 9; i++) {
        const s = rng.range(0.12, 0.3);
        place([s, s * 0.7, s * 0.9], rng.range(-0.7, 0.7), rng.range(-0.5, 0.5), rng.chance(0.5) ? "paper" : "pale");
      }
      break;
    case "half-buried pair":
      place([0.7, 0.32, 0.5], -0.25, 0);
      place([0.5, 0.26, 0.42], 0.35, 0.2, "paper");
      break;
  }
  return k.build();
}

export function buildBoulder(variant: number): THREE.BufferGeometry {
  const v = mod(variant, BOULDER_VARIANTS.length);
  const rng = createRng(`nature:boulder:${variant}`);
  const k = new Kit();
  const grass = (x: number, z: number, r: number) => {
    for (let i = 0; i < 10; i++) {
      const a = rng.range(0, TAU);
      k.add(blade(v3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r), v3(Math.cos(a), 0, Math.sin(a)), rng.range(0.15, 0.3), 0.025, 0.4), { tone: "solid" });
    }
  };
  switch (BOULDER_VARIANTS[v]) {
    case "erratic": {
      const g = stone([2.6, 1.7, 2.1], rng, { cuts: 4, detail: 2, lump: 0.18 });
      k.add(g, { tone: "paper" });
      grass(0, 0, 1.15);
      break;
    }
    case "split boulder": {
      for (const side of [-1, 1]) {
        const g = stone([1.3, 1.6, 1.9], rng, { cuts: 3, detail: 2, lump: 0.15 });
        // A clean vertical split face.
        const p = g.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) if (p.getX(i) * side < 0) p.setX(i, p.getX(i) * 0.08);
        g.computeVertexNormals();
        k.add(g, { tone: "paper", position: [side * 0.18, 0, 0], rotation: [0, 0, side * 0.06] });
      }
      grass(0, 0, 1.05);
      break;
    }
    case "outcrop": {
      for (let i = 0; i < 3; i++) {
        const s = rng.range(1.4, 2.4);
        const g = stone([s * 1.3, s * 0.6, s], rng, { cuts: 4, detail: 2, lump: 0.15, sink: 0.3 });
        g.rotateY(rng.range(0, TAU));
        k.add(g, { tone: i === 0 ? "paper" : "pale", position: [i * 1.4 - 1.4 + rng.range(-0.2, 0.2), 0, rng.range(-0.6, 0.6)] });
      }
      grass(-0.5, 0.2, 1.6);
      break;
    }
    case "standing stone": {
      const g = stone([1.1, 3.1, 0.62], rng, { cuts: 6, detail: 1, lump: 0.3, sink: 0.06 });
      k.add(g, { tone: "pale", rotation: [0.04, 0, -0.05] });
      grass(0, 0, 0.5);
      break;
    }
    case "tumbled pile": {
      for (let i = 0; i < 6; i++) {
        const s = rng.range(0.6, 1.3);
        const g = stone([s * 1.2, s, s], rng, { cuts: 3, detail: 1 });
        g.rotateY(rng.range(0, TAU));
        const y = i > 3 ? rng.range(0.35, 0.6) : 0;
        k.add(g, { tone: rng.chance(0.5) ? "paper" : "pale", position: [rng.range(-1.2, 1.2), y, rng.range(-0.9, 0.9)] });
      }
      break;
    }
  }
  return k.build();
}

/** A sawn cut face: concentric rings as shallow terraces, plus a radial check. */
function cutFace(r: number, rings: number, rng: Rng): THREE.BufferGeometry {
  const profile: Array<[number, number]> = [[0, 0.004]];
  for (let i = 1; i <= rings; i++) {
    const rr = (i / rings) * r * 0.94;
    const step = i % 2 ? 0.006 : -0.004;
    profile.push([rr - 0.004, step + 0.004], [rr, step]);
  }
  profile.push([r, 0]);
  const g = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    r < 0.25 ? 10 : 16,
  );
  g.rotateY(rng.range(0, TAU));
  return g;
}

export function buildStump(variant: number): THREE.BufferGeometry {
  const v = mod(variant, STUMP_VARIANTS.length);
  const rng = createRng(`nature:stump:${variant}`);
  const k = new Kit();
  const stump = (r: number, h: number, x: number, z: number, tilt: number) => {
    k.add(taperTube([v3(x, -0.05, z), v3(x, h, z)], r, r * 0.94, { radial: 12, segments: 2, flare: 0.5, gnarl: 0.08 }), { tone: "light" });
    const face = cutFace(r * 0.93, Math.max(3, Math.round(r * 18)), rng);
    k.add(face, { tone: "paper", position: [x, h, z], rotation: [tilt, 0, tilt * 0.5] });
    // Roots flaring into the ground.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + rng.range(-0.4, 0.4);
      const d = v3(Math.cos(a), 0, Math.sin(a));
      k.add(taperTube([v3(x, h * 0.4, z).addScaledVector(d, r * 0.6), v3(x, 0.02, z).addScaledVector(d, r * 1.25), v3(x, -0.1, z).addScaledVector(d, r * 1.9)], r * 0.35, r * 0.1, { radial: 5, segments: 3 }), { tone: "light" });
    }
  };
  switch (STUMP_VARIANTS[v]) {
    case "sawn stump":
      stump(0.28, 0.45, 0, 0, 0.05);
      break;
    case "sawn stump, large":
      stump(0.55, 0.6, 0, 0, 0.08);
      break;
    case "broken stump": {
      const r = 0.38;
      k.add(taperTube([v3(0, -0.05, 0), v3(0, 0.9, 0)], r, r * 0.9, { radial: 12, segments: 3, flare: 0.5, gnarl: 0.1, cap: true }), { tone: "light" });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + rng.range(-0.3, 0.3);
        const s = v3(Math.cos(a) * r * 0.55, 0.85, Math.sin(a) * r * 0.55);
        k.add(taperTube([s, s.clone().add(v3(Math.cos(a) * 0.05, rng.range(0.25, 0.8), Math.sin(a) * 0.05))], r * 0.3, 0.01, { radial: 4, segments: 1 }), { tone: "light" });
      }
      break;
    }
    case "log pile": {
      // Cut lengths stacked in a pyramid, ends facing +Z.
      const rows = [4, 3, 2];
      let y = 0;
      rows.forEach((n, row) => {
        const r = 0.17;
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * r * 2.02;
          const len = rng.range(1.9, 2.3);
          const log = cylinder(r * rng.range(0.9, 1.05), r, len, 8);
          log.rotateX(Math.PI / 2);
          k.add(log, { tone: "light", position: [x, y + r, 0] });
          const face = cutFace(r * 0.95, 2, rng);
          face.rotateX(Math.PI / 2);
          k.add(face, { tone: "paper", position: [x, y + r, len / 2] });
        }
        y += 0.17 * 1.75;
        void row;
      });
      break;
    }
    case "felled trunk": {
      const len = rng.range(6, 8);
      const r = 0.36;
      const log = taperTube([v3(-len / 2, r, 0), v3(len / 2, r * 0.85, 0.1)], r, r * 0.7, { radial: 12, segments: 3, gnarl: 0.06 });
      k.add(log, { tone: "light" });
      const face = cutFace(r * 0.95, 7, rng);
      face.rotateZ(Math.PI / 2);
      k.add(face, { tone: "paper", position: [-len / 2, r, 0] });
      // Lopped branch stubs.
      for (let i = 0; i < 4; i++) {
        const x = rng.range(-len * 0.2, len * 0.45);
        const a = rng.range(0.4, 2.7);
        const s = v3(x, r, 0);
        k.add(taperTube([s, s.clone().add(v3(0.15, Math.sin(a) * 0.5, Math.cos(a) * 0.5))], 0.08, 0.06, { radial: 5, segments: 1, cap: true }), { tone: "light" });
      }
      break;
    }
  }
  return k.build();
}
