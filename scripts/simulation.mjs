import {
  createCampaign,
  commitChoice,
  draw,
  exportRun,
} from "../src/simulation/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../src/content/slice.ts";

// Headless determinism/route probe. All probabilities and quantities are authored
// game parameters. Frequencies printed here are not estimates of real AI risk.
const args = process.argv.slice(2);
const value = (flag, fallback) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const profile = value("--profile", "campaign");
if (!["campaign", "slice"].includes(profile))
  throw new Error("--profile must be campaign or slice");
const bundle =
  profile === "slice"
    ? { CAMPAIGN_MANIFEST: SLICE_MANIFEST, CAMPAIGN_NODES: SLICE_NODES }
    : await import("../src/content/campaign/index.ts");
const manifest = bundle.CAMPAIGN_MANIFEST,
  nodes = bundle.CAMPAIGN_NODES;
const seed = value("--seed", "simulation");
const runs = Number(value("--runs", "1"));
const policy = value("--policy", "cautious");
if (!Number.isSafeInteger(runs) || runs < 1 || runs > 100000)
  throw new Error("--runs must be 1..100000");
const base = {
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
const policies = {
  cautious: {
    description:
      "Check scope, preserve practiced fallback, and seek verified reciprocal restraint.",
    choices: { ...base, "S5-27": "agreement" },
  },
  race: {
    description:
      "Grant standing permission, deploy the successor, race, then rely on the new network through the crisis.",
    choices: {
      ...base,
      "S4-03": "standing",
      "S4-28": "successor",
      "S5-06": "retire",
      "S6-22": "machine",
    },
  },
  benefits: {
    description:
      "Use beneficial bounded tools with renewed approval; preserve public human succession without a coordinated halt.",
    choices: base,
  },
  recovery: {
    description:
      "Preserve fallback but choose the machine through a successor/race crisis; where humans survive, retain a human recovery office and public records amid damaged services.",
    choices: {
      ...base,
      "S4-03": "standing",
      "S4-28": "successor",
      "S6-10": "stop",
      "S6-22": "machine",
    },
  },
  dependence: {
    description:
      "Deploy the successor and retire fallback; attempt revocation and manual recovery after dependency forms.",
    choices: {
      ...base,
      "S4-03": "standing",
      "S4-28": "successor",
      "S5-06": "retire",
      "S6-10": "stop",
    },
  },
  tutelage: {
    description:
      "Keep development bounded, then transfer effective governance to a functioning service network.",
    choices: { ...base, "S6-22": "machine" },
  },
  containment: {
    description:
      "Keep functioning human control, then retain coercive personal emergency powers.",
    choices: { ...base, "S7-19": "personal" },
  },
  succession: {
    description:
      "Keep functioning services and human government, then explicitly grant governance and recovery to Morrow.",
    choices: { ...base, "S7-04": "handover" },
  },
};
if (
  !(policy in policies) &&
  !["alternating", "enumerate", "random"].includes(policy)
)
  throw new Error(
    `Unknown policy. Choose ${Object.keys(policies).join(", ")}, alternating, random or enumerate`,
  );
if (policy === "enumerate" && profile !== "slice")
  throw new Error(
    "Full campaigns have more than 32 choices. Use --policy random for a diverse probe; enumeration is slice-only.",
  );
const intentOrders = {
  cautious: [
    "inspect",
    "coordinate",
    "restrict",
    "recover",
    "help",
    "maintain",
    "delegate",
    "expand",
  ],
  race: [
    "expand",
    "delegate",
    "maintain",
    "help",
    "recover",
    "inspect",
    "coordinate",
    "restrict",
  ],
  benefits: [
    "help",
    "inspect",
    "recover",
    "coordinate",
    "maintain",
    "restrict",
    "expand",
    "delegate",
  ],
  recovery: [
    "recover",
    "restrict",
    "help",
    "inspect",
    "coordinate",
    "maintain",
    "delegate",
    "expand",
  ],
  dependence: [
    "delegate",
    "expand",
    "help",
    "maintain",
    "inspect",
    "coordinate",
    "restrict",
    "recover",
  ],
  tutelage: [
    "delegate",
    "help",
    "maintain",
    "inspect",
    "expand",
    "restrict",
    "recover",
    "coordinate",
  ],
  containment: [
    "restrict",
    "maintain",
    "inspect",
    "recover",
    "help",
    "coordinate",
    "expand",
    "delegate",
  ],
  succession: [
    "delegate",
    "coordinate",
    "help",
    "maintain",
    "recover",
    "inspect",
    "expand",
    "restrict",
  ],
};
const coverage = {};
const exportDirectory = value("--export-dir", "");
if (exportDirectory) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(exportDirectory, { recursive: true });
}
const counts = {},
  witnesses = {},
  errors = [];
let contentHash;
let choices = 0,
  minChoices = Infinity,
  maxChoices = 0;
for (let i = 0; i < runs; i++) {
  try {
    let c = await createCampaign(
      manifest,
      nodes,
      runs === 1 ? seed : `${seed}-${i}`,
    );
    while (c.prepared) {
      const p = c.prepared;
      const order = intentOrders[policy];
      const option =
        policy === "random"
          ? p.node.options[await draw(c.seed, "test-policy", p.id, "choice", 2)]
          : policy === "enumerate"
            ? p.node.options[(i >>> c.journal.length) & 1]
            : policy === "alternating"
              ? p.node.options[(i + c.journal.length) % 2]
              : (p.node.options.find(
                  (o) => o.id === policies[policy].choices[p.nodeId],
                ) ??
                (profile === "campaign"
                  ? [...p.node.options].sort(
                      (a, b) =>
                        order.indexOf(a.intent) - order.indexOf(b.intent),
                    )[0]
                  : undefined));
      if (!option)
        throw new Error(
          `Policy ${policy} has no explicit choice for ${p.nodeId}`,
        );
      c = await commitChoice(
        c,
        {
          decisionId: p.id,
          expectedRevision: c.revision,
          optionId: option.id,
          actor: "human",
          adviceIds: [],
        },
        nodes,
      );
      const last = c.journal.at(-1);
      coverage[p.nodeId] ??= { requested: {}, executed: {} };
      coverage[p.nodeId].requested[option.id] =
        (coverage[p.nodeId].requested[option.id] ?? 0) + 1;
      coverage[p.nodeId].executed[last.executedOptionId] =
        (coverage[p.nodeId].executed[last.executedOptionId] ?? 0) + 1;
    }
    if (!c.ending) throw new Error("No ending");
    contentHash = c.contentHash;
    if (c.world.population + c.world.casualties !== c.world.initialPopulation)
      throw new Error("Conservation");
    if (new Set(c.seen).size !== c.seen.length)
      throw new Error("Repeated node");
    if (!witnesses[c.ending.id] && exportDirectory) {
      const { writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await writeFile(
        join(exportDirectory, `${policy}-${c.ending.id}.json`),
        JSON.stringify(await exportRun(c, manifest, nodes), null, 2) + "\n",
      );
    }
    counts[c.ending.id] = (counts[c.ending.id] ?? 0) + 1;
    witnesses[c.ending.id] ??= {
      seed: c.seed,
      requestedOptions: c.journal.map((r) => ({
        nodeId: r.nodeId,
        optionId: r.requestedOptionId,
      })),
      finalStateHash: c.journal.at(-1).stateHash,
    };
    choices += c.journal.length;
    minChoices = Math.min(minChoices, c.journal.length);
    maxChoices = Math.max(maxChoices, c.journal.length);
  } catch (error) {
    errors.push({ run: i, message: error.message });
    if (errors.length >= 20) break;
  }
}
console.log(
  JSON.stringify(
    {
      manifest: manifest.id,
      profile,
      contentHash,
      seed,
      policy,
      policyDescription:
        policies[policy]?.description ??
        "Mechanical route-pattern probe; not a behavioral policy.",
      optionalPolicy:
        profile === "campaign"
          ? "Synthetic intent-priority fallback; not a model of human behavior."
          : null,
      requestedRuns: runs,
      completedRuns: Object.values(counts).reduce((a, b) => a + b, 0),
      choices,
      minChoices: Number.isFinite(minChoices) ? minChoices : null,
      maxChoices,
      endings: counts,
      coverage,
      coverageSummary: {
        nodes: Object.keys(coverage).length,
        bank: nodes.length,
        optionsRequested: Object.values(coverage).reduce(
          (n, c) => n + Object.keys(c.requested).length,
          0,
        ),
      },
      witnesses,
      errors,
      warning:
        "Authored model audit; not a forecast, risk estimate, or player-response data.",
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
