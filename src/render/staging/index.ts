/**
 * Visual staging for every authored decision, keyed by node id. Presentation
 * data only: it lives outside the hashed content bank so saved runs and
 * replays are unaffected by changes to how a dilemma is drawn.
 */
import type { NodeStaging } from "../api.ts";
import { STAGING_1_2 } from "./stage1-2.ts";
import { STAGING_3_4 } from "./stage3-4.ts";
import { STAGING_5_7 } from "./stage5-7.ts";

export const STAGING: Readonly<Record<string, NodeStaging>> = Object.freeze({ ...STAGING_1_2, ...STAGING_3_4, ...STAGING_5_7 });

export function stagingFor(nodeId: string): NodeStaging | undefined {
  return STAGING[nodeId];
}
