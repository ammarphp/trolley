/**
 * Where the light comes from.
 *
 * The sky draws its sun (or, at night, its moon) wherever the scene's key
 * DirectionalLight actually is, so the disc and the shadows always agree.
 * `sunDirection` is the composed day this module would choose on its own:
 * the track heads -Z (north); the sun rises front-right, swings behind the
 * cab through the day and sets front-left, so dawn and dusk put the disc in
 * the frame and noon keeps it out of the player's eyes.
 */
import * as THREE from "three";

const DEG = Math.PI / 180;

/** Night amount for a timeOfDay (0 = pre-dawn, 0.25 morning, 0.5 noon, 0.75 dusk, 1 night). */
export function nightAmount(timeOfDay: number): number {
  const late = THREE.MathUtils.smoothstep(timeOfDay, 0.8, 0.93);
  const early = 1 - THREE.MathUtils.smoothstep(timeOfDay, 0.04, 0.16);
  return Math.max(late, early * 0.7);
}

/** Unit vector toward the sun for a timeOfDay (world, Y up, forward -Z). */
export function sunDirection(timeOfDay: number, out = new THREE.Vector3()): THREE.Vector3 {
  const s = (timeOfDay - 0.18) / 0.62; // 0 at sunrise, 1 at sunset
  const az = (38 + 290 * THREE.MathUtils.clamp(s, -0.3, 1.3)) * DEG; // clockwise from -Z toward +X
  let el: number;
  if (s >= 0 && s <= 1) el = 62 * Math.sin(Math.PI * s);
  else el = -Math.min(35, Math.abs(s < 0 ? s : s - 1) * 110);
  const e = el * DEG;
  return out.set(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)).normalize();
}

/** The first shadow-casting (else any) DirectionalLight under root. */
export function findKeyLight(root: THREE.Object3D): THREE.DirectionalLight | null {
  let best: THREE.DirectionalLight | null = null;
  root.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (!l.isDirectionalLight) return;
    if (!best || (l.castShadow && !best.castShadow)) best = l;
  });
  return best;
}

const a = new THREE.Vector3();
const b = new THREE.Vector3();
/** World direction toward a DirectionalLight (from its target to it). */
export function lightDirection(light: THREE.DirectionalLight, out = new THREE.Vector3()): THREE.Vector3 {
  light.updateWorldMatrix(true, false);
  light.target.updateWorldMatrix(true, false);
  light.getWorldPosition(a);
  light.target.getWorldPosition(b);
  out.subVectors(a, b);
  if (out.lengthSq() < 1e-8) out.set(0, 1, 0);
  return out.normalize();
}
