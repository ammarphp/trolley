/**
 * Falling leaves: one InstancedMesh of small folded leaves tumbling through a
 * box that travels with the camera. Leaves live in world space (so they keep
 * true parallax as the cab moves) and wrap around the box. Wind comes from
 * the shared ink wind uniform, so leaves drift the way the foliage sways.
 */
import * as THREE from "three";
import { INK_GLOBALS, inkMaterial } from "../../core/ink-material.ts";
import { createRng } from "../../core/rng.ts";

export interface LeafFallOptions {
  /** Maximum simultaneous leaves (density 1). */
  max?: number;
  seed?: number | string;
  /** Box size around the camera: width (x), height (y), depth (z). */
  extent?: [number, number, number];
}

export interface LeafFall {
  object: THREE.InstancedMesh;
  /**
   * Advance the fall. `density` 0..1 scales the visible count (0 hides the
   * mesh). `flow` is the world-space velocity of the scenery relative to the
   * world (normally zero: the camera moves, leaves stay in the world).
   */
  update(dt: number, density: number, camera: THREE.Camera, flow?: THREE.Vector3): void;
  dispose(): void;
}

function leafGeometry(): THREE.BufferGeometry {
  // An ovate leaf, 9 cm, folded 25 degrees along the midrib, with a stalk.
  const L = 0.09;
  const W = 0.028;
  const fold = 0.22;
  const tip = new THREE.Vector3(0, 0, L * 0.55);
  const base = new THREE.Vector3(0, 0, -L * 0.45);
  const left = new THREE.Vector3(-W, W * Math.sin(fold), 0.004);
  const right = new THREE.Vector3(W, W * Math.sin(fold), 0.004);
  const leftB = new THREE.Vector3(-W * 0.7, W * 0.7 * Math.sin(fold), -L * 0.25);
  const rightB = new THREE.Vector3(W * 0.7, W * 0.7 * Math.sin(fold), -L * 0.25);
  const stalk = new THREE.Vector3(0.004, 0, -L * 0.7);
  const tris = [base, left, tip, base, tip, right, base, leftB, left, base, right, rightB, base, stalk, new THREE.Vector3(-0.004, 0, -L * 0.45)];
  const arr = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

export function createLeafFall(options: LeafFallOptions = {}): LeafFall {
  const max = options.max ?? 600;
  const [ex, ey, ez] = options.extent ?? [28, 11, 34];
  const rng = createRng(options.seed ?? "nature:leaf-fall");
  const geometry = leafGeometry();
  const tones = new Float32Array(max * 3);
  const TONES = [0.62, 0.8, 1, 0.8];
  for (let i = 0; i < max; i++) tones.set([TONES[i % TONES.length]!, 0, 0], i * 3);
  geometry.setAttribute("inkInstance", new THREE.InstancedBufferAttribute(tones, 3));
  const material = inkMaterial({ instanceInk: true, tone: "deep", side: THREE.DoubleSide, edge: 0.6, hatchSpace: "object", hatch: 0.018, flat: true });
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.frustumCulled = false;
  mesh.name = "nature-leaf-fall";
  mesh.userData.noShadow = true;
  mesh.castShadow = false;
  mesh.count = 0;

  // Per-leaf state: position, fall speed, flutter phase/frequency, tumble axis and rate.
  const pos = new Float32Array(max * 3);
  const fall = new Float32Array(max);
  const phase = new Float32Array(max);
  const freq = new Float32Array(max);
  const axis: THREE.Vector3[] = [];
  const spin = new Float32Array(max);
  const scale = new Float32Array(max);
  for (let i = 0; i < max; i++) {
    fall[i] = rng.range(0.55, 1.25);
    phase[i] = rng.range(0, Math.PI * 2);
    freq[i] = rng.range(1.2, 2.8);
    axis.push(new THREE.Vector3(rng.range(-1, 1), rng.range(-0.3, 0.3), rng.range(-1, 1)).normalize());
    spin[i] = rng.range(2, 6) * (rng.chance(0.5) ? 1 : -1);
    // Drawn a little larger than life (an illustrator's licence) so they read at 5-30 m.
    scale[i] = rng.range(1.3, 2.1);
  }
  let seeded = false;
  let time = 0;
  const centre = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const wrap = (v: number, c: number, size: number) => {
    const lo = c - size / 2;
    return lo + ((((v - lo) % size) + size) % size);
  };

  return {
    object: mesh,
    update(dt, density, camera, flow) {
      const d = Math.max(0, Math.min(1, density));
      const count = Math.round(max * d);
      mesh.visible = count > 0;
      mesh.count = count;
      if (!count) return;
      time += dt;
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      fwd.normalize();
      // Most leaves ahead of the cab, where the eye is.
      centre.copy(camera.position).addScaledVector(fwd, ez * 0.36);
      const groundY = camera.position.y - 2.5;
      if (!seeded) {
        for (let i = 0; i < max; i++) {
          pos[i * 3] = centre.x + rng.range(-ex / 2, ex / 2);
          pos[i * 3 + 1] = groundY + rng.range(0, ey);
          pos[i * 3 + 2] = centre.z + rng.range(-ez / 2, ez / 2);
        }
        seeded = true;
      }
      const wind = INK_GLOBALS.uInkWind.value;
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        const flutter = Math.sin(time * freq[i]! + phase[i]!);
        pos[k] = pos[k]! + (wind.x * 1.6 + flutter * 0.55 + (flow?.x ?? 0)) * dt;
        pos[k + 1] = pos[k + 1]! + (-fall[i]! * (0.75 + 0.35 * Math.abs(flutter)) + (flow?.y ?? 0)) * dt;
        pos[k + 2] = pos[k + 2]! + (wind.y * 1.6 + Math.cos(time * freq[i]! * 0.7 + phase[i]!) * 0.4 + (flow?.z ?? 0)) * dt;
        pos[k] = wrap(pos[k]!, centre.x, ex);
        pos[k + 1] = groundY + ((((pos[k + 1]! - groundY) % ey) + ey) % ey);
        pos[k + 2] = wrap(pos[k + 2]!, centre.z, ez);
        q.setFromAxisAngle(axis[i]!, time * spin[i]! + phase[i]!);
        p.set(pos[k]!, pos[k + 1]!, pos[k + 2]!);
        s.setScalar(scale[i]!);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
    },
  };
}
