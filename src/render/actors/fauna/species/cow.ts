/**
 * Holstein-Friesian dairy cow. 1.45 m at the withers, 2.5 m nose to pins.
 * Angular dairy frame: level top line, prominent hooks and pins, a deep
 * barrel, a large udder between the hocks, short horns, horizontal ears,
 * a dewlap under the throat and a tail that hangs to the hock with a switch.
 */
import * as THREE from "three";
import { gauss2, keyed, loft, stations, type SectionKey } from "../loft.ts";
import { SkinBuilder, chainBlend } from "../skin.ts";
import { QUAD as Q, QUAD_RIG } from "../rig.ts";
import { V, blob, ear, eye, hoof, limb, poolPart, seg, taper, tuft } from "../parts.ts";
import type { QuadMotion, SpeciesDef } from "../types.ts";
import { surface, type BodyBuild, type BuildCtx } from "../body.ts";
import { at, fieldFill, quantile, registerCoats, ribs, spot, stroke, wrapNoise, type Paint } from "../coat.ts";

const Z0 = -0.98;
const Z1 = 0.9;
const YC = 1.05;

export function buildCow(ctx: BuildCtx): BodyBuild {
  const d = ctx.detail;
  const th = ctx.thin;
  const b = new SkinBuilder();
  b.blank = ctx.atlas.blank;
  const cell = ctx.atlas.cell(ctx.variant, th > 0.5);
  const sOf = (z: number) => (z - Z0) / (Z1 - Z0);
  const wk = 1 - 0.13 * th; // barrel narrows in drought
  const bk = th * 0.05; // belly tucks up

  // ---------------------------------------------------------------- torso
  // [z, yTop, yBot, halfWidth, eUp, eDown]
  const rows: Array<[number, number, number, number, number, number]> = [
    [-0.98, 1.3, 1.0, 0.05, 2, 2],
    [-0.95, 1.37, 0.9, 0.15, 2.6, 2.2],
    [-0.86, 1.42, 0.83, 0.2, 3.0, 2.3],
    [-0.7, 1.45, 0.77 + bk * 0.4, 0.25, 3.0, 2.4],
    [-0.55, 1.47, 0.72 + bk * 0.8, 0.285 * (1 - 0.05 * th), 2.9, 2.4],
    [-0.36, 1.44, 0.64 + bk, 0.33 * wk, 2.6, 2.3],
    [-0.1, 1.42, 0.6 + bk, 0.36 * wk, 2.5, 2.2],
    [0.16, 1.425, 0.61 + bk, 0.35 * wk, 2.4, 2.2],
    [0.4, 1.465, 0.67 + bk * 0.5, 0.3 * (1 - 0.08 * th), 2.3, 2.3],
    [0.6, 1.4, 0.72, 0.245, 2.2, 2.3],
    [0.76, 1.27, 0.78, 0.19, 2.1, 2.2],
    [0.86, 1.13, 0.86, 0.11, 2, 2],
    [0.9, 1.05, 0.95, 0.04, 2, 2],
  ];
  const keys: SectionKey[] = rows.map(([z, top, bot, w, eu, ed]) => [sOf(z), w, top - YC, YC - bot, eu, ed]);
  const hookA = 0.042 + 0.035 * th;
  const pinA = 0.03 + 0.025 * th;
  const spineA = 0.006 + 0.02 * th;
  const torsoBump = (s: number, t: number) => {
    const z = Z0 + (Z1 - Z0) * s;
    const a = Math.abs(t);
    let r = 0;
    r += hookA * gauss2(s, a, sOf(-0.56), 0.98, 0.035, 0.26);
    r += pinA * gauss2(s, a, sOf(-0.93), 0.72, 0.022, 0.3);
    r += 0.016 * gauss2(s, a, sOf(-0.76), 1.45, 0.05, 0.3); // thurl
    // Spine ridge; vertebrae show when thin.
    const vert = th > 0.3 ? 0.5 + 0.5 * Math.cos(z * Math.PI * 2 / 0.085) : 1;
    r += spineA * vert * Math.exp(-((a / 0.12) ** 2)) * (z > -0.9 && z < 0.5 ? 1 : 0);
    // Tail-head hollows either side of the spine.
    r -= (0.01 + 0.02 * th) * gauss2(s, a, sOf(-0.82), 0.42, 0.035, 0.16);
    // Paralumbar hollow in front of the hip.
    r -= (0.012 + 0.04 * th) * gauss2(s, a, sOf(-0.38), 1.22, 0.06, 0.3);
    // Shoulder blade and point of shoulder.
    r += 0.012 * gauss2(s, a, sOf(0.45), 1.05, 0.06, 0.3);
    r += 0.022 * gauss2(s, a, sOf(0.72), 1.9, 0.04, 0.35);
    if (th > 0) {
      // Ribs: slanting back and down across the barrel.
      const band = gauss2(s, a, sOf(0.1), 1.65, 0.19, 0.5);
      const phase = (z + 0.07 * (a - 1.2)) / 0.105;
      r += th * 0.011 * band * Math.cos(phase * Math.PI * 2);
    }
    return r;
  };
  const torso = loft({
    path: [V(0, YC, Z0), V(0, YC, Z1)],
    rings: stations(seg(22, d, 10), { endBias: 1.2, dense: th > 0.3 ? [[0.55, 0.14, 1.0]] : [[0.23, 0.05, 0.6]] }),
    segments: seg(16, d, 10),
    section: keyed(keys),
    bump: torsoBump,
    capStart: 0.02,
    capEnd: 0.03,
  });
  b.addLoft(torso, {
    bones: chainBlend([Q.rump, Q.body], [sOf(-0.3)], 0.08),
    uv: cell.body,
  });

  // ----------------------------------------------------------------- neck
  const neck = loft({
    path: [V(0, 1.12, 0.44), V(0, 1.18, 0.76), V(0, 1.22, 1.0)],
    rings: seg(9, d, 5),
    segments: seg(12, d, 8),
    section: keyed([
      [0, 0.24, 0.34, 0.38, 2.3, 2.1],
      [0.3, 0.19 * (1 - 0.06 * th), 0.26, 0.37, 2.3, 1.6],
      [0.65, 0.155 * (1 - 0.06 * th), 0.19, 0.27, 2.2, 1.6],
      [1, 0.135, 0.14, 0.17, 2, 1.9],
    ]),
    bump: (s, t) => {
      // Dewlap folds and the jugular groove.
      const a = Math.abs(t);
      return -0.01 * gauss2(s, a, 0.55, 1.75, 0.2, 0.15) + 0.008 * Math.sin(s * 22) * Math.exp(-(((Math.PI - a) / 0.35) ** 2)) * s;
    },
  });
  b.addLoft(neck, { bones: chainBlend([Q.body, Q.neck1, Q.neck2], [0.16, 0.6], [0.12, 0.2]), uv: cell.neck });

  // ----------------------------------------------------------------- head
  const hs = V(0, 1.4, 0.97);
  const he = V(0, 0.98, 1.38);
  const head = loft({
    path: [hs, hs.clone().lerp(he, 0.5).add(V(0, 0.012, 0.012)), he],
    rings: seg(10, d, 6),
    segments: seg(12, d, 8),
    section: keyed([
      [0, 0.09, 0.05, 0.09, 2, 2],
      [0.08, 0.13, 0.072, 0.16, 2.4, 2.1],
      [0.3, 0.13, 0.078, 0.2, 2.6, 2.2],
      [0.56, 0.095, 0.068, 0.14, 2.5, 2.1],
      [0.8, 0.09, 0.07, 0.1, 2.4, 2.1],
      [0.94, 0.1, 0.066, 0.082, 2.5, 2.2],
      [1, 0.082, 0.048, 0.06, 2, 2],
    ]),
    bump: (s, t) => {
      const a = Math.abs(t);
      // Brow over the eye, cheek bone, nostril flare.
      return 0.012 * gauss2(s, a, 0.27, 1.05, 0.05, 0.25) + 0.01 * gauss2(s, a, 0.42, 1.9, 0.08, 0.3) + 0.01 * gauss2(s, a, 0.93, 0.7, 0.04, 0.3);
    },
    capStart: 0.02,
    capEnd: 0.02,
  });
  b.addLoft(head, { bones: Q.head, uv: cell.head });
  const muzzle = he.clone().add(V(0, -0.01, 0.015));

  for (const side of [1, -1]) {
    const e = surface(head, 0.31, side * 1.3);
    eye(b, e.p.clone().addScaledVector(e.n, -0.004), 0.021, Q.head, e.n, d);
    // Horns: out, then forward and up.
    const hb = surface(head, 0.045, side * 0.95).p;
    taper(b, [hb.clone().add(V(-side * 0.02, -0.01, 0)), hb.clone().add(V(side * 0.06, 0.015, 0.01)), hb.clone().add(V(side * 0.1, 0.05, 0.05)), hb.clone().add(V(side * 0.1, 0.085, 0.085))], 0.034, 0.005, {
      bones: Q.head,
      rings: seg(5, d, 4),
      segments: seg(6, d, 4),
      tone: (s) => (s > 0.72 ? 0.75 : s > 0.55 ? 0.3 : 0.08),
      profile: (s) => Math.pow(1 - s, 0.8),
    });
    // Ears: horizontal, under and behind the horns, opening forward.
    const eb = surface(head, 0.11, side * 1.62).p;
    ear(b, eb.clone().addScaledVector(V(side, 0, 0), -0.02), V(side, -0.2, -0.25), V(0, -0.1, 1), {
      length: 0.24,
      width: 0.135,
      bone: side > 0 ? Q.earL : Q.earR,
      detail: d,
      tone: (s) => (s > 0.1 ? 0.04 : 0),
    });
  }

  // ----------------------------------------------------------------- legs
  const legW = 1 - 0.08 * th;
  const fore = (x: number) => [V(x * 0.2, 1.06, 0.64), V(x * 0.2, 0.74, 0.49), V(x * 0.19, 0.42, 0.53), V(x * 0.19, 0.12, 0.55), V(x * 0.19, 0.035, 0.6)];
  const hind = (x: number) => [V(x * 0.21, 1.2, -0.64), V(x * 0.23, 0.8, -0.44), V(x * 0.19, 0.5, -0.8), V(x * 0.185, 0.12, -0.75), V(x * 0.185, 0.035, -0.7)];
  const hoofTone = 0.72;
  const legTone = (s: number) => (s > 0.93 ? hoofTone : 0);
  for (const x of [1, -1]) {
    const fb = x > 0 ? [Q.fl0, Q.fl1, Q.fl2, Q.fl3] : [Q.fr0, Q.fr1, Q.fr2, Q.fr3];
    const hb = x > 0 ? [Q.hl0, Q.hl1, Q.hl2, Q.hl3] : [Q.hr0, Q.hr1, Q.hr2, Q.hr3];
    const fj = fore(x);
    limb(b, {
      joints: fj,
      bones: fb,
      keys: [
        [0, 0.13 * legW, 0.15, 0.17],
        [0.55, 0.12 * legW, 0.12, 0.17],
        [1, 0.09 * legW, 0.09, 0.12, 2, 1.7],
        [1.5, 0.06 * legW, 0.058, 0.055],
        [2, 0.062 * legW, 0.058, 0.056],
        [2.2, 0.047 * legW, 0.042, 0.045],
        [2.8, 0.045 * legW, 0.04, 0.048],
        [3, 0.054, 0.048, 0.06],
        [3.6, 0.046, 0.045, 0.042],
        [4, 0.04, 0.04, 0.03],
      ],
      rings: seg(12, d, 7),
      segments: seg(6, d, 5),
      blend: 0.05,
      tone: legTone,
    });
    limb(b, {
      joints: hind(x),
      bones: hb,
      keys: [
        [0, 0.15 * legW, 0.16, 0.3],
        [0.6, 0.14 * legW, 0.12, 0.4],
        [1, 0.115 * legW, 0.1, 0.45, 2.2, 2.6],
        [1.35, 0.1 * legW, 0.085, 0.3, 2, 2.2],
        [1.75, 0.07 * legW, 0.06, 0.12],
        [2, 0.055 * legW, 0.05, 0.07, 2, 1.6],
        [2.2, 0.046 * legW, 0.045, 0.05],
        [2.8, 0.044 * legW, 0.042, 0.048],
        [3, 0.053, 0.048, 0.06],
        [3.6, 0.046, 0.045, 0.042],
        [4, 0.04, 0.04, 0.03],
      ],
      rings: seg(12, d, 7),
      segments: seg(6, d, 5),
      blend: 0.06,
      tone: legTone,
    });
    // Cloven hooves and dewclaws.
    hoof(b, V(fj[4]!.x, 0, fj[4]!.z + 0.02), { bone: fb[3]!, width: 0.1, length: 0.13, height: 0.075, cloven: true, tone: hoofTone, detail: d });
    const hj = hind(x);
    hoof(b, V(hj[4]!.x, 0, hj[4]!.z + 0.02), { bone: hb[3]!, width: 0.1, length: 0.13, height: 0.075, cloven: true, tone: hoofTone, detail: d });
    if (d > 1.2) for (const [j, bone] of [
      [fj[3]!, fb[3]!],
      [hj[3]!, hb[3]!],
    ] as const) {
      for (const sx of [-1, 1]) blob(b, V(j.x + sx * 0.02, j.y - 0.02, j.z - 0.06), [0.014, 0.02, 0.014], bone, "deep", { w: 5, h: 4 });
    }
  }

  // ---------------------------------------------------------------- udder
  const ud = 1 - 0.35 * th;
  blob(b, V(0, 0.66 + 0.04 * th, -0.6), [0.18 * ud, 0.15 * ud, 0.22 * ud], Q.rump, 0.03, { w: seg(10, d, 7), h: seg(7, d, 5) });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const tb = V(sx * 0.075 * ud, 0.56 + 0.05 * th, -0.56 + sz * 0.08 * ud);
      taper(b, [tb, tb.clone().add(V(sx * 0.005, -0.04, 0)), tb.clone().add(V(sx * 0.008, -0.075, 0))], 0.017, 0.012, {
        bones: Q.rump,
        rings: 2,
        segments: 4,
        tone: 0.2,
        profile: () => 1,
      });
    }

  // ----------------------------------------------------------------- tail
  const tailPts = [V(0, 1.4, -0.93), V(0, 1.42, -0.985), V(0, 1.24, -1.0), V(0, 0.9, -0.99), V(0, 0.62, -0.965)];
  const tailBones = chainBlend([Q.tail0, Q.tail1, Q.tail2], [0.3, 0.64], 0.08);
  taper(b, tailPts, 0.04, 0.017, { bones: tailBones, rings: seg(8, d, 5), segments: seg(5, d, 4), tone: 0, capEnd: false });
  const switchTone = ctx.variant % 3 === 1 ? 0.05 : 1;
  tuft(b, [V(0, 0.68, -0.968), V(0, 0.52, -0.962), V(0, 0.36, -0.95)], 0.05, Q.tail2, { tone: switchTone, seed: ctx.seed, detail: d, strands: 1 });

  poolPart(b, Q.pool, ctx.seed, d);
  const rest = restCow();
  return { geometry: b.build(), rig: QUAD_RIG, rest, muzzle, height: 1.47, length: 2.5 };
}

function restCow(): THREE.Vector3[] {
  const r: THREE.Vector3[] = [];
  r[Q.root] = V(0, 0, 0);
  r[Q.body] = V(0, YC, 0);
  r[Q.rump] = V(0, 1.2, -0.3);
  r[Q.neck1] = V(0, 1.15, 0.52);
  r[Q.neck2] = V(0, 1.18, 0.79);
  r[Q.head] = V(0, 1.28, 1.03);
  r[Q.earL] = V(0.13, 1.32, 1.03);
  r[Q.earR] = V(-0.13, 1.32, 1.03);
  r[Q.jaw] = V(0, 1.18, 1.08);
  const f = [V(0.2, 1.06, 0.64), V(0.2, 0.74, 0.49), V(0.19, 0.42, 0.53), V(0.19, 0.12, 0.55)];
  const h = [V(0.21, 1.2, -0.64), V(0.23, 0.8, -0.44), V(0.19, 0.5, -0.8), V(0.185, 0.12, -0.75)];
  [Q.fl0, Q.fl1, Q.fl2, Q.fl3].forEach((bi, i) => (r[bi] = f[i]!.clone()));
  [Q.fr0, Q.fr1, Q.fr2, Q.fr3].forEach((bi, i) => (r[bi] = f[i]!.clone().setX(-f[i]!.x)));
  [Q.hl0, Q.hl1, Q.hl2, Q.hl3].forEach((bi, i) => (r[bi] = h[i]!.clone()));
  [Q.hr0, Q.hr1, Q.hr2, Q.hr3].forEach((bi, i) => (r[bi] = h[i]!.clone().setX(-h[i]!.x)));
  r[Q.tail0] = V(0, 1.4, -0.95);
  r[Q.tail1] = V(0, 1.14, -1.03);
  r[Q.tail2] = V(0, 0.82, -1.01);
  r[Q.pool] = V(0, 0.01, 0);
  return r;
}

// ------------------------------------------------------------------ coats

/** Holstein: 8 seeded patch layouts, each with its own head marking. */
function paintHolstein(p: Paint): void {
  const { g, noise, variant, rng } = p;
  const coverage = [0.52, 0.38, 0.6, 0.45, 0.33, 0.56, 0.47, 0.64][variant % 8]!;
  const freq = rng.range(1.05, 1.6);
  const off = rng.range(0, 50);
  const field = (s: number, v: number) => {
    const n = wrapNoise(noise, s, v, 2.0, 0.42, freq, 3, off) + 0.35 * wrapNoise(noise, s, v, 2.0, 0.42, freq * 2.7, 2, off + 9);
    const top = Math.cos((v - 0.5) * Math.PI * 2); // 1 on the spine, -1 under the belly
    let bias = 0.22 * top;
    bias -= 0.5 * Math.max(0, -top - 0.35); // white belly
    bias -= 0.35 * Math.exp(-((s / 0.07) ** 2)); // white rear
    return n + bias;
  };
  const thr = quantile(field, coverage);
  fieldFill(g, p.body, (s, v) => field(s, v) - thr, { grid: 56, edge: 0.03 });
  // Neck continues the pattern forward.
  const nField = (s: number, v: number) => field(Math.min(1, 0.92 + s * 0.3), v) + 0.15 * wrapNoise(noise, s, v, 0.6, 0.25, 2.2, 2, off + 3);
  fieldFill(g, p.neck, (s, v) => nField(s, v) - thr, { grid: 20, edge: 0.04 });

  // Head markings.
  const style = variant % 4;
  const eyeV = 0.21;
  if (style === 0 || style === 2) {
    // Black head with a white blaze or star.
    fieldFill(g, p.head, (s, v) => {
      const dv = Math.abs(v - 0.5);
      const blazeW = style === 0 ? 0.05 + 0.12 * s : 0.07 * Math.exp(-(((s - 0.25) / 0.09) ** 2));
      const blaze = dv < blazeW && s > 0.12 ? -1 : 0;
      const muzzle = s > 0.86 ? -1 : 0;
      const jaw = Math.min(v, 1 - v) < 0.1 && s > 0.35 ? -1 : 0;
      return Math.min(1, 0.6 + blaze * 2 + muzzle * 2 + jaw * 2);
    }, { grid: 24, edge: 0.05 });
  } else if (style === 1) {
    // White face, black around the eyes and poll.
    fieldFill(g, p.head, (s, v) => {
      const e1 = 1 - Math.hypot((s - 0.3) / 0.16, (v - (0.5 + eyeV)) / 0.12);
      const e2 = 1 - Math.hypot((s - 0.3) / 0.16, (v - (0.5 - eyeV)) / 0.12);
      const poll = s < 0.1 ? 1 : -1;
      return Math.max(e1, e2, poll);
    }, { grid: 24, edge: 0.05 });
  } else {
    // Split face: one side black.
    fieldFill(g, p.head, (s, v) => (v < 0.48 + 0.04 * Math.sin(s * 9) && s < 0.85 ? 1 : -1), { grid: 24, edge: 0.04 });
  }
  // Eyes need a dark surround to read; muzzle pad, nostril rims and mouth line.
  for (const ev of [0.5 - eyeV, 0.5 + eyeV]) spot(g, p.head, 0.31, ev, 0.07, 0.05, 0.85);
  stroke(g, p.head, [[0.82, 0.12], [0.92, 0.1], [1, 0.12]], 1.6, 0.8);
  stroke(g, p.head, [[0.82, 0.88], [0.92, 0.9], [1, 0.88]], 1.6, 0.8);
  // Dewlap and neck folds.
  for (let i = 0; i < 5; i++) {
    const s = 0.25 + i * 0.14;
    stroke(g, p.neck, [[s, 0.02], [s + 0.04, 0.09], [s + 0.02, 0.15]], 1.2, 0.45);
    stroke(g, p.neck, [[s, 0.98], [s + 0.04, 0.91], [s + 0.02, 0.85]], 1.2, 0.45);
  }
  // A faint fold line where the flank meets the stifle.
  stroke(g, p.body, [[0.33, 0.66], [0.3, 0.74], [0.3, 0.82]], 1.1, 0.35);
  stroke(g, p.body, [[0.33, 0.34], [0.3, 0.26], [0.3, 0.18]], 1.1, 0.35);
  // The milk vein along the belly.
  stroke(g, p.body, [[0.3, 0.05], [0.42, 0.07], [0.55, 0.05]], 1.2, 0.35);
  stroke(g, p.body, [[0.3, 0.95], [0.42, 0.93], [0.55, 0.95]], 1.2, 0.35);

  if (p.thin) {
    ribs(g, p.body, { s0: 0.43, s1: 0.72, count: 9, vTop: 0.63, vBot: 0.84, slant: 0.04, width: 2, alpha: 0.7 });
    // Hooks and pins outlined, spine vertebrae ticked.
    for (const side of [0, 1]) {
      const vv = (v: number) => (side ? v : 1 - v);
      stroke(g, p.body, [[0.18, vv(0.62)], [0.23, vv(0.66)], [0.29, vv(0.62)]], 1.8, 0.7);
      stroke(g, p.body, [[0.26, vv(0.72)], [0.3, vv(0.78)], [0.36, vv(0.72)]], 1.4, 0.5);
      stroke(g, p.body, [[0.02, vv(0.6)], [0.05, vv(0.63)], [0.08, vv(0.6)]], 1.6, 0.6);
    }
    for (let s = 0.12; s < 0.78; s += 0.035) stroke(g, p.body, [[s, 0.49], [s, 0.51]], 1.6, 0.6, false);
  }
  void at;
}

registerCoats("cow", { variants: 8, thin: true, painter: paintHolstein });

export const COW_MOTION: QuadMotion = {
  walk: [1.1, 0.85],
  trot: [2.6, 1.45],
  run: [5.5, 1.9],
  runGait: "gallop",
  foreLen: 1.05,
  hindLen: 1.2,
  flex: 1,
  grazeY: 0.05,
  reach: [1.0, 0.05, -0.25],
  alert: [-0.2, -0.08, -0.12],
  stand: [0.12, 0.04, 0.05],
  lie: "sternal",
  lieDrop: 0.56,
  tailSwish: 0.75,
  tailRun: -0.45,
  tailStyle: "hang",
  skittish: 0.2,
  halfWidth: 0.38,
  scaleVar: 0.05,
  earRest: [-0.1, 0.05],
  earAlert: [0.12, 0.45],
};

export const COW: SpeciesDef = { id: "cow", kind: "quad", build: buildCow, variants: 8, hatch: 0.04, quad: COW_MOTION, thinVariant: true };
