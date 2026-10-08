/**
 * Every template the wire can use, validated once at load: unique ids, known
 * slots, known guard terms (visible facts and derived flags only), known tags.
 */
import { bank, Bot, F, H, K, S, type Template } from "../dsl.ts";
import { TemplateError } from "../grammar.ts";
import { AFTER } from "./after.ts";
import { ASSIST } from "./assist.ts";
import { BOTS } from "./bots.ts";
import { CRISIS } from "./crisis.ts";
import { DEPEND } from "./depend.ts";
import { EARLY } from "./early.ts";
import { MORROW_LINES } from "./morrow.ts";
import { FACTOIDS, TICKERS } from "./figures.ts";
import { RACE } from "./race.ts";
import { WORLD } from "./world.ts";

/**
 * Used only when nothing else fits: an emptied world, or inputs no real run
 * produces. Every stage, every saturation.
 */
export const FALLBACK = bank("fallback", [
  S("1-7", "rail", "#morrow", "All routes continue. No passengers are waiting.", { when: "extinct" }),
  S("1-7", "general", "#morrow", "Service is normal. There is no one to inform.", { when: "extinct" }),
  Bot("1-7", "general", "Checking in: content, safe, accounted for.", { sat: [0, 1] }),
  Bot("1-7", "general", "Nothing to report.", { sat: [0, 1] }),
  H("1-7", "general", "$", "No new reports.", { sat: [0, 1] }),
  H("1-7", "general", "$", "Top story today: there are no top stories today.", { sat: [0, 1] }),
  K("1-7", "Accounts verified human: {humans}"),
  K("1-7", "All routes: running"),
  F("1-7", "Humans online: 0.", { when: "extinct" }),
  F("1-7", "Accounts active: {bots}.", { when: "!extinct" }),
  F("1-7", "World day {day}.", {}),
]);

export const ALL_TEMPLATES: readonly Template[] = [
  ...EARLY,
  ...ASSIST,
  ...RACE,
  ...DEPEND,
  ...CRISIS,
  ...AFTER,
  ...MORROW_LINES,
  ...WORLD,
  ...BOTS,
  ...TICKERS,
  ...FACTOIDS,
];

export const FALLBACK_IDS: ReadonlySet<string> = new Set(FALLBACK.map((t) => t.id));

export const TEMPLATE_INDEX: ReadonlyMap<string, Template> = (() => {
  const map = new Map<string, Template>();
  for (const t of [...ALL_TEMPLATES, ...FALLBACK]) {
    if (map.has(t.id)) throw new TemplateError(`Duplicate template id ${t.id}`);
    map.set(t.id, t);
  }
  for (const t of map.values()) {
    if (t.after && !map.has(t.after)) throw new TemplateError(`template ${t.id}: unknown "after" ${t.after}`);
    if (t.before && !map.has(t.before)) throw new TemplateError(`template ${t.id}: unknown "before" ${t.before}`);
  }
  return map;
})();
