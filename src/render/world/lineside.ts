/**
 * Lineside: a pole route of telegraph poles beside the line, with wires strung
 * between them. Poles are instanced; the wires are one batch of hairlines,
 * rebuilt only when a pole is added or removed. The route follows the line the
 * trolley is on and runs out along both branches of an open fork, so the two
 * routes diverge with the track.
 */
import * as THREE from "three";
import type { AssetProvider } from "../assets.ts";
import { createInkLineMaterial, createInkMaterial } from "../core/ink-material.ts";
import type { Junction, TrackNetwork } from "./track/network.ts";
import type { TrackLine } from "./track/path.ts";

const SPACING = 52;
const OFFSET = 4.8;
const AHEAD = 420;
const BEHIND = 140;
const FORGET = 700;
/** Branch routes start beyond the tableau so poles never stand among the stakes. */
const BRANCH_START = 64;
const CAPACITY = 160;
const SEGMENTS = 10;

interface Pole {
  line: TrackLine;
  s: number;
  index: number;
  x: number;
  z: number;
  points: THREE.Vector3[];
}

interface Route {
  side: number;
  minS: number;
  next: number;
  poles: Pole[];
  parent: { line: TrackLine; toe: number } | null;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Lineside {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private attachments: THREE.Vector3[] = [];
  private free: number[] = [];
  private routes = new Map<TrackLine, Route>();
  private links: Array<[Pole, Pole]> = [];
  private wires: THREE.LineSegments;
  private dirty = false;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    assets: AssetProvider,
    private heightAt: (x: number, z: number) => number,
    private blocked: (line: TrackLine, s: number) => boolean,
    variant = 1,
  ) {
    this.group.name = "lineside";
    const prefab = assets.prefab("pole", variant, {});
    if (prefab) {
      this.mesh = new THREE.InstancedMesh(prefab.geometry, createInkMaterial({ ...prefab.material, instanceInk: false }), CAPACITY);
      for (let i = 0; i < CAPACITY; i++) this.mesh.setMatrixAt(i, ZERO);
      for (let i = CAPACITY - 1; i >= 0; i--) this.free.push(i);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = true;
      this.group.add(this.mesh);
      this.attachments = assets.poleAttachments?.(variant) ?? [];
    }
    this.wires = new THREE.LineSegments(new THREE.BufferGeometry(), createInkLineMaterial({ tone: 0.8 }));
    this.wires.frustumCulled = false;
    this.group.add(this.wires);
  }

  update(network: TrackNetwork, junction: Junction | null, rigLine: TrackLine, rigS: number, rigX: number, rigZ: number): void {
    if (!this.mesh) return;
    // The line under the trolley.
    let route = this.routes.get(rigLine);
    if (!route) {
      route = { side: -1, minS: -Infinity, next: Math.ceil((rigS - BEHIND) / SPACING) * SPACING, poles: [], parent: null };
      this.routes.set(rigLine, route);
    }
    this.extend(rigLine, route, Math.min(rigLine.drawTo, rigS + AHEAD), junction);
    // An open fork: both branches carry the route out of sight.
    if (junction && !junction.chosen && junction.stem === rigLine) {
      for (const [line, side] of [
        [junction.left, -1],
        [junction.right, 1],
      ] as const) {
        let branch = this.routes.get(line);
        if (!branch) {
          branch = { side, minS: BRANCH_START, next: BRANCH_START, poles: [], parent: { line: junction.stem, toe: junction.toe } };
          this.routes.set(line, branch);
        }
        if (!line.abandoned) this.extend(line, branch, Math.min(line.drawTo, BRANCH_START + 320), junction);
      }
    }
    // Forget what is far behind or gone with a pruned line.
    const live = new Set(network.lines);
    for (const [line, r] of this.routes) {
      const keep = r.poles.filter((p) => {
        const gone = !live.has(line) || Math.hypot(p.x - rigX, p.z - rigZ) > FORGET || (line === rigLine && p.s < rigS - BEHIND - SPACING);
        if (gone) this.remove(p);
        return !gone;
      });
      r.poles = keep;
      if (!live.has(line)) this.routes.delete(line);
    }
    if (this.dirty) this.rebuildWires();
  }

  private extend(line: TrackLine, route: Route, to: number, junction: Junction | null): void {
    while (route.next <= to && this.free.length) {
      const s = route.next;
      route.next += SPACING;
      if (s < route.minS) continue;
      if (this.blocked(line, s)) continue;
      // Keep clear of the switch and its signal.
      if (junction && line === junction.stem && Math.abs(s - junction.toe) < 12) continue;
      const pole = this.add(line, s, route.side);
      const prev = route.poles.at(-1);
      if (prev && pole.s - prev.s < SPACING * 1.7) this.link(prev, pole);
      else if (!prev && route.parent) {
        // Carry the wires over from the stem when the route stays on the same side.
        const parent = this.routes.get(route.parent.line);
        const toe = route.parent.toe;
        const last = parent?.side === route.side ? parent.poles.filter((p) => p.s <= toe).at(-1) : undefined;
        if (last && toe - last.s + s < 140) this.link(last, pole);
      }
      route.poles.push(pole);
    }
  }

  private add(line: TrackLine, s: number, side: number): Pole {
    const p = line.offset(s, side * OFFSET);
    const y = this.heightAt(p.x, p.z);
    const index = this.free.pop()!;
    // Poles face +Z along the wires: turn local Z down the line.
    this.quat.setFromAxisAngle(this.up, -p.heading);
    this.matrix.compose(new THREE.Vector3(p.x, y, p.z), this.quat, new THREE.Vector3(1, 1, 1));
    this.mesh!.setMatrixAt(index, this.matrix);
    this.mesh!.instanceMatrix.needsUpdate = true;
    const points = this.attachments.map((a) => a.clone().applyMatrix4(this.matrix));
    return { line, s, index, x: p.x, z: p.z, points };
  }

  private remove(p: Pole): void {
    this.mesh!.setMatrixAt(p.index, ZERO);
    this.mesh!.instanceMatrix.needsUpdate = true;
    this.free.push(p.index);
    this.links = this.links.filter(([a, b]) => a !== p && b !== p);
    this.dirty = true;
  }

  private link(a: Pole, b: Pole): void {
    this.links.push([a, b]);
    this.dirty = true;
  }

  private rebuildWires(): void {
    this.dirty = false;
    const out: number[] = [];
    for (const [a, b] of this.links) {
      const span = Math.hypot(a.x - b.x, a.z - b.z);
      const sag = 0.011 * span;
      const n = Math.min(a.points.length, b.points.length);
      for (let i = 0; i < n; i++) {
        const pa = a.points[i]!;
        const pb = b.points[i]!;
        let px = pa.x;
        let py = pa.y;
        let pz = pa.z;
        for (let k = 1; k <= SEGMENTS; k++) {
          const t = k / SEGMENTS;
          const x = pa.x + (pb.x - pa.x) * t;
          const y = pa.y + (pb.y - pa.y) * t - sag * 4 * t * (1 - t);
          const z = pa.z + (pb.z - pa.z) * t;
          out.push(px, py, pz, x, y, z);
          px = x;
          py = y;
          pz = z;
        }
      }
    }
    const g = this.wires.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    g.computeBoundingSphere();
  }

  /** Remove poles on a stretch of line (a tunnel has been cut through it). */
  forget(line: TrackLine, from: number, to: number): void {
    const route = this.routes.get(line);
    if (!route) return;
    route.poles = route.poles.filter((p) => {
      if (p.s < from || p.s > to) return true;
      this.remove(p);
      return false;
    });
    if (this.dirty) this.rebuildWires();
  }

  /** Remove every pole (the world is being redrawn). */
  clear(): void {
    for (const r of this.routes.values()) for (const p of r.poles) this.remove(p);
    this.routes.clear();
    this.links = [];
    this.rebuildWires();
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh?.dispose();
    this.wires.geometry.dispose();
  }
}
