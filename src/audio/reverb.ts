/**
 * Procedural impulse responses for the convolution reverbs.
 *
 * A generated IR is decaying noise whose spectrum darkens over time (air and
 * surfaces absorb highs first), preceded by a handful of discrete early
 * reflections. Two spaces are enough for the whole game:
 *
 *   hall — an open, dark outdoor space for the score and distant events.
 *   cab  — the small steel-and-glass box the player sits in.
 */
import type { Rng } from "../render/core/rng.ts";

export interface ImpulseSpec {
  /** Seconds until the tail has fallen by 60 dB. */
  rt60: number;
  /** Buffer length in seconds (normally a little over rt60). */
  length: number;
  predelay: number;
  /** Lowpass cutoff at t = 0 and at t = rt60 (frequency-dependent decay). */
  brightStart: number;
  brightEnd: number;
  /** Early reflections: count and the window they fall in (seconds). */
  early: number;
  earlyWindow: number;
  earlyGain: number;
  /** Gain applied after energy normalisation. */
  gain: number;
}

export const HALL: ImpulseSpec = {
  rt60: 4.2,
  length: 4.4,
  predelay: 0.028,
  brightStart: 7000,
  brightEnd: 700,
  early: 9,
  earlyWindow: 0.12,
  earlyGain: 0.5,
  gain: 1,
};

export const CAB: ImpulseSpec = {
  rt60: 0.32,
  length: 0.4,
  predelay: 0.002,
  brightStart: 9000,
  brightEnd: 2200,
  early: 14,
  earlyWindow: 0.018,
  earlyGain: 0.35,
  gain: 1,
};

export function makeImpulse(ctx: BaseAudioContext, rng: Rng, spec: ImpulseSpec): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(spec.length * sr);
  const buffer = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(spec.predelay * sr);
  const decayK = 6.907755 / (spec.rt60 * sr); // ln(1000)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const r = rng.fork(`ir-${ch}`);
    let lp = 0;
    let lp2 = 0;
    let energy = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const k = Math.min(1, t / spec.rt60);
      const fc = spec.brightStart * Math.pow(spec.brightEnd / spec.brightStart, k);
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      const n = r.next() * 2 - 1;
      lp += a * (n - lp);
      lp2 += a * (lp - lp2);
      // Diffuse build-up over the first ~40 ms so the tail does not click on.
      const build = Math.min(1, t / 0.04);
      const v = lp2 * Math.exp(-decayK * (i - pre)) * build;
      data[i] = v;
      energy += v * v;
    }
    const norm = 1 / Math.sqrt(Math.max(1e-12, energy));
    for (let i = 0; i < len; i++) data[i]! *= norm * spec.gain;
    // Early reflections, sparse and slightly different per ear.
    for (let e = 0; e < spec.early; e++) {
      const at = pre + Math.floor(r.range(0.12, 1) * spec.earlyWindow * sr);
      const g = spec.earlyGain * norm * 8 * (1 - e / (spec.early + 1)) * (r.chance(0.5) ? 1 : -1) * r.range(0.4, 1);
      if (at < len) data[at]! += g;
      if (at + 1 < len) data[at + 1]! += g * 0.5;
    }
    // Declick the very end.
    const tail = Math.min(len, Math.floor(0.05 * sr));
    for (let i = 0; i < tail; i++) data[len - 1 - i]! *= i / tail;
  }
  return buffer;
}
