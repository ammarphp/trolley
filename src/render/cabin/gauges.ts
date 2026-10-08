/**
 * Analog instruments: speedometer, brake-pipe pressure and the cab clock.
 * The three dial faces share one inked canvas (one draw call); needles are
 * small separate meshes that rotate about each dial's normal.
 */
import * as THREE from "three";
import { Kit, cylinder, lathe, sphere } from "../core/geometry.ts";
import { createInkCanvas } from "../core/ink-material.ts";
import { EYE, panelMatrix } from "./layout.ts";
import { CONDENSED, IDS, SANS, atlasDisc, cabMaterial, cabMesh, mapMaterial, mergeUv } from "./util.ts";

export interface GaugeSpec {
  id: "speed" | "pressure" | "clock";
  x: number;
  along: number;
  r: number;
}

export const GAUGES: GaugeSpec[] = [
  { id: "pressure", x: -0.265, along: 0.44, r: 0.042 },
  { id: "speed", x: -0.085, along: 0.46, r: 0.053 },
  { id: "clock", x: 0, along: 0, r: 0.058 },
];

/** The cab clock hangs from the header at the top-left of the glass, facing the driver. */
export const CLOCK_POS = new THREE.Vector3(-0.585, 1.695, -0.985);
function clockMatrix(): THREE.Matrix4 {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...EYE), CLOCK_POS, new THREE.Vector3(0, 1, 0));
  return m.setPosition(CLOCK_POS);
}

const SWEEP = (270 * Math.PI) / 180;

function drawDial(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, spec: GaugeSpec): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#111";
  ctx.lineCap = "butt";
  // Inner ring.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, R - 10, 0, Math.PI * 2);
  ctx.stroke();

  const tick = (a: number, r0: number, r1: number, w: number) => {
    // a: angle measured clockwise from 12 o'clock.
    const s = Math.sin(a),
      c = -Math.cos(a);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(s * r0, c * r0);
    ctx.lineTo(s * r1, c * r1);
    ctx.stroke();
  };
  const label = (a: number, r: number, s: string, font: string) => {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s, Math.sin(a) * r, -Math.cos(a) * r);
  };
  const dialAngle = (f: number) => -SWEEP / 2 + f * SWEEP;

  if (spec.id === "clock") {
    for (let m = 0; m < 12; m++) tick((m / 12) * Math.PI * 2, R - 24, m % 3 === 0 ? R - 78 : R - 58, m % 3 === 0 ? 18 : 12);
    label(0, R * 0.52, "12", `800 58px ${SANS}`);
    label(Math.PI / 2, R * 0.52, "3", `800 58px ${SANS}`);
    label(Math.PI, R * 0.52, "6", `800 58px ${SANS}`);
    label(Math.PI * 1.5, R * 0.52, "9", `800 58px ${SANS}`);
    label(Math.PI, R * 0.25, "UNIT 4", `700 24px ${CONDENSED}`);
  } else if (spec.id === "speed") {
    const max = 80;
    for (let v = 0; v <= max; v += 10) tick(dialAngle(v / max), R - 22, v % 20 === 0 ? R - 64 : R - 48, v % 20 === 0 ? 13 : 8);
    for (let v = 0; v <= max; v += 20) label(dialAngle(v / max), R - 100, String(v), `800 56px ${SANS}`);
    label(Math.PI, R * 0.34, "km/h", `700 34px ${SANS}`);
    // Limit mark at 60.
    ctx.strokeStyle = "#e00";
    ctx.lineWidth = 14;
    ctx.beginPath();
    const a0 = dialAngle(60 / max) - Math.PI / 2;
    const a1 = dialAngle(1) - Math.PI / 2;
    ctx.arc(0, 0, R - 30, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = "#111";
  } else {
    const max = 10;
    for (let v = 0; v <= max; v += 1) tick(dialAngle(v / max), R - 22, v % 2 === 0 ? R - 62 : R - 46, v % 2 === 0 ? 13 : 8);
    for (let v = 0; v <= max; v += 2) label(dialAngle(v / max), R - 96, String(v), `800 52px ${SANS}`);
    label(Math.PI, R * 0.42, "BRAKE PIPE", `700 26px ${CONDENSED}`);
    label(Math.PI, R * 0.6, "bar", `700 30px ${SANS}`);
    // Working band 4.8–5.2 hatched, danger below 3.5 in red.
    ctx.strokeStyle = "#e00";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, R - 30, dialAngle(0) - Math.PI / 2, dialAngle(0.35) - Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(0, 0, R - 30, dialAngle(0.48) - Math.PI / 2, dialAngle(0.52) - Math.PI / 2);
    ctx.stroke();
  }
  // Maker's line.
  if (spec.id !== "clock") label(0, R * 0.36, "HALDEN", `700 22px ${CONDENSED}`);
  ctx.restore();
}

export interface Gauges {
  meshes: THREE.Object3D[];
  set(speedKmh: number, pressure: number, clock: string): void;
  tick(dt: number, t: number): void;
  /** Bezel geometry for the fittings kit. */
  bezels: THREE.BufferGeometry;
  texture: THREE.Texture;
}

interface Needle {
  pivot: THREE.Object3D;
  value: number;
  target: number;
  vel: number;
}

function needleGeometry(length: number, tail: number, width: number, hub: number): THREE.BufferGeometry {
  const k = new Kit();
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width * 0.18, length);
  shape.lineTo(width * 0.18, length);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width * 0.7, -tail);
  shape.lineTo(-width * 0.7, -tail);
  shape.closePath();
  k.add(new THREE.ExtrudeGeometry(shape, { depth: 0.0015, bevelEnabled: false }), { tone: "solid" });
  k.add(cylinder(hub, hub, 0.004, 16), { tone: "solid", rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.002] });
  k.add(sphere(hub * 0.45, 10, 6), { tone: "paper", position: [0, 0, 0.004], scale: [1, 1, 0.4] });
  return k.build();
}

export function buildGauges(): Gauges {
  const cell = 512;
  const { ctx, texture } = createInkCanvas(cell * 3, cell);
  texture.anisotropy = 8;
  const faces: THREE.BufferGeometry[] = [];
  const bezelKit = new Kit();
  const needles: Record<string, Needle[]> = {};
  const meshes: THREE.Object3D[] = [];
  const needleMat = cabMaterial(IDS.needles);
  const secondMat = cabMaterial(IDS.needles, { vertexInk: false, tone: "paper", accent: "signal", accentAmount: 1 });

  GAUGES.forEach((spec, i) => {
    drawDial(ctx, cell * i + cell / 2, cell / 2, cell / 2 - 4, spec);
    const uv = { u0: i / 3, u1: (i + 1) / 3, v0: 0, v1: 1 };
    const base = spec.id === "clock" ? clockMatrix() : panelMatrix(spec.x, spec.along, 0);
    if (spec.id === "clock") {
      // Clock case: a pressed drum behind the face, and a hanger bar up to the header.
      const R0 = spec.r;
      const drum = lathe(
        [
          [R0 + 0.006, -0.045],
          [R0 + 0.014, -0.03],
          [R0 + 0.015, 0.0],
        ],
        40,
      );
      drum.rotateX(Math.PI / 2);
      bezelKit.add(drum, { tone: "pale", matrix: base });
      bezelKit.add(cylinder(R0 * 0.6, R0 * 0.6, 0.004, 28), { tone: "light", matrix: base.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, -0.046)) });
      const top = new THREE.Vector3(0, R0 + 0.012, -0.022).applyMatrix4(base);
      const hang = new THREE.Vector3(top.x, 1.86, top.z - 0.03);
      bezelKit.add(cylinder(0.006, 0.006, hang.y - top.y, 8), { tone: "light", position: [top.x, (hang.y + top.y) / 2, (top.z + hang.z) / 2], rotation: [0.25, 0, 0] });
      bezelKit.add(sphere(0.011, 10, 8), { tone: "mid", position: [top.x, top.y, top.z] });
    }
    // Face sits recessed in a drawn-steel bezel standing off the panel.
    // Faces stand 8 mm off the panel: clear of the 6 mm fascia plate (no z-fight).
    const faceM = base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.008));
    faces.push(atlasDisc(spec.r, uv, 56, faceM));
    const R = spec.r;
    // Bezel: lathe profile (radius, height) turned about Y, then tipped onto Z.
    // Traversed outside-in so Lathe's normals face out and up.
    const profile: Array<[number, number]> = [
      [R + 0.012, 0.0],
      [R + 0.0115, 0.011],
      [R + 0.009, 0.017],
      [R + 0.004, 0.0185],
      [R - 0.001, 0.016],
    ];
    const bez = lathe(profile, 48);
    bez.rotateX(Math.PI / 2);
    bezelKit.add(bez, { tone: "paper", matrix: base });
    // Inner shadow collar (dark), so the face reads recessed.
    const collar = lathe(
      [
        [R - 0.001, 0.0162],
        [R - 0.0003, 0.008],
      ],
      48,
    );
    collar.rotateX(Math.PI / 2);
    bezelKit.add(collar, { tone: "light", matrix: base });

    const makeNeedle = (len: number, tail: number, w: number, hub: number, z: number, mat: THREE.Material): Needle => {
      const pivot = new THREE.Object3D();
      const m = cabMesh(needleGeometry(len, tail, w, hub), mat, `cab-needle-${spec.id}`);
      m.position.z = z;
      pivot.add(m);
      const holder = new THREE.Object3D();
      holder.matrixAutoUpdate = false;
      holder.matrix.copy(base).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.009));
      holder.add(pivot);
      meshes.push(holder);
      return { pivot, value: 0, target: 0, vel: 0 };
    };
    if (spec.id === "clock") {
      needles.clock = [
        makeNeedle(R * 0.55, R * 0.12, 0.0042, 0.0045, 0, needleMat),
        makeNeedle(R * 0.82, R * 0.14, 0.0032, 0.0038, 0.0016, needleMat),
        makeNeedle(R * 0.86, R * 0.26, 0.0012, 0.0028, 0.0032, secondMat),
      ];
    } else {
      needles[spec.id] = [makeNeedle(R * 0.8, R * 0.2, 0.0036, 0.0055, 0, needleMat)];
    }
  });
  texture.needsUpdate = true;
  const faceMesh = cabMesh(mergeUv(faces), mapMaterial(texture, IDS.instruments), "cab-gauge-faces");
  meshes.push(faceMesh);

  let speed = 0;
  let pressure = 5;
  let clockMin = 6 * 60 + 40;
  let seconds = 0;
  let clockLabel = "";
  const setDial = (n: Needle, f: number) => {
    n.target = -(-SWEEP / 2 + Math.min(1.02, Math.max(-0.02, f)) * SWEEP);
  };
  const api: Gauges = {
    meshes,
    texture,
    bezels: bezelKit.build(),
    set(s, p, clock) {
      speed = s;
      pressure = p;
      const m = /^(\d{1,2}):(\d{2})/.exec(clock);
      if (m && clock !== clockLabel) {
        clockLabel = clock;
        clockMin = Number(m[1]) * 60 + Number(m[2]);
        seconds = 0;
      }
      setDial(needles.speed![0]!, speed / 80);
      setDial(needles.pressure![0]!, pressure / 10);
    },
    tick(dt, t) {
      // Idle life: the speed needle trembles with the track, the pressure
      // needle breathes with the compressor.
      const jitterKmh = speed > 1 ? Math.sin(t * 23.1) * 0.35 + Math.sin(t * 7.3 + 1.2) * 0.5 + Math.sin(t * 61.7) * 0.15 : 0;
      const breathe = Math.sin(t * 0.9) * 0.04 + Math.sin(t * 3.7) * 0.015;
      const sp = needles.speed![0]!;
      const pr = needles.pressure![0]!;
      setDial(sp, (speed + jitterKmh) / 80);
      setDial(pr, (pressure + breathe) / 10);
      for (const n of [sp, pr]) {
        // Damped spring toward target (instrument movement).
        const k = 90,
          c = 14;
        const acc = k * (n.target - n.value) - c * n.vel;
        n.vel += acc * dt;
        n.value += n.vel * dt;
        n.pivot.rotation.z = n.value;
      }
      seconds += dt;
      const [h, mi, se] = needles.clock!;
      const totalMin = clockMin + Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      h!.pivot.rotation.z = -((totalMin / 60) % 12) * (Math.PI / 6);
      mi!.pivot.rotation.z = -(totalMin % 60) * (Math.PI / 30);
      se!.pivot.rotation.z = -sec * (Math.PI / 30);
    },
  };
  // Start needles at rest positions.
  api.set(0, 5, "06:40");
  for (const n of [needles.speed![0]!, needles.pressure![0]!]) {
    n.value = n.target;
    n.pivot.rotation.z = n.value;
  }
  return api;
}
