/**
 * Lab helpers for ground / sky / weather scenes. Not used by the game.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import { INK_GLOBALS, inkMaterial } from "../../core/ink-material.ts";
import { Kit, block, cylinder } from "../../core/geometry.ts";
import type { LabContext } from "../../lab/types.ts";
import { CAB_EYE, CAB_FOV, GAUGE } from "../../lab/stage-kit.ts";
import { heightAt } from "./height.ts";

export const DEFAULT_ENV: EnvironmentTarget = {
  vegetation: 1,
  leaves: 1,
  bloom: 0.6,
  fauna: 1,
  birds: 1,
  habitation: 0.2,
  people: 0.5,
  industry: 0,
  compute: 0,
  surveillance: 0,
  perfection: 0,
  ruin: 0,
  fire: 0,
  drought: 0,
  cloud: 0.3,
  storm: 0,
  lightning: 0,
  fog: 0.1,
  wind: 0.3,
  timeOfDay: 0.27,
  gloom: 0,
  speed: 0.3,
  water: 1,
  uniformity: 0,
};

export function envOf(patch: Partial<EnvironmentTarget> = {}): EnvironmentTarget {
  return { ...DEFAULT_ENV, ...patch };
}

/** The renderer's lighting and look formulas, mirrored for the lab. */
export function applyLighting(ctx: LabContext, sun: THREE.DirectionalLight, env: EnvironmentTarget, sunDir: THREE.Vector3): void {
  const tod = env.timeOfDay;
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.target.position.set(0, 0, -20);
  sun.position.add(sun.target.position);
  sun.target.updateMatrixWorld();
  if (!sun.target.parent) ctx.scene.add(sun.target);
  const cam = sun.shadow.camera;
  cam.left = -70;
  cam.right = 70;
  cam.top = 70;
  cam.bottom = -70;
  cam.far = 400;
  cam.updateProjectionMatrix();
  const night = THREE.MathUtils.clamp((tod - 0.8) / 0.12, 0, 1);
  const dusk = Math.max(0, 1 - Math.abs(tod - 0.76) / 0.08) * 0.3;
  sun.intensity = 2.2 * (1 - night * 0.8) * (1 - env.storm * 0.55) * (1 - dusk * 0.4);
  ctx.scene.traverse((o) => {
    const h = o as THREE.HemisphereLight;
    if (h.isHemisphereLight) h.intensity = 0.9 * (1 - night * 0.55) * (1 - env.storm * 0.25);
  });
  INK_GLOBALS.uInkGloom.value = env.gloom * 0.6 + Math.max(0, tod - 0.8) * 1.6;
  INK_GLOBALS.uInkWind.value.set(0.4 + env.wind, 0.15 + env.wind * 0.4);
  const look = ctx.pipeline.look;
  look.fogNear = 150 - env.fog * 110;
  look.fogFar = 950 - env.fog * 520 - env.storm * 200;
  look.haze = env.storm * 0.5 + env.fire * 0.2;
}

/**
 * A straight standard-gauge track along -Z, swept every 2 m so the bed,
 * sleepers and rails all follow the ground as the game's track does.
 */
export function groundTrack(length = 600, behind = 30, origin: [number, number] = [0, 0]): THREE.Mesh {
  const k = new Kit();
  const h = (z: number) => heightAt(origin[0], origin[1] + z);
  const profile: Array<[number, number]> = [
    [-2.9, 0],
    [-1.7, 0.32],
    [1.7, 0.32],
    [2.9, 0],
  ];
  const step = 2;
  const pos: number[] = [];
  const idx: number[] = [];
  const rows = Math.ceil((length + behind) / step) + 1;
  for (let i = 0; i < rows; i++) {
    const z = behind - i * step;
    const y0 = h(z);
    for (const [x, y] of profile) pos.push(x, y0 + y - 0.02, z);
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < profile.length - 1; j++) {
      const a = i * profile.length + j;
      const b = a + 1;
      const c = a + profile.length;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const bed = new THREE.BufferGeometry();
  bed.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  bed.setIndex(idx);
  bed.computeVertexNormals();
  k.add(bed, { tone: "pale" });
  for (let z = behind - 0.3; z > -length; z -= 0.62) k.add(block(2.6, 0.16, 0.24), { tone: "light", position: [0, h(z) + 0.3, z] });
  for (let z = behind; z > -length; z -= step) {
    const zc = z - step / 2;
    const y = h(zc) + 0.46;
    for (const x of [-GAUGE / 2, GAUGE / 2]) {
      k.add(block(0.07, 0.15, step + 0.02), { tone: "mid", position: [x, y, zc] });
      k.add(block(0.14, 0.03, step + 0.02), { tone: "mid", position: [x, y, zc] });
    }
  }
  // Flat-shaded: a neutral stand-in so the lab judges the ground, not the track.
  const material = inkMaterial({ vertexInk: true, hatch: 0.06, flat: true });
  // The bed is an open surface: render its front faces into the shadow map,
  // or the default back-face pass casts a false shadow on the sunny side.
  material.shadowSide = THREE.FrontSide;
  return new THREE.Mesh(k.build(), material);
}

/** Telegraph poles with sagging wires beside the line: scale and rhythm. */
export function telegraphPoles(x: number, from: number, to: number, gap = 48, origin: [number, number] = [0, 0]): THREE.Group {
  const k = new Kit();
  const wires = new Kit();
  const tops: THREE.Vector3[] = [];
  for (let z = from; z > to; z -= gap) {
    const y0 = heightAt(x + origin[0], z + origin[1]);
    k.add(cylinder(0.11, 0.15, 7.6, 7), { tone: "mid", position: [x, y0 + 3.8, z] });
    k.add(block(1.6, 0.12, 0.12), { tone: "dark", position: [x, y0 + 7.0, z] });
    k.add(block(1.1, 0.1, 0.1), { tone: "dark", position: [x, y0 + 6.5, z] });
    tops.push(new THREE.Vector3(x, y0 + 7.12, z));
  }
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i]!;
    const b = tops[i + 1]!;
    for (const dx of [-0.7, 0.7]) {
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        pts.push(new THREE.Vector3(a.x + dx, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.55, a.z + (b.z - a.z) * t));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      wires.add(new THREE.TubeGeometry(curve, 10, 0.018, 3, false), { tone: "solid" });
    }
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.05 })));
  const w = new THREE.Mesh(wires.build(), inkMaterial({ vertexInk: true, hatch: 0.05 }));
  w.castShadow = false;
  w.userData.castShadow = false;
  group.add(w);
  return group;
}

/** Standard cab-eye view with the camera clip range the renderer uses. */
export function cabView(ctx: LabContext, lookY = 1.6, origin: [number, number] = [0, 0]): void {
  const y0 = heightAt(CAB_EYE[0] + origin[0], CAB_EYE[2] + origin[1]);
  ctx.view([CAB_EYE[0], CAB_EYE[1] + y0, CAB_EYE[2]], [0, lookY + heightAt(origin[0], origin[1] - 60), -60], CAB_FOV);
  ctx.camera.near = 0.05;
  ctx.camera.far = 1600;
  ctx.camera.updateProjectionMatrix();
}

/** Count triangles and draw calls under an object (visible meshes only). */
export function budget(root: THREE.Object3D): { triangles: number; draws: number } {
  let triangles = 0;
  let draws = 0;
  root.traverseVisible((o) => {
    const m = o as THREE.Mesh | THREE.LineSegments;
    if (!(m as THREE.Mesh).isMesh && !(m as THREE.LineSegments).isLineSegments) return;
    const g = m.geometry as THREE.BufferGeometry;
    const n = g.index ? g.index.count : g.getAttribute("position").count;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    triangles += ((m as THREE.LineSegments).isLineSegments ? n / 2 : n / 3) * inst;
    draws += 1;
  });
  return { triangles: Math.round(triangles), draws };
}
