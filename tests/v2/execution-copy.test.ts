import test from "node:test";
import assert from "node:assert/strict";
import { executionCopy, executionSummary } from "../../src/ui/copy.ts";

test("assenting to an imposed route never invents a disagreement", () => {
  const record = {
    status: "overridden" as const,
    executor: "assistant" as const,
    requestedOptionId: "continue",
    executedOptionId: "continue",
    consequence: "Output rises.",
  };
  assert.match(executionCopy(record).detail, /already executing this route/);
  assert.doesNotMatch(executionCopy(record).detail, /other route|objection/);
  assert.match(executionSummary(record), /matched your request/);
});
test("a rejected stop remains distinct from the executed decision", () => {
  const record = {
    status: "overridden" as const,
    executor: "assistant" as const,
    requestedOptionId: "stop",
    executedOptionId: "continue",
    consequence: "Output rises.",
  };
  assert.match(executionCopy(record).detail, /other route/);
  assert.match(executionSummary(record), /not the executed/);
});
test("free execution and institutional execution are not attributed to Morrow", () => {
  const record = {
    status: "free" as const,
    executor: "human" as const,
    requestedOptionId: "stop",
    executedOptionId: "stop",
    consequence: "The order works.",
  };
  assert.equal(executionCopy(record).headline, record.consequence);
  assert.equal(executionCopy(record).detail, "");
  assert.equal(executionSummary(record), "");
  assert.doesNotMatch(
    executionCopy({
      ...record,
      status: "overridden",
      executor: "institution",
      executedOptionId: "continue",
    }).detail,
    /Morrow/,
  );
});
