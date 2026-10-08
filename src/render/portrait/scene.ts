/**
 * Assembles the bust for one expression: head pose, camera at the mirror,
 * light, all surface grids, the depth buffer and the shadow map, and the
 * per-vertex tone every hatch line reads.
 */
import { HeadShape } from "./head.ts";
import { BUILD_TRACE, DEG, add, clamp, lerp, lookCam, norm, rotYPR, scale, smoothstep, type Cam, type Pose, type V3 } from "./math.ts";
import { DepthBuffer, Grid, ShadowMap } from "./raster.ts";
import type { Expr, Identity } from "./rig.ts";
import { IDS, buildCap, buildCollar, buildHeadGridSteps, buildLapels, buildNeck, buildTorso, type CapGeometry, type CollarGeometry, type HeadGrid, type TorsoInfo } from "./surfaces.ts";

export const PORTRAIT_W = 512;
export const PORTRAIT_H = 640;

export interface Lighting {
  key: V3;
  fill: V3;
  keyAmt: number;
  fillAmt: number;
  amb: number;
}

export interface BustScene {
  id: Identity;
  ex: Expr;
  cam: Cam;
  light: Lighting;
  headPose: Pose;
  shape: HeadShape;
  head: HeadGrid;
  neck: Grid;
  torso: Grid;
  torsoInfo: TorsoInfo;
  torsoFrontZ: (x: number, y: number) => number;
  collar: CollarGeometry;
  cap: CapGeometry;
  grids: Grid[];
  zbuf: DepthBuffer;
  shadow: ShadowMap;
  w: number;
  h: number;
}

export const CAM_YAW = 40 * DEG;
export const CAM_ELEV = 3 * DEG;
export const CAM_DIST = 165;

export interface CamOptions {
  yaw?: number;
  elev?: number;
  zoom?: number;
}

export function makeCamera(w: number, h: number, o: CamOptions = {}): Cam {
  const yaw = o.yaw ?? CAM_YAW;
  const elev = o.elev ?? CAM_ELEV;
  const target: V3 = [0, -7.5, 1];
  const dir: V3 = [Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev)];
  const pos = add(target, scale(dir, CAM_DIST));
  const f = 2575 * (w / 512) * (o.zoom ?? 1);
  return lookCam(pos, target, f, w * 0.545, h * 0.56);
}

/**
 * The light tells the story as much as the face does. Composed: broad, low
 * windscreen light that slips under the cap peak and opens the near cheek.
 * Fatigue: the light climbs and the peak's shadow sinks the eyes. Grief:
 * short light from the far side leaves the near cheek in half-shadow.
 * Dissociation: flat and over-bright, so the face goes blank as paper and
 * only the eyes, in the peak's shadow, keep their ink.
 */
export function makeLighting(ex: Expr): Lighting {
  const broad = norm([0.36, 0.22, 0.9]);
  const top = norm([0.14, 0.58, 0.8]);
  const short = norm([-0.22, 0.46, 0.86]);
  const flat = norm([0.5, 0.42, 0.76]);
  const mix = (a: V3, b: V3, t: number): V3 => norm([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  const blank = clamp((ex.dissoc - 0.3) * 1.6);
  let key = broad;
  key = mix(key, top, clamp(ex.fatigue * 1.1));
  key = mix(key, short, clamp(ex.grief * 1.15) * (1 - blank));
  key = mix(key, flat, blank);
  return {
    key,
    fill: norm([0.7, 0.15, 0.7]),
    keyAmt: 0.95 - 0.08 * ex.grief,
    fillAmt: 0.22 + 0.12 * blank,
    amb: 0.1 + 0.2 * blank,
  };
}

export function headPose(ex: Expr): Pose {
  // Positive roll leans the head toward the side window (sitter's left, +x).
  return {
    r: rotYPR(ex.headYaw, ex.headPitch, -ex.headRoll),
    pivot: [0, -6.5, -2.5],
    offset: [0.4 * ex.headRoll * 10, -0.25 * ex.fatigue, 0.3 * ex.fatigue],
  };
}

/** Synchronous build (lab, tests). */
export function buildScene(id: Identity, ex: Expr, w = PORTRAIT_W, h = PORTRAIT_H, camOpts: CamOptions = {}): BustScene {
  const gen = sceneSteps(id, ex, w, h, camOpts);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

/** The same build as a generator that yields between costly steps. */
export function* sceneSteps(id: Identity, ex: Expr, w = PORTRAIT_W, h = PORTRAIT_H, camOpts: CamOptions = {}): Generator<void, BustScene> {
  const T = BUILD_TRACE;
  T.label = "table";
  const shape = new HeadShape(id, ex);
  yield* shape.prepare();
  yield;
  const pose = headPose(ex);
  const cam = makeCamera(w, h, camOpts);
  const light = makeLighting(ex);
  T.label = "headgrid";
  const head = yield* buildHeadGridSteps(shape, pose);
  head.alb.fill(id.skin);
  yield;
  T.label = "neck";
  const neck = buildNeck(id, ex);
  neck.toneMax = 0.72;
  yield;
  T.label = "torso";
  const { grid: torso, info: torsoInfo, frontZ } = buildTorso(id);
  yield;
  T.label = "collar";
  const collar = buildCollar(id, ex, frontZ);
  const lapels = buildLapels(torsoInfo, frontZ);
  yield;
  T.label = "cap";
  const cap = buildCap(pose);
  yield;
  T.label = "project";
  const grids: Grid[] = [
    head,
    neck,
    torso,
    ...lapels,
    collar.shirt,
    collar.jacketL,
    collar.jacketR,
    collar.leafL,
    collar.leafR,
    collar.knot,
    collar.tie,
    cap.band,
    cap.crown,
    cap.top,
    cap.peak,
  ];
  for (const g of grids) g.project(cam);
  yield;
  const zbuf = new DepthBuffer(w, h);
  for (const g of grids) {
    T.label = `zbuf ${g.name}`;
    yield* zbuf.gridSteps(g, true, false, 24);
  }
  yield;
  T.label = "shadow";
  const shadow = new ShadowMap(288, light.key, 0.3);
  shadow.bounds([head, cap.crown, cap.peak, cap.band, neck]);
  yield* shadow.renderSteps(grids);
  yield;
  for (const g of grids) {
    T.label = `shade ${g.name}`;
    yield* shadeGridSteps(g, light, shadow);
  }
  return { id, ex, cam, light, headPose: pose, shape, head, neck, torso, torsoInfo, torsoFrontZ: frontZ, collar, cap, grids, zbuf, shadow, w, h };
}

/** Light at a point: 0 dark .. 1 fully lit. */
export function lightAt(L: Lighting, shadow: ShadowMap, px: number, py: number, pz: number, nx: number, ny: number, nz: number): number {
  const ndl = nx * L.key[0] + ny * L.key[1] + nz * L.key[2];
  let key = 0;
  if (ndl > 0) {
    const s = shadow.shadow(px + nx * 0.25, py + ny * 0.25, pz + nz * 0.25);
    key = ndl * (1 - s);
  }
  const fill = Math.max(0, nx * L.fill[0] + ny * L.fill[1] + nz * L.fill[2]);
  // Bounce from the side window behind the sitter keeps the back planes of
  // the head and neck in half-tone instead of solid shadow.
  const bounce = Math.max(0, nx * 0.55 - ny * 0.1 - nz * 0.83) * 0.22;
  return clamp(L.amb + L.keyAmt * key + L.fillAmt * fill + bounce * (1 - L.amb * 2));
}

export function shadeGrid(g: Grid, L: Lighting, shadow: ShadowMap): void {
  const gen = shadeGridSteps(g, L, shadow);
  while (!gen.next().done);
}

export function* shadeGridSteps(g: Grid, L: Lighting, shadow: ShadowMap): Generator<void, void> {
  for (let k = 0; k < g.n; k++) {
    if (k % 6000 === 5999) yield;
    if (!g.valid[k]) continue;
    let nx = g.nx[k]!,
      ny = g.ny[k]!,
      nz = g.nz[k]!;
    if (g.twoSided && g.facing[k]! < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const lit = lightAt(L, shadow, g.px[k]!, g.py[k]!, g.pz[k]!, nx, ny, nz);
    g.lit[k] = lit;
    const alb = g.alb[k]!;
    // Paper dominates: the lit half of every form stays white; hatching
    // begins at the terminator and deepens into the core shadow.
    const shade = smoothstep(0.22, 1.0, 1 - lit);
    g.tone[k] = Math.min(g.toneMax, clamp(alb + (1 - alb) * shade + g.cav[k]! * 0.3));
  }
}

export { IDS };
