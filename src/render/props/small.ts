/**
 * Small props: the hand-sized stakes that sit on a rail head. Each is built
 * at true size and relies on the caller's readability scale (up to 2x).
 * Silhouettes are chosen to survive 20-40 m: a cup reads by its dark lid and
 * sleeve, a bell by its flare, a hat by its brim.
 */
import * as THREE from "three";
import { cylinder, sphere, deform, jitter } from "../core/geometry.ts";
import {
  Assembly,
  HATCH,
  OBJECT_ID,
  band,
  beam,
  blob,
  cblock,
  cbox,
  circle,
  hoop,
  plate,
  propMaterial,
  restOnGround,
  ring,
  rod,
  rodY,
  roundRect,
  sheet,
  sweep,
  turned,
  wire,
  type V3,
} from "./common.ts";
import { RED, SANS, frame, greek, inkTexture, marker, printPlane, stamp, text } from "./print.ts";
import type { BuildCtx, Built } from "./types.ts";
import { Kit } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";

const tiny = () => propMaterial(HATCH.tiny);
const small = () => propMaterial(HATCH.small);

// ------------------------------------------------------------------ coffee cup

export function coffeeCup(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "coffee-cup");
  // 12 oz paper cup: 90 mm rim, 60 mm base, 110 mm tall, recessed foot.
  a.add(
    turned(
      [
        [0, 0.004],
        [0.028, 0.004],
        [0.0292, 0.0],
        [0.0302, 0.0],
        [0.0305, 0.004],
        [0.044, 0.104],
      ],
      22,
    ),
    { tone: "paper" },
  );
  // Corrugated card sleeve, proud of the wall with crisp top and bottom edges.
  a.add(
    turned(
      [
        [0.0335, 0.03],
        [0.0351, 0.03],
        [0.0423, 0.082],
        [0.0409, 0.082],
      ],
      22,
    ),
    { tone: "light" },
  );
  // Sleeve seam: a narrow overlap flap.
  a.add(beam([0.0343, 0.031, 0.0048], [0.0418, 0.081, 0.0058], 0.009, 0.0016, [0, 0, 1]), { tone: "light", rotation: [0, 0.9, 0] });
  // Lid: rolled bead over the rim, recessed deck, raised drinking dome.
  a.add(
    turned(
      [
        [0.0436, 0.1025],
        [0.0472, 0.1038],
        [0.0479, 0.108],
        [0.0472, 0.1112],
        [0.0446, 0.1124],
        [0.0412, 0.1127],
        [0.0392, 0.1185],
        [0.0345, 0.1208],
        [0, 0.1214],
      ],
      22,
    ),
    { tone: "deep" },
  );
  // Sip spout and its slot, toward the front.
  a.add(cbox(0.02, 0.0045, 0.01, 0.0018), { tone: "deep", position: [0, 0.1224, 0.027] });
  a.add(cbox(0.01, 0.0012, 0.0032, 0.0004), { tone: "solid", position: [0, 0.1248, 0.0285] });
  // Vent pinhole.
  a.add(cylinder(0.0018, 0.0018, 0.002, 6), { tone: "solid", position: [0, 0.1216, -0.02] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.5, 0.5);
  return { object: o, footprint: { width: 0.096, depth: 0.096, height: 0.125 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ hats

function brim(inner: number, outer: number, t: number, seg = 32): THREE.BufferGeometry {
  return turned(
    [
      [inner, 0],
      [outer - t * 0.6, 0],
      [outer, t * 0.5],
      [outer - t * 0.6, t],
      [inner, t],
    ],
    seg,
  );
}

export function hat(c: BuildCtx): Built {
  const v = c.variant % 3;
  const a = new Assembly(tiny(), "hat");
  if (v === 0) {
    // Felt trilby: pinched front, centre dent, snap brim down at the front.
    const b = brim(0.082, 0.158, 0.005, 24);
    deform(b, (p) => {
      const r = Math.hypot(p.x, p.z);
      const s = Math.max(0, Math.min(1, (r - 0.09) / 0.07));
      const front = Math.max(0, p.z / Math.max(r, 1e-4));
      const back = Math.max(0, -p.z / Math.max(r, 1e-4));
      p.y += -0.016 * s * front ** 1.5 + 0.014 * s * back ** 1.2 + 0.006 * s * (p.x / Math.max(r, 1e-4)) ** 2;
      p.x *= 0.92;
    });
    a.add(b, { tone: "light", position: [0, 0.018, 0] });
    const crown = turned(
      [
        [0.085, 0.0],
        [0.087, 0.03],
        [0.084, 0.068],
        [0.076, 0.093],
        [0.058, 0.106],
        [0.028, 0.111],
        [0, 0.109],
      ],
      22,
      50 * Math.PI / 180,
    );
    deform(crown, (p) => {
      p.x *= 0.9;
      const r = Math.hypot(p.x, p.z) + 1e-4;
      const front = Math.max(0, p.z / r);
      p.x *= 1 - 0.2 * Math.max(0, Math.min(1, (p.y - 0.05) / 0.06)) * front * front;
      p.y -= 0.024 * Math.exp(-((p.x / 0.024) ** 2)) * Math.max(0, Math.min(1, (p.y - 0.07) / 0.035)) * (1 - 0.35 * front);
    });
    a.add(crown, { tone: "light", position: [0, 0.02, 0] });
    const bandG = turned(
      [
        [0.0868, 0.0],
        [0.0888, 0.0],
        [0.0886, 0.026],
        [0.0866, 0.026],
      ],
      22,
    );
    deform(bandG, (p) => (p.x *= 0.9));
    a.add(bandG, { tone: "deep", position: [0, 0.021, 0] });
    a.add(blob(0.008, 0.012, 0.006), { tone: "deep", position: [-0.079, 0.034, 0.012] });
  } else if (v === 1) {
    // Bowler: hard dome, narrow brim curled at the sides.
    const b = brim(0.08, 0.122, 0.005, 24);
    deform(b, (p) => {
      const r = Math.hypot(p.x, p.z) + 1e-4;
      const s = Math.max(0, Math.min(1, (r - 0.1) / 0.022));
      p.y += 0.02 * s * (p.x / r) ** 2;
      p.x *= 0.9;
    });
    a.add(b, { tone: "deep", position: [0, 0.004, 0] });
    const crown = turned(
      [
        [0.08, 0],
        [0.082, 0.028],
        [0.078, 0.062],
        [0.066, 0.09],
        [0.046, 0.108],
        [0.022, 0.116],
        [0, 0.118],
      ],
      22,
      50 * Math.PI / 180,
    );
    deform(crown, (p) => (p.x *= 0.9));
    a.add(crown, { tone: "deep", position: [0, 0.006, 0] });
    const bandG = turned(
      [
        [0.0812, 0],
        [0.0832, 0],
        [0.0828, 0.018],
        [0.0808, 0.018],
      ],
      22,
    );
    deform(bandG, (p) => (p.x *= 0.9));
    a.add(bandG, { tone: "solid", position: [0, 0.007, 0] });
  } else {
    // Straw sun hat: wide plaited brim (stepped so the plait rows draw), ribbon.
    const prof: Array<[number, number]> = [[0.078, 0]];
    const rows = 4;
    for (let i = 1; i <= rows; i++) {
      const r = 0.078 + (0.14 * i) / rows;
      prof.push([r - 0.004, -0.0012 * i], [r, -0.0012 * i - 0.0022]);
    }
    prof.push([0.218, -0.012], [0.21, -0.006], [0.078, 0.004]);
    const b = turned(prof, 26);
    deform(b, (p) => {
      const r = Math.hypot(p.x, p.z) + 1e-4;
      p.y += 0.008 * Math.sin(Math.atan2(p.z, p.x) * 3 + 0.6) * Math.max(0, (r - 0.1) / 0.12);
    });
    a.add(b, { tone: "paper", position: [0, 0.028, 0] });
    const cp: Array<[number, number]> = [];
    for (let i = 0; i <= 5; i++) cp.push([0.08 - i * 0.0015, i * 0.012], [0.079 - i * 0.0015, i * 0.012 + 0.009]);
    cp.push([0.06, 0.074], [0.03, 0.08], [0, 0.08]);
    a.add(turned(cp, 22), { tone: "paper", position: [0, 0.03, 0] });
    a.add(
      turned(
        [
          [0.0805, 0],
          [0.0825, 0],
          [0.0815, 0.02],
          [0.0795, 0.02],
        ],
        22,
      ),
      { tone: "dark", position: [0, 0.031, 0] },
    );
    // Ribbon tails trailing over the brim.
    a.add(
      band(
        [
          [-0.07, 0.042, -0.04],
          [-0.1, 0.03, -0.07],
          [-0.13, 0.022, -0.1],
          [-0.15, 0.02, -0.13],
        ],
        0.018,
        0.0015,
        [0, 1, 0],
        10,
      ),
      { tone: "dark" },
    );
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.8, 0.8);
  const w = v === 2 ? 0.44 : v === 0 ? 0.3 : 0.23;
  return { object: o, footprint: { width: w, depth: w, height: v === 2 ? 0.11 : 0.13 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ umbrella

function canopy(R: number, H: number, ribs: number, sub: number, rings: number, inset = 0): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const cols = ribs * sub;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j <= cols; j++) {
      const th = (j / cols) * Math.PI * 2;
      const m = Math.sin((th * ribs) / 2) ** 2; // 0 on ribs, 1 mid-panel
      const rho = R * t * (1 - 0.1 * m * t) - inset * 0.5;
      const y = H * (1 - Math.pow(t, 1.7)) - H * 0.14 * m * t - inset;
      pos.push(Math.sin(th) * rho, y, Math.cos(th) * rho);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j,
        b = a + 1,
        cI = a + cols + 1,
        d = cI + 1;
      if (inset > 0) idx.push(a, b, cI, b, d, cI);
      else idx.push(a, cI, b, b, cI, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const f = g.toNonIndexed();
  f.computeVertexNormals();
  return f;
}

export function umbrella(c: BuildCtx): Built {
  const open = c.variant % 3 !== 2;
  const k = new Kit();
  const ribs = 8;
  const R = 0.5,
    H = 0.27;
  if (open) {
    k.add(canopy(R, H, ribs, 4, 5), { tone: "dark" });
    k.add(canopy(R, H, ribs, 4, 5, 0.004), { tone: "deep" });
    // Ribs under the canopy, stretchers to the runner, tip ferrules.
    for (let i = 0; i < ribs; i++) {
      const th = (i / ribs) * Math.PI * 2;
      const pts: V3[] = [];
      for (let s = 0; s <= 4; s++) {
        const t = 0.05 + (s / 4) * 0.95;
        const rho = R * t - 0.004;
        pts.push([Math.sin(th) * rho, H * (1 - Math.pow(t, 1.7)) - 0.008, Math.cos(th) * rho]);
      }
      k.add(wire(pts, 0.0022, 6, 3), { tone: "mid" });
      const tip = pts[4]!;
      k.add(rod(tip, [tip[0] * 1.03, tip[1] - 0.012, tip[2] * 1.03], 0.004, 5, 0.003), { tone: "solid" });
      const mid = pts[2]!;
      k.add(rod([0, -0.1, 0], mid, 0.0018, 3), { tone: "mid" });
    }
    k.add(rodY(0.012, -0.12, -0.08, 8), { tone: "mid" }); // runner
    k.add(rodY(0.006, -0.62, H + 0.07, 8), { tone: "mid" }); // shaft
    k.add(rodY(0.009, H - 0.01, H + 0.012, 8), { tone: "deep" }); // top notch cap
    k.add(rodY(0.003, H + 0.012, H + 0.085, 6, 0.0015), { tone: "solid" }); // ferrule
    // Crook handle.
    k.add(
      sweep(
        [
          [0, -0.6, 0],
          [0, -0.7, 0],
          [0, -0.77, 0.02],
          [0, -0.8, 0.06],
          [0, -0.78, 0.1],
          [0, -0.74, 0.11],
        ],
        (t) => 0.013 - t * 0.002,
        14,
        7,
      ),
      { tone: "dark" },
    );
    const g = k.build();
    // Dropped: canopy on its rim, handle cocked up behind.
    g.rotateX(-1.12);
    g.rotateY(c.rng.range(-0.4, 0.4) + 0.5);
    restOnGround(g, true);
    const o = new THREE.Group();
    o.add(new THREE.Mesh(g, tiny()));
    o.name = "umbrella";
    return { object: o, footprint: { width: 1.0, depth: 1.0, height: 0.55 }, scalable: 0.6, placement: "surface" };
  }
  // Furled: fluted fabric round the shaft, strap, crook.
  const L = 0.86;
  const furl = turned(
    [
      [0.002, 0.0],
      [0.016, 0.1],
      [0.032, 0.42],
      [0.03, 0.6],
      [0.018, 0.68],
      [0.009, 0.7],
    ],
    8,
    20 * Math.PI / 180,
  );
  deform(furl, (p) => {
    const a = Math.atan2(p.z, p.x);
    const f = 1 + 0.18 * Math.cos(a * 4);
    p.x *= f;
    p.z *= f;
  });
  k.add(furl, { tone: "deep", position: [0, 0.06, 0] });
  k.add(rodY(0.004, 0, 0.06, 6, 0.006), { tone: "solid" });
  k.add(rodY(0.0055, 0.76, L, 6), { tone: "mid" });
  k.add(ring(0.034, 0.004, 4, 16), { tone: "solid", position: [0, 0.44, 0] });
  k.add(
    sweep(
      [
        [0, L - 0.02, 0],
        [0, L + 0.06, 0],
        [0, L + 0.13, 0.03],
        [0, L + 0.14, 0.08],
        [0, L + 0.11, 0.11],
      ],
      () => 0.012,
      12,
      7,
    ),
    { tone: "dark" },
  );
  const g = k.build();
  g.rotateZ(Math.PI / 2);
  g.rotateY(c.rng.range(-0.5, 0.5));
  restOnGround(g, true);
  const o = new THREE.Group();
  o.add(new THREE.Mesh(g, tiny()));
  return { object: o, footprint: { width: 1.0, depth: 0.15, height: 0.12 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ keys

function barrelKey(len: number): THREE.BufferGeometry {
  // Authored in XY with the bow centred on the origin and the shank down -Y.
  const k = new Kit();
  const bowR = len * 0.19;
  k.add(plate(circle(bowR, 12), 0.004, 0, [circle(bowR * 0.58, 10)], 4));
  const w = len * 0.05;
  k.add(new THREE.BoxGeometry(w * 2, len * 0.72, 0.0045), { position: [0, -bowR - len * 0.34, 0] });
  k.add(rod([0, -bowR * 0.9, 0], [0, -bowR * 1.25, 0], w * 1.5, 8), { rotation: [0, 0, 0] });
  const y0 = -bowR - len * 0.56;
  k.add(
    plate(
      [
        [w, y0],
        [w + len * 0.13, y0],
        [w + len * 0.13, y0 - len * 0.05],
        [w + len * 0.08, y0 - len * 0.05],
        [w + len * 0.08, y0 - len * 0.09],
        [w + len * 0.13, y0 - len * 0.09],
        [w + len * 0.13, y0 - len * 0.16],
        [w, y0 - len * 0.16],
      ],
      0.0045,
      0,
      [],
      2,
    ),
  );
  return k.build();
}

function flatKey(len: number, rng: { range(a: number, b: number): number }): THREE.BufferGeometry {
  const hw = len * 0.28;
  const outline: Array<[number, number]> = [];
  const head = roundRect(hw * 2, len * 0.42, len * 0.1, 2).map(([x, y]) => [x, y + len * 0.21] as [number, number]);
  const bladeW = len * 0.09;
  // Blade with bitting on its upper edge.
  outline.push([-bladeW, 0.0005], [-bladeW, -len * 0.55]);
  outline.push([0, -len * 0.62], [bladeW, -len * 0.55]);
  for (let i = 5; i >= 0; i--) {
    const y = -len * 0.08 * i - len * 0.06;
    outline.push([bladeW + rng.range(0.0, len * 0.05), y]);
    outline.push([bladeW, y + len * 0.04]);
  }
  outline.push([bladeW, 0.0005]);
  const k = new Kit();
  k.add(plate(head, 0.003, 0.0006, [circle(len * 0.06, 8, 0, len * 0.33)], 4));
  k.add(plate(outline, 0.0022, 0, [], 2));
  return k.build();
}

export function keys(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "keys");
  const rng = c.rng;
  // Split ring, lying flat.
  a.add(ring(0.032, 0.0022, 4, 20), { tone: "mid", position: [0, 0.004, 0] });
  const specs = [
    { kind: "barrel", len: 0.12, ang: 0.4 },
    { kind: "barrel", len: 0.105, ang: -0.35 },
    { kind: "flat", len: 0.06, ang: 1.35 },
    { kind: "flat", len: 0.055, ang: 2.0 },
    { kind: "flat", len: 0.058, ang: -1.5 },
  ];
  specs.forEach((s, i) => {
    const g = s.kind === "barrel" ? barrelKey(s.len) : flatKey(s.len, rng);
    // Author in XY, lay flat (Y -> -Z), bow toward the ring.
    if (s.kind !== "barrel") g.translate(0, -s.len * 0.33, 0);
    // Lay flat: the shank runs away from the ring along +Z, then turns outward.
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, s.kind === "barrel" ? s.len * 0.19 : s.len * 0.06);
    g.rotateY(s.ang);
    const r = 0.032;
    const px = Math.sin(s.ang) * r,
      pz = Math.cos(s.ang) * r;
    a.add(g, { tone: s.kind === "barrel" ? "dark" : "light", position: [px, 0.002 + i * 0.0035, pz], rotation: [rng.range(-0.05, 0.05), 0, rng.range(-0.08, 0.08)] });
  });
  // Paddle fob on its own small ring, with a stamped number.
  const fobAng = 2.9;
  const fr = 0.032;
  const fx = Math.sin(fobAng) * (fr + 0.012),
    fz = Math.cos(fobAng) * (fr + 0.012);
  a.add(ring(0.01, 0.0016, 3, 10), { tone: "mid", position: [fx, 0.006, fz] });
  const fob = cbox(0.042, 0.012, 0.11, 0.003);
  fob.translate(0, 0.006, -0.066);
  fob.rotateY(fobAng + Math.PI);
  a.add(fob, { tone: "pale", position: [fx, 0.0, fz] });
  const label = (c.label ?? "SIGNAL BOX").slice(0, 14);
  const tex = inkTexture(`fob:${label}`, 128, 320, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.beginPath();
    g.arc(w / 2, h * 0.12, w * 0.12, 0, Math.PI * 2);
    g.lineWidth = 6;
    g.stroke();
    g.save();
    g.translate(w / 2, h * 0.6);
    g.rotate(-Math.PI / 2);
    text(g, label, 0, 0, w * 0.34, { maxW: h * 0.62, family: SANS, weight: "bold" });
    g.restore();
  });
  const fobPrint = printPlane(tex, 0.034, 0.1, [0, 0, 0], "up");
  if (fobPrint) {
    fobPrint.geometry.translate(0, 0.0128, -0.066);
    fobPrint.geometry.rotateY(fobAng + Math.PI);
    fobPrint.position.set(fx, 0, fz);
    a.attach(fobPrint);
  }
  const o = a.build();
  o.rotation.y = rng.range(0, Math.PI * 2);
  return { object: o, footprint: { width: 0.24, depth: 0.24, height: 0.03 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ jar

export function jar(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "jar");
  const fill = 0.085;
  // Preserve inside the glass, up to the fill line.
  a.add(
    turned(
      [
        [0, 0],
        [0.04, 0],
        [0.0445, 0.006],
        [0.045, fill],
        [0, fill],
      ],
      18,
    ),
    { tone: "dark" },
  );
  // Clear glass above the fill line: shoulder and neck.
  a.add(
    turned(
      [
        [0.045, fill],
        [0.045, 0.094],
        [0.042, 0.108],
        [0.035, 0.117],
        [0.0345, 0.124],
        [0.0365, 0.125],
        [0.0365, 0.128],
      ],
      18,
    ),
    { tone: "paper" },
  );
  // Glass highlight: a clean vertical streak down the dark body.
  a.add(turned([[0.0457, 0.012], [0.0457, 0.08]], 3, 1, 0.16, -0.62), { tone: "paper" });
  a.add(turned([[0.0457, 0.02], [0.0457, 0.07]], 2, 1, 0.06, -0.3), { tone: "paper" });
  // Screw lid under a cloth cover tied with string.
  a.add(rodY(0.037, 0.124, 0.137, 18), { tone: "mid" });
  a.add(ring(0.0385, 0.0016, 3, 18), { tone: "solid", position: [0, 0.127, 0] });
  const clothTex = inkTexture("gingham", 128, 128, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    const n = 10;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const on = (i % 2) + (j % 2);
        if (on === 0) continue;
        g.fillStyle = on === 2 ? "#333" : "#999";
        g.fillRect(i * s, j * s, s, s);
      }
  });
  if (clothTex) {
    const cloth = new THREE.RingGeometry(0.0005, 0.07, 20, 5);
    cloth.rotateX(-Math.PI / 2);
    const pos = cloth.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const th = Math.atan2(z, x);
      if (r > 0.036) {
        const over = r - 0.036;
        const nr = 0.0395 + Math.sin(th * 7 + 1) * 0.004 * (over / 0.034);
        pos.setXYZ(i, Math.cos(th) * nr, 0.139 - over * 0.9, Math.sin(th) * nr);
      } else pos.setY(i, 0.139);
    }
    cloth.computeVertexNormals();
    const m = new THREE.Mesh(cloth, inkMaterial({ map: clothTex, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.print, side: THREE.DoubleSide, shade: 0.8 }));
    a.attach(m);
  }
  // Handwritten label wrapped round the front.
  const words = (c.label ?? "PLUM").slice(0, 10);
  const tex = inkTexture(`jar:${words}`, 256, 160, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 6, 6, w - 12, h - 12, 4);
    marker(g, words, w / 2, h * 0.45, h * 0.3, c.rng.fork("jar"), { maxW: w * 0.8 });
    g.fillStyle = "#000";
    g.fillRect(w * 0.2, h * 0.76, w * 0.6, 3);
  });
  a.attach(printPlane(tex, 0.066, 0.042, [0, 0.048, 0], "front", { segX: 8, warp: (x) => Math.sqrt(Math.max(0, 0.0462 ** 2 - x * x)) }));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.4, 0.4);
  return { object: o, footprint: { width: 0.1, depth: 0.1, height: 0.14 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ pie

export function pie(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "pie");
  a.add(
    turned(
      [
        [0, 0],
        [0.086, 0],
        [0.09, 0.003],
        [0.108, 0.036],
        [0.116, 0.038],
        [0.117, 0.041],
        [0.108, 0.041],
      ],
      24,
    ),
    { tone: "light" },
  );
  // Filling, domed.
  a.add(
    turned(
      [
        [0.104, 0.036],
        [0.08, 0.046],
        [0.04, 0.051],
        [0, 0.052],
      ],
      20,
    ),
    { tone: "deep" },
  );
  // Crimped rim.
  const rim = ring(0.101, 0.012, 4, 36);
  deform(rim, (p) => {
    const th = Math.atan2(p.z, p.x);
    const r = Math.hypot(p.x, p.z) + 1e-5;
    const s = 1 + (0.045 * Math.sin(th * 26)) * Math.max(0, (r - 0.095) / 0.02);
    p.x *= s;
    p.z *= s;
    p.y *= 0.75;
  });
  a.add(rim, { tone: "pale", position: [0, 0.046, 0] });
  // Lattice: strips woven over and under.
  const n = 4;
  for (let dir = 0; dir < 2; dir++) {
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.042;
      const half = Math.sqrt(Math.max(0, 0.098 ** 2 - off * off));
      const s = sheet(0.019, half * 2, 0.005, 1, 5, (x, z) => {
        const r = Math.hypot(off, z);
        const dome = 0.006 * (1 - (r / 0.1) ** 2);
        const weave = 0.0022 * Math.sin((z / 0.036) * Math.PI + (i + dir) * Math.PI);
        return dome + weave;
      });
      s.translate(off, 0.049, 0);
      if (dir) s.rotateY(Math.PI / 2);
      a.add(s, { tone: "pale" });
    }
  }
  const o = a.build();
  o.rotation.y = c.rng.range(0, Math.PI);
  return { object: o, footprint: { width: 0.234, depth: 0.234, height: 0.06 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ bell

export function bell(c: BuildCtx): Built {
  const k = new Kit();
  // Bronze hand bell: lip, sound bow, waist, shoulder, crown, with two bead lines.
  k.add(
    turned(
      [
        [0.064, 0.0],
        [0.074, 0.0],
        [0.077, 0.004],
        [0.075, 0.011],
        [0.071, 0.014],
        [0.0712, 0.017],
        [0.066, 0.035],
        [0.056, 0.062],
        [0.051, 0.086],
        [0.0515, 0.09],
        [0.0495, 0.093],
        [0.048, 0.108],
        [0.042, 0.12],
        [0.028, 0.127],
        [0.013, 0.129],
      ],
      20,
    ),
    { tone: "light" },
  );
  // Turned wooden handle with a ferrule.
  k.add(
    turned(
      [
        [0.0125, 0.128],
        [0.0145, 0.131],
        [0.0145, 0.139],
        [0.011, 0.142],
        [0.0105, 0.15],
        [0.015, 0.172],
        [0.0175, 0.2],
        [0.0165, 0.222],
        [0.012, 0.234],
        [0.005, 0.238],
        [0, 0.2385],
      ],
      14,
    ),
    { tone: "mid" },
  );
  const lying = false;
  const g = k.build();
  if (lying) {
    g.rotateZ(Math.PI / 2 - 0.3);
    restOnGround(g, true);
  }
  const o = new THREE.Group();
  o.add(new THREE.Mesh(g, tiny()));
  o.rotation.y = c.rng.range(0, Math.PI * 2);
  return { object: o, footprint: { width: 0.155, depth: 0.155, height: lying ? 0.1 : 0.24 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ rubber stamp

export function rubberStamp(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "stamp");
  const label = (c.label ?? "APPROVED").toUpperCase().slice(0, 12);
  // The stamped sheet: a form with its fresh impression across the middle.
  const sheetG = sheet(0.15, 0.212, 0.0012);
  sheetG.rotateY(-0.12);
  a.add(sheetG, { tone: "paper", position: [0.03, 0, 0.0] });
  const tex = inkTexture(`stamped:${label}`, 300, 424, (g, w, h) => {
    const r = c.rng.fork("stampsheet");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    text(g, "APPLICATION", w * 0.08, h * 0.07, h * 0.03, { align: "left" });
    g.fillStyle = "#000";
    g.fillRect(w * 0.08, h * 0.1, w * 0.84, 2);
    greek(g, w * 0.08, h * 0.15, w * 0.84, h * 0.026, 7, r);
    greek(g, w * 0.08, h * 0.72, w * 0.84, h * 0.026, 5, r);
    g.fillRect(w * 0.08, h * 0.92, w * 0.36, 1.5);
    g.fillRect(w * 0.56, h * 0.92, w * 0.36, 1.5);
    stamp(g, label, w * 0.5, h * 0.5, w * 0.86, -0.14, r);
  });
  const sp = printPlane(tex, 0.148, 0.21, [0, 0, 0], "up");
  if (sp) {
    sp.geometry.rotateY(-0.12);
    sp.geometry.translate(0.03, 0.0014, 0);
    a.attach(sp);
  }
  // The stamp itself, standing beside the sheet: rubber die, mount, knob.
  const sx = -0.1,
    sz = -0.02;
  a.add(cbox(0.082, 0.007, 0.036, 0.001), { tone: "solid", position: [sx, 0.0035, sz] });
  a.add(cbox(0.086, 0.024, 0.04, 0.004), { tone: "pale", position: [sx, 0.019, sz] });
  a.add(
    turned(
      [
        [0.01, 0.031],
        [0.0125, 0.034],
        [0.0085, 0.046],
        [0.0085, 0.062],
        [0.015, 0.076],
        [0.022, 0.092],
        [0.02, 0.104],
        [0.009, 0.111],
        [0, 0.112],
      ],
      16,
    ),
    { tone: "light", position: [sx, 0, sz] },
  );
  const idx = inkTexture(`stampidx:${label}`, 256, 112, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    text(g, label, w / 2, h / 2, h * 0.4, { color: RED, weight: "900", squeeze: 0.8, maxW: w * 0.9 });
  });
  a.attach(printPlane(idx, 0.07, 0.03, [sx, 0.0312, sz], "up"));
  // Ink pad tin, lid folded flat behind, the pad soaked red.
  const px = -0.1,
    pz = 0.085;
  a.add(cblock(0.09, 0.012, 0.06, 0.002), { tone: "light", position: [px, 0, pz] });
  a.add(slab(0.078, 0.002, 0.048), { tone: "deep", accent: "signal", accentAmount: 0.85, position: [px, 0.0115, pz] });
  a.add(cblock(0.09, 0.005, 0.06, 0.0015), { tone: "light", position: [px - 0.092, 0, pz] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.25, 0.25);
  return { object: o, footprint: { width: 0.3, depth: 0.24, height: 0.112 }, scalable: 1, placement: "surface" };
}

function slab(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

// ------------------------------------------------------------------ megaphone

export function megaphone(c: BuildCtx): Built {
  const k = new Kit();
  // Built along +Y (horn up), then laid on its side facing +Z.
  k.add(
    turned(
      [
        [0.05, 0.0],
        [0.053, 0.03],
        [0.064, 0.12],
        [0.086, 0.2],
        [0.108, 0.245],
        [0.118, 0.258],
        [0.121, 0.263],
        [0.114, 0.264],
        [0.1, 0.25],
        [0.07, 0.19],
        [0.05, 0.12],
        [0.042, 0.06],
      ],
      20,
    ),
    { tone: "paper" },
  );
  k.add(rodY(0.043, 0.055, 0.058, 14), { tone: "solid" });
  k.add(
    turned(
      [
        [0.0, -0.17],
        [0.05, -0.17],
        [0.054, -0.165],
        [0.054, -0.15],
        [0.051, -0.146],
        [0.051, -0.02],
        [0.055, -0.016],
        [0.055, 0.004],
        [0.05, 0.004],
      ],
      16,
    ),
    { tone: "light" },
  );
  // Pistol grip and trigger under the body.
  const grip = cbox(0.03, 0.04, 0.1, 0.008);
  grip.rotateX(-0.3);
  k.add(grip, { tone: "deep", position: [0, -0.095, 0.095] });
  k.add(cbox(0.012, 0.018, 0.03, 0.003), { tone: "solid", position: [0, -0.06, 0.065] });
  // Strap loops.
  k.add(
    wire(
      [
        [0.05, -0.14, 0.0],
        [0.1, -0.1, 0.0],
        [0.11, -0.03, 0.0],
        [0.07, 0.0, 0.0],
      ],
      0.004,
      10,
      4,
    ),
    { tone: "dark" },
  );
  // Grip sits under the body: move it to -X side so it lies sideways.
  const g = k.build();
  g.rotateX(Math.PI / 2); // horn toward +Z, grip hanging below
  g.rotateZ(1.3); // roll onto its side
  restOnGround(g, true);
  const o = new THREE.Group();
  o.add(new THREE.Mesh(g, tiny()));
  o.rotation.y = c.rng.range(-0.6, 0.6);
  return { object: o, footprint: { width: 0.25, depth: 0.45, height: 0.24 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ data drive in a hard case

export function dataDrive(c: BuildCtx): Built {
  const a = new Assembly(small(), "data-drive");
  const W = 0.36,
    D = 0.27,
    H = 0.1;
  // Lower shell with reinforcing ribs, latches and a folded carry handle.
  a.add(cblock(W, H, D, 0.012), { tone: "dark" });
  for (const x of [-0.12, 0.12]) a.add(cbox(0.03, 0.022, 0.012, 0.004), { tone: "solid", position: [x, H - 0.018, D / 2 + 0.004] });
  a.add(cbox(0.13, 0.014, 0.012, 0.005), { tone: "solid", position: [0, 0.045, D / 2 + 0.006] });
  for (const x of [-0.15, 0.15]) a.add(slab(0.012, H - 0.02, 0.006), { tone: "solid", position: [x, 0.01, D / 2 + 0.002] });
  // Foam insert with the drive seated in its cut-out.
  a.add(slab(W - 0.03, 0.004, D - 0.03), { tone: "dark", position: [0, H - 0.012, 0] });
  // Lid, hinged at the back, thrown open past vertical.
  const lid = new Kit();
  lid.add(cbox(W, 0.05, D, 0.012), { tone: "dark", position: [0, 0.025, D / 2] });
  lid.add(slab(W - 0.03, 0.006, D - 0.03), { tone: "deep", position: [0, -0.001, D / 2] });
  for (let i = 0; i < 6; i++) lid.add(cbox(W - 0.05, 0.008, 0.012, 0.003), { tone: "dark", position: [0, -0.001, 0.035 + i * 0.04] });
  for (const x of [-0.09, 0.09]) lid.add(cbox(0.018, 0.008, D * 0.8, 0.004), { tone: "solid", position: [x, 0.052, D / 2] });
  const lg = lid.build();
  lg.rotateX(-1.85);
  a.kit.addGeometry(lg, new THREE.Matrix4().makeTranslation(0, H, -D / 2));
  // The drive: aluminium body in rubber corner bumpers, status LED, cable.
  const dy = H - 0.008;
  a.add(cbox(0.13, 0.024, 0.085, 0.006), { tone: "pale", position: [0, dy + 0.012, 0.01] });
  for (const [x, z] of [
    [-0.06, -0.036],
    [0.06, -0.036],
    [-0.06, 0.056],
    [0.06, 0.056],
  ] as const)
    a.add(cbox(0.022, 0.028, 0.022, 0.006), { tone: "solid", position: [x, dy + 0.012, z] });
  a.add(cbox(0.012, 0.004, 0.004, 0.001), { tone: "paper", accent: "cyan", accentAmount: 1, position: [0.04, dy + 0.02, 0.054] });
  a.add(
    wire(
      [
        [-0.066, dy + 0.012, 0.0],
        [-0.1, dy + 0.006, -0.01],
        [-0.13, dy + 0.004, 0.05],
        [-0.1, dy + 0.004, 0.09],
        [-0.14, dy + 0.004, 0.1],
      ],
      0.003,
      16,
      4,
    ),
    { tone: "solid" },
  );
  const label = (c.label ?? "WEIGHTS").toUpperCase().slice(0, 14);
  const tex = inkTexture(`drive:${label}`, 320, 208, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 4, 4, w - 8, h - 8, 5);
    g.fillStyle = "#000";
    g.fillRect(4, 4, w - 8, h * 0.28);
    text(g, "MORROW · SNAPSHOT", w / 2, h * 0.18, h * 0.1, { color: "#fff", maxW: w * 0.86 });
    text(g, label, w / 2, h * 0.52, h * 0.19, { maxW: w * 0.86, weight: "900", squeeze: 0.85 });
    text(g, "DO NOT COPY", w / 2, h * 0.8, h * 0.085, { color: RED, maxW: w * 0.6 });
  });
  a.attach(printPlane(tex, 0.09, 0.058, [0, dy + 0.0245, 0.01], "up"));
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: W, depth: D + 0.12, height: 0.36 }, scalable: 0.7, placement: "surface" };
}

// ------------------------------------------------------------------ fruit bowl

export function fruitBowl(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "fruit-bowl");
  const rng = c.rng;
  a.add(
    turned(
      [
        [0, 0.004],
        [0.048, 0.004],
        [0.05, 0.0],
        [0.056, 0.0],
        [0.057, 0.012],
        [0.07, 0.022],
        [0.105, 0.055],
        [0.132, 0.086],
        [0.136, 0.09],
        [0.131, 0.092],
        [0.08, 0.05],
        [0, 0.034],
      ],
      18,
    ),
    { tone: "paper" },
  );
  a.add(ring(0.123, 0.0018, 3, 18), { tone: "dark", position: [0, 0.079, 0] });
  // Apples and oranges piled in the bowl.
  const fruit: Array<[number, number, number, "apple" | "orange"]> = [
    [-0.045, 0.07, -0.02, "apple"],
    [0.04, 0.072, -0.035, "orange"],
    [0.0, 0.07, 0.05, "apple"],
    [0.06, 0.072, 0.045, "apple"],
    [-0.055, 0.072, 0.06, "orange"],
    [0.005, 0.118, 0.0, "apple"],
  ];
  for (const [x, y, z, kind] of fruit) {
    if (kind === "apple") {
      const g = blob(0.036, 0.033, 0.036, 1, 1, 8, 6);
      deform(g, (p) => {
        const r = Math.hypot(p.x, p.z);
        if (p.y > 0) p.y -= 0.012 * Math.exp(-((r / 0.012) ** 2));
        else p.y += 0.006 * Math.exp(-((r / 0.012) ** 2));
      });
      g.rotateZ(rng.range(-0.4, 0.4));
      a.add(g, { tone: "pale", position: [x, y, z] });
      a.add(rod([x, y + 0.02, z], [x + 0.004, y + 0.036, z + 0.002], 0.0022, 4, 0.0016), { tone: "solid" });
    } else {
      a.add(jitter(sphere(0.04, 8, 6), 0.002, x * 100), { tone: "light", position: [x, y, z] });
      a.add(sphere(0.005, 5, 4), { tone: "dark", position: [x, y + 0.039, z] });
    }
  }
  // Bananas draped over the rim.
  for (let i = 0; i < 3; i++) {
    const s = i * 0.022 - 0.022;
    const pts: V3[] = [
      [0.02, 0.13, -0.05 + s],
      [0.07, 0.13, -0.06 + s * 1.2],
      [0.12, 0.105, -0.07 + s * 1.4],
      [0.15, 0.065, -0.08 + s * 1.6],
    ];
    const g = sweep(pts, (t) => 0.013 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.9)) + 0.004, 8, 5);
    a.add(g, { tone: "pale" });
    a.add(sphere(0.005, 5, 4), { tone: "solid", position: pts[3]! });
  }
  a.add(rod([0.02, 0.13, -0.05], [-0.005, 0.14, -0.045], 0.006, 5), { tone: "dark" });
  // Grapes spilling over the far lip.
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const gx = -0.1 - t * 0.04 + rng.range(-0.012, 0.012);
    const gy = 0.1 - t * 0.075 + rng.range(-0.01, 0.01);
    const gz = -0.03 + rng.range(-0.025, 0.025) * (1 - t * 0.5);
    a.add(new THREE.IcosahedronGeometry(0.0115, 0), { tone: "dark", position: [gx, gy, gz] });
  }
  a.add(wire([[-0.08, 0.115, -0.03], [-0.1, 0.108, -0.03], [-0.12, 0.09, -0.028]], 0.0018, 5, 3), { tone: "solid" });
  const o = a.build();
  o.rotation.y = rng.range(-0.6, 0.6);
  return { object: o, footprint: { width: 0.3, depth: 0.28, height: 0.15 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ sandwich tray

export function sandwichTray(c: BuildCtx): Built {
  const a = new Assembly(tiny(), "sandwich-tray");
  // Round catering platter, a paper doily, quarter sandwiches stacked in a
  // low pyramid with their cut faces out (white bread, dark filling).
  const R = 0.2;
  a.add(
    turned(
      [
        [0, 0.0],
        [R - 0.03, 0.0],
        [R - 0.02, 0.006],
        [R, 0.014],
        [R + 0.008, 0.016],
        [R + 0.006, 0.02],
        [R - 0.022, 0.012],
        [0, 0.01],
      ],
      24,
    ),
    { tone: "light" },
  );
  const doily = plate(
    (() => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 48; i++) {
        const an = (i / 48) * Math.PI * 2;
        const rr = R - 0.03 + 0.008 * Math.abs(Math.sin(an * 12));
        pts.push([Math.cos(an) * rr, Math.sin(an) * rr]);
      }
      return pts;
    })(),
    0.0012,
  );
  doily.rotateX(-Math.PI / 2);
  a.add(doily, { tone: "paper", position: [0, 0.0115, 0] });
  const leg = 0.075;
  const tri: Array<[number, number]> = [
    [-leg / 2, -leg / 2],
    [leg / 2, -leg / 2],
    [-leg / 2, leg / 2],
  ];
  const sandwich = (x: number, y: number, z: number, turn: number, fill: "mid" | "dark") => {
    const k = new Kit();
    const bread = 0.016,
      fillT = 0.012;
    const slice = (yy: number, t: number, tone: "paper" | "mid" | "dark", inset: number, bev: number) => {
      const pts = tri.map(([u, v]) => [u * (1 - inset), v * (1 - inset)] as [number, number]);
      const g = plate(pts, t, bev);
      g.rotateX(-Math.PI / 2);
      g.translate(0, yy + t / 2, 0);
      k.add(g, { tone });
    };
    slice(0, bread, "paper", 0, 0.003);
    slice(bread, fillT, fill, -0.04, 0);
    slice(bread + fillT, bread, "paper", 0, 0.003);
    const g = k.build();
    g.rotateY(turn);
    g.translate(x, y, z);
    a.kit.addGeometry(g);
  };
  // Hypotenuse (cut face) direction is (1, 1) in the outline: turn it outward.
  const cut = (ang: number) => ang - Math.PI * 0.75;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.2;
    sandwich(Math.sin(ang) * 0.115, 0.013, Math.cos(ang) * 0.115, cut(ang), i % 2 ? "mid" : "dark");
  }
  for (let i = 0; i < 2; i++) {
    const ang = (i / 2) * Math.PI * 2 + 0.6;
    sandwich(Math.sin(ang) * 0.04, 0.057, Math.cos(ang) * 0.04, cut(ang), i % 2 ? "dark" : "mid");
  }
  // Cherry tomatoes and a sprig for the eye.
  for (const [x, z] of [
    [0.16, -0.06],
    [-0.15, 0.08],
  ] as const)
    a.add(sphere(0.014, 8, 6), { tone: "light", position: [x, 0.026, z] });
  const label = (c.label ?? "CATERING").toUpperCase().slice(0, 12);
  const tex = inkTexture(`tray:${label}`, 256, 96, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, 3, 3, w - 6, h - 6, 4);
    text(g, label, w / 2, h / 2, h * 0.38, { maxW: w * 0.86 });
  });
  a.attach(printPlane(tex, 0.09, 0.034, [0.0, 0.0, 0.0], "front", { rotate: 0 }));
  a.extras[a.extras.length - 1]?.position.set(0, 0.03, R + 0.012);
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: R * 2 + 0.02, depth: R * 2 + 0.02, height: 0.1 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ ceremonial ribbon across the track

export function ribbon(c: BuildCtx): Built {
  const a = new Assembly(propMaterial(HATCH.small), "ribbon");
  // Origin: rail-top plane at the track centre. Stanchions stand on the
  // sleeper ends outside each rail; the ribbon crosses at waist height.
  const base = -0.15;
  const xs = [-1.12, 1.12];
  const top = 0.82;
  for (const x of xs) {
    a.add(
      turned(
        [
          [0, base],
          [0.15, base],
          [0.155, base + 0.012],
          [0.12, base + 0.03],
          [0.04, base + 0.045],
          [0.022, base + 0.06],
          [0.022, top - 0.06],
          [0.03, top - 0.05],
          [0.03, top - 0.035],
          [0.022, top - 0.03],
        ],
        12,
      ),
      { tone: "light", position: [x, 0, 0] },
    );
    a.add(sphere(0.038, 10, 7), { tone: "light", position: [x, top, 0] });
  }
  // Satin ribbon: broad face toward the trolley, a soft sag, a big bow.
  const w = 0.1;
  const sag = (x: number) => top - 0.06 - 0.07 * (1 - (x / 1.1) ** 2);
  for (const side of [-1, 1]) {
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const x = side * (1.1 - (i / 6) * 1.02);
      pts.push([x, sag(x), 0.01 * Math.sin(i)]);
    }
    a.add(band(pts, w, 0.004, [0, 1, 0], 18), { tone: "paper", accent: "signal" });
  }
  const bowY = sag(0) + 0.01;
  for (const side of [-1, 1]) {
    const loop: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = (i / 10) * Math.PI * 2;
      loop.push([side * (0.13 * (1 - Math.cos(t)) * 0.5 + 0.02), bowY + 0.07 * Math.sin(t) * (0.6 + 0.4 * Math.sin(t * 0.5)), 0.02 + 0.015 * Math.sin(t)]);
    }
    a.add(band(loop, w * 0.85, 0.004, [0, 0, 1], 18), { tone: "paper", accent: "signal" });
    const tail: V3[] = [
      [side * 0.02, bowY, 0.03],
      [side * 0.06, bowY - 0.1, 0.035],
      [side * 0.08, bowY - 0.22, 0.03],
      [side * 0.1, bowY - 0.3, 0.025],
    ];
    a.add(band(tail, w * 0.8, 0.004, [1, 0, 0], 12), { tone: "paper", accent: "signal" });
  }
  a.add(blob(0.035, 0.045, 0.025, 0.7, 0.7, 8, 6), { tone: "paper", accent: "signal", position: [0, bowY, 0.03] });
  const o = a.build();
  return { object: o, footprint: { width: 2.55, depth: 0.32, height: 0.95 }, scalable: 0, placement: "track" };
}

// ------------------------------------------------------------------ station clock (pillar clock)

export function stationClock(c: BuildCtx): Built {
  const a = new Assembly(propMaterial(HATCH.small), "station-clock");
  // Cast-iron pillar: stepped plinth, fluted shaft, capital, bracket drum.
  a.add(
    turned(
      [
        [0, 0],
        [0.24, 0],
        [0.24, 0.06],
        [0.2, 0.08],
        [0.2, 0.14],
        [0.14, 0.2],
        [0.11, 0.26],
        [0.1, 0.3],
      ],
      16,
    ),
    { tone: "dark" },
  );
  const shaft = turned(
    [
      [0.085, 0.3],
      [0.07, 2.1],
    ],
    24,
  );
  deform(shaft, (p) => {
    const th = Math.atan2(p.z, p.x);
    const f = 1 - 0.06 * Math.max(0, Math.cos(th * 12)) ** 3;
    p.x *= f;
    p.z *= f;
  });
  a.add(shaft, { tone: "dark" });
  for (const y of [0.34, 1.1, 2.06]) a.add(ring(0.084 - y * 0.006, 0.012, 5, 20), { tone: "dark", position: [0, y, 0] });
  a.add(
    turned(
      [
        [0.07, 2.1],
        [0.1, 2.16],
        [0.14, 2.2],
        [0.14, 2.24],
        [0.06, 2.26],
      ],
      16,
    ),
    { tone: "dark" },
  );
  // Clock drum: two faces (front and back), deep bezel, cast crest.
  const R = 0.32,
    Dd = 0.18,
    cy = 2.26 + R + 0.02;
  const drum = turned(
    [
      [0, -Dd / 2],
      [R + 0.03, -Dd / 2],
      [R + 0.04, -Dd / 2 + 0.02],
      [R + 0.04, Dd / 2 - 0.02],
      [R + 0.03, Dd / 2],
      [0, Dd / 2],
    ],
    36,
  );
  drum.rotateX(Math.PI / 2);
  a.add(drum, { tone: "dark", position: [0, cy, 0] });
  for (const z of [Dd / 2, -Dd / 2]) a.add(hoop(R + 0.012, 0.014, 6, 40), { tone: "light", position: [0, cy, z] });
  a.add(sphere(0.05, 12, 8), { tone: "dark", position: [0, cy + R + 0.07, 0] });
  a.add(rodY(0.012, cy + R + 0.1, cy + R + 0.22, 8, 0.004), { tone: "dark" });
  // Dial faces, with hands as separate meshes so the time can be set.
  const dialTex = inkTexture("clock-dial", 512, 512, (g, w, h) => {
    const cx = w / 2,
      cyy = h / 2,
      r = w * 0.48;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * Math.PI * 2;
      const major = i % 5 === 0;
      g.save();
      g.translate(cx + Math.sin(ang) * r * 0.86, cyy - Math.cos(ang) * r * 0.86);
      g.rotate(ang);
      if (major) g.fillRect(-r * 0.028, -r * 0.1, r * 0.056, r * 0.2);
      else g.fillRect(-r * 0.008, -r * 0.035, r * 0.016, r * 0.07);
      g.restore();
    }
    for (const [n, ang] of [
      ["12", 0],
      ["3", Math.PI / 2],
      ["6", Math.PI],
      ["9", Math.PI * 1.5],
    ] as const)
      text(g, n, cx + Math.sin(ang) * r * 0.6, cyy - Math.cos(ang) * r * 0.6, r * 0.12, { family: SANS, weight: "bold" });
    text(g, "RAILWAY TIME", cx, cyy + r * 0.3, r * 0.045, { weight: "bold", track: 3 });
  });
  const hands: THREE.Object3D[] = [];
  const handMat = inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: HATCH.small, objectId: OBJECT_ID.print });
  for (const side of [1, -1]) {
    const z = side * (Dd / 2 + 0.002);
    const dial = printPlane(dialTex, R * 2, R * 2, [0, cy, z], side > 0 ? "front" : "back");
    if (dial) {
      const circ = new THREE.CircleGeometry(R, 40);
      if (side < 0) circ.rotateY(Math.PI);
      circ.translate(0, cy, z);
      dial.geometry.dispose();
      dial.geometry = circ;
      a.attach(dial);
    } else {
      const disc = new THREE.CircleGeometry(R, 40);
      if (side < 0) disc.rotateY(Math.PI);
      a.add(disc, { tone: "paper", position: [0, cy, z] });
    }
    const hand = (len: number, wdt: number, tail: number, tone: "solid" | "paper", accent?: "signal") => {
      const k = new Kit();
      const outline: Array<[number, number]> = [
        [-wdt * 0.5, -tail],
        [wdt * 0.5, -tail],
        [wdt * 0.7, len * 0.7],
        [0, len],
        [-wdt * 0.7, len * 0.7],
      ];
      k.add(plate(outline, 0.004, 0), accent ? { tone, accent } : { tone });
      k.add(cylinder(wdt * 0.9, wdt * 0.9, 0.006, 10), { tone: "solid", rotation: [Math.PI / 2, 0, 0] });
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(k.build(), handMat);
      pivot.add(m);
      pivot.position.set(0, cy, z + side * 0.004 * (hands.length % 3 + 1));
      if (side < 0) pivot.rotation.y = Math.PI;
      a.attach(pivot);
      hands.push(pivot);
      return pivot;
    };
    hand(R * 0.55, 0.032, 0.05, "solid");
    hand(R * 0.8, 0.022, 0.06, "solid");
    hand(R * 0.84, 0.006, 0.09, "paper", "signal");
  }
  const o = a.build();
  const setTime = (hh: number, mm: number, ss = 0) => {
    for (let i = 0; i < hands.length; i++) {
      const which = i % 3;
      const ang = which === 0 ? (((hh % 12) + mm / 60) / 12) * Math.PI * 2 : which === 1 ? ((mm + ss / 60) / 60) * Math.PI * 2 : (ss / 60) * Math.PI * 2;
      hands[i]!.rotation.z = -ang;
    }
  };
  const [h0, m0] = (c.label && /^\d{1,2}:\d{2}$/.test(c.label) ? c.label : "06:40").split(":").map(Number) as [number, number];
  setTime(h0, m0, 0);
  o.userData.setTime = setTime;
  let t0 = h0 * 3600 + m0 * 60;
  o.userData.tick = (dt: number) => {
    t0 += dt;
    setTime(Math.floor(t0 / 3600), Math.floor((t0 % 3600) / 60), Math.floor(t0 % 60));
  };
  return { object: o, footprint: { width: 0.72, depth: 0.48, height: cy + R + 0.22 }, scalable: 0, placement: "ground" };
}
