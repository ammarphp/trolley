/**
 * A tunnel: the chapter break between stages. Stone portals at either end and
 * a dark bore with a lamp every twenty metres. While the cab is inside, the
 * world outside is redrawn for the next stage, so the player emerges into it.
 */
import * as THREE from "three";
import { Kit, block } from "../core/geometry.ts";
import { inkMaterial } from "../core/ink-material.ts";
import type { TrackLine, TrackPose } from "./track/path.ts";

export interface Tunnel {
  group: THREE.Group;
  start: number;
  length: number;
  line: TrackLine;
  contains(line: TrackLine, s: number): boolean;
  dispose(): void;
}

const HALF = 4.4;
const WALL = 5.2;
const CROWN = 7.2;

function arch(n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [[-HALF, -0.2], [-HALF, WALL]];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([Math.cos(a) * HALF, WALL + Math.sin(a) * (CROWN - WALL)]);
  }
  pts.push([HALF, WALL], [HALF, -0.2]);
  return pts;
}

export function buildTunnel(line: TrackLine, start: number, length: number, heightAt: (x: number, z: number) => number): Tunnel {
  const group = new THREE.Group();
  group.name = "tunnel";
  line.extendTo(start + length + 2);
  const base = line.pose(start);
  const cos0 = Math.cos(base.heading);
  const sin0 = Math.sin(base.heading);
  const toLocal = (x: number, z: number): [number, number] => {
    const dx = x - base.x;
    const dz = z - base.z;
    return [dx * cos0 + dz * sin0, -dx * sin0 + dz * cos0];
  };
  const profile = arch(14);
  const bore: number[] = [];
  const p: TrackPose = { x: 0, z: 0, heading: 0 };
  const step = 2;
  for (let s = start; s < start + length; s += step) {
    const rows = [s, Math.min(start + length, s + step)].map((ss) => {
      line.pose(ss, p);
      const rx = Math.cos(p.heading);
      const rz = Math.sin(p.heading);
      const y0 = heightAt(p.x, p.z);
      return profile.map(([lx, ly]) => {
        const [x, z] = toLocal(p.x + rx * lx, p.z + rz * lx);
        return [x, y0 + ly, z] as const;
      });
    });
    const a = rows[0]!;
    const b = rows[1]!;
    for (let k = 0; k < profile.length - 1; k++) {
      // Inward-facing: the camera is inside.
      bore.push(...a[k]!, ...a[k + 1]!, ...b[k + 1]!, ...a[k]!, ...b[k + 1]!, ...b[k]!);
    }
  }
  const boreGeo = new THREE.BufferGeometry();
  boreGeo.setAttribute("position", new THREE.Float32BufferAttribute(bore, 3));
  boreGeo.computeVertexNormals();
  const boreMesh = new THREE.Mesh(boreGeo, inkMaterial({ tone: 0.9, hatch: 0.3, side: THREE.DoubleSide, edge: 0.6 }));
  boreMesh.position.set(base.x, 0, base.z);
  boreMesh.rotation.y = -base.heading;
  group.add(boreMesh);

  // Portals: rusticated stone faces around the arch, with a hillside above.
  for (const [at, facing] of [
    [start, 0],
    [start + length, Math.PI],
  ] as const) {
    const q = line.pose(at);
    const k = new Kit();
    const y0 = heightAt(q.x, q.z);
    for (let i = 0; i < 9; i++) {
      const x = -HALF - 1.6 + i * ((HALF * 2 + 3.2) / 8);
      const archTop = Math.abs(x) < HALF ? WALL + Math.sqrt(Math.max(0, 1 - (x / HALF) ** 2)) * (CROWN - WALL) : 0;
      for (let y = archTop; y < CROWN + 3.5; y += 0.9) k.add(block(1.15, 0.82, 1.2), { tone: (i + Math.floor(y)) % 3 === 0 ? "pale" : "paper", position: [x, y0 + y, 0] });
    }
    k.add(block(HALF * 2 + 5, 0.6, 1.8), { tone: "light", position: [0, y0 + CROWN + 3.4, 0] });
    const mound = new THREE.SphereGeometry(28, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    mound.scale(1.6, 0.55, 1.1);
    k.add(mound, { tone: "paper", position: [0, y0 - 1, facing === 0 ? -26 : 26] });
    const portal = new THREE.Mesh(k.build(), inkMaterial({ vertexInk: true, hatch: 0.22 }));
    portal.position.set(q.x, 0, q.z);
    portal.rotation.y = -q.heading + facing;
    group.add(portal);
  }
  // Lamps: amber pigment every twenty metres.
  for (let s = start + 8; s < start + length; s += 20) {
    const q = line.offset(s, HALF - 0.4);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.4), inkMaterial({ tone: 0, accent: "amber", flat: true }));
    lamp.position.set(q.x, heightAt(q.x, q.z) + WALL - 0.4, q.z);
    group.add(lamp);
  }
  return {
    group,
    start,
    length,
    line,
    contains: (l, s) => l === line && s > start + 6 && s < start + length - 4,
    dispose: () => {
      group.removeFromParent();
      group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
}
