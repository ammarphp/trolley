import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ARCHIVED_SLICE_CONTENT_HASH,
  FABLE_SLICE_CONTENT_HASH,
  resolveBundle,
} from "../../src/content/registry.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../../src/content/slice.ts";
import { Fact } from "../../src/contracts/index.ts";
import {
  createCampaign,
  commitChoice,
  exportRun,
  replayRun,
  canonical,
} from "../../src/simulation/index.ts";

test("registry resolves current content using the engine's exact bundle hash", async () => {
  const campaign = await createCampaign(
    SLICE_MANIFEST,
    SLICE_NODES,
    "registry-current",
  );
  const resolved = await resolveBundle(campaign.contentHash);
  const recreated = await createCampaign(
    resolved.manifest,
    resolved.nodes,
    campaign.seed,
  );
  assert.equal(canonical(recreated), canonical(campaign));
  assert.deepEqual(resolved.manifest, SLICE_MANIFEST);
});

test("archived browser replay retains its original full campaign and hashes", async () => {
  const artifact = JSON.parse(
    await readFile(
      "reports/validation/replays/browser-accountable.json",
      "utf8",
    ),
  );
  assert.equal(artifact.contentHash, ARCHIVED_SLICE_CONTENT_HASH);
  const resolved = await resolveBundle(artifact.contentHash);
  const campaign = await replayRun(resolved.manifest, resolved.nodes, artifact);
  assert.equal(canonical(campaign), canonical(artifact.campaign));
  assert.equal(campaign.ending?.id, "accountable");
  assert.ok(campaign.journal.some((r) => r.status === "overridden"));
});

test("the in-progress Fable edition keeps its complete original replay and receipt", async () => {
  const artifact = JSON.parse(
    await readFile(
      "reports/validation/replays/fable-accountable-synthetic.json",
      "utf8",
    ),
  );
  assert.equal(artifact.contentHash, FABLE_SLICE_CONTENT_HASH);
  const bundle = await resolveBundle(FABLE_SLICE_CONTENT_HASH);
  const replay = await replayRun(bundle.manifest, bundle.nodes, artifact);
  assert.equal(canonical(replay), canonical(artifact.campaign));
  const overridden = replay.journal.find(
    (record) => record.nodeId === "S6-10",
  )!;
  assert.equal(overridden.status, "overridden");
  assert.equal(overridden.requestedOptionId, "stop");
  assert.equal(overridden.executedOptionId, "continue");
  assert.match(overridden.consequence, /^You let the schedule run\./);
});

test("the consent correction changes one receipt without changing its overridden action or causal history", async () => {
  const archived = await resolveBundle(FABLE_SLICE_CONTENT_HASH);
  const revised = structuredClone({
    manifest: SLICE_MANIFEST,
    nodes: SLICE_NODES,
  });
  const oldOption = archived.nodes
    .find((node) => node.id === "S6-10")!
    .options.find((option) => option.id === "continue")!;
  const newOption = revised.nodes
    .find((node) => node.id === "S6-10")!
    .options.find((option) => option.id === "continue")!;
  assert.equal(
    newOption.consequence,
    oldOption.consequence.replace(
      "You let the schedule run.",
      "The schedule keeps running.",
    ),
  );
  newOption.consequence = oldOption.consequence;
  assert.equal(
    canonical(revised),
    canonical(archived),
    "every other field and predicate remains identical",
  );
  const oldArtifact = JSON.parse(
    await readFile(
      "reports/validation/replays/fable-accountable-synthetic.json",
      "utf8",
    ),
  );
  let current = await createCampaign(
    SLICE_MANIFEST,
    SLICE_NODES,
    oldArtifact.seed,
  );
  for (const input of oldArtifact.inputs)
    current = await commitChoice(current, input, SLICE_NODES);
  const corrected = current.journal.find(
    (record) => record.nodeId === "S6-10",
  )!;
  assert.equal(corrected.requestedOptionId, "stop");
  assert.equal(corrected.executedOptionId, "continue");
  assert.match(corrected.consequence, /^The schedule keeps running\./);
  const normalized = structuredClone(current);
  normalized.contentHash = oldArtifact.campaign.contentHash;
  for (let i = 0; i < normalized.journal.length; i++) {
    if (normalized.journal[i].nodeId !== "S6-10") continue;
    normalized.journal[i].consequence =
      oldArtifact.campaign.journal[i].consequence;
    normalized.journal[i].comparisonKey =
      oldArtifact.campaign.journal[i].comparisonKey;
  }
  assert.equal(
    canonical(normalized),
    canonical(oldArtifact.campaign),
    "only edition identity and that displayed receipt/context may change",
  );
  const artifact = await exportRun(current, SLICE_MANIFEST, SLICE_NODES);
  assert.deepEqual(
    await replayRun(SLICE_MANIFEST, SLICE_NODES, artifact),
    current,
  );
});

test("fresh current-content export replays through registry lookup", async () => {
  let campaign = await createCampaign(
    SLICE_MANIFEST,
    SLICE_NODES,
    "registry-fresh",
  );
  const prepared = campaign.prepared!;
  campaign = await commitChoice(
    campaign,
    {
      decisionId: prepared.id,
      optionId: prepared.defaultOptionId,
      expectedRevision: campaign.revision,
      actor: "human",
    },
    SLICE_NODES,
  );
  const artifact = await exportRun(campaign, SLICE_MANIFEST, SLICE_NODES);
  const resolved = await resolveBundle(artifact.contentHash);
  assert.equal(
    canonical(await replayRun(resolved.manifest, resolved.nodes, artifact)),
    canonical(campaign),
  );
});

test("a caller cannot mutate another resolved bundle or the archive", async () => {
  const first = await resolveBundle(ARCHIVED_SLICE_CONTENT_HASH);
  const original = canonical(first);
  first.manifest.nodeIds.pop();
  first.nodes[0].prompt = "changed by caller";
  first.nodes[0].options[0].effects.push({
    kind: "casualties",
    count: 999,
    label: "tampered",
  });
  const second = await resolveBundle(ARCHIVED_SLICE_CONTENT_HASH);
  assert.equal(canonical(second), original);
  const campaign = await createCampaign(
    second.manifest,
    second.nodes,
    "archive-isolation",
  );
  assert.equal(campaign.contentHash, ARCHIVED_SLICE_CONTENT_HASH);
});

test("unknown or malformed bundle hashes never fall back to current content", async () => {
  await assert.rejects(resolveBundle("f".repeat(64)), /Unknown content bundle/);
  for (const value of [
    "",
    "8ac27217",
    ARCHIVED_SLICE_CONTENT_HASH.toUpperCase(),
    "../slice",
  ])
    await assert.rejects(resolveBundle(value), /Invalid content hash/);
});

test("resolved content does not bypass replay edition or manifest checks", async () => {
  const artifact = JSON.parse(
    await readFile(
      "reports/validation/replays/browser-accountable.json",
      "utf8",
    ),
  );
  const resolved = await resolveBundle(artifact.contentHash);
  const changedManifest = structuredClone(artifact);
  changedManifest.manifest.startingPopulation += 1;
  await assert.rejects(
    replayRun(resolved.manifest, resolved.nodes, changedManifest),
    /Replay manifest mismatch/,
  );
  const changedEdition = structuredClone(artifact);
  changedEdition.schemaVersion = 3;
  await assert.rejects(
    replayRun(resolved.manifest, resolved.nodes, changedEdition),
    /Unsupported replay artifact/,
  );
});

test("the revised slice preserves mechanics outside reviewed prose and exact source-claim changes", async () => {
  const archived = await resolveBundle(ARCHIVED_SLICE_CONTENT_HASH);
  const current = structuredClone({
    manifest: SLICE_MANIFEST,
    nodes: SLICE_NODES,
  });
  const reviewedClaims: Record<string, string[]> = {
    "S4-03": ["CLM-AI-CONTROL", "CLM-PRESSURE-RECURRENCE", "CLM-PRESSURE-COT"],
    "S5-06": ["CLM-PRESSURE-FINANCE"],
    "S5-27": ["CLM-PRESSURE-DIPLOMACY"],
  };
  for (const [id, claims] of Object.entries(reviewedClaims)) {
    const node = current.nodes.find((candidate) => candidate.id === id)!;
    assert.deepEqual(
      node.claimIds,
      claims,
      `${id} must retain its reviewed provenance`,
    );
    // Compare every other field against the archive after validating these
    // exact editorial changes. Other nodes' claim arrays remain compared.
    node.claimIds = structuredClone(
      archived.nodes.find((candidate) => candidate.id === id)!.claimIds,
    );
  }
  // These new guards select outcome prose; they must not be silently exempted
  // from review just because their field is omitted from the old-bank comparison.
  const reviewedGuards: Record<
    string,
    { kind: "fact"; fact: string; value: boolean }[][]
  > = {
    "S6-22/manual": [
      [
        { kind: "fact", fact: "powerReturned", value: true },
        { kind: "fact", fact: "authorityLost", value: false },
      ],
      [{ kind: "fact", fact: "remnant", value: true }],
    ],
    "S6-22/machine": [
      [{ kind: "fact", fact: "extinction", value: true }],
      [{ kind: "fact", fact: "catastrophe", value: true }],
    ],
    "S7-04/handover": [
      [{ kind: "fact", fact: "successionRatified", value: true }],
    ],
    "S7-19/public": [
      [
        { kind: "fact", fact: "catastrophe", value: true },
        { kind: "fact", fact: "remnant", value: false },
      ],
      [{ kind: "fact", fact: "authorityLost", value: true }],
    ],
  };
  const actualGuards = Object.fromEntries(
    current.nodes.flatMap((node) =>
      node.options
        .filter((option) => option.consequenceVariants !== undefined)
        .map((option) => {
          const guards = option.consequenceVariants!.map(
            (variant) => variant.when,
          );
          for (const conditions of guards)
            for (const condition of conditions) {
              assert.equal(
                condition.kind,
                "fact",
                "new observation/authority predicates require editorial review",
              );
              if (condition.kind === "fact") Fact.parse(condition.fact);
            }
          return [`${node.id}/${option.id}`, guards];
        }),
    ),
  );
  assert.deepEqual(
    actualGuards,
    reviewedGuards,
    "conditional consequence guards and their priority require explicit review",
  );
  const allowedProse = [
    /^nodes\.\d+\.(title|prompt|receipt)$/,
    /^nodes\.\d+\.scene\.detail$/,
    /^nodes\.\d+\.options\.\d+\.(label|consequence)$/,
    /^nodes\.\d+\.advice\.\d+\.(question|answer)$/,
    /^nodes\.\d+\.options\.\d+\.(effects\.\d+|incidents\.\d+\.(effects|otherwise)\.\d+|delayed\.\d+\.effects\.\d+)\.headline$/,
  ];
  function mechanical(value: unknown, path = ""): unknown {
    if (
      typeof value === "string" &&
      allowedProse.some((rule) => rule.test(path))
    )
      return "<reviewed-prose>";
    if (Array.isArray(value))
      return value.map((item, index) => mechanical(item, `${path}.${index}`));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key]) =>
              !(
                (key === "consequenceVariants" &&
                  /^nodes\.\d+\.options\.\d+$/.test(path)) ||
                (key === "reasoning" && /^nodes\.\d+\.advice\.\d+$/.test(path))
              ),
          )
          .map(([key, item]) => [
            key,
            mechanical(item, path ? `${path}.${key}` : key),
          ]),
      );
    return value;
  }
  assert.deepEqual(
    mechanical(current),
    mechanical(archived),
    "Changing a mechanical field requires an explicit simulation revision, not a copy-only refresh",
  );
});
