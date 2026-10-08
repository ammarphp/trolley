/**
 * The eyes, drawn every frame over the cached figure: 3D eyeballs whose
 * iris, pupil and catch-light follow the gaze, framed by lid margins that
 * blink, droop, widen and narrow with the expression. The lash line is the
 * single most expressive stroke on the face; it gets the heaviest ink.
 *
 * Each eye is clipped by its aperture (the lids) and by a visibility mask
 * computed from the depth buffer, so the nose bridge can hide the far eye's
 * inner corner exactly as it hides everything else.
 */
import { clamp, cross, lerp, m3Apply, m3Transpose, norm, posePoint, project, smoothstep, type V3 } from "./math.ts";
import { Ribbons } from "./engrave.ts";
import type { BustScene } from "./scene.ts";

export interface EyeFrame {
  /** 0 open .. 1 closed. */
  blink: number;
  /** Gaze yaw/pitch offsets (radians) from straight ahead, head-independent. */
  yaw: number;
  pitch: number;
  /** 0..1 how much the eyes look at the viewer (the mirror). */
  atViewer: number;
  /** Tear track progress 0..1 per eye. */
  tears: number;
  /** Seconds, for glints. */
  t: number;
  /** Extra lid droop 0..1 (fatigue flutter, dissociation). */
  droop: number;
  /** Afterimage: 0 normal .. 1 eyes reduced to marks. */
  after: number;
}

interface EyeRig {
  side: number;
  center: V3;
  r: number;
  inAz: number;
  outAz: number;
  inEl: number;
  outEl: number;
  bbox: [number, number, number, number];
  mask: HTMLCanvasElement | null;
  scratch: HTMLCanvasElement | null;
  /** Light level on the lids (sampled once from the head grid). */
  lit: number;
}

const tmp = new Float32Array(3);
/** Eye stroke weight: the mirror is small; the lids must carry at 1/3 scale. */
const EYE_W = 1.4;

/** The little of the scene the eyes need each frame (the rest can be freed). */
type EyeScene = Pick<BustScene, "headPose" | "cam" | "ex" | "id" | "light" | "w" | "h">;

export class EyeSystem {
  private sc: EyeScene;
  private rigs: EyeRig[] = [];
  private rInv: ReturnType<typeof m3Transpose>;

  constructor(full: BustScene) {
    const sc = full;
    this.sc = { headPose: full.headPose, cam: full.cam, ex: full.ex, id: full.id, light: full.light, w: full.w, h: full.h };
    this.rInv = m3Transpose(sc.headPose.r);
    const lm = sc.shape.lm;
    const tilt = (sc.id.eyeTilt * Math.PI) / 180;
    for (const side of [1, -1]) {
      const c = side > 0 ? lm.eyeL : lm.eyeR;
      const rig: EyeRig = {
        side,
        center: c,
        r: lm.eyeRadius,
        inAz: -1.02,
        outAz: 1.18,
        inEl: -0.06 - tilt * 0.3,
        outEl: 0.02 + tilt * 0.7,
        bbox: [0, 0, 0, 0],
        mask: null,
        scratch: null,
        lit: sampleLit(sc, posePoint(sc.headPose, c)),
      };
      this.rigs.push(rig);
      this.buildMask(rig, full);
    }
  }

  /** Head-local point on the lid sphere at (azimuth, elevation). */
  private lidPoint(rig: EyeRig, az: number, el: number, rOff = 0.12): V3 {
    const r = rig.r + rOff;
    const ce = Math.cos(el);
    return [rig.center[0] + rig.side * Math.sin(az) * ce * r, rig.center[1] + Math.sin(el) * r, rig.center[2] + Math.cos(az) * ce * r];
  }

  private screen(p: V3, dx = 0, dy = 0): [number, number, number] {
    const q = posePoint(this.sc.headPose, p);
    project(this.sc.cam, q[0], q[1], q[2], tmp, 0);
    return [tmp[0]! + dx, tmp[1]! + dy, tmp[2]!];
  }

  /** Upper and lower lid elevations at lid parameter s (0 inner .. 1 outer). */
  private lids(rig: EyeRig, s: number, f: EyeFrame, gazePitch: number): { up: number; lo: number } {
    const ex = this.sc.ex;
    const base = lerp(rig.inEl, rig.outEl, s);
    // Looking into the mirror, the lids lift: late in the game this is the stare.
    const look = smoothstep(0, 1, f.atViewer);
    const openU = clamp(ex.lidUpper - f.droop * 0.35 * (1 - look) + look * (0.1 + 0.28 * ex.dissoc + 0.12 * ex.fatigue), 0.3, 1.5);
    let hu = 0.46 * openU * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.86)), 0.9);
    // Grief: the inner lid lifts with the brow, the outer corner falls.
    hu += ex.grief * (1 - ex.dissoc * 0.5) * (0.1 * (1 - s) - 0.08 * s) * Math.sin(Math.PI * s);
    hu += 0.55 * gazePitch * Math.sin(Math.PI * s);
    const hl = 0.43 * (1 - 0.42 * ex.lidLower) * Math.pow(Math.sin(Math.PI * Math.pow(s, 1.12)), 1.0) - 0.25 * Math.min(0, gazePitch) * Math.sin(Math.PI * s);
    let up = base + hu;
    const lo = base - hl;
    // Blink: the upper lid falls to meet the lower one just above it.
    const closed = lo + 0.06 * Math.sin(Math.PI * s);
    up = lerp(up, closed, clamp(f.blink));
    return { up, lo: Math.min(lo, up - 0.001) };
  }

  /** Maximum aperture bounding box and the depth-visibility mask. */
  private buildMask(rig: EyeRig, sc: BustScene): void {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const s = i / 20;
      const az = lerp(rig.inAz, rig.outAz, s);
      for (const el of [0.75, -0.7, 0]) {
        const [x, y] = this.screen(this.lidPoint(rig, az * 1.05, el));
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    const pad = 6;
    const bx = Math.max(0, Math.floor(x0 - pad)),
      by = Math.max(0, Math.floor(y0 - pad));
    const bw = Math.min(sc.w - bx, Math.ceil(x1 - x0 + pad * 2)),
      bh = Math.min(sc.h - by, Math.ceil(y1 - y0 + pad * 2));
    rig.bbox = [bx, by, Math.max(1, bw), Math.max(1, bh)];
    if (typeof document === "undefined") return;
    const mask = document.createElement("canvas");
    mask.width = rig.bbox[2];
    mask.height = rig.bbox[3];
    const g = mask.getContext("2d")!;
    const img = g.createImageData(mask.width, mask.height);
    const cam = sc.cam;
    const cw = posePoint(sc.headPose, rig.center);
    const R = rig.r + 0.16;
    for (let j = 0; j < mask.height; j++)
      for (let i = 0; i < mask.width; i++) {
        const px = bx + i + 0.5,
          py = by + j + 0.5;
        const u = (px - cam.cx) / cam.f,
          v = -(py - cam.cy) / cam.f;
        const d = norm([cam.fwd[0] + u * cam.right[0] + v * cam.up[0], cam.fwd[1] + u * cam.right[1] + v * cam.up[1], cam.fwd[2] + u * cam.right[2] + v * cam.up[2]]);
        const oc: V3 = [cam.pos[0] - cw[0], cam.pos[1] - cw[1], cam.pos[2] - cw[2]];
        const b = oc[0] * d[0] + oc[1] * d[1] + oc[2] * d[2];
        const c = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - R * R;
        const disc = b * b - c;
        let a = 0;
        if (disc > 0) {
          const t = -b - Math.sqrt(disc);
          const depth = t * (d[0] * cam.fwd[0] + d[1] * cam.fwd[1] + d[2] * cam.fwd[2]);
          const zb = sc.zbuf.depth[Math.floor(py) * sc.w + Math.floor(px)]!;
          if (depth <= zb + 0.45) a = 255;
        }
        img.data[(j * mask.width + i) * 4 + 3] = a;
      }
    g.putImageData(img, 0, 0);
    rig.mask = mask;
    rig.scratch = document.createElement("canvas");
    rig.scratch.width = mask.width;
    rig.scratch.height = mask.height;
  }

  /** Gaze direction (head-local) for one eye. */
  private gaze(rig: EyeRig, f: EyeFrame): V3 {
    // Straight ahead in the bust frame (the line), brought into head space.
    const yaw = f.yaw,
      pitch = f.pitch;
    const ahead: V3 = norm([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]);
    const aheadHead = m3Apply(this.rInv, ahead);
    // Toward the mirror (the viewer).
    const eyeW = posePoint(this.sc.headPose, rig.center);
    const toCamW = norm([this.sc.cam.pos[0] - eyeW[0], this.sc.cam.pos[1] - eyeW[1], this.sc.cam.pos[2] - eyeW[2]]);
    const toCam = m3Apply(this.rInv, toCamW);
    const k = smoothstep(0, 1, f.atViewer);
    return norm([lerp(aheadHead[0], toCam[0], k), lerp(aheadHead[1], toCam[1], k), lerp(aheadHead[2], toCam[2], k)]);
  }

  draw(ctx: CanvasRenderingContext2D, f: EyeFrame, dx = 0, dy = 0): void {
    for (const rig of this.rigs) this.drawEye(ctx, rig, f, dx, dy);
  }

  private drawEye(ctx: CanvasRenderingContext2D, rig: EyeRig, f: EyeFrame, dx: number, dy: number): void {
    if (!rig.mask || !rig.scratch) return;
    const sc = this.sc;
    const ex = sc.ex;
    const [bx, by, bw, bh] = rig.bbox;
    const g = rig.scratch.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, bw, bh);
    g.setTransform(1, 0, 0, 1, -bx, -by);

    const gz = this.gaze(rig, f);
    const gazePitch = Math.asin(clamp(gz[1], -1, 1));
    // Aperture outline.
    const N = 22;
    const upper: Array<[number, number, number]> = [];
    const lower: Array<[number, number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const az = lerp(rig.inAz, rig.outAz, s);
      const { up, lo } = this.lids(rig, s, f, gazePitch);
      upper.push(this.screen(this.lidPoint(rig, az, up, 0.1), 0, 0));
      lower.push(this.screen(this.lidPoint(rig, az, lo, 0.1), 0, 0));
    }
    const open = f.blink < 0.97;
    const nearSide = rig.side > 0;
    const light = sc.light;
    // Local light at the eye: sample the lid mound's shading.
    const eyeW = posePoint(sc.headPose, rig.center);
    const shadowed = 1 - rig.lit;

    if (open) {
      g.save();
      g.beginPath();
      g.moveTo(upper[0]![0], upper[0]![1]);
      for (const p of upper) g.lineTo(p[0], p[1]);
      for (let i = lower.length - 1; i >= 0; i--) g.lineTo(lower[i]![0], lower[i]![1]);
      g.closePath();
      g.fillStyle = "#fff";
      g.fill();
      g.clip();
      const ink = new Ribbons();
      // The upper lid and lashes shade the top of the eyeball.
      for (let k = 0; k < 2 + Math.round(shadowed * 2); k++) {
        const off = 0.07 + k * 0.08;
        const w = (1.05 - k * 0.3) * (0.8 + shadowed * 0.6);
        ink.begin();
        for (let i = 0; i <= N; i++) {
          const s = i / N;
          const az = lerp(rig.inAz, rig.outAz, s);
          const { up } = this.lids(rig, s, f, gazePitch);
          const p = this.screen(this.lidPoint(rig, az, up - off, -0.02));
          ink.push(p[0], p[1], w * (0.55 + 0.45 * Math.sin(Math.PI * s)));
        }
        ink.end(0.5);
      }
      // Sclera turning away at the corners; more in shadow.
      for (const edge of [0, 1]) {
        for (let k = 0; k < 2 + Math.round(shadowed * 3); k++) {
          const s0 = edge === 0 ? 0.05 + k * 0.05 : 0.95 - k * 0.05;
          const az = lerp(rig.inAz, rig.outAz, s0);
          const { up, lo } = this.lids(rig, s0, f, gazePitch);
          const a = this.screen(this.lidPoint(rig, az, up - 0.02, -0.02));
          const b = this.screen(this.lidPoint(rig, az, lo + 0.02, -0.02));
          ink.begin();
          ink.push(a[0], a[1], 0.7 * (1 - k * 0.2));
          ink.push((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.75 * (1 - k * 0.2));
          ink.push(b[0], b[1], 0.4);
          ink.end(0.4);
        }
      }
      // Cast shadow from the cap: hatch the whole aperture.
      if (shadowed > 0.35) {
        const n = Math.round(10 * (shadowed - 0.3));
        for (let k = 0; k < n; k++) {
          const el = lerp(0.55, -0.55, k / Math.max(1, n - 1));
          ink.begin();
          for (let i = 0; i <= 10; i++) {
            const az = lerp(rig.inAz, rig.outAz, i / 10);
            const p = this.screen(this.lidPoint(rig, az, el, -0.05));
            ink.push(p[0], p[1], 0.8 * (shadowed - 0.2));
          }
          ink.end();
        }
      }
      g.fillStyle = "#000";
      g.fill(ink.path);

      // Iris and pupil on the eyeball, following the gaze.
      const e1 = norm(cross(gz, [0, 1, 0]));
      const e2 = cross(e1, gz);
      const irisA = 0.47;
      const pupA = Math.asin(clamp(ex.pupil / rig.r, 0.05, 0.4));
      const ring = (a: number, rr = rig.r + 0.02): Array<[number, number]> => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < 28; i++) {
          const t = (i / 28) * Math.PI * 2;
          const ca = Math.cos(a),
            sa = Math.sin(a);
          const dir: V3 = [
            gz[0] * ca + (e1[0] * Math.cos(t) + e2[0] * Math.sin(t)) * sa,
            gz[1] * ca + (e1[1] * Math.cos(t) + e2[1] * Math.sin(t)) * sa,
            gz[2] * ca + (e1[2] * Math.cos(t) + e2[2] * Math.sin(t)) * sa,
          ];
          const p = this.screen([rig.center[0] + dir[0] * rr, rig.center[1] + dir[1] * rr, rig.center[2] + dir[2] * rr]);
          pts.push([p[0], p[1]]);
        }
        return pts;
      };
      const iris = ring(irisA);
      const pupil = ring(pupA, rig.r + 0.05);
      const ic = this.screen([rig.center[0] + gz[0] * rig.r, rig.center[1] + gz[1] * rig.r, rig.center[2] + gz[2] * rig.r]);
      const faded = f.after;
      // Iris: radial striations over a dark ground, a heavy limbal ring.
      const iink = new Ribbons();
      const tone = sc.id.irisTone * (1 - faded * 0.7);
      // Striations: fine near the pupil, swelling toward the dark limbal rim.
      for (let i = 0; i < 28; i++) {
        const p = iris[i]!,
          q = pupil[i]!;
        const jit = (i % 2) * 0.25;
        iink.begin();
        iink.push(q[0], q[1], 0.5 * tone + 0.2 + jit);
        iink.push(q[0] + (p[0] - q[0]) * 0.55, q[1] + (p[1] - q[1]) * 0.55, 0.9 * tone + 0.15);
        iink.push(p[0], p[1], 1.25 * tone + 0.35);
        iink.end(0.8);
      }
      g.fillStyle = "#000";
      g.fill(iink.path);
      g.lineJoin = "round";
      g.strokeStyle = "#000";
      g.lineWidth = (1.2 + 0.5 * tone) * EYE_W * 0.9;
      g.beginPath();
      iris.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      g.stroke();
      // Darken the iris in its upper half (the lid's shadow).
      g.save();
      g.beginPath();
      iris.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      g.clip();
      const top = upper[Math.round(N * 0.45)]!;
      g.lineWidth = 0.9;
      for (let k = 0; k < 4; k++) {
        const yy = top[1] + 0.6 + k * 1.7;
        g.beginPath();
        g.moveTo(ic[0] - 20, yy + (k % 2) * 0.4);
        g.lineTo(ic[0] + 20, yy - 1.2);
        g.stroke();
      }
      g.restore();
      // Pupil.
      g.fillStyle = "#000";
      g.beginPath();
      pupil.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      g.fill();
      // Catch-light: the key light reflected in the cornea.
      if (ex.catchlight > 0.05) {
        const Lh = m3Apply(this.rInv, light.key);
        const camW = sc.cam.pos;
        const V = m3Apply(this.rInv, norm([camW[0] - eyeW[0], camW[1] - eyeW[1], camW[2] - eyeW[2]]));
        const h = norm([Lh[0] + V[0], Lh[1] + V[1], Lh[2] + V[2]]);
        // Cornea: a smaller sphere bulging in front of the iris.
        const cc: V3 = [rig.center[0] + gz[0] * 0.55, rig.center[1] + gz[1] * 0.55, rig.center[2] + gz[2] * 0.55];
        const cp = this.screen([cc[0] + h[0] * 0.78, cc[1] + h[1] * 0.78, cc[2] + h[2] * 0.78]);
        const rr = 1.9 * ex.catchlight * (nearSide ? 1 : 0.8);
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(cp[0], cp[1], rr, rr * 0.85, -0.3, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(cp[0] - rr * 1.6, cp[1] + rr * 1.5, rr * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // Lash line: heavy, swelling toward the outer third, flicking past the corner.
    const lash = new Ribbons();
    lash.begin();
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const w = EYE_W * (0.75 + 1.9 * smoothstep(0.04, 0.62, s) * (1 - 0.3 * smoothstep(0.86, 1, s))) * (1 - f.after * 0.4);
      lash.push(upper[i]![0], upper[i]![1] - 0.3, w);
    }
    {
      const a = upper[N]!,
        b = upper[N - 2]!;
      const tx = a[0] - b[0],
        ty = a[1] - b[1];
      lash.push(a[0] + tx * 0.9, a[1] + ty * 0.9 - 0.8, 0.8);
    }
    lash.end(0.35);
    // Outer lashes: a few short flicks (longer and more of them on softer faces).
    const soft = 1 - smoothstep(0.35, 0.6, sc.id.masc);
    const flicks = 4 + Math.round(soft * 3);
    for (let k = 0; k < flicks; k++) {
      const s = 0.55 + (k * 0.4) / flicks;
      const p = upper[Math.round(s * N)]!,
        q = upper[Math.round(s * N) - 1]!;
      const tx = p[0] - q[0],
        ty = p[1] - q[1];
      const l = Math.hypot(tx, ty) || 1;
      const nx = ty / l,
        ny = -tx / l;
      const flick = rig.side > 0 ? 1 : -1;
      lash.begin();
      const L = 1 + soft * 0.9;
      lash.push(p[0], p[1] - 0.5, 1.3 * EYE_W * 0.8);
      lash.push(p[0] + nx * 2.2 * L * -flick + (tx / l) * 1.6 * L, p[1] + ny * 2.2 * L * -flick - 1.2 * L, 0.3);
      lash.end(0.9);
    }
    // Lower lid: fine, broken in the middle; below it the lid's own thickness.
    const lo = new Ribbons();
    if (open) {
      lo.begin();
      for (let i = 1; i < N; i++) {
        const s = i / N;
        const w = EYE_W * (0.3 + 0.7 * Math.abs(Math.cos(Math.PI * (s - 0.08)))) * (1 - f.after * 0.5);
        lo.push(lower[i]![0], lower[i]![1] + 0.5, w);
      }
      lo.end(0.4);
      lo.begin();
      for (let i = 3; i < N - 1; i++) {
        const s = i / N;
        const az = lerp(rig.inAz, rig.outAz, s);
        const { lo: el } = this.lids(rig, s, f, gazePitch);
        const p = this.screen(this.lidPoint(rig, az * 1.03, el - 0.16, 0.16));
        lo.push(p[0], p[1] + 0.5, 0.55 * Math.sin(Math.PI * s) * (1 - f.after * 0.5));
      }
      lo.end(0.4);
    }
    // Inner canthus (caruncle).
    const cin = upper[0]!;
    lo.begin();
    lo.push(cin[0], cin[1], 1.2);
    lo.push(cin[0] + (lower[1]![0] - cin[0]) * 0.8, cin[1] + (lower[1]![1] - cin[1]) * 0.8 + 0.6, 0.9);
    lo.end(0.5);
    g.fillStyle = "#000";
    g.fill(lash.path);
    g.fill(lo.path);

    // Wet lower rim when the eyes fill.
    if (f.tears > 0.02 && open) {
      g.strokeStyle = "#fff";
      g.lineWidth = 1.3 + f.tears * 0.8;
      g.beginPath();
      for (let i = 2; i < N - 1; i++) (i === 2 ? g.moveTo : g.lineTo).call(g, lower[i]![0], lower[i]![1] - 0.9);
      g.stroke();
    }

    // Mask by depth visibility and composite.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(rig.mask, 0, 0);
    g.globalCompositeOperation = "source-over";
    ctx.drawImage(rig.scratch, bx + dx, by + dy);
  }

  /** Screen-space aperture points (for tears that start at the lower lid). */
  lowerLid(sideSign: number, s: number): V3 {
    const rig = this.rigs.find((r) => r.side === sideSign)!;
    const az = lerp(rig.inAz, rig.outAz, s);
    const { lo } = this.lids(rig, s, { blink: 0, yaw: 0, pitch: 0, atViewer: 0, tears: 0, t: 0, droop: 0, after: 0 }, 0);
    return this.lidPoint(rig, az, lo - 0.08, 0.12);
  }
}

/** Light level on the skin near a bust-frame point (from the head grid). */
function sampleLit(sc: BustScene, p: V3): number {
  // Nearest head vertex by brute force over a coarse stride.
  const g = sc.head;
  let best = Infinity,
    lit = 1;
  for (let k = 0; k < g.n; k += 3) {
    const dx = g.px[k]! - p[0],
      dy = g.py[k]! - p[1],
      dz = g.pz[k]! - p[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) {
      best = d;
      lit = g.lit[k]!;
    }
  }
  return lit;
}
