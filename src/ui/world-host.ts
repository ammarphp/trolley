/**
 * Creates the world renderer for this browser and projects the campaign into
 * it. The only place the UI touches rendering.
 */
import type { Campaign } from "../contracts/index.ts";
import type { NodeStaging, RendererSettings, ScenePhase, StageView, WorldRenderer } from "../render/api.ts";
import { deriveStageView } from "../presentation/derive.ts";
import { FallbackRenderer } from "../render/fallback.ts";
import { supportsInk } from "../render/core/ink-pipeline.ts";
import type { AudioLike } from "../render/world-renderer.ts";
import { stagingFor } from "../render/staging/index.ts";

export interface WorldHost {
  renderer: WorldRenderer;
  view(campaign: Campaign | null, phase: ScenePhase, reducedGraphics: boolean): StageView;
  setAssistant(state: { thinking?: boolean; alert?: boolean; lines?: string[] }): void;
}

export function detectQuality(): RendererSettings["quality"] {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;
  const small = Math.min(screen.width, screen.height) < 700;
  if (small || mem <= 3 || cores <= 3) return "low";
  if (mem <= 6 || cores <= 6) return "medium";
  return "high";
}

export async function createWorldHost(host: HTMLElement, settings: RendererSettings, audio: AudioLike | null): Promise<WorldHost> {
  let renderer: WorldRenderer;
  // Canvas signage in the world is lettered in Geist; make sure it has loaded.
  await Promise.race([document.fonts?.load?.('600 32px "Geist"').catch(() => null), new Promise((r) => setTimeout(r, 1500))]);
  if (supportsInk()) {
    try {
      const [{ InkWorldRenderer }, { createRealAssets }] = await Promise.all([import("../render/world-renderer.ts"), import("../render/assets-real.ts")]);
      renderer = new InkWorldRenderer({ host, assets: createRealAssets(settings.quality), settings, audio });
    } catch (error) {
      console.warn("Ink renderer unavailable; using the static drawing.", error);
      host.replaceChildren();
      renderer = new FallbackRenderer(host, settings);
    }
  } else {
    renderer = new FallbackRenderer(host, settings);
  }
  const lookup = (id: string): NodeStaging | undefined => stagingFor(id);
  return {
    renderer,
    view: (campaign, phase, reducedGraphics) => deriveStageView({ campaign, phase, reducedGraphics, staging: lookup }),
    setAssistant: (state) => {
      const r = renderer as WorldRenderer & { setAssistant?: (s: typeof state) => void };
      r.setAssistant?.(state);
    },
  };
}
