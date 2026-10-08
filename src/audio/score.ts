/**
 * The adaptive score.
 *
 * A 16th-note transport runs on the audio clock. At each phrase boundary the
 * dominant palette chooses a progression (and sometimes chooses silence).
 * Twelve instrument layers listen to the same transport and harmony; their
 * levels follow the palette weights, so a stage change is a slow cross-fade
 * between ensembles that are always playing the same chord.
 *
 *   pad       warm detuned strings/organ bed          fields → dread, dawn
 *   musicbox  FM celesta / music box                  fields, dawn
 *   reed      clarinet-like lines, the theme recalled academy, dawn
 *   pulse     soft electronic pulses (Morrow)         institution, momentum
 *   ostinato  plucked rising figure                   momentum
 *   drone     detuned pedal on D                      dread, abyss
 *   cluster   close dissonant clusters                abyss
 *   choir     distant formant voices                  abyss
 *   sub       sub-bass swells                         abyss, dread
 *   sine      pure just-intoned sines                 perfection
 *   bell      a lone bell                             ruin (and far off, academy)
 *   broken    the theme on a damaged music box        ruin
 */
import type { Rng } from "../render/core/rng.ts";
import type { Bank } from "./bank.ts";
import { MUSIC, THEME, D, justFreq, mtof, scaleStep, themeNote, type Chord, type PaletteMusic } from "./harmony.ts";
import { PALETTES, type MoodState, type PaletteId, type PaletteWeights } from "./mood.ts";
import { glide, type Rig, type VoiceCounter } from "./rig.ts";

export type LayerId = "pad" | "musicbox" | "reed" | "pulse" | "ostinato" | "drone" | "cluster" | "choir" | "sub" | "sine" | "bell" | "broken";

/** How much of each layer each palette asks for. */
const AMOUNTS: Record<LayerId, Partial<Record<PaletteId, number>>> = {
  pad: { pastoral: 1, academy: 0.7, institution: 0.6, momentum: 0.55, dread: 0.5, dawn: 0.9 },
  musicbox: { pastoral: 1, academy: 0.22, institution: 0.08, dawn: 0.5 },
  reed: { pastoral: 0.12, academy: 1, institution: 0.3, momentum: 0.12, dread: 0.18, dawn: 0.75, ruin: 0.05 },
  pulse: { institution: 1, momentum: 0.55, dread: 0.12 },
  ostinato: { institution: 0.1, momentum: 1, dread: 0.3 },
  drone: { momentum: 0.2, dread: 1, abyss: 0.7, ruin: 0.3 },
  cluster: { dread: 0.2, abyss: 1 },
  choir: { dread: 0.3, abyss: 1, ruin: 0.12, dawn: 0.1 },
  sub: { momentum: 0.1, dread: 0.45, abyss: 1, ruin: 0.2 },
  sine: { perfection: 1 },
  bell: { academy: 0.1, dread: 0.1, abyss: 0.25, ruin: 1, dawn: 0.12 },
  broken: { ruin: 1 },
};

export interface Phrase {
  index: number;
  palette: PaletteId;
  music: PaletteMusic;
  chords: Chord[];
  barsPerChord: number;
  bars: number;
  steps: number;
  rest: boolean;
}

export interface Tick {
  time: number;
  /** Seconds per 16th / per beat at this step. */
  dur: number;
  beat: number;
  step: number;
  bar: number;
  phrase: Phrase;
  chord: Chord;
  chordIndex: number;
  chordStart: boolean;
  /** Approximate seconds until the chord changes (from this step). */
  chordLeft: number;
  w: PaletteWeights;
  mood: MoodState;
  bright: number;
  /** 1 = human feel, 0 = machine-quantised. */
  human: number;
  rng: Rng;
}

interface PlannedNote {
  beat: number;
  midi: number;
  beats: number;
  amp: number;
  detune?: number;
  freq?: number;
}

const chordAt = (p: Phrase, beat: number) => p.chords[Math.min(p.chords.length - 1, Math.floor(beat / (4 * p.barsPerChord)))]!;

/** Nearest chord tone to `near` within [lo, hi]. */
function chordTone(chord: Chord, near: number, lo: number, hi: number, rng: Rng, avoid = -1): number {
  const cands: number[] = [];
  const pcs = new Set(chord.tones.map((t) => ((t % 12) + 12) % 12));
  for (let m = lo; m <= hi; m++) if (pcs.has(((m % 12) + 12) % 12) && m !== avoid) cands.push(m);
  if (!cands.length) return near;
  cands.sort((a, b) => Math.abs(a - near) - Math.abs(b - near) + (rng.next() - 0.5) * 3);
  return cands[0]!;
}

// ------------------------------------------------------------------ voices

/** FM celesta / music-box tine. */
function tine(r: Rig, dest: AudioNode, counter: VoiceCounter, t: number, f: number, amp: number, o: { detune?: number; decay?: number; bright?: number; sag?: number } = {}): void {
  const detune = o.detune ?? 0;
  const decay = o.decay ?? 1.6;
  const bright = o.bright ?? 1;
  const car = r.osc("sine", f, detune);
  const mod = r.osc("sine", f, detune);
  const modG = r.gain(0);
  mod.connect(modG).connect(car.frequency);
  modG.gain.setValueAtTime(f * 2 * bright, t);
  modG.gain.setTargetAtTime(f * 0.08, t, 0.1);
  const part = r.osc("sine", f * 5.4, detune);
  const partG = r.gain(0);
  part.connect(partG);
  partG.gain.setValueAtTime(0, t);
  partG.gain.linearRampToValueAtTime(amp * 0.35 * bright, t + 0.001);
  partG.gain.setTargetAtTime(0, t + 0.001, 0.03);
  const g = r.gain(0);
  car.connect(g);
  partG.connect(g);
  g.connect(dest);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.002);
  g.gain.setTargetAtTime(0, t + 0.002, decay / 4);
  if (o.sag) {
    for (const n of [car, mod, part]) n.detune.setTargetAtTime(detune + o.sag, t + 0.05, decay / 2);
  }
  const end = t + decay * 1.4;
  for (const n of [car, mod, part]) {
    n.start(t);
    n.stop(end);
  }
  r.track(car, () => g.disconnect(), counter);
}

/** One sustained voice of two detuned oscillators with an ASR envelope. */
function sustain(
  r: Rig,
  dest: AudioNode,
  counter: VoiceCounter,
  wave: PeriodicWave | OscillatorType,
  f: number,
  t0: number,
  t1: number,
  amp: number,
  o: { attack: number; release: number; spread?: number; lfo?: AudioNode; pair?: boolean },
): void {
  const g = r.gain(0);
  g.connect(dest);
  const oscs: OscillatorNode[] = [];
  const spread = o.spread ?? 0;
  const pair = o.pair ?? true;
  for (const k of pair ? [-0.5, 0.5] : [0]) {
    const osc = r.osc(wave, f, k * spread + (r.rng.next() - 0.5) * 2);
    osc.connect(g);
    if (o.lfo) o.lfo.connect(osc.detune);
    oscs.push(osc);
  }
  const a = pair ? amp * 0.7 : amp;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(a, t0 + o.attack);
  g.gain.setValueAtTime(a, Math.max(t0 + o.attack, t1));
  g.gain.setTargetAtTime(0, Math.max(t0 + o.attack, t1), o.release / 3);
  const end = Math.max(t0 + o.attack, t1) + o.release * 1.6;
  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(end);
  }
  r.track(oscs[0]!, () => {
    g.disconnect();
    if (o.lfo) for (const osc of oscs) o.lfo.disconnect(osc.detune);
  }, counter);
}

/** An additive church bell (hum, prime, tierce, quint, nominal ...). */
export function bellStrike(r: Rig, dest: AudioNode, t: number, prime: number, amp: number, counter?: VoiceCounter, decayScale = 1): void {
  const partials: Array<[number, number, number]> = [
    [0.5, 9, 0.45],
    [1, 5, 0.4],
    [1.2, 4, 0.32],
    [1.5, 3, 0.12],
    [2, 3.5, 0.55],
    [2.51, 2.2, 0.16],
    [3, 2, 0.14],
    [4.02, 1.2, 0.08],
    [6.2, 0.08, 0.18],
  ];
  const g = r.gain(amp);
  g.connect(dest);
  let first: OscillatorNode | null = null;
  for (const [ratio, decay, a] of partials) {
    const o = r.osc("sine", prime * ratio, (r.rng.next() - 0.5) * 6);
    const pg = r.gain(0);
    o.connect(pg).connect(g);
    pg.gain.setValueAtTime(0, t);
    pg.gain.linearRampToValueAtTime(a, t + 0.003);
    pg.gain.setTargetAtTime(0, t + 0.003, (decay * decayScale) / 4);
    o.start(t);
    o.stop(t + decay * decayScale * 1.5 + 0.1);
    if (!first) first = o;
  }
  r.track(first!, () => g.disconnect(), counter);
}

// ------------------------------------------------------------------ layers

abstract class Layer {
  readonly counter: VoiceCounter = { active: 0 };
  readonly input: GainNode;
  readonly out: GainNode;
  readonly send: GainNode;
  weight = 0;
  protected rng: Rng;
  constructor(
    readonly id: LayerId,
    protected r: Rig,
    protected level: number,
    sendLevel: number,
    dry: AudioNode,
    wet: AudioNode,
  ) {
    this.rng = r.rng.fork(`layer:${id}`);
    this.input = r.gain(1);
    this.out = r.gain(0);
    this.send = r.gain(sendLevel);
    this.out.connect(dry);
    this.out.connect(this.send).connect(wet);
  }
  get on(): boolean {
    return this.weight > 0.012;
  }
  setWeight(w: number, now: number): void {
    this.weight = w;
    glide(this.out.gain, w * this.level, now, 1.2);
  }
  /** Humanised onset. */
  protected at(t: Tick, offsetBeats = 0): number {
    return t.time + offsetBeats * t.beat + (this.rng.next() - 0.5) * 0.02 * t.human;
  }
  protected vel(t: Tick, base: number): number {
    return base * (1 + (this.rng.next() - 0.5) * 0.45 * t.human);
  }
  phrase(_p: Phrase, _t: Tick): void {}
  tick(_t: Tick): void {}
  update(_now: number, _t: { mood: MoodState; w: PaletteWeights; bright: number; bpm: number }): void {}
}

/** Layers that plan a phrase of notes in beats and emit them as the transport passes. */
abstract class PlannedLayer extends Layer {
  protected plan: PlannedNote[] = [];
  protected cursor = 0;
  protected abstract play(t: Tick, n: PlannedNote, when: number): void;
  tick(t: Tick): void {
    const from = t.step / 4;
    const to = (t.step + 1) / 4;
    while (this.cursor < this.plan.length && this.plan[this.cursor]!.beat < to) {
      const n = this.plan[this.cursor++]!;
      if (n.beat >= from - 1e-6 && this.on) this.play(t, n, this.at(t, n.beat - from));
    }
  }
  protected reset(): void {
    this.plan = [];
    this.cursor = 0;
  }
}

class Pad extends Layer {
  private lp: BiquadFilterNode;
  private lfo: GainNode;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("pad", r, 0.5, 0.55, dry, wet);
    this.lp = r.filter("lowpass", 1800, 0.5);
    this.input.connect(this.lp).connect(this.out);
    const lfo = r.osc("sine", 0.11);
    this.lfo = r.gain(5);
    lfo.connect(this.lfo);
    lfo.start();
  }
  tick(t: Tick): void {
    if (!t.chordStart || t.phrase.rest || !this.on) return;
    const m = t.mood;
    const spread = 5 + 18 * (t.w.dread + t.w.ruin + t.w.abyss * 0.5) + 10 * m.ruin;
    const t0 = this.at(t);
    const t1 = t.time + t.chordLeft;
    const attack = t.w.pastoral > 0.5 ? 1.6 : 2.4;
    const notes = t.chord.tones.map((n) => [n, 0.05] as [number, number]);
    notes.push([t.chord.bass + 12, 0.035 * (1 - 0.6 * t.w.pastoral)]);
    // Late-stage unease: a minor ninth rubs against the bass.
    if (m.tension > 0.55 && t.w.pastoral + t.w.academy < 0.3) notes.push([t.chord.bass + 13, 0.018 * (m.tension - 0.4)]);
    for (const [n, a] of notes) {
      if (this.counter.active > 24) break;
      sustain(this.r, this.input, this.counter, this.r.waves.warm, mtof(n), t0, t1, this.vel(t, a), { attack, release: 3, spread, lfo: this.lfo });
    }
  }
  update(now: number, s: { bright: number }): void {
    glide(this.lp.frequency, 420 + 2600 * s.bright * s.bright, now, 1.5);
  }
}

class MusicBox extends PlannedLayer {
  private lp: BiquadFilterNode;
  private sinceTheme = 99;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("musicbox", r, 2.8, 0.5, dry, wet);
    this.lp = r.filter("lowpass", 6000, 0.5);
    this.input.connect(this.lp).connect(this.out);
  }
  phrase(p: Phrase): void {
    this.reset();
    if (p.rest) return;
    const rng = this.rng;
    const pastoral = p.palette === "pastoral" || p.palette === "dawn";
    // Sing in the palette's own mode (the pentatonic theme maps onto any diatonic scale).
    const scale = p.palette === "dawn" ? [0, 2, 4, 7, 9] : p.music.scale;
    const root = p.palette === "dawn" ? D : D + 12;
    if (pastoral && (this.sinceTheme >= 2 || rng.chance(0.35))) {
      this.sinceTheme = 0;
      let beat = p.palette === "dawn" ? 16 : 0;
      for (const n of THEME) {
        if (n.deg !== null && beat < p.bars * 4) this.plan.push({ beat, midi: themeNote(n.deg, scale, root), beats: n.beats, amp: 0.085 });
        beat += n.beats;
      }
      if (p.palette === "pastoral") {
        // An answering phrase, an octave up, sparser.
        for (let b = 16; b < p.bars * 4; b += 1) if (rng.chance(0.28)) this.plan.push({ beat: b + (rng.chance(0.3) ? 0.5 : 0), midi: themeNote(rng.int(2, 7), scale, root), beats: 1, amp: 0.05 });
      }
    } else {
      this.sinceTheme++;
      const density = pastoral ? 0.32 : 0.12;
      let deg = rng.int(2, 5);
      for (let b = 0; b < p.bars * 4; b += 0.5) {
        const bar = Math.floor(b / 4);
        if (bar % 4 === 3 && b % 4 >= 2) continue; // breathe at the end of each 4-bar line
        if (!rng.chance(b % 1 === 0 ? density : density * 0.45)) continue;
        deg = Math.max(0, Math.min(8, deg + rng.pick([-2, -1, -1, 1, 1, 2, 0])));
        this.plan.push({ beat: b, midi: themeNote(deg, scale, root), beats: 1, amp: 0.06 });
      }
    }
    this.plan.sort((a, b) => a.beat - b.beat);
  }
  protected play(t: Tick, n: PlannedNote, when: number): void {
    if (this.counter.active > 14) return;
    tine(this.r, this.input, this.counter, when, mtof(n.midi), this.vel(t, n.amp), { decay: 1.4 + (1 - t.bright) * 0.8, bright: 0.6 + 0.4 * t.bright });
  }
  update(now: number, s: { bright: number }): void {
    glide(this.lp.frequency, 1800 + 6000 * s.bright, now, 1.5);
  }
}

class Broken extends PlannedLayer {
  private drift = 0;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("broken", r, 1.5, 0.7, dry, wet);
    const lp = r.filter("lowpass", 3800, 0.5);
    this.input.connect(lp).connect(this.out);
  }
  phrase(p: Phrase): void {
    this.reset();
    if (p.rest || !this.rng.chance(0.75)) return;
    const rng = this.rng;
    let beat = rng.pick([0, 2, 4]);
    const total = p.bars * 4;
    const n = THEME.length;
    for (let i = 0; i < n; i++) {
      const note = THEME[i]!;
      const progress = beat / total;
      // Winding down: every note a little later than the last.
      const stretch = 1 + progress * 0.9 + rng.range(-0.05, 0.12);
      if (note.deg !== null && !rng.chance(0.28)) {
        this.drift = Math.max(-70, Math.min(40, this.drift + rng.range(-18, 14)));
        const midi = themeNote(note.deg, [0, 2, 4, 7, 9], D + 12);
        const detune = this.drift - progress * 45;
        this.plan.push({ beat, midi, beats: note.beats, amp: 0.075 * (1 - progress * 0.5), detune });
        if (rng.chance(0.12)) for (let k = 1; k <= rng.int(1, 3); k++) this.plan.push({ beat: beat + k * 0.2, midi, beats: 0.2, amp: 0.05, detune: detune - k * 6 });
      }
      beat += note.beats * stretch;
      if (beat >= total) break;
    }
    this.plan.sort((a, b) => a.beat - b.beat);
  }
  protected play(t: Tick, n: PlannedNote, when: number): void {
    tine(this.r, this.input, this.counter, when, mtof(n.midi), n.amp, { detune: n.detune ?? 0, decay: 2.2, bright: 0.55, sag: -25 });
  }
}

class Reed extends PlannedLayer {
  private lp: BiquadFilterNode;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("reed", r, 1.6, 0.6, dry, wet);
    this.lp = r.filter("lowpass", 2200, 0.7);
    this.input.connect(this.lp).connect(this.out);
  }
  phrase(p: Phrase): void {
    this.reset();
    if (p.rest) return;
    const rng = this.rng;
    const total = p.bars * 4;
    const quote = p.palette === "academy" || p.palette === "dawn" ? rng.chance(0.5) : rng.chance(0.15);
    if (quote) {
      let beat = 0;
      // Half speed; in the dawn an octave down, in the reed's low (chalumeau) register.
      const scale = p.palette === "dawn" ? [0, 2, 4, 7, 9] : p.music.scale;
      const root = p.palette === "dawn" ? D - 12 : D;
      for (const n of THEME) {
        const beats = n.beats * 2;
        if (n.deg !== null && beat < total) this.plan.push({ beat, midi: themeNote(n.deg, scale, root), beats: beats * 0.92, amp: 0.07 });
        beat += beats;
      }
    } else {
      let beat = rng.pick([0, 1, 2]);
      let last = 64;
      while (beat < total - 1) {
        if (rng.chance(0.35)) {
          beat += rng.pick([2, 3, 4]);
          continue;
        }
        const chord = chordAt(p, beat);
        const midi = chordTone(chord, last + rng.pick([-3, -2, 2, 3, 0]), 57, 72, rng);
        const beats = Math.min(rng.pick([2, 3, 4, 4, 6]), total - beat);
        this.plan.push({ beat, midi, beats: beats * 0.9, amp: 0.06 });
        last = midi;
        beat += beats;
      }
    }
    // A second, lower voice holding chord tones, some phrases only.
    if (p.palette !== "institution" && rng.chance(0.45)) {
      for (let ci = 0; ci < p.chords.length; ci++) {
        if (rng.chance(0.3)) continue;
        const chord = p.chords[ci]!;
        const beat = ci * 4 * p.barsPerChord + rng.pick([0, 1, 2]);
        this.plan.push({ beat, midi: chordTone(chord, 53, 48, 58, rng), beats: 4 * p.barsPerChord - 1.5, amp: 0.045 });
      }
    }
    this.plan.sort((a, b) => a.beat - b.beat);
  }
  protected play(t: Tick, n: PlannedNote, when: number): void {
    if (this.counter.active > 6) return;
    const r = this.r;
    const f = mtof(n.midi);
    const o = r.osc(r.waves.reed, f, (this.rng.next() - 0.5) * 4);
    const g = r.gain(0);
    o.connect(g).connect(this.input);
    const vib = r.osc("sine", 4.8 + this.rng.next() * 0.8);
    const vg = r.gain(0);
    vib.connect(vg).connect(o.detune);
    const dur = n.beats * t.beat;
    const amp = this.vel(t, n.amp);
    vg.gain.setValueAtTime(0, when);
    vg.gain.linearRampToValueAtTime(4 + 9 * t.human, when + Math.min(0.9, dur * 0.6));
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp * 0.8, when + 0.14);
    g.gain.linearRampToValueAtTime(amp, when + Math.max(0.15, dur * 0.5));
    g.gain.setTargetAtTime(0, when + dur, 0.14);
    const end = when + dur + 0.9;
    o.start(when);
    o.stop(end);
    vib.start(when);
    vib.stop(end);
    r.track(o, () => g.disconnect(), this.counter);
  }
  update(now: number, s: { bright: number }): void {
    glide(this.lp.frequency, 900 + 2200 * s.bright, now, 1.5);
  }
}

class Pulse extends Layer {
  private lp: BiquadFilterNode;
  private d1: DelayNode;
  private d2: DelayNode;
  private arp = 0;
  private dir = 1;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("pulse", r, 3.2, 0.35, dry, wet);
    this.lp = r.filter("lowpass", 2400, 3);
    this.input.connect(this.lp).connect(this.out);
    // Dotted-eighth ping-pong echo.
    this.d1 = r.ctx.createDelay(2);
    this.d2 = r.ctx.createDelay(2);
    const fb = r.gain(0.32);
    const tone = r.filter("lowpass", 1800, 0.5);
    const pl = r.panner(-0.55);
    const pr = r.panner(0.55);
    const echo = r.gain(0.5);
    this.lp.connect(this.d1);
    this.d1.connect(tone).connect(pl).connect(echo);
    tone.connect(this.d2).connect(pr).connect(echo);
    this.d2.connect(fb).connect(this.d1);
    echo.connect(this.out);
  }
  tick(t: Tick): void {
    if (t.phrase.rest || !this.on || t.step % 2 !== 0) return;
    const s8 = (t.step % 16) / 2;
    const downbeat = s8 === 0 || s8 === 4;
    const p = downbeat ? 0.95 : 0.42 + 0.35 * t.mood.tension;
    if (!this.rng.chance(p)) return;
    const tones = [...t.chord.tones.map((n) => n + 12)].sort((a, b) => a - b);
    this.arp += this.dir;
    if (this.arp >= tones.length - 1 || this.arp <= 0) this.dir = -this.dir;
    this.arp = Math.max(0, Math.min(tones.length - 1, this.arp));
    let midi = tones[this.arp]!;
    if (t.bar % 2 === 1 && s8 === 7 && this.rng.chance(0.5)) midi += 12; // a glint
    const when = this.at(t);
    const amp = this.vel(t, downbeat ? 0.06 : 0.04);
    const r = this.r;
    const o = r.osc(r.waves.blip, mtof(midi));
    const g = r.gain(0);
    o.connect(g).connect(this.input);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp, when + 0.004);
    g.gain.setTargetAtTime(0, when + 0.004, 0.09 + 0.05 * (1 - t.mood.tension));
    o.start(when);
    o.stop(when + 0.7);
    r.track(o, () => g.disconnect(), this.counter);
  }
  update(now: number, s: { bright: number; bpm: number }): void {
    const beat = 60 / s.bpm;
    glide(this.d1.delayTime, beat * 0.75, now, 0.5);
    glide(this.d2.delayTime, beat * 0.75, now, 0.5);
    glide(this.lp.frequency, 650 + 1500 * s.bright, now, 1.5);
  }
}

class Ostinato extends Layer {
  private lp: BiquadFilterNode;
  constructor(
    r: Rig,
    dry: AudioNode,
    wet: AudioNode,
    private bank: Bank,
  ) {
    super("ostinato", r, 1.7, 0.3, dry, wet);
    this.lp = r.filter("lowpass", 1400, 0.6);
    this.input.connect(this.lp).connect(this.out);
  }
  tick(t: Tick): void {
    if (t.phrase.rest || !this.on) return;
    const i = t.step % 8;
    const accent = i === 0 || i === 3 || i === 6;
    const sparse = t.w.momentum < t.w.dread || t.w.momentum < t.w.institution;
    if (sparse && !accent) return;
    // Rise one scale step per bar, an octave over the phrase.
    const base = t.bar % 8;
    const figure = [0, 2, 4, 2][t.step % 4]!;
    const scale = t.phrase.music.scale.length === 7 ? t.phrase.music.scale : [0, 2, 3, 5, 7, 8, 10];
    const midi = scaleStep(D - 12, base + figure, scale);
    const when = this.at(t);
    const r = this.r;
    const src = r.source(this.bank.pluck(midi));
    const g = r.gain(0);
    src.connect(g).connect(this.input);
    const amp = this.vel(t, accent ? 0.11 : 0.06);
    g.gain.setValueAtTime(amp, when);
    g.gain.setTargetAtTime(0, when + t.dur * 1.6, 0.05);
    src.start(when);
    src.stop(when + 0.7);
    r.track(src, () => g.disconnect(), this.counter);
  }
  update(now: number, s: { bright: number }): void {
    glide(this.lp.frequency, 380 + 900 * s.bright, now, 1.5);
  }
}

class Drone extends Layer {
  private lp: BiquadFilterNode;
  private oscs: OscillatorNode[] = [];
  private gains: GainNode[] = [];
  private idle = 0;
  private lastNow = 0;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("drone", r, 1.9, 0.45, dry, wet);
    this.lp = r.filter("lowpass", 320, 0.9);
    const lfo = r.osc("sine", 0.047);
    const lg = r.gain(90);
    lfo.connect(lg).connect(this.lp.frequency);
    lfo.start();
    this.input.connect(this.lp).connect(this.out);
  }
  update(now: number, s: { mood: MoodState; w: PaletteWeights }): void {
    const dt = this.lastNow ? now - this.lastNow : 0;
    this.lastNow = now;
    if (this.weight > 0.01 && !this.oscs.length) this.startOscs(now);
    if (this.weight < 0.004 && this.oscs.length) {
      this.idle += dt;
      if (this.idle > 6) this.stopOscs(now);
    } else this.idle = 0;
    if (!this.oscs.length) return;
    const spread = 6 + 14 * s.mood.ruin + 10 * s.w.dread + 6 * s.mood.tension;
    const d = [0, spread, -spread * 0.8, 0];
    this.oscs.forEach((o, i) => glide(o.detune, d[i]!, now, 3));
    glide(this.gains[3]!.gain, 0.022 * (s.w.abyss + s.mood.tension * 0.3), now, 3);
  }
  private startOscs(now: number): void {
    const r = this.r;
    const specs: Array<[number, number, OscillatorType]> = [
      [mtof(38), 0.05, "sawtooth"],
      [mtof(45), 0.028, "sawtooth"],
      [mtof(50), 0.02, "sawtooth"],
      [mtof(39), 0, "sawtooth"], // E-flat, the rub
    ];
    for (const [f, a, type] of specs) {
      const o = r.osc(type, f);
      const g = r.gain(a);
      o.connect(g).connect(this.input);
      o.start(now);
      this.oscs.push(o);
      this.gains.push(g);
    }
    this.r.started += specs.length;
    this.counter.active = specs.length;
  }
  private stopOscs(now: number): void {
    for (const o of this.oscs) o.stop(now + 0.1);
    const gains = this.gains;
    this.oscs[0]!.onended = () => gains.forEach((g) => g.disconnect());
    this.oscs = [];
    this.gains = [];
    this.counter.active = 0;
  }
}

class Cluster extends Layer {
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("cluster", r, 0.6, 0.7, dry, wet);
    const lp = r.filter("lowpass", 900, 0.5);
    this.input.connect(lp).connect(this.out);
  }
  tick(t: Tick): void {
    if (!t.chordStart || t.phrase.rest || !this.on) return;
    const tones = t.phrase.palette === "abyss" ? t.chord.tones : t.chord.tones.slice(0, 3).map((n, i) => (i === 1 ? n + 1 : n));
    const t0 = this.at(t, this.rng.pick([0, 0.5, 1]));
    for (const n of tones) {
      if (this.counter.active > 12) break;
      sustain(this.r, this.input, this.counter, this.r.waves.organ, mtof(n), t0, t.time + t.chordLeft, this.vel(t, 0.045), { attack: 3.5, release: 4, spread: 7 });
    }
  }
}

const VOWELS: Record<string, [number, number, number]> = {
  ah: [730, 1090, 2440],
  oo: [320, 800, 2240],
  oh: [500, 880, 2500],
  eh: [530, 1840, 2480],
};

class Choir extends Layer {
  private formants: BiquadFilterNode[] = [];
  private vib: GainNode;
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("choir", r, 0.33, 1.1, dry, wet);
    const sum = r.gain(1);
    const gains = [1, 0.55, 0.22];
    VOWELS.ah.forEach((f, i) => {
      const bp = r.filter("bandpass", f, [7, 10, 12][i]!);
      this.input.connect(bp).connect(r.gain(gains[i]! * 2)).connect(sum);
      this.formants.push(bp);
    });
    const hp = r.filter("highpass", 160, 0.6);
    sum.connect(hp).connect(this.out);
    const lfo = r.osc("sine", 5.3);
    this.vib = r.gain(16);
    lfo.connect(this.vib);
    lfo.start();
  }
  tick(t: Tick): void {
    if (!t.chordStart || t.phrase.rest || !this.on) return;
    if (!this.rng.chance(t.phrase.palette === "abyss" ? 0.8 : 0.5)) return;
    const v = VOWELS[this.rng.pick(Object.keys(VOWELS))]!;
    this.formants.forEach((f, i) => glide(f.frequency, v[i]!, t.time, 1.5));
    const pcs = t.chord.tones.map((n) => chordTone({ ...t.chord, tones: [n] }, 64, 57, 72, this.rng));
    const pick = [...new Set(pcs)].slice(0, t.phrase.palette === "abyss" ? 3 : 2);
    const t0 = this.at(t, this.rng.pick([0, 1, 2]));
    for (const n of pick) {
      if (this.counter.active > 8) break;
      sustain(this.r, this.input, this.counter, this.r.waves.voice, mtof(n), t0, t.time + t.chordLeft, this.vel(t, 0.05), { attack: 3, release: 4, spread: 9, lfo: this.vib });
    }
  }
}

class Sub extends Layer {
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("sub", r, 0.55, 0.05, dry, wet);
    this.input.connect(this.out);
  }
  tick(t: Tick): void {
    if (t.phrase.rest || !this.on) return;
    if (t.step % 64 !== 0 || !this.rng.chance(0.7)) return;
    const f = t.phrase.palette === "abyss" && this.rng.chance(0.35) ? mtof(27) : mtof(26);
    const r = this.r;
    const t0 = this.at(t);
    const g = r.gain(0);
    g.connect(this.input);
    const o = r.osc("sine", f);
    const o2 = r.osc("sine", f * 2);
    const g2 = r.gain(0.3);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 4);
    g.gain.setValueAtTime(0.22, t0 + 6);
    g.gain.setTargetAtTime(0, t0 + 6, 1.6);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 14);
    o2.stop(t0 + 14);
    r.track(o, () => g.disconnect(), this.counter);
  }
}

class Sine extends PlannedLayer {
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("sine", r, 1.3, 0.12, dry, wet);
    this.input.connect(this.out);
  }
  phrase(p: Phrase): void {
    this.reset();
    // Perfection never varies: the lullaby, whole, every phrase, on the grid.
    let beat = 0;
    for (const n of THEME) {
      if (n.deg !== null) this.plan.push({ beat, midi: themeNote(n.deg, [0, 2, 4, 7, 9], D + 12), beats: n.beats, amp: 0.05 });
      beat += n.beats;
    }
    beat = 16;
    for (const n of THEME) {
      if (n.deg !== null && beat < p.bars * 4) this.plan.push({ beat, midi: themeNote(n.deg, [0, 2, 4, 7, 9], D + 12), beats: n.beats, amp: 0.05 });
      beat += n.beats;
    }
  }
  tick(t: Tick): void {
    // Chords: exactly on the downbeat, exactly in tune.
    if (t.chordStart && this.on) {
      const t1 = t.time + t.chordLeft;
      const notes = [t.chord.bass + 12, ...t.chord.tones];
      for (const n of notes) {
        sustain(this.r, this.input, this.counter, "sine", justFreq(n), t.time, t1 - 0.05, 0.034, { attack: 0.5, release: 0.9, pair: false });
      }
    }
    const from = t.step / 4;
    const to = (t.step + 1) / 4;
    while (this.cursor < this.plan.length && this.plan[this.cursor]!.beat < to) {
      const n = this.plan[this.cursor++]!;
      if (n.beat >= from - 1e-6 && this.on) this.play(t, n, t.time + (n.beat - from) * t.beat);
    }
  }
  protected play(_t: Tick, n: PlannedNote, when: number): void {
    const r = this.r;
    const f = justFreq(n.midi);
    for (const [mult, a] of [
      [1, n.amp],
      [2, n.amp * 0.25],
    ] as const) {
      const o = r.osc("sine", f * mult);
      const g = r.gain(0);
      o.connect(g).connect(this.input);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(a, when + 0.004);
      g.gain.setTargetAtTime(0, when + 0.004, 0.25);
      o.start(when);
      o.stop(when + 1.6);
      r.track(o, () => g.disconnect(), this.counter);
    }
  }
}

class Bell extends Layer {
  constructor(r: Rig, dry: AudioNode, wet: AudioNode) {
    super("bell", r, 1.6, 0.9, dry, wet);
    const lp = r.filter("lowpass", 3200, 0.5);
    this.input.connect(lp).connect(this.out);
  }
  tick(t: Tick): void {
    if (!this.on || t.step % 16 !== 0) return;
    const pal = t.phrase.palette;
    const bar = t.bar;
    let prime = 0;
    let amp = 0;
    if (pal === "ruin") {
      if ((bar === 0 && this.rng.chance(0.85)) || (bar === 4 && this.rng.chance(0.4))) {
        prime = mtof(50);
        amp = 0.16;
      }
    } else if (pal === "abyss" || pal === "dread") {
      if (bar === 2 && this.rng.chance(0.3)) {
        prime = mtof(45);
        amp = 0.12;
      }
    } else if (bar === 0 && this.rng.chance(0.3)) {
      // B: its minor-third tierce is D, so the bell agrees with the academy's B minor.
      prime = mtof(59);
      amp = 0.07;
    }
    if (prime && this.counter.active < 3) bellStrike(this.r, this.input, this.at(t), prime, this.vel(t, amp), this.counter);
  }
}

// ------------------------------------------------------------------ the score

export class Score {
  readonly layers: Layer[];
  /** Phrase rest gate (strategic silence). */
  readonly dry: GainNode;
  readonly wet: GainNode;
  nextTime = 0;
  bpm = 64;
  phrase: Phrase | null = null;
  private stepInPhrase = 0;
  private phraseIndex = 0;
  private lastRest = false;
  private rng: Rng;
  private started = false;
  private chordLabel = "";
  private weights: PaletteWeights | null = null;

  /** Lab/debug: restrict to these layers. */
  solo: Set<string> | null = null;

  constructor(
    private r: Rig,
    bank: Bank,
    private mood: MoodState,
  ) {
    this.rng = r.rng.fork("score");
    this.dry = r.gain(1);
    this.wet = r.gain(1);
    this.dry.connect(r.bus.music);
    this.wet.connect(r.bus.musicWet);
    const d = this.dry;
    const w = this.wet;
    this.layers = [
      new Pad(r, d, w),
      new MusicBox(r, d, w),
      new Reed(r, d, w),
      new Pulse(r, d, w),
      new Ostinato(r, d, w, bank),
      new Drone(r, d, w),
      new Cluster(r, d, w),
      new Choir(r, d, w),
      new Sub(r, d, w),
      new Sine(r, d, w),
      new Bell(r, d, w),
      new Broken(r, d, w),
    ];
  }

  get chordName(): string {
    return this.chordLabel;
  }

  /** Control-rate update: tempo, layer levels, filters. */
  update(now: number, w: PaletteWeights, bright: number): void {
    this.weights = w;
    let bpm = 0;
    for (const k of PALETTES) bpm += w[k] * MUSIC[k].bpm(this.mood.speed, this.mood.tension);
    this.bpm = Math.max(36, Math.min(110, bpm || 60));
    for (const layer of this.layers) {
      let amt = 0;
      const table = AMOUNTS[layer.id];
      for (const k of PALETTES) amt += (table[k] ?? 0) * w[k];
      if (this.solo && !this.solo.has(layer.id)) amt = 0;
      layer.setWeight(amt, now);
      layer.update(now, { mood: this.mood, w, bright, bpm: this.bpm });
    }
  }

  schedule(until: number, now: number): void {
    const w = this.weights;
    if (!w) return;
    if (!this.started) {
      this.started = true;
      this.nextTime = now + 0.08;
    }
    // Fell behind (tab throttled, context resumed): skip rather than burst.
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;
    let guard = 0;
    while (this.nextTime < until && guard++ < 256) {
      const dur = 60 / this.bpm / 4;
      this.runStep(this.nextTime, dur, w);
      this.nextTime += dur;
    }
  }

  private runStep(time: number, dur: number, w: PaletteWeights): void {
    if (!this.phrase || this.stepInPhrase >= this.phrase.steps) this.newPhrase(time, w);
    const p = this.phrase!;
    const s = this.stepInPhrase;
    const chordSteps = 16 * p.barsPerChord;
    const chordIndex = Math.floor(s / chordSteps);
    const chord = p.chords[Math.min(p.chords.length - 1, chordIndex)]!;
    this.chordLabel = chord.name;
    const human = Math.max(0, 1 - this.mood.authority * 0.5) * (1 - this.mood.perfection * 0.8);
    const tick: Tick = {
      time,
      dur,
      beat: dur * 4,
      step: s,
      bar: Math.floor(s / 16),
      phrase: p,
      chord,
      chordIndex,
      chordStart: s % chordSteps === 0,
      chordLeft: (chordSteps - (s % chordSteps)) * dur,
      w,
      mood: this.mood,
      bright: this.brightness(w),
      human,
      rng: this.rng,
    };
    if (s === 0) for (const l of this.layers) l.phrase(p, tick);
    for (const l of this.layers) l.tick(tick);
    this.stepInPhrase++;
  }

  private newPhrase(time: number, w: PaletteWeights): void {
    const palette = this.mood.dominant(w);
    const music = MUSIC[palette];
    const chords = this.rng.pick(music.progressions);
    const rest = this.phraseIndex > 0 && !this.lastRest && this.rng.chance(music.rest);
    this.lastRest = rest;
    const bars = chords.length * music.barsPerChord;
    this.phrase = { index: this.phraseIndex++, palette, music, chords, barsPerChord: music.barsPerChord, bars, steps: bars * 16, rest };
    this.stepInPhrase = 0;
    // Strategic silence: the rail alone for a phrase.
    const target = rest ? 0 : 1;
    for (const g of [this.dry, this.wet]) {
      g.gain.cancelScheduledValues(time);
      g.gain.setTargetAtTime(target, time, rest ? 1.6 : 0.9);
    }
  }

  brightness(w: PaletteWeights): number {
    const m = this.mood;
    const stageDark = (m.stage - 1) * 0.085;
    const b = 1 - m.gloom * 0.45 - stageDark - m.ruin * 0.15 + w.perfection * 0.35;
    return Math.max(0.12, Math.min(1, b));
  }

  get resting(): boolean {
    return this.phrase?.rest ?? false;
  }
}
