/**
 * Domestic pig: 0.8 m at the back, a long deep barrel on short legs, heavy
 * jowls, a dished face ending in a flat snout disc, pricked ears (Large
 * White) or lop ears over the eyes (Gloucester Old Spot), and a curled tail.
 * Coats: Large White, Old Spot, Saddleback (black with a white belt).
 */
import * as THREE from "three";
import { V, blob, seg, taper } from "../parts.ts";
import { QUAD as Q } from "../rig.ts";
import { buildMammal, type MammalSpec } from "../mammal.ts";
import type { BuildCtx, BodyBuild } from "../body.ts";
import { registerCoats, stroke, fieldFill, wrapNoise, ribs, spot, wash, type Paint } from "../coat.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";

function pigSpec(ctx: BuildCtx): MammalSpec {
  const th = ctx.thin;
  const w = 1 - 0.2 * th;
  const breed = ctx.variant % 3; // 0 Large White, 1 Old Spot, 2 Saddleback
  const lop = breed === 1;
  const saddle = breed === 2;
  const legTone = (p: THREE.Vector3) => (saddle ? (p.z > 0 ? 0 : 0.95) : 0);
  // Curled tail: a small helix.
  const tailPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = t * Math.PI * 3.2;
    tailPts.push(V(Math.sin(a) * 0.028 * t, 0.7 - t * 0.04 + Math.cos(a) * 0.028 * t, -0.62 - t * 0.07));
  }
  return {
    torso: {
      z0: -0.63,
      z1: 0.5,
      yc: 0.55,
      rows: [
        [-0.63, 0.63, 0.47, 0.05, 2, 2],
        [-0.59, 0.72, 0.37, 0.17 * w, 2.3, 2.2],
        [-0.45, 0.785, 0.31 + 0.03 * th, 0.24 * w, 2.6, 2.3],
        [-0.15, 0.825 - 0.02 * th, 0.275 + 0.05 * th, 0.27 * w, 2.6, 2.3],
        [0.15, 0.82 - 0.02 * th, 0.285 + 0.04 * th, 0.265 * w, 2.5, 2.3],
        [0.35, 0.8, 0.31, 0.245, 2.3, 2.2],
        [0.46, 0.73, 0.36, 0.2, 2.1, 2.1],
        [0.5, 0.63, 0.45, 0.08, 2, 2],
      ],
      rings: 18,
      segs: 16,
      loinZ: -0.22,
      bump: (s, a, z) =>
        (th > 0 ? 0.012 * th * Math.exp(-(((z - 0.05) / 0.18) ** 2) - ((a - 1.6) / 0.45) ** 2) * Math.cos(((z + 0.04 * a) / 0.085) * Math.PI * 2) : 0) +
        (th > 0 ? 0.02 * th * Math.exp(-((a / 0.14) ** 2)) : 0),
    },
    neck: {
      path: [V(0, 0.56, 0.36), V(0, 0.6, 0.5), V(0, 0.64, 0.58)],
      keys: [
        [0, 0.23 * w, 0.22, 0.25],
        [0.5, 0.19 * w, 0.17, 0.21],
        [1, 0.15, 0.13, 0.16],
      ],
      rings: 6,
      segs: 13,
      joints: [0.25, 0.65],
    },
    neckBones: [V(0, 0.56, 0.4), V(0, 0.6, 0.5), V(0, 0.65, 0.58)],
    head: {
      path: [V(0, 0.75, 0.53), V(0, 0.64, 0.73), V(0, 0.5, 0.9)],
      keys: [
        [0, 0.09, 0.06, 0.09],
        [0.2, 0.125 * w, 0.075, 0.14, 2.3, 2.1],
        [0.45, 0.085, 0.06, 0.085],
        [0.8, 0.055, 0.05, 0.055],
        [1, 0.062, 0.056, 0.056],
      ],
      rings: 9,
      segs: 12,
      // Dished face.
      bump: (s, a) => -0.012 * Math.exp(-(((s - 0.55) / 0.15) ** 2) - (a / 0.4) ** 2),
      cap: [0.02, 0.004],
    },
    fore: {
      joints: (x) => [V(x * 0.14, 0.45, 0.36), V(x * 0.14, 0.3, 0.3), V(x * 0.13, 0.15, 0.32), V(x * 0.13, 0.05, 0.33), V(x * 0.13, 0.016, 0.36)],
      keys: [
        [0, 0.1, 0.1, 0.12],
        [1, 0.06, 0.06, 0.07],
        [2, 0.04, 0.038, 0.038],
        [3, 0.038, 0.036, 0.036],
        [4, 0.034, 0.032, 0.028],
      ],
      rings: 10,
      segs: 7,
    },
    hind: {
      joints: (x) => [V(x * 0.15, 0.55, -0.42), V(x * 0.16, 0.35, -0.3), V(x * 0.13, 0.18, -0.47), V(x * 0.13, 0.05, -0.45), V(x * 0.13, 0.016, -0.42)],
      keys: [
        [0, 0.12, 0.12, 0.2],
        [1, 0.08, 0.07, 0.15],
        [1.5, 0.052, 0.048, 0.06],
        [2, 0.04, 0.038, 0.042],
        [3, 0.038, 0.036, 0.036],
        [4, 0.034, 0.032, 0.028],
      ],
      rings: 11,
      segs: 7,
    },
    legTone: (_s, _v, p) => legTone(p),
    foot: { kind: "cloven", width: 0.07, length: 0.07, height: 0.04, tone: 0.7 },
    tail: {
      points: tailPts,
      r0: 0.014,
      r1: 0.008,
      tone: saddle ? 0.95 : 0,
      bones: [tailPts[0]!, tailPts[4]!, tailPts[8]!],
      rings: 12,
      segs: 5,
    },
    ear: lop
      ? { s: 0.07, theta: 1.0, dir: V(0.45, 0.15, 1), cup: V(0, -1, 0.2), length: 0.19, width: 0.15, droop: 0.08, tone: 0.05 }
      : { s: 0.07, theta: 0.95, dir: V(0.55, 0.85, 0.45), cup: V(0.1, 0.2, 1), length: 0.15, width: 0.12, tone: saddle ? 0.95 : 0 },
    eye: { s: 0.33, theta: 1.05, r: 0.011 },
    height: 0.83,
    length: 1.55,
    extras: (b, parts, d) => {
      // Snout disc with nostrils.
      const f = parts.head.frameAt(1);
      const tip = f.c.clone().addScaledVector(f.t, 0.005);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), f.t);
      const disc = new THREE.CylinderGeometry(0.058, 0.062, 0.03, seg(12, d, 8), 1);
      b.addPart(disc, Q.head, { tone: 0.12 }, new THREE.Matrix4().compose(tip, q, V(1, 1, 0.85)));
      for (const sx of [-1, 1]) blob(b, tip.clone().addScaledVector(f.t, 0.016).addScaledVector(f.b, sx * 0.022), [0.011, 0.014, 0.006], Q.head, "solid", { w: 5, h: 4 });
      // Teats along the belly line.
      for (let i = 0; i < 5; i++) {
        for (const sx of [-1, 1]) {
          const z = -0.3 + i * 0.13;
          const t0 = V(sx * 0.08, 0.3, z);
          taper(b, [t0, t0.clone().add(V(0, -0.025, 0))], 0.01, 0.007, { bones: z > -0.22 ? Q.body : Q.rump, rings: 2, segments: 4, tone: 0.2, profile: () => 1 });
        }
      }
    },
  };
}

export function buildPig(ctx: BuildCtx): BodyBuild {
  return buildMammal(pigSpec(ctx), ctx);
}

function paintPig(p: Paint): void {
  const { g, noise, variant, thin, rng } = p;
  const breed = variant % 3;
  if (breed === 1) {
    // Old Spot: a few irregular black spots.
    fieldFill(g, p.body, (s, v) => wrapNoise(noise, s, v, 1.1, 0.3, 2.6, 3) - 0.38 + 0.15 * Math.cos((v - 0.5) * Math.PI * 2), { grid: 48, edge: 0.03 });
    fieldFill(g, p.head, (s, v) => (Math.abs(v - 0.3) < 0.12 && s < 0.5 ? 1 : -1), { grid: 16, edge: 0.05 });
  } else if (breed === 2) {
    // Saddleback: black with a white belt over the shoulders.
    for (const r of [p.body, p.neck, p.head]) wash(g, r, 1);
    g.fillStyle = "#fff";
    const bx = p.body.x0 + (p.body.x1 - p.body.x0) * 0.66;
    g.beginPath();
    g.moveTo(bx, p.body.y0 - 3);
    for (let k = 0; k <= 12; k++) {
      const y = p.body.y0 + ((p.body.y1 - p.body.y0) * k) / 12;
      g.lineTo(bx + Math.sin(k * 1.7 + variant) * 3, y);
    }
    g.lineTo(p.body.x0 + (p.body.x1 - p.body.x0) * 0.86, p.body.y1 + 3);
    g.lineTo(p.body.x0 + (p.body.x1 - p.body.x0) * 0.86, p.body.y0 - 3);
    g.fill();
  }
  // Bristles and skin creases.
  for (let i = 0; i < 180; i++) {
    const s = rng.next(),
      v = rng.range(0.15, 0.85);
    stroke(g, p.body, [[s, v], [s - 0.01, v + 0.012]], 0.6, 0.2);
  }
  for (let i = 0; i < 4; i++) stroke(g, p.neck, [[0.2 + i * 0.18, 0.05], [0.25 + i * 0.18, 0.2]], 1, 0.4);
  for (const ev of [0.33, 0.67]) spot(g, p.head, 0.33, ev, 0.035, 0.03, 0.8);
  // Mouth line.
  stroke(g, p.head, [[0.6, 0.12], [0.8, 0.1], [0.98, 0.14]], 1.4, 0.8);
  stroke(g, p.head, [[0.6, 0.88], [0.8, 0.9], [0.98, 0.86]], 1.4, 0.8);
  if (thin) ribs(g, p.body, { s0: 0.45, s1: 0.72, count: 9, vTop: 0.63, vBot: 0.82, slant: 0.035, width: 1.6, alpha: 0.65 });
}

registerCoats("pig", { variants: 3, thin: true, painter: paintPig });

export const PIG_MOTION: QuadMotion = {
  walk: [0.9, 1.5],
  trot: [2.0, 2.4],
  run: [4.5, 3.4],
  runGait: "gallop",
  foreLen: 0.45,
  hindLen: 0.55,
  flex: 0.9,
  grazeY: 0.05,
  reach: [0.85, 0.2, 0.25],
  alert: [-0.2, -0.1, -0.2],
  stand: [0.05, 0.05, 0.1],
  lie: "side",
  lieDrop: 0.3,
  tailSwish: 0.3,
  tailRun: 0,
  tailStyle: "curl",
  skittish: 0.3,
  halfWidth: 0.27,
  scaleVar: 0.07,
  earRest: [0, 0],
  earAlert: [0.1, 0.25],
};

export const PIG: SpeciesDef = { id: "pig", kind: "quad", build: buildPig, variants: 3, hatch: 0.03, quad: PIG_MOTION, thinVariant: true };
