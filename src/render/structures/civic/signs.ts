/**
 * Inked signage: nameboards, painted lettering, enamel plates and notices.
 *
 * Signs are the only civic parts that are not merged into the building's
 * geometry, because an inked texture needs its own UVs. Textures (and so
 * materials) are cached per design, so a town full of identical boards costs
 * one texture. Outside a browser (tests, workers) signs are skipped.
 */
import * as THREE from "three";
import { createInkCanvas, inkMaterial } from "../../core/ink-material.ts";
import type { Rng } from "../../core/rng.ts";

export type SignKind =
  /** Black letters on a white board with a ruled border. */
  | "board"
  /** White letters on solid ink (railway enamel). */
  | "enamel"
  /** Letters painted straight onto a wall: no background. */
  | "painted"
  /** Incised letters on a stone frieze: no background, serif. */
  | "carved"
  /** A dense printed notice (title plus small lines). */
  | "notice"
  /** A clock dial; `text` is the time as "HH:MM". */
  | "clock"
  /** A projecting blade: a red cross in a roundel over stacked letters. */
  | "blade";

export interface SignDesign {
  kind: SignKind;
  text: string;
  /** Second line (smaller). */
  sub?: string;
  /** Draw a signal-red medical cross before the text. */
  cross?: boolean;
  /** Serif face (civic stone) instead of the grotesque (rail, clinic). */
  serif?: boolean;
  /** Canvas pixels per metre of sign height. */
  density?: number;
}

const cache = new Map<string, THREE.CanvasTexture>();

function canDraw(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("2d");
  } catch {
    return false;
  }
}
let drawable: boolean | null = null;

const SANS = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
// Owner rule: sans-serif only. The name is kept for call sites.
const SERIF = 'Geist, "Helvetica Neue", Helvetica, Arial, sans-serif';

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, maxW: number, maxH: number): number {
  let size = Math.floor(maxH);
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) size = Math.floor((size * maxW) / w);
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function spaced(text: string, serif: boolean): string {
  // Carved and serif inscriptions read better letter-spaced.
  return serif ? text.split("").join(" ") : text;
}

function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.fillStyle = "#e00000";
  const a = s * 0.34;
  ctx.fillRect(cx - a / 2, cy - s / 2, a, s);
  ctx.fillRect(cx - s / 2, cy - a / 2, s, a);
}

function texture(design: SignDesign, aspect: number): THREE.CanvasTexture {
  const key = JSON.stringify(design) + "|" + aspect.toFixed(3);
  const hit = cache.get(key);
  if (hit) return hit;
  const H = design.kind === "notice" ? 512 : design.kind === "clock" ? 256 : design.kind === "blade" ? 1024 : 160;
  const W = Math.min(2048, Math.max(64, Math.round(H * aspect)));
  const { ctx, texture: tex } = createInkCanvas(W, H);
  const serif = design.serif ?? design.kind === "carved";
  const family = serif ? SERIF : SANS;
  const text = design.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const pad = H * 0.12;
  switch (design.kind) {
    case "board": {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = H * 0.07;
      ctx.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
      ctx.lineWidth = H * 0.018;
      ctx.strokeRect(H * 0.14, H * 0.14, W - H * 0.28, H - H * 0.28);
      let x0 = pad * 1.6;
      if (design.cross) {
        drawCross(ctx, H * 0.62, H / 2, H * 0.52);
        x0 = H * 1.05;
      }
      ctx.fillStyle = "#000";
      const cx = (x0 + W - pad * 1.6) / 2;
      if (design.sub) {
        fitFont(ctx, text, "bold", family, W - x0 - pad * 1.6, H * 0.44);
        ctx.fillText(text, cx, H * 0.4);
        fitFont(ctx, design.sub, "600", family, W - x0 - pad * 1.6, H * 0.2);
        ctx.fillText(design.sub, cx, H * 0.72);
      } else {
        fitFont(ctx, text, "bold", family, W - x0 - pad * 1.6, H * 0.56);
        ctx.fillText(text, cx, H * 0.53);
      }
      break;
    }
    case "enamel": {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = H * 0.035;
      ctx.strokeRect(H * 0.1, H * 0.1, W - H * 0.2, H - H * 0.2);
      ctx.fillStyle = "#fff";
      fitFont(ctx, text, "bold", family, W - pad * 3, H * 0.52);
      ctx.fillText(text, W / 2, H * 0.53);
      break;
    }
    case "painted":
    case "carved": {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000";
      const t = spaced(text, serif);
      if (design.sub) {
        fitFont(ctx, t, design.kind === "carved" ? "normal" : "bold", family, W - pad * 2, H * 0.5);
        ctx.fillText(t, W / 2, H * 0.36);
        fitFont(ctx, design.sub, "normal", family, W - pad * 2, H * 0.24);
        ctx.fillText(design.sub, W / 2, H * 0.78);
      } else {
        fitFont(ctx, t, design.kind === "carved" ? "normal" : "bold", family, W - pad * 2, H * 0.78);
        ctx.fillText(t, W / 2, H * 0.54);
      }
      break;
    }
    case "notice": {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = H * 0.02;
      ctx.strokeRect(H * 0.02, H * 0.02, W - H * 0.04, H - H * 0.04);
      ctx.fillStyle = "#000";
      ctx.fillRect(H * 0.02, H * 0.02, W - H * 0.04, H * 0.2);
      ctx.fillStyle = "#fff";
      fitFont(ctx, text, "bold", family, W * 0.86, H * 0.12);
      ctx.fillText(text, W / 2, H * 0.12);
      ctx.fillStyle = "#000";
      const sub = design.sub ?? "";
      fitFont(ctx, sub, "bold", family, W * 0.86, H * 0.1);
      ctx.fillText(sub, W / 2, H * 0.34);
      // Body copy nobody at the fence can read from here.
      ctx.fillStyle = "#222";
      for (let i = 0; i < 9; i++) {
        const y = H * (0.46 + i * 0.052);
        const len = W * (i % 4 === 3 ? 0.5 : 0.84);
        ctx.fillRect(W * 0.08, y, len, H * 0.018);
      }
      break;
    }
  }
  if (design.kind === "blade") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = W * 0.06;
    ctx.strokeRect(W * 0.04, W * 0.04, W - W * 0.08, H - W * 0.08);
    const r = W * 0.36;
    ctx.beginPath();
    ctx.arc(W / 2, W * 0.55, r, 0, Math.PI * 2);
    ctx.lineWidth = W * 0.05;
    ctx.stroke();
    if (design.cross !== false) drawCross(ctx, W / 2, W * 0.55, r * 1.25);
    const letters = design.text.split("");
    const top = W * 1.05;
    const each = (H - top - W * 0.12) / letters.length;
    ctx.fillStyle = "#000";
    ctx.font = `bold ${Math.floor(Math.min(each * 0.86, W * 0.72))}px ${SANS}`;
    letters.forEach((ch, i) => ctx.fillText(ch, W / 2, top + each * (i + 0.5)));
  }
  if (design.kind === "clock") {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.48;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = R * 0.07;
    ctx.stroke();
    ctx.lineWidth = R * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#000";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.sin(a) * R * 0.88, cy - Math.cos(a) * R * 0.88);
      ctx.rotate(a);
      ctx.fillRect(-R * 0.025, -R * 0.08, R * 0.05, R * 0.16);
      ctx.restore();
    }
    const [hh, mm] = design.text.split(":").map(Number);
    const hand = (ang: number, len: number, w: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillRect(-w / 2, -len, w, len + R * 0.08);
      ctx.restore();
    };
    hand((((hh ?? 0) % 12) + (mm ?? 0) / 60) * (Math.PI / 6), R * 0.5, R * 0.08);
    hand(((mm ?? 0) / 60) * Math.PI * 2, R * 0.74, R * 0.05);
  }
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/**
 * A flat sign mesh facing +Z, centred on its origin, or null outside a
 * browser. `w`/`h` are metres.
 */
export function signMesh(design: SignDesign, w: number, h: number, geometry?: THREE.BufferGeometry): THREE.Mesh | null {
  if (drawable === null) drawable = canDraw();
  if (!drawable) return null;
  const tex = texture(design, w / h);
  const mesh = new THREE.Mesh(geometry ?? new THREE.PlaneGeometry(w, h), inkMaterial({ map: tex, shade: 0.55, hatch: 0.14 }));
  mesh.name = `sign:${design.text}`;
  mesh.userData.castShadow = false;
  return mesh;
}

/** Knock letters out of a weathered sign, deterministically. */
export function weather(text: string, amount: number, rng: Rng): string {
  if (amount <= 0) return text;
  return text
    .split("")
    .map((ch) => (ch !== " " && rng.next() < amount ? " " : ch))
    .join("");
}
