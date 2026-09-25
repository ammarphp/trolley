/**
 * The landscape height field.
 *
 * A sum of rotated sines: smooth, cheap, free of hash noise, and evaluated
 * identically on the CPU (`heightAt`) and on the GPU (`TERRAIN_GLSL`), so
 * anything placed with `heightAt` sits exactly on the drawn ground.
 *
 * Coordinates: `heightAt(x, z)` takes ABSOLUTE world metres (scene position +
 * INK_GLOBALS.uInkWorldOffset). The GLSL version takes SCENE coordinates and
 * reads per-wave phases that already contain the floating-origin offset
 * (computed in double precision on the CPU by `syncTerrainOrigin`), so the
 * GPU never evaluates sin() of a large argument.
 */
import * as THREE from "three";

interface Wave {
  /** Direction of travel in the XZ plane, radians. */
  angle: number;
  wavelength: number;
  amplitude: number;
  phase: number;
}

/**
 * Wavelengths are long (97-410 m) so slopes stay under ~5%: the track and the
 * ballast shoulders follow the ground without visible kinks.
 */
export const TERRAIN_WAVES: readonly Wave[] = [
  { angle: 0.297, wavelength: 410, amplitude: 0.55, phase: 0.4 },
  { angle: 1.239, wavelength: 263, amplitude: 0.38, phase: 2.1 },
  { angle: 2.321, wavelength: 171, amplitude: 0.27, phase: 4.4 },
  { angle: 3.473, wavelength: 127, amplitude: 0.18, phase: 1.3 },
  { angle: 0.75, wavelength: 337, amplitude: 0.3, phase: 5.2 },
  { angle: 5.358, wavelength: 97, amplitude: 0.12, phase: 3.3 },
];

const WAVES = TERRAIN_WAVES.map((w) => ({
  dx: Math.cos(w.angle),
  dz: Math.sin(w.angle),
  k: (Math.PI * 2) / w.wavelength,
  a: w.amplitude,
  p: w.phase,
}));

/** Sum of amplitudes: the largest possible |height|. */
export const TERRAIN_MAX_HEIGHT = WAVES.reduce((s, w) => s + w.a, 0);

/** Ground height (m) at absolute world XZ. */
export function heightAt(x: number, z: number): number {
  let h = 0;
  for (const w of WAVES) h += w.a * Math.sin(w.k * (w.dx * x + w.dz * z) + w.p);
  return h;
}

/** Height gradient (dh/dx, dh/dz) at absolute world XZ. */
export function slopeAt(x: number, z: number, out = new THREE.Vector2()): THREE.Vector2 {
  let gx = 0;
  let gz = 0;
  for (const w of WAVES) {
    const c = w.a * w.k * Math.cos(w.k * (w.dx * x + w.dz * z) + w.p);
    gx += c * w.dx;
    gz += c * w.dz;
  }
  return out.set(gx, gz);
}

const tmpSlope = new THREE.Vector2();
/** Unit ground normal at absolute world XZ. */
export function normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  slopeAt(x, z, tmpSlope);
  return out.set(-tmpSlope.x, 1, -tmpSlope.y).normalize();
}

// ------------------------------------------------------------------- GPU side

/** Shared uniforms: per-wave phase including the floating-origin offset. */
export const TERRAIN_UNIFORMS = {
  uTerrainPhase: { value: WAVES.map((w) => w.p) },
};

const TWO_PI = Math.PI * 2;
/** Fold the floating-origin offset into the wave phases (call once per frame). */
export function syncTerrainOrigin(offset: THREE.Vector3Like): void {
  const ph = TERRAIN_UNIFORMS.uTerrainPhase.value;
  WAVES.forEach((w, i) => {
    const raw = w.k * (w.dx * offset.x + w.dz * offset.z) + w.p;
    ph[i] = raw - Math.floor(raw / TWO_PI) * TWO_PI;
  });
}

const f = (n: number) => n.toPrecision(10);

/**
 * GLSL: `terrainHeight(vec2 sceneXZ)` and `terrainGradient(vec2 sceneXZ)`.
 * Needs the `uTerrainPhase` uniform (spread TERRAIN_UNIFORMS into the
 * material's uniforms).
 */
export const TERRAIN_GLSL = /* glsl */ `
uniform float uTerrainPhase[${WAVES.length}];
float terrainHeight(vec2 p) {
  float h = 0.0;
${WAVES.map((w, i) => `  h += ${f(w.a)} * sin(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) + uTerrainPhase[${i}]);`).join("\n")}
  return h;
}
vec2 terrainGradient(vec2 p) {
  vec2 g = vec2(0.0);
${WAVES.map((w, i) => `  g += ${f(w.a * w.k)} * cos(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) + uTerrainPhase[${i}]) * vec2(${f(w.dx)}, ${f(w.dz)});`).join("\n")}
  return g;
}
`;
