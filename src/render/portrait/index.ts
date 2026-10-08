/**
 * THE CONTROLLER'S FACE: the only time the player sees themself, as a
 * reflection in the cab's left exterior mirror.
 *
 *   const portrait = createPortrait({ seed: view.seed });
 *   cab.setMirrorTexture(portrait.texture);
 *   // every frame (it repaints itself at most ~12 fps):
 *   portrait.draw(view.cabin.face, t, { speed: view.cabin.speedKmh, crack, glitch, reducedMotion });
 *
 * A procedural engraving drawn with Canvas2D paths from a small software
 * renderer (see scene.ts): a seeded, specific face in a railway uniform,
 * modelled in 3D, lit, and hatched line by line; eyes that blink, saccade,
 * track the line ahead and now and then look straight out of the mirror.
 *
 * ORIENTATION: the canvas holds the UN-MIRRORED camera view (as if a camera
 * sat where the mirror is): the face turns toward canvas-left, the line
 * recedes to a vanishing point at canvas-right, and the cap badge reads the
 * right way round. A mirror reverses left and right, so the cab must show it
 * flipped horizontally: in the reflection the face turns toward the glass's
 * right edge and the track runs away on the left. The ink material samples
 * the raw `uv` attribute and ignores `texture.repeat/offset`, so flip the
 * glass plane's U coordinates (`flipPlaneU(geometry)`), or pass
 * `mirrored: true` to receive a canvas that is already reversed.
 *
 * ASPECT: 512x640 (0.8). The cab glass is 0.2 x 0.28 m (0.714); crop u to
 * [0.054, 0.946] to avoid squeezing (all essential content sits inside).
 */
import * as THREE from "three";
import type { EnvironmentTarget, FaceState } from "../api.ts";
import { createInkCanvas } from "../core/ink-material.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { MirrorBackground, type MirrorEnv } from "./background.ts";
import { EyeSystem, type EyeFrame } from "./eyes.ts";
import { Ribbons } from "./engrave.ts";
import { FeaturePen, drawSpectacles } from "./features.ts";
import { figureSteps } from "./figure.ts";
import { drawCracks, drawGlass, makeCrack, type CrackPattern } from "./glass.ts";
import { BUILD_TRACE, clamp, hash3, lerp, smoothstep } from "./math.ts";
import { FACE_PRESETS, exprFromFace, makeIdentity, type Expr, type Identity } from "./rig.ts";
import { PORTRAIT_H, PORTRAIT_W, sceneSteps, type BustScene } from "./scene.ts";
import { tearTracks, drawTears, type TearTrack } from "./tears.ts";

export { FACE_PRESETS } from "./rig.ts";
export { PORTRAIT_W, PORTRAIT_H } from "./scene.ts";

export interface PortraitOptions {
  seed: number | string;
  /** Return a canvas that is already mirror-reversed (default false: the cab flips it). */
  mirrored?: boolean;
  /** Milliseconds of rebuild work allowed per draw() call (default 3). */
  budgetMs?: number;
}

export interface PortraitDrawOptions {
  /** Cruise speed in km/h (CabinState.speedKmh); drives the receding track. */
  speed: number;
  /** 0 intact .. 1 shattered. */
  crack: number;
  /** 0..1: diegetic freeze / false-dawn corruption; near 1 the stage-0 smile returns. */
  glitch?: number;
  reducedMotion: boolean;
  /** Optional world channels (StageView.env) for the mirror's horizon and sky. */
  env?: Partial<EnvironmentTarget>;
  /** Lab/test only: force parts of the eye state (e.g. { atViewer: 1 }). */
  eyes?: Partial<EyeFrame>;
}

export interface Portrait {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  draw(face: FaceState, t: number, opts: PortraitDrawOptions): void;
  /** Complete any pending rebuild synchronously (loading screens, tests). */
  settle(face?: FaceState): void;
  dispose(): void;
}

/** A finished build: only what painting needs, so the scene can be freed. */
interface Built {
  face: FaceState;
  ex: Expr;
  layer: HTMLCanvasElement;
  eyes: EyeSystem;
  tears: TearTrack[];
  overlay: HTMLCanvasElement | null;
}

interface Job {
  face: FaceState;
  gen: Generator<void, Built>;
}

const PARAMS: Array<keyof FaceState> = ["stage", "smile", "fatigue", "grief", "shock", "dissociation", "age"];

function faceDelta(a: FaceState, b: FaceState): number {
  let d = 0;
  for (const k of PARAMS) d = Math.max(d, Math.abs(a[k] - b[k]) * (k === "stage" ? 0.25 : 1));
  return d;
}

/** Internal: the time-sliced build (exported for the lab's profiler). */
export function portraitBuildSteps(seed: number | string, face: FaceState): Generator<void, unknown> {
  return buildJob(makeIdentity(seed), face, PORTRAIT_W, PORTRAIT_H);
}

function* buildJob(id: Identity, face: FaceState, w: number, h: number): Generator<void, Built> {
  const ex = exprFromFace(face, id);
  const sc = yield* sceneSteps(id, ex, w, h);
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const g = layer.getContext("2d")!;
  yield* figureSteps(g, sc, { bias: ex.tension * 0.07, weight: 1 });
  yield;
  BUILD_TRACE.label = "eyes";
  const eyes = new EyeSystem(sc);
  yield;
  BUILD_TRACE.label = "tears";
  const tears = tearTracks(sc);
  // Things in front of the eyes (spectacles) live on an overlay drawn after them.
  let overlay: HTMLCanvasElement | null = null;
  if (id.spectacles) {
    overlay = document.createElement("canvas");
    overlay.width = w;
    overlay.height = h;
    const og = overlay.getContext("2d")!;
    const ink = new Ribbons(),
      white = new Ribbons();
    const pen = new FeaturePen(sc, ink, white);
    pen.weight = 1.3 * (1 - 0.7 * ex.after);
    drawSpectacles(sc, pen);
    og.fillStyle = "#000";
    og.fill(ink.path);
    og.fillStyle = "#fff";
    og.fill(white.path);
  }
  return { face: { ...face }, ex, layer, eyes, tears, overlay };
}

function envFrom(face: FaceState, ex: Expr, env?: Partial<EnvironmentTarget>): MirrorEnv {
  const s = face.stage;
  if (!env) {
    return {
      pastoral: 1 - smoothstep(1.5, 3.5, s),
      industry: smoothstep(1.2, 2.6, s) * (1 - smoothstep(4.5, 5.8, s)),
      storm: smoothstep(3.2, 4.4, s) * (1 - smoothstep(5.2, 6, s) * 0.6),
      ruin: smoothstep(5.2, 6, s),
      order: 0,
      gloom: ex.gloom,
      surveillance: smoothstep(3.4, 4.8, s) * (1 - smoothstep(5.5, 6, s)),
    };
  }
  const g = (k: keyof EnvironmentTarget, d = 0) => (typeof env[k] === "number" ? (env[k] as number) : d);
  const night = smoothstep(0.8, 0.95, g("timeOfDay", 0.3)) + (1 - smoothstep(0.05, 0.2, g("timeOfDay", 0.3)));
  return {
    pastoral: clamp(g("vegetation", 0.6) * (1 - g("industry") * 0.8) * (1 - g("ruin"))),
    industry: clamp(Math.max(g("industry"), g("compute") * 0.8)),
    storm: clamp(Math.max(g("storm"), g("cloud") * 0.4)),
    ruin: clamp(Math.max(g("ruin"), g("fire") * 0.8)),
    order: clamp(Math.max(g("perfection"), g("uniformity"))),
    gloom: clamp(Math.max(g("gloom"), night * 0.6, ex.gloom * 0.5)),
    surveillance: clamp(g("surveillance")),
  };
}

/** Deterministic event schedule (blinks, saccades, glances) from a seed. */
class Schedule {
  private rng: Rng;
  private seed: number;
  private label: string;
  next = 0;
  start = -1;
  end = -1;
  value = 0;
  constructor(seed: number, label: string) {
    this.seed = seed;
    this.label = label;
    this.rng = createRng(`${seed}:${label}`);
  }
  reset(): void {
    this.rng = createRng(`${this.seed}:${this.label}`);
    this.next = 0;
    this.start = this.end = -1;
  }
  /** Advance to time t; `gap()` and `len()` give the next interval and duration. */
  advance(t: number, gap: (r: Rng) => number, len: (r: Rng) => number, onStart?: (r: Rng) => void): boolean {
    if (t < this.start - 1e-6) this.reset();
    if (this.next === 0) this.next = gap(this.rng) * this.rng.range(0.2, 1);
    let guard = 0;
    while (t >= this.next && guard++ < 1000) {
      this.start = this.next;
      this.end = this.start + len(this.rng);
      onStart?.(this.rng);
      this.next = this.end + gap(this.rng);
    }
    return t >= this.start && t < this.end;
  }
  phase(t: number): number {
    return this.end > this.start ? clamp((t - this.start) / (this.end - this.start)) : 1;
  }
}

/** Flip a PlaneGeometry's U coordinates (show the canvas as a reflection). */
export function flipPlaneU(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return geometry;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Prepare a mirror-glass plane (u 0..1 across, v 0..1 up) for the portrait:
 * crop U so a glass of aspect `glassAspect` (width/height) shows the 0.8
 * canvas undistorted, and flip U so it reads as a reflection. Call once.
 */
export function mirrorGlassUV(geometry: THREE.BufferGeometry, glassAspect: number): THREE.BufferGeometry {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return geometry;
  const span = clamp(glassAspect / (PORTRAIT_W / PORTRAIT_H), 0.2, 1);
  const u0 = (1 - span) / 2;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - (u0 + uv.getX(i) * span));
  uv.needsUpdate = true;
  return geometry;
}

export function createPortrait(options: PortraitOptions): Portrait {
  const W = PORTRAIT_W,
    H = PORTRAIT_H;
  const id = makeIdentity(options.seed);
  const seed = id.seed;
  const budget = options.budgetMs ?? 3;
  const { canvas, ctx: out, texture } = createInkCanvas(W, H);
  const compose = document.createElement("canvas");
  compose.width = W;
  compose.height = H;
  const cx = compose.getContext("2d")!;
  const bg = new MirrorBackground(seed, W, H);
  const crackPattern: CrackPattern = makeCrack(seed, W, H);

  let cur: FaceState | null = null;
  let built: Built | null = null;
  let prev: Built | null = null;
  let fadeFrom = 0;
  let job: Job | null = null;
  let stage0: Built | null = null;
  let stage0Job: Generator<void, Built> | null = null;
  let lastT = -1;
  let lastPaint = -1;
  let dist = 0;
  let frame = 0;
  let disposed = false;

  const blink = new Schedule(seed, "blink");
  const sacc = new Schedule(seed, "saccade");
  const glance = new Schedule(seed, "glance");
  const gauge = new Schedule(seed, "gauge");
  let saccYaw = 0,
    saccPitch = 0;
  let glanceLen = 1;

  const runSync = <T,>(gen: Generator<void, T>): T => {
    for (;;) {
      const r = gen.next();
      if (r.done) return r.value;
    }
  };
  const pump = (deadline: number) => {
    while (job && performance.now() < deadline) {
      const r = job.gen.next();
      if (r.done) {
        prev = built;
        built = r.value;
        fadeFrom = lastT;
        job = null;
      }
    }
    if (!job && built && !stage0 && performance.now() < deadline) {
      stage0Job ??= buildJob(id, FACE_PRESETS[0]!, W, H);
      while (performance.now() < deadline) {
        const r = stage0Job.next();
        if (r.done) {
          stage0 = r.value;
          stage0Job = null;
          break;
        }
      }
    }
  };

  const eyeFrame = (b: Built, t: number, reduced: boolean): EyeFrame => {
    const ex = b.ex;
    // Blinks: staring in shock and dissociation, heavy and slow when tired.
    const rate = 14 * (1 - 0.5 * ex.shock) * (1 + 0.6 * ex.fatigue) * (1 - 0.75 * ex.dissoc) * (1 + 0.2 * ex.grief);
    const blinkLen = 0.15 + 0.18 * ex.fatigue + 0.06 * ex.dissoc;
    const inBlink = blink.advance(
      t,
      (r) => (60 / Math.max(2, rate)) * r.range(0.35, 1.8),
      () => blinkLen,
    );
    let bl = 0;
    if (inBlink) {
      const p = blink.phase(t);
      bl = p < 0.35 ? p / 0.35 : p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
      bl = smoothstep(0, 1, bl);
    }
    // Glances into the mirror: brief early; long and unblinking late.
    const late = clamp(ex.dissoc * 0.8 + ex.grief * 0.4 + ex.fatigue * 0.2);
    const gOn = glance.advance(
      t,
      (r) => lerp(34, 13, late) * r.range(0.7, 1.4),
      (r) => (glanceLen = lerp(1.1, 3.6, late) * r.range(0.8, 1.2)),
    );
    let atViewer = 0;
    if (gOn) {
      const el = t - glance.start;
      const rem = glance.end - t;
      atViewer = Math.min(1, el / 0.1) * Math.min(1, rem / 0.18);
      if (late > 0.5) bl *= 0.2; // the stare does not blink
    }
    void glanceLen;
    // Saccades and a glance down at the gauges now and then.
    let yaw = 0,
      pitch = -0.035;
    if (!reduced && ex.dissoc < 0.8) {
      sacc.advance(
        t,
        (r) => r.range(0.5, 2.6),
        () => 0.01,
        (r) => {
          saccYaw = r.range(-0.08, 0.08) * (1 - ex.dissoc);
          saccPitch = r.range(-0.035, 0.03) * (1 - ex.dissoc);
        },
      );
      yaw += saccYaw;
      pitch += saccPitch;
      if (ex.stage < 3.5 && gauge.advance(t, (r) => r.range(9, 22), (r) => r.range(0.5, 1.0))) pitch -= 0.3 * Math.sin(Math.PI * gauge.phase(t));
    }
    // Dissociation: the gaze drops and unfocuses.
    pitch -= 0.06 * ex.dissoc;
    return {
      blink: bl,
      yaw,
      pitch,
      atViewer,
      tears: ex.tears,
      t,
      droop: 0.25 * ex.dissoc + 0.15 * ex.fatigue * (0.5 + 0.5 * Math.sin(t * 0.7)),
      after: ex.after,
    };
  };

  let eyeOverride: Partial<EyeFrame> | undefined;
  const paintFigure = (g: CanvasRenderingContext2D, b: Built, t: number, dx: number, dy: number, reduced: boolean, alpha = 1) => {
    g.globalAlpha = alpha;
    g.drawImage(b.layer, dx, dy);
    g.globalAlpha = 1;
    if (alpha >= 0.5) {
      b.eyes.draw(g, { ...eyeFrame(b, t, reduced), ...eyeOverride }, dx, dy);
      drawTears(g, b.tears, b.ex, t, dx, dy, reduced);
      if (b.overlay) g.drawImage(b.overlay, dx, dy);
    }
  };

  const paint = (t: number, o: PortraitDrawOptions) => {
    if (!cur) return;
    frame++;
    const reduced = o.reducedMotion;
    if (!built) {
      // The first build is still running: show the line receding in an
      // empty mirror; the controller fades in when ready.
      const ex0 = exprFromFace(cur, id);
      cx.setTransform(1, 0, 0, 1, 0, 0);
      bg.draw(cx, dist, t, envFrom(cur, ex0, o.env), reduced ? 0 : 1);
      drawGlass(cx, W, H, seed, clamp(o.crack ?? 0));
      out.setTransform(1, 0, 0, 1, 0, 0);
      if (options.mirrored) out.setTransform(-1, 0, 0, 1, W, 0);
      out.drawImage(compose, 0, 0);
      out.setTransform(1, 0, 0, 1, 0, 0);
      texture.needsUpdate = true;
      return;
    }
    const ex = built.ex;
    const glitch = clamp(o.glitch ?? 0);
    const env = envFrom(cur, ex, o.env);
    const falseDawn = glitch > 0.85 && stage0 ? stage0 : null;
    const useEnv = falseDawn ? { ...env, pastoral: 1, industry: 0, storm: 0, ruin: 0, gloom: 0.05, surveillance: 0 } : env;
    // Breathing, grief tremor, mirror-arm vibration.
    const breathRate = 1 / (4.2 - 1.6 * ex.shock + 0.6 * ex.fatigue);
    let dy = Math.sin(t * Math.PI * 2 * breathRate) * (reduced ? 0.3 : 0.9);
    dy += ex.grief > 0.5 && !reduced ? Math.max(0, Math.sin(t * 5.3) * Math.sin(t * 0.9)) * 0.8 * (ex.grief - 0.5) : 0;
    let dx = 0;
    if (!reduced) {
      const vib = clamp(o.speed / 70) * 0.5;
      dx += (hash3(frame, 1, seed) - 0.5) * vib;
      dy += (hash3(frame, 2, seed) - 0.5) * vib;
    }
    cx.save();
    cx.setTransform(1, 0, 0, 1, 0, 0);
    bg.draw(cx, dist, t, useEnv, reduced ? 0 : 1);
    const b = falseDawn ?? built;
    // Cross-fade from the previous build (or fade in the very first one).
    const k = falseDawn ? 1 : clamp((t - fadeFrom) / 0.45);
    if (prev && k < 1 && !falseDawn) paintFigure(cx, prev, t, dx, dy, reduced, 1 - k);
    paintFigure(cx, b, t, dx, dy, reduced, k);
    if (k >= 1) prev = null;
    // Signal corruption: bands slip sideways, some show the old smile.
    if (glitch > 0.02 && !falseDawn) {
      const bands = 8 + Math.round(glitch * 22);
      const tick = Math.floor(t * 12);
      for (let i = 0; i < bands; i++) {
        if (hash3(i, tick, seed) > 0.25 + glitch * 0.7) continue;
        const y0 = hash3(i, tick, seed + 1) * H;
        const hh = 3 + hash3(i, tick, seed + 2) * (10 + 40 * glitch);
        const off = (hash3(i, tick, seed + 3) - 0.5) * (20 + 90 * glitch);
        cx.save();
        cx.beginPath();
        cx.rect(0, y0, W, hh);
        cx.clip();
        bg.draw(cx, dist, t, env, 0);
        const src = stage0 && hash3(i, tick, seed + 4) < glitch ? stage0 : built;
        paintFigure(cx, src, t, dx + off, dy, true);
        cx.restore();
      }
    }
    drawGlass(cx, W, H, seed, clamp(ex.fatigue * 0.6 + (o.crack ?? 0)));
    cx.restore();

    // Output: shards shift the reflection, then the cracks go over the top.
    out.setTransform(1, 0, 0, 1, 0, 0);
    if (options.mirrored) out.setTransform(-1, 0, 0, 1, W, 0);
    out.drawImage(compose, 0, 0);
    const crack = clamp(o.crack);
    if (crack > 0.001) {
      for (const s of crackPattern.shards) {
        const f = clamp((crack - s.from) / 0.3);
        if (f <= 0) continue;
        out.save();
        out.beginPath();
        s.poly.forEach((p, i) => (i ? out.lineTo(p[0], p[1]) : out.moveTo(p[0], p[1])));
        out.closePath();
        out.clip();
        out.drawImage(compose, s.dx * f, s.dy * f);
        out.restore();
      }
      drawCracks(out, crackPattern, crack);
    }
    out.setTransform(1, 0, 0, 1, 0, 0);
    texture.needsUpdate = true;
  };

  const portrait: Portrait = {
    canvas,
    texture,
    draw(face, t, o) {
      if (disposed) return;
      const dt = lastT < 0 ? 0 : clamp(t - lastT, 0, 0.25);
      if (lastT >= 0 && t < lastT - 1e-6) {
        // Time went backwards (a new session): restart the clocks.
        lastPaint = -1;
        dist = 0;
      }
      lastT = t;
      eyeOverride = o.eyes;
      dist += (Math.max(0, o.speed) / 3.6) * dt * (o.reducedMotion ? 0.35 : 1);
      // Ease the displayed face toward the target.
      if (!cur) cur = { ...face };
      else {
        const k = o.reducedMotion ? 1 : 1 - Math.exp(-dt / 0.9);
        for (const p of PARAMS) cur[p] = cur[p] + (face[p] - cur[p]) * k;
      }
      if (!job && (!built || faceDelta(cur, built.face) > 0.025)) job = { face: { ...cur }, gen: buildJob(id, cur, W, H) };
      pump(performance.now() + budget);
      const glitching = (o.glitch ?? 0) > 0.02;
      if (lastPaint >= 0 && t - lastPaint < 1 / 12 - 1e-4 && !glitching) return;
      lastPaint = t;
      paint(t, o);
    },
    settle(face) {
      if (face) {
        cur = { ...face };
        built = runSync(buildJob(id, cur, W, H));
        job = null;
        prev = null;
      } else if (job) {
        built = runSync(job.gen);
        job = null;
        prev = null;
      }
      fadeFrom = -1e9;
      if (!stage0) stage0 = runSync(stage0Job ?? buildJob(id, FACE_PRESETS[0]!, W, H));
      stage0Job = null;
    },
    dispose() {
      disposed = true;
      texture.dispose();
      built = prev = stage0 = null;
      job = null;
    },
  };
  return portrait;
}
