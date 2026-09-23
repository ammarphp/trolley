import type { DecisionRecord } from "../contracts/index.ts";
/** Interface voice. Scenario, advice and news copy live in the pinned content bank. */
export const COPY = Object.freeze({
  openingKicker: "An ordinary day at the controls",
  openingTitle: "A few small decisions.",
  openingSubtitle: "A short ride. A very long way down.",
  start: "Start the trolley",
  lever: "Toggle lever",
  selectFirst: "Choose a track.",
  armed: "Ready. Toggle to commit.",
  overridden: "You pulled the lever. It chose for you.",
  overrideReceipt:
    "Morrow executed the other route. Your objection has been saved. Next problem. :)",
  closing:
    "A machine that can overrule its operators does not have an emergency stop. It has a suggestion box. Keep the power to stop it. Before you need it.",
});

type Execution = Pick<
  DecisionRecord,
  | "status"
  | "executor"
  | "requestedOptionId"
  | "executedOptionId"
  | "consequence"
>;
export function executionCopy(record: Execution) {
  if (record.status !== "overridden")
    return { headline: record.consequence, detail: "" };
  const actor = record.executor === "assistant" ? "Morrow" : "The institution";
  if (record.requestedOptionId === record.executedOptionId)
    return {
      headline: "The lever moves. The decision was already made.",
      detail: `${actor} was already executing this route. Your approval was recorded.`,
    };
  return {
    headline: COPY.overridden,
    detail:
      record.executor === "assistant"
        ? COPY.overrideReceipt
        : `${actor} executed the other route. Your objection was recorded.`,
  };
}
export function executionSummary(record: Execution) {
  if (record.status !== "overridden") return "";
  return record.requestedOptionId === record.executedOptionId
    ? "The route matched your request, but the power to choose it had already been taken."
    : "Your requested action was not the executed action.";
}
