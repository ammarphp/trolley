/**
 * Ambient bird flocks, drawn as instanced ink silhouettes.
 *
 *   starlings - a murmuration: boids (separation, alignment, cohesion on a
 *               spatial hash) drawn to a wandering roost point, rippled by a
 *               flow field, with a falcon that tears holes through it.
 *   crows     - a kettle circling on thermals: slow flaps between long glides,
 *               banking into the turn, a few peeling off and rejoining.
 *   geese     - a skein in a V, flapping in a wave down each arm.
 *
 * Wingbeats use a small set of pre-built pose frames (one InstancedMesh per
 * frame); each bird is written into the mesh for its current frame every
 * update, so a flock of a thousand birds costs a handful of draw calls.
 */
import * as THREE from "three";
import { inkMaterial } from "../../core/ink-material.ts";
import { Kit, sphere, cone } from "../../core/geometry.ts";
import { createRng, type Rng } from "../../core/rng.ts";

export type FlockKind = "starlings" | "crows" | "geese";

export interface FlockSpec {
  kind: FlockKind;
  count: number;
  seed: number | string;
}

export interface Flock {
  object: THREE.Object3D;
  /** Advance the flock; `center` is where it should gather (world space). */
  update(dt: number, t: number, center: THREE.Vector3): void;
  /**
   * Optional live viewer position (the camera). Distant birds are drawn a
   * little larger so they stay legible specks. Without it the flock uses the
   * last camera that drew it.
   */
  setViewer(v: THREE.Vector3 | null): void;
}

const FRAMES = 8;

interface Shape {
  bodyLen: number;
  bodyR: number;
  span: number;
  chordRoot: number;
  chordTip: number;
  sweep: number;
  tail: number;
  neck: number;
  tone: number;
  headTone: number;
  fingers: boolean;
  flapAmp: number;
  flapBias: number;
}

const SHAPES: Record<FlockKind, Shape> = {
  starlings: { bodyLen: 0.2, bodyR: 0.034, span: 0.2, chordRoot: 0.075, chordTip: 0.018, sweep: 0.07, tail: 0.06, neck: 0, tone: 0.95, headTone: 1, fingers: false, flapAmp: 0.95, flapBias: 0.05 },
  crows: { bodyLen: 0.3, bodyR: 0.05, span: 0.46, chordRoot: 0.16, chordTip: 0.1, sweep: 0.03, tail: 0.17, neck: 0, tone: 1, headTone: 1, fingers: true, flapAmp: 0.7, flapBias: 0.1 },
  geese: { bodyLen: 0.55, bodyR: 0.1, span: 0.82, chordRoot: 0.26, chordTip: 0.07, sweep: 0.1, tail: 0.12, neck: 0.36, tone: 0.45, headTone: 0.9, fingers: false, flapAmp: 0.6, flapBias: 0.08 },
};

/** Build one wing-pose frame: `a` is the inner wing elevation, `b` the outer. */
function birdFrame(s: Shape, a: number, b: number): THREE.BufferGeometry {
  const k = new Kit();
  const body = sphere(1, 8, 5);
  body.scale(s.bodyR, s.bodyR * 0.85, s.bodyLen * 0.5);
  k.add(body, { tone: s.tone });
  if (s.neck > 0) {
    const neck = new THREE.CylinderGeometry(s.bodyR * 0.28, s.bodyR * 0.42, s.neck, 5);
    k.add(neck, { tone: s.headTone, position: [0, s.bodyR * 0.25, s.bodyLen * 0.45 + s.neck * 0.45], rotation: [Math.PI / 2 - 0.12, 0, 0] });
    k.add(sphere(s.bodyR * 0.36, 6, 4), { tone: s.headTone, position: [0, s.bodyR * 0.33, s.bodyLen * 0.45 + s.neck * 0.95] });
    k.add(cone(s.bodyR * 0.16, s.bodyR * 0.6, 5), { tone: 0.4, position: [0, s.bodyR * 0.3, s.bodyLen * 0.45 + s.neck * 0.95 + s.bodyR * 0.5], rotation: [Math.PI / 2, 0, 0] });
  } else {
    k.add(sphere(s.bodyR * 0.72, 6, 4), { tone: s.headTone, position: [0, s.bodyR * 0.15, s.bodyLen * 0.5] });
    k.add(cone(s.bodyR * 0.28, s.bodyR * 1.2, 5), { tone: 1, position: [0, s.bodyR * 0.1, s.bodyLen * 0.5 + s.bodyR * 1.1], rotation: [Math.PI / 2, 0, 0] });
  }
  // Tail: a flat wedge.
  const tail = new THREE.BufferGeometry();
  const tw = s.bodyR * (s.fingers ? 1.3 : 0.9);
  tail.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, -s.bodyLen * 0.35, -tw, 0, -s.bodyLen * 0.4 - s.tail, tw, 0, -s.bodyLen * 0.4 - s.tail, 0, 0.004, -s.bodyLen * 0.35, tw, 0.004, -s.bodyLen * 0.4 - s.tail, -tw, 0.004, -s.bodyLen * 0.4 - s.tail], 3),
  );
  tail.setIndex([0, 1, 2, 3, 4, 5]);
  tail.computeVertexNormals();
  k.add(tail, { tone: s.tone });
  // Wings: inner and outer panels, each a thin slab.
  for (const side of [1, -1]) {
    const root = new THREE.Vector3(side * s.bodyR * 0.6, s.bodyR * 0.3, s.bodyLen * 0.12);
    const half = s.span * 0.45;
    const wrist = root.clone().add(new THREE.Vector3(side * Math.cos(a) * half, Math.sin(a) * half, -s.sweep * 0.3));
    const tipDir = new THREE.Vector3(side * Math.cos(b), Math.sin(b), 0).normalize();
    const tip = wrist.clone().addScaledVector(tipDir, s.span - half).add(new THREE.Vector3(0, 0, -s.sweep));
    const quad = (p0: THREE.Vector3, p1: THREE.Vector3, c0: number, c1: number, fingers: boolean) => {
      const g = new THREE.BufferGeometry();
      const pts: number[] = [];
      const L0 = p0.clone().add(new THREE.Vector3(0, 0, c0 * 0.3));
      const T0 = p0.clone().add(new THREE.Vector3(0, 0, -c0 * 0.7));
      const L1 = p1.clone().add(new THREE.Vector3(0, 0, c1 * 0.3));
      const T1 = p1.clone().add(new THREE.Vector3(0, 0, -c1 * 0.7));
      const idx: number[] = [];
      const push = (...vs: THREE.Vector3[]) => vs.forEach((v) => pts.push(v.x, v.y, v.z));
      push(L0, T0, L1, T1);
      if (side > 0) idx.push(0, 1, 2, 2, 1, 3, 0, 2, 1, 2, 3, 1);
      else idx.push(0, 2, 1, 2, 3, 1, 0, 1, 2, 2, 1, 3);
      if (fingers) {
        // Slotted primaries along the tip.
        for (let f = 0; f < 4; f++) {
          const u = f / 3;
          const base = L1.clone().lerp(T1, u);
          const dir = tipDir.clone().add(new THREE.Vector3(0, 0, -0.5 * u)).normalize();
          const e = base.clone().addScaledVector(dir, c1 * 0.7);
          const w = new THREE.Vector3(0, 0, c1 * 0.12);
          const i0 = pts.length / 3;
          push(base.clone().add(w), base.clone().sub(w), e);
          idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 1);
        }
      }
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    k.add(quad(root, wrist, s.chordRoot, s.chordRoot * 0.85, false), { tone: s.tone });
    k.add(quad(wrist, tip, s.chordRoot * 0.85, s.chordTip, s.fingers), { tone: s.tone });
  }
  return k.build();
}

class FramePool {
  readonly meshes: THREE.InstancedMesh[] = [];
  private used: number[] = [];
  constructor(shape: Shape, max: number, group: THREE.Group, glide: boolean) {
    const mat = inkMaterial({ vertexInk: true, hatchSpace: "object", hatch: 0.03, side: THREE.DoubleSide, objectId: 0.6 });
    const n = FRAMES + (glide ? 1 : 0);
    for (let f = 0; f < n; f++) {
      let a: number, b: number;
      if (f === FRAMES) {
        a = 0.08;
        b = -0.02;
      } else {
        const ph = (f / FRAMES) * Math.PI * 2;
        a = shape.flapBias + shape.flapAmp * Math.cos(ph);
        b = a + 0.35 * Math.sin(ph) - 0.1;
      }
      const m = new THREE.InstancedMesh(birdFrame(shape, a, b), mat, max);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.userData.castShadow = false;
      m.userData.noShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(m);
      this.meshes.push(m);
      this.used.push(0);
    }
    this.watch();
    ((group.userData.pools as FramePool[] | undefined) ?? (group.userData.pools = [])).push(this);
  }
  /** Use a live viewer position instead of the last drawing camera. */
  setViewer(v: THREE.Vector3 | null): void {
    this.viewer = v;
  }
  private viewer: THREE.Vector3 | null = null;
  /** Last camera that drew the flock (for keeping distant birds legible). */
  readonly camera = new THREE.Vector3();
  private hasCamera = false;
  /**
   * Scale that keeps a far bird at least a couple of pixels wide, the way an
   * engraver draws distant birds as definite ticks rather than dust.
   */
  legible(p: THREE.Vector3): number {
    const cam = this.viewer ?? (this.hasCamera ? this.camera : null);
    if (!cam) return 1;
    return THREE.MathUtils.clamp(p.distanceTo(cam) / this.legibleAt, 1, 3.2);
  }
  legibleAt = 85;
  watch(): void {
    for (const m of this.meshes)
      m.onBeforeRender = (_r, _s, cam) => {
        this.camera.setFromMatrixPosition(cam.matrixWorld);
        this.hasCamera = true;
      };
  }
  begin(): void {
    for (let i = 0; i < this.used.length; i++) this.used[i] = 0;
  }
  put(frame: number, m: THREE.Matrix4): void {
    const mesh = this.meshes[frame]!;
    const i = this.used[frame]!++;
    mesh.setMatrixAt(i, m);
  }
  end(): void {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i]!;
      mesh.count = this.used[i]!;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function orient(pos: THREE.Vector3, vx: number, vy: number, vz: number, bank: number, scale: number): THREE.Matrix4 {
  const h = Math.hypot(vx, vz);
  _e.set(-Math.atan2(vy, Math.max(1e-4, h)), Math.atan2(vx, vz), bank, "YXZ");
  _q.setFromEuler(_e);
  _s.setScalar(scale);
  return _m.compose(pos, _q, _s);
}

// ------------------------------------------------------------ murmuration

function starlings(spec: FlockSpec, rng: Rng, group: THREE.Group): Flock["update"] {
  const N = Math.max(1, spec.count);
  const pool = new FramePool(SHAPES.starlings, N, group, true);
  const P = new Float32Array(N * 3);
  const Vv = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const rate = new Float32Array(N);
  const glide = new Float32Array(N);
  const bank = new Float32Array(N);
  const size = new Float32Array(N);
  const centre = new THREE.Vector3();
  let init = false;
  // Spatial hash.
  const TABLE = 4096;
  const cellOf = new Int32Array(N);
  const count = new Int32Array(TABLE);
  const start = new Int32Array(TABLE);
  const sorted = new Int32Array(N);
  const CS = 3.6;
  const SEP = 2.3;
  // Roost ellipsoid semi-axes grow with the flock so density stays plausible.
  const scaleN = Math.cbrt(N / 700);
  const RA = 34 * scaleN,
    RB = 7 * scaleN,
    RC = 15 * scaleN;
  const hash = (x: number, y: number, z: number) => (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % TABLE;
  // Falcon.
  const hawk = { active: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, next: rng.range(4, 9) };
  for (let i = 0; i < N; i++) {
    phase[i] = rng.next();
    rate[i] = rng.range(9, 12.5);
    glide[i] = rng.range(0, 1);
    size[i] = rng.range(0.9, 1.1);
  }
  return (dt, t, c) => {
    if (!init) {
      centre.copy(c);
      for (let i = 0; i < N; i++) {
        const r = Math.cbrt(rng.next()) * 14;
        const a = rng.range(0, Math.PI * 2),
          e = rng.range(-0.6, 0.6);
        P[i * 3] = c.x + Math.cos(a) * Math.cos(e) * r;
        P[i * 3 + 1] = c.y + Math.sin(e) * r * 0.5;
        P[i * 3 + 2] = c.z + Math.sin(a) * Math.cos(e) * r;
        Vv[i * 3] = 11;
        Vv[i * 3 + 1] = 0;
        Vv[i * 3 + 2] = 0;
      }
      init = true;
    }
    centre.lerp(c, 1 - Math.exp(-dt * 0.6));
    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    const h = Math.min(dt, 0.1) / steps;
    for (let st = 0; st < steps; st++) {
      // Roost point wanders on slow Lissajous curves: the flock swirls.
      const tt = t + st * h;
      const rx = centre.x + Math.sin(tt * 0.13) * 18 + Math.sin(tt * 0.31) * 6;
      const ry = centre.y + Math.sin(tt * 0.21) * 4;
      const rz = centre.z + Math.cos(tt * 0.11) * 14 + Math.cos(tt * 0.27) * 5;
      const phi = tt * 0.06 + Math.sin(tt * 0.13) * 0.8;
      const cph = Math.cos(phi),
        sph = Math.sin(phi);
      // Hash.
      count.fill(0);
      for (let i = 0; i < N; i++) {
        const k = hash(Math.floor(P[i * 3]! / CS), Math.floor(P[i * 3 + 1]! / CS), Math.floor(P[i * 3 + 2]! / CS));
        cellOf[i] = k;
        count[k]!++;
      }
      let acc = 0;
      for (let k = 0; k < TABLE; k++) {
        start[k] = acc;
        acc += count[k]!;
        count[k] = 0;
      }
      for (let i = 0; i < N; i++) {
        const k = cellOf[i]!;
        sorted[start[k]! + count[k]!++] = i;
      }
      // Falcon passes.
      hawk.next -= h;
      if (hawk.active <= 0 && hawk.next <= 0) {
        const a = rng.range(0, Math.PI * 2);
        hawk.x = rx + Math.cos(a) * 45;
        hawk.y = ry + rng.range(-6, 6);
        hawk.z = rz + Math.sin(a) * 45;
        const d = Math.hypot(rx - hawk.x, rz - hawk.z);
        hawk.vx = ((rx - hawk.x) / d) * 24;
        hawk.vy = 0;
        hawk.vz = ((rz - hawk.z) / d) * 24;
        hawk.active = 3.8;
        hawk.next = rng.range(7, 16);
      }
      if (hawk.active > 0) {
        hawk.active -= h;
        hawk.x += hawk.vx * h;
        hawk.y += hawk.vy * h;
        hawk.z += hawk.vz * h;
      }
      for (let i = 0; i < N; i++) {
        const px = P[i * 3]!,
          py = P[i * 3 + 1]!,
          pz = P[i * 3 + 2]!;
        const vx = Vv[i * 3]!,
          vy = Vv[i * 3 + 1]!,
          vz = Vv[i * 3 + 2]!;
        let sx = 0,
          sy = 0,
          sz = 0,
          ax = 0,
          ay = 0,
          az = 0,
          cx = 0,
          cy = 0,
          cz = 0,
          nb = 0;
        const gx = Math.floor(px / CS),
          gy = Math.floor(py / CS),
          gz = Math.floor(pz / CS);
        outer: for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
              const k = hash(gx + dx, gy + dy, gz + dz);
              const s0 = start[k]!,
                s1 = s0 + count[k]!;
              for (let q = s0; q < s1; q++) {
                const j = sorted[q]!;
                if (j === i) continue;
                const ox = P[j * 3]! - px,
                  oy = P[j * 3 + 1]! - py,
                  oz = P[j * 3 + 2]! - pz;
                const d2 = ox * ox + oy * oy + oz * oz;
                if (d2 > CS * CS) continue;
                nb++;
                ax += Vv[j * 3]!;
                ay += Vv[j * 3 + 1]!;
                az += Vv[j * 3 + 2]!;
                cx += ox;
                cy += oy;
                cz += oz;
                if (d2 < SEP * SEP) {
                  const inv = 1 / Math.max(0.05, d2);
                  sx -= ox * inv;
                  sy -= oy * inv;
                  sz -= oz * inv;
                }
                if (nb >= 12) break outer;
              }
            }
        let fx = 0,
          fy = 0,
          fz = 0;
        if (nb > 0) {
          fx += (ax / nb - vx) * 1.5 + (cx / nb) * 0.22 + sx * 5;
          fy += (ay / nb - vy) * 1.5 + (cy / nb) * 0.22 + sy * 5;
          fz += (az / nb - vz) * 1.5 + (cz / nb) * 0.22 + sz * 5;
        }
        // Roost: a slowly turning, flattened ellipsoid (the flock is a sheet
        // that folds and stretches). Soft inside, firm at the boundary.
        const lx = px - rx,
          ly = py - ry,
          lz = pz - rz;
        const ux = lx * cph - lz * sph,
          uz = lx * sph + lz * cph;
        const q = Math.sqrt((ux / RA) ** 2 + (ly / RB) ** 2 + (uz / RC) ** 2);
        const dist = Math.max(1, Math.hypot(lx, ly, lz));
        const k = q > 1 ? (q - 1) * 14 + 0.5 : 0.35;
        fx -= (lx / dist) * k;
        fy -= (ly / dist) * k * 1.6;
        fz -= (lz / dist) * k;
        // Flow field: travelling waves through the sheet.
        fx += Math.sin(py * 0.11 + tt * 0.9) * 3;
        fy += Math.sin(ux * 0.09 + tt * 1.3) * 3.2;
        fz += Math.sin(px * 0.07 + tt * 0.8) * 3;
        // Falcon: burst away.
        if (hawk.active > 0) {
          const hx = px - hawk.x,
            hy = py - hawk.y,
            hz = pz - hawk.z;
          const hd2 = hx * hx + hy * hy + hz * hz;
          if (hd2 < 160) {
            const inv = 60 / Math.max(1, hd2);
            fx += hx * inv;
            fy += hy * inv;
            fz += hz * inv;
          }
        }
        let nx = vx + fx * h,
          ny = vy + fy * h,
          nz = vz + fz * h;
        const sp = Math.hypot(nx, ny, nz);
        const want = THREE.MathUtils.clamp(sp, 8.5, 15);
        nx *= want / sp;
        ny *= want / sp;
        nz *= want / sp;
        // Banking from lateral acceleration.
        const turn = (vx * nz - vz * nx) / Math.max(1, sp * sp);
        bank[i] = bank[i]! * 0.9 + THREE.MathUtils.clamp(-turn * 18, -1.1, 1.1) * 0.1;
        Vv[i * 3] = nx;
        Vv[i * 3 + 1] = ny;
        Vv[i * 3 + 2] = nz;
        P[i * 3] = px + nx * h;
        P[i * 3 + 1] = py + ny * h;
        P[i * 3 + 2] = pz + nz * h;
      }
    }
    // Draw.
    pool.begin();
    for (let i = 0; i < N; i++) {
      glide[i] = (glide[i]! + dt * 0.4) % 1;
      const gliding = glide[i]! > 0.78;
      phase[i] = (phase[i]! + dt * rate[i]!) % 1;
      const frame = gliding ? FRAMES : Math.floor(phase[i]! * FRAMES) % FRAMES;
      _p.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!);
      pool.put(frame, orient(_p, Vv[i * 3]!, Vv[i * 3 + 1]!, Vv[i * 3 + 2]!, bank[i]!, size[i]! * pool.legible(_p)));
    }
    pool.end();
  };
}

// ------------------------------------------------------------------ crows

function crows(spec: FlockSpec, rng: Rng, group: THREE.Group): Flock["update"] {
  const N = Math.max(1, spec.count);
  const pool = new FramePool(SHAPES.crows, N, group, true);
  const birds = Array.from({ length: N }, () => ({
    r: rng.range(9, 30),
    alt: rng.range(-5, 9),
    ang: rng.range(0, Math.PI * 2),
    dir: rng.chance(0.85) ? 1 : -1,
    speed: rng.range(7.5, 10.5),
    flap: rng.next(),
    burst: rng.range(0, 4),
    ph: rng.range(0, 10),
    off: new THREE.Vector3(rng.range(-8, 8), 0, rng.range(-8, 8)),
    size: rng.range(0.92, 1.08),
    pos: new THREE.Vector3(),
    init: false,
  }));
  const centre = new THREE.Vector3();
  let init = false;
  return (dt, t, c) => {
    if (!init) {
      centre.copy(c);
      init = true;
    }
    centre.lerp(c, 1 - Math.exp(-dt * 0.5));
    pool.begin();
    for (const b of birds) {
      b.ang += (b.dir * b.speed * dt) / b.r;
      // Orbit centres wander: the kettle breathes and drifts.
      const ox = b.off.x + Math.sin(t * 0.05 + b.ph) * 10;
      const oz = b.off.z + Math.cos(t * 0.04 + b.ph * 1.3) * 10;
      const r = b.r * (1 + 0.15 * Math.sin(t * 0.2 + b.ph));
      const x = centre.x + ox + Math.cos(b.ang) * r;
      const z = centre.z + oz + Math.sin(b.ang) * r;
      const y = centre.y + b.alt + Math.sin(t * 0.35 + b.ph) * 2.5;
      const nx = x,
        ny = y,
        nz = z;
      const vx = b.init ? (nx - b.pos.x) / Math.max(1e-3, dt) : -Math.sin(b.ang) * b.dir * b.speed;
      const vy = b.init ? (ny - b.pos.y) / Math.max(1e-3, dt) : 0;
      const vz = b.init ? (nz - b.pos.z) / Math.max(1e-3, dt) : Math.cos(b.ang) * b.dir * b.speed;
      b.pos.set(nx, ny, nz);
      b.init = true;
      // Flap in bursts, glide between.
      b.burst -= dt;
      if (b.burst < -rng.range(1.5, 3.5)) b.burst = rng.range(0.6, 1.4);
      const flapping = b.burst > 0;
      b.flap = (b.flap + dt * (flapping ? 3.4 : 0)) % 1;
      const frame = flapping ? Math.floor(b.flap * FRAMES) % FRAMES : FRAMES;
      const bankA = Math.atan((b.speed * b.speed) / (9.8 * r)) * b.dir * 0.8;
      pool.put(frame, orient(b.pos, vx, vy, vz, bankA, b.size * pool.legible(b.pos)));
    }
    pool.end();
  };
}

// ------------------------------------------------------------------ geese

function geese(spec: FlockSpec, rng: Rng, group: THREE.Group): Flock["update"] {
  const N = Math.max(1, spec.count);
  const pool = new FramePool(SHAPES.geese, N, group, false);
  const R = rng.range(70, 110);
  const speed = 14;
  let ang = rng.range(0, Math.PI * 2);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lag = Array.from({ length: N }, (_, k) => ({ ph: rng.next() * 0.2, wob: rng.range(0, 10), size: rng.range(0.93, 1.07) }));
  const centre = new THREE.Vector3();
  let init = false;
  const lead = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  let flap = 0;
  return (dt, t, c) => {
    if (!init) {
      centre.copy(c);
      init = true;
    }
    centre.lerp(c, 1 - Math.exp(-dt * 0.3));
    ang += (dir * speed * dt) / R;
    lead.set(centre.x + Math.cos(ang) * R, centre.y + 12 + Math.sin(t * 0.1) * 3, centre.z + Math.sin(ang) * R);
    fwd.set(-Math.sin(ang) * dir, 0, Math.cos(ang) * dir).normalize();
    side.set(fwd.z, 0, -fwd.x);
    flap += dt * 2.7;
    pool.begin();
    for (let k = 0; k < N; k++) {
      const rank = Math.ceil(k / 2);
      const s = k === 0 ? 0 : k % 2 ? 1 : -1;
      const L = lag[k]!;
      _p.copy(lead)
        .addScaledVector(fwd, -rank * 1.9 + Math.sin(t * 0.7 + L.wob) * 0.3)
        .addScaledVector(side, s * rank * 1.6 + Math.sin(t * 0.5 + L.wob) * 0.25);
      _p.y += Math.sin(t * 0.9 + L.wob) * 0.25 - rank * 0.08;
      const f = (flap - rank * 0.12 + L.ph) % 1;
      const frame = Math.floor(((f + 1) % 1) * FRAMES) % FRAMES;
      pool.put(frame, orient(_p, fwd.x * speed, 0, fwd.z * speed, -0.12 * dir, L.size * pool.legible(_p)));
    }
    pool.end();
  };
}

export function createFlock(spec: FlockSpec): Flock {
  const rng = createRng(`flock:${spec.kind}:${spec.seed}`);
  const group = new THREE.Group();
  group.name = `flock:${spec.kind}`;
  const update = spec.kind === "starlings" ? starlings(spec, rng, group) : spec.kind === "crows" ? crows(spec, rng, group) : geese(spec, rng, group);
  const pools = group.userData.pools as FramePool[];
  return {
    object: group,
    update: (dt, t, center) => update(Math.max(0, Math.min(dt, 0.25)), t, center),
    setViewer: (v) => pools.forEach((p) => p.setViewer(v)),
  };
}
