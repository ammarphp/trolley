/**
 * InkMaterial: Three's Lambert lighting and shadow maps, re-expressed as pen
 * work. The fragment shader never outputs a colour. It writes:
 *
 *   attachment 0: R ink coverage (hatching + albedo), G accent amount,
 *                 B accent index / 8, A contour weight
 *   attachment 1: RGB view-space normal, A object id
 *
 * The composite pass (ink-pipeline.ts) turns these into paper, ink, pigment
 * and contour lines. Keeping colour out of materials is what lets hundreds of
 * independently built assets read as one drawing.
 *
 * Hatch space:
 *   "world"  - static scenery; hatching is anchored to the landscape.
 *   "view"   - the cabin, which never moves relative to the camera.
 *   "object" - moving actors, so their hatching travels with them.
 *
 * Geometry may carry an `inkAttr` vec3 attribute (tone, accentAmount,
 * accentIndex) to vary albedo per vertex inside one merged mesh, and instanced
 * meshes may carry an `inkInstance` vec3 attribute with the same layout that
 * overrides the uniform/vertex values when its tone is >= 0.
 */
import * as THREE from "three";
import { ACCENT, HATCH, TONE, type AccentName, type ToneName } from "./palette.ts";

export type HatchSpace = "world" | "view" | "object";

export interface InkMaterialOptions {
  tone?: number | ToneName;
  accent?: AccentName;
  accentAmount?: number;
  /** Hatch period in world units. */
  hatch?: number;
  hatchSpace?: HatchSpace;
  /** Hatch rotation offset in radians, to vary families of assets. */
  hatchAngle?: number;
  /** Contour weight multiplier written for the composite (0 = no contours). */
  edge?: number;
  /** Ignore lighting: coverage is the albedo tone alone. */
  flat?: boolean;
  /** Use per-vertex `inkAttr`. */
  vertexInk?: boolean;
  /** Use per-instance `inkInstance`. */
  instanceInk?: boolean;
  side?: THREE.Side;
  /** How strongly shadow/lighting darkens the tone (0..1). */
  shade?: number;
  objectId?: number;
  alphaMap?: THREE.Texture | null;
  alphaTest?: number;
  /** Screen-door transparency 0..1 (1 = opaque). */
  opacity?: number;
  wireframe?: boolean;
  /** Wind sway amplitude for foliage/grass (vertex shader, world units). */
  sway?: number;
  fog?: boolean;
  /**
   * Inked texture (needs a `uv` attribute, so use it on standalone meshes, not
   * Kit-merged parts). Dark texels become ink; strongly red texels become
   * pigment (bright red such as #e00 = signal, dark red such as #8a0a10 = blood);
   * alpha < 0.5 is cut out. Draw with `createInkCanvas`.
   */
  map?: THREE.Texture | null;
  /** How much the world's gloom (storm, night) darkens this material (default 1; the lit cab uses less). */
  gloom?: number;
  /** Pen technique: parallel hatching (default) or stippled dots (gravel, earth, cloud). */
  pattern?: "hatch" | "stipple";
  /**
   * A mark on a surface (cracks, blood, rain on glass): drawn without contour
   * lines around it and without writing depth, so it reads as paint, not an object.
   */
  decal?: boolean;
}

export interface InkUniforms {
  uInkTone: THREE.IUniform<number>;
  uInkAccent: THREE.IUniform<THREE.Vector2>;
  uInkHatch: THREE.IUniform<number>;
  uInkHatchAngle: THREE.IUniform<number>;
  uInkEdge: THREE.IUniform<number>;
  uInkShade: THREE.IUniform<number>;
  uInkObjectId: THREE.IUniform<number>;
  uInkOpacity: THREE.IUniform<number>;
  uInkGloomScale: THREE.IUniform<number>;
  uInkSway: THREE.IUniform<number>;
}

/** Uniforms shared by every ink material, updated once per frame. */
export const INK_GLOBALS = {
  uInkTime: { value: 0 },
  uInkLitRef: { value: 1 },
  uInkWorldOffset: { value: new THREE.Vector3() },
  uInkWind: { value: new THREE.Vector2(0.6, 0.2) },
  /** Global exposure bias: storms and dusk push every tone darker. */
  uInkGloom: { value: 0 },
  /** 0..1: raises hatch density everywhere (distress, late stages). */
  uInkTension: { value: 0 },
};

const HEADER = /* glsl */ `
layout(location = 1) out highp vec4 gInkInfo;
uniform float uInkTone;
uniform vec2 uInkAccent;
uniform float uInkHatch;
uniform float uInkHatchAngle;
uniform float uInkEdge;
uniform float uInkShade;
uniform float uInkObjectId;
uniform float uInkOpacity;
uniform float uInkLitRef;
uniform float uInkGloom;
uniform float uInkGloomScale;
uniform float uInkTension;
uniform float uInkTime;
varying vec3 vInkPos;
varying vec3 vInkNrm;
varying vec3 vInkAttr;
#ifdef INK_MAP
uniform sampler2D uInkMap;
varying vec2 vInkUv;
#endif

float inkHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float inkValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = inkHash(i);
  float b = inkHash(i + vec2(1.0, 0.0));
  float c = inkHash(i + vec2(0.0, 1.0));
  float d = inkHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// One family of parallel pen strokes. Anti-aliased with fwidth and faded to
// its mean coverage where the strokes would alias.
float inkStrokes(vec2 p, float angle, float period, float width) {
  vec2 dir = vec2(cos(angle), sin(angle));
  float u = dot(p, vec2(-dir.y, dir.x)) / period;
  float along = dot(p, dir) / period;
  // Hand-drawn irregularity: stroke weight breathes along its length and
  // neighbouring strokes differ slightly.
  float wobble = inkValueNoise(vec2(along * 0.35, floor(u) * 1.7));
  float w = width * (0.72 + 0.56 * wobble);
  u += (inkValueNoise(vec2(along * 0.6, floor(u) * 3.1)) - 0.5) * 0.18;
  float aa = max(fwidth(u), 1e-4);
  float f = abs(fract(u) - 0.5) * 2.0;
  float cov = 1.0 - smoothstep(w - aa, w + aa, f);
  // Stroke gaps: pens lift occasionally.
  float gap = step(0.1, inkValueNoise(vec2(along * 0.9 + 7.0, floor(u) * 5.3)));
  cov *= mix(1.0, gap, 0.6);
  return mix(cov, w * 0.8, clamp(aa * 1.6 - 0.35, 0.0, 1.0));
}
// Stippling: one jittered dot per cell whose radius grows with tone.
float inkStipple(vec2 p, float tone, float period) {
  vec2 q = p / period;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 jit = vec2(inkHash(cell), inkHash(cell + 17.31)) * 0.64 + 0.18;
  float d = length(f - jit);
  float r = sqrt(clamp(tone, 0.0, 1.0)) * 0.52;
  float aa = max(fwidth(q.x) + fwidth(q.y), 1e-4);
  float cov = 1.0 - smoothstep(r - aa, r + aa, d);
  return mix(cov, tone * 0.85, clamp(aa * 1.3 - 0.3, 0.0, 1.0));
}
float inkHatchAt(vec2 p, float tone, float period, float baseAngle) {
  // Where strokes fall below a pixel (distance, fine print, the mirror's
  // engraving), converge to a linear tone so values stay faithful.
  vec2 q = p / period;
  float alias = clamp((fwidth(q.x) + fwidth(q.y)) * 0.9 - 0.45, 0.0, 1.0);
  float flatTone = smoothstep(0.1, 1.0, tone) * 0.94;
  #ifdef INK_STIPPLE
  return mix(max(inkStipple(p, tone, period), smoothstep(0.9, 0.98, tone)), flatTone, alias);
  #endif
  float h = 0.0;
  float t1 = smoothstep(0.14, 0.3, tone);
  h = max(h, inkStrokes(p, baseAngle + 0.785, period, 0.08 + 0.34 * tone) * t1);
  float t2 = smoothstep(0.42, 0.58, tone);
  h = max(h, inkStrokes(p, baseAngle - 0.785, period, 0.06 + 0.3 * tone) * t2);
  float t3 = smoothstep(0.66, 0.8, tone);
  h = max(h, inkStrokes(p, baseAngle + 0.05, period * 0.75, 0.08 + 0.3 * tone) * t3);
  float solid = smoothstep(0.86, 0.96, tone);
  return mix(max(h, solid), flatTone, alias);
}
`;

const VERTEX_HEADER = /* glsl */ `
uniform float uInkHatch;
uniform vec3 uInkWorldOffset;
uniform float uInkSway;
uniform float uInkTime;
uniform vec2 uInkWind;
varying vec3 vInkPos;
varying vec3 vInkNrm;
varying vec3 vInkAttr;
#ifdef INK_VERTEX
attribute vec3 inkAttr;
#endif
#ifdef INK_INSTANCE
attribute vec3 inkInstance;
#endif
#ifdef INK_MAP
varying vec2 vInkUv;
#endif
`;

const VERTEX_SWAY = /* glsl */ `
#ifdef INK_SWAY
{
  vec4 swayBase = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  swayBase = instanceMatrix * swayBase;
  #endif
  swayBase = modelMatrix * swayBase;
  float h = max(transformed.y, 0.0);
  float phase = dot(swayBase.xz, vec2(0.13, 0.21)) + uInkTime * 1.7;
  float gust = sin(phase) * 0.6 + sin(phase * 2.3 + 1.1) * 0.25;
  transformed.xz += uInkWind * gust * uInkSway * h * h;
}
#endif
`;

const VERTEX_BODY = /* glsl */ `
{
  vec3 inkAttrValue = vec3(-1.0, 0.0, 0.0);
  #ifdef INK_VERTEX
  inkAttrValue = inkAttr;
  #endif
  #ifdef INK_INSTANCE
  if (inkInstance.x >= 0.0) inkAttrValue = inkInstance;
  #endif
  vInkAttr = inkAttrValue;
  #ifdef INK_MAP
  vInkUv = uv;
  #endif
  #if defined(INK_SPACE_VIEW)
    vInkPos = mvPosition.xyz;
    vInkNrm = transformedNormal;
  #elif defined(INK_SPACE_OBJECT)
    vInkPos = transformed;
    vInkNrm = objectNormal;
  #else
    vec4 inkWp = vec4(transformed, 1.0);
    vec3 inkWn = objectNormal;
    #ifdef USE_INSTANCING
    inkWp = instanceMatrix * inkWp;
    inkWn = mat3(instanceMatrix) * inkWn;
    #endif
    inkWp = modelMatrix * inkWp;
    vInkPos = inkWp.xyz + uInkWorldOffset;
    vInkNrm = normalize(mat3(modelMatrix) * inkWn);
  #endif
}
`;

const FRAGMENT_OUTPUT = /* glsl */ `
{
  float albedo = uInkTone;
  vec2 accent = uInkAccent;
  if (vInkAttr.x >= 0.0) {
    albedo = vInkAttr.x;
    if (vInkAttr.z > 0.0) accent = vec2(vInkAttr.y, vInkAttr.z);
  }
  #ifdef INK_MAP
  {
    vec4 texel = texture(uInkMap, vInkUv);
    if (texel.a < 0.5) discard;
    float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
    // Saturated texels become pigment: red (blood when dark, signal when
    // bright), amber, cobalt or cyan. Everything else is ink by luminance.
    float hi = max(texel.r, max(texel.g, texel.b));
    float lo = min(texel.r, min(texel.g, texel.b));
    float chroma = hi - lo;
    if (chroma > 0.25) {
      float amt = clamp(chroma * 1.4, 0.0, 1.0);
      float id;
      if (texel.r >= hi - 1e-4) id = texel.g > 0.45 * texel.r + 0.12 ? 3.0 : (texel.r < 0.62 ? 1.0 : 2.0);
      else if (texel.b >= hi - 1e-4) id = texel.g > 0.6 * texel.b ? 7.0 : 4.0;
      else id = texel.b > 0.6 * texel.g ? 7.0 : 5.0;
      accent = vec2(amt, id);
    }
    else albedo = max(albedo, 1.0 - lum);
  }
  #endif
  #ifdef INK_FLAT
    float light = 1.0;
  #else
    float light = clamp(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) / uInkLitRef, 0.0, 1.2);
  #endif
  // Shadow side darkens toward a hatched mid-tone; albedo sets the floor.
  float shadeAmt = (1.0 - smoothstep(0.18, 0.95, light)) * uInkShade;
  float tone = albedo + (1.0 - albedo) * shadeAmt * 0.46;
  tone = clamp(tone + uInkGloom * (0.35 + 0.65 * shadeAmt) * (1.0 - albedo) * uInkGloomScale + uInkTension * 0.06, 0.0, 1.0);

  // Triplanar stroke placement with soft blending across axes.
  vec3 n = normalize(vInkNrm);
  vec3 an = pow(abs(n), vec3(5.0));
  an /= (an.x + an.y + an.z + 1e-5);
  float period = uInkHatch;
  float cov = 0.0;
  if (an.x > 0.01) cov += an.x * inkHatchAt(vInkPos.zy, tone, period, uInkHatchAngle + 0.3);
  if (an.y > 0.01) cov += an.y * inkHatchAt(vInkPos.xz, tone, period, uInkHatchAngle);
  if (an.z > 0.01) cov += an.z * inkHatchAt(vInkPos.xy, tone, period, uInkHatchAngle - 0.2);
  // Deep albedo reads as a solid fill regardless of stroke orientation.
  cov = max(cov, smoothstep(0.88, 0.97, albedo));

  #ifdef INK_DITHER
  {
    // Screen-door transparency: an ordered stipple, in keeping with pen work.
    vec2 fc = floor(gl_FragCoord.xy);
    float bayer = mod(fc.x * 3.0 + fc.y * 7.0 + mod(fc.x * fc.y, 5.0), 9.0) / 9.0;
    if (uInkOpacity < bayer + 0.05) discard;
  }
  #endif

  pc_fragColor = vec4(cov, accent.x, accent.y / 8.0, uInkEdge);
  gInkInfo = vec4(normal * 0.5 + 0.5, uInkObjectId);
}
`;

const cache = new Map<string, THREE.MeshLambertMaterial>();

function resolveTone(t: number | ToneName | undefined): number {
  if (t === undefined) return TONE.paper;
  return typeof t === "number" ? t : TONE[t];
}

export function createInkMaterial(options: InkMaterialOptions = {}): THREE.MeshLambertMaterial {
  const space = options.hatchSpace ?? "world";
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    side: options.side ?? THREE.FrontSide,
    alphaMap: options.alphaMap ?? null,
    alphaTest: options.alphaTest ?? 0,
    wireframe: options.wireframe ?? false,
  });
  const uniforms: InkUniforms = {
    uInkTone: { value: resolveTone(options.tone) },
    uInkAccent: {
      value: new THREE.Vector2(options.accentAmount ?? (options.accent ? 1 : 0), ACCENT[options.accent ?? "none"]),
    },
    uInkHatch: {
      value: options.hatch ?? (space === "view" ? HATCH.cabin : space === "object" ? HATCH.actor : HATCH.world),
    },
    uInkHatchAngle: { value: options.hatchAngle ?? 0 },
    uInkEdge: { value: options.decal ? 0 : (options.edge ?? 1) },
    uInkShade: { value: options.shade ?? 1 },
    uInkObjectId: { value: options.objectId ?? 0 },
    uInkOpacity: { value: options.opacity ?? 1 },
    uInkGloomScale: { value: options.gloom ?? 1 },
    uInkSway: { value: options.sway ?? 0 },
  };
  material.userData.ink = uniforms;
  if (options.decal) {
    material.depthWrite = false;
    material.userData.inkDecal = true;
  }
  const mapUniform = { uInkMap: { value: options.map ?? null } };
  const defines: Record<string, string> = {};
  if (space === "view") defines.INK_SPACE_VIEW = "";
  if (space === "object") defines.INK_SPACE_OBJECT = "";
  if (options.flat) defines.INK_FLAT = "";
  if (options.vertexInk) defines.INK_VERTEX = "";
  if (options.instanceInk) defines.INK_INSTANCE = "";
  if ((options.opacity ?? 1) < 1) defines.INK_DITHER = "";
  if (options.sway) defines.INK_SWAY = "";
  if (options.map) defines.INK_MAP = "";
  if (options.pattern === "stipple") defines.INK_STIPPLE = "";
  material.defines = defines;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, INK_GLOBALS, options.map ? mapUniform : {});
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_HEADER}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_SWAY}`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${HEADER}`)
      .replace("#include <opaque_fragment>", FRAGMENT_OUTPUT)
      .replace("#include <tonemapping_fragment>", "")
      .replace("#include <colorspace_fragment>", "")
      .replace("#include <fog_fragment>", "")
      .replace("#include <premultiplied_alpha_fragment>", "")
      .replace("#include <dithering_fragment>", "");
  };
  // Distinct programs per define set; uniforms are per material instance.
  material.customProgramCacheKey = () => `ink:${Object.keys(defines).sort().join(",")}`;
  return material;
}

/**
 * Shared material lookup for the common case: many meshes with identical
 * appearance should share one material so they batch well.
 */
export function inkMaterial(options: InkMaterialOptions = {}): THREE.MeshLambertMaterial {
  const key = JSON.stringify({ ...options, alphaMap: options.alphaMap ? options.alphaMap.uuid : null, map: options.map ? options.map.uuid : null });
  let m = cache.get(key);
  if (!m) {
    m = createInkMaterial(options);
    cache.set(key, m);
  }
  return m;
}

export function inkUniforms(material: THREE.Material): InkUniforms {
  const u = material.userData.ink as InkUniforms | undefined;
  if (!u) throw new Error("Not an ink material");
  return u;
}

/**
 * Line material for wires, cracks and rails drawn as GL lines. Writes the same
 * two attachments so it composes with the contour pass.
 */
export function createInkLineMaterial(options: { tone?: number; accent?: AccentName; accentAmount?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uTone: { value: options.tone ?? 1 },
      uAccent: { value: new THREE.Vector2(options.accentAmount ?? (options.accent ? 1 : 0), ACCENT[options.accent ?? "none"]) },
    },
    vertexShader: /* glsl */ `
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTone;
      uniform vec2 uAccent;
      layout(location = 0) out highp vec4 outInk;
      layout(location = 1) out highp vec4 outInfo;
      void main() {
        outInk = vec4(uTone, uAccent.x, uAccent.y / 8.0, 0.0);
        outInfo = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `,
  });
}

/**
 * Build an `inkAttr` attribute for a geometry with a single tone/accent.
 * Merging geometries that each carry this attribute yields one draw call with
 * per-part albedo.
 */
export function paintGeometry(
  geometry: THREE.BufferGeometry,
  tone: number | ToneName,
  accent: AccentName = "none",
  accentAmount = accent === "none" ? 0 : 1,
): THREE.BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const data = new Float32Array(count * 3);
  const t = resolveTone(tone);
  const a = ACCENT[accent];
  for (let i = 0; i < count; i++) {
    data[i * 3] = t;
    data[i * 3 + 1] = accentAmount;
    data[i * 3 + 2] = a;
  }
  geometry.setAttribute("inkAttr", new THREE.BufferAttribute(data, 3));
  return geometry;
}

/**
 * A 2D canvas whose drawing becomes ink on a 3D surface: draw black on white
 * (or transparent), red for signal pigment. Call `texture.needsUpdate = true`
 * after redrawing.
 */
export function createInkCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return { canvas, ctx, texture };
}
