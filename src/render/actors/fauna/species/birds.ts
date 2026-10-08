/**
 * Chicken (hen), domestic goose and carrion crow.
 */
import * as THREE from "three";
import { V, blob, seg, taper } from "../parts.ts";
import { BIRD as W } from "../rig.ts";
import { buildBird, type BirdSpec } from "../bird.ts";
import type { BuildCtx, BodyBuild } from "../body.ts";
import { registerCoats, stroke, wash, spot, type Paint, type Px } from "../coat.ts";
import type { BirdMotion, SpeciesDef } from "../types.ts";

// ------------------------------------------------------------------ chicken

/** 0 white, 1 brown, 2 speckled, 3 black. */
const HEN_TONE = [0.02, 0.36, 0.06, 0.88];

function henSpec(ctx: BuildCtx): BirdSpec {
  const c = ctx.variant % 4;
  const t = HEN_TONE[c]!;
  const tailTone = c === 1 ? 0.85 : t;
  return {
    body: {
      // Horizontal wedge: full breast forward and low, back rising to the tail.
      path: [V(0, 0.255, -0.12), V(0, 0.235, 0.0), V(0, 0.235, 0.105)],
      keys: [
        [0, 0.05, 0.055, 0.04],
        [0.3, 0.088, 0.08, 0.09, 2.2, 2.2],
        [0.62, 0.09, 0.072, 0.1, 2.1, 2.3],
        [0.87, 0.07, 0.065, 0.088],
        [1, 0.035, 0.04, 0.045],
      ],
      rings: 10,
      segs: 12,
      bump: (s, a) => 0.004 * Math.sin(a * 10 + s * 30),
    },
    neck: {
      path: [V(0, 0.27, 0.075), V(0, 0.32, 0.1), V(0, 0.365, 0.11)],
      keys: [
        [0, 0.052, 0.05, 0.058],
        [0.6, 0.036, 0.036, 0.038],
        [1, 0.026, 0.026, 0.026],
      ],
      rings: 6,
      segs: 10,
      joints: [0.25, 0.65],
      // Hackles.
    },
    neckBones: [V(0, 0.28, 0.08), V(0, 0.32, 0.1), V(0, 0.365, 0.11)],
    head: {
      path: [V(0, 0.385, 0.09), V(0, 0.385, 0.12), V(0, 0.375, 0.145)],
      keys: [
        [0, 0.018, 0.017, 0.018],
        [0.45, 0.024, 0.023, 0.022],
        [1, 0.014, 0.012, 0.012],
      ],
      rings: 6,
      segs: 9,
    },
    beak: { points: [V(0, 0.373, 0.14), V(0, 0.368, 0.157), V(0, 0.358, 0.171)], r0: 0.0105, r1: 0.002, flat: 0.9, tone: 0.3 },
    eye: { s: 0.42, theta: 1.3, r: 0.0058 },
    wing: {
      path: [V(0.075, 0.265, 0.05), V(0.16, 0.275, 0.02), V(0.28, 0.275, -0.05)],
      keys: [
        [0, 0.012, 0.02, 0.105],
        [0.45, 0.01, 0.018, 0.11],
        [1, 0.004, 0.01, 0.035],
      ],
      wrist: 0.45,
      tone: t,
      folded: [0.78, 0.12, 1.05, 0.085],
    },
    tail: { path: [V(0, 0.27, -0.1), V(0, 0.29, -0.13), V(0, 0.31, -0.15)], width: [0.03, 0.035], thick: 0.02, tone: tailTone },
    leg: {
      thigh: V(0.045, 0.16, -0.005),
      ankle: V(0.042, 0.092, -0.012),
      foot: V(0.04, 0.012, 0.0),
      drum: [0.04, 0.05, 0.05],
      shank: 0.0075,
      toe: 0.045,
      tone: 0.18,
      drumTone: t,
    },
    bodyTone: t,
    height: 0.4,
    length: 0.4,
    extras: (b, parts, d) => {
      // Tail: a tall folded fan of feathers, each a flattened blade curving
      // back at the tip.
      const n = d > 0.7 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const a = 0.75 + f * 0.6; // from up-back to steeply up
        const base = V((f - 0.5) * 0.012, 0.28 + f * 0.01, -0.105);
        const len = 0.12 + 0.04 * Math.sin(f * Math.PI);
        const dir = V(0, Math.sin(a), -Math.cos(a));
        const tip = base.clone().addScaledVector(dir, len).add(V(0, -0.012, -0.025));
        const mid = base.clone().addScaledVector(dir, len * 0.55);
        taper(b, [base, mid, tip], 0.03, 0.01, {
          bones: W.tail,
          rings: seg(4, d, 3),
          segments: 4,
          tone: tailTone,
          flat: 0.22,
          up: V(1, 0, 0),
          profile: (s) => 1 - 0.7 * s * s,
        });
      }
      // Comb: a row of lobes along the crown; wattles under the beak.
      for (let i = 0; i < 4; i++) {
        const s = 0.12 + i * 0.22;
        const p = parts.head.pointAt(s, 0);
        const h = 0.019 * (1 - Math.abs(i - 1.2) * 0.2);
        blob(b, p.clone().add(V(0, h * 0.55, 0)), [0.004, h, 0.011], W.head, 0.85, { w: 4, h: 3 });
      }
      for (const sx of [-1, 1]) blob(b, V(sx * 0.006, 0.352, 0.147), [0.005, 0.012, 0.008], W.head, 0.85, { w: 4, h: 3 });
      void d;
    },
  };
}

function paintHen(p: Paint): void {
  const { g, rng, variant } = p;
  const c = variant % 4;
  const base = HEN_TONE[c]!;
  // Feather scallops: overlapping arcs, rows offset like shingles.
  const scallops = (r: Px, n: number, alpha: number, size: number) => {
    for (let i = 0; i < n; i++) {
      const s = rng.next(),
        v = rng.next();
      const [x, y] = [r.x0 + s * (r.x1 - r.x0), r.y0 + v * (r.y1 - r.y0)];
      g.strokeStyle = `rgba(0,0,0,${alpha})`;
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(x, y, size, 0.2, Math.PI - 0.2);
      g.stroke();
    }
  };
  if (c === 1) {
    for (const r of [p.body, p.neck, p.head]) wash(g, r, 0.15);
    scallops(p.body, 500, 0.5, 3);
    // Golden hackles: streaks down the neck.
    for (let i = 0; i < 60; i++) stroke(g, p.neck, [[rng.next(), rng.next()], [rng.next(), rng.next()]], 0.8, 0.35);
  } else if (c === 2) {
    scallops(p.body, 300, 0.3, 3);
    for (let i = 0; i < 380; i++) spot(g, p.body, rng.next(), rng.next(), 0.008, 0.01, 0.9);
    for (let i = 0; i < 80; i++) spot(g, p.neck, rng.next(), rng.next(), 0.03, 0.01, 0.9);
  } else if (c === 3) {
    for (const r of [p.body, p.neck, p.head]) wash(g, r, 0.8);
  } else {
    scallops(p.body, 380, 0.28, 3);
  }
  // Wing coverts on the spare strip.
  scallops(p.extra, 60, 0.4, 2.5);
  // Face: bare red skin reads as a mid tone around the eye.
  spot(g, p.head, 0.45, 0.25, 0.12, 0.08, 0.35);
  spot(g, p.head, 0.45, 0.75, 0.12, 0.08, 0.35);
  void base;
}

registerCoats("chicken", { variants: 4, thin: false, painter: paintHen });

export const HEN_MOTION: BirdMotion = {
  walkSpeed: 0.45,
  walkFreq: 2.2,
  runSpeed: 3.2,
  hops: false,
  flies: false,
  flySpeed: 0,
  flapFreq: 9,
  grazeY: 0.02,
  reach: [0.7, 0.5, 0.3],
  alert: [-0.3, -0.1, 0.1],
  stand: [0.0, 0.0, 0.0],
  sitDrop: 0.1,
  skittish: 0.7,
  scaleVar: 0.07,
  waddle: 0.03,
  headStabilise: true,
  wingFold: "overlay",
};

export function buildHen(ctx: BuildCtx): BodyBuild {
  return buildBird(henSpec(ctx), ctx);
}

export const CHICKEN: SpeciesDef = { id: "chicken", kind: "bird", build: buildHen, variants: 4, hatch: 0.012, bird: HEN_MOTION, thinVariant: false };

// -------------------------------------------------------------------- goose

function gooseSpec(ctx: BuildCtx): BirdSpec {
  const grey = ctx.variant % 2 === 1;
  const t = grey ? 0.3 : 0;
  return {
    body: {
      path: [V(0, 0.29, -0.31), V(0, 0.275, -0.05), V(0, 0.3, 0.2)],
      keys: [
        [0, 0.045, 0.05, 0.04],
        [0.2, 0.125, 0.1, 0.11],
        [0.55, 0.15, 0.11, 0.14, 2.2, 2.1],
        [0.85, 0.12, 0.095, 0.125],
        [1, 0.05, 0.05, 0.05],
      ],
      rings: 12,
      segs: 14,
    },
    neck: {
      path: [V(0, 0.34, 0.13), V(0, 0.44, 0.22), V(0, 0.56, 0.245), V(0, 0.665, 0.215)],
      keys: [
        [0, 0.082, 0.078, 0.085],
        [0.3, 0.052, 0.05, 0.054],
        [0.7, 0.04, 0.038, 0.04],
        [1, 0.035, 0.033, 0.034],
      ],
      rings: 9,
      segs: 9,
      joints: [0.2, 0.55],
    },
    neckBones: [V(0, 0.36, 0.15), V(0, 0.5, 0.24), V(0, 0.665, 0.215)],
    head: {
      path: [V(0, 0.69, 0.185), V(0, 0.69, 0.225), V(0, 0.672, 0.262)],
      keys: [
        [0, 0.028, 0.027, 0.028],
        [0.5, 0.034, 0.031, 0.032],
        [1, 0.024, 0.021, 0.022],
      ],
      rings: 6,
      segs: 9,
    },
    beak: { points: [V(0, 0.668, 0.256), V(0, 0.656, 0.292), V(0, 0.643, 0.326)], r0: 0.021, r1: 0.008, flat: 0.75, tone: 0.32 },
    eye: { s: 0.4, theta: 1.3, r: 0.0065 },
    wing: {
      path: [V(0.13, 0.35, 0.1), V(0.36, 0.37, 0.05), V(0.74, 0.37, -0.08)],
      keys: [
        [0, 0.02, 0.03, 0.26],
        [0.4, 0.016, 0.03, 0.23],
        [1, 0.005, 0.012, 0.06],
      ],
      wrist: 0.4,
      tone: grey ? 0.5 : 0,
      folded: [0.8, 0.08, 1.0, 0.13],
    },
    tail: { path: [V(0, 0.31, -0.29), V(0, 0.33, -0.35), V(0, 0.36, -0.39)], width: [0.05, 0.062], thick: 0.014, tone: grey ? 0.6 : 0 },
    leg: {
      thigh: V(0.075, 0.2, 0.0),
      ankle: V(0.072, 0.115, -0.012),
      foot: V(0.07, 0.012, 0.012),
      drum: [0.045, 0.05, 0.055],
      shank: 0.012,
      toe: 0.075,
      webbed: true,
      tone: 0.32,
      drumTone: t,
    },
    bodyTone: t,
    height: 0.72,
    length: 0.8,
  };
}

function paintGoose(p: Paint): void {
  const { g, rng, variant } = p;
  const grey = variant % 2 === 1;
  if (grey) {
    for (const r of [p.body, p.neck, p.head]) wash(g, r, 0.25);
    // Barred flanks: rows of pale-edged feathers.
    for (let row = 0; row < 12; row++) {
      for (let i = 0; i < 18; i++) {
        const s = (i + (row % 2) * 0.5) / 18;
        const v = 0.55 + row * 0.03;
        stroke(g, p.body, [[s, v], [s + 0.04, v + 0.005]], 1.2, 0.5);
        stroke(g, p.body, [[s, 1 - v], [s + 0.04, 1 - v - 0.005]], 1.2, 0.5);
      }
    }
    // Neck furrows.
    for (let i = 0; i < 30; i++) stroke(g, p.neck, [[rng.next(), 0.3 + rng.next() * 0.4], [rng.next(), 0.3 + rng.next() * 0.4]], 0.7, 0.4);
  } else {
    // White goose: only the lightest feather lines.
    for (let row = 0; row < 8; row++)
      for (let i = 0; i < 14; i++) {
        const s = (i + (row % 2) * 0.5) / 14;
        const v = 0.62 + row * 0.035;
        stroke(g, p.body, [[s, v], [s + 0.05, v + 0.004]], 0.8, 0.22);
        stroke(g, p.body, [[s, 1 - v], [s + 0.05, 1 - v - 0.004]], 0.8, 0.22);
      }
  }
}

registerCoats("goose", { variants: 2, thin: false, painter: paintGoose });

export const GOOSE_MOTION: BirdMotion = {
  walkSpeed: 0.55,
  walkFreq: 1.8,
  runSpeed: 2.6,
  hops: false,
  flies: false,
  flySpeed: 0,
  flapFreq: 4,
  grazeY: 0.03,
  reach: [1.0, 0.8, 0.4],
  alert: [-0.25, -0.2, 0.2],
  stand: [0.0, 0.0, 0.0],
  sitDrop: 0.2,
  skittish: 0.4,
  scaleVar: 0.06,
  waddle: 0.09,
  headStabilise: false,
  wingFold: "overlay",
};

export function buildGoose(ctx: BuildCtx): BodyBuild {
  return buildBird(gooseSpec(ctx), ctx);
}

export const GOOSE: SpeciesDef = { id: "goose", kind: "bird", build: buildGoose, variants: 2, hatch: 0.02, bird: GOOSE_MOTION, thinVariant: false };

// --------------------------------------------------------------------- crow

function crowSpec(_ctx: BuildCtx): BirdSpec {
  const t = 0.9;
  return {
    body: {
      path: [V(0, 0.17, -0.1), V(0, 0.2, -0.01), V(0, 0.24, 0.08)],
      keys: [
        [0, 0.028, 0.03, 0.028],
        [0.3, 0.06, 0.058, 0.065],
        [0.68, 0.062, 0.058, 0.07],
        [1, 0.035, 0.036, 0.042],
      ],
      rings: 9,
      segs: 10,
    },
    neck: {
      path: [V(0, 0.24, 0.05), V(0, 0.27, 0.085), V(0, 0.295, 0.1)],
      keys: [
        [0, 0.04, 0.042, 0.045],
        [1, 0.028, 0.03, 0.03],
      ],
      rings: 5,
      segs: 9,
      joints: [0.3, 0.7],
    },
    neckBones: [V(0, 0.245, 0.055), V(0, 0.27, 0.085), V(0, 0.295, 0.1)],
    head: {
      path: [V(0, 0.305, 0.08), V(0, 0.305, 0.115), V(0, 0.295, 0.14)],
      keys: [
        [0, 0.02, 0.02, 0.02],
        [0.45, 0.027, 0.025, 0.025],
        [1, 0.017, 0.015, 0.016],
      ],
      rings: 6,
      segs: 9,
    },
    beak: { points: [V(0, 0.294, 0.136), V(0, 0.293, 0.17), V(0, 0.285, 0.198)], r0: 0.014, r1: 0.002, flat: 1.25, tone: 1 },
    eye: { s: 0.5, theta: 1.25, r: 0.0055 },
    wing: {
      path: [V(0.035, 0.235, 0.04), V(0.2, 0.245, 0.0), V(0.42, 0.245, -0.07)],
      keys: [
        [0, 0.01, 0.022, 0.14],
        [0.45, 0.008, 0.02, 0.12],
        [0.8, 0.005, 0.012, 0.09],
        [1, 0.003, 0.006, 0.04],
      ],
      wrist: 0.45,
      tone: t,
      fingers: 5,
      fingerLen: 0.13,
    },
    tail: { path: [V(0, 0.19, -0.09), V(0, 0.175, -0.18), V(0, 0.16, -0.26)], width: [0.025, 0.05], thick: 0.006, tone: t, feathers: 6 },
    leg: {
      thigh: V(0.028, 0.14, -0.005),
      ankle: V(0.026, 0.1, -0.012),
      foot: V(0.025, 0.01, 0.0),
      drum: [0.022, 0.035, 0.03],
      shank: 0.0055,
      toe: 0.04,
      tone: 1,
      drumTone: t,
    },
    bodyTone: t,
    height: 0.31,
    length: 0.47,
    extras: (b, parts, d) => {
      // Shaggy throat hackles.
      const p = parts.neck.pointAt(0.6, Math.PI);
      blob(b, p, [0.022, 0.018, 0.02], W.neck2, 1, { w: seg(6, d, 4), h: 4, jitter: 0.3 });
      void taper;
    },
  };
}

function paintCrow(p: Paint): void {
  // Nearly solid; a few paler feather-edge lines give it form close up.
  const { g, rng } = p;
  for (const r of [p.body, p.neck, p.head, p.extra]) wash(g, r, 0.82);
  for (let i = 0; i < 90; i++) {
    const s = rng.next(),
      v = rng.range(0.55, 0.9);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1;
    const [x, y] = [p.body.x0 + s * (p.body.x1 - p.body.x0), p.body.y0 + v * (p.body.y1 - p.body.y0)];
    g.beginPath();
    g.arc(x, y, 3, 0.3, Math.PI - 0.3);
    g.stroke();
  }
}

registerCoats("crow", { variants: 1, thin: false, painter: paintCrow });

export const CROW_MOTION: BirdMotion = {
  walkSpeed: 0.5,
  walkFreq: 2.4,
  runSpeed: 1.6,
  hops: true,
  flies: true,
  flySpeed: 9,
  flapFreq: 3.2,
  grazeY: 0.02,
  reach: [0.9, 0.5, 0.35],
  alert: [-0.2, -0.1, 0.05],
  stand: [0.0, 0.0, 0.0],
  sitDrop: 0.07,
  skittish: 0.8,
  scaleVar: 0.05,
  waddle: 0.02,
  headStabilise: false,
};

export function buildCrow(ctx: BuildCtx): BodyBuild {
  return buildBird(crowSpec(ctx), ctx);
}

export const CROW: SpeciesDef = { id: "crow", kind: "bird", build: buildCrow, variants: 1, hatch: 0.012, bird: CROW_MOTION, thinVariant: false };

void THREE;
