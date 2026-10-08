/**
 * The backdrop: three rings of distant country that follow the camera
 * (parallax for rotation only, as for anything at infinity).
 *
 *   A  rolling hills with copses          ~980-1120 m
 *   B  second hills carrying the skyline  ~1130-1260 m
 *   C  mountains, sectored with passes    ~1290-1540 m
 *
 * Each ring is a 3D band of terrain (not a cut-out), lit by the key light:
 * slopes turned from the sun take hatching and topographic form lines, the
 * way an engraver models distant land; nearer rings are drawn heavier. The
 * skyline on ring B rises out of the hills as habitation, industry and
 * compute grow, breaks with ruin, and gives way to a rhythm of identical
 * monoliths under uniformity, which also levels the hills to a ruler-flat
 * horizon. Smoke columns stand over it when the country burns.
 *
 * Radii scale down with camera.far so the rings always stay inside it.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createNoise } from "../../core/noise.ts";
import { createRng } from "../../core/rng.ts";
import { Kit } from "../../core/geometry.ts";
import { INK2D_GLSL, SKY_LOOK_UNIFORMS, SKY_OUT_GLSL } from "../terrain/glsl.ts";
import { heightAt } from "../terrain/height.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { CH, SKYLINE_CHANNEL, kitHeight, plume, skylineElement, type SkylineKind } from "./skyline.ts";

/** Outer radius the layout is designed for (m). */
const DESIGN_FAR = 1560;

interface RingSpec {
  name: string;
  r0: number;
  r1: number;
  segA: number;
  segR: number;
  height: (x: number, z: number, theta: number) => number;
  flatten: number;
  toneScale: number;
  edge: number;
  objectId: number;
}

function envelope(s: number): number {
  const up = THREE.MathUtils.smoothstep(s, 0, 0.42);
  const down = 1 - 0.6 * THREE.MathUtils.smoothstep(s, 0.62, 1);
  return up * down;
}

function ringGeometry(spec: RingSpec): THREE.BufferGeometry {
  const { r0, r1, segA, segR } = spec;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= segR; j++) {
    const s = j / segR;
    const r = r0 + (r1 - r0) * s;
    const env = envelope(s);
    for (let i = 0; i <= segA; i++) {
      const th = (i / segA) * Math.PI * 2;
      const x = Math.sin(th) * r;
      const z = -Math.cos(th) * r;
      const y = -16 + (spec.height(x, z, th) + 16) * env;
      pos.push(x, y, z);
    }
  }
  const row = segA + 1;
  for (let j = 0; j < segR; j++) {
    for (let i = 0; i < segA; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      // Facing the centre (the eye).
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Seam: make the normals at theta = 0 and 2pi agree.
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let j = 0; j <= segR; j++) {
    const a = j * row;
    const b = a + segA;
    const nx = (n.getX(a) + n.getX(b)) / 2;
    const ny = (n.getY(a) + n.getY(b)) / 2;
    const nz = (n.getZ(a) + n.getZ(b)) / 2;
    n.setXYZ(a, nx, ny, nz);
    n.setXYZ(b, nx, ny, nz);
  }
  const ni = g.toNonIndexed();
  g.dispose();
  const count = ni.getAttribute("position").count;
  ni.setAttribute("aB", new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4));
  ni.setAttribute("inkAttr", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  return ni;
}

/** Smooth a column's normals toward its vertical axis so billows don't outline every puff. */
function columnNormals(g: THREE.BufferGeometry, ax: number, az: number, amount: number): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  const r = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nrm, i);
    r.set(pos.getX(i) - ax, 0, pos.getZ(i) - az).normalize();
    r.y = n.y * 0.6;
    n.lerp(r.normalize(), amount).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
}

/** Stamp the backdrop attributes onto an element's geometry. */
function tagged(geometry: THREE.BufferGeometry, channel: number, threshold: number, baseY: number, seed: number): THREE.BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const aB = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    aB[i * 4] = channel;
    aB[i * 4 + 1] = threshold;
    aB[i * 4 + 2] = baseY;
    aB[i * 4 + 3] = seed;
  }
  geometry.setAttribute("aB", new THREE.BufferAttribute(aB, 4));
  if (!geometry.getAttribute("inkAttr")) geometry.setAttribute("inkAttr", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  for (const name of Object.keys(geometry.attributes)) if (!["position", "normal", "aB", "inkAttr"].includes(name)) geometry.deleteAttribute(name);
  return geometry;
}

const VERT = /* glsl */ `
in vec4 aB;
in vec3 inkAttr;
uniform vec4 uEnvA; // habitation, industry, compute, order
uniform vec4 uEnvB; // ruin, smoke, vegetation, flatten
uniform float uFlat;
uniform float uTime;
out vec3 vPos;
out vec3 vN;
out vec3 vAttr;
out vec4 vB;
out float vDepth;
out float vRel;
void main() {
  vec3 p = position;
  vec3 n = normal;
  float ch = aB.x;
  float fl = mix(1.0, 0.035, uEnvB.w * uFlat);
  float grow = 1.0;
  if (ch < 0.5) {
    p.y *= fl;
    n = normalize(vec3(n.x * fl, n.y, n.z * fl));
    vRel = 0.0;
  } else {
    float v = ch < 1.5 ? uEnvA.x : ch < 2.5 ? uEnvA.y : ch < 3.5 ? uEnvA.z : ch < 4.5 ? uEnvA.w : ch < 5.5 ? uEnvB.z : ch < 6.5 ? uEnvB.y : uEnvA.y * (1.0 - uEnvB.x * 0.8);
    grow = smoothstep(aB.y, aB.y + 0.1, v);
    // Ruin truncates about half the skyline to broken stumps.
    if (ch < 3.5) grow *= mix(1.0, 0.25 + 0.55 * fract(aB.w * 7.31), uEnvB.x * step(0.45, fract(aB.w * 3.17)));
    float h = p.y - aB.z;
    if (ch > 5.5) {
      // Smoke leans downwind and breathes.
      p.x += sin(uTime * 0.25 + aB.w * 6.0 + h * 0.015) * h * 0.035;
    }
    if (ch > 6.5) {
      // Plumes rise from their chimney top only as the chimney itself rises.
      p.y = aB.z * fl + (h) * grow;
    }
    p.y = aB.z * fl + h * grow;
    vRel = h;
  }
  vPos = p;
  vN = normalize(mat3(modelMatrix) * n);
  vAttr = inkAttr;
  vB = aB;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outInk;
layout(location = 1) out highp vec4 outInfo;
in vec3 vPos;
in vec3 vN;
in vec3 vAttr;
in vec4 vB;
in float vDepth;
in float vRel;
uniform vec3 uSunDir;
uniform vec4 uLook;  // tone scale (aerial perspective), night, gloom, device px ratio
uniform vec4 uLook2; // contour weight, storm, sync (uniformity), time
uniform vec4 uEnvA;
uniform float uObjectId;
uniform float uSnow;
uniform float uArcR;
${INK2D_GLSL}
${SKY_OUT_GLSL}

float bHatch(vec2 q, vec2 dqx, vec2 dqy, float tone, float pr) {
  float h = 0.0;
  float t1 = smoothstep(0.1, 0.26, tone);
  float t2 = smoothstep(0.42, 0.58, tone);
  float t3 = smoothstep(0.68, 0.82, tone);
  // 3-4-5 directions: with the arc coordinate's 10 m wrap step (see main)
  // every family meets itself exactly across the atan() seam.
  vec2 n1 = vec2(0.6, 0.8);
  vec2 n2 = vec2(-0.8, 0.6);
  if (t1 > 0.0) h = max(h, tgPen(dot(q, n1), dot(q, vec2(n1.y, -n1.x)), tgMpp(dqx, dqy, n1), 2.0, 2.0 * (0.12 + 0.42 * tone), 0.55 * pr, 1.6 * pr, 3.4 * pr, 2.0, 0.7, 1.0) * t1);
  if (t2 > 0.0) h = max(h, tgPen(dot(q, n2), dot(q, vec2(n2.y, -n2.x)), tgMpp(dqx, dqy, n2), 2.0, 2.0 * (0.1 + 0.36 * tone), 0.55 * pr, 1.5 * pr, 3.4 * pr, 6.0, 0.7, 1.0) * t2);
  if (t3 > 0.0) h = max(h, tgPen(q.y, q.x, tgMpp(dqx, dqy, vec2(0.0, 1.0)), 1.6, 1.6 * (0.1 + 0.4 * tone), 0.55 * pr, 1.5 * pr, 3.0 * pr, 9.0, 0.7, 1.0) * t3);
  return max(h, smoothstep(0.88, 0.96, tone));
}

void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float night = uLook.y;
  float gloom = uLook.z;
  float pr = uLook.w;
  float ch = vB.x;
  float ndl = dot(n, normalize(uSunDir));
  float shade = 1.0 - smoothstep(-0.12, 0.62, ndl);
  float albedo = max(vAttr.x, 0.0);
  float isTerrain = step(ch, 0.5);
  float tone = albedo * 0.7 + shade * 0.52 * uLook.x + gloom * 0.18 + uLook2.y * 0.12;
  // Snowfields on the high mountains stay paper.
  float snow = uSnow * smoothstep(150.0, 185.0, vPos.y) * smoothstep(0.55, 0.8, n.y) * isTerrain;
  tone *= 1.0 - snow;
  if (ch > 5.5 && ch < 6.5) tone = mix(0.62, 0.22, smoothstep(10.0, 160.0, vRel)) + shade * 0.3; // smoke: dark root, paler head
  if (ch > 6.5) tone = 0.04 + shade * 0.3 + gloom * 0.08; // pale plumes
  // Night: the country becomes a dark mass under a darker sky.
  tone = mix(tone, 0.8 + albedo * 0.1 - smoothstep(0.4, 0.9, ndl) * 0.15, night);
  tone = clamp(tone, 0.0, 1.0);

  // Arc coordinate with a whole number of 10 m steps around the ring.
  float ringR = uArcR;
  float a1 = atan(vPos.x, -vPos.z);
  float a2 = atan(-vPos.x, vPos.z); // same angle + pi, wrapping on the other side
  float arc = a1 * ringR;
  vec2 q = vec2(arc, vPos.y);
  // Derivatives from whichever angle is continuous here.
  vec2 d1 = vec2(dFdx(a1), dFdy(a1));
  vec2 d2 = vec2(dFdx(a2), dFdy(a2));
  vec2 da = abs(a1) < 1.5708 ? d1 : d2;
  vec2 dqx = vec2(da.x * ringR, dFdx(vPos.y));
  vec2 dqy = vec2(da.y * ringR, dFdy(vPos.y));
  float cov = bHatch(q, dqx, dqy, tone, pr);
  // Topographic form lines on the terrain, stronger on shadowed slopes.
  if (isTerrain > 0.5) {
    float form = tgPen(vPos.y, arc, tgMpp(dqx, dqy, vec2(0.0, 1.0)), 7.0, 0.5, 0.5 * pr, 1.0 * pr, 5.0 * pr, 13.0, 0.9, 0.0);
    cov = max(cov, form * (0.25 + 0.75 * shade) * uLook.x * (1.0 - snow) * (1.0 - night * 0.7) * smoothstep(-4.0, 6.0, vPos.y));
  }

  vec2 accent = vec2(0.0);
  // Lit windows at night: paper dots in the dark blocks.
  if (ch > 0.5 && ch < 4.5 && night > 0.05 && abs(n.y) < 0.3) {
    vec2 wq = vec2(arc / 3.6, vRel / 4.2);
    vec2 wc = floor(wq);
    vec2 wf = wq - wc;
    float sync = uLook2.z;
    float lit = step(tgHash(wc + vB.w * 31.0), mix(0.35, 0.8, sync) * clamp(uEnvA.x + uEnvA.z, 0.0, 1.0));
    float pane = step(0.3, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.75) * step(1.0, vRel);
    cov = mix(cov, 0.0, lit * pane * night);
  }
  // Warning lamps: synchronised when the world is uniform.
  if (vAttr.z > 1.5 && vAttr.z < 2.5) {
    float phase = mix(fract(vB.w * 13.7), 0.0, uLook2.z);
    float blink = step(0.55, fract(uLook2.w * 0.5 + phase));
    float show = clamp(night + uLook2.y + gloom * 0.5, 0.0, 1.0);
    accent = vec2(blink * show, 2.0);
    cov = max(cov, 0.4);
  }

  float fog = skyFogAt(vDepth);
  outInk = skyInk(clamp(cov, 0.0, 1.0), accent, uLook2.x, fog);
  outInfo = vec4(normalize((viewMatrix * vec4(n, 0.0)).xyz) * 0.5 + 0.5, uObjectId);
}
`;

export interface BackdropState {
  sunDir: THREE.Vector3;
  habitation: number;
  industry: number;
  compute: number;
  uniformity: number;
  perfection: number;
  ruin: number;
  fire: number;
  vegetation: number;
  night: number;
  gloom: number;
  storm: number;
  time: number;
}

export interface BackdropOptions {
  seed?: number | string;
  quality?: "low" | "medium" | "high";
}

export interface Backdrop {
  object: THREE.Group;
  update(dt: number, state: BackdropState, rigWorld: THREE.Vector3, camera: THREE.Camera): void;
  readonly triangles: number;
  dispose(): void;
}

export function createBackdrop(options: BackdropOptions = {}): Backdrop {
  const seed = String(options.seed ?? "sky");
  const q = options.quality ?? "high";
  const detail = q === "low" ? 0.5 : q === "medium" ? 0.75 : 1;
  const noise = createNoise(`backdrop:${seed}`);
  const rng = createRng(`backdrop:${seed}`);
  const group = new THREE.Group();
  group.name = "backdrop";

  const hillsA = (x: number, z: number) => {
    const n = noise.fbm2(x / 420 + 11, z / 420, 4) * 0.5 + 0.5;
    return 5 + 40 * Math.pow(n, 1.5) + 7 * noise.n2(x / 130, z / 130);
  };
  const hillsB = (x: number, z: number) => {
    const n = noise.fbm2(x / 520 - 7, z / 520 + 3, 4) * 0.5 + 0.5;
    return 8 + 58 * Math.pow(n, 1.4);
  };
  const mountains = (x: number, z: number, th: number) => {
    const mask = THREE.MathUtils.smoothstep(noise.n2(Math.cos(th) * 1.4 + 40, Math.sin(th) * 1.4), -0.35, 0.45);
    const ridge = noise.ridge2(x / 850 + 5, z / 850 - 2, 5);
    return 18 + mask * 215 * Math.pow(ridge, 1.7) + 12 * noise.n2(x / 200, z / 200);
  };

  const specs: RingSpec[] = [
    { name: "hills-near", r0: 980, r1: 1120, segA: Math.round(600 * detail), segR: 7, height: hillsA, flatten: 1, toneScale: 1, edge: 1, objectId: 0.11 },
    { name: "hills-far", r0: 1130, r1: 1260, segA: Math.round(540 * detail), segR: 6, height: hillsB, flatten: 1, toneScale: 0.78, edge: 0.85, objectId: 0.12 },
    { name: "mountains", r0: 1290, r1: 1540, segA: Math.round(720 * detail), segR: 11, height: mountains, flatten: 0.6, toneScale: 0.6, edge: 0.6, objectId: 0.13 },
  ];

  const materials: THREE.ShaderMaterial[] = [];
  const shared = {
    uSunDir: { value: new THREE.Vector3(0.3, 0.7, -0.5).normalize() },
    uEnvA: { value: new THREE.Vector4() },
    uEnvB: { value: new THREE.Vector4() },
    uTime: { value: 0 },
  };
  const makeMaterial = (spec: RingSpec, snow: number) => {
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        ...shared,
        ...SKY_LOOK_UNIFORMS,
        uFlat: { value: spec.flatten },
        uLook: { value: new THREE.Vector4(spec.toneScale, 0, 0, 1) },
        uLook2: { value: new THREE.Vector4(spec.edge, 0, 0, 0) },
        uObjectId: { value: spec.objectId },
        uSnow: { value: snow },
        // 2 pi uArcR is a multiple of 10 m (hatch period 2 m, 3-4-5 directions).
        uArcR: { value: (Math.round((2 * Math.PI * (spec.r0 + spec.r1)) / 2 / 10) * 10) / (2 * Math.PI) },
      },
    });
    materials.push(m);
    return m;
  };

  let triangles = 0;
  let skyline: THREE.Mesh | null = null;
  let monoliths: THREE.Mesh | null = null;
  let smoke: THREE.Mesh | null = null;
  let plumeMesh: THREE.Mesh | null = null;
  const geometries: THREE.BufferGeometry[] = [];
  const meshes: THREE.Mesh[] = [];
  const addMesh = (g: THREE.BufferGeometry, m: THREE.ShaderMaterial, name: string) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.userData.noShadow = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.onBeforeRender = (renderer) => {
      (m.uniforms.uLook!.value as THREE.Vector4).w = renderer.getPixelRatio();
    };
    group.add(mesh);
    geometries.push(g);
    meshes.push(mesh);
    triangles += g.getAttribute("position").count / 3;
    return mesh;
  };

  // --- ring A with copses
  {
    const spec = specs[0]!;
    const parts = [ringGeometry(spec)];
    const copses = Math.round(56 * detail);
    for (let i = 0; i < copses; i++) {
      const th = ((i + rng.range(0, 0.8)) / copses) * Math.PI * 2;
      const s = rng.range(0.3, 0.55);
      const r = spec.r0 + (spec.r1 - spec.r0) * s;
      const x = Math.sin(th) * r;
      const z = -Math.cos(th) * r;
      const y = -16 + (spec.height(x, z, th) + 16) * envelope(s);
      const k = new Kit();
      const n = rng.int(3, 6);
      for (let j = 0; j < n; j++) {
        const rr = rng.range(4.5, 8);
        const g = new THREE.SphereGeometry(rr, 7, 5);
        g.scale(1, rng.range(0.85, 1.2), 1);
        k.add(g, { tone: "light", position: [x + rng.range(-12, 12), y + rr * 0.75 + rng.range(0, 3), z + rng.range(-6, 6)] });
      }
      parts.push(tagged(k.build(), CH.trees, rng.range(0.05, 0.6), y - 2, rng.next()));
    }
    addMesh(mergeGeometries(parts)!, makeMaterial(spec, 0), spec.name);
    for (const p of parts) p.dispose();
  }

  // --- ring B with the skyline (terrain, skyline, monoliths and smoke are
  // separate meshes so absent layers cost nothing)
  {
    const spec = specs[1]!;
    const ringMaterial = makeMaterial(spec, 0);
    addMesh(ringGeometry(spec), ringMaterial, spec.name);
    const parts: THREE.BufferGeometry[] = [];
    const monoParts: THREE.BufferGeometry[] = [];
    const smokeParts: THREE.BufferGeometry[] = [];
    const plumeParts: THREE.BufferGeometry[] = [];
    const sectorNoise = (th: number) => noise.n2(Math.cos(th) * 1.8 + 9, Math.sin(th) * 1.8 - 4);
    // Sectors of the horizon lean toward town, works or compute, with ragged
    // edges; elements outside their home sector appear only at high values,
    // so a channel near 1 fills the whole horizon.
    const count = Math.round(170 * detail);
    const plan: Array<{ kind: SkylineKind; th: number; away: number }> = [];
    for (let i = 0; i < count; i++) {
      const th = ((i + rng.range(0, 0.9)) / count) * Math.PI * 2;
      const sn = sectorNoise(th);
      const jn = sn + rng.range(-0.45, 0.45);
      let kind: SkylineKind;
      let home: number;
      if (jn < -0.12) {
        kind = rng.pick(["houses", "houses", "houses", "church", "water-tower", "office", "houses"] as const);
        home = sn < -0.12 ? 0 : 1;
      } else if (jn < 0.22) {
        kind = rng.pick(["shed", "chimney", "gasometer", "crane", "cooling-tower", "shed", "chimney", "houses"] as const);
        home = sn >= -0.12 && sn < 0.22 ? 0 : 1;
      } else {
        kind = rng.pick(["data-hall", "data-hall", "mast", "pylon", "pylon", "cooling-tower", "turbine", "crane"] as const);
        home = sn >= 0.22 ? 0 : 1;
      }
      plan.push({ kind, th, away: home });
    }
    const orderRng = rng.fork("order");
    for (const p of plan) {
      const ch = SKYLINE_CHANNEL[p.kind];
      const s = orderRng.range(0.38, 0.52);
      const r = spec.r0 + (spec.r1 - spec.r0) * s;
      const x = Math.sin(p.th) * r;
      const z = -Math.cos(p.th) * r;
      const baseY = -16 + (spec.height(x, z, p.th) + 16) * envelope(s) - 2.5;
      const k = skylineElement(p.kind, orderRng);
      const g = k.build();
      // Drawn a third larger than life, as illustrators do with far skylines.
      const m = new THREE.Matrix4().makeRotationY(-p.th).scale(new THREE.Vector3(1.35, 1.35, 1.35));
      m.setPosition(x, baseY, z);
      g.applyMatrix4(m);
      // Earlier kinds of each channel appear first (small thresholds); away
      // from their home sector, elements wait for high values.
      const early = p.kind === "houses" || p.kind === "shed" || p.kind === "pylon" || p.kind === "data-hall" ? 0 : 0.2;
      const thr = THREE.MathUtils.clamp(early + p.away * 0.3 + orderRng.range(0.05, 0.5), 0.04, 0.92);
      const seedV = orderRng.next();
      parts.push(tagged(g, ch, thr, baseY, seedV));
      if (p.kind === "chimney" || p.kind === "cooling-tower") {
        const top = kitHeight(g) - baseY;
        const pg = plume(orderRng, p.kind === "cooling-tower").build();
        const pm = new THREE.Matrix4().makeRotationY(-p.th);
        pm.setPosition(x, baseY + top - 2, z);
        pg.applyMatrix4(pm);
        plumeParts.push(tagged(pg, CH.plume, thr + 0.05, baseY, seedV));
      }
    }
    // Monoliths: an identical rhythm every 7.5 degrees.
    const mono = Math.round(48 * detail);
    for (let i = 0; i < mono; i++) {
      const th = (i / mono) * Math.PI * 2;
      const r = spec.r0 + 20;
      const x = Math.sin(th) * r;
      const z = -Math.cos(th) * r;
      const g = skylineElement("monolith", rng).build();
      const m = new THREE.Matrix4().makeRotationY(-th);
      m.setPosition(x, -4, z);
      g.applyMatrix4(m);
      monoParts.push(tagged(g, CH.order, 0.3, -4, 0.5));
    }
    // Smoke columns: billowing puffs that thicken as they rise and shear
    // downwind into a spreading head.
    const columns = 7;
    for (let i = 0; i < columns; i++) {
      const th = ((i + rng.range(0.1, 0.9)) / columns) * Math.PI * 2;
      const r = spec.r0 + rng.range(10, 60);
      const x = Math.sin(th) * r;
      const z = -Math.cos(th) * r;
      const k = new Kit();
      // A fire's column: a dark root rising, then bending over and carried
      // downwind as a long, widening, paler trail.
      const H = rng.range(170, 250);
      const D = rng.range(380, 560);
      let sPar = 0;
      const pathLen = H + D * 0.6;
      while (sPar < 1) {
        const rr = (14 + 50 * sPar) * rng.range(0.85, 1.15);
        const cy = H * (1 - (1 - sPar) * (1 - sPar));
        const cx = x + D * sPar * sPar + rng.range(-0.15, 0.15) * rr;
        const cz = z + rng.range(-0.2, 0.2) * rr;
        const lumps = sPar > 0.35 ? 2 : 1;
        for (let j = 0; j < lumps; j++) {
          const r = rr * (j === 0 ? 1 : rng.range(0.6, 0.8));
          const g = new THREE.SphereGeometry(r, 8, 5);
          g.scale(1.15, 0.8, 1);
          const a = rng.range(0, Math.PI * 2);
          const off = j === 0 ? 0 : rr * rng.range(0.45, 0.8);
          k.add(g, { tone: "mid", position: [cx + Math.cos(a) * off, cy + rr * 0.35 + (j ? rng.range(-0.3, 0.35) * rr : 0), cz + Math.sin(a) * off * 0.5] });
        }
        sPar += (rr * 0.6) / pathLen;
      }
      const sg = k.build();
      columnNormals(sg, x, z, 0.72);
      smokeParts.push(tagged(sg, CH.smoke, rng.range(0.1, 0.5), 0, rng.next()));
    }
    skyline = addMesh(mergeGeometries(parts)!, ringMaterial, "skyline");
    monoliths = addMesh(mergeGeometries(monoParts)!, ringMaterial, "monoliths");
    smoke = addMesh(mergeGeometries(smokeParts)!, ringMaterial, "smoke");
    plumeMesh = addMesh(mergeGeometries(plumeParts)!, ringMaterial, "plumes");
    for (const p of [...parts, ...monoParts, ...smokeParts, ...plumeParts]) p.dispose();
  }

  // --- ring C: mountains
  addMesh(ringGeometry(specs[2]!), makeMaterial(specs[2]!, 1), specs[2]!.name);

  const pos = new THREE.Vector3();
  let time = 0;
  return {
    object: group,
    triangles: Math.round(triangles),
    update(dt, st, rigWorld, camera) {
      time += dt;
      camera.updateMatrixWorld();
      pos.setFromMatrixPosition(camera.matrixWorld);
      // Follow the eye horizontally; stand on the local ground.
      pos.y = heightAt(rigWorld.x, rigWorld.z) - INK_GLOBALS.uInkWorldOffset.value.y;
      if (group.parent) {
        group.parent.updateWorldMatrix(true, false);
        group.parent.worldToLocal(pos);
      }
      group.position.copy(pos);
      const far = (camera as THREE.PerspectiveCamera).far ?? 1600;
      group.scale.setScalar(Math.min(1, (far * 0.975) / DESIGN_FAR));
      shared.uSunDir.value.copy(st.sunDir);
      shared.uEnvA.value.set(st.habitation, Math.max(st.industry, st.compute * 0.5), st.compute, Math.max(st.uniformity, st.perfection));
      shared.uEnvB.value.set(st.ruin, Math.max(st.fire, st.ruin * 0.4), st.vegetation, st.uniformity);
      shared.uTime.value = time;
      if (skyline) skyline.visible = Math.max(st.habitation, st.industry, st.compute) > 0.03;
      if (monoliths) monoliths.visible = Math.max(st.uniformity, st.perfection) > 0.25;
      if (smoke) smoke.visible = Math.max(st.fire, st.ruin * 0.4) > 0.08;
      if (plumeMesh) plumeMesh.visible = st.industry > 0.05;
      for (const m of materials) {
        const l = m.uniforms.uLook!.value as THREE.Vector4;
        l.y = st.night;
        l.z = st.gloom;
        const l2 = m.uniforms.uLook2!.value as THREE.Vector4;
        l2.y = st.storm;
        l2.z = Math.max(st.uniformity, st.perfection);
        l2.w = time;
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/** Lab/debug: the list of skyline element kinds. */
export const SKYLINE_KINDS: readonly SkylineKind[] = [
  "houses",
  "church",
  "water-tower",
  "office",
  "chimney",
  "cooling-tower",
  "shed",
  "gasometer",
  "crane",
  "data-hall",
  "mast",
  "pylon",
  "turbine",
  "monolith",
];
