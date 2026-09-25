/**
 * Animated atmospheric effects for the industrial set: steam and smoke plumes
 * built from billowing puff volumes (dense outlined core that thins into an
 * ordered stipple as it dissipates), flame tongues in ember pigment, and
 * rising sparks. Each effect is one or two InstancedMeshes driven by a tick.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { inkMaterial } from "../../core/ink-material.ts";
import { ACCENT } from "../../core/palette.ts";
import { createNoise } from "../../core/noise.ts";
import type { Rng } from "../../core/rng.ts";
import { emissiveMaterial, gloomFreeMaterial, noShadow, type Tick, type Vec3 } from "./common.ts";

// ------------------------------------------------------------ puff geometry

const puffCache = new Map<string, THREE.BufferGeometry>();

/**
 * A unit-radius billow. "steam" is round with soft cauliflower lobes;
 * "smoke" is lumpier and torn.
 */
function puffGeometry(kind: "steam" | "smoke"): THREE.BufferGeometry {
  const cached = puffCache.get(kind);
  if (cached) return cached;
  const n = createNoise(`industrial-puff-${kind}`);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, kind === "steam" ? 2 : 2);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = mergeVertices(g, 1e-4);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const amp = kind === "steam" ? [0.07, 0.025] : [0.12, 0.05];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const lobes = n.n3(v.x * 1.3, v.y * 1.3, v.z * 1.3) * amp[0]! + n.n3(v.x * 2.6 + 5, v.y * 2.6, v.z * 2.6) * amp[1]!;
    let r = 1 + lobes;
    // Flattened, tucked underside like a cumulus base.
    if (v.y < -0.3) r *= 0.9 + 0.1 * (1 + v.y);
    v.multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  puffCache.set(kind, g);
  return g;
}

export interface PlumeOptions {
  origin: Vec3;
  rng: Rng;
  count: number;
  /** Seconds for one puff to travel the whole plume. */
  life: number;
  /** Total rise in metres. */
  height: number;
  /** Puff radius at the source and at the top. */
  r0: number;
  r1: number;
  /** Horizontal displacement at the top of the plume (wind), metres. */
  drift: [number, number];
  /** Lateral wander radius. */
  wander?: number;
  /** Albedo of the dense puffs at the source, and at the top. */
  tone?: number;
  toneTop?: number;
  /** Age (0..1) at which puffs thin into stipple. */
  thinFrom?: number;
  /** Hatch period in metres. */
  hatch?: number;
  /** Ember glow on the lowest puffs (fire-lit smoke), 0..1. */
  ember?: number;
  /** Source radius: puffs are born scattered over this disc. */
  sourceRadius?: number;
  /** Stipple density of dissipating puffs (0..1). */
  thinOpacity?: number;
  kind?: "steam" | "smoke";
}

export interface Effect {
  object: THREE.Object3D;
  tick: Tick;
  /** Night hook: fire-lit smoke glows only after dark. */
  setNight?: (on: boolean) => void;
}

/** A rising plume. Dense puffs are outlined ink clouds; old puffs become stipple. */
export function createPlume(o: PlumeOptions): Effect {
  const kind = o.kind ?? (o.tone && o.tone > 0.2 ? "smoke" : "steam");
  const geo = puffGeometry(kind);
  const N = o.count;
  const hatch = o.hatch ?? 0.45;
  const shade = kind === "steam" ? 0.62 : 0.85;
  const dayMat: THREE.Material = inkMaterial({ instanceInk: true, hatch, shade });
  // After dark, smoke over a fire is lit from below: pale billows against the
  // night, ignoring the gloom bias, with the ember glow at the base.
  const nightMat = gloomFreeMaterial({ instanceInk: true, hatch, shade: 0.55 });
  const dense = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>(geo, dayMat, N);
  const thin = new THREE.InstancedMesh(geo, inkMaterial({ instanceInk: true, hatch, shade, opacity: o.thinOpacity ?? (kind === "steam" ? 0.3 : 0.34), edge: kind === "steam" ? 0.18 : 0.22 }), N);
  const inkD = new Float32Array(N * 3);
  const inkT = new Float32Array(N * 3);
  const attrD = new THREE.InstancedBufferAttribute(inkD, 3);
  const attrT = new THREE.InstancedBufferAttribute(inkT, 3);
  // Separate geometry wrappers so each mesh owns its inkInstance attribute.
  const gD = new THREE.BufferGeometry();
  const gT = new THREE.BufferGeometry();
  for (const g of [gD, gT]) {
    g.setIndex(geo.getIndex());
    g.setAttribute("position", geo.getAttribute("position"));
    g.setAttribute("normal", geo.getAttribute("normal"));
    g.boundingSphere = geo.boundingSphere;
  }
  gD.setAttribute("inkInstance", attrD);
  gT.setAttribute("inkInstance", attrT);
  dense.geometry = gD;
  thin.geometry = gT;
  dense.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  thin.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  attrD.setUsage(THREE.DynamicDrawUsage);
  attrT.setUsage(THREE.DynamicDrawUsage);
  noShadow(thin);
  // Vapour neither casts nor receives hard shadow: it would blotch the billows.
  dense.userData.noShadow = true;
  thin.userData.noShadow = true;
  dense.castShadow = thin.castShadow = false;
  dense.receiveShadow = thin.receiveShadow = false;

  const rng = o.rng;
  const phase = new Float32Array(N);
  const scaleJ = new Float32Array(N);
  const offA = new Float32Array(N);
  const offR = new Float32Array(N);
  const quats: THREE.Quaternion[] = [];
  for (let i = 0; i < N; i++) {
    phase[i] = (i + rng.next() * 0.8) / N;
    scaleJ[i] = kind === "smoke" ? rng.range(0.42, 1.35) : rng.range(0.6, 1.3);
    offA[i] = rng.next() * Math.PI * 2;
    offR[i] = Math.sqrt(rng.next());
    quats.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.next() * 6, rng.next() * 6, rng.next() * 6)));
  }
  const thinFrom = o.thinFrom ?? 0.6;
  const wander = o.wander ?? o.r1 * 0.35;
  const src = o.sourceRadius ?? o.r0 * 0.5;
  const tone0 = o.tone ?? 0;
  const tone1 = o.toneTop ?? tone0;
  let ember = 0;
  let night = false;
  const emberNight = o.ember ?? 0;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const tp = rng.next() * 100;

  const tick: Tick = (_dt, t) => {
    // Dense puffs are packed first into one mesh and thin puffs into the
    // other, so each draws only the instances it holds.
    let kD = 0,
      kT = 0;
    for (let i = 0; i < N; i++) {
      const age = (((phase[i]! + t / o.life) % 1) + 1) % 1;
      // Dense near the source, spreading and bending over with the wind above.
      const rise = 0.55 * age + 0.45 * age * age;
      const bend = Math.pow(age, 1.25);
      const w = Math.sin(t * 0.13 + offA[i]! * 3 + tp) * wander * age;
      const sx = Math.cos(offA[i]!) * offR[i]! * (src + wander * age);
      const sz = Math.sin(offA[i]!) * offR[i]! * (src + wander * age);
      p.set(o.origin[0] + o.drift[0] * bend + sx + w, o.origin[1] + o.height * rise, o.origin[2] + o.drift[1] * bend + sz + w * 0.6);
      let r = (o.r0 + (o.r1 - o.r0) * Math.pow(age, 0.6)) * scaleJ[i]!;
      r *= smooth(0, 0.025, age) * (1 - smooth(0.86, 1, age) * 0.85);
      // Dissipating smoke thins out rather than swelling into grey blobs.
      if (kind === "smoke" && age >= thinFrom) r *= 1 - 0.45 * smooth(thinFrom, 1, age);
      s.set(r, r * 0.82, r);
      m.compose(p, quats[i]!, s);
      const tone = night && emberNight > 0 ? 0.1 + 0.34 * smooth(0.1, 0.8, age) : tone0 + (tone1 - tone0) * age;
      const emb = ember * (1 - smooth(0.015, 0.075, age));
      const acc = emb > 0.02 ? ACCENT.ember : 0;
      if (age < thinFrom) {
        dense.setMatrixAt(kD, m);
        inkD[kD * 3] = tone;
        inkD[kD * 3 + 1] = emb;
        inkD[kD * 3 + 2] = acc;
        kD++;
      } else {
        thin.setMatrixAt(kT, m);
        inkT[kT * 3] = tone;
        inkT[kT * 3 + 1] = 0;
        inkT[kT * 3 + 2] = 0;
        kT++;
      }
    }
    dense.count = kD;
    thin.count = kT;
    dense.instanceMatrix.needsUpdate = true;
    thin.instanceMatrix.needsUpdate = true;
    attrD.needsUpdate = true;
    attrT.needsUpdate = true;
  };
  tick(0, 0);
  // Conservative bounds covering the whole plume path.
  const cx = o.origin[0] + o.drift[0] * 0.5,
    cy = o.origin[1] + o.height * 0.5,
    cz = o.origin[2] + o.drift[1] * 0.5;
  const rad = Math.hypot(o.drift[0], o.height, o.drift[1]) * 0.5 + o.r1 * 1.6 + wander;
  const sphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), rad);
  dense.boundingSphere = sphere;
  thin.boundingSphere = sphere.clone();
  const group = new THREE.Group();
  group.name = "plume";
  group.add(dense, thin);
  return {
    object: group,
    tick,
    setNight: (on) => {
      ember = on ? emberNight : 0;
      night = on;
      dense.material = on && emberNight > 0 ? nightMat : dayMat;
    },
  };
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------ flames

let tongueGeo: THREE.BufferGeometry | null = null;

/** A unit flame tongue: base radius ~0.4, height 1, with a curling tip. */
function tongueGeometry(): THREE.BufferGeometry {
  if (tongueGeo) return tongueGeo;
  const prof: THREE.Vector2[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const y = i / steps;
    const r = 0.42 * Math.sin(Math.PI * Math.pow(y, 0.62)) * (1 - y * 0.35) + (i === steps ? 0 : 0.001);
    prof.push(new THREE.Vector2(Math.max(0, r), y));
  }
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(prof, 6);
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-4);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    // Curl the tip sideways and pinch into licks.
    const ang = Math.atan2(z, x);
    const lick = 1 + 0.35 * Math.sin(ang * 3 + y * 5) * y;
    pos.setXYZ(i, x * lick + Math.sin(y * 2.4) * 0.22 * y, y, z * lick);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  tongueGeo = g;
  return g;
}

export interface FireSource {
  pos: Vec3;
  /** Flame height in metres. */
  size: number;
  /** Radius over which tongues spread. */
  spread: number;
  /** Number of tongues (default by size). */
  tongues?: number;
}

/** Flickering flame tongues: ember outer licks with white-hot cores, pen-outlined. */
export function createFlames(sources: FireSource[], rng: Rng): Effect {
  const geo = tongueGeometry();
  interface T {
    x: number;
    y: number;
    z: number;
    h: number;
    w: number;
    ph: number;
    fq: number;
    core: boolean;
    ry: number;
  }
  const list: T[] = [];
  for (const s of sources) {
    const n = s.tongues ?? Math.max(3, Math.round(3 + s.size * 1.2));
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = Math.sqrt(rng.next()) * s.spread;
      const centre = 1 - d / (s.spread + 1e-3);
      const h = s.size * rng.range(0.45, 1) * (0.55 + 0.45 * centre);
      list.push({ x: s.pos[0] + Math.cos(a) * d, y: s.pos[1], z: s.pos[2] + Math.sin(a) * d, h, w: h * rng.range(0.34, 0.5), ph: rng.next() * 50, fq: rng.range(5, 9), core: false, ry: rng.next() * 6.28 });
      if (rng.chance(0.55)) list.push({ x: s.pos[0] + Math.cos(a) * d * 0.9, y: s.pos[1], z: s.pos[2] + Math.sin(a) * d * 0.9 + 0.05, h: h * 0.55, w: h * 0.22, ph: rng.next() * 50, fq: rng.range(7, 11), core: true, ry: rng.next() * 6.28 });
    }
  }
  const N = list.length;
  const g = new THREE.BufferGeometry();
  g.setIndex(geo.getIndex());
  g.setAttribute("position", geo.getAttribute("position"));
  g.setAttribute("normal", geo.getAttribute("normal"));
  const ink = new Float32Array(N * 3);
  list.forEach((tg, i) => {
    ink[i * 3] = 0;
    ink[i * 3 + 1] = tg.core ? 0 : 1;
    ink[i * 3 + 2] = tg.core ? 0 : ACCENT.ember;
  });
  g.setAttribute("inkInstance", new THREE.InstancedBufferAttribute(ink, 3));
  const mesh = new THREE.InstancedMesh(g, emissiveMaterial({ instanceInk: true, edge: 0.9 }), N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.name = "flames";
  noShadow(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const tick: Tick = (_dt, t) => {
    for (let i = 0; i < N; i++) {
      const tg = list[i]!;
      const f = Math.sin(t * tg.fq + tg.ph) * 0.5 + Math.sin(t * tg.fq * 1.73 + tg.ph * 2.1) * 0.35;
      const hh = tg.h * (0.82 + 0.2 * f);
      e.set(Math.sin(t * 2.3 + tg.ph) * 0.12, tg.ry + t * 0.6, 0.1 + Math.sin(t * 3.1 + tg.ph) * 0.14);
      q.setFromEuler(e);
      p.set(tg.x, tg.y, tg.z);
      sc.set(tg.w * (1 - 0.15 * f), hh, tg.w * (1 - 0.15 * f));
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  tick(0, 0);
  // Optional flickering fire light (see createFlames docs): off by default.
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const tg of list) {
    minX = Math.min(minX, tg.x - tg.w);
    maxX = Math.max(maxX, tg.x + tg.w);
    minY = Math.min(minY, tg.y);
    maxY = Math.max(maxY, tg.y + tg.h * 1.3);
    minZ = Math.min(minZ, tg.z - tg.w);
    maxZ = Math.max(maxZ, tg.z + tg.w);
  }
  const box = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
  mesh.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  return { object: mesh, tick };
}

// ------------------------------------------------------------ sparks

/** Embers lifted by the heat of the fires, drifting downwind. */
export function createSparks(sources: FireSource[], rng: Rng, count: number, drift: [number, number]): Effect {
  const geo = new THREE.TetrahedronGeometry(0.16, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", geo.getAttribute("position"));
  g.setAttribute("normal", geo.getAttribute("normal"));
  const ink = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    ink[i * 3] = 0;
    ink[i * 3 + 1] = 1;
    ink[i * 3 + 2] = ACCENT.ember;
  }
  g.setAttribute("inkInstance", new THREE.InstancedBufferAttribute(ink, 3));
  const mesh = new THREE.InstancedMesh(g, emissiveMaterial({ instanceInk: true, edge: 0 }), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.name = "sparks";
  noShadow(mesh);
  const src = new Int32Array(count);
  const ph = new Float32Array(count);
  const life = new Float32Array(count);
  const ox = new Float32Array(count);
  const oz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    src[i] = rng.int(0, sources.length - 1);
    ph[i] = rng.next();
    life[i] = rng.range(3, 6);
    ox[i] = rng.range(-1, 1);
    oz[i] = rng.range(-1, 1);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let maxH = 0;
  for (const s of sources) maxH = Math.max(maxH, s.pos[1] + s.size * 5);
  const tick: Tick = (_dt, t) => {
    for (let i = 0; i < count; i++) {
      const s = sources[src[i]!]!;
      const age = (ph[i]! + t / life[i]!) % 1;
      const h = s.size * 5 * age;
      p.set(
        s.pos[0] + ox[i]! * s.spread + drift[0] * age * age + Math.sin(t * 3 + i) * 0.6 * age,
        s.pos[1] + s.size * 0.4 + h,
        s.pos[2] + oz[i]! * s.spread + drift[1] * age * age + Math.cos(t * 2.6 + i) * 0.6 * age,
      );
      const k = (1 - age) * (0.6 + 0.8 * ((i * 7) % 5) / 5);
      sc.setScalar(k);
      q.setFromAxisAngle(p.clone().normalize(), t * 4 + i);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  tick(0, 0);
  let cx = 0,
    cz = 0;
  for (const s of sources) {
    cx += s.pos[0] / sources.length;
    cz += s.pos[2] / sources.length;
  }
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx + drift[0] * 0.5, maxH * 0.5, cz + drift[1] * 0.5), maxH + Math.hypot(drift[0], drift[1]) + 30);
  return { object: mesh, tick };
}

/**
 * Warm point lights for the biggest fires: they light nearby walls so the
 * hatching thins where the blaze falls. Returned hidden; `setNight(true)`
 * reveals them. Note: toggling lights changes three.js program keys, so the
 * integrator may prefer to leave them off.
 */
export function createFireLights(sources: FireSource[], rng: Rng, max = 3): Effect {
  const group = new THREE.Group();
  group.name = "fire-lights";
  const big = sources.slice().sort((a, b) => b.size - a.size).slice(0, max);
  const lights = big.map((s) => {
    const l = new THREE.PointLight(0xffffff, 0, s.size * 7, 1.6);
    l.position.set(s.pos[0], Math.max(3, s.pos[1] * 0.7), s.pos[2] + 6);
    l.castShadow = false;
    group.add(l);
    return { l, ph: rng.next() * 20, base: 60 + s.size * 26 };
  });
  group.visible = false;
  const tick: Tick = (_dt, t) => {
    if (!group.visible) return;
    for (const { l, ph, base } of lights) l.intensity = base * (0.82 + 0.12 * Math.sin(t * 7.3 + ph) + 0.08 * Math.sin(t * 13.1 + ph * 2));
  };
  return {
    object: group,
    tick,
    setNight: (on) => {
      group.visible = on;
    },
  };
}
