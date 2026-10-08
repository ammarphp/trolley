/**
 * Care and keepsakes: the poignant stakes. A stretcher with its blanket
 * folded, an empty wheelchair, a sitting teddy bear, a wrapped bouquet, a
 * hurricane lantern. Modelled plainly and at true size, without caricature.
 */
import * as THREE from "three";
import { Kit, cylinder, sphere, deform, jitter } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";
import { Assembly, HATCH, OBJECT_ID, band, blob, cbox, hoop, plate, propMaterial, ring, rod, rodY, sheet, slab, turned, wire, type V3 } from "./common.ts";
import { inkTexture, marker, printPlane } from "./print.ts";
import type { BuildCtx, Built } from "./types.ts";

const tiny = () => propMaterial(HATCH.tiny);
const small = () => propMaterial(HATCH.small);

// ------------------------------------------------------------------ stretcher

export function stretcher(c: BuildCtx): Built {
  const a = new Assembly(small(), "stretcher");
  const L = 2.25,
    y = 0.16,
    hz = 0.28;
  for (const s of [-1, 1]) {
    a.add(rod([-L / 2, y, s * hz], [L / 2, y, s * hz], 0.017, 8), { tone: "mid" });
    for (const e of [-1, 1]) a.add(rod([e * (L / 2 - 0.2), y, s * hz], [e * (L / 2 + 0.005), y, s * hz], 0.021, 8), { tone: "deep" });
    // Canvas sleeve around the pole.
    a.add(rod([-0.92, y, s * hz], [0.92, y, s * hz], 0.024, 8), { tone: "pale" });
    // Stirrup feet.
    for (const x of [-0.72, 0.72])
      a.add(
        wire(
          [
            [x - 0.06, y, s * hz],
            [x - 0.05, 0.02, s * hz],
            [x + 0.05, 0.02, s * hz],
            [x + 0.06, y, s * hz],
          ],
          0.008,
          10,
          4,
        ),
        { tone: "mid" },
      );
  }
  // Spreader bars.
  for (const x of [-0.97, 0.97]) a.add(rod([x, y - 0.02, -hz], [x, y - 0.02, hz], 0.011, 6), { tone: "mid" });
  // Canvas bed, sagging between the poles.
  a.add(
    sheet(1.84, hz * 2 - 0.02, 0.004, 10, 6, (x, z) => -0.035 * (1 - (z / hz) ** 2) * (1 - 0.3 * (x / 0.92) ** 2)),
    { tone: "pale", position: [0, y + 0.012, 0] },
  );
  // Pillow at the head, folded blanket at the foot, a strap across.
  const pillow = blob(0.13, 0.045, 0.2, 0.45, 0.5, 12, 8);
  a.add(jitter(pillow, 0.004, 2), { tone: "paper", position: [-0.72, y + 0.03, 0], rotation: [0, 0, 0.12] });
  for (let i = 0; i < 3; i++) {
    const fold = blob(0.22 - i * 0.004, 0.022, 0.25, 0.25, 0.3, 12, 8);
    a.add(jitter(fold, 0.003, 4 + i), { tone: "mid", position: [0.55, y + 0.012 + i * 0.038, 0.004 * i] });
  }
  for (const x of [0.4, 0.7]) a.add(slab(0.03, 0.12, 0.5), { tone: "deep", position: [x, y + 0.004, 0.01], scale: [1, 1, 1] });
  a.add(
    band(
      [
        [0.05, y - 0.12, hz + 0.02],
        [0.05, y + 0.02, hz + 0.02],
        [0.05, y + 0.002, 0.0],
        [0.05, y + 0.02, -hz - 0.02],
        [0.05, y - 0.14, -hz - 0.02],
      ],
      0.045,
      0.004,
      [1, 0, 0],
      20,
    ),
    { tone: "deep" },
  );
  a.add(cbox(0.06, 0.05, 0.012, 0.004), { tone: "light", position: [0.05, y - 0.03, hz + 0.028] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.08, 0.08);
  return { object: o, footprint: { width: L, depth: 0.62, height: 0.3 }, scalable: 0, placement: "surface" };
}

// ------------------------------------------------------------------ wheelchair

function wheel(k: Kit, x: number, y: number, z: number, R: number, side: number, spokes: boolean): void {
  const tyre = hoop(R, R * 0.058, 5, 26);
  tyre.rotateY(Math.PI / 2);
  k.add(tyre, { tone: "deep", position: [x, y, z] });
  const rim = hoop(R * 0.94, R * 0.028, 3, 26);
  rim.rotateY(Math.PI / 2);
  k.add(rim, { tone: "light", position: [x, y, z] });
  if (!spokes) return;
  const push = hoop(R * 0.88, R * 0.024, 3, 26);
  push.rotateY(Math.PI / 2);
  k.add(push, { tone: "light", position: [x + side * 0.035, y, z] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    k.add(rod([x, y + Math.sin(a) * R * 0.88, z + Math.cos(a) * R * 0.88], [x + side * 0.035, y + Math.sin(a) * R * 0.88, z + Math.cos(a) * R * 0.88], 0.004, 4), { tone: "light" });
  }
  const hub = cylinder(0.03, 0.03, 0.06, 10);
  hub.rotateZ(Math.PI / 2);
  k.add(hub, { tone: "mid", position: [x, y, z] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const off = (i % 2 ? 1 : -1) * 0.022;
    k.add(rod([x + off, y + Math.sin(a + 0.2) * 0.026, z + Math.cos(a + 0.2) * 0.026], [x, y + Math.sin(a) * R * 0.92, z + Math.cos(a) * R * 0.92], 0.0018, 3, 0.0018, true), { tone: "mid" });
  }
}

export function wheelchair(c: BuildCtx): Built {
  const k = new Kit();
  const sw = 0.215; // half seat width (frame centre lines)
  const R = 0.3;
  const axle: V3 = [0, R, -0.12];
  for (const s of [-1, 1]) {
    const x = s * sw;
    // Side frame: back post rising into a push handle, seat rail, front post, lower rail.
    k.add(
      wire(
        [
          [x, 0.22, -0.16],
          [x, 0.5, -0.17],
          [x, 0.8, -0.2],
          [x, 0.93, -0.23],
          [x, 0.95, -0.3],
        ],
        0.012,
        16,
        5,
      ),
      { tone: "light" },
    );
    k.add(rod([x, 0.95, -0.3], [x, 0.95, -0.4], 0.016, 8), { tone: "solid" });
    k.add(rod([x, 0.5, -0.17], [x, 0.5, 0.26], 0.011, 6), { tone: "light" });
    k.add(rod([x, 0.5, 0.26], [x, 0.2, 0.3], 0.011, 6), { tone: "light" });
    k.add(rod([x, 0.22, -0.16], [x, 0.2, 0.3], 0.011, 6), { tone: "light" });
    // Armrest with pad and front support.
    k.add(rod([x, 0.72, -0.18], [x, 0.72, 0.18], 0.01, 6), { tone: "light" });
    k.add(rod([x, 0.72, 0.18], [x, 0.5, 0.2], 0.01, 6), { tone: "light" });
    k.add(cbox(0.05, 0.03, 0.3, 0.01), { tone: "deep", position: [x, 0.745, 0.0] });
    // Footrest hanger and plate.
    k.add(rod([x, 0.48, 0.27], [x * 0.9, 0.12, 0.4], 0.011, 6), { tone: "light" });
    k.add(cbox(0.15, 0.012, 0.13, 0.004), { tone: "mid", position: [x * 0.62, 0.11, 0.43], rotation: [0.15, 0, 0] });
    // Caster: stem, fork, small wheel.
    k.add(rod([x, 0.2, 0.3], [x, 0.14, 0.31], 0.012, 6), { tone: "light" });
    for (const f of [-1, 1]) k.add(cbox(0.006, 0.07, 0.03, 0.002), { tone: "light", position: [x + f * 0.018, 0.11, 0.32] });
    const caster = hoop(0.075, 0.016, 4, 16);
    caster.rotateY(Math.PI / 2);
    k.add(caster, { tone: "deep", position: [x, 0.075, 0.33] });
    // Rear wheels outboard, slightly cambered.
    wheel(k, s * (sw + 0.07), axle[1], axle[2], R, s, true);
  }
  // Folding cross-brace.
  k.add(rod([-sw, 0.5, 0.03], [sw, 0.24, 0.03], 0.01, 6), { tone: "light" });
  k.add(rod([sw, 0.5, 0.03], [-sw, 0.24, 0.03], 0.01, 6), { tone: "light" });
  // Seat and back slings.
  k.add(sheet(sw * 2, 0.42, 0.006, 4, 4, (x) => -0.02 * (1 - (x / sw) ** 2)), { tone: "deep", position: [0, 0.5, 0.045] });
  const back = sheet(sw * 2, 0.34, 0.006, 4, 4, (x) => -0.025 * (1 - (x / sw) ** 2));
  back.rotateX(Math.PI / 2 - 0.12);
  k.add(back, { tone: "deep", position: [0, 0.74, -0.2] });
  const g = k.build();
  const o = new THREE.Group();
  o.add(new THREE.Mesh(g, small()));
  o.name = "wheelchair";
  o.rotation.y = c.rng.range(-0.25, 0.25);
  return { object: o, footprint: { width: 0.68, depth: 0.9, height: 0.97 }, scalable: 0, placement: "surface" };
}

// ------------------------------------------------------------------ teddy bear

export function teddyBear(c: BuildCtx): Built {
  const k = new Kit();
  const fur = "light" as const;
  const body = blob(0.085, 0.1, 0.075, 0.95, 0.95, 11, 8);
  deform(body, (p) => {
    if (p.y < 0.02) {
      const s = 1 + 0.14 * Math.min(1, (0.02 - p.y) / 0.1);
      p.x *= s;
      p.z *= s;
    }
  });
  k.add(body, { tone: fur, position: [0, 0.1, 0] });
  // Head, slumped a little to one side.
  const head = new Kit();
  head.add(sphere(0.074, 11, 8), { tone: fur });
  head.add(blob(0.036, 0.028, 0.032, 1, 1, 10, 7), { tone: "paper", position: [0, -0.018, 0.06] });
  head.add(blob(0.014, 0.01, 0.009, 1, 1, 6, 4), { tone: "solid", position: [0, -0.008, 0.09] });
  head.add(rod([0, -0.018, 0.088], [0, -0.034, 0.083], 0.0022, 3), { tone: "solid" });
  for (const s of [-1, 1]) {
    head.add(rod([0, -0.034, 0.083], [s * 0.013, -0.038, 0.078], 0.002, 3), { tone: "solid" });
    head.add(sphere(0.009, 6, 4), { tone: "solid", position: [s * 0.029, 0.018, 0.064] });
    head.add(blob(0.03, 0.03, 0.012, 0.9, 0.9, 10, 6), { tone: fur, position: [s * 0.056, 0.058, -0.004], rotation: [0, 0, -s * 0.5] });
    head.add(blob(0.018, 0.018, 0.006, 0.9, 0.9, 8, 4), { tone: "paper", position: [s * 0.058, 0.057, 0.006], rotation: [0, 0, -s * 0.5] });
  }
  const hg = head.build();
  hg.rotateX(0.18);
  hg.rotateZ(0.16);
  hg.translate(0, 0.262, 0.012);
  k.addGeometry(hg);
  // Arms hanging forward, legs out in front with pads toward the viewer.
  for (const s of [-1, 1]) {
    k.add(blob(0.028, 0.064, 0.028, 0.95, 0.95, 8, 6), { tone: fur, position: [s * 0.086, 0.135, 0.035], rotation: [-0.55, 0, s * 0.35] });
    k.add(blob(0.036, 0.034, 0.07, 0.95, 0.95, 8, 6), { tone: fur, position: [s * 0.052, 0.034, 0.075], rotation: [0.1, s * 0.25, 0] });
    k.add(blob(0.028, 0.03, 0.006, 0.9, 0.9, 10, 4), { tone: "paper", position: [s * 0.068, 0.036, 0.143], rotation: [0.1, s * 0.25, 0] });
  }
  // A darned patch on one leg.
  k.add(cbox(0.03, 0.028, 0.006, 0.002), { tone: "mid", position: [-0.05, 0.062, 0.1], rotation: [-0.6, -0.2, 0.2] });
  // Ribbon at the neck.
  k.add(ring(0.052, 0.008, 3, 14), { tone: "dark", position: [0, 0.195, 0.004] });
  k.add(blob(0.018, 0.012, 0.008, 1, 1, 6, 4), { tone: "dark", position: [0.012, 0.192, 0.058], rotation: [0, 0, 0.3] });
  const g = jitter(k.build(), 0.0025, 11);
  const o = new THREE.Group();
  o.add(new THREE.Mesh(g, tiny()));
  o.name = "teddy-bear";
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: 0.24, depth: 0.2, height: 0.34 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ flowers

export function flowers(c: BuildCtx): Built {
  const k = new Kit();
  const rng = c.rng;
  // Built along +Y (stems down, blooms up), then laid on its side facing +Z.
  const cone = new THREE.CylinderGeometry(0.11, 0.026, 0.3, 14, 3, true);
  deform(cone, (p) => {
    const a = Math.atan2(p.z, p.x);
    if (p.y > 0.16) p.y += 0.03 * Math.abs(Math.sin(a * 3.5));
    const r = Math.hypot(p.x, p.z);
    const f = 1 + 0.05 * Math.sin(a * 5) * (r / 0.115);
    p.x *= f;
    p.z *= f;
  });
  cone.translate(0, 0.15, 0);
  k.add(cone, { tone: "paper" });
  const inner = cone.clone();
  inner.scale(0.97, 1, 0.97);
  const idx = inner.getIndex();
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i]!;
      arr[i] = arr[i + 1]!;
      arr[i + 1] = t;
    }
  }
  k.add(inner, { tone: "pale" });
  // Stems out of the narrow end.
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const rr = 0.012;
    k.add(rod([Math.cos(ang) * rr, 0.04, Math.sin(ang) * rr], [Math.cos(ang) * rr * 1.6, -0.1 - rng.range(0, 0.03), Math.sin(ang) * rr * 1.6], 0.004, 4), { tone: "mid", accent: "leaf", accentAmount: 0.7 });
  }
  // Tie and bow.
  k.add(ring(0.036, 0.007, 4, 14), { tone: "dark", position: [0, 0.07, 0] });
  for (const s of [-1, 1])
    k.add(
      band(
        [
          [0.02 * s, 0.07, 0.03],
          [0.05 * s, 0.03, 0.05],
          [0.06 * s, -0.02, 0.055],
        ],
        0.016,
        0.002,
        [1, 0, 0],
        8,
      ),
      { tone: "dark" },
    );
  // Blooms: white lilies (six-petalled stars, cupped), roses, filler.
  const lily = (x: number, y: number, z: number, tilt: number, turn: number) => {
    // Six lanceolate petals curling back from a throat, stamens standing out.
    const bloom = new Kit();
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.PlaneGeometry(0.032, 0.088, 2, 6);
      petal.translate(0, 0.044, 0);
      deform(petal, (v) => {
        const t = v.y / 0.088;
        v.x *= Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.94 + 0.06)), 0.75) * (1 - 0.35 * t);
        v.z += 0.032 * t - 0.06 * t * t * t;
      });
      petal.deleteAttribute("uv");
      petal.rotateX(-Math.PI / 2 + 0.55);
      petal.rotateY((i / 6) * Math.PI * 2 + (i % 2) * 0.12);
      bloom.add(petal, { tone: "paper" });
    }
    for (let i = 0; i < 3; i++) {
      const a2 = (i / 3) * Math.PI * 2 + 0.3;
      bloom.add(rod([0, 0, 0], [Math.cos(a2) * 0.012, 0.034, Math.sin(a2) * 0.012], 0.0014, 3, 0.0024), { tone: "dark" });
    }
    const g = bloom.build();
    g.rotateX(tilt);
    g.rotateY(turn);
    g.translate(x, y, z);
    k.addGeometry(g);
  };
  lily(0.02, 0.37, 0.03, 0.15, 0.3);
  lily(-0.08, 0.33, -0.03, -0.55, 1.2);
  lily(0.08, 0.32, -0.06, 0.6, 2.1);
  lily(-0.04, 0.32, 0.1, -0.3, 0.8);
  lily(0.07, 0.31, 0.09, 0.45, 2.8);
  for (const [x, y, z] of [
    [0.0, 0.38, -0.07],
    [-0.09, 0.35, 0.04],
  ] as const) {
    k.add(
      turned(
        [
          [0.0, -0.01],
          [0.028, 0.006],
          [0.032, 0.026],
          [0.024, 0.03],
          [0.02, 0.018],
          [0.012, 0.028],
          [0.006, 0.022],
          [0, 0.024],
        ],
        9,
      ),
      { tone: "pale", position: [x, y, z] },
    );
  }
  for (let i = 0; i < 7; i++) k.add(new THREE.IcosahedronGeometry(0.008, 0), { tone: "paper", position: [rng.range(-0.1, 0.1), 0.37 + rng.range(-0.02, 0.05), rng.range(-0.1, 0.1)] });
  // Leaves.
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.3;
    const leaf = plate(
      [
        [0, 0],
        [0.02, 0.05],
        [0, 0.12],
        [-0.02, 0.05],
      ],
      0.002,
    );
    deform(leaf, (v) => (v.z += 0.3 * v.y * v.y));
    leaf.rotateY(ang);
    leaf.rotateZ(Math.cos(ang) * 0.6);
    leaf.rotateX(Math.sin(ang) * 0.6);
    k.add(leaf, { tone: "mid", accent: "leaf", accentAmount: 0.75, position: [Math.cos(ang) * 0.09, 0.3, Math.sin(ang) * 0.09] });
  }
  const g = k.build();
  g.rotateZ(-Math.PI / 2 + 0.16); // blooms toward +X, lifted a little
  g.rotateY(-0.55); // three-quarter view: cone and blooms both read
  g.computeBoundingBox();
  g.translate(-(g.boundingBox!.min.x + g.boundingBox!.max.x) / 2, -g.boundingBox!.min.y, -(g.boundingBox!.min.z + g.boundingBox!.max.z) / 2);
  const o = new THREE.Group();
  o.add(new THREE.Mesh(g, propMaterial(HATCH.tiny, OBJECT_ID.prop, { side: THREE.DoubleSide })));
  // A card tucked in.
  const words = (c.label ?? "for you").slice(0, 16);
  const tex = inkTexture(`card:${words}`, 192, 128, (gg, w, h) => {
    gg.fillStyle = "#fff";
    gg.fillRect(0, 0, w, h);
    gg.lineWidth = 4;
    gg.strokeRect(6, 6, w - 12, h - 12);
    marker(gg, words, w / 2, h / 2, h * 0.2, c.rng.fork("card"), { maxW: w * 0.8, color: "#111" });
  });
  const card = printPlane(tex, 0.075, 0.05, [0.02, 0.09, 0.1], "front", { rotate: 0.2 });
  if (card) {
    card.material = inkMaterial({ map: tex!, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.print, side: THREE.DoubleSide, shade: 0.5 });
    card.rotation.x = -0.5;
    o.add(card);
  }
  o.name = "flowers";
  o.rotation.y = rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: 0.62, depth: 0.34, height: 0.28 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ lantern

export function lantern(c: BuildCtx, lit = true): Built {
  const a = new Assembly(tiny(), "lantern");
  a.add(
    turned(
      [
        [0, 0],
        [0.068, 0],
        [0.074, 0.005],
        [0.078, 0.026],
        [0.072, 0.046],
        [0.045, 0.058],
        [0.038, 0.066],
      ],
      14,
    ),
    { tone: "light" },
  );
  a.add(rodY(0.032, 0.062, 0.078, 10), { tone: "mid" });
  a.add(rod([0.03, 0.07, 0], [0.05, 0.07, 0.02], 0.004, 5), { tone: "mid" });
  a.add(cylinder(0.01, 0.01, 0.006, 8), { tone: "dark", position: [0.052, 0.07, 0.022], rotation: [Math.PI / 2, 0, -0.8] });
  // Flame on its wick.
  a.add(rodY(0.004, 0.078, 0.09, 5), { tone: "solid" });
  const flame = blob(0.011, 0.028, 0.011, 1, 1, 8, 6);
  deform(flame, (p) => {
    if (p.y > 0) {
      const s = 1 - (p.y / 0.028) * 0.75;
      p.x *= s;
      p.z *= s;
    }
  });
  flame.translate(0, 0.112, 0);
  const flameMesh = new THREE.Mesh(flame, inkMaterial({ tone: 0, flat: true, accent: "ember", accentAmount: 1, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.lamp, edge: 0.5 }));
  flameMesh.name = "lantern:flame";
  flameMesh.visible = lit;
  a.attach(flameMesh);
  // Wire guard, air tubes, vented cap and bail.
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pts: V3[] = [];
    for (const [r, y] of [
      [0.042, 0.075],
      [0.064, 0.11],
      [0.068, 0.15],
      [0.06, 0.19],
      [0.042, 0.215],
    ] as const)
      pts.push([Math.cos(ang) * r, y, Math.sin(ang) * r]);
    a.add(wire(pts, 0.0022, 10, 3), { tone: "dark" });
  }
  a.add(ring(0.0665, 0.0022, 3, 20), { tone: "dark", position: [0, 0.15, 0] });
  for (const s of [-1, 1]) {
    a.add(rod([s * 0.075, 0.03, 0], [s * 0.075, 0.24, 0], 0.0055, 6), { tone: "light" });
    a.add(rod([s * 0.075, 0.24, 0], [s * 0.035, 0.24, 0], 0.0055, 6), { tone: "light" });
  }
  a.add(
    turned(
      [
        [0.035, 0.212],
        [0.05, 0.222],
        [0.048, 0.236],
        [0.032, 0.248],
        [0.016, 0.254],
        [0, 0.255],
      ],
      18,
    ),
    { tone: "mid" },
  );
  a.add(
    wire(
      [
        [-0.078, 0.23, 0],
        [-0.07, 0.3, 0],
        [0, 0.345, 0],
        [0.07, 0.3, 0],
        [0.078, 0.23, 0],
      ],
      0.0022,
      14,
      3,
    ),
    { tone: "dark" },
  );
  // Glass globe drawn as a stippled screen so the flame shows through.
  const globe = turned(
    [
      [0.036, 0.074],
      [0.054, 0.1],
      [0.061, 0.14],
      [0.055, 0.185],
      [0.036, 0.212],
    ],
    20,
  );
  const glassMat = inkMaterial({ tone: 0, opacity: 0.42, accent: "ember", accentAmount: lit ? 0.45 : 0, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.lamp, edge: 0.7 });
  const glass = new THREE.Mesh(globe, glassMat);
  glass.name = "lantern:glass";
  a.attach(glass);
  const o = a.build();
  o.userData.setLit = (on: boolean) => {
    glass.material = inkMaterial({ tone: 0, opacity: 0.42, accent: "ember", accentAmount: on ? 0.45 : 0, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.lamp, edge: 0.7 });
    flameMesh.visible = on;
    o.userData.lit = on;
  };
  o.userData.lit = lit;
  o.rotation.y = c.rng.range(0, Math.PI * 2);
  return { object: o, footprint: { width: 0.17, depth: 0.17, height: 0.35 }, scalable: 1, placement: "surface" };
}

