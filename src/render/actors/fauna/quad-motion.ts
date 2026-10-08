/**
 * Procedural motion for four-legged animals.
 *
 * A small state machine (graze, walk, alert, flee, rest, struck) drives a
 * locomotion model (heading, speed, wander target inside a roam radius) and a
 * layered pose: gait legs and body bob, head and neck carriage with look-at,
 * tail swish, ear flicks and a lying overlay. Behaviour changes cross-fade.
 * Everything is seeded; nothing reads global randomness.
 */
import * as THREE from "three";
import type { Rng } from "../../core/rng.ts";
import { QUAD as Q, Pose, applyPose, type Rig } from "./rig.ts";
import type { BodyBuild } from "./body.ts";
import type { Behavior, QuadMotion, Reaction } from "./types.ts";

const LEGS = [
  { b: [Q.fl0, Q.fl1, Q.fl2, Q.fl3], fore: true, side: 1 },
  { b: [Q.fr0, Q.fr1, Q.fr2, Q.fr3], fore: true, side: -1 },
  { b: [Q.hl0, Q.hl1, Q.hl2, Q.hl3], fore: false, side: 1 },
  { b: [Q.hr0, Q.hr1, Q.hr2, Q.hr3], fore: false, side: -1 },
] as const;

type GaitName = "walk" | "trot" | "gallop" | "bound";
const PHASE: Record<GaitName, [number, number, number, number]> = {
  // LF, RF, LH, RH
  walk: [0.25, 0.75, 0.0, 0.5],
  trot: [0.0, 0.5, 0.5, 0.0],
  gallop: [0.52, 0.62, 0.0, 0.1],
  bound: [0.5, 0.56, 0.0, 0.04],
};
const DUTY: Record<GaitName, number> = { walk: 0.64, trot: 0.45, gallop: 0.34, bound: 0.3 };

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

export interface QuadControllerOptions {
  rig: Rig;
  body: BodyBuild;
  motion: QuadMotion;
  rng: Rng;
  /** Object moved by locomotion (child of the placed actor). */
  mover: THREE.Object3D;
  behavior: Behavior;
  thin: boolean;
  stormy: boolean;
  roam: number;
  lookAt: THREE.Vector3 | null;
  blood: boolean;
  heightAt?: (x: number, z: number) => number;
}

interface Struck {
  t: number;
  vel: THREE.Vector3;
  pos: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  angle: number;
  side: number;
  settled: boolean;
  pool: THREE.Vector3 | null;
  poolT: number;
  flail: number[];
}

export class QuadController {
  readonly pose: Pose;
  private readonly prev: Pose;
  private readonly scratch: Pose;
  private fade = 1;
  private fadeDur = 0.6;
  behavior: Behavior;
  private base: Behavior;
  private readonly m: QuadMotion;
  private readonly rng: Rng;
  private readonly rig: Rig;
  private readonly mover: THREE.Object3D;
  lookAt: THREE.Vector3 | null;
  private readonly thin: boolean;
  private readonly stormy: boolean;
  roam: number;
  /** Home point in the mover's parent space. */
  readonly home = new THREE.Vector2();
  readonly pos = new THREE.Vector2();
  heading = 0;
  speed = 0;
  private targetSpeed = 0;
  private desiredHeading = 0;
  private phase = 0;
  private gaitW = { walk: 1, trot: 0, run: 0 };
  private lie = 0;
  private reachT = 1;
  private grazeSolve: [number, number, number, number];
  // timers
  private clock = 0;
  private stepT = 0;
  private stepping = 0;
  private headUpT = 0;
  private headUp = 0;
  private headLift = 0;
  private swishT = 0;
  private swish = 0;
  private swishDir = 1;
  private earT = [0, 0];
  private ear = [0, 0];
  private wander = new THREE.Vector2();
  private fleeDir = new THREE.Vector2(0, 1);
  private fleeLeft = 0;
  private calm = 0;
  private alertLeft = 0;
  private scan = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private cock = 0;
  private stamp = 0;
  private struck: Struck | null = null;
  private readonly blood: boolean;
  private readonly heightAt?: (x: number, z: number) => number;
  private groundT = 0;
  private grounded = false;
  private slopePitch = 0;
  private slopeRoll = 0;
  readonly phaseOffset: number;
  /** Animate in place: gait and turns play, but the animal never leaves its spot. */
  anchored = false;

  constructor(o: QuadControllerOptions) {
    this.rig = o.rig;
    this.m = o.motion;
    this.rng = o.rng;
    this.mover = o.mover;
    this.lookAt = o.lookAt;
    this.thin = o.thin;
    this.stormy = o.stormy;
    this.roam = o.roam;
    this.blood = o.blood;
    this.heightAt = o.heightAt;
    this.pose = new Pose(o.rig.def.count);
    this.prev = new Pose(o.rig.def.count);
    this.scratch = new Pose(o.rig.def.count);
    this.behavior = o.behavior;
    this.base = o.behavior;
    this.phaseOffset = this.rng.next();
    this.phase = this.phaseOffset;
    this.clock = this.rng.range(0, 100);
    this.stepT = this.rng.range(1, 6);
    this.headUpT = this.rng.range(3, 14);
    this.swishT = this.rng.range(0.5, 5);
    this.earT = [this.rng.range(1, 6), this.rng.range(1, 6)];
    this.heading = 0;
    this.desiredHeading = 0;
    this.grazeSolve = solveReach(o.body, o.rig, this.m);
    this.lie = o.behavior === "rest" ? 1 : 0;
    this.cock = this.rng.chance(0.5) ? 1 : -1;
    this.pickWander(true);
    if (o.behavior === "flee") this.startFlee(new THREE.Vector2(0, -1).rotateAround(new THREE.Vector2(), this.rng.range(-0.6, 0.6)));
    // Settle the initial pose immediately.
    this.synth(0);
    this.prev.copy(this.pose);
  }

  get walkSpeed(): number {
    return this.m.walk[0];
  }

  /** Place the controller's locomotion frame (mover-local x/z) at the current mover transform. */
  syncFromMover(): void {
    this.pos.set(this.mover.position.x, this.mover.position.z);
    this.home.copy(this.pos);
    this.heading = this.mover.rotation.y;
    this.desiredHeading = this.heading;
    this.pickWander(true);
  }

  setBehavior(b: Behavior, keepBase = false): void {
    if (this.struck) return;
    if (!keepBase) this.base = b;
    if (b === this.behavior) return;
    this.prev.copy(this.pose);
    this.fade = 0;
    this.fadeDur = b === "rest" || this.behavior === "rest" ? 2.4 : 0.55;
    if (b === "flee" && this.behavior !== "flee") {
      const away = this.threatDir();
      this.startFlee(away);
    }
    if (b === "alert") this.alertLeft = keepBase ? this.rng.range(4, 9) : Infinity;
    this.behavior = b;
  }

  /** Unit vector (mover-parent x/z) pointing away from the look target, or backward. */
  private threatDir(): THREE.Vector2 {
    const t = this.targetLocal();
    if (t) {
      const d = new THREE.Vector2(this.pos.x - t.x, this.pos.y - t.z);
      if (d.lengthSq() > 1e-4) return d.normalize();
    }
    return new THREE.Vector2(-Math.sin(this.heading), -Math.cos(this.heading));
  }

  private startFlee(away: THREE.Vector2): void {
    this.fleeDir.copy(away).rotateAround(new THREE.Vector2(), this.rng.range(-0.35, 0.35));
    this.fleeLeft = this.rng.range(18, 40) * (0.6 + this.m.skittish);
    this.calm = 0;
  }

  react(kind: Reaction, direction?: THREE.Vector3): void {
    if (this.struck) return;
    if (kind === "flinch") {
      // Startle toward the sound: head up, then bolt if skittish.
      const away = direction ? this.dirToLocal(direction).multiplyScalar(-1) : this.threatDir();
      if (this.behavior === "rest" && this.m.skittish < 0.5) {
        this.setBehavior("alert", true);
        return;
      }
      if (this.rng.next() < 0.35 + this.m.skittish * 0.7 || this.stormy) {
        this.setBehavior("flee", true);
        this.startFlee(away.lengthSq() > 0 ? away.normalize() : this.threatDir());
      } else this.setBehavior("alert", true);
      return;
    }
    this.strike(direction);
  }

  /** Direction (world) into the mover's parent x/z plane. */
  private dirToLocal(dir: THREE.Vector3): THREE.Vector2 {
    const parent = this.mover.parent;
    _v.copy(dir);
    if (parent) {
      parent.getWorldQuaternion(_q).invert();
      _v.applyQuaternion(_q);
    }
    return new THREE.Vector2(_v.x, _v.z);
  }

  /** The look target in the mover's parent space. */
  private targetLocal(): THREE.Vector3 | null {
    if (!this.lookAt) return null;
    const parent = this.mover.parent;
    _v.copy(this.lookAt);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      _m.copy(parent.matrixWorld).invert();
      _v.applyMatrix4(_m);
    }
    return _v;
  }

  private pickWander(initial = false): void {
    const r = this.roam;
    const a = this.rng.range(0, Math.PI * 2);
    const d = Math.sqrt(this.rng.next()) * r;
    this.wander.set(this.home.x + Math.cos(a) * d, this.home.y + Math.sin(a) * d);
    if (initial) this.wander.copy(this.home).add(new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading)).multiplyScalar(r * 0.5));
  }

  // --------------------------------------------------------------- update

  tick(dt: number): void {
    if (dt <= 0) {
      this.write();
      return;
    }
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    if (this.struck) {
      this.tickStruck(dt);
      this.write();
      return;
    }
    this.think(dt);
    this.locomote(dt);
    this.synth(dt);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / this.fadeDur);
      this.scratch.copy(this.pose);
      this.pose.mix(this.prev, this.scratch, smooth(this.fade));
    }
    this.write();
  }

  private write(): void {
    this.mover.position.x = this.pos.x;
    this.mover.position.z = this.pos.y;
    this.mover.rotation.y = this.heading;
    applyPose(this.rig, this.pose, this.struck ? this.rootQ : undefined);
  }

  private rootQ = new THREE.Quaternion();

  private think(dt: number): void {
    const m = this.m;
    const b = this.behavior;
    // Storms keep animals on edge: short bolts, heads up.
    if (this.stormy && b !== "flee" && this.rng.next() < dt * 0.04 * (0.5 + m.skittish)) {
      this.setBehavior("flee", true);
    }
    if (b === "graze") {
      this.stepT -= dt;
      if (this.stepping > 0) {
        this.stepping -= dt;
        this.targetSpeed = m.walk[0] * (this.thin ? 0.16 : 0.24);
        this.steerTo(this.wander, 1.2);
        if (this.pos.distanceTo(this.wander) < 0.8) this.pickWander();
      } else {
        this.targetSpeed = 0;
        if (this.stepT <= 0) {
          this.stepping = this.rng.range(1.2, 3.5);
          this.stepT = this.rng.range(4, 12);
        }
      }
      this.headUpT -= dt;
      if (this.headUp > 0) {
        this.headUp -= dt;
      } else if (this.headUpT <= 0) {
        this.headUp = this.rng.range(2.5, 6);
        this.headUpT = this.rng.range(8, 24) * (this.thin ? 2 : 1);
      }
    } else if (b === "walk") {
      this.targetSpeed = m.walk[0] * (this.thin ? 0.7 : 1);
      this.steerTo(this.wander, 1);
      if (this.pos.distanceTo(this.wander) < 1.5) this.pickWander();
    } else if (b === "alert") {
      this.targetSpeed = 0;
      const t = this.targetLocal();
      if (t) {
        const want = Math.atan2(t.x - this.pos.x, t.z - this.pos.y);
        const off = wrapAngle(want - this.heading);
        if (Math.abs(off) > 1.25 && !this.anchored) {
          this.desiredHeading = want - Math.sign(off) * 0.6;
          this.targetSpeed = 0.18;
        }
      }
      this.alertLeft -= dt;
      if (this.alertLeft <= 0 && this.base !== "alert") this.setBehavior(this.base, true);
      this.stamp = Math.max(0, this.stamp - dt);
    } else if (b === "flee") {
      const run = this.m.run[0] * (this.thin ? 0.55 : 1);
      if (this.fleeLeft > 0) {
        this.targetSpeed = run;
        // Veer gently; keep running away from the threat.
        const want = Math.atan2(this.fleeDir.x, this.fleeDir.y) + Math.sin(this.clock * 0.7 + this.phaseOffset * 9) * 0.25;
        this.desiredHeading = want;
        this.fleeLeft -= this.speed * dt;
      } else {
        this.targetSpeed = m.walk[0] * 0.9;
        this.calm += dt;
        if (this.calm > 2.5) {
          // Stop, turn to look back at what frightened it, then settle.
          this.home.copy(this.pos);
          this.pickWander();
          const settle = this.base === "flee" ? (this.stormy ? "flee" : "alert") : this.base;
          if (settle === "flee") this.startFlee(this.threatDir());
          else {
            this.setBehavior("alert", true);
            this.alertLeft = this.rng.range(5, 10);
            if (this.base === "flee") this.base = "graze";
          }
        }
      }
    } else {
      this.targetSpeed = 0;
    }
    // Stay inside the roam circle (except when fleeing).
    if (b !== "flee" && b !== "rest") {
      const dx = this.pos.x - this.home.x;
      const dz = this.pos.y - this.home.y;
      if (dx * dx + dz * dz > this.roam * this.roam * 1.2) {
        this.wander.copy(this.home);
        this.steerTo(this.home, 1);
      }
    }
    // Tail swish and ear flicks.
    this.swishT -= dt;
    if (this.swishT <= 0 && b !== "flee") {
      this.swish = 1.3;
      this.swishDir = this.rng.chance(0.5) ? 1 : -1;
      this.swishT = this.rng.range(2, 9) * (b === "rest" ? 2 : 1);
    }
    this.swish = Math.max(0, this.swish - dt);
    for (let i = 0; i < 2; i++) {
      this.earT[i]! -= dt;
      if (this.earT[i]! <= 0) {
        this.ear[i] = 0.35;
        this.earT[i] = this.rng.range(1.5, 9);
      }
      this.ear[i] = Math.max(0, this.ear[i]! - dt);
    }
  }

  private steerTo(p: THREE.Vector2, weight: number): void {
    const want = Math.atan2(p.x - this.pos.x, p.y - this.pos.y);
    this.desiredHeading = this.heading + wrapAngle(want - this.heading) * weight;
  }

  private locomote(dt: number): void {
    const accel = this.behavior === "flee" ? 3.5 : 1.2;
    this.speed += THREE.MathUtils.clamp(this.targetSpeed - this.speed, -accel * 1.5 * dt, accel * dt);
    if (Math.abs(this.speed) < 1e-3 && this.targetSpeed === 0) this.speed = 0;
    const turnRate = (this.behavior === "flee" ? 1.6 : 0.7) * (this.speed > 0.05 ? 1 : 0.6);
    const off = this.anchored ? 0 : wrapAngle(this.desiredHeading - this.heading);
    if (!this.anchored) {
      this.heading += THREE.MathUtils.clamp(off, -turnRate * dt, turnRate * dt);
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.y += Math.cos(this.heading) * this.speed * dt;
    }
    // Advance the stride.
    const m = this.m;
    const v = Math.max(0, this.speed);
    const wv = m.walk[0],
      tv = m.trot[0],
      rv = m.run[0];
    let freq: number;
    if (v <= wv) freq = m.walk[1] * Math.sqrt(Math.max(0.05, v / wv));
    else if (v <= tv) freq = THREE.MathUtils.lerp(m.walk[1], m.trot[1], (v - wv) / Math.max(1e-3, tv - wv));
    else freq = THREE.MathUtils.lerp(m.trot[1], m.run[1], Math.min(1, (v - tv) / Math.max(1e-3, rv - tv)));
    // Turning in place still shuffles the feet.
    const turning = Math.abs(off) > 0.05 && v < 0.1 ? 0.35 : 0;
    this.phase = (this.phase + dt * freq * Math.min(1, v / (wv * 0.12) + turning)) % 1;
    // Gait weights.
    const walkMax = wv * 1.35;
    const tw = smooth((v - walkMax) / Math.max(0.1, tv * 0.9 - walkMax));
    const rw = smooth((v - tv * 1.05) / Math.max(0.1, rv * 0.75 - tv * 1.05));
    this.gaitW.run = rw;
    this.gaitW.trot = tw * (1 - rw);
    this.gaitW.walk = (1 - tw) * (1 - rw);
    // Ground following.
    if (this.heightAt && (this.speed > 0.01 || !this.grounded)) {
      this.grounded = true;
      this.groundT -= dt;
      if (this.groundT <= 0) {
        this.groundT = 0.2;
        const parent = this.mover.parent;
        if (parent) {
          parent.updateWorldMatrix(true, false);
          _v.set(this.pos.x, 0, this.pos.y).applyMatrix4(parent.matrixWorld);
          const h = this.heightAt(_v.x, _v.z);
          const base = new THREE.Vector3().setFromMatrixPosition(parent.matrixWorld).y;
          this.mover.position.y = h - base;
          // Stand with the slope: sample fore/aft and either side.
          const L = this.m.foreLen * 0.7,
            Wd = this.m.halfWidth;
          const fx = Math.sin(this.heading),
            fz = Math.cos(this.heading);
          const sx = Math.cos(this.heading),
            sz = -Math.sin(this.heading);
          const at = (dx: number, dz: number) => {
            _v.set(this.pos.x + dx, 0, this.pos.y + dz).applyMatrix4(parent.matrixWorld);
            return this.heightAt!(_v.x, _v.z);
          };
          const hf = at(fx * L, fz * L),
            hb = at(-fx * L, -fz * L);
          const hl = at(sx * Wd, sz * Wd),
            hr = at(-sx * Wd, -sz * Wd);
          this.slopePitch = Math.atan2(hb - hf, 2 * L) * 0.85;
          this.slopeRoll = Math.atan2(hl - hr, 2 * Wd) * 0.7;
        }
      }
    }
  }

  // ------------------------------------------------------------- posing

  private synth(dt: number): void {
    const p = this.pose.reset();
    const m = this.m;
    const b = this.behavior;
    const v = Math.max(0, this.speed);
    const moving = Math.min(1, v / (m.walk[0] * 0.15));
    // Lying overlay amount.
    const lieTarget = b === "rest" && m.lie !== "doze" ? 1 : 0;
    this.lie += THREE.MathUtils.clamp(lieTarget - this.lie, -dt / 1.6, dt / 2.2);
    if (dt === 0) this.lie = lieTarget;
    const lie = smooth(this.lie);

    // Head carriage.
    const [s1, s2, s3] = m.stand;
    let n1 = s1,
      n2 = s2,
      hd = s3;
    const droop = this.thin ? 0.35 : 0;
    if (b === "graze") {
      const want = this.headUp > 0 ? 0.25 : 1;
      this.reachT += THREE.MathUtils.clamp(want - this.reachT, -dt / 0.9, dt / 1.1);
      if (dt === 0) this.reachT = want;
      const r = smooth(this.reachT);
      const [a1, a2, a3, bp] = this.grazeSolve;
      n1 = THREE.MathUtils.lerp(s1 + droop * 0.5, a1, r);
      n2 = THREE.MathUtils.lerp(s2, a2, r);
      hd = THREE.MathUtils.lerp(s3, a3, r);
      p.rot(Q.body, bp * r);
      // Cropping: sweep and tear.
      const crop = r * (this.stepping > 0 ? 0.4 : 1);
      p.rot(Q.neck2, 0, 0.1 * Math.sin(this.clock * 0.9 + this.phaseOffset * 7) * crop);
      p.rot(Q.head, 0.07 * Math.pow(Math.max(0, Math.sin(this.clock * 9.5)), 6) * crop, 0.08 * Math.sin(this.clock * 1.7) * crop);
      // Splay a foreleg forward while grazing.
      p.rot(Q.fl0, -0.12 * r * this.cock * (1 - moving));
      p.rot(Q.fr0, 0.08 * r * this.cock * (1 - moving));
      // Chewing when the head is up.
      if (r < 0.6) p.rot(Q.jaw, 0.08 * Math.max(0, Math.sin(this.clock * 7)));
    } else if (b === "alert") {
      [n1, n2, hd] = m.alert;
      if (this.thin) {
        n1 += 0.2;
        hd += 0.1;
      }
      if (m.hop && v < 0.05) {
        // Rabbits sit up on their haunches to look, forepaws hanging.
        p.rot(Q.body, -0.55);
        p.rot(Q.rump, 0.5);
        p.move(Q.root, 0, 0.015, 0);
        p.rot(Q.fl0, 0.45);
        p.rot(Q.fr0, 0.45);
        p.rot(Q.fl2, 0.6);
        p.rot(Q.fr2, 0.6);
        n1 += 0.35;
      }
    } else if (b === "walk") {
      n1 = s1 + 0.1 + droop;
      n2 = s2;
      hd = s3;
    } else if (b === "flee") {
      n1 = s1 - 0.05;
      n2 = s2 - 0.1;
      hd = s3 + 0.15;
    } else if (b === "rest") {
      if (m.lie === "doze") {
        n1 = s1 + 0.35;
        n2 = s2 + 0.1;
        hd = s3 + 0.2;
      } else {
        n1 = s1 - 0.12;
        n2 = s2;
        hd = s3 + 0.05;
      }
    }
    if (b !== "graze") {
      n1 += droop;
      hd += droop * 0.4;
    }
    p.rot(Q.neck1, n1);
    p.rot(Q.neck2, n2);
    p.rot(Q.head, hd);

    // Look-at (alert, heads-up grazing, resting).
    let wantYaw = 0,
      wantPitch = 0;
    const lookWeight = b === "alert" ? 1 : b === "graze" ? (this.headUp > 0 ? 0.8 : 0) : b === "rest" ? 0.5 : b === "walk" ? 0.25 : 0;
    const t = lookWeight > 0 ? this.targetLocal() : null;
    if (t) {
      const dx = t.x - this.pos.x;
      const dz = t.z - this.pos.y;
      const yaw = wrapAngle(Math.atan2(dx, dz) - this.heading);
      const dist = Math.hypot(dx, dz);
      wantYaw = THREE.MathUtils.clamp(yaw, -1.5, 1.5) * lookWeight;
      wantPitch = -Math.atan2(t.y - this.mover.position.y - m.foreLen * 1.1, Math.max(1, dist)) * 0.5 * lookWeight;
    } else if (b === "alert" || b === "rest") {
      this.scan += dt;
      wantYaw = Math.sin(this.scan * 0.35 + this.phaseOffset * 5) * 0.7 * (b === "rest" ? 0.6 : 1);
    }
    const k = 1 - Math.exp(-dt * 3.5);
    this.lookYaw += (wantYaw - this.lookYaw) * (dt === 0 ? 1 : k);
    this.lookPitch += (wantPitch - this.lookPitch) * (dt === 0 ? 1 : k);
    p.rot(Q.neck1, this.lookPitch * 0.3, this.lookYaw * 0.4);
    p.rot(Q.neck2, this.lookPitch * 0.3, this.lookYaw * 0.3);
    p.rot(Q.head, this.lookPitch * 0.4, this.lookYaw * 0.3, -this.lookYaw * 0.15);

    // Gait.
    const gw = this.gaitW;
    const fAmp = (stride: number, duty: number, len: number) => Math.min(0.7, (stride * duty * 0.5) / len);
    const stride = v > 0.01 ? v / Math.max(0.05, this.freqFor(v)) : 0;
    const legAmt = moving * (1 - lie);
    if (legAmt > 0.001) {
      const wg: GaitName = m.hop ? "bound" : "walk";
      const tg: GaitName = m.hop ? "bound" : "trot";
      if (gw.walk > 0.001) this.gait(p, wg, gw.walk * legAmt, fAmp(stride, DUTY[wg], m.foreLen), fAmp(stride, DUTY[wg], m.hindLen));
      if (gw.trot > 0.001) this.gait(p, tg, gw.trot * legAmt, fAmp(stride, DUTY[tg], m.foreLen), fAmp(stride, DUTY[tg], m.hindLen));
      if (gw.run > 0.001) {
        const g: GaitName = m.runGait === "trot" ? "trot" : m.runGait;
        this.gait(p, g, gw.run * legAmt, fAmp(stride, DUTY[g], m.foreLen) * 0.9, fAmp(stride, DUTY[g], m.hindLen) * 0.9);
      }
    }

    // Tail.
    this.tail(p, b, v);
    // Ears.
    const [roll, fwd] = b === "alert" || b === "flee" ? m.earAlert : m.earRest;
    for (const [i, bone, sgn] of [
      [0, Q.earL, 1],
      [1, Q.earR, -1],
    ] as const) {
      const f = this.ear[i]! > 0 ? Math.sin((this.ear[i]! / 0.35) * Math.PI * 2) * 0.35 : 0;
      p.rot(bone, 0, -sgn * (fwd + f * 0.6), sgn * (roll + f * 0.5));
    }
    p.s[Q.pool] = 0;
    // Horse doze: one hind hoof cocked on its toe.
    if (b === "rest" && m.lie === "doze") {
      const leg = this.cock > 0 ? LEGS[2] : LEGS[3];
      p.rot(leg.b[1], 0.2);
      p.rot(leg.b[2], -0.35);
      p.rot(leg.b[3], 0.8);
      p.move(Q.root, 0, -0.01, 0);
      p.rot(Q.body, 0, 0, this.cock * 0.025);
    }
    // Lying overlay.
    if (lie > 0.001) this.lying(p, lie);
    // Terrain: the whole animal leans with the ground; the head stays level.
    if (this.slopePitch !== 0 || this.slopeRoll !== 0) {
      p.rot(Q.root, this.slopePitch, 0, this.slopeRoll);
      p.rot(Q.neck1, -this.slopePitch * 0.5);
    }
  }

  private freqFor(v: number): number {
    const m = this.m;
    const wv = m.walk[0],
      tv = m.trot[0],
      rv = m.run[0];
    if (v <= wv) return m.walk[1] * Math.sqrt(Math.max(0.05, v / wv));
    if (v <= tv) return THREE.MathUtils.lerp(m.walk[1], m.trot[1], (v - wv) / Math.max(1e-3, tv - wv));
    return THREE.MathUtils.lerp(m.trot[1], m.run[1], Math.min(1, (v - tv) / Math.max(1e-3, rv - tv)));
  }

  private gait(p: Pose, g: GaitName, w: number, aF: number, aH: number): void {
    const ph = PHASE[g];
    const duty = DUTY[g];
    const flex = this.m.flex;
    for (let i = 0; i < 4; i++) {
      const leg = LEGS[i]!;
      const q = (this.phase + ph[i]!) % 1;
      let sweep: number, lift: number;
      if (q < duty) {
        const u = q / duty;
        sweep = -1 + 2 * u;
        lift = 0;
      } else {
        const u = (q - duty) / (1 - duty);
        sweep = 1 - 2 * (u * u * (3 - 2 * u));
        lift = Math.sin(Math.PI * u);
      }
      const [b0, b1, b2, b3] = leg.b;
      if (leg.fore) {
        p.rot(b0, w * (aF * sweep - 0.12 * lift * flex));
        p.rot(b1, w * (-0.45 * lift * flex));
        p.rot(b2, w * (1.25 * lift * flex));
        p.rot(b3, w * (0.45 * lift * flex));
      } else {
        p.rot(b0, w * (aH * sweep - 0.18 * lift * flex));
        p.rot(b1, w * (0.5 * lift * flex));
        p.rot(b2, w * (-0.75 * lift * flex));
        p.rot(b3, w * (0.55 * lift * flex));
      }
    }
    const tau = Math.PI * 2;
    const ph0 = this.phase * tau;
    // Bob amplitudes scale with the animal (tuned on a 1.05 m foreleg).
    const k = this.m.foreLen / 1.05;
    if (g === "walk") {
      p.move(Q.body, 0, w * -0.012 * k * Math.cos(ph0 * 2), 0);
      p.rot(Q.body, 0, w * 0.02 * Math.sin(ph0), w * 0.02 * Math.sin(ph0));
      p.rot(Q.neck2, w * 0.05 * Math.sin(ph0 * 2 + 1));
      p.rot(Q.head, w * 0.04 * Math.sin(ph0 * 2 + 1.6));
    } else if (g === "trot") {
      p.move(Q.body, 0, w * 0.03 * k * Math.abs(Math.sin(ph0)), 0);
      p.rot(Q.body, w * 0.02 * Math.sin(ph0 * 2), 0, w * 0.02 * Math.sin(ph0));
      p.rot(Q.neck2, w * 0.06 * Math.sin(ph0 * 2 + 0.5));
    } else if (g === "bound" && this.m.hop) {
      // Hop: an arc off the hind feet, landing on the fore paws.
      const air = Math.max(0, Math.sin(ph0 - 0.2));
      p.move(Q.root, 0, w * 0.35 * k * air * Math.min(1, this.speed / Math.max(0.1, this.m.walk[0])), 0);
      p.rot(Q.body, w * -0.25 * Math.sin(ph0 - 0.9));
      p.rot(Q.rump, w * 0.25 * Math.sin(ph0 + 1.4));
      p.rot(Q.neck1, w * 0.12 * Math.sin(ph0 - 0.9));
    } else {
      // Gallop / bound: the body rocks and the spine flexes.
      const rock = Math.sin(ph0 + 0.6);
      p.move(Q.body, 0, w * (0.05 * Math.sin(ph0 * 2 - 0.5) + 0.02) * k, 0);
      p.rot(Q.body, w * 0.09 * rock);
      p.rot(Q.rump, w * 0.14 * Math.sin(ph0 + 2.2));
      p.rot(Q.neck1, w * -0.12 * rock);
      p.rot(Q.head, w * 0.08 * rock);
    }
  }

  private tail(p: Pose, b: Behavior, v: number): void {
    const m = this.m;
    const run = Math.min(1, v / Math.max(0.1, m.trot[0]));
    const sw = this.swish > 0 ? Math.sin((this.swish / 1.3) * Math.PI) : 0;
    const idle = Math.sin(this.clock * 0.8 + this.phaseOffset * 11) * 0.08;
    const t = this.clock;
    if (m.tailStyle === "hang") {
      const a = m.tailSwish * sw * this.swishDir;
      p.rot(Q.tail0, m.tailRun * run, 0, a * 0.5 + idle * 0.5);
      p.rot(Q.tail1, 0.1 * run, 0, a * 0.8 * Math.sin(t * 7) + idle);
      p.rot(Q.tail2, 0.1 * run, 0, a * Math.sin(t * 7 - 0.8) + idle);
    } else if (m.tailStyle === "wag") {
      const up = b === "alert" ? -0.55 : b === "flee" ? 0.35 : b === "rest" ? 0.3 : -0.15;
      const wag = b === "walk" || b === "graze" ? 0.45 : b === "alert" ? 0.15 : 0.05;
      const f = b === "alert" ? 3 : 4.5;
      p.rot(Q.tail0, up, 0, wag * Math.sin(t * f * 2));
      p.rot(Q.tail1, up * 0.3, 0, wag * 0.8 * Math.sin(t * f * 2 - 0.7));
      p.rot(Q.tail2, -0.1, 0, wag * 0.6 * Math.sin(t * f * 2 - 1.4));
    } else if (m.tailStyle === "curl") {
      p.rot(Q.tail0, 0, 0, 0.2 * sw * this.swishDir + idle);
      p.rot(Q.tail1, 0, 0.3 * Math.sin(t * 5) * sw, 0);
    } else {
      // flag / scut: raised in alarm.
      const up = b === "flee" ? -1.1 : b === "alert" ? -0.5 : 0;
      p.rot(Q.tail0, up, 0, 0.25 * sw * this.swishDir);
      p.rot(Q.tail1, up * 0.3, 0, 0.3 * sw * this.swishDir);
    }
  }

  private lying(p: Pose, k: number): void {
    const m = this.m;
    const L = this.scratch.reset();
    if (m.lie === "sternal") {
      L.move(Q.root, 0, -m.lieDrop, 0);
      L.rot(Q.body, 0.02, 0, 0.1 * this.cock);
      L.rot(Q.neck1, -0.15);
      for (const leg of [LEGS[0], LEGS[1]]) {
        L.rot(leg.b[0], 0.35, 0, -leg.side * 0.05);
        L.rot(leg.b[1], -1.75);
        L.rot(leg.b[2], 2.75);
        L.rot(leg.b[3], 0.35);
      }
      for (const leg of [LEGS[2], LEGS[3]]) {
        const under = leg.side === this.cock;
        // One hind leg tucked under the belly, the other folded alongside.
        L.rot(leg.b[0], under ? -1.3 : -0.95, 0, leg.side * (under ? -0.12 : 0.18));
        L.rot(leg.b[1], under ? 2.0 : 1.6);
        L.rot(leg.b[2], under ? -2.45 : -2.1);
        L.rot(leg.b[3], 0.6);
      }
      // Tail drooping to the ground behind, curling to one side.
      L.rot(Q.tail0, 0.4, 0, this.cock * 0.3);
      L.rot(Q.tail1, -0.25, 0, this.cock * 0.5);
    } else if (m.lie === "sphinx") {
      L.move(Q.root, 0, -m.lieDrop, 0);
      L.rot(Q.body, 0.04);
      for (const leg of [LEGS[0], LEGS[1]]) {
        L.rot(leg.b[0], -0.35);
        L.rot(leg.b[1], -1.25);
        L.rot(leg.b[2], 0.25);
        L.rot(leg.b[3], -0.3);
      }
      for (const leg of [LEGS[2], LEGS[3]]) {
        L.rot(leg.b[0], -1.25, 0, leg.side * 0.25);
        L.rot(leg.b[1], 1.7);
        L.rot(leg.b[2], -1.9);
        L.rot(leg.b[3], 0.9);
      }
      L.rot(Q.tail0, 0.6, 0, this.cock * 0.5);
    } else if (m.lie === "side") {
      // Flat out on one side (pigs, dogs in the sun).
      const phi = 1.45 * this.cock;
      const yc = this.rig.rest[Q.body]!.y;
      L.set(Q.root, 0, 0, phi);
      L.p[Q.root * 3] = yc * Math.sin(phi);
      L.p[Q.root * 3 + 1] = m.halfWidth * 0.92 - yc * Math.cos(phi);
      for (const leg of LEGS) {
        L.rot(leg.b[0], leg.fore ? -0.35 : 0.3, 0, -this.cock * 0.15);
        L.rot(leg.b[1], leg.fore ? -0.3 : 0.4);
        L.rot(leg.b[2], leg.fore ? 0.4 : -0.5);
      }
      L.rot(Q.neck1, 0.25, 0, 0);
      L.rot(Q.head, 0.1, 0, -this.cock * 0.2);
    } else if (m.lie === "loaf") {
      L.move(Q.root, 0, -m.lieDrop, 0);
      for (const leg of [LEGS[0], LEGS[1]]) {
        L.rot(leg.b[0], 0.2);
        L.rot(leg.b[1], -1.2);
        L.rot(leg.b[2], 1.8);
      }
      for (const leg of [LEGS[2], LEGS[3]]) {
        L.rot(leg.b[0], -0.6);
        L.rot(leg.b[1], 0.8);
        L.rot(leg.b[2], -1.2);
      }
    }
    // Legs and root take the lying pose; body, tail and neck add to it.
    for (const bone of [Q.root, ...LEGS.flatMap((l) => [...l.b])]) {
      for (let c = 0; c < 3; c++) {
        const i = bone * 3 + c;
        p.e[i] = p.e[i]! * (1 - k) + L.e[i]! * k;
        p.p[i] = p.p[i]! * (1 - k) + L.p[i]! * k;
      }
    }
    for (const bone of [Q.body, Q.tail0, Q.tail1, Q.neck1, Q.head]) {
      for (let c = 0; c < 3; c++) {
        const i = bone * 3 + c;
        p.e[i] = p.e[i]! + L.e[i]! * k;
        p.p[i] = p.p[i]! + L.p[i]! * k;
      }
    }
  }

  // -------------------------------------------------------------- strike

  /** Already dead: lying on its side, legs out, no throw and no fresh blood. */
  lieDead(): void {
    this.strike();
    const st = this.struck!;
    st.vel.set(0, 0, 0);
    st.angle = (Math.PI / 2) * st.side;
    st.settled = true;
    st.t = 5;
    this.carcass = true;
    this.tickStruck(1e-4);
    this.write();
  }
  private carcass = false;

  private strike(direction?: THREE.Vector3): void {
    const r = this.rng.fork(`struck:${this.clock.toFixed(2)}`);
    const d = direction ? this.dirToLocal(direction) : new THREE.Vector2(-Math.sin(this.heading), -Math.cos(this.heading));
    if (d.lengthSq() < 1e-6) d.set(0, 1);
    d.normalize();
    // Into body frame (mover rotation = heading).
    const c = Math.cos(-this.heading),
      s = Math.sin(-this.heading);
    const lx = d.x * c + d.y * s;
    const lz = -d.x * s + d.y * c;
    const side = lx >= 0 ? -1 : 1;
    // Heavier animals are thrown less far.
    const speed = r.range(2.2, 3.4) / Math.max(0.6, this.m.halfWidth * 2.2);
    this.struck = {
      t: 0,
      vel: new THREE.Vector3(lx * speed, r.range(1.6, 2.6), lz * speed),
      pos: new THREE.Vector3(),
      axis: new THREE.Vector3(0, 0, 1),
      spin: side * r.range(5, 8),
      angle: 0,
      side,
      settled: false,
      pool: null,
      poolT: 0,
      flail: [r.range(-1, 1), r.range(-1, 1), r.range(-1, 1), r.range(-1, 1)],
    };
    this.speed = 0;
    this.targetSpeed = 0;
    this.prev.copy(this.pose);
  }

  private tickStruck(dt: number): void {
    const st = this.struck!;
    const m = this.m;
    st.t += dt;
    const c = this.rig.rest[Q.body]!;
    if (!st.settled) {
      st.vel.y -= 9.8 * dt;
      st.pos.addScaledVector(st.vel, dt);
      const target = (Math.PI / 2) * st.side;
      st.angle += st.spin * dt;
      if (Math.abs(st.angle) >= Math.abs(target)) st.angle = target;
      // Landing: the flank meets the ground.
      const bodyY = c.y + st.pos.y;
      const rest = m.halfWidth + 0.02;
      if (st.t > 0.25 && bodyY <= rest + (1 - Math.abs(Math.sin(st.angle))) * c.y) {
        st.vel.multiplyScalar(0.35);
        st.vel.y = Math.abs(st.vel.y) * 0.15;
        if (Math.abs(st.angle) >= Math.abs(target) - 1e-3 && st.t > 0.6) {
          st.settled = true;
          st.angle = target;
        }
      }
    }
    // Root transform: roll about the body's long axis, then drop to the ground.
    this.rootQ.setFromAxisAngle(st.axis, st.angle);
    const rc = c.clone().applyQuaternion(this.rootQ);
    const settleY = m.halfWidth + 0.01;
    const bodyTargetY = st.settled ? settleY : Math.max(settleY, c.y + st.pos.y);
    const pose = this.pose.reset();
    pose.p[Q.root * 3] = st.pos.x + (c.x - rc.x);
    pose.p[Q.root * 3 + 1] = bodyTargetY - rc.y;
    pose.p[Q.root * 3 + 2] = st.pos.z + (c.z - rc.z);
    // Limbs: flail, then fall slack and extended.
    const fl = Math.max(0, 1 - st.t / 1.2);
    for (let i = 0; i < 4; i++) {
      const leg = LEGS[i]!;
      const f = st.flail[i]!;
      pose.rot(leg.b[0], (leg.fore ? -0.25 : 0.2) + f * 0.6 * fl, 0, 0.1 * leg.side);
      pose.rot(leg.b[1], (leg.fore ? -0.15 : 0.2) * (1 - fl) + f * 0.4 * fl);
      pose.rot(leg.b[2], (leg.fore ? 0.2 : -0.25) + f * 0.5 * fl);
      pose.rot(leg.b[3], 0.3);
    }
    pose.rot(Q.neck1, -0.2 + 0.3 * fl, 0.15 * st.side);
    pose.rot(Q.neck2, 0.1, 0.1 * st.side);
    pose.rot(Q.head, 0.3, 0, 0.2 * st.side);
    pose.rot(Q.tail0, 0.4, 0, -0.4 * st.side);
    pose.rot(Q.earL, 0.4, 0, -0.3);
    pose.rot(Q.earR, 0.4, 0, 0.3);
    if (st.settled && this.blood && !this.carcass && !st.pool) {
      st.pool = new THREE.Vector3(st.pos.x - st.side * 0.35, 0, st.pos.z + 0.15);
      st.poolT = 0;
    }
    if (st.pool) {
      st.poolT += dt;
      const r = Math.sqrt(Math.min(1, st.poolT / 9));
      pose.s[Q.pool] = 0.2 + r * 0.9;
      pose.p[Q.pool * 3] = st.pool.x;
      pose.p[Q.pool * 3 + 2] = st.pool.z;
    } else pose.s[Q.pool] = 0;
  }

  get isStruck(): boolean {
    return this.struck !== null;
  }
}

/**
 * Pitches for neck1, neck2, head and a slight forward body tilt that bring
 * the muzzle down to `grazeY`, found by bisection on forward kinematics.
 */
function solveReach(body: BodyBuild, rig: Rig, m: QuadMotion): [number, number, number, number] {
  const n1 = rig.rest[Q.neck1]!,
    n2 = rig.rest[Q.neck2]!,
    hd = rig.rest[Q.head]!,
    bd = rig.rest[Q.body]!;
  const [k1, k2, k3] = m.reach;
  const rotX = (p: THREE.Vector3, pivot: THREE.Vector3, a: number) => {
    const y = p.y - pivot.y,
      z = p.z - pivot.z;
    const c = Math.cos(a),
      s = Math.sin(a);
    return new THREE.Vector3(p.x, pivot.y + y * c - z * s, pivot.z + y * s + z * c);
  };
  const bodyTilt = 0.05;
  const muzzleAt = (t: number) => {
    let p = body.muzzle.clone();
    p = rotX(p, hd, m.stand[2] + k3 * t);
    p = rotX(p, n2, m.stand[1] + k2 * t);
    p = rotX(p, n1, m.stand[0] + k1 * t);
    p = rotX(p, bd, bodyTilt * Math.min(1, t));
    return p.y;
  };
  // March out until the muzzle reaches the grass; if it never does, take the
  // lowest point (the neck curls back under the chest past that).
  let best = 0,
    bestY = Infinity,
    t = 0;
  for (let i = 1; i <= 80; i++) {
    const x = (i / 80) * 2.5;
    const y = muzzleAt(x);
    if (y < bestY) {
      bestY = y;
      best = x;
    }
    if (y <= m.grazeY) {
      // Refine between the previous sample and this one.
      let lo = ((i - 1) / 80) * 2.5,
        hi = x;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (muzzleAt(mid) > m.grazeY) lo = mid;
        else hi = mid;
      }
      t = (lo + hi) / 2;
      break;
    }
  }
  if (t === 0) t = best;
  return [m.stand[0] + k1 * t, m.stand[1] + k2 * t, m.stand[2] + k3 * t, bodyTilt];
}
