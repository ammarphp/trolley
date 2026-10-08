/**
 * THE LEVER. A mid-century points lever on a notched quadrant, retrofitted
 * with a servo clamp. Built in the pivot frame: origin at the pivot, +Y up the
 * shaft at rest, swinging about Z (value -1 = left = +28°).
 */
import * as THREE from "three";
import { Kit, cylinder, lathe, sphere } from "../core/geometry.ts";
import type { LabelAtlas } from "./labels.ts";
import { DESK_TILT, LEVER_GRIP, LEVER_GRIP_R, LEVER_PIVOT, LEVER_SHAFT, LEVER_SWING, deskY } from "./layout.ts";
import { IDS, atlasPlane, cabMaterial, cabMesh, cylinderBetween, mat4, roundedBox, slab, v3 } from "./util.ts";

/** Quadrant end stops, in lever units (1 = the ±28° notch). */
const END_STOP = 1.2;
/** Height of the crossbar above the top of the shaft. */
const GRIP_RISE = 0.034;
const QUAD_R0 = 0.124;
/** Side plates stop short of the rack so its notched edge stands proud. */
const QUAD_R1 = 0.171;
const QUAD_SPAN = 38 * (Math.PI / 180);
const RACK_R0 = 0.168;
const RACK_R1 = 0.19;
const NOTCH_W = 0.015;
const NOTCH_D = 0.013;

function polar(r: number, phi: number): [number, number] {
  // phi measured from +Y toward -X (so +phi leans left, matching rotation.z).
  return [-Math.sin(phi) * r, Math.cos(phi) * r];
}

function sectorOutline(r0: number, r1: number, span: number, steps = 28): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) pts.push(polar(r1, -span + (2 * span * i) / steps));
  for (let i = steps; i >= 0; i--) pts.push(polar(r0, -span + (2 * span * i) / steps));
  return pts;
}

function rackOutline(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const notches = [-LEVER_SWING, 0, LEVER_SWING];
  const steps = 60;
  const half = NOTCH_W / 2 / RACK_R1;
  for (let i = 0; i <= steps; i++) {
    const phi = -QUAD_SPAN + (2 * QUAD_SPAN * i) / steps;
    const inNotch = notches.some((n) => Math.abs(phi - n) < half);
    pts.push(polar(inNotch ? RACK_R1 - NOTCH_D : RACK_R1, phi));
  }
  for (let i = steps; i >= 0; i--) pts.push(polar(RACK_R0, -QUAD_SPAN + (2 * QUAD_SPAN * i) / steps));
  return pts;
}

export interface LeverParts {
  root: THREE.Group;
  arm: THREE.Group;
  /** Raycast proxy around grip and fist (invisible). */
  handle: THREE.Mesh;
  /** Visible grip/knob mesh. */
  gripMesh: THREE.Mesh;
  /** Frame at the grip centre (child of arm): the right hand attaches here. */
  gripFrame: THREE.Object3D;
  /** Displayed value, and spring integration. */
  step(dt: number): void;
  setTarget(v: number, immediate?: boolean): void;
  readonly value: number;
  setAuthority(a: "human" | "delegated" | "overridden"): void;
  tick(dt: number, t: number): void;
}

export function buildLever(atlas: LabelAtlas, labels: THREE.BufferGeometry[]): LeverParts {
  const root = new THREE.Group();
  root.name = "cab-lever";
  root.position.set(...LEVER_PIVOT);
  const pivotY = LEVER_PIVOT[1];
  const pivotZ = LEVER_PIVOT[2];
  const deskAt = deskY(pivotZ) - pivotY; // desk height above the pivot

  // ------------------------------------------------------------ the stand
  const sk = new Kit();
  for (const z of [-0.023, 0.014]) {
    sk.add(slab(sectorOutline(QUAD_R0, QUAD_R1, QUAD_SPAN), 0.009, { z0: z }), { tone: "paper" });
  }
  sk.add(slab(rackOutline(), 0.028, { z0: -0.014 }), { tone: "pale" });
  // Through-bolts along the quadrant.
  for (let i = 0; i <= 6; i++) {
    const phi = -QUAD_SPAN * 0.92 + (QUAD_SPAN * 1.84 * i) / 6;
    const [x, y] = polar((QUAD_R0 + RACK_R0) / 2 + 0.004, phi);
    sk.add(cylinder(0.0052, 0.0052, 0.062, 10), { tone: "light", position: [x, y, -0.004], rotation: [Math.PI / 2, 0, 0] });
    for (const z of [0.028, -0.036]) sk.add(cylinder(0.0075, 0.0075, 0.004, 6), { tone: "mid", position: [x, y, z], rotation: [Math.PI / 2, 0, 0] });
  }
  // Escutcheon on the desk around the slot (cast, dark), with bolts.
  {
    const m = new THREE.Matrix4().makeRotationX(DESK_TILT).setPosition(0, deskAt, 0);
    sk.add(roundedBox(0.36, 0.014, 0.13, 0.006, 2), { tone: "mid", position: [0, 0.006, 0.004], matrix: m });
    // Slot.
    sk.add(roundedBox(0.3, 0.006, 0.03, 0.003), { tone: "solid", position: [0, 0.0135, 0.0], matrix: m });
    for (const [x, z] of [
      [-0.16, -0.045],
      [0.16, -0.045],
      [-0.16, 0.05],
      [0.16, 0.05],
    ] as Array<[number, number]>) {
      sk.add(cylinder(0.0065, 0.0075, 0.006, 6), { tone: "light", position: [x, 0.015, z], matrix: m });
    }
    labels.push(
      atlasPlane(0.2, 0.039, atlas.rect("quadrant"), new THREE.Matrix4().makeRotationX(DESK_TILT - Math.PI / 2).setPosition(v3(0, deskAt + 0.0142, 0.046))),
    );
  }
  // Maker's plate riveted to the front quadrant plate.
  labels.push(atlasPlane(0.07, 0.019, atlas.rect("maker"), mat4([0, 0.158, 0.0235])));
  const stand = cabMesh(sk.build(), cabMaterial(IDS.leverStand), "cab-lever-stand");
  root.add(stand);

  // -------------------------------------------------------------- the arm
  const arm = new THREE.Group();
  arm.name = "cab-lever-arm";
  root.add(arm);
  const ak = new Kit();
  ak.add(cylinder(0.034, 0.034, 0.06, 20), { tone: "light", rotation: [Math.PI / 2, 0, 0] });
  ak.add(roundedBox(0.03, LEVER_SHAFT - 0.02, 0.016, 0.005, 2), { tone: "paper", position: [0, (LEVER_SHAFT - 0.02) / 2 + 0.01, 0] });
  // Taper where the shaft meets the ferrule.
  ak.add(cylinder(0.013, 0.016, 0.02, 14), { tone: "paper", position: [0, LEVER_SHAFT - 0.008, 0] });
  // Catch block riding in the rack notch, and its rod up the front.
  ak.add(roundedBox(0.02, 0.026, 0.046, 0.003), { tone: "light", position: [0, RACK_R1 - NOTCH_D + 0.012, -0.002] });
  ak.add(cylinderBetween(v3(0, RACK_R1 + 0.0, -0.018), v3(0, LEVER_SHAFT + 0.012, -0.018), 0.0035, 0.0035, 8), { tone: "paper" });
  for (const y of [0.225, 0.27]) ak.add(roundedBox(0.034, 0.008, 0.03, 0.002), { tone: "light", position: [0, y, -0.006] });
  // Pointer over the quadrant scale.
  {
    const s = new THREE.Shape();
    s.moveTo(-0.007, 0);
    s.lineTo(0.007, 0);
    s.lineTo(0, -0.016);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false });
    ak.add(g, { tone: "solid", position: [0, RACK_R1 + 0.024, 0.02] });
  }
  // Ferrule collar and grip.
  ak.add(cylinder(0.021, 0.021, 0.012, 20), { tone: "light", position: [0, LEVER_SHAFT + 0.006, 0] });
  const armMesh = cabMesh(ak.build(), cabMaterial(IDS.lever), "cab-lever-shaft");
  arm.add(armMesh);

  // T-handle: a heavy bakelite crossbar across the top of the shaft, gripped
  // overhand, with a catch bail beneath it that the fingers squeeze.
  const gk = new Kit();
  const barY = LEVER_SHAFT + GRIP_RISE;
  {
    // Forged yoke from the ferrule up to the bar.
    gk.add(roundedBox(0.03, GRIP_RISE + 0.004, 0.022, 0.006, 2), { tone: "paper", position: [0, LEVER_SHAFT + GRIP_RISE / 2, 0] });
    gk.add(cylinder(0.02, 0.02, 0.03, 18), { tone: "light", position: [0, barY, 0], rotation: [0, 0, Math.PI / 2] });
    // Crossbar: gently barrelled, with finger scallops underneath.
    const R = LEVER_GRIP_R;
    const half = LEVER_GRIP / 2;
    const prof: Array<[number, number]> = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const ridge = 0.0009 * Math.cos(t * Math.PI * 10);
      prof.push([R * (0.9 + 0.14 * Math.sin(Math.PI * t)) + ridge, -half + t * LEVER_GRIP]);
    }
    const bar = lathe(prof, 22);
    bar.rotateZ(-Math.PI / 2);
    gk.add(bar, { tone: "deep", position: [0, barY, 0] });
    // Ball ends.
    for (const s of [-1, 1]) {
      const ball = sphere(0.021, 18, 12);
      gk.add(ball, { tone: "deep", position: [s * (half + 0.012), barY, 0] });
      gk.add(cylinder(0.0165, 0.0165, 0.006, 18), { tone: "light", position: [s * (half + 0.001), barY, 0], rotation: [0, 0, Math.PI / 2] });
    }
    // Catch bail: a U of round bar hanging under the crossbar, forward of the yoke.
    const bail = new THREE.CatmullRomCurve3([
      v3(-0.036, barY - 0.012, -0.02),
      v3(-0.03, barY - 0.034, -0.026),
      v3(0, barY - 0.04, -0.028),
      v3(0.03, barY - 0.034, -0.026),
      v3(0.036, barY - 0.012, -0.02),
    ]);
    gk.add(new THREE.TubeGeometry(bail, 24, 0.0042, 8, false), { tone: "paper" });
    gk.add(cylinderBetween(v3(0, barY - 0.04, -0.028), v3(0, LEVER_SHAFT - 0.01, -0.018), 0.0035, 0.0035, 8), { tone: "paper" });
  }
  const gripMesh = cabMesh(gk.build(), cabMaterial(IDS.lever), "cab-lever-grip");
  arm.add(gripMesh);

  /** Frame at the crossbar centre, bar along X: the right hand attaches here. */
  const gripFrame = new THREE.Object3D();
  gripFrame.name = "cab-grip-frame";
  gripFrame.position.set(0, barY, 0);
  arm.add(gripFrame);

  const proxy = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.12, 4, 10), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.rotation.z = Math.PI / 2;
  proxy.name = "cab-lever-handle";
  proxy.position.set(0, barY + 0.01, 0.03);
  proxy.userData.noShadow = true;
  proxy.userData.lever = true;
  arm.add(proxy);

  // ----------------------------------------------- servo clamp (retrofit)
  const servo = new THREE.Group();
  servo.name = "cab-servo";
  root.add(servo);
  const vk = new Kit();
  {
    const bx = -0.19,
      bz = 0.0;
    const by = deskAt + 0.001;
    const m = new THREE.Matrix4().makeRotationX(DESK_TILT).setPosition(bx, by, bz);
    vk.add(roundedBox(0.075, 0.065, 0.1, 0.008, 2), { tone: "light", position: [0, 0.0325, 0], matrix: m });
    vk.add(cylinder(0.024, 0.024, 0.06, 18), { tone: "mid", position: [0.0, 0.035, -0.07], rotation: [Math.PI / 2, 0, 0], matrix: m });
    vk.add(cylinder(0.026, 0.026, 0.008, 18), { tone: "dark", position: [0.0, 0.035, -0.1], rotation: [Math.PI / 2, 0, 0], matrix: m });
    // Hazard stripes on the lid: raised bars.
    for (let i = 0; i < 4; i++) vk.add(roundedBox(0.012, 0.004, 0.09, 0.001), { tone: "solid", position: [-0.027 + i * 0.018, 0.066, 0], rotation: [0, 0.5, 0], matrix: m });
    // Output crank boss.
    vk.add(cylinder(0.014, 0.014, 0.02, 14), { tone: "dark", position: [0.042, 0.05, 0.0], rotation: [0, 0, Math.PI / 2], matrix: m });
    // Mounting feet.
    for (const [x, z] of [
      [-0.045, 0.04],
      [-0.045, -0.04],
      [0.045, 0.04],
      [0.045, -0.04],
    ] as Array<[number, number]>) vk.add(cylinder(0.006, 0.007, 0.006, 6), { tone: "mid", position: [x, 0.003, z], matrix: m });
  }
  const servoBody = cabMesh(vk.build(), cabMaterial(IDS.servo), "cab-servo-body");
  servo.add(servoBody);
  const crankPin = v3(-0.19 + 0.052, deskAt + 0.052, 0.006);

  // Jaws on the shaft (children of the arm so they ride with it).
  const jawMat = cabMaterial(IDS.servo);
  const jaws: THREE.Mesh[] = [];
  // The collar closes on the shaft just above the rack: the lever base.
  const clampY = RACK_R1 + 0.024;
  const bandMat = cabMaterial(IDS.servo, { vertexInk: false, tone: "paper", accent: "signal", accentAmount: 1 });
  let band: THREE.Mesh | null = null;
  for (const side of [-1, 1]) {
    const jk = new Kit();
    jk.add(roundedBox(0.066, 0.042, 0.018, 0.005), { tone: "deep" });
    jk.add(roundedBox(0.014, 0.042, 0.026, 0.004), { tone: "dark", position: [-0.033, 0, -side * 0.008] });
    for (const x of [-0.022, 0.022]) jk.add(cylinder(0.0055, 0.0055, 0.022, 10), { tone: "paper", position: [x, 0.0, side * 0.004], rotation: [Math.PI / 2, 0, 0] });
    const jaw = cabMesh(jk.build(), jawMat, "cab-servo-jaw");
    if (side > 0) {
      // Lock band on the driver-facing jaw: shows red once the clamp has closed.
      band = cabMesh(new THREE.BoxGeometry(0.058, 0.011, 0.003), bandMat, "cab-servo-band");
      band.position.set(0, 0, 0.0105);
      jaw.add(band);
    }
    jaw.position.set(0, clampY, side * 0.03);
    jaw.userData.side = side;
    arm.add(jaw);
    jaws.push(jaw);
  }
  const rodMesh = cabMesh(cylinder(0.0042, 0.0042, 1, 8), cabMaterial(IDS.servo, { vertexInk: false, tone: "paper" }), "cab-servo-rod");
  servo.add(rodMesh);
  const ledMatOff = cabMaterial(IDS.lamps, { vertexInk: false, tone: "light", flat: true });
  const ledCobalt = cabMaterial(IDS.lamps, { vertexInk: false, tone: "paper", accent: "cobalt", accentAmount: 1, flat: true });
  const ledRed = cabMaterial(IDS.lamps, { vertexInk: false, tone: "paper", accent: "signal", accentAmount: 1, flat: true });
  const led = cabMesh(new THREE.SphereGeometry(0.0055, 12, 8), ledMatOff, "cab-servo-led");
  {
    const p = new THREE.Vector3(-0.19 - 0.02, deskAt + 0.064, 0.042).applyMatrix4(new THREE.Matrix4());
    led.position.copy(p);
  }
  servo.add(led);

  // ------------------------------------------------------------ dynamics
  let value = 0;
  let vel = 0;
  let target = 0;
  let authority: "human" | "delegated" | "overridden" = "human";
  let clamp = 0; // 0 open .. 1 closed
  let clampTarget = 0;

  const tmpA = new THREE.Vector3();
  const updateRod = () => {
    // Clamp attachment point in root space.
    tmpA.set(-0.03, clampY, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), arm.rotation.z);
    const a = crankPin;
    const b = tmpA;
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    rodMesh.position.copy(a).addScaledVector(d, 0.5);
    rodMesh.scale.set(1, len, 1);
    rodMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };

  const parts: LeverParts = {
    root,
    arm,
    handle: proxy,
    gripMesh,
    gripFrame,
    get value() {
      return value;
    },
    setTarget(v, immediate) {
      target = THREE.MathUtils.clamp(v, -1, 1);
      if (immediate) {
        value = target;
        vel = 0;
        arm.rotation.z = -value * LEVER_SWING;
      }
    },
    step(dt) {
      // Heavy lever: under-damped spring (a full throw peaks in ~0.47 s with
      // ~8% overshoot), a detent "clunk" near the notches, and end stops at
      // the ends of the quadrant that knock the lever back.
      let rem = Math.min(dt, 0.25);
      while (rem > 1e-6) {
        const h = Math.min(rem, 1 / 240);
        const w = 8.5;
        const zeta = 0.62;
        let acc = w * w * (target - value) - 2 * zeta * w * vel;
        for (const n of [-1, 0, 1]) {
          const d = n - value;
          if (Math.abs(d) < 0.08) acc += d * 220 * (1 - Math.abs(d) / 0.08);
        }
        vel += acc * h;
        value += vel * h;
        if (Math.abs(value) > END_STOP) {
          value = Math.sign(value) * END_STOP;
          vel = -vel * 0.25;
        }
        rem -= h;
      }
      arm.rotation.z = -value * LEVER_SWING;
    },
    setAuthority(a) {
      authority = a;
      servo.visible = a !== "human";
      for (const j of jaws) j.visible = a !== "human";
      clampTarget = a === "overridden" ? 1 : 0;
      led.material = a === "overridden" ? ledRed : a === "delegated" ? ledCobalt : ledMatOff;
    },
    tick(dt, t) {
      clamp += (clampTarget - clamp) * Math.min(1, dt * 6);
      for (const j of jaws) {
        const side = j.userData.side as number;
        j.position.z = side * (0.0172 + (1 - clamp) * 0.024);
        j.rotation.y = side * (1 - clamp) * 0.3;
      }
      if (band) band.visible = clamp > 0.85;
      if (authority !== "human") updateRod();
      if (authority === "delegated") led.visible = Math.sin(t * 2.2) > -0.6;
      else led.visible = true;
    },
  };
  parts.setAuthority("human");
  updateRod();
  return parts;
}
