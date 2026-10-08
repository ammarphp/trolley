/**
 * Riding horse, about 16 hands (1.62 m at the withers): long clean legs,
 * deep girth, rounded quarters, an arched neck with a mane that falls to one
 * side, a long head with upright ears, a forelock, and a full tail. Coats:
 * bay with black points, chestnut, dapple grey, dark bay; white face
 * markings and socks by seed.
 */
import * as THREE from "three";
import { V, blob, seg, taper, tuft } from "../parts.ts";
import { loft } from "../loft.ts";
import { chainBlend } from "../skin.ts";
import { QUAD as Q } from "../rig.ts";
import { buildMammal, type MammalSpec } from "../mammal.ts";
import { surface as surfaceAt, type BuildCtx, type BodyBuild } from "../body.ts";
import { registerCoats, stroke, wash, fieldFill, wrapNoise, ribs, spot, type Paint } from "../coat.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";

/** Mane / points tone per coat. */
const MANE = [0.95, 0.5, 0.42, 1];
/** Body wash per coat: kept light so lighting, not paint, makes the tone. */
const HORSE_BASE = [0.3, 0.2, 0.04, 0.44];
const POINTS = [0.88, 0.3, 0.45, 0.95];

function horseSpec(ctx: BuildCtx): MammalSpec {
  const th = ctx.thin;
  const w = 1 - 0.14 * th;
  const coat = ctx.variant % 4;
  const mane = MANE[coat]!;
  const points = POINTS[coat]!;
  // White socks on some legs, by variant.
  const socks = [0, 0b0100, 0b0011, 0b1000][coat]!;
  return {
    torso: {
      z0: -0.88,
      z1: 0.82,
      yc: 1.25,
      rows: [
        [-0.88, 1.36, 1.14, 0.05, 2, 2],
        [-0.84, 1.5, 1.02, 0.16, 2.2, 2.2],
        [-0.7, 1.58, 0.99, 0.25 * (1 - 0.06 * th), 2.3, 2.2],
        [-0.48, 1.615, 0.97 + 0.02 * th, 0.28 * (1 - 0.08 * th), 2.4, 2.2],
        [-0.25, 1.57, 0.93 + 0.04 * th, 0.285 * w, 2.3, 2.2],
        [0.0, 1.535, 0.885 + 0.05 * th, 0.3 * w, 2.2, 2.2],
        [0.25, 1.575, 0.875 + 0.03 * th, 0.28 * w, 2.2, 2.2],
        [0.45, 1.65, 0.91, 0.235, 2.1, 2.2],
        [0.62, 1.53, 0.98, 0.195, 2.1, 2.2],
        [0.76, 1.37, 1.06, 0.15, 2, 2],
        [0.82, 1.25, 1.15, 0.05, 2, 2],
      ],
      rings: 20,
      segs: 16,
      loinZ: -0.3,
      bump: (s, a, z) => {
        let r = 0;
        r += (0.015 + 0.03 * th) * Math.exp(-(((z + 0.4) / 0.05) ** 2) - ((a - 1.0) / 0.25) ** 2); // point of hip
        r += 0.018 * Math.exp(-(((z - 0.45) / 0.12) ** 2) - (a / 0.15) ** 2); // withers
        r += 0.012 * Math.exp(-(((z - 0.55) / 0.07) ** 2) - ((a - 1.15) / 0.35) ** 2); // shoulder
        r -= (0.008 + 0.03 * th) * Math.exp(-(((z + 0.25) / 0.07) ** 2) - ((a - 1.25) / 0.3) ** 2); // flank
        if (th > 0) r += 0.01 * th * Math.exp(-(((z - 0.1) / 0.25) ** 2) - ((a - 1.7) / 0.5) ** 2) * Math.cos(((z + 0.05 * a) / 0.1) * Math.PI * 2);
        if (th > 0) r += 0.02 * th * Math.exp(-((a / 0.12) ** 2)) * (0.5 + 0.5 * Math.cos((z / 0.08) * Math.PI * 2)) * (z > -0.6 && z < 0.3 ? 1 : 0);
        return r;
      },
      dense: th > 0.5 ? [[0.55, 0.14, 0.8]] : [],
    },
    neck: {
      path: [V(0, 1.4, 0.48), V(0, 1.6, 0.8), V(0, 1.83, 1.01)],
      keys: [
        [0, 0.2, 0.27, 0.34],
        [0.4, 0.13 * w, 0.2, 0.2],
        [0.75, 0.1, 0.14, 0.15],
        [1, 0.088, 0.1, 0.12],
      ],
      rings: 9,
      segs: 13,
      joints: [0.2, 0.58],
      // The crest rises along the top line.
      bump: (s, a) => 0.035 * Math.sin(Math.PI * Math.min(1, s * 1.1)) * Math.exp(-((a / 0.5) ** 2)),
    },
    neckBones: [V(0, 1.42, 0.52), V(0, 1.6, 0.8), V(0, 1.84, 1.02)],
    head: {
      path: [V(0, 1.93, 1.02), V(0, 1.63, 1.2), V(0, 1.3, 1.36)],
      keys: [
        [0, 0.06, 0.04, 0.08],
        [0.08, 0.1, 0.055, 0.15, 2.2, 2.1],
        [0.3, 0.108, 0.06, 0.2, 2.5, 2.2],
        [0.55, 0.07, 0.056, 0.12, 2.4, 2.1],
        [0.8, 0.066, 0.058, 0.088, 2.3, 2.1],
        [0.93, 0.074, 0.058, 0.08, 2.4, 2.2],
        [1, 0.058, 0.042, 0.058],
      ],
      rings: 10,
      segs: 12,
      cap: [0.015, 0.028],
      bump: (s, a) => 0.01 * Math.exp(-(((s - 0.25) / 0.05) ** 2) - ((a - 1.05) / 0.25) ** 2) + 0.012 * Math.exp(-(((s - 0.38) / 0.1) ** 2) - ((a - 2.0) / 0.3) ** 2),
    },
    fore: {
      joints: (x) => [V(x * 0.19, 1.22, 0.6), V(x * 0.19, 0.98, 0.42), V(x * 0.18, 0.54, 0.45), V(x * 0.18, 0.2, 0.47), V(x * 0.18, 0.08, 0.54)],
      keys: [
        [0, 0.13, 0.13, 0.15],
        [0.6, 0.11, 0.11, 0.14],
        [1, 0.085, 0.09, 0.1, 2, 1.7],
        [1.4, 0.065, 0.062, 0.052],
        [2, 0.056, 0.054, 0.048],
        [2.25, 0.04, 0.034, 0.044],
        [2.85, 0.04, 0.032, 0.046],
        [3, 0.05, 0.044, 0.056],
        [3.6, 0.043, 0.04, 0.038],
        [4, 0.048, 0.048, 0.042],
      ],
      rings: 12,
      segs: 6,
      blend: 0.05,
    },
    hind: {
      joints: (x) => [V(x * 0.2, 1.38, -0.55), V(x * 0.22, 0.98, -0.34), V(x * 0.18, 0.6, -0.74), V(x * 0.17, 0.2, -0.69), V(x * 0.17, 0.08, -0.62)],
      keys: [
        [0, 0.15, 0.16, 0.28],
        [0.6, 0.14, 0.12, 0.36],
        [1, 0.11, 0.1, 0.36, 2.2, 2.6],
        [1.35, 0.09, 0.08, 0.22],
        [1.75, 0.062, 0.058, 0.09],
        [2, 0.052, 0.052, 0.072, 2, 1.6],
        [2.2, 0.04, 0.038, 0.044],
        [2.85, 0.04, 0.034, 0.045],
        [3, 0.05, 0.044, 0.056],
        [3.6, 0.043, 0.04, 0.038],
        [4, 0.048, 0.048, 0.042],
      ],
      rings: 13,
      segs: 6,
      blend: 0.06,
    },
    legTone: (_s, _v, p) => {
      const leg = (p.z > 0 ? 0 : 2) + (p.x > 0 ? 0 : 1);
      if (p.y < 0.32 && socks & (1 << leg)) return 0;
      // Body colour above the knee and hock, dark points below.
      return THREE.MathUtils.lerp(HORSE_BASE[coat]!, points, THREE.MathUtils.smoothstep(0.62 - p.y, 0, 0.14));
    },
    foot: { kind: "hoof", width: 0.13, length: 0.14, height: 0.09, tone: 0.78 },
    tail: {
      points: [V(0, 1.53, -0.85), V(0, 1.5, -0.92), V(0, 1.42, -0.96)],
      r0: 0.06,
      r1: 0.05,
      tone: mane * 0.8,
      bones: [V(0, 1.53, -0.86), V(0, 1.4, -0.96), V(0, 1.02, -1.0)],
      rings: 4,
      segs: 6,
      tuft: { points: [V(0, 1.45, -0.94), V(0, 1.15, -1.02), V(0, 0.8, -1.01), V(0, 0.5, -0.97)], r: 0.08, tone: mane, strands: 2, spread: 0.03 },
    },
    ear: {
      s: 0.035,
      theta: 0.62,
      dir: V(0.3, 1, 0.12),
      cup: V(0.25, 0, 1),
      length: 0.17,
      width: 0.075,
      thick: 0.01,
      shape: (s) => Math.sin(Math.PI * Math.pow(s, 0.8)) * (1 - 0.5 * s) + 0.3 * (1 - s),
    },
    eye: { s: 0.25, theta: 1.28, r: 0.021 },
    rumpY: 1.4,
    height: 1.62,
    length: 2.45,
    extras: (b, parts, d, c) => {
      // Mane: a jagged ridge of hair along the crest, falling to one side.
      const side = c.variant % 2 ? 1 : -1;
      const n = parts.neck;
      // A strip of hair lying on the neck from the crest down one side,
      // ragged along its lower edge.
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const s = 1 - (i / 6) * 0.95;
        const sp = surfaceAt(n, s, side * 0.5);
        pts.push(sp.p.addScaledVector(sp.n, 0.012));
      }
      const ridge = loft({
        path: pts,
        rings: seg(10, d, 6),
        segments: seg(5, d, 4),
        up: V(side, 0.25, 0),
        section: (s) => ({ w: 0.07 + 0.012 * Math.sin(s * 23 + c.seed), up: 0.016, down: 0.004, eUp: 2, eDown: 2, dn: 0, db: 0 }),
        // Ragged lower edge: locks of different length.
        bump: (s, t) => (Math.sin(t) * side < -0.3 ? 0.03 * Math.max(0, Math.sin(s * 41 + c.seed)) : 0),
        capStart: 0.02,
        capEnd: 0.02,
      });
      // Mane runs poll (s=0) to withers (s=1): neck2 -> neck1 -> body.
      b.addLoft(ridge, { bones: chainBlend([Q.neck2, Q.neck1, Q.body], [0.45, 0.85], 0.1), tone: mane });
      // Forelock over the brow.
      const poll = parts.head.pointAt(0.03, 0);
      tuft(b, [poll.clone().add(V(0, 0.02, -0.01)), poll.clone().add(V(0.01, 0.0, 0.07)), poll.clone().add(V(0.015, -0.1, 0.12))], 0.035, Q.head, { tone: mane, seed: c.seed, detail: d });
      // Nostrils: dark crescents either side of the muzzle.
      for (const sx of [-1, 1]) {
        const np = parts.head.pointAt(0.965, sx * 0.62);
        blob(b, np, [0.016, 0.022, 0.012], Q.head, "solid", { w: 5, h: 4 });
      }
      void taper;
    },
  };
}

export function buildHorse(ctx: BuildCtx): BodyBuild {
  return buildMammal(horseSpec(ctx), ctx);
}

function paintHorse(p: Paint): void {
  const { g, rng, noise, variant, thin } = p;
  const coat = variant % 4;
  const base = HORSE_BASE[coat]!;
  for (const r of [p.body, p.neck, p.head]) wash(g, r, base);
  if (coat === 2) {
    // Dapple grey: rings of darker hair around pale centres.
    for (let i = 0; i < 420; i++) {
      const s = rng.range(0.05, 0.95);
      const v = rng.range(0.2, 0.8);
      const [x, y] = [p.body.x0 + s * (p.body.x1 - p.body.x0), p.body.y0 + v * (p.body.y1 - p.body.y0)];
      g.strokeStyle = `rgba(0,0,0,${rng.range(0.2, 0.35)})`;
      g.lineWidth = rng.range(1, 2);
      g.beginPath();
      g.arc(x, y, rng.range(2.5, 5), 0, Math.PI * 2);
      g.stroke();
    }
    // Darker head and legs on a grey.
    wash(g, p.head, 0.2);
  } else {
    // Hair direction: fine strokes following the lie of the coat.
    for (let i = 0; i < 260; i++) {
      const s = rng.next(),
        v = rng.range(0.1, 0.9);
      stroke(g, p.body, [[s, v], [s - 0.02, v + 0.03]], 0.8, 0.18);
    }
    // Lighter belly and muzzle on bays and chestnuts.
    fieldFill(g, p.body, (_s, v) => -Math.cos((v - 0.5) * Math.PI * 2) - 0.75, { grid: 20, edge: 0.1, ink: 0.25 });
  }
  // Muzzle darker, around the eyes too.
  fieldFill(g, p.head, (s) => (s - 0.88) * 8, { grid: 16, edge: 0.3, ink: 0.7 });
  // Face marking: star, stripe, blaze, or none.
  const mark = rng.int(0, 3);
  if (mark > 0) {
    g.save();
    g.globalCompositeOperation = "lighten";
    g.fillStyle = "#fff";
    const [x0, y0] = [p.head.x0, p.head.y0];
    const W = p.head.x1 - p.head.x0,
      H = p.head.y1 - p.head.y0;
    g.beginPath();
    if (mark === 1) g.ellipse(x0 + 0.25 * W, y0 + 0.5 * H, 0.08 * W, 0.06 * H, 0, 0, Math.PI * 2);
    else {
      const wd = mark === 3 ? 0.1 : 0.04;
      g.moveTo(x0 + 0.2 * W, y0 + (0.5 - wd) * H);
      g.lineTo(x0 + 0.97 * W, y0 + (0.5 - wd * 1.6) * H);
      g.lineTo(x0 + 0.97 * W, y0 + (0.5 + wd * 1.6) * H);
      g.lineTo(x0 + 0.2 * W, y0 + (0.5 + wd) * H);
    }
    g.fill();
    g.restore();
  }
  for (const ev of [0.29, 0.71]) spot(g, p.head, 0.25, ev, 0.05, 0.035, 0.9);
  // Mouth line and chin groove; the jowl's edge.
  stroke(g, p.head, [[0.84, 0.13], [0.93, 0.11], [1, 0.14]], 1.5, 0.85);
  stroke(g, p.head, [[0.84, 0.87], [0.93, 0.89], [1, 0.86]], 1.5, 0.85);
  stroke(g, p.head, [[0.12, 0.16], [0.3, 0.1], [0.46, 0.06]], 1.2, 0.5);
  stroke(g, p.head, [[0.12, 0.84], [0.3, 0.9], [0.46, 0.94]], 1.2, 0.5);
  if (thin) {
    ribs(g, p.body, { s0: 0.5, s1: 0.74, count: 9, vTop: 0.64, vBot: 0.84, slant: 0.035, width: 1.8, alpha: 0.75 });
    for (const side of [0, 1]) {
      const vv = (v: number) => (side ? v : 1 - v);
      stroke(g, p.body, [[0.22, vv(0.6)], [0.27, vv(0.66)], [0.32, vv(0.61)]], 1.8, 0.7);
    }
  }
  void noise;
  void wrapNoise;
}

registerCoats("horse", { variants: 4, thin: true, painter: paintHorse });

export const HORSE_MOTION: QuadMotion = {
  walk: [1.6, 0.95],
  trot: [3.8, 1.4],
  run: [11, 2.1],
  runGait: "gallop",
  foreLen: 1.22,
  hindLen: 1.38,
  flex: 1.1,
  grazeY: 0.04,
  reach: [1.0, 0.37, -0.75],
  alert: [-0.25, -0.12, -0.18],
  stand: [0.06, 0.04, 0.05],
  lie: "doze",
  lieDrop: 0.7,
  tailSwish: 0.6,
  tailRun: -0.7,
  tailStyle: "hang",
  skittish: 0.55,
  halfWidth: 0.34,
  scaleVar: 0.04,
  earRest: [0.0, -0.15],
  earAlert: [0.08, 0.35],
};

export const HORSE: SpeciesDef = { id: "horse", kind: "quad", build: buildHorse, variants: 4, hatch: 0.04, quad: HORSE_MOTION, thinVariant: true };
