/**
 * Presentation contracts for the ink world renderer.
 *
 * Nothing here may import the simulation's mutable state or write back to it.
 * The app derives a StageView from the (immutable) Campaign on every screen
 * change and hands it to the renderer. The renderer owns cosmetic time.
 */

// ------------------------------------------------------------------ staging

/** Who can stand on a track or near it. */
export type PersonRole =
  | "worker" // hi-vis vest, hard hat: track and maintenance crews
  | "crew" // orange coveralls, tool belts
  | "civilian"
  | "commuter" // coat, bag
  | "child"
  | "elder"
  | "nurse"
  | "doctor"
  | "patient" // hospital gown, may be on stretcher/wheelchair
  | "paramedic"
  | "engineer" // overalls, clipboard, ear defenders
  | "official" // suit, lanyard
  | "executive" // sharp suit
  | "inspector" // coat, clipboard
  | "researcher" // lab coat
  | "soldier"
  | "police"
  | "protester" // holds a placard
  | "farmer"
  | "student"
  | "stationmaster" // rail uniform, cap
  | "passenger"
  | "refugee" // blanket, bundle
  | "volunteer"; // tabard

export type Pose =
  | "stand"
  | "walk"
  | "work" // swinging tool / bending
  | "wave"
  | "sit"
  | "tied" // lying across the rail, bound
  | "kneel"
  | "cower"
  | "point"
  | "hold-sign"
  | "queue"
  | "carry"
  | "lie" // on a stretcher / ground
  | "wheelchair"
  | "watch"; // turned toward the trolley, still

export type AnimalId = "cow" | "sheep" | "horse" | "dog" | "chicken" | "goose" | "deer" | "pig" | "rabbit" | "crow";

export type VehicleId =
  | "ambulance"
  | "van"
  | "bus"
  | "car"
  | "truck"
  | "tractor"
  | "bicycle"
  | "rescue-carriage"
  | "freight-wagon"
  | "passenger-carriage"
  | "catering-trolley"
  | "military-truck"
  | "armored-vehicle"
  | "fire-engine";

export type MachineId =
  | "server-rack"
  | "robot-humanoid"
  | "robot-quadruped"
  | "drone"
  | "drone-swarm"
  | "isolation-cabinet"
  | "transformer"
  | "switchboard"
  | "pump"
  | "sorter"
  | "terminal"
  | "kill-switch"
  | "antenna"
  | "camera-mast";

export type PropId =
  | "coffee-cup"
  | "paperwork"
  | "hat"
  | "umbrella"
  | "parcel"
  | "crate"
  | "oxygen-cylinder"
  | "sandwich-tray"
  | "station-clock"
  | "megaphone"
  | "bell"
  | "chicken-box"
  | "milk-crate"
  | "jar"
  | "pie"
  | "data-drive"
  | "bag"
  | "keys"
  | "fruit-bowl"
  | "stamp"
  | "folder"
  | "register-book"
  | "shovel"
  | "ribbon"
  | "cone"
  | "barrier"
  | "suitcase"
  | "flowers"
  | "bench"
  | "stretcher"
  | "wheelchair"
  | "grain-sacks"
  | "water-tank"
  | "fuel-drum"
  | "generator"
  | "toolbox"
  | "lantern"
  | "teddy-bear";

export type DocumentId =
  | "contract"
  | "license"
  | "report"
  | "certificate"
  | "permit"
  | "treaty"
  | "org-chart"
  | "appeal"
  | "archive-box"
  | "ruling"
  | "ledger"
  | "order"
  | "map";

export type LandmarkId =
  | "clinic"
  | "hospital"
  | "depot"
  | "station"
  | "signal-box"
  | "library"
  | "school"
  | "farmhouse"
  | "barn"
  | "windmill"
  | "bridge"
  | "mill"
  | "warehouse"
  | "lab"
  | "greenhouse"
  | "data-center"
  | "substation"
  | "power-station"
  | "cooling-tower"
  | "factory"
  | "port-cranes"
  | "desalination"
  | "courthouse"
  | "dispatch-office"
  | "checkpoint"
  | "shelter"
  | "ruins"
  | "crater"
  | "garden"
  | "orchard"
  | "monolith"
  | "town-houses"
  | "church"
  | "water-tower"
  | "wind-turbines"
  | "solar-farm"
  | "pylon-line"
  | "antenna-array"
  | "security-fence"
  | "camp"
  | "burning-town"
  | "isolation-hall";

export type Occupant =
  | { kind: "people"; role: PersonRole; count: number; pose?: Pose; name?: string; spread?: "line" | "cluster" | "crowd" | "across" }
  | { kind: "prop"; prop: PropId; count?: number; scale?: number }
  | { kind: "animal"; species: AnimalId; count: number }
  | { kind: "vehicle"; vehicle: VehicleId; count?: number }
  | { kind: "machine"; machine: MachineId; count?: number }
  | { kind: "document"; doc: DocumentId; label?: string; count?: number };

/** What the player would do to this branch's contents by sending the trolley there. */
export type Beat =
  | "impact" // people/things are struck
  | "pass" // the trolley goes by; its contents are spared or simply reached
  | "stop" // a brake or obstruction halts the trolley
  | "deliver" // the branch carries a resource to its destination
  | "sever" // a line/cable/connection is cut
  | "seal"; // a door/gate/boundary closes behind

export interface OptionStaging {
  /** Physically on the rails (or immediately beside them), nearest first. */
  occupants: Occupant[];
  /** What the branch leads to, visible beyond the occupants. */
  destination?: LandmarkId;
  /** A small enamel sign at the branch toe, ≤ 28 characters, uppercase. */
  sign?: string;
  beat?: Beat;
}

export interface NodeStaging {
  /** Keyed by semantic option id. */
  options: Record<string, OptionStaging>;
  /** Extra landmarks to place near the junction. */
  landmarks?: LandmarkId[];
  /** Short screen-reader description of the tableau (optional). */
  describe?: string;
}

/** Oriented, per-side staging for the renderer. */
export interface SideStaging {
  left: OptionStaging;
  right: OptionStaging;
  landmarks: LandmarkId[];
}

// ------------------------------------------------------------- environment

/**
 * Continuous world channels, all 0..1. The renderer eases toward these.
 * Derived purely from the visible campaign (world + journal), never random.
 */
export interface EnvironmentTarget {
  vegetation: number;
  leaves: number;
  bloom: number;
  fauna: number;
  birds: number;
  habitation: number;
  people: number;
  industry: number;
  compute: number;
  surveillance: number;
  perfection: number;
  ruin: number;
  fire: number;
  drought: number;
  cloud: number;
  storm: number;
  lightning: number;
  fog: number;
  wind: number;
  /** 0 = pre-dawn, 0.25 = morning, 0.5 = noon, 0.75 = dusk, 1 = night. */
  timeOfDay: number;
  gloom: number;
  /** Cruise speed factor. Rises with capability, subtly. */
  speed: number;
  /** River presence near the line. */
  water: number;
  /** Uniform synthetic order: trees in grids, identical houses, synchronized lights. */
  uniformity: number;
}

export interface FaceState {
  /** 0 composed, 1 shock, 2 withdrawn, 3 fatigue, 4 grief, 5 dissociation, 6 afterimage. */
  stage: number;
  smile: number;
  fatigue: number;
  grief: number;
  shock: number;
  dissociation: number;
  age: number;
}

export interface CabinState {
  face: FaceState;
  /** Monotone count of impacts that have marked the glass. */
  impacts: number;
  /** Monotone count of impacts that left blood (0 when graphics reduced). */
  bloodied: number;
  authority: "human" | "delegated" | "overridden";
  /** The assistant has been installed in the dash screen. */
  morrow: boolean;
  /** Receipt lines printed so far (authority changes). */
  receipts: string[];
  /** How many receipt lines the run has produced in all (receipts holds only the latest). */
  receiptTotal: number;
  /** Speedometer reading, km/h, cosmetic. */
  speedKmh: number;
  /** Fictional clock label, e.g. "06:40". */
  clock: string;
  /** The saved coffee cup still rides on the dash. */
  keepsake: "coffee" | "forms" | null;
}

export type CueKind =
  | "freeze" // 2 s diegetic freeze
  | "false-dawn" // brief return to the pastoral world
  | "logo-flash" // Morrow mark flashes red once
  | "revision" // an ominous reply is rewritten
  | "lightning"
  | "glitch" // signal corruption bands
  | "jam" // the lever refuses
  | "ceremonial" // the lever moves under another's command
  | "tunnel" // stage transition through a tunnel
  | "appointment"; // a new office

export interface Cue {
  id: string;
  kind: CueKind;
  /** Decision ordinal at which it fires. */
  ordinal: number;
  data?: Record<string, string | number | boolean>;
}

export type ScenePhase = "title" | "decision" | "consequence" | "ending";

export interface StageView {
  phase: ScenePhase;
  seed: string;
  stage: number;
  ordinal: number;
  decisionId: string | null;
  nodeId: string | null;
  staging: SideStaging | null;
  routeLabels: { left: string; right: string };
  rail?: { loopSide?: "left" | "right"; brakeOnLoop?: boolean; mechanism?: string };
  env: EnvironmentTarget;
  cabin: CabinState;
  cues: Cue[];
  /** Ending family id when phase === "ending". */
  ending?: string;
}

export interface RendererSettings {
  reducedMotion: boolean;
  reducedGraphics: boolean;
  audio: boolean;
  /** No flashes, negatives or strobing (lightning, logo flash). */
  noFlashing: boolean;
  quality: "low" | "medium" | "high";
}

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneAnchors {
  left: ScreenPoint;
  right: ScreenPoint;
  lever: ScreenRect;
  mirror: ScreenRect;
  dash: ScreenRect;
}

export type LeverInput = { type: "grab" | "drag" | "release" | "cancel"; value: number };
export type Executor = "human" | "assistant" | "institution";
export interface RailOutcome {
  stoppedBy: string | null;
}

export interface WorldRenderer {
  readonly kind: "ink" | "fallback";
  update(view: StageView): void;
  commit(side: "left" | "right", executor: Executor, outcome?: RailOutcome): Promise<void>;
  /** Lever position -1 (left) .. 1 (right); `armed` shows the soft selection cloud. */
  setLever(value: number, options?: { armed?: "left" | "right" | null; immediate?: boolean }): void;
  pause(paused: boolean): void;
  settings(patch: Partial<RendererSettings>): void;
  describe(): string;
  onAnchors(cb: (anchors: SceneAnchors) => void): void;
  onLever(cb: (input: LeverInput) => void): void;
  /** Allow pointer interaction with the 3D lever. */
  setInteractive(enabled: boolean): void;
  /**
   * Resolves once nothing scripted stands between the cab and the next fork
   * (the cab has left a stage tunnel). Renderers without tunnels resolve at once.
   */
  whenClear?(): Promise<void>;
  /** Abandon a drag of the in-world lever in progress; its release then commits nothing. */
  cancelLever?(): void;
  destroy(): void;
}
