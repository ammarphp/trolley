/**
 * The cab body seen from the driver's seat: raked front wall with the
 * windshield opening and its rubber gasket, corner pillars, side walls with
 * sliding windows, the ceiling, and the header furniture (destination blind
 * box, sun visor, the retrofitted driver camera).
 */
import * as THREE from "three";
import { Kit, cylinder, sphere } from "../core/geometry.ts";
import type { Rng } from "../core/rng.ts";
import { GLASS, ROOF_Y, WALL_X, glassMatrix, glassPoint } from "./layout.ts";
import type { LabelAtlas } from "./labels.ts";
import {
  IDS,
  atlasDisc,
  atlasPlane,
  cabMaterial,
  cabMesh,
  cylinderBetween,
  mat4,
  roundedBox,
  roundedRectPts,
  sectionExtrude,
  slab,
  v3,
} from "./util.ts";

export interface ShellParts {
  group: THREE.Group;
  /** Recording LED under the blind box (toggle visibility). */
  cameraLed: THREE.Mesh;
  /** Side-window opening (left), cab-local, for placing exterior parts. */
  leftWindow: { z0: number; z1: number; y0: number; y1: number };
}

export const SIDE_WINDOW = { z0: -1.1, z1: -0.08, y0: 1.0, y1: 1.77, r: 0.07 };

export function buildShell(atlas: LabelAtlas, labels: THREE.BufferGeometry[], rng: Rng): ShellParts {
  void rng;
  const group = new THREE.Group();
  group.name = "cab-shell";
  const k = new Kit();
  const gm = glassMatrix();
  const hw = GLASS.halfW,
    hh = GLASS.halfH,
    gr = GLASS.radius;

  // ------------------------------------------------------------ front wall
  const wallOutline: Array<[number, number]> = [
    [-0.9, -0.64],
    [0.9, -0.64],
    [0.9, 0.7],
    [-0.9, 0.7],
  ];
  const hole = roundedRectPts(hw * 2, hh * 2, gr, 8);
  k.add(slab(wallOutline, 0.05, { holes: [hole], z0: -0.03 }), { tone: "paper", matrix: gm });
  // Rubber gasket: a bold dark frame, with a raised locking strip inside it.
  const gOuter = roundedRectPts(hw * 2 + 0.064, hh * 2 + 0.064, gr + 0.032, 8);
  const gInner = roundedRectPts(hw * 2 - 0.012, hh * 2 - 0.012, gr - 0.006, 8);
  k.add(slab(gOuter, 0.016, { holes: [gInner], z0: 0.018, bevel: 0.004 }), { tone: "deep", matrix: gm });
  const lOuter = roundedRectPts(hw * 2 + 0.022, hh * 2 + 0.022, gr + 0.011, 8);
  const lInner = roundedRectPts(hw * 2 + 0.004, hh * 2 + 0.004, gr + 0.002, 8);
  k.add(slab(lOuter, 0.006, { holes: [lInner], z0: 0.033 }), { tone: "solid", matrix: gm });

  // Corner posts (A-pillars), following the rake, with a column of rivets.
  for (const side of [-1, 1]) {
    const u = side * 0.817;
    k.add(roundedBox(0.056, 1.4, 0.07, 0.018, 3), { tone: "paper", position: [u, 0.02, 0.035], matrix: gm });
    for (let i = 0; i < 12; i++) {
      const v = -0.3 + i * 0.058;
      k.add(sphere(0.0042, 8, 5), { tone: "light", position: [u - side * 0.012, v, 0.07], scale: [1, 1, 0.55], matrix: gm });
    }
  }
  // Header rail above the glass and a trim strip below it.
  k.add(roundedBox(1.7, 0.05, 0.06, 0.012, 2), { tone: "paper", position: [0, hh + 0.075, 0.04], matrix: gm });

  // ----------------------------------------------------------- side walls
  const W = SIDE_WINDOW;
  const winProfile = roundedRectPts(W.z1 - W.z0, W.y1 - W.y0, W.r, 6, (W.z0 + W.z1) / 2, (W.y0 + W.y1) / 2);
  const wallProfile: Array<[number, number]> = [
    [-1.2, 0.25],
    [0.6, 0.25],
    [0.6, ROOF_Y + 0.05],
    [-1.2, ROOF_Y + 0.05],
  ];
  const trimOuter = roundedRectPts(W.z1 - W.z0 + 0.07, W.y1 - W.y0 + 0.07, W.r + 0.035, 6, (W.z0 + W.z1) / 2, (W.y0 + W.y1) / 2);
  for (const side of [-1, 1]) {
    const xi = side * WALL_X;
    const x0 = side < 0 ? xi - 0.05 : xi;
    k.add(sectionExtrude(wallProfile, x0, x0 + 0.05, [winProfile]), { tone: "paper" });
    // Window trim ring standing proud of the wall.
    const tx0 = side < 0 ? xi : xi - 0.014;
    k.add(sectionExtrude(trimOuter, tx0, tx0 + 0.014, [winProfile]), { tone: "pale" });
    // Sliding sash: front stile, rear pane frame offset outward, catch.
    const sx = side * (WALL_X + 0.022);
    k.add(roundedBox(0.03, W.y1 - W.y0, 0.034, 0.006), { tone: "pale", position: [sx, (W.y0 + W.y1) / 2, -0.5] , rotation: [0, Math.PI / 2, 0] });
    k.add(roundedBox(0.012, 0.05, 0.02, 0.004), { tone: "dark", position: [side * (WALL_X + 0.004), (W.y0 + W.y1) / 2, -0.47] });
    // Window sill ledge (armrest), padded.
    k.add(roundedBox(0.09, 0.035, W.z1 - W.z0 + 0.04, 0.012, 3), { tone: "mid", position: [side * (WALL_X - 0.035), W.y0 - 0.02, (W.z0 + W.z1) / 2] });
  }

  // ------------------------------------------------------------- ceiling
  k.add(roundedBox(1.84, 0.06, 1.9, 0.02), { tone: "paper", position: [0, ROOF_Y + 0.03, -0.3] });
  // Ceiling cove along the front, and two roof ribs.
  k.add(cylinder(0.07, 0.07, 1.7, 12), { tone: "paper", position: [0, ROOF_Y - 0.02, -1.0], rotation: [0, 0, Math.PI / 2] });
  for (const z of [-0.62, -0.1]) k.add(roundedBox(1.72, 0.05, 0.05, 0.012), { tone: "paper", position: [0, ROOF_Y - 0.025, z] });

  // ------------------------------------------------ destination blind box
  const boxC = v3(0, 1.742, -1.0);
  k.add(roundedBox(0.86, 0.205, 0.15, 0.014, 3), { tone: "paper", position: [boxC.x, boxC.y, boxC.z] });
  const face = boxC.z + 0.075;
  // Access door (raised panel), piano hinge, knurled latches.
  k.add(roundedBox(0.66, 0.15, 0.008, 0.003), { tone: "paper", position: [0, boxC.y + 0.004, face + 0.003] });
  k.add(cylinder(0.0055, 0.0055, 0.64, 10), { tone: "light", position: [0, boxC.y - 0.074, face + 0.006], rotation: [0, 0, Math.PI / 2] });
  for (let i = 0; i < 16; i++) k.add(cylinder(0.0062, 0.0062, 0.004, 10), { tone: "mid", position: [-0.31 + i * 0.0413, boxC.y - 0.074, face + 0.006], rotation: [0, 0, Math.PI / 2] });
  for (const x of [-0.29, 0.29]) {
    k.add(cylinder(0.011, 0.011, 0.012, 14), { tone: "light", position: [x, boxC.y + 0.052, face + 0.012], rotation: [Math.PI / 2, 0, 0] });
    k.add(cylinder(0.0045, 0.0045, 0.02, 8), { tone: "dark", position: [x, boxC.y + 0.052, face + 0.02], rotation: [Math.PI / 2, 0, 0] });
  }
  // Inspection window: a dark recessed frame, blind visible behind.
  const iw = 0.36,
    ih = 0.062;
  const frameO = roundedRectPts(iw + 0.024, ih + 0.024, 0.01, 4);
  const frameI = roundedRectPts(iw, ih, 0.004, 4);
  k.add(slab(frameO, 0.008, { holes: [frameI], z0: 0 }), { tone: "dark", position: [0, boxC.y + 0.006, face + 0.004] });
  labels.push(atlasPlane(iw, ih, atlas.rect("blind"), mat4([0, boxC.y + 0.006, face + 0.0045])));
  // Unit plate on the door.
  labels.push(atlasPlane(0.07, 0.0245, atlas.rect("unitPlate"), mat4([-0.25, boxC.y - 0.042, face + 0.0075])));
  // Louvres on the box ends.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      k.add(roundedBox(0.004, 0.012, 0.1, 0.0015), { tone: "mid", position: [side * 0.432, boxC.y - 0.05 + i * 0.024, boxC.z], rotation: [0, 0, side * 0.5] });
    }
  }


  // ------------------------------------------- grab rail on the left post
  {
    const a = glassPoint(-0.77, -0.16, 0.12);
    const b = glassPoint(-0.77, 0.24, 0.12);
    k.add(cylinderBetween(a, b, 0.0095, 0.0095, 12), { tone: "paper" });
    for (const p of [a, b]) {
      const back = p.clone().add(v3(0, 0, -0.065));
      k.add(cylinderBetween(p, back, 0.007, 0.007, 8), { tone: "light" });
      k.add(sphere(0.012, 10, 8), { tone: "paper", position: [p.x, p.y, p.z] });
    }
  }
  // Notice plate on the left post, above the handset hook.
  {
    const p = glassPoint(-0.817, 0.06, 0.071);
    const m = new THREE.Matrix4().multiplyMatrices(gm.clone().setPosition(p), mat4([0, 0, 0], [0, 0, 0]));
    labels.push(atlasPlane(0.05, 0.025, atlas.rect("notice"), m));
  }
  // Round inspection sticker inside the lower-right corner of the glass.
  labels.push(atlasDisc(0.034, atlas.rect("sticker"), 40, gm.clone().setPosition(glassPoint(0.655, -0.29, 0.011))));
  // A photograph tucked under the gasket at the lower-left corner of the
  // glass, leaning out a little from the pane.
  {
    const p = glassPoint(-0.668, -0.286, 0.013);
    const m = gm.clone().setPosition(p).multiply(mat4([0, 0, 0], [0.05, 0.16, -0.21]));
    labels.push(atlasPlane(0.088, 0.066, atlas.rect("photo"), m));
  }

  // --------------------------------------- retrofit: driver camera + loom
  const pod = v3(0.3, 1.612, -0.955);
  k.add(roundedBox(0.064, 0.042, 0.052, 0.01, 2), { tone: "light", position: [pod.x, pod.y, pod.z] });
  k.add(roundedBox(0.03, 0.022, 0.02, 0.004), { tone: "mid", position: [pod.x, pod.y + 0.028, pod.z - 0.01] });
  k.add(cylinder(0.013, 0.015, 0.018, 16), { tone: "dark", position: [pod.x - 0.008, pod.y - 0.002, pod.z + 0.032], rotation: [Math.PI / 2, 0, 0] });
  k.add(cylinder(0.0085, 0.0085, 0.004, 16), { tone: "solid", position: [pod.x - 0.008, pod.y - 0.002, pod.z + 0.042], rotation: [Math.PI / 2, 0, 0] });
  const loomPts: Array<[number, number, number]> = [
    [pod.x + 0.03, pod.y + 0.01, pod.z - 0.01],
    [0.42, 1.63, -0.99],
    [0.64, 1.64, -1.02],
    [0.74, 1.5, -1.04],
    [0.765, 1.2, -1.07],
    [0.76, 1.1, -1.06],
  ];
  {
    const curve = new THREE.CatmullRomCurve3(loomPts.map((p) => new THREE.Vector3(...p)));
    k.add(new THREE.TubeGeometry(curve, 48, 0.0065, 7, false), { tone: "dark" });
    // Zip ties.
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const a = p.clone().addScaledVector(tan, -0.003);
      const b = p.clone().addScaledVector(tan, 0.003);
      k.add(cylinderBetween(a, b, 0.0085, 0.0085, 8), { tone: "light" });
    }
  }

  const mesh = cabMesh(k.build(), cabMaterial(IDS.shell), "cab-shell-body");
  group.add(mesh);

  // Recording LED (signal red) under the pod.
  const led = cabMesh(
    new THREE.SphereGeometry(0.0035, 10, 8),
    cabMaterial(IDS.lamps, { vertexInk: false, tone: "paper", accent: "signal", accentAmount: 1, flat: true }),
    "cab-camera-led",
  );
  led.position.set(pod.x + 0.018, pod.y - 0.002, pod.z + 0.028);
  led.visible = false;
  group.add(led);

  return { group, cameraLed: led, leftWindow: { z0: W.z0, z1: W.z1, y0: W.y0, y1: W.y1 } };
}
