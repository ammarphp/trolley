/**
 * The world outside the glass, and the cab around the player.
 *
 * Beds (always running, level-controlled): wind with gusts and a cab-gap
 * whistle, rain hiss plus roof drumming, the cab's electrical hum, industrial
 * air-handling and transformer hum, a fire's low roar.
 *
 * Events (scheduled on the audio clock): birdsong in the fields, a town clock
 * bell in the academy, power-line crackle near the labs, checkpoint chimes
 * with a distant unintelligible PA and passing drones under surveillance,
 * crows and embers in the ruin, relay ticks while the machine drives, and in
 * perfection a single, exact, one-second clock.
 */
import type { Bank } from "./bank.ts";
import type { MoodState, PaletteWeights } from "./mood.ts";
import { glide, type Rig, type VoiceCounter } from "./rig.ts";
import { bellStrike } from "./score.ts";
import type { Rng } from "../render/core/rng.ts";

export interface AmbienceWeights {
  birds: number;
  townBell: number;
  industry: number;
  surveillance: number;
  wind: number;
  rain: number;
  fire: number;
  crows: number;
  clock: number;
  relay: number;
  hum: number;
}

type Thunder = (t: number, intensity: number, pan: number) => void;

export class Ambience {
  readonly counter: VoiceCounter = { active: 0 };
  weights: AmbienceWeights = { birds: 0, townBell: 0, industry: 0, surveillance: 0, wind: 0, rain: 0, fire: 0, crows: 0, clock: 0, relay: 0, hum: 1 };
  private rng: Rng;
  private next: Record<string, number> = {};
  // beds
  private windGust: GainNode;
  private windLow: GainNode;
  private windLowBp: BiquadFilterNode;
  private whistle: GainNode;
  private whistleBp: BiquadFilterNode;
  private rainHiss: GainNode;
  private roof: GainNode;
  private hum: GainNode;
  private humBeat: GainNode;
  private coil: GainNode;
  private industryAir: GainNode;
  private industryHum: GainNode;
  private fireRoar: GainNode;
  private dropPans: StereoPannerNode[];
  private paused = false;

  constructor(
    private r: Rig,
    private bank: Bank,
    private mood: MoodState,
    private thunder: Thunder,
  ) {
    this.rng = r.rng.fork("ambience");
    const world = r.bus.world;
    const cab = r.bus.cab;

    // Wind.
    this.windGust = r.gain(1);
    this.windLowBp = r.filter("bandpass", 380, 0.6);
    this.windLow = r.gain(0);
    this.whistleBp = r.filter("bandpass", 1300, 9);
    this.whistle = r.gain(0);
    const wind = r.bed("pink", 0.2);
    wind.connect(this.windGust);
    this.windGust.connect(this.windLowBp).connect(this.windLow).connect(world);
    this.windGust.connect(this.whistleBp).connect(this.whistle).connect(cab);

    // Rain: hiss on the land, drumming on the roof.
    this.rainHiss = r.gain(0);
    r.bed("white", 0.9).connect(r.filter("highpass", 900, 0.6)).connect(r.filter("lowpass", 7000, 0.6)).connect(this.rainHiss).connect(world);
    this.roof = r.gain(0);
    r.bed("brown", 2.1).connect(r.filter("lowpass", 450, 0.7)).connect(this.roof).connect(cab);

    // Cab electrics: mains hum, and (from the institution on) a thin coil whine.
    this.hum = r.gain(0);
    const hum = r.osc(r.waves.hum, 50);
    hum.connect(r.filter("lowpass", 700, 0.7)).connect(this.hum).connect(cab);
    hum.start();
    this.humBeat = r.gain(0);
    const hum2 = r.osc(r.waves.hum, 50.7);
    hum2.connect(this.humBeat).connect(cab);
    hum2.start();
    this.coil = r.gain(0);
    const coil = r.osc("sine", 7350);
    coil.connect(this.coil).connect(cab);
    coil.start();

    // Industry: air handling and a transformer.
    this.industryAir = r.gain(0);
    r.bed("brown", 3.3).connect(r.filter("lowpass", 380, 0.7)).connect(this.industryAir).connect(world);
    this.industryHum = r.gain(0);
    const tx = r.osc(r.waves.hum, 100);
    tx.connect(r.filter("lowpass", 1200, 0.7)).connect(this.industryHum).connect(world);
    tx.start();

    // Raindrops on the glass and roof share three fixed pans (no per-drop panner).
    this.dropPans = [-0.7, 0, 0.7].map((pan) => {
      const pn = r.panner(pan);
      pn.connect(cab);
      return pn;
    });

    // Fire.
    this.fireRoar = r.gain(0);
    r.bed("brown", 1.7).connect(r.filter("bandpass", 260, 0.6)).connect(this.fireRoar).connect(world);
  }

  update(now: number, w: PaletteWeights, paused: boolean): void {
    this.paused = paused;
    const m = this.mood;
    const clear = (1 - m.storm) * (1 - 0.7 * m.gloom) * (1 - 0.7 * m.rain);
    const late = Math.max(0, Math.min(1, m.stage - 4));
    const a: AmbienceWeights = {
      birds: (w.pastoral + 0.45 * w.academy + 0.1 * w.institution + 0.35 * w.dawn) * clear,
      townBell: w.academy + 0.2 * w.pastoral,
      industry: 0.8 * w.institution + w.momentum + 0.4 * w.dread + 0.25 * w.perfection,
      surveillance: w.dread + 0.25 * w.momentum + 0.5 * w.abyss,
      wind: Math.min(1, (0.12 + 0.75 * m.storm + 0.3 * w.abyss + 0.7 * w.ruin + 0.15 * w.dread + 0.1 * m.gloom) * (1 - 0.95 * w.perfection)),
      rain: m.rain,
      fire: w.ruin * Math.max(0.4, m.ruin) + 0.3 * late * m.ruin * (1 - w.ruin),
      crows: w.ruin + 0.2 * w.abyss + 0.1 * w.dread,
      clock: w.perfection,
      relay: Math.max(0, Math.min(1, m.authority)) * (1 - w.ruin),
      hum: 1,
    };
    this.weights = a;
    const k = paused ? 0 : 1;
    glide(this.windLow.gain, 0.2 * a.wind * k, now, 1.2);
    glide(this.whistle.gain, 0.05 * Math.max(0, a.wind - 0.35) * k, now, 1.5);
    glide(this.rainHiss.gain, 0.06 * a.rain * k, now, 1);
    glide(this.roof.gain, 0.1 * a.rain * k, now, 1);
    // The cab's power: steady under the machine, failing in the ruin.
    glide(this.hum.gain, 0.02 * (1 + 0.4 * Math.max(0, m.authority - 1)) * (1 - 0.85 * w.ruin), now, 1);
    glide(this.humBeat.gain, 0.012 * Math.max(0, m.authority - 1), now, 2);
    glide(this.coil.gain, 0.0016 * (w.institution + w.momentum + 0.6 * w.dread + w.perfection) * k, now, 2);
    glide(this.industryAir.gain, 0.12 * a.industry * k, now, 2);
    glide(this.industryHum.gain, 0.012 * a.industry * k, now, 2);
    glide(this.fireRoar.gain, 0.16 * a.fire * k, now, 2);
  }

  schedule(until: number, now: number): void {
    if (this.paused) {
      for (const key of Object.keys(this.next)) this.next[key] = 0;
      return;
    }
    const a = this.weights;
    this.run("gust", a.wind, 0.02, until, now, () => this.rng.range(2.5, 7), (t) => this.gust(t));
    this.run("birds", a.birds, 0.04, until, now, () => this.rng.range(0.7, 4.2) / (0.35 + a.birds), (t) => this.bird(t, a.birds));
    this.run("bell", a.townBell, 0.2, until, now, () => this.rng.range(26, 48), (t) => this.townBell(t, a.townBell));
    this.run("crackle", a.industry, 0.25, until, now, () => this.rng.range(0.3, 2.4) / a.industry, (t) => this.crackle(t, 0.05 * a.industry, 0.4));
    this.run("chime", a.surveillance, 0.3, until, now, () => this.rng.range(30, 55), (t) => this.checkpoint(t, a.surveillance));
    this.run("drone", a.surveillance, 0.25, until, now, () => this.rng.range(16, 38), (t) => this.flyby(t, a.surveillance));
    this.run("crow", a.crows, 0.15, until, now, () => this.rng.range(8, 24) / (0.3 + a.crows), (t) => this.crow(t, a.crows));
    this.run("ember", a.fire, 0.05, until, now, () => this.rng.range(0.03, 0.35) / (0.2 + a.fire), (t) => this.crackle(t, 0.07 * a.fire, 0.9));
    this.run("relay", a.relay, 0.2, until, now, () => this.rng.range(1.8, 3.6), (t) => this.play("relay", t, 0.08 * a.relay, this.rng.range(0.15, 0.4), this.r.bus.cab));
    this.run("clock", a.clock, 0.05, until, now, () => 1, (t) => this.play("clock", t, 0.1 * a.clock, 0, this.r.bus.world, 0.4));
    this.run("drops", a.rain, 0.05, until, now, () => this.rng.range(0.01, 0.15) / a.rain, (t) => this.drop(t, this.rng.range(0.03, 0.09) * a.rain));
    const storm = this.mood.storm;
    this.run("thunder", storm > 0.55 ? storm : 0, 0.55, until, now, () => this.rng.range(24, 60), (t) => this.thunder(t, this.rng.range(0.1, 0.3), this.rng.range(-0.8, 0.8)));
  }

  /** A Poisson-ish event stream that only runs while its weight is meaningful. */
  private run(key: string, weight: number, threshold: number, until: number, now: number, gap: () => number, fire: (t: number) => void): void {
    if (weight < threshold) {
      this.next[key] = 0;
      return;
    }
    let t = this.next[key] ?? 0;
    if (!t || t < now - 0.2) t = now + gap() * this.rng.range(0.2, 1);
    let guard = 0;
    while (t < until && guard++ < 64) {
      fire(t);
      t += Math.max(0.004, gap());
    }
    this.next[key] = t;
  }

  private play(id: Parameters<Bank["next"]>[0], t: number, amp: number, pan: number, dest: AudioNode, wet = 0): void {
    const src = this.r.source(this.bank.next(id));
    const g = this.r.gain(amp);
    const p = this.r.panner(pan);
    src.connect(g).connect(p).connect(dest);
    if (wet > 0) p.connect(this.r.gain(wet)).connect(this.r.bus.worldWet);
    src.start(t);
    this.r.track(src, () => p.disconnect(), this.counter);
  }

  private drop(t: number, amp: number): void {
    const src = this.r.source(this.bank.next("drop"));
    src.playbackRate.value = this.rng.range(0.8, 1.25);
    const g = this.r.gain(amp);
    src.connect(g).connect(this.rng.pick(this.dropPans));
    src.start(t);
    this.r.track(src, () => g.disconnect(), this.counter);
  }

  private gust(t: number): void {
    const rng = this.rng;
    glide(this.windGust.gain, rng.range(0.45, 1.5), t, rng.range(0.6, 1.8));
    glide(this.windLowBp.frequency, rng.range(240, 620), t, 1.2);
    glide(this.whistleBp.frequency, rng.range(900, 1750), t, 1.5);
  }

  /** One phrase of birdsong: one oscillator, one envelope, many notes. */
  private bird(t: number, weight: number): void {
    const r = this.r;
    const rng = this.rng;
    const o = r.osc("sine", 3000);
    const g = r.gain(0);
    const p = r.panner(rng.range(-0.9, 0.9));
    o.connect(g).connect(p).connect(r.bus.world);
    p.connect(r.gain(0.35)).connect(r.bus.worldWet);
    const amp = rng.range(0.025, 0.06) * Math.min(1, 0.4 + weight);
    const species = rng.pick(["warbler", "fluty", "chiff", "trill"] as const);
    let at = t;
    const note = (f0: number, f1: number, len: number, a: number) => {
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(Math.max(50, f1), at + len);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(a, at + Math.min(0.012, len * 0.3));
      g.gain.linearRampToValueAtTime(0, at + len);
    };
    if (species === "warbler") {
      const base = rng.range(3200, 5200);
      const n = rng.int(5, 12);
      for (let i = 0; i < n; i++) {
        const f = base * rng.range(0.88, 1.15);
        const len = rng.range(0.035, 0.06);
        note(f, f * rng.range(0.65, 0.8), len, amp);
        at += len + rng.range(0.015, 0.035);
      }
    } else if (species === "fluty") {
      const n = rng.int(3, 6);
      for (let i = 0; i < n; i++) {
        const f = rng.pick([1580, 1780, 2000, 2240, 2660, 2990]);
        const len = rng.range(0.11, 0.28);
        note(f, f * rng.range(0.9, 1.12), len, amp * 1.2);
        at += len + rng.range(0.03, 0.09);
      }
    } else if (species === "chiff") {
      const n = rng.int(6, 10);
      const hi = rng.range(4900, 5400);
      const lo = hi * 0.86;
      for (let i = 0; i < n; i++) {
        const f = i % 2 ? lo : hi;
        note(f, f * 0.93, 0.075, amp * 0.8);
        at += rng.range(0.28, 0.36);
      }
    } else {
      const n = rng.int(14, 24);
      const f = rng.range(3600, 4600);
      for (let i = 0; i < n; i++) {
        note(i % 2 ? f : f * 1.18, f * 1.05, 0.025, amp * 0.7);
        at += 0.04;
      }
    }
    o.start(t);
    o.stop(at + 0.05);
    this.r.track(o, () => p.disconnect(), this.counter);
  }

  private townBell(t: number, weight: number): void {
    const strikes = this.rng.int(1, 3);
    const out = this.r.gain(1);
    const p = this.r.panner(this.rng.range(-0.7, 0.7));
    out.connect(p);
    p.connect(this.r.gain(0.25)).connect(this.r.bus.world);
    p.connect(this.r.gain(0.9)).connect(this.r.bus.worldWet);
    // B3 or F#3: bells whose minor-third tierce stays inside D major.
    const prime = this.rng.chance(0.5) ? 246.94 : 185;
    for (let i = 0; i < strikes; i++) bellStrike(this.r, out, t + i * 2.4, prime, 0.07 * weight, this.counter, 0.8);
  }

  private crackle(t: number, amp: number, pan: number): void {
    this.play("crackle", t, amp * this.rng.range(0.4, 1), this.rng.range(-pan, pan), this.r.bus.world, 0.15);
  }

  private crow(t: number, weight: number): void {
    const n = this.rng.int(1, 3);
    const pan = this.rng.range(-0.9, 0.9);
    let at = t;
    for (let i = 0; i < n; i++) {
      this.play("crow", at, 0.07 * Math.min(1, weight), pan, this.r.bus.world, 0.9);
      at += this.rng.range(0.4, 0.62);
    }
  }

  /** Institutional three-note chime, then a far loudspeaker voice nobody can make out. */
  private checkpoint(t: number, weight: number): void {
    const r = this.r;
    const rng = this.rng;
    const out = r.gain(0.05 * Math.min(1, weight));
    const p = r.panner(rng.range(-0.8, 0.8));
    const band = r.filter("bandpass", 1400, 0.8);
    out.connect(band).connect(p);
    p.connect(r.gain(0.3)).connect(r.bus.world);
    p.connect(r.gain(1)).connect(r.bus.worldWet);
    const notes = [698.5, 587.3, 440];
    notes.forEach((f, i) => {
      const at = t + i * 0.42;
      const o = r.osc("sine", f);
      const m = r.osc("sine", f * 2);
      const mg = r.gain(f * 0.6);
      m.connect(mg).connect(o.frequency);
      const g = r.gain(0);
      o.connect(g).connect(out);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.005);
      g.gain.setTargetAtTime(0, at + 0.005, 0.35);
      o.start(at);
      m.start(at);
      o.stop(at + 1.8);
      m.stop(at + 1.8);
      r.track(o, () => g.disconnect(), this.counter);
    });
    // The announcement: a pitched buzz through jumping formants, like speech too far to parse.
    const start = t + 1.7;
    const len = rng.range(2, 4);
    const voice = r.osc("sawtooth", rng.range(105, 135));
    const f1 = r.filter("bandpass", 600, 5);
    const f2 = r.filter("bandpass", 1500, 7);
    const vg = r.gain(0);
    const horn = r.ctx.createWaveShaper();
    horn.curve = megaphone();
    voice.connect(f1).connect(vg);
    voice.connect(f2).connect(vg);
    vg.connect(horn).connect(r.gain(0.6)).connect(out);
    let at = start;
    while (at < start + len) {
      const syl = rng.range(0.09, 0.2);
      const v = rng.pick([
        [700, 1200],
        [400, 2000],
        [550, 900],
        [300, 2300],
        [650, 1700],
      ] as const);
      f1.frequency.setValueAtTime(v[0], at);
      f2.frequency.setValueAtTime(v[1], at);
      voice.frequency.setValueAtTime(rng.range(100, 140), at);
      vg.gain.setValueAtTime(0, at);
      vg.gain.linearRampToValueAtTime(rng.range(0.6, 1), at + 0.025);
      vg.gain.linearRampToValueAtTime(0, at + syl);
      at += syl + (rng.chance(0.2) ? rng.range(0.15, 0.3) : 0.02);
    }
    voice.start(start);
    voice.stop(at + 0.1);
    r.track(voice, () => {
      vg.disconnect();
      p.disconnect();
    }, this.counter);
  }

  private flyby(t: number, weight: number): void {
    const r = this.r;
    const rng = this.rng;
    const dur = rng.range(5.5, 8.5);
    const f = rng.range(180, 230);
    const g = r.gain(0);
    const p = r.panner(0);
    const side = rng.chance(0.5) ? 1 : -1;
    p.pan.setValueAtTime(-0.9 * side, t);
    p.pan.linearRampToValueAtTime(0.9 * side, t + dur);
    const bp = r.filter("bandpass", 900, 0.7);
    const lp = r.filter("lowpass", 3000, 0.6);
    bp.connect(lp).connect(g).connect(p).connect(r.bus.world);
    p.connect(r.gain(0.3)).connect(r.bus.worldWet);
    const oscs = [f, f * 1.037, f * 1.52].map((fr) => {
      const o = r.osc("sawtooth", fr * 1.03);
      o.frequency.setValueAtTime(fr * 1.03, t);
      o.frequency.linearRampToValueAtTime(fr * 1.01, t + dur * 0.45);
      o.frequency.linearRampToValueAtTime(fr * 0.97, t + dur * 0.6);
      o.connect(bp);
      o.start(t);
      o.stop(t + dur + 0.1);
      return o;
    });
    const peak = 0.03 * Math.min(1, weight);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak * 0.3, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    r.track(oscs[0]!, () => p.disconnect(), this.counter);
  }
}

let megaphoneCurve: Float32Array<ArrayBuffer> | null = null;
function megaphone(): Float32Array<ArrayBuffer> {
  if (megaphoneCurve) return megaphoneCurve;
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 3.5) * 0.7;
  }
  megaphoneCurve = c;
  return c;
}
