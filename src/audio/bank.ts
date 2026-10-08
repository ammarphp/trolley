/**
 * The foley bank: every one-shot that benefits from sample-level detail is
 * rendered once, in plain TypeScript, into an AudioBuffer and then played
 * back by a single buffer source. Recipes are physical sketches: struck
 * metal is a set of decaying modes, contact is filtered noise, a thermal
 * printer is a stepper motor's pulse train. Each recipe offers a few seeded
 * variants so repeated cues never sound copy-pasted.
 */
import type { Rng } from "../render/core/rng.ts";
import { Biquad, addPanned, burst, click, envAt, fade, filter, karplus, mode, normalize, softClip } from "./dsp.ts";

export type FoleyId =
  | "clack-near"
  | "clack-far"
  | "drop"
  | "lever-arm"
  | "lever-commit"
  | "lever-jam"
  | "switch"
  | "impact-heavy"
  | "impact-light"
  | "glass"
  | "wiper"
  | "printer"
  | "glitch"
  | "stamp-bell"
  | "brake"
  | "ui-tick"
  | "ui-open"
  | "ui-close"
  | "type"
  | "news"
  | "tunnel-in"
  | "tunnel-out"
  | "crackle"
  | "crow"
  | "relay"
  | "clock";

type Channels = Float32Array[];
type Recipe = (sr: number, rng: Rng) => Channels;

const buf = (sr: number, seconds: number) => new Float32Array(Math.max(1, Math.floor(seconds * sr)));
const j = (rng: Rng, v: number, spread = 0.04) => v * rng.range(1 - spread, 1 + spread);

// ------------------------------------------------------------------ rail

const clack =
  (far: boolean): Recipe =>
  (sr, rng) => {
    const out = buf(sr, 0.36);
    burst(out, sr, rng, 0, 0.0012, far ? 0.25 : 0.55, { type: "bandpass", freq: rng.range(2400, 3400), q: 0.9, length: 0.01 });
    mode(out, sr, 0, j(rng, far ? 118 : 150), far ? 0.055 : 0.048, 0.9, { glideTo: j(rng, far ? 58 : 70), glideTime: 0.03, attack: 0.0008 });
    const rings = [880, 1460, 2210, 3120, 4050];
    const decays = [0.045, 0.032, 0.024, 0.017, 0.012];
    const amps = far ? [0.06, 0.04, 0.025, 0.012, 0.006] : [0.12, 0.09, 0.06, 0.04, 0.025];
    rings.forEach((f, i) => mode(out, sr, 0.0004 * i, j(rng, f, 0.05), decays[i]!, amps[i]!));
    burst(out, sr, rng, 0.001, far ? 0.09 : 0.07, 0.32, { type: "lowpass", freq: far ? 300 : 420, q: 0.7, attack: 0.002 });
    filter(out, new Biquad("lowpass", far ? 1700 : 4200, 0.7, sr));
    softClip(out, 1.4);
    normalize([out], 0.9);
    return [out];
  };

const drop: Recipe = (sr, rng) => {
  const out = buf(sr, 0.06);
  click(out, sr, 0, 0.3);
  mode(out, sr, 0, rng.range(2600, 5200), 0.004, 0.4);
  mode(out, sr, 0, rng.range(500, 900), 0.012, 0.3);
  burst(out, sr, rng, 0, 0.0015, 0.2, { type: "highpass", freq: 3000 });
  normalize([out], 0.8);
  return [out];
};

// ------------------------------------------------------------------ lever

function pawl(out: Float32Array, sr: number, rng: Rng, t: number, amp: number): void {
  click(out, sr, t, 0.6 * amp);
  burst(out, sr, rng, t, 0.0015, 0.35 * amp, { type: "bandpass", freq: j(rng, 3500, 0.1), q: 1.2, length: 0.012 });
  mode(out, sr, t, j(rng, 2400), 0.014, 0.18 * amp);
  mode(out, sr, t, j(rng, 3900), 0.01, 0.12 * amp);
  mode(out, sr, t, j(rng, 5200), 0.007, 0.07 * amp);
  mode(out, sr, t, j(rng, 420, 0.1), 0.02, 0.15 * amp);
}

function knock(out: Float32Array, sr: number, rng: Rng, t: number, amp: number, low = 180, high = 420): void {
  mode(out, sr, t, rng.range(low, high), 0.03, amp);
  burst(out, sr, rng, t, 0.003, amp * 0.5, { type: "bandpass", freq: rng.range(800, 1600), q: 1, length: 0.02 });
}

const leverArm: Recipe = (sr, rng) => {
  const out = buf(sr, 0.62);
  for (const t of [0, 0.075, 0.135]) pawl(out, sr, rng, t + rng.range(-0.004, 0.004), 1);
  burst(out, sr, rng, 0, 0.1, 0.05, { type: "bandpass", freq: 900, q: 2, attack: 0.03, length: 0.2 });
  const c = 0.2;
  mode(out, sr, c, j(rng, 118), 0.07, 0.9, { glideTo: 82, glideTime: 0.04, attack: 0.001 });
  [320, 640, 1180, 1950].forEach((f, i) => mode(out, sr, c, j(rng, f), [0.12, 0.09, 0.06, 0.04][i]!, [0.2, 0.14, 0.08, 0.05][i]!));
  burst(out, sr, rng, c, 0.004, 0.4, { type: "bandpass", freq: 1800, q: 0.8, length: 0.03 });
  knock(out, sr, rng, 0.26, 0.08);
  knock(out, sr, rng, 0.31, 0.05);
  filter(out, new Biquad("lowpass", 7000, 0.7, sr));
  softClip(out, 1.3);
  normalize([out], 0.95);
  return [out];
};

const leverCommit: Recipe = (sr, rng) => {
  const out = buf(sr, 1.15);
  [0, 0.07, 0.125, 0.17, 0.205, 0.235].forEach((t, i) => pawl(out, sr, rng, t, 0.7 + i * 0.06));
  burst(out, sr, rng, 0, 0.16, 0.07, { type: "bandpass", freq: 700, q: 1.6, attack: 0.05, length: 0.28 });
  const c = 0.29;
  mode(out, sr, c, j(rng, 92), 0.12, 1.0, { glideTo: 52, glideTime: 0.05, attack: 0.001 });
  mode(out, sr, c, j(rng, 180), 0.08, 0.35);
  [410, 760, 1230, 2050, 2890].forEach((f, i) => mode(out, sr, c, j(rng, f), [0.3, 0.22, 0.15, 0.1, 0.06][i]!, [0.12, 0.1, 0.07, 0.05, 0.03][i]!));
  burst(out, sr, rng, c, 0.003, 0.6, { type: "bandpass", freq: 2200, q: 0.7, length: 0.03 });
  burst(out, sr, rng, c, 0.12, 0.4, { type: "lowpass", freq: 300, attack: 0.002 });
  // Linkage rods travelling away under the floor.
  let t = 0.36;
  for (let i = 0; i < 5; i++) {
    knock(out, sr, rng, t, 0.1 * (1 - i * 0.15), 160, 380);
    t += rng.range(0.05, 0.11);
  }
  mode(out, sr, 0.86, j(rng, 140), 0.05, 0.08, { attack: 0.003 });
  filter(out, new Biquad("lowpass", 6500, 0.7, sr));
  softClip(out, 1.6);
  normalize([out], 0.95);
  return [out];
};

const leverJam: Recipe = (sr, rng) => {
  const out = buf(sr, 1.05);
  pawl(out, sr, rng, 0, 0.8);
  pawl(out, sr, rng, 0.06, 0.9);
  const s = 0.11;
  burst(out, sr, rng, s, 0.002, 0.7, { type: "bandpass", freq: 3000, q: 0.6, length: 0.02 });
  [523, 1337, 2281, 3593, 4711].forEach((f, i) => mode(out, sr, s, j(rng, f), [0.35, 0.28, 0.2, 0.14, 0.09][i]!, [0.18, 0.14, 0.1, 0.06, 0.04][i]!));
  mode(out, sr, s, j(rng, 105), 0.06, 0.7, { glideTo: 70, glideTime: 0.03 });
  // The return spring: a low twang that sags.
  mode(out, sr, s + 0.01, 180, 0.3, 0.25, { glideTo: 95, glideTime: 0.25, attack: 0.003 });
  mode(out, sr, s + 0.01, 486, 0.1, 0.08, { glideTo: 256, glideTime: 0.25 });
  const b = 0.38;
  mode(out, sr, b, j(rng, 130), 0.05, 0.5, { glideTo: 85, glideTime: 0.03 });
  click(out, sr, b, 0.4);
  [700, 1500, 2600].forEach((f, i) => mode(out, sr, b, j(rng, f), 0.06, [0.08, 0.05, 0.03][i]!));
  let t = 0.42;
  for (let i = 0; i < 5; i++) {
    knock(out, sr, rng, t, 0.06 * (1 - i * 0.15));
    t += rng.range(0.03, 0.07);
  }
  filter(out, new Biquad("lowpass", 7000, 0.7, sr));
  softClip(out, 1.5);
  normalize([out], 0.95);
  return [out];
};

// ------------------------------------------------------------------ trackside

const pointMachine: Recipe = (sr, rng) => {
  const out = buf(sr, 1.25);
  // Motor whirr with gear rattle.
  const m0 = 0,
    m1 = 0.46;
  let ph = 0;
  for (let i = Math.floor(m0 * sr); i < Math.floor(m1 * sr); i++) {
    const t = i / sr - m0;
    const f = 120 * Math.pow(175 / 120, Math.min(1, t / 0.2));
    ph += (2 * Math.PI * f) / sr;
    let v = 0;
    for (let n = 1; n <= 6; n++) v += Math.sin(ph * n) / n;
    const env = Math.min(1, t / 0.03) * Math.min(1, (m1 - m0 - t) / 0.05);
    out[i]! += v * env * 0.12 * (1 + 0.3 * Math.sin(2 * Math.PI * 38 * t));
  }
  burst(out, sr, rng, 0.12, 0.2, 0.08, { type: "bandpass", freq: 1400, q: 1.5, attack: 0.05, length: 0.35 });
  const c = 0.47;
  burst(out, sr, rng, c, 0.0015, 0.8, { type: "bandpass", freq: 2400, q: 0.8, length: 0.02 });
  [740, 1650, 2900, 4100].forEach((f, i) => mode(out, sr, c, j(rng, f), [0.08, 0.05, 0.035, 0.02][i]!, [0.25, 0.18, 0.1, 0.05][i]!));
  mode(out, sr, c, 125, 0.04, 0.5, { glideTo: 80, glideTime: 0.02 });
  burst(out, sr, rng, c + 0.022, 0.0015, 0.3, { type: "bandpass", freq: 2000, q: 1, length: 0.015 });
  mode(out, sr, c + 0.022, j(rng, 1900), 0.03, 0.08);
  filter(out, new Biquad("lowpass", 5000, 0.7, sr));
  normalize([out], 0.9);
  return [out];
};

// ------------------------------------------------------------------ impacts

const impact =
  (heavy: boolean): Recipe =>
  (sr, rng) => {
    const L = buf(sr, heavy ? 1.9 : 1.0);
    const R = buf(sr, heavy ? 1.9 : 1.0);
    const core = buf(sr, heavy ? 1.9 : 1.0);
    if (heavy) {
      mode(core, sr, 0, 82, 0.2, 1.0, { glideTo: 36, glideTime: 0.08, attack: 0.003 });
      mode(core, sr, 0, 150, 0.09, 0.45, { glideTo: 70, glideTime: 0.04, attack: 0.002 });
      burst(core, sr, rng, 0, 0.28, 0.45, { type: "lowpass", freq: 260, q: 0.8, attack: 0.004 });
      [212, 338, 517].forEach((f, i) => mode(core, sr, 0.01, j(rng, f), [0.45, 0.35, 0.25][i]!, [0.05, 0.04, 0.03][i]!));
      burst(core, sr, rng, 0.12, 0.5, 0.12, { type: "lowpass", freq: 160, attack: 0.1 });
    } else {
      mode(core, sr, 0, 120, 0.1, 0.8, { glideTo: 60, glideTime: 0.04, attack: 0.002 });
      burst(core, sr, rng, 0, 0.14, 0.3, { type: "lowpass", freq: 380, q: 0.8, attack: 0.003 });
      mode(core, sr, 0.002, j(rng, 320), 0.06, 0.2);
    }
    for (const ch of [L, R]) {
      for (let i = 0; i < core.length; i++) ch[i] = core[i]!;
      const grains = heavy ? 34 : 14;
      const span = heavy ? 0.28 : 0.15;
      for (let g = 0; g < grains; g++) {
        const t = 0.004 + Math.pow(rng.next(), 1.8) * span;
        const amp = (heavy ? 0.28 : 0.22) * (1 - t / (span * 1.15)) * rng.range(0.4, 1);
        burst(ch, sr, rng, t, rng.range(0.002, 0.006), amp, {
          type: "bandpass",
          freq: heavy ? rng.range(350, 1900) : rng.range(600, 2600),
          q: rng.range(1, 2.5),
          length: 0.03,
        });
      }
      filter(ch, new Biquad("lowpass", heavy ? 2600 : 3500, 0.7, sr));
      softClip(ch, 1.8);
    }
    normalize([L, R], 0.95);
    return [L, R];
  };

const glass: Recipe = (sr, rng) => {
  const L = buf(sr, 1.1);
  const R = buf(sr, 1.1);
  const tick = (t: number, f: number, decay: number, amp: number, pan: number) => {
    const tmp = buf(sr, decay * 7 + 0.003);
    click(tmp, sr, 0, amp * 0.6, 0.00008);
    mode(tmp, sr, 0, f, decay, amp);
    mode(tmp, sr, 0, f * 1.53, decay * 0.6, amp * 0.4);
    addPanned(L, R, tmp, Math.floor(t * sr), pan);
  };
  // The first fracture: sharp and central.
  tick(0, j(rng, 6200), 0.005, 0.9, 0);
  tick(0.0006, j(rng, 3800), 0.008, 0.5, 0);
  const n = 36;
  const times = Array.from({ length: n }, () => 0.012 + 0.42 * Math.pow(rng.next(), 1.7)).sort((a, b) => a - b);
  for (const t of times) {
    const side = rng.chance(0.5) ? -1 : 1;
    const pan = side * Math.min(1, 0.12 + t * 3.2) * rng.range(0.5, 1);
    tick(t, rng.range(2500, 8500), rng.range(0.002, 0.006), 0.45 * Math.exp(-t / 0.16) * rng.range(0.3, 1), pan);
  }
  const creak = buf(sr, 0.5);
  mode(creak, sr, 0, 520, 0.12, 0.05, { glideTo: 380, glideTime: 0.2, attack: 0.01 });
  addPanned(L, R, creak, Math.floor(0.02 * sr), 0);
  for (let i = 0; i < 5; i++) tick(rng.range(0.45, 0.9), rng.range(5000, 9000), rng.range(0.02, 0.04), 0.05, rng.range(-0.8, 0.8));
  for (const ch of [L, R]) filter(ch, new Biquad("highpass", 180, 0.7, sr));
  normalize([L, R], 0.9);
  return [L, R];
};

// ------------------------------------------------------------------ cab devices

const wiper: Recipe = (sr, rng) => {
  const dur = 0.8;
  const L = buf(sr, 0.95);
  const R = buf(sr, 0.95);
  const bp = new Biquad("bandpass", 700, 1.2, sr);
  let motorPh = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    let v = 0;
    if (t < dur) {
      const k = Math.sin((Math.PI * t) / dur);
      if (i % 32 === 0) bp.set(700 + 1100 * k, 1.2);
      v = bp.process(rng.next() * 2 - 1) * Math.pow(k, 0.7) * 0.35 * (1 + 0.25 * Math.sin(2 * Math.PI * 55 * t));
    }
    motorPh += (2 * Math.PI * 96) / sr;
    const motorEnv = t < 0.85 ? Math.min(1, t / 0.04) * Math.min(1, (0.85 - t) / 0.05) : 0;
    const motor = (Math.sin(motorPh) * 0.05 + Math.sin(motorPh * 2) * 0.02) * motorEnv;
    const pan = -0.7 + 1.4 * Math.min(1, t / dur);
    const p = (pan + 1) * 0.25 * Math.PI;
    L[i]! += v * Math.cos(p) + motor * 0.7;
    R[i]! += v * Math.sin(p) + motor * 0.7;
  }
  const thunk = buf(sr, 0.1);
  mode(thunk, sr, 0, 170, 0.03, 0.25);
  click(thunk, sr, 0, 0.12);
  addPanned(L, R, thunk, Math.floor(0.83 * sr), 0.6);
  normalize([L, R], 0.7);
  return [L, R];
};

const printer: Recipe = (sr, rng) => {
  const out = buf(sr, 1.45);
  for (let l = 0; l < 9; l++) {
    const start = 0.04 + l * 0.118;
    const rate = j(rng, 410, 0.02);
    for (let ts = start; ts < start + 0.085; ts += 1 / rate) {
      click(out, sr, ts, 0.25);
      mode(out, sr, ts, 2600, 0.0015, 0.1);
    }
    burst(out, sr, rng, start, 0.03, 0.03, { type: "highpass", freq: 4000, hold: 0.06, length: 0.1 });
    for (const k of [0, 1]) mode(out, sr, start + 0.092 + k * 0.0053, j(rng, 1200), 0.004, 0.12);
  }
  const cut = 1.28;
  burst(out, sr, rng, cut, 0.004, 0.5, { type: "bandpass", freq: 3200, q: 1, length: 0.03 });
  mode(out, sr, cut, 1850, 0.02, 0.15);
  mode(out, sr, cut + 0.02, 900, 0.03, 0.1);
  filter(out, new Biquad("peaking", 1800, 2, sr, 6));
  filter(out, new Biquad("highpass", 350, 0.7, sr));
  filter(out, new Biquad("lowpass", 6500, 0.7, sr));
  normalize([out], 0.8);
  return [out];
};

const glitch: Recipe = (sr, rng) => {
  const src = buf(sr, 0.08);
  const fs = [rng.range(200, 900), rng.range(200, 900), rng.range(900, 2400)];
  for (let i = 0; i < src.length; i++) {
    const t = i / sr;
    let v = 0;
    for (const f of fs) v += ((t * f) % 1) * 2 - 1;
    src[i] = v * 0.25 + (rng.next() * 2 - 1) * 0.3;
  }
  const out: Channels = [buf(sr, 0.55), buf(sr, 0.55)];
  for (let ch = 0; ch < 2; ch++) {
    const o = out[ch]!;
    let at = 0;
    while (at < o.length - 1) {
      const len = Math.floor(rng.pick([0.018, 0.024, 0.032, 0.045]) * sr);
      const reps = rng.int(2, 5);
      const off = rng.int(0, src.length - len - 1);
      const dec = rng.pick([1, 2, 4, 8, 16]);
      const steps = Math.pow(2, rng.pick([3, 4, 5, 6]) - 1);
      for (let r = 0; r < reps && at < o.length; r++) {
        const silent = rng.chance(0.2);
        let held = 0;
        for (let i = 0; i < len && at < o.length; i++, at++) {
          if (i % dec === 0) held = Math.round(src[off + i]! * steps) / steps;
          o[at] = silent ? 0 : held * (1 - at / o.length) * 0.9;
        }
      }
    }
    fade(o, sr, 0.001, 0.02);
  }
  normalize(out, 0.55);
  return out;
};

const stampBell: Recipe = (sr, rng) => {
  const L = buf(sr, 2.9);
  const R = buf(sr, 2.9);
  const stamp = buf(sr, 0.3);
  mode(stamp, sr, 0, 145, 0.035, 0.9, { glideTo: 95, glideTime: 0.015, attack: 0.001 });
  [230, 470, 880].forEach((f, i) => mode(stamp, sr, 0, j(rng, f), [0.06, 0.045, 0.03][i]!, [0.25, 0.15, 0.08][i]!));
  burst(stamp, sr, rng, 0, 0.012, 0.5, { type: "bandpass", freq: 1300, q: 0.8, length: 0.08 });
  burst(stamp, sr, rng, 0.13, 0.004, 0.08, { type: "highpass", freq: 2000, length: 0.03 });
  addPanned(L, R, stamp, 0, 0);
  const bell = buf(sr, 2.6);
  const f = 1760;
  click(bell, sr, 0, 0.2);
  burst(bell, sr, rng, 0, 0.001, 0.4, { type: "highpass", freq: 4000, length: 0.01 });
  [1, 2.61, 4.83, 7.4].forEach((r, i) => mode(bell, sr, 0, f * r, [2.3, 1.0, 0.45, 0.2][i]!, [0.35, 0.16, 0.08, 0.04][i]!));
  mode(bell, sr, 0, f * 1.0028, 2.3, 0.2);
  addPanned(L, R, bell, Math.floor(0.3 * sr), 0.25);
  normalize([L, R], 0.85);
  return [L, R];
};

const brake: Recipe = (sr, rng) => {
  const L = buf(sr, 2.6);
  const R = buf(sr, 2.6);
  const squeal: Array<readonly [number, number]> = [
    [0, 0],
    [0.35, 0.5],
    [0.9, 1],
    [1.6, 0.6],
    [2.05, 0],
  ];
  const rub: Array<readonly [number, number]> = [
    [0, 0],
    [0.15, 0.8],
    [1.8, 0.6],
    [2.1, 0],
  ];
  const lpL = new Biquad("lowpass", 1200, 0.7, sr);
  const lpR = new Biquad("lowpass", 1200, 0.7, sr);
  let pL = 0,
    pR = 0,
    pG = 0;
  const f0 = j(rng, 2150, 0.05);
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const f = f0 + 60 * Math.sin(2 * Math.PI * 0.7 * t);
    pL += (2 * Math.PI * f) / sr;
    pR += (2 * Math.PI * f * 1.013) / sr;
    pG += (2 * Math.PI * (68 + 4 * Math.sin(2 * Math.PI * 1.3 * t))) / sr;
    const se = envAt(squeal, t) * (1 + 0.35 * Math.sin(2 * Math.PI * 9.3 * t)) * 0.12;
    const re = envAt(rub, t);
    const sq = (p: number) => Math.sin(p) + 0.25 * Math.sin(2 * p) + 0.08 * Math.sin(3 * p);
    L[i]! += sq(pL) * se + lpL.process(rng.next() * 2 - 1) * re * 0.12 + Math.sin(pG) * re * 0.1;
    R[i]! += sq(pR) * se + lpR.process(rng.next() * 2 - 1) * re * 0.12 + Math.sin(pG) * re * 0.1;
  }
  for (const ch of [L, R]) burst(ch, sr, rng, 2.1, 0.3, 0.35, { type: "highpass", freq: 2600, attack: 0.015 });
  normalize([L, R], 0.8);
  return [L, R];
};

// ------------------------------------------------------------------ interface

const uiTick: Recipe = (sr, rng) => {
  const out = buf(sr, 0.03);
  click(out, sr, 0, 0.5, 0.0001);
  mode(out, sr, 0, j(rng, 2400, 0.08), 0.004, 0.25);
  burst(out, sr, rng, 0, 0.0012, 0.3, { type: "bandpass", freq: 4200, q: 1, length: 0.008 });
  normalize([out], 0.6);
  return [out];
};

const sweep =
  (from: number, to: number, seconds: number, tail: "tick" | "tap"): Recipe =>
  (sr, rng) => {
    const out = buf(sr, seconds + 0.05);
    const bp = new Biquad("bandpass", from, 1.3, sr);
    for (let i = 0; i < Math.floor(seconds * sr); i++) {
      const k = i / (seconds * sr);
      if (i % 32 === 0) bp.set(from * Math.pow(to / from, k), 1.3);
      out[i] = bp.process(rng.next() * 2 - 1) * Math.pow(Math.sin(Math.PI * k), 1.5) * 0.3;
    }
    if (tail === "tick") mode(out, sr, seconds * 0.9, 3100, 0.004, 0.1);
    else mode(out, sr, seconds * 0.85, 310, 0.018, 0.25);
    normalize([out], 0.5);
    return [out];
  };

const morrowType: Recipe = (sr, rng) => {
  const L = buf(sr, 1.45);
  const R = buf(sr, 1.45);
  const pitches = [1174.7, 1318.5, 1480, 1760, 1975.5, 2349.3];
  let t = 0.01;
  while (t < 1.3) {
    const group = rng.int(3, 6);
    for (let g = 0; g < group && t < 1.3; g++) {
      const tmp = buf(sr, 0.1);
      mode(tmp, sr, 0, rng.pick(pitches), 0.012, 0.2, { attack: 0.001 });
      burst(tmp, sr, rng, 0, 0.0015, 0.12, { type: "bandpass", freq: 5000, q: 1.2, length: 0.01 });
      addPanned(L, R, tmp, Math.floor(t * sr), rng.range(-0.25, 0.25), rng.range(0.5, 1));
      t += rng.range(0.025, 0.06);
    }
    t += rng.range(0.09, 0.18);
  }
  normalize([L, R], 0.5);
  return [L, R];
};

const news: Recipe = (sr, rng) => {
  const out = buf(sr, 0.8);
  burst(out, sr, rng, 0, 0.002, 0.5, { type: "bandpass", freq: 2500, q: 1, length: 0.015 });
  mode(out, sr, 0, 1600, 0.01, 0.2);
  const tone = (start: number, f: number, dur: number) => {
    for (let i = Math.floor(start * sr); i < Math.floor((start + dur + 0.03) * sr) && i < out.length; i++) {
      const t = i / sr - start;
      const env = Math.min(1, t / 0.003) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.02));
      const p = 2 * Math.PI * f * t;
      out[i]! += (Math.sin(p) + Math.sin(3 * p) / 3 + Math.sin(5 * p) / 5) * env * 0.25;
    }
  };
  tone(0.05, 1318.5, 0.085);
  tone(0.17, 987.8, 0.12);
  mode(out, sr, 0.29, 987.8, 0.15, 0.04);
  filter(out, new Biquad("highpass", 450, 0.7, sr));
  filter(out, new Biquad("lowpass", 3400, 0.7, sr));
  normalize([out], 0.6);
  return [out];
};

// ------------------------------------------------------------------ tunnels

const tunnel =
  (entering: boolean): Recipe =>
  (sr, rng) => {
    const seconds = entering ? 1.8 : 1.6;
    const L = buf(sr, seconds);
    const R = buf(sr, seconds);
    const env: Array<readonly [number, number]> = entering
      ? [
          [0, 0],
          [0.15, 1],
          [0.5, 0.7],
          [1.6, 0],
        ]
      : [
          [0, 0],
          [0.25, 1],
          [0.7, 0.5],
          [1.5, 0],
        ];
    const fl = [new Biquad(entering ? "lowpass" : "bandpass", 2000, 0.6, sr), new Biquad(entering ? "lowpass" : "bandpass", 2000, 0.6, sr)];
    for (let i = 0; i < L.length; i++) {
      const t = i / sr;
      if (i % 32 === 0) {
        const f = entering ? 2600 * Math.pow(350 / 2600, Math.min(1, t / 0.6)) : 400 * Math.pow(3000 / 400, Math.min(1, t / 0.9));
        fl[0]!.set(f, 0.6);
        fl[1]!.set(f * 1.05, 0.6);
      }
      const e = envAt(env, t) * 0.5;
      L[i] = fl[0]!.process(rng.next() * 2 - 1) * e;
      R[i] = fl[1]!.process(rng.next() * 2 - 1) * e;
    }
    const thump = buf(sr, 1.2);
    if (entering) {
      mode(thump, sr, 0, 34, 0.25, 0.9, { attack: 0.03 });
      mode(thump, sr, 0, 55, 0.15, 0.3, { attack: 0.01 });
    } else mode(thump, sr, 0, 45, 0.2, 0.5, { attack: 0.03 });
    addPanned(L, R, thump, Math.floor((entering ? 0.08 : 0.05) * sr), 0);
    normalize([L, R], 0.8);
    return [L, R];
  };

// ------------------------------------------------------------------ world textures

const crackle: Recipe = (sr, rng) => {
  const out = buf(sr, 0.09);
  click(out, sr, 0, rng.range(0.4, 0.9), 0.0001);
  burst(out, sr, rng, 0, 0.003, 0.5, { type: "highpass", freq: 1500, length: 0.02 });
  mode(out, sr, 0, rng.range(900, 3000), 0.006, 0.2);
  if (rng.chance(0.5)) click(out, sr, rng.range(0.004, 0.02), 0.3, 0.0001);
  normalize([out], 0.8);
  return [out];
};

const crow: Recipe = (sr, rng) => {
  const out = buf(sr, 0.5);
  const fStart = rng.range(500, 580);
  const fEnd = fStart * rng.range(0.78, 0.86);
  let ph = 0;
  let jitter = 0;
  const hold = rng.range(0.16, 0.22);
  const noise = new Biquad("bandpass", 1500, 1, sr);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if (i % Math.floor(sr * 0.005) === 0) jitter = rng.range(-0.04, 0.04);
    const f0 = (fStart + (fEnd - fStart) * Math.min(1, t / 0.3)) * (1 + jitter);
    ph += (2 * Math.PI * f0) / sr;
    let v = 0;
    for (let n = 1; n <= 14; n++) {
      const fn = n * f0;
      const w = Math.exp(-(((fn - 1150) / 500) ** 2)) + 0.6 * Math.exp(-(((fn - 2300) / 600) ** 2)) + 0.15 / n;
      v += Math.sin(ph * n) * w;
    }
    const env = Math.min(1, t / 0.02) * (t < hold ? 1 : Math.exp(-(t - hold) / 0.05));
    out[i] = (v * 0.3 + noise.process(rng.next() * 2 - 1) * 0.6) * env;
  }
  normalize([out], 0.8);
  return [out];
};

const relay: Recipe = (sr, rng) => {
  const out = buf(sr, 0.045);
  click(out, sr, 0, 0.6, 0.0001);
  mode(out, sr, 0, j(rng, 1900), 0.006, 0.3);
  mode(out, sr, 0, j(rng, 620), 0.012, 0.2);
  click(out, sr, 0.006, 0.3, 0.0001);
  normalize([out], 0.5);
  return [out];
};

const clockTick: Recipe = (sr, rng) => {
  const out = buf(sr, 0.07);
  mode(out, sr, 0, j(rng, 1650, 0.01), 0.01, 0.4);
  mode(out, sr, 0, 3300, 0.004, 0.15);
  click(out, sr, 0, 0.3, 0.0001);
  normalize([out], 0.5);
  return [out];
};

const RECIPES: Record<FoleyId, { make: Recipe; variants: number }> = {
  "clack-near": { make: clack(false), variants: 4 },
  "clack-far": { make: clack(true), variants: 3 },
  drop: { make: drop, variants: 6 },
  "lever-arm": { make: leverArm, variants: 3 },
  "lever-commit": { make: leverCommit, variants: 2 },
  "lever-jam": { make: leverJam, variants: 2 },
  switch: { make: pointMachine, variants: 2 },
  "impact-heavy": { make: impact(true), variants: 2 },
  "impact-light": { make: impact(false), variants: 2 },
  glass: { make: glass, variants: 3 },
  wiper: { make: wiper, variants: 2 },
  printer: { make: printer, variants: 2 },
  glitch: { make: glitch, variants: 3 },
  "stamp-bell": { make: stampBell, variants: 1 },
  brake: { make: brake, variants: 1 },
  "ui-tick": { make: uiTick, variants: 3 },
  "ui-open": { make: sweep(900, 2600, 0.22, "tick"), variants: 1 },
  "ui-close": { make: sweep(2300, 800, 0.2, "tap"), variants: 1 },
  type: { make: morrowType, variants: 2 },
  news: { make: news, variants: 1 },
  "tunnel-in": { make: tunnel(true), variants: 1 },
  "tunnel-out": { make: tunnel(false), variants: 1 },
  crackle: { make: crackle, variants: 6 },
  crow: { make: crow, variants: 3 },
  relay: { make: relay, variants: 2 },
  clock: { make: clockTick, variants: 1 },
};

export const FOLEY_IDS = Object.keys(RECIPES) as FoleyId[];

export class Bank {
  private cache = new Map<string, AudioBuffer>();
  private rotation = new Map<FoleyId, number>();
  constructor(
    private ctx: BaseAudioContext,
    private rng: Rng,
  ) {}

  /** A specific variant, rendered on first use. */
  variant(id: FoleyId, index: number): AudioBuffer {
    const { make, variants } = RECIPES[id];
    const v = ((index % variants) + variants) % variants;
    const key = `${id}#${v}`;
    let b = this.cache.get(key);
    if (!b) {
      const chans = make(this.ctx.sampleRate, this.rng.fork(key));
      b = this.ctx.createBuffer(chans.length, chans[0]!.length, this.ctx.sampleRate);
      chans.forEach((c, i) => b!.copyToChannel(c as Float32Array<ArrayBuffer>, i));
      this.cache.set(key, b);
    }
    return b;
  }

  /** The next variant in a shuffled-looking rotation (never the same twice running). */
  next(id: FoleyId): AudioBuffer {
    const { variants } = RECIPES[id];
    const last = this.rotation.get(id) ?? -1;
    let v = variants > 1 ? this.rng.int(0, variants - 2) : 0;
    if (variants > 1 && v >= last) v++;
    this.rotation.set(id, v);
    return this.variant(id, v);
  }

  /** A plucked string at a MIDI pitch (Karplus-Strong), cached per pitch. */
  pluck(midi: number): AudioBuffer {
    const m = Math.round(midi);
    const key = `ks#${m}`;
    let b = this.cache.get(key);
    if (!b) {
      const sr = this.ctx.sampleRate;
      const freq = 440 * Math.pow(2, (m - 69) / 12);
      const data = karplus(sr, freq, 1.4, this.rng.fork(key), 0.12, 0.994);
      normalize([data], 0.8);
      b = this.ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.cache.set(key, b);
    }
    return b;
  }

  /** Every recipe/variant pair, for progressive warm-up. */
  jobs(): Array<() => void> {
    const out: Array<() => void> = [];
    for (const id of FOLEY_IDS) for (let v = 0; v < RECIPES[id].variants; v++) out.push(() => void this.variant(id, v));
    return out;
  }
}
