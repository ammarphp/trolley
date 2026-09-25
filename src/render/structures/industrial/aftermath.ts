/**
 * Catastrophe and aftermath: a collapsed town block, an impact crater, a town
 * burning at night, and the pristine monolithic architecture of the end.
 */
import * as THREE from "three";
import { extrude, jitter } from "../../core/geometry.ts";
import { createNoise } from "../../core/noise.ts";
import type { Rng } from "../../core/rng.ts";
import { Build, catenary, rubble, scaffold, towerCrane, type Vec3 } from "./common.ts";
import { createFireLights, createFlames, createPlume, createSparks, type FireSource } from "./effects.ts";

// =================================================================== shared house parts

type Pt = [number, number];

/** A stair-stepped broken top edge from x = w back to x = 0 (brick breaks). */
function brokenTop(r: Rng, w: number, hMax: number, keep: number): Pt[] {
  const pts: Pt[] = [];
  let x = w;
  let y = hMax * r.range(keep, 1);
  pts.push([w, y]);
  while (x > 0.01) {
    const run = Math.min(x, r.range(0.5, 2.2));
    x -= run;
    pts.push([x + 0.001, y]);
    if (x <= 0.01) break;
    const drop = r.range(-hMax * 0.28, hMax * 0.22);
    y = Math.max(hMax * 0.18, Math.min(hMax, y + drop));
    pts.push([x, y]);
  }
  pts[pts.length - 1]![0] = 0;
  return pts;
}

function topAt(top: Pt[], x: number): number {
  // Minimum height of the jagged top over a small window around x.
  let m = Infinity;
  for (const [px, py] of top) if (Math.abs(px - x) < 1.1) m = Math.min(m, py);
  if (m === Infinity) {
    for (let i = 0; i < top.length - 1; i++) {
      const [ax, ay] = top[i]!,
        [bx, by] = top[i + 1]!;
      if ((x <= ax && x >= bx) || (x >= ax && x <= bx)) m = Math.min(ay, by);
    }
  }
  return m;
}

/**
 * A wall slab in its own XY plane (width w along X, up Y), extruded by
 * `thick` along Z, with window openings cut where the broken top allows.
 */
function wallWithOpenings(r: Rng, w: number, hMax: number, storeyH: number, thick: number, opts: { broken: boolean; keep?: number; shop?: boolean; winW?: number }): { geo: THREE.BufferGeometry; top: Pt[]; windows: Array<[number, number, number, number]> } {
  const top = opts.broken ? brokenTop(r, w, hMax, opts.keep ?? 0.35) : ([
    [w, hMax],
    [0, hMax],
  ] as Pt[]);
  const outline: Pt[] = [[0, 0], [w, 0], ...top];
  const holes: Pt[][] = [];
  const windows: Array<[number, number, number, number]> = [];
  const ww = opts.winW ?? 1.1;
  const cols = Math.max(1, Math.floor((w - 0.8) / 2.3));
  const pitch = w / cols;
  const storeys = Math.round(hMax / storeyH);
  for (let s = 0; s < storeys; s++) {
    for (let c = 0; c < cols; c++) {
      const cx = pitch * (c + 0.5);
      let x0 = cx - ww / 2,
        x1 = cx + ww / 2,
        y0 = s * storeyH + 0.9,
        y1 = y0 + 1.6;
      if (s === 0 && opts.shop) {
        x0 = cx - Math.min(pitch * 0.4, 1.3);
        x1 = cx + Math.min(pitch * 0.4, 1.3);
        y0 = 0.25;
        y1 = 2.6;
      }
      if (y1 + 0.35 > Math.min(topAt(top, x0), topAt(top, x1), topAt(top, cx))) continue;
      holes.push([
        [x0, y0],
        [x0, y1],
        [x1, y1],
        [x1, y0],
      ]);
      windows.push([x0, y0, x1, y1]);
    }
  }
  const geo = extrude(outline, thick, 0, holes);
  return { geo, top, windows };
}

/** Soot tongue above an opening: a flame-shaped dark stain on the wall face. */
function soot(b: Build, x: number, y: number, z: number, w: number, h: number, ry: number): void {
  const pts: Pt[] = [
    [-w / 2, 0],
    [w / 2, 0],
    [w * 0.35, h * 0.45],
    [w * 0.15, h * 0.7],
    [w * 0.2, h],
    [-w * 0.05, h * 0.75],
    [-w * 0.25, h * 0.9],
    [-w * 0.3, h * 0.5],
  ];
  b.add(extrude(pts, 0.03), { tone: "dark", position: [x, y, z], rotation: [0, ry, 0] });
}

// =================================================================== ruins

export function buildRuins(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const pristine = b.pristine;
  const n = seed.int(5, 7);
  const storeyH = 3.1;
  const streetZ = 6;
  let x = -((n * 8.5) / 2);
  const wisps: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const w = r.range(6.5, 10);
    const storeys = r.int(2, 4);
    const hMax = storeys * storeyH + 0.6;
    const d = r.range(9, 12);
    const cx = x + w / 2;
    const severity = pristine ? 0.2 : r.next();
    const tone = pristine ? "paper" : r.chance(0.3) ? "light" : "pale";
    if (severity > 0.82) {
      // Fully collapsed: a heap with a stub of wall and a chimney standing.
      rubble(b, cx, streetZ - d / 2, w * 0.55, storeyH * 1.2, 22, tone);
      b.box(1.1, hMax * r.range(0.6, 0.9), 0.9, cx + r.range(-w / 3, w / 3), 0, streetZ - d + 0.5, "light");
      wisps.push([cx, 1.5, streetZ - d / 2]);
      x += w + 0.1;
      continue;
    }
    // Front facade (street face at +Z).
    const front = wallWithOpenings(r, w, hMax, storeyH, 0.4, { broken: true, keep: 0.25 + (1 - severity) * 0.5, shop: r.chance(0.6) });
    const lean = severity > 0.6 ? r.range(-0.05, 0.05) : 0;
    b.add(front.geo, { tone, position: [x, 0, streetZ], rotation: [lean, 0, 0] });
    // Stone string courses and a cornice on surviving parts.
    const tMin = Math.min(...front.top.map((p) => p[1]));
    for (let s = 1; s * storeyH < tMin; s++) b.box(w, 0.22, 0.2, cx, s * storeyH - 0.1, streetZ + 0.3, "light");
    for (const [x0, y0, x1, y1] of front.windows) {
      // Reveals read as dark voids; soot tongues lick above some.
      b.box(x1 - x0, 0.12, 0.35, x + (x0 + x1) / 2, y0 - 0.12, streetZ + 0.12, "light");
      if (!pristine && r.chance(0.45)) soot(b, x + (x0 + x1) / 2, y1 + 0.02, streetZ + 0.22, (x1 - x0) * 1.3, storeyH * 0.7, 0);
    }
    // Back wall, lower and more broken.
    const back = wallWithOpenings(r, w, hMax * 0.8, storeyH, 0.4, { broken: true, keep: 0.2 });
    b.add(back.geo, { tone: "light", position: [x, 0, streetZ - d] });
    // Party walls: jagged gables seen through the voids.
    for (const s of [0, 1]) {
      if (r.chance(0.35)) continue;
      const side = wallWithOpenings(r, d, hMax * r.range(0.6, 1), storeyH, 0.35, { broken: true, keep: 0.3, winW: 0.9 });
      b.add(side.geo, { tone: "pale", position: [x + s * w, 0, streetZ], rotation: [0, Math.PI / 2, 0] });
    }
    // Floors: some hang on, some have pancaked to the ground.
    for (let s = 1; s < storeys; s++) {
      const y = s * storeyH;
      if (y > tMin + 1) break;
      const f = r.next();
      if (f < 0.35) {
        b.box(w - 0.6, 0.3, d * r.range(0.3, 0.6), cx, y, streetZ - d * 0.25, "light");
        for (let j = 0; j < 4; j++) b.line([x + 0.8 + j * (w / 4), y + 0.1, streetZ - d * 0.5], [x + 0.8 + j * (w / 4) + r.range(-0.3, 0.3), y - r.range(0.2, 1.2), streetZ - d * 0.72], true);
      } else if (f < 0.7) {
        // Tilted slab: one edge still on the back wall, the other on the heap.
        const a = Math.atan2(y - 0.8, d * 0.7);
        b.box(w - 0.8, 0.3, d * 0.85, cx, (y + 0.8) / 2 - 0.15, streetZ - d * 0.5, "light", { rx: -a });
      }
      // Joist ends sticking out of the party wall.
      for (let j = 0; j < 5; j++) b.box(0.18, 0.24, r.range(0.4, 1.4), x + 0.3, y - 0.3, streetZ - 1 - j * (d / 5), "dark");
    }
    rubble(b, cx, streetZ - d * 0.45, Math.min(w, d) * 0.5, storeyH * r.range(0.6, 1.2), 14, tone);
    // Debris spilling into the street.
    for (let j = 0; j < 6; j++) b.box(r.range(0.3, 1.2), r.range(0.2, 0.5), r.range(0.3, 1), cx + r.range(-w / 2, w / 2), 0, streetZ + r.range(0.8, 5), r.chance(0.5) ? "light" : "pale", { ry: r.next() * 3, rx: r.range(-0.3, 0.3) });
    if (r.chance(0.5)) {
      b.box(0.9, hMax + 1.2, 0.7, x + (r.chance(0.5) ? 0.5 : w - 0.5), 0, streetZ - d * 0.6, "light");
      b.box(1.1, 0.3, 0.9, x + 0.5, hMax + 1.2, streetZ - d * 0.6, "mid");
    }
    if (!pristine && r.chance(0.45)) wisps.push([cx, 1.5, streetZ - d * 0.4]);
    x += w + 0.1;
  }
  // Street furniture: a bent lamp column, a snapped pole with dragging wires.
  const lx = -5;
  b.rod([lx, 0, streetZ + 5], [lx, 3.6, streetZ + 5], 0.08, "mid", 6);
  b.rod([lx, 3.6, streetZ + 5], [lx + 1.6, 4.4, streetZ + 5.8], 0.07, "mid", 6);
  b.box(0.5, 0.3, 0.3, lx + 1.8, 4.2, streetZ + 5.9, "dark", { rz: -0.7 });
  const px = 14;
  b.rod([px, 0, streetZ + 6], [px + 0.8, 4.2, streetZ + 6.2], 0.16, "dark", 6);
  b.rod([px + 0.8, 4.2, streetZ + 6.2], [px + 6.5, 0.2, streetZ + 8.5], 0.15, "dark", 6);
  b.polyline(catenary([px + 0.8, 4.1, streetZ + 6.2], [px - 26, 5.8, streetZ + 6.4], 2.4, 14));
  b.polyline(catenary([px + 0.8, 3.8, streetZ + 6.2], [px - 26, 5.4, streetZ + 6.4], 3.5, 14), true);
  // Cobbles: a pale street slab with kerbs.
  const len = n * 8.5 + 10;
  b.box(len, 0.06, 8, 0, 0, streetZ + 4.4, "pale");
  b.box(len, 0.16, 0.3, 0, 0, streetZ + 0.6, "light");
  if (!pristine) {
    wisps.slice(0, 3).forEach((p, i) => {
      const smoke = createPlume({ origin: p, rng: seed.fork(`wisp${i}`), count: 16, life: 16, height: 26, r0: 0.6, r1: 2.8, drift: [12, -6], wander: 1.6, tone: 0.42, toneTop: 0.26, thinFrom: 0.14, thinOpacity: 0.3, hatch: 0.1, kind: "smoke" });
      b.effect(smoke);
    });
  }
  return b.finish({ width: len, depth: 26, height: 16, offsetZ: 0 }, "ruins");
}

// =================================================================== crater

export function buildCrater(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const noise = createNoise(`crater-${seed.seed}`);
  const R = seed.range(13, 19);
  const outer = R * 2.7;
  const rimH = R * 0.2;
  const rings = 26,
    segs = 72;
  const radius = (j: number) => {
    const t = j / rings;
    // Denser rings around the rim.
    return t < 0.5 ? R * Math.pow(t / 0.5, 0.8) : R + (outer - R) * Math.pow((t - 0.5) / 0.5, 1.5);
  };
  const pos: number[] = [];
  const ink: number[] = [];
  const idx: number[] = [];
  const sealed = b.pristine;
  for (let j = 0; j <= rings; j++) {
    const rr = radius(j);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const n1 = noise.n2(Math.cos(a) * 2.2, Math.sin(a) * 2.2);
      const n2 = noise.n2(Math.cos(a) * rr * 0.2, Math.sin(a) * rr * 0.2);
      const rim = rimH * (1 + 0.35 * n1);
      let y: number;
      const q = rr / R;
      if (q <= 1) y = 0.06 + rim * Math.pow(q, 2.6) + n2 * 0.25 * q;
      else y = rim * Math.exp(-Math.pow((rr - R) / (R * 0.42), 1.3)) * (1 + 0.25 * n2) + Math.max(0, n2) * 0.35 * (1 - (rr - R) / (outer - R));
      if (j === rings) y = 0.02;
      if (sealed) y = q <= 1.05 ? 0.35 : 0.02 + Math.max(0, 0.3 * (1 - (rr - R * 1.05) / (R * 0.3)));
      pos.push(Math.cos(a) * rr, Math.max(0.02, y), Math.sin(a) * rr);
      // Scorch: black at the heart, a light rim, rays thrown outward.
      const ray = Math.max(0, noise.n2(a * 5.3, 1.7)) * Math.max(0, 1 - (rr - R) / (outer - R));
      let tone: number;
      if (sealed) tone = q <= 1.05 ? 0 : 0.04;
      else if (q < 1) tone = 0.97 - 0.62 * Math.pow(q, 2.4) + 0.08 * n2;
      else tone = Math.max(0, 0.08 + ray * 0.42 - (rr - R) / (outer - R) * 0.1);
      ink.push(Math.min(0.95, Math.max(0, tone)), 0, 0);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i,
        c = a + segs + 1;
      // Counter-clockwise seen from above, so the surface faces up.
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("inkAttr", new THREE.Float32BufferAttribute(ink, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  b.add(geo);
  if (sealed) {
    // The wound paved over: a flawless disc with one hairline joint.
    b.cyl(R * 1.05, 0.45, 0, 0, 0, "paper", 48);
    b.cyl(R * 0.35, 0.47, 0, 0, 0, "paper", 36);
    return b.finish({ width: outer * 2, depth: outer * 2, height: 1 }, "crater");
  }
  // Ejecta: boulders and slabs thrown radially, dense near the rim.
  const count = Math.round(R * 4.5);
  for (let i = 0; i < count; i++) {
    const a = r.next() * Math.PI * 2;
    const d = R * (0.95 + Math.pow(r.next(), 1.8) * 1.6);
    const s = r.range(0.25, 1.3) * (1.3 - (d - R) / (outer - R));
    const y = rimH * Math.exp(-Math.pow(Math.max(0, d - R) / (R * 0.42), 1.3));
    const tone = r.chance(0.35) ? "light" : r.chance(0.3) ? "dark" : "pale";
    if (r.chance(0.45)) {
      // Broken concrete: flat slabs with square edges, some with rebar.
      b.box(s * r.range(1.4, 2.6), s * r.range(0.3, 0.5), s * r.range(1, 1.8), Math.cos(a) * d, y - 0.1, Math.sin(a) * d, tone, { ry: a + r.range(-0.5, 0.5), rx: r.range(-0.35, 0.35), rz: r.range(-0.35, 0.35) });
      if (r.chance(0.3)) b.line([Math.cos(a) * d, y + s * 0.3, Math.sin(a) * d], [Math.cos(a) * d + r.range(-1, 1), y + s + r.range(0.3, 1), Math.sin(a) * d + r.range(-1, 1)], true);
    } else {
      const g = jitter(new THREE.IcosahedronGeometry(s, 1), s * 0.35, i);
      b.add(g, { tone, position: [Math.cos(a) * d, y + s * 0.2, Math.sin(a) * d], rotation: [r.next() * 3, r.next() * 3, r.next() * 3], scale: [1, r.range(0.45, 0.8), r.range(0.7, 1.3)] });
    }
  }
  // Slabs and twisted girders in the bowl.
  for (let i = 0; i < 5; i++) {
    const a = r.next() * Math.PI * 2;
    const d = r.range(0.25, 0.8) * R;
    b.box(r.range(2, 4.5), 0.35, r.range(1.5, 3), Math.cos(a) * d, 0.3 + (d / R) * rimH * 0.4, Math.sin(a) * d, "light", { ry: r.next() * 3, rx: r.range(-0.5, 0.5), rz: r.range(-0.5, 0.5) });
  }
  for (let i = 0; i < 4; i++) {
    const a = r.next() * Math.PI * 2;
    const d = r.range(0.2, 0.7) * R;
    const p0: Vec3 = [Math.cos(a) * d, 0.2, Math.sin(a) * d];
    const p1: Vec3 = [p0[0] + r.range(-2, 2), r.range(2.5, 5), p0[2] + r.range(-2, 2)];
    const p2: Vec3 = [p1[0] + r.range(-2.5, 2.5), p1[1] + r.range(-2.5, 0.5), p1[2] + r.range(-2.5, 2.5)];
    b.beam(p0, p1, 0.3, "dark");
    b.beam(p1, p2, 0.26, "dark");
    for (let k = 0; k < 3; k++) b.line(p0, [p0[0] + r.range(-1.5, 1.5), r.range(0.8, 2.4), p0[2] + r.range(-1.5, 1.5)], true);
  }
  // Radial fissures in the scorched floor, and embers still glowing in them.
  for (let i = 0; i < 9; i++) {
    const a = r.next() * Math.PI * 2;
    const pts: Vec3[] = [];
    let d = R * 0.08;
    let aa = a;
    while (d < R * 0.85) {
      const q = d / R;
      pts.push([Math.cos(aa) * d, 0.1 + rimH * Math.pow(q, 2.6), Math.sin(aa) * d]);
      d += r.range(0.8, 2);
      aa += r.range(-0.12, 0.12);
    }
    b.polyline(pts);
    if (i < 4) {
      const p = pts[Math.min(pts.length - 1, 1 + r.int(0, 2))]!;
      b.glow(r.range(0.6, 1.4), 0.08, p[0], p[1] + 0.02, p[2], "ember", a);
      b.lamps.add(new THREE.BoxGeometry(r.range(0.8, 1.6), 0.06, 0.25), { tone: "paper", accent: "ember", accentAmount: 0.9, position: [p[0] * 0.6, 0.12 + rimH * Math.pow(0.4, 2.6), p[2] * 0.6], rotation: [0, a, 0] });
    }
  }
  const smoke = createPlume({ origin: [r.range(-2, 2), 0.6, r.range(-2, 2)], rng: seed.fork("crater"), count: 30, life: 18, height: 34, r0: 0.8, r1: 3.4, drift: [18, -9], wander: 2, tone: 0.34, toneTop: 0.2, thinFrom: 0.4, hatch: 0.14, kind: "smoke" });
  b.effect(smoke);
  return b.finish({ width: outer * 2, depth: outer * 2, height: rimH + 8 }, "crater");
}

// =================================================================== burning town

interface House {
  x: number;
  z: number;
  w: number;
  d: number;
  storeys: number;
  state: "burning" | "gutted" | "collapsed" | "smoulder";
}

function burningHouse(b: Build, h: House, fires: FireSource[], plumes: Vec3[]): void {
  const r = b.rng;
  const storeyH = 3;
  const wallH = h.storeys * storeyH + 0.5;
  const rise = h.d * 0.42;
  const zf = h.z + h.d / 2;
  const tone = r.chance(0.4) ? "light" : "pale";
  if (h.state === "collapsed") {
    rubble(b, h.x, h.z, Math.max(h.w, h.d) * 0.55, storeyH * 1.3, 20, tone);
    b.box(1, wallH * 0.8, 0.8, h.x - h.w / 2 + 0.6, 0, h.z, "dark");
    fires.push({ pos: [h.x, 1.2, h.z + 1], size: 4.5, spread: 2.8, tongues: 10 });
    plumes.push([h.x, 3, h.z]);
    return;
  }
  // Walls: the front is cut with openings; the gable ends are solid.
  const front = wallWithOpenings(r, h.w, wallH, storeyH, 0.35, { broken: h.state === "gutted", keep: 0.55, shop: r.chance(0.4) });
  b.add(front.geo, { tone, position: [h.x - h.w / 2, 0, zf] });
  const back = wallWithOpenings(r, h.w, wallH, storeyH, 0.35, { broken: h.state === "gutted", keep: 0.5 });
  b.add(back.geo, { tone: "light", position: [h.x - h.w / 2, 0, h.z - h.d / 2] });
  for (const s of [-1, 1]) {
    const gable = extrude(
      [
        [-h.d / 2, 0],
        [h.d / 2, 0],
        [h.d / 2, wallH],
        [0, wallH + (h.state === "gutted" ? rise * 0.4 : rise)],
        [-h.d / 2, wallH],
      ],
      0.35,
    );
    b.add(gable, { tone: s > 0 ? "light" : tone, position: [h.x + (s * h.w) / 2, 0, h.z], rotation: [0, Math.PI / 2, 0] });
  }
  // Interior darkness behind the openings; burning rooms glow.
  b.box(h.w - 0.8, wallH - 0.4, h.d - 0.8, h.x, 0.1, h.z, "solid");
  for (const [x0, y0, x1, y1] of front.windows) {
    const cx = h.x - h.w / 2 + (x0 + x1) / 2;
    const burning = h.state !== "smoulder" && r.chance(h.state === "burning" ? 0.55 : 0.3);
    if (burning) {
      b.glow(x1 - x0 - 0.05, y1 - y0 - 0.05, cx, (y0 + y1) / 2, zf - 0.08, "ember");
      if (r.chance(0.55)) fires.push({ pos: [cx, y1 - 0.6, zf + 0.4], size: r.range(2.2, 3.4), spread: (x1 - x0) * 0.4, tongues: 5 });
    }
    soot(b, cx, y1 + 0.02, zf + 0.2, (x1 - x0) * 1.4, storeyH * (burning ? 0.9 : 0.6), 0);
  }
  // Roof: two slopes; burning houses have a hole with charred rafters.
  const slopeL = Math.hypot(h.d / 2, rise);
  const ang = Math.atan2(rise, h.d / 2);
  const holeFrom = h.state === "burning" ? r.range(0.15, 0.45) : 0;
  const holeTo = h.state === "burning" ? holeFrom + r.range(0.3, 0.45) : 0;
  for (const s of [-1, 1]) {
    const yMid = wallH + rise / 2;
    const zMid = h.z + (s * h.d) / 4;
    const rot = s * ang;
    if (h.state === "gutted") {
      for (let i = 0; i < Math.round(h.w / 0.9); i++) {
        if (r.chance(0.5)) continue;
        const xx = h.x - h.w / 2 + 0.4 + i * 0.9;
        b.box(0.14, 0.18, slopeL * r.range(0.4, 1), xx, yMid - 0.1, zMid, "solid", { rx: rot });
      }
      continue;
    }
    const segs: Array<[number, number]> = s > 0 && h.state === "burning" ? [[0, holeFrom], [holeTo, 1]] : [[0, 1]];
    for (const [a, c] of segs) {
      if (c - a < 0.02) continue;
      const sw = (c - a) * (h.w + 0.6);
      b.box(sw, 0.22, slopeL + 0.35, h.x - (h.w + 0.6) / 2 + ((a + c) / 2) * (h.w + 0.6), yMid - 0.11, zMid, h.state === "smoulder" ? "dark" : "mid", { rx: rot });
    }
    if (s > 0 && h.state === "burning") {
      const x0 = h.x - (h.w + 0.6) / 2 + holeFrom * (h.w + 0.6),
        x1 = h.x - (h.w + 0.6) / 2 + holeTo * (h.w + 0.6);
      for (let xx = x0 + 0.3; xx < x1; xx += 0.7) b.box(0.14, 0.2, slopeL * r.range(0.5, 1), xx, yMid - 0.1, zMid, "solid", { rx: rot });
      fires.push({ pos: [(x0 + x1) / 2, wallH + rise * 0.25, zMid], size: r.range(8.5, 12), spread: (x1 - x0) * 0.5, tongues: 16 });
      plumes.push([(x0 + x1) / 2, wallH + rise * 0.6, zMid]);
    }
  }
  // Chimney stack on the ridge.
  if (h.state !== "gutted" || r.chance(0.5)) b.box(0.9, rise + 1.6, 0.7, h.x + h.w * r.range(-0.3, 0.3), wallH, h.z, "light");
}

export function buildBurningTown(b: Build, seed: Rng): THREE.Group {
  const r = b.rng;
  const ruin = b.ruin;
  const houses: House[] = [];
  const n = seed.int(6, 8);
  let x = -((n * 8.6) / 2);
  for (let i = 0; i < n; i++) {
    const w = r.range(6.8, 9.6);
    const d = r.range(8, 10);
    const roll = r.next();
    const state: House["state"] = ruin
      ? roll < 0.35
        ? "collapsed"
        : roll < 0.8
          ? "gutted"
          : "smoulder"
      : roll < 0.55
        ? "burning"
        : roll < 0.72
          ? "gutted"
          : roll < 0.85
            ? "collapsed"
            : "smoulder";
    houses.push({ x: x + w / 2, z: r.range(-1.2, 1.2), w, d, storeys: r.int(2, 3), state });
    x += w + r.range(0.1, 1.6);
  }
  // Make sure something is properly ablaze.
  if (!ruin && !houses.some((h) => h.state === "burning")) houses[1]!.state = "burning";
  // A second row behind, partly hidden, burning too.
  for (let i = 0; i < 4; i++) {
    houses.push({ x: -18 + i * 12 + r.range(-2, 2), z: -16, w: r.range(7, 9), d: 8, storeys: 2, state: ruin ? "gutted" : r.chance(0.6) ? "burning" : "collapsed" });
  }
  const fires: FireSource[] = [];
  const plumes: Vec3[] = [];
  for (const h of houses) burningHouse(b, h, fires, plumes);
  // Street, kerbs, a fallen telegraph pole with its wires, a burnt lamp.
  const len = n * 9 + 8;
  b.box(len, 0.06, 9, 0, 0, 9.5, "light");
  b.box(len, 0.16, 0.3, 0, 0, 5.4, "light");
  for (let i = 0; i < 3; i++) {
    const px = -len / 2 + 8 + i * (len - 16) / 2;
    if (i === 1) {
      b.rod([px, 0, 13], [px + 7.5, 0.4, 7.5], 0.16, "dark", 6);
      b.polyline(catenary([px + 7.3, 0.6, 7.6], [px - (len - 16) / 2, 7.2, 13], 1.2, 12));
      continue;
    }
    b.rod([px, 0, 13], [px, 8, 13], 0.16, "dark", 6);
    b.box(1.6, 0.14, 0.14, px, 7.4, 13, "dark");
    if (i === 0) b.polyline(catenary([px, 7.3, 13], [px + (len - 16) / 2, 7.3, 13], 1.8, 14));
  }
  // Flames, sparks, smoke.
  const fl = createFlames(fires, seed.fork("flames"));
  if (!ruin) b.effect(createFireLights(fires, seed.fork("lights"), 3));
  b.effect(fl);
  if (!ruin) {
    const sp = createSparks(fires.filter((f) => f.size > 3), seed.fork("sparks"), 70, [26, -12]);
    b.effect(sp);
  }
  const mainPlumes = plumes.filter((_, i) => i % 2 === 0).slice(0, 3);
  mainPlumes.forEach((p, i) => {
    const smoke = createPlume({
      origin: p,
      rng: seed.fork(`smoke${i}`),
      count: 36,
      life: 30,
      height: ruin ? 60 : 105,
      r0: 2.2,
      r1: ruin ? 7 : 11,
      drift: [72, -34],
      wander: 7,
      sourceRadius: 1.6,
      tone: ruin ? 0.5 : 0.72,
      toneTop: ruin ? 0.3 : 0.46,
      thinFrom: 0.5,
      hatch: 0.28,
      ember: ruin ? 0 : 0.85,
      kind: "smoke",
    });
    b.effect(smoke);
  });
  b.blinkPeriod = 1.2;
  return b.finish({ width: len, depth: 34, height: 14, offsetZ: -4 }, "burning-town");
}

// =================================================================== monolith

export function buildMonolith(b: Build, seed: Rng): THREE.Group {
  const kind = seed.pick(["gate", "wall", "field", "spire", "gate", "wall"] as const);
  const ruin = b.ruin;
  const building = b.building;
  const P = "paper";
  // A vast white plinth with a crisp stepped edge.
  const pw = 150,
    pd = 110;
  b.box(pw, 0.9, pd, 0, 0, 0, P);
  b.box(pw - 5, 0.9, pd - 5, 0, 0.9, 0, P);
  const y0 = 1.8;
  const slab = (x: number, z: number, w: number, h: number, d: number, i: number) => {
    if (ruin && i === 1) {
      // Toppled and broken into three, the only disorder in the field.
      for (let k = 0; k < 3; k++) b.box(w, d, h / 3 - 0.6, x + k * 0.8, y0, z + d / 2 + 2 + (k * h) / 3, P, { ry: k * 0.05, rz: k === 1 ? 0.04 : -0.03 });
      return;
    }
    const hh = building && i === 0 ? h * 0.55 : h;
    b.box(w, hh, d, x, y0, z, P);
    if (building && i === 0) {
      scaffold(b, x, z, w, d, hh + 6, 3, 3);
      b.box(w * 0.4, 10, d * 0.4, x, y0 + hh, z, "light");
    }
    if (ruin && i === 0) {
      // A hairline crack from crown to base and a spalled corner.
      const pts: Vec3[] = [];
      for (let k = 0; k <= 12; k++) pts.push([x - w * 0.1 + Math.sin(k * 1.7) * w * 0.08, y0 + hh * (1 - k / 12), z + d / 2 + 0.02]);
      b.polyline(pts);
      b.box(w * 0.2, hh * 0.08, d * 0.3, x + w * 0.42, y0 + hh * 0.92, z + d * 0.36, "light");
    }
  };
  if (kind === "gate") {
    slab(-7, -18, 12, 104, 8, 0);
    slab(7, -18, 12, 104, 8, 2);
    slab(-40, -4, 10, 56, 5, 1);
    slab(40, -4, 10, 56, 5, 3);
  } else if (kind === "wall") {
    // One blank wall, longer than the plinth, taller than anything alive.
    slab(0, -24, 190, 78, 9, 0);
    slab(-58, 14, 6, 40, 6, 1);
    slab(58, 14, 6, 40, 6, 2);
  } else if (kind === "field") {
    slab(0, -26, 24, 112, 7, 0);
    let i = 1;
    for (let row = 0; row < 3; row++) for (let col = -2; col <= 2; col++) if (col !== 0 || row > 0) slab(col * 22, -6 + row * 16, 7, 34 - row * 6, 2.4, i++);
  } else {
    // Spire: a square obelisk, perfectly plain, ringed by pylons.
    const H = 132;
    const g = new THREE.CylinderGeometry(4.6, 7.4, H, 4, 1);
    g.rotateY(Math.PI / 4);
    b.add(g, { tone: P, position: [0, y0 + H / 2, -18] });
    b.add(new THREE.ConeGeometry(4.6, 7, 4), { tone: P, position: [0, y0 + H + 3.5, -18], rotation: [0, Math.PI / 4, 0] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      slab(Math.cos(a) * 34, -18 + Math.sin(a) * 34, 3, 26, 3, i + 1);
    }
  }
  // A colonnade of identical pylons along the front edge.
  for (let i = 0; i < 9; i++) {
    const x = -48 + i * 12;
    if (ruin && i === 6) {
      b.box(2.6, 2.6, 28, x + 4, y0, 36, P, { ry: 0.2 });
      continue;
    }
    b.box(2.6, 28, 2.6, x, y0, 44, P);
  }
  // The only aperture: a human-sized door at the foot of the tallest slab.
  const doorZ = kind === "gate" ? -13.98 : kind === "field" ? -22.48 : kind === "wall" ? -19.48 : -18 + 5.3;
  const doorX = kind === "gate" ? -7 : 0;
  b.box(1.1, 2.3, 0.05, doorX, y0, doorZ, "solid");
  if (building) towerCrane(b, 22, -30, 90, 55, 2.6, { slew: true });
  return b.finish({ width: kind === "wall" ? 196 : pw, depth: pd, height: kind === "spire" ? 142 : kind === "wall" ? 80 : 116 }, "monolith");
}
