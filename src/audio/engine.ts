/**
 * createAudioEngine(): the synthesized sound engine for trolley.
 *
 * All timing runs on the audio clock. A control step (every 50 ms in the
 * browser, or on demand when rendering offline) glides the mood, updates
 * levels and filters, then schedules notes, rail joints and world events up
 * to a short lookahead. Timer jitter therefore never reaches the audio: it
 * only decides how early each event is queued.
 */
import { Ambience } from "./ambience.ts";
import { Bank } from "./bank.ts";
import { MoodState, PALETTES, type PaletteWeights } from "./mood.ts";
import { Rail } from "./rail.ts";
import { Rig, glide } from "./rig.ts";
import { Score } from "./score.ts";
import { Sfx } from "./sfx.ts";
import { AUDIO_TRIGGERS, type AudioEngineOptions, type AudioInspection, type AudioMood, type AudioTrigger, type AudioVolumes, type RailState, type SynthAudioEngine, type TriggerOptions } from "./types.ts";

const CONTROL_MS = 50;
const IDLE_SUSPEND_S = 30;

type Ctor = new (options?: AudioContextOptions) => AudioContext;

export function createAudioEngine(options: AudioEngineOptions = {}): SynthAudioEngine {
  return new Engine(options);
}

class Engine implements SynthAudioEngine {
  private ctx: BaseAudioContext | null = null;
  private owned = false;
  private rig: Rig | null = null;
  private bank: Bank | null = null;
  private mood = new MoodState();
  private score: Score | null = null;
  private rail: Rail | null = null;
  private amb: Ambience | null = null;
  private sfx: Sfx | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastControl = 0;
  private enabled = true;
  private paused = false;
  /** Last moment the paused engine was asked to make a sound (idle-suspend clock). */
  private idleSince = 0;
  private suspendedForIdle = false;
  private disposed = false;
  private pendingVolumes: AudioVolumes = {};
  private pendingRail: RailState | null = null;
  private musicHoldUntil = 0;
  private freezeUntil = 0;
  private lastTunnel: boolean | null = null;
  private tunnelCueAt = -1e9;
  private weights: PaletteWeights | null = null;
  private readonly seed: string | number;
  private readonly manual: boolean;
  private readonly lookahead: number;
  private readonly solo: string[] | null;

  constructor(options: AudioEngineOptions) {
    this.solo = options.solo?.length ? [...options.solo] : null;
    this.seed = options.seed ?? "trolley";
    this.manual = !!options.manual;
    this.lookahead = Math.max(0.05, options.lookahead ?? 0.4);
    if (options.context) this.build(options.context);
  }

  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  get analyser(): AnalyserNode | null {
    return this.rig?.analyser ?? null;
  }

  // ------------------------------------------------------------------ lifecycle

  async unlock(): Promise<void> {
    if (this.disposed) return;
    if (!this.ctx) {
      const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
      const AC = g.AudioContext ?? g.webkitAudioContext;
      if (!AC) return;
      try {
        this.build(new AC({ latencyHint: "interactive" }));
        this.owned = true;
      } catch {
        return;
      }
    }
    await this.resume();
    this.startTimer();
    this.warmBank();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    const r = this.rig;
    if (!r) return;
    const now = r.ctx.currentTime;
    r.enableGain.gain.cancelScheduledValues(now);
    r.enableGain.gain.setTargetAtTime(on ? 1 : 0, now, on ? 0.15 : 0.04);
    if (on) {
      void this.resume();
      this.startTimer();
    } else {
      this.stopTimer();
      this.suspendLater(250);
    }
  }

  setVolumes(v: AudioVolumes): void {
    this.pendingVolumes = { ...this.pendingVolumes, ...v };
    this.rig?.setVolumes(v);
  }

  pause(p: boolean): void {
    if (p === this.paused) return;
    this.paused = p;
    const r = this.rig;
    if (!r) return;
    const now = r.ctx.currentTime;
    this.idleSince = now;
    r.pauseGain.gain.cancelScheduledValues(now);
    r.pauseGain.gain.setTargetAtTime(p ? 0 : 1, now, p ? 0.08 : 0.3);
    if (!p) {
      void this.resume();
      this.step();
    }
  }

  setMood(m: AudioMood): void {
    if (!m || typeof m !== "object") return;
    this.mood.set(m);
  }

  setRail(r: RailState): void {
    if (!r || typeof r !== "object") return;
    this.pendingRail = r;
    this.rail?.set(r);
    // Entering or leaving a tunnel is heard even if nobody fires the cue.
    const inTunnel = !!r.inTunnel;
    if (this.lastTunnel !== null && inTunnel !== this.lastTunnel && !this.paused) this.trigger(inTunnel ? "tunnel-in" : "tunnel-out");
    this.lastTunnel = inTunnel;
  }

  trigger(ev: AudioTrigger, opts?: TriggerOptions): void {
    if (!this.sfx || !this.rig || !this.enabled || this.disposed) return;
    if (!(AUDIO_TRIGGERS as readonly string[]).includes(ev)) return;
    const now = this.rig.ctx.currentTime;
    if (ev === "tunnel-in" || ev === "tunnel-out") {
      // The explicit cue and the rail edge describe the same portal: play whichever comes first.
      if (now - this.tunnelCueAt < 4) return;
      this.tunnelCueAt = now;
    }
    this.idleSince = now;
    if (this.suspendedForIdle) void this.resume();
    this.sfx.trigger(ev, opts ?? {}, now);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimer();
    const ctx = this.ctx;
    if (this.owned && ctx && "close" in ctx) void (ctx as AudioContext).close().catch(() => undefined);
    this.rig = null;
    this.score = null;
    this.rail = null;
    this.amb = null;
    this.sfx = null;
    this.ctx = null;
  }

  // ------------------------------------------------------------------ clock

  step(): void {
    const r = this.rig;
    if (!r || !this.score || !this.rail || !this.amb || this.disposed) return;
    const now = r.ctx.currentTime;
    const dt = this.lastControl ? Math.max(0, now - this.lastControl) : 0;
    this.lastControl = now;
    this.mood.update(dt);
    const w = this.mood.palettes();
    this.weights = w;
    const bright = this.score.brightness(w);
    const quiet = this.paused || !this.enabled;
    this.score.update(now, w, bright);
    this.rail.update(now, dt, {
      weld: w.perfection * Math.max(0, Math.min(1, this.mood.stage - 6)),
      ruin: Math.max(w.ruin, this.mood.ruin * 0.5),
      authority: this.mood.authority,
      paused: this.paused,
    });
    this.amb.update(now, w, this.paused);
    // The hall itself grows as the world empties.
    glide(r.hallReturn.gain, 0.75 + 0.35 * this.mood.gloom + 0.2 * w.ruin - 0.45 * w.perfection, now, 3);
    if (!quiet) {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const horizon = now + (hidden && !this.manual ? Math.max(1.2, this.lookahead) : this.lookahead);
      this.score.schedule(horizon, now);
      this.rail.schedule(horizon, now);
      this.amb.schedule(horizon, now);
    }
    if (this.paused && this.owned && !this.suspendedForIdle && now - this.idleSince > IDLE_SUSPEND_S) this.suspendLater(0);
  }

  inspect(): AudioInspection {
    const w = this.weights ?? this.mood.palettes();
    const palettes: Record<string, number> = {};
    for (const k of PALETTES) palettes[k] = round(w[k]);
    const layers = (this.score?.layers ?? []).map((l) => ({ name: l.id, weight: round(l.weight), voices: l.counter.active }));
    const ambience: Record<string, number> = {};
    if (this.amb) for (const [k, v] of Object.entries(this.amb.weights)) ambience[k] = round(v);
    if (this.rail) ambience.speed = round(this.rail.v);
    return {
      time: this.ctx?.currentTime ?? 0,
      running: this.ctx ? this.ctx.state === "running" : false,
      stage: round(this.mood.stage),
      bpm: round(this.score?.bpm ?? 0),
      palette: this.score?.phrase?.palette ?? this.mood.dominant(w),
      chord: this.score?.chordName ?? "",
      resting: this.score?.resting ?? false,
      palettes,
      layers,
      ambience,
      voices: this.rig?.counter.active ?? 0,
      voicesStarted: this.rig?.started ?? 0,
    };
  }

  // ------------------------------------------------------------------ internals

  private build(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    const r = new Rig(ctx, this.seed);
    this.rig = r;
    this.bank = new Bank(ctx, r.rng.fork("bank"));
    this.score = new Score(r, this.bank, this.mood);
    if (this.solo) this.score.solo = new Set(this.solo);
    this.rail = new Rail(r, this.bank);
    this.sfx = new Sfx(r, this.bank, this.mood, {
      duck: (depth, hold) => this.duck(depth, hold),
      silenceMusic: (s) => this.silenceMusic(s),
      crush: (s) => this.crush(s),
      freeze: (s) => this.freeze(s),
    });
    const sfx = this.sfx;
    this.amb = new Ambience(r, this.bank, this.mood, (t, k, pan) => sfx.thunder(t, k, pan));
    if (Object.keys(this.pendingVolumes).length) r.setVolumes(this.pendingVolumes);
    if (this.pendingRail) this.rail.set(this.pendingRail);
    if (!this.enabled) r.enableGain.gain.value = 0;
    if (this.paused) r.pauseGain.gain.value = 0;
  }

  private async resume(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.owned) return;
    const ac = ctx as AudioContext;
    if (ac.state !== "running" && typeof ac.resume === "function") {
      try {
        await ac.resume();
      } catch {
        /* the browser refused (no gesture); the next unlock() retries */
      }
    }
    this.suspendedForIdle = false;
  }

  private suspendLater(ms: number): void {
    if (!this.owned || !this.ctx) return;
    const ac = this.ctx as AudioContext;
    setTimeout(() => {
      if (this.disposed) return;
      if ((this.enabled && !this.paused) || ac.state !== "running") return;
      if (ac.currentTime - this.idleSince < IDLE_SUSPEND_S && this.paused && this.enabled) return;
      this.suspendedForIdle = true;
      void ac.suspend().catch(() => undefined);
    }, ms);
  }

  private startTimer(): void {
    if (this.manual || this.timer || this.disposed) return;
    this.step();
    this.timer = setInterval(() => this.step(), CONTROL_MS);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Render the foley bank in small idle slices after unlock. */
  private warmBank(): void {
    if (!this.bank || this.manual) return;
    const jobs = this.bank.jobs();
    const run = () => {
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < 6) jobs.shift()!();
      if (jobs.length && !this.disposed) setTimeout(run, 30);
    };
    setTimeout(run, 60);
  }

  private gateMusic(value: number, at: number, tc: number): void {
    const r = this.rig;
    if (!r) return;
    for (const g of [r.musicGate, r.musicGateWet]) {
      g.gain.cancelScheduledValues(at);
      g.gain.setTargetAtTime(value, at, tc);
    }
  }

  private duck(depth: number, hold: number): void {
    const r = this.rig;
    if (!r) return;
    const now = r.ctx.currentTime;
    if (now < this.musicHoldUntil) return; // already silenced
    this.gateMusic(depth, now, 0.05);
    const back = now + hold;
    for (const g of [r.musicGate, r.musicGateWet]) g.gain.setTargetAtTime(1, back, 0.6);
  }

  private silenceMusic(seconds: number): void {
    const r = this.rig;
    if (!r) return;
    const now = r.ctx.currentTime;
    this.musicHoldUntil = Math.max(this.musicHoldUntil, now + seconds);
    this.gateMusic(0, now, 0.35);
    for (const g of [r.musicGate, r.musicGateWet]) g.gain.setTargetAtTime(1, this.musicHoldUntil, 2.2);
  }

  private crush(seconds: number): void {
    const r = this.rig;
    if (!r) return;
    const now = r.ctx.currentTime;
    if (now < this.freezeUntil) return;
    const end = now + seconds;
    const clean = r.cleanPath.gain;
    const crush = r.crushPath.gain;
    clean.cancelScheduledValues(now);
    crush.cancelScheduledValues(now);
    clean.setValueAtTime(0.15, now);
    let t = now;
    let on = true;
    const rng = r.rng;
    while (t < end) {
      crush.setValueAtTime(on ? 0.9 : 0.05, t);
      t += rng.range(0.025, 0.07);
      on = !on;
    }
    crush.setValueAtTime(0, end);
    clean.setValueAtTime(0.15, end);
    clean.linearRampToValueAtTime(1, end + 0.04);
  }

  private freeze(seconds: number): void {
    const r = this.rig;
    if (!r) return;
    const now = r.ctx.currentTime;
    this.crush(0.3);
    const cut = now + 0.3;
    this.freezeUntil = cut + seconds;
    const g = r.freezeGate.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(1, now);
    g.setValueAtTime(1, cut - 0.005);
    g.linearRampToValueAtTime(0, cut);
    g.setValueAtTime(0, this.freezeUntil);
    g.linearRampToValueAtTime(1, this.freezeUntil + 1.2);
  }
}

const round = (v: number) => Math.round(v * 1000) / 1000;
