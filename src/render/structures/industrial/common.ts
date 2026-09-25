/**
 * Shared toolkit for the industrial, compute and catastrophe structures.
 *
 * A `Build` collects the parts of one landmark into a few merged geometries:
 *
 *   body    static architecture, world-space hatching (one draw call)
 *   lamps   steady emissive pigment (status lamps, glowing windows)
 *   blink   aviation obstruction lamps that flash in sync
 *   fabric  chain-link / mesh panels drawn as an ordered stipple
 *   wires   1px pen lines: conductors, handrails, razor coils, guys
 *
 * Moving parts (rotors, crane trolleys, dishes) are added as separate child
 * meshes with object-space hatching, and register a tick.
 */
import * as THREE from "three";
import { Kit, block, cylinder, type PartOptions, type Tone } from "../../core/geometry.ts";
import { createInkCanvas, createInkLineMaterial, createInkMaterial, inkMaterial, type HatchSpace, type InkMaterialOptions } from "../../core/ink-material.ts";
import type { AccentName } from "../../core/palette.ts";
import type { Rng } from "../../core/rng.ts";
import type { EnvironmentTarget } from "../../api.ts";

export type Vec3 = [number, number, number];
export type Tick = (dt: number, t: number) => void;

/** Which state of the world an asset is drawn in. */
export type IndustrialVariant = "intact" | "construction" | "ruin" | "pristine";

export interface IndustrialOptions {
  seed: number | string;
  env?: Partial<EnvironmentTarget>;
  /** Force a variant instead of deriving it from `env`. */
  variant?: IndustrialVariant;
}

/**
 * Plan extents in metres around the origin: x spans [-width/2, width/2],
 * z spans [-depth/2, depth/2] unless `offsetZ` shifts the centre.
 */
export interface IndustrialFootprint {
  width: number;
  depth: number;
  height: number;
  /** Centre of the footprint along z relative to the origin (default 0). */
  offsetZ?: number;
}

// ------------------------------------------------------------ materials

const HATCH_BODY = 0.26;

export function bodyMaterial(hatch = HATCH_BODY): THREE.Material {
  return inkMaterial({ vertexInk: true, hatch });
}

export function actorMaterial(hatch = 0.12): THREE.Material {
  return inkMaterial({ vertexInk: true, hatchSpace: "object", hatch });
}

const gloomFreeCache = new Map<string, THREE.Material>();

/**
 * An ink material that keeps its own lighting but ignores the global night
 * gloom bias: for things lit by their own fire (smoke over a blaze).
 */
export function gloomFreeMaterial(options: InkMaterialOptions): THREE.Material {
  const key = JSON.stringify(options);
  let m = gloomFreeCache.get(key);
  if (m) return m;
  const mat = createInkMaterial(options);
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace("tone + uInkGloom * (", "tone + 0.0 * uInkGloom * (");
  };
  const baseKey = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => `${baseKey}:gloomfree`;
  gloomFreeCache.set(key, mat);
  m = mat;
  return m;
}

const emissiveCache = new Map<string, THREE.Material>();

/**
 * Pigment that ignores lighting and the night gloom bias: lamps, flames,
 * glowing windows. Built on the shared ink material, with the gloom term
 * removed from its fragment program (a no-op if the core shader changes).
 */
export function emissiveMaterial(options: { hatchSpace?: HatchSpace; instanceInk?: boolean; edge?: number; vertexInk?: boolean } = {}): THREE.Material {
  const key = JSON.stringify(options);
  let m = emissiveCache.get(key);
  if (m) return m;
  const mat = createInkMaterial({
    vertexInk: options.vertexInk ?? !options.instanceInk,
    instanceInk: options.instanceInk ?? false,
    flat: true,
    shade: 0,
    edge: options.edge ?? 0,
    hatchSpace: options.hatchSpace ?? "world",
  });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace("tone + uInkGloom * (", "tone + 0.0 * uInkGloom * (");
  };
  const baseKey = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => `${baseKey}:emissive`;
  emissiveCache.set(key, mat);
  m = mat;
  return m;
}

/** Chain-link and mesh panels: a light ordered stipple with no contours. */
export function fabricMaterial(): THREE.Material {
  return inkMaterial({ vertexInk: true, opacity: 0.24, edge: 0, hatch: 0.05, shade: 0.5, side: THREE.DoubleSide });
}

const lineCache = new Map<number, THREE.Material>();
/** 1px pen line. tone 1 = full ink; 0.5 = a grey fine line for secondary detail. */
export function lineMaterial(tone = 1): THREE.Material {
  let m = lineCache.get(tone);
  if (!m) {
    m = createInkLineMaterial({ tone });
    lineCache.set(tone, m);
  }
  return m;
}

// ------------------------------------------------------------ variants

/**
 * Variant from the environment. Ruin wins, then synthetic perfection, then
 * the mid-rise of compute (construction) for build-out structures.
 */
export function resolveVariant(env: Partial<EnvironmentTarget> | undefined, buildOut: boolean): IndustrialVariant {
  if (!env) return "intact";
  const ruin = Math.max(env.ruin ?? 0, (env.fire ?? 0) * 0.8);
  if (ruin >= 0.5) return "ruin";
  const perfect = Math.max(env.perfection ?? 0, (env.uniformity ?? 0) * 0.92);
  if (perfect >= 0.55) return "pristine";
  const c = env.compute ?? 0;
  if (buildOut && c >= 0.18 && c < 0.55) return "construction";
  return "intact";
}

// ------------------------------------------------------------ geometry helpers

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Matrix that maps a +Y unit-axis primitive centred at origin onto segment a→b. */
export function segmentMatrix(a: Vec3, b: Vec3, axis: "y" | "z" = "y", roll = 0): THREE.Matrix4 {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length() || 1e-6;
  dir.divideScalar(len);
  const q = new THREE.Quaternion().setFromUnitVectors(axis === "y" ? Y : Z, dir);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(axis === "y" ? Y : Z, roll));
  const mid = va.add(vb).multiplyScalar(0.5);
  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
}

export function segLength(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Hyperbolic catenary approximation (parabola) between two hang points. */
export function catenary(a: Vec3, b: Vec3, sag: number, segments = 18): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = lerp3(a, b, t);
    p[1] -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

interface BoxOpts {
  ry?: number;
  rx?: number;
  rz?: number;
  accent?: AccentName;
  accentAmount?: number;
}

/**
 * Collects the parts of one landmark. All helper positions are in metres in
 * the asset frame (origin at base centre, front toward +Z).
 */
export class Build {
  readonly k = new Kit();
  readonly lamps = new Kit();
  readonly blink = new Kit();
  readonly fabric = new Kit();
  /** Work lights that only burn at night (see `userData.setNight`). */
  readonly night = new Kit();
  readonly wires: number[] = [];
  readonly fine: number[] = [];
  /** White (paper) lines drawn over dark surfaces: panel grids, glazing bars. */
  readonly paperLines: number[] = [];
  readonly group = new THREE.Group();
  readonly ticks: Tick[] = [];
  blinkPeriod = 1.6;
  blinkDuty = 0.42;
  blinkPhase = 0;
  /** Whether night lamps start lit (from env.timeOfDay). */
  nightOn = false;
  readonly nightHooks: Array<(on: boolean) => void> = [];

  /** Add an animated effect (plume, flames) with its tick and night hook. */
  effect(e: { object: THREE.Object3D; tick: Tick; setNight?: (on: boolean) => void }): this {
    this.group.add(e.object);
    this.ticks.push(e.tick);
    if (e.setNight) this.nightHooks.push(e.setNight);
    return this;
  }

  constructor(
    readonly rng: Rng,
    readonly variant: IndustrialVariant,
    readonly hatch = HATCH_BODY,
  ) {
    this.blinkPhase = rng.next() * this.blinkPeriod;
  }

  get ruin(): boolean {
    return this.variant === "ruin";
  }
  get pristine(): boolean {
    return this.variant === "pristine";
  }
  get building(): boolean {
    return this.variant === "construction";
  }

  /** Window glass: deep; burnt-out holes when ruined; sealed flush when pristine. */
  get glass(): Tone {
    return this.ruin ? "solid" : this.pristine ? "pale" : "deep";
  }

  /** Surface tone shifted by the variant: charred patches in ruin, cleaned in pristine. */
  wear(tone: Tone): Tone {
    const t = typeof tone === "number" ? tone : TONE_VALUE[tone];
    if (this.pristine) return Math.max(0, t - 0.14);
    if (this.ruin) {
      const r = this.rng.next();
      if (r < 0.28) return Math.min(0.9, t + 0.45);
      if (r < 0.55) return Math.min(0.8, t + 0.18);
    }
    return t;
  }

  add(geometry: THREE.BufferGeometry, opts: PartOptions = {}): this {
    this.k.add(geometry, opts);
    return this;
  }

  /** Box with its origin on its base. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, tone: Tone = "paper", o: BoxOpts = {}): this {
    if (w <= 0 || h <= 0 || d <= 0) return this;
    this.k.add(block(w, h, d), {
      tone,
      accent: o.accent,
      accentAmount: o.accentAmount,
      position: [x, y, z],
      rotation: [o.rx ?? 0, o.ry ?? 0, o.rz ?? 0],
    });
    return this;
  }

  /** Vertical cylinder with its origin on its base. */
  cyl(r: number, h: number, x: number, y: number, z: number, tone: Tone = "paper", seg = 12, rTop = r, o: BoxOpts = {}): this {
    const g = cylinder(rTop, r, h, seg);
    g.translate(0, h / 2, 0);
    this.k.add(g, { tone, accent: o.accent, accentAmount: o.accentAmount, position: [x, y, z], rotation: [o.rx ?? 0, o.ry ?? 0, o.rz ?? 0] });
    return this;
  }

  /** Square-section member from a to b (truss chords, bracing, props). */
  beam(a: Vec3, b: Vec3, w: number, tone: Tone = "paper", h = w, kit: Kit = this.k): this {
    const L = segLength(a, b);
    if (L < 1e-4) return this;
    kit.add(new THREE.BoxGeometry(w, h, L), { tone, matrix: segmentMatrix(a, b, "z") });
    return this;
  }

  /** Round member from a to b (pipes, legs, masts). */
  rod(a: Vec3, b: Vec3, r: number, tone: Tone = "paper", seg = 6, kit: Kit = this.k): this {
    const L = segLength(a, b);
    if (L < 1e-4) return this;
    kit.add(cylinder(r, r, L, seg), { tone, matrix: segmentMatrix(a, b, "y") });
    return this;
  }

  line(a: Vec3, b: Vec3, fine = false): this {
    (fine ? this.fine : this.wires).push(...a, ...b);
    return this;
  }

  polyline(pts: Vec3[], fine = false, closed = false): this {
    for (let i = 0; i < pts.length - 1; i++) this.line(pts[i]!, pts[i + 1]!, fine);
    if (closed && pts.length > 2) this.line(pts[pts.length - 1]!, pts[0]!, fine);
    return this;
  }

  /** A pigment lamp. Lamps are drawn larger than life so they read at distance. */
  lamp(x: number, y: number, z: number, size: number, accent: AccentName, blinking = false): this {
    const kit = blinking ? this.blink : this.lamps;
    kit.add(new THREE.OctahedronGeometry(size * 0.5, 0), { tone: "paper", accent, position: [x, y, z] });
    return this;
  }

  /** A flat wall-mounted lamp lens (status light), facing +Z unless rotated. */
  lens(x: number, y: number, z: number, w: number, h: number, accent: AccentName, ry = 0): this {
    this.lamps.add(new THREE.BoxGeometry(w, h, 0.12), { tone: "paper", accent, position: [x, y, z], rotation: [0, ry, 0] });
    return this;
  }

  /** A floodlight/work-light lens: pale glass by day, amber at night. */
  flood(x: number, y: number, z: number, w: number, h: number, ry = 0, accent: AccentName = "amber"): this {
    this.k.add(new THREE.BoxGeometry(w, h, 0.1), { tone: "pale", position: [x, y, z], rotation: [0, ry, 0] });
    const off = 0.06;
    this.night.add(new THREE.BoxGeometry(w * 1.05, h * 1.05, 0.1), { tone: "paper", accent, position: [x + Math.sin(ry) * off, y, z + Math.cos(ry) * off], rotation: [0, ry, 0] });
    return this;
  }

  /** Flat emissive panel (glowing window, lit sign), facing +Z unless rotated. */
  glow(w: number, h: number, x: number, y: number, z: number, accent: AccentName, ry = 0, amount = 1): this {
    this.lamps.add(new THREE.BoxGeometry(w, h, 0.06), { tone: "paper", accent, accentAmount: amount, position: [x, y, z], rotation: [0, ry, 0] });
    return this;
  }

  tick(fn: Tick): this {
    this.ticks.push(fn);
    return this;
  }

  finish(footprint: IndustrialFootprint, name: string): THREE.Group {
    const g = this.group;
    g.name = name;
    if (!this.k.empty) {
      const body = new THREE.Mesh(this.k.build(), bodyMaterial(this.hatch));
      body.name = `${name}:body`;
      g.add(body);
    }
    if (!this.fabric.empty) {
      const fab = new THREE.Mesh(this.fabric.build(), fabricMaterial());
      fab.name = `${name}:fabric`;
      noShadow(fab);
      g.add(fab);
    }
    if (!this.lamps.empty) {
      const lamps = new THREE.Mesh(this.lamps.build(), emissiveMaterial());
      lamps.name = `${name}:lamps`;
      noShadow(lamps);
      g.add(lamps);
    }
    let nightMesh: THREE.Mesh | null = null;
    if (!this.night.empty) {
      nightMesh = new THREE.Mesh(this.night.build(), emissiveMaterial());
      nightMesh.name = `${name}:night-lamps`;
      nightMesh.visible = this.nightOn;
      noShadow(nightMesh);
      g.add(nightMesh);
    }
    if (!this.blink.empty) {
      const blink = new THREE.Mesh(this.blink.build(), emissiveMaterial());
      blink.name = `${name}:beacons`;
      noShadow(blink);
      g.add(blink);
      const period = this.blinkPeriod,
        duty = this.blinkDuty,
        phase = this.blinkPhase;
      this.ticks.push((_dt, t) => {
        blink.visible = ((t + phase) % period) / period < duty;
      });
    }
    for (const [arr, tone] of [
      [this.wires, 1],
      [this.fine, 0.5],
      [this.paperLines, 0],
    ] as const) {
      if (!arr.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      geo.computeBoundingSphere();
      const lines = new THREE.LineSegments(geo, lineMaterial(tone));
      lines.name = `${name}:${tone === 1 ? "wires" : tone === 0 ? "paper-lines" : "fine"}`;
      g.add(lines);
    }
    const ticks = this.ticks;
    g.userData.footprint = footprint;
    g.userData.variant = this.variant;
    g.userData.tick = (dt: number, t: number) => {
      for (const f of ticks) f(dt, t);
    };
    /** Switch the night work-lights (floodlights, lit windows) on or off. */
    const hooks = this.nightHooks;
    g.userData.setNight = (on: boolean) => {
      if (nightMesh) nightMesh.visible = on;
      for (const h of hooks) h(on);
    };
    if (this.nightOn) for (const h of hooks) h(true);
    return g;
  }
}

const TONE_VALUE = { paper: 0, pale: 0.12, light: 0.26, mid: 0.42, dark: 0.62, deep: 0.8, solid: 1 } as const;

export function noShadow(o: THREE.Object3D): void {
  o.castShadow = false;
  o.userData.castShadow = false;
}

// ------------------------------------------------------------ inked signage

const signCache = new Map<string, THREE.Texture | null>();

/**
 * A cached inked canvas texture. Returns null outside a browser so builders
 * stay usable from Node (coverage tests); the caller skips the sign then.
 */
export function signTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture | null {
  if (signCache.has(key)) return signCache.get(key)!;
  if (typeof document === "undefined") {
    signCache.set(key, null);
    return null;
  }
  const { ctx, texture } = createInkCanvas(w, h);
  draw(ctx, w, h);
  texture.needsUpdate = true;
  signCache.set(key, texture);
  return texture;
}

/** A sign plane (facing +Z) carrying an inked texture. */
export function signMesh(texture: THREE.Texture | null, w: number, h: number): THREE.Mesh | null {
  if (!texture) return null;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), inkMaterial({ map: texture, flat: true, hatch: 0.05 }));
  noShadow(m);
  return m;
}

// ------------------------------------------------------------ recurring structures

/** Plan outline helper: axis-aligned rectangle corner list (x, z). */
export function rectPath(cx: number, cz: number, w: number, d: number): Array<[number, number]> {
  return [
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
    [cx - w / 2, cz - d / 2],
  ];
}

export interface FenceOptions {
  height?: number;
  postGap?: number;
  /** Outrigger with barbed strands. */
  outrigger?: boolean;
  /** Concertina razor coil along the top. */
  razor?: boolean;
  /** Gaps (as [start, end] distances along the whole run) left open for gates. */
  gaps?: Array<[number, number]>;
  tone?: Tone;
  /** 0..1 chance of a leaning/broken bay (ruin). */
  damage?: number;
  /** Solid anti-climb panel instead of mesh (pristine). */
  solid?: boolean;
  /**
   * Post drawing: "solid" boxes (near views) or 1px pen "line"s (long
   * perimeters seen from afar). Default: lines once the run exceeds 150 m.
   */
  posts?: "solid" | "line";
}

/**
 * A security fence along a polyline in plan (x, z pairs). Straight, undamaged
 * runs are merged into single fabric/wall panels so long perimeters stay cheap.
 */
export function fence(b: Build, path: Array<[number, number]>, o: FenceOptions = {}): void {
  const H = o.height ?? 3.2;
  const gap = o.postGap ?? 3;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += Math.hypot(path[i + 1]![0] - path[i]![0], path[i + 1]![1] - path[i]![1]);
  const postStyle = o.posts ?? (total > 150 ? "line" : "solid");
  const gaps = o.gaps ?? [];
  const inGap = (d: number) => gaps.some(([s, e]) => d > s && d < e);
  let run = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = path[i]!;
    const [x1, z1] = path[i + 1]!;
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.01) continue;
    const ux = (x1 - x0) / L,
      uz = (z1 - z0) / L;
    // Outward normal (right-hand of travel) for the outrigger.
    const nx = uz,
      nz = -ux;
    const ry = Math.atan2(ux, uz) + Math.PI / 2;
    const at = (d: number): [number, number] => [x0 + ux * d, z0 + uz * d];
    // Open intervals along this segment (gates removed).
    const cuts: Array<[number, number]> = [];
    let a = 0;
    for (const [gs, ge] of gaps) {
      const s0 = gs - run,
        e0 = ge - run;
      if (e0 <= 0 || s0 >= L) continue;
      if (s0 > a) cuts.push([a, Math.max(a, s0)]);
      a = Math.min(L, Math.max(a, e0));
    }
    if (a < L) cuts.push([a, L]);
    const n = Math.max(1, Math.round(L / gap));
    const step = L / n;
    // Posts and outriggers.
    for (let j = 0; j <= n; j++) {
      const d = j * step;
      if (inGap(run + d) && inGap(run + d + 0.01) && inGap(run + d - 0.01)) continue;
      const [px, pz] = at(d);
      let lean = 0;
      if (o.damage && b.rng.chance(o.damage)) lean = b.rng.range(-0.5, 0.5);
      const top: Vec3 = [px + nx * lean * H * 0.5, H, pz + nz * lean * H * 0.5];
      if (o.solid) continue;
      if (postStyle === "solid") b.beam([px, 0, pz], top, 0.09, "mid");
      else b.line([px, 0, pz], top);
      if (o.outrigger || o.razor) {
        const arm: Vec3 = [top[0] + nx * 0.55, H + 0.5, top[2] + nz * 0.55];
        if (postStyle === "solid") b.beam(top, arm, 0.05, "mid");
        else b.line(top, arm);
      }
    }
    for (const [c0, c1] of cuts) {
      const len = c1 - c0;
      if (len < 0.05) continue;
      const [ax, az] = at(c0);
      const [bx, bz] = at(c1);
      const mx = (ax + bx) / 2,
        mz = (az + bz) / 2;
      if (o.solid) {
        // Seamless white wall with a coping and hairline panel joints.
        b.k.add(block(len, H, 0.3), { tone: "paper", position: [mx, 0, mz], rotation: [0, ry, 0] });
        b.k.add(block(len, 0.14, 0.5), { tone: "paper", position: [mx, H, mz], rotation: [0, ry, 0] });
        continue;
      }
      if (o.damage) {
        // In lengths so some panels can hang torn (bay by bay on short runs).
        const nb = Math.max(1, Math.round(len / (postStyle === "line" ? Math.max(gap, 12) : gap)));
        const sb = len / nb;
        for (let j = 0; j < nb; j++) {
          const [qx, qz] = at(c0 + (j + 0.5) * sb);
          if (b.rng.chance(o.damage * 0.6)) {
            b.fabric.add(new THREE.BoxGeometry(sb, H * 0.6, 0.02), { tone: 0.2, position: [qx + nx * 0.6, H * 0.3, qz + nz * 0.6], rotation: [b.rng.range(-0.7, -0.3), ry, 0] });
          } else b.fabric.add(block(sb, H - 0.15, 0.02), { tone: 0.2, position: [qx, 0.1, qz], rotation: [0, ry, 0] });
        }
      } else {
        b.fabric.add(block(len, H - 0.15, 0.02), { tone: 0.2, position: [mx, 0.1, mz], rotation: [0, ry, 0] });
      }
      b.line([ax, H - 0.05, az], [bx, H - 0.05, bz]);
      b.line([ax, 0.12, az], [bx, 0.12, bz], true);
      if (o.outrigger) {
        for (let s2 = 1; s2 <= 3; s2++) {
          const off = 0.18 * s2,
            y = H + (0.5 * s2) / 3;
          b.line([ax + nx * off, y, az + nz * off], [bx + nx * off, y, bz + nz * off], true);
        }
      }
      if (o.razor) razorCoil(b, [ax + nx * 0.3, H + 0.45, az + nz * 0.3], [bx + nx * 0.3, H + 0.45, bz + nz * 0.3], 0.38, postStyle === "line" ? 0.42 : 0.3);
    }
    run += L;
  }
}

/** Concertina razor wire drawn as a looping pen line between two points. */
export function razorCoil(b: Build, a: Vec3, c: Vec3, radius: number, pitch = 0.3, fine = false): void {
  const L = segLength(a, c);
  if (L < 0.05) return;
  const dir = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize();
  const side = new THREE.Vector3().crossVectors(dir, Y);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  const turns = Math.max(1, Math.round(L / pitch));
  const segs = turns * 6;
  let prev: Vec3 | null = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * turns * Math.PI * 2;
    // Concertina loops lean, so successive turns overlap like a spring pulled open.
    const along = t * L + Math.sin(ang) * pitch * 0.9;
    const r = radius * (0.92 + 0.08 * Math.sin(ang * 3.1));
    const p: Vec3 = [
      a[0] + dir.x * along + side.x * Math.cos(ang) * r + up.x * Math.sin(ang) * r,
      a[1] + dir.y * along + side.y * Math.cos(ang) * r + up.y * Math.sin(ang) * r,
      a[2] + dir.z * along + side.z * Math.cos(ang) * r + up.z * Math.sin(ang) * r,
    ];
    if (prev) b.line(prev, p, fine);
    prev = p;
  }
}

/**
 * Lattice mast (square section, tapering) drawn with solid legs and pen-line
 * bracing. Returns the top centre.
 */
export function latticeMast(
  b: Build,
  x: number,
  z: number,
  height: number,
  baseW: number,
  topW: number,
  opts: { panels?: number; leg?: number; tone?: Tone; y0?: number; solidBracing?: boolean; fine?: boolean } = {},
): Vec3 {
  const panels = opts.panels ?? Math.max(3, Math.round(height / Math.max(1.5, (baseW + topW) * 0.6)));
  const leg = opts.leg ?? Math.max(0.12, baseW * 0.05);
  const tone = opts.tone ?? "mid";
  const y0 = opts.y0 ?? 0;
  const corner = (y: number, cx: number, cz: number): Vec3 => {
    const t = (y - y0) / height;
    const w = (baseW + (topW - baseW) * t) / 2;
    return [x + cx * w, y, z + cz * w];
  };
  const cs: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [cx, cz] of cs) b.beam(corner(y0, cx, cz), corner(y0 + height, cx, cz), leg, tone);
  for (let p = 0; p < panels; p++) {
    const ya = y0 + (height * p) / panels,
      yb = y0 + (height * (p + 1)) / panels;
    for (let s = 0; s < 4; s++) {
      const [ax, az] = cs[s]!;
      const [bx, bz] = cs[(s + 1) % 4]!;
      const p1 = corner(ya, ax, az),
        p2 = corner(yb, bx, bz),
        p3 = corner(ya, bx, bz),
        p4 = corner(yb, ax, az);
      if (opts.solidBracing) {
        b.beam(p1, p2, leg * 0.45, tone);
        b.beam(p3, p4, leg * 0.45, tone);
      } else {
        b.line(p1, p2, opts.fine);
        b.line(p3, p4, opts.fine);
      }
      b.line(corner(yb, ax, az), corner(yb, bx, bz), opts.fine);
    }
  }
  return [x, y0 + height, z];
}

/** Stack of rubble: jittered chunks and a few long timbers/girders. */
export function rubble(b: Build, cx: number, cz: number, radius: number, height: number, count: number, tone: Tone = "pale"): void {
  const r = b.rng;
  for (let i = 0; i < count; i++) {
    const a = r.next() * Math.PI * 2;
    const d = Math.sqrt(r.next()) * radius;
    const s = r.range(0.25, 1.1) * (1 - (d / radius) * 0.5);
    const y = Math.max(0, height * (1 - d / radius) - s * 0.4) * r.range(0.4, 1);
    const g = new THREE.BoxGeometry(s * r.range(0.8, 2.2), s * r.range(0.4, 0.9), s * r.range(0.8, 1.6));
    b.add(g, {
      tone: r.chance(0.3) ? "light" : tone,
      position: [cx + Math.cos(a) * d, y + s * 0.2, cz + Math.sin(a) * d],
      rotation: [r.range(-0.6, 0.6), r.next() * 3, r.range(-0.6, 0.6)],
    });
  }
  // A heap body so the pile has mass rather than floating chunks.
  const heap = new THREE.ConeGeometry(radius, height, 9, 2);
  const pos = heap.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const yy = pos.getY(i);
    const k = 1 + (Math.sin(i * 12.9898 + cx) * 0.5 + 0.2) * 0.25 * (yy < height / 2 - 0.01 ? 1 : 0);
    pos.setXYZ(i, pos.getX(i) * k, yy * (0.85 + 0.15 * Math.sin(i * 3.7 + cz)), pos.getZ(i) * k);
  }
  heap.computeVertexNormals();
  b.add(heap, { tone, position: [cx, height / 2, cz], scale: [1, 1, 0.8] });
  for (let i = 0; i < Math.max(2, count / 6); i++) {
    const a = r.next() * Math.PI * 2;
    const L = r.range(2, 5);
    const x0 = cx + Math.cos(a) * r.range(0, radius * 0.6),
      z0 = cz + Math.sin(a) * r.range(0, radius * 0.6);
    const a2 = a + r.range(-0.8, 0.8);
    b.beam([x0, r.range(0.2, height), z0], [x0 + Math.cos(a2) * L, r.range(0, 0.5), z0 + Math.sin(a2) * L], r.range(0.12, 0.22), r.chance(0.5) ? "dark" : "mid");
  }
}

/**
 * Tower crane (luffing-free hammerhead). The slewing jib is a separate
 * object-hatched mesh that turns slowly; returns nothing.
 */
export function towerCrane(b: Build, x: number, z: number, height: number, jib: number, heading: number, opts: { slew?: boolean; still?: boolean } = {}): void {
  const top = latticeMast(b, x, z, height, 1.8, 1.8, { panels: Math.round(height / 2.2), leg: 0.16, tone: "mid" });
  b.box(5, 1.2, 5, x, 0, z, "light");
  const k = new Kit();
  const counter = jib * 0.32;
  // Jib: triangular lattice girder along +x in local space.
  const seg = Math.round(jib / 3);
  const jy = 1.8;
  for (let i = 0; i < seg; i++) {
    const xa = (i / seg) * jib,
      xb = ((i + 1) / seg) * jib;
    k.add(new THREE.BoxGeometry(xb - xa, 0.12, 0.12), { tone: "mid", position: [(xa + xb) / 2, 0, -0.6] });
    k.add(new THREE.BoxGeometry(xb - xa, 0.12, 0.12), { tone: "mid", position: [(xa + xb) / 2, 0, 0.6] });
    k.add(new THREE.BoxGeometry(xb - xa, 0.12, 0.12), { tone: "mid", position: [(xa + xb) / 2, jy * (1 - (i / seg) * 0.35), 0] });
    const m1 = segmentMatrix([xa, 0, -0.6], [xb, jy * (1 - ((i + 1) / seg) * 0.35), 0], "z");
    k.add(new THREE.BoxGeometry(0.07, 0.07, segLength([xa, 0, -0.6], [xb, jy, 0])), { tone: "mid", matrix: m1 });
  }
  // Counter-jib with ballast blocks and machinery.
  k.add(new THREE.BoxGeometry(counter, 0.5, 1.6), { tone: "mid", position: [-counter / 2, 0, 0] });
  k.add(new THREE.BoxGeometry(2.6, 2.2, 1.9), { tone: "dark", position: [-counter + 1.4, -0.8, 0] });
  k.add(new THREE.BoxGeometry(2.4, 1.6, 2.2), { tone: "pale", position: [-counter * 0.45, 0.8, 0] });
  // Apex (tower head) and ties.
  k.add(new THREE.BoxGeometry(0.5, 6, 0.5), { tone: "mid", position: [0, 3, 0] });
  // Operator cab.
  k.add(new THREE.BoxGeometry(2, 2.2, 1.8), { tone: "pale", position: [1.4, -1.6, 1.4] });
  k.add(new THREE.BoxGeometry(0.05, 1, 1.4), { tone: "deep", position: [2.42, -1.2, 1.4] });
  // Trolley + hook block.
  const tx = jib * (0.35 + b.rng.next() * 0.5);
  k.add(new THREE.BoxGeometry(1.4, 0.5, 1.6), { tone: "mid", position: [tx, -0.4, 0] });
  const hookY = -b.rng.range(height * 0.4, height * 0.85);
  k.add(new THREE.BoxGeometry(0.7, 1, 0.5), { tone: "paper", accent: "amber", position: [tx, hookY, 0] });
  const geo = k.build();
  const jibMesh = new THREE.Mesh(geo, actorMaterial(0.18));
  jibMesh.position.set(top[0], top[1] + 0.6, top[2]);
  jibMesh.rotation.y = heading;
  jibMesh.name = "crane-jib";
  // Ties and hoist ropes as pen lines on the moving part.
  const tie: number[] = [0, 6, 0, jib * 0.85, jy * 0.7, 0, 0, 6, 0, -counter, 0.3, 0, tx, -0.2, 0, tx, hookY + 1, 0];
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(tie, 3));
  jibMesh.add(new THREE.LineSegments(lg, lineMaterial(1)));
  b.group.add(jibMesh);
  b.lamp(top[0], top[1] + 7, top[2], 0.7, "signal", true);
  if (!opts.still) {
    const speed = (opts.slew === false ? 0 : 0.035) * (b.rng.chance(0.5) ? 1 : -1);
    const ph = b.rng.next() * 10;
    b.tick((_dt, t) => {
      jibMesh.rotation.y = heading + Math.sin((t + ph) * speed * 3) * 0.9;
    });
  }
}

/** Tube-and-fitting scaffold wrapped around a rectangle, drawn in fine lines. */
export function scaffold(b: Build, cx: number, cz: number, w: number, d: number, h: number, lift = 2, bay = 2.4): void {
  const off = 1.1;
  const X0 = cx - w / 2 - off,
    X1 = cx + w / 2 + off,
    Z0 = cz - d / 2 - off,
    Z1 = cz + d / 2 + off;
  const edges: Array<[number, number, number, number]> = [
    [X0, Z1, X1, Z1],
    [X1, Z1, X1, Z0],
    [X1, Z0, X0, Z0],
    [X0, Z0, X0, Z1],
  ];
  for (const [ax, az, bx, bz] of edges) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / bay));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n,
        z = az + ((bz - az) * i) / n;
      b.line([x, 0, z], [x, h + 1, z]);
    }
    for (let y = lift; y <= h + 0.01; y += lift) {
      b.line([ax, y, az], [bx, y, bz]);
      // Boards: a thin pale plank per lift.
      b.beam([ax, y - 0.05, az], [bx, y - 0.05, bz], 0.9, "pale", 0.06);
    }
    // Ledger braces zig-zag.
    for (let i = 0; i < n; i += 2) {
      const xa = ax + ((bx - ax) * i) / n,
        za = az + ((bz - az) * i) / n;
      const xb = ax + ((bx - ax) * (i + 1)) / n,
        zb = az + ((bz - az) * (i + 1)) / n;
      b.line([xa, 0, za], [xb, h, zb], true);
    }
  }
}

/** Seeded phase helper for animations. */
export function phaseOf(rng: Rng): number {
  return rng.next() * 1000;
}
