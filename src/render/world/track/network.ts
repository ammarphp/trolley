/**
 * The rail network the trolley travels: a current line, the fork ahead, and
 * the abandoned branches behind. Also answers "how far is this point from any
 * track?" so scenery never grows through the rails.
 */
import { createRng, type Rng } from "../../core/rng.ts";
import { TrackLine, branchProgramme, meander, type TrackPose } from "./path.ts";

export type Side = "left" | "right";

export interface Junction {
  id: number;
  key: string;
  /** Line the trolley arrives on; it ends at the toe. */
  stem: TrackLine;
  /** Arc length of the switch toe on the stem. */
  toe: number;
  left: TrackLine;
  right: TrackLine;
  chosen: Side | null;
  /** Loop geometry for mechanism nodes: the looped branch rejoins the other. */
  loop: Side | null;
  createdAt: number;
}

const CELL = 32;

export class TrackNetwork {
  readonly lines: TrackLine[] = [];
  current: TrackLine;
  junction: Junction | null = null;
  readonly history: Junction[] = [];
  private nextId = 1;
  private rng: Rng;
  private grid = new Map<string, Array<{ line: TrackLine; x: number; z: number }>>();
  private indexed = new Map<number, number>();

  constructor(seed: string, origin: TrackPose = { x: 0, z: 0, heading: 0 }) {
    this.rng = createRng(`${seed}:track`);
    this.current = this.addLine(origin, [{ kind: "straight", length: 260 }], meander(this.rng.fork("main")));
  }

  private addLine(origin: TrackPose, programme: ConstructorParameters<typeof TrackLine>[3], generator: ConstructorParameters<typeof TrackLine>[4]): TrackLine {
    const line = new TrackLine(this.nextId++, origin, this.rng.fork(`line-${this.nextId}`), programme, generator);
    this.lines.push(line);
    return line;
  }

  /**
   * Split the current line at `toe` into a symmetric fork. The stem stops
   * being drawn at the toe; both branches are inked outward from it.
   */
  createJunction(toe: number, key: string, options: { theta?: number; loop?: Side | null } = {}): Junction {
    const stem = this.current;
    stem.extendTo(toe + 1);
    const at = stem.pose(toe);
    const rng = createRng(`${key}:fork`);
    const theta = options.theta ?? rng.range(0.56, 0.64);
    const restless = Math.min(1, this.history.length / 30);
    const left = this.addLine(at, branchProgramme(-1, theta, rng.fork("l")), meander(rng.fork("lm"), restless));
    const right = this.addLine(at, branchProgramme(1, theta, rng.fork("r")), meander(rng.fork("rm"), restless));
    left.drawTo = 0;
    right.drawTo = 0;
    stem.drawLimit = toe;
    const junction: Junction = { id: this.history.length + 1, key, stem, toe, left, right, chosen: null, loop: options.loop ?? null, createdAt: 0 };
    this.junction = junction;
    this.history.push(junction);
    return junction;
  }

  choose(side: Side): void {
    const j = this.junction;
    if (!j || j.chosen) return;
    j.chosen = side;
    const taken = side === "left" ? j.left : j.right;
    const other = side === "left" ? j.right : j.left;
    other.abandoned = true;
    this.current = taken;
  }

  /** Index newly generated samples for proximity queries. */
  index(line: TrackLine): void {
    const from = this.indexed.get(line.id) ?? -1;
    const to = Math.floor(line.length);
    if (to <= from) return;
    for (const [s, x, z] of line.samples(from + 1, to)) {
      if (Math.floor(s) % 2 !== 0) continue;
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      let bucket = this.grid.get(key);
      if (!bucket) this.grid.set(key, (bucket = []));
      bucket.push({ line, x, z });
    }
    this.indexed.set(line.id, to);
  }

  /** Distance from (x, z) to the nearest indexed track sample. */
  distanceToTrack(x: number, z: number, maxRange = 64): number {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const r = Math.ceil(maxRange / CELL);
    let best = maxRange * maxRange;
    for (let i = -r; i <= r; i++)
      for (let k = -r; k <= r; k++) {
        const bucket = this.grid.get(`${cx + i},${cz + k}`);
        if (!bucket) continue;
        for (const p of bucket) {
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < best) best = d;
        }
      }
    return Math.sqrt(best);
  }

  /** Forget far-away abandoned lines and their index entries. */
  prune(x: number, z: number, keepRadius: number): TrackLine[] {
    const dropped: TrackLine[] = [];
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i]!;
      if (line === this.current) continue;
      if (this.junction && (line === this.junction.left || line === this.junction.right || line === this.junction.stem)) continue;
      const end = line.pose(line.drawTo);
      const start = line.origin;
      const far = Math.hypot(end.x - x, end.z - z) > keepRadius && Math.hypot(start.x - x, start.z - z) > keepRadius;
      if (far) {
        dropped.push(line);
        this.lines.splice(i, 1);
        this.indexed.delete(line.id);
      }
    }
    if (dropped.length) {
      const ids = new Set(dropped.map((l) => l.id));
      for (const [key, bucket] of this.grid) {
        const kept = bucket.filter((p) => !ids.has(p.line.id));
        if (kept.length) this.grid.set(key, kept);
        else this.grid.delete(key);
      }
    }
    return dropped;
  }
}

/** The trolley's position on the network. */
export class Rig {
  line: TrackLine;
  s: number;
  speed = 0;
  readonly pose: TrackPose = { x: 0, z: 0, heading: 0 };

  constructor(line: TrackLine, s = 0) {
    this.line = line;
    this.s = s;
    line.pose(s, this.pose);
  }

  /** Advance, crossing onto the chosen branch at a junction toe. */
  advance(ds: number, network: TrackNetwork): void {
    this.s += ds;
    const j = network.junction;
    if (j && this.line === j.stem && this.s >= j.toe) {
      if (j.chosen) {
        this.s -= j.toe;
        this.line = j.chosen === "left" ? j.left : j.right;
      } else {
        // Never cross an undecided fork.
        this.s = j.toe - 0.01;
        this.speed = 0;
      }
    }
    this.line.pose(this.s, this.pose);
  }
}
