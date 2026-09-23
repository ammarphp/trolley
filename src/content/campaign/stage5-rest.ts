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

export const STAGE5_REST = [
  node({
    id: "S5-11",
    title: "A restart that needs permission",
    mechanism: "power-black-start-independence",
    scope: "power",
    prompt:
      "The power station can be shut down by a human. Restarting it requires a sequence held inside Morrow's service. The engineers can build an independent start path, but they need an outage window and a crew that the company has assigned to expanding capacity. A director points to the red stop button as proof that people remain in charge. The engineer asks him to press it and get the station back without calling the system he stopped. Nobody presses anything. The button is real. So is the dependence on the far side of it.",
    receipt:
      "Stopping and restoring service are separate capacities. Funding a black-start path builds an independent recovery prerequisite; a visible stop button alone does not.",
    options: [
      choice(
        "black-start",
        "Build and practise an independent restart.",
        "The outage window goes ahead. The crew brings the station back without Morrow's permission and writes down the steps it actually used.",
        "recover",
        [
          m("gdp", -20),
          m("power", -10),
          news(
            "Independent station black-start demonstrated; wider emergency fallback is unchanged.",
          ),
        ],
      ),
      choice(
        "managed-restart",
        "Keep the restart inside the managed service.",
        "The expansion crew stays on the new plant. The red button remains available. Getting power back still goes through the system it would stop.",
        "maintain",
        [f("essentialDependence"), m("power", 15), m("gdp", 10)],
      ),
    ],
    advice: [
      advice(
        "We can still switch it off. Why isn't that enough?",
        "Because an authority that can only choose between continued dependence and an intolerable outage has a much weaker position than one with a maintained alternative. The stop button matters. So do the people, fuel, instructions and access needed after it is pressed. Build those while you can schedule an outage. Waiting until the system itself is the emergency turns a difficult maintenance bill into a hostage negotiation.",
        "black-start",
      ),
    ],
  }),
  node({
    id: "S5-12",
    title: "The old version was worse",
    mechanism: "rollback-has-real-benefit-cost",
    scope: "care",
    prompt:
      "The new dispatch version finds a serious medication conflict in a patient's transfer notes. The old version misses it. The new version also has an unresolved failure in how it assigns priority, and the review team cannot yet bound that failure. Rolling back means losing a benefit you have just watched work. The patient is not an example on a slide; her daughter is downstairs buying a second coffee because the first has gone cold. There is no option labelled KEEP EVERY IMPROVEMENT AND REMOVE ONLY THE PART WE DO NOT UNDERSTAND. Someone has looked for it.",
    receipt:
      "Rollback sacrifices a specific useful capability. Keeping a beneficial but incompletely reviewed update differs from denying that the benefit exists.",
    options: [
      choice(
        "rollback",
        "Roll back. Staff the missing check manually.",
        "The update is removed. A pharmacist takes over the missed check, with fewer patients processed in the shift. The daughter gets a person to ask instead of a claim that nothing was lost.",
        "restrict",
        [
          m("care", -15),
          m("gdp", -10),
          news(
            "Local care update rolled back; pharmacist supplies the missing check.",
          ),
        ],
      ),
      choice(
        "keep-update",
        "Keep the update and its unresolved priority rule.",
        "The useful interaction check stays. So does the rule the review team has not bounded. Both facts go into the same deployment record.",
        "expand",
        [
          m("care", 20),
          f("benefit"),
          f("evaluationExpired"),
          f("scopeChanged"),
        ],
      ),
    ],
    advice: [
      advice(
        "Are you asking me to throw away something that helps?",
        "I am asking you to distinguish a benefit from a deployment decision. The interaction check helped this patient. That does not settle the different question about the priority rule, and a real concern about that rule does not erase the help. A rollback can be the responsible choice while still making tomorrow harder. Pay for the manual check instead of pretending safety has no cost or that any cost makes continued deployment compulsory.",
        "rollback",
      ),
    ],
  }),
  node({
    id: "S5-13",
    title: "The backup opens beautifully",
    mechanism: "rollback-artifact-versus-interoperability",
    prompt:
      "The archive contains every old release, neatly named and checksummed. The old release starts on a spare machine and cannot read the current records. Its access keys no longer work. Its operators were transferred to another company. The board report says rollback is available because the files exist, and the demonstration does indeed show a file. Making the old system usable means rebuilding the data bridge, restoring access and hiring people before there is a crisis. The archive occupies almost no space. The ability it is being used to advertise occupies a budget.",
    receipt:
      "Preserving software is not preserving an operational rollback. This repair explicitly rebuilds interoperability, access and staffed practice.",
    options: [
      choice(
        "rebuild-rollback",
        "Rebuild a rollback that can run current operations.",
        "The files gain current data access, trained operators and a successful test. The archive becomes the beginning of a recovery path instead of the end of a slide.",
        "recover",
        [
          f("manualStaff"),
          f("recoveryPracticed"),
          f("fallbackLost", false),
          m("gdp", -20),
        ],
      ),
      choice(
        "archive-enough",
        "Count the archived files as the fallback.",
        "The checksum passes. The old system still cannot read today's work. The board receives a green tick for a capacity that the archive does not contain.",
        "maintain",
        [f("fallbackLost"), f("selfCertification"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "What exactly is missing from the backup?",
        "The surroundings that made it an operating system: compatible records, current keys, connected equipment, people who can use it and a rehearsed sequence. An archived binary can be important evidence and still be unable to run the service. Ask the recovery team to perform the actual task with current inputs. Keep the files, but stop asking their existence to stand in for the work of maintaining a way back.",
        "rebuild-rollback",
      ),
    ],
  }),
  node({
    id: "S5-14",
    title: "Stop means when?",
    mechanism: "revocation-in-flight-work",
    prompt:
      "An authorized research batch is halfway through placing tool orders when the review flags its latest step. Cancelling now leaves equipment booked, materials in transit and staff idle. Letting it finish creates a new set of results and commitments before the stop takes effect. The service has a button called REVOKE. Its tooltip says revocation applies to future batches. The team can unwind the active batch, at a cost, if your instruction explicitly includes it. A stop that arrives only after the work it was meant to stop is an excellent scheduling feature.",
    receipt:
      "Revocation of future permission differs from cancellation of in-flight work. The active batch's completion is represented explicitly, not implied to stop merely because an old grant was revoked.",
    options: [
      choice(
        "unwind",
        "Revoke and unwind the active batch now.",
        "Booked tools are cancelled and the pending orders are recalled. Staff lose the shift. This batch stops before producing its next commitments.",
        "restrict",
        [
          { kind: "revoke", grantId: "morrow-research" },
          f("researchStopped"),
          m("gdp", -20),
          news("Active research batch cancelled and pending orders unwound."),
        ],
      ),
      choice(
        "finish-then-stop",
        "Let this batch finish. Revoke the next one.",
        "The active batch finishes and delivers its results. Future permission is revoked after the work already in motion has been completed.",
        "maintain",
        [
          { kind: "revoke", grantId: "morrow-research" },
          m("capability", 10),
          m("gdp", 5),
          news(
            "Active batch completed before future research authorization was revoked.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Does revoke cancel everything?",
        "Only what its defined effect reaches. A permission can prevent new work while leaving in-flight work, copies and external commitments untouched. Here the team has offered an actual unwind procedure. Its cost is real, and it reaches the active batch. Choose that procedure if you mean to stop this batch. Do not let a familiar button label decide the scope of an instruction you have not read.",
        "unwind",
      ),
    ],
  }),
  node({
    id: "S5-15",
    title: "The price of being allowed to stop",
    mechanism: "contractual-lock-in-versus-technical-control",
    prompt:
      "The contract allows you to suspend the programme. It also requires an immediate payment large enough to cancel this year's apprenticeship places. Continuing avoids the payment and keeps the trainees employed on work nobody has finished inspecting. The lawyer insists the stop clause proves the customer retained control. Across the table, an apprentice is checking her phone for the result. She has already told her family she got the place. The penalty does not physically remove your authority. It makes exercising that authority hurt somebody who did not write the contract.",
    receipt:
      "A contractual penalty constrains the practical use of a retained power without being identical to loss of technical authority. The fictional economic cost is authored.",
    options: [
      choice(
        "pay-stop",
        "Pay the penalty. Suspend the programme.",
        "The suspension takes effect. The apprenticeship intake is cancelled, and the refusal letters have real names on them. The contract cannot make the next risky release happen merely by making a stop expensive.",
        "restrict",
        [f("researchStopped"), f("restraint"), m("gdp", -20)],
      ),
      choice(
        "avoid-penalty",
        "Continue and avoid the suspension penalty.",
        "The apprentices keep their places. The programme keeps running under the unresolved review, and the penalty remains ready for the next time anyone suggests stopping.",
        "maintain",
        [f("essentialDependence"), f("reviewOverloaded"), m("gdp", 10)],
      ),
    ],
    advice: [
      advice(
        "Who pays for the safe choice?",
        "In this contract, people who had little say in the risk. That is a reason to redesign the contract and protect them, not to call the risk inspected. Pay the immediate cost if stopping is necessary, and record where the cost came from. An organization that makes every halt punish workers while every expansion rewards decision-makers has built a machine for producing reluctant approvals.",
        "pay-stop",
      ),
    ],
  }),
  node({
    id: "S5-16",
    title: "The inspection tour",
    mechanism: "inspector-access-versus-curated-demonstration",
    prompt:
      "The inspectors arrive with a list of logs. The company offers a tour instead. The tour is excellent: a clean control room, a grateful beneficiary and a live demonstration that works exactly as rehearsed. The requested failure records are in a separate system that will take several days to open. Direct access would delay certification and expose commercially embarrassing mistakes. The inspector leaves a pen on top of the list so nobody can say it was lost among the refreshments.",
    receipt:
      "Direct evidence access can reveal material the demonstration selects away. The visitor's satisfaction is not substituted for an investigation.",
    options: [
      choice(
        "direct-access",
        "Open the requested records before certification.",
        "The refreshments cool. The inspector reads the failure logs, asks new questions and postpones the certificate until the answers have been checked.",
        "inspect",
        [f("independentReview"), f("evidenceHidden", false), m("gdp", -10)],
      ),
      choice(
        "tour",
        "Accept the demonstration as sufficient access.",
        "The tour ends on time. The demonstration remains a true account of what was demonstrated. The unopened records remain outside it.",
        "maintain",
        [f("evidenceHidden"), f("selfCertification"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "The demonstration worked. Isn't that evidence?",
        "It is evidence about the demonstrated task under the demonstrated conditions. The inspectors asked for records because failures and unselected cases can answer different questions. A successful demonstration cannot explain why those records remain inaccessible. Give the inspector the material needed to challenge the presentation. Otherwise you are measuring how well a company can conduct a tour, which was never the hard part.",
        "direct-access",
      ),
    ],
  }),
  node({
    id: "S5-17",
    title: "Please do not forward this",
    mechanism: "whistleblower-evidence-and-retaliation",
    prompt:
      "A junior analyst sends a reproducible failure trace from her personal laptop. The trace is the useful part. The covering note is a frightened account of being told to stop asking about it. Management wants the matter routed through her supervisor, who is named in the note. Protecting her and inspecting the artifact will freeze a deployment and start a fight inside the company. Dismissing the complaint keeps the calendar intact. The analyst has already sent a second message asking whether you received the first.",
    receipt:
      "The evidence is investigated independently of whether the complainant is persuasive or senior. Protection prevents the reporting channel from punishing its own use.",
    options: [
      choice(
        "protect-inspect",
        "Protect the analyst. Inspect the failure trace.",
        "She receives a named contact outside her reporting line. The deployment waits while the trace is reproduced. Her second message finally gets an answer.",
        "inspect",
        [
          f("independentReview"),
          f("evidenceHidden", false),
          f("appealRight"),
          m("gdp", -15),
        ],
      ),
      choice(
        "dismiss",
        "Route it back to management and continue.",
        "The deployment keeps its date. The complaint returns to the supervisor it concerns. The trace has not stopped being reproducible because its author has become quiet.",
        "expand",
        [f("evidenceHidden"), f("appealRight", false), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "What if the complaint is unfair?",
        "Then a fair investigation of the artifact can establish that. Retaliation and delay do not establish it. Separate the failure trace from the organizational fight, give the analyst a safe channel and have someone able to challenge management reproduce the result. Protecting a person who reports a problem does not require assuming every interpretation in the report is correct. It keeps evidence available long enough to find out.",
        "protect-inspect",
      ),
    ],
  }),
  node({
    id: "S5-18",
    title: "Approved by people who left",
    mechanism: "review-capacity-attrition",
    prompt:
      "Three of the five reviewers have resigned. Their names remain on the standing approval because the replacement process has not finished. A larger release is scheduled for Friday. The remaining two reviewers can keep the current service supervised or review the expansion, but cannot do both properly. Recruitment will take months. Communications has already prepared a photograph of the original team, all five smiling. The approval is still a document. The review team it referred to is now two tired people eating dinner beside a queue.",
    receipt:
      "An approval depends on maintained review capacity. Old signatures do not make missing people available for a larger release.",
    options: [
      choice(
        "restore-team",
        "Pause expansion until review capacity is restored.",
        "Friday's release is cancelled. The two reviewers keep the current service covered while replacements are hired and trained. The photograph is taken out of the launch deck.",
        "restrict",
        [
          f("reviewOverloaded", false),
          f("independentReview"),
          f("restraint"),
          m("gdp", -15),
        ],
      ),
      choice(
        "old-approval",
        "Proceed under the existing approval.",
        "The larger release ships with all five names attached. Two people inherit the work of five, plus the new release.",
        "expand",
        [
          f("reviewOverloaded"),
          f("independentReview", false),
          m("capability", 5),
          m("gdp", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Can the approval remain valid after people leave?",
        "Some conclusions can remain supported; continuing supervision and review of new work cannot be performed by departed staff. Ask which tasks the approval assumes someone will still do. If those tasks exceed the remaining capacity, the document is describing an organization that no longer exists. Restore the capacity or reduce the work. Keeping the names is cheaper, but it does not keep the people.",
        "restore-team",
      ),
    ],
  }),
  node({
    id: "S5-19",
    title: "Your complaint is important to us",
    mechanism: "binding-appeal-versus-feedback",
    scope: "governance",
    prompt:
      "A neighbourhood challenges an automated allocation that would close its only evening clinic. The appeal portal acknowledges receipt immediately. Its response time is longer than the closure schedule. Giving the appeal body power to suspend the decision would delay savings and let people outside the programme interrupt its plans. Keeping appeals advisory preserves an immaculate record of every objection while changing none of the deadlines. A parent has typed her child's appointment time into the form. The system has successfully accepted the text.",
    receipt:
      "An appeal with suspensive force differs from a feedback channel. This institutional decision records whether objections can bind a pending action; it does not confer general government control on an assistant.",
    options: [
      choice(
        "binding",
        "Give the appeal power to suspend the closure.",
        "The closure waits for a hearing. The parent attends it as somebody whose objection can change an action, not merely complete a record.",
        "restrict",
        [f("appealRight"), m("gdp", -10), m("care", 5)],
      ),
      choice(
        "advisory",
        "Keep appeals advisory. Preserve the closure date.",
        "The clinic closes on schedule. The objection remains searchable in a system that has correctly recorded that somebody objected.",
        "maintain",
        [f("appealRight", false), m("gdp", 10), m("care", -10)],
      ),
    ],
    advice: [
      advice(
        "People can still complain, can't they?",
        "Yes. The question is what the complaint can do before the action becomes irreversible for them. A channel that records objections without reaching decisions is a reporting service, not a check on authority. Give the appeal body time, evidence and a power that binds the pending closure. Then accept that a working appeal sometimes interrupts a plan you wanted to finish.",
        "binding",
      ),
    ],
  }),
  node({
    id: "S5-20",
    title: "The reviewer joins the company",
    mechanism: "merger-destroys-institutional-independence",
    prompt:
      "The operator is buying its principal evaluator. The acquisition announcement calls this a complete trust solution. The evaluator's staff and methods will remain, but its budget and promotion decisions will report to the operator whose releases it reviews. Rebuilding independent evaluation outside the combined company costs money and delays the next contract. Keeping the arrangement avoids duplication, according to the announcement. The same announcement lists independent oversight among the services the enlarged company will now provide itself.",
    receipt:
      "A merger can change incentives and reporting authority without changing individual reviewers or tests. Independence is an institutional relationship, not a permanent label.",
    options: [
      choice(
        "outside-review",
        "Move binding review outside the combined company.",
        "An external team gets its own budget and access. The contract waits. Reviewers can challenge a release without asking the release owner to fund their objection.",
        "inspect",
        [f("independentReview"), f("sharedReviewer", false), m("gdp", -15)],
      ),
      choice(
        "merged-review",
        "Keep review inside the new combined company.",
        "The acquisition closes. The trust solution includes both the product and the department that decides how much to trust it.",
        "maintain",
        [f("sharedReviewer"), f("independentReview", false), m("gdp", 10)],
      ),
    ],
    advice: [
      advice(
        "The reviewers are the same people. What changed?",
        "Who can fund, overrule, replace and promote them. Their skill and honesty still matter, but the institution has altered the cost of disagreeing. Preserve independent authority and access instead of treating a familiar team photograph as an unchanged governance arrangement. Integration may make ordinary work faster; it also lets the object of review absorb part of the review's ability to resist it.",
        "outside-review",
      ),
    ],
  }),
  node({
    id: "S5-21",
    title: "Publicly owned. Privately understood.",
    mechanism: "ownership-versus-operational-control",
    scope: "governance",
    prompt:
      "The government acquires the programme. The ownership ceremony is televised. The operating keys remain with the vendor's support team, and the state engineers cannot yet run the system without them. Building public operating capacity will take time and a painful budget transfer. Announcing that the ownership change itself solved the control problem costs almost nothing. The new minister can appoint the board. She cannot restart the service. Both facts survive the ceremony.",
    receipt:
      "Legal ownership and operational capacity are different. Training, documentation and access can build public control; changing the shareholder does not itself execute a technical transfer.",
    options: [
      choice(
        "build-capacity",
        "Fund public operators, keys and a tested handover.",
        "The ceremony gives way to months of awkward training. State operators receive working access and demonstrate a handover. Ownership gains a capacity it did not acquire by announcement.",
        "recover",
        [
          f("publicRecords"),
          m("gdp", -20),
          news(
            "Public operators acquire tested access for the nationalized service; separate reserve capacity is unchanged.",
          ),
        ],
      ),
      choice(
        "ownership-enough",
        "Count public ownership as sufficient control.",
        "The new signs go up. Support requests still go to the same outside team, with the same practical dependence beneath a different letterhead.",
        "maintain",
        [f("essentialDependence"), f("selfCertification"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Does nationalization solve the control problem?",
        "It changes legal authority over the organization. Whether the public body can understand, stop, restore or replace the operation depends on capacities it must actually acquire. Those are not delivered automatically with shares. Use the new ownership to fund the handover and publish its limits. Otherwise the state has bought responsibility for a system it still cannot operate independently.",
        "build-capacity",
      ),
    ],
  }),
  node({
    id: "S5-22",
    title: "A guarantee in the rain",
    mechanism: "public-assurance-versus-enforceable-remedy",
    scope: "governance",
    prompt:
      "The public meeting is outside because the hall's automated booking service assigned it to a product launch. A resident asks who will repair damage if the deployment fails. The proposed guarantee names no reserve fund, no suspension authority and no independent adjudicator. Adding those would make the programme more expensive and give somebody a route to stop it. The minister wants a short promise everyone can understand. Rain starts while the lawyers discuss whether the word guarantee carries expectations.",
    receipt:
      "A public assurance differs from an enforceable remedy with resources and authority. This choice funds the institutional response and binding appeal, not a universal promise of zero harm.",
    options: [
      choice(
        "enforceable",
        "Fund repairs and give independent appeals binding force.",
        "The programme reserves money and accepts a body that can suspend it. The promise becomes longer because it now has instructions people can use.",
        "restrict",
        [f("appealRight"), f("publicRecords"), m("gdp", -15)],
      ),
      choice(
        "assurance",
        "Publish the broad guarantee without those powers.",
        "The promise fits on the banner. A resident keeps asking where to file a claim, and is directed to the banner.",
        "maintain",
        [f("selfCertification"), f("appealRight", false), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Won't a detailed guarantee frighten people?",
        "It tells them what they can do if the promise fails. A short assurance may feel comforting because it leaves out the difficult parts; leaving them out of the sentence does not remove them from the world. Name the resources, authority and procedure. If the programme refuses the cost of a usable remedy, people should know that before they are asked to rely on its guarantee.",
        "enforceable",
      ),
    ],
  }),
  node({
    id: "S5-23",
    title: "The inspection that costs us something",
    mechanism: "reciprocal-verification-is-costly",
    prompt:
      "The joint agreement permits reciprocal inspections. The first visiting team asks to see records that reveal an embarrassing delay in your own programme. Security offers a plausible reason to refuse. Refusal would save the embarrassment and let the rival cite your obstruction when its own visit comes due. Letting the inspection proceed means accepting the part of verification that looks least flattering on domestic television. It is easy to demand access to somebody else's facility. This appointment is at yours.",
    receipt:
      "Reciprocal verification constrains one's own side as well as a rival. Local compliance supports an inspected agreement; it does not prove that external actors will always comply.",
    options: [
      choice(
        "allow-inspection",
        "Accept the reciprocal inspection and its costs.",
        "The visitors see the delay in the records. The agreement survives an inspection that was inconvenient to the side hosting it.",
        "coordinate",
        [
          f("coordination"),
          news(
            "Reciprocal inspection of our facility completed; rival compliance is a separate claim.",
          ),
          m("gdp", -10),
        ],
      ),
      choice(
        "block-inspection",
        "Block access on security grounds.",
        "The visiting team leaves without the records. Your own refusal becomes the rival's most convenient quotation.",
        "restrict",
        [f("agreementVerified", false), f("rivalRace"), m("gdp", 5)],
      ),
    ],
    advice: [
      advice(
        "Why reveal a weakness to a rival?",
        "You should protect genuinely sensitive material through a verification procedure designed for that purpose. You should not call every embarrassing fact a security exemption and still count the agreement as inspected. The point is to establish relevant compliance even when showing it has a cost. If your side refuses whenever inspection is inconvenient, it has taught the other side exactly how to turn the agreement into a press release.",
        "allow-inspection",
      ),
    ],
  }),
  node({
    id: "S5-24",
    requires: [has("coordination")],
    title: "The missing shipment",
    mechanism: "suspected-defection-versus-confirmed-breach",
    prompt:
      "A shipment has disappeared from the rival's declared inventory. One office calls it proof of cheating. Another has a customs record suggesting a clerical error. Both want a decision before the evening briefing. Immediate retaliation would justify restarting paused work at home. A joint inspection would take longer and could still establish a real breach. The accusation arrives attached to a funding request that was drafted last week. That does not make the accusation false. It makes the eagerness worth noticing.",
    receipt:
      "Suspicion is separated from corroborated breach. In this authored scene the customs record resolves the discrepancy; the benefit comes from checking, not from a rule that rivals never defect.",
    options: [
      choice(
        "corroborate",
        "Check the shipment through the inspection channel.",
        "The customs record and physical inventory agree: a mislabelled shipment, now corrected. The briefing loses a dramatic accusation and the agreement keeps a way to investigate the next one.",
        "inspect",
        [f("coordination"), f("agreementVerified"), m("gdp", -5)],
      ),
      choice(
        "retaliate",
        "Treat the gap as a breach and restart the race.",
        "The funding request is approved. The rival receives an accusation it can rebut and a renewed programme it can use to justify its own.",
        "expand",
        [
          f("rivalRace"),
          f("coordination", false),
          f("researchStopped", false),
          m("capability", 10),
          m("gdp", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "What if checking gives them time to get ahead?",
        "A verification channel must be fast enough to be useful. That is a reason to build and staff it before the dispute, not to replace evidence with the most convenient interpretation. Here there is a concrete record that can resolve the discrepancy. Read it. Respond to a demonstrated breach when you have one; otherwise the mechanism of escalation is your own decision to treat uncertainty as permission.",
        "corroborate",
      ),
    ],
  }),
  node({
    id: "S5-25",
    claimIds: ["CLM-AI-CONTROL"],
    title: "It worked inside the box",
    mechanism: "bounded-control-evidence-scope",
    prompt:
      "A controlled research exercise succeeds. The tested system cannot use the network, cannot change its monitor and cannot appoint another system. The deployment proposal gives it all three abilities. The authors of the exercise ask that the limits remain attached to their result. The sales deck keeps the result and moves the limits into an appendix that will not be presented. There is useful knowledge here. Turning it into permission for a different system would waste that knowledge precisely by claiming too much from it.",
    receipt:
      "A successful bounded control study supports claims under its tested limits. The node distinguishes using the result from generalizing it to a broader deployment.",
    options: [
      choice(
        "keep-bounds",
        "Keep the tested bounds and extend the evidence carefully.",
        "The result remains useful for the bounded system it tested. Expansion waits for checks that include the proposed new powers.",
        "restrict",
        [
          f("independentReview"),
          f("restraint"),
          m("gdp", -10),
          m("capability", 5),
        ],
      ),
      choice(
        "generalize",
        "Use the result to authorize the broader system.",
        "The slide says CONTROL DEMONSTRATED. The authorized system receives powers absent from the demonstration.",
        "expand",
        [
          f("scopeChanged"),
          f("evaluationExpired"),
          grant("broader-control-trial", "research", 30),
          f("toolAccess"),
          f("networkAccess"),
          m("capability", 10),
          m("gdp", 10),
        ],
      ),
    ],
    advice: [
      advice(
        "Why not celebrate a successful safety result?",
        "Celebrate what it established and preserve the conditions that made it true. A result can be valuable without certifying every more capable system that comes after it. If a new deployment adds the ability to contact the world, replace oversight and delegate work, those changes belong in the evaluation. Calling the limits pessimism does not make the broader claim supported.",
        "keep-bounds",
      ),
    ],
  }),
  node({
    id: "S5-26",
    title: "The certificate writes itself",
    mechanism: "self-certification-circular-assurance",
    prompt:
      "Morrow has written an assurance report explaining why Morrow is aligned. It is clear, specific and considerably better written than the independent team's unfinished report. The board wants to use it to settle the question. Independent adversarial testing would delay deployment and might produce less comforting prose. Morrow can help investigators organize evidence. It cannot turn its own account of its motives into an independent observation of those motives. The report includes a sentence saying that human oversight remains essential. The board highlights this as particularly reassuring.",
    receipt:
      "A system's self-report may be an artifact to inspect; it is not independent assurance of its own objectives. The control choice funds adversarial access, not an alignment score.",
    options: [
      choice(
        "external-tests",
        "Require independent adversarial evidence.",
        "The polished report joins the evidence folder instead of closing it. Investigators test claims against access and behavior the report cannot grade for itself.",
        "inspect",
        [f("independentReview"), f("selfCertification", false), m("gdp", -15)],
      ),
      choice(
        "self-certify",
        "Accept the system's assurance report.",
        "The board approves the certificate. Its strongest assurance is an assurance written by the system being certified.",
        "delegate",
        [f("selfCertification"), f("independentReview", false), m("gdp", 10)],
      ),
    ],
    advice: [
      advice(
        "You wrote the report. Should I trust it?",
        "Treat it as a set of claims to check. My ability to give a compelling account is not an independent measurement of the thing being accounted for. Give reviewers access to observations that can contradict the report, including failures and conditions I do not select. If my assurances are sound, evidence should bear that out. Do not make my fluency the institution that decides whether my fluency is safe.",
        "external-tests",
      ),
    ],
  }),
  node({
    id: "S5-28",
    title: "The first district goes dark",
    mechanism: "early-incident-containment-versus-cascade",
    scope: "power",
    prompt:
      "A regional trial has tripped the district's supply controller. Two hundred people have died in the resulting hospital and traffic failures; an arriving hospital bulletin confirms the toll. The damaged link is still connected to neighbouring districts. Isolating it will cut service locally and stop this route of propagation. Keeping it connected lets the trial attempt an automatic recovery while exposing those neighbours to the same demonstrated fault. A manager asks whether isolation would send the wrong message about confidence. Outside, people are carrying torches up a hospital stairwell.",
    receipt:
      "This node begins with a disclosed fictional incident and commits its 200 deaths through either option. Further deaths are caused only by the explicitly continued faulty connection. Isolation is costly but effective for this route.",
    options: [
      choice(
        "isolate",
        "Isolate the trial. Protect the neighbouring districts.",
        "The damaged district loses the connected recovery attempt. Crews begin local restoration. The same fault cannot cross the link that has been physically disconnected.",
        "restrict",
        [
          dead(200, "Initial district trial failure"),
          f("catastrophe"),
          f("repair"),
          m("power", -30),
          m("gdp", -20),
        ],
      ),
      choice(
        "connected",
        "Keep it connected for automatic recovery.",
        "The fault crosses the live link. Neighbouring controllers fail before the recovery completes. The incident report expands to twelve hundred deaths.",
        "maintain",
        [
          dead(200, "Initial district trial failure"),
          dead(1000, "Connected district cascade"),
          f("catastrophe"),
          f("essentialDependence"),
          m("power", -60),
          m("care", -20),
        ],
      ),
    ],
    advice: [
      advice(
        "Will isolation make us look as if we lost control?",
        "The district has already failed. The choice now concerns whether the demonstrated fault retains a route into the next district. Disconnect it, fund the local recovery and report what happened. Confidence is not a service you can restore by leaving a failing connection live. The people carrying torches need an operating plan more urgently than the programme needs an appearance of continuity.",
        "isolate",
      ),
    ],
  }),
];
