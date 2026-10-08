/**
 * Mood smoothing and the palette mixer.
 *
 * The score is organised as nine palettes: one per stage for stages 1–6 and
 * three for the aftermath (perfection, ruin, dawn). The incoming mood is a
 * set of targets; this module glides toward them at musical rates so every
 * change is a crossfade, never a cut, and reports how much of each palette is
 * sounding right now.
 */
import type { AudioAuthority, AudioMood } from "./types.ts";

export const PALETTES = ["pastoral", "academy", "institution", "momentum", "dread", "abyss", "perfection", "ruin", "dawn"] as const;
export type PaletteId = (typeof PALETTES)[number];
export type PaletteWeights = Record<PaletteId, number>;

const clamp01 = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);

/**
 * Stage 7 splits by ending. Ids come from the campaign's EndingId union; the
 * literal "perfection" and "ruin" are accepted too. Unknown ids fall back to
 * the world's perfection/ruin channels.
 */
export function endingMix(ending: string | undefined, perfection: number, ruin: number): { perfection: number; ruin: number; dawn: number } {
  switch (ending) {
    case "perfection":
    case "tutelage":
    case "succession":
      return { perfection: 1, ruin: 0, dawn: 0 };
    case "ruin":
    case "extinction":
      return { perfection: 0, ruin: 1, dawn: 0 };
    case "remnant":
      return { perfection: 0, ruin: 0.65, dawn: 0.35 };
    case "containment":
      return { perfection: 0.35, ruin: 0, dawn: 0.65 };
    case "recovery":
      return { perfection: 0, ruin: 0.2, dawn: 0.8 };
    case "accountable":
    case "restraint":
    case "dawn":
      return { perfection: 0, ruin: 0, dawn: 1 };
    default: {
      const p = Math.max(0, perfection);
      const r = Math.max(0, ruin);
      const d = Math.max(0, 1 - Math.max(p, r)) + 0.15;
      const s = p + r + d;
      return { perfection: p / s, ruin: r / s, dawn: d / s };
    }
  }
}

export class MoodState {
  /** Continuous stage, slewed toward the target. */
  stage = 1;
  tension = 0;
  gloom = 0;
  perfection = 0;
  ruin = 0;
  storm = 0;
  rain = 0;
  speed = 0;
  /** 0 human .. 1 delegated .. 2 overridden, smoothed. */
  authority = 0;
  ending = { perfection: 0, ruin: 0, dawn: 1 };
  target: AudioMood = {
    stage: 1,
    tension: 0,
    gloom: 0,
    perfection: 0,
    ruin: 0,
    storm: 0,
    rain: 0,
    speed: 0,
    authority: "human",
  };
  private primed = false;

  set(m: AudioMood): void {
    const t: AudioMood = {
      stage: typeof m.stage === "number" && Number.isFinite(m.stage) ? Math.max(1, Math.min(7, m.stage)) : this.target.stage,
      tension: clamp01(m.tension, this.target.tension),
      gloom: clamp01(m.gloom, this.target.gloom),
      perfection: clamp01(m.perfection, this.target.perfection),
      ruin: clamp01(m.ruin, this.target.ruin),
      storm: clamp01(m.storm, this.target.storm),
      rain: clamp01(m.rain, this.target.rain),
      speed: clamp01(m.speed, this.target.speed),
      authority: m.authority === "delegated" || m.authority === "overridden" ? m.authority : "human",
      ...(m.ending ? { ending: m.ending } : {}),
    };
    this.target = t;
    if (!this.primed) {
      this.primed = true;
      this.snap();
    }
  }

  /** Jump straight to the target (first mood, offline renders). */
  snap(): void {
    const t = this.target;
    this.stage = t.stage;
    this.tension = t.tension;
    this.gloom = t.gloom;
    this.perfection = t.perfection;
    this.ruin = t.ruin;
    this.storm = t.storm;
    this.rain = t.rain;
    this.speed = t.speed;
    this.authority = authorityLevel(t.authority);
    this.ending = endingMix(t.ending, t.perfection, t.ruin);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const t = this.target;
    // A full stage takes ~16 s to cross-fade; larger jumps move no faster.
    const slew = dt / 16;
    const ds = t.stage - this.stage;
    this.stage += Math.sign(ds) * Math.min(Math.abs(ds), slew);
    const ease = (cur: number, target: number, tau: number) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
    this.tension = ease(this.tension, t.tension, 4);
    this.gloom = ease(this.gloom, t.gloom, 6);
    this.perfection = ease(this.perfection, t.perfection, 6);
    this.ruin = ease(this.ruin, t.ruin, 6);
    this.storm = ease(this.storm, t.storm, 4);
    this.rain = ease(this.rain, t.rain, 3);
    this.speed = ease(this.speed, t.speed, 1.5);
    this.authority = ease(this.authority, authorityLevel(t.authority), 3);
    const e = endingMix(t.ending, t.perfection, t.ruin);
    this.ending = {
      perfection: ease(this.ending.perfection, e.perfection, 5),
      ruin: ease(this.ending.ruin, e.ruin, 5),
      dawn: ease(this.ending.dawn, e.dawn, 5),
    };
  }

  /** Normalised palette weights for the current (smoothed) state. */
  palettes(): PaletteWeights {
    const w: PaletteWeights = { pastoral: 0, academy: 0, institution: 0, momentum: 0, dread: 0, abyss: 0, perfection: 0, ruin: 0, dawn: 0 };
    const s = this.stage;
    const tri = (centre: number) => Math.max(0, 1 - Math.abs(s - centre));
    w.pastoral = tri(1);
    w.academy = tri(2);
    w.institution = tri(3);
    w.momentum = tri(4);
    w.dread = tri(5);
    w.abyss = tri(6);
    const late = tri(7) + (s > 7 ? 1 : 0);
    w.perfection = late * this.ending.perfection;
    w.ruin = late * this.ending.ruin;
    w.dawn = late * this.ending.dawn;
    // The world's drift toward order or ruin tints the late score before the end.
    const lead = Math.max(0, Math.min(1, s - 4)) * (1 - late);
    const drift = (v: number) => Math.max(0, v - 0.3) / 0.7;
    w.perfection += lead * drift(this.perfection) * 0.45;
    w.ruin += lead * drift(this.ruin) * 0.45;
    let sum = 0;
    for (const k of PALETTES) sum += w[k];
    if (sum > 0) for (const k of PALETTES) w[k] /= sum;
    return w;
  }

  dominant(w: PaletteWeights): PaletteId {
    let best: PaletteId = "pastoral";
    for (const k of PALETTES) if (w[k] > w[best]) best = k;
    return best;
  }
}

export function authorityLevel(a: AudioAuthority): number {
  return a === "overridden" ? 2 : a === "delegated" ? 1 : 0;
}
