/**
 * Fauna: pen-and-ink animals for every AnimalId, herds and ambient flocks.
 *
 *   createAnimal(species, { seed, behavior?, lookAt?, env? })  -> animated animal
 *   createHerd({ species, count, seed, radius, ... })           -> spaced, varied herd
 *   createFlock({ kind, count, seed })                          -> { object, update(dt, t, center) }
 *
 * Each animal is one rigid-part SkinnedMesh (one draw call) built from lofted
 * anatomy with an inked coat atlas, animated procedurally (graze, walk, alert,
 * flee, rest; birds peck, hop and take off). `userData` carries `tick(dt, t)`,
 * `react("flinch" | "struck", dir)`, `setBehavior` and `setLookAt`.
 * Drought (`env.drought > 0.5`) builds thin animals with ribs and hip bones
 * showing and heads carried low; storms (`env.storm > 0.6`) make them bolt.
 */
import type { AnimalId } from "../../api.ts";

export { createAnimal, bodyFor, faunaMaterial, FAR_DISTANCE } from "./animal.ts";
export { createHerd, type HerdSpec, type HerdUserData } from "./herd.ts";
export { createFlock, type Flock, type FlockKind, type FlockSpec } from "./flock.ts";
export type { AnimalSpec, AnimalUserData, Behavior, Reaction } from "./types.ts";

const ANIMAL_LIST = ["cow", "sheep", "horse", "dog", "chicken", "goose", "deer", "pig", "rabbit", "crow"] as const satisfies readonly AnimalId[];
export const ANIMAL_IDS: readonly AnimalId[] = ANIMAL_LIST;

/** Compile-time exhaustiveness: every AnimalId is catalogued. */
type Complete<U, L extends readonly unknown[]> = [Exclude<U, L[number]>] extends [never] ? true : false;
const _complete: Complete<AnimalId, typeof ANIMAL_LIST> = true;
void _complete;
