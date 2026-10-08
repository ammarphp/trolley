/**
 * The journey: one decision cycle, choreographed in space.
 *
 *   cruise   - rolling along the current line; the pen draws the line ahead.
 *   approach - a fork has been inked at the frontier; the trolley eases toward
 *              a hold point just short of the toe and never reaches it (speed
 *              decays exponentially), so reading time is unlimited yet the
 *              world never stops.
 *   passage  - after commit, the points are thrown and the trolley takes the
 *              executed branch, meeting whatever is on it.
 *   stopped  - a brake or obstruction halted it; it waits for the next cycle.
 *
 * Three clocks stay separate: this cosmetic travel, the decision sequence
 * (owned by the app), and fictional days (owned by the simulation).
 */
import { TrackNetwork, Rig, type Junction, type Side } from "./track/network.ts";

export type JourneyPhase = "cruise" | "approach" | "passage" | "stopped";

export interface JourneyEvents {
  onJunction?(j: Junction): void;
  onPointsThrown?(side: Side): void;
  /** The cab reached a stake placed at `s` metres along a branch. */
  onContact?(side: Side, s: number, index: number): void;
  onPassageComplete?(): void;
}

export interface Stake {
  side: Side;
  /** Arc length along the branch, from the toe. */
  s: number;
  /** Does the trolley physically strike it (vs. pass beside it)? */
  struck: boolean;
  /** Halts the trolley `buffer` metres before it. */
  stops?: boolean;
}

export const FRONTIER = 185; // metres of line the pen keeps drawn ahead while cruising
export const HOLD_BEFORE_TOE = 6; // where the approach eases to
export const DRAW_SPEED = 180; // metres per second a new branch inks outward
export const BRANCH_DRAW = 520;
export const STOP_BUFFER = 3.2; // cab front to obstruction when braked
export const PASSAGE_END = 38; // metres past the toe when a passage is complete

export class Journey {
  readonly network: TrackNetwork;
  readonly rig: Rig;
  phase: JourneyPhase = "cruise";
  /** Cruise speed in m/s (eased toward target). */
  cruise = 11;
  /** Where the current passage ends on the taken branch. */
  private passageEnd = PASSAGE_END;
  cruiseTarget = 11;
  reducedMotion = false;
  private stakes: Stake[] = [];
  private contacted = new Set<number>();
  private passageResolve: (() => void) | null = null;
  private passagePromise: Promise<void> | null = null;
  private stopAt: number | null = null;
  private holdTimer = 0;
  private events: JourneyEvents;
  private clock = 0;
  pointsValue = 0;
  private pointsTarget = 0;

  constructor(seed: string, events: JourneyEvents = {}) {
    this.network = new TrackNetwork(seed);
    this.rig = new Rig(this.network.current, 0);
    this.events = events;
    this.network.current.drawTo = FRONTIER;
  }

  get junction(): Junction | null {
    return this.network.junction;
  }

  /** Metres from the rig to the toe of the pending fork (Infinity if none). */
  get toToe(): number {
    const j = this.network.junction;
    if (!j || j.chosen || this.rig.line !== j.stem) return Infinity;
    return j.toe - this.rig.s;
  }

  /**
   * Ink a fork ahead for a new decision. Returns the junction. If a fork for
   * this key already exists, it is reused (update() is idempotent).
   */
  prepare(key: string, stakes: Stake[], options: { loop?: Side | null; minToe?: number | undefined } = {}): Junction {
    const existing = this.network.junction;
    if (existing && existing.key === key) {
      this.stakes = stakes;
      return existing;
    }
    // Place the toe at the drawn frontier, never closer than a readable approach.
    const line = this.network.current;
    const minLead = this.reducedMotion ? 30 : 120;
    const toe = Math.max(this.rig.s + minLead, Math.min(line.drawTo, this.rig.s + FRONTIER), options.minToe ?? 0);
    const j = this.network.createJunction(toe, key, { loop: options.loop ?? null });
    j.createdAt = this.clock;
    if (this.reducedMotion) {
      j.left.drawTo = BRANCH_DRAW;
      j.right.drawTo = BRANCH_DRAW;
      line.drawTo = toe;
      // No optic flow: cut straight to the hold point.
      this.rig.line = line;
      this.rig.s = toe - HOLD_BEFORE_TOE;
      line.pose(this.rig.s, this.rig.pose);
    }
    this.stakes = stakes;
    this.contacted.clear();
    this.stopAt = null;
    this.phase = "approach";
    this.pointsValue = 0;
    this.pointsTarget = 0;
    this.events.onJunction?.(j);
    return j;
  }

  /** Less motion switched on mid-approach: make the same cut prepare() makes. */
  cutToHold(): void {
    const j = this.network.junction;
    if (!j || j.chosen || this.phase !== "approach") return;
    j.left.drawTo = Math.max(j.left.drawTo, BRANCH_DRAW);
    j.right.drawTo = Math.max(j.right.drawTo, BRANCH_DRAW);
    j.stem.drawTo = j.toe;
    this.rig.line = j.stem;
    this.rig.s = Math.max(this.rig.s, j.toe - HOLD_BEFORE_TOE);
    this.rig.speed = 0;
    j.stem.pose(this.rig.s, this.rig.pose);
  }

  /** Preview the points (lever position before commitment), -1..1. */
  previewPoints(value: number): void {
    if (this.phase === "approach") this.pointsTarget = value;
  }

  commit(side: Side, stoppedBy: { s: number } | null): Promise<void> {
    if (this.passagePromise) return this.passagePromise;
    const j = this.network.junction;
    if (!j || this.phase !== "approach") return Promise.resolve();
    this.network.choose(side);
    this.pointsTarget = side === "left" ? -1 : 1;
    this.events.onPointsThrown?.(side);
    this.stopAt = stoppedBy ? Math.max(2, stoppedBy.s - STOP_BUFFER) : null;
    // The passage runs on past the last stake on the taken branch, however long the line of them.
    this.passageEnd = this.stakes.reduce((end, st) => (st.side === side ? Math.max(end, st.s + 4) : end), PASSAGE_END);
    this.phase = "passage";
    this.holdTimer = 0;
    const promise = new Promise<void>((resolve) => (this.passageResolve = resolve));
    this.passagePromise = promise;
    if (this.reducedMotion) {
      // A cut rather than a ride: land past the stakes (or at the stop) at once.
      const branch = side === "left" ? j.left : j.right;
      this.rig.line = branch;
      this.rig.s = this.stopAt ?? this.passageEnd;
      branch.pose(this.rig.s, this.rig.pose);
      this.fireContacts(side, this.rig.s);
      this.finishPassage();
    }
    return promise;
  }

  private finishPassage(): void {
    this.phase = this.stopAt !== null ? "stopped" : "cruise";
    const resolve = this.passageResolve;
    this.passageResolve = null;
    this.passagePromise = null;
    const j = this.network.junction;
    if (j) {
      const taken = j.chosen === "left" ? j.left : j.right;
      taken.drawLimit = Infinity;
      this.network.current = taken;
    }
    this.events.onPassageComplete?.();
    resolve?.();
  }

  private fireContacts(side: Side, sOnBranch: number): void {
    this.stakes.forEach((stake, index) => {
      if (stake.side !== side || this.contacted.has(index)) return;
      if (sOnBranch + 2.4 >= stake.s) {
        this.contacted.add(index);
        if (stake.struck) this.events.onContact?.(side, stake.s, index);
      }
    });
  }

  /** Bring the trolley to a stand (the ending). Any pending fork is abandoned. */
  halt(): void {
    this.settle();
    this.phase = "stopped";
  }

  /** Force any in-flight passage to settle (pause-safe, destroy-safe). */
  settle(): void {
    if (this.phase === "passage" && this.passageResolve) {
      const j = this.network.junction;
      if (j?.chosen) {
        const branch = j.chosen === "left" ? j.left : j.right;
        if (this.rig.line !== branch) {
          this.rig.line = branch;
          this.rig.s = 0;
        }
        this.rig.s = Math.max(this.rig.s, this.stopAt ?? this.passageEnd);
        branch.pose(this.rig.s, this.rig.pose);
        this.fireContacts(j.chosen, this.rig.s);
      }
      this.finishPassage();
    }
  }

  tick(dt: number): void {
    this.clock += dt;
    this.cruise += (this.cruiseTarget - this.cruise) * Math.min(1, dt * 0.25);
    const j = this.network.junction;
    // Ink new branches outward.
    if (j) {
      for (const b of [j.left, j.right]) {
        if (b.drawTo < BRANCH_DRAW && !b.abandoned) b.drawTo = Math.min(BRANCH_DRAW, b.drawTo + DRAW_SPEED * dt);
        if (b.abandoned && b.drawTo < 60) b.drawTo = Math.min(BRANCH_DRAW, b.drawTo + DRAW_SPEED * dt);
      }
    }
    this.pointsValue += (this.pointsTarget - this.pointsValue) * Math.min(1, dt * 9);

    let target = this.cruise;
    if (this.phase === "approach") {
      const gap = this.toToe - HOLD_BEFORE_TOE;
      // Exponential approach: brisk from afar, a crawl near the hold point.
      target = gap <= 0 ? 0 : Math.min(this.cruise * 2.2, Math.sqrt(2 * 3.4 * gap), Math.max(0.04, gap * 0.42));
      if (this.reducedMotion) target = 0;
    } else if (this.phase === "passage") {
      const j0 = this.network.junction;
      const gapToToe = j0 && this.rig.line === j0.stem ? j0.toe - this.rig.s : 0;
      target = Math.min(this.cruise * 2.5, Math.max(8, this.cruise, gapToToe / 3));
      if (this.stopAt !== null && j?.chosen) {
        const branchS = this.rig.line === j.stem ? this.rig.s - j.toe : this.rig.s;
        const remaining = this.stopAt - branchS;
        // Brake hard but smoothly; never overshoot the stop.
        target = Math.min(target, Math.max(0, Math.sqrt(Math.max(0, remaining) * 2 * 3.2)));
      }
    } else if (this.phase === "stopped") {
      target = 0;
    }
    if (this.reducedMotion && this.phase !== "passage") target = this.phase === "cruise" ? 0 : target;
    const accel = target > this.rig.speed ? (this.phase === "passage" ? 4.2 : 2.6) : 4.5;
    this.rig.speed += Math.sign(target - this.rig.speed) * Math.min(Math.abs(target - this.rig.speed), accel * dt);
    const before = this.rig.line;
    this.rig.advance(this.rig.speed * dt, this.network);

    // Keep the pen ahead of the cab on the current line. A stem is drawn up
    // to its toe (its draw limit) even while the fork waits: a tunnel or a
    // crossing can set the toe beyond the frontier at the moment it is laid.
    const line = this.rig.line;
    if (!line.abandoned) {
      const want = Math.min(line.drawLimit, this.rig.s + FRONTIER);
      if (line.drawTo < want) line.drawTo = Math.min(want, line.drawTo + Math.max(this.rig.speed, 30) * dt + 0.5);
    }

    if (this.phase === "passage" && j?.chosen) {
      const onBranch = this.rig.line !== j.stem || before !== j.stem;
      const branchS = this.rig.line === j.stem ? this.rig.s - j.toe : this.rig.s;
      if (onBranch || branchS >= 0) this.fireContacts(j.chosen, branchS);
      if (this.stopAt !== null) {
        if (branchS >= this.stopAt - 0.05 || this.rig.speed < 0.02) {
          this.holdTimer += dt;
          if (this.holdTimer > 0.9) this.finishPassage();
        }
      } else if (branchS >= this.passageEnd) {
        this.finishPassage();
      }
    }
  }
}
