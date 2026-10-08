/**
 * Clouds: fair-weather cumulus, stratus sheets and storm cumulonimbus.
 *
 * Built from merged puff spheres (with smaller bubbles on their upper
 * surfaces for a cauliflower edge) whose bases are flattened, so the pen
 * finds the flat underside, the scalloped silhouette and the creases between
 * puffs. Shaded by the key light, hatched on shadowed sides and undersides.
 *
 * Clouds live in "sky space" at real scale (kilometres away, 1-3 km up) and
 * drift with the wind; each frame every cloud is drawn through a homothety
 * about the camera that lands it 1260-1560 m away. A homothety about the eye
 * preserves the image exactly, so each cloud keeps its true size, position
 * and parallax, but renders behind the backdrop hills and inside the far
 * plane, where its ink is pre-compensated for the composite's distance fade.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createNoise, type Noise } from "../../core/noise.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import { INK2D_GLSL, SKY_LOOK_UNIFORMS, SKY_OUT_GLSL } from "../terrain/glsl.ts";

export type CloudKind = "cumulus" | "stratus" | "cumulonimbus";

interface Puff {
  x: number;
  y: number;
  z: number;
  r: number;
  sx?: number;
  sy?: number;
  sz?: number;
  detail?: number;
}

/** One puff: a noise-displaced sphere, flattened below `floor`. */
function puffGeometry(p: Puff, noise: Noise, floor: number, seed: number): THREE.BufferGeometry {
  const detail = p.detail ?? 1;
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, Math.max(6, Math.round(11 * detail)), Math.max(4, Math.round(7 * detail)));
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise.n3(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4) * 0.055 + noise.n3(v.x * 3.1, v.y * 3.1 + seed, v.z * 3.1) * 0.02;
    v.multiplyScalar(1 + n);
    v.set(v.x * p.r * (p.sx ?? 1) + p.x, v.y * p.r * (p.sy ?? 1) + p.y, v.z * p.r * (p.sz ?? 1) + p.z);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // Flat base: clamp below the condensation level and point those normals down.
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < floor) {
      pos.setY(i, floor - Math.abs(noise.n2(pos.getX(i) * 0.004, pos.getZ(i) * 0.004)) * 6);
      nrm.setXYZ(i, 0, -1, 0);
    }
  }
  return g.toNonIndexed();
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const p of parts) count += p.getAttribute("position").count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  let o = 0;
  for (const p of parts) {
    const a = p.getAttribute("position").array as Float32Array;
    const b = p.getAttribute("normal").array as Float32Array;
    pos.set(a, o);
    nrm.set(b, o);
    o += a.length;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * Small bubbles on the upper surface of the big puffs: the cauliflower edge.
 * Embedded deep enough (centre ~0.55 r inside the parent) that the pen draws
 * a scalloped outline without ringing every bubble.
 */
function bubbles(rng: Rng, puffs: Puff[], count: number, scale: [number, number], minUp = 0.2): Puff[] {
  const out: Puff[] = [];
  for (let i = 0; i < count; i++) {
    const p = rng.pick(puffs);
    const th = rng.range(0, Math.PI * 2);
    const up = rng.range(minUp, 0.97);
    const r = p.r * rng.range(scale[0], scale[1]);
    const d = p.r - r * 0.55;
    const ring = Math.sqrt(1 - up * up);
    out.push({ x: p.x + Math.cos(th) * ring * d, y: p.y + up * d, z: p.z + Math.sin(th) * ring * d, r, detail: 0.55 });
  }
  return out;
}

export function cloudGeometry(kind: CloudKind, seed: number | string): THREE.BufferGeometry {
  const rng = createRng(`cloud:${kind}:${seed}`);
  const noise = createNoise(`cloud:${kind}:${seed}`);
  const puffs: Puff[] = [];
  let floor = 0;
  if (kind === "cumulus") {
    // A domed cauliflower on a flat base: tops follow an envelope profile.
    const W = rng.range(800, 1700);
    const Hmax = W * rng.range(0.42, 0.58);
    const skew = rng.range(-0.15, 0.15);
    const top = (x: number) => {
      const u = THREE.MathUtils.clamp((2 * x) / W - skew, -1, 1);
      return Hmax * Math.pow(1 - u * u, 0.55) * (0.85 + 0.3 * (noise.n2(x * 0.004, 3.1) * 0.5 + 0.5));
    };
    // Body: overlapping puffs along the base (flattened below y = 0).
    const nb = rng.int(6, 8);
    for (let i = 0; i < nb; i++) {
      const x = ((i + 0.5) / nb - 0.5) * W * 0.86;
      const r = Math.max(W * 0.1, Math.min(top(x) * 0.55, W * 0.2)) * rng.range(0.9, 1.1);
      puffs.push({ x, y: r * 0.35, z: rng.range(-0.1, 0.1) * W, r });
    }
    // Upper structure: puffs whose tops touch the envelope.
    const nu = rng.int(6, 9);
    for (let i = 0; i < nu; i++) {
      const x = ((i + rng.range(0.2, 0.8)) / nu - 0.5) * W * 0.78;
      const h = top(x);
      const r = THREE.MathUtils.clamp(h * rng.range(0.34, 0.46), W * 0.07, W * 0.2);
      puffs.push({ x, y: Math.max(r * 0.4, h - r * 0.95), z: rng.range(-0.12, 0.12) * W, r });
    }
    // Turrets over the tallest part.
    const nt = rng.int(1, 3);
    for (let i = 0; i < nt; i++) {
      const x = (skew * 0.5 + rng.range(-0.18, 0.18)) * W;
      const r = W * rng.range(0.08, 0.13);
      puffs.push({ x, y: top(x) - r * 0.35, z: rng.range(-0.06, 0.06) * W, r });
    }
    // Depth: broad, deeply embedded puffs behind and in front give volume
    // without reading as balls stuck on the face.
    for (let i = 0; i < 4; i++) {
      const x = rng.range(-0.28, 0.28) * W;
      const r = Math.min(top(x) * 0.62, W * 0.24);
      puffs.push({ x, y: Math.max(r * 0.3, top(x) - r * 1.25), z: (i % 2 ? 1 : -1) * W * rng.range(0.08, 0.13), r });
    }
    puffs.push(...bubbles(rng, puffs.slice(nb), rng.int(12, 18), [0.28, 0.45], 0.35));
  } else if (kind === "stratus") {
    // A long, thin layer: many flat lenses overlapping in a band.
    const L = rng.range(3200, 6400);
    const n = rng.int(9, 13);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = L * rng.range(0.07, 0.12) * (1 - Math.abs(t - 0.5) * 0.8);
      puffs.push({ x: (t - 0.5) * L * 0.9 + rng.range(-0.02, 0.02) * L, y: rng.range(-20, 20), z: rng.range(-0.06, 0.06) * L, r, sy: rng.range(0.09, 0.13), sz: rng.range(0.35, 0.5), detail: 0.8 });
    }
    floor = -Infinity;
  } else {
    // Cumulonimbus: a cauliflower tower that swells upward and spreads into
    // one continuous anvil sheared downwind (+x).
    const W = rng.range(2200, 2800);
    const H = rng.range(4200, 5200);
    let y = 0;
    while (y < H * 0.78) {
      const t = y / H;
      // Broad at the foot, a waist, then swelling into the anvil.
      const width = 0.95 - 0.35 * Math.sin(Math.min(1, t / 0.7) * Math.PI) + 0.3 * THREE.MathUtils.smoothstep(t, 0.55, 0.78);
      const r = W * 0.26 * rng.range(0.85, 1.15);
      const k = width > 0.8 ? 3 : 2;
      for (let j = 0; j < k; j++) {
        const x = (j - (k - 1) / 2) * W * width * 0.42 + t * W * 0.18 + rng.range(-0.07, 0.07) * W;
        puffs.push({ x, y: y + r * 0.45, z: rng.range(-0.14, 0.14) * W, r: r * rng.range(0.85, 1.1) });
      }
      y += r * 0.5;
    }
    // Anvil: a few broad, very flat lenses overlapping into one plate.
    for (let i = 0; i < 4; i++) {
      const r = W * rng.range(0.8, 1.0);
      puffs.push({ x: W * (0.3 + i * 0.42), y: H * (0.84 + 0.015 * i), z: rng.range(-0.08, 0.08) * W, r, sy: 0.12, sz: 0.6, detail: 1.2 });
    }
    puffs.push(...bubbles(rng, puffs.filter((p) => !p.sy), 26, [0.22, 0.34], 0.1));
  }
  const parts = puffs.map((p, i) => puffGeometry(p, noise, floor, i * 13.1));
  const merged = merge(parts);
  softenNormals(merged, kind === "stratus" ? 0.2 : 0.4, floor);
  return merged;
}

/**
 * Blend each puff normal toward the normal of the cloud's overall mass (an
 * ellipsoid about its centroid), so the pen draws the scalloped silhouette
 * and a few deep folds rather than outlining every sphere.
 */
function softenNormals(g: THREE.BufferGeometry, amount: number, floor: number): void {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const c = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  const r = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nrm, i);
    if (n.y < -0.99 && pos.getY(i) <= floor + 1e-3) continue; // keep the flat base
    r.set((pos.getX(i) - c.x) / Math.max(size.x, 1), (pos.getY(i) - c.y) / Math.max(size.y, 1), (pos.getZ(i) - c.z) / Math.max(size.z, 1)).normalize();
    n.lerp(r, amount).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
}

// --------------------------------------------------------------- material

const VERT = /* glsl */ `
out vec3 vObj;
out vec3 vObjN;
out vec3 vN;
out float vDepth;
void main() {
  vec4 wp = vec4(position, 1.0);
  vec3 nrm = normal;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  nrm = mat3(instanceMatrix) * nrm;
  #endif
  wp = modelMatrix * wp;
  vN = normalize(mat3(modelMatrix) * nrm);
  vObj = position;
  vObjN = normal;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outInk;
layout(location = 1) out highp vec4 outInfo;
in vec3 vObj;
in vec3 vObjN;
in vec3 vN;
in float vDepth;
uniform vec3 uSunDir;
uniform vec4 uCloudA; // base tone, night, gloom, fire
uniform vec4 uCloudB; // storm, uniformity, device px ratio, contour weight
${INK2D_GLSL}
${SKY_OUT_GLSL}

float cHatch(vec2 q, vec2 dqx, vec2 dqy, float tone, float pr, float seed) {
  float h = 0.0;
  float t1 = smoothstep(0.1, 0.26, tone);
  float t2 = smoothstep(0.42, 0.58, tone);
  float t3 = smoothstep(0.68, 0.82, tone);
  vec2 n1 = vec2(-0.28, 0.96);
  vec2 n2 = vec2(0.72, 0.69);
  vec2 n3 = vec2(-0.85, 0.52);
  if (t1 > 0.0) h = max(h, tgPen(dot(q, n1), dot(q, vec2(n1.y, -n1.x)), tgMpp(dqx, dqy, n1), 9.0, 9.0 * (0.12 + 0.42 * tone), 0.6 * pr, 1.8 * pr, 3.6 * pr, seed, 0.8, 1.0) * t1);
  if (t2 > 0.0) h = max(h, tgPen(dot(q, n2), dot(q, vec2(n2.y, -n2.x)), tgMpp(dqx, dqy, n2), 9.0, 9.0 * (0.1 + 0.36 * tone), 0.6 * pr, 1.7 * pr, 3.6 * pr, seed + 3.0, 0.8, 1.0) * t2);
  if (t3 > 0.0) h = max(h, tgPen(dot(q, n3), dot(q, vec2(n3.y, -n3.x)), tgMpp(dqx, dqy, n3), 7.0, 7.0 * (0.1 + 0.4 * tone), 0.6 * pr, 1.6 * pr, 3.2 * pr, seed + 7.0, 0.8, 1.0) * t3);
  return max(h, smoothstep(0.88, 0.96, tone));
}

void main() {
  vec3 n = normalize(vN);
  float night = uCloudA.y;
  float gloom = uCloudA.z;
  float fire = uCloudA.w;
  float storm = uCloudB.x;
  float pr = uCloudB.z;
  float ndl = dot(n, normalize(uSunDir));
  float shade = 1.0 - smoothstep(-0.45, 0.4, ndl);
  float under = smoothstep(-0.3, -0.9, n.y);
  float tone = uCloudA.x + shade * 0.3 + under * (0.16 + 0.3 * storm) + gloom * 0.12;
  // Night: dark bodies, paper where the moon catches them.
  tone = mix(tone, 0.82 - smoothstep(0.25, 0.8, ndl) * 0.5, night);
  tone = clamp(tone, 0.0, 1.0);

  vec3 an = pow(abs(normalize(vObjN)), vec3(4.0));
  an /= (an.x + an.y + an.z + 1e-5);
  vec3 dx = dFdx(vObj);
  vec3 dy = dFdy(vObj);
  float cov = 0.0;
  cov += an.x * cHatch(vObj.zy, dx.zy, dy.zy, tone, pr, 1.0);
  cov += an.y * cHatch(vObj.xz, dx.xz, dy.xz, tone, pr, 5.0);
  cov += an.z * cHatch(vObj.xy, dx.xy, dy.xy, tone, pr, 9.0);

  vec2 accent = vec2(0.0);
  // Fires below light the undersides faintly.
  if (fire > 0.01) accent = vec2(fire * under * 0.3 * (1.0 - night * 0.3), 6.0);

  float fog = skyFogAt(vDepth);
  outInk = skyInk(clamp(cov, 0.0, 1.0), accent, uCloudB.w, fog);
  outInfo = vec4(normalize((viewMatrix * vec4(n, 0.0)).xyz) * 0.5 + 0.5, 0.0);
}
`;

export function createCloudMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, -0.4).normalize() },
      uCloudA: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCloudB: { value: new THREE.Vector4(0, 0, 1, 1) },
      ...SKY_LOOK_UNIFORMS,
    },
  });
}

// ------------------------------------------------------------------ field

interface Slot {
  kind: CloudKind;
  mesh: THREE.InstancedMesh;
  index: number;
  /** Sky-space position (m): x/z wrap around the rig; y is altitude. */
  x: number;
  z: number;
  alt: number;
  yaw: number;
  /** 0..1 order in which clouds appear as density rises. */
  rank: number;
  size: number;
}

export interface CloudFieldOptions {
  seed?: number | string;
  quality?: "low" | "medium" | "high";
}

export interface CloudState {
  sunDir: THREE.Vector3;
  cloud: number;
  storm: number;
  gloom: number;
  night: number;
  fire: number;
  wind: number;
  windDir: THREE.Vector2;
  uniformity: number;
}

/** Sky-space half-extent of the cloud field, metres. */
const DOMAIN = 16000;
/** Render shell (m from the eye) that clouds are mapped into. */
const SHELL_NEAR = 1260;
const SHELL_FAR = 1560;

export interface CloudField {
  object: THREE.Group;
  update(dt: number, state: CloudState, rigWorld: THREE.Vector3, camera: THREE.Camera): void;
  readonly triangles: number;
  dispose(): void;
}

export function createCloudField(options: CloudFieldOptions = {}): CloudField {
  const seed = String(options.seed ?? "sky");
  const q = options.quality ?? "high";
  const rng = createRng(`clouds:${seed}`);
  const group = new THREE.Group();
  group.name = "clouds";
  const material = createCloudMaterial();
  const u = material.uniforms as {
    uSunDir: THREE.IUniform<THREE.Vector3>;
    uCloudA: THREE.IUniform<THREE.Vector4>;
    uCloudB: THREE.IUniform<THREE.Vector4>;
  };
  const stormMaterial = createCloudMaterial();
  const su = stormMaterial.uniforms as typeof u;
  su.uSunDir = u.uSunDir; // shared
  const layerMaterial = createCloudMaterial();
  const lu = layerMaterial.uniforms as typeof u;
  lu.uSunDir = u.uSunDir;
  let pixelRatio = 1;
  const trackRatio = (mesh: THREE.Mesh) => {
    mesh.onBeforeRender = (renderer) => {
      pixelRatio = renderer.getPixelRatio();
      u.uCloudB.value.z = pixelRatio;
      su.uCloudB.value.z = pixelRatio;
      lu.uCloudB.value.z = pixelRatio;
    };
  };

  const spec: Array<{ kind: CloudKind; variants: number; perVariant: number }> = [
    { kind: "cumulus", variants: q === "low" ? 3 : 5, perVariant: q === "low" ? 3 : 4 },
    { kind: "stratus", variants: 3, perVariant: 3 },
    { kind: "cumulonimbus", variants: 2, perVariant: 2 },
  ];
  const slots: Slot[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  let triangles = 0;
  for (const s of spec) {
    for (let v = 0; v < s.variants; v++) {
      const geometry = cloudGeometry(s.kind, `${seed}:${v}`);
      geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, s.kind === "cumulonimbus" ? stormMaterial : s.kind === "stratus" ? layerMaterial : material, s.perVariant);
      mesh.name = `cloud-${s.kind}-${v}`;
      mesh.frustumCulled = false;
      mesh.userData.noShadow = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      trackRatio(mesh);
      group.add(mesh);
      triangles += (geometry.getAttribute("position").count / 3) * s.perVariant;
      for (let i = 0; i < s.perVariant; i++) {
        slots.push({
          kind: s.kind,
          mesh,
          index: i,
          x: rng.range(-DOMAIN, DOMAIN),
          z: rng.range(-DOMAIN, DOMAIN),
          alt: s.kind === "stratus" ? rng.range(700, 1500) : s.kind === "cumulus" ? rng.range(1000, 1700) : rng.range(700, 900),
          yaw: s.kind === "cumulonimbus" ? 0 : rng.range(0, Math.PI * 2),
          rank: rng.next(),
          size: rng.range(0.85, 1.2),
        });
      }
    }
  }
  // Spread ranks evenly per kind so density maps smoothly to count.
  for (const kind of ["cumulus", "stratus", "cumulonimbus"] as CloudKind[]) {
    const ks = slots.filter((s) => s.kind === kind).sort((a, b) => a.rank - b.rank);
    ks.forEach((s, i) => (s.rank = (i + 0.5) / ks.length));
  }

  const packed = new Map<THREE.InstancedMesh, number>();
  let driftX = 0;
  let driftZ = 0;
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const off = new THREE.Vector3();
  const wrap = (v: number) => v - Math.floor((v + DOMAIN) / (2 * DOMAIN)) * 2 * DOMAIN;

  return {
    object: group,
    triangles: Math.round(triangles),
    update(dt, st, rigWorld, camera) {
      // Wind drift (sky space moves at real speeds: ~4-18 m/s).
      const speed = 4 + st.wind * 14;
      driftX += st.windDir.x * speed * dt;
      driftZ += st.windDir.y * speed * dt;
      camera.updateMatrixWorld();
      camPos.setFromMatrixPosition(camera.matrixWorld);
      if (group.parent) {
        group.parent.updateWorldMatrix(true, false);
        off.copy(camPos);
        group.parent.worldToLocal(off);
      } else off.copy(camPos);
      const far = (camera as THREE.PerspectiveCamera).far ?? 1600;
      const shellFar = Math.min(SHELL_FAR, far * 0.975);
      const shellNear = Math.min(SHELL_NEAR, shellFar - 200);
      const want = {
        cumulus: THREE.MathUtils.clamp(st.cloud * 1.15 - st.storm * 0.6 - st.uniformity * 0.5, 0, 1),
        stratus: THREE.MathUtils.clamp(st.gloom * 1.1 + Math.max(0, st.cloud - 0.55) * 1.6 + st.storm * 0.4, 0, 1),
        cumulonimbus: THREE.MathUtils.clamp(st.storm * 1.2 - 0.1, 0, 1),
      };
      const camY = camPos.y;
      packed.clear();
      for (const s of slots) {
        const density = want[s.kind];
        const grow = THREE.MathUtils.smoothstep(density, s.rank, s.rank + 0.12);
        const rx = wrap(s.x + driftX - rigWorld.x);
        const rz = wrap(s.z + driftZ - rigWorld.z);
        const edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(rx), Math.abs(rz)), DOMAIN * 0.78, DOMAIN * 0.98);
        const d = Math.hypot(rx, s.alt - camY, rz);
        const horiz = Math.hypot(rx, rz);
        // Layers and storm towers read best low over the horizon.
        const distant = s.kind === "stratus" ? THREE.MathUtils.smoothstep(horiz, 6500, 9000) : s.kind === "cumulonimbus" ? THREE.MathUtils.smoothstep(horiz, 10000, 13000) : 1;
        const visible = grow * edge * distant > 0.001 && d > 1500;
        if (!visible) continue;
        // Monotone map of true distance into the render shell.
        const t = d / (d + 7000);
        const R = shellNear + (shellFar - shellNear) * t;
        const k = R / d;
        pos.set(off.x + rx * k, off.y + (s.alt - camY) * k, off.z + rz * k);
        const g = grow * edge * distant * s.size * k;
        scl.set(g, g * (0.6 + 0.4 * grow), g);
        quat.setFromAxisAngle(yAxis, s.yaw + (s.kind === "cumulonimbus" ? Math.atan2(-st.windDir.y, st.windDir.x) : 0));
        m4.compose(pos, quat, scl);
        // Visible instances are packed to the front; count hides the rest.
        const n = packed.get(s.mesh) ?? 0;
        s.mesh.setMatrixAt(n, m4);
        packed.set(s.mesh, n + 1);
      }
      for (const c of group.children) {
        const mesh = c as THREE.InstancedMesh;
        mesh.count = packed.get(mesh) ?? 0;
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
      u.uSunDir.value.copy(st.sunDir);
      u.uCloudA.value.set(0.02 + st.gloom * 0.1, st.night, st.gloom, st.fire);
      u.uCloudB.value.set(st.storm, st.uniformity, pixelRatio, 1);
      su.uCloudA.value.set(0.16 + st.storm * 0.12, st.night, st.gloom, st.fire * 0.4);
      su.uCloudB.value.set(st.storm, st.uniformity, pixelRatio, 1);
      lu.uCloudA.value.set(0.0, st.night, st.gloom * 0.6, 0);
      lu.uCloudB.value.set(0, st.uniformity, pixelRatio, 0.55);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      material.dispose();
      stormMaterial.dispose();
      layerMaterial.dispose();
    },
  };
}
