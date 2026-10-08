/**
 * createPerson: one rigid-skinned figure with procedural animation.
 */
import * as THREE from "three";
import type { PersonRole, Pose } from "../../api.ts";
import { createInkCanvas, inkMaterial } from "../../core/ink-material.ts";
import { createRng, hashString } from "../../core/rng.ts";
import { makeBody, type Body } from "./anatomy.ts";
import { gurneyParts, poolPart, ropeCoils, sheetPart, wheelchairParts, droppedHat, type HeldProp } from "./props.ts";
import { B, Frame, PartSink, bodyPoint, createSkeleton, restOffsets, restWorld } from "./rig.ts";
import { evaluatePose, flinchGuard, markerDefs, vnoise, type PoseStyle, type Support } from "./poses.ts";
import { posePropsFor, roleDemographics, roleSpec, type RoleSpec } from "./roles.ts";
import { Tailor } from "./tailor.ts";
import { rot } from "./rig.ts";
import { tube } from "../../core/geometry.ts";

export type Reaction = "struck" | "flinch";

export interface PersonSpec {
  role: PersonRole;
  pose?: Pose;
  seed: number | string;
  /** A named individual: gets a signal-red scarf so the player can find them again. */
  name?: string;
  /** World-space point to watch / point at / look toward. */
  lookAt?: THREE.Vector3;
  /** -1 far (instanced crowds, 80 m+), 0 crowd, 1 normal (default), 2 close-up. */
  detail?: -1 | 0 | 1 | 2;
  /** Placard text (hold-sign / protesters). null = blank board. */
  sign?: string | null;
  /** Sit pose: seat height in metres (0 = on the ground). */
  seat?: number;
  /** Lie pose: on a hospital gurney instead of the ground (default: patients yes). */
  stretcher?: boolean;
  /** Local y of the real ground, for strike landings (tied people sit on rails). */
  ground?: number;
  /** Leave a pool after a strike (default true). */
  blood?: boolean;
  /** Override the ink object id (contour separation between neighbours). */
  objectId?: number;
}

export interface PersonUserData {
  tick: (dt: number, t: number) => void;
  react: (kind: Reaction, direction?: THREE.Vector3) => void;
  setPose: (pose: Pose) => void;
  setLookAt: (target: THREE.Vector3 | null) => void;
  /** Less graphic detail switches the pool off (and removes one already formed). */
  setBlood: (on: boolean) => void;
  role: PersonRole;
  pose: Pose;
  name?: string;
  height: number;
  /** Forward speed (m/s) matching the walk / carry cycle, for callers that move walkers. */
  walkSpeed: number;
  struck: boolean;
  mesh: THREE.SkinnedMesh;
  body: Body;
}

const SLOGANS = ["STOP THE LINE", "HUMANS DECIDE", "WHO PULLED\nTHE LEVER?", "NOT IN\nOUR NAME", "PAUSE", "WE ARE NOT\nVARIABLES", "SLOW\nDOWN", ""];

let signAtlas: { texture: THREE.Texture; material: THREE.Material } | null = null;
function signMaterialFor(text: string | null, seed: number): { material: THREE.Material; cell: number | null } {
  if (typeof document === "undefined") return { material: inkMaterial({ tone: 0 }), cell: null };
  if (text === null) return { material: inkMaterial({ tone: 0, hatchSpace: "object" }), cell: null };
  const draw = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: string, tilt: number) => {
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(tilt);
    g.fillStyle = "#000";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = s.split("\n");
    const size = Math.min(h / (lines.length * 1.15), (w * 1.5) / Math.max(...lines.map((l) => l.length), 1));
    g.font = `900 ${Math.floor(size)}px "Arial Black", Impact, sans-serif`;
    lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * size * 1.08));
    g.restore();
  };
  if (text !== undefined && text !== "" && !SLOGANS.includes(text)) {
    const { ctx, texture } = createInkCanvas(512, 368);
    draw(ctx, 24, 24, 464, 320, text.toUpperCase(), 0);
    texture.needsUpdate = true;
    return { material: inkMaterial({ map: texture, hatchSpace: "object", shade: 0.6 }), cell: null };
  }
  if (!signAtlas) {
    const { ctx, texture } = createInkCanvas(2048, 736);
    SLOGANS.forEach((sl, i) => {
      const cx = (i % 4) * 512;
      const cy = Math.floor(i / 4) * 368;
      draw(ctx, cx + 30, cy + 30, 452, 308, sl, ((i * 37) % 7 - 3) * 0.012);
    });
    texture.needsUpdate = true;
    signAtlas = { texture, material: inkMaterial({ map: texture, hatchSpace: "object", shade: 0.6 }) };
  }
  const idx = text ? SLOGANS.indexOf(text) : seed % (SLOGANS.length - 1);
  return { material: signAtlas.material, cell: idx < 0 ? 0 : idx };
}

function signPlane(cell: number | null): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.6, 0.42);
  if (cell !== null) {
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const u0 = (cell % 4) / 4;
    const v0 = 1 - (Math.floor(cell / 4) + 1) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 2);
  }
  return g;
}

/** Stroke period for figures (m): a touch coarser than the actor default so strokes stay legible. */
export const PEOPLE_HATCH = 0.045;

const _tmp = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _tq2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/** Poses whose props are pinned to the body at build time. */
function usesSign(pose: Pose, spec: RoleSpec): boolean {
  return pose === "hold-sign" || (spec.idle.right === "sign" && (pose === "stand" || pose === "walk" || pose === "queue" || pose === "watch" || pose === "carry"));
}

export function createPerson(spec: PersonSpec): THREE.Object3D {
  const seedNum = typeof spec.seed === "number" ? spec.seed >>> 0 : hashString(String(spec.seed));
  const rng = createRng(`person:${spec.role}:${seedNum}`);
  const pose: Pose = spec.pose ?? "stand";
  const detail = spec.detail ?? 1;
  const demo = roleDemographics(spec.role, rng.fork("demo"));
  const body = makeBody(rng.fork("body"), { age: demo.age, fem: demo.fem });
  const role = roleSpec(spec.role, rng.fork("wardrobe"), demo.fem, demo.age, !!spec.name);
  const props = posePropsFor(pose, role);
  const styleRng = rng.fork("style");
  const headSide: 1 | -1 = styleRng.chance(0.5) ? 1 : -1;
  const offsets = restOffsets(body);
  const world = restWorld(offsets);
  const sink = new PartSink();
  const tailor = new Tailor(sink, body, world, detail, rng.fork("tailor"));
  tailor.dress(role.outfit, { right: props.right, left: props.left, dropHat: pose === "tied", headSide });
  const s = body.H / 1.78;

  // ---------------------------------------------------------- pose furniture
  const stretcher = pose === "lie" && (spec.stretcher ?? (spec.role === "patient" || spec.role === "elder"));
  const surface = stretcher ? 0.86 : 0;
  const furn = (parts: Array<{ g: THREE.BufferGeometry; o: object }>) => {
    for (const p of parts) sink.add(B.furniture, p.g, p.o);
  };
  if (pose === "wheelchair") furn(wheelchairParts(0.5));
  if (stretcher) {
    furn(gurneyParts(surface, Math.max(2.0, body.H + 0.2), headSide));
    const feetEnd = -headSide * (body.H * 0.45 + 0.05);
    furn([sheetPart(surface + 0.02, feetEnd, -headSide * 0.05)]);
  }
  if (pose === "tied") {
    // Coils: chest and arms, hips and wrists, both ankles.
    const cy = tailor.chestY - body.waistY;
    const ex = body.shoulderX + body.upperArmR * 1.6 + 0.05 * s;
    for (const p of ropeCoils(ex, body.chestF + 0.05, body.chestB + 0.05, [cy - 0.02, cy - 0.075, cy - 0.13])) sink.add(B.spine, p.g, p.o);
    const hy = body.crotchY - body.hipY + 0.02;
    for (const p of ropeCoils(body.hipW + 0.07 * s, body.hipF + 0.04, body.hipB + 0.04, [hy, hy - 0.05])) sink.add(B.pelvis, p.g, p.o);
    for (const p of ropeCoils(body.hipX + body.calfR + 0.035, body.calfR + 0.035, body.calfR + 0.035, [-body.shin + 0.1, -body.shin + 0.15, -body.shin + 0.2], -body.hipX)) sink.add(B.shinL, p.g, p.o);
    // Loose ends running off the body down to the sleepers.
    const tail = tube(
      [
        [headSide * body.H * 0.08, 0.12, 0.2],
        [headSide * body.H * 0.1, 0.02, 0.45],
        [headSide * body.H * 0.12, -0.12, 0.6],
      ],
      0.011,
      8,
      4,
    );
    sink.add(B.furniture, tail, { tone: "light" });
    const tail2 = tube(
      [
        [-headSide * body.H * 0.38, 0.08, -0.12],
        [-headSide * body.H * 0.4, -0.04, -0.4],
        [-headSide * body.H * 0.36, -0.14, -0.55],
      ],
      0.011,
      8,
      4,
    );
    sink.add(B.furniture, tail2, { tone: "light" });
    if (tailor.hatParts.length) {
      const at = new THREE.Vector3(headSide * (body.H * 0.52 + 0.25), 0.02, 0.38);
      furn(droppedHat(tailor.hatParts, at, styleRng.range(0.9, 1.4) * (styleRng.chance(0.5) ? 1 : -1)));
    }
  }
  // The pool is always built (it is scaled from zero), so blood can be
  // switched on or off for the life of the figure.
  let blood = spec.blood !== false;
  {
    const pp = poolPart(0.72 * s, seedNum % 97);
    sink.add(B.pool, pp.g, pp.o);
  }

  const geometry = sink.build(world);
  const objectId = spec.objectId ?? 0.31 + (seedNum % 8) * 0.01;
  const material = inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: PEOPLE_HATCH, objectId });
  const { bones, tops } = createSkeleton(offsets);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  for (const top of tops) mesh.add(top);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.name = `person:${spec.role}`;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, body.H * 0.5, 0), body.H * 0.8 + 0.6);

  // Inked placard text rides on the sign prop bone.
  const signed = usesSign(pose, role);
  if (signed && typeof document !== "undefined") {
    const text = spec.sign === undefined ? SLOGANS[seedNum % SLOGANS.length]! : spec.sign;
    if (text !== "") {
      const { material: sm, cell } = signMaterialFor(text, seedNum);
      const plane = new THREE.Mesh(signPlane(cell), sm);
      plane.position.set(0, 0.95, 0.015 + 0.0085);
      plane.userData.noShadow = true;
      bones[B.propR]!.add(plane);
    }
  }

  const group = new THREE.Group();
  group.name = `person:${spec.role}${spec.name ? `:${spec.name}` : ""}`;
  group.add(mesh);

  // ---------------------------------------------------------------- runtime
  const style: PoseStyle = {
    phase: styleRng.next(),
    tempo: styleRng.range(0.9, 1.12),
    stand: role.stand,
    work: role.work,
    right: props.right,
    left: props.left,
    v1: styleRng.next(),
    v2: styleRng.next(),
    v3: styleRng.next(),
    headSide,
    seat: spec.seat ?? 0,
    surface,
    seed: styleRng.int(1, 999),
  };
  const builtProps: { right: HeldProp | null; left: HeldProp | null } = { ...props };
  const markers = markerDefs(body);
  const frame = new Frame().reset(offsets);
  const last = new Frame().reset(offsets);
  const from = new Frame().reset(offsets);
  let blendT = 1;
  let currentPose: Pose = pose;
  let lookWorld: THREE.Vector3 | null = spec.lookAt ? spec.lookAt.clone() : null;
  const targetMesh = new THREE.Vector3();
  let yaw = 0;
  let agitation = pose === "cower" ? 0.6 : 0;
  let clock = 0;
  const groundY = spec.ground ?? 0;

  // Reactions.
  let flinchT = -1;
  const flinchDir = new THREE.Vector3();
  let flinchLook = false;
  interface StruckState {
    t: number;
    com: THREE.Vector3;
    vel: THREE.Vector3;
    q: THREE.Quaternion;
    w: THREE.Vector3;
    final: THREE.Quaternion | null;
    rag: Frame;
    collapse: Frame;
    bound: boolean;
    pool: THREE.Vector3 | null;
    poolT: number;
    furnVel: THREE.Vector3;
    furnSpin: number;
  }
  let struck: StruckState | null = null;
  const comBody = new THREE.Vector3(0, body.H * 0.55, 0);

  const toBodyTarget = () => {
    if (!lookWorld && !(flinchLook && flinchT >= 0)) {
      if (currentPose === "tied" || currentPose === "lie") return targetMesh.set(0, 0.6, 40);
      return null;
    }
    if (flinchLook) targetMesh.copy(flinchDir).multiplyScalar(30).add(_tmp.set(0, 1.4, 0));
    else {
      group.updateWorldMatrix(true, false);
      targetMesh.copy(lookWorld!);
      group.worldToLocal(targetMesh);
    }
    return targetMesh;
  };

  const evalInto = (f: Frame, p: Pose, t: number): Support | null => {
    f.reset(offsets);
    f.q[B.root]!.setFromAxisAngle(UP, yaw);
    // Hide props this pose does not use.
    const want = posePropsFor(p, role);
    f.s[B.propR] = builtProps.right && want.right === builtProps.right ? 1 : builtProps.right && p === "carry" ? 1 : 0;
    f.s[B.propL] = builtProps.left && want.left === builtProps.left ? 1 : 0;
    if (p === "work" && builtProps.left && (role.tool === "clipboard" || role.tool === "tablet")) f.s[B.propL] = 1;
    f.s[B.pool] = 0;
    style.right = f.s[B.propR]! > 0 ? builtProps.right : null;
    style.left = f.s[B.propL]! > 0 ? builtProps.left : null;
    const tgt = toBodyTarget();
    // Convert the mesh-space target into body space after the pose sets the root.
    const input = { body, rest: offsets, style, targetMesh: tgt, agitation };
    return evaluatePose(p, f, input, t);
  };

  const ground = (f: Frame, sup: Support | null) => {
    if (!sup) return;
    let min = Infinity;
    for (const i of sup.markers) {
      const m = markers[i]!;
      bodyPoint(f, m.bone, m.p, _tmp);
      _tmp.applyQuaternion(f.q[B.root]!).add(f.p[B.root]!);
      if (_tmp.y < min) min = _tmp.y;
    }
    if (Number.isFinite(min)) f.p[B.root]!.y += sup.height - min;
  };

  const coatFollow = (f: Frame) => {
    // Coat halves swing partway with their thighs.
    for (const [coat, thigh] of [
      [B.coatL, B.thighL],
      [B.coatR, B.thighR],
    ] as const) {
      _tq.copy(f.q[thigh]!);
      _tq2.identity().slerp(_tq, 0.55);
      f.q[coat]!.copy(_tq2);
    }
  };

  const tick = (dt: number, t: number) => {
    clock += dt;
    const time = t + style.phase * 17;
    if (struck) {
      stepStruck(dt);
      return;
    }
    // Flinch envelope and turn-to-look.
    let env = 0;
    if (flinchT >= 0) {
      flinchT += dt;
      const u = flinchT;
      env = u < 0.09 ? u / 0.09 : u < 0.45 ? 1 : Math.exp(-(u - 0.45) / 0.55);
      agitation = Math.max(agitation, env);
    }
    if (currentPose !== "cower") agitation = Math.max(flinchT >= 0 ? 0.45 : 0, agitation - dt * 0.15);
    // Watchers turn their whole body toward the target.
    const standing = currentPose === "watch" || currentPose === "point" || currentPose === "wave";
    const tgt = toBodyTarget();
    if (tgt && standing) {
      const want = Math.atan2(tgt.x, tgt.z);
      let d = want - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw += THREE.MathUtils.clamp(d * Math.min(1, dt * 5), -2.4 * dt, 2.4 * dt);
    }
    const sup = evalInto(frame, currentPose, time);
    if (env > 0.001) applyFlinch(frame, env, time);
    coatFollow(frame);
    if (blendT < 1) {
      // Ease from the frame we left toward the new pose.
      blendT = Math.min(1, blendT + dt / 0.45);
      const k = blendT * blendT * (3 - 2 * blendT);
      from.blend(frame, k);
      frame.copy(from);
    }
    ground(frame, sup);
    frame.apply(bones);
    last.copy(frame);
  };

  const guard = new Frame();
  const applyFlinch = (f: Frame, env: number, t: number) => {
    if (currentPose === "tied" || currentPose === "lie" || currentPose === "wheelchair") return;
    // Startle: shoulders up, hands up to guard the face, a half-step back.
    guard.copy(f);
    const crouch = currentPose !== "sit" && currentPose !== "kneel" && currentPose !== "cower";
    flinchGuard(guard, { body, rest: offsets, style, targetMesh: null, agitation }, t, crouch);
    f.blend(guard, env * 0.9);
  };

  const stepStruck = (dt: number) => {
    const st = struck!;
    st.t += dt;
    const g = 9.81;
    const lowest = () => {
      const ax = _tmp.set(0, 1, 0).applyQuaternion(st.q);
      return Math.abs(ax.y) * body.H * 0.47 + (1 - Math.abs(ax.y)) * 0.13 * s;
    };
    const settling = st.t > 1.15 || (st.t > 0.5 && st.vel.lengthSq() < 0.6);
    if (!settling) {
      st.vel.y -= g * dt;
      st.com.addScaledVector(st.vel, dt);
      const wl = st.w.length();
      if (wl > 1e-5) {
        _tq.setFromAxisAngle(_tmp.copy(st.w).divideScalar(wl), wl * dt);
        st.q.premultiply(_tq);
      }
      const lo = lowest() + groundY;
      if (st.com.y < lo) {
        st.com.y = lo;
        if (st.vel.y < 0) st.vel.y *= -0.25;
        st.vel.x *= Math.exp(-5 * dt) * 0.92;
        st.vel.z *= Math.exp(-5 * dt) * 0.92;
        st.w.multiplyScalar(0.9);
      }
      st.w.multiplyScalar(Math.exp(-0.6 * dt));
    } else {
      if (!st.final) {
        const ax = _tmp.set(0, 1, 0).applyQuaternion(st.q);
        const ah = new THREE.Vector3(ax.x, 0, ax.z);
        if (ah.lengthSq() < 1e-4) ah.copy(st.vel).setY(0);
        if (ah.lengthSq() < 1e-4) ah.set(1, 0, 0);
        ah.normalize();
        const face = new THREE.Vector3(0, 0, 1).applyQuaternion(st.q);
        const zAxis = new THREE.Vector3(0, face.y >= 0 ? 1 : -1, 0);
        const xAxis = new THREE.Vector3().crossVectors(ah, zAxis).normalize();
        const m = new THREE.Matrix4().makeBasis(xAxis, ah, zAxis);
        st.final = new THREE.Quaternion().setFromRotationMatrix(m);
      }
      st.q.slerp(st.final, 1 - Math.exp(-4 * dt));
      st.vel.multiplyScalar(Math.exp(-6 * dt));
      st.com.x += st.vel.x * dt;
      st.com.z += st.vel.z * dt;
      st.com.y += (groundY + 0.12 * s - st.com.y) * (1 - Math.exp(-6 * dt));
      if (blood && !st.pool && st.t > 1.6) {
        // Spread from under the chest, toward the head.
        const ax = _tmp.set(0, 1, 0).applyQuaternion(st.q).setY(0);
        st.pool = new THREE.Vector3(st.com.x, groundY, st.com.z).addScaledVector(ax.normalize(), 0.55 * s);
        st.poolT = 0;
      }
    }
    // Limbs: flail in the air, then fall into the collapse.
    const airK = THREE.MathUtils.clamp(st.t / 0.18, 0, 1);
    const downK = THREE.MathUtils.clamp((st.t - 0.7) / 0.9, 0, 1);
    frame.copy(last);
    const target = new Frame().copy(st.rag).blend(st.collapse, downK * downK * (3 - 2 * downK));
    if (!st.bound) {
      for (const i of [B.armL, B.foreL, B.armR, B.foreR, B.thighL, B.shinL, B.thighR, B.shinR, B.neck, B.head, B.spine]) {
        const n = vnoise(st.t * 6 + i, style.seed + i) * (1 - downK) * 0.35;
        _tq.setFromAxisAngle(_tmp.set(1, 0.3, 0.2).normalize(), n);
        target.q[i]!.multiply(_tq);
      }
    }
    frame.blend(target, airK);
    frame.q[B.root]!.copy(st.q);
    frame.p[B.root]!.copy(comBody).applyQuaternion(st.q).negate().add(st.com);
    // Furniture (wheelchair, gurney, dropped hat) gets knocked aside.
    if (st.furnSpin !== 0 || st.furnVel.lengthSq() > 0) {
      const k = Math.min(1, st.t / 0.6);
      frame.p[B.furniture]!.copy(st.furnVel).multiplyScalar(k * (2 - k));
      frame.q[B.furniture]!.setFromAxisAngle(_tmp.copy(st.furnVel).normalize().cross(UP).negate().normalize(), st.furnSpin * k);
    }
    if (st.pool && blood) {
      st.poolT += dt;
      const r = Math.sqrt(Math.min(1, st.poolT / 8));
      frame.s[B.pool] = r;
      frame.p[B.pool]!.copy(st.pool);
    } else frame.s[B.pool] = 0;
    frame.apply(bones);
    last.copy(frame);
  };

  const react = (kind: Reaction, direction?: THREE.Vector3) => {
    if (struck) return;
    group.updateWorldMatrix(true, false);
    const inv = group.getWorldQuaternion(_tq).invert();
    if (kind === "flinch") {
      const d = direction ? direction.clone() : new THREE.Vector3(0, 0, 1).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
      flinchDir.copy(d).applyQuaternion(inv).setY(0);
      if (flinchDir.lengthSq() < 1e-6) flinchDir.set(0, 0, 1);
      flinchDir.normalize();
      flinchT = 0;
      flinchLook = true;
      const turnable = currentPose === "stand" || currentPose === "queue" || currentPose === "walk" || currentPose === "work" || currentPose === "carry" || currentPose === "watch";
      if (turnable) setPose("watch");
      return;
    }
    const d = direction ? direction.clone() : new THREE.Vector3(0, 0, -1);
    d.applyQuaternion(inv).setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
    d.normalize();
    const r = rng.fork(`struck:${clock.toFixed(3)}`);
    const lying = currentPose === "tied" || currentPose === "lie";
    const rootQ = last.q[B.root]!.clone();
    const com = comBody.clone().applyQuaternion(rootQ).add(last.p[B.root]!);
    const speed = (lying ? 4.5 : 6) * r.range(0.8, 1.2);
    const axis = new THREE.Vector3().crossVectors(UP, d).normalize();
    const w = axis.multiplyScalar(-(lying ? r.range(5, 8) : r.range(6.5, 10)));
    w.y += r.range(-1.5, 1.5);
    const bound = currentPose === "tied";
    const rag = new Frame().copy(last);
    const collapse = new Frame().copy(last);
    if (!bound) {
      for (const side of [1, -1] as const) {
        const up = side > 0 ? B.armL : B.armR;
        const lo = side > 0 ? B.foreL : B.foreR;
        const th = side > 0 ? B.thighL : B.thighR;
        const sh = side > 0 ? B.shinL : B.shinR;
        rot(rag, up, r.range(-2.4, -0.8), 0, side * r.range(0.8, 2.2), "YXZ");
        rot(rag, lo, -r.range(0.2, 1.2));
        rot(rag, th, -r.range(-0.4, 0.9), 0, side * r.range(0.1, 0.5), "YZX");
        rot(rag, sh, r.range(0.2, 1.2));
        // Limbs come to rest in the plane of the ground: arms flung out
        // sideways, legs straight or splayed, nothing held up in the air.
        rot(collapse, up, r.range(-0.25, 0.25), r.range(-0.3, 0.3), side * r.range(0.15, 1.9), "YXZ");
        rot(collapse, lo, -r.range(0.05, 0.9), 0, 0);
        rot(collapse, th, -r.range(-0.12, 0.18), side * r.range(0, 0.5), side * r.range(0.05, 0.45), "YZX");
        rot(collapse, sh, r.range(0.0, 0.45));
      }
      rot(rag, B.spine, r.range(-0.5, 0.2), r.range(-0.3, 0.3), 0);
      rot(collapse, B.spine, r.range(-0.05, 0.08), r.range(-0.3, 0.3), r.range(-0.25, 0.25));
      rot(collapse, B.pelvis, 0, r.range(-0.3, 0.3), 0);
      rot(collapse, B.pelvis, 0, 0, 0);
      collapse.p[B.pelvis]!.set(0, body.hipY, 0);
      rag.p[B.pelvis]!.set(0, body.hipY, 0);
      rot(collapse, B.foreL, -r.range(0.1, 1.2));
    }
    rot(rag, B.neck, r.range(-0.6, 0.2), r.range(-0.5, 0.5));
    rot(collapse, B.neck, r.range(-0.1, 0.1), (r.chance(0.5) ? 1 : -1) * r.range(0.5, 0.8));
    rot(collapse, B.head, r.range(-0.1, 0.15), r.range(-0.3, 0.3), r.range(-0.2, 0.2));
    for (const b of [B.root, B.furniture, B.pool]) {
      rag.q[b]!.copy(last.q[b]!);
      collapse.q[b]!.copy(last.q[b]!);
    }
    const hasFurniture = currentPose === "wheelchair" || (currentPose === "lie" && stretcher) || currentPose === "tied";
    struck = {
      t: 0,
      com,
      vel: d.clone().multiplyScalar(speed).add(new THREE.Vector3(0, lying ? r.range(1.6, 2.6) : r.range(2.4, 3.6), 0)),
      q: rootQ,
      w,
      final: null,
      rag,
      collapse,
      bound,
      pool: null,
      poolT: 0,
      furnVel: hasFurniture && currentPose !== "tied" ? d.clone().multiplyScalar(r.range(0.8, 1.6)) : new THREE.Vector3(),
      furnSpin: currentPose === "wheelchair" ? r.range(1.2, 1.6) : 0,
    };
    (mesh.boundingSphere as THREE.Sphere).radius = 14;
    ud.struck = true;
    if (!blood) struck.pool = null;
    // Anything held is lost in the impact.
    for (const fr of [last, rag, collapse]) {
      fr.s[B.propR] = 0;
      fr.s[B.propL] = 0;
    }
    for (const c of bones[B.propR]!.children) c.visible = false;
    if (!blood) frame.s[B.pool] = 0;
  };

  const setPose = (p: Pose) => {
    if (p === currentPose || struck) return;
    from.copy(last);
    blendT = 0;
    currentPose = p;
    ud.pose = p;
    if (p !== "watch") flinchLook = flinchLook && flinchT >= 0 && flinchT < 3;
  };

  const ud: PersonUserData = {
    tick,
    react,
    setPose,
    setLookAt: (v) => {
      lookWorld = v ? v.clone() : null;
      flinchLook = false;
    },
    setBlood: (on) => {
      blood = on;
      if (!on && struck) struck.pool = null;
    },
    role: spec.role,
    pose,
    name: spec.name,
    height: body.H,
    walkSpeed: (2 * (body.thigh + body.shin) * Math.sin((body.age === "elder" ? 16 : 21) * (Math.PI / 180))) / (0.62 * (body.age === "child" ? 0.85 : body.age === "elder" ? 1.3 : 1.08) * style.tempo),
    struck: false,
    mesh,
    body,
  };
  Object.assign(group.userData, ud);
  // Keep userData.pose/struck live for readers.
  Object.defineProperty(group.userData, "pose", { get: () => currentPose, enumerable: true });
  Object.defineProperty(group.userData, "struck", { get: () => !!struck, enumerable: true });
  // Settle into the first frame so a static render is already posed.
  tick(0, 0);
  return group;
}
