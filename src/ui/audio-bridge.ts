/**
 * The interface's view of the sound engine. Audio starts only inside a user
 * gesture and only when the player has sound switched on.
 */
import type { StageView } from "../render/api.ts";
import type { AudioLike } from "../render/world-renderer.ts";

export interface AudioBridge {
  /** Handed to the renderer so rail rhythm and impacts stay in sync. */
  renderer: AudioLike;
  unlock(enabled: boolean): Promise<void>;
  volume(v: number): void;
  mood(view: StageView, ending?: string): void;
  trigger(ev: string, opts?: { intensity?: number; pan?: number }): void;
}

interface Engine {
  unlock(): Promise<void>;
  setEnabled(on: boolean): void;
  setVolumes(v: { master?: number; music?: number; ambience?: number; sfx?: number }): void;
  pause(p: boolean): void;
  setMood(m: Parameters<AudioLike["setMood"]>[0]): void;
  setRail(r: Parameters<AudioLike["setRail"]>[0]): void;
  trigger(ev: string, opts?: { intensity?: number; pan?: number }): void;
}

// Resolved at runtime until the synthesized engine is integrated.
const AUDIO_MODULE: string = "./audio.js";

export function createAudioBridge(initialVolume: number): AudioBridge {
  let engine: Engine | null = null;
  let loading: Promise<Engine | null> | null = null;
  let enabled = false;
  let volume = initialVolume;
  const load = () =>
    (loading ??= import(/* audio engine */ AUDIO_MODULE)
      .then((m) => (m as unknown as { createAudioEngine(): Engine }).createAudioEngine())
      .catch(() => null));
  const renderer: AudioLike = {
    setRail: (r) => engine?.setRail(r),
    setMood: (m) => engine?.setMood(m),
    trigger: (ev, opts) => {
      if (enabled) engine?.trigger(ev, opts);
    },
    pause: (p) => engine?.pause(p),
  };
  return {
    renderer,
    async unlock(on) {
      enabled = on;
      if (!on) {
        engine?.setEnabled(false);
        return;
      }
      const e = await load();
      if (!e) return;
      engine = e;
      await e.unlock();
      e.setEnabled(true);
      e.setVolumes({ master: volume });
    },
    volume(v) {
      volume = v;
      engine?.setVolumes({ master: v });
    },
    mood(view, ending) {
      const tension = Math.min(1, view.cabin.face.fatigue * 0.5 + view.cabin.face.grief * 0.5 + (view.cabin.authority === "overridden" ? 0.3 : 0));
      engine?.setMood({
        stage: view.stage,
        tension,
        gloom: view.env.gloom,
        perfection: view.env.perfection,
        ruin: view.env.ruin,
        storm: view.env.storm,
        rain: view.env.storm > 0.3 ? view.env.storm : 0,
        speed: view.env.speed,
        authority: view.cabin.authority,
        ...(ending ? { ending } : {}),
      });
    },
    trigger(ev, opts) {
      if (enabled) engine?.trigger(ev, opts);
    },
  };
}
