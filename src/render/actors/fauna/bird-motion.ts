/**
 * Procedural motion for birds: pecking and grazing, walking (with waddle or
 * head-stabilised bobbing), hopping, alert head-turns, running with flapping
 * wings, sitting, and for fliers a full take-off, circling flight and
 * landing. Wings are authored spread and folded by pose (rotate + scale).
 */
import * as THREE from "three";
import type { Rng } from "../../core/rng.ts";
import { BIRD as W, Pose, applyPose, type Rig } from "./rig.ts";
import type { BodyBuild } from "./body.ts";
import type { Behavior, BirdMotion, Reaction } from "./types.ts";

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
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

export interface BirdControllerOptions {
  rig: Rig;
  body: BodyBuild;
  motion: BirdMotion;
  rng: Rng;
  mover: THREE.Object3D;
  behavior: Behavior;
  thin: boolean;
  stormy: boolean;
  roam: number;
  lookAt: THREE.Vector3 | null;
  blood: boolean;
  heightAt?: (x: number, z: number) => number;
}

type Air = "ground" | "takeoff" | "fly" | "land";

export class BirdController {
  readonly pose: Pose;
  private readonly prev: Pose;
  private readonly scratch: Pose;
  private fade = 1;
  behavior: Behavior;
  private base: Behavior;
  private readonly m: BirdMotion;
  private readonly rng: Rng;
  private readonly rig: Rig;
  private readonly mover: THREE.Object3D;
  lookAt: THREE.Vector3 | null;
  anchored = false;
  roam: number;
  readonly home = new THREE.Vector2();
  readonly pos = new THREE.Vector2();
  heading = 0;
  speed = 0;
  private targetSpeed = 0;
  private desired = 0;
  private phase = 0;
  private clock = 0;
  private readonly phaseOffset: number;
  private reach: [number, number, number, number];
  // pecking
  private peckT = 0;
  private peck = 0;
  private stepT = 0;
  private stepping = 0;
  private headT = 0;
  private headYaw = 0;
  private headYawTarget = 0;
  private sit = 0;
  private flap = 0;
  // flight
  air: Air = "ground";
  private alt = 0;
  private vy = 0;
  private airT = 0;
  private orbitR = 14;
  private orbitDir = 1;
  private orbitA = 0;
  private cruiseAlt = 10;
  private spread = 0;
  private wander = new THREE.Vector2();
  private fleeDir = new THREE.Vector2(0, 1);
  private fleeLeft = 0;
  private struck: { t: number; vel: THREE.Vector3; pos: THREE.Vector3; side: number; pool: number } | null = null;
  private blood: boolean;
  private readonly stormy: boolean;

  constructor(o: BirdControllerOptions) {
    this.rig = o.rig;
    this.m = o.motion;
    this.rng = o.rng;
    this.mover = o.mover;
    this.lookAt = o.lookAt;
    this.roam = o.roam;
    this.blood = o.blood;
    this.stormy = o.stormy;
    this.behavior = o.behavior;
    this.base = o.behavior;
    this.pose = new Pose(o.rig.def.count);
    this.prev = new Pose(o.rig.def.count);
    this.scratch = new Pose(o.rig.def.count);
    this.phaseOffset = this.rng.next();
    this.phase = this.phaseOffset;
    this.clock = this.rng.range(0, 50);
    this.peckT = this.rng.range(0.2, 2);
    this.stepT = this.rng.range(0.5, 3);
    this.headT = this.rng.range(0.3, 1.5);
    this.reach = solvePeck(o.body, o.rig, this.m);
    this.sit = o.behavior === "rest" ? 1 : 0;
    this.pickWander();
    this.synth(0);
    this.prev.copy(this.pose);
  }

  get walkSpeed(): number {
    return this.m.walkSpeed;
  }

  /** Less graphic detail: no pool forms, and any pool already on the ground goes. */
  setBlood(on: boolean): void {
    this.blood = on;
    if (!on && this.struck) this.struck.pool = 0;
  }

  get isStruck(): boolean {
    return this.struck !== null;
  }

  syncFromMover(): void {
    this.pos.set(this.mover.position.x, this.mover.position.z);
    this.home.copy(this.pos);
    this.heading = this.mover.rotation.y;
    this.desired = this.heading;
    this.pickWander();
  }

  private pickWander(): void {
    const a = this.rng.range(0, Math.PI * 2);
    const d = Math.sqrt(this.rng.next()) * this.roam;
    this.wander.set(this.home.x + Math.cos(a) * d, this.home.y + Math.sin(a) * d);
  }

  setBehavior(b: Behavior, keepBase = false): void {
    if (this.struck) return;
    if (!keepBase) this.base = b;
    if (b === this.behavior) return;
    this.prev.copy(this.pose);
    this.fade = 0;
    if (b === "flee") this.startFlee(this.threatDir());
    this.behavior = b;
  }

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

  private threatDir(): THREE.Vector2 {
    const t = this.targetLocal();
    if (t) {
      const d = new THREE.Vector2(this.pos.x - t.x, this.pos.y - t.z);
      if (d.lengthSq() > 1e-4) return d.normalize();
    }
    return new THREE.Vector2(-Math.sin(this.heading), -Math.cos(this.heading));
  }

  private startFlee(away: THREE.Vector2): void {
    this.fleeDir.copy(away).rotateAround(new THREE.Vector2(), this.rng.range(-0.5, 0.5));
    this.fleeLeft = this.rng.range(5, 12) * (0.5 + this.m.skittish);
    if (this.m.flies && this.air === "ground") {
      this.air = "takeoff";
      this.airT = 0;
      this.vy = 0;
      this.orbitR = this.rng.range(10, 22);
      this.orbitDir = this.rng.chance(0.5) ? 1 : -1;
      this.cruiseAlt = this.rng.range(7, 16);
    }
  }

  /** Already dead: on its side, wings loose, no blood. */
  lieDead(): void {
    this.react("struck");
    this.struck!.t = 5;
    this.struck!.vel.set(0, 0, 0);
    this.struck!.pos.set(0, 0, 0);
    this.carcass = true;
    this.tickStruck(1e-4);
    this.write();
  }
  private carcass = false;

  react(kind: Reaction, direction?: THREE.Vector3): void {
    if (this.struck) return;
    if (kind === "flinch") {
      let away = this.threatDir();
      if (direction) {
        const parent = this.mover.parent;
        _v.copy(direction);
        if (parent) _v.applyQuaternion(parent.getWorldQuaternion(_q).invert());
        away = new THREE.Vector2(-_v.x, -_v.z);
        if (away.lengthSq() < 1e-6) away = this.threatDir();
        away.normalize();
      }
      if (this.rng.next() < 0.3 + this.m.skittish * 0.7) {
        this.setBehavior("flee", true);
        this.startFlee(away);
      } else this.setBehavior("alert", true);
      return;
    }
    const d = direction ? new THREE.Vector3(direction.x, 0, direction.z).normalize() : new THREE.Vector3(0, 0, -1);
    const c = Math.cos(-this.heading),
      s = Math.sin(-this.heading);
    this.struck = {
      t: 0,
      vel: new THREE.Vector3(d.x * c + d.z * s, this.rng.range(1.5, 2.5), -d.x * s + d.z * c).multiplyScalar(2.2),
      pos: new THREE.Vector3(0, this.alt, 0),
      side: this.rng.chance(0.5) ? 1 : -1,
      pool: 0,
    };
    this.air = "ground";
  }

  // ------------------------------------------------------------- update

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
      this.fade = Math.min(1, this.fade + dt / 0.35);
      this.scratch.copy(this.pose);
      this.pose.mix(this.prev, this.scratch, smooth(this.fade));
    }
    this.write();
  }

  private write(): void {
    this.mover.position.x = this.pos.x;
    this.mover.position.z = this.pos.y;
    this.mover.position.y = this.alt;
    this.mover.rotation.y = this.heading;
    applyPose(this.rig, this.pose);
  }

  private steer(p: THREE.Vector2): void {
    this.desired = Math.atan2(p.x - this.pos.x, p.y - this.pos.y);
  }

  private think(dt: number): void {
    const m = this.m;
    const b = this.behavior;
    if (this.stormy && b !== "flee" && this.rng.next() < dt * 0.05 * m.skittish) this.setBehavior("flee", true);
    // Head turns: birds look in quick saccades.
    this.headT -= dt;
    if (this.headT <= 0) {
      this.headT = this.rng.range(0.3, b === "alert" ? 0.9 : 2.2);
      this.headYawTarget = this.rng.range(-0.9, 0.9) * (b === "alert" ? 1 : 0.5);
    }
    if (this.air !== "ground") {
      this.targetSpeed = m.flySpeed;
      return;
    }
    if (b === "graze") {
      this.peckT -= dt;
      if (this.peckT <= 0) {
        this.peck = 0.28;
        this.peckT = this.rng.range(0.25, 1.6);
      }
      this.stepT -= dt;
      if (this.stepping > 0) {
        this.stepping -= dt;
        this.targetSpeed = m.walkSpeed * 0.6;
        this.steer(this.wander);
        if (this.pos.distanceTo(this.wander) < 0.3) this.pickWander();
      } else {
        this.targetSpeed = 0;
        if (this.stepT <= 0) {
          this.stepping = this.rng.range(0.6, 2.2);
          this.stepT = this.rng.range(1, 4);
        }
      }
    } else if (b === "walk") {
      this.targetSpeed = m.walkSpeed;
      this.steer(this.wander);
      if (this.pos.distanceTo(this.wander) < 0.5) this.pickWander();
    } else if (b === "flee") {
      if (this.fleeLeft > 0) {
        this.targetSpeed = m.runSpeed;
        this.desired = Math.atan2(this.fleeDir.x, this.fleeDir.y);
        this.fleeLeft -= this.speed * dt;
      } else {
        this.home.copy(this.pos);
        this.pickWander();
        this.setBehavior(this.base === "flee" ? "graze" : this.base, true);
        if (this.base === "flee") this.base = "graze";
      }
    } else this.targetSpeed = 0;
    this.peck = Math.max(0, this.peck - dt);
    if (b !== "flee") {
      const dx = this.pos.x - this.home.x,
        dz = this.pos.y - this.home.y;
      if (dx * dx + dz * dz > this.roam * this.roam * 1.3 + 0.2) this.steer(this.home);
    }
  }

  private locomote(dt: number): void {
    const m = this.m;
    if (this.air !== "ground") {
      this.fly(dt);
      return;
    }
    this.speed += THREE.MathUtils.clamp(this.targetSpeed - this.speed, -4 * dt, 3 * dt);
    const off = this.anchored ? 0 : wrapAngle(this.desired - this.heading);
    if (!this.anchored) {
      this.heading += THREE.MathUtils.clamp(off, -2.5 * dt, 2.5 * dt);
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.y += Math.cos(this.heading) * this.speed * dt;
    }
    const v = Math.max(0, this.speed);
    const f = m.hops ? m.walkFreq * 0.8 : m.walkFreq * Math.sqrt(Math.max(0.1, v / m.walkSpeed));
    this.phase = (this.phase + dt * f * Math.min(1, v / (m.walkSpeed * 0.15) + (Math.abs(off) > 0.1 ? 0.4 : 0))) % 1;
  }

  private fly(dt: number): void {
    const m = this.m;
    this.airT += dt;
    if (this.air === "takeoff") {
      // Crouch, spring, climb steeply away.
      const spring = this.airT > 0.18;
      this.spread = Math.min(1, this.spread + dt * 5);
      if (spring) {
        this.vy = THREE.MathUtils.lerp(this.vy, 3.2, 1 - Math.exp(-dt * 6));
        this.speed = Math.min(m.flySpeed * 0.7, this.speed + dt * 6);
        this.desired = Math.atan2(this.fleeDir.x, this.fleeDir.y);
      }
      if (this.alt > this.cruiseAlt * 0.6) {
        this.air = "fly";
        this.airT = 0;
        this.orbitA = Math.atan2(this.pos.x - this.home.x, this.pos.y - this.home.y);
      }
    } else if (this.air === "fly") {
      // Circle over the spot, drifting, then come back down.
      this.spread = 1;
      this.orbitA += (this.orbitDir * m.flySpeed * dt) / this.orbitR;
      const tx = this.home.x + Math.sin(this.orbitA) * this.orbitR;
      const tz = this.home.y + Math.cos(this.orbitA) * this.orbitR;
      this.desired = Math.atan2(tx - this.pos.x, tz - this.pos.y);
      this.speed = THREE.MathUtils.lerp(this.speed, m.flySpeed, 1 - Math.exp(-dt));
      this.vy = (this.cruiseAlt + Math.sin(this.airT * 0.5) * 2 - this.alt) * 0.8;
      if (this.airT > (this.stormy ? 60 : this.rng.range(14, 30)) && !this.anchored) {
        this.air = "land";
        this.airT = 0;
        const a = this.rng.range(0, Math.PI * 2);
        this.home.set(this.home.x + Math.cos(a) * 3, this.home.y + Math.sin(a) * 3);
      }
    } else if (this.air === "land") {
      this.steer(this.home);
      const dist = this.pos.distanceTo(this.home);
      this.speed = THREE.MathUtils.lerp(this.speed, Math.min(m.flySpeed * 0.6, dist * 0.8 + 0.4), 1 - Math.exp(-dt * 2));
      this.vy = -Math.min(3, this.alt * 0.9) * (dist < 6 ? 1 : 0.4);
      if (this.alt < 0.05 && dist < 1.5) {
        this.alt = 0;
        this.vy = 0;
        this.speed = 0;
        this.air = "ground";
        this.setBehavior(this.base === "flee" ? "alert" : this.base, true);
        if (this.base === "flee") this.base = "alert";
      }
    }
    const off = wrapAngle(this.desired - this.heading);
    this.heading += THREE.MathUtils.clamp(off, -2.2 * dt, 2.2 * dt);
    this.bank = THREE.MathUtils.lerp(this.bank, THREE.MathUtils.clamp(off * 1.5, -0.7, 0.7), 1 - Math.exp(-dt * 3));
    if (!this.anchored) {
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.y += Math.cos(this.heading) * this.speed * dt;
      this.alt = Math.max(0, this.alt + this.vy * dt);
    }
    this.flap += dt * m.flapFreq * Math.PI * 2 * (this.air === "fly" && Math.sin(this.airT * 0.9 + this.phaseOffset * 6) > 0.35 ? 0.15 : 1);
  }

  private bank = 0;

  // ------------------------------------------------------------- posing

  private synth(dt: number): void {
    const p = this.pose.reset();
    const m = this.m;
    const b = this.behavior;
    const v = Math.max(0, this.speed);
    const moving = Math.min(1, v / (m.walkSpeed * 0.2));
    const sitT = b === "rest" && this.air === "ground" ? 1 : 0;
    this.sit += THREE.MathUtils.clamp(sitT - this.sit, -dt / 0.6, dt / 0.9);
    if (dt === 0) this.sit = sitT;
    const sit = smooth(this.sit);
    const [s1, s2, s3] = m.stand;
    let n1 = s1,
      n2 = s2,
      hd = s3,
      bodyPitch = 0;
    if (this.air === "ground") {
      if (b === "graze") {
        // Pecks: a fast jab to the ground and back.
        const jab = this.peck > 0 ? Math.sin((1 - this.peck / 0.28) * Math.PI) : 0;
        const r = 0.35 + 0.65 * jab;
        const [a1, a2, a3, bt] = this.reach;
        n1 = THREE.MathUtils.lerp(s1, a1, r);
        n2 = THREE.MathUtils.lerp(s2, a2, r);
        hd = THREE.MathUtils.lerp(s3, a3, r);
        bodyPitch = bt * r;
      } else if (b === "alert") {
        [n1, n2, hd] = m.alert;
        bodyPitch = -0.12;
      } else if (b === "flee") {
        n1 = s1 + 0.3;
        n2 = s2 - 0.1;
        hd = s3 - 0.1;
        bodyPitch = 0.25;
      } else if (b === "rest") {
        n1 = s1 + 0.25;
        n2 = s2 + 0.3;
        hd = s3 - 0.2;
      } else if (b === "walk") {
        n1 = s1 + 0.1;
        bodyPitch = 0.05;
      }
      // Head-stabilised walking: the head holds, then darts forward.
      if (m.headStabilise && moving > 0.1 && b !== "flee") {
        const saw = (this.phase * 2) % 1;
        n1 += 0.28 * (saw - 0.5) * moving;
        hd -= 0.2 * (saw - 0.5) * moving;
      }
    } else {
      // Flight carriage: level body, neck forward, legs tucked.
      n1 = 0.35;
      n2 = -0.1;
      hd = -0.25;
      bodyPitch = this.air === "takeoff" ? -0.3 + 0.6 * Math.min(1, this.airT) : this.air === "land" ? -0.2 : 0.3;
    }
    // Look: saccades, or at the watched target.
    const t = b === "alert" || b === "rest" ? this.targetLocal() : null;
    if (t) {
      const yaw = wrapAngle(Math.atan2(t.x - this.pos.x, t.z - this.pos.y) - this.heading);
      this.headYawTarget = THREE.MathUtils.clamp(yaw, -1.6, 1.6);
    }
    const kk = 1 - Math.exp(-dt * 14);
    this.headYaw += (this.headYawTarget - this.headYaw) * (dt === 0 ? 1 : kk);
    p.rot(W.body, bodyPitch);
    p.rot(W.neck1, n1, this.headYaw * 0.4);
    p.rot(W.neck2, n2, this.headYaw * 0.3);
    p.rot(W.head, hd, this.headYaw * 0.3, this.air === "ground" ? Math.sin(this.clock * 0.7) * 0.08 : 0);

    // Legs.
    if (this.air === "ground") {
      const ph = this.phase * Math.PI * 2;
      if (m.hops && v > 0.05) {
        // Two-footed hops.
        const air = Math.max(0, Math.sin(ph));
        p.move(W.root, 0, 0.06 * air * moving, 0);
        for (const [th, sh, ft] of [
          [W.thighL, W.shinL, W.footL],
          [W.thighR, W.shinR, W.footR],
        ] as const) {
          p.rot(th, -0.3 * air * moving);
          p.rot(sh, 0.5 * air * moving);
          p.rot(ft, 0.5 * air * moving);
        }
      } else {
        const amp = Math.min(0.7, v / Math.max(0.1, m.walkSpeed) * 0.45) * moving;
        for (const [th, sh, ft, off] of [
          [W.thighL, W.shinL, W.footL, 0],
          [W.thighR, W.shinR, W.footR, Math.PI],
        ] as const) {
          const q = ph + off;
          const lift = Math.max(0, Math.sin(q));
          p.rot(th, -amp * Math.cos(q) - 0.2 * lift * moving);
          p.rot(sh, 0.45 * lift * moving);
          p.rot(ft, 0.6 * lift * moving);
        }
        // Waddle: body rolls over the stance foot.
        p.rot(W.body, 0, 0, m.waddle * Math.sin(ph) * moving);
        p.move(W.body, 0, -0.008 * Math.abs(Math.cos(ph)) * moving, 0);
      }
    } else {
      for (const [th, sh, ft] of [
        [W.thighL, W.shinL, W.footL],
        [W.thighR, W.shinR, W.footR],
      ] as const) {
        p.rot(th, 1.1);
        p.rot(sh, 0.9);
        p.rot(ft, 1.2);
      }
    }

    // Wings: folded unless flying or flapping to run.
    const wantSpread = this.air !== "ground" ? 1 : b === "flee" ? 0.55 : 0;
    this.spread += THREE.MathUtils.clamp(wantSpread - this.spread, -dt * 3, dt * 4);
    if (dt === 0) this.spread = wantSpread;
    const sp = smooth(this.spread);
    const fold = 1 - sp;
    const flapAmp = this.air !== "ground" ? 0.85 : b === "flee" ? 0.6 : 0;
    if (this.air === "ground") this.flap += dt * m.flapFreq * Math.PI * 2;
    const fl = Math.sin(this.flap) * flapAmp * sp;
    const flHand = Math.sin(this.flap - 0.7) * flapAmp * sp;
    const overlay = m.wingFold === "overlay";
    // Overlay species keep a modelled folded wing on the flank; their spread
    // wings unfurl out of it (scale from nothing) only when they flap.
    const scale = overlay ? Math.max(0.001, sp) : 0.62 + 0.38 * sp;
    for (const [arm, hand, sgn] of [
      [W.wingL, W.handL, 1],
      [W.wingR, W.handR, -1],
    ] as const) {
      if (overlay) p.rot(arm, -0.6 * fold, sgn * 0.9 * fold, sgn * fl);
      else {
        p.rot(arm, -1.5 * fold, sgn * 1.5 * fold, sgn * (fl + 0.1 * fold));
        // Folded wings sit proud of the flank, not buried in it.
        const out = this.rig.rest[W.wingL]!.x * 0.18 * fold;
        p.move(arm, sgn * out, out * 0.5, 0);
      }
      p.rot(hand, 0, sgn * (0.2 * fold - 0.25 * Math.max(0, -flHand)), sgn * flHand * 0.6);
      p.s[arm] = scale;
    }
    // Tail: flicks when pecking, spreads in flight.
    p.rot(W.tail, this.air !== "ground" ? 0.2 : -0.1 * Math.max(0, Math.sin(this.clock * 3)) + (b === "flee" ? -0.3 : 0));
    p.s[W.tail] = this.air !== "ground" ? 1.12 : 1;
    // Banking in flight.
    if (this.air !== "ground") p.rot(W.root, 0, 0, -this.bank);
    // Sitting.
    if (sit > 0.001) {
      p.move(W.root, 0, -m.sitDrop * sit, 0);
      for (const [th, sh, ft] of [
        [W.thighL, W.shinL, W.footL],
        [W.thighR, W.shinR, W.footR],
      ] as const) {
        p.rot(th, -0.4 * sit);
        p.rot(sh, 1.6 * sit);
        p.rot(ft, -1.2 * sit);
      }
      p.s[W.body] = 1 + 0.06 * sit;
    }
    p.s[W.pool] = 0;
  }

  private tickStruck(dt: number): void {
    const st = this.struck!;
    st.t += dt;
    if (st.pos.y > 0 || st.vel.y > 0) {
      st.vel.y -= 9.8 * dt;
      st.pos.addScaledVector(st.vel, dt);
      if (st.pos.y < 0) {
        st.pos.y = 0;
        st.vel.set(0, 0, 0);
      }
    }
    this.alt = 0;
    const p = this.pose.reset();
    const k = Math.min(1, st.t / 0.5);
    const c = this.rig.rest[W.body]!;
    const roll = st.side * 1.4 * k;
    p.set(W.root, 0, 0, roll);
    p.p[W.root * 3] = st.pos.x + c.y * Math.sin(roll) * 0.8;
    p.p[W.root * 3 + 1] = st.pos.y + (c.y * 0.35 - c.y * Math.cos(roll) * 0.35) * k - c.y * 0.3 * k;
    p.p[W.root * 3 + 2] = st.pos.z;
    for (const [arm, sgn] of [
      [W.wingL, 1],
      [W.wingR, -1],
    ] as const) p.rot(arm, -0.6, sgn * 0.6, sgn * 0.3);
    p.rot(W.neck1, 0.6, 0.5 * st.side);
    p.rot(W.head, 0.4);
    p.s[W.wingL] = 0.8;
    p.s[W.wingR] = 0.8;
    if (st.t > 0.6 && this.blood && !this.carcass) st.pool = Math.min(1, st.pool + dt / 5);
    p.s[W.pool] = st.pool > 0 ? 0.05 + 0.12 * Math.sqrt(st.pool) * (this.rig.rest[W.head]!.y / 0.3) : 0;
    p.p[W.pool * 3] = st.pos.x;
    p.p[W.pool * 3 + 2] = st.pos.z;
  }
}

/** Neck pitches that bring the beak tip to `grazeY`. */
function solvePeck(body: BodyBuild, rig: Rig, m: BirdMotion): [number, number, number, number] {
  const n1 = rig.rest[W.neck1]!,
    n2 = rig.rest[W.neck2]!,
    hd = rig.rest[W.head]!,
    bd = rig.rest[W.body]!;
  const [k1, k2, k3] = m.reach;
  const rotX = (p: THREE.Vector3, pivot: THREE.Vector3, a: number) => {
    const y = p.y - pivot.y,
      z = p.z - pivot.z;
    const c = Math.cos(a),
      s = Math.sin(a);
    return new THREE.Vector3(p.x, pivot.y + y * c - z * s, pivot.z + y * s + z * c);
  };
  const tilt = 0.35;
  const at = (t: number) => {
    let p = body.muzzle.clone();
    p = rotX(p, hd, m.stand[2] + k3 * t);
    p = rotX(p, n2, m.stand[1] + k2 * t);
    p = rotX(p, n1, m.stand[0] + k1 * t);
    p = rotX(p, bd, tilt * Math.min(1, t));
    return p.y;
  };
  let best = 0,
    bestY = Infinity,
    found = -1;
  for (let i = 1; i <= 80; i++) {
    const x = (i / 80) * 2.5;
    const y = at(x);
    if (y < bestY) {
      bestY = y;
      best = x;
    }
    if (y <= m.grazeY) {
      found = x;
      break;
    }
  }
  const t = found > 0 ? found : best;
  return [m.stand[0] + k1 * t, m.stand[1] + k2 * t, m.stand[2] + k3 * t, tilt * Math.min(1, t)];
}
