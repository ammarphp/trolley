/**
 * Rural structures: farmhouse, barn, windmill, mill, water tower,
 * greenhouse, garden, orchard.
 */
import * as THREE from "three";
import { Kit, cone, cylinder, gable, jitter, lathe, type Tone } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";
import type { Arch, M4, Opening, P2, V3 } from "./arch.ts";
import { at, frame, inverted, shape } from "./arch.ts";
import { smooth } from "./condition.ts";
import { cropRow, fruitTree, growthFrom, sunflower } from "./flora.ts";
import { massing, porch, dormer } from "./massing.ts";

const W = (x: number, y: number, w: number, h: number, extra: Partial<Opening> = {}): Opening => ({ x, y, w, h, kind: "window", win: "sash", ...extra });
const D = (x: number, w: number, h: number, extra: Partial<Opening> = {}): Opening => ({ x, y: 0, w, h, kind: "door", door: "panel", ...extra });

// ----------------------------------------------------------------- farmhouse

export function farmhouse(a: Arch, variant: number): void {
  const g = a.rng;
  if (variant === 0) {
    // Georgian double-pile farmhouse: symmetrical three-bay front, end stacks,
    // a catslide outshut on one gable.
    const w = g.range(10.2, 11.2);
    const d = 6.4;
    const h = 5.7;
    const bx = w / 2 - 2.55;
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.45,
      roof: "gable",
      ridge: "x",
      pitch: 38,
      roofTone: "light",
      front: [W(-bx, 0.85, 1.15, 1.65), D(0, 1.05, 2.3, { doorTone: "solid", dress: "hood" }), W(bx, 0.85, 1.15, 1.65), ...at([-bx, 0, bx], { y: 3.55, w: 1.15, h: 1.45, kind: "window", win: "sash" })],
      back: [W(-2.2, 0.95, 1.0, 1.4), D(1.4, 0.95, 2.1, { door: "plank" }), W(-2.2, 3.6, 1.0, 1.3), W(2.2, 3.6, 1.0, 1.3)],
      right: [W(-1.2, 3.7, 0.7, 1.0, { win: "casement" })],
      bands: [{ y: 0, h: 0.42, p: 0.07, tone: "mid" }],
      pipes: true,
      label: "main",
    });
    const ridge = b.top;
    for (const sx of [-1, 1]) a.chimney(b.f, sx * (w / 2 - 0.5), 0, h - 1, ridge + 1.0, 0.9, 0.6, 2);
    // Outshut on the left gable, falling away from the house.
    const lw = 4.6;
    const ld = 3.2;
    massing(a, {
      x: -w / 2 - ld / 2,
      z: -0.6,
      rot: -Math.PI / 2,
      w: lw,
      d: ld,
      h: 2.6,
      t: 0.35,
      roof: "lean",
      pitch: 24,
      front: [W(-0.9, 0.9, 0.8, 1.0, { win: "casement" })],
      left: [D(0.2, 0.9, 2.0, { door: "plank" })],
      omit: ["back"],
      label: "outshut",
    });
    yard(a, w, d, 1);
    return;
  }
  if (variant === 1) {
    // Stone longhouse L-plan with a rear wing, dormers and a gabled porch.
    const w = g.range(12.5, 14);
    const d = 6.0;
    const h = 4.4;
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.55,
      roof: "gable",
      ridge: "x",
      pitch: 45,
      roofTone: "mid",
      front: [W(-4.3, 0.85, 1.0, 1.35, { win: "casement" }), W(-1.6, 0.85, 1.0, 1.35, { win: "casement" }), D(1.1, 1.0, 2.15, { doorTone: "dark" }), W(3.6, 0.85, 1.4, 1.35, { win: "casement" }), W(5.6, 0.9, 0.7, 0.9, { win: "casement" })],
      back: [W(-3.5, 0.9, 1.0, 1.3, { win: "casement" }), W(0.5, 0.9, 0.8, 1.1, { win: "casement" })],
      left: [W(0, 2.2, 0.8, 1.0, { win: "casement" }), W(0, 5.2, 0.5, 0.7, { win: "plain", sill: false })],
      quoins: true,
      pipes: true,
      label: "long",
    });
    const rf = frame(0, h, 0, 0, b.f);
    for (const x of [-3.0, 3.6]) dormer(a, rf, x, d / 2, 45, { w: 1.5, h: 1.45, setback: 0.1, label: `dorm${x}` });
    a.chimney(b.f, -w / 2 + 0.6, 0, h - 1, b.top + 0.9, 1.0, 0.7, 1);
    a.chimney(b.f, 2.3, 0, h - 1, b.top + 0.8, 0.8, 0.6, 2);
    porch(a, b.faces.front, 1.1, { w: 2.0, d: 1.5, h: 2.35, label: "porch" });
    // Rear wing.
    const ww = 5.2;
    const wd = 6.5;
    massing(a, {
      x: -w / 2 + ww / 2 + 1.0,
      z: -d / 2 - wd / 2 + 0.2,
      w: ww,
      d: wd,
      h: 3.8,
      t: 0.5,
      roof: "gable",
      ridge: "z",
      pitch: 45,
      roofTone: "mid",
      back: [W(0, 1.0, 1.0, 1.2, { win: "casement" }), W(0, 4.3, 0.6, 0.8, { win: "casement" })],
      right: [W(-1.2, 0.9, 1.0, 1.25, { win: "casement" }), D(1.6, 0.95, 2.05, { door: "plank" })],
      left: [W(0.5, 0.9, 1.0, 1.25, { win: "casement" })],
      quoins: true,
      omit: ["front"],
      label: "wing",
    });
    yard(a, w, d, 2);
    return;
  }
  // Variant 2: square hipped farmhouse with a verandah and central stacks.
  const w = g.range(10, 10.8);
  const d = 8.6;
  const h = 6.0;
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.4,
    roof: "hip",
    ridge: "x",
    pitch: 32,
    roofTone: "light",
    roofOpts: { eave: 0.6 },
    front: [W(-3.2, 0.9, 1.2, 1.8), W(-1.2, 0.9, 1.2, 1.8), D(1.2, 1.1, 2.4, { doorTone: "dark", door: "glazed" }), W(3.2, 0.9, 1.2, 1.8), ...at([-3.2, -1.2, 1.2, 3.2], { y: 3.75, w: 1.2, h: 1.55, kind: "window", win: "sash", shutters: true })],
    back: [W(-2.8, 0.95, 1.1, 1.5), D(0.6, 1.0, 2.2, { door: "plank" }), W(2.8, 0.95, 1.1, 1.5), W(-2.8, 3.75, 1.1, 1.4), W(2.8, 3.75, 1.1, 1.4)],
    left: [W(-1.6, 0.95, 1.1, 1.6), W(1.6, 0.95, 1.1, 1.6), W(0, 3.75, 1.1, 1.4)],
    right: [W(-1.6, 0.95, 1.1, 1.6), W(1.6, 3.75, 1.1, 1.4)],
    bands: [{ y: 0, h: 0.45, p: 0.05, tone: "pale" }, { y: 3.05, h: 0.16, p: 0.05 }],
    pipes: true,
    label: "square",
  });
  for (const sx of [-1, 1]) a.chimney(b.f, sx * 1.6, -0.3, h - 1, b.top + 0.7, 0.8, 0.8, 3);
  verandah(a, b.faces.front, w - 0.6, 2.2, 2.9, "ver");
  yard(a, w, d, 3);
}

function verandah(a: Arch, face: M4, len: number, depth: number, h: number, label: string): void {
  if (a.ruin >= 0.75) return;
  const vf = frame(0, 0, depth / 2, 0, face);
  a.box(vf, 0, 0, 0, len + 0.2, 0.25, depth + 0.1, "pale");
  const n = Math.max(3, Math.round(len / 2.4));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (len * i) / n;
    a.box(vf, x, 0.25, depth / 2 - 0.12, 0.14, h - 0.25, 0.14, "paper");
    a.box(vf, x, h - 0.5, depth / 2 - 0.12, 0.14, 0.02, 0.14, "paper");
  }
  // Balustrade rails with sparse balusters.
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + (len * i) / n;
    const x1 = x0 + len / n;
    if (i === Math.floor(n / 2)) continue;
    a.box(vf, (x0 + x1) / 2, 1.05, depth / 2 - 0.12, x1 - x0, 0.07, 0.08, "paper");
    a.box(vf, (x0 + x1) / 2, 0.4, depth / 2 - 0.12, x1 - x0, 0.06, 0.06, "paper");
    for (let k = 1; k < 6; k++) a.box(vf, x0 + ((x1 - x0) * k) / 6, 0.46, depth / 2 - 0.12, 0.035, 0.6, 0.035, "paper");
  }
  const rf = frame(0, h, 0, 0, vf);
  a.leanRoof(rf, len + 0.2, depth, { pitch: 14, eave: 0.25, verge: 0.1, t: 0.08, tone: "light", label: `${label}:roof` });
  // Fascia beam.
  a.box(vf, 0, h - 0.25, depth / 2 - 0.12, len + 0.2, 0.25, 0.16, "paper");
}

/** Small yard furniture shared by rural houses: water butt, bench, log store. */
function yard(a: Arch, w: number, d: number, seed: number): void {
  const g = a.fork(`yard${seed}`);
  if (a.sealed) return;
  // Water butt under the front-right downpipe.
  a.add(cylinder(0.36, 0.34, 0.95, 10), null, { tone: "light", position: [w / 2 - 0.3, 0.475, d / 2 + 0.48] });
  if (g.next() < 0.7 && a.ruin < 0.5) {
    // Log store against the right gable.
    const lf = frame(w / 2 + 0.55, 0, -d / 4, Math.PI / 2);
    a.box(lf, 0, 0, 0, 2.2, 1.35, 0.8, "light");
    a.box(lf, 0, 1.35, -0.05, 2.4, 0.08, 1.0, "mid", { rot: [0.2, 0, 0] });
    for (let i = 0; i < 7; i++) a.add(cylinder(0.1, 0.1, 0.7, 6), lf, { tone: "paper", position: [-0.9 + i * 0.3, 0.25 + (i % 2) * 0.2, 0.36], rotation: [Math.PI / 2, 0, 0] });
  }
}

// ---------------------------------------------------------------- shared bits

/** Horizontal weatherboard lines on a face (between y0 and the top), skipping openings. */
export function weatherboard(a: Arch, face: M4, len: number, y0: number, h: number, ops: Opening[], apex = 0, spacing = 0.3, tone: Tone = "solid"): void {
  for (let y = y0 + spacing; y < h + apex - 0.15; y += spacing) {
    const half = y <= h ? len / 2 : (len / 2) * (1 - (y - h) / apex) - 0.1;
    if (half < 0.3) break;
    const cuts = ops
      .filter((o) => y > o.y - 0.12 && y < o.y + o.h + 0.25)
      .map((o) => [o.x - o.w / 2 - 0.12, o.x + o.w / 2 + 0.12] as [number, number])
      .sort((p, q) => p[0] - q[0]);
    let x = -half;
    const spans: Array<[number, number]> = [];
    for (const [c0, c1] of cuts) {
      if (c0 > x) spans.push([x, Math.min(c0, half)]);
      x = Math.max(x, c1);
    }
    if (x < half) spans.push([x, half]);
    for (const [p, q] of spans) if (q - p > 0.1) a.quad(face, (p + q) / 2, y, 0.006, q - p, tone === "light" ? 0.026 : 0.036, tone === "light" ? "solid" : tone);
  }
}

// ---------------------------------------------------------------------- barn

export function barn(a: Arch, variant: number): void {
  const g = a.rng;
  if (variant === 0) {
    // Tarred weatherboard threshing barn on a brick plinth, hipped, with a
    // gabled midstrey porch over the cart doors.
    const w = g.range(19, 22);
    const d = 9;
    const h = 4.3;
    const doors: Opening[] = [{ x: 0, y: 0, w: 4.4, h: 3.95, kind: "door", door: "double" }];
    const back: Opening[] = [{ x: 0, y: 0, w: 3.6, h: 3.6, kind: "door", door: "double" }];
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.25,
      tone: "dark",
      roof: "hip",
      ridge: "x",
      pitch: 50,
      roofTone: "mid",
      roofOpts: { eave: 0.45 },
      front: [{ x: -w / 2 + 2.2, y: 0, w: 1.0, h: 1.9, kind: "door", door: "plank" }],
      back,
      left: [{ x: 0, y: 2.6, w: 1.2, h: 1.0, kind: "window", win: "louvre", fixed: true }],
      right: [{ x: 0, y: 2.6, w: 1.2, h: 1.0, kind: "window", win: "louvre", fixed: true }],
      bands: [{ y: 0, h: 0.75, p: 0.06, tone: "pale" }],
      label: "barn",
    });
    weatherboard(a, b.faces.back, w, 0.75, h, back);
    weatherboard(a, b.faces.left, d - 0.5, 0.75, h, [{ x: 0, y: 2.6, w: 1.2, h: 1.0, kind: "window" }]);
    weatherboard(a, b.faces.right, d - 0.5, 0.75, h, [{ x: 0, y: 2.6, w: 1.2, h: 1.0, kind: "window" }]);
    weatherboard(a, b.faces.front, w, 0.75, h, [{ x: -w / 2 + 2.2, y: 0, w: 1.0, h: 1.9, kind: "door" }, { x: 0, y: 0, w: 5.8, h: 5, kind: "door" }]);
    // Midstrey.
    const m = massing(
      a,
      {
        z: 1.6,
        w: 5.8,
        d: 3.2,
        h,
        t: 0.22,
        tone: "dark",
        roof: "gable",
        ridge: "z",
        pitch: 50,
        roofTone: "mid",
        roofOpts: { eave: 0.4, verge: 0.3 },
        front: doors,
        omit: ["back"],
        bands: [{ y: 0, h: 0.75, p: 0.06, tone: "pale" }],
        label: "midstrey",
      },
      frame(0, 0, d / 2),
    );
    weatherboard(a, m.faces.front, 5.8, 0.75, h, doors, 2.9 * Math.tan((50 * Math.PI) / 180));
    return;
  }
  if (variant === 1) {
    // Limewashed stone bank barn: slit vents, a segmental cart arch, a
    // pitching door, an owl hole, byre doors on the lower side.
    const w = g.range(15.5, 17.5);
    const d = 8.2;
    const h = 5.6;
    const slit = (x: number, y: number): Opening => ({ x, y, w: 0.14, h: 0.95, kind: "window", win: "slit" });
    const slits = [-6, -4.6, -3.2, 3.2, 4.6, 6].filter((x) => Math.abs(x) < w / 2 - 0.8);
    massing(a, {
      w,
      d,
      h,
      t: 0.6,
      roof: "gable",
      ridge: "x",
      pitch: 36,
      roofTone: "mid",
      front: [
        { x: 0, y: 0, w: 3.4, h: 3.9, kind: "door", door: "double", head: "segment", dress: "arch" },
        ...slits.map((x) => slit(x, 1.5)),
        ...slits.filter((_, i) => i % 2 === 0).map((x) => slit(x + 0.7, 3.4)),
        { x: -w / 2 + 2.4, y: 3.0, w: 1.1, h: 1.5, kind: "door", door: "plank" },
      ],
      back: [
        { x: -4, y: 0, w: 1.1, h: 2.0, kind: "door", door: "plank" },
        { x: 0, y: 0, w: 1.1, h: 2.0, kind: "door", door: "plank" },
        { x: 4, y: 0, w: 1.1, h: 2.0, kind: "door", door: "plank" },
        ...slits.map((x) => slit(x + 0.5, 3.2)),
      ],
      left: [{ x: 0, y: h + 1.0, w: 0.45, h: 0.45, kind: "window", win: "slit", head: "round" }, slit(-1.5, 2.2), slit(1.5, 2.2)],
      right: [{ x: 0, y: h + 1.0, w: 0.45, h: 0.45, kind: "window", win: "slit", head: "round" }],
      quoins: true,
      courses: { every: 0.38, block: 0.8, indicate: 0.6 },
      label: "bank",
    });
    // Open cart shed as a lean-to against the right gable.
    const cs = frame(w / 2 + 2.2, 0, 0.4, Math.PI / 2);
    if (a.ruin < 0.75) {
      for (const x of [-3.2, 0, 3.2]) a.box(cs, x, 0, 1.95, 0.3, 2.9, 0.3, "paper");
      a.box(cs, 0, 2.75, 1.95, 7, 0.22, 0.26, "light");
      a.leanRoof(frame(0, 2.95, 0, 0, cs), 7.0, 4.2, { pitch: 20, eave: 0.3, verge: 0.2, tone: "mid", label: "cartshed" });
      a.box(cs, 0, 0, -1.9, 7.0, 3.1, 0.4, "paper");
    }
    return;
  }
  // Dutch barn: steel stanchions, a curved corrugated roof, stacked bales.
  const bays = 4 + g.int(0, 1);
  const bay = 4.6;
  const L = bays * bay;
  const span = 9.2;
  const eave = 5.6;
  const r = a.ruin;
  const lean = r >= 0.75 ? 0.06 : 0;
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + i * bay;
    for (const sz of [-1, 1]) {
      const gp = a.fork(`post${i}${sz}`);
      if (r > 0.6 && gp.next() < (r - 0.5) * 0.6) continue;
      a.beam(null, [x, 0, (sz * span) / 2], [x + gp.range(-lean, lean) * eave, eave, (sz * span) / 2], 0.26, 0.26, "mid");
      a.box(null, x, 0, (sz * span) / 2, 0.55, 0.3, 0.55, "pale");
    }
  }
  // Eave beams and end bracing.
  for (const sz of [-1, 1]) a.cbox(null, 0, eave - 0.18, (sz * span) / 2, L + 0.3, 0.36, 0.2, "mid");
  for (const x of [-L / 2 + bay / 2, L / 2 - bay / 2]) {
    for (const sz of [-1, 1]) {
      a.rod(null, [x - bay / 2, 0.3, (sz * span) / 2], [x + bay / 2, eave - 0.4, (sz * span) / 2], 0.035, "dark", 4);
      a.rod(null, [x + bay / 2, 0.3, (sz * span) / 2], [x - bay / 2, eave - 0.4, (sz * span) / 2], 0.035, "dark", 4);
    }
  }
  // Barrel roof: segmented arc of corrugated sheets with ribs at each truss.
  const rise = 2.3;
  const R = (span * span) / 4 / (2 * rise) + rise / 2;
  const cy = eave + rise - R;
  const segs = 10;
  const half = Math.asin(span / 2 / R);
  const gRoof = a.fork("dutch-roof");
  for (let i = 0; i < segs; i++) {
    const a0 = -half + (2 * half * i) / segs;
    const a1 = -half + (2 * half * (i + 1)) / segs;
    const pa: [number, number, number] = [0, cy + Math.cos(a0) * R, Math.sin(a0) * (R + 0.02)];
    const pb: [number, number, number] = [0, cy + Math.cos(a1) * R, Math.sin(a1) * (R + 0.02)];
    // Sheets go missing bay by bay.
    for (let bIdx = 0; bIdx < bays; bIdx++) {
      if (r >= 0.2 && gRoof.next() < (r - 0.15) * 1.3) continue;
      const x = -L / 2 + bay * (bIdx + 0.5);
      const ext = bIdx === 0 || bIdx === bays - 1 ? 0.35 : 0;
      const off = bIdx === 0 ? -ext / 2 : bIdx === bays - 1 ? ext / 2 : 0;
      a.beam(null, [x + off, pa[1] + 0.05, pa[2] * 1.035], [x + off, pb[1] + 0.05, pb[2] * 1.035], bay + ext + 0.02, 0.06, "light");
    }
    for (let t = 0; t <= bays; t++) {
      const x = -L / 2 + t * bay;
      a.beam(null, [x, pa[1] - 0.05, pa[2]], [x, pb[1] - 0.05, pb[2]], 0.14, 0.22, "mid");
    }
  }
  // Bales: big rectangular straw bales stacked in most bays.
  const gb = a.fork("bales");
  const burnt = a.c.fire > 0.3 || r > 0.5;
  if (!a.sealed) {
    for (let bIdx = 0; bIdx < bays; bIdx++) {
      const fill = a.c.abandoned > 0.5 ? gb.int(0, 1) : gb.int(1, 4);
      for (let row = 0; row < fill; row++) {
        for (let k = 0; k < 3; k++) {
          if (gb.next() < 0.12) continue;
          const x = -L / 2 + bay * (bIdx + 0.5) + gb.range(-0.08, 0.08);
          const z = -span / 2 + 1.6 + k * 2.6;
          a.add(jitterBox(2.4, 0.9, 1.2, gb), null, { tone: burnt ? "deep" : "pale", position: [x - 1.1, 0.45 + row * 0.92, z], rotation: [0, gb.range(-0.03, 0.03), 0] });
          a.add(jitterBox(2.4, 0.9, 1.2, gb), null, { tone: burnt ? "deep" : "pale", position: [x + 1.2, 0.45 + row * 0.92, z], rotation: [0, gb.range(-0.03, 0.03), 0] });
        }
      }
    }
    // A few round bales outside.
    for (let i = 0; i < 3; i++) {
      a.add(cylinder(0.75, 0.75, 1.2, 12), null, { tone: "pale", position: [L / 2 + 2 + i * 1.6, 0.75, span / 2 + 1.4 - (i % 2) * 1.7], rotation: [Math.PI / 2, 0, gb.range(-0.3, 0.3)] });
    }
  }
}

function jitterBox(w: number, h: number, d: number, g: Rng): THREE.BufferGeometry {
  return jitter(new THREE.BoxGeometry(w, h, d, 2, 1, 1), 0.04, g.next() * 50);
}

// ------------------------------------------------------------------ windmill

/** Four common sails (lattice with canvas) on a hub; returns the moving mesh. */
function sails(a: Arch, hub: V3, tilt: number, len: number, width: number): void {
  const c = a.c;
  if (c.sealed) return;
  const k = new Kit();
  const g = a.fork("sails");
  const broken = c.ruin > 0.35;
  const bare = c.abandoned > 0.3 || c.wind < 0.12 || c.ruin > 0.2;
  const nArms = 4;
  for (let i = 0; i < nArms; i++) {
    if (broken && g.next() < (c.ruin - 0.3) * 1.4) continue;
    const phi = (i * Math.PI) / 2;
    const m = new THREE.Matrix4().makeRotationZ(phi);
    const L = broken && g.next() < 0.6 ? len * g.range(0.35, 0.8) : len;
    const add = (geo: THREE.BufferGeometry, pos: V3, tone: Tone, rot?: V3) => k.add(geo, { tone, position: pos, rotation: rot, matrix: m });
    // Whip (the stock).
    add(new THREE.BoxGeometry(0.26, L + 0.6, 0.26), [0, (L + 0.6) / 2 - 0.3, 0.12], "light");
    // Sail frame on the trailing side.
    const r0 = 1.8;
    const rails = [0.28, width * 0.55, width];
    for (const x of rails) add(new THREE.BoxGeometry(0.1, L - r0, 0.1), [-x, r0 + (L - r0) / 2, 0.03], "paper");
    const bars = Math.round((L - r0) / 1.15);
    for (let b = 0; b <= bars; b++) add(new THREE.BoxGeometry(width + 0.1, 0.1, 0.09), [-width / 2 - 0.05, r0 + ((L - r0) * b) / bars, 0.03], "paper");
    // Leading board on the other side of the whip.
    add(new THREE.BoxGeometry(0.35, L - r0, 0.04), [0.3, r0 + (L - r0) / 2, 0.06], "paper", [0, 0.3, 0]);
    if (!bare) {
      const spread = 0.55 + 0.45 * Math.min(1, c.wind * 1.6);
      const cl = (L - r0) * spread;
      add(new THREE.PlaneGeometry(width - 0.15, cl), [-width / 2 - 0.12, r0 + cl / 2 + 0.05, -0.04], "paper");
      add(new THREE.PlaneGeometry(width - 0.15, cl), [-width / 2 - 0.12, r0 + cl / 2 + 0.05, -0.05], "paper", [0, Math.PI, 0]);
    }
  }
  // Hub and brake wheel boss.
  k.add(cylinder(0.55, 0.55, 0.7, 12), { tone: "mid", rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.1] });
  const mesh = a.moving(k, 0.07);
  mesh.position.set(...hub);
  mesh.rotation.set(-tilt, 0, g.next() * Math.PI);
  mesh.name = "civic:sails";
  if (!broken && c.abandoned < 0.3 && c.wind >= 0.12) {
    const speed = 0.5 + c.wind * 1.3;
    a.ticks.push((dt) => {
      mesh.rotation.z -= dt * speed;
    });
  }
}

function fantail(a: Arch, f: M4 | null, x: number, y: number, z: number): void {
  if (a.sealed || a.ruin > 0.35) return;
  a.beam(f, [x - 0.5, y - 1.2, z + 1.4], [x, y, z], 0.1, 0.1, "light");
  a.beam(f, [x + 0.5, y - 1.2, z + 1.4], [x, y, z], 0.1, 0.1, "light");
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationX(ang);
    m.setPosition(x, y, z);
    const ff = f ? f.clone().multiply(m) : m;
    a.add(new THREE.BoxGeometry(0.04, 1.3, 0.34), ff, { tone: "paper", position: [0, 0.75, 0], rotation: [0, 0.5, 0] });
  }
  a.add(cylinder(0.12, 0.12, 0.3, 8), f, { tone: "mid", position: [x, y, z], rotation: [0, 0, Math.PI / 2] });
}

/** Small window on a curved or battered surface: frame + glass, facing angle phi. */
function towerWindow(a: Arch, x: number, y: number, z: number, phi: number, w: number, h: number, broken: boolean, lit: boolean): void {
  const f = frame(x, y, z, phi);
  a.box(f, 0, 0, 0, w + 0.2, h + 0.2, 0.16, "paper");
  a.box(f, 0, 0.1, 0.03, w, h, 0.16, broken ? "solid" : lit ? "pale" : a.glass, lit ? { accent: "amber", amt: 0.9 } : {});
  if (!broken) a.box(f, 0, 0.1 + h / 2 - 0.03, 0.035, w, 0.06, 0.16, "paper");
  a.box(f, 0, -0.08, 0.06, w + 0.3, 0.08, 0.22, "pale");
}

function towerBody(a: Arch, rBot: number, rTop: number, h: number, segs: number, tone: Tone, y0 = 0): number {
  const r = a.ruin;
  let top = h;
  if (r >= 0.5) {
    const g = a.fork("tower-top");
    top = h * (1 - smooth(0.5, 1, r) * 0.55);
    const geo = new THREE.CylinderGeometry(rBot + (rTop - rBot) * (top / h), rBot, top, segs, 3, true);
    // Break the top ring into a jagged, stepped edge.
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const drops = Array.from({ length: segs + 1 }, () => g.range(0, 2.2) * smooth(0.5, 0.9, r));
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i);
      if (yy > top / 2 - 1e-3) {
        const ang = Math.atan2(pos.getZ(i), pos.getX(i));
        const idx = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segs) % segs;
        pos.setY(i, yy - Math.floor(drops[idx]! / 0.3) * 0.3);
      } else if (yy > -top / 2 + 1e-3) {
        const ang = Math.atan2(pos.getZ(i), pos.getX(i));
        const idx = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segs) % segs;
        pos.setY(i, yy - Math.floor(drops[idx]! / 0.3) * 0.15);
      }
    }
    geo.computeVertexNormals();
    a.add(geo, null, { tone, position: [0, y0 + top / 2, 0] });
    const inner = geo.clone();
    inner.scale(0.86, 0.995, 0.86);
    a.add(inverted(inner), null, { tone: "light", position: [0, y0 + top / 2, 0] });
    a.rubble(null, 0, 0, rBot * 0.7, rBot * 0.7, 0.8, "tower-in", 1.2);
    a.rubble(null, rBot + 1.4, 1, 2, 2, 0.7, "tower-out", 0.8);
    return -1;
  }
  a.add(cylinder(rTop, rBot, h, segs), null, { tone, position: [0, y0 + h / 2, 0] });
  return top;
}

export function windmill(a: Arch, variant: number): void {
  const c = a.c;
  const broken = c.ruin > 0.2;
  const g = a.rng;
  const winState = (i: number) => {
    const u = a.fork(`tw${i}`).next();
    return { broken: c.ruin > 0.15 + u * 0.5 || (c.abandoned > 0.5 && u < 0.5), lit: c.lit > u };
  };
  if (variant === 0) {
    // White-painted brick tower mill: gallery stage, ogee cap, fantail.
    const h = g.range(13, 15);
    const rBot = 3.9;
    const rTop = 2.75;
    const top = towerBody(a, rBot, rTop, h, 22, "paper");
    const rAt = (y: number) => rBot + ((rTop - rBot) * y) / h;
    // Door and windows spiralling up the tower.
    a.box(frame(0, 0, rBot - 0.12), 0, 0, 0, 1.4, 2.5, 0.3, "paper");
    a.box(frame(0, 0, rBot - 0.05), 0, 0.05, 0.05, 1.0, 2.2, 0.3, winState(0).broken ? "solid" : "deep");
    const wins: Array<[number, number]> = [
      [2.6, 1.9],
      [7.5, 0.6],
      [10.4, -0.9],
      [h - 1.6, 2.3],
      [4.2, -2.2],
    ];
    wins.forEach(([y, phi], i) => {
      if (top < 0 && y > h * 0.5) return;
      const r = rAt(y) - 0.02;
      const s = winState(i + 1);
      towerWindow(a, Math.sin(phi) * r, y, Math.cos(phi) * r, phi, 0.7, 0.95, s.broken, s.lit);
    });
    if (top < 0) return;
    // Stage (gallery) with brackets and a rail.
    const sy = 5.2;
    const rs = rAt(sy) + 1.45;
    if (c.ruin < 0.45) {
      a.add(cylinder(rs, rs, 0.14, 24), null, { tone: "light", position: [0, sy, 0] });
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const r0 = rAt(sy - 1.4);
        a.beam(null, [Math.cos(ang) * r0, sy - 1.4, Math.sin(ang) * r0], [Math.cos(ang) * (rs - 0.1), sy - 0.05, Math.sin(ang) * (rs - 0.1)], 0.1, 0.1, "light");
      }
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * Math.PI * 2;
        a.box(null, Math.cos(ang) * (rs - 0.08), sy + 0.07, Math.sin(ang) * (rs - 0.08), 0.06, 1.0, 0.06, "paper");
      }
      a.add(cylinder(rs - 0.08, rs - 0.08, 0.06, 24, true), null, { tone: "paper", position: [0, sy + 1.05, 0] });
      a.add(cylinder(rs - 0.08, rs - 0.08, 0.04, 24, true), null, { tone: "paper", position: [0, sy + 0.6, 0] });
    }
    // Cap: an ogee dome with a gallery ring and finial.
    if (!broken || c.ruin < 0.35) {
      a.add(cylinder(rTop + 0.28, rTop + 0.28, 0.35, 22), null, { tone: "light", position: [0, h + 0.17, 0] });
      a.add(
        lathe(
          [
            [rTop + 0.2, 0],
            [rTop + 0.15, 0.45],
            [rTop * 0.92, 1.35],
            [rTop * 0.55, 2.35],
            [0.45, 2.95],
            [0.18, 3.25],
            [0.0, 3.3],
          ],
          20,
        ),
        null,
        { tone: "paper", position: [0, h + 0.35, 0] },
      );
      a.add(new THREE.SphereGeometry(0.22, 10, 8), null, { tone: "mid", position: [0, h + 3.8, 0] });
      a.add(cylinder(0.05, 0.05, 0.4, 5), null, { tone: "mid", position: [0, h + 3.5, 0] });
      fantail(a, null, 0, h + 2.2, -rTop - 1.6);
      a.add(cylinder(0.3, 0.35, 1.6, 10), null, { tone: "mid", position: [0, h + 1.55, rTop + 0.5], rotation: [Math.PI / 2 - 0.14, 0, 0] });
      sails(a, [0, h + 1.65, rTop + 1.3], 0.14, 11.5, 2.3);
    }
    return;
  }
  if (variant === 1) {
    // Post mill: weatherboarded buck on a trestle inside a roundhouse.
    const rh = 3.6;
    a.add(cylinder(rh - 0.1, rh, 2.7, 20), null, { tone: "pale", position: [0, 1.35, 0] });
    a.add(cone(rh + 0.35, 1.7, 20), null, { tone: "light", position: [0, 2.7 + 0.85, 0] });
    a.box(frame(0, 0, rh - 0.1), 0, 0, 0, 1.0, 2.0, 0.25, winState(0).broken ? "solid" : "light");
    if (c.ruin >= 0.6) {
      a.rubble(null, 0.5, 0.4, 3, 3, 0.9, "buck", 1.6);
      return;
    }
    a.box(null, 0, 3.5, 0, 0.65, 2.6, 0.65, "light");
    const by = 6.0;
    const bw = 4.2;
    const bd = 5.8;
    const bh = 5.2;
    const bodyF = frame(0, by, 0);
    const front: Opening[] = [{ x: 0, y: 1.2, w: 0.8, h: 0.9, kind: "window", win: "casement" }];
    const back: Opening[] = [{ x: 0, y: 0.05, w: 0.95, h: 1.9, kind: "door", door: "plank" }];
    const b = massing(
      a,
      {
        w: bw,
        d: bd,
        h: bh,
        t: 0.15,
        tone: "paper",
        roof: "gable",
        ridge: "z",
        pitch: 52,
        roofTone: "light",
        roofOpts: { eave: 0.15, verge: 0.15, t: 0.1, gutter: false, barge: false },
        front,
        back,
        left: [{ x: 0.4, y: 2.8, w: 0.6, h: 0.7, kind: "window", win: "casement" }],
        label: "buck",
      },
      bodyF,
    );
    weatherboard(a, b.faces.front, bw, 0, bh, front, 2.1 * Math.tan((52 * Math.PI) / 180), 0.34, "light");
    weatherboard(a, b.faces.left, bd - 0.3, 0, bh, [], 0, 0.34, "light");
    weatherboard(a, b.faces.right, bd - 0.3, 0, bh, [], 0, 0.34, "light");
    weatherboard(a, b.faces.back, bw, 0, bh, back, 2.1 * Math.tan((52 * Math.PI) / 180), 0.34, "light");
    // Ladder and tail pole down the back.
    const zb = -bd / 2;
    for (const sx of [-0.45, 0.45]) a.beam(null, [sx, 0, zb - 5.4], [sx, by + 0.1, zb - 0.1], 0.1, 0.18, "light");
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      a.cbox(null, 0, by * t, zb - 5.4 * (1 - t) - 0.1, 0.9, 0.05, 0.25, "light");
    }
    a.beam(null, [0, by - 0.2, zb], [0, 0.7, zb - 8.2], 0.28, 0.3, "light");
    a.add(cylinder(0.6, 0.6, 0.12, 12), null, { tone: "light", position: [0, 0.6, zb - 8.2], rotation: [0, 0, Math.PI / 2] });
    sails(a, [0, by + bh - 0.6, bd / 2 + 0.5], 0.1, 10.5, 2.1);
    return;
  }
  // Smock mill: octagonal weatherboarded tower on a brick base.
  const baseH = 3.6;
  const rBase = 4.3;
  a.add(cylinder(rBase - 0.1, rBase, baseH, 8), null, { tone: "pale", position: [0, baseH / 2, 0], rotation: [0, Math.PI / 8, 0] });
  a.box(frame(0, 0, rBase * Math.cos(Math.PI / 8) - 0.1), 0, 0, 0, 1.1, 2.2, 0.3, winState(0).broken ? "solid" : "deep");
  const h = g.range(10, 11.5);
  const rBot = 3.5;
  const rTop = 2.4;
  const f0 = frame(0, baseH, 0);
  if (c.ruin >= 0.5) {
    const k = towerBody(a, rBot, rTop, h, 8, "paper", baseH);
    void k;
    return;
  }
  a.add(cylinder(rTop, rBot, h, 8), f0, { tone: "paper", position: [0, h / 2, 0], rotation: [0, Math.PI / 8, 0] });
  for (let y = 0.35; y < h - 0.2; y += 0.36) {
    const r = rBot + ((rTop - rBot) * y) / h + 0.012;
    a.add(cylinder(r, r, 0.035, 8, true), f0, { tone: "light", position: [0, y, 0], rotation: [0, Math.PI / 8, 0] });
  }
  [
    [2.2, 0.4],
    [5.2, -1.2],
    [8.0, 2.0],
  ].forEach(([y, phi], i) => {
    const r = (rBot + ((rTop - rBot) * y!) / h) * Math.cos(Math.PI / 8);
    const s = winState(i + 1);
    const snapped = Math.round(phi! / (Math.PI / 4)) * (Math.PI / 4);
    towerWindow(a, Math.sin(snapped) * r, baseH + y!, Math.cos(snapped) * r, snapped, 0.6, 0.85, s.broken, s.lit);
  });
  // Stage at the top of the base.
  const rs = rBase + 1.1;
  a.add(cylinder(rs, rs, 0.14, 8), null, { tone: "light", position: [0, baseH + 0.07, 0], rotation: [0, Math.PI / 8, 0] });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    a.box(null, Math.cos(ang) * (rs - 0.25), baseH + 0.14, Math.sin(ang) * (rs - 0.25), 0.06, 1.0, 0.06, "paper");
  }
  a.add(cylinder(rs - 0.25, rs - 0.25, 0.06, 16, true), null, { tone: "paper", position: [0, baseH + 1.14, 0] });
  // Boat-shaped cap.
  const capY = baseH + h;
  if (c.ruin < 0.35) {
    const cap = lathe(
      [
        [rTop + 0.3, 0],
        [rTop + 0.2, 0.5],
        [rTop * 0.75, 1.5],
        [0.3, 2.2],
        [0, 2.3],
      ],
      16,
    );
    cap.scale(0.9, 1, 1.35);
    a.add(cap, null, { tone: "light", position: [0, capY, 0] });
    fantail(a, null, 0, capY + 1.8, -rTop * 1.35 - 1.5);
    a.add(cylinder(0.28, 0.33, 1.6, 10), null, { tone: "mid", position: [0, capY + 1.0, rTop * 1.2], rotation: [Math.PI / 2 - 0.14, 0, 0] });
    sails(a, [0, capY + 1.1, rTop * 1.35 + 0.8], 0.14, 10.5, 2.2);
  }
}

// ---------------------------------------------------------------------- mill

export function mill(a: Arch, variant: number): void {
  const g = a.rng;
  if (variant === 0) {
    // Four-storey brick flour mill with a stair tower, a hoist lucam over
    // stacked loading doors, an engine house and a tall chimney.
    const bays = 9;
    const bayW = 3.6;
    const w = bays * bayW + 1.2;
    const d = 14;
    const storeys = 4;
    const sh = 3.6;
    const h = storeys * sh + 0.6;
    const front: Opening[] = [];
    const back: Opening[] = [];
    const mid = Math.floor(bays / 2);
    for (let s = 0; s < storeys; s++) {
      for (let b = 0; b < bays; b++) {
        const x = -w / 2 + 0.6 + bayW * (b + 0.5);
        if (b === mid) {
          front.push({ x, y: s === 0 ? 0 : s * sh + 0.35, w: 1.8, h: s === 0 ? 2.9 : 2.3, kind: "door", door: "plank" });
          continue;
        }
        front.push({ x, y: s * sh + 0.95, w: 1.7, h: 2.1, kind: "window", win: "industrial", head: "segment", dress: "arch", grid: [3, 3] });
        back.push({ x, y: s * sh + 0.95, w: 1.6, h: 2.0, kind: "window", win: "industrial", lite: true, grid: [3, 3] });
      }
    }
    const side: Opening[] = [];
    for (let s = 0; s < storeys; s++) for (const x of [-3.2, 0, 3.2]) side.push({ x, y: s * sh + 0.95, w: 1.5, h: 2.0, kind: "window", win: "industrial", lite: true, head: "segment" });
    const b = massing(a, {
      w,
      d,
      h,
      t: 0.6,
      roof: "gable",
      ridge: "x",
      pitch: 24,
      roofTone: "mid",
      roofOpts: { eave: 0.5, verge: 0.2 },
      front,
      back,
      left: side,
      right: side.filter((o) => o.x !== 0),
      bands: [
        { y: 0, h: 0.7, p: 0.08, tone: "light" },
        ...Array.from({ length: storeys - 1 }, (_, i) => ({ y: (i + 1) * sh + 0.5, h: 0.14, p: 0.05 })),
        { y: h - 0.55, h: 0.28, p: 0.14 },
      ],
      label: "mill",
    });
    a.sign(b.faces.front, { kind: "painted", text: "MERIDIAN" }, -w / 4 - 0.6, h - 1.0, w * 0.3, 0.8, 0.01);
    a.sign(b.faces.front, { kind: "painted", text: "FLOUR MILLS" }, w / 4 + 0.6, h - 1.0, w * 0.3, 0.8, 0.01);
    // Lucam: a projecting hoist housing at the top of the loading bay.
    const xm = -w / 2 + 0.6 + bayW * (mid + 0.5);
    if (a.ruin < 0.6) {
      massing(
        a,
        {
          x: xm,
          z: d / 2 + 0.7,
          w: 2.6,
          d: 1.4,
          h: 3.2,
          t: 0.2,
          roof: "gable",
          ridge: "z",
          pitch: 40,
          roofTone: "mid",
          roofOpts: { eave: 0.25, verge: 0.25, gutter: false },
          front: [{ x: 0, y: 0.3, w: 1.4, h: 2.2, kind: "door", door: "plank" }],
          omit: ["back"],
          label: "lucam",
        },
        frame(0, h - 2.2, 0),
      );
      a.beam(null, [xm, h + 1.9, d / 2 + 1.2], [xm, h + 1.9, d / 2 + 2.3], 0.22, 0.25, "light");
      a.rod(null, [xm, h + 1.8, d / 2 + 2.2], [xm, h - 3.8, d / 2 + 2.2], 0.02, "deep", 4);
    }
    // Stair tower rising above the roof at the left end.
    massing(a, {
      x: -w / 2 + 2.6,
      z: -d / 2 + 2.6,
      w: 5,
      d: 5,
      h: h + 4.2,
      t: 0.5,
      roof: "hip",
      pitch: 40,
      roofTone: "mid",
      front: [{ x: 0, y: h + 1.2, w: 1.2, h: 2.0, kind: "window", win: "industrial", head: "round", dress: "arch" }],
      left: [{ x: 0, y: h + 1.2, w: 1.2, h: 2.0, kind: "window", win: "industrial", head: "round", dress: "arch" }],
      right: [{ x: 0, y: h + 1.2, w: 1.2, h: 2.0, kind: "window", win: "industrial", head: "round", dress: "arch" }],
      bands: [{ y: h - 0.55, h: 0.28, p: 0.14 }],
      label: "stair",
    });
    // Engine house and chimney behind the right end.
    const eh = massing(a, {
      x: w / 2 - 4.5,
      z: -d / 2 - 5,
      w: 8,
      d: 10,
      h: 8.5,
      t: 0.55,
      roof: "gable",
      ridge: "z",
      pitch: 30,
      roofTone: "mid",
      left: at([-2.4, 2.4], { y: 2.2, w: 1.7, h: 4.8, kind: "window", win: "industrial", head: "round", dress: "arch" }),
      back: [{ x: 0, y: 2.2, w: 1.8, h: 4.8, kind: "window", win: "industrial", head: "round", dress: "arch" }, { x: 0, y: 9.3, w: 1.1, h: 1.1, kind: "window", win: "plain", head: "round" }],
      omit: ["front"],
      label: "engine",
    });
    void eh;
    chimneyStack(a, w / 2 + 3.5, -d / 2 - 3, g.range(30, 36), 1.9, 1.15);
    return;
  }
  // Watermill: three storeys of stone with an overshot wheel on the gable.
  const w = 13;
  const d = 9;
  const h = 8.6;
  const b = massing(a, {
    w,
    d,
    h,
    t: 0.6,
    roof: "gable",
    ridge: "x",
    pitch: 42,
    roofTone: "mid",
    front: [
      { x: -3.8, y: 0, w: 1.3, h: 2.3, kind: "door", door: "plank", head: "segment", dress: "arch" },
      ...at([-0.6, 3.6], { y: 0.9, w: 1.1, h: 1.4, kind: "window", win: "casement", head: "segment" }),
      ...at([-3.8, -0.6, 3.6], { y: 3.8, w: 1.1, h: 1.3, kind: "window", win: "casement", head: "segment" }),
      ...at([-3.8, 3.6], { y: 6.6, w: 1.0, h: 1.1, kind: "window", win: "casement", head: "segment" }),
      { x: -0.6, y: 6.4, w: 1.3, h: 2.0, kind: "door", door: "plank" },
    ],
    back: at([-3, 1, 4], { y: 3.8, w: 1.0, h: 1.2, kind: "window", win: "casement" }),
    right: [{ x: 1.8, y: 5.2, w: 0.9, h: 1.0, kind: "window", win: "casement" }],
    left: [{ x: 0, y: 3.8, w: 1.0, h: 1.2, kind: "window", win: "casement" }, { x: 0, y: h + 1.4, w: 0.7, h: 0.8, kind: "window", win: "casement" }],
    quoins: true,
    pipes: true,
    courses: { every: 0.4, block: 0.85, indicate: 0.6 },
    label: "watermill",
  });
  a.chimney(b.f, -w / 2 + 0.7, 0, h - 1, b.top + 1.0, 0.9, 0.6, 1);
  // Sack hoist canopy over the upper loading door.
  if (a.ruin < 0.6) {
    const hf = frame(-0.6, 0, 0, 0, b.faces.front);
    a.box(hf, 0, 8.55, 0.7, 1.9, 0.12, 1.5, "light", { rot: [0.2, 0, 0] });
    a.beam(hf, [0, 8.6, 0.1], [0, 8.6, 1.4], 0.18, 0.18, "light");
  }
  // Wheel pit walls, launder on trestles, the wheel itself.
  const wx = w / 2 + 1.0;
  const wr = 3.2;
  const wcY = 2.9;
  for (const sx of [-0.95, 0.95]) a.box(null, wx + sx, 0, 0, 0.35, 1.1, 7.5, "paper");
  const lz = -(wr + 0.2);
  a.box(null, wx, wcY + wr + 0.25, lz * 0.5 - 4, 1.3, 0.55, 8 + Math.abs(lz), "light");
  for (const z of [-4, -7, -10]) for (const sx of [-0.55, 0.55]) a.box(null, wx + sx, 0, z, 0.16, wcY + wr + 0.25, 0.16, "light");
  const k = new Kit();
  const rims = [-0.7, 0.7];
  for (const x of rims) k.add(new THREE.TorusGeometry(wr, 0.09, 4, 28), { tone: "light", position: [x, 0, 0], rotation: [0, Math.PI / 2, 0] });
  for (const x of rims) k.add(new THREE.TorusGeometry(wr * 0.45, 0.07, 4, 16), { tone: "light", position: [x, 0, 0], rotation: [0, Math.PI / 2, 0] });
  const spokes = 8;
  const buckets = 28;
  const brokenWheel = a.ruin > 0.4;
  const gw = a.fork("wheel");
  for (let i = 0; i < spokes; i++) {
    const ang = (i / spokes) * Math.PI * 2;
    for (const x of rims) {
      const m = new THREE.Matrix4().makeRotationX(ang);
      k.add(new THREE.BoxGeometry(0.1, wr, 0.12), { tone: "light", position: [x, wr / 2, 0], matrix: m });
    }
  }
  for (let i = 0; i < buckets; i++) {
    if (brokenWheel && gw.next() < a.ruin * 0.8) continue;
    const ang = (i / buckets) * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationX(ang);
    k.add(new THREE.BoxGeometry(1.5, 0.05, 0.42), { tone: "paper", position: [0, wr - 0.2, 0], rotation: [0.5, 0, 0], matrix: m });
  }
  k.add(cylinder(0.25, 0.25, 2.4, 10), { tone: "mid", rotation: [0, 0, Math.PI / 2] });
  const wheel = a.moving(k, 0.06);
  wheel.position.set(wx, wcY, 0);
  wheel.name = "civic:waterwheel";
  if (!brokenWheel && a.c.abandoned < 0.4 && !a.sealed) a.ticks.push((dt) => (wheel.rotation.x -= dt * 0.35));
}

/** A tall round mill chimney on a square plinth, with a corbelled cap. */
function chimneyStack(a: Arch, x: number, z: number, h: number, rBot: number, rTop: number): void {
  const r = a.ruin;
  let top = h;
  if (r > 0.55) top = h * (1 - smooth(0.55, 1, r) * 0.6);
  a.box(null, x, 0, z, rBot * 2 + 0.8, 4.5, rBot * 2 + 0.8, "paper");
  a.box(null, x, 4.5, z, rBot * 2 + 1.0, 0.3, rBot * 2 + 1.0, "pale");
  const rt = rBot + ((rTop - rBot) * top) / h;
  a.add(cylinder(rt, rBot, top - 4.8, 16), null, { tone: "paper", position: [x, 4.8 + (top - 4.8) / 2, z] });
  if (top < h) return;
  a.add(cylinder(rTop + 0.25, rTop + 0.05, 0.9, 16), null, { tone: "paper", position: [x, h + 0.3, z] });
  a.add(cylinder(rTop + 0.32, rTop + 0.32, 0.25, 16), null, { tone: "light", position: [x, h + 0.85, z] });
  a.add(cylinder(rTop, rTop, 0.02, 16), null, { tone: "solid", position: [x, h + 0.99, z] });
  for (const y of [h * 0.35, h * 0.62]) a.add(cylinder(rBot + ((rTop - rBot) * y) / h + 0.04, rBot + ((rTop - rBot) * y) / h + 0.04, 0.12, 16, true), null, { tone: "light", position: [x, y, z] });
}

// --------------------------------------------------------------- water tower

export function waterTower(a: Arch, variant: number): void {
  const r = a.ruin;
  if (variant === 0) {
    // Riveted steel tank on six braced legs, conical roof, balcony, ladder.
    const legH = 15.5;
    const legs = 6;
    const rb = 3.4;
    const rt = 2.9;
    const tankR = 3.6;
    const tankH = 5.2;
    const gl = a.fork("legs");
    const lean = r > 0.7 ? 0.35 : 0;
    const ends: Array<[number, number, number, number]> = [];
    for (let i = 0; i < legs; i++) {
      const ang = (i / legs) * Math.PI * 2 + Math.PI / 6;
      const bx = Math.cos(ang) * rb;
      const bz = Math.sin(ang) * rb;
      const tx = Math.cos(ang) * rt + lean;
      const tz = Math.sin(ang) * rt;
      ends.push([bx, bz, tx, tz]);
      a.rod(null, [bx, 0, bz], [tx, legH, tz], 0.2, "light", 8);
      a.box(null, bx, 0, bz, 0.8, 0.5, 0.8, "pale");
    }
    for (const lv of [0.26, 0.52, 0.78, 1.0]) {
      for (let i = 0; i < legs; i++) {
        const [ax, az, atx, atz] = ends[i]!;
        const [bx, bz, btx, btz] = ends[(i + 1) % legs]!;
        const p = (x0: number, x1: number, t: number) => x0 + (x1 - x0) * t;
        const y = legH * lv;
        a.rod(null, [p(ax, atx, lv), y, p(az, atz, lv)], [p(bx, btx, lv), y, p(bz, btz, lv)], 0.07, "light", 5);
        if (lv < 1) {
          const l0 = lv - 0.26;
          if (r > 0.3 && gl.next() < r) continue;
          a.rod(null, [p(ax, atx, l0), legH * l0, p(az, atz, l0)], [p(bx, btx, lv), y, p(bz, btz, lv)], 0.028, "mid", 4);
          a.rod(null, [p(bx, btx, l0), legH * l0, p(bz, btz, l0)], [p(ax, atx, lv), y, p(az, atz, lv)], 0.028, "mid", 4);
        }
      }
    }
    a.rod(null, [0, 0, 0], [lean, legH, 0], 0.32, "light", 10);
    if (r > 0.85) {
      a.rubble(null, 4, 3, 4, 3, 0.8, "tank", 1.4);
      return;
    }
    const ty = legH;
    a.add(cylinder(tankR + 1.0, tankR + 1.0, 0.16, 28), null, { tone: "light", position: [lean, ty + 0.08, 0] });
    a.add(lathe(
      [
        [0.3, -1.2],
        [tankR * 0.8, -0.35],
        [tankR, 0.0],
      ],
      24,
    ), null, { tone: "light", position: [lean, ty + 0.16, 0] });
    a.add(cylinder(tankR, tankR, tankH, 28), null, { tone: "paper", position: [lean, ty + 0.16 + tankH / 2, 0] });
    for (let y = 1.2; y < tankH; y += 1.25) a.add(cylinder(tankR + 0.02, tankR + 0.02, 0.05, 28, true), null, { tone: "light", position: [lean, ty + 0.16 + y, 0] });
    a.add(cone(tankR + 0.35, 1.9, 28), null, { tone: "light", position: [lean, ty + 0.16 + tankH + 0.95, 0] });
    a.add(new THREE.SphereGeometry(0.22, 8, 6), null, { tone: "mid", position: [lean, ty + tankH + 2.25, 0] });
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      a.box(null, lean + Math.cos(ang) * (tankR + 0.92), ty + 0.16, Math.sin(ang) * (tankR + 0.92), 0.05, 1.05, 0.05, "paper");
    }
    a.add(cylinder(tankR + 0.92, tankR + 0.92, 0.05, 28, true), null, { tone: "paper", position: [lean, ty + 1.2, 0] });
    // Ladder up one leg to the balcony.
    const [lx, lz, ltx, ltz] = ends[1]!;
    const off = 0.55;
    for (const s of [-0.22, 0.22]) a.rod(null, [lx * (1 + off / rb) + s, 0, lz * (1 + off / rb)], [ltx * (1 + off / rt) + s, ty + 1.0, ltz * (1 + off / rt)], 0.03, "mid", 4);
    for (let y = 0.4; y < ty + 0.9; y += 0.4) {
      const t = y / (ty + 1.0);
      a.cbox(null, lx * (1 + off / rb) + (ltx * (1 + off / rt) - lx * (1 + off / rb)) * t, y, lz * (1 + off / rb) + (ltz * (1 + off / rt) - lz * (1 + off / rb)) * t, 0.46, 0.03, 0.03, "mid");
    }
    // Painted name on the tank.
    const seg = new THREE.CylinderGeometry(tankR + 0.03, tankR + 0.03, 1.3, 20, 1, true, -0.62, 1.24);
    a.sign(frame(lean, ty + 0.16 + tankH * 0.58, 0), { kind: "painted", text: "MERIDIAN" }, 0, 0, 2 * (tankR + 0.03) * 0.62 * 2, 1.3, 0, false, seg);
    return;
  }
  if (variant === 1) {
    // Railway water tower: brick base with blind arches, riveted iron tank.
    const w = 6.4;
    const h = 8.0;
    const blind = (x: number): Opening => ({ x, y: 1.2, w: 1.5, h: 4.9, kind: "window", win: "blind", head: "round", dress: "arch" });
    const b = massing(a, {
      w,
      d: w,
      h,
      t: 0.5,
      roof: "none",
      front: [{ x: 0, y: 0, w: 1.2, h: 2.3, kind: "door", door: "plank", head: "round", dress: "arch" }],
      back: [blind(0)],
      left: [blind(0)],
      right: [blind(0)],
      bands: [{ y: 0, h: 0.6, p: 0.08, tone: "light" }, { y: h - 0.5, h: 0.5, p: 0.18 }],
      quoins: true,
      courses: { every: 0.36, indicate: 0.55 },
      label: "tower",
    });
    void b;
    if (r > 0.6) {
      a.rubble(null, 0, 0, w * 0.4, w * 0.4, 0.8, "tank", 1.4);
      return;
    }
    a.box(null, 0, h, 0, w + 0.3, 0.35, w + 0.3, "light");
    const tw = w + 0.9;
    const th = 3.3;
    a.box(null, 0, h + 0.35, 0, tw, th, tw, "light");
    for (const [fx, fz, rot] of [
      [0, tw / 2, 0],
      [0, -tw / 2, Math.PI],
      [tw / 2, 0, Math.PI / 2],
      [-tw / 2, 0, -Math.PI / 2],
    ] as const) {
      const ff = frame(fx, h + 0.35, fz, rot);
      for (let i = 1; i < 6; i++) a.quad(ff, -tw / 2 + (tw * i) / 6, th / 2, 0.006, 0.035, th, "solid");
      a.quad(ff, 0, th / 2, 0.006, tw, 0.035, "solid");
    }
    a.box(null, 0, h + 0.35 + th, 0, tw + 0.2, 0.18, tw + 0.2, "mid");
    // Ladder and the water crane arm.
    for (const s of [-0.22, 0.22]) a.box(null, -w / 2 - 0.35 + s, 0, 1.5, 0.05, h + th + 0.6, 0.05, "mid");
    for (let y = 0.4; y < h + th + 0.5; y += 0.4) a.box(null, -w / 2 - 0.35, y, 1.5, 0.45, 0.03, 0.03, "mid");
    a.add(cylinder(0.25, 0.3, 3.4, 10), null, { tone: "mid", position: [w / 2 + 2.2, 1.7, 1.5] });
    a.beam(null, [w / 2 + 2.2, 3.2, 1.5], [w / 2 + 4.6, 3.2, 1.5], 0.22, 0.22, "mid");
    a.rod(null, [w / 2 + 4.6, 3.1, 1.5], [w / 2 + 4.8, 1.2, 1.5], 0.12, "deep", 6);
    return;
  }
  // Concrete mushroom tower (1930s): fluted shaft, flared bowl.
  const shaftH = 17;
  a.add(cylinder(1.9, 2.3, shaftH, 16), null, { tone: "paper", position: [0, shaftH / 2, 0] });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    a.beam(null, [Math.cos(ang) * 2.35, 0, Math.sin(ang) * 2.35], [Math.cos(ang) * 1.95, shaftH, Math.sin(ang) * 1.95], 0.3, 0.3, "paper");
  }
  a.box(frame(0, 0, 2.3), 0, 0, 0.05, 1.3, 2.5, 0.3, "deep");
  for (const y of [5, 9, 13]) a.box(frame(0.55, 0, 2.05, 0.25), 0, y, 0.05, 0.35, 1.1, 0.2, a.c.lit > 0.4 ? "pale" : "deep", a.c.lit > 0.4 ? { accent: "amber", amt: 0.9 } : {});
  if (r > 0.7) {
    a.rubble(null, 3, 2, 4, 4, 0.9, "bowl", 1.5);
    return;
  }
  a.add(
    lathe(
      [
        [1.9, 0],
        [3.2, 1.6],
        [5.4, 3.4],
        [5.6, 3.6],
        [5.6, 7.4],
        [5.9, 7.6],
        [5.9, 7.9],
        [2.2, 9.0],
        [0, 9.1],
      ],
      28,
    ),
    null,
    { tone: "paper", position: [0, shaftH, 0] },
  );
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    a.box(frame(Math.cos(ang) * 5.62, 0, Math.sin(ang) * 5.62, Math.PI / 2 - ang), 0, shaftH + 3.9, 0, 0.18, 3.3, 0.06, "pale");
  }
  if (!a.sealed) a.add(cylinder(0.15, 0.15, 2.6, 6), null, { tone: "mid", position: [0, shaftH + 10.3, 0] });
}

// ---------------------------------------------------------------- greenhouse

export function greenhouse(a: Arch, variant: number): void {
  const gr = growthFrom(a);
  const r = a.ruin;
  const g = a.fork("glass");
  const pane = (f: M4, x: number, y: number, w: number, h: number) => {
    // Glass is mostly invisible in a drawing: a few panes catch the light.
    if (r > 0.2 && g.next() < r) return;
    if (g.next() < 0.22) a.quad(f, x, y, 0.01, w - 0.06, h - 0.06, "pale");
  };
  if (variant === 0) {
    // Victorian span glasshouse: dwarf brick wall, glazing bars, ridge
    // lantern and cresting, staging with pots inside.
    const w = 14;
    const d = 6;
    const wall = 0.8;
    const eave = 2.8;
    const pitch = 34;
    const th = (pitch * Math.PI) / 180;
    const rise = (d / 2) * Math.tan(th);
    const bar = 0.62;
    for (const [x, z, bw, bd] of [
      [0, d / 2 - 0.15, w, 0.3],
      [0, -d / 2 + 0.15, w, 0.3],
      [w / 2 - 0.15, 0, 0.3, d - 0.6],
      [-w / 2 + 0.15, 0, 0.3, d - 0.6],
    ] as const) {
      if (x === -w / 2 + 0.15) {
        a.box(null, x, 0, z - 1.4, bw, wall, bd / 2 - 0.5, "pale");
        a.box(null, x, 0, z + 1.4, bw, wall, bd / 2 - 0.5, "pale");
      } else a.box(null, x, 0, z, bw, wall, bd, "pale");
    }
    a.box(null, 0, wall, 0, w + 0.08, 0.08, d + 0.08, "paper");
    const fronts: Array<[M4, number, number]> = [
      [frame(0, 0, d / 2 - 0.05), w, 0],
      [frame(0, 0, -d / 2 + 0.05, Math.PI), w, 0],
      [frame(w / 2 - 0.05, 0, 0, Math.PI / 2), d, rise],
      [frame(-w / 2 + 0.05, 0, 0, -Math.PI / 2), d, rise],
    ];
    const standing = r < 0.75;
    for (const [f, len, ap] of fronts) {
      const n = Math.round(len / bar);
      for (let i = 0; i <= n; i++) {
        const x = -len / 2 + (len * i) / n;
        const top = ap ? eave + ap * (1 - Math.abs(x) / (len / 2)) : eave;
        if (!standing && a.fork(`gb${x}`).next() < 0.6) continue;
        a.box(f, x, wall, 0, 0.05, top - wall, 0.07, "paper");
        if (i < n) pane(f, x + len / n / 2, (wall + eave) / 2, len / n, eave - wall);
      }
      a.box(f, 0, eave - 0.04, 0, len, 0.08, 0.1, "paper");
      a.box(f, 0, wall + 0.85, 0, len, 0.04, 0.06, "paper");
    }
    if (standing) {
      for (const side of [1, -1]) {
        const n = Math.round(w / bar);
        for (let i = 0; i <= n; i++) {
          const x = -w / 2 + (w * i) / n;
          a.beam(null, [x, eave, (side * d) / 2], [x, eave + rise, 0], 0.05, 0.07, "paper");
          if (i < n && g.next() < 0.3 && r < 0.2) {
            const m = new THREE.Matrix4().makeRotationX(side * -(Math.PI / 2 - th));
            m.setPosition(x + w / n / 2, eave + rise / 2 + 0.02, (side * d) / 4);
            a.add(new THREE.PlaneGeometry(w / n - 0.06, d / 2 / Math.cos(th) - 0.1), m, { tone: "pale", rotation: side === 1 ? [0, 0, 0] : [0, Math.PI, 0] });
          }
        }
        a.beam(null, [-w / 2, eave + rise * 0.5, (side * d) / 4], [w / 2, eave + rise * 0.5, (side * d) / 4], 0.05, 0.06, "paper");
      }
      // Ridge lantern with cresting and finials.
      a.box(null, 0, eave + rise - 0.05, 0, w - 1, 0.55, 0.9, "paper");
      a.box(null, 0, eave + rise + 0.5, 0, w - 0.8, 0.08, 1.2, "light");
      for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 0.35) a.box(null, x, eave + rise + 0.58, 0, 0.03, 0.22, 0.03, "mid");
      for (const sx of [-1, 1]) a.add(cone(0.1, 0.6, 6), null, { tone: "mid", position: [(sx * w) / 2, eave + rise + 0.35, 0] });
    }
    // Staging with pots and plants.
    for (const sz of [1, -1]) {
      a.box(null, 0.4, 0.75, sz * (d / 2 - 0.9), w - 2.2, 0.08, 1.1, "light");
      for (let x = -w / 2 + 1.6; x < w / 2 - 0.6; x += 2.4) a.box(null, x, 0, sz * (d / 2 - 0.9), 0.08, 0.75, 0.9, "light");
      for (let x = -w / 2 + 1.5; x < w / 2 - 0.6; x += 0.45) {
        a.add(cylinder(0.12, 0.09, 0.2, 6), null, { tone: "light", position: [x, 0.93, sz * (d / 2 - 0.9)] });
        if (gr.leaves > 0.2 && gr.dead < 0.6) a.add(jitter(new THREE.IcosahedronGeometry(0.2, 0), 0.06, x * 3 + sz), null, { tone: "pale", position: [x, 1.18, sz * (d / 2 - 0.9)], ...(gr.green > 0.05 ? { accent: "leaf" as const, accentAmount: gr.green } : {}) });
      }
    }
    // Door at the left gable.
    if (standing) a.box(frame(-w / 2 + 0.05, 0, 0, -Math.PI / 2), 0, 0, 0, 0.9, 2.2, 0.06, "paper");
    return;
  }
  // Commercial multi-span glasshouse: sawtooth gables toward the front.
  const spans = 3;
  const sw = 6.4;
  const L = 22;
  const gut = 4.0;
  const pitch = 24;
  const th = (pitch * Math.PI) / 180;
  const rise = (sw / 2) * Math.tan(th);
  const W = spans * sw;
  const standing = r < 0.75;
  const step = 1.0;
  for (let s = 0; s < spans; s++) {
    const cx = -W / 2 + sw * (s + 0.5);
    for (const z of [L / 2, -L / 2]) {
      const f = frame(cx, 0, z, z > 0 ? 0 : Math.PI);
      const n = Math.round(sw / step);
      for (let i = 0; i <= n; i++) {
        const x = -sw / 2 + (sw * i) / n;
        const top = gut + rise * (1 - Math.abs(x) / (sw / 2));
        if (!standing && a.fork(`vb${s}${i}${z}`).next() < 0.6) continue;
        a.box(f, x, 0, 0, 0.06, top, 0.08, "paper");
        if (i < n) pane(f, x + sw / n / 2, gut / 2, sw / n, gut);
      }
      a.box(f, 0, 0, 0, sw, 0.5, 0.12, "pale");
      a.box(f, 0, gut - 0.05, 0, sw, 0.1, 0.12, "paper");
      a.beam(f, [-sw / 2, gut, 0.02], [0, gut + rise, 0.02], 0.1, 0.12, "paper");
      a.beam(f, [sw / 2, gut, 0.02], [0, gut + rise, 0.02], 0.1, 0.12, "paper");
    }
    if (standing) {
      a.cbox(null, cx, gut + rise, 0, 0.14, 0.14, L, "paper");
      for (const side of [-1, 1]) {
        const n = Math.round(L / step);
        for (let i = 0; i <= n; i += 2) {
          const z = -L / 2 + (L * i) / n;
          a.beam(null, [cx + (side * sw) / 2, gut, z], [cx, gut + rise, z], 0.04, 0.06, "paper");
        }
      }
    }
  }
  for (const x of [-W / 2, W / 2]) {
    const f = frame(x, 0, 0, x > 0 ? Math.PI / 2 : -Math.PI / 2);
    const n = Math.round(L / step);
    for (let i = 0; i <= n; i++) {
      if (!standing && a.fork(`sb${x}${i}`).next() < 0.6) continue;
      a.box(f, -L / 2 + (L * i) / n, 0, 0, 0.06, gut, 0.08, "paper");
      if (i < n) pane(f, -L / 2 + (L * (i + 0.5)) / n, gut / 2, L / n, gut);
    }
    a.box(f, 0, 0, 0, L, 0.5, 0.12, "pale");
    a.box(f, 0, gut - 0.05, 0, L, 0.12, 0.3, "light");
  }
  for (let s = 1; s < spans; s++) a.box(null, -W / 2 + sw * s, gut - 0.12, 0, 0.35, 0.16, L, "light");
  // Rows of benches with crops.
  for (let row = 0; row < spans * 2; row++) {
    const x = -W / 2 + (sw / 2) * (row + 0.5);
    a.box(null, x, 0.8, 0, 1.4, 0.08, L - 3, "light");
    if (gr.leaves > 0.2 && gr.dead < 0.6) {
      for (let z = -L / 2 + 2; z < L / 2 - 1.5; z += 0.9) {
        a.add(jitter(new THREE.IcosahedronGeometry(0.28, 0), 0.08, z + x), null, { tone: "pale", position: [x + a.fork(`p${z}`).range(-0.3, 0.3), 1.1, z], ...(gr.green > 0.05 ? { accent: "leaf" as const, accentAmount: gr.green } : {}) });
      }
    }
  }
}

// -------------------------------------------------------------------- garden

export function garden(a: Arch, variant: number, compact = false): void {
  const gr = growthFrom(a);
  const g = a.fork(`garden${variant}`);
  const W = compact ? 16 : variant === 0 ? 24 : 26;
  const D = compact ? 12 : variant === 0 ? 17 : 18;
  const r = a.ruin;
  const f0 = frame(0, 0, 0);
  // Boundary: posts and wire, a timber gate at the front.
  if (!compact) {
    const posts: Array<[number, number, number, number]> = [
      [-W / 2, D / 2, -1.2, D / 2],
      [1.2, D / 2, W / 2, D / 2],
      [W / 2, D / 2, W / 2, -D / 2],
      [W / 2, -D / 2, -W / 2, -D / 2],
      [-W / 2, -D / 2, -W / 2, D / 2],
    ];
    for (const [x0, z0, x1, z1] of posts) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.5));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const tilt = r > 0.4 ? a.fork(`fp${x0}${z0}${i}`).range(-0.25, 0.25) : 0;
        a.box(null, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.1, 1.25, 0.1, "light", { rot: [tilt, 0, 0] });
      }
      if (r < 0.5) for (const y of [0.55, 1.05]) a.beam(null, [x0, y, z0], [x1, y, z1], 0.02, 0.02, "mid");
    }
    // Gate.
    const gf = frame(0, 0, D / 2);
    const open = a.c.abandoned > 0.4 || r > 0.3 ? 0.9 : 0;
    const hinge = frame(-1.2, 0, 0, -open, gf);
    a.box(hinge, 1.2, 0.2, 0, 2.3, 0.1, 0.06, "light");
    a.box(hinge, 1.2, 1.05, 0, 2.3, 0.1, 0.06, "light");
    a.cbox(hinge, 1.2, 0.65, 0, 2.5, 0.1, 0.05, "light", { rot: [0, 0, 0.36] });
    for (let i = 0; i <= 4; i++) a.box(hinge, 0.05 + i * 0.55, 0.2, 0, 0.07, 0.95, 0.05, "light");
  }
  // Beds.
  const beds: Array<[number, number, number, number]> = [];
  const cols = compact ? 2 : 3;
  const rows = 2;
  const bw = compact ? 5.2 : 5.6;
  const bd = 1.4;
  for (let cI = 0; cI < cols; cI++) {
    for (let rI = 0; rI < rows * 2; rI++) {
      const x = -W / 2 + 2.2 + cI * (bw + 1.6) + bw / 2;
      const z = -D / 2 + 3.2 + rI * (bd + 1.2);
      if (z > D / 2 - 2.5) continue;
      beds.push([x, z, bw, bd]);
    }
  }
  const kinds = ["cabbage", "leek", "potato"] as const;
  beds.forEach(([x, z, w, d], i) => {
    const f = frame(x, 0, z, 0, f0);
    for (const [bx, bz, bl, bdd] of [
      [0, d / 2, w, 0.05],
      [0, -d / 2, w, 0.05],
      [w / 2, 0, 0.05, d],
      [-w / 2, 0, 0.05, d],
    ] as const)
      a.box(f, bx, 0, bz, bl + 0.05, 0.28, bdd + 0.05, "light");
    const weeds = a.c.abandoned > 0.5 || r > 0.4;
    a.box(f, 0, 0, 0, w - 0.05, 0.24, d - 0.05, weeds ? "light" : "mid");
    if (a.sealed) return;
    if (weeds) {
      for (let k = 0; k < 6; k++) a.add(jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.1, i * 10 + k), f, { tone: "light", position: [g.range(-w / 2, w / 2), 0.35, g.range(-d / 2, d / 2)], scale: [1, 0.6, 1] });
      return;
    }
    const kind = kinds[i % 3]!;
    for (const rz of [-0.4, 0.05, 0.45]) cropRow(a, f, -w / 2 + 0.3, w / 2 - 0.3, rz, kind, g, gr);
  });
  if (a.sealed) return;
  // Bean teepees.
  const tp: Array<[number, number]> = compact ? [[W / 2 - 2, -D / 2 + 2]] : [
    [W / 2 - 2.2, -D / 2 + 2.6],
    [W / 2 - 4.4, -D / 2 + 2.6],
  ];
  for (const [x, z] of tp) {
    if (r > 0.5) continue;
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      a.rod(null, [x + Math.cos(ang) * 0.75, 0, z + Math.sin(ang) * 0.75], [x, 2.4, z], 0.018, "light", 4);
      if (gr.leaves > 0.3 && gr.dead < 0.5)
        for (let j = 0; j < 3; j++) {
          const t = 0.25 + j * 0.25;
          a.add(jitter(new THREE.IcosahedronGeometry(0.16, 0), 0.05, k * 3 + j + x), null, { tone: "pale", position: [x + Math.cos(ang) * 0.75 * (1 - t), 2.4 * t, z + Math.sin(ang) * 0.75 * (1 - t)], ...(gr.green > 0.05 ? { accent: "leaf" as const, accentAmount: gr.green } : {}) });
        }
    }
  }
  // Sunflowers along the back.
  const nSun = compact ? 5 : 9;
  for (let i = 0; i < nSun; i++) {
    const x = -W / 2 + 1.5 + i * ((W * 0.55) / nSun);
    sunflower(a, f0, x, -D / 2 + 0.9 + (i % 2) * 0.3, 2.1 + g.range(0, 0.8), g, gr);
  }
  // Shed with a pent roof, water butt, compost bays, wheelbarrow.
  const sf = frame(W / 2 - 2.2, 0, D / 2 - 2.3, Math.PI);
  const shedOps: Opening[] = [{ x: 0.45, y: 0.05, w: 0.8, h: 1.85, kind: "door", door: "plank" }];
  const side: Opening[] = [{ x: 0, y: 1.0, w: 0.7, h: 0.6, kind: "window", win: "casement", sill: false, reveal: 0.04 }];
  const sh = massing(a, { w: 2.4, d: 1.9, h: 2.0, t: 0.08, tone: "paper", roof: "lean", pitch: 9, roofTone: "mid", roofOpts: { eave: 0.2, verge: 0.15, t: 0.06, gutter: false }, front: shedOps, left: side, label: "shed" }, sf);
  weatherboard(a, sh.faces.front, 2.4, 0, 2.0, shedOps, 0, 0.22, "light");
  weatherboard(a, sh.faces.left, 1.8, 0, 2.0, side, 0, 0.22, "light");
  a.add(cylinder(0.3, 0.28, 0.85, 10), sf, { tone: "light", position: [-1.55, 0.43, 0.6] });
  if (!compact) {
    for (let bI = 0; bI < 2; bI++) {
      const cf = frame(-W / 2 + 1.4 + bI * 1.4, 0, D / 2 - 1.4);
      for (let y = 0.1; y < 1.0; y += 0.22) {
        a.box(cf, 0, y, -0.6, 1.2, 0.12, 0.04, "light");
        a.box(cf, -0.6, y, 0, 0.04, 0.12, 1.2, "light");
        a.box(cf, 0.6, y, 0, 0.04, 0.12, 1.2, "light");
      }
      a.box(cf, 0, 0, 0, 1.1, 0.55, 1.1, "mid");
    }
    // Wheelbarrow.
    const wf = frame(-1.5, 0, D / 2 - 3.5, 0.6);
    a.add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), wf, { tone: "mid", position: [0.9, 0.2, 0], rotation: [Math.PI / 2, 0, 0] });
    a.box(wf, 0.2, 0.35, 0, 1.0, 0.35, 0.65, "light", { rot: [0, 0, 0.08] });
    for (const s of [-0.28, 0.28]) a.beam(wf, [0.9, 0.2, s], [-0.8, 0.6, s * 1.4], 0.04, 0.04, "light");
  }
  if (variant === 1 && !compact) {
    // Polytunnel.
    const pf = frame(-W / 2 + 6, 0, -D / 2 - 3.2, 0);
    polytunnel(a, pf, 10, 5.2, 2.7);
  }
}

function polytunnel(a: Arch, f: M4, L: number, span: number, h: number): void {
  const segs = 10;
  const r = a.ruin;
  const g = a.fork("poly");
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI * (i / segs);
    const a1 = Math.PI * ((i + 1) / segs);
    const p0: V3 = [0, Math.sin(a0) * h, Math.cos(a0) * (span / 2)];
    const p1: V3 = [0, Math.sin(a1) * h, Math.cos(a1) * (span / 2)];
    const hoops = 6;
    for (let k = 0; k <= hoops; k++) {
      const x = -L / 2 + (L * k) / hoops;
      a.beam(f, [x, p0[1], p0[2]], [x, p1[1], p1[2]], 0.05, 0.05, "light");
    }
    if (r > 0.25 && g.next() < r) continue;
    a.beam(f, [0, p0[1] + 0.02, p0[2] * 1.01], [0, p1[1] + 0.02, p1[2] * 1.01], L, 0.02, "paper");
  }
  for (const x of [-L / 2, L / 2]) {
    const ef = frame(x, 0, 0, x > 0 ? Math.PI / 2 : -Math.PI / 2, f);
    const pts: P2[] = [];
    for (let i = 0; i <= segs; i++) pts.push([Math.cos(Math.PI * (i / segs)) * (span / 2), Math.sin(Math.PI * (i / segs)) * h]);
    if (r < 0.5) a.add(shape(pts), ef, { tone: "paper", position: [0, 0, 0.01] });
    a.box(ef, 0, 0, 0.05, 1.0, 1.9, 0.05, "light");
  }
}

// ------------------------------------------------------------------- orchard

export function orchard(a: Arch, variant: number): void {
  const gr = growthFrom(a);
  const g = a.fork(`orchard${variant}`);
  const uniform = gr.uniform;
  if (variant === 2 || (uniform && variant === 0 && false)) {
    // Modern intensive orchard: slender spindle trees trained along wires.
    const rows = 5;
    const len = 30;
    const gap = 3.6;
    for (let rI = 0; rI < rows; rI++) {
      const z = -((rows - 1) * gap) / 2 + rI * gap;
      for (let x = -len / 2; x <= len / 2 + 0.01; x += 5) a.box(null, x, 0, z, 0.1, 3.0, 0.1, "light");
      if (a.ruin < 0.5) for (const y of [0.9, 1.8, 2.7]) a.beam(null, [-len / 2, y, z], [len / 2, y, z], 0.02, 0.02, "mid");
      for (let x = -len / 2 + 0.6; x < len / 2; x += 1.25) {
        if (gr.dead > 0.6 && g.next() < gr.dead - 0.3) continue;
        a.rod(null, [x, 0, z], [x + g.range(-0.05, 0.05), 2.9, z], 0.05, "light", 5);
        if (gr.leaves > 0.25) {
          for (const [y, rr] of [
            [1.15, 0.55],
            [2.2, 0.42],
          ] as const) {
            a.add(jitter(new THREE.IcosahedronGeometry(rr, 0), rr * 0.05, x * 5 + z + y), null, { tone: gr.bloom > 0.55 ? "pale" : "light", position: [x, y, z], scale: [1, 1.1, 0.8] });
          }
        }
      }
    }
    return;
  }
  const rows = variant === 1 ? 3 : 4;
  const cols = 4;
  const sp = variant === 1 ? 6.5 : 5.6;
  const W = (cols - 1) * sp + 6;
  const D = (rows - 1) * sp + 6;
  for (let rI = 0; rI < rows; rI++) {
    for (let cI = 0; cI < cols; cI++) {
      const gt = a.fork(`tree${rI}:${cI}`);
      if (variant === 1 && gt.next() < 0.12) continue;
      const jx = uniform ? 0 : variant === 1 ? gt.range(-0.9, 0.9) : gt.range(-0.15, 0.15);
      const jz = uniform ? 0 : variant === 1 ? gt.range(-0.9, 0.9) : gt.range(-0.15, 0.15);
      const x = -((cols - 1) * sp) / 2 + cI * sp + jx;
      const z = -((rows - 1) * sp) / 2 + rI * sp + jz;
      const scale = uniform ? 1 : variant === 1 ? gt.range(1.0, 1.35) : gt.range(0.88, 1.08);
      fruitTree(a, null, x, z, scale, gt, gr);
      if (variant === 1 && !uniform && gt.next() < 0.3) {
        // Propped limb.
        a.rod(null, [x + 1.6, 0, z + 0.4], [x + 1.1, 2.1, z + 0.2], 0.05, "light", 4);
      }
    }
  }
  if (uniform) return;
  // Post-and-rail fence on three sides and a gate gap.
  const fence: Array<[number, number, number, number]> = [
    [-W / 2, D / 2, -2, D / 2],
    [2, D / 2, W / 2, D / 2],
    [W / 2, D / 2, W / 2, -D / 2],
    [-W / 2, -D / 2, -W / 2, D / 2],
  ];
  for (const [x0, z0, x1, z1] of fence) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      a.box(null, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.14, 1.3, 0.14, "light");
    }
    if (a.ruin < 0.6) for (const y of [0.55, 1.1]) a.beam(null, [x0, y, z0], [x1, y, z1], 0.12, 0.07, "light");
  }
  if (a.sealed) return;
  if (variant === 0) {
    // Picker's tripod ladder and stacked crates.
    const lx = -sp / 2;
    const lz = sp / 2;
    a.beam(null, [lx - 0.4, 0, lz + 1.6], [lx + 0.1, 3.4, lz + 0.3], 0.07, 0.07, "light");
    a.beam(null, [lx + 0.4, 0, lz + 1.6], [lx + 0.1, 3.4, lz + 0.3], 0.07, 0.07, "light");
    a.beam(null, [lx + 0.1, 0, lz - 0.9], [lx + 0.1, 3.4, lz + 0.3], 0.07, 0.07, "light");
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      a.cbox(null, lx + 0.1 * t, 3.4 * t, lz + 1.6 - 1.3 * t, 0.8 * (1 - t) + 0.12, 0.04, 0.05, "light");
    }
    for (let i = 0; i < 5; i++) a.box(null, sp + 1 + (i % 2) * 0.62, Math.floor(i / 2) * 0.32, D / 2 - 1.8, 0.6, 0.3, 0.42, "light");
  } else {
    // Beehives in the corner: tiered white WBC hives on legs.
    for (let i = 0; i < 3; i++) {
      const hf = frame(W / 2 - 1.8 - i * 1.4, 0, -D / 2 + 1.8, 0.1 * i);
      for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) a.box(hf, sx, 0, sz, 0.05, 0.35, 0.05, "light");
      a.box(hf, 0, 0.35, 0, 0.62, 0.16, 0.62, "paper");
      for (let t = 0; t < 3; t++) a.box(hf, 0, 0.51 + t * 0.2, 0, 0.56 - t * 0.02, 0.19, 0.56 - t * 0.02, "paper");
      a.add(gable(0.6, 0.6, 0.22, 0.06), hf, { tone: "light", position: [0, 1.12, 0] });
      a.box(hf, 0, 0.36, 0.3, 0.3, 0.03, 0.08, "deep");
    }
  }
}
