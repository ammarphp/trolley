/**
 * Anatomical part helpers shared by every species builder: limbs keyed by
 * joint, hooves, paws, eyes, ears, horns, tails and tufts. All work in mesh
 * space at the rest pose and write into a SkinBuilder.
 */
import * as THREE from "three";
import { keyed, loft, stations, type LoftMesh, type SectionKey } from "./loft.ts";
import { chainBlend, SkinBuilder, type LoftPaint, type Tone, type UvRect } from "./skin.ts";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Detail multiplier for ring / segment counts (LOD). */
export const seg = (n: number, detail: number, min = 3) => Math.max(min, Math.round(n * detail));

export interface LimbSpec {
  /** Joints from the top (buried in the body) to the ground contact. */
  joints: THREE.Vector3[];
  /** Bone per segment (joints.length - 1 entries). */
  bones: number[];
  /**
   * Sections keyed in joint coordinates: k = 0 at joints[0], 1 at joints[1],
   * 1.5 half way to joints[2], ... Rows: [k, halfWidth, front, back, eFront?, eBack?].
   */
  keys: SectionKey[];
  rings: number;
  segments: number;
  /** Blend width across joints, in metres. */
  blend?: number;
  tone?: Tone | ((s: number, v: number, p: THREE.Vector3) => number);
  /** Front direction for the section frame (default +z). */
  front?: THREE.Vector3;
  capStart?: number | false;
  capEnd?: number | false;
  uv?: UvRect | null;
  bump?: (s: number, theta: number) => number;
}

/** Joint coordinate -> arc parameter, from chord lengths. */
export function jointParams(joints: THREE.Vector3[]): number[] {
  const cum = [0];
  for (let i = 1; i < joints.length; i++) cum.push(cum[i - 1]! + joints[i]!.distanceTo(joints[i - 1]!));
  const total = cum[cum.length - 1]!;
  return cum.map((c) => c / total);
}

export function limb(b: SkinBuilder, spec: LimbSpec): LoftMesh {
  const js = jointParams(spec.joints);
  const kToS = (k: number) => {
    const i = Math.min(js.length - 2, Math.max(0, Math.floor(k)));
    const f = k - i;
    return js[i]! + (js[i + 1]! - js[i]!) * f;
  };
  const keys = spec.keys.map((row) => [kToS(row[0]), ...row.slice(1)] as SectionKey);
  const inner = js.slice(1, -1);
  const total = spec.joints.reduce((acc, j, i) => (i ? acc + j.distanceTo(spec.joints[i - 1]!) : 0), 0);
  const ring = stations(spec.rings, { endBias: 0.3, dense: inner.map((s) => [s, 0.035, 1.2] as [number, number, number]) });
  const l = loft({
    path: spec.joints,
    rings: ring,
    segments: spec.segments,
    up: spec.front ?? V(0, 0, 1),
    section: keyed(keys),
    capStart: spec.capStart ?? false,
    capEnd: spec.capEnd ?? 0.01,
    bump: spec.bump,
  });
  const blendS = (spec.blend ?? 0.04) / total;
  const paint: LoftPaint = {
    bones: chainBlend(spec.bones, inner, blendS),
    tone: spec.tone ?? 0,
    uv: spec.uv ?? null,
  };
  b.addLoft(l, paint);
  return l;
}

/** A tapered tube (horn, tail, beak, toe) along points; radius from r0 to r1. */
export function taper(
  b: SkinBuilder,
  points: THREE.Vector3[],
  r0: number,
  r1: number,
  opts: {
    bones: number | ((s: number) => readonly [number, number, number]);
    rings?: number;
    segments?: number;
    tone?: Tone | ((s: number, v: number, p: THREE.Vector3) => number);
    flat?: number;
    capEnd?: number | false;
    capStart?: number | false;
    up?: THREE.Vector3;
    profile?: (s: number) => number;
    bump?: (s: number, theta: number) => number;
  },
): LoftMesh {
  const prof = opts.profile ?? ((s: number) => 1 - s);
  const flat = opts.flat ?? 1;
  const l = loft({
    path: points,
    rings: opts.rings ?? 8,
    segments: opts.segments ?? 6,
    up: opts.up,
    section: (s) => {
      const r = r1 + (r0 - r1) * prof(s);
      return { w: r, up: r * flat, down: r * flat, eUp: 2, eDown: 2, dn: 0, db: 0 };
    },
    capStart: opts.capStart ?? false,
    capEnd: opts.capEnd ?? r1 * 0.8,
    bump: opts.bump,
  });
  const bones = opts.bones;
  b.addLoft(l, {
    bones: typeof bones === "number" ? bones : (s) => bones(s),
    tone: opts.tone ?? 0,
  });
  return l;
}

/** Ellipsoid part. */
export function blob(
  b: SkinBuilder,
  centre: THREE.Vector3,
  radii: [number, number, number],
  bone: number | readonly [number, number, number],
  tone: Tone = 0,
  opts: { rotation?: THREE.Euler; w?: number; h?: number; uv?: [number, number]; jitter?: number; seed?: number } = {},
): void {
  const g = new THREE.SphereGeometry(1, opts.w ?? 10, opts.h ?? 7);
  if (opts.jitter) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + (opts.seed ?? 1) * 4.1) * 43758.5453;
      const r = 1 + (h - Math.floor(h) - 0.5) * opts.jitter;
      p.setXYZ(i, x * r, y * r, z * r);
    }
    g.computeVertexNormals();
  }
  const m = new THREE.Matrix4().compose(centre, new THREE.Quaternion().setFromEuler(opts.rotation ?? new THREE.Euler()), new THREE.Vector3(...radii));
  b.addPart(g, bone, { tone, uv: opts.uv }, m);
}

/**
 * Cloven hoof (cattle, sheep, deer, pig) or solid hoof (horse): a pair of
 * toe capsules or one truncated cone, tilted to the pastern.
 */
export function hoof(
  b: SkinBuilder,
  ground: THREE.Vector3,
  opts: { bone: number; width: number; length: number; height: number; cloven: boolean; tone?: Tone; pitch?: number; detail?: number },
): void {
  const tone = opts.tone ?? "deep";
  const pitch = opts.pitch ?? 0.5;
  const d = opts.detail ?? 1;
  if (!opts.cloven) {
    // A horse hoof: wall sloping forward, flat sole.
    const g = new THREE.CylinderGeometry(opts.width * 0.36, opts.width * 0.5, opts.height, seg(12, d, 6), 1);
    g.translate(0, opts.height / 2, 0);
    // Slant the toe forward.
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setZ(i, p.getZ(i) * (opts.length / opts.width) - (y / opts.height) * opts.height * Math.tan(pitch) * 0.6);
    }
    g.computeVertexNormals();
    b.addPart(g, opts.bone, { tone }, new THREE.Matrix4().makeTranslation(ground.x, ground.y, ground.z));
    return;
  }
  for (const side of [-1, 1]) {
    const g = new THREE.SphereGeometry(1, seg(5, d, 4), 2, 0, Math.PI * 2, 0, Math.PI / 2);
    // Half-dome toe, pointed forward.
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const zz = z > 0 ? z * (1 + (1 - y) * 0.6) : z * 0.8;
      p.setXYZ(i, x, y, zz);
    }
    g.computeVertexNormals();
    const m = new THREE.Matrix4().compose(
      V(ground.x + side * opts.width * 0.26, ground.y, ground.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * -0.08, 0)),
      V(opts.width * 0.25, opts.height, opts.length * 0.5),
    );
    b.addPart(g, opts.bone, { tone }, m);
  }
}

/** Eye: a small dark ellipsoid set into the head, with a lid ridge. */
export function eye(b: SkinBuilder, at: THREE.Vector3, r: number, bone: number, outward: THREE.Vector3, detail = 1): void {
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), outward.clone().normalize());
  const g = new THREE.SphereGeometry(1, seg(6, detail, 4), seg(4, detail, 3));
  b.addPart(g, bone, { tone: "solid" }, new THREE.Matrix4().compose(at, q, V(r * 1.15, r, r * 0.7)));
}

/**
 * Leaf-shaped ear from base along `dir`, cupped toward `cup`. Width profile
 * peaks near 40% of the length.
 */
export function ear(
  b: SkinBuilder,
  base: THREE.Vector3,
  dir: THREE.Vector3,
  cup: THREE.Vector3,
  opts: { length: number; width: number; thick?: number; bone: number; tone?: Tone | ((s: number, v: number, p: THREE.Vector3) => number); detail?: number; droop?: number; shape?: (s: number) => number },
): void {
  const d = dir.clone().normalize();
  const tip = base.clone().addScaledVector(d, opts.length);
  const mid = base.clone().addScaledVector(d, opts.length * 0.5);
  if (opts.droop) {
    mid.y -= opts.droop * 0.4;
    tip.y -= opts.droop;
  }
  const thick = opts.thick ?? 0.012;
  const shape = opts.shape ?? ((s: number) => Math.sin(Math.PI * Math.pow(s, 0.75)) * (1 - 0.25 * s) + 0.35 * (1 - s));
  const l = loft({
    path: [base, mid, tip],
    rings: seg(5, opts.detail ?? 1, 4),
    segments: seg(6, opts.detail ?? 1, 5),
    up: cup,
    section: (s) => {
      const w = Math.max(0.002, opts.width * 0.5 * shape(s));
      return { w, up: thick, down: thick * 0.6, eUp: 2, eDown: 1.6, dn: -thick * 0.3 - w * 0.25 * Math.sin(Math.PI * s), db: 0 };
    },
    capStart: false,
    capEnd: 0.004,
    // Cup: pull the centre line in so the rim stands proud.
    bump: (s, th) => -Math.cos(th) * 0.004 * Math.sin(Math.PI * s),
  });
  b.addLoft(l, { bones: opts.bone, tone: opts.tone ?? 0 });
}

/**
 * A pool on the ground, bound to its own top-level bone that is scaled from
 * zero after a strike. Irregular rim, unit radius, blood pigment.
 */
export function poolPart(b: SkinBuilder, bone: number, seed: number, detail = 1): void {
  const n = seg(18, detail, 10);
  const pos: number[] = [0, 0.012, 0];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.22 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 7 + seed * 2.3) + 0.06 * Math.sin(a * 13 + seed);
    pos.push(Math.cos(a) * r, 0.012, Math.sin(a) * r * 0.8);
  }
  const idx: number[] = [];
  for (let i = 1; i <= n; i++) idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.addPart(g, bone, { tone: 0.15, accent: "blood", accentAmount: 0.95 });
}

/** A jittered tuft (tail switch, mane lock, forelock). */
export function tuft(
  b: SkinBuilder,
  points: THREE.Vector3[],
  r: number,
  bones: number | ((s: number) => readonly [number, number, number]),
  opts: { tone?: Tone; seed?: number; detail?: number; strands?: number; spread?: number } = {},
): void {
  const n = opts.strands ?? 1;
  const seed = opts.seed ?? 1;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + seed;
    const off = n > 1 ? (opts.spread ?? r) : 0;
    const pts = points.map((p, k) => {
      const f = k / (points.length - 1);
      return p.clone().add(V(Math.cos(ang) * off * f, 0, Math.sin(ang) * off * f));
    });
    taper(b, pts, r, r * 0.05, {
      bones,
      rings: seg(7, opts.detail ?? 1, 4),
      segments: seg(6, opts.detail ?? 1, 4),
      tone: opts.tone ?? "solid",
      profile: (s) => Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.85 + 0.15)), 0.7) * (1 - s * 0.6),
      bump: (s, th) => Math.sin(th * 5 + seed * 3 + s * 7) * r * 0.25 * s,
    });
  }
}
