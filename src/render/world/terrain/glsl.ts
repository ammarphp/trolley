/**
 * GLSL shared by the ground, river, sky and weather shaders.
 *
 * Everything here is written for pen work at grazing angles: stroke widths
 * and spacings are computed in screen pixels from explicit metres-per-pixel
 * values, so a furrow 5 m away and a furrow 300 m away are both drawn with a
 * real pen width instead of dissolving into grey. Derivatives are taken once
 * at the top of a shader (uniform control flow) and passed in, so these
 * helpers are safe inside branches.
 */

export const INK2D_GLSL = /* glsl */ `
float tgHash(vec2 p) {
  p = mod(p, 4096.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 tgHash2(vec2 p) {
  p = mod(p, 4096.0);
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float tgNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  float a = tgHash(i);
  float b = tgHash(i + vec2(1.0, 0.0));
  float c = tgHash(i + vec2(0.0, 1.0));
  float d = tgHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// Value noise whose lattice cells are offset by an integer 'base' (for
// patterns anchored to exact world lattices far from the origin).
float tgNoiseB(vec2 p, vec2 base) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  i += base;
  float a = tgHash(i);
  float b = tgHash(i + vec2(1.0, 0.0));
  float c = tgHash(i + vec2(0.0, 1.0));
  float d = tgHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float tgFbm(vec2 p) {
  float s = tgNoise(p) * 0.5;
  s += tgNoise(p * 2.03 + 17.1) * 0.25;
  s += tgNoise(p * 4.11 + 31.7) * 0.125;
  return s / 0.875;
}
float tgSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
// Metres per pixel along a unit world direction, from the screen derivatives
// of the world position.
float tgMpp(vec2 dpx, vec2 dpy, vec2 n) {
  return max(abs(dot(dpx, n)) + abs(dot(dpy, n)), 1e-6);
}
// Voronoi cell of x (cell units; cell ids offset by the integer 'base').
// Returns the distance to the nearest border (cell units); outputs the cell
// id, the vector to its site, the vector from its site to the neighbour's
// site across that border, and the neighbour's id.
float tgVoronoi(vec2 x, float jit, vec2 base, out vec2 cellId, out vec2 toSite, out vec2 siteDelta, out vec2 otherId) {
  vec2 n = floor(x);
  vec2 f = x - n;
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + (tgHash2(n + g + base) - 0.5) * jit;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  md = 8.0;
  siteDelta = vec2(1.0, 0.0);
  otherId = n + mg + base;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = 0.5 + (tgHash2(n + g + base) - 0.5) * jit;
      vec2 r = g + o - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) {
        float d = dot(0.5 * (mr + r), normalize(dr));
        if (d < md) { md = d; siteDelta = dr; otherId = n + g + base; }
      }
    }
  }
  cellId = n + mg + base;
  toSite = mr;
  return md;
}
// Parallel pen strokes. x: metres across the strokes; y: metres along them;
// mpp: metres per pixel across the strokes. Strokes sit every 'period' metres
// and are thinned out by octaves (every other stroke fades) whenever they
// would be closer than minGapPx, so distance never turns them into grey.
// tonal = 1 scales the width with the octave (hatching keeps its tone),
// tonal = 0 keeps a physical width (furrows get lighter with distance).
float tgPen(float x, float y, float mpp, float period, float worldW, float minPx, float maxPx, float minGapPx, float seed, float breakup, float tonal) {
  float lvl = clamp(log2(minGapPx * mpp / period), 0.0, 7.0);
  float l0 = floor(lvl);
  float t = lvl - l0;
  float p = period * exp2(l0);
  float u = x / p;
  float idx = floor(u + 0.5);
  float n1 = tgNoise(vec2(y / (p * 7.0 + 0.4), idx * 1.37 + seed));
  float w = worldW * mix(1.0, exp2(l0), tonal);
  float wpx = clamp(w / mpp, minPx, maxPx) * mix(1.0, 0.65 + 0.7 * n1, breakup);
  float dpx = abs(u - idx) * p / mpp;
  float line = 1.0 - smoothstep(wpx * 0.5 - 0.55, wpx * 0.5 + 0.55, dpx);
  line *= 1.0 - mod(idx, 2.0) * t;
  float n2 = tgNoise(vec2(y / (p * 3.0 + 0.25) + 11.0, idx * 3.1 + seed));
  line *= mix(1.0, smoothstep(0.1, 0.22, n2), breakup * 0.9);
  return line;
}
// A single pen line at signed distance d (metres) with metres-per-pixel mpp.
float tgLine(float d, float mpp, float worldW, float minPx, float maxPx) {
  float wpx = clamp(worldW / mpp, minPx, maxPx);
  return 1.0 - smoothstep(wpx * 0.5 - 0.55, wpx * 0.5 + 0.55, abs(d) / mpp);
}
`;

/**
 * Sky-layer output. The composite pass fades ink with depth
 * (cov *= 1 - 0.92 fog, lines *= 1 - 0.85 fog, pigment *= 1 - 0.6 fog, with
 * fog = 1 beyond 0.985 * far). Sky-layer elements (dome, clouds, ridgelines,
 * bolts) are designed as finished drawings, so they pre-divide by the same
 * factors. These constants mirror src/render/core/ink-pipeline.ts.
 */
export const COMPOSITE_FADE = { coverage: 0.92, lines: 0.85, accent: 0.6, farMask: 0.985 } as const;

export const SKY_OUT_GLSL = /* glsl */ `
uniform float uSkyFogNear;
uniform float uSkyFogFar;
uniform float uSkyCamFar;
float skyFogAt(float viewDepth) {
  float fog = smoothstep(uSkyFogNear, uSkyFogFar, viewDepth);
  return mix(fog, 1.0, step(uSkyCamFar * ${COMPOSITE_FADE.farMask}, viewDepth));
}
// Pre-compensated attachment 0: coverage, accent amount, accent index / 8, contour weight.
vec4 skyInk(float cov, vec2 accent, float edge, float fog) {
  return vec4(
    cov / max(1.0 - ${COMPOSITE_FADE.coverage} * fog, 0.02),
    accent.x / max(1.0 - ${COMPOSITE_FADE.accent} * fog, 0.05),
    accent.y / 8.0,
    edge / max(1.0 - ${COMPOSITE_FADE.lines} * fog, 0.05));
}
`;

/** Shared uniforms for SKY_OUT_GLSL; kept in step with the pipeline's look. */
export const SKY_LOOK_UNIFORMS = {
  uSkyFogNear: { value: 150 },
  uSkyFogFar: { value: 950 },
  uSkyCamFar: { value: 1600 },
};

let explicitLook: { fogNear: number; fogFar: number } | null = null;

/**
 * Give the sky layer the pipeline's live look (pass `pipeline.look`). Without
 * it, the fog range is estimated from the environment with the renderer's
 * current formula. Sky-layer elements sit beyond 1000 m where the composite
 * fog is 1 in either case; the estimate only matters for rain and near clouds.
 */
export function setSkyLook(look: { fogNear: number; fogFar: number } | null): void {
  explicitLook = look;
}

export function syncSkyLook(env: { fog: number; storm: number }, camera?: { far?: number }): void {
  if (camera && typeof camera.far === "number") SKY_LOOK_UNIFORMS.uSkyCamFar.value = camera.far;
  if (explicitLook) {
    SKY_LOOK_UNIFORMS.uSkyFogNear.value = explicitLook.fogNear;
    SKY_LOOK_UNIFORMS.uSkyFogFar.value = explicitLook.fogFar;
    return;
  }
  SKY_LOOK_UNIFORMS.uSkyFogNear.value = 150 - env.fog * 110;
  SKY_LOOK_UNIFORMS.uSkyFogFar.value = 950 - env.fog * 520 - env.storm * 200;
}
