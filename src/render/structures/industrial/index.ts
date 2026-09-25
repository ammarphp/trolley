/**
 * Industrial, compute and catastrophe structures for the ink world.
 *
 *   buildIndustrial(id, { seed, env }) -> THREE.Object3D
 *
 * Every result carries `userData.footprint` (IndustrialFootprint, metres) and
 * `userData.tick(dt, t)` (always present; drives rotors, cranes, beacons,
 * steam, smoke and fire). Some also expose attachment data:
 *   data-center, substation: `userData.gridTie` (Vec3, where a pylon line lands)
 *   isolation-hall:          `userData.cablePath` (Vec3[], the single trunk)
 *   security-fence:          `userData.segmentLength` (tiling pitch along X)
 *
 * Assets face +Z with their origin at the base centre, in metres.
 */
import type * as THREE from "three";
import type { LandmarkId } from "../../api.ts";
import { createRng } from "../../core/rng.ts";
import { Build, resolveVariant, type IndustrialOptions } from "./common.ts";
import { buildCoolingTower, buildPowerStation, buildPylonLine, buildSolarFarm, buildSubstation, buildWindTurbines, getPylonAttachments } from "./power.ts";
import { buildDataCenter, buildIsolationHall, buildLab } from "./compute.ts";
import { buildDesalination, buildFactory, buildPortCranes } from "./heavy.ts";
import { buildAntennaArray, buildCheckpoint, buildSecurityFence, SECURITY_FENCE_SEGMENT } from "./security.ts";
import { buildBurningTown, buildCrater, buildMonolith, buildRuins } from "./aftermath.ts";

export type IndustrialId = Extract<
  LandmarkId,
  | "lab"
  | "data-center"
  | "substation"
  | "power-station"
  | "cooling-tower"
  | "factory"
  | "port-cranes"
  | "desalination"
  | "checkpoint"
  | "security-fence"
  | "ruins"
  | "crater"
  | "monolith"
  | "wind-turbines"
  | "solar-farm"
  | "pylon-line"
  | "antenna-array"
  | "burning-town"
  | "isolation-hall"
>;

export const INDUSTRIAL_IDS: readonly IndustrialId[] = [
  "lab",
  "data-center",
  "substation",
  "power-station",
  "cooling-tower",
  "factory",
  "port-cranes",
  "desalination",
  "checkpoint",
  "security-fence",
  "ruins",
  "crater",
  "monolith",
  "wind-turbines",
  "solar-farm",
  "pylon-line",
  "antenna-array",
  "burning-town",
  "isolation-hall",
] as const;

export function isIndustrialId(id: string): id is IndustrialId {
  return (INDUSTRIAL_IDS as readonly string[]).includes(id);
}

/** Structures that take the "construction" variant while compute is rising. */
const BUILD_OUT: ReadonlySet<IndustrialId> = new Set<IndustrialId>([
  "lab",
  "data-center",
  "substation",
  "power-station",
  "cooling-tower",
  "wind-turbines",
  "solar-farm",
  "isolation-hall",
]);

/** Hatch period per landmark: larger for the colossal ones. */
const HATCH: Record<IndustrialId, number> = {
  lab: 0.22,
  "data-center": 0.3,
  substation: 0.18,
  "power-station": 0.34,
  "cooling-tower": 0.42,
  factory: 0.26,
  "port-cranes": 0.26,
  desalination: 0.24,
  checkpoint: 0.12,
  "security-fence": 0.1,
  ruins: 0.16,
  crater: 0.2,
  monolith: 0.4,
  "wind-turbines": 0.3,
  "solar-farm": 0.16,
  "pylon-line": 0.2,
  "antenna-array": 0.22,
  "burning-town": 0.16,
  "isolation-hall": 0.24,
};

export function buildIndustrial(id: IndustrialId, options: IndustrialOptions): THREE.Object3D {
  const rng = createRng(`industrial:${id}:${options.seed}`);
  const variant = options.variant ?? resolveVariant(options.env, BUILD_OUT.has(id));
  const b = new Build(rng.fork("build"), variant, HATCH[id]);
  const tod = options.env?.timeOfDay;
  b.nightOn = tod !== undefined && (tod >= 0.82 || tod <= 0.12);
  const seed = rng.fork("layout");
  let obj: THREE.Object3D;
  switch (id) {
    case "lab":
      obj = buildLab(b, seed);
      break;
    case "data-center":
      obj = buildDataCenter(b, seed);
      break;
    case "substation":
      obj = buildSubstation(b);
      break;
    case "power-station":
      obj = buildPowerStation(b, seed);
      break;
    case "cooling-tower":
      obj = buildCoolingTower(b, seed);
      break;
    case "factory":
      obj = buildFactory(b, seed);
      break;
    case "port-cranes":
      obj = buildPortCranes(b, seed);
      break;
    case "desalination":
      obj = buildDesalination(b, seed);
      break;
    case "checkpoint":
      obj = buildCheckpoint(b, seed);
      break;
    case "security-fence":
      obj = buildSecurityFence(b);
      break;
    case "ruins":
      obj = buildRuins(b, seed);
      break;
    case "crater":
      obj = buildCrater(b, seed);
      break;
    case "monolith":
      obj = buildMonolith(b, seed);
      break;
    case "wind-turbines":
      obj = buildWindTurbines(b, seed);
      break;
    case "solar-farm":
      obj = buildSolarFarm(b, seed);
      break;
    case "pylon-line":
      obj = buildPylonLine(b, seed);
      break;
    case "antenna-array":
      obj = buildAntennaArray(b, seed);
      break;
    case "burning-town":
      obj = buildBurningTown(b, seed);
      break;
    case "isolation-hall":
      obj = buildIsolationHall(b, seed);
      break;
    default: {
      const never: never = id;
      throw new Error(`Unknown industrial landmark: ${String(never)}`);
    }
  }
  obj.userData.landmark = id;
  return obj;
}

export { getPylonAttachments, SECURITY_FENCE_SEGMENT, resolveVariant };
export type { PylonAttachments } from "./power.ts";
export type { IndustrialFootprint, IndustrialOptions, IndustrialVariant, Vec3 } from "./common.ts";
