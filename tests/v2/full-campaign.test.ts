import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_MANIFEST,
  CAMPAIGN_NODES,
} from "../../src/content/campaign/index.ts";
import {
  createCampaign,
  commitChoice,
  draw,
  exportRun,
  replayRun,
} from "../../src/simulation/index.ts";
import { resolveBundle } from "../../src/content/registry.ts";
import { living } from "../../src/simulation/population.ts";

test("the complete campaign has the reviewed seven-stage bank and bounded journeys", async () => {
  assert.equal(CAMPAIGN_NODES.length, 154);
  assert.deepEqual(
    Array.from(
      { length: 7 },
      (_, i) => CAMPAIGN_NODES.filter((n) => n.stage === i + 1).length,
    ),
    [12, 18, 24, 28, 28, 24, 20],
  );
  assert.equal(CAMPAIGN_MANIFEST.profile, "story");
  assert.ok(CAMPAIGN_NODES.every((n) => n.reviewStatus === "reviewed"));
  assert.equal(
    CAMPAIGN_MANIFEST.stageBudgets.reduce((s, b) => s + b[0], 0),
    27,
  );
  assert.equal(
    CAMPAIGN_MANIFEST.stageBudgets.reduce((s, b) => s + b[1], 0),
    43,
  );
  const c = await createCampaign(
    CAMPAIGN_MANIFEST,
    CAMPAIGN_NODES,
    "bank-identity",
  );
  assert.equal(living(c.world.populationLedger!), c.world.initialPopulation);
  const bundle = await resolveBundle(c.contentHash);
  assert.deepEqual(bundle.manifest, CAMPAIGN_MANIFEST);
});

test("complete journeys preserve ordered anchors, unique scenes and exact replay", async () => {
  for (let i = 0; i < 12; i++) {
    let c = await createCampaign(
      CAMPAIGN_MANIFEST,
      CAMPAIGN_NODES,
      `full-regression-${i}`,
    );
    while (c.prepared) {
      const p = c.prepared;
      const option =
        p.node.options[await draw(c.seed, "test-policy", p.id, "choice", 2)];
      c = await commitChoice(
        c,
        {
          decisionId: p.id,
          expectedRevision: c.revision,
          actor: "human",
          optionId: option.id,
        },
        CAMPAIGN_NODES,
      );
      assert.equal(
        c.world.population + c.world.casualties,
        c.world.initialPopulation,
      );
    }
    assert.ok(c.ending);
    assert.ok(c.journal.length <= 43);
    assert.equal(new Set(c.seen).size, c.seen.length);
    for (let stage = 1; stage < c.stage; stage++) {
      const records = c.journal.filter((r) => r.stage === stage);
      assert.equal(
        CAMPAIGN_NODES.find((n) => n.id === records[0].nodeId)!.phase,
        0,
      );
      assert.equal(
        CAMPAIGN_NODES.find((n) => n.id === records.at(-1)!.nodeId)!.phase,
        2,
      );
      for (const anchor of CAMPAIGN_NODES.filter(
        (n) => n.stage === stage && n.anchor,
      ))
        assert.ok(c.seen.includes(anchor.id));
    }
    if (i < 3)
      assert.deepEqual(
        await replayRun(
          CAMPAIGN_MANIFEST,
          CAMPAIGN_NODES,
          await exportRun(c, CAMPAIGN_MANIFEST, CAMPAIGN_NODES),
        ),
        c,
      );
  }
});
