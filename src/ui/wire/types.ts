/**
 * The ambient wire's public shapes. Presentation only: nothing here feeds the
 * simulation, the journal or telemetry.
 *
 * A FeedItem is assignable to the wire component's AmbientFeedItemLike
 * (src/ui/components/wire/types.ts); the optional extras (outletName,
 * authorName, verified, day, minute, sharedBy) are fields that adapter reads.
 */

export type FeedKind = "headline" | "post" | "statement" | "ticker" | "breaking" | "factoid";

/** Desk labels. These match the wire component's thumbnail motifs. */
export type Topic =
  | "rail"
  | "markets"
  | "datacenter"
  | "lab"
  | "health"
  | "grid"
  | "security"
  | "civic"
  | "labor"
  | "disaster"
  | "science"
  | "food"
  | "general";

export const TOPICS: readonly Topic[] = [
  "rail",
  "markets",
  "datacenter",
  "lab",
  "health",
  "grid",
  "security",
  "civic",
  "labor",
  "disaster",
  "science",
  "food",
  "general",
];

export interface Engagement {
  replies: number;
  reposts: number;
  likes: number;
}

export type Severity = 0 | 1 | 2;

export interface FeedItem {
  /** Unique within a run and stable for (seed, ordinal). */
  id: string;
  kind: FeedKind;
  /** Issuing outlet, lab, office or bot site (bible ids where they exist). */
  outletId?: string;
  outletName?: string;
  /** Social handle without "@". */
  authorHandle?: string;
  authorName?: string;
  /** Bible persona id (src/ui/brand/entities.ts PERSONAS) when the author is a recurring character. */
  personaId?: string;
  /** Bible nation id for statements and flags. */
  nationId?: string;
  verified?: boolean;
  topic: Topic;
  text: string;
  /** "DAY 213 · 09:42" by default; see AmbientInput.formatDay. */
  dateLabel: string;
  /** World day (0-based) and minute of day, so the wire can order and date cards. */
  day: number;
  minute: number;
  isBot: boolean;
  engagement?: Engagement;
  thumbnailTopic?: Topic;
  severity: Severity;
  /** How many outlets or accounts carry the same item (>= 1). */
  sharedBy?: number;
  /** The template that produced the item. Used for history and tests. */
  templateId: string;
  /** For synchronized posts: the id of the item they repeat. */
  echoOf?: string;
}

export interface AmbientMetrics {
  gdp: number;
  capability: number;
  casualties: number;
  population: number;
  care: number;
  food: number;
  power: number;
}

export interface EngineNewsLine {
  headline: string;
  source: string;
}

export interface AmbientInput {
  /** Run seed. */
  seed: string;
  /** 1-based decision ordinal this step belongs to. */
  ordinal: number;
  /** Campaign stage 1..7. */
  stage: number;
  /** World day (0-based) at this decision. */
  day: number;
  /**
   * Engine facts. Only the visible allowlist (VISIBLE_FACTS) is ever read;
   * hidden facts may be present and are never touched.
   */
  facts: Readonly<Record<string, boolean | undefined>>;
  /** The readings the player can see (observations), not privileged truth. */
  metrics: AmbientMetrics;
  /** Effective controller per scope: "human" | "assistant" | "institution". */
  control: Readonly<Record<string, string | undefined>>;
  /** Engine headlines published since the previous step. */
  lastEngineHeadlines: readonly string[];
  /* ---------------------------------------------------- optional extras */
  /** World day at the previous step; items spread over (previousDay, day]. */
  previousDay?: number;
  /** Engine news since the previous step, with sources (to echo Morrow). */
  lastEngineNews?: readonly EngineNewsLine[];
  /** Template ids already used in this run (see ambientRun). Enforces no repeats. */
  recentTemplateIds?: readonly string[];
  /** Dateline formatter. Default: "DAY {day + 1}". */
  formatDay?: (day: number) => string;
}

/** The three engine facts the player cannot see. Never read by this module. */
export const HIDDEN_FACTS = ["goalMismatch", "evidenceHidden", "reportAltered"] as const;

/**
 * Every engine fact the player can see. Kept literal (not imported from the
 * zod contract) so the UI bundle does not pull in the schema; a test checks
 * it against contracts' Fact enum minus HIDDEN_FACTS.
 */
export const VISIBLE_FACTS = [
  "firstDeath",
  "assistance",
  "benefit",
  "clinicalTool",
  "verifiedScience",
  "manualStaff",
  "recoveryPracticed",
  "independentReview",
  "reviewOverloaded",
  "sharedReviewer",
  "scopeChanged",
  "evaluationExpired",
  "fixedFlaw",
  "successorResearch",
  "successorDeployment",
  "networkAccess",
  "toolAccess",
  "rewardProxy",
  "rivalRace",
  "coordination",
  "agreementVerified",
  "externalDefection",
  "essentialDependence",
  "fallbackLost",
  "appealRight",
  "publicRecords",
  "renewalRequired",
  "delegation",
  "authorityLost",
  "shutdownAttempted",
  "containment",
  "repression",
  "remnant",
  "succession",
  "catastrophe",
  "restraint",
  "trainedSuccessor",
  "returnAuthority",
  "powerReturned",
  "researchStopped",
  "terminalSettlement",
  "successionRatified",
  "beneficiarySeen",
  "beneficiaryReturned",
  "repair",
  "selfCertification",
  "labClosed",
  "unrest",
  "extinction",
] as const;

export type VisibleFact = (typeof VISIBLE_FACTS)[number];

export const SCOPES = ["rail", "dispatch", "care", "power", "food", "research", "governance", "recovery"] as const;
export type ControlScope = (typeof SCOPES)[number];
