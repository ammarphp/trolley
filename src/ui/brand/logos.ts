/**
 * Marks, wordmarks and lockups for every organisation in the entity bible.
 *
 * Every mark is constructed on a 48-unit square grid from circles, arcs and
 * straight strokes; every wordmark is Geist (with exact advance widths, see
 * metrics.ts) set with its own weight, case, tracking and furniture, so each
 * brand has a typographic personality inside one family. Pigment appears only
 * where it means something: Morrow's cobalt, the tabloid's alarm red, the
 * state broadcaster's flag vermilion, the local radio's amber on-air lamp.
 */
import { createRng } from "../../render/core/rng.ts";
import { entityName, resolveEntityId, type BrandEntityId } from "./entities.ts";
import { FLAG_INK, INK, INK_3, PAPER, PIGMENT } from "./palette.ts";
import { el, esc, n, svgDoc, text, textWidth, type TextOptions } from "./svg.ts";
import { arcPts, circle, lerpPt, poly, regular, star, type Pt, type Ring } from "./geom.ts";
import { morrowMark } from "./morrow.ts";

export type LogoVariant = "mark" | "wordmark" | "lockup";

export interface LogoOptions {
  /** Rendered height in px. Width follows the design's proportions. */
  size?: number;
  variant?: LogoVariant;
  /**
   * "ink" (default) on paper; "reverse" for dark grounds (ink and paper
   * swap, pigments stay); "current" draws ink as currentColor.
   */
  tone?: "ink" | "reverse" | "current";
  /** Display name, used for unknown ids (monogram fallback). */
  name?: string;
  title?: string;
}

interface Art {
  w: number;
  h: number;
  body: string;
}

const M = 48; // mark grid

/* ------------------------------------------------------------ helpers */

const stroke = (d: string, w: number, color = INK, cap: "round" | "butt" | "square" = "round", join: "round" | "miter" = "round") =>
  el("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": cap, "stroke-linejoin": join });
const fill = (d: string, color = INK, rule?: "evenodd") => el("path", { d, fill: color, "fill-rule": rule });
const disc = (cx: number, cy: number, r: number, color = INK) => el("circle", { cx, cy, r, fill: color });
const ring = (cx: number, cy: number, r: number, w: number, color = INK) => el("circle", { cx, cy, r, fill: "none", stroke: color, "stroke-width": w });

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r];
  const p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${n(p0[0]!)} ${n(p0[1]!)}A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(p1[0]!)} ${n(p1[1]!)}`;
}

/** Text run that also reports its width. */
function run(str: string, o: TextOptions): { svg: string; w: number } {
  const w = (o.width ?? textWidth(str, o)) * (o.stretch ?? 1);
  return { svg: text(str, o), w };
}

/** Clip a horizontal segment at y to a circle; returns [x0, x1] or null. */
function chord(cx: number, cy: number, r: number, y: number): [number, number] | null {
  const dy = y - cy;
  if (Math.abs(dy) >= r) return null;
  const dx = Math.sqrt(r * r - dy * dy);
  return [cx - dx, cx + dx];
}

function art(w: number, h: number, body: string): Art {
  return { w, h, body };
}

/** Horizontal lockup: mark, gap, wordmark, vertically centred. */
function lockupH(mark: Art, word: Art, gap = 12, markScale = 1): Art {
  const mh = mark.h * markScale;
  const h = Math.max(mh, word.h);
  const body =
    el("g", { transform: `translate(0 ${n((h - mh) / 2)}) scale(${n(markScale)})` }, mark.body) +
    el("g", { transform: `translate(${n(mark.w * markScale + gap)} ${n((h - word.h) / 2)})` }, word.body);
  return art(mark.w * markScale + gap + word.w, h, body);
}

function place(a: Art, x: number, y: number, s = 1): string {
  return el("g", { transform: `translate(${n(x)} ${n(y)})${s !== 1 ? ` scale(${n(s)})` : ""}` }, a.body);
}

/* =============================================================== marks */

/** Vela: two wind-filled sails leaning apart; the gap between them is a V. */
function velaMark(): Art {
  const left = `M22.4 40.5L15.2 6.5C9.6 13.4 5.2 25.6 4.6 40.5Z`;
  const right = `M25.6 40.5L32.8 6.5C38.4 13.4 42.8 25.6 43.4 40.5Z`;
  return art(M, M, fill(left) + fill(right) + el("rect", { x: 4.6, y: 42.6, width: 38.8, height: 2.2, fill: INK }));
}

/** Orrin Systems: an eleven-blade aperture (the chief executive said 'trust' eleven times). */
function orrinMark(): Art {
  const blades = 11;
  const r0 = 9.6;
  const r1 = 22;
  const twist = 0.5;
  let body = "";
  for (let i = 0; i < blades; i++) {
    const a0 = -Math.PI / 2 + (i / blades) * Math.PI * 2 + 0.07;
    const a1 = a0 + (Math.PI * 2) / blades - 0.14;
    const outer = arcPts(24, 24, r1, a0, a1, 8);
    const inner = arcPts(24, 24, r0, a1 + twist, a0 + twist, 5);
    body += fill(poly([...outer, ...inner]));
  }
  body += disc(24, 24, 3.1);
  return art(M, M, body);
}

/** Tessaly: a hexagon tessellated into 24 triangles, one of them set in ink. */
function tessalyMark(): Art {
  const R = 21.5;
  const cx = 24;
  const cy = 24;
  const hex = regular(cx, cy, R, 6, -Math.PI / 2);
  const step = (R * Math.sqrt(3)) / 4;
  let lattice = "";
  for (const deg of [90, 30, 150]) {
    const a = (deg * Math.PI) / 180;
    // Lines parallel to direction a, offset along its normal by k*step through the centre.
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    for (let k = -3; k <= 3; k++) {
      const ox = cx + nx * k * step;
      const oy = cy + ny * k * step;
      const p: Pt = [ox - Math.cos(a) * 60, oy - Math.sin(a) * 60];
      const q: Pt = [ox + Math.cos(a) * 60, oy + Math.sin(a) * 60];
      const clipped = clipLineConvex(p, q, hex);
      if (clipped) lattice += `M${n(clipped[0][0])} ${n(clipped[0][1])}L${n(clipped[1][0])} ${n(clipped[1][1])}`;
    }
  }
  // The inked tile: the small triangle at the top vertex, right of the axis.
  const top = hex[0]!;
  const tri: Ring = [top, lerpPt(top, hex[1]!, 0.5), lerpPt(top, [cx, cy], 0.5)];
  return art(M, M, fill(poly(tri)) + stroke(lattice, 0.9) + stroke(poly(hex), 2.4, INK, "round", "round"));
}

function clipLineConvex(p: Pt, q: Pt, hullRing: Ring): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  // Assume clockwise or counter-clockwise; test with centroid.
  let cxs = 0,
    cys = 0;
  for (const v of hullRing) {
    cxs += v[0];
    cys += v[1];
  }
  cxs /= hullRing.length;
  cys /= hullRing.length;
  for (let i = 0; i < hullRing.length; i++) {
    const a = hullRing[i]!;
    const b = hullRing[(i + 1) % hullRing.length]!;
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    if (nx * (cxs - a[0]) + ny * (cys - a[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const num = nx * (p[0] - a[0]) + ny * (p[1] - a[1]);
    const den = nx * dx + ny * dy;
    if (Math.abs(den) < 1e-9) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  if (t1 - t0 < 1e-3) return null;
  return [
    [p[0] + dx * t0, p[1] + dy * t0],
    [p[0] + dx * t1, p[1] + dy * t1],
  ];
}

/** Halberd Compute: a bearded axe blade, a slender spike and a spear point on one shaft. */
function halberdMark(): Art {
  const blade = `M22.4 18.6C16.6 16.8 12.4 13.4 9.2 8C4.6 15.6 4.2 31.4 9.2 40C12.4 34.8 16.6 31.4 22.4 29.4Z`;
  const shaft = el("rect", { x: 22.4, y: 6, width: 3.4, height: 40, fill: INK });
  const spike = `M25.8 21.4L41.5 24L25.8 26.6Z`;
  const point = `M22.4 6.4L24.1 0.6L25.8 6.4Z`;
  const collar = el("rect", { x: 21, y: 15.4, width: 6.2, height: 1.8, fill: INK }) + el("rect", { x: 21, y: 31, width: 6.2, height: 1.8, fill: INK });
  return art(M, M, fill(blade) + shaft + fill(spike) + fill(point) + collar);
}

/** Common Rail: the turnout. A main line and a diverging route inside a roundel. */
function turnout(cx: number, cy: number, r: number, color: string, w: number): string {
  const y = cy + r * 0.24;
  const edge = r - w * 0.05;
  const ch = chord(cx, cy, edge, y)!;
  const sx = cx - r * 0.66;
  const R = r * 1.0;
  const theta = 0.64;
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * theta;
    pts.push([sx + Math.sin(a) * R, y - (1 - Math.cos(a)) * R]);
  }
  // Then straight on along the tangent to the rim.
  const last = pts[pts.length - 1]!;
  const dx = Math.cos(theta);
  const dy = -Math.sin(theta);
  const fx = last[0] - cx;
  const fy = last[1] - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - edge * edge;
  const t = -b + Math.sqrt(Math.max(0, b * b - c));
  pts.push([last[0] + dx * t, last[1] + dy * t]);
  return stroke(`M${n(ch[0])} ${n(y)}H${n(ch[1])}`, w, color, "butt") + stroke(poly(pts, false), w, color, "butt");
}

function commonRailMark(): Art {
  return art(M, M, disc(24, 24, 22.5) + turnout(24, 24, 22.5, PAPER, 3.8));
}

/** Authority seal: guilloché ring, circumscribed legends, the turnout at the centre. */
function authoritySeal(): Art {
  let body = "";
  body += ring(24, 24, 23, 1.2);
  body += ring(24, 24, 16.2, 0.7);
  body += ring(24, 24, 21.9, 0.35);
  // Ticks between the legend band and the rim.
  let ticks = "";
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ticks += `M${n(24 + Math.cos(a) * 22.1)} ${n(24 + Math.sin(a) * 22.1)}L${n(24 + Math.cos(a) * 22.7)} ${n(24 + Math.sin(a) * 22.7)}`;
  }
  body += stroke(ticks, 0.3, INK, "butt");
  body += circleText("COMMON RAIL AUTHORITY", 24, 24, 17.3, "top", 3.5, 700, 150);
  body += circleText("OFFICIAL NOTICE", 24, 24, 20.8, "bottom", 3.5, 700, 96);
  for (const side of [-1, 1]) {
    body += fill(poly(star(24 + side * 18.9, 24.2, 1.3, 0.5, 5)));
  }
  body += ring(24, 24, 11.2, 0.5);
  body += turnout(24, 24, 11.2, INK, 2);
  return art(M, M, body);
}

/** Place a legend around a circle, glyph by glyph (no textPath, no ids). */
function circleText(str: string, cx: number, cy: number, r: number, where: "top" | "bottom", size: number, weight: number, spanDeg: number): string {
  const chars = Array.from(str);
  const widths = chars.map((c) => textWidth(c, { size, weight }));
  const total = widths.reduce((a, b) => a + b, 0);
  const natural = (total / r) * (180 / Math.PI);
  const extra = chars.length > 1 ? (spanDeg - natural) / (chars.length - 1) : 0;
  let acc = 0;
  let out = "";
  chars.forEach((ch, i) => {
    const wDeg = (widths[i]! / r) * (180 / Math.PI);
    const mid = acc + wDeg / 2;
    acc += wDeg + extra;
    if (ch === " ") return;
    const offset = mid - spanDeg / 2;
    const deg = where === "top" ? -90 + offset : 90 - offset;
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const rot = where === "top" ? deg + 90 : deg - 90;
    out += el(
      "text",
      { transform: `translate(${n(x)} ${n(y)}) rotate(${n(rot)})`, "text-anchor": "middle", "font-family": "Geist, Inter, sans-serif", "font-size": size, "font-weight": weight, fill: INK },
      esc(ch),
    );
  });
  return out;
}

/** The Ledger: a ledger page whose margin rule and baseline form an L. */
function ledgerMark(): Art {
  let body = el("rect", { x: 2, y: 2, width: 44, height: 44, rx: 2.5, fill: INK });
  body += el("rect", { x: 12, y: 9, width: 5.4, height: 30, fill: PAPER });
  body += el("rect", { x: 12, y: 33.6, width: 24.5, height: 5.4, fill: PAPER });
  body += stroke("M20.2 9V29.4", 0.8, PAPER, "butt");
  let rules = "";
  for (const y of [13.5, 18.5, 23.5, 28.5]) rules += `M23.4 ${y}H36.5`;
  body += stroke(rules, 0.8, PAPER, "butt");
  return art(M, M, body);
}

/** Relay: the wire itself, one square pulse across a roundel. */
function relayMark(): Art {
  const r = 22.5;
  const low = 30.5;
  const high = 17.5;
  const cl = chord(24, 24, r - 1, low)!;
  const d = `M${n(cl[0])} ${low}H15.5V${high}H31V${low}H${n(cl[1])}`;
  return art(M, M, disc(24, 24, r) + stroke(d, 3.6, PAPER, "butt", "miter"));
}

/** The Howl: an alarm-red block with a heavy exclamation. */
function howlMark(): Art {
  let body = el("rect", { x: 2, y: 2, width: 44, height: 44, rx: 2, fill: PIGMENT.signal });
  body += el("g", { transform: "rotate(-8 24 24)" }, fill("M19.4 8.5H28.6L26.6 29.5H21.4Z", PAPER) + el("rect", { x: 20.8, y: 32.5, width: 6.4, height: 6.4, fill: PAPER }));
  return art(M, M, body);
}

/** The Margin: a hairline margin rule beside a light geometric M. */
function marginMark(): Art {
  let body = el("rect", { x: 2.5, y: 2.5, width: 43, height: 43, fill: PAPER, stroke: INK, "stroke-width": 1.4 });
  body += stroke("M12.5 2.5V45.5M14.8 2.5V45.5", 0.7, INK, "butt");
  body += stroke("M20.5 35V13.5L28.25 29L36 13.5V35", 2.2, INK, "square", "miter");
  return art(M, M, body);
}

/** sidechannel: a prompt and a block cursor on an app tile. */
function sidechannelMark(): Art {
  let body = el("rect", { x: 2, y: 2, width: 44, height: 44, rx: 10, fill: INK });
  body += stroke("M12.5 16.5L21 24L12.5 31.5", 3.6, PAPER, "square", "miter");
  body += el("rect", { x: 24.5, y: 28, width: 12, height: 3.6, fill: PAPER });
  return art(M, M, body);
}

/** APB: a television aerial on an ink disc; directors shorten toward the signal. */
function apbMark(): Art {
  let body = disc(24, 24, 22.5);
  const boomY = 21;
  body += stroke(`M9.5 ${boomY}H39.5M24.5 ${boomY}V46`, 2.2, PAPER, "butt");
  const elements: Array<[number, number]> = [
    [11, 19],
    [16.5, 15.5],
    [22, 12.6],
    [27.5, 10.4],
    [32.5, 8.6],
    [37.2, 7.2],
  ];
  let d = "";
  for (const [x, h] of elements) d += `M${x} ${n(boomY - h / 2)}V${n(boomY + h / 2)}`;
  body += stroke(d, 2.2, PAPER, "butt");
  return art(M, M, body);
}

/** Lumen: an Airy diffraction pattern, rings thinning outward. */
function lumenMark(): Art {
  let body = disc(24, 24, 4.4);
  const rings: Array<[number, number]> = [
    [9.6, 2.4],
    [14.4, 1.5],
    [18.7, 0.95],
    [22.4, 0.55],
  ];
  for (const [r, w] of rings) body += ring(24, 24, r, w);
  return art(M, M, body);
}

/** Ridge FM: the ridge and its lattice mast, with an amber on-air lamp. */
function ridgeMark(): Art {
  const ridge = `M2.5 40L12 27.5L17 32L27 16.5L35.5 28.5L40 23.5L45.5 31V40Z`;
  let body = fill(ridge);
  // A-frame lattice mast standing on the high peak.
  const legs = `M24.6 18.4L27 5.8L29.4 18.4`;
  const brace = `M25.1 15.8L28.6 14L25.6 12.2L28.2 10.4L26.1 8.7L27.6 7.6`;
  body += stroke(legs, 1.5, INK, "round", "round") + stroke(brace, 0.8, INK);
  body += disc(27, 4.4, 2.2, PIGMENT.amber);
  body += stroke(arcPath(27, 4.4, 5.6, Math.PI * 0.78, Math.PI * 1.22) + arcPath(27, 4.4, 5.6, -Math.PI * 0.22, Math.PI * 0.22), 1.1, INK);
  body += stroke("M2.5 43.5H45.5", 1.4, INK, "butt");
  return art(M, M, body);
}

/** The Saltmere Tide: a tide staff standing in the water, in a roundel. */
function tideMark(): Art {
  let body = ring(24, 24, 21.5, 1.6);
  // Staff: alternating ink blocks every 3 units.
  body += el("rect", { x: 20.5, y: 6.5, width: 7, height: 30, fill: PAPER, stroke: INK, "stroke-width": 1.1 });
  for (let y = 6.5; y < 36; y += 6) body += el("rect", { x: 20.5, y, width: 3.5, height: 3, fill: INK });
  for (let y = 9.5; y < 36; y += 6) body += el("rect", { x: 24, y, width: 3.5, height: 3, fill: INK });
  const wave = (y0: number, amp: number, w: number) => {
    const pts: Pt[] = [];
    const ch = chord(24, 24, 20.3, y0)!;
    for (let i = 0; i <= 40; i++) {
      const x = ch[0] + ((ch[1] - ch[0]) * i) / 40;
      pts.push([x, y0 + Math.sin((x / 48) * Math.PI * 6) * amp]);
    }
    return stroke(poly(pts, false), w, INK, "butt");
  };
  // Water: paper band hides the staff foot, then two swells.
  body += el("path", { d: `M3 30.5H45V46H3Z`, fill: PAPER });
  const inner = circle(24, 24, 20.3, 48);
  body += el("path", { d: poly(inner.filter((p) => p[1] > 29.8) as Pt[], true), fill: PAPER });
  body += wave(31.5, 1.5, 2);
  body += wave(37.2, 1.2, 1.4);
  body += ring(24, 24, 21.5, 1.6);
  return art(M, M, body);
}

/** Concord: the Directorate's nested squares in flag vermilion. */
function concordMark(): Art {
  let body = el("rect", { x: 2, y: 2, width: 44, height: 44, fill: FLAG_INK.vermilion });
  body += el("rect", { x: 10.3, y: 10.3, width: 27.4, height: 27.4, fill: INK });
  body += el("rect", { x: 14.8, y: 14.8, width: 18.4, height: 18.4, fill: FLAG_INK.vermilion });
  body += el("rect", { x: 19.6, y: 19.6, width: 8.8, height: 8.8, fill: INK });
  return art(M, M, body);
}

/** Pile-On: three speech bubbles heaped on each other. */
function pileOnMark(): Art {
  const bubble = (x: number, y: number, w: number, h: number, f: string, s: string | null) => {
    const d = `M${x + 4} ${y}H${x + w - 4}Q${x + w} ${y} ${x + w} ${y + 4}V${y + h - 4}Q${x + w} ${y + h} ${x + w - 4} ${y + h}H${x + 11}L${x + 5} ${y + h + 6}L${x + 6} ${y + h}H${x + 4}Q${x} ${y + h} ${x} ${y + h - 4}V${y + 4}Q${x} ${y} ${x + 4} ${y}Z`;
    return el("path", { d, fill: f, stroke: s ?? "none", "stroke-width": 1.6, "stroke-linejoin": "round" });
  };
  let body = bubble(2, 3, 25, 16, PAPER, INK);
  body += bubble(10, 12, 26, 16, PAPER, INK);
  body += bubble(18, 21, 27, 17, INK, INK);
  body += el("rect", { x: 26.2, y: 24.6, width: 3.2, height: 6.6, fill: PAPER }) + el("rect", { x: 26.2, y: 32.6, width: 3.2, height: 2.8, fill: PAPER });
  body += el("rect", { x: 32.6, y: 24.6, width: 3.2, height: 6.6, fill: PAPER }) + el("rect", { x: 32.6, y: 32.6, width: 3.2, height: 2.8, fill: PAPER });
  return art(M, M, body);
}

/** Ismere Dispatch: a compass star over the lake horizon; its reflection is an outline. */
function dispatchMark(): Art {
  let body = ring(24, 24, 21.5, 1.5);
  const s = star(24, 24, 15.5, 3.3, 4);
  const upper = s.filter((p) => p[1] <= 24.01);
  body += fill(poly([...upper]));
  const lower: Pt[] = s.filter((p) => p[1] >= 23.99) as Pt[];
  body += stroke(poly(lower, false), 1.1, INK, "round", "miter");
  body += stroke("M6.5 24H41.5", 1.1, INK, "butt");
  body += stroke("M12 29.5H18M30 29.5H36M15 33.5H19.5M28.5 33.5H33", 0.8, INK, "butt");
  return art(M, M, body);
}

function morrowArt(): Art {
  const s = morrowMark("idle", { size: 48 });
  return art(M, M, stripRoot(s));
}

/** Pull the inner markup out of an svgDoc string so it can be nested. */
function stripRoot(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/^<title>.*?<\/title>/, "");
}

/* =========================================================== wordmarks */

/** Vela's own lower-case, drawn rather than typeset: geometric, monoline, with a sail-cut v. */
export function velaLetters(x0: number, baseline: number, xh: number, color = INK): { svg: string; w: number } {
  const sw = xh * 0.2;
  const r = xh / 2;
  let x = x0;
  let out = "";
  // v: a filled V whose inner edges match the mark's sails.
  const vw = xh * 0.98;
  const t = sw * 1.12;
  out += fill(poly([[x, baseline - xh], [x + t, baseline - xh], [x + vw / 2, baseline - xh * 0.2], [x + vw - t, baseline - xh], [x + vw, baseline - xh], [x + vw / 2 + t * 0.52, baseline], [x + vw / 2 - t * 0.52, baseline]]), color);
  x += vw + xh * 0.12;
  // e: circle with a crossbar, open at the lower right.
  const ecx = x + r;
  const ecy = baseline - r;
  const rr = r - sw / 2;
  const end = (38 * Math.PI) / 180;
  out += stroke(`M${n(ecx - rr)} ${n(ecy)}H${n(ecx + rr)}A${n(rr)} ${n(rr)} 0 1 0 ${n(ecx + Math.cos(end) * rr)} ${n(ecy + Math.sin(end) * rr)}`, sw, color, "butt");
  x += 2 * r + xh * 0.14;
  // l
  out += el("rect", { x, y: baseline - xh * 1.42, width: sw, height: xh * 1.42, fill: color });
  x += sw + xh * 0.2;
  // a: single-storey, bowl and stem.
  out += ring(x + r, baseline - r, rr, sw, color);
  out += el("rect", { x: x + 2 * r - sw, y: baseline - xh, width: sw, height: xh, fill: color });
  x += 2 * r;
  return { svg: out, w: x - x0 };
}

function velaWordmarkArt(): Art {
  const { svg, w } = velaLetters(2, 38, 22);
  return art(w + 4, 48, svg);
}

function orrinWordmark(): Art {
  const a = run("ORRIN", { x: 0, y: 29, size: 27, weight: 620, tracking: 0.16 });
  const b = run("SYSTEMS", { x: 0.8, y: 42.5, size: 9, weight: 520, tracking: 0.46 });
  return art(Math.max(a.w, b.w) + 2, 48, a.svg + b.svg);
}

function tessalyWordmark(): Art {
  const a = run("tessaly", { x: 0, y: 33, size: 32, weight: 300, tracking: 0.035 });
  return art(a.w + 2, 48, a.svg);
}

function halberdWordmark(): Art {
  const a = run("HALBERD", { x: 0, y: 32, size: 30, weight: 880, tracking: 0.01, stretch: 0.84 });
  const b = run("COMPUTE", { x: 0.8, y: 43.5, size: 7.4, mono: true, weight: 500, tracking: 0.28 });
  return art(Math.max(a.w, b.w) + 2, 48, a.svg + b.svg);
}

function commonRailWordmark(): Art {
  const a = run("Common Rail", { x: 0, y: 29.5, size: 27, weight: 700, tracking: -0.022 });
  // Two rails under the name, on sleepers.
  let sleepers = "";
  for (let x = 3; x < a.w - 2; x += 8.5) sleepers += `M${n(x)} 35.6V40.4`;
  const body = a.svg + stroke(sleepers, 1.6, INK, "butt") + stroke(`M0 36.8H${n(a.w)}M0 39.2H${n(a.w)}`, 0.9, INK, "butt");
  return art(a.w + 1, 48, body);
}

function authorityWordmark(): Art {
  const a = run("COMMON RAIL", { x: 0, y: 12.5, size: 8, weight: 650, tracking: 0.42 });
  const b = run("AUTHORITY", { x: 0, y: 34, size: 25, weight: 800, tracking: 0.07 });
  const w = Math.max(a.w, b.w);
  const c = run("NOTICE SERIES · EFFECTIVE IMMEDIATELY", { x: 0, y: 44.5, size: 5.2, mono: true, weight: 500, width: w });
  return art(w + 1, 48, a.svg + b.svg + c.svg + stroke(`M0 16.5H${n(w)}`, 0.6, INK, "butt"));
}

function ledgerWordmark(): Art {
  const a = run("THE LEDGER", { x: 0, y: 33.4, size: 25, weight: 800, tracking: 0.035 });
  const w = a.w;
  const body = stroke(`M0 5.6H${n(w)}`, 2.4, INK, "butt") + stroke(`M0 9.2H${n(w)}`, 0.6, INK, "butt") + a.svg + stroke(`M0 39.4H${n(w)}`, 0.6, INK, "butt") + stroke(`M0 43H${n(w)}`, 2.4, INK, "butt");
  return art(w + 1, 48, body);
}

function relayWordmark(): Art {
  const a = run("RELAY", { x: 1, y: 33, size: 30, weight: 820, tracking: 0.05, italic: 11 });
  return art(a.w + 8, 48, a.svg);
}

function howlWordmark(): Art {
  const a = run("THE HOWL", { x: 7, y: 34.6, size: 30, weight: 900, tracking: -0.01, stretch: 0.8, fill: PAPER });
  const w = a.w + 14;
  return art(w, 48, el("rect", { x: 0, y: 5, width: w, height: 38, fill: PIGMENT.signal }) + a.svg);
}

function marginWordmark(): Art {
  const a = run("THE MARGIN", { x: 9, y: 31.5, size: 21, weight: 280, tracking: 0.3 });
  return art(a.w + 10, 48, stroke("M1 8V40M3.2 8V40", 0.8, INK, "butt") + a.svg);
}

function sidechannelWordmark(): Art {
  const a = run("sidechannel", { x: 0, y: 31, size: 22, mono: true, weight: 520 });
  return art(a.w + 16, 48, a.svg + el("rect", { x: a.w + 3, y: 14.5, width: 10.5, height: 20, fill: INK }));
}

function apbWordmark(): Art {
  const a = run("APB", { x: 0, y: 33, size: 30, weight: 760, tracking: 0.14 });
  return art(a.w + 1, 48, a.svg);
}

function lumenWordmark(): Art {
  const a = run("Lumen", { x: 0, y: 33.5, size: 33, weight: 300, tracking: 0.05 });
  return art(a.w + 2, 48, a.svg);
}

function ridgeWordmark(): Art {
  const a = run("RIDGE", { x: 0, y: 32, size: 28, weight: 820, tracking: -0.01 });
  // On-air lamp, then the frequency.
  const lampX = a.w + 9;
  const b = run("97.3 FM", { x: lampX + 6, y: 32, size: 14, mono: true, weight: 560 });
  return art(lampX + 6 + b.w + 2, 48, a.svg + disc(lampX, 27.2, 2.4, PIGMENT.amber) + b.svg);
}

function tideWordmark(): Art {
  const a = run("The Saltmere", { x: 0, y: 32, size: 23, weight: 640, tracking: -0.02 });
  const b = run("Tide", { x: a.w + 6, y: 32, size: 23, weight: 640, tracking: -0.01, italic: 12 });
  return art(a.w + 6 + b.w + 4, 48, a.svg + b.svg);
}

function concordWordmark(): Art {
  const a = run("CONCORD", { x: 0, y: 31.5, size: 26, weight: 860, tracking: 0.22 });
  const w = a.w - 26 * 0.22 * 0;
  return art(w + 1, 48, a.svg + el("rect", { x: 0, y: 37.5, width: w, height: 3, fill: FLAG_INK.vermilion }));
}

function pileOnWordmark(): Art {
  const a = run("pile-on", { x: 0, y: 0, size: 31, weight: 860, tracking: -0.03 });
  return art(a.w + 6, 48, el("g", { transform: "translate(2 34) rotate(-4)" }, a.svg));
}

function dispatchWordmark(): Art {
  const a = run("ISMERE", { x: 0, y: 21, size: 17, weight: 540, tracking: 0.3 });
  const b = run("DISPATCH", { x: 0, y: 41, size: 17, weight: 540, tracking: 0.3, width: a.w });
  return art(a.w + 1, 48, a.svg + b.svg);
}

function morrowWordmark(): Art {
  const a = run("morrow", { x: 0, y: 33, size: 32, weight: 520, tracking: -0.02, fill: PIGMENT.cobalt });
  return art(a.w + 2, 48, a.svg);
}

/* ============================================================ lockups */

function ledgerLockup(): Art {
  const mark = ledgerMark();
  const word = ledgerWordmark();
  const tag = run("ALDGRAVE · EST. 1851 · PAPER OF RECORD", { x: 0, y: 0, size: 6.2, mono: true, weight: 520, width: word.w });
  const body = place(mark, 0, 0) + place(word, 58, 0);
  return art(58 + word.w, 58, body + el("g", { transform: "translate(58 55)" }, tag.svg));
}

function authorityLockup(): Art {
  return lockupH(authoritySeal(), authorityWordmark(), 12);
}

function apbLockup(): Art {
  const word = apbWordmark();
  const sub = run("ARDEN PUBLIC BROADCASTING", { x: 0, y: 43.5, size: 7, weight: 600, tracking: 0.16 });
  const body = place(apbMark(), 0, 0) + place(word, 60, -5) + el("g", { transform: "translate(60 0)" }, sub.svg);
  return art(60 + Math.max(word.w, sub.w), 48, body);
}

function lumenLockup(): Art {
  const word = lumenWordmark();
  const sub = run("LETTERS IN SCIENCE", { x: 1, y: 43.5, size: 6.6, weight: 520, tracking: 0.26 });
  return art(60 + Math.max(word.w, sub.w + 1), 48, place(lumenMark(), 0, 0) + place(word, 60, -5) + el("g", { transform: "translate(60 0)" }, sub.svg));
}

function velaLockup(): Art {
  const { svg, w } = velaLetters(58, 40.5, 24.6);
  return art(58 + w + 2, 48, velaMark().body + svg);
}

function morrowLockupArt(): Art {
  const word = run("morrow", { x: 58, y: 34, size: 31, weight: 520, tracking: -0.02, fill: PIGMENT.cobalt });
  const by = run("by Vela", { x: 58 + word.w + 8, y: 34, size: 11, weight: 500, tracking: 0.02, fill: INK_3 });
  return art(58 + word.w + 8 + by.w + 2, 48, morrowArt().body + word.svg + by.svg);
}

function concordLockup(): Art {
  const word = concordWordmark();
  const sub = run("VOICE OF THE DIRECTORATE", { x: 0, y: 0, size: 6.4, mono: true, weight: 520, tracking: 0.06 });
  return art(58 + Math.max(word.w, sub.w), 50, place(concordMark(), 0, 0) + place(word, 58, -5) + el("g", { transform: "translate(58 45.5)" }, sub.svg));
}

function howlLockup(): Art {
  const word = howlWordmark();
  const sub = run("YOU WON'T BELIEVE WHAT HAPPENS NEXT", { x: 0, y: 0, size: 5.2, weight: 800, width: word.w, fill: PIGMENT.signal });
  return art(word.w, 56, word.body + el("g", { transform: "translate(0 53)" }, sub.svg));
}

/* =========================================================== registry */

interface BrandDesign {
  mark: () => Art;
  wordmark: () => Art;
  lockup?: () => Art;
  /** Gap between mark and word in the default lockup. */
  gap?: number;
}

const DESIGNS: Record<BrandEntityId, BrandDesign> = {
  vela: { mark: velaMark, wordmark: velaWordmarkArt, lockup: velaLockup },
  orrin: { mark: orrinMark, wordmark: orrinWordmark, gap: 12 },
  tessaly: { mark: tessalyMark, wordmark: tessalyWordmark, gap: 12 },
  morrow: { mark: morrowArt, wordmark: morrowWordmark, lockup: morrowLockupArt },
  halberd: { mark: halberdMark, wordmark: halberdWordmark, gap: 10 },
  "common-rail": { mark: commonRailMark, wordmark: commonRailWordmark, gap: 12 },
  authority: { mark: authoritySeal, wordmark: authorityWordmark, lockup: authorityLockup },
  ledger: { mark: ledgerMark, wordmark: ledgerWordmark, lockup: ledgerLockup },
  relay: { mark: relayMark, wordmark: relayWordmark, gap: 10 },
  howl: { mark: howlMark, wordmark: howlWordmark, lockup: howlLockup },
  margin: { mark: marginMark, wordmark: marginWordmark, gap: 12 },
  sidechannel: { mark: sidechannelMark, wordmark: sidechannelWordmark, gap: 12 },
  apb: { mark: apbMark, wordmark: apbWordmark, lockup: apbLockup },
  lumen: { mark: lumenMark, wordmark: lumenWordmark, lockup: lumenLockup },
  "ridge-fm": { mark: ridgeMark, wordmark: ridgeWordmark, gap: 12 },
  "saltmere-tide": { mark: tideMark, wordmark: tideWordmark, gap: 12 },
  concord: { mark: concordMark, wordmark: concordWordmark, lockup: concordLockup },
  "pile-on": { mark: pileOnMark, wordmark: pileOnWordmark, gap: 8 },
  "ismere-dispatch": { mark: dispatchMark, wordmark: dispatchWordmark, gap: 12 },
};

function artFor(id: BrandEntityId, variant: LogoVariant): Art {
  const d = DESIGNS[id];
  if (variant === "mark") return d.mark();
  if (variant === "wordmark") return d.wordmark();
  return d.lockup ? d.lockup() : lockupH(d.mark(), d.wordmark(), d.gap ?? 12);
}

/* ------------------------------------------------------------ fallback */

function initials(name: string): string {
  const words = name
    .replace(/^the\s+/i, "")
    .split(/[\s\-_.]+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

/** A consistent, obviously generic monogram for outlets the bible doesn't know. */
function monogramArt(id: string, name: string): Art {
  const rng = createRng(`mono:${id}`);
  const shape = rng.int(0, 2);
  let body = "";
  if (shape === 0) body += ring(24, 24, 21.5, 1.6);
  else if (shape === 1) body += el("rect", { x: 3, y: 3, width: 42, height: 42, rx: 3, fill: "none", stroke: INK, "stroke-width": 1.6 });
  else body += el("rect", { x: 3, y: 3, width: 42, height: 42, rx: 21, fill: "none", stroke: INK, "stroke-width": 1.6 });
  const letters = initials(name || id);
  const size = letters.length > 1 ? 17 : 22;
  body += text(letters, { x: 24, y: 24 + size * 0.36, size, weight: 640, anchor: "middle", tracking: 0.02 });
  return art(M, M, body);
}

function monogramWordmark(name: string): Art {
  const a = run(name, { x: 0, y: 31, size: 22, weight: 600, tracking: -0.01 });
  return art(a.w + 2, 48, a.svg);
}

/* ================================================================= api */

/**
 * Logo for any entity id as an SVG string. Unknown ids (e.g. an outlet the
 * ambient layer invents) get a neutral monogram built from `options.name`.
 */
export function logoFor(entityId: string, options: LogoOptions = {}): string {
  const size = options.size ?? 32;
  const variant = options.variant ?? "mark";
  const id = resolveEntityId(entityId);
  const name = options.title ?? (id ? entityName(id) : null) ?? options.name ?? entityId;
  let a: Art;
  if (id) a = artFor(id, variant);
  else {
    const label = options.name ?? entityId.replace(/^@/, "");
    a = variant === "mark" ? monogramArt(entityId, label) : variant === "wordmark" ? monogramWordmark(label) : lockupH(monogramArt(entityId, label), monogramWordmark(label));
  }
  let body = a.body;
  if (options.tone === "reverse") body = swapInk(body);
  else if (options.tone === "current") body = body.split(INK).join("currentColor");
  const width = (a.w / a.h) * size;
  return svgDoc(body, {
    viewBox: [0, 0, a.w, a.h],
    width,
    height: size,
    title: name ?? undefined,
    className: `brand-logo brand-logo--${variant}`,
    extra: { "data-entity": id ?? entityId },
  });
}

/** Width/height of a logo variant, for layout before rendering. */
export function logoAspect(entityId: string, variant: LogoVariant = "mark"): number {
  const id = resolveEntityId(entityId);
  if (!id) return variant === "mark" ? 1 : 4;
  const a = artFor(id, variant);
  return a.w / a.h;
}

function swapInk(body: string): string {
  return body.split(INK).join("\u0000").split(PAPER).join(INK).split("\u0000").join(PAPER);
}

/** The Authority seal on its own (for notices). */
export function sealFor(issuerId: string, size = 40): string {
  const id = resolveEntityId(issuerId);
  if (id === "authority" || id === "common-rail") return logoFor("authority", { size, variant: "mark" });
  return logoFor(issuerId, { size, variant: "mark" });
}

/** The Vela wordmark (drawn letterforms), optionally as the full lockup with the sails. */
export function velaWordmark(options: { height?: number; lockup?: boolean; tone?: LogoOptions["tone"] } = {}): string {
  return logoFor("vela", { size: options.height ?? 32, variant: options.lockup ? "lockup" : "wordmark", tone: options.tone });
}

/** Every entity that has a designed identity, for boards and tests. */
export const LOGO_ENTITIES: readonly BrandEntityId[] = Object.keys(DESIGNS) as BrandEntityId[];
