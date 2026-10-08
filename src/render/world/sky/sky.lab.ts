/**
 * Verification scenes for ground, sky and weather, all from the cab eye.
 *   world-pastoral     morning, light cumulus, river full
 *   world-industrial   overcast, skyline of industry and compute
 *   world-ruin         drought and ruin under a storm, lightning, rain
 *   world-pristine     perfection and uniformity: the ordered world
 *   world-night        night, stars and moon, lit windows
 * Any EnvironmentTarget channel can be overridden with --params.
 */
import * as THREE from "three";
import type { LabScene } from "../../lab/types.ts";
import { LAB_RIVER, worldLab } from "./lab-world.ts";
import { cloudGeometry, createCloudMaterial, type CloudKind } from "./clouds.ts";
import { sunDirection } from "./sun.ts";

const dirFromAngles = (azDeg: number, elDeg: number) => {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
};

export const scenes: LabScene[] = [
  {
    name: "world-pastoral",
    description: "Pastoral morning: clouds 0.3, water 1.",
    build(ctx) {
      worldLab(ctx, {
        env: { cloud: 0.3, water: 1, vegetation: 1, bloom: 0.7, habitation: 0.12, timeOfDay: 0.27, fog: 0.05, wind: 0.3 },
        river: LAB_RIVER,
        origin: [-5300, 2200],
      });
    },
  },
  {
    name: "world-industrial",
    description: "Industrial overcast.",
    build(ctx) {
      worldLab(ctx, {
        env: { cloud: 0.8, gloom: 0.5, industry: 0.85, habitation: 0.6, compute: 0.45, vegetation: 0.45, bloom: 0.1, timeOfDay: 0.42, fog: 0.3, water: 0.6, wind: 0.5 },
        river: LAB_RIVER,
        origin: [4100, -2600],
      });
    },
  },
  {
    name: "world-ruin",
    description: "Drought and ruin under a storm, with a lightning bolt.",
    build(ctx) {
      worldLab(ctx, {
        env: { drought: 1, ruin: 0.8, fire: 0.45, storm: 0.95, lightning: 1, gloom: 0.7, cloud: 0.9, water: 0.5, vegetation: 0.15, bloom: 0, habitation: 0.45, industry: 0.5, timeOfDay: 0.62, fog: 0.15, wind: 0.8 },
        river: LAB_RIVER,
        strikeAt: 0.93,
        strikeYaw: -0.3,
        origin: [-2600, -5200],
      });
    },
  },
  {
    name: "world-pristine",
    description: "Perfection and uniformity.",
    build(ctx) {
      worldLab(ctx, {
        env: { perfection: 1, uniformity: 1, compute: 0.7, habitation: 0.1, people: 0, vegetation: 0.35, bloom: 0, cloud: 0.05, timeOfDay: 0.5, fog: 0, water: 0.3, wind: 0.05 },
        origin: [900, 4100],
      });
    },
  },
  {
    name: "world-night",
    description: "Night: solid ink sky, stars, the moon, lit windows.",
    build(ctx) {
      worldLab(ctx, {
        env: { timeOfDay: 1, cloud: 0.25, habitation: 0.55, industry: 0.3, compute: 0.25, water: 1, gloom: 0.1, fog: 0.05 },
        river: LAB_RIVER,
        light: dirFromAngles(-28, 21),
        origin: [-5300, 2200],
      });
    },
  },
  {
    name: "world-dusk",
    description: "Dusk: a low sun in the frame with its crown of rays.",
    build(ctx) {
      worldLab(ctx, {
        env: { cloud: 0.45, water: 1, vegetation: 0.9, habitation: 0.3, timeOfDay: 0.78, fog: 0.1, wind: 0.2 },
        river: LAB_RIVER,
        light: sunDirection(0.785),
        origin: [6400, 6100],
      });
    },
  },
  {
    name: "world-fog",
    description: "Fog banks low over the fields.",
    build(ctx) {
      worldLab(ctx, {
        env: { cloud: 0.5, fog: 0.85, gloom: 0.2, water: 1, vegetation: 0.9, habitation: 0.35, timeOfDay: 0.3, wind: 0.1 },
        river: LAB_RIVER,
        origin: [-1200, 900],
      });
    },
  },
  {
    name: "world-noflash",
    description: "Storm with noFlashing: the bolt is drawn, no flash callback fires.",
    build(ctx) {
      const w = worldLab(ctx, {
        env: { storm: 0.8, lightning: 1, gloom: 0.5, cloud: 0.8, timeOfDay: 0.5, drought: 0.3, vegetation: 0.6 },
        strikeAt: 0.93,
        strikeYaw: 0.25,
        origin: [2400, -1800],
      });
      w.sky.setNoFlashing(true);
      let flashes = 0;
      w.weather.onLightning(() => flashes++);
      ctx.onFrame((_dt, t) => {
        if (t > 0.98 && t < 0.99) console.warn(`noFlashing flash callbacks: ${flashes}`);
      });
    },
  },
  {
    name: "cloud-lineup",
    description: "Cloud variants at render scale against paper.",
    build(ctx) {
      const sun = ctx.standardStage({ ground: false });
      sun.position.set(40, 60, 30);
      const mat = createCloudMaterial();
      (mat.uniforms.uSunDir!.value as THREE.Vector3).set(0.5, 0.7, 0.4).normalize();
      const kinds: CloudKind[] = ["cumulus", "cumulus", "cumulus", "stratus", "cumulonimbus"];
      kinds.forEach((k, i) => {
        const m = new THREE.Mesh(cloudGeometry(k, i), mat);
        const s = k === "cumulonimbus" ? 0.05 : k === "stratus" ? 0.06 : 0.12;
        m.scale.setScalar(s);
        m.position.set(-220 + i * 110, k === "stratus" ? 60 : 0, -1300);
        m.userData.noShadow = true;
        ctx.scene.add(m);
      });
      ctx.view([0, 60, 0], [0, 60, -1300], 30);
      ctx.camera.far = 1600;
      ctx.camera.updateProjectionMatrix();
      ctx.caption("cumulus x3, stratus, cumulonimbus");
    },
  },
];
