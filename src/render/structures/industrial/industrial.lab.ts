/**
 * Lab scenes for the industrial set.
 *
 *   industrial-single     ?params={"id":"data-center","variant":"ruin","seed":1,"az":0.6,"el":22,"dist":1.2}
 *   industrial-lineup-*   comparison sheets by scale class
 *   industrial-variants   one id in all four variants (?params={"id":...})
 *   industrial-insitu-*   cab-eye compositions
 *   industrial-stats      triangle and draw-call counts (printed as warnings)
 */
import * as THREE from "three";
import { INK_GLOBALS, inkMaterial } from "../../core/ink-material.ts";
import type { LabContext, LabScene } from "../../lab/types.ts";
import { CAB_EYE, CAB_FOV, inSituStage } from "../../lab/stage-kit.ts";
import { Kit, block } from "../../core/geometry.ts";
import { SECURITY_FENCE_SEGMENT } from "./index.ts";
import { buildIndustrial, INDUSTRIAL_IDS, type IndustrialId, type IndustrialFootprint, type IndustrialVariant } from "./index.ts";

// ------------------------------------------------------------ lab helpers

function sunOf(ctx: LabContext): THREE.DirectionalLight | null {
  let sun: THREE.DirectionalLight | null = null;
  ctx.scene.traverse((o) => {
    if ((o as THREE.DirectionalLight).isDirectionalLight) sun = o as THREE.DirectionalLight;
  });
  return sun;
}

/** Enlarge the shadow frustum to cover landmark scale, centred on a point. */
function wideShadows(ctx: LabContext, extent: number, centre: [number, number, number] = [0, 0, 0], far = 1600): void {
  const sun = sunOf(ctx);
  if (!sun) return;
  const dir = sun.position.clone().normalize();
  sun.target.position.set(...centre);
  sun.position.set(centre[0] + dir.x * 700, centre[1] + dir.y * 700, centre[2] + dir.z * 700);
  ctx.scene.add(sun.target);
  const cam = sun.shadow.camera;
  cam.left = -extent;
  cam.right = extent;
  cam.top = extent;
  cam.bottom = -extent;
  cam.near = 10;
  cam.far = far;
  cam.updateProjectionMatrix();
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.25;
}

/** A ground sheet far larger than the standard stage. */
function bigGround(ctx: LabContext, size = 5000, tone = 0.04, shadows = true): void {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), inkMaterial({ tone, hatch: 0.25, edge: 0.4 }));
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.02;
  g.receiveShadow = true;
  if (!shadows) g.userData.noShadow = true;
  ctx.scene.add(g);
}

function tickAll(ctx: LabContext, objs: THREE.Object3D[]): void {
  ctx.onFrame((dt, t) => {
    for (const o of objs) (o.userData.tick as ((dt: number, t: number) => void) | undefined)?.(dt, t);
  });
}

function make(id: IndustrialId, variant: IndustrialVariant | undefined, seed: number | string = 1): THREE.Object3D {
  return buildIndustrial(id, { seed, variant });
}

function footprint(o: THREE.Object3D): IndustrialFootprint {
  return o.userData.footprint as IndustrialFootprint;
}

/** Place a row of objects left to right with gaps sized by footprint. */
function row(ctx: LabContext, objs: THREE.Object3D[], gap: number, z = 0): number {
  const widths = objs.map((o) => footprint(o).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (objs.length - 1);
  let x = -total / 2;
  objs.forEach((o, i) => {
    const w = widths[i]!;
    o.position.set(x + w / 2, 0, z - (footprint(o).offsetZ ?? 0));
    ctx.scene.add(o);
    x += w + gap;
  });
  return total;
}

/** The lab camera clips at 1500 m; landmark sheets need more. */
function farPlane(ctx: LabContext, far: number): void {
  ctx.camera.far = Math.max(1500, far);
  ctx.camera.updateProjectionMatrix();
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

function night(ctx: LabContext, gloom = 0.72): void {
  INK_GLOBALS.uInkGloom.value = gloom;
  // A night sky: dense horizontal pen strokes on a dome.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(720, 32, 16), inkMaterial({ tone: 0.93, flat: true, hatch: 2.4, edge: 0, side: THREE.BackSide, hatchAngle: 0.785 }));
  sky.userData.castShadow = false;
  sky.castShadow = false;
  ctx.scene.add(sky);
  // Night ground: a darker sheet laid just over the stage ground.
  const g = new THREE.Mesh(new THREE.CircleGeometry(700, 48), inkMaterial({ tone: 0.3, hatch: 0.11, edge: 0.3 }));
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.012;
  g.receiveShadow = true;
  ctx.scene.add(g);
  ctx.pipeline.look.fogNear = 400;
  ctx.pipeline.look.fogFar = 3200;
}

// ------------------------------------------------------------ scenes

export const scenes: LabScene[] = [
  {
    name: "industrial-single",
    description: "One industrial landmark, framed from its footprint.",
    build(ctx) {
      const p = ctx.params;
      const id = (typeof p.id === "string" ? p.id : "data-center") as IndustrialId;
      const variant = (typeof p.variant === "string" ? p.variant : undefined) as IndustrialVariant | undefined;
      ctx.standardStage({ ground: false, sun: [40, 55, 30] });
      bigGround(ctx);
      const o = make(id, variant, num(p.seed, 1));
      ctx.scene.add(o);
      tickAll(ctx, [o]);
      const f = footprint(o);
      const fov = num(p.fov, 40);
      const vt = Math.tan(((fov / 2) * Math.PI) / 180);
      const az = num(p.az, 0.55);
      const el = (num(p.el, 22) * Math.PI) / 180;
      // Fit the plan diagonal across the frame and the height into it.
      const span = Math.hypot(f.width, f.depth) * 0.5;
      const dist = Math.max(span / (vt * 1.7), (f.height * 0.62) / vt + span * 0.4) * num(p.dist, 1);
      const oz = f.offsetZ ?? 0;
      const ty = num(p.ty, f.height * 0.32);
      ctx.view([Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist + ty, oz + Math.cos(az) * Math.cos(el) * dist], [num(p.tx, 0), ty, oz], fov);
      wideShadows(ctx, Math.max(span * 1.4, f.height), [0, 0, oz], 2400);
      ctx.pipeline.look.fogNear = Math.max(140, dist * 0.8);
      ctx.pipeline.look.fogFar = Math.max(900, dist * 3);
      farPlane(ctx, dist * 4);
      if (p.night) {
        night(ctx, num(p.night, 0.72));
        (o.userData.setNight as ((on: boolean) => void) | undefined)?.(true);
      }
      ctx.caption(`${id} · ${o.userData.variant} · seed ${num(p.seed, 1)}`);
    },
  },
  {
    name: "industrial-variants",
    description: "One id in intact / construction / ruin / pristine.",
    build(ctx) {
      const p = ctx.params;
      const id = (typeof p.id === "string" ? p.id : "data-center") as IndustrialId;
      ctx.standardStage({ ground: false, sun: [40, 55, 30] });
      bigGround(ctx);
      const vs: IndustrialVariant[] = ["intact", "construction", "ruin", "pristine"];
      const objs = vs.map((v) => make(id, v, num(p.seed, 1)));
      // 2 x 2 grid: intact | construction over ruin | pristine.
      const fw = Math.max(...objs.map((o) => footprint(o).width));
      const fd = Math.max(...objs.map((o) => footprint(o).depth));
      const hMax = Math.max(...objs.map((o) => footprint(o).height));
      const gx = fw * 0.5 + Math.max(8, fw * 0.08),
        gz = fd * 0.5 + Math.max(8, fd * 0.1);
      objs.forEach((o, i) => {
        o.position.set(i % 2 ? gx : -gx, 0, (i < 2 ? -gz : gz) - (footprint(o).offsetZ ?? 0));
        ctx.scene.add(o);
      });
      tickAll(ctx, objs);
      const el = (num(p.el, 32) * Math.PI) / 180;
      const span = Math.max(gx * 2 + fw, (gz * 2 + fd) * 1.2, hMax * 2);
      const dist = span * num(p.dist, 1.05);
      ctx.view([0, Math.sin(el) * dist + hMax * 0.2, Math.cos(el) * dist], [0, hMax * 0.2, 0], 40);
      wideShadows(ctx, span, [0, 0, 0], 3000);
      ctx.pipeline.look.fogNear = dist * 0.9;
      ctx.pipeline.look.fogFar = dist * 4;
      farPlane(ctx, dist * 4);
      ctx.caption(`${id}: intact · construction (back row) / ruin · pristine (front row)`);
    },
  },
  {
    name: "industrial-stats",
    description: "Triangle / draw-call counts for every id and variant (console warnings).",
    build(ctx) {
      ctx.standardStage();
      const lines: string[] = [];
      for (const id of INDUSTRIAL_IDS) {
        for (const v of ["intact", "construction", "ruin", "pristine"] as IndustrialVariant[]) {
          const o = make(id, v, 1);
          let tris = 0,
            draws = 0,
            lineSegs = 0,
            inst = 0;
          o.traverse((c) => {
            const m = c as THREE.Mesh;
            if ((c as THREE.LineSegments).isLineSegments) {
              draws++;
              lineSegs += ((c as THREE.LineSegments).geometry.getAttribute("position").count / 2) | 0;
              return;
            }
            if (!m.isMesh) return;
            draws++;
            const g = m.geometry;
            const t = g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
            const count = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
            if (count > 1) inst += t * count;
            else tris += t;
          });
          lines.push(`${id.padEnd(15)} ${v.padEnd(13)} body+parts ${String(Math.round(tris)).padStart(6)} tris · instanced fx ${String(Math.round(inst)).padStart(6)} · lines ${String(lineSegs).padStart(6)} · draws ${draws}`);
        }
      }
      console.warn("\n" + lines.join("\n"));
      const el = ctx.domStage();
      el.innerHTML = `<pre style="font:12px/1.35 ui-monospace,monospace;padding:16px">${lines.join("\n")}</pre>`;
    },
  },
  {
    name: "industrial-insitu-compute",
    description: "Cab view: data-centre campus at 150–400 m, pylons marching in, cooling towers beyond.",
    build(ctx) {
      const sunP = Array.isArray(ctx.params.sun) ? (ctx.params.sun as [number, number, number]) : ([45, 62, 28] as [number, number, number]);
      inSituStage(ctx, { length: 900, sun: sunP });
      bigGround(ctx, 5000, 0.04, ctx.params.groundShadow !== false);
      const objs: THREE.Object3D[] = [];
      const only = typeof ctx.params.only === "string" ? (ctx.params.only as string) : null;
      const add = (o: THREE.Object3D, x: number, z: number, ry = 0) => {
        if (only && o.userData.landmark !== only) return o;
        o.position.set(x, 0, z);
        o.rotation.y = ry;
        ctx.scene.add(o);
        objs.push(o);
        return o;
      };
      const p = ctx.params;
      const dcv = (typeof p.variant === "string" ? p.variant : "intact") as IndustrialVariant;
      const dc = make("data-center", dcv, num(p.seed, 3));
      add(dc, num(p.dcx, -125), num(p.dcz, -275), Math.PI / 2);
      // A line crossing the track on the diagonal, into the campus switchyard.
      add(make("pylon-line", dcv === "ruin" ? "ruin" : "intact", 2), 70, -300, -2.36);
      // A second line marching beside the track into the distance.
      add(make("pylon-line", dcv === "ruin" ? "ruin" : "intact", 5), 58, -420, 0.04);
      add(make("cooling-tower", dcv, 4), 170, -640, 0.2);
      add(make("cooling-tower", dcv, 9), -420, -760, -0.3);
      tickAll(ctx, objs);
      wideShadows(ctx, 700, [0, 0, -350], 2400);
      ctx.caption("in situ · data-centre campus 150–400 m, pylon line, substation, cooling towers beyond");
    },
  },
];


// ------------------------------------------------------------ more scenes

function placer(ctx: LabContext, objs: THREE.Object3D[]) {
  return (o: THREE.Object3D, x: number, z: number, ry = 0) => {
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    ctx.scene.add(o);
    objs.push(o);
    return o;
  };
}

/** A plain road slab for staging (roads belong to the world builder). */
function road(ctx: LabContext, x: number, z0: number, z1: number, w = 8): void {
  const k = new Kit();
  k.add(block(w, 0.05, Math.abs(z1 - z0)), { tone: "light", position: [x, 0, (z0 + z1) / 2] });
  for (let z = Math.min(z0, z1); z < Math.max(z0, z1); z += 9) k.add(block(0.15, 0.06, 4.5), { tone: "paper", position: [x, 0, z] });
  ctx.scene.add(new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.14 })));
}

function lineupScene(name: string, ids: IndustrialId[], caption: string, variant?: IndustrialVariant): LabScene {
  return {
    name,
    description: `Lineup: ${ids.join(", ")}`,
    build(ctx) {
      ctx.standardStage({ ground: false, sun: [40, 55, 30] });
      bigGround(ctx);
      const v = (typeof ctx.params.variant === "string" ? ctx.params.variant : variant) as IndustrialVariant | undefined;
      const objs = ids.map((id, i) => make(id, v, num(ctx.params.seed, 1) + i));
      const meanW = objs.reduce((a, o) => a + footprint(o).width, 0) / objs.length;
      const total = row(ctx, objs, Math.max(12, meanW * 0.14));
      tickAll(ctx, objs);
      const hMax = Math.max(...objs.map((o) => footprint(o).height));
      const el = (num(ctx.params.el, 25) * Math.PI) / 180;
      const dist = Math.max(total * 0.7, hMax * 2.6) * num(ctx.params.dist, 1);
      ctx.view([0, Math.sin(el) * dist + hMax * 0.25, Math.cos(el) * dist], [0, hMax * 0.25, 0], 40);
      wideShadows(ctx, total * 0.6, [0, 0, 0], 3000);
      ctx.pipeline.look.fogNear = dist * 0.9;
      ctx.pipeline.look.fogFar = dist * 3.5;
      farPlane(ctx, dist * 4);
      ctx.caption(`${caption} · ${v ?? "intact"}`);
    },
  };
}

scenes.push(
  lineupScene("industrial-lineup-compute", ["lab", "data-center"], "compute: lab · data-center"),
  lineupScene("industrial-lineup-compute2", ["isolation-hall", "antenna-array", "substation"], "compute: isolation-hall · antenna-array · substation"),
  lineupScene("industrial-lineup-energy", ["cooling-tower", "power-station"], "energy: cooling-tower · power-station"),
  lineupScene("industrial-lineup-energy2", ["wind-turbines", "solar-farm", "pylon-line"], "energy: wind-turbines · solar-farm · pylon-line"),
  lineupScene("industrial-lineup-industry", ["factory", "port-cranes", "desalination"], "industry: factory · port-cranes · desalination"),
  lineupScene("industrial-lineup-aftermath", ["checkpoint", "security-fence", "ruins", "crater"], "control & aftermath: checkpoint · security-fence · ruins · crater"),
  lineupScene("industrial-lineup-aftermath2", ["burning-town", "monolith"], "aftermath: burning-town · monolith"),
  {
    name: "industrial-insitu-checkpoint",
    description: "Cab view: a checkpoint straddling a road beside the track at ~60 m.",
    build(ctx) {
      inSituStage(ctx, { length: 600, sun: [40, 60, 30] });
      bigGround(ctx, 5000, 0.04, false);
      const objs: THREE.Object3D[] = [];
      const add = placer(ctx, objs);
      const v = (typeof ctx.params.variant === "string" ? ctx.params.variant : "intact") as IndustrialVariant;
      road(ctx, 30, 20, -600);
      add(make("checkpoint", v, num(ctx.params.seed, 2)), 30, -62, 0);
      // The perimeter continues outward from the checkpoint's own fence arms.
      for (let i = 0; i < 10; i++) add(make("security-fence", v, `seg${i}`), 30 + 26 + SECURITY_FENCE_SEGMENT / 2 + i * SECURITY_FENCE_SEGMENT, -67, 0);
      for (let i = 0; i < 2; i++) add(make("security-fence", v, `segL${i}`), 30 - 26 - SECURITY_FENCE_SEGMENT / 2 - i * SECURITY_FENCE_SEGMENT, -67, 0);
      // And along the track, receding.
      for (let i = 0; i < 26; i++) add(make("security-fence", v, `segT${i}`), -9, -20 - i * SECURITY_FENCE_SEGMENT, Math.PI / 2);
      add(make("isolation-hall", v, 3), -95, -230, Math.PI / 2);
      tickAll(ctx, objs);
      wideShadows(ctx, 260, [0, 0, -120], 1600);
      ctx.caption(`in situ · checkpoint on a road beside the line at 60 m · ${v}`);
    },
  },
  {
    name: "industrial-insitu-night",
    description: "Cab view at night: a burning town either side of the line.",
    build(ctx) {
      inSituStage(ctx, { length: 600, sun: [10, 90, 25] });
      bigGround(ctx, 5000, 0.04, false);
      night(ctx, num(ctx.params.gloom, 0.5));
      const objs: THREE.Object3D[] = [];
      const add = placer(ctx, objs);
      add(make("burning-town", "intact", 3), -40, -100, Math.PI / 2 - 0.55);
      add(make("burning-town", "intact", 8), 46, -185, -Math.PI / 2 + 0.5);
      add(make("ruins", "intact", 5), -38, -210, Math.PI / 2);
      add(make("crater", "intact", 2), 16, -62, 0);
      add(make("pylon-line", "ruin", 4), -70, -380, 0.1);
      for (const o of objs) (o.userData.setNight as ((on: boolean) => void) | undefined)?.(true);
      tickAll(ctx, objs);
      wideShadows(ctx, 260, [0, 0, -120], 1600);
      ctx.caption("in situ · night · burning town, ruins, crater, downed line");
    },
  },
  {
    name: "industrial-insitu-pristine",
    description: "Cab view: the pristine monolith landscape of the synthetic order.",
    build(ctx) {
      inSituStage(ctx, { length: 900, sun: [55, 38, 20] });
      bigGround(ctx, 5000, 0.02, true);
      const objs: THREE.Object3D[] = [];
      const add = placer(ctx, objs);
      const P: IndustrialVariant = "pristine";
      add(make("monolith", P, num(ctx.params.m1, 2)), -95, -250, Math.PI / 2);
      add(make("monolith", P, num(ctx.params.m2, 17)), 170, -480, -Math.PI / 2);
      add(make("monolith", P, num(ctx.params.m3, 9)), -10, -980, 0);
      for (let i = 0; i < 44; i++) add(make("security-fence", P, `p${i}`), 10, -16 - i * SECURITY_FENCE_SEGMENT, -Math.PI / 2);
      add(make("wind-turbines", P, 2), -520, -760, 0.25);
      add(make("pylon-line", P, 6), 44, -560, 0);
      tickAll(ctx, objs);
      wideShadows(ctx, 700, [0, 0, -350], 2400);
      ctx.pipeline.look.fogNear = 220;
      ctx.pipeline.look.fogFar = 1400;
      ctx.caption("in situ · pristine order: monoliths, sealed walls, synchronised rotors");
    },
  },
);

scenes.push(
  {
    name: "industrial-insitu-lab",
    description: "Cab view: Vela's campus, the antenna array and an isolation hall.",
    build(ctx) {
      inSituStage(ctx, { length: 900, sun: [45, 55, 35] });
      bigGround(ctx, 5000, 0.04, false);
      const objs: THREE.Object3D[] = [];
      const add = placer(ctx, objs);
      const v = (typeof ctx.params.variant === "string" ? ctx.params.variant : "intact") as IndustrialVariant;
      add(make("lab", v, 1), -70, -120, Math.PI / 2 - 0.35);
      add(make("antenna-array", v, 2), 120, -260, -Math.PI / 2);
      add(make("isolation-hall", v, 3), -110, -330, Math.PI / 2);
      add(make("pylon-line", v, 5), 50, -520, 0.02);
      tickAll(ctx, objs);
      wideShadows(ctx, 400, [0, 0, -220], 2000);
      ctx.caption(`in situ · Vela campus, antenna array, isolation hall · ${v}`);
    },
  },
  {
    name: "industrial-insitu-industry",
    description: "Cab view: the industrial belt.",
    build(ctx) {
      inSituStage(ctx, { length: 900, sun: [45, 55, 35] });
      bigGround(ctx, 5000, 0.04, false);
      const objs: THREE.Object3D[] = [];
      const add = placer(ctx, objs);
      const v = (typeof ctx.params.variant === "string" ? ctx.params.variant : "intact") as IndustrialVariant;
      add(make("factory", v, 1), -80, -110, Math.PI / 2);
      add(make("port-cranes", v, 2), 120, -240, -Math.PI / 2);
      add(make("desalination", v, 3), -150, -330, Math.PI / 2);
      add(make("power-station", v, 4), 60, -600, 0);
      add(make("wind-turbines", v, 5), -380, -700, 0.3);
      add(make("solar-farm", v, 6), 70, -70, -Math.PI / 2);
      tickAll(ctx, objs);
      wideShadows(ctx, 600, [0, 0, -300], 2400);
      ctx.caption(`in situ · factory, port cranes, desalination, power station, turbines, solar · ${v}`);
    },
  },
);

scenes.push({
  name: "industrial-insitu-ruin",
  description: "Cab view in daylight after the collapse: ruins, crater, dead plant.",
  build(ctx) {
    inSituStage(ctx, { length: 900, sun: [40, 50, 30] });
    bigGround(ctx, 5000, 0.04, false);
    const objs: THREE.Object3D[] = [];
    const add = placer(ctx, objs);
    const R: IndustrialVariant = "ruin";
    add(make("ruins", R, 4), -30, -70, Math.PI / 2 - 0.3);
    add(make("ruins", R, 9), 34, -120, -Math.PI / 2 + 0.3);
    add(make("crater", R, 3), -14, -150, 0);
    add(make("data-center", R, 3), -180, -330, Math.PI / 2);
    add(make("cooling-tower", R, 4), 180, -620, 0.2);
    add(make("pylon-line", R, 2), 50, -420, 0.03);
    add(make("wind-turbines", R, 5), -420, -760, 0.3);
    tickAll(ctx, objs);
    wideShadows(ctx, 500, [0, 0, -250], 2400);
    ctx.caption("in situ · after: ruined street, crater, dead campus, broken towers");
  },
});

void CAB_EYE;
void CAB_FOV;
