/**
 * The Vela terminal: a retrofit box bolted to the desk in front of the old
 * instruments. A small screen (inked canvas), the Morrow mark in cobalt
 * (geometry, because canvas maps only carry red pigments), and a thermal
 * receipt printer whose paper extrudes from a slot and curls toward the
 * driver.
 *
 * The Morrow mark: an open ring broken at one o'clock, with a solid dot
 * inside, set toward the gap. A horizon that has not closed, or an eye that
 * does not blink. While Morrow thinks, the dot travels the inside of the ring.
 */
import * as THREE from "three";
import { Kit, cylinder } from "../core/geometry.ts";
import { createInkCanvas } from "../core/ink-material.ts";
import type { LabelAtlas } from "./labels.ts";
import { deskMatrix } from "./layout.ts";
import { IDS, MONO, SANS, atlasPlane, cabMaterial, cabMesh, mapMaterial, mat4, roundedBox, roundedRectPts, slab, v3 } from "./util.ts";

export type ScreenMode = "dispatch" | "morrow" | "jam" | "off";
export interface ScreenState {
  mode: ScreenMode;
  lines: string[];
  thinking?: boolean;
  alert?: boolean;
}

export interface TerminalParts {
  group: THREE.Group;
  screen: { setState(s: ScreenState): void; flashMark(): void };
  printReceipt(text: string): void;
  tick(dt: number, t: number): void;
  /** Screen centre, cab-local (for anchors). */
  screenCenter: THREE.Vector3;
  textures: THREE.Texture[];
}

// Terminal placement: on the desk right of centre, turned toward the driver.
const T_X = 0.172;
const T_Z = -0.82;
const T_YAW = -0.2;
const FACE_TILT = 0.2; // front face leans back (radians)
const SCREEN_W = 0.172;
const TW = 0.228; // housing width
const SCREEN_H = 0.129;
const CANVAS_W = 640;
const CANVAS_H = 480;

/** Draw the Morrow mark into a 2D canvas (used by the brand sheet and the screen header). */
export function drawMorrowMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color = "#111", dotAngle = -0.35): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = "butt";
  ctx.beginPath();
  // Gap centred at one o'clock (canvas angle -60°), 50° wide.
  const gapC = -Math.PI / 3;
  ctx.arc(cx, cy, r, gapC + 0.44, gapC - 0.44 + Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + Math.cos(gapC + dotAngle + 0.35) * r * 0.38, cy + Math.sin(gapC + dotAngle + 0.35) * r * 0.38, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

export function buildTerminal(atlas: LabelAtlas, labels: THREE.BufferGeometry[], seed: string): TerminalParts {
  void seed;
  const group = new THREE.Group();
  group.name = "cab-terminal";
  const base = deskMatrix(T_X, T_Z, T_YAW, 0);
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  root.matrix.copy(base);
  group.add(root);

  // ------------------------------------------------------------- housing
  const k = new Kit();
  const depth = 0.13;
  const height = 0.198;
  const lean = Math.tan(FACE_TILT) * height;
  const sect: Array<[number, number]> = [
    [depth / 2, 0],
    [depth / 2 - lean, height],
    [-depth / 2, height - 0.012],
    [-depth / 2, 0],
  ];
  {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(sect.map(([z, y]) => new THREE.Vector2(-z, y))), {
      depth: TW,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelOffset: -0.008,
      bevelSegments: 2,
    });
    g.rotateY(Math.PI / 2);
    g.translate(-TW / 2, 0, 0);
    k.add(g, { tone: "pale" });
  }
  // Face frame: a matrix on the leaning front face (origin at face bottom-centre).
  const face = mat4([0, 0, depth / 2], [-FACE_TILT, 0, 0]);
  const at = (x: number, y: number, z = 0) => face.clone().multiply(mat4([x, y, z]));
  // Screen bezel: dark, heavy, rounded.
  const scrY = 0.122;
  const bezO = roundedRectPts(SCREEN_W + 0.036, SCREEN_H + 0.034, 0.018, 6);
  const bezI = roundedRectPts(SCREEN_W + 0.002, SCREEN_H + 0.002, 0.012, 6);
  k.add(slab(bezO, 0.012, { holes: [bezI], bevel: 0.003 }), { tone: "solid", matrix: at(0, scrY, -0.002) });
  // Recess walls behind the bezel.
  k.add(slab(roundedRectPts(SCREEN_W + 0.004, SCREEN_H + 0.004, 0.012, 6), 0.004, { holes: [roundedRectPts(SCREEN_W - 0.004, SCREEN_H - 0.004, 0.01, 6)] }), {
    tone: "deep",
    matrix: at(0, scrY, -0.001),
  });
  // Printer strip: slot, tear bar, feed button.
  k.add(roundedBox(TW - 0.03, 0.034, 0.01, 0.004), { tone: "light", matrix: at(0, 0.03, 0.004) });
  k.add(roundedBox(0.1, 0.0055, 0.012, 0.002), { tone: "solid", matrix: at(-0.02, 0.03, 0.006) });
  for (let i = 0; i < 18; i++) k.add(roundedBox(0.003, 0.003, 0.004, 0.0008), { tone: "paper", matrix: at(-0.066 + i * 0.0054, 0.0376, 0.011) });
  k.add(cylinder(0.0075, 0.0075, 0.006, 16), { tone: "mid", matrix: at(0.068, 0.03, 0.01).multiply(mat4([0, 0, 0], [Math.PI / 2, 0, 0])) });
  labels.push(atlasPlane(0.034, 0.0085, atlas.rect("printer"), at(0.068, 0.013, 0.0095)));
  // Brand strip under the screen.
  labels.push(atlasPlane(0.1, 0.0172, atlas.rect("terminal"), at(-0.03, scrY - SCREEN_H / 2 - 0.0085, 0.0101)));
  // Bolted feet and a retaining strap to the desk.
  for (const x of [-TW / 2 + 0.015, TW / 2 - 0.015]) {
    k.add(roundedBox(0.03, 0.01, 0.16, 0.003), { tone: "mid", position: [x, 0.005, 0] });
    for (const z of [-0.06, 0.06]) k.add(cylinder(0.006, 0.0065, 0.006, 6), { tone: "light", position: [x, 0.012, z] });
  }
  // Rear cable exit.
  k.add(cylinder(0.012, 0.012, 0.03, 12), { tone: "dark", position: [0.07, 0.16, -depth / 2 - 0.012], rotation: [Math.PI / 2, 0, 0] });
  const housing = cabMesh(k.build(), cabMaterial(IDS.terminal), "cab-terminal-housing");
  root.add(housing);

  // Cable loom from the terminal to the A-pillar run (cab-local).
  {
    const start = v3(0.07, 0.16, -depth / 2 - 0.03).applyMatrix4(base);
    const curve = new THREE.CatmullRomCurve3([start, v3(0.52, 1.03, -0.99), v3(0.7, 1.07, -1.05), v3(0.76, 1.1, -1.06)]);
    const lk = new Kit();
    lk.add(new THREE.TubeGeometry(curve, 30, 0.0065, 7, false), { tone: "dark" });
    group.add(cabMesh(lk.build(), cabMaterial(IDS.terminal), "cab-terminal-loom"));
  }

  // ------------------------------------------------------------- screen
  const { canvas, ctx, texture } = createInkCanvas(CANVAS_W, CANVAS_H);
  void canvas;
  texture.anisotropy = 8;
  const sg = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 12, 9);
  {
    // Slight CRT bulge.
    const p = sg.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (SCREEN_W / 2),
        y = p.getY(i) / (SCREEN_H / 2);
      p.setZ(i, 0.0035 * (1 - 0.5 * x * x - 0.5 * y * y));
    }
    sg.computeVertexNormals();
  }
  const screenMesh = cabMesh(sg, mapMaterial(texture, IDS.screen), "cab-screen");
  screenMesh.matrixAutoUpdate = false;
  screenMesh.matrix.copy(at(0, scrY, 0.0));
  root.add(screenMesh);
  const screenCenter = v3(0, scrY, 0.003).applyMatrix4(face).applyMatrix4(base);

  // Morrow mark: cobalt geometry floating a hair above the glass.
  const markGroup = new THREE.Group();
  markGroup.matrixAutoUpdate = false;
  const markR = 0.0118;
  const markX = -SCREEN_W / 2 + 0.019;
  const markY = SCREEN_H / 2 - 0.018;
  markGroup.matrix.copy(at(0, scrY, 0.0046)).multiply(mat4([markX, markY, 0]));
  root.add(markGroup);
  const cobalt = cabMaterial(IDS.mark, { vertexInk: false, tone: "paper", accent: "cobalt", accentAmount: 1, flat: true, edge: 0.4 });
  const signal = cabMaterial(IDS.mark, { vertexInk: false, tone: "paper", accent: "signal", accentAmount: 1, flat: true, edge: 0.4 });
  const gapC = Math.PI / 3; // one o'clock in GL (counter-clockwise from +X)
  const ring = cabMesh(new THREE.RingGeometry(markR * 0.82, markR * 1.18, 40, 1, gapC + 0.44, Math.PI * 2 - 0.88), cobalt, "cab-morrow-ring");
  const dotPivot = new THREE.Group();
  const dot = cabMesh(new THREE.CircleGeometry(markR * 0.28, 24), cobalt, "cab-morrow-dot");
  dot.position.set(markR * 0.4, 0, 0);
  dotPivot.rotation.z = gapC;
  dotPivot.add(dot);
  markGroup.add(ring, dotPivot);
  markGroup.visible = false;

  let state: ScreenState = { mode: "off", lines: [] };
  let cursorOn = true;
  let flash = 0;

  const redraw = () => {
    const c = ctx;
    const Wc = CANVAS_W,
      Hc = CANVAS_H;
    c.save();
    c.clearRect(0, 0, Wc, Hc);
    if (state.mode === "off") {
      c.fillStyle = "#111";
      c.fillRect(0, 0, Wc, Hc);
      // Dead glass: two reflection strokes.
      c.strokeStyle = "#fff";
      c.lineCap = "round";
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(Wc * 0.62, Hc * 0.12);
      c.lineTo(Wc * 0.4, Hc * 0.55);
      c.stroke();
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(Wc * 0.72, Hc * 0.14);
      c.lineTo(Wc * 0.54, Hc * 0.5);
      c.stroke();
      c.restore();
      texture.needsUpdate = true;
      return;
    }
    c.fillStyle = "#fff";
    c.fillRect(0, 0, Wc, Hc);
    const pad = 30;
    // Header bar.
    const jam = state.mode === "jam";
    if (state.mode === "dispatch") {
      c.fillStyle = "#111";
      c.fillRect(0, 0, Wc, 74);
      c.fillStyle = "#fff";
      c.font = `800 38px ${SANS}`;
      c.textBaseline = "middle";
      c.fillText("DISPATCH", pad, 39);
      c.font = `700 30px ${MONO}`;
      c.textAlign = "right";
      c.fillText("UNIT 4", Wc - pad, 39);
      c.textAlign = "left";
    } else if (state.mode === "morrow") {
      // Space for the cobalt mark at top-left; wordmark beside it.
      c.fillStyle = "#111";
      c.font = `800 40px ${SANS}`;
      c.textBaseline = "middle";
      (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "6px";
      c.fillText("MORROW", 140, 68);
      (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
      c.fillRect(pad, 128, Wc - pad * 2, 4);
      if (state.alert) {
        c.fillStyle = "#e00";
        c.fillRect(0, 0, 16, Hc);
        c.font = `800 30px ${SANS}`;
        c.textAlign = "right";
        c.fillText("ALERT", Wc - pad, 68);
        c.textAlign = "left";
      }
    } else if (jam) {
      c.fillStyle = "#e00";
      c.fillRect(0, 0, Wc, 132);
      c.fillStyle = "#fff";
      c.font = `900 66px ${SANS}`;
      c.textBaseline = "middle";
      c.textAlign = "center";
      c.fillText("ROUTE LOCKED", Wc / 2, 70);
      c.textAlign = "left";
      // Hatched red border.
      c.strokeStyle = "#e00";
      c.lineWidth = 14;
      c.strokeRect(7, 7, Wc - 14, Hc - 14);
      // Padlock glyph.
      c.fillStyle = "#e00";
      c.fillRect(Wc - 110, Hc - 118, 64, 52);
      c.lineWidth = 10;
      c.beginPath();
      c.arc(Wc - 78, Hc - 118, 22, Math.PI, 0);
      c.stroke();
    }
    // Body lines.
    c.fillStyle = "#111";
    c.textBaseline = "alphabetic";
    const fontPx = jam ? 32 : 36;
    c.font = `700 ${fontPx}px ${MONO}`;
    const top = state.mode === "dispatch" ? 128 : jam ? 186 : 180;
    const maxW = Wc - pad * 2 - (jam ? 120 : 0);
    const lines: string[] = [];
    for (const l of state.lines) lines.push(...wrap(c, l, maxW));
    const maxLines = jam ? 7 : 8;
    const shown = lines.slice(0, maxLines);
    shown.forEach((l, i) => c.fillText(l, pad, top + i * (fontPx + 10)));
    if (state.thinking && state.mode === "morrow" && cursorOn) {
      const last = shown[shown.length - 1] ?? "";
      const lx = pad + c.measureText(last).width + 10;
      const ly = top + Math.max(0, shown.length - 1) * (fontPx + 10);
      c.fillRect(shown.length ? lx : pad, ly - fontPx + 6, 20, fontPx - 2);
    }
    // Scan-line texture near the edges (reads as glass, not paper).
    c.fillStyle = "#111";
    for (let y = 0; y < Hc; y += 6) {
      c.fillRect(0, y, 5, 2);
      c.fillRect(Wc - 5, y, 5, 2);
    }
    c.restore();
    texture.needsUpdate = true;
  };

  // ------------------------------------------------------------ printer
  const PAPER_W = 0.072;
  const PAPER_MAX = 0.3;
  const SEG = 48;
  const receipt = createInkCanvas(256, 1024);
  receipt.texture.anisotropy = 8;
  const paperGeo = new THREE.PlaneGeometry(PAPER_W, 1, 1, SEG);
  const paperRows: number[] = [];
  const paperSide: number[] = [];
  {
    const uv0 = paperGeo.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv0.count; i++) {
      paperRows.push(Math.round((1 - uv0.getY(i)) * SEG));
      paperSide.push(uv0.getX(i) - 0.5);
    }
  }
  const paperMat = mapMaterial(receipt.texture, IDS.paper, { flat: false, side: THREE.DoubleSide, shade: 0.7 });
  const paper = cabMesh(paperGeo, paperMat, "cab-receipt");
  paper.visible = false;
  root.add(paper);
  let printed = 0; // current extruded length
  let printTarget = 0;
  let printLen = 0.2;
  let printing = false;
  const printLamp = cabMesh(new THREE.SphereGeometry(0.0038, 10, 8), cabMaterial(IDS.lamps, { vertexInk: false, tone: "pale", flat: true }), "cab-printer-led");
  const printLampOn = cabMaterial(IDS.lamps, { vertexInk: false, tone: "paper", accent: "amber", accentAmount: 1, flat: true });
  const printLampOff = printLamp.material as THREE.Material;
  printLamp.matrixAutoUpdate = false;
  printLamp.matrix.copy(at(0.09, 0.03, 0.01));
  root.add(printLamp);

  const drawReceipt = (textValue: string) => {
    const c = receipt.ctx;
    const Wc = 256,
      Hc = 1024;
    c.save();
    c.fillStyle = "#fff";
    c.fillRect(0, 0, Wc, Hc);
    c.fillStyle = "#111";
    c.textBaseline = "top";
    c.font = `800 26px ${SANS}`;
    c.textAlign = "center";
    c.fillText("VELA · MORROW", Wc / 2, 16);
    c.font = `600 18px ${MONO}`;
    c.fillText("AUTHORITY RECEIPT", Wc / 2, 50);
    c.fillRect(16, 80, Wc - 32, 3);
    c.textAlign = "left";
    c.font = `700 22px ${MONO}`;
    const lines: string[] = [];
    for (const para of textValue.split("\n")) lines.push(...wrap(c, para.toUpperCase(), Wc - 32));
    let y = 96;
    for (const l of lines.slice(0, 22)) {
      c.fillText(l, 16, y);
      y += 30;
    }
    y += 10;
    // Dotted rule, barcode.
    for (let x = 16; x < Wc - 16; x += 10) c.fillRect(x, y, 5, 3);
    y += 16;
    let bx = 24;
    let h = 7;
    while (bx < Wc - 24) {
      h = (h * 31 + 7) % 23;
      const w = 2 + (h % 4);
      c.fillRect(bx, y, w, 46);
      bx += w + 2 + (h % 3);
    }
    c.restore();
    receipt.texture.needsUpdate = true;
    return Math.min(PAPER_MAX, 0.06 + ((y + 70) / Hc) * 0.3);
  };

  // Slot point and exit direction in the terminal's desk frame.
  const slot = new THREE.Vector3().applyMatrix4(at(-0.02, 0.03, 0.012));
  const shapePaper = () => {
    // Centreline in the desk frame: out of the slot, drooping onto the desk,
    // lying flat toward the driver, the head curling up off the desk the way
    // thermal paper remembers its roll.
    const pos = paperGeo.getAttribute("position") as THREE.BufferAttribute;
    const uv = paperGeo.getAttribute("uv") as THREE.BufferAttribute;
    const L = Math.max(0.002, printed);
    const pts: Array<[number, number]> = [];
    let y = slot.y,
      z = slot.z,
      th = FACE_TILT;
    let onDesk = false;
    const n = SEG;
    const ds = L / n;
    const floor = 0.009;
    for (let i = 0; i <= n; i++) {
      pts.push([y, z]);
      const s = i * ds;
      const fromHead = L - s;
      if (!onDesk) {
        th -= 30 * ds;
        if (y < floor + 0.004) onDesk = true;
      } else th += (0 - th) * Math.min(1, 80 * ds);
      if (fromHead < 0.06) th += 30 * ds * (1 - fromHead / 0.06);
      y = Math.max(floor, y + Math.sin(th) * ds);
      z += Math.cos(th) * ds;
    }
    const shift = printTarget - L; // content still inside the printer
    for (let i = 0; i < pos.count; i++) {
      const row = paperRows[i]!;
      const [py, pz] = pts[row]!;
      const side = paperSide[i]!;
      // Slight cupping across the width.
      const cup = 0.0035 * (side * side * 4) * Math.min(1, row / 8);
      pos.setXYZ(i, slot.x + side * PAPER_W, py + cup, pz);
      // Top of the receipt ends up by the slot, so it reads upright to the driver.
      uv.setY(i, 1 - (row * ds + shift) / 0.3);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    paperGeo.computeVertexNormals();
    paperGeo.computeBoundingSphere();
  };

  redraw();

  const parts: TerminalParts = {
    group,
    screenCenter,
    textures: [texture, receipt.texture],
    screen: {
      setState(s) {
        state = { mode: s.mode, lines: [...s.lines], thinking: s.thinking, alert: s.alert };
        markGroup.visible = s.mode === "morrow";
        redraw();
      },
      flashMark() {
        flash = 0.9;
      },
    },
    printReceipt(textValue) {
      printLen = drawReceipt(textValue);
      printed = 0;
      printTarget = printLen;
      printing = true;
      paper.visible = true;
      shapePaper();
    },
    tick(dt, t) {
      if (state.mode === "morrow") {
        if (state.thinking) {
          dotPivot.rotation.z -= dt * 3.2;
          const on = Math.floor(t * 2.4) % 2 === 0;
          if (on !== cursorOn) {
            cursorOn = on;
            redraw();
          }
        } else {
          // Settle the dot back toward the gap.
          const d = ((dotPivot.rotation.z - gapC) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          dotPivot.rotation.z -= d * Math.min(1, dt * 4);
        }
      }
      if (flash > 0) {
        flash -= dt;
        const on = flash > 0 && Math.floor(flash * 8) % 2 === 0;
        ring.material = on ? signal : cobalt;
        dot.material = on ? signal : cobalt;
      }
      if (printing) {
        printed = Math.min(printTarget, printed + dt * 0.07);
        shapePaper();
        printLamp.material = Math.floor(t * 6) % 2 === 0 ? printLampOn : printLampOff;
        if (printed >= printTarget) {
          printing = false;
          printLamp.material = printLampOff;
        }
      }
    },
  };
  return parts;
}
