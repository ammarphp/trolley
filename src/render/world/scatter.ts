/**
 * World scatter: trees, hedges, farms, herds, towns, compute campuses and
 * ruins, spawned in world-anchored cells as the trolley approaches.
 *
 * Each cell reads the environment at the moment it is born, so change arrives
 * with the landscape ahead (the brief's "degrade slowly, noticeably") rather
 * than popping in place. A few channels (leaf cover) also update live.
 * Instanced pools keep repeated prefabs to one draw call per variant.
 */
import * as THREE from "three";
import type { AnimalId, EnvironmentTarget, LandmarkId } from "../api.ts";
import type { AssetProvider, ScatterPrefab } from "../assets.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { createInkMaterial } from "../core/ink-material.ts";
import type { TrackNetwork } from "./track/network.ts";

const CELL = 60;
const RADIUS = 560;

interface PoolKey {
  kind: string;
  variant: number;
  level: number;
}

class Pool {
  readonly mesh: THREE.InstancedMesh;
  private free: number[] = [];
  private used = 0;
  readonly prefab: ScatterPrefab;
  constructor(prefab: ScatterPrefab, capacity: number) {
    this.prefab = prefab;
    const material = createInkMaterial({ ...prefab.material, instanceInk: false });
    this.mesh = new THREE.InstancedMesh(prefab.geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }
  get full(): boolean {
    return this.free.length === 0 && this.used >= this.mesh.instanceMatrix.count;
  }
  add(matrix: THREE.Matrix4): number {
    const i = this.free.length ? this.free.pop()! : this.used++;
    this.mesh.setMatrixAt(i, matrix);
    this.mesh.count = Math.max(this.mesh.count, i + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
    return i;
  }
  remove(i: number): void {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, zero);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.free.push(i);
  }
}

interface CellContent {
  instances: Array<{ pool: Pool; index: number }>;
  objects: THREE.Object3D[];
}

export interface ScatterOptions {
  seed: string;
  assets: AssetProvider;
  heightAt: (x: number, z: number) => number;
}

export class Scatter {
  readonly group = new THREE.Group();
  private cells = new Map<string, CellContent>();
  private pools = new Map<string, Pool[]>();
  private tickers = new Set<THREE.Object3D>();
  private assets: AssetProvider;
  private heightAt: (x: number, z: number) => number;
  private seed: string;
  env: EnvironmentTarget | null = null;
  /** Quality scale for densities (0.4 low .. 1 high). */
  density = 1;

  constructor(options: ScatterOptions) {
    this.assets = options.assets;
    this.heightAt = options.heightAt;
    this.seed = options.seed;
    this.group.name = "scatter";
  }

  setHeight(fn: (x: number, z: number) => number): void {
    this.heightAt = fn;
  }

  private pool(key: PoolKey): Pool | null {
    const id = `${key.kind}:${key.variant}:${key.level}`;
    let list = this.pools.get(id);
    if (!list) {
      const prefab = this.assets.prefab(key.kind, key.variant, { leaves: key.level / 3, vegetation: 1 });
      if (!prefab) {
        this.pools.set(id, []);
        return null;
      }
      list = [new Pool(prefab, 192)];
      this.pools.set(id, list);
      this.group.add(list[0]!.mesh);
    }
    if (!list.length) return null;
    let pool = list.find((p) => !p.full);
    if (!pool) {
      pool = new Pool(list[0]!.prefab, 192);
      list.push(pool);
      this.group.add(pool.mesh);
    }
    return pool;
  }

  private place(content: CellContent, kind: string, variant: number, level: number, x: number, z: number, rot: number, scale: number): void {
    const pool = this.pool({ kind, variant, level });
    if (!pool) return;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, this.heightAt(x, z), z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)),
      new THREE.Vector3(scale, scale, scale),
    );
    content.instances.push({ pool, index: pool.add(m) });
  }

  private placeObject(content: CellContent, object: THREE.Object3D, x: number, z: number, rot: number): void {
    object.position.set(x, this.heightAt(x, z), z);
    object.rotation.y = rot;
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    this.group.add(object);
    content.objects.push(object);
    if (typeof object.userData.tick === "function") this.tickers.add(object);
  }

  private populate(cx: number, cz: number, network: TrackNetwork, env: EnvironmentTarget): CellContent {
    const rng = createRng(`${this.seed}:cell:${cx}:${cz}`);
    const content: CellContent = { instances: [], objects: [] };
    const x0 = cx * CELL;
    const z0 = cz * CELL;
    const clear = (x: number, z: number, r: number) => network.distanceToTrack(x, z, r + 2) > r;
    const leafLevel = Math.round(Math.max(0, Math.min(1, env.leaves)) * 3);
    const d = this.density;

    // Trees: clumps and hedgerow lines; bare or burnt as the world turns.
    const trees = Math.round(rng.range(0, 7) * env.vegetation * (1 - env.uniformity) * d);
    const clumpX = x0 + rng.range(8, CELL - 8);
    const clumpZ = z0 + rng.range(8, CELL - 8);
    for (let i = 0; i < trees; i++) {
      const x = clumpX + rng.gauss() * 9;
      const z = clumpZ + rng.gauss() * 9;
      if (!clear(x, z, 7)) continue;
      const dead = rng.chance(env.ruin * 0.6 + env.drought * 0.3);
      const conifer = !dead && rng.chance(0.22);
      const kind = dead ? "dead-tree" : conifer ? "conifer" : "tree";
      this.place(content, kind, rng.int(0, Math.max(0, this.assets.prefabVariants(kind) - 1)), conifer || dead ? 3 : leafLevel, x, z, rng.range(0, Math.PI * 2), rng.range(0.8, 1.25));
    }
    // Hedgerow along a field edge.
    if (rng.chance(0.35 * env.vegetation * d) && env.uniformity < 0.5) {
      const alongX = rng.chance(0.5);
      for (let t = 0; t < CELL; t += rng.range(2.2, 3.2)) {
        const x = alongX ? x0 + t : x0 + 2;
        const z = alongX ? z0 + 2 : z0 + t;
        if (clear(x, z, 5)) this.place(content, "bush", rng.int(0, Math.max(0, this.assets.prefabVariants("bush") - 1)), leafLevel, x, z, rng.range(0, 6.28), rng.range(0.8, 1.3));
      }
    }
    // Orchard grids for the unnervingly perfect world.
    if (env.uniformity > 0.3 && rng.chance(env.uniformity * 0.6)) {
      for (let i = 0; i < 6; i++)
        for (let k = 0; k < 6; k++) {
          const x = x0 + 6 + i * 9;
          const z = z0 + 6 + k * 9;
          if (clear(x, z, 6)) this.place(content, "orchard-tree", 0, 3, x, z, 0, 1);
        }
    }
    // Rocks and hay.
    for (let i = rng.int(0, 2); i > 0; i--) {
      const x = x0 + rng.range(0, CELL);
      const z = z0 + rng.range(0, CELL);
      if (clear(x, z, 4)) this.place(content, "rock", rng.int(0, 2), 3, x, z, rng.range(0, 6.28), rng.range(0.6, 1.6));
    }
    if (rng.chance(env.bloom * 0.3 * d)) {
      for (let i = rng.int(2, 7); i > 0; i--) {
        const x = x0 + rng.range(5, CELL - 5);
        const z = z0 + rng.range(5, CELL - 5);
        if (clear(x, z, 5)) this.place(content, "hay", rng.int(0, 1), 3, x, z, rng.range(0, 6.28), 1);
      }
    }
    // Farms, towns and the build-out: unique landmark buildings.
    const lx = x0 + rng.range(10, CELL - 10);
    const lz = z0 + rng.range(10, CELL - 10);
    const pick = (): LandmarkId | null => {
      const r = rng.next();
      if (env.perfection > 0.4 && r < env.perfection * 0.1) return "monolith";
      if (env.ruin > 0.35 && r < env.ruin * 0.1) return rng.chance(0.5) ? "ruins" : "crater";
      if (env.fire > 0.2 && r < env.fire * 0.05) return "burning-town";
      if (env.compute > 0.3 && r < env.compute * 0.035) return rng.pick(["data-center", "cooling-tower", "substation", "data-center"] as const);
      if (env.industry > 0.3 && r < env.industry * 0.03) return rng.pick(["factory", "warehouse", "power-station", "wind-turbines", "solar-farm"] as const);
      if (env.surveillance > 0.4 && r < env.surveillance * 0.02) return "antenna-array";
      if (env.habitation > 0.5 && r < env.habitation * 0.05) return rng.pick(["town-houses", "town-houses", "church", "water-tower", "school"] as const);
      if (r < env.habitation * 0.06) return rng.pick(["farmhouse", "barn", "windmill", "farmhouse", "barn"] as const);
      return null;
    };
    const lm = pick();
    if (lm) {
      const big = lm === "data-center" || lm === "cooling-tower" || lm === "power-station" || lm === "solar-farm";
      if (clear(lx, lz, big ? 110 : 30)) {
        const obj = this.assets.landmark(lm, { seed: `${cx}:${cz}`, env });
        this.placeObject(content, obj, lx, lz, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rng.range(-0.2, 0.2));
      }
    }
    // Herds while the land still holds them.
    if (rng.chance(env.fauna * 0.1 * d)) {
      const species: AnimalId = rng.pick(["cow", "cow", "sheep", "horse"] as const);
      const hx = x0 + rng.range(15, CELL - 15);
      const hz = z0 + rng.range(15, CELL - 15);
      if (clear(hx, hz, 22)) {
        const count = rng.int(3, species === "sheep" ? 14 : 8);
        if (this.assets.herd) this.placeObject(content, this.assets.herd(species, { count, seed: `${cx}:${cz}`, radius: 12 }), hx, hz, rng.range(0, 6.28));
        else
          for (let i = 0; i < count; i++)
            this.placeObject(content, this.assets.animal(species, { seed: `${cx}:${cz}:${i}`, behavior: "graze" }), hx + rng.gauss() * 6, hz + rng.gauss() * 6, rng.range(0, 6.28));
      }
    }
    return content;
  }

  update(network: TrackNetwork, rig: THREE.Vector3, env: EnvironmentTarget, dt: number, t: number): void {
    this.env = env;
    const rc = Math.ceil(RADIUS / CELL);
    const ccx = Math.floor(rig.x / CELL);
    const ccz = Math.floor(rig.z / CELL);
    const live = new Set<string>();
    let spawned = 0;
    for (let i = -rc; i <= rc; i++)
      for (let k = -rc; k <= rc; k++) {
        const cx = ccx + i;
        const cz = ccz + k;
        const mx = (cx + 0.5) * CELL - rig.x;
        const mz = (cz + 0.5) * CELL - rig.z;
        if (mx * mx + mz * mz > RADIUS * RADIUS) continue;
        const key = `${cx},${cz}`;
        live.add(key);
        if (!this.cells.has(key) && spawned < 6) {
          this.cells.set(key, this.populate(cx, cz, network, env));
          spawned++;
        }
      }
    for (const [key, content] of this.cells) {
      if (live.has(key)) continue;
      for (const inst of content.instances) inst.pool.remove(inst.index);
      for (const o of content.objects) {
        this.group.remove(o);
        this.tickers.delete(o);
      }
      this.cells.delete(key);
    }
    for (const o of this.tickers) (o.userData.tick as (dt: number, t: number) => void)(dt, t);
  }

  /** Remove everything (e.g. after a stage tunnel, the world is redrawn). */
  clear(): void {
    for (const content of this.cells.values()) {
      for (const inst of content.instances) inst.pool.remove(inst.index);
      for (const o of content.objects) this.group.remove(o);
    }
    this.cells.clear();
    this.tickers.clear();
  }

  /** Drop far cells behind so a changed world can be redrawn ahead sooner. */
  forgetBehind(rig: THREE.Vector3, heading: number): void {
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    for (const [key, content] of this.cells) {
      const [cx, cz] = key.split(",").map(Number) as [number, number];
      const dx = (cx + 0.5) * CELL - rig.x;
      const dz = (cz + 0.5) * CELL - rig.z;
      if (dx * fx + dz * fz < -80) {
        for (const inst of content.instances) inst.pool.remove(inst.index);
        for (const o of content.objects) {
          this.group.remove(o);
          this.tickers.delete(o);
        }
        this.cells.delete(key);
      }
    }
  }
}

export function rngFor(seed: string, label: string): Rng {
  return createRng(`${seed}:${label}`);
}
