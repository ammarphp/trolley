/**
 * Railway furniture: the colour-light junction signal (with route feathers),
 * a bent-rail buffer stop and a two-lever ground frame with point rodding.
 *
 * The signal's lamps are separate meshes so an aspect can be switched without
 * rebuilding: `userData.setAspect('red' | 'amber' | 'green' | 'dark')` and
 * `userData.setRoute('left' | 'right' | null)` for the junction indicator.
 * The ground frame's levers pivot: `userData.setLever(index, -1..1)`.
 */
import * as THREE from "three";
import { Kit, cylinder } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";
import type { AccentName } from "../core/palette.ts";
import { Assembly, GAUGE, OBJECT_ID, beam, cblock, cbox, hoop, plate, ring, rod, rodY, roundRect, slab, tracksideMaterial, turned } from "./common.ts";
import { frame, inkTexture, printPlane, text, SANS } from "./print.ts";
import type { Built } from "./types.ts";

export type SignalAspect = "red" | "amber" | "green" | "dark";
export type RouteIndication = "left" | "right" | null;

const LAMP_ID = OBJECT_ID.lamp;

function litMaterial(accent: AccentName): THREE.Material {
  return inkMaterial({ tone: 0, flat: true, accent, accentAmount: 1, hatchSpace: "world", hatch: 0.03, objectId: LAMP_ID, edge: 0.6 });
}
function glowMaterial(accent: AccentName): THREE.Material {
  return inkMaterial({ tone: 0, flat: true, accent, accentAmount: 0.85, hatchSpace: "world", hatch: 0.03, objectId: LAMP_ID + 0.01, edge: 0, opacity: 0.38 });
}
function whiteLitMaterial(): THREE.Material {
  return inkMaterial({ tone: 0, flat: true, hatchSpace: "world", hatch: 0.03, objectId: LAMP_ID, edge: 0.7 });
}
function darkLensMaterial(): THREE.Material {
  return inkMaterial({ tone: "deep", hatchSpace: "world", hatch: 0.025, objectId: LAMP_ID, edge: 0.6, shade: 0.4 });
}
function unlitFeatherMaterial(): THREE.Material {
  return inkMaterial({ tone: "solid", hatchSpace: "world", hatch: 0.025, objectId: LAMP_ID, edge: 0.8 });
}

// ------------------------------------------------------------------ colour-light signal

export interface SignalOptions {
  aspect?: SignalAspect;
  route?: RouteIndication;
  /** Show the junction route indicator (feathers). Default true. */
  feathers?: boolean;
  /** Signal plate text, e.g. "JX 14". */
  plate?: string;
}

export function buildSignalPart(o: SignalOptions = {}): Built {
  const a = new Assembly(tracksideMaterial(0.05), "signal");
  // Concrete base, flange, mast.
  a.add(cblock(0.8, 0.32, 0.8, 0.03), { tone: "pale" });
  for (const [x, z] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ] as const)
    a.add(cylinder(0.018, 0.018, 0.05, 6), { tone: "dark", position: [x, 0.345, z] });
  a.add(cylinder(0.2, 0.2, 0.025, 16), { tone: "mid", position: [0, 0.33, 0] });
  const mastTop = 3.55;
  a.add(rodY(0.09, 0.33, mastTop, 14, 0.08), { tone: "light" });
  // Ladder behind the mast, stand-offs, safety hoops.
  const lz = -0.34;
  for (const s of [-1, 1]) a.add(rod([s * 0.2, 0.32, lz], [s * 0.2, mastTop + 1.0, lz], 0.018, 6), { tone: "light" });
  for (let y = 0.6; y < mastTop + 0.9; y += 0.3) a.add(rod([-0.2, y, lz], [0.2, y, lz], 0.012, 5), { tone: "light" });
  for (const y of [1.2, 2.4, mastTop - 0.1]) a.add(beam([0, y, -0.08], [0, y, lz], 0.05, 0.02), { tone: "mid" });
  for (const y of [2.6, 3.1]) {
    const h = hoop(0.36, 0.01, 4, 18, Math.PI);
    h.rotateX(Math.PI / 2);
    h.rotateZ(0);
    a.add(h, { tone: "light", position: [0, y, lz], rotation: [0, Math.PI, 0] });
  }
  // Working platform with handrail.
  const py = mastTop;
  a.add(slab(1.0, 0.04, 0.7), { tone: "mid", position: [0, py - 0.04, -0.2] });
  for (let i = 0; i < 9; i++) a.add(slab(0.012, 0.012, 0.68), { tone: "dark", position: [-0.45 + i * 0.1125, py, -0.2] });
  // Low guard rail along the back edge of the platform only, so nothing
  // frames the head from the driver's side.
  for (const s of [-1, 0, 1]) a.add(rod([s * 0.48, py, -0.54], [s * 0.48, py + 0.75, -0.54], 0.014, 5), { tone: "light" });
  a.add(rod([-0.48, py + 0.75, -0.54], [0.48, py + 0.75, -0.54], 0.014, 5), { tone: "light" });
  a.add(rod([-0.48, py + 0.38, -0.54], [0.48, py + 0.38, -0.54], 0.011, 5), { tone: "light" });
  // The head: housing and a backboard with a white sighting border.
  const hy = py + 0.1; // bottom of head
  const BW = 0.64,
    BH = 1.38;
  const cy = hy + BH / 2;
  a.add(cbox(0.4, BH - 0.18, 0.3, 0.03), { tone: "deep", position: [0, cy, -0.05] });
  a.add(plate(roundRect(BW, BH, 0.16, 4), 0.025, 0.004), { tone: "solid", position: [0, cy, 0.11] });
  a.add(plate(roundRect(BW, BH, 0.16, 4), 0.012, 0, [roundRect(BW - 0.07, BH - 0.07, 0.13, 4)]), { tone: "paper", position: [0, cy, 0.128] });
  a.add(rod([0, py, -0.05], [0, hy + 0.12, -0.05], 0.06, 10), { tone: "mid" });
  // Lamps: hoods and rims in the body; lenses separate.
  const lampY = [cy + 0.38, cy, cy - 0.38];
  const lampNames: SignalAspect[] = ["green", "amber", "red"];
  const lensR = 0.1;
  for (const y of lampY) {
    const hood = turned(
      [
        [lensR + 0.035, 0],
        [lensR + 0.035, 0.24],
        [lensR + 0.028, 0.24],
        [lensR + 0.028, 0.0],
      ],
      16,
      0.7,
      Math.PI * 1.25,
      -Math.PI * 0.625,
    );
    hood.rotateX(Math.PI / 2);
    hood.rotateZ(Math.PI);
    a.add(hood, { tone: "solid", position: [0, y, 0.12] });
    a.add(ring(lensR + 0.012, 0.012, 4, 18).rotateX(Math.PI / 2), { tone: "deep", position: [0, y, 0.14] });
  }
  const lensGeo = new THREE.CircleGeometry(lensR, 20);
  const lenses = lampY.map((y) => {
    const m = new THREE.Mesh(lensGeo, darkLensMaterial());
    m.position.set(0, y, 0.142);
    m.name = "signal:lens";
    a.attach(m);
    return m;
  });
  const glowGeo = new THREE.RingGeometry(lensR * 1.05, lensR * 2.1, 24, 1);
  const glow = new THREE.Mesh(glowGeo, glowMaterial("signal"));
  glow.name = "signal:glow";
  glow.visible = false;
  a.attach(glow);
  // Route indicator: two feathers of five white lamps, up-left and up-right.
  const featherMeshes: Record<"left" | "right", THREE.Mesh> = {} as Record<"left" | "right", THREE.Mesh>;
  if (o.feathers !== false) {
    const fy = cy + BH / 2 + 0.05;
    for (const side of [-1, 1] as const) {
      const ang = side * (Math.PI / 4);
      const dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang), 0);
      const L = 0.82;
      const start = new THREE.Vector3(side * 0.14, fy, 0.05);
      const end = start.clone().addScaledVector(dir, L);
      a.add(beam([start.x, start.y, 0.05], [end.x, end.y, 0.05], 0.16, 0.07, [0, 0, 1]), { tone: "solid" });
      a.add(beam([start.x, start.y - 0.08, -0.02], [start.x, start.y + 0.02, -0.02], 0.12, 0.08, [0, 0, 1]), { tone: "deep" });
      const k = new Kit();
      for (let i = 0; i < 5; i++) {
        const p = start.clone().addScaledVector(dir, 0.12 + i * 0.165);
        const disc = new THREE.CircleGeometry(0.046, 12);
        disc.translate(p.x, p.y, 0.088);
        k.add(disc, { tone: "paper" });
      }
      const fm = new THREE.Mesh(k.build(), unlitFeatherMaterial());
      fm.name = `signal:feather:${side < 0 ? "left" : "right"}`;
      a.attach(fm);
      featherMeshes[side < 0 ? "left" : "right"] = fm;
    }
  }
  // Signal identification plate on the mast.
  const id = (o.plate ?? "JX 14").toUpperCase().slice(0, 8);
  const tex = inkTexture(`sigplate:${id}`, 256, 176, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 4, 4, w - 8, h - 8, 8);
    text(g, id, w / 2, h / 2, h * 0.36, { family: SANS, weight: "bold", maxW: w * 0.84 });
  });
  a.add(cbox(0.3, 0.21, 0.02, 0.004), { tone: "dark", position: [0, 2.3, 0.1] });
  a.attach(printPlane(tex, 0.28, 0.19, [0, 2.3, 0.1115], "front", { hatchSpace: "world", hatch: 0.03 }));
  // Signal post telephone.
  a.add(cbox(0.24, 0.32, 0.16, 0.02), { tone: "pale", position: [0.2, 1.45, 0.02] });
  a.add(cbox(0.06, 0.12, 0.03, 0.01), { tone: "deep", position: [0.2, 1.45, 0.11] });
  const obj = a.build();
  const accentOf: Record<Exclude<SignalAspect, "dark">, AccentName> = { red: "signal", amber: "amber", green: "leaf" };
  const setAspect = (aspect: SignalAspect) => {
    lenses.forEach((m, i) => {
      const name = lampNames[i]!;
      m.material = aspect !== "dark" && name === aspect ? litMaterial(accentOf[aspect]) : darkLensMaterial();
    });
    if (aspect === "dark") glow.visible = false;
    else {
      const i = lampNames.indexOf(aspect);
      glow.visible = true;
      glow.material = glowMaterial(accentOf[aspect]);
      glow.position.set(0, lampY[i]!, 0.2);
    }
    obj.userData.aspect = aspect;
  };
  const setRoute = (route: RouteIndication) => {
    for (const side of ["left", "right"] as const) {
      const m = featherMeshes[side];
      if (m) m.material = route === side ? whiteLitMaterial() : unlitFeatherMaterial();
    }
    obj.userData.route = route;
  };
  setAspect(o.aspect ?? "red");
  setRoute(o.route ?? null);
  obj.userData.setAspect = setAspect;
  obj.userData.setRoute = setRoute;
  return { object: obj, footprint: { width: 1.9, depth: 0.9, height: cy + BH / 2 + 0.8 }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ buffer stop

export function buildBufferStopPart(): Built {
  const a = new Assembly(tracksideMaterial(0.05), "buffer-stop");
  // Origin: rail-top plane at the centre of the track; faces the approaching train (+Z).
  const rx = GAUGE / 2;
  const beamY = 1.02;
  for (const s of [-1, 1]) {
    const x = s * rx;
    // Bent-rail frame: upright, raking strut, lower brace, rail clamps.
    a.add(beam([x, -0.02, 0.0], [x, beamY + 0.2, 0.02], 0.07, 0.15, [0, 0, 1]), { tone: "deep" });
    a.add(beam([x, beamY + 0.15, -0.02], [x, -0.02, -2.1], 0.07, 0.15, [0, 1, 0]), { tone: "deep" });
    a.add(beam([x, 0.35, -0.02], [x, 0.05, -1.1], 0.06, 0.12, [0, 1, 0]), { tone: "deep" });
    for (const z of [0.0, -1.1, -2.1]) a.add(cblock(0.22, 0.1, 0.16, 0.01), { tone: "dark", position: [x, -0.04, z] });
    a.add(cylinder(0.03, 0.03, 0.2, 8), { tone: "dark", position: [x, beamY + 0.12, -0.03], rotation: [0, 0, Math.PI / 2] });
  }
  // Timber headstock with warning chevrons.
  const HW = 2.5,
    HH = 0.4,
    HD = 0.3;
  a.add(cbox(HW, HH, HD, 0.015), { tone: "paper", position: [0, beamY, 0.17] });
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x0 = -HW / 2 + 0.12 + (i * (HW - 0.24)) / n;
    const stripe = plate(
      [
        [x0, -HH / 2 + 0.02],
        [x0 + 0.12, -HH / 2 + 0.02],
        [x0 + 0.26, HH / 2 - 0.02],
        [x0 + 0.14, HH / 2 - 0.02],
      ],
      0.006,
    );
    a.add(stripe, { tone: "solid", position: [0, beamY, 0.17 + HD / 2 + 0.002] });
  }
  // Sprung buffers at 1.74 m centres.
  for (const s of [-1, 1]) {
    const x = s * 0.87;
    a.add(cbox(0.32, 0.32, 0.03, 0.01), { tone: "dark", position: [x, beamY, 0.335] });
    const housing = turned(
      [
        [0.11, 0],
        [0.11, 0.2],
        [0.09, 0.22],
        [0.075, 0.22],
        [0.075, 0.34],
        [0, 0.34],
      ],
      16,
    );
    housing.rotateX(Math.PI / 2);
    a.add(housing, { tone: "deep", position: [x, beamY, 0.35] });
    const head = turned(
      [
        [0, 0],
        [0.19, 0],
        [0.2, 0.02],
        [0.19, 0.05],
        [0.12, 0.065],
        [0, 0.07],
      ],
      22,
    );
    head.rotateX(Math.PI / 2);
    a.add(head, { tone: "light", position: [x, beamY, 0.69] });
  }
  // Tail lamp on the headstock: permanently lit red.
  a.add(cbox(0.2, 0.26, 0.16, 0.02), { tone: "deep", position: [0, beamY + HH / 2 + 0.14, 0.12] });
  a.add(cylinder(0.02, 0.02, 0.08, 8), { tone: "deep", position: [0, beamY + HH / 2 + 0.3, 0.12] });
  a.add(hoop(0.065, 0.012, 4, 16), { tone: "solid", position: [0, beamY + HH / 2 + 0.14, 0.205] });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.058, 16), litMaterial("signal"));
  lens.position.set(0, beamY + HH / 2 + 0.14, 0.207);
  a.attach(lens);
  return { object: a.build(), footprint: { width: HW, depth: 2.9, height: beamY + HH / 2 + 0.34 }, scalable: 0, placement: "track" };
}

// ------------------------------------------------------------------ ground frame

export interface GroundFrameOptions {
  levers?: number;
  /** Plate text on the frame, e.g. "GROUND FRAME A". */
  name?: string;
  /** Length of point rodding run toward -X (m). */
  rodding?: number;
}

export function buildGroundFramePart(o: GroundFrameOptions = {}): Built {
  const a = new Assembly(tracksideMaterial(0.04), "ground-frame");
  const nL = Math.max(1, Math.min(4, o.levers ?? 2));
  const pitch = 0.16;
  const FW = nL * pitch + 0.3;
  // Timber baulks, cast frame, quadrant plates.
  for (const z of [-0.18, 0.18]) a.add(cblock(FW + 0.5, 0.14, 0.22, 0.01), { tone: "mid", position: [0, 0, z] });
  a.add(cblock(FW, 0.2, 0.46, 0.02), { tone: "deep", position: [0, 0.14, 0] });
  const pivotY = 0.3;
  for (let i = 0; i < nL; i++) {
    const x = -((nL - 1) * pitch) / 2 + i * pitch;
    for (const s of [-1, 1]) {
      const q: Array<[number, number]> = [[-0.26, 0]];
      for (let k = 0; k <= 8; k++) {
        const an = -0.5 + (k / 8) * 1.0;
        q.push([Math.sin(an) * 0.3, Math.cos(an) * 0.3 - 0.06]);
      }
      q.push([0.26, 0]);
      const quad = plate(q, 0.018, 0.003);
      quad.rotateY(Math.PI / 2);
      a.add(quad, { tone: "deep", position: [x + s * 0.035, 0.34, 0] });
    }
  }
  // Frame plate.
  const name = (o.name ?? "GROUND FRAME A").toUpperCase().slice(0, 18);
  const tex = inkTexture(`gf:${name}`, 512, 96, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#fff";
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    text(g, name, w / 2, h / 2, h * 0.42, { color: "#fff", maxW: w * 0.9 });
  });
  a.attach(printPlane(tex, Math.min(FW - 0.04, 0.6), Math.min(FW - 0.04, 0.6) * (96 / 512), [0, 0.24, 0.232], "front", { hatchSpace: "world", hatch: 0.03 }));
  // Point rodding on roller stools, running off toward the points.
  const run = o.rodding ?? 4;
  for (let i = 0; i < nL; i++) {
    const z = -0.3 - i * 0.08;
    a.add(rod([-FW / 2, 0.12, z], [-FW / 2 - run, 0.12, z], 0.016, 6), { tone: "mid" });
  }
  for (let x = -FW / 2 - 0.6; x > -FW / 2 - run; x -= 1.6) {
    a.add(cblock(0.12, 0.1, 0.12 + nL * 0.08, 0.01), { tone: "dark", position: [x, 0, -0.3 - (nL - 1) * 0.04] });
  }
  // Levers pivot in the frame; each is its own mesh.
  const leverMat = tracksideMaterial(0.02, OBJECT_ID.trackside + 0.02);
  const levers: THREE.Object3D[] = [];
  const colours: Array<{ tone: "solid" | "paper"; accent?: AccentName }> = [{ tone: "solid" }, { tone: "paper", accent: "signal" }, { tone: "solid" }, { tone: "paper", accent: "signal" }];
  for (let i = 0; i < nL; i++) {
    const x = -((nL - 1) * pitch) / 2 + i * pitch;
    const k = new Kit();
    const col = colours[i % colours.length]!;
    k.add(cbox(0.035, 1.1, 0.05, 0.008), { tone: col.tone, ...(col.accent ? { accent: col.accent } : {}), position: [0, 0.55, 0] });
    // Polished handle, catch handle and its rod.
    k.add(turned([[0.02, 0], [0.024, 0.02], [0.022, 0.2], [0.018, 0.22], [0, 0.225]], 10), { tone: "paper", position: [0, 1.1, 0] });
    k.add(cbox(0.02, 0.12, 0.03, 0.005), { tone: "light", position: [0, 1.06, -0.04], rotation: [0.2, 0, 0] });
    k.add(rod([0, 1.0, -0.03], [0, 0.2, -0.03], 0.006, 4), { tone: "light" });
    // Number plate.
    k.add(cbox(0.06, 0.07, 0.008, 0.002), { tone: "paper", position: [0, 0.82, 0.03] });
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(k.build(), leverMat);
    m.name = `ground-frame:lever:${i + 1}`;
    pivot.add(m);
    pivot.position.set(x, pivotY, 0);
    a.attach(pivot);
    levers.push(pivot);
  }
  // Padlock and chain on lever 1.
  a.add(cbox(0.05, 0.06, 0.02, 0.006), { tone: "dark", position: [-((nL - 1) * pitch) / 2 + 0.05, 0.48, 0.12] });
  a.add(hoop(0.018, 0.004, 3, 10, Math.PI), { tone: "light", position: [-((nL - 1) * pitch) / 2 + 0.05, 0.51, 0.12] });
  const obj = a.build();
  const setLever = (index: number, value: number) => {
    const lv = levers[index];
    if (!lv) return;
    lv.rotation.x = -0.42 * Math.max(-1, Math.min(1, value));
  };
  levers.forEach((_, i) => setLever(i, -1));
  obj.userData.setLever = setLever;
  obj.userData.levers = nL;
  return { object: obj, footprint: { width: FW + 0.5 + run, depth: 0.7, height: 1.6 }, scalable: 0, placement: "ground" };
}

