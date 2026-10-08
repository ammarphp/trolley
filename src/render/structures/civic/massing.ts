/**
 * Massing: rectangular building blocks assembled from Arch walls and roofs,
 * plus the common attachments (porches, bays, dormers, lean-tos).
 *
 * A block's gable walls run the full depth and carry the roof pitch in their
 * outline; eave walls sit between them. Everything is in the block frame
 * (origin at base centre, front toward +z).
 */
import type { Tone } from "../../core/geometry.ts";
import { Arch, frame, type Band, type Courses, type M4, type Opening, type RoofResult, type RoofSpec, type P2 } from "./arch.ts";
import { RUIN } from "./condition.ts";

export type Side = "front" | "back" | "left" | "right";

export interface BlockSpec {
  x?: number;
  z?: number;
  rot?: number;
  w: number;
  d: number;
  /** Eave height (wall head). */
  h: number;
  t?: number;
  tone?: Tone;
  roof: "gable" | "hip" | "flat" | "lean" | "none";
  /** Ridge direction for gable/hip roofs. */
  ridge?: "x" | "z";
  pitch?: number;
  roofTone?: Tone;
  roofOpts?: Partial<RoofSpec>;
  /** Parapet height above the flat roof. */
  parapet?: number;
  front?: Opening[];
  back?: Opening[];
  left?: Opening[];
  right?: Opening[];
  bands?: Band[];
  quoins?: boolean;
  /** Walls not to build (they abut another block). */
  omit?: Side[];
  /** Downpipes at the ends of the eave walls. */
  pipes?: boolean;
  /** Masonry coursing on every wall. */
  courses?: Courses;
  label: string;
}

export interface BlockResult {
  f: M4;
  faces: Record<Side, M4>;
  eave: number;
  /** Ridge top (absolute y in block frame), or wall head for flat roofs. */
  top: number;
  roof?: RoofResult;
  w: number;
  d: number;
}

export function massing(a: Arch, s: BlockSpec, parent?: M4): BlockResult {
  const f = frame(s.x ?? 0, 0, s.z ?? 0, s.rot ?? 0, parent);
  const { w, d } = s;
  const t = s.t ?? 0.4;
  const pitch = s.pitch ?? 40;
  const th = (pitch * Math.PI) / 180;
  const ridgeX = (s.ridge ?? (w >= d ? "x" : "z")) === "x";
  const gabled = s.roof === "gable";
  const lean = s.roof === "lean";
  const faces: Record<Side, M4> = {
    front: frame(0, 0, d / 2, 0, f),
    back: frame(0, 0, -d / 2, Math.PI, f),
    right: frame(w / 2, 0, 0, Math.PI / 2, f),
    left: frame(-w / 2, 0, 0, -Math.PI / 2, f),
  };
  const omit = new Set(s.omit ?? []);
  const hWall = s.roof === "flat" ? s.h + (s.parapet ?? 0.7) : s.h;
  const tone = s.tone ?? "paper";
  const bands = s.bands;
  const courses = s.courses;

  // Which walls run full length (they own the corners)?
  const sidesFull = gabled && ridgeX;
  const fbFull = !sidesFull;
  const fbLen = fbFull ? w : w - 2 * t;
  const sideLen = sidesFull ? d : d - 2 * t;
  const gableRiseFB = gabled && !ridgeX ? (w / 2) * Math.tan(th) : undefined;
  const gableRiseSide = gabled && ridgeX ? (d / 2) * Math.tan(th) : undefined;

  const leanRise = lean ? d * Math.tan(th) : 0;
  const leanTop = (sign: 1 | -1): P2[] => {
    // right wall: local x = -z ; left wall: local x = +z
    const hz = (z: number) => s.h + (leanRise * (d / 2 - z)) / d;
    const L = sideLen / 2;
    return sign === 1
      ? [
          [L, hz(-L)],
          [-L, hz(L)],
        ]
      : [
          [L, hz(L)],
          [-L, hz(-L)],
        ];
  };

  if (!omit.has("front"))
    a.wall(faces.front, { len: fbLen, h: hWall, t, apex: gableRiseFB, ops: s.front, bands, courses, ext: fbFull ? undefined : t, tone, label: `${s.label}:front` });
  if (!omit.has("back"))
    a.wall(faces.back, { len: fbLen, h: lean ? hWall + leanRise : hWall, t, apex: gableRiseFB, ops: s.back, bands, courses, ext: fbFull ? undefined : t, tone, label: `${s.label}:back` });
  if (!omit.has("right"))
    a.wall(faces.right, {
      len: sideLen,
      h: hWall,
      t,
      apex: gableRiseSide,
      top: lean ? leanTop(1) : undefined,
      ops: s.right,
      bands,
      courses,
      ext: sidesFull ? undefined : t,
      tone,
      label: `${s.label}:right`,
    });
  if (!omit.has("left"))
    a.wall(faces.left, {
      len: sideLen,
      h: hWall,
      t,
      apex: gableRiseSide,
      top: lean ? leanTop(-1) : undefined,
      ops: s.left,
      bands,
      courses,
      ext: sidesFull ? undefined : t,
      tone,
      label: `${s.label}:left`,
    });

  let roof: RoofResult | undefined;
  let top = hWall;
  const ro = { pitch, tone: s.roofTone ?? "light", label: `${s.label}:roof`, ...(s.roofOpts ?? {}) };
  if (s.roof === "gable" || s.roof === "hip") {
    const hip = s.roof === "hip";
    const along = ridgeX ? w : d;
    const across = ridgeX ? d : w;
    // Hips need the ridge along the longer side.
    const flip = hip && along < across;
    const rx = flip ? !ridgeX : ridgeX;
    const rf = frame(0, s.h, 0, rx ? 0 : Math.PI / 2, f);
    roof = a.roof(rf, rx ? w : d, rx ? d : w, { ...ro, hip });
    top = s.h + roof.top;
  } else if (lean) {
    const rf = frame(0, s.h, 0, 0, f);
    roof = a.leanRoof(rf, w, d, ro);
    top = s.h + roof.top;
  } else if (s.roof === "flat") {
    a.flatRoof(f, w - 2 * t + 0.02, d - 2 * t + 0.02, s.h, { parapetTop: hWall, label: `${s.label}:flat` });
  }
  if (s.quoins) a.quoins(f, w, d, s.h);
  // Debris: the fallen roof and floors inside, spill outside once breached.
  if (a.ruin >= RUIN.gutted) {
    const amt = Math.min(1, 0.35 + (a.ruin - RUIN.gutted) * 2);
    a.rubble(f, 0, 0, Math.max(0.5, w / 2 - t - 0.3), Math.max(0.5, d / 2 - t - 0.3), amt, `${s.label}:in`, Math.min(1.8, s.h * 0.3));
    if (a.ruin >= RUIN.shell) {
      const g = a.fork(`${s.label}:spill`);
      const side = g.int(0, 3);
      const sx = side === 1 ? w / 2 + 1 : side === 3 ? -w / 2 - 1 : g.range(-w / 3, w / 3);
      const sz = side === 0 ? d / 2 + 1 : side === 2 ? -d / 2 - 1 : g.range(-d / 3, d / 3);
      a.rubble(f, sx, sz, side % 2 ? 1.2 : w * 0.3, side % 2 ? d * 0.3 : 1.2, amt * 0.8, `${s.label}:out`, 0.9);
    }
  }
  if (s.pipes && (gabled || s.roof === "hip" || lean) && roof) {
    const eaveOut = roof.eave + 0.15;
    const eaves: Side[] = lean ? ["front"] : ridgeX ? ["front", "back"] : ["left", "right"];
    for (const side of eaves) {
      if (omit.has(side)) continue;
      const len = side === "front" || side === "back" ? w : d;
      a.downpipe(faces[side], len / 2 - 0.3, s.h - 0.1, eaveOut);
    }
  }
  return { f, faces, eave: s.h, top, roof, w, d };
}

/** A small gabled porch on posts or low walls, in a face frame at x. */
export function porch(a: Arch, face: M4, x: number, o: { w?: number; d?: number; h?: number; pitch?: number; closed?: boolean; label: string }): void {
  const w = o.w ?? 2.2;
  const d = o.d ?? 1.6;
  const h = o.h ?? 2.5;
  const pf = frame(x, 0, d / 2, 0, face);
  const r = a.ruin;
  if (o.closed) {
    massing(a, { w, d, h, t: 0.2, roof: "gable", ridge: "z", pitch: o.pitch ?? 42, front: [{ x: 0, y: 0, w: 1.0, h: 2.1, kind: "door", door: "open", fixed: true }], omit: ["back"], label: o.label, roofOpts: { eave: 0.2, verge: 0.2 } }, pf);
    return;
  }
  if (r < RUIN.shell) {
    for (const sx of [-1, 1]) for (const sz of [1, -0.6]) a.box(pf, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.12), 0.14, h, 0.14, "paper");
    // Low side rails.
    for (const sx of [-1, 1]) a.box(pf, sx * (w / 2 - 0.1), 0.85, 0, 0.06, 0.08, d - 0.3, "paper");
    const rf = frame(0, h, 0, Math.PI / 2, pf);
    a.roof(rf, d + 0.1, w, { pitch: o.pitch ?? 42, eave: 0.2, verge: 0.25, t: 0.1, gutter: false, label: `${o.label}:roof`, tone: "light" });
    // Tie beam across the open gable.
    a.box(pf, 0, h - 0.18, d / 2 - 0.12, w, 0.18, 0.12, "paper");
  }
}

/** A canted bay window: centre x on a face frame, projecting `p`. */
export function bay(a: Arch, face: M4, x: number, o: { w?: number; p?: number; h?: number; y?: number; storeys?: number; storeyH?: number; win?: Opening["win"]; label: string }): void {
  const w = o.w ?? 2.4;
  const p = o.p ?? 0.7;
  const storeys = o.storeys ?? 1;
  const sh = o.storeyH ?? 2.9;
  const y0 = o.y ?? 0.45;
  const H = y0 + storeys * sh - 0.2;
  const bf = frame(x, 0, 0, 0, face);
  const front = w - 2 * p;
  const side = Math.hypot(p, p);
  const t = 0.18;
  const ops = (len: number, win: number) => {
    const res: Opening[] = [];
    for (let s = 0; s < storeys; s++) res.push({ x: 0, y: y0 + 0.45 + s * sh, w: win, h: 1.75, kind: "window", win: o.win ?? "sash", dress: "none" });
    void len;
    return res;
  };
  a.wall(frame(0, 0, p, 0, bf), { len: front, h: H, t, ops: ops(front, Math.min(1.25, front - 0.35)), label: `${o.label}:bf` });
  for (const sx of [-1, 1]) {
    const cx = sx * (front / 2 + p / 2);
    const sf = frame(cx, 0, p / 2, (sx * Math.PI) / 4, bf);
    a.wall(sf, { len: side + 0.05, h: H, t, ops: ops(side, Math.min(0.62, side - 0.3)), label: `${o.label}:bs${sx}` });
  }
  // Base plinth and lead roof.
  a.box(bf, 0, 0, p / 2, front + 0.1, y0, p + 0.1, "pale");
  if (a.ruin < RUIN.gutted) {
    a.box(bf, 0, H, p / 2 - 0.02, w + 0.2, 0.18, p + 0.25, "paper");
    a.box(bf, 0, H + 0.18, p / 2 - 0.08, w - 0.1, 0.22, p + 0.02, "mid");
  }
}

/** A gabled dormer standing on a roof slope (roof frame at eave height of the parent, eave line at z = zFace). */
export function dormer(a: Arch, parent: M4, x: number, zFace: number, pitch: number, o: { w?: number; h?: number; setback?: number; label: string }): void {
  if (a.ruin >= RUIN.gutted) return;
  const w = o.w ?? 1.5;
  const h = o.h ?? 1.5;
  const sb = o.setback ?? 0.5;
  const th = (pitch * Math.PI) / 180;
  const y0 = sb * Math.tan(th) + 0.05;
  const depth = (h + 0.5) / Math.tan(th) + 0.4;
  const df = frame(x, y0, zFace - sb - depth / 2, 0, parent);
  massing(
    a,
    {
      w,
      d: depth,
      h,
      t: 0.12,
      roof: "gable",
      ridge: "z",
      pitch: 45,
      front: [{ x: 0, y: 0.15, w: w - 0.5, h: h - 0.3, kind: "window", win: "casement", sill: false, dress: "none", reveal: 0.06 }],
      omit: ["back"],
      roofOpts: { eave: 0.12, verge: 0.12, t: 0.08, gutter: false },
      label: o.label,
    },
    df,
  );
}
