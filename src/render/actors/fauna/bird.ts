/**
 * Generic bird body for the BIRD rig: an ovoid body loft, a neck and head,
 * a beak, wings authored spread (so flight reads true) and folded by pose,
 * a tail fan, feathered thighs, scaled shanks and toes.
 */
import * as THREE from "three";
import { keyed, loft, type LoftMesh, type SectionKey } from "./loft.ts";
import { SkinBuilder, chainBlend, type Tone } from "./skin.ts";
import { BIRD as W, BIRD_RIG } from "./rig.ts";
import { V, blob, eye, poolPart, seg, taper } from "./parts.ts";
import { surface, type BodyBuild, type BuildCtx } from "./body.ts";
import type { CoatCell } from "./coat.ts";

export interface BirdParts {
  body: LoftMesh;
  neck: LoftMesh;
  head: LoftMesh;
  cell: CoatCell;
}

export interface BirdSpec {
  body: { path: THREE.Vector3[]; keys: SectionKey[]; rings: number; segs: number; bump?: (s: number, a: number) => number };
  neck: { path: THREE.Vector3[]; keys: SectionKey[]; rings: number; segs: number; joints: [number, number] };
  neckBones: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  head: { path: THREE.Vector3[]; keys: SectionKey[]; rings: number; segs: number };
  beak: { points: THREE.Vector3[]; r0: number; r1: number; flat?: number; tone: Tone };
  eye: { s: number; theta: number; r: number };
  wing: {
    /** Shoulder, wrist, tip (left side, +x). */
    path: THREE.Vector3[];
    /** [s, thickness, leading, trailing]. */
    keys: SectionKey[];
    wrist: number;
    tone: Tone | ((s: number, v: number, p: THREE.Vector3) => number);
    /** Separated primaries at the tip (corvids). */
    fingers?: number;
    fingerLen?: number;
    /**
     * A folded wing modelled on the flank (fowl, geese): [front s, back s,
     * angle from the top of the body, height]. The spread wing then only
     * appears when the bird flaps.
     */
    folded?: [number, number, number, number];
  };
  tail: { path: THREE.Vector3[]; width: [number, number]; thick: number; tone: Tone | ((s: number, v: number, p: THREE.Vector3) => number); feathers?: number };
  leg: {
    /** Thigh (hidden hip), ankle, foot (left side). */
    thigh: THREE.Vector3;
    ankle: THREE.Vector3;
    foot: THREE.Vector3;
    drum: [number, number, number];
    shank: number;
    toe: number;
    webbed?: boolean;
    tone: Tone;
    drumTone: Tone;
  };
  bodyTone?: Tone;
  height: number;
  length: number;
  extras?: (b: SkinBuilder, parts: BirdParts, d: number, ctx: BuildCtx) => void;
}

export function buildBird(spec: BirdSpec, ctx: BuildCtx): BodyBuild {
  const d = ctx.detail;
  const b = new SkinBuilder();
  b.blank = ctx.atlas.blank;
  const cell = ctx.atlas.cell(ctx.variant, ctx.thin > 0.5);
  const tone = spec.bodyTone ?? 0;

  const body = loft({
    path: spec.body.path,
    rings: seg(spec.body.rings, d, 7),
    segments: seg(spec.body.segs, d, 8),
    section: keyed(spec.body.keys),
    bump: spec.body.bump ? (s, t) => spec.body.bump!(s, Math.abs(t)) : undefined,
    capStart: 0.01,
    capEnd: 0.01,
  });
  b.addLoft(body, { bones: W.body, uv: cell.body, tone });

  const neck = loft({ path: spec.neck.path, rings: seg(spec.neck.rings, d, 4), segments: seg(spec.neck.segs, d, 6), section: keyed(spec.neck.keys) });
  b.addLoft(neck, { bones: chainBlend([W.body, W.neck1, W.neck2], spec.neck.joints, [0.12, 0.2]), uv: cell.neck, tone });

  const head = loft({ path: spec.head.path, rings: seg(spec.head.rings, d, 4), segments: seg(spec.head.segs, d, 6), section: keyed(spec.head.keys), capStart: 0.004, capEnd: 0.003 });
  b.addLoft(head, { bones: W.head, uv: cell.head, tone });
  const B = spec.beak;
  taper(b, B.points, B.r0, B.r1, { bones: W.head, rings: seg(5, d, 3), segments: seg(7, d, 4), tone: B.tone, flat: B.flat ?? 1, profile: (s) => Math.pow(1 - s, 0.8) });
  for (const side of [1, -1]) {
    const e = surface(head, spec.eye.s, side * spec.eye.theta);
    eye(b, e.p.clone().addScaledVector(e.n, -spec.eye.r * 0.3), spec.eye.r, W.head, e.n, d);
  }

  // Folded wings lying on the flanks, feather-scalloped along the lower edge.
  const WG = spec.wing;
  if (WG.folded) {
    const [s0, s1, ang, hgt] = WG.folded;
    for (const side of [1, -1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const s = s0 + (s1 - s0) * (i / 6);
        const sp = surface(body, Math.max(0.02, Math.min(0.98, s)), side * ang);
        pts.push(sp.p.addScaledVector(sp.n, 0.006 + 0.004 * Math.sin((i / 6) * Math.PI)));
      }
      // The tips cross over the rump.
      const last = pts[pts.length - 1]!;
      pts.push(last.clone().add(V(-side * 0.01, 0.012, -hgt * 0.5)));
      const fw = loft({
        path: pts,
        rings: seg(9, d, 5),
        segments: seg(6, d, 4),
        up: V(side, 0.35, 0),
        section: (s) => {
          const h = hgt * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, s * 1.25))) * (1 - 0.6 * s * s);
          return { w: h * 0.5, up: 0.012, down: 0.004, eUp: 2, eDown: 2, dn: 0, db: -side * h * 0.25 };
        },
        bump: (s, t) => (Math.sin(t) * side < -0.2 ? 0.004 * Math.max(0, Math.sin(s * 40)) : 0),
        capStart: 0.01,
        capEnd: 0.006,
      });
      b.addLoft(fw, { bones: W.body, tone: WG.tone, uv: cell.extra });
    }
  }
  // Wings, spread along +x / -x.
  for (const side of [1, -1]) {
    const path = WG.path.map((p) => V(p.x * side, p.y, p.z));
    const wing = loft({
      path,
      rings: seg(8, d, 5),
      segments: seg(6, d, 5),
      up: V(0, 0, 1),
      section: keyed(WG.keys),
      capStart: 0.004,
      capEnd: 0.01,
    });
    const arm = side > 0 ? W.wingL : W.wingR;
    const hand = side > 0 ? W.handL : W.handR;
    b.addLoft(wing, { bones: chainBlend([arm, hand], [WG.wrist], 0.06), tone: WG.tone, uv: cell.extra });
    if (WG.fingers) {
      const tip = path[path.length - 1]!;
      const wrist = path[1]!;
      for (let i = 0; i < WG.fingers; i++) {
        const f = i / (WG.fingers - 1);
        const root = wrist.clone().lerp(tip, 0.55 + 0.1 * f).add(V(0, 0, -0.03 - 0.05 * f));
        const dir = V(side * (1 - 0.35 * f), 0, -0.25 - 0.9 * f).normalize();
        const len = (WG.fingerLen ?? 0.12) * (1 - 0.3 * Math.abs(f - 0.3));
        taper(b, [root, root.clone().addScaledVector(dir, len * 0.5), root.clone().addScaledVector(dir, len)], 0.016, 0.004, {
          bones: hand,
          rings: 3,
          segments: 4,
          tone: typeof WG.tone === "function" ? 1 : WG.tone,
          flat: 0.18,
          up: V(0, 1, 0),
        });
      }
    }
  }

  // Tail fan.
  const TL = spec.tail;
  const fan = loft({
    path: TL.path,
    rings: seg(6, d, 4),
    segments: seg(8, d, 5),
    up: V(0, 1, 0),
    section: (s) => ({ w: TL.width[0] + (TL.width[1] - TL.width[0]) * s, up: TL.thick, down: TL.thick, eUp: 2, eDown: 2, dn: 0, db: 0 }),
    capStart: false,
    capEnd: 0.01,
    bump: TL.feathers ? (s, t) => (Math.abs(Math.sin(t)) > 0.7 ? 0.004 * Math.sin(s * Math.PI * TL.feathers!) : 0) : undefined,
  });
  b.addLoft(fan, { bones: W.tail, tone: TL.tone });

  // Legs.
  const LG = spec.leg;
  for (const side of [1, -1]) {
    const m = (p: THREE.Vector3) => V(p.x * side, p.y, p.z);
    const thighB = side > 0 ? W.thighL : W.thighR;
    const shinB = side > 0 ? W.shinL : W.shinR;
    const footB = side > 0 ? W.footL : W.footR;
    blob(b, m(LG.thigh), LG.drum, thighB, LG.drumTone, { w: seg(6, d, 5), h: seg(5, d, 4), uv: undefined });
    taper(b, [m(LG.ankle).add(V(0, 0.02, 0)), m(LG.ankle), m(LG.foot)], LG.shank, LG.shank * 0.8, {
      bones: (s) => (s < 0.15 ? [thighB, shinB, s / 0.15] : [shinB, shinB, 0]),
      rings: seg(5, d, 3),
      segments: seg(5, d, 4),
      tone: LG.tone,
      profile: () => 1,
    });
    // Toes: three forward, one back.
    const f = m(LG.foot);
    const toes: Array<[number, number]> = [
      [0, 1],
      [0.5, 0.85],
      [-0.5, 0.85],
      [Math.PI, 0.5],
    ];
    for (const [a, l] of toes) {
      const dir = V(Math.sin(a) * side, 0, Math.cos(a));
      const len = LG.toe * l;
      taper(b, [f.clone().add(V(0, 0.004, 0)), f.clone().addScaledVector(dir, len * 0.5).add(V(0, 0.003, 0)), f.clone().addScaledVector(dir, len).add(V(0, 0.001, 0))], LG.shank * 0.7, LG.shank * 0.3, {
        bones: footB,
        rings: 3,
        segments: 4,
        tone: LG.tone,
        flat: 0.7,
      });
    }
    if (LG.webbed) {
      const g = new THREE.BufferGeometry();
      const L = LG.toe;
      const pts = [f.clone().add(V(0, 0.003, 0)), f.clone().add(V(side * Math.sin(0.5) * L * 0.85, 0.002, Math.cos(0.5) * L * 0.85)), f.clone().add(V(0, 0.002, L)), f.clone().add(V(-side * Math.sin(0.5) * L * 0.85, 0.002, Math.cos(0.5) * L * 0.85))];
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
      g.setIndex(side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      b.addPart(g, footB, { tone: LG.tone });
    }
  }

  spec.extras?.(b, { body, neck, head, cell }, d, ctx);
  poolPart(b, W.pool, ctx.seed, d * 0.6);

  const r: THREE.Vector3[] = [];
  const bodyC = body.frameAt(0.5).c;
  r[W.root] = V(0, 0, 0);
  r[W.body] = bodyC.clone();
  r[W.neck1] = spec.neckBones[0].clone();
  r[W.neck2] = spec.neckBones[1].clone();
  r[W.head] = spec.neckBones[2].clone();
  r[W.wingL] = WG.path[0]!.clone();
  r[W.handL] = WG.path[1]!.clone();
  r[W.wingR] = V(-WG.path[0]!.x, WG.path[0]!.y, WG.path[0]!.z);
  r[W.handR] = V(-WG.path[1]!.x, WG.path[1]!.y, WG.path[1]!.z);
  r[W.thighL] = LG.thigh.clone();
  r[W.shinL] = LG.ankle.clone();
  r[W.footL] = LG.foot.clone();
  r[W.thighR] = V(-LG.thigh.x, LG.thigh.y, LG.thigh.z);
  r[W.shinR] = V(-LG.ankle.x, LG.ankle.y, LG.ankle.z);
  r[W.footR] = V(-LG.foot.x, LG.foot.y, LG.foot.z);
  r[W.tail] = TL.path[0]!.clone();
  r[W.jaw] = B.points[0]!.clone();
  r[W.pool] = V(0, 0.004, 0);
  const tip = B.points[B.points.length - 1]!.clone();
  return { geometry: b.build(), rig: BIRD_RIG, rest: r, muzzle: tip, height: spec.height, length: spec.length };
}
