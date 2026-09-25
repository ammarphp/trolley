/**
 * Safety net for the two-attachment target: any material that is not an ink
 * material (a LineBasicMaterial wire, a MeshBasicMaterial glow, a sprite) is
 * patched to write both outputs, translating its colour into ink coverage:
 * black lines become ink, white becomes paper, red becomes signal pigment.
 * Without this, drivers may reject draws with "missing fragment shader
 * outputs" and the object silently disappears.
 */
import * as THREE from "three";

const PATCHED = Symbol.for("trolley.inkified");

const OUTPUT = /* glsl */ `
{
  vec4 inkSrc = gl_FragColor;
  float inkLum = dot(inkSrc.rgb, vec3(0.299, 0.587, 0.114));
  float inkRed = clamp((inkSrc.r - max(inkSrc.g, inkSrc.b)) * 2.0, 0.0, 1.0);
  float inkCov = inkRed > 0.25 ? 0.0 : clamp(1.0 - inkLum, 0.0, 1.0);
  gl_FragColor = vec4(inkCov, inkRed > 0.25 ? inkRed : 0.0, inkRed > 0.25 ? (inkSrc.r < 0.62 ? 1.0 : 2.0) / 8.0 : 0.0, 0.0);
  gInkInfo = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

function patch(material: THREE.Material): void {
  const m = material as THREE.Material & { [PATCHED]?: boolean; isShaderMaterial?: boolean };
  if (m[PATCHED] || m.userData.ink || m.isShaderMaterial) return;
  m[PATCHED] = true;
  const previous = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    previous?.call(m, shader, renderer);
    if (shader.fragmentShader.includes("gInkInfo")) return;
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nlayout(location = 1) out highp vec4 gInkInfo;");
    const end = shader.fragmentShader.lastIndexOf("}");
    shader.fragmentShader = shader.fragmentShader.slice(0, end) + OUTPUT + shader.fragmentShader.slice(end);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `inkified:${key ? key() : ""}`;
  m.needsUpdate = true;
}

/** Patch every non-ink material under `root` (idempotent). */
export function inkify(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(patch);
    else patch(mat);
  });
}
