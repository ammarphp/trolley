/**
 * Bot saturation, as layout.
 *
 * The feed never says "the bots have won". It shows it, in five ways that are
 * each subtle at 0.3 and unmistakable at 0.9:
 *   1. faces collapse to the same blank avatar,
 *   2. timestamps collapse to the same minute,
 *   3. identical phrasing piles up ("and 214 similar posts"),
 *   4. verification badges spread to everything,
 *   5. independent voices thin out (their posts become tombstones).
 *
 * Pure and deterministic: which item is affected first is seeded by its id.
 */
import { clamp01, pick, smoothstep, unit } from "./hash.ts";
import { formatClock, withClock } from "./normalize.ts";
import type { WireItem } from "./types.ts";

export interface WireEntry {
  /** Stable DOM key: the id of the group's earliest member. */
  key: string;
  /** The face shown: the newest member. */
  item: WireItem;
  /** All member ids, newest first. */
  members: string[];
  /** "and N similar posts" (0: no line). */
  similar: number;
  /** Other outlets carrying the same headline. */
  alsoCarriedBy: string[];
  /** Independent voice removed: render as a tombstone. */
  thinned: boolean;
  /** Face replaced by the shared blank avatar. */
  collapsedAvatar: boolean;
  /** The dateline after timestamp collapse (or the original). */
  dateLabel: string;
  /** True when the dateline shows the flood minute rather than its own. */
  collapsedTime: boolean;
  verified: boolean;
  /** Newest member's order, for sorting. */
  order: number;
}

export interface SaturationLevels {
  avatar: number;
  time: number;
  verify: number;
  thin: number;
  fuzzy: boolean;
  flood: number;
}

/** The dials, derived from one number. Exposed for tests and the lab. */
export function saturationLevels(botSaturation: number): SaturationLevels {
  const s = clamp01(botSaturation);
  return {
    avatar: smoothstep(0.08, 0.8, s),
    time: smoothstep(0.12, 0.75, s),
    verify: smoothstep(0.04, 0.75, s),
    thin: clamp01((s - 0.27) / 0.63) * 0.8,
    fuzzy: s >= 0.5,
    flood: clamp01((s - 0.25) / 0.65),
  };
}

/** Lowercase, drop urls, mentions, digits, punctuation and emoji. */
export function phraseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[\w.]+/g, " ")
    .replace(/#/g, " ")
    .replace(/[\d]+/g, " ")
    .replace(/[^\p{L}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(key: string): Set<string> {
  return new Set(key.split(" ").filter((w) => w.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Group posts (by phrasing) and headlines (by story), newest group first. */
function groupItems(items: readonly WireItem[], fuzzy: boolean): WireItem[][] {
  const sorted = [...items].sort(
    (a, b) => b.order - a.order || (a.id < b.id ? -1 : 1),
  );
  const groups: {
    lead: WireItem;
    members: WireItem[];
    key: string;
    toks: Set<string> | null;
  }[] = [];
  const exact = new Map<string, (typeof groups)[number]>();
  for (const item of sorted) {
    const phrase = phraseKey(item.text);
    const family =
      item.kind === "post"
        ? "post"
        : item.kind === "headline"
          ? "headline"
          : null;
    if (!family || !phrase) {
      groups.push({ lead: item, members: [item], key: "", toks: null });
      continue;
    }
    const key = `${family}|${phrase}`;
    const hit = exact.get(key);
    if (hit) {
      hit.members.push(item);
      continue;
    }
    if (fuzzy && family === "post" && item.isBot) {
      const toks = tokens(phrase);
      const near = groups.find(
        (g) =>
          g.toks &&
          g.lead.kind === "post" &&
          g.lead.isBot &&
          jaccard(g.toks, toks) >= 0.72,
      );
      if (near) {
        near.members.push(item);
        continue;
      }
      const group = { lead: item, members: [item], key, toks };
      groups.push(group);
      exact.set(key, group);
      continue;
    }
    const group = {
      lead: item,
      members: [item],
      key,
      toks: family === "post" && item.isBot ? tokens(phrase) : null,
    };
    groups.push(group);
    exact.set(key, group);
  }
  return groups.map((g) => g.members);
}

/**
 * Build the entries the renderer draws. `items` may be in any order; entries
 * come back newest-first.
 */
export function buildWireEntries(
  items: readonly WireItem[],
  botSaturation: number,
): WireEntry[] {
  const lv = saturationLevels(botSaturation);
  const groups = groupItems(items, lv.fuzzy);

  // The flood minute: the newest automated post's minute. Everything that
  // collapses shows this minute.
  let floodMinute: number | null = null;
  let floodOrder = -Infinity;
  for (const item of items) {
    if (
      item.kind === "post" &&
      item.isBot &&
      item.minute !== null &&
      item.order > floodOrder
    ) {
      floodOrder = item.order;
      floodMinute = item.minute;
    }
  }

  const entries: WireEntry[] = groups.map((members) => {
    const face = members[0]!;
    const earliest = members[members.length - 1]!;
    const key = earliest.id;
    const isPost = face.kind === "post";
    const automated = isPost && members.some((m) => m.isBot);

    const thinned =
      isPost &&
      !face.isBot &&
      members.length === 1 &&
      unit(face.id, "thin") < lv.thin;

    const collapsedAvatar = automated && unit(key, "avatar") < lv.avatar;

    let dateLabel = face.dateLabel;
    let collapsedTime = false;
    if (automated && floodMinute !== null && unit(key, "time") < lv.time) {
      dateLabel = withClock(
        face.dateLabel || formatClock(floodMinute),
        floodMinute,
      );
      collapsedTime = true;
    }

    const verified =
      face.source.verified ||
      (isPost && !thinned && unit(key, "verify") < lv.verify);

    let similar = members.length - 1;
    if (
      automated &&
      lv.flood > 0 &&
      unit(key, "flood") < 0.35 + lv.flood * 0.65
    ) {
      // The visible copies are a sample; the flood behind them is larger.
      similar += Math.round(
        lv.flood * lv.flood * (60 + pick(key, 520, "flood-n")),
      );
    }

    const alsoCarriedBy =
      face.kind === "headline"
        ? [...new Set(members.slice(1).map((m) => m.source.name))].filter(
            (n) => n !== face.source.name,
          )
        : [];

    return {
      key,
      item: face,
      members: members.map((m) => m.id),
      similar,
      alsoCarriedBy,
      thinned,
      collapsedAvatar,
      dateLabel,
      collapsedTime,
      verified,
      order: face.order,
    };
  });
  entries.sort((a, b) => b.order - a.order || (a.key < b.key ? -1 : 1));
  return entries;
}

/** Everything the counter in the header represents, flood included. */
export function representedCount(entries: readonly WireEntry[]): number {
  let n = 0;
  for (const e of entries) n += 1 + e.similar;
  return n;
}
