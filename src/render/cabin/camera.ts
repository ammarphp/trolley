/**
 * Camera framing for the cab at any aspect ratio, and screen anchors for the
 * DOM layer (normalised 0..1, origin top-left).
 */
import * as THREE from "three";
import type { ScreenRect } from "../api.ts";
import { BASE_PITCH, DEG, EYE } from "./layout.ts";

export interface CabCamera {
  /** Vertical field of view, degrees (three.js convention). */
  fov: number;
  /** Cab-local camera position. */
  position: THREE.Vector3;
  /** Pitch in radians (negative looks down). Yaw and roll are zero. */
  pitch: number;
}

/**
 * Presets by aspect (width / height). Wide screens sit exactly at the eye;
 * narrower ones lean back and toward the lever so it stays in frame, and
 * portrait trades cab for windshield (the lever handle stays at the right
 * edge; the mirror leaves the frame).
 */
const PRESETS: Array<{ aspect: number; fov: number; pos: [number, number, number]; pitch: number }> = [
  { aspect: 0.5625, fov: 48, pos: [0.31, EYE[1] + 0.04, 0.2], pitch: -6 * DEG },
  { aspect: 0.75, fov: 54, pos: [0.22, EYE[1] + 0.03, 0.18], pitch: -4.5 * DEG },
  { aspect: 1.0, fov: 62, pos: [0.08, EYE[1] + 0.02, 0.16], pitch: -3.5 * DEG },
  { aspect: 4 / 3, fov: 66, pos: [0.015, EYE[1] + 0.01, 0.14], pitch: BASE_PITCH },
  { aspect: 1.6, fov: 62.5, pos: [0, EYE[1], 0.04], pitch: BASE_PITCH },
  { aspect: 16 / 9, fov: 61, pos: [0, EYE[1], 0], pitch: BASE_PITCH },
  { aspect: 2.4, fov: 52, pos: [0, EYE[1], 0], pitch: BASE_PITCH },
];

export function recommendedCamera(aspect: number): CabCamera {
  const a = THREE.MathUtils.clamp(aspect, PRESETS[0]!.aspect, PRESETS[PRESETS.length - 1]!.aspect);
  let i = 0;
  while (i < PRESETS.length - 2 && a > PRESETS[i + 1]!.aspect) i++;
  const p0 = PRESETS[i]!,
    p1 = PRESETS[i + 1]!;
  const t = (a - p0.aspect) / (p1.aspect - p0.aspect);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    fov: lerp(p0.fov, p1.fov),
    position: new THREE.Vector3(lerp(p0.pos[0], p1.pos[0]), lerp(p0.pos[1], p1.pos[1]), lerp(p0.pos[2], p1.pos[2])),
    pitch: lerp(p0.pitch, p1.pitch),
  };
}

/**
 * Place a perspective camera for the cab: position and orientation follow the
 * cab group's world transform, so a moving/swaying cab carries the camera.
 */
export function applyCabCamera(camera: THREE.PerspectiveCamera, cab: THREE.Object3D, aspect = camera.aspect): void {
  const rec = recommendedCamera(aspect);
  cab.updateWorldMatrix(true, false);
  const local = new THREE.Matrix4().compose(rec.position, new THREE.Quaternion().setFromEuler(new THREE.Euler(rec.pitch, 0, 0, "YXZ")), new THREE.Vector3(1, 1, 1));
  const world = new THREE.Matrix4().multiplyMatrices(cab.matrixWorld, local);
  world.decompose(camera.position, camera.quaternion, new THREE.Vector3());
  camera.fov = rec.fov;
  camera.aspect = aspect;
  camera.near = Math.min(camera.near, 0.04);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

const tmp = new THREE.Vector3();

/** Project world points to a normalised rect; hidden when all are behind the camera. */
export function projectRect(points: THREE.Vector3[], camera: THREE.Camera): ScreenRect & { visible: boolean } {
  camera.updateMatrixWorld();
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  let any = false;
  const view = camera.matrixWorldInverse;
  for (const p of points) {
    tmp.copy(p).applyMatrix4(view);
    if (tmp.z > -0.01) continue;
    tmp.copy(p).project(camera);
    any = true;
    const x = (tmp.x + 1) / 2,
      y = (1 - tmp.y) / 2;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (!any) return { x: 0, y: 0, width: 0, height: 0, visible: false };
  const cx0 = THREE.MathUtils.clamp(x0, 0, 1),
    cy0 = THREE.MathUtils.clamp(y0, 0, 1);
  const cx1 = THREE.MathUtils.clamp(x1, 0, 1),
    cy1 = THREE.MathUtils.clamp(y1, 0, 1);
  const visible = cx1 > cx0 && cy1 > cy0;
  return { x: cx0, y: cy0, width: Math.max(0, cx1 - cx0), height: Math.max(0, cy1 - cy0), visible };
}

export function boxCorners(box: THREE.Box3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}
