/**
 * Places a decision's tableau on the fork: each option's occupants along its
 * branch, a destination beyond, an enamel sign at each toe, and a signal at
 * the junction. Returns the stakes the journey collides with.
 */
import * as THREE from "three";
import type { Occupant, OptionStaging, SideStaging } from "../api.ts";
import type { AssetProvider } from "../assets.ts";
import { createRng, type Rng } from "../core/rng.ts";
import { releaseObject } from "../core/ink-material.ts";
import type { Stake } from "./journey.ts";
import type { Junction, Side } from "./track/network.ts";
import type { TrackLine } from "./track/path.ts";
import { GAUGE, RAIL_TOP } from "./track/mesh.ts";

export const FIRST_STAKE = 15;

export interface PlacedActor {
  object: THREE.Object3D;
  side: Side;
  s: number;
  struck: boolean;
  living: boolean;
}

export interface Tableau {
  group: THREE.Group;
  stakes: Stake[];
  actors: PlacedActor[];
  junction: Junction;
  signal: THREE.Object3D | null;
  tickers: THREE.Object3D[];
}

function place(object: THREE.Object3D, line: TrackLine, s: number, lateral: number, height: number, facing: "track" | "trolley" | "away" | "along", rng: Rng): void {
  line.extendTo(s + 2);
  const p = line.offset(s, lateral);
  object.position.set(p.x, height, p.z);
  // Assets face +Z. Heading h travels toward (sin h, -cos h), so a rotation
  // of -h turns an asset's front back down the line, toward the trolley.
  const toward = -p.heading;
  if (facing === "trolley") object.rotation.y = toward + rng.range(-0.35, 0.35);
  else if (facing === "away") object.rotation.y = toward + Math.PI + rng.range(-0.3, 0.3);
  else if (facing === "along") object.rotation.y = toward + (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  else object.rotation.y = toward + (lateral < 0 ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.3, 0.3);
}

const CROWD_CAP = 28;

/** True when a footprint of radius r at (x, z) stands clear of every drawn line. */
export type ClearOfTrack = (x: number, z: number, r: number) => boolean;

/** Footprint radius of a placed building (metres), from its declared footprint. */
function footprintRadius(o: THREE.Object3D): number {
  const f = (o.userData.footprint as { width?: number; depth?: number } | undefined) ?? {};
  return Math.hypot(f.width ?? 20, f.depth ?? 20) / 2;
}

/**
 * Place a large object beside a line, stepping it farther out until it stands
 * clear of all track (the line continues past it and may bend toward it).
 * Returns false (and places nothing) when no clear spot is found.
 */
function placeClear(o: THREE.Object3D, line: TrackLine, s: number, lateral: number, facing: "track" | "along", rng: Rng, clear: ClearOfTrack | undefined): boolean {
  const r = footprintRadius(o) + 4;
  for (const k of [1, 1.35, 1.8, 2.4]) {
    place(o, line, s, lateral * k, 0, facing, rng);
    if (!clear || clear(o.position.x, o.position.z, r)) return true;
  }
  return false;
}

export function buildTableau(
  junction: Junction,
  staging: SideStaging,
  assets: AssetProvider,
  seed: string,
  options: { rail?: { loopSide?: Side; brakeOnLoop?: boolean }; clearOfTrack?: ClearOfTrack; reducedGraphics?: boolean } = {},
): Tableau {
  const group = new THREE.Group();
  group.name = `tableau:${junction.key}`;
  const stakes: Stake[] = [];
  const actors: PlacedActor[] = [];
  const tickers: THREE.Object3D[] = [];
  const add = (o: THREE.Object3D) => {
    group.add(o);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    if (typeof o.userData.tick === "function") tickers.push(o);
  };
  const deck = RAIL_TOP - 0.02;
  for (const side of ["left", "right"] as const) {
    const line = side === "left" ? junction.left : junction.right;
    const option: OptionStaging = staging[side];
    const rng = createRng(`${seed}:${junction.key}:${side}`);
    const struck = option.beat === "impact" || option.beat === "stop" || option.beat === undefined;
    // Small objects sit nearer the toe so they read from the cab.
    const smallOnly = option.occupants.length > 0 && option.occupants.every((o) => o.kind === "prop" || o.kind === "document");
    let s = smallOnly ? FIRST_STAKE - 6 : FIRST_STAKE;
    const outward = side === "left" ? -1 : 1;
    for (const occ of option.occupants) {
      s = placeOccupant(occ, { line, side, s, struck, rng, add, actors, stakes, assets, seed: `${seed}:${junction.key}:${side}`, deck, outward, blood: !options.reducedGraphics });
    }
    if (option.sign) {
      const sign = assets.sign(option.sign, "enamel");
      place(sign, line, 7, outward * 2.8, 0, "trolley", rng);
      sign.rotation.y += outward * -0.35;
      add(sign);
    }
    if (option.destination) {
      const dest = assets.landmark(option.destination, { seed: `${seed}:${junction.key}:${side}:dest`, env: {} });
      const footprint = (dest.userData.footprint as { width?: number; depth?: number } | undefined) ?? {};
      // A bridge lies along the line (it is long, and would otherwise span it).
      const bridge = !!dest.userData.bridge;
      const clearance = bridge ? Math.max(24, (footprint.width ?? 10) / 2 + 16) : Math.max(18, ((footprint.width ?? 20) + (footprint.depth ?? 20)) / 3);
      if (placeClear(dest, line, rng.range(130, 175), outward * clearance, bridge ? "along" : "track", rng, options.clearOfTrack)) add(dest);
    }
  }
  for (const [i, id] of staging.landmarks.entries()) {
    const rng = createRng(`${seed}:${junction.key}:landmark:${i}`);
    const lm = assets.landmark(id, { seed: `${seed}:${junction.key}:lm${i}`, env: {} });
    const side = i % 2 === 0 ? junction.left : junction.right;
    const bridge = !!lm.userData.bridge;
    const lateral = (i % 2 === 0 ? -1 : 1) * Math.max(rng.range(bridge ? 40 : 30, 55), footprintRadius(lm) + 12);
    if (placeClear(lm, side, rng.range(60, 110), lateral, bridge ? "along" : "track", rng, options.clearOfTrack)) add(lm);
  }
  // The junction signal stands beyond the toe, well out to the right and
  // turned toward the cab, so it reads beside the right route tag, not under it.
  const signal = assets.signal();
  const stemRng = createRng(`${seed}:${junction.key}:signal`);
  place(signal, junction.stem, junction.toe + 8, 6.2, 0, "trolley", stemRng);
  signal.rotation.y = -junction.stem.pose(junction.toe).heading - 0.42;
  signal.userData.setAspect?.("red");
  signal.userData.setRoute?.(null);
  add(signal);
  return { group, stakes, actors, junction, signal, tickers };
}

interface PlaceContext {
  line: TrackLine;
  side: Side;
  s: number;
  struck: boolean;
  rng: Rng;
  add(o: THREE.Object3D): void;
  actors: PlacedActor[];
  stakes: Stake[];
  assets: AssetProvider;
  seed: string;
  deck: number;
  outward: number;
  /** False under less graphic detail: no pools after a strike. */
  blood: boolean;
}

function placeOccupant(occ: Occupant, c: PlaceContext): number {
  const { line, side, rng, add, assets } = c;
  let s = c.s;
  const onRails = c.struck;
  const record = (object: THREE.Object3D, at: number, living: boolean, lateral: number) => {
    add(object);
    c.actors.push({ object, side, s: at, struck: onRails && Math.abs(lateral) < 1.6, living });
    if (onRails && Math.abs(lateral) < 1.6) c.stakes.push({ side, s: at, struck: true });
  };
  switch (occ.kind) {
    case "people": {
      const shown = Math.min(occ.count, CROWD_CAP);
      const spread = occ.spread ?? (occ.pose === "tied" ? "across" : occ.count > 8 ? "crowd" : "line");
      for (let i = 0; i < shown; i++) {
        const tied = spread === "across" || occ.pose === "tied";
        const person = assets.person({
          role: occ.role,
          pose: occ.pose ?? (tied ? "tied" : "stand"),
          seed: `${c.seed}:${s}:${i}`,
          detail: shown > 8 ? 0 : 1,
          ...(tied ? { ground: -c.deck } : {}),
          ...(occ.name && i === 0 ? { name: occ.name } : {}),
          blood: c.blood,
        });
        let at = s;
        let lateral = 0;
        // Crews bent over the rail have their backs to the trolley; people on
        // the move are side-on; everyone else has seen it coming.
        let facing: "track" | "trolley" | "away" | "along" = occ.pose === "work" ? "away" : occ.pose === "walk" || occ.pose === "carry" || occ.pose === "queue" ? "along" : "trolley";
        if (spread === "across") {
          // Bound across the rails, bodies along local X, faces toward the trolley.
          at = s + i * 1.15;
          lateral = 0;
          facing = "trolley";
        } else if (spread === "line") {
          at = s + i * 1.6 + rng.range(-0.2, 0.2);
          lateral = onRails ? rng.range(-0.55, 0.55) : c.outward * rng.range(2.6, 4);
        } else if (spread === "cluster") {
          at = s + rng.range(0, 3.5);
          lateral = onRails ? rng.range(-1.1, 1.1) : c.outward * rng.range(2.5, 6);
        } else {
          const row = Math.floor(i / 6);
          at = s + row * 1.4 + rng.range(-0.3, 0.3);
          lateral = onRails ? rng.range(-1.3, 1.3) : c.outward * rng.range(2.5, 9);
          if (i >= 12) lateral = c.outward * rng.range(2.4, 10) * (onRails ? 1 : 1.2);
        }
        place(person, line, at, lateral, spread === "across" ? c.deck : 0.35, facing, rng);
        if (spread === "across") person.rotation.y = -line.pose(at).heading + Math.PI;
        record(person, at, true, lateral);
      }
      if (occ.count > shown && assets.person) {
        // Larger numbers: a denser mass beside the line conveys scale.
        const extra = Math.min(60, occ.count - shown);
        for (let i = 0; i < extra; i++) {
          const person = assets.person({ role: occ.role, pose: "stand", seed: `${c.seed}:mass:${i}`, detail: 0, blood: c.blood });
          const at = s + rng.range(-2, 14);
          const lateral = c.outward * rng.range(4, 16);
          place(person, line, at, lateral, 0, "trolley", rng);
          add(person);
          c.actors.push({ object: person, side, s: at, struck: false, living: true });
        }
      }
      s += spread === "across" ? shown * 1.05 + 2 : Math.min(shown, 8) * 1.4 + 3;
      break;
    }
    case "animal": {
      for (let i = 0; i < Math.min(occ.count, 12); i++) {
        const a = assets.animal(occ.species, { seed: `${c.seed}:${s}:${i}`, behavior: "graze", blood: c.blood });
        const at = s + i * 2.2;
        const lateral = onRails ? rng.range(-0.8, 0.8) : c.outward * rng.range(3, 7);
        place(a, line, at, lateral, onRails ? 0.35 : 0, "along", rng);
        record(a, at, true, lateral);
      }
      s += Math.min(occ.count, 12) * 2.2 + 3;
      break;
    }
    case "prop": {
      const n = Math.min(occ.count ?? 1, 8);
      for (let i = 0; i < n; i++) {
        const prop = assets.prop(occ.prop, { seed: `${c.seed}:${s}:${i}`, scale: occ.scale ?? 2.2 });
        const at = s + i * 0.9;
        const lateral = onRails ? (n > 1 ? (i % 2 ? 0.35 : -0.35) : GAUGE / 2) : c.outward * 2.6;
        place(prop, line, at, lateral, onRails ? c.deck : 0, "trolley", rng);
        record(prop, at, false, onRails ? 0 : lateral);
      }
      s += n * 0.9 + 3;
      break;
    }
    case "document": {
      const n = Math.min(occ.count ?? 1, 6);
      for (let i = 0; i < n; i++) {
        const doc = assets.document(occ.doc, { seed: `${c.seed}:${s}:${i}`, ...(occ.label ? { label: occ.label } : {}) });
        doc.scale.setScalar(2.2);
        const at = s + i * 1.2;
        place(doc, line, at, onRails ? 0 : c.outward * 2.6, onRails ? RAIL_TOP - 0.15 : 0, "trolley", rng);
        record(doc, at, false, onRails ? 0 : 3);
      }
      s += n * 1.2 + 3;
      break;
    }
    case "vehicle": {
      const railVehicle = occ.vehicle === "rescue-carriage" || occ.vehicle === "passenger-carriage" || occ.vehicle === "freight-wagon" || occ.vehicle === "catering-trolley";
      const n = Math.min(occ.count ?? 1, 4);
      for (let i = 0; i < n; i++) {
        const v = assets.vehicle(occ.vehicle, { seed: `${c.seed}:${s}:${i}` });
        const at = s + 4 + i * 9;
        const lateral = railVehicle && onRails ? 0 : c.outward * rng.range(4.5, 7);
        place(v, line, at, lateral, railVehicle ? RAIL_TOP : 0, railVehicle ? "away" : "along", rng);
        record(v, at, false, lateral);
      }
      s += n * 9 + 5;
      break;
    }
    case "machine": {
      const n = Math.min(occ.count ?? 1, 6);
      for (let i = 0; i < n; i++) {
        const m = occ.machine === "drone-swarm" && assets.droneSwarm ? assets.droneSwarm({ count: 80, seed: `${c.seed}:${s}` }) : assets.machine(occ.machine, { seed: `${c.seed}:${s}:${i}` });
        const at = s + i * 1.8;
        const lateral = onRails ? rng.range(-0.4, 0.4) : c.outward * rng.range(2.8, 5);
        place(m, line, at, lateral, occ.machine === "drone" || occ.machine === "drone-swarm" ? 6 : onRails ? c.deck - 0.1 : 0, "trolley", rng);
        record(m, at, occ.machine === "robot-humanoid" || occ.machine === "robot-quadruped", lateral);
      }
      s += n * 1.8 + 3;
      break;
    }
  }
  return s;
}

export function disposeTableau(t: Tableau): void {
  t.group.removeFromParent();
  releaseObject(t.group);
}

export function occupantsDescription(option: OptionStaging): string {
  const parts = option.occupants.map((o) => {
    switch (o.kind) {
      case "people":
        return `${o.count === 1 ? "one" : o.count} ${o.role}${o.count === 1 ? "" : "s"}${o.pose === "tied" ? " tied across the rails" : ""}${o.name ? ` (${o.name})` : ""}`;
      case "animal":
        return `${o.count} ${o.species}${o.count === 1 ? "" : "s"}`;
      case "prop":
        return `${o.count && o.count > 1 ? o.count + " × " : "a "}${o.prop.replace(/-/g, " ")}`;
      case "document":
        return `a ${o.doc.replace(/-/g, " ")}${o.label ? ` stamped "${o.label}"` : ""}`;
      case "vehicle":
        return `a ${o.vehicle.replace(/-/g, " ")}`;
      case "machine":
        return `a ${o.machine.replace(/-/g, " ")}`;
    }
  });
  const dest = option.destination ? `, leading to the ${option.destination.replace(/-/g, " ")}` : "";
  return `${parts.join(", ") || "clear track"}${dest}`;
}
