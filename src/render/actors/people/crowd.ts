/**
 * createGroup: lays out 1..400 people as a line (queue), cluster, crowd, or
 * across the track.
 *
 * Up to ANIMATED_LIMIT people are individual animated figures. Larger groups
 * keep the front-most `animated` figures live and bake the rest into a few
 * static posed variants drawn with InstancedMesh (one draw call per variant),
 * which read correctly at the 40-200 m the player sees crowds from.
 */
import * as THREE from "three";
import type { PersonRole, Pose } from "../../api.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { createRng, hashString } from "../../core/rng.ts";
import { PEOPLE_HATCH, createPerson, type PersonUserData, type Reaction } from "./person.ts";
import { bakeSkinned } from "./rig.ts";

export type Spread = "line" | "cluster" | "crowd" | "across";

export interface GroupSpec {
  role: PersonRole;
  count: number;
  pose?: Pose;
  spread?: Spread;
  seed: number | string;
  /** Extent across x (m) for rows and crowds. */
  width?: number;
  /** World-space point for everyone to watch. */
  lookAt?: THREE.Vector3;
  /** How many live figures to keep when the group is large (default 12). */
  animated?: number;
  /** Name one member (gets the red scarf). */
  name?: string;
  /** Local y of the real ground for strike landings (see PersonSpec.ground). */
  ground?: number;
  /** Mix in other roles (e.g. a crowd of civilians with some commuters). */
  mix?: PersonRole[];
}

export interface GroupUserData {
  tick: (dt: number, t: number) => void;
  react: (kind: Reaction, direction?: THREE.Vector3) => void;
  setLookAt: (target: THREE.Vector3 | null) => void;
  setPose: (pose: Pose) => void;
  members: THREE.Object3D[];
  instanced: THREE.InstancedMesh[];
  count: number;
}

export const ANIMATED_LIMIT = 40;

interface Slot {
  x: number;
  z: number;
  yaw: number;
}

function layout(spec: GroupSpec, pose: Pose, spread: Spread, rng: ReturnType<typeof createRng>): Slot[] {
  const n = Math.max(1, Math.min(400, Math.floor(spec.count)));
  const out: Slot[] = [];
  switch (spread) {
    case "across": {
      if (pose === "tied" || pose === "lie") {
        // Bodies lying across the rails, one after another along the track,
        // staggered so that from the cab they read as separate people.
        const gap = spec.width ?? 1.05;
        let z = 0;
        const zs: number[] = [];
        for (let i = 0; i < n; i++) {
          zs.push(z);
          z -= gap + rng.range(-0.15, 0.25);
        }
        const mid = (zs[0]! + zs[zs.length - 1]!) / 2;
        zs.forEach((zz, i) => out.push({ x: (i % 2 ? 1 : -1) * rng.range(0.05, 0.22), z: zz - mid, yaw: rng.range(-0.12, 0.12) }));
      } else {
        const W = spec.width ?? Math.max(1.6, n * 0.62);
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          out.push({ x: (t - 0.5) * W + rng.range(-0.06, 0.06), z: rng.range(-0.12, 0.12), yaw: rng.range(-0.18, 0.18) });
        }
      }
      break;
    }
    case "line": {
      const gap = pose === "queue" ? 0.82 : 0.9;
      for (let i = 0; i < n; i++) out.push({ x: rng.range(-0.1, 0.1), z: -i * (gap + rng.range(-0.08, 0.12)), yaw: rng.range(-0.12, 0.12) });
      const mid = out.length ? out[out.length - 1]!.z / 2 : 0;
      for (const s of out) s.z -= mid;
      break;
    }
    case "cluster": {
      if (n <= 3) {
        for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * 0.72 + rng.range(-0.05, 0.05), z: rng.range(-0.15, 0.15), yaw: rng.range(-0.4, 0.4) });
        break;
      }
      const R = 0.42 * Math.sqrt(n) + 0.25;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const r = R * Math.sqrt((i + 0.5) / n);
        const a = i * golden + rng.range(-0.3, 0.3);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // Face roughly toward the centre, a little toward +z.
        const inward = Math.atan2(-x, -z);
        const yaw = r < 0.3 ? rng.range(-0.8, 0.8) : inward * 0.6 + rng.range(-0.4, 0.4);
        out.push({ x, z, yaw });
      }
      break;
    }
    case "crowd": {
      // An irregular mass: elliptical, denser toward the front, with a
      // ragged edge. ~1.6 people per square metre at the core.
      const W = spec.width ?? Math.max(2.5, Math.sqrt(n) * 1.05);
      const Dp = Math.max(1.6, W * 0.55);
      const minD = 0.52;
      const pts: Slot[] = [];
      const wob = [rng.range(0, 6.3), rng.range(0, 6.3), rng.range(0, 6.3)];
      let tries = 0;
      while (pts.length < n && tries < n * 60) {
        tries++;
        const a = rng.range(0, Math.PI * 2);
        const edge = 1 + 0.16 * Math.sin(a * 3 + wob[0]!) + 0.1 * Math.sin(a * 5 + wob[1]!);
        const r = Math.sqrt(rng.next()) * edge;
        const x = Math.cos(a) * r * (W / 2);
        const z = Math.sin(a) * r * (Dp / 2);
        // Relax the spacing as the crowd fills up.
        const need = minD * (tries > n * 30 ? 0.8 : 1);
        if (pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < need * need)) continue;
        pts.push({ x, z, yaw: rng.range(-0.45, 0.45) + Math.sin(x * 0.7 + wob[2]!) * 0.2 });
      }
      out.push(...pts);
      break;
    }
  }
  return out;
}

const variantCache = new Map<string, THREE.BufferGeometry>();

export function createGroup(spec: GroupSpec): THREE.Object3D {
  const seedNum = typeof spec.seed === "number" ? spec.seed >>> 0 : hashString(String(spec.seed));
  const rng = createRng(`group:${spec.role}:${seedNum}`);
  const pose: Pose = spec.pose ?? "stand";
  const n = Math.max(1, Math.min(400, Math.floor(spec.count)));
  const spread: Spread = spec.spread ?? (pose === "tied" ? "across" : pose === "queue" ? "line" : n <= 12 ? "cluster" : "crowd");
  const slots = layout(spec, pose, spread, rng.fork("layout"));
  const group = new THREE.Group();
  group.name = `people:${spec.role}x${n}`;
  const members: THREE.Object3D[] = [];
  const instanced: THREE.InstancedMesh[] = [];
  const liveCount = n <= ANIMATED_LIMIT ? n : Math.min(n, spec.animated ?? 12);
  const detail: 0 | 1 = n <= 12 ? 1 : 0;
  // Front-most (largest z) slots stay live.
  const order = slots.map((s, i) => i).sort((a, b) => slots[b]!.z - slots[a]!.z);
  const live = new Set(order.slice(0, liveCount));
  const roleFor = (i: number): PersonRole => {
    if (!spec.mix || spec.mix.length === 0) return spec.role;
    const r = createRng(`${seedNum}:mix:${i}`);
    return r.chance(0.6) ? spec.role : r.pick(spec.mix);
  };
  const namedIndex = spec.name ? order[Math.min(order.length - 1, rng.int(0, Math.min(3, order.length - 1)))]! : -1;
  slots.forEach((slot, i) => {
    if (!live.has(i)) return;
    const p = createPerson({
      role: roleFor(i),
      pose,
      seed: `${seedNum}:${i}`,
      name: i === namedIndex ? spec.name : undefined,
      lookAt: spec.lookAt,
      detail,
      ground: spec.ground,
    });
    p.position.set(slot.x, 0, slot.z);
    p.rotation.y = slot.yaw;
    group.add(p);
    members.push(p);
  });

  // Static instanced variants for the rest.
  const rest = slots.map((_, i) => i).filter((i) => !live.has(i));
  if (rest.length) {
    const variants = Math.min(8, Math.max(3, Math.ceil(rest.length / 10)));
    const material = inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: PEOPLE_HATCH, objectId: 0.3 });
    const buckets: number[][] = Array.from({ length: variants }, () => []);
    rest.forEach((i, k) => buckets[(k * 7 + (seedNum % 5)) % variants]!.push(i));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    for (let v = 0; v < variants; v++) {
      const ids = buckets[v]!;
      if (!ids.length) continue;
      const role = roleFor(ids[0]!);
      const key = `${role}|${pose}|${seedNum % 4096}|${v}`;
      let geo = variantCache.get(key);
      if (!geo) {
        const src = createPerson({ role, pose, seed: `${seedNum}:v${v}`, detail: -1, blood: false });
        const ud = src.userData as PersonUserData;
        ud.tick(0, 3 + v * 1.7);
        geo = bakeSkinned(ud.mesh);
        variantCache.set(key, geo);
      }
      const inst = new THREE.InstancedMesh(geo, material, ids.length);
      inst.name = `people:instanced:${v}`;
      ids.forEach((i, k) => {
        const s = slots[i]!;
        q.setFromAxisAngle(up, s.yaw);
        m.compose(new THREE.Vector3(s.x, 0, s.z), q, one);
        inst.setMatrixAt(k, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.userData.slots = ids.map((i) => slots[i]!);
      group.add(inst);
      instanced.push(inst);
    }
  }

  // Staggered reactions so a group never moves as one.
  const pending: Array<{ at: number; member: THREE.Object3D; kind: Reaction; dir?: THREE.Vector3 }> = [];
  let clock = 0;
  const swayQ = new THREE.Quaternion();
  const swayM = new THREE.Matrix4();
  const swayP = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  let swayFrame = 0;
  const ud: GroupUserData = {
    members,
    instanced,
    count: n,
    tick(dt, t) {
      clock += dt;
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i]!;
        if (clock >= p.at) {
          (p.member.userData as PersonUserData).react(p.kind, p.dir);
          pending.splice(i, 1);
        }
      }
      for (const mbr of members) (mbr.userData as PersonUserData).tick(dt, t);
      // A slow murmur in the static crowd: each figure turns a degree or two.
      if (instanced.length && (swayFrame++ & 3) === 0) {
        for (const inst of instanced) {
          const sl = inst.userData.slots as Slot[];
          for (let k = 0; k < sl.length; k++) {
            const s = sl[k]!;
            const a = s.yaw + Math.sin(t * 0.35 + s.x * 1.7 + s.z * 2.3) * 0.05;
            swayQ.setFromAxisAngle(up, a);
            swayM.compose(swayP.set(s.x, 0, s.z), swayQ, one);
            inst.setMatrixAt(k, swayM);
          }
          inst.instanceMatrix.needsUpdate = true;
        }
      }
    },
    react(kind, direction) {
      const r = createRng(`${seedNum}:react:${clock.toFixed(2)}`);
      for (const mbr of members) pending.push({ at: clock + r.range(0, kind === "struck" ? 0.12 : 0.45), member: mbr, kind, dir: direction?.clone() });
    },
    setLookAt(target) {
      for (const mbr of members) (mbr.userData as PersonUserData).setLookAt(target);
    },
    setPose(p) {
      for (const mbr of members) (mbr.userData as PersonUserData).setPose(p);
    },
  };
  Object.assign(group.userData, ud);
  return group;
}
