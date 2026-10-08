/**
 * Props, documents, signs and trackside furniture for the ink world.
 *
 *   buildProp(id, { seed, scale?, label?, variant? })        every PropId
 *   buildDocument(id, { seed, label?, title?, scale? })      every DocumentId
 *   buildSign(text, { style: 'enamel'|'stencil'|'placard'|'warning'|'station' })
 *   buildSignal({ aspect?, route? })  userData.setAspect / setRoute
 *   buildBufferStop(), buildGroundFrame(), buildLampPost(), buildBench(),
 *   buildBin(), buildBollard(), buildCone(), buildBarrier()
 *
 * Conventions (docs/render/ASSET_KIT.md): metres, Y up, origin at the base
 * centre, face toward +Z. Every root carries `userData.footprint` (unscaled
 * width/depth/height), `userData.placement` ("surface" | "track" | "ground")
 * and any live controls (setAspect, setLever, setLit, setTime, tick) copied up
 * from the part that owns them.
 *
 * Readability scale: props accept `scale` up to 2. Each prop declares how much
 * of that it takes (`scalable`); furniture and anything person-sized stays at
 * true size so it never dwarfs the people beside it.
 */
import * as THREE from "three";
import type { DocumentId, PropId } from "../api.ts";
import type { AssetProvider } from "../assets.ts";
import { createRng } from "../core/rng.ts";
import { HATCH, OBJECT_ID, finish, propMaterial, proppedUp, variantOf } from "./common.ts";
import type { BuildCtx, Built } from "./types.ts";
import * as small from "./small.ts";
import * as cargo from "./cargo.ts";
import * as care from "./care.ts";
import { buildDocumentPart, defaultTitle } from "./documents.ts";
import { buildSignPart, type SignOptions, type SignStyle } from "./signs.ts";
import { buildBufferStopPart, buildGroundFramePart, buildSignalPart, type GroundFrameOptions, type RouteIndication, type SignalAspect, type SignalOptions } from "./rail.ts";
import {
  buildBarrierPart,
  buildBenchPart,
  buildBinPart,
  buildBollardPart,
  buildConePart,
  buildLampPostPart,
  type BarrierKind,
  type BenchKind,
  type BinKind,
  type BollardKind,
  type LampKind,
  type LampOptions,
} from "./street.ts";

export type { SignOptions, SignStyle, SignalAspect, SignalOptions, RouteIndication, GroundFrameOptions, LampKind, LampOptions, BenchKind, BinKind, BollardKind, BarrierKind };
export type { Built, Footprint, Placement } from "./types.ts";
export { defaultTitle as documentTitle };

export const PROP_IDS: readonly PropId[] = [
  "coffee-cup",
  "paperwork",
  "hat",
  "umbrella",
  "parcel",
  "crate",
  "oxygen-cylinder",
  "sandwich-tray",
  "station-clock",
  "megaphone",
  "bell",
  "chicken-box",
  "milk-crate",
  "jar",
  "pie",
  "data-drive",
  "bag",
  "keys",
  "fruit-bowl",
  "stamp",
  "folder",
  "register-book",
  "shovel",
  "ribbon",
  "cone",
  "barrier",
  "suitcase",
  "flowers",
  "bench",
  "stretcher",
  "wheelchair",
  "grain-sacks",
  "water-tank",
  "fuel-drum",
  "generator",
  "toolbox",
  "lantern",
  "teddy-bear",
] as const;

export const DOCUMENT_IDS: readonly DocumentId[] = ["contract", "license", "report", "certificate", "permit", "treaty", "org-chart", "appeal", "archive-box", "ruling", "ledger", "order", "map"] as const;

export const SIGN_STYLES: readonly SignStyle[] = ["enamel", "stencil", "placard", "warning", "station"] as const;

/** Largest readability enlargement a caller may request. */
export const MAX_READABILITY_SCALE = 2;

export interface PropOptions {
  seed: number | string;
  /** Readability scale, 1..2 (clamped); applied in proportion to the prop's own `scalable`. */
  scale?: number;
  /** Printed wording where the prop carries any (stamp impression, drive label, fob, tag, card). */
  label?: string;
  /** Force a variant instead of deriving one from the seed. */
  variant?: number;
  /**
   * Paper props only (paperwork, folder): "propped" stands the stack up on a
   * brick so its cover reads from the cab; "flat" lays it down. Default:
   * paperwork propped, folder flat.
   */
  pose?: "flat" | "propped";
}

export interface DocumentOptions {
  seed: number | string;
  /** The rubber-stamp word: "APPROVED", "EXTENDED", "REVOKE", "FOREVER"... */
  label?: string;
  /** Override the printed title (defaults per id, e.g. "SERVICE AGREEMENT"). */
  title?: string;
  /** Readability scale (staging usually sets root scale itself). */
  scale?: number;
  variant?: number;
  /**
   * Paper documents only (contract, license, appeal, ruling): "propped" stands
   * the document up on a brick facing the trolley so its title and stamp read
   * from the cab. Default: contract, license and appeal propped; ruling flat
   * (its gavel lies on it). The other documents are upright by construction.
   */
  pose?: "flat" | "propped";
}

/** Paper that can be stood up on a brick, and whether it is by default. */
const PROPPABLE: Record<string, "flat" | "propped"> = {
  paperwork: "propped",
  folder: "flat",
  contract: "propped",
  license: "propped",
  appeal: "propped",
  ruling: "flat",
};

function poseFor(id: string, requested: "flat" | "propped" | undefined): "flat" | "propped" | undefined {
  const def = PROPPABLE[id];
  if (!def) return undefined;
  return requested ?? def;
}

function withPose(id: string, b: Built, pose: "flat" | "propped" | undefined): Built {
  if (pose !== "propped" || !PROPPABLE[id]) return b;
  const depth = b.footprint.depth;
  const inner = b.object;
  const spin = inner.rotation.y;
  inner.rotation.y = 0;
  const g = proppedUp(inner, depth, propMaterial(HATCH.small, OBJECT_ID.document));
  g.rotation.y = spin * 0.3;
  const wrapper = new THREE.Group();
  wrapper.add(g);
  for (const [k, v] of Object.entries(inner.userData)) wrapper.userData[k] = v;
  const angle = 1.15;
  return {
    object: wrapper,
    footprint: { width: b.footprint.width, depth: depth * Math.cos(angle) + 0.12, height: depth * Math.sin(angle) + b.footprint.height },
    scalable: b.scalable,
    placement: b.placement,
  };
}

function ctxOf(kind: string, id: string, seed: number | string, label: string | undefined, variant: number | undefined): BuildCtx {
  const s = String(seed);
  return {
    rng: createRng(`${kind}:${id}:${s}`),
    seed: s,
    variant: variant ?? variantOf(s, 6, id),
    ...(label ? { label } : {}),
  };
}

/** Wrap a built part as the public root, lifting live controls to the root. */
function publish(kind: string, id: string, b: Built, requested: number | undefined): THREE.Group {
  const req = Math.max(0.5, Math.min(MAX_READABILITY_SCALE, requested ?? 1));
  const scale = req >= 1 ? 1 + (req - 1) * b.scalable : req;
  const root = finish(b.object, { kind, id, scale, footprint: b.footprint });
  root.userData.placement = b.placement;
  root.userData.scalable = b.scalable;
  // Lift live controls to the root; state they change (aspect, route, lit)
  // is mirrored back after every call so the root always reads true.
  const inner = b.object.userData;
  const STATE = ["aspect", "route", "levers", "lit"];
  const sync = () => {
    for (const k of STATE) if (k in inner) root.userData[k] = inner[k];
  };
  for (const [k, v] of Object.entries(inner)) {
    if (typeof v !== "function") continue;
    const fn = v as (...args: unknown[]) => unknown;
    root.userData[k] = (...args: unknown[]) => {
      const r = fn(...args);
      sync();
      return r;
    };
  }
  sync();
  return root;
}

function propPart(id: PropId, c: BuildCtx): Built {
  switch (id) {
    case "coffee-cup":
      return small.coffeeCup(c);
    case "paperwork":
      return paperwork(c);
    case "hat":
      return small.hat(c);
    case "umbrella":
      return small.umbrella(c);
    case "parcel":
      return cargo.parcel(c);
    case "crate":
      return cargo.crate(c);
    case "oxygen-cylinder":
      return cargo.oxygenCylinder(c);
    case "sandwich-tray":
      return small.sandwichTray(c);
    case "station-clock":
      return small.stationClock(c);
    case "megaphone":
      return small.megaphone(c);
    case "bell":
      return small.bell(c);
    case "chicken-box":
      return cargo.chickenBox(c);
    case "milk-crate":
      return cargo.milkCrate(c);
    case "jar":
      return small.jar(c);
    case "pie":
      return small.pie(c);
    case "data-drive":
      return small.dataDrive(c);
    case "bag":
      return cargo.bag(c);
    case "keys":
      return small.keys(c);
    case "fruit-bowl":
      return small.fruitBowl(c);
    case "stamp":
      return small.rubberStamp(c);
    case "folder":
      return folder(c);
    case "register-book":
      return registerBook(c);
    case "shovel":
      return cargo.shovel(c);
    case "ribbon":
      return small.ribbon(c);
    case "cone":
      return buildConePart();
    case "barrier":
      return buildBarrierPart((["trestle", "trestle", "crowd", "jersey"] as const)[c.variant % 4]!);
    case "suitcase":
      return cargo.suitcase(c);
    case "flowers":
      return care.flowers(c);
    case "bench":
      return buildBenchPart("platform");
    case "stretcher":
      return care.stretcher(c);
    case "wheelchair":
      return care.wheelchair(c);
    case "grain-sacks":
      return cargo.grainSacks(c);
    case "water-tank":
      return cargo.waterTank(c);
    case "fuel-drum":
      return cargo.fuelDrum(c);
    case "generator":
      return cargo.generator(c);
    case "toolbox":
      return cargo.toolbox(c);
    case "lantern":
      return care.lantern(c);
    case "teddy-bear":
      return care.teddyBear(c);
    default: {
      const never: never = id;
      throw new Error(`Unknown prop ${String(never)}`);
    }
  }
}

// Paper props live beside the documents.
import { paperwork, folder, registerBook } from "./paperwork.ts";

export function buildProp(id: PropId, options: PropOptions): THREE.Object3D {
  const c = ctxOf("prop", id, options.seed, options.label, options.variant);
  const pose = poseFor(id, options.pose);
  if (pose) c.pose = pose;
  return publish("prop", id, withPose(id, propPart(id, c), pose), options.scale);
}

export function buildDocument(id: DocumentId, options: DocumentOptions): THREE.Object3D {
  const c = ctxOf("document", id, options.seed, options.label, options.variant);
  const pose = poseFor(id, options.pose);
  if (pose) c.pose = pose;
  return publish("document", id, withPose(id, buildDocumentPart(id, c, options.title ? { title: options.title } : {}), pose), options.scale);
}

/** Trackside sign. Enamel branch signs take up to 28 characters and wrap to two lines. */
export function buildSign(text: string, options: SignOptions): THREE.Object3D {
  return publish("sign", options.style, buildSignPart(text, options), 1);
}

/** Colour-light junction signal. `userData.setAspect(aspect)`, `userData.setRoute('left'|'right'|null)`. */
export function buildSignal(options: SignalOptions = {}): THREE.Object3D {
  return publish("trackside", "signal", buildSignalPart(options), 1);
}

/** Bent-rail buffer stop. Origin: rail-top plane at the track centre; faces the approaching train (+Z). */
export function buildBufferStop(): THREE.Object3D {
  return publish("trackside", "buffer-stop", buildBufferStopPart(), 1);
}

/** Point-lever ground frame with rodding. `userData.setLever(index, -1..1)`. */
export function buildGroundFrame(options: GroundFrameOptions = {}): THREE.Object3D {
  return publish("trackside", "ground-frame", buildGroundFramePart(options), 1);
}

/** Lamp post: 'station' (cast iron), 'street' (sodium), 'flood' (mast with camera). `userData.setLit(on)`. */
export function buildLampPost(options: LampOptions = {}): THREE.Object3D {
  return publish("trackside", `lamp-${options.kind ?? "station"}`, buildLampPostPart(options), 1);
}

export function buildBench(options: { kind?: BenchKind } = {}): THREE.Object3D {
  return publish("trackside", `bench-${options.kind ?? "platform"}`, buildBenchPart(options.kind ?? "platform"), 1);
}

export function buildBin(options: { kind?: BinKind } = {}): THREE.Object3D {
  return publish("trackside", `bin-${options.kind ?? "litter"}`, buildBinPart(options.kind ?? "litter"), 1);
}

export function buildBollard(options: { kind?: BollardKind } = {}): THREE.Object3D {
  return publish("trackside", `bollard-${options.kind ?? "cast"}`, buildBollardPart(options.kind ?? "cast"), 1);
}

export function buildCone(): THREE.Object3D {
  return publish("trackside", "cone", buildConePart(), 1);
}

/** 'trestle' (striped boards), 'crowd' (steel pedestrian), 'jersey' (concrete), 'boom' (checkpoint arm, `userData.setOpen(0..1)`). */
export function buildBarrier(options: { kind?: BarrierKind } = {}): THREE.Object3D {
  return publish("trackside", `barrier-${options.kind ?? "trestle"}`, buildBarrierPart(options.kind ?? "trestle"), 1);
}

/**
 * Drop-in slice of the renderer's AssetProvider (src/render/assets.ts):
 * `const realAssets = { ...placeholderAssets, ...propAssets, ... }`.
 */
export const propAssets: Pick<AssetProvider, "prop" | "document" | "sign" | "signal" | "bufferStop"> = {
  prop: (id, spec) => buildProp(id, { seed: spec.seed, ...(spec.scale !== undefined ? { scale: spec.scale } : {}), ...(spec.label ? { label: spec.label } : {}) }),
  document: (id, spec) => buildDocument(id, { seed: spec.seed, ...(spec.label ? { label: spec.label } : {}) }),
  sign: (text, style) => buildSign(text, { style }),
  signal: () => buildSignal(),
  bufferStop: () => buildBufferStop(),
};

export type TracksideKind =
  | "signal"
  | "buffer-stop"
  | "ground-frame"
  | "lamp-station"
  | "lamp-street"
  | "lamp-flood"
  | "bench-platform"
  | "bench-steel"
  | "bin-litter"
  | "bin-clear-sack"
  | "bin-wheelie"
  | "bollard-cast"
  | "bollard-concrete"
  | "bollard-steel"
  | "cone"
  | "barrier-trestle"
  | "barrier-crowd"
  | "barrier-jersey"
  | "barrier-boom";

export const TRACKSIDE_KINDS: readonly TracksideKind[] = [
  "signal",
  "buffer-stop",
  "ground-frame",
  "lamp-station",
  "lamp-street",
  "lamp-flood",
  "bench-platform",
  "bench-steel",
  "bin-litter",
  "bin-clear-sack",
  "bin-wheelie",
  "bollard-cast",
  "bollard-concrete",
  "bollard-steel",
  "cone",
  "barrier-trestle",
  "barrier-crowd",
  "barrier-jersey",
  "barrier-boom",
] as const;

/** Any trackside furniture by catalogue kind (for scatter and the lab). */
export function buildTrackside(kind: TracksideKind, options: { lit?: boolean } = {}): THREE.Object3D {
  switch (kind) {
    case "signal":
      return buildSignal();
    case "buffer-stop":
      return buildBufferStop();
    case "ground-frame":
      return buildGroundFrame();
    case "lamp-station":
      return buildLampPost({ kind: "station", ...(options.lit !== undefined ? { lit: options.lit } : {}) });
    case "lamp-street":
      return buildLampPost({ kind: "street", ...(options.lit !== undefined ? { lit: options.lit } : {}) });
    case "lamp-flood":
      return buildLampPost({ kind: "flood", ...(options.lit !== undefined ? { lit: options.lit } : {}) });
    case "bench-platform":
      return buildBench({ kind: "platform" });
    case "bench-steel":
      return buildBench({ kind: "steel" });
    case "bin-litter":
      return buildBin({ kind: "litter" });
    case "bin-clear-sack":
      return buildBin({ kind: "clear-sack" });
    case "bin-wheelie":
      return buildBin({ kind: "wheelie" });
    case "bollard-cast":
      return buildBollard({ kind: "cast" });
    case "bollard-concrete":
      return buildBollard({ kind: "concrete" });
    case "bollard-steel":
      return buildBollard({ kind: "steel" });
    case "cone":
      return buildCone();
    case "barrier-trestle":
      return buildBarrier({ kind: "trestle" });
    case "barrier-crowd":
      return buildBarrier({ kind: "crowd" });
    case "barrier-jersey":
      return buildBarrier({ kind: "jersey" });
    case "barrier-boom":
      return buildBarrier({ kind: "boom" });
    default: {
      const never: never = kind;
      throw new Error(`Unknown trackside kind ${String(never)}`);
    }
  }
}
