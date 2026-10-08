import * as THREE from "three";
import type { LabContext, LabScene } from "../../lab/types.ts";
import { inSituStage, CAB_EYE, CAB_FOV } from "../../lab/stage-kit.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { Kit, block } from "../../core/geometry.ts";
import type { MachineId, VehicleId } from "../../api.ts";
import { VEHICLE_IDS, buildMachine, buildVehicle, createDroneSwarm, type Condition } from "./index.ts";
import { triangles } from "./common.ts";
import type { SwarmFormation } from "./drones.ts";

const RAIL_TOP = 0.63;

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
      el.style.cssText = `position:fixed;left:${((p.x + 1) / 2) * innerWidth}px;top:${((1 - p.y) / 2) * innerHeight}px;transform:translate(-50%,0);font:${size}px/1.2 ui-monospace,monospace;color:#222;background:rgba(255,255,255,.82);padding:1px 4px;z-index:4;white-space:nowrap`;
      document.body.append(el);
    }
  });
}

function ticker(ctx: LabContext, objs: THREE.Object3D[]): void {
  ctx.onFrame((dt, t) => {
    for (const o of objs) (o.userData.tick as ((dt: number, t: number) => void) | undefined)?.(dt, t);
  });
}

type Any = VehicleId | MachineId;
const isVehicle = (id: Any): id is VehicleId => (VEHICLE_IDS as readonly string[]).includes(id);

function build(id: Any, seed: number, condition?: Condition, extra: Record<string, unknown> = {}): THREE.Object3D {
  const cond = condition ? { condition } : {};
  if (isVehicle(id)) return buildVehicle(id, { seed, ...cond, ...extra });
  return buildMachine(id as MachineId, { seed, ...cond, ...extra });
}

function fp(o: THREE.Object3D): { width: number; depth: number; height: number } {
  return (o.userData.footprint as { width: number; depth: number; height: number }) ?? { width: 1, depth: 1, height: 1 };
}

/** A short straight track for rail lineups (lab only). */
function trackStrip(length: number, x = 0): THREE.Mesh {
  const k = new Kit();
  k.add(block(3.4, 0.32, length), { tone: "pale", position: [x, 0, 0] });
  for (let z = -length / 2 + 0.3; z < length / 2; z += 0.62) k.add(block(2.6, 0.16, 0.24), { tone: "light", position: [x, 0.32, z] });
  for (const s of [-1, 1]) k.add(block(0.07, 0.15, length), { tone: "mid", position: [x + (s * 1.435) / 2, 0.48, 0] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.12 }));
}

/** A two-lane road along Z at x (lab only). */
function road(x: number, length: number): THREE.Mesh {
  const k = new Kit();
  k.add(block(7.2, 0.04, length), { tone: "pale", position: [x, 0, -length / 2 + 20] });
  for (let z = 20; z > -length + 20; z -= 9) k.add(block(0.14, 0.05, 4.5), { tone: "dark", position: [x, 0, z] });
  for (const s of [-1, 1]) k.add(block(0.12, 0.05, length), { tone: "mid", position: [x + s * 3.3, 0, -length / 2 + 20] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.2, edge: 0.5 }));
}

/** Ploughed field furrows (lab only). */
function field(x0: number, x1: number, z0: number, z1: number, pitch = 1.6): THREE.Mesh {
  const k = new Kit();
  for (let x = x0; x < x1; x += pitch) k.add(block(0.5, 0.18, Math.abs(z1 - z0)), { tone: "pale", position: [x, 0, (z0 + z1) / 2] });
  return new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.3, edge: 0.35, pattern: "stipple", shade: 0.5 }));
}

function statsCaption(ctx: LabContext, objs: THREE.Object3D[], label: string): void {
  let tris = 0,
    calls = 0;
  for (const o of objs) {
    const s = triangles(o);
    tris += s.triangles;
    calls += s.drawCalls;
  }
  ctx.caption(`${label} — ${objs.length} assets, ${tris.toLocaleString()} triangles, ${calls} draw calls`);
}

export const scenes: LabScene[] = [
  {
    name: "machines-dev",
    description: "One asset from three angles. params: id, seed, cond, dist, h, single",
    build(ctx) {
      ctx.standardStage({ sun: [20, 30, 26] });
      const id = String(ctx.params.id ?? "car") as Any;
      const seed = Number(ctx.params.seed ?? 0);
      const cond = ctx.params.cond as Condition | undefined;
      const angles = ctx.params.single !== undefined ? [Number(ctx.params.single)] : [0.62, Math.PI / 2, Math.PI - 0.62];
      const objs: THREE.Object3D[] = [];
      const probe = build(id, seed, cond);
      const f = fp(probe);
      const span = Math.max(f.depth, f.width, f.height * 0.8) * 1.15;
      angles.forEach((ang, i) => {
        const o = i === 0 ? probe : build(id, seed, cond);
        o.position.set((i - (angles.length - 1) / 2) * span, id === "drone" ? 1.2 : 0, 0);
        o.rotation.y = ang;
        ctx.scene.add(o);
        objs.push(o);
      });
      const s = triangles(probe);
      ticker(ctx, objs);
      const dist = Number(ctx.params.dist ?? Math.max(span * 2.4, f.height * 3));
      const h = Number(ctx.params.h ?? dist * 0.28);
      ctx.view([0, h, dist], [0, f.height * 0.45, 0], 38);
      ctx.caption(`${id} seed ${seed} ${cond ?? "normal"}: ${s.triangles} triangles, ${s.drawCalls} draw calls`);
    },
  },
  {
    name: "machines-lineup-road",
    description: "Every road vehicle, three-quarter view from ~25° above eye level.",
    build(ctx) {
      ctx.standardStage({ sun: [26, 34, 30] });
      const ids: VehicleId[] = ["bicycle", "car", "van", "ambulance", "tractor", "truck", "fire-engine", "bus", "military-truck", "armored-vehicle"];
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const rows: VehicleId[][] = [ids.slice(0, 5), ids.slice(5)];
      rows.forEach((row, ri) => {
        let x = -17.5;
        for (const id of row) {
          const o = buildVehicle(id, { seed: Number(ctx.params.seed ?? 1) });
          const f = fp(o);
          const w = Math.max(3.0, f.depth * 0.78 + 1.2);
          o.position.set(x + w / 2, 0, -ri * 10);
          o.rotation.y = -Math.PI / 2 + 0.55;
          ctx.scene.add(o);
          objs.push(o);
          const s = triangles(o);
          lab.push({ text: `${id} · ${s.triangles}△`, at: new THREE.Vector3(o.position.x, -0.1, o.position.z + 2.6) });
          x += w + (ri ? 1.0 : 1.2);
        }
      });
      ticker(ctx, objs);
      ctx.view([1.5, 10.5, 23], [1.5, 0.8, -4.5], 50);
      labels(ctx, lab);
      statsCaption(ctx, objs, "road vehicles");
    },
  },
  {
    name: "machines-lineup-rail",
    description: "Rolling stock on standard gauge.",
    build(ctx) {
      ctx.standardStage({ sun: [26, 34, 30] });
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const items: Array<{ id: VehicleId; variant?: "van" | "tank" | "container" }> = [
        { id: "passenger-carriage" },
        { id: "rescue-carriage" },
        { id: "freight-wagon", variant: "van" },
        { id: "freight-wagon", variant: "tank" },
        { id: "freight-wagon", variant: "container" },
        { id: "catering-trolley" },
      ];
      items.forEach((it, i) => {
        const x = (i - (items.length - 1) / 2) * 5.6;
        const len = it.id === "catering-trolley" ? 8 : 24;
        ctx.scene.add(trackStrip(len, x));
        const o = buildVehicle(it.id, { seed: 2, ...(it.variant ? { variant: it.variant } : {}) });
        o.position.set(x, RAIL_TOP, 0);
        o.rotation.y = Math.PI;
        ctx.scene.add(o);
        objs.push(o);
        const s = triangles(o);
        lab.push({ text: `${it.variant ? `freight (${it.variant})` : it.id} · ${s.triangles}△`, at: new THREE.Vector3(x, 0.2, 13.2) });
      });
      ticker(ctx, objs);
      ctx.view([-4, 8.5, 30], [0.5, 1.4, -1], 52);
      labels(ctx, lab);
      statsCaption(ctx, objs, "rolling stock (tail ends toward camera)");
    },
  },
  {
    name: "machines-lineup-small",
    description: "The person-scale machines, close: robots in three poses, quadruped, drone, kill switch, rack, terminal, switchboard.",
    build(ctx) {
      ctx.standardStage({ sun: [22, 30, 30] });
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const place = (o: THREE.Object3D, x: number, z: number, text: string, ry = 0.35, y = 0) => {
        o.position.set(x, y, z);
        o.rotation.y = ry;
        ctx.scene.add(o);
        objs.push(o);
        const s = triangles(o);
        lab.push({ text: `${text} · ${s.triangles}△`, at: new THREE.Vector3(x, -0.02, z + 0.8) });
      };
      place(buildMachine("kill-switch", { seed: 1 }), -5.6, 1.2, "kill-switch", 0.4);
      place(buildMachine("robot-humanoid", { seed: 1, pose: "watch" }), -4.3, 1.2, "humanoid · watch", 0.25);
      place(buildMachine("robot-humanoid", { seed: 1, pose: "stand" }), -3.2, 1.2, "stand", 0.45);
      place(buildMachine("robot-humanoid", { seed: 1, pose: "work" }), -2.1, 1.2, "work", -0.35);
      place(buildMachine("robot-quadruped", { seed: 2 }), -0.4, 1.2, "quadruped", 0.9);
      place(buildMachine("drone", { seed: 1 }), 1.5, 1.2, "drone", 0.5, 1.5);
      place(buildMachine("server-rack", { seed: 3 }), 3.2, 0.2, "server-rack", 0.3);
      place(buildMachine("terminal", { seed: 1 }), 5.0, -1.4, "terminal", -0.2);
      place(buildMachine("switchboard", { seed: 1 }), 7.6, -1.6, "switchboard", -0.35);
      ticker(ctx, objs);
      ctx.view([0.8, 3.4, 9.2], [0.8, 0.95, -0.4], 52);
      labels(ctx, lab);
      statsCaption(ctx, objs, "machines, person scale");
    },
  },
  {
    name: "machines-lineup-large",
    description: "The plant-scale machines: cabinet, transformer, pump, sorter, camera mast, antenna.",
    build(ctx) {
      ctx.standardStage({ sun: [22, 30, 30] });
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const place = (o: THREE.Object3D, x: number, z: number, text: string, ry = 0.35) => {
        o.position.set(x, 0, z);
        o.rotation.y = ry;
        ctx.scene.add(o);
        objs.push(o);
        const s = triangles(o);
        lab.push({ text: `${text} · ${s.triangles}△`, at: new THREE.Vector3(x, -0.02, z + 1.9) });
      };
      place(buildMachine("isolation-cabinet", { seed: 1 }), -9.2, 0, "isolation-cabinet", 0.5);
      place(buildMachine("transformer", { seed: 1 }), -5.6, 0, "transformer", 0.4);
      place(buildMachine("pump", { seed: 1 }), -2.0, 0, "pump", 1.0);
      place(buildMachine("sorter", { seed: 1 }), 2.6, -0.6, "sorter", 0.15);
      place(buildMachine("camera-mast", { seed: 1 }), 6.8, -0.5, "camera-mast", -0.5);
      place(buildMachine("antenna", { seed: 1 }), 10.4, -2.5, "antenna", 0.25);
      ticker(ctx, objs);
      ctx.view([0.5, 5.2, 17.5], [0.5, 2.6, -1], 52);
      labels(ctx, lab);
      statsCaption(ctx, objs, "machines, plant scale");
    },
  },
  {
    name: "machines-lineup-machines",
    description: "Every machine, with the humanoid in three poses.",
    build(ctx) {
      ctx.standardStage({ sun: [22, 30, 30] });
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const place = (o: THREE.Object3D, x: number, z: number, text: string, ry = 0.35, y = 0) => {
        o.position.set(x, y, z);
        o.rotation.y = ry;
        ctx.scene.add(o);
        objs.push(o);
        const s = triangles(o);
        lab.push({ text: `${text} · ${s.triangles}△`, at: new THREE.Vector3(x, -0.05, z + 1.1) });
      };
      place(buildMachine("kill-switch", { seed: 1 }), -9.6, 3, "kill-switch");
      place(buildMachine("robot-humanoid", { seed: 1, pose: "watch" }), -7.6, 3, "humanoid · watch", 0.2);
      place(buildMachine("robot-humanoid", { seed: 1, pose: "stand" }), -6.2, 3, "stand", 0.5);
      place(buildMachine("robot-humanoid", { seed: 1, pose: "work" }), -4.8, 3, "work", -0.3);
      place(buildMachine("robot-quadruped", { seed: 2 }), -2.6, 3, "quadruped", 0.9);
      place(buildMachine("drone", { seed: 1 }), -0.2, 3, "drone", 0.5, 1.4);
      place(buildMachine("server-rack", { seed: 3 }), 2.0, 3, "server-rack", 0.25);
      place(buildMachine("terminal", { seed: 1 }), 4.6, 3, "terminal", -0.1);
      place(buildMachine("switchboard", { seed: 1 }), 7.8, 3, "switchboard", -0.25);
      place(buildMachine("isolation-cabinet", { seed: 1 }), -10, -4, "isolation-cabinet", 0.45);
      place(buildMachine("transformer", { seed: 1 }), -6.5, -4, "transformer", 0.35);
      place(buildMachine("pump", { seed: 1 }), -3.0, -4, "pump", 1.0);
      place(buildMachine("sorter", { seed: 1 }), 1.6, -4, "sorter", 0.1);
      place(buildMachine("camera-mast", { seed: 1 }), 6.0, -4, "camera-mast", -0.4);
      place(buildMachine("antenna", { seed: 1 }), 9.5, -5, "antenna", 0.2);
      ticker(ctx, objs);
      ctx.view([0, 7.5, 17], [0, 1.5, -1.5], 50);
      labels(ctx, lab);
      statsCaption(ctx, objs, "machines");
    },
  },
  {
    name: "machines-insitu",
    description: "From the cab: an ambulance on a road beside the line, a swarm gridding over fields, a robot at a trackside cabinet, a rescue carriage on the rails ahead.",
    build(ctx) {
      inSituStage(ctx, { sun: [35, 48, 30] });
      const objs: THREE.Object3D[] = [];
      ctx.scene.add(road(-10, 260));
      ctx.scene.add(field(12, 70, -30, -140));
      const amb = buildVehicle("ambulance", { seed: 4, speed: 9 });
      amb.position.set(-11.6, 0, -27);
      ctx.scene.add(amb);
      objs.push(amb);
      const car = buildVehicle("car", { seed: 7, speed: 12 });
      car.position.set(-8.4, 0, -66);
      car.rotation.y = Math.PI;
      ctx.scene.add(car);
      objs.push(car);
      const swarm = createDroneSwarm({ count: Number(ctx.params.count ?? 120), seed: "insitu", formation: "cloud" });
      swarm.position.set(30, 6, -62);
      swarm.rotation.y = -0.35;
      ctx.scene.add(swarm);
      objs.push(swarm);
      (swarm.userData.setFormation as (k: SwarmFormation) => void)(String(ctx.params.formation ?? "grid") as SwarmFormation);
      const cab = buildMachine("isolation-cabinet", { seed: 2 });
      cab.position.set(5.2, 0, -16);
      cab.rotation.y = -Math.PI / 2 + 0.35;
      ctx.scene.add(cab);
      objs.push(cab);
      const bot = buildMachine("robot-humanoid", { seed: 2, pose: "work" });
      bot.position.set(4.25, 0, -15.1);
      bot.rotation.y = Math.PI / 2 + 0.35;
      ctx.scene.add(bot);
      objs.push(bot);
      const mast = buildMachine("camera-mast", { seed: 3 });
      mast.position.set(-4.2, 0, -36);
      ctx.scene.add(mast);
      objs.push(mast);
      (mast.userData.track as (p: THREE.Vector3 | null) => void)(new THREE.Vector3(...CAB_EYE));
      const rc = buildVehicle("rescue-carriage", { seed: 1 });
      rc.position.set(0, RAIL_TOP, -62);
      rc.rotation.y = Math.PI;
      ctx.scene.add(rc);
      objs.push(rc);
      ticker(ctx, objs);
      ctx.view(CAB_EYE, [0, 1.6, -60], CAB_FOV);
      statsCaption(ctx, objs, "in situ, cab eye");
    },
  },
  {
    name: "machines-insitu-watch",
    description: "Surveillance stage from the cab: a swarm drawn into an eye over the line, camera masts turning to the cab, a kill switch at the lineside, an armoured vehicle tracking.",
    build(ctx) {
      inSituStage(ctx, { sun: [-30, 40, 20] });
      const objs: THREE.Object3D[] = [];
      const eye = new THREE.Vector3(...CAB_EYE);
      const swarm = createDroneSwarm({ count: Number(ctx.params.count ?? 220), seed: "watch", formation: "cloud" });
      swarm.position.set(0, 6, -95);
      ctx.scene.add(swarm);
      objs.push(swarm);
      (swarm.userData.setFormation as (k: SwarmFormation) => void)("eye");
      for (const [x, z] of [
        [-4.2, -18],
        [4.4, -34],
        [-4.2, -52],
        [4.4, -70],
      ] as const) {
        const m = buildMachine("camera-mast", { seed: Math.round(z) });
        m.position.set(x, 0, z);
        ctx.scene.add(m);
        objs.push(m);
        (m.userData.track as (p: THREE.Vector3 | null) => void)(eye);
      }
      const ks = buildMachine("kill-switch", { seed: 1 });
      ks.position.set(2.9, 0, -12);
      ks.rotation.y = -0.35;
      ctx.scene.add(ks);
      objs.push(ks);
      const apc = buildVehicle("armored-vehicle", { seed: 2 });
      apc.position.set(-14, 0, -40);
      apc.rotation.y = 0.4;
      ctx.scene.add(apc);
      objs.push(apc);
      (apc.userData.aim as (p: THREE.Vector3 | null) => void)(eye);
      const drone = buildMachine("drone", { seed: 5 });
      drone.position.set(-3.5, 4.2, -9);
      drone.rotation.y = 0.5;
      ctx.scene.add(drone);
      objs.push(drone);
      (drone.userData.track as (p: THREE.Vector3 | null) => void)(eye);
      ticker(ctx, objs);
      ctx.view(CAB_EYE, [0, 3.2, -60], CAB_FOV);
      statsCaption(ctx, objs, "in situ, surveillance");
    },
  },
  {
    name: "machines-closeup",
    description: "Detail check at 6–9 m: the ambulance, or the android at the cabinet (params: which=robot).",
    build(ctx) {
      ctx.standardStage({ sun: [24, 30, 28] });
      const objs: THREE.Object3D[] = [];
      const which = String(ctx.params.which ?? "ambulance");
      if (which === "ambulance") {
        const amb = buildVehicle("ambulance", { seed: 4 });
        amb.rotation.y = 1.45;
        ctx.scene.add(amb);
        objs.push(amb);
        ticker(ctx, objs);
        ctx.view([6.4, 2.1, 7.4], [0.2, 1.3, 0], 44);
      } else {
        const cab = buildMachine("isolation-cabinet", { seed: 2 });
        cab.position.set(0.9, 0, -0.6);
        cab.rotation.y = -Math.PI / 2 + 0.1;
        ctx.scene.add(cab);
        const bot = buildMachine("robot-humanoid", { seed: 2, pose: (ctx.params.pose as "work" | "watch" | "stand") ?? "work" });
        bot.position.set(-0.08, 0, -0.52);
        bot.rotation.y = Math.PI / 2 + 0.1;
        ctx.scene.add(bot);
        objs.push(cab, bot);
        const eye = new THREE.Vector3(-1.2, 1.7, 3.4);
        if (ctx.params.look) (bot.userData.lookAt as (p: THREE.Vector3 | null) => void)(eye);
        ticker(ctx, objs);
        ctx.view([eye.x, eye.y, eye.z], [0.25, 1.15, -0.5], 40);
      }
      statsCaption(ctx, objs, `close-up · ${which}`);
    },
  },
  {
    name: "machines-swarm",
    description: "The four swarm formations (morphing from a cloud; use --t 8 to see them settled).",
    build(ctx) {
      ctx.standardStage({ sun: [30, 40, 20] });
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const kinds: SwarmFormation[] = ["cloud", "grid", "wall", "eye"];
      kinds.forEach((kind, i) => {
        const s = createDroneSwarm({ count: Number(ctx.params.count ?? 160), seed: `sheet${i}`, formation: "cloud" });
        s.position.set((i - 1.5) * 44, 0, -30);
        ctx.scene.add(s);
        objs.push(s);
        if (kind !== "cloud") (s.userData.setFormation as (k: SwarmFormation) => void)(kind);
        lab.push({ text: kind, at: new THREE.Vector3((i - 1.5) * 44, 0, -12) });
      });
      ticker(ctx, objs);
      ctx.view([0, 14, 70], [0, 9, -30], 50);
      labels(ctx, lab, 13);
      statsCaption(ctx, objs, "drone swarms (160 each)");
    },
  },
  {
    name: "machines-conditions",
    description: "The same fleet in ruin, normal and the pristine order.",
    build(ctx) {
      ctx.standardStage({ sun: [26, 34, 30] });
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const ids: Any[] = ["car", "van", "ambulance", "bus", "server-rack", "robot-humanoid", "kill-switch"];
      (["wreck", "normal", "pristine"] as Condition[]).forEach((cond, ri) => {
        let x = -20;
        for (const id of ids) {
          const o = build(id, 3, cond, id === "robot-humanoid" ? { pose: "watch" } : {});
          const f = fp(o);
          const w = Math.max(1.6, f.depth * 0.7 + 1.0);
          o.position.set(x + w / 2, 0, -ri * 8.5);
          o.rotation.y = -Math.PI / 2 + 0.55;
          ctx.scene.add(o);
          objs.push(o);
          x += w + 0.8;
        }
        lab.push({ text: cond, at: new THREE.Vector3(-23, 0.2, -ri * 8.5) });
      });
      ticker(ctx, objs);
      ctx.view([0, 14, 22], [0, 0.5, -8], 50);
      labels(ctx, lab, 13);
      statsCaption(ctx, objs, "conditions: wreck / normal / pristine");
    },
  },
];
