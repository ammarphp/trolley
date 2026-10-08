/**
 * Species registry: every AnimalId maps to a builder, coat set and motion.
 */
import type { AnimalId } from "../../../api.ts";
import type { SpeciesDef } from "../types.ts";
import { COW } from "./cow.ts";
import { SHEEP } from "./sheep.ts";
import { HORSE } from "./horse.ts";
import { DOG } from "./dog.ts";
import { DEER } from "./deer.ts";
import { PIG } from "./pig.ts";
import { RABBIT } from "./rabbit.ts";
import { CHICKEN, GOOSE, CROW } from "./birds.ts";

export const SPECIES: Record<AnimalId, SpeciesDef> = {
  cow: COW,
  sheep: SHEEP,
  horse: HORSE,
  dog: DOG,
  chicken: CHICKEN,
  goose: GOOSE,
  deer: DEER,
  pig: PIG,
  rabbit: RABBIT,
  crow: CROW,
};
