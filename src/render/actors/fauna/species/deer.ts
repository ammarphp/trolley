/**
 * Red deer: hinds (1.15 m at the shoulder) and stags with a shaggy neck and
 * branching antlers. Long slender legs, upright neck, big mobile ears, a
 * pale rump patch around a short tail that flags when alarmed.
 */
import * as THREE from "three";
import { V, seg, taper } from "../parts.ts";
import { QUAD as Q } from "../rig.ts";
import { buildMammal, type MammalSpec } from "../mammal.ts";
import type { BuildCtx, BodyBuild } from "../body.ts";
import { registerCoats, stroke, fieldFill, wrapNoise, ribs, spot, wash, type Paint } from "../coat.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";

function deerSpec(ctx: BuildCtx): MammalSpec {
  const th = ctx.thin;
  const w = 1 - 0.18 * th;
  const stag = ctx.variant % 2 === 1;
  const nk = stag ? 1.25 : 1;
  return {
    torso: {
      z0: -0.56,
      z1: 0.52,
      yc: 0.95,
      rows: [
        [-0.56, 1.04, 0.86, 0.04, 2, 2],
        [-0.52, 1.1, 0.79, 0.13, 2.2, 2.2],
        [-0.4, 1.14, 0.75, 0.185 * (1 - 0.1 * th), 2.3, 2.2],
        [-0.15, 1.12, 0.73 + 0.03 * th, 0.2 * w, 2.2, 2.1],
        [0.1, 1.13, 0.705 + 0.02 * th, 0.21 * w, 2.2, 2.1],
        [0.3, 1.19, 0.7, 0.19, 2.1, 2.1],
        [0.44, 1.1, 0.76, 0.15, 2, 2.1],
        [0.52, 0.98, 0.86, 0.05, 2, 2],
      ],
      rings: 18,
      segs: 15,
      loinZ: -0.18,
      bump: (s, a, z) =>
        0.012 * Math.exp(-(((z + 0.38) / 0.05) ** 2) - ((a - 0.95) / 0.3) ** 2) +
        (th > 0 ? 0.008 * th * Math.exp(-(((z - 0.08) / 0.16) ** 2) - ((a - 1.65) / 0.45) ** 2) * Math.cos(((z + 0.04 * a) / 0.07) * Math.PI * 2) : 0),
    },
    neck: {
      path: [V(0, 1.0, 0.34), V(0, 1.22, 0.51), V(0, 1.42, 0.61)],
      keys: [
        [0, 0.15 * nk, 0.18 * nk, 0.22 * nk],
        [0.4, 0.09 * nk, 0.12 * nk, 0.15 * nk, 2, stag ? 1.5 : 2],
        [1, 0.066, 0.075, 0.085],
      ],
      rings: 8,
      segs: 12,
      joints: [0.22, 0.6],
      bump: stag ? (s, a) => 0.02 * Math.sin(Math.PI * s) * (0.5 + 0.5 * Math.sin(a * 9 + s * 25)) : undefined,
    },
    neckBones: [V(0, 1.02, 0.37), V(0, 1.22, 0.51), V(0, 1.43, 0.61)],
    head: {
      path: [V(0, 1.53, 0.57), V(0, 1.43, 0.75), V(0, 1.27, 0.92)],
      keys: [
        [0, 0.045, 0.034, 0.05],
        [0.15, 0.068, 0.045, 0.08, 2.2, 2.1],
        [0.36, 0.062, 0.044, 0.075],
        [0.72, 0.038, 0.034, 0.044],
        [1, 0.026, 0.024, 0.028],
      ],
      rings: 9,
      segs: 10,
    },
    fore: {
      joints: (x) => [V(x * 0.12, 0.95, 0.37), V(x * 0.12, 0.74, 0.27), V(x * 0.11, 0.42, 0.29), V(x * 0.11, 0.12, 0.3), V(x * 0.11, 0.04, 0.34)],
      keys: [
        [0, 0.09, 0.09, 0.1],
        [1, 0.05, 0.05, 0.06],
        [1.6, 0.033, 0.03, 0.028],
        [2, 0.029, 0.027, 0.025],
        [2.3, 0.02, 0.018, 0.022],
        [3, 0.023, 0.021, 0.025],
        [4, 0.02, 0.019, 0.016],
      ],
      rings: 13,
      segs: 6,
    },
    hind: {
      joints: (x) => [V(x * 0.13, 1.02, -0.38), V(x * 0.14, 0.74, -0.22), V(x * 0.11, 0.47, -0.5), V(x * 0.1, 0.12, -0.46), V(x * 0.1, 0.04, -0.42)],
      keys: [
        [0, 0.1, 0.1, 0.18],
        [1, 0.08, 0.06, 0.2, 2.1, 2.4],
        [1.4, 0.058, 0.045, 0.12],
        [2, 0.029, 0.026, 0.043],
        [2.2, 0.02, 0.018, 0.024],
        [3, 0.023, 0.021, 0.025],
        [4, 0.02, 0.019, 0.016],
      ],
      rings: 14,
      segs: 6,
    },
    // Brown to the hoof; the inner thigh pales toward the rump patch.
    legTone: (_s, _v, p) => (p.y > 0.75 && p.z < 0 ? 0.18 : 0.3),
    foot: { kind: "cloven", width: 0.045, length: 0.075, height: 0.045, tone: 0.9 },
    tail: {
      points: [V(0, 1.08, -0.54), V(0, 1.02, -0.6), V(0, 0.94, -0.61)],
      r0: 0.032,
      r1: 0.02,
      tone: (s) => (s > 0.4 ? 0.6 : 0.2),
      bones: [V(0, 1.08, -0.54), V(0, 1.02, -0.59), V(0, 0.96, -0.61)],
      rings: 5,
      segs: 6,
    },
    ear: {
      s: 0.08,
      theta: 0.95,
      dir: V(0.72, 0.9, -0.12),
      cup: V(0.15, 0.2, 1),
      length: 0.21,
      width: 0.1,
      tone: (s) => (s > 0.85 ? 0.7 : 0.15),
    },
    eye: { s: 0.3, theta: 1.28, r: 0.016 },
    rumpY: 1.02,
    height: 1.18,
    length: 1.9,
    extras: stag
      ? (b, parts, d, c) => {
          // Antlers: main beam sweeping up and back, brow, bez and trez tines
          // forward, a crown of three at the top.
          const rng = (k: number) => {
            const h = Math.sin(c.seed * 12.9898 + k * 78.233) * 43758.5453;
            return h - Math.floor(h);
          };
          for (const side of [1, -1]) {
            const base = parts.head.pointAt(0.08, side * 0.55).add(V(0, 0.01, 0));
            const P = (x: number, y: number, z: number) => base.clone().add(V(side * x, y, z));
            const beam = [P(0, 0, 0), P(0.06, 0.12, -0.06), P(0.15, 0.3, -0.12), P(0.22, 0.48, -0.08), P(0.24, 0.62, 0.0)];
            const tone = (s: number) => (s > 0.85 ? 0.6 : 0.3);
            taper(b, beam, 0.024, 0.01, { bones: Q.head, rings: seg(8, d, 5), segments: seg(6, d, 4), tone, profile: (s) => 1 - 0.8 * s });
            const tine = (from: THREE.Vector3, dir: [number, number, number], len: number, r: number) => {
              const d0 = V(side * dir[0], dir[1], dir[2]).normalize();
              const mid = from.clone().addScaledVector(d0, len * 0.55).add(V(0, len * 0.12, 0));
              taper(b, [from, mid, from.clone().addScaledVector(d0, len).add(V(0, len * 0.3, 0))], r, 0.004, {
                bones: Q.head,
                rings: seg(4, d, 3),
                segments: seg(5, d, 4),
                tone: (s: number) => (s > 0.7 ? 0.6 : 0.3),
              });
            };
            tine(P(0.015, 0.04, -0.01), [0.05, 0.2, 1], 0.17, 0.014);
            tine(P(0.05, 0.12, -0.05), [0.1, 0.3, 1], 0.13 + 0.03 * rng(side), 0.012);
            tine(P(0.17, 0.34, -0.11), [0.1, 0.4, 1], 0.12, 0.011);
            tine(P(0.22, 0.5, -0.07), [0.5, 0.8, 0.4], 0.1, 0.009);
            tine(P(0.23, 0.53, -0.06), [0.2, 0.6, -0.8], 0.1, 0.009);
          }
        }
      : undefined,
  };
}

export function buildDeer(ctx: BuildCtx): BodyBuild {
  return buildMammal(deerSpec(ctx), ctx);
}

function paintDeer(p: Paint): void {
  const { g, noise, variant, thin, rng } = p;
  const stag = variant % 2 === 1;
  for (const r of [p.body, p.neck, p.head]) wash(g, r, 0.3);
  // Pale belly, darker dorsal line, cream rump patch framed in dark.
  g.save();
  g.fillStyle = "#fff";
  const bh = p.body.y1 - p.body.y0;
  g.globalAlpha = 0.6;
  g.fillRect(p.body.x0, p.body.y0 - 3, p.body.x1 - p.body.x0, bh * 0.14);
  g.fillRect(p.body.x0, p.body.y1 - bh * 0.14, p.body.x1 - p.body.x0, bh * 0.14 + 3);
  g.globalAlpha = 1;
  // Rump patch.
  const rx = p.body.x0,
    rw = (p.body.x1 - p.body.x0) * 0.1;
  g.beginPath();
  g.ellipse(rx, p.body.y0 + bh * 0.5, rw, bh * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  stroke(g, p.body, [[0.1, 0.32], [0.12, 0.4], [0.12, 0.6], [0.1, 0.68]], 1.6, 0.6);
  fieldFill(g, p.body, (s, v) => Math.exp(-(((v - 0.5) / 0.04) ** 2)) - 0.5 + (s < 0.1 ? -1 : 0), { grid: 40, edge: 0.2, ink: 0.35 });
  // Dappled summer coat on hinds; shaggy dark neck on stags.
  if (!stag) for (let i = 0; i < 40; i++) spot(g, p.body, rng.range(0.15, 0.8), 0.5 + (rng.chance(0.5) ? 1 : -1) * rng.range(0.06, 0.16), 0.008, 0.012, 0.12);
  else fieldFill(g, p.neck, (s, v) => 0.6 - s * 0.3 + wrapNoise(noise, s, v, 0.4, 0.12, 5, 2) * 0.2, { grid: 16, edge: 0.1, ink: 0.55 });
  // Face: dark muzzle, pale eye ring and chin.
  fieldFill(g, p.head, (s) => (s - 0.86) * 10, { grid: 16, edge: 0.3, ink: 0.85 });
  for (const ev of [0.29, 0.71]) spot(g, p.head, 0.3, ev, 0.045, 0.035, 0.9);
  for (let i = 0; i < 240; i++) {
    const s = rng.next(),
      v = rng.range(0.1, 0.9);
    stroke(g, p.body, [[s, v], [s - 0.02, v + (v > 0.5 ? 0.02 : -0.02)]], 0.7, 0.18);
  }
  if (thin) ribs(g, p.body, { s0: 0.45, s1: 0.72, count: 9, vTop: 0.63, vBot: 0.83, slant: 0.04, width: 1.5, alpha: 0.7 });
}

registerCoats("deer", { variants: 2, thin: true, painter: paintDeer });

export const DEER_MOTION: QuadMotion = {
  walk: [1.2, 1.15],
  trot: [3.2, 1.9],
  run: [12, 2.6],
  runGait: "bound",
  foreLen: 0.95,
  hindLen: 1.02,
  flex: 1.25,
  grazeY: 0.04,
  reach: [1.0, 0.35, -0.55],
  alert: [-0.18, -0.12, -0.1],
  stand: [0.0, 0.0, 0.05],
  lie: "sternal",
  lieDrop: 0.62,
  tailSwish: 0.4,
  tailRun: -0.8,
  tailStyle: "flag",
  skittish: 0.95,
  halfWidth: 0.22,
  scaleVar: 0.05,
  earRest: [0.05, 0.05],
  earAlert: [0.2, 0.5],
};

export const DEER: SpeciesDef = { id: "deer", kind: "quad", build: buildDeer, variants: 2, hatch: 0.032, quad: DEER_MOTION, thinVariant: true };
