/**
 * Street and platform furniture: lamp posts, benches, bins, bollards, traffic
 * cones and barriers. Variants follow the journey: cast iron and timber for
 * the early line, galvanised and concrete for the industrial stretch, sleek
 * stainless and perforated steel for the late, uniform order.
 */
import * as THREE from "three";
import { Kit, cylinder, deform, sphere } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";
import { Assembly, HATCH, OBJECT_ID, beam, blob, cblock, cbox, hoop, plate, propMaterial, ring, rod, rodY, roundRect, slab, tracksideMaterial, turned, wire, circle } from "./common.ts";
import { inkTexture, printPlane, stencil, text } from "./print.ts";
import type { Built } from "./types.ts";

// ------------------------------------------------------------------ lamp posts

export type LampKind = "station" | "street" | "flood";

export interface LampOptions {
  kind?: LampKind;
  lit?: boolean;
}

function lampGlass(lit: boolean, accent: "amber" | "none"): THREE.Material {
  return lit
    ? inkMaterial({ tone: 0, flat: true, ...(accent !== "none" ? { accent, accentAmount: 0.9 } : {}), hatchSpace: "world", hatch: 0.03, objectId: OBJECT_ID.lamp, edge: 0.6 })
    : inkMaterial({ tone: "pale", hatchSpace: "world", hatch: 0.03, objectId: OBJECT_ID.lamp, edge: 0.8 });
}

export function buildLampPostPart(o: LampOptions = {}): Built {
  const kind = o.kind ?? "station";
  const lit = o.lit ?? false;
  const a = new Assembly(tracksideMaterial(0.05), `lamp:${kind}`);
  let glassGeo: THREE.BufferGeometry;
  let accent: "amber" | "none" = "amber";
  let height = 4;
  if (kind === "station") {
    // Cast-iron column: fluted base, tapered shaft, ladder bar, square lantern.
    a.add(
      turned(
        [
          [0, 0],
          [0.2, 0],
          [0.2, 0.08],
          [0.16, 0.12],
          [0.16, 0.5],
          [0.12, 0.58],
          [0.1, 0.66],
          [0.075, 0.72],
        ],
        16,
      ),
      { tone: "deep" },
    );
    const shaft = turned(
      [
        [0.075, 0.72],
        [0.055, 3.1],
      ],
      16,
    );
    deform(shaft, (p) => {
      const th = Math.atan2(p.z, p.x);
      const f = 1 - 0.08 * Math.max(0, Math.cos(th * 8)) ** 4;
      p.x *= f;
      p.z *= f;
    });
    a.add(shaft, { tone: "deep" });
    a.add(ring(0.065, 0.014, 4, 16), { tone: "deep", position: [0, 1.4, 0] });
    a.add(turned([[0.055, 3.1], [0.075, 3.16], [0.075, 3.2], [0.05, 3.24], [0.05, 3.3]], 14), { tone: "deep" });
    a.add(rod([-0.34, 3.05, 0], [0.34, 3.05, 0], 0.018, 6), { tone: "deep" });
    for (const s of [-1, 1]) a.add(sphere(0.03, 8, 6), { tone: "deep", position: [s * 0.35, 3.05, 0] });
    // Lantern: cage frame, hip roof, finial; glass separate.
    const ly = 3.3,
      LW = 0.34,
      LH = 0.5;
    a.add(cbox(LW * 0.7, 0.05, LW * 0.7, 0.01), { tone: "deep", position: [0, ly + 0.025, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(rod([sx * LW * 0.35, ly + 0.05, sz * LW * 0.35], [sx * LW / 2, ly + LH, sz * LW / 2], 0.012, 5), { tone: "deep" });
    const roof = new THREE.ConeGeometry(LW * 0.82, 0.22, 4, 1);
    roof.rotateY(Math.PI / 4);
    a.add(roof, { tone: "deep", position: [0, ly + LH + 0.11, 0] });
    a.add(cbox(LW + 0.04, 0.04, LW + 0.04, 0.01), { tone: "deep", position: [0, ly + LH, 0] });
    a.add(turned([[0.02, 0], [0.04, 0.03], [0.02, 0.08], [0.03, 0.12], [0, 0.16]], 8), { tone: "deep", position: [0, ly + LH + 0.2, 0] });
    const k = new Kit();
    const glass = new THREE.CylinderGeometry(LW / 2 * 1.35, LW * 0.35 * 1.35, LH - 0.06, 4, 1, false);
    glass.rotateY(Math.PI / 4);
    k.add(glass, { tone: "paper", position: [0, ly + 0.05 + (LH - 0.06) / 2, 0] });
    glassGeo = k.build();
    height = ly + LH + 0.36;
  } else if (kind === "street") {
    // Tapered octagonal column, outreach arm, flat luminaire.
    a.add(cblock(0.36, 0.06, 0.36, 0.01), { tone: "light" });
    a.add(rodY(0.085, 0.06, 6.2, 8, 0.06), { tone: "light" });
    a.add(cbox(0.2, 0.4, 0.12, 0.01), { tone: "light", position: [0, 1.0, 0.07] });
    a.add(
      wire(
        [
          [0, 6.1, 0],
          [0, 6.35, 0.1],
          [0, 6.45, 0.5],
          [0, 6.5, 1.2],
        ],
        0.035,
        14,
        6,
      ),
      { tone: "light" },
    );
    a.add(cbox(0.3, 0.1, 0.65, 0.03), { tone: "light", position: [0, 6.48, 1.35] });
    const k = new Kit();
    k.add(cbox(0.24, 0.02, 0.5, 0.005), { tone: "paper", position: [0, 6.42, 1.36] });
    glassGeo = k.build();
    height = 6.6;
  } else {
    // Floodlight mast with a lamp frame, a camera on a bracket.
    accent = "none";
    a.add(cblock(0.6, 0.3, 0.6, 0.03), { tone: "pale" });
    a.add(rodY(0.14, 0.3, 8.6, 10, 0.09), { tone: "light" });
    a.add(cbox(0.3, 0.5, 0.18, 0.01), { tone: "light", position: [0, 1.2, 0.14] });
    a.add(beam([-0.9, 8.65, 0.05], [0.9, 8.65, 0.05], 0.1, 0.08), { tone: "mid" });
    a.add(beam([-0.9, 9.15, 0.05], [0.9, 9.15, 0.05], 0.1, 0.08), { tone: "mid" });
    for (const x of [-0.9, 0.9]) a.add(beam([x, 8.6, 0.05], [x, 9.2, 0.05], 0.08, 0.08), { tone: "mid" });
    const k = new Kit();
    for (const x of [-0.6, -0.2, 0.2, 0.6])
      for (const y of [8.65, 9.15]) {
        a.add(cbox(0.3, 0.3, 0.14, 0.02), { tone: "dark", position: [x, y, 0.16], rotation: [0.35, 0, 0] });
        const lens = new THREE.PlaneGeometry(0.24, 0.24);
        lens.rotateX(0.35);
        k.add(lens, { tone: "paper", position: [x, y - 0.024, 0.235] });
      }
    glassGeo = k.build();
    // CCTV camera on a bracket.
    a.add(beam([0, 7.4, 0.1], [0, 7.4, 0.5], 0.06, 0.06), { tone: "mid" });
    a.add(cbox(0.14, 0.14, 0.38, 0.02), { tone: "light", position: [0, 7.3, 0.6], rotation: [0.3, 0, 0] });
    a.add(cbox(0.18, 0.02, 0.44, 0.005), { tone: "light", position: [0, 7.4, 0.62], rotation: [0.3, 0, 0] });
    a.add(cylinder(0.045, 0.045, 0.02, 12), { tone: "solid", position: [0, 7.24, 0.79], rotation: [Math.PI / 2 + 0.3, 0, 0] });
    height = 9.4;
  }
  const glass = new THREE.Mesh(glassGeo, lampGlass(lit, accent));
  glass.name = `lamp:${kind}:glass`;
  a.attach(glass);
  const obj = a.build();
  obj.userData.setLit = (on: boolean) => {
    glass.material = lampGlass(on, accent);
    obj.userData.lit = on;
  };
  obj.userData.lit = lit;
  return { object: obj, footprint: { width: kind === "flood" ? 1.9 : 0.7, depth: kind === "street" ? 1.7 : 0.6, height }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ bench

export type BenchKind = "platform" | "steel";

export function buildBenchPart(kind: BenchKind = "platform"): Built {
  const a = new Assembly(propMaterial(HATCH.large, OBJECT_ID.trackside), `bench:${kind}`);
  const L = 1.7;
  if (kind === "platform") {
    // Cast-iron ends (profile extruded thin), timber slats.
    const end: Array<[number, number]> = [
      [0.26, 0],
      [0.2, 0],
      [0.17, 0.3],
      [0.15, 0.4],
      [-0.1, 0.4],
      [-0.16, 0.36],
      [-0.2, 0],
      [-0.26, 0],
      [-0.23, 0.36],
      [-0.26, 0.5],
      [-0.33, 0.86],
      [-0.28, 0.87],
      [-0.2, 0.47],
      [-0.12, 0.46],
      [0.18, 0.46],
      [0.24, 0.52],
      [0.26, 0.62],
      [0.21, 0.66],
      [0.2, 0.6],
      [0.22, 0.56],
      [0.2, 0.5],
      [0.22, 0.4],
    ];
    const hole = circle(0.045, 10, 0.0, 0.2);
    for (const s of [-1, 1]) {
      const g = plate(end, 0.04, 0.006, [hole]);
      g.rotateY(Math.PI / 2);
      a.add(g, { tone: "deep", position: [s * (L / 2 - 0.12), 0, 0] });
    }
    for (let i = 0; i < 4; i++) a.add(cbox(L, 0.03, 0.075, 0.008), { tone: "pale", position: [0, 0.445, 0.18 - i * 0.1] });
    for (let i = 0; i < 3; i++) {
      const y = 0.56 + i * 0.1;
      const z = -0.24 - (y - 0.47) * 0.19;
      a.add(cbox(L, 0.075, 0.03, 0.008), { tone: "pale", position: [0, y, z], rotation: [-0.19, 0, 0] });
    }
    return { object: a.build(), footprint: { width: L, depth: 0.6, height: 0.88 }, scalable: 0, placement: "ground" };
  }
  // Steel: flat bars for seat and back on welded flat-bar frames, identical everywhere.
  const k = new Kit();
  for (let i = 0; i < 5; i++) k.add(cbox(L, 0.012, 0.06, 0.003), { tone: "light", position: [0, 0.45, 0.2 - i * 0.085] });
  for (let i = 0; i < 4; i++) {
    const y = 0.56 + i * 0.085;
    k.add(cbox(L, 0.06, 0.012, 0.003), { tone: "light", position: [0, y, -0.2 - (y - 0.5) * 0.25], rotation: [-0.25, 0, 0] });
  }
  for (const x of [-L / 2 + 0.12, 0, L / 2 - 0.12]) {
    k.add(beam([x, 0, 0.2], [x, 0.44, 0.18], 0.012, 0.05), { tone: "mid" });
    k.add(beam([x, 0, -0.22], [x, 0.44, -0.2], 0.012, 0.05), { tone: "mid" });
    k.add(beam([x, 0.44, 0.22], [x, 0.44, -0.2], 0.012, 0.05, [0, 1, 0]), { tone: "mid" });
    k.add(beam([x, 0.44, -0.2], [x, 0.88, -0.31], 0.012, 0.05), { tone: "mid" });
    k.add(cbox(0.08, 0.01, 0.46, 0.003), { tone: "mid", position: [x, 0.005, -0.01] });
  }
  a.kit.addGeometry(k.build());
  return { object: a.build(), footprint: { width: L, depth: 0.6, height: 0.9 }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ bins

export type BinKind = "litter" | "clear-sack" | "wheelie";

export function buildBinPart(kind: BinKind = "litter"): Built {
  const a = new Assembly(propMaterial(HATCH.large, OBJECT_ID.trackside), `bin:${kind}`);
  if (kind === "litter") {
    const body = turned(
      [
        [0, 0],
        [0.24, 0],
        [0.25, 0.04],
        [0.25, 0.72],
        [0.27, 0.74],
        [0.27, 0.78],
      ],
      20,
    );
    deform(body, (p) => {
      if (p.y > 0.06 && p.y < 0.7) {
        const th = Math.atan2(p.z, p.x);
        const f = 1 + 0.03 * Math.max(0, Math.cos(th * 10)) ** 6;
        p.x *= f;
        p.z *= f;
      }
    });
    a.add(body, { tone: "dark" });
    a.add(turned([[0.28, 0.78], [0.28, 0.8], [0.22, 0.9], [0.1, 0.95], [0, 0.96]], 20), { tone: "dark" });
    a.add(cbox(0.22, 0.09, 0.08, 0.02), { tone: "solid", position: [0, 0.84, 0.23], rotation: [-0.35, 0, 0] });
    a.add(ring(0.252, 0.012, 4, 22), { tone: "light", position: [0, 0.6, 0] });
    const tex = inkTexture("litterband", 256, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      text(g, "LITTER", w / 2, h / 2, h * 0.5, { color: "#fff", weight: "bold", track: 8 });
    }, true);
    a.attach(printPlane(tex, 0.3, 0.075, [0, 0.46, 0], "front", { segX: 6, warp: (x) => Math.sqrt(Math.max(0, 0.262 ** 2 - x * x)), hatchSpace: "world", hatch: 0.03 }));
    return { object: a.build(), footprint: { width: 0.56, depth: 0.56, height: 0.96 }, scalable: 0, placement: "ground" };
  }
  if (kind === "clear-sack") {
    a.add(rodY(0.04, 0, 1.05, 10), { tone: "light" });
    a.add(ring(0.24, 0.018, 5, 22), { tone: "light", position: [0, 0.95, 0.27] });
    a.add(beam([0, 0.95, 0.03], [0, 0.95, 0.04], 0.06, 0.05), { tone: "light" });
    a.add(cbox(0.52, 0.03, 0.5, 0.01), { tone: "light", position: [0, 1.04, 0.27] });
    const sack = blob(0.23, 0.36, 0.22, 0.8, 0.9, 14, 10);
    deform(sack, (p) => {
      if (p.y < -0.1) {
        const s = 1 - 0.25 * ((-0.1 - p.y) / 0.26);
        p.x *= s;
        p.z *= s;
      }
      p.x += 0.012 * Math.sin(p.y * 22);
    });
    a.add(sack, { tone: "paper", position: [0, 0.6, 0.27] });
    // Contents pressing through the film.
    a.add(blob(0.1, 0.06, 0.08, 0.6), { tone: "mid", position: [0.05, 0.4, 0.3] });
    a.add(blob(0.08, 0.12, 0.06, 0.6), { tone: "light", position: [-0.08, 0.52, 0.28] });
    const tex = inkTexture("sackplate", 256, 96, (g, w, h) => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h * 0.3);
      text(g, "SECURITY", w / 2, h * 0.15, h * 0.2, { color: "#fff" });
      text(g, "KEEP BAGS VISIBLE", w / 2, h * 0.64, h * 0.18, { maxW: w * 0.9 });
    });
    a.attach(printPlane(tex, 0.2, 0.075, [0, 0.8, 0.041], "front", { hatchSpace: "world", hatch: 0.03 }));
    return { object: a.build(), footprint: { width: 0.54, depth: 0.6, height: 1.07 }, scalable: 0, placement: "ground" };
  }
  // Wheelie bin (240 L).
  const body = plate(
    [
      [-0.26, 0.02],
      [0.28, 0.02],
      [0.36, 0.98],
      [-0.33, 0.98],
    ],
    0.56,
    0.02,
  );
  body.rotateY(Math.PI / 2);
  a.add(body, { tone: "dark" });
  a.add(cbox(0.62, 0.05, 0.8, 0.015), { tone: "dark", position: [0, 1.0, 0.01], rotation: [-0.03, 0, 0] });
  a.add(cbox(0.6, 0.08, 0.04, 0.015), { tone: "mid", position: [0, 0.97, 0.4] });
  a.add(rod([-0.26, 0.95, -0.4], [0.26, 0.95, -0.4], 0.02, 8), { tone: "mid" });
  for (const s of [-1, 1]) {
    const w = hoop(0.1, 0.035, 5, 16);
    w.rotateY(Math.PI / 2);
    a.add(w, { tone: "solid", position: [s * 0.25, 0.1, -0.3] });
  }
  a.add(rod([-0.3, 0.1, -0.3], [0.3, 0.1, -0.3], 0.015, 6), { tone: "mid" });
  return { object: a.build(), footprint: { width: 0.62, depth: 0.85, height: 1.05 }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ bollards

export type BollardKind = "cast" | "concrete" | "steel";

export function buildBollardPart(kind: BollardKind = "cast"): Built {
  const a = new Assembly(propMaterial(HATCH.small, OBJECT_ID.trackside), `bollard:${kind}`);
  if (kind === "cast") {
    a.add(
      turned(
        [
          [0, 0],
          [0.14, 0],
          [0.14, 0.06],
          [0.12, 0.1],
          [0.105, 0.6],
          [0.12, 0.64],
          [0.12, 0.68],
          [0.1, 0.72],
          [0.11, 0.78],
          [0.09, 0.86],
          [0.05, 0.9],
          [0, 0.91],
        ],
        18,
      ),
      { tone: "deep" },
    );
    a.add(ring(0.108, 0.01, 4, 18), { tone: "light", position: [0, 0.5, 0] });
    return { object: a.build(), footprint: { width: 0.28, depth: 0.28, height: 0.91 }, scalable: 0, placement: "ground" };
  }
  if (kind === "concrete") {
    a.add(cblock(0.3, 0.72, 0.3, 0.02), { tone: "pale" });
    const cap = new THREE.ConeGeometry(0.22, 0.12, 4);
    cap.rotateY(Math.PI / 4);
    a.add(cap, { tone: "pale", position: [0, 0.78, 0] });
    a.add(slab(0.31, 0.06, 0.31), { tone: "mid", position: [0, 0.55, 0] });
    return { object: a.build(), footprint: { width: 0.3, depth: 0.3, height: 0.84 }, scalable: 0, placement: "ground" };
  }
  a.add(turned([[0, 0], [0.1, 0], [0.1, 0.98], [0.09, 1.0], [0, 1.0]], 20), { tone: "light" });
  a.add(turned([[0.101, 0.82], [0.101, 0.88]], 20), { tone: "paper" });
  a.add(turned([[0.101, 0.76], [0.101, 0.78]], 20), { tone: "deep" });
  return { object: a.build(), footprint: { width: 0.2, depth: 0.2, height: 1.0 }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ traffic cone

export function buildConePart(): Built {
  const a = new Assembly(propMaterial(HATCH.small, OBJECT_ID.prop), "cone");
  a.add(plate(roundRect(0.38, 0.38, 0.05, 2), 0.035, 0.006).rotateX(-Math.PI / 2).translate(0, 0.0175, 0), { tone: "deep" });
  const r = (y: number) => 0.155 - (y / 0.72) * 0.125;
  const seg = (y0: number, y1: number, band: boolean) =>
    a.add(
      turned(
        [
          [r(y0) + 0.002, y0],
          [r(y1) + 0.002, y1],
        ],
        20,
      ),
      band ? { tone: "paper" } : { tone: "paper", accent: "amber", accentAmount: 1 },
    );
  seg(0.035, 0.3, false);
  seg(0.3, 0.42, true);
  seg(0.42, 0.5, false);
  seg(0.5, 0.58, true);
  seg(0.58, 0.7, false);
  a.add(turned([[r(0.7) + 0.002, 0.7], [0.022, 0.73], [0, 0.735]], 20), { tone: "paper", accent: "amber", accentAmount: 1 });
  a.add(turned([[0.165, 0.035], [0.165, 0.045], [r(0.06), 0.06]], 20), { tone: "deep" });
  return { object: a.build(), footprint: { width: 0.38, depth: 0.38, height: 0.735 }, scalable: 0.4, placement: "surface" };
}

// ------------------------------------------------------------------ barriers

export type BarrierKind = "trestle" | "crowd" | "jersey" | "boom";

export function buildBarrierPart(kind: BarrierKind = "trestle"): Built {
  const a = new Assembly(propMaterial(HATCH.large, OBJECT_ID.trackside), `barrier:${kind}`);
  if (kind === "trestle") {
    // A-frame trestles carrying a striped board and a lamp.
    const L = 1.6;
    for (const s of [-1, 1]) {
      const x = s * (L / 2 - 0.12);
      for (const z of [-0.28, 0.28]) a.add(beam([x, 0, z], [x, 1.02, 0], 0.05, 0.035, [1, 0, 0]), { tone: "light" });
      a.add(beam([x, 0.35, -0.19], [x, 0.35, 0.19], 0.035, 0.03), { tone: "light" });
      a.add(cbox(0.08, 0.04, 0.1, 0.01), { tone: "mid", position: [x, 1.03, 0] });
    }
    for (const y of [0.88, 0.5]) {
      a.add(cbox(L, 0.2, 0.025, 0.004), { tone: "paper", position: [0, y, 0.03] });
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x0 = -L / 2 + 0.04 + (i * (L - 0.1)) / n;
        const stripe = plate(
          [
            [x0, -0.09],
            [x0 + 0.1, -0.09],
            [x0 + 0.2, 0.09],
            [x0 + 0.1, 0.09],
          ],
          0.004,
        );
        a.add(stripe, { tone: "paper", accent: "signal", accentAmount: 1, position: [0, y, 0.044] });
      }
    }
    // Hazard lamp clamped on top.
    a.add(cbox(0.12, 0.1, 0.1, 0.01), { tone: "deep", position: [L / 2 - 0.25, 1.05, 0.03] });
    a.add(cylinder(0.06, 0.06, 0.1, 12), { tone: "paper", accent: "amber", accentAmount: 1, position: [L / 2 - 0.25, 1.15, 0.03] });
    return { object: a.build(), footprint: { width: L, depth: 0.6, height: 1.2 }, scalable: 0, placement: "surface" };
  }
  if (kind === "crowd") {
    const L = 2.3,
      H = 1.1;
    a.add(wire([[-L / 2, 0.12, 0], [-L / 2, H, 0], [L / 2, H, 0], [L / 2, 0.12, 0]], 0.022, 20, 6), { tone: "light" });
    a.add(rod([-L / 2, 0.2, 0], [L / 2, 0.2, 0], 0.018, 6), { tone: "light" });
    for (let x = -L / 2 + 0.12; x < L / 2 - 0.05; x += 0.12) a.add(rod([x, 0.2, 0], [x, H, 0], 0.009, 4), { tone: "light" });
    for (const s of [-1, 1]) {
      a.add(beam([s * L / 2, 0.02, -0.3], [s * L / 2, 0.02, 0.3], 0.06, 0.02), { tone: "mid" });
      a.add(rod([s * L / 2, 0.02, 0], [s * L / 2, 0.14, 0], 0.02, 6), { tone: "mid" });
    }
    const tex = inkTexture("crowdplate", 384, 96, (g, w, h) => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      stencil(g, "NO ENTRY", w / 2, h / 2, h * 0.5, { color: "#fff", bridge: "#000", maxW: w * 0.9 });
    });
    a.add(cbox(0.62, 0.18, 0.01, 0.003), { tone: "solid", position: [0, 0.7, 0.012] });
    a.attach(printPlane(tex, 0.6, 0.15, [0, 0.7, 0.0185], "front", { hatchSpace: "world", hatch: 0.03 }));
    return { object: a.build(), footprint: { width: L, depth: 0.6, height: H }, scalable: 0, placement: "surface" };
  }
  if (kind === "jersey") {
    const L = 2.0;
    const prof: Array<[number, number]> = [
      [-0.3, 0],
      [0.3, 0],
      [0.3, 0.08],
      [0.18, 0.26],
      [0.1, 0.81],
      [-0.1, 0.81],
      [-0.18, 0.26],
      [-0.3, 0.08],
    ];
    const g = plate(prof, L, 0.01);
    g.rotateY(Math.PI / 2);
    a.add(g, { tone: "pale" });
    for (const s of [-1, 1]) a.add(cbox(0.03, 0.12, 0.3, 0.01), { tone: "solid", position: [s * (L / 2 - 0.2), 0.08, 0] });
    a.add(cbox(0.14, 0.05, 0.01, 0.005), { tone: "paper", accent: "signal", accentAmount: 1, position: [0, 0.65, 0.114], rotation: [-0.14, 0, 0] });
    return { object: a.build(), footprint: { width: L, depth: 0.6, height: 0.81 }, scalable: 0, placement: "ground" };
  }
  // Boom barrier (checkpoint): post, counterweight, striped arm, with setOpen().
  a.add(cblock(0.5, 0.1, 0.5, 0.02), { tone: "pale" });
  a.add(cblock(0.32, 1.0, 0.32, 0.02), { tone: "light", position: [0, 0.1, 0] });
  a.add(cbox(0.36, 0.08, 0.36, 0.02), { tone: "mid", position: [0, 1.14, 0] });
  const arm = new Kit();
  const AL = 4.0;
  arm.add(cbox(AL, 0.1, 0.07, 0.02), { tone: "paper", position: [AL / 2, 0, 0] });
  for (let i = 0; i < 8; i++) arm.add(cbox(AL / 16, 0.104, 0.074, 0.02), { tone: "paper", accent: "signal", accentAmount: 1, position: [AL / 16 + (i * AL) / 8 + AL / 32, 0, 0] });
  arm.add(cbox(0.5, 0.16, 0.12, 0.02), { tone: "deep", position: [-0.3, 0, 0] });
  arm.add(cbox(0.06, 0.4, 0.06, 0.01), { tone: "light", position: [AL - 0.05, -0.22, 0] });
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.0, 0.2);
  const armMesh = new THREE.Mesh(arm.build(), propMaterial(HATCH.large, OBJECT_ID.trackside + 0.01));
  pivot.add(armMesh);
  a.attach(pivot);
  const obj = a.build();
  obj.userData.setOpen = (t: number) => {
    pivot.rotation.z = Math.max(0, Math.min(1, t)) * (Math.PI / 2 - 0.05);
  };
  return { object: obj, footprint: { width: AL + 0.6, depth: 0.5, height: 1.2 }, scalable: 0, placement: "ground" };
}

