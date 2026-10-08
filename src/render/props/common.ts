/**
 * Shared kit for props, documents, signs and trackside furniture.
 *
 * Every builder here composes a merged `Kit` body (one draw call, per-part
 * albedo in `inkAttr`) plus, where a surface must carry printing, a few
 * textured planes drawn with `createInkCanvas` (see print.ts). The root is a
 * Group whose origin sits at the base centre with the object's face toward
 * +Z (toward the trolley when staged).
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit, type PartOptions } from "../core/geometry.ts";
import { inkMaterial, type InkMaterialOptions } from "../core/ink-material.ts";

export type V3 = [number, number, number];

/** Standard gauge between rail centres (m). */
export const GAUGE = 1.435;
/** Rail-top height above formation in the shared track model (bed + sleeper + rail). */
export const RAIL_TOP = 0.63;
/** Width of the rail head (m). */
export const RAIL_HEAD = 0.07;

export const DEG = Math.PI / 180;

/** Hatch periods (metres, object space at 1x) by size class. */
export const HATCH = {
  /** Hand-held things: cups, keys, jars, papers. */
  tiny: 0.013,
  /** Boxes, cases, cylinders up to about half a metre. */
  small: 0.02,
  /** Furniture: benches, wheelchairs, tanks. */
  large: 0.03,
  /** Trackside structures in world space: posts, signals, buffer stops. */
  trackside: 0.055,
} as const;

/**
 * Object ids separate touching objects in the contour pass. Props take a band
 * of ids of their own so a cup on a rail, or a label on a box, draws its line.
 */
export const OBJECT_ID = {
  prop: 0.52,
  print: 0.61,
  document: 0.66,
  trackside: 0.72,
  lamp: 0.77,
} as const;

// ------------------------------------------------------------------ materials

/**
 * Props hatch in object space (they are knocked about) and take a little less
 * shading than scenery, so a white cup or page stays white enough to read as
 * a shape against dark ballast at 20-40 m.
 */
export function propMaterial(hatch: number, objectId: number = OBJECT_ID.prop, extra: Partial<InkMaterialOptions> = {}): THREE.MeshLambertMaterial {
  return inkMaterial({ vertexInk: true, hatchSpace: "object", hatch, objectId, shade: 0.72, ...extra });
}

export function tracksideMaterial(hatch: number = HATCH.trackside, objectId: number = OBJECT_ID.trackside, extra: Partial<InkMaterialOptions> = {}): THREE.MeshLambertMaterial {
  return inkMaterial({ vertexInk: true, hatchSpace: "world", hatch, objectId, ...extra });
}

// ------------------------------------------------------------------ assembly

/**
 * Collects merged parts and textured extras for one object. `build()` returns
 * a Group holding one merged mesh (one draw call) plus any printed surfaces.
 */
export class Assembly {
  readonly kit = new Kit();
  readonly extras: THREE.Object3D[] = [];
  readonly material: THREE.Material;
  readonly name: string;
  constructor(material: THREE.Material, name: string) {
    this.material = material;
    this.name = name;
  }

  add(geometry: THREE.BufferGeometry, opts: PartOptions = {}): this {
    this.kit.add(geometry, opts);
    return this;
  }

  /** Attach an already-built mesh (a printed surface, a switchable lamp). */
  attach(object: THREE.Object3D | null | undefined): this {
    if (object) this.extras.push(object);
    return this;
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    group.name = this.name;
    if (!this.kit.empty) {
      const mesh = new THREE.Mesh(this.kit.build(), this.material);
      mesh.name = `${this.name}:body`;
      group.add(mesh);
    }
    for (const e of this.extras) group.add(e);
    return group;
  }
}

/** Measure the merged triangle count of a built object (for budgets and the lab). */
export function triangleCount(object: THREE.Object3D): number {
  let n = 0;
  object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    n += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
  });
  return Math.round(n);
}

export function drawCalls(object: THREE.Object3D): number {
  let n = 0;
  object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
}

// ------------------------------------------------------------------ primitives

const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder (or frustum) along +Y from y0 to y1. */
export function rodY(r0: number, y0: number, y1: number, seg = 10, r1 = r0, open = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(y1 - y0), seg, 1, open);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** Cylinder between two points; radius r0 at `a`, r1 at `b`. */
export function rod(a: V3, b: V3, r0: number, seg = 8, r1 = r0, open = false): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = Math.max(1e-5, dir.length());
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

/**
 * A rectangular bar from `a` to `b`: `w` across (perpendicular to `up`) and
 * `t` thick (along `up` projected off the bar's axis).
 */
export function beam(a: V3, b: V3, w: number, t: number, up: V3 = [0, 1, 0]): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const along = B.clone().sub(A);
  const len = Math.max(1e-5, along.length());
  along.normalize();
  let side = new THREE.Vector3(...up).cross(along);
  if (side.lengthSq() < 1e-8) side = new THREE.Vector3(1, 0, 0).cross(along);
  side.normalize();
  const upv = along.clone().cross(side).normalize();
  const g = new THREE.BoxGeometry(w, len, t);
  const m = new THREE.Matrix4().makeBasis(side, along, upv);
  m.setPosition(A.clone().add(B).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

/** Chamfered box centred on the origin. `c` is the chamfer width. */
export function cbox(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const cc = Math.max(1e-4, Math.min(c, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const x = w / 2 - cc;
  const y = h / 2 - cc;
  const s = Math.min(cc, x * 0.9, y * 0.9);
  const shape = new THREE.Shape([
    new THREE.Vector2(-x + s, -y),
    new THREE.Vector2(x - s, -y),
    new THREE.Vector2(x, -y + s),
    new THREE.Vector2(x, y - s),
    new THREE.Vector2(x - s, y),
    new THREE.Vector2(-x + s, y),
    new THREE.Vector2(-x, y - s),
    new THREE.Vector2(-x, -y + s),
  ]);
  const depth = Math.max(1e-4, d - 2 * cc);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: cc, bevelSize: cc, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** Chamfered box sitting on y = 0. */
export function cblock(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const g = cbox(w, h, d, c);
  g.translate(0, h / 2, 0);
  return g;
}

/** Box sitting on y = 0 (no chamfer). */
export function slab(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/**
 * A superellipsoid: e = 1 is an ellipsoid, e -> 0.2 approaches a box with
 * softly rounded edges. Good for sacks, cushions, bags and plush.
 */
export function blob(rx: number, ry: number, rz: number, e = 1, ew = e, ws = 16, hs = 12): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const pw = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    pos.setXYZ(i, pw(x, ew) * rx, pw(y, e) * ry, pw(z, ew) * rz);
  }
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const w = mergeVertices(g, 1e-6);
  w.computeVertexNormals();
  return w;
}

/** A torus lying flat (ring in the XZ plane, axis Y). */
export function ring(R: number, r: number, radial = 6, tubular = 24, arc = Math.PI * 2): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(R, r, radial, tubular, arc);
  g.rotateX(Math.PI / 2);
  return g;
}

/** A torus standing upright (ring in the XY plane, axis Z). */
export function hoop(R: number, r: number, radial = 6, tubular = 24, arc = Math.PI * 2): THREE.BufferGeometry {
  return new THREE.TorusGeometry(R, r, radial, tubular, arc);
}

/** Tube through points (Catmull-Rom). */
export function wire(points: V3[], r: number, segments = 16, radial = 5, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    closed,
    "centripetal",
  );
  return new THREE.TubeGeometry(curve, segments, r, radial, closed);
}

/**
 * Turned (lathe) surface from [radius, y] pairs, bottom to top. Unlike
 * LatheGeometry, corners sharper than `crease` keep hard normals so rims,
 * lids and beads draw a contour line; gentle curves stay smooth.
 */
export function turned(profile: Array<[number, number]>, seg = 24, crease = 38 * DEG, arc = Math.PI * 2, phase = 0): THREE.BufferGeometry {
  const pts = profile.filter((p, i) => i === 0 || Math.hypot(p[0] - profile[i - 1]![0], p[1] - profile[i - 1]![1]) > 1e-7);
  const segN: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dr = pts[i + 1]![0] - pts[i]![0];
    const dy = pts[i + 1]![1] - pts[i]![1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  const smoothAt = (i: number): boolean => {
    if (i <= 0 || i >= pts.length - 1) return false;
    const a = segN[i - 1]!,
      b = segN[i]!;
    return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) < crease;
  };
  const avg = (i: number): [number, number] => {
    const a = segN[i - 1]!,
      b = segN[i]!;
    const x = a[0] + b[0],
      y = a[1] + b[1];
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]!,
      p1 = pts[i + 1]!;
    const n0 = smoothAt(i) ? avg(i) : segN[i]!;
    const n1 = smoothAt(i + 1) ? avg(i + 1) : segN[i]!;
    const base = positions.length / 3;
    for (let j = 0; j <= seg; j++) {
      const t = phase + (j / seg) * arc;
      const s = Math.sin(t),
        c = Math.cos(t);
      positions.push(p0[0] * s, p0[1], p0[0] * c, p1[0] * s, p1[1], p1[0] * c);
      normals.push(n0[0] * s, n0[1], n0[0] * c, n1[0] * s, n1[1], n1[0] * c);
    }
    for (let j = 0; j < seg; j++) {
      const a = base + j * 2,
        b = base + j * 2 + 1,
        cI = base + (j + 1) * 2,
        d = base + (j + 1) * 2 + 1;
      index.push(a, cI, b, b, cI, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
}

/**
 * Extrude a 2D outline (x, y) along Z by `depth`, centred on z = 0, with an
 * optional chamfer. Holes cut through.
 */
export function plate(outline: Array<[number, number]>, depth: number, bevel = 0, holes: Array<Array<[number, number]>> = [], curveSegments = 8): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const d = Math.max(1e-4, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments,
  });
  g.translate(0, 0, -d / 2);
  g.computeVertexNormals();
  return g;
}

/** Points on a rounded rectangle outline (centred), for `plate`. */
export function roundRect(w: number, h: number, r: number, steps = 3): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const rr = Math.min(r, w / 2, h / 2);
  const corners: Array<[number, number, number]> = [
    [w / 2 - rr, -h / 2 + rr, -Math.PI / 2],
    [w / 2 - rr, h / 2 - rr, 0],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -h / 2 + rr, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return out;
}

/** Circle outline points. */
export function circle(r: number, n = 20, cx = 0, cy = 0): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/**
 * A sheet of card or paper lying in XZ (thickness along Y, base on y = 0),
 * subdivided so it can curl. `warp(x, z)` returns a Y lift.
 */
export function sheet(w: number, d: number, t: number, segX = 1, segZ = 1, warp?: (x: number, z: number) => number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, t, d, segX, 1, segZ);
  g.translate(0, t / 2, 0);
  if (warp) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + warp(pos.getX(i), pos.getZ(i)));
    g.deleteAttribute("normal");
    g.computeVertexNormals();
  }
  return g;
}

/** Apply a transform to a geometry in place and return it. */
export function place(g: THREE.BufferGeometry, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: number | V3 = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    typeof scale === "number" ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  return g;
}

/** Bend a geometry around the Y axis so it hugs a cylinder of radius R (x becomes arc length). */
export function wrapCylinder(g: THREE.BufferGeometry, R: number): THREE.BufferGeometry {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const a = x / R;
    const r = R + z;
    pos.setXYZ(i, Math.sin(a) * r, pos.getY(i), Math.cos(a) * r);
  }
  g.deleteAttribute("normal");
  g.computeVertexNormals();
  return g;
}

/** Pick a stable variant index from a seed string/number. */
export function variantOf(seed: number | string, count: number, salt = ""): number {
  let h = 2166136261 >>> 0;
  const s = `${salt}|${seed}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  return (h >>> 0) % Math.max(1, count);
}

/** Finish a built object: name it, scale it and record its footprint. */
export function finish(
  content: THREE.Object3D,
  meta: { kind: string; id: string; scale?: number; footprint: { width: number; depth: number; height: number } },
): THREE.Group {
  const root = new THREE.Group();
  root.name = `${meta.kind}:${meta.id}`;
  root.add(content);
  const s = meta.scale ?? 1;
  root.scale.setScalar(s);
  root.userData.kind = meta.kind;
  root.userData.id = meta.id;
  root.userData.footprint = meta.footprint;
  root.userData.sharedGeometry = false;
  return root;
}

/**
 * A tube through points whose radius varies along its length: `radius(t)`
 * with t in 0..1. Ends are capped with a flat disc when `caps` is set.
 */
export function sweep(points: V3[], radius: (t: number) => number, segments = 16, radial = 6, caps = true): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal",
  );
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, c);
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  if (!caps) return g;
  const parts: THREE.BufferGeometry[] = [g];
  for (const t of [0, 1]) {
    const r = radius(t);
    if (r < 1e-5) continue;
    const disc = new THREE.CircleGeometry(r, radial);
    const tan = curve.getTangentAt(t).normalize();
    if (t === 0) tan.negate();
    disc.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan));
    const p = curve.getPointAt(t);
    disc.translate(p.x, p.y, p.z);
    disc.deleteAttribute("uv");
    parts.push(disc);
  }
  const k = new Kit();
  for (const p of parts) k.addGeometry(p);
  return k.build();
}

/**
 * A flat band (ribbon, strap, tape) through points: `width` across, measured
 * along `across` (a fixed direction, or the curve normal), `thick` deep.
 */
export function band(points: V3[], width: number, thick: number, across: V3 = [0, 1, 0], segments = 24): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal",
  );
  const A = new THREE.Vector3(...across).normalize();
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tan);
    // Across direction orthogonalised against the tangent; thickness is their cross.
    const u = A.clone().sub(tan.clone().multiplyScalar(A.dot(tan))).normalize();
    const n = tan.clone().cross(u).normalize();
    for (const [su, sn] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      pos.push(p.x + u.x * su * (width / 2) + n.x * sn * (thick / 2), p.y + u.y * su * (width / 2) + n.y * sn * (thick / 2), p.z + u.z * su * (width / 2) + n.z * sn * (thick / 2));
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let f = 0; f < 4; f++) {
      const a = i * 4 + f,
        b = i * 4 + ((f + 1) % 4),
        c = (i + 1) * 4 + f,
        d = (i + 1) * 4 + ((f + 1) % 4);
      idx.push(a, b, c, b, d, c);
    }
  }
  const last = segments * 4;
  idx.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** Translate a geometry so its lowest point sits on y = 0 (and optionally centre it in XZ). */
export function restOnGround(g: THREE.BufferGeometry, centre = false): THREE.BufferGeometry {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(centre ? -(b.min.x + b.max.x) / 2 : 0, -b.min.y, centre ? -(b.min.z + b.max.z) / 2 : 0);
  return g;
}

/**
 * Stand a flat paper object up so its face reads from the trolley: pivot it
 * about its front edge (z = +depth/2) until it leans back at `angle` from the
 * ground, and prop it on a brick behind. Returns a new group; the brick uses
 * `material` so it stays in the object's single body draw call family.
 */
export function proppedUp(content: THREE.Object3D, depth: number, material: THREE.Material, angle = 1.15): THREE.Group {
  const pivot = new THREE.Group();
  content.position.z -= depth / 2;
  pivot.add(content);
  pivot.rotation.x = angle;
  const root = new THREE.Group();
  root.add(pivot);
  // A brick on end behind the page, where the lean meets it.
  const bh = Math.min(0.2, depth * 0.62);
  const zBack = -bh / Math.tan(angle);
  const k = new Kit();
  k.add(cblock(0.1, bh, 0.065, 0.004), { tone: "light", position: [0, 0, zBack - 0.036] });
  k.add(cblock(0.09, 0.004, 0.055, 0.001), { tone: "mid", position: [0, bh, zBack - 0.036] });
  root.add(new THREE.Mesh(k.build(), material));
  root.position.z = Math.cos(angle) * depth * 0.5 - 0.02;
  return root;
}
