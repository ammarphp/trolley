/**
 * Condition: the environment channels a civic structure cares about, reduced
 * to a few decisions (how ruined, how sealed, how abandoned, how many windows
 * are lit). Builders never read EnvironmentTarget directly.
 *
 * Ruin and order are exclusive: whichever is stronger wins, so a building is
 * either decaying or perfected, never both.
 */
import type { EnvironmentTarget } from "../../api.ts";

export interface Condition {
  /** 0..1 structural damage (after order has been resolved). */
  ruin: number;
  /** 0..1 fire damage and embers; only meaningful with ruin. */
  fire: number;
  /** 0..1 synthetic order (max of perfection and uniformity). */
  order: number;
  /** Windows blanked, doors sealed, chimneys removed. */
  sealed: boolean;
  /** Seed ignored: every copy is identical. */
  identical: boolean;
  /** 0..1 abandonment: boarded windows and doors. */
  abandoned: number;
  /** 0..1 fraction of intact windows lit amber. */
  lit: number;
  /** 0..1 darkness (night, pre-dawn or gloom). */
  night: number;
  vegetation: number;
  leaves: number;
  bloom: number;
  drought: number;
  wind: number;
  habitation: number;
  people: number;
  surveillance: number;
}

const DEFAULTS: EnvironmentTarget = {
  vegetation: 0.75,
  leaves: 0.85,
  bloom: 0.25,
  fauna: 0.5,
  birds: 0.4,
  habitation: 0.75,
  people: 0.6,
  industry: 0.2,
  compute: 0,
  surveillance: 0,
  perfection: 0,
  ruin: 0,
  fire: 0,
  drought: 0,
  cloud: 0.3,
  storm: 0,
  lightning: 0,
  fog: 0,
  wind: 0.3,
  timeOfDay: 0.4,
  gloom: 0,
  speed: 0.5,
  water: 0.4,
  uniformity: 0,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function conditionFrom(env?: Partial<EnvironmentTarget>): Condition {
  const e: EnvironmentTarget = { ...DEFAULTS, ...(env ?? {}) };
  const order = clamp01(Math.max(e.perfection, e.uniformity));
  const rawRuin = clamp01(e.ruin);
  const orderWins = order > rawRuin;
  const ruin = orderWins ? 0 : rawRuin;
  const sealed = orderWins && order > 0.55;
  const identical = orderWins && order > 0.4;
  const abandoned = sealed ? 0 : smooth(0.4, 0.12, clamp01(e.habitation));
  const tod = clamp01(e.timeOfDay);
  const dark = Math.max(smooth(0.66, 0.84, tod), 1 - smooth(0.06, 0.2, tod));
  const night = clamp01(Math.max(dark, e.gloom * 0.9, e.storm * 0.5));
  const lit = sealed ? 0 : clamp01(night * (0.2 + 0.55 * clamp01(e.habitation)) * (1 - abandoned) * (1 - smooth(0.2, 0.55, ruin)));
  return {
    ruin,
    fire: clamp01(e.fire),
    order,
    sealed,
    identical,
    abandoned,
    lit,
    night,
    vegetation: clamp01(e.vegetation),
    leaves: clamp01(e.leaves),
    bloom: clamp01(e.bloom),
    drought: clamp01(e.drought),
    wind: clamp01(e.wind),
    habitation: clamp01(e.habitation),
    people: clamp01(e.people),
    surveillance: clamp01(e.surveillance),
  };
}

/** Ruin tiers used consistently by walls, roofs and openings. */
export const RUIN = {
  /** Below: intact. */
  scuffed: 0.15,
  /** Roof holes, broken glass. */
  damaged: 0.2,
  /** Roof mostly gone, gables collapse. */
  gutted: 0.5,
  /** Walls breached, no roof. */
  shell: 0.75,
} as const;

export { clamp01, smooth };
