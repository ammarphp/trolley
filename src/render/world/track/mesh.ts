/**
 * Streams rail geometry for every visible line in short chunks, each built in
 * its own local frame (float precision stays tight far from the origin).
 * New track appears as the pen reaches it: chunks are added as `drawTo`
 * advances, which is what makes a fresh fork visibly ink itself outward.
 */
import * as THREE from "three";
import { Kit, block } from "../../core/geometry.ts";
import { inkMaterial } from "../../core/ink-material.ts";
import type { TrackLine, TrackPose } from "./path.ts";
import type { Junction, TrackNetwork } from "./network.ts";

export const GAUGE = 1.435;
export const RAIL_TOP = 0.32 + 0.16 + 0.15; // bed + sleeper + rail height
const CHUNK = 12;
const SLEEPER_GAP = 0.65;

export type HeightFn = (x: number, z: number) => number;

interface Chunk {
  line: TrackLine;
  index: number;
  mesh: THREE.Mesh;
}

/** Sweep a 2D cross-section (lateral x, up y) along a line between s0 and s1. */
function sweep(line: TrackLine, s0: number, s1: number, profile: Array<[number, number]>, lateral: number, base: TrackPose, height: HeightFn, closed = false): THREE.BufferGeometry {
  const rows: number[][] = [];
  const cos0 = Math.cos(base.heading);
  const sin0 = Math.sin(base.heading);
  const steps = Math.max(1, Math.ceil(s1 - s0));
  const p: TrackPose = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i <= steps; i++) {
    const s = s0 + ((s1 - s0) * i) / steps;
    line.pose(s, p);
    const rx = Math.cos(p.heading);
    const rz = Math.sin(p.heading);
    const y0 = height(p.x, p.z);
    const row: number[] = [];
    for (const [px, py] of profile) {
      const wx = p.x + rx * (lateral + px);
      const wz = p.z + rz * (lateral + px);
      // Into the chunk's local frame: translate then rotate by -base.heading.
      const dx = wx - base.x;
      const dz = wz - base.z;
      const lx = dx * cos0 + dz * sin0;
      const lz = -dx * sin0 + dz * cos0;
      row.push(lx, y0 + py, lz);
    }
    rows.push(row);
  }
  const n = profile.length;
  const positions: number[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % n;
      const v = (row: number[], j: number) => [row[j * 3]!, row[j * 3 + 1]!, row[j * 3 + 2]!];
      const a0 = v(a, k),
        a1 = v(a, k2),
        b0 = v(b, k),
        b1 = v(b, k2);
      positions.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

const BED: Array<[number, number]> = [
  [-3.1, -0.05],
  [-1.75, 0.32],
  [1.75, 0.32],
  [3.1, -0.05],
];
// A flat-bottomed rail, simplified: foot, web, head (lateral, up).
const RAIL: Array<[number, number]> = [
  [-0.072, 0.48],
  [0.072, 0.48],
  [0.072, 0.492],
  [0.012, 0.5],
  [0.012, 0.585],
  [0.036, 0.59],
  [0.036, 0.63],
  [-0.036, 0.63],
  [-0.036, 0.59],
  [-0.012, 0.585],
  [-0.012, 0.5],
  [-0.072, 0.492],
];

export interface TrackRendererOptions {
  height?: HeightFn;
}

export class TrackRenderer {
  readonly group = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private height: HeightFn;
  private material = inkMaterial({ vertexInk: true, hatch: 0.11, shade: 0.8 });
  private ballast = (() => {
    const m = inkMaterial({ vertexInk: true, hatch: 0.07, pattern: "stipple", shade: 0.7, edge: 0.8 });
    m.shadowSide = THREE.FrontSide;
    return m;
  })();
  private highlight = inkMaterial({ vertexInk: true, hatch: 0.11 });
  private blades: { left: THREE.Mesh; right: THREE.Mesh; junction: Junction; value: number } | null = null;

  constructor(options: TrackRendererOptions = {}) {
    this.height = options.height ?? (() => 0);
    this.group.name = "track";
  }

  setHeight(fn: HeightFn): void {
    this.height = fn;
  }

  private buildChunk(line: TrackLine, index: number, junction: Junction | null): THREE.Mesh {
    const s0 = index * CHUNK;
    const s1 = Math.min(s0 + CHUNK, line.drawTo);
    const base = line.pose(s0);
    const bed = new Kit();
    bed.add(sweep(line, s0, s1, BED, 0, base, this.height), { tone: 0.2 });
    const k = new Kit();
    // Inner rails of a branch near its toe are drawn as movable switch blades.
    const bladeLength = 9;
    const isBranch = junction && (line === junction.left || line === junction.right);
    for (const side of [-1, 1] as const) {
      const inner = isBranch && ((line === junction!.left && side === 1) || (line === junction!.right && side === -1));
      const start = inner && s0 < bladeLength ? bladeLength : s0;
      if (start < s1) k.add(sweep(line, start, s1, RAIL, (side * GAUGE) / 2, base, this.height), { tone: "dark" });
    }
    // Sleepers, aligned to the line.
    const cos0 = Math.cos(base.heading);
    const sin0 = Math.sin(base.heading);
    const p: TrackPose = { x: 0, z: 0, heading: 0 };
    const first = Math.ceil(s0 / SLEEPER_GAP) * SLEEPER_GAP;
    for (let s = first; s < s1; s += SLEEPER_GAP) {
      line.pose(s, p);
      const dx = p.x - base.x;
      const dz = p.z - base.z;
      const lx = dx * cos0 + dz * sin0;
      const lz = -dx * sin0 + dz * cos0;
      k.add(block(2.6, 0.16, 0.25), { tone: "pale", position: [lx, this.height(p.x, p.z) + 0.32, lz], rotation: [0, -(p.heading - base.heading), 0] });
    }
    const mesh = new THREE.Mesh(k.build(), this.material);
    mesh.position.set(base.x, 0, base.z);
    mesh.rotation.y = -base.heading;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    const bedMesh = new THREE.Mesh(bed.build(), this.ballast);
    bedMesh.receiveShadow = true;
    mesh.add(bedMesh);
    return mesh;
  }

  private buildBlades(j: Junction): void {
    this.disposeBlades();
    const make = (line: TrackLine, lateral: number) => {
      const base = line.pose(0);
      const geo = sweep(line, 0, 9, RAIL, lateral, base, this.height);
      const k = new Kit();
      k.add(geo, { tone: "dark" });
      const mesh = new THREE.Mesh(k.build(), this.material);
      // Pivot at the heel (9 m along): offset the geometry so the pivot is the origin.
      const heel = line.offset(9, lateral);
      const cos0 = Math.cos(base.heading);
      const sin0 = Math.sin(base.heading);
      const dx = heel.x - base.x;
      const dz = heel.z - base.z;
      const hx = dx * cos0 + dz * sin0;
      const hz = -dx * sin0 + dz * cos0;
      mesh.geometry.translate(-hx, 0, -hz);
      const pivot = new THREE.Group();
      pivot.position.set(heel.x, 0, heel.z);
      pivot.rotation.y = -base.heading;
      pivot.add(mesh);
      this.group.add(pivot);
      return mesh;
    };
    const left = make(j.left, GAUGE / 2);
    const right = make(j.right, -GAUGE / 2);
    this.blades = { left, right, junction: j, value: 0 };
  }

  private disposeBlades(): void {
    if (!this.blades) return;
    for (const m of [this.blades.left, this.blades.right]) {
      m.parent?.removeFromParent();
      m.geometry.dispose();
    }
    this.blades = null;
  }

  /** Throw the points: -1 sets the left route, +1 the right. */
  setPoints(value: number): void {
    if (!this.blades) return;
    this.blades.value = value;
    // The open blade swings ~13 cm at the toe, pivoting at the heel.
    const angle = 0.0145;
    this.blades.left.rotation.y = value < 0 ? 0 : -angle * Math.min(1, Math.abs(value));
    this.blades.right.rotation.y = value > 0 ? 0 : angle * Math.min(1, Math.abs(value));
  }

  update(network: TrackNetwork, rigX: number, rigZ: number, keepRadius = 900): void {
    const j = network.junction;
    if (j && (!this.blades || this.blades.junction !== j) && j.left.drawTo >= 9 && j.right.drawTo >= 9) this.buildBlades(j);
    const live = new Set<string>();
    for (const line of network.lines) {
      const last = Math.floor(Math.max(0, line.drawTo - 0.001) / CHUNK);
      for (let i = 0; i <= last; i++) {
        const s0 = i * CHUNK;
        const at = line.pose(s0);
        if (Math.hypot(at.x - rigX, at.z - rigZ) > keepRadius) continue;
        const key = `${line.id}:${i}`;
        live.add(key);
        const chunk = this.chunks.get(key);
        const complete = Math.min(s0 + CHUNK, line.drawTo);
        const builtTo = chunk ? (chunk.mesh.userData.builtTo as number) : -1;
        // Rebuild when the drawn extent changed either way: lines grow as the
        // pen draws them, and shrink when a stem is cut at a toe or a branch is lifted.
        if (!chunk || builtTo < complete - 0.25 || builtTo > complete + 0.01) {
          if (chunk) this.disposeChunk(chunk);
          const mesh = this.buildChunk(line, i, j && (line === j.left || line === j.right) ? j : null);
          mesh.userData.builtTo = complete;
          this.group.add(mesh);
          this.chunks.set(key, { line, index: i, mesh });
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      if (live.has(key)) continue;
      this.disposeChunk(chunk);
      this.chunks.delete(key);
    }
  }

  private disposeChunk(chunk: Chunk): void {
    this.group.remove(chunk.mesh);
    chunk.mesh.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }

  /** Tint a branch's rails with pigment (the in-world selection glow). */
  get highlightMaterial(): THREE.Material {
    return this.highlight;
  }

  dispose(): void {
    for (const c of this.chunks.values()) this.disposeChunk(c);
    this.chunks.clear();
    this.disposeBlades();
  }
}
