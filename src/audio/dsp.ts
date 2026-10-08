/**
 * Small offline DSP kit for building one-shot foley buffers in plain
 * TypeScript. Sounds are modelled physically where it is cheap to do so:
 * struck objects are sums of exponentially decaying modes, contact noise is
 * filtered noise, and everything is rendered once into an AudioBuffer so the
 * audio thread only plays it back.
 */
import type { Rng } from "../render/core/rng.ts";

const TAU = Math.PI * 2;

/** RBJ cookbook biquad, direct form I, for offline rendering. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    public type: "lowpass" | "highpass" | "bandpass" | "peaking",
    freq: number,
    q: number,
    private sr: number,
    gainDb = 0,
  ) {
    this.set(freq, q, gainDb);
  }
  set(freq: number, q: number, gainDb = 0): void {
    const f = Math.min(Math.max(freq, 10), this.sr * 0.45);
    const w = (TAU * f) / this.sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * Math.max(q, 0.05));
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    switch (this.type) {
      case "lowpass":
        b0 = (1 - cos) / 2;
        b1 = 1 - cos;
        b2 = b0;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        break;
      case "highpass":
        b0 = (1 + cos) / 2;
        b1 = -(1 + cos);
        b2 = b0;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        break;
      case "bandpass":
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        break;
      case "peaking": {
        const A = Math.pow(10, gainDb / 40);
        b0 = 1 + alpha * A;
        b1 = -2 * cos;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cos;
        a2 = 1 - alpha / A;
        break;
      }
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** In-place filter of a region. */
export function filter(buf: Float32Array, f: Biquad, from = 0, to = buf.length): void {
  for (let i = from; i < to; i++) buf[i] = f.process(buf[i]!);
}

/**
 * Add a decaying sinusoidal mode. `glideTo` bends the frequency exponentially
 * toward a target over the first `glideTime` seconds (thumps, pitch drops).
 */
export function mode(
  out: Float32Array,
  sr: number,
  start: number,
  freq: number,
  decay: number,
  amp: number,
  opts: { glideTo?: number; glideTime?: number; attack?: number; phase?: number } = {},
): void {
  const i0 = Math.max(0, Math.floor(start * sr));
  const len = Math.min(out.length - i0, Math.floor(decay * 7 * sr));
  const attack = Math.max(1, Math.floor((opts.attack ?? 0.0004) * sr));
  const glideTo = opts.glideTo ?? freq;
  const glideK = opts.glideTime ? 1 / (opts.glideTime * sr) : 0;
  let phase = opts.phase ?? 0;
  const kd = Math.exp(-1 / (decay * sr));
  let env = amp;
  for (let i = 0; i < len; i++) {
    const g = glideK ? glideTo + (freq - glideTo) * Math.exp(-i * glideK * 3) : freq;
    phase += (TAU * g) / sr;
    const a = i < attack ? i / attack : 1;
    out[i0 + i]! += Math.sin(phase) * env * a;
    env *= kd;
  }
}

/**
 * Add a burst of filtered white noise with an attack/decay envelope.
 */
export function burst(
  out: Float32Array,
  sr: number,
  rng: Rng,
  start: number,
  decay: number,
  amp: number,
  opts: { attack?: number; hold?: number; type?: Biquad["type"]; freq?: number; q?: number; length?: number } = {},
): void {
  const i0 = Math.max(0, Math.floor(start * sr));
  const attack = Math.max(1, Math.floor((opts.attack ?? 0.0005) * sr));
  const hold = Math.floor((opts.hold ?? 0) * sr);
  const len = Math.min(out.length - i0, Math.floor((opts.length ?? decay * 7 + (opts.attack ?? 0) + (opts.hold ?? 0)) * sr));
  const f = opts.type ? new Biquad(opts.type, opts.freq ?? 1000, opts.q ?? 0.707, sr) : null;
  const kd = Math.exp(-1 / (decay * sr));
  let env = 1;
  for (let i = 0; i < len; i++) {
    let e: number;
    if (i < attack) e = i / attack;
    else if (i < attack + hold) e = 1;
    else {
      env *= kd;
      e = env;
    }
    let n = rng.next() * 2 - 1;
    if (f) n = f.process(n);
    out[i0 + i]! += n * e * amp;
  }
}

/** A single-sample-accurate click (a few samples wide). */
export function click(out: Float32Array, sr: number, start: number, amp: number, width = 0.00015): void {
  const i0 = Math.floor(start * sr);
  const w = Math.max(2, Math.floor(width * sr));
  for (let i = 0; i < w && i0 + i < out.length; i++) out[i0 + i]! += amp * Math.sin((Math.PI * i) / w);
}

export function softClip(buf: Float32Array, drive = 1): void {
  const norm = Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i]! * drive) / norm;
}

export function peak(buf: Float32Array): number {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]!);
    if (a > p) p = a;
  }
  return p;
}

export function normalize(bufs: Float32Array[], target: number): void {
  let p = 0;
  for (const b of bufs) p = Math.max(p, peak(b));
  if (p < 1e-9) return;
  const k = target / p;
  for (const b of bufs) for (let i = 0; i < b.length; i++) b[i]! *= k;
}

export function fade(buf: Float32Array, sr: number, fadeIn: number, fadeOut: number): void {
  const a = Math.floor(fadeIn * sr);
  const b = Math.floor(fadeOut * sr);
  for (let i = 0; i < a && i < buf.length; i++) buf[i]! *= i / a;
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i]! *= i / b;
}

/** Crossfade the tail into the head so the buffer loops without a seam. */
export function makeLoopable(buf: Float32Array, sr: number, seconds = 0.12): Float32Array {
  const n = Math.min(Math.floor(seconds * sr), Math.floor(buf.length / 3));
  const out = buf.slice(0, buf.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const g = Math.sin(k * Math.PI * 0.5);
    out[i] = out[i]! * g + buf[buf.length - n + i]! * Math.cos(k * Math.PI * 0.5);
  }
  return out;
}

export function removeDc(buf: Float32Array): void {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i]!;
  const m = s / buf.length;
  for (let i = 0; i < buf.length; i++) buf[i]! -= m;
}

/** Constant-power stereo split of a mono signal into a stereo pair (additive). */
export function addPanned(l: Float32Array, r: Float32Array, src: Float32Array, at: number, pan: number, gain = 1): void {
  const p = (Math.max(-1, Math.min(1, pan)) + 1) * 0.25 * Math.PI;
  const gl = Math.cos(p) * gain;
  const gr = Math.sin(p) * gain;
  for (let i = 0; i < src.length && at + i < l.length; i++) {
    l[at + i]! += src[i]! * gl;
    r[at + i]! += src[i]! * gr;
  }
}

/**
 * Karplus-Strong plucked string with a one-zero loop filter and a
 * fractional-delay allpass for accurate tuning.
 */
export function karplus(sr: number, freq: number, seconds: number, rng: Rng, brightness = 0.5, sustain = 0.996): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sr));
  const period = sr / freq - 0.5; // one-zero averaging adds half a sample
  const n = Math.max(2, Math.floor(period - 0.1));
  const frac = period - n; // kept in [0.1, 1.1) so the allpass stays well-behaved
  const c = (1 - frac) / (1 + frac); // allpass coefficient
  const line = new Float32Array(n);
  // Excitation: noise shaped by a lowpass for pick hardness.
  const lp = new Biquad("lowpass", 800 + brightness * 7000, 0.6, sr);
  for (let i = 0; i < line.length; i++) line[i] = lp.process(rng.next() * 2 - 1);
  let idx = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  const L = line.length;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx]!;
    const avg = (cur + prev) * 0.5 * sustain;
    prev = cur;
    // allpass for the fractional part
    const y = c * avg + apX - c * apY;
    apX = avg;
    apY = y;
    line[idx] = y;
    out[i] = cur;
    idx = (idx + 1) % L;
  }
  removeDc(out);
  fade(out, sr, 0.0005, 0.08);
  return out;
}

/** Linear interpolation of a breakpoint envelope [[t, v], ...]. */
export function envAt(points: ReadonlyArray<readonly [number, number]>, t: number): number {
  if (t <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]!;
    if (t <= t1) {
      const [t0, v0] = points[i - 1]!;
      return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-9, t1 - t0);
    }
  }
  return points[points.length - 1]![1];
}
