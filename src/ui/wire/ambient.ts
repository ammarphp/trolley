/**
 * The ambient wire: a deterministic, presentation-only feed of the fictional
 * world's news and posts, generated per decision from the run seed and the
 * state the player can see.
 *
 *   ambientFeed(input)  -> the 2-6 new items for one decision step
 *   factoid(input)      -> one short figure for the fading banner
 *   ambientRun(inputs)  -> a whole run, threading history so nothing repeats
 *   botSaturation(input)
 *
 * Same input, same output. It reads only the visible fact allowlist, never
 * the hidden facts, and every template passes the global consistency rules
 * in dsl.ts (TAG_RULES) as well as its own guard, so the feed does not
 * announce recovery from an unrepaired catastrophe, a model release after
 * research stopped, human policy after authority was lost, and so on.
 */
import { createRng, hashString, type Rng } from "../../render/core/rng.ts";
import { bot as botAccount, citizen, issuerVoice, outletVoice, personaVoice, BOT_OUTLETS, type Voice } from "./cast.ts";
import { ALL_TEMPLATES, FALLBACK, TEMPLATE_INDEX } from "./content/index.ts";
import type { Family, Template, VoiceSpec } from "./dsl.ts";
import { expand, newContext } from "./grammar.ts";
import { botSaturation } from "./saturation.ts";
import type { AmbientInput, Engagement, FeedItem, Severity, Topic } from "./types.ts";
import { readWorld, type WorldRead } from "./world.ts";

export { botSaturation } from "./saturation.ts";

/** Items per step (inclusive range) by stage. */
const COUNT: readonly [number, number][] = [
  [2, 3],
  [2, 4],
  [3, 5],
  [4, 5],
  [4, 6],
  [4, 6],
  [3, 6],
];

const DAY = 1440;

let strict = false;
/** Tests turn this on so a content error throws instead of dropping the item. */
export function setAmbientStrict(on: boolean): void {
  strict = on;
}

interface Step {
  input: AmbientInput;
  world: WorldRead;
  sat: number;
  rng: Rng;
  seedHash: number;
  history: ReadonlySet<string>;
  /** Recurring characters seen in the last few steps. */
  recentPersonas: ReadonlySet<string>;
  usedHere: Set<string>;
  topicsHere: Set<Topic>;
  personasHere: Set<string>;
  items: FeedItem[];
  botIndex: number;
}

/* ------------------------------------------------------------ selection */

function inWindow(t: Template, w: WorldRead, sat: number): boolean {
  return t.stages[0] <= w.stage && w.stage <= t.stages[1] && sat >= t.sat[0] && sat <= t.sat[1];
}

function usesSupplied(t: Template): boolean {
  return /\{(echo|last)\b/.test(t.text);
}

/** Can this template appear at all in this world? (Guards, tags, windows, once/after.) */
export function eligible(t: Template, w: WorldRead, sat: number, history: ReadonlySet<string>): boolean {
  if (!inWindow(t, w, sat)) return false;
  if (!t.guard(w)) return false;
  if (t.once && history.has(t.id)) return false;
  if (t.after && !history.has(t.after)) return false;
  if (t.before && history.has(t.before)) return false;
  if (w.flags.extinct && !extinctSafe(t)) return false;
  if (w.flags.remnantWorld && (t.family === "human" || t.family === "pair") && !t.when.includes("b=remnant")) return false;
  // A contained Morrow does not post, except to say that it cannot.
  if (w.flags.containment && t.voices.some((v) => v.type === "issuer" && v.id === "morrow") && !t.when.split(/\s+/).includes("containment")) return false;
  return true;
}

/** In an emptied world only machines speak. */
function extinctSafe(t: Template): boolean {
  if (t.family === "bot" || t.family === "ticker" || t.family === "factoid") return !/\b(people|human|citizen|residents?)\b/i.test(t.text) || t.when.includes("extinct");
  return t.voices.every((v) => v.type === "botOutlet" || (v.type === "issuer" && v.id === "morrow"));
}

function score(t: Template, s: Step): number {
  let w = t.weight;
  // Content written for this stage beats content written for a long window.
  w *= 1 / (1 + 0.45 * (t.stages[1] - t.stages[0]));
  // Stateless spread: each template prefers one ordinal in three.
  const lane = hashString(`${s.input.seed}|${t.id}`) % 3;
  w *= lane === s.input.ordinal % 3 ? 1 : 0.3;
  if (s.topicsHere.has(t.topic)) w *= 0.3;
  if (t.family === "news") {
    // As the feed saturates, automated sites crowd out the newsrooms.
    const automated = t.voices.every((x) => x.type === "botOutlet");
    w *= automated ? 0.4 + 2.6 * Math.max(0, s.sat - 0.4) : Math.max(0.3, 1.15 - 0.85 * s.sat);
  }
  // Machines may repeat themselves, but prefer not to repeat the same line every step.
  if (t.family === "bot" && s.history.has(t.id)) w *= 0.15;
  const v = t.voices.length === 1 ? t.voices[0]! : null;
  if (v?.type === "persona" && s.recentPersonas.has(v.id)) w *= 0.25;
  return w;
}

function choose(s: Step, family: Family, filter: (t: Template) => boolean = () => true): Template | null {
  const all = ALL_TEMPLATES.filter((t) => t.family === family && !s.usedHere.has(t.id) && filter(t) && eligible(t, s.world, s.sat, s.history));
  // No template twice in a run while there is anything else to say. Machines
  // are allowed to repeat themselves once the feed is theirs.
  const repeats = family === "bot" && s.sat >= 0.5;
  const unseen = repeats ? all : all.filter((t) => !s.history.has(t.id));
  // Once a family has said everything it can in this world, it falls silent
  // and another family takes the slot; only the figures may come round again.
  const figures = family === "ticker" || family === "factoid";
  const recent = figures && !unseen.length ? new Set((s.input.recentTemplateIds ?? []).slice(-8)) : null;
  const stale = recent ? all.filter((t) => !recent.has(t.id)) : [];
  const pool = unseen.length ? unseen : figures ? (stale.length ? stale : all) : [];
  // Avoid a recurring character appearing twice in one step.
  const fresh = pool.filter((t) => !(t.voices.length === 1 && t.voices[0]!.type === "persona" && s.personasHere.has(t.voices[0]!.id)));
  const candidates = fresh.length ? fresh : pool;
  if (!candidates.length) return null;
  const weights = candidates.map((t) => score(t, s));
  let total = 0;
  for (const w of weights) total += w;
  let r = s.rng.next() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

function fallback(s: Step, family: Family): Template | null {
  const pool = FALLBACK.filter((t) => t.family === family && !s.usedHere.has(t.id) && eligible(t, s.world, s.sat, s.history));
  return pool.length ? s.rng.pick(pool) : null;
}

/* ------------------------------------------------------------- voices */

function voiceFor(s: Step, spec: VoiceSpec): Voice {
  switch (spec.type) {
    case "outlet":
      return outletVoice(spec.id);
    case "botOutlet":
      return outletVoice(s.rng.pick(BOT_OUTLETS).id);
    case "issuer":
      return issuerVoice(spec.id);
    case "persona":
      return personaVoice(spec.id);
    case "citizen": {
      const c = citizen(s.rng);
      return { authorHandle: c.handle, authorName: c.name, nationId: "arden", verified: false, isBot: false };
    }
    case "bot": {
      const b = botAccount(s.input.seed, s.input.ordinal * 32 + s.botIndex++, s.world.stage);
      return { authorHandle: b.handle, authorName: b.name, nationId: "arden", verified: false, isBot: true };
    }
  }
}

/* -------------------------------------------------------------- stamps */

function stampDay(s: Step): number {
  const day = s.world.day;
  const prev = s.input.previousDay;
  if (typeof prev !== "number" || !Number.isFinite(prev) || prev >= day - 1) return day;
  const gap = day - Math.max(prev, -1);
  const r = s.rng.next();
  // Biased toward the present: most of the feed is recent.
  return Math.max(Math.floor(prev) + 1, day - Math.floor(gap * r * r));
}

function stampMinute(s: Step, t: Template | null, family: Family): number {
  if (t?.hours) {
    const [h0, h1] = t.hours;
    return Math.min(DAY - 1, h0 * 60 + s.rng.int(0, Math.max(0, (h1 - h0) * 60 - 1)));
  }
  switch (family) {
    case "news":
      return s.rng.int(6 * 60 + 30, 22 * 60 + 30);
    case "statement":
      return s.rng.int(8 * 60, 19 * 60);
    case "bot":
      return s.rng.int(0, DAY - 1);
    default:
      return s.rng.chance(0.12) ? s.rng.int(0, 2 * 60 + 30) : s.rng.int(7 * 60, 23 * 60 + 50);
  }
}

function dateLabel(input: AmbientInput, day: number, minute: number): string {
  const fmt = input.formatDay ?? ((d: number) => `DAY ${Math.max(0, Math.floor(d)) + 1}`);
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${fmt(day)} · ${hh}:${mm}`;
}

/* ---------------------------------------------------------- engagement */

function humanEngagement(s: Step, verified: boolean): Engagement {
  const base = 2.1 + 0.28 * s.world.stage + s.rng.gauss() * 0.9 + (verified ? 2.4 : 0);
  const likes = Math.max(0, Math.round(Math.exp(base)));
  return {
    likes,
    reposts: Math.round(likes * s.rng.range(0.04, 0.28)),
    replies: Math.round(likes * s.rng.range(0.02, 0.14)) + s.rng.int(0, 3),
  };
}

function botEngagement(s: Step): Engagement {
  if (s.sat < 0.45) {
    const likes = s.rng.int(0, 60);
    return { likes, reposts: s.rng.int(0, Math.ceil(likes / 2)), replies: s.rng.int(0, 2) };
  }
  // Uniform numbers are the tell: the same count, everywhere, no replies.
  const unit = 1 + (hashString(`${s.input.seed}:${s.input.ordinal}:eng`) % 9);
  const likes = Math.round(unit * 1000 * (1 + s.sat * 4));
  return { likes, reposts: likes, replies: 0 };
}

/* ------------------------------------------------------------- builders */

interface Made {
  item: FeedItem;
  template: Template;
}

function makeItem(s: Step, t: Template, opts: { day?: number; minute?: number; extra?: Record<string, string>; text?: string; echoOf?: string } = {}): Made | null {
  const voice = voiceFor(s, s.rng.pick(t.voices));
  let text: string;
  try {
    text = opts.text ?? expand(t.text, newContext(s.rng, s.world, opts.extra ?? {}));
  } catch (error) {
    // Content bugs must surface in tests, never in the cab.
    if (strict) throw error;
    return null;
  }
  const day = opts.day ?? stampDay(s);
  const minute = opts.minute ?? stampMinute(s, t, t.family);
  const kind = t.kind;
  const isNews = t.family === "news";
  let severity: Severity = t.severity;
  if (kind === "breaking") severity = 2;
  const citeLoop = isNews && !t.lead && !voice.isBot && s.sat >= 0.55 && voice.outletId !== "authority" && s.rng.chance((s.sat - 0.45) * 0.9);
  if (citeLoop) {
    const via = `Via ${s.rng.pick(BOT_OUTLETS).name}, citing ${voice.outletName}.`;
    text = /[.!?'"\u201d]$/.test(text) ? `${text} ${via}` : `${text}. ${via}`;
  }
  const item: FeedItem = {
    id: `amb:${s.input.ordinal}:${s.items.length}:${t.id}`,
    kind,
    topic: t.topic,
    text,
    dateLabel: dateLabel(s.input, day, minute),
    day,
    minute,
    isBot: voice.isBot,
    severity,
    templateId: t.id,
    verified: voice.verified,
  };
  if (voice.outletId) item.outletId = voice.outletId;
  if (voice.outletName) item.outletName = voice.outletName;
  if (voice.authorHandle) item.authorHandle = voice.authorHandle;
  if (voice.authorName) item.authorName = voice.authorName;
  if (voice.personaId) item.personaId = voice.personaId;
  if (voice.nationId) item.nationId = voice.nationId;
  if (kind === "post") item.engagement = voice.isBot ? botEngagement(s) : humanEngagement(s, voice.verified);
  if (isNews) {
    const thumb = t.thumb ?? (t.topic !== "general" && !voice.isBot && s.rng.chance(0.35) ? t.topic : null);
    if (thumb) item.thumbnailTopic = thumb;
    const loud = voice.isBot ? 1 + Math.round(s.sat * s.sat * 60) : severity === 2 ? s.rng.int(3, 9) : severity === 1 ? s.rng.int(1, 4) : s.rng.chance(0.7) ? 1 : s.rng.int(2, 3);
    item.sharedBy = citeLoop ? loud + s.rng.int(6, 30) : loud;
  }
  if (opts.echoOf) item.echoOf = opts.echoOf;
  return { item, template: t };
}

function push(s: Step, made: Made | null): Made | null {
  if (!made) return null;
  s.items.push(made.item);
  s.usedHere.add(made.template.id);
  s.topicsHere.add(made.template.topic);
  if (made.item.personaId) s.personasHere.add(made.item.personaId);
  return made;
}

/** One item of a family, from the bank only; null when nothing fits. */
function attempt(s: Step, family: Family, filter?: (t: Template) => boolean): Made | null {
  const t = choose(s, family, (x) => !usesSupplied(x) && (!filter || filter(x)));
  return t ? push(s, makeItem(s, t)) : null;
}

/** One item of a family, falling back to the always-available bank. */
function single(s: Step, family: Family, filter?: (t: Template) => boolean): Made | null {
  const made = attempt(s, family, filter);
  if (made) return made;
  const t = fallback(s, family);
  return t ? push(s, makeItem(s, t)) : null;
}

/** Two private citizens who disagree, the second replying to the first. */
function pair(s: Step): boolean {
  const t = choose(s, "pair");
  if (!t || !t.reply) return false;
  const first = makeItem(s, t);
  if (!first) return false;
  push(s, first);
  const replyVoice = citizen(s.rng);
  const handle = first.item.authorHandle ?? "someone";
  let text: string;
  try {
    text = expand(t.reply, newContext(s.rng, s.world, { replyTo: handle }));
  } catch (error) {
    if (strict) throw error;
    return true;
  }
  const minute = Math.min(DAY - 1, first.item.minute + s.rng.int(3, 90));
  s.items.push({
    id: `amb:${s.input.ordinal}:${s.items.length}:${t.id}:reply`,
    kind: "post",
    topic: t.topic,
    text,
    dateLabel: dateLabel(s.input, first.item.day, minute),
    day: first.item.day,
    minute,
    isBot: false,
    severity: t.severity,
    templateId: t.id,
    authorHandle: replyVoice.handle,
    authorName: replyVoice.name,
    nationId: "arden",
    verified: false,
    engagement: humanEngagement(s, false),
  });
  return true;
}

/** Several synthetic accounts, the same sentence, the same minute. */
function cluster(s: Step, size: number): number {
  const t = choose(s, "bot", (x) => !usesSupplied(x));
  if (!t) return 0;
  const lead = makeItem(s, t);
  if (!lead) return 0;
  push(s, lead);
  const engagement = lead.item.engagement;
  let n = 1;
  for (let i = 1; i < size; i++) {
    const again = makeItem(s, t, { day: lead.item.day, minute: lead.item.minute, text: lead.item.text, echoOf: lead.item.id });
    if (!again) break;
    again.item.id = `${again.item.id}:${i}`;
    if (engagement) again.item.engagement = { ...engagement };
    s.items.push(again.item);
    n++;
  }
  return n;
}

/** Morrow speaks; the accounts repeat it within the minute. */
function echo(s: Step, room: number): number {
  let line: string | null = null;
  let day = s.world.day;
  let minute = s.rng.int(8 * 60, 20 * 60);
  let sourceId: string | undefined;
  let used = 0;
  const engineMorrow = (s.input.lastEngineNews ?? []).filter((n) => n.source === "Morrow").map((n) => n.headline);
  if (engineMorrow.length && s.rng.chance(0.6)) {
    line = s.rng.pick(engineMorrow).replace(/^Morrow:\s*/, "");
    minute = s.rng.int(9 * 60, 12 * 60);
  } else {
    const t = choose(s, "statement", (x) => x.voices.some((v) => v.type === "issuer" && v.id === "morrow"));
    if (!t) return 0;
    const made = push(s, makeItem(s, t));
    if (!made) return 0;
    line = made.item.text;
    day = made.item.day;
    minute = made.item.minute;
    sourceId = made.item.id;
    used = 1;
  }
  const echoes = Math.max(0, Math.min(room - used, s.sat >= 0.75 ? 3 : 2));
  const at = Math.min(DAY - 1, minute + (s.sat >= 0.75 ? 0 : 1));
  const shared = botEngagement(s);
  const identical = s.sat >= 0.75;
  let first: Template | null = null;
  for (let i = 0; i < echoes; i++) {
    const t: Template | null = identical && first ? first : choose(s, "bot", (x) => /\{echo\b/.test(x.text));
    if (!t) break;
    first ??= t;
    const made = makeItem(s, t, { day, minute: at, extra: { echo: line }, echoOf: sourceId });
    if (!made) break;
    made.item.id = `${made.item.id}:e${i}`;
    made.item.engagement = { ...shared };
    s.items.push(made.item);
    s.usedHere.add(t.id);
    used++;
  }
  return used;
}

/** A synthetic account praising whatever the engine just reported. */
function lastEcho(s: Step): boolean {
  const lines = (s.input.lastEngineNews ?? [])
    .filter((n) => n.source === "Morrow" || n.source === "Authority")
    .map((n) => n.headline)
    .filter((h) => !/\b(dead|death|deaths|died|dies|killed|kill|casualt|toll|loss|lost|injur|funeral|bodies)\b/i.test(h) && !/appoints you/i.test(h));
  if (!lines.length) return false;
  const t = choose(s, "bot", (x) => /\{last\b/.test(x.text));
  if (!t) return false;
  const last = s.rng.pick(lines).replace(/^Morrow:\s*/, "");
  return Boolean(push(s, makeItem(s, t, { extra: { last } })));
}

/* ------------------------------------------------------------ the step */

function newStep(input: AmbientInput): Step {
  const sat = botSaturation(input);
  const world = readWorld(input, sat);
  const recent = (input.recentTemplateIds ?? []).slice(-10);
  const recentPersonas = new Set<string>();
  for (const id of recent) {
    const v = TEMPLATE_INDEX.get(id)?.voices;
    if (v && v.length === 1 && v[0]!.type === "persona") recentPersonas.add(v[0]!.id);
  }
  return {
    input,
    world,
    sat,
    rng: createRng(`ambient:${input.seed}:${world.nums.ordinal}`),
    seedHash: hashString(input.seed ?? ""),
    history: new Set(input.recentTemplateIds ?? []),
    recentPersonas,
    usedHere: new Set(),
    topicsHere: new Set(),
    personasHere: new Set(),
    items: [],
    botIndex: 0,
  };
}

function pickFigure(s: Step, family: "ticker" | "factoid"): Made | null {
  const t = choose(s, family) ?? fallback(s, family);
  const made = t ? makeItem(s, t) : null;
  if (made) {
    // Figures belong to no outlet; the marquee and the banner are the wire's own voice.
    delete made.item.outletId;
    delete made.item.outletName;
    delete made.item.nationId;
    delete made.item.verified;
  }
  return made;
}

/**
 * The 2-6 new items for one decision step, in chronological order.
 * Deterministic in its input. Never reads hidden facts.
 */
export function ambientFeed(input: AmbientInput): FeedItem[] {
  const s = newStep(input);
  const { stage } = s.world;
  const [lo, hi] = COUNT[stage - 1]!;
  const total = s.rng.int(lo, hi);
  let cards = total;

  // Figures for the marquee and the banner, if there is room for two cards besides.
  const wantFactoid = total >= 3 && (s.world.nums.ordinal + (s.seedHash % 3)) % 3 === 0;
  if (wantFactoid) cards--;
  const wantTicker = cards >= 4 && s.world.nums.ordinal % 2 === 1;
  if (wantTicker) cards--;

  // The world keeps happening however loud the machines get: some slots
  // are always news. Fewer as the feed saturates, never none.
  const newsQuota = Math.max(1, Math.round(cards * (0.42 - 0.22 * s.sat)));
  const room = () => cards - newsQuota - s.items.length;

  const engineMorrow = (s.input.lastEngineNews ?? []).some((n) => n.source === "Morrow");
  const echoTurn = engineMorrow || (s.world.nums.ordinal + s.seedHash) % 2 === 0;
  // When the feed is nearly all machine, one person is still posting.
  if (s.sat >= 0.7 && room() >= 1 && s.rng.chance(stage >= 7 ? 0.75 : 0.55)) attempt(s, "human");
  let special = false;
  // Morrow speaks, and the accounts repeat it within the minute.
  if (stage >= 5 && s.sat >= 0.45 && echoTurn && room() >= 2 && s.rng.chance(Math.min(0.95, s.sat + 0.1))) special = echo(s, Math.min(3, room())) > 0;
  // Otherwise, a synchronized cluster.
  const people = stage >= 7 && PEOPLE_BRANCHES.has(s.world.branch);
  if (!special && s.sat >= 0.3 && room() >= 2 && s.rng.chance(s.sat * (people ? 0.45 : 1))) special = cluster(s, Math.min(room(), s.sat > 0.7 ? 3 : 2)) > 0;
  // A bot celebrating the engine's own news.
  if (s.sat >= 0.5 && room() >= 1 && s.rng.chance(0.3)) lastEcho(s);
  // Independent disagreement survives while the feed is still mostly human.
  if (stage >= 2 && s.sat < 0.45 && room() >= 2 && s.rng.chance(0.3 * (1 - s.sat * 2))) pair(s);

  // The news quota, then the rest by family weights.
  let guard = 0;
  let news = 0;
  // The first of them is a real newsroom's: in the aftermath, one of the
  // stories that says which world this is; before it, anything true.
  const human = (t: Template) => t.voices.some((v) => v.type !== "botOutlet");
  if (s.items.length < cards) {
    const first =
      attempt(s, "news", (t) => t.lead && !s.history.has(t.id)) ??
      (stage >= 7 ? (attempt(s, "news", (t) => human(t) && aftermathBeat(t)) ?? attempt(s, "news", human)) : s.world.branch === "extinct" ? null : attempt(s, "news", human));
    if (first) news++;
  }
  while (news < newsQuota && s.items.length < cards && guard++ < 12) {
    if (single(s, "news")) news++;
    else break;
  }
  guard = 0;
  while (s.items.length < cards && guard++ < 24) {
    const family = pickFamily(s);
    if (!single(s, family)) {
      // Try the other families before giving up on this slot.
      const order: Family[] = ["news", "statement", "bot", "human"];
      if (!order.some((f) => f !== family && single(s, f))) break;
    }
  }

  const figures: Made[] = [];
  if (wantTicker) {
    const m = pickFigure(s, "ticker");
    if (m) figures.push(m);
  }
  if (wantFactoid) {
    const m = pickFigure(s, "factoid");
    if (m) figures.push(m);
  }
  for (const f of figures) {
    f.item.id = `amb:${s.input.ordinal}:${s.items.length}:${f.template.id}`;
    s.items.push(f.item);
  }

  // Never fewer than two items: pad with whatever still fits.
  let pad = 0;
  while (s.items.length < 2 && pad++ < 6) {
    if (!single(s, "news") && !single(s, "bot") && !single(s, "statement")) {
      const m = pickFigure(s, "factoid");
      if (m) {
        m.item.id = `amb:${s.input.ordinal}:${s.items.length}:${m.template.id}:pad${pad}`;
        s.items.push(m.item);
      }
    }
  }
  const out = s.items.slice(0, 6);
  out.sort((a, b) => a.day * DAY + a.minute - (b.day * DAY + b.minute) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Aftermath stories that say which world this has become. */
function aftermathBeat(t: Template): boolean {
  return t.stages[0] === 7 && /b=|succession|researchStopped|returnAuthority|powerReturned|publicRecords|trainedSuccessor/.test(t.when);
}

/** Branches in which people, not accounts, carry the aftermath. */
const PEOPLE_BRANCHES = new Set(["ruin", "recovery", "restraint", "accountable", "containment", "drift"]);

function pickFamily(s: Step): Family {
  const sat = s.sat;
  const people = s.world.stage >= 7 && PEOPLE_BRANCHES.has(s.world.branch);
  const human = s.world.flags.extinct ? 0 : 0.36 * Math.pow(1 - sat, 1.6) * (people ? 2.5 : 1);
  const weights: [Family, number][] = [
    ["news", 0.5 - 0.22 * sat],
    ["statement", s.world.stage >= 3 ? 0.16 : 0.1],
    ["human", human],
    ["bot", s.world.stage >= 3 ? (0.02 + 0.6 * Math.pow(sat, 1.2)) * (people ? 0.5 : 1) : 0],
  ];
  let total = 0;
  for (const [, w] of weights) total += w;
  let r = s.rng.next() * total;
  for (const [f, w] of weights) {
    r -= w;
    if (r <= 0) return f;
  }
  return "news";
}

/** The banner line and the template it came from (for callers keeping history). */
export function factoidEntry(input: AmbientInput): { text: string; templateId: string } {
  const s = newStep(input);
  s.rng = createRng(`factoid:${input.seed}:${s.world.nums.ordinal}`);
  const m = pickFigure(s, "factoid");
  return m ? { text: m.item.text, templateId: m.template.id } : { text: `World day ${s.world.day + 1}.`, templateId: "none" };
}

/**
 * One short line for the fading banner, e.g. "Electricity prices in the
 * Arden grid: +340% since the first campuses opened." Deterministic; never
 * empty. Pass recentTemplateIds to avoid figures already shown.
 */
export function factoid(input: AmbientInput): string {
  return factoidEntry(input).text;
}

/**
 * A whole run: each step sees the template ids used before it, so no
 * template repeats and follow-ups ("after") can fire.
 */
export function ambientRun(inputs: readonly AmbientInput[]): FeedItem[][] {
  const used: string[] = [];
  return inputs.map((input) => {
    const items = ambientFeed({ ...input, recentTemplateIds: [...(input.recentTemplateIds ?? []), ...used] });
    for (const item of items) if (!used.includes(item.templateId)) used.push(item.templateId);
    return items;
  });
}
