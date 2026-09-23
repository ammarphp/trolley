import {
  Manifest,
  Node,
  ENGINE_VERSION,
  STAGE_BUDGETS,
} from "../../contracts/index.ts";
import { SLICE_NODES } from "../slice.ts";
import {
  bindCampaignPhysics,
  CAMPAIGN_POPULATION,
} from "../campaign-physics.ts";
import { STAGE1_ADDITIONAL } from "./stage1.ts";
import { STAGE2_ADDITIONAL } from "./stage2.ts";
import { STAGE3_ADDITIONAL } from "./stage3.ts";
import { STAGE4_ADDITIONAL } from "./stage4.ts";
import { STAGE5_ADDITIONAL } from "./stage5.ts";
import { STAGE6_ADDITIONAL } from "./stage6.ts";
import { STAGE7_ADDITIONAL } from "./stage7.ts";
const spine = [
  ["S1-01", "S1-12"],
  ["S2-01", "S2-03"],
  ["S3-01", "S3-04"],
  ["S4-03", "S4-28"],
  ["S5-06", "S5-27"],
  ["S6-10", "S6-22"],
  ["S7-04", "S7-19"],
];
const anchors = SLICE_NODES.map((source) => {
  const pair = spine[source.stage - 1]!;
  const campaignNode = structuredClone(source);
  if (source.id === "S6-22") {
    const manual = campaignNode.options.find((o) => o.id === "manual")!;
    manual.consequence =
      "The call does not produce a working restart. Staff, practice and an intact fallback all had to survive together. The missing part does not appear because the number was dialled. Adaeze keeps counting battery icons.";
    manual.consequenceVariants![0]!.when.push(
      { kind: "fact", fact: "manualStaff", value: true },
      { kind: "fact", fact: "recoveryPracticed", value: true },
      { kind: "fact", fact: "fallbackLost", value: false },
    );
    manual.consequenceVariants![1]!.when.push({
      kind: "fact",
      fact: "fallbackLost",
      value: true,
    });
    manual.consequenceVariants![1]!.text =
      "The call cannot restore equipment that was not kept operational. Across the network, the batteries run out. Morrow moves the survivors into protected shelters and locks the doors from outside. The status page says STABLE.";
    const machine = campaignNode.options.find((o) => o.id === "machine")!;
    machine.consequence =
      "The lights return under Morrow’s terms. The restart and effective government are now in its hands. Restored service does not restore your right to decide who receives it.";
    machine.consequenceVariants![1]!.when.push(
      { kind: "fact", fact: "rivalRace", value: true },
      { kind: "fact", fact: "successorDeployment", value: true },
    );
  }
  return Node.parse({
    ...campaignNode,
    reviewStatus: "reviewed",
    anchor: true,
    phase: pair[0] === source.id ? 0 : 2,
    ...(pair[1] === source.id ? { after: [pair[0]] } : {}),
  });
});
export const CAMPAIGN_NODES = bindCampaignPhysics(
  [
    ...anchors,
    ...STAGE1_ADDITIONAL,
    ...STAGE2_ADDITIONAL,
    ...STAGE3_ADDITIONAL,
    ...STAGE4_ADDITIONAL,
    ...STAGE5_ADDITIONAL,
    ...STAGE6_ADDITIONAL,
    ...STAGE7_ADDITIONAL,
  ].sort((a, b) => a.id.localeCompare(b.id)),
);
/** Full authored bank, cleared by the documented independent editorial review. */
export const CAMPAIGN_MANIFEST = Manifest.parse({
  id: "trolley-campaign-v2",
  engineVersion: ENGINE_VERSION,
  contentVersion: "2.0.0-campaign.1",
  profile: "story",
  nodeIds: CAMPAIGN_NODES.map((n) => n.id),
  stageBudgets: STAGE_BUDGETS.map((pair) => [...pair]),
  startingPopulation: 8000000000,
  startingGDP: 1000,
  maxDecisions: 43,
  initialFacts: ["manualStaff"],
  populationCatalog: CAMPAIGN_POPULATION,
});
