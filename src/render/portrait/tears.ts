/**
 * Tears: wet tracks that run from the lower lid down the cheek. Drawn in ink
 * as a thin white line held between two fine black edges (so it glistens
 * against hatching and paper alike), with a bead at its head that runs,
 * pauses, and runs again.
 */
import { Ribbons } from "./engrave.ts";
import { FeaturePen } from "./features.ts";
import { clamp, hash3, smoothstep } from "./math.ts";
import type { Expr } from "./rig.ts";
import type { BustScene } from "./scene.ts";

export interface TearTrack {
  pts: Array<[number, number, boolean]>;
  /** Tears level at which this track appears. */
  from: number;
  period: number;
  phase: number;
}

export function tearTracks(sc: BustScene): TearTrack[] {
  const pen = new FeaturePen(sc, new Ribbons(), new Ribbons());
  pen.tol = 0.4;
  const lm = sc.shape.lm;
  const tracks: TearTrack[] = [];
  // Tears well at the lower lid and run straight down the cheek, bending only
  // where the cheek's form turns them (toward the nasolabial fold).
  const defs: Array<{ s: number; x: number; drift: number; len: number; from: number }> = [
    { s: 1, x: 0.05, drift: -0.25, len: 6.2, from: 0.28 },
    { s: 1, x: -0.75, drift: -0.35, len: 4.6, from: 0.62 },
    { s: -1, x: 0.1, drift: -0.2, len: 5.6, from: 0.45 },
  ];
  for (const d of defs) {
    const ex0 = Math.abs(lm.eyeL[0]) + d.x;
    const y0 = lm.eyeL[1] - 0.95;
    const pts: Array<[number, number, boolean]> = [];
    const n = 70;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = d.s * (ex0 + d.drift * t * t + 0.05 * Math.sin(t * 5 + d.x * 3));
      const y = y0 - d.len * t;
      const p = pen.face(x, y, 0.08);
      pts.push([p.x, p.y, p.vis]);
    }
    tracks.push({ pts, from: d.from, period: 7.5 + d.x * 2 + d.s, phase: (d.x + 1) * 3.1 + d.s });
  }
  return tracks;
}

export function drawTears(ctx: CanvasRenderingContext2D, tracks: TearTrack[], ex: Expr, t: number, dx: number, dy: number, reduced: boolean): void {
  const level = ex.tears;
  if (level < 0.05) return;
  for (const tr of tracks) {
    const a = clamp((level - tr.from) / 0.3);
    if (a <= 0) continue;
    const n = tr.pts.length;
    // Head of the tear: runs in fits and starts along the track.
    const cyc = reduced ? 0.7 : ((t + tr.phase) / tr.period) % 1;
    const run = smoothstep(0, 0.55, cyc) * 0.55 + smoothstep(0.62, 0.95, cyc) * 0.45;
    const reach = Math.max(0.15, Math.min(1, (0.3 + 0.7 * a) * (0.35 + 0.65 * run)));
    const end = Math.floor(reach * (n - 1));
    const dark = new Ribbons();
    const wet = new Ribbons();
    dark.begin();
    wet.begin();
    for (let i = 0; i <= end; i++) {
      const [x, y, v] = tr.pts[i]!;
      if (!v) {
        dark.end();
        wet.end();
        continue;
      }
      const u = i / Math.max(1, end);
      dark.push(x + dx, y + dy, 2.1 + 0.5 * u);
      wet.push(x + dx, y + dy, 1.0 + 0.35 * u);
    }
    dark.end(0.6);
    wet.end(0.6);
    ctx.fillStyle = "#000";
    ctx.fill(dark.path);
    ctx.fillStyle = "#fff";
    ctx.fill(wet.path);
    // Glints travelling slowly down the wet line.
    for (let k = 0; k < 3; k++) {
      const f = (k / 3 + (reduced ? 0 : t * 0.07) + hash3(k, 3) * 0.2) % 1;
      const i = Math.floor(f * end);
      const p = tr.pts[i];
      if (!p || !p[2]) continue;
      ctx.beginPath();
      ctx.arc(p[0] + dx - 0.4, p[1] + dy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // The bead.
    const hp = tr.pts[end];
    if (hp && hp[2]) {
      // A drop: pointed above, full below; dark rim, bright body, a dark
      // refraction crescent at its base and a pin of light.
      const [x, y] = [hp[0] + dx, hp[1] + dy];
      const drop = (r: number, ox = 0, oy = 0) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy - r * 1.9);
        ctx.quadraticCurveTo(x + ox + r * 1.05, y + oy - r * 0.2, x + ox, y + oy + r);
        ctx.quadraticCurveTo(x + ox - r * 1.05, y + oy - r * 0.2, x + ox, y + oy - r * 1.9);
        ctx.fill();
      };
      ctx.fillStyle = "#000";
      drop(2.7, 0, 0.5);
      ctx.fillStyle = "#fff";
      drop(1.9);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(x, y + 1.1, 1.2, 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - 0.6, y - 0.9, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
