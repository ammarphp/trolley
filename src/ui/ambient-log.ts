/**
 * The ambient wire across a run: the fictional world's news and posts,
 * generated deterministically per decision from the run seed and the state
 * visible at that decision. Presentation only; it never reaches the journal.
 */
import type { Campaign } from "../contracts/index.ts";
import type { AmbientFeedItemLike } from "./components/wire/types.ts";

export interface AmbientLog {
  runId: string;
  items: AmbientFeedItemLike[];
  upTo: number;
}

import { ambientGenerator } from "./wire/index.ts";

type Generator = (c: Campaign, ordinal: number) => AmbientFeedItemLike[];
let generator: Generator | null = ambientGenerator as Generator;

/** Install the ambient generator (src/ui/wire). */
export function setAmbientGenerator(g: Generator): void {
  generator = g;
}

export function ambientFor(log: AmbientLog, c: Campaign): AmbientFeedItemLike[] {
  if (log.runId !== c.seed) {
    log.runId = c.seed;
    log.items = [];
    log.upTo = 0;
  }
  const ordinal = c.journal.length + (c.prepared ? 1 : 0);
  if (generator) {
    for (let o = log.upTo + 1; o <= ordinal; o++) log.items.push(...generator(c, o));
  }
  log.upTo = Math.max(log.upTo, ordinal);
  return log.items;
}

export { botSaturationForCampaign as botSaturationFor, tickerForCampaign, factoidForCampaign } from "./wire/index.ts";
