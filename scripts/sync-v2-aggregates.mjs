import { writeFile, rename, mkdir } from "node:fs/promises";
import { SnapshotPage, SavedSnapshot } from "../src/telemetry/snapshot.ts";
const base = new URL(process.env.COLLECTOR_URL || "");
if (
  base.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(base.hostname)
)
  throw new Error("Use HTTPS.");
if (base.username || base.password || base.search || base.hash)
  throw new Error("Invalid collector address.");
const cells = [];
let generation,
  cursor,
  first,
  bytes = 0;
async function read(params) {
  const url = new URL("v2/snapshot", base.href.replace(/\/$/, "") + "/");
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    credentials: "omit",
  });
  if (!response.ok)
    throw new Error(
      `Snapshot returned ${response.status}. No partial snapshot will be published.`,
    );
  const body = await response.text();
  if (Buffer.byteLength(body) > 256 * 1024)
    throw new Error("Oversized snapshot page.");
  bytes += Buffer.byteLength(body);
  if (bytes > 16 * 1024 * 1024)
    throw new Error("Snapshot transfer limit exceeded.");
  return SnapshotPage.parse(JSON.parse(body));
}
for (let page = 0; page < 101; page++) {
  const current = await read({
    ...(generation ? { generation } : {}),
    ...(cursor ? { cursor } : {}),
  });
  first ??= current;
  if (generation && current.generation !== generation)
    throw new Error("Snapshot changed between pages.");
  generation = current.generation;
  cells.push(...current.cells);
  if (cells.length > 10000) throw new Error("Too many published cells.");
  if (current.complete) {
    cursor = null;
    break;
  }
  if (cursor === current.nextCursor)
    throw new Error("Snapshot cursor did not advance.");
  cursor = current.nextCursor;
}
if (cursor) throw new Error("Snapshot pagination incomplete.");
await read({ generation, limit: "1" }); // Abort on withdrawal/publication during pagination.
const saved = SavedSnapshot.parse({
  schemaVersion: 2,
  status: "saved-copy",
  generation,
  generatedAt: first.generatedAt,
  expiresAt: first.expiresAt,
  unit: "recorded_run",
  minimumRuns: 20,
  withdrawalNotice: first.withdrawalNotice,
  cells,
});
if (Date.parse(saved.expiresAt) <= Date.now())
  throw new Error("Snapshot expired during download.");
await mkdir("dist", { recursive: true });
await writeFile("dist/aggregate-v2.json.pending", JSON.stringify(saved) + "\n");
await rename("dist/aggregate-v2.json.pending", "dist/aggregate-v2.json");
console.log(
  `Saved ${cells.length} previously released v2 cells to the Pages artifact. No raw run records.`,
);
