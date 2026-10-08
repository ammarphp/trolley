/**
 * Wild rabbit: 0.4 m long, sitting hunched with the long hind feet flat on
 * the ground, big eyes set on the sides of the head, tall ears with dark
 * tips, and a white scut that shows as it bolts. Moves only by hopping.
 */
import { V, blob } from "../parts.ts";
import { QUAD as Q } from "../rig.ts";
import { buildMammal, type MammalSpec } from "../mammal.ts";
import type { BuildCtx, BodyBuild } from "../body.ts";
import { registerCoats, stroke, fieldFill, spot, wash, type Paint } from "../coat.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";

function rabbitSpec(ctx: BuildCtx): MammalSpec {
  const th = ctx.thin;
  const w = 1 - 0.15 * th;
  return {
    torso: {
      z0: -0.15,
      z1: 0.11,
      yc: 0.11,
      rows: [
        [-0.15, 0.13, 0.06, 0.03, 2, 2],
        [-0.135, 0.185, 0.03, 0.062 * w, 2.2, 2.2],
        [-0.08, 0.222, 0.022, 0.075 * w, 2.2, 2.1],
        [-0.02, 0.228, 0.035, 0.07 * w, 2.1, 2.1],
        [0.04, 0.212, 0.05, 0.058, 2.1, 2.1],
        [0.085, 0.18, 0.07, 0.044, 2, 2],
        [0.11, 0.15, 0.1, 0.02, 2, 2],
      ],
      rings: 12,
      segs: 12,
      loinZ: -0.05,
    },
    neck: {
      path: [V(0, 0.14, 0.04), V(0, 0.17, 0.085), V(0, 0.2, 0.108)],
      keys: [
        [0, 0.045, 0.045, 0.05],
        [1, 0.034, 0.034, 0.034],
      ],
      rings: 5,
      segs: 10,
      joints: [0.3, 0.7],
    },
    neckBones: [V(0, 0.15, 0.055), V(0, 0.172, 0.088), V(0, 0.2, 0.108)],
    head: {
      path: [V(0, 0.236, 0.092), V(0, 0.216, 0.138), V(0, 0.18, 0.178)],
      keys: [
        [0, 0.024, 0.02, 0.024],
        [0.3, 0.034, 0.029, 0.034],
        [0.7, 0.027, 0.024, 0.027],
        [1, 0.015, 0.013, 0.013],
      ],
      rings: 7,
      segs: 10,
    },
    fore: {
      joints: (x) => [V(x * 0.03, 0.1, 0.07), V(x * 0.03, 0.06, 0.06), V(x * 0.028, 0.025, 0.075), V(x * 0.028, 0.01, 0.085), V(x * 0.028, 0.006, 0.1)],
      keys: [
        [0, 0.022, 0.02, 0.022],
        [1, 0.012, 0.011, 0.011],
        [2, 0.009, 0.009, 0.009],
        [4, 0.009, 0.008, 0.007],
      ],
      rings: 8,
      segs: 5,
      blend: 0.01,
    },
    hind: {
      joints: (x) => [V(x * 0.045, 0.1, -0.08), V(x * 0.05, 0.062, -0.015), V(x * 0.045, 0.018, -0.11), V(x * 0.045, 0.011, -0.04), V(x * 0.045, 0.008, -0.005)],
      keys: [
        [0, 0.042, 0.04, 0.05],
        [1, 0.03, 0.028, 0.035],
        [1.6, 0.015, 0.012, 0.016],
        [2, 0.012, 0.012, 0.012],
        [3, 0.012, 0.011, 0.01],
        [4, 0.01, 0.009, 0.007],
      ],
      rings: 9,
      segs: 5,
      blend: 0.012,
    },
    legTone: () => 0.3,
    foot: { kind: "paw", width: 0.018, length: 0.024, height: 0.012, tone: 0.1 },
    tail: {
      points: [V(0, 0.16, -0.135), V(0, 0.168, -0.155)],
      r0: 0.02,
      r1: 0.018,
      tone: 0,
      bones: [V(0, 0.16, -0.135), V(0, 0.165, -0.148), V(0, 0.168, -0.155)],
      rings: 3,
      segs: 6,
    },
    ear: {
      s: 0.18,
      theta: 0.42,
      dir: V(0.18, 1, -0.45),
      cup: V(1, 0, 0.7),
      length: 0.09,
      width: 0.042,
      thick: 0.004,
      tone: (s) => (s > 0.84 ? 0.95 : 0.25),
      shape: (s) => Math.sin(Math.PI * Math.pow(s, 0.6)) * 0.9 + 0.25 * (1 - s),
    },
    eye: { s: 0.42, theta: 1.35, r: 0.0095 },
    height: 0.24,
    length: 0.42,
    extras: (b) => {
      // Scut: a white puff.
      blob(b, V(0, 0.165, -0.15), [0.024, 0.022, 0.02], Q.tail1, 0, { w: 7, h: 5, jitter: 0.25 });
      // Whisker pad.
      blob(b, V(0, 0.18, 0.172), [0.017, 0.012, 0.012], Q.head, 0.1, { w: 6, h: 4 });
    },
  };
}

export function buildRabbit(ctx: BuildCtx): BodyBuild {
  return buildMammal(rabbitSpec(ctx), ctx);
}

function paintRabbit(p: Paint): void {
  const { g, rng, variant } = p;
  const base = variant % 2 ? 0.48 : 0.34;
  for (const r of [p.body, p.neck, p.head]) wash(g, r, base);
  // Agouti ticking.
  for (let i = 0; i < 900; i++) {
    const s = rng.next(),
      v = rng.next();
    stroke(g, p.body, [[s, v], [s - 0.012, v + 0.01]], 0.8, rng.range(0.25, 0.6));
  }
  // Pale belly and chin.
  g.save();
  g.fillStyle = "rgba(255,255,255,0.8)";
  const bh = p.body.y1 - p.body.y0;
  g.fillRect(p.body.x0 - 3, p.body.y0 - 3, p.body.x1 - p.body.x0 + 6, bh * 0.15);
  g.fillRect(p.body.x0 - 3, p.body.y1 - bh * 0.15, p.body.x1 - p.body.x0 + 6, bh * 0.15 + 3);
  g.restore();
  // Pale eye rings, dark nose.
  for (const ev of [0.28, 0.72]) spot(g, p.head, 0.42, ev, 0.07, 0.05, 0.25);
  spot(g, p.head, 0.98, 0.5, 0.05, 0.08, 0.7);
}

registerCoats("rabbit", { variants: 2, thin: false, painter: paintRabbit });

export const RABBIT_MOTION: QuadMotion = {
  walk: [0.45, 2.0],
  trot: [1.5, 3.0],
  run: [8, 4.8],
  runGait: "bound",
  hop: true,
  foreLen: 0.1,
  hindLen: 0.1,
  flex: 1,
  grazeY: 0.015,
  reach: [0.8, 0.3, 0.2],
  alert: [-0.55, -0.2, -0.1],
  stand: [0.1, 0.05, 0.1],
  lie: "loaf",
  lieDrop: 0.03,
  tailSwish: 0.1,
  tailRun: -0.6,
  tailStyle: "scut",
  skittish: 1,
  halfWidth: 0.07,
  scaleVar: 0.08,
  earRest: [0.0, -0.1],
  earAlert: [0.1, 0.25],
};

export const RABBIT: SpeciesDef = { id: "rabbit", kind: "quad", build: buildRabbit, variants: 2, hatch: 0.012, quad: RABBIT_MOTION, thinVariant: false };
