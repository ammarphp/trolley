import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { IDBFactory } from "fake-indexeddb";
// The shared adapter is JavaScript and deliberately reused by both collector versions.
// @ts-expect-error legacy JS has no declaration file
import { sqliteAdapter } from "../../collector/sqlite-adapter.js";
import {
  handler,
  cleanupV2,
  refreshAggregatesV2,
  MAX_SNAPSHOT_BYTES,
  type CollectorEnv,
  type Database,
} from "../../collector/v2/index.ts";
import {
  CONSENT_VERSION,
  Node as NodeSchema,
  Manifest as ManifestSchema,
  type Manifest,
  type Node,
  type Campaign,
} from "../../src/contracts/index.ts";
import {
  createCampaign,
  commitChoice,
  sha256,
  availableAdvice,
} from "../../src/simulation/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../../src/content/slice.ts";
import {
  comparisonKeyFor,
  materialBase,
  QUEUE_TTL_MS,
  type EventPayload,
  type TelemetryEvent,
  type PresentationProfile,
} from "../../src/telemetry/protocol.ts";
import {
  recordExposure,
  recordAdvice,
  recordDecision,
  aggregateKeyFor,
  syncRun,
  withdrawRun,
  readAggregate,
  telemetryStatus,
} from "../../src/telemetry/client.ts";
import {
  newSession,
  publicExport,
  saveRun,
  listRuns,
  SaveConflictError,
  type LocalRun,
} from "../../src/persistence/index.ts";

const profile: PresentationProfile = {
  reducedMotion: false,
  reducedGraphics: false,
  audio: false,
  descriptions: false,
};
function fixture(
  mode: Manifest["profile"] = "story",
  edit?: (nodes: Node[]) => void,
) {
  const nodes = Array.from({ length: 7 }, (_, i) => {
    const source = structuredClone(SLICE_NODES.find((n) => n.stage === i + 1)!);
    return NodeSchema.parse({
      ...source,
      id: `C${i + 1}`,
      scope: "rail",
      reviewStatus: "reviewed",
      days: 1,
      anchor: true,
      requires: [],
      override: null,
      closing: i === 6,
      advice:
        i === 0
          ? [
              {
                question: "Why?",
                answer: "The route remains open.",
                when: [],
                recommends: "a",
                tone: "candid",
              },
            ]
          : [],
      options: source.options.map((o, j) => ({
        ...o,
        id: j ? "b" : "a",
        effects:
          i === 6
            ? [
                { kind: "fact", fact: "publicRecords", value: true },
                { kind: "fact", fact: "trainedSuccessor", value: true },
                { kind: "fact", fact: "terminalSettlement", value: true },
              ]
            : [],
        incidents: [],
        delayed: [],
      })),
      defaultOptionId: "a",
    });
  });
  edit?.(nodes);
  const manifest = ManifestSchema.parse({
    ...SLICE_MANIFEST,
    id: `collector-fixture-${mode}`,
    profile: mode,
    nodeIds: nodes.map((n) => n.id),
    stageBudgets: Array.from({ length: 7 }, () => [1, 1]),
    maxDecisions: 7,
  });
  return { nodes, manifest };
}
async function harness(
  mode: Manifest["profile"] = "story",
  edit?: (nodes: Node[]) => void,
) {
  const bundle = fixture(mode, edit),
    sqlite = new DatabaseSync(":memory:"),
    DB = sqliteAdapter(sqlite) as Database;
  const env: CollectorEnv = {
    DB,
    V2_ENABLED: "true",
    V2_BUNDLES: [bundle],
    V2_APPROVED_MANIFEST_HASHES: await sha256(bundle.manifest),
  };
  return { ...bundle, sqlite, env, close: () => sqlite.close() };
}
async function call(
  env: CollectorEnv,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  const response = await handler(
    new Request(`https://collector.invalid${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  return {
    status: response.status,
    data: (await response.json()) as Record<string, any>,
  };
}
function credentials() {
  return {
    runId: crypto.randomUUID(),
    runToken: crypto.randomUUID() + crypto.randomUUID(),
  };
}
function registration(c: Campaign, creds = credentials()) {
  return {
    ...creds,
    started: true,
    consentVersion: CONSENT_VERSION,
    manifest: {
      manifestId: c.manifestId,
      engineVersion: c.engineVersion,
      contentVersion: c.contentVersion,
      manifestHash: c.manifestHash,
      contentHash: c.contentHash,
      seed: c.seed,
    },
  };
}
function event(sequence: number, payload: EventPayload): TelemetryEvent {
  return { eventId: crypto.randomUUID(), sequence, payload };
}
function exposure(c: Campaign, sequence = 0, presentation = profile) {
  const p = c.prepared!;
  return event(sequence, {
    type: "node_exposed",
    decisionId: p.id,
    nodeId: p.nodeId,
    revision: p.revision,
    presentation,
  });
}
function decision(
  c: Campaign,
  sequence = 1,
  source: "human" | "agent" | "staff" = "human",
  adviceIds: string[] = [],
) {
  const p = c.prepared!;
  return event(sequence, {
    type: "decision_committed",
    decisionId: p.id,
    requestedOptionId: "a",
    revision: p.revision,
    activeMs: 1234,
    adviceIds,
    source,
  });
}
async function registered(
  h: Awaited<ReturnType<typeof harness>>,
  seed = "same-context",
) {
  const campaign = await createCampaign(h.manifest, h.nodes, seed),
    data = registration(campaign),
    result = await call(h.env, "/v2/runs", data);
  assert.equal(result.status, 201, JSON.stringify(result));
  return {
    campaign,
    creds: { runId: data.runId, runToken: data.runToken },
    number: result.data.runNumber as number,
    data,
  };
}
async function contribute(
  h: Awaited<ReturnType<typeof harness>>,
  source: "human" | "agent" | "staff" = "human",
) {
  const run = await registered(h),
    events = [exposure(run.campaign), decision(run.campaign, 1, source)];
  const result = await call(h.env, "/v2/events", { ...run.creds, events });
  assert.equal(result.status, 200, JSON.stringify(result));
  return {
    ...run,
    key: comparisonKeyFor(
      materialBase(run.campaign, run.campaign.prepared!),
      [],
      profile,
    ),
    events,
  };
}
const count = (h: Awaited<ReturnType<typeof harness>>, table: string) =>
  Number(h.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);

test("v2 is disabled by default; registration requires consent, an approved immutable bundle, and a capability", async () => {
  const h = await harness();
  try {
    const campaign = await createCampaign(h.manifest, h.nodes, "start"),
      body = registration(campaign);
    assert.equal(
      (await call({ ...h.env, V2_ENABLED: undefined }, "/v2/runs", body))
        .status,
      503,
    );
    assert.equal(
      (await call(h.env, "/v2/runs", { ...body, started: false })).status,
      400,
    );
    assert.equal(
      (await call(h.env, "/v2/runs", { ...body, consentVersion: "legacy" }))
        .status,
      400,
    );
    assert.equal(
      (
        await call(h.env, "/v2/runs", {
          ...body,
          email: "nobody@example.invalid",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(h.env, "/v2/runs", {
          ...body,
          manifest: { ...body.manifest, seed: "illegal seed" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          { ...h.env, V2_APPROVED_MANIFEST_HASHES: "" },
          "/v2/runs",
          body,
        )
      ).status,
      409,
    );
    const first = await call(h.env, "/v2/runs", body),
      retry = await call(h.env, "/v2/runs", body);
    assert.equal(first.status, 201);
    assert.equal(first.data.runNumber, retry.data.runNumber);
    assert.equal(count(h, "v2_runs"), 1);
    assert.equal(
      (
        await call(h.env, "/v2/runs", {
          ...body,
          runToken: credentials().runToken,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(h.env, "/v2/runs", {
          ...body,
          manifest: { ...body.manifest, seed: "changed" },
        })
      ).status,
      409,
    );
    const row = h.sqlite.prepare("SELECT * FROM v2_runs").get()!;
    assert.notEqual(row.token_hash, body.runToken);
    assert.ok(!JSON.stringify(first.data).includes(body.runToken));
    assert.equal(
      (
        await call(h.env, "/v2/events", {
          runId: body.runId,
          runToken: body.runToken,
          events: [exposure(campaign)],
          journal: campaign.journal,
        })
      ).status,
      400,
    );
  } finally {
    h.close();
  }
});

test("canonical replay rejects invented exposure, options, advice, ordering and edited retries without partial writes", async () => {
  const h = await harness();
  try {
    const run = await registered(h),
      start = exposure(run.campaign),
      choice = decision(run.campaign);
    const bad = structuredClone(choice);
    if (bad.payload.type === "decision_committed")
      bad.payload.requestedOptionId = "invented";
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events: [start, bad] }))
        .status,
      400,
    );
    assert.equal(count(h, "v2_events"), 0);
    const invented = structuredClone(start);
    if (invented.payload.type === "node_exposed")
      invented.payload.nodeId = "fiction";
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events: [invented] }))
        .status,
      409,
    );
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events: [choice] }))
        .status,
      409,
    );
    const badAdvice = event(1, {
      type: "advice_exposed",
      decisionId: run.campaign.prepared!.id,
      adviceId: "invented",
    });
    assert.equal(
      (
        await call(h.env, "/v2/events", {
          ...run.creds,
          events: [start, badAdvice],
        })
      ).status,
      400,
    );
    assert.equal(count(h, "v2_events"), 0);
    const batch = { ...run.creds, events: [start, choice] };
    assert.equal((await call(h.env, "/v2/events", batch)).status, 200);
    assert.equal((await call(h.env, "/v2/events", batch)).status, 200);
    assert.equal(count(h, "v2_events"), 2);
    assert.equal(count(h, "v2_choices"), 1);
    const changed = structuredClone(choice);
    if (changed.payload.type === "decision_committed")
      changed.payload.requestedOptionId = "b";
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events: [changed] }))
        .status,
      409,
    );
    const stored = JSON.parse(
      String(
        h.sqlite
          .prepare("SELECT payload FROM v2_events WHERE sequence=1")
          .get()!.payload,
      ),
    );
    assert.equal(stored.activeMs, 1200);
    assert.equal(stored.comparisonKey, undefined);
    const replay = JSON.parse(
      String(
        h.sqlite.prepare("SELECT campaign_json FROM v2_runs").get()!
          .campaign_json,
      ),
    );
    assert.equal(replay.journal[0].requestedOptionId, "a");
    assert.equal(replay.revision, 1);
  } finally {
    h.close();
  }
});

test("material cells distinguish semantic sides, authority, advice and the actual preference exposure history", async () => {
  const h = await harness();
  try {
    const run = await registered(h),
      p = run.campaign.prepared!,
      advice = availableAdvice(p)[0].id,
      changed = { ...profile, reducedMotion: true };
    const events = [
      exposure(run.campaign),
      exposure(run.campaign, 1, changed),
      event(2, { type: "advice_exposed", decisionId: p.id, adviceId: advice }),
      decision(run.campaign, 3, "human", [advice]),
    ];
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events })).status,
      200,
    );
    const expected = comparisonKeyFor(
      materialBase(run.campaign, p),
      [advice],
      [profile, changed],
    );
    assert.equal(
      h.sqlite.prepare("SELECT comparison_key FROM v2_choices").get()!
        .comparison_key,
      expected,
    );
    assert.notEqual(
      expected,
      comparisonKeyFor(materialBase(run.campaign, p), [], [profile, changed]),
    );
    assert.notEqual(
      expected,
      comparisonKeyFor(materialBase(run.campaign, p), [advice], changed),
    );
    assert.notEqual(
      expected,
      comparisonKeyFor(
        materialBase(run.campaign, {
          ...p,
          leftOptionId: p.rightOptionId,
          rightOptionId: p.leftOptionId,
        }),
        [advice],
        [profile, changed],
      ),
    );
    assert.notEqual(
      expected,
      comparisonKeyFor(
        materialBase(run.campaign, {
          ...p,
          control: { ...p.control, rail: "assistant" },
        }),
        [advice],
        [profile, changed],
      ),
    );
  } finally {
    h.close();
  }
});

test("public cell releases require 20 eligible runs, an hour and 20 new contributions; withdrawal invalidates without recalling history", async () => {
  const h = await harness();
  try {
    const runs = [];
    for (let i = 0; i < 19; i++) runs.push(await contribute(h));
    const key = runs[0].key,
      path = `/v2/aggregates?key=${encodeURIComponent(key)}`;
    let result = await call(h.env, path);
    assert.equal(result.data.available, false);
    assert.equal(result.data.n, undefined);
    runs.push(await contribute(h));
    result = await call(h.env, path);
    assert.equal(result.data.n, 20);
    assert.deepEqual(result.data.counts, { a: 20 });
    const published = structuredClone(result.data);
    for (let i = 0; i < 19; i++) runs.push(await contribute(h));
    h.sqlite
      .prepare("UPDATE v2_cells SET as_of='2000-01-01T00:00:00.000Z'")
      .run();
    assert.equal(
      (await call(h.env, path)).data.n,
      20,
      "19 new runs do not release a difference",
    );
    runs.push(await contribute(h));
    assert.equal((await call(h.env, path)).data.n, 40);
    runs.push(await contribute(h));
    assert.equal((await call(h.env, path)).data.n, 40);
    const withdrawn = await call(
      h.env,
      `/v2/runs/${runs[0].creds.runId}`,
      runs[0].creds,
      "DELETE",
    );
    assert.equal(withdrawn.status, 200);
    assert.match(withdrawn.data.snapshotNotice, /cannot be recalled/);
    assert.equal((await call(h.env, path)).data.available, false);
    assert.equal(
      published.n,
      20,
      "a previously downloaded release is not magically removed",
    );
    assert.equal(
      (
        await call(
          h.env,
          `/v2/runs/${runs[0].creds.runId}`,
          runs[0].creds,
          "DELETE",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(h.env, "/v2/events", {
          ...runs[0].creds,
          events: runs[0].events,
        })
      ).status,
      410,
    );
    const row = h.sqlite
      .prepare("SELECT * FROM v2_runs WHERE number=?")
      .get(runs[0].number)!;
    assert.equal(row.campaign_json, null);
    assert.equal(row.manifest_json, null);
    assert.equal(
      h.sqlite
        .prepare("SELECT count(*) AS n FROM v2_events WHERE run_number=?")
        .get(runs[0].number)!.n,
      0,
    );
  } finally {
    h.close();
  }
});

test("test/slice, marked agent/staff and overridden decisions never enter free-choice cells", async () => {
  for (const mode of ["test", "slice"] as const) {
    const h = await harness(mode);
    try {
      await contribute(h);
      assert.equal(count(h, "v2_choices"), 0);
    } finally {
      h.close();
    }
  }
  const h = await harness();
  try {
    await contribute(h, "agent");
    await contribute(h, "staff");
    assert.equal(count(h, "v2_choices"), 0);
  } finally {
    h.close();
  }
  const overridden = await harness("story", (nodes) => {
    nodes[0].override = {
      when: [{ kind: "metric", metric: "gdp", op: "gte", value: 0 }],
      optionId: "b",
      executor: "institution",
      reason: "Fixture authority supersedes controller.",
    };
  });
  try {
    await contribute(overridden);
    assert.equal(count(overridden, "v2_choices"), 0);
    const replay = JSON.parse(
      String(
        overridden.sqlite.prepare("SELECT campaign_json FROM v2_runs").get()!
          .campaign_json,
      ),
    );
    assert.equal(replay.journal[0].status, "overridden");
  } finally {
    overridden.close();
  }
});

test("withdraw-before-registration creates an authenticated tombstone; incorrect secrets are never reported as withdrawn", async () => {
  const h = await harness();
  try {
    const c = await createCampaign(h.manifest, h.nodes, "late"),
      body = registration(c),
      creds = { runId: body.runId, runToken: body.runToken };
    assert.equal(
      (await call(h.env, `/v2/runs/${body.runId}`, creds, "DELETE")).status,
      200,
    );
    assert.equal(
      (await call(h.env, "/v2/runs", body)).status,
      410,
      "delayed registration cannot resurrect a withdrawn run",
    );
    assert.equal(
      (
        await call(
          h.env,
          `/v2/runs/${body.runId}`,
          { ...creds, runToken: credentials().runToken },
          "DELETE",
        )
      ).status,
      403,
    );
    assert.equal(
      (await call(h.env, `/v2/runs/${crypto.randomUUID()}`, creds, "DELETE"))
        .status,
      400,
    );
    assert.equal(count(h, "v2_events"), 0);
    assert.equal(count(h, "v2_choices"), 0);
  } finally {
    h.close();
  }
});

test("retention invalidates affected cells and removes journals; legacy data remains separate", async () => {
  const h = await harness();
  try {
    h.sqlite.exec(
      "CREATE TABLE runs (id TEXT); INSERT INTO runs(id) VALUES ('legacy');",
    );
    const run = await contribute(h);
    h.sqlite
      .prepare(
        "UPDATE v2_runs SET started_day=date('now','-366 days') WHERE number=?",
      )
      .run(run.number);
    h.sqlite
      .prepare(
        "UPDATE v2_cells SET valid=1,published_n=20,published_counts='{\"a\":20}'",
      )
      .run();
    await cleanupV2(h.env);
    assert.equal(count(h, "v2_events"), 0);
    assert.equal(count(h, "v2_choices"), 0);
    assert.equal(count(h, "runs"), 1);
    const row = h.sqlite.prepare("SELECT * FROM v2_runs").get()!;
    assert.equal(row.expired, 1);
    assert.equal(row.campaign_json, null);
    assert.equal(row.manifest_json, null);
    assert.equal((await call(h.env, "/v2/runs", run.data)).status, 410);
    assert.equal(
      (await call(h.env, `/v2/aggregates?key=${encodeURIComponent(run.key)}`))
        .data.available,
      false,
    );
    assert.equal(
      (await call(h.env, "/v2/cleanup", {})).status,
      404,
      "maintenance is not an unauthenticated HTTP route",
    );
  } finally {
    h.close();
  }
});

test("client makes no private network requests and cannot bootstrap private or imported history", async () => {
  const h = await harness(),
    original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Unexpected request");
  };
  try {
    const c = await createCampaign(h.manifest, h.nodes, "local"),
      run = newSession(c, profile, false);
    recordExposure(run);
    await syncRun(run, "https://collector.invalid");
    assert.equal(calls, 0);
    run.campaign = await commitChoice(
      c,
      {
        decisionId: c.prepared!.id,
        expectedRevision: 0,
        optionId: "a",
        actor: "human",
      },
      h.nodes,
    );
    recordDecision(run, run.campaign.journal[0], 10);
    run.sharing = true;
    run.consentVersion = CONSENT_VERSION;
    recordExposure(run);
    await syncRun(run, "https://collector.invalid");
    assert.equal(calls, 0);
    assert.equal(telemetryStatus(run).stopped, true);
    const imported = newSession(run.campaign, profile, true);
    recordExposure(imported);
    await syncRun(imported, "https://collector.invalid");
    assert.equal(calls, 0);
    assert.equal(telemetryStatus(imported).stopped, true);
    const unset = newSession(c, profile, true);
    recordExposure(unset);
    await syncRun(unset, "");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
    h.close();
  }
});

test("client replay uses saved prior exposure, real advisor IDs and changed preferences; retries contain no raw campaign or timestamps", async () => {
  const h = await harness(),
    original = globalThis.fetch,
    requests: { url: string; body: any; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      init: init ?? {},
    });
    return handler(new Request(url, init), h.env);
  };
  try {
    const c = await createCampaign(h.manifest, h.nodes, "client"),
      run = newSession(c, profile, true),
      p = c.prepared!;
    recordExposure(run);
    recordExposure(run);
    assert.equal(telemetryStatus(run).pending, 1);
    const advice = availableAdvice(p)[0].id;
    recordAdvice(run, advice);
    recordAdvice(run, advice);
    run.preferences.reducedGraphics = true;
    recordExposure(run);
    assert.equal(telemetryStatus(run).pending, 3);
    run.campaign = await commitChoice(
      c,
      {
        decisionId: p.id,
        expectedRevision: c.revision,
        optionId: "a",
        actor: "human",
        adviceIds: [advice],
      },
      h.nodes,
    );
    const record = run.campaign.journal[0];
    recordDecision(run, record, 1234);
    recordDecision(run, record, 1234);
    recordExposure(run);
    await syncRun(run, "https://collector.invalid");
    assert.equal(telemetryStatus(run).pending, 0);
    assert.equal(telemetryStatus(run).stopped, false);
    assert.equal(count(h, "v2_choices"), 1);
    assert.equal(
      h.sqlite.prepare("SELECT comparison_key FROM v2_choices").get()!
        .comparison_key,
      aggregateKeyFor(run, record),
    );
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.started, true);
    assert.equal(requests[1].body.events.length, 5);
    for (const request of requests) {
      assert.equal(request.init.credentials, "omit");
      assert.equal(request.init.referrerPolicy, "no-referrer");
      assert.equal(request.body.campaign, undefined);
      assert.equal(request.body.journal, undefined);
      for (const e of request.body.events ?? [])
        assert.equal(e.createdAt, undefined);
    }
    assert.equal((publicExport(run) as any).secret, undefined);
    assert.equal((publicExport(run) as any).queue, undefined);
    assert.equal(
      (
        await readAggregate(
          "https://collector.invalid",
          aggregateKeyFor(run, record),
        )
      ).available,
      false,
    );
    await withdrawRun(run, "https://collector.invalid");
    assert.equal(run.withdrawn, true);
    assert.equal(run.sharing, false);
    assert.equal(count(h, "v2_events"), 0);
  } finally {
    globalThis.fetch = original;
    h.close();
  }
});

test("expired or overflowing local queues stop sharing without blocking the simulation", async () => {
  const h = await harness(),
    original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Unexpected request");
  };
  try {
    const c = await createCampaign(h.manifest, h.nodes, "queue"),
      expired = newSession(c, profile, true);
    recordExposure(expired);
    for (const entry of expired.queue as any[])
      if (entry.kind === "telemetry-event")
        entry.createdAt = Date.now() - QUEUE_TTL_MS - 1;
    await syncRun(expired, "https://collector.invalid");
    assert.equal(calls, 0);
    assert.equal(telemetryStatus(expired).stopped, true);
    assert.match(telemetryStatus(expired).error!, /expired/);
    const full = newSession(c, profile, true);
    for (let i = 0; i < 2001; i++) {
      full.preferences.audio = !full.preferences.audio;
      recordExposure(full);
    }
    assert.equal(telemetryStatus(full).stopped, true);
    assert.equal(telemetryStatus(full).pending, 0);
    assert.equal(
      (
        await commitChoice(
          c,
          {
            decisionId: c.prepared!.id,
            expectedRevision: 0,
            optionId: "a",
            actor: "human",
          },
          h.nodes,
        )
      ).revision,
      1,
    );
  } finally {
    globalThis.fetch = original;
    h.close();
  }
});

test("client withdrawal only reports success with a confirmed receipt, including a never-registered run", async () => {
  const h = await harness(),
    original = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    handler(new Request(String(input), init), h.env);
  try {
    const run = newSession(
      await createCampaign(h.manifest, h.nodes, "withdraw-client"),
      profile,
      true,
    );
    await withdrawRun(run, "https://collector.invalid");
    assert.equal(run.withdrawn, true);
    const other = newSession(
      await createCampaign(h.manifest, h.nodes, "wrong-key"),
      profile,
      true,
    );
    recordExposure(other);
    await syncRun(other, "https://collector.invalid");
    other.secret = credentials().runToken;
    await assert.rejects(
      withdrawRun(other, "https://collector.invalid"),
      /key incorrect/,
    );
    assert.equal(other.withdrawn, false);
    assert.equal(other.sharing, false);
    assert.equal(telemetryStatus(other).pending, 0);
  } finally {
    globalThis.fetch = original;
    h.close();
  }
});

test("body, batch and anonymous rate limits reject oversized work; CORS is not treated as identity", async () => {
  const h = await harness();
  try {
    const run = await registered(h),
      tooMany = Array.from({ length: 33 }, (_, i) => exposure(run.campaign, i));
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events: tooMany }))
        .status,
      400,
    );
    assert.equal(count(h, "v2_events"), 0);
    const response = await handler(
      new Request("https://collector.invalid/v2/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padding: "x".repeat(65536) }),
      }),
      h.env,
    );
    assert.equal(response.status, 413);
    const denied = await handler(
      new Request("https://collector.invalid/v2/health", {
        headers: { Origin: "https://untrusted.invalid" },
      }),
      h.env,
    );
    assert.equal(denied.status, 403);
    assert.equal(
      (await call(h.env, "/v2/health")).status,
      200,
      "scripts without an Origin header remain possible and are not verified humans",
    );
    const allowed = await handler(
      new Request("https://collector.invalid/v2/health", {
        headers: { Origin: "https://ammarphp.github.io" },
      }),
      h.env,
    );
    assert.equal(
      allowed.headers.get("Access-Control-Allow-Origin"),
      "https://ammarphp.github.io",
    );
    h.sqlite
      .prepare("UPDATE v2_rate_windows SET count=120 WHERE window_key=?")
      .run(`${Math.floor(Date.now() / 60000)}:registrations`);
    assert.equal(
      (await call(h.env, "/v2/runs", registration(run.campaign))).status,
      429,
    );
    assert.equal(count(h, "v2_runs"), 1);
  } finally {
    h.close();
  }
});

test("a failed database batch rolls back both replay and contribution, then the same events can retry", async () => {
  const h = await harness();
  try {
    const run = await registered(h),
      events = [exposure(run.campaign), decision(run.campaign)];
    h.sqlite.exec(
      "CREATE TRIGGER reject_fixture_choice BEFORE INSERT ON v2_choices BEGIN SELECT RAISE(ABORT,'fixture failure'); END;",
    );
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events })).status,
      500,
    );
    assert.equal(count(h, "v2_events"), 0);
    assert.equal(count(h, "v2_choices"), 0);
    assert.equal(
      h.sqlite.prepare("SELECT last_sequence FROM v2_runs").get()!
        .last_sequence,
      -1,
    );
    h.sqlite.exec("DROP TRIGGER reject_fixture_choice");
    assert.equal(
      (await call(h.env, "/v2/events", { ...run.creds, events })).status,
      200,
    );
    assert.equal(count(h, "v2_events"), 2);
  } finally {
    h.close();
  }
});

test("transport batches at 32; a lost acknowledgement retries the identical event IDs without duplicate contribution", async () => {
  const h = await harness(),
    original = globalThis.fetch,
    batchLengths: number[] = [];
  let loseOnce = true;
  globalThis.fetch = async (input, init) => {
    const response = await handler(new Request(String(input), init), h.env);
    if (String(input).endsWith("/v2/events")) {
      batchLengths.push(JSON.parse(String(init?.body)).events.length);
      if (loseOnce) {
        loseOnce = false;
        throw new Error("Fixture response lost after commit");
      }
    }
    return response;
  };
  let run: LocalRun | undefined;
  try {
    const c = await createCampaign(h.manifest, h.nodes, "batch"),
      p = c.prepared!;
    run = newSession(c, profile, true);
    recordExposure(run);
    run.campaign = await commitChoice(
      c,
      { decisionId: p.id, expectedRevision: 0, optionId: "a", actor: "human" },
      h.nodes,
    );
    recordDecision(run, run.campaign.journal[0], 100);
    const state = run.queue.find(
      (x: any) => x.kind === "telemetry-state",
    ) as any;
    for (let i = 0; i < 63; i++)
      run.queue.push({
        kind: "telemetry-event",
        createdAt: Date.now(),
        event: event(state.nextSequence++, {
          type: "reflection_added",
          decisionId: p.id,
          confidence: "unsure",
          reason: "control",
        }),
      });
    await syncRun(run, "https://collector.invalid");
    assert.equal(telemetryStatus(run).pending, 65);
    assert.equal(count(h, "v2_events"), 32);
    assert.equal(count(h, "v2_choices"), 1);
    state.retryAt = 0;
    await syncRun(run, "https://collector.invalid");
    assert.equal(telemetryStatus(run).pending, 0);
    assert.deepEqual(batchLengths, [32, 32, 32, 1]);
    assert.equal(count(h, "v2_events"), 65);
    assert.equal(count(h, "v2_choices"), 1);
    await assert.rejects(withdrawRun(run, ""), /collector address/);
    assert.equal(
      run.withdrawn,
      false,
      "missing configuration cannot confirm remote removal",
    );
  } finally {
    if (run) {
      run.sharing = false;
      await syncRun(run, "");
    }
    globalThis.fetch = original;
    h.close();
  }
});

test("public snapshots never create releases and contain only valid previously thresholded cells", async () => {
  const h = await harness();
  try {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push(await contribute(h));
    const before = h.sqlite
      .prepare("SELECT valid,published_counts FROM v2_cells")
      .get()!;
    assert.equal(before.valid, 0);
    let result = await call(h.env, "/v2/snapshot");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.cells, []);
    assert.equal(result.data.complete, true);
    assert.equal(result.data.nextCursor, null);
    assert.equal(
      h.sqlite.prepare("SELECT valid FROM v2_cells").get()!.valid,
      0,
      "snapshot GET does not publish qualified-but-unreleased data",
    );
    assert.deepEqual(
      await refreshAggregatesV2({ ...h.env, V2_ENABLED: undefined }),
      { status: "disabled", considered: 0, released: 0, hasMore: false },
    );
    const refreshed = await refreshAggregatesV2(h.env);
    assert.equal(refreshed.released, 1);
    assert.equal(refreshed.considered, 1);
    result = await call(h.env, "/v2/snapshot");
    assert.equal(result.status, 200);
    assert.equal(result.data.status, "live-validity-checked");
    assert.equal(result.data.unit, "recorded_run");
    assert.equal(result.data.cells.length, 1);
    assert.equal(result.data.cells[0].n, 20);
    assert.deepEqual(result.data.cells[0].counts, { a: 20 });
    assert.equal(result.data.cells[0].comparisonKey, runs[0].key);
    assert.equal(
      Date.parse(result.data.expiresAt) - Date.parse(result.data.generatedAt),
      3600000,
    );
    assert.match(result.data.withdrawalNotice, /cannot be recalled/);
    const text = JSON.stringify(result.data);
    for (const run of runs) {
      assert.ok(!text.includes(run.creds.runId));
      assert.ok(!text.includes(run.creds.runToken));
    }
    assert.ok(!text.includes("campaign_json"));
    assert.ok(!text.includes("seed"));
    assert.deepEqual(await refreshAggregatesV2(h.env), {
      status: "refreshed",
      considered: 0,
      released: 0,
      hasMore: false,
    });
    const generation = result.data.generation;
    await call(
      h.env,
      `/v2/runs/${runs[0].creds.runId}`,
      runs[0].creds,
      "DELETE",
    );
    result = await call(h.env, "/v2/snapshot");
    assert.equal(result.data.cells.length, 0);
    assert.notEqual(result.data.generation, generation);
    assert.equal(
      (await call(h.env, `/v2/snapshot?generation=${generation}`)).status,
      409,
      "builds must restart if a withdrawal invalidates an earlier page",
    );
    assert.equal(
      (await call(h.env, "/v2/refresh", {})).status,
      404,
      "refresh has no unauthenticated HTTP endpoint",
    );
  } finally {
    h.close();
  }
});

test("snapshot pages have generation checks, row/byte caps and no under-threshold enumeration", async () => {
  const h = await harness();
  try {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push(await contribute(h));
    await refreshAggregatesV2(h.env);
    const template = h.sqlite.prepare("SELECT * FROM v2_cells").get()!;
    // Published-cell fixture only: snapshot transport is tested independently of
    // semantic authoring with 104 further already-released material contexts.
    for (let i = 0; i < 104; i++) {
      const key = `${runs[0].key}:released-fixture-${String(i).padStart(3, "0")}`;
      h.sqlite
        .prepare(
          "INSERT INTO v2_cells(comparison_key,published_counts,published_n,as_of,watermark,valid) VALUES (?,?,?,?,?,1)",
        )
        .run(key, template.published_counts, 20, template.as_of, 20);
      for (const run of runs)
        h.sqlite
          .prepare(
            "INSERT INTO v2_choices(run_number,comparison_key,decision_id,option_id) VALUES (?,?,?,?)",
          )
          .run(run.number, key, `fixture-${i}`, "a");
    }
    h.sqlite
      .prepare(
        "INSERT INTO v2_cells(comparison_key,published_counts,published_n,as_of,valid) VALUES (?,?,?,?,1)",
      )
      .run("v2:unqualified-fixture", '{"a":19}', 19, template.as_of);
    const first = await call(h.env, "/v2/snapshot");
    assert.equal(first.status, 200);
    assert.equal(first.data.cells.length, 100);
    assert.equal(first.data.complete, false);
    assert.ok(first.data.nextCursor);
    assert.ok(
      new TextEncoder().encode(JSON.stringify(first.data)).byteLength <=
        MAX_SNAPSHOT_BYTES,
    );
    const next = await call(
      h.env,
      `/v2/snapshot?cursor=${encodeURIComponent(first.data.nextCursor)}&generation=${first.data.generation}`,
    );
    assert.equal(next.status, 200);
    assert.equal(next.data.cells.length, 5);
    assert.equal(next.data.complete, true);
    assert.equal(next.data.generation, first.data.generation);
    assert.equal(
      new Set(
        [...first.data.cells, ...next.data.cells].map(
          (x: any) => x.comparisonKey,
        ),
      ).size,
      105,
    );
    assert.ok(
      !JSON.stringify([first.data, next.data]).includes("unqualified-fixture"),
    );
    assert.equal((await call(h.env, "/v2/snapshot?limit=101")).status, 400);
    assert.equal((await call(h.env, "/v2/snapshot?limit=0")).status, 400);
    assert.equal(
      (await call(h.env, "/v2/snapshot?limit=2&limit=3")).status,
      400,
    );
    assert.equal((await call(h.env, "/v2/snapshot?runId=private")).status, 400);
    assert.equal(
      (
        await call(
          h.env,
          `/v2/snapshot?cursor=${encodeURIComponent(first.data.nextCursor)}`,
        )
      ).status,
      400,
    );
    h.sqlite
      .prepare(
        "UPDATE v2_runs SET started_day=date('now','-366 days') WHERE number=?",
      )
      .run(runs[0].number);
    assert.deepEqual(
      (await call(h.env, "/v2/snapshot")).data.cells,
      [],
      "missed cleanup withholds an affected cell rather than exposing expired membership",
    );
  } finally {
    h.close();
  }
});

test("snapshot byte cap paginates long public keys and fails closed on corrupt published counts", async () => {
  const h = await harness();
  try {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push(await contribute(h));
    await refreshAggregatesV2(h.env);
    const row = h.sqlite.prepare("SELECT * FROM v2_cells").get()!;
    for (let i = 0; i < 30; i++) {
      const key = `v2:long-public-fixture-${String(i).padStart(3, "0")}:${"x".repeat(11000)}`;
      h.sqlite
        .prepare(
          "INSERT INTO v2_cells(comparison_key,published_counts,published_n,as_of,watermark,valid) VALUES (?,?,?,?,?,1)",
        )
        .run(key, row.published_counts, 20, row.as_of, 20);
      for (const run of runs)
        h.sqlite
          .prepare(
            "INSERT INTO v2_choices(run_number,comparison_key,decision_id,option_id) VALUES (?,?,?,?)",
          )
          .run(run.number, key, `long-${i}`, "a");
    }
    const first = await call(h.env, "/v2/snapshot");
    assert.equal(first.status, 200);
    assert.ok(first.data.cells.length < 31);
    assert.ok(first.data.cells.length > 0);
    assert.equal(first.data.complete, false);
    assert.ok(
      new TextEncoder().encode(JSON.stringify(first.data)).byteLength <=
        MAX_SNAPSHOT_BYTES,
    );
    const second = await call(
      h.env,
      `/v2/snapshot?cursor=${encodeURIComponent(first.data.nextCursor)}&generation=${first.data.generation}`,
    );
    assert.equal(second.status, 200);
    assert.equal(first.data.cells.length + second.data.cells.length, 31);
    assert.equal(second.data.complete, true);
    h.sqlite
      .prepare(
        "UPDATE v2_cells SET published_counts='not-json' WHERE comparison_key=?",
      )
      .run(runs[0].key);
    const invalid = await call(h.env, "/v2/snapshot");
    assert.equal(invalid.status, 503);
    assert.equal(invalid.data.cells, undefined);
    assert.ok(!JSON.stringify(invalid.data).includes(runs[0].key));
  } finally {
    h.close();
  }
});

test("aggregate client distinguishes live suppression from outages and malformed replies", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          available: false,
          status: "insufficient",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    assert.deepEqual(
      await readAggregate("https://collector.invalid", "v2:key"),
      { available: false, status: "suppressed" },
    );
    globalThis.fetch = async () => {
      throw new Error("Fixture offline");
    };
    assert.deepEqual(
      await readAggregate("https://collector.invalid", "v2:key"),
      { available: false, status: "unavailable" },
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          available: true,
          comparisonKey: "wrong",
          n: 20,
          counts: { a: 20 },
          asOf: new Date().toISOString(),
        }),
      );
    assert.equal(
      (await readAggregate("https://collector.invalid", "v2:key")).status,
      "unavailable",
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          available: false,
          status: "unknown",
        }),
      );
    assert.equal(
      (await readAggregate("https://collector.invalid", "v2:key")).status,
      "unavailable",
    );
    const asOf = new Date().toISOString();
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          available: true,
          comparisonKey: "v2:key",
          n: 20,
          counts: { a: 20 },
          asOf,
        }),
      );
    assert.deepEqual(
      await readAggregate("https://collector.invalid", "v2:key"),
      { available: true, status: "available", n: 20, counts: { a: 20 }, asOf },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("withdrawal during snapshot assembly rejects the whole page instead of returning a stale cell", async () => {
  const h = await harness();
  try {
    const runs: Awaited<ReturnType<typeof contribute>>[] = [];
    for (let i = 0; i < 20; i++) runs.push(await contribute(h));
    await refreshAggregatesV2(h.env);
    let withdrew = false;
    const db: Database = {
      ...h.env.DB,
      prepare(sql) {
        const raw = h.env.DB.prepare(sql);
        if (!sql.startsWith("SELECT c.comparison_key,c.published_counts"))
          return raw;
        const wrap = (
          statement: ReturnType<Database["prepare"]>,
        ): ReturnType<Database["prepare"]> => ({
          ...statement,
          bind(...values) {
            return wrap(statement.bind(...values));
          },
          async all<T>() {
            const result = await statement.all<T>();
            if (!withdrew) {
              withdrew = true;
              assert.equal(
                (
                  await call(
                    h.env,
                    `/v2/runs/${runs[0].creds.runId}`,
                    runs[0].creds,
                    "DELETE",
                  )
                ).status,
                200,
              );
            }
            return result;
          },
        });
        return wrap(raw);
      },
    };
    const result = await call({ ...h.env, DB: db }, "/v2/snapshot");
    assert.equal(result.status, 409);
    assert.equal(result.data.cells, undefined);
    assert.equal(withdrew, true);
    assert.deepEqual((await call(h.env, "/v2/snapshot")).data.cells, []);
  } finally {
    h.close();
  }
});

test("a stale save blocks registration before any network request and preserves both campaign branches", async () => {
  const h = await harness(),
    originalFetch = globalThis.fetch,
    originalIDB = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error("Conflict must precede the request");
  };
  try {
    const winner = newSession(
      await createCampaign(h.manifest, h.nodes, "conflict-before-start"),
      profile,
      true,
    );
    recordExposure(winner);
    await saveRun(winner);
    const stale = structuredClone(winner);
    winner.preferences.audio = true;
    await saveRun(winner);
    const savedWinner = structuredClone((await listRuns())[0]);
    const p = stale.campaign.prepared!;
    stale.campaign = await commitChoice(
      stale.campaign,
      { decisionId: p.id, expectedRevision: 0, optionId: "b", actor: "human" },
      h.nodes,
    );
    recordDecision(stale, stale.campaign.journal[0], 100);
    const openBranch = structuredClone(stale.campaign);
    await assert.rejects(
      syncRun(stale, "https://collector.invalid"),
      SaveConflictError,
    );
    assert.equal(requests, 0);
    assert.equal(stale.sharing, false);
    assert.equal(telemetryStatus(stale).pending, 0);
    assert.equal(telemetryStatus(stale).stopped, true);
    assert.equal(telemetryStatus(stale).saveConflictError, true);
    assert.match(telemetryStatus(stale).error!, /Another tab/);
    assert.deepEqual(
      stale.campaign,
      openBranch,
      "the rejected local branch remains exportable",
    );
    assert.deepEqual(
      (await listRuns())[0],
      savedWinner,
      "telemetry cannot overwrite the winning save",
    );
    stale.preferences.descriptions = true;
    recordExposure(stale);
    await syncRun(stale, "https://collector.invalid");
    assert.equal(requests, 0);
    assert.equal(telemetryStatus(stale).pending, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.indexedDB = originalIDB;
    h.close();
  }
});

test("an already-registered conflicting branch cannot send another batch but can withdraw with its capability", async () => {
  const h = await harness(),
    originalFetch = globalThis.fetch,
    originalIDB = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    paths.push(new URL(String(input)).pathname);
    return handler(new Request(String(input), init), h.env);
  };
  try {
    const run = newSession(
      await createCampaign(h.manifest, h.nodes, "conflict-after-registration"),
      profile,
      true,
    );
    recordExposure(run);
    await syncRun(run, "https://collector.invalid");
    assert.equal(count(h, "v2_events"), 1);
    const winner = structuredClone(run);
    winner.preferences.audio = true;
    await saveRun(winner);
    const storedWinner = structuredClone((await listRuns())[0]);
    const p = run.campaign.prepared!;
    run.campaign = await commitChoice(
      run.campaign,
      { decisionId: p.id, expectedRevision: 0, optionId: "a", actor: "human" },
      h.nodes,
    );
    recordDecision(run, run.campaign.journal[0], 100);
    const priorRequests = paths.length;
    await assert.rejects(
      syncRun(run, "https://collector.invalid"),
      SaveConflictError,
    );
    assert.equal(paths.length, priorRequests);
    assert.equal(count(h, "v2_events"), 1);
    assert.equal(count(h, "v2_choices"), 0);
    assert.equal(run.sharing, false);
    await withdrawRun(run, "https://collector.invalid");
    assert.equal(run.withdrawn, true);
    assert.equal(paths.at(-1), `/v2/runs/${run.id}`);
    assert.equal(count(h, "v2_events"), 0);
    assert.equal(
      h.sqlite.prepare("SELECT withdrawn FROM v2_runs").get()!.withdrawn,
      1,
    );
    assert.equal(telemetryStatus(run).saveConflictError, true);
    assert.match(telemetryStatus(run).error!, /withdrawal was confirmed/);
    assert.deepEqual(
      (await listRuns())[0],
      storedWinner,
      "withdrawal does not force a conflicting local save",
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.indexedDB = originalIDB;
    h.close();
  }
});

test("conflict after a registration receipt stops queued choices before upload", async () => {
  const h = await harness(),
    originalFetch = globalThis.fetch,
    originalIDB = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  const paths: string[] = [];
  let run: LocalRun;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    const response = await handler(new Request(String(input), init), h.env);
    if (path === "/v2/runs") {
      const winningTab = structuredClone(run);
      winningTab.preferences.audio = true;
      await saveRun(winningTab);
    }
    return response;
  };
  try {
    run = newSession(
      await createCampaign(h.manifest, h.nodes, "conflict-at-receipt"),
      profile,
      true,
    );
    recordExposure(run);
    await assert.rejects(
      syncRun(run, "https://collector.invalid"),
      SaveConflictError,
    );
    assert.deepEqual(paths, ["/v2/runs"]);
    assert.equal(count(h, "v2_runs"), 1);
    assert.equal(count(h, "v2_events"), 0);
    assert.equal(telemetryStatus(run).pending, 0);
    assert.equal(run.sharing, false);
    await withdrawRun(run, "https://collector.invalid");
    assert.equal(run.withdrawn, true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.indexedDB = originalIDB;
    h.close();
  }
});

test("save conflict cancels an existing background retry and never schedules its replacement", async () => {
  const h = await harness(),
    originalFetch = globalThis.fetch,
    originalIDB = globalThis.indexedDB,
    originalSet = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout;
  globalThis.indexedDB = new IDBFactory();
  const scheduled: { handle: ReturnType<typeof setTimeout>; delay: number }[] =
      [],
    cleared = new Set<unknown>();
  let requests = 0;
  let run: LocalRun | undefined;
  globalThis.setTimeout = ((fn: any, delay?: number, ...args: any[]) => {
    const handle = originalSet(fn, delay, ...args);
    scheduled.push({ handle, delay: delay ?? 0 });
    return handle;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((handle: any) => {
    cleared.add(handle);
    return originalClear(handle);
  }) as typeof clearTimeout;
  globalThis.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ error: "Temporary fixture outage" }), {
      status: 503,
    });
  };
  try {
    run = newSession(
      await createCampaign(h.manifest, h.nodes, "conflict-retry"),
      profile,
      true,
    );
    recordExposure(run);
    await syncRun(run, "https://collector.invalid");
    assert.equal(requests, 1);
    const retry = scheduled.find(
      (timer) => timer.delay >= 2000 && timer.delay < 4000,
    );
    assert.ok(retry, "temporary transport error queued a real retry");
    const winner = structuredClone(run);
    winner.preferences.audio = true;
    await saveRun(winner);
    const state = run.queue.find(
      (x: any) => x.kind === "telemetry-state",
    ) as any;
    state.retryAt = 0;
    const timerCount = scheduled.length;
    await assert.rejects(
      syncRun(run, "https://collector.invalid"),
      SaveConflictError,
    );
    assert.equal(requests, 1);
    assert.ok(cleared.has(retry.handle));
    assert.equal(
      scheduled.length,
      timerCount,
      "no replacement retry was scheduled",
    );
    assert.equal(state.retryAt, 0);
    assert.equal(run.sharing, false);
    await syncRun(run, "https://collector.invalid");
    assert.equal(requests, 1);
    assert.equal(scheduled.length, timerCount);
  } finally {
    if (run) {
      run.sharing = false;
      await syncRun(run, "");
    }
    for (const timer of scheduled) originalClear(timer.handle);
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
    globalThis.fetch = originalFetch;
    globalThis.indexedDB = originalIDB;
    h.close();
  }
});
