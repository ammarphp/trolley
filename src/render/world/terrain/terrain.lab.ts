/**
 * Ground and river lab scenes.
 *   ground-insitu   cab-eye view, pastoral env (params: any EnvironmentTarget channel)
 *   ground-map      raised view over the field patchwork
 */
import * as THREE from "three";
import type { LabScene } from "../../lab/types.ts";
import { createGround } from "./ground.ts";
import { applyLighting, budget, cabView, envOf, groundTrack, telegraphPoles } from "./lab-kit.ts";
import type { EnvironmentTarget } from "../../api.ts";

function sunFor(tod: number): THREE.Vector3 {
  // Morning light from the front right, dusk from the front left.
  const az = THREE.MathUtils.lerp(0.9, -1.0, THREE.MathUtils.clamp((tod - 0.2) / 0.6, 0, 1));
  const el = Math.max(0.05, Math.sin(THREE.MathUtils.clamp((tod - 0.18) / 0.64, 0, 1) * Math.PI) * 1.0);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

import { Kit, block, gable } from "../../core/geometry.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { heightAt } from "./height.ts";

import { createRiver } from "./river.ts";

export const scenes: LabScene[] = [
  {
    name: "river-states",
    description: "A river seen from its bank: params {water, drought}.",
    build(ctx) {
      const env = envOf({ timeOfDay: 0.3, ...(ctx.params as Partial<EnvironmentTarget>) });
      const sun = ctx.standardStage({ ground: false });
      applyLighting(ctx, sun, env, sunFor(env.timeOfDay));
      const ground = createGround({ seed: "lab" });
      ctx.scene.add(ground.object);
      const river = createRiver({ points: [[-60, 40], [-20, -10], [5, -60], [0, -140], [-40, -230], [-120, -300]] });
      ctx.scene.add(river.object);
      const high = (ctx.params as { high?: boolean }).high;
      // From the embankment of a line that runs beside the river.
      const eye: [number, number, number] = high ? [40, 90, 60] : [30, heightAt(30, 0) + 7, 0];
      ctx.view(eye, high ? [-8, 0, -40] : [0, heightAt(0, -70), -70], 55);
      console.warn(`river length ${river.length.toFixed(0)} m, tris ${river.triangles}`);
      ctx.camera.far = 1600;
      ctx.camera.updateProjectionMatrix();
      const rig = new THREE.Vector3(0, 0, 0);
      ctx.onFrame((dt) => {
        ground.update(dt, env, rig, ctx.camera);
        river.update(dt, env, rig, ctx.camera);
      });
    },
  },
  {
    name: "ground-shadow",
    description: "Cast shadows on the ground (a barn and a wall near the line).",
    build(ctx) {
      const env = envOf(ctx.params as Partial<EnvironmentTarget>);
      const sun = ctx.standardStage({ ground: false });
      applyLighting(ctx, sun, env, sunFor(env.timeOfDay));
      const ground = createGround({ seed: "lab" });
      ctx.scene.add(ground.object);
      ctx.scene.add(groundTrack());
      const k = new Kit();
      k.add(block(10, 5, 16), { tone: "paper" });
      k.add(gable(10, 16, 4), { tone: "mid", position: [0, 5, 0] });
      const barn = new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true }));
      barn.position.set(-16, heightAt(-16, -30), -30);
      ctx.scene.add(barn);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 30), inkMaterial({}));
      wall.position.set(9, heightAt(9, -25) + 1, -25);
      ctx.scene.add(wall);
      cabView(ctx);
      const rig = new THREE.Vector3(0, 0, 0);
      ctx.onFrame((dt) => ground.update(dt, env, rig, ctx.camera));
    },
  },
  {
    name: "ground-insitu",
    description: "The engraved ground from the cab.",
    build(ctx) {
      const env = envOf(ctx.params as Partial<EnvironmentTarget>);
      const sun = ctx.standardStage({ ground: false });
      applyLighting(ctx, sun, env, sunFor(env.timeOfDay));
      const ground = createGround({ seed: "lab" });
      ctx.scene.add(ground.object);
      ctx.scene.add(groundTrack());
      ctx.scene.add(telegraphPoles(-4.2, 20, -600));
      cabView(ctx);
      const rig = new THREE.Vector3(0, 0, 0);
      ctx.onFrame((dt) => ground.update(dt, env, rig, ctx.camera));
      const b = budget(ground.object);
      console.warn(`ground: ${b.triangles} tris, ${b.draws} draws`);
    },
  },
  {
    name: "ground-map",
    description: "Raised view over the field patchwork.",
    build(ctx) {
      const env = envOf(ctx.params as Partial<EnvironmentTarget>);
      const sun = ctx.standardStage({ ground: false });
      applyLighting(ctx, sun, env, sunFor(env.timeOfDay));
      const ground = createGround({ seed: "lab" });
      ctx.scene.add(ground.object);
      ctx.scene.add(groundTrack());
      ctx.view([0, 70, 60], [0, 0, -80], 50);
      ctx.camera.near = 0.5;
      ctx.camera.far = 1600;
      ctx.camera.updateProjectionMatrix();
      const rig = new THREE.Vector3(0, 0, 0);
      ctx.onFrame((dt) => ground.update(dt, env, rig, ctx.camera));
    },
  },
];
