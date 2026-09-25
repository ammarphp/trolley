/**
 * The sky dome: an engraver's sky.
 *
 * Paper white by day, with machine-ruled horizontal lines (constant pixel
 * spacing, anchored to elevation so they stay parallel to the horizon) whose
 * weight carries the tone. Gloom thickens the ruling into bands; storms cross
 * it with a second family; night closes it to solid ink, leaving the stars
 * and the moon as paper. The sun is an outlined disc; at dawn and dusk it
 * throws a crown of radiating strokes and horizontal haze lines cross it.
 *
 * Drawn at the far plane (z = w), only where nothing else was drawn, with
 * its coverage pre-divided by the composite's distance fade.
 */
import * as THREE from "three";
import { INK2D_GLSL, SKY_LOOK_UNIFORMS, SKY_OUT_GLSL } from "../terrain/glsl.ts";

export interface SkyDomeState {
  sunDir: THREE.Vector3;
  night: number;
  gloom: number;
  storm: number;
  cloud: number;
  fire: number;
  uniformity: number;
  time: number;
}

const VERT = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}
`;

const FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 outInk;
layout(location = 1) out highp vec4 outInfo;
in vec3 vDir;
uniform vec3 uSunDir;
uniform vec4 uSkyA; // night, gloom, storm, cloud
uniform vec4 uSkyB; // fire, uniformity, time, sunVisible
uniform vec3 uPx;   // radians per device px, device px per css px, seed
${INK2D_GLSL}
${SKY_OUT_GLSL}

#define PI 3.14159265

void main() {
  vec3 d = normalize(vDir);
  float night = uSkyA.x;
  float gloom = uSkyA.y;
  float storm = uSkyA.z;
  float cloud = uSkyA.w;
  float fire = uSkyB.x;
  float uniformity = uSkyB.y;
  float time = uSkyB.z;
  float radPx = max(uPx.x, 1e-5);
  float pr = uPx.y;
  float elev = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  float deg = elev * 57.29578;

  // Sun geometry.
  vec3 sun = normalize(uSunDir);
  float sunEl = asin(clamp(sun.y, -1.0, 1.0)) * 57.29578;
  float ca = clamp(dot(d, sun), -1.0, 1.0);
  float ang = acos(ca);               // radians from the sun centre
  float angPx = ang / radPx;
  float low = (1.0 - smoothstep(6.0, 24.0, sunEl)) * smoothstep(-12.0, -2.0, sunEl);
  float dayVis = uSkyB.w * (1.0 - night);

  // ------------------------------------------------------------ tone
  // Bands: long horizontal belts of heavier ruling, drifting slowly.
  float bandsN = tgNoise(vec2(az * 1.9 + 3.0 + time * 0.004, deg * 0.42));
  float belt = smoothstep(0.3, 0.7, tgNoise(vec2(az * 0.9 - time * 0.003, deg * 0.22 + 7.0)) * 0.75 + tgNoise(vec2(az * 3.1, deg * 0.6)) * 0.25);
  float bands = 0.35 + 0.9 * bandsN * (0.5 + 0.8 * belt);
  float t = 0.1 * smoothstep(12.0, 42.0, deg) * (1.0 - uniformity * 0.7);
  t += cloud * 0.05 * smoothstep(8.0, 34.0, deg);
  t += gloom * (0.05 + 0.46 * smoothstep(1.0, 34.0, deg)) * mix(0.18, 1.45, belt) * (0.75 + 0.5 * bandsN);
  t += storm * (0.16 + 0.34 * smoothstep(0.0, 28.0, deg)) * (0.45 + 0.9 * bandsN * (0.4 + 0.9 * belt));
  // Storms leave a pale gap low over the horizon, the light under the cloud.
  t *= 1.0 - storm * 0.55 * (1.0 - smoothstep(0.5, 6.0, deg));
  t = min(t, mix(1.0, 0.82, (1.0 - night) * max(gloom, storm)));
  // Glow: the ruling thins out around a low sun and above the horizon.
  float glow = exp(-pow(ang / 0.55, 2.0)) * low * dayVis;
  t *= 1.0 - glow * 0.85;
  t *= smoothstep(-0.5, 2.5, deg);
  float nightT = 0.58 + 0.42 * smoothstep(3.0, 16.0, deg);
  t = mix(t, max(t, nightT), night);
  t = clamp(t, 0.0, 1.0);

  // Machine-ruled lines, straight and parallel to the true horizon (so they
  // tilt and slide with the cab, never curve). Light tones space the lines
  // out rather than thinning them below a pen's width.
  vec3 v = mat3(viewMatrix) * d;
  vec3 U = mat3(viewMatrix) * vec3(0.0, 1.0, 0.0);
  float focal = 1.0 / radPx;
  vec2 sp = focal * v.xy / max(-v.z, 1e-4);
  float hPx = (dot(sp, U.xy) - focal * U.z) / max(length(U.xy), 1e-4); // px above the horizon
  float spacing = 3.4 * pr;
  float minW = 0.75 * pr;
  float lvl = clamp(log2(minW / max(t * spacing, 1e-4)), 0.0, 4.0);
  float l0 = floor(lvl);
  float per = spacing * exp2(l0);
  float u = hPx / per;
  float idx = floor(u + 0.5);
  float wob = mix(tgNoise(vec2(sp.x / (60.0 * pr), idx * 1.7)) - 0.5, 0.0, uniformity);
  float w = max(t * per, minW) * (1.0 + wob * 0.5 * (gloom + storm));
  float dpx = abs(u - idx) * per;
  float cov = 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, dpx);
  cov *= 1.0 - mod(idx, 2.0) * fract(lvl) * step(lvl, 3.999);
  cov *= smoothstep(0.004, 0.02, t);
  cov = max(cov, smoothstep(0.86, 0.95, t));
  // Storm: a crossing diagonal family where the ruling is heavy.
  float crossA = smoothstep(0.42, 0.62, t) * (1.0 - night);
  if (crossA > 0.0) {
    float cv = dot(sp, vec2(0.8, 0.6)) / (4.2 * pr);
    float vi = floor(cv + 0.5);
    float n2 = tgNoise(vec2(dot(sp, vec2(-0.6, 0.8)) / (60.0 * pr), vi * 1.3));
    float cw = (0.25 + 0.5 * t) * 4.2 * pr * (0.6 + 0.8 * n2);
    cov = max(cov, (1.0 - smoothstep(cw * 0.5 - 0.5, cw * 0.5 + 0.5, abs(cv - vi) * 4.2 * pr)) * crossA);
  }

  vec2 accent = vec2(0.0);

  // ------------------------------------------------------------ sun
  float rs = 0.0236; // disc radius (rad), exaggerated as illustrators do
  float rsPx = rs / radPx;
  float sunA = dayVis * smoothstep(-1.2, 0.6, deg);
  if (sunA > 0.0 && ang < rs * 7.0) {
    float inside = 1.0 - smoothstep(rsPx - 0.8, rsPx + 0.2, angPx);
    cov *= 1.0 - inside * sunA;
    float ring = 1.0 - smoothstep(0.55 * pr, 1.3 * pr, abs(angPx - rsPx));
    cov = max(cov, ring * sunA);
    // Haze lines across a low sun's lower half.
    vec3 e1 = normalize(cross(sun, vec3(0.0, 1.0, 0.0)));
    vec3 e2 = cross(e1, sun);
    vec2 lp = vec2(dot(d, e1), dot(d, e2)) / radPx;
    float hz = step(lp.y, -rsPx * 0.05) * inside * low;
    float hl = abs(fract(lp.y / (4.0 * pr)) - 0.5) * 4.0 * pr;
    cov = max(cov, (1.0 - smoothstep(0.4 * pr, 0.95 * pr, hl)) * hz * sunA * step(abs(lp.x), sqrt(max(rsPx * rsPx - lp.y * lp.y, 0.0)) - 1.5 * pr));
    // A crown of fine radiating strokes at dawn and dusk: many, uneven,
    // tapering, standing off the disc.
    if (low > 0.0 && angPx > rsPx * 1.4) {
      float phi = atan(lp.y, lp.x);
      float N = 44.0;
      float k = floor(phi / (2.0 * PI / N) + 0.5);
      float hk = tgHash(vec2(k, 3.0));
      float phiK = k * 2.0 * PI / N + (hk - 0.5) * 0.05;
      float start = rsPx * (1.45 + 0.25 * tgHash(vec2(k, 5.0)));
      float reach = rsPx * mix(1.9, 4.6, pow(tgHash(vec2(k, 7.0)), 1.6));
      float tt = clamp((angPx - start) / max(reach - start, 1.0), 0.0, 1.0);
      float wpx = mix(1.15, 0.3, tt) * pr;
      float off = angPx * abs(phi - phiK);
      float ray = (1.0 - smoothstep(wpx * 0.5 - 0.35, wpx * 0.5 + 0.45, off)) * step(start, angPx) * step(angPx, reach);
      ray *= step(0.18, hk) * (1.0 - 0.5 * tt);
      cov = max(cov, ray * low * sunA * (1.0 - storm) * smoothstep(0.3, 1.2, deg));
    }
    // A faint amber wash in a low sun: the day's one warm note.
    accent = vec2(inside * low * sunA * 0.32 * (1.0 - storm), 3.0);
  }

  // ------------------------------------------------------------ night
  if (night > 0.01) {
    // Stars on an elevation-corrected lattice, left as paper.
    float cellA = 0.024;
    vec2 sq = vec2(az * cos(elev), elev) / cellA;
    vec2 sc = floor(sq);
    vec2 sh = tgHash2(sc + 17.0);
    float starA = night * smoothstep(4.0, 12.0, deg) * step(sh.x, 0.3) * (1.0 - gloom * 0.8) * (1.0 - storm);
    if (starA > 0.0) {
      vec2 sp = (sq - sc - (0.2 + 0.6 * tgHash2(sc + 5.0))) * cellA / radPx;
      float bright = tgHash(sc + 11.0);
      float r = mix(0.5, 1.35, bright * bright) * pr * (0.9 + 0.1 * sin(time * (1.0 + bright * 3.0) + sh.y * 30.0));
      float star = 1.0 - smoothstep(r - 0.4, r + 0.5, length(sp));
      if (bright > 0.93) {
        float spike = min(abs(sp.x), abs(sp.y));
        float len = max(abs(sp.x), abs(sp.y));
        star = max(star, (1.0 - smoothstep(0.2 * pr, 0.7 * pr, spike)) * (1.0 - smoothstep(2.0 * pr, 4.2 * pr, len)));
      }
      cov *= 1.0 - star * starA;
    }
    // The moon: a crescent where the key light is at night.
    float mA = night * uSkyB.w * smoothstep(-0.5, 2.0, deg);
    float rm = 0.026 / radPx;
    if (mA > 0.0 && angPx < rm * 2.0) {
      vec3 e1 = normalize(cross(sun, vec3(0.0, 1.0, 0.0)));
      vec3 e2 = cross(e1, sun);
      vec2 lp = vec2(dot(d, e1), dot(d, e2)) / radPx;
      float disc = 1.0 - smoothstep(rm - 0.6, rm + 0.4, length(lp));
      float bite = 1.0 - smoothstep(rm * 0.92 - 0.6, rm * 0.92 + 0.4, length(lp - vec2(rm * 0.42, rm * 0.28)));
      float lit = disc * (1.0 - bite);
      cov = mix(cov, 0.0, lit * mA);
    }
  }

  // ------------------------------------------------------------ fire glow
  if (fire > 0.01) {
    // Glow over fires beyond the horizon: patches, not a band.
    float where = smoothstep(0.55, 0.8, tgNoise(vec2(az * 3.1 + 17.0, 2.0)));
    float band = (1.0 - smoothstep(0.0, 3.5 + 3.0 * where, deg)) * smoothstep(-0.5, 0.4, deg);
    float flick = 0.7 + 0.3 * tgNoise(vec2(az * 9.0, time * 0.5));
    accent = max(accent, vec2(band * where * fire * 0.55 * flick, 6.0));
  }

  outInk = skyInk(clamp(cov, 0.0, 1.0), accent, 0.0, 1.0);
  outInfo = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

export interface SkyDome {
  object: THREE.Mesh;
  uniforms: {
    uSunDir: THREE.IUniform<THREE.Vector3>;
    uSkyA: THREE.IUniform<THREE.Vector4>;
    uSkyB: THREE.IUniform<THREE.Vector4>;
    uPx: THREE.IUniform<THREE.Vector3>;
  };
  set(state: SkyDomeState): void;
  dispose(): void;
}

export function createSkyDome(): SkyDome {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0.3, 0.5, -0.8).normalize() },
    uSkyA: { value: new THREE.Vector4() },
    uSkyB: { value: new THREE.Vector4(0, 0, 0, 1) },
    uPx: { value: new THREE.Vector3(0.001, 1, 0) },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...uniforms, ...SKY_LOOK_UNIFORMS },
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
  });
  const geometry = new THREE.SphereGeometry(1, 48, 24);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "sky-dome";
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.userData.noShadow = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const size = new THREE.Vector2();
  mesh.onBeforeRender = (renderer, _scene, camera) => {
    const target = renderer.getRenderTarget();
    const h = target ? target.height : renderer.getDrawingBufferSize(size).y;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = cam.isPerspectiveCamera ? THREE.MathUtils.degToRad(cam.fov) / (cam.zoom || 1) : 1;
    // Radians per pixel at the centre of the view.
    uniforms.uPx.value.set((2 * Math.tan(fov / 2)) / h, renderer.getPixelRatio(), 0);
  };
  return {
    object: mesh,
    uniforms,
    set(s) {
      uniforms.uSunDir.value.copy(s.sunDir);
      uniforms.uSkyA.value.set(s.night, s.gloom, s.storm, s.cloud);
      uniforms.uSkyB.value.set(s.fire, s.uniformity, s.time, 1);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
