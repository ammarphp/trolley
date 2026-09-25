/**
 * The asset lab: an isolated page that renders one named scene through the
 * real ink pipeline. Builders register scenes in files named `*.lab.ts`
 * anywhere under src/render (and src/ui/brand for 2D marks). The lab build
 * discovers them; no shared registry file needs editing.
 *
 *   node scripts/lab.mjs --serve            # interactive, http://127.0.0.1:4300/?scene=<name>
 *   node scripts/lab-shot.mjs <name> --out shot.png [--w 1280 --h 720 --t 2 --params '{"k":1}']
 */
import type * as THREE from "three";
import type { InkPipeline } from "../core/ink-pipeline.ts";
import type { Rng } from "../core/rng.ts";

export interface LabContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pipeline: InkPipeline;
  rng: Rng;
  /** Parsed from ?params=<json>. */
  params: Record<string, unknown>;
  /** Called every simulated frame with (dt, elapsed). */
  onFrame(cb: (dt: number, t: number) => void): void;
  /** Sun + sky fill + ground plane with standard lab conditions. */
  standardStage(options?: { ground?: boolean; groundTone?: number; sun?: [number, number, number] }): THREE.DirectionalLight;
  /** Point the camera. */
  view(position: [number, number, number], target: [number, number, number], fov?: number): void;
  /** Arrange objects in a row for comparison sheets. */
  lineup(objects: THREE.Object3D[], spacing: number, axis?: "x" | "z"): void;
  /** Add a small caption drawn in the DOM (appears in screenshots). */
  caption(text: string): void;
  /** Use a 2D DOM/SVG surface instead of WebGL (for brand marks, portraits). */
  domStage(): HTMLElement;
}

export interface LabScene {
  name: string;
  description?: string;
  build(ctx: LabContext): void | Promise<void>;
}
