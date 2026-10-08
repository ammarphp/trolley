/**
 * Coat atlases: one inked canvas per species holding every seeded coat as a
 * cell (Holstein patches, collie saddles, dapples, fleece curls, feather
 * scallops, drought ribs). Lofted surfaces map (s, v) into a cell's body,
 * neck and head regions, so markings follow the anatomy with crisp pen
 * edges at any mesh resolution. Painted black becomes ink; white leaves the
 * surface to the lighting and the vertex tone.
 *
 * The canvas is painted lazily the first time a species is built, and never
 * uses global randomness: every mark comes from a seeded Rng.
 */
import * as THREE from "three";
import type { AnimalId } from "../../api.ts";
import { createInkCanvas } from "../../core/ink-material.ts";
import { createNoise, type Noise } from "../../core/noise.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import type { UvRect } from "./skin.ts";

export const CELL = 256;
const COLS = 4;

export interface CoatCell {
  body: UvRect;
  neck: UvRect;
  head: UvRect;
  /** Spare strip for ears, wings, tails. */
  extra: UvRect;
}

export interface SpeciesAtlas {
  texture: THREE.Texture | null;
  /** Cell for coat `variant`, healthy or drought-thin. */
  cell(variant: number, thin: boolean): CoatCell;
  variants: number;
  blank: [number, number];
}

/** Pixel rectangle inside the canvas. */
export interface Px {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Painter context for one cell. */
export interface Paint {
  g: CanvasRenderingContext2D;
  rng: Rng;
  noise: Noise;
  variant: number;
  thin: boolean;
  body: Px;
  neck: Px;
  head: Px;
  extra: Px;
}

type Painter = (p: Paint) => void;

interface SpeciesCoats {
  variants: number;
  thin: boolean;
  painter: Painter;
}

const REGISTRY = new Map<AnimalId, SpeciesCoats>();
const CACHE = new Map<AnimalId, SpeciesAtlas>();

export function registerCoats(species: AnimalId, def: SpeciesCoats): void {
  REGISTRY.set(species, def);
}

function layout(ci: number, W: number, H: number): { px: { body: Px; neck: Px; head: Px; extra: Px }; uv: CoatCell } {
  const cx = (ci % COLS) * CELL;
  const cy = Math.floor(ci / COLS) * CELL;
  const pad = 6;
  const body: Px = { x0: cx + pad, y0: cy + pad, x1: cx + 168, y1: cy + CELL - pad };
  const neck: Px = { x0: cx + 174, y0: cy + pad, x1: cx + 208, y1: cy + CELL - pad };
  const head: Px = { x0: cx + 214, y0: cy + pad, x1: cx + CELL - pad, y1: cy + 196 };
  const extra: Px = { x0: cx + 214, y0: cy + 202, x1: cx + CELL - pad, y1: cy + CELL - pad };
  const toUv = (r: Px): UvRect => ({ u0: r.x0 / W, u1: r.x1 / W, v0: 1 - r.y0 / H, v1: 1 - r.y1 / H });
  return { px: { body, neck, head, extra }, uv: { body: toUv(body), neck: toUv(neck), head: toUv(head), extra: toUv(extra) } };
}

export function speciesAtlas(species: AnimalId): SpeciesAtlas {
  const hit = CACHE.get(species);
  if (hit) return hit;
  const def = REGISTRY.get(species) ?? { variants: 1, thin: false, painter: () => {} };
  const cellsNeeded = 1 + def.variants * (def.thin ? 2 : 1);
  const rows = Math.ceil(cellsNeeded / COLS);
  const W = COLS * CELL;
  const H = rows * CELL;
  const blank: [number, number] = [(CELL * 0.5) / W, 1 - (CELL * 0.5) / H];
  const cellIndex = (variant: number, thin: boolean) => 1 + (variant % def.variants) * (def.thin ? 2 : 1) + (def.thin && thin ? 1 : 0);
  let texture: THREE.Texture | null = null;
  if (typeof document !== "undefined") {
    const { ctx: g, texture: tex } = createInkCanvas(W, H);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    for (let v = 0; v < def.variants; v++) {
      for (const thin of def.thin ? [false, true] : [false]) {
        const ci = cellIndex(v, thin);
        const { px } = layout(ci, W, H);
        g.save();
        g.beginPath();
        g.rect((ci % COLS) * CELL, Math.floor(ci / COLS) * CELL, CELL, CELL);
        g.clip();
        def.painter({
          g,
          rng: createRng(`coat:${species}:${v}`),
          noise: createNoise(`coat:${species}:${v}`),
          variant: v,
          thin,
          ...px,
        });
        g.restore();
      }
    }
    tex.needsUpdate = true;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    tex.name = `coat:${species}`;
    texture = tex;
  }
  const atlas: SpeciesAtlas = {
    texture,
    variants: def.variants,
    blank,
    cell: (variant, thin) => layout(cellIndex(variant, thin), W, H).uv,
  };
  CACHE.set(species, atlas);
  return atlas;
}

// ------------------------------------------------------------ paint helpers

/** Canvas point for region-normalised (s, v). */
export function at(r: Px, s: number, v: number): [number, number] {
  return [r.x0 + s * (r.x1 - r.x0), r.y0 + v * (r.y1 - r.y0)];
}

/**
 * Rasterise a thresholded scalar field into a region: ink where f(s, v) > 0,
 * with a soft pen edge. The field is sampled on a coarse grid and bilinearly
 * upsampled so edges stay smooth and painting stays fast.
 */
export function fieldFill(g: CanvasRenderingContext2D, r: Px, f: (s: number, v: number) => number, opts: { grid?: number; edge?: number; ink?: number } = {}): void {
  const gw = opts.grid ?? 48;
  const gh = Math.round(gw * ((r.y1 - r.y0) / Math.max(1, r.x1 - r.x0)));
  const vals = new Float32Array((gw + 1) * (gh + 1));
  for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) vals[j * (gw + 1) + i] = f(i / gw, j / gh);
  const x0 = Math.floor(r.x0),
    y0 = Math.floor(r.y0);
  const w = Math.ceil(r.x1) - x0,
    h = Math.ceil(r.y1) - y0;
  if (w <= 0 || h <= 0) return;
  const img = g.getImageData(x0, y0, w, h);
  const d = img.data;
  const edge = opts.edge ?? 0.035;
  const ink = opts.ink ?? 1;
  for (let y = 0; y < h; y++) {
    const fy = (y / Math.max(1, h - 1)) * gh;
    const j = Math.min(gh - 1, Math.floor(fy));
    const ty = fy - j;
    for (let x = 0; x < w; x++) {
      const fx = (x / Math.max(1, w - 1)) * gw;
      const i = Math.min(gw - 1, Math.floor(fx));
      const tx = fx - i;
      const a = vals[j * (gw + 1) + i]!,
        b = vals[j * (gw + 1) + i + 1]!,
        c = vals[(j + 1) * (gw + 1) + i]!,
        e = vals[(j + 1) * (gw + 1) + i + 1]!;
      const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
      const cov = Math.min(1, Math.max(0, (v + edge) / (2 * edge))) * ink;
      if (cov <= 0) continue;
      const k = (y * w + x) * 4;
      const val = d[k]! * (1 - cov);
      d[k] = val;
      d[k + 1] = val;
      d[k + 2] = val;
    }
  }
  g.putImageData(img, x0, y0);
}

/** Threshold that leaves `coverage` of the samples above it. */
export function quantile(f: (s: number, v: number) => number, coverage: number, n = 40): number {
  const vals: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) vals.push(f(i / n, j / n));
  vals.sort((a, b) => a - b);
  return vals[Math.min(vals.length - 1, Math.max(0, Math.floor((1 - coverage) * vals.length)))]!;
}

/** Seamless fbm around the body: (s along, v around) on a cylinder. */
export function wrapNoise(noise: Noise, s: number, v: number, lengthM: number, radiusM: number, freq: number, octaves = 3, offset = 0): number {
  const th = v * Math.PI * 2;
  const x = s * lengthM * freq + offset;
  const y = Math.cos(th) * radiusM * freq;
  const z = Math.sin(th) * radiusM * freq;
  let sum = 0,
    amp = 1,
    norm = 0,
    f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise.n3(x * f, y * f + o * 17.3, z * f - o * 9.1);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Stroke a polyline of region-normalised points. */
export function stroke(g: CanvasRenderingContext2D, r: Px, pts: Array<[number, number]>, width: number, alpha = 1, smooth = true): void {
  if (pts.length < 2) return;
  g.save();
  g.strokeStyle = `rgba(0,0,0,${alpha})`;
  g.lineWidth = width;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  const P = pts.map(([s, v]) => at(r, s, v));
  g.moveTo(P[0]![0], P[0]![1]);
  if (smooth && P.length > 2) {
    for (let i = 1; i < P.length - 1; i++) {
      const mx = (P[i]![0] + P[i + 1]![0]) / 2;
      const my = (P[i]![1] + P[i + 1]![1]) / 2;
      g.quadraticCurveTo(P[i]![0], P[i]![1], mx, my);
    }
    g.lineTo(P[P.length - 1]![0], P[P.length - 1]![1]);
  } else for (let i = 1; i < P.length; i++) g.lineTo(P[i]![0], P[i]![1]);
  g.stroke();
  g.restore();
}

/** Filled ellipse in region-normalised coordinates. */
export function spot(g: CanvasRenderingContext2D, r: Px, s: number, v: number, rs: number, rv: number, alpha = 1, rot = 0): void {
  const [x, y] = at(r, s, v);
  g.save();
  g.fillStyle = `rgba(0,0,0,${alpha})`;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.5, rs * (r.x1 - r.x0)), Math.max(0.5, rv * (r.y1 - r.y0)), rot, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Fill a whole region with a grey (0 = paper, 1 = ink). */
export function wash(g: CanvasRenderingContext2D, r: Px, tone: number): void {
  const c = Math.round(255 * (1 - tone));
  g.fillStyle = `rgb(${c},${c},${c})`;
  g.fillRect(r.x0 - 3, r.y0 - 3, r.x1 - r.x0 + 6, r.y1 - r.y0 + 6);
}

/**
 * Ribs and bony landmarks for drought-thin animals, drawn as an engraver
 * would: curved strokes slanting back and down across the barrel on both
 * sides, with a lighter shadow stroke behind each.
 */
export function ribs(g: CanvasRenderingContext2D, r: Px, opts: { s0: number; s1: number; count: number; vTop: number; vBot: number; slant: number; width?: number; alpha?: number }): void {
  const w = opts.width ?? 1.8;
  for (let i = 0; i < opts.count; i++) {
    const s = opts.s0 + ((opts.s1 - opts.s0) * i) / Math.max(1, opts.count - 1);
    const bow = 0.012 * Math.sin((i / opts.count) * Math.PI);
    for (const side of [0, 1]) {
      const vv = (v: number) => (side ? v : 1 - v);
      const pts: Array<[number, number]> = [
        [s, vv(opts.vTop)],
        [s - opts.slant * 0.45 + bow, vv((opts.vTop + opts.vBot) / 2)],
        [s - opts.slant, vv(opts.vBot)],
      ];
      stroke(g, r, pts, w, opts.alpha ?? 0.75);
      stroke(
        g,
        r,
        pts.map(([a, b]) => [a - 0.012, b] as [number, number]),
        w * 0.6,
        (opts.alpha ?? 0.75) * 0.45,
      );
    }
  }
}
