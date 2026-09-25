import * as THREE from "three";
import type { LabContext, LabScene } from "../../lab/types.ts";
import { inSituStage, trackGeometry } from "../../lab/stage-kit.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import { PEOPLE_ROLES, POSES, createGroup, createPerson } from "./index.ts";
import type { PersonUserData } from "./person.ts";
import type { GroupUserData } from "./crowd.ts";
import type { PersonRole, Pose } from "../../api.ts";

/** Labels projected under 3D points (drawn in the DOM, appear in screenshots). */
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

function stats(ctx: LabContext, extra = ""): void {
  let done = false;
  ctx.onFrame(() => {
    if (done) return;
    done = true;
    let tris = 0;
    let meshes = 0;
    ctx.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.userData.person) return;
      meshes++;
      const g = m.geometry;
      const n = g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
      tris += n * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
    });
    ctx.caption(`${extra} people meshes: ${meshes}, people triangles: ${tris.toLocaleString()}`);
  });
}

function tagPeople(root: THREE.Object3D): void {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.person = true;
  });
}

function ticker(ctx: LabContext, objs: THREE.Object3D[]): void {
  ctx.onFrame((dt, t) => {
    for (const o of objs) (o.userData as PersonUserData | GroupUserData).tick(dt, t);
  });
}

export const scenes: LabScene[] = [
  {
    name: "people-lineup",
    description: "All 24 roles, standing, two rows.",
    build(ctx) {
      ctx.standardStage({ sun: [20, 30, 26] });
      const seed = Number(ctx.params.seed ?? 3);
      const objs: THREE.Object3D[] = [];
      const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
      const perRow = 12;
      const sp = 1.02;
      PEOPLE_ROLES.forEach((role, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const p = createPerson({ role, pose: (ctx.params.pose as Pose) ?? "stand", seed: seed * 100 + i, name: role === "worker" ? "Tomas" : undefined, detail: 1 });
        p.position.set((col - (perRow - 1) / 2) * sp + (row % 2) * sp * 0.5, 0, -row * 2.6);
        tagPeople(p);
        ctx.scene.add(p);
        objs.push(p);
        lab.push({ text: role, at: new THREE.Vector3(p.position.x, row ? p.userData.height + 0.12 : -0.02, p.position.z + (row ? 0 : 0.42)) });
      });
      ticker(ctx, objs);
      ctx.view([0, 2.7, 8.4], [0.25, 0.85, -1.3], 30);
      labels(ctx, lab);
      stats(ctx, "lineup:");
    },
  },
  {
    name: "people-closeup",
    description: "Detail check at 6 m.",
    build(ctx) {
      ctx.standardStage({ sun: [20, 30, 26] });
      const roles = ((ctx.params.roles as string) ?? "worker,doctor,commuter,soldier,stationmaster").split(",") as PersonRole[];
      const objs: THREE.Object3D[] = [];
      roles.forEach((role, i) => {
        const p = createPerson({ role, pose: (ctx.params.pose as Pose) ?? "stand", seed: Number(ctx.params.seed ?? 7) + i, name: role === "worker" ? "Tomas" : undefined, detail: 2 });
        p.position.set((i - (roles.length - 1) / 2) * 0.95, 0, 0);
        p.rotation.y = (i - (roles.length - 1) / 2) * -0.12;
        tagPeople(p);
        ctx.scene.add(p);
        objs.push(p);
      });
      ticker(ctx, objs);
      const dist = Number(ctx.params.dist ?? 6);
      ctx.view([0, 1.2 + dist * 0.09, dist], [0, 1.0, 0], 38);
      stats(ctx, `closeup ${dist} m:`);
    },
  },
];


/** Roles that show each pose best. */
const POSE_ROLES: Record<Pose, PersonRole[]> = {
  stand: ["commuter", "elder"],
  walk: ["passenger", "student"],
  work: ["worker", "crew"],
  wave: ["child", "volunteer"],
  sit: ["civilian", "refugee"],
  tied: ["worker", "crew"],
  kneel: ["refugee", "civilian"],
  cower: ["civilian", "child"],
  point: ["inspector", "official"],
  "hold-sign": ["protester", "protester"],
  queue: ["patient", "refugee"],
  carry: ["volunteer", "refugee"],
  lie: ["patient", "civilian"],
  wheelchair: ["patient", "elder"],
  watch: ["police", "stationmaster"],
};

scenes.push({
  name: "people-poses",
  description: "Pose sheet: every pose on two roles.",
  build(ctx) {
    ctx.standardStage({ sun: [20, 30, 26] });
    const t0 = Number(ctx.params.t0 ?? 0);
    const objs: THREE.Object3D[] = [];
    const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
    const look = new THREE.Vector3(0, 1.6, 30);
    const perRow = 5;
    POSES.forEach((pose, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x0 = (col - (perRow - 1) / 2) * 2.7;
      const z0 = -row * 4.8;
      POSE_ROLES[pose].forEach((role, k) => {
        const p = createPerson({ role, pose, seed: 40 + i * 3 + k, lookAt: pose === "watch" || pose === "point" || pose === "wave" ? look : undefined });
        const lying = pose === "tied" || pose === "lie";
        p.position.set(x0 + (k - 0.5) * (lying ? 0 : 0.95), 0, z0 + (lying ? (k - 0.5) * 1.3 : 0));
        if (lying) p.scale.setScalar(0.92);
        tagPeople(p);
        ctx.scene.add(p);
        objs.push(p);
      });
      lab.push({ text: pose, at: new THREE.Vector3(x0, -0.05, z0 + 0.9) });
    });
    ctx.onFrame((dt, t) => {
      for (const o of objs) (o.userData as PersonUserData).tick(dt, t + t0);
    });
    ctx.view([0, 8.2, 9.4], [0, 0.2, -4.6], 46);
    labels(ctx, lab);
    stats(ctx, "poses:");
  },
});

scenes.push({
  name: "people-insitu",
  description: "Cab-eye view: five tied at 25 m, one on the siding, a crowd of 60 at 80 m, a queue of patients.",
  build(ctx) {
    inSituStage(ctx);
    const objs: THREE.Object3D[] = [];
    const rail = 0.63;
    // A siding diverging to the right.
    const turn = -0.18;
    const siding = new THREE.Mesh(trackGeometry(120), inkMaterial({ vertexInk: true, hatch: 0.12 }));
    siding.position.set(0, -0.002, -8);
    siding.rotation.y = turn;
    ctx.scene.add(siding);
    const along = (d: number) => new THREE.Vector3(-Math.sin(turn) * d, 0, -8 - Math.cos(turn) * d);
    const five = createGroup({ role: "worker", count: 5, pose: "tied", seed: "five", name: "Tomas", ground: -rail });
    five.position.set(0, rail, -25);
    ctx.scene.add(five);
    objs.push(five);
    // One worker on the siding.
    const one = createPerson({ role: "crew", pose: "tied", seed: "siding", ground: -rail });
    one.position.copy(along(24)).setY(rail);
    one.rotation.y = turn;
    ctx.scene.add(one);
    objs.push(one);
    // A crowd of 60 beside the line at 80 m, watching the trolley.
    const crowd = createGroup({ role: "civilian", count: 60, pose: "watch", spread: "crowd", seed: "crowd", width: 14, lookAt: new THREE.Vector3(0, 2, 6), mix: ["commuter", "elder", "child", "student"] });
    crowd.position.set(-15, 0, -80);
    ctx.scene.add(crowd);
    objs.push(crowd);
    // A queue of patients toward a clinic door, left of the line.
    const queue = createGroup({ role: "patient", count: 9, pose: "queue", spread: "line", seed: "queue" });
    queue.position.set(-6.5, 0, -42);
    queue.rotation.y = Math.PI * 0.92;
    ctx.scene.add(queue);
    objs.push(queue);
    // A few figures near the line for scale.
    const watchers: Array<[PersonRole, number, number, Pose]> = [
      ["stationmaster", 3.4, -14, "watch"],
      ["engineer", -3.6, -18, "work"],
      ["commuter", 5.2, -34, "walk"],
    ];
    for (const [role, x, z, pose] of watchers) {
      const p = createPerson({ role, pose, seed: `${role}${z}`, lookAt: new THREE.Vector3(0, 2.5, 6) });
      p.position.set(x, 0, z);
      p.rotation.y = x > 0 ? -0.8 : 0.9;
      ctx.scene.add(p);
      objs.push(p);
    }
    for (const o of objs) tagPeople(o);
    ticker(ctx, objs);
    if (ctx.params.cam) ctx.view(ctx.params.cam as [number, number, number], ctx.params.look as [number, number, number], Number(ctx.params.fov ?? 40));
    else if (ctx.params.fov) ctx.view([0, 2.55, 6], [Number(ctx.params.lx ?? 0), 1.2, Number(ctx.params.lz ?? -60)], Number(ctx.params.fov));
    stats(ctx, "in-situ:");
  },
});

scenes.push({
  name: "people-struck",
  description: "Struck reaction filmstrip: the same impact sampled at increasing times.",
  build(ctx) {
    ctx.standardStage({ sun: [20, 30, 26] });
    const times = [0, 0.15, 0.3, 0.5, 0.75, 1.1, 1.6, 3, 6];
    const objs: THREE.Object3D[] = [];
    const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
    const role = (ctx.params.role as PersonRole) ?? "worker";
    const pose = (ctx.params.pose as Pose) ?? "stand";
    times.forEach((dt, i) => {
      const p = createPerson({ role, pose, seed: 5 });
      p.position.set(0, 0, 0);
      const holder = new THREE.Group();
      holder.position.set((i - (times.length - 1) / 2) * 3.4, 0, 0);
      holder.rotation.y = Math.PI / 2;
      holder.add(p);
      ctx.scene.add(holder);
      holder.updateMatrixWorld(true);
      const ud = p.userData as PersonUserData;
      ud.tick(1 / 60, 0);
      ud.react("struck", new THREE.Vector3(1, 0, 0));
      for (let t = 0; t < dt; t += 1 / 60) ud.tick(1 / 60, t);
      tagPeople(p);
      objs.push(p);
      lab.push({ text: `${dt}s`, at: new THREE.Vector3(holder.position.x, -0.05, 1.6) });
    });
    if (ctx.params.zoom) ctx.view([13.6 + 2, 3.2, 4.5], [13.6, 0.2, 0], 40);
    else ctx.view([0, 7, 17], [0, 0.5, 0], 40);
    labels(ctx, lab);
    stats(ctx, "struck:");
  },
});

scenes.push({
  name: "people-crowd",
  description: "Crowd scaling: 12, 60, 400.",
  build(ctx) {
    ctx.standardStage({ sun: [20, 30, 26] });
    const objs: THREE.Object3D[] = [];
    const specs: Array<[number, number, number]> = [
      [12, -14, -10],
      [60, 0, -25],
      [400, 18, -60],
    ];
    for (const [n, x, z] of specs) {
      const g = createGroup({ role: "protester", count: n, pose: n > 100 ? "stand" : "hold-sign", seed: `c${n}`, mix: ["civilian", "student"] });
      g.position.set(x, 0, z);
      ctx.scene.add(g);
      objs.push(g);
    }
    for (const o of objs) tagPeople(o);
    ticker(ctx, objs);
    ctx.view([0, 9, 18], [4, 0, -35], 50);
    stats(ctx, "crowd:");
  },
});

scenes.push({
  name: "people-motion",
  description: "One pose sampled at successive times (side view), for judging cycles.",
  build(ctx) {
    ctx.standardStage({ sun: [20, 30, 26] });
    const role = (ctx.params.role as PersonRole) ?? "commuter";
    const pose = (ctx.params.pose as Pose) ?? "walk";
    const n = Number(ctx.params.n ?? 8);
    const span = Number(ctx.params.span ?? 1.1);
    const react = ctx.params.react as "flinch" | undefined;
    const lab: Array<{ text: string; at: THREE.Vector3 }> = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * span;
      const p = createPerson({ role, pose, seed: Number(ctx.params.seed ?? 3), detail: 1 });
      const holder = new THREE.Group();
      holder.position.set((i - (n - 1) / 2) * 1.25, 0, 0);
      holder.rotation.y = Number(ctx.params.yaw ?? Math.PI / 2);
      holder.add(p);
      ctx.scene.add(holder);
      holder.updateMatrixWorld(true);
      const ud = p.userData as PersonUserData;
      if (react) {
        ud.tick(1 / 60, 0);
        ud.react(react, new THREE.Vector3(0, 0, 1));
        for (let k = 0; k < t; k += 1 / 60) ud.tick(1 / 60, k);
      } else {
        // Sample the cycle directly at time t (phase-aligned to the first).
        ud.tick(0, t);
      }
      tagPeople(p);
      lab.push({ text: `${t.toFixed(2)}s`, at: new THREE.Vector3(holder.position.x, -0.02, 0.6) });
    }
    ctx.view([0, 1.3, Number(ctx.params.dist ?? 7)], [0, 0.9, 0], 48);
    labels(ctx, lab);
  },
});
