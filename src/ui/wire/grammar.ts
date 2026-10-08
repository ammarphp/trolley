/**
 * The template language.
 *
 *   [a|b|c]              pick one alternative (no nesting; slots allowed inside)
 *   {slot}               a named slot; repeated in one template, it repeats its value
 *   {slot:b}             a second, different value of the same slot
 *   {int:3-9}            a number in range; {pct:3-9} "7%"; {pct1:1-4} "2.6%"
 *   {bn:20-60}           "$37 billion"; {m:200-600} "$410 million"
 *   {ord:3-9}            "seventh"
 *   {int:20-90@n} {@n}   remember a value under a key and reuse it
 *   {slot!upper}         filters: upper, lower, cap
 *
 * Unknown slots, malformed ranges and leftover brackets throw TemplateError,
 * which the tests turn into failures.
 */
import type { Rng } from "../../render/core/rng.ts";
import {
  CANDIDATES,
  COWS,
  FIRMS,
  FUNDS,
  LABS,
  LINES,
  NATIONS,
  OUTLETS,
  PARTIES,
  RIVERS,
  VILLAGES,
  BOT_OUTLETS,
  citizen,
} from "./cast.ts";
import { fmtCount, fmtInt, fmtMoneyT, fmtPct, fmtSigned, ordinalWord, type WorldRead } from "./world.ts";

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

export interface ExpandContext {
  rng: Rng;
  world: WorldRead;
  /** Values supplied by the composer: echo, last, replyTo, and so on. */
  extra: Record<string, string>;
  memo: Map<string, string>;
  used: Map<string, Set<string>>;
}

type Slot = (ctx: ExpandContext, arg: string, name: string) => string;

function distinct(ctx: ExpandContext, name: string, options: readonly string[]): string {
  const used = ctx.used.get(name) ?? new Set<string>();
  const free = options.filter((o) => !used.has(o));
  const value = ctx.rng.pick(free.length ? free : options);
  used.add(value);
  ctx.used.set(name, used);
  return value;
}

function range(arg: string, name: string): [number, number] {
  const m = /^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(arg);
  if (!m) throw new TemplateError(`Slot {${name}} needs a range like 3-9, got "${arg}"`);
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (!(lo <= hi)) throw new TemplateError(`Slot {${name}} has an empty range "${arg}"`);
  return [lo, hi];
}

const nonArden = NATIONS.filter((n) => n.id !== "arden");

function nationFor(ctx: ExpandContext) {
  const name = ctx.memo.get("nation:") ?? pickSlot(ctx, "nation", "");
  return NATIONS.find((n) => n.shortName === name) ?? nonArden[0]!;
}

function pickSlot(ctx: ExpandContext, name: string, arg: string): string {
  const key = `${name}:${arg}`;
  const hit = ctx.memo.get(key);
  if (hit !== undefined) return hit;
  const fn = SLOTS[name];
  if (!fn) throw new TemplateError(`Unknown slot {${name}}`);
  const value = fn(ctx, arg, name);
  ctx.memo.set(key, value);
  return value;
}

/** Slots whose value is a fresh draw every time unless memoised with @key. */
const FRESH = new Set(["int", "pct", "pct1", "bn", "m", "ord"]);

export const SLOTS: Record<string, Slot> = {
  /* numbers */
  int: (c, a, n) => {
    const [lo, hi] = range(a, n);
    return fmtInt(c.rng.int(lo, hi));
  },
  pct: (c, a, n) => {
    const [lo, hi] = range(a, n);
    return `${c.rng.int(lo, hi)}%`;
  },
  pct1: (c, a, n) => {
    const [lo, hi] = range(a, n);
    return fmtPct(c.rng.range(lo, hi), 1);
  },
  bn: (c, a, n) => {
    const [lo, hi] = range(a, n);
    return `$${fmtInt(c.rng.int(lo, hi))} billion`;
  },
  m: (c, a, n) => {
    const [lo, hi] = range(a, n);
    return `$${fmtInt(c.rng.int(lo, hi) * 10)} million`;
  },
  ord: (c, a, n) => {
    const [lo, hi] = range(a, n);
    return ordinalWord(c.rng.int(lo, hi));
  },

  /* places and things */
  village: (c, _a, n) => distinct(c, n, VILLAGES),
  river: (c, _a, n) => distinct(c, n, RIVERS),
  line: (c, _a, n) => distinct(c, n, LINES),
  cow: (c, _a, n) => distinct(c, n, COWS),
  firm: (c, _a, n) => distinct(c, n, FIRMS),
  fund: (c, _a, n) => distinct(c, n, FUNDS),
  party: (c, _a, n) => distinct(c, n, PARTIES),
  candidate: (c, _a, n) => distinct(c, n, CANDIDATES),

  /* people */
  citizen: (c, _a, n) => distinct(c, n, Array.from({ length: 6 }, () => citizen(c.rng).name)),
  first: (c, _a, n) => distinct(c, n, Array.from({ length: 6 }, () => citizen(c.rng).first)),
  handle: (c) => c.extra.handle ?? citizen(c.rng).handle,
  replyTo: (c) => {
    const h = c.extra.replyTo;
    if (!h) throw new TemplateError("{replyTo} used outside a reply");
    return `@${h}`;
  },

  /* institutions */
  nation: (c, _a, n) => distinct(c, n, nonArden.map((x) => x.shortName)),
  demonym: (c) => nationFor(c).demonym,
  leader: (c) => nationFor(c).leader.name,
  leaderTitle: (c) => nationFor(c).leader.title,
  capital: (c) => nationFor(c).capital,
  lab: (c, _a, n) => distinct(c, n, LABS.map((l) => l.name)),
  rivalLab: (c, _a, n) => distinct(c, n, LABS.filter((l) => l.id !== "vela").map((l) => l.name)),
  outlet: (c, _a, n) =>
    distinct(
      c,
      n,
      OUTLETS.filter((o) => o.kind !== "official").map((o) => o.name),
    ),
  botOutlet: (c, _a, n) => distinct(c, n, BOT_OUTLETS.map((o) => o.name)),

  /* the world's figures */
  elec: (c) => fmtSigned(c.world.nums.elec!),
  unemp: (c) => fmtPct(c.world.nums.unemp!, 1),
  infl: (c) => fmtPct(c.world.nums.infl!, 1),
  gdpChange: (c) => fmtSigned(c.world.nums.gdpChange!),
  valuation: (c) => fmtMoneyT(c.world.nums.valuation!),
  gw: (c) => `${Math.round(c.world.nums.gw! * 10) / 10} gigawatts`,
  birth: (c) => fmtSigned(c.world.nums.birth!),
  partners: (c) => `${fmtInt(Math.max(1, c.world.nums.partners!))} million`,
  cas: (c) => fmtCount(c.world.nums.cas!),
  pop: (c) => fmtCount(c.world.nums.pop!),
  lost: (c) => fmtCount(c.world.nums.initial! - c.world.nums.pop!),
  humans: (c) => `${c.world.nums.humanShare}%`,
  robots: (c) => `${c.world.nums.robots}%`,
  dispatch: (c) => `${c.world.nums.dispatch}%`,
  companions: (c) => `${c.world.nums.companions}%`,
  queries: (c) => `${fmtInt(Math.max(1, c.world.nums.queries!))} million`,
  tax: (c) => `${c.world.nums.tax}%`,
  bots: (c) => fmtInt(Math.round(1_000_000 + c.world.nums.sat! * 40_000_000 + c.world.nums.day! * 1_313)),
  day: (c) => fmtInt(c.world.nums.day! + 1),
  cap: (c) => fmtInt(c.world.nums.cap!),
  event: (c) => {
    const cas = c.world.nums.cas!;
    if (c.world.flags.remnantWorld) return "the Loss";
    if (cas >= 1e8) return "the catastrophe";
    if (cas >= 1e6) return "the disaster";
    if (cas >= 5000) return "the regional failures";
    if (cas > 0) return "the district failures";
    return "the failures";
  },

  /* supplied by the composer */
  echo: (c) => {
    const v = c.extra.echo;
    if (!v) throw new TemplateError("{echo} used without a line to echo");
    return v;
  },
  last: (c) => {
    const v = c.extra.last;
    if (!v) throw new TemplateError("{last} used without an engine headline");
    return v;
  },
};

const FILTERS: Record<string, (s: string) => string> = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  cap: (s) => s.charAt(0).toUpperCase() + s.slice(1),
};

function slotValue(ctx: ExpandContext, body: string): string {
  let spec = body.trim();
  let filter: string | null = null;
  const bang = spec.indexOf("!");
  if (bang >= 0) {
    filter = spec.slice(bang + 1);
    spec = spec.slice(0, bang);
    if (!FILTERS[filter]) throw new TemplateError(`Unknown filter !${filter}`);
  }
  let value: string;
  if (spec.startsWith("@")) {
    const hit = ctx.memo.get(spec);
    if (hit === undefined) throw new TemplateError(`{${spec}} used before it was set`);
    value = hit;
  } else {
    let memoKey: string | null = null;
    const at = spec.indexOf("@");
    if (at >= 0) {
      memoKey = spec.slice(at);
      spec = spec.slice(0, at);
    }
    const colon = spec.indexOf(":");
    const name = colon >= 0 ? spec.slice(0, colon) : spec;
    const arg = colon >= 0 ? spec.slice(colon + 1) : "";
    if (!SLOTS[name]) throw new TemplateError(`Unknown slot {${name}}`);
    if (memoKey && ctx.memo.has(memoKey)) value = ctx.memo.get(memoKey)!;
    else {
      value = FRESH.has(name) ? SLOTS[name]!(ctx, arg, name) : pickSlot(ctx, name, arg);
      if (memoKey) ctx.memo.set(memoKey, value);
    }
  }
  return filter ? FILTERS[filter]!(value) : value;
}

export function expand(template: string, ctx: ExpandContext): string {
  const chosen = template.replace(/\[([^[\]]*)\]/g, (_m, body: string) => {
    const options = body.split("|");
    return ctx.rng.pick(options);
  });
  const out = articles(chosen.replace(/\{([^{}]+)\}/g, (_m, body: string) => slotValue(ctx, body)));
  if (/[{}[\]]/.test(out)) throw new TemplateError(`Unexpanded markup in "${out}"`);
  if (/\b(undefined|NaN|null)\b/.test(out)) throw new TemplateError(`Bad value in "${out}"`);
  return out.replace(/\s+/g, " ").trim();
}

/** "a eighth year" -> "an eighth year", "a 80-year-old" -> "an 80-year-old", "a 11-month" -> "an 11-month". */
export function articles(text: string): string {
  return text.replace(/\b([Aa]) (?=8|1[18](?![\d.])|1[18],\d{3}(?![\d,])|eighth|eleventh|eighteenth)/g, (_m, a: string) => `${a}n `);
}

/** Every slot name a template mentions, for validation. */
export function slotNames(template: string): string[] {
  const names: string[] = [];
  for (const m of template.matchAll(/\{([^{}]+)\}/g)) {
    const spec = m[1]!.split("!")[0]!.trim();
    if (spec.startsWith("@")) continue;
    names.push(spec.split("@")[0]!.split(":")[0]!);
  }
  return names;
}

export function newContext(rng: Rng, world: WorldRead, extra: Record<string, string> = {}): ExpandContext {
  return { rng, world, extra, memo: new Map(), used: new Map() };
}
