/**
 * Windshield effects: cracks in the glass, blood and rain on its face, and a
 * wiper that sweeps both.
 *
 * Two inked canvases sit on planes just inside and just outside the glass:
 *  - damage (2048×1024): composited from three persistent layers (smear,
 *    blood, cracks). Only changes are drawn; the texture is re-uploaded at
 *    most ~12 times a second and only while something is changing.
 *  - rain (1024×512): drops are painted incrementally; the wiper erases the
 *    sector it crosses.
 *
 * Canvas maps are alpha-cut at 0.5, so every mark is fully opaque: "faint"
 * is expressed with sparse marks and pale pigment, never translucency.
 * Pigment rules: #8a0a10-ish (r < 0.62) reads as blood; pale smears keep
 * r < 0.62 and r - g > 0.13 so they stay blood, never signal red or grey.
 */
import * as THREE from "three";
import { createInkCanvas } from "../core/ink-material.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { Kit, cylinder } from "../core/geometry.ts";
import { GLASS, glassMatrix } from "./layout.ts";
import { IDS, cabMaterial, cabMesh, mapMaterial, roundedBox } from "./util.ts";

export interface ImpactOptions {
  /** 0 = left edge of the glass, 1 = right edge. */
  u: number;
  /** 0 = bottom edge of the glass, 1 = top edge. */
  v: number;
  /** 0..1: chip .. bullseye. */
  severity: number;
  blood: boolean;
}

export interface WindshieldApi {
  impact(opts: ImpactOptions): void;
  setRain(amount: number): void;
  wipe(): void;
  clear(): void;
  /** Remove blood and its smears, keeping the cracks (less graphic detail). */
  clearBlood(): void;
  /** Wipers run on their own while it rains (default true). */
  setAutoWipe(on: boolean): void;
  /** Glass u,v (0..1) where the line from the camera to a world point crosses the windshield, or null. */
  uvAt(world: THREE.Vector3, camera: THREE.Camera): { u: number; v: number } | null;
  /** Number of impacts that have marked the glass since the last clear. */
  readonly impacts: number;
}

export interface WindshieldParts {
  group: THREE.Group;
  api: WindshieldApi;
  tick(dt: number, t: number, speedKmh: number): void;
  textures: THREE.Texture[];
}

const CW = 2048;
const CH = 1024;
const S = CW / (GLASS.halfW * 2); // px per metre
const RW = 1024;
const RH = 512;
const RS = RW / (GLASS.halfW * 2);

// Wiper geometry (glass metres, v up).
const PIVOT_U = 0.05;
const PIVOT_V = -0.46;
const BLADE_R0 = 0.3;
const BLADE_R1 = 0.82;
const SWEEP = (172 * Math.PI) / 180;
const WIPE_TIME = 1.55;

const BLOOD = "rgb(138,10,16)";
const BLOOD_DARK = "rgb(112,6,12)";

interface Ray {
  pts: number[]; // x,y pairs from the centre outward
  dist: number[]; // distance from the crack centre at each vertex
  cum: number[]; // cumulative length
  len: number;
  target: number;
  width: number;
  forks: Array<{ at: number; ray: Ray }>;
}
interface Crack {
  x: number;
  y: number;
  sev: number;
  rays: Ray[];
  rings: number[];
  crush: Array<{ pts: number[]; fill: "#111" | "#fff" }>;
  age: number;
}
interface Splat {
  x: number;
  y: number;
  r: number;
  amount: number;
  picked: boolean;
}
interface Drip {
  x: number;
  y: number;
  len: number;
  target: number;
  w: number;
  v: number;
}
interface Carried {
  r: number;
  width: number;
  amount: number;
  lastA: number;
  seed: number;
}

function makeLayer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function openingPath(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number): void {
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, GLASS.radius * scale);
}

function buildRay(rng: Rng, cx: number, cy: number, angle: number, maxLen: number, step: number, width: number, depth: number): Ray {
  const pts = [cx, cy];
  const dist = [0];
  const cum = [0];
  let x = cx,
    y = cy,
    a = angle,
    L = 0;
  const forks: Ray["forks"] = [];
  while (L < maxLen) {
    const s = step * rng.range(0.6, 1.4);
    a += rng.range(-0.16, 0.16);
    // Cracks prefer to keep heading away from the centre.
    const back = Math.atan2(y - cy, x - cx);
    if (L > step * 2) {
      // Wrapped angular difference, or rays loop at the ±π seam.
      const d = Math.atan2(Math.sin(back - a), Math.cos(back - a));
      a += d * 0.08;
    }
    x += Math.cos(a) * s;
    y += Math.sin(a) * s;
    L += s;
    pts.push(x, y);
    dist.push(Math.hypot(x - cx, y - cy));
    cum.push(L);
    if (depth > 0 && L > step * 3 && rng.chance(0.09)) {
      const fa = a + (rng.chance(0.5) ? 1 : -1) * rng.range(0.35, 0.8);
      forks.push({ at: L, ray: buildRay(rng, x, y, fa, maxLen * rng.range(0.15, 0.4), step * 0.8, width * 0.7, depth - 1) });
    }
  }
  return { pts, dist, cum, len: 0, target: 0, width, forks };
}

function pointAtDist(ray: Ray, r: number): [number, number] | null {
  for (let i = 1; i < ray.dist.length; i++) {
    if (ray.cum[i]! > ray.len) return null;
    if (ray.dist[i]! >= r) {
      const d0 = ray.dist[i - 1]!,
        d1 = ray.dist[i]!;
      const t = (r - d0) / Math.max(1e-3, d1 - d0);
      return [ray.pts[(i - 1) * 2]! + (ray.pts[i * 2]! - ray.pts[(i - 1) * 2]!) * t, ray.pts[(i - 1) * 2 + 1]! + (ray.pts[i * 2 + 1]! - ray.pts[(i - 1) * 2 + 1]!) * t];
    }
  }
  return null;
}

function strokeRay(ctx: CanvasRenderingContext2D, ray: Ray, parentLen: number, forkAt: number): void {
  const visible = Math.min(ray.len, parentLen - forkAt);
  if (visible <= 0) return;
  ctx.lineWidth = ray.width;
  ctx.beginPath();
  ctx.moveTo(ray.pts[0]!, ray.pts[1]!);
  for (let i = 1; i < ray.cum.length; i++) {
    if (ray.cum[i]! <= visible) ctx.lineTo(ray.pts[i * 2]!, ray.pts[i * 2 + 1]!);
    else {
      const c0 = ray.cum[i - 1]!;
      const t = (visible - c0) / (ray.cum[i]! - c0);
      ctx.lineTo(ray.pts[(i - 1) * 2]! + (ray.pts[i * 2]! - ray.pts[(i - 1) * 2]!) * t, ray.pts[(i - 1) * 2 + 1]! + (ray.pts[i * 2 + 1]! - ray.pts[(i - 1) * 2 + 1]!) * t);
      break;
    }
  }
  ctx.stroke();
  for (const f of ray.forks) {
    strokeRay(ctx, f.ray, visible, f.at);
  }
}

export function buildWindshield(seed: string): WindshieldParts {
  const group = new THREE.Group();
  group.name = "cab-windshield";
  const gm = glassMatrix();
  const rng = createRng(`${seed}:glass`);

  // ------------------------------------------------------------ canvases
  const dmg = createInkCanvas(CW, CH);
  dmg.ctx.clearRect(0, 0, CW, CH);
  dmg.texture.generateMipmaps = false;
  dmg.texture.minFilter = THREE.LinearFilter;
  dmg.texture.needsUpdate = true;
  const rain = createInkCanvas(RW, RH);
  rain.ctx.clearRect(0, 0, RW, RH);
  rain.texture.generateMipmaps = false;
  rain.texture.minFilter = THREE.LinearFilter;
  rain.texture.needsUpdate = true;
  const crackL = makeLayer();
  const bloodL = makeLayer();
  const smearL = makeLayer();

  const W = GLASS.halfW * 2,
    H = GLASS.halfH * 2;
  const dmgMesh = cabMesh(new THREE.PlaneGeometry(W, H), mapMaterial(dmg.texture, IDS.glassFx, { decal: true }), "cab-glass-damage");
  dmgMesh.matrixAutoUpdate = false;
  dmgMesh.matrix.copy(gm).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.004));
  const rainMesh = cabMesh(new THREE.PlaneGeometry(W, H), mapMaterial(rain.texture, IDS.rainFx, { decal: true }), "cab-glass-rain");
  rainMesh.matrixAutoUpdate = false;
  rainMesh.matrix.copy(gm).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.004));
  group.add(dmgMesh, rainMesh);

  // --------------------------------------------------------------- wiper
  const wiperRoot = new THREE.Group();
  wiperRoot.matrixAutoUpdate = false;
  wiperRoot.matrix.copy(gm).multiply(new THREE.Matrix4().makeTranslation(PIVOT_U, PIVOT_V, -0.022));
  group.add(wiperRoot);
  const wiperArm = new THREE.Group();
  wiperRoot.add(wiperArm);
  {
    const k = new Kit();
    // Arm: spring housing near the pivot, tapered bar out to the blade saddle.
    k.add(cylinder(0.022, 0.024, 0.03, 16), { tone: "deep", rotation: [Math.PI / 2, 0, 0] });
    k.add(roundedBox(0.16, 0.026, 0.02, 0.006), { tone: "deep", position: [0.09, 0, -0.004] });
    k.add(roundedBox(0.44, 0.012, 0.009, 0.003), { tone: "deep", position: [0.34, 0, -0.006] });
    k.add(roundedBox(0.03, 0.02, 0.016, 0.004), { tone: "deep", position: [(BLADE_R0 + BLADE_R1) / 2, 0, -0.01] });
    // Blade: frame bar with yokes and the rubber strip.
    const bl = BLADE_R1 - BLADE_R0;
    k.add(roundedBox(bl * 0.62, 0.008, 0.01, 0.003), { tone: "deep", position: [(BLADE_R0 + BLADE_R1) / 2, 0.0, -0.014] });
    for (const f of [-0.36, 0.36]) {
      k.add(roundedBox(bl * 0.3, 0.007, 0.008, 0.002), { tone: "deep", position: [(BLADE_R0 + BLADE_R1) / 2 + f * bl * 0.66, 0.0, -0.01] });
    }
    k.add(roundedBox(bl, 0.004, 0.006, 0.0015), { tone: "solid", position: [(BLADE_R0 + BLADE_R1) / 2, 0.0, -0.004] });
    wiperArm.add(cabMesh(k.build(), cabMaterial(IDS.wiper), "cab-wiper"));
  }

  // --------------------------------------------------------------- state
  const cracks: Crack[] = [];
  const splats: Splat[] = [];
  const drips: Drip[] = [];
  const carried: Carried[] = [];
  let impacts = 0;
  let dirty = false;
  let rainDirty = false;
  let uploadClock = 0;
  let rainClock = 0;
  let rainAmount = 0;
  let autoWipe = true;
  let wipeTimer = 0;
  let wiping = false;
  let wipeT = 0;
  let angle = 0;
  let growth = false;
  let crackDirty = false;
  let rainUploadClock = 0;
  const px = PIVOT_U * S + GLASS.halfW * S;
  const py = (GLASS.halfH - PIVOT_V) * S;
  const rpx = PIVOT_U * RS + GLASS.halfW * RS;
  const rpy = (GLASS.halfH - PIVOT_V) * RS;

  const compose = () => {
    const c = dmg.ctx;
    c.clearRect(0, 0, CW, CH);
    c.drawImage(smearL.canvas, 0, 0);
    c.drawImage(bloodL.canvas, 0, 0);
    c.drawImage(crackL.canvas, 0, 0);
    dmg.texture.needsUpdate = true;
  };

  const redrawCracks = () => {
    const c = crackL.ctx;
    c.save();
    c.clearRect(0, 0, CW, CH);
    openingPath(c, CW, CH, S);
    c.clip();
    c.strokeStyle = "#111";
    c.fillStyle = "#111";
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const k of cracks) {
      for (const ray of k.rays) strokeRay(c, ray, Infinity, 0);
      // Concentric fracture: chords between neighbouring rays.
      c.lineWidth = 1.3 + k.sev * 0.6;
      for (const R of k.rings) {
        for (let i = 0; i < k.rays.length; i++) {
          const a = pointAtDist(k.rays[i]!, R);
          const b = pointAtDist(k.rays[(i + 1) % k.rays.length]!, R * (0.94 + ((i * 37) % 11) / 90));
          if (!a || !b) continue;
          const mx = (a[0] + b[0]) / 2 + (a[1] - b[1]) * 0.015;
          const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.015;
          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.quadraticCurveTo(mx, my, b[0], b[1]);
          c.stroke();
        }
      }
      // Crushed centre: shards.
      for (const s of k.crush) {
        c.fillStyle = s.fill;
        c.beginPath();
        c.moveTo(s.pts[0]!, s.pts[1]!);
        for (let i = 2; i < s.pts.length; i += 2) c.lineTo(s.pts[i]!, s.pts[i + 1]!);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  };

  const addCrack = (x: number, y: number, sev: number) => {
    const r = rng.fork(`crack${impacts}`);
    const n = Math.round(6 + sev * 9 + r.range(-1, 2));
    const rays: Ray[] = [];
    const a0 = r.range(0, Math.PI * 2);
    const reach = (60 + sev * 330) * r.range(0.8, 1.15);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + r.range(-0.22, 0.22);
      const maxLen = reach * r.range(0.45, 1.35) * 2.2;
      const ray = buildRay(r, x, y, a, maxLen, 14 + sev * 10, 1.7 + sev * 1.3 * r.range(0.6, 1.1), 2);
      ray.target = reach * r.range(0.5, 1.1) * (0.45 + 0.55 * sev);
      rays.push(ray);
    }
    const rings: number[] = [];
    const nr = Math.floor(1 + sev * 4);
    for (let i = 0; i < nr; i++) rings.push(reach * (0.1 + (0.62 * (i + 1)) / (nr + 0.5)) * r.range(0.85, 1.1));
    const crush: Crack["crush"] = [];
    const cr = 5 + sev * 22;
    const shards = Math.round(6 + sev * 30);
    for (let i = 0; i < shards; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(0, cr);
      const sx = x + Math.cos(a) * d,
        sy = y + Math.sin(a) * d;
      const s = r.range(2, 4 + sev * 7);
      const b = r.range(0, Math.PI * 2);
      crush.push({
        pts: [sx, sy, sx + Math.cos(b) * s, sy + Math.sin(b) * s, sx + Math.cos(b + 2.1) * s * 0.7, sy + Math.sin(b + 2.1) * s * 0.7],
        fill: r.chance(0.72) ? "#111" : "#fff",
      });
    }
    cracks.push({ x, y, sev, rays, rings, crush, age: 0 });
  };

  const growOld = () => {
    // Every later impact stresses the pane: old cracks creep outward and one
    // of their rays runs.
    for (const k of cracks) {
      k.age++;
      for (const ray of k.rays) {
        const max = ray.cum[ray.cum.length - 1]!;
        ray.target = Math.min(max, ray.target + (max - ray.target) * 0.1 + 10);
        for (const f of ray.forks) f.ray.target = Math.min(f.ray.cum[f.ray.cum.length - 1]!, f.ray.target + 20 + k.age * 6);
      }
      // Every other blow, one ray runs most of its length.
      if (k.age % 2 === 0) {
        const runner = k.rays[(k.age * 7) % k.rays.length]!;
        runner.target = Math.max(runner.target, runner.cum[runner.cum.length - 1]! * 0.7);
      }
      if (k.rings.length < 5) k.rings.push((k.rings[k.rings.length - 1] ?? 30) * 1.3);
    }
    growth = true;
  };

  const blobPath = (c: CanvasRenderingContext2D, r: Rng, x: number, y: number, R: number, verts: number, rough: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < verts; i++) {
      const a = (i / verts) * Math.PI * 2;
      const rr = R * (1 + r.range(-rough, rough));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    c.beginPath();
    for (let i = 0; i < verts; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % verts]!;
      const mx = (p[0] + q[0]) / 2,
        my = (p[1] + q[1]) / 2;
      if (i === 0) c.moveTo(mx, my);
      else c.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p0 = pts[0]!;
    const q0 = pts[1 % verts]!;
    c.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2);
    c.closePath();
  };

  const addBlood = (x: number, y: number, sev: number) => {
    const r = rng.fork(`blood${impacts}`);
    const c = bloodL.ctx;
    c.save();
    openingPath(c, CW, CH, S);
    c.clip();
    const R = (34 + sev * 96) * r.range(0.8, 1.2);
    c.fillStyle = BLOOD;
    blobPath(c, r, x, y, R, 22, 0.32);
    c.fill();
    // Lobes and a darker pooled core.
    const lobes = r.int(4, 8);
    for (let i = 0; i < lobes; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = R * r.range(0.55, 1.05);
      blobPath(c, r, x + Math.cos(a) * d, y + Math.sin(a) * d, R * r.range(0.22, 0.5), 12, 0.3);
      c.fill();
    }
    c.fillStyle = BLOOD_DARK;
    blobPath(c, r, x + R * 0.08, y + R * 0.05, R * 0.42, 14, 0.25);
    c.fill();
    // Satellites: radial teardrops, smaller with distance.
    c.fillStyle = BLOOD;
    const sats = Math.round(18 + sev * 50);
    for (let i = 0; i < sats; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = R * r.range(1.15, 2.9);
      const sz = Math.max(2, R * 0.16 * (1 - (d / (R * 3)) * 0.8) * r.range(0.4, 1.2));
      const sx = x + Math.cos(a) * d,
        sy = y + Math.sin(a) * d;
      c.save();
      c.translate(sx, sy);
      c.rotate(a);
      c.beginPath();
      c.ellipse(0, 0, sz * r.range(1.3, 2.6), sz, 0, 0, Math.PI * 2);
      c.fill();
      if (r.chance(0.45)) {
        // Tail pointing outward.
        c.beginPath();
        c.moveTo(sz * 0.8, -sz * 0.5);
        c.quadraticCurveTo(sz * 4.5, 0, sz * 0.8, sz * 0.5);
        c.fill();
      }
      c.restore();
    }
    // Fine spray.
    const spray = Math.round(30 + sev * 80);
    for (let i = 0; i < spray; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = R * r.range(1.6, 4.2);
      c.beginPath();
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r.range(1.6, 3.4), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    splats.push({ x, y, r: R, amount: 1, picked: false });
    const nd = r.int(2, 3 + Math.round(sev * 3));
    for (let i = 0; i < nd; i++) {
      drips.push({
        x: x + r.range(-R * 0.75, R * 0.75),
        y: y + R * r.range(0.3, 0.8),
        len: 0,
        target: r.range(60, 150 + sev * 260),
        w: r.range(6, 11 + sev * 5),
        v: r.range(30, 70),
      });
    }
  };

  const sectorPath = (c: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) => {
    const lo = Math.min(a0, a1),
      hi = Math.max(a0, a1);
    c.beginPath();
    c.arc(cx, cy, r1, -lo, -hi, true);
    c.arc(cx, cy, r0, -hi, -lo, false);
    c.closePath();
  };

  const smearStep = (a0: number, a1: number, returning: boolean) => {
    // Pick up wet blood the blade crosses.
    const lo = Math.min(a0, a1),
      hi = Math.max(a0, a1);
    for (const s of splats) {
      if (s.picked || s.amount <= 0.05) continue;
      const dx = s.x - px,
        dy = py - s.y;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (r + s.r * 0.5 < BLADE_R0 * S || r - s.r * 0.5 > BLADE_R1 * S) continue;
      if (a < lo - 0.02 || a > hi + 0.02) continue;
      s.picked = true;
      carried.push({ r, width: Math.min(s.r * 1.4, 110), amount: s.amount, lastA: a, seed: carried.length + impacts * 17 });
      s.amount *= 0.35;
    }
    // Erase what the blade has cleared (blood layer).
    const b = bloodL.ctx;
    b.save();
    b.globalCompositeOperation = "destination-out";
    sectorPath(b, px, py, BLADE_R0 * S - 2, BLADE_R1 * S + 2, a0 - 0.01, a1 + 0.01);
    b.fill();
    b.restore();
    // Smear carried blood along the arc as pale striations.
    const c = smearL.ctx;
    c.save();
    openingPath(c, CW, CH, S);
    c.clip();
    c.lineCap = "butt";
    for (const k of carried) {
      if (k.amount < 0.04) continue;
      const r = createRng(k.seed);
      const n = Math.max(2, Math.round(k.width / 16));
      for (let i = 0; i < n; i++) {
        const off = (i / (n - 1) - 0.5) * k.width;
        const rr = k.r + off;
        if (rr < BLADE_R0 * S || rr > BLADE_R1 * S) continue;
        const strength = k.amount * r.range(0.4, 1);
        if (strength < 0.2) continue;
        const g = Math.round(122 - strength * 70);
        c.strokeStyle = `rgb(152,${g},${g + 2})`;
        c.lineWidth = r.range(2.2, 4.5);
        c.beginPath();
        const from = returning ? Math.min(k.lastA, a1) : Math.min(k.lastA, a1);
        const to = returning ? Math.max(k.lastA, a1) : Math.max(k.lastA, a1);
        c.arc(px, py, rr, -from, -to, true);
        c.stroke();
      }
      k.amount *= returning ? 0.72 : 0.86;
      k.lastA = a1;
    }
    c.restore();
    dirty = true;
  };

  const rainSweep = (a0: number, a1: number) => {
    const c = rain.ctx;
    c.save();
    c.globalCompositeOperation = "destination-out";
    sectorPath(c, rpx, rpy, BLADE_R0 * RS - 2, BLADE_R1 * RS + 2, a0 - 0.01, a1 + 0.01);
    c.fill();
    c.restore();
    rainDirty = true;
  };

  const paintDrops = (count: number, speed: number, r: Rng) => {
    const c = rain.ctx;
    c.save();
    openingPath(c, RW, RH, RS);
    c.clip();
    for (let i = 0; i < count; i++) {
      const x = r.range(0, RW),
        y = r.range(0, RH);
      const rad = r.range(2.2, 5.5) * (r.chance(0.12) ? 1.6 : 1);
      if (speed > 8 && r.chance(0.35)) {
        // Wind-driven runnel: up and outward from the centre line.
        const dir = x < RW / 2 ? -1 : 1;
        const len = r.range(14, 50) * Math.min(1.6, speed / 40);
        c.strokeStyle = "#fff";
        c.lineWidth = rad * 0.9;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + dir * len * 0.45, y - len);
        c.stroke();
        c.strokeStyle = "#111";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(x + rad * 0.4, y);
        c.lineTo(x + dir * len * 0.45 + rad * 0.3, y - len);
        c.stroke();
      }
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
      // Lower crescent in ink: the drop's lens.
      c.fillStyle = "#111";
      c.beginPath();
      c.arc(x, y, rad, 0.15, Math.PI - 0.15);
      c.arc(x, y - rad * 0.35, rad * 0.8, Math.PI - 0.3, 0.3, true);
      c.closePath();
      c.fill();
    }
    c.restore();
    rainDirty = true;
  };

  const api: WindshieldApi = {
    get impacts() {
      return impacts;
    },
    impact(o) {
      const sev = THREE.MathUtils.clamp(o.severity, 0, 1);
      const x = THREE.MathUtils.clamp(o.u, 0.02, 0.98) * CW;
      const y = (1 - THREE.MathUtils.clamp(o.v, 0.02, 0.98)) * CH;
      if (cracks.length) growOld();
      // The pane keeps its worst few breaks; later blows stress them instead.
      if (cracks.length < 6) addCrack(x, y, sev);
      if (o.blood) addBlood(x, y, Math.max(0.3, sev));
      impacts++;
      growth = true;
      dirty = true;
    },
    setRain(a) {
      rainAmount = THREE.MathUtils.clamp(a, 0, 1);
    },
    wipe() {
      if (!wiping) {
        wiping = true;
        wipeT = 0;
      }
    },
    clear() {
      cracks.length = 0;
      splats.length = 0;
      drips.length = 0;
      carried.length = 0;
      for (const l of [crackL, bloodL, smearL]) l.ctx.clearRect(0, 0, CW, CH);
      rain.ctx.clearRect(0, 0, RW, RH);
      impacts = 0;
      compose();
      rain.texture.needsUpdate = true;
    },
    clearBlood() {
      splats.length = 0;
      drips.length = 0;
      carried.length = 0;
      for (const l of [bloodL, smearL]) l.ctx.clearRect(0, 0, CW, CH);
      compose();
    },
    setAutoWipe(on) {
      autoWipe = on;
    },
    uvAt(world, camera) {
      group.updateWorldMatrix(true, false);
      const m = new THREE.Matrix4().multiplyMatrices(group.matrixWorld, gm);
      const inv = m.clone().invert();
      const o = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inv);
      const p = world.clone().applyMatrix4(inv);
      const d = p.clone().sub(o);
      if (Math.abs(d.z) < 1e-6) return null;
      const t = -o.z / d.z;
      if (t <= 0) return null;
      const hit = o.addScaledVector(d, t);
      const u = (hit.x + GLASS.halfW) / (GLASS.halfW * 2);
      const v = (hit.y + GLASS.halfH) / (GLASS.halfH * 2);
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      return { u, v };
    },
  };

  const dropRng = rng.fork("rain");
  let dropAcc = 0;

  const tick = (dt: number, t: number, speedKmh: number) => {
    void t;
    // Crack creep: lengths advance every frame (cheap); the layer is redrawn
    // only when the texture is next composed.
    if (growth) {
      let moving = false;
      const grow = (ray: Ray, rate: number, limit: number) => {
        const target = Math.min(ray.target, limit);
        if (ray.len < target - 0.01) {
          ray.len = Math.min(target, ray.len + dt * rate * (ray.len < 40 ? 3 : 1));
          moving = true;
        }
      };
      for (const k of cracks) {
        const rate = 220 + k.sev * 500;
        for (const ray of k.rays) {
          grow(ray, rate, Infinity);
          for (const f of ray.forks) grow(f.ray, rate * 0.7, Math.max(0, ray.len - f.at));
        }
      }
      crackDirty = true;
      if (!moving) growth = false;
    }
    // Drips run and slow.
    if (drips.length) {
      const c = bloodL.ctx;
      c.save();
      openingPath(c, CW, CH, S);
      c.clip();
      c.fillStyle = BLOOD;
      c.strokeStyle = BLOOD;
      c.lineCap = "round";
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i]!;
        const step = Math.min(d.target - d.len, d.v * dt);
        if (step <= 0.01) {
          drips.splice(i, 1);
          continue;
        }
        c.lineWidth = d.w * (1 - (d.len / d.target) * 0.35);
        c.beginPath();
        c.moveTo(d.x, d.y + d.len);
        d.len += step;
        d.v *= 1 - dt * 0.35;
        c.lineTo(d.x + Math.sin(d.len * 0.03) * 1.5, d.y + d.len);
        c.stroke();
        c.beginPath();
        c.arc(d.x + Math.sin(d.len * 0.03) * 1.5, d.y + d.len, d.w * 0.62, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      dirty = true;
    }
    // Rain.
    if (rainAmount > 0.001) {
      dropAcc += dt * rainAmount * 140;
      rainClock += dt;
      if (rainClock > 0.1 && dropAcc >= 1) {
        const n = Math.floor(dropAcc);
        dropAcc -= n;
        rainClock = 0;
        paintDrops(n, speedKmh, dropRng);
      }
      if (autoWipe && rainAmount > 0.15 && !wiping) {
        wipeTimer += dt;
        if (wipeTimer > THREE.MathUtils.lerp(6, 1.8, rainAmount)) {
          wipeTimer = 0;
          api.wipe();
        }
      }
    }
    // Wiper.
    if (wiping) {
      wipeT += dt;
      const f = Math.min(1, wipeT / WIPE_TIME);
      const prev = angle;
      angle = SWEEP * 0.5 * (1 - Math.cos(f * Math.PI * 2));
      const returning = f > 0.5;
      if (Math.abs(angle - prev) > 1e-4) {
        smearStep(prev, angle, returning);
        rainSweep(prev, angle);
      }
      if (f >= 1) {
        wiping = false;
        angle = 0;
        carried.length = 0;
        for (const s of splats) s.picked = false;
      }
      wiperArm.rotation.z = angle;
    }
    // Uploads are throttled: damage ≤ 12 Hz, rain ≤ 20 Hz, and only when dirty.
    uploadClock += dt;
    if ((dirty || crackDirty) && uploadClock > 1 / 12) {
      uploadClock = 0;
      if (crackDirty) {
        redrawCracks();
        crackDirty = false;
      }
      dirty = false;
      compose();
    }
    rainUploadClock += dt;
    if (rainDirty && rainUploadClock > 1 / 20) {
      rainUploadClock = 0;
      rainDirty = false;
      rain.texture.needsUpdate = true;
    }
  };

  compose();
  return { group, api, tick, textures: [dmg.texture, rain.texture] };
}
