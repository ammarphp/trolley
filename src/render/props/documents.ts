/**
 * Documents: contracts, licences, reports, treaties, rulings, ledgers...
 *
 * Each carries a readable printed title and a rubber stamp (the `label`
 * option, e.g. APPROVED, EXTENDED, REVOKE, FOREVER) drawn with
 * createInkCanvas. Paper lying flat all but vanishes at the distances the cab
 * sees the line, so half of these present an upright face to the trolley:
 * a framed certificate on its easel back, a permit on a stake, lever-arch
 * binders spine-out, a treaty folio stood open, an org chart on an easel, an
 * order in a plate stand, an archive box end-on, a ledger leaning on its
 * fellows. The rest (contract, licence, appeal, ruling, map) lie flat but
 * carry a strong silhouette: a pen, flags, a clipboard, red tape, a gavel,
 * an accordion fold.
 *
 * Built at desk scale (1x); staging enlarges documents about 2.2x.
 */
import * as THREE from "three";
import type { DocumentId } from "../api.ts";
import { Kit, cylinder } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";
import type { Rng } from "../core/rng.ts";
import { Assembly, HATCH, OBJECT_ID, band, beam, blob, cblock, cbox, plate, propMaterial, ring, rod, rodY, roundRect, sheet, slab, turned, wire } from "./common.ts";
import {
  OXBLOOD,
  RED,
  SANS,
  SERIF,
  barcode,
  frame,
  greek,
  guilloche,
  inkTexture,
  marker,
  printPlane,
  seal,
  signature,
  stamp,
  text,
  velaMark,
  wrap,
  paperTooth,
} from "./print.ts";
import type { BuildCtx, Built } from "./types.ts";

const docMat = () => propMaterial(HATCH.tiny, OBJECT_ID.document);
const PAGE_W = 512;
const PAGE_H = 724;

export interface DocSpec {
  title: string;
  label?: string;
}

const TITLES: Record<DocumentId, string> = {
  contract: "SERVICE AGREEMENT",
  license: "LICENCE TO OPERATE",
  report: "EVALUATION REPORT",
  certificate: "CERTIFICATE OF SAFETY",
  permit: "PERMIT TO WORK",
  treaty: "TREATY",
  "org-chart": "ORGANISATION",
  appeal: "NOTICE OF APPEAL",
  "archive-box": "RECORDS",
  ruling: "JUDGMENT",
  ledger: "LEDGER",
  order: "ORDER",
  map: "LINE MAP",
};

export function defaultTitle(id: DocumentId): string {
  return TITLES[id];
}

function keyOf(...parts: Array<string | number | undefined>): string {
  return parts.map((p) => p ?? "").join("|");
}

/** A stack of loose sheets, slightly out of true, so its edge reads as many pages. */
function pageStack(a: Assembly, w: number, d: number, thick: number, layers: number, rng: Rng, y0 = 0): number {
  const t = thick / layers;
  for (let i = 0; i < layers; i++) {
    const g = sheet(w, d, t * 0.92);
    g.rotateY(rng.range(-0.014, 0.014));
    a.add(g, { tone: i % 2 ? "paper" : "pale", position: [rng.range(-0.0025, 0.0025), y0 + i * t, rng.range(-0.0025, 0.0025)] });
  }
  return y0 + thick;
}

/** The standard letterhead page used by several documents. */
function drawLetter(g: CanvasRenderingContext2D, w: number, h: number, rng: Rng, o: { title: string; sub?: string; label?: string; vela?: boolean; signatures?: number; seal?: boolean; number?: string; stampAt?: [number, number]; stampAngle?: number }): void {
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  paperTooth(g, w, h, rng, 0.6);
  const m = w * 0.09;
  if (o.vela) velaMark(g, m, h * 0.04, w * 0.07);
  if (o.number) text(g, o.number, w - m, h * 0.065, h * 0.013, { align: "right", weight: "normal" });
  const lines = wrap(o.title, 16, 2);
  lines.forEach((ln, i) => text(g, ln, w / 2, h * (0.15 + i * 0.058), h * 0.036, { maxW: w - m * 2, weight: "bold", family: SANS, squeeze: 0.92 }));
  const yb = h * (0.15 + lines.length * 0.058);
  if (o.sub) text(g, o.sub, w / 2, yb, h * 0.016, { maxW: w - m * 2, weight: "normal" });
  g.fillStyle = "#000";
  g.fillRect(m, yb + h * 0.025, w - m * 2, 3);
  greek(g, m, yb + h * 0.07, w - m * 2, h * 0.021, 8, rng);
  greek(g, m, yb + h * 0.27, w - m * 2, h * 0.021, 9, rng, { indent: w * 0.05 });
  const sigs = o.signatures ?? 2;
  for (let i = 0; i < sigs; i++) {
    const x = m + (i * (w - m * 2)) / sigs;
    const sw = (w - m * 2) / sigs - w * 0.05;
    signature(g, x + w * 0.02, h * 0.85, sw * 0.8, h * 0.03, rng);
    g.fillStyle = "#000";
    g.fillRect(x, h * 0.885, sw, 2);
    greek(g, x, h * 0.905, sw * 0.7, h * 0.014, 1, rng, { ragged: false, weight: 0.5 });
  }
  if (o.seal) seal(g, w - m - w * 0.07, h * 0.8, w * 0.07);
  if (o.label) {
    const [sx, sy] = o.stampAt ?? [0.56, 0.52];
    stamp(g, o.label, w * sx, h * sy, w * 0.62, o.stampAngle ?? -0.2, rng);
  }
}

function pageTexture(id: string, spec: DocSpec, rng: Rng, variant: number, extra: Parameters<typeof drawLetter>[4] extends infer T ? Partial<T> : never = {}): THREE.CanvasTexture | null {
  return inkTexture(keyOf("page", id, spec.title, spec.label, variant, JSON.stringify(extra)), PAGE_W, PAGE_H, (g, w, h) => drawLetter(g, w, h, rng, { title: spec.title, ...(spec.label ? { label: spec.label } : {}), ...extra }));
}

function pen(a: Assembly, x: number, y: number, z: number, ang: number): void {
  const L = 0.14;
  const dx = Math.cos(ang) * L,
    dz = Math.sin(ang) * L;
  const r = 0.0065;
  a.add(rod([x - dx / 2, y + r, z - dz / 2], [x + dx * 0.25, y + r, z + dz * 0.25], r, 10), { tone: "deep" });
  a.add(rod([x + dx * 0.25, y + r, z + dz * 0.25], [x + dx / 2, y + r, z + dz / 2], r * 1.08, 10, r * 0.7), { tone: "deep" });
  a.add(rod([x + dx / 2, y + r, z + dz / 2], [x + dx * 0.56, y + r * 0.8, z + dz * 0.56], r * 0.5, 6, 0.0008), { tone: "light" });
  a.add(ring(r * 1.1, 0.0014, 3, 12), { tone: "light", position: [x + dx * 0.25, y + r, z + dz * 0.25], rotation: [0, -ang, Math.PI / 2] });
  a.add(beam([x - dx * 0.45, y + r * 2.1, z - dz * 0.45], [x - dx * 0.15, y + r * 2.1, z - dz * 0.15], 0.003, 0.0016), { tone: "light" });
}

// ------------------------------------------------------------------ contract

function contract(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "contract");
  const W = 0.21,
    D = 0.297;
  const top = pageStack(a, W, D, 0.012, 7, c.rng);
  const tex = pageTexture("contract", spec, c.rng, c.variant % 2, { vela: true, sub: "between VELA SYSTEMS and THE OPERATOR", number: "Ref. VS-0640", signatures: 2 });
  // The top page, its lower corner lifting.
  const pg = new THREE.PlaneGeometry(W, D, 6, 8);
  const p = pg.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + W / 2) / W,
      v = (-p.getY(i) + D / 2) / D; // v = 1 at the bottom edge
    const lift = Math.max(0, u + v - 1.45);
    p.setZ(i, 0.12 * lift * lift);
  }
  pg.computeVertexNormals();
  pg.rotateX(-Math.PI / 2);
  pg.translate(0, top + 0.0012, 0);
  if (tex) {
    const m = new THREE.Mesh(pg, inkMaterial({ map: tex, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.print, side: THREE.DoubleSide, shade: 0.75 }));
    a.attach(m);
  } else a.add(pg, { tone: "paper" });
  // Staple at the head corner, SIGN HERE flags on the fore-edge.
  a.add(slab(0.012, 0.0012, 0.0022), { tone: "mid", position: [-W / 2 + 0.018, top + 0.0012, -D / 2 + 0.014], rotation: [0, 0.7, 0] });
  for (const [z, n] of [
    [0.02, 0],
    [0.07, 1],
    [0.115, 2],
  ] as const)
    a.add(slab(0.05, 0.0012, 0.013), { tone: "paper", accent: "amber", accentAmount: 1, position: [W / 2 - 0.004 + (n % 2) * 0.003, top - 0.004 - n * 0.002, z] });
  if (c.pose !== "propped") pen(a, 0.02, top + 0.0015, -0.03, 0.5);
  const o = a.build();
  o.rotation.y = c.rng.range(-0.35, 0.35);
  return { object: o, footprint: { width: W + 0.05, depth: D, height: 0.03 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ licence (on a clipboard)

function license(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "license");
  const BW = 0.235,
    BD = 0.33;
  const board = plate(roundRect(BW, BD, 0.012, 3), 0.0045, 0.0008);
  board.rotateX(-Math.PI / 2);
  board.translate(0, 0.00225, 0);
  a.add(board, { tone: "light" });
  const top = pageStack(a, 0.21, 0.297, 0.004, 3, c.rng, 0.0045);
  const tex = inkTexture(keyOf("licence", spec.title, spec.label, c.variant % 2), PAGE_W, PAGE_H, (g, w, h) => {
    const r = c.rng.fork("lic");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    guilloche(g, w * 0.04, h * 0.03, w * 0.92, h * 0.94, w * 0.045);
    velaMark(g, w * 0.12, h * 0.09, w * 0.06);
    text(g, "No. 000 1", w * 0.86, h * 0.1, h * 0.014, { align: "right" });
    const lines = wrap(spec.title, 12, 2);
    lines.forEach((ln, i) => text(g, ln, w / 2, h * (0.2 + i * 0.06), h * 0.038, { family: SERIF, weight: "bold", maxW: w * 0.78 }));
    text(g, "issued under the Automated Systems Act", w / 2, h * 0.34, h * 0.014, { family: SERIF, weight: "italic", maxW: w * 0.7 });
    // Holder panel.
    g.lineWidth = 3;
    g.strokeRect(w * 0.14, h * 0.39, w * 0.26, h * 0.17);
    text(g, "SYSTEM", w * 0.27, h * 0.475, h * 0.018);
    greek(g, w * 0.46, h * 0.41, w * 0.4, h * 0.024, 6, r);
    greek(g, w * 0.14, h * 0.62, w * 0.72, h * 0.022, 6, r);
    seal(g, w * 0.26, h * 0.83, w * 0.075);
    signature(g, w * 0.52, h * 0.84, w * 0.3, h * 0.03, r);
    g.fillStyle = "#000";
    g.fillRect(w * 0.5, h * 0.875, w * 0.36, 2);
    if (spec.label) stamp(g, spec.label, w * 0.58, h * 0.56, w * 0.6, -0.24, r);
  });
  a.attach(printPlane(tex, 0.21, 0.297, [0, top + 0.001, 0], "up"));
  // Spring clip at the head.
  const cz = -BD / 2 + 0.03;
  a.add(cbox(0.1, 0.004, 0.035, 0.0015), { tone: "mid", position: [0, top + 0.004, cz] });
  a.add(
    sheet(0.09, 0.05, 0.003, 1, 6, (_x, z) => 0.02 * Math.cos(((z + 0.025) / 0.05) * Math.PI * 0.5) ** 2),
    { tone: "light", position: [0, top + 0.005, cz + 0.004] },
  );
  for (const s of [-1, 1]) a.add(cylinder(0.004, 0.004, 0.003, 8), { tone: "deep", position: [s * 0.04, top + 0.0065, cz - 0.01] });
  a.add(rod([-0.035, top + 0.028, cz + 0.022], [0.035, top + 0.028, cz + 0.022], 0.003, 6), { tone: "mid" });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.35, 0.35);
  return { object: o, footprint: { width: BW, depth: BD, height: 0.04 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ report (lever-arch binders, spines out)

function report(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "report");
  const SW = 0.075,
    H = 0.32,
    D = 0.285;
  const tones = ["dark", "light", "dark"] as const;
  const spineTex = (vol: number, withLabel: boolean) =>
    inkTexture(keyOf("spine", spec.title, withLabel ? spec.label : "", vol), 128, 544, (g, w, h) => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
      frame(g, 2, 2, w - 4, h - 4, 4);
      text(g, `VOL. ${vol}`, w / 2, h * 0.07, h * 0.03, { maxW: w * 0.8 });
      g.fillStyle = "#000";
      g.fillRect(w * 0.1, h * 0.11, w * 0.8, 3);
      g.save();
      g.translate(w / 2, h * 0.5);
      g.rotate(-Math.PI / 2);
      text(g, spec.title, 0, 0, w * 0.34, { maxW: h * 0.7, weight: "bold", squeeze: 0.9 });
      g.restore();
      if (withLabel && spec.label) {
        g.fillStyle = RED;
        g.fillRect(w * 0.08, h * 0.87, w * 0.84, h * 0.1);
        text(g, spec.label, w / 2, h * 0.92, h * 0.026, { color: "#fff", maxW: w * 0.78, weight: "900", squeeze: 0.8 });
      }
    });
  for (let i = 0; i < 3; i++) {
    const k = new Kit();
    // Covers, spine, page block (fore-edge to the back), finger hole.
    for (const s of [-1, 1]) k.add(slab(0.003, H, D), { tone: tones[i]!, position: [s * (SW / 2 - 0.0015), 0, 0] });
    k.add(slab(SW, H, 0.004), { tone: tones[i]!, position: [0, 0, D / 2 - 0.002] });
    k.add(slab(SW - 0.012, H - 0.012, D - 0.02), { tone: "paper", position: [0, 0.006, -0.006] });
    for (const y of [0.004, H - 0.004]) k.add(slab(SW + 0.001, 0.004, 0.006), { tone: "mid", position: [0, y - 0.002, D / 2 - 0.001] });
    k.add(cylinder(0.014, 0.014, 0.006, 14).rotateX(Math.PI / 2), { tone: "solid", position: [0, H * 0.14, D / 2] });
    k.add(ring(0.016, 0.0025, 3, 14).rotateX(Math.PI / 2), { tone: "mid", position: [0, H * 0.14, D / 2 + 0.002] });
    const g = k.build();
    const lean = i === 2 ? 0.16 : 0;
    const x = (i - 1) * (SW + 0.004) + (i === 2 ? 0.018 : 0);
    if (lean) {
      g.translate(SW / 2, 0, 0);
      g.rotateZ(-lean);
      g.translate(-SW / 2, 0, 0);
    }
    g.translate(x, 0, 0);
    a.kit.addGeometry(g);
    const tex = spineTex(i + 1, i === 1);
    const pl = printPlane(tex, SW * 0.72, H * 0.72, [0, 0, 0], "front");
    if (pl) {
      pl.geometry.translate(0, H * 0.56, D / 2 + 0.0015);
      if (lean) {
        pl.geometry.translate(SW / 2, 0, 0);
        pl.geometry.rotateZ(-lean);
        pl.geometry.translate(-SW / 2, 0, 0);
      }
      pl.geometry.translate(x, 0, 0);
      a.attach(pl);
    }
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: SW * 3 + 0.08, depth: D, height: H }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ certificate (framed, on its easel back)

function certificate(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "certificate");
  const FW = 0.3,
    FH = 0.38,
    fw = 0.028,
    fd = 0.02,
    lean = 0.26;
  const k = new Kit();
  // Moulded frame: four chamfered bars with a raised lip.
  const bar = (x0: number, y0: number, x1: number, y1: number) => {
    k.add(beam([x0, y0, 0], [x1, y1, 0], fw, fd, [0, 0, 1]), { tone: "deep" });
    k.add(beam([x0, y0, fd / 2], [x1, y1, fd / 2], fw * 0.35, 0.006, [0, 0, 1]), { tone: "dark" });
  };
  bar(-FW / 2 + fw / 2, 0, -FW / 2 + fw / 2, FH);
  bar(FW / 2 - fw / 2, 0, FW / 2 - fw / 2, FH);
  bar(-FW / 2, fw / 2, FW / 2, fw / 2);
  bar(-FW / 2, FH - fw / 2, FW / 2, FH - fw / 2);
  // Backing board and mat.
  k.add(slab(FW - 0.01, FH - 0.01, 0.004), { tone: "light", position: [0, 0.005, -fd / 2 + 0.002] });
  k.add(slab(FW - fw * 2 + 0.004, FH - fw * 2 + 0.004, 0.003), { tone: "paper", position: [0, fw - 0.002, -0.004] });
  // Easel strut behind.
  const strut = new THREE.BoxGeometry(0.05, FH * 0.72, 0.006);
  strut.translate(0, -FH * 0.36, 0);
  strut.rotateX(0.62);
  k.add(strut, { tone: "light", position: [0, FH * 0.78, -fd / 2 - 0.004] });
  const g = k.build();
  g.rotateX(-lean);
  g.translate(0, 0, 0.03);
  a.kit.addGeometry(g);
  const tex = inkTexture(keyOf("cert", spec.title, spec.label), 448, 576, (gg, w, h) => {
    const r = c.rng.fork("cert");
    gg.fillStyle = "#fff";
    gg.fillRect(0, 0, w, h);
    guilloche(gg, w * 0.035, h * 0.03, w * 0.93, h * 0.94, w * 0.04);
    text(gg, "CERTIFICATE", w / 2, h * 0.17, h * 0.05, { family: SERIF, weight: "bold", maxW: w * 0.78, track: 4 });
    const rest = spec.title.replace(/^CERTIFICATE\s*/i, "") || "OF COMPLIANCE";
    text(gg, rest, w / 2, h * 0.25, h * 0.026, { family: SERIF, weight: "bold", maxW: w * 0.72, track: 2 });
    text(gg, "This is to certify that the system known as", w / 2, h * 0.34, h * 0.014, { family: SERIF, weight: "italic", maxW: w * 0.7 });
    text(gg, "MORROW", w / 2, h * 0.41, h * 0.04, { family: SERIF, weight: "bold", maxW: w * 0.6, track: 6 });
    greek(gg, w * 0.16, h * 0.49, w * 0.68, h * 0.022, 5, r);
    seal(gg, w * 0.27, h * 0.78, w * 0.085);
    signature(gg, w * 0.52, h * 0.79, w * 0.28, h * 0.03, r);
    gg.fillStyle = "#000";
    gg.fillRect(w * 0.5, h * 0.83, w * 0.34, 2);
    if (spec.label) stamp(gg, spec.label, w * 0.52, h * 0.62, w * 0.66, -0.3, r);
  });
  const pw = FW - fw * 2 - 0.02,
    ph = FH - fw * 2 - 0.02;
  const pl = printPlane(tex, pw, ph, [0, 0, 0], "front");
  if (pl) {
    pl.geometry.translate(0, FH / 2, -0.0015);
    pl.geometry.rotateX(-lean);
    pl.geometry.translate(0, 0, 0.03);
    a.attach(pl);
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.25, 0.25);
  return { object: o, footprint: { width: FW, depth: 0.3, height: FH * Math.cos(lean) }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ permit (notice on a stake)

function permit(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "permit");
  const post = 0.045,
    below = 0.28,
    top = 0.72;
  a.add(slab(post, top + below, post), { tone: "pale", position: [0, -below, -0.012] });
  a.add(new THREE.ConeGeometry(post * 0.7, 0.08, 4).rotateY(Math.PI / 4).rotateX(Math.PI), { tone: "pale", position: [0, -below - 0.04, -0.012] });
  const BW = 0.27,
    BH = 0.36,
    by = top - BH - 0.02;
  a.add(slab(BW, BH, 0.01), { tone: "paper", position: [0, by, post / 2 - 0.007] });
  for (const [x, y] of [
    [-BW / 2 + 0.02, by + BH - 0.02],
    [BW / 2 - 0.02, by + BH - 0.02],
  ] as const)
    a.add(cylinder(0.004, 0.004, 0.004, 6).rotateX(Math.PI / 2), { tone: "solid", position: [x, y, post / 2 + 0.0 + 0.001] });
  // The notice in its sleeve, cable-tied to the board.
  const tex = inkTexture(keyOf("permit", spec.title, spec.label), PAGE_W, PAGE_H, (g, w, h) => {
    const r = c.rng.fork("permit");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h * 0.16);
    const lines = wrap(spec.title, 14, 2);
    lines.forEach((ln, i) => text(g, ln, w / 2, h * (lines.length > 1 ? 0.05 + i * 0.06 : 0.08), h * 0.042, { color: "#fff", maxW: w * 0.88, weight: "900", squeeze: 0.86 }));
    text(g, "No. 07 / 0640", w * 0.08, h * 0.21, h * 0.022, { align: "left" });
    barcode(g, w * 0.6, h * 0.185, w * 0.32, h * 0.05, r);
    for (let i = 0; i < 3; i++) {
      const y = h * (0.29 + i * 0.07);
      g.fillStyle = "#000";
      g.fillRect(w * 0.08, y, w * 0.26, 3);
      greek(g, w * 0.08, y - h * 0.02, w * 0.22, h * 0.018, 1, r, { ragged: false });
      g.lineWidth = 3;
      g.strokeRect(w * 0.4, y - h * 0.045, w * 0.52, h * 0.05);
      greek(g, w * 0.43, y - h * 0.02, w * 0.4, h * 0.02, 1, r);
    }
    greek(g, w * 0.08, h * 0.54, w * 0.84, h * 0.022, 8, r);
    signature(g, w * 0.56, h * 0.9, w * 0.3, h * 0.03, r);
    if (spec.label) stamp(g, spec.label, w * 0.5, h * 0.72, w * 0.8, -0.16, r);
  });
  a.attach(printPlane(tex, 0.21, 0.297, [0, by + BH / 2, post / 2 + 0.0015], "front"));
  for (const x of [-0.105, 0.105])
    for (const y of [by + BH / 2 + 0.14, by + BH / 2 - 0.14]) a.add(ring(0.008, 0.0015, 3, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 2), { tone: "solid", position: [x, y, post / 2 + 0.002] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: BW, depth: 0.06, height: top }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ treaty (folio stood open)

function treaty(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "treaty");
  const LW = 0.3,
    LH = 0.42,
    open = 0.62; // each leaf's angle forward from the spine's plane
  const texL = inkTexture(keyOf("treatyL", spec.title), 448, 628, (g, w, h) => {
    const r = c.rng.fork("tl");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    paperTooth(g, w, h, r, 0.7);
    frame(g, w * 0.06, h * 0.04, w * 0.88, h * 0.92, 3);
    frame(g, w * 0.08, h * 0.055, w * 0.84, h * 0.89, 1.5);
    const lines = wrap(spec.title, 10, 2);
    lines.forEach((ln, i) => text(g, ln, w / 2, h * (0.14 + i * 0.07), h * 0.05, { family: SERIF, weight: "bold", maxW: w * 0.74, track: 5 }));
    for (let i = 0; i < 4; i++) {
      const y = h * (0.3 + i * 0.16);
      text(g, `ARTICLE ${["I", "II", "III", "IV"][i]}`, w / 2, y, h * 0.018, { family: SERIF, weight: "bold" });
      greek(g, w * 0.14, y + h * 0.035, w * 0.72, h * 0.02, 4, r, { color: "#222" });
    }
  });
  const texR = inkTexture(keyOf("treatyR", spec.label), 448, 628, (g, w, h) => {
    const r = c.rng.fork("tr");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    paperTooth(g, w, h, r, 0.7);
    frame(g, w * 0.06, h * 0.04, w * 0.88, h * 0.92, 3);
    greek(g, w * 0.14, h * 0.1, w * 0.72, h * 0.02, 6, r, { color: "#222" });
    text(g, "IN WITNESS WHEREOF", w / 2, h * 0.3, h * 0.02, { family: SERIF, weight: "bold" });
    for (let i = 0; i < 4; i++) {
      const x = w * (i % 2 ? 0.55 : 0.14);
      const y = h * (0.42 + Math.floor(i / 2) * 0.15);
      signature(g, x + w * 0.02, y, w * 0.26, h * 0.03, r);
      g.fillStyle = "#000";
      g.fillRect(x, y + h * 0.03, w * 0.3, 2);
    }
    if (spec.label) stamp(g, spec.label, w * 0.5, h * 0.82, w * 0.66, -0.12, r);
  });
  // Two leaves hinged at a vertical spine at the origin, opening toward +Z.
  const leaf = (side: number, tex: THREE.CanvasTexture | null) => {
    const k = new Kit();
    k.add(slab(LW, LH, 0.006), { tone: "deep", position: [side * LW / 2, 0, -0.003] });
    k.add(slab(LW - 0.02, LH - 0.02, 0.004), { tone: "paper", position: [side * (LW / 2 + 0.002), 0.01, 0.002] });
    const g = k.build();
    g.rotateY(-side * open);
    a.kit.addGeometry(g);
    const pl = printPlane(tex, LW - 0.04, LH - 0.04, [side * (LW / 2 + 0.002), LH / 2, 0.0045], "front");
    if (pl) {
      pl.geometry.rotateY(-side * open);
      a.attach(pl);
    }
  };
  leaf(-1, texL);
  leaf(1, texR);
  a.add(rodY(0.009, 0, LH, 10), { tone: "deep" });
  // Silk cord from the spine to a pendant wax seal.
  a.add(
    wire(
      [
        [0, LH * 0.35, 0.01],
        [0.01, LH * 0.2, 0.05],
        [0.0, 0.1, 0.08],
        [-0.01, 0.06, 0.1],
      ],
      0.003,
      14,
      4,
    ),
    { tone: "paper", accent: "signal" },
  );
  const sealG = turned(
    [
      [0, 0],
      [0.036, 0],
      [0.04, 0.006],
      [0.036, 0.012],
      [0.02, 0.013],
      [0, 0.012],
    ],
    16,
  );
  sealG.rotateX(Math.PI / 2 - 0.5);
  a.add(sealG, { tone: "mid", accent: "signal", accentAmount: 0.9, position: [-0.012, 0.04, 0.1] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: LW * 2 * Math.cos(open), depth: LW * Math.sin(open), height: LH }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ org chart (board on a table easel)

function orgChart(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "org-chart");
  const BW = 0.56,
    BH = 0.42,
    lean = 0.2,
    ledge = 0.1;
  // A-frame easel: two front legs, a back leg, ledge.
  const H = 0.62;
  for (const s of [-1, 1]) a.add(beam([s * 0.2, 0, 0.0], [s * 0.05, H, -0.09], 0.022, 0.016), { tone: "pale" });
  a.add(beam([0, 0, -0.3], [0, H * 0.9, -0.1], 0.022, 0.016), { tone: "pale" });
  a.add(cbox(0.46, 0.018, 0.05, 0.004), { tone: "pale", position: [0, ledge, 0.045] });
  a.add(cbox(0.46, 0.022, 0.012, 0.003), { tone: "pale", position: [0, ledge + 0.016, 0.066] });
  // The board, resting on the ledge, leaning back on the legs.
  const board = new Kit();
  board.add(slab(BW, BH, 0.008), { tone: "paper" });
  const bg = board.build();
  bg.rotateX(-lean);
  bg.translate(0, ledge + 0.01, 0.05);
  a.kit.addGeometry(bg);
  const tex = inkTexture(keyOf("org", spec.title, spec.label), 768, 576, (g, w, h) => {
    const r = c.rng.fork("org");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    velaMark(g, w * 0.04, h * 0.04, w * 0.04);
    text(g, spec.title, w * 0.96, h * 0.075, h * 0.04, { align: "right", maxW: w * 0.6 });
    const box = (x: number, y: number, bw: number, bh: number, label: string, struck = false, solid = false) => {
      g.lineWidth = 4;
      g.strokeStyle = "#000";
      if (solid) {
        g.fillStyle = "#000";
        g.fillRect(x - bw / 2, y - bh / 2, bw, bh);
      } else g.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
      text(g, label, x, y - bh * 0.12, bh * 0.22, { color: solid ? "#fff" : "#000", maxW: bw * 0.86 });
      greek(g, x - bw * 0.3, y + bh * 0.22, bw * 0.6, bh * 0.14, 1, r, { color: solid ? "#fff" : "#444", ragged: false });
      if (struck) {
        g.strokeStyle = RED;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(x - bw * 0.55, y + bh * 0.55);
        g.lineTo(x + bw * 0.55, y - bh * 0.55);
        g.moveTo(x - bw * 0.55, y - bh * 0.55);
        g.lineTo(x + bw * 0.55, y + bh * 0.55);
        g.stroke();
      }
    };
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      g.strokeStyle = "#000";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0, (y0 + y1) / 2);
      g.lineTo(x1, (y0 + y1) / 2);
      g.lineTo(x1, y1);
      g.stroke();
    };
    const top = h * 0.22,
      mid = h * 0.46,
      low = h * 0.74;
    box(w / 2, top, w * 0.2, h * 0.11, "BOARD", false, true);
    line(w / 2, top + h * 0.055, w / 2, mid - h * 0.05);
    box(w / 2, mid, w * 0.18, h * 0.1, "CHIEF EXECUTIVE");
    const depts = ["SAFETY", "POLICY", "PRODUCT", "RESEARCH"];
    depts.forEach((d, i) => {
      const x = w * (0.14 + i * 0.24);
      line(w / 2, mid + h * 0.05, x, low - h * 0.05);
      box(x, low, w * 0.17, h * 0.1, d, i === 0);
    });
    if (spec.label) stamp(g, spec.label, w * 0.62, h * 0.6, w * 0.4, -0.18, r);
  });
  const pl = printPlane(tex, BW - 0.02, BH - 0.02, [0, 0, 0], "front");
  if (pl) {
    pl.geometry.translate(0, BH / 2, 0.0055);
    pl.geometry.rotateX(-lean);
    pl.geometry.translate(0, ledge + 0.01, 0.05);
    a.attach(pl);
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: BW, depth: 0.36, height: H }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ appeal (bundle tied in red tape)

function appeal(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "appeal");
  const W = 0.21,
    D = 0.297;
  a.add(sheet(W + 0.006, D + 0.004, 0.0015), { tone: "light" });
  const top = pageStack(a, W, D, 0.04, 9, c.rng, 0.0015);
  const tex = pageTexture("appeal", spec, c.rng, c.variant % 2, { sub: "IN THE MATTER OF THE LINE", number: "Case 26 / 0640", signatures: 1, stampAt: [0.52, 0.44] });
  a.attach(printPlane(tex, W - 0.002, D - 0.002, [0, top + 0.0012, 0], "up"));
  // Red tape both ways, knotted in a bow.
  const t = 0.0015,
    tw = 0.022;
  const hx = W / 2 + 0.003,
    hz = D / 2 + 0.003;
  const tape = (pts: Array<[number, number, number]>, across: [number, number, number]) => a.add(band(pts, tw, t, across, 8), { tone: "paper", accent: "signal" });
  tape(
    [
      [-hx, 0.0, 0.03],
      [-hx, top + 0.002, 0.03],
      [0, top + 0.003, 0.03],
      [hx, top + 0.002, 0.03],
      [hx, 0.0, 0.03],
    ],
    [0, 0, 1],
  );
  tape(
    [
      [0.03, 0.0, -hz],
      [0.03, top + 0.002, -hz],
      [0.03, top + 0.003, 0],
      [0.03, top + 0.002, hz],
      [0.03, 0.0, hz],
    ],
    [1, 0, 0],
  );
  for (const s of [-1, 1]) {
    tape(
      [
        [0.03, top + 0.004, 0.03],
        [0.03 + s * 0.02, top + 0.012, 0.03 + 0.01],
        [0.03 + s * 0.03, top + 0.006, 0.03 + 0.02],
        [0.03 + s * 0.008, top + 0.004, 0.03 + 0.005],
      ],
      [0, 1, 0],
    );
    tape(
      [
        [0.03, top + 0.004, 0.03],
        [0.03 + s * 0.012, top + 0.003, 0.08],
        [0.03 + s * 0.02, top + 0.003, 0.11],
      ],
      [0, 1, 0],
    );
  }
  a.add(blob(0.008, 0.005, 0.008), { tone: "paper", accent: "signal", position: [0.03, top + 0.005, 0.03] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.35, 0.35);
  return { object: o, footprint: { width: W, depth: D, height: 0.06 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ archive box

function archiveBox(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(propMaterial(HATCH.small, OBJECT_ID.document), "archive-box");
  const W = 0.3,
    H = 0.26,
    D = 0.38;
  const oneBox = (y: number, turn: number, withLabel: boolean, idx: number) => {
    const k = new Kit();
    k.add(slab(W, H - 0.03, D), { tone: "pale" });
    k.add(cblock(W + 0.008, 0.045, D + 0.008, 0.003), { tone: "pale", position: [0, H - 0.045, 0] });
    // Hand-hold slot on the end.
    k.add(cbox(0.09, 0.024, 0.006, 0.01), { tone: "solid", position: [0, H - 0.075, D / 2 + 0.0005] });
    // A file tab poking out under the lid.
    k.add(slab(0.06, 0.03, 0.002), { tone: "paper", position: [-0.06, H - 0.07, -D / 2 - 0.004], rotation: [0.2, 0, 0] });
    const g = k.build();
    g.rotateY(turn);
    g.translate(0, y, 0);
    a.kit.addGeometry(g);
    if (!withLabel) return;
    const tex = inkTexture(keyOf("archive", spec.title, spec.label, idx), 384, 288, (gg, w, h) => {
      const r = c.rng.fork(`arch${idx}`);
      gg.fillStyle = "#fff";
      gg.fillRect(0, 0, w, h);
      frame(gg, 3, 3, w - 6, h - 6, 5);
      gg.fillStyle = "#000";
      gg.fillRect(3, 3, w - 6, h * 0.22);
      text(gg, spec.title, w / 2, h * 0.12, h * 0.1, { color: "#fff", maxW: w * 0.86, weight: "900" });
      const rows = ["DEPT", "YEARS", "RETAIN"];
      rows.forEach((row, i) => {
        const yy = h * (0.35 + i * 0.13);
        text(gg, row, w * 0.07, yy, h * 0.04, { align: "left" });
        gg.fillRect(w * 0.3, yy + h * 0.035, w * 0.62, 2);
      });
      marker(gg, "SAFETY LOGS", w * 0.6, h * 0.34, h * 0.06, r, { maxW: w * 0.58 });
      marker(gg, "2024-26", w * 0.55, h * 0.47, h * 0.055, r, { maxW: w * 0.4 });
      if (spec.label) stamp(gg, spec.label, w * 0.56, h * 0.78, w * 0.6, -0.1, r);
    });
    const pl = printPlane(tex, 0.2, 0.15, [0, 0, 0], "front");
    if (pl) {
      pl.geometry.translate(0, y + H * 0.42, D / 2 + 0.0015);
      pl.geometry.rotateY(turn);
      a.attach(pl);
    }
  };
  oneBox(0, 0, true, 0);
  if (c.variant % 3 === 1) oneBox(H, c.rng.range(-0.12, 0.12), false, 1);
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: W, depth: D, height: c.variant % 3 === 1 ? H * 2 : H }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ ruling (bound judgment, gavel)

function ruling(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "ruling");
  const W = 0.21,
    D = 0.297;
  const top = pageStack(a, W, D, 0.014, 5, c.rng);
  a.add(slab(0.024, top + 0.003, D + 0.002), { tone: "deep", position: [-W / 2 + 0.01, -0.0005, 0] });
  const tex = inkTexture(keyOf("ruling", spec.title, spec.label), PAGE_W, PAGE_H, (g, w, h) => {
    const r = c.rng.fork("ruling");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    paperTooth(g, w, h, r, 0.6);
    // Court crest: a ring with balance scales.
    const cx = w / 2,
      cy = h * 0.14,
      R = w * 0.075;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#000";
    g.fillRect(cx - 2, cy - R * 0.6, 4, R * 1.2);
    g.fillRect(cx - R * 0.6, cy - R * 0.45, R * 1.2, 4);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * R * 0.55, cy + R * 0.05, R * 0.22, 0, Math.PI);
      g.fill();
    }
    text(g, "IN THE HIGH COURT", w / 2, h * 0.26, h * 0.018, { family: SERIF, weight: "bold", track: 3 });
    text(g, spec.title, w / 2, h * 0.33, h * 0.042, { family: SERIF, weight: "bold", maxW: w * 0.8, track: 3 });
    text(g, "Case No. 26 / 0640", w / 2, h * 0.39, h * 0.016, { family: SERIF });
    g.fillRect(w * 0.2, h * 0.42, w * 0.6, 2);
    greek(g, w * 0.14, h * 0.47, w * 0.72, h * 0.021, 12, r);
    if (spec.label) stamp(g, spec.label, w * 0.5, h * 0.84, w * 0.62, -0.08, r, { color: OXBLOOD });
  });
  a.attach(printPlane(tex, W - 0.022, D - 0.004, [0.011, top + 0.0012, 0], "up"));
  // Gavel on its block beside the judgment.
  const bx = 0.14,
    bz = -0.02;
  a.add(turned([[0, 0], [0.058, 0], [0.062, 0.006], [0.058, 0.018], [0.05, 0.022], [0, 0.022]], 22), { tone: "mid", position: [bx, 0, bz] });
  const gavel = new Kit();
  gavel.add(
    turned(
      [
        [0, -0.055],
        [0.026, -0.055],
        [0.029, -0.05],
        [0.029, -0.036],
        [0.025, -0.032],
        [0.025, 0.032],
        [0.029, 0.036],
        [0.029, 0.05],
        [0.026, 0.055],
        [0, 0.055],
      ],
      16,
    ),
    { tone: "mid" },
  );
  gavel.add(ring(0.0255, 0.003, 3, 16), { tone: "dark", position: [0, 0.02, 0] });
  gavel.add(ring(0.0255, 0.003, 3, 16), { tone: "dark", position: [0, -0.02, 0] });
  const handle = turned(
    [
      [0.009, 0],
      [0.011, 0.06],
      [0.012, 0.2],
      [0.015, 0.23],
      [0.012, 0.245],
      [0, 0.25],
    ],
    10,
  );
  handle.rotateX(Math.PI / 2);
  gavel.add(handle, { tone: "mid", position: [0, 0, 0.02] });
  const gg = gavel.build();
  gg.rotateZ(Math.PI / 2);
  gg.rotateY(0.7);
  gg.translate(bx - 0.02, 0.029 + 0.022, bz + 0.02);
  a.kit.addGeometry(gg);
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: 0.4, depth: 0.32, height: 0.08 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ ledger (one standing against two lying)

function ledgerBook(k: Kit, W: number, H: number, T: number, cloth: "light" | "mid"): void {
  // Quarter-bound: cloth boards, leather spine and corners, page block.
  for (const s of [-1, 1]) k.add(slab(W, 0.004, H), { tone: cloth, position: [0, s > 0 ? T - 0.004 : 0, 0] });
  k.add(slab(W - 0.008, T - 0.008, H - 0.01), { tone: "paper", position: [0.004, 0.004, 0] });
  k.add(cblock(0.04, T + 0.004, H + 0.002, 0.006), { tone: "deep", position: [-W / 2 + 0.016, -0.002, 0] });
  for (let i = 0; i < 4; i++) k.add(slab(0.042, T + 0.006, 0.006), { tone: "solid", position: [-W / 2 + 0.016, -0.003, -H / 2 + 0.05 + i * (H - 0.1) / 3] });
  for (const sz of [-1, 1]) {
    const corner = plate(
      [
        [0, 0],
        [0.05, 0],
        [0, 0.05],
      ],
      T + 0.004,
    );
    corner.rotateX(-Math.PI / 2);
    corner.rotateY(sz > 0 ? Math.PI : -Math.PI / 2);
    k.add(corner, { tone: "deep", position: [W / 2 + 0.001, T / 2, sz * (H / 2 + 0.001)] });
  }
}

function ledger(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "ledger");
  const W = 0.26,
    H = 0.36,
    T = 0.05;
  // Two lying flat, behind.
  for (let i = 0; i < 2; i++) {
    const k = new Kit();
    ledgerBook(k, W, H, T, i ? "mid" : "light");
    const g = k.build();
    g.rotateY(Math.PI / 2 + (i ? 0.08 : -0.04));
    g.translate(0.02 * i, i * T, -0.07);
    a.kit.addGeometry(g);
  }
  // One standing on its tail, leaning back on the pile, cover to the front.
  const k = new Kit();
  ledgerBook(k, W, H, T, "light");
  const g = k.build();
  // Book lies in XZ with its cover up (+Y); stand it so the cover faces +Z.
  g.rotateX(Math.PI / 2);
  const lean = 0.34;
  g.translate(0, H / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(-lean));
  g.translate(0, 0, 0.1);
  a.kit.addGeometry(g);
  const tex = inkTexture(keyOf("ledger", spec.title, spec.label), 320, 256, (gg, w, h) => {
    gg.fillStyle = "#fff";
    gg.fillRect(0, 0, w, h);
    frame(gg, 4, 4, w - 8, h - 8, 5);
    frame(gg, 14, 14, w - 28, h - 28, 2);
    text(gg, spec.title, w / 2, h * 0.33, h * 0.16, { family: SERIF, weight: "bold", maxW: w * 0.8, track: 4 });
    text(gg, "VOL. IX · 1987 – 2026", w / 2, h * 0.55, h * 0.06, { family: SERIF, maxW: w * 0.8 });
    if (spec.label) {
      gg.fillStyle = RED;
      gg.fillRect(w * 0.18, h * 0.68, w * 0.64, h * 0.18);
      text(gg, spec.label, w / 2, h * 0.775, h * 0.1, { color: "#fff", weight: "900", maxW: w * 0.58, squeeze: 0.85 });
    }
  });
  const pl = printPlane(tex, 0.2, 0.16, [0.014, H * 0.6, T + 0.0015], "front");
  if (pl) {
    pl.geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-lean));
    pl.geometry.translate(0, 0, 0.1);
    a.attach(pl);
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.25, 0.25);
  return { object: o, footprint: { width: H + 0.02, depth: 0.5, height: H * Math.cos(lean) }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ order (in a plate stand)

function order(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "order");
  const W = 0.21,
    D = 0.297,
    lean = 0.3;
  // Black wire plate stand: back support, front lip, feet.
  const back = -Math.sin(lean) * D * 0.7;
  for (const s of [-1, 1]) {
    a.add(wire([[s * 0.06, 0.004, 0.02], [s * 0.06, 0.004, -0.06], [s * 0.05, D * 0.62, back - 0.01]], 0.0025, 10, 3), { tone: "solid" });
    a.add(rod([s * 0.08, 0.004, 0.035], [s * 0.08, 0.03, 0.035], 0.0025, 4), { tone: "solid" });
  }
  a.add(rod([-0.08, 0.004, 0.035], [0.08, 0.004, 0.035], 0.0025, 4), { tone: "solid" });
  a.add(rod([-0.08, 0.03, 0.035], [0.08, 0.03, 0.035], 0.0025, 4), { tone: "solid" });
  const sheetK = new Kit();
  sheetK.add(slab(W, D, 0.0016), { tone: "paper" });
  const sg = sheetK.build();
  sg.rotateX(-lean);
  sg.translate(0, 0.006, 0.03);
  a.kit.addGeometry(sg);
  const tex = inkTexture(keyOf("order", spec.title, spec.label), PAGE_W, PAGE_H, (g, w, h) => {
    const r = c.rng.fork("order");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    paperTooth(g, w, h, r, 0.5);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h * 0.2);
    text(g, spec.title, w / 2, h * 0.09, h * 0.075, { color: "#fff", maxW: w * 0.86, weight: "900", track: 8 });
    text(g, "BY AUTHORITY OF THE COUNCIL", w / 2, h * 0.165, h * 0.016, { color: "#fff", track: 2 });
    text(g, "No. 7", w * 0.08, h * 0.25, h * 0.022, { align: "left" });
    for (let i = 0; i < 5; i++) {
      const y = h * (0.31 + i * 0.075);
      text(g, `${i + 1}.`, w * 0.08, y, h * 0.016, { align: "left" });
      greek(g, w * 0.14, y, w * 0.76, h * 0.022, 2, r);
    }
    signature(g, w * 0.54, h * 0.9, w * 0.32, h * 0.03, r);
    seal(g, w * 0.22, h * 0.88, w * 0.07, { ribbons: false });
    if (spec.label) stamp(g, spec.label, w * 0.5, h * 0.72, w * 0.84, -0.22, r);
  });
  const pl = printPlane(tex, W - 0.004, D - 0.004, [0, 0, 0], "front");
  if (pl) {
    pl.geometry.translate(0, D / 2, 0.0017);
    pl.geometry.rotateX(-lean);
    pl.geometry.translate(0, 0.006, 0.03);
    a.attach(pl);
  }
  const o = a.build();
  o.rotation.y = c.rng.range(-0.2, 0.2);
  return { object: o, footprint: { width: W, depth: 0.2, height: D * Math.cos(lean) }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ map (accordion-folded, half open)

function drawMap(g: CanvasRenderingContext2D, w: number, h: number, rng: Rng, label?: string): void {
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  // Grid.
  g.strokeStyle = "#999";
  g.lineWidth = 1;
  for (let x = 0; x < w; x += w / 10) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = 0; y < h; y += h / 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // Contours around two hills.
  g.strokeStyle = "#444";
  for (const [cx, cy, n] of [
    [w * 0.25, h * 0.3, 7],
    [w * 0.72, h * 0.7, 6],
  ] as const) {
    for (let i = 1; i <= n; i++) {
      g.beginPath();
      for (let s = 0; s <= 40; s++) {
        const a = (s / 40) * Math.PI * 2;
        const rr = i * h * 0.035 * (1 + 0.18 * Math.sin(a * 3 + i) + 0.1 * Math.cos(a * 5 - i));
        const x = cx + Math.cos(a) * rr * 1.5,
          y = cy + Math.sin(a) * rr;
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.lineWidth = i % 5 === 0 ? 2.5 : 1.2;
      g.stroke();
    }
  }
  // River.
  g.strokeStyle = "#000";
  for (const off of [-4, 4]) {
    g.beginPath();
    g.moveTo(0, h * 0.62 + off);
    g.bezierCurveTo(w * 0.3, h * 0.45 + off, w * 0.5, h * 0.95 + off, w, h * 0.55 + off);
    g.lineWidth = 2;
    g.stroke();
  }
  // Railway: black-and-white dashed line with a fork.
  const rail = (pts: Array<[number, number]>) => {
    g.lineWidth = 9;
    g.strokeStyle = "#000";
    g.setLineDash([]);
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = "#fff";
    g.setLineDash([18, 18]);
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.setLineDash([]);
  };
  rail([
    [0, h * 0.85],
    [w * 0.3, h * 0.6],
    [w * 0.48, h * 0.45],
  ]);
  rail([
    [w * 0.48, h * 0.45],
    [w * 0.7, h * 0.15],
    [w, h * 0.08],
  ]);
  rail([
    [w * 0.48, h * 0.45],
    [w * 0.78, h * 0.42],
    [w, h * 0.3],
  ]);
  // Stations and woods.
  g.fillStyle = "#fff";
  g.strokeStyle = "#000";
  g.lineWidth = 4;
  for (const [x, y] of [
    [w * 0.3, h * 0.6],
    [w * 0.7, h * 0.15],
    [w * 0.78, h * 0.42],
  ] as const) {
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = "#000";
  for (let i = 0; i < 40; i++) {
    const x = w * rng.range(0.05, 0.4),
      y = h * rng.range(0.05, 0.25);
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fill();
  }
  // The circled fork, annotated in red.
  g.strokeStyle = RED;
  g.lineWidth = 7;
  g.beginPath();
  g.ellipse(w * 0.48, h * 0.45, w * 0.07, h * 0.1, 0.2, 0, Math.PI * 2);
  g.stroke();
  marker(g, label ?? "HERE", w * 0.6, h * 0.62, h * 0.07, rng, { color: RED, maxW: w * 0.3, align: "left" });
  // Cartouche.
  g.fillStyle = "#fff";
  g.fillRect(w * 0.66, h * 0.8, w * 0.32, h * 0.17);
  frame(g, w * 0.66, h * 0.8, w * 0.32, h * 0.17, 4);
  text(g, "LINE MAP", w * 0.82, h * 0.86, h * 0.04, { maxW: w * 0.28 });
  text(g, "SHEET 7 · 1:25 000", w * 0.82, h * 0.92, h * 0.018, { maxW: w * 0.28 });
}

function map(c: BuildCtx, spec: DocSpec): Built {
  const a = new Assembly(docMat(), "map");
  const panels = 6,
    PW = 0.105,
    PD = 0.38,
    fold = 0.62;
  const tex = inkTexture(keyOf("map", spec.label), 1024, 616, (g, w, h) => drawMap(g, w, h, c.rng.fork("map"), spec.label));
  // One continuous sheet folded in a zig-zag (accordion), so the drawing runs
  // across the folds.
  const geo = new THREE.PlaneGeometry(PW * panels, PD, panels, 1);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const run = PW * Math.cos(fold);
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + (PW * panels) / 2) / PW; // 0..panels
    const k = Math.round(u);
    const x = k * run - (run * panels) / 2;
    const up = k % 2 === 1 ? PW * Math.sin(fold) : 0;
    pos.setXYZ(i, x, pos.getY(i), up);
  }
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.002, 0);
  if (tex) {
    const m = new THREE.Mesh(geo, inkMaterial({ map: tex, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.print, side: THREE.DoubleSide, shade: 0.8 }));
    a.attach(m);
  } else a.add(geo, { tone: "paper" });
  // Card covers at the ends.
  a.add(slab(0.11, 0.003, PD + 0.004), { tone: "dark", position: [-(run * panels) / 2 - 0.05, 0, 0], rotation: [0, 0, 0] });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: run * panels + 0.1, depth: PD, height: PW * Math.sin(fold) }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ factory

export function buildDocumentPart(id: DocumentId, c: BuildCtx, o: { title?: string }): Built {
  const spec: DocSpec = { title: (o.title ?? defaultTitle(id)).toUpperCase(), ...(c.label ? { label: c.label.toUpperCase() } : {}) };
  switch (id) {
    case "contract":
      return contract(c, spec);
    case "license":
      return license(c, spec);
    case "report":
      return report(c, spec);
    case "certificate":
      return certificate(c, spec);
    case "permit":
      return permit(c, spec);
    case "treaty":
      return treaty(c, spec);
    case "org-chart":
      return orgChart(c, spec);
    case "appeal":
      return appeal(c, spec);
    case "archive-box":
      return archiveBox(c, spec);
    case "ruling":
      return ruling(c, spec);
    case "ledger":
      return ledger(c, spec);
    case "order":
      return order(c, spec);
    case "map":
      return map(c, spec);
    default: {
      const never: never = id;
      throw new Error(`Unknown document ${String(never)}`);
    }
  }
}

