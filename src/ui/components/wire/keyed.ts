/**
 * Keyed reconciliation, host-agnostic so the logic is testable without a DOM.
 *
 * Existing nodes are never recreated: a kept key keeps its node (and with it
 * focus, hover, read state, running animations and the reader's scroll
 * anchor). Only nodes whose position actually changes are re-inserted.
 */
export interface KeyedHost<N> {
  /** Current keyed children, in order. */
  nodes(): readonly N[];
  insertBefore(node: N, ref: N | null): void;
  remove(node: N): void;
}

export interface ReconcileResult {
  added: string[];
  removed: string[];
  kept: string[];
  /** Kept keys whose node had to be re-inserted to reach its new position. */
  moved: string[];
}

export function reconcileKeyed<N, T>(
  host: KeyedHost<N>,
  entries: readonly T[],
  keyOf: (entry: T) => string,
  nodes: Map<string, N>,
  create: (entry: T) => N,
  update: (node: N, entry: T) => void,
): ReconcileResult {
  const result: ReconcileResult = {
    added: [],
    removed: [],
    kept: [],
    moved: [],
  };
  const wanted = new Set<string>();
  for (const entry of entries) wanted.add(keyOf(entry));

  for (const [key, node] of [...nodes]) {
    if (wanted.has(key)) continue;
    host.remove(node);
    nodes.delete(key);
    result.removed.push(key);
  }

  const current = [...host.nodes()];
  const placed = new Set<string>();
  let index = 0;
  for (const entry of entries) {
    const key = keyOf(entry);
    if (placed.has(key)) continue; // duplicate key in input: first one wins
    placed.add(key);
    let node = nodes.get(key);
    if (node === undefined) {
      node = create(entry);
      nodes.set(key, node);
      result.added.push(key);
    } else {
      update(node, entry);
      result.kept.push(key);
    }
    if (current[index] !== node) {
      const existing = current.indexOf(node);
      if (existing >= 0) {
        current.splice(existing, 1);
        result.moved.push(key);
      }
      host.insertBefore(node, current[index] ?? null);
      current.splice(index, 0, node);
    }
    index++;
  }
  return result;
}
