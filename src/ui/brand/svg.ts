/**
 * A tiny string SVG builder. Every generator in src/ui/brand returns a
 * self-contained, well-formed SVG document string: inline fills and strokes,
 * no external CSS, no scripts, parseable by DOMParser as image/svg+xml.
 *
 * Ids: most drawings need no <defs> at all (hatching is clipped analytically,
 * bands are clipped with nested <svg> viewports). Where an id is unavoidable,
 * write `idref("name")` / `idattr("name")`; `svgDoc` replaces the token with a
 * content-addressed id, so identical drawings share identical ids (harmless)
 * and different drawings never collide on one page.
 */
import { hashString } from "../../render/core/rng.ts";
import { FONT_MONO, FONT_SANS, INK } from "./palette.ts";
import { measure } from "./metrics.ts";

/** Format a number compactly (max 2 decimals, no trailing zeros). */
export function n(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue>;

export function attrs(a: Attrs): string {
  let out = "";
  for (const [k, v] of Object.entries(a)) {
    if (v === null || v === undefined || v === false) continue;
    const s = typeof v === "number" ? n(v) : v === true ? k : String(v);
    out += ` ${k}="${esc(s)}"`;
  }
  return out;
}

export function el(tag: string, a: Attrs = {}, children?: string | readonly string[]): string {
  const body = Array.isArray(children) ? children.join("") : (children as string | undefined);
  return body === undefined || body === "" ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${body}</${tag}>`;
}

const ID_TOKEN = /@@id:([a-z0-9-]+)@@/g;
/** `url(#…)` reference to a local id, finalised by svgDoc. */
export const idref = (name: string) => `url(#@@id:${name}@@)`;
/** The bare id value, finalised by svgDoc. */
export const idattr = (name: string) => `@@id:${name}@@`;

export interface DocOptions {
  viewBox: readonly [number, number, number, number];
  width: number;
  height: number;
  /** Accessible name. Without one the drawing is aria-hidden (decorative). */
  title?: string;
  className?: string;
  preserveAspectRatio?: string;
  /** Extra attributes on the root (e.g. data-state). */
  extra?: Attrs;
}

export function svgDoc(body: string, o: DocOptions): string {
  let content = body;
  if (content.includes("@@id:")) {
    const h = hashString(content).toString(36);
    content = content.replace(ID_TOKEN, (_m, name: string) => `br${h}-${name}`);
  }
  const labelled = !!o.title;
  const root = attrs({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: o.viewBox.map(n).join(" "),
    width: n(o.width),
    height: n(o.height),
    class: o.className,
    preserveAspectRatio: o.preserveAspectRatio,
    role: labelled ? "img" : undefined,
    "aria-label": o.title,
    "aria-hidden": labelled ? undefined : "true",
    focusable: "false",
    ...(o.extra ?? {}),
  });
  const title = labelled ? `<title>${esc(o.title!)}</title>` : "";
  return `<svg${root}>${title}${content}</svg>`;
}

/* ------------------------------------------------------------------ text */

export interface TextOptions {
  x: number;
  y: number;
  size: number;
  weight?: number;
  mono?: boolean;
  anchor?: "start" | "middle" | "end";
  fill?: string;
  /** Letter spacing in em. Applied through textLength so layout is exact. */
  tracking?: number;
  /** Force an exact rendered width (overrides tracking). */
  width?: number;
  /** Synthetic oblique, degrees (positive leans right). */
  italic?: number;
  /** Horizontal scale for synthetic condensing (0.7..1). */
  stretch?: number;
  opacity?: number;
}

/** Natural width of a text run under TextOptions (before stretch). */
export function textWidth(str: string, o: Pick<TextOptions, "size" | "weight" | "mono" | "tracking">): number {
  return measure(str, { size: o.size, weight: o.weight ?? 400, mono: o.mono, tracking: o.tracking ?? 0 });
}

/**
 * A single line of text with an exact advance width. textLength with
 * lengthAdjust="spacing" distributes tracking between glyphs, so the run is
 * the width the layout expects whether or not Geist has loaded yet.
 */
export function text(str: string, o: TextOptions): string {
  const weight = o.weight ?? 400;
  const width = o.width ?? textWidth(str, o);
  const stretch = o.stretch ?? 1;
  const italic = o.italic ?? 0;
  const transformed = stretch !== 1 || italic !== 0;
  const a: Attrs = {
    x: transformed ? 0 : o.x,
    y: transformed ? 0 : o.y,
    "font-family": o.mono ? FONT_MONO : FONT_SANS,
    "font-size": o.size,
    "font-weight": weight,
    "text-anchor": o.anchor && o.anchor !== "start" ? o.anchor : undefined,
    fill: o.fill ?? INK,
    opacity: o.opacity,
    textLength: Array.from(str).length > 1 ? width : undefined,
    lengthAdjust: Array.from(str).length > 1 ? "spacing" : undefined,
  };
  const node = el("text", a, esc(str));
  if (!transformed) return node;
  const t = `translate(${n(o.x)} ${n(o.y)})${italic ? ` skewX(${n(-italic)})` : ""}${stretch !== 1 ? ` scale(${n(stretch)} 1)` : ""}`;
  return el("g", { transform: t }, node);
}

/** Wrap content so it is clipped to a rectangle, without defs. */
export function clipRect(x: number, y: number, w: number, h: number, content: string, dx = 0, dy = 0): string {
  return el(
    "svg",
    { x, y, width: w, height: h, viewBox: `${n(x - dx)} ${n(y - dy)} ${n(w)} ${n(h)}`, overflow: "hidden" },
    content,
  );
}
