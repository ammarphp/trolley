/**
 * A tiny software renderer for the portrait. Surfaces are parametric grids
 * (positions + normals); we rasterise them into a depth buffer (visibility
 * for every pen stroke) and into a light-space depth map (cast shadows from
 * the cap peak, jaw and head). Nothing here draws ink; engrave.ts does.
 */
import { project, type Cam, type V3 } from "./math.ts";

export class Grid {
  readonly n: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  /** Screen x, y, depth. */
  sx: Float32Array;
  sy: Float32Array;
  sz: Float32Array;
  /** N·(toward camera), normalised. */
  facing: Float32Array;
  alb: Float32Array;
  cav: Float32Array;
  tone: Float32Array;
  lit: Float32Array;
  valid: Uint8Array;
  twoSided = false;
  wrapU = false;
  /** Darkest tone this surface may reach (keeps secondary forms from going solid). */
  toneMax = 1;
  /** Parameter values for rows/columns (for iso-line hatching). */
  us: Float32Array;
  vs: Float32Array;

  readonly id: number;
  readonly nu: number;
  readonly nv: number;
  readonly name: string;

  constructor(id: number, nu: number, nv: number, name = "grid") {
    this.id = id;
    this.nu = nu;
    this.nv = nv;
    this.name = name;
    const n = nu * nv;
    this.n = n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.sx = new Float32Array(n);
    this.sy = new Float32Array(n);
    this.sz = new Float32Array(n);
    this.facing = new Float32Array(n);
    this.alb = new Float32Array(n);
    this.cav = new Float32Array(n);
    this.tone = new Float32Array(n);
    this.lit = new Float32Array(n);
    this.valid = new Uint8Array(n).fill(1);
    this.us = new Float32Array(nu);
    this.vs = new Float32Array(nv);
  }

  set(i: number, j: number, p: V3): void {
    const k = j * this.nu + i;
    this.px[k] = p[0];
    this.py[k] = p[1];
    this.pz[k] = p[2];
  }

  /**
   * Normals from central differences. `outward(k)` returns a reference
   * direction; normals are flipped to agree with it.
   */
  computeNormals(outward: (k: number) => V3): void {
    const { nu, nv, px, py, pz } = this;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const k = j * nu + i;
        let i0 = i - 1,
          i1 = i + 1;
        if (this.wrapU) {
          i0 = (i0 + nu) % nu;
          i1 = i1 % nu;
        } else {
          i0 = Math.max(0, i0);
          i1 = Math.min(nu - 1, i1);
        }
        const j0 = Math.max(0, j - 1),
          j1 = Math.min(nv - 1, j + 1);
        const a = j * nu + i0,
          b = j * nu + i1,
          c = j0 * nu + i,
          d = j1 * nu + i;
        const ux = px[b]! - px[a]!,
          uy = py[b]! - py[a]!,
          uz = pz[b]! - pz[a]!;
        const vx = px[d]! - px[c]!,
          vy = py[d]! - py[c]!,
          vz = pz[d]! - pz[c]!;
        let nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        const o = outward(k);
        if (nx * o[0] + ny * o[1] + nz * o[2] < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        this.nx[k] = nx;
        this.ny[k] = ny;
        this.nz[k] = nz;
      }
    }
  }

  project(cam: Cam): void {
    const tmp = new Float32Array(3);
    for (let k = 0; k < this.n; k++) {
      project(cam, this.px[k]!, this.py[k]!, this.pz[k]!, tmp, 0);
      this.sx[k] = tmp[0]!;
      this.sy[k] = tmp[1]!;
      this.sz[k] = tmp[2]!;
      const vx = cam.pos[0] - this.px[k]!,
        vy = cam.pos[1] - this.py[k]!,
        vz = cam.pos[2] - this.pz[k]!;
      const l = Math.hypot(vx, vy, vz) || 1;
      this.facing[k] = (this.nx[k]! * vx + this.ny[k]! * vy + this.nz[k]! * vz) / l;
    }
  }
}

/** Depth buffer with min-depth test and an object id channel. */
export class DepthBuffer {
  depth: Float32Array;
  ids: Uint8Array;
  /** Optional interpolated attribute (debug clay shading). */
  attr: Float32Array | null = null;
  readonly w: number;
  readonly h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.depth = new Float32Array(w * h).fill(Infinity);
    this.ids = new Uint8Array(w * h);
  }
  clear(): void {
    this.depth.fill(Infinity);
    this.ids.fill(0);
    if (this.attr) this.attr.fill(0);
  }
  at(x: number, y: number): number {
    const xi = x | 0,
      yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return Infinity;
    return this.depth[yi * this.w + xi]!;
  }
  /** Minimum depth over a (2r+1)^2 neighbourhood (robust occlusion tests). */
  near(x: number, y: number, r = 1): number {
    const xi = x | 0,
      yi = y | 0;
    let m = Infinity;
    for (let j = yi - r; j <= yi + r; j++) {
      if (j < 0 || j >= this.h) continue;
      for (let i = xi - r; i <= xi + r; i++) {
        if (i < 0 || i >= this.w) continue;
        const d = this.depth[j * this.w + i]!;
        if (d < m) m = d;
      }
    }
    return m;
  }
  idAt(x: number, y: number): number {
    const xi = x | 0,
      yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return 0;
    return this.ids[yi * this.w + xi]!;
  }

  tri(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    id: number,
    a0 = 0,
    a1 = 0,
    a2 = 0,
  ): void {
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) return;
    let minX = Math.floor(Math.min(x0, x1, x2));
    let maxX = Math.ceil(Math.max(x0, x1, x2));
    let minY = Math.floor(Math.min(y0, y1, y2));
    let maxY = Math.ceil(Math.max(y0, y1, y2));
    if (maxX < 0 || maxY < 0 || minX >= this.w || minY >= this.h) return;
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(this.w - 1, maxX);
    maxY = Math.min(this.h - 1, maxY);
    const inv = 1 / area;
    const W = this.w;
    const attr = this.attr;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * z0 + w1 * z1 + w2 * z2;
        const k = y * W + x;
        if (z < this.depth[k]!) {
          this.depth[k] = z;
          this.ids[k] = id;
          if (attr) attr[k] = w0 * a0 + w1 * a1 + w2 * a2;
        }
      }
    }
  }

  /** Rasterise a grid's cells (optionally culling cells that face away). */
  grid(g: Grid, cull: boolean, withAttr = false): void {
    const gen = this.gridSteps(g, cull, withAttr, 1 << 30);
    while (!gen.next().done);
  }

  /** The same, yielding every `rowsPerYield` rows. */
  *gridSteps(g: Grid, cull: boolean, withAttr = false, rowsPerYield = 20): Generator<void, void> {
    const { nu, nv, sx, sy, sz, valid, facing } = g;
    const cols = g.wrapU ? nu : nu - 1;
    const tone = g.tone;
    for (let j = 0; j < nv - 1; j++) {
      if (j % rowsPerYield === rowsPerYield - 1) yield;
      for (let i = 0; i < cols; i++) {
        const i1 = (i + 1) % nu;
        const a = j * nu + i,
          b = j * nu + i1,
          c = (j + 1) * nu + i1,
          d = (j + 1) * nu + i;
        if (!valid[a] || !valid[b] || !valid[c] || !valid[d]) continue;
        if (cull && !g.twoSided && facing[a]! < -0.05 && facing[b]! < -0.05 && facing[c]! < -0.05 && facing[d]! < -0.05) continue;
        if (withAttr) {
          this.tri(sx[a]!, sy[a]!, sz[a]!, sx[b]!, sy[b]!, sz[b]!, sx[c]!, sy[c]!, sz[c]!, g.id, tone[a]!, tone[b]!, tone[c]!);
          this.tri(sx[a]!, sy[a]!, sz[a]!, sx[c]!, sy[c]!, sz[c]!, sx[d]!, sy[d]!, sz[d]!, g.id, tone[a]!, tone[c]!, tone[d]!);
        } else {
          this.tri(sx[a]!, sy[a]!, sz[a]!, sx[b]!, sy[b]!, sz[b]!, sx[c]!, sy[c]!, sz[c]!, g.id);
          this.tri(sx[a]!, sy[a]!, sz[a]!, sx[c]!, sy[c]!, sz[c]!, sx[d]!, sy[d]!, sz[d]!, g.id);
        }
      }
    }
  }
}

/**
 * Orthographic light-space depth map. `depth` stores the distance along the
 * light's travel (smaller = nearer the light).
 */
export class ShadowMap {
  readonly buf: DepthBuffer;
  private u: V3;
  private v: V3;
  private w: V3;
  private u0 = 0;
  private v0 = 0;
  private s = 1;
  readonly size: number;
  readonly bias: number;
  constructor(size: number, light: V3, bias = 0.35) {
    this.size = size;
    this.bias = bias;
    this.buf = new DepthBuffer(size, size);
    // w points from the light into the scene.
    this.w = [-light[0], -light[1], -light[2]];
    const up: V3 = Math.abs(light[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const u: V3 = [up[1] * this.w[2] - up[2] * this.w[1], up[2] * this.w[0] - up[0] * this.w[2], up[0] * this.w[1] - up[1] * this.w[0]];
    const lu = Math.hypot(u[0], u[1], u[2]);
    this.u = [u[0] / lu, u[1] / lu, u[2] / lu];
    const w = this.w;
    this.v = [w[1] * this.u[2] - w[2] * this.u[1], w[2] * this.u[0] - w[0] * this.u[2], w[0] * this.u[1] - w[1] * this.u[0]];
  }
  fit(minU: number, maxU: number, minV: number, maxV: number): void {
    const span = Math.max(maxU - minU, maxV - minV) * 1.04;
    this.s = this.size / span;
    this.u0 = (minU + maxU) / 2 - span / 2;
    this.v0 = (minV + maxV) / 2 - span / 2;
  }
  coords(x: number, y: number, z: number, out: Float32Array, o: number): void {
    const u = x * this.u[0] + y * this.u[1] + z * this.u[2];
    const v = x * this.v[0] + y * this.v[1] + z * this.v[2];
    out[o] = (u - this.u0) * this.s;
    out[o + 1] = (v - this.v0) * this.s;
    out[o + 2] = x * this.w[0] + y * this.w[1] + z * this.w[2];
  }
  bounds(grids: Grid[]): void {
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;
    for (const g of grids)
      for (let k = 0; k < g.n; k++) {
        if (!g.valid[k]) continue;
        const u = g.px[k]! * this.u[0] + g.py[k]! * this.u[1] + g.pz[k]! * this.u[2];
        const v = g.px[k]! * this.v[0] + g.py[k]! * this.v[1] + g.pz[k]! * this.v[2];
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    this.fit(minU, maxU, minV, maxV);
  }
  render(grids: Grid[]): void {
    const gen = this.renderSteps(grids);
    while (!gen.next().done);
  }

  *renderSteps(grids: Grid[]): Generator<void, void> {
    this.buf.clear();
    const tmp = new Float32Array(3);
    for (const g of grids) {
      if (g.n > 3000) yield;
      const n = g.n;
      const lx = new Float32Array(n),
        ly = new Float32Array(n),
        lz = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        this.coords(g.px[k]!, g.py[k]!, g.pz[k]!, tmp, 0);
        lx[k] = tmp[0]!;
        ly[k] = tmp[1]!;
        lz[k] = tmp[2]!;
      }
      const { nu, nv, valid } = g;
      const cols = g.wrapU ? nu : nu - 1;
      for (let j = 0; j < nv - 1; j++) {
        if (j % 40 === 39) yield;
        for (let i = 0; i < cols; i++) {
          const i1 = (i + 1) % nu;
          const a = j * nu + i,
            b = j * nu + i1,
            c = (j + 1) * nu + i1,
            d = (j + 1) * nu + i;
          if (!valid[a] || !valid[b] || !valid[c] || !valid[d]) continue;
          this.buf.tri(lx[a]!, ly[a]!, lz[a]!, lx[b]!, ly[b]!, lz[b]!, lx[c]!, ly[c]!, lz[c]!, g.id);
          this.buf.tri(lx[a]!, ly[a]!, lz[a]!, lx[c]!, ly[c]!, lz[c]!, lx[d]!, ly[d]!, lz[d]!, g.id);
        }
      }
    }
  }
  /** 0 = lit, 1 = fully shadowed (3x3 PCF). */
  private tmp = new Float32Array(3);
  shadow(x: number, y: number, z: number, bias = this.bias): number {
    const tmp = this.tmp;
    this.coords(x, y, z, tmp, 0);
    const u = tmp[0]!,
      v = tmp[1]!,
      d = tmp[2]!;
    let occ = 0;
    let n = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const m = this.buf.at(u + i * 1.2, v + j * 1.2);
        n++;
        if (m < d - bias) occ++;
      }
    return occ / n;
  }
}
