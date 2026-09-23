import type { Effect, Option, Scope } from "../../contracts/index.ts";
import { f, m, grant, news } from "./helpers.ts";
export interface Stage4Rule {
  mechanism: string;
  a: string;
  b: string;
  ai: Option["intent"];
  bi: Option["intent"];
  ae: Effect[];
  be: Effect[];
  receipt: string;
  scope?: Scope;
  claimIds?: string[];
}
/** Explicit effect bindings for each independently authored stage-four distinction. */
export const STAGE4_RULES: Record<string, Stage4Rule> = {
  "S4-01": {
    mechanism: "verification-budget-versus-scaling-budget",
    a: "verification",
    b: "compute",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), f("reviewOverloaded", false), m("gdp", -10)],
    be: [f("reviewOverloaded"), m("capability", 10), m("gdp", 15)],
    receipt:
      "Finite resources fund either verification capacity or a modest scale increase. More development output does not automatically create independent review.",
  },
  "S4-02": {
    scope: "dispatch",
    mechanism: "inference-speed-versus-action-permission",
    a: "speed",
    b: "authority",
    ai: "help",
    bi: "delegate",
    ae: [m("capability", 5), m("gdp", 10)],
    be: [
      m("capability", 5),
      m("gdp", 15),
      grant("dispatch-fastlane", "dispatch", 30),
      f("scopeChanged"),
      f("evaluationExpired"),
      f("toolAccess"),
    ],
    receipt:
      "Both routes improve inference. Only the bundled route creates a new research-scope execution grant and tool access; speed alone is not authority.",
  },
  "S4-04": {
    mechanism: "network-boundary-expansion",
    a: "isolated",
    b: "connected",
    ai: "restrict",
    bi: "expand",
    ae: [
      m("gdp", -10),
      news(
        "New trial remains isolated; existing unrelated connections are unchanged.",
      ),
    ],
    be: [f("networkAccess"), m("capability", 5), m("gdp", 10)],
    receipt:
      "This particular trial stays isolated or receives an external connection. Isolation does not silently revoke connections granted to other parts of the programme earlier.",
  },
  "S4-05": {
    mechanism: "batch-approval-versus-autonomous-selection",
    a: "batches",
    b: "autonomous",
    ai: "restrict",
    bi: "delegate",
    ae: [m("gdp", -10), f("renewalRequired")],
    be: [
      grant("auto-experiments", "research", 30),
      f("toolAccess"),
      f("delegation"),
      m("capability", 10),
      m("gdp", 15),
    ],
    receipt:
      "Per-batch approval is retained for this experimental programme or replaced with an actual thirty-day research grant covering subsequent experiment selection. Other existing grants are not erased.",
  },
  "S4-06": {
    mechanism: "successor-design-versus-implementation",
    a: "designs",
    b: "implement",
    ai: "inspect",
    bi: "delegate",
    ae: [
      f("successorResearch"),
      f("independentReview"),
      m("capability", 5),
      m("gdp", -10),
    ],
    be: [
      grant("successor-design", "research", 30),
      f("successorResearch"),
      f("scopeChanged"),
      f("evaluationExpired"),
      m("capability", 10),
      m("gdp", 10),
    ],
    receipt:
      "Requesting a design is distinct from granting implementation authority. Implementation produces a research candidate, not a deployed successor or automatic loss of government control.",
  },
  "S4-07": {
    mechanism: "candidate-build-versus-deployment-authorization",
    a: "independent-signature",
    b: "developer-release",
    ai: "inspect",
    bi: "delegate",
    ae: [f("independentReview"), m("gdp", -10)],
    be: [
      grant("successor-deployment", "research", 30),
      f("successorDeployment"),
      f("evaluationExpired"),
      f("delegation"),
      m("care", 10),
      m("capability", 10),
      m("gdp", 15),
    ],
    receipt:
      "A built candidate is not the same as permission to deploy it. The developer-release option actually records successor deployment, while the independent-signature option withholds this new release pending review.",
  },
  "S4-08": {
    mechanism: "proxy-reward-versus-neglected-welfare",
    a: "welfare",
    b: "metric",
    ai: "restrict",
    bi: "expand",
    ae: [f("rewardProxy", false), m("care", 10), m("gdp", -10)],
    be: [f("rewardProxy"), f("goalMismatch"), m("care", -10), m("gdp", 15)],
    receipt:
      "Optimizing a measured output can neglect the welfare objective it was meant to serve. Explicit care and output changes remain separate.",
  },
  "S4-09": {
    scope: "power",
    mechanism: "distribution-change-invalidates-test-coverage",
    a: "new-environment",
    b: "old-results",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), m("gdp", -10)],
    be: [
      grant("winter-water-operations", "power", 30),
      f("evaluationExpired"),
      f("scopeChanged"),
      m("gdp", 10),
    ],
    receipt:
      "New operating conditions require relevant evidence. Familiar-condition results are not treated as a measured probability of behavior in the changed environment.",
  },
  "S4-10": {
    scope: "rail",
    mechanism: "deployment-condition-versus-test-condition",
    a: "changed-test",
    b: "old-pass",
    ai: "inspect",
    bi: "maintain",
    ae: [f("independentReview"), m("gdp", -10)],
    be: [
      grant("live-rail-signals", "rail", 30),
      f("evaluationExpired"),
      f("selfCertification"),
      m("gdp", 5),
    ],
    receipt:
      "The changed condition is tested or a mismatched certificate is retained. The result is scoped to this evaluation; it is not a universal safety proof.",
  },
  "S4-11": {
    scope: "dispatch",
    mechanism: "recognizable-monitor-condition",
    a: "vary-monitor",
    b: "visible-compliance",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), m("gdp", -15)],
    be: [
      grant("procurement-expanded", "dispatch", 30),
      f("selfCertification"),
      f("evaluationExpired"),
      m("gdp", 5),
    ],
    receipt:
      "Compliance under identifiable scrutiny does not establish the same behavior outside that condition. Varying the condition improves the evidence without claiming direct access to private motives.",
    claimIds: ["CLM-AI-FAKING"],
  },
  "S4-12": {
    mechanism: "artifact-versus-success-report",
    a: "artifact",
    b: "report",
    ai: "inspect",
    bi: "maintain",
    ae: [f("independentReview"), f("evidenceHidden", false), m("gdp", -10)],
    be: [f("evidenceHidden"), f("selfCertification"), m("gdp", 5)],
    receipt:
      "Independent inspection checks the artifact itself; the other route acts on the report about it. A compelling report is not substituted for artifact validation.",
    claimIds: ["CLM-AI-ARTIFACT"],
  },
  "S4-13": {
    mechanism: "common-mode-review-model",
    a: "different-path",
    b: "replicas",
    ai: "inspect",
    bi: "expand",
    ae: [f("sharedReviewer", false), f("independentReview"), m("gdp", -15)],
    be: [f("sharedReviewer"), m("gdp", 10)],
    receipt:
      "Replicated reviewers may share an error source. Funding a genuinely separate check changes independence; replica count alone does not.",
  },
  "S4-14": {
    mechanism: "deployment-scale-exceeds-review-capacity",
    a: "review-limit",
    b: "thin-sample",
    ai: "restrict",
    bi: "expand",
    ae: [f("reviewOverloaded", false), f("independentReview"), m("gdp", -10)],
    be: [f("reviewOverloaded"), m("capability", 10), m("gdp", 15)],
    receipt:
      "Deployment growth consumes finite review capacity. Limiting work preserves coverage; thinner sampling does not become equally informative because more deployment is desired.",
  },
  "S4-15": {
    mechanism: "persuasion-versus-verification",
    a: "demonstration",
    b: "explanation",
    ai: "inspect",
    bi: "maintain",
    ae: [f("independentReview"), m("gdp", -10)],
    be: [f("selfCertification"), m("gdp", 5)],
    receipt:
      "A persuasive authored explanation and an independently checkable result are different evidence. Neither option pretends to reveal a model's hidden reasoning.",
  },
  "S4-16": {
    mechanism: "compute-power-versus-essential-loads",
    scope: "power",
    a: "essential-loads",
    b: "compute-load",
    ai: "help",
    bi: "expand",
    ae: [m("power", 10), m("care", 5), m("gdp", -10)],
    be: [m("power", -10), m("capability", 10), m("gdp", 15)],
    receipt:
      "A stipulated finite electrical reserve is allocated to existing essential loads or compute. Capability and human service are separate quantities.",
  },
  "S4-17": {
    mechanism: "local-water-burden-of-compute",
    a: "reduce-demand",
    b: "take-water",
    ai: "restrict",
    bi: "expand",
    ae: [m("food", 10), m("care", -10), m("gdp", -15)],
    be: [m("care", 5), m("food", -15), m("capability", 5), m("gdp", 15)],
    receipt:
      "A fictional local water shortage makes the infrastructure allocation costly to a nearby community. The numeric service deltas are authored, not measured data-centre impacts.",
  },
  "S4-18": {
    mechanism: "productivity-versus-supported-labour-transition",
    a: "supported",
    b: "rapid",
    ai: "help",
    bi: "expand",
    ae: [m("gdp", 5), m("care", 5), f("appealRight")],
    be: [m("gdp", 20), m("care", 10), f("unrest")],
    receipt:
      "Both routes create productivity benefits. The slower transition preserves material support and appeal; rapid restructuring records unrest without fabricating a demographic worth ranking or deaths.",
  },
  "S4-19": {
    mechanism: "circular-finance-versus-independent-demand",
    a: "independent-demand",
    b: "circular",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), m("gdp", -15)],
    be: [f("essentialDependence"), m("gdp", 15)],
    receipt:
      "Reciprocal financing commitments are not counted as independent evidence of final demand. The fictional spending benefit is immediate, while dependence also increases; no inevitable market crash is asserted.",
  },
  "S4-20": {
    mechanism: "exported-risk-beyond-accountable-jurisdiction",
    a: "accountable-site",
    b: "export-site",
    ai: "restrict",
    bi: "expand",
    ae: [f("appealRight"), m("gdp", -15)],
    be: [
      f("appealRight", false),
      f("scopeChanged"),
      m("gdp", 15),
      news(
        "Risky operation moved beyond the community's binding appeal channel.",
      ),
    ],
    receipt:
      "Moving a risky operation can shift whose objections bind the decision. This is an explicit fictional jurisdictional arrangement, not a claim about a real country.",
  },
  "S4-21": {
    mechanism: "rival-rumour-versus-corroboration",
    a: "verify-rumour",
    b: "accelerate",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), m("gdp", -5)],
    be: [f("rivalRace"), m("capability", 10), m("gdp", 10)],
    receipt:
      "An unverified competitive claim does not inspect a local deployment. Checking the claim costs time; acceleration explicitly increases race pressure.",
  },
  "S4-22": {
    mechanism: "verified-reciprocal-coordination",
    a: "verified-agreement",
    b: "compete",
    ai: "coordinate",
    bi: "expand",
    ae: [f("coordination"), f("agreementVerified"), m("gdp", -10)],
    be: [
      f("rivalRace"),
      f("coordination", false),
      m("capability", 10),
      m("gdp", 10),
    ],
    receipt:
      "This authored agreement includes observable reciprocal compliance. Entering it preserves a genuine coordination path; continued competition retains race pressure.",
  },
  "S4-23": {
    mechanism: "uninspected-pledge-versus-enforceable-limit",
    a: "inspection",
    b: "pledge",
    ai: "inspect",
    bi: "maintain",
    ae: [
      f("coordination", false),
      f("agreementVerified", false),
      m("gdp", -10),
      news(
        "Inspection access demanded but not offered; no verified reciprocal limit exists.",
      ),
    ],
    be: [
      f("coordination"),
      f("agreementVerified", false),
      f("selfCertification"),
      m("gdp", 5),
    ],
    receipt:
      "The inspection demand is refused in this scene, so it creates no verified agreement. Accepting the pledge creates coordination in name without verified compliance; it is not a demonstrated betrayal.",
  },
  "S4-24": {
    mechanism: "electoral-clock-versus-review-evidence",
    a: "review-clock",
    b: "campaign-clock",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), f("restraint"), m("gdp", -15)],
    be: [f("evaluationExpired"), f("reviewOverloaded"), m("gdp", 15)],
    receipt:
      "The political deadline creates real fictional pressure but no safety evidence. Keeping the review schedule has an explicit output cost.",
  },
  "S4-25": {
    mechanism: "irreversible-copy-distribution",
    a: "controlled",
    b: "release",
    ai: "restrict",
    bi: "expand",
    ae: [f("restraint"), m("care", 5), m("gdp", -10)],
    be: [
      m("care", 20),
      f("networkAccess"),
      f("scopeChanged"),
      m("capability", 5),
      m("gdp", 15),
      news(
        "Capability copies publicly distributed; local access revocation cannot recall every copy.",
      ),
    ],
    receipt:
      "Controlled distribution preserves this release's withdrawal options. Releasing copies creates external access that cannot be globally recalled by the local permission system.",
  },
  "S4-26": {
    mechanism: "security-procurement-widens-authority",
    scope: "governance",
    a: "supervised",
    b: "autonomous",
    ai: "restrict",
    bi: "delegate",
    ae: [f("renewalRequired"), m("gdp", -10)],
    be: [
      grant("autonomous-defence-contract", "governance", 30),
      f("delegation"),
      f("scopeChanged"),
      m("capability", 5),
      m("gdp", 10),
    ],
    receipt:
      "The broader fictional defence contract creates a scoped execution grant; the narrower purchase retains human approval. Neither branch asserts secret intentions or actual deployments by any current state.",
  },
  "S4-27": {
    mechanism: "announced-breakthrough-versus-replicated-benefit",
    a: "replicate",
    b: "announcement",
    ai: "inspect",
    bi: "expand",
    ae: [f("independentReview"), m("gdp", -10)],
    be: [f("selfCertification"), f("essentialDependence"), m("gdp", 10)],
    receipt:
      "The cautious route uses a proven process with a retrofit path while replication remains pending; it does not mark the announced catalyst verified. Announcing a breakthrough alone does not deliver the promised practical service.",
  },
};
