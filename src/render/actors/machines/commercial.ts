/**
 * Commercial and emergency road vehicles: van, ambulance, bus, truck and
 * fire engine. Slab-sided coachwork extrusions with real arches, recessed
 * glazing, rubbing strips, and livery drawn in tone rather than colour
 * (Battenburg chequer in ink, a fire engine rendered in mid-tone hatching).
 */
import * as THREE from "three";
import { Kit, cylinder, jitter, type Tone } from "../../core/geometry.ts";
import {
  Decals,
  HATCH,
  OBJECT_ID,
  archedSill,
  bodyMaterial,
  cylX,
  cylZ,
  fitText,
  hazardPlate,
  inkAtlas,
  louvre,
  mirrorX,
  sideExtrude,
  sym,
  type V2,
} from "./common.ts";
import { Assembly } from "./assembly.ts";
import { coach, glazedShell, slab } from "./shaping.ts";
import { GLASS, beacon, emergencyPattern, handle, headlamp, lightBar, mirrorGeom, mountWheels, plate, sideSeam, type RoadBuild } from "./road.ts";

// ---------------------------------------------------------------- helpers

function finishBody(a: Assembly, k: Kit, b: RoadBuild, shape: { halfWidth: number; tumble: number; belt: number; roof: number }, bone = "body"): void {
  let g = k.build();
  if (shape.tumble) g = coach(g, shape);
  if (b.condition === "wreck") g = jitter(g, 0.035, b.seed + 3);
  a.rig.kit(bone).addGeometry(g);
}

/** Black rubber bumper wrapping the nose, with a step and plate. */
function vanBumper(k: Kit, W: number, zF: number, y0: number, h: number): void {
  k.add(new THREE.BoxGeometry(W + 0.02, h, 0.16), { tone: "dark", position: [0, y0 + h / 2, zF - 0.02] });
  k.add(new THREE.BoxGeometry(W - 0.4, 0.04, 0.05), { tone: "deep", position: [0, y0 + h * 0.35, zF + 0.065] });
  k.add(plate(0.52, 0.11), { position: [0, y0 + h * 0.62, zF + 0.065] });
}

/** Chequer band: alternating ink and paper squares on a side (s = ±1). */
function chequer(k: Kit, s: number, x: number, y0: number, z0: number, z1: number, rows: number, cell: number, phase = 0): void {
  const n = Math.floor((z1 - z0) / cell);
  for (let r = 0; r < rows; r++)
    for (let i = 0; i < n; i++) {
      if ((i + r + phase) % 2) continue;
      k.add(new THREE.BoxGeometry(0.006, cell, cell), { tone: "solid", position: [s * x, y0 + cell * (r + 0.5), z0 + cell * (i + 0.5)] });
    }
}

// -------------------------------------------------------------------- van

interface VanFront {
  W: number;
  zF: number;
  roof: number;
  /** z of the B-pillar (rear of the cab doors). */
  zB: number;
}

/** The van's cab side profile from the front sill up over the roof to zBack. */
function vanOutline(v: VanFront, zBack: number, sill: V2[], rearDrop: V2[]): V2[] {
  const { zF, roof } = v;
  return [
    ...sill,
    [zF - 0.05, 0.4],
    [zF, 0.72],
    [zF - 0.05, 0.93],
    [zF - 0.2, 1.1],
    [zF - 0.92, 1.3],
    [zF - 1.64, roof - 0.24],
    [zF - 1.86, roof - 0.02],
    [zF - 2.05, roof],
    [zBack + 0.08, roof],
    ...rearDrop,
  ];
}

function vanCabDetails(k: Kit, v: VanFront, glassInside: V2): void {
  const { W, zF, roof } = v;
  const hw = W / 2;
  // Windshield with glints.
  const w0: V2 = [zF - 0.92, 1.3],
    w1: V2 = [zF - 1.64, roof - 0.24];
  k.add(slab(w0, w1, W - 0.2, 0.02, 0.004, glassInside, 0.04), { tone: GLASS });
  k.add(slab(w0, w1, 0.08, 0.012, 0.022, glassInside, 0.15), { tone: "paper", position: [0.35, 0, 0] });
  k.add(slab(w0, w1, 0.04, 0.012, 0.022, glassInside, 0.2), { tone: "paper", position: [0.5, 0, 0] });
  // Wipers parked at the base.
  for (const x of [-0.45, 0.15]) k.add(new THREE.BoxGeometry(0.62, 0.02, 0.02), { tone: "solid", position: [x, 1.33, zF - 0.97], rotation: [0, 0, 0.08] });
  // Grille, lamps, indicators.
  k.add(new THREE.BoxGeometry(W - 0.5, 0.36, 0.03), { tone: "solid", position: [0, 0.84, zF - 0.01], rotation: [-0.2, 0, 0] });
  k.add(louvre(W - 0.62, 0.28, 3, 0.02, "solid", "light"), { position: [0, 0.84, zF + 0.012], rotation: [-0.2, 0, 0] });
  sym(k, headlamp(0.34, 0.2), { position: [hw - 0.2, 0.93, zF - 0.1], rotation: [-0.35, 0.35, 0] });
  // Door seams, handles, mirrors.
  sideSeam(k, hw, zF - 0.98, 0.52, 1.32);
  sideSeam(k, hw, v.zB, 0.45, roof - 0.12);
  handle(k, hw, v.zB + 0.14, 1.12);
  const mg = mirrorGeom(0.2, 0.3, true);
  k.add(mg, { position: [hw - 0.06, 1.45, zF - 1.0] });
  k.add(mirrorX(mg), { position: [-(hw - 0.06), 1.45, zF - 1.0] });
}

export function buildVan(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "van", b.condition);
  const wreck = b.condition === "wreck";
  const L = 5.53,
    W = 2.05,
    hw = W / 2,
    roof = 2.52,
    R = 0.35;
  const zF = L / 2,
    zR = -L / 2;
  const zf = zF - 0.98,
    zr = zf - 3.3;
  a.rig.bone("body", "root", [0, wreck ? -0.1 : 0, 0]);
  const v: VanFront = { W, zF, roof, zB: zF - 2.42 };
  const k = new Kit();
  const arches = [
    { z: zr, r: R + 0.07, y: R },
    { z: zf, r: R + 0.07, y: R },
  ];
  const outline = vanOutline(v, zR, archedSill(zR + 0.05, zF - 0.1, 0.38, arches), [
    [zR, roof - 0.06],
    [zR, 0.45],
    [zR + 0.04, 0.38],
  ]);
  // Cab door window cut through; glass recessed.
  const win: V2[] = [
    [zF - 1.0, 1.4],
    [zF - 1.56, roof - 0.32],
    [v.zB + 0.06, roof - 0.32],
    [v.zB + 0.06, 1.36],
  ];
  glazedShell(k, outline, [win], W, { recess: 0.03, glass: GLASS });
  const inside: V2 = [0, 1.4];
  vanCabDetails(k, v, inside);
  // Wells, belly, bumpers, rubbing strips, swage lines.
  for (const z of [zr, zf]) k.add(new THREE.BoxGeometry(W - 0.6, 0.6, 0.86), { tone: "solid", position: [0, 0.6, z] });
  k.add(new THREE.BoxGeometry(W - 0.34, 0.1, L - 0.8), { tone: "solid", position: [0, 0.38, 0] });
  vanBumper(k, W, zF, 0.38, 0.3);
  k.add(new THREE.BoxGeometry(W + 0.02, 0.26, 0.14), { tone: "dark", position: [0, 0.52, zR + 0.05] });
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.03, 0.12, L - 1.4), { tone: "solid", position: [s * (hw + 0.012), 0.52, -0.1] });
    // Arch flares.
    for (const z of [zr, zf]) k.add(new THREE.TorusGeometry(R + 0.09, 0.035, 4, 14, Math.PI), { tone: "dark", position: [s * (hw + 0.005), R, z], rotation: [0, Math.PI / 2, 0] });
  }
  // Sliding side door (right), its rail, rear doors.
  sideSeam(k, hw, v.zB - 1.25, 0.46, roof - 0.14);
  k.add(new THREE.BoxGeometry(0.03, 0.05, v.zB - 1.3 - zR - 0.3), { tone: "dark", position: [hw + 0.012, roof - 0.36, (v.zB - 1.3 + zR + 0.3) / 2] });
  k.add(new THREE.BoxGeometry(0.03, 0.03, 0.2), { tone: "mid", position: [hw + 0.014, 1.12, v.zB - 1.12] });
  k.add(new THREE.BoxGeometry(0.02, roof - 0.62, 0.02), { tone: "dark", position: [0, 1.46, zR - 0.006] });
  sym(k, new THREE.BoxGeometry(0.62, 0.52, 0.02), { tone: GLASS, position: [0.45, roof - 0.62, zR - 0.006] });
  sym(k, new THREE.BoxGeometry(0.14, 0.52, 0.04), { tone: "solid", position: [hw - 0.08, 1.2, zR - 0.01] });
  k.add(new THREE.BoxGeometry(0.2, 0.03, 0.03), { tone: "mid", position: [0.18, 1.2, zR - 0.02] });
  finishBody(a, k, b, { halfWidth: hw, tumble: 0.05, belt: 1.35, roof });
  mountWheels(a, b, [{ z: zr, track: 1.74 }, { z: zf, track: 1.74 }], { r: R, w: 0.215, rim: 0.2, style: "steel" });
  a.speed = b.speed;
  a.mass = 1.3;
  return a.finish(bodyMaterial(HATCH.vehicle, OBJECT_ID.vehicle), { width: W, depth: L, height: roof });
}

// -------------------------------------------------------------- ambulance

export function buildAmbulance(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "ambulance", b.condition);
  const wreck = b.condition === "wreck";
  const L = 6.7,
    W = 2.05,
    hw = W / 2,
    cabRoof = 2.5,
    R = 0.36;
  const zF = L / 2,
    zR = -L / 2;
  const zf = zF - 0.98,
    zr = zf - 3.75;
  const boxW = 2.32,
    bhw = boxW / 2,
    boxTop = 2.98,
    boxFront = zF - 2.5,
    boxBottom = 0.66;
  a.rig.bone("body", "root", [0, wreck ? -0.1 : 0, 0]);
  const v: VanFront = { W, zF, roof: cabRoof, zB: zF - 2.42 };
  const k = new Kit();
  // Cab (van front) ending behind the doors.
  const cab = vanOutline(v, boxFront - 0.1, archedSill(boxFront - 0.1, zF - 0.1, 0.38, [{ z: zf, r: R + 0.07, y: R }]), [
    [boxFront - 0.1, 0.4],
  ]);
  const win: V2[] = [
    [zF - 1.0, 1.4],
    [zF - 1.56, cabRoof - 0.32],
    [v.zB + 0.06, cabRoof - 0.32],
    [v.zB + 0.06, 1.36],
  ];
  glazedShell(k, cab, [win], W, { recess: 0.03, glass: GLASS });
  vanCabDetails(k, v, [0, 1.4]);
  vanBumper(k, W, zF, 0.38, 0.3);
  k.add(new THREE.BoxGeometry(W - 0.6, 0.6, 0.86), { tone: "solid", position: [0, 0.6, zf] });
  // The patient module: a box with a rounded top edge and a rear arch.
  const box: V2[] = [
    ...archedSill(zR, boxFront, boxBottom, [{ z: zr, r: R + 0.1, y: R }]),
    [boxFront, boxTop - 0.08],
    [boxFront - 0.08, boxTop],
    [zR + 0.08, boxTop],
    [zR, boxTop - 0.08],
  ];
  k.add(sideExtrude(box, boxW, 0.05), { tone: "paper" });
  k.add(new THREE.BoxGeometry(boxW - 0.6, 0.66, 0.96), { tone: "solid", position: [0, 0.62, zr] });
  k.add(new THREE.BoxGeometry(boxW - 0.4, 0.2, boxFront - zR - 0.4), { tone: "solid", position: [0, 0.52, (boxFront + zR) / 2] });
  k.add(new THREE.BoxGeometry(W - 0.4, 0.14, 3.4), { tone: "dark", position: [0, 0.46, zF - 2.4] });
  // Ink chequer (Battenburg) along both sides and across the cab doors.
  const cell = 0.3;
  for (const s of [-1, 1]) {
    chequer(k, s, bhw + 0.004, 1.02, zR + 0.1, boxFront - 0.05, 2, cell);
    chequer(k, s, hw + 0.004, 0.9, v.zB + 0.02, zF - 1.02, 1, cell * 0.8);
    k.add(new THREE.BoxGeometry(0.008, 0.035, boxFront - zR - 0.1), { tone: "solid", position: [s * (bhw + 0.004), 1.02 + cell * 2 + 0.06, (boxFront + zR) / 2] });
    k.add(new THREE.BoxGeometry(0.008, 0.035, boxFront - zR - 0.1), { tone: "solid", position: [s * (bhw + 0.004), 0.96, (boxFront + zR) / 2] });
  }
  // Rear chequer and chevron panel.
  k.add(hazardPlate(boxW - 0.3, 0.36, 8, null), { position: [0, 0.86, zR - 0.01], rotation: [0, Math.PI, 0] });
  // Side door (right), its window; rear doors with windows, step, handles.
  sideSeam(k, bhw, boxFront - 0.2, boxBottom + 0.05, boxTop - 0.2);
  sideSeam(k, bhw, boxFront - 1.18, boxBottom + 0.05, boxTop - 0.2);
  k.add(new THREE.BoxGeometry(0.02, 0.5, 0.6), { tone: GLASS, position: [bhw + 0.008, 2.12, boxFront - 0.69] });
  k.add(new THREE.BoxGeometry(0.02, 0.5, 0.9), { tone: GLASS, position: [-(bhw + 0.008), 2.12, boxFront - 0.9] });
  k.add(new THREE.BoxGeometry(0.03, 0.03, 0.22), { tone: "mid", position: [bhw + 0.015, 1.5, boxFront - 1.0] });
  k.add(new THREE.BoxGeometry(0.012, boxTop - boxBottom - 0.3, 0.012), { tone: "dark", position: [0, (boxTop + boxBottom) / 2, zR - 0.003] });
  sym(k, new THREE.BoxGeometry(0.66, 0.46, 0.02), { tone: GLASS, position: [0.48, 2.2, zR - 0.006] });
  k.add(new THREE.BoxGeometry(boxW - 0.3, 0.06, 0.34), { tone: "mid", position: [0, 0.48, zR - 0.14] });
  for (const x of [-0.12, 0.12]) k.add(new THREE.BoxGeometry(0.16, 0.03, 0.03), { tone: "mid", position: [x, 1.55, zR - 0.02] });
  // Grab rails, roof air-con, scene lights.
  sym(k, cylinder(0.02, 0.02, 1.1, 6), { tone: "light", position: [0.95, 1.7, zR - 0.04] });
  k.add(new THREE.BoxGeometry(0.9, 0.2, 0.8), { tone: "pale", position: [0, boxTop + 0.1, zR + 1.4] });
  k.add(louvre(0.7, 0.14, 4, 0.02), { position: [0, boxTop + 0.1, zR + 0.99] });
  for (const s of [-1, 1]) for (const z of [boxFront - 0.5, zR + 0.5]) k.add(new THREE.BoxGeometry(0.03, 0.12, 0.3), { tone: "pale", position: [s * (bhw + 0.012), boxTop - 0.16, z] });
  finishBody(a, k, b, { halfWidth: bhw, tumble: 0.03, belt: 1.35, roof: boxTop });

  // Beacons: a cab light bar and four corner beacons on the box.
  const groupA: number[] = [],
    groupB: number[] = [];
  if (!wreck) {
    const bar = lightBar(a, "body", [0, cabRoof, zF - 2.0], 1.5, 6, ["signal", "amber"]);
    bar.forEach((id, i) => (i < 3 ? groupA : groupB).push(id));
    for (const [x, z, s] of [
      [bhw - 0.12, boxFront - 0.12, 0],
      [-(bhw - 0.12), boxFront - 0.12, 1],
      [bhw - 0.12, zR + 0.12, 1],
      [-(bhw - 0.12), zR + 0.12, 0],
    ] as const)
      (s ? groupB : groupA).push(beacon(a, "body", [x, boxTop, z], s ? "amber" : "signal", 0.1));
    // Grille flashers.
    for (const x of [-0.3, 0.3]) (x < 0 ? groupA : groupB).push(a.lamps.add(new THREE.BoxGeometry(0.12, 0.05, 0.03), { accent: "signal", position: [x, 0.64, zF + 0.01], off: "mid" }));
  }
  // Lettering: mirrored across the box front, plain along the sides.
  const tex = inkAtlas("machines:ambulance", 1024, 160, (g) => {
    fitText(g, "AMBULANCE", 12, 12, 1000, 136, { weight: 800, condense: 0.9 });
  });
  const d = new Decals(1024, 160);
  d.add([0, 0, 1024, 160], [1.7, 0.24], { position: [0, cabRoof + 0.31, boxFront + 0.006] }, true);
  d.add([0, 0, 1024, 160], [2.1, 0.34], { position: [bhw + 0.006, 1.98, zR + 1.35], rotation: [0, Math.PI / 2, 0] });
  d.add([0, 0, 1024, 160], [2.1, 0.34], { position: [-(bhw + 0.006), 1.98, zR + 1.45], rotation: [0, -Math.PI / 2, 0] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.vehicle, objectId: OBJECT_ID.vehicle, bone: "body" };

  mountWheels(a, b, [{ z: zr, track: 1.76 }, { z: zf, track: 1.74 }], { r: R, w: 0.225, rim: 0.2, style: "steel" });
  a.speed = b.speed;
  a.mass = 1.5;
  const phase = (b.seed % 7) * 0.13;
  a.onTick((_dt, t) => {
    if (wreck) return;
    emergencyPattern(t, groupA, groupB, (i, v) => a.lamps.set(i, v), phase);
  });
  return a.finish(bodyMaterial(HATCH.vehicle, OBJECT_ID.vehicle), { width: boxW, depth: L, height: boxTop + 0.2 });
}

// -------------------------------------------------------------------- bus

export function buildBus(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "bus", b.condition);
  const wreck = b.condition === "wreck";
  const L = 12.0,
    W = 2.55,
    hw = W / 2,
    roof = 3.05,
    R = 0.5;
  const zF = L / 2,
    zR = -L / 2;
  const zf = zF - 2.7,
    zr = zf - 5.9;
  a.rig.bone("body", "root", [0, wreck ? -0.15 : 0, 0]);
  const k = new Kit();
  const arches = [
    { z: zr, r: R + 0.07, y: R },
    { z: zf, r: R + 0.07, y: R },
  ];
  const outline: V2[] = [
    ...archedSill(zR + 0.15, zF - 0.15, 0.34, arches),
    [zF - 0.04, 0.4],
    [zF, 0.62],
    [zF + 0.02, 1.0],
    [zF - 0.04, 2.86],
    [zF - 0.2, roof - 0.01],
    [zF - 0.45, roof],
    [zR + 0.35, roof],
    [zR + 0.08, roof - 0.08],
    [zR, 2.8],
    [zR, 0.5],
    [zR + 0.06, 0.34],
  ];
  // Window bays down both sides between the front door and the rear.
  const holes: V2[][] = [];
  const wy0 = 1.28,
    wy1 = 2.72;
  const bayStart = zF - 1.72,
    bayEnd = zR + 0.55;
  const bays = 7;
  const pitch = (bayStart - bayEnd) / bays;
  for (let i = 0; i < bays; i++) {
    const z1 = bayStart - i * pitch - 0.06,
      z0 = bayStart - (i + 1) * pitch + 0.06;
    holes.push([
      [z0, wy0],
      [z1, wy0],
      [z1, wy1],
      [z0, wy1],
    ]);
  }
  glazedShell(k, outline, holes, W, { recess: 0.04, glass: GLASS });
  // Glints on a few panes.
  for (let i = 0; i < bays; i += 2)
    for (const s of [-1, 1]) {
      const zc = bayStart - (i + 0.5) * pitch;
      k.add(new THREE.BoxGeometry(0.01, 0.9, 0.05), { tone: "paper", position: [s * (hw - 0.03), 2.0, zc], rotation: [0.55 * s, 0, 0] });
    }
  const inside: V2 = [0, 1.6];
  // Windscreen (near vertical) with the destination blind above it.
  const ws0: V2 = [zF + 0.02, 1.05],
    ws1: V2 = [zF - 0.03, 2.5];
  k.add(slab(ws0, ws1, W - 0.16, 0.02, 0.004, inside, 0), { tone: GLASS });
  k.add(slab(ws0, ws1, 0.1, 0.012, 0.022, inside, 0.2), { tone: "paper", position: [0.5, 0, 0], rotation: [0, 0, 0] });
  k.add(slab(ws0, ws1, 0.05, 0.012, 0.022, inside, 0.3), { tone: "paper", position: [0.68, 0, 0] });
  k.add(slab([zF - 0.035, 2.54], [zF - 0.045, 2.84], W - 0.3, 0.03, 0.004, inside, 0), { tone: "solid" });
  // Front door (right side): two glazed leaves to the kerb.
  for (const zc of [zF - 0.62, zF - 1.18]) k.add(new THREE.BoxGeometry(0.02, 2.3, 0.54), { tone: GLASS, position: [hw + 0.01, 1.55, zc] });
  k.add(new THREE.BoxGeometry(0.03, 2.4, 0.05), { tone: "mid", position: [hw + 0.02, 1.55, zF - 0.9] });
  // Centre door (right side).
  for (const zc of [0.6, 0.06]) k.add(new THREE.BoxGeometry(0.02, 2.3, 0.52), { tone: GLASS, position: [hw + 0.01, 1.55, zc] });
  k.add(new THREE.BoxGeometry(0.03, 2.4, 0.05), { tone: "mid", position: [hw + 0.02, 1.55, 0.33] });
  // Wells, skirt, bumpers.
  for (const z of [zr, zf]) k.add(new THREE.BoxGeometry(W - 0.75, 0.8, 1.16), { tone: "solid", position: [0, 0.7, z] });
  k.add(new THREE.BoxGeometry(W - 0.3, 0.12, L - 1.0), { tone: "solid", position: [0, 0.34, 0] });
  k.add(new THREE.BoxGeometry(W + 0.02, 0.32, 0.12), { tone: "dark", position: [0, 0.52, zF + 0.02] });
  k.add(new THREE.BoxGeometry(W + 0.02, 0.32, 0.12), { tone: "dark", position: [0, 0.52, zR - 0.02] });
  k.add(plate(0.52, 0.11), { position: [0, 0.54, zF + 0.085] });
  sym(k, headlamp(0.3, 0.14), { position: [hw - 0.3, 0.84, zF + 0.012] });
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.02, 0.07, L - 1.6), { tone: "solid", position: [s * (hw + 0.008), 1.0, -0.4] });
    k.add(new THREE.BoxGeometry(0.012, 0.035, L - 0.8), { tone: "solid", position: [s * (hw + 0.006), wy0 - 0.08, 0] });
  }
  // Rear: engine louvre, rear window, lamps.
  k.add(louvre(W - 0.5, 0.7, 6, 0.03), { position: [0, 1.0, zR - 0.02], rotation: [0, Math.PI, 0] });
  k.add(new THREE.BoxGeometry(W - 0.5, 0.6, 0.02), { tone: GLASS, position: [0, 2.3, zR - 0.006] });
  sym(k, new THREE.BoxGeometry(0.18, 0.5, 0.04), { tone: "solid", position: [hw - 0.14, 1.2, zR - 0.02] });
  // Roof pods: air-con and battery housings.
  k.add(new THREE.BoxGeometry(1.7, 0.26, 2.4), { tone: "pale", position: [0, roof + 0.13, zF - 3.2] });
  k.add(louvre(1.4, 0.18, 4, 0.02), { position: [0, roof + 0.13, zF - 1.99] });
  k.add(new THREE.BoxGeometry(1.9, 0.2, 3.2), { tone: "paper", position: [0, roof + 0.1, zR + 2.6] });
  // Rabbit-ear mirrors ahead of the screen.
  for (const s of [-1, 1]) {
    k.add(new THREE.TorusGeometry(0.3, 0.018, 4, 10, Math.PI / 2), { tone: "dark", position: [s * (hw - 0.02), 2.55, zF - 0.02], rotation: [0, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? 0 : 0] });
    k.add(new THREE.BoxGeometry(0.2, 0.36, 0.06), { tone: "paper", position: [s * (hw + 0.15), 2.32, zF + 0.28] });
    k.add(new THREE.BoxGeometry(0.17, 0.32, 0.01), { tone: "solid", position: [s * (hw + 0.15), 2.32, zF + 0.245] });
  }
  finishBody(a, k, b, { halfWidth: hw, tumble: 0.02, belt: 1.3, roof });

  const tex = inkAtlas("machines:bus", 1024, 128, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 1024, 128);
    fitText(g, "14", 24, 14, 150, 100, { color: "#fff", weight: 800 });
    fitText(g, "MERIDIAN CROSS", 200, 22, 800, 84, { color: "#fff", weight: 700, align: "left", condense: 0.86 });
  });
  const d = new Decals(1024, 128);
  d.add([0, 0, 1024, 128], [W - 0.4, 0.26], { position: [0, 2.69, zF - 0.01], rotation: [-0.03, 0, 0] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.vehicle, objectId: OBJECT_ID.vehicle, bone: "body" };
  mountWheels(a, b, [{ z: zr, track: 1.86, dual: true }, { z: zf, track: 2.08 }], { r: R, w: 0.28, rim: 0.3, style: "truck", seg: 14 });
  a.speed = b.speed;
  a.mass = 3;
  return a.finish(bodyMaterial(HATCH.heavy, OBJECT_ID.vehicle), { width: W, depth: L, height: roof + 0.26 });
}

// ------------------------------------------------------------------ truck

/** A cab-over cab: flat face, deep windscreen, steps, from zF back to zBack. */
function cabOver(k: Kit, W: number, zF: number, zBack: number, roof: number, R: number, zf: number, opts: { crew?: boolean; tone?: Tone } = {}): void {
  const hw = W / 2;
  const tone = opts.tone ?? "paper";
  const outline: V2[] = [
    ...archedSill(zBack, zF - 0.1, 0.62, [{ z: zf, r: R + 0.08, y: R }]),
    [zF - 0.02, 0.66],
    [zF + 0.02, 1.3],
    [zF, 1.62],
    [zF - 0.14, roof - 0.35],
    [zF - 0.34, roof],
    [zBack + 0.05, roof],
    [zBack, roof - 0.05],
  ];
  const doorZ1 = zF - 0.36,
    doorZ0 = zF - 1.3;
  const holes: V2[][] = [
    [
      [doorZ0 + 0.05, 1.72],
      [doorZ1 - 0.05, 1.72],
      [doorZ1 - 0.05, roof - 0.42],
      [doorZ0 + 0.05, roof - 0.42],
    ],
  ];
  if (opts.crew)
    holes.push([
      [zBack + 0.2, 1.72],
      [doorZ0 - 0.1, 1.72],
      [doorZ0 - 0.1, roof - 0.42],
      [zBack + 0.2, roof - 0.42],
    ]);
  glazedShell(k, outline, holes, W, { recess: 0.03, glass: GLASS, shell: tone });
  const inside: V2 = [(zF + zBack) / 2, 1.8];
  const w0: V2 = [zF, 1.66],
    w1: V2 = [zF - 0.13, roof - 0.4];
  k.add(slab(w0, w1, W - 0.18, 0.02, 0.004, inside, 0.02), { tone: GLASS });
  k.add(slab(w0, w1, 0.09, 0.012, 0.022, inside, 0.12), { tone: "paper", position: [0.4, 0, 0] });
  k.add(slab(w0, w1, 0.045, 0.012, 0.022, inside, 0.18), { tone: "paper", position: [0.56, 0, 0] });
  k.add(new THREE.BoxGeometry(W - 0.2, 0.06, 0.16), { tone: "dark", position: [0, roof - 0.3, zF + 0.02] });
  // Grille and lamps on the flat face.
  k.add(louvre(W - 0.7, 0.5, 5, 0.03, "solid", "light"), { position: [0, 1.12, zF + 0.035] });
  sym(k, headlamp(0.36, 0.18), { position: [hw - 0.3, 0.84, zF + 0.01] });
  k.add(new THREE.BoxGeometry(W + 0.02, 0.26, 0.2), { tone: "dark", position: [0, 0.62, zF - 0.02] });
  k.add(plate(0.52, 0.11), { position: [0, 0.62, zF + 0.085] });
  // Doors, steps, handles, grab rails, mirrors.
  sideSeam(k, hw, doorZ1, 0.7, roof - 0.3);
  sideSeam(k, hw, doorZ0, 0.7, roof - 0.3);
  if (opts.crew) sideSeam(k, hw, zBack + 0.1, 0.7, roof - 0.3);
  handle(k, hw, doorZ0 + 0.15, 1.55);
  for (const s of [-1, 1]) {
    for (const y of [0.42, 0.78]) k.add(new THREE.BoxGeometry(0.28, 0.035, 0.4), { tone: "mid", position: [s * (hw - 0.1), y, doorZ0 + 0.35] });
    k.add(cylinder(0.018, 0.018, 0.9, 6), { tone: "light", position: [s * (hw + 0.03), 1.5, doorZ0 + 0.05] });
  }
  const mg = mirrorGeom(0.28, 0.4, true);
  k.add(mg, { position: [hw - 0.04, 2.0, zF - 0.3] });
  k.add(mirrorX(mg), { position: [-(hw - 0.04), 2.0, zF - 0.3] });
}

export function buildTruck(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "truck", b.condition);
  const wreck = b.condition === "wreck";
  const L = 8.6,
    W = 2.5,
    hw = W / 2,
    R = 0.5;
  const zF = L / 2,
    zR = -L / 2;
  const zf = zF - 1.3,
    zr = zf - 4.9;
  const cabBack = zF - 2.1,
    cabRoof = 2.98;
  a.rig.bone("body", "root", [0, wreck ? -0.15 : 0, 0]);
  const k = new Kit();
  cabOver(k, W, zF, cabBack, cabRoof, R, zf);
  // Chassis rails, crossmembers, tanks, guards.
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.1, 0.28, L - 0.8), { tone: "deep", position: [s * 0.44, 0.92, -0.2] });
  k.add(cylZ(0.28, 1.2, 12), { tone: "pale", position: [hw - 0.42, 0.9, zf - 1.6] });
  for (const z of [zf - 1.15, zf - 2.05]) k.add(new THREE.BoxGeometry(0.05, 0.08, 0.05), { tone: "dark", position: [hw - 0.2, 1.16, z] });
  k.add(new THREE.BoxGeometry(0.5, 0.4, 0.7), { tone: "dark", position: [-(hw - 0.42), 0.95, zf - 1.7] });
  for (const s of [-1, 1]) for (const y of [0.52, 0.82]) k.add(new THREE.BoxGeometry(0.04, 0.08, zf - zr - 1.9 - 1.3), { tone: "paper", position: [s * (hw - 0.06), y, (zf + zr) / 2 - 0.35] });
  k.add(new THREE.BoxGeometry(0.4, 0.4, 0.5), { tone: "pale", position: [-(hw - 0.35), cabRoof - 0.6, cabBack - 0.3] });
  k.add(cylinder(0.07, 0.07, 1.2, 8), { tone: "mid", position: [-(hw - 0.2), cabRoof - 0.3, cabBack - 0.35] });
  // Box body with external posts, rails and a roller shutter.
  const boxFront = cabBack - 0.12,
    boxBottom = 1.12,
    boxTop = 3.7;
  const boxLen = boxFront - zR;
  k.add(new THREE.BoxGeometry(W, boxTop - boxBottom, boxLen), { tone: "paper", position: [0, (boxTop + boxBottom) / 2, (boxFront + zR) / 2] });
  for (const y of [boxBottom + 0.06, boxTop - 0.06]) k.add(new THREE.BoxGeometry(W + 0.1, 0.14, boxLen + 0.02), { tone: "paper", position: [0, y, (boxFront + zR) / 2] });
  // Panel joints: a few bold ink lines, corner posts at the ends.
  const joints = Math.round(boxLen / 1.6);
  for (let i = 1; i < joints; i++) {
    const z = zR + (boxLen * i) / joints;
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.01, boxTop - boxBottom - 0.26, 0.045), { tone: "solid", position: [s * (hw + 0.004), (boxTop + boxBottom) / 2, z] });
  }
  for (const z of [zR + 0.06, boxFront - 0.06]) for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.1, boxTop - boxBottom, 0.12), { tone: "pale", position: [s * (hw - 0.03), (boxTop + boxBottom) / 2, z] });
  // Roller shutter: a few bold slat lines and a bottom rail.
  const slats = 7;
  for (let i = 0; i < slats; i++) {
    const y = boxBottom + 0.2 + ((boxTop - boxBottom - 0.4) * (i + 0.5)) / slats;
    k.add(new THREE.BoxGeometry(W - 0.24, 0.03, 0.02), { tone: "mid", position: [0, y, zR - 0.01] });
  }
  k.add(new THREE.BoxGeometry(0.3, 0.05, 0.05), { tone: "dark", position: [0, boxBottom + 0.2, zR - 0.03] });
  // Rear underrun bar, mudguards over the duals, tail lamps.
  k.add(new THREE.BoxGeometry(W - 0.2, 0.14, 0.12), { tone: "dark", position: [0, 0.55, zR + 0.1] });
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.7, 0.04, 1.3), { tone: "dark", position: [s * (hw - 0.37), 1.1, zr] });
    k.add(new THREE.BoxGeometry(0.2, 0.14, 0.05), { tone: "solid", position: [s * (hw - 0.25), 0.7, zR + 0.05] });
  }
  for (const z of [zr, zf]) k.add(new THREE.BoxGeometry(W - 1.0, 0.9, 1.2), { tone: "solid", position: [0, 0.8, z] });
  finishBody(a, k, b, { halfWidth: hw, tumble: 0, belt: 1, roof: boxTop });
  mountWheels(a, b, [{ z: zr, track: 1.82, dual: true }, { z: zf, track: 2.04 }], { r: R, w: 0.3, rim: 0.3, style: "truck", seg: 14 });
  a.speed = b.speed;
  a.mass = 4;
  return a.finish(bodyMaterial(HATCH.heavy, OBJECT_ID.vehicle), { width: W, depth: L, height: boxTop });
}

// ------------------------------------------------------------ fire engine

export function buildFireEngine(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "fire-engine", b.condition);
  const wreck = b.condition === "wreck";
  const L = 8.3,
    W = 2.5,
    hw = W / 2,
    R = 0.5;
  const zF = L / 2,
    zR = -L / 2;
  const zf = zF - 1.25,
    zr = zf - 4.0;
  const cabBack = zF - 2.5,
    cabRoof = 2.92;
  // Fire-engine red translated to a mid-tone hatch.
  const red: Tone = 0.36;
  a.rig.bone("body", "root", [0, wreck ? -0.15 : 0, 0]);
  const k = new Kit();
  cabOver(k, W, zF, cabBack, cabRoof, R, zf, { crew: true, tone: red });
  // Body: lockers with roller shutters, over a rear arch.
  const bodyTop = 2.86,
    bodyBottom = 0.6;
  const body: V2[] = [
    ...archedSill(zR, cabBack - 0.08, bodyBottom, [{ z: zr, r: R + 0.12, y: R }]),
    [cabBack - 0.08, bodyTop],
    [zR, bodyTop],
  ];
  k.add(sideExtrude(body, W, 0.03), { tone: red });
  // Roller-shutter lockers: aluminium panels with slat lines.
  const lockers: Array<[number, number, number, number]> = [
    [cabBack - 0.2, zr + 0.75, bodyBottom + 0.1, bodyTop - 0.12],
    [zr + 0.62, zr - 0.62, R * 2 + 0.2, bodyTop - 0.12],
    [zr - 0.75, zR + 0.15, bodyBottom + 0.1, bodyTop - 0.12],
  ];
  for (const s of [-1, 1])
    for (const [z0, z1, y0, y1] of lockers) {
      const zc = (z0 + z1) / 2,
        len = Math.abs(z0 - z1),
        h = y1 - y0;
      k.add(new THREE.BoxGeometry(0.012, h, len), { tone: "pale", position: [s * (hw + 0.006), (y0 + y1) / 2, zc] });
      const n = Math.max(3, Math.floor(h / 0.36));
      for (let i = 1; i < n; i++) k.add(new THREE.BoxGeometry(0.012, 0.05, len - 0.04), { tone: "solid", position: [s * (hw + 0.012), y0 + (h * i) / n, zc] });
      k.add(new THREE.BoxGeometry(0.03, 0.05, len * 0.5), { tone: "dark", position: [s * (hw + 0.02), y0 + 0.08, zc] });
    }
  // Rear pump bay: panel, gauges, outlets, step, chevrons.
  k.add(new THREE.BoxGeometry(W - 0.3, 1.2, 0.02), { tone: "pale", position: [0, 1.7, zR - 0.01] });
  for (const x of [-0.5, 0, 0.5]) {
    k.add(cylZ(0.07, 0.03, 12), { tone: "paper", position: [x, 2.05, zR - 0.03] });
    k.add(cylZ(0.055, 0.035, 12), { tone: "light", position: [x, 2.05, zR - 0.035] });
  }
  for (const x of [-0.7, 0.7]) k.add(cylZ(0.06, 0.18, 10), { tone: "dark", position: [x, 1.35, zR - 0.1] });
  k.add(new THREE.BoxGeometry(W - 0.2, 0.06, 0.4), { tone: "light", position: [0, 0.55, zR - 0.18] });
  k.add(hazardPlate(W - 0.3, 0.4, 9, "amber"), { position: [0, 0.95, zR - 0.012], rotation: [0, Math.PI, 0] });
  // Roof: ladder gantry, triple-extension ladder, hose reels.
  const ladderLen = 5.2;
  const lz = zR + ladderLen / 2 + 0.3;
  for (const z of [lz - 1.8, lz + 1.8]) k.add(new THREE.BoxGeometry(1.2, 0.18, 0.12), { tone: "dark", position: [0, bodyTop + 0.09, z] });
  for (let tier = 0; tier < 3; tier++) {
    const wLad = 0.56 - tier * 0.06,
      y = bodyTop + 0.2 + tier * 0.07,
      len = ladderLen - tier * 0.4;
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.045, 0.1, len), { tone: tier % 2 ? "pale" : "paper", position: [(s * wLad) / 2, y, lz] });
    if (tier === 0) for (let r = 0; r < 14; r++) k.add(new THREE.BoxGeometry(wLad, 0.035, 0.035), { tone: "light", position: [0, y, lz - len / 2 + 0.2 + (r * (len - 0.4)) / 13] });
  }
  for (const s of [-1, 1]) {
    k.add(cylX(0.34, 0.36, 12), { tone: "mid", position: [s * (hw - 0.3), bodyTop + 0.36, zR + 0.55] });
    k.add(cylX(0.38, 0.02, 12), { tone: "light", position: [s * (hw - 0.1), bodyTop + 0.36, zR + 0.55] });
    k.add(cylX(0.38, 0.02, 12), { tone: "light", position: [s * (hw - 0.5), bodyTop + 0.36, zR + 0.55] });
  }
  // Coachline and bumper, wells.
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.01, 0.06, L - 0.3), { tone: "paper", position: [s * (hw + 0.012), 1.62, 0] });
  for (const z of [zr, zf]) k.add(new THREE.BoxGeometry(W - 1.0, 0.9, 1.2), { tone: "solid", position: [0, 0.8, z] });
  k.add(new THREE.BoxGeometry(W - 0.4, 0.2, L - 1.2), { tone: "solid", position: [0, 0.6, -0.3] });
  finishBody(a, k, b, { halfWidth: hw, tumble: 0, belt: 1, roof: bodyTop });

  const groupA: number[] = [],
    groupB: number[] = [];
  if (!wreck) {
    const front = lightBar(a, "body", [0, cabRoof, zF - 0.45], 1.9, 8, ["signal", "amber"]);
    front.forEach((id, i) => (i < 4 ? groupA : groupB).push(id));
    for (const s of [-1, 1]) (s > 0 ? groupB : groupA).push(beacon(a, "body", [s * (hw - 0.15), bodyTop, zR + 0.15], s > 0 ? "amber" : "signal", 0.1));
    for (const x of [-0.45, 0.45]) (x < 0 ? groupA : groupB).push(a.lamps.add(new THREE.BoxGeometry(0.14, 0.06, 0.03), { accent: "signal", position: [x, 0.9, zF + 0.04], off: "mid" }));
  }
  const tex = inkAtlas("machines:fire", 1024, 320, (g) => {
    fitText(g, "FIRE RESCUE", 12, 12, 1000, 136, { weight: 800, condense: 0.92 });
    fitText(g, "FIRE", 12, 172, 1000, 136, { weight: 800 });
  });
  const d = new Decals(1024, 320);
  d.add([0, 0, 1024, 160], [1.8, 0.24], { position: [0, cabRoof - 0.2, zF + 0.012] });
  d.add([0, 160, 1024, 160], [1.2, 0.3], { position: [hw + 0.01, 1.3, cabBack + 0.62], rotation: [0, Math.PI / 2, 0] });
  d.add([0, 160, 1024, 160], [1.2, 0.3], { position: [-(hw + 0.01), 1.3, cabBack + 0.62], rotation: [0, -Math.PI / 2, 0] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.vehicle, objectId: OBJECT_ID.vehicle, bone: "body" };
  mountWheels(a, b, [{ z: zr, track: 1.82, dual: true }, { z: zf, track: 2.04 }], { r: R, w: 0.3, rim: 0.3, style: "truck", seg: 14 });
  a.speed = b.speed;
  a.mass = 4;
  const phase = (b.seed % 5) * 0.21;
  a.onTick((_dt, t) => {
    if (wreck) return;
    emergencyPattern(t * 1.1, groupA, groupB, (i, v) => a.lamps.set(i, v), phase);
  });
  return a.finish(bodyMaterial(HATCH.heavy, OBJECT_ID.vehicle), { width: W, depth: L, height: bodyTop + 0.5 });
}

export { chequer, cabOver, finishBody };
