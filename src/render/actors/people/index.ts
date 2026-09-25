/**
 * People: parametric ink figures for every PersonRole and Pose.
 *
 *   createPerson({ role, pose, seed, name?, lookAt? })  -> animated figure
 *   createGroup({ role, count, pose?, spread?, seed, width? }) -> laid-out group
 *
 * Each person is one rigid-skinned SkinnedMesh (one draw call) with procedural
 * poses and two reactions (`struck`, `flinch`). Groups above ~40 people keep a
 * handful of animated figures in front and bake the rest into instanced
 * static variants.
 */
import type { PersonRole, Pose } from "../../api.ts";

export { createPerson, type PersonSpec, type PersonUserData, type Reaction } from "./person.ts";
export { createGroup, type GroupSpec, type GroupUserData, type Spread } from "./crowd.ts";

const ROLE_LIST = [
  "worker",
  "crew",
  "civilian",
  "commuter",
  "child",
  "elder",
  "nurse",
  "doctor",
  "patient",
  "paramedic",
  "engineer",
  "official",
  "executive",
  "inspector",
  "researcher",
  "soldier",
  "police",
  "protester",
  "farmer",
  "student",
  "stationmaster",
  "passenger",
  "refugee",
  "volunteer",
] as const satisfies readonly PersonRole[];
export const PEOPLE_ROLES: readonly PersonRole[] = ROLE_LIST;

const POSE_LIST = [
  "stand",
  "walk",
  "work",
  "wave",
  "sit",
  "tied",
  "kneel",
  "cower",
  "point",
  "hold-sign",
  "queue",
  "carry",
  "lie",
  "wheelchair",
  "watch",
] as const satisfies readonly Pose[];
export const POSES: readonly Pose[] = POSE_LIST;

/** Compile-time exhaustiveness: every PersonRole / Pose is catalogued. */
type Complete<U, L extends readonly unknown[]> = [Exclude<U, L[number]>] extends [never] ? true : false;
const _rolesComplete: Complete<PersonRole, typeof ROLE_LIST> = true;
const _posesComplete: Complete<Pose, typeof POSE_LIST> = true;
void _rolesComplete;
void _posesComplete;
