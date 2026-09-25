/**
 * Nature and rural scatter: the public API.
 *
 * Every prefab variant is ONE BufferGeometry (per-part albedo in `inkAttr`)
 * plus the ink material options to render it with, so the integrator can draw
 * any number of copies with a single THREE.InstancedMesh:
 *
 *   const p = buildPrefab("oak", 2, { leaves: 0.6 });
 *   const mesh = new THREE.InstancedMesh(p.geometry, inkMaterial(p.material), count);
 *
 * Tree, bush, hedge and orchard foliage are alpha-cut leaf cards: their
 * material carries the shared foliage atlas as `alphaMap` + `alphaTest`, and
 * their geometry carries `uv`. Keep the material options exactly as returned
 * (inkMaterial caches by them, so every copy shares one program and texture).
 *
 * Conventions: metres, Y up, origin at the base centre, front toward +Z.
 * Segment prefabs (fences, walls, hedgerows, orchard rows, crop strips) run
 * along local X and tile every `tile` metres.
 */
import * as THREE from "three";
import type { InkMaterialOptions } from "../../core/ink-material.ts";
import { foliageAtlas } from "./atlas.ts";
import { BARBED_FENCE_VARIANTS, FENCE_TILE, RAIL_FENCE_VARIANTS, ROUND_BALE_VARIANTS, SCARECROW_VARIANTS, SHED_VARIANTS, SQUARE_BALE_VARIANTS, WALL_VARIANTS, WELL_VARIANTS, buildBarbedFence, buildRailFence, buildRoundBale, buildScarecrow, buildShed, buildSquareBale, buildWall, buildWell } from "./farm.ts";
import { CROP_TILE, CROP_VARIANTS, FLOWER_VARIANTS, GRASS_VARIANTS, REED_VARIANTS, buildCrop, buildFlowers, buildGrass, buildReeds } from "./ground.ts";
import { MARKER_VARIANTS, TELEGRAPH_VARIANTS, buildMarker, buildTelegraphPole, telegraphAttachments } from "./lineside.ts";
import { BUSH_VARIANTS, HEDGE_TILE, HEDGE_VARIANTS, buildBush, buildHedge } from "./shrubs.ts";
import { BOULDER_VARIANTS, ROCK_VARIANTS, STUMP_VARIANTS, buildBoulder, buildRock, buildStump } from "./stones.ts";
import { BURNT_VARIANTS, CONIFER_VARIANTS, DEAD_VARIANTS, DECIDUOUS_VARIANT_NAMES, ORCHARD_VARIANTS, ORCHARD_TILE, buildBurntTree, buildConifer, buildDeadTree, buildDeciduous, buildOrchardRow } from "./trees.ts";

export { createLeafFall, type LeafFall, type LeafFallOptions } from "./leaf-fall.ts";

export type NaturePrefabId =
  | "oak"
  | "poplar"
  | "birch"
  | "willow"
  | "fruit-tree"
  | "spruce"
  | "pine"
  | "tree-dead"
  | "tree-burnt"
  | "orchard-row"
  | "bush"
  | "hedgerow"
  | "grass-tuft"
  | "wildflowers"
  | "reeds"
  | "crop-strip"
  | "rock"
  | "boulder"
  | "stump"
  | "hay-bale-round"
  | "hay-bale-square"
  | "fence-rail"
  | "fence-barbed"
  | "wall-drystone"
  | "telegraph-pole"
  | "lineside-marker"
  | "scarecrow"
  | "well"
  | "shed";

export type NatureGroup = "tree" | "shrub" | "ground" | "crop" | "stone" | "farm" | "boundary" | "lineside";

export interface NaturePrefabInfo {
  id: NaturePrefabId;
  group: NatureGroup;
  /** Number of seeded variants; `variant` wraps modulo this. */
  variants: number;
  variantNames: readonly string[];
  /** Responds to `options.leaves` (deciduous foliage level). */
  leafy: boolean;
  /** Segment prefab: repeats along local X every `tile` metres. */
  tile?: number;
  /** Crop strips also tile along local Z every `tileDepth` metres. */
  tileDepth?: number;
}

export interface NaturePrefab {
  geometry: THREE.BufferGeometry;
  /** Pass to inkMaterial(); shared across all instances of this prefab. */
  material: InkMaterialOptions;
  /** Max distance of any vertex from the origin (conservative culling sphere). */
  radius: number;
  /** Max horizontal distance of any vertex from the origin (placement clearance). */
  footprint: number;
  /** Top of the prefab above its base (m). */
  height: number;
  /** Segment length along X for tiling prefabs. */
  tile?: number;
  triangles: number;
}

/** The four foliage levels the renderer should quantise `env.leaves` to (cache key). */
export const LEAF_LEVELS = [1, 0.6, 0.25, 0] as const;

const TREE_NAMES = DECIDUOUS_VARIANT_NAMES;

export const NATURE_CATALOGUE: Readonly<Record<NaturePrefabId, NaturePrefabInfo>> = {
  oak: { id: "oak", group: "tree", variants: TREE_NAMES.length, variantNames: TREE_NAMES, leafy: true },
  poplar: { id: "poplar", group: "tree", variants: TREE_NAMES.length, variantNames: TREE_NAMES, leafy: true },
  birch: { id: "birch", group: "tree", variants: TREE_NAMES.length, variantNames: ["single stem", "single stem", "three stems", "single stem"], leafy: true },
  willow: { id: "willow", group: "tree", variants: TREE_NAMES.length, variantNames: TREE_NAMES, leafy: true },
  "fruit-tree": { id: "fruit-tree", group: "tree", variants: TREE_NAMES.length, variantNames: TREE_NAMES, leafy: true },
  spruce: { id: "spruce", group: "tree", variants: CONIFER_VARIANTS, variantNames: Array.from({ length: CONIFER_VARIANTS }, (_, i) => `spruce ${i + 1}`), leafy: false },
  pine: { id: "pine", group: "tree", variants: CONIFER_VARIANTS, variantNames: Array.from({ length: CONIFER_VARIANTS }, (_, i) => `Scots pine ${i + 1}`), leafy: false },
  "tree-dead": { id: "tree-dead", group: "tree", variants: DEAD_VARIANTS.length, variantNames: DEAD_VARIANTS, leafy: false },
  "tree-burnt": { id: "tree-burnt", group: "tree", variants: BURNT_VARIANTS.length, variantNames: BURNT_VARIANTS, leafy: false },
  "orchard-row": { id: "orchard-row", group: "tree", variants: ORCHARD_VARIANTS.length, variantNames: ORCHARD_VARIANTS, leafy: true, tile: ORCHARD_TILE },
  bush: { id: "bush", group: "shrub", variants: BUSH_VARIANTS.length, variantNames: BUSH_VARIANTS, leafy: true },
  hedgerow: { id: "hedgerow", group: "shrub", variants: HEDGE_VARIANTS.length, variantNames: HEDGE_VARIANTS, leafy: true, tile: HEDGE_TILE },
  "grass-tuft": { id: "grass-tuft", group: "ground", variants: GRASS_VARIANTS.length, variantNames: GRASS_VARIANTS, leafy: false },
  wildflowers: { id: "wildflowers", group: "ground", variants: FLOWER_VARIANTS.length, variantNames: FLOWER_VARIANTS, leafy: false },
  reeds: { id: "reeds", group: "ground", variants: REED_VARIANTS.length, variantNames: REED_VARIANTS, leafy: false },
  "crop-strip": { id: "crop-strip", group: "crop", variants: CROP_VARIANTS.length, variantNames: CROP_VARIANTS, leafy: false, tile: CROP_TILE[0], tileDepth: CROP_TILE[1] },
  rock: { id: "rock", group: "stone", variants: ROCK_VARIANTS.length, variantNames: ROCK_VARIANTS, leafy: false },
  boulder: { id: "boulder", group: "stone", variants: BOULDER_VARIANTS.length, variantNames: BOULDER_VARIANTS, leafy: false },
  stump: { id: "stump", group: "stone", variants: STUMP_VARIANTS.length, variantNames: STUMP_VARIANTS, leafy: false },
  "hay-bale-round": { id: "hay-bale-round", group: "farm", variants: ROUND_BALE_VARIANTS.length, variantNames: ROUND_BALE_VARIANTS, leafy: false },
  "hay-bale-square": { id: "hay-bale-square", group: "farm", variants: SQUARE_BALE_VARIANTS.length, variantNames: SQUARE_BALE_VARIANTS, leafy: false },
  "fence-rail": { id: "fence-rail", group: "boundary", variants: RAIL_FENCE_VARIANTS.length, variantNames: RAIL_FENCE_VARIANTS, leafy: false, tile: FENCE_TILE },
  "fence-barbed": { id: "fence-barbed", group: "boundary", variants: BARBED_FENCE_VARIANTS.length, variantNames: BARBED_FENCE_VARIANTS, leafy: false, tile: FENCE_TILE },
  "wall-drystone": { id: "wall-drystone", group: "boundary", variants: WALL_VARIANTS.length, variantNames: WALL_VARIANTS, leafy: false, tile: FENCE_TILE },
  "telegraph-pole": { id: "telegraph-pole", group: "lineside", variants: TELEGRAPH_VARIANTS.length, variantNames: TELEGRAPH_VARIANTS, leafy: false },
  "lineside-marker": { id: "lineside-marker", group: "lineside", variants: MARKER_VARIANTS.length, variantNames: MARKER_VARIANTS, leafy: false },
  scarecrow: { id: "scarecrow", group: "farm", variants: SCARECROW_VARIANTS.length, variantNames: SCARECROW_VARIANTS, leafy: false },
  well: { id: "well", group: "farm", variants: WELL_VARIANTS.length, variantNames: WELL_VARIANTS, leafy: false },
  shed: { id: "shed", group: "farm", variants: SHED_VARIANTS.length, variantNames: SHED_VARIANTS, leafy: false },
};

/** Every prefab id, in catalogue order. */
export const NATURE_PREFABS: readonly NaturePrefabId[] = Object.keys(NATURE_CATALOGUE) as NaturePrefabId[];

export function isNaturePrefabId(id: string): id is NaturePrefabId {
  return Object.prototype.hasOwnProperty.call(NATURE_CATALOGUE, id);
}

// ------------------------------------------------------------- materials

/** Wind sway amplitudes: the shader moves a vertex by sway * wind * height^2. */
const SWAY: Partial<Record<NaturePrefabId, number>> = {
  oak: 0.0011,
  poplar: 0.0009,
  birch: 0.0022,
  willow: 0.004,
  "fruit-tree": 0.005,
  spruce: 0.0007,
  pine: 0.0009,
  "orchard-row": 0.006,
  bush: 0.02,
  hedgerow: 0.012,
  "grass-tuft": 0.9,
  wildflowers: 0.45,
  reeds: 0.07,
};

function foliageMaterial(sway: number | undefined): InkMaterialOptions {
  return {
    vertexInk: true,
    hatch: 0.22,
    hatchAngle: 0.785,
    shade: 0.85,
    alphaMap: foliageAtlas().texture,
    alphaTest: 0.5,
    ...(sway ? { sway } : {}),
  };
}

/** The recommended material for a prefab id (identical for all its variants). */
export function natureMaterial(id: NaturePrefabId): InkMaterialOptions {
  const sway = SWAY[id];
  switch (id) {
    case "oak":
    case "poplar":
    case "birch":
    case "willow":
    case "fruit-tree":
    case "pine":
    case "orchard-row":
    case "bush":
    case "hedgerow":
      return foliageMaterial(sway);
    case "spruce":
      return { vertexInk: true, hatch: 0.2, hatchAngle: 0.785, shade: 0.9, sway };
    case "tree-dead":
    case "tree-burnt":
      return { vertexInk: true, hatch: 0.16, hatchAngle: 0.785, shade: 0.9 };
    case "grass-tuft":
      return { vertexInk: true, edge: 0, side: THREE.DoubleSide, hatch: 0.03, sway };
    case "wildflowers":
      return { vertexInk: true, edge: 0.5, side: THREE.DoubleSide, hatch: 0.03, sway };
    case "reeds":
      return { vertexInk: true, edge: 0, side: THREE.DoubleSide, hatch: 0.04, sway };
    case "crop-strip":
      // Maize stands are leaf cards, so every crop strip uses the atlas.
      return { ...foliageMaterial(sway), hatch: 0.08, side: THREE.DoubleSide };
    case "rock":
      return { vertexInk: true, hatch: 0.08 };
    case "boulder":
      return { vertexInk: true, hatch: 0.12 };
    case "stump":
      return { vertexInk: true, hatch: 0.06, hatchAngle: 0.785 };
    case "hay-bale-round":
    case "hay-bale-square":
      return { vertexInk: true, hatch: 0.07, side: THREE.DoubleSide };
    case "fence-rail":
    case "fence-barbed":
      return { vertexInk: true, hatch: 0.07, side: THREE.DoubleSide };
    case "wall-drystone":
      // Lighter pen for the stone joints: a wall seen along its length would
      // otherwise close up into a dark band.
      return { vertexInk: true, hatch: 0.08, edge: 0.7, side: THREE.DoubleSide };
    case "telegraph-pole":
      return { vertexInk: true, hatch: 0.07, hatchAngle: 0.785 };
    case "lineside-marker":
      return { vertexInk: true, hatch: 0.04 };
    case "scarecrow":
      return { vertexInk: true, hatch: 0.05, side: THREE.DoubleSide };
    case "well":
      return { vertexInk: true, hatch: 0.06 };
    case "shed":
      return { vertexInk: true, hatch: 0.08, side: THREE.DoubleSide };
  }
}

// ---------------------------------------------------------------- build

function geometryFor(id: NaturePrefabId, variant: number, leaves: number): THREE.BufferGeometry {
  switch (id) {
    case "oak":
    case "poplar":
    case "birch":
    case "willow":
    case "fruit-tree":
      return buildDeciduous(id, variant, leaves);
    case "spruce":
    case "pine":
      return buildConifer(id, variant);
    case "tree-dead":
      return buildDeadTree(variant);
    case "tree-burnt":
      return buildBurntTree(variant);
    case "orchard-row":
      return buildOrchardRow(variant, leaves);
    case "bush":
      return buildBush(variant, leaves);
    case "hedgerow":
      return buildHedge(variant, leaves);
    case "grass-tuft":
      return buildGrass(variant);
    case "wildflowers":
      return buildFlowers(variant);
    case "reeds":
      return buildReeds(variant);
    case "crop-strip":
      return buildCrop(variant);
    case "rock":
      return buildRock(variant);
    case "boulder":
      return buildBoulder(variant);
    case "stump":
      return buildStump(variant);
    case "hay-bale-round":
      return buildRoundBale(variant);
    case "hay-bale-square":
      return buildSquareBale(variant);
    case "fence-rail":
      return buildRailFence(variant);
    case "fence-barbed":
      return buildBarbedFence(variant);
    case "wall-drystone":
      return buildWall(variant);
    case "telegraph-pole":
      return buildTelegraphPole(variant);
    case "lineside-marker":
      return buildMarker(variant);
    case "scarecrow":
      return buildScarecrow(variant);
    case "well":
      return buildWell(variant);
    case "shed":
      return buildShed(variant);
  }
}

/** Foliage materials sample the atlas: every geometry drawn with them needs `uv`. */
function ensureUv(g: THREE.BufferGeometry): void {
  if (g.getAttribute("uv")) return;
  const [u, v] = foliageAtlas().solid;
  const n = g.getAttribute("position").count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/**
 * Build one prefab variant. `variant` wraps modulo the id's variant count.
 * `leaves` (0..1, default 1) applies to leafy ids; quantise it to LEAF_LEVELS
 * and cache the result, because each call builds a fresh geometry.
 */
export function buildPrefab(id: string, variant: number, options: { leaves?: number } = {}): NaturePrefab {
  if (!isNaturePrefabId(id)) throw new Error(`nature: unknown prefab id "${id}"`);
  const info = NATURE_CATALOGUE[id];
  const v = ((Math.floor(variant) % info.variants) + info.variants) % info.variants;
  const leaves = Math.max(0, Math.min(1, options.leaves ?? 1));
  const geometry = geometryFor(id, v, leaves);
  const material = natureMaterial(id);
  if (material.alphaMap) ensureUv(geometry);
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  let radius = 0;
  let footprint = 0;
  let height = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    radius = Math.max(radius, Math.hypot(x, y, z));
    footprint = Math.max(footprint, Math.hypot(x, z));
    height = Math.max(height, y);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = `nature:${id}:${v}`;
  const triangles = geometry.index ? geometry.index.count / 3 : pos.count / 3;
  return { geometry, material, radius, footprint, height, tile: info.tile, triangles };
}

/**
 * Wire attachment points (insulator necks) for a telegraph-pole variant, in
 * the prefab's local space. Transform by each pole's instance matrix and hang
 * a catenary between the same index on neighbouring poles. Poles face +Z, the
 * direction the wires run.
 */
export function getTelegraphAttachments(variant: number): THREE.Vector3[] {
  const n = NATURE_CATALOGUE["telegraph-pole"].variants;
  return telegraphAttachments(((Math.floor(variant) % n) + n) % n);
}
