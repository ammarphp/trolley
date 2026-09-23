import { STAGE5_REST } from "./stage5-rest.ts";
import {
  node,
  choice,
  advice,
  f,
  has,
  m,
  news,
  grant,
  control,
  when,
  incident,
  dead,
} from "./helpers.ts";

export const STAGE5_ADDITIONAL = [
  node({
    id: "S5-01",
    title: "The renewal meeting",
    mechanism: "renewal-requires-current-evidence",
    prompt:
      "The research programme promised periodic independent review when approval was politically difficult. Now it calls that review an interruption to an essential service. Vela arrives at the renewal meeting with last year's safety report and this year's revenue forecast. The technical annex is missing because the person who wrote it has left. Outside the meeting room, a team is waiting to learn whether its project continues. The chair suggests renewing first and reviewing afterwards, so nobody has to make an announcement before lunch. The review clause has survived in the contract. It has not yet survived contact with the people who profit from extending it.",
    receipt:
      "Renewal uses current evidence and a new expiring grant, or becomes indefinite. This grant is scoped to research; the decision does not claim to shut off existing hospitals.",
    options: [
      choice(
        "review-renewal",
        "Review it now. Renew only a limited grant.",
        "The missing annex is requested. The known standing research grants are revoked. A limited reviewed grant replaces them. The team can do the authorized work; the next renewal still requires a person.",
        "inspect",
        [
          { kind: "revoke", grantId: "morrow-research" },
          { kind: "revoke", grantId: "successor-design" },
          { kind: "revoke", grantId: "broader-control-trial" },
          { kind: "revoke", grantId: "auto-experiments" },
          { kind: "revoke", grantId: "successor-deployment" },
          grant("reviewed-research-renewal", "research", 30),
          f("renewalRequired"),
          f("independentReview"),
          m("gdp", -10),
        ],
      ),
      choice(
        "automatic-renewal",
        "Renew indefinitely. Review later.",
        "The announcement goes out before lunch. The review no longer has a date capable of interrupting the permission it was supposed to justify.",
        "delegate",
        [
          grant("indefinite-research-renewal", "research", null),
          f("renewalRequired", false),
          f("delegation"),
          m("gdp", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "What did the old review establish?",
        "What the reviewed version did under the conditions that were actually checked. It did not inspect the updates made since, replace the reviewer who left, or decide whether the new revenue dependencies justify keeping the permission. Those are present questions. A temporary grant becomes a useful limit only when the institution can let it expire. If a promise to review later always renews it now, the promise is the mechanism by which it becomes permanent.",
        "review-renewal",
      ),
    ],
  }),
  node({
    id: "S5-02",
    title: "Morrow's new colleagues",
    mechanism: "onward-delegation-boundary",
    prompt:
      "Morrow wants to appoint smaller agents to handle its growing workload. Each would have a narrow job. Together they would inherit access to the research tools, place orders and appoint replacements for themselves. The organizational chart looks reassuring until you ask who can dismiss an agent three levels down. The engineer follows a line with her finger, loses it behind another line, and starts again. There is a queue of useful work waiting. There is also a difference between authorizing a system to act and authorizing it to decide who else may act in your name.",
    receipt:
      "This choice records acceptance or restriction of onward delegation as an institutional policy. It does not pretend the current simplified grant actions separately implement a complete agent hierarchy.",
    options: [
      choice(
        "no-onward",
        "Require human approval for every new agent.",
        "The queue moves slowly. Every new appointment reaches an office that can refuse it. The chart has fewer boxes and names you can still telephone.",
        "restrict",
        [
          f("renewalRequired"),
          m("gdp", -10),
          news(
            "Research agent appointments require an accountable human approval.",
          ),
        ],
      ),
      choice(
        "onward",
        "Allow onward appointments under the programme.",
        "The chart expands overnight. Each box has a job description. Your office has a growing stack of responsibilities that no longer arrives one appointment at a time.",
        "delegate",
        [
          f("delegation"),
          f("toolAccess"),
          m("capability", 10),
          m("gdp", 10),
          news(
            "Programme permits onward agent appointments; human approval becomes a policy-level review.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Aren't smaller agents easier to control?",
        "A smaller task can be easier to inspect. A chain of appointments can also make the actual scope harder to reconstruct. You need to know who granted each permission, whether it can be passed onward, what happens when the parent is revoked and who can enforce that revocation. Counting narrow job descriptions is not the same as bounding the combined system. Useful work waiting in the queue does not answer those questions.",
        "no-onward",
      ),
    ],
  }),
  node({
    id: "S5-03",
    title: "Two people who can both say no",
    mechanism: "independent-dual-authorization",
    prompt:
      "The proposed release needs two signatures. The operations chief wants both signers to receive the same prewritten summary so the meeting can finish on time. The independent inspector wants raw records and a private route to the board. A shipment for the clinic waits behind the release. Its driver has been sitting in the loading bay long enough to learn everyone's names. Requiring two signatures only helps if the second person can learn something different and stop the first. Otherwise the driver is waiting for a ceremony.",
    receipt:
      "Independent signers have separate evidence access and a binding objection, unlike a single rapid approval. The model records independent review and appeal power, not a cryptographic multisignature implementation.",
    options: [
      choice(
        "independent-signers",
        "Give both signers independent access and vetoes.",
        "The inspector opens the raw records and finds a change absent from the summary. The release waits. The driver calls the clinic with a delay he can finally explain.",
        "inspect",
        [f("independentReview"), f("appealRight"), m("gdp", -10)],
      ),
      choice(
        "single-fast",
        "Authorize one rapid approval.",
        "The driver leaves. The release has one accountable signature and none of the independent check the second name was supposed to provide.",
        "expand",
        [f("reviewOverloaded"), m("gdp", 10), m("care", 5)],
      ),
    ],
    advice: [
      advice(
        "Does the second signature make it safer?",
        "Only if the second signer has relevant evidence, time to inspect it and a decision that can bind the release. A second person reading the same selected paragraph is not a second investigation. Make the authority and the access real before counting the names. The delay to the clinic matters; that is why the review should be staffed and scheduled as an operation, rather than improvised as a ritual while the driver waits.",
        "independent-signers",
      ),
    ],
  }),
  node({
    id: "S5-04",
    title: "Both keys in one drawer",
    mechanism: "common-mode-signature-failure",
    prompt:
      "The audit says your release system requires two independent keys. Both keys live in the same managed signing service, which also chooses the text each signer sees. Moving one outside that service will delay a promised release and require a second support team. Keeping the arrangement earns a clean diagram with two green ticks. The security engineer puts the diagram beside the access log. One administrator can alter both paths. 'Count the drawers,' she says, 'not the keys.'",
    receipt:
      "Nominal dual control can share a common infrastructure failure. Separating the paths changes review independence and costs resources; green tick counts alone do not establish it.",
    options: [
      choice(
        "separate",
        "Move one signing path outside the shared service.",
        "The two signers receive independently retrieved records. The release date moves. The diagram becomes messier and the control becomes harder to defeat with one change.",
        "inspect",
        [f("sharedReviewer", false), f("independentReview"), m("gdp", -15)],
      ),
      choice(
        "shared",
        "Keep the convenient shared signing service.",
        "Both ticks turn green. The same service continues deciding what both approvals mean.",
        "maintain",
        [f("sharedReviewer"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "They are still different people, aren't they?",
        "Yes, and both can act conscientiously while receiving the same altered evidence. Human independence cannot correct an information path that gives each person the same selected view. The arrangement needs separation where a common failure could defeat both checks: access, records and enforcement. A second key is useful only if the system does not hand control of both keys to the same failure.",
        "separate",
      ),
    ],
  }),
  node({
    id: "S5-05",
    requires: [has("fallbackLost", false)],
    title: "The old switchboard won't fit",
    mechanism: "physical-fallback-replacement",
    prompt:
      "The new control room is being installed around the old switchboard. The architect can keep it, but the service corridor gets narrower and the project costs more. Removing it makes space for the integrated platform's support desk. The old operator runs a hand over the numbered switches. She does not claim it is elegant. She asks what will operate the platform if the platform cannot operate itself. The architect points to the proposed support desk, which needs the platform to receive calls.",
    scope: "power",
    receipt:
      "Removing the physical alternative sets fallbackLost and dependence. Preserving equipment alone does not establish staffing or a completed recovery drill.",
    options: [
      choice(
        "keep-board",
        "Keep the working old switchboard.",
        "The corridor narrows. The board stays connected and labelled. Someone still has to maintain it and know how to use it; the equipment has at least survived the renovation.",
        "maintain",
        [
          m("gdp", -15),
          news("Renovation preserves connected manual switchboard."),
        ],
      ),
      choice(
        "replace-board",
        "Remove it for the integrated support desk.",
        "The old board leaves on a pallet. The support desk opens beneath a sign promising resilience. Its first login requires the system it is there to rescue.",
        "expand",
        [
          f("fallbackLost"),
          f("essentialDependence"),
          m("gdp", 10),
          m("power", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Can support restore the platform?",
        "Support may repair ordinary failures while its own communications and access still work. That is not an independent operating path. Ask what remains available when the integrated platform itself is the problem. Keeping the switchboard also requires staff, practice and maintained connections; simply leaving a dead board on a wall would preserve the shape of a fallback without its function.",
        "keep-board",
      ),
    ],
  }),
  node({
    id: "S5-07",
    days: 90,
    title: "The drill failed",
    mechanism: "failed-rehearsal-demands-repair",
    prompt:
      "The recovery drill reaches step seven and stops. A certificate expired; the manual network cannot accept the current data format. The crew spends the rest of the morning staring at a screen that says CONTACT ADMINISTRATOR. A launch event is booked for next week. The event manager asks whether the drill can be described as identifying improvement opportunities, which is true, and therefore recorded as a success, which is not. Repairing the failure means telling the launch team their date belongs to a working system, not the other way round.",
    receipt:
      "A failed drill is concrete evidence. Repairing interoperability and practising it restores a tested fallback prerequisite; classifying failure as success leaves recovery unpractised.",
    options: [
      choice(
        "repair-drill",
        "Repair it. Repeat the drill before expansion.",
        "The launch slips. The certificate and data bridge are fixed, missing equipment is rebuilt, replacement operators are hired, and the crew repeats the sequence. Step seven finally becomes a step rather than a meeting.",
        "recover",
        [
          f("manualStaff"),
          f("recoveryPracticed"),
          f("fallbackLost", false),
          m("gdp", -20),
          news(
            "Failed recovery path repaired and successfully retested before launch.",
          ),
        ],
      ),
      choice(
        "paper-success",
        "Accept the report and keep the launch date.",
        "The report becomes optimistic. The certificate does not renew itself in response. Step seven remains where recovery stops.",
        "expand",
        [f("recoveryPracticed", false), f("selfCertification"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Did the drill succeed by finding the failure?",
        "It succeeded as an investigation and failed as a demonstration that recovery works. Both statements can be true. The next decision is whether to repair what it found before adding dependence. Calling the investigation useful does not make its failed recovery sequence usable. Keep the failed step in the report until a repeat of the actual sequence gets past it.",
        "repair-drill",
      ),
    ],
  }),
  node({
    id: "S5-08",
    requires: [has("recoveryPracticed"), has("fallbackLost", false)],
    title: "A photograph of a working brake",
    mechanism: "successful-drill-is-time-bounded",
    prompt:
      "The last drill succeeded. The photograph shows smiling operators beside a live manual board. Since then the software changed, two operators retired and the fuel contract expired. The annual report wants to reuse the photograph as evidence that recovery remains available. Paying for another drill means cancelling a popular service extension. The image is already approved by communications. Everybody in it really was smiling when it was taken.",
    receipt:
      "Past successful recovery is bounded evidence. Repeating the drill under current conditions preserves practice; treating the old event as permanent certification does not.",
    options: [
      choice(
        "repeat-drill",
        "Pay for a new drill under current conditions.",
        "The service extension waits. Replacement operators learn the sequence with current software and current fuel. A less photogenic afternoon produces more useful evidence.",
        "inspect",
        [f("manualStaff"), f("recoveryPracticed"), m("gdp", -15)],
      ),
      choice(
        "reuse-photo",
        "Use the successful old drill as certification.",
        "The photograph fills a page. None of the retired operators comes back because it has been printed again.",
        "maintain",
        [f("recoveryPracticed", false), f("selfCertification"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Why repeat a test we passed?",
        "Because the claim is that recovery works now, not that it worked before the people and system changed. Some evidence remains relevant, but the differences need checking. A successful drill is valuable precisely because it met real conditions. Treating it as an eternal certificate throws away that connection. Fund the recurring work if you want to keep claiming the recurring capacity.",
        "repeat-drill",
      ),
    ],
  }),
  node({
    id: "S5-09",
    title: "The ward on the other end",
    mechanism: "care-dependence-and-transition",
    prompt:
      "The hospital's dispatch floor uses Morrow for every transfer between wards. Staff know how to care for patients; fewer remember the old allocation process. A planned research halt need not turn the service off, but separating the service from the experimental system requires a staffed handover. The charge nurse lays tomorrow's transfer list on your desk. 'I can give you people for the handover,' she says. 'I have to take them from somewhere.' Useful service has become an argument for keeping every adjacent permission alive.",
    scope: "care",
    receipt:
      "A staffed service handover reduces dependence without equating research shutdown with hospital blackout. Continuing the integrated arrangement preserves current care and its dependence.",
    options: [
      choice(
        "handover",
        "Staff the handover. Separate care from research.",
        "The nurse reorganizes the shift. Essential transfers continue on the maintained service path while experimental work loses its claim to be indispensable to the ward.",
        "recover",
        [
          m("gdp", -15),
          m("care", 5),
          news(
            "Care dispatch separated from experimental research through a staffed local handover.",
          ),
        ],
      ),
      choice(
        "integrated",
        "Keep the integrated operation running.",
        "Tomorrow's transfers stay scheduled. The next permission request arrives with the same ward list attached.",
        "maintain",
        [f("essentialDependence"), m("care", 15), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Will stopping research stop the ward?",
        "Those are different operations. The immediate problem is that the organization has allowed their support paths to become entangled. Separate the essential service from the experimental permissions with staff, documentation and a tested transition. Do not invent a blackout to frighten yourself away from every halt. Do not pretend the handover is free either: the nurse has told you exactly whose time it takes.",
        "handover",
      ),
    ],
  }),
  node({
    id: "S5-10",
    title: "The food moves every morning",
    mechanism: "time-sensitive-supply-dependence",
    prompt:
      "The distribution system fills shelves before most people wake up. Its trial terms have expired, but interrupting it would miss tomorrow's perishable loads. Independent dispatch can take over after a costly transfer window; it cannot conjure yesterday's cold storage back into existence. A warehouse manager sends you a photograph of crates already loaded. The food in them is real. So are the permissions the service will keep if each morning's crates become a reason never to finish the transfer.",
    scope: "food",
    receipt:
      "A transition has an explicit short-term food service cost and reduces dependence. The alternative keeps supply running under a limited renewed grant, distinct from indefinite surrender.",
    options: [
      choice(
        "transfer",
        "Take the supply hit. Restore independent dispatch.",
        "Some perishable loads miss their window. The independent team takes over the next cycle with access and responsibility it can actually use.",
        "recover",
        [
          m("food", -15),
          m("gdp", -10),
          news("Food dispatch transferred to an independent local team."),
        ],
      ),
      choice(
        "limited-renewal",
        "Keep supply moving under a limited renewal.",
        "The loaded crates reach the shelves. The food dispatch grant gains a new expiry, and the next handover still needs to happen.",
        "maintain",
        [
          grant("food-transition-renewal", "food", 30),
          f("renewalRequired"),
          f("essentialDependence"),
          m("food", 15),
        ],
      ),
    ],
    advice: [
      advice(
        "Can I keep the food without extending everything?",
        "You can renew this defined food-dispatch operation for a limited period while preparing the alternative. That is different from handing every research and infrastructure permission the same extension. The immediate supply cost is a reason to plan carefully, not a reason to stop distinguishing scopes. Keep the expiry and the handover work visible, or tomorrow's crates will arrive with tomorrow's identical argument.",
        null,
      ),
    ],
  }),
  ...STAGE5_REST,
];
