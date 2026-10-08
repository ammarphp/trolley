/**
 * Template records and the small authoring DSL the content banks use.
 *
 *   H("4-5", "grid", "@ledger|@relay", "text", { when: "rivalRace !stopped", tags: ["boom"] })
 *
 * Voices: "@outlet" (bible outlet), "$" (automated bot site), "#issuer" (lab,
 * operator, Halberd, Morrow), "!nation" (a government), "~persona" (bible
 * persona), "citizen" (a generated private account), "bot" (synthetic
 * account). Several voices joined with "|" pick one.
 *
 * Guards ("when"): space-separated terms, all required. A term is a flag,
 * "!flag", "a|b" (either), a comparison on a number ("sat>0.5",
 * "cas>=1000000", "unemp<8") or "b=<branch>". Flags are the visible facts
 * plus the derived flags in DERIVED_FLAGS; anything else throws at load, so
 * a hidden fact cannot be referenced by accident.
 */
import { TOPICS, VISIBLE_FACTS, type FeedKind, type Severity, type Topic } from "./types.ts";
import type { Branch, WorldRead } from "./world.ts";
import { slotNames, SLOTS, TemplateError } from "./grammar.ts";

export type Family = "news" | "statement" | "human" | "bot" | "pair" | "ticker" | "factoid";

export type VoiceSpec =
  | { type: "outlet"; id: string }
  | { type: "botOutlet" }
  | { type: "issuer"; id: string }
  | { type: "persona"; id: string }
  | { type: "citizen" }
  | { type: "bot" };

export interface Template {
  id: string;
  family: Family;
  kind: FeedKind;
  topic: Topic;
  stages: [number, number];
  voices: VoiceSpec[];
  text: string;
  /** Second post of a disagreement pair. */
  reply?: string;
  when: string;
  guard: (w: WorldRead) => boolean;
  tags: readonly string[];
  weight: number;
  severity: Severity;
  thumb: Topic | null;
  /** Bot-saturation window in which the template may appear. */
  sat: [number, number];
  once: boolean;
  /** Only after this template has appeared earlier in the run (needs history). */
  after?: string;
  /** Only until this template has appeared (a joke told before the thing it jokes about). */
  before?: string;
  /** Local hours the item may be stamped with. */
  hours?: [number, number];
  /** A story that leads the first news slot whenever it is eligible (stage openers, turning points). */
  lead: boolean;
}

export interface Opts {
  id?: string;
  when?: string;
  tags?: string[];
  w?: number;
  sev?: Severity;
  thumb?: Topic | null;
  sat?: [number, number];
  once?: boolean;
  after?: string;
  before?: string;
  at?: [number, number];
  lead?: boolean;
}

/** Derived flags from world.ts, the only non-fact names guards may use. */
export const DERIVED_FLAGS = [
  "morrowGov",
  "humanGov",
  "morrowRail",
  "morrowDispatch",
  "morrowCare",
  "morrowPower",
  "morrowFood",
  "morrowResearch",
  "morrowRecovery",
  "humanRecovery",
  "deaths",
  "massDeath",
  "megaDeath",
  "remnantWorld",
  "extinct",
  "alive",
  "repaired",
  "ruinUnrepaired",
  "stopped",
  "racing",
  "servicesOk",
  "servicesLow",
  "blackouts",
  "boomOk",
  "slump",
  "tenT",
  "layoffs",
  "massUnemp",
  "velaOpen",
  "pristine",
] as const;

export const NUMBERS = ["stage", "day", "ordinal", "sat", "cap", "gdp", "care", "food", "power", "cas", "pop", "initial", "elec", "unemp", "infl", "gdpChange", "valuation", "gw", "birth", "partners", "humanShare", "robots", "dispatch", "companions", "queries", "tax"] as const;

const BRANCHES: readonly Branch[] = ["extinct", "remnant", "succession", "containment", "tutelage", "ruin", "recovery", "restraint", "accountable", "drift"];

const KNOWN = new Set<string>([...VISIBLE_FACTS, ...DERIVED_FLAGS]);

/**
 * Global consistency rules, applied to every template carrying the tag. These
 * are how the feed avoids contradicting the engine: a lab cannot release a
 * model after research stopped, nothing announces recovery from an
 * unrepaired catastrophe, and so on.
 */
export const TAG_RULES: Readonly<Record<string, string>> = {
  /** A lab launches, deploys or announces a new model or capability. */
  release: "!stopped !remnantWorld !extinct",
  /** New training, fundraising for training, compute build-out. */
  training: "!stopped !remnantWorld !extinct",
  /** Anything restored, reopened, back to normal. */
  recovery: "!ruinUnrepaired !remnantWorld !extinct",
  /** Celebratory economics. */
  boom: "boomOk",
  /** The human government making real policy. */
  humanPolicy: "humanGov !succession !authorityLost",
  /** Vela acting as a going concern. */
  vela: "velaOpen",
  /** Ordinary civilian life. */
  civilian: "!remnantWorld !extinct",
  /** Refers to people having died. */
  deaths: "deaths",
  /** Refers to the catastrophe. */
  catastrophe: "catastrophe",
  /** A normal election. */
  election: "humanGov !succession !repression !remnantWorld",
  /** Morrow is present in the world. */
  morrow: "assistance|benefit|delegation|clinicalTool|essentialDependence|authorityLost|morrowGov",
};

function compileTerm(term: string, where: string): (w: WorldRead) => boolean {
  if (term.includes("|")) {
    const alts = term.split("|").map((t) => compileTerm(t, where));
    return (w) => alts.some((a) => a(w));
  }
  if (term.startsWith("!")) {
    const inner = compileTerm(term.slice(1), where);
    return (w) => !inner(w);
  }
  const b = /^b=([a-z]+)$/.exec(term);
  if (b) {
    const branch = b[1] as Branch;
    if (!BRANCHES.includes(branch)) throw new TemplateError(`${where}: unknown branch "${branch}"`);
    return (w) => w.branch === branch;
  }
  const cmp = /^([a-zA-Z]+)(>=|<=|>|<|=)(-?\d+(?:\.\d+)?(?:e\d+)?)$/.exec(term);
  if (cmp) {
    const [, name, op, raw] = cmp;
    if (!(NUMBERS as readonly string[]).includes(name!)) throw new TemplateError(`${where}: unknown number "${name}"`);
    const v = Number(raw);
    return (w) => {
      const x = w.nums[name!]!;
      return op === ">" ? x > v : op === "<" ? x < v : op === ">=" ? x >= v : op === "<=" ? x <= v : x === v;
    };
  }
  if (!/^[a-zA-Z]+$/.test(term) || !KNOWN.has(term)) throw new TemplateError(`${where}: unknown guard term "${term}"`);
  return (w) => w.flags[term] === true;
}

export function compileGuard(src: string, where: string): (w: WorldRead) => boolean {
  const terms = src.split(/\s+/).filter(Boolean).map((t) => compileTerm(t, where));
  return (w) => terms.every((t) => t(w));
}

function parseStages(s: string, where: string): [number, number] {
  const m = /^([1-7])(?:-([1-7]))?$/.exec(s);
  if (!m) throw new TemplateError(`${where}: bad stage window "${s}"`);
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  if (hi < lo) throw new TemplateError(`${where}: bad stage window "${s}"`);
  return [lo, hi];
}

function parseVoices(s: string, where: string): VoiceSpec[] {
  return s.split("|").map((v) => {
    const t = v.trim();
    if (t === "citizen") return { type: "citizen" } as const;
    if (t === "bot") return { type: "bot" } as const;
    if (t === "$") return { type: "botOutlet" } as const;
    if (t.startsWith("@")) return { type: "outlet", id: t.slice(1) } as const;
    if (t.startsWith("#")) return { type: "issuer", id: t.slice(1) } as const;
    if (t.startsWith("!")) return { type: "issuer", id: t.slice(1) } as const;
    if (t.startsWith("~")) return { type: "persona", id: t.slice(1) } as const;
    throw new TemplateError(`${where}: bad voice "${t}"`);
  });
}

function checkSlots(text: string, where: string): void {
  for (const name of slotNames(text)) if (!SLOTS[name]) throw new TemplateError(`${where}: unknown slot {${name}} in "${text}"`);
}

interface Draft {
  kind: FeedKind;
  family: Family;
  stages: string;
  topic: Topic;
  voice: string;
  text: string;
  reply?: string;
  opts: Opts;
}

function draft(kind: FeedKind, family: Family, stages: string, topic: Topic, voice: string, text: string, opts: Opts = {}, reply?: string): Draft {
  return { kind, family, stages, topic, voice, text, opts, reply };
}

/** Headline. */
export const H = (stages: string, topic: Topic, voice: string, text: string, opts?: Opts) => draft("headline", "news", stages, topic, voice, text, opts);
/** Breaking headline (severity 2). */
export const B = (stages: string, topic: Topic, voice: string, text: string, opts?: Opts) => draft("breaking", "news", stages, topic, voice, text, { sev: 2, ...opts });
/** Statement from an issuer. */
export const S = (stages: string, topic: Topic, voice: string, text: string, opts?: Opts) => draft("statement", "statement", stages, topic, voice, text, opts);
/** Social post by a person (persona or citizen). */
export const P = (stages: string, topic: Topic, voice: string, text: string, opts?: Opts) => draft("post", "human", stages, topic, voice, text, opts);
/** Social post by a synthetic account. */
export const Bot = (stages: string, topic: Topic, text: string, opts?: Opts) => draft("post", "bot", stages, topic, "bot", text, opts);
/** Two private citizens who disagree. The reply is addressed with {replyTo}. */
export const D = (stages: string, topic: Topic, first: string, reply: string, opts?: Opts) => draft("post", "pair", stages, topic, "citizen", first, opts, reply);
/** Marquee line. */
export const K = (stages: string, text: string, opts?: Opts) => draft("ticker", "ticker", stages, "general", "@relay", text, opts);
/** Fading-banner factoid. */
export const F = (stages: string, text: string, opts?: Opts) => draft("factoid", "factoid", stages, "general", "@relay", text, opts);

/** Compile a content bank; ids are `${prefix}.${index}` unless given. */
export function bank(prefix: string, drafts: readonly Draft[]): Template[] {
  return drafts.map((d, i) => {
    const id = d.opts.id ?? `${prefix}.${String(i + 1).padStart(3, "0")}`;
    const where = `template ${id}`;
    if (!TOPICS.includes(d.topic)) throw new TemplateError(`${where}: unknown topic ${d.topic}`);
    checkSlots(d.text, where);
    if (d.reply) {
      checkSlots(d.reply, where);
      if (!d.reply.includes("{replyTo}")) throw new TemplateError(`${where}: reply must address {replyTo}`);
    }
    const tags = d.opts.tags ?? [];
    for (const t of tags) if (!TAG_RULES[t]) throw new TemplateError(`${where}: unknown tag "${t}"`);
    const whenParts = [d.opts.when ?? "", ...tags.map((t) => TAG_RULES[t]!)];
    if (d.family === "human" || d.family === "pair") whenParts.push("alive");
    const when = whenParts.filter(Boolean).join(" ");
    const voices = parseVoices(d.voice, where);
    const thumb = d.opts.thumb === undefined ? null : d.opts.thumb;
    return {
      id,
      family: d.family,
      kind: d.kind,
      topic: d.topic,
      stages: parseStages(d.stages, where),
      voices,
      text: d.text,
      reply: d.reply,
      when,
      guard: compileGuard(when, where),
      tags,
      weight: d.opts.w ?? 1,
      severity: d.opts.sev ?? (d.kind === "breaking" ? 2 : 0),
      thumb,
      sat: d.opts.sat ?? defaultSat(d.family),
      once: d.opts.once ?? false,
      after: d.opts.after,
      before: d.opts.before,
      hours: d.opts.at,
      lead: d.opts.lead ?? false,
    };
  });
}

function defaultSat(family: Family): [number, number] {
  switch (family) {
    case "human":
    case "pair":
      return [0, 0.92];
    case "bot":
      return [0.08, 1];
    default:
      return [0, 1];
  }
}
