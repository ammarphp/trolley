/**
 * Rural and civic structures for the ink world.
 *
 *   const barn = buildCivic("barn", { seed: "run-7:barn:2", env });
 *   barn.userData.footprint  // { width, depth } in metres, for placement
 *
 * Every builder returns a THREE.Group holding one merged, vertex-inked mesh
 * (one draw call) plus, where natural, inked sign planes and animated parts.
 * Assets face +Z, origin at base centre, ground at y = 0.
 */
import * as THREE from "three";
import type { EnvironmentTarget, LandmarkId } from "../../api.ts";
import { createRng } from "../../core/rng.ts";
import { Arch } from "./arch.ts";
import { conditionFrom } from "./condition.ts";
import { barn, farmhouse, garden, greenhouse, mill, orchard, waterTower, windmill } from "./rural.ts";
import { church, clinic, courthouse, hospital, library, school, townHouses } from "./town.ts";
import { camp, shelter } from "./refuge.ts";
import { bridge, depot, dispatchOffice, signalBox, station, warehouse, TRACK_OFFSET, type BridgeSpec, type Trackside } from "./rail.ts";

export type CivicId = Extract<
  LandmarkId,
  | "clinic"
  | "hospital"
  | "depot"
  | "station"
  | "signal-box"
  | "library"
  | "school"
  | "farmhouse"
  | "barn"
  | "windmill"
  | "bridge"
  | "mill"
  | "warehouse"
  | "courthouse"
  | "dispatch-office"
  | "town-houses"
  | "church"
  | "water-tower"
  | "greenhouse"
  | "garden"
  | "orchard"
  | "shelter"
  | "camp"
>;

export const CIVIC_IDS: readonly CivicId[] = [
  "farmhouse",
  "barn",
  "windmill",
  "mill",
  "water-tower",
  "greenhouse",
  "garden",
  "orchard",
  "church",
  "school",
  "library",
  "clinic",
  "hospital",
  "courthouse",
  "town-houses",
  "station",
  "signal-box",
  "depot",
  "warehouse",
  "dispatch-office",
  "bridge",
  "shelter",
  "camp",
] as const;

/** Number of seeded design variants per id. */
export const CIVIC_VARIANTS: Readonly<Record<CivicId, number>> = {
  farmhouse: 3,
  barn: 3,
  windmill: 3,
  mill: 2,
  "water-tower": 3,
  greenhouse: 2,
  garden: 2,
  orchard: 3,
  church: 3,
  school: 3,
  library: 2,
  clinic: 3,
  hospital: 2,
  courthouse: 2,
  "town-houses": 3,
  station: 2,
  "signal-box": 3,
  depot: 3,
  warehouse: 3,
  "dispatch-office": 2,
  bridge: 3,
  shelter: 2,
  camp: 2,
};

export type { BridgeSpec, Trackside } from "./rail.ts";
export { TRACK_OFFSET } from "./rail.ts";
export type { Condition } from "./condition.ts";
export { conditionFrom } from "./condition.ts";

export interface CivicOptions {
  seed: number | string;
  env?: Partial<EnvironmentTarget>;
  /** Force a design variant (lab sheets). Otherwise picked from the seed. */
  variant?: number;
}

export interface CivicFootprint {
  width: number;
  depth: number;
}

export function isCivicId(id: string): id is CivicId {
  return (CIVIC_IDS as readonly string[]).includes(id);
}

export function buildCivic(id: CivicId, options: CivicOptions): THREE.Object3D {
  const c = conditionFrom(options.env);
  const seedKey = c.identical ? `civic:${id}:uniform` : `civic:${id}:${String(options.seed)}`;
  const rng = createRng(seedKey);
  const n = CIVIC_VARIANTS[id];
  const pick = rng.int(0, n - 1);
  const variant = options.variant !== undefined ? ((options.variant % n) + n) % n : c.identical ? 0 : pick;
  const a = new Arch(rng.fork(`design:${variant}`), c, id);
  let hatch = 0.14;
  let trackside: Trackside | undefined;
  let bridgeSpec: BridgeSpec | undefined;
  switch (id) {
    case "farmhouse":
      farmhouse(a, variant);
      break;
    case "barn":
      barn(a, variant);
      break;
    case "windmill":
      windmill(a, variant);
      break;
    case "mill":
      mill(a, variant);
      hatch = 0.16;
      break;
    case "water-tower":
      waterTower(a, variant);
      break;
    case "greenhouse":
      greenhouse(a, variant);
      break;
    case "garden":
      garden(a, variant);
      break;
    case "orchard":
      orchard(a, variant);
      break;
    case "church":
      church(a, variant);
      break;
    case "school":
      school(a, variant);
      break;
    case "library":
      library(a, variant);
      break;
    case "clinic":
      clinic(a, variant);
      break;
    case "hospital":
      hospital(a, variant);
      hatch = 0.18;
      break;
    case "courthouse":
      courthouse(a, variant);
      break;
    case "town-houses":
      townHouses(a, variant);
      break;
    case "station":
      trackside = station(a, variant);
      break;
    case "signal-box":
      trackside = signalBox(a, variant);
      break;
    case "depot":
      trackside = depot(a, variant);
      hatch = 0.16;
      break;
    case "warehouse":
      warehouse(a, variant);
      break;
    case "dispatch-office":
      trackside = dispatchOffice(a, variant);
      break;
    case "bridge":
      bridgeSpec = bridge(a, variant);
      hatch = 0.16;
      break;
    case "shelter":
      shelter(a, variant);
      break;
    case "camp":
      camp(a, variant);
      break;
    default: {
      const never: never = id;
      throw new Error(`Unknown civic id ${String(never)}`);
    }
  }
  const group = a.finish(hatch);
  const box = new THREE.Box3().setFromObject(group);
  group.userData.footprint = { width: box.max.x - box.min.x, depth: box.max.z - box.min.z } satisfies CivicFootprint;
  group.userData.bounds = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, height: box.max.y };
  group.userData.civic = { id, variant, ruin: c.ruin, sealed: c.sealed, abandoned: c.abandoned, lit: c.lit };
  if (trackside) group.userData.trackside = { ...trackside, trackOffset: TRACK_OFFSET };
  if (bridgeSpec) group.userData.bridge = bridgeSpec;
  return group;
}
