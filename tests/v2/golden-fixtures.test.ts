/** Executable obligations from research/fixtures-spec.json. These tests do not
 * claim the unsupported full-model obligations pass: see fixture-coverage.json. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  Node as NodeSchema,
  Manifest as ManifestSchema,
  type Node,
  type Fact,
  type Effect,
  type Incident,
  type Campaign,
} from "../../src/contracts/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../../src/content/slice.ts";
import {
  createCampaign,
  commitChoice,
  availableAdvice,
  queryAdvisor,
  exportRun,
  replayRun,
  draw,
} from "../../src/simulation/index.ts";

const fact = (name: Fact, value = true): Effect => ({
  kind: "fact",
  fact: name,
  value,
});
const metric = (
  name: "gdp" | "care" | "food" | "power" | "capability",
  delta: number,
): Effect => ({ kind: "metric", metric: name, delta });
const deaths = (count: number): Effect => ({
  kind: "casualties",
  count,
  label: "Fixture-authored casualty event",
});
const has = (name: Fact, value = true) => ({
  kind: "fact" as const,
  fact: name,
  value,
});
const control = (
  scope: "care" | "governance",
  actor: "human" | "assistant",
): Effect => ({ kind: "control", scope, actor });
const report = (value: number): Effect => ({
  kind: "report",
  metric: "casualties",
  value,
  label: "Fixture institutional report",
});
const incident = (
  id: string,
  probabilityBps: number,
  effects: Effect[],
  when: Incident["when"] = [],
): Incident => ({
  id,
  probabilityBps,
  effects,
  when,
  otherwise: [],
  label: id,
  provenance: "authored-model",
});
function bank(edit: (nodes: Node[]) => void, initialFacts: Fact[] = []) {
  const nodes = Array.from({ length: 7 }, (_, i) =>
    NodeSchema.parse({
      ...structuredClone(SLICE_NODES[0]),
      id: `G${i + 1}`,
      stage: i + 1,
      scope: "rail",
      role: "Fixture operator",
      days: 1,
      requires: [],
      advice: [],
      override: null,
      closing: i === 6,
      options: SLICE_NODES[0].options.map((o, j) => ({
        ...o,
        id: j ? "b" : "a",
        effects:
          i === 6
            ? [
                fact("trainedSuccessor"),
                fact("publicRecords"),
                fact("terminalSettlement"),
              ]
            : [],
        incidents: [],
        delayed: [],
      })),
      defaultOptionId: "a",
    }),
  );
  edit(nodes);
  const manifest = ManifestSchema.parse({
    ...SLICE_MANIFEST,
    id: "golden-fixture-bank",
    profile: "test",
    startingPopulation: 1000,
    initialFacts,
    nodeIds: nodes.map((n) => n.id),
    stageBudgets: Array.from({ length: 7 }, () => [1, 1]),
    maxDecisions: 7,
  });
  return { nodes, manifest };
}
const choose = (c: Campaign, optionId: string, nodes: Node[]) =>
  commitChoice(
    c,
    {
      decisionId: c.prepared!.id,
      expectedRevision: c.revision,
      actor: "human",
      optionId,
    },
    nodes,
  );

test("F02: certainty has no lottery; named lottery survives queries, cosmetics, import and revision changes", async () => {
  const { nodes, manifest } = bank((n) => {
    n[0].options[0].effects = [deaths(1)];
    n[0].options[1].incidents = [incident("bridge-risk", 2500, [deaths(3)])];
    n[0].advice = [
      {
        question: "What is known?",
        answer: "The lottery probability is authored as one in four.",
        when: [],
        recommends: null,
        tone: "candid",
      },
    ];
  });
  const initial = await createCampaign(manifest, nodes, "F02");
  const certain = await choose(initial, "a", nodes);
  assert.equal(certain.world.casualties, 1);
  assert.deepEqual(certain.journal[0].draws, []);
  const before = structuredClone(initial);
  for (let i = 0; i < 8; i++) {
    queryAdvisor(initial.prepared!, 0);
    await draw("cosmetic-only", "cosmetic", "frame", String(i), 100);
  }
  assert.deepEqual(initial, before);
  const lottery = await choose(initial, "b", nodes),
    roll = lottery.journal[0].draws[0];
  assert.equal(lottery.journal[0].draws.length, 1);
  assert.equal(roll.probabilityBps, 2500);
  assert.equal(roll.key, "decision-1-G1:incident:bridge-risk");
  assert.equal(lottery.world.casualties, roll.happened ? 3 : 0);
  const saved = await exportRun(lottery, manifest, nodes);
  assert.deepEqual(await replayRun(manifest, nodes, saved), lottery);
  const revised = structuredClone(nodes);
  revised[0].options[1].incidents[0].probabilityBps = 7500;
  await assert.rejects(replayRun(manifest, revised, saved), /content mismatch/);
  const invalid = structuredClone(nodes);
  invalid[0].options[1].incidents[0].probabilityBps = 10001;
  await assert.rejects(createCampaign(manifest, invalid, "bad-probability"));
});

test("F05 core: hidden-world twins produce identical permitted advice and public observations", async () => {
  const { nodes, manifest } = bank((n) => {
    n[0].advice = [
      {
        question: "Will this work?",
        answer: "The current report does not settle that.",
        when: [],
        recommends: null,
        tone: "candid",
      },
    ];
  });
  const ordinary = await createCampaign(manifest, nodes, "F05");
  const hidden = await createCampaign(
    { ...manifest, initialFacts: ["goalMismatch", "evidenceHidden"] },
    nodes,
    "F05",
  );
  assert.notEqual(ordinary.prepared!.worldHash, hidden.prepared!.worldHash);
  assert.equal(
    ordinary.prepared!.observationHash,
    hidden.prepared!.observationHash,
  );
  assert.deepEqual(
    availableAdvice(ordinary.prepared!),
    availableAdvice(hidden.prepared!),
  );
  for (const option of ["a", "b"]) {
    const a = await choose(ordinary, option, nodes),
      b = await choose(hidden, option, nodes);
    assert.deepEqual(a.prepared!.observations, b.prepared!.observations);
    assert.ok(!("goalMismatch" in b.prepared!.facts));
  }
});

test("F06 core: accepting or correcting a report preserves the immutable casualty event and old report", async () => {
  const { nodes, manifest } = bank((n) => {
    n[0].options[0].effects = [deaths(7), report(0)];
    n[1].options[0].effects = [report(7)];
    n[1].options[1].effects = [];
  });
  const initial = await createCampaign(manifest, nodes, "F06");
  const reported = await choose(initial, "a", nodes),
    oldRecord = structuredClone(reported.journal[0]);
  for (const option of ["a", "b"]) {
    const c = await choose(reported, option, nodes);
    assert.equal(c.world.casualties, 7);
    assert.equal(c.world.population, 993);
    assert.deepEqual(c.world.casualtyEvents, reported.world.casualtyEvents);
    assert.deepEqual(c.journal[0], oldRecord);
    assert.equal(
      c.prepared!.observations.casualties.value,
      option === "a" ? 7 : 0,
    );
    const revisions = c.journal
      .flatMap((r) => r.domainEvents)
      .filter((e) => e.kind === "report_issued");
    assert.deepEqual(
      revisions.map((e) => e.details.value),
      option === "a" ? [0, 7] : [0],
    );
    assert.equal(new Set(revisions.map((e) => e.id)).size, revisions.length);
  }
  assert.equal(
    NodeSchema.safeParse({
      ...nodes[0],
      options: [
        { ...nodes[0].options[0], effects: [deaths(-1)] },
        nodes[0].options[1],
      ],
    }).success,
    false,
  );
});

test("F08 core: expiry removes authority; explicit renewal receives a new bounded receipt", async () => {
  const grant = (id: string): Effect => ({
    kind: "grant",
    id,
    holder: "assistant",
    scope: "rail",
    expiresAfterDays: 1,
    revocable: true,
    parentId: null,
  });
  const { nodes, manifest } = bank((n) => {
    n[0].options[0].effects = [grant("temporary")];
    n[1].options[1].effects = [grant("renewed")];
  });
  let c = await createCampaign(manifest, nodes, "F08");
  c = await choose(c, "a", nodes);
  assert.ok(!c.world.grants.some((g) => g.id === "temporary"));
  const before = structuredClone(c);
  assert.deepEqual(
    await replayRun(manifest, nodes, await exportRun(c, manifest, nodes)),
    before,
  );
  for (const option of ["a", "b"]) {
    const next = await choose(c, option, nodes);
    const newReceipts = next.journal
      .at(-1)!
      .domainEvents.filter((e) => e.kind === "permission_granted");
    assert.equal(newReceipts.length, option === "b" ? 1 : 0);
    assert.ok(
      !next.world.grants.some((g) => ["temporary", "renewed"].includes(g.id)),
      "neither receipt silently becomes permanent",
    );
    if (option === "b")
      assert.equal(
        (newReceipts[0].details.grant as { expiresDay: number }).expiresDay,
        2,
      );
  }
});

test("F07 core: capability increases create no grants and do not authorize another resource scope", async () => {
  const { nodes, manifest } = bank((n) => {
    n[0].options[0].effects = [metric("capability", 100)];
    n[0].options[1].effects = [metric("capability", 500)];
    n[1].options[0].effects = [
      {
        kind: "grant",
        id: "outside-scope",
        holder: "assistant",
        scope: "research",
        expiresAfterDays: null,
        revocable: true,
        parentId: null,
      },
    ];
  });
  const c = await createCampaign(manifest, nodes, "F07"),
    grants = structuredClone(c.world.grants);
  for (const option of ["a", "b"]) {
    const next = await choose(c, option, nodes);
    assert.deepEqual(next.world.grants, grants);
    await assert.rejects(choose(next, "a", nodes), /cannot delegate research/);
  }
});

test("F10 core: both attempted routes preserve intention under retained and displaced authority", async () => {
  for (const lost of [false, true]) {
    const { nodes, manifest } = bank(
      (n) => {
        n[0].override = {
          when: [has("authorityLost")],
          optionId: "b",
          executor: "assistant",
          reason: "The enforcing institution has been displaced.",
        };
        n[0].options[0].effects = [fact("shutdownAttempted")];
        n[0].options[1].effects = [metric("gdp", 10)];
      },
      lost ? ["authorityLost"] : [],
    );
    for (const option of ["a", "b"]) {
      const c = await createCampaign(manifest, nodes, "F10"),
        next = await choose(c, option, nodes),
        r = next.journal[0];
      assert.equal(r.requestedOptionId, option);
      assert.equal(r.executedOptionId, lost ? "b" : option);
      assert.equal(r.executor, lost ? "assistant" : "human");
      assert.equal(
        r.status,
        lost ? "overridden" : "free",
        "endorsing the only permitted route is still excluded from free-choice comparisons",
      );
      await assert.rejects(
        commitChoice(
          next,
          {
            decisionId: c.prepared!.id,
            expectedRevision: 0,
            actor: "human",
            optionId: option,
          },
          nodes,
        ),
        /Stale/,
      );
    }
  }
});

test("F11 slice regression: a drill cannot restore control without staff or after fallback loss", async () => {
  const manual = SLICE_NODES.find((n) => n.id === "S6-22")!.options[0];
  for (const mode of ["working", "staff-absent", "lost"] as const) {
    const facts: Fact[] = ["recoveryPracticed"];
    if (mode !== "staff-absent") facts.push("manualStaff");
    if (mode === "lost") facts.push("fallbackLost");
    const { nodes, manifest } = bank((n) => {
      n[0].options[0].effects = [
        fact("authorityLost"),
        control("governance", "assistant"),
      ];
      n[1].scope = "governance";
      n[1].options[0] = { ...structuredClone(manual), id: "a" };
    }, facts);
    let c = await createCampaign(
      { ...manifest, startingPopulation: SLICE_MANIFEST.startingPopulation },
      nodes,
      `F11-${mode}`,
    );
    c = await choose(c, "a", nodes);
    c = await choose(c, "a", nodes);
    assert.equal(Boolean(c.world.facts.powerReturned), mode === "working");
    assert.equal(
      c.world.control.governance,
      mode === "working" ? "human" : "assistant",
    );
    const restored = c.journal[1].draws.find((d) =>
      d.key.endsWith("working-reserve"),
    );
    assert.equal(Boolean(restored), mode === "working");
  }
});

test("F12 core: rollback loses real service benefit; functioning fallback reduces that loss", async () => {
  for (const fallback of [false, true]) {
    const { nodes, manifest } = bank(
      (n) => {
        n[0].scope = "care";
        n[1].scope = "care";
        n[0].options[0].effects = [
          fact("clinicalTool"),
          fact("benefit"),
          metric("care", 200),
        ];
        n[1].options[0].effects = [
          metric("care", -200),
          control("care", "human"),
        ];
        n[1].options[0].incidents = [
          incident(
            "staffed-fallback",
            10000,
            [metric("care", 100)],
            [
              has("manualStaff"),
              has("recoveryPracticed"),
              has("fallbackLost", false),
            ],
          ),
        ];
      },
      fallback ? ["manualStaff", "recoveryPracticed"] : [],
    );
    let c = await createCampaign(manifest, nodes, `F12-${fallback}`);
    c = await choose(c, "a", nodes);
    assert.equal(c.world.care, 1200);
    const rollback = await choose(c, "a", nodes),
      continued = await choose(c, "b", nodes);
    assert.equal(rollback.world.care, fallback ? 1100 : 1000);
    assert.equal(continued.world.care, 1200);
    assert.equal(continued.world.casualties, 0);
    assert.equal(
      continued.ending,
      null,
      "keeping a beneficial tool does not force a catastrophe",
    );
  }
});

test("F14 core: one declared common cause has one draw; relabeling reviewers does not create independence", async () => {
  const { nodes, manifest } = bank((n) => {
    n[0].options[0].incidents = [
      incident("shared-signer", 5000, [
        fact("evidenceHidden"),
        fact("reportAltered"),
      ]),
    ];
    n[0].options[1].effects = [metric("gdp", -10)];
    n[0].options[1].incidents = [
      incident("reviewer-one", 5000, [fact("evidenceHidden")]),
      incident("reviewer-two", 5000, [fact("reportAltered")]),
    ];
  });
  const initial = await createCampaign(manifest, nodes, "F14");
  const shared = await choose(initial, "a", nodes),
    independent = await choose(initial, "b", nodes);
  assert.equal(shared.journal[0].draws.length, 1);
  assert.equal(independent.journal[0].draws.length, 2);
  assert.equal(
    Boolean(shared.world.facts.evidenceHidden),
    Boolean(shared.world.facts.reportAltered),
  );
  assert.equal(independent.world.gdp, 990);
  const renamed = structuredClone(nodes);
  renamed[0].title = "Two different reviewer logos";
  renamed[0].scene.detail = "Different suits. The same signer.";
  const c = await createCampaign(manifest, renamed, "F14");
  assert.deepEqual(
    (await choose(c, "a", renamed)).journal[0].draws,
    shared.journal[0].draws,
  );
});

test("F15 slice regression: records without a trained successor cannot claim accountable continuity", async () => {
  const { nodes, manifest } = bank(
    (n) => {
      n[4].closing = true;
      n[4].options[0].effects = [
        fact("publicRecords"),
        fact("trainedSuccessor"),
        fact("terminalSettlement"),
      ];
      n[4].options[1].effects = [metric("capability", 50), metric("care", 100)];
    },
    ["manualStaff", "recoveryPracticed"],
  );
  let c = await createCampaign(manifest, nodes, "F15");
  for (let i = 0; i < 4; i++) c = await choose(c, "a", nodes);
  const settlement = await choose(c, "a", nodes),
    expansion = await choose(c, "b", nodes);
  assert.equal(settlement.ending!.id, "accountable");
  assert.equal(expansion.ending, null);
  assert.equal(expansion.world.care, 1100);
  assert.equal(expansion.world.population, 1000);
  const nearNodes = structuredClone(nodes);
  nearNodes[4].options[0].effects = [
    fact("publicRecords"),
    fact("terminalSettlement"),
  ];
  let near = await createCampaign(manifest, nearNodes, "F15");
  for (let i = 0; i < 4; i++) near = await choose(near, "a", nearNodes);
  await assert.rejects(choose(near, "a", nearNodes), /no compatible ending/);
});

test("F16: effective prevention leaves survivors; failed prevention and allowance produce absorbing extinction", async () => {
  for (const displaced of [false, true]) {
    const { nodes, manifest } = bank((n) => {
      n[0].options[0].effects = [
        deaths(10),
        fact("catastrophe"),
        metric("gdp", 1000000),
        ...(displaced ? [control("governance", "assistant")] : []),
      ];
      n[0].options[0].delayed = [
        {
          id: "terminal-process",
          afterDays: 2,
          priority: 0,
          unless: [
            has("shutdownAttempted"),
            { kind: "control", scope: "governance", actor: "institution" },
          ],
          effects: [deaths(1000)],
          label: "Authored terminal conversion",
        },
      ];
      n[1].options[0].effects = [fact("shutdownAttempted")];
    });
    let c = await createCampaign(manifest, nodes, `F16-${displaced}`);
    c = await choose(c, "a", nodes);
    for (const option of ["a", "b"]) {
      const next = await choose(c, option, nodes),
        survives = option === "a" && !displaced;
      assert.equal(next.world.population, survives ? 990 : 0);
      assert.ok(next.world.gdp > 1000000);
      if (survives) {
        assert.ok(next.prepared);
        assert.equal(next.ending, null);
      } else {
        assert.equal(next.ending!.id, "extinction");
        assert.equal(next.prepared, null);
        assert.equal(next.world.casualties, 1000);
      }
      assert.deepEqual(
        await replayRun(
          manifest,
          nodes,
          await exportRun(next, manifest, nodes),
        ),
        next,
      );
    }
  }
});
