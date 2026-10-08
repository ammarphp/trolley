/**
 * The pastoral fleet: a utility farm tractor with a four-post glass cab, and
 * a roadster bicycle standing on its kickstand.
 *
 *   tractor  4.40 x 2.35 x 2.85, rear tyres 1.64 m, front 1.10 m, wheelbase 2.50
 *   bicycle  1.80 x 0.60 x 1.05, 700c wheels, wheelbase 1.08
 */
import * as THREE from "three";
import { Kit, cylinder, sphere, type Tone } from "../../core/geometry.ts";
import { createInkLineMaterial, inkMaterial } from "../../core/ink-material.ts";
import { HATCH, OBJECT_ID, bar, bodyMaterial, cylX, cylZ, flipToLeft, loft, louvre, pipe, sideExtrude, sym, wheelGeometry, arc, type V3 } from "./common.ts";
import { Assembly } from "./assembly.ts";
import { headlamp, type RoadBuild } from "./road.ts";

// ---------------------------------------------------------------- tractor

/** A mudguard: an arc band in side view, extruded across the tyre. */
function mudguard(r0: number, r1: number, a0: number, a1: number, width: number): THREE.BufferGeometry {
  const outer = arc(0, 0, r1, a0, a1, 12);
  const inner = arc(0, 0, r0, a1, a0, 12);
  return sideExtrude([...outer, ...inner], width, 0);
}

export function buildTractor(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "tractor", b.condition);
  const wreck = b.condition === "wreck";
  const Rr = 0.82,
    Rf = 0.55;
  const zr = -1.1,
    zf = 1.4;
  const trackR = 1.78,
    trackF = 1.72;
  const cabY = 1.28,
    roofY = 2.78;
  const paint: Tone = "pale";
  a.rig.bone("body", "root", [0, wreck ? -0.2 : 0, 0]);
  const k = new Kit();
  // Engine block and transmission housing (the tractor's spine), front axle.
  k.add(new THREE.BoxGeometry(0.62, 0.6, 2.3), { tone: "mid", position: [0, 0.86, 0.75] });
  k.add(new THREE.BoxGeometry(0.9, 0.7, 1.2), { tone: "mid", position: [0, 0.95, zr + 0.2] });
  k.add(cylX(0.24, trackR - 0.5, 12), { tone: "dark", position: [0, Rr, zr] });
  k.add(new THREE.BoxGeometry(trackF - 0.3, 0.16, 0.2), { tone: "dark", position: [0, Rf, zf] });
  k.add(cylZ(0.12, 0.3, 8), { tone: "deep", position: [0, Rf + 0.05, zf] });
  // Bonnet: tapered, sloping down to the grille, with side vents.
  const bonnet = loft([
    { z: 0.28, pts: [[-0.46, 1.1], [0.46, 1.1], [0.42, 1.72], [-0.42, 1.72]] },
    { z: 1.6, pts: [[-0.44, 1.08], [0.44, 1.08], [0.39, 1.62], [-0.39, 1.62]] },
    { z: 2.05, pts: [[-0.42, 1.06], [0.42, 1.06], [0.36, 1.5], [-0.36, 1.5]] },
  ]);
  k.add(bonnet, { tone: paint });
  k.add(new THREE.BoxGeometry(0.66, 0.4, 0.03), { tone: "solid", position: [0, 1.28, 2.05] });
  k.add(louvre(0.58, 0.34, 5, 0.02, "solid", "light"), { position: [0, 1.28, 2.07] });
  sym(k, headlamp(0.12, 0.1), { position: [0.28, 1.44, 2.05] });
  for (const s of [-1, 1]) {
    k.add(louvre(0.9, 0.18, 3, 0.02, "solid", "light"), { position: [s * 0.44, 1.38, 1.05], rotation: [0, (s * Math.PI) / 2, 0] });
    k.add(new THREE.BoxGeometry(0.02, 0.05, 1.7), { tone: "light", position: [s * 0.45, 1.13, 1.1] });
  }
  // Front weight block on its bracket.
  k.add(new THREE.BoxGeometry(0.5, 0.2, 0.3), { tone: "dark", position: [0, 0.78, 2.18] });
  for (let i = 0; i < 6; i++) k.add(new THREE.BoxGeometry(0.1, 0.46, 0.32), { tone: i % 2 ? "mid" : "dark", position: [-0.28 + i * 0.112, 0.98, 2.4] });
  // Front mudguards that follow the steered wheels.
  for (const s of [-1, 1]) k.add(mudguard(Rf + 0.06, Rf + 0.1, 0.35, 2.3, 0.4), { tone: paint, position: [(s * trackF) / 2, Rf, zf] });
  // Rear mudguards / fenders with lamps; platform and steps.
  for (const s of [-1, 1]) {
    k.add(mudguard(Rr + 0.07, Rr + 0.12, 0.05, Math.PI - 0.2, 0.58), { tone: paint, position: [(s * trackR) / 2, Rr, zr] });
    k.add(new THREE.BoxGeometry(0.1, 0.1, 0.12), { tone: "solid", position: [s * 1.02, 1.62, zr - 0.62] });
    k.add(new THREE.BoxGeometry(0.1, 0.06, 0.08), { tone: "light", position: [s * 1.02, 1.62, zr + 0.5] });
  }
  k.add(new THREE.BoxGeometry(1.5, 0.08, 1.7), { tone: "dark", position: [0, cabY - 0.04, -0.5] });
  for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(0.34, 0.03, 0.2), { tone: "mid", position: [-0.82, 0.45 + i * 0.28, 0.05] });
  k.add(bar([-0.98, 0.3, 0.05], [-0.98, 1.3, 0.05], 0.02, 5), { tone: "dark" });
  // Four-post cab: posts, roof with overhang, interior (seat, wheel, levers).
  const cz0 = -1.3,
    cz1 = 0.28,
    cx = 0.72;
  for (const [x, z] of [
    [cx, cz1],
    [-cx, cz1],
    [cx, cz0],
    [-cx, cz0],
  ] as const)
    k.add(new THREE.BoxGeometry(0.07, roofY - cabY, 0.07), { tone: "deep", position: [x, (roofY + cabY) / 2, z] });
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.04, 0.05, cz1 - cz0), { tone: "deep", position: [s * cx, cabY + 0.62, (cz0 + cz1) / 2] });
  const roof = loft([
    { z: cz0 - 0.18, pts: [[-0.86, roofY], [0.86, roofY], [0.8, roofY + 0.12], [-0.8, roofY + 0.12]] },
    { z: cz1 + 0.22, pts: [[-0.86, roofY], [0.86, roofY], [0.8, roofY + 0.12], [-0.8, roofY + 0.12]] },
  ]);
  k.add(roof, { tone: "paper" });
  k.add(new THREE.BoxGeometry(1.5, 0.06, 1.58), { tone: "dark", position: [0, roofY - 0.03, (cz0 + cz1) / 2] });
  // Seat, steering wheel on its column, levers.
  k.add(new THREE.BoxGeometry(0.46, 0.12, 0.46), { tone: "dark", position: [0, cabY + 0.5, -0.8] });
  k.add(new THREE.BoxGeometry(0.46, 0.55, 0.12), { tone: "dark", position: [0, cabY + 0.8, -1.02], rotation: [-0.15, 0, 0] });
  k.add(cylinder(0.08, 0.1, 0.44, 8), { tone: "mid", position: [0, cabY + 0.22, -0.8] });
  k.add(bar([0, cabY + 0.1, 0.05], [0, cabY + 0.95, -0.25], 0.03, 6), { tone: "deep" });
  k.add(new THREE.TorusGeometry(0.2, 0.02, 4, 16), { tone: "solid", position: [0, cabY + 0.98, -0.28], rotation: [-0.9, 0, 0] });
  for (const x of [0.36, 0.44]) k.add(bar([x, cabY + 0.4, -0.7], [x + 0.02, cabY + 0.8, -0.62], 0.012, 4), { tone: "deep" });
  // Glints on the glass planes (the panes themselves are drawn by a stippled glass mesh).
  // Exhaust stack with a rain cap; air intake.
  k.add(cylinder(0.055, 0.055, 1.8, 8), { tone: "dark", position: [0.46, 2.0, 0.44] });
  k.add(cylinder(0.075, 0.075, 0.4, 8), { tone: "mid", position: [0.46, 1.5, 0.44] });
  k.add(new THREE.BoxGeometry(0.12, 0.02, 0.12), { tone: "deep", position: [0.46, 2.92, 0.46], rotation: [0.35, 0, 0] });
  k.add(cylinder(0.08, 0.08, 1.2, 8), { tone: "light", position: [-0.46, 2.0, 0.44] });
  k.add(cylinder(0.11, 0.11, 0.14, 8), { tone: "mid", position: [-0.46, 2.66, 0.44] });
  // Rear: three-point linkage, PTO, drawbar, work lamps on the roof.
  for (const s of [-1, 1]) {
    k.add(bar([s * 0.22, 0.55, zr - 0.45], [s * 0.42, 0.42, zr - 1.2], 0.04, 6), { tone: "deep" });
    k.add(bar([s * 0.36, 1.05, zr - 0.45], [s * 0.4, 0.65, zr - 0.95], 0.03, 6), { tone: "deep" });
    k.add(new THREE.BoxGeometry(0.18, 0.12, 0.08), { tone: "paper", position: [s * 0.7, roofY + 0.02, cz1 + 0.24] });
    k.add(new THREE.BoxGeometry(0.14, 0.09, 0.02), { tone: "light", position: [s * 0.7, roofY + 0.02, cz1 + 0.285] });
  }
  k.add(bar([0, 1.02, zr - 0.5], [0, 0.95, zr - 1.1], 0.04, 6), { tone: "deep" });
  k.add(cylZ(0.04, 0.2, 8), { tone: "deep", position: [0, 0.7, zr - 0.55] });
  k.add(new THREE.BoxGeometry(0.16, 0.06, 0.6), { tone: "deep", position: [0, 0.42, zr - 0.5] });
  a.rig.kit("body").addGeometry(k.build());

  // Stippled glass panes: a screen-door mesh so the interior shows through.
  const glass = new Kit();
  glass.add(new THREE.BoxGeometry(1.42, roofY - cabY - 0.12, 0.01), { position: [0, (roofY + cabY) / 2, cz1] });
  glass.add(new THREE.BoxGeometry(1.42, roofY - cabY - 0.12, 0.01), { position: [0, (roofY + cabY) / 2, cz0] });
  for (const s of [-1, 1]) glass.add(new THREE.BoxGeometry(0.01, roofY - cabY - 0.12, cz1 - cz0 - 0.06), { position: [s * cx, (roofY + cabY) / 2, (cz0 + cz1) / 2] });
  if (!wreck) {
    const gmesh = new THREE.Mesh(glass.build(), inkMaterial({ tone: "light", opacity: 0.4, hatchSpace: "object", hatch: HATCH.vehicle, edge: 0.4, objectId: OBJECT_ID.vehicle }));
    gmesh.name = "glass";
    gmesh.userData.castShadow = false;
    a.extras.push({ object: gmesh, bone: "body" });
  }
  // Amber beacon on the roof (off unless on the road).
  const beaconId = a.lamps.add(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 10), { accent: "amber", position: [-0.5, roofY + 0.21, cz0 + 0.2], off: "pale" });
  a.rig.kit("body").add(cylinder(0.1, 0.1, 0.04, 10), { tone: "dark", position: [-0.5, roofY + 0.14, cz0 + 0.2] });

  // Wheels: big lugged rears, smaller fronts.
  const bare = wreck;
  const rear = wheelGeometry({ r: Rr, w: 0.48, rim: 0.48, style: "tractor", seg: 17, bare });
  const front = wheelGeometry({ r: Rf, w: 0.34, rim: 0.3, style: "tractor", seg: 12, bare });
  for (const s of [1, -1]) {
    a.wheel(`rear${s > 0 ? "R" : "L"}`, "root", [(s * trackR) / 2, bare ? 0.48 : Rr, zr], s > 0 ? rear : flipToLeft(rear), Rr);
    a.wheel(`front${s > 0 ? "R" : "L"}`, "root", [(s * trackF) / 2, bare ? 0.3 : Rf, zf], s > 0 ? front : flipToLeft(front), Rf);
  }
  a.speed = b.speed;
  a.mass = 2.5;
  a.bob = 0.004;
  let beaconOn = false;
  a.onTick((_dt, t) => {
    a.lamps.set(beaconId, beaconOn && !wreck ? (Math.sin(t * 9) > 0.2 ? 1 : 0.15) : 0);
  });
  const root = a.finish(bodyMaterial(HATCH.vehicle, OBJECT_ID.vehicle), { width: 2.35, depth: 4.6, height: roofY + 0.3 });
  root.userData.setBeacon = (on: boolean) => {
    beaconOn = on;
  };
  return root;
}

// ---------------------------------------------------------------- bicycle

/** A spoked wheel: rim, tyre and hub as geometry; spokes as pen lines. */
function bikeWheel(r: number): { geometry: THREE.BufferGeometry; spokes: THREE.LineSegments } {
  const k = new Kit();
  k.add(new THREE.TorusGeometry(r, 0.017, 6, 28), { tone: "deep", rotation: [0, Math.PI / 2, 0] });
  k.add(new THREE.TorusGeometry(r - 0.025, 0.01, 4, 28), { tone: "light", rotation: [0, Math.PI / 2, 0] });
  k.add(cylX(0.025, 0.1, 8), { tone: "mid" });
  const pts: number[] = [];
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const side = i % 2 ? 1 : -1;
    const a0 = a + side * 0.35;
    pts.push(side * 0.04, Math.sin(a0) * 0.024, Math.cos(a0) * 0.024, 0, Math.sin(a) * (r - 0.032), Math.cos(a) * (r - 0.032));
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const spokes = new THREE.LineSegments(lg, createInkLineMaterial({ tone: 0.55 }));
  spokes.name = "spokes";
  return { geometry: k.build(), spokes };
}

export function buildBicycle(b: RoadBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "bicycle", b.condition);
  const wreck = b.condition === "wreck";
  const R = 0.34;
  const zr = -0.42,
    zf = 0.66;
  const bb: V3 = [0, 0.29, 0];
  const seatTop: V3 = [0, 0.83, -0.17];
  const headTop: V3 = [0, 0.86, 0.5];
  const headBot: V3 = [0, 0.7, 0.555];
  const tube = 0.016;
  // Lean on the kickstand: the frame bone tilts toward -x.
  const lean = wreck ? 1.45 : 0.14;
  a.rig.bone("frame", "root", [0, 0, 0]);
  a.rig.get("frame").rotation.z = lean;
  const k = new Kit();
  const frameTone: Tone = "dark";
  k.add(bar(bb, seatTop, tube, 6), { tone: frameTone });
  k.add(bar(seatTop, headTop, tube, 6), { tone: frameTone });
  k.add(bar(bb, headBot, tube * 1.15, 6), { tone: frameTone });
  k.add(bar(headBot, headTop, tube * 1.4, 8), { tone: frameTone });
  for (const s of [-1, 1]) {
    k.add(bar([s * 0.04, bb[1], bb[2]], [s * 0.065, R, zr], tube * 0.7, 5), { tone: frameTone });
    k.add(bar([s * 0.02, seatTop[1] - 0.02, seatTop[2] + 0.01], [s * 0.065, R, zr], tube * 0.7, 5), { tone: frameTone });
    // Fork blades with rake.
    k.add(pipe([[s * 0.04, headBot[1], headBot[2]], [s * 0.05, 0.52, 0.6], [s * 0.05, R, zf]], tube * 0.8, 6, 5), { tone: frameTone });
  }
  // Seat post, sprung saddle.
  k.add(bar(seatTop, [0, 0.95, -0.2], 0.012, 6), { tone: "light" });
  k.add(loft([
    { z: -0.33, pts: [[-0.1, 0.95], [0.1, 0.95], [0.09, 1.0], [-0.09, 1.0]] },
    { z: -0.14, pts: [[-0.07, 0.96], [0.07, 0.96], [0.06, 1.0], [-0.06, 1.0]] },
    { z: -0.04, pts: [[-0.025, 0.97], [0.025, 0.97], [0.02, 0.995], [-0.02, 0.995]] },
  ]), { tone: "deep" });
  for (const s of [-1, 1]) k.add(cylinder(0.018, 0.018, 0.05, 6), { tone: "mid", position: [s * 0.06, 0.93, -0.3] });
  // Stem and swept-back roadster bars, grips, bell.
  k.add(bar(headTop, [0, 0.99, 0.47], 0.012, 6), { tone: "light" });
  k.add(pipe([[-0.29, 1.0, 0.33], [-0.2, 1.0, 0.44], [0, 0.99, 0.47], [0.2, 1.0, 0.44], [0.29, 1.0, 0.33]], 0.011, 14, 5), { tone: "light" });
  sym(k, cylX(0.017, 0.11, 6), { tone: "deep", position: [0.3, 1.0, 0.32], rotation: [0, 0.5, 0] });
  k.add(sphere(0.022, 8, 6), { tone: "pale", position: [0.12, 1.02, 0.46] });
  // Front basket: a woven box (bold rim, a few staves).
  const bz = 0.78;
  k.add(new THREE.BoxGeometry(0.34, 0.02, 0.26), { tone: "mid", position: [0, 0.78, bz] });
  k.add(new THREE.BoxGeometry(0.36, 0.025, 0.28), { tone: "mid", position: [0, 1.02, bz] });
  for (let i = 0; i < 5; i++) {
    k.add(new THREE.BoxGeometry(0.008, 0.24, 0.26), { tone: "light", position: [-0.17 + i * 0.085, 0.9, bz] });
    k.add(new THREE.BoxGeometry(0.34, 0.008, 0.27), { tone: "light", position: [0, 0.82 + i * 0.045, bz] });
  }
  k.add(new THREE.BoxGeometry(0.34, 0.22, 0.005), { tone: "pale", position: [0, 0.9, bz + 0.13] });
  k.add(new THREE.BoxGeometry(0.34, 0.22, 0.005), { tone: "pale", position: [0, 0.9, bz - 0.13] });
  k.add(bar([0, 0.99, 0.5], [0, 1.0, bz - 0.1], 0.008, 4), { tone: "deep" });
  // Mudguards, rear rack, chain guard, crank, kickstand, lamp.
  k.add(mudguardBike(R + 0.03, 0.2, 2.6, zf), { tone: "light" });
  k.add(mudguardBike(R + 0.03, 0.55, 3.0, zr), { tone: "light" });
  k.add(new THREE.BoxGeometry(0.14, 0.012, 0.36), { tone: "mid", position: [0, 0.72, zr + 0.02] });
  for (const s of [-1, 1]) k.add(bar([s * 0.065, 0.72, zr - 0.12], [s * 0.065, R, zr], 0.007, 4), { tone: "mid" });
  k.add(new THREE.BoxGeometry(0.01, 0.12, 0.5), { tone: "paper", position: [0.08, 0.31, zr / 2], rotation: [-0.02, 0, 0] });
  k.add(cylX(0.1, 0.012, 16), { tone: "mid", position: [0.07, bb[1], 0] });
  k.add(cylX(0.03, 0.14, 8), { tone: "deep", position: [0, bb[1], 0] });
  k.add(bar([0.085, bb[1], 0], [0.085, bb[1] - 0.12, 0.12], 0.012, 5), { tone: "deep" });
  k.add(bar([-0.085, bb[1], 0], [-0.085, bb[1] + 0.12, -0.12], 0.012, 5), { tone: "deep" });
  k.add(new THREE.BoxGeometry(0.09, 0.02, 0.05), { tone: "solid", position: [0.13, bb[1] - 0.12, 0.12] });
  k.add(new THREE.BoxGeometry(0.09, 0.02, 0.05), { tone: "solid", position: [-0.13, bb[1] + 0.12, -0.12] });
  k.add(bar([-0.05, 0.3, -0.12], [-0.05 - 0.2, 0.02, -0.18], 0.01, 4), { tone: "deep" });
  k.add(cylZ(0.035, 0.07, 8), { tone: "pale", position: [0, 0.82, 0.62] });
  a.rig.kit("frame").addGeometry(k.build());
  // Wheels ride the frame.
  const rw = bikeWheel(R);
  const rb = a.wheel("wheelR", "frame", [0, R, zr], rw.geometry, R);
  const fw = bikeWheel(R);
  const fb = a.wheel("wheelF", "frame", [0, R, zf], fw.geometry, R);
  a.extras.push({ object: rw.spokes, bone: "wheelR" }, { object: fw.spokes, bone: "wheelF" });
  void rb;
  void fb;
  a.speed = b.speed;
  a.mass = 0.2;
  a.bob = 0;
  // Pivot on the contact line so the lean does not lift the wheels.
  return a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.vehicle), { width: 0.6, depth: 1.8, height: 1.05 });
}

function mudguardBike(r: number, a0: number, a1: number, z: number): THREE.BufferGeometry {
  const outer = arc(0, 0, r + 0.012, a0, a1, 14);
  const inner = arc(0, 0, r, a1, a0, 14);
  const g = sideExtrude([...outer, ...inner], 0.05, 0);
  g.translate(0, 0.34, z);
  return g;
}
