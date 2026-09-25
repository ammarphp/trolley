/**
 * Cosmetic randomness. The simulation owns its own keyed RNG; nothing in the
 * renderer may draw from it. These generators are seeded from strings so the
 * same run always paints the same world, but they never influence outcomes.
 */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** Approximately normal, mean 0, sd 1. */
  gauss(): number;
  /** Derive an independent child stream. */
  fork(label: string): Rng;
  readonly seed: number;
}

export function createRng(seed: number | string): Rng {
  const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  let a = s ^ 0x9e3779b9,
    b = s ^ 0x243f6a88,
    c = s ^ 0xb7e15162,
    d = s ^ 0x85a308d3;
  const next = () => {
    // sfc32
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const rng: Rng = {
    seed: s,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    chance: (p) => next() < p,
    gauss: () => {
      let u = 0,
        v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork: (label) => createRng(hashString(`${s}:${label}`)),
  };
  return rng;
}
