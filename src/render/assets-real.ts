/**
 * The production asset provider: routes every id to its builder in the
 * procedural asset library.
 */
import * as THREE from "three";
import { placeholderAssets, type AssetProvider, type CabinModule, type ScatterPrefab } from "./assets.ts";
import type { EnvironmentTarget, LandmarkId } from "./api.ts";
import { createPerson } from "./actors/people/index.ts";
import { createAnimal, createHerd, createFlock } from "./actors/fauna/index.ts";
import { buildVehicle, buildMachine, createDroneSwarm } from "./actors/machines/index.ts";
import { propAssets } from "./props/index.ts";
import { buildIndustrial, isIndustrialId } from "./structures/industrial/index.ts";
import { buildCivic, isCivicId } from "./structures/civic/index.ts";
import { buildPrefab, NATURE_CATALOGUE, LEAF_LEVELS, createLeafFall, getTelegraphAttachments, isNaturePrefabId, type NaturePrefabId } from "./world/nature/index.ts";
import { createGround } from "./world/terrain/index.ts";
import { createSky, createWeather } from "./world/sky/index.ts";
import { createCabin } from "./cabin/index.ts";
import { createPortrait } from "./portrait/index.ts";

function landmark(id: LandmarkId, spec: { seed: string; env: Partial<EnvironmentTarget> }): THREE.Object3D {
  if (isIndustrialId(id)) return buildIndustrial(id, { seed: spec.seed, env: spec.env });
  if (isCivicId(id)) return buildCivic(id, { seed: spec.seed, env: spec.env });
  return placeholderAssets.landmark(id, spec);
}

/** Scatter kinds are families; a family's variants span its species. */
const FAMILIES: Record<string, NaturePrefabId[]> = {
  tree: ["oak", "oak", "poplar", "birch", "willow", "fruit-tree"],
  conifer: ["spruce", "pine"],
  "dead-tree": ["tree-dead", "tree-burnt"],
  "orchard-tree": ["fruit-tree"],
  bush: ["bush"],
  hedge: ["hedgerow"],
  rock: ["rock", "boulder"],
  hay: ["hay-bale-round", "hay-bale-square"],
  stump: ["stump"],
  grass: ["grass-tuft"],
  flowers: ["wildflowers"],
  reeds: ["reeds"],
  crop: ["crop-strip"],
  fence: ["fence-rail", "fence-barbed", "wall-drystone"],
  farm: ["scarecrow", "well", "shed"],
  pole: ["telegraph-pole"],
  marker: ["lineside-marker"],
};

function familyVariants(kind: string): Array<[NaturePrefabId, number]> {
  const species = FAMILIES[kind] ?? (isNaturePrefabId(kind) ? [kind] : []);
  return species.flatMap((id) => Array.from({ length: NATURE_CATALOGUE[id].variants }, (_, v) => [id, v] as [NaturePrefabId, number]));
}

const prefabCache = new Map<string, ScatterPrefab | null>();
function prefab(kind: string, variant: number, env: Partial<EnvironmentTarget>): ScatterPrefab | null {
  const all = familyVariants(kind);
  if (!all.length) return null;
  const [id, v] = all[((variant % all.length) + all.length) % all.length]!;
  const leafy = NATURE_CATALOGUE[id].leafy;
  const leaves = leafy ? LEAF_LEVELS.reduce((best, l) => (Math.abs(l - (env.leaves ?? 1)) < Math.abs(best - (env.leaves ?? 1)) ? l : best), 1 as number) : 1;
  const key = `${id}:${v}:${leaves}`;
  if (!prefabCache.has(key)) {
    const built = buildPrefab(id, v, { leaves });
    prefabCache.set(key, { geometry: built.geometry, material: built.material, radius: built.radius });
  }
  return prefabCache.get(key)!;
}

function cabin(seed: string): CabinModule {
  const c = createCabin({ seed });
  const zero = { x: 0, y: 0, width: 0, height: 0 };
  return {
    group: c.group,
    leverHandle: c.leverHandle,
    setLever: (v, dt) => c.setLever(v, dt),
    get leverValue() {
      return c.leverValue;
    },
    setGauges: (g) => c.setGauges(g),
    setScreen: (s) => c.screen.setState(s),
    flashMark: () => c.screen.flashMark(),
    printReceipt: (t) => c.printReceipt(t),
    setMirrorTexture: (tex) => c.setMirrorTexture(tex),
    impact: (o) => c.windshield.impact(o),
    uvAt: (world, camera) => c.windshield.uvAt(world, camera),
    setRain: (a) => c.windshield.setRain(a),
    wipe: () => c.windshield.wipe(),
    clearGlass: () => c.windshield.clear(),
    setKeepsake: (k) => c.setKeepsake(k),
    setAuthority: (a) => c.setAuthority(a),
    tick: (dt, t) => c.tick(dt, t),
    recommendedCamera: (aspect) => c.recommendedCamera(aspect),
    anchors: (camera) => {
      const a = c.anchors(camera);
      return { lever: a.visible.lever ? a.lever : zero, mirror: a.visible.mirror ? a.mirror : zero, dash: a.visible.dash ? a.dash : zero };
    },
  };
}

export function createRealAssets(quality: "low" | "medium" | "high"): AssetProvider {
  return {
    ...placeholderAssets,
    ...propAssets,
    person: (spec) =>
      createPerson({
        role: spec.role,
        ...(spec.pose ? { pose: spec.pose } : {}),
        seed: spec.seed,
        ...(spec.name ? { name: spec.name } : {}),
        ...(spec.detail !== undefined ? { detail: spec.detail } : {}),
        ...(spec.ground !== undefined ? { ground: spec.ground } : {}),
      }),
    animal: (species, spec) => createAnimal(species, { seed: spec.seed, ...(spec.behavior ? { behavior: spec.behavior } : {}) }),
    herd: (species, spec) => createHerd({ species, count: spec.count, seed: spec.seed, radius: spec.radius }),
    flock: (kind, spec) => createFlock({ kind, count: spec.count, seed: spec.seed }),
    vehicle: (id, spec) => buildVehicle(id, { seed: spec.seed }),
    machine: (id, spec) => buildMachine(id, { seed: spec.seed }),
    droneSwarm: (spec) => createDroneSwarm({ count: spec.count, seed: spec.seed }),
    landmark,
    prefab,
    prefabVariants: (kind) => familyVariants(kind).length,
    poleAttachments: (variant) => getTelegraphAttachments(variant),
    sky: () => createSky({ quality }),
    ground: () => createGround({ quality }),
    weather: () => createWeather({ quality }),
    cabin,
    portrait: (seed) => {
      const p = createPortrait({ seed, mirrored: true });
      return {
        texture: p.texture,
        draw: (face, t, opts) => p.draw(face, t, opts),
        settle: (face) => p.settle(face),
      };
    },
    leafFall: () => createLeafFall(),
  };
}

export const realAssets: AssetProvider = createRealAssets("high");
