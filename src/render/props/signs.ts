/**
 * Trackside signage: the enamel branch sign at a fork's toe, stencilled
 * warning boards, protest placards, hi-vis warning plates and station
 * nameboards. Lettering is sized to read from the cab: branch signs set
 * their capitals about 0.2 m high and wrap to two lines, so the board is
 * legible at the hold point 15-20 m short of it.
 */
import * as THREE from "three";
import { cylinder } from "../core/geometry.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { Assembly, OBJECT_ID, cblock, cbox, plate, rodY, sheet, slab, tracksideMaterial, turned, roundRect } from "./common.ts";
import { HEAVY, RED, SANS, SERIF, frame, inkTexture, marker, printPlane, stencil, text, wrap } from "./print.ts";
import type { Built } from "./types.ts";

export type SignStyle = "enamel" | "stencil" | "placard" | "warning" | "station";

export interface SignOptions {
  style: SignStyle;
  seed?: number | string;
  /** A smaller second line (station subtitle, warning detail). */
  sub?: string;
  /** 0..1: chips, rust streaks, missing letters are never removed (legibility first). */
  weathered?: number;
  /** Print the main text in signal red (placards, danger boards). */
  red?: boolean;
}

const PX_PER_M = 360;

function lettering(t: string): string {
  return t.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Board sized to its text: returns lines, board width/height and cap height. */
function layout(t: string, cap: number, single: number, maxLines: number, padX: number, padY: number, charW = 0.66): { lines: string[]; w: number; h: number } {
  const lines = t.length <= single ? [t] : wrap(t, Math.max(single, Math.ceil(t.length / maxLines) + 2), maxLines);
  const longest = Math.max(...lines.map((l) => l.length));
  const w = Math.max(0.9, longest * cap * charW + padX * 2);
  const h = lines.length * cap * 1.55 + padY * 2 - cap * 0.55;
  return { lines, w, h };
}

// ------------------------------------------------------------------ enamel branch sign

function enamel(t: string, rng: Rng, o: SignOptions): Built {
  const a = new Assembly(tracksideMaterial(0.04), "sign:enamel");
  const cap = 0.2;
  const { lines, w: W, h: H } = layout(t, cap, 11, 2, 0.16, 0.13);
  const bottom = 0.95;
  // Two white-painted timber posts with weathered caps.
  const postX = W / 2 - Math.min(0.25, W * 0.18);
  for (const s of [-1, 1]) {
    a.add(cblock(0.1, bottom + H + 0.08, 0.1, 0.008), { tone: "paper", position: [s * postX, 0, -0.07] });
    a.add(cblock(0.13, 0.04, 0.13, 0.01), { tone: "light", position: [s * postX, bottom + H + 0.08, -0.07] });
  }
  // Pressed steel plate with a rolled rim, bolted to rails between the posts.
  a.add(cbox(W, H, 0.012, 0.004), { tone: "dark", position: [0, bottom + H / 2, 0] });
  const rim = plate(roundRect(W, H, 0.03, 3), 0.02, 0.004, [roundRect(W - 0.05, H - 0.05, 0.02, 3)]);
  a.add(rim, { tone: "deep", position: [0, bottom + H / 2, 0.006] });
  for (const y of [bottom + H * 0.25, bottom + H * 0.75]) a.add(slab(W * 0.94, 0.05, 0.03), { tone: "light", position: [0, y - 0.025, -0.025] });
  const weathered = o.weathered ?? 0.35;
  const tex = inkTexture(`enamel:${t}:${Math.round(weathered * 10)}`, Math.min(2048, Math.round(W * PX_PER_M)), Math.round(H * PX_PER_M), (g, w, h) => {
    const r = rng.fork("chips");
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#fff";
    g.lineWidth = h * 0.02;
    const inset = h * 0.075;
    g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    const capPx = cap * PX_PER_M;
    const lineH = capPx * 1.55;
    const y0 = h / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, i) => text(g, ln, w / 2, y0 + i * lineH, capPx, { color: "#fff", weight: "bold", family: SANS, maxW: w - inset * 3.2, track: capPx * 0.06 }));
    // Bolt heads.
    g.fillStyle = "#fff";
    for (const [x, y] of [
      [inset * 0.5, inset * 0.5],
      [w - inset * 0.5, inset * 0.5],
      [inset * 0.5, h - inset * 0.5],
      [w - inset * 0.5, h - inset * 0.5],
    ] as const) {
      g.beginPath();
      g.arc(x, y, h * 0.018, 0, Math.PI * 2);
      g.fill();
    }
    // Chipped enamel at the edges (the white ground coat shows), rust runs.
    const n = Math.round(12 * weathered);
    for (let i = 0; i < n; i++) {
      const edge = r.int(0, 3);
      const x = edge < 2 ? r.range(0, w) : edge === 2 ? r.range(0, inset) : r.range(w - inset, w);
      const y = edge === 0 ? r.range(0, inset) : edge === 1 ? r.range(h - inset, h) : r.range(0, h);
      g.fillStyle = r.chance(0.5) ? "#fff" : "#9a9a9a";
      g.beginPath();
      const rr = r.range(2, 7) * (h / 200);
      for (let k = 0; k < 7; k++) {
        const an = (k / 7) * Math.PI * 2;
        const q = rr * r.range(0.5, 1.3);
        g.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q);
      }
      g.fill();
    }
    g.fillStyle = "rgba(150,150,150,0.5)";
    for (let i = 0; i < Math.round(3 * weathered); i++) g.fillRect(r.pick([inset * 0.5, w - inset * 0.5]) - 2, inset * 0.5, 4, r.range(h * 0.1, h * 0.3));
  });
  a.attach(printPlane(tex, W - 0.03, H - 0.03, [0, bottom + H / 2, 0.0075], "front", { hatchSpace: "world", hatch: 0.04, objectId: OBJECT_ID.print, shade: 0.5 }));
  const obj = a.build();
  return { object: obj, footprint: { width: W, depth: 0.2, height: bottom + H + 0.12 }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ stencilled warning board

function stencilBoard(t: string, rng: Rng, o: SignOptions): Built {
  const a = new Assembly(tracksideMaterial(0.045), "sign:stencil");
  const cap = 0.17;
  const { lines, w: W0, h: H0 } = layout(t, cap, 11, 2, 0.14, 0.12, 0.72);
  const W = W0;
  const H = H0 + (o.sub ? cap * 0.9 : 0);
  const bottom = 0.8;
  // Plywood board on two rough stakes, with a batten behind.
  for (const s of [-1, 1]) a.add(slab(0.08, bottom + H + 0.05, 0.06), { tone: "pale", position: [s * (W / 2 - 0.15), -0.3, -0.05] });
  a.add(slab(W, H, 0.018), { tone: "paper", position: [0, bottom, 0] });
  a.add(slab(W * 0.96, 0.06, 0.03), { tone: "pale", position: [0, bottom + H * 0.5, -0.025] });
  const tex = inkTexture(`stencil:${t}:${o.sub ?? ""}:${o.red ? 1 : 0}`, Math.min(2048, Math.round(W * PX_PER_M)), Math.round(H * PX_PER_M), (g, w, h) => {
    const r = rng.fork("spray");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    // Plywood grain, very faint.
    g.strokeStyle = "rgba(0,0,0,0.12)";
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      const y = r.range(0, h);
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + r.range(-8, 8), w * 0.6, y + r.range(-8, 8), w, y + r.range(-6, 6));
      g.stroke();
    }
    const capPx = cap * PX_PER_M;
    const lineH = capPx * 1.5;
    const blockH = lines.length * lineH + (o.sub ? capPx * 0.9 : 0);
    const y0 = h / 2 - blockH / 2 + lineH / 2;
    const ink = o.red ? RED : "#000";
    lines.forEach((ln, i) => stencil(g, ln, w / 2, y0 + i * lineH, capPx, { color: ink, maxW: w * 0.9, family: HEAVY }));
    if (o.sub) stencil(g, o.sub.toUpperCase(), w / 2, y0 + lines.length * lineH - lineH * 0.15, capPx * 0.5, { maxW: w * 0.84 });
    // Overspray speckle round the letters.
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 260; i++) g.fillRect(r.range(w * 0.05, w * 0.95), r.range(h * 0.15, h * 0.85), 1.5, 1.5);
  });
  a.attach(printPlane(tex, W - 0.01, H - 0.01, [0, bottom + H / 2, 0.0095], "front", { hatchSpace: "world", hatch: 0.045, shade: 0.55 }));
  return { object: a.build(), footprint: { width: W, depth: 0.12, height: bottom + H }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ protest placard

function placard(t: string, rng: Rng, o: SignOptions): Built {
  const a = new Assembly(tracksideMaterial(0.03), "sign:placard");
  const W = 0.62,
    H = 0.46;
  const bottom = 0.95;
  // Wooden stick pushed into the ground, slightly off plumb; corrugated card.
  a.add(cblock(0.035, bottom + H * 0.8 + 0.25, 0.022, 0.004), { tone: "pale", position: [0, -0.25, -0.02] });
  const card = sheet(W, H, 0.006, 8, 6, (x) => 0.018 * Math.sin((x / W + 0.5) * Math.PI));
  card.rotateX(Math.PI / 2);
  card.translate(0, bottom + H / 2, 0);
  a.add(card, { tone: "pale" });
  // Tape holding card to stick.
  for (const y of [bottom + 0.08, bottom + H - 0.08]) a.add(slab(0.06, 0.04, 0.004), { tone: "light", position: [0, y - 0.02, -0.012] });
  const tex = inkTexture(`placard:${t}:${o.red ? 1 : 0}:${o.sub ?? ""}`, 620, 460, (g, w, h) => {
    const r = rng.fork("hand");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    // Corrugation shadows at the cut edges.
    g.fillStyle = "rgba(0,0,0,0.18)";
    for (let x = 0; x < w; x += 9) g.fillRect(x, 0, 3, 6);
    const lines = wrap(t, 11, 3);
    const lh = h / (lines.length + 1.2);
    lines.forEach((ln, i) => marker(g, ln, w / 2, lh * (i + 0.9), Math.min(lh * 0.62, h * 0.26), r, { maxW: w * 0.88, color: o.red && i === lines.length - 1 ? RED : "#000" }));
    // Underline flourish.
    g.strokeStyle = o.red ? RED : "#000";
    g.lineWidth = h * 0.025;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(w * 0.2, h * 0.9);
    g.quadraticCurveTo(w * 0.5, h * 0.94, w * 0.82, h * 0.88);
    g.stroke();
  });
  const pl = printPlane(tex, W - 0.02, H - 0.02, [0, 0, 0], "front", { segX: 8, warp: (x) => 0.018 * Math.sin(((x + W / 2) / W) * Math.PI) + 0.0075, hatchSpace: "world", hatch: 0.03 });
  if (pl) {
    pl.geometry.translate(0, bottom + H / 2, 0);
    a.attach(pl);
  }
  const obj = a.build();
  obj.rotation.z = rng.range(-0.06, 0.06);
  obj.rotation.y = rng.range(-0.1, 0.1);
  const g = new THREE.Group();
  g.add(obj);
  return { object: g, footprint: { width: W, depth: 0.1, height: bottom + H }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ hi-vis warning plate

function warningPlate(t: string, rng: Rng, o: SignOptions): Built {
  const a = new Assembly(tracksideMaterial(0.035), "sign:warning");
  const W = 0.72,
    H = 0.92,
    bottom = 1.05;
  a.add(rodY(0.035, -0.3, bottom + H + 0.05, 10), { tone: "light" });
  a.add(cylinder(0.037, 0.037, 0.02, 10), { tone: "mid", position: [0, bottom + H + 0.06, 0] });
  for (const y of [bottom + 0.15, bottom + H - 0.15]) a.add(cbox(0.1, 0.05, 0.06, 0.01), { tone: "mid", position: [0, y, 0.035] });
  a.add(cbox(W, H, 0.01, 0.004), { tone: "light", position: [0, bottom + H / 2, 0.068] });
  const lines = wrap(t, 9, 3);
  const tex = inkTexture(`warning:${t}:${o.sub ?? ""}`, 504, 644, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.lineWidth = w * 0.035;
    g.strokeStyle = "#000";
    g.strokeRect(w * 0.035, w * 0.035, w - w * 0.07, h - w * 0.07);
    // Triangle with an exclamation mark.
    const cx = w / 2,
      ty = h * 0.08,
      side = w * 0.62;
    g.beginPath();
    g.moveTo(cx, ty);
    g.lineTo(cx + side / 2, ty + side * 0.866);
    g.lineTo(cx - side / 2, ty + side * 0.866);
    g.closePath();
    g.lineJoin = "round";
    g.lineWidth = w * 0.05;
    g.stroke();
    g.fillStyle = "#000";
    g.fillRect(cx - w * 0.028, ty + side * 0.28, w * 0.056, side * 0.36);
    g.beginPath();
    g.arc(cx, ty + side * 0.74, w * 0.035, 0, Math.PI * 2);
    g.fill();
    const top = ty + side * 0.866 + h * 0.07;
    const lh = (h * 0.9 - top) / Math.max(2, lines.length + (o.sub ? 0.6 : 0));
    lines.forEach((ln, i) => text(g, ln, w / 2, top + lh * (i + 0.5), Math.min(lh * 0.6, h * 0.11), { weight: "900", family: SANS, maxW: w * 0.86, squeeze: 0.86 }));
    if (o.sub) text(g, o.sub.toUpperCase(), w / 2, top + lh * (lines.length + 0.3), lh * 0.3, { maxW: w * 0.8 });
  });
  // The plate carries hi-vis amber under the ink: the one meaningful colour here.
  a.attach(printPlane(tex, W - 0.02, H - 0.02, [0, bottom + H / 2, 0.074], "front", { hatchSpace: "world", hatch: 0.035, shade: 0.5, accent: "amber", accentAmount: 0.95, objectId: OBJECT_ID.print }));
  return { object: a.build(), footprint: { width: W, depth: 0.12, height: bottom + H + 0.07 }, scalable: 0, placement: "ground" };
}

// ------------------------------------------------------------------ station nameboard

function station(t: string, rng: Rng, o: SignOptions): Built {
  const a = new Assembly(tracksideMaterial(0.05), "sign:station");
  const cap = 0.3;
  const W = Math.max(2.4, t.length * cap * 0.7 + 0.6);
  const H = o.sub ? 0.78 : 0.62;
  const bottom = 1.75;
  // Two cast posts with ball finials; a moulded frame round the board.
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.3);
    a.add(
      turned(
        [
          [0, 0],
          [0.11, 0],
          [0.11, 0.08],
          [0.08, 0.14],
          [0.06, 0.24],
          [0.052, bottom + H + 0.05],
          [0.065, bottom + H + 0.08],
          [0.03, bottom + H + 0.1],
        ],
        14,
      ),
      { tone: "deep", position: [x, 0, -0.08] },
    );
    a.add(cylinder(0.05, 0.05, 0.02, 10), { tone: "deep", position: [x, bottom + H + 0.11, -0.08] });
    const ball = new THREE.SphereGeometry(0.055, 12, 8);
    a.add(ball, { tone: "deep", position: [x, bottom + H + 0.17, -0.08] });
  }
  a.add(cbox(W, H, 0.04, 0.006), { tone: "light", position: [0, bottom + H / 2, 0] });
  const fr = plate(roundRect(W + 0.06, H + 0.06, 0.02, 2), 0.05, 0.006, [roundRect(W - 0.04, H - 0.04, 0.01, 2)]);
  a.add(fr, { tone: "deep", position: [0, bottom + H / 2, 0.01] });
  const sub = o.sub?.toUpperCase();
  const tex = inkTexture(`station:${t}:${sub ?? ""}`, Math.min(2048, Math.round(W * 300)), Math.round(H * 300), (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    frame(g, h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, h * 0.02);
    const capPx = cap * 300;
    text(g, t, w / 2, sub ? h * 0.4 : h / 2, capPx, { family: SERIF, weight: "bold", maxW: w * 0.9, track: capPx * 0.12 });
    if (sub) text(g, sub, w / 2, h * 0.78, capPx * 0.36, { family: SANS, weight: "bold", maxW: w * 0.8, track: 6 });
  });
  a.attach(printPlane(tex, W - 0.04, H - 0.04, [0, bottom + H / 2, 0.0215], "front", { hatchSpace: "world", hatch: 0.05, shade: 0.5 }));
  return { object: a.build(), footprint: { width: W + 0.1, depth: 0.25, height: bottom + H + 0.22 }, scalable: 0, placement: "ground" };
}

export function buildSignPart(textIn: string, o: SignOptions): Built {
  const t = lettering(textIn).slice(0, o.style === "station" ? 24 : 28);
  const rng = createRng(`sign:${o.style}:${t}:${o.seed ?? 0}`);
  switch (o.style) {
    case "enamel":
      return enamel(t, rng, o);
    case "stencil":
      return stencilBoard(t, rng, o);
    case "placard":
      return placard(textIn.trim().slice(0, 40), rng, o);
    case "warning":
      return warningPlate(t, rng, o);
    case "station":
      return station(t, rng, o);
    default: {
      const never: never = o.style;
      throw new Error(`Unknown sign style ${String(never)}`);
    }
  }
}

