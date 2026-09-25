/**
 * The production asset provider: routes every id to its builder in the asset
 * library. Any category not yet available falls back to placeholder ink.
 */
import type * as THREE from "three";
import { placeholderAssets, type AssetProvider } from "./assets.ts";
import type { LandmarkId } from "./api.ts";
import { createPerson } from "./actors/people/index.ts";
import { buildIndustrial, isIndustrialId } from "./structures/industrial/index.ts";
import { buildCivic, isCivicId } from "./structures/civic/index.ts";

function landmark(id: LandmarkId, spec: { seed: string; env: Parameters<AssetProvider["landmark"]>[1]["env"] }): THREE.Object3D {
  if (isIndustrialId(id)) return buildIndustrial(id, { seed: spec.seed, env: spec.env });
  if (isCivicId(id)) return buildCivic(id, { seed: spec.seed, env: spec.env });
  return placeholderAssets.landmark(id, spec);
}

export const realAssets: AssetProvider = {
  ...placeholderAssets,
  person: (spec) =>
    createPerson({
      role: spec.role,
      ...(spec.pose ? { pose: spec.pose } : {}),
      seed: spec.seed,
      ...(spec.name ? { name: spec.name } : {}),
      ...(spec.detail !== undefined ? { detail: spec.detail } : {}),
      ...(spec.ground !== undefined ? { ground: spec.ground } : {}),
    }),
  landmark,
};
