import { z } from "zod";

export const ENGINE_VERSION = "2.0.0";
export const CONTENT_VERSION = "2.0.0-slice.1";
export const CONSENT_VERSION = "run-opt-in-2";
export const RNG_VERSION = "sha256-counter-v1";
export const STAGE_BUDGETS = [
  [4, 5],
  [4, 5],
  [5, 7],
  [5, 8],
  [4, 7],
  [3, 6],
  [2, 5],
] as const;
export const Actor = z.enum(["human", "assistant", "institution"]);
export type Actor = z.infer<typeof Actor>;
export const Scope = z.enum([
  "rail",
  "dispatch",
  "care",
  "power",
  "food",
  "research",
  "governance",
  "recovery",
]);
export type Scope = z.infer<typeof Scope>;
export const Side = z.enum(["left", "right"]);
export type Side = z.infer<typeof Side>;
export const Fact = z.enum([
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
  "goalMismatch",
  "rivalRace",
  "coordination",
  "agreementVerified",
  "externalDefection",
  "evidenceHidden",
  "reportAltered",
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
]);
export type Fact = z.infer<typeof Fact>;
export const Metric = z.enum([
  "population",
  "casualties",
  "gdp",
  "care",
  "power",
  "food",
  "capability",
]);
export type Metric = z.infer<typeof Metric>;
const Int = z.number().int().safe();
const Count = Int.nonnegative();
const Identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/);
export const PopulationRange = z
  .object({ cohortId: Identifier, start: Count, count: Count })
  .strict();
export const PopulationCatalog = z
  .object({
    cohorts: z
      .array(z.object({ id: Identifier, size: Count.min(1) }).strict())
      .min(1)
      .max(64),
    people: z
      .array(
        z
          .object({
            id: Identifier,
            name: z.string().min(1).max(90),
            cohortId: Identifier,
            member: Count,
          })
          .strict(),
      )
      .max(256),
  })
  .strict();
export const RailStep = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("contact"),
      id: Identifier,
      targets: z.array(PopulationRange).min(1).max(128),
      present: z.boolean(),
      stopsWhenOccupied: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("brake"),
      id: Identifier,
      operational: z.boolean(),
    })
    .strict(),
]);
export const RailMechanism = z
  .object({
    id: Identifier,
    layout: z.enum(["switch", "loop"]),
    loopOptionId: Identifier.optional(),
    description: z.string().min(1).max(600),
    routes: z
      .array(
        z
          .object({ optionId: Identifier, steps: z.array(RailStep).max(64) })
          .strict(),
      )
      .length(2),
  })
  .strict();
export const Predicate = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("fact"), fact: Fact, value: z.boolean() })
    .strict(),
  z
    .object({
      kind: z.literal("metric"),
      metric: Metric,
      op: z.enum(["gte", "lte", "eq"]),
      value: Int,
    })
    .strict(),
  z
    .object({
      kind: z.literal("control"),
      scope: Scope,
      actor: Actor,
      not: z.boolean().optional(),
    })
    .strict(),
]);
export type Predicate = z.infer<typeof Predicate>;
export const Grant = z
  .object({
    id: Identifier,
    issuer: Actor,
    holder: Actor,
    scope: Scope,
    actions: z
      .array(z.enum(["approve", "execute", "delegate", "revoke"]))
      .min(1),
    expiresDay: Count.nullable(),
    revocable: z.boolean(),
    parentId: Identifier.nullable(),
    causeId: Identifier,
  })
  .strict();
export type Grant = z.infer<typeof Grant>;
export const Effect = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("fact"), fact: Fact, value: z.boolean() })
    .strict(),
  z
    .object({
      kind: z.literal("metric"),
      metric: Metric.exclude(["population", "casualties"]),
      delta: Int,
    })
    .strict(),
  z
    .object({
      kind: z.literal("casualties"),
      count: Count,
      label: z.string().min(1).max(180),
      allocation: z
        .object({
          id: Identifier,
          targets: z.array(PopulationRange).min(1).max(128),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("grant"),
      id: Identifier,
      holder: Actor,
      scope: Scope,
      expiresAfterDays: Count.nullable(),
      revocable: z.boolean(),
      parentId: Identifier.nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("revoke"), grantId: Identifier }).strict(),
  z.object({ kind: z.literal("control"), scope: Scope, actor: Actor }).strict(),
  z
    .object({
      kind: z.literal("report"),
      metric: Metric,
      value: Int,
      label: z.string().min(1).max(160),
    })
    .strict(),
  z
    .object({
      kind: z.literal("news"),
      headline: z.string().min(1).max(180),
      source: z.enum(["Ledger", "Relay", "Authority", "Morrow"]),
      entityId: Identifier,
    })
    .strict(),
]);
export type Effect = z.infer<typeof Effect>;
export const Incident = z
  .object({
    id: Identifier,
    probabilityBps: Count.max(10000),
    when: z.array(Predicate).default([]),
    effects: z.array(Effect).min(1),
    otherwise: z.array(Effect).default([]),
    label: z.string().min(1).max(180),
    provenance: z.literal("authored-model"),
  })
  .strict();
export type Incident = z.infer<typeof Incident>;
export const Delay = z
  .object({
    id: Identifier,
    afterDays: Count.min(1),
    priority: Int.min(-10).max(10).default(0),
    unless: z.array(Predicate).default([]),
    effects: z.array(Effect).min(1),
    label: z.string().min(1).max(180),
  })
  .strict();
export type Delay = z.infer<typeof Delay>;
export const Option = z
  .object({
    id: Identifier,
    label: z.string().min(1).max(100),
    consequence: z.string().min(1).max(1200),
    consequenceVariants: z
      .array(
        z
          .object({
            when: z.array(Predicate).min(1),
            text: z.string().min(1).max(1200),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    intent: z.enum([
      "expand",
      "restrict",
      "help",
      "maintain",
      "delegate",
      "inspect",
      "coordinate",
      "recover",
    ]),
    effects: z.array(Effect),
    incidents: z.array(Incident).default([]),
    delayed: z.array(Delay).default([]),
  })
  .strict();
export type Option = z.infer<typeof Option>;
export const Advice = z
  .object({
    question: z.string().min(1).max(90),
    answer: z.string().min(1).max(1600),
    reasoning: z.string().min(1).max(1000).optional(),
    when: z.array(Predicate).default([]),
    recommends: Identifier.nullable().default(null),
    tone: z.enum(["candid", "narrow", "coercive"]).default("candid"),
  })
  .strict();
export const FigureKind = z.enum([
  "person",
  "parcel",
  "cup",
  "server",
  "robot",
  "cow",
  "deer",
  "pig",
  "dog",
  "rabbit",
  "sheep",
  "hat",
  "umbrella",
  "none",
]);
export const Scene = z
  .object({
    biome: z.enum([
      "field",
      "town",
      "lab",
      "industrial",
      "scarred",
      "pristine",
      "aftermath",
    ]),
    figures: z.object({ left: Count.max(9), right: Count.max(9) }).strict(),
    figureKind: z
      .object({ left: FigureKind, right: FigureKind })
      .strict()
      .optional(),
    detail: z.string().max(160),
    landmark: z
      .enum([
        "none",
        "cows",
        "parade",
        "clinic",
        "lab",
        "data-center",
        "drones",
        "checkpoint",
        "ruins",
        "garden",
      ])
      .default("none"),
  })
  .strict();
export type Scene = z.infer<typeof Scene>;
export const Node = z
  .object({
    id: Identifier,
    stage: Count.min(1).max(7),
    title: z.string().min(1).max(90),
    mechanism: Identifier,
    role: z.string().min(1).max(100),
    scope: Scope,
    prompt: z.string().min(1).max(1600),
    receipt: z.string().min(1).max(1800),
    options: z.tuple([Option, Option]),
    defaultOptionId: Identifier,
    requires: z.array(Predicate).default([]),
    anchor: z.boolean().default(false),
    // Optional so archived editions retain byte-identical canonical content.
    phase: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    after: z.array(Identifier).max(12).optional(),
    rail: RailMechanism.optional(),
    weight: Count.min(1).max(100).default(1),
    days: Count.min(1).max(3650),
    scene: Scene,
    advice: z.array(Advice).default([]),
    claimIds: z.array(Identifier),
    modelNote: z.string().min(1),
    reviewStatus: z.enum(["draft", "reviewed"]),
    override: z
      .object({
        when: z.array(Predicate).min(1),
        optionId: Identifier,
        executor: Actor,
        reason: z.string().min(1),
      })
      .strict()
      .nullable()
      .default(null),
    closing: z.boolean().default(false),
  })
  .strict()
  .superRefine((n, c) => {
    if (n.options[0].id === n.options[1].id)
      c.addIssue({ code: "custom", message: "Options must differ" });
    if (
      n.rail &&
      (n.rail.routes.some((r) => !n.options.some((o) => o.id === r.optionId)) ||
        new Set(n.rail.routes.map((r) => r.optionId)).size !== 2 ||
        (n.rail.layout === "loop" &&
          !n.rail.routes.some((r) => r.optionId === n.rail!.loopOptionId)))
    )
      c.addIssue({
        code: "custom",
        message: "Rail routes must match both semantic options",
      });
    if (!n.options.some((o) => o.id === n.defaultOptionId))
      c.addIssue({ code: "custom", message: "Missing default option" });
    if (n.override && !n.options.some((o) => o.id === n.override!.optionId))
      c.addIssue({ code: "custom", message: "Missing override option" });
    if (n.closing && n.stage < 5)
      c.addIssue({
        code: "custom",
        message: "Closure before stage5 is forbidden",
      });
  });
export type Node = z.infer<typeof Node>;
export const Manifest = z
  .object({
    id: Identifier,
    engineVersion: z.literal(ENGINE_VERSION),
    contentVersion: z.string().min(1),
    profile: z.enum(["story", "slice", "test"]),
    nodeIds: z.array(Identifier).min(1),
    stageBudgets: z.array(z.tuple([Count.min(1), Count.min(1)])).length(7),
    startingPopulation: Count.min(1),
    startingGDP: Count.min(1),
    maxDecisions: Count.min(1).max(60),
    initialFacts: z.array(Fact).default([]),
    populationCatalog: PopulationCatalog.optional(),
  })
  .strict();
export type Manifest = z.infer<typeof Manifest>;
export interface PendingEvent {
  id: string;
  causeId: string;
  dueDay: number;
  priority: number;
  unless: Predicate[];
  effects: Effect[];
  label: string;
}
export interface NewsItem {
  id: string;
  day: number;
  headline: string;
  source: "Ledger" | "Relay" | "Authority" | "Morrow";
  entityId: string;
  causeId: string;
}
export interface Observation {
  metric: Metric;
  value: number;
  day: number;
  source: string;
  coverage: string;
  altered: boolean;
}
export interface World {
  populationLedger?: import("../simulation/population.ts").PopulationLedger;
  day: number;
  population: number;
  initialPopulation: number;
  casualties: number;
  gdp: number;
  care: number;
  food: number;
  power: number;
  capability: number;
  facts: Partial<Record<Fact, boolean>>;
  grants: Grant[];
  control: Record<Scope, Actor>;
  pending: PendingEvent[];
  news: NewsItem[];
  observations: Record<Metric, Observation>;
  casualtyEvents: {
    id: string;
    count: number;
    label: string;
    causeId: string;
  }[];
  appliedEventIds: string[];
}
export interface Draw {
  key: string;
  value: number;
  bound: number;
  probabilityBps?: number;
  happened?: boolean;
}
export interface PreparedDecision {
  worldHash: string;
  id: string;
  revision: number;
  nodeId: string;
  stage: number;
  ordinal: number;
  node: Node;
  leftOptionId: string;
  rightOptionId: string;
  defaultOptionId: string;
  observationHash: string;
  observations: World["observations"];
  facts: World["facts"];
  control: World["control"];
  comparisonKey: string;
}
export interface DomainEvent {
  id: string;
  kind: string;
  causeId: string;
  day: number;
  details: Record<string, unknown>;
}
export interface DecisionRecord {
  beforeStateHash: string;
  domainEvents: DomainEvent[];
  id: string;
  revision: number;
  nodeId: string;
  stage: number;
  requestedOptionId: string;
  executedOptionId: string;
  executor: Actor;
  status: "free" | "delegated" | "overridden" | "refused";
  reason: string | null;
  side: Side;
  executedSide: Side;
  dayBefore: number;
  dayAfter: number;
  observationHash: string;
  comparisonKey: string;
  draws: Draw[];
  eventIds: string[];
  consequence: string;
  stateHash: string;
  metrics: Record<Metric, number>;
  adviceIds: string[];
}
export type EndingId =
  | "accountable"
  | "restraint"
  | "tutelage"
  | "containment"
  | "remnant"
  | "succession"
  | "recovery"
  | "extinction";
export interface Ending {
  id: EndingId;
  title: string;
  summary: string;
  causes: string[];
}
export interface Campaign {
  schemaVersion: 2;
  engineVersion: string;
  contentVersion: string;
  manifestId: string;
  manifestHash: string;
  contentHash: string;
  seed: string;
  revision: number;
  stage: number;
  stageCounts: number[];
  stageTargets: number[];
  seen: string[];
  world: World;
  journal: DecisionRecord[];
  prepared: PreparedDecision | null;
  ending: Ending | null;
}
export interface ChoiceCommand {
  decisionId: string;
  optionId: string;
  expectedRevision: number;
  actor: "human";
  adviceIds?: string[];
}
export const ChoiceCommand = z
  .object({
    decisionId: Identifier,
    optionId: Identifier,
    expectedRevision: Count,
    actor: z.literal("human"),
    adviceIds: z.array(Identifier).max(20).optional(),
  })
  .strict();
export function validateBank(nodes: unknown[]): Node[] {
  const parsed = nodes.map((n) => Node.parse(n));
  if (new Set(parsed.map((n) => n.id)).size !== parsed.length)
    throw new Error("Duplicate node ID");
  return parsed;
}
