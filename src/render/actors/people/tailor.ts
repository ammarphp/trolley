/**
 * The tailor: turns a Body and an Outfit into bone-bound parts.
 *
 * Authoring happens in rest-pose mesh space (metres, floor at y = 0, facing
 * +z, the figure's left is +x); `w()` re-expresses a part in its bone's frame.
 * Each body segment is modelled once as its outermost surface (a sleeve is the
 * arm, trousers are the leg) so the figure stays within budget; overlays that
 * need their own edge (vests, bands, lapels, collars) are thin proud shells
 * cut from the same torso profile, which is what makes them draw as seams.
 */
import * as THREE from "three";
import type { PartOptions } from "../../core/geometry.ts";
import { block, cylinder, sphere, tube } from "../../core/geometry.ts";
import type { AccentName } from "../../core/palette.ts";
import type { Rng } from "../../core/rng.ts";
import type { Body } from "./anatomy.ts";
import { B, type PartSink } from "./rig.ts";
import {
  ellipseRing,
  ellipsoid,
  headShape,
  keepTriangles,
  limb,
  loft,
  mittenShape,
  noseShape,
  rimmed,
  rumple,
  shoeShape,
  slab,
  type Ring,
} from "./shapes.ts";
import { heldProp, type HeldProp, type PropPart } from "./props.ts";

export type HairStyle = "crop" | "short" | "long" | "bun" | "ponytail" | "bald" | "receding" | "curly" | "buzz";
export type FacialHair = "none" | "beard" | "moustache" | "stubble";
export type HatKind = "none" | "hardhat" | "peaked" | "helmet" | "flatcap" | "trilby" | "beanie" | "headscarf" | "hood" | "straw" | "riot";
export type TopKind =
  | "tee"
  | "shirt"
  | "jumper"
  | "hoodie"
  | "jacket"
  | "suit"
  | "coat"
  | "trench"
  | "labcoat"
  | "gown"
  | "scrubs"
  | "coverall"
  | "frock"
  | "cardigan"
  | "dress"
  | "fatigue"
  | "raincoat";
export type LegKind = "trousers" | "jeans" | "shorts" | "skirt" | "bare" | "cargo";
export type FootKind = "shoes" | "boots" | "trainers" | "wellies" | "slippers" | "clogs";
export type OverKind = "none" | "hivis" | "tabard" | "plate" | "stab" | "bib" | "blanket";
export type Extra =
  | "tie"
  | "lanyard"
  | "stethoscope"
  | "scarf"
  | "redscarf"
  | "toolbelt"
  | "goggles"
  | "glasses"
  | "earDefenders"
  | "badge"
  | "wristband"
  | "belt"
  | "radio"
  | "watchchain"
  | "backpack"
  | "shoulderBag"
  | "kneepads"
  | "gloves"
  | "mask"
  | "epaulettes"
  | "buttons2"
  | "pocketSquare"
  | "hoodDown"
  | "bands"
  | "fobwatch"
  | "headphones";

export interface Outfit {
  skin: number;
  hair: HairStyle;
  hairTone: number;
  facial: FacialHair;
  hat: HatKind;
  hatTone: number;
  hatAccent?: AccentName;
  top: TopKind;
  topTone: number;
  topAccent?: AccentName;
  topAmount?: number;
  sleeves: "long" | "short" | "rolled";
  shirtTone: number;
  /** Coat / skirt / gown hem height above the floor (m), or null. */
  hem: number | null;
  /** Front opening of long coats (0 closed .. 1 wide open). */
  open: number;
  legs: LegKind;
  legTone: number;
  feet: FootKind;
  feetTone: number;
  over: OverKind;
  overTone: number;
  overAccent?: AccentName;
  extras: Extra[];
  tieTone: number;
  bagTone: number;
}

export interface Dressing {
  /** Props held in each hand for this pose. */
  right: HeldProp | null;
  left: HeldProp | null;
  /** Remove the hat from the head and drop it beside the body (tied). */
  dropHat: boolean;
  /** Body lies along x with its head toward this side (for dropped hats). */
  headSide: 1 | -1;
}

const TONE = { paper: 0, pale: 0.12, light: 0.26, mid: 0.42, dark: 0.62, deep: 0.8, solid: 1 } as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ringAt(rings: Ring[], y: number): Ring {
  if (y <= rings[0]!.y) return { ...rings[0]!, y };
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]!;
    const b = rings[i + 1]!;
    if (y <= b.y) {
      const t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return {
        y,
        w: lerp(a.w, b.w, t),
        f: lerp(a.f, b.f, t),
        b: lerp(a.b, b.b, t),
        x: lerp(a.x ?? 0, b.x ?? 0, t),
        z: lerp(a.z ?? 0, b.z ?? 0, t),
        p: lerp(a.p ?? 2, b.p ?? 2, t),
      };
    }
  }
  return { ...rings[rings.length - 1]!, y };
}

export class Tailor {
  readonly s: number;
  readonly rl: number; // limb radial segments
  readonly rt: number; // torso radial segments
  readonly rp: number; // panel radial segments (cut garments)
  readonly rr: number; // tubular segments for rings (bands, cuffs, straps)
  readonly profile: Ring[];
  readonly chestY: number;
  /** Parts for a hat to be dropped instead of worn. */
  hatParts: PropPart[] = [];
  seed: number;

  constructor(
    readonly sink: PartSink,
    readonly b: Body,
    readonly W: THREE.Vector3[],
    readonly detail: number,
    readonly rng: Rng,
  ) {
    this.s = b.H / 1.78;
    this.rl = detail >= 2 ? 9 : detail >= 1 ? 7 : detail >= 0 ? 5 : 3;
    this.rt = detail >= 2 ? 16 : detail >= 1 ? 12 : detail >= 0 ? 8 : 5;
    this.rp = detail >= 2 ? 22 : detail >= 1 ? 16 : detail >= 0 ? 10 : 6;
    this.rr = detail >= 2 ? 16 : detail >= 1 ? 11 : detail >= 0 ? 8 : 6;
    this.chestY = b.H * 0.72 * (b.age === "child" ? 0.985 : 1);
    this.profile = this.bodyProfile();
    this.seed = rng.int(1, 9999);
  }

  // ----------------------------------------------------------------- output

  /** Add a part authored in rest mesh space to `bone`. */
  w(bone: number, g: THREE.BufferGeometry, tone: number, o: Partial<PartOptions> = {}): void {
    const p = this.W[bone]!;
    g.translate(-p.x, -p.y, -p.z);
    this.sink.add(bone, g, { tone, ...o });
  }
  /** Add a part authored in the bone's local frame. */
  l(bone: number, g: THREE.BufferGeometry, tone: number, o: Partial<PartOptions> = {}): void {
    this.sink.add(bone, g, { tone, ...o });
  }

  /** Detail-aware rounded slab (bags, pouches): a plain box at crowd distance. */
  slab(w: number, h: number, d: number, round = 0.2): THREE.BufferGeometry {
    if (this.detail < 0) return block(w, h, d);
    return slab(w, h, d, round, this.detail >= 2 ? 10 : this.detail >= 1 ? 8 : 6);
  }

  /** Soft fold relief for cloth (shading only; too shallow to ink as lines). */
  cloth(g: THREE.BufferGeometry, amount = 0.004): THREE.BufferGeometry {
    if (this.detail < 1) return g;
    return rumple(g, amount * this.s, this.seed + g.getAttribute("position").count, 34);
  }

  /** Detail-aware limb: fewer profile samples and single-step caps when small. */
  limb(len: number, radii: number[], radial: number, opts: Parameters<typeof limb>[3] = {}): THREE.BufferGeometry {
    let r = radii;
    if (this.detail <= 0 && r.length > 3) r = [r[0]!, r[Math.floor(r.length / 2)]!, r[r.length - 1]!];
    const caps = this.detail >= 2 ? 2 : this.detail >= 1 ? 2 : 1;
    return limb(len, r, radial, { capsTop: caps, capsBottom: this.detail >= 2 ? 2 : 1, ...opts });
  }

  // ---------------------------------------------------------------- profile

  private bodyProfile(): Ring[] {
    const b = this.b;
    const s = this.s;
    const cy = this.chestY;
    const fem = b.fem;
    const rings: Ring[] = [
      { y: b.crotchY - 0.01 * s, w: b.hipX + b.thighR * 0.55, f: b.hipF * 0.5, b: b.hipB * 0.62, p: 2 },
      { y: b.crotchY + 0.035 * s, w: b.hipW * 0.94, f: b.hipF * 0.88, b: b.hipB * 1.02, z: -0.004 },
      { y: b.hipY + 0.02 * s, w: b.hipW, f: b.hipF, b: b.hipB * 0.97 },
      { y: lerp(b.hipY, b.waistY, 0.6), w: lerp(b.hipW, b.waistW, 0.62), f: lerp(b.hipF, b.waistF, 0.7), b: lerp(b.hipB, b.waistB, 0.7) },
      { y: b.waistY, w: b.waistW, f: b.waistF, b: b.waistB },
      { y: lerp(b.waistY, cy, 0.5), w: lerp(b.waistW, b.chestW, 0.62), f: lerp(b.waistF, b.chestF, 0.4 + fem * 0.1) * (1 - fem * 0.06), b: lerp(b.waistB, b.chestB, 0.6) },
    ];
    if (fem > 0.5 && b.age !== "child") rings.push({ y: cy - 0.045 * s, w: b.chestW * 0.97, f: b.chestF * 0.92, b: b.chestB });
    rings.push(
      { y: cy, w: b.chestW, f: b.chestF, b: b.chestB },
      { y: b.shoulderY - 0.075 * s, w: b.chestW * 1.02, f: b.chestF * (0.94 - fem * 0.08), b: b.chestB * 1.0 },
      { y: b.shoulderY - 0.02 * s, w: b.shoulderW * 0.93, f: 0.085 * s, b: 0.088 * s, z: -0.008 * s, p: 2.2 },
      { y: b.shoulderY + 0.022 * s, w: b.shoulderW * 0.8, f: 0.066 * s, b: 0.075 * s, z: -0.012 * s },
      { y: b.shoulderY + 0.056 * s, w: lerp(b.shoulderW, b.neckR * 1.25, 0.6), f: 0.058 * s, b: 0.068 * s, z: -0.015 * s },
      { y: b.neckY + 0.03 * s, w: b.neckR * 1.2, f: b.neckR * 1.02, b: b.neckR * 1.2, z: -0.02 * s },
    );
    return rings;
  }

  /** Rings of the body profile between y0 and y1, eased outward. */
  slice(y0: number, y1: number, ease: number, opts: { p?: number; easeF?: number; easeB?: number; steps?: number; scaleW?: number } = {}): Ring[] {
    const src = this.profile;
    const ys = [y0];
    for (const r of src) if (r.y > y0 + 1e-4 && r.y < y1 - 1e-4) ys.push(r.y);
    ys.push(y1);
    const steps = opts.steps ?? 0;
    const out: Ring[] = [];
    for (let i = 0; i < ys.length; i++) {
      const r = ringAt(src, ys[i]!);
      out.push({
        ...r,
        w: (r.w + ease) * (opts.scaleW ?? 1),
        f: r.f + (opts.easeF ?? ease),
        b: r.b + (opts.easeB ?? ease),
        p: opts.p ?? r.p,
      });
      if (steps > 0 && i < ys.length - 1) {
        for (let k = 1; k <= steps; k++) {
          const yy = lerp(ys[i]!, ys[i + 1]!, k / (steps + 1));
          const rr = ringAt(src, yy);
          out.push({ ...rr, w: (rr.w + ease) * (opts.scaleW ?? 1), f: rr.f + (opts.easeF ?? ease), b: rr.b + (opts.easeB ?? ease), p: opts.p ?? rr.p });
        }
      }
    }
    return out;
  }

  /** A proud panel cut from the torso profile (vests, lapels, bibs, bands). */
  panel(y0: number, y1: number, ease: number, keep: (c: THREE.Vector3) => boolean, opts: { p?: number; steps?: number } = {}): THREE.BufferGeometry {
    const steps = Math.min(opts.steps ?? 0, this.detail + 1);
    const rings = this.slice(y0, y1, ease, { p: opts.p, steps });
    const g = loft(rings, this.rp, {});
    const cut = keepTriangles(g, keep);
    return this.detail >= 0 ? rimmed(cut, Math.max(0.006, ease * 0.6)) : cut;
  }

  /** A band ring around the torso at y (e.g. reflective tape, belts). */
  band(y: number, h: number, ease: number): THREE.BufferGeometry {
    const rings = this.slice(y - h / 2, y + h / 2, ease);
    const g = loft([rings[0]!, rings[rings.length - 1]!], this.rt, {});
    return this.detail >= 0 ? rimmed(g, Math.max(0.006, ease * 0.5)) : g;
  }

  /** A point on the eased torso surface at (x, y), front (+1) or back (-1). */
  surf(x: number, y: number, ease: number, side: 1 | -1, out = new THREE.Vector3(), p?: number): THREE.Vector3 {
    const r = ringAt(this.profile, y);
    const w = r.w + ease;
    const d = (side > 0 ? r.f : r.b) + ease;
    const e = p ?? r.p ?? 2;
    const u = Math.min(0.985, Math.abs(x - (r.x ?? 0)) / w);
    const z = d * Math.pow(1 - Math.pow(u, e), 1 / e);
    return out.set(x, y, (r.z ?? 0) + side * z);
  }

  /**
   * A patch laid on the torso surface between two paths (x, y)(t). Smooth
   * edges (unlike triangle cuts), rimmed so its outline inks as a seam.
   */
  strip(
    a: (t: number) => [number, number],
    b: (t: number) => [number, number],
    ease: number,
    side: 1 | -1 = 1,
    n = 6,
    m = 2,
    opts: { p?: number; rim?: number } = {},
  ): THREE.BufferGeometry {
    const nn = this.detail >= 1 ? n : Math.max(2, Math.ceil(n / 2));
    const pos: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= nn; i++) {
      const t = i / nn;
      const [ax, ay] = a(t);
      const [bx, by] = b(t);
      for (let j = 0; j <= m; j++) {
        const k = j / m;
        this.surf(ax + (bx - ax) * k, ay + (by - ay) * k, ease, side, v, opts.p);
        pos.push(v.x, v.y, v.z);
      }
    }
    const idx: number[] = [];
    const W = m + 1;
    for (let i = 0; i < nn; i++)
      for (let j = 0; j < m; j++) {
        const q = i * W + j;
        idx.push(q, q + 1, q + W, q + 1, q + W + 1, q + W);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Face outward.
    const nz = (g.getAttribute("normal") as THREE.BufferAttribute).getZ(Math.floor(pos.length / 6));
    if (nz * side < 0) {
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1]!;
        idx[i + 1] = idx[i + 2]!;
        idx[i + 2] = t;
      }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    return this.detail >= 0 ? rimmed(g, opts.rim ?? Math.max(0.006, ease * 0.5)) : g;
  }

  /** Torso rings between y0 and y1 with a front opening of half-angle gap(y). */
  gapped(y0: number, y1: number, ease: number, gap: (y: number) => number, opts: { p?: number; steps?: number } = {}): THREE.BufferGeometry {
    const rings = this.slice(y0, y1, ease, { p: opts.p, steps: Math.min(opts.steps ?? 0, this.detail + 1) }).map((r) => ({ ...r, gap: gap(r.y) }));
    const g = loft(rings, this.rt + 2, {});
    return this.detail >= 0 ? rimmed(g, Math.max(0.006, ease * 0.5)) : g;
  }

  // --------------------------------------------------------------- the body

  dress(o: Outfit, d: Dressing): void {
    this.headAndHair(o, d);
    this.neck(o);
    this.torso(o);
    this.arms(o);
    this.legs(o);
    this.skirts(o);
    this.overlay(o);
    this.extras(o);
    this.held(d);
  }

  private headAndHair(o: Outfit, d: Dressing): void {
    const b = this.b;
    const Hh = b.headH;
    const W = b.headW;
    const D = b.headD;
    const head = headShape(W, Hh, D, this.detail, b.age === "child" ? 0.6 : 1);
    this.l(B.head, head, o.skin);
    const cy = Hh * 0.44;
    const cz = D * 0.1;
    // Nose and ears.
    if (this.detail >= 0) {
      const nose = noseShape(this.s * (b.age === "child" ? 0.75 : 1));
      nose.translate(0, cy + Hh * 0.02, cz + D * 0.84);
      this.l(B.head, nose, o.skin);
    }
    for (const side of this.detail >= 1 ? [1, -1] : []) {
      const ear = ellipsoid(0.012 * this.s, 0.03 * this.s, 0.02 * this.s, 5, 3);
      ear.rotateY(side * 0.3);
      ear.translate(side * W * 0.98, cy - Hh * 0.03, cz - D * 0.12);
      this.l(B.head, ear, o.skin);
    }
    if (this.detail >= 1) this.face(o);
    if (o.facial !== "none" && b.age !== "child" && this.detail >= 0) this.facialHair(o);
    const hatHidesHair = o.hat === "headscarf" || o.hat === "hood" || o.hat === "helmet" || o.hat === "riot";
    if (!hatHidesHair || d.dropHat) this.hair(o);
    if (o.hat !== "none") {
      const parts = this.hat(o);
      const droppable = o.hat !== "headscarf" && o.hat !== "hood";
      if (d.dropHat && droppable) this.hatParts = parts;
      else for (const p of parts) this.l(B.head, p.g, (p.o.tone as number) ?? 0, p.o);
    }
  }

  private shell(sx: number, sy: number, sz: number, keep: (xn: number, yn: number, zn: number) => boolean, jaw = 1): THREE.BufferGeometry {
    const b = this.b;
    const Hh = b.headH;
    const g = headShape(b.headW * sx, Hh * sy, b.headD * sz, this.detail, jaw);
    g.translate(0, Hh * 0.44 * (1 - sy), b.headD * 0.1 * (1 - sz));
    const cy = Hh * 0.44;
    const cz = b.headD * 0.1;
    const W2 = b.headW * sx;
    const H2 = (Hh * sy) / 2;
    const D2 = b.headD * sz;
    return keepTriangles(g, (c) => keep(c.x / W2, (c.y - cy) / H2, (c.z - cz) / D2));
  }

  private hair(o: Outfit): void {
    const b = this.b;
    const Hh = b.headH;
    const tone = o.hairTone;
    const style = o.hair;
    if (style === "bald") return;
    const hl = (zn: number, front: number, back: number) => {
      const t = THREE.MathUtils.clamp((0.75 - zn) / 1.6, 0, 1);
      return lerp(front, back, t);
    };
    const vol = style === "curly" ? 1.13 : style === "buzz" ? 1.025 : style === "long" || style === "bun" || style === "ponytail" ? 1.06 : 1.055;
    const front = style === "receding" ? 0.62 : style === "long" ? 0.3 : 0.36;
    const back = style === "long" ? -0.7 : -0.5;
    let g = this.shell(vol, vol * 0.99, vol, (xn, yn, zn) => {
      if (style === "receding" && zn > 0.2 && yn > 0.7 && Math.abs(xn) < 0.35) return false;
      if (Math.abs(xn) > 0.62 && zn > -0.35 && zn < 0.55 && yn < 0.12) return false; // clear the ears
      return yn > hl(zn, front, back);
    });
    if (style === "curly") g = rumple(g, 0.008 * this.s, this.seed, 60);
    this.l(B.head, g, tone);
    const cz = b.headD * 0.1;
    const cy = Hh * 0.44;
    if (style === "bun") {
      this.l(B.head, sphere(0.045 * this.s, 6, 5).translate(0, cy + Hh * 0.3, cz - b.headD * 0.95), tone);
    } else if (style === "ponytail") {
      const tail = this.limb(0.2 * this.s, [0.03 * this.s, 0.035 * this.s, 0.02 * this.s], 6, { top: 0.6, bottom: 0.8 });
      tail.rotateX(-0.35);
      tail.translate(0, cy + Hh * 0.12, cz - b.headD * 1.02);
      this.l(B.head, tail, tone);
    } else if (style === "long") {
      // A curtain of hair falling behind the shoulders.
      const W = b.headW;
      const D = b.headD;
      const rings: Ring[] = [
        { y: cy - Hh * 0.62, w: W * 0.95, f: D * 0.18, b: D * 0.55, z: cz - D * 0.5, p: 2.2 },
        { y: cy - Hh * 0.3, w: W * 1.06, f: D * 0.3, b: D * 0.72, z: cz - D * 0.42 },
        { y: cy + Hh * 0.05, w: W * 1.08, f: D * 0.45, b: D * 0.8, z: cz - D * 0.3 },
        { y: cy + Hh * 0.25, w: W * 1.02, f: D * 0.5, b: D * 0.78, z: cz - D * 0.25 },
      ];
      const curtain = loft(rings, this.rt, { capBottom: 0.0, capTop: -1 });
      this.l(B.head, keepTriangles(curtain, (c) => c.z < cz - D * 0.15 || c.y > cy - Hh * 0.1), tone);
    }
  }

  /** Front-of-face surface point, following headShape's deformation. */
  private faceAt(xn: number, yn: number, lift = 0): THREE.Vector3 {
    const b = this.b;
    let z = Math.sqrt(Math.max(0, 1 - xn * xn - yn * yn));
    let x = xn;
    const t = THREE.MathUtils.clamp((-yn - 0.28) / 0.72, 0, 1);
    x *= 1 - 0.3 * t * (b.age === "child" ? 0.6 : 1);
    z *= 1 - 0.06 * t;
    if (z > 0.35) z = 0.35 + (z - 0.35) * (0.8 - 0.25 * Math.abs(xn));
    return new THREE.Vector3(x * b.headW, b.headH * 0.44 + yn * (b.headH / 2), z * b.headD + b.headD * 0.1 + lift);
  }

  /** A few pen marks: brows, eyes, mouth. Invisible at distance, alive up close. */
  private face(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const kid = b.age === "child";
    const browTone = Math.max(0.62, Math.min(1, o.hairTone + 0.3));
    for (const side of [1, -1] as const) {
      const eye = this.faceAt(side * 0.36, kid ? -0.1 : -0.05, -0.004);
      const e = block((kid ? 0.02 : 0.018) * s, (kid ? 0.009 : 0.007) * s, 0.006 * s);
      e.translate(0, -0.0035 * s, 0);
      e.translate(eye.x, eye.y, eye.z);
      this.l(B.head, e, TONE.solid);
      const brow = this.faceAt(side * 0.37, kid ? 0.08 : 0.12, 0.002);
      const bw = block(0.026 * s, 0.0055 * s, 0.006 * s);
      bw.rotateZ(side * (0.12 + (o.facial === "none" ? 0 : 0.08)));
      bw.rotateY(side * 0.35);
      bw.translate(brow.x, brow.y, brow.z);
      this.l(B.head, bw, browTone);
    }
    const m = this.faceAt(0, -0.52, 0.0);
    const mouth = block(0.024 * s * (b.fem > 0.5 ? 0.85 : 1), 0.0035 * s, 0.006 * s);
    mouth.translate(m.x, m.y, m.z - 0.002);
    this.l(B.head, mouth, 0.72);
  }

  private facialHair(o: Outfit): void {
    const tone = Math.max(o.hairTone, 0.42);
    if (o.facial === "beard" || o.facial === "stubble") {
      const g = this.shell(1.05, 1.02, 1.06, (xn, yn, zn) => yn < -0.3 && yn > -1.02 && zn > -0.05 && !(zn > 0.6 && yn > -0.66 && Math.abs(xn) < 0.34));
      this.l(B.head, g, o.facial === "stubble" ? Math.min(0.26, tone) : Math.min(0.55, tone));
    }
    if (o.facial === "moustache" || o.facial === "beard") {
      const b = this.b;
      const m = ellipsoid(0.03 * this.s, 0.009 * this.s, 0.012 * this.s, 5, 3);
      m.translate(0, b.headH * 0.44 - b.headH * 0.2, b.headD * 0.1 + b.headD * 0.86);
      this.l(B.head, m, tone);
    }
  }

  private hat(o: Outfit): PropPart[] {
    const b = this.b;
    const s = this.s;
    const Hh = b.headH;
    const W = b.headW;
    const D = b.headD;
    const cz = b.headD * 0.1;
    const bandY = Hh * 0.72;
    const rx = W * 1.03;
    const rz = D * 1.02;
    const tone = o.hatTone;
    const acc = o.hatAccent;
    const out: PropPart[] = [];
    const put = (g: THREE.BufferGeometry, t: number, a?: AccentName) => out.push({ g, o: { tone: t, accent: a, accentAmount: a ? 1 : 0 } });
    const dome = (profile: Array<[number, number]>, h: number, sx: number, sz: number, y: number, z = cz) => {
      const g = new THREE.LatheGeometry(
        profile.map(([r, yy]) => new THREE.Vector2(r, yy * h)),
        this.rl + 3,
      );
      g.scale(sx, 1, sz);
      g.translate(0, y, z);
      return g;
    };
    switch (o.hat) {
      case "hardhat": {
        put(
          dome(
            [
              [1.0, 0],
              [1.0, 0.22],
              [0.95, 0.5],
              [0.8, 0.78],
              [0.5, 0.96],
              [0, 1.0],
            ],
            0.13 * s,
            rx * 1.1,
            rz * 1.08,
            bandY - 0.01 * s,
          ),
          tone,
          acc,
        );
        const brim = loft(
          [
            { y: 0, w: rx * 1.08, f: rz * 1.08, b: rz * 1.08, z: cz },
            { y: 0.006 * s, w: rx * 1.24, f: rz * 1.62, b: rz * 1.24, z: cz },
            { y: 0.014 * s, w: rx * 1.08, f: rz * 1.1, b: rz * 1.08, z: cz },
          ],
          this.rl + 3,
          {},
        );
        brim.translate(0, bandY - 0.012 * s, 0);
        put(brim, tone, acc);
        put(block(0.022 * s, 0.03 * s, rz * 1.9).translate(0, bandY + 0.1 * s, cz), tone, acc);
        break;
      }
      case "peaked": {
        put(
          dome(
            [
              [1.0, 0],
              [1.02, 0.4],
              [1.14, 0.85],
              [1.16, 0.95],
              [0.9, 1.0],
              [0, 1.02],
            ],
            0.085 * s,
            rx * 1.02,
            rz * 1.04,
            bandY - 0.01 * s,
            cz + 0.008 * s,
          ),
          tone,
        );
        put(ellipseRing(rx * 1.03, rz * 1.05, 0.016 * s, this.rr, 3).translate(0, bandY + 0.012 * s, cz + 0.004), o.hatTone >= 0.6 ? TONE.pale : TONE.deep);
        const visor = loft(
          [
            { y: 0, w: rx * 0.9, f: 0.075 * s, b: 0.0, p: 2 },
            { y: 0.008 * s, w: rx * 0.88, f: 0.07 * s, b: 0.0, p: 2 },
          ],
          12,
          { capBottom: 0, capTop: 0 },
        );
        visor.rotateX(0.35);
        visor.translate(0, bandY - 0.004 * s, cz + rz * 0.92);
        put(visor, TONE.solid);
        put(block(0.03 * s, 0.03 * s, 0.01 * s).translate(0, bandY + 0.05 * s, cz + rz * 1.12), TONE.pale);
        break;
      }
      case "helmet":
      case "riot": {
        const h = rumple(
          dome(
            [
              [1.04, 0],
              [1.06, 0.06],
              [1.03, 0.35],
              [0.88, 0.7],
              [0.55, 0.93],
              [0, 1.0],
            ],
            0.19 * s,
            rx * 1.22,
            rz * 1.2,
            bandY - 0.075 * s,
          ),
          o.hat === "helmet" ? 0.004 * s : 0,
          this.seed,
          50,
        );
        put(h, tone);
        put(tube([[-rx * 1.05, bandY - 0.06 * s, cz], [-rx * 0.6, bandY - 0.2 * s, cz + 0.04 * s], [0, bandY - 0.25 * s, cz + rz * 0.72], [rx * 0.6, bandY - 0.2 * s, cz + 0.04 * s], [rx * 1.05, bandY - 0.06 * s, cz]], 0.005 * s, 10, 3), TONE.deep);
        if (o.hat === "riot") {
          const visor = loft(
            [
              { y: 0, w: rx * 1.22, f: rz * 1.3, b: 0, p: 2 },
              { y: 0.16 * s, w: rx * 1.25, f: rz * 1.34, b: 0, p: 2 },
            ],
            12,
            { arc: 0.4, arcCentre: Math.PI / 2 },
          );
          visor.translate(0, bandY - 0.2 * s, cz);
          put(visor, TONE.light);
        }
        break;
      }
      case "flatcap": {
        const cap = loft(
          [
            { y: 0, w: rx * 1.04, f: rz * 1.04, b: rz * 1.03, z: cz },
            { y: 0.03 * s, w: rx * 1.1, f: rz * 1.28, b: rz * 1.0, z: cz + 0.018 * s },
            { y: 0.052 * s, w: rx * 0.92, f: rz * 1.14, b: rz * 0.78, z: cz + 0.03 * s },
          ],
          this.rl + 3,
          { capTop: 0.012 * s },
        );
        cap.translate(0, bandY - 0.008 * s, 0);
        put(cap, tone);
        const brim = loft(
          [
            { y: 0, w: rx * 0.82, f: 0.05 * s, b: 0, p: 2 },
            { y: 0.006 * s, w: rx * 0.8, f: 0.046 * s, b: 0, p: 2 },
          ],
          10,
          { capBottom: 0, capTop: 0 },
        );
        brim.rotateX(0.3);
        brim.translate(0, bandY - 0.005 * s, cz + rz * 1.0);
        put(brim, tone);
        break;
      }
      case "trilby": {
        put(
          dome(
            [
              [1.0, 0],
              [0.99, 0.45],
              [0.93, 0.8],
              [0.7, 1.0],
              [0.3, 0.9],
              [0, 0.88],
            ],
            0.11 * s,
            rx * 1.04,
            rz * 1.06,
            bandY - 0.004 * s,
          ),
          tone,
        );
        put(ellipseRing(rx * 1.05, rz * 1.07, 0.012 * s, this.rr, 3).translate(0, bandY + 0.014 * s, cz), TONE.solid);
        const brim = loft(
          [
            { y: 0.012 * s, w: rx * 1.04, f: rz * 1.06, b: rz * 1.06, z: cz },
            { y: 0.0, w: rx * 1.42, f: rz * 1.46, b: rz * 1.36, z: cz },
            { y: 0.012 * s, w: rx * 1.52, f: rz * 1.56, b: rz * 1.46, z: cz },
          ],
          this.rl + 3,
          {},
        );
        brim.translate(0, bandY - 0.004 * s, 0);
        put(brim, tone);
        break;
      }
      case "beanie": {
        put(
          dome(
            [
              [1.02, 0],
              [1.04, 0.3],
              [0.95, 0.62],
              [0.7, 0.9],
              [0.3, 1.02],
              [0, 1.04],
            ],
            0.12 * s,
            rx * 1.06,
            rz * 1.05,
            bandY - 0.03 * s,
          ),
          tone,
        );
        put(ellipseRing(rx * 1.08, rz * 1.07, 0.018 * s, this.rr, 3).translate(0, bandY - 0.012 * s, cz), tone);
        break;
      }
      case "straw": {
        put(
          dome(
            [
              [1.0, 0],
              [0.98, 0.6],
              [0.85, 0.95],
              [0, 1.0],
            ],
            0.1 * s,
            rx * 1.08,
            rz * 1.08,
            bandY - 0.004 * s,
          ),
          tone,
        );
        put(ellipseRing(rx * 1.09, rz * 1.09, 0.012 * s, this.rr, 3).translate(0, bandY + 0.02 * s, cz), TONE.dark);
        const brim = loft(
          [
            { y: 0.01 * s, w: rx * 1.06, f: rz * 1.06, b: rz * 1.06, z: cz },
            { y: 0.0, w: rx * 2.3, f: rz * 2.2, b: rz * 2.2, z: cz },
            { y: -0.012 * s, w: rx * 2.5, f: rz * 2.4, b: rz * 2.4, z: cz },
            { y: -0.004 * s, w: rx * 2.5, f: rz * 2.4, b: rz * 2.4, z: cz },
          ],
          this.rl + 3,
          {},
        );
        brim.translate(0, bandY, 0);
        put(brim, tone);
        break;
      }
      case "headscarf":
      case "hood": {
        const hood = o.hat === "hood";
        // A headscarf wraps close; a sweatshirt hood is loose and round,
        // slumping back from the face (never peaked).
        const big = hood ? 1.16 : 1.1;
        const g = this.shell(big, big * (hood ? 0.98 : 1.02), big * (hood ? 1.1 : 1.04), (xn, yn, zn) => {
          const face = zn > (hood ? 0.05 : 0.2) && Math.abs(xn) < (hood ? 0.72 : 0.6) && yn > -0.86 && yn < (hood ? 0.5 : 0.38);
          return !face && yn > -1.05 && !(zn > 0.3 && yn < -0.86);
        }, 0.65);
        put(this.detail >= 0 ? rimmed(g, 0.008) : g, tone);
        // Drape over the nape and shoulders.
        const drape = loft(
          [
            { y: -0.14 * s, w: W * (hood ? 1.5 : 1.35), f: D * 0.45, b: D * (hood ? 1.2 : 1.05), z: cz - D * 0.25 },
            { y: Hh * 0.05, w: W * 1.1, f: D * 0.5, b: D * (hood ? 1.12 : 1.0), z: cz - D * 0.2 },
            { y: Hh * 0.28, w: W * 1.05, f: D * 0.6, b: D * 0.98, z: cz - D * 0.12 },
          ],
          this.rl + 3,
          { arc: 0.72 },
        );
        put(this.detail >= 0 ? rimmed(drape, 0.01) : drape, tone);
        break;
      }
      case "none":
        break;
    }
    return out;
  }

  private neck(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const y0 = b.neckY - 0.03 * s;
    const y1 = b.headY + 0.04 * s;
    const rings: Ring[] = [
      { y: y0, w: b.neckR * 1.12, f: b.neckR * 1.05, b: b.neckR * 1.15, z: -0.022 * s },
      { y: lerp(y0, y1, 0.5), w: b.neckR * 0.98, f: b.neckR * 0.95, b: b.neckR * 1.0, z: -0.012 * s },
      { y: y1, w: b.neckR * 0.95, f: b.neckR * 0.9, b: b.neckR * 1.05, z: 0.0 },
    ];
    const g = loft(rings, this.rl, { capBottom: 0, capTop: 0 });
    this.w(B.neck, g, o.skin);
  }

  // --------------------------------------------------------------- torso

  private isLongTop(o: Outfit): boolean {
    return o.top === "coverall" || o.top === "gown" || o.top === "dress";
  }

  private torso(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const top = o.top;
    const loose =
      top === "coat" || top === "trench" || top === "frock" || top === "raincoat"
        ? 0.03
        : top === "labcoat" || top === "gown" || top === "hoodie" || top === "jacket" || top === "suit" || top === "fatigue"
          ? 0.02
          : top === "jumper" || top === "cardigan" || top === "coverall" || top === "scrubs"
            ? 0.014
            : 0.008;
    const tailored = top === "suit" || top === "frock" || top === "coat" || top === "trench";
    const acc = o.topAccent;
    const amt = o.topAmount ?? (acc ? 1 : 0);
    const topOpts = { accent: acc, accentAmount: amt };
    // Pelvis: trousers (or the lower half of a one-piece).
    const pelvisTone = this.isLongTop(o) ? o.topTone : o.legs === "skirt" || o.legs === "bare" ? o.topTone : o.legTone;
    const pelvisOpts = this.isLongTop(o) ? topOpts : {};
    let pRings = this.slice(b.crotchY - 0.01 * s, b.waistY + 0.03 * s, o.legs === "bare" && !this.isLongTop(o) ? 0.004 : 0.01);
    if (this.detail < 0) pRings = pRings.filter((_, i) => i % 2 === 0 || i === pRings.length - 1);
    this.w(B.pelvis, loft(pRings, this.rt, { capBottom: 0.02 * s }), pelvisTone, pelvisOpts);
    // Torso: the top garment itself.
    let tRings = this.slice(b.waistY - 0.045 * s, b.neckY + 0.03 * s, loose, { p: undefined });
    if (this.detail < 0) tRings = tRings.filter((_, i) => i % 2 === 0 || i === tRings.length - 1);
    if (tailored) for (const r of tRings) if (r.y > b.shoulderY - 0.1 * s && r.y < b.shoulderY + 0.03 * s) r.p = 2.5;
    this.w(B.spine, loft(tRings, this.rt, { capTop: 0 }), o.topTone, topOpts);

    const neckTop = b.neckY + 0.03 * s;
    const cy = this.chestY;
    // Fronts, collars and closures, laid on the torso surface as strips.
    const vEdge = (vBottom: number, halfTop: number) => (y: number) => Math.max(0, ((y - vBottom) / (neckTop - vBottom)) * halfTop);
    const vFront = (vBottom: number, halfTop: number, ease: number, tone: number, extra: Partial<PartOptions> = {}) => {
      if (this.detail < 0 && tone === o.topTone) return;
      const e = vEdge(vBottom, halfTop);
      const y = (t: number) => vBottom + (neckTop - vBottom) * t;
      const g = this.strip((t) => [-e(y(t)) - 0.004, y(t)], (t) => [e(y(t)) + 0.004, y(t)], ease, 1, 5, 2);
      this.w(B.spine, g, tone, extra);
    };
    const lapels = (vBottom: number, halfTop: number, ease: number, width: number, tone: number, extra: Partial<PartOptions> = {}) => {
      if (this.detail < 0) return;
      const e = vEdge(vBottom, halfTop);
      const y0 = vBottom - 0.035 * s;
      const y = (t: number) => y0 + (neckTop - 0.004 - y0) * t;
      for (const side of [1, -1] as const) {
        const g = this.strip(
          (t) => [side * e(y(t)), y(t)],
          (t) => [side * (e(y(t)) + width * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5))), y(t) + 0.006 * s],
          ease,
          1,
          5,
          1,
        );
        this.w(B.spine, g, tone, extra);
      }
    };
    const tie = (vBottom: number, halfTop: number, ease: number) => {
      if (this.detail < 0) return;
      const e = vEdge(vBottom, halfTop);
      const y0 = vBottom + 0.004;
      const y = (t: number) => y0 + (neckTop - 0.012 * s - y0) * t;
      const hw = (t: number) => Math.min(0.017 * s * (t > 0.88 ? 1.25 : 1), Math.max(0.003, e(y(t)) * 0.92));
      const g = this.strip((t) => [-hw(t), y(t)], (t) => [hw(t), y(t)], ease, 1, 5, 1);
      this.w(B.spine, g, o.tieTone);
    };
    const pocket = (x: number, y0: number, y1: number, hw: number, ease: number, tone: number, extra: Partial<PartOptions> = {}) => {
      if (this.detail < 1) return;
      const g = this.strip((t) => [x - hw, y0 + (y1 - y0) * t], (t) => [x + hw, y0 + (y1 - y0) * t], ease, 1, 1, 1);
      this.w(B.spine, g, tone, extra);
    };
    const shirtCollar = (tone: number, ease: number) => {
      if (this.detail < 0) return;
      const r = ringAt(this.profile, neckTop);
      const g = loft(
        [
          { y: neckTop - 0.01 * s, w: r.w + ease, f: r.f + ease, b: r.b + ease, z: r.z, gap: 0.3 },
          { y: neckTop + 0.035 * s, w: r.w * 0.92 + ease, f: r.f * 0.9 + ease, b: r.b * 0.95 + ease, z: r.z, gap: 0.45 },
        ],
        this.rt,
        {},
      );
      this.w(B.spine, this.detail >= 0 ? rimmed(g, 0.008) : g, tone);
    };
    const buttons = (x: number, ys: number[], tone: number, ease: number) => {
      if (this.detail < 1) return;
      const v = new THREE.Vector3();
      for (const y of ys) {
        this.surf(x, y, ease + 0.002 * s, 1, v);
        this.w(B.spine, block(0.014 * s, 0.014 * s, 0.008 * s).translate(v.x, v.y - 0.007 * s, v.z), tone);
      }
    };
    const zip = (y0: number, y1: number, ease: number) => {
      if (this.detail < 0) return;
      const g = this.strip((t) => [-0.006 * s, y0 + (y1 - y0) * t], (t) => [0.006 * s, y0 + (y1 - y0) * t], ease, 1, 3, 1);
      this.w(B.spine, g, TONE.dark);
    };
    switch (top) {
      case "suit":
      case "coat":
      case "trench":
      case "frock": {
        const vBottom = top === "suit" ? cy - 0.1 * s : cy - 0.02 * s;
        const half = b.neckR * (top === "suit" ? 1.3 : 1.2);
        vFront(vBottom, half, loose + 0.001, o.shirtTone);
        if (o.extras.includes("tie")) tie(vBottom, half, loose + 0.003);
        lapels(vBottom, half, loose + 0.005, top === "trench" || top === "coat" ? 0.065 * s : 0.048 * s, o.topTone, topOpts);
        if (top === "frock" || o.extras.includes("buttons2")) {
          const ys = [cy - 0.03 * s, cy - 0.11 * s, b.waistY + 0.01 * s];
          buttons(0.062 * s, ys, TONE.pale, loose);
          buttons(-0.062 * s, ys, TONE.pale, loose);
        } else buttons(0, [vBottom - 0.04 * s, vBottom - 0.13 * s], o.topTone > 0.5 ? TONE.pale : TONE.solid, loose);
        if (top === "trench") this.w(B.spine, this.band(b.waistY + 0.005 * s, 0.04 * s, loose + 0.006), o.topTone);
        if (top === "suit") pocket(0.1 * s, cy - 0.015 * s, cy + 0.005 * s, 0.045 * s, loose + 0.003, o.topTone, topOpts);
        if (top === "suit" && o.extras.includes("pocketSquare")) pocket(0.1 * s, cy + 0.005 * s, cy + 0.03 * s, 0.022 * s, loose + 0.005, TONE.paper);
        break;
      }
      case "labcoat": {
        const vBottom = cy - 0.08 * s;
        const half = b.neckR * 1.3;
        vFront(vBottom, half, loose + 0.001, o.shirtTone);
        if (o.extras.includes("tie")) tie(vBottom, half, loose + 0.003);
        lapels(vBottom, half, loose + 0.005, 0.05 * s, o.topTone);
        buttons(0, [vBottom - 0.05 * s, b.waistY + 0.02 * s], TONE.light, loose);
        pocket(0.09 * s, cy - 0.03 * s, cy + 0.05 * s, 0.045 * s, loose + 0.004, o.topTone);
        if (this.detail >= 1) {
          const v = this.surf(0.075 * s, cy + 0.07 * s, loose + 0.008, 1);
          this.w(B.spine, block(0.006, 0.05 * s, 0.006).translate(v.x, v.y - 0.03 * s, v.z), TONE.deep);
        }
        break;
      }
      case "shirt":
      case "fatigue": {
        shirtCollar(o.topTone, loose + 0.004);
        buttons(0, [cy + 0.05 * s, cy - 0.04 * s, cy - 0.13 * s], TONE.light, loose);
        pocket(0.085 * s, cy - 0.02 * s, cy + 0.06 * s, 0.045 * s, loose + 0.004, o.topTone);
        if (top === "fatigue") pocket(-0.085 * s, cy - 0.02 * s, cy + 0.06 * s, 0.045 * s, loose + 0.004, o.topTone);
        if (o.extras.includes("tie")) tie(b.waistY - 0.02 * s, 0.08 * s, loose + 0.004);
        break;
      }
      case "scrubs":
      case "gown": {
        const vB = cy + 0.02 * s;
        const half = b.neckR * 1.1;
        vFront(vB, half, loose + 0.001, o.skin);
        lapels(vB + 0.035 * s, half * 0.8, loose + 0.004, 0.012 * s, o.topTone);
        if (top === "scrubs") pocket(0.09 * s, cy - 0.04 * s, cy + 0.03 * s, 0.045 * s, loose + 0.004, o.topTone);
        break;
      }
      case "jumper":
      case "tee":
      case "hoodie":
      case "dress":
      case "raincoat":
      case "jacket":
      case "cardigan":
      case "coverall": {
        // Crew neck / collar band.
        const r = ringAt(this.profile, neckTop);
        const g = ellipseRing(r.w + loose * 0.8, r.f + loose * 0.8, 0.012 * s, this.rr, 3, r.b + loose * 0.8);
        g.translate(0, neckTop - 0.004, r.z ?? 0);
        this.w(B.spine, g, top === "cardigan" || top === "jacket" ? o.shirtTone : o.topTone, top === "coverall" ? topOpts : {});
        if (top === "jacket" || top === "raincoat" || top === "coverall" || top === "hoodie") zip(b.waistY - 0.04 * s, neckTop - 0.012 * s, loose + 0.003);
        if (top === "cardigan") {
          lapels(b.waistY + 0.05 * s, b.neckR * 1.05, loose + 0.004, 0.02 * s, o.topTone);
          vFront(b.waistY + 0.05 * s, b.neckR * 1.05, loose + 0.001, o.shirtTone);
          buttons(0, [b.waistY + 0.03 * s, b.waistY - 0.03 * s], TONE.deep, loose);
        }
        if (top === "hoodie" && this.detail >= 0) {
          // Kangaroo pocket.
          const y0 = b.waistY - 0.035 * s;
          const y1 = b.waistY + 0.09 * s;
          const p = this.strip((t) => [-0.11 * s + t * 0.03 * s, y0 + (y1 - y0) * t], (t) => [0.11 * s - t * 0.03 * s, y0 + (y1 - y0) * t], loose + 0.006, 1, 2, 3);
          this.w(B.spine, p, o.topTone);
        }
        if (top === "coverall") {
          pocket(0.085 * s, cy - 0.01 * s, cy + 0.07 * s, 0.04 * s, loose + 0.004, o.topTone, topOpts);
          pocket(-0.085 * s, cy - 0.01 * s, cy + 0.07 * s, 0.04 * s, loose + 0.004, o.topTone, topOpts);
        }
        break;
      }
    }
  }

  // ----------------------------------------------------------------- arms

  private arms(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const acc = o.topAccent;
    const topOpts = { accent: acc, accentAmount: o.topAmount ?? (acc ? 1 : 0) };
    const loose = o.top === "coat" || o.top === "trench" || o.top === "frock" || o.top === "raincoat" ? 1.22 : o.top === "tee" || o.top === "shirt" || o.top === "scrubs" ? 1.06 : 1.14;
    const gloves = o.extras.includes("gloves");
    const rl = this.rl;
    for (const side of [1, -1] as const) {
      const arm = side > 0 ? B.armL : B.armR;
      const fore = side > 0 ? B.foreL : B.foreR;
      const hand = side > 0 ? B.handL : B.handR;
      const ua = b.upperArm;
      // Upper arm with the deltoid as its shoulder cap: a dome that rounds
      // the corner of the torso rather than sitting on top of it.
      const cap = b.deltR * (o.sleeves === "short" ? loose * 1.0 : Math.min(loose, 1.14) * 0.98);
      if (o.sleeves === "short") {
        const skin = this.limb(ua, [b.deltR * 0.95, b.upperArmR * 1.02, b.upperArmR * 0.94, b.elbowR], rl, { top: 0.5, bottom: 0.9 });
        skin.translate(side * 0.004 * s, -0.016 * s, 0);
        this.l(arm, skin, o.skin);
        const sleeve = this.limb(ua * 0.5, [cap * 1.02, b.upperArmR * 1.24, b.upperArmR * 1.3], rl, { top: 0.52, bottom: 0 });
        sleeve.translate(side * 0.004 * s, -0.016 * s, 0);
        this.l(arm, sleeve, o.topTone, topOpts);
      } else {
        const sleeve = this.limb(ua, [cap, b.upperArmR * loose * 1.02, b.upperArmR * loose * 0.95, b.elbowR * loose * 1.05], rl, { top: 0.5, bottom: 0.9 });
        sleeve.translate(side * 0.004 * s, -0.016 * s, 0);
        this.l(arm, this.cloth(sleeve), o.topTone, topOpts);
      }
      // Forearm.
      const fa = b.foreArm;
      if (o.sleeves === "long") {
        const sleeve = this.limb(fa, [b.elbowR * loose * 1.08, b.foreArmR * loose * 1.04, b.wristR * loose * 1.35], rl, { top: 0.7, bottom: 0 });
        this.l(fore, this.cloth(sleeve), o.topTone, topOpts);
        if (this.detail >= 1) {
          const cuff = ellipseRing(b.wristR * loose * 1.3, b.wristR * loose * 1.3, 0.007 * s, rl + 1, 3);
          cuff.translate(0, -fa + 0.012 * s, 0);
          this.l(fore, cuff, o.topTone, topOpts);
        }
        if (this.detail >= 0) this.l(fore, this.limb(0.05 * s, [b.wristR, b.wristR * 0.95], Math.max(4, rl - 2), { top: 0, bottom: 0.6 }).translate(0, -fa + 0.035 * s, 0), gloves ? TONE.mid : o.skin);
      } else {
        const skin = this.limb(fa, [b.elbowR * 1.02, b.foreArmR * 1.06, b.foreArmR * 0.92, b.wristR], rl, { top: 0.7, bottom: 0.6 });
        this.l(fore, skin, o.skin);
        if (o.sleeves === "rolled" && this.detail >= 0) {
          const roll = ellipseRing(b.foreArmR * 1.32, b.foreArmR * 1.32, 0.018 * s, rl + 1, 3);
          roll.translate(0, -0.03 * s, 0);
          this.l(fore, roll, o.topTone, topOpts);
        }
      }
      // Hand (at crowd distance the sleeve end carries it).
      if (this.detail >= 0) {
        const m = mittenShape(b.hand, b.hand * 0.5, side, this.detail, 0.35);
        this.l(hand, m, gloves ? TONE.mid : o.skin);
      } else this.l(hand, ellipsoid(b.hand * 0.13, b.hand * 0.45, b.hand * 0.22, 3, 2).translate(0, -b.hand * 0.4, 0), gloves ? TONE.mid : o.skin);
      if (o.extras.includes("wristband") && side < 0) {
        this.l(fore, ellipseRing(b.wristR * 1.15, b.wristR * 1.15, 0.006 * s, 8, 3).translate(0, -fa + 0.03 * s, 0), TONE.paper);
      }
    }
  }

  // ----------------------------------------------------------------- legs

  private legs(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const covered = o.legs === "trousers" || o.legs === "jeans" || o.legs === "cargo" || o.top === "coverall";
    const legTone = o.top === "coverall" ? o.topTone : o.legTone;
    const acc = o.top === "coverall" ? o.topAccent : undefined;
    const legOpts = acc ? { accent: acc, accentAmount: o.topAmount ?? 1 } : {};
    const wide = o.legs === "cargo" || o.top === "coverall" ? 1.12 : o.legs === "jeans" ? 1.02 : 1.06;
    const tallBoot = o.feet === "wellies";
    for (const side of [1, -1] as const) {
      const thigh = side > 0 ? B.thighL : B.thighR;
      const shin = side > 0 ? B.shinL : B.shinR;
      const foot = side > 0 ? B.footL : B.footR;
      if (covered) {
        this.l(thigh, this.cloth(this.limb(b.thigh, [b.thighR * 1.06 * wide, b.thighR * 1.0 * wide, b.thighR * 0.86 * wide, b.kneeR * 1.22 * wide], this.rl, { top: 0.6, bottom: 0.9 })), legTone, legOpts);
        const hemR = b.calfR * 0.98 * wide;
        this.l(shin, this.cloth(this.limb(b.shin, [b.kneeR * 1.2 * wide, b.calfR * 1.08 * wide, b.calfR * 1.02 * wide, hemR], this.rl, { top: 0.7, bottom: 0 }), 0.005), legTone, legOpts);
        if (o.legs === "cargo") {
          const pocket = this.slab(0.03 * s, 0.13 * s, 0.1 * s, 0.3);
          pocket.translate(side * (b.thighR * wide + 0.008), -b.thigh * 0.55, 0.01);
          this.l(thigh, pocket, legTone);
        }
      } else {
        // Bare legs (or tights), shorts cover the top of the thigh.
        this.l(thigh, this.limb(b.thigh, [b.thighR * 1.02, b.thighR * 0.95, b.thighR * 0.8, b.kneeR], this.rl, { top: 0.6, bottom: 0.9 }), o.skin);
        this.l(
          shin,
          this.limb(b.shin, [b.kneeR * 0.98, b.calfR * 1.05, b.calfR * 0.98, b.calfR * 0.72, b.ankleR], this.rl, { top: 0.7, bottom: 0.5, z: [0.004, -0.012 * s, -0.012 * s, -0.004, 0] }),
          o.skin,
        );
        if (o.legs === "shorts") {
          this.l(thigh, this.limb(b.thigh * 0.55, [b.thighR * 1.14, b.thighR * 1.18, b.thighR * 1.16], this.rl, { top: 0.4, bottom: 0 }), o.legTone);
        }
      }
      // Footwear.
      const f = o.feet;
      const bulk = f === "boots" || f === "wellies" ? 1.14 : f === "trainers" || f === "clogs" ? 1.1 : f === "slippers" ? 1.06 : 1;
      const high = f === "boots" ? 0.03 * s : 0;
      const shoe = shoeShape(b.footLen, b.footW, b.ankleY, b.heel, { bulk, high, toe: f === "shoes" ? 0.92 : 1, radial: this.detail >= 2 ? 10 : this.detail >= 1 ? 7 : this.detail >= 0 ? 5 : 4 });
      this.l(foot, shoe, o.feetTone);
      if (f === "trainers") {
        const sole = shoeShape(b.footLen * 1.02, b.footW * 1.04, b.ankleY, b.heel * 1.05, { bulk: bulk * 1.02, radial: this.detail >= 2 ? 10 : this.detail >= 1 ? 7 : 5 });
        this.l(foot, keepTriangles(sole, (c) => c.y < -b.ankleY + 0.022 * s), TONE.deep);
      }
      if (f === "boots" || tallBoot) {
        const h = tallBoot ? b.shin * 0.72 : 0.13 * s;
        const shaft = this.limb(h, [b.calfR * (tallBoot ? 1.28 : 1.12), b.ankleR * 1.55], this.rl, { top: 0, bottom: 0 });
        shaft.translate(0, -b.shin + h - 0.01, 0.004);
        this.l(shin, shaft, o.feetTone);
      }
      if (covered && !tallBoot && this.detail >= 1) {
        // Trouser hem breaking over the shoe.
        const hem = ellipseRing(b.calfR * 1.02 * wide, b.calfR * 1.06 * wide, 0.009 * s, this.rl, 3);
        hem.translate(0, -b.shin + 0.03 * s, 0);
        this.l(shin, hem, legTone, legOpts);
      }
      if (o.extras.includes("kneepads")) {
        this.l(shin, ellipsoid(0.055 * s, 0.07 * s, 0.03 * s, 5, 4).translate(0, -0.03 * s, b.kneeR * 1.25), TONE.deep);
      }
      if (o.extras.includes("bands") && covered) {
        const r = ellipseRing(b.calfR * 1.1 * wide, b.calfR * 1.1 * wide, 0.013 * s, this.rr, 3);
        r.translate(0, -b.shin * 0.45, 0);
        this.l(shin, r, TONE.pale);
      }
    }
  }

  /** Coat tails, skirts and gowns: two halves on the coat bones. */
  private skirts(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const isSkirt = o.legs === "skirt" && o.hem === null;
    const hem = o.hem ?? (isSkirt ? b.kneeY + 0.04 * s : null);
    const jacketHem = o.top === "suit" || o.top === "jacket" || o.top === "raincoat" || o.top === "hoodie" || o.top === "fatigue" || o.top === "cardigan" || o.top === "scrubs" || o.top === "jumper";
    const h = hem ?? (jacketHem ? b.crotchY - (o.top === "suit" || o.top === "jacket" || o.top === "raincoat" ? 0.03 : -0.03) * s : null);
    if (h === null) return;
    const tone = isSkirt ? o.legTone : o.topTone;
    const acc = isSkirt ? undefined : o.topAccent;
    const opts = acc ? { accent: acc, accentAmount: o.topAmount ?? 1 } : {};
    const long = h < b.crotchY - 0.05 * s;
    const ease = long ? 0.028 : 0.022;
    const top = b.waistY - (isSkirt ? 0.0 : 0.03 * s);
    const hipR = ringAt(this.profile, b.hipY);
    const rings: Ring[] = [];
    const flare = long ? (o.top === "gown" || o.legs === "skirt" ? 1.26 : o.top === "labcoat" ? 1.14 : 1.1) : 1.04;
    const ys = long ? [top, b.hipY + 0.02 * s, b.crotchY, lerp(b.crotchY, h, 0.5), h] : [top, b.hipY, h];
    for (const y of ys) {
      const tuck = y >= top - 1e-6 ? -0.014 : 0;
      const r = ringAt(this.profile, Math.max(y, b.crotchY + 0.036 * s));
      const t = THREE.MathUtils.clamp((b.hipY - y) / Math.max(0.01, b.hipY - h), 0, 1);
      const wf = y < b.hipY ? lerp(1, flare, t) : 1;
      rings.push({
        y,
        w: Math.max(r.w, y < b.hipY ? hipR.w : 0) * wf + ease + tuck,
        f: Math.max(r.f, y < b.hipY ? hipR.f : 0) * wf * (y < b.crotchY ? 1.12 : 1) + ease + tuck,
        b: Math.max(r.b, y < b.hipY ? hipR.b : 0) * wf + ease + tuck,
        z: r.z,
      });
    }
    rings.reverse(); // loft bottom -> top
    const open = THREE.MathUtils.clamp(o.open, 0, 1) * 0.12;
    for (const side of [1, -1] as const) {
      const bone = side > 0 ? B.coatL : B.coatR;
      // Each half wraps from the back centre round to the front edge.
      const arc = 0.5 - open;
      let g = loft(rings, this.rt, { arc, arcCentre: side > 0 ? -open * Math.PI : Math.PI + open * Math.PI });
      g = this.cloth(g, 0.006);
      if (this.detail >= 0) g = rimmed(g, 0.008);
      this.w(bone, g, tone, opts);
      if (long && this.detail >= 1 && (o.top === "coat" || o.top === "labcoat" || o.top === "trench" || o.top === "frock")) {
        // Hip pocket flaps: a proud strip of the coat's own surface.
        const y = b.hipY - 0.07 * s;
        const r0 = ringAt(rings, y - 0.03 * s);
        const r1 = ringAt(rings, y);
        const e = 0.006;
        const flap = loft(
          [
            { ...r0, w: r0.w + e, f: r0.f + e, b: r0.b + e },
            { ...r1, w: r1.w + e, f: r1.f + e, b: r1.b + e },
          ],
          3,
          { arc: 0.08, arcCentre: side > 0 ? 0.62 : Math.PI - 0.62 },
        );
        this.w(bone, rimmed(flap, 0.01), tone, opts);
      }
    }
  }

  // --------------------------------------------------------------- overlays

  private overlay(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const cy = this.chestY;
    const topEase = o.top === "coat" || o.top === "trench" ? 0.03 : o.top === "jacket" || o.top === "fatigue" || o.top === "suit" ? 0.02 : 0.012;
    const acc = o.overAccent;
    const accOpts = acc ? { accent: acc, accentAmount: 1 } : {};
    const across = (y0: number, y1: number, hw: (y: number) => number, x0 = 0) => ({
      a: (t: number): [number, number] => {
        const y = y0 + (y1 - y0) * t;
        return [x0 - hw(y), y];
      },
      b: (t: number): [number, number] => {
        const y = y0 + (y1 - y0) * t;
        return [x0 + hw(y), y];
      },
    });
    const rw = (y: number) => ringAt(this.profile, y).w;
    switch (o.over) {
      case "hivis": {
        const e = topEase + 0.012;
        const y0 = b.hipY + 0.035 * s;
        const y1 = b.shoulderY + 0.02 * s;
        const vY = cy - 0.01 * s;
        const vest = this.gapped(y0, y1, e, (y) => (y < vY ? 0.03 : 0.03 + ((y - vY) / (y1 - vY)) * 0.52));
        this.w(B.spine, vest, o.overTone, accOpts);
        // Reflective tape: two hoops, and braces up over the shoulders.
        const tapeE = e + 0.005;
        const lo = b.waistY - 0.02 * s;
        const hi = b.waistY + 0.12 * s;
        for (const y of [lo, hi]) {
          const r = this.slice(y - 0.021 * s, y + 0.021 * s, tapeE).map((q) => ({ ...q, gap: 0.035 }));
          const g = loft([r[0]!, r[r.length - 1]!], this.rt + 2, {});
          this.w(B.spine, this.detail >= 0 ? rimmed(g, 0.007) : g, TONE.pale);
        }
        for (const side of [1, -1] as const)
          for (const face of [1, -1] as const) {
            const x = side * 0.088 * s;
            const g = this.strip((t) => [x - 0.02 * s, hi + 0.021 * s + (y1 - hi - 0.03 * s) * t], (t) => [x + 0.02 * s, hi + 0.021 * s + (y1 - hi - 0.03 * s) * t], tapeE, face, 3, 1);
            this.w(B.spine, g, TONE.pale);
          }
        break;
      }
      case "tabard": {
        const e = topEase + 0.014;
        const y0 = b.hipY - 0.02 * s;
        const y1 = b.shoulderY + 0.005 * s;
        for (const face of [1, -1] as const) {
          const { a: pa, b: pb } = across(y0, y1 - (face > 0 ? 0.06 * s : 0), (y) => rw(y) * 0.8);
          this.w(B.spine, this.strip(pa, pb, e, face, 6, 4), o.overTone, accOpts);
          // Printed band.
          const band = across(cy - 0.03 * s, cy + 0.025 * s, (y) => rw(y) * 0.78);
          this.w(B.spine, this.strip(band.a, band.b, e + 0.003, face, 1, 4), TONE.light);
        }
        // Shoulder yokes joining front and back.
        for (const side of [1, -1] as const) {
          const g = this.strip(
            (t) => [side * 0.07 * s, y1 - 0.08 * s + 0.1 * s * t],
            (t) => [side * 0.15 * s, y1 - 0.08 * s + 0.1 * s * t],
            e,
            1,
            2,
            1,
          );
          this.w(B.spine, g, o.overTone, accOpts);
        }
        break;
      }
      case "plate": {
        const e = topEase + 0.035;
        const y0 = b.waistY - 0.03 * s;
        const y1 = cy + 0.11 * s;
        for (const face of [1, -1] as const) {
          const { a: pa, b: pb } = across(y0, y1, () => b.chestW * 0.8);
          this.w(B.spine, this.strip(pa, pb, e, face, 3, 4, { p: 4 }), o.overTone);
          // Straps to the shoulders.
          for (const side of [1, -1] as const) {
            const g = this.strip((t) => [side * 0.08 * s, y1 + (b.shoulderY + 0.035 * s - y1) * t], (t) => [side * 0.13 * s, y1 + (b.shoulderY + 0.035 * s - y1) * t], e - 0.018, face, 2, 1);
            this.w(B.spine, g, o.overTone);
          }
        }
        // Pouches along the front.
        const v = new THREE.Vector3();
        for (const x of [-0.1, -0.034, 0.034, 0.1]) {
          this.surf(x * s, b.waistY + 0.02 * s, e + 0.02 * s, 1, v, 4);
          const pch = this.slab(0.058 * s, 0.1 * s, 0.045 * s, 0.25);
          pch.translate(v.x, v.y - 0.05 * s, v.z);
          this.w(B.spine, pch, Math.max(0, o.overTone - 0.08));
        }
        break;
      }
      case "stab": {
        const e = topEase + 0.016;
        const y0 = b.waistY - 0.06 * s;
        const y1 = b.shoulderY + 0.02 * s;
        const vY = cy + 0.05 * s;
        const vest = this.gapped(y0, y1, e, (y) => (y < vY ? 0.02 : 0.02 + ((y - vY) / (y1 - vY)) * 0.42), { p: 2.6 });
        this.w(B.spine, vest, o.overTone);
        // Identification panel across the chest.
        const band = across(cy - 0.02 * s, cy + 0.035 * s, () => 0.1 * s);
        this.w(B.spine, this.strip(band.a, band.b, e + 0.004, 1, 1, 3), TONE.pale);
        break;
      }
      case "bib": {
        const e = topEase + 0.01;
        const bibTop = cy + 0.08 * s;
        const bib = across(b.waistY - 0.02 * s, bibTop, () => b.chestW * 0.56);
        this.w(B.spine, this.strip(bib.a, bib.b, e, 1, 3, 3), o.overTone);
        // Straps: front, over the shoulder, crossing at the back.
        for (const side of [1, -1] as const) {
          const f = this.strip(
            (t) => [side * 0.058 * s, bibTop - 0.01 * s + (b.shoulderY + 0.04 * s - bibTop) * t],
            (t) => [side * 0.092 * s, bibTop - 0.01 * s + (b.shoulderY + 0.04 * s - bibTop) * t],
            e,
            1,
            3,
            1,
          );
          this.w(B.spine, f, o.overTone);
          const k = this.strip(
            (t) => [side * (0.075 - 0.09 * t) * s, b.shoulderY + 0.04 * s - (b.shoulderY + 0.04 * s - b.waistY) * t],
            (t) => [side * (0.11 - 0.09 * t) * s, b.shoulderY + 0.04 * s - (b.shoulderY + 0.04 * s - b.waistY) * t],
            e,
            -1,
            4,
            1,
          );
          this.w(B.spine, k, o.overTone);
          if (this.detail >= 1) {
            const v = this.surf(side * 0.075 * s, bibTop - 0.02 * s, e + 0.004, 1);
            this.w(B.spine, block(0.024 * s, 0.024 * s, 0.008).translate(v.x, v.y - 0.012 * s, v.z), TONE.pale);
          }
        }
        const pk = across(cy - 0.05 * s, cy + 0.03 * s, () => 0.06 * s);
        if (this.detail >= 1) this.w(B.spine, this.strip(pk.a, pk.b, e + 0.004, 1, 1, 2), o.overTone);
        break;
      }
      case "blanket": {
        const e = 0.05;
        const rings: Ring[] = [
          { y: b.hipY - 0.18 * s, w: b.hipW * 1.35 + e, f: b.hipF * 1.3 + e, b: b.hipB * 1.3 + e },
          { y: b.waistY, w: b.chestW * 1.3 + e, f: b.chestF * 1.2 + e, b: b.chestB * 1.2 + e },
          { y: b.shoulderY - 0.05 * s, w: b.shoulderW + b.deltR + e, f: b.chestF * 1.1 + e, b: b.chestB * 1.12 + e },
          { y: b.shoulderY + 0.05 * s, w: b.shoulderW * 0.8 + e * 0.6, f: 0.08 * s + e * 0.5, b: 0.09 * s + e * 0.6, z: -0.01 },
          { y: b.neckY + 0.04 * s, w: b.neckR * 1.5 + 0.01, f: b.neckR * 1.3, b: b.neckR * 1.6, z: -0.015 },
        ];
        let g = loft(rings, this.rt + 4, { arc: 0.84 });
        g = rumple(g, 0.012 * s, this.seed, 16);
        this.w(B.spine, this.detail >= 0 ? rimmed(g, 0.02) : g, o.overTone);
        // Woven stripes near the hem.
        const stripe = (y: number) => {
          const rr = rings.map((r) => ({ ...r, w: r.w + 0.004, f: r.f + 0.004, b: r.b + 0.004 }));
          const band = loft([ringAtList(rr, y - 0.02 * s), ringAtList(rr, y + 0.02 * s)], this.rt + 4, { arc: 0.84 });
          this.w(B.spine, this.detail >= 0 ? rimmed(band, 0.008) : band, Math.min(1, o.overTone + 0.36));
        };
        stripe(b.hipY - 0.1 * s);
        stripe(b.hipY - 0.03 * s);
        break;
      }
      case "none":
        break;
    }
  }

  // ----------------------------------------------------------------- extras

  private extras(o: Outfit): void {
    const b = this.b;
    const s = this.s;
    const cy = this.chestY;
    const neckTop = b.neckY + 0.03 * s;
    const ex = new Set(o.extras);
    const front = (y: number, e: number) => {
      const r = ringAt(this.profile, y);
      return (r.z ?? 0) + r.f + e;
    };
    const topEase = o.top === "coat" || o.top === "trench" || o.top === "frock" ? 0.03 : 0.02;
    const overE = o.over === "none" ? topEase : o.over === "plate" ? topEase + 0.05 : topEase + 0.02;
    if (ex.has("scarf") || ex.has("redscarf")) {
      const red = ex.has("redscarf");
      const r = ringAt(this.profile, neckTop);
      const g = ellipseRing(r.w + 0.012, r.f + 0.01, 0.022 * s, this.rl + 4, 4, r.b + 0.012);
      g.translate(0, neckTop - 0.004, r.z ?? 0);
      const opts = red ? { accent: "signal" as AccentName, accentAmount: 1 } : {};
      const tone = red ? TONE.pale : TONE.light;
      this.w(B.spine, g, tone, opts);
      const knotZ = front(neckTop - 0.02, 0.02);
      this.w(B.spine, sphere(0.024 * s, 5, 4).translate(0.03 * s, neckTop - 0.02 * s, knotZ), tone, opts);
      const tail1 = tube([[0.03 * s, neckTop - 0.03 * s, knotZ], [0.045 * s, cy + 0.02 * s, front(cy + 0.02 * s, overE + 0.01)], [0.05 * s, cy - 0.12 * s, front(cy - 0.12 * s, overE + 0.012)]], 0.02 * s, 5, 4);
      tail1.scale(1, 1, 0.55);
      this.w(B.spine, tail1.translate(0, 0, knotZ * 0.45), tone, opts);
      const tail2 = tube([[0.03 * s, neckTop - 0.03 * s, knotZ], [0.075 * s, cy + 0.04 * s, front(cy + 0.04 * s, overE + 0.01) + 0.004]], 0.02 * s, 3, 4);
      tail2.scale(1, 1, 0.55);
      this.w(B.spine, tail2.translate(0, 0, knotZ * 0.45), tone, opts);
    }
    if ((ex.has("lanyard") || ex.has("badge")) && this.detail >= 0) {
      const cardY = ex.has("lanyard") ? cy - 0.06 * s : cy + 0.04 * s;
      const x = ex.has("lanyard") ? 0 : 0.09 * s;
      const z = front(cardY, overE) + 0.006;
      if (ex.has("lanyard")) {
        const zN = front(neckTop, 0.01);
        this.w(B.spine, tube([[-0.06 * s, neckTop, zN - 0.02], [-0.03 * s, cy + 0.02 * s, front(cy + 0.02, overE) + 0.004], [0, cardY + 0.04 * s, z]], 0.004 * s, 6, 3), TONE.deep);
        this.w(B.spine, tube([[0.06 * s, neckTop, zN - 0.02], [0.03 * s, cy + 0.02 * s, front(cy + 0.02, overE) + 0.004], [0, cardY + 0.04 * s, z]], 0.004 * s, 6, 3), TONE.deep);
      }
      this.w(B.spine, block(0.055 * s, 0.075 * s, 0.006).translate(x, cardY - 0.035 * s, z), TONE.paper);
      this.w(B.spine, block(0.04 * s, 0.012 * s, 0.007).translate(x, cardY - 0.005 * s, z + 0.001), TONE.deep);
    }
    if (ex.has("stethoscope") && this.detail >= 0) {
      const zN = front(neckTop, 0.012);
      const pts: Array<[number, number, number]> = [
        [-0.05 * s, cy + 0.02 * s, front(cy + 0.02 * s, overE) + 0.004],
        [-0.07 * s, neckTop - 0.01, zN - 0.03],
        [0, neckTop + 0.01, -b.neckR * 1.3],
        [0.07 * s, neckTop - 0.01, zN - 0.03],
        [0.06 * s, cy - 0.04 * s, front(cy - 0.04 * s, overE) + 0.004],
      ];
      this.w(B.spine, tube(pts, 0.005 * s, 10, 3), TONE.solid);
      this.w(B.spine, cylinder(0.018 * s, 0.018 * s, 0.01, 8).rotateX(Math.PI / 2).translate(0.06 * s, cy - 0.06 * s, front(cy - 0.06 * s, overE) + 0.008), TONE.mid);
    }
    if (ex.has("fobwatch") && this.detail >= 1) {
      this.w(B.spine, cylinder(0.015 * s, 0.015 * s, 0.006, 8).rotateX(Math.PI / 2).translate(0.09 * s, cy + 0.04 * s, front(cy + 0.04 * s, topEase) + 0.004), TONE.pale);
    }
    if (ex.has("watchchain") && this.detail >= 1) {
      this.w(B.spine, tube([[-0.07 * s, b.waistY + 0.05 * s, front(b.waistY + 0.05 * s, topEase) + 0.004], [0, b.waistY + 0.01 * s, front(b.waistY, topEase) + 0.006], [0.07 * s, b.waistY + 0.05 * s, front(b.waistY + 0.05 * s, topEase) + 0.004]], 0.004 * s, 8, 3), TONE.pale);
    }
    if (ex.has("toolbelt") || ex.has("belt")) {
      const yb = b.waistY - 0.035 * s;
      const r = ringAt(this.profile, yb);
      const e = (o.over === "hivis" ? 0.03 : 0.02) + (ex.has("toolbelt") ? 0.012 : 0);
      this.w(B.pelvis, ellipseRing(r.w + e, r.f + e, 0.018 * s, this.rr, 3, r.b + e).translate(0, yb, r.z ?? 0), TONE.deep);
      this.w(B.pelvis, block(0.04 * s, 0.035 * s, 0.01).translate(0, yb, (r.z ?? 0) + r.f + e + 0.012), TONE.pale);
      if (ex.has("toolbelt") && this.detail >= 0) {
        for (const side of [1, -1]) {
          const p = this.slab(0.1 * s, 0.13 * s, 0.05 * s, 0.25);
          p.rotateY(side * 1.2);
          p.translate(side * (r.w + e + 0.015), yb - 0.13 * s, 0.03 * s);
          this.w(B.pelvis, p, TONE.dark);
        }
        const hammer = cylinder(0.012 * s, 0.012 * s, 0.26 * s, 5);
        hammer.translate(-(r.w + e + 0.02), yb - 0.13 * s, -0.05 * s);
        this.w(B.pelvis, hammer, TONE.light);
        this.w(B.pelvis, block(0.035 * s, 0.035 * s, 0.11 * s).translate(-(r.w + e + 0.02), yb + 0.01 * s, -0.05 * s), TONE.deep);
      }
    }
    if (ex.has("radio") && this.detail >= 0) {
      const z = front(cy + 0.05 * s, overE) + 0.02 * s;
      this.w(B.spine, this.slab(0.05 * s, 0.1 * s, 0.03 * s, 0.3).translate(0.1 * s, cy + 0.02 * s, z), TONE.solid);
      this.w(B.spine, cylinder(0.005, 0.005, 0.06 * s, 4).translate(0.115 * s, cy + 0.15 * s, z), TONE.solid);
    }
    if (ex.has("epaulettes") && this.detail >= 0) {
      for (const side of [1, -1]) {
        const e = block(0.05 * s, 0.012 * s, 0.1 * s);
        e.rotateZ(-side * 0.25);
        e.translate(side * b.shoulderW * 0.72, b.shoulderY + 0.045 * s, -0.01);
        this.w(B.spine, e, o.topTone >= 0.6 ? TONE.pale : TONE.deep);
      }
    }
    if (ex.has("backpack")) {
      const r = ringAt(this.profile, cy - 0.04 * s);
      const zb = (r.z ?? 0) - r.b - overE;
      const pack = this.slab(0.3 * s, 0.4 * s, 0.16 * s, 0.35);
      pack.translate(0, cy - 0.28 * s, zb - 0.08 * s);
      this.w(B.spine, rumple(pack, 0.004, this.seed, 20), o.bagTone);
      this.w(B.spine, this.slab(0.22 * s, 0.14 * s, 0.05 * s, 0.35).translate(0, cy - 0.26 * s, zb - 0.17 * s), o.bagTone);
      for (const side of [1, -1]) {
        const x = side * 0.08 * s;
        this.w(
          B.spine,
          tube(
            [
              [x, cy - 0.2 * s, zb - 0.01],
              [x * 1.2, b.shoulderY + 0.04 * s, -0.02 * s],
              [x * 1.3, cy + 0.02 * s, front(cy + 0.02 * s, overE) + 0.004],
              [x * 1.5, cy - 0.12 * s, front(cy - 0.12 * s, overE) - 0.02],
            ],
            0.012 * s,
            10,
            4,
          ),
          TONE.deep,
        );
      }
    }
    if (ex.has("shoulderBag")) {
      const zf = front(cy, overE) + 0.006;
      const r = ringAt(this.profile, b.hipY);
      this.w(
        B.spine,
        tube(
          [
            [b.shoulderW * 0.62, b.shoulderY + 0.04 * s, -0.005],
            [0.02 * s, cy + 0.0 * s, zf],
            [-r.w * 0.85, b.waistY - 0.05 * s, 0.04 * s],
          ],
          0.008 * s,
          10,
          3,
        ),
        TONE.deep,
      );
      const bag = this.slab(0.08 * s, 0.24 * s, 0.3 * s, 0.25);
      bag.translate(-(r.w + 0.06 * s), b.hipY - 0.2 * s, 0.03 * s);
      this.w(B.pelvis, bag, o.bagTone);
      this.w(B.pelvis, block(0.084 * s, 0.1 * s, 0.304 * s).translate(-(r.w + 0.06 * s), b.hipY - 0.06 * s, 0.03 * s), Math.min(1, o.bagTone + 0.2));
    }
    if (ex.has("hoodDown")) {
      const r = ringAt(this.profile, b.shoulderY);
      const hood = rumple(ellipsoid(0.14 * s, 0.07 * s, 0.07 * s, this.rl, 5), 0.006, this.seed, 20);
      hood.translate(0, b.shoulderY + 0.02 * s, (r.z ?? 0) - r.b - 0.04 * s);
      this.w(B.spine, hood, o.topTone);
    }
    const Hh = b.headH;
    const cz = b.headD * 0.1;
    const eyeY = Hh * 0.44 - Hh * 0.02;
    if (ex.has("glasses") || ex.has("goggles")) {
      const goggles = ex.has("goggles");
      const y = goggles ? Hh * 0.44 + Hh * 0.34 : eyeY;
      const z = cz + b.headD * (goggles ? 0.9 : 0.93);
      for (const side of [1, -1]) {
        const lens = goggles ? this.slab(0.05 * this.s, 0.035 * this.s, 0.02, 0.4) : ellipseRing(0.018 * this.s, 0.014 * this.s, 0.0035, 7, 3);
        if (goggles) lens.translate(side * 0.03 * this.s, y - 0.017, z);
        else {
          lens.rotateX(Math.PI / 2);
          lens.translate(side * 0.032 * this.s, y, z);
        }
        this.l(B.head, lens, goggles ? TONE.light : TONE.solid);
      }
      if (goggles) this.l(B.head, ellipseRing(b.headW * 1.04, b.headD * 1.02, 0.006, this.rr, 3).translate(0, y, cz), TONE.deep);
      else this.l(B.head, tube([[-b.headW, eyeY, cz + 0.02], [-0.05 * this.s, eyeY, z - 0.004], [0.05 * this.s, eyeY, z - 0.004], [b.headW, eyeY, cz + 0.02]], 0.003, 8, 3), TONE.solid);
    }
    if (ex.has("earDefenders") || ex.has("headphones")) {
      const big = ex.has("earDefenders");
      const cup = cylinder((big ? 0.042 : 0.032) * s, (big ? 0.042 : 0.032) * s, (big ? 0.035 : 0.025) * s, this.rl);
      for (const side of [1, -1]) {
        const c = cup.clone();
        c.rotateZ(Math.PI / 2);
        c.translate(side * (b.headW + 0.015 * s), Hh * 0.4, cz - 0.01);
        this.l(B.head, c, big ? TONE.mid : TONE.solid);
      }
      this.l(
        B.head,
        tube(
          [
            [b.headW + 0.012, Hh * 0.45, cz - 0.01],
            [b.headW * 0.9, Hh * 0.85, cz - 0.01],
            [0, Hh * 1.0, cz - 0.015],
            [-b.headW * 0.9, Hh * 0.85, cz - 0.01],
            [-b.headW - 0.012, Hh * 0.45, cz - 0.01],
          ],
          0.008 * s,
          8,
          3,
        ),
        TONE.deep,
      );
    }
    if (ex.has("mask")) {
      const g = this.shell(1.07, 1.03, 1.08, (xn, yn, zn) => zn > -0.1 && yn < -0.08 && yn > -1.02 && Math.abs(xn) < 1.1, 1);
      this.l(B.head, g, TONE.dark);
    }
    if (ex.has("bands") && o.over === "none") {
      // Reflective tape on a coverall/jumpsuit: torso hoop and sleeve hoops.
      this.w(B.spine, this.band(b.waistY + 0.06 * s, 0.04 * s, 0.03), TONE.pale);
      for (const side of [1, -1] as const) {
        const arm = side > 0 ? B.armL : B.armR;
        this.l(arm, ellipseRing(b.upperArmR * 1.3, b.upperArmR * 1.3, 0.012 * s, this.rr, 3).translate(0, -b.upperArm * 0.6, 0), TONE.pale);
      }
    }
  }

  // ------------------------------------------------------------------ props

  private held(d: Dressing): void {
    const b = this.b;
    const gripHeight = b.shoulderY - b.upperArm * 0.97 - b.foreArm * 0.94 - b.hand * 0.42;
    for (const [kind, bone] of [
      [d.right, B.propR],
      [d.left, B.propL],
    ] as const) {
      if (!kind) continue;
      for (const p of heldProp(kind, { gripHeight, seed: this.seed })) this.l(bone, p.g, (p.o.tone as number) ?? 0, p.o);
    }
  }
}

function ringAtList(rings: Ring[], y: number): Ring {
  return ringAt(rings, y);
}
