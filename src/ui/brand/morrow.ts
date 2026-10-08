/**
 * Morrow: Vela's assistant, and the only thing in the world drawn in cobalt.
 *
 * Construction (48-unit grid): a sun half-risen on a horizon, under the arc
 * of a lid. A small paper-white pupil sits in the sun where its centre of
 * mass would be, so the dawn is also an eye looking over the edge of the
 * world at you. "Morrow" means tomorrow; the mark promises the morning and
 * watches while it does.
 *
 *   idle      dawn with a pupil that looks straight out
 *   thinking  the lid breaks into three strokes; the pupil glances up and left
 *   alert     the lower lid opens: the full eye, lashes out, horizon through the iris
 *   glitch    the idle mark sliced into mis-registered bands, with an ink ghost
 *   red       the alert eye in signal red with a slit pupil (the one-time flash)
 */
import { PIGMENT, PAPER, INK } from "./palette.ts";
import { el, idattr, n, svgDoc, clipRect, text, textWidth } from "./svg.ts";

export type MorrowState = "idle" | "thinking" | "alert" | "glitch" | "red";
export const MORROW_STATES: readonly MorrowState[] = ["idle", "thinking", "alert", "glitch", "red"];

export interface MorrowMarkOptions {
  /** Rendered size in px (square). Default 32. */
  size?: number;
  /** Include gentle CSS motion (respects prefers-reduced-motion). */
  animate?: boolean;
  /** Override the pigment (e.g. "currentColor" for a themed container). */
  color?: string;
  /** Put the mark on a tile (rounded square) of this fill, pupil stays paper. */
  tile?: string;
  title?: string;
}

const C = 24;
const HY = 27;
const SUN = 12;
const LID = 18.6;

const pt = (r: number, deg: number): [number, number] => [C + Math.cos((deg * Math.PI) / 180) * r, HY + Math.sin((deg * Math.PI) / 180) * r];

function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(x1)} ${n(y1)}`;
}

interface Weights {
  line: number;
  pupil: number;
}

function weights(size: number): Weights {
  // Optical sizing: heavier strokes and a bigger pupil when the mark is tiny.
  if (size <= 18) return { line: 3.8, pupil: 3.4 };
  if (size <= 28) return { line: 3.2, pupil: 3.0 };
  return { line: 2.6, pupil: 2.6 };
}

function stroke(d: string, color: string, w: number, extra: Record<string, string | number> = {}): string {
  return el("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round", ...extra });
}

/** The idle dawn, reused by glitch. */
function dawn(color: string, wt: Weights, pupilDx = 0, pupilDy = 0, cls?: { lid?: string; pupil?: string }): string {
  const sun = `M${n(C - SUN)} ${HY}A${SUN} ${SUN} 0 0 1 ${n(C + SUN)} ${HY}Z`;
  const pupilY = HY - (4 * SUN) / (3 * Math.PI);
  return (
    el("path", { d: sun, fill: color }) +
    el("circle", { cx: C + pupilDx, cy: pupilY + pupilDy, r: wt.pupil, fill: PAPER, class: cls?.pupil }) +
    stroke(arc(LID, 205, 335), color, wt.line, cls?.lid ? { class: cls.lid } : {}) +
    stroke(`M3 ${HY}H45`, color, wt.line)
  );
}

function eye(color: string, wt: Weights, slit: boolean): string {
  let out = "";
  out += el("circle", { cx: C, cy: HY, r: SUN, fill: color });
  // The horizon runs through the iris as a paper hairline.
  out += stroke(`M3 ${HY}H${n(C - SUN - 1.8)}M${n(C + SUN + 1.8)} ${HY}H45`, color, wt.line);
  out += el("path", { d: `M${n(C - SUN)} ${HY}H${n(C + SUN)}`, stroke: PAPER, "stroke-width": wt.line * 0.42, fill: "none" });
  out += slit
    ? el("ellipse", { cx: C, cy: HY, rx: wt.pupil * 0.55, ry: SUN * 0.62, fill: PAPER })
    : el("circle", { cx: C, cy: HY, r: wt.pupil * 1.3, fill: PAPER });
  out += stroke(arc(LID, 205, 335), color, wt.line);
  out += stroke(arc(LID, 25, 155), color, wt.line);
  for (const deg of [-58, -29, 0, 29, 58]) {
    const a = 270 + deg;
    const [x0, y0] = pt(LID + 3.2, a);
    const [x1, y1] = pt(LID + 6.4, a);
    out += stroke(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`, color, wt.line * 0.85);
  }
  return out;
}

function thinking(color: string, wt: Weights, cls?: string): string {
  const sun = `M${n(C - SUN)} ${HY}A${SUN} ${SUN} 0 0 1 ${n(C + SUN)} ${HY}Z`;
  const pupilY = HY - (4 * SUN) / (3 * Math.PI);
  // Three strokes of the lid, 30° each with 20° gaps, read as a pause.
  const lid = [arc(LID, 205, 237), arc(LID, 254, 286), arc(LID, 303, 335)].join("");
  return (
    el("path", { d: sun, fill: color }) +
    el("circle", { cx: C - 2.6, cy: pupilY - 1.5, r: wt.pupil, fill: PAPER }) +
    stroke(lid, color, wt.line, cls ? { class: cls } : {}) +
    stroke(`M3 ${HY}H45`, color, wt.line)
  );
}

function glitch(color: string, wt: Weights): string {
  const base = dawn(color, wt);
  // The idle mark cut into bands and slipped sideways, like a torn scanline;
  // a faint copy sits out of register behind it.
  const bands: Array<[number, number, number]> = [
    [0, 12.5, 0],
    [12.5, 5.5, -3.6],
    [18, 3, 4.4],
    [21, 4.2, -1.4],
    [25.2, 3.4, 2.2],
    [28.6, 19.4, 0],
  ];
  let out = el("g", { opacity: 0.28 }, clipRect(-8, 10, 64, 18, base, 5.5, 0));
  for (const [y, h, dx] of bands) out += clipRect(-8, y, 64, h, base, dx, 0);
  out += el("rect", { x: 30, y: 19.4, width: 13, height: 1, fill: color });
  out += el("rect", { x: 6, y: 23.6, width: 8, height: 0.8, fill: color });
  return out;
}

/** Morrow's logo mark as an SVG string. */
export function morrowMark(state: MorrowState = "idle", options: MorrowMarkOptions = {}): string {
  const size = options.size ?? 32;
  const wt = weights(size);
  const color = options.color ?? (state === "red" ? PIGMENT.signal : PIGMENT.cobalt);
  const anim = options.animate === true;
  let body = "";
  if (options.tile) body += el("rect", { x: 0, y: 0, width: 48, height: 48, rx: 11, fill: options.tile });
  const pupilCls = anim ? idattr("pupil") : undefined;
  const lidCls = anim ? idattr("lid") : undefined;
  switch (state) {
    case "idle":
      body += dawn(color, wt, 0, 0, { pupil: pupilCls });
      break;
    case "thinking":
      body += thinking(color, wt, lidCls);
      break;
    case "alert":
      body += eye(color, wt, false);
      break;
    case "red":
      body += eye(color, wt, true);
      break;
    case "glitch":
      body += anim ? el("g", { class: idattr("glitch") }, glitch(color, wt)) : glitch(color, wt);
      break;
  }
  if (anim) body = motionStyle(state) + body;
  return svgDoc(body, {
    viewBox: [0, 0, 48, 48],
    width: size,
    height: size,
    title: options.title,
    className: `brand-morrow brand-morrow--${state}`,
    extra: { "data-state": state, overflow: "visible" },
  });
}

function motionStyle(state: MorrowState): string {
  const pupil = idattr("pupil");
  const lid = idattr("lid");
  const g = idattr("glitch");
  let css = "";
  if (state === "idle")
    css = `.${pupil}{animation:${pupil}-look 11s cubic-bezier(.65,0,.35,1) infinite}@keyframes ${pupil}-look{0%,38%,100%{transform:translate(0,0)}46%,62%{transform:translate(-1.6px,-.4px)}70%,86%{transform:translate(1.4px,-.2px)}}`;
  else if (state === "thinking")
    css = `.${lid}{stroke-dasharray:4 3;animation:${lid}-run 1.6s linear infinite}@keyframes ${lid}-run{to{stroke-dashoffset:-14}}`;
  else if (state === "glitch") css = `.${g}{animation:${g}-jit .9s steps(3) infinite}@keyframes ${g}-jit{0%{transform:translate(0,0)}33%{transform:translate(1px,0)}66%{transform:translate(-1.5px,0)}}`;
  if (!css) return "";
  css += `@media (prefers-reduced-motion: reduce){.${pupil},.${lid},.${g}{animation:none!important}}`;
  return el("style", {}, css);
}

/** "morrow" set in Geist with the mark: the assistant's lockup. */
export function morrowLockup(options: { height?: number; byline?: boolean; color?: string } = {}): string {
  const h = options.height ?? 32;
  const color = options.color ?? PIGMENT.cobalt;
  const wt = weights(h);
  const size = 30;
  const word = text("morrow", { x: 58, y: 34, size, weight: 520, tracking: -0.02, fill: color });
  let w = 58 + textWidth("morrow", { size, weight: 520, tracking: -0.02 });
  let body = dawn(color, wt) + word;
  if (options.byline) {
    const by = { size: 12, weight: 500, tracking: 0.02 };
    body += text("by Vela", { x: w + 8, y: 34, fill: INK, opacity: 0.55, ...by });
    w += 8 + textWidth("by Vela", by);
  }
  return svgDoc(body, { viewBox: [0, 0, w + 2, 48], width: ((w + 2) / 48) * h, height: h, title: "Morrow", className: "brand-morrow-lockup" });
}
