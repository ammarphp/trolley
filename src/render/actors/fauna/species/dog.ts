/**
 * Farm collie: 0.53 m at the shoulder, deep chest and tucked loin, ruff at
 * the neck, semi-erect ears with folded tips, and a long low-carried brush
 * of a tail with a white tip that lifts and wags. Black saddle, white collar,
 * blaze and stockings.
 */
import { V, tuft } from "../parts.ts";
import { QUAD as Q } from "../rig.ts";
import { chainBlend } from "../skin.ts";
import { buildMammal, type MammalSpec } from "../mammal.ts";
import type { BuildCtx, BodyBuild } from "../body.ts";
import { registerCoats, stroke, fieldFill, wrapNoise, ribs, spot, wash, type Paint } from "../coat.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";

function dogSpec(ctx: BuildCtx): MammalSpec {
  const th = ctx.thin;
  const w = 1 - 0.2 * th;
  const coat = ctx.variant % 4;
  const tailTone = coat === 3 ? 0.35 : 0.97;
  return {
    torso: {
      z0: -0.33,
      z1: 0.31,
      yc: 0.4,
      rows: [
        [-0.33, 0.47, 0.36, 0.03, 2, 2],
        [-0.3, 0.52, 0.34, 0.075, 2.2, 2.2],
        [-0.2, 0.53, 0.325 + 0.02 * th, 0.1 * w, 2.3, 2.2],
        [-0.05, 0.52, 0.31 + 0.03 * th, 0.1 * w, 2.2, 2.1],
        [0.1, 0.53, 0.25 + 0.01 * th, 0.115 * w, 2.2, 2.0],
        [0.2, 0.55, 0.225, 0.11, 2.1, 2.0],
        [0.27, 0.52, 0.26, 0.09, 2, 2],
        [0.31, 0.46, 0.33, 0.035, 2, 2],
      ],
      rings: 16,
      segs: 14,
      loinZ: -0.08,
      bump: (s, a, z) =>
        (th > 0 ? 0.006 * th * Math.exp(-(((z - 0.08) / 0.1) ** 2) - ((a - 1.6) / 0.45) ** 2) * Math.cos(((z + 0.03 * a) / 0.035) * Math.PI * 2) : 0) +
        0.006 * Math.sin(a * 9 + z * 60) * Math.sin(z * 31),
    },
    neck: {
      path: [V(0, 0.45, 0.18), V(0, 0.52, 0.28), V(0, 0.575, 0.34)],
      keys: [
        [0, 0.1, 0.1, 0.13],
        [0.45, 0.08 * w, 0.085, 0.095],
        [1, 0.055, 0.055, 0.06],
      ],
      rings: 7,
      segs: 11,
      joints: [0.22, 0.6],
      // Ruff.
      bump: (s, a) => 0.012 * Math.sin(Math.PI * s) * (0.6 + 0.4 * Math.sin(a * 11 + s * 20)),
    },
    neckBones: [V(0, 0.46, 0.2), V(0, 0.52, 0.28), V(0, 0.58, 0.345)],
    head: {
      path: [V(0, 0.625, 0.315), V(0, 0.6, 0.43), V(0, 0.535, 0.56)],
      keys: [
        [0, 0.045, 0.035, 0.045],
        [0.14, 0.064, 0.05, 0.058, 2.3, 2.1],
        [0.36, 0.056, 0.045, 0.055],
        [0.5, 0.036, 0.032, 0.042],
        [0.84, 0.028, 0.026, 0.03],
        [1, 0.02, 0.018, 0.018],
      ],
      rings: 9,
      segs: 10,
      bump: (s, a) => 0.008 * Math.exp(-(((s - 0.42) / 0.06) ** 2) - ((a - 0.6) / 0.35) ** 2),
    },
    fore: {
      joints: (x) => [V(x * 0.075, 0.4, 0.19), V(x * 0.075, 0.265, 0.13), V(x * 0.07, 0.1, 0.15), V(x * 0.07, 0.035, 0.16), V(x * 0.07, 0.016, 0.185)],
      keys: [
        [0, 0.05, 0.05, 0.06],
        [1, 0.03, 0.028, 0.034],
        [1.6, 0.019, 0.018, 0.02],
        [2, 0.017, 0.016, 0.017],
        [3, 0.017, 0.016, 0.016],
        [4, 0.016, 0.015, 0.012],
      ],
      rings: 11,
      segs: 6,
      blend: 0.025,
    },
    hind: {
      joints: (x) => [V(x * 0.075, 0.44, -0.24), V(x * 0.085, 0.3, -0.16), V(x * 0.07, 0.14, -0.3), V(x * 0.07, 0.035, -0.28), V(x * 0.07, 0.016, -0.255)],
      keys: [
        [0, 0.055, 0.06, 0.085],
        [1, 0.04, 0.04, 0.065],
        [1.5, 0.026, 0.02, 0.034],
        [2, 0.017, 0.016, 0.021],
        [3, 0.017, 0.016, 0.016],
        [4, 0.016, 0.015, 0.012],
      ],
      rings: 12,
      segs: 6,
      blend: 0.03,
    },
    legTone: (_s, _v, p) => (coat === 3 ? 0.3 : p.y > 0.3 ? 0.97 : 0),
    foot: { kind: "paw", width: 0.042, length: 0.055, height: 0.028, tone: 0 },
    tail: {
      points: [V(0, 0.47, -0.31), V(0, 0.41, -0.39), V(0, 0.3, -0.44), V(0, 0.2, -0.46), V(0, 0.16, -0.5), V(0, 0.18, -0.56)],
      r0: 0.03,
      r1: 0.02,
      tone: (s) => (s > 0.82 ? 0 : tailTone),
      bones: [V(0, 0.47, -0.31), V(0, 0.33, -0.43), V(0, 0.19, -0.47)],
      rings: 9,
      segs: 6,
    },
    ear: {
      s: 0.12,
      theta: 0.95,
      dir: V(0.45, 1, -0.15),
      cup: V(0.3, 0, 1),
      length: 0.075,
      width: 0.055,
      droop: 0.025,
      tone: coat === 3 ? 0.3 : 0.97,
      shape: (s) => Math.sin(Math.PI * Math.pow(s, 0.7)) * (1 - 0.4 * s) + 0.25 * (1 - s),
    },
    eye: { s: 0.4, theta: 0.98, r: 0.011 },
    height: 0.55,
    length: 1.0,
    extras: (b, parts, d, c) => {
      // Feathering: a brush along the underside of the tail.
      const t0 = V(0, 0.4, -0.38),
        t1 = V(0, 0.25, -0.46),
        t2 = V(0, 0.16, -0.53);
      tuft(b, [t0, t1, t2], 0.04, (s) => chainBlend([Q.tail0, Q.tail1, Q.tail2], [0.3, 0.7], 0.1)(s), { tone: tailTone, seed: c.seed, detail: d, strands: 1 });
      void parts;
    },
  };
}

export function buildDog(ctx: BuildCtx): BodyBuild {
  return buildMammal(dogSpec(ctx), ctx);
}

function paintDog(p: Paint): void {
  const { g, noise, variant, thin, rng } = p;
  const coat = variant % 4;
  if (coat === 3) {
    // Merle/grey working dog: mottled.
    for (const r of [p.body, p.neck, p.head]) wash(g, r, 0.25);
    fieldFill(g, p.body, (s, v) => wrapNoise(noise, s, v, 0.7, 0.13, 7, 2) - 0.1, { grid: 48, edge: 0.03, ink: 0.85 });
  } else {
    // Black saddle over the back and sides; white belly, chest and collar.
    const extent = [0.72, 0.62, 0.85][coat]!;
    fieldFill(g, p.body, (s, v) => {
      const top = Math.cos((v - 0.5) * Math.PI * 2);
      const edge = wrapNoise(noise, s, v, 0.7, 0.13, 3.5, 2) * 0.25;
      const chest = s > 0.78 ? (s - 0.78) * 4 : 0;
      return top + extent - 1.1 + edge - chest - (s < 0.05 ? 0.4 : 0);
    }, { grid: 48, edge: 0.04 });
    // Neck: white collar at the base of the head, black behind.
    fieldFill(g, p.neck, (s, v) => {
      const top = Math.cos((v - 0.5) * Math.PI * 2);
      return top * 0.8 + 0.2 - (s > 0.35 && s < 0.75 ? 2 : 0) + wrapNoise(noise, s, v, 0.3, 0.08, 6, 2) * 0.3;
    }, { grid: 20, edge: 0.05 });
    // Head: black with a white blaze and muzzle.
    fieldFill(g, p.head, (s, v) => {
      const dv = Math.abs(v - 0.5);
      if (s > 0.55) return dv < 0.3 ? -1 : 0.5 - s;
      return dv < 0.03 + 0.12 * s ? -1 : 1;
    }, { grid: 24, edge: 0.05 });
  }
  for (const ev of [0.35, 0.65]) spot(g, p.head, 0.4, ev, 0.04, 0.03, 1);
  // Nose leather.
  spot(g, p.head, 0.98, 0.5, 0.05, 0.12, 1);
  // Coat lie: longer hair strokes.
  for (let i = 0; i < 220; i++) {
    const s = rng.next(),
      v = rng.range(0.05, 0.95);
    stroke(g, p.body, [[s, v], [s - 0.03, v + (v > 0.5 ? 0.04 : -0.04)]], 0.8, 0.25);
  }
  if (thin) ribs(g, p.body, { s0: 0.48, s1: 0.75, count: 8, vTop: 0.63, vBot: 0.83, slant: 0.04, width: 1.4, alpha: 0.6 });
}

registerCoats("dog", { variants: 4, thin: true, painter: paintDog });

export const DOG_MOTION: QuadMotion = {
  walk: [1.1, 1.6],
  trot: [2.6, 2.4],
  run: [9, 3.4],
  runGait: "gallop",
  foreLen: 0.4,
  hindLen: 0.44,
  flex: 1.2,
  grazeY: 0.05,
  reach: [0.75, 0.25, 0.1],
  alert: [-0.18, -0.08, 0.12],
  stand: [-0.05, 0.05, 0.1],
  lie: "sphinx",
  lieDrop: 0.25,
  tailSwish: 0.3,
  tailRun: 0.2,
  tailStyle: "wag",
  skittish: 0.35,
  halfWidth: 0.12,
  scaleVar: 0.06,
  earRest: [-0.15, 0],
  earAlert: [0.05, 0.3],
};

export const DOG: SpeciesDef = { id: "dog", kind: "quad", build: buildDog, variants: 4, hatch: 0.022, quad: DOG_MOTION, thinVariant: true };
