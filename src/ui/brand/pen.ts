/**
 * Pen: an ordered list of SVG elements drawn back to front. White-filled
 * shapes occlude what was drawn before them, exactly as in an ink drawing
 * where the illustrator leaves paper showing in front of a background.
 */
import { el, n, text, type Attrs, type TextOptions } from "./svg.ts";
import { hatch, poly, polys, segs, type HatchOptions, type Pt, type Ring, type Seg } from "./geom.ts";
import { INK, PAPER } from "./palette.ts";
import type { Rng } from "../../render/core/rng.ts";

export interface Style {
  fill?: string;
  stroke?: string;
  w?: number;
  cap?: "round" | "butt" | "square";
  join?: "round" | "miter" | "bevel";
  dash?: string;
  opacity?: number;
  rule?: "evenodd" | "nonzero";
  /** "stroke" paints the stroke under the fill (a halo that costs one element). */
  order?: "stroke";
}

function styleAttrs(s: Style): Attrs {
  const stroke = s.stroke ?? "none";
  return {
    fill: s.fill ?? "none",
    "fill-rule": s.rule === "evenodd" ? "evenodd" : undefined,
    stroke: stroke === "none" ? undefined : stroke,
    "stroke-width": stroke === "none" ? undefined : (s.w ?? 1),
    "stroke-linecap": stroke === "none" ? undefined : (s.cap ?? "round"),
    "stroke-linejoin": stroke === "none" ? undefined : (s.join ?? "round"),
    "stroke-dasharray": s.dash,
    opacity: s.opacity,
    "paint-order": s.order,
  };
}

export interface ToneOptions {
  /** Base hatch angle in degrees. */
  angle?: number;
  /** Stroke spacing at tone 0.3 (sparser for lighter tones). */
  spacing?: number;
  w?: number;
  color?: string;
  jitter?: number;
}

export class Pen {
  private out: string[] = [];
  readonly rng: Rng;
  constructor(rng: Rng) {
    this.rng = rng;
  }

  raw(s: string): this {
    this.out.push(s);
    return this;
  }

  path(d: string, s: Style = {}): this {
    if (d) this.out.push(el("path", { d, ...styleAttrs(s) }));
    return this;
  }

  /** Stroked polyline/polygon. */
  stroke(points: readonly Pt[], w = 1, color = INK, close = false, extra: Style = {}): this {
    return this.path(poly(points, close), { stroke: color, w, ...extra });
  }

  line(x1: number, y1: number, x2: number, y2: number, w = 1, color = INK, cap: Style["cap"] = "round"): this {
    return this.path(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, { stroke: color, w, cap });
  }

  /** Filled + outlined shape (paper by default, occluding what is behind). */
  shape(ring: Ring | string, fill: string = PAPER, stroke: string | null = INK, w = 1, extra: Style = {}): this {
    const d = typeof ring === "string" ? ring : poly(ring, true);
    return this.path(d, { fill, stroke: stroke ?? "none", w, ...extra });
  }

  fill(ring: Ring | readonly Ring[] | string, color: string = INK, rule: Style["rule"] = "nonzero"): this {
    const d = typeof ring === "string" ? ring : isRingList(ring) ? polys(ring) : poly(ring as Ring, true);
    return this.path(d, { fill: color, rule });
  }

  circle(cx: number, cy: number, r: number, s: Style = { fill: PAPER, stroke: INK, w: 1 }): this {
    this.out.push(el("circle", { cx, cy, r, ...styleAttrs(s) }));
    return this;
  }

  segs(list: readonly Seg[], w = 0.4, color = INK, cap: Style["cap"] = "round"): this {
    return this.path(segs(list), { stroke: color, w, cap });
  }

  hatch(rings: Ring | readonly Ring[], angle: number, spacing: number, w = 0.4, color = INK, o: HatchOptions = {}): this {
    const list = isRingList(rings) ? rings : [rings as Ring];
    return this.segs(hatch(list, angle, spacing, { rng: this.rng, ...o }), w, color);
  }

  /**
   * Tonal value 0..1 laid in as stacked hatch layers, the way an engraver
   * builds a shadow: one direction, then a crossing one, then a third.
   */
  tone(rings: Ring | readonly Ring[], value: number, o: ToneOptions = {}): this {
    if (value <= 0.02) return this;
    const angle = o.angle ?? 45;
    const base = o.spacing ?? 1.4;
    const w = o.w ?? 0.35;
    const color = o.color ?? INK;
    const j = o.jitter ?? 0;
    const sp = base * (value < 0.3 ? 0.3 / Math.max(0.08, value) : 1);
    this.hatch(rings, angle, Math.min(sp, base * 3.2), w, color, { jitter: j });
    if (value > 0.42) this.hatch(rings, angle + 90 - 28, base * (value > 0.7 ? 1 : 1.25), w, color, { jitter: j, phase: 0.25 });
    if (value > 0.72) this.hatch(rings, angle - 62, base * 1.15, w, color, { jitter: j, phase: 0.75 });
    return this;
  }

  text(str: string, o: TextOptions): this {
    this.out.push(text(str, o));
    return this;
  }

  group(content: (p: Pen) => void, a: Attrs = {}): this {
    const inner = new Pen(this.rng);
    content(inner);
    this.out.push(el("g", a, inner.toString()));
    return this;
  }

  toString(): string {
    return this.out.join("");
  }
}

function isRingList(v: unknown): v is readonly Ring[] {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]) && Array.isArray((v[0] as unknown[])[0]);
}
