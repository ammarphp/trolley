/**
 * Road vehicles: car, van, ambulance, bus, truck, fire engine and the
 * military truck. Each is a side-profile coachwork extrusion with real wheel
 * arches, recessed glazing, and wheels on their own bones.
 *
 * Dimensions follow real vehicles (metres):
 *   car        4.70 x 1.82 x 1.45, wheelbase 2.75, tyre 0.65
 *   van        5.53 x 2.06 x 2.55, wheelbase 3.30, tyre 0.70
 *   ambulance  6.60 x 2.30 x 2.95, wheelbase 3.75
 *   bus       12.00 x 2.55 x 3.10, wheelbase 5.90, tyre 1.00
 *   truck      8.60 x 2.50 x 3.70, wheelbase 4.90, tyre 0.96
 *   fire       8.30 x 2.50 x 3.30, wheelbase 4.00
 *   military   7.30 x 2.50 x 3.00, 6x6, tyre 1.12
 */
import * as THREE from "three";
import { Kit, cylinder, jitter, type Tone } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";
import {
  HATCH,
  OBJECT_ID,
  archedSill,
  bar,
  bodyMaterial,
  cylZ,
  louvre,
  sideExtrude,
  sym,
  wheelGeometry,
  flipToLeft,
  mirrorX,
  type Condition,
  type V2,
  type V3,
  type WheelStyle,
} from "./common.ts";
import { Assembly } from "./assembly.ts";
import { coach, glazedShell, slab, windowHoles } from "./shaping.ts";

/** Glazing is drawn as solid ink relieved by white glints. */
export const GLASS: Tone = "solid";

export interface RoadBuild {
  seed: number;
  rng: Rng;
  condition: Condition;
  speed: number;
}

// ----------------------------------------------------------- fittings

/** Door-mirror on a stalk, right-hand side; mirrored by caller. */
function mirrorGeom(reach: number, h: number, tall = false): THREE.BufferGeometry {
  const k = new Kit();
  k.add(bar([0, 0, 0], [reach, 0.02, -0.04], 0.018, 5), { tone: "mid" });
  const mh = tall ? 0.36 : 0.12;
  k.add(new THREE.BoxGeometry(0.1, mh, 0.09), { tone: "paper", position: [reach + 0.03, 0.02 + (tall ? 0.05 : 0), -0.06] });
  k.add(new THREE.BoxGeometry(0.085, mh * 0.85, 0.01), { tone: "solid", position: [reach + 0.03, 0.02 + (tall ? 0.05 : 0), -0.11] });
  void h;
  return k.build();
}

function headlamp(w: number, h: number, round = false): THREE.BufferGeometry {
  const k = new Kit();
  if (round) {
    k.add(cylZ(h / 2, 0.06, 14), { tone: "solid", position: [0, 0, -0.01] });
    k.add(cylZ(h / 2 - 0.018, 0.02, 14), { tone: "pale", position: [0, 0, 0.022] });
    k.add(cylZ(h / 5, 0.02, 10), { tone: "paper", position: [0, 0, 0.03] });
  } else {
    k.add(new THREE.BoxGeometry(w, h, 0.05), { tone: "solid" });
    k.add(new THREE.BoxGeometry(w - 0.03, h - 0.03, 0.02), { tone: "pale", position: [0, 0, 0.022] });
    k.add(cylZ(h * 0.26, 0.02, 10), { tone: "paper", position: [w * 0.22, 0, 0.034] });
    k.add(cylZ(h * 0.2, 0.02, 10), { tone: "light", position: [-w * 0.2, 0, 0.034] });
  }
  return k.build();
}

function plate(w = 0.52, h = 0.11): THREE.BufferGeometry {
  const k = new Kit();
  k.add(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.01), { tone: "dark" });
  k.add(new THREE.BoxGeometry(w, h, 0.012), { tone: "paper", position: [0, 0, 0.004] });
  return k.build();
}

/** Seam: a hairline groove drawn as a thin dark strip standing proud. */
function seam(k: Kit, a: V3, b: V3, tone: Tone = "solid"): void {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.BoxGeometry(0.006, 0.012, len);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  k.add(g, { tone });
}

/** Vertical seams on both body sides at z, between y0 and y1. */
function sideSeam(k: Kit, halfW: number, z: number, y0: number, y1: number, tone: Tone = "solid"): void {
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.008, y1 - y0, 0.014);
    k.add(g, { tone, position: [s * (halfW + 0.003), (y0 + y1) / 2, z] });
  }
}

function handle(k: Kit, halfW: number, z: number, y: number): void {
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.03, 0.03, 0.17), { tone: "mid", position: [s * (halfW + 0.012), y, z] });
}

/** A roof light bar with `n` lamps alternating signal red / amber. */
function lightBar(a: Assembly, bone: string, at: V3, width: number, n: number, accents: Array<"signal" | "amber">): number[] {
  const k = a.rig.kit(bone);
  k.add(new THREE.BoxGeometry(width, 0.05, 0.3), { tone: "dark", position: [at[0], at[1] + 0.025, at[2]] });
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.04, 0.05, 0.06), { tone: "mid", position: [at[0] + s * width * 0.4, at[1] - 0.02, at[2]] });
  const ids: number[] = [];
  const cell = width / n;
  for (let i = 0; i < n; i++) {
    const x = at[0] - width / 2 + cell * (i + 0.5);
    const lamp = new THREE.BoxGeometry(cell * 0.86, 0.11, 0.26);
    ids.push(a.lamps.add(lamp, { accent: accents[i % accents.length]!, position: [x, at[1] + 0.105, at[2]], off: "pale", on: "paper" }));
  }
  return ids;
}

/** A dome beacon on a short base. */
function beacon(a: Assembly, bone: string, at: V3, accent: "signal" | "amber", r = 0.09): number {
  const k = a.rig.kit(bone);
  k.add(cylinder(r * 1.1, r * 1.2, 0.05, 12), { tone: "dark", position: [at[0], at[1] + 0.025, at[2]] });
  const dome = new THREE.CylinderGeometry(r * 0.75, r, r * 1.5, 12);
  return a.lamps.add(dome, { accent, position: [at[0], at[1] + 0.05 + r * 0.75, at[2]], off: "pale" });
}

/** Emergency flash pattern: quad-flash alternating between two groups. */
export function emergencyPattern(t: number, groupA: number[], groupB: number[], set: (i: number, v: number) => void, phase = 0): void {
  const cycle = (t * 1.25 + phase) % 1;
  const half = cycle < 0.5 ? 0 : 1;
  const local = (cycle % 0.5) / 0.5;
  const burst = local < 0.6 ? (Math.floor(local * 10) % 2 === 0 ? 1 : 0) : 0;
  for (const i of groupA) set(i, half === 0 ? burst : 0);
  for (const i of groupB) set(i, half === 1 ? burst : 0);
}

// ------------------------------------------------------------- wheels

function mountWheels(
  a: Assembly,
  b: RoadBuild,
  axles: Array<{ z: number; track: number; dual?: boolean }>,
  spec: { r: number; w: number; rim: number; style: WheelStyle; seg?: number },
  sink = 0,
): void {
  const bare = b.condition === "wreck";
  const g = wheelGeometry({ ...spec, bare });
  const gl = flipToLeft(g);
  let dualG: THREE.BufferGeometry | null = null;
  axles.forEach((ax, i) => {
    for (const s of [1, -1]) {
      const name = `wheel${i}${s > 0 ? "R" : "L"}`;
      const y = (bare ? spec.rim : spec.r) - sink;
      if (ax.dual) {
        // Twin tyres: outer wheel faces out, inner wheel sits inboard.
        if (!dualG) {
          const k = new Kit();
          k.add(g, { position: [0, 0, 0] });
          k.add(wheelGeometry({ ...spec, bare, style: spec.style }), { position: [-spec.w * 1.04, 0, 0] });
          dualG = k.build();
        }
        a.wheel(name, "root", [(s * ax.track) / 2, y, ax.z], s > 0 ? dualG : flipToLeft(dualG), spec.r);
      } else a.wheel(name, "root", [(s * ax.track) / 2, y, ax.z], s > 0 ? g : gl, spec.r);
    }
  });
}

// ---------------------------------------------------------------- car

type CarStyle = "sedan" | "hatch" | "estate";

export function buildCar(b: RoadBuild): THREE.Object3D {
  if (b.condition === "pristine") return buildPod(b);
  const style: CarStyle = (["sedan", "hatch", "estate"] as const)[b.seed % 3]!;
  const a = new Assembly("vehicle", "car", b.condition);
  const wreck = b.condition === "wreck";
  const L = style === "hatch" ? 4.3 : 4.72;
  const W = 1.82;
  const hw = W / 2;
  const zF = L / 2,
    zR = -L / 2;
  const R = 0.325;
  const zf = zF - 0.93;
  const zr = zf - (style === "hatch" ? 2.62 : 2.75);
  const sink = wreck ? 0.1 : 0;
  a.rig.bone("body", "root", [0, -sink, 0]);
  const k = new Kit();

  // Lower body: sill with arches, nose, hood, beltline, tail.
  const arches = [
    { z: zr, r: R + 0.055, y: R + 0.005 },
    { z: zf, r: R + 0.055, y: R + 0.005 },
  ];
  const beltF = 0.93,
    beltR = 0.99;
  const zCowl = zF - 1.37;
  const lower: V2[] = [
    ...archedSill(zR + 0.12, zF - 0.12, 0.2, arches),
    [zF - 0.03, 0.26],
    [zF, 0.4],
    [zF - 0.01, 0.58],
    [zF - 0.08, 0.7],
    [zF - 0.22, 0.765],
    [zCowl + 0.4, 0.88],
    [zCowl, beltF],
  ];
  let zBack: number;
  if (style === "sedan") {
    zBack = zR + 0.78;
    lower.push([zBack, beltR], [zR + 0.12, 0.985], [zR + 0.02, 0.93], [zR, 0.72], [zR - 0.01, 0.42], [zR + 0.04, 0.26]);
  } else if (style === "hatch") {
    zBack = zR + 0.16;
    lower.push([zBack, beltR], [zR + 0.02, 0.9], [zR, 0.42], [zR + 0.04, 0.26]);
  } else {
    zBack = zR + 0.12;
    lower.push([zBack, beltR], [zR + 0.02, 0.92], [zR, 0.42], [zR + 0.04, 0.26]);
  }
  k.add(sideExtrude(lower, W, 0.045), { tone: "paper" });

  // Greenhouse.
  const Wg = 1.64;
  const roofY = 1.45;
  const zWs = zCowl - 0.93; // windshield top
  let gh: V2[];
  if (style === "sedan")
    gh = [
      [zCowl + 0.02, beltF - 0.03],
      [zWs, roofY - 0.03],
      [zWs - 0.35, roofY],
      [zWs - 0.9, roofY - 0.005],
      [zBack + 0.58, roofY - 0.045],
      [zBack - 0.04, beltR + 0.02],
      [zBack - 0.04, beltR - 0.04],
    ];
  else if (style === "hatch")
    gh = [
      [zCowl + 0.02, beltF - 0.03],
      [zWs, roofY - 0.03],
      [zWs - 0.35, roofY],
      [zBack + 0.32, roofY - 0.03],
      [zBack - 0.02, roofY - 0.2],
      [zBack - 0.05, beltR - 0.04],
    ];
  else
    gh = [
      [zCowl + 0.02, beltF - 0.03],
      [zWs, roofY - 0.03],
      [zWs - 0.35, roofY],
      [zBack + 0.18, roofY - 0.015],
      [zBack - 0.02, roofY - 0.1],
      [zBack - 0.05, beltR - 0.04],
    ];
  const zB = zWs - 0.28; // B-pillar centre
  const spans: Array<[number, number]> = [[zB + 0.05, zCowl + 0.1]];
  if (style === "sedan") spans.push([zBack + 0.5, zB - 0.05]);
  else if (style === "hatch") spans.push([zBack + 0.36, zB - 0.05]);
  else spans.push([zB - 0.95, zB - 0.05], [zBack + 0.2, zB - 1.03]);
  const holes = wreck ? windowHoles(gh, spans, 0.05) : windowHoles(gh, spans, 0.055);
  glazedShell(k, gh, holes, Wg, { bevel: 0.03, recess: wreck ? 0.2 : 0.03, glass: GLASS });
  const inside: V2 = [(zCowl + zBack) / 2, 1.05];
  // Windshield and backlight.
  const ws0: V2 = [zCowl + 0.02, beltF - 0.01],
    ws1: V2 = [zWs, roofY - 0.03];
  k.add(slab(ws0, ws1, Wg - 0.15, 0.02, 0.004, inside, 0.04), { tone: GLASS });
  const blIdx = style === "hatch" ? 3 : 4;
  const bl0: V2 = gh[blIdx]!;
  const bl1: V2 = gh[blIdx + 1]!;
  k.add(slab(bl0, bl1, Wg - 0.2, 0.02, 0.004, inside, 0.04), { tone: GLASS });
  if (!wreck) {
    // Glints: a pen artist's white slashes across the glass.
    k.add(slab(ws0, ws1, 0.07, 0.012, 0.02, inside, 0.12), { tone: "paper", position: [0.3, 0, 0] });
    k.add(slab(ws0, ws1, 0.035, 0.012, 0.02, inside, 0.16), { tone: "paper", position: [0.42, 0, 0] });
  }

  // Wheel wells and belly in shadow.
  for (const z of [zr, zf]) k.add(new THREE.BoxGeometry(W - 0.52, 0.5, 0.74), { tone: "solid", position: [0, 0.48, z] });
  k.add(new THREE.BoxGeometry(W - 0.34, 0.08, L - 0.6), { tone: "solid", position: [0, 0.2, 0] });

  // Nose: a dark fascia band carries grille and lamps; intake, plate, bumper strip.
  k.add(new THREE.BoxGeometry(W - 0.22, 0.16, 0.03), { tone: "solid", position: [0, 0.56, zF + 0.002], rotation: [-0.08, 0, 0] });
  k.add(louvre(0.62, 0.1, 3, 0.02, "solid", "light"), { position: [0, 0.55, zF + 0.02], rotation: [-0.08, 0, 0] });
  k.add(louvre(0.96, 0.09, 2, 0.03, "solid", "dark"), { position: [0, 0.3, zF - 0.012], rotation: [0.2, 0, 0] });
  sym(k, headlamp(0.3, 0.1), { position: [0.6, 0.575, zF + 0.012], rotation: [-0.08, 0.12, 0] });
  k.add(plate(), { position: [0, 0.41, zF + 0.012] });
  k.add(new THREE.BoxGeometry(W - 0.2, 0.035, 0.03), { tone: "light", position: [0, 0.455, zF + 0.005] });
  // Tail: lamps, plate, bumper.
  const tailY = style === "sedan" ? 0.8 : 0.78;
  k.add(new THREE.BoxGeometry(W - 0.16, 0.11, 0.03), { tone: "dark", position: [0, tailY, zR - 0.005] });
  sym(k, new THREE.BoxGeometry(0.36, 0.13, 0.04), { tone: "solid", position: [0.6, tailY, zR - 0.01] });
  sym(k, new THREE.BoxGeometry(0.08, 0.05, 0.02), { tone: "pale", position: [0.52, tailY, zR - 0.03] });
  k.add(plate(), { position: [0, style === "sedan" ? 0.7 : 0.62, zR - 0.02], rotation: [0, Math.PI, 0] });
  k.add(new THREE.BoxGeometry(W - 0.2, 0.035, 0.03), { tone: "light", position: [0, 0.45, zR - 0.01] });

  // Doors, sills, handles, mirrors, fuel flap, aerial.
  const zD1 = zCowl + 0.08,
    zD2 = zB - 0.02,
    zD3 = style === "estate" ? zB - 1.04 : style === "sedan" ? zBack + 0.45 : zBack + 0.36;
  for (const z of [zD1, zD2, zD3]) sideSeam(k, hw, z, 0.27, beltF - 0.02);
  for (const s of [-1, 1]) seam(k, [s * (hw + 0.003), 0.28, zD3], [s * (hw + 0.003), 0.28, zD1]);
  handle(k, hw, zD2 + 0.12, 0.84);
  handle(k, hw, zD3 + 0.14, 0.86);
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.02, 0.07, L - 1.3), { tone: "solid", position: [s * (hw + 0.004), 0.24, (zF + zR) / 2 - 0.05] });
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.008, 0.012, L - 0.6), { tone: "paper", position: [s * (hw + 0.003), 0.72, 0] });
  const mg = mirrorGeom(0.16, 0.12);
  k.add(mg, { position: [hw - 0.08, 1.0, zCowl - 0.1] });
  k.add(mirrorX(mg), { position: [-(hw - 0.08), 1.0, zCowl - 0.1] });
  k.add(new THREE.BoxGeometry(0.02, 0.12, 0.14), { tone: "light", position: [hw + 0.004, 0.84, zR + 0.62] });
  k.add(new THREE.BoxGeometry(0.06, 0.06, 0.16), { tone: "mid", position: [0, roofY + 0.02, zWs - 1.0] });

  let body = k.build();
  body = coach(body, { halfWidth: hw, tumble: 0.16, belt: beltF, roof: roofY });
  if (wreck) body = jitter(body, 0.03, b.seed);
  a.rig.kit("body").addGeometry(body);

  mountWheels(a, b, [{ z: zr, track: 1.56 }, { z: zf, track: 1.56 }], { r: R, w: 0.215, rim: 0.22, style: "alloy", seg: 18 });
  a.speed = b.speed;
  a.mass = 1;
  return a.finish(bodyMaterial(HATCH.vehicle, OBJECT_ID.vehicle), { width: W, depth: L, height: roofY });
}

/** The pristine world's car: a driverless pod, symmetric, sealed, identical. */
function buildPod(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "car", "pristine");
  a.rig.bone("body", "root", [0, 0, 0]);
  const L = 4.0,
    W = 1.8,
    H = 1.62,
    R = 0.33;
  const k = new Kit();
  const arches = [
    { z: -1.35, r: R + 0.05, y: R },
    { z: 1.35, r: R + 0.05, y: R },
  ];
  const outline: V2[] = [
    ...archedSill(-L / 2 + 0.15, L / 2 - 0.15, 0.22, arches),
    [L / 2 - 0.02, 0.32],
    [L / 2, 0.62],
    [L / 2 - 0.1, 0.9],
    [L / 2 - 0.55, H - 0.04],
    [L / 2 - 0.9, H],
    [-L / 2 + 0.9, H],
    [-L / 2 + 0.55, H - 0.04],
    [-L / 2 + 0.1, 0.9],
    [-L / 2, 0.62],
    [-L / 2 + 0.02, 0.32],
  ];
  k.add(sideExtrude(outline, W, 0.08), { tone: "paper" });
  // A continuous dark glass band wraps the cabin: no pillars, no faces.
  const band: V2[] = [
    [L / 2 - 0.2, 0.96],
    [L / 2 - 0.56, H - 0.16],
    [-L / 2 + 0.56, H - 0.16],
    [-L / 2 + 0.2, 0.96],
  ];
  k.add(sideExtrude(band, W + 0.01, 0.02), { tone: "deep" });
  for (const z of [-1.35, 1.35]) k.add(new THREE.BoxGeometry(W - 0.52, 0.5, 0.72), { tone: "solid", position: [0, 0.48, z] });
  k.add(new THREE.BoxGeometry(W - 0.3, 0.08, L - 0.5), { tone: "solid", position: [0, 0.22, 0] });
  // Light strips fore and aft, a lidar crown.
  for (const z of [L / 2 + 0.005, -L / 2 - 0.005]) k.add(new THREE.BoxGeometry(W - 0.3, 0.035, 0.02), { tone: "solid", position: [0, 0.74, z] });
  k.add(cylinder(0.13, 0.15, 0.09, 16), { tone: "light", position: [0, H + 0.045, 0] });
  k.add(cylinder(0.11, 0.11, 0.06, 16), { tone: "deep", position: [0, H + 0.12, 0] });
  k.add(cylinder(0.12, 0.12, 0.02, 16), { tone: "paper", position: [0, H + 0.16, 0] });
  let body = k.build();
  body = coach(body, { halfWidth: W / 2, tumble: 0.12, belt: 0.95, roof: H });
  a.rig.kit("body").addGeometry(body);
  mountWheels(a, b, [{ z: -1.35, track: 1.56 }, { z: 1.35, track: 1.56 }], { r: R, w: 0.21, rim: 0.24, style: "alloy" });
  a.speed = b.speed;
  return a.finish(bodyMaterial(HATCH.vehicle, OBJECT_ID.vehicle), { width: W, depth: L, height: H });
}

export { mountWheels, lightBar, beacon, headlamp, plate, mirrorGeom, seam, sideSeam, handle };
