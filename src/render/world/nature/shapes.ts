/**
 * Shared geometry for the nature kit: tapered limbs, foliage clumps, faceted
 * stones, blades. Everything returns plain position/normal geometry that the
 * core `Kit` paints and merges into one scatter geometry.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createNoise } from "../../core/noise.ts";
import type { Rng } from "../../core/rng.ts";

export const TAU = Math.PI * 2;
export const UP = new THREE.Vector3(0, 1, 0);

const NOISE = createNoise("nature-kit");

export const v3 = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Unit vector from an azimuth (around +Y, 0 = +X) and an angle from vertical. */
export function dirFrom(azimuth: number, fromVertical: number): THREE.Vector3 {
  const s = Math.sin(fromVertical);
  return new THREE.Vector3(Math.cos(azimuth) * s, Math.cos(fromVertical), Math.sin(azimuth) * s);
}

/** A random unit vector. */
export function randomUnit(rng: Rng): THREE.Vector3 {
  const u = rng.range(-1, 1);
  const a = rng.range(0, TAU);
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s);
}

export interface TubeOptions {
  radial?: number;
  segments?: number;
  /** Taper exponent (1 = linear). */
  power?: number;
  /** Root flare: extra radius near t = 0 (fraction of r0). */
  flare?: number;
  /** Close the far end with a flat cap (cut or broken limbs). */
  cap?: boolean;
  /** Bark roughness: radial noise amplitude as a fraction of radius. */
  gnarl?: number;
  seed?: number;
}

/**
 * A tapered tube along a Catmull-Rom curve through `points`, radius r0 at the
 * start to r1 at the end, with analytic normals (smooth bark shading).
 */
export function taperTube(points: THREE.Vector3[], r0: number, r1: number, opts: TubeOptions = {}): THREE.BufferGeometry {
  const radial = Math.max(3, opts.radial ?? 5);
  const segs = Math.max(1, opts.segments ?? Math.max(1, (points.length - 1) * 2));
  const power = opts.power ?? 1;
  const flare = opts.flare ?? 0;
  const gnarl = opts.gnarl ?? 0;
  const seed = opts.seed ?? 0;
  const curve: THREE.Curve<THREE.Vector3> =
    points.length > 2
      ? new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5)
      : new THREE.LineCurve3(points[0]!.clone(), points[points.length - 1]!.clone());
  const frames = curve.computeFrenetFrames(segs, false);
  const ring = radial;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    let r = r0 + (r1 - r0) * Math.pow(t, power);
    if (flare > 0) r += r0 * flare * Math.pow(1 - t, 7);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * TAU + seed * 0.37;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = c * N.x + s * B.x;
      const ny = c * N.y + s * B.y;
      const nz = c * N.z + s * B.z;
      let rr = r;
      if (gnarl > 0) rr *= 1 + gnarl * NOISE.n3(P.x * 1.7 + nx * 0.6 + seed, P.y * 1.7 + ny * 0.6, P.z * 1.7 + nz * 0.6);
      pos.push(P.x + rr * nx, P.y + rr * ny, P.z + rr * nz);
      nrm.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      const c = (i + 1) * ring + j;
      const d = (i + 1) * ring + ((j + 1) % ring);
      idx.push(a, b, d, a, d, c);
    }
  }
  if (opts.cap) {
    const T = curve.getTangentAt(1);
    const end = curve.getPointAt(1);
    const centre = pos.length / 3;
    pos.push(end.x, end.y, end.z);
    nrm.push(T.x, T.y, T.z);
    const base = segs * ring;
    for (let j = 0; j < ring; j++) idx.push(base + j, base + ((j + 1) % ring), centre);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export interface BlobOptions {
  /** 0 = octahedron(1) 32 tris, 1 = icosahedron(1) 80 tris, 2 = icosahedron(2) 180 tris, 3 = icosahedron(0) 20 tris, 4 = octahedron(0) 8 tris. */
  detail?: 0 | 1 | 2 | 3 | 4;
  /** Low-frequency lumpiness (fraction of radius). */
  lump?: number;
  /** Frequency of the lumps on the unit sphere. */
  freq?: number;
  /** Underside squash: y < 0 is multiplied by this (foliage clumps sit flat). */
  flatBottom?: number;
  /** Top squash: y > 0 multiplied by this. */
  flatTop?: number;
  stretch?: [number, number, number];
  seed?: number;
  /** Scalloping: alternate vertices pushed in/out for a leafy, bitten outline. */
  scallop?: number;
}

/**
 * A lumpy, smooth-shaded volume: foliage clumps, bushes, bales of straw.
 * Radius is the nominal radius before stretch.
 */
export function blob(r: number, opts: BlobOptions = {}): THREE.BufferGeometry {
  const detail = opts.detail ?? 1;
  let g: THREE.BufferGeometry =
    detail === 0
      ? new THREE.OctahedronGeometry(1, 1)
      : detail === 3
        ? new THREE.IcosahedronGeometry(1, 0)
        : detail === 4
          ? new THREE.OctahedronGeometry(1, 0)
          : new THREE.IcosahedronGeometry(1, detail === 2 ? 2 : 1);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-4);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const lump = opts.lump ?? 0.18;
  const freq = opts.freq ?? 1.3;
  const seed = opts.seed ?? 0;
  const fb = opts.flatBottom ?? 1;
  const ft = opts.flatTop ?? 1;
  const [sx, sy, sz] = opts.stretch ?? [1, 1, 1];
  const scallop = opts.scallop ?? 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let d = 1 + lump * NOISE.n3(v.x * freq + seed * 3.17, v.y * freq + seed * 1.31, v.z * freq - seed * 2.07);
    if (scallop > 0) d += scallop * (NOISE.n3(v.x * 4.1 + seed, v.y * 4.1, v.z * 4.1 - seed) > 0 ? 1 : -0.6);
    v.multiplyScalar(d * r);
    if (v.y < 0) v.y *= fb;
    else v.y *= ft;
    v.set(v.x * sx, v.y * sy, v.z * sz);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A faceted stone: displaced icosahedron, cut by a few planes into flat
 * cleavage faces, bottom sunk flat. Flat-shaded so every facet takes its own
 * hatch density like an engraved rock.
 */
export function stone(size: [number, number, number], rng: Rng, opts: { cuts?: number; detail?: 1 | 2; lump?: number; sink?: number } = {}): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, opts.detail ?? 1);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-4);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const seed = rng.range(0, 100);
  const lump = opts.lump ?? 0.22;
  const v = new THREE.Vector3();
  const cuts: Array<{ n: THREE.Vector3; d: number }> = [];
  const nc = opts.cuts ?? 3;
  for (let i = 0; i < nc; i++) {
    const n = randomUnit(rng);
    n.y = Math.abs(n.y) * 0.8 + 0.1; // cleavage faces lean upward: they catch light
    n.normalize();
    cuts.push({ n, d: rng.range(0.55, 0.8) });
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const d = 1 + lump * NOISE.n3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4 - seed);
    v.multiplyScalar(d);
    for (const c of cuts) {
      const k = v.dot(c.n);
      if (k > c.d) v.addScaledVector(c.n, c.d - k);
    }
    pos.setXYZ(i, v.x * size[0] * 0.5, v.y * size[1] * 0.5, v.z * size[2] * 0.5);
  }
  // Sit on the ground: flatten the underside and sink slightly.
  const sink = opts.sink ?? 0.18;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + size[1] * 0.5 * (1 - sink * 2);
    if (y < 0) y *= 0.25;
    pos.setY(i, y);
  }
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/**
 * A dressed rubble stone: a box whose eight corners are pulled in and pushed
 * about, so faces tilt a little (each takes its own hatch density) and edges
 * read as chamfered, hand-split stone rather than brick. 12 flat triangles.
 */
export function rubble(size: [number, number, number], rng: Rng, rough = 0.14): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-4);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  // Corners move in the face plane (x, y) far more than in depth, so the
  // exposed face stays close to planar: one hatch patch per stone, crisp edges.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * (1 - rng.range(0, rough * 1.3));
    const y = pos.getY(i) * (1 - rng.range(0, rough));
    const z = pos.getZ(i) * (1 - rng.range(0, rough * 0.15));
    pos.setXYZ(i, x * size[0], y * size[1], z * size[2]);
  }
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/**
 * A single grass blade: a tapered, bent strip (3 triangles) from `base`
 * leaning toward `lean` (unit horizontal direction), height h.
 */
export function blade(base: THREE.Vector3, lean: THREE.Vector3, h: number, w: number, bend: number): THREE.BufferGeometry {
  const side = new THREE.Vector3(-lean.z, 0, lean.x).normalize();
  const p = (t: number, s: number): THREE.Vector3 => {
    const y = h * t;
    const off = bend * h * t * t;
    const width = w * (1 - t * 0.85);
    return base.clone().addScaledVector(lean, off).add(new THREE.Vector3(0, y * (1 - bend * 0.35 * t), 0)).addScaledVector(side, (s * width) / 2);
  };
  const a0 = p(0, -1),
    a1 = p(0, 1),
    b0 = p(0.55, -1),
    b1 = p(0.55, 1),
    tip = p(1, 0);
  const verts = [a0, a1, b1, a0, b1, b0, b0, b1, tip];
  const arr = new Float32Array(verts.length * 3);
  verts.forEach((q, i) => arr.set([q.x, q.y, q.z], i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

/** A flat triangle fan (leaf, petal, blade) given explicit vertices, double-sided by material. */
export function polygon(points: THREE.Vector3[]): THREE.BufferGeometry {
  const arr: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    for (const q of [points[0]!, points[i]!, points[i + 1]!]) arr.push(q.x, q.y, q.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

/** A thin straight rod (wire, twine, stake) between two points. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, radial = 4): THREE.BufferGeometry {
  return taperTube([a, b], r, r, { radial, segments: 1 });
}

/** A sagging wire (catenary-ish) between two points, as a thin tube. */
export function sagWire(a: THREE.Vector3, b: THREE.Vector3, sag: number, r: number, segments = 6): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return taperTube(pts, r, r, { radial: 3, segments });
}

/** Box from min/max corners (axis aligned). */
export function boxAt(min: [number, number, number], max: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  g.translate((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2);
  return g;
}

/** Matrix aligning +Y to a direction, positioned at p. */
export function alignY(p: THREE.Vector3, dir: THREE.Vector3, spin = 0): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
}

/** Stats helper for reports and budgets. */
export function triangleCount(g: THREE.BufferGeometry): number {
  return g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
}

export { NOISE };
