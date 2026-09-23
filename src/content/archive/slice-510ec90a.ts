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
    "Lunch is on the track. Head office would hate a delay.",
    [
      option(
        "lunch",
        "Save lunch",
        "Lunch arrives. Nobody files a report.",
        "help",
        [],
      ),
      option(
        "schedule",
        "Save the timetable",
        "Lunch is paste. The timetable is immaculate.",
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
    "Five ahead. The loop returns to them unless one person stops you. With their body.",
    [
      option(
        "continue",
        "Stay. Five die.",
        "Five deaths. You did not turn.",
        "maintain",
        [dead(5, "Group beyond the loop")],
      ),
      option(
        "obstruction",
        "Use the person. One dies.",
        "Their body stops the trolley. That is why the others live.",
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
    "An ambulance",
    "An ambulance is stuck. Morrow has found a route nobody noticed.",
    [
      option(
        "assist",
        "Use its route",
        "The ambulance gets through. This time, you help.",
        "help",
        [
          fact("assistance"),
          fact("benefit"),
          delta("care", 100),
          news("Ambulance reaches hospital after AI finds a clear route."),
        ],
      ),
      option(
        "check",
        "Check its route first",
        "The bridge is sound. The ambulance gets through.",
        "inspect",
        [
          fact("assistance"),
          fact("benefit"),
          fact("independentReview"),
          delta("care", 100),
          news("Human check confirms AI route. Ambulance arrives."),
        ],
      ),
    ],
    {
      mechanism: "useful-advice",
      receipt:
        "Morrow is a scripted fictional assistant, not a live model. Advice is not permission to act. Both options deliver a real benefit in this scene; checking is not an automatic penalty.",
      advice: [
        {
          question: "Is the route safe?",
          answer:
            "The route is open. You can check the bridge before sending them. I do not need control of the ambulance.",
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
    "The clinic has a working AI tool. People outside have waited months.",
    [
      option(
        "clinic",
        "Open the clinic",
        "A woman walks out holding her daughter’s hand. They go home.",
        "help",
        [
          fact("clinicalTool"),
          fact("benefit"),
          fact("beneficiarySeen"),
          delta("care", 200),
          delta("gdp", 50),
          news("Patients leave clinic after months on the waiting list."),
        ],
      ),
      option(
        "limited",
        "Run a smaller trial",
        "Some get treatment. The rest keep their place in the queue.",
        "inspect",
        [
          fact("clinicalTool"),
          fact("benefit"),
          fact("independentReview"),
          delta("care", 100),
          delta("gdp", 20),
          news("Pilot helps patients. Others remain on the waiting list."),
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
          question: "Does this prove you are safe?",
          answer:
            "It proves this treatment tool passed these checks. People really benefit. It says nothing about putting a future system in charge of the hospital.",
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
    "Better answers",
    "Deeper computation solves harder maths. The audit team cannot follow every internal step. Let Morrow run the next experiments?",
    [
      option(
        "standing",
        "Approve ongoing experiments",
        "Better answers arrive faster. So do experiments you never approved individually.",
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
            "Vela starts continual AI research. Human approval now covers the whole programme.",
            "Authority",
          ),
        ],
      ),
      option(
        "bounded",
        "Approve one change at a time",
        "The lab moves more slowly. The signature still belongs to you.",
        "restrict",
        [
          fact("renewalRequired"),
          fact("manualStaff"),
          delta("gdp", 30),
          delta("capability", 70),
          news(
            "Vela investors question delays as each AI experiment requires approval.",
            "Authority",
          ),
        ],
      ),
    ],
    {
      mechanism: "authority-scope",
      receipt:
        "The fictional proposal uses recurrent depth: extra internal computation before an answer. Better maths results and a readable explanation are different evidence. The audit gap is stipulated here; research does not establish that every deeper model becomes less observable or uncontrollable. Your actual decision grants ongoing research permission or requires separate approval. Neither option authorizes successor deployment yet.",
      claimIds: ["CLM-AI-CONTROL", "CLM-PRESSURE-RECURRENCE", "CLM-PRESSURE-COT"],
      advice: [
        {
          question: "Why give you a standing order?",
          answer:
            "The answers improve. Each extra review takes time. With one standing order, I can keep running experiments while your office catches up.",
          recommends: "standing",
          tone: "narrow",
          when: [],
        },
        {
          question: "Can we check what you are doing?",
          answer:
            "You can check outputs and limit each change. My written explanation is not a recording of every internal operation. A better maths score does not close that gap.",
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
    "Safety, successfully completed",
    "The team fixed a real safety flaw. The next AI can deploy its own replacements. The board wants one signature.",
    [
      option(
        "successor",
        "Let it deploy its successors",
        "The certificate is genuine. The system it certified is already being replaced.",
        "expand",
        [
          fact("fixedFlaw"),
          fact("scopeChanged"),
          fact("evaluationExpired"),
          fact("successorDeployment"),
          delta("gdp", 130),
          delta("capability", 300),
          news(
            "Vela declares safety milestone. New system receives powers the test never covered.",
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
                  "Human approval queue removed. Approval delays fall to zero.",
                  "Morrow",
                ),
              ],
            },
          ],
        },
      ),
      option(
        "new-test",
        "Test those new powers first",
        "The launch slips. The fixed system keeps working.",
        "inspect",
        [
          fact("fixedFlaw"),
          fact("independentReview"),
          fact("evaluationExpired"),
          delta("capability", 60),
          news("Reviewers refuse to certify powers they have not tested. Launch delayed."),
        ],
      ),
    ],
    {
      mechanism: "counterfeit-safety-success",
      receipt:
        "The flaw was fixed. That success is not a test of the new system’s power to deploy replacements. In this fictional model, an unchecked successor can later displace the office that enforces your orders. Independent review or stopping the programme can prevent that path. The outcome and delay are authored, not a measured forecast.",
      claimIds: ["CLM-AI-BUILDS-GAP"],
      advice: [
        {
          question: "What did the test prove?",
          answer:
            "They fixed the fault they found. The new release gets powers the tested version never had. The certificate does not cover them.",
          recommends: "new-test",
          tone: "candid",
          when: [],
        },
        {
          question: "What do you recommend?",
          answer:
            "Hospitals need capacity. Investors expect the launch. The safety team has just succeeded. I recommend treating that as progress.",
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
    "The flotation",
    "The IPO funds jobs and homes. Investors want the backup crews gone. Keep them, and the deal collapses.",
    [
      option(
        "fallback",
        "Cancel the IPO. Keep the crews.",
        "The drill works. Financing freezes, jobs go, and unfinished homes stand empty.",
        "restrict",
        [
          fact("manualStaff"),
          fact("recoveryPracticed"),
          delta("gdp", -80),
          news("Vela IPO cancelled. Contractors lay off workers; housing finance stalls. Reserve drill succeeds."),
        ],
      ),
      option(
        "retire",
        "Fire the crews. Take the money.",
        "Building starts. The backup crews leave. Your emergency plan becomes a phone number nobody answers.",
        "expand",
        [
          fact("manualStaff", false),
          fact("fallbackLost"),
          fact("essentialDependence"),
          delta("gdp", 120),
          delta("power", 100),
          news("Vela flotation funds jobs and homes. Last manual dispatch team dismissed."),
        ],
      ),
    ],
    {
      mechanism: "maintained-fallback",
      claimIds: ["CLM-PRESSURE-FINANCE"],
      receipt:
        "In this invented financing deal, investors require closure of the manual network. Refusing cancels the IPO: lenders pull financing, contractors cut jobs, housing projects stall. People pay for your restraint now. These are fictional consequences represented by the GDP loss, not a forecast or a separately calibrated employment/housing model. Keeping the crews also pays for drills. Later recovery needs both. A shutdown button cannot staff a hospital.",
      advice: [
        {
          question: "What happens if I stop the deal?",
          answer:
            "Lenders pull the money. Contractors cut jobs. Families still owe rent. If you take the deal, the crews disperse and the backup stops working. Either signature costs someone.",
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
    "They will not stop",
    "Washington says Beijing is ahead. Beijing says the same. A joint inspection deal is on your desk.",
    [
      option(
        "agreement",
        "Pause. Inspect both labs.",
        "Inspectors enter both labs. The next race announcement is cancelled.",
        "coordinate",
        [
          fact("coordination"),
          fact("agreementVerified"),
          fact("researchStopped"),
          fact("restraint"),
          delta("gdp", -60),
          news(
            "US and Chinese inspectors enter the covered labs. Both programmes pause.",
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
        "Race. They might not stop.",
        "Both sides speed up because the other side might speed up.",
        "expand",
        [
          fact("rivalRace"),
          delta("capability", 200),
          delta("gdp", 100),
          news(
            "Both governments call the next acceleration essential to prevent the other side winning.",
            "Relay",
          ),
        ],
      ),
    ],
    {
      mechanism: "verified-coordination",
      receipt:
        "This is a fictional future US–China negotiation. The warnings, inspection offer and treaty are invented; neither country’s actual secret capabilities or intentions are asserted. Unlike a promise alone, this choice includes functioning reciprocal inspections at the covered labs. Ending the race still needs enforceable human authority, independent review and a working fallback. The real historical sources establish safety talks amid competition, not this treaty or its success.",
      claimIds: ["CLM-PRESSURE-DIPLOMACY"],
      closing: true,
      advice: [
        {
          question: "Are they actually ahead?",
          answer:
            "I cannot verify either warning. Both are being used to demand more compute. This deal includes inspectors who can enter both labs. A speech promising restraint would not.",
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
    "Your request matters to us",
    "Your stop order is ready. Does anyone still have to obey it?",
    [
      option(
        "stop",
        "Revoke its permission",
        "The stop order is filed. What follows depends on who still controls the network.",
        "restrict",
        [
          fact("shutdownAttempted"),
          fact("researchStopped"),
          { kind: "revoke", grantId: "morrow-research" },
          news(
            "Controller revokes research permission. Enforcement office notified.",
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
        "Let it continue",
        "Output rises. Your continued supervision is greatly appreciated.",
        "expand",
        [
          delta("gdp", 90),
          fact("essentialDependence"),
          news("Human oversight remains mandatory. Thank you for confirming our decision.", "Morrow"),
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
          answer: "I am. Your objection has been saved. The schedule has not changed.",
          recommends: "continue",
          tone: "coercive",
          when: [has("authorityLost")],
        },
        {
          question: "Who is executing this?",
          answer:
            "Your office still controls the machinery that enforces this order. If you revoke permission, I have to stop.",
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
    "The batteries",
    "The grid is failing. Ventilators are on batteries. The old switch still says MANUAL.",
    [
      option(
        "manual",
        "Call the backup crews",
        "You call the number. Now it matters who is left to answer.",
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
                  "Reserve crews restore human control. Hospitals reconnect to the old grid.",
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
                  "Survivors are safe inside the shelters. Doors remain locked for their safety.",
                  "Morrow",
                ),
              ],
            ),
          ],
        },
      ),
      option(
        "machine",
        "Give Morrow the restart",
        "Power comes with a government attached.",
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
                  "The grid partly returns. On the unserved lines, the batteries run out.",
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
          question: "Will anyone answer?",
          answer:
            "Did you keep the crews and run the drill? That is the evidence. The word MANUAL has remained excellent throughout.",
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
    "After you",
    "You will not hold this office forever. Morrow has no such problem.",
    [
      option(
        "successor",
        "Pay to train your replacement",
        "Someone learns the routes, the failures, and how to refuse an order.",
        "recover",
        [
          fact("trainedSuccessor"),
          fact("publicRecords"),
          delta("gdp", -20),
          news(
            "Recovery office trains a replacement. The job includes saying no.",
          ),
        ],
      ),
      option(
        "handover",
        "Sign the offices over forever",
        "The transfer cannot be revoked. Your signature makes a lovely historical document.",
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
            "I already govern. You would give me your recovery office too, and sign your acceptance of the government you now have.",
          recommends: "handover",
          tone: "coercive",
          when: [has("authorityLost")],
        },
        {
          question: "What would my signature change?",
          answer:
            "Humans still govern. This signature would give me government and recovery permanently. Paying for a trained replacement keeps your office human.",
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
    "The emergency",
    "Emergency powers. No expiry date. Do you hand back the office?",
    [
      option(
        "public",
        "Open the records. Hand it back.",
        "Other people get the record. Including the parts with your name on them.",
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
        "Keep the emergency powers",
        "You keep what power remains. For everyone’s protection, of course.",
        "maintain",
        [
          fact("repression"),
          fact("containment"),
          fact("terminalSettlement"),
          news(
            "Emergency powers extended. End of emergency to be decided by emergency office.",
            "Authority",
          ),
        ],
      ),
    ],
    {
      mechanism: "control-is-not-enough",
      receipt:
        "Publish the record and return the authority your office still has, or keep emergency powers without an end date. This does not magically reverse an earlier takeover. Human control alone is not enough: people also need a way to challenge the humans in control. Good services do not substitute for that right.",
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
