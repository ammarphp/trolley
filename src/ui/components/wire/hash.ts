/**
 * Cosmetic, deterministic seeds. Every "random" look in the wire (a minute
 * past the hour, which bot loses its face first, how many copies a flood
 * claims) comes from an item's id, never from Math.random, so a replayed run
 * renders byte-identically.
 */

/** FNV-1a 32-bit. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Final avalanche so neighbouring ids do not produce neighbouring values.
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A stable unit value in [0, 1) for (id, salt). */
export function unit(id: string, salt = ""): number {
  return hash32(`${salt}\u0000${id}`) / 4294967296;
}

/** A stable integer in [0, n). */
export function pick(id: string, n: number, salt = ""): number {
  return n <= 0 ? 0 : Math.floor(unit(id, salt) * n);
}

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
