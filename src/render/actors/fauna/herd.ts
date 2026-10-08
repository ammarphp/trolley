/**
 * Herds: clustered, naturally spaced groups with a shared grazing heading,
 * varied behaviours, gentle separation while they wander, startle waves that
 * run through the group, and stampedes in storms. All animals share the
 * herd's frame so spacing is cheap to enforce; each is still its own
 * single-draw-call skinned mesh with shared geometry and material.
 */
import * as THREE from "three";
import type { AnimalId, EnvironmentTarget } from "../../api.ts";
import { createRng } from "../../core/rng.ts";
import { createAnimal } from "./animal.ts";
import type { AnimalUserData, Behavior, Reaction } from "./types.ts";

export interface HerdSpec {
  species: AnimalId;
  count: number;
  seed: number | string;
  /** Rough radius (m) of the area the herd occupies. */
  radius: number;
  /** One behaviour for all, or "mixed" (default): mostly grazing, some lying, a few watching. */
  behavior?: Behavior | "mixed";
  env?: Partial<EnvironmentTarget>;
  /** Point the watchful ones look at (read live; pass the trolley position). */
  lookAt?: THREE.Vector3 | null;
  heightAt?: (x: number, z: number) => number;
  /** Default "auto": far meshes beyond 70 m. */
  detail?: number | "auto";
  blood?: boolean;
}

export interface HerdUserData {
  tick: (dt: number, t: number) => void;
  react: (kind: Reaction, direction?: THREE.Vector3) => void;
  setBehavior: (b: Behavior) => void;
  setLookAt: (target: THREE.Vector3 | null) => void;
  animals: THREE.Object3D[];
  species: AnimalId;
}

/** Minimum spacing between individuals (m). */
const SPACING: Record<AnimalId, number> = { cow: 2.5, horse: 3, sheep: 1.15, pig: 1.5, deer: 2.2, dog: 1.4, goose: 0.9, chicken: 0.5, rabbit: 0.8, crow: 0.7 };

/** Behaviour mix per species: [graze, rest, walk, alert]. */
const MIX: Partial<Record<AnimalId, [number, number, number, number]>> = {
  cow: [0.6, 0.18, 0.08, 0.14],
  sheep: [0.66, 0.14, 0.08, 0.12],
  horse: [0.64, 0.14, 0.1, 0.12],
  deer: [0.55, 0.15, 0.05, 0.25],
  pig: [0.6, 0.25, 0.1, 0.05],
  chicken: [0.72, 0.08, 0.14, 0.06],
  goose: [0.62, 0.12, 0.14, 0.12],
  crow: [0.6, 0.05, 0.2, 0.15],
  rabbit: [0.6, 0.15, 0.1, 0.15],
  dog: [0.3, 0.3, 0.2, 0.2],
};

type Ctl = { pos: THREE.Vector2; home: THREE.Vector2; heading: number; roam: number; syncFromMover(): void; setBehavior(b: Behavior, keep?: boolean): void; react(k: Reaction, d?: THREE.Vector3): void; behavior: Behavior };

export function createHerd(spec: HerdSpec): THREE.Object3D {
  const rng = createRng(`herd:${spec.species}:${spec.seed}`);
  const group = new THREE.Group();
  group.name = `herd:${spec.species}`;
  const n = Math.max(1, Math.floor(spec.count));
  const spacing = SPACING[spec.species];
  const R = Math.max(spec.radius, Math.sqrt(n) * spacing * 0.9);
  const env = spec.env ?? {};
  const drought = (env.drought ?? 0) > 0.5;
  const stormy = (env.storm ?? 0) > 0.6;

  // Clustered placement with rejection for natural spacing.
  const clusters: THREE.Vector2[] = [];
  const nc = 1 + Math.min(4, Math.floor(n / 10) + rng.int(0, 1));
  for (let i = 0; i < nc; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = i === 0 ? 0 : rng.range(0.35, 0.7) * R;
    clusters.push(new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d));
  }
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    let best: THREE.Vector2 | null = null;
    for (let k = 0; k < 40; k++) {
      const c = clusters[rng.int(0, clusters.length - 1)]!;
      const p = new THREE.Vector2(c.x + rng.gauss() * R * 0.38, c.y + rng.gauss() * R * 0.38);
      if (p.length() > R * 1.15) continue;
      const min = spacing * rng.range(0.85, 1.4);
      if (pts.every((q) => q.distanceTo(p) > min)) {
        best = p;
        break;
      }
      best = best ?? p;
    }
    pts.push(best ?? new THREE.Vector2(rng.range(-R, R), rng.range(-R, R)));
  }

  // Shared heading: grazing animals drift into the wind together.
  const wind = rng.range(0, Math.PI * 2);
  const mix = MIX[spec.species] ?? [0.7, 0.1, 0.1, 0.1];
  const restBias = drought ? 0.2 : 0;
  const animals: THREE.Object3D[] = [];
  const ctls: Ctl[] = [];
  for (let i = 0; i < n; i++) {
    let b: Behavior;
    if (spec.behavior && spec.behavior !== "mixed") b = spec.behavior;
    else if (stormy) b = rng.chance(0.4) ? "flee" : "alert";
    else {
      const r = rng.next();
      const [g, re, w] = mix;
      b = r < g - restBias * 0.5 ? "graze" : r < g + re + restBias * 0.5 ? "rest" : r < g + re + w ? "walk" : "alert";
    }
    const a = createAnimal(spec.species, {
      seed: `${spec.seed}:${i}`,
      behavior: b,
      env,
      lookAt: spec.lookAt ?? null,
      roam: b === "walk" ? R * 0.6 : Math.max(1.5, spacing * 1.2),
      detail: spec.detail ?? "auto",
      heightAt: spec.heightAt,
      blood: spec.blood,
    });
    const ud = a.userData as unknown as AnimalUserData & { controller: Ctl };
    const heading = rng.chance(0.7) ? wind + rng.gauss() * 0.55 : rng.range(0, Math.PI * 2);
    ud.mover.position.set(pts[i]!.x, 0, pts[i]!.y);
    ud.mover.rotation.y = heading;
    ud.controller.syncFromMover();
    ud.controller.roam = b === "walk" ? R * 0.6 : Math.max(1.5, spacing * 1.2);
    group.add(a);
    animals.push(a);
    ctls.push(ud.controller);
  }

  // Herd-level timers.
  let sepT = 0;
  let boltT = stormy ? rng.range(2, 8) : Infinity;
  const pending: Array<{ at: number; i: number; kind: Reaction; dir?: THREE.Vector3 }> = [];
  let clock = 0;

  const separate = () => {
    for (let i = 0; i < ctls.length; i++) {
      const a = ctls[i]!;
      for (let j = i + 1; j < ctls.length; j++) {
        const b = ctls[j]!;
        const dx = b.pos.x - a.pos.x,
          dz = b.pos.y - a.pos.y;
        const d2 = dx * dx + dz * dz;
        const min = spacing * 0.8;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.25;
          const ux = dx / d,
            uz = dz / d;
          a.pos.x -= ux * push;
          a.pos.y -= uz * push;
          b.pos.x += ux * push;
          b.pos.y += uz * push;
        }
      }
    }
  };

  const ud: HerdUserData = {
    animals,
    species: spec.species,
    tick: (dt: number, t: number) => {
      clock += dt;
      for (const a of animals) (a.userData as unknown as AnimalUserData).tick(dt, t);
      sepT -= dt;
      if (sepT <= 0) {
        sepT = 0.25;
        separate();
      }
      // Staggered reactions.
      for (let k = pending.length - 1; k >= 0; k--) {
        const p = pending[k]!;
        if (clock >= p.at) {
          ctls[p.i]!.react(p.kind, p.dir);
          pending.splice(k, 1);
        }
      }
      // Storm: the whole herd bolts together now and then.
      boltT -= dt;
      if (boltT <= 0) {
        boltT = rng.range(12, 28);
        const a = rng.range(0, Math.PI * 2);
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        group.updateWorldMatrix(true, false);
        dir.applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
        ud.react("flinch", dir);
      }
    },
    react: (kind: Reaction, direction?: THREE.Vector3) => {
      // A wave of alarm: those nearest the threat move first.
      const dir = direction?.clone() ?? new THREE.Vector3(0, 0, 1);
      const local = dir.clone().applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()).invert());
      const lx = local.x,
        lz = local.z;
      const len = Math.hypot(lx, lz) || 1;
      let lo = Infinity,
        hi = -Infinity;
      const proj = ctls.map((c) => -(c.pos.x * lx + c.pos.y * lz) / len);
      for (const p of proj) {
        lo = Math.min(lo, p);
        hi = Math.max(hi, p);
      }
      ctls.forEach((_, i) => {
        const f = hi > lo ? (hi - proj[i]!) / (hi - lo) : 0;
        pending.push({ at: clock + f * 1.2 + rng.range(0, 0.35), i, kind, dir });
      });
    },
    setBehavior: (b: Behavior) => {
      for (const c of ctls) c.setBehavior(b);
    },
    setLookAt: (target: THREE.Vector3 | null) => {
      for (const a of animals) (a.userData as unknown as AnimalUserData).setLookAt(target);
    },
  };
  group.userData = ud as unknown as Record<string, unknown>;
  return group;
}
