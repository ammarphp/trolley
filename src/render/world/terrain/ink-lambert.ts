/**
 * Lambert-lit ink materials with custom pen shading, for surfaces that need
 * the scene's lights and shadow maps (the ground, river banks) but draw their
 * own marks. Writes the same two attachments as core/ink-material.ts:
 *
 *   location 0: R ink coverage, G accent amount, B accent index / 8, A contour weight
 *   location 1: RGB view-space normal * 0.5 + 0.5, A object id
 *
 * Only Three's own chunk names are relied on, so changes to the core ink
 * header never break these shaders.
 */
import * as THREE from "three";
import { INK_GLOBALS } from "../../core/ink-material.ts";

export interface InkLambertSpec {
  /** Program cache key (unique per shader source). */
  key: string;
  uniforms: Record<string, THREE.IUniform>;
  /** GLSL added after `#include <common>` in the vertex shader. */
  vertexHead?: string;
  /** Replaces `#include <beginnormal_vertex>` (must define `vec3 objectNormal`). */
  vertexNormal?: string;
  /** Replaces `#include <begin_vertex>` (must define `vec3 transformed`). */
  vertexBegin?: string;
  /** Appended after `#include <fog_vertex>`. */
  vertexTail?: string;
  /** GLSL added after `#include <common>` in the fragment shader. */
  fragmentHead: string;
  /**
   * Replaces `#include <opaque_fragment>`. Has `outgoingLight`, `normal`
   * (view space), `vViewPosition`, `inkRefLight` and must write
   * `pc_fragColor` and `gInkOut1`.
   */
  fragmentOut: string;
  side?: THREE.Side;
  defines?: Record<string, string>;
}

/**
 * GLSL computing the luminance an unshadowed, level surface would receive
 * from the scene's lights, so surfaces can shade by *relative* light (cast
 * shadows and slopes) independent of sun height and intensity.
 */
const REF_LIGHT = /* glsl */ `
float inkRefLight() {
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 irr = ambientLightColor;
  #if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) irr += max(dot(upV, directionalLights[i].direction), 0.0) * directionalLights[i].color;
  #endif
  #if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) irr += getHemisphereLightIrradiance(hemisphereLights[i], upV);
  #endif
  return max(dot(irr * RECIPROCAL_PI, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
}
// World-space direction toward the strongest directional light (y up).
vec3 inkSunWorld() {
  #if NUM_DIR_LIGHTS > 0
  vec3 d = directionalLights[0].direction;
  return normalize(transpose(mat3(viewMatrix)) * d);
  #else
  return normalize(vec3(0.4, 0.8, 0.3));
  #endif
}
`;

export function createInkLambert(spec: InkLambertSpec): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: spec.side ?? THREE.FrontSide });
  material.defines = { ...(spec.defines ?? {}) };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, INK_GLOBALS, spec.uniforms);
    let vs = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>\nuniform vec3 uInkWorldOffset;\nuniform float uInkTime;\n${spec.vertexHead ?? ""}`,
    );
    if (spec.vertexNormal) vs = vs.replace("#include <beginnormal_vertex>", spec.vertexNormal);
    if (spec.vertexBegin) vs = vs.replace("#include <begin_vertex>", spec.vertexBegin);
    if (spec.vertexTail) vs = vs.replace("#include <fog_vertex>", `#include <fog_vertex>\n${spec.vertexTail}`);
    shader.vertexShader = vs;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nlayout(location = 1) out highp vec4 gInkOut1;\nuniform vec3 uInkWorldOffset;\nuniform float uInkTime;\nuniform float uInkGloom;\nuniform float uInkTension;\n${spec.fragmentHead}`,
      )
      .replace("#include <lights_pars_begin>", `#include <lights_pars_begin>\n${REF_LIGHT}`)
      .replace("#include <opaque_fragment>", spec.fragmentOut)
      .replace("#include <tonemapping_fragment>", "")
      .replace("#include <colorspace_fragment>", "")
      .replace("#include <fog_fragment>", "")
      .replace("#include <premultiplied_alpha_fragment>", "")
      .replace("#include <dithering_fragment>", "");
  };
  material.customProgramCacheKey = () => spec.key;
  // Already writes both attachments: tells the pipeline's inkify() pass to leave it alone.
  material.userData.ink = { custom: spec.key };
  return material;
}

/**
 * Keeps a `uPxScale` vec3 uniform (focal length in px, device pixel ratio,
 * drawing-buffer height) current for a mesh, from whatever target it is
 * rendered into.
 */
export function trackPixelScale(mesh: THREE.Object3D, uniform: THREE.IUniform<THREE.Vector3>): void {
  const size = new THREE.Vector2();
  mesh.onBeforeRender = (renderer, _scene, camera) => {
    const target = renderer.getRenderTarget();
    const h = target ? target.height : renderer.getDrawingBufferSize(size).y;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = cam.isPerspectiveCamera ? THREE.MathUtils.degToRad(cam.fov) : 1;
    const focal = h / 2 / Math.tan(fov / 2) / (cam.zoom || 1);
    uniform.value.set(focal, renderer.getPixelRatio(), h);
  };
}
