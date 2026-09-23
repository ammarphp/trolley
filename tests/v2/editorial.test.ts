import test from "node:test";
import assert from "node:assert/strict";
import {
  applyProseEdition,
  type ProseNode,
} from "../../src/content/editorial.ts";
import {
  Node as NodeSchema,
  Manifest as ManifestSchema,
  type Node,
  type Campaign,
  type Fact,
  type Effect,
} from "../../src/contracts/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../../src/content/slice.ts";
import {
  createCampaign,
  commitChoice,
  exportRun,
  replayRun,
} from "../../src/simulation/index.ts";

const fact = (name: Fact, value = true): Effect => ({
  kind: "fact",
  fact: name,
  value,
});
const has = (name: Fact, value = true) => ({
  kind: "fact" as const,
  fact: name,
  value,
});
function fixture(edit?: (nodes: Node[]) => void) {
  const nodes = Array.from({ length: 7 }, (_, i) =>
    NodeSchema.parse({
      ...structuredClone(SLICE_NODES[0]),
      id: `ED${i + 1}`,
      stage: i + 1,
      days: 1,
      scope: "rail",
      requires: [],
      advice: [],
      override: null,
      closing: i === 6,
      defaultOptionId: "a",
      options: ["a", "b"].map((id) => ({
        id,
        label: `Choose ${id}`,
        consequence: `Base receipt ${id}`,
        intent: "maintain",
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
    }),
  );
  edit?.(nodes);
  return {
    nodes,
    manifest: ManifestSchema.parse({
      ...SLICE_MANIFEST,
      id: "editorial-fixture",
      profile: "test",
      nodeIds: nodes.map((node) => node.id),
      stageBudgets: Array.from({ length: 7 }, () => [1, 1]),
      maxDecisions: 7,
    }),
  };
}
function edition(node: Node): ProseNode {
  return {
    nodeId: node.id,
    title: "Revised title",
    prompt: "Revised fictional situation.",
    options: node.options.map((option) => ({
      optionId: option.id,
      label: `Revised ${option.id}`,
      consequence: `Revised receipt ${option.id}`,
    })),
    advice: node.advice.map((advice, index) => ({
      index,
      question: advice.question,
      answer: "Revised answer.",
      reasoning: "Authored reasoning.",
    })),
    newsReplacements: [],
  };
}
function choose(campaign: Campaign, nodes: Node[], optionId = "a") {
  return commitChoice(
    campaign,
    {
      decisionId: campaign.prepared!.id,
      expectedRevision: campaign.revision,
      actor: "human",
      optionId,
    },
    nodes,
  );
}

test("editorial input cannot change mechanics or mutate its source bank", () => {
  const { nodes } = fixture((bank) => {
    bank[0].advice = [
      {
        question: "Why?",
        answer: "Original answer.",
        when: [has("manualStaff")],
        recommends: "a",
        tone: "candid",
      },
    ];
    bank[0].options[0].effects = [
      { kind: "metric", metric: "gdp", delta: 17 },
      {
        kind: "news",
        headline: "Original news.",
        source: "Ledger",
        entityId: "fixture",
      },
    ];
  });
  const original = structuredClone(nodes),
    prose = edition(nodes[0]);
  prose.newsReplacements = [
    { path: "options[0].effects[1].headline", headline: "Revised news." },
  ];
  // Malicious/accidental mechanical keys from an external JSON proposal are not
  // copied by the editorial whitelist, even when their prose slot is valid.
  Object.assign(prose, { scope: "governance", days: 900, requires: [] });
  Object.assign(prose.options[0], {
    effects: [fact("extinction")],
    id: "replacement",
    intent: "expand",
  });
  Object.assign(prose.advice[0], {
    when: [],
    recommends: "b",
    tone: "coercive",
  });
  const revised = applyProseEdition(nodes, [prose]);
  const expected = structuredClone(nodes);
  expected[0].title = prose.title;
  expected[0].prompt = prose.prompt;
  for (let i = 0; i < 2; i++) {
    expected[0].options[i].label = prose.options[i].label;
    expected[0].options[i].consequence = prose.options[i].consequence;
  }
  expected[0].advice[0].answer = "Revised answer.";
  expected[0].advice[0].reasoning = "Authored reasoning.";
  assert.equal(expected[0].options[0].effects[1].kind, "news");
  if (expected[0].options[0].effects[1].kind === "news")
    expected[0].options[0].effects[1].headline = "Revised news.";
  assert.deepEqual(revised, expected);
  assert.deepEqual(nodes, original);
  revised[0].options[0].effects.pop();
  assert.deepEqual(
    nodes,
    original,
    "returned editions must not alias source effects",
  );
});

test("unknown, repeated and incomplete action/advice slots and non-news paths are rejected atomically", () => {
  const { nodes } = fixture((bank) => {
    bank[0].advice = [0, 1].map(() => ({
      question: "Why?",
      answer: "Because.",
      when: [],
      recommends: null,
      tone: "candid",
    }));
    bank[0].options[0].effects = [{ kind: "metric", metric: "gdp", delta: 7 }];
  });
  const original = structuredClone(nodes);
  const cases: ((p: ProseNode[]) => void)[] = [
    (p) => {
      p[0].nodeId = "missing";
    },
    (p) => {
      p.push(structuredClone(p[0]));
    },
    (p) => {
      p[0].options.pop();
    },
    (p) => {
      p[0].options[1].optionId = "missing";
    },
    (p) => {
      p[0].options[1].optionId = "a";
    },
    (p) => {
      p[0].advice.pop();
    },
    (p) => {
      p[0].advice[0].index = -1;
    },
    (p) => {
      p[0].advice[0].index = 0.5;
    },
    (p) => {
      p[0].advice[1].index = 0;
    },
    ...[
      "options[0].effects[0].headline",
      "options[99].effects[0].headline",
      "options[0].effects[0].delta",
      "__proto__.headline",
    ].map((path) => (p: ProseNode[]) => {
      p[0].newsReplacements = [{ path, headline: "Invalid target" }];
    }),
  ];
  for (const alter of cases) {
    const prose = [edition(nodes[0])];
    alter(prose);
    assert.throws(() => applyProseEdition(nodes, prose));
    assert.deepEqual(
      nodes,
      original,
      "a failed edition must not leave partial changes",
    );
  }
});

test("conditional receipts reject invented predicates, empty guards and executable extra fields", () => {
  const { nodes } = fixture();
  const invalid = [
    [
      {
        when: [{ kind: "fact", fact: "inventedFact", value: true }],
        text: "No.",
      },
    ],
    [{ when: [], text: "No." }],
    [
      {
        when: [has("manualStaff")],
        text: "No.",
        effects: [fact("extinction")],
      },
    ],
    Array.from({ length: 13 }, () => ({
      when: [has("manualStaff")],
      text: "No.",
    })),
  ];
  for (const variants of invalid) {
    const prose = edition(nodes[0]);
    Object.assign(prose.options[0], { consequenceVariants: variants });
    assert.throws(() => applyProseEdition(nodes, [prose]));
  }
});

test("receipt follows the executed option and resolved effects, not the overridden request", async () => {
  const { nodes, manifest } = fixture((bank) => {
    bank[0].override = {
      when: [has("manualStaff")],
      optionId: "b",
      executor: "assistant",
      reason: "Fixture override",
    };
    bank[0].options[0].effects = [fact("restraint")];
    bank[0].options[0].consequenceVariants = [
      { when: [has("restraint")], text: "The requested stop executed." },
    ];
    bank[0].options[1].effects = [
      fact("essentialDependence"),
      { kind: "metric", metric: "gdp", delta: 7 },
    ];
    bank[0].options[1].consequenceVariants = [
      { when: [has("essentialDependence")], text: "The system kept running." },
    ];
  });
  const initial = await createCampaign(manifest, nodes, "editorial-override");
  const next = await choose(initial, nodes);
  const record = next.journal[0];
  assert.equal(record.requestedOptionId, "a");
  assert.equal(record.executedOptionId, "b");
  assert.equal(record.status, "overridden");
  assert.equal(record.consequence, "The system kept running.");
  assert.equal(next.world.facts.restraint, undefined);
  assert.equal(next.world.gdp - initial.world.gdp, 7);
  assert.deepEqual(
    await replayRun(manifest, nodes, await exportRun(next, manifest, nodes)),
    next,
  );
});

test("eligible success, eligible failure and ineligible incidents select only their actual receipt", async () => {
  for (const scenario of ["happened", "otherwise", "ineligible"] as const) {
    const { nodes, manifest } = fixture((bank) => {
      bank[0].options[0].incidents = [
        {
          id: "fixture-incident",
          label: "Authored test incident",
          provenance: "authored-model",
          when: [has("manualStaff", scenario !== "ineligible")],
          probabilityBps: scenario === "happened" ? 10000 : 0,
          effects: [fact("catastrophe")],
          otherwise: [fact("repair")],
        },
      ];
      bank[0].options[0].consequenceVariants = [
        { when: [has("catastrophe")], text: "The incident happened." },
        {
          when: [has("repair")],
          text: "The incident did not happen; the alternate work completed.",
        },
      ];
    });
    const next = await choose(
      await createCampaign(manifest, nodes, "editorial-incident"),
      nodes,
    );
    assert.equal(
      next.journal[0].consequence,
      {
        happened: "The incident happened.",
        otherwise: "The incident did not happen; the alternate work completed.",
        ineligible: "Base receipt a",
      }[scenario],
    );
    assert.equal(
      next.journal[0].draws.length,
      scenario === "ineligible" ? 0 : 1,
    );
    if (scenario === "ineligible")
      assert.equal(next.world.facts.repair, undefined);
    assert.deepEqual(
      await replayRun(manifest, nodes, await exportRun(next, manifest, nodes)),
      next,
    );
  }
});

test("receipts see due delays, use first matching guard and do not change draws or domain state", async () => {
  const { nodes, manifest } = fixture((bank) => {
    bank[0].options[0].delayed = [
      {
        id: "later",
        label: "Later repair",
        afterDays: 1,
        priority: 0,
        unless: [],
        effects: [fact("repair")],
      },
    ];
  });
  const before = await choose(
    await createCampaign(manifest, nodes, "editorial-delay"),
    nodes,
  );
  const revised = structuredClone(nodes);
  revised[0].options[0].consequenceVariants = [
    {
      when: [has("repair"), has("manualStaff")],
      text: "The staffed repair finished during this interval.",
    },
    { when: [has("repair")], text: "The fallback match must not win." },
  ];
  const after = await choose(
    await createCampaign(manifest, revised, "editorial-delay"),
    revised,
  );
  assert.equal(
    after.journal[0].consequence,
    "The staffed repair finished during this interval.",
  );
  assert.deepEqual(after.world, before.world);
  assert.deepEqual(
    after.journal[0].domainEvents,
    before.journal[0].domainEvents,
  );
  assert.deepEqual(after.journal[0].draws, before.journal[0].draws);
  assert.equal(after.journal[0].stateHash, before.journal[0].stateHash);
  assert.notEqual(
    after.contentHash,
    before.contentHash,
    "prose/guard editions still pin their own evidence",
  );
  assert.deepEqual(
    await replayRun(
      manifest,
      revised,
      await exportRun(after, manifest, revised),
    ),
    after,
  );
  await assert.rejects(
    replayRun(manifest, nodes, await exportRun(after, manifest, revised)),
    /content/i,
  );
});
