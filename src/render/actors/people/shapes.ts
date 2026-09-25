/**
 * Geometry primitives for the figure kit: lofted torsos and garments, lathe
 * limbs with rounded joint caps, heads with brow/nose/jaw, mitten hands,
 * lasted shoes, elliptical rings for cuffs, bands and rope coils.
 *
 * Everything returns an indexed BufferGeometry in the local frame of the bone
 * it will be bound to; the rig merges and skins them.
 */
import * as THREE from "three";

export interface Ring {
  y: number;
  /** Half width (x). */
  w: number;
  /** Depth toward +z (front). */
  f: number;
  /** Depth toward -z (back). */
  b: number;
  x?: number;
  z?: number;
  /** Superellipse exponent: 2 = ellipse, 3-4 = boxier (tailoring, armour). */
  p?: number;
  /** Half-angle (radians) of an opening centred on the front (+z). */
  gap?: number;
}

function ringPoint(r: Ring, a: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 2 / (r.p ?? 2);
  const px = Math.sign(c) * Math.pow(Math.abs(c), e);
  const pz = Math.sign(s) * Math.pow(Math.abs(s), e);
  return out.set((r.x ?? 0) + r.w * px, r.y, (r.z ?? 0) + (pz >= 0 ? r.f : r.b) * pz);
}

/**
 * Loft through horizontal rings (bottom to top). `arc` < 1 leaves an opening
 * centred on the front (for open coats, blankets). Caps close the ends with a
 * shallow dome of the given height (0 = flat, negative = no cap).
 */
export function loft(
  rings: Ring[],
  radial = 12,
  opts: { capBottom?: number; capTop?: number; arc?: number; arcCentre?: number } = {},
): THREE.BufferGeometry {
  const arc = opts.arc ?? 1;
  const gapped = rings.some((r) => r.gap !== undefined);
  const closed = arc >= 0.999 && !gapped;
  const cols = closed ? radial : radial + 1;
  // The covered surface is centred on `arcCentre` (default: the back).
  const start = closed ? 0 : (opts.arcCentre ?? -Math.PI / 2) - Math.PI * arc;
  const span = Math.PI * 2 * arc;
  const pos: number[] = [];
  const idx: number[] = [];
  const v = new THREE.Vector3();
  for (const r of rings) {
    // Per-ring front opening (V-necks, open fronts): wrap from one edge of the
    // gap round the back to the other.
    const s0 = gapped ? Math.PI / 2 + (r.gap ?? 0.001) : start;
    const sp = gapped ? Math.PI * 2 - 2 * (r.gap ?? 0.001) : span;
    for (let j = 0; j < cols; j++) {
      const a = s0 + (j / radial) * sp;
      ringPoint(r, a, v);
      pos.push(v.x, v.y, v.z);
    }
  }
  const segs = radial;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const j1 = closed ? (j + 1) % radial : j + 1;
      const a = i * cols + j;
      const b = i * cols + j1;
      const c = (i + 1) * cols + j;
      const d = (i + 1) * cols + j1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const capB = opts.capBottom ?? -1;
  const capT = opts.capTop ?? -1;
  if (capB >= 0 && closed) {
    const r = rings[0]!;
    const ci = pos.length / 3;
    pos.push(r.x ?? 0, r.y - capB, r.z ?? 0);
    for (let j = 0; j < radial; j++) idx.push(ci, j, (j + 1) % radial);
  }
  if (capT >= 0 && closed) {
    const r = rings[rings.length - 1]!;
    const base = (rings.length - 1) * cols;
    const ci = pos.length / 3;
    pos.push(r.x ?? 0, r.y + capT, r.z ?? 0);
    for (let j = 0; j < radial; j++) idx.push(ci, base + ((j + 1) % radial), base + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A limb segment hanging from its joint: y = 0 at the joint, extending to
 * y = -len. `radii` are sampled evenly from the joint to the far end. Rounded
 * caps make joints read as continuous when the segment rotates.
 */
export function limb(
  len: number,
  radii: number[],
  radial = 8,
  opts: { top?: number; bottom?: number; sx?: number; sz?: number; z?: number[]; capsTop?: number; capsBottom?: number } = {},
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const cT = opts.capsTop ?? 2;
  const cB = opts.capsBottom ?? 2;
  const n = radii.length;
  const rb = radii[n - 1]!;
  const rt = radii[0]!;
  const bottom = opts.bottom ?? 0.8;
  const top = opts.top ?? 0.8;
  if (bottom > 0) {
    pts.push(new THREE.Vector2(0, -len - rb * bottom));
    if (cB > 1) pts.push(new THREE.Vector2(rb * 0.8, -len - rb * bottom * 0.62));
  }
  for (let i = n - 1; i >= 0; i--) pts.push(new THREE.Vector2(radii[i]!, -len * (i / (n - 1))));
  if (top > 0) {
    if (cT > 1) pts.push(new THREE.Vector2(rt * 0.8, rt * top * 0.62));
    pts.push(new THREE.Vector2(0, rt * top));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  // Lathe starts at +z; rotate so the seam sits at the back.
  g.rotateY(Math.PI);
  if (opts.sx || opts.sz) g.scale(opts.sx ?? 1, 1, opts.sz ?? 1);
  if (opts.z) {
    // Per-sample forward (+) / backward (-) bulge on the front or back face
    // only, e.g. calves (back) and kneecaps (front).
    const zs = opts.z;
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = THREE.MathUtils.clamp(-y / len, 0, 1) * (zs.length - 1);
      const k = Math.floor(t);
      const f = t - k;
      const bulge = (zs[k] ?? 0) * (1 - f) + (zs[Math.min(k + 1, zs.length - 1)] ?? 0) * f;
      if (bulge > 0 && z > 0) pos.setZ(i, z + bulge * (z / Math.max(1e-4, rt)));
      else if (bulge < 0 && z < 0) pos.setZ(i, z - bulge * (z / Math.max(1e-4, rt)));
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Ellipsoid centred on the origin. */
export function ellipsoid(rx: number, ry: number, rz: number, w = 10, h = 8): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}

/** A torus whose centre line is an ellipse in the XZ plane (cuffs, belts, rope). */
export function ellipseRing(rx: number, rz: number, tube: number, tubular = 16, radial = 5, zBack?: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < tubular; i++) {
    const u = (i / tubular) * Math.PI * 2;
    const rzz = Math.sin(u) < 0 && zBack !== undefined ? zBack : rz;
    P.set(rx * Math.cos(u), 0, rzz * Math.sin(u));
    N.set(Math.cos(u) / Math.max(rx, 1e-4), 0, Math.sin(u) / Math.max(rzz, 1e-4)).normalize();
    for (let j = 0; j < radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      pos.push(P.x + N.x * cv * tube, sv * tube, P.z + N.z * cv * tube);
    }
  }
  for (let i = 0; i < tubular; i++) {
    const i1 = (i + 1) % tubular;
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i1 * radial + j;
      const c = i1 * radial + j1;
      const d = i * radial + j1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Keep only triangles whose centroid passes the predicate. */
export function keepTriangles(geometry: THREE.BufferGeometry, keep: (c: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const outP: number[] = [];
  const outN: number[] = [];
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    c.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
    );
    if (!keep(c)) continue;
    for (let k = 0; k < 3; k++) {
      outP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      if (nrm) outN.push(nrm.getX(i + k), nrm.getY(i + k), nrm.getZ(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(outP, 3));
  if (nrm) out.setAttribute("normal", new THREE.Float32BufferAttribute(outN, 3));
  else out.computeVertexNormals();
  return out;
}

/** Extrude an outline drawn in the (z, y) side plane, `width` across x. */
export function sideProfile(outline: Array<[number, number]>, width: number, bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Extrude an outline drawn in the front (x, y) plane, `depth` along z. */
export function frontProfile(outline: Array<[number, number]>, depth: number, bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Rounded slab (a box with bevelled vertical edges) - bags, cases, pouches. */
export function slab(w: number, h: number, d: number, round = 0.2, radial = 8): THREE.BufferGeometry {
  const r = Math.min(w, d) * round;
  const rings: Ring[] = [
    { y: 0, w: w / 2 - r * 0.3, f: d / 2 - r * 0.3, b: d / 2 - r * 0.3, p: 5 },
    { y: r * 0.3, w: w / 2, f: d / 2, b: d / 2, p: 5 },
    { y: h - r * 0.3, w: w / 2, f: d / 2, b: d / 2, p: 5 },
    { y: h, w: w / 2 - r * 0.3, f: d / 2 - r * 0.3, b: d / 2 - r * 0.3, p: 5 },
  ];
  return loft(rings, radial, { capBottom: 0, capTop: 0 });
}

// ------------------------------------------------------------------ anatomy

/**
 * Head in the head-bone frame: the pivot (atlas) sits at the origin, the face
 * looks down +z. Includes cranium, jaw, brow, eye sockets and chin.
 */
export function headShape(W: number, Hh: number, D: number, detail: number, jaw = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, detail >= 2 ? 16 : detail >= 1 ? 11 : detail >= 0 ? 8 : 6, detail >= 2 ? 12 : detail >= 1 ? 8 : detail >= 0 ? 6 : 4);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Jaw: lower head narrows toward the chin; under the back of the skull
    // there is only neck.
    const t = THREE.MathUtils.clamp((-y - 0.28) / 0.72, 0, 1);
    x *= 1 - 0.3 * t * jaw;
    if (z < 0) z *= 1 - 0.55 * t;
    else z *= 1 - 0.06 * t;
    // Chin: a little forward and square.
    if (y < -0.7 && z > 0) z += 0.1 * (1 - Math.abs(x) * 2);
    // Cranium bulges behind; the face plane is flatter than the skull.
    if (z < 0 && y > -0.3) z *= 1.08;
    if (z > 0.35) z = 0.35 + (z - 0.35) * (0.8 - 0.25 * Math.abs(x));
    // Brow ridge.
    if (z > 0.3 && y > 0.02 && y < 0.3) z += 0.05 * (1 - Math.abs(x) * 1.1) * Math.sin(((y - 0.02) / 0.28) * Math.PI);
    // Eye sockets.
    const ex = Math.abs(Math.abs(x) - 0.36);
    const ey = Math.abs(y + 0.04);
    if (z > 0.2 && ex < 0.22 && ey < 0.14) z -= 0.022 * (1 - ex / 0.22) * (1 - ey / 0.14);
    // Temples.
    if (Math.abs(x) > 0.75 && y > -0.1 && y < 0.4 && z > 0) x *= 0.96;
    pos.setXYZ(i, x * W, y * (Hh / 2), z * D);
  }
  g.computeVertexNormals();
  g.translate(0, Hh * 0.44, D * 0.1);
  return g;
}

/** Nose wedge, placed on the face by the caller. */
export function noseShape(s: number): THREE.BufferGeometry {
  return sideProfile(
    [
      [0, 0.012 * s],
      [0.024 * s, -0.036 * s],
      [0.016 * s, -0.046 * s],
      [0, -0.044 * s],
    ],
    0.026 * s,
  );
}

/**
 * Mitten hand hanging along -y from the wrist: palm faces medially (toward
 * the body, `side` = +1 for the left hand), thumb forward.
 */
export function mittenShape(len: number, width: number, side: 1 | -1, detail: number, fist = 0): THREE.BufferGeometry {
  const radial = detail >= 2 ? 8 : detail >= 1 ? 6 : 4;
  const L = len * (1 - fist * 0.3);
  const palm = new THREE.LatheGeometry(
    detail >= 1
      ? [
          new THREE.Vector2(0, -L),
          new THREE.Vector2(0.72, -L * 0.9),
          new THREE.Vector2(1, -L * 0.5),
          new THREE.Vector2(0.9, -L * 0.12),
          new THREE.Vector2(0, L * 0.06),
        ]
      : [new THREE.Vector2(0, -L), new THREE.Vector2(1, -L * 0.55), new THREE.Vector2(0.8, 0), new THREE.Vector2(0, L * 0.06)],
    radial,
  );
  palm.scale(width * 0.2, 1, width * 0.5);
  // Fingers curl toward the palm.
  const pos = palm.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(-y / L, 0, 1);
    pos.setX(i, pos.getX(i) - side * (t * t * width * (0.16 + fist * 0.4)));
  }
  palm.computeVertexNormals();
  if (detail < 1) return palm;
  const thumb = ellipsoid(width * 0.16, len * 0.24, width * 0.15, 4, 3);
  thumb.translate(0, -len * 0.2, 0);
  thumb.rotateX(0.45);
  thumb.rotateZ(side * 0.3);
  thumb.translate(-side * width * 0.05, -len * 0.12, width * 0.36);
  return mergeIndexed([palm, thumb]);
}

/**
 * A lasted shoe in the foot-bone frame (ankle joint at the origin, toe along
 * +z, sole at y = -ankle). `shaft` raises the heel counter (boots).
 */
export function shoeShape(
  footLen: number,
  footW: number,
  ankle: number,
  heel: number,
  opts: { toe?: number; high?: number; bulk?: number; radial?: number } = {},
): THREE.BufferGeometry {
  const bulk = opts.bulk ?? 1;
  const w = footW * 0.5 * bulk;
  const toeZ = footLen - heel;
  const sole = -ankle;
  const hi = opts.high ?? 0;
  const toe = opts.toe ?? 1;
  // Rings along z (built along y, then rotated so y -> z). f = below axis, b = above.
  const axisY = sole + ankle * 0.45;
  const below = axisY - sole;
  const rings: Ring[] = [
    { y: -heel - 0.012, w: w * 0.62, f: below * 0.9, b: ankle * 0.4 + hi * 0.5, p: 2.4 },
    { y: -heel + 0.012, w: w * 0.86, f: below, b: ankle * 0.85 + hi, p: 2.6 },
    { y: toeZ * 0.12, w: w * 0.92, f: below, b: ankle * 0.95 + hi, p: 2.6 },
    { y: toeZ * 0.42, w: w * 0.98, f: below, b: ankle * 0.7, p: 2.8 },
    { y: toeZ * 0.72, w: w * 1.02 * toe, f: below, b: ankle * 0.5 * bulk, p: 3 },
    { y: toeZ * 0.9, w: w * 0.86 * toe, f: below * 0.96, b: ankle * 0.4 * bulk, p: 2.8 },
    { y: toeZ * 1.02, w: w * 0.42 * toe, f: below * 0.75, b: ankle * 0.22 * bulk, p: 2.4 },
  ];
  const r = opts.radial ?? 10;
  const use = r <= 5 ? [rings[0]!, rings[2]!, rings[4]!, rings[6]!] : r <= 8 ? [rings[0]!, rings[1]!, rings[3]!, rings[4]!, rings[6]!] : rings;
  const g = loft(use, r, { capBottom: 0.004, capTop: 0.012 });
  // y -> +z, ring front (+z) -> -y (below), ring back -> +y (above)
  g.rotateX(Math.PI / 2);
  g.translate(0, axisY, 0);
  // Flat sole with a little toe spring.
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const spring = Math.max(0, (z - toeZ * 0.78) / (toeZ * 0.25)) * 0.012;
    if (pos.getY(i) < sole + spring) pos.setY(i, sole + spring);
  }
  g.computeVertexNormals();
  return g;
}

export function mergeIndexed(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    return g;
  });
  let count = 0;
  for (const f of flat) count += f.getAttribute("position").count;
  const P = new Float32Array(count * 3);
  const N = new Float32Array(count * 3);
  let o = 0;
  for (const f of flat) {
    P.set(f.getAttribute("position").array as Float32Array, o * 3);
    N.set(f.getAttribute("normal").array as Float32Array, o * 3);
    o += f.getAttribute("position").count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  return g;
}

/** Deterministic hash noise for cloth wrinkles without an Rng. */
export function hash3(x: number, y: number, z: number, seed: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

/** Push vertices along their normals by a smooth-ish noise (cloth, hair). */
export function rumple(g: THREE.BufferGeometry, amount: number, seed: number, freq = 30): THREE.BufferGeometry {
  const geo = g.index ? g : g;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      Math.sin(x * freq + seed) * Math.sin(y * freq * 0.7 + seed * 1.3) * Math.sin(z * freq * 0.9 + seed * 0.7) +
      hash3(Math.round(x * 200), Math.round(y * 200), Math.round(z * 200), seed) * 0.3;
    pos.setXYZ(i, x + nrm.getX(i) * n * amount, y + nrm.getY(i) * n * amount, z + nrm.getZ(i) * n * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Give an open surface (a garment panel, a hem, a collar) a thin inward wall
 * along every boundary edge. The wall meets the surface at a right angle, so
 * the contour pass draws the garment's edge as a pen line instead of losing
 * it in a 5 mm step it cannot see.
 */
export function rimmed(geometry: THREE.BufferGeometry, depth: number): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const n = pos.count;
  const q = (i: number) => `${Math.round(pos.getX(i) * 2e4)},${Math.round(pos.getY(i) * 2e4)},${Math.round(pos.getZ(i) * 2e4)}`;
  const keys: string[] = new Array(n);
  for (let i = 0; i < n; i++) keys[i] = q(i);
  const edges = new Map<string, { a: number; b: number; c: number }>();
  for (let t = 0; t < n; t += 3) {
    for (const [i, j] of [
      [t, t + 1],
      [t + 1, t + 2],
      [t + 2, t],
    ] as const) {
      const ka = keys[i]!;
      const kb = keys[j]!;
      if (ka === kb) continue;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(k);
      if (e) e.c++;
      else edges.set(k, { a: i, b: j, c: 1 });
    }
  }
  const P: number[] = Array.from(pos.array as Float32Array);
  const N: number[] = Array.from(nrm.array as Float32Array);
  const A = new THREE.Vector3();
  const Bv = new THREE.Vector3();
  const A2 = new THREE.Vector3();
  const B2 = new THREE.Vector3();
  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  const fn = new THREE.Vector3();
  const push = (v: THREE.Vector3) => {
    P.push(v.x, v.y, v.z);
    N.push(fn.x, fn.y, fn.z);
  };
  for (const e of edges.values()) {
    if (e.c !== 1) continue;
    A.fromBufferAttribute(pos, e.a);
    Bv.fromBufferAttribute(pos, e.b);
    na.fromBufferAttribute(nrm, e.a).normalize();
    nb.fromBufferAttribute(nrm, e.b).normalize();
    A2.copy(A).addScaledVector(na, -depth);
    B2.copy(Bv).addScaledVector(nb, -depth);
    fn.subVectors(Bv, A).cross(na).normalize();
    push(A);
    push(A2);
    push(Bv);
    push(Bv);
    push(A2);
    push(B2);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  return out;
}
