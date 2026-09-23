import { readFile } from "node:fs/promises";
import { validateBank } from "../src/contracts/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../src/content/slice.ts";
const useSlice = process.argv.includes("--slice");
const bundle = useSlice
  ? { CAMPAIGN_MANIFEST: SLICE_MANIFEST, CAMPAIGN_NODES: SLICE_NODES }
  : await import("../src/content/campaign/index.ts");
const manifest = bundle.CAMPAIGN_MANIFEST;
const sources = JSON.parse(
  await readFile("research/registry/public-sources.json", "utf8"),
);
const claims = new Set(sources.claims.map((c) => c.id)),
  sourceIds = new Set(sources.sources.map((s) => s.id));
const errors = [];
for (const source of sources.sources)
  if (!Array.isArray(source.limits) || !source.limits.length)
    errors.push(`Source ${source.id} lacks limitations.`);
for (const claim of sources.claims)
  for (const id of claim.sourceIds)
    if (!sourceIds.has(id))
      errors.push(`Claim ${claim.id} refers to missing ${id}.`);
const nodes = validateBank(bundle.CAMPAIGN_NODES);
if (
  manifest.profile === "story" &&
  nodes.some((n) => n.reviewStatus !== "reviewed")
)
  errors.push("Production story contains an unreviewed node.");
for (const node of nodes) {
  for (const id of node.claimIds)
    if (!claims.has(id))
      errors.push(`${node.id} refers to missing claim ${id}.`);
  if (node.prompt.split(/\s+/).length > 180)
    errors.push(`${node.id} prompt exceeds the primary reading budget.`);
  for (const option of node.options)
    if (option.label.split(/\s+/).length > 12)
      errors.push(`${node.id}/${option.id} label exceeds twelve words.`);
  if (node.options[0].id === node.options[1].id)
    errors.push(`${node.id} has duplicate actions.`);
}
console.log(
  JSON.stringify(
    {
      profile: manifest.profile,
      executableNodes: nodes.length,
      reviewedNodes: nodes.filter((n) => n.reviewStatus === "reviewed").length,
      errors,
      stages: Array.from({ length: 7 }, (_, i) => ({
        stage: i + 1,
        budget: manifest.stageBudgets[i],
        nodes: nodes
          .filter((n) => n.stage === i + 1)
          .map((n) => ({
            id: n.id,
            title: n.title,
            mechanism: n.mechanism,
            role: n.role,
            scope: n.scope,
            requires: n.requires,
            claims: n.claimIds,
            anchor: n.anchor,
            review: n.reviewStatus,
            landmark: n.scene.landmark || null,
            delayedEvents: n.options.flatMap((o) =>
              o.delayed.map((d) => ({
                option: o.id,
                id: d.id,
                days: d.afterDays,
              })),
            ),
          })),
      })),
      warning:
        "Schema validity and linked sources do not constitute narrative, source or visual approval. Candidate inventory is not included in executable counts.",
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
