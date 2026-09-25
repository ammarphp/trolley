/**
 * The sky module: dome, clouds and backdrop, driven by the environment and
 * lit from wherever the scene's key light actually is.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { syncSkyLook } from "../terrain/glsl.ts";
import { createBackdrop, type Backdrop } from "./backdrop.ts";
import { createCloudField, type CloudField } from "./clouds.ts";
import { createSkyDome, type SkyDome } from "./dome.ts";
import { findKeyLight, lightDirection, nightAmount, sunDirection } from "./sun.ts";
import { setGlobalNoFlashing } from "./weather.ts";

export interface SkyOptions {
  seed?: number | string;
  quality?: "low" | "medium" | "high";
  /**
   * Where the light comes from. Default "scene": the first shadow-casting
   * DirectionalLight in the scene (so the drawn sun and the shadows agree),
   * falling back to `sunDirection(timeOfDay)`.
   */
  sun?: "scene" | "timeOfDay" | THREE.DirectionalLight;
}

export interface SkyModule {
  readonly object: THREE.Group;
  update(dt: number, env: EnvironmentTarget, rigWorld: THREE.Vector3, camera: THREE.Camera): void;
  readonly dome: SkyDome;
  readonly clouds: CloudField;
  readonly backdrop: Backdrop;
  /** Direction toward the sun (or moon at night) used last frame. */
  readonly sunDir: THREE.Vector3;
  readonly triangles: number;
  /** Suppress lightning screen flashes (also honoured by weather). */
  setNoFlashing(on: boolean): void;
  dispose(): void;
}

export function createSky(options: SkyOptions = {}): SkyModule {
  const group = new THREE.Group();
  group.name = "sky";
  const dome = createSkyDome();
  const clouds = createCloudField({ seed: options.seed, quality: options.quality });
  const backdrop = createBackdrop({ seed: options.seed, quality: options.quality });
  group.add(dome.object, clouds.object, backdrop.object);
  const sunDir = new THREE.Vector3(0.3, 0.6, -0.7).normalize();
  const windDir = new THREE.Vector2(1, 0);
  let light: THREE.DirectionalLight | null = options.sun instanceof THREE.DirectionalLight ? options.sun : null;
  let searchIn = 0;
  let time = 0;
  return {
    object: group,
    dome,
    clouds,
    backdrop,
    sunDir,
    triangles: clouds.triangles + backdrop.triangles + 48 * 24 * 2,
    update(dt, env, rigWorld, camera) {
      time += dt;
      syncSkyLook(env, camera as THREE.PerspectiveCamera);
      if (options.sun !== "timeOfDay" && !light && --searchIn <= 0) {
        let root: THREE.Object3D = group;
        while (root.parent) root = root.parent;
        light = findKeyLight(root);
        searchIn = 60;
      }
      if (light && light.parent) lightDirection(light, sunDir);
      else sunDirection(env.timeOfDay, sunDir);
      const night = nightAmount(env.timeOfDay);
      const w = INK_GLOBALS.uInkWind.value;
      windDir.set(w.x, w.y);
      if (windDir.lengthSq() < 1e-6) windDir.set(1, 0);
      windDir.normalize();
      dome.set({ sunDir, night, gloom: env.gloom, storm: env.storm, cloud: env.cloud, fire: env.fire, uniformity: Math.max(env.uniformity, env.perfection), time });
      clouds.update(dt, { sunDir, cloud: env.cloud, storm: env.storm, gloom: env.gloom, night, fire: env.fire, wind: env.wind, windDir, uniformity: Math.max(env.uniformity, env.perfection) }, rigWorld, camera);
      backdrop.update(
        dt,
        {
          sunDir,
          habitation: env.habitation,
          industry: env.industry,
          compute: env.compute,
          uniformity: env.uniformity,
          perfection: env.perfection,
          ruin: env.ruin,
          fire: env.fire,
          vegetation: env.vegetation,
          night,
          gloom: env.gloom,
          storm: env.storm,
          time,
        },
        rigWorld,
        camera,
      );
    },
    setNoFlashing(on) {
      setGlobalNoFlashing(on);
    },
    dispose() {
      dome.dispose();
      clouds.dispose();
      backdrop.dispose();
    },
  };
}
