/**
 * Fauna seen from the cab: pastoral herds and a murmuration, the drought
 * field, the storm stampede, and the dark stage's crows. Scenery borrows the
 * nature kit so animals are judged in context, at the distances the player
 * actually sees them.
 */
import * as THREE from "three";
import type { LabContext, LabScene } from "../../lab/types.ts";
import { CAB_EYE, CAB_FOV, inSituStage } from "../../lab/stage-kit.ts";
import { INK_GLOBALS, inkMaterial } from "../../core/ink-material.ts";
import { createRng } from "../../core/rng.ts";
import { buildPrefab } from "../../world/nature/index.ts";
import { createAnimal, createFlock, createHerd, type AnimalUserData, type HerdUserData } from "./index.ts";

type Tickable = { tick: (dt: number, t: number) => void };

function widenShadows(ctx: LabContext, half: number, centre: [number, number, number], mapSize = 4096): void {
  ctx.scene.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (!l.isDirectionalLight) return;
    const dir = l.position.clone().normalize();
    l.target.position.set(...centre);
    ctx.scene.add(l.target);
    l.position.copy(new THREE.Vector3(...centre).addScaledVector(dir, 220));
    const cam = l.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 500;
    cam.updateProjectionMatrix();
    l.shadow.mapSize.set(mapSize, mapSize);
    l.shadow.bias = -0.0005;
  });
}

/** Place instanced-style copies of a nature prefab (plain meshes are fine in the lab). */
function prefab(ctx: LabContext, id: string, variant: number, at: [number, number, number], rot = 0, scale = 1, leaves = 1): THREE.Mesh {
  const p = buildPrefab(id, variant, { leaves });
  const m = new THREE.Mesh(p.geometry, inkMaterial(p.material));
  m.position.set(...at);
  m.rotation.y = rot;
  m.scale.setScalar(scale);
  ctx.scene.add(m);
  return m;
}

/** Lay a fence prefab along z; returns its height and the tops of its posts (world). */
function fenceLine(ctx: LabContext, id: string, x: number, z0: number, z1: number, y = 0): { height: number; posts: THREE.Vector3[] } {
  const p = buildPrefab(id, 0);
  const tile = p.tile ?? 2.4;
  // Post tops in the prefab's frame: clusters of the highest vertices.
  const pos = p.geometry.getAttribute("position") as THREE.BufferAttribute;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const tops = new Map<number, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < maxY - 0.03) continue;
    const key = Math.round(pos.getX(i) * 5);
    const v = tops.get(key) ?? new THREE.Vector3(pos.getX(i), maxY, pos.getZ(i));
    tops.set(key, v);
  }
  const posts: THREE.Vector3[] = [];
  for (let z = z0; z > z1; z -= tile) {
    const m = new THREE.Mesh(p.geometry, inkMaterial(p.material));
    m.position.set(x, y, z - tile / 2);
    m.rotation.y = Math.PI / 2;
    ctx.scene.add(m);
    // Rotation by +90 degrees about y maps (x, y, z) to (z, y, -x).
    for (const t of tops.values()) posts.push(new THREE.Vector3(m.position.x + t.z, y + t.y, m.position.z - t.x));
  }
  return { height: p.height, posts };
}

/** A soft hill: returns its height function (world space) and adds the mesh. */
function hill(ctx: LabContext, cx: number, cz: number, rx: number, rz: number, h: number): (x: number, z: number) => number {
  const f = (x: number, z: number) => h * Math.exp(-(((x - cx) / rx) ** 2) - (((z - cz) / rz) ** 2));
  const g = new THREE.PlaneGeometry(rx * 4, rz * 4, 90, 90);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx,
      z = pos.getZ(i) + cz;
    pos.setXYZ(i, x, f(x, z) - 0.02, z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, inkMaterial({ tone: 0.03, hatch: 0.2, edge: 0.35 }));
  m.receiveShadow = true;
  ctx.scene.add(m);
  return f;
}

function scatterGrass(ctx: LabContext, seed: string, n: number, area: [number, number, number, number], heightAt?: (x: number, z: number) => number): void {
  const rng = createRng(seed);
  const p = buildPrefab("grass-tuft", 0);
  const mesh = new THREE.InstancedMesh(p.geometry, inkMaterial(p.material), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = rng.range(area[0], area[1]);
    const z = rng.range(area[2], area[3]);
    if (Math.abs(x) < 3.2) continue;
    m.compose(new THREE.Vector3(x, heightAt ? heightAt(x, z) : 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0)), new THREE.Vector3().setScalar(rng.range(0.7, 1.4)));
    mesh.setMatrixAt(i, m);
  }
  mesh.userData.noShadow = true;
  ctx.scene.add(mesh);
}

function run(ctx: LabContext, items: Tickable[]): void {
  ctx.onFrame((dt, t) => {
    for (const it of items) it.tick(dt, t);
  });
}

function countFauna(ctx: LabContext, extra: string): void {
  let done = false;
  ctx.onFrame(() => {
    if (done) return;
    done = true;
    let meshes = 0,
      tris = 0,
      birds = 0;
    ctx.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh && m.userData.fauna) {
        meshes++;
        tris += (m.geometry.index?.count ?? 0) / 3;
      }
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh && o.parent?.name.startsWith("flock:")) birds += im.count;
    });
    ctx.caption(`${extra} - animals: ${meshes} skinned meshes, ${Math.round(tris).toLocaleString()} tris; flock birds drawn: ${birds}`);
  });
}

export const scenes: LabScene[] = [
  {
    name: "fauna-storm",
    description: "Storm: a herd bolting across the field, horses wheeling, sheep bunched and running (env.storm = 0.9).",
    build(ctx) {
      inSituStage(ctx, { sun: [50, 35, 5] });
      widenShadows(ctx, 110, [0, 0, -60]);
      INK_GLOBALS.uInkGloom.value = Number(ctx.params.gloom ?? 0.18);
      INK_GLOBALS.uInkTension.value = 0.3;
      ctx.pipeline.look.haze = Number(ctx.params.haze ?? 0.32);
      const cab = new THREE.Vector3(...CAB_EYE);
      const env = { storm: 0.9, wind: 1 };
      fenceLine(ctx, "fence-rail", -7.5, -4, -150);
      fenceLine(ctx, "fence-rail", 7.5, -4, -150);
      scatterGrass(ctx, "storm", 900, [-90, 90, -170, -8]);
      const items: Tickable[] = [];
      const cows = createHerd({ species: "cow", count: 14, seed: "storm-cows", radius: 12, env, lookAt: cab });
      cows.position.set(-28, 0, -50);
      ctx.scene.add(cows);
      items.push(cows.userData as unknown as HerdUserData);
      const horses = createHerd({ species: "horse", count: 5, seed: "storm-horses", radius: 8, env, lookAt: cab });
      horses.position.set(30, 0, -42);
      ctx.scene.add(horses);
      items.push(horses.userData as unknown as HerdUserData);
      const sheep = createHerd({ species: "sheep", count: 22, seed: "storm-sheep", radius: 9, env, lookAt: cab });
      sheep.position.set(34, 0, -95);
      ctx.scene.add(sheep);
      items.push(sheep.userData as unknown as HerdUserData);
      const crows = createFlock({ kind: "crows", count: 10, seed: "storm" });
      crows.setViewer(ctx.camera.position);
      ctx.scene.add(crows.object);
      const c = new THREE.Vector3(10, 26, -80);
      items.push({ tick: (dt, t) => crows.update(dt, t, c) });
      // Thunder: the whole field startles away from the line at `bolt` seconds.
      const bolt = Number(ctx.params.bolt ?? 3);
      let fired = false;
      items.push({
        tick: (_dt, t) => {
          if (fired || t < bolt) return;
          fired = true;
          for (const h of [cows, horses, sheep]) {
            const away = h.position.clone().setY(0).normalize();
            (h.userData as unknown as HerdUserData).react("flinch", away.multiplyScalar(-1));
          }
        },
      });
      run(ctx, items);
      const cam = (ctx.params.cam as [number, number, number] | undefined) ?? CAB_EYE;
      const look = (ctx.params.look as [number, number, number] | undefined) ?? [0, 3.5, -60];
      ctx.view(cam, look, Number(ctx.params.fov ?? CAB_FOV));
      countFauna(ctx, "storm");
    },
  },
  {
    name: "fauna-pastoral",
    description: "Cab view: Holsteins grazing 30-80 m off the line, sheep on a hillside, a starling murmuration.",
    build(ctx) {
      inSituStage(ctx, { sun: [45, 50, 10] });
      widenShadows(ctx, 130, [0, 0, -80]);
      const cab = new THREE.Vector3(...CAB_EYE);
      const heightAt = hill(ctx, 84, -104, 50, 62, 15);
      // Dressing: fences either side, hedges, oaks, grass.
      fenceLine(ctx, "fence-rail", -7.5, -4, -150);
      fenceLine(ctx, "fence-rail", 7.5, -4, -150);
      for (const [x, z, v, s] of [
        [-62, -60, 0, 1.2],
        [-58, -118, 1, 1.4],
        [-20, -150, 2, 1.1],
        [30, -40, 1, 1.0],
        [70, -165, 0, 1.3],
      ] as const)
        prefab(ctx, "oak", v, [x, heightAt(x, z), z], x * 0.1, s);
      for (let z = -30; z > -170; z -= 9) prefab(ctx, "hedgerow", (z / 9) | 0, [-80, 0, z], Math.PI / 2, 1);
      prefab(ctx, "hay-bale-round", 0, [-14, 0, -32], 0.4);
      prefab(ctx, "hay-bale-round", 1, [-15.5, 0, -34], 1.2);
      scatterGrass(ctx, "pastoral", 1400, [-90, 90, -170, -8], heightAt);

      const items: Tickable[] = [];
      const cows = createHerd({ species: "cow", count: 16, seed: "pastoral-cows", radius: 15, lookAt: cab, env: {} });
      cows.position.set(-26, 0, -46);
      cows.rotation.y = 0.3;
      ctx.scene.add(cows);
      items.push(cows.userData as unknown as HerdUserData);
      const sheep = createHerd({ species: "sheep", count: 30, seed: "pastoral-sheep", radius: 13, heightAt, lookAt: cab });
      sheep.position.set(42, heightAt(42, -80), -80);
      ctx.scene.add(sheep);
      items.push(sheep.userData as unknown as HerdUserData);
      // The sheepdog, lying watchful below the flock.
      const dog = createAnimal("dog", { seed: "pastoral-dog", behavior: "rest", lookAt: cab, heightAt });
      dog.position.set(27, heightAt(27, -66), -66);
      dog.rotation.y = -2.4;
      ctx.scene.add(dog);
      items.push(dog.userData as unknown as AnimalUserData);
      // Two horses by the near fence, one dog.
      for (const [i, x, z, r, b] of [
        [0, 17, -30, -2.2, "graze"],
        [1, 20, -33.5, 0.9, "alert"],
      ] as const) {
        const h = createAnimal("horse", { seed: `pastoral-horse-${i}`, behavior: b, lookAt: cab, roam: 2 });
        h.position.set(x, 0, z);
        h.rotation.y = r;
        ctx.scene.add(h);
        items.push(h.userData as unknown as AnimalUserData);
      }
      const flock = createFlock({ kind: "starlings", count: Number(ctx.params.birds ?? 900), seed: "pastoral" });
      flock.setViewer(ctx.camera.position);
      ctx.scene.add(flock.object);
      const centre = new THREE.Vector3(-15, 44, -190);
      items.push({ tick: (dt, t) => flock.update(dt, t, centre) });
      run(ctx, items);
      const cam = (ctx.params.cam as [number, number, number] | undefined) ?? CAB_EYE;
      const look = (ctx.params.look as [number, number, number] | undefined) ?? [0, 3.5, -60];
      ctx.view(cam, look, Number(ctx.params.fov ?? CAB_FOV));
      countFauna(ctx, "pastoral");
    },
  },
  {
    name: "fauna-dark",
    description: "Dark stage: crows on a fence and pecking at a carcass in a drought field, a kettle of crows circling overhead.",
    build(ctx) {
      inSituStage(ctx, { sun: [-28, 60, 14] });
      widenShadows(ctx, 90, [0, 0, -45]);
      INK_GLOBALS.uInkGloom.value = Number(ctx.params.gloom ?? 0.14);
      INK_GLOBALS.uInkTension.value = 0.4;
      ctx.pipeline.look.haze = Number(ctx.params.haze ?? 0.28);
      const cab = new THREE.Vector3(...CAB_EYE);
      const env = { drought: 1, storm: 0.3, ruin: 0.4 };
      const rail = fenceLine(ctx, "fence-barbed", -4.4, 2, -90);
      fenceLine(ctx, "fence-rail", 6.5, -3, -40);
      for (const [x, z, v, s] of [
        [-16, -38, 0, 1.2],
        [14, -64, 1, 1.4],
        [-30, -95, 2, 1.1],
        [26, -120, 0, 1.3],
      ] as const)
        prefab(ctx, v === 1 ? "tree-burnt" : "tree-dead", v, [x, 0, z], x * 0.2, s, 0);
      const items: Tickable[] = [];
      // Crows on the fence posts nearest the line, a few gaps between them.
      const rng = createRng("dark-crows");
      const posts = rail.posts.filter((p) => p.z < -2).sort((a, b) => b.z - a.z);
      let placed = 0;
      for (let i = 0; i < posts.length && placed < 8; i++) {
        if (i > 1 && rng.chance(0.3)) continue;
        const post = posts[i]!;
        const b = rng.pick(["rest", "rest", "alert", "alert", "walk"] as const);
        const c = createAnimal("crow", { seed: `fence-${i}`, behavior: b === "walk" ? "alert" : b, lookAt: cab, anchored: true });
        c.position.copy(post);
        c.rotation.y = rng.pick([Math.PI / 2, -Math.PI / 2, 0, Math.PI]) + rng.range(-0.5, 0.5);
        ctx.scene.add(c);
        items.push(c.userData as unknown as AnimalUserData);
        placed++;
      }
      // A carcass in the field, crows working at it.
      const dead = createAnimal("cow", { seed: "carcass", env, dead: true });
      dead.position.set(-14, 0, -30);
      dead.rotation.y = 0.9;
      ctx.scene.add(dead);
      items.push(dead.userData as unknown as AnimalUserData);
      for (let i = 0; i < 6; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(1.4, 3.2);
        const c = createAnimal("crow", { seed: `carcass-${i}`, behavior: i % 3 === 2 ? "walk" : "graze", roam: 1.2, lookAt: cab });
        c.position.set(-14 + Math.cos(a) * r, 0, -30 + Math.sin(a) * r);
        c.rotation.y = a + Math.PI + rng.range(-0.5, 0.5);
        ctx.scene.add(c);
        items.push(c.userData as unknown as AnimalUserData);
      }
      // Thin cattle standing listless beyond.
      const herd = createHerd({ species: "cow", count: 5, seed: "drought", radius: 9, env: { drought: 1 }, lookAt: cab, behavior: "graze" });
      herd.position.set(24, 0, -75);
      ctx.scene.add(herd);
      items.push(herd.userData as unknown as HerdUserData);
      const kettle = createFlock({ kind: "crows", count: 16, seed: "dark" });
      kettle.setViewer(ctx.camera.position);
      ctx.scene.add(kettle.object);
      const centre = new THREE.Vector3(-8, 17, -36);
      items.push({ tick: (dt, t) => kettle.update(dt, t, centre) });
      run(ctx, items);
      const cam = (ctx.params.cam as [number, number, number] | undefined) ?? CAB_EYE;
      const look = (ctx.params.look as [number, number, number] | undefined) ?? [-5, 4.5, -40];
      ctx.view(cam, look, Number(ctx.params.fov ?? CAB_FOV));
      countFauna(ctx, "dark stage");
    },
  },
];
