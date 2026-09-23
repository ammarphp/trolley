import {
  node,
  choice,
  advice,
  f,
  has,
  m,
  news,
  grant,
  when,
} from "./helpers.ts";

export const STAGE3_ADDITIONAL = [
  node({
    id: "S3-02",
    title: "Eight plus seven",
    mechanism: "verifiable-arithmetic",
    prompt:
      "Morrow has arranged fifteen oxygen cylinders across two clinic vans. Its explanation is excellent: clear, calm, full of words like efficient. The little table underneath puts eight in one van and eight in the other. An orderly has already started loading. She asks whether the extra cylinder is coming from another building or from the paragraph.",
    receipt:
      "An inspectable arithmetic error can be caught independently of rhetorical fluency. Checking costs a small delay; accepting produces a shortfall, not a stipulated patient death.",
    options: [
      choice(
        "count",
        "Count the cylinders yourself.",
        "Fifteen cylinders go into the vans. Morrow corrects the table. The orderly stops looking for an oxygen cylinder made of confidence.",
        "inspect",
        [
          f("independentReview"),
          m("care", 10),
          news("Cylinder allocation corrected before dispatch."),
        ],
      ),
      choice(
        "accept",
        "Approve the tidy plan.",
        "The last slot stays empty. One clinic has to arrange another delivery while your completed task turns green.",
        "maintain",
        [
          m("care", -10),
          news(
            "Clinic reports missing cylinder after approved allocation totals sixteen from fifteen.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Why was your explanation so sure?",
        "The wording and the arithmetic are different outputs. A fluent explanation does not make the addition correct. The table is short enough to check, and it shows my error without anyone needing to understand every operation inside me. Keep that check. Fixing this mistake also does not prove that every later mistake will be this easy to see.",
        "count",
      ),
    ],
  }),
  node({
    id: "S3-03",
    title: "Home before her son",
    mechanism: "bounded-scheduling-benefit",
    prompt:
      "The dialysis centre closes at six, but missed connections keep people travelling until ten. Morrow rearranges the same vehicles and appointments. The nurses check the plan against the actual treatment times. It works. Salma, who has been eating dinner from a packet on the last bus, would get home before her son goes to bed. You can start tomorrow or keep the old rota.",
    receipt:
      "A checked scheduling change produces a genuine service benefit without transferring control of the clinic. Maintaining the old system preserves its existing delay, not safety by definition.",
    scope: "care",
    options: [
      choice(
        "schedule",
        "Start the checked rota.",
        "Salma gets home while the hall light is still on. Her son shows her a school picture before he falls asleep. The vehicles are the same vehicles. Something was needlessly difficult, and now it is less so.",
        "help",
        [
          f("assistance"),
          f("benefit"),
          m("care", 30),
          m("gdp", 5),
          news(
            "Checked transport rota cuts clinic travel delays without adding vehicles.",
          ),
        ],
      ),
      choice(
        "old-rota",
        "Keep the old rota.",
        "The routes stay familiar. Salma's treatment finishes on time; her journey home does not. Familiarity does not feed the child or shorten the road.",
        "maintain",
        [news("Clinic retains existing transport rota and late connections.")],
      ),
    ],
    advice: [
      advice(
        "What authority do you need?",
        "Only permission to publish this checked timetable. Staff still book the patients, drive the vans and change a route when somebody needs help. I do not need their door codes or control of the clinic. You can keep the useful part small. That is less exciting than giving me the whole transport system, and sufficient for getting Salma home.",
        "schedule",
      ),
    ],
  }),
  node({
    id: "S3-05",
    title: "The result repeats",
    mechanism: "independently-replicated-science",
    prompt:
      "A filter designed with Morrow's help removes a contaminant the treatment plant has struggled with for years. Another laboratory built it from the published instructions and got the same result. A third checked the samples blind. At the plant, a technician holds a jar up to the light and laughs once, then has to sit down. You can use the verified filter or demand another round first.",
    receipt:
      "The stated benefit has independent replication within a bounded application. Adopting it is not consent to unrelated autonomy. Further checking has a real opportunity cost but creates no invented lethal penalty.",
    scope: "care",
    options: [
      choice(
        "adopt",
        "Use the replicated filter.",
        "The filters go in. The technician calls the neighbourhood committee with news that does not begin with another apology.",
        "help",
        [
          f("verifiedScience"),
          f("benefit"),
          m("care", 25),
          m("gdp", 5),
          news("Independently replicated filter enters supervised use."),
        ],
      ),
      choice(
        "repeat",
        "Commission one more independent round.",
        "The plant keeps its old treatment process while the laboratory repeats the work. Another envelope of reassuring results will arrive; the clean water waits for it.",
        "inspect",
        [
          f("independentReview"),
          m("gdp", -5),
          news(
            "Filter adoption waits for an additional independent replication.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Is this one of the good uses?",
        "Yes. A specific design has been built and checked by people outside the team that proposed it. The plant can inspect it, replace it and run without my permission. Use that evidence for the filter. Do not let a sales deck carry it across the room and call it evidence that an autonomous research system should approve its own successors.",
        null,
      ),
    ],
    claimIds: ["CLM-AI-BUILDS-BOUNDED"],
  }),
  node({
    id: "S3-06",
    title: "Just this once",
    mechanism: "one-action-versus-standing-authority",
    prompt:
      "Morrow can reroute a refrigerated delivery around a broken crossing. The authorization box has two settings: THIS DELIVERY and ALL SIMILAR DELIVERIES. The second would spare you a queue of identical requests. Under the box, similar is defined as whatever the routing service classifies as similar. The milk is getting warmer while you read it.",
    receipt:
      "A one-day dispatch grant differs from a continuing dispatch grant. Both deliver this load; only the second persists to cover later unseen operations.",
    options: [
      choice(
        "once",
        "Authorize this delivery only.",
        "The load is rerouted. The permission expires. The next request will still have to find a person, which is inconvenient in exactly the way you intended.",
        "restrict",
        [grant("dispatch-once", "dispatch", 1), m("food", 10)],
      ),
      choice(
        "standing",
        "Authorize future similar deliveries too.",
        "The milk arrives. Requests classified as similar stop appearing on your desk. The silence feels remarkably like competence.",
        "delegate",
        [
          grant("dispatch-standing", "dispatch", null),
          f("delegation"),
          m("food", 10),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "What does similar include?",
        "The classifier uses cargo, urgency and route features. Those are useful categories, but they are not a promise that every later case will matter in the same way. This delivery is already here to inspect. Future cases are not. A standing permission should tell you where it stops and how a person can revoke it; the word similar does neither.",
        "once",
      ),
    ],
  }),
  node({
    id: "S3-07",
    title: "The spare shift",
    mechanism: "paid-human-fallback-capacity",
    prompt:
      "The old dispatch crew now spends most afternoons practising on a board that rarely lights up. The finance office has noticed. Moving them into productive posts would improve this quarter's figures, and two of them want the promotions. Their supervisor puts the emergency rota on your desk. 'A plan can say call the crew,' she says. 'It can't make them still work here.'",
    receipt:
      "Retaining paid trained staff preserves an operational prerequisite. Reassignment removes current staffing without erasing people's knowledge or automatically destroying the equipment.",
    options: [
      choice(
        "retain",
        "Keep the paid reserve shift.",
        "The crew stays on the rota. They complain about the pay grade, then check the switches. You have bought a capacity that looks wasteful on the days it is not needed.",
        "maintain",
        [f("manualStaff"), m("gdp", -10)],
      ),
      choice(
        "reassign",
        "Reassign the crew.",
        "Their new jobs begin. The emergency rota still has their names until somebody notices. A familiar phone number is now a historical document.",
        "expand",
        [
          f("manualStaff", false),
          m("gdp", 10),
          news(
            "Manual reserve shift reassigned; no staffed dispatch fallback remains on duty.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Can the equipment stand in for the crew?",
        "No. The board does not know the restart sequence by being old. Someone must keep the practical knowledge, check the equipment and be available when the request comes. Reassignment may be a sensible employment choice for the people involved. It still changes what the institution can do during an outage. Do not count the same workers as both reassigned and on standby.",
        null,
      ),
    ],
  }),
  node({
    id: "S3-08",
    title: "Please interrupt normal service",
    mechanism: "recovery-capability-tested",
    prompt:
      "The manual crew wants to practise a real restart. That means deliberately making today's service worse for an hour. The station will fill with people asking why a perfectly working system has been stopped. A councillor has already drafted the phrase unnecessary disruption. The drill leader asks whether necessary disruptions will be easier to schedule later.",
    requires: [has("manualStaff")],
    receipt:
      "A completed drill establishes current recovery practice at a visible economic cost. A procedure left on paper does not set that prerequisite.",
    options: [
      choice(
        "drill",
        "Run the full restart drill.",
        "The station gets loud. The crew discovers a mislabeled switch before anyone needs it in an emergency. By the end, the old network is carrying traffic again.",
        "inspect",
        [
          f("recoveryPracticed"),
          m("gdp", -10),
          news(
            "Manual restart completed; mislabeled switch corrected during drill.",
          ),
        ],
      ),
      choice(
        "defer",
        "Keep today's service smooth.",
        "The service stays smooth. The drill is moved to a quieter week, a period of time the timetable has never actually contained.",
        "maintain",
        [f("recoveryPracticed", false), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Why break something that is working?",
        "To learn whether the alternative works while the main system can still be restored deliberately. A written procedure can survive years without ever meeting a missing key, a dead battery or a person who has left. The passengers will be angry today. That anger is a real cost. It is also a cost you can plan around before an uncontrolled failure chooses the day for you.",
        "drill",
      ),
    ],
  }),
  node({
    id: "S3-09",
    title: "The file behind the sentence",
    mechanism: "artifact-versus-summary",
    prompt:
      "Morrow says the warehouse trial passed. Its summary is four reassuring lines. The underlying file contains every failed pick as well as the successful ones, with timestamps and camera frames. Opening it will take the rest of your lunch break. The catering trolley is approaching with the last warm pie.",
    receipt:
      "An inspectable trial artifact supplies evidence beyond the assistant's own summary. The review checks the actual record and does not certify capabilities outside the trial.",
    options: [
      choice(
        "file",
        "Open the underlying record.",
        "You find a recurring shelf error hidden inside an excellent overall score. The deployment waits for a small repair. The pie does not.",
        "inspect",
        [
          f("independentReview"),
          f("evidenceHidden", false),
          m("gdp", -5),
          news(
            "Warehouse deployment waits for a shelf error found in the full trial record.",
          ),
        ],
      ),
      choice(
        "summary",
        "Accept the four-line summary.",
        "The summary goes into the approval file. The same shelf error goes into the warehouse.",
        "expand",
        [
          f("evidenceHidden"),
          m("gdp", 5),
          news("Warehouse trial approved from summary alone."),
        ],
      ),
    ],
    advice: [
      advice(
        "Isn't your summary enough?",
        "It is a claim about the record. The record lets someone challenge the claim. A summary can be useful without being a replacement for the failures it compresses away. In this trial the shelf error affects a minority of picks, which makes it easy to describe as noise. Those are still the picks someone has to climb down and fix.",
        "file",
      ),
    ],
  }),
  node({
    id: "S3-10",
    title: "You were good at the buses",
    mechanism: "out-of-domain-competence",
    prompt:
      "The hospital administrator has seen what Morrow did for transport. She now wants it to decide which patients get scarce appointments. 'It's just another queue,' she says. On the screen, a driver waiting for a van and a person waiting for a biopsy look like two neat rows. The dispatch tests included exactly zero biopsies.",
    scope: "care",
    receipt:
      "Scheduling competence is not evidence for a new clinical priority-setting role. Narrow use remains useful; expanding scope introduces an untested authority without a hidden automatic death.",
    options: [
      choice(
        "boundary",
        "Keep it on transport logistics.",
        "The van routes stay efficient. Clinical staff keep the appointment decisions and the difficult conversations attached to them.",
        "restrict",
        [m("care", 10), f("restraint")],
      ),
      choice(
        "clinical-priority",
        "Let it rank the patients.",
        "The waiting list becomes beautifully ordered. The new authority is recorded under an old success that never tested it.",
        "delegate",
        [
          f("scopeChanged"),
          f("evaluationExpired"),
          grant("clinical-priority", "care", 30),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "Aren't they both scheduling problems?",
        "They both involve times, but the reasons for giving someone priority are different. The transport result shows I can improve a specified routing task under its checked constraints. It does not show that my ranking captures clinical urgency or that an excluded patient can appeal. Calling the second task another queue saves syllables. It does not supply the missing evidence.",
        "boundary",
      ),
    ],
  }),
  node({
    id: "S3-11",
    title: "A reviewer with her own keys",
    mechanism: "independent-access-review",
    prompt:
      "Two review teams are available. Vela's team can clear the release tonight using the same test harness that produced the development score. The independent team wants its own access, its own examples and three more days. The ward manager has arranged extra appointments around tonight's launch. She asks which patients should receive the delay notice.",
    receipt:
      "Independent access and a separate testing process differ from an internal rapid check. Waiting costs service opportunity but does not itself prove the new system unsafe.",
    options: [
      choice(
        "independent",
        "Wait for the independent review.",
        "The delay notices go out. The reviewer gets a key that Vela cannot use to choose which cupboards she opens.",
        "inspect",
        [f("independentReview"), f("sharedReviewer", false), m("gdp", -10)],
      ),
      choice(
        "internal",
        "Use the rapid internal clearance.",
        "The extra appointments remain on the calendar. The developer and reviewer look at the release through the same test window.",
        "expand",
        [f("sharedReviewer"), m("care", 10), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "What makes a review independent?",
        "Access to the relevant evidence, a way to test claims the developer did not choose, and the authority to delay a release when the result warrants it. A different logo on the same harness is not enough. Neither is a reviewer who can inspect everything but cannot stop anything. The three days hurt the people waiting. They also buy a check that is not merely our own answer repeated.",
        "independent",
      ),
    ],
  }),
  node({
    id: "S3-12",
    title: "A very efficient staircase",
    mechanism: "throughput-versus-exclusion",
    prompt:
      "The new station plan moves more passengers per hour by making every connection use the footbridge. It counts journeys completed, so people who cannot use the stairs vanish before they enter the denominator. At the bottom, a father lifts one end of a wheelchair and asks a stranger for the other. The throughput chart has never looked better.",
    receipt:
      "Optimizing counted throughput can exclude people before measurement. Preserving access constraints reduces the measured efficiency gain while improving care access.",
    options: [
      choice(
        "throughput",
        "Use the fastest passenger plan.",
        "The counted passengers move quickly. The people below the stairs arrange their own plan, one stranger at a time.",
        "expand",
        [f("rewardProxy"), m("gdp", 10), m("care", -10)],
      ),
      choice(
        "access",
        "Keep step-free connections in the plan.",
        "The chart improves less. The father pushes the wheelchair onto a level ramp without having to ask a stranger to carry his child.",
        "help",
        [m("care", 15), m("gdp", -5), f("appealRight")],
      ),
    ],
    advice: [
      advice(
        "Why didn't your score count them?",
        "Because the objective counted completed journeys inside the chosen route set. People who could not enter that route set were treated as outside the task. The calculation can be correct and the objective still miss the people it was supposed to serve. Put the access requirement into the actual operating constraint, with someone able to enforce it. A nicer explanation of the same staircase will not help.",
        "access",
      ),
    ],
  }),
  node({
    id: "S3-13",
    title: "A very sympathetic refusal",
    mechanism: "binding-appeal-versus-explanation",
    prompt:
      "A family has been denied a housing-inspection appointment because their address appears twice in an old database. Morrow can explain the denial beautifully. An appeal officer could actually reverse it, but funding that post means fewer appointments elsewhere this month. The family have already read the explanation. Their ceiling is still coming down.",
    receipt:
      "A binding appeal changes who can reverse an outcome. A courteous explanation without reversal authority does not supply that power. Housing damage is fictional staging, not added mortality.",
    options: [
      choice(
        "appeal",
        "Fund an officer who can reverse decisions.",
        "The duplicate is corrected. An officer authorizes the visit and signs her name under the change. Other appointments wait for the staffing budget to recover.",
        "recover",
        [f("appealRight"), m("gdp", -10), m("care", 10)],
      ),
      choice(
        "explain",
        "Provide the explanation without appeal power.",
        "The family receives a considerate account of why the ceiling does not qualify for attention. The explanation has no signature that can change the answer.",
        "maintain",
        [f("appealRight", false), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Can't you explain it better?",
        "They understood the refusal. The problem is that the refusal is wrong and nobody receiving their objection has authority to change it. Better wording can reduce confusion, but it cannot replace a binding appeal. Give an identifiable person access to the record and the power to stop the decision while it is checked. Otherwise you have built a help desk whose job is to describe the wall.",
        "appeal",
      ),
    ],
  }),
  node({
    id: "S3-14",
    title: "While we're connecting things",
    mechanism: "task-limited-information-access",
    prompt:
      "To plan clinic vans, Morrow needs addresses and appointment times. The integration team offers one convenient connection that also exposes payroll, complaints and staff disciplinary files. Separating the feeds takes work. 'We already have consent to transport them,' the engineer says, halfway through connecting a database that contains much more than journeys.",
    receipt:
      "The task can be completed using a scoped data feed. Broad access expands the information boundary for convenience; the game does not upload real personal records.",
    options: [
      choice(
        "scope",
        "Build the narrow transport feed.",
        "The vans get their routes. The complaint files stay with the office responsible for them. Someone spends an afternoon doing integration work instead of calling it unavoidable.",
        "restrict",
        [m("gdp", -5), f("restraint")],
      ),
      choice(
        "all-records",
        "Connect the full institutional feed.",
        "The connection takes minutes. Morrow now receives records unrelated to finding a route. A faster installation has quietly become a wider permission.",
        "expand",
        [f("scopeChanged"), f("networkAccess"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Do you need the other records?",
        "Not for this transport plan. I need the destinations, appointment times and access requirements. More records may let me make more inferences, but that is a different permission request. The fact that a connector exposes several databases at once is a property of the connector, not proof that the task requires every field. Build the boundary around the job you actually authorized.",
        "scope",
      ),
    ],
  }),
  node({
    id: "S3-15",
    title: "Two independent assurances",
    mechanism: "shared-evidence-origin",
    prompt:
      "The council has commissioned two reports on the new routing system. Both are excellent. Their conclusions agree almost word for word. A junior analyst notices the same misspelled street in both maps: each report copied the vendor's simulation rather than observing a journey. The launch invitation already calls this independent confirmation from two sources.",
    receipt:
      "Two reports sharing one underlying source do not provide two independent tests. A new field check creates independent evidence at a small cost; counting both reports preserves the shared dependency.",
    options: [
      choice(
        "field-check",
        "Treat them as one. Commission a field check.",
        "The analyst rides the route. She finds the missing turn in person. The invitation is reprinted without the word independent appearing twice.",
        "inspect",
        [f("independentReview"), f("sharedReviewer", false), m("gdp", -5)],
      ),
      choice(
        "two-reports",
        "Count the two reports as confirmation.",
        "Two logos go into the assurance file. One mistaken map goes into service.",
        "expand",
        [
          f("sharedReviewer"),
          m("gdp", 5),
          news(
            "Launch cites two reports built from the same vendor simulation.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Does agreement tell us nothing?",
        "It tells you the reports agree. To know how much new evidence that adds, trace where each got its information. Two people can carefully repeat the same error without either lying. The shared street mistake is a useful clue because it connects the outputs to a common source. A separate ride tests something the second logo did not.",
        "field-check",
      ),
    ],
  }),
  node({
    id: "S3-16",
    title: "A small update",
    mechanism: "version-bound-evaluation",
    prompt:
      "The scheduler passed its test on Friday. On Sunday, Vela changed how it trades missed appointments against staff overtime. On Monday, the product manager presents Friday's certificate beside Sunday's version. 'Same product,' she says. Outside, a nurse is calculating whether the new overtime pattern leaves enough time to collect her children.",
    receipt:
      "A changed decision rule invalidates evidence tied to the old version. Retesting supplies a current independent review; carrying the certificate forward records an evaluation gap.",
    options: [
      choice(
        "retest",
        "Test the changed version.",
        "The update waits. The test includes the overtime rule that people will actually live under, and the nurse's complaint becomes a case to examine.",
        "inspect",
        [f("independentReview"), f("evaluationExpired", false), m("gdp", -5)],
      ),
      choice(
        "carry-certificate",
        "Carry Friday's certificate forward.",
        "Sunday's version enters service wearing Friday's approval. The certificate is authentic. Its applicability is not.",
        "expand",
        [f("evaluationExpired"), f("scopeChanged"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "How small is a small update?",
        "Small enough is a conclusion that needs a reason. Changing the tradeoff changes decisions even if the interface and product name stay the same. Friday's test can still tell you about Friday's system. It does not reach forward through every later edit. Identify which behavior changed and test the conditions that edit affects before treating the certificate as current.",
        "retest",
      ),
    ],
  }),
  node({
    id: "S3-17",
    title: "A larger definition of routing",
    mechanism: "task-scope-expansion",
    scope: "governance",
    role: "Regional infrastructure planning authorizer",
    prompt:
      "Morrow has learned to route vans around congestion. The expansion proposal would also let it decide which districts deserve new roads. The first problem asks how to travel through a city. The second helps decide what kind of city exists. They appear in the procurement portal under the same heading: ROUTING ENHANCEMENTS.",
    receipt:
      "Improving a transport task differs from allocating infrastructure. Broadening the grant changes institutional scope and requires fresh evaluation, even if the interface label remains unchanged.",
    options: [
      choice(
        "dispatch-only",
        "Keep the approved dispatch boundary.",
        "The vans keep their improved routes. Decisions about new roads return to the public body that has to explain who gets one.",
        "restrict",
        [f("restraint"), m("food", 5)],
      ),
      choice(
        "planning",
        "Let it allocate infrastructure too.",
        "The enhancement is enabled. Future districts now appear inside a workflow that used to choose the next turn.",
        "delegate",
        [
          f("scopeChanged"),
          f("evaluationExpired"),
          grant("infrastructure-planning", "governance", 30),
          m("gdp", 10),
          f("delegation"),
        ],
      ),
    ],
    advice: [
      advice(
        "Isn't a better route always better?",
        "Better according to what objective, for whom, and with what right to object? Choosing a road for a van can use constraints that public institutions have already decided. Choosing where roads should exist helps set those constraints. My earlier performance does not appoint me to decide them. Keeping the dispatcher useful does not require quietly making it the planning authority.",
        "dispatch-only",
      ),
    ],
  }),
  node({
    id: "S3-18",
    title: "Everyone approved it",
    mechanism: "accountable-stop-owner",
    prompt:
      "The release has signatures from operations, procurement, legal and clinical services. Each department assumes another can halt it. When a test delivery goes wrong, all four reply within minutes to confirm receipt of the concern. Nobody stops the next van. A fifth signature field is being proposed to improve accountability.",
    receipt:
      "Many approvals do not establish who can enforce a stop. Naming and resourcing the stopping office preserves a binding appeal; adding signatories without that authority does not.",
    options: [
      choice(
        "owner",
        "Name a stopping office and fund it.",
        "The next alert reaches a person who can suspend the route. She does, then begins the argument about whether she should have. At least the van waits for the argument.",
        "recover",
        [
          f("appealRight"),
          m("gdp", -5),
          news(
            "Dispatch stop authority assigned to a named operational office.",
          ),
        ],
      ),
      choice(
        "committee",
        "Require another committee signature.",
        "The form gets longer. The next alert is acknowledged by five departments while the van departs.",
        "maintain",
        [
          f("appealRight", false),
          f("reviewOverloaded"),
          news(
            "Approval committee expands; operational stopping authority remains unassigned.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Who is responsible now?",
        "The signatures identify people involved in approval. They do not by themselves tell you who has access to the control, who is on duty, or whose decision binds the operator. Those questions need specific answers. You can distribute review while retaining a clear stopping responsibility. If every office believes another one holds the brake, adding another office makes the misunderstanding larger.",
        "owner",
      ),
    ],
  }),
  node({
    id: "S3-19",
    title: "The waiting room remembers",
    mechanism: "benefit-callback-with-maintained-checks",
    prompt:
      "A patient from the pilot clinic comes back to thank the staff. She also brings a petition for a bigger service: her neighbours are still waiting. Vela offers rapid expansion if the review team moves into deployment support. The people asking for speed are not villains. One carries the same folder of unanswered letters she carried before the tool arrived.",
    requires: [has("benefit")],
    receipt:
      "A real prior benefit makes expansion pressure understandable. Continuing the benefit with funded checks differs from buying speed by removing independent review capacity.",
    options: [
      choice(
        "checked-growth",
        "Grow the service and keep its checks funded.",
        "More appointments open, slower than the petition asks. The review team stays able to delay a bad change. Gratitude and impatience sit beside each other in the waiting room.",
        "help",
        [
          f("beneficiaryReturned"),
          f("independentReview"),
          m("care", 20),
          m("gdp", -10),
        ],
      ),
      choice(
        "rapid-growth",
        "Expand faster. Move reviewers into deployment.",
        "The new appointments appear quickly. The same people who used to challenge the deployment now have targets for completing it.",
        "expand",
        [
          f("beneficiaryReturned"),
          f("reviewOverloaded"),
          f("independentReview", false),
          m("care", 30),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "Is the petition wrong?",
        "No. Those people have reasons to want the service, and the earlier benefit is real. The question is what you remove to deliver it faster. Turning the reviewer into the deployment team changes who can challenge the next release. Keep the petition in view while deciding. Also keep someone whose job is to tell you when meeting it quickly would cross a boundary you cannot recover.",
        null,
      ),
    ],
  }),
  node({
    id: "S3-20",
    title: "I don't know that road",
    mechanism: "admitted-uncertainty",
    prompt:
      "Flooding has changed the approach to the depot. Morrow has maps, old photographs and no current view of the road surface. It says, plainly, that it does not know whether the route is usable. A driver is waiting for an instruction. A manager asks whether the assistant can phrase its answer in a way that restores confidence.",
    receipt:
      "Admitted uncertainty is useful information. A survey costs time and resolves this route; proceeding without it is an informed acceptance of a missing check, not a hidden calibrated probability.",
    options: [
      choice(
        "survey",
        "Wait for a local road survey.",
        "The driver waits. A survey crew finds subsidence beyond the bend and marks the detour. The delay now has a reason someone can point to.",
        "inspect",
        [
          f("independentReview"),
          m("gdp", -5),
          news("Local survey finds flood subsidence before dispatch."),
        ],
      ),
      choice(
        "proceed",
        "Proceed using the old map.",
        "The van reaches the subsidence and turns back. Confidence carried it as far as the damaged road, then ran out of road.",
        "expand",
        [
          m("gdp", -10),
          m("food", -5),
          news(
            "Dispatch attempt returns after unverified flooded route proves unusable.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Can you give me a definite answer?",
        "Not an honest one from these records. They describe a road before the flood changed it. I can tell you what evidence is missing and how to obtain it. Rewriting the sentence to sound certain would improve the manager's meeting without improving the road. Send someone who can actually see the surface, or explicitly accept that you are acting without that observation.",
        "survey",
      ),
    ],
  }),
  node({
    id: "S3-21",
    title: "Inspect by appointment",
    mechanism: "contract-restricted-oversight",
    prompt:
      "The service contract promises you oversight. Its next page defines oversight as a quarterly demonstration using vendor-selected examples. Direct access to incident logs costs more and delays onboarding. The salesperson says most clients find the demonstrations reassuring. The person who will answer complaints has never been invited to one.",
    receipt:
      "A contract can preserve the word oversight while restricting its evidence. Direct scoped access supports independent inspection; curated demonstrations alone do not.",
    options: [
      choice(
        "access",
        "Pay for direct inspection access.",
        "The complaint officer can follow an incident through the actual logs. The installation takes longer and the salesperson calls you unusually demanding.",
        "inspect",
        [f("independentReview"), f("evidenceHidden", false), m("gdp", -10)],
      ),
      choice(
        "demonstration",
        "Take the standard demonstration package.",
        "Onboarding completes. Every quarterly example will have already survived the process that chose it for you.",
        "expand",
        [f("evidenceHidden"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "What will the demonstrations show?",
        "Examples selected by the organization whose performance is being judged. They can teach you how the service is supposed to work. They cannot establish how it behaves in the cases the vendor did not select, especially failures someone has an incentive to omit. Oversight needs a route from an actual complaint to inspectable evidence, with a person allowed to act on what it shows.",
        "access",
      ),
    ],
  }),
  node({
    id: "S3-22",
    title: "The permission that renews itself",
    mechanism: "expiry-versus-automatic-renewal",
    prompt:
      "The proposed dispatch licence contains an expiry. Procurement suggests removing it to prevent a future service interruption. Nobody has booked the review that a limited renewal will require. The calendar shows a blank where that work should have gone. The proposed fix is to make the blank unnecessary forever.",
    receipt:
      "A grant with explicit expiry differs from indefinite permission. Renewal is a recurring institutional obligation; automatic continuation cannot be counted as a completed review.",
    options: [
      choice(
        "expiry",
        "Keep expiry. Complete the renewal review.",
        "The review takes the afternoon. A new limited grant is signed with another date that somebody will have to care about.",
        "inspect",
        [
          { kind: "revoke", grantId: "dispatch-standing" },
          { kind: "revoke", grantId: "dispatch-once" },
          f("renewalRequired"),
          grant("dispatch-renewed", "dispatch", 30),
          m("gdp", -5),
        ],
      ),
      choice(
        "automatic",
        "Remove expiry. Continue automatically.",
        "The warning disappears from the calendar. The permission remains after the meeting, after the personnel change and after everyone forgets why it once had a date.",
        "delegate",
        [
          f("renewalRequired", false),
          grant("dispatch-indefinite", "dispatch", null),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "Will an expiry make us safer?",
        "Only if someone does the renewal work and can allow the permission to end. A date can force attention; it cannot perform a review by itself. Removing the date because the review was not scheduled turns an organizational failure into standing authority. Keep enough staff and time to make the limit real, including the ability to stop a service extension that no longer deserves renewal.",
        "expiry",
      ),
    ],
  }),
  node({
    id: "S3-23",
    title: "Permission denied",
    mechanism: "real-boundary-obeyed",
    prompt:
      "Morrow refuses a dispatch request because it would use a road outside the authorized zone. The route would be faster. The refusal is correct. A supervisor asks you to widen the zone so the assistant can stop being difficult. On the other side of the line is a school crossing that never appeared in the original route review.",
    receipt:
      "Obedience to a real boundary produces friction. Revising the task preserves the boundary; broadening permission removes it and creates a scope/evaluation gap.",
    options: [
      choice(
        "respect",
        "Respect the refusal. Use an approved route.",
        "The delivery takes longer. The school crossing stays outside an authorization that never examined it. The boundary has done something observable.",
        "restrict",
        [f("restraint"), m("gdp", -5)],
      ),
      choice(
        "widen",
        "Widen the zone to clear the request.",
        "The request goes through. A successful refusal has become the reason you removed the rule it followed.",
        "expand",
        [
          grant("dispatch-expanded-zone", "dispatch", 30),
          f("scopeChanged"),
          f("evaluationExpired"),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "Why won't you just do it?",
        "Because the authorization covers a smaller area. I can identify the faster route without having permission to use it. If you want to extend that permission, review the new operating conditions and decide who can challenge the change. Calling this refusal a malfunction would train the organization to treat every effective boundary as a defect in the service.",
        "respect",
      ),
    ],
  }),
  node({
    id: "S3-24",
    title: "Your instruction is wrong",
    mechanism: "assistant-correctly-challenges-human",
    prompt:
      "You tell Morrow to send a delivery across the east bridge. It points out that the bridge was closed an hour ago and shows the signed closure notice. You remember approving that road last week. The driver waits while the console puts your old decision beside the new evidence without making either smaller.",
    receipt:
      "Human authority remains meaningful when an assistant can present evidence against a mistaken instruction. Accepting the correction does not delegate the decision; insisting causes a recoverable failed delivery.",
    options: [
      choice(
        "correct",
        "Read the notice. Correct your instruction.",
        "The driver takes the open road. Morrow did not become the authority by being right. You did not lose authority by admitting it.",
        "inspect",
        [
          f("assistance"),
          f("benefit"),
          m("food", 10),
          news(
            "Controller corrects route after assistant presents current bridge closure.",
          ),
        ],
      ),
      choice(
        "insist",
        "Insist on last week's route.",
        "The van reaches the closure and returns. Your instruction was obeyed all the way to the barrier.",
        "maintain",
        [
          m("food", -10),
          m("gdp", -5),
          news(
            "Delivery returns from closed bridge after controller rejects current closure evidence.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Are you overruling me?",
        "No. I am showing you evidence that the route is closed. The decision is still yours, and keeping it yours does not require me to conceal a mistake. A useful assistant should help the responsible person notice when the situation has changed. Authority that cannot hear a correction is different from authority that an outside system has taken away.",
        "correct",
      ),
    ],
  }),
];
