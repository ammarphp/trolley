/**
 * The mixing graph and the shared resources every voice draws on.
 *
 *   music  ─┐                                   ┌─ hall convolver ─┐
 *   world  ─┼─ category volume ─┬───── dry ─────┤                  ├─ pre-master
 *   cab/rail┤                   └─ sends ───────┴─ cab convolver ──┘      │
 *   sfx    ─┘                                                              │
 *   pre-master ─ freeze gate ─┬─ clean ──────────┐                          │
 *                              └─ crusher ─ gate ─┴─ master ─ pause ─ limiter ─ soft clip ─ out
 *
 * Voices are created per note and released to the garbage collector when
 * they end; only a handful of long-lived nodes run all the time.
 */
import { createRng, type Rng } from "../render/core/rng.ts";
import { HALL, CAB, makeImpulse } from "./reverb.ts";
import { makeLoopable } from "./dsp.ts";

export interface VoiceCounter {
  active: number;
}

export interface Buses {
  /** Score, dry and reverb send. */
  music: GainNode;
  musicWet: GainNode;
  /** Outdoor world (birds, wind, rain on the land, distant events). */
  world: GainNode;
  worldWet: GainNode;
  /** Inside the cab: hum, rumble, rail joints, rain on the roof. */
  cab: GainNode;
  cabRoom: GainNode;
  /** One-shot effects. */
  sfx: GainNode;
  sfxWet: GainNode;
  sfxRoom: GainNode;
  /** Interface clicks: bypass pause and freeze so menus still answer. */
  ui: GainNode;
}

export interface Waves {
  warm: PeriodicWave;
  reed: PeriodicWave;
  organ: PeriodicWave;
  hum: PeriodicWave;
  soft: PeriodicWave;
  voice: PeriodicWave;
  blip: PeriodicWave;
}

export interface NoiseBank {
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
}

const sq = (v: number) => v * v;

export const DEFAULT_VOLUMES = { master: 0.7, music: 0.75, ambience: 0.8, sfx: 0.85 };

/** Global headroom trims (linear). Tuned with scripts/audio-check.mjs. */
const TRIM = { master: 0.9, music: 0.55, ambience: 0.6, sfx: 0.7 };

export class Rig {
  readonly sr: number;
  readonly rng: Rng;
  readonly bus: Buses;
  readonly waves: Waves;
  readonly noise: NoiseBank;
  readonly analyser: AnalyserNode;
  readonly counter: VoiceCounter = { active: 0 };
  started = 0;

  // Gates the engine automates.
  readonly musicGate: GainNode;
  readonly musicGateWet: GainNode;
  readonly worldFilter: BiquadFilterNode;
  readonly worldGate: GainNode;
  readonly worldGateWet: GainNode;
  readonly freezeGate: GainNode;
  readonly cleanPath: GainNode;
  readonly crushPath: GainNode;
  readonly pauseGain: GainNode;
  readonly enableGain: GainNode;
  readonly hallReturn: GainNode;

  private vol: Record<string, GainNode> = {};
  private volumes = { ...DEFAULT_VOLUMES };

  constructor(
    readonly ctx: BaseAudioContext,
    seed: string | number,
  ) {
    this.sr = ctx.sampleRate;
    this.rng = createRng(typeof seed === "number" ? seed : `audio:${seed}`);
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };

    // ---------------------------------------------------------- master
    const preMaster = g();
    this.freezeGate = g();
    this.cleanPath = g(1);
    this.crushPath = g(0);
    const crusher = ctx.createWaveShaper();
    crusher.curve = crushCurve(4);
    const master = g(sq(this.volumes.master) * TRIM.master);
    this.vol.master = master;
    this.pauseGain = g(1);
    this.enableGain = g(1);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.25;
    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve();
    const out = g(1);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    preMaster.connect(this.freezeGate);
    this.freezeGate.connect(this.cleanPath).connect(master);
    this.freezeGate.connect(crusher).connect(this.crushPath).connect(master);
    master.connect(this.pauseGain).connect(this.enableGain).connect(limiter).connect(clip).connect(out);
    const uiVol = (this.vol.ui = g());
    uiVol.connect(this.enableGain);
    out.connect(ctx.destination);
    out.connect(this.analyser);

    // ---------------------------------------------------------- spaces
    const hallIn = g();
    const hall = ctx.createConvolver();
    hall.normalize = false;
    hall.buffer = makeImpulse(ctx, this.rng.fork("hall"), HALL);
    this.hallReturn = g(0.9);
    const hallTone = ctx.createBiquadFilter();
    hallTone.type = "lowshelf";
    hallTone.frequency.value = 180;
    hallTone.gain.value = -6; // keep the low end of the tail from clouding the rail
    hallIn.connect(hall).connect(hallTone).connect(this.hallReturn).connect(preMaster);
    const cabIn = g();
    const cabConv = ctx.createConvolver();
    cabConv.normalize = false;
    cabConv.buffer = makeImpulse(ctx, this.rng.fork("cab"), CAB);
    cabIn.connect(cabConv).connect(g(0.8)).connect(preMaster);

    // ---------------------------------------------------------- categories
    const musicVol = (this.vol.music = g());
    const musicVolWet = (this.vol.musicWet = g());
    const ambVol = (this.vol.amb = g());
    const ambVolWet = (this.vol.ambWet = g());
    const ambVolRoom = (this.vol.ambRoom = g());
    const sfxVol = (this.vol.sfx = g());
    const sfxVolWet = (this.vol.sfxWet = g());
    const sfxVolRoom = (this.vol.sfxRoom = g());
    musicVol.connect(preMaster);
    musicVolWet.connect(hallIn);
    ambVol.connect(preMaster);
    ambVolWet.connect(hallIn);
    ambVolRoom.connect(cabIn);
    sfxVol.connect(preMaster);
    sfxVolWet.connect(hallIn);
    sfxVolRoom.connect(cabIn);

    this.musicGate = g(1);
    this.musicGateWet = g(1);
    const music = g();
    const musicWet = g();
    music.connect(this.musicGate).connect(musicVol);
    musicWet.connect(this.musicGateWet).connect(musicVolWet);

    // The world is heard through the cab: a gentle lowpass that closes in tunnels.
    const world = g();
    const worldWet = g();
    this.worldFilter = ctx.createBiquadFilter();
    this.worldFilter.type = "lowpass";
    this.worldFilter.frequency.value = 9000;
    this.worldFilter.Q.value = 0.5;
    this.worldGate = g(1);
    this.worldGateWet = g(1);
    world.connect(this.worldFilter).connect(this.worldGate).connect(ambVol);
    // The world's reverb send blooms in the hall; tunnels duck it too.
    worldWet.connect(this.worldGateWet).connect(ambVolWet);

    const cab = g();
    const cabRoom = g();
    cab.connect(ambVol);
    cabRoom.connect(ambVolRoom);

    const sfx = g();
    const sfxWet = g();
    const sfxRoom = g();
    sfx.connect(sfxVol);
    sfxWet.connect(sfxVolWet);
    sfxRoom.connect(sfxVolRoom);

    const ui = g();
    ui.connect(uiVol);
    this.bus = { music, musicWet, world, worldWet, cab, cabRoom, sfx, sfxWet, sfxRoom, ui };
    this.applyVolumes(true);

    // ---------------------------------------------------------- shared material
    this.waves = {
      warm: wave(ctx, (n) => Math.pow(n, -1.55) * (n % 2 ? 1 : 0.72), 24),
      reed: wave(ctx, (n) => (n % 2 ? Math.pow(n, -1.05) : n === 2 ? 0.06 : 0.02 / n) * (n > 9 ? Math.pow(9 / n, 2) : 1), 20),
      organ: wave(ctx, (n) => [0, 1, 0.42, 0.18, 0.12, 0.05, 0.03][n] ?? 0, 6),
      hum: wave(ctx, (n) => [0, 1, 0.55, 0.3, 0.12, 0.2, 0.05, 0.08][n] ?? 0, 7),
      soft: wave(ctx, (n) => (n % 2 ? 1 / (n * n) : 0), 9),
      voice: wave(ctx, (n) => Math.pow(n, -1.1) * (1 + 0.25 * Math.sin(n * 1.7)), 40),
      blip: wave(ctx, (n) => (n % 2 ? 1 / n : 0.12 / n), 11),
    };
    this.noise = makeNoise(ctx, this.rng.fork("noise"));
  }

  setVolumes(v: { master?: number; music?: number; ambience?: number; sfx?: number }): void {
    const clamp = (x: number | undefined, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
    this.volumes = {
      master: clamp(v.master, this.volumes.master),
      music: clamp(v.music, this.volumes.music),
      ambience: clamp(v.ambience, this.volumes.ambience),
      sfx: clamp(v.sfx, this.volumes.sfx),
    };
    this.applyVolumes(false);
  }

  get currentVolumes(): typeof DEFAULT_VOLUMES {
    return { ...this.volumes };
  }

  private applyVolumes(immediate: boolean): void {
    const v = this.volumes;
    const set = (n: GainNode | undefined, x: number) => {
      if (!n) return;
      if (immediate) n.gain.value = x;
      else {
        n.gain.cancelScheduledValues(this.ctx.currentTime);
        n.gain.setTargetAtTime(x, this.ctx.currentTime, 0.06);
      }
    };
    set(this.vol.master, sq(v.master) * TRIM.master);
    const m = sq(v.music) * TRIM.music;
    set(this.vol.music, m);
    set(this.vol.musicWet, m);
    const a = sq(v.ambience) * TRIM.ambience;
    set(this.vol.amb, a);
    set(this.vol.ambWet, a);
    set(this.vol.ambRoom, a);
    const s = sq(v.sfx) * TRIM.sfx;
    set(this.vol.sfx, s);
    set(this.vol.sfxWet, s);
    set(this.vol.sfxRoom, s);
    set(this.vol.ui, s * sq(v.master) * TRIM.master);
  }

  // ------------------------------------------------------------ node helpers

  gain(v = 0): GainNode {
    const n = this.ctx.createGain();
    n.gain.value = v;
    return n;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.707, gainDb = 0): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (gainDb) f.gain.value = gainDb;
    return f;
  }

  osc(type: OscillatorType | PeriodicWave, freq: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (type instanceof PeriodicWave) o.setPeriodicWave(type);
    else o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    return o;
  }

  panner(p: number): StereoPannerNode {
    const n = this.ctx.createStereoPanner();
    n.pan.value = Math.max(-1, Math.min(1, p));
    return n;
  }

  source(buffer: AudioBuffer, loop = false): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    return s;
  }

  /** A looping noise bed that runs for the life of the engine. */
  bed(kind: keyof NoiseBank, offset: number): AudioBufferSourceNode {
    const s = this.source(this.noise[kind], true);
    s.start(this.ctx.currentTime, offset % this.noise[kind].duration);
    return s;
  }

  /**
   * Count a scheduled voice and tear its chain down when it ends. `cleanup`
   * disconnects whatever the voice left attached (its output gain, any LFO
   * feeding its params) so finished voices can be collected.
   */
  track(src: AudioScheduledSourceNode, cleanup: (() => void) | null, counter?: VoiceCounter): void {
    this.started++;
    this.counter.active++;
    if (counter) counter.active++;
    src.onended = () => {
      this.counter.active--;
      if (counter) counter.active--;
      try {
        cleanup?.();
      } catch {
        /* already disconnected */
      }
    };
  }
}

/** Target a param smoothly without piling up events. */
export function glide(param: AudioParam, value: number, at: number, tc: number): void {
  if (!Number.isFinite(value)) return;
  param.cancelScheduledValues(at);
  param.setTargetAtTime(value, at, Math.max(0.001, tc));
}

function wave(ctx: BaseAudioContext, amp: (n: number) => number, count: number): PeriodicWave {
  const real = new Float32Array(count + 1);
  const imag = new Float32Array(count + 1);
  for (let n = 1; n <= count; n++) imag[n] = amp(n);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/** Staircase curve: amplitude quantisation to `bits` bits (the "bitcrush"). */
function crushCurve(bits: number): Float32Array<ArrayBuffer> {
  const n = 4096;
  const curve = new Float32Array(n);
  const steps = Math.pow(2, bits - 1);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

/**
 * Unity below 0.55, a smooth knee above, and a hard ceiling at 0.89. The
 * WaveShaper clamps inputs outside [-1, 1] to the end values, so the output
 * can never reach full scale.
 */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 8193;
  const curve = new Float32Array(n);
  const knee = 0.55;
  const room = 0.34;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a < knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

function makeNoise(ctx: BaseAudioContext, rng: Rng): NoiseBank {
  const sr = ctx.sampleRate;
  const build = (seconds: number, kind: "white" | "pink" | "brown") => {
    const extra = 0.12;
    const buf = ctx.createBuffer(2, Math.floor((seconds - extra) * sr), sr);
    for (let ch = 0; ch < 2; ch++) {
      const raw = new Float32Array(Math.floor(seconds * sr));
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0,
        br = 0;
      for (let i = 0; i < raw.length; i++) {
        const w = rng.next() * 2 - 1;
        if (kind === "white") raw[i] = w * 0.5;
        else if (kind === "pink") {
          // Paul Kellet's refined pink filter.
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          br = (br + 0.02 * w) / 1.02;
          raw[i] = br * 3.2;
        }
      }
      buf.copyToChannel(makeLoopable(raw, sr, extra) as Float32Array<ArrayBuffer>, ch);
    }
    return buf;
  };
  return { white: build(2.3, "white"), pink: build(4.1, "pink"), brown: build(4.7, "brown") };
}
