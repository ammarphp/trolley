/**
 * Campaign adapter: turns the engine's Campaign into per-decision
 * AmbientInputs and runs the feed with history, so the orchestrator can
 * install it directly:
 *
 *   setAmbientGenerator(ambientGenerator)            // src/ui/ambient-log.ts
 *   botSaturation: botSaturationForCampaign(c)        // instead of botSaturationFor
 *
 * Past decisions are reconstructed from the journal: stage and days from the
 * records, readings from the recorded metrics with any issued report
 * overriding them (what the instruments showed), facts and control by
 * undoing the recorded changes from the current state. Only the visible fact
 * allowlist is ever indexed; hidden facts are neither read nor enumerated.
 */
import type { Campaign, DecisionRecord } from "../../contracts/index.ts";
import { ambientFeed, factoidEntry } from "./ambient.ts";
import { botSaturation } from "./saturation.ts";
import { SCOPES, VISIBLE_FACTS, type AmbientInput, type AmbientMetrics, type EngineNewsLine, type FeedItem, type VisibleFact } from "./types.ts";

const VISIBLE: ReadonlySet<string> = new Set(VISIBLE_FACTS);
const METRIC_KEYS = ["gdp", "capability", "casualties", "population", "care", "food", "power"] as const;

/** Decisions the campaign has reached: committed ones plus the prepared one. */
export function ordinalOf(c: Campaign): number {
  return c.journal.length + (c.prepared ? 1 : 0);
}

function readVisible(source: Readonly<Record<string, boolean | undefined>> | undefined): Record<VisibleFact, boolean> {
  const out = {} as Record<VisibleFact, boolean>;
  for (const k of VISIBLE_FACTS) out[k] = source?.[k] === true;
  return out;
}

function initialMetrics(c: Campaign): AmbientMetrics {
  const w = c.world;
  const out: AmbientMetrics = {
    gdp: w.gdp,
    capability: w.capability,
    casualties: 0,
    population: w.initialPopulation,
    care: w.care,
    food: w.food,
    power: w.power,
  };
  // The first recorded change of each metric carries its starting value.
  const seen = new Set<string>();
  for (const r of c.journal)
    for (const e of r.domainEvents) {
      if (e.kind !== "metric_changed") continue;
      const m = String(e.details.metric);
      if (seen.has(m) || !(METRIC_KEYS as readonly string[]).includes(m)) continue;
      seen.add(m);
      (out as unknown as Record<string, number>)[m] = Number(e.details.previous);
    }
  return out;
}

/** What the instruments showed after record i: recorded metrics, overridden by any report issued so far. */
function observedAfter(c: Campaign, i: number): AmbientMetrics {
  const r = c.journal[i]!;
  const out = { ...r.metrics } as unknown as AmbientMetrics;
  for (let k = 0; k <= i; k++)
    for (const e of c.journal[k]!.domainEvents)
      if (e.kind === "report_issued" && (METRIC_KEYS as readonly string[]).includes(String(e.details.metric)))
        (out as unknown as Record<string, number>)[String(e.details.metric)] = Number(e.details.value);
  return out;
}

/** Visible facts after record i (i = -1: before any decision). */
function factsAfter(c: Campaign, i: number, current: Record<VisibleFact, boolean>): Record<VisibleFact, boolean> {
  const f = { ...current };
  for (let k = c.journal.length - 1; k > i; k--) {
    const events = c.journal[k]!.domainEvents;
    for (let j = events.length - 1; j >= 0; j--) {
      const e = events[j]!;
      if (e.kind !== "fact_changed") continue;
      const name = String(e.details.fact);
      if (!VISIBLE.has(name)) continue;
      f[name as VisibleFact] = e.details.previous === true;
    }
  }
  // Set by the engine directly, without an event.
  const cas = i >= 0 ? c.journal[i]!.metrics.casualties : 0;
  const pop = i >= 0 ? c.journal[i]!.metrics.population : c.world.initialPopulation;
  f.firstDeath = f.firstDeath && cas > 0 ? true : cas > 0;
  f.extinction = pop <= 0;
  return f;
}

function controlAfter(c: Campaign, i: number): Record<string, string> {
  const ctl: Record<string, string> = {};
  for (const s of SCOPES) ctl[s] = String(c.world.control[s] ?? "institution");
  for (let k = c.journal.length - 1; k > i; k--) {
    const events = c.journal[k]!.domainEvents;
    for (let j = events.length - 1; j >= 0; j--) {
      const e = events[j]!;
      if (e.kind !== "effective_control_changed" && e.kind !== "effective_control_seized") continue;
      ctl[String(e.details.scope)] = String(e.details.previous);
    }
  }
  return ctl;
}

/** Engine news published by record i (or at the start, for i = -1). */
function newsAfter(c: Campaign, i: number): EngineNewsLine[] {
  if (i < 0) {
    const claimed = new Set<string>();
    for (const r of c.journal) for (const e of r.domainEvents) claimed.add(e.id);
    return c.world.news
      .filter((n) => !claimed.has(n.id) && !claimed.has(n.id.replace(/-news$/, "")))
      .map((n) => ({ headline: n.headline, source: n.source }));
  }
  const ids = new Set(c.journal[i]!.domainEvents.map((e) => e.id));
  return c.world.news.filter((n) => ids.has(n.id) || ids.has(n.id.replace(/-news$/, ""))).map((n) => ({ headline: n.headline, source: n.source }));
}

/** The feed input for one decision ordinal (1-based). */
export function ambientInputFor(c: Campaign, ordinal: number): AmbientInput {
  const n = ordinalOf(c);
  const o = Math.max(1, Math.min(ordinal, Math.max(1, n)));
  const current = o === n && c.prepared ? c.prepared : null;
  const record: DecisionRecord | undefined = c.journal[o - 1];
  const stage = current ? current.stage : (record?.stage ?? c.stage);
  const prevIndex = o - 2; // the record whose outcome this decision faces
  const day = prevIndex >= 0 ? c.journal[prevIndex]!.dayAfter : 0;
  const previousDay = prevIndex >= 1 ? c.journal[prevIndex - 1]!.dayAfter : prevIndex === 0 ? 0 : undefined;
  let facts: Record<VisibleFact, boolean>;
  let metrics: AmbientMetrics;
  let control: Record<string, string>;
  if (current) {
    facts = readVisible(current.facts);
    const obs = current.observations;
    metrics = {
      gdp: obs.gdp.value,
      capability: obs.capability.value,
      casualties: obs.casualties.value,
      population: obs.population.value,
      care: obs.care.value,
      food: obs.food.value,
      power: obs.power.value,
    };
    control = { ...current.control };
  } else {
    facts = factsAfter(c, prevIndex, readVisible(c.world.facts));
    metrics = prevIndex >= 0 ? observedAfter(c, prevIndex) : initialMetrics(c);
    control = controlAfter(c, prevIndex);
  }
  const news = newsAfter(c, prevIndex);
  return {
    seed: c.seed,
    ordinal: o,
    stage,
    day,
    previousDay,
    facts,
    metrics,
    control,
    lastEngineHeadlines: news.map((x) => x.headline),
    lastEngineNews: news,
    ...(dayFormat ? { formatDay: dayFormat } : {}),
  };
}

let dayFormat: ((day: number) => string) | undefined;

/**
 * Datelines default to "DAY 213 · 09:42", the wire's own default. If the
 * orchestrator dates engine news from a calendar epoch, pass the same
 * formatter here so ambient cards match. Clears the cache.
 */
export function setAmbientDayFormat(format: ((day: number) => string) | undefined): void {
  dayFormat = format;
  cache = null;
}

interface Cache {
  seed: string;
  keys: string[];
  outputs: FeedItem[][];
  banners: { text: string; templateId: string }[];
}
let cache: Cache | null = null;

function keyFor(c: Campaign, o: number): string {
  const prev = c.journal[o - 2];
  const own = c.journal[o - 1]?.id ?? c.prepared?.id ?? "";
  return `${o}|${prev?.stateHash ?? "start"}|${own}`;
}

/**
 * The generator src/ui/ambient-log.ts expects: the new items for one
 * decision ordinal. Deterministic; repeated calls are served from a cache
 * that is invalidated whenever the journal diverges.
 */
export function ambientGenerator(c: Campaign, ordinal: number): FeedItem[] {
  const n = Math.min(ordinal, ordinalOf(c));
  if (n < 1) return [];
  return run(c, n).outputs[n - 1] ?? [];
}

function run(c: Campaign, n: number): Cache {
  if (!cache || cache.seed !== c.seed) cache = { seed: c.seed, keys: [], outputs: [], banners: [] };
  let valid = 0;
  while (valid < cache.keys.length && valid < n && cache.keys[valid] === keyFor(c, valid + 1)) valid++;
  if (valid < cache.keys.length && valid < n) {
    cache.keys.length = valid;
    cache.outputs.length = valid;
    cache.banners.length = valid;
  }
  if (cache.keys.length >= n) return cache;
  const used: string[] = [];
  const note = (id: string) => {
    if (!used.includes(id)) used.push(id);
  };
  for (let o = 0; o < cache.outputs.length; o++) {
    for (const item of cache.outputs[o]!) note(item.templateId);
    note(cache.banners[o]!.templateId);
  }
  for (let o = cache.keys.length + 1; o <= n; o++) {
    const input = ambientInputFor(c, o);
    const items = ambientFeed({ ...input, recentTemplateIds: [...used] });
    for (const item of items) note(item.templateId);
    const banner = factoidEntry({ ...input, recentTemplateIds: [...used] });
    note(banner.templateId);
    cache.keys.push(keyFor(c, o));
    cache.outputs.push(items);
    cache.banners.push(banner);
  }
  return cache;
}

/** Every step's items for the campaign so far, oldest first. */
export function ambientHistory(c: Campaign): FeedItem[] {
  const n = ordinalOf(c);
  if (n < 1) return [];
  return run(c, n).outputs.slice(0, n).flat();
}

/** Bot saturation for the decision in front of the player. Reads no hidden fact. */
export function botSaturationForCampaign(c: Campaign): number {
  const n = ordinalOf(c);
  return n < 1 ? 0 : botSaturation(ambientInputFor(c, n));
}

/**
 * The fading-banner line for the decision in front of the player. It avoids
 * figures the wire or the banner has already shown in this run.
 */
export function factoidForCampaign(c: Campaign): string {
  const n = ordinalOf(c);
  if (n < 1) return "";
  return run(c, n).banners[n - 1]?.text ?? "";
}

/**
 * Marquee lines for the decision in front of the player: the ambient ticker
 * items of the last `window` decisions, newest first, without duplicates. The
 * wire's own wireTickerLines() keeps the last fourteen whatever their age,
 * which lets a stage-4 price line scroll past in stage 7.
 */
export function tickerForCampaign(c: Campaign, window = 6): string[] {
  const n = ordinalOf(c);
  if (n < 1) return [];
  const outputs = run(c, n).outputs.slice(Math.max(0, n - window), n);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (let i = outputs.length - 1; i >= 0; i--)
    for (const item of [...outputs[i]!].reverse())
      if (item.kind === "ticker" && !seen.has(item.text)) {
        seen.add(item.text);
        lines.push(item.text);
      }
  return lines;
}
