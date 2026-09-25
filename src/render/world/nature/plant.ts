/**
 * Plant skeletons: limbs (tapered tubes by branching level) plus foliage
 * clumps, assembled into one painted geometry for a given foliage level.
 *
 * Foliage thinning is deterministic. Each clump carries fragment positions
 * (towards its outer surface, where leaves hang on longest) and keep ranks.
 * A full canopy draws whole clumps; as `leaves` falls the clumps break into
 * fragments with gaps between them, then fragments drop out, then only the
 * branch structure remains, with twigs appearing once the mass thins.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type Tone } from "../../core/geometry.ts";
import { paintGeometry } from "../../core/ink-material.ts";
import { foliageAtlas, type CellKind } from "./atlas.ts";
import type { AccentName } from "../../core/palette.ts";
import type { Rng } from "../../core/rng.ts";
import { NOISE, blob, randomUnit, taperTube, UP, v3, clamp01, lerp } from "./shapes.ts";

export type Level = 0 | 1 | 2 | 3 | 4;

export interface Limb {
  pts: THREE.Vector3[];
  r0: number;
  r1: number;
  /** 0 trunk, 1 limb, 2 secondary branch, 3 twig. */
  level: Level;
  radial?: number;
  segments?: number;
  flare?: number;
  cap?: boolean;
  gnarl?: number;
  power?: number;
  tone?: Tone;
  /** Drawn only when leaves < this (twigs hidden inside full canopies). */
  showBelow?: number;
}

export interface Clump {
  c: THREE.Vector3;
  r: number;
  stretch: [number, number, number];
  flatBottom: number;
  flatTop?: number;
  lump?: number;
  detail?: 0 | 1 | 2 | 3 | 4;
  scallop?: number;
  keep: number;
  seed: number;
  /** Unit-ish offsets (in clump radii) of the autumn fragments. */
  frags: Array<{ o: THREE.Vector3; keep: number; detail?: 0 | 1 | 3 | 4 }>;
  /** Small surface bumps that scallop the outline (offsets and radii in clump radii). */
  bumps: Array<{ o: THREE.Vector3; r: number; keep: number }>;
  tone?: Tone;
  /** Optional custom deform (willow drapes). */
  shape?: (g: THREE.BufferGeometry) => THREE.BufferGeometry;
  /** Evergreen: ignores the foliage level. */
  evergreen?: boolean;
  /** Render as crossed alpha-cut leaf cards from this atlas family (else a solid blob). */
  kind?: CellKind;
  /** Number of crossed cards (default 3). */
  cards?: number;
  /** Card height / width (curtains hang long). */
  aspect?: number;
  /** Add a near-horizontal card (crown tops and undersides). */
  flatCard?: boolean;
  /** Fixed card yaw (radians) and spread between crossed cards; default random. */
  yaw?: number;
  yawSpread?: number;
}

export interface Extra {
  geo: THREE.BufferGeometry;
  tone: Tone;
  accent?: AccentName;
  accentAmount?: number;
  matrix?: THREE.Matrix4;
  /** Present only when leaves is within [min, max]. */
  minLeaves?: number;
  maxLeaves?: number;
}

export interface Crown {
  /** Centre and semi-axes of the envelope whose normals the foliage borrows. */
  c: THREE.Vector3;
  r: THREE.Vector3;
  /** 0 = each clump shades alone, 1 = the crown shades as one smooth mass. */
  blend: number;
}

export class Skeleton {
  limbs: Limb[] = [];
  clumps: Clump[] = [];
  extras: Extra[] = [];
  crown: Crown | null = null;
  /** Default envelope-normal blend when the crown is computed automatically. */
  crownBlend = 0.85;
  constructor(
    public barkTone: Tone,
    public leafTone: Tone,
  ) {}

  limb(l: Limb): Limb {
    this.limbs.push(l);
    return l;
  }

  clump(
    rng: Rng,
    c: THREE.Vector3,
    r: number,
    opts: Partial<Omit<Clump, "c" | "r" | "keep" | "seed" | "frags" | "bumps">> & {
      outward?: THREE.Vector3;
      frags?: number;
      fragDetail?: 0 | 1 | 3 | 4;
      bumps?: number;
      bumpSize?: number;
      bumpUp?: number;
    } = {},
  ): Clump {
    const out = (opts.outward ?? v3(c.x, 0, c.z)).clone();
    if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
    out.normalize();
    const nf = opts.frags ?? 3;
    const frags: Clump["frags"] = [];
    for (let i = 0; i < nf; i++) {
      const o = out
        .clone()
        .multiplyScalar(0.55)
        .add(randomUnit(rng).multiplyScalar(0.75))
        .add(v3(0, 0.25, 0));
      o.normalize().multiplyScalar(rng.range(0.35, 0.6));
      frags.push({ o, keep: (i + rng.next()) / nf, detail: opts.fragDetail ?? (i === 0 ? 1 : 0) });
    }
    // Shuffle keep ranks so the first fragment is not always the survivor.
    for (let i = frags.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const k = frags[i]!.keep;
      frags[i]!.keep = frags[j]!.keep;
      frags[j]!.keep = k;
    }
    const bumps: Clump["bumps"] = [];
    const nb = opts.bumps ?? 0;
    const bumpUp = opts.bumpUp ?? 0.7;
    for (let i = 0; i < nb; i++) {
      const o = out
        .clone()
        .multiplyScalar(0.7)
        .add(randomUnit(rng).multiplyScalar(0.8))
        .add(v3(0, bumpUp, 0))
        .normalize();
      o.multiplyScalar(rng.range(0.68, 0.82));
      bumps.push({ o, r: (opts.bumpSize ?? 0.45) * rng.range(0.8, 1.2), keep: rng.next() });
    }
    const cl: Clump = {
      c: c.clone(),
      r,
      stretch: opts.stretch ?? [1, 1, 1],
      flatBottom: opts.flatBottom ?? 0.6,
      flatTop: opts.flatTop,
      lump: opts.lump,
      detail: opts.detail,
      scallop: opts.scallop,
      keep: rng.next(),
      seed: rng.range(0, 1000),
      frags,
      bumps,
      tone: opts.tone,
      shape: opts.shape,
      evergreen: opts.evergreen,
      kind: opts.kind,
      cards: opts.cards,
      aspect: opts.aspect,
      flatCard: opts.flatCard,
      yaw: opts.yaw,
      yawSpread: opts.yawSpread,
    };
    this.clumps.push(cl);
    return cl;
  }

  extra(e: Extra): void {
    this.extras.push(e);
  }
}

export interface CrownFill {
  centre: THREE.Vector3;
  radii: THREE.Vector3;
  count: number;
  /** Cluster radius range (m). */
  size: [number, number];
  /** Minimum radial fraction: clusters live in a shell (0.5 = outer half). */
  shell?: number;
  /** Absolute y below which no cluster is placed. */
  bottom?: number;
  /** Outline lobing amplitude (fraction of radius). */
  lobes?: number;
  /** Direction bias toward +Y (0..1). */
  up?: number;
  /** Overlap allowed between neighbours (0.5 = centres at 0.5 x sum of radii). */
  pack?: number;
}

export interface Cluster {
  c: THREE.Vector3;
  r: number;
  /** Radial fraction within the envelope (1 = on the surface). */
  frac: number;
  /** Unit direction from the crown centre. */
  dir: THREE.Vector3;
}

/**
 * Poisson-pack leaf clusters into a lobed ellipsoidal envelope, biased to the
 * outer shell (the interior of a real crown is mostly bare wood).
 */
export function fillCrown(rng: Rng, spec: CrownFill): Cluster[] {
  const out: Cluster[] = [];
  const shell = spec.shell ?? 0.55;
  const lobes = spec.lobes ?? 0.12;
  const up = spec.up ?? 0.15;
  const pack = spec.pack ?? 0.62;
  const seed = rng.range(0, 100);
  const shape = (d: THREE.Vector3) => 1 + lobes * NOISE.n3(d.x * 1.7 + seed, d.y * 1.7, d.z * 1.7 - seed);
  let attempts = spec.count * 60;
  while (out.length < spec.count && attempts-- > 0) {
    const d = randomUnit(rng);
    d.y = d.y * (1 - up) + up * Math.abs(d.y);
    d.normalize();
    const frac = Math.sqrt(rng.range(shell * shell, 1));
    const r = rng.range(spec.size[0], spec.size[1]) * lerp(0.8, 1, frac);
    const k = frac * shape(d);
    const c = v3(spec.centre.x + d.x * spec.radii.x * k, spec.centre.y + d.y * spec.radii.y * k, spec.centre.z + d.z * spec.radii.z * k);
    // Keep the whole cluster inside the envelope's outline and above the crown base.
    c.addScaledVector(d, -r * 0.45);
    if (spec.bottom !== undefined && c.y - r * 0.4 < spec.bottom) continue;
    let ok = true;
    for (const o of out) {
      if (o.c.distanceTo(c) < (o.r + r) * pack) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ c, r, frac, dir: d });
  }
  return out;
}

/** Group clusters by the nearest of `n` limb directions (azimuth), plus a crown-top group. */
export function groupClusters(clusters: Cluster[], n: number, az0: number, topCut = 0.8): Cluster[][] {
  const groups: Cluster[][] = Array.from({ length: n + 1 }, () => []);
  for (const cl of clusters) {
    if (cl.dir.y > topCut) {
      groups[n]!.push(cl);
      continue;
    }
    const az = Math.atan2(cl.dir.z, cl.dir.x);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const a = az0 + (i * Math.PI * 2) / n;
      let dd = Math.abs(((az - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    groups[best]!.push(cl);
  }
  return groups.filter((g) => g.length > 0);
}

export function centroid(cs: Cluster[]): THREE.Vector3 {
  const c = v3();
  for (const q of cs) c.add(q.c);
  return c.multiplyScalar(1 / Math.max(1, cs.length));
}

/** Point and radius at parameter t along a limb. */
export function along(l: Limb, t: number): { p: THREE.Vector3; r: number; dir: THREE.Vector3 } {
  const curve: THREE.Curve<THREE.Vector3> =
    l.pts.length > 2 ? new THREE.CatmullRomCurve3(l.pts, false, "centripetal", 0.5) : new THREE.LineCurve3(l.pts[0]!, l.pts[l.pts.length - 1]!);
  return { p: curve.getPointAt(t), r: l.r0 + (l.r1 - l.r0) * Math.pow(t, l.power ?? 1), dir: curve.getTangentAt(t) };
}

/** A path from a to b with wander (fraction of length) and an arc lift. */
export function path(a: THREE.Vector3, b: THREE.Vector3, rng: Rng, n: number, wander: number, arc = 0, arcDir: THREE.Vector3 = UP): THREE.Vector3[] {
  const pts = [a.clone()];
  const len = a.distanceTo(b);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.addScaledVector(arcDir, Math.sin(Math.PI * t) * arc * len);
    p.add(randomUnit(rng).multiplyScalar(wander * len * Math.sin(Math.PI * t)));
    pts.push(p);
  }
  pts.push(b.clone());
  return pts;
}

/**
 * A fan of twigs from `origin`, generally toward `outward`, drawn only when
 * the canopy has thinned (leaves < showBelow).
 */
export function twigFan(
  sk: Skeleton,
  rng: Rng,
  origin: THREE.Vector3,
  outward: THREE.Vector3,
  length: number,
  count: number,
  r0: number,
  opts: { up?: number; spread?: number; droop?: number; showBelow?: number; twiglets?: number } = {},
): void {
  const up = opts.up ?? 0.35;
  const spread = opts.spread ?? 0.75;
  const droop = opts.droop ?? 0;
  const showBelow = opts.showBelow ?? 0.85;
  const twiglets = opts.twiglets ?? 0.5;
  for (let k = 0; k < count; k++) {
    const dir = outward
      .clone()
      .normalize()
      .add(randomUnit(rng).multiplyScalar(spread))
      .add(v3(0, up, 0))
      .normalize();
    const len = length * rng.range(0.7, 1.15);
    const end = origin.clone().addScaledVector(dir, len);
    end.y -= droop * len;
    const mid = origin.clone().addScaledVector(dir, len * 0.5).add(randomUnit(rng).multiplyScalar(len * 0.07));
    mid.y += droop * len * 0.12;
    sk.limb({ pts: [origin.clone(), mid, end], r0, r1: r0 * 0.22, level: 3, radial: 3, segments: 1, showBelow });
    if (rng.chance(twiglets)) {
      const d2 = dir.clone().add(randomUnit(rng).multiplyScalar(0.9)).normalize();
      const s2 = origin.clone().lerp(end, rng.range(0.35, 0.6));
      const e2 = s2.clone().addScaledVector(d2, len * rng.range(0.3, 0.5));
      e2.y -= droop * len * 0.3;
      sk.limb({ pts: [s2, e2], r0: r0 * 0.55, r1: r0 * 0.15, level: 3, radial: 3, segments: 1, showBelow });
    }
  }
}

/** Foliage-level schedule. Returns what to draw for one clump. */
function clumpParts(cl: Clump, leaves: number): Array<{ c: THREE.Vector3; r: number; detail: 0 | 1 | 2 | 3 | 4; seed: number; bump?: boolean }> {
  const L = cl.evergreen ? 1 : clamp01(leaves);
  const out: Array<{ c: THREE.Vector3; r: number; detail: 0 | 1 | 2 | 3 | 4; seed: number; bump?: boolean }> = [];
  if (L <= 0.02) return out;
  const [sx, sy, sz] = cl.stretch;
  const at = (o: THREE.Vector3, k: number) => cl.c.clone().add(v3(o.x * sx, o.y * sy, o.z * sz).multiplyScalar(cl.r * k));
  if (L >= 0.9) {
    const s = lerp(0.94, 1, (L - 0.9) / 0.1);
    out.push({ c: cl.c, r: cl.r * s, detail: cl.detail ?? 1, seed: cl.seed });
    cl.bumps.forEach((b, i) => out.push({ c: at(b.o, s), r: cl.r * b.r * s, detail: 3, seed: cl.seed + 31 * i, bump: true }));
    return out;
  }
  // Canopy breaking up: fragments toward the outside of the clump, with gaps.
  const threshold = L >= 0.45 ? lerp(0.5, 1.02, (L - 0.45) / 0.45) : lerp(0.0, 0.5, L / 0.45) * 1.15;
  const scale = lerp(0.46, 0.68, clamp01((L - 0.2) / 0.7));
  const spread = lerp(1.1, 0.8, L);
  cl.frags.forEach((f, i) => {
    if (f.keep < threshold) out.push({ c: at(f.o, spread), r: cl.r * scale, detail: f.detail ?? 0, seed: cl.seed + i * 17.3 });
  });
  cl.bumps.forEach((b, i) => {
    if (b.keep < threshold * 0.8) out.push({ c: at(b.o, 1), r: cl.r * b.r * lerp(0.7, 0.95, L), detail: 3, seed: cl.seed + 31 * i, bump: true });
  });
  return out;
}

/** Envelope of all clumps at full foliage (bounding ellipsoid). */
function autoCrown(sk: Skeleton): Crown | null {
  if (!sk.clumps.length || sk.crownBlend <= 0) return null;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const cl of sk.clumps) {
    const e = v3(cl.r * cl.stretch[0], cl.r * cl.stretch[1], cl.r * cl.stretch[2]);
    min.min(cl.c.clone().sub(e));
    max.max(cl.c.clone().add(e));
  }
  const c = min.clone().add(max).multiplyScalar(0.5);
  // Lower the centre: normals tilt up, so the sunlit crown stays paper-white
  // and only the true underside takes hatching.
  const r = max.clone().sub(min).multiplyScalar(0.5);
  c.y -= r.y * 0.22;
  return { c, r, blend: sk.crownBlend };
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e = new THREE.Vector3();
/** Bend clump normals toward the crown envelope's normal: one coherent mass. */
function blendNormals(g: THREE.BufferGeometry, crown: Crown, k: number): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i).sub(crown.c);
    _e.set(_p.x / (crown.r.x * crown.r.x), _p.y / (crown.r.y * crown.r.y), _p.z / (crown.r.z * crown.r.z)).normalize();
    _n.fromBufferAttribute(nrm, i).multiplyScalar(1 - k).addScaledVector(_e, k).normalize();
    nrm.setXYZ(i, _n.x, _n.y, _n.z);
  }
  nrm.needsUpdate = true;
}

export interface AssembleResult {
  geometry: THREE.BufferGeometry;
}

const SPARSE: Record<CellKind, CellKind> = {
  broad: "broadSparse",
  broadSparse: "broadSparse",
  droop: "droopSparse",
  droopSparse: "droopSparse",
  upright: "uprightSparse",
  uprightSparse: "uprightSparse",
  curtain: "curtainSparse",
  curtainSparse: "curtainSparse",
  hedge: "broadSparse",
  maize: "maize",
};

function hash01(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Prepare any part for the merge: non-indexed, only position/normal/uv/inkAttr,
 * transformed, painted, and (for solid parts) pointed at the atlas's opaque cell.
 */
export function solidPart(geometry: THREE.BufferGeometry, tone: Tone, opts: { accent?: AccentName; accentAmount?: number; matrix?: THREE.Matrix4 } = {}): THREE.BufferGeometry {
  let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.morphAttributes = {};
  if (opts.matrix) g.applyMatrix4(opts.matrix);
  paintGeometry(g, tone, opts.accent ?? "none", opts.accentAmount);
  const [u, v] = foliageAtlas().solid;
  const n = g.getAttribute("position").count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Give an already painted (e.g. Kit-built) geometry the opaque-cell uv, keeping its tones. */
export function withSolidUv(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "inkAttr") g.deleteAttribute(name);
  }
  if (!g.getAttribute("inkAttr")) paintGeometry(g, "paper");
  if (matrix) g.applyMatrix4(matrix);
  const [u, v] = foliageAtlas().solid;
  const n = g.getAttribute("position").count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Merge parts that all carry position/normal/uv/inkAttr. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("nature: merge failed (attribute mismatch)");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export interface CardSpec {
  c: THREE.Vector3;
  r: number;
  kind: CellKind;
  seed: number;
  cards: number;
  stretch: [number, number, number];
  aspect: number;
  flatCard: boolean;
  /** Top-anchored cards hang from c (curtains). */
  hang?: boolean;
  /** Bottom-anchored cards stand on c (crops). */
  base?: boolean;
  yaw?: number;
  yawSpread?: number;
  /** Fraction of cards kept (0..1, per-card keep ranks). */
  keep: number;
  tone: Tone;
}

/** Visible leaf mass fills ~75% of a cell: cards are drawn larger than their cluster. */
const CARD_SCALE = 1.32;
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
/**
 * Crossed, double-layered leaf cards. Both layers carry the same normal (taken
 * from the crown envelope when given), so the crown shades as one mass and the
 * normal-edge detector sees no seams; the alpha-cut outline makes the pen line.
 */
export function leafCards(spec: CardSpec, crown: Crown | null): THREE.BufferGeometry | null {
  const atlas = foliageAtlas();
  const rects = atlas.cells[spec.kind];
  const pos: number[] = [];
  const nrm: number[] = [];
  const uvs: number[] = [];
  const n = spec.cards + (spec.flatCard ? 1 : 0);
  const e = new THREE.Vector3();
  const pushVert = (p: THREE.Vector3, u: number, v: number) => {
    pos.push(p.x, p.y, p.z);
    uvs.push(u, v);
    if (crown && spec.hang) {
      // Curtains face outward and a little up: the sunny side stays white.
      e.set(p.x - crown.c.x, 0, p.z - crown.c.z).normalize();
      e.y = 0.35;
      e.normalize();
      nrm.push(e.x, e.y, e.z);
    } else if (crown) {
      e.set((p.x - crown.c.x) / (crown.r.x * crown.r.x), (p.y - crown.c.y) / (crown.r.y * crown.r.y), (p.z - crown.c.z) / (crown.r.z * crown.r.z)).normalize();
      nrm.push(e.x, e.y, e.z);
    } else {
      e.set(p.x - spec.c.x, p.y - spec.c.y, p.z - spec.c.z).normalize();
      nrm.push(e.x, e.y, e.z);
    }
  };
  for (let k = 0; k < n; k++) {
    if (hash01(spec.seed, k + 1) > spec.keep) continue;
    const rect = rects[Math.floor(hash01(spec.seed, k + 7) * rects.length) % rects.length]!;
    const flat = spec.flatCard && k === n - 1;
    const yaw =
      spec.yaw !== undefined
        ? spec.yaw + (k - (spec.cards - 1) / 2) * (spec.yawSpread ?? 0.6)
        : spec.seed * 0.618 + (k * Math.PI) / Math.max(1, spec.cards);
    // Hanging curtains flare outward at the hem (negative tilt swings the bottom out).
    const tilt = flat
      ? Math.PI / 2 - 0.25
      : spec.hang
        ? -0.12 - hash01(spec.seed, k + 13) * 0.16
        : (hash01(spec.seed, k + 13) - 0.5) * (spec.base ? 0.1 : 0.5);
    const roll = spec.hang || spec.base ? (hash01(spec.seed, k + 19) - 0.5) * 0.12 : hash01(spec.seed, k + 19) * Math.PI * 2;
    const w = spec.r * 2 * (spec.hang || spec.base ? 1 : CARD_SCALE * lerp(0.9, 1.12, hash01(spec.seed, k + 23)));
    const h = w * spec.aspect;
    _q.setFromEuler(new THREE.Euler(tilt, yaw, roll, "YXZ"));
    // Offset crossed cards off-centre so their intersection crease falls near
    // the card rims (mostly cut away) rather than through the opaque middle.
    const off = spec.hang || spec.base || flat ? 0 : (k % 2 ? 1 : -1) * spec.r * 0.32;
    const centre = spec.c.clone().add(new THREE.Vector3(0, 0, off).applyQuaternion(_q));
    _m.compose(centre, _q, new THREE.Vector3(spec.stretch[0], spec.stretch[1], spec.stretch[2]));
    const y0 = spec.hang ? -h : spec.base ? 0 : -h / 2;
    const y1 = spec.hang ? 0 : spec.base ? h : h / 2;
    const corners = [
      new THREE.Vector3(-w / 2, y0, 0).applyMatrix4(_m),
      new THREE.Vector3(w / 2, y0, 0).applyMatrix4(_m),
      new THREE.Vector3(w / 2, y1, 0).applyMatrix4(_m),
      new THREE.Vector3(-w / 2, y1, 0).applyMatrix4(_m),
    ];
    const [u0, v0, u1, v1] = rect;
    const cuv: Array<[number, number]> = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    // Front layer then back layer (reversed winding), same normals.
    for (const tri of [
      [0, 1, 2],
      [0, 2, 3],
      [0, 2, 1],
      [0, 3, 2],
    ]) {
      for (const i of tri) pushVert(corners[i]!, cuv[i]![0], cuv[i]![1]);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  paintGeometry(g, spec.tone);
  return g;
}

/** Build the painted, merged geometry for this skeleton at a foliage level. */
export function assemble(sk: Skeleton, leaves: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const L = clamp01(leaves);
  for (const l of sk.limbs) {
    if (l.showBelow !== undefined && L >= l.showBelow) continue;
    const g = taperTube(l.pts, l.r0, l.r1, {
      radial: l.radial ?? (l.level === 0 ? 8 : l.level === 1 ? 6 : l.level === 2 ? 4 : 3),
      segments: l.segments,
      flare: l.flare,
      cap: l.cap,
      gnarl: l.gnarl,
      power: l.power,
      seed: l.pts[0]!.x * 3.1 + l.pts[0]!.z * 1.7,
    });
    parts.push(solidPart(g, l.tone ?? sk.barkTone));
  }
  const crown = sk.crown ?? autoCrown(sk);
  for (const cl of sk.clumps) {
    if (cl.kind) {
      const Lc = cl.evergreen ? 1 : L;
      if (Lc <= 0.02) continue;
      const full = Lc >= 0.9;
      const g = leafCards(
        {
          c: cl.c,
          r: cl.r * (full ? 1 : lerp(0.62, 0.95, Lc)),
          kind: full ? cl.kind : SPARSE[cl.kind],
          seed: cl.seed,
          cards: cl.cards ?? 3,
          stretch: cl.stretch,
          aspect: cl.aspect ?? 1,
          flatCard: !!cl.flatCard,
          hang: cl.kind === "curtain" || cl.kind === "curtainSparse",
          yaw: cl.yaw,
          yawSpread: cl.yawSpread,
          keep: full ? 1 : clamp01(Lc * 1.1),
          tone: cl.tone ?? sk.leafTone,
        },
        crown && crown.blend > 0 ? crown : null,
      );
      if (g) parts.push(g);
      continue;
    }
    for (const part of clumpParts(cl, L)) {
      let g = blob(part.r, {
        detail: part.detail,
        lump: part.bump ? 0.12 : (cl.lump ?? 0.2),
        flatBottom: cl.flatBottom,
        flatTop: cl.flatTop,
        stretch: part.bump ? [1, lerp(1, cl.stretch[1], 0.5), 1] : cl.stretch,
        seed: part.seed,
        scallop: cl.scallop,
      });
      if (cl.shape && !part.bump) g = cl.shape(g);
      g.rotateY(part.seed % 6.283);
      g.translate(part.c.x, part.c.y, part.c.z);
      if (crown) blendNormals(g, crown, L >= 0.9 ? crown.blend : crown.blend * lerp(0.45, 1, L));
      parts.push(solidPart(g, cl.tone ?? sk.leafTone));
    }
  }
  for (const e of sk.extras) {
    if (e.minLeaves !== undefined && L < e.minLeaves) continue;
    if (e.maxLeaves !== undefined && L > e.maxLeaves) continue;
    parts.push(solidPart(e.geo, e.tone, { accent: e.accent, accentAmount: e.accentAmount, matrix: e.matrix }));
  }
  return mergeParts(parts);
}
