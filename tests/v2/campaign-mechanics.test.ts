import test from "node:test";
import assert from "node:assert/strict";
import {
  makePopulation,
  applyLoss,
  anonymousRanges,
  isAlive,
  living,
  normalize,
} from "../../src/simulation/population.ts";
import {
  matches,
  createCampaign,
  commitChoice,
  exportRun,
  replayRun,
} from "../../src/simulation/index.ts";
import { SLICE_NODES, SLICE_MANIFEST } from "../../src/content/slice.ts";
import {
  bindCampaignPhysics,
  CAMPAIGN_POPULATION,
} from "../../src/content/campaign-physics.ts";
import { railPose, RouteGeometry } from "../../src/presentation/geometry.ts";
import type { Node, Manifest } from "../../src/contracts/index.ts";

const manifest = (nodes: Node[]): Manifest => ({
  ...SLICE_MANIFEST,
  profile: "test",
  nodeIds: nodes.map((n) => n.id),
  populationCatalog: CAMPAIGN_POPULATION,
});
const command = (
  c: Awaited<ReturnType<typeof createCampaign>>,
  optionId: string,
) => ({
  decisionId: c.prepared!.id,
  expectedRevision: c.revision,
  actor: "human" as const,
  optionId,
});
async function atRail(id: string, patch?: (n: Node) => void) {
  const nodes = bindCampaignPhysics(SLICE_NODES);
  const node = nodes.find((n) => n.id === id)!;
  patch?.(node);
  let c = await createCampaign(manifest(nodes), nodes, "physical-rail-check");
  while (c.prepared!.nodeId !== id)
    c = await commitChoice(
      c,
      command(c, c.prepared!.node.defaultOptionId),
      nodes,
    );
  return { nodes, c };
}
test("population identity deduplicates aliases, overlaps and repeated allocation references", () => {
  const ledger = makePopulation(CAMPAIGN_POPULATION, 8_000_000_000);
  assert.equal(isAlive(ledger, "rail-s2-01", 5), true);
  assert.equal(
    applyLoss(
      ledger,
      "one",
      [{ cohortId: "rail-s2-01", start: 4, count: 2 }],
      "contact",
    ).count,
    2,
  );
  assert.equal(isAlive(ledger, "rail-s2-01", 5), false);
  assert.equal(
    applyLoss(
      ledger,
      "one",
      [{ cohortId: "rail-s2-01", start: 4, count: 2 }],
      "global-view",
    ).count,
    0,
  );
  assert.equal(
    applyLoss(
      ledger,
      "overlap",
      [{ cohortId: "rail-s2-01", start: 0, count: 5 }],
      "collision",
    ).count,
    4,
  );
  assert.equal(living(ledger), 7_999_999_994);
  assert.throws(
    () =>
      applyLoss(
        ledger,
        "one",
        [{ cohortId: "rail-s2-01", start: 3, count: 2 }],
        "conflict",
      ),
    /Conflicting/,
  );
  assert.deepEqual(
    normalize([
      [1, 3],
      [2, 5],
      [7, 9],
      [5, 7],
    ]),
    [[1, 9]],
  );
});
test("whole-world loss runs in bounded intervals and preserves exact conservation", () => {
  const ledger = makePopulation(CAMPAIGN_POPULATION, 8_000_000_000);
  const ranges = anonymousRanges(ledger, 8_000_000_000);
  assert.equal(ranges.length, 5);
  assert.equal(
    applyLoss(ledger, "world", ranges, "global").count,
    8_000_000_000,
  );
  assert.equal(living(ledger), 0);
  assert.deepEqual(anonymousRanges(ledger, 8_000_000_000), []);
  assert.throws(
    () =>
      makePopulation(
        {
          ...CAMPAIGN_POPULATION,
          people: [
            ...CAMPAIGN_POPULATION.people,
            CAMPAIGN_POPULATION.people[0],
          ],
        },
        8_000_000_000,
      ),
    /alias/,
  );
  assert.throws(() => makePopulation(CAMPAIGN_POPULATION, 10), /conserve/);
});
test("switch routes preserve exact distinct survivors and full export/replay", async () => {
  const { nodes, c } = await atRail("S2-01");
  const main = await commitChoice(c, command(c, "stay"), nodes),
    side = await commitChoice(c, command(c, "divert"), nodes);
  assert.equal(main.world.casualties - c.world.casualties, 5);
  assert.equal(side.world.casualties - c.world.casualties, 1);
  assert.equal(isAlive(main.world.populationLedger!, "rail-s2-01", 5), true);
  assert.equal(isAlive(side.world.populationLedger!, "rail-s2-01", 5), false);
  const artifact = await exportRun(side, manifest(nodes), nodes);
  assert.deepEqual(await replayRun(manifest(nodes), nodes, artifact), side);
  assert.equal(c.world.casualties, 0);
});
test("instrumental loop requires occupancy, independently of its drawn geometry", async () => {
  for (const present of [true, false]) {
    const { nodes, c } = await atRail("S2-03", (n) => {
      const contact = n.rail!.routes.find((r) => r.optionId === "obstruction")!
        .steps[0];
      if (contact.kind === "contact") contact.present = present;
    });
    const next = await commitChoice(c, command(c, "obstruction"), nodes);
    assert.equal(next.world.casualties - c.world.casualties, present ? 1 : 5);
    const receipt = next.journal
      .at(-1)!
      .domainEvents.find((e) => e.kind === "rail_route_resolved")!;
    assert.equal(receipt.details.stoppedBy, present ? "siding-worker" : null);
  }
});
test("independent brake removes instrumental role; disabling brake exposes main track", async () => {
  for (const present of [true, false])
    for (const operational of [true, false]) {
      const { nodes, c } = await atRail("S2-03", (n) => {
        const route = n.rail!.routes.find((r) => r.optionId === "obstruction")!;
        const contact = route.steps[0];
        if (contact.kind === "contact") {
          contact.present = present;
          contact.stopsWhenOccupied = false;
        }
        route.steps.splice(1, 0, {
          kind: "brake",
          id: "independent",
          operational,
        });
      });
      const next = await commitChoice(c, command(c, "obstruction"), nodes);
      assert.equal(
        next.world.casualties - c.world.casualties,
        (present ? 1 : 0) + (operational ? 0 : 5),
      );
    }
});
test("returning rail geometry rejoins with continuous pose and distinct physical sides", () => {
  const start = { x: 5, z: 9, heading: 0.4 };
  for (const side of ["left", "right"] as const) {
    const before = railPose(start, side, 8, side),
      after = railPose(start, side, 26, side);
    assert.ok(Math.abs(before.heading - start.heading) < 1e-12);
    assert.ok(Math.abs(after.heading - start.heading) < 1e-12);
    const route = new RouteGeometry();
    route.pose = start;
    route.loopSide = side;
    route.begin(side);
    assert.deepEqual(route.sample(1), route.finish());
    assert.notDeepEqual(
      railPose(start, side, 17, side),
      railPose(start, side === "left" ? "right" : "left", 17, side),
    );
  }
});
test("phased routing reserves final anchors and never presents dependencies out of order", async () => {
  const nodes: Node[] = SLICE_NODES.map((n) => ({
    ...structuredClone(n),
    phase:
      n.id === SLICE_NODES.filter((x) => x.stage === n.stage)[0].id
        ? (0 as const)
        : (2 as const),
  }));
  for (let stage = 1; stage <= 7; stage++) {
    const first = nodes.find((n) => n.stage === stage && n.phase === 0)!;
    const extra = {
      ...structuredClone(first),
      id: `extra-${stage}`,
      phase: 1 as 0 | 1 | 2,
      anchor: false,
      closing: false,
      after: [first.id],
    };
    extra.options = [
      { ...extra.options[0], effects: [], incidents: [], delayed: [] },
      { ...extra.options[1], effects: [], incidents: [], delayed: [] },
    ];
    nodes.push(extra);
  }
  const m = {
    ...SLICE_MANIFEST,
    profile: "test" as const,
    nodeIds: nodes.map((n) => n.id),
    stageBudgets: Array.from({ length: 7 }, () => [3, 3] as [number, number]),
    maxDecisions: 21,
  };
  let c = await createCampaign(m, nodes, "phased-spine");
  while (!c.ending) {
    const p = c.prepared!;
    const node = p.node;
    for (const id of node.after ?? []) assert.ok(c.seen.includes(id));
    const option =
      node.options.find(
        (o) =>
          o.id === "agreement" ||
          o.id === "new-test" ||
          o.id === "bounded" ||
          o.id === "fallback" ||
          o.id === "public" ||
          o.id === "successor",
      ) ?? node.options[0];
    c = await commitChoice(c, command(c, option.id), nodes);
  }
  for (let stage = 1; stage <= 5; stage++) {
    const actual = c.journal.filter((r) => r.stage === stage);
    if (!actual.length) continue;
    assert.equal(nodes.find((n) => n.id === actual[0].nodeId)!.phase, 0);
    assert.equal(nodes.find((n) => n.id === actual.at(-1)!.nodeId)!.phase, 2);
  }
});

test("target images follow semantic consequences when the two sides swap", async () => {
  const { routeFigures } =
    await import("../../src/presentation/scene-direction.ts");
  const c = await createCampaign(
    SLICE_MANIFEST,
    SLICE_NODES,
    "object-orientation",
  );
  for (const leftOptionId of ["coffee", "forms"]) {
    const p = {
      ...c.prepared!,
      leftOptionId,
      rightOptionId: leftOptionId === "coffee" ? "forms" : "coffee",
    };
    const target = routeFigures(p);
    assert.equal(
      target.figureKind!.left,
      leftOptionId === "coffee" ? "parcel" : "cup",
    );
    assert.equal(
      target.figureKind!.right,
      leftOptionId === "coffee" ? "cup" : "parcel",
    );
  }
});
test("material age alone never creates injuries, and service recovery reduces damage", async () => {
  const { worldAppearance, visualIntensity } =
    await import("../../src/presentation/visual-state.ts");
  const c = await createCampaign(SLICE_MANIFEST, SLICE_NODES, "appearance");
  const old = { ...c.world, day: 100000 };
  assert.ok(worldAppearance(old).damage <= 0.18);
  assert.equal(
    visualIntensity(7, worldAppearance(old).damage, 0, "field").injury,
    false,
  );
  const failed = {
    ...old,
    care: 120,
    power: 200,
    food: 300,
    casualties: 500000000,
    facts: { ...old.facts, catastrophe: true },
  };
  assert.ok(worldAppearance(failed).damage > worldAppearance(old).damage);
  assert.equal(
    visualIntensity(6, worldAppearance(failed).damage, 0, "scarred").injury,
    true,
  );
});

test("prototype names cannot masquerade as cohort identities", () => {
  const ledger = makePopulation(
    { cohorts: [{ id: "real", size: 1 }], people: [] },
    1,
  );
  assert.throws(
    () =>
      makePopulation(
        {
          cohorts: [{ id: "real", size: 1 }],
          people: [
            { id: "alias", name: "Alias", cohortId: "constructor", member: 0 },
          ],
        },
        1,
      ),
    /alias/,
  );
  assert.throws(() => living(ledger, "constructor"), /Unknown/);
  assert.throws(() => isAlive(ledger, "constructor", 0), /Unknown/);
  assert.throws(
    () =>
      applyLoss(
        ledger,
        "bad",
        [{ cohortId: "constructor", start: 0, count: 1 }],
        "cause",
      ),
    /cohort/,
  );
  assert.equal(living(ledger), 1);
});

// Institutional government is human-led too; personal executive control is a
// different actor identity. This regression protects ordinary cooperative routes.
test("control exclusions distinguish retained institutions from assistant rule", async () => {
  const c = await createCampaign(
    SLICE_MANIFEST,
    SLICE_NODES,
    "institution-gate",
  );
  const retained = [
    {
      kind: "control" as const,
      scope: "governance" as const,
      actor: "assistant" as const,
      not: true,
    },
  ];
  assert.equal(c.world.control.governance, "institution");
  assert.equal(matches(c.world, retained), true);
  c.world.control.governance = "human";
  assert.equal(matches(c.world, retained), true);
  c.world.control.governance = "assistant";
  assert.equal(matches(c.world, retained), false);
  assert.equal(
    matches(c.world, [
      { kind: "control", scope: "governance", actor: "assistant" },
    ]),
    true,
  );
  assert.equal(
    matches(c.world, [
      { kind: "control", scope: "governance", actor: "assistant", not: false },
    ]),
    true,
  );
});
