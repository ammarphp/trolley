import { z } from "zod";
import type { Campaign, Manifest, Node } from "../../src/contracts/index.ts";
import {
  createCampaign,
  commitChoice,
  availableAdvice,
  sha256,
} from "../../src/simulation/index.ts";
import {
  RunRegistration,
  EventBatch,
  Credentials,
  MAX_BATCH_BYTES,
  MAX_QUEUE_EVENTS,
  PUBLIC_MIN_RUNS,
  comparisonKeyFor,
  materialBase,
  stableStringify,
  type TelemetryEvent,
  type PresentationProfile,
} from "../../src/telemetry/protocol.ts";
import { V2_SCHEMA } from "./schema.ts";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<unknown>;
  batch(statements: Statement[]): Promise<unknown>;
}
export interface ApprovedBundle {
  manifest: Manifest;
  nodes: Node[];
}
export interface CollectorEnv {
  DB: Database;
  V2_ENABLED?: string;
  ALLOWED_ORIGINS?: string;
  /** Server-side allowlist, never populated from request data. No bundle is approved by default. */
  V2_BUNDLES?: ApprovedBundle[];
  V2_APPROVED_MANIFEST_HASHES?: string;
}
interface RunRow {
  number: number;
  run_id: string;
  token_hash: string;
  consent_version: string;
  profile: string;
  started_day: string;
  manifest_json: string | null;
  campaign_json: string | null;
  exposure_json: string | null;
  last_sequence: number;
  withdrawn: number;
  expired: number;
}
interface Exposure {
  decisionId: string;
  baseKey: string;
  presentations: PresentationProfile[];
  adviceIds: string[];
}
interface PublishedRow {
  comparison_key: string;
  published_counts: string | null;
  published_n: number | null;
  as_of: string | null;
}
export interface PublishedCell {
  comparisonKey: string;
  n: number;
  counts: Record<string, number>;
  asOf: string;
}
export const MAX_SNAPSHOT_CELLS = 100;
export const MAX_SNAPSHOT_BYTES = 256 * 1024;
const SNAPSHOT_TTL_MS = 3600000;
const withdrawalNotice =
  "This is a dated copy of previously released counts. Confirmed withdrawal invalidates live cells. Saved Pages deployments, caches and downloaded copies cannot be recalled; replace static snapshots on the next successful deployment.";
const SnapshotQuery = z
  .object({
    cursor: z.string().min(1).max(12000).optional(),
    generation: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_SNAPSHOT_CELLS)
      .default(MAX_SNAPSHOT_CELLS),
  })
  .strict()
  .refine(
    (q) => !q.cursor || Boolean(q.generation),
    "A subsequent page requires its generation.",
  );
// A stale maintenance schedule withholds affected cells instead of exporting
// a snapshot whose published membership contains expired/withdrawn records.
const retainedMembership = `NOT EXISTS(SELECT 1 FROM v2_choices ch JOIN v2_runs r ON r.number=ch.run_number WHERE ch.comparison_key=c.comparison_key AND (r.withdrawn<>0 OR r.expired<>0 OR r.started_day<date('now','-365 days')))`;
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function ensure(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
const initialized = new WeakSet<object>();
async function initialize(db: Database) {
  if (!initialized.has(db)) {
    await db.exec(V2_SCHEMA);
    initialized.add(db);
  }
}
async function readBody(request: Request): Promise<unknown> {
  ensure(
    request.headers.get("content-type")?.split(";")[0] === "application/json",
    "Use application/json.",
    415,
  );
  ensure(
    Number(request.headers.get("content-length") || 0) <= MAX_BATCH_BYTES,
    "Request too large.",
    413,
  );
  const reader = request.body?.getReader();
  ensure(reader, "Missing request body.");
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BATCH_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
async function limit(db: Database, key: string, max: number) {
  const minute = Math.floor(Date.now() / 60000);
  const result = await db
    .prepare(
      "INSERT INTO v2_rate_windows(window_key,count) VALUES (?,1) ON CONFLICT(window_key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(`${minute}:${key}`)
    .first<{ count: number }>();
  ensure(result && result.count <= max, "Please retry later.", 429);
}
async function authorize(
  db: Database,
  credentials: z.infer<typeof Credentials>,
  allowDeleted = false,
) {
  const row = await db
    .prepare("SELECT * FROM v2_runs WHERE run_id=?")
    .bind(credentials.runId)
    .first<RunRow>();
  ensure(
    row && row.token_hash === (await sha256(credentials.runToken)),
    "Run not found or key incorrect.",
    403,
  );
  ensure(
    allowDeleted || (!row.withdrawn && !row.expired),
    "This run is no longer accepting events.",
    410,
  );
  return row;
}
async function bundleFor(
  env: CollectorEnv,
  manifestHash: string,
  manifestId: string,
): Promise<ApprovedBundle> {
  const hashes = (env.V2_APPROVED_MANIFEST_HASHES || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  ensure(
    hashes.includes(manifestHash),
    "This content release is not approved for collection.",
    409,
  );
  for (const bundle of env.V2_BUNDLES || [])
    if (
      bundle.manifest.id === manifestId &&
      (await sha256(bundle.manifest)) === manifestHash
    )
      return bundle;
  throw new HttpError(409, "The approved content bundle is unavailable.");
}
async function register(db: Database, env: CollectorEnv, raw: unknown) {
  const data = RunRegistration.parse(raw);
  await limit(db, "registrations", 120);
  const existing = await db
    .prepare("SELECT * FROM v2_runs WHERE run_id=?")
    .bind(data.runId)
    .first<RunRow>();
  if (existing) {
    const row = await authorize(db, data);
    ensure(
      row.manifest_json === stableStringify(data.manifest),
      "Run manifest cannot change.",
      409,
    );
    return {
      runNumber: row.number,
      acceptedManifestHash: data.manifest.manifestHash,
    };
  }
  const bundle = await bundleFor(
    env,
    data.manifest.manifestHash,
    data.manifest.manifestId,
  );
  const campaign = await createCampaign(
    bundle.manifest,
    bundle.nodes,
    data.manifest.seed,
  );
  ensure(
    campaign.engineVersion === data.manifest.engineVersion &&
      campaign.contentVersion === data.manifest.contentVersion &&
      campaign.contentHash === data.manifest.contentHash,
    "Manifest does not match the approved content.",
    409,
  );
  await db
    .prepare(
      "INSERT INTO v2_runs(run_id,token_hash,consent_version,profile,manifest_json,campaign_json) VALUES (?,?,?,?,?,?) ON CONFLICT(run_id) DO NOTHING",
    )
    .bind(
      data.runId,
      await sha256(data.runToken),
      data.consentVersion,
      bundle.manifest.profile,
      stableStringify(data.manifest),
      JSON.stringify(campaign),
    )
    .run();
  const row = await authorize(db, data);
  ensure(
    row.manifest_json === stableStringify(data.manifest),
    "Run manifest conflict.",
    409,
  );
  return { runNumber: row.number, acceptedManifestHash: campaign.manifestHash };
}
async function ingest(db: Database, env: CollectorEnv, raw: unknown) {
  const data = EventBatch.parse(raw),
    row = await authorize(db, data);
  await limit(db, `run:${row.number}`, 120);
  ensure(row.manifest_json && row.campaign_json, "Expired run.", 410);
  const manifest = JSON.parse(row.manifest_json) as z.infer<
    typeof RunRegistration
  >["manifest"];
  const bundle = await bundleFor(
    env,
    manifest.manifestHash,
    manifest.manifestId,
  );
  let campaign = JSON.parse(row.campaign_json) as Campaign;
  let exposure: Exposure | null = row.exposure_json
    ? JSON.parse(row.exposure_json)
    : null;
  let sequence = row.last_sequence;
  const additions: {
    event: TelemetryEvent;
    hash: string;
    choice?: { key: string; decisionId: string; optionId: string };
  }[] = [];
  const acknowledged: string[] = [];
  for (const incoming of data.events) {
    const event = structuredClone(incoming);
    if (event.payload.type === "decision_committed")
      event.payload.activeMs = Math.round(event.payload.activeMs / 100) * 100;
    const hash = await sha256(event);
    const old = await db
      .prepare(
        "SELECT event_hash FROM v2_events WHERE run_number=? AND event_id=?",
      )
      .bind(row.number, event.eventId)
      .first<{ event_hash: string }>();
    if (old) {
      ensure(
        old.event_hash === hash,
        "Event identity conflicts with an earlier event.",
        409,
      );
      acknowledged.push(event.eventId);
      continue;
    }
    const duplicate = additions.find(
      (item) => item.event.eventId === event.eventId,
    );
    if (duplicate) {
      ensure(duplicate.hash === hash, "Conflicting duplicate in batch.", 409);
      acknowledged.push(event.eventId);
      continue;
    }
    ensure(
      event.sequence === sequence + 1,
      "Event sequence is not contiguous.",
      409,
    );
    ensure(
      event.sequence < MAX_QUEUE_EVENTS,
      "This run reached the observation limit.",
      413,
    );
    const payload = event.payload,
      p = campaign.prepared;
    let choice:
      { key: string; decisionId: string; optionId: string } | undefined;
    if (payload.type === "node_exposed") {
      ensure(
        p &&
          p.id === payload.decisionId &&
          p.nodeId === payload.nodeId &&
          p.revision === payload.revision,
        "Exposure does not match the active decision.",
        409,
      );
      if (exposure) {
        ensure(
          exposure.decisionId === p.id,
          "Another exposure is still active.",
          409,
        );
        if (
          stableStringify(exposure.presentations.at(-1)) !==
          stableStringify(payload.presentation)
        )
          exposure.presentations.push(payload.presentation);
      } else
        exposure = {
          decisionId: p.id,
          baseKey: materialBase(campaign, p),
          presentations: [payload.presentation],
          adviceIds: [],
        };
    } else if (payload.type === "advice_exposed") {
      ensure(
        p &&
          exposure &&
          p.id === payload.decisionId &&
          exposure.decisionId === p.id,
        "Advice has no matching exposure.",
        409,
      );
      ensure(
        availableAdvice(p).some((reply) => reply.id === payload.adviceId),
        "Unknown or unavailable advice.",
      );
      if (!exposure.adviceIds.includes(payload.adviceId))
        exposure.adviceIds.push(payload.adviceId);
    } else if (payload.type === "decision_committed") {
      ensure(
        p &&
          exposure &&
          p.id === payload.decisionId &&
          p.revision === payload.revision &&
          exposure.decisionId === p.id,
        "Decision has no matching active exposure.",
        409,
      );
      ensure(
        stableStringify([...new Set(payload.adviceIds)].sort()) ===
          stableStringify([...exposure.adviceIds].sort()),
        "Advice exposure does not match the decision.",
      );
      ensure(
        p.node.options.some(
          (option) => option.id === payload.requestedOptionId,
        ),
        "Unknown semantic option.",
      );
      const key = comparisonKeyFor(
        exposure.baseKey,
        exposure.adviceIds,
        exposure.presentations,
      );
      campaign = await commitChoice(
        campaign,
        {
          decisionId: p.id,
          optionId: payload.requestedOptionId,
          expectedRevision: p.revision,
          actor: "human",
          adviceIds: exposure.adviceIds,
        },
        bundle.nodes,
      );
      const record = campaign.journal.at(-1)!;
      if (
        row.profile === "story" &&
        payload.source === "human" &&
        record.status === "free" &&
        record.executor === "human"
      )
        choice = { key, decisionId: p.id, optionId: record.requestedOptionId };
      exposure = null;
    } else if (payload.type === "reflection_added") {
      ensure(
        campaign.journal.some((record) => record.id === payload.decisionId),
        "Reflection has no committed decision.",
        409,
      );
    } else {
      ensure(
        campaign.ending &&
          campaign.ending.id === payload.endingId &&
          campaign.revision === payload.revision,
        "Ending does not match the replay.",
        409,
      );
    }
    sequence = event.sequence;
    additions.push({ event, hash, choice });
    acknowledged.push(event.eventId);
  }
  if (additions.length) {
    // D1 batch is atomic. Every insertion and final state replacement shares the
    // same optimistic sequence guard, so withdrawal/concurrent writers cannot
    // resurrect events or overwrite a competing committed transition.
    const guard =
      "EXISTS(SELECT 1 FROM v2_runs WHERE number=? AND last_sequence=? AND withdrawn=0 AND expired=0)";
    const statements: Statement[] = [];
    for (const item of additions) {
      statements.push(
        db
          .prepare(
            `INSERT INTO v2_events(run_number,event_id,sequence,event_hash,payload) SELECT ?,?,?,?,? WHERE ${guard}`,
          )
          .bind(
            row.number,
            item.event.eventId,
            item.event.sequence,
            item.hash,
            JSON.stringify(item.event.payload),
            row.number,
            row.last_sequence,
          ),
      );
      if (item.choice) {
        statements.push(
          db
            .prepare(
              `INSERT INTO v2_choices(run_number,comparison_key,decision_id,option_id) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(run_number,comparison_key) DO NOTHING`,
            )
            .bind(
              row.number,
              item.choice.key,
              item.choice.decisionId,
              item.choice.optionId,
              row.number,
              row.last_sequence,
            ),
        );
        statements.push(
          db
            .prepare(
              `INSERT INTO v2_cells(comparison_key) SELECT ? WHERE ${guard} ON CONFLICT(comparison_key) DO NOTHING`,
            )
            .bind(item.choice.key, row.number, row.last_sequence),
        );
      }
    }
    statements.push(
      db
        .prepare(
          "UPDATE v2_runs SET campaign_json=?,exposure_json=?,last_sequence=? WHERE number=? AND last_sequence=? AND withdrawn=0 AND expired=0",
        )
        .bind(
          JSON.stringify(campaign),
          exposure ? JSON.stringify(exposure) : null,
          sequence,
          row.number,
          row.last_sequence,
        ),
    );
    await db.batch(statements);
    for (const item of additions) {
      const saved = await db
        .prepare(
          "SELECT event_hash FROM v2_events WHERE run_number=? AND event_id=?",
        )
        .bind(row.number, item.event.eventId)
        .first<{ event_hash: string }>();
      ensure(
        saved?.event_hash === item.hash,
        "Concurrent change; retry the same batch.",
        409,
      );
    }
  }
  return { accepted: acknowledged, lastSequence: sequence };
}
async function removeRun(db: Database, raw: unknown) {
  const data = Credentials.parse(raw);
  // A withdrawal can beat an in-flight registration. Reserve a minimal
  // tombstone first so its delayed POST can never create a collecting run.
  await limit(db, "withdrawals", 120);
  await db
    .prepare(
      "INSERT INTO v2_runs(run_id,token_hash,consent_version,profile,withdrawn) VALUES (?,?,?,?,1) ON CONFLICT(run_id) DO NOTHING",
    )
    .bind(
      data.runId,
      await sha256(data.runToken),
      "withdrawal-only",
      "withdrawn",
    )
    .run();
  const row = await authorize(db, data, true);
  await db.batch([
    db
      .prepare(
        "UPDATE v2_cells SET valid=0,published_counts=NULL,published_n=NULL WHERE comparison_key IN (SELECT comparison_key FROM v2_choices WHERE run_number=?)",
      )
      .bind(row.number),
    db.prepare("DELETE FROM v2_events WHERE run_number=?").bind(row.number),
    db.prepare("DELETE FROM v2_choices WHERE run_number=?").bind(row.number),
    db
      .prepare(
        "UPDATE v2_runs SET withdrawn=1,campaign_json=NULL,exposure_json=NULL,manifest_json=NULL WHERE number=?",
      )
      .bind(row.number),
  ]);
  return {
    withdrawn: true,
    snapshotNotice:
      "Previously published or downloaded aggregates cannot be recalled. Static Pages snapshots change on the next successful deployment.",
  };
}
async function aggregate(db: Database, key: string) {
  ensure(key.length > 0 && key.length <= 12000, "Invalid comparison key.");
  const cell = await db
    .prepare("SELECT * FROM v2_cells WHERE comparison_key=?")
    .bind(key)
    .first<{
      comparison_key: string;
      published_counts: string | null;
      published_n: number | null;
      as_of: string | null;
      watermark: number;
      valid: number;
    }>();
  const empty = {
    schemaVersion: 2,
    available: false,
    status: "insufficient",
    unit: "recorded_run",
    eligibilityVersion: 2,
  };
  if (!cell) return empty;
  const tally = await db
    .prepare(
      "SELECT COUNT(*) AS n,COALESCE(MAX(id),0) AS max_id,SUM(CASE WHEN id>? THEN 1 ELSE 0 END) AS fresh FROM v2_choices WHERE comparison_key=?",
    )
    .bind(cell.watermark, key)
    .first<{ n: number; max_id: number; fresh: number | null }>();
  ensure(tally, "Aggregate unavailable.", 503);
  const elapsed = cell.as_of ? Date.now() - Date.parse(cell.as_of) : Infinity;
  if (
    tally.n >= PUBLIC_MIN_RUNS &&
    (tally.fresh || 0) >= PUBLIC_MIN_RUNS &&
    elapsed >= 3600000
  ) {
    const rows = await db
      .prepare(
        "SELECT option_id,COUNT(*) AS n FROM v2_choices WHERE comparison_key=? GROUP BY option_id",
      )
      .bind(key)
      .all<{ option_id: string; n: number }>();
    const counts = Object.fromEntries(
        rows.results.map((row) => [row.option_id, row.n]),
      ),
      asOf = new Date().toISOString();
    // A simultaneous withdrawal invalidates this release: recheck membership
    // count and monotone watermark inside the same SQL statement.
    await db
      .prepare(
        "UPDATE v2_cells SET published_counts=?,published_n=?,as_of=?,watermark=?,valid=1 WHERE comparison_key=? AND (SELECT COUNT(*) FROM v2_choices WHERE comparison_key=?)=? AND (SELECT COALESCE(MAX(id),0) FROM v2_choices WHERE comparison_key=?)=?",
      )
      .bind(
        JSON.stringify(counts),
        tally.n,
        asOf,
        tally.max_id,
        key,
        key,
        tally.n,
        key,
        tally.max_id,
      )
      .run();
  }
  const current = await db
    .prepare(
      "SELECT published_counts,published_n,as_of,valid FROM v2_cells WHERE comparison_key=?",
    )
    .bind(key)
    .first<{
      published_counts: string | null;
      published_n: number | null;
      as_of: string | null;
      valid: number;
    }>();
  if (!current?.valid || !current.published_counts || !current.published_n)
    return empty;
  return {
    schemaVersion: 2,
    available: true,
    comparisonKey: key,
    counts: JSON.parse(current.published_counts),
    n: current.published_n,
    asOf: current.as_of,
    unit: "recorded_run",
    eligibilityVersion: 2,
    denominator:
      "First eligible explicit free choice per opted-in story run in this exact material context. Runs are not distinct people.",
    window:
      "Retained consented runs for the exact approved content context; raw retention is 365 days.",
  };
}

function publicCell(row: PublishedRow): PublishedCell {
  let counts: unknown;
  try {
    counts = JSON.parse(row.published_counts || "null");
  } catch {
    throw new HttpError(503, "A published cell failed validation.");
  }
  ensure(
    row.comparison_key.startsWith("v2:") &&
      row.comparison_key.length <= 12000 &&
      Number.isSafeInteger(row.published_n) &&
      Number(row.published_n) >= PUBLIC_MIN_RUNS &&
      typeof row.as_of === "string" &&
      Number.isFinite(Date.parse(row.as_of)),
    "A published cell failed validation.",
    503,
  );
  ensure(
    counts && typeof counts === "object" && !Array.isArray(counts),
    "A published cell failed validation.",
    503,
  );
  const pairs = Object.entries(counts);
  ensure(
    pairs.length >= 1 &&
      pairs.length <= 2 &&
      pairs.every(
        ([key, n]) =>
          /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(key) &&
          Number.isSafeInteger(n) &&
          n >= 0,
      ) &&
      pairs.reduce((n, [, value]) => n + value, 0) === row.published_n,
    "A published cell failed validation.",
    503,
  );
  return {
    comparisonKey: row.comparison_key,
    n: Number(row.published_n),
    counts: counts as Record<string, number>,
    asOf: row.as_of,
  };
}
async function publicationGeneration(db: Database): Promise<string> {
  const row = await db
    .prepare("SELECT generation FROM v2_publication_state WHERE singleton=1")
    .first<{ generation: string }>();
  ensure(row, "Publication state unavailable.", 503);
  // The random generation carries no event count, run identifier or timestamp.
  return sha256([
    "v2-publication",
    row.generation,
    new Date().toISOString().slice(0, 10),
  ]);
}
/** Read only: this endpoint never turns a candidate context into a release. */
async function snapshot(db: Database, search: URLSearchParams) {
  ensure(
    [...search.keys()].every((key) => search.getAll(key).length === 1),
    "Duplicate snapshot parameter.",
  );
  const query = SnapshotQuery.parse(Object.fromEntries(search)),
    generation = await publicationGeneration(db);
  ensure(
    !query.generation || query.generation === generation,
    "Snapshot changed; restart from the first page.",
    409,
  );
  const now = Date.now();
  const base = {
    schemaVersion: 2,
    status: "live-validity-checked",
    generation,
    generatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SNAPSHOT_TTL_MS).toISOString(),
    unit: "recorded_run",
    eligibilityVersion: 2,
    minimumRuns: PUBLIC_MIN_RUNS,
    publicationRule:
      "At least twenty newly eligible runs and one hour between releases of a cell. Runs are not distinct people.",
    withdrawalNotice,
  };
  const selected = await db
    .prepare(
      `SELECT c.comparison_key,c.published_counts,c.published_n,c.as_of FROM v2_cells c WHERE c.valid=1 AND c.published_n>=? AND c.comparison_key>? AND ${retainedMembership} AND (SELECT COUNT(*) FROM v2_choices ch WHERE ch.comparison_key=c.comparison_key)>=? ORDER BY c.comparison_key LIMIT ?`,
    )
    .bind(PUBLIC_MIN_RUNS, query.cursor || "", PUBLIC_MIN_RUNS, query.limit + 1)
    .all<PublishedRow>();
  const cells: PublishedCell[] = [];
  for (const row of selected.results.slice(0, query.limit)) {
    const cell = publicCell(row),
      candidate = {
        ...base,
        cells: [...cells, cell],
        nextCursor: cell.comparisonKey,
        complete: false,
      };
    if (
      new TextEncoder().encode(JSON.stringify(candidate)).byteLength >
      MAX_SNAPSHOT_BYTES
    )
      break;
    cells.push(cell);
  }
  ensure(
    !selected.results.length || cells.length > 0,
    "Snapshot row exceeds publication limits.",
    503,
  );
  ensure(
    (await publicationGeneration(db)) === generation,
    "Snapshot changed; restart from the first page.",
    409,
  );
  const more = selected.results.length > cells.length;
  return {
    ...base,
    cells,
    nextCursor: more ? cells.at(-1)!.comparisonKey : null,
    complete: !more,
  };
}

/** Private scheduled integration only. Returns no candidate keys or raw data. */
export async function refreshAggregatesV2(
  env: CollectorEnv,
  limit = MAX_SNAPSHOT_CELLS,
): Promise<{
  status: "disabled" | "refreshed";
  considered: number;
  released: number;
  hasMore: boolean;
}> {
  if (env.V2_ENABLED !== "true")
    return { status: "disabled", considered: 0, released: 0, hasMore: false };
  ensure(
    Number.isInteger(limit) && limit >= 1 && limit <= MAX_SNAPSHOT_CELLS,
    "Invalid refresh limit.",
  );
  const db = env.DB;
  await initialize(db);
  const rows = await db
    .prepare(
      `SELECT c.comparison_key FROM v2_cells c JOIN v2_choices ch ON ch.comparison_key=c.comparison_key WHERE (c.as_of IS NULL OR julianday(c.as_of)<=julianday('now','-1 hour')) AND ${retainedMembership} GROUP BY c.comparison_key HAVING COUNT(*)>=? AND SUM(CASE WHEN ch.id>c.watermark THEN 1 ELSE 0 END)>=? ORDER BY c.comparison_key LIMIT ?`,
    )
    .bind(PUBLIC_MIN_RUNS, PUBLIC_MIN_RUNS, limit + 1)
    .all<{ comparison_key: string }>();
  let released = 0;
  for (const row of rows.results.slice(0, limit)) {
    const before = await db
      .prepare("SELECT as_of,published_n FROM v2_cells WHERE comparison_key=?")
      .bind(row.comparison_key)
      .first<{ as_of: string | null; published_n: number | null }>();
    const result = await aggregate(db, row.comparison_key);
    if (
      result.available &&
      "asOf" in result &&
      (result.asOf !== before?.as_of || result.n !== before?.published_n)
    )
      released++;
  }
  return {
    status: "refreshed",
    considered: Math.min(limit, rows.results.length),
    released,
    hasMore: rows.results.length > limit,
  };
}

/** A private scheduled integration invokes this; it is deliberately not a public HTTP route. */
export async function cleanupV2(env: CollectorEnv): Promise<void> {
  const db = env.DB;
  await initialize(db);
  await db.batch([
    db.prepare(
      "UPDATE v2_cells SET valid=0,published_counts=NULL,published_n=NULL WHERE comparison_key IN (SELECT c.comparison_key FROM v2_choices c JOIN v2_runs r ON c.run_number=r.number WHERE r.started_day<date('now','-365 days'))",
    ),
    db.prepare(
      "DELETE FROM v2_events WHERE run_number IN (SELECT number FROM v2_runs WHERE started_day<date('now','-365 days'))",
    ),
    db.prepare(
      "DELETE FROM v2_choices WHERE run_number IN (SELECT number FROM v2_runs WHERE started_day<date('now','-365 days'))",
    ),
    db.prepare(
      "UPDATE v2_runs SET expired=1,campaign_json=NULL,exposure_json=NULL,manifest_json=NULL WHERE started_day<date('now','-365 days')",
    ),
    db
      .prepare(
        "DELETE FROM v2_rate_windows WHERE CAST(substr(window_key,1,instr(window_key,':')-1) AS INTEGER)<?",
      )
      .bind(Math.floor(Date.now() / 60000) - 2),
  ]);
}

export async function handler(
  request: Request,
  env: CollectorEnv,
): Promise<Response> {
  const origin = request.headers.get("origin"),
    allowed = (env.ALLOWED_ORIGINS || "https://ammarphp.github.io")
      .split(",")
      .map((s) => s.trim());
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && allowed.includes(origin))
    headers["Access-Control-Allow-Origin"] = origin;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  try {
    ensure(!origin || allowed.includes(origin), "Origin not allowed.", 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (path === "/v2/health")
      return json({
        schemaVersion: 2,
        status: env.V2_ENABLED === "true" && env.DB ? "configured" : "disabled",
        collectionEnabled: env.V2_ENABLED === "true",
      });
    ensure(
      env.V2_ENABLED === "true" && env.DB,
      "V2 collection is not enabled.",
      503,
    );
    await initialize(env.DB);
    if (request.method === "POST" && path === "/v2/runs")
      return json(await register(env.DB, env, await readBody(request)), 201);
    if (request.method === "POST" && path === "/v2/events")
      return json(await ingest(env.DB, env, await readBody(request)));
    if (request.method === "DELETE" && path.startsWith("/v2/runs/")) {
      const body = Credentials.parse(await readBody(request));
      ensure(
        path === `/v2/runs/${body.runId}`,
        "Run URL and credential disagree.",
      );
      return json(await removeRun(env.DB, body));
    }
    if (request.method === "GET" && path === "/v2/aggregates")
      return json(
        await aggregate(
          env.DB,
          new URL(request.url).searchParams.get("key") || "",
        ),
      );
    if (request.method === "GET" && path === "/v2/snapshot")
      return json(await snapshot(env.DB, new URL(request.url).searchParams));
    throw new HttpError(404, "Not found.");
  } catch (error) {
    return json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : error instanceof z.ZodError
              ? "Invalid request schema."
              : "The collector could not complete the request.",
      },
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500,
    );
  }
}
