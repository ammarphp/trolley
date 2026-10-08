/**
 * Radio handset hanging on its hook, with a coiled cord looping down to the
 * set. The handset swings a little with the car's motion; the cord follows by
 * bending its vertices toward the swing, weighted along its length.
 */
import * as THREE from "three";
import { Kit, cylinder, lathe, sphere } from "../core/geometry.ts";
import type { LabelAtlas } from "./labels.ts";
import { IDS, atlasPlane, cabMaterial, cabMesh, capsuleBetween, cylinderBetween, mat4, roundedBox, v3 } from "./util.ts";

export interface HandsetParts {
  group: THREE.Group;
  tick(dt: number, t: number, motion: number): void;
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private base: THREE.CatmullRomCurve3,
    private turns: number,
    private radius: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const p = this.base.getPointAt(t);
    const tan = this.base.getTangentAt(t);
    const ref = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3().crossVectors(tan, ref).normalize();
    const b = new THREE.Vector3().crossVectors(tan, n).normalize();
    const a = t * this.turns * Math.PI * 2;
    // Coils bunch where the cord hangs (middle), stretch near the ends.
    const r = this.radius * (0.85 + 0.15 * Math.sin(Math.PI * t));
    return target.copy(p).addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
  }
}

export function buildHandset(hook: THREE.Vector3, jack: THREE.Vector3, atlas: LabelAtlas, labels: THREE.BufferGeometry[]): HandsetParts {
  const group = new THREE.Group();
  group.name = "cab-handset";

  // Hook bracket on the pillar: a riveted plate and a J of round bar.
  {
    const bk = new Kit();
    const back = hook.clone().add(v3(-0.018, 0.006, -0.02));
    bk.add(roundedBox(0.03, 0.06, 0.006, 0.002), { tone: "light", position: [back.x, back.y, back.z], rotation: [0, 0.78, 0] });
    for (const dy of [-0.02, 0.02]) bk.add(sphere(0.0035, 8, 6), { tone: "mid", position: [back.x + 0.003, back.y + dy, back.z + 0.003] });
    bk.add(cylinderBetween(back.clone().add(v3(0.002, -0.004, 0.002)), hook.clone().add(v3(0, -0.004, 0)), 0.0032, 0.0032, 8), { tone: "paper" });
    bk.add(cylinderBetween(hook.clone().add(v3(0, -0.004, 0)), hook.clone().add(v3(0.004, 0.012, 0.004)), 0.0032, 0.0032, 8), { tone: "paper" });
    group.add(cabMesh(bk.build(), cabMaterial(IDS.handset), "cab-handset-hook"));
  }

  // Pivot at the hook; the handset hangs vertically below it, earpiece up.
  const pivot = new THREE.Group();
  pivot.position.copy(hook);
  group.add(pivot);
  const k = new Kit();
  // Local: handset axis along -Y from the hook. Earpiece at the top, mouthpiece at the bottom.
  const top = v3(0, -0.02, 0.012);
  const bot = v3(0, -0.2, 0.012);
  k.add(capsuleBetween(top, bot, 0.0135, 5, 14), { tone: "deep" });
  // Grip waist.
  k.add(capsuleBetween(v3(0, -0.07, 0.006), v3(0, -0.15, 0.006), 0.0145, 4, 14), { tone: "deep" });
  // Earpiece and mouthpiece cups, facing +X (toward the driver's side of the radio).
  for (const [y, r] of [
    [-0.035, 0.028],
    [-0.187, 0.026],
  ] as Array<[number, number]>) {
    const cup = lathe(
      [
        [0.0, 0.0],
        [r * 0.95, 0.0],
        [r, 0.01],
        [r * 0.92, 0.024],
        [r * 0.6, 0.03],
      ],
      20,
    );
    cup.rotateZ(Math.PI / 2);
    k.add(cup, { tone: "deep", position: [0.028, y, 0.012] });
    // Perforated grille (pale) on the cup face.
    k.add(cylinder(r * 0.78, r * 0.78, 0.002, 20), { tone: "light", position: [0.03, y, 0.012], rotation: [0, 0, Math.PI / 2] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.add(sphere(0.0022, 6, 4), { tone: "solid", position: [0.0315, y + Math.cos(a) * r * 0.45, 0.012 + Math.sin(a) * r * 0.45] });
    }
  }
  // Press-to-talk bar on the spine.
  k.add(roundedBox(0.012, 0.05, 0.012, 0.004), { tone: "light", position: [-0.012, -0.11, 0.012] });
  // Hang loop at the top.
  k.add(new THREE.TorusGeometry(0.009, 0.0028, 6, 16), { tone: "paper", position: [0, -0.004, 0.012], rotation: [0, Math.PI / 2, 0] });
  labels.push(atlasPlane(0.044, 0.012, atlas.rect("handsetTag"), mat4([-0.0005, -0.11, 0.0265])));
  const handset = cabMesh(k.build(), cabMaterial(IDS.handset), "cab-handset");
  // Turn the handset so its broad side faces the driver.
  handset.rotation.y = -0.9;
  pivot.add(handset);

  // Cord: from the handset foot, sagging below the radio, back up to the jack.
  const foot = v3(0, -0.205, 0.012);
  const footWorld = foot.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9).add(hook);
  // The coil loops down in front of the visor lip and back up into its socket.
  const sag = Math.min(footWorld.y, jack.y) - 0.085;
  const base = new THREE.CatmullRomCurve3([
    footWorld,
    footWorld.clone().add(v3(0.012, -0.04, 0.035)),
    v3((footWorld.x + jack.x) / 2 + 0.03, sag, Math.max(footWorld.z, jack.z) + 0.1),
    jack.clone().add(v3(0.012, -0.035, 0.05)),
    jack.clone(),
  ]);
  {
    // Cord socket on the cowl.
    const sk = new Kit();
    sk.add(cylinder(0.011, 0.012, 0.012, 14), { tone: "mid", position: [jack.x, jack.y - 0.002, jack.z] });
    sk.add(cylinder(0.006, 0.006, 0.01, 10), { tone: "dark", position: [jack.x, jack.y + 0.008, jack.z] });
    group.add(cabMesh(sk.build(), cabMaterial(IDS.handset), "cab-handset-socket"));
  }
  const helix = new HelixCurve(base, 34, 0.0068);
  const cordGeo = new THREE.TubeGeometry(helix, 34 * 14, 0.0021, 5, false);
  const cordMat = cabMaterial(IDS.cord, { vertexInk: false, tone: "deep" });
  const cord = cabMesh(cordGeo, cordMat, "cab-handset-cord");
  group.add(cord);
  const pos = cordGeo.getAttribute("position") as THREE.BufferAttribute;
  const rest = new Float32Array(pos.array as Float32Array);
  // Weight: 1 near the handset, 0 at the jack.
  const weight = new Float32Array(pos.count);
  const segs = 34 * 14;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 6);
    const t = ring / segs;
    weight[i] = Math.max(0, 1 - t) ** 1.6;
  }

  let angle = 0;
  let vel = 0;
  let accum = 0;
  const axis = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  return {
    group,
    tick(dt, t, motion) {
      // Pendulum driven by track noise proportional to motion.
      const drive = motion * (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 0.7) * 0.3 + Math.sin(t * 11.1) * 0.12);
      const acc = -38 * angle - 1.6 * vel + drive * 3.2;
      vel += acc * dt;
      angle += vel * dt;
      pivot.rotation.z = angle;
      pivot.rotation.x = angle * 0.4;
      accum += dt;
      if (accum < 1 / 30) return;
      accum = 0;
      // Bend the cord toward the swing.
      for (let i = 0; i < pos.count; i++) {
        const w = weight[i]!;
        tmp.set(rest[i * 3]! - hook.x, rest[i * 3 + 1]! - hook.y, rest[i * 3 + 2]! - hook.z);
        q.setFromAxisAngle(axis, angle * w);
        tmp.applyQuaternion(q);
        pos.setXYZ(i, tmp.x + hook.x, tmp.y + hook.y, tmp.z + hook.z);
      }
      pos.needsUpdate = true;
    },
  };
}
