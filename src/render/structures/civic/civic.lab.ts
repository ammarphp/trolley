/**
 * Lab sheets for civic structures.
 *
 *   civic-one      one building; params {id, variant, seed, env, dist, az, el}
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import type { LabContext, LabScene } from "../../lab/types.ts";
import { inSituStage, trackGeometry } from "../../lab/stage-kit.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { buildCivic, CIVIC_VARIANTS, type CivicId } from "./index.ts";

function tris(o: THREE.Object3D): { tris: number; draws: number } {
  let t = 0;
  let d = 0;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    d++;
    const g = m.geometry;
    t += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
  });
  return { tris: Math.round(t), draws: d };
}

function widenShadows(ctx: LabContext, centre: [number, number, number], half: number): void {
  ctx.scene.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (!l.isDirectionalLight) return;
    const dir = l.position.clone().sub(l.target.position).normalize();
    l.target.position.set(...centre);
    l.position.copy(new THREE.Vector3(...centre).add(dir.multiplyScalar(150)));
    ctx.scene.add(l.target);
    const cam = l.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 400;
    l.shadow.mapSize.set(4096, 4096);
    cam.updateProjectionMatrix();
  });
}

interface Item {
  id: CivicId;
  variant?: number;
  env?: Partial<EnvironmentTarget>;
  seed?: string;
  label?: string;
  rotY?: number;
}

function label(ctx: LabContext, text: string, p: THREE.Vector3): void {
  const cam = ctx.camera;
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const v = p.clone().project(cam);
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `position:fixed;left:${((v.x + 1) / 2) * innerWidth}px;top:${((1 - v.y) / 2) * innerHeight}px;transform:translate(-50%,0);font:11px/1.25 ui-monospace,monospace;color:#111;background:rgba(255,255,255,.88);padding:1px 5px;z-index:6;white-space:nowrap`;
  document.body.append(el);
}

/** Lay items out in rows (x), rows receding in z; camera ~25 degrees above. */
function lineup(ctx: LabContext, items: Item[], title: string, o: { el?: number; gap?: number; fov?: number; sun?: [number, number, number]; zoom?: number; perRow?: number } = {}): void {
  ctx.standardStage({ sun: o.sun ?? [40, 55, 45] });
  const built = items.map((it) => {
    const inner = buildCivic(it.id, { seed: it.seed ?? "lineup", env: it.env, variant: it.variant });
    let obj: THREE.Object3D = inner;
    if (it.rotY) {
      obj = new THREE.Group();
      inner.rotation.y = it.rotY;
      obj.add(inner);
      obj.userData = { ...inner.userData };
      const bx = new THREE.Box3().setFromObject(obj);
      obj.userData.bounds = { minX: bx.min.x, maxX: bx.max.x, minZ: bx.min.z, maxZ: bx.max.z, height: bx.max.y };
    }
    return { it, obj, b: obj.userData.bounds as { minX: number; maxX: number; minZ: number; maxZ: number; height: number } };
  });
  const gap = o.gap ?? 5;
  const perRow = o.perRow ?? built.length;
  const rows: Array<typeof built> = [];
  for (let i = 0; i < built.length; i += perRow) rows.push(built.slice(i, i + perRow));
  let z = 0;
  let widest = 0;
  let maxH = 0;
  const frontZ = rows[0] ? Math.max(...rows[0].map((e) => e.b.maxZ)) : 0;
  for (const row of rows) {
    const total = row.reduce((s, x) => s + (x.b.maxX - x.b.minX), 0) + gap * (row.length - 1);
    widest = Math.max(widest, total);
    let x = -total / 2;
    const rowFront = Math.max(...row.map((e) => e.b.maxZ));
    const rowBack = Math.min(...row.map((e) => e.b.minZ));
    for (const e of row) {
      e.obj.position.set(x - e.b.minX, 0, z - rowFront + frontZ);
      x += e.b.maxX - e.b.minX + gap;
      maxH = Math.max(maxH, e.b.height);
      ctx.scene.add(e.obj);
    }
    z -= rowFront - rowBack + gap * 1.6;
  }
  const depth = -z;
  const fov = o.fov ?? 30;
  const aspect = innerWidth / innerHeight;
  const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
  const el = ((o.el ?? 24) * Math.PI) / 180;
  const cz = frontZ - depth / 2;
  const fitW = widest / 2 / Math.tan(hfov / 2);
  const fitH = (depth * Math.sin(el) + maxH * Math.cos(el)) / 2 / Math.tan((fov * Math.PI) / 360);
  const dist = Math.max(fitW, fitH) * (o.zoom ?? 1.05) + depth / 2;
  const ty = maxH * 0.3;
  ctx.view([0, ty + Math.sin(el) * dist, cz + Math.cos(el) * dist], [0, ty, cz], fov);
  widenShadows(ctx, [0, 0, cz], Math.max(60, Math.max(widest, depth) * 0.65));
  let sumT = 0;
  for (const e of built) {
    const s = tris(e.obj);
    sumT += s.tris;
    const cx = e.obj.position.x + (e.b.minX + e.b.maxX) / 2;
    label(ctx, `${e.it.label ?? e.it.id} v${String(e.obj.userData.civic.variant)} · ${s.tris}▲ ${s.draws}dc`, new THREE.Vector3(cx, 0, e.obj.position.z + e.b.maxZ + 1.2));
  }
  ctx.caption(`${title} · ${built.length} items · ${sumT} tris`);
}

function vs(id: CivicId, n: number, extra: Partial<Item> = {}): Item[] {
  return Array.from({ length: n }, (_, v) => ({ id, variant: v, ...extra }));
}

const VARIANTS: Record<CivicId, number> = CIVIC_VARIANTS;

export const scenes: LabScene[] = [
  {
    name: "civic-sheet",
    description: "All variants of one id. params: id, env, el, perRow",
    build(ctx) {
      const p = ctx.params as { id?: CivicId; env?: Partial<EnvironmentTarget>; el?: number; perRow?: number; seed?: string };
      const id = p.id ?? "farmhouse";
      lineup(ctx, vs(id, VARIANTS[id], { env: p.env, seed: p.seed, rotY: id === "bridge" ? Math.PI / 2 : 0 }), `${id} sheet`, { el: p.el ?? 22, perRow: p.perRow, gap: 6 });
    },
  },
  { name: "civic-lineup-farm", build: (ctx) => lineup(ctx, [...vs("farmhouse", 3), ...vs("barn", 3)], "farmhouse & barn") },
  { name: "civic-lineup-mills", build: (ctx) => lineup(ctx, [...vs("windmill", 3), ...vs("mill", 2)], "windmills & mills") },
  { name: "civic-lineup-water", build: (ctx) => lineup(ctx, [...vs("water-tower", 3), ...vs("greenhouse", 2)], "water towers & greenhouses") },
  { name: "civic-lineup-plots", build: (ctx) => lineup(ctx, [...vs("garden", 2), ...vs("orchard", 3)], "gardens & orchards", { el: 32 }) },
  {
    name: "civic-one",
    description: "One civic structure. params: id, variant, seed, env, dist, az, el, h",
    build(ctx) {
      const p = ctx.params as { id?: CivicId; variant?: number; seed?: string; env?: Partial<EnvironmentTarget>; dist?: number; az?: number; el?: number; h?: number; sun?: [number, number, number] };
      const id = p.id ?? "farmhouse";
      ctx.standardStage({ sun: p.sun ?? [30, 45, 22] });
      const o = buildCivic(id, { seed: p.seed ?? "lab", env: p.env, variant: p.variant });
      ctx.scene.add(o);
      const fp = o.userData.footprint as { width: number; depth: number };
      const b = o.userData.bounds as { height: number };
      const size = Math.max(fp.width, fp.depth, b.height);
      const dist = p.dist ?? size * 1.9 + 6;
      const az = ((p.az ?? 28) * Math.PI) / 180;
      const el = ((p.el ?? 12) * Math.PI) / 180;
      const ty = p.h ?? b.height * 0.4;
      ctx.view([Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist], [0, ty, 0], 40);
      widenShadows(ctx, [0, 0, 0], Math.max(40, size));
      const s = tris(o);
      ctx.caption(`${id} v${String(o.userData.civic.variant)} · ${s.tris} tris · ${s.draws} draws · ${fp.width.toFixed(1)}×${fp.depth.toFixed(1)} m`);
    },
  },
];

// ------------------------------------------------------------------ in situ

interface Placed {
  id: CivicId;
  x: number;
  z: number;
  /** Rotation; by default the front faces the track. */
  rot?: number;
  variant?: number;
  seed?: string;
  env?: Partial<EnvironmentTarget>;
  /** Align a trackside building's front edge to the line on this side. */
  trackside?: boolean;
}

function place(ctx: LabContext, items: Placed[], env: Partial<EnvironmentTarget>, time = 1): void {
  for (const it of items) {
    const o = buildCivic(it.id, { seed: it.seed ?? `situ:${it.id}:${it.x}`, env: { ...env, ...(it.env ?? {}) }, variant: it.variant });
    const left = it.x < 0;
    o.rotation.y = it.rot ?? (left ? Math.PI / 2 : -Math.PI / 2);
    let x = it.x;
    const ts = o.userData.trackside as { edgeZ: number; trackOffset: number } | undefined;
    if (it.trackside && ts) x = (left ? -1 : 1) * (ts.edgeZ + ts.trackOffset);
    o.position.set(x, 0, it.z);
    ctx.scene.add(o);
    const tick = o.userData.tick as ((dt: number, t: number) => void) | undefined;
    if (tick) ctx.onFrame((dt, t) => tick(dt, t));
  }
  void time;
}

function situStage(ctx: LabContext, env: Partial<EnvironmentTarget>): void {
  inSituStage(ctx, { length: 600 });
  widenShadows(ctx, [0, 0, -110], 150);
  const gloom = env.gloom ?? 0;
  const night = (env.timeOfDay ?? 0.4) > 0.72 ? 1 : 0;
  INK_GLOBALS.uInkGloom.value = Math.max(gloom * 0.6, night * 0.35);
  if (night || gloom > 0.3) {
    ctx.scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight) l.intensity *= 0.55;
    });
  }
}

const PASTORAL: Partial<EnvironmentTarget> = { vegetation: 0.95, leaves: 0.9, bloom: 0.2, habitation: 0.85, timeOfDay: 0.38, wind: 0.35 };
const TOWN: Partial<EnvironmentTarget> = { vegetation: 0.6, leaves: 0.7, habitation: 0.9, industry: 0.35, timeOfDay: 0.45, wind: 0.3 };

scenes.push(
  {
    name: "civic-situ-village",
    description: "Stage 1-2 village beside the line, from the cab.",
    build(ctx) {
      situStage(ctx, PASTORAL);
      place(
        ctx,
        [
          { id: "garden", x: -21, z: -34, variant: 0 },
          { id: "farmhouse", x: -30, z: -62, variant: 0 },
          { id: "barn", x: -44, z: -98, variant: 0, rot: Math.PI / 2 + 0.25 },
          { id: "orchard", x: -34, z: -150, variant: 0 },
          { id: "windmill", x: 34, z: -82, variant: 0, rot: -0.55 },
          { id: "farmhouse", x: 30, z: -130, variant: 1, rot: -Math.PI / 2 + 0.3 },
          { id: "church", x: 58, z: -210, variant: 1, rot: -Math.PI / 2 + 0.2 },
          { id: "barn", x: 26, z: -40, variant: 2 },
        ],
        PASTORAL,
      );
      ctx.caption("in situ · stage 1–2 village: garden, farmhouses, barns, windmill, orchard, church");
    },
  },
  {
    name: "civic-situ-town",
    description: "Stage 3 small town with a station and the clinic.",
    build(ctx) {
      const env = TOWN;
      situStage(ctx, env);
      place(
        ctx,
        [
          { id: "station", x: -1, z: -70, variant: 0, trackside: true },
          { id: "signal-box", x: 1, z: -26, variant: 0, trackside: true },
          { id: "clinic", x: 34, z: -62, variant: 0 },
          { id: "town-houses", x: 30, z: -112, variant: 1 },
          { id: "school", x: -52, z: -130, variant: 0 },
          { id: "water-tower", x: -30, z: -118, variant: 0 },
          { id: "church", x: 44, z: -200, variant: 0, rot: -Math.PI / 2 + 0.3 },
          { id: "town-houses", x: -40, z: -210, variant: 2 },
        ],
        env,
      );
      ctx.caption("in situ · stage 3 town: station (platform aligned to the line), signal box, Meridian Clinic, terraces, school");
    },
  },
  {
    name: "civic-situ-night",
    description: "The town at night: lit windows.",
    build(ctx) {
      const env: Partial<EnvironmentTarget> = { ...TOWN, timeOfDay: 0.92, gloom: 0.4 };
      situStage(ctx, env);
      place(
        ctx,
        [
          { id: "station", x: -1, z: -70, variant: 0, trackside: true },
          { id: "clinic", x: 34, z: -62, variant: 0 },
          { id: "town-houses", x: 30, z: -112, variant: 1 },
          { id: "farmhouse", x: -34, z: -140, variant: 2 },
          { id: "signal-box", x: 1, z: -26, variant: 0, trackside: true },
        ],
        env,
      );
      ctx.caption("in situ · night (timeOfDay 0.92, gloom 0.4): amber lit windows");
    },
  },
  {
    name: "civic-situ-ruin",
    description: "Aftermath: ruined town.",
    build(ctx) {
      const env: Partial<EnvironmentTarget> = { ...TOWN, ruin: 0.85, fire: 0.5, habitation: 0.1, vegetation: 0.2, leaves: 0.1, drought: 0.6, timeOfDay: 0.55, gloom: 0.3 };
      situStage(ctx, env);
      place(
        ctx,
        [
          { id: "station", x: -1, z: -70, variant: 0, trackside: true },
          { id: "clinic", x: 34, z: -62, variant: 0 },
          { id: "town-houses", x: 30, z: -112, variant: 1 },
          { id: "church", x: -46, z: -150, variant: 0 },
          { id: "school", x: 50, z: -190, variant: 0 },
          { id: "signal-box", x: 1, z: -26, variant: 0, trackside: true },
        ],
        env,
      );
      ctx.caption("in situ · ruin 0.85, fire 0.5: the same town, burned out");
    },
  },
  {
    name: "civic-situ-perfect",
    description: "Stage 7 pristine order: sealed, identical.",
    build(ctx) {
      const env: Partial<EnvironmentTarget> = { ...TOWN, perfection: 0.95, uniformity: 0.9, habitation: 0.2, people: 0.05, timeOfDay: 0.5 };
      situStage(ctx, env);
      const items: Placed[] = [];
      for (let i = 0; i < 5; i++) items.push({ id: "town-houses", x: 30, z: -50 - i * 34, variant: 1 });
      for (let i = 0; i < 4; i++) items.push({ id: "farmhouse", x: -30, z: -50 - i * 40, variant: 0 });
      items.push({ id: "clinic", x: -34, z: -220, variant: 0 });
      place(ctx, items, env);
      ctx.caption("in situ · perfection 0.95 / uniformity 0.9: identical, sealed, chimneys gone, cobalt door strips");
    },
  },
  {
    name: "civic-situ-shelter",
    description: "The late-game shelter seen from the line at dusk.",
    build(ctx) {
      const env: Partial<EnvironmentTarget> = { perfection: 0.8, habitation: 0.3, vegetation: 0.15, leaves: 0.2, timeOfDay: 0.78, gloom: 0.45, surveillance: 0.9 };
      situStage(ctx, env);
      place(ctx, [{ id: "shelter", x: 46, z: -100, variant: 0, rot: -Math.PI / 2 + 0.3 }], env);
      ctx.caption("in situ · the shelter at dusk: lit school windows, living green garden, cobalt cameras, inward-cranked fence");
    },
  },
);
void trackGeometry;
void inkMaterial;

// --------------------------------------------------------- condition sheets

function conditionSheet(ctx: LabContext, ids: Array<[CivicId, number]>, envs: Array<[string, Partial<EnvironmentTarget>]>, title: string): void {
  const items: Item[] = [];
  for (const [id, v] of ids) for (const [name, env] of envs) items.push({ id, variant: v, env, seed: "cond", label: `${id} ${name}` });
  lineup(ctx, items, title, { perRow: envs.length, el: 26, gap: 7 });
}

scenes.push(
  {
    name: "civic-ruin-sheet",
    description: "Ruin progression: 0, 0.3, 0.6, 0.9.",
    build(ctx) {
      conditionSheet(
        ctx,
        [
          ["farmhouse", 0],
          ["clinic", 0],
          ["church", 0],
          ["town-houses", 1],
        ],
        [
          ["r0", {}],
          ["r0.3", { ruin: 0.3 }],
          ["r0.6", { ruin: 0.6, fire: 0.4 }],
          ["r0.9", { ruin: 0.9, fire: 0.6 }],
        ],
        "ruin progression",
      );
    },
  },
  {
    name: "civic-ruin-sheet-b",
    description: "Ruin progression for rail and rural ids.",
    build(ctx) {
      conditionSheet(
        ctx,
        [
          ["barn", 0],
          ["signal-box", 0],
          ["windmill", 0],
          ["mill", 1],
        ],
        [
          ["r0", {}],
          ["r0.3", { ruin: 0.3 }],
          ["r0.6", { ruin: 0.6, fire: 0.4 }],
          ["r0.9", { ruin: 0.9, fire: 0.6 }],
        ],
        "ruin progression (rural / rail)",
      );
    },
  },
  {
    name: "civic-state-sheet",
    description: "Intact, abandoned, sealed (perfection), night.",
    build(ctx) {
      conditionSheet(
        ctx,
        [
          ["farmhouse", 2],
          ["clinic", 0],
          ["school", 0],
        ],
        [
          ["intact", {}],
          ["abandoned", { habitation: 0.05 }],
          ["sealed", { perfection: 0.95, uniformity: 0.9 }],
          ["night", { timeOfDay: 0.92, gloom: 0.3 }],
        ],
        "states: intact · abandoned (habitation 0.05) · sealed (perfection 0.95) · night",
      );
    },
  },
);

// Named per-id sheets, browsable without params.
for (const id of Object.keys(CIVIC_VARIANTS) as CivicId[]) {
  scenes.push({
    name: `civic-sheet-${id}`,
    description: `All ${CIVIC_VARIANTS[id]} variants of ${id}.`,
    build: (ctx) => lineup(ctx, vs(id, CIVIC_VARIANTS[id], { rotY: id === "bridge" ? Math.PI / 2 : 0 }), `${id} sheet`, { el: 22, gap: 6 }),
  });
}

scenes.push({
  name: "civic-overview",
  description: "Every civic id, variant 0.",
  build(ctx) {
    const order: CivicId[] = ["farmhouse", "barn", "windmill", "mill", "water-tower", "greenhouse", "church", "school", "library", "clinic", "courthouse", "town-houses", "signal-box", "station", "depot", "warehouse", "dispatch-office", "bridge", "hospital", "garden", "orchard", "camp", "shelter"];
    lineup(ctx, order.map((id) => ({ id, variant: 0, rotY: id === "bridge" ? Math.PI / 2 : 0 })), "all 23 civic ids (variant 0)", { perRow: 6, el: 30, gap: 8 });
  },
});
