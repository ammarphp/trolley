/**
 * Things people hold, lie on, sit in or are bound with.
 *
 * Held props are authored in the grip frame (origin in the closed hand, the
 * handle running along local z when the arm hangs). Furniture is authored in
 * body/ground space facing +z (wheelchair) or lying along x (gurney), matching
 * the lying poses.
 */
import * as THREE from "three";
import { block, cylinder, sphere, tube, cone, jitter, type PartOptions } from "../../core/geometry.ts";
import { ellipseRing, ellipsoid, limb, loft, slab, rumple, type Ring } from "./shapes.ts";
import type { AccentName, ToneName } from "../../core/palette.ts";

export type HeldProp =
  | "sledge"
  | "pick"
  | "shovel"
  | "fork"
  | "clipboard"
  | "briefcase"
  | "suitcase"
  | "cane"
  | "umbrella"
  | "iv-pole"
  | "rifle"
  | "lamp"
  | "sign"
  | "box"
  | "crate"
  | "bundle"
  | "tablet"
  | "folder"
  | "medic-bag"
  | "teddy"
  | "toolbox"
  | "baton";

export interface PropPart {
  g: THREE.BufferGeometry;
  o: PartOptions;
}

const P = (g: THREE.BufferGeometry, tone: ToneName | number, extra: Partial<PartOptions> = {}): PropPart => ({ g, o: { tone, ...extra } });

/** A cylinder whose axis runs along +z from z0 to z1. */
function rodZ(r: number, z0: number, z1: number, seg = 6, r1 = r): THREE.BufferGeometry {
  const g = cylinder(r1, r, Math.abs(z1 - z0), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}
/** A cylinder whose axis runs along +y from y0 to y1. */
function rodY(r: number, y0: number, y1: number, seg = 6, r1 = r): THREE.BufferGeometry {
  const g = cylinder(r1, r, Math.abs(y1 - y0), seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

export interface HeldOptions {
  /** Grip height above the ground when the arm hangs (for canes, IV poles). */
  gripHeight: number;
  seed: number;
}

/** Geometry for a held prop, in the grip frame. */
export function heldProp(kind: HeldProp, opts: HeldOptions): PropPart[] {
  const out: PropPart[] = [];
  switch (kind) {
    case "sledge": {
      out.push(P(rodZ(0.017, -0.14, 0.78, 6, 0.019), "light"));
      out.push(P(block(0.075, 0.22, 0.08).translate(0, -0.11, 0.8), "deep"));
      out.push(P(block(0.085, 0.02, 0.09).translate(0, 0.1, 0.8), "deep"));
      out.push(P(block(0.085, 0.02, 0.09).translate(0, -0.12, 0.8), "deep"));
      break;
    }
    case "pick": {
      out.push(P(rodZ(0.017, -0.14, 0.78, 6, 0.02), "light"));
      const spike = (dir: 1 | -1) => {
        const c = cone(0.028, 0.3, 6);
        c.translate(0, 0.15, 0);
        c.rotateZ(0);
        c.scale(1, 1, 0.8);
        if (dir < 0) c.rotateX(Math.PI);
        c.rotateX(dir * 0.18);
        c.translate(0, 0, 0.8);
        return c;
      };
      out.push(P(spike(1), "deep"));
      out.push(P(spike(-1), "deep"));
      out.push(P(block(0.06, 0.08, 0.07).translate(0, -0.04, 0.8), "solid"));
      break;
    }
    case "shovel": {
      out.push(P(rodZ(0.016, 0, 1.0, 6), "light"));
      // D-grip at the top.
      out.push(P(ellipseRing(0.055, 0.045, 0.01, 10, 4).rotateZ(Math.PI / 2).translate(0, 0, -0.06), "deep"));
      const blade = loft(
        [
          { y: 0, w: 0.04, f: 0.012, b: 0.012 },
          { y: 0.06, w: 0.115, f: 0.01, b: 0.02, p: 3 },
          { y: 0.26, w: 0.12, f: 0.006, b: 0.03, p: 3 },
          { y: 0.3, w: 0.09, f: 0.004, b: 0.02, p: 2.4 },
        ],
        10,
        { capBottom: 0, capTop: 0 },
      );
      blade.rotateX(Math.PI / 2);
      blade.translate(0, 0, 0.98);
      out.push(P(blade, "mid"));
      break;
    }
    case "fork": {
      out.push(P(rodZ(0.016, -0.05, 1.25, 6), "light"));
      out.push(P(block(0.2, 0.025, 0.05).translate(0, -0.012, 1.25), "deep"));
      for (let i = 0; i < 4; i++) {
        const x = -0.085 + i * 0.057;
        const t = cylinder(0.006, 0.009, 0.3, 4);
        t.rotateX(Math.PI / 2);
        t.translate(x, 0, 1.42);
        out.push(P(t, "deep"));
      }
      break;
    }
    case "clipboard": {
      // Board in the hand's x=0 plane, extending forward (+z) and up (+y).
      out.push(P(block(0.012, 0.32, 0.23).translate(0, -0.06, 0.1), "mid"));
      out.push(P(block(0.004, 0.28, 0.2).translate(0.008, -0.045, 0.1), "paper"));
      out.push(P(block(0.02, 0.03, 0.08).translate(0.008, 0.24, 0.1), "solid"));
      break;
    }
    case "tablet": {
      out.push(P(block(0.01, 0.25, 0.18).translate(0, -0.05, 0.08), "deep"));
      break;
    }
    case "folder": {
      out.push(P(block(0.03, 0.32, 0.24).translate(0, -0.1, 0.07), "dark"));
      out.push(P(block(0.024, 0.3, 0.02).translate(0, -0.1, 0.19), "paper"));
      break;
    }
    case "briefcase": {
      out.push(P(ellipseRing(0.05, 0.02, 0.008, 10, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, -0.015, 0), "solid"));
      out.push(P(slab(0.1, 0.32, 0.44, 0.15).translate(0, -0.36, 0), "deep"));
      out.push(P(block(0.104, 0.012, 0.446).translate(0, -0.1, 0), "solid"));
      break;
    }
    case "medic-bag": {
      out.push(P(ellipseRing(0.05, 0.02, 0.009, 10, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, -0.02, 0), "solid"));
      out.push(P(slab(0.2, 0.26, 0.4, 0.3).translate(0, -0.3, 0), "dark"));
      // White cross on the outer face.
      out.push(P(block(0.004, 0.12, 0.035).translate(0.102, -0.2, 0), "paper"));
      out.push(P(block(0.004, 0.035, 0.12).translate(0.102, -0.2, 0), "paper"));
      break;
    }
    case "toolbox": {
      out.push(P(rodZ(0.01, -0.12, 0.12, 5), "solid"));
      out.push(P(block(0.18, 0.2, 0.46).translate(0, -0.26, 0), "mid"));
      out.push(P(block(0.185, 0.03, 0.465).translate(0, -0.1, 0), "dark"));
      break;
    }
    case "suitcase": {
      out.push(P(ellipseRing(0.06, 0.02, 0.01, 10, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, -0.02, 0), "solid"));
      out.push(P(slab(0.22, 0.6, 0.44, 0.12).translate(0, -0.65, 0), "mid"));
      for (const z of [-0.12, 0.12]) out.push(P(block(0.226, 0.6, 0.03).translate(0, -0.65, z), "dark"));
      break;
    }
    case "cane": {
      const h = opts.gripHeight;
      out.push(P(rodY(0.012, -h, 0, 6), "dark"));
      out.push(P(tube([[0, 0, 0], [0, 0.05, 0.03], [0, 0.03, 0.09], [0, -0.02, 0.1]], 0.013, 8, 5), "dark"));
      out.push(P(cylinder(0.016, 0.016, 0.03, 6).translate(0, -h + 0.015, 0), "solid"));
      break;
    }
    case "umbrella": {
      const h = opts.gripHeight;
      out.push(P(rodY(0.008, -h + 0.05, 0, 5), "solid"));
      // Furled canopy: a long slim spindle.
      const canopy = limb(0.55, [0.012, 0.035, 0.04, 0.03, 0.012], 7, { top: 0.4, bottom: 0.6 });
      canopy.translate(0, -0.25, 0);
      out.push(P(canopy, "deep"));
      out.push(P(tube([[0, 0, 0], [0, 0.06, 0.02], [0, 0.05, 0.08], [0, 0.0, 0.085]], 0.012, 8, 5), "solid"));
      break;
    }
    case "iv-pole": {
      const h = opts.gripHeight;
      out.push(P(rodY(0.011, -h + 0.08, 0.95, 6), "light"));
      // Five-star base with casters.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const leg = block(0.03, 0.02, 0.28);
        leg.translate(0, 0, 0.14);
        leg.rotateY(a);
        leg.translate(0, -h + 0.07, 0);
        out.push(P(leg, "mid"));
        out.push(P(sphere(0.025, 6, 4).translate(Math.sin(a) * 0.27, -h + 0.025, Math.cos(a) * 0.27), "solid"));
      }
      out.push(P(block(0.3, 0.012, 0.012).translate(0, 0.95, 0), "light"));
      const bag = slab(0.12, 0.2, 0.04, 0.4);
      bag.translate(0.12, 0.72, 0);
      out.push(P(bag, "pale"));
      out.push(P(tube([[0.12, 0.72, 0], [0.13, 0.4, 0.02], [0.08, 0.1, 0.06], [0.03, -0.05, 0.05]], 0.003, 10, 3), "mid"));
      break;
    }
    case "rifle": {
      // Generic long gun: pistol grip at the origin, muzzle forward.
      out.push(P(block(0.035, 0.1, 0.035).translate(0, -0.08, -0.01).rotateX(-0.25), "solid"));
      out.push(P(block(0.045, 0.08, 0.36).translate(0, -0.01, 0.1), "deep"));
      out.push(P(rodZ(0.012, 0.28, 0.72, 6), "solid"));
      out.push(P(rodZ(0.024, 0.26, 0.5, 6), "deep"));
      out.push(P(block(0.032, 0.18, 0.06).translate(0, -0.16, 0.14).rotateX(0.15), "solid"));
      out.push(P(block(0.035, 0.1, 0.26).translate(0, -0.07, -0.26), "deep"));
      out.push(P(block(0.02, 0.035, 0.12).translate(0, 0.055, 0.1), "solid"));
      break;
    }
    case "baton": {
      out.push(P(rodY(0.016, -0.5, 0.04, 6), "solid"));
      break;
    }
    case "lamp": {
      out.push(P(ellipseRing(0.05, 0.03, 0.008, 10, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.0, 0), "solid"));
      out.push(P(cylinder(0.07, 0.075, 0.18, 10).translate(0, -0.13, 0), "dark"));
      out.push(P(cylinder(0.078, 0.078, 0.02, 10).translate(0, -0.03, 0), "solid"));
      const lens = cylinder(0.045, 0.045, 0.03, 10);
      lens.rotateX(Math.PI / 2);
      lens.translate(0, -0.13, 0.075);
      out.push(P(lens, "pale", { accent: "signal" }));
      break;
    }
    case "sign": {
      // Pole along +y from the grip; board at the top facing +z.
      out.push(P(rodY(0.016, -0.35, 1.05, 6), "light"));
      out.push(P(block(0.64, 0.46, 0.014).translate(0, 0.72, 0.015), "paper"));
      out.push(P(block(0.66, 0.02, 0.02).translate(0, 0.72, 0.015), "light"));
      out.push(P(block(0.66, 0.02, 0.02).translate(0, 1.17, 0.015), "light"));
      break;
    }
    case "box": {
      out.push(P(block(0.42, 0.3, 0.32).translate(0, -0.15, 0), "pale"));
      out.push(P(block(0.425, 0.012, 0.06).translate(0, 0.0, 0), "mid"));
      out.push(P(block(0.06, 0.305, 0.325).translate(0, -0.15, 0), "light"));
      break;
    }
    case "crate": {
      const k: PropPart[] = [];
      for (const y of [-0.26, -0.15, -0.04]) {
        k.push(P(block(0.46, 0.07, 0.012).translate(0, y, 0.16), "light"));
        k.push(P(block(0.46, 0.07, 0.012).translate(0, y, -0.16), "light"));
        k.push(P(block(0.012, 0.07, 0.32).translate(0.225, y, 0), "light"));
        k.push(P(block(0.012, 0.07, 0.32).translate(-0.225, y, 0), "light"));
      }
      k.push(P(block(0.46, 0.012, 0.32).translate(0, -0.3, 0), "mid"));
      for (let i = 0; i < 4; i++) k.push(P(sphere(0.07, 7, 5).translate(-0.15 + i * 0.1, -0.08, (i % 2) * 0.06 - 0.03), "pale"));
      out.push(...k);
      break;
    }
    case "bundle": {
      const sack = rumple(ellipsoid(0.22, 0.17, 0.16, 10, 8), 0.02, opts.seed, 18);
      sack.translate(0, -0.1, 0);
      out.push(P(sack, "light"));
      out.push(P(ellipsoid(0.06, 0.05, 0.05, 7, 5).translate(0, 0.07, 0), "mid"));
      out.push(P(ellipseRing(0.2, 0.15, 0.012, 14, 4).translate(0, -0.08, 0), "dark"));
      break;
    }
    case "teddy": {
      // A small, worn bear held by the arm.
      out.push(P(ellipsoid(0.07, 0.085, 0.06, 8, 6).translate(0, -0.12, 0.02), "light"));
      out.push(P(sphere(0.06, 8, 6).translate(0, -0.0, 0.03), "light"));
      out.push(P(sphere(0.022, 5, 4).translate(0.045, 0.05, 0.02), "light"));
      out.push(P(sphere(0.022, 5, 4).translate(-0.045, 0.05, 0.02), "light"));
      out.push(P(sphere(0.022, 5, 4).translate(0, -0.01, 0.085), "pale"));
      for (const x of [-0.05, 0.05]) out.push(P(ellipsoid(0.025, 0.05, 0.025, 5, 4).translate(x, -0.2, 0.03), "light"));
      break;
    }
  }
  return out;
}

/** Where the other hand goes for two-handed props, in the grip frame. */
export function secondGrip(kind: HeldProp): THREE.Vector3 | null {
  switch (kind) {
    case "sledge":
    case "pick":
      return new THREE.Vector3(0, 0, 0.3);
    case "shovel":
      return new THREE.Vector3(0, 0, 0.55);
    case "fork":
      return new THREE.Vector3(0, 0, 0.55);
    case "rifle":
      return new THREE.Vector3(0, -0.01, 0.34);
    case "sign":
      return new THREE.Vector3(0, -0.42, 0);
    default:
      return null;
  }
}

// ----------------------------------------------------------------- furniture

/** Wheelchair facing +z; seat top at `seat`. */
export function wheelchairParts(seat = 0.5): PropPart[] {
  const out: PropPart[] = [];
  const wheelR = 0.3;
  const hubZ = -0.12;
  for (const side of [1, -1] as const) {
    const x = side * 0.3;
    const tyre = ellipseRing(wheelR, wheelR, 0.016, 26, 5);
    tyre.rotateZ(Math.PI / 2);
    tyre.translate(x, wheelR, hubZ);
    out.push(P(tyre, "deep"));
    const rim = ellipseRing(wheelR * 0.86, wheelR * 0.86, 0.007, 22, 4);
    rim.rotateZ(Math.PI / 2);
    rim.translate(x + side * 0.035, wheelR, hubZ);
    out.push(P(rim, "mid"));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sp = cylinder(0.003, 0.003, wheelR * 0.94, 3);
      sp.translate(0, wheelR * 0.47, 0);
      sp.rotateX(a);
      sp.translate(x, wheelR, hubZ);
      out.push(P(sp, "light"));
    }
    out.push(P(cylinder(0.03, 0.03, 0.05, 8).rotateZ(Math.PI / 2).translate(x, wheelR, hubZ), "dark"));
    // Frame: side rails, armrest, push handle, front fork and caster.
    const frameX = side * 0.24;
    out.push(P(tube([[frameX, seat - 0.02, 0.26], [frameX, seat - 0.02, -0.18], [frameX, seat + 0.42, -0.22], [frameX, seat + 0.47, -0.3]], 0.012, 10, 5), "dark"));
    out.push(P(tube([[frameX, seat + 0.2, 0.2], [frameX, seat + 0.22, -0.16]], 0.018, 4, 5), "dark"));
    out.push(P(tube([[frameX, seat + 0.2, 0.16], [frameX, seat - 0.02, 0.14]], 0.01, 4, 4), "dark"));
    out.push(P(tube([[frameX, seat - 0.02, 0.26], [frameX, 0.2, 0.32], [frameX, 0.1, 0.38]], 0.011, 8, 4), "dark"));
    out.push(P(block(0.12, 0.012, 0.1).translate(side * 0.13, 0.1, 0.4), "mid"));
    const caster = ellipseRing(0.07, 0.07, 0.014, 12, 4);
    caster.rotateZ(Math.PI / 2);
    caster.translate(frameX, 0.07, 0.3);
    out.push(P(caster, "deep"));
    out.push(P(tube([[frameX, 0.2, 0.3], [frameX, 0.07, 0.3]], 0.008, 3, 4), "dark"));
  }
  // Sling seat and back.
  out.push(P(block(0.46, 0.03, 0.44).translate(0, seat - 0.035, 0.03), "mid"));
  out.push(P(block(0.46, 0.4, 0.025).translate(0, seat + 0.02, -0.21).rotateX(-0.08), "mid"));
  out.push(P(tube([[0.24, seat - 0.04, 0.0], [-0.24, seat - 0.04, 0.0]], 0.01, 2, 4), "dark"));
  return out;
}

/** Hospital gurney, long axis along x; mattress top at `top`. */
export function gurneyParts(top = 0.86, length = 2.0, headSide: 1 | -1 = -1): PropPart[] {
  const out: PropPart[] = [];
  const L = length;
  const W = 0.62;
  // Mattress, with a pillow at the head end.
  out.push(P(slab(L - 0.04, 0.1, W - 0.04, 0.3).translate(0, top - 0.1, 0), "paper"));
  out.push(P(ellipsoid(0.2, 0.06, 0.26, 8, 6).translate(headSide * (L / 2 - 0.26), top + 0.03, 0), "paper"));
  // Frame.
  for (const z of [-W / 2, W / 2]) {
    out.push(P(tube([[-L / 2, top - 0.12, z], [L / 2, top - 0.12, z]], 0.016, 2, 5), "mid"));
    // Side rails folded down.
    out.push(P(tube([[-L / 2 + 0.3, top - 0.02, z * 1.05], [L / 2 - 0.3, top - 0.02, z * 1.05]], 0.01, 2, 4), "dark"));
  }
  for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) {
    for (const z of [-W / 2 + 0.05, W / 2 - 0.05]) {
      out.push(P(tube([[x, top - 0.12, z], [x, 0.12, z]], 0.018, 2, 5), "mid"));
      const wheel = ellipseRing(0.06, 0.06, 0.018, 10, 4);
      wheel.rotateX(Math.PI / 2);
      wheel.rotateY(Math.PI / 2);
      wheel.translate(x, 0.06, z);
      out.push(P(wheel, "solid"));
    }
  }
  out.push(P(block(L - 0.3, 0.02, W - 0.1).translate(0, 0.28, 0), "light"));
  return out;
}

/** A sheet drawn over legs on a gurney (along x). */
export function sheetPart(top: number, x0: number, x1: number, W = 0.58): PropPart {
  const len = Math.abs(x1 - x0);
  const rings: Ring[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    rings.push({ y: t * len, w: W / 2, f: 0.16 + Math.sin(t * Math.PI) * 0.02, b: 0.0, p: 2.4 });
  }
  const g = loft(rings, 12, { capBottom: 0, capTop: 0.0 });
  // Loft runs along y; lay it along x, bulge upward.
  g.rotateX(Math.PI / 2); // y -> z, ring front (+z) -> -y
  g.rotateX(Math.PI); // flip so the bulge is up
  g.rotateY(Math.PI / 2);
  g.translate(Math.min(x0, x1), top, 0);
  rumple(g, 0.01, 7, 14);
  return P(g, "paper");
}

/** Irregular pool of blood (flat, on the ground). */
export function poolPart(radius: number, seed: number): PropPart {
  const pts: THREE.Vector2[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = Math.sin(a * 3 + seed) * 0.18 + Math.sin(a * 5 + seed * 2.1) * 0.12 + Math.sin(a * 2 + seed * 0.7) * 0.2;
    pts.push(new THREE.Vector2(Math.cos(a) * radius * (1 + h), Math.sin(a) * radius * (1 + h) * 0.8));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.012, 0);
  return { g, o: { tone: "dark", accent: "blood" as AccentName, accentAmount: 1 } };
}

/** Rope: a few tight coils (elliptical, in the bone's xz plane) at heights `ys`. */
export function ropeCoils(rx: number, rzF: number, rzB: number, ys: number[], x = 0, z = 0): PropPart[] {
  return ys.map((y, i) => {
    const g = ellipseRing(rx + i * 0.002, rzF, 0.011, 14, 3, rzB);
    g.rotateZ((i - 1) * 0.04);
    g.translate(x, y, z);
    return P(g, "light");
  });
}

/** A hard hat lying on the ground (dropped). */
export function droppedHat(parts: PropPart[], at: THREE.Vector3, tilt: number): PropPart[] {
  return parts.map((p) => {
    const g = p.g.clone();
    g.rotateZ(tilt);
    g.rotateX(0.2);
    g.translate(at.x, at.y, at.z);
    return { g, o: p.o };
  });
}

export function jitterPart(p: PropPart, amt: number, seed: number): PropPart {
  return { g: jitter(p.g, amt, seed), o: p.o };
}
