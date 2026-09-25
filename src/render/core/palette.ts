/**
 * The ink palette. Every world pixel is paper, ink, or one of a handful of
 * accent pigments. The composite pass owns the final colours; materials only
 * write coverage and an accent index, so a single place governs the look.
 */
export const PAPER = [1.0, 1.0, 1.0] as const;
export const INK = [0.066, 0.07, 0.078] as const;

/** Accent pigment slots. Index 0 means "no accent". Keep this list short. */
export const ACCENT = {
  none: 0,
  /** Blood, wounds, the one colour the game refuses to soften. */
  blood: 1,
  /** Signal red: danger lamps, the jam, the brand dot. */
  signal: 2,
  /** Sodium amber: work lights, hazard vests, warning beacons. */
  amber: 3,
  /** Morrow's cobalt: the assistant's light, its screens and logo. */
  cobalt: 4,
  /** Chlorophyll: rare living green used only on recovery routes. */
  leaf: 5,
  /** Fire and embers. */
  ember: 6,
  /** Cold server-room cyan used for data-centre status lamps. */
  cyan: 7,
} as const;
export type AccentName = keyof typeof ACCENT;

/** Linear-ish sRGB triples, indexed by ACCENT value. Slot 0 is unused. */
export const ACCENT_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [0.62, 0.05, 0.07],
  [0.86, 0.16, 0.13],
  [0.93, 0.62, 0.18],
  [0.16, 0.3, 0.92],
  [0.3, 0.55, 0.28],
  [0.95, 0.42, 0.12],
  [0.18, 0.72, 0.78],
];

/**
 * Albedo tones (0 = white paper, 1 = solid ink). Materials choose from these
 * named steps rather than inventing arbitrary greys so assets stay coherent.
 */
export const TONE = {
  paper: 0.0,
  pale: 0.12,
  light: 0.26,
  mid: 0.42,
  dark: 0.62,
  deep: 0.8,
  solid: 1.0,
} as const;
export type ToneName = keyof typeof TONE;

/** Hatch spacing in world units at reference scale (metres). */
export const HATCH = {
  world: 0.16,
  cabin: 0.022,
  actor: 0.035,
} as const;
