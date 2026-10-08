/**
 * Lab helpers for the props sheets: grid layouts with inked caption cards
 * lying on the ground in front of each item.
 */
import * as THREE from "three";
import type { LabContext } from "../lab/types.ts";
import { inkTexture, printPlane, text, SANS } from "./print.ts";
import { triangleCount } from "./common.ts";

export interface SheetItem {
  name: string;
  object: THREE.Object3D;
}

export function captionCard(name: string, width: number): THREE.Mesh | null {
  const tex = inkTexture(`caption:${name}`, 512, 96, (g, w, h) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    text(g, name, w / 2, h / 2, h * 0.36, { family: SANS, weight: "bold", maxW: w * 0.94 });
  });
  const m = printPlane(tex, width, width * (96 / 512), [0, 0.002, 0], "up", { objectId: 0.95, shade: 0 });
  if (m) m.userData.noShadow = true;
  return m;
}

/**
 * Lay items out in rows (x across, rows receding along -z), each with a
 * caption card in front. Returns the overall extent.
 */
export function grid(ctx: LabContext, items: SheetItem[], opts: { cols: number; dx: number; dz: number; card?: number; counts?: boolean }): { width: number; depth: number } {
  const rows = Math.ceil(items.length / opts.cols);
  items.forEach((it, i) => {
    const r = Math.floor(i / opts.cols);
    const cI = i % opts.cols;
    const inRow = Math.min(opts.cols, items.length - r * opts.cols);
    const x = (cI - (inRow - 1) / 2) * opts.dx;
    const z = -r * opts.dz;
    it.object.position.x += x;
    it.object.position.z += z;
    ctx.scene.add(it.object);
    const label = opts.counts ? `${it.name} · ${triangleCount(it.object)}` : it.name;
    const card = captionCard(label, opts.card ?? opts.dx * 0.9);
    if (card) {
      card.position.set(x, 0, z + opts.dz * 0.36);
      ctx.scene.add(card);
    }
  });
  return { width: opts.cols * opts.dx, depth: rows * opts.dz };
}

/**
 * Point the camera at a grid laid out by `grid()`: elevated about 25 degrees,
 * far enough back that the whole width fits the frame.
 */
export function fitCamera(ctx: LabContext, extent: { width: number; depth: number }, opts: { fov?: number; aspect?: number; lift?: number; elevation?: number; margin?: number } = {}): void {
  const fov = opts.fov ?? 36;
  const aspect = opts.aspect ?? 16 / 9;
  const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
  const halfW = extent.width / 2 + (opts.margin ?? 0.08) * extent.width;
  const dist = halfW / Math.tan(hfov / 2) + extent.depth * 0.35;
  const el = ((opts.elevation ?? 25) * Math.PI) / 180;
  const cz = -extent.depth * 0.35;
  const lift = opts.lift ?? 0;
  ctx.view([0, Math.sin(el) * dist + lift, cz + Math.cos(el) * dist], [0, lift, cz], fov);
}
