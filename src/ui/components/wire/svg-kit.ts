/** Tiny SVG construction kit shared by the wire's fallback brand art. */
import { hash32 } from "./hash.ts";

const NS = "http://www.w3.org/2000/svg";

export type BrandNode = Element | string;

/* ------------------------------------------------------------ svg kit */

export type Attrs = Record<string, string | number>;

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  cls = "",
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (cls) node.setAttribute("class", cls);
  return node;
}

export function root(
  viewBox: string,
  width: number,
  height: number,
  cls: string,
): SVGSVGElement {
  const svg = s(
    "svg",
    { viewBox, width, height, "aria-hidden": "true", focusable: "false" },
    `wb ${cls}`,
  );
  return svg;
}

export function path(d: string, cls: string, attrs: Attrs = {}) {
  return s("path", { d, ...attrs }, cls);
}

let uid = 0;
export function nextId(prefix: string) {
  uid = (uid + 1) % 1e9;
  return `${prefix}-${uid.toString(36)}`;
}

/** Diagonal hatch pattern; returns the fill url. */
export function hatch(
  svg: SVGSVGElement,
  gap = 2.4,
  angle = 45,
  cls = "wb-hs",
): string {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = s("defs");
    svg.prepend(defs);
  }
  const id = nextId("wbh");
  const pattern = s("pattern", {
    id,
    width: gap,
    height: gap,
    patternUnits: "userSpaceOnUse",
    patternTransform: `rotate(${angle})`,
  });
  pattern.append(s("line", { x1: 0, y1: 0, x2: 0, y2: gap }, cls));
  defs.append(pattern);
  return `url(#${id})`;
}

export function toNode(node: BrandNode): Element {
  if (typeof node !== "string") return node;
  // Generated SVG markup from our own brand module (never authored copy).
  const doc = new DOMParser().parseFromString(node, "image/svg+xml");
  const el = doc.documentElement;
  if (el.nodeName.toLowerCase() !== "svg") return s("svg");
  for (const bad of el.querySelectorAll("script, foreignObject")) bad.remove();
  const imported = document.importNode(el, true);
  imported.setAttribute("aria-hidden", "true");
  imported.setAttribute("focusable", "false");
  return imported;
}

export function mulberry(seed: string) {
  let a = hash32(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
