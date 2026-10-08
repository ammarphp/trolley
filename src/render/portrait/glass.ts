/**
 * The mirror glass itself: a convex glint, a faint vignette where the glass
 * curves away, specks of grime, and a fracture that grows with `crack`.
 * Cracks are drawn as a dark line with a bright bevel beside it, so they read
 * as broken glass rather than scribbles; past a threshold the shards between
 * them shift the reflection by a few pixels.
 */
import { createRng, type Rng } from "../core/rng.ts";
import { clamp, lerp } from "./math.ts";

interface CrackLine {
  pts: Array<[number, number]>;
  /** Crack amount at which this line starts and is complete. */
  from: number;
  to: number;
  weight: number;
}

export interface CrackPattern {
  origin: [number, number];
  lines: CrackLine[];
  /** Wedge polygons between primary rays (for shard offsets). */
  shards: Array<{ poly: Array<[number, number]>; dx: number; dy: number; from: number }>;
}

function jagged(rng: Rng, x: number, y: number, ang: number, len: number, step: number, jit: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [[x, y]];
  let a = ang,
    d = 0;
  while (d < len) {
    const s = step * rng.range(0.6, 1.4);
    a += rng.range(-jit, jit);
    x += Math.cos(a) * s;
    y += Math.sin(a) * s;
    d += s;
    pts.push([x, y]);
  }
  return pts;
}

export function makeCrack(seed: number, w: number, h: number): CrackPattern {
  const rng = createRng(seed ^ 0xc4ac);
  const spots: Array<[number, number]> = [
    [0.16, 0.2],
    [0.84, 0.24],
    [0.2, 0.86],
    [0.88, 0.8],
  ];
  const sp = rng.pick(spots);
  const origin: [number, number] = [sp[0] * w + rng.range(-20, 20), sp[1] * h + rng.range(-20, 20)];
  const lines: CrackLine[] = [];
  const rays = 7 + rng.int(0, 3);
  const angles: number[] = [];
  const base = rng.range(0, Math.PI * 2);
  for (let i = 0; i < rays; i++) angles.push(base + (i / rays) * Math.PI * 2 + rng.range(-0.25, 0.25));
  const rayPts: Array<Array<[number, number]>> = [];
  angles.forEach((a, i) => {
    const len = rng.range(0.55, 1.2) * Math.hypot(w, h);
    const pts = jagged(rng, origin[0], origin[1], a, len, 16, 0.22);
    rayPts.push(pts);
    lines.push({ pts, from: (i % 3) * 0.08, to: 0.55 + rng.range(0, 0.4), weight: rng.range(1.0, 1.6) });
    // Branches.
    const nb = rng.int(1, 3);
    for (let b = 0; b < nb; b++) {
      const at = pts[rng.int(2, Math.max(3, pts.length - 2))] ?? pts[pts.length - 1]!;
      const ba = a + rng.range(0.35, 0.8) * (rng.chance(0.5) ? 1 : -1);
      lines.push({ pts: jagged(rng, at[0], at[1], ba, rng.range(40, 150), 12, 0.3), from: 0.35 + rng.range(0, 0.3), to: 0.9, weight: rng.range(0.7, 1.1) });
    }
  });
  // Concentric rings joining neighbouring rays.
  for (const [r, from] of [
    [22, 0.3],
    [52, 0.5],
    [96, 0.72],
  ] as Array<[number, number]>) {
    for (let i = 0; i < rays; i++) {
      if (rng.chance(0.3)) continue;
      const a0 = angles[i]!,
        a1 = angles[(i + 1) % rays]! + (i + 1 === rays ? Math.PI * 2 : 0);
      const pts: Array<[number, number]> = [];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const a = lerp(a0, a1, k / n);
        const rr = r * rng.range(0.85, 1.15);
        pts.push([origin[0] + Math.cos(a) * rr, origin[1] + Math.sin(a) * rr]);
      }
      lines.push({ pts, from, to: from + 0.2, weight: 0.8 });
    }
  }
  // Shards: wedges between alternate rays, shifted slightly.
  const shards: CrackPattern["shards"] = [];
  for (let i = 0; i < rays; i += 2) {
    const A = rayPts[i]!,
      B = rayPts[(i + 1) % rays]!;
    const poly: Array<[number, number]> = [origin, ...A.slice(1), ...B.slice(1).reverse()];
    shards.push({ poly, dx: rng.range(-3, 3), dy: rng.range(-2.5, 2.5), from: 0.6 + rng.range(0, 0.25) });
  }
  return { origin, lines, shards };
}

/** Portion of a polyline (by length fraction). */
function partial(pts: Array<[number, number]>, f: number): Array<[number, number]> {
  if (f >= 1) return pts;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  const target = total * f;
  const out: Array<[number, number]> = [pts[0]!];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!,
      b = pts[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + l >= target) {
      const t = (target - acc) / l;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      break;
    }
    out.push(b);
    acc += l;
  }
  return out;
}

export function drawCracks(ctx: CanvasRenderingContext2D, pat: CrackPattern, crack: number): void {
  if (crack <= 0.001) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pass of [0, 1]) {
    for (const l of pat.lines) {
      const f = clamp((crack - l.from) / Math.max(0.01, l.to - l.from));
      if (f <= 0) continue;
      const pts = partial(l.pts, f);
      if (pts.length < 2) continue;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + (pass ? 1.1 : 0), p[1] + (pass ? 0.9 : 0)) : ctx.moveTo(p[0] + (pass ? 1.1 : 0), p[1] + (pass ? 0.9 : 0))));
      if (pass === 0) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = l.weight * (1.5 + 0.9 * crack);
      } else {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = l.weight * 1.0;
      }
      ctx.stroke();
    }
  }
  // Crushed star at the impact.
  const [ox, oy] = pat.origin;
  const r = 5 + crack * 9;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ox, oy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 0.8;
  const rng = createRng(Math.round(ox * 31 + oy));
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2),
      rr = rng.range(r * 0.3, r * 1.3);
    ctx.beginPath();
    ctx.moveTo(ox + Math.cos(a) * rr * 0.3, oy + Math.sin(a) * rr * 0.3);
    ctx.lineTo(ox + Math.cos(a + 0.2) * rr, oy + Math.sin(a + 0.2) * rr);
    ctx.stroke();
  }
  ctx.restore();
}

/** Convex glass: edge falloff strokes, a glint band, and grime. */
export function drawGlass(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, grime: number): void {
  const rng = createRng(seed ^ 0x61a55);
  ctx.save();
  ctx.lineCap = "round";
  // Glint: a pair of bright diagonal bands across the upper corner of the
  // convex glass, cutting through whatever lines lie beneath.
  ctx.strokeStyle = "#fff";
  for (const [o, lw, len] of [
    [0, 7, 150],
    [16, 2.2, 120],
    [26, 1.1, 90],
  ] as Array<[number, number, number]>) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(12 + o, 12 + len);
    ctx.quadraticCurveTo(22 + o, 30 + o * 0.4, 12 + o + len, 10 + o * 0.2);
    ctx.stroke();
  }
  void clamp;
  void lerp;
  // Grime: specks and a hairline scratch.
  const g = Math.round(12 + grime * 40);
  for (let i = 0; i < g; i++) {
    const x = rng.range(4, w - 4),
      y = rng.range(4, h - 4);
    ctx.beginPath();
    ctx.arc(x, y, rng.range(0.4, 1.1), 0, Math.PI * 2);
    ctx.fillStyle = rng.chance(0.6) ? "#000" : "#fff";
    ctx.fill();
  }
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const sx = rng.range(w * 0.2, w * 0.8),
    sy = rng.range(h * 0.5, h * 0.9);
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(sx + 40, sy - 10, sx + 90, sy - 34);
  ctx.stroke();
  ctx.restore();
}
