/**
 * Rolling stock on standard gauge (1.435 m). Wheel treads touch the rail
 * head at y = 0: place these at the track's rail-top height.
 *
 *   passenger-carriage  20.4 m over body, bogie centres 14.0 m, floor 1.20 m
 *   rescue-carriage     16.6 m double-ended railcar with cabs at both ends
 *   freight-wagon       16.0 m: box van, tank or container flat (by seed)
 *   catering-trolley    a platelayer's trolley carrying a catering service
 *
 * Wheelsets are bones that roll; bogie frames, springs, axle boxes and
 * dampers are static parts of the body. The -Z end carries a red tail lamp
 * (the railway's end-of-train mark) because staging places rolling stock
 * facing away from the trolley.
 */
import * as THREE from "three";
import { Kit, cylinder, jitter, lathe, sphere, type Tone } from "../../core/geometry.ts";
import {
  Decals,
  HATCH,
  OBJECT_ID,
  bar,
  bodyMaterial,
  coilSpring,
  crossExtrude,
  cylX,
  cylZ,
  fitText,
  inkAtlas,
  latheX,
  loft,
  louvre,
  roundRect,
  type Condition,
  type V2,
} from "./common.ts";
import { Assembly } from "./assembly.ts";
import { GLASS } from "./road.ts";

export const GAUGE = 1.435;
/** Lateral position of the wheel tread centre (rail head centreline). */
const TREAD_X = GAUGE / 2 + 0.036;

export interface RailBuild {
  seed: number;
  condition: Condition;
  speed: number;
}

// ----------------------------------------------------------------- wheels

/** A monobloc rail wheel (flange inboard) for the +X side, centred on its tread. */
function railWheel(r: number): THREE.BufferGeometry {
  const prof: V2[] = [
    [0.001, -0.075],
    [r + 0.03, -0.072],
    [r + 0.002, -0.035],
    [r, 0.06],
    [r * 0.55, 0.045],
    [0.001, 0.06],
  ];
  const k = new Kit();
  k.add(latheX(prof, 12), { tone: "mid" });
  return k.build();
}

/** A wheelset: two wheels and the axle, rolling as one. */
function wheelset(r: number, disc: boolean): THREE.BufferGeometry {
  const k = new Kit();
  const w = railWheel(r);
  k.add(w, { position: [TREAD_X, 0, 0] });
  const left = w.clone();
  left.rotateY(Math.PI);
  k.add(left, { position: [-TREAD_X, 0, 0] });
  k.add(cylX(0.085, 2.12, 8), { tone: "dark" });
  if (disc) for (const s of [-1, 1]) k.add(cylX(0.3, 0.05, 12), { tone: "light", position: [s * 0.3, 0, 0] });
  return k.build();
}

// ----------------------------------------------------------------- bogies

type BogieKind = "passenger" | "freight" | "trolley";

/** Bogie frame (static) centred at z, with wheelsets as rolling bones. */
function bogie(a: Assembly, name: string, z: number, kind: BogieKind): void {
  const R = kind === "trolley" ? 0.18 : 0.46;
  const wb = kind === "freight" ? 1.8 : 2.6;
  const k = a.rig.kit("body");
  if (kind !== "trolley") {
    const fx = kind === "freight" ? 1.0 : 1.02;
    for (const s of [-1, 1]) {
      // Side frame: a plate girder dropping between the axle boxes.
      const outline: V2[] = [
        [-wb / 2 - 0.35, 0.58],
        [-wb / 2 - 0.35, 0.8],
        [-0.55, 0.8],
        [-0.35, 0.66],
        [0.35, 0.66],
        [0.55, 0.8],
        [wb / 2 + 0.35, 0.8],
        [wb / 2 + 0.35, 0.58],
        [wb / 2 - 0.2, 0.58],
        [wb / 2 - 0.3, 0.64],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-wb / 2 + 0.3, 0.64],
        [-wb / 2 + 0.2, 0.58],
      ];
      const sf = crossExtrude(outline.map(([zz, y]): V2 => [zz, y]), 0.16, 0);
      sf.rotateY(-Math.PI / 2);
      k.add(sf, { tone: "dark", position: [s * fx, 0, z] });
      for (const dz of [-wb / 2, wb / 2]) {
        // Axle box, primary springs, damper.
        k.add(new THREE.BoxGeometry(0.2, 0.26, 0.3), { tone: "deep", position: [s * (fx + 0.02), R, z + dz] });
        k.add(cylX(0.1, 0.06, 8), { tone: "mid", position: [s * (fx + 0.13), R, z + dz] });
        k.add(coilSpring(0.09, 0.2, 2, 0.02, 6), { tone: "mid", position: [s * fx, R + 0.1, z + dz - Math.sign(dz) * 0.22] });
      }
      k.add(bar([s * (fx + 0.09), 0.76, z - 0.3], [s * (fx + 0.09), 0.56, z - wb / 2 + 0.2], 0.04, 6), { tone: "deep" });
      if (kind === "passenger") {
        // Secondary air springs under the bolster.
        k.add(cylinder(0.24, 0.26, 0.24, 10), { tone: "deep", position: [s * 0.95, 0.94, z] });
        k.add(bar([s * 1.12, 0.72, z + 0.2], [s * 1.12, 1.05, z + 0.55], 0.035, 6), { tone: "dark" });
      } else {
        k.add(coilSpring(0.12, 0.22, 2, 0.022, 6), { tone: "mid", position: [s * 0.95, 0.66, z] });
      }
    }
    // Transom and bolster.
    k.add(new THREE.BoxGeometry(2.0, 0.2, 0.36), { tone: "dark", position: [0, 0.64, z] });
    if (kind === "freight") k.add(new THREE.BoxGeometry(2.2, 0.26, 0.42), { tone: "dark", position: [0, 0.88, z] });
    // Brake blocks on freight bogies.
    if (kind === "freight")
      for (const dz of [-wb / 2, wb / 2])
        for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.1, 0.34, 0.1), { tone: "deep", position: [s * TREAD_X, R, z + dz - Math.sign(dz) * (R + 0.06)] });
  }
  const ws = wheelset(R, kind === "passenger");
  a.wheel(`${name}a`, "root", [0, R, z - wb / 2], ws, R);
  a.wheel(`${name}b`, "root", [0, R, z + wb / 2], ws, R);
}

/** Side buffers and screw coupling at an end (s = +1 front, -1 rear). */
function buffers(k: Kit, zEnd: number, s: number, headTone: Tone = "light"): void {
  for (const x of [-0.875, 0.875]) {
    k.add(cylZ(0.11, 0.42, 8, 0.14), { tone: "dark", position: [x, 1.06, zEnd + s * 0.21] });
    k.add(cylZ(0.185, 0.05, 12), { tone: headTone, position: [x, 1.06, zEnd + s * 0.44] });
  }
  k.add(new THREE.BoxGeometry(0.36, 0.3, 0.16), { tone: "deep", position: [0, 1.06, zEnd + s * 0.08] });
  k.add(new THREE.TorusGeometry(0.1, 0.025, 4, 10), { tone: "deep", position: [0, 1.0, zEnd + s * 0.28], rotation: [0, Math.PI / 2, 0] });
  k.add(new THREE.BoxGeometry(2.3, 0.28, 0.1), { tone: "deep", position: [0, 1.06, zEnd - s * 0.02] });
}

/** Railway lamps at an end: two marker/head lamps (white) and tail lamps (red). */
function endLamps(a: Assembly, zEnd: number, s: number, y: number, head: boolean): number[] {
  const ids: number[] = [];
  for (const x of [-0.72, 0.72]) {
    a.rig.kit("body").add(cylZ(0.11, 0.06, 12), { tone: "deep", position: [x, y, zEnd + s * 0.02] });
    ids.push(
      a.lamps.add(cylZ(0.085, 0.05, 12), {
        accent: head ? "none" : "signal",
        on: "paper",
        off: head ? "light" : "mid",
        level: 1,
        position: [x, y, zEnd + s * 0.05],
      }),
    );
  }
  return ids;
}

// ------------------------------------------------------- passenger carriage

/** Carriage cross-section: tumblehome sides, cant rail, shallow roof arc. */
function carriageSection(hw: number, floor: number, roof: number): V2[] {
  const pts: V2[] = [
    [-hw + 0.1, floor - 0.2],
    [hw - 0.1, floor - 0.2],
    [hw - 0.03, floor + 0.1],
    [hw, floor + 0.6],
    [hw - 0.01, floor + 1.7],
    [hw - 0.06, roof - 0.52],
  ];
  const right: V2[] = [];
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const ang = t * (Math.PI / 2);
    right.push([(hw - 0.06) * Math.cos(ang), roof - 0.52 + 0.52 * Math.sin(ang)]);
  }
  pts.push(...right, [0, roof]);
  const left = pts
    .slice(2)
    .reverse()
    .map(([x, y]): V2 => [-x, y])
    .filter(([x]) => x < -1e-6);
  return [...pts, ...left];
}

export function buildPassengerCarriage(b: RailBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "passenger-carriage", b.condition);
  const wreck = b.condition === "wreck";
  const L = 20.4,
    W = 2.82,
    hw = W / 2,
    floor = 1.2,
    roof = 3.86;
  a.reactStyle = "rail";
  a.mass = 6;
  a.bob = 0.003;
  a.rig.bone("body", "root", [0, 0, 0]);
  const k = a.rig.kit("body");
  // Carbody shell.
  k.add(crossExtrude(carriageSection(hw, floor, roof), L, 0), { tone: "paper" });
  // Window band (mid tone), bright stripe below it, roof panel in light tone.
  const bandY0 = floor + 0.78,
    bandY1 = floor + 1.78;
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.012, bandY1 - bandY0, L - 1.2), { tone: "mid", position: [s * (hw + 0.004), (bandY0 + bandY1) / 2, 0] });
    k.add(new THREE.BoxGeometry(0.012, 0.06, L - 0.3), { tone: "solid", position: [s * (hw + 0.004), bandY0 - 0.12, 0] });
    k.add(new THREE.BoxGeometry(0.012, 0.16, L - 0.3), { tone: "dark", position: [s * (hw - 0.08), floor - 0.1, 0] });
  }
  // Windows: rounded panes, flush, with white glints on alternate panes.
  const pane = crossExtrude(roundRect(0, 0, 1.3, 0.78, 0.1, 1), 0.02, 0);
  pane.rotateY(Math.PI / 2);
  const glint = new THREE.BoxGeometry(0.014, 0.6, 0.05);
  const n = 11;
  const pitch = 1.56;
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * pitch;
    for (const s of [-1, 1]) {
      k.add(pane, { tone: GLASS, position: [s * (hw + 0.012), floor + 1.28, z] });
      if (i % 3 === 1) k.add(glint, { tone: "paper", position: [s * (hw + 0.024), floor + 1.28, z + 0.2], rotation: [s * 0.6, 0, 0] });
    }
  }
  // Doors at both ends with droplights, handrails, steps.
  for (const zc of [L / 2 - 0.95, -(L / 2 - 0.95)])
    for (const s of [-1, 1]) {
      k.add(new THREE.BoxGeometry(0.014, 2.05, 0.92), { tone: "paper", position: [s * (hw + 0.008), floor + 1.0, zc] });
      k.add(new THREE.BoxGeometry(0.02, 0.62, 0.52), { tone: GLASS, position: [s * (hw + 0.014), floor + 1.45, zc] });
      for (const e of [-0.47, 0.47]) k.add(new THREE.BoxGeometry(0.02, 2.05, 0.02), { tone: "solid", position: [s * (hw + 0.016), floor + 1.0, zc + e] });
      k.add(new THREE.BoxGeometry(0.03, 0.9, 0.03), { tone: "light", position: [s * (hw + 0.05), floor + 0.95, zc + (zc > 0 ? 0.56 : -0.56)] });
      k.add(new THREE.BoxGeometry(0.3, 0.04, 0.7), { tone: "deep", position: [s * (hw - 0.1), floor - 0.35, zc] });
    }
  // Roof: ventilators along the ridge, a light roof panel.
  for (let i = 0; i < 8; i++) {
    const z = (i - 3.5) * 2.2;
    k.add(cylinder(0.12, 0.16, 0.12, 6), { tone: "light", position: [0, roof + 0.02, z] });
    k.add(cylinder(0.2, 0.2, 0.04, 8), { tone: "pale", position: [0, roof + 0.1, z] });
  }
  // Ends: gangway bellows, end doors, lamps, buffers, couplings.
  for (const s of [-1, 1]) {
    const zEnd = (s * L) / 2;
    k.add(new THREE.BoxGeometry(1.1, 2.2, 0.26), { tone: "deep", position: [0, floor + 1.15, zEnd + s * 0.13] });
    for (let i = 0; i < 5; i++) k.add(new THREE.BoxGeometry(1.16, 2.26, 0.03), { tone: "dark", position: [0, floor + 1.15, zEnd + s * (0.03 + i * 0.05)] });
    k.add(new THREE.BoxGeometry(0.4, 0.6, 0.02), { tone: GLASS, position: [0, floor + 1.55, zEnd + s * 0.27] });
    buffers(k, zEnd, s);
  }
  // Underframe: solebar, equipment cases, air reservoirs.
  k.add(new THREE.BoxGeometry(2.5, 0.22, L - 0.2), { tone: "deep", position: [0, floor - 0.28, 0] });
  const cases: Array<[number, number, number, number]> = [
    [-4.2, 1.6, 0.6, 1.8],
    [-1.4, 1.2, 0.5, 1.6],
    [1.2, 2.2, 0.55, 1.9],
    [4.4, 1.4, 0.45, 1.5],
  ];
  for (const [z, len, h, w] of cases) k.add(new THREE.BoxGeometry(w, h, len), { tone: "dark", position: [0, floor - 0.4 - h / 2, z] });
  for (const s of [-1, 1]) k.add(cylZ(0.16, 2.4, 10), { tone: "deep", position: [s * 1.0, floor - 0.62, -2.8 * s] });
  bogie(a, "bogieF", 7.0, "passenger");
  bogie(a, "bogieR", -7.0, "passenger");
  const tail = endLamps(a, -L / 2 - 0.15, -1, floor + 0.35, false);
  void tail;
  if (wreck) for (let i = 0; i < a.lamps.size; i++) a.lamps.set(i, 0);
  // Coach number and class lettering.
  const tex = inkAtlas("machines:carriage", 512, 128, (g) => {
    fitText(g, "C 41207", 8, 10, 360, 108, { weight: 700, align: "left" });
    fitText(g, "2", 400, 6, 104, 116, { weight: 800 });
  });
  const d = new Decals(512, 128);
  for (const s of [-1, 1]) {
    d.add([0, 0, 380, 128], [0.72, 0.24], { position: [s * (hw + 0.012), floor + 0.28, s * 5.8], rotation: [0, (s * Math.PI) / 2, 0] });
    d.add([392, 0, 120, 128], [0.24, 0.26], { position: [s * (hw + 0.012), floor + 1.28, s * 8.95], rotation: [0, (s * Math.PI) / 2, 0] });
  }
  a.decals = { decals: d, texture: tex, hatch: HATCH.rail, objectId: OBJECT_ID.rail, bone: "body" };
  a.speed = b.speed;
  const root = a.finish(bodyMaterial(HATCH.rail, OBJECT_ID.rail), { width: W, depth: L + 1.0, height: roof + 0.1 });
  root.userData.railContact = 0;
  return root;
}

// --------------------------------------------------------- rescue carriage

/** Railcar body with raked cab ends at both ends (loft). */
function railcarShell(hw: number, floor: number, roof: number, L: number): THREE.BufferGeometry {
  const base = carriageSection(hw, floor, roof);
  const clipTop = (sec: V2[], top: number, inset: number): V2[] =>
    sec.map(([x, y]): V2 => {
      if (y <= top) return [x, y];
      const t = (y - top) / (roof - top);
      return [x * (1 - inset * t), top + (y - top) * 0.12];
    });
  const nose = L / 2;
  return loft([
    { z: -nose, pts: clipTop(base, floor + 1.02, 0.08) },
    { z: -nose + 0.12, pts: clipTop(base, floor + 1.15, 0.05) },
    { z: -nose + 0.75, pts: base },
    { z: nose - 0.75, pts: base },
    { z: nose - 0.12, pts: clipTop(base, floor + 1.15, 0.05) },
    { z: nose, pts: clipTop(base, floor + 1.02, 0.08) },
  ]);
}

export function buildRescueCarriage(b: RailBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "rescue-carriage", b.condition);
  const wreck = b.condition === "wreck";
  const L = 16.6,
    W = 2.8,
    hw = W / 2,
    floor = 1.22,
    roof = 3.95;
  a.reactStyle = "rail";
  a.mass = 5;
  a.bob = 0.003;
  a.rig.bone("body", "root", [0, 0, 0]);
  const k = a.rig.kit("body");
  let shell = railcarShell(hw, floor, roof, L);
  if (wreck) shell = jitter(shell, 0.04, b.seed + 2);
  k.add(shell, { tone: "paper" });
  const nose = L / 2;
  const lamps: { heads: number[]; tails: number[]; beacons: number[]; warn: number[] } = { heads: [], tails: [], beacons: [], warn: [] };
  for (const s of [-1, 1]) {
    const zN = s * nose;
    // Raked windscreen (two panes), wiper, cab side windows.
    const wsMidY = floor + 1.02 + (roof - floor - 1.02) * 0.46;
    const ws = new THREE.BoxGeometry(1.08, 1.34, 0.03);
    ws.rotateX(-s * 1.08);
    for (const x of [-0.6, 0.6]) k.add(ws, { tone: GLASS, position: [x, wsMidY + 0.02, zN - s * 0.38] });
    const gl = new THREE.BoxGeometry(0.06, 1.1, 0.012);
    gl.rotateX(-s * 1.08);
    k.add(gl, { tone: "paper", position: [0.3, wsMidY + 0.04, zN - s * 0.36] });
    for (const sx of [-1, 1]) {
      k.add(new THREE.BoxGeometry(0.02, 0.75, 0.9), { tone: GLASS, position: [sx * (hw + 0.008), floor + 1.55, zN - s * 1.4] });
      k.add(new THREE.BoxGeometry(0.02, 2.0, 0.02), { tone: "solid", position: [sx * (hw + 0.012), floor + 1.0, zN - s * 2.0] });
      k.add(new THREE.BoxGeometry(0.03, 1.0, 0.03), { tone: "light", position: [sx * (hw + 0.04), floor + 0.9, zN - s * 2.1] });
    }
    // Hi-vis warning panel across the nose (the one amber it earns).
    k.add(new THREE.BoxGeometry(W - 0.2, 1.0, 0.03), { tone: "paper", accent: "amber", position: [0, floor + 0.5, zN + s * 0.005] });
    // Headlamps (white) and tail lamps (red) in pairs; a roof marker.
    for (const x of [-0.95, 0.95]) {
      k.add(cylZ(0.12, 0.08, 12), { tone: "solid", position: [x, floor + 0.42, zN + s * 0.03] });
      const head = a.lamps.add(cylZ(0.09, 0.05, 12), { on: "paper", off: "light", level: s > 0 ? 1 : 0, position: [x - Math.sign(x) * 0.02, floor + 0.42, zN + s * 0.06] });
      const tail = a.lamps.add(cylZ(0.06, 0.05, 10), { accent: "signal", off: "mid", level: s > 0 ? 0 : 1, position: [x + Math.sign(x) * -0.28, floor + 0.42, zN + s * 0.06] });
      k.add(cylZ(0.08, 0.06, 10), { tone: "solid", position: [x + Math.sign(x) * -0.28, floor + 0.42, zN + s * 0.035] });
      (s > 0 ? lamps.heads : lamps.tails).push(s > 0 ? head : tail);
    }
    k.add(cylZ(0.1, 0.06, 10), { tone: "solid", position: [0, roof - 0.2, zN - s * 0.62] });
    lamps.heads.push(a.lamps.add(cylZ(0.075, 0.04, 10), { on: "paper", off: "light", level: s > 0 ? 1 : 0, position: [0, roof - 0.2, zN - s * 0.58] }));
    // Horn, coupler, buffers, cowcatcher.
    k.add(cylZ(0.06, 0.2, 8, 0.1), { tone: "deep", position: [0.4, roof - 0.12, zN - s * 0.8] });
    buffers(k, zN, s);
    k.add(new THREE.BoxGeometry(2.5, 0.35, 0.08), { tone: "deep", position: [0, 0.42, zN + s * 0.1], rotation: [s * 0.3, 0, 0] });
  }
  // Mid-body: big sliding doors (both sides), roller lockers, lettering zone.
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.02, 2.2, 1.8), { tone: "pale", position: [s * (hw + 0.008), floor + 1.1, 0.4] });
    k.add(new THREE.BoxGeometry(0.02, 0.6, 1.2), { tone: GLASS, position: [s * (hw + 0.014), floor + 1.6, 0.4] });
    k.add(new THREE.BoxGeometry(0.02, 0.05, 3.8), { tone: "deep", position: [s * (hw + 0.015), floor + 2.26, 0.2] });
    for (const z of [-3.0, 3.6]) {
      k.add(new THREE.BoxGeometry(0.014, 0.9, 1.9), { tone: "pale", position: [s * (hw + 0.006), floor + 0.55, z] });
      for (let i = 1; i < 4; i++) k.add(new THREE.BoxGeometry(0.012, 0.03, 1.86), { tone: "solid", position: [s * (hw + 0.012), floor + 0.1 + i * 0.22, z] });
    }
    // Body band: ink stripe with a checker at the waist.
    k.add(new THREE.BoxGeometry(0.012, 0.1, L - 4.6), { tone: "solid", position: [s * (hw + 0.004), floor + 0.95, 0] });
    for (let i = 0; i < 20; i++) {
      if (i % 2) continue;
      k.add(new THREE.BoxGeometry(0.012, 0.22, 0.22), { tone: "solid", position: [s * (hw + 0.005), floor + 0.72, -6.0 + i * 0.22] });
      k.add(new THREE.BoxGeometry(0.012, 0.22, 0.22), { tone: "solid", position: [s * (hw + 0.005), floor + 0.72, 1.9 + i * 0.22] });
    }
  }
  // Roof: equipment pods, folded floodlight mast, light bar with beacons.
  k.add(new THREE.BoxGeometry(1.6, 0.26, 2.6), { tone: "pale", position: [0, roof + 0.1, -3.4] });
  k.add(louvre(1.3, 0.2, 4, 0.02), { position: [0, roof + 0.1, -2.09] });
  k.add(new THREE.BoxGeometry(0.2, 0.2, 3.2), { tone: "dark", position: [0.7, roof + 0.12, 2.2] });
  k.add(new THREE.BoxGeometry(0.5, 0.26, 0.4), { tone: "paper", position: [0.7, roof + 0.2, 3.9] });
  k.add(new THREE.BoxGeometry(0.44, 0.2, 0.02), { tone: "light", position: [0.7, roof + 0.2, 4.11] });
  for (const z of [-nose + 1.6, nose - 1.6]) {
    k.add(new THREE.BoxGeometry(1.4, 0.06, 0.3), { tone: "dark", position: [0, roof + 0.03, z] });
    for (let i = 0; i < 4; i++) lamps.beacons.push(a.lamps.add(new THREE.BoxGeometry(0.3, 0.12, 0.24), { accent: i % 2 ? "amber" : "signal", off: "pale", position: [-0.51 + i * 0.34, roof + 0.12, z] }));
  }
  // Underframe: engine/generator raft, fuel tank, battery boxes.
  k.add(new THREE.BoxGeometry(2.5, 0.22, L - 1.2), { tone: "deep", position: [0, floor - 0.28, 0] });
  k.add(new THREE.BoxGeometry(1.9, 0.62, 3.0), { tone: "dark", position: [0, floor - 0.72, -1.2] });
  k.add(louvre(1.2, 0.4, 4, 0.02, "deep", "mid"), { position: [1.0, floor - 0.72, -1.2], rotation: [0, Math.PI / 2, 0] });
  k.add(cylZ(0.34, 2.0, 12), { tone: "deep", position: [0, floor - 0.72, 2.2] });
  k.add(new THREE.BoxGeometry(1.7, 0.4, 1.0), { tone: "dark", position: [0, floor - 0.6, 4.3] });
  bogie(a, "bogieF", 5.6, "passenger");
  bogie(a, "bogieR", -5.6, "passenger");
  // Lettering: RESCUE along both sides, a large cross on the sliding doors.
  const tex = inkAtlas("machines:rescue", 1024, 256, (g) => {
    fitText(g, "RESCUE", 10, 10, 700, 110, { weight: 800 });
    fitText(g, "RAIL EMERGENCY UNIT 07", 10, 140, 1000, 90, { weight: 700, align: "left", condense: 0.9 });
    g.fillStyle = "#000";
    g.fillRect(780, 30, 200, 60);
    g.fillRect(850, 0, 60, 120);
  });
  const d = new Decals(1024, 256);
  for (const s of [-1, 1]) {
    d.add([0, 0, 720, 128], [2.2, 0.38], { position: [s * (hw + 0.012), floor + 2.08, -s * 3.0], rotation: [0, (s * Math.PI) / 2, 0] });
    d.add([0, 128, 1024, 128], [2.7, 0.2], { position: [s * (hw + 0.012), floor + 1.65, -s * 3.2], rotation: [0, (s * Math.PI) / 2, 0] });
    d.add([760, 0, 240, 128], [0.8, 0.44], { position: [s * (hw + 0.02), floor + 0.72, 0.4], rotation: [0, (s * Math.PI) / 2, 0] });
  }
  a.decals = { decals: d, texture: tex, hatch: HATCH.rail, objectId: OBJECT_ID.rail, bone: "body" };
  a.speed = b.speed;
  let alert = !wreck;
  a.onTick((_dt, t) => {
    if (wreck) return;
    const on = alert;
    lamps.beacons.forEach((id, i) => {
      const ph = (t * 1.6 + (i % 4) * 0.25) % 1;
      a.lamps.set(id, on ? (ph < 0.18 ? 1 : ph < 0.3 ? 0.35 : 0) : 0);
    });
  });
  if (wreck) for (let i = 0; i < a.lamps.size; i++) a.lamps.set(i, 0);
  const root = a.finish(bodyMaterial(HATCH.rail, OBJECT_ID.rail), { width: W, depth: L + 1.0, height: roof + 0.25 });
  root.userData.railContact = 0;
  root.userData.setAlert = (on: boolean) => {
    alert = on;
  };
  return root;
}

// ------------------------------------------------------------ freight wagon

/** A corrugated panel facing +X in the YZ plane (container walls). */
function corrugated(len: number, h: number, pitch: number, depth: number): THREE.BufferGeometry {
  const n = Math.floor(len / pitch);
  const prof: V2[] = [];
  const z0 = -len / 2;
  for (let i = 0; i < n; i++) {
    const zs = z0 + i * pitch;
    prof.push([zs + pitch * 0.05, 0], [zs + pitch * 0.15, depth], [zs + pitch * 0.55, depth], [zs + pitch * 0.65, 0]);
  }
  prof.push([z0 + n * pitch, 0]);
  const pos: number[] = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const [za, xa] = prof[i]!;
    const [zb, xb] = prof[i + 1]!;
    // Quad from (xa, 0, za)-(xb, 0, zb) up to h, facing +x.
    pos.push(xa, 0, za, xb, 0, zb, xb, h, zb, xa, 0, za, xb, h, zb, xa, h, za);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

type WagonKind = "van" | "tank" | "container";

export function buildFreightWagon(b: RailBuild & { variant?: WagonKind }): THREE.Object3D {
  const kind: WagonKind = b.variant ?? (["van", "tank", "container"] as const)[b.seed % 3]!;
  const a = new Assembly("vehicle", "freight-wagon", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "rail";
  a.mass = 7;
  a.bob = 0.002;
  a.rig.bone("body", "root", [0, 0, 0]);
  const k = a.rig.kit("body");
  const L = kind === "container" ? 14.2 : 15.4;
  const W = 2.95,
    hw = W / 2;
  const deck = 1.2;
  // Underframe: solebars, headstocks, brake gear.
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.16, 0.36, L), { tone: "deep", position: [s * (hw - 0.2), deck - 0.18, 0] });
  k.add(new THREE.BoxGeometry(W - 0.3, 0.12, L - 0.4), { tone: "dark", position: [0, deck - 0.3, 0] });
  k.add(cylZ(0.14, 1.2, 10), { tone: "deep", position: [0.4, deck - 0.55, 1.4] });
  k.add(cylZ(0.2, 0.9, 10), { tone: "deep", position: [-0.5, deck - 0.58, -1.6] });
  for (const s of [-1, 1]) {
    buffers(k, (s * L) / 2, s, "mid");
    k.add(new THREE.BoxGeometry(0.4, 0.04, 0.24), { tone: "deep", position: [hw - 0.1, 0.72, (s * L) / 2 - s * 0.6] });
  }
  if (kind === "van") {
    const top = 4.05;
    const sec: V2[] = [
      [-hw, deck],
      [hw, deck],
      [hw, top - 0.3],
      [hw * 0.72, top - 0.08],
      [0, top],
      [-hw * 0.72, top - 0.08],
      [-hw, top - 0.3],
    ];
    k.add(crossExtrude(sec, L - 0.3, 0), { tone: "light" });
    // Sliding wall panels: bold ribs, handles, locking bars.
    for (const s of [-1, 1]) {
      const ribs = 24;
      for (let i = 0; i <= ribs; i++) {
        const z = -(L - 0.5) / 2 + ((L - 0.5) * i) / ribs;
        k.add(new THREE.BoxGeometry(0.05, top - deck - 0.5, 0.1), { tone: i % 6 === 0 ? "solid" : "paper", position: [s * (hw + 0.025), (top + deck - 0.3) / 2, z] });
      }
      for (const z of [-3.6, 0, 3.6]) k.add(new THREE.BoxGeometry(0.06, 0.06, 0.4), { tone: "deep", position: [s * (hw + 0.06), deck + 1.3, z] });
      k.add(new THREE.BoxGeometry(0.04, 0.12, L - 0.4), { tone: "dark", position: [s * (hw + 0.03), top - 0.36, 0] });
      k.add(new THREE.BoxGeometry(0.04, 0.12, L - 0.4), { tone: "dark", position: [s * (hw + 0.03), deck + 0.1, 0] });
    }
  } else if (kind === "tank") {
    const r = 1.32,
      len = L - 2.2;
    const cy = deck + r + 0.12;
    k.add(cylZ(r, len, 18), { tone: "deep", position: [0, cy, 0] });
    for (const s of [-1, 1]) {
      const cap = lathe(
        [
          [r, 0],
          [r * 0.94, 0.28],
          [r * 0.7, 0.52],
          [0.001, 0.64],
        ],
        18,
      );
      cap.rotateX((s * Math.PI) / 2);
      k.add(cap, { tone: "deep", position: [0, cy, (s * len) / 2] });
      // Cradles.
      k.add(new THREE.BoxGeometry(W - 0.4, 0.5, 0.3), { tone: "dark", position: [0, deck + 0.2, s * 4.0] });
      // Ladders up the sides.
      for (const e of [-0.2, 0.2]) k.add(new THREE.BoxGeometry(0.03, 2.6, 0.03), { tone: "light", position: [s * (r + 0.1), deck + 1.3, e], rotation: [0, 0, s * -0.12] });
      for (let i = 0; i < 8; i++) k.add(new THREE.BoxGeometry(0.03, 0.03, 0.4), { tone: "light", position: [s * (r + 0.1 + (0.12 * (8 - i)) / 8 - 0.06), deck + 0.2 + i * 0.32, 0] });
      // Hazard placard on each side (hi-vis).
      k.add(new THREE.BoxGeometry(0.02, 0.36, 0.46), { tone: "paper", accent: "amber", position: [s * (r * 0.72 + 0.02), cy + 0.7, 2.2], rotation: [0, 0, s * -0.8] });
      k.add(new THREE.BoxGeometry(0.02, 0.02, 0.44), { tone: "solid", position: [s * (r * 0.72 + 0.035), cy + 0.7, 2.2], rotation: [0, 0, s * -0.8] });
    }
    // Bands, dome, walkway and handrails.
    for (const z of [-4.0, 4.0]) k.add(cylZ(r + 0.02, 0.1, 18), { tone: "solid", position: [0, cy, z] });
    k.add(cylinder(0.36, 0.4, 0.4, 16), { tone: "dark", position: [0, cy + r + 0.1, 0] });
    k.add(cylinder(0.3, 0.3, 0.08, 16), { tone: "mid", position: [0, cy + r + 0.34, 0] });
    k.add(new THREE.BoxGeometry(0.9, 0.04, 2.4), { tone: "light", position: [0, cy + r + 0.02, 0] });
    for (const s of [-1, 1]) {
      k.add(new THREE.BoxGeometry(0.03, 0.03, 2.4), { tone: "light", position: [s * 0.45, cy + r + 0.9, 0] });
      for (const z of [-1.1, 0, 1.1]) k.add(new THREE.BoxGeometry(0.03, 0.9, 0.03), { tone: "light", position: [s * 0.45, cy + r + 0.46, z] });
    }
    k.add(bar([0, cy - r - 0.05, 0], [0, deck - 0.2, 0.3], 0.07, 8), { tone: "deep" });
  } else {
    // Flat deck with twist-locks; a 40 ft corrugated container.
    k.add(new THREE.BoxGeometry(W - 0.2, 0.1, L - 0.2), { tone: "dark", position: [0, deck, 0] });
    const cL = 12.19,
      cW = 2.44,
      cH = 2.59;
    const base = deck + 0.05;
    const cz = -0.2;
    k.add(new THREE.BoxGeometry(cW - 0.06, cH - 0.1, cL - 0.12), { tone: "pale", position: [0, base + cH / 2, cz] });
    for (const s of [-1, 1]) {
      const panel = corrugated(cL - 0.4, cH - 0.22, 0.52, 0.07);
      if (s < 0) panel.rotateY(Math.PI);
      k.add(panel, { tone: "paper", position: [s * (cW / 2 - 0.03), base + 0.11, cz] });
      // Corner posts and rails.
      for (const e of [-1, 1]) k.add(new THREE.BoxGeometry(0.16, cH, 0.16), { tone: "mid", position: [s * (cW / 2 - 0.08), base + cH / 2, cz + (e * (cL - 0.16)) / 2] });
      k.add(new THREE.BoxGeometry(0.1, 0.12, cL), { tone: "mid", position: [s * (cW / 2 - 0.05), base + 0.06, cz] });
      k.add(new THREE.BoxGeometry(0.1, 0.12, cL), { tone: "mid", position: [s * (cW / 2 - 0.05), base + cH - 0.06, cz] });
    }
    // Door end (rear, facing the trolley): locking bars and cam keepers.
    const zD = cz - cL / 2 - 0.005;
    k.add(new THREE.BoxGeometry(cW - 0.3, cH - 0.3, 0.02), { tone: "light", position: [0, base + cH / 2, zD] });
    k.add(new THREE.BoxGeometry(0.02, cH - 0.3, 0.03), { tone: "deep", position: [0, base + cH / 2, zD - 0.01] });
    for (const x of [-0.95, -0.55, 0.55, 0.95]) {
      k.add(cylZ(0.022, 0.03, 6), { tone: "deep", position: [x, base + cH / 2, zD - 0.02] });
      k.add(new THREE.BoxGeometry(0.035, cH - 0.25, 0.035), { tone: "dark", position: [x, base + cH / 2, zD - 0.03] });
      k.add(new THREE.BoxGeometry(0.1, 0.05, 0.05), { tone: "deep", position: [x + 0.06, base + cH * 0.45, zD - 0.05] });
    }
    k.add(new THREE.BoxGeometry(cW, 0.14, 0.12), { tone: "mid", position: [0, base + cH - 0.07, zD + 0.05] });
    k.add(new THREE.BoxGeometry(cW, 0.14, 0.12), { tone: "mid", position: [0, base + 0.07, zD + 0.05] });
  }
  bogie(a, "bogieF", L / 2 - 2.4, "freight");
  bogie(a, "bogieR", -(L / 2 - 2.4), "freight");
  endLamps(a, -L / 2 - 0.02, -1, deck - 0.1, false);
  if (wreck) for (let i = 0; i < a.lamps.size; i++) a.lamps.set(i, 0);
  const tex = inkAtlas("machines:freight", 1024, 256, (g) => {
    fitText(g, "31 80 4697 112-6", 10, 10, 1000, 90, { weight: 700, align: "left", family: `"Courier New", Courier, monospace` });
    fitText(g, "HALDEN CARRIERS", 10, 120, 1000, 120, { weight: 800, align: "left", condense: 0.86 });
  });
  const d = new Decals(1024, 256);
  const lx = kind === "van" ? hw + 0.075 : kind === "container" ? 2.44 / 2 + 0.02 : 1.2;
  if (kind !== "tank")
    for (const s of [-1, 1]) {
      d.add([0, 128, 1024, 128], [3.2, 0.42], { position: [s * lx, deck + (kind === "van" ? 2.2 : 1.9), -s * 1.0], rotation: [0, (s * Math.PI) / 2, 0] });
    }
  for (const s of [-1, 1]) d.add([0, 0, 1024, 128], [1.4, 0.16], { position: [s * (hw - 0.1 + 0.09), deck - 0.18, s * 3.0], rotation: [0, (s * Math.PI) / 2, 0] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.rail, objectId: OBJECT_ID.rail, bone: "body" };
  a.speed = b.speed;
  const height = kind === "van" ? 4.05 : kind === "tank" ? deck + 2.9 + 0.5 : deck + 2.7;
  const root = a.finish(bodyMaterial(HATCH.rail, OBJECT_ID.rail, 0.2), { width: W, depth: L + 1.0, height });
  root.userData.railContact = 0;
  root.userData.variant = kind;
  return root;
}

// --------------------------------------------------------- catering trolley

export function buildCateringTrolley(b: RailBuild): THREE.Object3D {
  const a = new Assembly("vehicle", "catering-trolley", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "shove";
  a.mass = 0.6;
  a.bob = 0.002;
  a.rig.bone("body", "root", [0, 0, 0]);
  const k = a.rig.kit("body");
  const R = 0.18;
  const deck = 0.52;
  // Platelayer's trolley: timber deck on a steel frame, push handles.
  k.add(new THREE.BoxGeometry(1.72, 0.1, 2.2), { tone: "dark", position: [0, deck - 0.18, 0] });
  for (let i = 0; i < 9; i++) k.add(new THREE.BoxGeometry(1.8, 0.05, 0.22), { tone: i % 2 ? "light" : "pale", position: [0, deck - 0.1, -1.0 + i * 0.25] });
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.08, 0.14, 2.3), { tone: "deep", position: [s * 0.95, deck - 0.2, 0] });
    for (const z of [-0.7, 0.7]) k.add(new THREE.BoxGeometry(0.12, 0.2, 0.18), { tone: "deep", position: [s * 0.95, R + 0.02, z] });
    // Push handle hoops at each end.
    const zH = s * 1.18;
    k.add(bar([-0.7, deck - 0.1, zH], [-0.7, 1.05, zH + s * 0.08], 0.02, 6), { tone: "mid" });
    k.add(bar([0.7, deck - 0.1, zH], [0.7, 1.05, zH + s * 0.08], 0.02, 6), { tone: "mid" });
    k.add(bar([-0.7, 1.05, zH + s * 0.08], [0.7, 1.05, zH + s * 0.08], 0.022, 6), { tone: "mid" });
  }
  // The catering cart: an aluminium galley trolley with drawers and a rim.
  const cx = -0.35;
  const ch = 0.92;
  k.add(new THREE.BoxGeometry(0.42, ch, 0.82), { tone: "pale", position: [cx, deck + ch / 2, -0.2] });
  for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(0.43, 0.025, 0.8), { tone: "mid", position: [cx, deck + 0.22 + i * 0.22, -0.2] });
  k.add(new THREE.BoxGeometry(0.02, 0.1, 0.3), { tone: "light", position: [cx + 0.22, deck + 0.78, -0.2] });
  k.add(new THREE.BoxGeometry(0.46, 0.04, 0.86), { tone: "light", position: [cx, deck + ch + 0.02, -0.2] });
  for (const e of [-1, 1]) k.add(new THREE.BoxGeometry(0.46, 0.06, 0.02), { tone: "light", position: [cx, deck + ch + 0.06, -0.2 + e * 0.42] });
  // Tea urn with tap, cups stacked, a cloche over the last pie.
  const urn = lathe(
    [
      [0.001, 0],
      [0.16, 0],
      [0.17, 0.05],
      [0.17, 0.42],
      [0.14, 0.48],
      [0.06, 0.52],
      [0.03, 0.58],
      [0.001, 0.58],
    ],
    14,
  );
  k.add(urn, { tone: "light", position: [cx, deck + ch + 0.04, 0.0], scale: [1, 0.8, 1] });
  k.add(cylZ(0.015, 0.1, 6), { tone: "deep", position: [cx + 0.0, deck + ch + 0.1, 0.2] });
  for (const [x, z, n] of [
    [cx - 0.1, -0.42, 5],
    [cx + 0.1, -0.42, 4],
  ] as const)
    for (let i = 0; i < n; i++) k.add(cylinder(0.042, 0.034, 0.075, 8), { tone: i % 2 ? "pale" : "paper", position: [x, deck + ch + 0.08 + i * 0.055, z] });
  k.add(cylinder(0.2, 0.2, 0.02, 14), { tone: "light", position: [0.42, deck + 0.02, 0.35] });
  k.add(sphere(0.17, 12, 6).scale(1, 0.7, 1), { tone: "pale", position: [0.42, deck + 0.04, 0.35] });
  k.add(sphere(0.025, 6, 4), { tone: "mid", position: [0.42, deck + 0.17, 0.35] });
  // A striped awning on four posts.
  const awnY = 2.15;
  for (const [x, z] of [
    [-0.75, -0.95],
    [0.75, -0.95],
    [-0.75, 0.95],
    [0.75, 0.95],
  ] as const)
    k.add(cylinder(0.02, 0.02, awnY - deck, 6), { tone: "mid", position: [x, (awnY + deck) / 2, z] });
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    const x = -0.8 + (1.6 * (i + 0.5)) / stripes;
    const plank = new THREE.BoxGeometry(1.6 / stripes, 0.03, 2.1);
    k.add(plank, { tone: i % 2 ? "solid" : "paper", position: [x, awnY + 0.12 - Math.abs(x) * 0.15, 0], rotation: [0, 0, -Math.sign(x) * 0.15] });
    k.add(new THREE.BoxGeometry(1.6 / stripes, 0.18, 0.02), { tone: i % 2 ? "solid" : "paper", position: [x, awnY - 0.02 - Math.abs(x) * 0.15, 1.06] });
    k.add(new THREE.BoxGeometry(1.6 / stripes, 0.18, 0.02), { tone: i % 2 ? "solid" : "paper", position: [x, awnY - 0.02 - Math.abs(x) * 0.15, -1.06] });
  }
  // A hand-lettered board.
  k.add(new THREE.BoxGeometry(1.2, 0.3, 0.03), { tone: "paper", position: [0, 1.6, -1.12] });
  const tex = inkAtlas("machines:catering", 512, 128, (g) => {
    fitText(g, "REFRESHMENTS", 10, 12, 492, 104, { weight: 700, family: `Geist, "Helvetica Neue", Helvetica, Arial, sans-serif` });
  });
  const d = new Decals(512, 128);
  d.add([0, 0, 512, 128], [1.1, 0.26], { position: [0, 1.6, -1.14], rotation: [0, Math.PI, 0] });
  d.add([0, 0, 512, 128], [1.1, 0.26], { position: [0, 1.6, 1.14] });
  k.add(new THREE.BoxGeometry(1.2, 0.3, 0.03), { tone: "paper", position: [0, 1.6, 1.12] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.machine, objectId: OBJECT_ID.rail, bone: "body" };
  // Four flanged wheels on two axles.
  const ws = new Kit();
  const w = railWheelSmall(R);
  ws.add(w, { tone: "mid", position: [TREAD_X, 0, 0] });
  const wl = w.clone();
  wl.rotateY(Math.PI);
  ws.add(wl, { tone: "mid", position: [-TREAD_X, 0, 0] });
  ws.add(cylX(0.035, 1.9, 8), { tone: "dark" });
  const wsg = ws.build();
  a.wheel("axleF", "root", [0, R, 0.7], wsg, R);
  a.wheel("axleR", "root", [0, R, -0.7], wsg, R);
  if (wreck) a.rig.get("body").rotation.z = 0.3;
  a.speed = b.speed;
  const root = a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.rail), { width: 1.9, depth: 2.6, height: 2.1 });
  root.userData.railContact = 0;
  return root;
}

function railWheelSmall(r: number): THREE.BufferGeometry {
  return latheX(
    [
      [0.04, -0.05],
      [r + 0.025, -0.05],
      [r + 0.025, -0.035],
      [r, -0.025],
      [r, 0.05],
      [r * 0.5, 0.04],
      [0.001, 0.04],
    ],
    14,
  );
}
