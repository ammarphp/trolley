import { readFile, writeFile } from "node:fs/promises";
import { replayRun } from "../src/simulation/index.ts";
import { resolveBundle } from "../src/content/registry.ts";
const args = process.argv.slice(2).filter((x) => x !== "--");
if (!args[0])
  throw new Error(
    "Usage: pnpm replay path/to/trolley-replay.json [summary.json]",
  );
const text = await readFile(args[0], "utf8");
if (Buffer.byteLength(text) > 16 * 1024 * 1024)
  throw new Error("Replay exceeds the local audit size limit.");
const artifact = JSON.parse(text);
const { manifest, nodes } = await resolveBundle(artifact?.contentHash);
const c = await replayRun(manifest, nodes, artifact);
const summary = {
  status: "verified-replay",
  engineVersion: c.engineVersion,
  contentVersion: c.contentVersion,
  contentHash: c.contentHash,
  manifestHash: c.manifestHash,
  seed: c.seed,
  decisions: c.journal.length,
  ending: c.ending?.id || null,
  units: {
    population: "fictional people",
    casualties: "fictional people",
    gdp: "authored index; initial 1000",
    capability: "authored capability index; not measured intelligence",
  },
  choices: c.journal.map((r) => ({
    ordinal: r.revision,
    nodeId: r.nodeId,
    requested: r.requestedOptionId,
    executed: r.executedOptionId,
    status: r.status,
    executor: r.executor,
    day: r.dayAfter,
    metrics: r.metrics,
  })),
  limits:
    "One authored simulation run. No person-level inference, moral score, real-world risk estimate or public player statistic.",
};
if (args[1]) await writeFile(args[1], JSON.stringify(summary, null, 2) + "\n");
else console.log(JSON.stringify(summary, null, 2));
