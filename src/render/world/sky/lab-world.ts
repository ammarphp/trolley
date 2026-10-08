/**
 * Lab composition for ground + sky + weather + river, seen from the cab.
 * Not used by the game.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import type { LabContext } from "../../lab/types.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { createGround, type GroundModule } from "../terrain/ground.ts";
import { createRiver, type RiverModule } from "../terrain/river.ts";
import { applyLighting, budget, cabView, envOf, groundTrack, telegraphPoles } from "../terrain/lab-kit.ts";
import { createSky, type SkyModule } from "./sky.ts";
import { createWeather, type WeatherModule } from "./weather.ts";
import { sunDirection } from "./sun.ts";

export interface WorldLabOptions {
  env: Partial<EnvironmentTarget>;
  river?: Array<[number, number]> | null;
  /** Light direction override (unit vector toward the light). */
  light?: THREE.Vector3;
  /** Strike lightning at this lab time (s). */
  strikeAt?: number;
  strikeYaw?: number;
  /**
   * World position of the scene origin (floating-origin offset). The cab
   * stays at the scene origin; the world under it moves. Default [0, 0].
   */
  origin?: [number, number];
  poles?: boolean;
  seed?: string;
}

export interface WorldLab {
  env: EnvironmentTarget;
  ground: GroundModule;
  sky: SkyModule;
  weather: WeatherModule;
  river: RiverModule | null;
}

export function worldLab(ctx: LabContext, opts: WorldLabOptions): WorldLab {
  const params = { ...(ctx.params as Partial<EnvironmentTarget> & { origin?: [number, number]; noTrack?: boolean; trackNoShadow?: boolean }) };
  const origin: [number, number] = params.origin ?? opts.origin ?? [0, 0];
  delete params.origin;
  delete params.noTrack;
  delete (params as { trackNoShadow?: boolean }).trackNoShadow;
  delete (params as { light?: unknown }).light;
  delete (params as { yaw?: unknown }).yaw;
  delete (params as { perf?: unknown }).perf;
  delete (params as { hide?: unknown }).hide;
  const env = envOf({ ...opts.env, ...params });
  INK_GLOBALS.uInkWorldOffset.value.set(origin[0], 0, origin[1]);
  const sun = ctx.standardStage({ ground: false });
  const lightParam = (ctx.params as { light?: [number, number] }).light;
  const dir = lightParam ? new THREE.Vector3(Math.sin((lightParam[0] * Math.PI) / 180) * Math.cos((lightParam[1] * Math.PI) / 180), Math.sin((lightParam[1] * Math.PI) / 180), -Math.cos((lightParam[0] * Math.PI) / 180) * Math.cos((lightParam[1] * Math.PI) / 180)) : opts.light ?? sunDirection(env.timeOfDay);
  applyLighting(ctx, sun, env, dir);
  const seed = opts.seed ?? "lab";
  const ground = createGround({ seed });
  ctx.scene.add(ground.object);
  const sky = createSky({ seed });
  ctx.scene.add(sky.object);
  const weather = createWeather({ seed });
  ctx.scene.add(weather.object);
  let river: RiverModule | null = null;
  if (opts.river) {
    river = createRiver({ points: opts.river.map(([x, z]) => [x + origin[0], z + origin[1]] as [number, number]) });
    ctx.scene.add(river.object);
  }
  const lp = ctx.params as { noTrack?: boolean; trackNoShadow?: boolean };
  if (!lp.noTrack) {
    const tr = groundTrack(600, 30, origin);
    if (lp.trackNoShadow) tr.userData.castShadow = false;
    ctx.scene.add(tr);
  }
  if (opts.poles !== false) ctx.scene.add(telegraphPoles(-4.2, 20, -700, 48, origin));
  cabView(ctx, 1.6, origin);
  const rig = new THREE.Vector3(origin[0], 0, origin[1]);
  let struck = false;
  weather.onStrike((e) => console.warn(`strike: strength ${e.strength.toFixed(2)} flash ${e.flash}`));
  ctx.onFrame((dt, t) => {
    if (opts.strikeAt !== undefined && !struck && t >= opts.strikeAt) {
      weather.strike({ strength: 1, yaw: opts.strikeYaw ?? -0.2, distance: 5200 });
      struck = true;
    }
    ground.update(dt, env, rig, ctx.camera);
    sky.update(dt, env, rig, ctx.camera);
    weather.update(dt, env, rig, ctx.camera);
    river?.update(dt, env, rig, ctx.camera);
  });
  // Optional: hide modules to profile them, params {hide: ["ground", ...]}.
  const hide = (ctx.params as { hide?: string[] }).hide ?? [];
  if (hide.length) {
    ctx.onFrame(() => {
      ground.object.visible = !hide.includes("ground");
      sky.dome.object.visible = !hide.includes("dome");
      sky.clouds.object.visible = !hide.includes("clouds");
      sky.backdrop.object.visible = !hide.includes("backdrop");
      weather.object.visible = !hide.includes("weather");
      if (river) river.object.visible = !hide.includes("river");
    });
  }
  // Optional camera yaw (degrees) to inspect other directions: params {yaw}.
  const yaw = (ctx.params as { yaw?: number }).yaw;
  if (yaw !== undefined) {
    ctx.camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), (yaw * Math.PI) / 180);
    ctx.camera.updateMatrixWorld();
  }
  // Optional GPU timing: params {perf: true} renders 40 frames and logs ms/frame.
  if ((ctx.params as { perf?: boolean }).perf) {
    let done = false;
    ctx.onFrame((_dt, t) => {
      if (done || t < 0.95) return;
      done = true;
      const r = ctx.pipeline.renderer;
      const gl = r.getContext();
      const px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < 5; i++) ctx.pipeline.render(ctx.scene, ctx.camera, 1 / 60);
      sync();
      r.info.autoReset = false;
      r.info.reset();
      const N = 40;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        ctx.pipeline.render(ctx.scene, ctx.camera, 1 / 60);
        sync();
      }
      const ms = (performance.now() - t0) / N;
      console.warn(`perf: ${ms.toFixed(2)} ms/frame synced (whole lab scene incl. shadow pass + composite), draw calls/frame ${(r.info.render.calls / N).toFixed(0)}, tris/frame ${(r.info.render.triangles / N).toFixed(0)}`);
      r.info.autoReset = true;
    });
  }
  // Budgets after the first update (visible geometry only), printed as warnings.
  let reported = false;
  ctx.onFrame((_dt, t) => {
    if (reported || t < 0.5) return;
    reported = true;
    const report = (name: string, o: THREE.Object3D) => {
      const b = budget(o);
      console.warn(`${name}: ${b.triangles} tris, ${b.draws} draws`);
    };
    report("ground", ground.object);
    report("sky dome", sky.dome.object);
    report("clouds (visible)", sky.clouds.object);
    report("backdrop (visible)", sky.backdrop.object);
    for (const c of sky.clouds.object.children) {
      const m = c as THREE.InstancedMesh;
      if (m.count) console.warn(`  clouds/${m.name}: ${m.count} x ${m.geometry.getAttribute("position").count / 3} tris`);
    }
    for (const c of sky.backdrop.object.children) {
      const m = c as THREE.Mesh;
      console.warn(`  backdrop/${m.name}: ${m.geometry.getAttribute("position").count / 3} tris, visible ${m.visible}`);
    }
    report("weather (visible)", weather.object);
    if (river) report("river", river.object);
  });
  return { env, ground, sky, weather, river };
}

/** A river that runs beside the line on the left and bends away. */
export const LAB_RIVER: Array<[number, number]> = [
  [-40, 80],
  [-27, 10],
  [-24, -50],
  [-33, -120],
  [-60, -200],
  [-110, -280],
  [-190, -350],
  [-300, -410],
];
