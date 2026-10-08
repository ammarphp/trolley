/**
 * Public contracts for the synthesized sound engine.
 *
 * Everything the player hears is generated at runtime with the Web Audio API:
 * no sample files, no third-party recordings. The engine is a presentation
 * layer only. It never reads or writes simulation state; the interface hands
 * it a mood and a rail state, and fires named cues.
 */

export type AudioAuthority = "human" | "delegated" | "overridden";

/** High-level musical and environmental target. All scalars are 0..1. */
export interface AudioMood {
  /** Campaign stage 1..7. Fractional values are accepted and clamped. */
  stage: number;
  tension: number;
  gloom: number;
  perfection: number;
  ruin: number;
  storm: number;
  rain: number;
  speed: number;
  authority: AudioAuthority;
  /** Ending id once the run has resolved (e.g. "tutelage", "extinction", "accountable"). */
  ending?: string;
}

export interface RailState {
  /** Sleepers passing under the cab per second (sleeper pitch 0.65 m). */
  sleepersPerSecond: number;
  /** Track curvature, -1 (hard left) .. 1 (hard right). */
  curve: number;
  onBridge: boolean;
  inTunnel: boolean;
}

export const AUDIO_TRIGGERS = [
  "lever-arm",
  "lever-commit",
  "lever-jam",
  "switch-throw",
  "impact",
  "glass-crack",
  "wiper",
  "thunder",
  "morrow-chime",
  "morrow-type",
  "news-ping",
  "printer",
  "glitch",
  "freeze",
  "brake",
  "horn",
  "ui-tick",
  "ui-open",
  "ui-close",
  "tunnel-in",
  "tunnel-out",
  "appointment",
  "ending",
] as const;

export type AudioTrigger = (typeof AUDIO_TRIGGERS)[number];

export interface TriggerOptions {
  /** 0..1, default depends on the cue. */
  intensity?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
}

/** Linear 0..1 levels. Omitted fields keep their current value. */
export interface AudioVolumes {
  master?: number;
  music?: number;
  ambience?: number;
  sfx?: number;
}

export interface AudioEngine {
  /** Create/resume the audio context. Call inside a user gesture. */
  unlock(): Promise<void>;
  setEnabled(on: boolean): void;
  setVolumes(v: AudioVolumes): void;
  pause(paused: boolean): void;
  setMood(m: AudioMood): void;
  setRail(r: RailState): void;
  trigger(ev: AudioTrigger, opts?: TriggerOptions): void;
  dispose(): void;
}

export interface AudioEngineOptions {
  /**
   * Render into an existing context (for example an OfflineAudioContext).
   * Without it the engine creates a realtime AudioContext on unlock().
   */
  context?: BaseAudioContext;
  /** Seed for every cosmetic random choice (melodies, gust timing, variants). */
  seed?: string | number;
  /**
   * Manual clock: no internal timer. The owner calls step() to schedule up to
   * context.currentTime + lookahead. Used for offline rendering.
   */
  manual?: boolean;
  /** Scheduling horizon in seconds (default 0.4). */
  lookahead?: number;
  /** Lab/debug: only these score layers sound (e.g. ["pad", "musicbox"]). */
  solo?: string[];
}

export interface LayerReading {
  name: string;
  weight: number;
  voices: number;
}

/** A snapshot for the lab and the automated check. */
export interface AudioInspection {
  time: number;
  running: boolean;
  stage: number;
  bpm: number;
  palette: string;
  chord: string;
  resting: boolean;
  palettes: Record<string, number>;
  layers: LayerReading[];
  ambience: Record<string, number>;
  voices: number;
  voicesStarted: number;
}

/** The full engine: the public contract plus lab/offline hooks. */
export interface SynthAudioEngine extends AudioEngine {
  readonly context: BaseAudioContext | null;
  /** Post-limiter analyser (null until unlocked). */
  readonly analyser: AnalyserNode | null;
  /** Advance mood smoothing and schedule notes up to currentTime + lookahead. */
  step(): void;
  inspect(): AudioInspection;
}
