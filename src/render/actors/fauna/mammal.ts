/**
 * Generic mammal body: torso, neck and head lofts, four jointed legs with
 * hooves or paws, ears, eyes and a tail, all bound to the QUAD rig. Species
 * files supply anatomy as data plus an `extras` hook for horns, antlers,
 * manes, snouts and fleece.
 */
import * as THREE from "three";
import { keyed, loft, stations, type LoftMesh, type SectionKey } from "./loft.ts";
import { SkinBuilder, chainBlend, type Tone } from "./skin.ts";
import { QUAD as Q, QUAD_RIG } from "./rig.ts";
import { V, blob, ear, eye, hoof, limb, poolPart, seg, taper, tuft } from "./parts.ts";
import { surface, type BodyBuild, type BuildCtx } from "./body.ts";
import type { CoatCell } from "./coat.ts";

/** Torso row: [z, yTop, yBottom, halfWidth, eUp, eDown]. */
export type TorsoRow = [number, number, number, number, number, number];

export interface MammalParts {
  torso: LoftMesh;
  neck: LoftMesh;
  head: LoftMesh;
  cell: CoatCell;
}

export interface MammalSpec {
  torso: {
    z0: number;
    z1: number;
    yc: number;
    rows: TorsoRow[];
    rings: number;
    segs: number;
    loinZ: number;
    bump?: (s: number, a: number, z: number) => number;
    dense?: Array<[number, number, number]>;
    cap?: [number, number];
  };
  neck: {
    path: THREE.Vector3[];
    keys: SectionKey[];
    rings: number;
    segs: number;
    /** Arc stations where the body->neck1 and neck1->neck2 blends centre. */
    joints: [number, number];
    bump?: (s: number, a: number) => number;
  };
  head: {
    path: THREE.Vector3[];
    keys: SectionKey[];
    rings: number;
    segs: number;
    bump?: (s: number, a: number) => number;
    cap?: [number, number];
  };
  /** Bone rest positions for neck1, neck2 and head. */
  neckBones: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  fore: { joints: (x: number) => THREE.Vector3[]; keys: SectionKey[]; rings: number; segs: number; blend?: number };
  hind: { joints: (x: number) => THREE.Vector3[]; keys: SectionKey[]; rings: number; segs: number; blend?: number };
  legTone?: (s: number, v: number, p: THREE.Vector3) => number;
  foot: { kind: "cloven" | "hoof" | "paw" | "none"; width: number; length: number; height: number; tone: Tone };
  tail: {
    points: THREE.Vector3[];
    r0: number;
    r1: number;
    tone?: Tone | ((s: number, v: number, p: THREE.Vector3) => number);
    rings?: number;
    segs?: number;
    bones: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    tuft?: { points: THREE.Vector3[]; r: number; tone: Tone; strands?: number; spread?: number };
  };
  ear: {
    s: number;
    theta: number;
    dir: THREE.Vector3;
    cup: THREE.Vector3;
    length: number;
    width: number;
    thick?: number;
    droop?: number;
    tone?: Tone | ((s: number, v: number, p: THREE.Vector3) => number);
    shape?: (s: number) => number;
  };
  eye: { s: number; theta: number; r: number };
  height: number;
  length: number;
  /** Bone rest overrides (e.g. rump pivot height). */
  rumpY?: number;
  extras?: (b: SkinBuilder, parts: MammalParts, d: number, ctx: BuildCtx) => void;
}

export function buildMammal(spec: MammalSpec, ctx: BuildCtx): BodyBuild {
  const d = ctx.detail;
  const b = new SkinBuilder();
  b.blank = ctx.atlas.blank;
  const cell = ctx.atlas.cell(ctx.variant, ctx.thin > 0.5);
  const T = spec.torso;
  const sOf = (z: number) => (z - T.z0) / (T.z1 - T.z0);
  const keys: SectionKey[] = T.rows.map(([z, top, bot, w, eu, ed]) => [sOf(z), w, top - T.yc, T.yc - bot, eu, ed]);
  const torso = loft({
    path: [V(0, T.yc, T.z0), V(0, T.yc, T.z1)],
    rings: stations(seg(T.rings, d, 8), { endBias: 1.2, dense: T.dense ?? [] }),
    segments: seg(T.segs, d, 8),
    section: keyed(keys),
    bump: T.bump ? (s, t) => T.bump!(s, Math.abs(t), T.z0 + (T.z1 - T.z0) * s) : undefined,
    capStart: T.cap?.[0] ?? 0.02,
    capEnd: T.cap?.[1] ?? 0.02,
  });
  b.addLoft(torso, { bones: chainBlend([Q.rump, Q.body], [sOf(T.loinZ)], 0.09), uv: cell.body });

  const N = spec.neck;
  const neck = loft({
    path: N.path,
    rings: seg(N.rings, d, 4),
    segments: seg(N.segs, d, 7),
    section: keyed(N.keys),
    bump: N.bump ? (s, t) => N.bump!(s, Math.abs(t)) : undefined,
  });
  b.addLoft(neck, { bones: chainBlend([Q.body, Q.neck1, Q.neck2], N.joints, [0.12, 0.2]), uv: cell.neck });

  const H = spec.head;
  const head = loft({
    path: H.path,
    rings: seg(H.rings, d, 5),
    segments: seg(H.segs, d, 7),
    section: keyed(H.keys),
    bump: H.bump ? (s, t) => H.bump!(s, Math.abs(t)) : undefined,
    capStart: H.cap?.[0] ?? 0.015,
    capEnd: H.cap?.[1] ?? 0.012,
  });
  b.addLoft(head, { bones: Q.head, uv: cell.head });
  const muzzle = H.path[H.path.length - 1]!.clone();

  const earBase: THREE.Vector3[] = [];
  for (const side of [1, -1]) {
    const e = surface(head, spec.eye.s, side * spec.eye.theta);
    eye(b, e.p.clone().addScaledVector(e.n, -spec.eye.r * 0.25), spec.eye.r, Q.head, e.n, d);
    const E = spec.ear;
    const eb = surface(head, E.s, side * E.theta).p;
    earBase.push(eb);
    ear(b, eb.clone().addScaledVector(V(side, 0, 0), -E.width * 0.15), V(side * E.dir.x, E.dir.y, E.dir.z), V(side * E.cup.x, E.cup.y, E.cup.z), {
      length: E.length,
      width: E.width,
      thick: E.thick,
      droop: E.droop,
      bone: side > 0 ? Q.earL : Q.earR,
      detail: d,
      tone: E.tone ?? 0,
      shape: E.shape,
    });
  }

  const legTone = spec.legTone ?? (() => 0);
  const F = spec.foot;
  for (const x of [1, -1]) {
    const fb = x > 0 ? [Q.fl0, Q.fl1, Q.fl2, Q.fl3] : [Q.fr0, Q.fr1, Q.fr2, Q.fr3];
    const hb = x > 0 ? [Q.hl0, Q.hl1, Q.hl2, Q.hl3] : [Q.hr0, Q.hr1, Q.hr2, Q.hr3];
    for (const [L, bones] of [
      [spec.fore, fb],
      [spec.hind, hb],
    ] as const) {
      const j = L.joints(x);
      limb(b, { joints: j, bones: [...bones], keys: L.keys, rings: seg(L.rings, d, 6), segments: seg(L.segs, d, 5), blend: L.blend ?? 0.04, tone: legTone });
      const g = j[j.length - 1]!;
      if (F.kind === "cloven" || F.kind === "hoof") {
        hoof(b, V(g.x, 0, g.z + F.length * 0.15), { bone: bones[3]!, width: F.width, length: F.length, height: F.height, cloven: F.kind === "cloven", tone: F.tone, detail: d });
      } else if (F.kind === "paw") {
        blob(b, V(g.x, F.height * 0.5, g.z + F.length * 0.25), [F.width * 0.5, F.height * 0.55, F.length * 0.5], bones[3]!, F.tone, { w: seg(7, d, 5), h: seg(5, d, 4) });
      }
    }
  }

  const TL = spec.tail;
  const tb = TL.bones;
  const tailLen = TL.points.reduce((a, p, i) => (i ? a + p.distanceTo(TL.points[i - 1]!) : 0), 0);
  const tAt = (p: THREE.Vector3) => {
    // Arc parameter of the nearest tail point to p.
    let acc = 0,
      best = 0,
      bd = Infinity;
    for (let i = 0; i < TL.points.length; i++) {
      if (i) acc += TL.points[i]!.distanceTo(TL.points[i - 1]!);
      const dd = TL.points[i]!.distanceTo(p);
      if (dd < bd) {
        bd = dd;
        best = acc;
      }
    }
    return best / Math.max(1e-6, tailLen);
  };
  const j1 = tAt(tb[1]),
    j2 = tAt(tb[2]);
  taper(b, TL.points, TL.r0, TL.r1, {
    bones: chainBlend([Q.tail0, Q.tail1, Q.tail2], [j1, j2], 0.08),
    rings: seg(TL.rings ?? 7, d, 4),
    segments: seg(TL.segs ?? 6, d, 4),
    tone: TL.tone ?? 0,
    capEnd: TL.tuft ? false : TL.r1 * 0.8,
  });
  if (TL.tuft) tuft(b, TL.tuft.points, TL.tuft.r, Q.tail2, { tone: TL.tuft.tone, seed: ctx.seed, detail: d, strands: d > 0.7 ? TL.tuft.strands ?? 1 : 1, spread: TL.tuft.spread });

  spec.extras?.(b, { torso, neck, head, cell }, d, ctx);
  poolPart(b, Q.pool, ctx.seed, d);

  // Bone rest positions.
  const r: THREE.Vector3[] = [];
  r[Q.root] = V(0, 0, 0);
  r[Q.body] = V(0, T.yc, 0);
  r[Q.rump] = V(0, spec.rumpY ?? T.yc, T.loinZ);
  r[Q.neck1] = spec.neckBones[0].clone();
  r[Q.neck2] = spec.neckBones[1].clone();
  r[Q.head] = spec.neckBones[2].clone();
  r[Q.earL] = earBase[0]!.clone();
  r[Q.earR] = earBase[1]!.clone();
  r[Q.jaw] = head.frameAt(0.45).c.clone();
  const fj = spec.fore.joints(1);
  const hj = spec.hind.joints(1);
  [Q.fl0, Q.fl1, Q.fl2, Q.fl3].forEach((bi, i) => (r[bi] = fj[i]!.clone()));
  [Q.fr0, Q.fr1, Q.fr2, Q.fr3].forEach((bi, i) => (r[bi] = fj[i]!.clone().setX(-fj[i]!.x)));
  [Q.hl0, Q.hl1, Q.hl2, Q.hl3].forEach((bi, i) => (r[bi] = hj[i]!.clone()));
  [Q.hr0, Q.hr1, Q.hr2, Q.hr3].forEach((bi, i) => (r[bi] = hj[i]!.clone().setX(-hj[i]!.x)));
  r[Q.tail0] = tb[0].clone();
  r[Q.tail1] = tb[1].clone();
  r[Q.tail2] = tb[2].clone();
  r[Q.pool] = V(0, 0.005, 0);
  return { geometry: b.build(), rig: QUAD_RIG, rest: r, muzzle, height: spec.height, length: spec.length };
}
