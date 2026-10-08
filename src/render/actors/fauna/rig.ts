/**
 * Skeletons for fauna. Two rigs cover every species:
 *
 *   QUAD - mammals: root, body, rump (spine flex), a two-bone neck, head,
 *          ears, jaw, four four-bone legs and a three-bone tail.
 *   BIRD - fowl and corvids: root, body, two-bone neck, head, two-bone wings,
 *          three-bone legs, tail.
 *
 * Every bone has an identity rest rotation and a rest position in mesh space,
 * so parts are authored directly where they sit on the animal. A pose stores
 * Euler angles (order YXZ: yaw, then pitch, then roll) and position offsets
 * per bone, which blend linearly and cheaply between behaviours.
 *
 * Sign conventions (animal faces +Z, +X is its left side):
 *   pitch (x) > 0 : nose down / limb swings back
 *   yaw   (y) > 0 : turn toward +X
 *   roll  (z) > 0 : +X side lifts / hanging tail swings toward +X
 */
import * as THREE from "three";

export const QUAD = {
  root: 0,
  body: 1,
  rump: 2,
  neck1: 3,
  neck2: 4,
  head: 5,
  earL: 6,
  earR: 7,
  jaw: 8,
  fl0: 9,
  fl1: 10,
  fl2: 11,
  fl3: 12,
  fr0: 13,
  fr1: 14,
  fr2: 15,
  fr3: 16,
  hl0: 17,
  hl1: 18,
  hl2: 19,
  hl3: 20,
  hr0: 21,
  hr1: 22,
  hr2: 23,
  hr3: 24,
  tail0: 25,
  tail1: 26,
  tail2: 27,
  pool: 28,
} as const;
export const QUAD_COUNT = 29;
export const QUAD_PARENT: readonly number[] = [
  -1, 0, 1, 1, 3, 4, 5, 5, 5, 1, 9, 10, 11, 1, 13, 14, 15, 2, 17, 18, 19, 2, 21, 22, 23, 2, 25, 26, -1,
];

export const BIRD = {
  root: 0,
  body: 1,
  neck1: 2,
  neck2: 3,
  head: 4,
  wingL: 5,
  handL: 6,
  wingR: 7,
  handR: 8,
  thighL: 9,
  shinL: 10,
  footL: 11,
  thighR: 12,
  shinR: 13,
  footR: 14,
  tail: 15,
  jaw: 16,
  pool: 17,
} as const;
export const BIRD_COUNT = 18;
export const BIRD_PARENT: readonly number[] = [-1, 0, 1, 2, 3, 1, 5, 1, 7, 1, 9, 10, 1, 12, 13, 1, 4, -1];

export interface RigDef {
  count: number;
  parent: readonly number[];
}

export const QUAD_RIG: RigDef = { count: QUAD_COUNT, parent: QUAD_PARENT };
export const BIRD_RIG: RigDef = { count: BIRD_COUNT, parent: BIRD_PARENT };

/** Per-bone pose: Euler (YXZ) angles and position offsets from rest. */
export class Pose {
  readonly e: Float32Array;
  readonly p: Float32Array;
  readonly s: Float32Array;
  readonly count: number;
  constructor(count: number) {
    this.count = count;
    this.e = new Float32Array(count * 3);
    this.p = new Float32Array(count * 3);
    this.s = new Float32Array(count).fill(1);
  }
  reset(): this {
    this.e.fill(0);
    this.p.fill(0);
    this.s.fill(1);
    return this;
  }
  copy(o: Pose): this {
    this.e.set(o.e);
    this.p.set(o.p);
    this.s.set(o.s);
    return this;
  }
  /** Add rotation (radians) to a bone. */
  rot(bone: number, x: number, y = 0, z = 0): this {
    this.e[bone * 3] += x;
    this.e[bone * 3 + 1] += y;
    this.e[bone * 3 + 2] += z;
    return this;
  }
  set(bone: number, x: number, y = 0, z = 0): this {
    this.e[bone * 3] = x;
    this.e[bone * 3 + 1] = y;
    this.e[bone * 3 + 2] = z;
    return this;
  }
  move(bone: number, x: number, y: number, z: number): this {
    this.p[bone * 3] += x;
    this.p[bone * 3 + 1] += y;
    this.p[bone * 3 + 2] += z;
    return this;
  }
  /** this = mix(a, b, t) */
  mix(a: Pose, b: Pose, t: number): this {
    const u = 1 - t;
    for (let i = 0; i < this.e.length; i++) this.e[i] = a.e[i]! * u + b.e[i]! * t;
    for (let i = 0; i < this.p.length; i++) this.p[i] = a.p[i]! * u + b.p[i]! * t;
    for (let i = 0; i < this.s.length; i++) this.s[i] = a.s[i]! * u + b.s[i]! * t;
    return this;
  }
  /** Blend only selected bones toward b. */
  mixBones(b: Pose, t: number, bones: readonly number[]): this {
    const u = 1 - t;
    for (const i of bones) {
      for (let k = 0; k < 3; k++) {
        this.e[i * 3 + k] = this.e[i * 3 + k]! * u + b.e[i * 3 + k]! * t;
        this.p[i * 3 + k] = this.p[i * 3 + k]! * u + b.p[i * 3 + k]! * t;
      }
      this.s[i] = this.s[i]! * u + b.s[i]! * t;
    }
    return this;
  }
}

export interface Rig {
  def: RigDef;
  bones: THREE.Bone[];
  /** Rest positions in mesh space. */
  rest: THREE.Vector3[];
  /** Rest offsets relative to the parent bone. */
  local: THREE.Vector3[];
}

/** Create a bone hierarchy for `def` from rest positions in mesh space. */
export function createRig(def: RigDef, rest: THREE.Vector3[]): Rig {
  const bones: THREE.Bone[] = [];
  const local: THREE.Vector3[] = [];
  for (let i = 0; i < def.count; i++) {
    const b = new THREE.Bone();
    b.name = `b${i}`;
    const p = def.parent[i]!;
    const l = rest[i]!.clone();
    if (p >= 0) l.sub(rest[p]!);
    b.position.copy(l);
    local.push(l);
    bones.push(b);
  }
  for (let i = 0; i < def.count; i++) {
    const p = def.parent[i]!;
    if (p >= 0) bones[p]!.add(bones[i]!);
  }
  return { def, bones, rest: rest.map((r) => r.clone()), local };
}

const _e = new THREE.Euler(0, 0, 0, "YXZ");

/** Write a pose into the bones. `rootQ` (optional) premultiplies the root rotation. */
export function applyPose(rig: Rig, pose: Pose, rootQ?: THREE.Quaternion): void {
  const { bones, local } = rig;
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i]!;
    _e.set(pose.e[i * 3]!, pose.e[i * 3 + 1]!, pose.e[i * 3 + 2]!, "YXZ");
    b.quaternion.setFromEuler(_e);
    b.position.set(local[i]!.x + pose.p[i * 3]!, local[i]!.y + pose.p[i * 3 + 1]!, local[i]!.z + pose.p[i * 3 + 2]!);
    const s = Math.max(1e-4, pose.s[i]!);
    b.scale.set(s, s, s);
  }
  if (rootQ) bones[0]!.quaternion.premultiply(rootQ);
}

/** Rest position helper: mirror a left-side (+x) point to the right. */
export const mirror = (v: THREE.Vector3) => new THREE.Vector3(-v.x, v.y, v.z);
