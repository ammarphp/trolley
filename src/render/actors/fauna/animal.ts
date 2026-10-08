/**
 * Animal assembly: cached skinned geometry per (species, coat, condition,
 * detail), a fresh skeleton per animal, one shared ink material per species
 * and object-id slot, and a motion controller wired to `userData.tick`.
 */
import * as THREE from "three";
import type { AnimalId } from "../../api.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { createRng, hashString } from "../../core/rng.ts";
import { speciesAtlas } from "./coat.ts";
import { createRig } from "./rig.ts";
import type { BodyBuild } from "./body.ts";
import { QuadController } from "./quad-motion.ts";
import { BirdController } from "./bird-motion.ts";
import { SPECIES } from "./species/index.ts";
import type { AnimalSpec, AnimalUserData, Behavior, Reaction } from "./types.ts";

const GEOMETRY = new Map<string, BodyBuild>();

export const DETAIL_NEAR = 1;
export const DETAIL_FAR = 0.5;
/** Camera distance (m) beyond which `detail: "auto"` animals use the far mesh. */
export const FAR_DISTANCE = 70;

export function bodyFor(species: AnimalId, variant: number, thin: boolean, detail: number): BodyBuild {
  const def = SPECIES[species];
  const v = variant % Math.max(1, def.variants);
  const th = thin && def.thinVariant;
  const key = `${species}|${v}|${th ? 1 : 0}|${detail}`;
  let b = GEOMETRY.get(key);
  if (!b) {
    b = def.build({ variant: v, thin: th ? 1 : 0, detail, atlas: speciesAtlas(species), seed: hashString(key) % 997 });
    b.geometry.userData.fauna = key;
    GEOMETRY.set(key, b);
  }
  return b;
}

export function faunaMaterial(species: AnimalId, slot: number): THREE.Material {
  const def = SPECIES[species];
  const atlas = speciesAtlas(species);
  return inkMaterial({
    vertexInk: true,
    hatchSpace: "object",
    hatch: def.hatch,
    map: atlas.texture,
    objectId: 0.51 + (slot % 8) * 0.01,
    pattern: def.pattern,
  });
}

const DEFAULT_ROAM: Record<Behavior, number> = { graze: 3, walk: 9, alert: 1, flee: 0, rest: 0 };

export function createAnimal(species: AnimalId, spec: AnimalSpec): THREE.Object3D {
  const def = SPECIES[species];
  const seedStr = `${species}:${spec.seed}`;
  const rng = createRng(seedStr);
  const env = spec.env ?? {};
  const thin = (env.drought ?? 0) > 0.5;
  const stormy = (env.storm ?? 0) > 0.6;
  let behavior: Behavior = spec.behavior ?? "graze";
  if (stormy && spec.behavior === undefined) behavior = "flee";
  const variant = spec.variant ?? rng.int(0, Math.max(0, def.variants - 1));
  const auto = spec.detail === "auto";
  const detail = typeof spec.detail === "number" ? spec.detail : DETAIL_NEAR;
  const body = bodyFor(species, variant, thin, detail);
  const rig = createRig(body.rig, body.rest);
  const mesh = new THREE.SkinnedMesh(body.geometry, faunaMaterial(species, hashString(seedStr)));
  mesh.name = `fauna:${species}`;
  const roots = rig.bones.filter((_, i) => body.rig.parent[i]! < 0);
  for (const r of roots) mesh.add(r);
  mesh.bind(new THREE.Skeleton(rig.bones));
  mesh.userData.sharedGeometry = true;
  mesh.userData.fauna = species;
  // Poses move parts well outside the rest bounds (heads down, lying, struck).
  const bs = body.geometry.boundingSphere!.clone();
  bs.radius *= 1.35;
  mesh.boundingSphere = bs;

  const actor = new THREE.Group();
  actor.name = `animal:${species}`;
  const mover = new THREE.Group();
  actor.add(mover);
  mover.add(mesh);
  const motion = def.quad ?? def.bird!;
  const scale = 1 + rng.range(-1, 1) * motion.scaleVar;
  mover.scale.setScalar(scale);

  const roam = spec.roam ?? DEFAULT_ROAM[behavior] * (species === "chicken" || species === "rabbit" || species === "crow" ? 0.6 : 1);
  const common = {
    rig,
    body,
    rng: rng.fork("motion"),
    mover,
    behavior,
    thin,
    stormy,
    roam,
    lookAt: spec.lookAt ?? null,
    blood: spec.blood ?? true,
    heightAt: spec.heightAt,
  };
  const ctl = def.kind === "quad" ? new QuadController({ ...common, motion: def.quad! }) : new BirdController({ ...common, motion: def.bird! });
  ctl.anchored = spec.anchored ?? false;
  if (spec.dead) ctl.lieDead();

  // Draw-time observation: camera distance for the far LOD, and whether the
  // animal is being drawn at all (unseen animals think at a low rate).
  let farBody: BodyBuild | null = null;
  let camDist = 0;
  let seen = -1;
  let ticks = 0;
  let owed = 0;
  mesh.onBeforeRender = (_r, _s, camera) => {
    camDist = camera.position.distanceTo(_tmp.setFromMatrixPosition(mesh.matrixWorld));
    seen = ticks;
  };

  const ud: AnimalUserData = {
    tick: (dt: number) => {
      ticks++;
      if (auto) {
        const wantFar = camDist > FAR_DISTANCE;
        if (wantFar && !farBody) farBody = bodyFor(species, variant, thin, DETAIL_FAR);
        const g = wantFar ? farBody!.geometry : body.geometry;
        if (mesh.geometry !== g) mesh.geometry = g;
      }
      // Off screen for a while: advance in coarse steps (keeps walkers
      // walking and timers running at a fraction of the cost).
      if (seen >= 0 && ticks - seen > 30 && !ctl.isStruck) {
        owed += dt;
        if (ticks % 8 !== 0) return;
        dt = owed;
        owed = 0;
      } else if (owed > 0) {
        dt += owed;
        owed = 0;
      }
      ctl.tick(dt);
      ud.behavior = ctl.behavior;
      ud.struck = ctl.isStruck;
      if (ud.struck && bs.radius < 8) bs.radius = 8;
    },
    react: (kind: Reaction, direction?: THREE.Vector3) => ctl.react(kind, direction),
    setBehavior: (b: Behavior) => ctl.setBehavior(b),
    setLookAt: (target: THREE.Vector3 | null) => {
      ctl.lookAt = target;
    },
    setBlood: (on: boolean) => ctl.setBlood(on),
    species,
    behavior,
    struck: false,
    walkSpeed: ctl.walkSpeed,
    mesh,
    mover,
    height: body.height * scale,
  };
  actor.userData = ud as unknown as Record<string, unknown>;
  (actor.userData as unknown as { controller: unknown }).controller = ctl;
  ctl.tick(0);
  return actor;
}

const _tmp = new THREE.Vector3();
