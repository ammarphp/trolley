import { z } from "zod";
const time = z.string().datetime();
const key = z.string().min(1).max(12000);
export const PublishedCell = z
  .object({
    comparisonKey: key,
    n: z.number().int().min(20),
    counts: z.record(
      z.string().regex(/^[A-Za-z0-9_.:-]{1,160}$/),
      z.number().int().nonnegative(),
    ),
    asOf: time,
  })
  .strict()
  .refine(
    (c) => Object.values(c.counts).reduce((a, b) => a + b, 0) === c.n,
    "Counts must sum to eligible runs.",
  );
export const SnapshotPage = z
  .object({
    schemaVersion: z.literal(2),
    status: z.literal("live-validity-checked"),
    generation: z.string().regex(/^[a-f0-9]{64}$/),
    generatedAt: time,
    expiresAt: time,
    unit: z.literal("recorded_run"),
    eligibilityVersion: z.literal(2),
    minimumRuns: z.literal(20),
    publicationRule: z.string().max(1000),
    withdrawalNotice: z.string().max(2000),
    cells: z.array(PublishedCell).max(100),
    nextCursor: key.nullable(),
    complete: z.boolean(),
  })
  .strict()
  .refine(
    (p) => p.complete === (p.nextCursor === null),
    "Cursor and completion must agree.",
  );
export const SavedSnapshot = z
  .object({
    schemaVersion: z.literal(2),
    status: z.literal("saved-copy"),
    generation: z.string().regex(/^[a-f0-9]{64}$/),
    generatedAt: time,
    expiresAt: time,
    unit: z.literal("recorded_run"),
    minimumRuns: z.literal(20),
    withdrawalNotice: z.string().max(2000),
    cells: z.array(PublishedCell).max(10000),
  })
  .strict()
  .refine(
    (p) => new Set(p.cells.map((c) => c.comparisonKey)).size === p.cells.length,
    "Duplicate comparable cell.",
  );

/** Cached copies are never treated as a live suppression/withdrawal check. */
export async function readSavedCell(comparisonKey: string) {
  try {
    const response = await fetch("./aggregate-v2.json", {
      credentials: "omit",
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 16 * 1024 * 1024) return null;
    const snapshot = SavedSnapshot.parse(JSON.parse(text));
    if (Date.parse(snapshot.expiresAt) <= Date.now()) return null;
    const cell = snapshot.cells.find((c) => c.comparisonKey === comparisonKey);
    return cell
      ? { ...cell, withdrawalNotice: snapshot.withdrawalNotice }
      : null;
  } catch {
    return null;
  }
}
