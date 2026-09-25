/**
 * Bushes and hedgerow segments. Both use the leaf-card foliage of the trees,
 * so a hedge and the oak behind it are drawn with the same pen.
 *
 * Hedgerow segments tile along local X every HEDGE_TILE metres; their shading
 * envelope is a cylinder along X, so neighbouring segments shade seamlessly.
 */
import * as THREE from "three";
import { createRng, type Rng } from "../../core/rng.ts";
import { paintGeometry } from "../../core/ink-material.ts";
import { Skeleton, assemble, fillCrown, twigFan, withSolidUv } from "./plant.ts";
import { NOISE, TAU, clamp01, lerp, randomUnit, v3 } from "./shapes.ts";

export const BUSH_VARIANTS = ["hawthorn", "elder", "bramble mound", "gorse", "sapling"] as const;
export const HEDGE_VARIANTS = ["field hedge", "field hedge, ragged", "hedge with standard", "clipped hedge", "gappy hedge"] as const;
export const HEDGE_TILE = 6;

function bush(rng: Rng, v: number): Skeleton {
  const sk = new Skeleton("light", "paper");
  const shape = BUSH_VARIANTS[v]!;
  let H = 2.4;
  let Wd = 2.8;
  let size: [number, number] = [0.5, 0.7];
  let kind: "broad" | "upright" | "droop" = "broad";
  let count = 16;
  if (shape === "elder") {
    H = rng.range(3.2, 3.8);
    Wd = rng.range(3.2, 3.8);
    size = [0.55, 0.75];
    count = 16;
  } else if (shape === "bramble mound") {
    H = rng.range(1.1, 1.4);
    Wd = rng.range(2.8, 3.4);
    size = [0.42, 0.58];
    count = 16;
  } else if (shape === "gorse") {
    H = rng.range(1.4, 1.8);
    Wd = rng.range(1.8, 2.2);
    size = [0.38, 0.5];
    kind = "upright";
    count = 18;
  } else if (shape === "sapling") {
    H = rng.range(3.2, 4);
    Wd = rng.range(1.6, 2.1);
    size = [0.42, 0.58];
    count = 10;
  } else {
    H = rng.range(2.2, 2.8);
    Wd = rng.range(2.6, 3.2);
  }
  const low = shape === "sapling" ? H * 0.45 : H * 0.12;
  const C = v3(0, low + (H - low) * 0.5, 0);
  const radii = v3(Wd / 2, (H - low) / 2, (Wd / 2) * rng.range(0.85, 1));
  sk.crownBlend = 0.8;
  const clusters = fillCrown(rng, { centre: C, radii, count, size, shell: 0.35, bottom: low, lobes: 0.2, up: 0.1, pack: 0.6 });
  // Stems: several from the root, or one stem for the sapling.
  const stems = shape === "sapling" ? 1 : rng.int(4, 6);
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * TAU + rng.range(-0.3, 0.3);
    const base = v3(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
    const top =
      shape === "sapling"
        ? v3(rng.range(-0.1, 0.1), H * 0.95, rng.range(-0.1, 0.1))
        : v3(Math.cos(a) * radii.x * 0.6, C.y + rng.range(-0.2, 0.5) * radii.y, Math.sin(a) * radii.z * 0.6);
    const arch = shape === "bramble mound" || shape === "elder";
    const mid = base.clone().lerp(top, 0.5).add(v3(0, arch ? radii.y * 0.5 : 0, 0));
    sk.limb({ pts: [base, mid, top], r0: shape === "sapling" ? 0.07 : 0.045, r1: 0.015, level: shape === "sapling" ? 0 : 1, radial: 4, segments: 3 });
    tops.push(top);
  }
  for (const q of clusters) {
    let best = tops[0]!;
    for (const t of tops) if (t.distanceTo(q.c) < best.distanceTo(q.c)) best = t;
    const from = best.clone().lerp(v3(0, best.y * 0.5, 0), 0.3);
    sk.limb({ pts: [from, from.clone().lerp(q.c, 0.5).add(v3(0, 0.1, 0)), q.c.clone()], r0: 0.025, r1: 0.01, level: 2, radial: 3, segments: 2, showBelow: 0.9 });
    sk.clump(rng, q.c, q.r, { kind, stretch: [1.1, 0.9, 1.1], outward: q.dir, frags: 0, flatCard: q.dir.y > 0.6 });
    twigFan(sk, rng, q.c, q.dir, q.r * 1.1, 3, 0.014, { up: shape === "gorse" ? 0.8 : 0.3, spread: 0.7, twiglets: 0.4 });
  }
  return sk;
}

function hedge(rng: Rng, v: number): Skeleton {
  const sk = new Skeleton("light", "paper");
  const style = HEDGE_VARIANTS[v]!;
  const L = HEDGE_TILE;
  const H = style === "clipped hedge" ? 1.7 : rng.range(2.0, 2.5);
  const D = style === "clipped hedge" ? 1.1 : rng.range(1.4, 1.8);
  // Shading envelope: an infinitely long cylinder along X.
  sk.crown = { c: v3(0, H * 0.35, 0), r: v3(1e4, H * 0.75, D * 0.7), blend: 0.85 };
  const clipped = style === "clipped hedge";
  const gappy = style === "gappy hedge";
  const n = clipped ? 22 : gappy ? 14 : 20;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + ((i + rng.range(0, 1)) / n) * L * 1.04;
    if (gappy && Math.abs(x - 0.6) < 1.1 && rng.chance(0.8)) continue;
    const row = i % 2;
    const top = clipped ? H - 0.35 : H * rng.range(0.62, 0.92);
    const y = row ? top : rng.range(0.55, 0.95);
    const z = rng.range(-D * 0.22, D * 0.22);
    const r = clipped ? 0.62 : rng.range(0.6, 0.85);
    sk.clump(rng, v3(x, y, z), r, {
      kind: clipped ? "hedge" : row ? "broad" : "hedge",
      cards: 2,
      yaw: rng.range(-0.3, 0.3),
      yawSpread: 1.0,
      stretch: clipped ? [1.2, 0.9, 1] : [1.15, 1, 1],
      frags: 0,
      flatCard: row === 1,
    });
  }
  if (style === "hedge with standard") {
    // A hedgerow standard: a young oak left to grow out of the hedge.
    const x = rng.range(-1.2, 1.2);
    sk.limb({ pts: [v3(x, 0, 0), v3(x + 0.2, 3, 0.1), v3(x + 0.1, 6.2, 0)], r0: 0.16, r1: 0.05, level: 0, radial: 6, segments: 4, flare: 0.3 });
    for (let i = 0; i < 9; i++) {
      const d = randomUnit(rng);
      d.y = Math.abs(d.y) * 0.8;
      const c = v3(x, 5.6, 0).add(d.multiplyScalar(rng.range(0.6, 1.6)).multiply(v3(1.3, 1, 1.3)));
      sk.clump(rng, c, rng.range(0.75, 1.0), { kind: "broad", frags: 0, flatCard: i < 2 });
      sk.limb({ pts: [v3(x + 0.1, rng.range(3.8, 5.2), 0), c], r0: 0.05, r1: 0.015, level: 2, radial: 3, segments: 1, showBelow: 0.9 });
      twigFan(sk, rng, c, c.clone().sub(v3(x, 5, 0)), 0.9, 3, 0.02, { up: 0.4 });
    }
  }
  // Winter stems: the laid, criss-crossed hawthorn and hazel the leaves hid.
  const stems = gappy ? 18 : 30;
  for (let i = 0; i < stems; i++) {
    const x = -L / 2 + rng.range(0, L);
    const lean = rng.range(-0.5, 0.5);
    const top = clipped ? H - 0.15 : H * rng.range(0.7, 1.05);
    const base = v3(x, -0.05, rng.range(-0.3, 0.3));
    const tip = v3(x + lean * top * 0.6, top, base.z + rng.range(-0.3, 0.3));
    const mid = base.clone().lerp(tip, 0.5).add(v3(rng.range(-0.2, 0.2), 0, 0));
    sk.limb({ pts: [base, mid, tip], r0: 0.035, r1: 0.008, level: 3, radial: 3, segments: 2, showBelow: clipped ? 0.3 : 0.85 });
  }
  return sk;
}

export function buildBush(variant: number, leaves: number): THREE.BufferGeometry {
  const v = ((variant % BUSH_VARIANTS.length) + BUSH_VARIANTS.length) % BUSH_VARIANTS.length;
  return assemble(bush(createRng(`nature:bush:${variant}`), v), clamp01(leaves));
}

/**
 * A clipped hedge: a crisp, battered block with softly lumpy faces, a flat
 * top and slightly rounded shoulders. Order imposed on a living thing.
 */
function clippedHedge(rng: Rng, leaves: number): THREE.BufferGeometry {
  const L = HEDGE_TILE;
  const H = 1.75;
  const W = 1.05;
  const g = new THREE.BoxGeometry(L + 0.04, H, W, 16, 5, 3);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const bare = 1 - clamp01(leaves);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i),
      y = p.getY(i) + H / 2,
      z = p.getZ(i);
    const t = y / H;
    // Batter: narrower at the top; shoulders rounded.
    z *= lerp(1, 0.84, t);
    const shoulder = Math.max(0, t - 0.85) / 0.15;
    if (Math.abs(z) > W * 0.3) y -= shoulder * shoulder * 0.08;
    const n = NOISE.n3(x * 2.2, y * 2.2, z * 2.2) * (0.035 + bare * 0.05);
    z += Math.sign(z) * n;
    if (t > 0.98) y += n * 0.5;
    p.setXYZ(i, x, Math.max(0, y), z);
  }
  g.computeVertexNormals();
  return withSolidUv(solidPartTone(g, bare > 0.5 ? "light" : "pale"));
}

function solidPartTone(g: THREE.BufferGeometry, tone: "pale" | "light"): THREE.BufferGeometry {
  const q = g.index ? g.toNonIndexed() : g;
  q.deleteAttribute("uv");
  paintGeometry(q, tone);
  return q;
}

export function buildHedge(variant: number, leaves: number): THREE.BufferGeometry {
  const v = ((variant % HEDGE_VARIANTS.length) + HEDGE_VARIANTS.length) % HEDGE_VARIANTS.length;
  if (HEDGE_VARIANTS[v] === "clipped hedge") return clippedHedge(createRng(`nature:hedge:${variant}`), leaves);
  return assemble(hedge(createRng(`nature:hedge:${variant}`), v), clamp01(leaves));
}
