import * as THREE from "three";
import type { EnvironmentTarget } from "../api.ts";
import { createRealAssets } from "../assets-real.ts";
import type { LabScene } from "../lab/types.ts";
import { buildRiverCrossing } from "./river-crossing.ts";
import { TrackNetwork } from "./track/network.ts";
import { TrackRenderer } from "./track/mesh.ts";

const ENV: EnvironmentTarget = {
  vegetation: 1, leaves: 1, bloom: 1, fauna: 1, birds: 1, habitation: 0.25, people: 0.5, industry: 0, compute: 0, surveillance: 0,
  perfection: 0, ruin: 0, fire: 0, drought: 0, cloud: 0.2, storm: 0, lightning: 0, fog: 0.1, wind: 0.25, timeOfDay: 0.35, gloom: 0,
  speed: 0, water: 1, uniformity: 0,
};

export const scenes: LabScene[] = [
  {
    name: "river-crossing",
    description: "A river across a straight line with each bridge variant, seen from the cab's height. params: variant 0|1|2, at (camera s), width, drought.",
    build(ctx) {
      ctx.standardStage({ ground: true, sun: [60, 80, 40] });
      const network = new TrackNetwork("river-lab");
      const line = network.current;
      line.extendTo(600);
      line.drawTo = 600;
      network.index(line);
      const track = new TrackRenderer();
      track.update(network, 0, -150);
      ctx.scene.add(track.group);
      const assets = createRealAssets("high");
      const env = { ...ENV, drought: Number(ctx.params.drought ?? 0) };
      const crossing = buildRiverCrossing(ctx.scene, () => false, line, 200, assets, () => 0, "lab", env, {
        variant: Number(ctx.params.variant ?? 1),
        width: Number(ctx.params.width ?? 18),
      });
      const at = Number(ctx.params.at ?? 150);
      const p = line.pose(at);
      const ahead = line.pose(at + 40);
      ctx.view([p.x, 3.0, p.z], [ahead.x, 2.2, ahead.z], 55);
      ctx.onFrame((dt) => crossing?.tick(dt, env, new THREE.Vector3(p.x, 0, p.z), ctx.camera));
      ctx.caption(crossing ? `bridge variant ${ctx.params.variant ?? 1}` : "no crossing");
    },
  },
];
