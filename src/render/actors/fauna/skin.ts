/**
 * Skinned geometry builder. Parts are authored in mesh space at the rest pose
 * (every bone has an identity rest rotation) and bound to bones. Rigid parts
 * bind 100% to one bone; lofted limbs, necks and tails may blend two bones
 * across a joint so the pen line never cracks where a knee bends.
 *
 * Output attributes: position, normal, uv (coat atlas), inkAttr, skinIndex,
 * skinWeight. One animal = one geometry = one draw call.
 */
import * as THREE from "three";
import { ACCENT, TONE, type AccentName, type ToneName } from "../../core/palette.ts";
import type { LoftMesh } from "./loft.ts";

/** [boneA, boneB, weightOfB]. */
export type BoneBlend = readonly [number, number, number];
export type Tone = number | ToneName;

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface LoftPaint {
  /** Bone blend per vertex (s along the loft, v around it). */
  bones: number | ((s: number, v: number, p: THREE.Vector3) => BoneBlend);
  tone?: Tone | ((s: number, v: number, p: THREE.Vector3) => number);
  accent?: AccentName;
  accentAmount?: number | ((s: number, v: number, p: THREE.Vector3) => number);
  /** Map (s, v) into this atlas rect. Omit to use the builder's blank texel. */
  uv?: UvRect | null;
  /** Custom UV (overrides `uv`). */
  uvFn?: (s: number, v: number, p: THREE.Vector3) => [number, number];
}

export interface PartPaint {
  tone?: Tone;
  accent?: AccentName;
  accentAmount?: number;
  /** Fixed UV for the whole part (defaults to the blank texel). */
  uv?: [number, number];
  /** Optional per-vertex UV. */
  uvFn?: (p: THREE.Vector3, n: THREE.Vector3) => [number, number];
  /** Optional per-vertex tone. */
  toneFn?: (p: THREE.Vector3, n: THREE.Vector3) => number;
}

const toneValue = (t: Tone | undefined): number => (t === undefined ? 0 : typeof t === "number" ? t : TONE[t]);

/** Weights for a chain of bones split at joint stations, blended over +-blend. */
export function chainBlend(bones: number[], joints: number[], blend: number | number[]): (s: number) => BoneBlend {
  return (s: number) => {
    let k = 0;
    while (k < joints.length && s >= joints[k]!) k++;
    // s lies in segment k (between joints[k-1] and joints[k]).
    const bone = bones[Math.min(k, bones.length - 1)]!;
    // Nearest joint for blending.
    let best = -1;
    let dist = Infinity;
    for (let j = 0; j < joints.length; j++) {
      const d = Math.abs(s - joints[j]!);
      if (d < dist) {
        dist = d;
        best = j;
      }
    }
    if (best < 0) return [bone, bone, 0];
    const bw = Array.isArray(blend) ? blend[best] ?? 0 : blend;
    if (bw <= 0 || dist >= bw) return [bone, bone, 0];
    const a = bones[best]!;
    const b = bones[Math.min(best + 1, bones.length - 1)]!;
    const x = (s - joints[best]!) / bw; // -1..1
    const t = THREE.MathUtils.smoothstep(x, -1, 1);
    return [a, b, t];
  };
}

export class SkinBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private uv: number[] = [];
  private ink: number[] = [];
  private si: number[] = [];
  private sw: number[] = [];
  private idx: number[] = [];
  /** UV of a texel that is guaranteed paper-white. */
  blank: [number, number] = [0.02, 0.98];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  private push(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, tone: number, accAmt: number, accIdx: number, blend: BoneBlend): void {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.ink.push(tone, accAmt, accIdx);
    const [a, b, t] = blend;
    if (a === b || t <= 0) this.si.push(a, 0, 0, 0), this.sw.push(1, 0, 0, 0);
    else if (t >= 1) this.si.push(b, 0, 0, 0), this.sw.push(1, 0, 0, 0);
    else this.si.push(a, b, 0, 0), this.sw.push(1 - t, t, 0, 0);
  }

  addLoft(l: LoftMesh, paint: LoftPaint): this {
    const base = this.vertexCount;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const count = l.s.length;
    const accIdx = ACCENT[paint.accent ?? "none"];
    for (let i = 0; i < count; i++) {
      p.set(l.position[i * 3]!, l.position[i * 3 + 1]!, l.position[i * 3 + 2]!);
      n.set(l.normal[i * 3]!, l.normal[i * 3 + 1]!, l.normal[i * 3 + 2]!);
      const s = l.s[i]!;
      const v = l.v[i]!;
      const blend: BoneBlend = typeof paint.bones === "number" ? [paint.bones, paint.bones, 0] : paint.bones(s, v, p);
      const tone = typeof paint.tone === "function" ? paint.tone(s, v, p) : toneValue(paint.tone);
      const amt = typeof paint.accentAmount === "function" ? paint.accentAmount(s, v, p) : paint.accentAmount ?? (paint.accent ? 1 : 0);
      let u = this.blank[0],
        w = this.blank[1];
      if (paint.uvFn) [u, w] = paint.uvFn(s, v, p);
      else if (paint.uv) {
        u = paint.uv.u0 + (paint.uv.u1 - paint.uv.u0) * s;
        w = paint.uv.v0 + (paint.uv.v1 - paint.uv.v0) * v;
      }
      this.push(p, n, u, w, tone, accIdx ? amt : 0, accIdx, blend);
    }
    for (const k of l.index) this.idx.push(base + k);
    return this;
  }

  /** Add a primitive geometry (already in mesh space unless `matrix` is given). */
  addPart(geometry: THREE.BufferGeometry, bone: number | BoneBlend, paint: PartPaint = {}, matrix?: THREE.Matrix4): this {
    let g = geometry;
    if (matrix) {
      g = g.clone();
      g.applyMatrix4(matrix);
    }
    if (!g.getAttribute("normal")) {
      g = g === geometry ? g.clone() : g;
      g.computeVertexNormals();
    }
    const pa = g.getAttribute("position") as THREE.BufferAttribute;
    const na = g.getAttribute("normal") as THREE.BufferAttribute;
    const base = this.vertexCount;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const tone = toneValue(paint.tone);
    const accIdx = ACCENT[paint.accent ?? "none"];
    const amt = accIdx ? paint.accentAmount ?? 1 : 0;
    const blend: BoneBlend = typeof bone === "number" ? [bone, bone, 0] : bone;
    for (let i = 0; i < pa.count; i++) {
      p.fromBufferAttribute(pa, i);
      n.fromBufferAttribute(na, i);
      const [u, v] = paint.uvFn ? paint.uvFn(p, n) : paint.uv ?? this.blank;
      const t = paint.toneFn ? paint.toneFn(p, n) : tone;
      this.push(p, n, u, v, t, amt, accIdx, blend);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("inkAttr", new THREE.Float32BufferAttribute(this.ink, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Compose a matrix from position / Euler rotation / scale. */
export function mat(position: [number, number, number] | THREE.Vector3, rotation: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1, order: THREE.EulerOrder = "XYZ"): THREE.Matrix4 {
  const p = Array.isArray(position) ? new THREE.Vector3(...position) : position;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], order));
  const s = Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale, scale, scale);
  return new THREE.Matrix4().compose(p, q, s);
}

/** Matrix that places a +Y-aligned primitive between two points. */
export function between(a: THREE.Vector3, b: THREE.Vector3, scaleXZ: [number, number] = [1, 1]): THREE.Matrix4 {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(scaleXZ[0], len, scaleXZ[1]));
  return m;
}
