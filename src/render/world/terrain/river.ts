/**
 * A river: a ribbon along a polyline, with low levee banks either side.
 *
 * Drawn the way an engraver draws water: the surface is left mostly paper,
 * crossed by broken horizontal strokes that shimmer slowly and crowd toward
 * the far bank where it reflects; a firm shoreline; tapering hachures down
 * both faces of each bank. `water` sets the width of the water; `drought`
 * shrinks it to a trickle and exposes a bed of cracked mud. In storms, rain
 * rings open on the surface near the cab.
 *
 * The mesh sits a few centimetres above the height field and lifts slightly
 * with distance so the coarse far rings of the ground never poke through.
 * Rivers crossing the track need a bridge from the integrator: the banks are
 * 0.4 m levees and are not flattened under the rails.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { heightAt } from "./height.ts";
import { GROUND_LATTICE } from "./ground.ts";
import { INK2D_GLSL } from "./glsl.ts";
import { createInkLambert, trackPixelScale } from "./ink-lambert.ts";

export interface RiverOptions {
  /** World XZ polyline (absolute metres), at least two points. */
  points: Array<[number, number]>;
  /** Water width (m) at water = 1, drought = 0. Default 16. */
  width?: number;
  /** Width of each levee bank (m). Default 5. */
  bank?: number;
  /** Resampling step along the river (m). Default 2.5. */
  step?: number;
  objectId?: number;
}

export interface RiverModule {
  readonly object: THREE.Mesh;
  update(dt: number, env: EnvironmentTarget, rigWorld: THREE.Vector3, camera: THREE.Camera): void;
  /** Height of the river surface/banks (falls back to the ground height). */
  heightAt(x: number, z: number): number;
  /** Arc length of the smoothed centreline, metres. */
  readonly length: number;
  readonly triangles: number;
  dispose(): void;
}

// Cross-section: [lateral offset as a fraction key, height above ground].
function profile(W: number, B: number): Array<[number, number]> {
  const h = W / 2;
  return [
    [-(h + B), 0.03],
    [-(h + B * 0.72), 0.22],
    [-(h + B * 0.45), 0.4],
    [-(h + 0.6), 0.1],
    [-h, 0.03],
    [-h * 0.5, 0.02],
    [0, 0.02],
    [h * 0.5, 0.02],
    [h, 0.03],
    [h + 0.6, 0.1],
    [h + B * 0.45, 0.4],
    [h + B * 0.72, 0.22],
    [h + B, 0.03],
  ];
}

const VERTEX_HEAD = /* glsl */ `
attribute vec2 aRiver; // along (m), across (m)
attribute vec2 aLat;   // unit lateral direction (world XZ)
varying vec2 vRiver;
varying vec3 vRScene;
varying float vCamSide;
varying vec2 vLat;
uniform vec3 uRCam;
`;

const VERTEX_TAIL = /* glsl */ `
{
  vec4 rw = modelMatrix * vec4(transformed, 1.0);
  vRiver = aRiver;
  vLat = aLat;
  vRScene = rw.xyz;
  vec2 centre = rw.xz - aLat * aRiver.y;
  vCamSide = sign(dot(uRCam.xz - centre, aLat));
  // Lift with distance so coarse ground rings never poke through.
  float dist = length(uRCam - rw.xyz);
  vec4 lifted = rw + vec4(0.0, dist * 0.0012, 0.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * lifted;
}
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec2 vRiver;
varying vec3 vRScene;
varying float vCamSide;
varying vec2 vLat;
uniform vec4 uREnv;  // water half-width (m), drought, storm, night
uniform vec4 uRGeo;  // design half-width, bank width, gloom, perfection
uniform vec2 uROff;  // world offset modulo the ground lattice
uniform float uREdge;
uniform float uRObjectId;
uniform vec3 uPxScale;
${INK2D_GLSL}
`;

const FRAGMENT_OUT = /* glsl */ `
{
  float pr = max(uPxScale.y, 0.5);
  vec2 rv = vRiver;
  vec2 dRx = dFdx(rv);
  vec2 dRy = dFdy(rv);
  float mppU = max(abs(dRx.x) + abs(dRy.x), 1e-6);
  float mppV = max(abs(dRx.y) + abs(dRy.y), 1e-6);
  vec2 wp = vRScene.xz + uROff;
  vec2 dpx = dFdx(vRScene.xz);
  vec2 dpy = dFdy(vRScene.xz);
  float dist = length(vViewPosition);
  float halfW = uREnv.x;
  float drought = uREnv.y;
  float storm = uREnv.z;
  float night = uREnv.w;
  float H = uRGeo.x;
  float B = uRGeo.y;
  float gloom = uRGeo.z;
  float breakup = 1.0 - uRGeo.w * 0.9;
  float av = abs(rv.y);

  float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float shadow = clamp(1.0 - lum / inkRefLight(), 0.0, 1.0);
  float cov = 0.0;
  float tone = night * 0.5 + gloom * 0.2;

  if (av < halfW) {
    // ---------------------------------------------------------- water
    // Engraved water: broken horizontal strokes, crowding into a dark band
    // under the far bank (its reflection), sparse in mid-stream (the sky).
    float farSide = step(0.0, -rv.y * vCamSide);
    float refl = farSide * (1.0 - smoothstep(0.0, max(halfW * 0.6, 1.5), halfW - av));
    float nearEdge = (1.0 - farSide) * (1.0 - smoothstep(0.0, 1.0, halfW - av));
    float wTone = clamp(0.24 + 0.55 * refl + 0.25 * nearEdge + tone * 0.8 + storm * 0.12, 0.0, 1.0);
    float rowP = 2.7 * pr;
    float row = gl_FragCoord.y / rowP;
    float ri = floor(row);
    float wobble = tgNoise(vec2(gl_FragCoord.x / (70.0 * pr), ri * 0.31 + INK_T * 0.05));
    float dash = tgNoise(vec2(gl_FragCoord.x / (11.0 * pr) + INK_T * 0.35 * (0.5 + wobble), ri * 1.37));
    float on = step(1.0 - clamp(wTone * 1.35, 0.0, 0.97), dash);
    float lineW = (0.7 + 0.9 * wTone) * pr;
    float strokes = (1.0 - smoothstep(lineW * 0.5 - 0.4, lineW * 0.5 + 0.5, abs(fract(row) - 0.5) * rowP)) * on;
    cov = max(cov, strokes);
    cov = max(cov, smoothstep(0.8, 0.95, wTone));
    // Rain rings near the cab.
    if (storm > 0.2 && dist < 40.0) {
      vec2 c = floor(wp / 0.9);
      vec2 h = tgHash2(c + 3.0);
      vec2 ctr = (c + 0.2 + 0.6 * h) * 0.9;
      float ph = fract(INK_T * (0.7 + h.y) + h.x);
      float rr = ph * 0.45;
      vec2 d = wp - ctr;
      float mppR = max(abs(dot(dpx, normalize(d + 1e-4))) + abs(dot(dpy, normalize(d + 1e-4))), 1e-6);
      float ring = tgLine(length(d) - rr, mppR, 0.02, 0.6 * pr, 1.2 * pr) * (1.0 - ph) * step(h.x, storm * 0.7);
      cov = max(cov, ring * (1.0 - smoothstep(20.0, 40.0, dist)));
    }
    // The shoreline.
    cov = max(cov, tgLine(av - halfW, mppV, 0.08, 1.0 * pr, 2.0 * pr));
  } else if (av < H + 0.6) {
    // ---------------------------------------------------------- exposed bed
    float dry = smoothstep(0.0, 0.4, drought);
    vec2 cid;
    vec2 ts;
    vec2 sd;
    vec2 oid;
    float e = tgVoronoi(wp / 0.9, 0.85, vec2(0.0), cid, ts, sd, oid) * 0.9;
    float mppE = max(abs(dot(dpx, normalize(sd))) + abs(dot(dpy, normalize(sd))), 1e-6);
    float cellPx = 0.9 / max(length(dpy), 1e-6) / pr;
    float cracks = tgLine(e, mppE, mix(0.015, 0.05, tgHash(cid + oid)), 0.6 * pr, 1.6 * pr) * smoothstep(3.0, 7.0, cellPx);
    // Curled mud flakes: a short hatch in the middle of some cells.
    cov = max(cov, cracks * (0.55 + 0.45 * dry));
    // Old water lines along the bed.
    float lines = tgPen(rv.y, rv.x, mppV, 1.3, 0.03, 0.55 * pr, 1.0 * pr, 5.0 * pr, 3.0, breakup, 0.0) * 0.6;
    cov = max(cov, lines * dry);
    cov = max(cov, tgLine(av - halfW, mppV, 0.06, 0.9 * pr, 1.6 * pr));
  } else {
    // ---------------------------------------------------------- banks
    float crest = H + B * 0.45;
    float t = av < crest ? (crest - av) / max(crest - H - 0.6, 0.1) : (av - crest) / max(B * 0.55, 0.1);
    // Bank strokes: short vertical pen ticks hanging from the crest,
    // anchored along the bank, long and short in turn.
    float det = dpx.x * dpy.y - dpx.y * dpy.x;
    mat2 Jinv = abs(det) > 1e-14 ? inverse(mat2(dpx, dpy)) : mat2(0.0);
    vec2 L = normalize(vLat);
    vec2 T = vec2(L.y, -L.x);
    float per = 0.45;
    float idx = floor(rv.x / per + 0.5);
    float h1 = tgHash(vec2(idx, av < crest ? 1.0 : 2.0));
    float len = mod(idx, 2.0) < 0.5 ? 0.6 + 0.3 * h1 : 0.25 + 0.2 * h1;
    vec2 toAnchor = (idx * per - rv.x) * T + (sign(rv.y) * crest - rv.y) * L;
    vec2 sOff = Jinv * (-toAnchor);
    float wpx = mix(1.4, 0.5, clamp(t / len, 0.0, 1.0)) * pr;
    float spacing = per / mppU / pr;
    float tickVis = smoothstep(2.5, 5.0, spacing);
    float hach = (1.0 - smoothstep(wpx * 0.5 - 0.4, wpx * 0.5 + 0.5, abs(sOff.x))) * step(t, len) * tickVis;
    cov = max(cov, hach);
    // Seen end-on the ticks crowd together: run strokes along the face instead.
    float along = tgPen(rv.y, rv.x, mppV, 0.55, 0.03, 0.55 * pr, 1.1 * pr, 3.2 * pr, 5.0, breakup, 0.0) * step(0.08, t);
    cov = max(cov, along * (1.0 - tickVis) * 0.85);
    // Crest and toe lines.
    cov = max(cov, tgLine(av - crest, mppV, 0.05, 0.8 * pr, 1.4 * pr));
    cov = max(cov, tgLine(av - (H + B), mppV, 0.03, 0.6 * pr, 1.0 * pr) * 0.6);
    tone += smoothstep(0.08, 0.5, shadow) * 0.5;
  }
  // Light and night hatching over everything.
  if (tone > 0.1) {
    vec2 n1 = vec2(0.70710678, 0.70710678);
    float mpp1 = max(abs(dot(dpx, n1)) + abs(dot(dpy, n1)), 1e-6);
    float hh = tgPen(dot(wp, n1), dot(wp, vec2(-n1.y, n1.x)), mpp1, 0.1414, 0.1414 * (0.12 + 0.4 * tone), 0.7 * pr, 2.2 * pr, 3.4 * pr, 3.0, breakup, 1.0);
    cov = max(cov, hh * smoothstep(0.1, 0.26, tone));
    cov = max(cov, smoothstep(0.86, 0.96, tone));
  }
  pc_fragColor = vec4(clamp(cov, 0.0, 1.0), 0.0, 0.0, uREdge);
  gInkOut1 = vec4(normal * 0.5 + 0.5, uRObjectId);
}
`;

export function createRiver(options: RiverOptions): RiverModule {
  const W = options.width ?? 16;
  const B = options.bank ?? 5;
  const step = options.step ?? 2.5;
  if (options.points.length < 2) throw new Error("createRiver needs at least two points");
  const origin = options.points[0]!;
  const curve = new THREE.CatmullRomCurve3(
    options.points.map(([x, z]) => new THREE.Vector3(x - origin[0], 0, z - origin[1])),
    false,
    "centripetal",
  );
  const length = curve.getLength();
  const n = Math.max(2, Math.ceil(length / step) + 1);
  const prof = profile(W, B);
  const cols = prof.length;
  const pos = new Float32Array(n * cols * 3);
  const riv = new Float32Array(n * cols * 2);
  const lat = new Float32Array(n * cols * 2);
  const centres: THREE.Vector3[] = [];
  const lats: THREE.Vector2[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    const lx = -t.z;
    const lz = t.x;
    const ll = Math.hypot(lx, lz) || 1;
    const nx = lx / ll;
    const nz = lz / ll;
    centres.push(p.clone());
    lats.push(new THREE.Vector2(nx, nz));
    for (let j = 0; j < cols; j++) {
      const [v, y] = prof[j]!;
      const x = p.x + nx * v;
      const z = p.z + nz * v;
      const k = i * cols + j;
      pos[k * 3] = x;
      pos[k * 3 + 1] = heightAt(x + origin[0], z + origin[1]) + y;
      pos[k * 3 + 2] = z;
      riv[k * 2] = u * length;
      riv[k * 2 + 1] = v;
      lat[k * 2] = nx;
      lat[k * 2 + 1] = nz;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aRiver", new THREE.BufferAttribute(riv, 2));
  geometry.setAttribute("aLat", new THREE.BufferAttribute(lat, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Winding check: normals should point up.
  const nrm = geometry.getAttribute("normal") as THREE.BufferAttribute;
  if (nrm.getY(Math.floor(cols / 2)) < 0) {
    const idx = geometry.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();

  const uniforms = {
    uREnv: { value: new THREE.Vector4(W / 2, 0, 0, 0) },
    uRGeo: { value: new THREE.Vector4(W / 2, B, 0, 0) },
    uROff: { value: new THREE.Vector2() },
    uRCam: { value: new THREE.Vector3() },
    uREdge: { value: 0.6 },
    uRObjectId: { value: options.objectId ?? 0.05 },
    uPxScale: { value: new THREE.Vector3(700, 1, 720) },
  };
  const material = createInkLambert({
    key: "ink-river-v3",
    uniforms,
    vertexHead: VERTEX_HEAD,
    vertexTail: VERTEX_TAIL,
    fragmentHead: FRAGMENT_HEAD.replace(/INK_T/g, "uInkTime"),
    fragmentOut: FRAGMENT_OUT.replace(/INK_T/g, "uInkTime"),
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -2;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "river";
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.castShadow = false;
  mesh.frustumCulled = false;
  trackPixelScale(mesh, uniforms.uPxScale);

  const cam = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const nearest = (x: number, z: number) => {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < centres.length; i++) {
      const c = centres[i]!;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return bi;
  };
  return {
    object: mesh,
    length,
    triangles: index.length / 3,
    update(_dt, env, _rig, camera) {
      const off = INK_GLOBALS.uInkWorldOffset.value;
      // Place the mesh (built relative to its first point) in the parent's frame.
      tmp.set(origin[0] - off.x, 0, origin[1] - off.z);
      if (mesh.parent) {
        mesh.parent.updateWorldMatrix(true, false);
        mesh.parent.worldToLocal(tmp);
      }
      mesh.position.copy(tmp);
      camera.updateMatrixWorld();
      cam.setFromMatrixPosition(camera.matrixWorld);
      uniforms.uRCam.value.copy(cam);
      const M = GROUND_LATTICE;
      uniforms.uROff.value.set(off.x - Math.floor(off.x / M) * M, off.z - Math.floor(off.z / M) * M);
      const water = THREE.MathUtils.clamp(env.water, 0, 1);
      const dry = THREE.MathUtils.smoothstep(env.drought, 0.15, 0.95);
      const half = (W / 2) * (0.3 + 0.7 * water) * (1 - dry * 0.93);
      uniforms.uREnv.value.set(half, env.drought, env.storm, THREE.MathUtils.smoothstep(env.timeOfDay, 0.8, 0.94));
      uniforms.uRGeo.value.z = env.gloom;
      uniforms.uRGeo.value.w = env.perfection;
    },
    heightAt(x, z) {
      const lx = x - origin[0];
      const lz = z - origin[1];
      const i = nearest(lx, lz);
      const c = centres[i]!;
      const l = lats[i]!;
      const v = (lx - c.x) * l.x + (lz - c.z) * l.y;
      const av = Math.abs(v);
      const g = heightAt(x, z);
      if (av > W / 2 + B) return g;
      // Linear through the profile.
      for (let j = 0; j < prof.length - 1; j++) {
        const [v0, y0] = prof[j]!;
        const [v1, y1] = prof[j + 1]!;
        if (v >= v0 && v <= v1) return g + y0 + ((v - v0) / (v1 - v0)) * (y1 - y0);
      }
      return g;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
