/**
 * Robots.
 *
 * robot-humanoid: a 1.84 m maintenance android. White shells over dark
 * joints, a featureless head with a single ink visor band, limbs a little
 * too long. It holds still the way machines do: no breathing, only servo
 * corrections, and a head that moves in saccades (fast turn, long hold).
 * Poses: "stand", "work" (reaching into a cabinet with cable cutters),
 * "watch" (turned toward the trolley). userData.lookAt(target) aims the head.
 *
 * robot-quadruped: a 0.75 m legged inspection robot with a sensor head,
 * two-bone IK legs and a trot gait when given a speed; an optional
 * manipulator arm stands on its back like a second, eyeless head.
 */
import * as THREE from "three";
import { cylinder, lathe, sphere } from "../../core/geometry.ts";
import { HATCH, OBJECT_ID, bar, bodyMaterial, cylX, cylZ, loft, type V2, type V3 } from "./common.ts";
import { Assembly } from "./assembly.ts";
import type { MachineBuild } from "./equipment.ts";

export type RobotPose = "stand" | "work" | "watch";

/** Tapered limb shell along -Y from the joint (lathe), length L. */
function limb(r0: number, r1: number, L: number, bulge = 1.08, seg = 10): THREE.BufferGeometry {
  const prof: V2[] = [
    [0.001, 0],
    [r0 * 0.7, -0.01],
    [r0 * bulge, -L * 0.22],
    [(r0 + r1) * 0.5 * bulge, -L * 0.55],
    [r1, -L * 0.88],
    [r1 * 0.7, -L],
    [0.001, -L - 0.005],
  ];
  // lathe expects bottom-to-top; flip y order.
  const g = lathe(
    prof.map(([r, y]): V2 => [r, y]).reverse(),
    seg,
  );
  return g;
}

function joint(r: number, w: number): THREE.BufferGeometry {
  return cylX(r, w, 10);
}

// ---------------------------------------------------------------- humanoid

interface PoseFrame {
  [bone: string]: V3;
}

const POSES: Record<RobotPose, PoseFrame> = {
  stand: {
    armL: [0.02, 0, 0.1],
    armR: [0.02, 0, -0.1],
    foreL: [-0.12, 0, 0],
    foreR: [-0.12, 0, 0],
    head: [0.12, 0, 0.1],
    neck: [0.04, 0, 0],
  },
  watch: {
    armL: [0.0, 0, 0.06],
    armR: [0.0, 0, -0.06],
    foreL: [-0.05, 0, 0],
    foreR: [-0.05, 0, 0],
    head: [-0.02, 0, 0],
    neck: [0, 0, 0],
  },
  work: {
    // Right arm reaching forward and up into a cabinet; head bent to the task.
    armR: [-1.25, 0.1, -0.12],
    foreR: [-0.55, 0, 0],
    handR: [0.2, 0, 0],
    armL: [-0.45, 0, 0.14],
    foreL: [-0.9, 0.2, 0],
    handL: [0.1, 0, 0],
    chest: [0.12, 0, 0],
    neck: [0.18, 0, 0],
    head: [0.3, -0.15, 0.05],
  },
};

export function buildHumanoid(b: MachineBuild & { pose?: RobotPose }): THREE.Object3D {
  const pose: RobotPose = b.pose ?? (["watch", "stand", "work"] as const)[b.seed % 3]!;
  const a = new Assembly("machine", "robot-humanoid", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 0.8;
  a.bob = 0;
  const rig = a.rig;
  rig.bone("pelvis", "root", [0, 1.0, 0]);
  rig.bone("spine", "pelvis", [0, 0.13, 0]);
  rig.bone("chest", "spine", [0, 0.2, -0.01]);
  rig.bone("neck", "chest", [0, 0.25, -0.01]);
  rig.bone("head", "neck", [0, 0.1, 0.01]);
  for (const s of [1, -1]) {
    const side = s > 0 ? "L" : "R";
    rig.bone(`arm${side}`, "chest", [s * 0.21, 0.17, 0]);
    rig.bone(`fore${side}`, `arm${side}`, [0, -0.31, 0]);
    rig.bone(`hand${side}`, `fore${side}`, [0, -0.3, 0]);
    rig.bone(`thigh${side}`, "pelvis", [s * 0.085, -0.04, 0]);
    rig.bone(`shin${side}`, `thigh${side}`, [0, -0.46, 0]);
    rig.bone(`foot${side}`, `shin${side}`, [0, -0.45, 0]);
  }
  const shell = "paper" as const;
  // Pelvis shell and hip joints.
  // Pelvis: a narrow shell tapering to the crotch, hip actuators either side.
  rig.kit("pelvis").add(
    loft([
      { z: -0.08, pts: [[-0.04, -0.12], [0.04, -0.12], [0.11, -0.03], [0.12, 0.05], [-0.12, 0.05], [-0.11, -0.03]] },
      { z: 0.02, pts: [[-0.05, -0.14], [0.05, -0.14], [0.13, -0.04], [0.13, 0.06], [-0.13, 0.06], [-0.13, -0.04]] },
      { z: 0.08, pts: [[-0.035, -0.1], [0.035, -0.1], [0.09, -0.03], [0.1, 0.04], [-0.1, 0.04], [-0.09, -0.03]] },
    ]),
    { tone: "pale" },
  );
  for (const s of [-1, 1]) rig.kit("pelvis").add(cylX(0.045, 0.05, 10), { tone: "deep", position: [s * 0.1, -0.05, 0] });
  // Waist: exposed spine segments and tendons.
  const sp = rig.kit("spine");
  for (let i = 0; i < 4; i++) sp.add(cylinder(0.07 - i * 0.004, 0.075 - i * 0.004, 0.035, 10), { tone: i % 2 ? "deep" : "dark", position: [0, 0.02 + i * 0.045, -0.02] });
  for (const x of [-0.06, 0.06]) sp.add(bar([x, 0.0, 0.03], [x * 1.2, 0.2, 0.04], 0.008, 4), { tone: "solid" });
  // Chest: a sculpted shell, broad at the shoulders, with a sternum seam.
  const ch = rig.kit("chest");
  ch.add(
    loft([
      { z: -0.11, pts: [[-0.13, -0.02], [0.13, -0.02], [0.19, 0.16], [0.17, 0.25], [-0.17, 0.25], [-0.19, 0.16]] },
      { z: 0.02, pts: [[-0.14, -0.04], [0.14, -0.04], [0.21, 0.15], [0.19, 0.26], [-0.19, 0.26], [-0.21, 0.15]] },
      { z: 0.12, pts: [[-0.1, 0.0], [0.1, 0.0], [0.15, 0.13], [0.12, 0.22], [-0.12, 0.22], [-0.15, 0.13]] },
    ]),
    { tone: shell },
  );
  ch.add(new THREE.BoxGeometry(0.008, 0.2, 0.01), { tone: "solid", position: [0, 0.11, 0.125] });
  for (const s of [-1, 1]) ch.add(new THREE.BoxGeometry(0.12, 0.006, 0.01), { tone: "dark", position: [s * 0.08, 0.05, 0.118], rotation: [0, s * -0.3, s * 0.2] });
  // Back pack: a slim power spine with a port.
  ch.add(new THREE.BoxGeometry(0.15, 0.22, 0.045), { tone: "light", position: [0, 0.13, -0.125] });
  for (let i = 0; i < 3; i++) ch.add(new THREE.BoxGeometry(0.11, 0.012, 0.01), { tone: "deep", position: [0, 0.07 + i * 0.05, -0.15] });
  ch.add(cylZ(0.02, 0.02, 10), { tone: "solid", position: [0, 0.03, -0.14] });
  for (const s of [-1, 1]) ch.add(sphere(0.07, 12, 8), { tone: "pale", position: [s * 0.21, 0.17, 0], scale: [1, 0.85, 1] });
  // Neck: stacked discs and exposed cables.
  const nk = rig.kit("neck");
  for (let i = 0; i < 3; i++) nk.add(cylinder(0.034, 0.038, 0.022, 10), { tone: i % 2 ? "solid" : "deep", position: [0, 0.015 + i * 0.03, 0] });
  for (const x of [-0.03, 0.03]) nk.add(bar([x, 0.0, 0.035], [x * 0.8, 0.1, 0.03], 0.006, 4), { tone: "solid" });
  // Head: a smooth egg, a single ink visor band, sensor rings at the temples.
  const hk = rig.kit("head");
  hk.add(sphere(1, 16, 12), { tone: shell, position: [0, 0.1, 0.01], scale: [0.095, 0.125, 0.112] });
  // The visor wraps from temple to temple: one ink band, no features.
  const visor = sphere(1, 18, 6);
  hk.add(visor, { tone: "solid", position: [0, 0.105, 0.018], scale: [0.099, 0.024, 0.108] });
  for (const s of [-1, 1]) hk.add(new THREE.TorusGeometry(0.022, 0.005, 4, 12), { tone: "deep", position: [s * 0.094, 0.1, 0.0], rotation: [0, Math.PI / 2, 0] });
  hk.add(new THREE.BoxGeometry(0.006, 0.16, 0.006), { tone: "dark", position: [0, 0.12, -0.1], rotation: [0.25, 0, 0] });
  // Limbs.
  for (const s of [1, -1]) {
    const side = s > 0 ? "L" : "R";
    const ua = rig.kit(`arm${side}`);
    ua.add(limb(0.046, 0.036, 0.29), { tone: shell });
    ua.add(joint(0.034, 0.1), { tone: "deep", position: [0, -0.3, 0] });
    const fa = rig.kit(`fore${side}`);
    fa.add(limb(0.04, 0.026, 0.28, 1.14), { tone: shell });
    fa.add(cylinder(0.022, 0.022, 0.04, 8), { tone: "solid", position: [0, -0.29, 0] });
    const hd = rig.kit(`hand${side}`);
    hd.add(new THREE.BoxGeometry(0.075, 0.1, 0.03), { tone: "pale", position: [0, -0.06, 0] });
    // Fingers a joint too long.
    for (let f = 0; f < 4; f++) {
      const x = -0.027 + f * 0.018;
      hd.add(new THREE.BoxGeometry(0.012, 0.072, 0.015), { tone: "dark", position: [x, -0.146, 0.004] });
      hd.add(new THREE.BoxGeometry(0.011, 0.07, 0.013), { tone: "deep", position: [x, -0.212, 0.016], rotation: [0.28, 0, 0] });
    }
    hd.add(new THREE.BoxGeometry(0.014, 0.07, 0.016), { tone: "dark", position: [s * -0.045, -0.08, 0.03], rotation: [0.4, 0, s * -0.5] });
    const th = rig.kit(`thigh${side}`);
    th.add(limb(0.064, 0.046, 0.44, 1.1), { tone: shell });
    th.add(joint(0.04, 0.1), { tone: "deep", position: [0, -0.46, 0] });
    th.add(new THREE.BoxGeometry(0.07, 0.08, 0.03), { tone: "pale", position: [0, -0.45, 0.05] });
    const sh = rig.kit(`shin${side}`);
    sh.add(limb(0.05, 0.03, 0.42, 1.16), { tone: shell });
    sh.add(bar([0, -0.05, -0.05], [0, -0.3, -0.04], 0.018, 6), { tone: "dark" });
    sh.add(cylinder(0.03, 0.03, 0.04, 8), { tone: "solid", position: [0, -0.43, 0] });
    const ft = rig.kit(`foot${side}`);
    ft.add(
      loft([
        { z: -0.07, pts: [[-0.045, -0.08], [0.045, -0.08], [0.04, -0.01], [-0.04, -0.01]] },
        { z: 0.06, pts: [[-0.05, -0.08], [0.05, -0.08], [0.045, -0.04], [-0.045, -0.04]] },
        { z: 0.16, pts: [[-0.04, -0.08], [0.04, -0.08], [0.035, -0.065], [-0.035, -0.065]] },
      ]),
      { tone: "pale" },
    );
  }
  // A tool in the working hand: cable cutters.
  if (pose === "work") {
    const hr = rig.kit("handR");
    hr.add(bar([0, -0.1, 0.03], [0.0, -0.3, 0.1], 0.01, 5), { tone: "solid" });
    hr.add(bar([0.02, -0.1, 0.03], [0.05, -0.28, 0.1], 0.01, 5), { tone: "solid" });
    hr.add(new THREE.BoxGeometry(0.03, 0.08, 0.025), { tone: "deep", position: [0.02, -0.33, 0.12], rotation: [0.4, 0, 0] });
  }
  // Pose, servo corrections, saccadic head.
  const frame = POSES[pose];
  const apply = (f: PoseFrame, w: number) => {
    for (const [name, rot] of Object.entries(f)) {
      if (!rig.has(name)) continue;
      const bone = rig.get(name);
      bone.rotation.set(rot[0] * w, rot[1] * w, rot[2] * w);
    }
  };
  apply(frame, 1);
  let target: THREE.Vector3 | null = null;
  const head = rig.get("head");
  const neck = rig.get("neck");
  const base = { hx: head.rotation.x, hy: head.rotation.y, hz: head.rotation.z };
  let gaze = { yaw: 0, pitch: 0 };
  let goal = { yaw: 0, pitch: 0 };
  let hold = 0;
  let alert = 0;
  const tmp = new THREE.Vector3();
  const seedPhase = (b.seed % 13) * 0.7;
  const handR = rig.has("handR") ? rig.get("handR") : null;
  const foreR = rig.get("foreR");
  let limp = 0;
  a.onTick((dt, t) => {
    if (a.root && (a.root.userData as { struck?: boolean }).struck) {
      // Joints release.
      limp = Math.min(1, limp + dt * 2);
      for (const n of ["armL", "armR", "foreL", "foreR", "head", "neck"]) {
        const bn = rig.get(n);
        bn.rotation.x += (0 - bn.rotation.x) * limp * 0.1;
        bn.rotation.z += ((n.endsWith("L") ? 0.9 : n.endsWith("R") ? -0.9 : 0.6) - bn.rotation.z) * limp * 0.08;
      }
      return;
    }
    if (wreck) {
      head.rotation.set(0.9, 0.2, 0.4);
      return;
    }
    // Choose a gaze goal: the target, the trolley (+Z), or the work.
    if (target && a.root) {
      a.root.updateMatrixWorld();
      tmp.copy(target);
      neck.worldToLocal(tmp);
      goal.yaw = Math.max(-1.3, Math.min(1.3, Math.atan2(tmp.x, tmp.z)));
      goal.pitch = Math.max(-0.5, Math.min(0.6, -Math.atan2(tmp.y - 0.1, Math.hypot(tmp.x, tmp.z))));
    } else if (alert > 0 || pose === "watch") {
      goal.yaw = Math.sin(t * 0.05 + seedPhase) * 0.05;
      goal.pitch = 0;
    } else {
      goal.yaw = 0;
      goal.pitch = 0;
    }
    alert = Math.max(0, alert - dt * 0.05);
    // Saccades: move only when the error is large, then snap and hold.
    hold -= dt;
    const err = Math.hypot(goal.yaw - gaze.yaw, goal.pitch - gaze.pitch);
    if (hold <= 0 && err > 0.08) {
      const k = Math.min(1, dt * 14);
      gaze.yaw += (goal.yaw - gaze.yaw) * k;
      gaze.pitch += (goal.pitch - gaze.pitch) * k;
      if (err < 0.1) hold = 1.2 + ((t * 7.3) % 1) * 2.5;
    }
    const w = pose === "work" && !target && alert <= 0 ? 1 : 0.25;
    head.rotation.set(base.hx * w + gaze.pitch, gaze.yaw, base.hz * w);
    // Servo correction: a small, regular tremor in the working hand.
    if (pose === "work" && handR) {
      const c = Math.sin(t * 5.3 + seedPhase);
      handR.rotation.x = 0.2 + (c > 0.92 ? (c - 0.92) * 2.5 : 0);
      foreR.rotation.x = -0.55 + Math.sin(t * 0.9 + seedPhase) * 0.015;
    }
  });
  const root = a.finish(bodyMaterial(HATCH.fine * 1.4, OBJECT_ID.robot), { width: 0.6, depth: 0.5, height: 1.84 });
  root.userData.lookAt = (p: THREE.Vector3 | null) => {
    target = p ? p.clone() : null;
    hold = 0;
  };
  const baseReact = root.userData.react as (k: "struck" | "flinch", d?: THREE.Vector3) => void;
  root.userData.react = (k: "struck" | "flinch", d?: THREE.Vector3) => {
    if (k === "flinch") {
      // It does not flinch. It turns to look.
      alert = 1;
      hold = 0;
      return;
    }
    baseReact(k, d);
  };
  root.userData.pose = pose;
  return root;
}

// --------------------------------------------------------------- quadruped

const THIGH = 0.33,
  SHIN = 0.35;

/** Two-bone IK in the sagittal plane: returns [hip pitch, knee bend]. */
function legIK(dy: number, dz: number): [number, number] {
  const d = Math.min(THIGH + SHIN - 1e-3, Math.hypot(dy, dz));
  const cosK = (THIGH * THIGH + SHIN * SHIN - d * d) / (2 * THIGH * SHIN);
  const knee = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
  const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  // Angle of the hip→foot line from straight down (positive = foot forward).
  const line = Math.atan2(dz, -dy);
  // Knees point backward: the thigh lies behind the hip-foot line (a
  // positive bone pitch swings a hanging limb toward -Z).
  return [a - line, -knee];
}

export function buildQuadruped(b: MachineBuild): THREE.Object3D {
  const a = new Assembly("machine", "robot-quadruped", b.condition);
  const wreck = b.condition === "wreck";
  a.reactStyle = "topple";
  a.mass = 0.9;
  a.bob = 0;
  const rig = a.rig;
  const bodyH = 0.52;
  rig.bone("body", "root", [0, bodyH, 0]);
  const bk = rig.kit("body");
  // Body shell: chamfered box, top rails, sensor faces fore and aft.
  const L = 1.0,
    Wd = 0.42,
    Hb = 0.2;
  bk.add(
    loft([
      { z: -L / 2, pts: [[-Wd / 2 + 0.04, -Hb / 2 + 0.02], [Wd / 2 - 0.04, -Hb / 2 + 0.02], [Wd / 2 - 0.04, Hb / 2 - 0.03], [-Wd / 2 + 0.04, Hb / 2 - 0.03]] },
      { z: -L / 2 + 0.06, pts: [[-Wd / 2, -Hb / 2], [Wd / 2, -Hb / 2], [Wd / 2, Hb / 2], [-Wd / 2, Hb / 2]] },
      { z: L / 2 - 0.1, pts: [[-Wd / 2, -Hb / 2], [Wd / 2, -Hb / 2], [Wd / 2, Hb / 2], [-Wd / 2, Hb / 2]] },
      { z: L / 2, pts: [[-Wd / 2 + 0.05, -Hb / 2 + 0.03], [Wd / 2 - 0.05, -Hb / 2 + 0.03], [Wd / 2 - 0.05, Hb / 2 - 0.05], [-Wd / 2 + 0.05, Hb / 2 - 0.05]] },
    ]),
    { tone: "paper" },
  );
  bk.add(new THREE.BoxGeometry(Wd - 0.06, 0.03, L - 0.3), { tone: "pale", position: [0, Hb / 2 + 0.015, 0] });
  for (const s of [-1, 1]) {
    bk.add(bar([s * 0.14, Hb / 2 + 0.03, -0.3], [s * 0.14, Hb / 2 + 0.07, -0.25], 0.012, 5), { tone: "deep" });
    bk.add(bar([s * 0.14, Hb / 2 + 0.07, -0.25], [s * 0.14, Hb / 2 + 0.07, 0.2], 0.012, 5), { tone: "deep" });
    bk.add(bar([s * 0.14, Hb / 2 + 0.07, 0.2], [s * 0.14, Hb / 2 + 0.03, 0.25], 0.012, 5), { tone: "deep" });
    bk.add(new THREE.BoxGeometry(0.01, 0.1, L - 0.4), { tone: "light", position: [s * (Wd / 2 + 0.004), 0, 0] });
  }
  for (const s of [-1, 1]) {
    const zf = (s * L) / 2 + s * 0.005;
    bk.add(new THREE.BoxGeometry(Wd - 0.12, 0.1, 0.01), { tone: "solid", position: [0, 0.0, zf] });
    for (const x of [-0.09, 0.09]) bk.add(cylZ(0.022, 0.02, 10), { tone: "light", position: [x, 0.0, zf + s * 0.008] });
  }
  bk.add(cylinder(0.06, 0.07, 0.05, 12), { tone: "dark", position: [0, Hb / 2 + 0.05, 0.28] });
  bk.add(cylinder(0.055, 0.055, 0.04, 12), { tone: "solid", position: [0, Hb / 2 + 0.095, 0.28] });
  // Legs.
  const legs: Array<{ name: string; hip: THREE.Bone; thigh: THREE.Bone; shin: THREE.Bone; x: number; z: number; phase: number }> = [];
  const corners: Array<[string, number, number, number]> = [
    ["FL", 1, 1, 0],
    ["FR", -1, 1, 0.5],
    ["HL", 1, -1, 0.5],
    ["HR", -1, -1, 0],
  ];
  for (const [nm, sx, sz, ph] of corners) {
    const hx = sx * (Wd / 2 + 0.03),
      hz = sz * (L / 2 - 0.1);
    const hip = rig.bone(`hip${nm}`, "body", [hx, -0.02, hz]);
    const thigh = rig.bone(`thigh${nm}`, `hip${nm}`, [sx * 0.05, 0, 0]);
    const shin = rig.bone(`shin${nm}`, `thigh${nm}`, [0, -THIGH, 0]);
    rig.kit(`hip${nm}`).add(cylX(0.06, 0.1, 12), { tone: "deep", position: [sx * 0.02, 0, 0] });
    const tk = rig.kit(`thigh${nm}`);
    tk.add(
      loft([
        { z: -0.05, pts: [[-0.035, -0.02], [0.035, -0.02], [0.03, -THIGH + 0.03], [-0.03, -THIGH + 0.03]] },
        { z: 0.05, pts: [[-0.035, -0.02], [0.035, -0.02], [0.03, -THIGH + 0.03], [-0.03, -THIGH + 0.03]] },
      ]),
      { tone: "pale" },
    );
    tk.add(cylX(0.045, 0.09, 10), { tone: "dark", position: [0, 0, 0] });
    tk.add(cylX(0.035, 0.08, 10), { tone: "deep", position: [0, -THIGH, 0] });
    const shk = rig.kit(`shin${nm}`);
    shk.add(bar([0, 0, 0], [0, -SHIN + 0.03, 0], 0.018, 6), { tone: "dark" });
    shk.add(sphere(0.035, 10, 8), { tone: "solid", position: [0, -SHIN + 0.01, 0] });
    legs.push({ name: nm, hip, thigh, shin, x: hx, z: hz, phase: ph });
  }
  // Optional manipulator arm: a folded boom with a gripper standing like a head.
  const armed = b.seed % 2 === 0;
  if (armed) {
    rig.bone("armBase", "body", [0, Hb / 2 + 0.02, 0.18]);
    rig.bone("armBoom", "armBase", [0, 0.06, 0]);
    rig.bone("armFore", "armBoom", [0, 0.34, 0]);
    rig.kit("armBase").add(cylinder(0.07, 0.08, 0.06, 12), { tone: "dark", position: [0, 0.03, 0] });
    rig.kit("armBoom").add(bar([0, 0, 0], [0, 0.34, 0], 0.03, 8), { tone: "paper" });
    rig.kit("armBoom").add(cylX(0.04, 0.08, 10), { tone: "deep", position: [0, 0.34, 0] });
    const fk = rig.kit("armFore");
    fk.add(bar([0, 0, 0], [0, 0, 0.28], 0.026, 8), { tone: "paper" });
    fk.add(new THREE.BoxGeometry(0.07, 0.07, 0.1), { tone: "light", position: [0, 0, 0.32] });
    fk.add(new THREE.BoxGeometry(0.012, 0.05, 0.1), { tone: "solid", position: [0.022, -0.02, 0.41], rotation: [0, 0.15, 0] });
    fk.add(new THREE.BoxGeometry(0.012, 0.05, 0.1), { tone: "solid", position: [-0.022, -0.02, 0.41], rotation: [0, -0.15, 0] });
    fk.add(cylZ(0.012, 0.01, 8), { tone: "solid", position: [0, 0.025, 0.37] });
    rig.get("armBoom").rotation.x = -0.25;
    rig.get("armFore").rotation.x = 0.35;
  }
  const body = rig.get("body");
  let speed = 0;
  let phase = 0;
  const seedPhase = (b.seed % 17) * 0.37;
  const stride = 0.28;
  a.onTick((dt, t) => {
    if (a.root && (a.root.userData as { struck?: boolean }).struck) return;
    if (wreck) {
      body.position.y = 0.16;
      body.rotation.z = 0.25;
      for (const l of legs) {
        l.thigh.rotation.x = 1.2;
        l.shin.rotation.x = -2.4;
      }
      return;
    }
    speed = a.speed;
    const moving = Math.min(1, Math.abs(speed) / 0.6);
    phase += dt * (moving > 0 ? 2.0 + Math.abs(speed) * 1.2 : 0);
    // Idle: slow weight shifts and a scanning sway of the body.
    const sway = (1 - moving) * Math.sin(t * 0.45 + seedPhase);
    body.position.y = bodyH + (1 - moving) * 0.008 * Math.sin(t * 0.9 + seedPhase) - moving * 0.02;
    body.rotation.y = sway * 0.06;
    body.rotation.z = sway * 0.03;
    body.rotation.x = (1 - moving) * 0.02 * Math.sin(t * 0.31 + seedPhase);
    for (const l of legs) {
      const p = (phase + l.phase) % 1;
      let fz = 0,
        lift = 0;
      if (moving > 0) {
        if (p < 0.5) fz = stride / 2 - (p / 0.5) * stride;
        else {
          const q = (p - 0.5) / 0.5;
          fz = -stride / 2 + q * stride;
          lift = Math.sin(q * Math.PI) * 0.08;
        }
        fz *= moving * Math.sign(speed || 1);
        lift *= moving;
      }
      // Foot target relative to the hip, in the body frame.
      const hipY = body.position.y - 0.02;
      const dy = -(hipY - 0.035) + lift;
      const dz = fz + (1 - moving) * 0.02 * Math.sin(t * 0.45 + seedPhase + l.z);
      const [hp, kn] = legIK(dy, dz);
      l.thigh.rotation.x = hp;
      l.shin.rotation.x = kn;
      l.hip.rotation.z = (1 - moving) * 0.02 * Math.sin(t * 0.45 + seedPhase);
    }
    if (armed) {
      const arm = rig.get("armBase");
      arm.rotation.y = Math.sin(t * 0.2 + seedPhase) * 0.5 * (1 - moving);
    }
  });
  const root = a.finish(bodyMaterial(HATCH.fine * 1.4, OBJECT_ID.robot), { width: 0.6, depth: 1.1, height: 0.9 });
  root.userData.armed = armed;
  return root;
}
