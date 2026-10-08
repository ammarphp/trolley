/**
 * A tunnel: the chapter break between stages. The line runs into a cutting,
 * under a masonry headwall set into a wooded hill, through a dark ribbed bore
 * lit by lamps, and out of the far portal. While the cab is inside, the world
 * outside is redrawn for the next stage, so the player emerges into it.
 *
 * The hill is a height field draped along the (possibly curving) line. Over
 * the bore it rises from the headwall's coping to a crest; beyond the portals
 * the corridor is cut away, leaving the slopes of a cutting on either side.
 * Everything inks in over a second or so, rather than appearing at once.
 */
import * as THREE from "three";
import { Kit, block, extrude } from "../core/geometry.ts";
import { createInkMaterial, inkUniforms, type InkMaterialOptions } from "../core/ink-material.ts";
import { createRng } from "../core/rng.ts";
import type { ScatterPrefab } from "../assets.ts";
import type { TrackLine, TrackPose } from "./track/path.ts";

export interface TunnelDressing {
  seed: string;
  prefab(kind: string, variant: number): ScatterPrefab | null;
  variants(kind: string): number;
}

export interface Tunnel {
  group: THREE.Group;
  start: number;
  length: number;
  line: TrackLine;
  contains(line: TrackLine, s: number): boolean;
  /** True once the cab has left the far portal behind. */
  passed(line: TrackLine, s: number): boolean;
  /** Whether a world point lies under the hill (scenery stays off it). */
  covers(x: number, z: number): boolean;
  tick(dt: number): void;
  dispose(): void;
}

const HALF = 4.4;
const WALL = 5.2;
const CROWN = 7.2;
const FACE_W = 18;
const FACE_H = 11;
/** Inner face of the wing walls: the cutting floor runs between them. */
const W0 = FACE_W / 2 - 0.2;
const WING = 16;
const HILL = 17;
const APPROACH = 52;
const FADE = 1.4;
const DEPTH = 1.6;

function arch(n: number, inset = 0): Array<[number, number]> {
  const h = HALF - inset;
  const rise = CROWN - WALL - inset;
  const pts: Array<[number, number]> = [[-h, -0.2], [-h, WALL]];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([Math.cos(a) * h, WALL + Math.sin(a) * rise]);
  }
  pts.push([h, WALL], [h, -0.2]);
  return pts;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function buildTunnel(line: TrackLine, start: number, length: number, heightAt: (x: number, z: number) => number, dressing?: TunnelDressing): Tunnel {
  const group = new THREE.Group();
  group.name = "tunnel";
  const end = start + length;
  line.extendTo(end + APPROACH + 4);
  const base = line.pose(start);
  const cos0 = Math.cos(base.heading);
  const sin0 = Math.sin(base.heading);
  // Local frame at the entry: +x to the right of the line, +z back toward the trolley.
  const toLocal = (x: number, z: number): [number, number] => {
    const dx = x - base.x;
    const dz = z - base.z;
    return [dx * cos0 + dz * sin0, -dx * sin0 + dz * cos0];
  };
  const place = (mesh: THREE.Object3D) => {
    mesh.position.set(base.x, 0, base.z);
    mesh.rotation.y = -base.heading;
    group.add(mesh);
  };
  const materials: THREE.Material[] = [];
  const material = (o: InkMaterialOptions) => {
    const m = createInkMaterial({ ...o, opacity: 0.999 });
    inkUniforms(m).uInkOpacity.value = 0;
    materials.push(m);
    return m;
  };
  const p: TrackPose = { x: 0, z: 0, heading: 0 };
  const sweep = (profile: Array<[number, number]>, s0: number, s1: number, step: number, out: number[]) => {
    for (let s = s0; s < s1 - 1e-3; s += step) {
      const rows = [s, Math.min(s1, s + step)].map((ss) => {
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
      for (let k = 0; k < profile.length - 1; k++) out.push(...a[k]!, ...a[k + 1]!, ...b[k + 1]!, ...a[k]!, ...b[k + 1]!, ...b[k]!);
    }
  };
  const meshOf = (positions: number[], m: THREE.Material) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m);
    place(mesh);
    return mesh;
  };

  // The bore: dark brick, finely hatched, with a rib every six metres so the
  // walls stream past; a sooty floor either side of the ballast.
  const bore: number[] = [];
  sweep(arch(16), start, end, 2, bore);
  meshOf(bore, material({ tone: 0.8, hatch: 0.07, side: THREE.DoubleSide, edge: 0.6, shade: 0.5 }));
  const ribs: number[] = [];
  const outer = arch(16);
  const inner = arch(16, 0.2);
  for (let s = start + 4; s < end - 2; s += 6) {
    sweep(inner, s, s + 0.6, 0.6, ribs);
    for (const ss of [s, s + 0.6]) {
      // Annular faces joining the rib to the wall.
      line.pose(ss, p);
      const rx = Math.cos(p.heading);
      const rz = Math.sin(p.heading);
      const y0 = heightAt(p.x, p.z);
      const at = ([lx, ly]: [number, number]) => {
        const [x, z] = toLocal(p.x + rx * lx, p.z + rz * lx);
        return [x, y0 + ly, z];
      };
      for (let k = 0; k < outer.length - 1; k++) ribs.push(...at(outer[k]!), ...at(outer[k + 1]!), ...at(inner[k + 1]!), ...at(outer[k]!), ...at(inner[k + 1]!), ...at(inner[k]!));
    }
  }
  meshOf(ribs, material({ tone: 0.62, hatch: 0.05, side: THREE.DoubleSide, edge: 1, shade: 0.6 }));
  const floor: number[] = [];
  sweep([[-HALF, 0.07], [HALF, 0.07]], start - 1.6, end + 1.6, 2, floor);
  meshOf(floor, material({ tone: 0.86, pattern: "stipple", hatch: 0.05, side: THREE.DoubleSide, edge: 0 }));

  // The hill: rises from the headwall's coping to a crest over the bore. Out
  // in the cutting, wing walls hold the earth back and step down with it.
  const insideHeight = (s: number, lx: number) => {
    const ax = Math.abs(lx);
    const flank = 1 - smooth(46, 110, ax);
    const swell = 1 + 0.1 * Math.sin(s * 0.06 + lx * 0.08) + 0.05 * Math.sin(s * 0.17 - lx * 0.19);
    const d = Math.max(0, Math.min(s - start, end - s));
    const brow = FACE_H - 0.5 + d * 0.55 + Math.max(0, ax - FACE_W / 2) * 0.45;
    return Math.min(HILL * flank * swell, brow);
  };
  const wallTop = (d: number) => {
    const u = d - DEPTH;
    if (u < 0) return FACE_H - 0.8;
    return u > WING ? 0 : FACE_H - 0.8 + (0.6 - (FACE_H - 0.8)) * (u / WING);
  };
  const hillHeight = (s: number, lx: number) => {
    if (s >= start && s <= end) return insideHeight(s, lx);
    const ax = Math.abs(lx);
    if (ax < W0) return 0;
    const d = s < start ? start - s : s - end;
    const along = 1 - smooth(0, APPROACH, d);
    const slope = insideHeight(s < start ? start : end, lx) * along * smooth(W0, W0 + 13, ax);
    return Math.max(wallTop(d), slope);
  };
  const lateral = 112;
  const stepS = 2.5;
  const s0 = start - APPROACH;
  const s1 = end + APPROACH;
  // Columns every 2.8 m, plus a pair either side of each wing wall's inner
  // face so the cutting floor meets the wall in a clean vertical step.
  const columns: number[] = [];
  for (let x = -lateral; x <= lateral + 1e-6; x += 2.8) if (Math.abs(Math.abs(x) - W0) > 0.3) columns.push(x);
  columns.push(-W0 - 0.04, -W0 + 0.04, W0 - 0.04, W0 + 0.04);
  columns.sort((a, b) => a - b);
  const cols = columns.length;
  const rows = Math.round((s1 - s0) / stepS) + 1;
  const pos = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) {
    const s = s0 + r * stepS;
    line.pose(s, p);
    const rx = Math.cos(p.heading);
    const rz = Math.sin(p.heading);
    for (let c = 0; c < cols; c++) {
      const lx = columns[c]!;
      const h = hillHeight(s, lx);
      const wx = p.x + rx * lx;
      const wz = p.z + rz * lx;
      const [x, z] = toLocal(wx, wz);
      const i = (r * cols + c) * 3;
      pos[i] = x;
      pos[i + 1] = heightAt(wx, wz) + Math.max(0, h) - 0.06;
      pos[i + 2] = z;
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  const hill = new THREE.BufferGeometry();
  hill.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  hill.setIndex(index);
  hill.computeVertexNormals();
  const hillMesh = new THREE.Mesh(hill, material({ tone: 0.05, hatch: 0.24, shade: 0.95, edge: 0.4 }));
  hillMesh.receiveShadow = true;
  place(hillMesh);

  // Headwalls: dressed stone with pilasters, coursing, a ring of voussoirs,
  // a keystone and date stone, a coping, and wing walls retaining the cutting.
  const outline: Array<[number, number]> = [
    [-FACE_W / 2, -0.6],
    [FACE_W / 2, -0.6],
    [FACE_W / 2, FACE_H],
    [-FACE_W / 2, FACE_H],
  ];
  const portalKit = () => {
    const k = new Kit();
    k.add(extrude(outline, DEPTH, 0, [arch(20)]), { tone: "pale", position: [0, 0, DEPTH / 2] });
    for (const side of [-1, 1]) {
      k.add(block(1.5, FACE_H + 0.2, 0.7), { tone: "light", position: [side * (FACE_W / 2 - 0.75), -0.6, DEPTH + 0.3] });
      // Coursing between the arch and the pilaster, then full width above the crown.
      for (let y = 0.9; y < FACE_H - 0.6; y += 0.95) {
        const clear = y < CROWN + 0.9 ? (y < WALL ? HALF + 0.7 : Math.sqrt(Math.max(0, 1 - ((y - WALL) / (CROWN + 0.9 - WALL)) ** 2)) * (HALF + 0.7)) : 0;
        const x0 = Math.max(clear, 0.05);
        const x1 = FACE_W / 2 - 1.5;
        if (x1 - x0 < 0.4) continue;
        k.add(block(x1 - x0, 0.06, 0.05), { tone: "light", position: [side * (x0 + x1) / 2, y, DEPTH + 0.02] });
      }
      // Wing walls retain the cutting, stepping down as it shallows.
      const wing = extrude(
        [
          [0, -0.6],
          [WING, -0.6],
          [WING, 0.6],
          [0, FACE_H - 0.8],
        ],
        0.9,
      );
      k.add(wing, { tone: "pale", position: [side * (W0 + 0.45), 0, DEPTH], rotation: [0, -Math.PI / 2, 0] });
      k.add(block(1.1, 0.35, 1.1), { tone: "light", position: [side * (W0 + 0.45), FACE_H - 0.8, DEPTH + 0.3] });
    }
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI - (i / 14) * Math.PI;
      const x = Math.cos(a) * (HALF + 0.55);
      const y = WALL + Math.sin(a) * (CROWN - WALL + 0.55);
      k.add(block(0.85, 0.6, DEPTH + 0.25), { tone: i === 7 ? "light" : "pale", position: [x, y - 0.3, DEPTH / 2 + 0.12], rotation: [0, 0, a - Math.PI / 2] });
    }
    k.add(block(1.2, 1.5, DEPTH + 0.4), { tone: "light", position: [0, CROWN + 0.1, DEPTH / 2 + 0.2] });
    k.add(block(FACE_W - 3, 0.38, 0.32), { tone: "light", position: [0, CROWN + 1.9, DEPTH + 0.16] });
    k.add(block(2.8, 1.0, 0.22), { tone: "mid", position: [0, CROWN + 2.75, DEPTH + 0.11] });
    k.add(block(FACE_W + 1.2, 0.6, DEPTH + 0.9), { tone: "light", position: [0, FACE_H - 0.05, DEPTH / 2 + 0.2] });
    return k.build();
  };
  const portalGeometry = portalKit();
  const portalMaterial = material({ vertexInk: true, hatch: 0.16, edge: 1 });
  for (const [at, flip] of [
    [start, 0],
    [end, Math.PI],
  ] as const) {
    const q = line.pose(at);
    const portal = new THREE.Mesh(portalGeometry, portalMaterial);
    portal.position.set(q.x, heightAt(q.x, q.z), q.z);
    // Local +z faces out of the hill: back toward the trolley at the entry, onward at the exit.
    portal.rotation.y = -q.heading + flip;
    portal.castShadow = true;
    portal.receiveShadow = true;
    group.add(portal);
  }

  // Lamps: amber pigment on alternate walls, on short brackets.
  const lampGeo = new THREE.BoxGeometry(0.34, 0.24, 0.34);
  const lampMat = material({ tone: 0, accent: "amber", flat: true, edge: 0.3 });
  const bracketGeo = new THREE.BoxGeometry(0.5, 0.06, 0.06);
  const bracketMat = material({ tone: 0.7, edge: 0.4 });
  let wallSide = 1;
  for (let s = start + 9; s < end - 3; s += 16) {
    const q = line.offset(s, wallSide * (HALF - 0.42));
    const y = heightAt(q.x, q.z) + WALL - 0.5;
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(q.x, y, q.z);
    lamp.rotation.y = -q.heading;
    const bracket = new THREE.Mesh(bracketGeo, bracketMat);
    const b = line.offset(s, wallSide * (HALF - 0.2));
    bracket.position.set(b.x, y + 0.16, b.z);
    bracket.rotation.y = -q.heading;
    group.add(lamp, bracket);
    wallSide = -wallSide;
  }

  // Trees, scrub and rock on the hill, kept off the cutting floor and the brow.
  const instanced: THREE.InstancedMesh[] = [];
  if (dressing) {
    const rng = createRng(`${dressing.seed}:tunnel:${Math.round(start)}`);
    const picks = new Map<string, THREE.Matrix4[]>();
    const m = new THREE.Matrix4();
    const qt = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 150; i++) {
      const s = rng.range(s0 + 6, s1 - 6);
      const lx = rng.range(-lateral * 0.8, lateral * 0.8);
      const h = hillHeight(s, lx);
      const inside = s > start - 2 && s < end + 2;
      if (h < 2.2) continue;
      if (!inside && Math.abs(lx) < W0 + 3) continue;
      if (Math.abs(s - start) < 8 && Math.abs(lx) < FACE_W / 2 + 6) continue;
      if (Math.abs(s - end) < 8 && Math.abs(lx) < FACE_W / 2 + 6) continue;
      const roll = rng.next();
      const kind = h > 7 ? (roll < 0.5 ? "tree" : roll < 0.78 ? "conifer" : roll < 0.92 ? "bush" : "rock") : roll < 0.45 ? "bush" : roll < 0.75 ? "rock" : "tree";
      const variants = dressing.variants(kind);
      if (!variants) continue;
      const variant = rng.int(0, variants - 1);
      const key = `${kind}:${variant}`;
      line.pose(s, p);
      const wx = p.x + Math.cos(p.heading) * lx;
      const wz = p.z + Math.sin(p.heading) * lx;
      const [x, z] = toLocal(wx, wz);
      const scale = kind === "rock" ? rng.range(0.7, 1.4) : rng.range(0.8, 1.25);
      qt.setFromAxisAngle(axis, rng.range(0, Math.PI * 2));
      m.compose(new THREE.Vector3(x, heightAt(wx, wz) + h - 0.25, z), qt, new THREE.Vector3(scale, scale, scale));
      const list = picks.get(key) ?? [];
      list.push(m.clone());
      picks.set(key, list);
    }
    for (const [key, list] of picks) {
      const [kind, v] = key.split(":");
      const prefab = dressing.prefab(kind!, Number(v));
      if (!prefab) continue;
      const mesh = new THREE.InstancedMesh(prefab.geometry, material({ ...prefab.material, instanceInk: false }), list.length);
      list.forEach((mat, i) => mesh.setMatrixAt(i, mat));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      place(mesh);
      instanced.push(mesh);
    }
  }

  let age = 0;
  return {
    group,
    start,
    length,
    line,
    contains: (l, s) => l === line && s > start + 6 && s < end - 4,
    passed: (l, s) => l !== line || s > end + 6,
    covers(x, z) {
      // Approximate (s, lateral) from the entry frame; the line is near-straight here.
      const [lx, zl] = toLocal(x, z);
      const s = start - zl;
      if (s < s0 || s > s1 || Math.abs(lx) > lateral) return false;
      return Math.abs(lx) < W0 + 2 || hillHeight(s, lx) > 0.8;
    },
    tick(dt) {
      if (age > FADE) return;
      age += dt;
      const v = age >= FADE ? 1.1 : Math.min(1, age / FADE);
      for (const mat of materials) inkUniforms(mat).uInkOpacity.value = v;
    },
    dispose: () => {
      group.removeFromParent();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh) mesh.geometry?.dispose();
      });
      for (const mesh of instanced) mesh.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
}
