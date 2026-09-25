/**
 * Words the cards show: hover/focus detail lines, counts, references.
 * Pure; the numbers are seeded from ids so they never flicker.
 */
import { pick, unit } from "./hash.ts";
import { formatClock, parseClock, relativeAge } from "./normalize.ts";
import { saturationLevels, type WireEntry } from "./saturation.ts";

export function formatCompact(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  if (v < 10000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (v < 1_000_000) return `${Math.round(v / 1000)}K`;
  if (v < 10_000_000)
    return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `${Math.round(v / 1_000_000)}M`;
}

export function formatCount(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("en-US");
}

/** "REF CRA-0142": a notice number that only goes up. */
export function noticeRef(entry: WireEntry): string {
  const prefix =
    entry.item.source.id === "common-rail"
      ? "CRA"
      : entry.item.source.name
          .replace(/[^A-Za-z]/g, "")
          .slice(0, 3)
          .toUpperCase() || "REF";
  const serial = (entry.item.day ?? 0) * 3 + 100 + pick(entry.key, 3, "ref");
  return `${prefix}-${String(serial).padStart(4, "0")}`;
}

export function similarLabel(n: number): string {
  return n === 1 ? "and 1 similar post" : `and ${formatCount(n)} similar posts`;
}

/**
 * The line revealed on hover / focus / tap. Always present in the DOM (and
 * wired to aria-describedby), so nothing depends on seeing the reveal.
 */
export function detailLine(
  entry: WireEntry,
  today: number | null,
  botSaturation: number,
): string {
  const item = entry.item;
  const age = relativeAge(item.day, today);
  const parts: string[] = [];
  const lv = saturationLevels(botSaturation);
  switch (item.kind) {
    case "headline": {
      parts.push(`Via ${item.source.name}`);
      if (age) parts.push(age);
      if (entry.alsoCarriedBy.length)
        parts.push(
          `also ${entry.alsoCarriedBy.slice(0, 2).join(", ")}${entry.alsoCarriedBy.length > 2 ? ` +${entry.alsoCarriedBy.length - 2}` : ""}`,
        );
      else if (item.carriedBy > 1)
        parts.push(`carried by ${item.carriedBy} outlets`);
      else parts.push("single source");
      break;
    }
    case "statement": {
      parts.push(item.source.name);
      parts.push(`Ref. ${noticeRef(entry)}`);
      if (age) parts.push(age);
      break;
    }
    case "morrow": {
      parts.push("Morrow, the Vela assistant");
      if (age) parts.push(age);
      parts.push("automated notice");
      break;
    }
    case "post": {
      if (entry.thinned) {
        parts.push("Account deactivated");
        if (age) parts.push(age);
        parts.push("post unavailable");
        break;
      }
      if (item.source.handle) parts.push(`@${item.source.handle}`);
      if (age) parts.push(age);
      const automated = item.isBot || entry.members.length > 1;
      if (automated && entry.similar > 0) {
        parts.push(`same text from ${formatCount(entry.similar + 1)} accounts`);
      }
      if (item.isBot) {
        const ageDays = 1 + pick(entry.key, 9, "acct");
        parts.push(`account ${ageDays} day${ageDays === 1 ? "" : "s"} old`);
        if (lv.time > 0.4)
          parts.push(`posts every ${12 + pick(entry.key, 50, "cad")} s`);
      } else {
        const years = 1 + pick(entry.key, 11, "acct");
        parts.push(`on the network ${years} year${years === 1 ? "" : "s"}`);
      }
      break;
    }
  }
  if (item.causeLabel) parts.push(item.causeLabel);
  return parts.join(" · ");
}

/**
 * The compact stamp a social post shows: its clock today, "3d" / "2mo" / "4y"
 * otherwise. A collapsed timestamp always shows the flood minute, because the
 * point is that everything happened at once.
 */
export function postStamp(entry: WireEntry, today: number | null): string {
  const clock = parseClock(entry.dateLabel);
  if (entry.collapsedTime && clock !== null) return formatClock(clock);
  const day = entry.item.day;
  if (day === null || today === null || today - day <= 0)
    return clock !== null ? formatClock(clock) : entry.dateLabel;
  const d = Math.floor(today - day);
  if (d < 45) return `${d}d`;
  if (d < 365) return `${Math.max(1, Math.round(d / 30.4))}mo`;
  return `${Math.max(1, Math.round(d / 365))}y`;
}

/** Seeded mini-avatars for a pile ("and 214 similar posts"). */
export function stackHandles(entry: WireEntry, count = 4): string[] {
  return Array.from(
    { length: count },
    (_, i) =>
      `${entry.key}:copy:${i}:${Math.floor(unit(entry.key, `c${i}`) * 1e6)}`,
  );
}
