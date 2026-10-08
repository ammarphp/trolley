/**
 * A static drawing for browsers without WebGL2. It keeps the full game playable:
 * the same contract, immediate commits, and a truthful description.
 */
import type { AudioLike } from "./world-renderer.ts";
import type { Executor, LeverInput, RailOutcome, RendererSettings, SceneAnchors, StageView, WorldRenderer } from "./api.ts";
import { occupantsDescription } from "./world/staging.ts";

const SVG = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="">
<rect width="1600" height="900" fill="#fff"/>
<g fill="none" stroke="#111214" stroke-linecap="round" stroke-linejoin="round">
<path d="M0 470 C 300 455 520 462 800 466 C 1080 470 1320 458 1600 466" stroke-width="1.4" opacity=".55"/>
<path d="M120 452 q60-40 120 0 M300 446 q90-60 180 0 M1180 448 q80-50 160 0 M1380 452 q50-32 100 0" stroke-width="1.1" opacity=".45"/>
<path d="M760 900 L 792 520 M840 900 L 808 520" stroke-width="2.4"/>
<path d="M792 520 C 760 490 640 476 470 470 M808 520 C 840 490 960 476 1130 470" stroke-width="2"/>
<g stroke-width="1.6" opacity=".7">${Array.from({ length: 14 }, (_, i) => {
  const y = 540 + i * i * 2.1;
  const w = 26 + i * i * 0.9;
  return `<path d="M${800 - w} ${y} L${800 + w} ${y}"/>`;
}).join("")}</g>
<path d="M0 620 L 380 560 L 380 90 L 1220 90 L 1220 560 L 1600 620" stroke-width="2.2"/>
<path d="M0 900 L 0 700 Q 800 640 1600 700 L 1600 900" stroke-width="2.6"/>
<path d="M1180 720 L 1230 600" stroke-width="10"/><circle cx="1234" cy="592" r="16" stroke-width="3"/>
</g></svg>`;

export class FallbackRenderer implements WorldRenderer {
  readonly kind = "fallback" as const;
  private host: HTMLElement;
  private view: StageView | null = null;
  private art: HTMLDivElement;
  private anchorsCb: ((a: SceneAnchors) => void) | null = null;

  private audio: AudioLike | null;

  constructor(host: HTMLElement, _settings: RendererSettings, audio: AudioLike | null = null) {
    this.audio = audio;
    this.host = host;
    this.art = document.createElement("div");
    this.art.className = "fallback-art";
    this.art.innerHTML = SVG;
    this.host.append(this.art);
    this.host.dataset.rendererFallback = "true";
  }
  update(view: StageView): void {
    this.view = view;
    this.emit();
  }
  commit(_side: "left" | "right", _executor: Executor, _outcome?: RailOutcome): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 60));
  }
  setLever(_value: number): void {}
  pause(paused: boolean): void {
    // The static drawing has nothing to stop, but the sound must still pause.
    this.audio?.pause(paused);
  }
  settings(_patch: Partial<RendererSettings>): void {}
  describe(): string {
    const v = this.view;
    if (!v?.staging) return "A drawing of the cab: the track runs ahead into open fields.";
    return `Ahead the track divides. Left: ${occupantsDescription(v.staging.left)}. Right: ${occupantsDescription(v.staging.right)}.`;
  }
  onAnchors(cb: (anchors: SceneAnchors) => void): void {
    this.anchorsCb = cb;
    this.emit();
  }
  onLever(_cb: (input: LeverInput) => void): void {}
  setInteractive(_enabled: boolean): void {}
  private emit(): void {
    if (!this.anchorsCb) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.anchorsCb({
      left: { x: w * 0.36, y: h * 0.5, visible: true },
      right: { x: w * 0.64, y: h * 0.5, visible: true },
      lever: { x: w * 0.72, y: h * 0.72, width: w * 0.1, height: h * 0.2 },
      mirror: { x: 0, y: h * 0.4, width: w * 0.08, height: h * 0.16 },
      dash: { x: w * 0.4, y: h * 0.78, width: w * 0.2, height: h * 0.1 },
    });
  }
  destroy(): void {
    this.art.remove();
  }
}
