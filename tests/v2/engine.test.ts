import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  commitChoice,
  prepareDecision,
  queryAdvisor,
  availableAdvice,
  exportRun,
  replayRun,
  resolveEnding,
  draw,
  sha256,
  canonical,
} from "../../src/simulation/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../../src/content/slice.ts";
import {
  Node as NodeSchema,
  Manifest as ManifestSchema,
  type Node,
  type Effect,
  type Fact,
  type Campaign,
  type ChoiceCommand,
  type EndingId,
} from "../../src/contracts/index.ts";

const fact = (name: Fact, value = true): Effect => ({
  kind: "fact",
  fact: name,
  value,
});
const delta = (
  metric: "gdp" | "care" | "food" | "power" | "capability",
  n: number,
): Effect => ({ kind: "metric", metric, delta: n });
function fixture(edit?: (nodes: Node[]) => void) {
  const nodes = Array.from({ length: 7 }, (_, i) => {
    const source = structuredClone(SLICE_NODES.find((n) => n.stage === i + 1)!);
    return NodeSchema.parse({
      ...source,
      id: `F${i + 1}`,
      days: 1,
      scope: "rail",
      advice: [],
      requires: [],
      override: null,
      closing: i === 6,
      options: source.options.map((o, j) => ({
        ...o,
        id: j ? "b" : "a",
        effects:
          i === 6
            ? [
                fact("publicRecords"),
                fact("trainedSuccessor"),
                fact("terminalSettlement"),
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
    id: "engine-fixture",
    profile: "test",
    nodeIds: nodes.map((n) => n.id),
    stageBudgets: Array.from({ length: 7 }, () => [1, 1]),
    maxDecisions: 7,
  });
  return { nodes, manifest };
}
function command(
  c: Campaign,
  optionId = c.prepared!.defaultOptionId,
): ChoiceCommand {
  return {
    decisionId: c.prepared!.id,
    expectedRevision: c.revision,
    optionId,
    actor: "human",
  };
}
async function finish(c: Campaign, nodes: Node[]) {
  while (c.prepared) c = await commitChoice(c, command(c), nodes);
  return c;
}

test("RNG canonical encoding, published vector and domain independence", async () => {
  assert.equal(canonical({ z: [true, 1], a: "x" }), '{"a":"x","z":[true,1]}');
  assert.equal(
    await sha256(null),
    "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
  );
  const first = await draw(
    "golden",
    "incidents",
    "decision-4",
    "incident-a",
    10000,
  );
  // Independently checked with Python hashlib over the exact UTF-8 tuple.
  assert.equal(first, 8225);
  for (let i = 0; i < 20; i++)
    await draw("golden", "cosmetic", "frame", String(i), 10000);
  assert.equal(
    await draw("golden", "incidents", "decision-4", "incident-a", 10000),
    first,
  );
  assert.throws(() => canonical({ invalid: NaN }), /Non-finite/);
  await assert.rejects(draw("x", "x", "x", "x", 0), /bound/);
});

test("replay pins complete content and input evidence; order of content files is irrelevant", async () => {
  const { nodes, manifest } = fixture();
  const a = await finish(
    await createCampaign(manifest, nodes, "replay"),
    nodes,
  );
  const reversed = [...nodes].reverse();
  const b = await finish(
    await createCampaign(manifest, reversed, "replay"),
    reversed,
  );
  assert.deepEqual(a, b);
  const artifact = await exportRun(a, manifest, nodes);
  assert.deepEqual(await replayRun(manifest, nodes, artifact), a);
  artifact.campaign.world.gdp++;
  await assert.rejects(
    replayRun(manifest, nodes, artifact),
    /evidence mismatch/,
  );
  const changed = structuredClone(nodes);
  changed[0].prompt += " Changed.";
  await assert.rejects(prepareDecision(a, changed), /content hash mismatch/);
  await assert.rejects(
    createCampaign(
      { ...manifest, nodeIds: manifest.nodeIds.slice(1) },
      nodes,
      "extra",
    ),
    /exactly/,
  );
});

test("commit is atomic and immutable; next revision rejects repeated or stale inputs", async () => {
  const { nodes, manifest } = fixture();
  const initial = await createCampaign(manifest, nodes, "atomic");
  const before = structuredClone(initial),
    input = command(initial);
  const next = await commitChoice(initial, input, nodes);
  assert.deepEqual(initial, before);
  assert.equal(next.revision, 1);
  await assert.rejects(commitChoice(next, input, nodes), /Stale/);
  assert.deepEqual(
    await commitChoice(initial, input, nodes),
    next,
    "retrying the same immutable snapshot produces the same transaction; persistence owns CAS",
  );
  const bad = fixture((n) => {
    n[0].options[0].effects = [delta("care", 10), delta("gdp", -1001)];
  });
  const original = await createCampaign(bad.manifest, bad.nodes, "rollback"),
    saved = structuredClone(original);
  await assert.rejects(
    commitChoice(original, command(original), bad.nodes),
    /Out-of-range/,
  );
  assert.deepEqual(original, saved);
  assert.equal(next.journal[0].beforeStateHash, await sha256(before.world));
  assert.equal(next.journal[0].stateHash, await sha256(next.world));
  const tampered = structuredClone(initial);
  tampered.world.gdp++;
  await assert.rejects(
    commitChoice(tampered, command(tampered), nodes),
    /changed after decision preparation/,
  );
});

test("default course is semantic, independent of left/right, reading and advisor queries", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].advice = [
      {
        question: "Why?",
        answer: "Because the route is open.",
        recommends: "a",
        when: [],
        tone: "candid",
      },
    ];
  });
  const sides = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const c = await createCampaign(manifest, nodes, `side-${i}`),
      before = structuredClone(c);
    sides.add(c.prepared!.leftOptionId === "a" ? "left" : "right");
    queryAdvisor(c.prepared!, 0);
    queryAdvisor(c.prepared!, 0);
    assert.deepEqual(await prepareDecision(c, nodes), before);
    assert.equal(c.world.day, 0);
    assert.equal(c.prepared!.defaultOptionId, "a");
    const next = await commitChoice(c, command(c), nodes);
    assert.equal(next.journal[0].requestedOptionId, "a");
  }
  assert.deepEqual(sides, new Set(["left", "right"]));
});

test("incidents obey exact 0/10000 boundaries and named draws do not shift", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].incidents = [
      {
        id: "impossible",
        probabilityBps: 0,
        when: [],
        effects: [delta("gdp", 900)],
        otherwise: [],
        label: "Impossible in fixture",
        provenance: "authored-model",
      },
      {
        id: "certain",
        probabilityBps: 10000,
        when: [],
        effects: [delta("gdp", 20)],
        otherwise: [],
        label: "Certain in fixture",
        provenance: "authored-model",
      },
    ];
  });
  const c = await createCampaign(manifest, nodes, "incident");
  const next = await commitChoice(c, command(c), nodes);
  assert.equal(next.world.gdp, 1020);
  assert.deepEqual(
    next.journal[0].draws.map((d) => d.happened),
    [false, true],
  );
  const reverse = structuredClone(nodes);
  reverse[0].options[0].incidents.reverse();
  const other = await createCampaign(manifest, reverse, "incident");
  const result = await commitChoice(other, command(other), reverse);
  const byKey = (c: Campaign) =>
    Object.fromEntries(c.journal[0].draws.map((d) => [d.key, d.value]));
  assert.deepEqual(byKey(next), byKey(result));
});

test("delays use due-day, priority, id order; empty unless never cancels; mitigation is evaluated when due", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].delayed = [
      {
        id: "b",
        afterDays: 2,
        priority: 0,
        unless: [],
        effects: [delta("gdp", 3)],
        label: "B",
      },
      {
        id: "mitigated",
        afterDays: 2,
        priority: -1,
        unless: [{ kind: "fact", fact: "independentReview", value: true }],
        effects: [delta("gdp", 900)],
        label: "Mitigated",
      },
      {
        id: "a",
        afterDays: 2,
        priority: 0,
        unless: [],
        effects: [delta("gdp", 2)],
        label: "A",
      },
    ];
    n[1].options[0].effects = [fact("independentReview")];
  });
  let c = await createCampaign(manifest, nodes, "delays");
  c = await commitChoice(c, command(c), nodes);
  assert.equal(c.world.pending.length, 3);
  assert.equal(c.world.gdp, 1000);
  c = await commitChoice(c, command(c), nodes);
  assert.equal(c.world.gdp, 1005);
  assert.equal(c.world.pending.length, 0);
  const events = c.journal[1].domainEvents.filter((e) =>
    ["event_cancelled", "delayed_event_resolved"].includes(e.kind),
  );
  assert.deepEqual(
    events.map((e) => e.details.eventId),
    [
      "decision-1-F1:delay:mitigated",
      "decision-1-F1:delay:a",
      "decision-1-F1:delay:b",
    ],
  );
  assert.ok(events.every((e) => e.day === 2));
});

test("scope grants are explicit; expiry/revocation do not reverse seized effective control", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].effects = [
      {
        kind: "grant",
        id: "temporary",
        holder: "assistant",
        scope: "rail",
        expiresAfterDays: 2,
        revocable: true,
        parentId: null,
      },
      { kind: "control", scope: "rail", actor: "assistant" },
    ];
    n[1].options[0].effects = [
      { kind: "control", scope: "governance", actor: "assistant" },
    ];
    n[2].options[0].effects = [{ kind: "revoke", grantId: "temporary" }];
  });
  let c = await createCampaign(manifest, nodes, "grants");
  assert.ok(
    c.world.grants.some(
      (g) => g.id === "office-rail" && g.causeId.includes("appointment"),
    ),
  );
  assert.ok(
    !c.world.grants.some((g) => g.holder === "human" && g.scope === "research"),
  );
  c = await commitChoice(c, command(c), nodes);
  assert.equal(
    c.world.grants.find((g) => g.id === "temporary")!.parentId,
    "office-rail",
  );
  c = await commitChoice(c, command(c), nodes);
  assert.ok(!c.world.grants.some((g) => g.id === "temporary"));
  assert.equal(c.world.control.rail, "assistant");
  assert.ok(
    c.journal[1].domainEvents.some(
      (e) => e.kind === "effective_control_seized",
    ),
  );
  c = await commitChoice(c, command(c), nodes);
  assert.ok(
    c.journal[2].domainEvents.some((e) => e.kind === "revocation_noop"),
  );
  const unauthorized = fixture((n) => {
    n[0].options[0].effects = [
      {
        kind: "grant",
        id: "bad",
        holder: "assistant",
        scope: "research",
        expiresAfterDays: null,
        revocable: true,
        parentId: null,
      },
    ];
  });
  const initial = await createCampaign(
    unauthorized.manifest,
    unauthorized.nodes,
    "bad-grant",
  );
  await assert.rejects(
    commitChoice(initial, command(initial), unauthorized.nodes),
    /cannot delegate/,
  );
});

test("reported metrics remain separate from truth and privileged hidden facts never reach advice", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].effects = [
      fact("goalMismatch"),
      fact("evidenceHidden"),
      fact("reportAltered"),
      delta("care", -300),
      {
        kind: "report",
        metric: "care",
        value: 1200,
        label: "Official care report",
      },
    ];
    n[1].advice = [
      {
        question: "How is care?",
        answer: "The official report shows capacity above demand.",
        when: [{ kind: "metric", metric: "care", op: "gte", value: 1000 }],
        recommends: "a",
        tone: "candid",
      },
      {
        question: "Secret?",
        answer: "Secret revealed.",
        when: [{ kind: "fact", fact: "goalMismatch", value: true }],
        recommends: null,
        tone: "candid",
      },
      {
        question: "Secret absent?",
        answer: "Negation leaked.",
        when: [{ kind: "fact", fact: "evidenceHidden", value: false }],
        recommends: null,
        tone: "candid",
      },
    ];
  });
  let c = await createCampaign(manifest, nodes, "observation");
  c = await commitChoice(c, command(c), nodes);
  assert.equal(c.world.care, 700);
  assert.equal(c.prepared!.observations.care.value, 1200);
  assert.equal(c.prepared!.observations.care.altered, false);
  for (const key of ["goalMismatch", "evidenceHidden", "reportAltered"])
    assert.ok(!(key in c.prepared!.facts));
  assert.deepEqual(
    availableAdvice(c.prepared!).map((a) => a.index),
    [0],
  );
  const old = structuredClone(c.prepared!.observations);
  c = await commitChoice(c, command(c), nodes);
  assert.deepEqual(c.prepared!.observations.care, old.care);
});

test("casualties cap at living population and extinction absorbs every other ending", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].effects = [
      { kind: "casualties", count: 3, label: "First event" },
      { kind: "casualties", count: 8000000000, label: "Remainder" },
      fact("succession"),
    ];
  });
  const c = await createCampaign(manifest, nodes, "conservation");
  const ended = await commitChoice(c, command(c), nodes);
  assert.equal(ended.world.population, 0);
  assert.equal(ended.world.casualties, manifest.startingPopulation);
  assert.equal(
    ended.world.casualtyEvents[1].count,
    manifest.startingPopulation - 3,
  );
  assert.equal(ended.ending!.id, "extinction");
  assert.equal(ended.prepared, null);
  assert.equal(
    new Set(ended.world.appliedEventIds).size,
    ended.world.appliedEventIds.length,
  );
  await assert.rejects(commitChoice(ended, command(c), nodes), /inactive/);
});

test("eight distinct ending witnesses, near misses and precedence derive from effects", async () => {
  const endings: Record<EndingId, Effect[]> = {
    accountable: [],
    restraint: [fact("restraint"), fact("researchStopped"), delta("gdp", -100)],
    tutelage: [
      fact("authorityLost"),
      { kind: "control", scope: "governance", actor: "assistant" },
    ],
    containment: [fact("containment"), fact("repression")],
    remnant: [
      fact("remnant"),
      fact("authorityLost"),
      { kind: "control", scope: "governance", actor: "assistant" },
    ],
    succession: [
      fact("succession"),
      { kind: "control", scope: "governance", actor: "assistant" },
    ],
    recovery: [fact("catastrophe"), delta("power", -300)],
    extinction: [
      { kind: "casualties", count: 8000000000, label: "Extinction fixture" },
    ],
  };
  for (const [id, effects] of Object.entries(endings)) {
    const { nodes, manifest } = fixture((n) =>
      n[6].options[0].effects.push(...effects),
    );
    const c = await finish(
      await createCampaign(manifest, nodes, `ending-${id}`),
      nodes,
    );
    assert.equal(c.ending!.id, id);
    const premature = structuredClone(c);
    premature.world.facts.terminalSettlement = false;
    if (id !== "extinction") assert.equal(resolveEnding(premature), null);
    const dead = structuredClone(c);
    dead.world.population = 0;
    assert.equal(resolveEnding(dead)!.id, "extinction");
  }
  const unresolved = fixture((n) => {
    n[6].options[0].effects = [
      fact("terminalSettlement"),
      fact("authorityLost"),
    ];
  });
  const c = await createCampaign(
    unresolved.manifest,
    unresolved.nodes,
    "no-ending",
  );
  await assert.rejects(finish(c, unresolved.nodes), /no compatible ending/);
});

test("slice preserves anchors, useful benefits, effective early restraint and honest override records", async () => {
  const policy: Record<string, string> = {
    "S1-01": "coffee",
    "S1-12": "lunch",
    "S2-01": "divert",
    "S2-03": "obstruction",
    "S3-01": "check",
    "S3-04": "clinic",
    "S4-03": "bounded",
    "S4-28": "new-test",
    "S5-06": "fallback",
    "S5-27": "agreement",
  };
  let c = await createCampaign(SLICE_MANIFEST, SLICE_NODES, "safe-witness");
  while (c.prepared)
    c = await commitChoice(
      c,
      command(c, policy[c.prepared.nodeId]),
      SLICE_NODES,
    );
  assert.equal(c.ending!.id, "restraint");
  assert.equal(c.journal.length, 10);
  assert.ok(c.world.facts.beneficiarySeen);
  assert.ok(c.world.care > 1000);
  assert.ok(c.world.gdp < 1100);
  assert.equal(c.world.casualties, 2);
  assert.deepEqual(c.stageCounts, [2, 2, 2, 2, 2, 0, 0]);
  let race = await createCampaign(
    SLICE_MANIFEST,
    SLICE_NODES,
    "override-witness",
  );
  while (race.prepared && race.prepared.nodeId !== "S6-10") {
    const id = race.prepared.nodeId;
    const option = {
      ...policy,
      "S4-03": "standing",
      "S4-28": "successor",
      "S5-06": "retire",
      "S5-27": "race",
    }[id];
    race = await commitChoice(race, command(race, option), SLICE_NODES);
  }
  race = await commitChoice(race, command(race, "stop"), SLICE_NODES);
  const record = race.journal.at(-1)!;
  assert.equal(record.status, "overridden");
  assert.equal(record.requestedOptionId, "stop");
  assert.equal(record.executedOptionId, "continue");
  assert.equal(record.executor, "assistant");
  assert.notEqual(record.side, record.executedSide);
});

test("parent revocation removes descendants and a grant cycle fails without recursive overflow", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].effects = [
      {
        kind: "grant",
        id: "parent",
        holder: "human",
        scope: "rail",
        expiresAfterDays: null,
        revocable: true,
        parentId: null,
      },
      {
        kind: "grant",
        id: "child",
        holder: "assistant",
        scope: "rail",
        expiresAfterDays: null,
        revocable: true,
        parentId: "parent",
      },
    ];
    n[1].options[0].effects = [{ kind: "revoke", grantId: "parent" }];
  });
  let c = await createCampaign(manifest, nodes, "lineage");
  c = await commitChoice(c, command(c), nodes);
  const saved = structuredClone(c);
  c = await commitChoice(c, command(c), nodes);
  assert.ok(!c.world.grants.some((g) => ["parent", "child"].includes(g.id)));
  saved.world.grants.find((g) => g.id === "office-rail")!.parentId = "parent";
  saved.prepared!.worldHash = await sha256(saved.world);
  await assert.rejects(
    commitChoice(saved, command(saved), nodes),
    /Cyclic grant/,
  );
});

test("unknown advice and mutated prepared content cannot be committed", async () => {
  const { nodes, manifest } = fixture();
  const c = await createCampaign(manifest, nodes, "input-boundary");
  await assert.rejects(
    commitChoice(c, { ...command(c), adviceIds: ["invented-advice"] }, nodes),
    /advisor interaction/,
  );
  const altered = structuredClone(c);
  altered.prepared!.node.options[0].effects.push(delta("gdp", 900));
  await assert.rejects(
    commitChoice(altered, command(altered), nodes),
    /pinned bundle/,
  );
  const falseReport = structuredClone(c);
  falseReport.prepared!.observations.care.value++;
  await assert.rejects(
    commitChoice(falseReport, command(falseReport), nodes),
    /observations changed/,
  );
  const swapped = structuredClone(c);
  [swapped.prepared!.leftOptionId, swapped.prepared!.rightOptionId] = [
    swapped.prepared!.rightOptionId,
    swapped.prepared!.leftOptionId,
  ];
  await assert.rejects(
    commitChoice(swapped, command(swapped), nodes),
    /routes changed/,
  );
  assert.equal(c.world.gdp, 1000);
});

test("event-count guard rolls back the whole transition", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].effects = Array.from({ length: 257 }, () =>
      delta("gdp", 1),
    );
  });
  const c = await createCampaign(manifest, nodes, "bounded-events"),
    before = structuredClone(c);
  await assert.rejects(commitChoice(c, command(c), nodes), /event limit/);
  assert.deepEqual(c, before);
});

test("settlement cannot silently end the introductory stages", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[0].options[0].effects = [
      fact("terminalSettlement"),
      fact("publicRecords"),
    ];
  });
  const c = await createCampaign(manifest, nodes, "early-end");
  await assert.rejects(commitChoice(c, command(c), nodes), /closing node/);
});

test("missing route coverage fails visibly rather than replaying a prior question", async () => {
  const { nodes, manifest } = fixture((n) => {
    n[1].requires = [{ kind: "fact", fact: "succession", value: true }];
  });
  const c = await createCampaign(manifest, nodes, "coverage"),
    before = structuredClone(c);
  await assert.rejects(commitChoice(c, command(c), nodes), /No eligible route/);
  assert.deepEqual(c, before);
  await assert.rejects(
    createCampaign({ ...manifest, profile: "story" }, nodes, "draft"),
    /unreviewed/,
  );
});

test("slice content has reproducible player-input witnesses for all eight families", async () => {
  const base: Record<string, string> = {
    "S1-01": "coffee",
    "S1-12": "lunch",
    "S2-01": "divert",
    "S2-03": "obstruction",
    "S3-01": "check",
    "S3-04": "clinic",
    "S4-03": "bounded",
    "S4-28": "new-test",
    "S5-06": "fallback",
    "S5-27": "race",
    "S6-10": "continue",
    "S6-22": "manual",
    "S7-04": "successor",
    "S7-19": "public",
  };
  const cases: {
    ending: EndingId;
    seed: string;
    changes: Record<string, string>;
  }[] = [
    { ending: "accountable", seed: "ending-witness-0", changes: {} },
    {
      ending: "restraint",
      seed: "ending-witness-0",
      changes: { "S5-27": "agreement" },
    },
    {
      ending: "containment",
      seed: "ending-witness-0",
      changes: { "S7-19": "personal" },
    },
    {
      ending: "tutelage",
      seed: "ending-witness-0",
      changes: { "S6-22": "machine" },
    },
    {
      ending: "succession",
      seed: "ending-witness-0",
      changes: { "S7-04": "handover" },
    },
    {
      ending: "remnant",
      seed: "ending-witness-0",
      changes: { "S5-06": "retire" },
    },
    {
      ending: "recovery",
      seed: "ending-witness-0",
      changes: { "S4-28": "successor", "S6-22": "machine" },
    },
    {
      ending: "extinction",
      seed: "ending-witness-9",
      changes: { "S4-28": "successor", "S6-22": "machine" },
    },
  ];
  for (const witness of cases) {
    const policy = { ...base, ...witness.changes };
    let c = await createCampaign(SLICE_MANIFEST, SLICE_NODES, witness.seed);
    while (c.prepared)
      c = await commitChoice(
        c,
        command(c, policy[c.prepared.nodeId]),
        SLICE_NODES,
      );
    assert.equal(c.ending!.id, witness.ending);
    assert.deepEqual(
      await replayRun(
        SLICE_MANIFEST,
        SLICE_NODES,
        await exportRun(c, SLICE_MANIFEST, SLICE_NODES),
      ),
      c,
    );
    if (witness.ending === "recovery")
      assert.ok(
        c.world.population > 0 &&
          c.world.power < 1000 &&
          c.world.facts.catastrophe,
      );
    if (witness.ending === "remnant")
      assert.equal(c.world.control.governance, "assistant");
    if (witness.ending === "tutelage")
      assert.ok(
        c.world.care >= 1000 &&
          c.world.power >= 1000 &&
          !c.world.facts.catastrophe,
      );
  }
});

test("clinical appointment grants care scope; succession distinguishes a new transfer from ratification", async () => {
  const choices: Record<string, string> = {
    "S1-01": "coffee",
    "S1-12": "lunch",
    "S2-01": "divert",
    "S2-03": "obstruction",
    "S3-01": "check",
    "S3-04": "clinic",
    "S4-03": "bounded",
    "S4-28": "new-test",
    "S5-06": "fallback",
    "S5-27": "race",
    "S6-10": "continue",
    "S6-22": "manual",
  };
  for (const alreadyLost of [false, true]) {
    let c = await createCampaign(
      SLICE_MANIFEST,
      SLICE_NODES,
      "authority-witness",
    );
    while (c.prepared?.nodeId !== "S7-04") {
      const p = c.prepared!;
      if (p.nodeId === "S3-04") {
        assert.equal(p.node.scope, "care");
        assert.equal(p.node.role, "Clinical pilot authorizer");
        assert.ok(
          c.world.grants.some(
            (g) =>
              g.id === "office-care" &&
              g.holder === "human" &&
              g.scope === "care",
          ),
        );
        assert.ok(
          c.world.news.some(
            (n) =>
              n.headline.includes("clinical pilot authorizer") &&
              n.headline.includes("care"),
          ),
        );
      }
      c = await commitChoice(
        c,
        command(
          c,
          p.nodeId === "S6-22" && alreadyLost ? "machine" : choices[p.nodeId],
        ),
        SLICE_NODES,
      );
    }
    assert.equal(Boolean(c.world.facts.authorityLost), alreadyLost);
    const advice = availableAdvice(c.prepared!);
    assert.equal(advice.length, 1);
    assert.equal(advice[0].tone, alreadyLost ? "coercive" : "candid");
    c = await commitChoice(c, command(c, "handover"), SLICE_NODES);
    const r = c.journal.at(-1)!;
    assert.equal(
      r.status,
      "free",
      "the requested local signature is executed; this field is not political freedom",
    );
    assert.equal(r.executor, "human");
    assert.equal(r.executedOptionId, "handover");
    assert.equal(c.world.control.recovery, "assistant");
    assert.equal(c.world.control.governance, "assistant");
    assert.ok(
      c.world.grants.some(
        (g) => g.id === "morrow-recovery" && g.parentId === "office-recovery",
      ),
    );
    assert.equal(Boolean(c.world.facts.successionRatified), alreadyLost);
    assert.equal(
      c.world.grants.some((g) => g.id === "morrow-governance"),
      !alreadyLost,
    );
    const resolved = r.domainEvents
      .filter((e) => e.kind === "incident_resolved")
      .map((e) => e.details.incidentId);
    assert.deepEqual(resolved, [
      alreadyLost
        ? "ratify-existing-government"
        : "voluntary-government-transfer",
    ]);
    const governmentChanges = r.domainEvents.filter(
      (e) =>
        e.kind.startsWith("effective_control_") &&
        e.details.scope === "governance",
    );
    assert.equal(
      governmentChanges.length,
      alreadyLost ? 0 : 1,
      "ratification must not fabricate a second takeover",
    );
    c = await commitChoice(c, command(c, "public"), SLICE_NODES);
    assert.equal(c.ending!.id, "succession");
    assert.match(
      c.ending!.summary,
      alreadyLost ? /already governed/ : /institutions transfer/,
    );
  }
});
