/**
 * Cargo and equipment: parcels, crates, sacks, cases, drums, tanks, tools.
 * Built at true size; boxes are assembled from boards and battens so the
 * contour pass finds real joints, not painted lines.
 */
import * as THREE from "three";
import { Kit, cylinder, sphere, deform, jitter } from "../core/geometry.ts";
import {
  Assembly,
  HATCH,
  beam,
  blob,
  cblock,
  cbox,
  hoop,
  plate,
  propMaterial,
  restOnGround,
  ring,
  rod,
  rodY,
  roundRect,
  slab,
  sweep,
  turned,
  wire,
  type V3,
} from "./common.ts";
import { RED, barcode, frame, greek, inkTexture, marker, printPlane, stamp, stencil, text } from "./print.ts";
import type { BuildCtx, Built } from "./types.ts";

const small = () => propMaterial(HATCH.small);
const large = () => propMaterial(HATCH.large);

// ------------------------------------------------------------------ parcel

export function parcel(c: BuildCtx): Built {
  const a = new Assembly(small(), "parcel");
  const W = 0.36,
    H = 0.2,
    D = 0.27;
  a.add(cblock(W, H, D, 0.006), { tone: "pale" });
  // End folds: the wrapping's triangular flaps on both short faces.
  for (const side of [-1, 1]) {
    const flap = plate(
      [
        [-D / 2 + 0.012, 0.012],
        [D / 2 - 0.012, 0.012],
        [0, H * 0.62],
      ],
      0.003,
    );
    flap.rotateY(Math.PI / 2);
    a.add(flap, { tone: "pale", position: [side * (W / 2 + 0.0015), 0, 0] });
    const top = plate(
      [
        [-D / 2 + 0.006, H - 0.006],
        [D / 2 - 0.006, H - 0.006],
        [D / 2 - 0.03, H * 0.72],
        [-D / 2 + 0.03, H * 0.72],
      ],
      0.002,
    );
    top.rotateY(Math.PI / 2);
    a.add(top, { tone: "pale", position: [side * (W / 2 + 0.001), 0, 0] });
  }
  // Twine both ways, knotted in a bow on top.
  const tw = 0.005,
    tt = 0.003;
  a.add(slab(W + 0.006, tt, tw), { tone: "deep", position: [0, H, 0] });
  a.add(slab(tw, tt, D + 0.006), { tone: "deep", position: [0, H, 0] });
  for (const s of [-1, 1]) {
    a.add(slab(tt, H, tw), { tone: "deep", position: [s * (W / 2 + 0.0035), 0, 0] });
    a.add(slab(tw, H, tt), { tone: "deep", position: [0, 0, s * (D / 2 + 0.0035)] });
  }
  a.add(blob(0.01, 0.006, 0.01), { tone: "deep", position: [0, H + 0.004, 0] });
  for (const s of [-1, 1]) {
    a.add(ring(0.018, 0.0024, 4, 14), { tone: "deep", position: [s * 0.02, H + 0.004, 0.004], rotation: [0.25, 0, s * 0.3], scale: [1.2, 1, 0.7] });
    a.add(
      wire(
        [
          [0, H + 0.004, 0],
          [s * 0.015, H + 0.003, 0.02],
          [s * 0.02, H + 0.002, 0.045],
        ],
        0.0022,
        6,
        3,
      ),
      { tone: "deep" },
    );
  }
  const who = (c.label ?? "HANDLE WITH CARE").toUpperCase().slice(0, 20);
  const tex = inkTexture(`parcel:${who}`, 384, 256, (g, w, h) => {
    const r = c.rng.fork("parcel");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 3, 3, w - 6, h - 6, 4);
    text(g, "TO:", w * 0.07, h * 0.14, h * 0.06, { align: "left" });
    text(g, who, w * 0.07, h * 0.3, h * 0.1, { align: "left", maxW: w * 0.86 });
    greek(g, w * 0.07, h * 0.46, w * 0.55, h * 0.07, 3, r);
    barcode(g, w * 0.07, h * 0.72, w * 0.45, h * 0.18, r);
    stamp(g, "FRAGILE", w * 0.78, h * 0.72, w * 0.36, -0.2, r);
  });
  a.attach(printPlane(tex, 0.15, 0.1, [0.075, H + 0.0035, 0.058], "up", { rotate: 0.06 }));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.4, 0.4);
  return { object: o, footprint: { width: W, depth: D, height: H + 0.01 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ crate

export function crate(c: BuildCtx): Built {
  const a = new Assembly(small(), "crate");
  const W = 0.64,
    H = 0.46,
    D = 0.46,
    t = 0.018,
    gap = 0.007;
  a.add(slab(W - 0.03, H - 0.03, D - 0.03), { tone: "solid", position: [0, 0.015, 0] });
  const boards = 4;
  const bh = (H - gap * (boards - 1)) / boards;
  for (let i = 0; i < boards; i++) {
    const y = i * (bh + gap);
    for (const s of [-1, 1]) {
      a.add(slab(W, bh, t), { tone: "paper", position: [0, y, s * (D / 2 - t / 2)] });
      a.add(slab(t, bh, D - 2 * t), { tone: "paper", position: [s * (W / 2 - t / 2), y, 0] });
    }
  }
  const tb = (D - gap * 3) / 4;
  for (let i = 0; i < 4; i++) a.add(slab(W, t, tb), { tone: "paper", position: [0, H - t, -D / 2 + tb / 2 + i * (tb + gap)] });
  // Battens framing each long face, with a diagonal brace; corner battens.
  const bw = 0.07,
    bt = 0.02;
  for (const s of [-1, 1]) {
    const z = s * (D / 2 + bt / 2);
    for (const x of [-W / 2 + bw / 2, W / 2 - bw / 2]) a.add(slab(bw, H, bt), { tone: "pale", position: [x, 0, z] });
    a.add(slab(W - 2 * bw, bw, bt), { tone: "pale", position: [0, 0, z] });
    a.add(slab(W - 2 * bw, bw, bt), { tone: "pale", position: [0, H - bw, z] });
    if (s < 0) a.add(beam([-W / 2 + bw, bw, z], [W / 2 - bw, H - bw, z], bw * 0.9, bt, [0, 0, 1]), { tone: "pale" });
    // End battens.
    const x = s * (W / 2 + bt / 2);
    a.add(slab(bt, bw, D), { tone: "pale", position: [x, 0, 0] });
    a.add(slab(bt, bw, D), { tone: "pale", position: [x, H - bw, 0] });
  }
  // Nail heads at batten corners.
  for (const s of [-1, 1])
    for (const x of [-W / 2 + bw / 2, W / 2 - bw / 2])
      for (const y of [bw / 2, H - bw / 2]) a.add(cylinder(0.005, 0.005, 0.004, 6), { tone: "solid", position: [x, y, s * (D / 2 + bt + 0.001)], rotation: [Math.PI / 2, 0, 0] });
  const words = ["THIS WAY UP", "HANDLE WITH CARE", "KEEP DRY"];
  const word = (c.label ?? words[c.variant % words.length]!).toUpperCase().slice(0, 18);
  const tex = inkTexture(`crate:${word}`, 512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    stencil(g, word, w / 2, h * 0.32, h * 0.16, { maxW: w * 0.9, bridge: "rgba(0,0,0,0)" });
    // Two arrows up.
    g.fillStyle = "#000";
    for (const x of [w * 0.34, w * 0.66]) {
      g.beginPath();
      g.moveTo(x, h * 0.52);
      g.lineTo(x + h * 0.14, h * 0.7);
      g.lineTo(x + h * 0.05, h * 0.7);
      g.lineTo(x + h * 0.05, h * 0.92);
      g.lineTo(x - h * 0.05, h * 0.92);
      g.lineTo(x - h * 0.05, h * 0.7);
      g.lineTo(x - h * 0.14, h * 0.7);
      g.closePath();
      g.fill();
    }
  }, true);
  // Stencilled onto the boards between the battens.
  a.attach(printPlane(tex, W - 2 * bw - 0.04, (W - 2 * bw - 0.04) / 2, [0, H * 0.5, D / 2 + 0.0015], "front", { objectId: 0.53 }));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: W + 0.04, depth: D + 0.04, height: H }, scalable: 0.5, placement: "surface" };
}

// ------------------------------------------------------------------ milk crate

export function milkCrate(c: BuildCtx): Built {
  const a = new Assembly(small(), "milk-crate");
  const W = 0.33,
    D = 0.25,
    H = 0.16;
  const tone = "light" as const;
  a.add(slab(W, 0.01, D), { tone });
  // Corner posts, top rim, mid rail, vertical slats.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) a.add(cblock(0.022, H, 0.022, 0.004), { tone, position: [sx * (W / 2 - 0.011), 0, sz * (D / 2 - 0.011)] });
  const rail = (y: number, h: number) => {
    for (const s of [-1, 1]) {
      a.add(slab(W, h, 0.01), { tone, position: [0, y, s * (D / 2 - 0.005)] });
      a.add(slab(0.01, h, D), { tone, position: [s * (W / 2 - 0.005), y, 0] });
    }
  };
  rail(H - 0.028, 0.028);
  rail(0.05, 0.014);
  rail(0.0, 0.018);
  for (const s of [-1, 1]) {
    for (let i = 1; i < 6; i++) a.add(slab(0.008, H - 0.04, 0.008), { tone, position: [-W / 2 + (i * W) / 6, 0.012, s * (D / 2 - 0.004)] });
    for (let i = 1; i < 4; i++) a.add(slab(0.008, H - 0.04, 0.008), { tone, position: [s * (W / 2 - 0.004), 0.012, -D / 2 + (i * D) / 4] });
    // Hand-hold slot in the short sides.
    a.add(cbox(0.004, 0.014, 0.09, 0.003), { tone: "solid", position: [s * (W / 2 + 0.001), H - 0.014, 0] });
  }
  // Pint bottles, one slot empty.
  const nx = 4,
    nz = 3;
  const empty = c.rng.int(0, nx * nz - 1);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      if (i * nz + j === empty) continue;
      const x = -W / 2 + (W / nx) * (i + 0.5);
      const z = -D / 2 + (D / nz) * (j + 0.5);
      a.add(
        turned(
          [
            [0.032, 0.012],
            [0.034, 0.02],
            [0.034, 0.13],
            [0.022, 0.175],
            [0.021, 0.2],
            [0.0, 0.205],
          ],
          6,
        ),
        { tone: "paper", position: [x, 0, z] },
      );
      a.add(cylinder(0.0235, 0.0235, 0.006, 6), { tone: "mid", position: [x, 0.205, z] });
    }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.4, 0.4);
  return { object: o, footprint: { width: W, depth: D, height: 0.21 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ poultry crate

function hen(k: Kit, x: number, z: number, turn: number, rng: BuildCtx["rng"]): void {
  const g = new Kit();
  const body = blob(0.12, 0.09, 0.085, 0.9, 0.9, 10, 8);
  deform(body, (p) => {
    if (p.x < -0.02) p.y += (p.x + 0.02) * -0.6 * Math.max(0, p.y / 0.09 + 0.3);
  });
  g.add(body, { tone: "paper", position: [0, 0.11, 0] });
  g.add(blob(0.05, 0.07, 0.03, 0.8, 0.8, 8, 6), { tone: "paper", position: [-0.12, 0.2, 0], rotation: [0, 0, 0.5] });
  g.add(blob(0.035, 0.05, 0.035, 1, 1, 8, 6), { tone: "paper", position: [0.1, 0.2, 0] });
  g.add(sphere(0.034, 8, 6), { tone: "paper", position: [0.12, 0.25, 0] });
  g.add(blob(0.022, 0.018, 0.005, 0.8, 0.8, 8, 4), { tone: "deep", position: [0.12, 0.29, 0] });
  g.add(blob(0.008, 0.016, 0.006, 1, 1, 6, 4), { tone: "deep", position: [0.15, 0.22, 0] });
  const beak = new THREE.ConeGeometry(0.009, 0.024, 5);
  beak.rotateZ(-Math.PI / 2);
  g.add(beak, { tone: "dark", position: [0.162, 0.248, 0] });
  for (const s of [-1, 1]) g.add(sphere(0.005, 4, 3), { tone: "solid", position: [0.138, 0.258, s * 0.026] });
  const geo = jitter(g.build(), 0.003, rng.int(1, 99));
  geo.rotateY(turn);
  geo.translate(x, 0.02, z);
  k.addGeometry(geo);
}

export function chickenBox(c: BuildCtx): Built {
  const a = new Assembly(small(), "chicken-box");
  const W = 0.74,
    H = 0.38,
    D = 0.46,
    t = 0.014;
  // Floor, straw, the hen.
  a.add(slab(W, 0.02, D), { tone: "light" });
  for (let i = 0; i < 14; i++) {
    const x = c.rng.range(-W / 2 + 0.04, W / 2 - 0.04),
      z = c.rng.range(-D / 2 + 0.04, D / 2 - 0.04);
    const ang = c.rng.range(0, Math.PI);
    a.add(rod([x - Math.cos(ang) * 0.06, 0.024, z - Math.sin(ang) * 0.06], [x + Math.cos(ang) * 0.06, 0.03, z + Math.sin(ang) * 0.06], 0.003, 3), { tone: "mid" });
  }
  hen(a.kit, 0.05, 0.02, c.rng.range(-0.6, 0.6) + 0.3, c.rng);
  // Corner posts and rails.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) a.add(slab(0.035, H, 0.035), { tone: "pale", position: [sx * (W / 2 - 0.0175), 0, sz * (D / 2 - 0.0175)] });
  for (const [y, h] of [
    [0.02, 0.05],
    [H - 0.085, 0.085],
  ] as const) {
    for (const s of [-1, 1]) {
      a.add(slab(W, h, t), { tone: "pale", position: [0, y, s * (D / 2 - t / 2)] });
      a.add(slab(t, h, D), { tone: "pale", position: [s * (W / 2 - t / 2), y, 0] });
    }
  }
  // Slats with gaps: horizontal on the long sides, vertical on the ends, lid slats on top.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) a.add(slab(W - 0.07, 0.04, t), { tone: "paper", position: [0, 0.11 + i * 0.085, s * (D / 2 - t / 2)] });
    for (let i = 0; i < 4; i++) a.add(slab(t, H - 0.04, 0.045), { tone: "paper", position: [s * (W / 2 - t / 2), 0.02, -D / 2 + 0.08 + i * 0.1] });
  }
  for (let i = 0; i < 5; i++) a.add(slab(W, t, 0.05), { tone: "paper", position: [0, H, -D / 2 + 0.035 + i * 0.097] });
  const tex = inkTexture("poultry", 512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    stencil(g, "LIVE POULTRY", w / 2, h * 0.52, h * 0.5, { maxW: w * 0.94, bridge: "rgba(0,0,0,0)" });
  }, true);
  a.attach(printPlane(tex, 0.5, 0.075, [0, H - 0.042, D / 2 + 0.002], "front"));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: W, depth: D, height: H + t }, scalable: 0.5, placement: "surface" };
}

// ------------------------------------------------------------------ grain sacks

function sackLying(len: number, seed: number): THREE.BufferGeometry {
  const k = new Kit();
  const body = blob(len / 2, 0.12, 0.23, 0.42, 0.5, 14, 10);
  deform(body, (p) => {
    // Grain slumps to the bottom; the top sags between the ends.
    if (p.y > 0) p.y *= 0.85 + 0.15 * Math.abs(p.x / (len / 2));
    p.z *= 1 + 0.06 * (1 - p.y / 0.12);
  });
  k.add(body, { tone: "pale" });
  // Corner ears where the seams pinch.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) k.add(blob(0.035, 0.03, 0.03, 0.8, 0.8, 7, 5), { tone: "pale", position: [sx * (len / 2 - 0.01), 0.02, sz * 0.2], rotation: [0, sx * sz * 0.6, 0] });
  // Sewn end seam.
  k.add(rod([len / 2 - 0.015, 0.06, -0.2], [len / 2 - 0.015, 0.06, 0.2], 0.008, 4), { tone: "light" });
  const g = jitter(k.build(), 0.006, seed);
  g.translate(0, 0.11, 0);
  return g;
}

export function grainSacks(c: BuildCtx): Built {
  const a = new Assembly(large(), "grain-sacks");
  const L = 0.78;
  const bottom = [
    [-0.02, 0, -0.25, 0.04],
    [0.02, 0, 0.25, -0.05],
  ] as const;
  for (const [x, y, z, r] of bottom) {
    const g = sackLying(L, Math.round((x + z) * 100) + 3);
    g.rotateY(r);
    g.translate(x, y, z);
    a.kit.addGeometry(g);
  }
  const top = sackLying(L, 17);
  top.rotateY(c.rng.range(-0.2, 0.2));
  top.translate(0, 0.2, 0);
  a.kit.addGeometry(top);
  // A standing sack at the side, neck gathered and tied.
  const stand = new Kit();
  const body = blob(0.22, 0.3, 0.17, 0.55, 0.7, 14, 10);
  deform(body, (p) => {
    if (p.y > 0.12) {
      const s = 1 - Math.min(1, (p.y - 0.12) / 0.18) * 0.72;
      p.x *= s;
      p.z *= s;
    }
  });
  stand.add(body, { tone: "pale", position: [0, 0.3, 0] });
  stand.add(ring(0.055, 0.012, 5, 16), { tone: "dark", position: [0, 0.54, 0] });
  // Gathered neck above the tie, flaring into loose folds.
  const neck = turned(
    [
      [0.05, 0.0],
      [0.075, 0.035],
      [0.11, 0.075],
      [0.09, 0.095],
      [0.05, 0.08],
    ],
    12,
  );
  deform(neck, (p) => {
    const a = Math.atan2(p.z, p.x);
    const f = 1 + 0.22 * Math.sin(a * 5) * Math.max(0, p.y / 0.09);
    p.x *= f;
    p.z *= f;
    p.y += 0.012 * Math.sin(a * 3);
  });
  stand.add(neck, { tone: "pale", position: [0, 0.545, 0] });
  const sg = jitter(stand.build(), 0.006, 9);
  sg.rotateZ(0.08);
  sg.translate(0.62, 0, 0.05);
  a.kit.addGeometry(sg);
  const tex = inkTexture("sack", 320, 200, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    stencil(g, "GRAIN", w / 2, h * 0.36, h * 0.26, { maxW: w * 0.84, bridge: "rgba(0,0,0,0)" });
    stencil(g, "50 KG", w / 2, h * 0.76, h * 0.17, { maxW: w * 0.5, bridge: "rgba(0,0,0,0)" });
  }, true);
  a.attach(printPlane(tex, 0.34, 0.21, [0, 0.458, 0.02], "up", { segX: 6, segY: 4, warp: (x, y) => -0.02 * ((x / 0.2) ** 2 + (y / 0.2) ** 2), rotate: 0.03 }));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: 1.3, depth: 1.0, height: 0.72 }, scalable: 0, placement: "surface" };
}

// ------------------------------------------------------------------ suitcase

export function suitcase(c: BuildCtx): Built {
  const a = new Assembly(small(), "suitcase");
  const W = 0.64,
    H = 0.44,
    D = 0.2;
  a.add(cblock(W, H, D, 0.022), { tone: "light" });
  // Piping round the lid seam.
  const zs = 0.035;
  a.add(slab(W + 0.006, 0.008, 0.008), { tone: "mid", position: [0, H - 0.004, zs] });
  a.add(slab(W + 0.006, 0.008, 0.008), { tone: "mid", position: [0, -0.004, zs] });
  for (const s of [-1, 1]) a.add(slab(0.008, H, 0.008), { tone: "mid", position: [s * (W / 2 + 0.002), 0, zs] });
  // Corner caps.
  for (const sx of [-1, 1])
    for (const sy of [0, 1])
      for (const sz of [-1, 1]) a.add(blob(0.03, 0.03, 0.03, 0.5, 0.5, 8, 6), { tone: "mid", position: [sx * (W / 2 - 0.018), sy * H + (sy ? -0.018 : 0.018), sz * (D / 2 - 0.018)] });
  // Two leather straps with buckles.
  for (const x of [-0.19, 0.19]) {
    a.add(slab(0.04, H + 0.006, 0.006), { tone: "mid", position: [x, -0.003, D / 2 + 0.002] });
    a.add(slab(0.04, 0.006, D + 0.012), { tone: "mid", position: [x, H, 0] });
    a.add(slab(0.04, H + 0.006, 0.006), { tone: "mid", position: [x, -0.003, -D / 2 - 0.002] });
    const buckle = plate(roundRect(0.055, 0.04, 0.006, 2), 0.006, 0, [roundRect(0.035, 0.022, 0.003, 2)]);
    a.add(buckle, { tone: "deep", position: [x, H * 0.72, D / 2 + 0.007] });
  }
  // Handle on the top edge with its two loops, two latches.
  a.add(
    sweep(
      [
        [-0.07, H + 0.012, 0.0],
        [-0.055, H + 0.045, 0.0],
        [0, H + 0.055, 0.0],
        [0.055, H + 0.045, 0.0],
        [0.07, H + 0.012, 0.0],
      ],
      () => 0.011,
      14,
      6,
    ),
    { tone: "deep" },
  );
  for (const s of [-1, 1]) {
    a.add(cblock(0.03, 0.018, 0.03, 0.004), { tone: "mid", position: [s * 0.075, H - 0.004, 0] });
    a.add(cblock(0.035, 0.014, 0.03, 0.004), { tone: "dark", position: [s * 0.2, H - 0.004, zs] });
  }
  // Luggage tag on a string from the handle, hanging down the front.
  const tagWords = (c.label ?? "PLEASE RETURN").toUpperCase().slice(0, 16);
  const tagTex = inkTexture(`tag:${tagWords}`, 160, 256, (g, w, h) => {
    const r = c.rng.fork("tag");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 3, 3, w - 6, h - 6, 4);
    g.beginPath();
    g.arc(w / 2, h * 0.1, w * 0.08, 0, Math.PI * 2);
    g.lineWidth = 5;
    g.stroke();
    marker(g, tagWords, w / 2, h * 0.36, h * 0.07, r, { maxW: w * 0.84 });
    greek(g, w * 0.12, h * 0.55, w * 0.76, h * 0.07, 4, r, { color: "#223" });
  });
  a.add(wire([[0.03, H + 0.05, 0.004], [0.06, H + 0.02, 0.05], [0.09, H - 0.02, D / 2 + 0.012]], 0.0016, 8, 3), { tone: "solid" });
  a.add(cbox(0.05, 0.085, 0.002, 0.001), { tone: "paper", position: [0.1, H - 0.066, D / 2 + 0.014], rotation: [0, 0, -0.18] });
  a.attach(printPlane(tagTex, 0.048, 0.082, [0.1, H - 0.066, D / 2 + 0.0156], "front", { rotate: -0.18 }));
  // Travel labels on the front face (transparent sheet, only the labels print).
  const stickers = inkTexture(`stickers:${c.variant % 3}`, 512, 352, (g, w, h) => {
    const r = c.rng.fork("stickers");
    g.clearRect(0, 0, w, h);
    const round = (x: number, y: number, rad: number, top: string, mid: string) => {
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#000";
      g.lineWidth = rad * 0.07;
      g.stroke();
      g.beginPath();
      g.arc(x, y, rad * 0.8, 0, Math.PI * 2);
      g.lineWidth = rad * 0.03;
      g.stroke();
      text(g, top, x, y - rad * 0.45, rad * 0.16, { maxW: rad * 1.2 });
      text(g, mid, x, y + rad * 0.05, rad * 0.3, { maxW: rad * 1.5, weight: "900" });
    };
    const rect = (x: number, y: number, rw: number, rh: number, ang: number, a1: string, a2: string) => {
      g.save();
      g.translate(x, y);
      g.rotate(ang);
      g.fillStyle = "#fff";
      g.fillRect(-rw / 2, -rh / 2, rw, rh);
      g.fillStyle = "#000";
      g.fillRect(-rw / 2, -rh / 2, rw, rh * 0.36);
      g.strokeRect(-rw / 2, -rh / 2, rw, rh);
      text(g, a1, 0, -rh * 0.32, rh * 0.18, { color: "#fff", maxW: rw * 0.9 });
      text(g, a2, 0, rh * 0.18, rh * 0.22, { maxW: rw * 0.86 });
      g.restore();
    };
    round(w * 0.24, h * 0.34, h * 0.2, "GRAND HOTEL", "MERIDIAN");
    rect(w * 0.7, h * 0.26, w * 0.34, h * 0.22, 0.12, "EXPRESS", "LINE SEVEN");
    rect(w * 0.36, h * 0.76, w * 0.3, h * 0.2, -0.08, "LEFT LUGGAGE", "No. 0640");
    if (r.chance(0.7)) round(w * 0.78, h * 0.72, h * 0.15, "VISITED", "THE COAST");
  }, true);
  a.attach(printPlane(stickers, W * 0.86, W * 0.86 * (352 / 512), [0, H * 0.48, D / 2 + 0.0015], "front", { objectId: 0.62 }));
  const o = a.build();
  if (c.variant % 3 === 2) {
    // Lying flat, face up.
    o.rotation.x = -Math.PI / 2;
    o.position.set(0, D / 2, H / 2);
    const g = new THREE.Group();
    g.add(o);
    g.rotation.y = c.rng.range(-0.4, 0.4);
    return { object: g, footprint: { width: W, depth: H, height: D }, scalable: 0.6, placement: "surface" };
  }
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: W, depth: D, height: H + 0.06 }, scalable: 0.6, placement: "surface" };
}

// ------------------------------------------------------------------ bag

export function bag(c: BuildCtx): Built {
  const v = c.variant % 3;
  const a = new Assembly(small(), "bag");
  if (v === 0 || v === 1) {
    // Gladstone (doctor's) bag: trapezoid body, hinged frame, clasp, handles, straps.
    const L = 0.42;
    const body = plate(
      [
        [-0.105, 0.035],
        [-0.092, 0.006],
        [-0.075, 0.0],
        [0.075, 0.0],
        [0.092, 0.006],
        [0.105, 0.035],
        [0.078, 0.236],
        [0.045, 0.262],
        [-0.045, 0.262],
        [-0.078, 0.236],
      ],
      L,
      0.014,
    );
    body.rotateY(Math.PI / 2);
    a.add(body, { tone: "dark" });
    for (const s of [-1, 1]) a.add(rod([-L / 2 - 0.004, 0.262, s * 0.036], [L / 2 + 0.004, 0.262, s * 0.036], 0.008, 6), { tone: "light" });
    for (const s of [-1, 1]) a.add(cbox(0.02, 0.05, 0.08, 0.005), { tone: "light", position: [s * (L / 2 + 0.006), 0.245, 0] });
    a.add(cbox(0.05, 0.03, 0.02, 0.004), { tone: "light", position: [0, 0.245, 0.05] });
    a.add(cbox(0.018, 0.022, 0.008, 0.003), { tone: "solid", position: [0, 0.232, 0.062] });
    for (const dz of [-0.012, 0.012])
      a.add(
        sweep(
          [
            [-0.085, 0.268, dz],
            [-0.07, 0.33, dz],
            [0, 0.35, dz],
            [0.07, 0.33, dz],
            [0.085, 0.268, dz],
          ],
          () => 0.009,
          14,
          5,
        ),
        { tone: "deep" },
      );
    for (const x of [-0.13, 0.13]) {
      a.add(slab(0.026, 0.23, 0.006), { tone: "deep", position: [x, 0.012, 0.1] });
      a.add(cbox(0.032, 0.026, 0.008, 0.002), { tone: "light", position: [x, 0.19, 0.104] });
    }
    const o = a.build();
    o.rotation.y = c.rng.range(-0.5, 0.5);
    return { object: o, footprint: { width: L + 0.03, depth: 0.22, height: 0.35 }, scalable: 1, placement: "surface" };
  }
  // Canvas tote, slumped, a baguette and greens poking out.
  const body = blob(0.18, 0.17, 0.06, 0.3, 0.35, 14, 10);
  deform(body, (p) => {
    if (p.y > 0.04) p.z *= 1 - 0.35 * ((p.y - 0.04) / 0.13);
    p.x *= 1 + 0.08 * Math.max(0, p.y / 0.17);
  });
  a.add(jitter(body, 0.003, 3), { tone: "paper", position: [0, 0.165, 0] });
  for (const x of [-0.08, 0.08])
    a.add(
      sweep(
        [
          [x - 0.035, 0.3, 0.02],
          [x - 0.02, 0.42, 0.03],
          [x + 0.02, 0.43, 0.03],
          [x + 0.035, 0.3, 0.02],
        ],
        () => 0.008,
        12,
        4,
      ),
      { tone: "light" },
    );
  const loaf = new Kit();
  loaf.add(blob(0.03, 0.17, 0.028, 0.5, 0.9, 10, 8), { tone: "light" });
  for (let i = 0; i < 4; i++) loaf.add(cbox(0.034, 0.008, 0.012, 0.002), { tone: "deep", position: [0, -0.1 + i * 0.06, 0.024], rotation: [0.2, 0, 0.5] });
  const lg = loaf.build();
  lg.rotateZ(0.42);
  lg.rotateX(-0.12);
  lg.translate(-0.04, 0.36, 0.0);
  a.kit.addGeometry(lg);
  for (let i = 0; i < 3; i++) a.add(rod([0.05 + i * 0.015, 0.28, -0.005], [0.07 + i * 0.03, 0.4, -0.01], 0.004, 4), { tone: "mid", accent: "leaf", accentAmount: 0.6 });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.5, 0.5);
  return { object: o, footprint: { width: 0.4, depth: 0.18, height: 0.55 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ toolbox

export function toolbox(c: BuildCtx): Built {
  const a = new Assembly(small(), "toolbox");
  const W = 0.5,
    H = 0.17,
    D = 0.21;
  a.add(cblock(W, H, D, 0.006), { tone: "light" });
  a.add(slab(W + 0.006, 0.012, D + 0.006), { tone: "light", position: [0, H - 0.012, 0] });
  // Hip-roof lid.
  const lid = plate(
    [
      [-D / 2 - 0.003, 0],
      [D / 2 + 0.003, 0],
      [D / 2 - 0.035, 0.05],
      [-D / 2 + 0.035, 0.05],
    ],
    W + 0.004,
    0.003,
  );
  lid.rotateY(Math.PI / 2);
  a.add(lid, { tone: "light", position: [0, H, 0] });
  // Handle in its brackets.
  for (const s of [-1, 1]) a.add(cblock(0.014, 0.03, 0.03, 0.003), { tone: "mid", position: [s * 0.1, H + 0.045, 0] });
  a.add(rod([-0.1, H + 0.07, 0], [0.1, H + 0.07, 0], 0.011, 8), { tone: "deep" });
  for (const s of [-1, 1]) {
    a.add(cbox(0.04, 0.04, 0.012, 0.004), { tone: "mid", position: [s * 0.17, H - 0.012, D / 2 + 0.007] });
    a.add(cbox(0.018, 0.016, 0.014, 0.003), { tone: "deep", position: [s * 0.17, H - 0.026, D / 2 + 0.012] });
  }
  const word = (c.label ?? "CREW 4").toUpperCase().slice(0, 12);
  const tex = inkTexture(`toolbox:${word}`, 384, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    stencil(g, word, w / 2, h / 2, h * 0.46, { maxW: w * 0.9, bridge: "rgba(0,0,0,0)" });
  }, true);
  a.attach(printPlane(tex, 0.24, 0.08, [0, H * 0.42, D / 2 + 0.0015], "front"));
  // A claw hammer laid against it.
  const hx = 0.05,
    hz = D / 2 + 0.08;
  a.add(rod([hx - 0.15, 0.015, hz + 0.02], [hx + 0.14, 0.015, hz - 0.01], 0.013, 7, 0.011), { tone: "pale" });
  a.add(cbox(0.03, 0.03, 0.11, 0.004), { tone: "deep", position: [hx + 0.15, 0.018, hz - 0.012], rotation: [0, 0.1, 0] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.4, 0.4);
  return { object: o, footprint: { width: W, depth: D + 0.12, height: H + 0.08 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ oxygen cylinder on its cart

export function oxygenCylinder(c: BuildCtx): Built {
  const a = new Assembly(small(), "oxygen-cylinder");
  const lean = 0.2;
  const cyl = new Kit();
  const R = 0.058;
  cyl.add(
    turned(
      [
        [0, 0.0],
        [R - 0.01, 0.0],
        [R, 0.012],
        [R, 0.56],
      ],
      14,
    ),
    { tone: "light" },
  );
  cyl.add(
    turned(
      [
        [R, 0.56],
        [R - 0.004, 0.6],
        [0.042, 0.63],
        [0.022, 0.648],
        [0.018, 0.656],
      ],
      14,
    ),
    { tone: "paper" },
  );
  // Valve, handwheel, regulator with gauge, outlet.
  cyl.add(cbox(0.03, 0.05, 0.03, 0.004), { tone: "mid", position: [0, 0.68, 0] });
  cyl.add(ring(0.024, 0.004, 4, 14), { tone: "deep", position: [0, 0.715, 0] });
  cyl.add(rodY(0.004, 0.7, 0.72, 5), { tone: "deep" });
  cyl.add(rod([0, 0.67, 0.012], [0, 0.67, 0.05], 0.012, 8), { tone: "mid" });
  cyl.add(rod([0, 0.67, 0.05], [0, 0.67, 0.065], 0.026, 16), { tone: "mid" });
  cyl.add(rod([0.012, 0.67, 0.02], [0.05, 0.66, 0.02], 0.006, 6), { tone: "mid" });
  cyl.add(
    wire(
      [
        [0.05, 0.66, 0.02],
        [0.09, 0.6, 0.06],
        [0.08, 0.4, 0.1],
        [0.02, 0.3, 0.1],
        [-0.03, 0.36, 0.08],
        [-0.02, 0.5, 0.07],
      ],
      0.004,
      24,
      4,
    ),
    { tone: "pale" },
  );
  const cg = cyl.build();
  cg.rotateX(-lean);
  cg.translate(0, 0.07, 0.02);
  a.kit.addGeometry(cg);
  // Gauge dial.
  const dial = inkTexture("o2gauge", 128, 128, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.lineWidth = 6;
    g.strokeStyle = "#000";
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i <= 10; i++) {
      const an = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      g.fillStyle = i > 7 ? RED : "#000";
      g.save();
      g.translate(w / 2 + Math.sin(an) * w * 0.34, h / 2 - Math.cos(an) * w * 0.34);
      g.rotate(an);
      g.fillRect(-2, -7, 4, 14);
      g.restore();
    }
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(0.9);
    g.fillStyle = "#000";
    g.fillRect(-2, -w * 0.32, 4, w * 0.36);
    g.restore();
  });
  const dm = printPlane(dial, 0.046, 0.046, [0, 0, 0], "front");
  if (dm) {
    const circ = new THREE.CircleGeometry(0.023, 18);
    dm.geometry.dispose();
    dm.geometry = circ;
    const m = new THREE.Matrix4().makeRotationX(-lean).multiply(new THREE.Matrix4().makeTranslation(0, 0.67, 0.0655));
    dm.geometry.applyMatrix4(m);
    dm.geometry.translate(0, 0.07, 0.02);
    a.attach(dm);
  }
  const lab = inkTexture("o2label", 512, 160, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h * 0.08);
    g.fillRect(0, h * 0.92, w, h * 0.08);
    text(g, "OXYGEN", w * 0.34, h * 0.42, h * 0.3, { maxW: w * 0.5 });
    text(g, "MEDICAL · O2", w * 0.34, h * 0.76, h * 0.12, { maxW: w * 0.46 });
    // Oxidiser diamond.
    g.save();
    g.translate(w * 0.82, h * 0.5);
    g.rotate(Math.PI / 4);
    g.lineWidth = 8;
    g.strokeRect(-h * 0.26, -h * 0.26, h * 0.52, h * 0.52);
    g.restore();
    text(g, "5.1", w * 0.82, h * 0.52, h * 0.1);
  });
  const lp = printPlane(lab, 0.17, 0.053, [0, 0, 0], "front", { segX: 8, warp: (x) => Math.sqrt(Math.max(0, (R + 0.0015) ** 2 - x * x)) - (R + 0.0015) });
  if (lp) {
    lp.geometry.translate(0, 0.38, R + 0.0015);
    lp.geometry.rotateX(-lean);
    lp.geometry.translate(0, 0.07, 0.02);
    a.attach(lp);
  }
  // Cart: foot shelf, twin uprights with a handle loop, retaining band, axle and wheels.
  a.add(cblock(0.16, 0.012, 0.14, 0.003), { tone: "dark", position: [0, 0.055, 0.03] });
  const topY = 0.82;
  for (const s of [-1, 1]) {
    a.add(rod([s * 0.07, 0.06, -0.03], [s * 0.07, topY, -0.03 - topY * Math.tan(lean) * 0.95], 0.011, 6), { tone: "dark" });
  }
  a.add(
    wire(
      [
        [-0.07, topY, -0.03 - topY * 0.19],
        [-0.06, topY + 0.07, -0.2],
        [0.06, topY + 0.07, -0.2],
        [0.07, topY, -0.03 - topY * 0.19],
      ],
      0.011,
      12,
      5,
    ),
    { tone: "dark" },
  );
  const bandG = ring(R + 0.006, 0.006, 4, 18);
  bandG.rotateX(-lean);
  a.add(bandG, { tone: "dark", position: [0, 0.52, -0.08] });
  a.add(rod([-0.13, 0.085, -0.07], [0.13, 0.085, -0.07], 0.01, 6), { tone: "dark" });
  for (const s of [-1, 1]) {
    const tyre = hoop(0.072, 0.017, 6, 20);
    tyre.rotateY(Math.PI / 2);
    a.add(tyre, { tone: "deep", position: [s * 0.14, 0.09, -0.07] });
    const hub = cylinder(0.035, 0.035, 0.03, 12);
    hub.rotateZ(Math.PI / 2);
    a.add(hub, { tone: "light", position: [s * 0.14, 0.09, -0.07] });
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.4, 0.4);
  return { object: o, footprint: { width: 0.34, depth: 0.36, height: 0.9 }, scalable: 0.3, placement: "surface" };
}

// ------------------------------------------------------------------ fuel drum

export function fuelDrum(c: BuildCtx): Built {
  const a = new Assembly(small(), "fuel-drum");
  // 205 L steel drum: 585 mm across the rolling hoops, 880 mm tall.
  a.add(
    turned(
      [
        [0, 0.012],
        [0.272, 0.012],
        [0.284, 0.0],
        [0.293, 0.004],
        [0.293, 0.018],
        [0.287, 0.022],
        [0.287, 0.28],
        [0.297, 0.288],
        [0.297, 0.3],
        [0.287, 0.308],
        [0.287, 0.572],
        [0.297, 0.58],
        [0.297, 0.592],
        [0.287, 0.6],
        [0.287, 0.858],
        [0.293, 0.862],
        [0.293, 0.878],
        [0.284, 0.882],
        [0.272, 0.868],
        [0, 0.868],
      ],
      28,
    ),
    { tone: "light" },
  );
  a.add(cylinder(0.03, 0.032, 0.014, 10), { tone: "dark", position: [0.18, 0.874, 0.04] });
  a.add(cylinder(0.018, 0.02, 0.012, 8), { tone: "dark", position: [-0.2, 0.873, -0.05] });
  const word = (c.label ?? "DIESEL").toUpperCase().slice(0, 10);
  const tex = inkTexture(`drum:${word}`, 512, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    stencil(g, word, w / 2, h * 0.2, h * 0.14, { maxW: w * 0.84, bridge: "rgba(0,0,0,0)" });
    // Flammable diamond in signal red with a black flame.
    g.save();
    g.translate(w / 2, h * 0.62);
    g.rotate(Math.PI / 4);
    const s = h * 0.23;
    g.fillStyle = RED;
    g.fillRect(-s, -s, s * 2, s * 2);
    g.strokeStyle = "#fff";
    g.lineWidth = 5;
    g.strokeRect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
    g.restore();
    g.fillStyle = "#000";
    g.beginPath();
    const fx = w / 2,
      fy = h * 0.6;
    g.moveTo(fx - h * 0.07, fy + h * 0.08);
    g.quadraticCurveTo(fx - h * 0.09, fy - h * 0.02, fx - h * 0.02, fy - h * 0.12);
    g.quadraticCurveTo(fx - h * 0.02, fy - h * 0.04, fx + h * 0.02, fy - h * 0.03);
    g.quadraticCurveTo(fx + h * 0.09, fy + h * 0.0, fx + h * 0.07, fy + h * 0.08);
    g.closePath();
    g.fill();
    text(g, "3", w / 2, h * 0.76, h * 0.06, { color: "#fff" });
  }, true);
  a.attach(printPlane(tex, 0.5, 0.375, [0, 0.44, 0], "front", { segX: 10, warp: (x) => Math.sqrt(Math.max(0, (0.2885) ** 2 - x * x)) }));
  const o = a.build();
  if (c.variant % 3 === 2) {
    const g = new THREE.Group();
    o.rotation.z = Math.PI / 2;
    o.position.set(0.44, 0.297, 0);
    g.add(o);
    g.rotation.y = c.rng.range(-0.6, 0.6);
    return { object: g, footprint: { width: 0.88, depth: 0.6, height: 0.6 }, scalable: 0.3, placement: "surface" };
  }
  o.rotation.y = c.rng.range(-0.5, 0.5);
  return { object: o, footprint: { width: 0.6, depth: 0.6, height: 0.88 }, scalable: 0.3, placement: "surface" };
}

// ------------------------------------------------------------------ water tank (IBC tote)

export function waterTank(c: BuildCtx): Built {
  const a = new Assembly(large(), "water-tank");
  const W = 1.2,
    D = 1.0,
    base = 0.15,
    top = 1.16;
  // Pallet: runners, deck, corner blocks.
  for (const z of [-0.42, 0, 0.42]) a.add(slab(W, 0.1, 0.12), { tone: "light", position: [0, 0, z] });
  a.add(slab(W, 0.03, D), { tone: "light", position: [0, 0.1, 0] });
  // Translucent tank: the water line shows as a change of tone.
  const hh = (top - base - 0.04) / 2;
  const tank = blob(W / 2 - 0.04, hh, D / 2 - 0.04, 0.2, 0.18, 18, 14);
  a.add(tank, { tone: "paper", position: [0, base + 0.02 + hh, 0] });
  a.add(cylinder(0.08, 0.08, 0.04, 16), { tone: "mid", position: [0, top - 0.02, 0] });
  a.add(cylinder(0.07, 0.07, 0.02, 16), { tone: "dark", position: [0, top + 0.01, 0] });
  // Outlet valve at the front foot.
  a.add(rod([0, 0.28, D / 2 - 0.06], [0, 0.28, D / 2 + 0.06], 0.035, 10), { tone: "dark" });
  a.add(cbox(0.1, 0.08, 0.07, 0.01), { tone: "dark", position: [0, 0.28, D / 2 + 0.08] });
  a.add(cbox(0.2, 0.025, 0.03, 0.006), { tone: "deep", position: [0.08, 0.33, D / 2 + 0.08], rotation: [0, 0, 0.1] });
  // Galvanised cage.
  const r = 0.011;
  const levels = [base + 0.06, base + 0.34, base + 0.62, base + 0.9, top - 0.02];
  const hx = W / 2,
    hz = D / 2;
  for (const y of levels) {
    for (const s of [-1, 1]) {
      a.add(rod([-hx, y, s * hz], [hx, y, s * hz], r, 5), { tone: "light" });
      a.add(rod([s * hx, y, -hz], [s * hx, y, hz], r, 5), { tone: "light" });
    }
  }
  for (let i = 0; i <= 6; i++) {
    const x = -hx + (i / 6) * W;
    for (const s of [-1, 1]) a.add(rod([x, base, s * hz], [x, top, s * hz], r, 5), { tone: "light" });
  }
  for (let i = 1; i < 5; i++) {
    const z = -hz + (i / 5) * D;
    for (const s of [-1, 1]) a.add(rod([s * hx, base, z], [s * hx, top, z], r, 5), { tone: "light" });
  }
  for (const z of [-0.25, 0.25]) a.add(rod([-hx, top, z], [hx, top, z], r, 5), { tone: "light" });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(cblock(0.04, top - base + 0.02, 0.04, 0.005), { tone: "light", position: [sx * hx, base, sz * hz] });
  const word = (c.label ?? "POTABLE WATER").toUpperCase().slice(0, 16);
  const tex = inkTexture(`ibc:${word}`, 512, 448, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    // Water below the line: a light wash of hatch.
    g.fillStyle = "#b8b8b8";
    g.fillRect(0, h * 0.38, w, h * 0.62);
    g.fillStyle = "#000";
    g.fillRect(0, h * 0.375, w, 3);
    // Graduations down the left.
    for (let i = 0; i <= 10; i++) {
      const y = h * 0.06 + (i / 10) * h * 0.88;
      g.fillRect(w * 0.04, y, i % 5 === 0 ? w * 0.08 : w * 0.045, 3);
      if (i % 2 === 0) text(g, String(1000 - i * 100), w * 0.15, y, h * 0.028, { align: "left" });
    }
    stencil(g, word, w * 0.58, h * 0.2, h * 0.07, { maxW: w * 0.72, bridge: "rgba(0,0,0,0)" });
  });
  a.attach(printPlane(tex, 0.78, 0.68, [0, base + 0.02 + hh, D / 2 - 0.035], "front", { objectId: 0.62 }));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: W, depth: D + 0.12, height: top + 0.03 }, scalable: 0, placement: "surface" };
}

// ------------------------------------------------------------------ generator

export function generator(c: BuildCtx): Built {
  const a = new Assembly(small(), "generator");
  const hx = 0.3,
    hz = 0.22,
    Ht = 0.5;
  // Tubular frame: a rounded loop each side, cross bars, rubber feet.
  for (const s of [-1, 1]) {
    const pts: V3[] = [
      [s * hx, 0.03, -hz],
      [s * hx, 0.03, hz],
      [s * hx, Ht - 0.03, hz],
      [s * hx, Ht, hz - 0.04],
      [s * hx, Ht, -hz + 0.04],
      [s * hx, Ht - 0.03, -hz],
    ];
    a.add(wire(pts, 0.014, 28, 5, true), { tone: "deep" });
    for (const z of [-hz, hz]) a.add(cylinder(0.022, 0.026, 0.03, 8), { tone: "solid", position: [s * hx, 0.015, z] });
  }
  for (const [y, z] of [
    [0.03, -hz],
    [0.03, hz],
    [Ht, -hz + 0.04],
    [Ht, hz - 0.04],
  ] as const)
    a.add(rod([-hx, y, z], [hx, y, z], 0.013, 6), { tone: "deep" });
  // Fuel tank, filler cap and gauge.
  a.add(blob(0.25, 0.075, 0.18, 0.3, 0.35), { tone: "light", position: [0, Ht - 0.05, 0] });
  a.add(cylinder(0.035, 0.038, 0.03, 12), { tone: "deep", position: [0.14, Ht + 0.03, -0.05] });
  a.add(cylinder(0.022, 0.022, 0.006, 12), { tone: "paper", position: [-0.12, Ht + 0.025, 0.07] });
  // Engine block with finned head, recoil starter, air filter.
  a.add(cbox(0.2, 0.2, 0.2, 0.02), { tone: "mid", position: [0.1, 0.17, -0.02] });
  for (let i = 0; i < 6; i++) a.add(slab(0.16, 0.006, 0.17), { tone: "mid", position: [0.1, 0.27 + i * 0.016, -0.03] });
  a.add(turned([[0, 0], [0.09, 0], [0.095, 0.01], [0.09, 0.05], [0.06, 0.07], [0, 0.072]], 18).rotateZ(-Math.PI / 2), { tone: "light", position: [0.2, 0.18, -0.02] });
  a.add(cbox(0.03, 0.02, 0.05, 0.006), { tone: "deep", position: [0.29, 0.2, 0.02] });
  a.add(cbox(0.1, 0.12, 0.08, 0.01), { tone: "light", position: [0.08, 0.3, 0.12] });
  // Alternator drum with vent slots.
  const alt = turned([[0, 0], [0.1, 0], [0.105, 0.01], [0.105, 0.17], [0.1, 0.18], [0, 0.18]], 20);
  alt.rotateZ(Math.PI / 2);
  a.add(alt, { tone: "light", position: [-0.02, 0.17, -0.02] });
  for (let i = 0; i < 5; i++) a.add(slab(0.012, 0.004, 0.09), { tone: "solid", position: [-0.18 + i * 0.03, 0.272, -0.02] });
  // Muffler guard at the back.
  a.add(rod([-0.2, 0.34, -0.15], [0.02, 0.34, -0.15], 0.05, 12), { tone: "dark" });
  // Control panel facing the front.
  a.add(cbox(0.24, 0.16, 0.02, 0.004), { tone: "pale", position: [-0.1, 0.2, 0.15] });
  const tex = inkTexture("genpanel", 384, 256, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 3, 3, w - 6, h - 6, 5);
    text(g, "230 V ~ 3.2 kW", w / 2, h * 0.14, h * 0.07);
    for (const x of [w * 0.28, w * 0.62]) {
      g.beginPath();
      g.arc(x, h * 0.55, h * 0.18, 0, Math.PI * 2);
      g.lineWidth = 5;
      g.stroke();
      g.fillStyle = "#000";
      g.fillRect(x - 12, h * 0.48, 7, 18);
      g.fillRect(x + 5, h * 0.48, 7, 18);
      g.fillRect(x - 3, h * 0.6, 7, 14);
    }
    g.beginPath();
    g.arc(w * 0.88, h * 0.4, h * 0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = RED;
    g.fillRect(w * 0.83, h * 0.68, w * 0.1, h * 0.12);
  });
  a.attach(printPlane(tex, 0.22, 0.146, [-0.1, 0.2, 0.1605], "front"));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.4, 0.4);
  return { object: o, footprint: { width: 0.64, depth: 0.48, height: Ht + 0.05 }, scalable: 0.3, placement: "surface" };
}

// ------------------------------------------------------------------ shovel

function shovelGeometry(): THREE.BufferGeometry {
  // Along +Y: blade mouth at y = 0, D-handle at the top.
  const k = new Kit();
  const bw = 0.26,
    bl = 0.3;
  const blade = plate(
    [
      [-bw / 2, 0],
      [bw / 2, 0],
      [bw / 2, bl * 0.82],
      [0.04, bl],
      [-0.04, bl],
      [-bw / 2, bl * 0.82],
    ],
    0.004,
  );
  deform(blade, (p) => {
    p.z -= 0.03 * (1 - (p.x / (bw / 2)) ** 2) * (1 - p.y / bl) * 0.6;
  });
  k.add(blade, { tone: "mid" });
  for (const s of [-1, 1]) {
    const flange = plate(
      [
        [0, 0],
        [bl * 0.82, 0],
        [bl * 0.82, 0.02],
        [0, 0.035],
      ],
      0.004,
    );
    flange.rotateZ(Math.PI / 2);
    flange.rotateY(Math.PI / 2);
    k.add(flange, { tone: "mid", position: [s * (bw / 2), 0, 0.0] });
  }
  k.add(rodY(0.022, bl - 0.02, bl + 0.12, 10, 0.02), { tone: "dark" });
  k.add(rodY(0.018, bl + 0.1, bl + 0.82, 8), { tone: "pale" });
  const hy = bl + 0.82;
  k.add(
    wire(
      [
        [-0.01, hy - 0.02, 0],
        [-0.06, hy + 0.08, 0],
        [-0.06, hy + 0.15, 0],
        [0.06, hy + 0.15, 0],
        [0.06, hy + 0.08, 0],
        [0.01, hy - 0.02, 0],
      ],
      0.012,
      18,
      5,
    ),
    { tone: "pale" },
  );
  k.add(rod([-0.06, hy + 0.15, 0], [0.06, hy + 0.15, 0], 0.017, 8), { tone: "pale" });
  return k.build();
}

export function shovel(c: BuildCtx): Built {
  const a = new Assembly(small(), "shovel");
  if (c.variant % 3 !== 2) {
    // Driven into a heap of spoil, leaning.
    const heap = blob(0.32, 0.16, 0.28, 1, 1, 14, 8);
    deform(heap, (p) => {
      if (p.y < 0) p.y = 0;
      p.y *= 1 - 0.3 * Math.hypot(p.x / 0.32, p.z / 0.28);
    });
    a.add(jitter(heap, 0.025, 5), { tone: "light" });
    for (let i = 0; i < 9; i++) {
      const ang = c.rng.range(0, Math.PI * 2),
        rr = c.rng.range(0.3, 0.45);
      a.add(new THREE.IcosahedronGeometry(c.rng.range(0.018, 0.035), 0), { tone: "mid", position: [Math.cos(ang) * rr, 0.015, Math.sin(ang) * rr] });
    }
    const s = shovelGeometry();
    s.translate(0, -0.14, 0);
    s.rotateZ(0.22);
    s.rotateX(-0.12);
    s.translate(0.02, 0.1, 0.02);
    a.kit.addGeometry(s);
    const o = a.build();
    o.rotation.y = c.rng.range(-0.8, 0.8);
    return { object: o, footprint: { width: 0.7, depth: 0.6, height: 1.2 }, scalable: 0, placement: "surface" };
  }
  const s = shovelGeometry();
  s.rotateX(-Math.PI / 2);
  s.rotateZ(0.02);
  restOnGround(s, true);
  a.kit.addGeometry(s);
  const o = a.build();
  o.rotation.y = c.rng.range(0, Math.PI);
  return { object: o, footprint: { width: 0.3, depth: 1.3, height: 0.1 }, scalable: 0.3, placement: "surface" };
}

