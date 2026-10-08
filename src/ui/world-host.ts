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

let softwareGl: boolean | null = null;
/**
 * True when WebGL runs without a GPU (SwiftShader, llvmpipe and the like):
 * every frame is drawn on the CPU, so the world must be drawn lighter.
 */
export function softwareRendering(): boolean {
  if (softwareGl !== null) return softwareGl;
  softwareGl = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
      softwareGl = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(name);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    softwareGl = false;
  }
  return softwareGl;
}

export function detectQuality(): RendererSettings["quality"] {
  if (softwareRendering()) return "low";
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
      renderer = new InkWorldRenderer({ host, assets: createRealAssets(settings.quality), settings, audio, ...(softwareRendering() ? { software: true } : {}) });
    } catch (error) {
      console.warn("Ink renderer unavailable; using the static drawing.", error);
      host.replaceChildren();
      renderer = new FallbackRenderer(host, settings, audio);
    }
  } else {
    renderer = new FallbackRenderer(host, settings, audio);
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
