/**
 * Suffolk-type ewe (and a white-faced hill breed): 0.75 m at the withers, a
 * boxy barrel of fleece about ten centimetres deep, clean black face and
 * legs, long drooping ears, docked woolly tail. The fleece is lumpy geometry
 * drawn in stipple with scribbled curls, the way engravers render wool.
 */
import { V } from "../parts.ts";
import { buildMammal, type MammalSpec } from "../mammal.ts";
import type { BuildCtx, BodyBuild } from "../body.ts";
import { registerCoats, stroke, wash, fieldFill, wrapNoise, ribs, spot, type Paint } from "../coat.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";

const lumps = (a: number, z: number, amp: number, seed: number) =>
  amp * (Math.sin(a * 6.1 + z * 21 + seed) * Math.cos(z * 15.3 - a * 4.7 + seed * 0.7) + 0.5 * Math.sin(a * 13.7 + z * 37 + seed * 1.9));

function sheepSpec(ctx: BuildCtx): MammalSpec {
  const th = ctx.thin;
  const w = 1 - 0.2 * th;
  const suffolk = ctx.variant % 3 !== 2;
  const dark = suffolk ? 0.92 : 0.1;
  const seed = ctx.seed;
  return {
    torso: {
      z0: -0.62,
      z1: 0.52,
      yc: 0.57,
      rows: [
        [-0.62, 0.62, 0.5, 0.05, 2, 2],
        [-0.58, 0.72, 0.39, 0.19 * w, 2.6, 2.4],
        [-0.45, 0.785 - 0.03 * th, 0.34 + 0.02 * th, 0.265 * w, 3.0, 2.6],
        [-0.2, 0.795 - 0.03 * th, 0.31 + 0.04 * th, 0.3 * w, 3.1, 2.6],
        [0.1, 0.8 - 0.03 * th, 0.31 + 0.04 * th, 0.3 * w, 3.1, 2.6],
        [0.32, 0.8 - 0.02 * th, 0.335 + 0.02 * th, 0.27 * w, 2.9, 2.5],
        [0.46, 0.73, 0.39, 0.205 * w, 2.4, 2.3],
        [0.52, 0.63, 0.47, 0.07, 2, 2],
      ],
      rings: 18,
      segs: 18,
      loinZ: -0.2,
      bump: (s, a, z) => lumps(a, z, 0.016 + 0.01 * th, seed) + (th > 0.5 ? 0.03 * Math.exp(-(((z + 0.42) / 0.06) ** 2) - ((a - 0.9) / 0.3) ** 2) : 0),
    },
    neck: {
      path: [V(0, 0.6, 0.28), V(0, 0.68, 0.45), V(0, 0.75, 0.55)],
      keys: [
        [0, 0.2 * w, 0.2, 0.23],
        [0.5, 0.15 * w, 0.15, 0.16],
        [1, 0.085, 0.085, 0.095],
      ],
      rings: 7,
      segs: 12,
      joints: [0.22, 0.6],
      bump: (s, a) => lumps(a, s, 0.012, seed + 3) * (1 - s),
    },
    neckBones: [V(0, 0.62, 0.33), V(0, 0.69, 0.47), V(0, 0.76, 0.56)],
    head: {
      path: [V(0, 0.83, 0.52), V(0, 0.74, 0.64), V(0, 0.6, 0.74)],
      keys: [
        [0, 0.055, 0.04, 0.055],
        [0.15, 0.072, 0.05, 0.08, 2.2, 2.1],
        [0.42, 0.062, 0.052, 0.07, 2.3, 2.1],
        [0.78, 0.043, 0.045, 0.048],
        [1, 0.032, 0.03, 0.03],
      ],
      rings: 8,
      segs: 11,
      // Roman nose: a convex bridge.
      bump: (s, a) => 0.01 * Math.exp(-(((s - 0.6) / 0.2) ** 2) - (a / 0.5) ** 2),
    },
    fore: {
      joints: (x) => [V(x * 0.12, 0.55, 0.33), V(x * 0.115, 0.38, 0.27), V(x * 0.1, 0.2, 0.29), V(x * 0.1, 0.06, 0.3), V(x * 0.1, 0.022, 0.33)],
      keys: [
        [0, 0.075, 0.075, 0.085],
        [1, 0.045, 0.04, 0.045],
        [1.5, 0.028, 0.026, 0.027],
        [2, 0.03, 0.028, 0.027],
        [2.3, 0.02, 0.018, 0.02],
        [3, 0.024, 0.022, 0.024],
        [4, 0.02, 0.018, 0.016],
      ],
      rings: 12,
      segs: 6,
    },
    hind: {
      joints: (x) => [V(x * 0.12, 0.6, -0.42), V(x * 0.13, 0.4, -0.3), V(x * 0.1, 0.24, -0.5), V(x * 0.1, 0.06, -0.47), V(x * 0.1, 0.022, -0.44)],
      keys: [
        [0, 0.09, 0.08, 0.14],
        [1, 0.07, 0.05, 0.16],
        [1.5, 0.04, 0.032, 0.05],
        [2, 0.028, 0.026, 0.034],
        [2.3, 0.02, 0.018, 0.02],
        [3, 0.024, 0.022, 0.024],
        [4, 0.02, 0.018, 0.016],
      ],
      rings: 13,
      segs: 6,
    },
    legTone: (_s, _v, p) => (p.y < 0.36 ? dark : 0),
    foot: { kind: "cloven", width: 0.05, length: 0.06, height: 0.035, tone: 0.92 },
    tail: {
      points: [V(0, 0.73, -0.59), V(0, 0.67, -0.66), V(0, 0.59, -0.68)],
      r0: 0.05,
      r1: 0.036,
      bones: [V(0, 0.73, -0.6), V(0, 0.67, -0.66), V(0, 0.6, -0.68)],
      rings: 5,
      segs: 6,
    },
    ear: { s: 0.13, theta: 1.5, dir: V(1, -0.3, -0.25), cup: V(0, -0.3, 1), length: 0.12, width: 0.055, droop: 0.015, tone: dark },
    eye: { s: 0.3, theta: 1.25, r: 0.012 },
    height: 0.8,
    length: 1.35,
  };
}

export function buildSheep(ctx: BuildCtx): BodyBuild {
  return buildMammal(sheepSpec(ctx), ctx);
}

function paintSheep(p: Paint): void {
  const { g, rng, noise, variant, thin } = p;
  const suffolk = variant % 3 !== 2;
  // Fleece: scribbled curls, denser in the shadowed underside.
  const curls = (r: typeof p.body, n: number) => {
    for (let i = 0; i < n; i++) {
      const s = rng.next();
      const v = rng.next();
      const under = Math.abs(Math.cos((v - 0.5) * Math.PI * 2) - 1) / 2; // 0 top, 1 belly
      if (rng.next() > 0.45 + 0.5 * under) continue;
      const cx = r.x0 + s * (r.x1 - r.x0);
      const cy = r.y0 + v * (r.y1 - r.y0);
      const rad = rng.range(1.6, 3.4);
      g.strokeStyle = `rgba(0,0,0,${0.3 + 0.35 * under})`;
      g.lineWidth = 0.9;
      g.beginPath();
      const a0 = rng.range(0, Math.PI * 2);
      g.arc(cx, cy, rad, a0, a0 + rng.range(3.5, 5.5));
      g.stroke();
    }
  };
  curls(p.body, 2600);
  curls(p.neck, 500);
  // Dirty belly and breech.
  fieldFill(g, p.body, (s, v) => {
    const under = -Math.cos((v - 0.5) * Math.PI * 2);
    return under - 0.72 + 0.25 * wrapNoise(noise, s, v, 1.2, 0.35, 3, 2) + (s < 0.08 ? 0.3 : 0);
  }, { grid: 40, edge: 0.08, ink: 0.35 });
  if (thin) {
    // Ragged fleece: pulled tufts, bare patches, ribs showing through.
    fieldFill(g, p.body, (s, v) => wrapNoise(noise, s, v, 1.2, 0.35, 4.5, 2, 20) - 0.35, { grid: 40, edge: 0.04, ink: 0.4 });
    ribs(g, p.body, { s0: 0.42, s1: 0.7, count: 7, vTop: 0.64, vBot: 0.8, slant: 0.04, width: 1.4, alpha: 0.45 });
  }
  // Face.
  if (suffolk) {
    wash(g, p.head, 1);
    // A few grey hairs where the wool meets the face.
    for (let i = 0; i < 20; i++) stroke(g, p.neck, [[0.9 + rng.range(0, 0.1), rng.next()], [1, rng.next()]], 1, 0.5);
  } else {
    wash(g, p.head, 0.08);
    spot(g, p.head, 0.95, 0.5, 0.08, 0.2, 0.9);
    for (const ev of [0.29, 0.71]) spot(g, p.head, 0.3, ev, 0.06, 0.04, 0.8);
  }
  void noise;
}

registerCoats("sheep", { variants: 3, thin: true, painter: paintSheep });

export const SHEEP_MOTION: QuadMotion = {
  walk: [0.9, 1.35],
  trot: [2.0, 2.3],
  run: [5.5, 3.1],
  runGait: "gallop",
  foreLen: 0.55,
  hindLen: 0.6,
  flex: 1.1,
  grazeY: 0.03,
  reach: [0.9, 0.18, -0.2],
  alert: [-0.25, -0.1, -0.15],
  stand: [0.15, 0.05, 0.1],
  lie: "sternal",
  lieDrop: 0.3,
  tailSwish: 0.3,
  tailRun: -0.2,
  tailStyle: "hang",
  skittish: 0.55,
  halfWidth: 0.3,
  scaleVar: 0.06,
  earRest: [-0.25, 0],
  earAlert: [0.05, 0.4],
};

export const SHEEP: SpeciesDef = { id: "sheep", kind: "quad", build: buildSheep, variants: 3, hatch: 0.028, pattern: "stipple", quad: SHEEP_MOTION, thinVariant: true };
