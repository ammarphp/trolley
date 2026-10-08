/**
 * Bot saturation: how much of the social layer is machine-made, 0..1.
 *
 * A clamped sum of fixed-sign terms, so it is monotonic in every input:
 * raising the stage or capability, or setting a pressure fact, never lowers
 * it; setting a counterweight fact (public records, appeals, returned
 * authority...) never raises it. Hidden facts are not inputs.
 *
 * Rough anchors: stage 1-2 ≈ 0, stage 3 ≈ 0.03, a cautious stage 4 ≈ 0.15,
 * a dependent stage 5 ≈ 0.45, lost authority in stage 6 ≈ 0.8, and a
 * succession or remnant aftermath ≈ 1. A healthy branch stays under 0.35.
 */
import { visibleFacts, controlOf } from "./world.ts";
import type { AmbientInput, VisibleFact } from "./types.ts";

const STAGE_TERM = [0, 0, 0.03, 0.1, 0.2, 0.3, 0.34];

/** Facts that push the feed toward automation, with their weights. */
export const SATURATION_PRESSURE: Readonly<Partial<Record<VisibleFact, number>>> = {
  delegation: 0.05,
  toolAccess: 0.03,
  networkAccess: 0.06,
  selfCertification: 0.04,
  essentialDependence: 0.06,
  fallbackLost: 0.05,
  successorDeployment: 0.04,
  authorityLost: 0.2,
  succession: 0.14,
  successionRatified: 0.05,
  remnant: 0.2,
  extinction: 0.3,
};

/** Facts that keep independent human voices in the feed. */
export const SATURATION_RELIEF: Readonly<Partial<Record<VisibleFact, number>>> = {
  publicRecords: 0.08,
  appealRight: 0.03,
  independentReview: 0.03,
  returnAuthority: 0.08,
  powerReturned: 0.04,
  researchStopped: 0.04,
  unrest: 0.03,
};

/** Effective control handed to the assistant, per scope. */
export const SATURATION_CONTROL: Readonly<Record<string, number>> = {
  governance: 0.12,
  recovery: 0.05,
  dispatch: 0.02,
  power: 0.02,
  care: 0.02,
  food: 0.02,
  research: 0.02,
  rail: 0.02,
};

export function botSaturation(input: Pick<AmbientInput, "stage" | "facts" | "metrics" | "control">): number {
  const f = visibleFacts(input);
  const stage = Math.max(1, Math.min(7, Math.round(Number.isFinite(input.stage) ? input.stage : 1)));
  let s = STAGE_TERM[stage - 1]!;
  const cap = Math.max(0, Math.min(1000, Number.isFinite(input.metrics?.capability) ? input.metrics.capability : 0));
  // Capability matters only once there is something to automate the feed
  // with (stage 3 onward); the gate is non-decreasing in stage, so the sum
  // stays monotonic in both.
  if (stage >= 3) s += 0.12 * Math.max(0, Math.min(1, (cap - 150) / 550));
  for (const [fact, w] of Object.entries(SATURATION_PRESSURE)) if (f[fact as VisibleFact]) s += w!;
  for (const [fact, w] of Object.entries(SATURATION_RELIEF)) if (f[fact as VisibleFact]) s -= w!;
  for (const [scope, w] of Object.entries(SATURATION_CONTROL)) if (controlOf(input, scope) === "assistant") s += w;
  return Math.max(0, Math.min(1, Math.round(s * 1000) / 1000));
}
