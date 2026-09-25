/**
 * Heavy industry: the sawtooth factory, container port gantry cranes, and the
 * desalination works (tanks, pipe racks, pressure-vessel racks).
 */
import * as THREE from "three";
import { Kit, extrude, lathe } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";
import { Build, actorMaterial, fence, latticeMast, lineMaterial, rectPath, rubble, type Vec3 } from "./common.ts";
import { createPlume } from "./effects.ts";

// =================================================================== factory

export function buildFactory(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const bays = b.pristine ? 8 : seed.int(6, 9);
  const bay = 10;
  const W = bays * bay;
  const D = b.pristine ? 56 : seed.range(46, 60);
  const H = 8.5;
  const rise = 4.2;
  // Sawtooth shed as one extruded section: ridges run front-to-back, so the
  // front gable shows the jagged north-light skyline.
  const outline: Array<[number, number]> = [
    [-W / 2, 0],
    [W / 2, 0],
    [W / 2, H],
  ];
  const broken = new Set<number>();
  for (let k = bays - 1; k >= 0; k--) {
    const xl = -W / 2 + k * bay;
    const xr = xl + bay;
    outline.push([xr, H + rise], [xl + 0.001, H]);
    if (b.ruin && r.chance(0.35)) broken.add(k);
  }
  outline[outline.length - 1] = [-W / 2, H];
  const shell = extrude(outline, D);
  b.add(shell, { tone: b.wear("pale") });
  // Roof coverings (slate-dark slopes) and north-light glazing on the steep faces.
  const slope = Math.atan2(rise, bay);
  const slopeL = Math.hypot(bay, rise);
  for (let k = 0; k < bays; k++) {
    const xl = -W / 2 + k * bay;
    const xr = xl + bay;
    if (broken.has(k)) {
      // Burnt-through bay: bare trusses drawn as lines.
      for (let z = -D / 2 + 3; z < D / 2; z += 6) {
        b.line([xl, H + 0.1, z], [xr, H + rise, z]);
        b.line([xr, H + rise, z], [xr, H, z]);
        b.line([xl + bay * 0.5, H + rise * 0.5, z], [xr, H, z], true);
      }
      b.box(bay - 0.4, 0.3, D * 0.6, xl + bay / 2, 0.2, r.range(-D / 5, D / 5), "dark", { rz: r.range(-0.2, 0.2) });
      continue;
    }
    b.add(new THREE.BoxGeometry(slopeL + 0.3, 0.22, D + 0.5), { tone: b.pristine ? "paper" : "mid", position: [xl + bay / 2, H + rise / 2 + 0.12, 0], rotation: [0, 0, slope] });
    b.box(0.14, rise - 0.7, D - 1.5, xr + 0.02, H + 0.35, 0, b.pristine ? "light" : b.glass);
    if (!b.pristine) for (let z = -D / 2 + 2; z < D / 2 - 1; z += 2.4) b.line([xr + 0.12, H + 0.35, z], [xr + 0.12, H + rise - 0.35, z], true);
  }
  // Front gable wall: brick piers, tall windows, loading doors.
  const zf = D / 2;
  for (let k = 0; k <= bays; k++) b.box(0.9, H + (k < bays ? 0.4 : 0.4), 0.5, -W / 2 + k * bay, 0, zf + 0.25, "light");
  for (let k = 0; k < bays; k++) {
    const x = -W / 2 + k * bay + bay / 2;
    if (k % 3 === 1) {
      b.box(5, 5.6, 0.2, x, 0, zf + 0.1, b.ruin ? "solid" : "mid");
      if (!b.ruin) for (let s = 1; s < 7; s++) b.line([x - 2.5, s * 0.8, zf + 0.22], [x + 2.5, s * 0.8, zf + 0.22], true);
    } else {
      b.box(1.5, 4.2, 0.12, x - 1.6, 2, zf + 0.06, b.glass);
      b.box(1.5, 4.2, 0.12, x + 1.6, 2, zf + 0.06, b.glass);
    }
    // String course.
    b.box(bay, 0.3, 0.2, x, H - 0.8, zf + 0.15, "light");
  }
  // Side walls: pilasters and a band of windows.
  for (const s of [-1, 1]) {
    const x = (s * W) / 2;
    for (let z = -D / 2; z <= D / 2 + 0.01; z += 6) b.box(0.5, H, 0.8, x + s * 0.25, 0, z, "light");
    for (let z = -D / 2 + 3; z < D / 2; z += 6) b.box(0.12, 2.4, 3.6, x + s * 0.06, 4, z, b.glass);
  }
  // Office range at the front corner with a hipped roof.
  const ox = -W / 2 + 14,
    oz = zf + 9;
  b.box(26, 10, 12, ox, 0, oz, b.wear("paper"));
  b.add(new THREE.ConeGeometry(1, 1, 4, 1), { tone: "mid", position: [ox, 12, oz], scale: [19.5, 4, 9], rotation: [0, Math.PI / 4, 0] });
  for (let f = 0; f < 3; f++) for (let i = 0; i < 7; i++) b.box(1.3, 1.8, 0.1, ox - 11 + i * 3.6, 1.3 + f * 3.1, oz + 6.02, b.glass);
  b.box(4, 3.2, 0.3, ox, 0, oz + 6.1, "mid");
  // Brick chimney, tapering, with a banded cap.
  const cx = W / 2 - 8,
    cz = -D / 2 - 8;
  const ch = b.ruin ? 26 : 42;
  b.box(6, 3, 6, cx, 0, cz, "light");
  b.add(lathe([[2.4, 0], [1.5, ch]], 8), { tone: b.wear("light"), position: [cx, 3, cz], rotation: [0, Math.PI / 8, 0] });
  if (!b.ruin) {
    b.add(lathe([[1.9, 0], [1.9, 1.4], [1.5, 1.4]], 8), { tone: "dark", position: [cx, 3 + ch - 1.4, cz], rotation: [0, Math.PI / 8, 0] });
    if (!b.pristine) {
      const smoke = createPlume({ origin: [cx, 3 + ch, cz], rng: seed.fork("fsmoke"), count: 16, life: 18, height: 60, r0: 1.8, r1: 9, drift: [34, -12], tone: 0.4, toneTop: 0.2, thinFrom: 0.38, hatch: 0.35 });
      b.effect(smoke);
    }
  }
  // Water tank on a braced steel tower.
  const tx = -W / 2 - 10,
    tz = -D / 2 + 10;
  latticeMast(b, tx, tz, 16, 5, 4, { panels: 4, leg: 0.3, solidBracing: true });
  b.box(6, 4.5, 6, tx, 16, tz, b.wear("pale"));
  b.box(6.4, 0.4, 6.4, tx, 20.5, tz, "mid");
  // Outdoor travelling crane over the stockyard.
  const yx = W / 2 + 18;
  for (const z of [-D / 2 + 6, D / 2 - 6]) {
    b.box(0.8, 11, 0.8, yx - 11, 0, z, "mid");
    b.box(0.8, 11, 0.8, yx + 11, 0, z, "mid");
    b.box(23, 1.2, 1, yx, 11, z, "mid");
  }
  b.box(1.2, 1.4, D - 10, yx - 3, 12.2, 0, "mid");
  b.box(1.2, 1.4, D - 10, yx + 3, 12.2, 0, "mid");
  b.box(8, 1.6, 3, yx, 12.2, 4, "light");
  b.line([yx, 12.2, 4], [yx, 3, 4]);
  for (let i = 0; i < 6; i++) b.box(3.4, 1.4, 2.2, yx + r.range(-8, 8), 0, r.range(-D / 3, D / 3), r.chance(0.5) ? "light" : "mid", { ry: r.range(-0.3, 0.3) });
  if (b.ruin) {
    rubble(b, -W / 4, zf + 5, 6, 2.5, 12);
    const smoke = createPlume({ origin: [-W / 4, H, 0], rng: seed.fork("fire"), count: 16, life: 20, height: 70, r0: 4, r1: 13, drift: [30, -15], tone: 0.62, toneTop: 0.4, thinFrom: 0.4, hatch: 0.4 });
    b.effect(smoke);
  }
  fence(b, rectPath(6, 2, W + 70, D + 44), { height: 2.4, postGap: 3, damage: b.ruin ? 0.35 : 0, solid: b.pristine, gaps: [[20, 34]] });
  return b.finish({ width: W + 74, depth: D + 48, height: 45 }, "factory");
}

// =================================================================== port cranes

const STS = { legH: 44, gauge: 30, span: 18, outreach: 62, backreach: 26, apex: 74 };

/**
 * Ship-to-shore gantry crane. Local frame: boom along -Z (waterside),
 * backreach along +Z. The outreach can be raised (boom up).
 */
function stsCrane(b: Build, x: number, z: number, raised: boolean, phase: number, still: boolean): void {
  const { legH, gauge, span, outreach, backreach, apex } = STS;
  const zs = z - gauge / 2,
    zl = z + gauge / 2;
  const tone = "paper";
  // Legs, sill beams and bogies.
  for (const lx of [x - span / 2, x + span / 2]) {
    b.box(1.8, legH, 1.8, lx, 0, zs, tone);
    b.box(1.8, legH, 1.8, lx, 0, zl, tone);
    b.beam([lx, 2.5, zs], [lx, 2.5, zl], 1.6, "light");
    for (const zz of [zs, zl]) {
      b.box(2.2, 1.6, 7, lx, 0, zz, "mid");
      for (let w = -2; w <= 2; w++) b.cyl(0.45, 0.3, lx + 1.1, 0.45, zz + w * 1.3, "dark", 8, 0.45, { rz: Math.PI / 2 });
    }
    // K-bracing between sea and land legs.
    b.beam([lx, 6, zs], [lx, legH - 8, z], 0.9, tone);
    b.beam([lx, 6, zl], [lx, legH - 8, z], 0.9, tone);
    b.beam([lx, legH - 8, z], [lx, legH, zs], 0.7, tone);
    b.beam([lx, legH - 8, z], [lx, legH, zl], 0.7, tone);
  }
  // Portal beams.
  for (const zz of [zs, zl]) b.box(span + 2, 2.4, 2, x, legH - 2.4, zz, tone);
  for (const lx of [x - span / 2, x + span / 2]) b.beam([lx, legH - 1.2, zs], [lx, legH - 1.2, zl], 2.2, tone);
  // A-frame to the apex, with stairs drawn up the land legs.
  const az = zs + 4;
  for (const lx of [x - span / 2, x + span / 2]) {
    b.beam([lx, legH, zs], [x + (lx - x) * 0.35, apex, az], 1.1, tone);
    b.beam([lx, legH, zl], [x + (lx - x) * 0.35, apex, az], 1.1, tone);
  }
  b.beam([x - span * 0.18, apex, az], [x + span * 0.18, apex, az], 1.2, tone);
  b.lamp(x, apex + 1, az, 1, "signal", true);
  const stair: Vec3[] = [];
  for (let i = 0; i <= 14; i++) stair.push([x + span / 2 + 1.4, (i / 14) * legH, zl + (i % 2 ? 2 : -2)]);
  b.polyline(stair, true);
  // Backreach girder and machinery house.
  const by = legH + 1;
  for (const gx of [x - 3.5, x + 3.5]) b.beam([gx, by, zs + 2], [gx, by, zl + backreach], 1.3, tone, 2.4);
  b.box(13, 7, 15, x, by + 1.2, zl + backreach - 9, "pale");
  b.box(13.4, 0.5, 15.4, x, by + 8.2, zl + backreach - 9, "light");
  // Backstays from apex to the backreach end.
  for (const gx of [x - 3.5, x + 3.5]) b.line([x, apex, az], [gx, by + 1.2, zl + backreach]);
  // Outreach boom: its own sub-assembly (raised on some cranes).
  const k = new Kit();
  for (const gx of [-3.5, 3.5]) k.add(new THREE.BoxGeometry(1.3, 2.4, outreach), { tone: "paper", position: [gx, 0, -outreach / 2] });
  for (let i = 1; i < 8; i++) k.add(new THREE.BoxGeometry(8.3, 0.4, 0.4), { tone: "light", position: [0, -1, -(i * outreach) / 8] });
  k.add(new THREE.BoxGeometry(8.4, 1.2, 1.2), { tone: "light", position: [0, 0, -outreach] });
  // The boom never moves, so it merges into the body at its hinge.
  const hinge: Vec3 = [x, by, zs + 2];
  const lift = raised ? 1.32 : 0;
  b.k.addGeometry(k.build(), new THREE.Matrix4().makeRotationX(lift).setPosition(...hinge));
  const tip = raised ? [x, by + Math.sin(lift) * outreach, zs + 2 - Math.cos(lift) * outreach] : [x, by, zs + 2 - outreach];
  b.lamp(tip[0]!, tip[1]! + 1.6, tip[2]!, 0.9, "signal", true);
  // Forestays from the apex down to the boom.
  for (const t of [0.45, 0.8]) {
    const d = outreach * t;
    const p: Vec3 = [x, by + Math.sin(lift) * d + 0.8, zs + 2 - Math.cos(lift) * d];
    for (const gx of [x - 2, x + 2]) b.line([gx, apex, az], [gx, p[1], p[2]]);
  }
  // Trolley + cab + spreader: travel along the boom (animated).
  if (!raised) {
    const tk = new Kit();
    tk.add(new THREE.BoxGeometry(8.6, 2.4, 6), { tone: "light", position: [0, -2.2, 0] });
    tk.add(new THREE.BoxGeometry(3.2, 3, 3.4), { tone: "pale", position: [2.2, -5.4, 1] });
    tk.add(new THREE.BoxGeometry(0.1, 1.6, 3), { tone: "deep", position: [3.85, -5.2, 1] });
    const trolley = new THREE.Mesh(tk.build(), actorMaterial(0.12));
    trolley.name = "sts-trolley";
    const sk = new Kit();
    sk.add(new THREE.BoxGeometry(2.6, 0.9, 12.4), { tone: "mid" });
    sk.add(new THREE.BoxGeometry(2.44, 2.6, 12.2), { tone: "light", position: [0, -1.75, 0] });
    const spreader = new THREE.Mesh(sk.build(), actorMaterial(0.12));
    spreader.name = "sts-spreader";
    spreader.rotation.y = Math.PI / 2;
    const ropes = new THREE.BufferGeometry();
    ropes.setAttribute("position", new THREE.Float32BufferAttribute(new Array(24).fill(0), 3));
    const ropeLines = new THREE.LineSegments(ropes, lineMaterial(1));
    ropeLines.frustumCulled = false;
    const pos = ropes.getAttribute("position") as THREE.BufferAttribute;
    const place = (t: number) => {
      // A slow duty cycle: travel out, lower, raise, travel back.
      const cyc = still ? 0.3 : (Math.sin(t * 0.09 + phase) + 1) / 2;
      const tz = zl + backreach * 0.3 - cyc * (outreach + backreach * 0.3 + gauge - 8);
      const drop = still ? 16 : 10 + 22 * Math.max(0, Math.sin(t * 0.18 + phase * 1.7));
      trolley.position.set(x, by - 1, tz);
      spreader.position.set(x, by - 3 - drop, tz);
      const top = by - 3.4,
        bot = by - 3 - drop + 0.45;
      const cs = [
        [-1, -4],
        [1, -4],
        [-1, 4],
        [1, 4],
      ];
      cs.forEach(([dx, dz], i) => {
        pos.setXYZ(i * 2, x + dx! * 1.2, top, tz + dz! * 0.6);
        pos.setXYZ(i * 2 + 1, x + dx! * 1.2, bot, tz + dz! * 1.4);
      });
      pos.needsUpdate = true;
    };
    place(0);
    if (still) {
      // A parked crane: fold the trolley, spreader and ropes into the body.
      for (const mesh of [trolley, spreader]) {
        mesh.updateMatrix();
        b.k.addGeometry(mesh.geometry, mesh.matrix);
      }
      for (let i = 0; i < pos.count; i += 2) b.line([pos.getX(i), pos.getY(i), pos.getZ(i)], [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)]);
    } else {
      b.group.add(trolley, spreader, ropeLines);
      b.tick((_dt, t) => place(t));
    }
  }
}

function containerBlock(b: Build, x0: number, z0: number, rows: number, bays: number, tiers: number, opts: { ruin?: boolean; uniform?: boolean }): void {
  const r = b.rng;
  const L = 12.2,
    Wc = 2.44,
    Hc = 2.6;
  const tones = ["paper", "pale", "light", "mid", "dark", "pale", "light"] as const;
  for (let row = 0; row < rows; row++) {
    for (let bay = 0; bay < bays; bay++) {
      const x = x0 + bay * (L + 0.6);
      const z = z0 + row * (Wc + 0.35);
      const h = opts.uniform ? tiers : Math.max(0, tiers - (r.chance(0.3) ? r.int(1, tiers) : 0));
      for (let t = 0; t < h; t++) {
        let tone: (typeof tones)[number] = opts.uniform ? "paper" : r.pick(tones);
        const toppled = opts.ruin && t === h - 1 && r.chance(0.25);
        if (opts.ruin && r.chance(0.2)) tone = "dark";
        b.box(L, Hc - 0.04, Wc, x, t * Hc, z, tone, toppled ? { rz: r.range(-0.5, 0.5), rx: r.range(-0.3, 0.3) } : {});
        if (!opts.uniform && t === h - 1 && row === rows - 1) b.line([x - L / 2 + 0.2, t * Hc + 0.3, z + Wc / 2 + 0.01], [x - L / 2 + 0.2, t * Hc + Hc - 0.3, z + Wc / 2 + 0.01], true);
      }
    }
  }
}

export function buildPortCranes(b: Build, seed: Rng): THREE.Group {
  const n = b.pristine ? 4 : seed.int(2, 3);
  const spacing = 34;
  // Quay apron, edge and mooring bollards.
  const quayL = n * spacing + 90;
  const qz = -STS.gauge / 2 - 6;
  b.box(quayL, 0.5, 70, 0, 0, 4, "pale");
  b.box(quayL, 0.9, 1.2, 0, 0, qz - 0.6, "light");
  for (let i = 0; i < quayL / 14; i++) b.cyl(0.5, 1.1, -quayL / 2 + 7 + i * 14, 0.5, qz + 0.8, "dark", 8);
  for (const zz of [-STS.gauge / 2, STS.gauge / 2]) b.line([-quayL / 2, 0.52, zz], [quayL / 2, 0.52, zz]);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * spacing;
    const raised = b.pristine ? false : b.ruin ? false : i === n - 1 && seed.chance(0.6);
    if (b.ruin && i === 0) {
      // A collapsed crane: legs buckled, boom in the water.
      b.beam([x - 9, 0, -15], [x - 6, 18, -8], 1.8, "dark");
      b.beam([x + 9, 0, -15], [x + 12, 14, -6], 1.8, "dark");
      b.beam([x - 9, 0, 15], [x - 4, 30, 5], 1.8, "light");
      b.beam([x + 9, 0, 15], [x + 6, 32, 6], 1.8, "light");
      b.beam([x - 4, 30, 5], [x + 3, 3, -60], 2.4, "paper");
      b.beam([x + 6, 32, 6], [x + 10, 2, -58], 2.4, "paper");
      b.box(13, 7, 15, x + 3, 0, 26, "dark", { rz: 0.4 });
      continue;
    }
    stsCrane(b, x, 0, raised, seed.next() * 20, b.ruin || b.pristine);
  }
  // Container stacks behind the cranes, with a rubber-tyred gantry over one block.
  const cz = STS.gauge / 2 + 12;
  containerBlock(b, -quayL / 2 + 16, cz, 6, 5, 4, { ruin: b.ruin, uniform: b.pristine });
  containerBlock(b, -quayL / 2 + 16 + 5 * 12.8 + 12, cz, 6, 5, 4, { ruin: b.ruin, uniform: b.pristine });
  containerBlock(b, -quayL / 2 + 16, cz + 22, 6, 7, 3, { ruin: b.ruin, uniform: b.pristine });
  const rx = -quayL / 2 + 16 + 2 * 12.8;
  const rz0 = cz - 2.5,
    rz1 = cz + 6 * 2.8 + 1;
  for (const xx of [rx - 5, rx + 5]) {
    b.box(1, 19, 1, xx, 0, rz0, "paper");
    b.box(1, 19, 1, xx, 0, rz1, "paper");
    b.box(3, 1.4, 1.4, xx, 0, rz0, "dark");
    b.box(3, 1.4, 1.4, xx, 0, rz1, "dark");
    b.beam([xx, 19, rz0], [xx, 19, rz1], 1.6, "paper", 1.8);
  }
  b.box(11, 2.6, 3, rx, 19.8, (rz0 + rz1) / 2, "light");
  b.lamp(rx, 22.6, (rz0 + rz1) / 2, 0.6, "amber", true);
  // Lighting towers over the yard.
  for (let i = 0; i < 3; i++) {
    const lx = -quayL / 2 + 30 + i * (quayL - 60) / 2;
    b.cyl(0.5, 34, lx, 0, cz + 40, "light", 6, 0.3);
    b.box(6, 1.6, 1.2, lx, 34, cz + 40, "mid");
    for (let l = 0; l < 5; l++) b.flood(lx - 2.4 + l * 1.2, 34.6, cz + 39.35, 0.9, 0.8, Math.PI);
  }
  if (b.ruin) {
    const smoke = createPlume({ origin: [10, 8, cz + 10], rng: seed.fork("portfire"), count: 18, life: 22, height: 90, r0: 4, r1: 15, drift: [40, -20], tone: 0.62, toneTop: 0.4, thinFrom: 0.4, hatch: 0.4 });
    b.effect(smoke);
  }
  b.blinkPeriod = 1.9;
  return b.finish({ width: quayL, depth: 150, height: 80, offsetZ: 5 }, "port-cranes");
}

// =================================================================== desalination

function pipeRack(b: Build, a: [number, number], c: [number, number], y: number, pipes: number[], opts: { loopAt?: number } = {}): void {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const ux = (c[0] - a[0]) / L,
    uz = (c[1] - a[1]) / L;
  const nx = -uz,
    nz = ux;
  const w = pipes.reduce((s, d) => s + d + 0.3, 0) + 0.6;
  const bents = Math.max(2, Math.round(L / 6));
  for (let i = 0; i <= bents; i++) {
    const px = a[0] + ux * (L * i) / bents,
      pz = a[1] + uz * (L * i) / bents;
    for (const s of [-0.5, 0.5]) b.beam([px + nx * w * s, 0, pz + nz * w * s], [px + nx * w * s, y, pz + nz * w * s], 0.3, "mid");
    b.beam([px - nx * w * 0.5, y, pz - nz * w * 0.5], [px + nx * w * 0.5, y, pz + nz * w * 0.5], 0.3, "mid");
    b.beam([px - nx * w * 0.5, y - 2.2, pz - nz * w * 0.5], [px + nx * w * 0.5, y - 2.2, pz + nz * w * 0.5], 0.25, "mid");
  }
  let off = -w / 2 + 0.3;
  pipes.forEach((d, i) => {
    const o = off + d / 2;
    off += d + 0.3;
    const yy = (i % 2 ? y - 2.2 : y) + d / 2 + 0.15;
    const p0: Vec3 = [a[0] + nx * o, yy, a[1] + nz * o];
    const p1: Vec3 = [c[0] + nx * o, yy, c[1] + nz * o];
    if (opts.loopAt !== undefined && i === 0) {
      // Expansion loop: the big line rises over the rack and back.
      const m0 = opts.loopAt - 4,
        m1 = opts.loopAt + 4;
      const q = (t: number, up: number): Vec3 => [a[0] + ux * t + nx * o, yy + up, a[1] + uz * t + nz * o];
      b.rod(p0, q(m0, 0), d / 2, "paper", 8);
      b.rod(q(m0, 0), q(m0, 6), d / 2, "paper", 8);
      b.rod(q(m0, 6), q(m1, 6), d / 2, "paper", 8);
      b.rod(q(m1, 6), q(m1, 0), d / 2, "paper", 8);
      b.rod(q(m1, 0), p1, d / 2, "paper", 8);
      return;
    }
    b.rod(p0, p1, d / 2, i % 3 === 1 ? "light" : "paper", 8);
  });
}

function storageTank(b: Build, x: number, z: number, R: number, H: number): void {
  b.box(R * 2 + 2, 0.5, R * 2 + 2, x, 0, z, "light");
  b.cyl(R, H, x, 0.5, z, b.wear("paper"), 28);
  b.add(new THREE.ConeGeometry(R + 0.3, R * 0.18, 28), { tone: "pale", position: [x, 0.5 + H + R * 0.09, z] });
  // Spiral stair wound round the shell, and the roof handrail.
  const turns = 0.75;
  const pts: Vec3[] = [];
  const rail: Vec3[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const a = t * turns * Math.PI * 2 + 0.6;
    pts.push([x + Math.cos(a) * (R + 0.8), 0.5 + t * H, z + Math.sin(a) * (R + 0.8)]);
    rail.push([x + Math.cos(a) * (R + 1.5), 1.6 + t * H, z + Math.sin(a) * (R + 1.5)]);
  }
  b.polyline(pts);
  b.polyline(rail, true);
  const ring: Vec3[] = [];
  for (let i = 0; i <= 28; i++) ring.push([x + Math.cos((i / 28) * Math.PI * 2) * (R - 0.3), H + 1.6, z + Math.sin((i / 28) * Math.PI * 2) * (R - 0.3)]);
  b.polyline(ring, true);
  // Weld seams (strakes) as faint horizontal bands.
  for (let y = 2.9; y < H; y += 2.4) {
    const seam: Vec3[] = [];
    for (let i = 0; i <= 28; i++) seam.push([x + Math.cos((i / 28) * Math.PI * 2) * (R + 0.04), y, z + Math.sin((i / 28) * Math.PI * 2) * (R + 0.04)]);
    b.polyline(seam, true);
  }
}

function vesselRack(b: Build, x: number, z: number, cols: number, tiers: number, ruin: boolean): void {
  const len = 8;
  const pitch = 0.62;
  const w = cols * pitch + 0.6;
  const h = tiers * pitch + 0.8;
  // Steel frame.
  for (const zz of [z - len / 2, z + len / 2, z]) {
    b.box(0.2, h, 0.2, x - w / 2, 0, zz, "mid");
    b.box(0.2, h, 0.2, x + w / 2, 0, zz, "mid");
    b.box(w, 0.2, 0.3, x, h, zz, "mid");
  }
  for (let c = 0; c < cols; c++) {
    for (let t = 0; t < tiers; t++) {
      if (ruin && b.rng.chance(0.25)) continue;
      const px = x - w / 2 + 0.6 + c * pitch,
        py = 0.7 + t * pitch;
      b.add(new THREE.CylinderGeometry(0.25, 0.25, len + 0.4, 7), { tone: "paper", position: [px, py, z], rotation: [Math.PI / 2, 0, 0] });
    }
  }
  // Header manifolds at the ends.
  b.rod([x - w / 2, 0.4, z + len / 2 + 0.5], [x + w / 2, 0.4, z + len / 2 + 0.5], 0.3, "light", 8);
  b.rod([x - w / 2, h - 0.2, z + len / 2 + 0.5], [x + w / 2, h - 0.2, z + len / 2 + 0.5], 0.3, "light", 8);
}

export function buildDesalination(b: Build, seed: Rng): THREE.Group {
  // Process hall (reverse-osmosis trains) with roof vents.
  const hx = -20,
    hz = -10;
  const HL = 84,
    HW = 30,
    HH = 12;
  b.box(HL, HH, HW, hx, 0, hz, b.wear("paper"));
  b.box(HL + 1, 0.5, HW + 1, hx, HH, hz, "pale");
  for (let i = 0; i <= 14; i++) b.box(0.4, HH, 0.3, hx - HL / 2 + (i * HL) / 14, 0, hz + HW / 2 + 0.15, "paper");
  for (let i = 0; i < 14; i++) b.box(HL / 14 - 1.2, 1.4, 0.1, hx - HL / 2 + ((i + 0.5) * HL) / 14, HH - 3, hz + HW / 2 + 0.06, b.glass);
  for (let i = 0; i < 7; i++) b.cyl(1.1, 1.6, hx - HL / 2 + 8 + i * 11.4, HH + 0.5, hz, "light", 10);
  // Pressure-vessel racks outside the hall end: the grid of tube ends.
  for (let i = 0; i < 2; i++) vesselRack(b, hx + HL / 2 + 10 + i * 9, hz + 4, 9, 8, b.ruin);
  // Storage tanks: potable water and brine.
  const tanks: Array<[number, number, number, number]> = [
    [48, 38, 15, 13],
    [84, 38, 15, 13],
    [48, 74, 11, 11],
  ];
  if (!b.pristine && seed.chance(0.5)) tanks.push([84, 74, 11, 11]);
  if (b.pristine) tanks.push([84, 74, 11, 11]);
  for (const [x, z, R, H] of tanks) {
    if (b.ruin && x === 84 && z === 38) {
      // A split, collapsed tank.
      b.add(lathe([[R, 0], [R, H * 0.4], [R * 0.9, H * 0.55]], 28), { tone: "dark", position: [x, 0, z] });
      rubble(b, x + R * 0.6, z + R * 0.5, 5, 2, 8, "light");
      continue;
    }
    storageTank(b, x, z, R, H);
  }
  // Pretreatment basins: long rectangular tanks with dark water.
  for (let i = 0; i < 4; i++) {
    const bx = -50 + i * 16,
      bz = 34;
    b.box(14, 2.2, 36, bx, 0, bz, "pale");
    b.box(12.6, 0.05, 34.6, bx, 2.15, bz, b.ruin ? "solid" : "dark");
    b.line([bx - 7, 3.2, bz - 18], [bx - 7, 3.2, bz + 18], true);
  }
  // Pipe racks linking intake, hall, racks and tanks.
  pipeRack(b, [-66, 14], [72, 14], 6, [1.2, 0.8, 0.8, 0.6, 1.0, 0.5], { loopAt: 20 });
  pipeRack(b, [66, 14], [66, 90], 5.5, [1.0, 0.7, 0.5]);
  pipeRack(b, [hx + HL / 2 + 4, -26], [hx + HL / 2 + 4, 12], 5, [0.8, 0.6, 0.6, 0.4]);
  // Intake pumping station and a flare-free vent stack.
  b.box(18, 8, 12, -70, 0, -30, b.wear("pale"));
  b.add(new THREE.ConeGeometry(1, 1, 4, 1), { tone: "mid", position: [-70, 9.4, -30], scale: [14, 2.8, 9.5], rotation: [0, Math.PI / 4, 0] });
  b.cyl(1, 26, -58, 0, -34, "light", 10, 0.8);
  b.lamp(-58, 26.5, -34, 0.6, "signal", true);
  // Brine outfall channel toward the (off-asset) sea.
  b.box(4, 0.3, 60, -86, 0, 10, "light");
  b.box(3, 0.05, 59, -86, 0.3, 10, b.ruin ? "solid" : "dark");
  fence(b, rectPath(10, 24, 210, 150), { height: 2.4, postGap: 3.5, damage: b.ruin ? 0.35 : 0, solid: b.pristine, gaps: [[40, 54]] });
  if (b.ruin) {
    const smoke = createPlume({ origin: [hx, HH, hz], rng: seed.fork("desal"), count: 16, life: 20, height: 70, r0: 4, r1: 13, drift: [30, -15], tone: 0.62, toneTop: 0.4, thinFrom: 0.4, hatch: 0.4 });
    b.effect(smoke);
  }
  return b.finish({ width: 214, depth: 154, height: 27, offsetZ: 24 }, "desalination");
}
