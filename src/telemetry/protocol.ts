import { z } from "zod";
import {
  CONSENT_VERSION,
  ENGINE_VERSION,
  type Campaign,
  type PreparedDecision,
} from "../contracts/index.ts";

export const MAX_BATCH_EVENTS = 32;
export const MAX_BATCH_BYTES = 65536;
export const MAX_QUEUE_EVENTS = 2000;
export const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PUBLIC_MIN_RUNS = 20;
export const Profile = z
  .object({
    reducedMotion: z.boolean(),
    reducedGraphics: z.boolean(),
    audio: z.boolean(),
    descriptions: z.boolean(),
  })
  .strict();
export type PresentationProfile = z.infer<typeof Profile>;
const Identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const Revision = z.number().int().min(0).max(1000000);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const Credentials = z
  .object({
    runId: z.string().uuid(),
    runToken: z.string().regex(/^[a-f0-9-]{72}$/),
  })
  .strict();
export const RunRegistration = Credentials.extend({
  started: z.literal(true),
  consentVersion: z.literal(CONSENT_VERSION),
  manifest: z
    .object({
      manifestId: Identifier,
      engineVersion: z.literal(ENGINE_VERSION),
      contentVersion: z.string().min(1).max(80),
      manifestHash: Hash,
      contentHash: Hash,
      seed: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    })
    .strict(),
}).strict();
export const EventPayload = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("node_exposed"),
      decisionId: Identifier,
      nodeId: Identifier,
      revision: Revision,
      presentation: Profile,
    })
    .strict(),
  z
    .object({
      type: z.literal("advice_exposed"),
      decisionId: Identifier,
      adviceId: Identifier,
    })
    .strict(),
  z
    .object({
      type: z.literal("decision_committed"),
      decisionId: Identifier,
      requestedOptionId: Identifier,
      revision: Revision,
      activeMs: z.number().int().min(0).max(86400000),
      adviceIds: z.array(Identifier).max(20),
      source: z.enum(["human", "agent", "staff"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("reflection_added"),
      decisionId: Identifier,
      confidence: z.enum(["unsure", "mixed", "sure"]).nullable(),
      reason: z
        .enum([
          "harm",
          "duty",
          "consent",
          "uncertainty",
          "trust",
          "control",
          "fairness",
          "other",
        ])
        .nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("run_ended"),
      endingId: Identifier,
      revision: Revision,
    })
    .strict(),
]);
export type EventPayload = z.infer<typeof EventPayload>;
export const TelemetryEvent = z
  .object({
    eventId: z.string().uuid(),
    sequence: Revision,
    payload: EventPayload,
  })
  .strict();
export type TelemetryEvent = z.infer<typeof TelemetryEvent>;
export const EventBatch = Credentials.extend({
  events: z.array(TelemetryEvent).min(1).max(MAX_BATCH_EVENTS),
}).strict();
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

/** No hash collision is introduced: the existing engine key and explicit context are encoded losslessly. */
export function comparisonKeyFor(
  baseKey: string,
  adviceIds: readonly string[],
  presentation: PresentationProfile | readonly PresentationProfile[],
): string {
  const advice = [...new Set(adviceIds)].sort();
  const profiles: readonly PresentationProfile[] = Array.isArray(presentation)
    ? presentation
    : [presentation as PresentationProfile];
  const bits = profiles
    .map((p) =>
      [p.reducedMotion, p.reducedGraphics, p.audio, p.descriptions]
        .map(Boolean)
        .map(Number)
        .join(""),
    )
    .join(">");
  return `v2:${encodeURIComponent(baseKey)}:${bits}:${advice.map(encodeURIComponent).join(",")}`;
}
export function knownAdviceId(decisionId: string, index: number): string {
  return `${decisionId}:advice:${index}`;
}
export function materialBase(
  campaign: Campaign,
  prepared: PreparedDecision,
): string {
  return stableStringify({
    engineKey: prepared.comparisonKey,
    manifestHash: campaign.manifestHash,
    contentHash: campaign.contentHash,
    scope: prepared.node.scope,
    control: prepared.control,
    left: prepared.leftOptionId,
    right: prepared.rightOptionId,
    default: prepared.defaultOptionId,
  });
}
