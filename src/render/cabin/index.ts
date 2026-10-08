/**
 * THE CAB: the controller's seat in a mid-century tram cab with modern
 * retrofits, drawn as technical pen work. On screen 100% of the time.
 *
 *   const cab = createCabin({ seed: view.seed });
 *   scene.add(cab.group);               // cab-local: floor under the eye, -Z forward
 *   cab.applyCamera(camera);            // or use cab.recommendedCamera(aspect)
 *   // every frame
 *   cab.setLever(target);               // spring-eased, with detents
 *   cab.tick(dt, t);
 *
 * All materials use hatchSpace "view". Cab meshes set userData.noShadow = true:
 * they neither cast nor receive world shadows (hatching comes from N·L).
 */
import * as THREE from "three";
import type { ScreenRect } from "../api.ts";
import { createRng } from "../core/rng.ts";
import { applyCabCamera, projectRect, recommendedCamera, type CabCamera } from "./camera.ts";
import { buildConsole, type Lamp } from "./console.ts";
import { buildGauges } from "./gauges.ts";
import { GRIP_CENTER, GRIP_POSE, KNOB_CONTACT, KNOB_POSE, buildGlove, buildSleeve } from "./hands.ts";
import { buildHandset } from "./handset.ts";
import { buildKeepsake, type KeepsakeKind } from "./keepsake.ts";
import { createLabelAtlas } from "./labels.ts";
import { GLASS, glassPoint } from "./layout.ts";
import { buildLever } from "./lever.ts";
import { buildMirror } from "./mirror.ts";
import { buildShell } from "./shell.ts";
import { buildTerminal, type ScreenState } from "./terminal.ts";
import { IDS, cabMaterial, cabMesh, mapMaterial, mergeUv, mirrorX } from "./util.ts";
import { buildWindshield, type WindshieldApi } from "./windshield.ts";

export type { ScreenState, ScreenMode } from "./terminal.ts";
export type { WindshieldApi, ImpactOptions } from "./windshield.ts";
export type { KeepsakeKind } from "./keepsake.ts";
export type { CabCamera } from "./camera.ts";
export { drawMorrowMark } from "./terminal.ts";
export { drawPlaceholderFace } from "./mirror.ts";
export { EYE as CAB_EYE, BASE_PITCH as CAB_PITCH } from "./layout.ts";

export type Authority = "human" | "delegated" | "overridden";

export interface CabinAnchors {
  lever: ScreenRect;
  mirror: ScreenRect;
  dash: ScreenRect;
  /** Extra: the windshield glass and the terminal screen. */
  windshield: ScreenRect;
  screen: ScreenRect;
  /** Visibility flags for the rects above. */
  visible: { lever: boolean; mirror: boolean; dash: boolean; windshield: boolean; screen: boolean };
}

export interface Cabin {
  /** Cab-local frame. Place it so the floor sits 1.1 m above rail top. */
  readonly group: THREE.Group;
  /** Raycast target for the lever (an invisible proxy around grip and fist). */
  readonly leverHandle: THREE.Object3D;
  /**
   * Target lever value -1 (left) .. 1 (right). The lever eases toward it with
   * a heavy under-damped spring and notch detents. Pass dt to integrate now
   * (tick() then skips the lever that frame); pass dt = 0 to snap.
   */
  setLever(value: number, dt?: number): void;
  /** Displayed (physical) lever value. */
  readonly leverValue: number;
  /** speedKmh (dial 0–80), pressure in bar (dial 0–10, nominal 5), clock "HH:MM". */
  setGauges(g: { speedKmh: number; pressure: number; clock: string }): void;
  readonly screen: { setState(s: ScreenState): void; flashMark(): void };
  printReceipt(text: string): void;
  setMirrorTexture(tex: THREE.Texture): void;
  readonly windshield: WindshieldApi;
  setKeepsake(kind: KeepsakeKind): void;
  setAuthority(a: Authority): void;
  /** Text on the destination blind (seen reversed from inside the cab). */
  setDestination(text: string): void;
  tick(dt: number, t: number): void;
  recommendedCamera(aspect: number): CabCamera;
  /** Position/orient a camera from the cab's world transform and the recommendation. */
  applyCamera(camera: THREE.PerspectiveCamera, aspect?: number): void;
  anchors(camera: THREE.Camera): CabinAnchors;
  dispose(): void;
}

/** Elbows rest out on the armrests, so the forearms fall to the frame corners. */
const RIGHT_ELBOW = new THREE.Vector3(0.52, 0.93, -0.36);
/** Right hand about the crossbar: roll (radians) and a slight diagonal yaw. */
const GRIP_PITCH = 0.68;
const GRIP_YAW = 0.16;
const LEFT_ELBOW = new THREE.Vector3(-0.3, 0.93, -0.33);
const SLEEVE_LEN = 0.3;
const WRIST_IN_HAND = new THREE.Vector3(0, 0, 0.052);

export function createCabin(options: { seed: string }): Cabin {
  const seed = options.seed;
  const rng = createRng(`${seed}:cabin`);
  const group = new THREE.Group();
  group.name = "cabin";
  const labels: THREE.BufferGeometry[] = [];
  const atlas = createLabelAtlas(seed);

  const shell = buildShell(atlas, labels, rng);
  group.add(shell.group);
  const cons = buildConsole(atlas, labels);
  group.add(cons.group);
  const gauges = buildGauges();
  group.add(cabMesh(gauges.bezels, cabMaterial(IDS.fittings), "cab-gauge-bezels"));
  for (const m of gauges.meshes) group.add(m);
  const lever = buildLever(atlas, labels);
  group.add(lever.root);
  const terminal = buildTerminal(atlas, labels, seed);
  group.add(terminal.group);
  const mirror = buildMirror();
  group.add(mirror.group);
  // The handset hangs on a J-hook on the left corner post; its cord drops to the radio.
  const handset = buildHandset(glassPoint(-0.79, -0.13, 0.105), new THREE.Vector3(-0.705, 1.088, -1.0), atlas, labels);
  group.add(handset.group);
  const keepsake = buildKeepsake(cons.cupHolder);
  group.add(keepsake.group);
  const glass = buildWindshield(seed);
  group.add(glass.group);

  // ------------------------------------------------------------- hands
  // Hands and sleeves sit 0.3–0.8 m from the eye: finer view-space periods
  // keep their strokes at the same on-screen density as the dash.
  const gloveMatR = cabMaterial(IDS.gloveR, { hatch: 0.0056, shade: 0.75 });
  const gloveMatL = cabMaterial(IDS.gloveL, { hatch: 0.0056, shade: 0.75 });
  const sleeveMatR = cabMaterial(IDS.sleeveR, { hatch: 0.0046, shade: 0.76 });
  const sleeveMatL = cabMaterial(IDS.sleeveL, { hatch: 0.0046, shade: 0.76 });

  const handR = new THREE.Group();
  handR.name = "cab-hand-right";
  // Overhand on the crossbar: the hand rolls about the bar so the forearm
  // falls back toward the elbow, with a slight diagonal set of the wrist.
  const gripQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(GRIP_PITCH, GRIP_YAW, 0, "YXZ"));
  handR.quaternion.copy(gripQ);
  handR.position.copy(new THREE.Vector3(...GRIP_CENTER).applyQuaternion(gripQ).negate());
  const gloveR = cabMesh(buildGlove(GRIP_POSE), gloveMatR, "cab-glove-right");
  handR.add(gloveR);
  lever.gripFrame.add(handR);

  const sleeveR = cabMesh(buildSleeve(SLEEVE_LEN, { buttonsAngle: 1.9, seed: 1.3 }), sleeveMatR, "cab-sleeve-right");
  group.add(sleeveR);

  const handL = new THREE.Group();
  handL.name = "cab-hand-left";
  {
    const knob = cons.brakeKnob;
    // Palm cupped over the knob, fingers forward and a little inward.
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, -0.22, -0.1, "YXZ"));
    handL.quaternion.copy(q);
    const c = new THREE.Vector3(...KNOB_CONTACT);
    c.x = -c.x;
    handL.position.copy(knob).sub(c.applyQuaternion(q));
  }
  handL.add(cabMesh(mirrorX(buildGlove(KNOB_POSE)), gloveMatL, "cab-glove-left"));
  group.add(handL);
  const sleeveL = cabMesh(mirrorX(buildSleeve(SLEEVE_LEN, { buttonsAngle: 1.9, seed: 2.1 })), sleeveMatL, "cab-sleeve-left");
  group.add(sleeveL);

  const placeSleeve = (sleeve: THREE.Object3D, wrist: THREE.Vector3, elbow: THREE.Vector3, roll: number) => {
    const d = new THREE.Vector3().subVectors(elbow, wrist);
    const len = d.length();
    sleeve.position.copy(wrist);
    const z = d.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const x = new THREE.Vector3().crossVectors(up, z).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    const m = new THREE.Matrix4().makeBasis(x, y, z);
    sleeve.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    sleeve.scale.set(1, 1, len / SLEEVE_LEN);
  };
  const tmpM = new THREE.Matrix4();
  const wristR = new THREE.Vector3();
  const updateRightSleeve = () => {
    // Hand -> gripFrame -> arm -> lever root -> cab.
    lever.root.updateMatrix();
    lever.arm.updateMatrix();
    lever.gripFrame.updateMatrix();
    handR.updateMatrix();
    tmpM.copy(lever.root.matrix).multiply(lever.arm.matrix).multiply(lever.gripFrame.matrix).multiply(handR.matrix);
    wristR.copy(WRIST_IN_HAND).applyMatrix4(tmpM);
    placeSleeve(sleeveR, wristR, RIGHT_ELBOW, 0.35);
  };
  handL.updateMatrix();
  placeSleeve(sleeveL, WRIST_IN_HAND.clone().applyMatrix4(handL.matrix), LEFT_ELBOW, -0.35);

  // ------------------------------------------------------------ labels
  const labelMesh = cabMesh(mergeUv(labels), mapMaterial(atlas.texture, IDS.labels), "cab-labels");
  group.add(labelMesh);

  // ------------------------------------------------------------- state
  let speed = 0;
  let pressure = 5;
  let authority: Authority = "human";
  let screenMode: ScreenState["mode"] = "off";
  let leverStepped = false;
  const lampOn = new Map<Lamp, THREE.Material>();
  const lampOff = cabMaterial(IDS.lamps, { vertexInk: false, tone: "pale" });
  for (const lamp of Object.values(cons.lamps)) {
    lampOn.set(lamp, cabMaterial(IDS.lamps, { vertexInk: false, tone: "paper", accent: lamp.accent, accentAmount: 1, flat: true }));
  }
  const setLamp = (lamp: Lamp, on: boolean) => {
    lamp.mesh.material = on ? lampOn.get(lamp)! : lampOff;
  };

  const cabin: Cabin = {
    group,
    leverHandle: lever.handle,
    get leverValue() {
      return lever.value;
    },
    get windshield() {
      return glass.api;
    },
    screen: {
      setState(s) {
        screenMode = s.mode;
        terminal.screen.setState(s);
      },
      flashMark() {
        terminal.screen.flashMark();
      },
    },
    setLever(value, dt) {
      if (dt === 0) {
        lever.setTarget(value, true);
        updateRightSleeve();
        leverStepped = true;
        return;
      }
      lever.setTarget(value);
      if (dt !== undefined && dt > 0) {
        lever.step(dt);
        updateRightSleeve();
        leverStepped = true;
      }
    },
    setGauges(g) {
      speed = g.speedKmh;
      pressure = g.pressure;
      gauges.set(g.speedKmh, g.pressure, g.clock);
    },
    printReceipt(text) {
      terminal.printReceipt(text);
    },
    setMirrorTexture(tex) {
      mirror.setTexture(tex);
    },
    setKeepsake(kind) {
      keepsake.set(kind);
    },
    setAuthority(a) {
      authority = a;
      lever.setAuthority(a);
    },
    setDestination(text) {
      atlas.setDestination(text);
    },
    tick(dt, t) {
      const h = Math.min(dt, 0.1);
      if (!leverStepped) lever.step(h);
      leverStepped = false;
      updateRightSleeve();
      lever.tick(h, t);
      gauges.tick(h, t);
      terminal.tick(h, t);
      handset.tick(h, t, Math.min(1, speed / 50));
      glass.tick(h, t, speed);
      // Lamps: LINE (amber) = traction current; BRAKE (red) = low pipe or jam;
      // LINK (cobalt) = the assistant is connected.
      const linked = screenMode === "morrow" || authority !== "human";
      setLamp(cons.lamps.line, speed > 0.5);
      const brakeAlarm = pressure < 3.5 || screenMode === "jam";
      setLamp(cons.lamps.brake, brakeAlarm && Math.floor(t * 2.5) % 2 === 0);
      setLamp(cons.lamps.link, linked && (authority !== "delegated" || Math.sin(t * 2.2) > -0.6));
      shell.cameraLed.visible = linked && Math.floor(t * 0.8) % 3 !== 2;
    },
    recommendedCamera(aspect) {
      return recommendedCamera(aspect);
    },
    applyCamera(camera, aspect) {
      applyCabCamera(camera, group, aspect ?? camera.aspect);
    },
    anchors(camera) {
      group.updateWorldMatrix(true, true);
      // Project real vertices of the grip and the fist (a world AABB of a
      // rotated hand balloons toward the camera).
      const leverPts: THREE.Vector3[] = [];
      for (const m of [lever.gripMesh, gloveR]) {
        const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        const step = Math.max(1, Math.floor(pos.count / 200));
        for (let i = 0; i < pos.count; i += step) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i);
          // Grip and fist only: skip the glove's gauntlet (hand-local z > 0).
          if (m === gloveR && v.z > 0.005) continue;
          leverPts.push(v.applyMatrix4(m.matrixWorld));
        }
      }
      const lv = projectRect(leverPts, camera);
      const mr = projectRect(mirror.corners(), camera);
      const dashPts: THREE.Vector3[] = [];
      for (const x of [-0.84, 0.84]) for (const [y, z] of [
        [0.9, -0.55],
        [1.09, -0.97],
      ] as Array<[number, number]>) dashPts.push(new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld));
      const ds = projectRect(dashPts, camera);
      const gl = projectRect(
        [
          glassPoint(-GLASS.halfW, -GLASS.halfH),
          glassPoint(GLASS.halfW, -GLASS.halfH),
          glassPoint(GLASS.halfW, GLASS.halfH),
          glassPoint(-GLASS.halfW, GLASS.halfH),
        ].map((p) => p.applyMatrix4(group.matrixWorld)),
        camera,
      );
      const sc = terminal.screenCenter;
      const scr = projectRect(
        [
          sc.clone().add(new THREE.Vector3(-0.1, -0.07, 0)),
          sc.clone().add(new THREE.Vector3(0.1, 0.07, 0)),
        ].map((p) => p.applyMatrix4(group.matrixWorld)),
        camera,
      );
      const strip = (r: ScreenRect & { visible: boolean }): ScreenRect => ({ x: r.x, y: r.y, width: r.width, height: r.height });
      return {
        lever: strip(lv),
        mirror: strip(mr),
        dash: strip(ds),
        windshield: strip(gl),
        screen: strip(scr),
        visible: { lever: lv.visible, mirror: mr.visible, dash: ds.visible, windshield: gl.visible, screen: scr.visible },
      };
    },
    dispose() {
      // Geometries and the cab's own canvas textures. Materials come from the
      // shared ink-material cache and are left alone.
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      for (const t of [atlas.texture, gauges.texture, mirror.placeholder, ...terminal.textures, ...glass.textures]) t.dispose();
    },
  };

  cabin.setGauges({ speedKmh: 0, pressure: 5, clock: "06:40" });
  cabin.setLever(0, 0);
  return cabin;
}
