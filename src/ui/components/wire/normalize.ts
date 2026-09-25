/**
 * Adapter: engine NewsItem[] + ambient feed items -> WireItem[].
 *
 * Pure and deterministic. No DOM, no engine calls. Times of day are cosmetic
 * and seeded from ids; the engine only knows days.
 */
import type { NewsItem } from "../../../contracts/index.ts";
import { pick, unit } from "./hash.ts";
import {
  ENGINE_OUTLETS,
  isMorrowId,
  outletInfo,
  titleFromId,
} from "./outlets.ts";
import type {
  AmbientFeedItemLike,
  WireEngagement,
  WireItem,
  WireKind,
  WireSeverity,
  WireSource,
  WireSourceKind,
  WireView,
} from "./types.ts";

export interface WireNormalizeOptions {
  /** Current world day (0-based). Used for undated ambient items. */
  today?: number | null;
  /** Keep "Common Rail appoints you as ..." notices (the old panel hid them). */
  includeAppointments?: boolean;
  /** Extra or overriding outlet names keyed by outlet id. */
  outlets?: Record<
    string,
    { name: string; kind?: WireSourceKind; verified?: boolean; desk?: string }
  >;
  /** Display names for ambient personas keyed by personaId. */
  personas?: Record<string, { name: string; handle?: string }>;
  /** Wording for the decision a report follows from. */
  causeLabel?: (causeId: string) => string | null;
  /** Override the lexical severity guess for engine items. */
  severityFor?: (news: NewsItem) => WireSeverity | null | undefined;
  /** Override the lexical desk guess for engine items. */
  topicFor?: (news: NewsItem) => string | null | undefined;
  /** Day formatter for engine datelines. Default "DAY 213" (1-based). */
  formatDay?: (day: number) => string;
  /**
   * ISO date (YYYY-MM-DD) for world day 0. When set, datelines read as
   * calendar dates ("14 MAR 2031 · 09:42") instead of "DAY 213 · 09:42".
   */
  epoch?: string | null;
  /** Keep at most this many newest cards. Default 160. */
  limit?: number;
}

const DAY_MINUTES = 1440;
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/* ------------------------------------------------------------------ dates */

export function formatClock(minute: number): string {
  const m = ((Math.round(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "09:42" anywhere in a label -> minute of day. */
export function parseClock(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/.exec(label);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Replace the clock inside a label, or append one if there is none. */
export function withClock(label: string, minute: number): string {
  const clock = formatClock(minute);
  const re = /(^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/;
  return re.test(label)
    ? label.replace(re, (_m, lead: string) => `${lead}${clock}`)
    : label
      ? `${label} · ${clock}`
      : clock;
}

export function defaultFormatDay(day: number): string {
  return `DAY ${Math.max(0, Math.floor(day)) + 1}`;
}

export function calendarFormatter(epoch: string): (day: number) => string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(epoch.trim());
  if (!match) return defaultFormatDay;
  const base = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return (day) => {
    const date = new Date(base + Math.floor(day) * 86400000);
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  };
}

/** "Today", "Yesterday", "3 days ago", "2 months ago", "4 years ago". */
export function relativeAge(
  day: number | null,
  today: number | null,
): string | null {
  if (day === null || today === null) return null;
  const d = Math.floor(today) - Math.floor(day);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 45) return `${d} days ago`;
  if (d < 365) {
    const months = Math.max(1, Math.round(d / 30.4));
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.max(1, Math.round(d / 365));
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/* --------------------------------------------------------- lexical guesses */

const TOPICS: [string, RegExp][] = [
  [
    "security",
    /\b(drone|drones|military|missile|attack|cyber|breach|war|border|checkpoint|troops|swarm|weapon|strike force|hack)/i,
  ],
  [
    "disaster",
    /\b(flood|fire|wildfire|storm|hurricane|quake|earthquake|drought|heatwave|evacuat)/i,
  ],
  [
    "health",
    /\b(hospital|patient|clinic|ambulance|cancer|vaccine|doctor|nurse|ward|disease|cure|medical|pandemic|outbreak)/i,
  ],
  [
    "grid",
    /\b(power\b|power (?:cuts?|lines?|plants?|stations?)|grid|electric|outage|blackout|energy|reactor|turbine|substation|megawatt|gigawatt)/i,
  ],
  [
    "datacenter",
    /\b(data cent(?:er|re)s?|datacent|compute|cluster|chips?|gpu|server farm)/i,
  ],
  [
    "labor",
    /\b(layoffs?|lay off|jobs?|unemploy|workers?|union|staff|hiring|wages?|resign)/i,
  ],
  [
    "markets",
    /\b(ipo|investors?|market|shares|stocks?|valuation|financ|fund|funding|bank|gdp|econom|inflation|prices?|trillion|billion|merger|acquisition|bond|housing)/i,
  ],
  [
    "civic",
    /\b(election|vote|voters|senate|parliament|minister|law|court|protest|unrest|rally|moratorium|regulat|treaty|summit|ban)/i,
  ],
  [
    "science",
    /\b(physics|graviton|discovery|breakthrough|telescope|particle|proof|theorem|fusion)/i,
  ],
  ["food", /\b(food|harvest|crops?|grain|farm|famine|rations?)/i],
  [
    "rail",
    /\b(rail|trolley|train|track|tram|signal box|junction|depot|common rail)/i,
  ],
  [
    "lab",
    /\b(vela|model|models|ai|a\.i\.|agent|system|research|experiment|safety|evaluation|reviewers?|certif|alignment|benchmark|agi|asi)\b/i,
  ],
];

export function inferTopic(text: string): string {
  for (const [topic, re] of TOPICS) if (re.test(text)) return topic;
  return "general";
}

const SEVERE =
  /\b(dead|dies|died|deaths?|killed|kills|fatal|fatalities|casualt|catastroph|collapse[sd]?|explosion|explodes|war\b|outbreak|evacuat|emergency|lost control|meltdown|massacre|extinct|mass (?:casualty|death)|nuclear|detonat)/i;
const NOTABLE =
  /\b(cancel|layoffs?|lay off|delay|protest|unrest|warn|fail|outage|halt|suspend|strike|recall|breach|resign|removed|shortage|crash|plunge|riot|arrest|shutdown)/i;

export function inferSeverity(text: string): WireSeverity {
  if (SEVERE.test(text)) return 2;
  if (NOTABLE.test(text)) return 1;
  return 0;
}

/* -------------------------------------------------------------- helpers */

function clampSeverity(value: unknown): WireSeverity {
  const n =
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return n >= 2 ? 2 : n <= 0 ? 0 : 1;
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function engagementFrom(
  raw: AmbientFeedItemLike["engagement"],
  id: string,
): WireEngagement | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    const likes = Math.max(0, Math.round(raw));
    return {
      likes,
      reposts: Math.round(likes * (0.08 + 0.14 * unit(id, "rp"))),
      replies: Math.round(likes * (0.015 + 0.05 * unit(id, "re"))),
    };
  }
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.round(v))
      : 0;
  return {
    likes: n(raw.likes),
    reposts: n(raw.reposts ?? raw.shares),
    replies: n(raw.replies),
  };
}

/**
 * Seeded minutes for engine items: the first report of a day lands in the
 * morning, later ones follow at irregular intervals, never past 23:50, and
 * never out of causal order.
 */
function engineMinutes(news: readonly NewsItem[]): number[] {
  const last = new Map<number, number>();
  return news.map((item) => {
    const prev = last.get(item.day);
    const next =
      prev === undefined
        ? 6 * 60 + 40 + pick(item.id, 150, "am")
        : Math.min(23 * 60 + 50, prev + 11 + pick(item.id, 64, "gap"));
    last.set(item.day, next);
    return next;
  });
}

/* ------------------------------------------------------------ adapters */

export function engineNewsToWire(
  news: readonly NewsItem[],
  options: WireNormalizeOptions = {},
): WireItem[] {
  const formatDay =
    options.formatDay ??
    (options.epoch ? calendarFormatter(options.epoch) : defaultFormatDay);
  const minutes = engineMinutes(news);
  const out: WireItem[] = [];
  news.forEach((item, index) => {
    if (!options.includeAppointments && item.id.endsWith(":appointment-news"))
      return;
    const text = tidy(item.headline);
    if (!text) return;
    const outlet = ENGINE_OUTLETS[item.source] ?? ENGINE_OUTLETS.Relay;
    const kind: WireKind =
      item.source === "Authority"
        ? "statement"
        : item.source === "Morrow"
          ? "morrow"
          : "headline";
    const severity = options.severityFor?.(item) ?? inferSeverity(text);
    const topic = options.topicFor?.(item) ?? inferTopic(text);
    const id = `news:${item.id}`;
    const minute = minutes[index]!;
    const wantsThumb =
      kind === "headline" &&
      topic !== "general" &&
      (severity > 0 || unit(id, "thumb") < 0.72);
    out.push({
      id,
      origin: "engine",
      kind,
      severity,
      breaking: kind === "headline" && severity === 2,
      text,
      topic,
      thumbnailTopic: wantsThumb ? topic : null,
      source: {
        id: kind === "statement" ? item.entityId || outlet.id : outlet.id,
        name: outlet.name,
        handle: kind === "morrow" ? "morrow" : null,
        kind: outlet.kind,
        verified: true,
        nationId: null,
      },
      day: item.day,
      minute,
      order: item.day * DAY_MINUTES + minute + index * 1e-4,
      dateLabel: `${formatDay(item.day)} · ${formatClock(minute)}`,
      isBot: false,
      engagement: null,
      causeId: item.causeId || null,
      causeLabel: item.causeId
        ? (options.causeLabel?.(item.causeId) ?? null)
        : null,
      carriedBy:
        severity === 2
          ? 3 + pick(id, 6, "carry")
          : severity === 1
            ? 2 + pick(id, 3, "carry")
            : 1 + pick(id, 2, "carry"),
    });
  });
  return out;
}

export function ambientToWire(
  ambient: readonly AmbientFeedItemLike[],
  options: WireNormalizeOptions = {},
  seqOffset = 0,
  fallbackDay: number | null = null,
): WireItem[] {
  const formatDay =
    options.formatDay ??
    (options.epoch ? calendarFormatter(options.epoch) : defaultFormatDay);
  const out: WireItem[] = [];
  ambient.forEach((raw, index) => {
    if (!raw || typeof raw.id !== "string" || typeof raw.text !== "string")
      return;
    if (raw.kind === "ticker" || raw.kind === "factoid") return;
    const text = tidy(raw.text);
    if (!text) return;
    const id = raw.id;
    const handle = raw.authorHandle ? raw.authorHandle.replace(/^@/, "") : null;
    const morrow = isMorrowId(raw.outletId) || isMorrowId(handle);
    const isBot = Boolean(raw.isBot) && !morrow;
    let kind: WireKind;
    let source: WireSource;
    if (morrow) {
      kind = "morrow";
      source = {
        id: "morrow",
        name: "Morrow",
        handle: "morrow",
        kind: "lab",
        verified: true,
        nationId: null,
      };
    } else if (raw.kind === "post") {
      kind = "post";
      const persona = raw.personaId
        ? options.personas?.[raw.personaId]
        : undefined;
      const h =
        handle ??
        persona?.handle?.replace(/^@/, "") ??
        raw.personaId ??
        `user${pick(id, 90000, "h") + 1000}`;
      source = {
        id: h,
        name: tidy(
          raw.authorName ?? raw.displayName ?? persona?.name ?? titleFromId(h),
        ),
        handle: h,
        kind: "person",
        verified: Boolean(raw.verified),
        nationId: raw.nationId ?? null,
      };
    } else {
      kind = raw.kind === "statement" ? "statement" : "headline";
      const info = outletInfo(
        raw.outletId ?? (kind === "statement" ? "common-rail" : "relay"),
        options.outlets,
        raw.outletName,
      );
      source = {
        id: info.id,
        name: info.name,
        handle: null,
        kind:
          kind === "statement"
            ? info.kind === "outlet"
              ? "official"
              : info.kind
            : info.kind,
        verified: raw.verified ?? info.verified,
        nationId: raw.nationId ?? null,
      };
    }
    const severity: WireSeverity =
      raw.kind === "breaking" ? 2 : clampSeverity(raw.severity);
    const day =
      typeof raw.day === "number" && Number.isFinite(raw.day)
        ? raw.day
        : fallbackDay;
    const parsed = parseClock(raw.dateLabel);
    const minute =
      parsed ?? (day !== null ? 7 * 60 + pick(id, 16 * 60, "amb") : null);
    const dateLabel = raw.dateLabel
      ? tidy(raw.dateLabel)
      : day !== null && minute !== null
        ? `${formatDay(day)} · ${formatClock(minute)}`
        : "";
    const topic = tidy(raw.topic ?? "") || inferTopic(text);
    out.push({
      id,
      origin: "ambient",
      kind,
      severity,
      breaking: kind === "headline" && severity === 2,
      text,
      topic,
      thumbnailTopic: kind === "headline" ? (raw.thumbnailTopic ?? null) : null,
      source,
      day,
      minute,
      order:
        (day ?? 0) * DAY_MINUTES + (minute ?? 0) + (seqOffset + index) * 1e-4,
      dateLabel,
      isBot,
      engagement: kind === "post" ? engagementFrom(raw.engagement, id) : null,
      causeId: null,
      causeLabel: null,
      carriedBy: Math.max(1, Math.round(raw.sharedBy ?? 1)),
    });
  });
  return out;
}

/**
 * The adapter the orchestrator calls. Returns cards newest-first, unique by
 * id, capped at `options.limit`.
 */
export function toWireItems(
  news: readonly NewsItem[],
  ambient: readonly AmbientFeedItemLike[] = [],
  options: WireNormalizeOptions = {},
): WireItem[] {
  const lastEngineDay = news.length ? news[news.length - 1]!.day : null;
  const fallbackDay = options.today ?? lastEngineDay;
  const merged = [
    ...engineNewsToWire(news, options),
    ...ambientToWire(ambient, options, news.length, fallbackDay),
  ];
  const seen = new Set<string>();
  const unique: WireItem[] = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  unique.sort(
    (a, b) => b.order - a.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return unique.slice(0, Math.max(1, options.limit ?? 160));
}

/* --------------------------------------------------------- ticker/factoid */

/** Trim, collapse whitespace, drop trailing full stops, dedupe (case-insensitive). */
export function normalizeTickerLines(
  lines: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    if (typeof raw !== "string") continue;
    const line = tidy(raw).replace(/[.。]+$/, "");
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** The single accessible string the marquee stands for. */
export function tickerText(
  lines: readonly (string | null | undefined)[],
): string {
  return normalizeTickerLines(lines).join(" · ");
}

/**
 * Ticker lines: the ambient layer's own ticker items (latest last), topped up
 * with the newest headlines so the strip is never empty once there is news.
 */
export function wireTickerLines(
  ambient: readonly AmbientFeedItemLike[],
  items: readonly WireItem[],
  max = 14,
): string[] {
  const own = ambient
    .filter((a) => a && a.kind === "ticker")
    .map((a) => a.text);
  const lines = normalizeTickerLines(own.slice(-max).reverse());
  if (lines.length < 6) {
    const headlines = [...items]
      .sort((a, b) => b.order - a.order)
      .filter((i) => i.kind === "headline" || i.kind === "statement")
      .map((i) => (i.breaking ? `Breaking: ${i.text}` : i.text));
    return normalizeTickerLines([...lines, ...headlines]).slice(
      0,
      Math.max(6, Math.min(max, 8)),
    );
  }
  return lines.slice(0, max);
}

export function wireFactoid(
  ambient: readonly AmbientFeedItemLike[],
): string | null {
  for (let i = ambient.length - 1; i >= 0; i--) {
    const a = ambient[i];
    if (
      a &&
      a.kind === "factoid" &&
      typeof a.text === "string" &&
      a.text.trim()
    )
      return tidy(a.text);
  }
  return null;
}

/** Convenience: everything but the motion flags. */
export function toWireView(
  news: readonly NewsItem[],
  ambient: readonly AmbientFeedItemLike[],
  options: WireNormalizeOptions & {
    stage: number;
    botSaturation: number;
    reducedMotion: boolean;
    readIds?: readonly string[];
    variant?: WireView["variant"];
  },
): WireView {
  const items = toWireItems(news, ambient, options);
  return {
    items,
    ticker: wireTickerLines(ambient, items),
    factoid: wireFactoid(ambient),
    reducedMotion: options.reducedMotion,
    stage: options.stage,
    botSaturation: options.botSaturation,
    today:
      options.today ??
      (items.length ? Math.max(...items.map((i) => i.day ?? 0)) : null),
    readIds: options.readIds,
    variant: options.variant,
  };
}
