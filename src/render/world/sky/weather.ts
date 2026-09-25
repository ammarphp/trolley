/**
 * Weather: rain, lightning and fog banks.
 *
 * Rain: fine pen streaks (GL line segments) in a box that wraps around the
 * camera but is anchored to the world, slanted by wind and by the trolley's
 * own motion. Streaks are max-blended into the ink attachment only, so they
 * never disturb the contour pass.
 *
 * Lightning: a branching bolt (midpoint-displaced main channel plus forks)
 * built fresh for every strike, shown for 150 ms as a paper-white ribbon
 * that the contour pass outlines in ink. Each strike calls the registered
 * callbacks with a strength so the integrator can flash the pipeline; with
 * noFlashing set the bolt is still drawn but no callback fires.
 *
 * Fog banks: low bands of mist at 350-800 m that erase what lies behind them
 * into broken horizontal paper strokes, the way an engraver leaves mist as
 * untouched paper.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import { COMPOSITE_FADE, INK2D_GLSL, SKY_LOOK_UNIFORMS, SKY_OUT_GLSL, syncSkyLook } from "../terrain/glsl.ts";
import { heightAt } from "../terrain/height.ts";

// ------------------------------------------------------------------- rain

const RAIN_BOX = new THREE.Vector3(46, 28, 46);

const RAIN_VERT = /* glsl */ `
in vec4 aSeed;
in float aEnd;
uniform vec3 uCam;        // camera, scene space
uniform vec3 uCamMod;     // camera world position modulo the box
uniform vec3 uFallMod;    // accumulated fall offset modulo the box
uniform vec3 uStreak;     // streak vector (m), relative motion * exposure
uniform float uAmount;
uniform float uCamH;      // camera height above the ground
uniform float uSkyFogNear;
uniform float uSkyFogFar;
uniform vec3 uBox;
out float vCov;
void main() {
  vec3 p = aSeed.xyz * uBox + uFallMod;
  vec3 rel = mod(p - uCamMod + uBox * 0.5, uBox) - uBox * 0.5;
  rel.y += uBox.y * 0.15;
  vec3 wp = uCam + rel;
  float len = 0.6 + 0.8 * fract(aSeed.w * 7.1);
  if (aEnd > 0.5) wp -= uStreak * len;
  float d = length(rel);
  float on = step(aSeed.w, uAmount);
  // Near streaks strong, far ones faint; none inside the cab.
  float fade = smoothstep(2.5, 4.5, d) * (1.0 - smoothstep(14.0, 23.0, d));
  // What lies behind: sky above the horizon, ground below. Pre-divide by the
  // composite's fade for that depth so the stroke lands as drawn.
  float dirY = rel.y / max(d, 1e-3);
  float behind = dirY > -0.002 ? 1e5 : uCamH / max(-dirY, 1e-3);
  float fog = smoothstep(uSkyFogNear, uSkyFogFar, behind);
  float comp = 1.0 / max(1.0 - ${COMPOSITE_FADE.coverage} * fog, 0.08);
  vCov = on * fade * (0.7 + 0.3 * fract(aSeed.w * 3.3)) * comp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  if (on < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const RAIN_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outInk;
layout(location = 1) out highp vec4 outInfo;
in float vCov;
void main() {
  // Max-blended: only coverage rises; accent, contour weight and the
  // geometry buffer keep what is already there.
  outInk = vec4(vCov, 0.0, 0.0, 0.0);
  outInfo = vec4(0.0);
}
`;

function createRain(count: number, rng: Rng) {
  const seeds = new Float32Array(count * 2 * 4);
  const ends = new Float32Array(count * 2);
  const pos = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const s = [rng.next(), rng.next(), rng.next(), rng.next()];
    for (let e = 0; e < 2; e++) {
      seeds.set(s, (i * 2 + e) * 4);
      ends[i * 2 + e] = e;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  g.setAttribute("aEnd", new THREE.BufferAttribute(ends, 1));
  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uCamMod: { value: new THREE.Vector3() },
    uFallMod: { value: new THREE.Vector3() },
    uStreak: { value: new THREE.Vector3(0, -0.5, 0) },
    uAmount: { value: 0 },
    uCamH: { value: 2.5 },
    uBox: { value: RAIN_BOX.clone() },
    ...SKY_LOOK_UNIFORMS,
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const lines = new THREE.LineSegments(g, material);
  lines.name = "rain";
  lines.frustumCulled = false;
  lines.renderOrder = 900;
  lines.userData.noShadow = true;
  return { lines, uniforms, material, geometry: g };
}

// -------------------------------------------------------------- lightning

const BOLT_VERT = /* glsl */ `
out float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const BOLT_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outInk;
layout(location = 1) out highp vec4 outInfo;
in float vDepth;
uniform float uObjectId;
${SKY_OUT_GLSL}
void main() {
  float fog = skyFogAt(vDepth);
  // Paper-white channel; the contour pass inks its outline.
  outInk = skyInk(0.0, vec2(0.0), 1.6, fog);
  outInfo = vec4(0.5, 0.5, 1.0, uObjectId);
}
`;

interface BoltSegment {
  a: THREE.Vector3;
  b: THREE.Vector3;
  w: number;
}

/** A branching bolt in sky space (metres), from the cloud base (y = top) down to y = 0. */
export function boltPath(rng: Rng, top: number, spread: number): BoltSegment[] {
  const segs: BoltSegment[] = [];
  const walk = (start: THREE.Vector3, dir: THREE.Vector3, length: number, width: number, depth: number) => {
    const steps = Math.max(6, Math.round(length / 70));
    let p = start.clone();
    const d = dir.clone().normalize();
    for (let i = 0; i < steps; i++) {
      const step = (length / steps) * rng.range(0.7, 1.3);
      const jag = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.3, 0.3), rng.range(-1, 1)).multiplyScalar(step * 0.55);
      const q = p.clone().addScaledVector(d, step).add(jag);
      if (q.y < 0) q.y = 0;
      const w = width * (1 - (i / steps) * 0.5);
      segs.push({ a: p, b: q, w });
      if (depth < 2 && rng.chance(depth === 0 ? 0.22 : 0.12) && q.y > top * 0.15) {
        const fork = new THREE.Vector3(rng.range(-1, 1) * spread, -rng.range(0.6, 1.2), rng.range(-0.5, 0.5));
        walk(q.clone(), fork, length * rng.range(0.18, 0.4), w * 0.55, depth + 1);
      }
      p = q;
      if (p.y <= 0) break;
    }
  };
  walk(new THREE.Vector3(0, top, 0), new THREE.Vector3(rng.range(-0.25, 0.25), -1, 0), top * 1.08, 1, 0);
  return segs;
}

function boltGeometry(segs: BoltSegment[], width: number, toEye: THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const side = new THREE.Vector3();
  const along = new THREE.Vector3();
  for (const s of segs) {
    along.subVectors(s.b, s.a).normalize();
    side.crossVectors(along, toEye).normalize().multiplyScalar(s.w * width * 0.5);
    const a0 = s.a.clone().sub(side);
    const a1 = s.a.clone().add(side);
    const b0 = s.b.clone().sub(side);
    const b1 = s.b.clone().add(side);
    pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z);
    pos.push(a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
    // A small joint so the ribbon has no notches at the bends.
    const j = side.clone().multiplyScalar(0.9);
    pos.push(s.b.x - j.x, s.b.y - j.y, s.b.z - j.z, s.b.x, s.b.y + s.w * width * 0.45, s.b.z, s.b.x + j.x, s.b.y + j.y, s.b.z + j.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// -------------------------------------------------------------- fog banks

const FOG_VERT = /* glsl */ `
in vec3 aFog; // bank rank, bank seed, position along the bank 0..1
out vec3 vLocal;
out float vRank;
out float vSeed;
out float vAlong;
void main() {
  vLocal = position;
  vRank = aFog.x;
  vSeed = aFog.y;
  vAlong = aFog.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FOG_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outInk;
layout(location = 1) out highp vec4 outInfo;
in vec3 vLocal;
in float vRank;
in float vSeed;
in float vAlong;
uniform float uFog;
uniform float uTime;
uniform float uPr;
${INK2D_GLSL}
void main() {
  float on = smoothstep(vRank, vRank + 0.15, uFog);
  float arc = atan(vLocal.x, -vLocal.z) * length(vLocal.xz);
  float h = vLocal.y;
  // A billowing crest, drifting slowly.
  float crest = 18.0 + 26.0 * tgNoise(vec2(arc / 90.0 + vSeed * 17.0 + uTime * 0.01, vSeed)) + 10.0 * tgNoise(vec2(arc / 25.0, vSeed * 3.0));
  // Feathered ends: the bank thins out along its length.
  float ends = smoothstep(0.0, 0.3, vAlong) * smoothstep(1.0, 0.7, vAlong);
  crest *= 0.35 + 0.65 * ends;
  float body = 1.0 - smoothstep(crest * 0.5, crest, h);
  float density = body * on * (0.4 + 0.6 * ends);
  // Erase in broken horizontal paper strokes (screen space), thicker low down.
  float row = gl_FragCoord.y / (2.6 * uPr);
  float ri = floor(row);
  float breakN = tgNoise(vec2(gl_FragCoord.x / (38.0 * uPr) + ri * 3.7, ri * 1.3));
  float erase = step(abs(fract(row) - 0.5) * 2.0, density * 1.25) * step(0.28 - density * 0.3, breakN);
  erase = max(erase, step(0.82, density));
  if (erase < 0.5) discard;
  // Min-blended: coverage and contour weight fall to paper; the rest is kept.
  outInk = vec4(0.0, 0.0, 1e4, 0.0);
  outInfo = vec4(1e4);
}
`;

function fogBankGeometry(rng: Rng, banks: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const attr: number[] = [];
  for (let b = 0; b < banks; b++) {
    const center = rng.range(0, Math.PI * 2);
    const span = rng.range(0.35, 0.9);
    const r = rng.range(360, 780);
    const top = rng.range(55, 80);
    const segs = 24;
    const rank = (b + 0.5) / banks;
    const seed = rng.next();
    for (let i = 0; i < segs; i++) {
      const t0 = center - span / 2 + (span * i) / segs;
      const t1 = center - span / 2 + (span * (i + 1)) / segs;
      const x0 = Math.sin(t0) * r;
      const z0 = -Math.cos(t0) * r;
      const x1 = Math.sin(t1) * r;
      const z1 = -Math.cos(t1) * r;
      pos.push(x0, -6, z0, x1, -6, z1, x0, top, z0, x0, top, z0, x1, -6, z1, x1, top, z1);
      const a0 = i / segs;
      const a1 = (i + 1) / segs;
      for (const a of [a0, a1, a0, a0, a1, a1]) attr.push(rank, seed, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aFog", new THREE.Float32BufferAttribute(attr, 3));
  return g;
}

// ---------------------------------------------------------------- module

export interface WeatherOptions {
  seed?: number | string;
  quality?: "low" | "medium" | "high";
  /** Suppress lightning callbacks (the bolt is still drawn). */
  noFlashing?: boolean;
}

export interface LightningEvent {
  /** 0..1 */
  strength: number;
  /** World direction from the eye toward the bolt (horizontal, unit). */
  direction: THREE.Vector3;
  /** True sky-space distance, metres (for thunder delay: distance / 343). */
  distance: number;
  /** False when noFlashing is set: do not flash the screen. */
  flash: boolean;
}

export interface WeatherModule {
  readonly object: THREE.Group;
  update(dt: number, env: EnvironmentTarget, rigWorld: THREE.Vector3, camera: THREE.Camera): void;
  /** Screen-flash hook, as the renderer expects: called only when flashing is allowed. */
  onLightning(cb: (strength: number) => void): void;
  /** Every strike, flashing or not (for thunder, lab captions). */
  onStrike(cb: (event: LightningEvent) => void): void;
  setNoFlashing(on: boolean): void;
  /** Force a strike now (cues). `yaw` is relative to the view direction, radians. */
  strike(options?: { strength?: number; yaw?: number; distance?: number }): void;
  readonly triangles: number;
  dispose(): void;
}

const BOLT_MS = 150;

/**
 * Shared no-flashing flag. The renderer may call setNoFlashing on the sky
 * module rather than on weather; either path lands here.
 */
const FLAGS = { noFlashing: false };
export function setGlobalNoFlashing(on: boolean): void {
  FLAGS.noFlashing = on;
}

export function createWeather(options: WeatherOptions = {}): WeatherModule {
  const seed = String(options.seed ?? "weather");
  const q = options.quality ?? "high";
  const rng = createRng(`weather:${seed}`);
  const boltRng = createRng(`bolts:${seed}`);
  const group = new THREE.Group();
  group.name = "weather";
  let noFlashing = options.noFlashing ?? false;

  const rain = createRain(q === "low" ? 3500 : q === "medium" ? 6000 : 9000, rng.fork("rain"));
  group.add(rain.lines);

  const boltMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: BOLT_VERT,
    fragmentShader: BOLT_FRAG,
    uniforms: { uObjectId: { value: 0.37 }, ...SKY_LOOK_UNIFORMS },
    side: THREE.DoubleSide,
  });
  const bolt = new THREE.Mesh(new THREE.BufferGeometry(), boltMaterial);
  bolt.name = "lightning";
  bolt.frustumCulled = false;
  bolt.visible = false;
  bolt.userData.noShadow = true;
  group.add(bolt);

  const fogGeometry = fogBankGeometry(rng.fork("fog"), 14);
  const fogUniforms = { uFog: { value: 0 }, uTime: { value: 0 }, uPr: { value: 1 } };
  const fogMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    uniforms: fogUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MinEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const fog = new THREE.Mesh(fogGeometry, fogMaterial);
  fog.name = "fog-banks";
  fog.frustumCulled = false;
  fog.renderOrder = 950;
  fog.userData.noShadow = true;
  fog.onBeforeRender = (renderer) => {
    fogUniforms.uPr.value = renderer.getPixelRatio();
  };
  group.add(fog);

  const flashCbs: Array<(s: number) => void> = [];
  const strikeCbs: Array<(e: LightningEvent) => void> = [];
  let boltAge = Infinity;
  let nextStrike = 3;
  let pendingStrike: { strength: number; yaw: number; distance: number } | null = null;
  let time = 0;
  const fall = new THREE.Vector3();
  const vFall = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const lastCam = new THREE.Vector3();
  let hasLast = false;
  const camVel = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const buildBolt = (camera: THREE.Camera, strength: number, yaw: number, distance: number) => {
    camera.getWorldDirection(camDir);
    const heading = Math.atan2(camDir.x, -camDir.z) + yaw;
    const dir = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
    const top = boltRng.range(1300, 1900);
    const segs = boltPath(boltRng, top, 0.9);
    // Homothety about the eye: true distance -> render shell (like the clouds).
    const far = (camera as THREE.PerspectiveCamera).far ?? 1600;
    const R = Math.min(1380, far * 0.86);
    const k = R / distance;
    const toEye = dir.clone().negate();
    // Keep the channel ~7-10 px wide on screen whatever its distance.
    const g = boltGeometry(segs, (13 / k) * (0.8 + 0.35 * strength), toEye);
    bolt.geometry.dispose();
    bolt.geometry = g;
    camera.updateMatrixWorld();
    camPos.setFromMatrixPosition(camera.matrixWorld);
    const ground = heightAt(camPos.x + INK_GLOBALS.uInkWorldOffset.value.x, camPos.z + INK_GLOBALS.uInkWorldOffset.value.z);
    tmp.set(camPos.x + dir.x * distance * k, camPos.y + (ground - camPos.y) * k, camPos.z + dir.z * distance * k);
    if (group.parent) {
      group.parent.updateWorldMatrix(true, false);
      group.parent.worldToLocal(tmp);
    }
    bolt.position.copy(tmp);
    bolt.scale.setScalar(k);
    bolt.visible = true;
    boltAge = 0;
    const quiet = noFlashing || FLAGS.noFlashing;
    const event: LightningEvent = { strength, direction: dir, distance, flash: !quiet };
    for (const cb of strikeCbs) cb(event);
    if (!quiet) for (const cb of flashCbs) cb(strength);
  };

  return {
    object: group,
    triangles: 0,
    update(dt, env, rigWorld, camera) {
      time += dt;
      syncSkyLook(env, camera as THREE.PerspectiveCamera);
      camera.updateMatrixWorld();
      camPos.setFromMatrixPosition(camera.matrixWorld);
      if (hasLast && dt > 0) camVel.subVectors(camPos, lastCam).divideScalar(dt);
      lastCam.copy(camPos);
      hasLast = true;
      if (camVel.length() > 80) camVel.set(0, 0, 0); // origin rebase or teleport

      // ---- rain
      const amount = THREE.MathUtils.clamp((env.storm - 0.18) * 1.5, 0, 1);
      const wind = INK_GLOBALS.uInkWind.value;
      const windSpeed = 1 + env.wind * 7;
      const wx = wind.x / Math.max(wind.length(), 1e-3);
      const wz = wind.y / Math.max(wind.length(), 1e-3);
      vFall.set(wx * windSpeed, -9, wz * windSpeed);
      fall.addScaledVector(vFall, dt);
      const bx = RAIN_BOX.x;
      const by = RAIN_BOX.y;
      const bz = RAIN_BOX.z;
      fall.set(((fall.x % bx) + bx) % bx, ((fall.y % by) + by) % by, ((fall.z % bz) + bz) % bz);
      const off = INK_GLOBALS.uInkWorldOffset.value;
      const cwx = camPos.x + off.x;
      const cwy = camPos.y + off.y;
      const cwz = camPos.z + off.z;
      rain.uniforms.uCam.value.copy(camPos);
      rain.uniforms.uCamMod.value.set(((cwx % bx) + bx) % bx, ((cwy % by) + by) % by, ((cwz % bz) + bz) % bz);
      rain.uniforms.uFallMod.value.copy(fall);
      rain.uniforms.uStreak.value.copy(vFall).sub(camVel).multiplyScalar(0.075);
      rain.uniforms.uAmount.value = amount;
      rain.uniforms.uCamH.value = Math.max(1, cwy - heightAt(rigWorld.x, rigWorld.z));
      rain.lines.visible = amount > 0.001;

      // ---- fog banks follow the eye (rotation-only parallax)
      tmp.set(camPos.x, heightAt(rigWorld.x, rigWorld.z) - off.y, camPos.z);
      if (group.parent) {
        group.parent.updateWorldMatrix(true, false);
        group.parent.worldToLocal(tmp);
      }
      fog.position.copy(tmp);
      fogUniforms.uFog.value = THREE.MathUtils.clamp(env.fog * 1.2 + env.storm * 0.25 - 0.05, 0, 1);
      fogUniforms.uTime.value = time;
      fog.visible = fogUniforms.uFog.value > 0.01;

      // ---- lightning
      if (pendingStrike) {
        buildBolt(camera, pendingStrike.strength, pendingStrike.yaw, pendingStrike.distance);
        pendingStrike = null;
      } else if (env.lightning > 0.03 && env.storm > 0.15) {
        nextStrike -= dt;
        if (nextStrike <= 0) {
          buildBolt(camera, boltRng.range(0.55, 1) * Math.min(1, env.lightning * 1.3), boltRng.range(-0.55, 0.55), boltRng.range(3500, 9000));
          nextStrike = boltRng.range(2.5, 9) / Math.max(0.15, env.lightning);
        }
      }
      if (bolt.visible) {
        boltAge += dt * 1000;
        // Two pulses inside the 150 ms: on, a brief gap, on again.
        const on = boltAge < 55 || (boltAge > 80 && boltAge < BOLT_MS);
        bolt.visible = boltAge < BOLT_MS;
        (bolt.material as THREE.ShaderMaterial).visible = on;
      }
    },
    onLightning(cb) {
      flashCbs.push(cb);
    },
    onStrike(cb) {
      strikeCbs.push(cb);
    },
    setNoFlashing(on) {
      noFlashing = on;
    },
    strike(opts = {}) {
      pendingStrike = { strength: opts.strength ?? 1, yaw: opts.yaw ?? boltRng.range(-0.4, 0.4), distance: opts.distance ?? boltRng.range(3500, 7000) };
    },
    dispose() {
      rain.geometry.dispose();
      rain.material.dispose();
      bolt.geometry.dispose();
      boltMaterial.dispose();
      fogGeometry.dispose();
      fogMaterial.dispose();
    },
  };
}
