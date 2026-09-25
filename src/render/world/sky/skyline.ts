/**
 * Far skyline elements for the backdrop ring, at real scale (metres), origin
 * at the base centre, facing +Z. Seen at ~1.2 km they are silhouettes of a
 * few dozen pixels, so what matters is the specific outline: the sawtooth
 * roofs, the hyperbolic cooling tower, the crane's jib, the church spire.
 *
 * Every element carries an `aB` attribute (channel, reveal threshold, base
 * y, seed) so the backdrop shader can raise it from the hills as its
 * environment channel rises, truncate it with ruin, or light its windows.
 */
import * as THREE from "three";
import { Kit, block, cylinder, cone, lathe, gable } from "../../core/geometry.ts";
import type { Rng } from "../../core/rng.ts";

/** Backdrop vertex channels (aB.x). */
export const CH = {
  terrain: 0,
  town: 1,
  industry: 2,
  compute: 3,
  order: 4,
  trees: 5,
  smoke: 6,
} as const;

export type SkylineKind =
  | "houses"
  | "church"
  | "water-tower"
  | "office"
  | "chimney"
  | "cooling-tower"
  | "shed"
  | "gasometer"
  | "crane"
  | "data-hall"
  | "mast"
  | "pylon"
  | "turbine"
  | "monolith";

export const SKYLINE_CHANNEL: Record<SkylineKind, number> = {
  houses: CH.town,
  church: CH.town,
  "water-tower": CH.town,
  office: CH.town,
  chimney: CH.industry,
  "cooling-tower": CH.industry,
  shed: CH.industry,
  gasometer: CH.industry,
  crane: CH.industry,
  "data-hall": CH.compute,
  mast: CH.compute,
  pylon: CH.compute,
  turbine: CH.compute,
  monolith: CH.order,
};

export function skylineElement(kind: SkylineKind, rng: Rng): Kit {
  const k = new Kit();
  switch (kind) {
    case "houses": {
      const n = rng.int(4, 9);
      let x = -n * 6;
      for (let i = 0; i < n; i++) {
        const w = rng.range(7, 11);
        const h = rng.range(5, 8);
        const z = rng.range(-10, 10);
        k.add(block(w, h, 8), { tone: "pale", position: [x + w / 2, 0, z] });
        k.add(gable(w, 8, rng.range(3, 4.5), 0.4), { tone: "mid", position: [x + w / 2, h, z], rotation: [0, Math.PI / 2, 0] });
        if (rng.chance(0.5)) k.add(block(0.9, 2.2, 0.9), { tone: "dark", position: [x + w * 0.7, h + 1.5, z] });
        x += w + rng.range(1, 5);
      }
      break;
    }
    case "church": {
      k.add(block(12, 11, 26), { tone: "pale", position: [0, 0, -8] });
      k.add(gable(12, 26, 6, 0.5), { tone: "mid", position: [0, 11, -8] });
      k.add(block(8, 26, 8), { tone: "pale", position: [0, 0, 8] });
      k.add(cone(5.4, rng.range(18, 26), 4), { tone: "mid", position: [0, 26 + 10, 8], rotation: [0, Math.PI / 4, 0] });
      break;
    }
    case "water-tower": {
      const h = rng.range(22, 30);
      for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as const) k.add(cylinder(0.35, 0.45, h, 5), { tone: "mid", position: [x, h / 2, z] });
      k.add(cylinder(5.5, 5.5, 7, 12), { tone: "pale", position: [0, h + 3.5, 0] });
      k.add(cone(5.8, 2.4, 12), { tone: "mid", position: [0, h + 8.2, 0] });
      break;
    }
    case "office": {
      const w = rng.range(18, 30);
      const h = rng.range(55, 130);
      k.add(block(w, h, w * rng.range(0.7, 1.1)), { tone: "pale" });
      k.add(block(w * 0.6, 5, w * 0.5), { tone: "light", position: [0, h, 0] });
      if (rng.chance(0.5)) k.add(cylinder(0.4, 0.4, 14, 4), { tone: "dark", position: [w * 0.2, h + 12, 0] });
      break;
    }
    case "chimney": {
      const h = rng.range(55, 95);
      const r = rng.range(2.6, 3.8);
      k.add(cylinder(r * 0.72, r, h, 10), { tone: "light", position: [0, h / 2, 0] });
      k.add(cylinder(r * 0.82, r * 0.82, 3, 10), { tone: "dark", position: [0, h - 4, 0] });
      k.add(block(24, 14, 18), { tone: "pale", position: [-14, 0, 0] });
      break;
    }
    case "cooling-tower": {
      const h = rng.range(105, 145);
      const r0 = h * 0.37;
      const profile: Array<[number, number]> = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        // Hyperboloid: narrow waist at ~78% of the height, slight flare above.
        const waist = 0.78;
        const r = t < waist ? r0 * (1 - 0.4 * Math.sin((t / waist) * Math.PI * 0.5)) : r0 * (0.6 + 0.08 * ((t - waist) / (1 - waist)));
        profile.push([r, t * h]);
      }
      k.add(lathe(profile, 20), { tone: "pale" });
      k.add(cylinder(r0 * 0.66, r0 * 0.66, 1, 20, true), { tone: "dark", position: [0, h - 0.2, 0] });
      break;
    }
    case "shed": {
      const n = rng.int(4, 8);
      const tooth = rng.range(7, 9);
      const h = rng.range(10, 14);
      const d = rng.range(30, 50);
      k.add(block(n * tooth, h, d), { tone: "pale", position: [0, 0, 0] });
      for (let i = 0; i < n; i++) {
        // Sawtooth north-lights: a steep glazed face and a sloping roof.
        const x0 = -n * tooth * 0.5 + i * tooth;
        const saw = new THREE.BufferGeometry();
        const hh = tooth * 0.55;
        const v = new Float32Array([
          x0, h, -d / 2, x0 + tooth, h, -d / 2, x0 + tooth, h + hh, -d / 2,
          x0, h, d / 2, x0 + tooth, h + hh, d / 2, x0 + tooth, h, d / 2,
          x0, h, -d / 2, x0 + tooth, h + hh, -d / 2, x0 + tooth, h + hh, d / 2,
          x0, h, -d / 2, x0 + tooth, h + hh, d / 2, x0, h, d / 2,
          x0 + tooth, h, -d / 2, x0 + tooth, h, d / 2, x0 + tooth, h + hh, d / 2,
          x0 + tooth, h, -d / 2, x0 + tooth, h + hh, d / 2, x0 + tooth, h + hh, -d / 2,
        ]);
        saw.setAttribute("position", new THREE.BufferAttribute(v, 3));
        saw.computeVertexNormals();
        k.add(saw, { tone: i % 2 ? "light" : "mid" });
      }
      break;
    }
    case "gasometer": {
      const r = rng.range(18, 26);
      const h = rng.range(30, 42);
      k.add(cylinder(r * 0.96, r * 0.96, h * 0.7, 18), { tone: "light", position: [0, h * 0.35, 0] });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        k.add(block(1.1, h, 1.1), { tone: "mid", position: [Math.cos(a) * r, 0, Math.sin(a) * r] });
      }
      k.add(new THREE.TorusGeometry(r, 0.5, 4, 24), { tone: "mid", position: [0, h, 0], rotation: [Math.PI / 2, 0, 0] });
      k.add(new THREE.TorusGeometry(r, 0.5, 4, 24), { tone: "mid", position: [0, h * 0.55, 0], rotation: [Math.PI / 2, 0, 0] });
      break;
    }
    case "crane": {
      const h = rng.range(48, 70);
      const jib = rng.range(45, 60);
      const side = rng.chance(0.5) ? 1 : -1;
      k.add(block(2.2, h, 2.2), { tone: "mid" });
      k.add(block(jib, 1.8, 1.6), { tone: "mid", position: [(side * jib) / 2 - side * 8, h, 0] });
      k.add(block(12, 1.6, 1.6), { tone: "mid", position: [-side * 12, h, 0] });
      k.add(block(5, 3, 3), { tone: "dark", position: [-side * 16, h - 3, 0] }); // counterweight
      k.add(cone(1.3, 9, 4), { tone: "mid", position: [0, h + 5.4, 0] });
      k.add(block(0.25, h * 0.5, 0.25), { tone: "solid", position: [side * jib * 0.55, h * 0.5, 0] }); // hook line
      k.add(block(3, 2.5, 2.5), { tone: "dark", position: [side * 2.5, h - 3.5, 0] }); // cab
      break;
    }
    case "data-hall": {
      const len = rng.range(140, 260);
      const h = rng.range(15, 20);
      const d = rng.range(40, 60);
      k.add(block(len, h, d), { tone: "pale" });
      const units = Math.floor(len / 14);
      for (let i = 0; i < units; i++) k.add(block(8, 3.2, 8), { tone: "light", position: [-len / 2 + 7 + i * 14, h, d * 0.2] });
      k.add(block(len * 0.3, 7, 12), { tone: "light", position: [len * 0.32, 0, d / 2 + 6] });
      break;
    }
    case "mast": {
      const h = rng.range(110, 190);
      k.add(block(1.6, h, 1.6), { tone: "dark" });
      for (let y = h * 0.3; y < h; y += h * 0.3) k.add(block(6, 0.8, 0.8), { tone: "dark", position: [0, y, 0] });
      k.add(block(2.2, 2.2, 2.2), { tone: "solid", accent: "signal", position: [0, h, 0] });
      k.add(block(1.8, 1.8, 1.8), { tone: "solid", accent: "signal", position: [0, h * 0.6, 0] });
      break;
    }
    case "pylon": {
      const h = rng.range(40, 50);
      // Tapered lattice read as a narrow A with two cross-arms.
      for (const sx of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.35, 0.5, h, 4);
        k.add(leg, { tone: "dark", position: [sx * 3.2, h / 2, 0], rotation: [0, 0, sx * 0.09] });
      }
      k.add(block(20, 0.9, 0.9), { tone: "dark", position: [0, h * 0.72, 0] });
      k.add(block(14, 0.9, 0.9), { tone: "dark", position: [0, h * 0.88, 0] });
      k.add(cone(0.9, 6, 4), { tone: "dark", position: [0, h + 3, 0] });
      break;
    }
    case "turbine": {
      const h = rng.range(80, 100);
      k.add(cylinder(1.6, 2.6, h, 8), { tone: "pale", position: [0, h / 2, 0] });
      k.add(block(3, 3, 9), { tone: "pale", position: [0, h, -1] });
      const a0 = rng.range(0, Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i * Math.PI * 2) / 3;
        const blade = new THREE.BoxGeometry(2.4, 44, 0.8);
        blade.translate(0, 22, 0);
        k.add(blade, { tone: "pale", position: [0, h, 3.8], rotation: [0, 0, a] });
      }
      break;
    }
    case "monolith": {
      k.add(block(14, 90, 14), { tone: "paper" });
      break;
    }
  }
  return k;
}

/** Height of an element (for lamps, labels). */
export function kitHeight(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.max.y;
}
