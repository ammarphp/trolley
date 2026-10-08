/**
 * Farm props: hay bales, field boundaries (tileable along local X), the
 * scarecrow, the well and small sheds. Proportions from farm practice:
 * round bale 1.5 m dia x 1.2 m; small square bale 0.9 x 0.46 x 0.36 m;
 * field fence posts 1.2-1.4 m above ground at 3 m centres; dry-stone wall
 * 1.3 m high, 0.7 m at the base battered to 0.4 m under the copes.
 */
import * as THREE from "three";
import { Kit, block, cylinder, extrude, gable, type Tone } from "../../core/geometry.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import { TAU, blade, blob, boxAt, lerp, rod, rubble, sagWire, taperTube, v3 } from "./shapes.ts";

export const ROUND_BALE_VARIANTS = ["single", "pair", "silage wrapped", "stacked three", "weathered"] as const;
export const SQUARE_BALE_VARIANTS = ["single", "small stack", "big squares", "scattered"] as const;
export const RAIL_FENCE_VARIANTS = ["three-rail", "post and two rails", "weathered", "field gate"] as const;
export const BARBED_FENCE_VARIANTS = ["four strand", "three strand, leaning", "snapped strand", "steel angle posts", "concrete, cranked"] as const;
export const WALL_VARIANTS = ["dry-stone wall", "low wall", "tumbled gap", "wall with stile"] as const;
export const SCARECROW_VARIANTS = ["classic", "tattered", "the pale one"] as const;
export const WELL_VARIANTS = ["roofed well", "windlass well", "capped well with pump"] as const;
export const SHED_VARIANTS = ["outhouse", "garden shed", "field shelter", "derelict hut"] as const;
export const FENCE_TILE = 3;

const mod = (v: number, n: number) => ((v % n) + n) % n;

// ----------------------------------------------------------------- bales

function roundBale(k: Kit, rng: Rng, at: [number, number, number], yaw: number, opts: { wrapped?: boolean; upright?: boolean; rot?: number } = {}): void {
  const R = 0.75;
  const Wd = 0.6;
  const profile: Array<[number, number]> = [
    [0, -Wd],
    [0.3, -Wd],
    [0.32, -Wd + 0.018],
    [0.52, -Wd + 0.018],
    [0.54, -Wd],
    [0.66, -Wd + 0.008],
    [0.73, -Wd + 0.05],
    [R, -Wd + 0.14],
    [R + 0.012, 0],
    [R, Wd - 0.14],
    [0.73, Wd - 0.05],
    [0.66, Wd - 0.008],
    [0.54, Wd],
    [0.52, Wd - 0.018],
    [0.32, Wd - 0.018],
    [0.3, Wd],
    [0, Wd],
  ];
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r * rng.range(0.99, 1.01), y)),
    16,
  );
  const tone = opts.wrapped ? "deep" : opts.rot ? "light" : "pale";
  // The rolled spiral on each end face: what makes a round bale a round bale.
  const spiral = (side: 1 | -1): THREE.BufferGeometry => {
    const pts: THREE.Vector3[] = [];
    const turns = 3.2;
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * TAU + rng.range(-0.02, 0.02);
      const r = 0.1 + t * (R - 0.16);
      pts.push(v3(Math.cos(a) * r, side * (Wd - 0.004 - (r > 0.66 ? (r - 0.66) * 0.4 : 0)), Math.sin(a) * r));
    }
    return taperTube(pts, 0.014, 0.018, { radial: 3, segments: n });
  };
  if (!opts.wrapped) {
    const merged = new Kit();
    merged.add(g, { tone });
    merged.add(spiral(1), { tone: "dark" });
    merged.add(spiral(-1), { tone: "dark" });
    const built = merged.build();
    return placeBale(k, built, R, Wd, at, yaw, opts);
  }
  placeBale(k, paintAll(g, tone), R, Wd, at, yaw, opts);
}

function paintAll(g: THREE.BufferGeometry, tone: Tone): THREE.BufferGeometry {
  const k = new Kit();
  k.add(g, { tone });
  return k.build();
}

function placeBale(k: Kit, g: THREE.BufferGeometry, R: number, Wd: number, at: [number, number, number], yaw: number, opts: { upright?: boolean; rot?: number }): void {
  if (opts.upright) {
    k.addGeometry(g, new THREE.Matrix4().compose(v3(at[0], at[1] + Wd, at[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), v3(1, 1, 1)));
  } else {
    const h = g.clone();
    h.rotateZ(Math.PI / 2);
    h.scale(1, 0.95, 1);
    // A sagging bale settles: flatten the underside a touch.
    const p = h.getAttribute("position") as THREE.BufferAttribute;
    // (Normals are kept: the merged geometry is non-indexed, so recomputing would facet it.)
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -R * 0.8) p.setY(i, -R * 0.8 + (p.getY(i) + R * 0.8) * 0.3);
    k.addGeometry(h, new THREE.Matrix4().compose(v3(at[0], at[1] + R * 0.8, at[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rot ?? 0, yaw, 0)), v3(1, 1, 1)));
  }
}

export function buildRoundBale(variant: number): THREE.BufferGeometry {
  const v = mod(variant, ROUND_BALE_VARIANTS.length);
  const rng = createRng(`nature:bale-round:${variant}`);
  const k = new Kit();
  switch (ROUND_BALE_VARIANTS[v]) {
    case "single":
      roundBale(k, rng, [0, 0, 0], rng.range(-0.3, 0.3));
      break;
    case "pair":
      roundBale(k, rng, [-0.8, 0, 0], 0.1);
      roundBale(k, rng, [1.0, 0, 0.3], 0.3, { upright: true });
      break;
    case "silage wrapped":
      roundBale(k, rng, [0, 0, 0], 0.05, { wrapped: true });
      break;
    case "stacked three":
      roundBale(k, rng, [-0.78, 0, 0], 0);
      roundBale(k, rng, [0.78, 0, 0], 0);
      roundBale(k, rng, [0, 1.12, 0], 0.02);
      break;
    case "weathered":
      roundBale(k, rng, [0, -0.08, 0], 0.4, { rot: 0.05 });
      for (let i = 0; i < 14; i++) {
        const a = rng.range(0, TAU);
        k.add(blade(v3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.6), v3(Math.cos(a), 0, Math.sin(a)), rng.range(0.15, 0.3), 0.03, 0.9), { tone: "dark" });
      }
      break;
  }
  return k.build();
}

function squareBale(k: Kit, rng: Rng, at: [number, number, number], yaw: number, big = false, tilt = 0): void {
  const [L, Wd, H] = big ? [2.4, 1.2, 0.9] : [0.9, 0.46, 0.36];
  const body = new THREE.BoxGeometry(L, H, Wd, 4, 2, 2);
  // Slightly swollen sides: bales bulge between their strings.
  const p = body.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const bx = Math.abs(p.getX(i)) / (L / 2);
    const swell = 1 + 0.04 * (1 - bx * bx);
    p.setY(i, p.getY(i) * swell + rng.range(-0.004, 0.004));
    p.setZ(i, p.getZ(i) * swell);
  }
  body.computeVertexNormals();
  body.translate(0, H / 2, 0);
  const m = new THREE.Matrix4().compose(v3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, tilt)), v3(1, 1, 1));
  k.add(body, { tone: "pale", matrix: m });
  const strings = big ? 4 : 2;
  for (let i = 0; i < strings; i++) {
    const x = (i - (strings - 1) / 2) * (L / (strings + 0.6));
    const band = new THREE.BoxGeometry(0.025, H + 0.012, Wd + 0.012);
    band.translate(x, H / 2, 0);
    k.add(band, { tone: "solid", matrix: m });
  }
  // The pressed flakes: fine vertical seams across the long faces.
  const flake = big ? 0.2 : 0.1;
  for (let x = -L / 2 + flake; x < L / 2 - flake * 0.5; x += flake * rng.range(0.8, 1.2)) {
    for (const side of [1, -1]) {
      // A single quad per seam, just proud of the face.
      const seam = new THREE.PlaneGeometry(0.012, H * 0.94);
      if (side < 0) seam.rotateY(Math.PI);
      seam.translate(x, H / 2, side * (Wd / 2 * 1.04 + 0.004));
      k.add(seam, { tone: "mid", matrix: m });
    }
  }
}

export function buildSquareBale(variant: number): THREE.BufferGeometry {
  const v = mod(variant, SQUARE_BALE_VARIANTS.length);
  const rng = createRng(`nature:bale-square:${variant}`);
  const k = new Kit();
  switch (SQUARE_BALE_VARIANTS[v]) {
    case "single":
      squareBale(k, rng, [0, 0, 0], rng.range(-0.4, 0.4));
      break;
    case "small stack":
      for (let row = 0; row < 3; row++) {
        const n = 3 - row;
        for (let i = 0; i < n; i++) squareBale(k, rng, [(i - (n - 1) / 2) * 0.92, row * 0.37, 0], rng.range(-0.03, 0.03));
      }
      for (let i = 0; i < 2; i++) squareBale(k, rng, [(i - 0.5) * 0.92, 0, -0.48], rng.range(-0.03, 0.03));
      break;
    case "big squares":
      squareBale(k, rng, [0, 0, 0], 0, true);
      squareBale(k, rng, [0.1, 0.91, 0], 0.04, true);
      squareBale(k, rng, [0, 0, -1.25], 0, true);
      break;
    case "scattered":
      for (let i = 0; i < 4; i++) squareBale(k, rng, [rng.range(-2, 2), 0, rng.range(-1.5, 1.5)], rng.range(0, TAU));
      break;
  }
  return k.build();
}

// ---------------------------------------------------------------- fences

/** Square-sawn post with a weathered bevel top. */
function sawnPost(k: Kit, x: number, h: number, s: number, lean = 0, tone: "light" | "pale" | "mid" = "light"): void {
  const m = new THREE.Matrix4().compose(v3(x, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean * 0.6, 0, lean)), v3(1, 1, 1));
  k.add(boxAt([-s / 2, -0.15, -s / 2], [s / 2, h - s * 0.3, s / 2]), { tone, matrix: m });
  const cap = gable(s, s, s * 0.5, 0);
  cap.translate(0, h - s * 0.3, 0);
  k.add(cap, { tone, matrix: m });
}

function roundPost(k: Kit, x: number, h: number, r: number, lean: THREE.Vector2, tone: "light" | "pale" | "mid" = "light"): THREE.Matrix4 {
  const m = new THREE.Matrix4().compose(v3(x, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean.y, 0, lean.x)), v3(1, 1, 1));
  k.add(taperTube([v3(0, -0.15, 0), v3(0, h, 0)], r, r * 0.9, { radial: 6, segments: 1, gnarl: 0.06, cap: true }), { tone, matrix: m });
  return m;
}

export function buildRailFence(variant: number): THREE.BufferGeometry {
  const v = mod(variant, RAIL_FENCE_VARIANTS.length);
  const rng = createRng(`nature:fence-rail:${variant}`);
  const k = new Kit();
  const L = FENCE_TILE;
  const x0 = -L / 2;
  switch (RAIL_FENCE_VARIANTS[v]) {
    case "three-rail":
      sawnPost(k, x0, 1.35, 0.13);
      for (const y of [0.38, 0.76, 1.12]) k.add(boxAt([x0, y - 0.05, 0.065], [x0 + L, y + 0.05, 0.1]), { tone: "pale" });
      // A mid-span prick post steadies the rails.
      k.add(boxAt([-0.04, -0.1, 0.1], [0.04, 1.02, 0.16]), { tone: "light" });
      break;
    case "post and two rails":
      sawnPost(k, x0, 1.25, 0.16);
      for (const y of [0.45, 0.95]) {
        const rail = extrude([[0, -0.06], [0.05, -0.07], [0.06, 0.06], [-0.01, 0.07]], L);
        rail.rotateY(Math.PI / 2);
        k.add(rail, { tone: "pale", position: [0, y, 0] });
      }
      break;
    case "weathered": {
      sawnPost(k, x0, 1.3, 0.13, rng.range(-0.08, 0.08), "mid");
      k.add(boxAt([x0, 1.07, 0.065], [x0 + L, 1.17, 0.1]), { tone: "light", rotation: [0, 0, -0.012] });
      k.add(boxAt([x0, 0.71, 0.065], [x0 + L * 0.55, 0.8, 0.1]), { tone: "light" });
      // The broken rail hangs to the ground.
      const broken = boxAt([0, -0.05, 0], [L * 0.52, 0.05, 0.035]);
      broken.rotateZ(-0.3);
      k.add(broken, { tone: "light", position: [x0 + L * 0.45, 0.4, 0.07] });
      for (let i = 0; i < 8; i++) k.add(blade(v3(x0 + rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2)), v3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(), rng.range(0.3, 0.5), 0.03, 0.5), { tone: "solid" });
      break;
    }
    case "field gate": {
      // Hanging post at the segment start; five-bar gate with its brace.
      sawnPost(k, x0, 1.45, 0.2);
      const gx0 = x0 + 0.12;
      const gw = L - 0.2;
      const bars = [0.25, 0.47, 0.69, 0.91, 1.13];
      for (const y of bars) k.add(boxAt([gx0, y - 0.035, 0.0], [gx0 + gw, y + 0.035, 0.045]), { tone: "paper" });
      k.add(boxAt([gx0, 0.15, 0], [gx0 + 0.09, 1.2, 0.05]), { tone: "paper" });
      k.add(boxAt([gx0 + gw - 0.08, 0.15, 0], [gx0 + gw, 1.2, 0.05]), { tone: "paper" });
      const len = Math.hypot(gw - 0.1, 0.9);
      const brace = boxAt([0, -0.03, 0], [len, 0.03, 0.04]);
      brace.rotateZ(Math.atan2(0.9, gw - 0.1));
      k.add(brace, { tone: "paper", position: [gx0 + 0.06, 0.25, 0.045] });
      // Hinges and the latch.
      for (const y of [0.3, 1.05]) k.add(boxAt([x0 + 0.05, y - 0.02, 0.1], [gx0 + 0.3, y + 0.02, 0.12]), { tone: "solid" });
      k.add(boxAt([gx0 + gw - 0.2, 1.08, -0.02], [gx0 + gw + 0.06, 1.12, 0.07]), { tone: "solid" });
      break;
    }
  }
  return k.build();
}

export function buildBarbedFence(variant: number): THREE.BufferGeometry {
  const v = mod(variant, BARBED_FENCE_VARIANTS.length);
  const rng = createRng(`nature:fence-barbed:${variant}`);
  const k = new Kit();
  const L = FENCE_TILE;
  const x0 = -L / 2;
  const kind = BARBED_FENCE_VARIANTS[v]!;
  let heights = [0.3, 0.6, 0.9, 1.18];
  let postTop = 1.3;
  if (kind === "three strand, leaning") heights = [0.35, 0.72, 1.08];
  if (kind === "concrete, cranked") {
    heights = [0.25, 0.55, 0.85, 1.15, 1.45, 1.75];
    postTop = 1.9;
  }
  if (kind === "steel angle posts") {
    // L-section angle iron.
    const angle = extrude([[0, 0], [0.06, 0], [0.06, 0.008], [0.008, 0.008], [0.008, 0.06], [0, 0.06]], postTop + 0.2);
    angle.rotateX(-Math.PI / 2);
    k.add(angle, { tone: "dark", position: [x0 - 0.03, -0.2 + (postTop + 0.2) / 2, -0.03] });
  } else if (kind === "concrete, cranked") {
    k.add(boxAt([x0 - 0.06, -0.2, -0.06], [x0 + 0.06, postTop, 0.06]), { tone: "pale" });
    const arm = boxAt([-0.04, 0, -0.04], [0.04, 0.6, 0.04]);
    arm.rotateX(-0.6);
    k.add(arm, { tone: "pale", position: [x0, postTop - 0.02, 0] });
    for (const t of [0.35, 0.7, 1]) heights.push(postTop + 0.5 * t);
  } else {
    const lean = kind === "three strand, leaning" ? new THREE.Vector2(rng.range(-0.12, 0.12), rng.range(-0.08, 0.08)) : new THREE.Vector2(rng.range(-0.03, 0.03), rng.range(-0.03, 0.03));
    roundPost(k, x0, postTop, 0.065, lean, "light");
    // A stay post at alternate segments is left to the scatter's rhythm.
  }
  heights.forEach((y, i) => {
    const zOff = kind === "concrete, cranked" && y > postTop ? -(y - postTop) * 0.68 : 0.04;
    const a = v3(x0, y, zOff);
    const b = v3(x0 + L, y, zOff);
    if (kind === "snapped strand" && i === 1) {
      // Snapped: both ends curl down toward the grass.
      k.add(sagWire(a, v3(x0 + L * 0.4, 0.12, zOff + 0.2), 0.1, 0.007, 5), { tone: "solid" });
      k.add(sagWire(b, v3(x0 + L * 0.7, 0.2, zOff + 0.1), 0.08, 0.007, 5), { tone: "solid" });
      return;
    }
    const sag = kind === "snapped strand" ? 0.08 : 0.025;
    k.add(sagWire(a, b, sag, 0.007, 6), { tone: "solid" });
    // Barbs: two short crossed wires, every 25 cm (every 50 cm on tall security runs).
    for (let x = x0 + 0.12; x < x0 + L; x += heights.length > 5 ? 0.5 : 0.25) {
      const t = (x - x0) / L;
      const p = v3(x, y - sag * 4 * t * (1 - t), zOff);
      const d1 = v3(0.02, 0.03, 0.02);
      const d2 = v3(-0.02, 0.03, -0.02);
      k.add(rod(p.clone().sub(d1), p.clone().add(d1), 0.004, 3), { tone: "solid" });
      k.add(rod(p.clone().sub(d2), p.clone().add(d2), 0.004, 3), { tone: "solid" });
    }
  });
  return k.build();
}

export function buildWall(variant: number): THREE.BufferGeometry {
  const v = mod(variant, WALL_VARIANTS.length);
  const rng = createRng(`nature:wall:${variant}`);
  const k = new Kit();
  const L = FENCE_TILE;
  const kind = WALL_VARIANTS[v]!;
  const H = kind === "low wall" ? 0.85 : 1.2;
  const base = 0.72;
  const top = 0.44;
  const gap = kind === "tumbled gap" ? ([-0.25, 1.05] as const) : null;
  // Courses thin toward the top; big foundation stones at the foot.
  let y = 0;
  let course = 0;
  while (y < H - 0.1) {
    const ch = (course === 0 ? rng.range(0.24, 0.3) : rng.range(0.14, 0.24)) * (1 - (y / H) * 0.25);
    const t = (y + ch / 2) / H;
    const width = lerp(base, top, t);
    let x = -L / 2 - (course % 2 ? rng.range(0.05, 0.25) : 0);
    while (x < L / 2) {
      const len = Math.min(rng.range(0.28, 0.66) * (course === 0 ? 1.3 : 1), L / 2 - x + 0.03);
      const mid = x + len / 2;
      const broken = gap && mid > gap[0] && mid < gap[1] && y > 0.3 - (mid - gap[0]) * 0.12;
      if (!broken && len > 0.08) {
        // A small pinning stone now and then fills a course.
        const h = rng.chance(0.18) ? ch * 0.55 : ch;
        const g = rubble([len * 1.02, h * 1.02, width * rng.range(0.96, 1.0)], rng, 0.11);
        g.rotateZ(rng.range(-0.04, 0.04));
        k.add(g, { tone: rng.chance(0.12) ? "pale" : "paper", position: [mid, y + h / 2, rng.range(-0.006, 0.006)] });
        if (h < ch) k.add(rubble([len * 0.6, (ch - h) * 1.05, width * 0.9], rng, 0.2), { tone: "paper", position: [mid + rng.range(-0.08, 0.08), y + h + (ch - h) / 2, 0] });
      }
      x += len;
    }
    y += ch;
    course++;
  }
  // Copes: stones set on edge, tight together, leaning one way like books.
  const leanCope = rng.chance(0.5) ? 0.16 : -0.16;
  for (let x = -L / 2 + 0.05; x < L / 2; ) {
    const th = rng.range(0.11, 0.18);
    if (!(gap && x > gap[0] - 0.1 && x < gap[1] + 0.1)) {
      const h = rng.range(0.17, 0.25);
      const g = rubble([th, h, top * rng.range(0.9, 1.05)], rng, 0.2);
      g.rotateZ(leanCope + rng.range(-0.07, 0.07));
      k.add(g, { tone: rng.chance(0.2) ? "pale" : "paper", position: [x + th / 2, y + h / 2 - 0.02, 0] });
    }
    x += th + 0.005;
  }
  if (gap) {
    // Rubble spilled from the gap.
    for (let i = 0; i < 10; i++) {
      const s = rng.range(0.18, 0.36);
      const g = rubble([s, s * 0.55, s * 0.9], rng, 0.2);
      g.rotateY(rng.range(0, TAU));
      g.rotateX(rng.range(-0.3, 0.3));
      k.add(g, { tone: "paper", position: [rng.range(gap[0], gap[1]), rng.range(0.06, 0.22), rng.range(-0.5, 0.7)] });
    }
  }
  if (kind === "wall with stile") {
    // Through-stones projecting as steps on both faces.
    for (const [yy, x] of [
      [0.3, -0.3],
      [0.62, 0.05],
      [0.94, 0.4],
    ] as const) {
      k.add(rubble([0.24, 0.1, base + 0.7], rng, 0.1), { tone: "paper", position: [x, yy, 0] });
    }
  }
  // Grass at the foot of the wall.
  for (let i = 0; i < 12; i++) {
    const x = rng.range(-L / 2, L / 2);
    const z = (rng.chance(0.5) ? 1 : -1) * (base / 2 + rng.range(0, 0.08));
    k.add(blade(v3(x, 0, z), v3(rng.range(-0.5, 0.5), 0, Math.sign(z)).normalize(), rng.range(0.12, 0.26), 0.016, 0.5), { tone: i % 3 ? "solid" : "dark" });
  }
  return k.build();
}

// ------------------------------------------------------------- scarecrow

export function buildScarecrow(variant: number): THREE.BufferGeometry {
  const v = mod(variant, SCARECROW_VARIANTS.length);
  const rng = createRng(`nature:scarecrow:${variant}`);
  const k = new Kit();
  const kind = SCARECROW_VARIANTS[v]!;
  const lean = kind === "tattered" ? 0.12 : rng.range(-0.03, 0.03);
  const m = new THREE.Matrix4().makeRotationZ(lean);
  const add = (g: THREE.BufferGeometry, tone: Tone, pos: [number, number, number] = [0, 0, 0], accent?: "signal" | "amber") => {
    g.translate(...pos);
    k.add(g, { tone, matrix: m, accent });
  };
  add(taperTube([v3(0, -0.4, 0), v3(0, 2.05, 0)], 0.05, 0.04, { radial: 6, segments: 1 }), "light");
  add(taperTube([v3(-0.78, 1.55, 0), v3(0.78, 1.58, 0)], 0.035, 0.03, { radial: 5, segments: 1 }), "light");
  const coatTone = kind === "the pale one" ? "paper" : "mid";
  // Coat: a tapered body with a ragged hem.
  const coat = new THREE.CylinderGeometry(0.2, 0.3, 0.9, 10, 2, false);
  coat.scale(1.15, 1, 0.6);
  const cp = coat.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) < -0.4) cp.setY(i, cp.getY(i) - rng.range(0, kind === "tattered" ? 0.25 : 0.1));
  coat.computeVertexNormals();
  add(coat, coatTone, [0, 1.15, 0]);
  // Sleeves along the crossbar, drooping at the cuffs.
  for (const s of [-1, 1]) {
    const sleeve = taperTube([v3(s * 0.2, 1.52, 0), v3(s * 0.5, 1.5, 0.02), v3(s * 0.72, 1.44, 0)], 0.1, 0.085, { radial: 7, segments: 3 });
    add(sleeve, coatTone);
    // Straw out of the cuffs.
    for (let i = 0; i < 6; i++) {
      const d = v3(s, rng.range(-0.8, 0.2), rng.range(-0.5, 0.5)).normalize();
      add(taperTube([v3(s * 0.72, 1.44, 0), v3(s * 0.72, 1.44, 0).addScaledVector(d, rng.range(0.12, 0.22))], 0.012, 0.003, { radial: 3, segments: 1 }), "dark");
    }
  }
  if (kind !== "the pale one") {
    // Trousers hung below.
    for (const s of [-1, 1]) add(taperTube([v3(s * 0.1, 0.72, 0), v3(s * 0.12, 0.25, 0.02)], 0.08, 0.07, { radial: 6, segments: 1 }), "dark");
    for (let i = 0; i < 8; i++) {
      const s = i % 2 ? 1 : -1;
      const d = v3(rng.range(-0.3, 0.3), -1, rng.range(-0.3, 0.3)).normalize();
      add(taperTube([v3(s * 0.12, 0.25, 0), v3(s * 0.12, 0.25, 0).addScaledVector(d, rng.range(0.1, 0.18))], 0.012, 0.003, { radial: 3, segments: 1 }), "dark");
    }
  }
  // Head: a stuffed sack, tied at the neck.
  const head = blob(0.17, { detail: 1, lump: 0.12, stretch: [1, 1.1, 0.95] });
  add(head, "paper", [0, 1.83, 0]);
  add(cylinder(0.07, 0.08, 0.05, 8), "solid", [0, 1.66, 0]);
  if (kind !== "the pale one") {
    for (const s of [-1, 1]) add(blob(0.022, { detail: 3, stretch: [1, 1, 0.3] }), "solid", [s * 0.06, 1.87, 0.155]);
    add(boxAt([-0.06, -0.006, 0], [0.06, 0.006, 0.01]), "solid", [0, 1.77, 0.155]);
    // Hat: brim and crown.
    add(cylinder(0.27, 0.27, 0.02, 14), "deep", [0, 1.97, 0]);
    add(cylinder(0.13, 0.15, 0.16, 12), "solid", [0, 2.06, 0]);
  }
  if (kind === "tattered") {
    // A torn strip of coat flapping from one sleeve.
    add(boxAt([0, -0.35, 0], [0.12, 0, 0.01]), "mid", [0.5, 1.42, 0.08]);
  }
  return k.build();
}

// ------------------------------------------------------------------ well

export function buildWell(variant: number): THREE.BufferGeometry {
  const v = mod(variant, WELL_VARIANTS.length);
  const rng = createRng(`nature:well:${variant}`);
  const k = new Kit();
  const kind = WELL_VARIANTS[v]!;
  const R = 0.75;
  const inner = 0.52;
  const H = 0.8;
  const courses = 4;
  for (let c = 0; c < courses; c++) {
    const n = 12;
    const ch = H / courses;
    for (let i = 0; i < n; i++) {
      const a = ((i + (c % 2) * 0.5) / n) * TAU;
      const arc = (TAU / n) * (R + inner) * 0.5;
      const g = rubble([arc * 1.04, ch * 1.02, R - inner], rng, 0.14);
      g.rotateY(Math.PI / 2 - a + rng.range(-0.03, 0.03));
      k.add(g, { tone: rng.chance(0.12) ? "pale" : "paper", position: [Math.cos(a) * (R + inner) * 0.5, c * ch + ch / 2, Math.sin(a) * (R + inner) * 0.5] });
    }
  }
  // Coping ring and the black water far below.
  const cope = new THREE.LatheGeometry([new THREE.Vector2(inner - 0.03, 0), new THREE.Vector2(R + 0.05, 0), new THREE.Vector2(R + 0.05, 0.08), new THREE.Vector2(inner - 0.03, 0.08), new THREE.Vector2(inner - 0.03, 0)], 18);
  k.add(cope, { tone: "paper", position: [0, H, 0] });
  if (kind === "capped well with pump") {
    k.add(cylinder(inner + 0.02, inner + 0.02, 0.06, 16), { tone: "light", position: [0, H + 0.1, 0] });
    // A cast-iron hand pump.
    k.add(cylinder(0.08, 0.1, 1.1, 10), { tone: "dark", position: [0, H + 0.65, 0] });
    k.add(cylinder(0.11, 0.11, 0.08, 10), { tone: "dark", position: [0, H + 1.22, 0] });
    k.add(taperTube([v3(0, H + 0.9, 0.08), v3(0, H + 0.85, 0.3), v3(0, H + 0.72, 0.36)], 0.035, 0.03, { radial: 6, segments: 3 }), { tone: "dark" });
    k.add(taperTube([v3(0, H + 1.2, -0.08), v3(0, H + 1.35, -0.35), v3(0, H + 1.15, -0.75)], 0.025, 0.02, { radial: 5, segments: 3 }), { tone: "dark" });
    k.add(block(0.35, 0.18, 0.3), { tone: "paper", position: [0, 0, 0.9] });
  } else {
    k.add(cylinder(inner - 0.02, inner - 0.02, 0.02, 16), { tone: "solid", position: [0, H - 0.25, 0] });
    // Posts and windlass.
    const postH = kind === "roofed well" ? 2.05 : 1.55;
    for (const s of [-1, 1]) k.add(boxAt([-0.06, 0, -0.06], [0.06, postH, 0.06]), { tone: "light", position: [s * (R + 0.08), 0, 0] });
    k.add(cylinder(0.09, 0.09, 2 * R + 0.1, 10), { tone: "light", position: [0, 1.3, 0], rotation: [0, 0, Math.PI / 2] });
    for (let i = 0; i < 3; i++) k.add(cylinder(0.095, 0.095, 0.03, 10), { tone: "solid", position: [-0.25 + i * 0.12, 1.3, 0], rotation: [0, 0, Math.PI / 2] });
    // Crank handle.
    k.add(rod(v3(R + 0.1, 1.3, 0), v3(R + 0.3, 1.3, 0), 0.02, 4), { tone: "dark" });
    k.add(rod(v3(R + 0.3, 1.3, 0), v3(R + 0.3, 1.05, 0.05), 0.02, 4), { tone: "dark" });
    k.add(rod(v3(R + 0.3, 1.05, 0.05), v3(R + 0.45, 1.05, 0.05), 0.022, 4), { tone: "dark" });
    // Rope and bucket.
    k.add(rod(v3(0.05, 1.22, 0.09), v3(0.05, 0.98, 0.09), 0.008, 3), { tone: "solid" });
    k.add(cylinder(0.12, 0.09, 0.2, 10, true), { tone: "mid", position: [0.05, 0.88, 0.09] });
    k.add(rod(v3(-0.07, 0.98, 0.09), v3(0.17, 0.98, 0.09), 0.006, 3), { tone: "solid" });
    if (kind === "roofed well") {
      const roof = gable(2 * R + 0.35, 1.1, 0.6, 0.12);
      k.add(roof, { tone: "mid", position: [0, postH, 0] });
      k.add(boxAt([-R - 0.3, postH - 0.08, -0.05], [R + 0.3, postH, 0.05]), { tone: "light" });
    }
  }
  return k.build();
}

// ------------------------------------------------------------------ shed

/** Vertical board battens across a wall face (x from x0 to x1 at depth z, facing +z or -z). */
function battens(k: Kit, x0: number, x1: number, y0: number, y1: number | ((x: number) => number), z: number, dir: 1 | -1, rng: Rng, missing = 0): void {
  for (let x = x0 + 0.08; x < x1 - 0.04; x += 0.16) {
    if (missing && rng.chance(missing)) continue;
    const top = typeof y1 === "number" ? y1 : y1(x);
    k.add(boxAt([x - 0.015, y0, Math.min(z, z + dir * 0.025)], [x + 0.015, top, Math.max(z, z + dir * 0.025)]), { tone: "light" });
  }
}

function crescent(): THREE.BufferGeometry {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    pts.push([Math.cos(a) * 0.09, Math.sin(a) * 0.09]);
  }
  for (let i = 12; i >= 0; i--) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    pts.push([Math.cos(a) * 0.05 + 0.025, Math.sin(a) * 0.075]);
  }
  return extrude(pts, 0.012);
}

export function buildShed(variant: number): THREE.BufferGeometry {
  const v = mod(variant, SHED_VARIANTS.length);
  const rng = createRng(`nature:shed:${variant}`);
  const k = new Kit();
  const kind = SHED_VARIANTS[v]!;
  if (kind === "outhouse") {
    const W = 1.25,
      D = 1.3,
      Hf = 2.25,
      Hb = 1.95;
    // Box with a pent (single-pitch) top.
    k.add(extrude([[-D / 2, 0], [D / 2, 0], [D / 2, Hf], [-D / 2, Hb]], W), { tone: "paper", rotation: [0, -Math.PI / 2, 0] });
    battens(k, -W / 2, W / 2, 0, Hf - 0.05, D / 2, 1, rng);
    // Roof slab overhanging front and sides.
    const roof = boxAt([-W / 2 - 0.15, 0, -D / 2 - 0.12], [W / 2 + 0.15, 0.05, D / 2 + 0.22]);
    roof.rotateX(-Math.atan2(Hf - Hb, D));
    k.add(roof, { tone: "mid", position: [0, (Hf + Hb) / 2 + 0.02, 0] });
    // Door with Z-brace, the crescent moon, latch.
    k.add(boxAt([-0.36, 0.05, D / 2 + 0.025], [0.36, 1.95, D / 2 + 0.05]), { tone: "pale" });
    for (const y of [0.35, 1.6]) k.add(boxAt([-0.34, y, D / 2 + 0.05], [0.34, y + 0.1, D / 2 + 0.07]), { tone: "light" });
    const brace = boxAt([0, -0.05, 0], [1.45, 0.05, 0.02]);
    brace.rotateZ(Math.atan2(1.15, 0.6));
    k.add(brace, { tone: "light", position: [-0.3, 0.42, D / 2 + 0.05] });
    k.add(crescent(), { tone: "solid", position: [0, 1.75, D / 2 + 0.06] });
    k.add(boxAt([0.26, 1.0, D / 2 + 0.05], [0.32, 1.06, D / 2 + 0.1]), { tone: "solid" });
  } else if (kind === "garden shed" || kind === "derelict hut") {
    const derelict = kind === "derelict hut";
    const W = 2.4,
      D = 1.8,
      He = 1.95;
    k.add(block(W, He, D), { tone: "paper" });
    battens(k, -W / 2, W / 2, 0, He, D / 2, 1, rng, derelict ? 0.25 : 0);
    battens(k, -W / 2, W / 2, 0, He, -D / 2, -1, rng, derelict ? 0.25 : 0);
    const roof = gable(D, W, 0.55, 0.14);
    if (derelict) {
      // The ridge has sagged.
      const p = roof.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.3) p.setY(i, p.getY(i) - 0.22 * (1 - Math.abs(p.getZ(i)) / (W / 2 + 0.3)));
      roof.computeVertexNormals();
    }
    k.add(roof, { tone: "mid", position: [0, He, 0], rotation: [0, Math.PI / 2, 0] });
    // Door (ajar when derelict) and a four-pane window.
    const door = boxAt([0, 0.02, 0], [0.8, 1.85, 0.04]);
    if (derelict) door.rotateY(-0.7);
    k.add(door, { tone: "pale", position: [-0.95, 0, D / 2 + 0.03] });
    k.add(boxAt([-0.15, 0.02, D / 2 + 0.005], [0.65, 1.85, D / 2 + 0.02]), { tone: derelict ? "solid" : "pale" });
    k.add(boxAt([0.3, 1.0, D / 2 + 0.01], [1.0, 1.55, D / 2 + 0.03]), { tone: "deep" });
    k.add(boxAt([0.63, 1.0, D / 2 + 0.03], [0.67, 1.55, D / 2 + 0.05]), { tone: "paper" });
    k.add(boxAt([0.3, 1.26, D / 2 + 0.03], [1.0, 1.3, D / 2 + 0.05]), { tone: "paper" });
    if (derelict) {
      for (let i = 0; i < 16; i++) {
        const x = rng.range(-W / 2, W / 2);
        k.add(blade(v3(x, 0, D / 2 + 0.1), v3(rng.range(-0.5, 0.5), 0, 1).normalize(), rng.range(0.3, 0.6), 0.04, 0.4), { tone: "solid" });
      }
    }
  } else {
    // Field shelter: open-fronted, corrugated tin on timber posts.
    const W = 4.2,
      D = 2.6,
      Hf = 2.4,
      Hb = 1.9;
    for (const x of [-W / 2 + 0.08, 0, W / 2 - 0.08]) {
      k.add(boxAt([x - 0.08, 0, D / 2 - 0.16], [x + 0.08, Hf, D / 2]), { tone: "light" });
      k.add(boxAt([x - 0.08, 0, -D / 2], [x + 0.08, Hb, -D / 2 + 0.16]), { tone: "light" });
    }
    k.add(boxAt([-W / 2, 0, -D / 2], [W / 2, Hb, -D / 2 + 0.06]), { tone: "pale" });
    battens(k, -W / 2, W / 2, 0, Hb, -D / 2 + 0.06, 1, rng);
    for (const s of [-1, 1]) k.add(extrude([[-D / 2, 0], [D / 2, 0], [D / 2, Hf], [-D / 2, Hb]], 0.05), { tone: "pale", position: [s * (W / 2 - 0.03), 0, 0], rotation: [0, -Math.PI / 2, 0] });
    // Corrugated roof sheet.
    const corr = new THREE.PlaneGeometry(W + 0.3, D + 0.4, 36, 1);
    const p = corr.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 0.12) * Math.PI) * 0.025);
    corr.rotateX(-Math.PI / 2 - Math.atan2(Hf - Hb, D));
    corr.computeVertexNormals();
    k.add(corr, { tone: "light", position: [0, (Hf + Hb) / 2 + 0.05, 0] });
    // Dark interior, and a hay rack.
    k.add(boxAt([-W / 2 + 0.2, 0.9, -D / 2 + 0.1], [W / 2 - 0.2, 1.5, -D / 2 + 0.5]), { tone: "deep" });
  }
  return k.build();
}

