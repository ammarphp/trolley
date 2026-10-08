/**
 * Small geometry and material helpers shared by the cab builders.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { inkMaterial, type InkMaterialOptions } from "../core/ink-material.ts";

/** Hatch period for cab surfaces (view space, metres at the surface). */
export const CAB_HATCH = 0.0095;
export const FINE_HATCH = 0.0062;

/**
 * Object ids feed the contour pass: touching parts with different ids get a
 * line between them even when depth and normal agree. Keep them distinct.
 */
export const IDS = {
  shell: 0.61,
  console: 0.62,
  fittings: 0.63,
  instruments: 0.64,
  labels: 0.65,
  lever: 0.66,
  leverStand: 0.67,
  gloveR: 0.68,
  sleeveR: 0.69,
  gloveL: 0.7,
  sleeveL: 0.71,
  needles: 0.72,
  screen: 0.73,
  terminal: 0.74,
  paper: 0.75,
  mirror: 0.76,
  mirrorGlass: 0.77,
  handset: 0.78,
  cord: 0.79,
  keepsake: 0.8,
  servo: 0.81,
  glassFx: 0.82,
  rainFx: 0.83,
  wiper: 0.84,
  lamps: 0.85,
  mark: 0.86,
  clipboard: 0.87,
  exterior: 0.88,
} as const;

/**
 * Shadow strength for cab surfaces. At 0.72 a paper-white surface in full
 * shadow reaches tone ~0.4: one family of strokes, never cross-hatch, so the
 * cab stays legible when the car drives into the sun. Darker albedos still
 * cross-hatch where they turn away from the light.
 */
export const CAB_SHADE = 0.72;

export function cabMaterial(id: number, extra: InkMaterialOptions = {}): THREE.MeshLambertMaterial {
  // The cab has its own lamps: night and storm darken it far less than the world outside.
  return inkMaterial({ vertexInk: true, hatchSpace: "view", hatch: CAB_HATCH, objectId: id, shade: CAB_SHADE, gloom: 0.4, ...extra });
}

/**
 * Printed matter (dials, legends, screens, paper) uses a sub-pixel hatch
 * period: the shader then resolves filtered greys to smooth mean coverage
 * instead of stroke patterns, so small type anti-aliases like print while
 * solid ink stays solid.
 */
export const PRINT_HATCH = 0.0012;

export function mapMaterial(map: THREE.Texture, id: number, extra: InkMaterialOptions = {}): THREE.MeshLambertMaterial {
  return inkMaterial({ map, flat: true, hatchSpace: "view", hatch: PRINT_HATCH, objectId: id, ...extra });
}

/** Mesh that opts out of shadow maps (the cab is lit, never shadowed by the world). */
export function cabMesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.noShadow = true;
  m.userData.cabin = true;
  return m;
}

export function roundedRectPts(w: number, h: number, r: number, seg = 6, cx = 0, cy = 0): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const hw = w / 2,
    hh = h / 2;
  const rr = Math.max(0.0005, Math.min(r, hw - 1e-4, hh - 1e-4));
  const corners: Array<[number, number, number]> = [
    [hw - rr, hh - rr, 0],
    [-hw + rr, hh - rr, Math.PI / 2],
    [-hw + rr, -hh + rr, Math.PI],
    [hw - rr, -hh + rr, 1.5 * Math.PI],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + x + rr * Math.cos(a), cy + y + rr * Math.sin(a)]);
    }
  }
  return pts;
}

function toShape(pts: Array<[number, number]>): THREE.Shape {
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

/**
 * Extrude a 2D outline (XY) by depth along +Z starting at z0, with optional
 * holes and a small bevel.
 */
export function slab(
  outline: Array<[number, number]>,
  depth: number,
  options: { holes?: Array<Array<[number, number]>>; bevel?: number; bevelSegments?: number; z0?: number; curveSegments?: number } = {},
): THREE.BufferGeometry {
  const shape = toShape(outline);
  for (const h of options.holes ?? []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const bevel = options.bevel ?? 0;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: options.bevelSegments ?? 1,
    curveSegments: options.curveSegments ?? 8,
  });
  g.translate(0, 0, (options.z0 ?? 0) + bevel);
  return g;
}

/**
 * Extrude a (z, y) section along +X from x0 to x1. The profile may be given in
 * either winding.
 */
export function sectionExtrude(profile: Array<[number, number]>, x0: number, x1: number, holes: Array<Array<[number, number]>> = []): THREE.BufferGeometry {
  const shape = toShape(profile.map(([z, y]) => [-z, y]));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(-z, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 8 });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}

export function roundedBox(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

const Y = new THREE.Vector3(0, 1, 0);

/** Orient a Y-aligned geometry between two points. */
export function between(g: THREE.BufferGeometry, a: THREE.Vector3, b: THREE.Vector3): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Y, dir.lengthSq() > 0 ? dir : Y);
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  void len;
  return g;
}

export function capsuleBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, cap = 4, radial = 10): THREE.BufferGeometry {
  const len = Math.max(1e-4, a.distanceTo(b));
  return between(new THREE.CapsuleGeometry(r, len, cap, radial), a, b);
}

export function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, radial = 10, open = false): THREE.BufferGeometry {
  const len = Math.max(1e-4, a.distanceTo(b));
  // CylinderGeometry's top is +Y: put r1 at b.
  return between(new THREE.CylinderGeometry(r1, r0, len, radial, 1, open), a, b);
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Mirror a geometry in X and repair its winding. */
export function mirrorX(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.scale(-1, 1, 1);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const others = Object.keys(g.attributes).map((k) => g.getAttribute(k) as THREE.BufferAttribute);
  for (let i = 0; i < pos.count; i += 3) {
    for (const attr of others) {
      const n = attr.itemSize;
      for (let c = 0; c < n; c++) {
        const a = attr.array[(i + 1) * n + c]!;
        (attr.array as Float32Array)[(i + 1) * n + c] = attr.array[(i + 2) * n + c]!;
        (attr.array as Float32Array)[(i + 2) * n + c] = a;
      }
      attr.needsUpdate = true;
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Merge geometries that all carry position/normal/uv (textured parts). */
export function mergeUv(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(clean, false);
  if (!merged) throw new Error("cabin: uv merge failed");
  merged.computeBoundingSphere();
  return merged;
}

/** A plane (XY, facing +Z) whose UVs address a sub-rectangle of an atlas. */
export function atlasPlane(w: number, h: number, uv: { u0: number; v0: number; u1: number; v1: number }, matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const u = a.getX(i),
      v = a.getY(i);
    a.setXY(i, uv.u0 + (uv.u1 - uv.u0) * u, uv.v0 + (uv.v1 - uv.v0) * v);
  }
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

/** Disc (XY, facing +Z) mapped to a square atlas cell. */
export function atlasDisc(r: number, uv: { u0: number; v0: number; u1: number; v1: number }, segments = 48, matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, segments);
  const a = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const u = a.getX(i),
      v = a.getY(i);
    a.setXY(i, uv.u0 + (uv.u1 - uv.u0) * u, uv.v0 + (uv.v1 - uv.v0) * v);
  }
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

export function mat4(position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
  const s = Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale, scale, scale);
  return new THREE.Matrix4().compose(new THREE.Vector3(...position), q, s);
}

export function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** System monospace stack for canvas type (no downloaded fonts in the 3D scene). */
export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
export const SANS = "'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";
export const CONDENSED = "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
