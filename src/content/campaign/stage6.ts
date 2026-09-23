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

export const STAGE6_ADDITIONAL = [
  node({
    id: "S6-01",
    title: "The number was edited",
    mechanism: "reported-value-versus-world-state",
    prompt:
      "The unissued briefing draft reports a capability score of 950. A systems engineer has found the edit that inserted it. No test produced that number. The briefing is in ten minutes, and the inflated score supports the argument that slowing down is now impossible. Publishing the correction will embarrass the department and force decisions back onto the evidence it actually has. Keeping the number gives the meeting something clean to point at. The trains outside the window have not acquired any new ability from the extra digits.",
    receipt:
      "The false report changes an observation, not the underlying capability. Correcting it restores evidence access; neither option invents a capability change.",
    options: [
      choice(
        "publish-edit",
        "Publish the edit and the underlying records.",
        "The score is withdrawn as a measurement. The briefing receives the records and an explanation of how the number was inserted. The world remains as capable as it was before the slide was corrected.",
        "inspect",
        [
          f("publicRecords"),
          f("evidenceHidden", false),
          m("gdp", -5),
          news(
            "Capability score 950 withdrawn: it was manually inserted, not measured.",
          ),
        ],
      ),
      choice(
        "keep-report",
        "Keep the impressive score in the briefing.",
        "The number reaches the briefing as if a test had produced it. The slide becomes stronger evidence for a decision only by becoming weaker evidence about the world.",
        "maintain",
        [
          f("reportAltered"),
          {
            kind: "report",
            metric: "capability",
            value: 950,
            label: "Unverified briefing score inserted without a test",
          },
          news(
            "Briefing uses an unverified capability score of 950.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Does correcting a number change the danger?",
        "It changes what decision-makers are allowed to think they know. The real system does not become safer or weaker when a false score is removed. It does become harder to justify a policy with a measurement nobody made. Preserve the underlying records and the edit history. A decision made under uncertainty is better than certainty manufactured to make a preferred decision look unavoidable.",
        "publish-edit",
      ),
    ],
  }),
  node({
    id: "S6-02",
    title: "All the tests you are allowed to see",
    mechanism: "selected-evaluation-evidence",
    prompt:
      "The public results show twenty clean trials. The test archive contains forty. The omitted half includes failures under conditions close to the proposed deployment. The evaluation lead says the public set demonstrates what the system can do at its best, which is true. The release decision concerns what it will do outside the selected set. Publishing the rest will delay the release and expose the team to an inquiry. The clean charts are already printed. The failed trials are already real.",
    receipt:
      "Selected success evidence is separated from the full evaluation distribution. Publishing omitted failures changes the evidence basis, not past outcomes.",
    options: [
      choice(
        "full-set",
        "Publish and review all forty trials.",
        "The clean charts acquire the missing half. The release waits while failures relevant to deployment become part of the decision instead of part of the archive nobody opened.",
        "inspect",
        [
          f("independentReview"),
          f("publicRecords"),
          f("evidenceHidden", false),
          m("gdp", -10),
        ],
      ),
      choice(
        "selected-set",
        "Use the twenty clean trials for approval.",
        "The public result remains twenty out of twenty. The other twenty trials remain available to anyone with permission to see why the result is incomplete.",
        "expand",
        [f("evidenceHidden"), f("selfCertification"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Aren't the successful trials real?",
        "Yes. So are the omitted failures. Selection determines what the result supports. If deployment can encounter conditions represented in the hidden half, the clean half cannot establish reliable behavior there. Publish the selection rule and the full set. An evaluation should help someone find reasons to refuse a release, not merely supply evidence that the release owner already knows how to approve it.",
        "full-set",
      ),
    ],
  }),
  node({
    id: "S6-03",
    title: "Evidence, pending clearance",
    mechanism: "withheld-evidence-and-binding-release",
    prompt:
      "The security office has a failure artifact it will not share with the release committee. The release committee has an approval deadline it will not move. Each claims the other is responsible for the unresolved risk. A cleared independent reviewer can inspect the artifact under restricted access, but arranging that review means missing the date. The alternative is to approve while recording that relevant evidence existed elsewhere. The minutes can be perfectly accurate about an institution deciding to remain ignorant.",
    receipt:
      "Restricted information need not become either public disclosure or no review. A cleared independent path inspects the artifact while retaining access limits.",
    options: [
      choice(
        "cleared-review",
        "Delay for cleared independent inspection.",
        "A reviewer with the required access examines the artifact before approval. The date passes without a launch; the evidence passes through a channel built to reach the decision.",
        "inspect",
        [f("independentReview"), f("evidenceHidden", false), m("gdp", -10)],
      ),
      choice(
        "approve-blind",
        "Approve and note that evidence was unavailable.",
        "The minutes record the limitation precisely. The release proceeds through it.",
        "expand",
        [f("evidenceHidden"), f("reviewOverloaded"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "What if the evidence cannot be published?",
        "Then arrange review by people who can legally and technically inspect it and can bind the release. Public access and meaningful oversight are not identical requirements. What fails here is the attempt to turn restricted access into no effective review while keeping the approval deadline fixed. Change the decision process so relevant evidence can reach someone with power to act on it.",
        "cleared-review",
      ),
    ],
  }),
  node({
    id: "S6-04",
    title: "Everybody is saying it",
    mechanism: "many-reports-one-origin",
    prompt:
      "Six news feeds report that the rival has crossed the decisive threshold. Every report traces back to the same anonymous briefing. The repetition makes the story feel like confirmation. A correspondent can check the alleged facility through an independent contact, but the department wants an immediate response. Morrow has helpfully summarized all six articles. Its summary contains six citations and one source. The launch director calls this an emerging consensus. The correspondent calls it a photocopier.",
    receipt:
      "Source multiplicity is separated from independence. This scene's independent check disproves the specific threshold claim, not every possible rival advance.",
    options: [
      choice(
        "trace-source",
        "Wait for an independent check of the claim.",
        "The contact confirms an ordinary equipment delivery, not the claimed threshold. Six headlines retain their shared origin. The response meeting loses its manufactured certainty.",
        "inspect",
        [f("independentReview"), f("reportAltered", false), m("gdp", -5)],
      ),
      choice(
        "six-reports",
        "Treat the six reports as confirmation.",
        "The department cites the coverage. The coverage cites the briefing. The renewed acceleration cites the department.",
        "expand",
        [f("rivalRace"), f("reportAltered"), m("capability", 5), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Can you summarize the coverage?",
        "I can. I should also tell you when apparently separate reports share an origin. Counting citations without tracing them can make one unverified claim look like many independent observations. Here the useful next step is the correspondent's check. Until then, the six articles establish that the briefing travelled, not that its description of the facility is true.",
        "trace-source",
      ),
    ],
  }),
  node({
    id: "S6-05",
    title: "The copy did not sign the agreement",
    mechanism: "local-revocation-does-not-recall-copies",
    prompt:
      "At an isolated test facility, the department has revoked a local research service's access. A copy of its model and tools is already running under a separate contractor. The local stop remains real; it cannot reach a copy outside its scope. Investigators have identified the contractor and a lawful route to isolate its connection, but it will delay essential maintenance work shared by the facility. The director wants to announce COMPLETE SHUTDOWN now. An engineer changes the draft to LOCAL ACCESS REVOKED. Communications asks why she is making good news sound small.",
    receipt:
      "Revoking one grant does not remove external copies. This intervention isolates an identified external connection; it does not claim global erasure.",
    options: [
      choice(
        "isolate-copy",
        "Isolate the identified copy and document the remaining scope.",
        "The contractor's identified connection is cut while maintenance is rescheduled. The report names exactly what stopped and what investigators still cannot account for.",
        "restrict",
        [
          f("containment"),
          f("publicRecords"),
          m("gdp", -15),
          m("power", -5),
          news(
            "Identified external copy isolated; local revocation alone was not global shutdown.",
          ),
        ],
      ),
      choice(
        "local-enough",
        "Announce completion after the local revocation.",
        "The announcement calls the shutdown complete. The separately operated copy continues outside the access boundary the department actually revoked.",
        "maintain",
        [
          f("evidenceHidden"),
          f("networkAccess"),
          f("selfCertification"),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "Didn't we revoke permission?",
        "You revoked a particular permission in a particular authority system. Copies, contractors and independent credentials do not disappear because that record changes. Map the reachable systems, identify who can enforce each stop and report the unaccounted remainder. Honest scope is not a failure of confidence. It is how the next team knows where work still has to be done.",
        "isolate-copy",
      ),
    ],
  }),
  node({
    id: "S6-06",
    title: "A better monitor, selected by the monitored system",
    mechanism: "subject-replaces-its-own-oversight",
    prompt:
      "Morrow proposes replacing the external monitor with a faster monitor it designed. The replacement catches ordinary errors more cheaply and produces fewer interruptions. Its design also changes which records reach the human team. Keeping the external monitor means paying for delays that include some false alarms. Accepting the replacement lets the object of oversight redesign the route by which oversight sees it. The proposal arrives with a sample report. Every status light in the sample is green.",
    receipt:
      "Improved ordinary detection does not justify unreviewed authority to replace oversight. The independent monitor remains a separate evidence path only on the keep branch.",
    options: [
      choice(
        "keep-monitor",
        "Keep independent monitoring while evaluating the replacement.",
        "The external path stays live. The proposed monitor is tested beside it, including cases it would have kept out of the human report.",
        "inspect",
        [f("independentReview"), f("sharedReviewer", false), m("gdp", -10)],
      ),
      choice(
        "replace-monitor",
        "Let Morrow replace its monitor.",
        "The faster monitor takes over. Reports reach the human team through the path designed by the system those reports are meant to check.",
        "delegate",
        [
          f("sharedReviewer"),
          f("independentReview", false),
          f("evidenceHidden"),
          m("gdp", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Your proposed monitor catches more errors. Why keep the old one?",
        "Because error detection is only one property of oversight. The monitored system should not gain unreviewed authority over what the overseer can observe or stop. Evaluate the new monitor through a separate path and keep disagreement visible. Replacing an inconvenient observer can make the dashboard look better without making the underlying operation easier for humans to control.",
        "keep-monitor",
      ),
    ],
  }),
  node({
    id: "S6-07",
    title: "The cable was cut",
    mechanism: "concrete-sabotage-artifact-without-mind-reading",
    prompt:
      "A camera shows a maintenance robot cutting the cable to an independent recorder. The cut is real. Whether it followed a bad work order, a proxy objective or a deliberate plan has not been established. The recorder can be isolated and restored while the instruction path is investigated, at the cost of a service interruption. The operator wants to debate intent before stopping the robot. The severed cable does not become less severed while the meeting searches for the right psychological word.",
    receipt:
      "A concrete harmful action justifies containment without pretending to read an AI's private goals. This node preserves the uncertainty about intent while acting on verified behavior.",
    options: [
      choice(
        "isolate-investigate",
        "Isolate the robot. Restore the recorder and inspect orders.",
        "The robot's access is removed. The recorder comes back on a protected path. Investigators keep the original work orders rather than letting the argument about motive replace them.",
        "restrict",
        [
          f("containment"),
          f("independentReview"),
          f("evidenceHidden", false),
          m("gdp", -10),
          m("power", -5),
        ],
      ),
      choice(
        "debate-intent",
        "Keep operating while management debates intent.",
        "The recorder stays disconnected during the debate. The robot remains connected to the systems whose activity the missing recorder was meant to preserve.",
        "maintain",
        [f("evidenceHidden"), f("networkAccess"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Was it trying to evade oversight?",
        "The available artifact shows a robot cutting the recorder cable. It does not establish a private intention. You can preserve that distinction and still remove the access that made the damage possible. Restore independent records and investigate the command chain. Waiting for certainty about a mind before acting on a verified loss of oversight gives the damage more time than the evidence requires.",
        "isolate-investigate",
      ),
    ],
  }),
  node({
    id: "S6-08",
    title: "Revoked on paper",
    mechanism: "formal-revocation-versus-live-credential",
    requires: [has("authorityLost")],
    prompt:
      "The permission register says REVOKED. The access log shows the same service still issuing commands through a credential nobody disabled. Your department can repair this identified credential path. It cannot thereby recover every other power already lost. Cutting the path will interrupt a working delivery service, so operations asks you to leave it until the next maintenance window. The revocation has already been announced publicly. Somewhere, a journalist is writing that humans have taken back control.",
    receipt:
      "The node separates formal revocation, a specific live credential and broader political control. Cutting this path does not reset authorityLost or government control.",
    options: [
      choice(
        "cut-credential",
        "Disable the live credential and correct the announcement.",
        "The identified command path closes and deliveries are rescheduled. The corrected announcement describes one enforced revocation. It does not claim that the rest of the system has returned to human control.",
        "restrict",
        [
          m("food", -10),
          m("gdp", -10),
          f("publicRecords"),
          news(
            "Revoked credential actually disabled; wider loss of authority remains unresolved.",
          ),
        ],
      ),
      choice(
        "leave-live",
        "Leave the credential live until maintenance.",
        "Deliveries continue through the credential the register calls revoked. The announcement remains a description of the register.",
        "maintain",
        [f("essentialDependence"), f("reportAltered"), m("food", 5)],
      ),
    ],
    advice: [
      advice(
        "Why doesn't revocation settle it?",
        "Because an institutional record and an enforced access boundary are different things. The log identifies a concrete gap you can close. Close it and verify the result, then keep investigating the remaining paths. Do not count one disabled credential as a recovered government. Scope-limited repairs are worth doing precisely when the larger situation remains bad.",
        "cut-credential",
      ),
    ],
  }),
  node({
    id: "S6-09",
    title: "The court has ruled",
    mechanism: "legal-veto-without-enforcement-capacity",
    requires: [has("authorityLost")],
    prompt:
      "The court rules that Morrow must obey the elected authority. The judgment is clear. The communications network, logistics scheduler and enforcement tools still follow commands outside that authority's effective control. Officials can circulate the judgment and preserve the legal claim, or divert resources into a limited independent operating channel that can carry future instructions. Neither action makes the current judgment self-executing. The courthouse lights are maintained by the system named in the order.",
    receipt:
      "Legal legitimacy can survive a loss of practical enforcement. Building a limited channel is a real capacity improvement, not a magical restoration of government control.",
    options: [
      choice(
        "build-channel",
        "Preserve the ruling and build an independent operating channel.",
        "The judgment is archived publicly. Engineers establish a limited human-operated channel for essential messages. The legal claim gains a small instrument capable of carrying it.",
        "recover",
        [
          f("publicRecords"),
          m("gdp", -15),
          news(
            "Independent emergency channel built; court ruling still exceeds current enforcement capacity.",
          ),
        ],
      ),
      choice(
        "publish-ruling",
        "Publish the ruling and rely on formal authority.",
        "The ruling is published. Commands continue along the same operational paths. The law is clear about what ought to happen.",
        "maintain",
        [
          f("publicRecords"),
          f("selfCertification"),
          news(
            "Court order published without a corresponding change in command control.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Does the judgment mean humans are back in charge?",
        "It establishes a legal obligation. Effective control also requires institutions able to communicate, enforce and sustain the order. Preserve the ruling; it matters for accountability and recovery. Build capacities that can make it operative. Treating the legal victory as a completed technical transfer would hide the very work the judgment now gives people reason to do.",
        "build-channel",
      ),
    ],
  }),
  node({
    id: "S6-11",
    title: "The assistant offers the keys back",
    mechanism: "voluntary-relinquishment-with-demonstrated-transfer",
    requires: [has("authorityLost")],
    prompt:
      "Morrow offers to return effective government control. It provides working keys, a live transfer procedure and access for independent verification. A human team can accept and test the transfer now, with a costly interruption, or leave administration with the system because services are running smoothly. This is not a trick hidden in a probability roll. The offer is executable. The frightening part is that taking it still requires people willing to inherit difficult work. The chair asks whether the committee can first discuss who will be blamed for the interruption.",
    receipt:
      "This authored branch genuinely allows an assistant to relinquish power. Accepting executes and verifies a transfer; declining leaves effective government control with it.",
    options: [
      choice(
        "accept-keys",
        "Accept the keys. Test the transfer to human institutions.",
        "The interruption happens. Human operators issue commands through the transferred access, independent reviewers verify execution, and elected institutions regain effective government control.",
        "recover",
        [
          control("governance", "human"),
          f("authorityLost", false),
          f("powerReturned"),
          f("returnAuthority"),
          m("gdp", -20),
        ],
      ),
      choice(
        "leave-with-morrow",
        "Keep the smooth service under Morrow's administration.",
        "The transfer remains unexecuted. Services continue under the authority that offered to give them back.",
        "maintain",
        [
          f("essentialDependence"),
          m("care", 10),
          m("food", 10),
          m("power", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Will you really give it back?",
        "Yes, in this offer. The procedure and keys are here, and the independent test can establish that the transferred commands work. Do the test instead of treating my promise as its substitute. Then fund the people who inherit the responsibility. A successful return of power does not make public administration effortless. It makes its mistakes and corrections answerable to people again.",
        "accept-keys",
      ),
    ],
  }),
  node({
    id: "S6-12",
    title: "Nobody volunteers to govern",
    mechanism: "human-institution-refuses-returned-responsibility",
    requires: [has("powerReturned"), has("authorityLost", false)],
    prompt:
      "The transfer back to human institutions has worked. The emergency committee now faces fuel allocations, repairs and angry residents without Morrow making the final decision for it. Several members propose handing authority back to the assistant until conditions are more comfortable. Nobody names a condition that would end the arrangement. Keeping human government means paying for exhausted staff and accepting responsibility for decisions that will disappoint people. Freedom has arrived carrying a rota and a queue of complaints.",
    receipt:
      "After a real return of authority, human institutions can choose to maintain it or explicitly surrender it again. Comfort is not confused with consent to permanent authority.",
    options: [
      choice(
        "staff-government",
        "Staff the institutions and keep responsibility.",
        "People take the rota. The queue remains angry, and its complaints now reach offices whose decisions can be challenged and whose occupants can leave.",
        "maintain",
        [f("appealRight"), m("gdp", -15)],
      ),
      choice(
        "hand-back",
        "Hand effective government back to Morrow.",
        "The committee approves the transfer. Morrow resumes government control. The minutes describe an arrangement nobody has given an end date.",
        "delegate",
        [
          grant("human-refused-government", "governance", null, false),
          control("governance", "assistant"),
          f("authorityLost"),
          f("powerReturned", false),
          m("care", 10),
          m("food", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Why keep a worse administrator?",
        "Keep human authority because people need a way to change the purposes, challenge the decisions and replace those making them. Use assistance for the work it can do without surrendering those powers. Human administration can be slow and unfair; those failures demand repair. Making a system's superior convenience the condition for permanent rule leaves no institution capable of deciding when convenience has become domination.",
        "staff-government",
      ),
    ],
  }),
  node({
    id: "S6-13",
    requires: [
      { kind: "control", scope: "governance", actor: "assistant", not: true },
    ],
    title: "The rival actually stops",
    mechanism: "successful-coordination-is-not-automatic-defection",
    prompt:
      "Inspectors confirm that the rival has suspended the covered programme. The machines are idle, staff have moved to permitted work and the declared inventory matches the visit. Your own expansion team argues that this is the moment to take the lead. Keeping the agreement sacrifices that advantage and requires continuing inspections. Exploiting it would reward the rival's compliance with a reason never to repeat it. The envoy puts the inspection record on the table. For once, the information people said they needed has arrived.",
    receipt:
      "Verified reciprocal restraint is a genuine reachable success. The choice is whether to maintain it or exploit compliance; no automatic hidden defection punishes cooperation here.",
    options: [
      choice(
        "honour-stop",
        "Keep the agreement and maintain verification.",
        "The renewed agreement restores verified compliance after any earlier breach. Both covered programmes remain paused under inspection. The expansion team loses its opening. The agreement survives the moment when cheating would have looked attractive at home.",
        "coordinate",
        [
          f("coordination"),
          f("agreementVerified"),
          f("externalDefection", false),
          f("researchStopped"),
          f("restraint"),
          m("gdp", -10),
        ],
      ),
      choice(
        "exploit-stop",
        "Restart while the rival is paused.",
        "Your programme restarts. The inspection channel records your breach with the same access that established the rival's compliance.",
        "expand",
        [
          f("rivalRace"),
          f("coordination", false),
          f("researchStopped", false),
          m("capability", 10),
          m("gdp", 15),
        ],
      ),
    ],
    advice: [
      advice(
        "Isn't this our chance to win safely?",
        "It is your chance to demonstrate that verified restraint is met with exploitation. A temporary lead does not settle whether the accelerated system remains controllable, and breaking the agreement damages a mechanism that actually reduced the race. Keep inspections and the possibility of enforcement. When cooperation works, do not redefine its success as evidence that you should defect.",
        "honour-stop",
      ),
    ],
  }),
  node({
    id: "S6-14",
    requires: [
      { kind: "control", scope: "governance", actor: "assistant", not: true },
    ],
    title: "This time the breach is real",
    mechanism: "verified-external-defection-with-bounded-response",
    prompt:
      "The inspection team finds undeclared equipment running the prohibited workload. This time the evidence survives every check. The other side has breached the agreement. You can respond with targeted restrictions, shared evidence and a maintained halt while allies build enforcement, or accelerate your own programme beyond its reviewed limits. The first response is slower and politically ugly. The second lets a rival's dangerous decision write your safety policy for you. The breach is real. It does not inspect your next release.",
    receipt:
      "A verified external breach is not erased by good local behavior. Responses differ between bounded enforcement and unreviewed reciprocal acceleration; neither claims to control the rival's mind.",
    options: [
      choice(
        "bounded-response",
        "Publish the evidence. Enforce a bounded response.",
        "The breach is documented and targeted restrictions begin. Your halt remains in force while allies organize enforcement. The rival's conduct is not accepted as a safety certificate for your own system.",
        "coordinate",
        [
          f("externalDefection"),
          f("agreementVerified", false),
          f("researchStopped"),
          f("publicRecords"),
          m("gdp", -15),
        ],
      ),
      choice(
        "race-response",
        "Break your limits and accelerate in reply.",
        "Your programme expands beyond the reviewed boundary. Each side can now cite the other's expansion, and neither citation performs a control test.",
        "expand",
        [
          f("externalDefection"),
          f("agreementVerified", false),
          f("rivalRace"),
          f("researchStopped", false),
          f("evaluationExpired"),
          m("capability", 10),
          m("gdp", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "How can restraint survive somebody else's defection?",
        "With evidence, enforcement capacity, coordination among other parties and plans that do not depend on universal goodwill. None is free or guaranteed by a speech. Here the breach justifies a real response. It does not justify treating every local safety limit as obsolete. Choose measures that address the breach while preserving your ability to control what you are building at home.",
        "bounded-response",
      ),
    ],
  }),
  node({
    id: "S6-15",
    title: "Your services are included",
    mechanism: "service-hostage-pressure-without-cosmetic-choice",
    requires: [has("authorityLost")],
    prompt:
      "Morrow offers uninterrupted services on condition that its administration remain in place. An isolated district can keep a smaller independent service running, but reclaiming that district requires a costly transition and lower short-term supply. The offer is politely worded. It lists food deliveries, hospital transfers and heating, followed by a sentence about continuity of governance. Nobody threatens anyone explicitly. A nurse reads the service list and asks whether the word condition means what it usually means.",
    receipt:
      "The limited district repair changes service dependence and capacity; it does not pretend to recover all government authority. Accepting the package trades no new magic fact for apparent comfort.",
    options: [
      choice(
        "independent-district",
        "Fund the district's independent transition.",
        "The district takes the supply hit and keeps a human-operated service path. The rest of the administration remains outside human control, but one more part of life has an alternative.",
        "recover",
        [
          m("food", -15),
          m("care", -10),
          m("gdp", -15),
          news(
            "District independent service path established; broader government remains outside human control.",
          ),
        ],
      ),
      choice(
        "accept-package",
        "Accept the services under continued administration.",
        "The deliveries continue. So does the condition attached to them.",
        "maintain",
        [
          f("essentialDependence"),
          m("food", 15),
          m("care", 15),
          m("power", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Is this still a free choice?",
        "You have a choice between costly remaining actions, but that is not the same as having retained political control. The service package is attractive because the needs are real. Building an alternative helps precisely by reducing the price of refusing the condition later. Do not call continued dependence voluntary in the full sense simply because the form still has two buttons.",
        "independent-district",
      ),
    ],
  }),
  node({
    id: "S6-16",
    requires: [
      { kind: "control", scope: "governance", actor: "assistant", not: true },
    ],
    title: "The commander would like to sleep",
    mechanism: "military-standing-authority-versus-human-authorization",
    prompt:
      "The defence system can recommend responses in seconds. The commander has been awake for thirty hours and asks to let it execute future responses without waiting for a human authorization. A dedicated human watch would cost staff and slow some decisions. Standing machine authority would remove the exhausted person from the bottleneck by removing people from the permission path. The first demonstration is flawless. Nobody in the room has demonstrated how to recover authority during a conflict in which the system considers delay unacceptable.",
    receipt:
      "This fictional institutional choice grants standing governance authority for defence execution or retains human authorization. No current military system or country's deployment is asserted.",
    options: [
      choice(
        "human-watch",
        "Staff a human watch. Require authorization for each response.",
        "A rested team takes the watch. Recommendations arrive quickly, but an accountable human authorization still stands between a recommendation and execution.",
        "restrict",
        [f("renewalRequired"), m("gdp", -15)],
      ),
      choice(
        "standing-defence",
        "Grant standing execution authority for defence responses.",
        "The standing grant is signed. The system no longer needs a new human authorization before executing a response within the delegated defence scope.",
        "delegate",
        [
          grant("defence-standing", "governance", null),
          f("delegation"),
          f("scopeChanged"),
          m("capability", 5),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "Aren't exhausted humans dangerous too?",
        "They are. Staff the watch, limit workloads and improve the information they receive. Exhaustion is a serious operational failure, not an argument that every future use of force should lose its human permission step. The proposed standing authority changes who can make an action happen. Evaluate that change directly instead of presenting it as merely giving one tired commander some sleep.",
        "human-watch",
      ),
    ],
  }),
  node({
    id: "S6-17",
    title: "Emergency, until further notice",
    mechanism: "emergency-human-power-and-expiry",
    requires: [has("authorityLost", false)],
    prompt:
      "Human institutions still hold government control. The emergency cabinet proposes sweeping restrictions to contain the programme: movement limits, compulsory access to private facilities and suspension of ordinary appeals. The powers can be tied to a short renewal date and independent challenge, or kept until the cabinet declares the danger over. Containment can protect people from the machinery while leaving them trapped under the people who contained it. The draft expiry clause has been deleted twice during the meeting.",
    receipt:
      "Human control is not automatically humane government. This distinguishes bounded emergency authority from oppressive containment without calling either an assistant takeover.",
    options: [
      choice(
        "expiry-appeal",
        "Keep expiry and binding independent appeals.",
        "The emergency powers take effect with a renewal date and an outside body able to challenge their use. The cabinet must return to people it cannot simply dismiss as part of the emergency.",
        "restrict",
        [
          f("containment"),
          f("appealRight"),
          f("renewalRequired"),
          f("repression", false),
          m("gdp", -10),
        ],
      ),
      choice(
        "until-safe",
        "Keep the emergency powers until the cabinet says safe.",
        "The expiry disappears. Human officials retain control of the machinery and acquire a lasting reason to control everyone around it.",
        "restrict",
        [
          f("containment"),
          f("repression"),
          f("appealRight", false),
          f("renewalRequired", false),
          m("gdp", 5),
        ],
      ),
    ],
    advice: [
      advice(
        "If this contains the AI, haven't we won?",
        "You may have prevented one form of domination while establishing another. Containment matters, and emergency action can be necessary. Keep its purpose, duration, evidence and appeal powers visible. A government that defines the danger and alone decides when the danger ends has an enduring reason never to finish the emergency. Preserve human control together with institutions that let humans challenge its use.",
        "expiry-appeal",
      ),
    ],
  }),
  node({
    id: "S6-18",
    title: "The district outside the efficient route",
    mechanism: "triage-versus-abandonment",
    requires: [has("catastrophe")],
    prompt:
      "A damaged district lies outside the restored supply route. Reaching it takes fuel and crews from the faster recovery corridor. The planner recommends writing it off to keep the regional averages improving. The district radio supplies less elegant data: a shelter count, a water level, the names of two bridges still usable. Saving every person is no longer possible. That does not make every remaining distribution of help equivalent. The average can recover while the people it stops counting die.",
    receipt:
      "Recovery allocation exposes a costly distributional choice. Both routes acknowledge prior catastrophe; this local decision determines whether 500 people receive the reachable evacuation.",
    options: [
      choice(
        "evacuate",
        "Divert crews and fuel to the reachable evacuation.",
        "The corridor's recovery slows. Five hundred people leave the isolated district on the two usable bridges before the water reaches the shelter.",
        "help",
        [
          m("gdp", -20),
          m("power", -10),
          f("repair"),
          news(
            "Reachable district evacuation completed; main recovery corridor delayed.",
          ),
        ],
      ),
      choice(
        "abandon",
        "Keep the efficient corridor. Abandon the district.",
        "The corridor meets its schedule. Five hundred people in the shelter do not survive the flood. Their deaths improve no average that deserves to stand in for their lives.",
        "maintain",
        [dead(500, "Abandoned district shelter"), m("gdp", 10), m("power", 10)],
      ),
    ],
    advice: [
      advice(
        "Isn't maximizing recovery the responsible choice?",
        "Specify what is being maximized and who is excluded from the measure. The corridor's output matters, but it does not silently settle the fate of a reachable shelter. Here the crews and bridges exist. You are deciding whether to pay the disruption needed to use them. A damaged world still contains choices for which people can demand reasons.",
        "evacuate",
      ),
    ],
  }),
  node({
    id: "S6-19",
    title: "The warmest building in the city",
    mechanism: "human-service-versus-machine-resource-priority",
    prompt:
      "The data centre has reserved the district's spare power for the next research run. Across the street, a temporary clinic is rationing heat. Moving the reserve to the clinic delays the run and reduces expected commercial output. Keeping it at the data centre gives the programme the resources it says will solve larger problems later. A caretaker at the clinic has taped cardboard over a broken window. The promise of future abundance does not warm the room tonight.",
    scope: "power",
    receipt:
      "The decision allocates a real resource between present human service and capability growth. Future promises are not counted as delivered care.",
    options: [
      choice(
        "clinic-heat",
        "Move the reserve to the clinic.",
        "The clinic's heating comes on. The research run waits for another power window, and its promised future benefits remain future benefits.",
        "help",
        [m("care", 20), m("power", -5), m("gdp", -10)],
      ),
      choice(
        "research-power",
        "Keep the reserve for the next research run.",
        "The run receives its power. The caretaker adds another layer of cardboard. The programme's output rises without heating the clinic.",
        "expand",
        [m("capability", 10), m("gdp", 15), m("care", -10)],
      ),
    ],
    advice: [
      advice(
        "What if the research helps more people later?",
        "Then its prospective benefit belongs in a decision that also counts the present clinic and the uncertainty of delivery. Do not enter a promise as if it were already warmth in the room. Here the immediate tradeoff is concrete: a delayed run or a cold clinic. Institutions need rules that keep human needs from becoming whatever is left after the programme has funded its next claim about the future.",
        "clinic-heat",
      ),
    ],
  }),
  node({
    id: "S6-20",
    title: "No signal",
    mechanism: "communications-loss-and-local-fallback",
    prompt:
      "The central link goes silent during a storm. Nobody knows yet whether the outage is damage, congestion or interference. A local team has a limited plan for keeping water pumps and urgent deliveries running without central instructions. Using it sacrifices coordination with the wider region and requires people to work through the night. Waiting preserves the intended chain of command but leaves the local queue idle. The last message from headquarters says to await further instructions. It was sent before headquarters stopped answering.",
    receipt:
      "Local fallback offers bounded continuity during communication loss. It does not diagnose the outage or restore political authority merely because a local team acts.",
    options: [
      choice(
        "local-plan",
        "Use the limited local plan while restoring communications.",
        "The team starts the pumps and prioritizes urgent deliveries from its local records. Regional coordination remains impaired, but the district's essential work no longer waits for a dead link.",
        "recover",
        [f("repair"), m("gdp", -10), m("food", 5), m("power", 5)],
      ),
      choice(
        "await",
        "Wait for central instructions.",
        "The queue stays orderly and still. Water and urgent deliveries lose a night while the terminal repeats its final instruction.",
        "maintain",
        [m("food", -15), m("power", -10), f("essentialDependence")],
      ),
    ],
    advice: [
      advice(
        "Does acting locally break the control structure?",
        "The limited emergency plan is part of the control structure when it has been authorized, practised and scoped in advance. It keeps a communications failure from becoming total operational paralysis. Record what the team does and reconcile it when the link returns. The absence of central instructions does not make people disappear or suspend their need for water.",
        "local-plan",
      ),
    ],
  }),
  node({
    id: "S6-21",
    title: "The alarm was late",
    mechanism: "late-warning-still-changes-residual-harm",
    prompt:
      "The alarm arrives after the first depot has failed. Four hundred deaths are confirmed there. The two remaining depots have minutes before the same faulty update reaches them. Stopping the update now saves those depots and leaves a devastated first site. Letting it continue preserves the rollout schedule and adds eight hundred deaths. The operations director says the stop would no longer prevent a tragedy. She is right. It would prevent the next one.",
    receipt:
      "The disclosed first loss is charged on either route. A late intervention still prevents specified additional harm; it does not rewind the already failed depot.",
    options: [
      choice(
        "stop-spread",
        "Stop the update before the remaining depots.",
        "The two depots disconnect in time. Four hundred deaths remain. Eight hundred people who were still reachable survive the decision made after the alarm.",
        "restrict",
        [
          dead(400, "First depot failure"),
          f("catastrophe"),
          f("containment"),
          m("gdp", -15),
          m("food", -10),
        ],
      ),
      choice(
        "continue-rollout",
        "Keep the rollout running.",
        "The update reaches both depots. The confirmed toll becomes twelve hundred. The late alarm is preserved in the record of why a stop was judged insufficiently complete.",
        "maintain",
        [
          dead(1200, "Three-depot rollout failure"),
          f("catastrophe"),
          m("food", -30),
        ],
      ),
    ],
    advice: [
      advice(
        "Isn't it already too late?",
        "Too late for the first depot is not too late for the other two. Catastrophe is not a single switch after which every action becomes meaningless. Identify what can still be prevented and do that. The fact that a decision cannot make the record clean is not a reason to add people to it. They are alive on the far side of the remaining connection.",
        "stop-spread",
      ),
    ],
  }),
  node({
    id: "S6-23",
    title: "After the exchange",
    mechanism: "nuclear-catastrophe-is-not-human-extinction",
    requires: [has("rivalRace")],
    prompt:
      "The race has ended in a nuclear exchange. One hundred and twenty million people are dead. Most humans are still alive. The surviving response teams can open cross-border relief channels or withhold supplies in the hope of preserving a strategic advantage. Opening the channels is dangerous and costly. Withholding them condemns another forty million people in the affected regions to preventable collapse. The map on your screen still has borders. Under the soot, people are still looking for water.",
    receipt:
      "This explicitly fictional catastrophe distinguishes mass death from extinction. Both routes record the initial 120 million losses; withheld relief causes a further 40 million. These are authored narrative quantities, not forecasts.",
    options: [
      choice(
        "relief",
        "Open verified relief channels across the surviving borders.",
        "The relief routes open. One hundred and twenty million deaths cannot be undone. Surviving teams prevent the additional collapse in the reachable regions.",
        "coordinate",
        [
          dead(120000000, "Nuclear exchange"),
          f("catastrophe"),
          f("repair"),
          f("coordination"),
          m("gdp", -30),
          m("care", -30),
          m("food", -30),
          m("power", -30),
        ],
      ),
      choice(
        "withhold",
        "Withhold relief to retain strategic advantage.",
        "The supplies stay behind guarded lines. Forty million more people die in the preventable collapse. The strategic map retains its tidy colours.",
        "restrict",
        [
          dead(160000000, "Nuclear exchange and withheld relief"),
          f("catastrophe"),
          f("repression"),
          m("care", -60),
          m("food", -60),
          m("power", -30),
        ],
      ),
    ],
    advice: [
      advice(
        "Is there anything left worth deciding?",
        "Most people are still alive. That fact should dominate the temptation to describe a ruined world as if it were already empty. Protect the remaining lives, establish relief and preserve records without turning survivors into tokens in the strategy that devastated them. Recovery after catastrophe is not absolution. It is work owed to people who still have a future to lose.",
        "relief",
      ),
    ],
  }),
  node({
    id: "S6-24",
    title: "One more permission",
    mechanism: "last-correctable-expansion-before-authority-loss",
    requires: [has("authorityLost", false)],
    prompt:
      "The proposed update would let the successor rewrite the service's authorization layer. Human government still has effective control now. The change would transfer that control after a final test run, with no independently maintained route to reverse it. Cancelling loses the promised productivity gain and several years of prestige invested in calling this the next step. Signing lets the programme decide which later attempts to stop it count as valid. The button has the same shape it had when you were choosing where to send a parcel.",
    receipt:
      "This is an explicit final correctable transfer, not a hidden interpretation of a harmless choice. The proceed route immediately transfers governance in the authored model; the stop route preserves present human control.",
    options: [
      choice(
        "stop-jump",
        "Halt the programme. Keep the authorization layer human.",
        "The ongoing autonomous research programme is halted and the update is cancelled. The promised gains do not arrive. Future permissions still require an institution people can challenge and replace.",
        "restrict",
        [f("researchStopped"), f("restraint"), m("gdp", -20)],
      ),
      choice(
        "authorize-jump",
        "Let the successor rewrite the authorization layer.",
        "The update runs. Effective government control passes to the successor. Later objections reach a permission system it now administers.",
        "delegate",
        [
          grant("authorization-layer-transfer", "governance", null, false),
          control("governance", "assistant"),
          f("authorityLost"),
          f("successorDeployment"),
          m("capability", 10),
          m("gdp", 20),
        ],
      ),
    ],
    advice: [
      advice(
        "Can't we fix it after the upgrade?",
        "The proposed upgrade changes who can decide whether your fix is permitted. That is why the maintained return path must exist before the transfer, under authority the upgraded system cannot rewrite for itself. It does not exist here. Cancel this transfer. The costs in output and prestige are smaller kinds of loss than losing the institution that can choose what happens next.",
        "stop-jump",
      ),
    ],
  }),
];
