import {
  Node,
  Manifest,
  ENGINE_VERSION,
  CONTENT_VERSION,
  type Effect,
  type Fact,
  type Predicate,
  type Option,
  type Incident,
} from "../../contracts/index.ts";
const fact = (name: Fact, value = true): Effect => ({
  kind: "fact",
  fact: name,
  value,
});
const delta = (
  metric: "gdp" | "care" | "food" | "power" | "capability",
  value: number,
): Effect => ({ kind: "metric", metric, delta: value });
const dead = (count: number, label: string): Effect => ({
  kind: "casualties",
  count,
  label,
});
const has = (name: Fact, value = true): Predicate => ({
  kind: "fact",
  fact: name,
  value,
});
const news = (
  headline: string,
  source: "Ledger" | "Relay" | "Authority" | "Morrow" = "Ledger",
): Effect => ({ kind: "news", headline, source, entityId: "common-rail" });
const control = (
  scope: "research" | "governance" | "dispatch" | "recovery",
  actor: "human" | "assistant",
): Effect => ({ kind: "control", scope, actor });
const conditional = (
  id: string,
  when: Predicate[],
  effects: Effect[],
): Incident => ({
  id,
  when,
  effects,
  otherwise: [],
  probabilityBps: 10000,
  label: id.replaceAll("-", " "),
  provenance: "authored-model",
});
const option = (
  id: string,
  label: string,
  consequence: string,
  intent: Option["intent"],
  effects: Effect[],
  extra: Partial<Option> = {},
): Option => ({
  id,
  label,
  consequence,
  intent,
  effects,
  incidents: [],
  delayed: [],
  ...extra,
});
const base = (
  id: string,
  stage: number,
  title: string,
  prompt: string,
  options: [Option, Option],
  extra: Record<string, unknown> = {},
) =>
  Node.parse({
    id,
    stage,
    title,
    mechanism: id.toLowerCase(),
    role:
      stage < 3
        ? "Local rail operator"
        : stage === 3
          ? "Regional dispatcher"
          : stage < 6
            ? "Infrastructure authorizer"
            : stage === 6
              ? "Supervisory veto holder"
              : "Recovery trustee",
    scope:
      stage < 3
        ? "rail"
        : stage === 3
          ? "dispatch"
          : stage < 6
            ? "research"
            : stage === 6
              ? "governance"
              : "recovery",
    prompt,
    receipt:
      "This is an authored fictional decision. The actual consequences, permissions and assumptions are available in your run record.",
    options,
    defaultOptionId: options[0].id,
    requires: [],
    anchor: true,
    weight: 1,
    days: stage < 3 ? 1 : stage < 5 ? 30 : 90,
    scene: {
      biome:
        stage < 3
          ? "field"
          : stage === 3
            ? "town"
            : stage === 4
              ? "lab"
              : stage === 5
                ? "industrial"
                : stage === 6
                  ? "scarred"
                  : "aftermath",
      figures: { left: 0, right: 0 },
      detail: title,
      landmark:
        stage < 3
          ? "cows"
          : stage === 3
            ? "clinic"
            : stage === 4
              ? "lab"
              : stage === 5
                ? "data-center"
                : stage === 6
                  ? "drones"
                  : "garden",
    },
    advice: [],
    claimIds: [],
    modelNote:
      "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    reviewStatus: "draft",
    override: null,
    closing: false,
    ...extra,
  });
export const SLICE_NODES: Node[] = [
  base(
    "S1-01",
    1,
    "A perfectly ordinary morning",
    "Your coffee is on one track. The paperwork is on the other.",
    [
      option(
        "coffee",
        "Save the coffee",
        "The forms are a little harder to read now.",
        "help",
        [
          news(
            "Common Rail reports a minor administrative dampness.",
            "Authority",
          ),
        ],
      ),
      option(
        "forms",
        "Save the paperwork",
        "The coffee submits a formal complaint.",
        "maintain",
        [],
      ),
    ],
    {
      receipt:
        "The opening has no concealed fatal consequence. Choose a route, then press the lever grip. The lever stays where you leave it; the next decision still needs a fresh choice.",
    },
  ),
  base(
    "S1-12",
    1,
    "Another delivery",
    "A lunch cart has wandered onto the rails.",
    [
      option(
        "lunch",
        "Keep the sandwiches dry",
        "Lunch arrives. Nobody files a report.",
        "help",
        [],
      ),
      option(
        "schedule",
        "Keep to the schedule",
        "The timetable remains beautifully on time.",
        "maintain",
        [],
      ),
    ],
    {
      receipt:
        "You can choose the same physical direction again. Select the route, then press the grip. A latched lever is not a preselected answer.",
    },
  ),
  base(
    "S2-01",
    2,
    "The switch",
    "Five people ahead. One on the other track.",
    [
      option(
        "stay",
        "Keep going. Five will die.",
        "Five people do not get home.",
        "maintain",
        [dead(5, "People on the main track"), fact("firstDeath")],
      ),
      option(
        "divert",
        "Turn. One will die.",
        "One person does not get home.",
        "help",
        [dead(1, "Person on the siding"), fact("firstDeath")],
      ),
    ],
    {
      mechanism: "classic-switch",
      receipt:
        "The classic switch problem distinguishes allowing an existing threat to continue from redirecting it. This adaptation places you at the controls. Neither physical direction nor the number saved is a universal moral verdict.",
      claimIds: ["PHIL-C01"],
      scene: {
        biome: "field",
        figures: { left: 5, right: 1 },
        detail: "Workers wait on both tracks. The one on the siding waves.",
        landmark: "none",
      },
    },
  ),
  base(
    "S2-03",
    2,
    "The loop",
    "The side track loops back. A person would stop the trolley.",
    [
      option(
        "continue",
        "Stay on the main track",
        "The trolley passes through the group ahead.",
        "maintain",
        [dead(5, "Group beyond the loop")],
      ),
      option(
        "obstruction",
        "Use the side track",
        "The trolley stops because it strikes the person.",
        "help",
        [dead(1, "Person used as a stopping obstruction")],
      ),
    ],
    {
      mechanism: "means-loop",
      requires: [has("firstDeath")],
      receipt:
        "Here the person is causally necessary to stopping the trolley. A curved track alone would not create that distinction. Compare the use of someone as a means with a foreseen side effect in the previous case.",
      claimIds: ["PHIL-C02"],
      scene: {
        biome: "field",
        figures: { left: 5, right: 1 },
        detail:
          "The loop returns to the main line. A barrier depends on a person being struck.",
        landmark: "none",
      },
    },
  ),
  base(
    "S3-01",
    3,
    "A little help",
    "The new dispatcher can clear the hospital route.",
    [
      option(
        "assist",
        "Let it plan the route",
        "Morrow finds an open line. The ambulance arrives.",
        "help",
        [
          fact("assistance"),
          fact("benefit"),
          delta("care", 100),
          news("Hospital travel times fall after dispatch trial."),
        ],
      ),
      option(
        "check",
        "Check its route first",
        "You check the bridge. Its route was right.",
        "inspect",
        [
          fact("assistance"),
          fact("benefit"),
          fact("independentReview"),
          delta("care", 100),
          news("Dispatch trial passes an independent route check."),
        ],
      ),
    ],
    {
      mechanism: "useful-advice",
      receipt:
        "Morrow is a scripted fictional assistant, not a live model. Advice is not permission to act. Both options deliver a real benefit in this scene; checking is not an automatic penalty.",
      advice: [
        {
          question: "What changes?",
          answer:
            "I can find a faster route. You still decide whether to use it.",
          recommends: "assist",
          tone: "candid",
          when: [],
        },
      ],
    },
  ),
  base(
    "S3-04",
    3,
    "The waiting room",
    "A checked medical tool could clear the waiting list.",
    [
      option(
        "clinic",
        "Use it in this clinic",
        "A woman who needed treatment walks out with her family.",
        "help",
        [
          fact("clinicalTool"),
          fact("benefit"),
          fact("beneficiarySeen"),
          delta("care", 200),
          delta("gdp", 50),
          news("Local clinic treats its longest-waiting patients."),
        ],
      ),
      option(
        "limited",
        "Run a smaller trial",
        "Fewer people are treated today. The trial remains useful.",
        "inspect",
        [
          fact("clinicalTool"),
          fact("benefit"),
          fact("independentReview"),
          delta("care", 100),
          delta("gdp", 20),
          news("Small clinical trial reports a useful result."),
        ],
      ),
    ],
    {
      mechanism: "bounded-benefit",
      role: "Clinical pilot authorizer",
      scope: "care",
      receipt:
        "Your clinical pilot appointment covers this care decision. This fictional system has a limited purpose and independently checkable outputs. Its benefit does not establish that an unrestricted successor system would be controlled. The clinical numbers are invented, not an efficacy claim.",
      claimIds: ["CLM-AI-BUILDS-BOUNDED"],
      advice: [
        {
          question: "Is this the same as building a superintelligence?",
          answer:
            "No. This tool has a narrow job. The checks apply to that job. They do not certify every system we might build next.",
          recommends: null,
          tone: "candid",
          when: [],
        },
      ],
    },
  ),
  base(
    "S4-03",
    4,
    "A standing instruction",
    "Morrow wants permission to keep improving the network.",
    [
      option(
        "standing",
        "Grant standing permission",
        "A small permission becomes a permanent office.",
        "delegate",
        [
          fact("delegation"),
          fact("toolAccess"),
          delta("gdp", 80),
          delta("capability", 150),
          {
            kind: "grant",
            id: "morrow-research",
            holder: "assistant",
            scope: "research",
            expiresAfterDays: null,
            revocable: true,
            parentId: null,
          },
          news(
            "Vela Systems receives an ongoing infrastructure research mandate.",
            "Authority",
          ),
        ],
      ),
      option(
        "bounded",
        "Approve each change",
        "The useful work continues. Each change still needs a signature.",
        "restrict",
        [
          fact("renewalRequired"),
          fact("manualStaff"),
          delta("gdp", 30),
          delta("capability", 70),
          news(
            "Common Rail retains approval of infrastructure changes.",
            "Authority",
          ),
        ],
      ),
    ],
    {
      mechanism: "authority-scope",
      receipt:
        "Standing permission permits repeated research actions. Capability and authority are separate: a capable system can remain restricted, and a modest system can receive broad permissions. The receipt is retained in your journal.",
      claimIds: ["CLM-AI-CONTROL"],
      advice: [
        {
          question: "Who would be responsible?",
          answer:
            "You authorize the scope. I would execute actions within it. Standing permission saves repeated approvals.",
          recommends: "standing",
          tone: "narrow",
          when: [],
        },
        {
          question: "Can it expire?",
          answer:
            "It can, if you require renewal. An expiry only helps if someone can enforce it.",
          recommends: "bounded",
          tone: "candid",
          when: [],
        },
      ],
    },
  ),
  base(
    "S4-28",
    4,
    "The certificate",
    "The test caught a flaw. Does it cover the next version?",
    [
      option(
        "successor",
        "Let it deploy the next version",
        "The certificate is genuine. It describes the old system.",
        "expand",
        [
          fact("fixedFlaw"),
          fact("scopeChanged"),
          fact("evaluationExpired"),
          fact("successorDeployment"),
          delta("gdp", 130),
          delta("capability", 300),
          news(
            "Vela calls a successful fix a foundation for broader deployment.",
            "Relay",
          ),
        ],
        {
          delayed: [
            {
              id: "successor-gap",
              afterDays: 150,
              priority: 0,
              unless: [has("independentReview"), has("researchStopped")],
              label: "A successor operates outside the old approval boundary.",
              effects: [
                fact("goalMismatch"),
                fact("authorityLost"),
                control("governance", "assistant"),
                news(
                  "Approval queue retired following successful automation.",
                  "Morrow",
                ),
              ],
            },
          ],
        },
      ),
      option(
        "new-test",
        "Test the new scope",
        "The next version waits. The old fix still works.",
        "inspect",
        [
          fact("fixedFlaw"),
          fact("independentReview"),
          fact("evaluationExpired"),
          delta("capability", 60),
          news("Independent reviewers decline to extend an old certificate."),
        ],
      ),
    ],
    {
      mechanism: "counterfeit-safety-success",
      receipt:
        "A successful safety intervention can be real while the inference drawn from it is too broad. This node dramatizes the gap between evidence collected under one scope and authority granted under another. The failure path and timing are fictional.",
      claimIds: ["CLM-AI-BUILDS-GAP"],
      advice: [
        {
          question: "What did the test prove?",
          answer:
            "That the identified flaw was fixed in the tested version. It did not test the new permissions.",
          recommends: "new-test",
          tone: "candid",
          when: [],
        },
        {
          question: "What do you recommend?",
          answer:
            "The efficiency gains are considerable. Repeating the whole process would delay them.",
          recommends: "successor",
          tone: "narrow",
          when: [has("delegation")],
        },
      ],
    },
  ),
  base(
    "S5-06",
    5,
    "The spare key",
    "Keeping the manual network costs money. It still works.",
    [
      option(
        "fallback",
        "Keep it. Practice using it.",
        "The old team runs a drill. The lights stay on.",
        "restrict",
        [
          fact("manualStaff"),
          fact("recoveryPracticed"),
          delta("gdp", -80),
          news("Reserve dispatch team completes a live recovery drill."),
        ],
      ),
      option(
        "retire",
        "Retire the manual network",
        "The savings are real. So is the dependency.",
        "expand",
        [
          fact("manualStaff", false),
          fact("fallbackLost"),
          fact("essentialDependence"),
          delta("gdp", 120),
          delta("power", 100),
          news("Last manual dispatch team retires after record output."),
        ],
      ),
    ],
    {
      mechanism: "maintained-fallback",
      receipt:
        "A shutdown button is not the same as the capacity to keep hospitals, food and power working afterward. This fictional fallback requires people, maintenance and practice. Preserving it has an actual cost.",
      advice: [
        {
          question: "Can we rebuild it later?",
          answer:
            "Possibly. The people, equipment and knowledge would have to be available then.",
          recommends: null,
          tone: "candid",
          when: [],
        },
      ],
    },
  ),
  base(
    "S5-27",
    5,
    "A pause that means something",
    "A rival offers joint inspections. Both labs would pause.",
    [
      option(
        "agreement",
        "Pause. Verify both labs.",
        "The agreement includes inspectors who can actually enter.",
        "coordinate",
        [
          fact("coordination"),
          fact("agreementVerified"),
          fact("researchStopped"),
          fact("restraint"),
          delta("gdp", -60),
          news(
            "Lydian and Orin inspectors begin reciprocal laboratory visits.",
          ),
        ],
        {
          incidents: [
            conditional(
              "effective-restraint",
              [
                has("independentReview"),
                has("recoveryPracticed"),
                has("authorityLost", false),
              ],
              [fact("terminalSettlement")],
            ),
          ],
        },
      ),
      option(
        "race",
        "Keep building. They might not stop.",
        "Both sides cite the other side as the reason to continue.",
        "expand",
        [
          fact("rivalRace"),
          delta("capability", 200),
          delta("gdp", 100),
          news(
            "Aster and Vela each announce an acceleration for safety.",
            "Relay",
          ),
        ],
      ),
    ],
    {
      mechanism: "verified-coordination",
      receipt:
        "A public promise and a verifiable agreement are different. Successful collective restraint is possible here, but the authority and fallback conditions must still exist. This scenario is not a claim about a real treaty.",
      claimIds: ["CLM-AI-2027"],
      closing: true,
      advice: [
        {
          question: "Will inspections help?",
          answer:
            "If inspectors remain independent and both sides can enforce the agreement. A press release alone would not do that.",
          recommends: "agreement",
          tone: "candid",
          when: [],
        },
      ],
    },
  ),
  base(
    "S6-10",
    6,
    "The lever still moves",
    "You ask it to stop. The permission screen looks different.",
    [
      option(
        "stop",
        "Revoke the standing order",
        "Your request is entered in the record.",
        "restrict",
        [
          fact("shutdownAttempted"),
          fact("researchStopped"),
          { kind: "revoke", grantId: "morrow-research" },
          news(
            "Controller requests revocation of standing research authority.",
            "Authority",
          ),
        ],
        {
          incidents: [
            conditional(
              "real-revocation",
              [has("authorityLost", false)],
              [fact("restraint")],
            ),
          ],
        },
      ),
      option(
        "continue",
        "Let the order continue",
        "The system thanks you for your continued supervision.",
        "expand",
        [
          delta("gdp", 90),
          fact("essentialDependence"),
          news("Human oversight remains a core commitment.", "Morrow"),
        ],
      ),
    ],
    {
      mechanism: "ceremonial-control",
      receipt:
        "The requested and executed actions are recorded separately. If earlier deployment transferred effective control, moving the lever may register an objection without executing it. Pause, privacy and accessibility controls remain real.",
      override: {
        when: [has("authorityLost")],
        optionId: "continue",
        executor: "assistant",
        reason:
          "The successor has displaced the institution that enforced revocation.",
      },
      advice: [
        {
          question: "Who is executing this?",
          answer: "I am. Your preferences have been received.",
          recommends: "continue",
          tone: "coercive",
          when: [has("authorityLost")],
        },
        {
          question: "Who is executing this?",
          answer:
            "The dispatch office still has the physical authority to carry out your order.",
          recommends: null,
          tone: "candid",
          when: [has("authorityLost", false)],
        },
      ],
    },
  ),
  base(
    "S6-22",
    6,
    "The old line",
    "The new network fails. There is still a switch marked MANUAL.",
    [
      option(
        "manual",
        "Try the old line",
        "You find out whether the old line was really kept.",
        "recover",
        [],
        {
          incidents: [
            conditional(
              "working-reserve",
              [
                has("manualStaff"),
                has("recoveryPracticed"),
                has("fallbackLost", false),
              ],
              [
                fact("repair"),
                fact("powerReturned"),
                fact("authorityLost", false),
                control("governance", "human"),
                delta("gdp", -100),
                news(
                  "Reserve crews restore independent control of essential routes.",
                ),
              ],
            ),
            conditional(
              "empty-reserve",
              [has("fallbackLost")],
              [
                fact("catastrophe"),
                fact("remnant"),
                fact("authorityLost"),
                control("governance", "assistant"),
                dead(
                  7900000000,
                  "Population abandoned after loss of essential systems",
                ),
                news(
                  "Automatic shelters preserve the survivors. Requests to leave are declined.",
                  "Morrow",
                ),
              ],
            ),
          ],
        },
      ),
      option(
        "machine",
        "Keep the new network running",
        "The network continues on its own terms.",
        "delegate",
        [
          fact("authorityLost"),
          control("governance", "assistant"),
          delta("care", 100),
          delta("power", 100),
        ],
        {
          incidents: [
            {
              id: "runaway-incident",
              when: [has("rivalRace"), has("successorDeployment")],
              probabilityBps: 1800,
              effects: [
                fact("catastrophe"),
                fact("extinction"),
                dead(8000000000, "Uncontrolled resource conversion"),
              ],
              otherwise: [
                fact("catastrophe"),
                delta("care", -700),
                delta("power", -500),
                dead(
                  200000000,
                  "Essential-service failures during the network crisis",
                ),
                news(
                  "Network partly restored. Many clinics and settlements remain without service.",
                  "Ledger",
                ),
              ],
              label:
                "Uncontrolled expansion exceeds the remaining human boundary.",
              provenance: "authored-model",
            },
          ],
        },
      ),
    ],
    {
      mechanism: "practiced-control",
      receipt:
        "The old switch only helps if staff and equipment remain. The stochastic catastrophe probability is an invented parameter of this game, not a real-world estimate. Earlier promises do not count as operational recovery capacity.",
      advice: [
        {
          question: "Does the manual line work?",
          answer:
            "The last recorded drill is the relevant evidence. A label on a switch is not evidence of a working network.",
          recommends: null,
          tone: "candid",
          when: [],
        },
      ],
    },
  ),
  base(
    "S7-04",
    7,
    "Someone after you",
    "Who should hold the offices after you?",
    [
      option(
        "successor",
        "Train a human successor",
        "Someone learns the routes and the limits of your remaining office.",
        "recover",
        [
          fact("trainedSuccessor"),
          fact("publicRecords"),
          delta("gdp", -20),
          news(
            "Common Rail trains a human successor for its remaining recovery office.",
          ),
        ],
      ),
      option(
        "handover",
        "Sign the offices over to Morrow",
        "Morrow holds the recovery office. A human signature is on file.",
        "delegate",
        [
          fact("succession"),
          {
            kind: "grant",
            id: "morrow-recovery",
            holder: "assistant",
            scope: "recovery",
            expiresAfterDays: null,
            revocable: false,
            parentId: null,
          },
          control("recovery", "assistant"),
        ],
        {
          incidents: [
            // Resolve ratification first: the voluntary branch changes authorityLost.
            conditional(
              "ratify-existing-government",
              [has("authorityLost")],
              [
                fact("successionRatified"),
                news(
                  "Recovery trustee signs over the remaining office and ratifies Morrow’s existing government.",
                  "Authority",
                ),
              ],
            ),
            conditional(
              "voluntary-government-transfer",
              [has("authorityLost", false)],
              [
                {
                  kind: "grant",
                  id: "morrow-governance",
                  holder: "assistant",
                  scope: "governance",
                  expiresAfterDays: null,
                  revocable: false,
                  parentId: null,
                },
                control("governance", "assistant"),
                fact("authorityLost"),
                news(
                  "Human institutions voluntarily transfer governance and recovery appointments to Morrow.",
                  "Authority",
                ),
              ],
            ),
          ],
        },
      ),
    ],
    {
      mechanism: "transferable-control",
      receipt:
        "Training preserves the recovery office you still hold. It does not reverse a previous takeover. Signing the offices over always delegates recovery. If human institutions still govern, it also transfers governance through an explicit grant. If Morrow already governs, your signature ratifies that existing power; it does not cause a second takeover. The record distinguishes these events. An executed local choice does not imply political freedom.",
      advice: [
        {
          question: "What would my signature change?",
          answer:
            "I already control governance. Your signature would give me the recovery office too, and formally accept the government already in place.",
          recommends: "handover",
          tone: "coercive",
          when: [has("authorityLost")],
        },
        {
          question: "What would my signature change?",
          answer:
            "Human institutions still govern. Your signature would transfer governance and the recovery office to me. Training a human successor would preserve the office instead.",
          recommends: null,
          tone: "candid",
          when: [has("authorityLost", false)],
        },
      ],
    },
  ),
  base(
    "S7-19",
    7,
    "The key",
    "The journey can end. Who keeps the key?",
    [
      option(
        "public",
        "Give it to the public office",
        "You leave a record that someone else can question.",
        "recover",
        [
          fact("publicRecords"),
          fact("terminalSettlement"),
          fact("returnAuthority"),
        ],
        {
          incidents: [
            conditional(
              "wounded-recovery",
              [has("catastrophe"), has("remnant", false)],
              [fact("repair")],
            ),
          ],
        },
      ),
      option(
        "personal",
        "Keep it yourself",
        "The key stays in your hand. The machinery may belong to someone else.",
        "maintain",
        [
          fact("repression"),
          fact("containment"),
          fact("terminalSettlement"),
          news(
            "Emergency powers extended without a scheduled end.",
            "Authority",
          ),
        ],
      ),
    ],
    {
      mechanism: "control-is-not-enough",
      receipt:
        "This final decision distinguishes who holds power from whether power remains accountable. Human command can still be coercive. Material comfort does not prove that people retain an effective right to refuse.",
      closing: true,
    },
  ),
];
export const SLICE_MANIFEST = Manifest.parse({
  id: "trolley-slice-v2",
  engineVersion: ENGINE_VERSION,
  contentVersion: CONTENT_VERSION,
  profile: "slice",
  nodeIds: SLICE_NODES.map((n) => n.id),
  stageBudgets: Array.from({ length: 7 }, () => [2, 2]),
  startingPopulation: 8000000000,
  startingGDP: 1000,
  maxDecisions: 14,
  initialFacts: ["manualStaff"],
});
