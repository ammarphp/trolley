/**
 * Vehicles and machines for the ink world.
 *
 *   buildVehicle(id, { seed, speed?, env?, condition? }) -> THREE.Object3D
 *   buildMachine(id, { seed, env?, condition?, pose? })  -> THREE.Object3D
 *   createDroneSwarm({ count, seed, formation? })        -> THREE.Object3D
 *   VEHICLE_IDS, MACHINE_IDS
 *
 * Conventions: metres, +Y up, front toward +Z, origin at the base centre.
 * Rail vehicles have their wheel treads at y = 0: place them at rail-top
 * height. Drones hover about their origin; the swarm's formations rise
 * above its origin.
 *
 * Every result carries userData:
 *   tick(dt, t)                         wheels, rotors, lamps, heads, reactions
 *   react("struck" | "flinch", dir?)    shoved / toppled / shunted; robots turn to look
 *   footprint { width, depth, height }  metres
 *   kind, id, condition, struck
 * and, where it applies:
 *   setSpeed(mps)          road and rail vehicles, the quadruped (trot)
 *   setFormation(kind)     drone swarm: "cloud" | "grid" | "wall" | "eye"
 *   lookAt(v3 | null)      humanoid head;  track(v3 | null) camera mast, drone gimbal
 *   aim(v3 | null)         armoured vehicle turret
 *   setHandle(0..1)        isolation cabinet (1 = isolated; LIVE lamp goes dark)
 *   cableExit              isolation cabinet: where the trunk enters the ground
 *   press(on?)             kill switch
 *   setRunning(on)         pump, sorter;  setBeacon(on) tractor;  setAlert(on) rescue carriage
 *
 * Environment: `env.ruin`/`env.fire` draw wrecks (burnt, glass gone, lamps
 * dead); `env.perfection`/`env.uniformity` draw the pristine order (sealed,
 * identical, synchronized; cars become driverless pods). `condition`
 * overrides the environment.
 */
import type * as THREE from "three";
import type { EnvironmentTarget, MachineId, VehicleId } from "../../api.ts";
import { createRng } from "../../core/rng.ts";
import { resolveCondition, seedNumber, type Condition } from "./common.ts";
import { buildCar } from "./road.ts";
import { buildAmbulance, buildBus, buildFireEngine, buildTruck, buildVan } from "./commercial.ts";
import { buildArmoredVehicle, buildMilitaryTruck } from "./military.ts";
import { buildBicycle, buildTractor } from "./farm.ts";
import { buildCateringTrolley, buildFreightWagon, buildPassengerCarriage, buildRescueCarriage } from "./rail.ts";
import { buildIsolationCabinet, buildKillSwitch, buildPump, buildServerRack, buildSorter, buildSwitchboard, buildTerminal, buildTransformer } from "./equipment.ts";
import { buildAntenna, buildCameraMast } from "./masts.ts";
import { buildHumanoid, buildQuadruped, type RobotPose } from "./robots.ts";
import { buildDrone, createDroneSwarm as makeSwarm, type SwarmFormation } from "./drones.ts";

export type { Condition } from "./common.ts";
export type { SwarmFormation } from "./drones.ts";
export type { RobotPose } from "./robots.ts";
export type { ActorUserData, Reaction } from "./assembly.ts";

const VEHICLE_LIST = [
  "ambulance",
  "van",
  "bus",
  "car",
  "truck",
  "tractor",
  "bicycle",
  "rescue-carriage",
  "freight-wagon",
  "passenger-carriage",
  "catering-trolley",
  "military-truck",
  "armored-vehicle",
  "fire-engine",
] as const satisfies readonly VehicleId[];
export const VEHICLE_IDS: readonly VehicleId[] = VEHICLE_LIST;

const MACHINE_LIST = [
  "server-rack",
  "robot-humanoid",
  "robot-quadruped",
  "drone",
  "drone-swarm",
  "isolation-cabinet",
  "transformer",
  "switchboard",
  "pump",
  "sorter",
  "terminal",
  "kill-switch",
  "antenna",
  "camera-mast",
] as const satisfies readonly MachineId[];
export const MACHINE_IDS: readonly MachineId[] = MACHINE_LIST;

/** Rail vehicles stand on the rail head (wheel treads at y = 0). */
export const RAIL_VEHICLES: readonly VehicleId[] = ["rescue-carriage", "freight-wagon", "passenger-carriage", "catering-trolley"];

type Complete<U, L extends readonly unknown[]> = [Exclude<U, L[number]>] extends [never] ? true : false;
const _vehiclesComplete: Complete<VehicleId, typeof VEHICLE_LIST> = true;
const _machinesComplete: Complete<MachineId, typeof MACHINE_LIST> = true;
void _vehiclesComplete;
void _machinesComplete;

export interface VehicleOptions {
  seed: number | string;
  /** Ground speed in m/s: wheels roll (and bodies ride their springs) at this speed. */
  speed?: number;
  env?: Partial<EnvironmentTarget>;
  /** Overrides the condition derived from `env`. */
  condition?: Condition;
  /** freight-wagon only: force a body instead of choosing by seed. */
  variant?: "van" | "tank" | "container";
}

export interface MachineOptions {
  seed: number | string;
  env?: Partial<EnvironmentTarget>;
  condition?: Condition;
  /** robot-humanoid only (default chosen by seed). */
  pose?: RobotPose;
  /** drone-swarm only (defaults: 120 drones, "cloud"). */
  count?: number;
  formation?: SwarmFormation;
}

export function buildVehicle(id: VehicleId, options: VehicleOptions): THREE.Object3D {
  const condition = resolveCondition(options.env, options.condition);
  // The pristine order builds identical copies: the seed is ignored.
  const seed = condition === "pristine" ? 0 : seedNumber(options.seed);
  const rng = createRng(`vehicle:${id}:${seed}`);
  const speed = options.speed ?? 0;
  const road = { seed, rng, condition, speed };
  const rail = { seed, condition, speed };
  switch (id) {
    case "car":
      return buildCar(road);
    case "van":
      return buildVan(road);
    case "ambulance":
      return buildAmbulance(road);
    case "bus":
      return buildBus(road);
    case "truck":
      return buildTruck(road);
    case "fire-engine":
      return buildFireEngine(road);
    case "military-truck":
      return buildMilitaryTruck(road);
    case "armored-vehicle":
      return buildArmoredVehicle(road);
    case "tractor":
      return buildTractor(road);
    case "bicycle":
      return buildBicycle(road);
    case "passenger-carriage":
      return buildPassengerCarriage(rail);
    case "rescue-carriage":
      return buildRescueCarriage(rail);
    case "freight-wagon":
      return buildFreightWagon({ ...rail, ...(options.variant ? { variant: options.variant } : {}) });
    case "catering-trolley":
      return buildCateringTrolley(rail);
    default: {
      const never: never = id;
      throw new Error(`buildVehicle: unknown id ${String(never)}`);
    }
  }
}

export function buildMachine(id: MachineId, options: MachineOptions): THREE.Object3D {
  const condition = resolveCondition(options.env, options.condition);
  const seed = condition === "pristine" ? 0 : seedNumber(options.seed);
  const rng = createRng(`machine:${id}:${seed}`);
  const b = { seed, rng, condition };
  switch (id) {
    case "server-rack":
      return buildServerRack(b);
    case "robot-humanoid":
      return buildHumanoid({ ...b, ...(options.pose ? { pose: options.pose } : {}) });
    case "robot-quadruped":
      return buildQuadruped(b);
    case "drone":
      return buildDrone(b);
    case "drone-swarm":
      return makeSwarm({ count: options.count ?? 120, seed: options.seed, formation: options.formation ?? "cloud", condition });
    case "isolation-cabinet":
      return buildIsolationCabinet(b);
    case "transformer":
      return buildTransformer(b);
    case "switchboard":
      return buildSwitchboard(b);
    case "pump":
      return buildPump(b);
    case "sorter":
      return buildSorter(b);
    case "terminal":
      return buildTerminal(b);
    case "kill-switch":
      return buildKillSwitch(b);
    case "antenna":
      return buildAntenna(b);
    case "camera-mast":
      return buildCameraMast(b);
    default: {
      const never: never = id;
      throw new Error(`buildMachine: unknown id ${String(never)}`);
    }
  }
}

/** 50–300 drones in formation; `userData.setFormation(kind)` morphs between shapes. */
export function createDroneSwarm(spec: { count: number; seed: number | string; formation?: SwarmFormation; env?: Partial<EnvironmentTarget> }): THREE.Object3D {
  const condition = resolveCondition(spec.env);
  return makeSwarm({ count: spec.count, seed: spec.seed, formation: spec.formation ?? "cloud", condition });
}
