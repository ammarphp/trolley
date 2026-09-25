/**
 * A shared in-situ stage: straight standard-gauge track receding along -Z,
 * seen from the cab's eye point. Builders place their assets beside it to
 * judge them at the distances the player actually sees.
 */
import * as THREE from "three";
import { inkMaterial } from "../core/ink-material.ts";
import { Kit, block } from "../core/geometry.ts";
import type { LabContext } from "./types.ts";

export const CAB_EYE: [number, number, number] = [0, 2.55, 6];
export const CAB_FOV = 55;
export const GAUGE = 1.435;

export function trackGeometry(length = 400, sleeperGap = 0.62): THREE.BufferGeometry {
  const k = new Kit();
  // Ballast bed: a low trapezoid embankment.
  const bed = new THREE.BufferGeometry();
  const top = 1.7,
    bottom = 2.9,
    h = 0.32;
  const verts = new Float32Array([
    -bottom, 0, 0, -top, h, 0, top, h, 0, bottom, 0, 0,
    -bottom, 0, -length, -top, h, -length, top, h, -length, bottom, 0, -length,
  ]);
  bed.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  bed.setIndex([0, 5, 4, 0, 1, 5, 1, 6, 5, 1, 2, 6, 2, 7, 6, 2, 3, 7]);
  bed.computeVertexNormals();
  k.add(bed, { tone: "pale" });
  for (let z = -0.3; z > -length; z -= sleeperGap) k.add(block(2.6, 0.16, 0.24), { tone: "light", position: [0, h, z] });
  for (const x of [-GAUGE / 2, GAUGE / 2]) {
    k.add(block(0.07, 0.15, length), { tone: "mid", position: [x, h + 0.16, -length / 2] });
    k.add(block(0.14, 0.03, length), { tone: "mid", position: [x, h + 0.16, -length / 2] });
  }
  return k.build();
}

export function inSituStage(ctx: LabContext, options: { length?: number; sun?: [number, number, number] } = {}): void {
  ctx.standardStage({ sun: options.sun ?? [35, 48, 30] });
  const track = new THREE.Mesh(trackGeometry(options.length ?? 400), inkMaterial({ vertexInk: true, hatch: 0.12 }));
  ctx.scene.add(track);
  ctx.view(CAB_EYE, [0, 1.6, -60], CAB_FOV);
}
