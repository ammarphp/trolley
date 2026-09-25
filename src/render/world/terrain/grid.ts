/**
 * Nested-grid ground geometry (a static "clipmap").
 *
 * Level 0 is a fine square grid; every further level is a square ring with
 * twice the step. The seams between levels are stitched with fan triangles
 * (no T-junctions, so no pixel cracks for the contour pass to find). The
 * mesh is flat (y = 0); heights are applied in the vertex shader.
 *
 * Every step divides the coarsest step, so recentring the mesh in multiples
 * of `snapStep` keeps every vertex on a fixed world lattice: nothing swims.
 */
import * as THREE from "three";

export interface GridSpec {
  /** Finest vertex spacing, metres. */
  baseStep: number;
  /** Cells per half-side at each level. Must be even. */
  cellsHalf: number;
  /** Outer half-size of the whole mesh, metres. */
  outer: number;
}

export function buildNestedGrid(spec: GridSpec): { geometry: THREE.BufferGeometry; snapStep: number; triangles: number } {
  const { baseStep, cellsHalf, outer } = spec;
  const positions: number[] = [];
  const index: number[] = [];
  const ids = new Map<string, number>();
  const vid = (ix: number, iz: number): number => {
    // Integer lattice coordinates in units of baseStep / 2 (midpoints are exact).
    const key = `${ix},${iz}`;
    let i = ids.get(key);
    if (i === undefined) {
      i = positions.length / 3;
      positions.push((ix * baseStep) / 2, 0, (iz * baseStep) / 2);
      ids.set(key, i);
    }
    return i;
  };
  let snapStep = baseStep;
  for (let l = 0; ; l++) {
    const s = baseStep * 2 ** l; // metres
    const unit = 2 ** (l + 1); // step in half-base units
    const n = Math.min(cellsHalf, Math.ceil(outer / s));
    const m = l === 0 ? 0 : cellsHalf / 2;
    snapStep = s;
    for (let j = -n; j < n; j++) {
      for (let i = -n; i < n; i++) {
        if (l > 0 && i >= -m && i < m && j >= -m && j < m) continue;
        const x0 = i * unit;
        const x1 = (i + 1) * unit;
        const z0 = j * unit;
        const z1 = (j + 1) * unit;
        const h = unit / 2;
        // Front-facing (+Y) order: (x0,z0) -> (x0,z1) -> (x1,z1) -> (x1,z0).
        const poly: number[] = [];
        let mid = -1;
        const inRange = (k: number) => k >= -m && k < m;
        const addMid = (x: number, z: number) => {
          mid = poly.length;
          poly.push(vid(x, z));
        };
        poly.push(vid(x0, z0));
        if (l > 0 && i === m && inRange(j)) addMid(x0, z0 + h); // left edge touches the inner square
        poly.push(vid(x0, z1));
        if (l > 0 && j === -m - 1 && inRange(i)) addMid(x0 + h, z1); // top edge
        poly.push(vid(x1, z1));
        if (l > 0 && i === -m - 1 && inRange(j)) addMid(x1, z1 - h); // right edge
        poly.push(vid(x1, z0));
        if (l > 0 && j === m && inRange(i)) addMid(x1 - h, z0); // bottom edge
        if (mid < 0) {
          index.push(poly[0]!, poly[1]!, poly[3]!, poly[3]!, poly[1]!, poly[2]!);
        } else {
          // Pentagon with one midpoint: fan from a vertex not adjacent to it.
          const L = poly.length;
          const start = (mid + 2) % L;
          for (let t = 1; t < L - 1; t++) index.push(poly[start]!, poly[(start + t) % L]!, poly[(start + t + 1) % L]!);
        }
      }
    }
    if (n < cellsHalf || n * s >= outer) break;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outer * Math.SQRT2);
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-outer, -5, -outer), new THREE.Vector3(outer, 5, outer));
  return { geometry, snapStep, triangles: index.length / 3 };
}
