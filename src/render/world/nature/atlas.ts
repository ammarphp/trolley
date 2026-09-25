/**
 * The foliage atlas: leaf-mass silhouettes rasterised procedurally into one
 * alpha texture (no canvas, no DOM, deterministic). Foliage cards cut their
 * outline from it with `alphaMap` + `alphaTest`, so the pipeline's contour
 * pass draws a scalloped pen line around every leaf mass and the shadow pass
 * casts dappled shade. Solid parts (bark, stakes) sample the opaque cell.
 *
 * Layout: 8 x 4 cells of 128 px. Three reads the alpha map from the green
 * channel; all channels carry the mask.
 */
import * as THREE from "three";
import { createRng, type Rng } from "../../core/rng.ts";

export type CellKind = "broad" | "broadSparse" | "droop" | "droopSparse" | "upright" | "uprightSparse" | "curtain" | "curtainSparse" | "hedge" | "maize";

const COLS = 8;
const ROWS = 4;
const CELL = 128;
const W = COLS * CELL;
const H = ROWS * CELL;

/** Cell assignment (column-major fill order). The last cell is solid. */
const PLAN: CellKind[] = [
  "broad", "broad", "broad", "broad", "broad",
  "broadSparse", "broadSparse", "broadSparse", "broadSparse",
  "droop", "droop", "droop",
  "droopSparse", "droopSparse", "droopSparse",
  "upright", "upright", "upright", "upright",
  "uprightSparse", "uprightSparse",
  "curtain", "curtain", "curtain", "curtain",
  "curtainSparse", "curtainSparse",
  "hedge", "hedge", "hedge",
  "maize",
];

export interface Atlas {
  texture: THREE.DataTexture;
  /** uv rectangles [u0, v0, u1, v1] per kind. */
  cells: Record<CellKind, Array<[number, number, number, number]>>;
  /** A uv inside the opaque cell. */
  solid: [number, number];
}

type Prim =
  | { t: "c"; x: number; y: number; r: number; hole?: boolean }
  | { t: "k"; x0: number; y0: number; x1: number; y1: number; r0: number; r1: number };

function capsuleDist(px: number, py: number, p: Extract<Prim, { t: "k" }>): number {
  const dx = p.x1 - p.x0;
  const dy = p.y1 - p.y0;
  const l2 = dx * dx + dy * dy || 1e-9;
  let h = ((px - p.x0) * dx + (py - p.y0) * dy) / l2;
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const qx = px - (p.x0 + dx * h);
  const qy = py - (p.y0 + dy * h);
  return Math.sqrt(qx * qx + qy * qy) - (p.r0 + (p.r1 - p.r0) * h);
}

/**
 * Scalloped leaf mass: a core ringed by bumps, bumps larger and prouder on the
 * upper side, a flatter underside, and a few see-through holes.
 */
function massPrims(rng: Rng, cx: number, cy: number, R: number, bumps: number, holes: number, sx = 1, sy = 1): Prim[] {
  const out: Prim[] = [{ t: "c", x: cx, y: cy, r: R * 0.7 }];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 + rng.range(-0.22, 0.22);
    const upper = Math.sin(a);
    const d = R * rng.range(0.6, 0.84) * (upper < -0.3 ? 0.82 : 1);
    const r = R * rng.range(0.2, 0.33) * (upper < -0.3 ? 0.8 : 1);
    out.push({ t: "c", x: cx + Math.cos(a) * d * sx, y: cy + Math.sin(a) * d * sy, r });
  }
  for (let i = 0; i < Math.round(bumps * 0.5); i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = R * rng.range(0.2, 0.55);
    out.push({ t: "c", x: cx + Math.cos(a) * d * sx, y: cy + Math.sin(a) * d * sy, r: R * rng.range(0.22, 0.36) });
  }
  for (let i = 0; i < holes; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = R * rng.range(0.35, 0.6);
    out.push({ t: "c", x: cx + Math.cos(a) * d * sx, y: cy + Math.sin(a) * d * sy, r: R * rng.range(0.07, 0.11), hole: true });
  }
  return out;
}

/** A leaf: a pointed capsule from base (x, y) along angle a. */
function leaf(x: number, y: number, a: number, len: number, w: number): Prim {
  return { t: "k", x0: x, y0: y, x1: x + Math.cos(a) * len, y1: y + Math.sin(a) * len, r0: w, r1: w * 0.25 };
}

function cellPrims(kind: CellKind, rng: Rng): Prim[] {
  switch (kind) {
    case "broad": {
      const out = massPrims(rng, 0.5, 0.48, 0.3, rng.int(11, 14), rng.int(1, 3));
      // A side lobe or two breaks the round outline.
      for (let i = 0; i < rng.int(1, 2); i++) {
        const a = rng.range(-0.3, Math.PI + 0.3);
        out.push(...massPrims(rng, 0.5 + Math.cos(a) * 0.2, 0.48 + Math.sin(a) * 0.16, rng.range(0.13, 0.17), 8, 0));
      }
      return out;
    }
    case "hedge": {
      const out: Prim[] = [];
      for (let i = 0; i < 3; i++) out.push(...massPrims(rng, 0.22 + i * 0.28, rng.range(0.42, 0.56), rng.range(0.2, 0.25), 9, 1));
      return out;
    }
    case "broadSparse": {
      const out: Prim[] = [];
      const n = rng.int(3, 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
        const d = rng.range(0.14, 0.26);
        out.push(...massPrims(rng, 0.5 + Math.cos(a) * d, 0.5 + Math.sin(a) * d, rng.range(0.1, 0.15), 7, 0));
      }
      return out;
    }
    case "droop": {
      // Birch: light masses with a fringe of hanging, pointed leaves.
      const out: Prim[] = [];
      for (let sp = 0; sp < 3; sp++) {
        const cx = 0.3 + sp * 0.2 + rng.range(-0.04, 0.04);
        const cy = rng.range(0.55, 0.66);
        const R = rng.range(0.14, 0.18);
        out.push(...massPrims(rng, cx, cy, R, 8, 0, 1, 0.8));
        for (let i = 0; i < 7; i++) {
          const x = cx + (i / 6 - 0.5) * R * 2.1 + rng.range(-0.015, 0.015);
          const y = cy - R * rng.range(0.35, 0.6);
          out.push(leaf(x, y, -Math.PI / 2 + rng.range(-0.25, 0.25), rng.range(0.1, 0.2), rng.range(0.03, 0.04)));
        }
      }
      return out;
    }
    case "droopSparse": {
      // Autumn birch: a few tassels of pointed leaves, no mass.
      const out: Prim[] = [];
      const n = rng.int(3, 4);
      for (let t = 0; t < n; t++) {
        const cx = rng.range(0.25, 0.75);
        const cy = rng.range(0.45, 0.75);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.32 + rng.range(-0.1, 0.1);
          out.push(leaf(cx + (i - 2) * 0.025, cy, a, rng.range(0.1, 0.15), 0.035));
        }
      }
      return out;
    }
    case "upright":
    case "uprightSparse": {
      // Poplar: a flame-shaped mass, tufted at the rim, pointed at the top.
      const out: Prim[] = [];
      const flames = kind === "upright" ? 1 : 2;
      for (let f = 0; f < flames; f++) {
        const s = flames === 1 ? 1 : 0.55;
        const cx = flames === 1 ? 0.5 : 0.3 + f * 0.4;
        const cy = flames === 1 ? 0.44 : rng.range(0.35, 0.55);
        out.push(...massPrims(rng, cx, cy, 0.22 * s, 12, flames === 1 ? 1 : 0, 1, 1.55));
        // Upswept tufts on the shoulders and a leader tip.
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1;
          const y = cy + (0.05 + (i / 6) * 0.25) * s;
          out.push(leaf(cx + side * 0.17 * s * (1 - i / 8), y, Math.PI / 2 - side * 0.45, 0.1 * s, 0.035 * s));
        }
        out.push(leaf(cx, cy + 0.3 * s, Math.PI / 2, 0.14 * s, 0.045 * s));
      }
      return out;
    }
    case "curtain": {
      // Willow in full leaf: a solid upper curtain that splits, lower down,
      // into a few broad strands with ragged, uneven ends.
      const out: Prim[] = [];
      for (let x = 0.06; x <= 0.95; x += rng.range(0.07, 0.1)) out.push({ t: "c", x, y: rng.range(0.84, 0.9), r: rng.range(0.06, 0.08) });
      out.push({ t: "k", x0: 0.1, y0: 0.72, x1: 0.9, y1: 0.72, r0: 0.16, r1: 0.16 });
      const n = rng.int(5, 6);
      for (let i = 0; i < n; i++) {
        const x = 0.1 + (i / (n - 1)) * 0.8 + rng.range(-0.03, 0.03);
        const end = rng.range(0.05, 0.4);
        const drift = rng.range(-0.04, 0.04);
        out.push({ t: "k", x0: x, y0: 0.7, x1: x + drift, y1: end, r0: rng.range(0.07, 0.09), r1: 0.018 });
        // A few leaves breaking the strand's edge.
        for (let y = 0.52; y > end + 0.08; y -= rng.range(0.1, 0.15)) {
          const t = (0.7 - y) / (0.7 - end);
          const side = rng.chance(0.5) ? 1 : -1;
          out.push(leaf(x + drift * t + side * 0.05, y, -Math.PI / 2 + side * 0.5, 0.07, 0.025));
        }
      }
      // A slit or two where the curtain parts.
      for (let i = 0; i < 2; i++) out.push({ t: "c", x: rng.range(0.25, 0.75), y: rng.range(0.55, 0.62), r: 0.025, hole: true });
      return out;
    }
    case "maize": {
      // A stand of maize: upright stalks, arching strap leaves, tassels.
      const out: Prim[] = [];
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = 0.14 + (i / (n - 1)) * 0.72 + rng.range(-0.03, 0.03);
        const top = rng.range(0.8, 0.9);
        out.push({ t: "k", x0: x, y0: 0.05, x1: x + rng.range(-0.01, 0.01), y1: top, r0: 0.014, r1: 0.008 });
        for (let j = 0; j < 6; j++) {
          const y = 0.18 + (j / 6) * (top - 0.3) + rng.range(-0.02, 0.02);
          const side = j % 2 ? 1 : -1;
          const len = rng.range(0.14, 0.2);
          const mx = x + side * len * 0.55;
          const my = y + len * 0.3;
          out.push({ t: "k", x0: x, y0: y, x1: mx, y1: my, r0: 0.02, r1: 0.016 });
          out.push({ t: "k", x0: mx, y0: my, x1: mx + side * len * 0.45, y1: my - len * 0.35, r0: 0.016, r1: 0.004 });
        }
        // The tassel.
        for (let t = -1; t <= 1; t++) out.push({ t: "k", x0: x, y0: top, x1: x + t * 0.035, y1: top + 0.08, r0: 0.007, r1: 0.003 });
        // A cob in its husk.
        if (rng.chance(0.7)) out.push({ t: "k", x0: x + 0.01, y0: 0.42, x1: x + 0.045, y1: 0.55, r0: 0.022, r1: 0.008 });
      }
      return out;
    }
    case "curtainSparse": {
      // Willow in autumn: thin strands with a few leaves, mostly air.
      const out: Prim[] = [];
      const n = rng.int(5, 6);
      for (let i = 0; i < n; i++) {
        const x = 0.1 + (i / (n - 1)) * 0.8 + rng.range(-0.025, 0.025);
        const end = rng.range(0.1, 0.55);
        const drift = rng.range(-0.05, 0.05);
        out.push({ t: "k", x0: x, y0: 0.9, x1: x + drift, y1: end, r0: 0.048, r1: 0.016 });
        for (let y = 0.8; y > end + 0.1; y -= rng.range(0.1, 0.16)) {
          const t = (0.9 - y) / (0.9 - end);
          const side = rng.chance(0.5) ? 1 : -1;
          out.push(leaf(x + drift * t, y, -Math.PI / 2 + side * 0.55, 0.08, 0.03));
        }
      }
      return out;
    }
  }
}

function coverage(prims: Prim[], hasHoles: boolean, x: number, y: number, aa: number): number {
  let solid = 0;
  let hole = 0;
  for (const p of prims) {
    const d = p.t === "c" ? Math.hypot(x - p.x, y - p.y) - p.r : capsuleDist(x, y, p);
    const c = d <= -aa ? 1 : d >= aa ? 0 : 0.5 - d / (2 * aa);
    if (p.t === "c" && p.hole) hole = Math.max(hole, c);
    else solid = Math.max(solid, c);
    if (solid >= 1 && !hasHoles) return 1;
  }
  return Math.max(0, solid - hole);
}

let atlas: Atlas | null = null;

export function foliageAtlas(): Atlas {
  if (atlas) return atlas;
  const data = new Uint8Array(W * H * 4);
  const cells = {} as Atlas["cells"];
  const rng = createRng("nature:atlas");
  const aa = 1.2 / CELL;
  const total = COLS * ROWS;
  for (let i = 0; i < total; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const u0 = col / COLS;
    const v0 = row / ROWS;
    const rect: [number, number, number, number] = [u0, v0, u0 + 1 / COLS, v0 + 1 / ROWS];
    const kind = PLAN[i];
    const prims = kind ? cellPrims(kind, rng.fork(`cell${i}`)) : null;
    const hasHoles = !!prims?.some((q) => q.t === "c" && q.hole);
    if (kind) (cells[kind] ??= []).push(rect);
    for (let py = 0; py < CELL; py++) {
      for (let px = 0; px < CELL; px++) {
        const x = (px + 0.5) / CELL;
        const y = (py + 0.5) / CELL;
        let v = 1;
        if (prims) {
          // Keep an 8 px gutter so mip levels do not bleed between cells.
          const edge = Math.min(x, y, 1 - x, 1 - y);
          v = edge < 0.05 ? 0 : coverage(prims, hasHoles, x, y, aa);
        }
        const o = ((row * CELL + py) * W + col * CELL + px) * 4;
        const b = Math.round(v * 255);
        data[o] = b;
        data[o + 1] = b;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
    }
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  texture.name = "nature-foliage-atlas";
  const lastCol = (total - 1) % COLS;
  const lastRow = Math.floor((total - 1) / COLS);
  atlas = { texture, cells, solid: [(lastCol + 0.5) / COLS, (lastRow + 0.5) / ROWS] };
  return atlas;
}
