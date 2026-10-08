/**
 * Flags of the fictional nations, drawn from the declarative specs in
 * entities.ts. Flat printed inks, geometric construction, a hairline border
 * so white fields hold their edge on white paper.
 */
import { NATIONS, nation, type FlagEmblem, type FlagLayer, type Nation } from "./entities.ts";
import { FLAG_INK, INK } from "./palette.ts";
import { el, n, svgDoc } from "./svg.ts";
import { circle, poly, regular, star, type Pt } from "./geom.ts";

const H = 40;

export interface FlagOptions {
  /** Force a uniform 3:2 box (the flag is centred and letterboxed with its own field colour). */
  uniform?: boolean;
  /** Omit the hairline border. */
  borderless?: boolean;
  /** Accessible title. */
  title?: string;
}

/** Flag of a nation as an SVG string. `size` is the rendered width in px. */
export function flagFor(nationId: string, size = 30, options: FlagOptions = {}): string {
  const nat = nation(nationId);
  if (!nat) return unknownFlag(nationId, size, options);
  const W = H / nat.flag.ratio;
  let body = "";
  for (const layer of nat.flag.layers) body += drawLayer(layer, W);
  if (!options.borderless)
    body += el("rect", { x: 0.3, y: 0.3, width: W - 0.6, height: H - 0.6, fill: "none", stroke: INK, "stroke-opacity": 0.28, "stroke-width": 0.6 });
  if (options.uniform) {
    const UW = H * 1.5;
    const scale = Math.min(UW / W, 1);
    const w = W * scale;
    const h = H * scale;
    const inner = el("g", { transform: `translate(${n((UW - w) / 2)} ${n((H - h) / 2)}) scale(${n(scale)})` }, body);
    return svgDoc(inner, { viewBox: [0, 0, UW, H], width: size, height: (size * 2) / 3, title: options.title ?? nat.name, className: "brand-flag" });
  }
  return svgDoc(body, { viewBox: [0, 0, W, H], width: size, height: size * nat.flag.ratio, title: options.title ?? nat.name, className: "brand-flag" });
}

/** Height/width ratio of a nation's flag (0.5..1). */
export function flagRatio(nationId: string): number {
  return nation(nationId)?.flag.ratio ?? 2 / 3;
}

export const FLAG_NATIONS: readonly Nation[] = NATIONS;

function ink(name: keyof typeof FLAG_INK): string {
  return FLAG_INK[name];
}

function drawLayer(l: FlagLayer, W: number): string {
  switch (l.kind) {
    case "field":
      return el("rect", { x: 0, y: 0, width: W, height: H, fill: ink(l.ink) });
    case "stripes": {
      const weights = l.weights ?? l.inks.map(() => 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let at = 0;
      let out = "";
      l.inks.forEach((c, i) => {
        const span = (weights[i]! / total) * (l.dir === "h" ? H : W);
        out +=
          l.dir === "h"
            ? el("rect", { x: 0, y: at, width: W, height: span + 0.05, fill: ink(c) })
            : el("rect", { x: at, y: 0, width: span + 0.05, height: H, fill: ink(c) });
        at += span;
      });
      return out;
    }
    case "band":
      return l.dir === "h"
        ? el("rect", { x: 0, y: (l.at - l.width / 2) * H, width: W, height: l.width * H, fill: ink(l.ink) })
        : el("rect", { x: (l.at - l.width / 2) * W, y: 0, width: l.width * W, height: H, fill: ink(l.ink) });
    case "canton":
      return el("rect", { x: 0, y: 0, width: l.w * W, height: l.h * H, fill: ink(l.ink) });
    case "polygon":
      return el("path", { d: poly(l.points.map(([x, y]) => [x * W, y * H] as Pt)), fill: ink(l.ink) });
    case "disc":
      return el("circle", { cx: l.cx * W, cy: l.cy * H, r: l.r * H, fill: ink(l.ink) });
    case "ring":
      return el("circle", { cx: l.cx * W, cy: l.cy * H, r: l.r * H, fill: "none", stroke: ink(l.ink), "stroke-width": l.width * H });
    case "star": {
      const rot = (l.rotate ?? -90) * (Math.PI / 180);
      const R = l.r * H;
      if (!l.alt) return el("path", { d: poly(star(l.cx * W, l.cy * H, R, R * l.inner, l.points, rot)), fill: ink(l.ink) });
      // Compass star: long cardinal points, shorter intercardinal points.
      const pts: Pt[] = [];
      for (let i = 0; i < l.points * 2; i++) {
        const a = rot + (i / (l.points * 2)) * Math.PI * 2;
        const r = i % 2 ? R * l.inner : (i / 2) % 2 ? R * l.alt : R;
        pts.push([l.cx * W + Math.cos(a) * r, l.cy * H + Math.sin(a) * r]);
      }
      return el("path", { d: poly(pts), fill: ink(l.ink) });
    }
    case "squares": {
      let out = "";
      l.sizes.forEach((s, i) => {
        const side = s * H;
        out += el("rect", { x: l.cx * W - side / 2, y: l.cy * H - side / 2, width: side, height: side, fill: ink(l.inks[i % l.inks.length]!) });
      });
      return out;
    }
    case "grid": {
      let out = "";
      const c = l.cell * H;
      const g = l.gap * H;
      for (let r = 0; r < l.rows; r++)
        for (let k = 0; k < l.cols; k++) out += el("rect", { x: l.x * W + k * (c + g), y: l.y * H + r * (c + g), width: c, height: c, fill: ink(l.ink) });
      return out;
    }
    case "wave": {
      const x0 = (l.x0 ?? 0) * W;
      const x1 = (l.x1 ?? 1) * W;
      const pts: Pt[] = [];
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([x0 + (x1 - x0) * t, l.y * H + Math.sin(t * Math.PI * 2 * l.periods) * l.amp * H]);
      }
      return el("path", { d: poly(pts, false), fill: "none", stroke: ink(l.ink), "stroke-width": l.width * H, "stroke-linecap": "butt" });
    }
    case "split-disc": {
      const cx = l.cx * W;
      const cy = l.cy * H;
      const r = l.r * H;
      return (
        el("path", { d: `M${n(cx)} ${n(cy - r)}A${n(r)} ${n(r)} 0 0 0 ${n(cx)} ${n(cy + r)}Z`, fill: ink(l.left) }) +
        el("path", { d: `M${n(cx)} ${n(cy - r)}A${n(r)} ${n(r)} 0 0 1 ${n(cx)} ${n(cy + r)}Z`, fill: ink(l.right) })
      );
    }
    case "emblem":
      return emblem(l.name, l.cx * W, l.cy * H, l.size * H, ink(l.ink), W);
  }
}

function emblem(name: FlagEmblem, cx: number, cy: number, s: number, color: string, W: number): string {
  switch (name) {
    case "parley": {
      // A round table cut in two and drawn apart: two half-discs, flat sides facing.
      const r = s / 2;
      const gap = s * 0.16;
      const left = `M${n(cx - gap / 2)} ${n(cy - r)}A${n(r)} ${n(r)} 0 0 0 ${n(cx - gap / 2)} ${n(cy + r)}Z`;
      const right = `M${n(cx + gap / 2)} ${n(cy - r)}A${n(r)} ${n(r)} 0 0 1 ${n(cx + gap / 2)} ${n(cy + r)}Z`;
      return el("path", { d: left + right, fill: color });
    }
    case "hexagon": {
      // An isometric crystal: hexagon outline with three inner edges.
      const r = s / 2;
      const hex = regular(cx, cy, r, 6, -Math.PI / 2);
      const w = s * 0.085;
      let d = poly(hex);
      const c: Pt = [cx, cy];
      for (const i of [1, 3, 5]) d += `M${n(c[0])} ${n(c[1])}L${n(hex[i]![0])} ${n(hex[i]![1])}`;
      return el("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "miter" });
    }
    case "gate": {
      // A sea gate: two piers, a lintel and a sluice of five bars.
      const w = s * 0.92;
      const h = s * 0.78;
      const x0 = cx - w / 2;
      const y0 = cy - h / 2;
      const pier = w * 0.16;
      let out = el("rect", { x: x0, y: y0 + h * 0.08, width: pier, height: h * 0.92, fill: color });
      out += el("rect", { x: x0 + w - pier, y: y0 + h * 0.08, width: pier, height: h * 0.92, fill: color });
      out += el("rect", { x: x0 - w * 0.06, y: y0, width: w * 1.12, height: h * 0.16, fill: color });
      const inner = w - pier * 2;
      const bars = 5;
      for (let i = 0; i < bars; i++) {
        const bx = x0 + pier + (inner / bars) * (i + 0.5);
        out += el("rect", { x: bx - inner * 0.045, y: y0 + h * 0.16, width: inner * 0.09, height: h * 0.64, fill: color });
      }
      return out;
    }
    case "furrows": {
      // Ploughed rows running to a vanishing point on the horizon.
      const horizon = cy - s * 0.5;
      const vp: Pt = [cx, horizon - s * 0.55];
      let out = "";
      const rows = 9;
      for (let i = 0; i <= rows; i++) {
        const bx = -W * 0.1 + (W * 1.2 * i) / rows;
        const t0 = (horizon - vp[1]) / (H - vp[1]);
        const top: Pt = [vp[0] + (bx - vp[0]) * t0, horizon];
        out += el("path", { d: `M${n(top[0])} ${n(top[1])}L${n(bx)} ${n(H + 1)}`, stroke: color, "stroke-width": s * 0.05 + (i % 2) * 0, fill: "none" });
      }
      out += el("rect", { x: 0, y: horizon - s * 0.03, width: W, height: s * 0.06, fill: color });
      return out;
    }
    case "kingfisher": {
      // Perched kingfisher facing the hoist: big head, dagger bill, short tail.
      const k = s / 40;
      const P = (pts: Pt[]) => poly(pts.map(([x, y]) => [cx + x * k, cy + y * k] as Pt));
      const body: Pt[] = [
        [-20, -7.8],
        [-7.6, -11.6],
        [-6.4, -14.2],
        [-2.6, -16.4],
        [2, -15.8],
        [5.1, -12.8],
        [6.1, -8.6],
        [8.1, -3],
        [9.6, 3],
        [10.6, 8.8],
        [13.4, 16.6],
        [10, 17.4],
        [6.2, 11.2],
        [2, 10.6],
        [-2.6, 7.6],
        [-5.6, 2],
        [-6.9, -3.4],
        [-7.5, -6.6],
        [-19.6, -6.9],
      ];
      const out =
        el("path", { d: P(body), fill: color }) +
        el("path", { d: P(circle(-2.9, -10.9, 1.35, 14) as Pt[]), fill: FLAG_INK.paper }) +
        el("path", { d: P(circle(1.7, -8.6, 1.2, 12).map(([x, y]) => [x * 1 + 0, y] as Pt) as Pt[]), fill: FLAG_INK.paper }) +
        el("path", {
          d: `M${n(cx - 0.8 * k)} ${n(cy - 3.6 * k)}Q${n(cx + 4.6 * k)} ${n(cy + 2 * k)} ${n(cx + 9.4 * k)} ${n(cy + 10.4 * k)}`,
          fill: "none",
          stroke: FLAG_INK.paper,
          "stroke-width": 0.9 * k,
          "stroke-linecap": "round",
        }) +
        el("rect", { x: cx - 9 * k, y: cy + 11.4 * k, width: 25 * k, height: 1.9 * k, fill: color });
      return out;
    }
  }
}

function unknownFlag(id: string, size: number, options: FlagOptions): string {
  // A neutral placeholder: a blank field with a hairline saltire, clearly not a real flag.
  const W = 60;
  const body =
    el("rect", { x: 0, y: 0, width: W, height: H, fill: FLAG_INK.paper }) +
    el("path", { d: `M0 0L${W} ${H}M${W} 0L0 ${H}`, stroke: INK, "stroke-opacity": 0.25, "stroke-width": 0.6 }) +
    el("rect", { x: 0.3, y: 0.3, width: W - 0.6, height: H - 0.6, fill: "none", stroke: INK, "stroke-opacity": 0.3, "stroke-width": 0.6 });
  return svgDoc(body, { viewBox: [0, 0, W, H], width: size, height: (size * 2) / 3, title: options.title ?? id, className: "brand-flag" });
}
