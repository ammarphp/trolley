/**
 * The compute build-out: hyperscale data-centre campuses, Vela's research
 * campus, and the sealed isolation hall with its single cable trunk.
 */
import * as THREE from "three";
import { extrude } from "../../core/geometry.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Rng } from "../../core/rng.ts";
import { Build, fence, latticeMast, rectPath, rubble, scaffold, signMesh, signTexture, towerCrane, type Vec3 } from "./common.ts";
import { createPlume } from "./effects.ts";
import { substationYard, transformer } from "./power.ts";

// =================================================================== data hall

interface HallOpts {
  genSide: -1 | 1;
  /** Simplified plant (rear halls, mostly hidden from the line). */
  lite?: boolean;
  /** Steel frame only (construction). */
  frame?: boolean;
  /** Foundation slab only (construction). */
  slab?: boolean;
  gens?: boolean;
  storeys?: 1 | 2;
}

const BAY = 7.5;

function dataHall(b: Build, cx: number, cz: number, L: number, W: number, H: number, o: HallOpts): void {
  const r = b.rng;
  const nb = Math.round(L / BAY);
  L = nb * BAY;
  const x0 = cx - L / 2;
  const zF = cz + W / 2,
    zB = cz - W / 2;
  if (o.slab) {
    b.box(L + 2, 0.5, W + 2, cx, 0, cz, "light");
    for (let i = 0; i <= nb; i += 1) for (const z of [zF, zB, cz]) b.line([x0 + i * BAY, 0.5, z], [x0 + i * BAY, 2.4, z]);
    // Stacked precast panels waiting.
    for (let i = 0; i < 4; i++) b.box(12, 0.4 * 6, 3.2, cx - L / 2 + 14 + i * 16, 0.5, zF + 8, "pale");
    return;
  }
  if (o.frame) {
    // Steel columns, primary girders and roof trusses; one end clad.
    for (let i = 0; i <= nb; i++) {
      const x = x0 + i * BAY;
      for (const z of [zF, cz, zB]) b.box(0.5, H, 0.5, x, 0, z, "mid");
      b.beam([x, H, zF], [x, H, zB], 0.35, "mid", 1.1);
      if (i % 2 === 0) {
        b.line([x, H - 0.6, zF], [x, H + 1.2, cz]);
        b.line([x, H + 1.2, cz], [x, H - 0.6, zB]);
      }
    }
    for (const z of [zF, cz, zB]) b.beam([x0, H, z], [x0 + L, H, z], 0.4, "mid", 0.9);
    const clad = Math.round(nb * 0.3) * BAY;
    b.box(clad, H, W, x0 + clad / 2, 0, cz, "paper");
    b.box(clad + 0.4, 0.5, W + 0.4, x0 + clad / 2, H, cz, "pale");
    b.box(L + 2, 0.4, W + 2, cx, 0, cz, "light");
    scaffold(b, x0 + clad + BAY * 1.5, cz, BAY * 3, W, H, 2, 2.5);
    return;
  }
  const ruin = b.ruin;
  // Concrete upstand plinth.
  b.box(L + 0.6, 0.9, W + 0.6, cx, 0, cz, "pale");
  if (!ruin) {
    b.box(L, H, W, cx, 0, cz, "paper");
  } else if (o.lite) {
    // Rear halls: shell standing, roof fallen in over a third of the length.
    const keep = L * 0.64;
    b.box(L, H * 0.92, W, cx, 0, cz, b.wear("paper"));
    b.box(keep, 0.6, W + 0.6, x0 + keep / 2, H * 0.92, cz, "light");
    b.box(L - keep, 0.5, W * 0.9, x0 + keep + (L - keep) / 2, H * 0.55, cz, "dark", { rz: 0.18 });
  } else {
    // Panelised shell so bays can be missing; racks inside show through.
    for (let i = 0; i < nb; i++) {
      const x = x0 + (i + 0.5) * BAY;
      for (const z of [zF, zB]) {
        const gone = r.chance(0.18);
        if (gone) continue;
        const hh = r.chance(0.15) ? H * r.range(0.3, 0.8) : H;
        b.box(BAY, hh, 0.45, x, 0, z, b.wear("paper"));
      }
      if (r.chance(0.55)) b.box(BAY, 0.5, W, x, H - 0.5, cz, b.wear("light"));
      else if (r.chance(0.5)) b.box(BAY, 0.5, W * 0.7, x, H * 0.45, cz + W * 0.1, "dark", { rz: r.range(-0.25, 0.25), rx: r.range(-0.3, 0.3) });
    }
    for (const x of [x0, x0 + L]) b.box(0.45, H, W, x, 0, cz, b.wear("paper"));
    if (!o.lite) for (let row = 0; row < 2; row++) for (let i = 0; i < nb - 1; i += 2) b.box(BAY * 1.8, 2.3, 0.9, x0 + (i + 1) * BAY, 0.9, cz - W / 2 + 10 + row * (W - 20), "deep");
    rubble(b, cx + r.range(-L / 4, L / 4), zF + 5, 7, 3.5, 7);
    if (!o.lite) rubble(b, cx + r.range(-L / 3, L / 3), zB - 5, 6, 3, 8);
  }
  // Pilasters and parapet coping.
  const pil = b.pristine ? 0.14 : 0.28;
  for (let i = 0; i <= nb; i++) {
    const x = x0 + i * BAY;
    if (ruin && r.chance(0.25)) continue;
    if (o.lite && i % 2 === 1) continue;
    b.box(0.5, H + 0.3, pil, x, 0, zF + pil / 2, "paper");
    b.box(0.5, H + 0.3, pil, x, 0, zB - pil / 2, "paper");
  }
  const ne = Math.round(W / BAY);
  for (let i = 0; i <= ne; i++) {
    const z = zB + (i * W) / ne;
    b.box(pil, H + 0.3, 0.5, x0 - pil / 2, 0, z, "paper");
    b.box(pil, H + 0.3, 0.5, x0 + L + pil / 2, 0, z, "paper");
  }
  if (!ruin) b.box(L + 0.8, 0.5, W + 0.8, cx, H, cz, "pale");
  // Intake louvre panels high on the long walls: two bays of three.
  if (!b.pristine) {
    for (let i = 0; i < nb; i++) {
      const x = x0 + (i + 0.5) * BAY;
      for (const [z, s] of [
        [zF, 1],
        [zB, -1],
      ] as const) {
        if (ruin && (r.chance(0.3) || (o.lite && s < 0))) continue;
        // Intake louvre band (deep) with a lighter blanking panel every fourth bay.
        const blank = i % 4 === 3;
        b.box(BAY - 0.9, 3.6, 0.14, x, H - 5.4, z + s * 0.07, ruin ? "solid" : blank ? "light" : 0.94);
        // Louvre blades: white hairlines over the black intake (engraved look).
        if (!blank && !ruin) for (let l = 1; l < 6; l++) b.paperLines.push(x - BAY / 2 + 0.5, H - 5.4 + l * 0.6, z + s * 0.16, x + BAY / 2 - 0.5, H - 5.4 + l * 0.6, z + s * 0.16);
      }
    }
  } else {
    // Pristine: a single hairline reveal instead of louvres.
    b.box(L + 0.05, 0.12, W + 0.05, cx, H - 3.2, cz, "light");
  }
  // Personnel doors with canopies and cyan status lamps.
  for (let i = 2; i < nb - 1; i += 4) {
    const x = x0 + (i + 0.5) * BAY;
    for (const [z, s] of [
      [zF, 1],
      [zB, -1],
    ] as const) {
      if (s === o.genSide) continue;
      b.box(1.3, 2.5, 0.1, x, 0.9, z + s * 0.05, b.pristine ? "pale" : "dark");
      if (!b.pristine) b.box(2.6, 0.2, 1.4, x, 3.6, z + s * 0.7, "pale");
      if (!ruin && !o.lite) b.lens(x + 1.1, 3.1, z + s * 0.12, 0.5, 0.3, "cyan");
    }
  }
  // Cyan status strip: a dashed line of lamps under the parapet on both long
  // faces, so the halls read as live machines from the line.
  if (!ruin)
    for (let i = 0; i < nb; i += 2) {
      const x = x0 + (i + 0.5) * BAY;
      b.lens(x, H - 1.05, zF + 0.1, 4.2, 0.42, "cyan");
      if (!o.lite) b.lens(x, H - 1.05, zB - 0.1, 4.2, 0.42, "cyan", Math.PI);
    }
  // Loading docks at the +X end.
  for (let d = 0; d < 3; d++) {
    const z = cz - 9 + d * 9;
    b.box(0.12, 4.6, 4.2, x0 + L + 0.06, 0.9, z, b.pristine ? "paper" : ruin ? "solid" : "light");
    if (!b.pristine) for (let s = 1; s < 5; s++) b.line([x0 + L + 0.14, 0.9 + s * 0.9, z - 2.1], [x0 + L + 0.14, 0.9 + s * 0.9, z + 2.1], true);
  }
  if (!b.pristine) b.box(4, 0.4, 30, x0 + L + 2, 6.2, cz, "pale");
  // Rooftop plant.
  const roofY = H + (o.storeys === 2 ? 0 : 0);
  if (b.pristine) {
    // Screened: a continuous clean enclosure hides the machines.
    b.box(L * 0.84, 3.4, W * 0.6, cx, roofY, cz, "paper");
  } else {
    const rows = o.lite ? 1 : 2;
    const mod = o.lite ? 18 : 13;
    const nm = Math.floor((L * 0.86) / (mod + 1.6));
    for (let rw = 0; rw < rows; rw++) {
      const z = o.lite ? cz : cz - W * 0.18 + rw * W * 0.36;
      for (let m = 0; m < nm; m++) {
        const x = cx - ((nm - 1) * (mod + 1.6)) / 2 + m * (mod + 1.6);
        if (ruin && r.chance(0.35)) {
          if (r.chance(0.5)) b.box(mod, 2.4, 2.3, x, H * r.range(0.4, 1), z, "dark", { rz: r.range(-0.4, 0.4), rx: r.range(-0.3, 0.3) });
          continue;
        }
        b.box(mod, 2.2, 2.4, x, roofY, z, b.wear("pale"));
        b.box(mod + 0.1, 0.12, 2.5, x, roofY + 2.2, z, "mid");
        for (let f = 0; f < 2; f++) b.cyl(1.05, 0.5, x - mod / 4 + (f * mod) / 2, roofY + 2.2, z, "light", 6);
      }
    }
    // Walkway handrails at the roof edge.
    if (!ruin) b.polyline(
      [
        [x0 + 0.5, H + 1.6, zF - 0.5],
        [x0 + L - 0.5, H + 1.6, zF - 0.5],
      ],
      true,
    );
  }
  // Generator yard: containerised gensets with stacks rising above the roof.
  if (o.gens !== false) {
    const gz = o.genSide > 0 ? zF + 9 : zB - 9;
    const gy = o.genSide > 0 ? 1 : -1;
    b.box(L + 4, 0.25, 16, cx, 0, gz, "light");
    for (let i = 0; i < nb; i++) {
      const x = x0 + (i + 0.5) * BAY;
      if (b.building && i > nb * 0.6) break;
      const toppled = ruin && r.chance(0.25);
      b.box(3.3, 3.8, 12, x, 0.25, gz, toppled ? "dark" : b.wear("paper"));
      if (!o.lite) {
        b.box(3.4, 0.25, 12.1, x, 4.05, gz, "light");
        b.line([x - 1.7, 1.6, gz - 5.5], [x - 1.7, 1.6, gz + 5.5], true);
        b.line([x - 1.7, 3, gz - 5.5], [x - 1.7, 3, gz + 5.5], true);
      }
      const stackH = H + 8.5;
      const sx = x + 0.6,
        sz = gz - gy * 4.2;
      if (toppled) {
        b.rod([sx, 4.3, sz], [sx + r.range(-6, 6), 0.6, sz + gy * 9], 0.45, "dark", 8);
        continue;
      }
      if (!o.lite) b.box(2.2, 1.6, 1.4, x - 0.4, 4.3, sz, "pale");
      b.cyl(0.46, stackH - 4.3, sx, 4.3, sz, b.pristine ? "paper" : "light", 6, 0.56);
      // Stay struts back to the hall wall.
      const wz = o.genSide > 0 ? zF : zB;
      if (i % 2 === 0) b.line([sx, stackH - 3, sz], [sx, H - 1, wz]);
    }
    if (!ruin) b.lamp(x0 + BAY * 0.5 + 0.6, H + 6.2, gz - gy * 4.2, 0.7, "signal", true);
  }
}

// =================================================================== campus

function hallNumbers(): THREE.Texture | null {
  return signTexture("dc-hall-numbers", 512, 512, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 0; i < 4; i++) {
      const cy = (i + 0.5) * (h / 4);
      g.font = "bold 96px sans-serif";
      g.fillText(`0${i + 1}`, w * 0.62, cy + 4);
      g.font = "bold 30px sans-serif";
      g.fillText("DATA", w * 0.22, cy - 18);
      g.fillText("HALL", w * 0.22, cy + 18);
      g.fillRect(w * 0.4, cy - 40, 5, 80);
    }
  });
}

export function buildDataCenter(b: Build, seed: Rng): THREE.Group {
  const pristine = b.pristine;
  const n = pristine ? 3 : seed.int(2, 3);
  const W = 44;
  const H = 15;
  const gap = 40;
  const halls: Array<{ cx: number; cz: number; L: number; H: number }> = [];
  // Three-hall campuses keep their halls a little shorter (triangle budget).
  const Lbase = pristine ? 165 : n === 3 ? seed.range(145, 160) : seed.range(150, 185);
  for (let i = 0; i < n; i++) {
    const L = pristine ? Lbase : Math.round((Lbase + seed.range(-20, 12)) / BAY) * BAY;
    const cx = pristine ? 0 : seed.range(-12, 12);
    // Rear halls rise to two storeys: the campus steps up away from the line.
    halls.push({ cx, cz: 20 - i * (W + gap), L, H: i === 0 || pristine ? H : H + 9 });
  }
  halls.forEach((h, i) => {
    const frame = b.building && i === 1;
    const slab = b.building && i === 2;
    // The front hall turns its generator comb toward the approach.
    dataHall(b, h.cx, h.cz, h.L, W, h.H, { genSide: i === 0 ? 1 : -1, frame, slab, gens: !slab && !frame, lite: i > 0 });
    if (i < n - 1) b.box(Math.max(h.L, 150) + 20, 0.05, 7, h.cx, 0, h.cz - W / 2 - gap + 5, "light");
  });
  const front = halls[0]!;
  const hxMin = Math.min(...halls.map((h) => h.cx - h.L / 2));
  const hxMax = Math.max(...halls.map((h) => h.cx + h.L / 2));
  const xMin = hxMin - 62;
  const xMax = hxMax + 62;
  const zMax = front.cz + W / 2 + 30;
  const zMin = halls[n - 1]!.cz - W / 2 - 26;
  // Hall numbers painted large on the approach ends.
  const numTex = hallNumbers();
  if (numTex) {
    const parts: THREE.BufferGeometry[] = [];
    halls.forEach((h, i) => {
      if ((b.building && i > 0) || i > 3) return;
      const pg = new THREE.PlaneGeometry(9, 9);
      const uv = pg.getAttribute("uv") as THREE.BufferAttribute;
      for (let v = 0; v < uv.count; v++) uv.setY(v, 1 - (i + 1 - uv.getY(v)) / 4);
      pg.rotateY(-Math.PI / 2);
      pg.translate(h.cx - h.L / 2 - 0.35, h.H - 6.2, h.cz + 8);
      parts.push(pg);
    });
    if (parts.length) {
      const merged = new THREE.Mesh(mergeGeometries(parts), inkMaterial({ map: numTex, flat: true, hatch: 0.1 }));
      merged.name = "hall-numbers";
      merged.userData.castShadow = false;
      b.group.add(merged);
    }
  }
  // Admin block at the approach end: the only glazed, human-scale building.
  const ax = hxMin - 30,
    az = front.cz + 4;
  b.box(13, 9.4, 40, ax, 0, az, b.wear("paper"));
  b.box(14, 0.6, 41, ax, 9.4, az, "pale");
  b.box(0.1, 6.2, 38.6, ax - 6.52, 1.6, az, b.glass);
  if (!pristine) for (let i = 0; i <= 24; i++) b.box(0.7, 7, 0.18, ax - 6.8, 1.2, az - 19.3 + i * (38.6 / 24), "paper");
  b.box(1.2, 0.5, 40.4, ax - 7, 4.8, az, "paper");
  if (!pristine) {
    b.box(5, 0.35, 12, ax - 9, 3.4, az + 8, "pale");
    for (const dz of [2.5, 13.5]) b.box(0.25, 3.4, 0.25, ax - 11.2, 0, az + dz, "mid");
    for (let i = 0; i < 16; i++) b.line([ax - 16, 0.03, az - 20 + i * 2.6], [ax - 21, 0.03, az - 20 + i * 2.6], true);
    b.box(14, 0.04, 46, ax - 21, 0, az, "light");
  }
  if (!b.ruin) b.lens(ax - 6.62, 8.2, az + 19, 0.9, 0.35, "cyan", -Math.PI / 2);
  // Grid connection and transformer yard at the far (+X) end.
  const tie = substationYard(b, hxMax + 34, front.cz - 36, 40, 56, { fence: false });
  for (let i = 0; i < n; i++) {
    const h = halls[i]!;
    if (b.building && i > 0) continue;
    for (let t = 0; t < (i === 0 ? 2 : 1); t++) transformer(b, h.cx + h.L / 2 + 8, h.cz - 8 + t * 16, 0.8, Math.PI / 2);
  }
  // Cooling-water tanks and fuel farm behind the rear hall.
  for (let i = 0; i < 2; i++) {
    const tx = hxMin + 20 + i * 24,
      tz = zMin + 16;
    b.cyl(9, 14, tx, 0, tz, b.wear("paper"), 20);
    b.add(new THREE.ConeGeometry(9.3, 1.8, 20), { tone: "pale", position: [tx, 14.9, tz] });
    const ring: Vec3[] = [];
    for (let s = 0; s <= 20; s++) ring.push([tx + Math.cos((s / 20) * Math.PI * 2) * 9.35, 15.4, tz + Math.sin((s / 20) * Math.PI * 2) * 9.35]);
    b.polyline(ring, true);
  }
  for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(1.6, 1.6, 12, 8), { tone: "pale", position: [hxMin + 70, 1.9, zMin + 10 + i * 4.2], rotation: [0, 0, Math.PI / 2] });
  // Perimeter security: fence, gatehouse, camera and lighting masts.
  const perim = rectPath((xMin + xMax) / 2, (zMin + zMax) / 2, xMax - xMin, zMax - zMin);
  // Run starts at the approach-front corner; the gate sits on the approach (-X) side.
  const run: Array<[number, number]> = [perim[3]!, perim[0]!, perim[1]!, perim[2]!, perim[3]!];
  const gateAt = zMax - az;
  fence(b, run, { height: 3.2, postGap: 4.5, outrigger: !pristine, solid: pristine, gaps: [[gateAt - 7, gateAt + 7]], damage: b.ruin ? 0.35 : 0 });
  const gz = az;
  b.box(3.4, 3.2, 4.6, xMin - 3, 0, gz + 10, pristine ? "paper" : "pale");
  b.box(4.2, 0.35, 5.4, xMin - 3, 3.2, gz + 10, "light");
  if (!pristine) b.box(0.08, 1.2, 3.6, xMin - 4.72, 1.4, gz + 10, b.glass);
  b.box(0.3, 1.1, 0.3, xMin - 2, 0, gz - 6, "mid");
  if (!b.ruin) b.box(0.14, 0.14, 11, xMin - 2, 1, gz - 0.5, "paper", { accent: "signal", accentAmount: 0.85 });
  for (let i = 0; i < 6; i++) b.cyl(0.25, 0.9, xMin - 8, 0, gz - 5 + i * 2, "mid", 6);
  const corners: Array<[number, number]> = [
    [xMin + 1.5, zMax - 1.5],
    [xMax - 1.5, zMax - 1.5],
    [xMax - 1.5, zMin + 1.5],
    [xMin + 1.5, zMin + 1.5],
  ];
  for (const [x, z] of corners) {
    b.line([x, 0, z], [x, 9, z]);
    b.box(0.5, 0.4, 0.7, x, 8.6, z + 0.3, "dark");
    b.box(0.35, 0.35, 0.6, x + 0.4, 8.2, z - 0.2, "dark", { ry: 0.7 });
  }
  // Floodlight masts along the approach fence: a tall regular rhythm.
  const nm = Math.max(4, Math.round((xMax - xMin) / 42));
  for (let i = 0; i <= nm; i++) {
    const x = xMin + 6 + (i * (xMax - xMin - 12)) / nm;
    const z = zMax - 5;
    b.cyl(0.32, 22, x, 0, z, pristine ? "paper" : "light", 6, 0.16);
    b.box(3.2, 0.9, 0.3, x, 22, z + 0.2, "mid");
    for (let l = 0; l < 4; l++) b.flood(x - 1.2 + l * 0.8, 22.45, z + 0.4, 0.6, 0.5);
  }
  // Site works: cranes over the frame and slab.
  if (b.building) {
    const h1 = halls[1]!;
    towerCrane(b, h1.cx - 20, h1.cz - W / 2 - 10, 42, 50, 0.3);
    if (n > 2) towerCrane(b, halls[2]!.cx + 30, halls[2]!.cz + 4, 48, 55, 2.2);
    for (let i = 0; i < 6; i++) b.box(12, 0.9, 2.4, h1.cx + h1.L / 2 + 14, i * 0.9, h1.cz + 10, i % 2 ? "mid" : "light");
  }
  if (b.ruin) {
    for (let i = 0; i < 2; i++) {
      const h = halls[seed.int(0, n - 1)]!;
      const smoke = createPlume({
        origin: [h.cx + seed.range(-40, 40), h.H - 2, h.cz],
        rng: seed.fork(`dcsmoke${i}`),
        count: 16,
        life: 22,
        height: 80,
        r0: 4,
        r1: 14,
        drift: [40, -25],
        tone: 0.62,
        toneTop: 0.4,
        thinFrom: 0.42,
        hatch: 0.5,
      });
      b.effect(smoke);
    }
  }
  b.blinkPeriod = 1.8;
  const g = b.finish({ width: xMax - xMin + 20, depth: zMax - zMin + 10, height: H + 17, offsetZ: (zMax + zMin) / 2 }, "data-center");
  g.userData.gridTie = tie;
  return g;
}

// =================================================================== Vela research campus

function drawVela(g: CanvasRenderingContext2D, w: number, h: number, ruin: boolean): void {
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  const s = h / 256;
  g.save();
  g.scale(s, s);
  // Geometric wordmark, drawn as paths so it never depends on system fonts.
  g.fillStyle = "#000";
  const stroke = 30;
  const top = 58,
    bot = 198;
  // Sail mark: a raked triangle with a hairline boom.
  g.beginPath();
  g.moveTo(40, bot);
  g.lineTo(120, top - 14);
  g.lineTo(128, bot);
  g.closePath();
  g.fill();
  g.fillRect(28, bot + 12, 112, 7);
  let x = 190;
  const V = () => {
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x + stroke * 1.15, top);
    g.lineTo(x + 62, bot - 44);
    g.lineTo(x + 124 - stroke * 1.15, top);
    g.lineTo(x + 124, top);
    g.lineTo(x + 62 + stroke * 0.6, bot);
    g.lineTo(x + 62 - stroke * 0.6, bot);
    g.closePath();
    g.fill();
    x += 150;
  };
  const E = () => {
    g.fillRect(x, top, stroke, bot - top);
    g.fillRect(x, top, 96, stroke);
    g.fillRect(x, (top + bot) / 2 - stroke / 2, 82, stroke);
    g.fillRect(x, bot - stroke, 96, stroke);
    x += 128;
  };
  const L = () => {
    g.fillRect(x, top, stroke, bot - top);
    g.fillRect(x, bot - stroke, 92, stroke);
    x += 118;
  };
  const A = () => {
    g.beginPath();
    g.moveTo(x + 62 - stroke * 0.6, top);
    g.lineTo(x + 62 + stroke * 0.6, top);
    g.lineTo(x + 124, bot);
    g.lineTo(x + 124 - stroke * 1.15, bot);
    g.lineTo(x + 62, top + 44);
    g.lineTo(x + stroke * 1.15, bot);
    g.lineTo(x, bot);
    g.closePath();
    g.fill();
    x += 150;
  };
  V();
  E();
  L();
  A();
  if (ruin) {
    // Scorch and a crack through the name.
    g.strokeStyle = "#000";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(300, 0);
    g.lineTo(330, 70);
    g.lineTo(312, 130);
    g.lineTo(360, 256);
    g.stroke();
    g.globalAlpha = 0.6;
    for (let i = 0; i < 400; i++) {
      const px = 520 + Math.sin(i * 12.9) * 200 + Math.cos(i * 3.1) * 60;
      const py = 128 + Math.sin(i * 7.7) * 120;
      g.fillRect(px, py, 3, 3);
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

function velaSign(b: Build, x: number, y: number, z: number, w: number, ry = 0): void {
  const tex = signTexture(b.ruin ? "vela-ruin" : "vela", 1024, 256, (g, cw, ch) => drawVela(g, cw, ch, b.ruin));
  const m = signMesh(tex, w, w / 4);
  if (!m) return;
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.name = "vela-sign";
  b.group.add(m);
}

export function buildLab(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const pristine = b.pristine;
  const ruin = b.ruin;
  // Main pavilion: three upper floors cantilevered over a recessed glass lobby.
  const L = 96,
    D = 26,
    fh = 4.2;
  const floors = 3;
  const base = 4.8;
  const top = base + floors * fh;
  const cz = 0;
  b.box(L - 8, base, D - 6, 0, 0, cz, b.glass);
  for (let i = 0; i < 12; i++) b.box(0.7, base, 0.7, -L / 2 + 8 + i * ((L - 16) / 11), 0, cz + D / 2 - 3.6, "paper");
  b.box(L, floors * fh, D, 0, base, cz, b.glass);
  // Floor slab edges and the roof canopy.
  for (let f = 0; f <= floors; f++) {
    const y = base + f * fh - 0.25;
    const over = f === floors ? 2.2 : 0.35;
    const th = f === floors ? 0.9 : 0.5;
    b.box(L + over * 2, th, D + over * 2, 0, y, cz, "paper");
  }
  // The fin screen: tall white blades at 1.2 m, deep enough to cast shadow.
  const finGap = 1.2;
  const nf = Math.round(L / finGap);
  for (let i = 0; i <= nf; i++) {
    const x = -L / 2 + i * finGap;
    if (ruin && r.chance(0.3)) {
      if (r.chance(0.3)) b.box(0.3, floors * fh * r.range(0.2, 0.6), 0.9, x, base, cz + D / 2 + 0.6, "light", { rz: r.range(-0.6, 0.6) });
      continue;
    }
    const d = pristine ? 0.7 : 0.95;
    b.box(0.26, floors * fh, d, x, base, cz + D / 2 + d / 2, "paper");
    b.box(0.26, floors * fh, d, x, base, cz - D / 2 - d / 2, "paper");
  }
  const ne = Math.round(D / finGap);
  for (let i = 0; i <= ne; i++) {
    const z = cz - D / 2 + i * finGap;
    b.box(0.95, floors * fh, 0.26, -L / 2 - 0.47, base, z, "paper");
    b.box(0.95, floors * fh, 0.26, L / 2 + 0.47, base, z, "paper");
  }
  // Tower block with horizontal louvres, and the rooftop VELA name.
  const tx = L / 2 - 12,
    tz = cz - 8,
    tw = 26,
    td = 26,
    th = 34;
  if (b.building) {
    for (let i = 0; i <= 4; i++)
      for (let j = 0; j <= 4; j++) b.box(0.6, th * 0.75, 0.6, tx - tw / 2 + (i * tw) / 4, top, tz - td / 2 + (j * td) / 4, "mid");
    for (let f = 1; f <= 5; f++) b.box(tw, 0.35, td, tx, top + f * 4.2, tz, "light");
    towerCrane(b, tx - tw / 2 - 10, tz - td / 2 - 6, top + th + 20, 46, 0.8);
  } else {
    b.box(tw, th, td, tx, top - 0.6, tz, b.glass);
    for (let f = 0; f < Math.round(th / 1.4); f++) {
      const y = top + f * 1.4;
      b.box(tw + 1.2, 0.18, 1.1, tx, y, tz + td / 2 + 0.3, "paper");
      b.box(1.1, 0.18, td + 1.2, tx - tw / 2 - 0.3, y, tz, "paper");
      b.box(1.1, 0.18, td + 1.2, tx + tw / 2 + 0.3, y, tz, "paper");
    }
    b.box(tw + 2, 1.2, td + 2, tx, top + th - 0.6, tz, "paper");
    velaSign(b, tx, top + th - 5.2, tz + td / 2 + 1.2, 20);
    // Roof plant and a mast.
    b.box(10, 3, 8, tx - 3, top + th + 0.6, tz - 4, "pale");
    b.line([tx + 8, top + th + 0.6, tz + 6], [tx + 8, top + th + 14, tz + 6]);
    if (!ruin) b.lamp(tx + 8, top + th + 14.2, tz + 6, 0.7, "signal", true);
  }
  // Compute annex: windowless, humming, connected by a glass bridge.
  const ax = -L / 2 + 14,
    az = cz - D / 2 - 30;
  b.box(46, 12, 28, ax, 0, az, b.wear("paper"));
  b.box(46.6, 0.5, 28.6, ax, 12, az, "pale");
  for (let i = 0; i <= 6; i++) b.box(0.5, 12, 0.35, ax - 23 + i * (46 / 6), 0, az + 14.2, "paper");
  for (let m = 0; m < 5; m++) {
    b.box(7, 2.2, 2.4, ax - 16 + m * 8, 12.5, az - 4, "pale");
    for (let f = 0; f < 3; f++) b.cyl(0.8, 0.5, ax - 18.4 + m * 8 + f * 2.4, 14.7, az - 4, "light", 7);
    if (!ruin) b.lamp(ax - 16 + m * 8, 11, az + 14.3, 0.5, "cyan");
  }
  b.box(4, 3.4, 18, ax + 6, base + 1, az + 23, b.glass);
  b.box(4.4, 0.4, 18.4, ax + 6, base + 4.4, az + 23, "paper");
  // Plaza: reflecting pool, bollards, the stone name wall, gatehouse.
  const pz = cz + D / 2 + 16;
  b.box(L * 0.6, 0.35, 16, -8, 0, pz + 2, "pale");
  b.box(30, 0.42, 7, -14, 0, pz + 1, ruin ? "solid" : "deep");
  for (let i = 0; i < 14; i++) b.cyl(0.18, 0.95, -40 + i * 5.5, 0, pz + 12, "light", 6);
  b.box(13, 2.6, 1.2, 26, 0, pz + 9, pristine ? "paper" : "pale");
  b.box(13.4, 0.2, 1.4, 26, 2.6, pz + 9, "light");
  velaSign(b, 26, 1.35, pz + 9.62, 9.6);
  b.box(4, 3, 4, 44, 0, pz + 14, "paper");
  b.box(5, 0.3, 5, 44, 3, pz + 14, "light");
  if (!pristine) b.box(3, 1.3, 0.08, 44, 1.2, pz + 16.02, b.glass);
  fence(b, [
    [-L / 2 - 20, pz + 20],
    [40, pz + 20],
  ], { height: 2.2, postGap: 3, solid: pristine, damage: ruin ? 0.4 : 0 });
  fence(b, [
    [48, pz + 20],
    [L / 2 + 20, pz + 20],
    [L / 2 + 20, az - 20],
    [-L / 2 - 20, az - 20],
    [-L / 2 - 20, pz + 20],
  ], { height: 2.2, postGap: 3, solid: pristine, damage: ruin ? 0.4 : 0 });
  if (!ruin && !pristine) {
    // Lit lobby: the one warm, occupied-looking place.
    b.glow(L - 12, 0.18, 0, base - 0.5, cz + D / 2 - 3 + 0.05, "cobalt", 0, 0.6);
  }
  if (ruin) {
    rubble(b, -20, cz + D / 2 + 4, 8, 3, 16);
    const smoke = createPlume({ origin: [10, top, cz], rng: seed.fork("labsmoke"), count: 14, life: 20, height: 70, r0: 4, r1: 13, drift: [35, -20], tone: 0.62, toneTop: 0.4, thinFrom: 0.42, hatch: 0.4 });
    b.effect(smoke);
  }
  return b.finish({ width: L + 44, depth: D + 90, height: top + th + 14, offsetZ: -8 }, "lab");
}

// =================================================================== isolation hall

export function buildIsolationHall(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const L = 66,
    D = 36,
    H = 19;
  const ruin = b.ruin;
  // Battered buttresses: concrete fins sloping out at the foot.
  const hall = b.pristine ? "paper" : b.wear("paper");
  b.box(L, H, D, 0, 0, 0, hall);
  b.box(L + 3, 1.4, D + 3, 0, H, 0, "pale");
  const nb = 8;
  for (let i = 0; i <= nb; i++) {
    const x = -L / 2 + (i * L) / nb;
    const but = extrude(
      [
        [0, 0],
        [4.2, 0],
        [1.1, H - 2],
        [0, H - 2],
      ],
      1.6,
    );
    if (!(ruin && r.chance(0.2))) {
      b.add(but, { tone: hall, position: [x, 0, D / 2], rotation: [0, -Math.PI / 2, 0] });
      b.add(but, { tone: hall, position: [x, 0, -D / 2], rotation: [0, Math.PI / 2, 0] });
    }
  }
  // Blast door: deep recess, flush steel leaf, a red lamp above.
  b.box(9, 9, 1.6, 0, 0, D / 2 + 0.8, ruin ? "solid" : "deep");
  if (!ruin) b.box(7.4, 7.8, 0.4, 0, 0, D / 2 + 1.4, b.pristine ? "paper" : "light");
  else b.box(7.4, 7.8, 0.4, 3.6, 0, D / 2 + 5.5, "dark", { rx: -1.35, ry: 0.4 });
  b.box(11, 1, 2.2, 0, 9, D / 2 + 1.1, "pale");
  if (!ruin) {
    b.lamp(0, 10.6, D / 2 + 1.6, 0.8, "signal");
    b.lamp(4.8, 3, D / 2 + 1.7, 0.4, "cyan");
  }
  const label = signTexture("isolation-label", 512, 128, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.font = "bold 58px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("ISOLATION  HALL  1", w / 2, h * 0.36);
    g.font = "bold 30px sans-serif";
    g.fillStyle = "#e00";
    g.fillText("NO NETWORK BEYOND THIS POINT", w / 2, h * 0.78);
  });
  const lm = signMesh(label, 8, 2);
  if (lm) {
    lm.position.set(0, 12.6, D / 2 + 0.02);
    b.group.add(lm);
  }
  // The single cable trunk: out of the east wall, over saddles, into a vault.
  const cy = 3.2;
  const path: Vec3[] = [
    [L / 2, cy, -6],
    [L / 2 + 10, cy, -6],
    [L / 2 + 18, cy, 2],
    [L / 2 + 58, cy, 2],
    [L / 2 + 72, cy, 10],
    [L / 2 + 76, 0.6, 14],
  ];
  const cut = ruin ? 3 : path.length - 1;
  for (let i = 0; i < cut; i++) b.rod(path[i]!, path[i + 1]!, 0.65, "dark", 10);
  if (ruin) {
    const end = path[3]!;
    b.rod(end, [end[0] + 6, 0.5, end[2] + 4], 0.65, "dark", 10);
    for (let i = 0; i < 7; i++) b.line([end[0] + 6, 0.5, end[2] + 4], [end[0] + 6 + r.range(-2, 2), r.range(0, 1.2), end[2] + 4 + r.range(0.5, 3)]);
  }
  // Wall collar where it leaves the hall.
  b.box(1.6, 3.6, 3.6, L / 2 + 0.8, cy - 1.8, -6, "light");
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!,
      c = path[i + 1]!;
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const n = Math.floor(len / 6);
    for (let s = 1; s <= n; s++) {
      const t = s / (n + 1);
      const x = a[0] + (c[0] - a[0]) * t,
        z = a[2] + (c[2] - a[2]) * t;
      if (ruin && i >= 3) break;
      b.box(1.8, cy - 0.5, 0.6, x, 0, z, "pale", { ry: Math.atan2(c[0] - a[0], c[2] - a[2]) + Math.PI / 2 });
    }
  }
  // Disconnect cabinet halfway along: the one place the line could be cut.
  const dx = L / 2 + 38,
    dz = 5.2;
  b.box(2.6, 3.4, 1.6, dx, 0, dz, b.pristine ? "paper" : "pale");
  b.box(2.8, 0.25, 1.8, dx, 3.4, dz, "light");
  b.box(0.18, 1.4, 0.18, dx + 0.7, 1.9, dz + 0.95, "paper", { accent: "signal", rz: 0.5 });
  b.box(0.8, 0.4, 0.3, dx + 0.7, 1.7, dz + 0.9, "dark");
  // Cable vault.
  b.box(6, 1.4, 6, path[5]![0], 0, path[5]![2] + 2, "light");
  b.box(2.4, 0.2, 2.4, path[5]![0], 1.4, path[5]![2] + 2, "mid");
  // Double fence and a sterile gravel strip; camera masts at the corners.
  const zone = (w: number, d: number) => rectPath(6, 2, w, d);
  b.box(L + 70, 0.06, D + 58, 6, 0, 2, "pale");
  fence(b, zone(L + 34, D + 34), { height: 3.4, postGap: 3.5, outrigger: true, razor: !b.pristine, solid: b.pristine, damage: ruin ? 0.4 : 0 });
  fence(b, zone(L + 64, D + 56), { height: 3.6, postGap: 3.5, outrigger: true, solid: b.pristine, damage: ruin ? 0.4 : 0 });
  for (const [x, z] of [
    [6 - (L + 34) / 2 + 2, 2 - (D + 34) / 2 + 2],
    [6 + (L + 34) / 2 - 2, 2 - (D + 34) / 2 + 2],
    [6 + (L + 34) / 2 - 2, 2 + (D + 34) / 2 - 2],
    [6 - (L + 34) / 2 + 2, 2 + (D + 34) / 2 - 2],
  ] as Array<[number, number]>) {
    b.cyl(0.18, 10, x, 0, z, "mid", 6);
    b.box(0.45, 0.45, 0.9, x, 10, z + 0.3, "dark");
    b.box(1.8, 0.4, 0.5, x, 11, z, "mid");
  }
  // Lightning mast (the only thing that rises above it).
  latticeMast(b, -L / 2 - 8, -D / 2 - 6, 34, 2, 0.6, { panels: 10, leg: 0.14 });
  b.line([-L / 2 - 8, 34, -D / 2 - 6], [-L / 2 - 8, 38, -D / 2 - 6]);
  if (b.building) {
    scaffold(b, 0, 0, L, D, H, 2, 2.6);
    towerCrane(b, -L / 2 - 14, 8, H + 30, 46, 0.4);
  }
  if (ruin) {
    rubble(b, 2, D / 2 + 6, 6, 2.5, 12);
    const smoke = createPlume({ origin: [0, H, 0], rng: seed.fork("isosmoke"), count: 14, life: 20, height: 60, r0: 3, r1: 11, drift: [30, -15], tone: 0.62, toneTop: 0.4, thinFrom: 0.42, hatch: 0.4 });
    b.effect(smoke);
  }
  const g = b.finish({ width: L + 90, depth: D + 60, height: 38, offsetZ: 2 }, "isolation-hall");
  g.userData.cablePath = path;
  return g;
}
