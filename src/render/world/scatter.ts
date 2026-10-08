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
import { createInkMaterial, releaseObject } from "../core/ink-material.ts";
import type { TrackNetwork } from "./track/network.ts";

const CELL = 60;
const RADIUS = 560;

interface PoolKey {
  kind: string;
  variant: number;
  level: number;
}

/**
 * One instanced prefab variant. Slots live on the CPU; each cull pass packs
 * the instances that can be seen (or can throw a shadow into view) into the
 * draw buffer, so a forest behind the cab costs nothing in either pass.
 */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  readonly prefab: ScatterPrefab;
  private matrices: Float32Array;
  private spheres: Float32Array;
  private alive: Uint8Array;
  private free: number[] = [];
  private used = 0;
  /** Beyond this distance the prefab is below the pen's resolution. */
  private readonly maxDistance: number;
  constructor(prefab: ScatterPrefab, private capacity: number) {
    this.prefab = prefab;
    const material = createInkMaterial({ ...prefab.material, instanceInk: false });
    this.mesh = new THREE.InstancedMesh(prefab.geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.matrices = new Float32Array(capacity * 16);
    this.spheres = new Float32Array(capacity * 4);
    this.alive = new Uint8Array(capacity);
    this.maxDistance = Math.min(RADIUS, Math.max(150, prefab.radius * 130));
  }
  get full(): boolean {
    return this.free.length === 0 && this.used >= this.capacity;
  }
  add(matrix: THREE.Matrix4): number {
    const i = this.free.length ? this.free.pop()! : this.used++;
    matrix.toArray(this.matrices, i * 16);
    const e = matrix.elements;
    const scale = Math.hypot(e[0]!, e[1]!, e[2]!);
    const r = Math.max(0.5, this.prefab.radius * scale);
    this.spheres.set([e[12]!, e[13]! + r * 0.8, e[14]!, r * 1.6], i * 4);
    this.alive[i] = 1;
    return i;
  }
  remove(i: number): void {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.free.push(i);
  }
  cull(frustum: THREE.Frustum, ex: number, ez: number, ox: number, oz: number, keepNear: number): void {
    const out = this.mesh.instanceMatrix.array as Float32Array;
    const sphere = Pool.sphere;
    let n = 0;
    for (let i = 0; i < this.used; i++) {
      if (!this.alive[i]) continue;
      const k = i * 4;
      const x = this.spheres[k]!;
      const z = this.spheres[k + 2]!;
      const d2 = (x - ex) ** 2 + (z - ez) ** 2;
      if (d2 > this.maxDistance * this.maxDistance) continue;
      if (d2 > keepNear * keepNear) {
        sphere.center.set(x + ox, this.spheres[k + 1]!, z + oz);
        sphere.radius = this.spheres[k + 3]! + 6;
        if (!frustum.intersectsSphere(sphere)) continue;
      }
      out.set(this.matrices.subarray(i * 16, i * 16 + 16), n * 16);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, n * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  private static sphere = new THREE.Sphere();
}

/** Free what a scenery object put on the GPU (shared prefab geometry is re-uploaded if reused). */
const disposeObject = releaseObject;

interface CellContent {
  instances: Array<{ pool: Pool; index: number; x: number; z: number; clear: number }>;
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
  /** Buildings light their windows at night. */
  night = false;
  private lastNight = false;
  private exclusions = new Set<(x: number, z: number) => boolean>();

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

  private place(content: CellContent, kind: string, variant: number, level: number, x: number, z: number, rot: number, scale: number, clear = 6): void {
    if (this.excluded(x, z)) return;
    const pool = this.pool({ kind, variant, level });
    if (!pool) return;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, this.heightAt(x, z), z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)),
      new THREE.Vector3(scale, scale, scale),
    );
    content.instances.push({ pool, index: pool.add(m), x, z, clear });
  }

  private placeObject(content: CellContent, object: THREE.Object3D, x: number, z: number, rot: number, clear = 24): void {
    if (this.excluded(x, z)) return;
    object.userData.scatterClear = clear;
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
    (object.userData.setNight as ((on: boolean) => void) | undefined)?.(this.night);
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
      const dead = rng.chance(env.ruin * 0.6 + env.drought * 0.3);
      const conifer = !dead && rng.chance(0.22);
      const kind = dead ? "dead-tree" : conifer ? "conifer" : "tree";
      const variant = rng.int(0, Math.max(0, this.assets.prefabVariants(kind) - 1));
      const level = conifer || dead ? 3 : leafLevel;
      const scale = rng.range(0.8, 1.25);
      // Canopies must never overhang the line.
      const radius = (this.assets.prefab(kind, variant, { leaves: level / 3 })?.radius ?? 5) * scale;
      const clearance = radius + 3.5;
      if (!clear(x, z, clearance)) continue;
      this.place(content, kind, variant, level, x, z, rng.range(0, Math.PI * 2), scale, clearance);
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
        this.placeObject(content, obj, lx, lz, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rng.range(-0.2, 0.2), big ? 110 : 30);
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
        disposeObject(o);
      }
      this.cells.delete(key);
    }
    for (const o of this.tickers) (o.userData.tick as (dt: number, t: number) => void)(dt, t);
    if (this.night !== this.lastNight) {
      this.lastNight = this.night;
      for (const content of this.cells.values()) for (const o of content.objects) (o.userData.setNight as ((on: boolean) => void) | undefined)?.(this.night);
    }
  }

  private cullClock = 0;
  private readonly frustum = new THREE.Frustum();
  private readonly viewProj = new THREE.Matrix4();
  private readonly eye = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  /**
   * Pack each pool's visible instances for this view. Run every few frames;
   * the sphere margin covers the camera's movement in between, and anything
   * within `keepNear` metres stays drawn for the shadows it casts into view.
   */
  cullFor(camera: THREE.Camera, dt: number, keepNear = 90): void {
    this.cullClock -= dt;
    if (this.cullClock > 0) return;
    this.cullClock = 0.05;
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    camera.getWorldPosition(this.eye);
    this.group.updateWorldMatrix(true, false);
    this.offset.setFromMatrixPosition(this.group.matrixWorld);
    const ex = this.eye.x - this.offset.x;
    const ez = this.eye.z - this.offset.z;
    for (const list of this.pools.values()) for (const pool of list) pool.cull(this.frustum, ex, ez, this.offset.x, this.offset.z, keepNear);
  }

  /**
   * A fork has been laid out: clear anything now standing in its corridor.
   * Cells were populated before the branches existed.
   */
  cullNear(network: TrackNetwork, x: number, z: number, radius: number): void {
    for (const content of this.cells.values()) {
      content.instances = content.instances.filter((inst) => {
        if ((inst.x - x) ** 2 + (inst.z - z) ** 2 > radius * radius) return true;
        if (network.distanceToTrack(inst.x, inst.z, inst.clear + 2) > inst.clear) return true;
        inst.pool.remove(inst.index);
        return false;
      });
      content.objects = content.objects.filter((o) => {
        const clear = (o.userData.scatterClear as number) ?? 24;
        if ((o.position.x - x) ** 2 + (o.position.z - z) ** 2 > radius * radius) return true;
        if (network.distanceToTrack(o.position.x, o.position.z, clear + 2) > clear) return true;
        this.group.remove(o);
        this.tickers.delete(o);
        disposeObject(o);
        return false;
      });
    }
  }

  /**
   * Keep scenery out of a region (a tunnel's hill): culls what is there now
   * and refuses new placements until the returned function is called.
   */
  exclude(test: (x: number, z: number) => boolean): () => void {
    this.exclusions.add(test);
    for (const content of this.cells.values()) {
      content.instances = content.instances.filter((inst) => {
        if (!test(inst.x, inst.z)) return true;
        inst.pool.remove(inst.index);
        return false;
      });
      content.objects = content.objects.filter((o) => {
        if (!test(o.position.x, o.position.z)) return true;
        this.group.remove(o);
        this.tickers.delete(o);
        disposeObject(o);
        return false;
      });
    }
    return () => this.exclusions.delete(test);
  }

  private excluded(x: number, z: number): boolean {
    for (const test of this.exclusions) if (test(x, z)) return true;
    return false;
  }

  /** Remove everything (e.g. after a stage tunnel, the world is redrawn). */
  clear(): void {
    for (const content of this.cells.values()) {
      for (const inst of content.instances) inst.pool.remove(inst.index);
      for (const o of content.objects) {
        this.group.remove(o);
        disposeObject(o);
      }
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
          disposeObject(o);
        }
        this.cells.delete(key);
      }
    }
  }
}

export function rngFor(seed: string, label: string): Rng {
  return createRng(`${seed}:${label}`);
}
