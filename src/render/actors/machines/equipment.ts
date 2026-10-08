/**
 * Fixed machines: the server rack, the isolation cabinet, a distribution
 * transformer, a manual cord switchboard, a diesel water pump set, a parcel
 * sorter, a console terminal and the kill switch.
 *
 * Fine detail (drive bays, jack fields, dials, screens) is inked into canvas
 * atlases so the geometry stays within budget; everything that must read
 * from the cab is real geometry with a silhouette of its own.
 */
import * as THREE from "three";
import { Kit, cylinder, lathe, sphere, jitter, type Tone } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";
import {
  Decals,
  HATCH,
  OBJECT_ID,
  bar,
  bodyMaterial,
  cylX,
  cylZ,
  fitText,
  handwheel,
  hazardPlate,
  inkAtlas,
  loft,
  louvre,
  pipe,
  roundRect,
  crossExtrude,
  type Condition,
  type V2,
  type V3,
} from "./common.ts";
import { Assembly } from "./assembly.ts";

export interface MachineBuild {
  seed: number;
  rng: Rng;
  condition: Condition;
}

// ------------------------------------------------------------- server rack

const RACK_ATLAS = { w: 1024, h: 512 };
/** Rows of the rack atlas: [y, h] in pixels. */
const RACK_ROWS = {
  u1: [0, 64],
  u2: [64, 128],
  u4: [192, 128],
  sw: [320, 64],
  patch: [384, 64],
  blank: [448, 64],
} as const;

function rackAtlas(): THREE.Texture | null {
  return inkAtlas("machines:rack", RACK_ATLAS.w, RACK_ATLAS.h, (g) => {
    g.strokeStyle = "#000";
    g.fillStyle = "#000";
    const vents = (x0: number, y0: number, w: number, h: number) => {
      for (let y = y0 + 6; y < y0 + h - 4; y += 7) for (let x = x0 + 4; x < x0 + w - 4; x += 7) g.fillRect(x, y, 3, 3);
    };
    const bays = (x0: number, y0: number, w: number, h: number, n: number, rows: number) => {
      const bw = w / n,
        bh = h / rows;
      g.lineWidth = 2;
      for (let r = 0; r < rows; r++)
        for (let i = 0; i < n; i++) {
          const x = x0 + i * bw,
            y = y0 + r * bh;
          g.strokeRect(x + 2, y + 2, bw - 4, bh - 4);
          g.fillRect(x + 4, y + bh - 10, bw * 0.55, 4);
        }
    };
    // 1U server: vents, four bays, ears.
    let [y, h]: readonly [number, number] = RACK_ROWS.u1;
    g.lineWidth = 3;
    g.strokeRect(2, y + 2, 1020, h - 4);
    vents(20, y, 380, h);
    bays(420, y + 4, 520, h - 8, 4, 1);
    g.fillRect(4, y + 8, 12, h - 16);
    g.fillRect(1008, y + 8, 12, h - 16);
    // 2U server: 24 slim bays.
    [y, h] = RACK_ROWS.u2;
    g.strokeRect(2, y + 2, 1020, h - 4);
    bays(30, y + 8, 780, h - 16, 24, 1);
    vents(830, y, 170, h);
    // 4U storage: three rows of fifteen.
    [y, h] = RACK_ROWS.u4;
    g.strokeRect(2, y + 2, 1020, h - 4);
    bays(20, y + 6, 984, h - 12, 15, 3);
    // Switch: 48 ports in two rows, uplink cages.
    [y, h] = RACK_ROWS.sw;
    g.strokeRect(2, y + 2, 1020, h - 4);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) g.fillRect(40 + i * 30 + Math.floor(i / 6) * 12, y + 8 + r * 26, 22, 18);
    for (let i = 0; i < 4; i++) g.strokeRect(830 + i * 44, y + 12, 36, 40);
    // Patch panel: numbered ports.
    [y, h] = RACK_ROWS.patch;
    g.strokeRect(2, y + 2, 1020, h - 4);
    for (let i = 0; i < 24; i++) {
      g.strokeRect(40 + i * 40, y + 18, 26, 24);
      g.fillRect(44 + i * 40, y + 8, 18, 4);
    }
    // Blanking panel.
    [y, h] = RACK_ROWS.blank;
    g.strokeRect(2, y + 2, 1020, h - 4);
    vents(300, y, 420, h);
  });
}

export function buildServerRack(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "server-rack", b.condition);
  const wreck = b.condition === "wreck";
  const sealed = b.condition === "pristine";
  a.reactStyle = "topple";
  a.mass = 1.2;
  const W = 0.6,
    H = 2.0,
    D = 1.07;
  const k = a.rig.kit("root");
  // Frame: corner posts, top and plinth, side panels with vents.
  for (const x of [-W / 2 + 0.025, W / 2 - 0.025])
    for (const z of [-D / 2 + 0.025, D / 2 - 0.025]) k.add(new THREE.BoxGeometry(0.05, H - 0.06, 0.05), { tone: "deep", position: [x, H / 2, z] });
  k.add(new THREE.BoxGeometry(W, 0.06, D), { tone: "dark", position: [0, H - 0.03, 0] });
  k.add(new THREE.BoxGeometry(W - 0.02, 0.08, D - 0.02), { tone: "deep", position: [0, 0.06, 0] });
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.012, H - 0.2, D - 0.08), { tone: "pale", position: [s * (W / 2 - 0.004), H / 2, 0] });
    k.add(louvre(0.7, 0.18, 4, 0.01, "deep", "pale"), { position: [s * (W / 2 + 0.004), H - 0.3, 0], rotation: [0, (s * Math.PI) / 2, 0] });
  }
  // Roof: cable entry brush and two fan grilles.
  k.add(new THREE.BoxGeometry(0.4, 0.02, 0.12), { tone: "solid", position: [0, H + 0.002, -D / 2 + 0.2] });
  for (const z of [0.05, 0.3]) k.add(cylinder(0.09, 0.09, 0.012, 12), { tone: "mid", position: [0, H + 0.004, z] });
  // Casters and levelling feet.
  for (const x of [-W / 2 + 0.07, W / 2 - 0.07])
    for (const z of [-D / 2 + 0.08, D / 2 - 0.08]) {
      k.add(cylinder(0.025, 0.025, 0.04, 8), { tone: "deep", position: [x, 0.02, z] });
    }
  // Mounting rails.
  for (const x of [-0.235, 0.235]) k.add(new THREE.BoxGeometry(0.02, H - 0.2, 0.03), { tone: "dark", position: [x, H / 2, D / 2 - 0.09] });
  // Units, seeded: a UPS at the bottom, storage, servers, switch and patch panel on top.
  const units: Array<keyof typeof RACK_ROWS> = [];
  const r = b.rng.fork("rack");
  let used = 0;
  const push = (u: keyof typeof RACK_ROWS, n: number) => {
    units.push(u);
    used += n;
  };
  push("patch", 1);
  push("sw", 1);
  push("blank", 1);
  while (used < 36) {
    const pick = r.next();
    if (pick < 0.4) push("u1", 1);
    else if (pick < 0.75) push("u2", 2);
    else if (used < 30) push("u4", 4);
    else push("u1", 1);
  }
  const uH = 0.0445;
  const decals = new Decals(RACK_ATLAS.w, RACK_ATLAS.h);
  const lampIds: Array<{ id: number; kind: "activity" | "heartbeat" | "steady"; phase: number; rate: number }> = [];
  let y = H - 0.14;
  const front = D / 2 - 0.1;
  const sizes: Record<keyof typeof RACK_ROWS, number> = { u1: 1, u2: 2, u4: 4, sw: 1, patch: 1, blank: 1 };
  for (const u of units) {
    const n = sizes[u];
    const h = n * uH;
    y -= h;
    if (y < 0.34) break;
    const tone: Tone = u === "blank" ? "mid" : u === "patch" ? "dark" : u === "sw" ? "deep" : "light";
    k.add(new THREE.BoxGeometry(0.44, h - 0.003, 0.8), { tone, position: [0, y + h / 2, front - 0.4 + (wreck && r.chance(0.3) ? 0.12 : 0)] });
    const [ry, rh] = RACK_ROWS[u];
    decals.add([0, ry, 1024, rh], [0.44, h - 0.004], { position: [0, y + h / 2, front + 0.002] });
    // Status lamps at the right-hand ear.
    if (u !== "blank" && u !== "patch") {
      const count = u === "sw" ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const lx = u === "sw" ? -0.16 + i * 0.1 : 0.19 - i * 0.03;
        const id = a.lamps.add(new THREE.BoxGeometry(0.016, Math.min(0.018, h * 0.4), 0.006), {
          accent: "cyan",
          off: "mid",
          position: [lx, y + h * (u === "sw" ? 0.78 : 0.5), front + 0.006],
        });
        lampIds.push({ id, kind: r.chance(0.55) ? "activity" : r.chance(0.5) ? "heartbeat" : "steady", phase: r.next() * 10, rate: r.range(2.5, 9) });
      }
    }
  }
  // UPS at the base with a status window.
  k.add(new THREE.BoxGeometry(0.44, 0.2, 0.8), { tone: "dark", position: [0, 0.22, front - 0.4] });
  k.add(new THREE.BoxGeometry(0.12, 0.05, 0.01), { tone: "solid", position: [0.1, 0.26, front + 0.004] });
  const ups = a.lamps.add(new THREE.BoxGeometry(0.1, 0.035, 0.006), { accent: "cyan", off: "deep", level: 1, position: [0.1, 0.26, front + 0.01] });
  lampIds.push({ id: ups, kind: "steady", phase: 0, rate: 1 });
  // A vertical status strip on the front post: the rack's light at distance.
  const strip = a.lamps.add(new THREE.BoxGeometry(0.022, H - 0.5, 0.01), { accent: "cyan", off: "dark", level: 1, position: [W / 2 - 0.03, H / 2 + 0.05, D / 2 + 0.004] });
  // Patch cords sweeping from the switch to the cable manager.
  const swY = H - 0.14 - uH * 1.5;
  for (let i = 0; i < 5; i++) {
    const x0 = -0.16 + i * 0.06;
    k.add(
      pipe(
        [
          [x0, swY, front + 0.01],
          [x0 + 0.02, swY - 0.08 - i * 0.02, front + 0.08],
          [-0.24, swY - 0.2 - i * 0.03, front + 0.05],
          [-0.27, swY - 0.4 - i * 0.04, front - 0.02],
        ],
        0.006,
        8,
        4,
      ),
      { tone: "deep" },
    );
  }
  // Pristine: a perforated door closes the rack; ruin: door hangs open, broken.
  if (sealed) {
    k.add(new THREE.BoxGeometry(W - 0.04, H - 0.12, 0.02), { tone: "light", position: [0, H / 2, D / 2 + 0.012] });
    k.add(new THREE.BoxGeometry(0.03, 0.2, 0.04), { tone: "deep", position: [-W / 2 + 0.06, H / 2, D / 2 + 0.03] });
  } else if (wreck) {
    const door = new THREE.BoxGeometry(W - 0.04, H - 0.12, 0.02);
    door.translate((W - 0.04) / 2, 0, 0);
    door.rotateY(-1.9);
    k.add(door, { tone: "light", position: [-W / 2, H / 2 - 0.05, D / 2 + 0.02] });
  }
  a.decals = { decals, texture: rackAtlas(), hatch: HATCH.fine, objectId: OBJECT_ID.machine, bone: "root" };
  a.onTick((_dt, t) => {
    if (wreck) {
      for (const l of lampIds) a.lamps.set(l.id, 0);
      a.lamps.set(strip, Math.sin(t * 0.7) > 0.96 ? 0.4 : 0);
      return;
    }
    for (const l of lampIds) {
      let v = 1;
      if (l.kind === "activity") {
        const q = Math.floor(t * l.rate + l.phase);
        v = (Math.sin(q * 12.9898 + l.phase * 78.233) * 43758.5453) % 1 > 0.1 ? 1 : 0.1;
        v = Math.abs(v);
      } else if (l.kind === "heartbeat") v = (t * 0.8 + l.phase) % 1 < 0.12 ? 1 : 0.25;
      a.lamps.set(l.id, v);
    }
    // Synchronized in the pristine world: every rack breathes together.
    a.lamps.set(strip, sealed ? 0.55 + 0.45 * Math.sin(t * 1.2) : 1);
  });
  return a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: W, depth: D, height: H });
}

// -------------------------------------------------------- isolation cabinet

export function buildIsolationCabinet(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "isolation-cabinet", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "none";
  a.mass = 6;
  const W = 1.3,
    H = 2.1,
    D = 0.72,
    plinth = 0.22;
  const k = a.rig.kit("root");
  // Concrete plinth; the cabinet with a rolled top edge and a drip hood.
  k.add(new THREE.BoxGeometry(W + 0.5, plinth, D + 0.5), { tone: "pale", position: [0, plinth / 2, 0] });
  const body = crossExtrude(roundRect(0, 0, W, D, 0.03, 2), H, 0);
  body.rotateX(-Math.PI / 2);
  k.add(body, { tone: "paper", position: [0, plinth + H / 2, 0] });
  const hood = loft([
    { z: -D / 2 - 0.05, pts: [[-W / 2 - 0.05, 0], [W / 2 + 0.05, 0], [W / 2 + 0.05, 0.04], [-W / 2 - 0.05, 0.04]] },
    { z: D / 2 + 0.08, pts: [[-W / 2 - 0.05, -0.04], [W / 2 + 0.05, -0.04], [W / 2 + 0.05, 0.0], [-W / 2 - 0.05, 0.0]] },
  ]);
  k.add(hood, { tone: "light", position: [0, plinth + H + 0.01, 0] });
  // Door: recessed panel, gasket line, three barrel hinges, a 3-point T handle with padlock hasp.
  const zF = D / 2;
  k.add(new THREE.BoxGeometry(W - 0.08, H - 0.1, 0.012), { tone: "paper", position: [0, plinth + H / 2, zF + 0.006] });
  for (const [w, h, x, y] of [
    [W - 0.06, 0.018, 0, plinth + H - 0.04],
    [W - 0.06, 0.018, 0, plinth + 0.04],
    [0.018, H - 0.08, -W / 2 + 0.04, plinth + H / 2],
    [0.018, H - 0.08, W / 2 - 0.04, plinth + H / 2],
  ] as const)
    k.add(new THREE.BoxGeometry(w, h, 0.01), { tone: "solid", position: [x, y, zF + 0.01] });
  k.add(new THREE.BoxGeometry(W - 0.34, H - 0.5, 0.012), { tone: "pale", position: [0, plinth + H / 2 + 0.06, zF + 0.013] });
  for (const y of [0.35, H / 2, H - 0.35]) k.add(cylinder(0.025, 0.025, 0.16, 8), { tone: "mid", position: [-W / 2 + 0.03, plinth + y, zF + 0.02] });
  k.add(new THREE.BoxGeometry(0.08, 0.22, 0.03), { tone: "dark", position: [W / 2 - 0.14, plinth + 1.1, zF + 0.025] });
  k.add(new THREE.BoxGeometry(0.2, 0.04, 0.06), { tone: "deep", position: [W / 2 - 0.14, plinth + 1.06, zF + 0.06] });
  k.add(new THREE.TorusGeometry(0.03, 0.008, 4, 10), { tone: "deep", position: [W / 2 - 0.14, plinth + 0.95, zF + 0.05] });
  k.add(new THREE.BoxGeometry(0.06, 0.07, 0.03), { tone: "solid", position: [W / 2 - 0.14, plinth + 0.9, zF + 0.05] });
  // Louvres low on both sides, lifting eyes on top, earth bar.
  for (const s of [-1, 1]) k.add(louvre(0.4, 0.2, 4, 0.01, "deep", "paper"), { position: [s * (W / 2 + 0.006), plinth + 0.3, 0], rotation: [0, (s * Math.PI) / 2, 0] });
  for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) k.add(new THREE.TorusGeometry(0.04, 0.012, 4, 10), { tone: "dark", position: [x, plinth + H + 0.08, 0] });
  k.add(new THREE.BoxGeometry(0.3, 0.03, 0.03), { tone: "mid", position: [0, plinth + 0.06, zF + 0.03] });
  // The one cable: armoured trunk entering a heavy gland on the back and
  // sweeping down into the ground behind.
  const gy = plinth + 0.5;
  k.add(cylZ(0.13, 0.18, 12), { tone: "dark", position: [0.25, gy, -D / 2 - 0.08] });
  k.add(cylZ(0.16, 0.05, 12), { tone: "mid", position: [0.25, gy, -D / 2 - 0.02] });
  const cablePath: V3[] = [
    [0.25, gy, -D / 2 - 0.12],
    [0.27, gy - 0.05, -D / 2 - 0.55],
    [0.3, 0.3, -D / 2 - 1.15],
    [0.32, 0.05, -D / 2 - 1.6],
    [0.33, -0.3, -D / 2 - 2.0],
  ];
  k.add(pipe(cablePath, 0.075, 28, 10), { tone: "deep" });
  // Cleats pinning the cable where it leaves the plinth.
  for (const t of [0.3, 0.6]) {
    const p = new THREE.CatmullRomCurve3(cablePath.map((v) => new THREE.Vector3(...v))).getPoint(t);
    k.add(new THREE.TorusGeometry(0.085, 0.015, 4, 12), { tone: "mid", position: [p.x, p.y, p.z], rotation: [0.4, 0, 0] });
  }
  // Side isolator: a rotary handle in a shroud on the right-hand face.
  a.rig.bone("handle", "root", [W / 2 + 0.07, plinth + 1.15, 0.05]);
  k.add(new THREE.BoxGeometry(0.1, 0.34, 0.34), { tone: "light", position: [W / 2 + 0.05, plinth + 1.15, 0.05] });
  k.add(cylX(0.12, 0.04, 16), { tone: "pale", position: [W / 2 + 0.11, plinth + 1.15, 0.05] });
  const hk = a.rig.kit("handle");
  hk.add(cylX(0.05, 0.08, 10), { tone: "deep", position: [0.08, 0, 0] });
  hk.add(new THREE.BoxGeometry(0.06, 0.3, 0.07), { tone: "solid", position: [0.12, 0.1, 0] });
  hk.add(new THREE.BoxGeometry(0.07, 0.08, 0.08), { tone: "solid", position: [0.12, 0.25, 0] });
  // Positions marked I / O on the shroud: inked decal.
  const tex = inkAtlas("machines:isolation", 512, 512, (g) => {
    g.fillStyle = "#000";
    // Warning triangle with lightning.
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(128, 20);
    g.lineTo(236, 210);
    g.lineTo(20, 210);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(140, 60);
    g.lineTo(100, 140);
    g.lineTo(132, 140);
    g.lineTo(112, 196);
    g.lineTo(160, 118);
    g.lineTo(128, 118);
    g.closePath();
    g.fill();
    fitText(g, "ISOLATION", 260, 20, 240, 70, { weight: 800 });
    fitText(g, "POINT 07", 260, 100, 240, 60, { weight: 700 });
    fitText(g, "SOLE TRUNK — AUTHORISED", 260, 170, 240, 36, { weight: 600 });
    fitText(g, "PERSONS ONLY", 260, 206, 240, 36, { weight: 600 });
    fitText(g, "I", 20, 280, 100, 100, { weight: 800 });
    fitText(g, "O", 140, 280, 100, 100, { weight: 800 });
    fitText(g, "LIVE", 280, 290, 200, 80, { weight: 800 });
  });
  const d = new Decals(512, 512);
  d.add([0, 0, 256, 230], [0.3, 0.27], { position: [-0.22, plinth + 1.72, zF + 0.022] });
  d.add([256, 0, 256, 250], [0.36, 0.34], { position: [0.16, plinth + 1.7, zF + 0.022] });
  d.add([0, 270, 120, 120], [0.07, 0.07], { position: [W / 2 + 0.132, plinth + 1.32, 0.05], rotation: [0, Math.PI / 2, 0] });
  d.add([130, 270, 120, 120], [0.07, 0.07], { position: [W / 2 + 0.132, plinth + 1.15, -0.14], rotation: [0, Math.PI / 2, 0] });
  d.add([270, 280, 220, 100], [0.14, 0.065], { position: [W / 2 - 0.14, plinth + 1.36, zF + 0.022] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.machine, objectId: OBJECT_ID.machine, bone: "root" };
  // LIVE lamp: signal red while the trunk is energised.
  k.add(cylZ(0.05, 0.04, 12), { tone: "deep", position: [W / 2 - 0.14, plinth + 1.26, zF + 0.02] });
  const live = a.lamps.add(cylZ(0.038, 0.03, 12), { accent: "signal", off: "mid", level: wreck ? 0 : 1, position: [W / 2 - 0.14, plinth + 1.26, zF + 0.04] });
  if (wreck) k.add(new THREE.BoxGeometry(0.02, 0.9, 0.3), { tone: "solid", position: [0.1, plinth + 0.9, zF + 0.02], rotation: [0, 0, 0.3] });
  let target = 0;
  let pos = 0;
  const handleBone = a.rig.get("handle");
  a.onTick((dt, t) => {
    pos += Math.max(-dt * 0.9, Math.min(dt * 0.9, target - pos));
    handleBone.rotation.x = -pos * (Math.PI / 2);
    // Energised: steady; isolating: flickers out; isolated: dark.
    const lit = wreck ? 0 : pos < 0.05 ? 1 : pos > 0.95 ? 0 : Math.sin(t * 40) > 0 ? 0.8 : 0.1;
    a.lamps.set(live, lit);
  });
  const root = a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: W + 0.5, depth: D + 2.6, height: plinth + H + 0.1 });
  /** 0 = energised (handle at I), 1 = isolated (handle at O). */
  root.userData.setHandle = (v: number) => {
    target = Math.max(0, Math.min(1, v));
  };
  /** Where the trunk leaves this asset, in local metres (continue it from here). */
  root.userData.cableExit = cablePath[cablePath.length - 1];
  return root;
}

// ------------------------------------------------------------- transformer

/** A porcelain bushing: a stack of sheds (zig-zag lathe) with a terminal cap. */
function bushing(h: number, r: number, sheds: number): THREE.BufferGeometry {
  const prof: V2[] = [[0.001, 0]];
  prof.push([r * 1.3, 0], [r * 1.3, 0.04]);
  for (let i = 0; i < sheds; i++) {
    const y = 0.06 + (i * (h - 0.12)) / sheds;
    prof.push([r, y], [r * 1.9, y + 0.02], [r, y + (h - 0.12) / sheds]);
  }
  prof.push([r * 0.6, h], [r * 0.6, h + 0.05], [0.001, h + 0.05]);
  return lathe(prof, 10);
}

export function buildTransformer(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "transformer", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "none";
  a.mass = 10;
  const W = 1.7,
    H = 1.5,
    D = 1.0,
    base = 0.22;
  const k = a.rig.kit("root");
  // Skid, tank with a bolted cover flange.
  for (const x of [-0.6, 0.6]) k.add(new THREE.BoxGeometry(0.16, base, D + 0.3), { tone: "deep", position: [x, base / 2, 0] });
  k.add(new THREE.BoxGeometry(W, H, D), { tone: "light", position: [0, base + H / 2, 0] });
  k.add(new THREE.BoxGeometry(W + 0.08, 0.06, D + 0.08), { tone: "mid", position: [0, base + H + 0.03, 0] });
  for (let i = 0; i < 10; i++) for (const z of [-1, 1]) k.add(new THREE.BoxGeometry(0.03, 0.03, 0.03), { tone: "deep", position: [-W / 2 + 0.08 + i * ((W - 0.16) / 9), base + H + 0.07, z * (D / 2 + 0.02)] });
  // Radiator banks: deep vertical fins down both long sides.
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(W - 0.2, 0.08, 0.1), { tone: "mid", position: [0, base + H - 0.12, s * (D / 2 + 0.05)] });
    k.add(new THREE.BoxGeometry(W - 0.2, 0.08, 0.1), { tone: "mid", position: [0, base + 0.2, s * (D / 2 + 0.05)] });
    const fins = 12;
    for (let i = 0; i < fins; i++) {
      const x = -W / 2 + 0.16 + (i * (W - 0.32)) / (fins - 1);
      k.add(new THREE.BoxGeometry(0.035, H - 0.2, 0.32), { tone: "paper", position: [x, base + H / 2 + 0.02, s * (D / 2 + 0.2)] });
    }
  }
  // HV bushings (three tall), LV bushings (four short), conservator, Buchholz pipe.
  for (let i = 0; i < 3; i++) k.add(bushing(0.62, 0.05, 6), { tone: "pale", position: [-0.45 + i * 0.45, base + H + 0.06, -0.2] });
  for (let i = 0; i < 4; i++) k.add(bushing(0.28, 0.035, 3), { tone: "pale", position: [-0.45 + i * 0.3, base + H + 0.06, 0.28] });
  k.add(cylX(0.22, 1.1, 16), { tone: "light", position: [0.1, base + H + 0.62, -0.62] });
  for (const x of [-0.35, 0.55]) k.add(cylX(0.225, 0.04, 16), { tone: "mid", position: [x, base + H + 0.62, -0.62] });
  for (const x of [-0.3, 0.5]) k.add(bar([x, base + H + 0.05, -0.45], [x, base + H + 0.45, -0.62], 0.03, 5), { tone: "dark" });
  k.add(pipe([[0.1, base + H + 0.4, -0.62], [0.12, base + H + 0.25, -0.5], [0.15, base + H + 0.06, -0.35]], 0.03, 8, 6), { tone: "dark" });
  k.add(new THREE.BoxGeometry(0.12, 0.1, 0.1), { tone: "deep", position: [0.13, base + H + 0.2, -0.46] });
  k.add(cylX(0.06, 0.04, 12), { tone: "paper", position: [0.67, base + H + 0.62, -0.62] });
  // Lifting lugs, drain valve, earthing boss, rating plate.
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) for (const z of [-D / 2, D / 2]) k.add(new THREE.BoxGeometry(0.06, 0.14, 0.04), { tone: "mid", position: [x, base + H + 0.1, z] });
  k.add(cylX(0.04, 0.12, 8), { tone: "deep", position: [W / 2 + 0.06, base + 0.15, 0.2] });
  k.add(new THREE.BoxGeometry(0.3, 0.2, 0.01), { tone: "pale", position: [0.4, base + 0.8, D / 2 + 0.006] });
  const tex = inkAtlas("machines:transformer", 512, 256, (g) => {
    g.lineWidth = 10;
    g.strokeStyle = "#000";
    g.beginPath();
    g.moveTo(128, 16);
    g.lineTo(238, 220);
    g.lineTo(18, 220);
    g.closePath();
    g.stroke();
    g.fillStyle = "#000";
    g.beginPath();
    g.moveTo(140, 60);
    g.lineTo(100, 150);
    g.lineTo(132, 150);
    g.lineTo(112, 206);
    g.lineTo(160, 124);
    g.lineTo(128, 124);
    g.closePath();
    g.fill();
    fitText(g, "DANGER", 262, 20, 236, 70, { weight: 800 });
    fitText(g, "11 000 VOLTS", 262, 100, 236, 50, { weight: 700 });
    fitText(g, "1000 kVA  11/0.415 kV", 262, 170, 236, 34, { weight: 600 });
  });
  const d = new Decals(512, 256);
  d.add([0, 0, 256, 236], [0.3, 0.28], { position: [-0.45, base + 0.95, D / 2 + 0.004] });
  d.add([256, 0, 256, 236], [0.3, 0.28], { position: [0.4, base + 0.8, D / 2 + 0.012] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.machine, objectId: OBJECT_ID.machine, bone: "root" };
  if (wreck) {
    // Burnt: a scorch over the tank, a cracked bushing.
    k.add(jitter(sphere(0.5, 8, 6), 0.1, b.seed), { tone: "solid", position: [0.3, base + H * 0.7, D / 2 - 0.35], scale: [1.2, 0.8, 0.8] });
  }
  return a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: W + 0.2, depth: D + 0.7, height: base + H + 0.9 });
}

// -------------------------------------------------------------- switchboard

function switchboardAtlas(): THREE.Texture | null {
  return inkAtlas("machines:switchboard", 1024, 512, (g) => {
    g.fillStyle = "#000";
    g.strokeStyle = "#000";
    // Jack field: 10 strips of 20 jacks, each strip with a designation label and lamp caps.
    for (let r = 0; r < 10; r++) {
      const y = 16 + r * 48;
      g.lineWidth = 2;
      g.strokeRect(8, y - 6, 1008, 44);
      for (let i = 0; i < 20; i++) {
        const x = 30 + i * 49;
        g.beginPath();
        g.arc(x, y + 8, 7, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(x, y + 26, 5, 0, Math.PI * 2);
        g.lineWidth = 3;
        g.stroke();
        g.font = "600 9px monospace";
        g.fillText(String(r * 20 + i + 1), x - 8, y + 38);
      }
    }
  });
}

export function buildSwitchboard(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "switchboard", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 2;
  const W = 1.6,
    D = 0.78;
  const wood: Tone = "light";
  const k = a.rig.kit("root");
  // Lower cabinet with fielded panels and kick plate.
  k.add(new THREE.BoxGeometry(W, 0.74, D - 0.1), { tone: wood, position: [0, 0.37, -0.05] });
  k.add(new THREE.BoxGeometry(W - 0.04, 0.06, 0.04), { tone: "dark", position: [0, 0.03, D / 2 - 0.1] });
  for (const x of [-0.52, 0, 0.52]) {
    k.add(new THREE.BoxGeometry(0.44, 0.5, 0.02), { tone: "pale", position: [x, 0.38, D / 2 - 0.14] });
    k.add(new THREE.BoxGeometry(0.36, 0.42, 0.02), { tone: wood, position: [x, 0.38, D / 2 - 0.13] });
  }
  // Keyshelf: slanted desk with plugs standing in two rows and key switches.
  k.add(new THREE.BoxGeometry(W + 0.04, 0.05, 0.5), { tone: "pale", position: [0, 0.77, 0.12], rotation: [0.08, 0, 0] });
  const plugs = 16;
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < plugs; i++) {
      const x = -0.66 + (i * 1.32) / (plugs - 1);
      const z = -0.02 + r * 0.1;
      k.add(cylinder(0.012, 0.016, 0.1, 6), { tone: "deep", position: [x, 0.84 - r * 0.008, z] });
    }
  for (let i = 0; i < plugs; i++) k.add(new THREE.BoxGeometry(0.018, 0.035, 0.03), { tone: "solid", position: [-0.66 + (i * 1.32) / (plugs - 1), 0.815, 0.26] });
  // Upright panel: jack field (decal), lamp strip, cornice.
  const py0 = 0.82,
    py1 = 1.86;
  k.add(new THREE.BoxGeometry(W, py1 - py0, 0.34), { tone: wood, position: [0, (py0 + py1) / 2, -0.24] });
  k.add(new THREE.BoxGeometry(W - 0.14, py1 - py0 - 0.12, 0.012), { tone: "pale", position: [0, (py0 + py1) / 2 + 0.02, -0.066] });
  k.add(new THREE.BoxGeometry(W + 0.08, 0.08, 0.44), { tone: "mid", position: [0, py1 + 0.04, -0.22] });
  k.add(new THREE.BoxGeometry(W + 0.12, 0.04, 0.48), { tone: wood, position: [0, py1 + 0.1, -0.22] });
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.06, py1 - py0 + 0.06, 0.4), { tone: "mid", position: [s * (W / 2 + 0.01), (py0 + py1) / 2, -0.22] });
  // Patch cords: plugs pulled up into the jack field, drooping.
  const r = b.rng.fork("cords");
  const cords = wreck ? 3 : 7;
  for (let i = 0; i < cords; i++) {
    const x0 = -0.62 + r.next() * 1.24;
    const x1 = -0.66 + r.next() * 1.32;
    const y1 = py0 + 0.1 + r.next() * 0.85;
    const sag = 0.18 + r.next() * 0.2;
    k.add(
      pipe(
        [
          [x0, 0.84, -0.02],
          [x0 + (x1 - x0) * 0.3, 0.92 + (y1 - 0.9) * 0.2 - sag * 0.2, 0.04],
          [x0 + (x1 - x0) * 0.7, y1 - sag * 0.6, 0.0],
          [x1, y1, -0.055],
        ],
        0.008,
        10,
        4,
      ),
      { tone: "solid" },
    );
    k.add(cylZ(0.014, 0.06, 6), { tone: "deep", position: [x1, y1, -0.04] });
  }
  // Headset on a hook; the operator's chair pushed back.
  k.add(new THREE.BoxGeometry(0.03, 0.03, 0.08), { tone: "deep", position: [W / 2 + 0.04, 1.5, -0.1] });
  k.add(new THREE.TorusGeometry(0.09, 0.01, 4, 12, Math.PI), { tone: "deep", position: [W / 2 + 0.06, 1.38, -0.06], rotation: [0, Math.PI / 2, 0] });
  k.add(cylX(0.035, 0.03, 10), { tone: "solid", position: [W / 2 + 0.07, 1.3, -0.14] });
  k.add(cylZ(0.03, 0.12, 8, 0.012), { tone: "deep", position: [W / 2 + 0.07, 1.27, 0.0], rotation: [0.6, 0, 0] });
  const cz = 0.95;
  k.add(cylinder(0.2, 0.2, 0.04, 14), { tone: "mid", position: [0.2, 0.62, cz] });
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    k.add(bar([0.2 + Math.cos(ang) * 0.12, 0.6, cz + Math.sin(ang) * 0.12], [0.2 + Math.cos(ang) * 0.24, 0.0, cz + Math.sin(ang) * 0.24], 0.015, 5), { tone: "dark" });
  }
  k.add(new THREE.BoxGeometry(0.34, 0.26, 0.03), { tone: "mid", position: [0.2, 0.92, cz + 0.2], rotation: [-0.12, 0, 0] });
  k.add(bar([0.2, 0.62, cz + 0.18], [0.2, 0.84, cz + 0.2], 0.015, 5), { tone: "dark" });
  if (wreck) k.add(new THREE.BoxGeometry(0.5, 0.02, 0.4), { tone: "solid", position: [-0.4, py1 + 0.15, -0.2], rotation: [0, 0.3, 0.2] });
  const d = new Decals(1024, 512);
  d.add([0, 0, 1024, 490], [W - 0.18, py1 - py0 - 0.16], { position: [0, (py0 + py1) / 2 + 0.02, -0.058] });
  a.decals = { decals: d, texture: switchboardAtlas(), hatch: HATCH.fine, objectId: OBJECT_ID.machine, bone: "root" };
  // Call lamps: a few supervisory lamps glowing amber in the jack field.
  const lamps: number[] = [];
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + r.next() * 1.2;
    const y = py0 + 0.18 + r.next() * 0.7;
    lamps.push(a.lamps.add(cylZ(0.014, 0.01, 8), { accent: "amber", off: "light", position: [x, y, -0.05] }));
  }
  a.onTick((_dt, t) => {
    lamps.forEach((id, i) => {
      if (wreck) return a.lamps.set(id, 0);
      const ph = (t * (0.5 + i * 0.13) + i * 0.37) % 1;
      a.lamps.set(id, i === 0 ? 1 : ph < 0.5 ? 1 : 0);
    });
  });
  return a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine, 0.3), { width: W + 0.2, depth: D + 1.0, height: py1 + 0.14 });
}

// ------------------------------------------------------------------- pump

/** A spoked flywheel facing +X. */
function flywheel(r: number, w: number, spokes: number): THREE.BufferGeometry {
  const k = new Kit();
  k.add(
    lathe(
      [
        [r * 0.82, -w / 2],
        [r, -w / 2],
        [r, w / 2],
        [r * 0.82, w / 2],
        [r * 0.82, -w / 2],
      ],
      20,
    ),
    { tone: "dark", rotation: [0, 0, -Math.PI / 2] },
  );
  for (let i = 0; i < spokes; i++) {
    const g = new THREE.BoxGeometry(w * 0.5, r * 0.8, w * 0.6);
    g.translate(0, r * 0.45, 0);
    k.add(g, { tone: "mid", rotation: [(i / spokes) * Math.PI * 2, 0, 0] });
  }
  k.add(cylX(r * 0.16, w * 1.2, 10), { tone: "deep" });
  k.add(new THREE.BoxGeometry(w * 0.52, r * 0.12, r * 0.12), { tone: "paper", position: [w * 0.02, r * 0.91, 0] });
  return k.build();
}

export function buildPump(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "pump", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "shove";
  a.mass = 4;
  a.bob = 0;
  a.rig.bone("body", "root", [0, 0, 0]);
  const k = a.rig.kit("body");
  // Skid: two channels with cross members.
  for (const x of [-0.42, 0.42]) k.add(new THREE.BoxGeometry(0.1, 0.14, 2.3), { tone: "deep", position: [x, 0.07, 0] });
  for (const z of [-1.0, 0, 1.0]) k.add(new THREE.BoxGeometry(0.94, 0.06, 0.1), { tone: "dark", position: [0, 0.14, z] });
  // Engine: crankcase, finned barrel, head, hopper; exhaust with silencer.
  const ez = -0.35;
  k.add(new THREE.BoxGeometry(0.5, 0.42, 0.6), { tone: "mid", position: [0, 0.38, ez] });
  k.add(lathe((() => {
    const p: V2[] = [[0.001, 0]];
    for (let i = 0; i < 7; i++) p.push([0.17, i * 0.06], [0.2, i * 0.06 + 0.02], [0.17, i * 0.06 + 0.04]);
    p.push([0.16, 0.44], [0.001, 0.44]);
    return p;
  })(), 12), { tone: "light", position: [0, 0.58, ez] });
  k.add(new THREE.BoxGeometry(0.34, 0.14, 0.34), { tone: "mid", position: [0, 1.08, ez] });
  k.add(cylinder(0.16, 0.13, 0.22, 12), { tone: "pale", position: [0, 1.26, ez] });
  k.add(pipe([[0.12, 1.06, ez - 0.1], [0.3, 1.1, ez - 0.2], [0.34, 1.4, ez - 0.2]], 0.03, 8, 6), { tone: "deep" });
  k.add(cylinder(0.07, 0.07, 0.3, 10), { tone: "dark", position: [0.34, 1.55, ez - 0.2] });
  k.add(new THREE.BoxGeometry(0.1, 0.02, 0.1), { tone: "deep", position: [0.34, 1.72, ez - 0.18], rotation: [0.4, 0, 0] });
  // Fuel tank on its stand.
  k.add(cylX(0.13, 0.5, 12), { tone: "light", position: [0, 1.05, ez - 0.55] });
  for (const x of [-0.18, 0.18]) k.add(bar([x, 0.14, ez - 0.55], [x, 0.93, ez - 0.55], 0.02, 5), { tone: "dark" });
  k.add(pipe([[0.1, 0.95, ez - 0.5], [0.12, 0.8, ez - 0.3], [0.1, 0.7, ez - 0.1]], 0.008, 8, 4), { tone: "deep" });
  // Pump: volute casing, suction and discharge, gate valve, gauge.
  const pz = 0.72;
  k.add(cylX(0.28, 0.2, 18), { tone: "light", position: [0, 0.48, pz] });
  k.add(cylX(0.3, 0.05, 18), { tone: "mid", position: [0.11, 0.48, pz] });
  k.add(new THREE.BoxGeometry(0.2, 0.26, 0.26), { tone: "light", position: [0, 0.6, pz + 0.22] });
  k.add(pipe([[0, 0.72, pz + 0.3], [0, 1.0, pz + 0.3], [0, 1.2, pz + 0.3]], 0.07, 6, 10), { tone: "light" });
  k.add(cylinder(0.11, 0.11, 0.2, 12), { tone: "mid", position: [0, 1.26, pz + 0.3] });
  k.add(handwheel(0.14, 0.012, 4), { tone: "dark", position: [0, 1.5, pz + 0.3], rotation: [Math.PI / 2, 0, 0] });
  k.add(cylinder(0.012, 0.012, 0.18, 5), { tone: "deep", position: [0, 1.4, pz + 0.3] });
  k.add(pipe([[0, 1.3, pz + 0.3], [0, 1.4, pz + 0.55], [0.05, 1.2, pz + 0.95], [0.1, 0.12, pz + 1.3]], 0.06, 16, 8), { tone: "deep" });
  k.add(cylZ(0.07, 0.03, 12), { tone: "paper", position: [0.16, 1.05, pz + 0.3], rotation: [0, Math.PI / 2, 0] });
  k.add(cylX(0.075, 0.03, 12), { tone: "mid", position: [0.14, 1.05, pz + 0.3] });
  // Suction hose to the ground and away.
  k.add(pipe([[-0.14, 0.48, pz], [-0.4, 0.4, pz - 0.05], [-0.7, 0.12, pz - 0.2], [-1.4, 0.08, pz - 0.6], [-2.2, 0.08, pz - 0.5]], 0.08, 24, 8), { tone: "deep" });
  for (let i = 0; i < 6; i++) k.add(new THREE.TorusGeometry(0.085, 0.012, 4, 10), { tone: "mid", position: [-0.9 - i * 0.22, 0.09, pz - 0.35 - i * 0.04], rotation: [0, Math.PI / 2 - 0.3, 0] });
  // Belt guard (open frame) between the engine pulley and the pump pulley.
  k.add(new THREE.BoxGeometry(0.03, 0.22, 1.2), { tone: "deep", position: [-0.36, 0.55, 0.2] });
  // Flywheels and pulleys: rolling bones.
  const fw = flywheel(0.38, 0.08, 6);
  a.rig.bone("flyR", "body", [0.34, 0.5, ez]);
  a.rig.kit("flyR").add(fw);
  a.rig.bone("flyL", "body", [-0.34, 0.5, ez]);
  a.rig.kit("flyL").add(fw, { rotation: [0, Math.PI, 0] });
  a.rig.bone("pulley", "body", [-0.36, 0.48, pz]);
  a.rig.kit("pulley").add(flywheel(0.12, 0.06, 4));
  // The belt: two straight runs, tangent to the flywheel (L) and the pulley.
  const beltA: V3 = [-0.38, 0.5 + 0.38, ez],
    beltB: V3 = [-0.38, 0.48 + 0.12, pz];
  const beltC: V3 = [-0.38, 0.5 - 0.38, ez],
    beltD: V3 = [-0.38, 0.48 - 0.12, pz];
  k.add(bar(beltA, beltB, 0.012, 4), { tone: "solid" });
  k.add(bar(beltC, beltD, 0.012, 4), { tone: "solid" });
  const tex = inkAtlas("machines:pump-gauge", 256, 256, (g) => {
    g.lineWidth = 8;
    g.strokeStyle = "#000";
    g.beginPath();
    g.arc(128, 128, 110, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 5;
    for (let i = 0; i <= 10; i++) {
      const ang = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(128 + Math.cos(ang) * 92, 128 + Math.sin(ang) * 92);
      g.lineTo(128 + Math.cos(ang) * 76, 128 + Math.sin(ang) * 76);
      g.stroke();
    }
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(128, 128);
    g.lineTo(128 + Math.cos(-0.6) * 80, 128 + Math.sin(-0.6) * 80);
    g.stroke();
    fitText(g, "bar", 96, 160, 64, 32, { weight: 600 });
  });
  const d = new Decals(256, 256);
  d.add([0, 0, 256, 256], [0.12, 0.12], { position: [0.19, 1.05, pz + 0.3], rotation: [0, Math.PI / 2, 0] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.fine, objectId: OBJECT_ID.machine, bone: "body" };
  let running = !wreck;
  let spin = 0;
  const body = a.rig.get("body");
  a.onTick((dt, t) => {
    if (!running) return;
    spin += dt * 6.5;
    a.rig.get("flyR").rotation.x = spin;
    a.rig.get("flyL").rotation.x = spin;
    a.rig.get("pulley").rotation.x = spin * (0.38 / 0.12);
    // A slow single-cylinder thump shakes the set.
    const thump = Math.max(0, Math.sin(spin)) ** 6;
    body.position.y = thump * 0.004;
    body.rotation.z = Math.sin(t * 31) * 0.0015 * thump;
  });
  const root = a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: 1.2, depth: 2.4, height: 1.75 });
  root.userData.setRunning = (on: boolean) => {
    running = on && !wreck;
  };
  return root;
}

// ------------------------------------------------------------------ sorter

export function buildSorter(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "sorter", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "shove";
  a.mass = 3;
  a.bob = 0;
  const k = a.rig.kit("root");
  // Conveyor along X: side frames, legs, end rollers, belt.
  const Lc = 3.6,
    bw = 0.72,
    top = 0.86;
  for (const s of [-1, 1]) {
    k.add(new THREE.BoxGeometry(Lc, 0.14, 0.05), { tone: "mid", position: [0, top - 0.04, s * (bw / 2 + 0.03)] });
    for (const x of [-1.5, 0, 1.5]) k.add(new THREE.BoxGeometry(0.06, top - 0.1, 0.06), { tone: "dark", position: [x, (top - 0.1) / 2, s * (bw / 2 + 0.02)] });
  }
  for (const x of [-1.5, 0, 1.5]) k.add(new THREE.BoxGeometry(0.05, 0.05, bw), { tone: "dark", position: [x, 0.25, 0] });
  k.add(new THREE.BoxGeometry(Lc - 0.1, 0.03, bw - 0.02), { tone: "deep", position: [0, top - 0.015, 0] });
  for (const x of [-Lc / 2 + 0.05, Lc / 2 - 0.05]) k.add(cylZ(0.06, bw, 12), { tone: "light", position: [x, top - 0.05, 0] });
  // Scanning arch with a light curtain and a camera looking down.
  const ax = -0.6;
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.12, 1.2, 0.12), { tone: "light", position: [ax, top + 0.6, s * (bw / 2 + 0.12)] });
  k.add(new THREE.BoxGeometry(0.3, 0.2, bw + 0.36), { tone: "paper", position: [ax, top + 1.25, 0] });
  k.add(new THREE.BoxGeometry(0.16, 0.12, 0.16), { tone: "dark", position: [ax, top + 1.09, 0] });
  k.add(cylinder(0.04, 0.04, 0.03, 10), { tone: "solid", position: [ax, top + 1.02, 0] });
  const curtain: number[] = [];
  for (let i = 0; i < 8; i++) curtain.push(a.lamps.add(new THREE.BoxGeometry(0.02, 0.05, 0.01), { accent: "cyan", off: "mid", position: [ax + 0.065, top + 0.12 + i * 0.12, bw / 2 + 0.1] }));
  // Diverter paddle (bone) and the chute into a roll cage.
  a.rig.bone("paddle", "root", [0.7, top + 0.1, -bw / 2 - 0.05]);
  a.rig.kit("paddle").add(new THREE.BoxGeometry(0.05, 0.22, 0.7), { tone: "pale", position: [0, 0.08, 0.35] });
  a.rig.kit("paddle").add(cylinder(0.05, 0.05, 0.3, 10), { tone: "dark", position: [0, 0, 0] });
  const chute = new THREE.BoxGeometry(0.8, 0.03, 1.0);
  chute.rotateX(-0.35);
  k.add(chute, { tone: "pale", position: [0.8, top - 0.2, bw / 2 + 0.5] });
  for (const e of [-1, 1]) {
    const side = new THREE.BoxGeometry(0.03, 0.16, 1.0);
    side.rotateX(-0.35);
    k.add(side, { tone: "light", position: [0.8 + e * 0.4, top - 0.12, bw / 2 + 0.5] });
  }
  // Roll cage: a mesh cage drawn with bars.
  const cx = 0.8,
    cz = bw / 2 + 1.45;
  for (const [x, z] of [
    [-0.35, -0.3],
    [0.35, -0.3],
    [-0.35, 0.3],
    [0.35, 0.3],
  ] as const)
    k.add(new THREE.BoxGeometry(0.03, 1.3, 0.03), { tone: "dark", position: [cx + x, 0.65, cz + z] });
  for (let i = 0; i < 6; i++) {
    const y = 0.12 + i * 0.22;
    for (const z of [-0.3, 0.3]) k.add(new THREE.BoxGeometry(0.7, 0.012, 0.012), { tone: "dark", position: [cx, y, cz + z] });
    for (const x of [-0.35, 0.35]) k.add(new THREE.BoxGeometry(0.012, 0.012, 0.6), { tone: "dark", position: [cx + x, y, cz] });
  }
  for (const [x, y, z, w, h, dd, ry] of [
    [-0.12, 0.2, -0.05, 0.4, 0.26, 0.3, 0.2],
    [0.14, 0.2, 0.08, 0.34, 0.22, 0.34, -0.3],
    [0.02, 0.44, 0.0, 0.3, 0.2, 0.28, 0.5],
  ] as const)
    k.add(new THREE.BoxGeometry(w, h, dd), { tone: "pale", position: [cx + x, y, cz + z], rotation: [0, ry, 0] });
  // The display on its pole.
  const dy = 2.55,
    dz = -0.9;
  k.add(cylinder(0.05, 0.06, dy - 0.3, 8), { tone: "dark", position: [-1.2, (dy - 0.3) / 2, dz] });
  k.add(new THREE.BoxGeometry(0.4, 0.04, 0.4), { tone: "deep", position: [-1.2, 0.02, dz] });
  k.add(new THREE.BoxGeometry(1.72, 1.0, 0.12), { tone: "dark", position: [-1.2, dy, dz] });
  k.add(new THREE.BoxGeometry(1.62, 0.9, 0.02), { tone: "solid", position: [-1.2, dy, dz + 0.06] });
  // Parcels ride their own bones along the belt.
  const r = b.rng.fork("parcels");
  const parcels: Array<{ bone: THREE.Bone; x: number; y: number }> = [];
  const decals = new Decals(1024, 512);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const w = r.range(0.34, 0.5),
      h = r.range(0.2, 0.34),
      dd = r.range(0.26, 0.4);
    const x0 = -Lc / 2 + 0.3 + (i * (Lc - 0.6)) / n;
    const y0 = top;
    const name = `parcel${i}`;
    const bone = a.rig.bone(name, "root", [x0, y0, r.range(-0.06, 0.06)]);
    const pk = a.rig.kit(name);
    pk.add(new THREE.BoxGeometry(w, h, dd), { tone: "pale", position: [0, h / 2, 0], rotation: [0, r.range(-0.12, 0.12), 0] });
    pk.add(new THREE.BoxGeometry(0.06, 0.004, dd + 0.004), { tone: "mid", position: [0, h + 0.002, 0] });
    const rest = a.rig.restOf(name);
    decals.add([0, 256, 512, 256], [Math.min(w, dd) * 0.7, Math.min(w, dd) * 0.35], { position: [rest.x, rest.y + h + 0.006, rest.z], rotation: [-Math.PI / 2, 0, 0] }, false, name);
    parcels.push({ bone, x: x0, y: y0 });
  }
  // Display text and parcel labels.
  const tex = inkAtlas("machines:sorter", 1024, 512, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 1024, 256);
    fitText(g, "CLASS: BOOKS", 40, 10, 944, 50, { color: "#fff", weight: 600, align: "left", family: `"Courier New", Courier, monospace` });
    fitText(g, "100%", 40, 58, 944, 128, { color: "#fff", weight: 800 });
    fitText(g, "CONFIDENCE", 40, 188, 944, 60, { color: "#fff", weight: 700 });
    g.fillStyle = "#fff";
    g.fillRect(0, 256, 512, 256);
    g.lineWidth = 10;
    g.strokeStyle = "#000";
    g.strokeRect(8, 264, 496, 240);
    fitText(g, "BOOKS", 24, 290, 464, 150, { weight: 800 });
    for (let i = 0; i < 30; i++) g.fillRect(40 + i * 14, 450, i % 3 ? 4 : 8, 40);
  });
  decals.add([0, 0, 1024, 256], [1.56, 0.39], { position: [-1.2, dy, dz + 0.072] }, false, "root");
  a.decals = { decals, texture: tex, hatch: HATCH.machine, objectId: OBJECT_ID.machine, bone: "root" };
  const paddle = a.rig.get("paddle");
  let run = !wreck;
  a.onTick((dt, t) => {
    if (!run) return;
    for (const p of parcels) {
      p.x += dt * 0.45;
      if (p.x > Lc / 2 - 0.25) p.x -= Lc - 0.5;
      p.bone.position.x = p.x;
      // Parcels drop onto the belt at the start, lift off at the end.
      const edge = Math.min(p.x + Lc / 2 - 0.25, Lc / 2 - 0.25 - p.x);
      p.bone.position.y = p.y + (edge < 0.1 ? (0.1 - edge) * 0.3 : 0);
    }
    const cyc = (t * 0.4) % 1;
    paddle.rotation.y = cyc > 0.8 ? -Math.sin(((cyc - 0.8) / 0.2) * Math.PI) * 0.7 : 0;
    curtain.forEach((id, i) => a.lamps.set(id, (Math.floor(t * 6) + i) % 8 === 0 ? 0.3 : 1));
  });
  if (wreck) curtain.forEach((id) => a.lamps.set(id, 0));
  const root = a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: 4.0, depth: 3.0, height: dy + 0.5 });
  root.userData.setRunning = (on: boolean) => {
    run = on && !wreck;
  };
  return root;
}

// ---------------------------------------------------------------- terminal

export function buildTerminal(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "terminal", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 1.5;
  const k = a.rig.kit("root");
  // Control console: pedestal, sloped control panel, writing surface.
  const W = 1.5;
  const desk = loft([
    { z: -0.35, pts: [[-W / 2, 0], [W / 2, 0], [W / 2, 1.08], [-W / 2, 1.08]] },
    { z: 0.05, pts: [[-W / 2, 0], [W / 2, 0], [W / 2, 0.96], [-W / 2, 0.96]] },
    { z: 0.35, pts: [[-W / 2, 0.08], [W / 2, 0.08], [W / 2, 0.76], [-W / 2, 0.76]] },
  ]);
  k.add(desk, { tone: "paper" });
  k.add(new THREE.BoxGeometry(W - 0.04, 0.1, 0.05), { tone: "dark", position: [0, 0.05, 0.36] });
  k.add(new THREE.BoxGeometry(W + 0.04, 0.035, 0.3), { tone: "light", position: [0, 0.77, 0.5] });
  // Button field on the slope (tiny squares; a few lamp-lit).
  const slope = new THREE.Vector3(0, 0.96 - 0.76, 0.05 - 0.35).normalize();
  const slopeRot = Math.atan2(-slope.z, slope.y) - Math.PI / 2;
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 10; i++) {
      const tt = 0.2 + r * 0.25;
      const y = 0.76 + (0.96 - 0.76) * tt,
        z = 0.35 + (0.05 - 0.35) * tt;
      k.add(new THREE.BoxGeometry(0.05, 0.035, 0.02), { tone: (i + r) % 4 ? "light" : "deep", position: [-0.62 + i * 0.07, y + 0.012, z + 0.01], rotation: [slopeRot, 0, 0] });
    }
  // Keyboard, mouse, phone.
  k.add(new THREE.BoxGeometry(0.46, 0.025, 0.16), { tone: "light", position: [-0.05, 0.8, 0.52], rotation: [0.06, 0, 0] });
  for (let i = 0; i < 4; i++) k.add(new THREE.BoxGeometry(0.42, 0.006, 0.02), { tone: "mid", position: [-0.05, 0.815, 0.46 + i * 0.035] });
  k.add(sphere(0.03, 8, 6), { tone: "pale", position: [0.3, 0.8, 0.52], scale: [1, 0.5, 1.4] });
  k.add(new THREE.BoxGeometry(0.2, 0.06, 0.18), { tone: "dark", position: [0.55, 0.82, 0.48] });
  k.add(new THREE.BoxGeometry(0.2, 0.04, 0.05), { tone: "deep", position: [0.55, 0.87, 0.42] });
  // Two monitors on a column; a status beacon.
  k.add(cylinder(0.03, 0.03, 0.34, 8), { tone: "dark", position: [0, 1.25, -0.2] });
  const screens: Array<{ x: number; ry: number }> = [
    { x: -0.34, ry: 0.18 },
    { x: 0.34, ry: -0.18 },
  ];
  for (const s of screens) {
    k.add(new THREE.BoxGeometry(0.62, 0.4, 0.05), { tone: "deep", position: [s.x, 1.44, -0.14], rotation: [0, s.ry, 0] });
    k.add(new THREE.BoxGeometry(0.58, 0.36, 0.01), { tone: "solid", position: [s.x + Math.sin(s.ry) * 0.03, 1.44, -0.14 + Math.cos(s.ry) * 0.03], rotation: [0, s.ry, 0] });
  }
  k.add(cylinder(0.035, 0.04, 0.05, 10), { tone: "deep", position: [0.66, 1.1, -0.28] });
  // Chair, pushed back and turned: the absence of an operator.
  const cz = 1.15,
    cxp = 0.15;
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    k.add(bar([cxp, 0.08, cz], [cxp + Math.cos(ang) * 0.3, 0.05, cz + Math.sin(ang) * 0.3], 0.018, 4), { tone: "deep" });
    k.add(sphere(0.03, 6, 4), { tone: "deep", position: [cxp + Math.cos(ang) * 0.3, 0.03, cz + Math.sin(ang) * 0.3] });
  }
  k.add(cylinder(0.025, 0.025, 0.36, 8), { tone: "mid", position: [cxp, 0.28, cz] });
  k.add(new THREE.BoxGeometry(0.48, 0.08, 0.46), { tone: "dark", position: [cxp, 0.5, cz] });
  k.add(new THREE.BoxGeometry(0.44, 0.5, 0.06), { tone: "dark", position: [cxp - 0.05, 0.84, cz + 0.24], rotation: [-0.12, 0.35, 0] });
  // Screen text (decal) and a blinking cursor.
  const tex = inkAtlas("machines:terminal", 1024, 512, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 1024, 512);
    const mono = `"Courier New", Courier, monospace`;
    const lines = ["DISPATCH 4471  ROUTE B", "INSTRUCTION RECEIVED", "PRIORITY: CONTINUITY", "", "> AWAITING CONFIRMATION"];
    lines.forEach((l, i) => fitText(g, l, 20, 20 + i * 44, 480, 36, { color: "#fff", weight: 700, align: "left", family: mono }));
    const right = ["NODE   STATUS", "N-01   NOMINAL", "N-02   NOMINAL", "N-03   NOMINAL", "N-04   ISOLATED"];
    right.forEach((l, i) => fitText(g, l, 532, 20 + i * 44, 480, 36, { color: "#fff", weight: 700, align: "left", family: mono }));
    g.strokeStyle = "#fff";
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 40; i++) g.lineTo(532 + i * 12, 440 - Math.abs(Math.sin(i * 0.7)) * 50 - (i > 30 ? 30 : 0));
    g.stroke();
  });
  const d = new Decals(1024, 512);
  screens.forEach((s, i) => {
    d.add([i * 512, 0, 512, 512], [0.56, 0.34], { position: [s.x + Math.sin(s.ry) * 0.037, 1.44, -0.14 + Math.cos(s.ry) * 0.037], rotation: [0, s.ry, 0] });
  });
  a.decals = { decals: d, texture: tex, hatch: HATCH.fine, objectId: OBJECT_ID.machine, bone: "root" };
  const ls = screens[0]!;
  const cursor = a.lamps.add(new THREE.BoxGeometry(0.018, 0.028, 0.004), {
    off: "solid",
    on: "paper",
    position: [ls.x - 0.02 + Math.sin(ls.ry) * 0.04, 1.44 - 0.12, -0.14 + Math.cos(ls.ry) * 0.04 + 0.02],
    rotation: [0, ls.ry, 0],
  });
  const status = a.lamps.add(cylinder(0.03, 0.035, 0.04, 10), { accent: "cyan", off: "mid", position: [0.66, 1.15, -0.28] });
  a.onTick((_dt, t) => {
    if (wreck) {
      a.lamps.set(cursor, 0);
      a.lamps.set(status, 0);
      return;
    }
    a.lamps.set(cursor, t % 1.06 < 0.53 ? 1 : 0);
    a.lamps.set(status, 0.6 + 0.4 * Math.sin(t * 2));
  });
  return a.finish(bodyMaterial(HATCH.machine, OBJECT_ID.machine), { width: W + 0.1, depth: 1.9, height: 1.7 });
}

// ------------------------------------------------------------- kill switch

export function buildKillSwitch(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "kill-switch", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 1;
  const k = a.rig.kit("root");
  // Base plate with anchor bolts; ink hazard bands around the foot of the post.
  k.add(new THREE.BoxGeometry(0.46, 0.035, 0.46), { tone: "mid", position: [0, 0.018, 0] });
  for (const x of [-0.17, 0.17]) for (const z of [-0.17, 0.17]) k.add(cylinder(0.02, 0.02, 0.05, 6), { tone: "deep", position: [x, 0.045, z] });
  const post = 0.96,
    pw = 0.14;
  k.add(new THREE.BoxGeometry(pw, post, pw), { tone: "paper", position: [0, post / 2, 0] });
  for (let i = 0; i < 4; i++) {
    const g = hazardPlate(pw + 0.004, 0.3, 3, null, 0.004);
    g.translate(0, 0, pw / 2 + 0.001);
    k.add(g, { position: [0, 0.2, 0], rotation: [0, (i * Math.PI) / 2, 0] });
  }
  // The station: a sloped-face enclosure with a drip lip.
  const bw = 0.46,
    bd = 0.4,
    hBack = 0.38,
    hFront = 0.18;
  const box = loft([
    { z: -bd / 2, pts: [[-bw / 2, 0], [bw / 2, 0], [bw / 2, hBack], [-bw / 2, hBack]] },
    { z: bd / 2, pts: [[-bw / 2, 0], [bw / 2, 0], [bw / 2, hFront], [-bw / 2, hFront]] },
  ]);
  k.add(box, { tone: "paper", position: [0, post, 0] });
  k.add(new THREE.BoxGeometry(bw + 0.03, 0.02, 0.04), { tone: "light", position: [0, post + hBack + 0.01, -bd / 2 - 0.005] });
  // Face centre and its outward normal.
  const tilt = Math.atan2(hBack - hFront, bd);
  const face = new THREE.Vector3(0, post + (hBack + hFront) / 2, 0.0);
  const up = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
  a.rig.bone("button", "root", [face.x, face.y, face.z]);
  a.rig.get("button").rotation.x = tilt;
  // Legend plate, guard collar (outside light, inside dark).
  k.add(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 32), { tone: "paper", position: [face.x, face.y + 0.004, face.z], rotation: [tilt, 0, 0] });
  const collarAt = face.clone().addScaledVector(up, 0.03);
  k.add(new THREE.CylinderGeometry(0.125, 0.125, 0.06, 28, 1, true), { tone: "light", position: [collarAt.x, collarAt.y, collarAt.z], rotation: [tilt, 0, 0] });
  k.add(new THREE.CylinderGeometry(0.121, 0.121, 0.06, 28, 1, true).scale(-1, 1, 1), { tone: "deep", position: [collarAt.x, collarAt.y, collarAt.z], rotation: [tilt, 0, 0] });
  // The mushroom head: the one red it earns.
  const bk = a.rig.kit("button");
  bk.add(cylinder(0.04, 0.04, 0.07, 12), { tone: "deep", position: [0, 0.035, 0] });
  const head = lathe(
    [
      [0.001, 0.06],
      [0.098, 0.06],
      [0.108, 0.08],
      [0.102, 0.105],
      [0.07, 0.128],
      [0.001, 0.136],
    ],
    24,
  );
  bk.add(head, { tone: "paper", accent: "signal" });
  // Key switch and label plate on the front skirt.
  k.add(cylZ(0.024, 0.02, 10), { tone: "light", position: [0.12, post + 0.08, bd / 2 + 0.01] });
  k.add(new THREE.BoxGeometry(0.008, 0.026, 0.008), { tone: "deep", position: [0.12, post + 0.08, bd / 2 + 0.022] });
  const tex = inkAtlas("machines:estop", 512, 512, (g) => {
    g.fillStyle = "#000";
    g.font = `800 40px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const text = "EMERGENCY STOP \u2022 EMERGENCY STOP \u2022 ";
    const cx = 256,
      cy = 214,
      rr = 176;
    let ang = -Math.PI / 2;
    for (const ch of text) {
      const w = g.measureText(ch).width;
      const da = w / rr;
      g.save();
      g.translate(cx + Math.cos(ang + da / 2) * rr, cy + Math.sin(ang + da / 2) * rr);
      g.rotate(ang + da / 2 + Math.PI / 2);
      g.fillText(ch, -w / 2, 0);
      g.restore();
      ang += da;
    }
    fitText(g, "STATION 1", 0, 440, 512, 60, { weight: 700 });
  });
  const d = new Decals(512, 512);
  const legendAt = face.clone().addScaledVector(up, 0.011);
  d.add([40, 0, 432, 430], [0.4, 0.4], { position: [legendAt.x, legendAt.y, legendAt.z], rotation: [tilt - Math.PI / 2, 0, 0] });
  d.add([0, 430, 512, 80], [0.2, 0.032], { position: [-0.04, post + 0.08, bd / 2 + 0.002] });
  a.decals = { decals: d, texture: tex, hatch: HATCH.fine, objectId: OBJECT_ID.machine, bone: "root" };
  let pressed = wreck ? 1 : 0;
  let p = pressed;
  const btn = a.rig.get("button");
  const rest = btn.position.clone();
  a.onTick((dt) => {
    p += Math.max(-dt * 6, Math.min(dt * 6, pressed - p));
    btn.position.copy(rest).addScaledVector(up, -0.03 * p);
  });
  const root = a.finish(bodyMaterial(HATCH.fine, OBJECT_ID.machine), { width: 0.46, depth: 0.46, height: post + hBack + 0.1 });
  /** Press (or release) the mushroom head; it latches down. */
  root.userData.press = (on = true) => {
    pressed = on ? 1 : 0;
  };
  return root;
}
