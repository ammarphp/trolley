/**
 * Assembly: turns a rig, a lamp set and decals into one animated actor.
 *
 *   root (caller-owned transform)
 *    └─ pivot (reactions: shove, topple)
 *        └─ inner
 *            ├─ SkinnedMesh (body + wheels / limbs; one draw call)
 *            ├─ lamps  (flat pigment, riding a bone)
 *            └─ decals (inked lettering, riding a bone)
 *
 * userData contract (shared by every vehicle and machine):
 *   tick(dt, t)                 advance wheels, rotors, lamps and reactions
 *   react("struck" | "flinch", dir?)  the trolley hits it / passes close by
 *   setSpeed?(metresPerSecond)  vehicles: wheels roll at this ground speed
 *   footprint {width, depth, height}   metres, for spacing
 *   kind, id, condition
 */
import * as THREE from "three";
import { Decals, LampSet, Rig, clamp01, scorch, type Condition, type Tick, type V3 } from "./common.ts";

export type Reaction = "struck" | "flinch";

export interface ActorUserData {
  kind: "vehicle" | "machine";
  id: string;
  condition: Condition;
  footprint: { width: number; depth: number; height: number };
  tick: Tick;
  react: (kind: Reaction, direction?: THREE.Vector3) => void;
  setSpeed?: (mps: number) => void;
  struck: boolean;
  [key: string]: unknown;
}

export interface WheelMount {
  bone: THREE.Bone;
  r: number;
  /** Rolling direction multiplier (1 normally). */
  sign: number;
}

export type ReactStyle = "shove" | "rail" | "topple" | "none";

export class Assembly {
  readonly rig = new Rig();
  readonly lamps = new LampSet();
  readonly wheels: WheelMount[] = [];
  readonly ticks: Tick[] = [];
  decals: { decals: Decals; texture: THREE.Texture | null; hatch: number; objectId: number; bone: string } | null = null;
  /** Extra meshes that ride a bone (instanced rotor discs, lines, screens). */
  readonly extras: Array<{ object: THREE.Object3D; bone: string }> = [];
  speed = 0;
  /** Suspension bob amplitude (m) while moving. */
  bob = 0.006;
  mass = 1;
  reactStyle: ReactStyle = "shove";

  constructor(
    readonly kind: "vehicle" | "machine",
    readonly id: string,
    readonly condition: Condition,
  ) {}

  wheel(name: string, parent: string, at: V3, geometry: THREE.BufferGeometry, r: number): THREE.Bone {
    const b = this.rig.bone(name, parent, at);
    this.rig.kit(name).add(geometry);
    this.wheels.push({ bone: b, r, sign: 1 });
    return b;
  }

  onTick(fn: Tick): void {
    this.ticks.push(fn);
  }

  finish(material: THREE.Material, footprint: { width: number; depth: number; height: number }, lampBone = "root"): THREE.Group {
    const root = new THREE.Group();
    root.name = `${this.kind}:${this.id}`;
    const pivot = new THREE.Group();
    pivot.name = "pivot";
    const inner = new THREE.Group();
    inner.name = "inner";
    root.add(pivot);
    pivot.add(inner);
    if (this.condition === "wreck" && this.rig.has("body") && this.kind === "vehicle" && this.reactStyle === "shove") {
      // Collapsed suspension: the burnt shell settles with a list.
      const body = this.rig.get("body");
      body.rotation.z += (this.id.length % 2 ? 1 : -1) * 0.045;
      body.rotation.x += 0.02;
    }
    const mesh = this.rig.build(material);
    mesh.name = `${this.id}:body`;
    if (this.condition === "wreck") scorch(mesh.geometry, this.id, this.kind === "vehicle" ? 1 : 0.7);
    inner.add(mesh);
    const lampMesh = this.lamps.build();
    if (lampMesh) this.rig.get(lampBone).add(lampMesh);
    // Paint and lettering burn off a wreck.
    if (this.decals && !(this.condition === "wreck" && this.kind === "vehicle")) {
      if (this.decals.decals.skinned) {
        const d = this.decals.decals.buildSkinned(this.decals.texture, this.decals.hatch, this.decals.objectId, mesh);
        if (d) inner.add(d);
      } else {
        const d = this.decals.decals.build(this.decals.texture, this.decals.hatch, this.decals.objectId);
        if (d) this.rig.get(this.decals.bone).add(d);
      }
    }
    for (const e of this.extras) this.rig.get(e.bone).add(e.object);

    let spin = 0;
    let struckAt = -1;
    let flinchAt = -1;
    let now = 0;
    const shoveDir = new THREE.Vector3();
    let shoveMag = 0;
    const edge = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const bodyBone = this.rig.has("body") ? this.rig.get("body") : null;
    const bodyRestY = bodyBone ? bodyBone.position.y : 0;
    const phase = (this.id.length * 1.37) % 6.28;

    const data: ActorUserData = {
      kind: this.kind,
      id: this.id,
      condition: this.condition,
      footprint,
      struck: false,
      tick: (dt: number, t: number) => {
        now = t;
        if (this.wheels.length && this.speed !== 0) {
          spin += (this.speed * dt) / 1;
          for (const w of this.wheels) w.bone.rotation.x = (spin / w.r) * w.sign;
        }
        if (bodyBone && this.bob > 0) {
          const moving = clamp01(Math.abs(this.speed) / 4);
          bodyBone.position.y = bodyRestY + moving * this.bob * (Math.sin(t * 7.3 + phase) * 0.6 + Math.sin(t * 3.1 + phase * 2) * 0.4);
          bodyBone.rotation.x = moving * this.bob * 0.4 * Math.sin(t * 2.3 + phase);
        }
        for (const f of this.ticks) f(dt, t);
        if (struckAt >= 0) react(t - struckAt);
        if (flinchAt >= 0) {
          const e = t - flinchAt;
          const a = e < 0.9 ? Math.sin(e * 38) * Math.exp(-e * 5) * 0.01 : 0;
          inner.position.x = a;
          if (e >= 0.9) flinchAt = -1;
        }
        this.lamps.commit();
      },
      react: (kind: Reaction, direction?: THREE.Vector3) => {
        if (kind === "flinch") {
          flinchAt = now;
          return;
        }
        if (data.struck) return;
        data.struck = true;
        struckAt = now;
        // Direction into the root's local frame.
        root.updateMatrixWorld(true);
        const q = new THREE.Quaternion();
        root.getWorldQuaternion(q);
        const d = (direction ? direction.clone() : new THREE.Vector3(0, 0, -1).applyQuaternion(q)).applyQuaternion(q.invert());
        d.y = 0;
        if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
        d.normalize();
        shoveDir.copy(d);
        shoveMag = 1 / Math.max(0.3, this.mass);
        if (this.reactStyle === "topple") {
          // Tip over the footprint edge facing away from the trolley.
          edge.set(d.x * footprint.width * 0.5, 0, d.z * footprint.depth * 0.5);
          pivot.position.copy(edge);
          inner.position.sub(edge);
          axis.crossVectors(up, d).normalize();
        }
        for (let i = 0; i < this.lamps.size; i++) this.lamps.set(i, 0);
        this.onStruck?.();
      },
    };
    const react = (e: number) => {
      switch (this.reactStyle) {
        case "shove": {
          // A heavy body shoved sideways, yawing a little, then settling.
          const k = 1 - Math.exp(-e * 3.2);
          const dist = shoveMag * 1.6 * k;
          pivot.position.set(shoveDir.x * dist, 0, shoveDir.z * dist);
          pivot.rotation.y = shoveMag * 0.18 * k * Math.sign(shoveDir.x || 1);
          pivot.rotation.z = -shoveDir.x * shoveMag * 0.06 * Math.sin(Math.min(e * 5, Math.PI)) * Math.exp(-e * 1.5);
          break;
        }
        case "rail": {
          // Rolling stock is shunted along the rails and rocks on its springs.
          const k = 1 - Math.exp(-e * 1.4);
          const along = Math.sign(shoveDir.z || -1) * shoveMag * 6 * k;
          pivot.position.set(0, 0, along);
          pivot.rotation.z = 0.035 * Math.sin(e * 6) * Math.exp(-e * 1.8);
          pivot.rotation.x = -0.015 * Math.sin(e * 4) * Math.exp(-e * 2);
          break;
        }
        case "topple": {
          // Falls past the tipping point with a bounce.
          const fall = Math.min(1, (e * e) / 0.45);
          let ang = fall * 1.45;
          if (fall >= 1) ang = 1.45 + 0.08 * Math.sin((e - 0.67) * 14) * Math.exp(-(e - 0.67) * 6);
          pivot.quaternion.setFromAxisAngle(axis, ang * Math.min(1, shoveMag + 0.4));
          break;
        }
        case "none":
          break;
      }
    };
    data.setSpeed = (mps: number) => {
      this.speed = mps;
    };
    root.userData = data;
    this.root = root;
    this.mesh = mesh;
    return root;
  }

  onStruck?: () => void;
  root: THREE.Group | null = null;
  mesh: THREE.SkinnedMesh | null = null;
}
