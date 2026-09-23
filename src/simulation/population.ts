/** Integer interval accounting: no operation loops over the world population. */
export interface PopulationRange {
  cohortId: string;
  start: number;
  count: number;
}
export interface PopulationCatalog {
  cohorts: { id: string; size: number }[];
  people: { id: string; name: string; cohortId: string; member: number }[];
}
export interface PopulationLedger {
  cohorts: Record<string, { size: number; dead: [number, number][] }>;
  allocations: Record<
    string,
    { ranges: PopulationRange[]; count: number; causeId: string }
  >;
}
function integer(n: number) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("Invalid population integer");
}
export function normalize(intervals: [number, number][]): [number, number][] {
  const sorted = intervals
    .map(([a, b]) => {
      integer(a);
      integer(b);
      if (b < a) throw new Error("Inverted population interval");
      return [a, b] as [number, number];
    })
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const tail = out.at(-1);
    if (tail && a <= tail[1]) tail[1] = Math.max(tail[1], b);
    else out.push([a, b]);
  }
  if (out.length > 2048) throw new Error("Population interval budget exceeded");
  return out;
}
const length = (ranges: [number, number][]) =>
  ranges.reduce((sum, [a, b]) => sum + b - a, 0);
export function makePopulation(
  catalog: PopulationCatalog,
  population: number,
): PopulationLedger {
  const ledger: PopulationLedger = { cohorts: {}, allocations: {} };
  let total = 0;
  for (const c of catalog.cohorts) {
    integer(c.size);
    if (!c.size || c.id in ledger.cohorts)
      throw new Error("Duplicate, reserved or empty cohort");
    ledger.cohorts[c.id] = { size: c.size, dead: [] };
    total += c.size;
    integer(total);
  }
  if (total !== population)
    throw new Error("Population catalog does not conserve initial population");
  const ids = new Set<string>(),
    aliases = new Set<string>();
  for (const p of catalog.people) {
    integer(p.member);
    const c = ledger.cohorts[p.cohortId];
    const alias = `${p.cohortId}:${p.member}`;
    if (
      !Object.hasOwn(ledger.cohorts, p.cohortId) ||
      !c ||
      p.member >= c.size ||
      ids.has(p.id) ||
      aliases.has(alias)
    )
      throw new Error("Invalid or duplicate person alias");
    ids.add(p.id);
    aliases.add(alias);
  }
  return ledger;
}
export function living(ledger: PopulationLedger, cohortId?: string): number {
  if (cohortId !== undefined && !Object.hasOwn(ledger.cohorts, cohortId))
    throw new Error("Unknown population cohort");
  const list = cohortId
    ? [ledger.cohorts[cohortId]]
    : Object.values(ledger.cohorts);
  if (list.some((c) => !c)) throw new Error("Unknown population cohort");
  return list.reduce((sum, c) => sum + c.size - length(c.dead), 0);
}
export function isAlive(
  ledger: PopulationLedger,
  cohortId: string,
  member: number,
): boolean {
  const c = ledger.cohorts[cohortId];
  integer(member);
  if (!Object.hasOwn(ledger.cohorts, cohortId) || !c || member >= c.size)
    throw new Error("Unknown person");
  return !c.dead.some(([a, b]) => member >= a && member < b);
}
export function canonicalRanges(
  ledger: PopulationLedger,
  ranges: PopulationRange[],
): PopulationRange[] {
  const groups: Record<string, [number, number][]> = {};
  for (const r of ranges) {
    integer(r.start);
    integer(r.count);
    const c = ledger.cohorts[r.cohortId];
    if (
      !Object.hasOwn(ledger.cohorts, r.cohortId) ||
      !c ||
      r.start + r.count > c.size
    )
      throw new Error("Loss exceeds cohort");
    (groups[r.cohortId] ??= []).push([r.start, r.start + r.count]);
  }
  return Object.keys(groups)
    .sort()
    .flatMap((cohortId) =>
      normalize(groups[cohortId]).map(([start, end]) => ({
        cohortId,
        start,
        count: end - start,
      })),
    );
}
export function anonymousRanges(
  ledger: PopulationLedger,
  count: number,
): PopulationRange[] {
  integer(count);
  let left = Math.min(count, living(ledger));
  const result: PopulationRange[] = [];
  for (const id of Object.keys(ledger.cohorts).sort()) {
    const c = ledger.cohorts[id];
    let start = 0;
    for (const [a, b] of [...c.dead, [c.size, c.size] as [number, number]]) {
      const take = Math.min(left, a - start);
      if (take > 0) {
        result.push({ cohortId: id, start, count: take });
        left -= take;
      }
      start = b;
      if (!left) return result;
    }
  }
  return result;
}
export function applyLoss(
  ledger: PopulationLedger,
  id: string,
  ranges: PopulationRange[],
  causeId: string,
): { count: number; duplicate: boolean } {
  if (id in Object.prototype)
    throw new Error("Reserved population allocation ID");
  const normalized = canonicalRanges(ledger, ranges);
  const prior = ledger.allocations[id];
  if (prior) {
    if (JSON.stringify(prior.ranges) !== JSON.stringify(normalized))
      throw new Error("Conflicting population allocation");
    return { count: 0, duplicate: true };
  }
  const before = living(ledger);
  for (const range of normalized) {
    const c = ledger.cohorts[range.cohortId];
    c.dead = normalize([...c.dead, [range.start, range.start + range.count]]);
  }
  const count = before - living(ledger);
  ledger.allocations[id] = { ranges: normalized, count, causeId };
  return { count, duplicate: false };
}
