/**
 * Masts: a lattice telecom mast with sector antennas and a microwave dish,
 * and a CCTV camera mast whose pan-tilt head slowly turns toward the
 * trolley (or tracks a point it is given).
 *
 * Lattice bracing and guy wires are drawn as pen lines (one draw call), so
 * they stay crisp at any distance instead of breaking into dashes.
 */
import * as THREE from "three";
import { cylinder, lathe, sphere } from "../../core/geometry.ts";
import { createInkLineMaterial } from "../../core/ink-material.ts";
import { HATCH, OBJECT_ID, bar, bodyMaterial, cylZ, louvre, type V3 } from "./common.ts";
import { Assembly } from "./assembly.ts";
import type { MachineBuild } from "./equipment.ts";

function lines(segments: Array<[V3, V3]>, tone = 0.85): THREE.LineSegments {
  const pos: number[] = [];
  for (const [a, b] of segments) pos.push(...a, ...b);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const l = new THREE.LineSegments(g, createInkLineMaterial({ tone }));
  l.name = "lines";
  return l;
}

// ------------------------------------------------------------------ antenna

export function buildAntenna(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "antenna", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "none";
  a.mass = 8;
  const k = a.rig.kit("root");
  const H = 11.0;
  const baseR = 0.62,
    topR = 0.26;
  const legAt = (i: number, y: number): V3 => {
    const r = baseR + (topR - baseR) * (y / H);
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 2;
    return [Math.cos(ang) * r, y, Math.sin(ang) * r];
  };
  // Concrete pad and base plates.
  k.add(new THREE.BoxGeometry(2.2, 0.2, 2.2), { tone: "pale", position: [0, 0.1, 0] });
  for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(0.22, 0.04, 0.22), { tone: "dark", position: [legAt(i, 0.22)[0], 0.22, legAt(i, 0.22)[2]] });
  // Legs: solid tubes.
  for (let i = 0; i < 3; i++) k.add(bar(legAt(i, 0.2), legAt(i, H), 0.04, 6), { tone: "mid" });
  // Bracing: horizontals and zig-zag diagonals as pen lines.
  const seg: Array<[V3, V3]> = [];
  const levels = 14;
  for (let l = 0; l <= levels; l++) {
    const y = 0.3 + ((H - 0.4) * l) / levels;
    for (let i = 0; i < 3; i++) seg.push([legAt(i, y), legAt((i + 1) % 3, y)]);
    if (l < levels) {
      const y2 = 0.3 + ((H - 0.4) * (l + 1)) / levels;
      for (let i = 0; i < 3; i++) seg.push(l % 2 ? [legAt(i, y), legAt((i + 1) % 3, y2)] : [legAt((i + 1) % 3, y), legAt(i, y2)]);
    }
  }
  // Cable ladder with feeders down one face.
  const f0 = legAt(0, 0.4),
    f1 = legAt(0, H - 0.5);
  for (let i = 0; i < 3; i++) seg.push([[f0[0] + 0.05 + i * 0.03, 0.4, f0[2] - 0.08], [f1[0] + 0.05 + i * 0.03, H - 0.5, f1[2] - 0.08]]);
  a.extras.push({ object: lines(seg, 0.8), bone: "root" });
  // Headframe with three sector panels.
  const hy = H - 0.8;
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(ang) * 0.62,
      z = Math.sin(ang) * 0.62;
    k.add(bar([Math.cos(ang) * 0.22, hy, Math.sin(ang) * 0.22], [x, hy, z], 0.03, 5), { tone: "dark" });
    k.add(new THREE.BoxGeometry(0.3, 1.3, 0.1), { tone: "paper", position: [x, hy + 0.2, z], rotation: [0, -ang + Math.PI / 2, 0] });
    k.add(cylinder(0.02, 0.02, 1.5, 5), { tone: "dark", position: [Math.cos(ang) * 0.54, hy + 0.2, Math.sin(ang) * 0.54] });
  }
  // Microwave dish facing +Z with its radome.
  const dishY = H - 3.0;
  const dish = lathe(
    [
      [0.001, 0],
      [0.2, 0.02],
      [0.36, 0.08],
      [0.42, 0.14],
      [0.43, 0.2],
    ],
    18,
  );
  dish.rotateX(Math.PI / 2);
  k.add(dish, { tone: "light", position: [0, dishY, 0.5] });
  k.add(cylZ(0.44, 0.04, 18), { tone: "pale", position: [0, dishY, 0.71] });
  k.add(bar([0, dishY, 0.45], [0, dishY, 0.1], 0.04, 6), { tone: "dark" });
  // Lightning rod and the obstruction lamp.
  k.add(cylinder(0.012, 0.02, 1.4, 5), { tone: "deep", position: [0, H + 0.7, 0] });
  k.add(cylinder(0.08, 0.08, 0.08, 10), { tone: "dark", position: [0.25, H + 0.04, 0] });
  const lamp = a.lamps.add(sphere(0.08, 10, 8), { accent: "signal", off: "mid", position: [0.25, H + 0.14, 0] });
  // Equipment cabinet at the foot with louvres and a cable bridge.
  k.add(new THREE.BoxGeometry(0.9, 1.6, 0.6), { tone: "paper", position: [1.4, 0.8 + 0.2, -0.3] });
  k.add(louvre(0.6, 0.3, 4, 0.01, "deep", "paper"), { position: [1.4, 1.5, 0.006] });
  k.add(new THREE.BoxGeometry(0.02, 1.3, 0.012), { tone: "dark", position: [1.4, 0.95, 0.006] });
  k.add(bar([1.1, 1.75, -0.3], [0.35, 2.4, -0.2], 0.05, 5), { tone: "mid" });
  if (wreck) k.add(new THREE.BoxGeometry(0.3, 1.4, 0.1), { tone: "solid", position: [0.4, 0.6, 0.6], rotation: [1.3, 0.4, 0] });
  a.onTick((_dt, t) => {
    // Aviation obstruction lamp: 1 s flash every 2 s (dead in ruin).
    a.lamps.set(lamp, wreck ? 0 : t % 2 < 0.9 ? 1 : 0.05);
  });
  return a.finish(bodyMaterial(HATCH.machine * 2, OBJECT_ID.machine), { width: 2.4, depth: 2.4, height: H + 1.4 });
}

// -------------------------------------------------------------- camera mast

export function buildCameraMast(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "camera-mast", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 1.5;
  const k = a.rig.kit("root");
  const H = 6.0;
  // Flanged base on a small plinth, tapered octagonal pole.
  k.add(cylinder(0.3, 0.34, 0.25, 8), { tone: "pale", position: [0, 0.125, 0] });
  k.add(cylinder(0.2, 0.2, 0.03, 8), { tone: "mid", position: [0, 0.265, 0] });
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    k.add(cylinder(0.02, 0.02, 0.06, 6), { tone: "deep", position: [Math.cos(ang) * 0.15, 0.3, Math.sin(ang) * 0.15] });
  }
  k.add(cylinder(0.055, 0.09, H - 0.25, 8), { tone: "light", position: [0, 0.25 + (H - 0.25) / 2, 0] });
  // Junction box with its door, and conduit up the pole.
  k.add(new THREE.BoxGeometry(0.3, 0.42, 0.16), { tone: "paper", position: [0, 2.3, 0.12] });
  k.add(new THREE.BoxGeometry(0.26, 0.36, 0.01), { tone: "pale", position: [0, 2.3, 0.205] });
  k.add(new THREE.BoxGeometry(0.02, 0.06, 0.02), { tone: "deep", position: [0.1, 2.3, 0.215] });
  k.add(cylinder(0.018, 0.018, H - 2.6, 5), { tone: "mid", position: [0.07, 2.5 + (H - 2.6) / 2, 0.06] });
  // Bracket arm at the top, reaching toward +Z (the trolley).
  k.add(bar([0, H - 0.1, 0], [0, H - 0.1, 0.55], 0.035, 6), { tone: "mid" });
  k.add(bar([0, H - 0.5, 0.02], [0, H - 0.12, 0.4], 0.02, 5), { tone: "mid" });
  // Pan head (yaw) and tilt cradle (pitch) on bones.
  a.rig.bone("pan", "root", [0, H - 0.14, 0.55]);
  a.rig.bone("tilt", "pan", [0, -0.12, 0]);
  const pk = a.rig.kit("pan");
  pk.add(cylinder(0.06, 0.06, 0.1, 10), { tone: "dark", position: [0, -0.02, 0] });
  pk.add(new THREE.BoxGeometry(0.04, 0.16, 0.08), { tone: "dark", position: [0.1, -0.1, 0] });
  pk.add(new THREE.BoxGeometry(0.04, 0.16, 0.08), { tone: "dark", position: [-0.1, -0.1, 0] });
  const tk = a.rig.kit("tilt");
  // Housing (points along +Z), sunshield, window, IR ring.
  tk.add(new THREE.BoxGeometry(0.15, 0.14, 0.42), { tone: "paper", position: [0, 0, 0.05] });
  tk.add(new THREE.BoxGeometry(0.2, 0.012, 0.54), { tone: "light", position: [0, 0.085, 0.1] });
  for (const s of [-1, 1]) tk.add(new THREE.BoxGeometry(0.012, 0.05, 0.54), { tone: "light", position: [s * 0.1, 0.065, 0.1] });
  tk.add(new THREE.BoxGeometry(0.13, 0.12, 0.012), { tone: "solid", position: [0, 0, 0.265] });
  tk.add(cylZ(0.035, 0.014, 12), { tone: "deep", position: [0, 0, 0.274] });
  tk.add(cylZ(0.022, 0.016, 12), { tone: "light", position: [0.01, 0.008, 0.28] });
  for (const s of [-1, 1]) tk.add(new THREE.BoxGeometry(0.03, 0.03, 0.012), { tone: "pale", position: [s * 0.05, -0.035, 0.272] });
  tk.add(bar([0, -0.05, -0.16], [0, -0.14, -0.2], 0.012, 4), { tone: "deep" });
  const rec = a.lamps.add(new THREE.BoxGeometry(0.018, 0.018, 0.01), { accent: "signal", off: "mid", position: [0.055, 0.045, 0.27] });
  // Move the lamp with the camera: lamps ride the tilt bone.
  const pan = a.rig.get("pan"),
    tilt = a.rig.get("tilt");
  let target: THREE.Vector3 | null = null;
  const tmp = new THREE.Vector3();
  const seed = b.seed;
  let yaw = 1.1 + ((seed % 5) - 2) * 0.2;
  let pitch = 0.25;
  a.onTick((dt, t) => {
    if (a.root && (a.root.userData as { struck?: boolean }).struck) return;
    let gy = 0,
      gp = 0.22;
    if (target && a.root) {
      a.root.updateMatrixWorld();
      tmp.copy(target);
      a.root.worldToLocal(tmp);
      tmp.sub(new THREE.Vector3(0, H - 0.26, 0.55));
      gy = Math.atan2(tmp.x, tmp.z);
      gp = Math.atan2(-tmp.y, Math.hypot(tmp.x, tmp.z));
    } else {
      // Unhurried: turn toward the trolley, then hunt a little around it.
      gy = Math.sin(t * 0.13 + seed) * 0.12;
    }
    const rate = 0.28;
    let d = gy - yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    pitch += (gp - pitch) * Math.min(1, dt * 1.5);
    pan.rotation.y = yaw;
    tilt.rotation.x = pitch;
    a.lamps.set(rec, wreck ? 0 : t % 1.4 < 0.7 ? 1 : 0);
  });
  if (wreck) a.rig.get("pan").rotation.z = 0.8;
  const root = a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: 0.7, depth: 1.2, height: H + 0.1 }, "tilt");
  root.userData.track = (p: THREE.Vector3 | null) => {
    target = p ? p.clone() : null;
  };
  return root;
}
