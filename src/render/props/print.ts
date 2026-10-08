/**
 * Printed surfaces: pages, stamps, seals, labels and lettering drawn on inked
 * canvases. Dark texels become ink, strong red becomes pigment (bright red =
 * signal, dark red = blood), transparent texels are cut out.
 *
 * Textures are cached by design key so a row of identical labels costs one
 * texture. Outside a browser (tests, workers) nothing is drawn and callers
 * fall back to plain geometry.
 */
import * as THREE from "three";
import { createInkCanvas, inkMaterial } from "../core/ink-material.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { OBJECT_ID } from "./common.ts";

export const SANS = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
// Owner rule: sans-serif only. The name is kept for call sites.
export const SERIF = 'Geist, "Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO = '"Courier New", Courier, "Liberation Mono", monospace';
export const HEAVY = '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Signal red as it must be drawn on canvas to become pigment. */
export const RED = "#e00000";
/** Dark red: becomes blood pigment (wax, old seals). */
export const OXBLOOD = "#8a0a10";

let drawable: boolean | null = null;
export function canDraw(): boolean {
  if (drawable !== null) return drawable;
  try {
    drawable = typeof document !== "undefined" && !!document.createElement("canvas").getContext("2d");
  } catch {
    drawable = false;
  }
  return drawable;
}

const cache = new Map<string, THREE.CanvasTexture>();

export type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A cached inked texture, or null when no canvas is available. */
export function inkTexture(key: string, w: number, h: number, paint: Painter, transparent = false): THREE.CanvasTexture | null {
  if (!canDraw()) return null;
  const hit = cache.get(key);
  if (hit) return hit;
  const { ctx, texture } = createInkCanvas(w, h);
  if (transparent) ctx.clearRect(0, 0, w, h);
  ctx.save();
  paint(ctx, w, h);
  ctx.restore();
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

export interface PrintOptions {
  hatch?: number;
  objectId?: number;
  shade?: number;
  side?: THREE.Side;
  hatchSpace?: "object" | "world";
  /** Extra pigment under the whole print (e.g. amber for a hi-vis plate). */
  accent?: "amber" | "cobalt" | "leaf" | "signal";
  accentAmount?: number;
  edge?: number;
}

export function printMaterial(tex: THREE.Texture, o: PrintOptions = {}): THREE.MeshLambertMaterial {
  return inkMaterial({
    map: tex,
    hatchSpace: o.hatchSpace ?? "object",
    hatch: o.hatch ?? 0.014,
    objectId: o.objectId ?? OBJECT_ID.print,
    shade: o.shade ?? 0.75,
    side: o.side ?? THREE.FrontSide,
    ...(o.accent ? { accent: o.accent, accentAmount: o.accentAmount ?? 1 } : {}),
    ...(o.edge !== undefined ? { edge: o.edge } : {}),
  });
}

/**
 * A printed rectangle. `face` picks its orientation: "up" lies flat facing +Y
 * with the top of the print toward -Z (so it reads from +Z), "front" stands
 * facing +Z, "back" faces -Z, "left"/"right" face -X/+X.
 */
export function printPlane(
  tex: THREE.Texture | null,
  w: number,
  h: number,
  at: [number, number, number],
  face: "up" | "front" | "back" | "left" | "right",
  o: PrintOptions & { rotate?: number; segX?: number; segY?: number; warp?: (x: number, y: number) => number } = {},
): THREE.Mesh | null {
  if (!tex) return null;
  const g = new THREE.PlaneGeometry(w, h, o.segX ?? 1, o.segY ?? 1);
  if (o.warp) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, o.warp(pos.getX(i), pos.getY(i)));
    g.computeVertexNormals();
  }
  if (o.rotate) g.rotateZ(o.rotate);
  if (face === "up") g.rotateX(-Math.PI / 2);
  else if (face === "back") g.rotateY(Math.PI);
  else if (face === "left") g.rotateY(-Math.PI / 2);
  else if (face === "right") g.rotateY(Math.PI / 2);
  g.translate(at[0], at[1], at[2]);
  const mesh = new THREE.Mesh(g, printMaterial(tex, o));
  mesh.name = "print";
  return mesh;
}

// ------------------------------------------------------------------ lettering

/** Set a font no larger than maxH px that fits `text` into maxW (with squeeze). */
export function fit(g: CanvasRenderingContext2D, text: string, weight: string, family: string, maxW: number, maxH: number, squeeze = 1): number {
  let size = Math.max(4, Math.floor(maxH));
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width * squeeze;
  if (w > maxW) size = Math.max(4, Math.floor((size * maxW) / w));
  g.font = `${weight} ${size}px ${family}`;
  return size;
}

export interface TextOpts {
  weight?: string;
  family?: string;
  align?: CanvasTextAlign;
  color?: string;
  /** Horizontal squeeze factor (condensed faces without relying on installed fonts). */
  squeeze?: number;
  /** Extra letter spacing in px. */
  track?: number;
  maxW?: number;
}

/** Draw a line of text whose cap height fills `size` px, fitted to maxW. */
export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, o: TextOpts = {}): void {
  const weight = o.weight ?? "bold";
  const family = o.family ?? SANS;
  const squeeze = o.squeeze ?? 1;
  const track = o.track ?? 0;
  g.save();
  g.fillStyle = o.color ?? "#000";
  g.textBaseline = "middle";
  // Font px size is roughly 1.38x the cap height for these faces.
  let px = size * 1.38;
  g.font = `${weight} ${px}px ${family}`;
  const measure = () => (g.measureText(s).width + track * Math.max(0, s.length - 1)) * squeeze;
  if (o.maxW && measure() > o.maxW) {
    px *= o.maxW / measure();
    g.font = `${weight} ${px}px ${family}`;
  }
  const width = measure();
  let x0 = x;
  if ((o.align ?? "center") === "center") x0 = x - width / 2;
  else if (o.align === "right" || o.align === "end") x0 = x - width;
  g.translate(x0, y);
  g.scale(squeeze, 1);
  g.textAlign = "left";
  if (track === 0) g.fillText(s, 0, 0);
  else {
    let cx = 0;
    for (const ch of s) {
      g.fillText(ch, cx, 0);
      cx += g.measureText(ch).width + track;
    }
  }
  g.restore();
}

/** Word-wrap to at most `maxLines` lines of `perLine` characters. */
export function wrap(s: string, perLine: number, maxLines = 2): string[] {
  const words = s.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= perLine) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  // Rebalance into maxLines by length.
  const all = words.join(" ");
  const out: string[] = [];
  const target = Math.ceil(all.length / maxLines);
  cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > target && out.length < maxLines - 1) {
      out.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  out.push(cur);
  return out;
}

/**
 * Greeked body copy: word-length bars in rows, the way an illustrator
 * suggests print that is too small to read.
 */
export function greek(g: CanvasRenderingContext2D, x: number, y: number, w: number, lineH: number, lines: number, rng: Rng, o: { color?: string; weight?: number; ragged?: boolean; indent?: number } = {}): void {
  g.save();
  g.fillStyle = o.color ?? "#3a3a3a";
  const bar = Math.max(1, lineH * (o.weight ?? 0.42));
  for (let i = 0; i < lines; i++) {
    const last = o.ragged !== false && (i === lines - 1 || rng.chance(0.12));
    const end = x + (last ? w * rng.range(0.3, 0.75) : w);
    let cx = x + (i === 0 && o.indent ? o.indent : 0);
    const yy = y + i * lineH;
    while (cx < end - lineH * 0.8) {
      const len = Math.min(end - cx, lineH * rng.range(0.9, 3.8));
      g.fillRect(cx, yy - bar / 2, len, bar);
      cx += len + lineH * rng.range(0.35, 0.55);
    }
  }
  g.restore();
}

/** A ruled rectangle. */
export function frame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw: number, color = "#000"): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  g.restore();
}

/** Checkbox form rows: label bars with boxes, some ticked. */
export function formRows(g: CanvasRenderingContext2D, x: number, y: number, w: number, rowH: number, rows: number, rng: Rng): void {
  g.save();
  for (let i = 0; i < rows; i++) {
    const yy = y + i * rowH;
    const box = rowH * 0.55;
    g.strokeStyle = "#000";
    g.lineWidth = Math.max(1, rowH * 0.06);
    g.strokeRect(x, yy - box / 2, box, box);
    if (rng.chance(0.55)) {
      g.beginPath();
      g.moveTo(x + box * 0.15, yy);
      g.lineTo(x + box * 0.42, yy + box * 0.3);
      g.lineTo(x + box * 0.95, yy - box * 0.45);
      g.lineWidth = Math.max(1, rowH * 0.1);
      g.stroke();
    }
    g.fillStyle = "#333";
    const lw = w * rng.range(0.35, 0.6);
    g.fillRect(x + box * 1.8, yy - rowH * 0.1, lw, rowH * 0.2);
    // Answer field underline.
    g.fillStyle = "#000";
    g.fillRect(x + box * 2.2 + lw, yy + rowH * 0.28, w - lw - box * 2.2, Math.max(1, rowH * 0.05));
  }
  g.restore();
}

/** A cursive signature scrawl. */
export function signature(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: Rng, color = "#101030"): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.2, h * 0.07);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  let cx = x;
  g.moveTo(cx, y + h * 0.2);
  const loops = rng.int(4, 7);
  for (let i = 0; i < loops; i++) {
    const step = w / loops;
    const up = h * rng.range(0.3, 0.9);
    g.bezierCurveTo(cx + step * 0.2, y - up, cx + step * 0.9, y - up * 0.6, cx + step * 0.5, y + h * 0.25);
    g.bezierCurveTo(cx + step * 0.3, y + h * 0.5, cx + step * 1.1, y + h * 0.1, cx + step, y + h * rng.range(-0.1, 0.25));
    cx += step;
  }
  g.stroke();
  // The flourish underline.
  g.beginPath();
  g.moveTo(x + w * 0.05, y + h * 0.55);
  g.quadraticCurveTo(x + w * 0.6, y + h * 0.85, x + w * 1.05, y + h * 0.35);
  g.lineWidth = Math.max(1, h * 0.05);
  g.stroke();
  g.restore();
}

/** A barcode strip. */
export function barcode(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: Rng): void {
  g.save();
  g.fillStyle = "#000";
  let cx = x;
  while (cx < x + w) {
    const bw = rng.pick([1, 1, 2, 3]) * (w / 90);
    if (rng.chance(0.55)) g.fillRect(cx, y, bw, h);
    cx += bw;
  }
  g.restore();
}

/** Guilloche security border: interlaced sine ribbons around a rectangle. */
export function guilloche(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, band: number, color = "#000"): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = Math.max(0.8, band * 0.05);
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len,
      ny = (x1 - x0) / len;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let s = 0; s <= len; s += 2) {
        const t = s / len;
        const off = Math.sin((s / band) * Math.PI * 1.6 + k * 2.1) * band * 0.38;
        const px = x0 + (x1 - x0) * t + nx * off;
        const py = y0 + (y1 - y0) * t + ny * off;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
  };
  const i = band / 2;
  edge(x + i, y + i, x + w - i, y + i);
  edge(x + w - i, y + i, x + w - i, y + h - i);
  edge(x + w - i, y + h - i, x + i, y + h - i);
  edge(x + i, y + h - i, x + i, y + i);
  g.lineWidth = Math.max(1, band * 0.08);
  g.strokeRect(x, y, w, h);
  g.strokeRect(x + band, y + band, w - band * 2, h - band * 2);
  g.restore();
}

/**
 * A rubber-stamp impression: double-ruled box, condensed caps, the rubber's
 * uneven inking knocked out as speckle. Drawn in signal red by default.
 */
export function stamp(g: CanvasRenderingContext2D, label: string, cx: number, cy: number, width: number, angle: number, rng: Rng, o: { color?: string; round?: boolean; sub?: string } = {}): void {
  const color = o.color ?? RED;
  const W = Math.ceil(width * 1.1);
  const H = Math.ceil(o.round ? width * 1.1 : width * 0.42);
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const s = off.getContext("2d")!;
  s.strokeStyle = color;
  s.fillStyle = color;
  if (o.round) {
    const r = W * 0.46;
    s.lineWidth = r * 0.07;
    s.beginPath();
    s.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    s.stroke();
    s.lineWidth = r * 0.03;
    s.beginPath();
    s.arc(W / 2, H / 2, r * 0.8, 0, Math.PI * 2);
    s.stroke();
    // Ring text.
    const ring = (o.sub ?? "OFFICIAL · RECORD ·").toUpperCase();
    s.font = `bold ${r * 0.16}px ${SANS}`;
    s.textAlign = "center";
    s.textBaseline = "middle";
    const chars = ring.split("");
    for (let i = 0; i < chars.length; i++) {
      const a = -Math.PI / 2 + (i / chars.length) * Math.PI * 2;
      s.save();
      s.translate(W / 2 + Math.cos(a) * r * 0.9, H / 2 + Math.sin(a) * r * 0.9);
      s.rotate(a + Math.PI / 2);
      s.fillText(chars[i]!, 0, 0);
      s.restore();
    }
    text(s, label, W / 2, H / 2, r * 0.3, { color, weight: "900", family: SANS, squeeze: 0.8, maxW: r * 1.45 });
  } else {
    const lw = H * 0.075;
    s.lineWidth = lw;
    s.strokeRect(lw, lw, W - lw * 2, H - lw * 2);
    s.lineWidth = lw * 0.45;
    s.strokeRect(lw * 2.6, lw * 2.6, W - lw * 5.2, H - lw * 5.2);
    text(s, label, W / 2, H / 2 + H * 0.02, H * 0.44, { color, weight: "900", family: SANS, squeeze: 0.82, maxW: W - lw * 8, track: H * 0.02 });
  }
  // Uneven inking: knock out speckle and a worn streak.
  s.globalCompositeOperation = "destination-out";
  const n = Math.round((W * H) / 90);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.4, 1.8) * (W / 300);
    s.globalAlpha = rng.range(0.4, 1);
    s.beginPath();
    s.arc(rng.range(0, W), rng.range(0, H), r, 0, Math.PI * 2);
    s.fill();
  }
  s.globalAlpha = 0.55;
  const sx = rng.range(0.1, 0.8) * W;
  s.fillRect(sx, 0, W * rng.range(0.03, 0.08), H);
  s.globalAlpha = 1;
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  g.drawImage(off, -W / 2, -H / 2);
  g.restore();
}

/** An embossed foil seal: scalloped rosette with ring lettering, in red. */
export function seal(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, o: { color?: string; ribbons?: boolean; label?: string } = {}): void {
  const color = o.color ?? RED;
  g.save();
  g.translate(cx, cy);
  if (o.ribbons !== false) {
    g.fillStyle = color;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * r * 0.25, r * 0.4);
      g.lineTo(side * r * 0.8, r * 1.9);
      g.lineTo(side * r * 0.55, r * 1.7);
      g.lineTo(side * r * 0.42, r * 2.0);
      g.lineTo(side * r * 0.0, r * 0.5);
      g.closePath();
      g.fill();
    }
  }
  g.fillStyle = color;
  g.beginPath();
  const n = 28;
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 0.9;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.fill();
  g.strokeStyle = "#fff";
  g.lineWidth = r * 0.04;
  g.beginPath();
  g.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  g.stroke();
  if (o.label) text(g, o.label, 0, 0, r * 0.26, { color: "#fff", weight: "900", squeeze: 0.8, maxW: r * 0.9 });
  g.restore();
}

/** The Vela letterhead mark: a ring with a chevron, then the name. */
export function velaMark(g: CanvasRenderingContext2D, x: number, y: number, s: number, color = "#000"): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = s * 0.1;
  g.beginPath();
  g.arc(x + s / 2, y + s / 2, s * 0.45, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(x + s * 0.27, y + s * 0.3);
  g.lineTo(x + s * 0.5, y + s * 0.72);
  g.lineTo(x + s * 0.73, y + s * 0.3);
  g.lineWidth = s * 0.12;
  g.stroke();
  text(g, "VELA", x + s * 1.25, y + s / 2, s * 0.5, { align: "left", color, weight: "bold", track: s * 0.12 });
  g.restore();
}

/** Paper tooth: a faint speckle so large blank areas are not dead white. */
export function paperTooth(g: CanvasRenderingContext2D, w: number, h: number, rng: Rng, amount = 1): void {
  g.save();
  g.fillStyle = "#000";
  const n = Math.round(((w * h) / 2600) * amount);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = rng.range(0.04, 0.12);
    g.fillRect(rng.range(0, w), rng.range(0, h), rng.range(1, 2.5), rng.range(1, 2.5));
  }
  g.restore();
}

/** Stencil lettering: counters bridged the way a cut stencil must be. */
export function stencil(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, o: TextOpts & { bridge?: string } = {}): void {
  const weight = o.weight ?? "900";
  const family = o.family ?? SANS;
  const squeeze = o.squeeze ?? 0.86;
  const track = o.track ?? size * 0.12;
  let px = size * 1.38;
  g.save();
  g.font = `${weight} ${px}px ${family}`;
  const widthOf = () => [...s].reduce((a, ch) => a + g.measureText(ch).width, 0) * squeeze + track * (s.length - 1);
  if (o.maxW && widthOf() > o.maxW) {
    px *= o.maxW / widthOf();
    g.font = `${weight} ${px}px ${family}`;
  }
  const total = widthOf();
  let cx = (o.align ?? "center") === "center" ? x - total / 2 : o.align === "right" ? x - total : x;
  g.textBaseline = "middle";
  const bridge = o.bridge ?? "#fff";
  const counters = "ABDOPQR04689&@";
  const splitAll = "EFHKMNUWXY";
  for (const ch of s) {
    const cw = g.measureText(ch).width * squeeze;
    g.save();
    g.translate(cx, y);
    g.scale(squeeze, 1);
    g.fillStyle = o.color ?? "#000";
    g.fillText(ch, 0, 0);
    g.restore();
    if (counters.includes(ch) || splitAll.includes(ch)) {
      // Vertical bridge through the letter's middle.
      g.fillStyle = bridge;
      const bw = Math.max(1.5, px * 0.07);
      if (ch === "E" || ch === "F") g.fillRect(cx + cw * 0.3, y - px * 0.4, bw, px * 0.8);
      else g.fillRect(cx + cw / 2 - bw / 2, y - px * 0.4, bw, px * 0.8);
    }
    cx += cw + track;
  }
  g.restore();
}

/**
 * Hand-lettering in marker pen: each glyph jittered in angle, size and
 * baseline, thickened with a round-cap stroke. For placards.
 */
export function marker(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, rng: Rng, o: { color?: string; maxW?: number; align?: "center" | "left" } = {}): void {
  const color = o.color ?? "#000";
  g.save();
  let px = size * 1.3;
  const family = '"Arial Rounded MT Bold", "Helvetica Neue", Helvetica, Arial, sans-serif';
  g.font = `bold ${px}px ${family}`;
  const widthOf = () => [...s].reduce((a, ch) => a + g.measureText(ch).width * 0.92, 0);
  if (o.maxW && widthOf() > o.maxW) {
    px *= o.maxW / widthOf();
    g.font = `bold ${px}px ${family}`;
  }
  let cx = (o.align ?? "center") === "center" ? x - widthOf() / 2 : x;
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineCap = "round";
  const drift = rng.range(-0.04, 0.04);
  let i = 0;
  for (const ch of s) {
    const cw = g.measureText(ch).width * 0.92;
    g.save();
    g.translate(cx + cw / 2, y + rng.range(-0.05, 0.05) * px + drift * i * px * 0.2);
    g.rotate(rng.range(-0.07, 0.07));
    const sc = rng.range(0.93, 1.07);
    g.scale(sc, sc);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = px * 0.07;
    g.textAlign = "center";
    g.fillText(ch, 0, 0);
    g.strokeText(ch, 0, 0);
    g.restore();
    cx += cw;
    i++;
  }
  g.restore();
}

export function seeded(seed: number | string, salt: string): Rng {
  return createRng(`${salt}:${seed}`);
}
