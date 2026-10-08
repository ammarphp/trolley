/**
 * The ambient news wire: a living fictional feed that thickens, then
 * automates, as the run goes on. See ambient.ts for the contract.
 */
export { ambientFeed, ambientRun, factoid, factoidEntry, botSaturation, setAmbientStrict } from "./ambient.ts";
export { ambientGenerator, ambientHistory, ambientInputFor, botSaturationForCampaign, factoidForCampaign, ordinalOf, setAmbientDayFormat, tickerForCampaign } from "./campaign.ts";
export { WIRE_EXTRAS, BOT_OUTLETS, EXTRA_PERSONAS, GOVERNMENT_NAMES } from "./cast.ts";
export { HIDDEN_FACTS, VISIBLE_FACTS, TOPICS } from "./types.ts";
export type { AmbientInput, AmbientMetrics, EngineNewsLine, Engagement, FeedItem, FeedKind, Severity, Topic } from "./types.ts";
export type { Branch } from "./world.ts";
