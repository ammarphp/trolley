/**
 * Harmonic material for the score. Everything is centred on D so the nine
 * palettes can cross-fade without key changes: D major pentatonic in the
 * fields, B minor in the academy, D dorian/mixolydian when Morrow arrives,
 * D aeolian for momentum, D phrygian over a pedal for dread, chromatic
 * clusters around D for the abyss, then just-intoned D major for perfection.
 *
 * One short lullaby theme threads through every stage. It is played whole in
 * the fields, recalled by a reed in the academy, broken apart in the ruin and
 * repeated flawlessly, forever, in perfection.
 */
import type { PaletteId } from "./mood.ts";

export interface Chord {
  name: string;
  /** Bass note (MIDI). */
  bass: number;
  /** Mid-register voicing (MIDI). */
  tones: number[];
}

export interface PaletteMusic {
  bpm: (speed: number, tension: number) => number;
  barsPerChord: number;
  progressions: Chord[][];
  /** Scale as semitones above D. */
  scale: number[];
  /** Chance that a phrase is left silent (the rail alone). */
  rest: number;
}

const c = (name: string, bass: number, ...tones: number[]): Chord => ({ name, bass, tones });

export const D = 62; // D4

export const PENTA = [0, 2, 4, 7, 9];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

// Pastoral: D major, open voicings with added ninths.
const P_I = c("Dadd9", 38, 57, 62, 64, 66, 69);
const P_IV = c("G6/9", 43, 59, 62, 64, 67, 69);
const P_vi = c("Bm11", 47, 57, 62, 64, 66, 71);
const P_V = c("Asus2", 45, 57, 59, 64, 69);
const P_ii = c("Em7", 40, 59, 62, 64, 67);

// Academy: B minor chamber colours.
const A_i = c("Bm(add9)", 47, 54, 59, 61, 62);
const A_VI = c("Gmaj7", 43, 54, 59, 62, 66);
const A_iv = c("Em9", 40, 54, 55, 59, 62);
const A_v = c("F#m7", 42, 52, 57, 61, 64);
const A_III = c("D/F#", 42, 50, 57, 62, 64);

// Institution: D dorian / mixolydian, suspended and modal.
const I_sus = c("Dsus4", 38, 50, 55, 57, 62);
const I_bVII = c("C/D", 38, 48, 52, 55, 60);
const I_i9 = c("Dm9", 38, 53, 57, 60, 64);
const I_v = c("Am7", 45, 52, 55, 60, 64);
const I_IV = c("G/D", 43, 50, 55, 59, 62);

// Momentum: D aeolian.
const M_i = c("Dm", 38, 50, 57, 62, 65);
const M_VI = c("Bbmaj7", 46, 50, 53, 57, 62);
const M_VII = c("C", 48, 52, 55, 60, 64);
const M_iv = c("Gm/Bb", 46, 50, 55, 58, 62);
const M_v = c("Am", 45, 52, 57, 60, 64);

// Dread: over a D pedal, low and close.
const R_i = c("Dm", 38, 50, 53, 57);
const R_VI = c("Bb/D", 38, 50, 53, 58);
const R_iv = c("Gm/D", 38, 50, 55, 58);
const R_V = c("A7b9/D", 38, 49, 52, 55, 58);
const R_II = c("Eb/D", 38, 51, 55, 58);

// Abyss: clusters.
const X_1 = c("cluster D-Eb-F-Ab", 26, 50, 51, 53, 56);
const X_2 = c("cluster C#-D-E-G", 26, 49, 50, 52, 55);
const X_3 = c("cluster Bb-B-D-Eb", 27, 46, 47, 50, 51);
const X_4 = c("cluster C-D-Eb-F#", 26, 48, 50, 51, 54);

// Perfection: tonic, subdominant, dominant, tonic. Nothing else, ever.
const F_I = c("D", 38, 50, 54, 57, 62);
const F_IV = c("G", 43, 55, 59, 62, 67);
const F_V = c("A", 45, 57, 61, 64, 69);

// Dawn: the pastoral chords again, lower, with the minor still in them.
const W_vi = c("Bm(add9)", 35, 50, 54, 59, 61);
const W_IV = c("G(add9)", 43, 50, 55, 57, 59);
const W_I = c("D/F#", 42, 50, 54, 57, 64);
const W_V = c("Asus2", 45, 52, 57, 59, 64);

// Ruin: a bare fifth that barely holds.
const U_1 = c("D5", 26, 50, 57);
const U_2 = c("D5/C", 24, 50, 57);

export const MUSIC: Record<PaletteId, PaletteMusic> = {
  pastoral: {
    bpm: () => 64,
    barsPerChord: 2,
    progressions: [
      [P_I, P_IV, P_vi, P_IV],
      [P_I, P_vi, P_IV, P_V],
      [P_IV, P_I, P_ii, P_V],
    ],
    scale: PENTA,
    rest: 0.1,
  },
  academy: {
    bpm: () => 58,
    barsPerChord: 2,
    progressions: [
      [A_i, A_VI, A_iv, A_v],
      [A_i, A_iv, A_VI, A_III],
      [A_VI, A_III, A_iv, A_i],
    ],
    scale: MAJOR,
    rest: 0.18,
  },
  institution: {
    bpm: (_s, t) => 68 + t * 4,
    barsPerChord: 2,
    progressions: [
      [I_sus, I_bVII, I_i9, I_IV],
      [I_i9, I_v, I_bVII, I_sus],
      [I_bVII, I_i9, I_IV, I_v],
    ],
    scale: DORIAN,
    rest: 0.12,
  },
  momentum: {
    bpm: (s, t) => 70 + s * 14 + t * 4,
    barsPerChord: 2,
    progressions: [
      [M_i, M_VI, M_VII, M_v],
      [M_i, M_VII, M_VI, M_VII],
      [M_i, M_iv, M_VI, M_VII],
    ],
    scale: AEOLIAN,
    rest: 0.08,
  },
  dread: {
    bpm: () => 54,
    barsPerChord: 2,
    progressions: [
      [R_i, R_VI, R_iv, R_i],
      [R_i, R_iv, R_V, R_i],
      [R_i, R_II, R_i, R_V],
    ],
    scale: PHRYGIAN,
    rest: 0.22,
  },
  abyss: {
    bpm: () => 46,
    barsPerChord: 2,
    progressions: [
      [X_1, X_2, X_3, X_1],
      [X_2, X_4, X_1, X_3],
    ],
    scale: PHRYGIAN,
    rest: 0.34,
  },
  perfection: {
    bpm: () => 60,
    barsPerChord: 2,
    progressions: [[F_I, F_IV, F_V, F_I]],
    scale: MAJOR,
    rest: 0,
  },
  ruin: {
    bpm: () => 50,
    barsPerChord: 4,
    progressions: [
      [U_1, U_2],
      [U_1, U_1],
    ],
    scale: PENTA,
    rest: 0.25,
  },
  dawn: {
    bpm: () => 56,
    barsPerChord: 2,
    progressions: [
      [W_vi, W_IV, W_I, W_V],
      [W_IV, W_I, W_vi, W_V],
    ],
    scale: MAJOR,
    rest: 0.12,
  },
};

/** The lullaby, in pentatonic degrees (0 = D, 5 = D an octave up), in beats. */
export const THEME: ReadonlyArray<{ deg: number | null; beats: number }> = [
  { deg: 3, beats: 1.5 },
  { deg: 2, beats: 0.5 },
  { deg: 1, beats: 1 },
  { deg: 0, beats: 1 },
  { deg: 1, beats: 0.5 },
  { deg: 2, beats: 0.5 },
  { deg: 3, beats: 2 },
  { deg: null, beats: 1 },
  { deg: 4, beats: 1 },
  { deg: 3, beats: 1 },
  { deg: 2, beats: 1.5 },
  { deg: 1, beats: 0.5 },
  { deg: 0, beats: 3 },
  { deg: null, beats: 1 },
];

/** Pentatonic degree → diatonic degree, so the theme can be sung in any mode. */
const PENTA_TO_DIATONIC = [0, 1, 2, 4, 5];

/** MIDI note for a theme degree in a given scale, starting at `root`. */
export function themeNote(deg: number, scale: number[], root: number): number {
  const oct = Math.floor(deg / 5);
  const i = ((deg % 5) + 5) % 5;
  if (scale.length === 5) return root + oct * 12 + scale[i]!;
  const d = PENTA_TO_DIATONIC[i]!;
  return root + oct * 12 + scale[d % scale.length]!;
}

/** Nearest scale note at or above `midi`, stepping `steps` scale degrees. */
export function scaleStep(midi: number, steps: number, scale: number[], tonic = D): number {
  const pcs = scale.map((s) => ((s % 12) + 12) % 12);
  const rel = midi - tonic;
  const oct = Math.floor(rel / 12);
  const pc = ((rel % 12) + 12) % 12;
  let idx = pcs.findIndex((p) => p >= pc);
  let o = oct;
  if (idx < 0) {
    idx = 0;
    o++;
  }
  let k = idx + steps;
  o += Math.floor(k / pcs.length);
  k = ((k % pcs.length) + pcs.length) % pcs.length;
  return tonic + o * 12 + pcs[k]!;
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Just-intonation frequency for a MIDI note relative to D (perfection's tuning). */
export function justFreq(midi: number): number {
  const ratios = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];
  const rel = midi - 50; // D3
  const oct = Math.floor(rel / 12);
  const pc = ((rel % 12) + 12) % 12;
  return mtof(50) * Math.pow(2, oct) * ratios[pc]!;
}
