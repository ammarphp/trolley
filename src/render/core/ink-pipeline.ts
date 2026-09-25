/**
 * InkPipeline: renders a scene of ink materials into a two-attachment target,
 * then composites paper, pen contours, pigment and deliberate damage.
 *
 * Contours come from three detectors on the geometry buffers:
 *   - the Laplacian of inverse depth (planes have none, so creases and
 *     silhouettes appear without the grazing-angle noise of raw depth deltas),
 *   - normal discontinuities (folds, box edges),
 *   - object-id changes (separate objects touching at similar depth).
 * Line weight grows for near silhouettes and fades with distance, which gives
 * the drawing its aerial perspective.
 */
import * as THREE from "three";
import { ACCENT_RGB, INK, PAPER } from "./palette.ts";
import { INK_GLOBALS } from "./ink-material.ts";
import { inkify } from "./inkify.ts";

export interface InkPipelineOptions {
  canvas?: HTMLCanvasElement;
  maxPixelRatio?: number;
  /** Render scale relative to CSS pixels * DPR (quality tiers use < 1). */
  renderScale?: number;
  shadows?: boolean;
  preserveDrawingBuffer?: boolean;
}

export interface InkLook {
  /** Base contour width in CSS pixels. */
  lineWidth: number;
  /** Extra width for near silhouettes. */
  nearBoost: number;
  /** Distance (m) where contours and hatching begin to fade. */
  fogNear: number;
  /** Distance (m) where everything becomes paper. */
  fogFar: number;
  /** 0..1 hand-drawn wobble. */
  wobble: number;
  /** Frames per second of line "boil" (0 disables). */
  boilRate: number;
  /** Paper grain strength. */
  grain: number;
  /** Lightning / negative flash 0..1 (inverts ink and paper). */
  negative: number;
  /** White-out flash 0..1. */
  flash: number;
  /** Signal-corruption glitch 0..1. */
  glitch: number;
  /** Seed for glitch band layout. */
  glitchSeed: number;
  /** Vignette 0..1 (used sparingly, e.g. dissociation). */
  vignette: number;
  /** Desaturate accents 0..1 (reduced graphics may choose to mute blood). */
  accentMute: number;
  /** Ink wash over the far field (storm haze) 0..1. */
  haze: number;
}

export const DEFAULT_LOOK: InkLook = {
  lineWidth: 1.15,
  nearBoost: 0.9,
  fogNear: 140,
  fogFar: 900,
  wobble: 0.55,
  boilRate: 0,
  grain: 0.018,
  negative: 0,
  flash: 0,
  glitch: 0,
  glitchSeed: 0,
  vignette: 0,
  accentMute: 0,
  haze: 0,
};

const COMPOSITE_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tInk;
uniform sampler2D tInfo;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uNear;
uniform float uFar;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccents[8];
uniform float uLineWidth;
uniform float uNearBoost;
uniform float uFogNear;
uniform float uFogFar;
uniform float uWobble;
uniform float uBoil;
uniform float uGrain;
uniform float uNegative;
uniform float uFlash;
uniform float uGlitch;
uniform float uGlitchSeed;
uniform float uVignette;
uniform float uAccentMute;
uniform float uHaze;
uniform float uTime;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float viewZ(vec2 uv) {
  float d = texture(tDepth, uv).x;
  // perspective depth -> positive view distance
  float z = (uNear * uFar) / ((uFar - uNear) * d - uFar);
  return -z;
}
vec3 decodeNormal(vec2 uv) {
  return texture(tInfo, uv).xyz * 2.0 - 1.0;
}

void main() {
  vec2 px = 1.0 / uResolution;
  vec2 uv = vUv;

  // Signal corruption: horizontal bands slip sideways.
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 38.0 + uGlitchSeed * 7.0);
    float r = hash12(vec2(band, uGlitchSeed));
    float slip = step(1.0 - uGlitch * 0.55, r) * (hash12(vec2(band * 3.1, uGlitchSeed + 1.0)) - 0.5) * 0.12 * uGlitch;
    uv.x += slip;
  }

  // Hand-drawn wobble: sample positions drift a pixel or two, coherently.
  vec2 wob = vec2(0.0);
  if (uWobble > 0.0) {
    vec2 q = gl_FragCoord.xy / uPixelRatio * 0.045 + uBoil * 13.7;
    wob = (vec2(vnoise(q), vnoise(q + 19.3)) - 0.5) * 2.4 * uWobble * px * uPixelRatio;
  }
  vec2 suv = uv + wob;

  vec4 ink = texture(tInk, suv);
  float z0 = viewZ(suv);
  float farMask = step(uFar * 0.985, z0);

  // Contour detection.
  float near = 1.0 - smoothstep(1.5, 40.0, z0);
  float radius = (uLineWidth + uNearBoost * near) * uPixelRatio;
  vec2 o = px * radius;
  float w0 = 1.0 / z0;
  float edge = 0.0;
  vec3 n0 = decodeNormal(suv);
  float id0 = texture(tInfo, suv).w;
  float weight0 = ink.a;
  // Four axes, each tested with a second-difference on inverse depth.
  vec2 dirs[4] = vec2[4](vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(0.7071, 0.7071), vec2(0.7071, -0.7071));
  for (int i = 0; i < 4; i++) {
    vec2 d = dirs[i] * o;
    float za = viewZ(suv + d);
    float zb = viewZ(suv - d);
    float wa = 1.0 / za;
    float wb = 1.0 / zb;
    float lap = abs(wa + wb - 2.0 * w0) / max(w0, 1e-6);
    float depthEdge = smoothstep(0.06, 0.16, lap);
    // One-sided silhouettes: only the nearer side draws the line, so the
    // stroke hugs the object instead of the background.
    float nearer = step(z0, min(za, zb) * 1.02);
    depthEdge *= mix(0.55, 1.0, nearer);
    vec3 na = decodeNormal(suv + d);
    vec3 nb = decodeNormal(suv - d);
    float nEdge = smoothstep(0.32, 0.62, max(1.0 - dot(n0, na), 1.0 - dot(n0, nb)));
    float ida = texture(tInfo, suv + d).w;
    float idb = texture(tInfo, suv - d).w;
    float idEdge = step(0.002, max(abs(ida - id0), abs(idb - id0))) * nearer;
    float wa2 = texture(tInk, suv + d).a;
    float wb2 = texture(tInk, suv - d).a;
    float wmin = min(weight0, max(wa2, wb2));
    edge = max(edge, max(depthEdge, max(nEdge * 0.85, idEdge)) * wmin);
  }

  // Aerial perspective: pen pressure lightens with distance.
  float fog = smoothstep(uFogNear, uFogFar, z0);
  fog = mix(fog, 1.0, farMask);
  float cov = ink.r * (1.0 - fog * 0.92);
  float lines = edge * (1.0 - fog * 0.85);

  vec3 col = mix(uPaper, uInk, clamp(cov, 0.0, 1.0));
  // Pigment.
  float accentAmt = ink.g;
  int accentId = int(floor(ink.b * 8.0 + 0.5));
  if (accentAmt > 0.001 && accentId > 0) {
    vec3 pig = uAccents[accentId];
    pig = mix(pig, vec3(dot(pig, vec3(0.3, 0.59, 0.11))) * 0.6, uAccentMute);
    // Pigment sits under the hatching like watercolour under pen.
    vec3 washed = mix(pig, pig * 0.35, clamp(cov, 0.0, 1.0));
    col = mix(col, washed, accentAmt * (1.0 - fog * 0.6));
  }
  col = mix(col, uInk, clamp(lines, 0.0, 1.0));

  // Storm haze: an ink wash over distance.
  if (uHaze > 0.0) {
    float hz = smoothstep(uFogNear * 0.4, uFogFar, z0) * uHaze;
    float hatch = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / (3.0 * uPixelRatio)));
    col = mix(col, uInk, hz * mix(0.35, 0.6, hatch));
  }

  // Paper grain (static in screen space: the paper is the screen).
  float g = vnoise(gl_FragCoord.xy / uPixelRatio * 0.35) * 0.5 + vnoise(gl_FragCoord.xy / uPixelRatio * 0.06) * 0.5;
  col *= 1.0 - uGrain * (g - 0.3);

  if (uGlitch > 0.0) {
    float band = floor(uv.y * 38.0 + uGlitchSeed * 7.0);
    float on = step(1.0 - uGlitch * 0.3, hash12(vec2(band * 1.7, uGlitchSeed + 3.0)));
    col = mix(col, vec3(col.r, col.g * 0.4, col.b * 0.4), on * 0.8);
  }
  if (uVignette > 0.0) {
    vec2 c = vUv - 0.5;
    float v = smoothstep(0.35, 0.85, length(c * vec2(1.2, 1.0)));
    col = mix(col, uInk, v * uVignette * 0.75);
  }
  col = mix(col, vec3(1.0) - col + (uPaper + uInk - vec3(1.0)), uNegative);
  col = mix(col, uPaper, uFlash);
  outColor = vec4(col, 1.0);
}
`;

export class InkPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly look: InkLook = { ...DEFAULT_LOOK };
  private target: THREE.WebGLRenderTarget;
  private composite: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private maxPixelRatio: number;
  private renderScale: number;
  private boilClock = 0;
  private inkifyCountdown = 0;

  constructor(options: InkPipelineOptions = {}) {
    this.maxPixelRatio = options.maxPixelRatio ?? 2;
    this.renderScale = options.renderScale ?? 1;
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = options.shadows ?? true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.target = this.makeTarget(1, 1);
    this.composite = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tInk: { value: this.target.textures[0] },
        tInfo: { value: this.target.textures[1] },
        tDepth: { value: this.target.depthTexture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPixelRatio: { value: 1 },
        uNear: { value: 0.1 },
        uFar: { value: 1000 },
        uPaper: { value: new THREE.Vector3(...PAPER) },
        uInk: { value: new THREE.Vector3(...INK) },
        uAccents: { value: ACCENT_RGB.map((c) => new THREE.Vector3(...c)) },
        uLineWidth: { value: 1 },
        uNearBoost: { value: 1 },
        uFogNear: { value: 100 },
        uFogFar: { value: 900 },
        uWobble: { value: 0.5 },
        uBoil: { value: 0 },
        uGrain: { value: 0.04 },
        uNegative: { value: 0 },
        uFlash: { value: 0 },
        uGlitch: { value: 0 },
        uGlitchSeed: { value: 0 },
        uVignette: { value: 0 },
        uAccentMute: { value: 0 },
        uHaze: { value: 0 },
        uTime: { value: 0 },
      },
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(tri, this.composite);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private makeTarget(w: number, h: number): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(w, h, {
      count: 2,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    target.textures[0]!.name = "ink";
    target.textures[1]!.name = "info";
    target.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    return target;
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get size(): { width: number; height: number; pixelRatio: number } {
    return { width: this.width, height: this.height, pixelRatio: this.pixelRatio };
  }

  setQuality(options: { maxPixelRatio?: number; renderScale?: number; shadows?: boolean }): void {
    if (options.maxPixelRatio !== undefined) this.maxPixelRatio = options.maxPixelRatio;
    if (options.renderScale !== undefined) this.renderScale = options.renderScale;
    if (options.shadows !== undefined) this.renderer.shadowMap.enabled = options.shadows;
    this.setSize(this.width, this.height);
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    this.pixelRatio = Math.min(dpr, this.maxPixelRatio) * this.renderScale;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    const w = Math.floor(this.width * this.pixelRatio);
    const h = Math.floor(this.height * this.pixelRatio);
    this.target.setSize(w, h);
    this.target.depthTexture!.image.width = w;
    this.target.depthTexture!.image.height = h;
    this.composite.uniforms.uResolution!.value.set(w, h);
    this.composite.uniforms.uPixelRatio!.value = this.pixelRatio;
  }

  /** Luminance that corresponds to "fully lit white" for the current lights. */
  calibrate(scene: THREE.Scene): void {
    let direct = 0;
    let ambient = 0;
    scene.traverse((o) => {
      if ((o as THREE.DirectionalLight).isDirectionalLight) direct += (o as THREE.DirectionalLight).intensity;
      if ((o as THREE.AmbientLight).isAmbientLight) ambient += (o as THREE.AmbientLight).intensity;
      if ((o as THREE.HemisphereLight).isHemisphereLight) ambient += (o as THREE.HemisphereLight).intensity;
    });
    // Lambert BRDF divides by PI; lights are not premultiplied in r155+.
    INK_GLOBALS.uInkLitRef.value = Math.max(0.02, (direct * 0.92 + ambient) / Math.PI);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, dt: number): void {
    const u = this.composite.uniforms;
    const look = this.look;
    this.boilClock += dt;
    const boil = look.boilRate > 0 ? Math.floor(this.boilClock * look.boilRate) : 0;
    u.uNear!.value = camera.near;
    u.uFar!.value = camera.far;
    u.uLineWidth!.value = look.lineWidth;
    u.uNearBoost!.value = look.nearBoost;
    u.uFogNear!.value = look.fogNear;
    u.uFogFar!.value = look.fogFar;
    u.uWobble!.value = look.wobble;
    u.uBoil!.value = boil;
    u.uGrain!.value = look.grain;
    u.uNegative!.value = look.negative;
    u.uFlash!.value = look.flash;
    u.uGlitch!.value = look.glitch;
    u.uGlitchSeed!.value = look.glitchSeed;
    u.uVignette!.value = look.vignette;
    u.uAccentMute!.value = look.accentMute;
    u.uHaze!.value = look.haze;
    u.uTime!.value += dt;
    INK_GLOBALS.uInkTime.value += dt;

    // Cheap after the first pass: patched materials are skipped.
    if (this.inkifyCountdown-- <= 0) {
      inkify(scene);
      this.inkifyCountdown = 30;
    }
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.clear(true, true, false);
    r.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.composite.dispose();
    this.quad.geometry.dispose();
    this.renderer.dispose();
  }
}

/** True when this browser can run the ink pipeline at all. */
export function supportsInk(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    const ok = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
