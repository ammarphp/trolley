/**
 * Lineside furniture: telegraph poles (with wire attachment points so the
 * integrator can hang catenary wires between poles) and small marker posts.
 *
 * Telegraph poles face +Z, which is the direction the wires run: crossarms
 * lie along local X, so place poles with local Z along the route.
 */
import * as THREE from "three";
import { Kit, cylinder, type Tone } from "../../core/geometry.ts";
import { createRng } from "../../core/rng.ts";
import { boxAt, rod, taperTube, v3 } from "./shapes.ts";

export const TELEGRAPH_VARIANTS = ["single arm", "two arms", "railway route, four arms", "bracket insulators", "old pole, leaning"] as const;
export const MARKER_VARIANTS = ["milepost", "quarter-mile post", "gradient post", "whistle board", "speed board", "distant sign"] as const;

const mod = (v: number, n: number) => ((v % n) + n) % n;

interface PolePlan {
  height: number;
  lean: number;
  arms: Array<{ y: number; half: number; pins: number[] }>;
  brackets: Array<[number, number, number]>;
  stay: boolean;
}

function polePlan(variant: number): PolePlan {
  const v = mod(variant, TELEGRAPH_VARIANTS.length);
  const rng = createRng(`nature:telegraph:${variant}`);
  switch (TELEGRAPH_VARIANTS[v]) {
    case "single arm": {
      const H = rng.range(7.6, 8.2);
      return { height: H, lean: 0, arms: [{ y: H - 0.35, half: 0.95, pins: [-0.85, -0.45, 0.45, 0.85] }], brackets: [], stay: false };
    }
    case "two arms": {
      const H = rng.range(8.2, 8.8);
      const pins = [-1.05, -0.62, 0.62, 1.05];
      return {
        height: H,
        lean: 0,
        arms: [
          { y: H - 0.35, half: 1.15, pins },
          { y: H - 0.95, half: 1.15, pins },
        ],
        brackets: [],
        stay: false,
      };
    }
    case "railway route, four arms": {
      const H = rng.range(9.2, 9.8);
      const pins = [-1.25, -0.92, -0.58, 0.58, 0.92, 1.25];
      return {
        height: H,
        lean: 0,
        arms: [0, 1, 2, 3].map((i) => ({ y: H - 0.35 - i * 0.55, half: 1.35, pins })),
        brackets: [],
        stay: true,
      };
    }
    case "bracket insulators": {
      const H = rng.range(6.6, 7.2);
      return { height: H, lean: 0, arms: [], brackets: [[-0.22, H - 0.3, 0], [0.22, H - 0.6, 0]], stay: false };
    }
    default: {
      const H = rng.range(8.2, 8.8);
      const pins = [-1.05, -0.62, 0.62, 1.05];
      return {
        height: H,
        lean: 0.065,
        arms: [
          { y: H - 0.35, half: 1.15, pins },
          { y: H - 0.95, half: 1.15, pins: [-1.05, 0.62, 1.05] },
          { y: H - 1.55, half: 1.15, pins: [-0.62, 0.62] },
        ],
        brackets: [],
        stay: false,
      };
    }
  }
}

/** Glass/porcelain pin insulator, 14 cm tall. */
function insulator(): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.001, 0.15),
      new THREE.Vector2(0.034, 0.13),
      new THREE.Vector2(0.03, 0.09),
      new THREE.Vector2(0.052, 0.035),
      new THREE.Vector2(0.03, 0.03),
    ],
    5,
  );
}

const leanMatrix = (lean: number) => new THREE.Matrix4().makeRotationZ(lean);

/** Wire attachment points in prefab-local space (insulator necks). */
export function telegraphAttachments(variant: number): THREE.Vector3[] {
  const plan = polePlan(variant);
  const m = leanMatrix(plan.lean);
  const out: THREE.Vector3[] = [];
  for (const arm of plan.arms) for (const x of arm.pins) out.push(v3(x, arm.y + 0.06 + 0.1, 0).applyMatrix4(m));
  for (const b of plan.brackets) out.push(v3(b[0] * 1.5, b[1] + 0.12, 0).applyMatrix4(m));
  return out;
}

export function buildTelegraphPole(variant: number): THREE.BufferGeometry {
  const plan = polePlan(variant);
  const k = new Kit();
  const m = leanMatrix(plan.lean);
  const H = plan.height;
  const add = (g: THREE.BufferGeometry, tone: Tone) => k.add(g, { tone, matrix: m });
  add(taperTube([v3(0, -0.4, 0), v3(0, H, 0)], 0.135, 0.095, { radial: 8, segments: 2, gnarl: 0.03 }), "light");
  // Weather cap on the pole top.
  const cap = new THREE.ConeGeometry(0.13, 0.12, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(0, H + 0.06, 0);
  add(cap, "dark");
  // Pole step irons up one side.
  for (let y = 2.6; y < H - 1.2; y += 0.45) add(rod(v3(0.1, y, 0), v3(0.28, y + 0.02, 0), 0.012, 3), "solid");
  const ins = insulator();
  for (const arm of plan.arms) {
    add(boxAt([-arm.half, arm.y - 0.05, -0.055], [arm.half, arm.y + 0.06, 0.055]), "pale");
    // Iron braces under the arm.
    for (const s of [-1, 1]) add(rod(v3(s * 0.55, arm.y - 0.04, 0.06), v3(0, arm.y - 0.55, 0.11), 0.012, 3), "solid");
    for (const x of arm.pins) {
      add(rod(v3(x, arm.y + 0.06, 0), v3(x, arm.y + 0.1, 0), 0.012, 3), "solid");
      const g = ins.clone();
      g.translate(x, arm.y + 0.06, 0);
      add(g, "paper");
    }
  }
  for (const b of plan.brackets) {
    // A cranked iron bracket bolted to the pole.
    add(rod(v3(Math.sign(b[0]) * 0.1, b[1] - 0.12, 0), v3(b[0] * 1.5, b[1] - 0.02, 0), 0.015, 4), "solid");
    const g = ins.clone();
    g.translate(b[0] * 1.5, b[1] - 0.02, 0);
    add(g, "paper");
  }
  if (plan.stay) {
    // A stay wire to a ground anchor behind the pole, with its guard.
    k.add(rod(v3(0, H - 1.0, -0.05), v3(0, 0.05, -3.2), 0.01, 3), { tone: "solid" });
    k.add(cylinder(0.05, 0.05, 1.6, 6), { tone: "paper", position: [0, 0.8, -2.4], rotation: [Math.atan2(3.2, H - 1) * -1, 0, 0] });
    k.add(boxAt([-0.2, -0.05, -3.35], [0.2, 0.08, -3.05]), { tone: "pale" });
  }
  return k.build();
}

// --------------------------------------------------------------- markers

/** Seven-segment style numerals as ink strokes on a plate (x centred, y baseline, height h). */
function numerals(k: Kit, text: string, x: number, y: number, z: number, h: number, m: THREE.Matrix4): void {
  const SEG: Record<string, number[]> = {
    "0": [0, 1, 2, 4, 5, 6],
    "1": [2, 5],
    "2": [0, 2, 3, 4, 6],
    "3": [0, 2, 3, 5, 6],
    "4": [1, 2, 3, 5],
    "5": [0, 1, 3, 5, 6],
    "6": [0, 1, 3, 4, 5, 6],
    "7": [0, 2, 5],
    "8": [0, 1, 2, 3, 4, 5, 6],
    "9": [0, 1, 2, 3, 5, 6],
  };
  const w = h * 0.55;
  const t = h * 0.13;
  const total = text.length * (w + t * 1.5) - t * 1.5;
  let cx = x - total / 2;
  for (const ch of text) {
    const segs = SEG[ch] ?? [];
    for (const s of segs) {
      let g: THREE.BufferGeometry;
      if (s === 0) g = boxAt([cx, y + h - t, z], [cx + w, y + h, z + 0.01]);
      else if (s === 3) g = boxAt([cx, y + h / 2 - t / 2, z], [cx + w, y + h / 2 + t / 2, z + 0.01]);
      else if (s === 6) g = boxAt([cx, y, z], [cx + w, y + t, z + 0.01]);
      else if (s === 1) g = boxAt([cx, y + h / 2, z], [cx + t, y + h, z + 0.01]);
      else if (s === 2) g = boxAt([cx + w - t, y + h / 2, z], [cx + w, y + h, z + 0.01]);
      else if (s === 4) g = boxAt([cx, y, z], [cx + t, y + h / 2, z + 0.01]);
      else g = boxAt([cx + w - t, y, z], [cx + w, y + h / 2, z + 0.01]);
      k.add(g, { tone: "solid", matrix: m });
    }
    cx += w + t * 1.5;
  }
}

export function buildMarker(variant: number): THREE.BufferGeometry {
  const v = mod(variant, MARKER_VARIANTS.length);
  const rng = createRng(`nature:marker:${variant}`);
  const k = new Kit();
  const kind = MARKER_VARIANTS[v]!;
  switch (kind) {
    case "milepost":
    case "quarter-mile post": {
      const big = kind === "milepost";
      const postH = big ? 0.85 : 0.6;
      k.add(boxAt([-0.05, -0.2, -0.05], [0.05, postH, 0.05]), { tone: "dark" });
      // An inclined cast plate facing the driver (+Z).
      const pw = big ? 0.5 : 0.32;
      const ph = big ? 0.34 : 0.22;
      const tilt = new THREE.Matrix4().compose(v3(0, postH + ph * 0.3, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0)), v3(1, 1, 1));
      k.add(boxAt([-pw / 2, -ph / 2, -0.02], [pw / 2, ph / 2, 0.02]), { tone: "paper", matrix: tilt });
      k.add(boxAt([-pw / 2 - 0.015, -ph / 2 - 0.015, -0.025], [pw / 2 + 0.015, ph / 2 + 0.015, 0.015]), { tone: "solid", matrix: tilt });
      if (big) numerals(k, String(rng.int(12, 97)), 0, -ph * 0.32, 0.02, ph * 0.62, tilt);
      else for (let i = 0; i < rng.int(1, 3); i++) k.add(boxAt([-0.1, -0.07 + i * 0.06, 0.02], [0.1, -0.045 + i * 0.06, 0.03]), { tone: "solid", matrix: tilt });
      break;
    }
    case "gradient post": {
      k.add(boxAt([-0.05, -0.2, -0.05], [0.05, 1.45, 0.05]), { tone: "light" });
      for (const [s, tilt] of [
        [-1, 0.18],
        [1, -0.12],
      ] as const) {
        const arm = new THREE.Matrix4().compose(v3(0, 1.3, 0.06), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)), v3(1, 1, 1));
        k.add(boxAt(s < 0 ? [-0.62, -0.07, 0] : [0, -0.07, 0], s < 0 ? [0, 0.07, 0.03] : [0.62, 0.07, 0.03]), { tone: "paper", matrix: arm });
        k.add(boxAt(s < 0 ? [-0.62, -0.08, -0.005] : [0, -0.08, -0.005], s < 0 ? [0, 0.08, 0.02] : [0.62, 0.08, 0.02]), { tone: "solid", matrix: arm });
        numerals(k, String(rng.int(1, 3) * 100 + rng.int(0, 9) * 10), s * 0.33, -0.05, 0.03, 0.1, arm);
      }
      break;
    }
    case "whistle board":
    case "speed board":
    case "distant sign": {
      const H = 1.5;
      k.add(boxAt([-0.04, -0.2, -0.04], [0.04, H, 0.04]), { tone: "light" });
      const w = kind === "speed board" ? 0.5 : 0.6;
      const h = kind === "speed board" ? 0.4 : 0.6;
      const board = new THREE.Matrix4().makeTranslation(0, H + h / 2 - 0.05, 0.05);
      k.add(boxAt([-w / 2 - 0.02, -h / 2 - 0.02, -0.01], [w / 2 + 0.02, h / 2 + 0.02, 0.02]), { tone: "solid", matrix: board });
      if (kind === "distant sign") {
        // Amber board with a black chevron: the railway's "caution ahead".
        k.add(boxAt([-w / 2, -h / 2, 0.02], [w / 2, h / 2, 0.03]), { tone: "paper", accent: "amber", matrix: board });
        for (const s of [-1, 1]) {
          const bar = boxAt([0, -0.04, 0], [0.34, 0.04, 0.01]);
          bar.rotateZ(s > 0 ? -0.65 : Math.PI + 0.65);
          k.add(bar, { tone: "solid", position: [0, 0.08, 0.03], matrix: board });
        }
      } else {
        k.add(boxAt([-w / 2, -h / 2, 0.02], [w / 2, h / 2, 0.03]), { tone: "paper", matrix: board });
        if (kind === "whistle board") {
          const strokes: Array<[number, number, number]> = [
            [-0.17, -0.02, 0.3],
            [-0.06, -0.02, -0.3],
            [0.06, -0.02, 0.3],
            [0.17, -0.02, -0.3],
          ];
          for (const [x, y, a] of strokes) {
            const s = boxAt([-0.03, -0.18, 0], [0.03, 0.18, 0.01]);
            s.rotateZ(a);
            k.add(s, { tone: "solid", position: [x, y, 0.03], matrix: board });
          }
        } else {
          numerals(k, String(rng.int(2, 9) * 10), 0, -0.12, 0.03, 0.24, board);
        }
      }
      break;
    }
  }
  return k.build();
}
