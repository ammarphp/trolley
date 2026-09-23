import type { Scene } from "../contracts/index.ts";
export interface SceneView {
  stage: number;
  biome:
    | "field"
    | "town"
    | "lab"
    | "industrial"
    | "scarred"
    | "pristine"
    | "aftermath";
  speed: number;
  strain: number;
  damage: number;
  authority: "human" | "delegated" | "overridden";
  figures: { left: number; right: number };
  routeLabels: { left: string; right: string };
  loopSide?: "left" | "right";
  brakeOnLoop?: boolean;
  mechanismDescription?: string;
  figureKind?: Scene["figureKind"];
  landmark?:
    | "none"
    | "cows"
    | "parade"
    | "clinic"
    | "lab"
    | "data-center"
    | "drones"
    | "checkpoint"
    | "ruins"
    | "garden";
  detail?: string;
}
export interface SceneSettings {
  reducedMotion: boolean;
  reducedGraphics: boolean;
  audio: boolean;
}
export type Executor = "human" | "assistant" | "institution";
export interface RailOutcome {
  stoppedBy: string | null;
}
export interface CabinScene {
  update(view: SceneView): void;
  commit(
    side: "left" | "right",
    executor: Executor,
    outcome?: RailOutcome,
  ): Promise<void>;
  setLever(side: "left" | "right"): void;
  pause(paused: boolean): void;
  settings(patch: Partial<SceneSettings>): void;
  describe(): string;
  destroy(): void;
}
