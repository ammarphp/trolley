/**
 * The ground: an endless engraved landscape under the trolley.
 *
 * Geometry: a nested grid (see grid.ts) recentred on the rig every frame in
 * multiples of its coarsest step, with heights from the shared height field
 * applied in the vertex shader. Lit by the scene's lights (Lambert), so cast
 * shadows arrive as hatching.
 *
 * Drawing: world-space field parcels (Voronoi cells, ~96 m) of five kinds -
 * meadow (tufts and dashes), ploughed furrows with headlands, crop rows with
 * tramlines, stubble/fallow, and hardstanding slabs - edged by hedges,
 * fences and ditches. Environment channels change the drawing: drought opens
 * cracked-earth polygons, ruin scorches the ground and pits it with craters,
 * fire leaves embers, and uniformity replaces the patchwork with a square
 * grid of identical parcels while perfection makes the pen itself
 * mechanical.
 *
 * Precision: every pattern is periodic under a 15360 m master lattice (also
 * under the 3-4-5 rotations used for field orientation), and the
 * floating-origin offset is folded into that lattice on the CPU, so fragments
 * work in small coordinates however far the trolley has travelled.
 */
import * as THREE from "three";
import type { EnvironmentTarget } from "../../api.ts";
import { INK_GLOBALS } from "../../core/ink-material.ts";
import { hashString } from "../../core/rng.ts";
import { buildNestedGrid } from "./grid.ts";
import { heightAt, syncTerrainOrigin, TERRAIN_GLSL, TERRAIN_UNIFORMS } from "./height.ts";
import { INK2D_GLSL } from "./glsl.ts";
import { createInkLambert, trackPixelScale } from "./ink-lambert.ts";

/** Master pattern lattice (m). Every lattice used by the ground divides it. */
export const GROUND_LATTICE = 15360;

export interface GroundOptions {
  /** Pattern seed; the same seed always draws the same fields. */
  seed?: number | string;
  /** Outer half-size of the ground mesh, metres (default 1536). */
  radius?: number;
  /** Finest vertex spacing near the rig, metres (default 2). */
  baseStep?: number;
  /** "low" drops tufts, cracks' fine level and crater ejecta. */
  quality?: "low" | "medium" | "high";
  objectId?: number;
}

export interface GroundModule {
  readonly object: THREE.Mesh;
  update(dt: number, env: EnvironmentTarget, rigWorld: THREE.Vector3, camera: THREE.Camera): void;
  heightAt(x: number, z: number): number;
  /** Uniforms, for debugging and lab overrides. */
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly triangles: number;
  dispose(): void;
}

const VERTEX_HEAD = /* glsl */ `
varying vec3 vGScene;
${TERRAIN_GLSL}
`;

const VERTEX_NORMAL = /* glsl */ `
vec3 gScene = (modelMatrix * vec4(position, 1.0)).xyz;
float gH = terrainHeight(gScene.xz);
vec2 gGrad = terrainGradient(gScene.xz);
vec3 objectNormal = normalize(vec3(-gGrad.x, 1.0, -gGrad.y));
`;

const VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3(position.x, position.y + gH, position.z);
vGScene = vec3(gScene.x, gScene.y + gH, gScene.z);
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vGScene;
uniform vec4 uGEnvA; // vegetation, bloom, drought, ruin
uniform vec4 uGEnvB; // fire, perfection, uniformity, industry
uniform vec4 uGEnvC; // compute, habitation, night, storm
uniform vec4 uGEnvD; // gloom, fog, quality, seed
uniform vec2 uGOffMod;
uniform vec2 uGOffDiv;
uniform float uGEdge;
uniform float uGObjectId;
uniform vec3 uPxScale;
#define G_M ${GROUND_LATTICE.toFixed(1)}
#define G_BLOCK 384.0
#define G_GRID 32.0
${INK2D_GLSL}

struct GCtx {
  vec2 p;      // world position modulo the master lattice
  vec2 dpx;    // d(world)/d(screen x), metres per device pixel
  vec2 dpy;
  mat2 Jinv;   // world offset -> screen offset (device px)
  float dist;
  float focal; // px
  float pr;    // device px per css px
  float breakup;
  float mppY;
};

struct GField {
  vec2 key;     // global field id
  vec2 rel;     // position relative to the field centre (m)
  vec2 size;    // field size (m)
  float edgeD;  // distance to the nearest boundary (m)
  vec2 edgeN;   // unit normal toward that boundary
  float along;  // position along that boundary (m), identical from both sides
  float edgeKey;// boundary hash, identical from both sides
};

vec2 gBase(float L) { return uGOffDiv * (G_M / L); }
float gNoise(vec2 p, float L) { return tgNoiseB(p / L, gBase(L)); }
// Lattice base for a rotated frame (R is identity or a 3-4-5 rotation, which
// maps the master lattice onto whole multiples of every layout lattice).
vec2 gBaseR(float L, mat2 R) { return R * uGOffDiv * (G_M / L); }
float gNoiseR(vec2 p, float L, mat2 R) { return tgNoiseB(p / L, gBaseR(L, R)); }

// Enclosure-style patchwork: 384 m blocks split recursively into long
// rectangles, in a gently warped domain so boundaries wander a little.
// p is already in the region's rotated frame.
GField gLayout(vec2 p, float seed, mat2 R) {
  GField f;
  vec2 w = vec2(gNoiseR(p + 101.0, 768.0, R), gNoiseR(p + 517.0, 768.0, R)) - 0.5;
  w += (vec2(gNoiseR(p + 33.0, 192.0, R), gNoiseR(p + 71.0, 192.0, R)) - 0.5) * 0.3;
  vec2 pw = p + w * 64.0;
  vec2 bi = floor(pw / G_BLOCK);
  vec2 lo = bi * G_BLOCK;
  vec2 hi = lo + G_BLOCK;
  vec2 bkey = bi + gBaseR(G_BLOCK, R) + vec2(seed, seed * 1.7);
  float path = 1.0;
  for (int l = 0; l < 5; l++) {
    vec2 sz = hi - lo;
    vec2 h = tgHash2(bkey + vec2(path * 1.618, float(l) * 7.31));
    if (l >= 2 && h.y < 0.2) break;
    if (max(sz.x, sz.y) < 80.0) break;
    float r = tgHash(bkey + vec2(path * 3.7, 11.0 + float(l)));
    bool longX = sz.x >= sz.y;
    bool splitX = r < 0.72 ? longX : !longX;
    if (min(sz.x, sz.y) < 48.0) splitX = longX;
    float t = 0.3 + 0.4 * h.x;
    if (splitX) {
      float s = lo.x + sz.x * t;
      bool left = pw.x < s;
      if (left) hi.x = s; else lo.x = s;
      path = path * 2.0 + (left ? 0.0 : 1.0);
    } else {
      float s = lo.y + sz.y * t;
      bool low = pw.y < s;
      if (low) hi.y = s; else lo.y = s;
      path = path * 2.0 + (low ? 0.0 : 1.0);
    }
  }
  f.size = hi - lo;
  f.key = bkey + vec2(path * 0.37, path * 0.11);
  f.rel = pw - (lo + hi) * 0.5;
  vec2 dl = pw - lo;
  vec2 dh = hi - pw;
  float d = dl.x;
  f.edgeN = vec2(-1.0, 0.0);
  if (dh.x < d) { d = dh.x; f.edgeN = vec2(1.0, 0.0); }
  if (dl.y < d) { d = dl.y; f.edgeN = vec2(0.0, -1.0); }
  if (dh.y < d) { d = dh.y; f.edgeN = vec2(0.0, 1.0); }
  f.edgeD = d;
  bool vertical = f.edgeN.x != 0.0;
  float lineC = vertical ? (f.edgeN.x < 0.0 ? lo.x : hi.x) : (f.edgeN.y < 0.0 ? lo.y : hi.y);
  float alongC = vertical ? pw.y : pw.x;
  float lb = floor((lineC - 0.5) / G_BLOCK);
  float ab = floor(alongC / G_BLOCK);
  vec2 gl = (vertical ? vec2(lb, ab) : vec2(ab, lb)) + gBaseR(G_BLOCK, R);
  float lrel = floor(lineC - lb * G_BLOCK + 0.5);
  f.edgeKey = tgHash(gl * 1.13 + vec2(lrel * 0.071 + seed, vertical ? 5.0 : 0.0));
  f.along = alongC - ab * G_BLOCK;
  return f;
}

// Parallel strokes in a field's own frame; rel is relative to the field.
float gPenDir(GCtx c, vec2 rel, vec2 dir, float period, float w, float minPx, float maxPx, float gap, float seed, float tonal) {
  vec2 n = vec2(-dir.y, dir.x);
  return tgPen(dot(rel, n), dot(rel, dir), tgMpp(c.dpx, c.dpy, n), period, w, minPx * c.pr, maxPx * c.pr, gap * c.pr, seed, c.breakup, tonal);
}

// ---------------------------------------------------------------- marks
// Screen-space pen marks anchored at world points: grass tufts, dashes,
// clods. Sizes are in css px so the pen stays the same pen at any distance.
float gTuft(vec2 s, float sz, float h, float pr) {
  float d = tgSeg(s, vec2(0.0), vec2(-1.1, 3.0) * sz);
  d = min(d, tgSeg(s, vec2(0.2, 0.0) * sz, vec2(0.5 + h, 4.2) * sz));
  if (h > 0.4) d = min(d, tgSeg(s, vec2(0.3, 0.0) * sz, vec2(1.9, 2.6) * sz));
  return 1.0 - smoothstep(0.28 * pr, 0.85 * pr, d);
}

float gMeadow(GCtx c, float density, float bloom, float regular) {
  float cov = 0.0;
  // Near: grass tufts on a 0.75 m lattice (need >= 4 px vertical per cell).
  float cellPx = 0.75 / c.mppY / c.pr;
  float nearVis = smoothstep(3.0, 6.5, cellPx) * step(0.5, uGEnvD.z);
  if (nearVis > 0.0) {
    vec2 q = c.p / 0.75;
    vec2 base = floor(q);
    vec2 cb = gBase(0.75);
    float sz = clamp(10.0 / c.dist, 0.55, 1.3) * c.pr;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = base + vec2(float(i), float(j));
        vec2 h = tgHash2(cell + cb);
        // Clumps and bare patches.
        float clump = tgNoiseB(cell * 0.75 / 6.0, gBase(6.0));
        if (h.x > density * mix(1.0, 0.25 + 1.5 * clump, 1.0 - regular)) continue;
        vec2 o = mix(tgHash2(cell + cb + 7.3), vec2(0.5), regular) * 0.7 + 0.15;
        vec2 s = c.Jinv * (c.p - (cell + o) * 0.75);
        cov = max(cov, gTuft(s, sz, h.y, c.pr) * nearVis);
        if (bloom > 0.0 && h.y < bloom * 0.16) {
          vec2 fs = s - vec2(0.6, 4.6) * sz;
          float ring = abs(length(fs) - 1.2 * sz);
          cov = max(cov, (1.0 - smoothstep(0.25 * c.pr, 0.8 * c.pr, ring)) * nearVis);
        }
      }
    }
  }
  // Middle distance: short horizontal dashes on a 3 m lattice.
  float midPx = 3.0 / c.mppY / c.pr;
  float midVis = smoothstep(3.5, 7.0, midPx) * (1.0 - nearVis * 0.8);
  if (midVis > 0.0) {
    vec2 q = c.p / 3.0;
    vec2 cell = floor(q);
    vec2 h = tgHash2(cell + gBase(3.0));
    if (h.x < density * 0.7) {
      vec2 o = mix(tgHash2(cell + gBase(3.0) + 3.1), vec2(0.5), regular) * 0.5 + 0.25;
      vec2 s = c.Jinv * (c.p - (cell + o) * 3.0);
      float len = mix(1.5, 3.2, h.y) * c.pr;
      float d = tgSeg(s, vec2(-len, 0.0), vec2(len, 0.3 * c.pr));
      cov = max(cov, (1.0 - smoothstep(0.3 * c.pr, 0.85 * c.pr, d)) * midVis);
    }
  }
  return cov;
}

float gPlough(GCtx c, GField f, vec2 dir, float seed, vec3 sun) {
  vec2 et = vec2(-f.edgeN.y, f.edgeN.x);
  // Headland: a strip along the boundary ploughed parallel to it.
  vec2 d = f.edgeD < 7.0 ? et : dir;
  vec2 n = vec2(-d.y, d.x);
  float low = 1.0 - smoothstep(0.15, 0.8, sun.y);
  float across = abs(dot(normalize(sun.xz + 1e-4), n)) * low;
  float fu = gPenDir(c, f.rel, d, 0.9, 0.06 + 0.06 * across, 0.75, 1.7, 4.0, seed, 0.0);
  // Furrow shadow: a finer second stroke on the side away from a low sun.
  float sh = gPenDir(c, f.rel + n * 0.24, d, 0.9, 0.03, 0.55, 1.0, 8.0, seed + 5.0, 0.0) * across;
  return max(fu, sh * 0.75);
}

float gCrops(GCtx c, vec2 rel, vec2 dir, float seed) {
  vec2 n = vec2(-dir.y, dir.x);
  float x = dot(rel, n);
  float y = dot(rel, dir);
  float mppN = tgMpp(c.dpx, c.dpy, n);
  float mppD = tgMpp(c.dpx, c.dpy, dir);
  float row = floor(x / 0.72 + 0.5);
  float tram = mod(row, 24.0);
  float rows = tgPen(x, y, mppN, 0.72, 0.05, 0.7 * c.pr, 1.4 * c.pr, 4.5 * c.pr, seed, c.breakup, 0.0);
  float beadPx = 0.34 / mppD / c.pr;
  float bead = fract(y / 0.34 + tgHash(vec2(row, seed)));
  float beads = mix(1.0, step(0.42, bead), smoothstep(3.0, 6.0, beadPx));
  float v = rows * beads;
  if (tram < 0.5 || abs(tram - 2.0) < 0.5) v = rows;
  if (abs(tram - 1.0) < 0.5) v = 0.0;
  return v;
}

float gStubble(GCtx c, vec2 rel, vec2 dir, float seed) {
  vec2 n = vec2(-dir.y, dir.x);
  float x = dot(rel, n);
  float y = dot(rel, dir);
  float mppN = tgMpp(c.dpx, c.dpy, n);
  float mppD = tgMpp(c.dpx, c.dpy, dir);
  float row = floor(x / 1.6 + 0.5);
  float rows = tgPen(x, y, mppN, 1.6, 0.04, 0.6 * c.pr, 1.1 * c.pr, 5.0 * c.pr, seed, c.breakup, 0.0);
  float dash = step(0.6, fract(y / 0.9 + tgHash(vec2(row, seed + 2.0)) * 3.0));
  float dashPx = 0.9 / mppD / c.pr;
  return rows * mix(1.0, dash, smoothstep(2.5, 5.0, dashPx)) * 0.85;
}

// The ordered world: identical parcels ruled like graph paper, each with the
// same regular lattice of dots.
float gOrder(GCtx c, vec2 rel) {
  vec2 q = rel / 4.0;
  vec2 cell = floor(q + 0.5);
  vec2 s = c.Jinv * (rel - cell * 4.0);
  float spacingPx = 4.0 / c.mppY / c.pr;
  float vis = smoothstep(4.5, 9.0, spacingPx);
  float r = 0.85 * c.pr;
  return (1.0 - smoothstep(r - 0.5, r + 0.5, length(s))) * vis;
}

float gSlabs(GCtx c, vec2 rel, vec2 dir, float seed) {
  float a = gPenDir(c, rel, dir, 8.0, 0.035, 0.6, 1.1, 8.0, seed, 0.0);
  float b = gPenDir(c, rel, vec2(-dir.y, dir.x), 8.0, 0.035, 0.6, 1.1, 8.0, seed + 1.0, 0.0);
  // Oil and water stains: faint stipple blotches, near only.
  vec2 sc = floor(c.p / 0.5);
  float st = smoothstep(0.66, 0.7, gNoise(c.p + 13.0, 24.0)) * step(0.72, tgHash(sc + gBase(0.5)));
  return max(max(a, b), st * smoothstep(3.0, 6.0, 0.5 / c.mppY / c.pr) * 0.8);
}

// Cracked earth: polygon cracks at two scales.
float gCracks(GCtx c, float amount, float quality) {
  float cov = 0.0;
  vec2 cid;
  vec2 ts;
  vec2 sd;
  vec2 oid;
  // Major fissures: a broken, meandering network (not paving).
  vec2 wq = c.p + (vec2(gNoise(c.p + 5.0, 3.0), gNoise(c.p + 9.0, 3.0)) - 0.5) * 1.6;
  float e = tgVoronoi(wq / 6.0, 0.95, gBase(6.0), cid, ts, sd, oid) * 6.0;
  float mpp = tgMpp(c.dpx, c.dpy, normalize(sd));
  float vis = smoothstep(4.0, 9.0, 6.0 / c.mppY / c.pr);
  float keep = step(tgHash(cid + oid + 0.37 * abs(cid - oid)), 0.58);
  float w = mix(0.03, 0.1, tgHash(cid + oid)) * amount;
  cov = max(cov, tgLine(e, mpp, w, 0.75 * c.pr, 2.2 * c.pr) * vis * keep);
  if (quality > 0.5) {
    float e2 = tgVoronoi(c.p / 1.5, 0.85, gBase(1.5), cid, ts, sd, oid) * 1.5;
    float mpp2 = tgMpp(c.dpx, c.dpy, normalize(sd));
    float vis2 = smoothstep(4.0, 8.0, 1.5 / c.mppY / c.pr) * smoothstep(0.35, 0.8, amount);
    float w2 = mix(0.008, 0.03, tgHash(cid * 1.3 + oid)) * amount;
    cov = max(cov, tgLine(e2, mpp2, w2, 0.6 * c.pr, 1.4 * c.pr) * vis2);
  }
  return cov;
}

// Craters: rim, shaded bowl and radial ejecta on a 64 m lattice.
float gCraters(GCtx c, float ruin, vec3 sun, float quality, out float scorch) {
  scorch = 0.0;
  vec2 cell = floor(c.p / 64.0);
  vec2 cb = gBase(64.0);
  vec2 h = tgHash2(cell + cb + 41.0);
  if (h.x > ruin * 0.6) return 0.0;
  vec2 ctr = (cell + 0.3 + 0.4 * tgHash2(cell + cb + 5.0)) * 64.0;
  float R = mix(3.5, 9.0, h.y);
  vec2 d = c.p - ctr;
  float r = length(d);
  if (r > R * 2.2) return 0.0;
  vec2 dn = d / max(r, 1e-3);
  float mppR = tgMpp(c.dpx, c.dpy, dn);
  float cov = tgLine(r - R, mppR, 0.2, 1.0 * c.pr, 2.4 * c.pr);
  cov = max(cov, tgLine(r - R * 0.72, mppR, 0.05, 0.6 * c.pr, 1.2 * c.pr) * 0.8);
  float bowl = (1.0 - smoothstep(R * 0.95, R, r)) * smoothstep(-0.2, 0.6, dot(dn, normalize(sun.xz + 1e-4)));
  scorch = max(bowl * 0.62, (1.0 - smoothstep(R, R * 2.0, r)) * 0.3);
  if (quality > 0.5 && r > R * 1.05) {
    float a = atan(d.y, d.x);
    float k = floor(a / 0.2244 + 0.5);
    float on = step(tgHash(vec2(k, h.y * 91.0)), 0.55);
    float reach = R * mix(1.35, 2.1, tgHash(vec2(k * 1.7, h.x * 53.0)));
    float off = r * abs(a - k * 0.2244);
    vec2 tn = vec2(-dn.y, dn.x);
    float ray = tgLine(off, tgMpp(c.dpx, c.dpy, tn), 0.12 * (1.0 - (r - R) / (reach - R)), 0.55 * c.pr, 1.8 * c.pr);
    cov = max(cov, ray * on * (1.0 - smoothstep(reach * 0.85, reach, r)));
  }
  return cov;
}

// Hatching for tone (cast shadows, night, gloom). Families are aligned so
// they stay continuous across the master lattice.
float gHatch(GCtx c, float tone) {
  float h = 0.0;
  float t1 = smoothstep(0.1, 0.26, tone);
  float t2 = smoothstep(0.42, 0.58, tone);
  float t3 = smoothstep(0.66, 0.8, tone);
  float r2 = 0.70710678;
  if (t1 > 0.0) {
    vec2 n = vec2(r2, r2);
    h = max(h, tgPen(dot(c.p, n), dot(c.p, vec2(-r2, r2)), tgMpp(c.dpx, c.dpy, n), 0.2 * r2, 0.2 * r2 * (0.12 + 0.42 * tone), 0.7 * c.pr, 2.4 * c.pr, 3.4 * c.pr, 3.0, c.breakup, 1.0) * t1);
  }
  if (t2 > 0.0) {
    vec2 n = vec2(r2, -r2);
    h = max(h, tgPen(dot(c.p, n), dot(c.p, vec2(r2, r2)), tgMpp(c.dpx, c.dpy, n), 0.2 * r2, 0.2 * r2 * (0.1 + 0.36 * tone), 0.7 * c.pr, 2.2 * c.pr, 3.4 * c.pr, 7.0, c.breakup, 1.0) * t2);
  }
  if (t3 > 0.0) {
    h = max(h, tgPen(c.p.x, c.p.y, tgMpp(c.dpx, c.dpy, vec2(1.0, 0.0)), 0.12, 0.12 * (0.1 + 0.4 * tone), 0.7 * c.pr, 2.0 * c.pr, 3.2 * c.pr, 11.0, c.breakup, 1.0) * t3);
  }
  return max(h, smoothstep(0.88, 0.96, tone));
}
`;

const FRAGMENT_OUT = /* glsl */ `
{
  GCtx c;
  c.p = vGScene.xz + uGOffMod;
  c.dpx = dFdx(vGScene.xz);
  c.dpy = dFdy(vGScene.xz);
  float det = c.dpx.x * c.dpy.y - c.dpx.y * c.dpy.x;
  c.Jinv = abs(det) > 1e-14 ? inverse(mat2(c.dpx, c.dpy)) : mat2(0.0);
  c.dist = length(vViewPosition);
  c.focal = uPxScale.x;
  c.pr = max(uPxScale.y, 0.5);
  c.mppY = max(length(c.dpy), 1e-6);

  float veg = uGEnvA.x;
  float bloom = uGEnvA.y;
  float drought = uGEnvA.z;
  float ruin = uGEnvA.w;
  float fire = uGEnvB.x;
  float perfect = uGEnvB.y;
  float uniformity = uGEnvB.z;
  float industry = uGEnvB.w;
  float compute = uGEnvC.x;
  float habit = uGEnvC.y;
  float night = uGEnvC.z;
  float storm = uGEnvC.w;
  float gloom = uGEnvD.x;
  float quality = uGEnvD.z;
  float seed = uGEnvD.w;
  c.breakup = 1.0 - perfect * 0.92;
  vec3 sun = inkSunWorld();

  // Light: shade by light relative to an unshadowed level surface.
  float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float lit = lum / inkRefLight();
  float shadow = clamp(1.0 - lit, 0.0, 1.0);

  // ------------------------------------------------------------ layout
  // Ordered regions (uniformity) replace the patchwork with a square grid.
  float regionN = gNoise(c.p + 311.0, 768.0);
  float orderThr = uniformity * 1.2 - 0.1;
  float ordered = step(regionN, orderThr);
  float regionMpp = abs(dFdx(regionN)) + abs(dFdy(regionN));

  GField f;
  // Estates: regions whose fields run at different bearings, parted by lanes.
  float estN = gNoise(c.p + 1234.0, 1536.0);
  float estLane = min(abs(estN - 0.36), abs(estN - 0.64)) / max(abs(dFdx(estN)) + abs(dFdy(estN)), 1e-7);
  vec2 frameX = vec2(1.0, 0.0);
  vec2 frameY = vec2(0.0, 1.0);
  if (ordered > 0.5) {
    vec2 gq = c.p / G_GRID;
    vec2 gc = floor(gq);
    vec2 gf = gq - gc;
    f.key = gc + gBase(G_GRID);
    f.rel = (gf - 0.5) * G_GRID;
    f.size = vec2(G_GRID);
    vec2 e4 = min(gf, 1.0 - gf) * G_GRID;
    f.edgeD = min(e4.x, e4.y);
    f.edgeN = e4.x < e4.y ? vec2(gf.x < 0.5 ? -1.0 : 1.0, 0.0) : vec2(0.0, gf.y < 0.5 ? -1.0 : 1.0);
    f.along = e4.x < e4.y ? gf.y * G_GRID : gf.x * G_GRID;
    f.edgeKey = 0.99;
  } else {
    float est = estN < 0.36 ? 0.0 : estN < 0.64 ? 1.0 : 2.0;
    mat2 R = est < 0.5 ? mat2(1.0) : est < 1.5 ? mat2(0.8, 0.6, -0.6, 0.8) : mat2(0.8, -0.6, 0.6, 0.8);
    f = gLayout(R * c.p, seed + est * 17.0, R);
    // Back to world: rotate the field's frame by R^-1 = R^T.
    mat2 Rt = transpose(R);
    f.rel = Rt * f.rel;
    f.edgeN = Rt * f.edgeN;
    frameX = Rt * frameX;
    frameY = Rt * frameY;
    f.key += est * 101.0;
  }
  vec2 edgeT = vec2(-f.edgeN.y, f.edgeN.x);

  // ------------------------------------------------------------ field kind
  float kind;
  vec2 dir;
  float fseed = tgHash(f.key + 3.7) * 50.0;
  if (ordered > 0.5) {
    kind = 5.0; // identical parcels, all aligned, all in phase
    dir = vec2(1.0, 0.0);
    fseed = 1.0;
  } else {
    float wMeadow = max(0.0, 0.34 + 0.4 * veg - 0.45 * industry - 0.3 * compute - 0.3 * drought);
    float wPlough = 0.2 + 0.12 * habit + 0.1 * drought;
    float wCrop = max(0.0, 0.26 + 0.14 * habit - 0.25 * drought - 0.2 * ruin);
    float wFallow = 0.07 + 0.5 * drought + 0.45 * ruin;
    float wHard = 0.7 * industry + 0.55 * compute;
    float total = wMeadow + wPlough + wCrop + wFallow + wHard;
    float r = tgHash(f.key + 17.3) * total;
    kind = r < wMeadow ? 0.0 : r < wMeadow + wPlough ? 1.0 : r < wMeadow + wPlough + wCrop ? 2.0 : r < total - wHard ? 3.0 : 4.0;
    // Furrows and rows run with the long side of the field, mostly.
    bool longX = f.size.x >= f.size.y;
    if (tgHash(f.key + 9.1) < 0.18) longX = !longX;
    dir = longX ? frameX : frameY;
  }

  // ------------------------------------------------------------ field interior
  float fieldFade = 1.0 - smoothstep(130.0, 340.0, c.dist);
  float field = 0.0;
  if (fieldFade > 0.0) {
    if (kind < 0.5) field = gMeadow(c, clamp(0.5 * veg * (1.0 - 0.75 * drought) + 0.05, 0.0, 0.7), bloom * veg, perfect);
    else if (kind < 1.5) field = gPlough(c, f, dir, fseed, sun);
    else if (kind < 2.5) field = gCrops(c, f.rel, dir, fseed);
    else if (kind < 3.5) field = gStubble(c, f.rel, dir, fseed);
    else if (kind < 4.5) field = gSlabs(c, f.rel, dir, fseed);
    else field = gOrder(c, f.rel);
    if (kind > 1.5 && kind < 2.5) field *= 1.0 - 0.6 * drought;
    field *= fieldFade;
  }

  // ------------------------------------------------------------ boundaries
  float mppE = tgMpp(c.dpx, c.dpy, f.edgeN);
  float minField = min(f.size.x, f.size.y);
  // Lines whose neighbours would crowd closer than a few px fade out.
  float crowd = minField * 0.5 / mppE / c.pr;
  float bVis = (ordered > 0.5 ? smoothstep(2.5, 6.0, crowd) : smoothstep(5.0, 12.0, crowd)) * (1.0 - 0.55 * smoothstep(260.0, 800.0, c.dist));
  float boundary = tgLine(f.edgeD, mppE, ordered > 0.5 ? 0.12 : 0.2, (ordered > 0.5 ? 0.85 : 1.0) * c.pr, (ordered > 0.5 ? 1.5 : 2.6) * c.pr);
  float hedgeW = ordered > 0.5 ? 0.0 : clamp(0.2 + 0.55 * veg - 0.4 * industry - 0.3 * drought - 0.3 * ruin, 0.0, 0.8);
  vec2 Bn = f.edgeN * f.edgeD;
  if (ordered < 0.5 && f.edgeKey < hedgeW) {
    // Hedgerow: a scalloped crown standing on the boundary.
    float k = floor(f.along / 1.9 + 0.5) * 1.9;
    vec2 B = c.p + Bn + edgeT * (k - f.along);
    vec2 s = c.Jinv * (c.p - B);
    float Rpx = clamp(1.05 * c.focal / c.dist, 1.2 * c.pr, 16.0 * c.pr);
    float crownVis = smoothstep(2.0 * c.pr, 3.5 * c.pr, Rpx);
    float hump = abs(length(s - vec2(0.0, Rpx * 0.2)) - Rpx);
    float crown = (1.0 - smoothstep(0.3 * c.pr, 0.95 * c.pr, hump)) * step(Rpx * 0.2, s.y);
    float inside = step(0.0, s.y) * step(length(s - vec2(0.0, Rpx * 0.2)), Rpx);
    float strokes = step(0.66, fract(s.x / (2.3 * c.pr) + tgHash(vec2(k, 3.0))));
    float bodyVis = smoothstep(5.0 * c.pr, 8.0 * c.pr, Rpx);
    boundary = max(boundary, crown * crownVis * bVis * 1.3);
    boundary = max(boundary, inside * strokes * 0.6 * bodyVis);
  } else if (f.edgeKey < hedgeW + 0.3 + 0.3 * habit + 0.4 * perfect) {
    // Fence: posts every 3 m, with a wire at post-top height.
    float k = floor(f.along / 3.0 + 0.5) * 3.0;
    vec2 B = c.p + Bn + edgeT * (k - f.along);
    vec2 s = c.Jinv * (c.p - B);
    float Hpx = clamp(1.25 * c.focal / c.dist, 1.5 * c.pr, 26.0 * c.pr);
    float post = 1.0 - smoothstep(0.35 * c.pr, 0.9 * c.pr, tgSeg(s, vec2(0.0), vec2(0.0, Hpx)));
    vec2 nb = c.Jinv * (edgeT * 3.0);
    vec2 top = vec2(0.0, Hpx * 0.85);
    float wire = 1.0 - smoothstep(0.2 * c.pr, 0.7 * c.pr, min(tgSeg(s, top, top + nb), tgSeg(s, top, top - nb)));
    float fenceVis = smoothstep(2.0 * c.pr, 5.0 * c.pr, Hpx) * (1.0 - smoothstep(160.0, 260.0, c.dist));
    boundary = max(boundary, max(post, wire * 0.8) * fenceVis);
  } else if (ordered < 0.5) {
    // Ditch: a second, broken line a metre inside.
    float dd = tgLine(f.edgeD - 1.1, mppE, 0.05, 0.65 * c.pr, 1.4 * c.pr) * step(0.35, tgNoise(vec2(f.along / 2.0, f.edgeKey * 40.0)));
    boundary = max(boundary, dd * 0.8 * bVis * (1.0 - smoothstep(90.0, 160.0, c.dist)));
  }
  boundary *= mix(1.0, bVis, 0.85);
  // Estate borders: a lane edge where the field bearings change.
  if (ordered < 0.5) boundary = max(boundary, (1.0 - smoothstep(0.5 * c.pr, 1.2 * c.pr, estLane)) * (1.0 - 0.5 * smoothstep(300.0, 800.0, c.dist)));
  // The edge of an ordered region is ruled with a single hard line.
  float regionLine = (1.0 - smoothstep(0.4 * c.pr, 1.1 * c.pr, abs(regionN - orderThr) / max(regionMpp, 1e-6))) * step(0.001, uniformity) * step(orderThr, 1.0);
  boundary = max(boundary, regionLine);

  // Survey pegs at the corners of ordered parcels.
  if (ordered > 0.5) {
    vec2 gq = c.p / G_GRID;
    vec2 corner = floor(gq + 0.5) * G_GRID;
    vec2 s = c.Jinv * (c.p - corner);
    float Hpx = clamp(0.8 * c.focal / c.dist, 1.2 * c.pr, 14.0 * c.pr);
    float peg = 1.0 - smoothstep(0.4 * c.pr, 1.0 * c.pr, tgSeg(s, vec2(0.0), vec2(0.0, Hpx)));
    boundary = max(boundary, peg * smoothstep(1.5 * c.pr, 3.0 * c.pr, Hpx));
  }

  // ------------------------------------------------------------ damage
  float pristine = 1.0 - perfect;
  float dmask = smoothstep(0.0, 0.25, drought * 1.25 - gNoise(c.p + 71.0, 192.0)) * pristine;
  float cracks = dmask > 0.0 ? gCracks(c, dmask, quality) * (1.0 - smoothstep(120.0, 260.0, c.dist)) : 0.0;

  float scorchTone = 0.0;
  float craters = 0.0;
  float embers = 0.0;
  if (ruin > 0.01) {
    float cs;
    craters = gCraters(c, ruin * pristine, sun, quality, cs) * (1.0 - smoothstep(250.0, 500.0, c.dist));
    float sN = gNoise(c.p, 48.0) * 0.55 + gNoise(c.p + 7.0, 24.0) * 0.3 + gNoise(c.p + 3.0, 12.0) * 0.15;
    float sm = smoothstep(0.0, 0.05, sN + ruin * 0.3 - 0.82) * pristine;
    vec2 sc = floor(c.p / 0.5);
    vec2 sh = tgHash2(sc + gBase(0.5));
    vec2 so = c.Jinv * (c.p - (sc + 0.2 + 0.6 * sh) * 0.5);
    float dotPx = 0.9 * c.pr;
    float stip = (1.0 - smoothstep(dotPx * 0.5, dotPx, length(so))) * step(sh.x, 0.55) * smoothstep(2.0, 4.0, 0.5 / c.mppY / c.pr);
    scorchTone = max(cs * pristine, sm * 0.36);
    craters = max(craters, stip * sm);
    float edgeLine = 1.0 - smoothstep(0.4 * c.pr, 1.1 * c.pr, abs(sN + ruin * 0.3 - 0.82) / max(abs(dFdx(sN)) + abs(dFdy(sN)), 1e-6));
    craters = max(craters, edgeLine * (1.0 - smoothstep(150.0, 400.0, c.dist)) * pristine);
    if (fire > 0.01) {
      vec2 ec = floor(c.p / 1.5);
      vec2 eh = tgHash2(ec + gBase(1.5) + 9.0);
      vec2 es = c.Jinv * (c.p - (ec + 0.25 + 0.5 * eh) * 1.5);
      float flick = 0.55 + 0.45 * sin(uInkTime * (2.0 + eh.y * 3.0) + eh.x * 40.0);
      embers = (1.0 - smoothstep(0.8 * c.pr, 1.8 * c.pr, length(es))) * step(eh.x, fire * 0.07) * sm * flick * (1.0 - smoothstep(30.0, 70.0, c.dist));
    }
  }

  // ------------------------------------------------------------ tone
  // Cast shadows take a single family of ruling, the engraver's convention.
  float shadeTone = smoothstep(0.08, 0.5, shadow) * 0.4;
  float tone = clamp(shadeTone + min(scorchTone, 0.55) + uInkTension * 0.05, 0.0, 0.78);
  float hatch = gHatch(c, tone);
  // Ambient darkness (night, gloom) is ruled like the sky: straight lines
  // parallel to the horizon, so land and sky darken as one engraving.
  float amb = clamp(night * 0.6, 0.0, 1.0);
  float ruled = 0.0;
  if (amb > 0.01) {
    vec3 vv = -vViewPosition;
    vec3 U = mat3(viewMatrix) * vec3(0.0, 1.0, 0.0);
    vec2 sp = c.focal * vv.xy / max(-vv.z, 1e-4);
    float hPx = (dot(sp, U.xy) - c.focal * U.z) / max(length(U.xy), 1e-4);
    float t = amb * (0.82 + 0.18 * smoothstep(-30.0 * c.pr, -260.0 * c.pr, hPx));
    float spacing = 3.4 * c.pr;
    float minW = 0.75 * c.pr;
    float lvl = clamp(log2(minW / max(t * spacing, 1e-4)), 0.0, 4.0);
    float per = spacing * exp2(floor(lvl));
    float u = hPx / per;
    float idx = floor(u + 0.5);
    float w = max(t * per, minW);
    ruled = 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, abs(u - idx) * per);
    ruled *= 1.0 - mod(idx, 2.0) * fract(lvl) * step(lvl, 3.999);
    ruled = max(ruled, smoothstep(0.86, 0.95, t));
  }

  float cov = max(max(field, boundary), max(cracks, craters));
  cov = max(cov * (1.0 - night * 0.45), max(hatch, ruled));
  vec2 accent = vec2(0.0);
  if (embers > 0.01) {
    accent = vec2(embers, 6.0);
    cov = max(cov, embers * 0.3);
  }
  pc_fragColor = vec4(clamp(cov, 0.0, 1.0), accent.x, accent.y / 8.0, uGEdge);
  gInkOut1 = vec4(normal * 0.5 + 0.5, uGObjectId);
}
`;

const tmpScene = new THREE.Vector3();

export function createGround(options: GroundOptions = {}): GroundModule {
  const seedValue = hashString(String(options.seed ?? "ground")) % 997;
  const quality = options.quality ?? "high";
  const grid = buildNestedGrid({ baseStep: options.baseStep ?? 2, cellsHalf: 32, outer: options.radius ?? 1536 });
  const uniforms = {
    ...TERRAIN_UNIFORMS,
    uGEnvA: { value: new THREE.Vector4(1, 0.5, 0, 0) },
    uGEnvB: { value: new THREE.Vector4(0, 0, 0, 0) },
    uGEnvC: { value: new THREE.Vector4(0, 0.2, 0, 0) },
    uGEnvD: { value: new THREE.Vector4(0, 0, quality === "low" ? 0 : 1, seedValue) },
    uGOffMod: { value: new THREE.Vector2() },
    uGOffDiv: { value: new THREE.Vector2() },
    uGEdge: { value: 0.7 },
    uGObjectId: { value: options.objectId ?? 0 },
    uPxScale: { value: new THREE.Vector3(700, 1, 720) },
  };
  const material = createInkLambert({
    key: "ink-ground-v4",
    uniforms,
    vertexHead: VERTEX_HEAD,
    vertexNormal: VERTEX_NORMAL,
    vertexBegin: VERTEX_BEGIN,
    fragmentHead: FRAGMENT_HEAD,
    fragmentOut: FRAGMENT_OUT,
  });
  const mesh = new THREE.Mesh(grid.geometry, material);
  mesh.name = "ground";
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.castShadow = false;
  mesh.renderOrder = -1;
  trackPixelScale(mesh, uniforms.uPxScale);

  const snap = grid.snapStep;
  return {
    object: mesh,
    uniforms,
    triangles: grid.triangles,
    heightAt,
    update(_dt, env, rigWorld) {
      const off = INK_GLOBALS.uInkWorldOffset.value;
      syncTerrainOrigin(off);
      // Master-lattice split of the offset, in double precision.
      const M = GROUND_LATTICE;
      const dx = Math.floor(off.x / M);
      const dz = Math.floor(off.z / M);
      uniforms.uGOffDiv.value.set(dx, dz);
      uniforms.uGOffMod.value.set(off.x - dx * M, off.z - dz * M);
      // Recentre on the rig in whole coarse steps (world lattice), then
      // express that in the parent's frame (the parent may itself be offset).
      const sx = Math.round(rigWorld.x / snap) * snap;
      const sz = Math.round(rigWorld.z / snap) * snap;
      tmpScene.set(sx - off.x, 0, sz - off.z);
      if (mesh.parent) {
        mesh.parent.updateWorldMatrix(true, false);
        mesh.parent.worldToLocal(tmpScene);
      }
      mesh.position.copy(tmpScene);
      const night = THREE.MathUtils.smoothstep(env.timeOfDay, 0.8, 0.94) + (1 - THREE.MathUtils.smoothstep(env.timeOfDay, 0.02, 0.14)) * 0.55;
      uniforms.uGEnvA.value.set(env.vegetation, env.bloom, env.drought, env.ruin);
      uniforms.uGEnvB.value.set(env.fire, env.perfection, env.uniformity, env.industry);
      uniforms.uGEnvC.value.set(env.compute, env.habitation, Math.min(1, night), env.storm);
      uniforms.uGEnvD.value.x = env.gloom;
      uniforms.uGEnvD.value.y = env.fog;
    },
    dispose() {
      grid.geometry.dispose();
      material.dispose();
    },
  };
}
