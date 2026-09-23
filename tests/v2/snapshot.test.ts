import test from "node:test";
import assert from "node:assert/strict";
import { SnapshotPage, SavedSnapshot } from "../../src/telemetry/snapshot.ts";
const cell = {
  comparisonKey: "v2:test",
  n: 20,
  counts: { a: 12, b: 8 },
  asOf: "2026-09-22T00:00:00.000Z",
};
const page = {
  schemaVersion: 2,
  status: "live-validity-checked",
  generation: "a".repeat(64),
  generatedAt: cell.asOf,
  expiresAt: "2026-09-22T01:00:00.000Z",
  unit: "recorded_run",
  eligibilityVersion: 2,
  minimumRuns: 20,
  publicationRule: "twenty new runs",
  withdrawalNotice: "Copies cannot be recalled.",
  cells: [cell],
  nextCursor: null,
  complete: true,
};
test("public snapshot excludes raw fields and rejects unqualified or inconsistent cells", () => {
  assert(SnapshotPage.safeParse(page).success);
  for (const mutation of [
    { ...page, runIds: ["secret"] },
    { ...page, cells: [{ ...cell, runId: "secret" }] },
    { ...page, cells: [{ ...cell, n: 19 }] },
    { ...page, cells: [{ ...cell, counts: { a: 21 } }] },
    { ...page, nextCursor: "more" },
    { ...page, cells: Array(101).fill(cell) },
  ])
    assert(!SnapshotPage.safeParse(mutation).success);
});
test("saved copy has an explicit different status and unique complete cell keys", () => {
  const saved = {
    schemaVersion: 2,
    status: "saved-copy",
    generation: page.generation,
    generatedAt: page.generatedAt,
    expiresAt: page.expiresAt,
    unit: "recorded_run",
    minimumRuns: 20,
    withdrawalNotice: page.withdrawalNotice,
    cells: [cell],
  };
  assert(SavedSnapshot.safeParse(saved).success);
  assert(
    !SavedSnapshot.safeParse({ ...saved, status: "live-validity-checked" })
      .success,
  );
  assert(!SavedSnapshot.safeParse({ ...saved, cells: [cell, cell] }).success);
});
