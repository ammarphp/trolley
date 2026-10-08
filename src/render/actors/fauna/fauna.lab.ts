import * as THREE from "three";
import type { LabContext, LabScene } from "../../lab/types.ts";
import type { AnimalId } from "../../api.ts";
import { bodyFor, createAnimal } from "./animal.ts";
import { createHerd } from "./herd.ts";
import { createFlock } from "./flock.ts";
import { SPECIES } from "./species/index.ts";
import type { AnimalUserData, Behavior } from "./types.ts";

function labels(ctx: LabContext, items: Array<{ text: string; at: THREE.Vector3 }>, size = 11): void {
  let done = false;
  ctx.onFrame(() => {
    if (done) return;
    done = true;
    ctx.camera.updateMatrixWorld();
    for (const it of items) {
      const p = it.at.clone().project(ctx.camera);
      const el = document.createElement("div");
      el.textContent = it.text;
      el.style.cssText = `position:fixed;left:${((p.x + 1) / 2) * innerWidth}px;top:${((1 - p.y) / 2) * innerHeight}px;transform:translate(-50%,0);font:${size}px/1.2 ui-monospace,monospace;color:#222;background:rgba(255,255,255,.8);padding:1px 4px;z-index:4;white-space:nowrap`;
      document.body.append(el);
    }
  });
}

function ticker(ctx: LabContext, objs: THREE.Object3D[]): void {
  ctx.onFrame((dt, t) => {
    for (const o of objs) (o.userData as unknown as AnimalUserData).tick(dt, t);
  });
}

const ORDER: AnimalId[] = ["horse", "cow", "deer", "pig", "sheep", "goose", "dog", "chicken", "crow", "rabbit"];
const WIDTH: Record<AnimalId, number> = { horse: 2.5, cow: 2.5, deer: 2.0, pig: 1.6, sheep: 1.4, goose: 0.95, dog: 1.05, chicken: 0.6, crow: 0.55, rabbit: 0.5 };

export const scenes: LabScene[] = [
  {
    name: "fauna-stats",
    description: "Triangle counts (near / far meshes), bone counts and first-build cost per species.",
    build(ctx) {
      ctx.standardStage();
      const el = ctx.domStage();
      const rows: string[] = [];
      let totalMs = 0;
      for (const sp of ORDER) {
        const t0 = performance.now();
        const near = bodyFor(sp, 0, false, 1);
        const t1 = performance.now();
        const far = bodyFor(sp, 0, false, 0.5);
        const thin = SPECIES[sp].thinVariant ? bodyFor(sp, 0, true, 1) : null;
        const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count / 3 : 0);
        totalMs += t1 - t0;
        rows.push(
          `<tr><td>${sp}</td><td>${tris(near.geometry)}</td><td>${tris(far.geometry)}</td><td>${thin ? tris(thin.geometry) : "-"}</td><td>${near.rig.count}</td><td>${near.geometry.getAttribute("position").count}</td><td>${(t1 - t0).toFixed(1)}</td></tr>`,
        );
      }
      // A herd of 60, to measure creation and per-tick cost.
      const t2 = performance.now();
      const herd = createHerd({ species: "cow", count: 60, seed: "stats", radius: 30 });
      const t3 = performance.now();
      const hud = herd.userData as unknown as { tick: (dt: number, t: number) => void };
      const t4 = performance.now();
      for (let i = 0; i < 120; i++) hud.tick(1 / 60, i / 60);
      const t5 = performance.now();
      const flock = createFlock({ kind: "starlings", count: 1000, seed: "stats" });
      const c = new THREE.Vector3(0, 40, -100);
      const t6 = performance.now();
      for (let i = 0; i < 120; i++) flock.update(1 / 60, i / 60, c);
      const t7 = performance.now();
      el.innerHTML = `<main style="font:14px/1.5 ui-monospace,monospace;padding:24px"><h2 style="font:600 18px system-ui">Fauna budgets</h2>
        <table cellpadding="6" style="border-collapse:collapse" border="1"><tr><th>species</th><th>tris near (detail 1)</th><th>tris far (0.5)</th><th>tris thin</th><th>bones</th><th>verts near</th><th>first build ms</th></tr>${rows.join("")}</table>
        <p>First builds total (incl. coat atlases): ${totalMs.toFixed(0)} ms</p>
        <p>Herd of 60 cows: create ${(t3 - t2).toFixed(1)} ms; tick ${((t5 - t4) / 120).toFixed(3)} ms/frame (all animals treated as visible)</p>
        <p>Starling murmuration, 1000 birds: update ${((t7 - t6) / 120).toFixed(3)} ms/frame; draw calls ${flock.object.children.length} (instanced wingbeat frames)</p></main>`;
    },
  },
  {
    name: "fauna-sheet",
    description: "Presentation sheet: every AnimalId in two rows, about 25 degrees above eye level.",
    build(ctx) {
      ctx.standardStage({ sun: [22, 34, 30] });
      const back: Array<[AnimalId, Behavior, number, number]> = [
        ["horse", "alert", 1.0, 0],
        ["cow", "graze", 1.05, 3],
        ["deer", "alert", 0.95, 1],
        ["pig", "walk", 1.1, 2],
        ["sheep", "graze", 1.15, 0],
      ];
      const front: Array<[AnimalId, Behavior, number, number]> = [
        ["dog", "alert", 1.0, 0],
        ["goose", "walk", 1.0, 0],
        ["chicken", "graze", 1.2, 1],
        ["crow", "alert", 1.0, 0],
        ["rabbit", "alert", 1.1, 0],
      ];
      const camPos = new THREE.Vector3(0, 4.3, 9.4);
      const lookTo = ctx.params.look === true ? camPos : null;
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const row = (list: typeof back, z: number, gap: number) => {
        const widths = list.map(([sp]) => WIDTH[sp]);
        const total = widths.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
        let x = -total / 2;
        list.forEach(([sp, b, ry, v], i) => {
          const w = widths[i]!;
          const a = createAnimal(sp, { seed: `sheet:${sp}`, behavior: b, anchored: true, lookAt: lookTo, variant: v });
          a.position.set(x + w / 2, 0, z);
          a.rotation.y = ry;
          ctx.scene.add(a);
          objs.push(a);
          lab.push({ text: sp, at: new THREE.Vector3(x + w / 2, 0, z + 0.9) });
          x += w + gap;
        });
      };
      row(back, -1.6, 0.9);
      row(front, 1.5, 0.75);
      ticker(ctx, objs);
      ctx.view([camPos.x, camPos.y, camPos.z], [0, 0.45, -0.2], Number(ctx.params.fov ?? 36));
      labels(ctx, lab, 12);
      ctx.caption("fauna: every AnimalId (back: horse, cow, deer, pig, sheep; front: dog, goose, chicken, crow, rabbit)");
    },
  },
  {
    name: "fauna-takeoff",
    description: "Crows (or any species) startled at t=0.4: take-off, climb and circling (params: species, n).",
    build(ctx) {
      ctx.standardStage({ sun: [26, 38, 30] });
      const species = (ctx.params.species as AnimalId) ?? "crow";
      const n = Number(ctx.params.n ?? 6);
      const objs: THREE.Object3D[] = [];
      for (let i = 0; i < n; i++) {
        const a = createAnimal(species, { seed: `takeoff:${i}`, behavior: i % 2 ? "graze" : "walk", roam: 1.5 });
        a.position.set((i - (n - 1) / 2) * 0.9, 0, (i % 3) * 0.7);
        a.rotation.y = i * 1.3;
        ctx.scene.add(a);
        objs.push(a);
      }
      ticker(ctx, objs);
      let fired = false;
      ctx.onFrame((_dt, t) => {
        if (!fired && t > 0.4) {
          fired = true;
          for (const o of objs) (o.userData as unknown as AnimalUserData).react("flinch", new THREE.Vector3(0, 0, -1));
        }
      });
      const cam = (ctx.params.cam as [number, number, number] | undefined) ?? [0, 3, 14];
      ctx.view(cam, [0, 2.5, -4], Number(ctx.params.fov ?? 50));
      ctx.caption(`${species}: startled at 0.4 s`);
    },
  },
  {
    name: "fauna-lineup",
    description: "Every AnimalId side by side, three-quarter view (params: behavior, thin, ry).",
    build(ctx) {
      ctx.standardStage({ sun: [26, 38, 30] });
      const behavior = (ctx.params.behavior as Behavior) ?? "alert";
      const thin = !!ctx.params.thin;
      const ry = Number(ctx.params.ry ?? 0.55);
      const objs: THREE.Object3D[] = [];
      let x = 0;
      const xs: number[] = [];
      const set = ctx.params.set as string | undefined;
      const list = set === "large" ? ORDER.slice(0, 5) : set === "small" ? ORDER.slice(5) : set ? (set.split(",") as AnimalId[]) : ORDER;
      const look = ctx.params.look === false ? null : new THREE.Vector3(0, 1.4, 30);
      for (const sp of list) {
        const w = WIDTH[sp];
        x += w * 0.5;
        const a = createAnimal(sp, { seed: `lineup:${sp}:${ctx.params.seed ?? 0}`, behavior, anchored: true, env: thin ? { drought: 1 } : {}, lookAt: look, variant: ctx.params.variant as number | undefined });
        a.position.set(x, 0, 0);
        a.rotation.y = ry;
        xs.push(x);
        x += w * 0.5 + 0.35;
        objs.push(a);
      }
      const mid = x / 2;
      for (const o of objs) {
        o.position.x -= mid;
        ctx.scene.add(o);
      }
      ticker(ctx, objs);
      const cam = (ctx.params.cam as [number, number, number] | undefined) ?? [0, 4.6, 12.5];
      ctx.view(cam, [0, 0.55, 0], Number(ctx.params.fov ?? 40));
      labels(ctx, list.map((sp, i) => ({ text: sp, at: new THREE.Vector3(xs[i]! - mid, -0.05, 1.3) })));
      ctx.caption(`fauna lineup: ${behavior}${thin ? " (drought)" : ""}`);
    },
  },
  {
    name: "fauna-poses",
    description: "One species in every behaviour (params: species, strike).",
    build(ctx) {
      ctx.standardStage({ sun: [30, 40, 25] });
      const species = (ctx.params.species as AnimalId) ?? "cow";
      const all: Array<Behavior | "struck" | "thin"> = ["graze", "walk", "alert", "flee", "rest", "thin", "struck"];
      const only = ctx.params.only as string | undefined;
      const list = only ? all.filter((b) => only.split(",").includes(b)) : all;
      const objs: THREE.Object3D[] = [];
      const gap = Number(ctx.params.gap ?? 3.2);
      list.forEach((b, i) => {
        const a = createAnimal(species, {
          seed: `pose:${i}`,
          behavior: b === "struck" || b === "thin" ? "graze" : b,
          anchored: true,
          env: b === "thin" ? { drought: 1 } : {},
          lookAt: new THREE.Vector3(0, 1.5, 12),
        });
        a.position.set((i - (list.length - 1) / 2) * gap, 0, 0);
        a.rotation.y = Number(ctx.params.ry ?? Math.PI / 2);
        ctx.scene.add(a);
        objs.push(a);
        if (b === "struck") ctx.onFrame((_dt, t) => {
          if (t > 0.05 && !(a.userData as unknown as AnimalUserData).struck) (a.userData as unknown as AnimalUserData).react("struck", new THREE.Vector3(1, 0, 0));
        });
      });
      ticker(ctx, objs);
      const h = Number(ctx.params.h ?? 1);
      const cam = (ctx.params.cam as [number, number, number] | undefined) ?? [0, 2.4 * h, 13 * h];
      ctx.view(cam, [0, 0.7 * h, 0], 45);
      labels(ctx, list.map((b, i) => ({ text: b, at: new THREE.Vector3((i - (list.length - 1) / 2) * gap, -0.02, 0.35 * gap) })));
      ctx.caption(`${species}: behaviours`);
    },
  },
];
