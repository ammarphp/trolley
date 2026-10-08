/**
 * River crossings: a river laid across the line ahead and a bridge that
 * carries the track over it. The river runs out to either side and bends away
 * behind the crossing, so it never meets the fork beyond; an arm that would
 * meet another drawn line stops short of it. Bridge and water rise out of the
 * ground as the line is drawn, rather than appearing at once.
 *
 * The water is level with the fields, so only what stands above the deck
 * reads: a through truss, plate girders, or a viaduct's parapets.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../api.ts";
import type { AssetProvider } from "../assets.ts";
import { createInkMaterial } from "../core/ink-material.ts";
import { createRng } from "../core/rng.ts";
import type { TrackLine } from "./track/path.ts";

export interface RiverCrossing {
  line: TrackLine;
  s: number;
  /** Half the bridge's length along the line. */
  half: number;
  covers(x: number, z: number): boolean;
  tick(dt: number, env: EnvironmentTarget, rig: THREE.Vector3, camera: THREE.Camera): void;
  dispose(): void;
}

const RISE = 1.5;
const BANK = 5;

export function buildRiverCrossing(
  parent: THREE.Object3D,
  drawnNear: (x: number, z: number, r: number) => boolean,
  line: TrackLine,
  s: number,
  assets: AssetProvider,
  heightAt: (x: number, z: number) => number,
  seed: string,
  env: Partial<EnvironmentTarget>,
  force: { variant?: number; width?: number } = {},
): RiverCrossing | null {
  if (!assets.river || !assets.bridge) return null;
  const rng = createRng(`${seed}:river:${Math.round(s)}`);
  const width = force.width ?? rng.range(13, 22);
  line.extendTo(s + 80);
  const c = line.pose(s);
  const lat = new THREE.Vector2(Math.cos(c.heading), Math.sin(c.heading));
  const back = new THREE.Vector2(-Math.sin(c.heading), Math.cos(c.heading));
  const phase = rng.range(0, Math.PI * 2);
  const bendL = rng.range(0.1, 0.2);
  const bendR = rng.range(0.1, 0.2);
  const point = (l: number): [number, number] => {
    const bend = (l < 0 ? bendL : bendR) * (Math.sqrt(l * l + 1600) - 40);
    const wiggle = 9 * Math.sin(l / 53 + phase) * Math.min(1, Math.abs(l) / 80);
    return [c.x + lat.x * l + back.x * (bend + wiggle), c.z + lat.y * l + back.y * (bend + wiggle)];
  };
  // Walk each arm outward until it would meet another line.
  const clearance = width / 2 + BANK + 4;
  const arm = (dir: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let l = 20; l <= 560; l += 20) {
      const p = point(dir * l);
      if (l >= 40 && drawnNear(p[0], p[1], clearance)) break;
      pts.push(p);
    }
    return pts;
  };
  const left = arm(-1);
  const right = arm(1);
  if (left.length < 8 || right.length < 8) return null;
  const points = [...left.reverse(), point(0), ...right];

  const river = assets.river({ points, width, bank: BANK });
  if (!river) return null;
  parent.add(river.object);

  // A truss over wide water, plate girders over narrow, now and then a viaduct.
  const variant = force.variant ?? (width > 18 ? 1 : rng.chance(0.25) ? 0 : 2);
  const bridge = assets.bridge({ seed: `${seed}:bridge:${Math.round(s)}`, env: { ...env, ruin: 0 }, variant });
  const spec = bridge.userData.bridge as { length: number; deckHeight: number } | undefined;
  const deck = spec?.deckHeight ?? 6;
  const half = (spec?.length ?? 50) / 2;
  const groundY = heightAt(c.x, c.z);
  const deckY = groundY + 0.26 - deck;
  bridge.position.set(c.x, deckY - 8, c.z);
  bridge.rotation.y = -c.heading;
  bridge.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  parent.add(bridge);

  // Reeds along both waterlines and the odd willow on the banks: from the
  // cab, the vegetation is what says "river" before the water does.
  const dressing: THREE.InstancedMesh[] = [];
  const picks = new Map<string, THREE.Matrix4[]>();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const put = (kind: string, x: number, z: number, scale: number) => {
    const variants = assets.prefabVariants(kind);
    if (!variants) return;
    const key = `${kind}:${rng.int(0, variants - 1)}`;
    q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
    m4.compose(new THREE.Vector3(x, heightAt(x, z) + 0.1, z), q, new THREE.Vector3(scale, scale, scale));
    const list = picks.get(key) ?? [];
    list.push(m4.clone());
    picks.set(key, list);
  };
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]!;
    const [bx, bz] = points[i]!;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let d = 0; d < len; d += 3.2) {
      const x = ax + ((bx - ax) * d) / len;
      const z = az + ((bz - az) * d) / len;
      // Leave the bridge and the line clear.
      if (Math.hypot(x - c.x, z - c.z) < 16) continue;
      for (const side of [-1, 1]) {
        if (rng.chance(0.55)) {
          const off = side * (width / 2 + rng.range(-0.6, 1.4));
          put("reeds", x + nx * off, z + nz * off, rng.range(0.8, 1.3));
        }
        if (rng.chance(0.035)) {
          const off = side * (width / 2 + BANK + rng.range(2, 7));
          put(rng.chance(0.7) ? "willow" : "poplar", x + nx * off, z + nz * off, rng.range(0.85, 1.2));
        }
      }
    }
  }
  for (const [key, list] of picks) {
    const [kind, v] = key.split(":");
    const prefab = assets.prefab(kind!, Number(v), { leaves: env.leaves ?? 1, vegetation: 1 });
    if (!prefab) continue;
    const mesh = new THREE.InstancedMesh(prefab.geometry, createInkMaterial({ ...prefab.material, instanceInk: false }), list.length);
    list.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    parent.add(mesh);
    dressing.push(mesh);
  }

  const segs = points.slice(1).map((b, i) => [points[i]!, b] as const);
  const near = (x: number, z: number, r: number) => {
    for (const [a, b] of segs) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < r) return true;
    }
    return false;
  };
  let age = 0;
  return {
    line,
    s,
    half,
    covers: (x, z) => near(x, z, width / 2 + BANK + 3),
    tick(dt, e, rig, camera) {
      river.update(dt, e, rig, camera);
      if (age < RISE) {
        age = Math.min(RISE, age + dt);
        const k = 1 - (1 - age / RISE) ** 3;
        bridge.position.y = deckY - 8 * (1 - k);
        river.object.position.y = -0.8 * (1 - k);
        for (const mesh of dressing) mesh.position.y = -3 * (1 - k);
      }
    },
    dispose() {
      river.object.removeFromParent();
      river.dispose();
      bridge.removeFromParent();
      bridge.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      for (const mesh of dressing) {
        mesh.removeFromParent();
        (mesh.material as THREE.Material).dispose();
        mesh.dispose();
      }
    },
  };
}
