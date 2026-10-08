/**
 * Designed one-shots for every cue the interface and renderer fire.
 *
 *   lever-arm      pawls ratchet over, a cast-iron detent clunks home
 *   lever-commit   a longer ratchet, the heavy throw, linkage rods under the floor
 *   lever-jam      metal-on-metal stop, the return spring sags back
 *   switch-throw   trackside point machine: motor whirr, blade slide, lock clack
 *   impact         a muffled thud and crunch through the floor (the score falls silent)
 *   glass-crack    one sharp tick, then fracture ticks spreading outward in stereo
 *   wiper          a rubber sweep across the screen, left to right
 *   thunder        distant rolling; close strikes crack first
 *   morrow-chime   a warm rising fourth that detunes as tension grows
 *   morrow-type    soft pitched keys: Morrow composing
 *   news-ping      two band-limited wire tones
 *   printer        a thermal head's stepper buzz, line feeds, the cutter
 *   glitch         the whole mix bit-crushed and stuttered
 *   freeze         the stutter, then total silence, then the world returns
 *   brake          shoe squeal, friction, an air release
 *   horn           a two-chime air horn heard from inside the cab
 *   ui-*           paper-and-pencil ticks and slides
 *   tunnel-in/out  pressure thump and air rush
 *   appointment    a rubber stamp, then a desk bell
 *   ending         a cadence in the voice of the ending
 */
import type { Bank, FoleyId } from "./bank.ts";
import { justFreq, mtof } from "./harmony.ts";
import type { MoodState } from "./mood.ts";
import type { Rig, VoiceCounter } from "./rig.ts";
import { bellStrike } from "./score.ts";
import type { AudioTrigger, TriggerOptions } from "./types.ts";
import type { Rng } from "../render/core/rng.ts";

export interface SfxHooks {
  /** Lower the score to `depth` for `hold` seconds. */
  duck(depth: number, hold: number): void;
  /** Take the score out entirely for `seconds` (the rail alone). */
  silenceMusic(seconds: number): void;
  /** Crush + stutter the whole mix for `seconds`. */
  crush(seconds: number): void;
  /** Stutter, then hard silence for `seconds`, then a slow return. */
  freeze(seconds: number): void;
}

interface Route {
  gain: number;
  pan?: number;
  /** Cab-room send (small metal box). */
  room?: number;
  /** Hall send (outdoors, distance). */
  wet?: number;
  rate?: number;
  ui?: boolean;
}

const MIN_GAP: Partial<Record<AudioTrigger, number>> = {
  "ui-tick": 0.03,
  "ui-open": 0.08,
  "ui-close": 0.08,
  "morrow-type": 0.3,
  "morrow-chime": 0.25,
  "news-ping": 0.2,
  printer: 0.35,
  impact: 0.06,
  "glass-crack": 0.08,
  thunder: 0.4,
  wiper: 0.4,
  "lever-arm": 0.05,
  "lever-jam": 0.1,
  glitch: 0.15,
  freeze: 1,
  horn: 0.4,
  brake: 0.6,
  appointment: 0.4,
  ending: 2,
};

export class Sfx {
  readonly counter: VoiceCounter = { active: 0 };
  private rng: Rng;
  private last = new Map<AudioTrigger, number>();

  constructor(
    private r: Rig,
    private bank: Bank,
    private mood: MoodState,
    private hooks: SfxHooks,
  ) {
    this.rng = r.rng.fork("sfx");
  }

  trigger(ev: AudioTrigger, opts: TriggerOptions = {}, now: number): void {
    const gap = MIN_GAP[ev] ?? 0.02;
    const last = this.last.get(ev) ?? -1e9;
    if (now - last < gap) return;
    this.last.set(ev, now);
    const t = now + 0.005;
    const k = typeof opts.intensity === "number" && Number.isFinite(opts.intensity) ? Math.max(0, Math.min(1, opts.intensity)) : 0.7;
    const pan = typeof opts.pan === "number" && Number.isFinite(opts.pan) ? Math.max(-1, Math.min(1, opts.pan)) : undefined;
    const m = this.mood;
    switch (ev) {
      case "lever-arm":
        this.play("lever-arm", t, { gain: 0.42 * (0.7 + 0.3 * k), pan: pan ?? 0.25, room: 0.55, rate: this.rng.range(0.97, 1.03) });
        break;
      case "lever-commit":
        this.play("lever-commit", t, { gain: 0.55, pan: pan ?? 0.25, room: 0.6 });
        this.hooks.duck(0.7, 1.2);
        break;
      case "lever-jam":
        this.play("lever-jam", t, { gain: 0.55, pan: pan ?? 0.25, room: 0.6 });
        break;
      case "switch-throw":
        this.play("switch", t + 0.02, { gain: 0.3, pan: pan ?? 0, wet: 0.35 });
        break;
      case "impact": {
        const heavy = k >= 0.6;
        this.play(heavy ? "impact-heavy" : "impact-light", t, { gain: 0.32 * (0.55 + 0.45 * k), pan: pan ?? 0, room: 0.35, wet: 0.08 });
        this.hooks.duck(0.35, 1.6);
        // After a life is taken, the score stops. Only the rail continues.
        if (k >= 0.7) this.hooks.silenceMusic(9 + 4 * k);
        break;
      }
      case "glass-crack":
        this.play("glass", t + 0.01, { gain: 0.42 * (0.55 + 0.45 * k), pan: pan ?? 0, room: 0.3 });
        break;
      case "wiper":
        this.play("wiper", t, { gain: 0.3, room: 0.25 });
        break;
      case "thunder":
        this.thunder(t, k, pan ?? this.rng.range(-0.6, 0.6));
        break;
      case "morrow-chime":
        this.chime(t, m.tension, m.perfection);
        break;
      case "morrow-type":
        this.play("type", t, { gain: 0.26, pan: pan ?? 0.1, room: 0.2, rate: 1 - m.tension * 0.025 });
        break;
      case "news-ping":
        this.play("news", t, { gain: 0.28, pan: pan ?? -0.15, room: 0.3 });
        break;
      case "printer":
        this.play("printer", t, { gain: 0.3, pan: pan ?? 0.2, room: 0.4, rate: this.rng.range(0.98, 1.02) });
        break;
      case "glitch":
        this.play("glitch", t, { gain: 0.26 * (0.5 + 0.5 * k), pan: pan ?? 0 });
        this.hooks.crush(0.22 + 0.45 * k);
        break;
      case "freeze":
        this.play("glitch", t, { gain: 0.3, pan: 0 });
        this.hooks.freeze(1.7);
        break;
      case "brake":
        this.play("brake", t, { gain: 0.34, pan: pan ?? 0, room: 0.3, wet: 0.04 });
        break;
      case "horn":
        this.horn(t, k);
        break;
      case "ui-tick":
        this.play("ui-tick", t, { gain: 0.16, pan: pan ?? 0, ui: true, rate: this.rng.range(0.96, 1.04) });
        break;
      case "ui-open":
        this.play("ui-open", t, { gain: 0.16, pan: pan ?? 0, ui: true });
        break;
      case "ui-close":
        this.play("ui-close", t, { gain: 0.16, pan: pan ?? 0, ui: true });
        break;
      case "tunnel-in":
        this.play("tunnel-in", t, { gain: 0.34 });
        break;
      case "tunnel-out":
        this.play("tunnel-out", t, { gain: 0.3 });
        break;
      case "appointment":
        this.play("stamp-bell", t, { gain: 0.38, pan: pan ?? 0, room: 0.45, wet: 0.1 });
        break;
      case "ending":
        this.ending(t, k);
        break;
      default:
        break;
    }
  }

  private play(id: FoleyId, t: number, o: Route): void {
    const r = this.r;
    const src = r.source(this.bank.next(id));
    if (o.rate) src.playbackRate.value = o.rate;
    const g = r.gain(o.gain);
    const p = r.panner(o.pan ?? 0);
    src.connect(g).connect(p);
    if (o.ui) p.connect(r.bus.ui);
    else {
      p.connect(r.bus.sfx);
      if (o.room) p.connect(r.gain(o.room)).connect(r.bus.sfxRoom);
      if (o.wet) p.connect(r.gain(o.wet)).connect(r.bus.sfxWet);
    }
    src.start(t);
    r.track(src, () => p.disconnect(), this.counter);
  }

  /** Output stage for synthesized cues: dry + optional hall send, panned. */
  private out(pan: number, wet: number, room = 0): { node: GainNode; done: () => void } {
    const r = this.r;
    const node = r.gain(1);
    const p = r.panner(pan);
    node.connect(p).connect(r.bus.sfx);
    if (wet) p.connect(r.gain(wet)).connect(r.bus.sfxWet);
    if (room) p.connect(r.gain(room)).connect(r.bus.sfxRoom);
    return { node, done: () => p.disconnect() };
  }

  /** Warm FM electric-piano pair: A5 rising to D6. Tension pulls it apart. */
  private chime(t: number, tension: number, perfection: number): void {
    const r = this.r;
    const skew = tension * (1 - perfection * 0.8);
    const { node, done } = this.out(0.15, 0.3, 0.2);
    const voices: Array<[number, number, number, number]> = [
      [mtof(81), 0, skew * 14, 0.16],
      [mtof(86), 0.16, -skew * 60, 0.16],
    ];
    if (skew > 0.45) {
      // A shadow a little under each note: the chime no longer agrees with itself.
      voices.push([mtof(81), 0.012, skew * 14 - (skew - 0.45) * 90, 0.07 * (skew - 0.45) * 2]);
      voices.push([mtof(86), 0.172, -skew * 60 - (skew - 0.45) * 120, 0.07 * (skew - 0.45) * 2]);
    }
    const cars: OscillatorNode[] = [];
    voices.forEach(([f, off, cents, amp], i) => {
      const at = t + off;
      const car = r.osc("sine", f, cents);
      const mod = r.osc("sine", f, cents);
      const mg = r.gain(0);
      mod.connect(mg).connect(car.frequency);
      mg.gain.setValueAtTime(f * 1.6, at);
      mg.gain.setTargetAtTime(f * 0.25, at, 0.22);
      const sh = r.osc("sine", f * 2, cents);
      const sg = r.gain(0);
      sh.connect(sg);
      sg.gain.setValueAtTime(0, at);
      sg.gain.linearRampToValueAtTime(amp * 0.12, at + 0.003);
      sg.gain.setTargetAtTime(0, at + 0.003, 0.1);
      const g = r.gain(0);
      car.connect(g);
      sg.connect(g);
      g.connect(node);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(amp, at + 0.004);
      g.gain.setTargetAtTime(0, at + 0.004, 0.45);
      if (i % 2 === 1 && skew > 0.2) for (const o of [car, mod, sh]) o.detune.setTargetAtTime(cents - skew * 30, at + 0.2, 0.5);
      for (const o of [car, mod, sh]) {
        o.start(at);
        o.stop(at + 2.6);
      }
      cars.push(car);
    });
    r.track(cars[0]!, () => setTimeoutSafe(done, 400), this.counter);
  }

  private horn(t: number, k: number): void {
    const r = this.r;
    const dur = 0.5 + k * 0.9;
    const { node, done } = this.out(0, 0.2);
    const lp = r.filter("lowpass", 2400, 0.7);
    const body = r.filter("peaking", 720, 1, 6);
    const g = r.gain(0);
    lp.connect(body).connect(g).connect(node);
    const oscs = [311.1, 370].map((f) => {
      const o = r.osc("sawtooth", f, -40);
      o.detune.setValueAtTime(-40, t);
      o.detune.linearRampToValueAtTime(0, t + 0.08);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
      return o;
    });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.05);
    g.gain.setValueAtTime(0.09, t + dur);
    g.gain.setTargetAtTime(0, t + dur, 0.08);
    r.track(oscs[0]!, done, this.counter);
  }

  /** Thunder: a rolling rumble with several swells; close strikes crack first. */
  thunder(t: number, k: number, pan: number): void {
    const r = this.r;
    const rng = this.rng;
    const close = k > 0.65;
    const { node, done } = this.out(pan, 0.5);
    if (close) {
      const crack = r.source(r.noise.white, true);
      const hp = r.filter("highpass", 1800, 0.6);
      const cg = r.gain(0);
      crack.connect(hp).connect(cg).connect(node);
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(0.5 * k, t + 0.002);
      cg.gain.setTargetAtTime(0, t + 0.002, 0.05);
      for (let i = 0; i < 3; i++) {
        const at = t + rng.range(0.03, 0.25);
        cg.gain.setValueAtTime(0.3 * k * rng.range(0.4, 1), at);
        cg.gain.setTargetAtTime(0, at, 0.03);
      }
      crack.start(t, rng.range(0, 2));
      crack.stop(t + 0.8);
    }
    const src = r.source(r.noise.brown, true);
    const lp = r.filter("lowpass", close ? 900 : 320, 0.7);
    lp.frequency.setValueAtTime(close ? 900 : 320, t);
    lp.frequency.exponentialRampToValueAtTime(close ? 220 : 110, t + 6);
    const g = r.gain(0);
    src.connect(lp).connect(g).connect(node);
    const len = 7.5;
    const n = 96;
    const curve = new Float32Array(n);
    const swells = rng.int(4, 7);
    const peaks = Array.from({ length: swells }, (_, i) => ({ at: (close ? 0.02 : 0.1) + rng.range(0, 0.7) * (i / swells + 0.1), w: rng.range(0.03, 0.12), a: rng.range(0.4, 1) * Math.pow(0.8, i) }));
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      let v = 0;
      for (const p of peaks) v += p.a * Math.exp(-(((x - p.at) / p.w) ** 2));
      curve[i] = Math.min(1.2, v) * (1 - x) * (0.35 + 0.65 * k) * 0.55;
    }
    curve[0] = 0;
    curve[n - 1] = 0;
    g.gain.setValueCurveAtTime(curve, t + (close ? 0.03 : 0.25), len);
    src.start(t, rng.range(0, 3));
    src.stop(t + len + 0.5);
    r.track(src, done, this.counter);
  }

  private ending(t: number, k: number): void {
    const r = this.r;
    const e = this.mood.ending;
    const { node, done } = this.out(0, 0.7);
    const end = t + 12;
    if (e.perfection >= e.ruin && e.perfection >= e.dawn) {
      // One flawless, just-intoned D major chord, far too clean.
      for (const m of [38, 50, 54, 57, 62, 66, 69, 74]) {
        const o = r.osc("sine", justFreq(m));
        const g = r.gain(0);
        o.connect(g).connect(node);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028 * k + 0.01, t + 2.5);
        g.gain.setValueAtTime(0.028 * k + 0.01, t + 7);
        g.gain.linearRampToValueAtTime(0, end);
        o.start(t);
        o.stop(end + 0.1);
        r.track(o, () => g.disconnect(), this.counter);
      }
    } else if (e.ruin >= e.dawn) {
      bellStrike(r, node, t, mtof(38), 0.22 * (0.6 + 0.4 * k), this.counter, 1.4);
    } else {
      // An open fifth and a ninth, low and warm, and the first note of the lullaby.
      for (const m of [38, 45, 52, 57]) {
        const o = r.osc(r.waves.warm, mtof(m), (this.rng.next() - 0.5) * 8);
        const lp = r.filter("lowpass", 1400, 0.5);
        const g = r.gain(0);
        o.connect(lp).connect(g).connect(node);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 3);
        g.gain.setValueAtTime(0.035, t + 6);
        g.gain.linearRampToValueAtTime(0, end);
        o.start(t);
        o.stop(end + 0.1);
        r.track(o, () => g.disconnect(), this.counter);
      }
    }
    setTimeoutSafe(done, (end - t + 1) * 1000);
  }
}

function setTimeoutSafe(fn: () => void, ms: number): void {
  // Offline renders finish before timers fire; leaving the node attached is harmless there.
  if (typeof setTimeout === "function") setTimeout(fn, ms);
}
