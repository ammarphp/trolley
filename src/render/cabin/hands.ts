/**
 * Gloved hands and uniform sleeves.
 *
 * Hand frame (right hand, palm down): origin at the wrist centre, fingers
 * toward -Z, back of the hand +Y, thumb on the -X side. The left hand is the
 * X-mirror. Fingers are forward-kinematic chains of capsule phalanges with
 * knuckle heads, so a pose is a handful of joint angles.
 *
 * Proportions are an adult hand in a close-fitting leather glove (+2–3 mm):
 * palm 84 × 100 mm, middle finger 99 mm.
 */
import * as THREE from "three";
import { Kit, lathe, sphere } from "../core/geometry.ts";
import { capsuleBetween, roundedBox, smoothstep, v3 } from "./util.ts";

export interface FingerPose {
  mcp: number;
  pip: number;
  dip: number;
  /** Radians, + toward the little finger. */
  spread: number;
  /** Roll of the whole finger about its own axis (radians). */
  twist?: number;
}
export interface ThumbPose {
  /** Unit-ish directions (hand frame) for metacarpal, proximal, distal. */
  meta: [number, number, number];
  prox: [number, number, number];
  dist: [number, number, number];
}
export interface HandPose {
  fingers: [FingerPose, FingerPose, FingerPose, FingerPose];
  thumb: ThumbPose;
}

const D = Math.PI / 180;

interface FingerDim {
  base: [number, number, number];
  len: [number, number, number];
  r: number;
}
const FINGERS: FingerDim[] = [
  { base: [-0.028, 0.001, -0.094], len: [0.043, 0.026, 0.021], r: 0.0102 },
  { base: [-0.0085, 0.0015, -0.099], len: [0.047, 0.029, 0.023], r: 0.0106 },
  { base: [0.011, 0.001, -0.096], len: [0.044, 0.028, 0.022], r: 0.01 },
  { base: [0.0295, -0.0005, -0.088], len: [0.035, 0.021, 0.019], r: 0.009 },
];
const THUMB_CMC: [number, number, number] = [-0.024, -0.008, -0.018];
const THUMB_LEN: [number, number, number] = [0.044, 0.032, 0.027];
const THUMB_R: [number, number, number] = [0.0135, 0.0119, 0.0109];

/** Power grip around a bar lying along X under the palm. */
export const GRIP_POSE: HandPose = {
  fingers: [
    { mcp: 58 * D, pip: 96 * D, dip: 46 * D, spread: -0.05 },
    { mcp: 62 * D, pip: 98 * D, dip: 48 * D, spread: -0.01 },
    { mcp: 66 * D, pip: 98 * D, dip: 48 * D, spread: 0.03 },
    { mcp: 72 * D, pip: 96 * D, dip: 46 * D, spread: 0.08 },
  ],
  thumb: {
    meta: [-0.42, -0.6, -0.68],
    prox: [0.2, -0.72, -0.66],
    dist: [0.62, -0.46, -0.64],
  },
};
/** Where the grip bar passes through the fist (hand frame), axis along X. */
export const GRIP_CENTER: [number, number, number] = [0.0, -0.034, -0.091];

/** Palm cupped over a small upright knob, fingers draped round its front. */
export const KNOB_POSE: HandPose = {
  fingers: [
    { mcp: 34 * D, pip: 52 * D, dip: 24 * D, spread: -0.1 },
    { mcp: 38 * D, pip: 56 * D, dip: 26 * D, spread: -0.025 },
    { mcp: 42 * D, pip: 58 * D, dip: 26 * D, spread: 0.05 },
    { mcp: 48 * D, pip: 60 * D, dip: 28 * D, spread: 0.13 },
  ],
  thumb: {
    meta: [-0.5, -0.5, -0.7],
    prox: [-0.12, -0.8, -0.58],
    dist: [0.1, -0.88, -0.46],
  },
};
/** Point under the palm that rests on the knob top (hand frame). */
export const KNOB_CONTACT: [number, number, number] = [0.0, -0.021, -0.066];

/** Relaxed hand resting palm-down on a knob. */
export const REST_POSE: HandPose = {
  fingers: [
    { mcp: 16 * D, pip: 30 * D, dip: 14 * D, spread: -0.07 },
    { mcp: 20 * D, pip: 34 * D, dip: 16 * D, spread: -0.015 },
    { mcp: 24 * D, pip: 38 * D, dip: 18 * D, spread: 0.04 },
    { mcp: 30 * D, pip: 42 * D, dip: 20 * D, spread: 0.11 },
  ],
  thumb: {
    meta: [-0.62, -0.36, -0.7],
    prox: [-0.38, -0.46, -0.8],
    dist: [-0.2, -0.52, -0.83],
  },
};

function norm(a: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(...a).normalize();
}

/** Build a gloved right hand in the hand frame. */
export function buildGlove(pose: HandPose, tones: { glove?: number | "paper" | "pale" | "light" | "mid" | "dark"; seam?: "mid" | "dark" | "deep" } = {}): THREE.BufferGeometry {
  const k = new Kit();
  const tone = tones.glove ?? "paper";
  const seam = tones.seam ?? "mid";

  // Palm: rounded box tapered toward the wrist, domed on the back.
  const palm = roundedBox(0.084, 0.029, 0.1, 0.012, 2);
  {
    const pos = palm.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i),
        y = pos.getY(i);
      const z = pos.getZ(i) - 0.049;
      const s = THREE.MathUtils.clamp(-z / 0.098, 0, 1);
      x *= 0.8 + 0.2 * smoothstep(0, 0.55, s);
      if (y > 0) y += 0.0042 * (1 - Math.min(1, (x / 0.044) ** 2)) * Math.sin(Math.PI * Math.min(1, s * 1.15));
      else {
        // Heel of the hand: hypothenar pad on the little-finger side.
        y -= 0.0035 * smoothstep(-0.01, 0.03, x) * (1 - s) ** 1.5;
      }
      pos.setXYZ(i, x + 0.001, y, z);
    }
    palm.computeVertexNormals();
  }
  k.add(palm, { tone });
  // Wrist bridge into the cuff.
  k.add(sphere(1, 16, 12), { tone, position: [0.001, -0.001, -0.006], scale: [0.034, 0.02, 0.03] });

  // Fingers.
  const down = v3(0, -1, 0);
  const tips: THREE.Vector3[] = [];
  FINGERS.forEach((f, i) => {
    const p = pose.fingers[i]!;
    const fwd = v3(Math.sin(p.spread), 0, -Math.cos(p.spread));
    const base = v3(...f.base);
    const angles = [p.mcp, p.mcp + p.pip, p.mcp + p.pip + p.dip];
    const radii = [f.r, f.r * 0.93, f.r * 0.86];
    let j = base.clone();
    // Knuckle head, slightly proud of the back of the hand.
    k.add(sphere(f.r * 1.08, 12, 8), { tone, position: [base.x, base.y + 0.0035, base.z + 0.002] });
    for (let s = 0; s < 3; s++) {
      const dir = fwd.clone().multiplyScalar(Math.cos(angles[s]!)).addScaledVector(down, Math.sin(angles[s]!)).normalize();
      const next = j.clone().addScaledVector(dir, f.len[s]!);
      k.add(capsuleBetween(j, next, radii[s]!, 4, 10), { tone });
      if (s > 0) {
        // Joint: a slightly fuller sphere so flexed knuckles read.
        k.add(sphere(radii[s]! * 1.04, 10, 7), { tone, position: [j.x, j.y, j.z] });
      }
      j = next;
    }
    tips.push(j);
  });

  // Thumb: thenar pad plus three segments.
  {
    const cmc = v3(...THUMB_CMC);
    const dirs = [norm(pose.thumb.meta), norm(pose.thumb.prox), norm(pose.thumb.dist)];
    let j = cmc.clone();
    const joints: THREE.Vector3[] = [j.clone()];
    for (let s = 0; s < 3; s++) {
      const next = j.clone().addScaledVector(dirs[s]!, THUMB_LEN[s]!);
      k.add(capsuleBetween(j, next, THUMB_R[s]!, 4, 10), { tone });
      if (s > 0) k.add(sphere(THUMB_R[s]! * 1.05, 10, 7), { tone, position: [j.x, j.y, j.z] });
      j = next;
      joints.push(j.clone());
    }
    // Thenar muscle between thumb metacarpal and palm.
    const mid = joints[0]!.clone().lerp(joints[1]!, 0.45).add(v3(0.008, 0.0, -0.004));
    const th = sphere(1, 12, 9);
    th.scale(0.019, 0.014, 0.034);
    const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, -1), dirs[0]!.clone().add(v3(0.25, 0, -0.5)).normalize());
    th.applyQuaternion(q);
    k.add(th, { tone, position: [mid.x, mid.y, mid.z] });
  }

  // Stitched "points" on the back of the hand.
  const seams: Array<Array<[number, number, number]>> = [
    [
      [-0.018, 0.0178, -0.078],
      [-0.016, 0.0193, -0.058],
      [-0.012, 0.0184, -0.036],
    ],
    [
      [0.001, 0.0186, -0.082],
      [0.0008, 0.0199, -0.06],
      [0.0005, 0.0188, -0.036],
    ],
    [
      [0.02, 0.0172, -0.076],
      [0.017, 0.0188, -0.056],
      [0.012, 0.018, -0.036],
    ],
  ];
  for (const s of seams) {
    const curve = new THREE.CatmullRomCurve3(s.map((p) => new THREE.Vector3(...p)));
    k.add(new THREE.TubeGeometry(curve, 10, 0.0008, 5, false), { tone: seam });
  }

  // Gauntlet cuff: flared, rolled edge, snap tab over the back of the wrist.
  {
    const profile: Array<[number, number]> = [
      [0.0285, -0.012],
      [0.031, 0.006],
      [0.0345, 0.03],
      [0.0395, 0.058],
      [0.0425, 0.072],
      [0.0445, 0.077],
      [0.0435, 0.081],
      [0.0405, 0.0805],
      [0.0385, 0.074],
    ];
    const cuff = lathe(profile, 28);
    cuff.rotateX(Math.PI / 2);
    cuff.scale(1.13, 0.8, 1);
    k.add(cuff, { tone });
    // Cuff seam where the gauntlet joins the hand.
    const ring = new THREE.TorusGeometry(0.031, 0.0012, 5, 28);
    ring.scale(1.13, 0.8, 1);
    k.add(ring, { tone: seam, position: [0, 0, 0.008] });
    k.add(roundedBox(0.03, 0.005, 0.02, 0.002), { tone: "light", position: [0.008, 0.0275, 0.034], rotation: [-0.12, 0, 0] });
    k.add(new THREE.CylinderGeometry(0.0048, 0.0052, 0.004, 14), { tone: "paper", position: [0.016, 0.0305, 0.036], rotation: [-0.12, 0, 0] });
  }
  void tips;
  return k.build();
}

/**
 * Uniform sleeve along +Z from its cuff opening at z = 0 to z = length.
 * `outer` is the side (angle about Z from +Y toward +X) that carries buttons.
 */
export function buildSleeve(length: number, options: { buttonsAngle?: number; tone?: "paper" | "pale" | "mid" | "dark" | "light"; fold?: number; seed?: number } = {}): THREE.BufferGeometry {
  const k = new Kit();
  const tone = options.tone ?? "paper";
  const profile: Array<[number, number]> = [
    [0.0445, 0.034],
    [0.0445, 0.006],
    [0.0472, -0.0005],
    [0.0512, 0.0],
    [0.0527, 0.006],
    [0.0529, 0.058],
    [0.0552, 0.061],
    [0.0556, 0.07],
    [0.0533, 0.073],
    [0.0536, 0.1],
    [0.0565, length * 0.6],
    [0.0585, length],
  ];
  const g = lathe(profile, 36);
  g.rotateX(Math.PI / 2);
  // Folds: compression rings that wander around the sleeve, stronger mid-arm.
  {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const seed = options.seed ?? 1;
    const fold = options.fold ?? 1;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const a = Math.atan2(x, y);
      const w = smoothstep(0.085, 0.14, z) * fold;
      const f =
        1 +
        w *
          (0.05 * Math.sin(z * 58 + 1.7 * Math.sin(a * 2 + seed)) +
            0.03 * Math.sin(z * 131 + a * 3 + seed * 2) +
            0.02 * Math.cos(a * 5 + z * 20));
      pos.setXYZ(i, x * f * 1.07, y * f * 0.94, z);
    }
    g.computeVertexNormals();
  }
  k.add(g, { tone });
  // Braid stripe (pale) and cuff buttons.
  const stripe = new THREE.TorusGeometry(0.0556, 0.0026, 6, 36);
  stripe.scale(1.07, 0.94, 1);
  k.add(stripe, { tone: "deep", position: [0, 0, 0.0655] });
  const ba = options.buttonsAngle ?? 1.1;
  for (let b = 0; b < 3; b++) {
    const z = 0.016 + b * 0.015;
    const r = 0.0535;
    k.add(sphere(0.0048, 10, 6), {
      tone: "paper",
      position: [Math.sin(ba) * r * 1.07, Math.cos(ba) * r * 0.94, z],
      scale: [1, 1, 1],
    });
  }
  return k.build();
}
