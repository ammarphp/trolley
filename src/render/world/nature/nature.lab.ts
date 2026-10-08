import * as THREE from "three";
import { createInkCanvas, createInkLineMaterial, inkMaterial } from "../../core/ink-material.ts";
import { createRng } from "../../core/rng.ts";
import type { LabContext, LabScene } from "../../lab/types.ts";
import { inSituStage } from "../../lab/stage-kit.ts";
import { foliageAtlas } from "./atlas.ts";
import { NATURE_CATALOGUE, buildPrefab, createLeafFall, getTelegraphAttachments, type NaturePrefab, type NaturePrefabId } from "./index.ts";

// ------------------------------------------------------------------ helpers

function widenShadows(ctx: LabContext, half = 120, centre: [number, number, number] = [0, 0, 0], mapSize = 4096): void {
  ctx.scene.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (!l.isDirectionalLight) return;
    const dir = l.position.clone().normalize();
    l.target.position.set(...centre);
    ctx.scene.add(l.target);
    l.position.copy(new THREE.Vector3(...centre).addScaledVector(dir, 200));
    const cam = l.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 500;
    cam.updateProjectionMatrix();
    l.shadow.mapSize.set(mapSize, mapSize);
    l.shadow.bias = -0.0006;
  });
}

function label(text: string, width = 6): THREE.Mesh {
  const { ctx: g, texture } = createInkCanvas(1024, 128);
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = "#000";
  g.font = "600 58px Geist, Helvetica, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 512, 66);
  texture.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 8), inkMaterial({ map: texture, flat: true, edge: 0 }));
  m.userData.noShadow = true;
  m.castShadow = false;
  return m;
}

function prefabMesh(p: NaturePrefab): THREE.Mesh {
  return new THREE.Mesh(p.geometry, inkMaterial(p.material));
}

interface Row {
  id: NaturePrefabId;
  variants?: number[];
  leaves?: number;
  /** 0 = automatic from the footprint. */
  spacing: number;
}

/**
 * A specimen plate: one row per id, variants side by side, rows receding in
 * depth, each captioned, the camera framing the whole plate from about 25
 * degrees above eye level.
 */
function sheet(ctx: LabContext, rows: Row[], opts: { elevation?: number; tight?: number } = {}): void {
  const built = rows.map((row) => {
    const info = NATURE_CATALOGUE[row.id];
    const variants = row.variants ?? Array.from({ length: info.variants }, (_, i) => i);
    const prefabs = variants.map((v) => ({ v, p: buildPrefab(row.id, v, { leaves: row.leaves ?? 1 }) }));
    const foot = Math.max(...prefabs.map((q) => q.p.footprint));
    const height = Math.max(...prefabs.map((q) => q.p.height));
    return { row, info, prefabs, foot, height, spacing: row.spacing || foot * 2 + Math.max(0.6, foot * 0.35) };
  });
  let z = 0;
  let maxW = 0;
  let maxH = 0;
  let zFront = 0;
  built.forEach((b, r) => {
    // Keep each row clear of the one in front: at 25 degrees a row of height h hides ~2h behind it.
    if (r > 0) z -= built[r - 1]!.foot + b.foot + built[r - 1]!.height * 1.7 + 0.8;
    const n = b.prefabs.length;
    b.prefabs.forEach(({ v, p }, i) => {
      const x = (i - (n - 1) / 2) * b.spacing;
      const m = prefabMesh(p);
      m.position.set(x, 0, z);
      m.userData.plate = true;
      ctx.scene.add(m);
      const caption = b.info.variants > 1 ? `${b.row.id} · ${b.info.variantNames[v] ?? v}` : b.row.id;
      plateLabel(ctx, caption, x, z + b.foot + b.spacing * 0.08, Math.min(b.spacing * 0.92, 14));
    });
    maxW = Math.max(maxW, n * b.spacing);
    maxH = Math.max(maxH, b.height);
    if (r === 0) zFront = b.foot + b.spacing * 0.2;
  });
  void maxH;
  // Frame the real bounds: back the camera off along the 25-degree view ray
  // until every corner of the plate's bounding box projects inside the frame.
  const box = new THREE.Box3();
  ctx.scene.traverse((o) => {
    if (o.userData.plate) box.expandByObject(o);
  });
  box.min.z = Math.min(box.min.z, zFront + 1);
  const el = ((opts.elevation ?? 25) * Math.PI) / 180;
  const vfov = 40;
  const cam = new THREE.PerspectiveCamera(vfov, 16 / 9, 0.1, 5000);
  const target = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
  const corners: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const zz of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, zz));
  let d = 5;
  for (let i = 0; i < 200; i++) {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    const fits = corners.every((c) => {
      const p = c.clone().project(cam);
      return Math.abs(p.x) < 0.94 / (opts.tight ?? 1) && Math.abs(p.y) < 0.9 / (opts.tight ?? 1) && p.z < 1;
    });
    if (fits) break;
    d *= 1.06;
  }
  const eye = cam.position;
  ctx.view([eye.x, eye.y, eye.z], [target.x, target.y, target.z], vfov);
  widenShadows(ctx, Math.max(box.max.x - box.min.x, depth(box)) * 0.7 + 10, [target.x, 0, target.z]);
}

function depth(b: THREE.Box3): number {
  return b.max.z - b.min.z;
}

interface Placement {
  id: NaturePrefabId;
  variant: number;
  x: number;
  z: number;
  yaw?: number;
  scale?: number;
}

/** Group placements by prefab and draw each group as one InstancedMesh, as the world renderer does. */
function scatter(ctx: LabContext, items: Placement[], leaves: number): { drawCalls: number; triangles: number } {
  const groups = new Map<string, Placement[]>();
  for (const it of items) {
    const key = `${it.id}|${it.variant}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let triangles = 0;
  for (const [key, list] of groups) {
    const [id, v] = key.split("|") as [NaturePrefabId, string];
    const p = buildPrefab(id, Number(v), { leaves });
    const mesh = new THREE.InstancedMesh(p.geometry, inkMaterial(p.material), list.length);
    list.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw ?? 0);
      m.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3().setScalar(it.scale ?? 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    ctx.scene.add(mesh);
    triangles += p.triangles * list.length;
  }
  return { drawCalls: groups.size, triangles };
}

/** Hang wires between consecutive telegraph poles along a line of placements. */
function hangWires(ctx: LabContext, poles: Placement[]): void {
  const mat = createInkLineMaterial({ tone: 0.9 });
  const pts: number[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const world = (p: Placement) => {
    const att = getTelegraphAttachments(p.variant);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw ?? 0);
    m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
    return att.map((a) => a.clone().applyMatrix4(m));
  };
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = world(poles[i]!);
    const b = world(poles[i + 1]!);
    const n = Math.min(a.length, b.length);
    for (let j = 0; j < n; j++) {
      const A = a[j]!;
      const B = b[j]!;
      const sag = A.distanceTo(B) * 0.018;
      const segs = 10;
      for (let s = 0; s < segs; s++) {
        for (const t of [s / segs, (s + 1) / segs]) {
          const p = A.clone().lerp(B, t);
          p.y -= sag * 4 * t * (1 - t);
          pts.push(p.x, p.y, p.z);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(g, mat);
  lines.userData.noShadow = true;
  ctx.scene.add(lines);
}

function plateLabel(ctx: LabContext, text: string, x: number, z: number, width: number, tilt = 0.55): void {
  const l = label(text, width);
  l.position.set(x, 0.02, z);
  l.rotation.x = -Math.PI / 2 + tilt;
  ctx.scene.add(l);
}

// ------------------------------------------------------------------ scenes

const DECIDUOUS: NaturePrefabId[] = ["oak", "poplar", "birch", "willow", "fruit-tree"];

export const scenes: LabScene[] = [
  {
    name: "nature-sheet",
    description: "Specimen plate for any ids (params: ids = comma list, leaves).",
    build(ctx) {
      ctx.standardStage({ sun: [30, 45, 25] });
      const ids = String(ctx.params.ids ?? "oak,poplar").split(",") as NaturePrefabId[];
      const leaves = Number(ctx.params.leaves ?? 1);
      sheet(
        ctx,
        ids.map((id) => ({ id, leaves, spacing: 0 })),
        { elevation: Number(ctx.params.elevation ?? 25), tight: Number(ctx.params.tight ?? 1) },
      );
    },
  },
  {
    name: "nature-sheet-crops",
    description: "Crop strips, two tiles each, seen from the cab height at 12 m.",
    build(ctx) {
      ctx.standardStage({ sun: [30, 45, 25] });
      widenShadows(ctx, 60, [0, 0, -10]);
      for (let v = 0; v < 6; v++) {
        const col = v % 3;
        const row = Math.floor(v / 3);
        for (const t of [0, 1]) {
          const m = prefabMesh(buildPrefab("crop-strip", v));
          m.position.set((col - 1) * 17.5 + (t - 0.5) * 8, 0, -row * 11 - 4);
          ctx.scene.add(m);
        }
        plateLabel(ctx, `crop-strip · ${NATURE_CATALOGUE["crop-strip"].variantNames[v]}`, (col - 1) * 17.5, -row * 11 + 0.4, 7);
      }
      ctx.view([0, 16, 30], [0, 0, -8], 50);
    },
  },
  {
    name: "nature-sheet-lineside",
    description: "Telegraph poles (with hung wires) and lineside markers.",
    build(ctx) {
      ctx.standardStage({ sun: [30, 45, 25] });
      widenShadows(ctx, 60, [0, 0, -6]);
      for (let v = 0; v < 5; v++) {
        const poles: Placement[] = [0, 1].map((j) => ({ id: "telegraph-pole", variant: v, x: (v - 2) * 6.5, z: -j * 30 }));
        for (const pl of poles) {
          const m = prefabMesh(buildPrefab("telegraph-pole", v));
          m.position.set(pl.x, 0, pl.z);
          ctx.scene.add(m);
        }
        hangWires(ctx, poles);
        plateLabel(ctx, `telegraph-pole · ${NATURE_CATALOGUE["telegraph-pole"].variantNames[v]}`, (v - 2) * 6.5, 2.2, 5.5);
      }
      for (let v = 0; v < 6; v++) {
        const m = prefabMesh(buildPrefab("lineside-marker", v));
        m.position.set((v - 2.5) * 2.4, 0, 8);
        ctx.scene.add(m);
        plateLabel(ctx, NATURE_CATALOGUE["lineside-marker"].variantNames[v]!, (v - 2.5) * 2.4, 9.2, 2.2);
      }
      ctx.view([0, 7.5, 21], [0, 4, -4], 50);
    },
  },
  {
    name: "nature-foliage",
    description: "The same tree at foliage 1 / 0.6 / 0.25 / 0 (params: species, variant).",
    build(ctx) {
      ctx.standardStage({ sun: [30, 45, 25] });
      widenShadows(ctx, 90);
      const species = String(ctx.params.species ?? "oak") as NaturePrefabId;
      const variant = Number(ctx.params.variant ?? 0);
      const levels = [1, 0.6, 0.25, 0];
      const gap = species === "fruit-tree" ? 9 : species === "poplar" || species === "birch" ? 13 : 21;
      levels.forEach((lv, i) => {
        const m = prefabMesh(buildPrefab(species, variant, { leaves: lv }));
        m.position.set((i - 1.5) * gap, 0, 0);
        ctx.scene.add(m);
        plateLabel(ctx, `${species} · leaves ${lv}`, (i - 1.5) * gap, gap * 0.45, gap * 0.5, 0.5);
      });
      const h = species === "fruit-tree" ? 5.5 : species === "poplar" ? 23 : 15;
      ctx.view([0, h * 0.5, gap * 2.6 + h * 1.1], [0, h * 0.45, 0], 45);
    },
  },
  {
    name: "nature-foliage-all",
    description: "All five species at the four foliage levels (rows = levels).",
    build(ctx) {
      ctx.standardStage({ sun: [30, 45, 25] });
      widenShadows(ctx, 140, [0, 0, -40]);
      const levels = [1, 0.6, 0.25, 0];
      const xs = [-44, -22, -4, 16, 36];
      levels.forEach((lv, row) => {
        DECIDUOUS.forEach((id, i) => {
          const m = prefabMesh(buildPrefab(id, 0, { leaves: lv }));
          m.position.set(xs[i]!, 0, -row * 24);
          ctx.scene.add(m);
        });
        plateLabel(ctx, `leaves ${lv}`, -62, -row * 24 + 2, 12, 0.6);
      });
      ctx.view([0, 58, 58], [0, 4, -40], 50);
    },
  },
  {
    name: "nature-tree-close",
    description: "One prefab from the cab eye at a typical distance (params: id, variant, leaves, dist).",
    build(ctx) {
      ctx.standardStage({ sun: [30, 45, 25], ground: ctx.params.ground !== false });
      widenShadows(ctx, 60);
      const id = String(ctx.params.id ?? ctx.params.species ?? "oak") as NaturePrefabId;
      const p = buildPrefab(id, Number(ctx.params.variant ?? 0), { leaves: Number(ctx.params.leaves ?? 1) });
      ctx.scene.add(prefabMesh(p));
      const dist = Number(ctx.params.dist ?? Math.max(6, p.height * 2.2));
      ctx.view([0, Number(ctx.params.eye ?? 2.5), dist], [0, p.height * 0.5, 0], 55);
    },
  },
  {
    name: "nature-atlas",
    description: "The procedural foliage atlas, flat.",
    build(ctx) {
      ctx.standardStage({ ground: false });
      const tex = foliageAtlas().texture;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), inkMaterial({ alphaMap: tex, alphaTest: 0.5, flat: true, tone: 0.5, edge: 1 }));
      ctx.scene.add(m);
      ctx.view([0, 0, 11], [0, 0, 0], 45);
    },
  },
];

// -------------------------------------------------------------- in situ

/**
 * Stage 1 pastoral, as the player sees it from the cab: a fence and hedgerow,
 * telegraph poles marching with the track, an oak group in a hay field, crops,
 * a willow by the ditch, a farm corner. `late` shows the same place in late
 * autumn in a drought: bare and dead trees, stubble, no grass.
 */
function pastoral(ctx: LabContext, late: boolean): void {
  inSituStage(ctx, { length: 420, sun: [35, 48, 30] });
  widenShadows(ctx, 170, [0, 0, -95], 4096);
  const rng = createRng("insitu-pastoral");
  const items: Placement[] = [];
  const leaves = late ? 0 : 1;
  const tree = (id: NaturePrefabId, variant: number, x: number, z: number, scale = 1) => {
    const dead = late && rng.chance(0.35) && id !== "poplar";
    if (dead) items.push({ id: "tree-dead", variant: [0, 1, 2, 0][variant % 4]!, x, z, yaw: rng.range(0, 6.28), scale });
    else items.push({ id, variant, x, z, yaw: rng.range(0, 6.28), scale });
  };
  // LEFT of the line: telegraph route, a wheat field running with the track,
  // a dry-stone wall beyond it, the farm corner, a willow by the ditch.
  const poles: Placement[] = [];
  for (let z = -22; z > -400; z -= 55) poles.push({ id: "telegraph-pole", variant: 2, x: -5.4, z, yaw: 0 });
  items.push(...poles);
  for (let z = -18; z > -200; z -= 8) for (let x = -10.5; x > -31; x -= 6) items.push({ id: "crop-strip", variant: late ? 4 : 0, x, z, yaw: Math.PI / 2 });
  for (let z = -10, i = 0; z > -260; z -= 3, i++) items.push({ id: "wall-drystone", variant: i === 30 ? 2 : 0, x: -33, z, yaw: Math.PI / 2 });
  items.push({ id: "shed", variant: late ? 3 : 1, x: -40, z: -44, yaw: 0.5 }, { id: "well", variant: 0, x: -37, z: -34, yaw: 0.3 });
  items.push({ id: "scarecrow", variant: late ? 2 : 0, x: -17, z: -58, yaw: 0.6 });
  tree("willow", 0, -40, -120, 1);
  tree("birch", 2, -44, -80);
  tree("birch", 0, -52, -92, 0.95);
  tree("poplar", 0, -58, -170);
  tree("poplar", 1, -52, -188);
  tree("poplar", 2, -46, -206);
  tree("fruit-tree", 0, -45, -60);
  tree("fruit-tree", 1, -52, -66);
  tree("oak", 1, -80, -240, 1.2);
  // RIGHT of the line: a post-and-rail fence, the hay field with its oak
  // group, then a hedgerow boundary running away along the line.
  for (let z = -2, i = 0; z > -300; z -= 3, i++) items.push({ id: late ? "fence-barbed" : "fence-rail", variant: late ? (i % 9 === 4 ? 2 : 1) : i === 19 ? 3 : 0, x: 7.5, z, yaw: Math.PI / 2 });
  for (let z = -72, i = 0; z > -330; z -= 6, i++) items.push({ id: "hedgerow", variant: [0, 1, 0, 4, 2, 1][i % 6]!, x: 13, z, yaw: Math.PI / 2 });
  tree("oak", 0, 26, -44, 1.0);
  tree("oak", 1, 46, -62, 1.1);
  tree("oak", 2, 33, -90, 0.9);
  tree("oak", 3, 70, -140, 1.05);
  tree("oak", 3, 90, -230, 1.2);
  items.push({ id: "spruce", variant: 1, x: 110, z: -300 }, { id: "spruce", variant: 2, x: 118, z: -310 }, { id: "pine", variant: 0, x: -120, z: -320 });
  if (!late) {
    for (const [x, z, v] of [
      [14, -24, 0],
      [18, -33, 0],
      [13, -41, 3],
      [23, -21, 2],
      [17, -56, 0],
    ] as const)
      items.push({ id: "hay-bale-round", variant: v, x, z, yaw: rng.range(0, 3) });
    items.push({ id: "hay-bale-square", variant: 1, x: 11, z: -14, yaw: 0.2 });
  } else {
    items.push({ id: "hay-bale-round", variant: 4, x: 14, z: -26, yaw: 0.4 }, { id: "hay-bale-round", variant: 2, x: 18, z: -38, yaw: 1.2 });
  }
  items.push({ id: "lineside-marker", variant: 0, x: 2.6, z: -16, yaw: 0 }, { id: "lineside-marker", variant: 3, x: 2.8, z: -120, yaw: 0 });
  items.push({ id: "boulder", variant: 0, x: 30, z: -30, yaw: 0.7 }, { id: "rock", variant: 0, x: 4.5, z: -26 }, { id: "stump", variant: late ? 3 : 0, x: 5.2, z: -9 });
  if (!late) {
    for (let i = 0; i < 2400; i++) {
      const side = rng.chance(0.5) ? 1 : -1;
      const x = side * rng.range(3.2, side > 0 ? 40 : 8.5);
      const z = rng.range(-160, 4);
      const r = rng.next();
      items.push({ id: r < 0.9 ? "grass-tuft" : "wildflowers", variant: r < 0.9 ? rng.int(0, 3) : rng.int(0, 5), x, z, yaw: rng.range(0, 6.28), scale: rng.range(0.8, 1.3) });
    }
    for (let i = 0; i < 24; i++) items.push({ id: "reeds", variant: rng.int(0, 3), x: -36 + rng.range(-1, 1), z: -108 - rng.range(0, 25), yaw: rng.range(0, 6.28) });
  } else {
    for (let i = 0; i < 260; i++) {
      const side = rng.chance(0.5) ? 1 : -1;
      items.push({ id: "grass-tuft", variant: 5, x: side * rng.range(3.2, side > 0 ? 30 : 8.5), z: rng.range(-120, 4), yaw: rng.range(0, 6.28) });
    }
  }
  const stats = scatter(ctx, items, leaves);
  hangWires(ctx, poles);
  (window as unknown as { __natureStats?: unknown }).__natureStats = stats;
  console.warn(`nature in situ: ${stats.drawCalls} instanced draw calls, ${stats.triangles} triangles`);
  if (late) {
    const fall = createLeafFall({ max: 260 });
    ctx.scene.add(fall.object);
    ctx.onFrame((dt) => fall.update(dt, 0.4, ctx.camera));
  }
}

scenes.push(
  {
    name: "nature-crop-insitu",
    description: "Crop strips tiled into a field beside the line (params: variant, shadows).",
    build(ctx) {
      inSituStage(ctx, { length: 300 });
      if (ctx.params.shadows !== false) widenShadows(ctx, 120, [0, 0, -60]);
      const items: Placement[] = [];
      const v = Number(ctx.params.variant ?? 0);
      for (let z = -10; z > -180; z -= 8) for (let x = -10.5; x > -34; x -= 6) items.push({ id: "crop-strip", variant: v, x, z, yaw: Math.PI / 2 });
      for (let z = -10; z > -180; z -= 8) for (let x = 10.5; x < 34; x += 6) items.push({ id: "crop-strip", variant: (v + 3) % 6, x, z, yaw: Math.PI / 2 });
      scatter(ctx, items, 1);
    },
  },
  {
    name: "nature-insitu",
    description: "Stage 1 pastoral from the cab.",
    build(ctx) {
      pastoral(ctx, false);
    },
  },
  {
    name: "nature-insitu-late",
    description: "The same place in late autumn and drought: bare and dead trees, no grass.",
    build(ctx) {
      pastoral(ctx, true);
    },
  },
  {
    name: "nature-leaffall",
    description: "Falling leaves around the cab (param density).",
    build(ctx) {
      inSituStage(ctx);
      const fall = createLeafFall();
      ctx.scene.add(fall.object);
      const density = Number(ctx.params.density ?? 1);
      ctx.onFrame((dt) => fall.update(dt, density, ctx.camera));
      const items: Placement[] = [];
      for (let z = -20; z > -200; z -= 16) items.push({ id: "oak", variant: Math.abs(z) % 4, x: -14 - (Math.abs(z) % 7), z }, { id: "birch", variant: Math.abs(z) % 3, x: 13 + (Math.abs(z) % 5), z: z - 6 });
      scatter(ctx, items, 0.25);
    },
  },
);
