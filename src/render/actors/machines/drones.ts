/**
 * Drones.
 *
 * drone: an industrial quadcopter (1.1 m motor-to-motor) with ringed rotor
 * guards, spinning two-blade props on their own bones, a gimbal camera
 * that keeps the trolley in frame, landing skids, nav lamps and a hovering
 * bob with small corrective tilts. The origin is the airframe centre.
 *
 * createDroneSwarm: 50–300 drones as two InstancedMeshes (airframes and
 * nav lamps: two draw calls). Formations: "cloud", "grid" (horizontal,
 * above fields), "wall" (vertical, facing +Z), "eye" (an almond, iris and
 * pupil drawn in drones, facing +Z). setFormation(kind) morphs with a
 * staggered sweep; each drone banks into its motion. Formations sit above
 * the origin (lowest drones near y = 0).
 */
import * as THREE from "three";
import { Kit, cylinder, sphere } from "../../core/geometry.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { ACCENT } from "../../core/palette.ts";
import { createRng } from "../../core/rng.ts";
import { HATCH, OBJECT_ID, bar, bodyMaterial, loft, type Condition } from "./common.ts";
import { Assembly } from "./assembly.ts";
import type { MachineBuild } from "./equipment.ts";

// ------------------------------------------------------------------ single

export function buildDrone(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "drone", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 0.3;
  a.bob = 0;
  const rig = a.rig;
  rig.bone("frame", "root", [0, 0, 0]);
  const k = rig.kit("frame");
  // Airframe: a faceted shell with a battery pair on top.
  k.add(
    loft([
      { z: -0.2, pts: [[-0.1, -0.05], [0.1, -0.05], [0.12, 0.04], [-0.12, 0.04]] },
      { z: -0.05, pts: [[-0.14, -0.07], [0.14, -0.07], [0.15, 0.06], [-0.15, 0.06]] },
      { z: 0.12, pts: [[-0.13, -0.06], [0.13, -0.06], [0.13, 0.05], [-0.13, 0.05]] },
      { z: 0.22, pts: [[-0.07, -0.04], [0.07, -0.04], [0.07, 0.02], [-0.07, 0.02]] },
    ]),
    { tone: "paper" },
  );
  for (const x of [-0.055, 0.055]) k.add(new THREE.BoxGeometry(0.09, 0.05, 0.2), { tone: "dark", position: [x, 0.08, -0.04] });
  k.add(cylinder(0.008, 0.008, 0.14, 5), { tone: "deep", position: [0, 0.17, -0.12] });
  k.add(cylinder(0.04, 0.04, 0.015, 12), { tone: "light", position: [0, 0.24, -0.12] });
  // Gimbal and camera under the nose (on its own bone, it keeps looking).
  rig.bone("gimbal", "frame", [0, -0.08, 0.16]);
  const g = rig.kit("gimbal");
  g.add(new THREE.BoxGeometry(0.03, 0.06, 0.03), { tone: "deep", position: [0, -0.02, 0] });
  g.add(new THREE.BoxGeometry(0.1, 0.09, 0.1), { tone: "dark", position: [0, -0.09, 0] });
  g.add(cylinder(0.035, 0.035, 0.02, 12), { tone: "solid", position: [0, -0.09, 0.055], rotation: [Math.PI / 2, 0, 0] });
  g.add(cylinder(0.02, 0.02, 0.02, 10), { tone: "light", position: [0.005, -0.085, 0.064], rotation: [Math.PI / 2, 0, 0] });
  // Landing skids.
  for (const s of [-1, 1]) {
    k.add(bar([s * 0.08, -0.06, -0.08], [s * 0.2, -0.26, -0.1], 0.01, 5), { tone: "deep" });
    k.add(bar([s * 0.08, -0.06, 0.08], [s * 0.2, -0.26, 0.1], 0.01, 5), { tone: "deep" });
    k.add(bar([s * 0.2, -0.26, -0.2], [s * 0.2, -0.26, 0.2], 0.012, 6), { tone: "deep" });
  }
  // Arms, motors, guards; props on bones.
  const R = 0.55;
  const props: Array<{ bone: THREE.Bone; dir: number }> = [];
  const prop = new Kit();
  prop.add(new THREE.BoxGeometry(0.5, 0.008, 0.045), { tone: "light", rotation: [0.12, 0, 0] });
  prop.add(cylinder(0.025, 0.025, 0.02, 8), { tone: "deep" });
  const propG = prop.build();
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(ang) * R,
      z = Math.sin(ang) * R;
    k.add(bar([Math.cos(ang) * 0.1, 0.0, Math.sin(ang) * 0.1], [x, 0.02, z], 0.018, 6), { tone: "deep" });
    k.add(cylinder(0.045, 0.05, 0.07, 10), { tone: "dark", position: [x, 0.05, z] });
    k.add(new THREE.TorusGeometry(0.29, 0.012, 4, 24), { tone: "light", position: [x, 0.08, z], rotation: [Math.PI / 2, 0, 0] });
    for (let j = 0; j < 3; j++) {
      const aj = ang + Math.PI + (j - 1) * 0.9;
      k.add(bar([x, 0.08, z], [x + Math.cos(aj) * 0.29, 0.08, z + Math.sin(aj) * 0.29], 0.006, 4), { tone: "mid" });
    }
    const bone = rig.bone(`prop${i}`, "frame", [x, 0.095, z]);
    rig.kit(`prop${i}`).add(propG);
    props.push({ bone, dir: i % 2 ? 1 : -1 });
  }
  // Nav lamps: white at the front arms, red at the rear arms.
  const navFront: number[] = [],
    navRear: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(ang) * (R - 0.08),
      z = Math.sin(ang) * (R - 0.08);
    const front = z > 0;
    const id = a.lamps.add(sphere(0.022, 8, 6), { accent: front ? "none" : "signal", on: "paper", off: front ? "light" : "mid", position: [x, -0.005, z] });
    (front ? navFront : navRear).push(id);
  }
  const frame = rig.get("frame");
  const gimbal = rig.get("gimbal");
  const phase = (b.seed % 19) * 0.41;
  let target: THREE.Vector3 | null = null;
  const tmp = new THREE.Vector3();
  let spin = 0;
  a.onTick((dt, t) => {
    if (a.root && (a.root.userData as { struck?: boolean }).struck) {
      frame.position.y = Math.max(-2.0, frame.position.y - dt * 3);
      return;
    }
    if (wreck) {
      frame.position.y = -0.1;
      frame.rotation.z = 0.5;
      return;
    }
    spin += dt * 38;
    for (const p of props) p.bone.rotation.y = spin * p.dir + p.dir;
    // Hover: bob, drift, small corrective tilts.
    frame.position.y = 0.09 * Math.sin(t * 1.3 + phase) + 0.03 * Math.sin(t * 3.1 + phase * 2);
    frame.position.x = 0.05 * Math.sin(t * 0.47 + phase);
    frame.rotation.z = -0.05 * Math.cos(t * 0.47 + phase) + 0.01 * Math.sin(t * 4.1);
    frame.rotation.x = 0.03 * Math.sin(t * 0.7 + phase);
    frame.rotation.y = 0.08 * Math.sin(t * 0.11 + phase);
    // The camera keeps its subject.
    if (target && a.root) {
      a.root.updateMatrixWorld();
      tmp.copy(target);
      frame.worldToLocal(tmp);
      tmp.sub(gimbal.position);
      gimbal.rotation.y = Math.atan2(tmp.x, tmp.z);
      gimbal.rotation.x = Math.atan2(-tmp.y, Math.hypot(tmp.x, tmp.z)) * 0.6;
    } else {
      gimbal.rotation.y = -frame.rotation.y;
      gimbal.rotation.x = 0.25;
    }
    const strobe = (t + phase) % 1.2;
    for (const id of navFront) a.lamps.set(id, 1);
    for (const id of navRear) a.lamps.set(id, strobe < 0.1 || (strobe > 0.2 && strobe < 0.3) ? 1 : 0.1);
  });
  const root = a.finish(bodyMaterial(HATCH.fine, OBJECT_ID.drone), { width: 1.4, depth: 1.4, height: 0.5 }, "frame");
  root.userData.track = (p: THREE.Vector3 | null) => {
    target = p ? p.clone() : null;
  };
  return root;
}

// ------------------------------------------------------------------- swarm

export type SwarmFormation = "cloud" | "grid" | "wall" | "eye";

/** One swarm airframe (merged, no hierarchy): body, arms, guards, blur discs. */
function swarmAirframe(): THREE.BufferGeometry {
  const k = new Kit();
  k.add(
    loft([
      { z: -0.14, pts: [[-0.07, -0.04], [0.07, -0.04], [0.08, 0.03], [-0.08, 0.03]] },
      { z: 0.0, pts: [[-0.1, -0.05], [0.1, -0.05], [0.1, 0.045], [-0.1, 0.045]] },
      { z: 0.14, pts: [[-0.05, -0.03], [0.05, -0.03], [0.05, 0.015], [-0.05, 0.015]] },
    ]),
    { tone: "paper" },
  );
  k.add(new THREE.BoxGeometry(0.06, 0.06, 0.06), { tone: "solid", position: [0, -0.07, 0.1] });
  const R = 0.34;
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(ang) * R,
      z = Math.sin(ang) * R;
    k.add(bar([0, 0, 0], [x, 0.01, z], 0.016, 4), { tone: "deep" });
    // Guard ring with the grey disc of a spinning prop inside it.
    k.add(cylinder(0.2, 0.2, 0.035, 12, true), { tone: "light", position: [x, 0.05, z] });
    k.add(new THREE.CircleGeometry(0.19, 12), { tone: "pale", position: [x, 0.05, z], rotation: [-Math.PI / 2, 0, 0] });
    k.add(new THREE.CircleGeometry(0.19, 12), { tone: "mid", position: [x, 0.049, z], rotation: [Math.PI / 2, 0, 0] });
  }
  return k.build();
}

export interface SwarmSpec {
  count: number;
  seed: number | string;
  formation?: SwarmFormation;
  condition?: Condition;
}

function formationSlots(kind: SwarmFormation, n: number, rngSeed: string): THREE.Vector3[] {
  const r = createRng(`${rngSeed}:${kind}`);
  const out: THREE.Vector3[] = [];
  switch (kind) {
    case "grid": {
      const cols = Math.ceil(Math.sqrt(n));
      const sp = 2.4;
      for (let i = 0; i < n; i++) {
        const c = i % cols,
          rr = Math.floor(i / cols);
        out.push(new THREE.Vector3((c - (cols - 1) / 2) * sp, 4.0, (rr - (Math.ceil(n / cols) - 1) / 2) * sp));
      }
      break;
    }
    case "wall": {
      const rows = Math.max(3, Math.round(Math.sqrt(n / 2.6)));
      const cols = Math.ceil(n / rows);
      const sp = 1.9;
      for (let i = 0; i < n; i++) {
        const c = i % cols,
          rr = Math.floor(i / cols);
        out.push(new THREE.Vector3((c - (cols - 1) / 2) * sp + (rr % 2) * sp * 0.5, 0.8 + rr * sp, 0));
      }
      break;
    }
    case "eye": {
      const W = Math.max(14, Math.sqrt(n) * 2.6),
        H = W * 0.42,
        cy = H * 0.5 + 1.5;
      const nOutline = Math.round(n * 0.46),
        nIris = Math.round(n * 0.3),
        nPupil = n - nOutline - nIris;
      // Almond: two arcs meeting at the corners.
      for (let i = 0; i < nOutline; i++) {
        const t = (i / nOutline) * 2;
        const upper = t < 1;
        const u = upper ? t : t - 1;
        const x = (u - 0.5) * W * (upper ? 1 : -1);
        const y = Math.sin(u * Math.PI) * (H / 2) * (upper ? 1 : -1);
        out.push(new THREE.Vector3(x, cy + y, 0));
      }
      const ir = H * 0.36;
      for (let i = 0; i < nIris; i++) {
        const ang = (i / nIris) * Math.PI * 2;
        out.push(new THREE.Vector3(Math.cos(ang) * ir, cy + Math.sin(ang) * ir, 0.3));
      }
      // Pupil: a filled disc (sunflower spiral).
      const pr = ir * 0.48;
      for (let i = 0; i < nPupil; i++) {
        const rr = pr * Math.sqrt((i + 0.5) / nPupil);
        const ang = i * 2.39996;
        out.push(new THREE.Vector3(Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 0.6));
      }
      break;
    }
    case "cloud":
    default: {
      const rx = Math.max(9, Math.sqrt(n) * 1.8),
        ry = rx * 0.35,
        rz = rx * 0.7;
      for (let i = 0; i < n; i++) {
        let v: THREE.Vector3;
        do v = new THREE.Vector3(r.range(-1, 1), r.range(-1, 1), r.range(-1, 1));
        while (v.lengthSq() > 1);
        out.push(new THREE.Vector3(v.x * rx, 2 + ry + v.y * ry, v.z * rz));
      }
      break;
    }
  }
  return out;
}

export function createDroneSwarm(spec: SwarmSpec): THREE.Object3D {
  const n = Math.max(50, Math.min(300, Math.round(spec.count)));
  const seedKey = String(spec.seed);
  const rng = createRng(`swarm:${seedKey}`);
  const group = new THREE.Group();
  group.name = "machine:drone-swarm";
  const geometry = swarmAirframe();
  const material = inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: HATCH.fine, objectId: OBJECT_ID.drone });
  const mesh = new THREE.InstancedMesh(geometry, material, n);
  mesh.name = "swarm:airframes";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  group.add(mesh);
  // Nav lamps: one per drone, pigment switched per instance.
  const lampGeo = new THREE.SphereGeometry(0.05, 6, 4);
  const lampMat = inkMaterial({ instanceInk: true, flat: true, hatchSpace: "object", hatch: HATCH.fine, objectId: OBJECT_ID.lamp, edge: 0.5 });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, n);
  lamps.name = "swarm:lamps";
  lamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lamps.frustumCulled = false;
  const inkInst = new Float32Array(n * 3);
  const inkAttr = new THREE.InstancedBufferAttribute(inkInst, 3);
  inkAttr.setUsage(THREE.DynamicDrawUsage);
  lamps.geometry.setAttribute("inkInstance", inkAttr);
  lamps.castShadow = false;
  lamps.userData.castShadow = false;
  group.add(lamps);

  const phase = new Float32Array(n);
  const from: THREE.Vector3[] = [];
  const to: THREE.Vector3[] = [];
  const pos: THREE.Vector3[] = [];
  const vel: THREE.Vector3[] = [];
  const delay = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    phase[i] = rng.next() * Math.PI * 2;
    pos.push(new THREE.Vector3());
    from.push(new THREE.Vector3());
    to.push(new THREE.Vector3());
    vel.push(new THREE.Vector3());
  }
  let formation: SwarmFormation = spec.formation ?? "cloud";
  let morphStart = -1;
  let clock = 0;
  const MORPH = 3.6,
    SWEEP = 1.8;

  /** Pair drones with slots monotonically in x (then y) to avoid tangles. */
  const assign = (slots: THREE.Vector3[]) => {
    const order = [...Array(n).keys()].sort((p, q) => pos[p]!.x - pos[q]!.x || pos[p]!.y - pos[q]!.y);
    const sorted = [...slots.keys()].sort((p, q) => slots[p]!.x - slots[q]!.x || slots[p]!.y - slots[q]!.y);
    order.forEach((drone, j) => {
      to[drone]!.copy(slots[sorted[j]!]!);
    });
    // Sweep: drones nearest the centre line move first.
    for (let i = 0; i < n; i++) delay[i] = (Math.min(1, Math.abs(to[i]!.x) / 20) * 0.7 + rng.next() * 0.3) * SWEEP;
  };
  // Initial placement: already in formation.
  const initial = formationSlots(formation, n, seedKey);
  for (let i = 0; i < n; i++) {
    pos[i]!.copy(initial[i]!);
    to[i]!.copy(initial[i]!);
    from[i]!.copy(initial[i]!);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const lampOff = new THREE.Vector3();
  const wreck = spec.condition === "wreck";
  const write = (t: number, dt: number) => {
    const morphing = morphStart >= 0 ? t - morphStart : Infinity;
    for (let i = 0; i < n; i++) {
      prev.copy(pos[i]!);
      let k = 1;
      if (morphing < MORPH + SWEEP) {
        const local = (morphing - delay[i]!) / MORPH;
        k = local <= 0 ? 0 : local >= 1 ? 1 : local * local * (3 - 2 * local);
      }
      p.lerpVectors(from[i]!, to[i]!, k);
      // An arc in flight, and the hover bob.
      p.y += Math.sin(k * Math.PI) * 1.4;
      const ph = phase[i]!;
      p.y += 0.12 * Math.sin(t * 1.4 + ph);
      p.x += 0.06 * Math.sin(t * 0.6 + ph * 1.7);
      if (formation === "cloud") {
        p.x += 0.8 * Math.sin(t * 0.21 + ph);
        p.z += 0.8 * Math.cos(t * 0.17 + ph * 1.3);
        p.y += 0.4 * Math.sin(t * 0.26 + ph * 0.7);
      }
      if (wreck) p.y = Math.min(p.y, 0.15);
      pos[i]!.copy(p);
      // Bank into the motion.
      if (dt > 0) vel[i]!.lerp(prev.sub(p).multiplyScalar(-1 / dt), Math.min(1, dt * 4));
      const v = vel[i]!;
      e.set(Math.max(-0.4, Math.min(0.4, v.z * 0.08)), formation === "grid" || formation === "cloud" ? ph : 0, Math.max(-0.4, Math.min(0.4, -v.x * 0.08)));
      q.setFromEuler(e);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      lampOff.set(0, -0.07, 0.16).applyQuaternion(q).add(p);
      m.compose(lampOff, q, s);
      lamps.setMatrixAt(i, m);
      // Synchronized pulse sweeping across the formation.
      const pulse = wreck ? 0 : (t * 0.9 - p.x * 0.02 + 10) % 1 < 0.12 ? 1 : 0.08;
      inkInst[i * 3] = 0.25 * (1 - pulse);
      inkInst[i * 3 + 1] = pulse;
      inkInst[i * 3 + 2] = ACCENT.signal;
    }
    mesh.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    inkAttr.needsUpdate = true;
  };
  write(0, 0);
  const setFormation = (kind: SwarmFormation) => {
    if (kind === formation && morphStart >= 0) return;
    formation = kind;
    for (let i = 0; i < n; i++) from[i]!.copy(pos[i]!);
    assign(formationSlots(kind, n, seedKey));
    morphStart = clock;
  };
  group.userData = {
    kind: "machine",
    id: "drone-swarm",
    count: n,
    footprint: { width: 40, depth: 30, height: 20 },
    tick: (dt: number, t: number) => {
      clock = t;
      write(t, dt);
    },
    setFormation,
    get formation() {
      return formation;
    },
    react: (_kind: "struck" | "flinch") => {
      // A swarm does not flinch; it closes ranks into a wall.
      if (_kind === "flinch" && formation !== "wall" && formation !== "eye") setFormation("wall");
    },
  };
  return group;
}
