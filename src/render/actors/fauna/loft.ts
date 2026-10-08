/**
 * Lofted anatomy. Bodies, necks, heads, limbs and tails are surfaces swept
 * along a path with a varying superelliptic cross-section, the way an
 * illustrator builds a figure from gesture line and contour. Sections are
 * keyed along the path and interpolated with a monotone cubic, so profiles
 * (top line, belly line, width) stay smooth without overshoot. Radial bumps
 * add hip bones, ribs, shoulder blades and hollows.
 *
 * The result is plain arrays: the skin builder assigns bones, tones and UVs.
 */
import * as THREE from "three";

/** One cross-section, in the frame (N = "up" of the section, B = side). */
export interface Section {
  /** Half width along B. */
  w: number;
  /** Extent toward +N. */
  up: number;
  /** Extent toward -N. */
  down: number;
  /** Superellipse exponent of the +N half (2 = ellipse, > 2 boxier, < 2 keeled). */
  eUp: number;
  /** Superellipse exponent of the -N half. */
  eDown: number;
  /** Centre offset along N. */
  dn: number;
  /** Centre offset along B. */
  db: number;
}

export type SectionKey = [s: number, w: number, up: number, down: number, eUp?: number, eDown?: number, dn?: number];

export interface LoftSpec {
  /** Control points of the gesture line (smoothed by a centripetal Catmull-Rom). */
  path: Array<THREE.Vector3 | [number, number, number]>;
  /** Ring count, or explicit ring stations in [0, 1] of arc length. */
  rings: number | number[];
  /** Vertices around each ring. */
  segments: number;
  /** Reference "up" for the first frame (default +y; use +z for vertical limbs). */
  up?: THREE.Vector3 | [number, number, number];
  /** Section at arc parameter s. */
  section: (s: number) => Section;
  /** Radial displacement in metres at (s, theta); theta = 0 at +N, +pi/2 at +B. */
  bump?: (s: number, theta: number) => number;
  /** Close the start/end with a pole pushed out by this distance (false = open). */
  capStart?: number | false;
  capEnd?: number | false;
}

export interface LoftMesh {
  position: Float32Array;
  normal: Float32Array;
  /** Arc parameter per vertex. */
  s: Float32Array;
  /** Angle per vertex, normalised: 0.5 at +N, 0.75 at +B, 0/1 at -N (the seam). */
  v: Float32Array;
  index: number[];
  /** Path centre and frame at s (for attaching parts). */
  frameAt(s: number): { c: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3 };
  /** Surface point at (s, theta) including bumps. */
  pointAt(s: number, theta: number): THREE.Vector3;
}

const toV = (p: THREE.Vector3 | [number, number, number]) => (Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : p.clone());

// ---------------------------------------------------------------- interpolation

/** Monotone cubic (Fritsch-Carlson) through (xs, ys); clamps outside. */
export function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n === 1) return () => ys[0]!;
  const d: number[] = [];
  const m: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / Math.max(1e-9, xs[i + 1]! - xs[i]!));
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  return (x: number) => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (x - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h * m[i + 1]!
    );
  };
}

/** Build a section function from keyed rows. */
export function keyed(keys: SectionKey[]): (s: number) => Section {
  const xs = keys.map((k) => k[0]);
  const col = (i: number, dflt: number) => monotone(xs, keys.map((k) => (k[i] as number | undefined) ?? dflt));
  const w = col(1, 0.1);
  const up = col(2, 0.1);
  const down = col(3, 0.1);
  const eUp = col(4, 2);
  const eDown = col(5, 2);
  const dn = col(6, 0);
  return (s) => ({ w: Math.max(1e-4, w(s)), up: Math.max(1e-4, up(s)), down: Math.max(1e-4, down(s)), eUp: eUp(s), eDown: eDown(s), dn: dn(s), db: 0 });
}

/** A smooth 1D profile from [x, y] pairs. */
export function profile(pairs: Array<[number, number]>): (x: number) => number {
  return monotone(
    pairs.map((p) => p[0]),
    pairs.map((p) => p[1]),
  );
}

/** Gaussian bump helper for `LoftSpec.bump`. */
export function gauss2(s: number, th: number, s0: number, th0: number, ss: number, st: number): number {
  let dt = th - th0;
  while (dt > Math.PI) dt -= Math.PI * 2;
  while (dt < -Math.PI) dt += Math.PI * 2;
  const a = (s - s0) / ss;
  const b = dt / st;
  return Math.exp(-(a * a + b * b));
}

// ------------------------------------------------------------------ path

interface PathSampler {
  length: number;
  at(s: number, out: THREE.Vector3): THREE.Vector3;
  tangent(s: number, out: THREE.Vector3): THREE.Vector3;
}

function samplePath(points: THREE.Vector3[]): PathSampler {
  const pts = points.length === 2 ? [points[0]!, points[0]!.clone().lerp(points[1]!, 0.5), points[1]!] : points;
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const dense = curve.getSpacedPoints(Math.max(64, pts.length * 24));
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1]! + dense[i]!.distanceTo(dense[i - 1]!));
  const total = cum[cum.length - 1]!;
  const locate = (s: number): [number, number] => {
    const target = Math.min(1, Math.max(0, s)) * total;
    let lo = 0,
      hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! < target) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi]! - cum[lo]!;
    return [lo, seg > 0 ? (target - cum[lo]!) / seg : 0];
  };
  return {
    length: total,
    at(s, out) {
      const [i, f] = locate(s);
      return out.copy(dense[i]!).lerp(dense[Math.min(dense.length - 1, i + 1)]!, f);
    },
    tangent(s, out) {
      const [i] = locate(s);
      const a = dense[Math.max(0, i - 1)]!;
      const b = dense[Math.min(dense.length - 1, i + 2)]!;
      return out.subVectors(b, a).normalize();
    },
  };
}

// ------------------------------------------------------------------ loft

function superPoint(sec: Section, theta: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = c >= 0 ? sec.eUp : sec.eDown;
  const k = 2 / e;
  const ny = Math.sign(c) * Math.pow(Math.abs(c), k) * (c >= 0 ? sec.up : sec.down);
  const bx = Math.sign(s) * Math.pow(Math.abs(s), k) * sec.w;
  return [ny + sec.dn, bx + sec.db];
}

export function loft(spec: LoftSpec): LoftMesh {
  const path = samplePath(spec.path.map(toV));
  const stations = typeof spec.rings === "number" ? Array.from({ length: spec.rings }, (_, i) => i / (spec.rings as number - 1)) : spec.rings;
  const nr = stations.length;
  const seg = spec.segments;
  const cols = seg + 1;
  // Parallel-transport frames.
  const upRef = spec.up ? toV(spec.up).normalize() : new THREE.Vector3(0, 1, 0);
  const frames: Array<{ c: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3 }> = [];
  const frameAt = (s: number, prevN?: THREE.Vector3) => {
    const c = path.at(s, new THREE.Vector3());
    const t = path.tangent(s, new THREE.Vector3());
    const ref = prevN ?? upRef;
    const n = ref.clone().addScaledVector(t, -ref.dot(t));
    if (n.lengthSq() < 1e-8) n.set(0, 0, 1).addScaledVector(t, -t.z);
    n.normalize();
    const b = new THREE.Vector3().crossVectors(n, t).normalize();
    return { c, t, n, b };
  };
  let prev: THREE.Vector3 | undefined;
  for (const s of stations) {
    const f = frameAt(s, prev);
    frames.push(f);
    prev = f.n;
  }
  const bump = spec.bump;
  const pointOn = (f: { c: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3 }, sec: Section, s: number, theta: number, out: THREE.Vector3) => {
    const [ny, bx] = superPoint(sec, theta);
    out.copy(f.c).addScaledVector(f.n, ny).addScaledVector(f.b, bx);
    if (bump) {
      const d = bump(s, theta);
      if (d !== 0) {
        // Push along the section's outward direction.
        const len = Math.hypot(ny - sec.dn, bx - sec.db) || 1;
        out.addScaledVector(f.n, ((ny - sec.dn) / len) * d).addScaledVector(f.b, ((bx - sec.db) / len) * d);
      }
    }
    return out;
  };

  const capS = spec.capStart === undefined ? false : spec.capStart;
  const capE = spec.capEnd === undefined ? false : spec.capEnd;
  const total = nr * cols + (capS !== false ? 1 : 0) + (capE !== false ? 1 : 0);
  const position = new Float32Array(total * 3);
  const sArr = new Float32Array(total);
  const vArr = new Float32Array(total);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < nr; i++) {
    const s = stations[i]!;
    const f = frames[i]!;
    const sec = spec.section(s);
    for (let j = 0; j < cols; j++) {
      const theta = -Math.PI + (j / seg) * Math.PI * 2;
      pointOn(f, sec, s, theta, tmp);
      const k = i * cols + j;
      position[k * 3] = tmp.x;
      position[k * 3 + 1] = tmp.y;
      position[k * 3 + 2] = tmp.z;
      sArr[k] = s;
      vArr[k] = j / seg;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = i * cols + j + 1;
      const d = (i + 1) * cols + j + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  let next = nr * cols;
  if (capS !== false) {
    const f = frames[0]!;
    const sec = spec.section(stations[0]!);
    const p = f.c.clone().addScaledVector(f.n, sec.dn).addScaledVector(f.b, sec.db).addScaledVector(f.t, -capS);
    position.set([p.x, p.y, p.z], next * 3);
    sArr[next] = stations[0]!;
    vArr[next] = 0.5;
    for (let j = 0; j < seg; j++) index.push(next, j, j + 1);
    next++;
  }
  if (capE !== false) {
    const f = frames[nr - 1]!;
    const sec = spec.section(stations[nr - 1]!);
    const p = f.c.clone().addScaledVector(f.n, sec.dn).addScaledVector(f.b, sec.db).addScaledVector(f.t, capE);
    position.set([p.x, p.y, p.z], next * 3);
    sArr[next] = stations[nr - 1]!;
    vArr[next] = 0.5;
    const base = (nr - 1) * cols;
    for (let j = 0; j < seg; j++) index.push(next, base + j + 1, base + j);
    next++;
  }
  // Smooth normals, then weld the UV seam so it never draws a crease.
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const normal = (g.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
  for (let i = 0; i < nr; i++) {
    const a = i * cols;
    const b = i * cols + seg;
    const x = normal[a * 3]! + normal[b * 3]!;
    const y = normal[a * 3 + 1]! + normal[b * 3 + 1]!;
    const z = normal[a * 3 + 2]! + normal[b * 3 + 2]!;
    const l = Math.hypot(x, y, z) || 1;
    for (const k of [a, b]) {
      normal[k * 3] = x / l;
      normal[k * 3 + 1] = y / l;
      normal[k * 3 + 2] = z / l;
    }
  }
  return {
    position,
    normal: new Float32Array(normal),
    s: sArr,
    v: vArr,
    index,
    frameAt: (s: number) => {
      // Recompute with transport from the nearest station for stability.
      let best = 0;
      for (let i = 0; i < nr; i++) if (Math.abs(stations[i]! - s) < Math.abs(stations[best]! - s)) best = i;
      return frameAt(s, frames[best]!.n);
    },
    pointAt: (s: number, theta: number) => {
      let best = 0;
      for (let i = 0; i < nr; i++) if (Math.abs(stations[i]! - s) < Math.abs(stations[best]! - s)) best = i;
      const f = frameAt(s, frames[best]!.n);
      return pointOn(f, spec.section(s), s, theta, new THREE.Vector3());
    },
  };
}

/** Ring stations clustered toward the ends (for rounded caps) and optional dense bands. */
export function stations(count: number, opts: { endBias?: number; dense?: Array<[number, number, number]> } = {}): number[] {
  // Build a density function and invert its cumulative integral.
  const bias = opts.endBias ?? 0.6;
  const dense = opts.dense ?? [];
  const density = (s: number) => {
    let d = 1;
    d += bias * (Math.exp(-((s / 0.06) ** 2)) + Math.exp(-(((1 - s) / 0.06) ** 2)));
    for (const [c, width, amt] of dense) d += amt * Math.exp(-(((s - c) / width) ** 2));
    return d;
  };
  const N = 400;
  const cum: number[] = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1]! + density((i - 0.5) / N));
  const total = cum[N]!;
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total;
    let i = 0;
    while (i < N && cum[i + 1]! < target) i++;
    const f = (target - cum[i]!) / Math.max(1e-9, cum[i + 1]! - cum[i]!);
    out.push(Math.min(1, (i + f) / N));
  }
  out[0] = 0;
  out[count - 1] = 1;
  return out;
}
