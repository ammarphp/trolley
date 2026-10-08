/**
 * Account avatars: cut-paper profile silhouettes, the oldest portrait form
 * that fits an ink world. Each human profile is built from a parametric
 * head (brow, nose, lips, chin, neck), a hairstyle and a few paper-white
 * details (glasses, collar, earring, hairline), all seeded by the handle.
 * No skin is drawn, so no one is reduced to a tone.
 *
 * Bots wear one stock profile: the average face, facing the same way,
 * perfectly centred and upright, on one of three nearly identical greys.
 * One at a time, a bot looks like anybody. In a column they are the same
 * person, and that is the tell.
 */
import { createRng, type Rng } from "../../render/core/rng.ts";
import { INK, INK_4, PAPER, PAPER_2, PAPER_3 } from "./palette.ts";
import { el, n, svgDoc } from "./svg.ts";
import { clipConvex, ellipse, hatch, poly, smooth, smoothRing, type Pt, type Ring } from "./geom.ts";

export interface AvatarOptions {
  bot?: boolean;
  /** The shared default face of collapsed bot accounts. */
  blank?: boolean;
  /** Rendered size in px. Default 40. */
  size?: number;
  shape?: "circle" | "square";
  title?: string;
}

const S = 40;

/* ------------------------------------------------------------ canvas */

class Canvas {
  out: string[] = [];
  readonly clip: Ring;
  constructor(clip: Ring) {
    this.clip = clip;
  }
  fill(ring: Ring, color: string): void {
    const c = clipConvex(ring, this.clip);
    if (c.length > 2) this.out.push(el("path", { d: poly(c), fill: color }));
  }
  line(pts: readonly Pt[], w: number, color: string, close = false): void {
    if (pts.length < 2) return;
    this.out.push(el("path", { d: poly(pts, close), fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  }
  curve(pts: readonly Pt[], w: number, color: string): void {
    if (pts.length < 2) return;
    this.out.push(el("path", { d: smooth(pts), fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round" }));
  }
  hatch(ring: Ring, angle: number, spacing: number, w: number, color: string): void {
    const c = clipConvex(ring, this.clip);
    if (c.length < 3) return;
    let d = "";
    for (const [a, b] of hatch([c], angle, spacing)) d += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
    if (d) this.out.push(el("path", { d, fill: "none", stroke: color, "stroke-width": w }));
  }
  raw(s: string): void {
    this.out.push(s);
  }
}

function clipShape(shape: "circle" | "square"): Ring {
  if (shape === "circle") return ellipse(20, 20, 19.6, 19.6, 72);
  const r = 8;
  const pts: Pt[] = [];
  const corners: Array<[number, number, number]> = [
    [S - r - 0.4, r + 0.4, -Math.PI / 2],
    [S - r - 0.4, S - r - 0.4, 0],
    [r + 0.4, S - r - 0.4, Math.PI / 2],
    [r + 0.4, r + 0.4, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= 6; k++) pts.push([cx + Math.cos(a0 + (k / 6) * (Math.PI / 2)) * r, cy + Math.sin(a0 + (k / 6) * (Math.PI / 2)) * r]);
  return pts;
}

/* ----------------------------------------------------------- profile */

type Hair = "short" | "fringe" | "bun" | "ponytail" | "long" | "curls" | "afro" | "bald" | "cap" | "scarf" | "bob";
const HAIRS: readonly Hair[] = ["short", "fringe", "bun", "ponytail", "long", "curls", "afro", "bald", "cap", "scarf", "bob", "short", "fringe", "long"];

interface Profile {
  nose: number; // length factor
  drop: number; // nose tip drop
  bump: number; // aquiline bridge
  lips: number;
  chin: number;
  brow: number; // forehead slope
  neckBack: number;
  neckFront: number;
  skull: number; // size factor
  tilt: number; // radians
  dx: number;
  hair: Hair;
  beard: boolean;
  glasses: boolean;
  earring: boolean;
  collar: 0 | 1 | 2;
  hairline: boolean;
}

/** The average face every bot wears. */
const STOCK: Profile = {
  nose: 1,
  drop: 0,
  bump: 0,
  lips: 0.8,
  chin: 0,
  brow: 0,
  neckBack: 13.8,
  neckFront: 22.6,
  skull: 1,
  tilt: 0,
  dx: 0,
  hair: "short",
  beard: false,
  glasses: false,
  earring: false,
  collar: 1,
  hairline: true,
};

function randomProfile(rng: Rng): Profile {
  const hair = rng.pick(HAIRS);
  return {
    nose: rng.range(0.72, 1.32),
    drop: rng.range(-0.5, 0.7),
    bump: rng.chance(0.3) ? rng.range(0.3, 0.9) : 0,
    lips: rng.range(0.4, 1.35),
    chin: rng.range(-0.9, 0.8),
    brow: rng.range(-0.9, 0.5),
    neckBack: rng.range(13, 14.8),
    neckFront: rng.range(22.1, 23.1),
    skull: rng.range(0.95, 1.05),
    tilt: rng.range(-0.08, 0.08),
    dx: rng.range(-1.2, 0.8),
    hair,
    beard: hair !== "scarf" && rng.chance(0.16),
    glasses: rng.chance(0.26),
    earring: hair !== "scarf" && rng.chance(0.2),
    collar: rng.int(0, 2) as 0 | 1 | 2,
    hairline: rng.chance(0.55),
  };
}

const SKULL_C: Pt = [18.5, 15.8];

/** Points of the head, face and shoulders for a right-facing profile. */
function silhouette(p: Profile): { body: Pt[]; head: (q: Pt) => Pt } {
  const pivot: Pt = [20, 27];
  const ct = Math.cos(p.tilt);
  const st = Math.sin(p.tilt);
  const head = (q: Pt): Pt => {
    const x = q[0] - pivot[0];
    const y = q[1] - pivot[1];
    return [pivot[0] + x * ct - y * st + p.dx, pivot[1] + x * st + y * ct];
  };
  const rx = 8.4 * p.skull;
  const ry = 8.8 * p.skull;
  // From the nape up over the crown to the top of the forehead.
  const skull: Pt[] = [];
  for (let a = 128; a <= 326; a += 9) {
    const t = (a * Math.PI) / 180;
    skull.push([SKULL_C[0] + Math.cos(t) * rx, SKULL_C[1] + Math.sin(t) * ry]);
  }
  const b = p.brow;
  const nz = p.nose;
  const face: Pt[] = [
    [25.2 + b * 0.5, 10.8],
    [26.2 + b * 0.45, 12.6],
    [26.6 + b * 0.2, 14.4],
    [26.1, 15.5],
    [26.1 + 1.2 * nz + p.bump, 17.0 + p.drop * 0.3],
    [26.1 + 2.8 * nz, 18.5 + p.drop],
    [26.0 + 2.6 * nz, 19.15 + p.drop],
    [27.0 + 0.2 * nz, 19.8 + p.drop * 0.4],
    [27.1 + p.lips * 0.1, 20.5],
    [27.3 + p.lips * 0.45, 21.1],
    [26.7, 21.8],
    [27.0 + p.lips * 0.4, 22.5],
    [26.3 + p.chin * 0.3, 23.5],
    [26.8 + p.chin, 25.0],
    [25.9 + p.chin * 0.6, 26.4],
    [23.5, 27.2],
    [22.7, 28.3],
  ];
  const beard: Pt[] = [
    [27.9 + p.chin * 0.6, 24.8],
    [27.2 + p.chin * 0.5, 27.2],
    [24.8, 28.8],
    [22.8, 28.6],
  ];
  const headPts = [...skull, ...(p.beard ? [...face.slice(0, -5), ...beard] : face)].map(head);
  const body: Pt[] = [
    [-2, 42],
    [-1.6, 38.6],
    [3.6, 36.4],
    [9.2, 34.6],
    [p.neckBack - 1.2, 32.4],
    [p.neckBack - 0.3, 28.4],
    ...headPts,
    [p.neckFront, 30.2],
    [p.neckFront + 0.4, 32.8],
    [26.8, 34.8],
    [32.4, 36.4],
    [41.5, 39.4],
    [42, 42],
  ];
  return { body, head };
}

function hairShapes(p: Profile, head: (q: Pt) => Pt): Pt[][] {
  const c = SKULL_C;
  const rx = 8.4 * p.skull;
  const ry = 8.8 * p.skull;
  const arc = (from: number, to: number, grow: number, step = 8): Pt[] => {
    const out: Pt[] = [];
    for (let a = from; a <= to; a += step) {
      const t = (a * Math.PI) / 180;
      out.push([c[0] + Math.cos(t) * (rx + grow), c[1] + Math.sin(t) * (ry + grow)]);
    }
    return out;
  };
  const H = (pts: Pt[]) => pts.map(head);
  switch (p.hair) {
    case "short":
      return [H([...arc(150, 318, 0.9), [24.8, 10.6], [20, 11.5], [15, 14], [13, 19]])];
    case "fringe":
      return [H([...arc(150, 316, 1), [27.4, 11.6], [26.2, 12.5], [23.6, 11.8], [18, 13], [13.5, 19]])];
    case "bun":
      return [H([...arc(160, 318, 0.6), [24.6, 10.6], [18, 12.5], [13, 19]]), H(ellipse(10.6, 10.8, 3.4, 3.2, 20) as Pt[])];
    case "ponytail":
      return [H([...arc(160, 318, 0.6), [24.6, 10.6], [18, 12.5], [13, 19]]), H([[11.8, 11.2], [8.6, 13], [6.6, 18.6], [7.2, 24.4], [8.6, 20], [10.6, 16.6], [12.6, 14.4]])];
    case "long":
      return [H([...arc(150, 318, 1.1), [24.8, 10.4], [20.4, 12], [17.6, 16.4], [16.9, 22], [16.4, 28], [15.9, 32.8], [12.4, 34.4], [9.8, 32], [9.3, 26.4], [9.8, 21.8]])];
    case "bob":
      return [H([...arc(118, 320, 1.4), [25.4, 11], [21.4, 12.2], [20.2, 17.5], [21, 22.6], [16.4, 24.4], [11.4, 23.4]])];
    case "curls": {
      const out: Pt[][] = [H([...arc(140, 320, 0.8), [24.8, 10.6], [18, 12.5], [13, 20]])];
      for (let a = 150; a <= 316; a += 16) {
        const t = (a * Math.PI) / 180;
        out.push(H(ellipse(c[0] + Math.cos(t) * (rx + 1), c[1] + Math.sin(t) * (ry + 1), 2.2, 2.2, 14) as Pt[]));
      }
      return out;
    }
    case "afro":
      return [H(ellipse(16.6, 13.2, 11.2, 10.4, 36) as Pt[])];
    case "cap":
      return [
        H([
          [9.8, 13.6],
          [11.2, 8.8],
          [16.4, 5.6],
          [22.8, 6.2],
          [26.4, 8.6],
          [30.6, 10.4],
          [30.2, 11.3],
          [25.6, 11.1],
          [18, 12.2],
          [11.8, 15.2],
        ]),
      ];
    case "scarf":
      return [
        H([
          ...arc(118, 322, 1.7),
          [25.9, 10.1],
          [24.6, 13],
          [23.8, 17],
          [24.4, 22],
          [25.6, 26.4],
          [25.9, 29.6],
          [26.4, 33.4],
          [30, 36.2],
          [10, 36.6],
          [10.6, 31],
        ]),
      ];
    case "bald":
      return [];
  }
}

function drawProfile(cv: Canvas, p: Profile, mirror: boolean): void {
  const M = (q: Pt): Pt => (mirror ? [S - q[0], q[1]] : q);
  const { body, head } = silhouette(p);
  const shapes = hairShapes(p, head);
  const ringOf = (pts: readonly Pt[]) => smoothRing(pts.map(M), 3);
  // Hair and figure are one ink silhouette.
  for (const s of shapes) cv.fill(ringOf(s), INK);
  cv.fill(ringOf(body), INK);
  // Paper details, cut into the silhouette.
  const W = 0.55;
  const D = (pts: Pt[]) => pts.map(head).map(M);
  if (p.hairline && p.hair !== "bald" && p.hair !== "scarf" && p.hair !== "cap" && p.hair !== "afro")
    cv.curve(D([[25, 11], [22.6, 12.1], [21.1, 14.1], [20.7, 16.9], [21.2, 18.4]]), W * 0.9, PAPER);
  if (p.hair === "scarf") cv.curve(D([[25.5, 10.9], [24.3, 13.2], [23.6, 17], [24.2, 21.8], [25.2, 25.6], [25.4, 27.8]]), W, PAPER);
  if (p.hair === "cap") cv.line(D([[25.2, 10.6], [18, 11.6], [12, 14.4]]), W, PAPER);
  if (p.glasses) {
    cv.line(D([[23.4, 14.6], [26.1, 14.7], [26, 16.6], [23.5, 16.6]]), W, PAPER, true);
    cv.line(D([[23.4, 15.2], [19.4, 15.6]]), W, PAPER);
  }
  if (p.earring) {
    const e = D([[19.5, 21.2]])[0]!;
    cv.raw(el("circle", { cx: e[0], cy: e[1], r: 0.62, fill: PAPER }));
  }
  const collar: Pt[][] =
    p.collar === 0
      ? [[[p.neckFront + 0.4, 32.2], [24.6, 34.9], [22.4, 38.6]]]
      : p.collar === 1
        ? [[[p.neckBack - 0.2, 30.4], [18, 31.6], [p.neckFront + 0.3, 31]], [[p.neckFront + 0.4, 32], [25.6, 36.4]]]
        : [[[p.neckBack + 0.2, 28.4], [18.2, 29.4], [p.neckFront - 0.2, 28.8]]];
  for (const c of collar) cv.line(c.map((q) => M([q[0] + p.dx, q[1]])), W, PAPER);
  if (p.beard) cv.line(D([[19.8, 20.2], [21.8, 22.8], [24.4, 23.6]]), W * 0.8, PAPER);
}

/* ---------------------------------------------------------- variants */

function human(cv: Canvas, rng: Rng): void {
  const bg = rng.int(0, 5);
  if (bg <= 1) cv.fill(cv.clip, PAPER_2);
  else if (bg <= 3) cv.fill(cv.clip, PAPER_3);
  else if (bg === 4) {
    cv.fill(cv.clip, PAPER);
    cv.hatch(cv.clip, rng.pick([45, 135]), 1.6, 0.22, INK_4);
  } else {
    cv.fill(cv.clip, PAPER);
    cv.raw(el("circle", { cx: 20, cy: 20, r: 17.4, fill: "none", stroke: INK_4, "stroke-width": 0.5 }));
  }
  drawProfile(cv, randomProfile(rng), rng.chance(0.42));
}

function stock(cv: Canvas, handle: string): void {
  const r = createRng(`bot-bg:${handle}`);
  cv.fill(cv.clip, [PAPER_3, "#ecece8", "#e9e9e5"][r.int(0, 2)]!);
  drawProfile(cv, STOCK, false);
}

function blankFace(cv: Canvas): void {
  cv.fill(cv.clip, PAPER_3);
  cv.fill(ellipse(20, 16.2, 6.8, 7.6, 40), INK_4);
  cv.fill(smoothRing([[2, 44], [4, 33], [12, 27.2], [20, 26], [28, 27.2], [36, 33], [38, 44]], 4), INK_4);
}

/** A procedural avatar for any handle, as an SVG string. */
export function avatarFor(handle: string, options: AvatarOptions = {}): string {
  const size = options.size ?? 40;
  const shape = options.shape ?? "circle";
  const key = handle.replace(/^@/, "").toLowerCase();
  const rng = createRng(`avatar:${key}`);
  const cv = new Canvas(clipShape(shape));
  if (options.blank) blankFace(cv);
  else if (options.bot) stock(cv, key);
  else human(cv, rng);
  cv.raw(el("path", { d: poly(cv.clip), fill: "none", stroke: INK, "stroke-opacity": 0.14, "stroke-width": 0.6 }));
  return svgDoc(cv.out.join(""), {
    viewBox: [0, 0, S, S],
    width: size,
    height: size,
    title: options.title,
    className: `brand-avatar${options.bot ? " brand-avatar--bot" : ""}`,
    extra: { "data-handle": key },
  });
}
