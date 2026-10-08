/**
 * Military vehicles, drawn dark: a 6x6 cargo truck under a canvas tilt, and
 * an 8x8 armoured personnel carrier with a faceted hull and a turret that
 * slowly traverses (and can be told to track a point).
 *
 *   military-truck   7.30 x 2.45 x 3.00, tyres 1.12 m, tandem rear axles
 *   armored-vehicle  7.90 x 2.95 x 3.05, tyres 1.20 m, four axles
 */
import * as THREE from "three";
import { Kit, cylinder, jitter, type Tone } from "../../core/geometry.ts";
import {
  Decals,
  HATCH,
  OBJECT_ID,
  bar,
  bodyMaterial,
  cylX,
  cylZ,
  fitText,
  inkAtlas,
  loft,
  louvre,
  mirrorX,
  pipe,
  type V2,
} from "./common.ts";
import { Assembly } from "./assembly.ts";
import { createInkLineMaterial } from "../../core/ink-material.ts";
import { slab } from "./shaping.ts";
import { GLASS, headlamp, mirrorGeom, mountWheels, type RoadBuild } from "./road.ts";

const OLIVE: Tone = "dark";
const DRAB: Tone = 0.5;

/** White stencil lettering on dark paint (white texels become paper). */
function stencilAtlas(): THREE.Texture | null {
  return inkAtlas("machines:stencil", 512, 256, (g) => {
    fitText(g, "4 △ 21", 8, 8, 496, 110, { color: "#fff", weight: 800, family: `"Courier New", Courier, monospace` });
    fitText(g, "B-7160", 8, 136, 496, 110, { color: "#fff", weight: 800, family: `"Courier New", Courier, monospace` });
  });
}

// --------------------------------------------------------- military truck

export function buildMilitaryTruck(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "military-truck", b.condition);
  const wreck = b.condition === "wreck";
  const L = 7.3,
    W = 2.45,
    hw = W / 2,
    R = 0.56;
  const zF = L / 2,
    zR = -L / 2;
  const zf = 2.35,
    zr1 = -1.35,
    zr2 = -2.75;
  a.rig.bone("body", "root", [0, wreck ? -0.18 : 0, 0]);
  const k = new Kit();
  // Frame, bumper, winch, shackles.
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.12, 0.3, L - 0.3), { tone: "deep", position: [s * 0.46, 1.05, 0] });
  k.add(new THREE.BoxGeometry(W, 0.28, 0.24), { tone: OLIVE, position: [0, 0.92, zF - 0.12] });
  k.add(cylX(0.13, 0.7, 12), { tone: "deep", position: [0, 0.92, zF + 0.02] });
  for (const s of [-1, 1]) k.add(new THREE.TorusGeometry(0.07, 0.025, 5, 10), { tone: "deep", position: [s * 0.85, 0.82, zF + 0.04], rotation: [Math.PI / 2, 0, 0] });
  // Bonnet: tapered box, bar grille and brush guard.
  const hood = loft([
    { z: 2.0, pts: [[-0.62, 1.1], [0.62, 1.1], [0.58, 1.86], [-0.58, 1.86]] },
    { z: 3.48, pts: [[-0.6, 1.1], [0.6, 1.1], [0.55, 1.78], [-0.55, 1.78]] },
  ]);
  k.add(hood, { tone: OLIVE });
  k.add(new THREE.BoxGeometry(1.08, 0.58, 0.04), { tone: "solid", position: [0, 1.42, 3.49] });
  for (let i = 0; i < 9; i++) k.add(new THREE.BoxGeometry(0.04, 0.56, 0.05), { tone: DRAB, position: [-0.48 + i * 0.12, 1.42, 3.52] });
  for (const s of [-1, 1]) k.add(bar([s * 0.62, 0.95, 3.62], [s * 0.62, 1.8, 3.58], 0.035, 6), { tone: "deep" });
  k.add(bar([-0.62, 1.8, 3.58], [0.62, 1.8, 3.58], 0.035, 6), { tone: "deep" });
  // Flat fenders over the front wheels, round lamps with guards.
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.62, 0.06, 1.6), { tone: OLIVE, position: [s * (hw - 0.31), 1.34, zf + 0.05] });
    k.add(new THREE.BoxGeometry(0.06, 0.34, 1.6), { tone: OLIVE, position: [s * (hw - 0.03), 1.18, zf + 0.05] });
    k.add(new THREE.BoxGeometry(0.62, 0.34, 0.05), { tone: OLIVE, position: [s * (hw - 0.31), 1.17, zf + 0.84], rotation: [-0.5, 0, 0] });
    k.add(headlamp(0.2, 0.2, true), { position: [s * 0.86, 1.52, 3.18] });
    k.add(cylinder(0.12, 0.12, 0.2, 10), { tone: OLIVE, position: [s * 0.86, 1.42, 3.1] });
    for (const dx of [-0.07, 0, 0.07]) k.add(new THREE.BoxGeometry(0.012, 0.22, 0.012), { tone: "deep", position: [s * 0.86 + dx, 1.52, 3.3] });
    k.add(new THREE.BoxGeometry(0.4, 0.5, 0.02), { tone: "deep", position: [s * (hw - 0.3), 0.72, zr2 - 0.75] });
  }
  // Cab: flat two-pane screen, door windows, canvas-backed roof, ring mount.
  const cz0 = 0.85,
    cz1 = 2.02,
    cy0 = 1.3,
    cy1 = 2.55;
  const cab = loft([
    { z: cz0, pts: [[-1.1, cy0], [1.1, cy0], [1.1, cy1], [-1.1, cy1]] },
    { z: cz1 - 0.35, pts: [[-1.1, cy0], [1.1, cy0], [1.1, cy1], [-1.1, cy1]] },
    { z: cz1, pts: [[-1.1, cy0], [1.1, cy0], [1.06, cy1 - 0.08], [-1.06, cy1 - 0.08]] },
  ]);
  k.add(cab, { tone: OLIVE });
  const inside: V2 = [1.4, 2.0];
  for (const s of [-1, 1]) {
    k.add(slab([cz1 - 0.02, 1.9], [cz1 - 0.32, cy1 - 0.12], 0.86, 0.02, 0.004, inside, 0), { tone: GLASS, position: [s * 0.5, 0, 0] });
    k.add(new THREE.BoxGeometry(0.02, 0.5, 0.62), { tone: GLASS, position: [s * 1.11, 2.1, 1.5] });
    k.add(new THREE.BoxGeometry(0.02, 0.9, 0.012), { tone: "deep", position: [s * 1.112, 1.75, 1.08] });
  }
  k.add(slab([cz1 - 0.02, 1.9], [cz1 - 0.32, cy1 - 0.12], 0.05, 0.012, 0.024, inside, 0.1), { tone: "paper", position: [0.4, 0, 0] });
  k.add(new THREE.TorusGeometry(0.42, 0.05, 5, 16), { tone: "deep", position: [0.45, cy1 + 0.05, 1.3], rotation: [Math.PI / 2, 0, 0] });
  const mg = mirrorGeom(0.3, 0.4, true);
  k.add(mg, { position: [1.05, 2.05, 1.95] });
  k.add(mirrorX(mg), { position: [-1.05, 2.05, 1.95] });
  // Spare wheel standing behind the cab, jerrycans.
  k.add(cylX(0.5, 0.34, 14), { tone: "deep", position: [0, 1.95, 0.6], rotation: [0, Math.PI / 2, 0] });
  k.add(cylX(0.3, 0.36, 10), { tone: OLIVE, position: [0, 1.95, 0.6], rotation: [0, Math.PI / 2, 0] });
  for (const z of [-0.2, 0.15]) {
    k.add(new THREE.BoxGeometry(0.17, 0.46, 0.34), { tone: DRAB, position: [hw + 0.05, 1.55, z] });
    k.add(new THREE.BoxGeometry(0.02, 0.36, 0.02), { tone: "deep", position: [hw + 0.14, 1.55, z], rotation: [0.6, 0, 0] });
    k.add(new THREE.BoxGeometry(0.02, 0.36, 0.02), { tone: "deep", position: [hw + 0.14, 1.55, z], rotation: [-0.6, 0, 0] });
  }
  // Cargo bed with stake sides and tailgate.
  const bz0 = zR,
    bz1 = 0.5,
    by0 = 1.38,
    by1 = 1.95;
  k.add(new THREE.BoxGeometry(W, 0.12, bz1 - bz0), { tone: OLIVE, position: [0, by0, (bz0 + bz1) / 2] });
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.06, by1 - by0, bz1 - bz0), { tone: OLIVE, position: [s * (hw - 0.03), (by0 + by1) / 2, (bz0 + bz1) / 2] });
    for (let i = 0; i <= 6; i++) k.add(new THREE.BoxGeometry(0.05, by1 - by0 + 0.02, 0.07), { tone: "deep", position: [s * (hw + 0.005), (by0 + by1) / 2, bz0 + 0.1 + (i * (bz1 - bz0 - 0.2)) / 6] });
  }
  k.add(new THREE.BoxGeometry(W, by1 - by0, 0.06), { tone: OLIVE, position: [0, (by0 + by1) / 2, bz0 + 0.03] });
  // Canvas tilt over six hoops, sagging between them.
  const hoopZ: number[] = [];
  for (let i = 0; i <= 5; i++) hoopZ.push(bz0 + 0.06 + (i * (bz1 - bz0 - 0.12)) / 5);
  const sections: Array<{ z: number; pts: V2[] }> = [];
  const tiltSection = (sag: number): V2[] => {
    const pts: V2[] = [];
    const hwT = hw - 0.02 - sag * 0.4;
    const top = 3.0 - sag;
    pts.push([-hwT, by1 - 0.05], [hwT, by1 - 0.05], [hwT, 2.62 - sag * 0.6]);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const ang = t * Math.PI;
      pts.push([Math.cos(ang) * hwT, 2.62 - sag * 0.6 + Math.sin(ang) * (top - 2.62)]);
    }
    pts.push([-hwT, 2.62 - sag * 0.6]);
    return pts;
  };
  for (let i = 0; i < hoopZ.length; i++) {
    sections.push({ z: hoopZ[i]!, pts: tiltSection(0) });
    if (i < hoopZ.length - 1) sections.push({ z: (hoopZ[i]! + hoopZ[i + 1]!) / 2, pts: tiltSection(0.05) });
  }
  let tilt = loft(sections);
  tilt = jitter(tilt, 0.02, b.seed + 11);
  k.add(tilt, { tone: DRAB });
  // Rolled rear flap and lashing.
  k.add(cylX(0.08, W - 0.1, 10), { tone: DRAB, position: [0, 2.72, bz0 + 0.02] });
  for (const x of [-0.8, 0, 0.8]) k.add(new THREE.BoxGeometry(0.02, 0.9, 0.02), { tone: "deep", position: [x, 2.3, bz0 + 0.03] });
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.02, 0.06, 0.02), { tone: "deep", position: [s * (hw - 0.0), by1 + 0.04, bz0 + 0.3 + i * 0.52] });
  // Wells in shadow, tail lamps, blackout lamps, fuel tank.
  for (const z of [zf, zr1, zr2]) k.add(new THREE.BoxGeometry(W - 1.1, 0.7, 1.2), { tone: "solid", position: [0, 0.95, z] });
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.14, 0.1, 0.04), { tone: "solid", position: [s * 0.95, 1.2, zR - 0.02] });
  k.add(cylZ(0.24, 1.0, 12), { tone: OLIVE, position: [-(hw - 0.35), 1.02, -0.05] });
  let body = k.build();
  if (wreck) body = jitter(body, 0.04, b.seed + 5);
  a.rig.kit("body").addGeometry(body);

  const tex = stencilAtlas();
  const d = new Decals(512, 256);
  d.add([0, 0, 512, 128], [0.46, 0.12], { position: [-0.72, 0.93, zF + 0.002] });
  d.add([0, 128, 512, 128], [0.46, 0.12], { position: [0.72, 0.93, zF + 0.002] });
  d.add([0, 128, 512, 128], [0.9, 0.22], { position: [1.112, 1.62, 1.45], rotation: [0, Math.PI / 2, 0] });
  d.add([0, 128, 512, 128], [0.9, 0.22], { position: [-1.112, 1.62, 1.45], rotation: [0, -Math.PI / 2, 0] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.heavy, objectId: OBJECT_ID.vehicle, bone: "body" };

  mountWheels(
    a,
    b,
    [
      { z: zr2, track: 1.95 },
      { z: zr1, track: 1.95 },
      { z: zf, track: 1.95 },
    ],
    { r: R, w: 0.38, rim: 0.3, style: "military", seg: 12 },
  );
  a.speed = b.speed;
  a.mass = 5;
  return a.finish(bodyMaterial(HATCH.heavy, OBJECT_ID.vehicle, 0.4), { width: W, depth: L, height: 3.0 });
}

// -------------------------------------------------------- armoured vehicle

/** Half cross-section of the hull (x >= 0), bottom centre to roof centre. */
const HULL: V2[] = [
  [0, 0.48],
  [0.72, 0.62],
  [1.3, 0.96],
  [1.47, 1.5],
  [1.26, 2.22],
  [0, 2.28],
];

function hullSection(scaleX: number, y0: number, y1: number): V2[] {
  const full: V2[] = [...HULL.slice(0, -1), ...HULL.slice(1).reverse().map(([x, y]): V2 => [-x, y])];
  // Counter-clockwise seen from +z: bottom centre → +x side → roof → -x side.
  const yb = 0.48,
    yt = 2.28;
  const pts = full.map(([x, y]): V2 => [x * scaleX, y0 + ((y - yb) * (y1 - y0)) / (yt - yb)]);
  return pts;
}

export function buildArmoredVehicle(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "armored-vehicle", b.condition);
  const wreck = b.condition === "wreck";
  const L = 7.9,
    R = 0.6;
  const zF = L / 2,
    zR = -L / 2;
  const axles = [2.55, 1.1, -0.9, -2.45];
  a.rig.bone("body", "root", [0, wreck ? -0.25 : 0, 0]);
  const k = new Kit();
  // Faceted hull: rear plate, long body, glacis to the nose.
  const hull = loft([
    { z: zR, pts: hullSection(0.95, 0.58, 2.2) },
    { z: zR + 0.14, pts: hullSection(1, 0.48, 2.28) },
    { z: 2.3, pts: hullSection(1, 0.48, 2.28) },
    { z: 3.2, pts: hullSection(0.98, 0.62, 1.78) },
    { z: zF, pts: hullSection(0.86, 0.92, 1.34) },
  ]);
  k.add(hull, { tone: OLIVE });
  // Appliqué armour panels along the sponsons (panel lines), bolt rows.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = zR + 0.55 + i * 1.32;
      k.add(new THREE.BoxGeometry(0.05, 0.46, 1.24), { tone: OLIVE, position: [s * 1.46, 1.46, z], rotation: [0, 0, s * 0.3] });
      for (let j = 0; j < 4; j++) k.add(new THREE.BoxGeometry(0.03, 0.04, 0.04), { tone: "deep", position: [s * 1.51, 1.62, z - 0.48 + j * 0.32], rotation: [0, 0, s * 0.3] });
    }
    // Stowage bins and a tow cable.
    k.add(new THREE.BoxGeometry(0.3, 0.3, 1.5), { tone: DRAB, position: [s * 1.32, 2.2, -2.2] });
    k.add(pipe([
      [s * 1.35, 1.95, 1.8],
      [s * 1.4, 1.98, 0.2],
      [s * 1.38, 1.95, -1.2],
      [s * 1.25, 2.05, -2.9],
    ], 0.03, 16, 5), { tone: "deep" });
    // Smoke grenade launchers are on the turret; here, headlamp clusters with guards.
    k.add(new THREE.BoxGeometry(0.26, 0.16, 0.14), { tone: "deep", position: [s * 1.05, 1.62, 3.42], rotation: [-0.7, 0, 0] });
    k.add(new THREE.BoxGeometry(0.2, 0.1, 0.03), { tone: "light", position: [s * 1.05, 1.66, 3.5], rotation: [-0.7, 0, 0] });
    k.add(new THREE.TorusGeometry(0.08, 0.02, 4, 8), { tone: "deep", position: [s * 0.7, 1.02, zF - 0.02] });
    // Antenna bases at the rear corners.
    k.add(cylinder(0.05, 0.06, 0.12, 8), { tone: "deep", position: [s * 1.05, 2.3, -3.3] });
  }
  // Driver's hatch and periscopes, commander's hatch, engine grille.
  k.add(cylinder(0.34, 0.36, 0.08, 14), { tone: DRAB, position: [-0.7, 2.18, 2.42], rotation: [0.46, 0, 0] });
  for (const x of [-0.95, -0.7, -0.45]) k.add(new THREE.BoxGeometry(0.16, 0.1, 0.1), { tone: "solid", position: [x, 2.15, 2.72], rotation: [0.46, 0, 0] });
  k.add(louvre(1.1, 0.8, 7, 0.03), { position: [0.5, 2.1, 2.55], rotation: [-Math.PI / 2 + 0.46, 0, 0] });
  k.add(cylinder(0.36, 0.38, 0.08, 14), { tone: DRAB, position: [0.6, 2.32, -2.4] });
  // Rear ramp outline and hinges.
  k.add(new THREE.BoxGeometry(1.6, 1.3, 0.05), { tone: DRAB, position: [0, 1.3, zR - 0.01] });
  for (const x of [-0.6, 0.6]) k.add(cylX(0.06, 0.3, 8), { tone: "deep", position: [x, 0.66, zR - 0.02] });
  k.add(new THREE.BoxGeometry(0.3, 0.3, 0.03), { tone: "solid", position: [0.4, 1.55, zR - 0.04] });
  // Wells in shadow between the wheel stations.
  k.add(new THREE.BoxGeometry(1.7, 0.4, L - 1.0), { tone: "solid", position: [0, 0.75, -0.1] });
  let body = k.build();
  if (wreck) body = jitter(body, 0.05, b.seed + 9);
  a.rig.kit("body").addGeometry(body);

  // Turret on its own bone: faceted cupola, cannon, smoke launchers, sights.
  a.rig.bone("turret", "body", [0, 2.28, -0.35]);
  const t = a.rig.kit("turret");
  const turret = loft([
    { z: -1.1, pts: [[-0.9, 0], [0.9, 0], [0.8, 0.5], [-0.8, 0.5]] },
    { z: 0.4, pts: [[-1.0, 0], [1.0, 0], [0.86, 0.56], [-0.86, 0.56]] },
    { z: 1.05, pts: [[-0.66, 0], [0.66, 0], [0.5, 0.42], [-0.5, 0.42]] },
  ]);
  t.add(turret, { tone: OLIVE });
  t.add(cylZ(0.12, 0.5, 10), { tone: OLIVE, position: [0, 0.28, 1.2] });
  t.add(cylZ(0.055, 2.3, 8, 0.065), { tone: "deep", position: [0, 0.28, 2.3] });
  t.add(cylZ(0.075, 0.28, 8), { tone: "deep", position: [0, 0.28, 3.3] });
  t.add(cylZ(0.03, 0.8, 6), { tone: "deep", position: [0.28, 0.3, 1.4] });
  t.add(new THREE.BoxGeometry(0.34, 0.28, 0.4), { tone: DRAB, position: [-0.55, 0.7, 0.1] });
  t.add(new THREE.BoxGeometry(0.26, 0.18, 0.02), { tone: "solid", position: [-0.55, 0.72, 0.31] });
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) t.add(cylZ(0.045, 0.28, 6), { tone: "deep", position: [s * (0.92 - i * 0.02), 0.25 + (i % 2) * 0.1, 0.35 + Math.floor(i / 2) * 0.12], rotation: [-0.5, s * 0.5, 0] });
  t.add(cylinder(0.3, 0.32, 0.08, 12), { tone: DRAB, position: [0.35, 0.58, -0.55] });
  const turretBone = a.rig.get("turret");
  // Whip antennas as pen lines: crisp at any distance.
  const whip: number[] = [];
  for (const s of [-1, 1]) {
    let px = s * 1.05,
      py = 2.36,
      pz = -3.3;
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const nx = s * 1.05 + s * 0.12 * t * t,
        ny = 2.36 + 2.6 * t,
        nz = -3.3 - 0.35 * t * t;
      whip.push(px, py, pz, nx, ny, nz);
      px = nx;
      py = ny;
      pz = nz;
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(whip, 3));
  const whips = new THREE.LineSegments(wg, createInkLineMaterial({ tone: 0.9 }));
  whips.name = "whips";
  a.extras.push({ object: whips, bone: "body" });

  mountWheels(
    a,
    b,
    axles.map((z) => ({ z, track: 2.3 })),
    { r: R, w: 0.42, rim: 0.34, style: "military", seg: 12 },
  );
  // Traverse: a slow, patient sweep that holds for long beats; or track a target.
  let target: THREE.Vector3 | null = null;
  const tmp = new THREE.Vector3();
  let yaw = 0;
  const phase = (b.seed % 11) * 0.7;
  a.onTick((dt, time) => {
    if (a.root && (a.root.userData as { struck?: boolean }).struck) return;
    let goal: number;
    if (target && a.root) {
      a.root.updateMatrixWorld();
      tmp.copy(target);
      a.root.worldToLocal(tmp);
      goal = Math.atan2(tmp.x, tmp.z);
    } else {
      const cyc = (time * 0.07 + phase) % 1;
      goal = cyc < 0.35 ? -0.55 : cyc < 0.5 ? 0 : cyc < 0.85 ? 0.7 : 0.1;
    }
    let d = goal - yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const rate = 0.35;
    yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    turretBone.rotation.y = yaw;
  });
  a.speed = b.speed;
  a.mass = 8;
  a.bob = 0.004;
  const root = a.finish(bodyMaterial(HATCH.heavy, OBJECT_ID.vehicle, 0.4), { width: 2.95, depth: L + 0.9, height: 3.05 });
  root.userData.aim = (p: THREE.Vector3 | null) => {
    target = p ? p.clone() : null;
  };
  return root;
}
