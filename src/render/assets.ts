/**
 * The seam between the world director and the asset library. The director
 * asks for things by id; the provider builds them. A placeholder provider
 * keeps the whole renderer runnable (and testable) with simple ink blocks.
 */
import * as THREE from "three";
import type {
  AnimalId,
  DocumentId,
  EnvironmentTarget,
  FaceState,
  LandmarkId,
  MachineId,
  PersonRole,
  Pose,
  PropId,
  VehicleId,
} from "./api.ts";
import { inkMaterial, type InkMaterialOptions } from "./core/ink-material.ts";
import { Kit, block, cylinder, sphere, jitter } from "./core/geometry.ts";

export interface Ticking {
  tick?(dt: number, t: number): void;
}

export interface ScatterPrefab {
  geometry: THREE.BufferGeometry;
  material: InkMaterialOptions;
  /** Approximate radius, for spacing. */
  radius: number;
}

export interface SkyModule {
  object: THREE.Object3D;
  update(dt: number, env: EnvironmentTarget, rig: THREE.Vector3, camera: THREE.Camera): void;
  onLightning?(cb: (strength: number) => void): void;
  setNoFlashing?(on: boolean): void;
  dispose(): void;
}

export interface CabinModule {
  group: THREE.Group;
  leverHandle: THREE.Object3D;
  setLever(value: number, dt?: number): void;
  readonly leverValue: number;
  setGauges(g: { speedKmh: number; pressure: number; clock: string }): void;
  setScreen(s: { mode: "dispatch" | "morrow" | "jam" | "off"; lines: string[]; thinking?: boolean; alert?: boolean }): void;
  printReceipt(text: string): void;
  setMirrorTexture(tex: THREE.Texture): void;
  impact(opts: { u: number; v: number; severity: number; blood: boolean }): void;
  setRain(amount: number): void;
  wipe(): void;
  clearGlass(): void;
  setKeepsake(kind: "coffee" | "forms" | null): void;
  setAuthority(a: "human" | "delegated" | "overridden"): void;
  tick(dt: number, t: number): void;
  recommendedCamera(aspect: number): { fov: number; position: THREE.Vector3; pitch: number };
  anchors(camera: THREE.Camera): { lever: DOMRectInit; mirror: DOMRectInit; dash: DOMRectInit };
}

export interface PortraitModule {
  texture: THREE.Texture;
  draw(face: FaceState, t: number, opts: { speed: number; crack: number; glitch?: number; reducedMotion: boolean }): void;
}

export interface AssetProvider {
  person(spec: { role: PersonRole; pose?: Pose; seed: string; name?: string }): THREE.Object3D;
  animal(species: AnimalId, spec: { seed: string; behavior?: "graze" | "walk" | "alert" | "flee" | "rest" }): THREE.Object3D;
  vehicle(id: VehicleId, spec: { seed: string }): THREE.Object3D;
  machine(id: MachineId, spec: { seed: string }): THREE.Object3D;
  prop(id: PropId, spec: { seed: string; scale?: number; label?: string }): THREE.Object3D;
  document(id: DocumentId, spec: { seed: string; label?: string }): THREE.Object3D;
  sign(text: string, style: "enamel" | "stencil" | "placard" | "warning" | "station"): THREE.Object3D;
  signal(): THREE.Object3D;
  bufferStop(): THREE.Object3D;
  landmark(id: LandmarkId, spec: { seed: string; env: Partial<EnvironmentTarget> }): THREE.Object3D;
  /** Instanceable scatter by kind: "tree", "tree-bare", "conifer", "dead-tree", "bush", "grass", "rock", "hay", "fence", "pole", "crop", "orchard-tree", "house", "barn", ... */
  prefab(kind: string, variant: number, env: Partial<EnvironmentTarget>): ScatterPrefab | null;
  prefabVariants(kind: string): number;
  herd?(species: AnimalId, spec: { count: number; seed: string; radius: number }): THREE.Object3D;
  flock?(kind: "starlings" | "crows" | "geese", spec: { count: number; seed: string }): { object: THREE.Object3D; update(dt: number, t: number, center: THREE.Vector3): void };
  droneSwarm?(spec: { count: number; seed: string }): THREE.Object3D;
  sky?(): SkyModule;
  ground?(): SkyModule & { heightAt(x: number, z: number): number };
  weather?(): SkyModule;
  cabin?(seed: string): CabinModule;
  portrait?(seed: string): PortraitModule;
  leafFall?(): { object: THREE.Object3D; update(dt: number, density: number, camera: THREE.Camera): void };
}

// ------------------------------------------------------------ placeholders

const actorMaterial = () => inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: 0.035 });
const worldMaterial = () => inkMaterial({ vertexInk: true });

function figure(tone: number): THREE.Mesh {
  const k = new Kit();
  k.add(cylinder(0.12, 0.1, 0.85, 8), { tone: "dark", position: [-0.1, 0.43, 0] });
  k.add(cylinder(0.12, 0.1, 0.85, 8), { tone: "dark", position: [0.1, 0.43, 0] });
  k.add(cylinder(0.22, 0.18, 0.62, 10), { tone, position: [0, 1.17, 0] });
  k.add(sphere(0.12, 10, 8), { tone: "paper", position: [0, 1.62, 0] });
  return new THREE.Mesh(k.build(), actorMaterial());
}

function box(w: number, h: number, d: number, tone: number, world = false): THREE.Mesh {
  const k = new Kit();
  k.add(block(w, h, d), { tone });
  return new THREE.Mesh(k.build(), world ? worldMaterial() : actorMaterial());
}

export const placeholderAssets: AssetProvider = {
  person: ({ role }) => figure(role === "worker" ? 0.3 : 0.12),
  animal: () => {
    const k = new Kit();
    const b = sphere(0.6, 12, 8);
    b.scale(1.4, 0.8, 0.7);
    k.add(b, { tone: "paper", position: [0, 1, 0] });
    for (const [x, z] of [
      [0.5, 0.25],
      [0.5, -0.25],
      [-0.5, 0.25],
      [-0.5, -0.25],
    ] as const)
      k.add(cylinder(0.07, 0.06, 0.8, 6), { tone: "light", position: [x, 0.4, z] });
    return new THREE.Mesh(k.build(), actorMaterial());
  },
  vehicle: () => box(2.2, 2.2, 5, 0.1),
  machine: () => box(0.8, 2, 0.8, 0.5),
  prop: () => box(0.4, 0.4, 0.4, 0.2),
  document: () => box(0.5, 0.08, 0.7, 0.05),
  sign: () => box(1.4, 0.8, 0.08, 0.05),
  signal: () => box(0.3, 4, 0.3, 0.6),
  bufferStop: () => box(2.2, 1.2, 0.6, 0.4),
  landmark: (id) => box(id === "data-center" ? 60 : 12, id === "data-center" ? 14 : 8, id === "data-center" ? 40 : 10, 0.05, true),
  prefab: (kind, variant) => {
    const k = new Kit();
    if (kind === "tree" || kind === "orchard-tree") {
      k.add(cylinder(0.14, 0.26, 3.2, 7), { tone: "mid", position: [0, 1.6, 0] });
      k.add(jitter(sphere(1.7, 12, 9), 0.3, variant + 1), { tone: "pale", position: [0, 4.4, 0] });
      return { geometry: k.build(), material: { vertexInk: true }, radius: 2 };
    }
    if (kind === "house") {
      k.add(block(7, 4, 6), { tone: "paper" });
      return { geometry: k.build(), material: { vertexInk: true }, radius: 5 };
    }
    return null;
  },
  prefabVariants: () => 3,
};
