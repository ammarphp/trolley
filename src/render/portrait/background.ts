/**
 * What the mirror shows behind the controller: the line running away behind
 * the trolley. Sleepers stream toward the vanishing point, telegraph poles
 * sweep past in front of the face and dwindle behind the head, wires sag
 * between them, and the horizon carries the world's silhouette: hedges and
 * a barn early, pylons and cooling towers later, smoke or a flawless ruled
 * order at the end. Drawn in the same pen language as the figure, lighter.
 *
 * Canvas orientation matches the figure (un-mirrored camera view): the
 * vanishing point sits to the right, behind the head.
 */
import { createRng } from "../core/rng.ts";
import { Ribbons } from "./engrave.ts";
import { clamp, lerp, smoothstep, vnoise1 } from "./math.ts";

export interface MirrorEnv {
  pastoral: number;
  industry: number;
  storm: number;
  ruin: number;
  order: number;
  gloom: number;
  surveillance: number;
}

export const VP_X = 452;
/** Horizon: below the chin, so far land never touches the face's profile. */
export const VP_Y = 400;
const FB = 330;
const CAM_H = 2.6;

interface Silhouette {
  kind: string;
  x: number;
  s: number;
  seed: number;
}

export class MirrorBackground {
  readonly w: number;
  readonly h: number;
  private seed: number;
  private staticLayer: HTMLCanvasElement | null = null;
  private staticKey = "";
  private sil: Silhouette[] = [];

  constructor(seed: number, w: number, h: number) {
    this.seed = seed;
    this.w = w;
    this.h = h;
    const rng = createRng(seed ^ 0xbac);
    const kinds = ["hedge", "tree", "tree", "barn", "pylon", "chimney", "tower", "mast", "block", "smoke", "deadtree", "crane"];
    for (let i = 0; i < 26; i++) {
      this.sil.push({ kind: kinds[i % kinds.length]!, x: rng.range(-40, w + 40), s: rng.range(0.7, 1.3), seed: rng.int(0, 1e6) });
    }
  }

  private px(X: number, Y: number, Z: number): [number, number] {
    return [VP_X + (FB * X) / Z, VP_Y - (FB * (Y - CAM_H)) / Z];
  }

  private pending: { key: string; gen: Generator<void, void>; canvas: HTMLCanvasElement } | null = null;

  /**
   * Sky and horizon, rebuilt only when the environment changes noticeably,
   * in slices (~1 ms per frame) into a fresh canvas that is swapped in when
   * complete. The very first layer is built at once.
   */
  private staticFor(env: MirrorEnv, budgetMs: number): HTMLCanvasElement {
    const key = [env.pastoral, env.industry, env.storm, env.ruin, env.order, env.gloom, env.surveillance].map((v) => Math.round(v * 8)).join(",");
    if (this.staticLayer && key === this.staticKey && !this.pending) return this.staticLayer;
    if (!this.pending || this.pending.key !== key) {
      if (this.staticLayer && key === this.staticKey) {
        this.pending = null;
        return this.staticLayer;
      }
      const canvas = document.createElement("canvas");
      canvas.width = this.w;
      canvas.height = this.h;
      this.pending = { key, canvas, gen: this.buildStatic(env, canvas) };
    }
    const deadline = this.staticLayer ? performance.now() + budgetMs : Infinity;
    const p = this.pending;
    while (performance.now() < deadline) {
      if (p.gen.next().done) {
        this.staticLayer = p.canvas;
        this.staticKey = p.key;
        this.pending = null;
        break;
      }
    }
    return this.staticLayer ?? p.canvas;
  }

  private *buildStatic(env: MirrorEnv, cv: HTMLCanvasElement): Generator<void, void> {
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, this.w, this.h);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, this.w, this.h);
    g.lineCap = "round";
    const rng = createRng(this.seed ^ 0x5c1);
    // Engraved sky: evenly ruled horizontal lines, heavier overhead and fading
    // to hairlines at the bright horizon; clouds are reserved in white, their
    // bellies shaded. Weather and gloom darken the whole ruling.
    const dark = clamp(env.gloom * 0.75 + env.storm * 0.7);
    type Cloud = { x: number; y: number; rx: number; ryT: number; ryB: number; seed: number };
    const clouds: Cloud[] = [];
    const nc = 4 + Math.round(env.storm * 3);
    for (let c = 0; c < nc; c++) {
      const y = rng.range(40, VP_Y - 60);
      const per = 0.45 + (y / VP_Y) * 0.8;
      const rx = rng.range(55, 130) * per * (1 + env.storm * 0.6);
      clouds.push({ x: rng.range(-40, this.w + 40), y, rx, ryT: rx * rng.range(0.22, 0.34), ryB: rx * 0.07, seed: rng.int(0, 9999) });
    }
    const cloudAt = (x: number, y: number): { m: number; belly: number } => {
      let m = 0,
        belly = 0;
      for (const c of clouds) {
        const dx = (x - c.x) / c.rx;
        const dy = (y - c.y) / (y < c.y ? c.ryT : c.ryB);
        const wob = 0.12 * Math.sin(dx * 9 + c.seed) + 0.08 * Math.sin(dx * 23 + c.seed * 0.3);
        const d = Math.sqrt(dx * dx + dy * dy) - wob;
        m = Math.max(m, smoothstep(1.0, 0.72, d));
        if (y >= c.y - c.ryT * 0.35 && y < c.y + c.ryB * 2) belly = Math.max(belly, smoothstep(1.05, 0.5, Math.abs(dx)) * smoothstep(-0.4, 0.4, dy + 0.3));
      }
      return { m, belly };
    };
    const sky = new Ribbons();
    const spacing = 3.7;
    let row = 0;
    for (let y = 3; y < VP_Y - 2; y += spacing) {
      if (++row % 12 === 0) yield;
      const f = y / VP_Y; // 0 top .. 1 horizon
      const base = lerp(0.95, 0.12, Math.pow(f, 0.8)) * (0.35 + 0.65 * dark) + dark * 0.55 * (1 - f * 0.4);
      sky.begin();
      for (let x = -2; x <= this.w + 2; x += 2.5) {
        const { m, belly } = cloudAt(x, y);
        let w = base * (1 - m) + (env.storm > 0.2 ? m * env.storm * 1.1 : 0) + belly * (0.55 + env.storm * 0.6) * (1 - dark * 0.3);
        w *= 0.85 + 0.3 * vnoise1(x * 0.02 + y * 0.37, this.seed);
        if (w < 0.25) {
          sky.end(0.6);
          continue;
        }
        sky.push(x, y + 0.4 * vnoise1(x * 0.01, y), Math.min(w, 2.6));
      }
      sky.end(0.6);
    }
    yield;
    g.fillStyle = "#000";
    g.fill(sky.path);
    yield;
    g.strokeStyle = "#000";
    // Horizon line and far land.
    g.lineWidth = 1.1;
    g.beginPath();
    for (let x = 0; x <= this.w; x += 4) {
      const y = VP_Y - 1.5 - 3 * env.pastoral * (0.5 + 0.5 * Math.sin(x * 0.02 + 1.3)) * (1 - env.order);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    for (const s of this.sil) this.silhouette(g, s, env);
  }

  private silhouette(g: CanvasRenderingContext2D, s: Silhouette, env: MirrorEnv): void {
    const r = createRng(s.seed);
    const base = VP_Y - 1;
    const sc = s.s * (0.8 + 0.4 * Math.abs(s.x - VP_X) / this.w);
    // Weight each kind by the world's state.
    const weight: Record<string, number> = {
      hedge: env.pastoral * (1 - env.ruin),
      tree: env.pastoral * (1 - env.ruin) * (1 - env.order),
      barn: env.pastoral * (1 - env.industry),
      pylon: env.industry,
      chimney: env.industry * (1 - env.order),
      tower: env.industry * 0.8,
      crane: env.industry * 0.6,
      mast: env.surveillance,
      block: env.order,
      smoke: env.ruin,
      deadtree: env.ruin,
    };
    const wgt = weight[s.kind] ?? 0;
    if (r.next() > wgt) return;
    let x = s.x;
    if (env.order > 0.5) x = Math.round(x / 48) * 48 + 8; // ruled into a grid
    g.strokeStyle = "#000";
    g.fillStyle = "#000";
    g.lineWidth = 0.9;
    switch (s.kind) {
      case "hedge": {
        // A low hedgerow: a scalloped top edge and a few vertical strokes of shade.
        const w = 22 * sc;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x - w, base);
        for (let i = 0; i <= 10; i++) g.lineTo(x - w + (2 * w * i) / 10, base - 2.5 * sc - r.range(0, 2.2) * sc);
        g.lineTo(x + w, base);
        g.stroke();
        g.lineWidth = 0.6;
        for (let i = 0; i < 12; i++) {
          const hx = x - w + r.range(0, 2 * w);
          g.beginPath();
          g.moveTo(hx, base);
          g.lineTo(hx + 0.5, base - 2 * sc);
          g.stroke();
        }
        break;
      }
      case "tree": {
        const h = 16 * sc;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - h * 0.5);
        g.stroke();
        g.beginPath();
        g.ellipse(x, base - h * 0.72, h * 0.34, h * 0.36, 0, 0, Math.PI * 2);
        g.fillStyle = "#fff";
        g.fill();
        g.stroke();
        g.save();
        g.clip();
        g.lineWidth = 0.8;
        for (let k = -10; k < 10; k += 2.2) {
          g.beginPath();
          g.moveTo(x + k + 4, base - h);
          g.lineTo(x + k + 10, base - h * 0.4);
          g.stroke();
        }
        g.restore();
        break;
      }
      case "barn": {
        const w = 14 * sc,
          h = 9 * sc;
        g.beginPath();
        g.moveTo(x - w / 2, base);
        g.lineTo(x - w / 2, base - h);
        g.lineTo(x, base - h * 1.6);
        g.lineTo(x + w / 2, base - h);
        g.lineTo(x + w / 2, base);
        g.fillStyle = "#fff";
        g.fill();
        g.stroke();
        g.fillStyle = "#000";
        g.fillRect(x - 2 * sc, base - h * 0.55, 4 * sc, h * 0.55);
        break;
      }
      case "pylon": {
        const h = 30 * sc;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x - 4 * sc, base);
        g.lineTo(x - 1 * sc, base - h);
        g.lineTo(x + 1 * sc, base - h);
        g.lineTo(x + 4 * sc, base);
        for (let k = 1; k < 5; k++) {
          const y = base - (h * k) / 5;
          const hw = lerp(4, 1, k / 5) * sc;
          g.moveTo(x - hw, y);
          g.lineTo(x + hw, y - h / 5);
          g.moveTo(x + hw, y);
          g.lineTo(x - hw, y - h / 5);
        }
        g.moveTo(x - 7 * sc, base - h * 0.78);
        g.lineTo(x + 7 * sc, base - h * 0.78);
        g.moveTo(x - 5 * sc, base - h * 0.62);
        g.lineTo(x + 5 * sc, base - h * 0.62);
        g.stroke();
        break;
      }
      case "chimney": {
        const h = 34 * sc;
        g.fillRect(x - 1.6 * sc, base - h, 3.2 * sc, h);
        g.lineWidth = 0.8;
        g.beginPath();
        let yy = base - h;
        for (let k = 0; k < 8; k++) {
          const nx = x + k * 5 + vnoise1(k * 0.7, s.seed) * 4;
          g.lineTo(nx, (yy -= 3));
        }
        g.stroke();
        break;
      }
      case "tower": {
        const h = 30 * sc,
          wb = 14 * sc,
          wt = 9 * sc,
          wm = 7 * sc;
        g.beginPath();
        g.moveTo(x - wb, base);
        g.quadraticCurveTo(x - wm, base - h * 0.6, x - wt, base - h);
        g.lineTo(x + wt, base - h);
        g.quadraticCurveTo(x + wm, base - h * 0.6, x + wb, base);
        g.closePath();
        g.fillStyle = "#fff";
        g.fill();
        g.stroke();
        g.save();
        g.clip();
        g.lineWidth = 0.8;
        for (let k = 0; k < 8; k++) {
          g.beginPath();
          g.moveTo(x + wt * 0.2 + k * 1.8, base);
          g.lineTo(x + wt * 0.2 + k * 1.8, base - h);
          g.stroke();
        }
        g.restore();
        // Plume.
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          g.lineTo(x + t * 30 * sc + Math.sin(t * 5) * 3, base - h - 4 - t * 16 * sc);
        }
        g.stroke();
        break;
      }
      case "crane": {
        const h = 36 * sc;
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - h);
        g.lineTo(x + 26 * sc, base - h + 2);
        g.moveTo(x - 8 * sc, base - h + 2);
        g.lineTo(x, base - h);
        g.moveTo(x + 20 * sc, base - h + 2);
        g.lineTo(x + 20 * sc, base - h * 0.55);
        g.stroke();
        break;
      }
      case "mast": {
        const h = 40 * sc;
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - h);
        g.moveTo(x - 3, base - h + 4);
        g.lineTo(x + 3, base - h + 4);
        g.stroke();
        g.beginPath();
        g.arc(x, base - h, 1.6, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "block": {
        const w = 12,
          h = 16;
        for (let k = 0; k < 3; k++) {
          const bx = x + k * 14;
          g.fillStyle = "#fff";
          g.fillRect(bx, base - h, w, h);
          g.strokeRect(bx, base - h, w, h);
          g.lineWidth = 0.7;
          for (let yy = base - h + 3; yy < base; yy += 3) {
            g.beginPath();
            g.moveTo(bx + 2, yy);
            g.lineTo(bx + w - 2, yy);
            g.stroke();
          }
        }
        break;
      }
      case "smoke": {
        g.lineWidth = 1.1;
        for (let strand = 0; strand < 3; strand++) {
          g.beginPath();
          for (let k = 0; k <= 16; k++) {
            const t = k / 16;
            const px = x + strand * 3 + Math.sin(t * 6 + strand + s.seed) * (4 + t * 10) + t * 20;
            const py = base - t * 80 * sc;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.stroke();
        }
        break;
      }
      case "deadtree": {
        const h = 18 * sc;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x + 1, base - h);
        g.moveTo(x + 0.5, base - h * 0.55);
        g.lineTo(x - 5, base - h * 0.85);
        g.moveTo(x + 0.8, base - h * 0.7);
        g.lineTo(x + 6, base - h * 0.95);
        g.stroke();
        break;
      }
    }
  }

  /**
   * Draw the background. `dist` is metres travelled (monotonic);
   * `motion` scales animated jitter (0 in reduced motion).
   */
  draw(ctx: CanvasRenderingContext2D, dist: number, t: number, env: MirrorEnv, motion: number): void {
    ctx.drawImage(this.staticFor(env, 1.2), 0, 0);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    // Ground: ballast shoulder texture and field furrows converging on the VP.
    const ground = new Path2D();
    for (let k = 0; k < 7; k++) {
      const X = 5.5 + k * 3.2 + k * k * 0.9;
      const [x0, y0] = this.px(X, 0, 6);
      const [x1, y1] = this.px(X, 0, 300);
      ground.moveTo(x0, y0);
      ground.lineTo(x1, y1);
    }
    // Ballast shoulder ticks that stream with the sleepers.
    const tick = dist % 1.3;
    for (let k = 0; k < 60; k++) {
      const Z = 1.5 + k * 1.3 + tick;
      const X = -2.95 + ((k * 7) % 5) * 0.12;
      const [x0, y0] = this.px(X, 0.02, Z);
      if (y0 < VP_Y + 1) break;
      ground.moveTo(x0, y0);
      ground.lineTo(x0 - 60 / Z, y0 + 12 / Z);
    }
    ctx.lineWidth = 0.55;
    ctx.stroke(ground);
    // Two tracks: ours (under the car, emerging from behind the figure) and the
    // adjacent line; sleepers stream away as the trolley runs.
    const gauge = 0.7175;
    const tracks = [-1.3, 2.9];
    const rails = new Path2D();
    const sleepers = new Path2D();
    for (const tx of tracks) {
      for (const side of [-1, 1]) {
        const [x0, y0] = this.px(tx + side * gauge, 0.15, 1.2);
        const [x1, y1] = this.px(tx + side * gauge, 0.15, 900);
        rails.moveTo(x0, y0);
        rails.lineTo(x1, y1);
      }
      const spacing = 0.65;
      const off = dist % spacing;
      for (let k = 0; k < 180; k++) {
        const Z = 1.2 + k * spacing + off;
        const w = 1.25;
        const [a0, b0] = this.px(tx - w, 0.05, Z);
        const [a1, b1] = this.px(tx + w, 0.05, Z);
        if (b0 < VP_Y + 1.2) break;
        sleepers.moveTo(a0, b0);
        sleepers.lineTo(a1, b1);
      }
    }
    ctx.lineWidth = 1.5;
    ctx.stroke(rails);
    ctx.lineWidth = 1.0;
    ctx.stroke(sleepers);
    // Telegraph poles on the inboard side, sweeping past in front of the face.
    const poleX = -6.8,
      poleH = 7.2,
      span = 42;
    const poleOff = dist % span;
    const poles: Array<{ x: number; top: number; bot: number; Z: number }> = [];
    for (let k = 0; k < 14; k++) {
      const Z = 3.2 + k * span + poleOff;
      const [x, top] = this.px(poleX, poleH, Z);
      const [, bot] = this.px(poleX, 0, Z);
      poles.push({ x, top, bot, Z });
    }
    const polePath = new Path2D();
    const wires = new Path2D();
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i]!;
      const wpx = clamp(90 / p.Z, 0.8, 9);
      ctx.lineWidth = wpx;
      ctx.beginPath();
      ctx.moveTo(p.x, p.bot);
      ctx.lineTo(p.x, p.top);
      ctx.stroke();
      // Crossarm with insulators.
      const arm = (1.1 * FB) / p.Z;
      polePath.moveTo(p.x - arm, p.top + (0.35 * FB) / p.Z);
      polePath.lineTo(p.x + arm, p.top + (0.35 * FB) / p.Z);
      // Wires to the next pole: sagging catenaries.
      const q = poles[i + 1];
      if (q) {
        for (const dx of [-0.9, 0.9]) {
          const ax = p.x + (dx * FB) / p.Z,
            ay = p.top + (0.3 * FB) / p.Z;
          const bx = q.x + (dx * FB) / q.Z,
            by = q.top + (0.3 * FB) / q.Z;
          const sag = (0.9 * FB) / ((p.Z + q.Z) / 2);
          wires.moveTo(ax, ay);
          wires.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
        }
      }
    }
    ctx.lineWidth = 1.2;
    ctx.stroke(polePath);
    ctx.lineWidth = 0.8;
    ctx.stroke(wires);
    // Rain in storm: short slanted streaks that move.
    if (env.storm > 0.15) {
      const rng = createRng((Math.floor(t * 12) * 7919) ^ this.seed);
      const n = Math.round(env.storm * 160);
      const rain = new Path2D();
      for (let i = 0; i < n; i++) {
        const x = rng.range(-20, this.w),
          y = rng.range(0, VP_Y + 40);
        const l = rng.range(6, 16);
        rain.moveTo(x, y);
        rain.lineTo(x + l * 0.35, y + l);
      }
      ctx.lineWidth = 0.7;
      ctx.stroke(rain);
    }
    void motion;
    void smoothstep;
    ctx.restore();
  }
}
