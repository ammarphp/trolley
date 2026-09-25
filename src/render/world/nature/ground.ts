/**
 * Ground cover: grass tufts, wildflowers and reeds (pen flicks: solid ink
 * blades, no contours, wind sway), and crop strips that tile into fields.
 */
import * as THREE from "three";
import { Kit, cylinder } from "../../core/geometry.ts";
import { createRng, type Rng } from "../../core/rng.ts";
import { leafCards, mergeParts, withSolidUv } from "./plant.ts";
import { TAU, blade, blob, lerp, polygon, taperTube, v3 } from "./shapes.ts";

export const GRASS_VARIANTS = ["meadow tuft", "tussock", "seed heads", "wiry", "dock", "dry tuft"] as const;
export const FLOWER_VARIANTS = ["cow parsley", "poppies", "buttercups", "ox-eye daisies", "foxglove", "clover"] as const;
export const REED_VARIANTS = ["reed bed", "bulrushes", "sedge", "yellow flag"] as const;
export const CROP_VARIANTS = ["ripe wheat", "young cereal", "maize", "ploughed furrows", "stubble", "cabbages"] as const;
/** Crop strips tile every 8 m along X (rows) and 6 m across Z. */
export const CROP_TILE: [number, number] = [8, 6];

const mod = (v: number, n: number) => ((v % n) + n) % n;

/**
 * A tuft of pen flicks. Most blades are solid ink; a share are drawn at
 * "dark" so the fine hatch breaks them up, which keeps a field of tufts light.
 */
function tuft(k: Kit, rng: Rng, count: number, h: [number, number], w: number, bend: [number, number], spread = 0.08, tone: "solid" | "deep" | "dark" = "solid"): void {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU);
    const r = Math.sqrt(rng.next()) * spread;
    const base = v3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const lean = v3(Math.cos(a + rng.range(-0.6, 0.6)), 0, Math.sin(a + rng.range(-0.6, 0.6)));
    const t = tone === "solid" && i % 3 === 2 ? "dark" : tone;
    k.add(blade(base, lean, rng.range(h[0], h[1]), w * rng.range(0.8, 1.2), rng.range(bend[0], bend[1])), { tone: t });
  }
}

export function buildGrass(variant: number): THREE.BufferGeometry {
  const v = mod(variant, GRASS_VARIANTS.length);
  const rng = createRng(`nature:grass:${variant}`);
  const k = new Kit();
  switch (GRASS_VARIANTS[v]) {
    case "meadow tuft":
      tuft(k, rng, 11, [0.16, 0.32], 0.013, [0.2, 0.6], 0.06);
      break;
    case "tussock":
      tuft(k, rng, 16, [0.32, 0.55], 0.015, [0.4, 0.9], 0.1);
      break;
    case "seed heads": {
      tuft(k, rng, 7, [0.15, 0.28], 0.013, [0.2, 0.5], 0.05);
      for (let i = 0; i < 4; i++) {
        const a = rng.range(0, TAU);
        const top = v3(Math.cos(a) * 0.12, rng.range(0.55, 0.8), Math.sin(a) * 0.12);
        const mid = top.clone().multiplyScalar(0.5).add(v3(0, 0.05, 0));
        k.add(taperTube([v3(), mid, top], 0.006, 0.004, { radial: 3, segments: 2 }), { tone: "solid" });
        const head = blob(0.022, { detail: 3, stretch: [0.7, 3.4, 0.7], lump: 0.1 });
        head.rotateZ(rng.range(-0.3, 0.3));
        k.add(head, { tone: "dark", position: [top.x, top.y + 0.06, top.z] });
      }
      break;
    }
    case "wiry":
      tuft(k, rng, 6, [0.16, 0.36], 0.011, [0.0, 0.2], 0.05);
      break;
    case "dock": {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + rng.range(-0.3, 0.3);
        const d = v3(Math.cos(a), 0, Math.sin(a));
        const side = v3(-d.z, 0, d.x);
        const len = rng.range(0.28, 0.4);
        const pts = [
          v3(0, 0.02, 0),
          d.clone().multiplyScalar(len * 0.3).addScaledVector(side, 0.06).add(v3(0, 0.12, 0)),
          d.clone().multiplyScalar(len).add(v3(0, 0.2, 0)),
          d.clone().multiplyScalar(len * 0.3).addScaledVector(side, -0.06).add(v3(0, 0.1, 0)),
        ];
        k.add(polygon(pts), { tone: "deep" });
      }
      k.add(taperTube([v3(), v3(0.02, 0.4, 0), v3(0, 0.85, 0.02)], 0.012, 0.004, { radial: 3, segments: 2 }), { tone: "solid" });
      for (let y = 0.5; y < 0.85; y += 0.06) k.add(blob(0.025, { detail: 3 }), { tone: "solid", position: [rng.range(-0.03, 0.03), y, rng.range(-0.03, 0.03)] });
      break;
    }
    case "dry tuft":
      tuft(k, rng, 9, [0.08, 0.2], 0.015, [0.5, 1.1], 0.08, "dark");
      break;
  }
  return k.build();
}

function stem(k: Kit, base: THREE.Vector3, top: THREE.Vector3, r = 0.006): void {
  const mid = base.clone().lerp(top, 0.5).add(v3((top.x - base.x) * 0.2, 0, (top.z - base.z) * 0.2));
  k.add(taperTube([base, mid, top], r, r * 0.7, { radial: 3, segments: 2 }), { tone: "solid" });
}

export function buildFlowers(variant: number): THREE.BufferGeometry {
  const v = mod(variant, FLOWER_VARIANTS.length);
  const rng = createRng(`nature:flowers:${variant}`);
  const k = new Kit();
  const kind = FLOWER_VARIANTS[v]!;
  // A little foliage at the foot of every clump.
  tuft(k, rng, 6, [0.12, 0.22], 0.02, [0.3, 0.7], 0.1);
  switch (kind) {
    case "cow parsley": {
      for (let i = 0; i < rng.int(3, 5); i++) {
        const a = rng.range(0, TAU);
        const top = v3(Math.cos(a) * rng.range(0.05, 0.25), rng.range(0.7, 1.05), Math.sin(a) * rng.range(0.05, 0.25));
        stem(k, v3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04), top, 0.008);
        // The umbel: a flat lace head with its spokes beneath.
        const umbel = cylinder(0.11, 0.06, 0.03, 9);
        k.add(umbel, { tone: "paper", position: [top.x, top.y + 0.05, top.z] });
        for (let s = 0; s < 6; s++) {
          const sa = (s / 6) * TAU;
          k.add(taperTube([top, top.clone().add(v3(Math.cos(sa) * 0.08, 0.05, Math.sin(sa) * 0.08))], 0.004, 0.003, { radial: 3, segments: 1 }), { tone: "solid" });
        }
      }
      break;
    }
    case "poppies":
    case "buttercups":
    case "ox-eye daisies": {
      const n = kind === "buttercups" ? rng.int(6, 9) : rng.int(3, 5);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, TAU);
        const h = kind === "buttercups" ? rng.range(0.25, 0.42) : rng.range(0.4, 0.65);
        const top = v3(Math.cos(a) * rng.range(0.03, 0.2), h, Math.sin(a) * rng.range(0.03, 0.2));
        stem(k, v3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03), top);
        if (kind === "poppies") {
          const cup = blob(0.045, { detail: 3, stretch: [1, 0.7, 1], lump: 0.15 });
          k.add(cup, { tone: "paper", accent: "signal", position: [top.x, top.y + 0.02, top.z] });
          k.add(blob(0.012, { detail: 3 }), { tone: "solid", position: [top.x, top.y + 0.05, top.z] });
        } else if (kind === "buttercups") {
          k.add(blob(0.022, { detail: 3, stretch: [1, 0.6, 1] }), { tone: "paper", accent: "amber", position: [top.x, top.y + 0.01, top.z] });
        } else {
          const petals = cylinder(0.05, 0.05, 0.008, 10);
          petals.rotateX(rng.range(-0.5, 0.5));
          k.add(petals, { tone: "paper", position: [top.x, top.y + 0.01, top.z] });
          k.add(blob(0.016, { detail: 3, stretch: [1, 0.6, 1] }), { tone: "paper", accent: "amber", position: [top.x, top.y + 0.02, top.z] });
        }
      }
      break;
    }
    case "foxglove": {
      for (let i = 0; i < 2; i++) {
        const a = rng.range(0, TAU);
        const top = v3(Math.cos(a) * 0.1, rng.range(0.9, 1.25), Math.sin(a) * 0.1);
        const base = v3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03);
        stem(k, base, top, 0.01);
        for (let y = top.y * 0.45; y < top.y - 0.04; y += 0.065) {
          const t = y / top.y;
          const p = base.clone().lerp(top, t);
          const bell = cylinder(0.012, 0.028, 0.06, 6, true);
          bell.rotateX(Math.PI * 0.62);
          bell.rotateY(rng.range(0, TAU));
          k.add(bell, { tone: "deep", position: [p.x, p.y, p.z] });
        }
      }
      break;
    }
    case "clover": {
      for (let i = 0; i < 9; i++) {
        const a = rng.range(0, TAU);
        const p = v3(Math.cos(a) * rng.range(0, 0.18), rng.range(0.06, 0.14), Math.sin(a) * rng.range(0, 0.18));
        for (let j = 0; j < 3; j++) {
          const la = (j / 3) * TAU + a;
          const leaf = blob(0.022, { detail: 4, stretch: [1, 0.25, 1] });
          k.add(leaf, { tone: "paper", accent: i < 3 ? "leaf" : "none", position: [p.x + Math.cos(la) * 0.022, p.y, p.z + Math.sin(la) * 0.022] });
        }
        stem(k, v3(p.x * 0.5, 0, p.z * 0.5), p, 0.004);
      }
      break;
    }
  }
  return k.build();
}

export function buildReeds(variant: number): THREE.BufferGeometry {
  const v = mod(variant, REED_VARIANTS.length);
  const rng = createRng(`nature:reeds:${variant}`);
  const k = new Kit();
  switch (REED_VARIANTS[v]) {
    case "reed bed": {
      tuft(k, rng, 22, [1.2, 2.0], 0.03, [0.1, 0.35], 0.35);
      for (let i = 0; i < 7; i++) {
        const a = rng.range(0, TAU);
        const top = v3(Math.cos(a) * rng.range(0.05, 0.3), rng.range(1.9, 2.4), Math.sin(a) * rng.range(0.05, 0.3));
        stem(k, v3(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08), top, 0.009);
        // The plume: a nodding feathery panicle.
        const plume = blob(0.07, { detail: 3, stretch: [0.8, 2.6, 0.8], lump: 0.3 });
        plume.rotateZ(rng.range(0.3, 0.7) * (rng.chance(0.5) ? 1 : -1));
        k.add(plume, { tone: "deep", position: [top.x, top.y + 0.1, top.z] });
      }
      break;
    }
    case "bulrushes": {
      tuft(k, rng, 14, [0.9, 1.6], 0.04, [0.05, 0.25], 0.25);
      for (let i = 0; i < 5; i++) {
        const a = rng.range(0, TAU);
        const top = v3(Math.cos(a) * rng.range(0.03, 0.2), rng.range(1.4, 1.9), Math.sin(a) * rng.range(0.03, 0.2));
        stem(k, v3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), top, 0.01);
        // The cat's-tail: a solid ink cigar with a spike above.
        k.add(cylinder(0.032, 0.032, 0.24, 7), { tone: "solid", position: [top.x, top.y - 0.12, top.z] });
        k.add(taperTube([top, top.clone().add(v3(0, 0.18, 0))], 0.006, 0.002, { radial: 3, segments: 1 }), { tone: "solid" });
      }
      break;
    }
    case "sedge":
      tuft(k, rng, 26, [0.45, 0.8], 0.02, [0.5, 1.0], 0.18);
      break;
    case "yellow flag": {
      // Sword leaves and a few amber irises: the only pigment in a reed bed.
      tuft(k, rng, 12, [0.7, 1.1], 0.05, [0.0, 0.15], 0.2);
      for (let i = 0; i < 3; i++) {
        const a = rng.range(0, TAU);
        const top = v3(Math.cos(a) * 0.12, rng.range(0.85, 1.05), Math.sin(a) * 0.12);
        stem(k, v3(), top, 0.008);
        k.add(blob(0.04, { detail: 3, stretch: [1, 0.8, 1], lump: 0.3 }), { tone: "paper", accent: "amber", position: [top.x, top.y + 0.03, top.z] });
      }
      break;
    }
  }
  return k.build();
}

// ------------------------------------------------------------------ crops

/**
 * A flat-topped block surface cut by `grooves` V-grooves along X (tramlines):
 * their steep sides trip the crease detector, so each groove is drawn as a
 * clean double pen line converging with the track, and nothing else is.
 */
function groovedTop(L: number, D: number, grooves: number, h: number, depth: number, width: number): THREE.BufferGeometry {
  const zs: Array<[number, number]> = [[-D / 2, h]];
  for (let i = 0; i < grooves; i++) {
    const zc = -D / 2 + ((i + 0.5) / grooves) * D;
    zs.push([zc - width / 2, h], [zc, h - depth], [zc + width / 2, h]);
  }
  zs.push([D / 2, h]);
  const pos: number[] = [];
  for (let j = 0; j + 1 < zs.length; j++) {
    const [z0, y0] = zs[j]!;
    const [z1, y1] = zs[j + 1]!;
    const a = [-L / 2, y0, z0],
      b = [L / 2, y0, z0],
      c = [L / 2, y1, z1],
      d = [-L / 2, y1, z1];
    pos.push(...a, ...d, ...c, ...a, ...c, ...b);
  }
  // End caps (field cut faces).
  for (const x of [-L / 2, L / 2]) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const [z0, y0] = zs[j]!;
      const [z1, y1] = zs[j + 1]!;
      const q = [
        [x, y0, z0],
        [x, 0, z0],
        [x, 0, z1],
        [x, y1, z1],
      ];
      const order = x < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const o of order) pos.push(...q[o]!);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A corrugated surface: `rows` ridges along X across depth D, with a jagged ear line. */
function ridgedField(L: number, D: number, rows: number, h: number, ridge: number, rng: Rng, opts: { segs?: number; jag?: number; sides?: boolean } = {}): THREE.BufferGeometry {
  const segs = opts.segs ?? 16;
  const jag = opts.jag ?? 0;
  const pos: number[] = [];
  const idx: number[] = [];
  const nz = rows * 2;
  // Grid of (segs+1) x (nz+1): alternate crest/trough across Z.
  for (let i = 0; i <= segs; i++) {
    const x = -L / 2 + (i / segs) * L;
    for (let j = 0; j <= nz; j++) {
      const z = -D / 2 + (j / nz) * D;
      const crest = j % 2 === 1;
      let y = crest ? h + ridge : h;
      if (crest && jag > 0) y += (rng.next() - 0.5) * jag;
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j;
      const b = (i + 1) * (nz + 1) + j;
      idx.push(a, a + 1, b + 1, a, b + 1, b);
    }
  }
  // End caps at x = +-L/2 close each row: inside a tiled field they sit
  // back to back, hidden under the top; at the field's end they make the cut face.
  if (opts.sides) {
    for (const e of [0, segs]) {
      const x = -L / 2 + (e / segs) * L;
      const base = pos.length / 3;
      for (let j = 0; j <= nz; j++) pos.push(x, pos[(e * (nz + 1) + j) * 3 + 1]!, -D / 2 + (j / nz) * D);
      for (let j = 0; j <= nz; j++) pos.push(x, 0, -D / 2 + (j / nz) * D);
      for (let j = 0; j < nz; j++) {
        const a = base + j,
          b = base + j + 1,
          c = base + nz + 1 + j,
          d = base + nz + 2 + j;
        if (e === 0) idx.push(a, c, d, a, d, b);
        else idx.push(a, d, c, a, b, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export function buildCrop(variant: number): THREE.BufferGeometry {
  const v = mod(variant, CROP_VARIANTS.length);
  const rng = createRng(`nature:crop:${variant}`);
  const [L, D] = CROP_TILE;
  const k = new Kit();
  const cards: THREE.BufferGeometry[] = [];
  switch (CROP_VARIANTS[v]) {
    case "ripe wheat": {
      // A standing block of wheat: a pale top whose drill rows run with the
      // line as fine converging pen lines, stalky side faces, a serrated ear
      // line, and capped ends so a tiled field reads as one cut block.
      // One tramline per strip: the only lines on an otherwise sunlit top.
      k.add(groovedTop(L, D, 1, 0.86, 0.1, 0.22), { tone: "paper" });
      for (const side of [1, -1]) {
        const face = new THREE.PlaneGeometry(L, 0.84, 1, 1);
        face.translate(0, 0.42, 0);
        if (side < 0) face.rotateY(Math.PI);
        face.translate(0, 0, (side * D) / 2);
        k.add(face, { tone: "light" });
        // Ears standing proud along the edge.
        for (let x = -L / 2 + 0.06; x < L / 2 - 0.03; x += rng.range(0.09, 0.15)) {
          const ear = blob(0.026, { detail: 4, stretch: [0.7, 3.4, 0.7], lump: 0.1 });
          ear.rotateX(side * rng.range(0.05, 0.35));
          ear.rotateZ(rng.range(-0.2, 0.2));
          k.add(ear, { tone: "mid", position: [x, rng.range(0.88, 0.95), side * (D / 2 - 0.02)] });
        }
      }
      break;
    }
    case "young cereal":
      // Drill rows as fine converging lines, the shoots as sparse pen flicks.
      k.add(ridgedField(L, D, Math.round(D / 0.375), 0.0, 0.1, rng, { segs: 4 }), { tone: "paper" });

      break;
    case "maize": {
      // Two rows of maize drawn as alpha-cut stands (see the atlas), with
      // normals pointing up so the field is sunlit and drawn by its outline.
      const crown = { c: v3(0, -6, 0), r: v3(1e4, 8, 1e4), blend: 1 };
      for (let r = 0; r < Math.round(D / 1.5); r++) {
        const z = -D / 2 + ((r + 0.5) / Math.round(D / 1.5)) * D;
        for (let x = -L / 2 + 0.5; x < L / 2; x += 1) {
          const g = leafCards(
            { c: v3(x + rng.range(-0.08, 0.08), 0, z + rng.range(-0.1, 0.1)), r: 0.62, kind: "maize", seed: rng.range(0, 1000), cards: 2, stretch: [1, 1, 1], aspect: 2.4 / 1.24, flatCard: false, keep: 1, tone: "paper", yaw: rng.range(-0.25, 0.25), yawSpread: 1.2, base: true },
            crown,
          );
          if (g) cards.push(g);
        }
      }
      k.add(ridgedField(L, D, Math.round(D / 1.5), 0.0, 0.12, rng, { segs: 4 }), { tone: "pale" });
      break;
    }
    case "ploughed furrows":
      k.add(ridgedField(L, D, Math.round(D / 0.6), -0.03, 0.14, rng, { segs: 4 }), { tone: "pale" });
      break;
    case "stubble":
      const srows = Math.round(D / 0.5);
      k.add(ridgedField(L, D, srows, 0.0, 0.12, rng, { segs: 4 }), { tone: "paper" });
      for (let i = 0; i < 12; i++) {
        const x = rng.range(-L / 2, L / 2);
        const row = rng.int(0, srows - 1);
        const z = -D / 2 + ((row * 2 + 1) / (srows * 2)) * D;
        k.add(blade(v3(x, 0.1, z), v3(1, 0, 0), rng.range(0.06, 0.1), 0.02, 0.05), { tone: "dark" });
      }
      break;
    case "cabbages": {
      const crows = Math.round(D / 1);
      k.add(ridgedField(L, D, crows, 0.0, 0.16, rng, { segs: 4 }), { tone: "pale" });
      for (let r = 0; r < crows; r++) {
        const z = -D / 2 + ((r * 2 + 1) / (crows * 2)) * D;
        for (let x = -L / 2 + 0.45; x < L / 2; x += rng.range(0.85, 1.0)) {
          // A cabbage: a scalloped head, sitting a little proud of its ridge.
          k.add(blob(0.27, { detail: 3, lump: 0.14, flatBottom: 0.45, flatTop: 0.8, seed: x * 7 + r }), { tone: "paper", position: [x, 0.24, z] });
        }
      }
      break;
    }
  }
  if (!cards.length) return k.build();
  return mergeParts([withSolidUv(k.build()), ...cards]);
}

export { lerp };
