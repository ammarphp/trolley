/**
 * Paper props that are not "documents" in the staging sense: the compliance
 * forms (a thick stapled stack with a bulldog clip on its header), a manila
 * folder and an open register book.
 */
import * as THREE from "three";
import { Kit } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";
import type { Rng } from "../core/rng.ts";
import { Assembly, HATCH, OBJECT_ID, beam, propMaterial, rod, sheet, slab, wire, band } from "./common.ts";
import { RED, barcode, formRows, frame, greek, inkTexture, printPlane, signature, stamp, text } from "./print.ts";
import type { BuildCtx, Built } from "./types.ts";

const docMat = () => propMaterial(HATCH.tiny, OBJECT_ID.document);

function stack(a: Assembly, w: number, d: number, thick: number, layers: number, rng: Rng, y0 = 0, fan = 0.012): number {
  const t = thick / layers;
  for (let i = 0; i < layers; i++) {
    const g = sheet(w, d, t * 0.9);
    g.rotateY(rng.range(-fan, fan));
    a.add(g, { tone: i % 2 ? "paper" : "pale", position: [rng.range(-0.002, 0.002), y0 + i * t, rng.range(-0.002, 0.002)] });
  }
  return y0 + thick;
}

/** A bulldog clip gripping an edge that runs along X at height y, depth z. */
function bulldog(a: Assembly, x: number, y: number, z: number, thick: number): void {
  const W = 0.052;
  // Folded spring-steel jaws: a triangular prism over the edge.
  const k = new Kit();
  const jaw = (s: number) => {
    const g = new THREE.BoxGeometry(W, 0.0016, 0.03);
    g.translate(0, 0, 0.015);
    g.rotateX(s * 0.35);
    return g;
  };
  k.add(jaw(-1), { tone: "deep", position: [0, thick + 0.002, -0.01] });
  k.add(jaw(1), { tone: "deep", position: [0, -0.002, -0.01] });
  k.add(beam([-W / 2, thick / 2, -0.012], [W / 2, thick / 2, -0.012], thick + 0.02, 0.006, [0, 0, 1]), { tone: "deep" });
  // Wire handles folded back flat over the pages.
  for (const s of [1, -1]) {
    const yy = s > 0 ? thick + 0.012 : -0.008;
    k.add(
      wire(
        [
          [-W / 2 + 0.006, yy - s * 0.006, -0.005],
          [-W / 2 + 0.004, yy, 0.03],
          [W / 2 - 0.004, yy, 0.03],
          [W / 2 - 0.006, yy - s * 0.006, -0.005],
        ],
        0.0016,
        12,
        3,
      ),
      { tone: "light" },
    );
  }
  const g = k.build();
  g.translate(x, y, z);
  a.kit.addGeometry(g);
}

// ------------------------------------------------------------------ compliance forms

export function paperwork(c: BuildCtx): Built {
  const a = new Assembly(docMat(), "paperwork");
  const W = 0.21,
    D = 0.297,
    T = 0.018;
  const top = stack(a, W, D, T, 10, c.rng);
  // Section dividers poking from the fore-edge.
  for (let i = 0; i < 4; i++) a.add(slab(0.014, 0.0012, 0.03), { tone: "light", position: [W / 2 + 0.005, 0.003 + i * 0.004, -0.1 + i * 0.06] });
  const label = c.label?.toUpperCase();
  const tex = inkTexture(`forms:${label ?? ""}`, 512, 724, (g, w, h) => {
    const r = c.rng.fork("forms");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    const m = w * 0.07;
    g.fillStyle = "#000";
    g.fillRect(m, h * 0.03, w - m * 2, h * 0.1);
    text(g, "FORM C-40", m + w * 0.03, h * 0.08, h * 0.03, { align: "left", color: "#fff" });
    text(g, "PAGE 1 OF 40", w - m - w * 0.03, h * 0.08, h * 0.016, { align: "right", color: "#fff" });
    text(g, "COMPLIANCE", w / 2, h * 0.18, h * 0.04, { maxW: w - m * 2 });
    text(g, "ATTESTATION", w / 2, h * 0.235, h * 0.04, { maxW: w - m * 2 });
    frame(g, m, h * 0.27, w - m * 2, h * 0.1, 3);
    greek(g, m + w * 0.03, h * 0.3, w * 0.5, h * 0.022, 3, r);
    barcode(g, w * 0.66, h * 0.285, w * 0.24, h * 0.06, r);
    formRows(g, m, h * 0.42, w - m * 2, h * 0.042, 9, r);
    text(g, "SIGNATURE", m, h * 0.86, h * 0.014, { align: "left" });
    g.fillRect(m, h * 0.9, w * 0.5, 2);
    text(g, "DATE", w * 0.66, h * 0.86, h * 0.014, { align: "left" });
    g.fillRect(w * 0.66, h * 0.9, w * 0.27, 2);
    if (label) stamp(g, label, w * 0.52, h * 0.6, w * 0.7, -0.18, r);
  });
  a.attach(printPlane(tex, W - 0.002, D - 0.002, [0, top + 0.0012, 0], "up"));
  // Heavy staples down the spine edge, and the clip on the header.
  for (const z of [-0.09, 0.09]) a.add(slab(0.003, 0.0014, 0.016), { tone: "mid", position: [-W / 2 + 0.012, top + 0.0012, z] });
  a.add(slab(0.012, 0.0014, 0.003), { tone: "mid", position: [-W / 2 + 0.016, top + 0.0012, -D / 2 + 0.014], rotation: [0, 0.7, 0] });
  bulldog(a, 0.02, 0, -D / 2, top);
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: W, depth: D + 0.02, height: T + 0.02 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ manila folder

export function folder(c: BuildCtx): Built {
  const a = new Assembly(docMat(), "folder");
  const W = 0.235,
    D = 0.31;
  const label = (c.label ?? "CONFIDENTIAL").toUpperCase().slice(0, 16);
  // Back cover with its tab, papers, front cover lifted slightly.
  a.add(sheet(W, D, 0.0012), { tone: "pale" });
  a.add(slab(0.09, 0.0012, 0.02), { tone: "pale", position: [0.05, 0, -D / 2 - 0.01] });
  const top = stack(a, 0.21, 0.297, 0.006, 3, c.rng, 0.0012, 0.05);
  const lift = 0.1;
  const front = sheet(W, D, 0.0012);
  front.translate(0, 0, D / 2);
  front.rotateX(-lift);
  front.translate(0, 0, -D / 2);
  front.translate(-0.004, top + 0.001, 0.0);
  a.add(front, { tone: "pale" });
  const tex = inkTexture(`folder:${label}`, 480, 640, (g, w, h) => {
    const r = c.rng.fork("folder");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(w * 0.08, h * 0.08, w * 0.5, 3);
    g.fillRect(w * 0.08, h * 0.14, w * 0.5, 3);
    text(g, "FILE", w * 0.08, h * 0.05, h * 0.02, { align: "left" });
    stamp(g, label, w * 0.5, h * 0.5, w * 0.78, -0.12, r);
  });
  const pl = printPlane(tex, W - 0.004, D - 0.004, [0, 0, 0], "up");
  if (pl) {
    pl.geometry.translate(0, 0.0014, D / 2);
    pl.geometry.rotateX(-lift);
    pl.geometry.translate(-0.004, top + 0.001, -D / 2);
    a.attach(pl);
  }
  const tabTex = inkTexture(`tab:${label}`, 256, 64, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    text(g, label, w / 2, h / 2, h * 0.4, { maxW: w * 0.9, weight: "bold" });
  });
  a.attach(printPlane(tabTex, 0.08, 0.016, [0.05, 0.0014, -D / 2 - 0.01], "up"));
  // Elastic band round it.
  a.add(band([[-0.08, -0.002, D / 2 + 0.001], [-0.08, top + 0.03, D / 2 - 0.05], [-0.08, top + 0.03, -D / 2 + 0.05], [-0.08, -0.002, -D / 2 - 0.001]], 0.006, 0.0015, [1, 0, 0], 10), { tone: "deep" });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.35, 0.35);
  return { object: o, footprint: { width: W, depth: D + 0.02, height: 0.04 }, scalable: 1, placement: "surface" };
}

// ------------------------------------------------------------------ open register book

export function registerBook(c: BuildCtx): Built {
  const a = new Assembly(docMat(), "register-book");
  const PW = 0.2,
    PD = 0.3,
    T = 0.03;
  // Boards spread open, page blocks curving up from the gutter.
  for (const s of [-1, 1]) a.add(slab(PW + 0.012, 0.004, PD + 0.012), { tone: "deep", position: [s * (PW / 2 + 0.004), 0, 0] });
  a.add(beam([0, 0.0, -PD / 2 - 0.006], [0, 0.0, PD / 2 + 0.006], 0.03, 0.01), { tone: "deep" });
  const pageCurve = (x: number) => {
    const u = Math.abs(x) / PW; // 0 at the gutter
    return T * (0.55 + 0.45 * Math.sin(Math.min(1, u * 2.2) * Math.PI * 0.5)) - T * 0.35 * u * u;
  };
  for (const s of [-1, 1]) {
    const k = new Kit();
    const g = sheet(PW, PD, 0.002, 10, 1, (x) => pageCurve(x + s * PW / 2) - 0.002);
    k.add(g, { tone: "paper", position: [s * PW / 2, 0.004, 0] });
    // Page block edge.
    k.add(slab(0.004, T * 0.55, PD - 0.004), { tone: "pale", position: [s * (PW - 0.004), 0.004, 0] });
    a.kit.addGeometry(k.build());
  }
  const heading = (c.label ?? "REGISTER").toUpperCase().slice(0, 18);
  const tex = inkTexture(`register:${heading}`, 1024, 768, (g, w, h) => {
    const r = c.rng.fork("register");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    for (const side of [0, 1]) {
      const x0 = side * (w / 2) + w * 0.05;
      const pw = w / 2 - w * 0.1;
      if (side === 0) text(g, heading, x0 + pw / 2, h * 0.07, h * 0.035, { maxW: pw * 0.9, weight: "bold" });
      else text(g, "NAME · DESTINATION · TIME", x0 + pw / 2, h * 0.07, h * 0.018, { maxW: pw * 0.9 });
      g.strokeStyle = "#000";
      g.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const y = h * (0.12 + i * 0.047);
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x0 + pw, y);
        g.stroke();
      }
      for (const f of [0.08, 0.55, 0.8]) {
        g.beginPath();
        g.moveTo(x0 + pw * f, h * 0.12);
        g.lineTo(x0 + pw * f, h * 0.96);
        g.stroke();
      }
      g.strokeStyle = RED;
      g.beginPath();
      g.moveTo(x0 + pw * 0.08 - 6, h * 0.12);
      g.lineTo(x0 + pw * 0.08 - 6, h * 0.96);
      g.stroke();
      const filled = side === 0 ? 17 : 9;
      for (let i = 0; i < filled; i++) {
        const y = h * (0.12 + i * 0.047) - h * 0.012;
        signature(g, x0 + pw * 0.12, y, pw * 0.36, h * 0.02, r, "#111");
        greek(g, x0 + pw * 0.58, y, pw * 0.18, h * 0.02, 1, r, { ragged: false, color: "#111", weight: 0.35 });
        text(g, `${String(6 + Math.floor(i / 4)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`, x0 + pw * 0.9, y + 2, h * 0.012, { weight: "normal" });
      }
    }
  });
  if (tex) {
    const geo = new THREE.PlaneGeometry(PW * 2, PD, 20, 1);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, pageCurve(p.getX(i)) + 0.004);
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, inkMaterial({ map: tex, hatchSpace: "object", hatch: HATCH.tiny, objectId: OBJECT_ID.print, shade: 0.75 }));
    a.attach(m);
  }
  // Ribbon marker and a pen on a cord.
  a.add(band([[0.0, T * 0.6, -PD / 2 + 0.02], [0.004, T * 0.6, PD / 2], [0.01, 0.002, PD / 2 + 0.06]], 0.008, 0.001, [1, 0, 0], 8), { tone: "dark" });
  a.add(rod([0.1, T * 0.9, 0.05], [0.2, T * 0.9, -0.02], 0.004, 8), { tone: "deep" });
  a.add(wire([[0.2, T * 0.9, -0.02], [0.23, 0.01, -0.03], [0.22, 0.004, -0.1], [0.19, 0.004, -0.16]], 0.0012, 10, 3), { tone: "mid" });
  const o = a.build();
  o.rotation.y = c.rng.range(-0.3, 0.3);
  return { object: o, footprint: { width: PW * 2 + 0.03, depth: PD + 0.02, height: T + 0.02 }, scalable: 1, placement: "surface" };
}
