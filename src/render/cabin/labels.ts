/**
 * One inked canvas holds every static piece of printed matter in the cab:
 * engraved plates, switch legends, the route card, the tucked photograph, the
 * reversed destination blind. Planes address it by region, and all of them
 * merge into a single mesh.
 */
import * as THREE from "three";
import { createInkCanvas } from "../core/ink-material.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { CONDENSED, MONO, SANS } from "./util.ts";

export interface AtlasRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const W = 2048;
const H = 1024;

type RegionName =
  | "blind"
  | "unitPlate"
  | "notice"
  | "quadrant"
  | "brake"
  | "switchesL"
  | "switchesR"
  | "lampsL"
  | "terminal"
  | "routeCard"
  | "photo"
  | "maker"
  | "radio"
  | "printer"
  | "handsetTag"
  | "note"
  | "sticker";

const REGIONS: Record<RegionName, [number, number, number, number]> = {
  blind: [0, 0, 1024, 144],
  unitPlate: [1024, 0, 320, 112],
  maker: [1344, 0, 352, 96],
  printer: [1696, 0, 256, 64],
  notice: [0, 144, 448, 224],
  quadrant: [448, 144, 576, 112],
  brake: [448, 256, 448, 112],
  switchesL: [1024, 112, 640, 72],
  switchesR: [1024, 184, 640, 72],
  lampsL: [1024, 256, 448, 72],
  terminal: [1472, 256, 512, 88],
  handsetTag: [1664, 112, 256, 72],
  note: [1312, 360, 256, 256],
  sticker: [1600, 360, 192, 192],
  routeCard: [0, 368, 480, 656],
  photo: [480, 368, 320, 240],
  radio: [800, 368, 512, 224],
};

export interface LabelAtlas {
  texture: THREE.CanvasTexture;
  rect(name: RegionName): AtlasRect;
  /** Redraw the reversed destination blind. */
  setDestination(text: string): void;
}

function rectFor(name: RegionName): AtlasRect {
  const [x, y, w, h] = REGIONS[name];
  return { u0: x / W, u1: (x + w) / W, v0: 1 - (y + h) / H, v1: 1 - y / H };
}

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: boolean, radius = 10): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 6, h - 6, radius);
  ctx.fillStyle = dark ? "#111" : "#fff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111";
  ctx.stroke();
  // Screw heads.
  const sc = dark ? "#fff" : "#111";
  for (const [sx, sy] of [
    [x + 16, y + h / 2],
    [x + w - 16, y + h / 2],
  ] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = sc;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 2);
    ctx.lineTo(sx + 4, sy + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color = "#111", align: CanvasTextAlign = "center", spacing = 0): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (spacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function drawBlind(ctx: CanvasRenderingContext2D, dest: string): void {
  const [x, y, w, h] = REGIONS.blind;
  ctx.save();
  ctx.clearRect(x, y, w, h);
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, w, h);
  // Seen from behind: the letters read mirrored through the linen.
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(-1, 1);
  text(ctx, dest.toUpperCase(), 0, 4, `700 92px ${CONDENSED}`, "#fff", "center", 6);
  ctx.restore();
  // Linen weave: faint vertical streaks.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRouteCard(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const [x, y, w, h] = REGIONS.routeCard;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
  text(ctx, "ROUTE CARD", x + w / 2, y + 44, `800 40px ${SANS}`, "#111", "center", 3);
  text(ctx, "UNIT 4  ·  DAY TURN  ·  CAB A", x + w / 2, y + 84, `600 22px ${MONO}`);
  ctx.fillRect(x + 24, y + 104, w - 48, 4);
  const stops = ["DEPOT", "MILL LANE", "RIVERSIDE", "CLINIC", "JUNCTION 7", "NORTHGATE", "TERMINUS"];
  const times = ["06:10", "06:18", "06:27", "06:35", "06:44", "06:58", "07:12"];
  const lx = x + 70;
  const top = y + 150;
  const step = 62;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(lx, top);
  ctx.lineTo(lx, top + step * (stops.length - 1));
  ctx.stroke();
  stops.forEach((s, i) => {
    const sy = top + i * step;
    ctx.beginPath();
    ctx.arc(lx, sy, 13, 0, Math.PI * 2);
    ctx.fillStyle = i === 4 ? "#111" : "#fff";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
    text(ctx, s, lx + 34, sy, `700 26px ${SANS}`, "#111", "left");
    text(ctx, times[i]!, x + w - 30, sy, `600 24px ${MONO}`, "#111", "right");
    // Hand ticks on the stops already served.
    if (i < 3) {
      ctx.save();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + w - 150, sy + 2);
      ctx.lineTo(x + w - 140, sy + 12);
      ctx.lineTo(x + w - 120, sy - 12);
      ctx.stroke();
      ctx.restore();
    }
  });
  // The junction, circled twice by a nervous pen.
  ctx.save();
  ctx.lineWidth = 3;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    ctx.ellipse(lx + 110, top + 4 * step, 118 + k * 6, 26 + k * 4, -0.04 + k * 0.05, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Handwritten notes: scribbled lines.
  const ny = top + step * stops.length + 6;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let l = 0; l < 3; l++) {
    let px = x + 30;
    const py = ny + l * 30;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const end = x + w - 40 - rng.range(0, 140);
    while (px < end) {
      const nx = px + rng.range(6, 14);
      ctx.quadraticCurveTo((px + nx) / 2, py - rng.range(4, 12), nx, py + rng.range(-2, 3));
      px = nx;
      if (rng.chance(0.12)) {
        px += 10;
        ctx.moveTo(px, py);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
  // Coffee ring.
  ctx.save();
  ctx.lineWidth = 3.5;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#444";
  ctx.beginPath();
  ctx.arc(x + w - 110, y + h - 90, 52, 0.3, Math.PI * 1.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w - 106, y + h - 94, 47, 1.9, Math.PI * 2.4);
  ctx.stroke();
  ctx.restore();
  // Signature line.
  ctx.fillStyle = "#111";
  ctx.fillRect(x + 30, y + h - 40, 220, 3);
  text(ctx, "CONTROLLER", x + 30, y + h - 24, `600 16px ${MONO}`, "#111", "left");
  ctx.restore();
}

function drawPhoto(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const [x, y, w, h] = REGIONS.photo;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);
  // Deckled white border, then the image.
  const ix = x + 18,
    iy = y + 18,
    iw = w - 36,
    ih = h - 50;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111";
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  // Sky hatching, horizon, a tree, two figures and a dog.
  ctx.lineWidth = 1.6;
  for (let i = -ih; i < iw; i += 7) {
    ctx.beginPath();
    ctx.moveTo(ix + i, iy + ih * 0.55);
    ctx.lineTo(ix + i + ih * 0.55, iy);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(ix, iy + ih * 0.55, iw, ih * 0.45);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ix, iy + ih * 0.58);
  ctx.bezierCurveTo(ix + iw * 0.3, iy + ih * 0.52, ix + iw * 0.6, iy + ih * 0.62, ix + iw, iy + ih * 0.56);
  ctx.stroke();
  // Tree.
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.ellipse(ix + iw * 0.78, iy + ih * 0.3, 40, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(ix + iw * 0.78 - 4, iy + ih * 0.3, 8, ih * 0.3);
  // Two figures (adult and child) and a dog, in silhouette.
  const fig = (fx: number, fy: number, s: number) => {
    ctx.beginPath();
    ctx.arc(fx, fy - 62 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx - 12 * s, fy - 50 * s);
    ctx.lineTo(fx + 12 * s, fy - 50 * s);
    ctx.lineTo(fx + 9 * s, fy - 18 * s);
    ctx.lineTo(fx + 6 * s, fy);
    ctx.lineTo(fx + 1 * s, fy);
    ctx.lineTo(fx, fy - 16 * s);
    ctx.lineTo(fx - 1 * s, fy);
    ctx.lineTo(fx - 6 * s, fy);
    ctx.lineTo(fx - 9 * s, fy - 18 * s);
    ctx.closePath();
    ctx.fill();
  };
  fig(ix + iw * 0.36, iy + ih * 0.9, 1);
  fig(ix + iw * 0.5, iy + ih * 0.92, 0.66);
  ctx.beginPath();
  ctx.ellipse(ix + iw * 0.6, iy + ih * 0.86, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + iw * 0.6 + 16, iy + ih * 0.82, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  for (const lx of [-10, -4, 8, 13]) {
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.6 + lx, iy + ih * 0.86);
    ctx.lineTo(ix + iw * 0.6 + lx, iy + ih * 0.95);
    ctx.stroke();
  }
  // Grass strokes.
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    const gx = ix + rng.range(0, iw);
    const gy = iy + ih * rng.range(0.66, 1);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + rng.range(-3, 3), gy - rng.range(5, 10));
    ctx.stroke();
  }
  ctx.restore();
  // Handwriting on the white border.
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  let px = x + 26;
  const py = y + h - 16;
  ctx.moveTo(px, py);
  while (px < x + 170) {
    const nx = px + rng.range(5, 10);
    ctx.quadraticCurveTo((px + nx) / 2, py - rng.range(3, 9), nx, py);
    px = nx;
  }
  ctx.stroke();
  ctx.restore();
}

function drawRadio(ctx: CanvasRenderingContext2D): void {
  const [x, y, w, h] = REGIONS.radio;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);
  // Channel drum window and legends.
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.fillStyle = "#111";
  ctx.fillRect(x + 300, y + 30, 150, 74);
  text(ctx, "04", x + 375, y + 70, `700 60px ${MONO}`, "#fff");
  text(ctx, "CHANNEL", x + 375, y + 124, `700 22px ${SANS}`, "#111", "center", 2);
  text(ctx, "VOL", x + 330, y + 196, `700 20px ${SANS}`);
  text(ctx, "SQ", x + 430, y + 196, `700 20px ${SANS}`);
  text(ctx, "TRAIN RADIO", x + 140, y + 200, `800 26px ${SANS}`, "#111", "center", 3);
  ctx.restore();
}

const HAND = "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', cursive";

/** A note from home, taped to the panel with a strip of tape across the top. */
function drawNote(ctx: CanvasRenderingContext2D): void {
  const [x, y, w, h] = REGIONS.note;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 6, y + 30, w - 12, h - 36);
  // Tape strip (hatched) over the top edge.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 60, y + 8, w - 120, 40);
  ctx.clip();
  ctx.lineWidth = 2;
  for (let i = -40; i < w; i += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 60 + i, y + 8);
    ctx.lineTo(x + 100 + i, y + 48);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 60, y + 8, w - 120, 40);
  ctx.fillStyle = "#111";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 40px ${HAND}`;
  ctx.fillText("don't be", x + 24, y + 108);
  ctx.fillText("late tonight", x + 24, y + 156);
  ctx.font = `700 46px ${HAND}`;
  ctx.fillText("x  — M.", x + 60, y + 216);
  ctx.restore();
}

/** Round inspection sticker for the inside of the glass. */
function drawSticker(ctx: CanvasRenderingContext2D): void {
  const [x, y, w, h] = REGIONS.sticker;
  const cx = x + w / 2,
    cy = y + h / 2;
  ctx.save();
  ctx.clearRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 22, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, "INSPECTED", cx, cy - 34, `800 22px ${SANS}`, "#111", "center", 1);
  text(ctx, "04", cx, cy + 6, `900 52px ${SANS}`);
  text(ctx, "LIGHT RAIL", cx, cy + 46, `700 18px ${SANS}`, "#111", "center", 1);
  // Punched month.
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(cx + 52, cy - 52, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createLabelAtlas(seed: string): LabelAtlas {
  const { canvas, ctx, texture } = createInkCanvas(W, H);
  void canvas;
  const rng = createRng(`${seed}:labels`);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  drawBlind(ctx, "Meridian via Mill Lane");

  {
    const [x, y, w, h] = REGIONS.unitPlate;
    plate(ctx, x, y, w, h, true, 14);
    text(ctx, "UNIT 4", x + w / 2, y + h / 2 + 2, `800 54px ${SANS}`, "#fff", "center", 4);
  }
  {
    const [x, y, w, h] = REGIONS.maker;
    plate(ctx, x, y, w, h, false, 6);
    text(ctx, "HALDEN WORKS", x + w / 2, y + 36, `800 30px ${SANS}`, "#111", "center", 3);
    text(ctx, "No. 4  ·  LEVER FRAME", x + w / 2, y + 68, `600 20px ${MONO}`);
  }
  {
    const [x, y, w, h] = REGIONS.printer;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);
    text(ctx, "RECEIPT", x + w / 2, y + h / 2, `800 30px ${SANS}`, "#111", "center", 4);
  }
  {
    const [x, y, w, h] = REGIONS.notice;
    plate(ctx, x, y, w, h, false, 8);
    text(ctx, "NOTICE", x + w / 2, y + 44, `800 40px ${SANS}`, "#111", "center", 6);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 40, y + 70, w - 80, 4);
    text(ctx, "THE CONTROLLER MUST NOT", x + w / 2, y + 108, `700 26px ${SANS}`);
    text(ctx, "LEAVE THE LEVER WHILE THE", x + w / 2, y + 142, `700 26px ${SANS}`);
    text(ctx, "CAR IS IN MOTION", x + w / 2, y + 176, `700 26px ${SANS}`);
  }
  {
    const [x, y, w, h] = REGIONS.quadrant;
    plate(ctx, x, y, w, h, true, 8);
    text(ctx, "◀ LEFT", x + 130, y + h / 2 + 2, `800 40px ${SANS}`, "#fff", "center", 3);
    text(ctx, "RIGHT ▶", x + w - 130, y + h / 2 + 2, `800 40px ${SANS}`, "#fff", "center", 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + w / 2 - 3, y + 22, 6, h - 44);
  }
  {
    const [x, y, w, h] = REGIONS.brake;
    plate(ctx, x, y, w, h, false, 8);
    const labels = ["REL", "RUN", "LAP", "SVC", "EMG"];
    labels.forEach((l, i) => text(ctx, l, x + 56 + i * ((w - 112) / 4), y + h / 2 + 2, `800 30px ${SANS}`, i === 4 ? "#e00" : "#111"));
  }
  {
    const [x, y, w, h] = REGIONS.switchesL;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);
    const labels = ["HEAD", "CAB LT", "SAND", "BELL"];
    labels.forEach((l, i) => text(ctx, l, x + (i + 0.5) * (w / labels.length), y + h / 2, `800 30px ${SANS}`, "#111", "center", 2));
  }
  {
    const [x, y, w, h] = REGIONS.switchesR;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);
    const labels = ["WIPER", "WASH", "DOORS", "HORN"];
    labels.forEach((l, i) => text(ctx, l, x + (i + 0.5) * (w / labels.length), y + h / 2, `800 30px ${SANS}`, "#111", "center", 2));
  }
  {
    const [x, y, w, h] = REGIONS.lampsL;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, w, h);
    const labels = ["BRAKE", "LINE", "LINK"];
    labels.forEach((l, i) => text(ctx, l, x + (i + 0.5) * (w / labels.length), y + h / 2, `800 28px ${SANS}`, "#111", "center", 2));
  }
  {
    const [x, y, w, h] = REGIONS.terminal;
    ctx.fillStyle = "#111";
    ctx.fillRect(x, y, w, h);
    text(ctx, "vela", x + 70, y + h / 2 - 2, `700 50px ${SANS}`, "#fff", "left");
    ctx.fillStyle = "#e00";
    ctx.beginPath();
    ctx.arc(x + 186, y + h / 2 + 10, 9, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, "MORROW ASSIST", x + w - 30, y + h / 2, `700 26px ${SANS}`, "#fff", "right", 3);
  }
  {
    const [x, y, w, h] = REGIONS.handsetTag;
    ctx.fillStyle = "#111";
    ctx.fillRect(x, y, w, h);
    text(ctx, "PRESS TO TALK", x + w / 2, y + h / 2, `800 24px ${SANS}`, "#fff", "center", 2);
  }
  drawRouteCard(ctx, rng);
  drawPhoto(ctx, rng);
  drawRadio(ctx);
  drawNote(ctx);
  drawSticker(ctx);
  texture.needsUpdate = true;

  return {
    texture,
    rect: rectFor,
    setDestination(textValue: string) {
      drawBlind(ctx, textValue);
      texture.needsUpdate = true;
    },
  };
}
