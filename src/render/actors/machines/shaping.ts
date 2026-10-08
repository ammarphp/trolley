/**
 * Coachwork helpers shared by the road vehicles: glazing slabs laid on the
 * slopes of a side profile, recessed side windows cut from a greenhouse, and
 * the deform that gives slab-sided extrusions tumblehome and rounded corners.
 */
import * as THREE from "three";
import { Kit, deform, type Tone } from "../../core/geometry.ts";
import { clipPoly, insetPoly, sideExtrude, type V2, type V3 } from "./common.ts";

/**
 * A thin panel lying on the side-view segment a→b (z, y), lifted outward
 * (away from `inside`). Returns geometry already placed.
 */
export function slab(a: V2, b: V2, width: number, thick: number, lift: number, inside: V2, trim = 0): THREE.BufferGeometry {
  const dz = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dz, dy);
  const d: V2 = [dz / len, dy / len];
  let n: V2 = [d[1], -d[0]];
  const m: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) < 0) n = [-n[0], -n[1]];
  const g = new THREE.BoxGeometry(width, Math.max(0.01, len - 2 * trim), thick);
  g.rotateX(Math.atan2(d[0], d[1]));
  g.translate(0, m[1] + n[1] * (lift + thick / 2), m[0] + n[0] * (lift + thick / 2));
  return g;
}

/** Outward normal of a→b in (z, y) pointing away from `inside`. */
export function outward(a: V2, b: V2, inside: V2): V2 {
  const dz = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dz, dy);
  let n: V2 = [dy / len, -dz / len];
  const m: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) < 0) n = [-n[0], -n[1]];
  return n;
}

/**
 * Window openings cut from a convex greenhouse outline: each span [z0, z1]
 * is clipped from the outline and inset by the frame width.
 */
export function windowHoles(greenhouse: V2[], spans: Array<[number, number]>, frame: number): V2[][] {
  const out: V2[][] = [];
  for (const [z0, z1] of spans) {
    const c = clipPoly(greenhouse, 0, z0, z1);
    if (c.length < 3) continue;
    const h = insetPoly(c, frame);
    if (h.length >= 3) out.push(h);
  }
  return out;
}

/**
 * A glazed greenhouse: a paper shell with recessed dark glass behind each
 * opening. `width` is the shell width; glass sits `recess` inside each face.
 */
export function glazedShell(
  k: Kit,
  outline: V2[],
  holes: V2[][],
  width: number,
  opts: { bevel?: number; recess?: number; shell?: Tone; glass?: Tone; offset?: V3 } = {},
): void {
  // Chamfers and holes do not mix in ExtrudeGeometry: keep shells crisp.
  const bevel = holes.length ? 0 : (opts.bevel ?? 0.02);
  const recess = opts.recess ?? 0.035;
  const pos = opts.offset ?? [0, 0, 0];
  k.add(sideExtrude(outline, width, bevel, holes), { tone: opts.shell ?? "paper", position: pos });
  for (const h of holes) k.add(sideExtrude(h, width - 2 * recess, 0), { tone: opts.glass ?? "deep", position: pos });
}

export interface CoachShape {
  /** Half width of the widest body at the sill. */
  halfWidth: number;
  /** Tumblehome: fractional narrowing between belt and roof. */
  tumble?: number;
  belt?: number;
  roof?: number;
}

/**
 * Tumblehome (linear, so flat side panels stay planar), applied after
 * assembly. Plan rounding and crowning are deliberately not offered: they
 * bend the large flat caps of side extrusions into visible facets.
 */
export function coach(geometry: THREE.BufferGeometry, s: CoachShape): THREE.BufferGeometry {
  const belt = s.belt ?? 1,
    roof = s.roof ?? 1.5,
    tumble = s.tumble ?? 0;
  return deform(geometry, (v) => {
    const t = Math.max(0, Math.min(1, (v.y - belt) / (roof - belt)));
    v.x *= 1 - tumble * t;
  });
}
