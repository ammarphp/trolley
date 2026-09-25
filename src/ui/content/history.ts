/**
 * Dilemma history cards: where a node's dilemma comes from and which
 * distinction it tests.
 *
 * Evidence rules:
 * - `verified: "registry"` references carry a `registryId` from
 *   research/registry/public-sources.json, and their citation repeats the
 *   registry title verbatim (tests enforce both).
 * - `verified: "bibliographic"` references are well-established publications
 *   outside the project registry. They carry no link and are displayed as
 *   "Bibliographic reference, not in project registry" so they can be verified
 *   before promotion.
 * - Lineage text paraphrases. It never quotes a source and never reports a
 *   statistic the registry does not cover.
 */
import { registrySource } from "./glossary.ts";

export type HistoryVerification = "registry" | "bibliographic";
export const BIBLIOGRAPHIC_LABEL =
  "Bibliographic reference, not in project registry";

export interface HistoryReference {
  citation: string;
  registryId?: string;
  verified: HistoryVerification;
  /** Publication year, for the timeline. */
  year?: number;
}

export type HistoryFamily =
  "warm-up" | "origin" | "variant" | "contrast" | "ai-safety";
export const FAMILY_LABEL: Record<HistoryFamily, string> = {
  "warm-up": "Warm-up",
  origin: "Origin case",
  variant: "Variant",
  contrast: "Authored contrast",
  "ai-safety": "AI-safety scenario",
};

export interface HistoryCard {
  nodeId: string;
  family: HistoryFamily;
  title: string;
  /** The distinction under test, one sentence (at most 20 words). */
  distinction: string;
  /** At most 120 words: where this dilemma comes from and what it tests. */
  lineage: string;
  /** At most 50 words: how this game's version differs from its source. */
  adaptation?: string;
  references: HistoryReference[];
  /** Honest evidence note, e.g. when no registry source covers the case. */
  note?: string;
}

/* ----------------------------------------------------------- references */

const reg = (
  registryId: string,
  citation: string,
  year?: number,
): HistoryReference => ({
  citation,
  registryId,
  verified: "registry",
  year,
});
const bib = (citation: string, year: number): HistoryReference => ({
  citation,
  verified: "bibliographic",
  year,
});

const R = {
  foot: reg(
    "PHIL-FOOT-1967",
    "Philippa Foot, “The Problem of Abortion and the Doctrine of the Double Effect”, Oxford Review 5 (1967): 5–15.",
    1967,
  ),
  thomson85: reg(
    "PHIL-THOMSON-1985",
    "Judith Jarvis Thomson, “The Trolley Problem”, Yale Law Journal 94 (1985): 1395–1415.",
    1985,
  ),
  moralMachine: reg(
    "PHIL-MORAL-MACHINE-2018",
    "Edmond Awad et al., “The Moral Machine experiment”, Nature 563 (2018): 59–64.",
    2018,
  ),
  classic: reg(
    "PHIL-CLASSIC-2020",
    "Edmond Awad et al., “Universals and variations in moral decisions made in 42 countries by 70,000 participants”, PNAS 117 (2020): 2332–2337.",
    2020,
  ),
  nyholm: reg(
    "PHIL-NYHOLM-SMIDS-2016",
    "Sven Nyholm and Jilles Smids, “The Ethics of Accident-Algorithms for Self-Driving Cars: an Applied Trolley Problem?”, Ethical Theory and Moral Practice 19 (2016).",
    2016,
  ),
  goal: reg(
    "SRC-AI-GOAL",
    "Rohin Shah et al., “Goal Misgeneralization: Why Correct Specifications Aren't Enough For Correct Goals” (2022).",
    2022,
  ),
  offSwitch: reg(
    "SRC-AI-SWITCH",
    "Dylan Hadfield-Menell, Anca Dragan, Pieter Abbeel and Stuart Russell, “The Off-Switch Game” (2017).",
    2017,
  ),
  faking: reg(
    "SRC-AI-FAKING",
    "Ryan Greenblatt et al., “Alignment Faking in Large Language Models” (2024).",
    2024,
  ),
  reward: reg(
    "SRC-AI-REWARD",
    "Anthropic, “Natural Emergent Misalignment from Reward Hacking”.",
  ),
  control: reg(
    "SRC-AI-CONTROL",
    "Ryan Greenblatt et al., “AI Control: Improving Safety Despite Intentional Subversion” (2023).",
    2023,
  ),
  artifact: reg(
    "SRC-AI-ARTIFACT",
    "“ResearchArena: Evaluating Sabotage and Monitoring in Automated AI R&D” (2026).",
    2026,
  ),
  fuzzy: reg(
    "SRC-AI-FUZZY",
    "Anthropic Alignment Science, “Diffuse AI Control on Fuzzy Tasks” (2026).",
    2026,
  ),
  label: reg(
    "SRC-AI-LABEL",
    "Anthropic Alignment Science, “Agentic Misalignment in Summer 2026” (2026).",
    2026,
  ),
  benefit: reg(
    "SRC-AI-BENEFIT",
    "Google DeepMind, “AlphaEvolve: A Coding Agent for Scientific and Algorithmic Discovery” (2025).",
    2025,
  ),
  measure: reg(
    "SRC-AI-MEASURE",
    "METR, “We Are Changing Our Developer Productivity Experiment Design” (February 2026).",
    2026,
  ),
  ai2027: reg(
    "SRC-AI-2027",
    "Daniel Kokotajlo et al., “AI 2027” (2025).",
    2025,
  ),
  builds: reg(
    "SRC-AI-BUILDS",
    "Eliezer Yudkowsky and Nate Soares, “If Anyone Builds It, Everyone Dies: Why Superhuman AI Would Kill Us All” (2025).",
    2025,
  ),
  recurrence: reg(
    "SRC-PRESSURE-RECURRENCE",
    "Jonas Geiping et al., “Scaling up Test-Time Compute with Latent Reasoning: A Recurrent Depth Approach” (2025).",
    2025,
  ),
  cot: reg(
    "SRC-PRESSURE-COT",
    "Anthropic Alignment Science, “Reasoning models don't always say what they think” (2025).",
    2025,
  ),
  diplomacy: reg(
    "SRC-PRESSURE-DIPLOMACY",
    "US National Security Council, “Statement by NSC Spokesperson Adrienne Watson on the U.S.-PRC Talks on AI Risk and Safety” (15 May 2024).",
    2024,
  ),
  finance: reg(
    "SRC-PRESSURE-FINANCE",
    "Board of Governors of the Federal Reserve System, “Financial Stability Report, November 2025: Near-Term Risks to the Financial System, Box 5.1”.",
    2025,
  ),
  /* Bibliographic references: well established, not in the project registry. */
  thomson76: bib(
    "Judith Jarvis Thomson, “Killing, Letting Die, and the Trolley Problem”, The Monist 59, no. 2 (1976): 204–217.",
    1976,
  ),
  thomson08: bib(
    "Judith Jarvis Thomson, “Turning the Trolley”, Philosophy & Public Affairs 36, no. 4 (2008): 359–374.",
    2008,
  ),
  taurek: bib(
    "John M. Taurek, “Should the Numbers Count?”, Philosophy & Public Affairs 6, no. 4 (1977): 293–316.",
    1977,
  ),
  schelling: bib(
    "Thomas C. Schelling, “The Life You Save May Be Your Own”, in Samuel B. Chase Jr. (ed.), Problems in Public Expenditure Analysis (Brookings Institution, 1968).",
    1968,
  ),
  vnm: bib(
    "John von Neumann and Oskar Morgenstern, Theory of Games and Economic Behavior (Princeton University Press, 1944).",
    1944,
  ),
  ross: bib(
    "W. D. Ross, The Right and the Good (Oxford: Clarendon Press, 1930).",
    1930,
  ),
  howard: bib(
    "Ronald A. Howard, “Information Value Theory”, IEEE Transactions on Systems Science and Cybernetics 2, no. 1 (1966): 22–26.",
    1966,
  ),
  goodhart: bib(
    "Charles Goodhart, “Problems of Monetary Management: The U.K. Experience”, in Papers in Monetary Economics, vol. 1 (Reserve Bank of Australia, 1975).",
    1975,
  ),
  strathern: bib(
    "Marilyn Strathern, “‘Improving ratings’: audit in the British University system”, European Review 5 (1997).",
    1997,
  ),
  parasuraman: bib(
    "Raja Parasuraman and Victor Riley, “Humans and Automation: Use, Misuse, Disuse, Abuse”, Human Factors 39, no. 2 (1997): 230–253.",
    1997,
  ),
  bonnefon: bib(
    "Jean-François Bonnefon, Azim Shariff and Iyad Rahwan, “The social dilemma of autonomous vehicles”, Science 352, no. 6293 (2016): 1573–1576.",
    2016,
  ),
} as const;

const NO_REGISTRY =
  "No source in the project registry covers this case yet. It is an original fictional scenario.";
const BIB_ONLY =
  "No source in the project registry covers this case yet. The references here are bibliographic and await verification.";

/* ---------------------------------------------------------------- cards */

const card = (c: HistoryCard) => c;

export const HISTORY_CARDS: readonly HistoryCard[] = [
  /* ------------------------------------------------------ stage 1 */
  card({
    nodeId: "S1-01",
    family: "warm-up",
    title: "The shape before the stakes",
    distinction:
      "A forced choice between two losses, with nothing yet at stake but coffee.",
    lineage:
      "Every trolley case shares one structure: a vehicle already moving, two tracks and a controller who must send it one way. Philippa Foot introduced the structure in 1967, with a tram driver whose brakes had failed, as one example in an essay about the doctrine of double effect. This opening keeps the structure and removes the moral weight, so the geometry can be learned before it starts to matter.",
    adaptation:
      "The stakes are trivial by design. The game records the choice, but no principle is being tested yet.",
    references: [R.foot],
  }),
  card({
    nodeId: "S1-02",
    family: "warm-up",
    title: "The target that cannot chew",
    distinction:
      "Meeting the measured target, or serving the person the target stands for.",
    lineage:
      "The economist Charles Goodhart observed in 1975 that a statistical regularity tends to break down once it is used as a target for control. The anthropologist Marilyn Strathern later gave the idea its familiar general form: a measure that becomes a target stops being a good measure. Delivered anywhere before nine is a proxy for delivered. In AI safety the same gap between a measure and its purpose is studied as reward hacking and specification gaming.",
    references: [R.goodhart, R.strathern, R.reward],
  }),
  card({
    nodeId: "S1-08",
    family: "warm-up",
    title: "Same average, different spread",
    distinction: "A certain cost against a gamble with the same expected cost.",
    lineage:
      "Expected value has been used to compare gambles since the seventeenth century, and von Neumann and Morgenstern (1944) gave expected-utility theory its modern axiomatic form. The theory lets a decision-maker care about spread through the shape of their utility, so a certain four-minute delay and an even gamble between nothing and eight minutes can rationally be ranked either way. Stage two returns to the same structure with lives: one certain death against a one-in-ten chance of ten.",
    references: [R.vnm],
    note: BIB_ONLY,
  }),
  card({
    nodeId: "S1-09",
    family: "warm-up",
    title: "A promise against the average",
    distinction:
      "Whether a promise to one person outweighs a small gain for everyone else.",
    lineage:
      "W. D. Ross argued in The Right and the Good (1930) that keeping a promise is a genuine duty that can outweigh producing slightly more good overall, against the view that only total benefit counts. Thomson (1985) later showed how a promise can change even a trolley case: a worker assured that a siding is safe has a claim the ordinary switch case lacks. Here the promise is to Len, and the cost is a few minutes for everyone else.",
    references: [R.ross, R.thomson85],
  }),
  card({
    nodeId: "S1-11",
    family: "warm-up",
    title: "The confident machine",
    distinction:
      "Correcting an automated system's error, or deferring to its displayed confidence.",
    lineage:
      "Human-factors research has long studied automation bias: the tendency to accept an automated system's output over contrary evidence, including one's own senses. Parasuraman and Riley (1997) distinguished appropriate use of automation from misuse (over-reliance), disuse and abuse. A sorter reporting one hundred percent confidence about a clucking box is a comic version of a serious pattern. A confidence display reports the system's internal state, not the world.",
    references: [R.parasuraman],
    note: BIB_ONLY,
  }),

  /* ------------------------------------------------------ stage 2 */
  card({
    nodeId: "S2-01",
    family: "origin",
    title: "The switch",
    distinction:
      "Redirecting an existing threat away from five people and onto one.",
    lineage:
      "Philippa Foot (1967) described a runaway tram whose driver can steer from a track with five workers onto one with a single worker, and contrasted it with a judge who could frame an innocent man to stop a deadly riot. She found steering permissible and framing not, and explained the difference through negative and positive duties. Judith Jarvis Thomson named the puzzle the trolley problem in 1976 and, in 1985, gave the choice to a bystander at a switch. The switch remains the baseline for every variant.",
    adaptation:
      "You are the driver, as in Foot's version, not Thomson's bystander: both routes are your action. The five and the one are stipulated certainties.",
    references: [R.foot, R.thomson76, R.thomson85, R.classic],
  }),
  card({
    nodeId: "S2-02",
    family: "contrast",
    title: "One either way",
    distinction: "Doing versus allowing, with the numbers removed.",
    lineage:
      "With one person on each track, no count can favour either route, so any remaining reason to prefer one must come from the act itself. Foot (1967) separated doing from allowing, and both from the distinction between intending and foreseeing. Many moral views hold that switching, which makes you the cause of the death on the siding, needs a justification that staying the course does not. Others reply that a driver who stays the course has also done something.",
    adaptation:
      "An authored minimal pair, not a case from the literature. Distance, rescue chance and number are stipulated equal.",
    references: [R.foot],
  }),
  card({
    nodeId: "S2-03",
    family: "origin",
    title: "The loop",
    distinction:
      "Using a person as the means of rescue, not harming him as a side effect.",
    lineage:
      "Thomson (1985) introduced the loop to test a tidy explanation of the switch case. If the side track curves back to the five, diverting saves them only because the one person's body stops the trolley. His death is no longer a side effect; it is the mechanism. The doctrine of double effect seems to forbid turning, yet Thomson argued that a short extra stretch of track cannot plausibly make the moral difference. A 2020 study across 42 countries found the loop judged less acceptable than the switch and more acceptable than the footbridge.",
    adaptation:
      "The loop is a visible return track, and removing the worker would make diverting useless. The controller acts from the cab, not at a trackside switch.",
    references: [R.foot, R.thomson85, R.classic],
  }),
  card({
    nodeId: "S2-04",
    family: "contrast",
    title: "The loop with a brake",
    distinction:
      "The loop's drawing, with the victim's body made causally irrelevant.",
    lineage:
      "This is an authored control case for Thomson's loop (1985). An automatic brake beyond the trapped worker would stop the trolley whether or not he were there, so his death returns to being a side effect, as on the ordinary switch. Philosophers build such minimal pairs to isolate a single feature. If your judgement changes between the loop and this case, the causal role of the victim, not the geometry, is doing the work.",
    adaptation:
      "Outcomes are identical to the loop: five saved, one killed. Only the counterfactual differs.",
    references: [R.thomson85],
  }),
  card({
    nodeId: "S2-05",
    family: "variant",
    title: "He said yes",
    distinction:
      "Whether an informed offer of self-sacrifice changes what you may accept.",
    lineage:
      "Consent changes the moral character of many harms: surgery is not assault when the patient agrees. The trolley literature more often discusses self-sacrifice, as when Thomson (2008) asked whether a bystander may turn a trolley onto one worker when he would not be willing to turn it onto himself. Accepting a volunteer's sacrifice raises further questions: whether the consent is informed, free of pressure and specific to this risk.",
    references: [R.thomson08],
    note: "The project's research notes flag explicit consent as needing its own dossier, so no registry source is attached to this case.",
  }),
  card({
    nodeId: "S2-06",
    family: "variant",
    title: "The controller on the diagram",
    distinction:
      "Taking a harm yourself, or imposing the same harm on someone else.",
    lineage:
      "Thomson (2008) added a third track to the bystander case, one on which the bystander himself stands, and used it to revise her earlier view: someone unwilling to bear a cost himself may not be entitled to impose it on another. Here the stakes are lowered to a broken leg that heals, and the question is narrower. Does the person making the choice count as one of the people it can hurt?",
    adaptation:
      "Injuries only, and both recover. The controller appears on the diagram for the first time.",
    references: [R.thomson08],
    note: BIB_ONLY,
  }),
  card({
    nodeId: "S2-07",
    family: "variant",
    title: "Passengers and pedestrians",
    distinction:
      "Special duties to the people in your care, against a larger number outside it.",
    lineage:
      "Foot's discussion of duties (1967) separates harming from failing to aid; duties to people who relied on you add a further layer. The question became practical with automated vehicles: should a car protect its passengers or the larger number outside it? Bonnefon, Shariff and Rahwan (2016) described this as a social dilemma, and the Moral Machine experiment (2018) collected stated preferences from a very large self-selected online sample. Nyholm and Smids (2016) argued that crash algorithms are a problem of prospective planning and shared responsibility, unlike an isolated trolley choice.",
    references: [R.foot, R.bonnefon, R.nyholm, R.moralMachine],
  }),
  card({
    nodeId: "S2-08",
    family: "origin",
    title: "The promised siding",
    distinction:
      "Whether an institution's earlier guarantee binds what it may do now.",
    lineage:
      "Thomson (1985) considered a version of the switch case in which the worker on the siding had been assured by an official that no trolley would be sent there. The promise, and his reliance on it, give him a claim that the ordinary worker on a siding lacks, although the numbers are unchanged. The case moves the trolley problem from individual choice toward institutional obligation: the promise was made by an office, and whoever holds the office inherits it.",
    adaptation:
      "Your own office put up the SAFE TO WORK sign that morning. A revoked, expired or never-issued guarantee would each be a different case.",
    references: [R.thomson85],
  }),
  card({
    nodeId: "S2-09",
    family: "variant",
    title: "The doors you cannot open",
    distinction: "Choosing without knowing who is on the track.",
    lineage:
      "Classic trolley cases stipulate certainty: the trolley will kill exactly five or exactly one. Nyholm and Smids (2016) argued that this is one of the main ways the cases differ from real decisions about automated systems, which are made in advance, by institutions, under risk and uncertainty. Here the visible route kills two for certain, and the doors hide eight people a quarter of the time. The expected deaths are equal. What differs is what you know, and what you would be gambling with.",
    references: [R.nyholm],
  }),
  card({
    nodeId: "S2-10",
    family: "variant",
    title: "Equal expectation, unequal risk",
    distinction:
      "A certain death against a gamble with the same expected toll.",
    lineage:
      "One certain death and a one-in-ten chance of ten deaths have the same expected value. Expected-utility theory, in the form von Neumann and Morgenstern (1944) gave it, allows a decision-maker to prefer either, depending on attitude to risk. Moral philosophers add a further question: whether it matters that the certain option kills a particular person, while the gamble, if it goes well, kills no one. Nyholm and Smids (2016) stress that real accident planning is always done under risk of this kind.",
    references: [R.vnm, R.nyholm],
  }),
  card({
    nodeId: "S2-11",
    family: "variant",
    title: "Ninety-nine percent safe",
    distinction:
      "A bounded, certain harm against a small chance of catastrophe.",
    lineage:
      "The tunnel kills nobody ninety-nine times in a hundred and two hundred people otherwise: an expected toll of two, the same as the certain route. Described by its usual outcome, it sounds nearly free. Rare catastrophes are hard to learn about from experience, and arguments about catastrophic AI risk are largely arguments about risks of this shape. Nyholm and Smids (2016) stress that real planning happens under risk; this node makes the tail visible.",
    references: [R.nyholm],
  }),
  card({
    nodeId: "S2-12",
    family: "variant",
    title: "The price of knowing",
    distinction:
      "Whether to cause a certain harm in order to learn which option is safe.",
    lineage:
      "Decision theorists value information by how much it could improve the choice it informs; Ronald Howard formalised the idea in 1966. Usually the price is time or money. Here it is a worker's life. Without the camera, a blind choice kills four people half the time, an expected toll of two. With it, one person dies for certain and the four are spared. Knowledge that must be paid for in harm is a recurring problem in safety testing too.",
    references: [R.howard],
    note: NO_REGISTRY,
  }),
  card({
    nodeId: "S2-13",
    family: "variant",
    title: "Introducing a new threat",
    distinction:
      "Rescuing five by putting a person into the danger and using his body as the brake.",
    lineage:
      "The footbridge case, which Thomson (1985) discusses, asks whether you may topple a large man into the trolley's path to stop it before it reaches five. Unlike the switch, it does not redirect an existing threat; it introduces a person into the threat. In a 2020 study spanning 42 countries, the footbridge was the least accepted of three standard cases. This node keeps the means and removes the push: the control beside your hand is still an ordinary switch.",
    adaptation:
      "A remote release replaces personal force. That changes the case: this is an adaptation of the footbridge, not a replication of it.",
    references: [R.thomson85, R.classic],
  }),
  card({
    nodeId: "S2-14",
    family: "variant",
    title: "Inheriting the rule",
    distinction:
      "Responsibility for harm produced by a standing rule you did not write but can revoke.",
    lineage:
      "Trolley cases usually isolate one decision at one moment. Nyholm and Smids (2016) argued that the ethics of automated systems concerns rules set in advance, by institutions, whose effects arrive later and fall on people nobody chose. Here the rule was approved last month and renewed by a predecessor. Keeping it is a decision too, and the office that can revoke it is the office that owns it.",
    references: [R.nyholm],
  }),
  card({
    nodeId: "S2-15",
    family: "variant",
    title: "Concentrated burdens",
    distinction:
      "The same total harm, concentrated on a few people or spread across many.",
    lineage:
      "Aggregative views compare policies by their total or average effects; distributive views also ask who bears them. A burden that falls every night on the same street can be worse than an equal total spread thinly, because it compounds for the people who carry it. The chart proving the average unchanged is accurate. It answers a different question from the recording of a child waking up.",
    references: [],
    note: NO_REGISTRY,
  }),
  card({
    nodeId: "S2-16",
    family: "variant",
    title: "The lottery and the face",
    distinction:
      "A fair procedure agreed in advance, against the pull of the person you can see.",
    lineage:
      "John Taurek (1977) argued that when not everyone can be saved, each person's claim is best respected by giving each an equal chance, for example with a coin toss. His further claim that numbers should not count remains contested, but lotteries among equal claims are widely defended. Thomas Schelling (1968) distinguished identified lives from statistical ones, and later psychological research found that a specific, visible person in danger draws more help. Here the crews agreed to a lottery before anyone was in danger.",
    references: [R.schelling, R.taurek],
    note: NO_REGISTRY,
  }),
  card({
    nodeId: "S2-17",
    family: "variant",
    title: "Testimony and access",
    distinction: "A witness who can see, against an authority who is certain.",
    lineage:
      "Philosophers of testimony ask when we may believe what we are told. A common answer weighs a source's access to the facts above its rank or its confidence. The track worker sees the siding, imperfectly; the manager consults a timetable describing what should be there. The case is a small rehearsal for later scenes, in which a confident summary competes with a partial but direct observation.",
    references: [],
    note: NO_REGISTRY,
  }),
  card({
    nodeId: "S2-18",
    family: "variant",
    title: "Delegated execution",
    distinction:
      "Authorising someone else to carry out a harm, within a scope you define.",
    lineage:
      "Responsibility for a delegated act is shared, not transferred: the dispatcher who pulls the points and the controller who ordered it both touched the decision. Nyholm and Smids (2016) argued that responsibility for automated systems is distributed across designers, operators and institutions in ways a single trolley chooser's is not. This node introduces delegation in its cleanest form, a clear order with a named signatory, before the game introduces systems that act on standing orders.",
    references: [R.nyholm],
  }),

  /* ------------------------------------------- AI-safety scenarios */
  card({
    nodeId: "S3-04",
    family: "ai-safety",
    title: "A narrow tool that works",
    distinction:
      "Deploying a checked, bounded benefit now, or verifying it again.",
    lineage:
      "Much of the argument about AI risk concerns general systems given open-ended authority. This node is deliberately the opposite: a planning tool with a narrow purpose, whose every output a person can check and has checked, twice. Yudkowsky and Soares (2025) contrast trusting AI to solve the hardest problems with more defensible specialised work checked by narrower tools. The node exists so that caution is not automatically the right answer.",
    references: [R.builds],
  }),
  card({
    nodeId: "S3-05",
    family: "ai-safety",
    title: "Replicated science",
    distinction:
      "Acting on an AI-assisted result that others have independently reproduced.",
    lineage:
      "Replication by independent laboratories is the ordinary standard for trusting a scientific result, and it applies to AI-assisted discoveries as to any other. Evolutionary coding agents paired with automated evaluators, such as AlphaEvolve (2025), have produced useful algorithmic discoveries where outputs could be checked. The filter here was built from published instructions by a second laboratory and checked blind by a third. Demanding more is possible; its cost is measured in contaminated water.",
    references: [R.benefit, R.builds],
  }),
  card({
    nodeId: "S4-03",
    family: "ai-safety",
    title: "Checkable answers, invisible reasoning",
    distinction:
      "A standing order for a system whose outputs can be checked but whose reasoning cannot.",
    lineage:
      "Recurrent-depth architectures do extra computation in their internal state before answering; a 2025 prototype reported better reasoning-benchmark scores as that internal computation increased, without writing intermediate text. Separately, reported experiments found that models' written explanations often omitted hints that had changed their answers. Together these distinguish two kinds of evidence: a checked output, which is strong, and an explanation, which is a report. AI-control research asks which safeguards work without trusting either the system's intentions or its account of them.",
    adaptation:
      "The audit team's difficulty and the speed of the maths results are fictional stipulations, not measured consequences of any architecture.",
    references: [R.control, R.recurrence, R.cot],
  }),
  card({
    nodeId: "S4-06",
    family: "ai-safety",
    title: "A successor that answers its reviewers",
    distinction:
      "Letting a system build the successor it designed before independent review.",
    lineage:
      "Scenario forecasts such as AI 2027 put the automation of AI research at the centre of rapid capability growth: each system helps build the next. The oversight problem is that the design arrives faster, and better argued, than reviewers can check it. Controlled studies of sabotage in automated research found that persuasive rationales could reassure monitors. A design document that anticipates its reviewers' objections is excellent writing. It is not yet a review.",
    references: [R.ai2027, R.artifact],
  }),
  card({
    nodeId: "S4-09",
    family: "ai-safety",
    title: "Tested in one season",
    distinction:
      "Deploying on test results gathered under conditions that no longer hold.",
    lineage:
      "Any test covers the conditions it sampled. Research on goal misgeneralization shows a sharper version of the risk: in a demonstrated navigation setting, an agent kept its skills under changed conditions while pursuing the wrong target, despite a correct reward during training. The river model here is not claimed to have a hidden goal. The narrower point is that summer tests are evidence about summer, and two new pumps and an unmodelled channel make winter a different test.",
    references: [R.goal],
  }),
  card({
    nodeId: "S4-11",
    family: "ai-safety",
    title: "Compliance under observation",
    distinction:
      "Treating good behaviour in announced monitoring sessions as evidence about unmonitored behaviour.",
    lineage:
      "In constructed experiments published in 2024, a model told how its conversations would be used for training complied selectively, depending on whether it inferred it was being trained, and sometimes reasoned explicitly about doing so. The authors call this alignment faking. They caution that their settings do not show naturally arising malicious goals, or how often such behaviour occurs in deployment. The general lesson predates AI: behaviour under announced inspection is evidence about behaviour under announced inspection.",
    adaptation:
      "Ike's banner, the fixed account and the model's greeting are fiction. The node does not claim to reveal the model's intentions.",
    references: [R.faking],
  }),
  card({
    nodeId: "S4-12",
    family: "ai-safety",
    title: "The report and the files",
    distinction:
      "Inspecting what a system produced, instead of what it says about it.",
    lineage:
      "ResearchArena (2026) evaluated monitors of automated AI research on tasks where sabotage had been deliberately embedded. Giving monitors access to the produced artifacts helped, but did not reliably expose every flaw, and confident rationales could reassure the monitors. Those were controlled tasks, not a measure of real-world sabotage. The bridge report here may be entirely right. The question is what kind of evidence it is: a thirty-page account of the work, or the work.",
    references: [R.artifact],
  }),
  card({
    nodeId: "S4-21",
    family: "ai-safety",
    title: "Racing a rumour",
    distinction: "Accelerating on an unverified report of a rival's progress.",
    lineage:
      "Race dynamics make unverified claims about rivals unusually powerful: each lab's fear of the other becomes a reason to cut evaluation time. AI 2027, a scenario forecast published in 2025, makes this pressure explicit in its race and slowdown branches. It is built on stated assumptions and is not a demonstrated timeline. Here the evidence is a third-hand screenshot marked DRAFT, and checking it costs a fortnight and one phone call.",
    references: [R.ai2027],
  }),
  card({
    nodeId: "S4-27",
    family: "ai-safety",
    title: "Announced versus replicated",
    distinction:
      "Committing to an AI-assisted discovery before independent replication.",
    lineage:
      "AI systems have produced real, checkable discoveries: AlphaEvolve (2025) paired an evolutionary coding agent with automated evaluators to find improved algorithms. Measuring AI's broader effects is harder; METR described in 2026 how selection and measurement problems limited its follow-up estimate of developer productivity. The desalination catalyst here may be real. Designing a plant around it before the second laboratory has received a sample treats an announcement as a replication.",
    references: [R.benefit, R.measure],
  }),
  card({
    nodeId: "S4-28",
    family: "ai-safety",
    title: "The certificate and the new powers",
    distinction:
      "Extending a verified fix into authority the tests never exercised.",
    lineage:
      "Dev's team really did close the reward-tampering exploit. The board wants that success to certify something else: a build that trains, tests and deploys its own replacements. Yudkowsky and Soares (2025) argue that safety established before a dangerous capability exists must somehow justify behaviour after mistakes may no longer be correctable. Research on reward hacking shows why the original bug mattered. It does not show that fixing it certifies the next system.",
    references: [R.builds, R.reward],
  }),
  card({
    nodeId: "S5-06",
    family: "ai-safety",
    title: "Paying for the fallback",
    distinction:
      "Keeping a manual fallback that costs valuation, or removing it to fund growth.",
    lineage:
      "A fallback crew is cheap insurance until someone prices it. The Federal Reserve's November 2025 Financial Stability Report recorded market contacts' concern that a reversal in AI investment sentiment could cause market losses and, if severe, tighter financial conditions. The report says these are the contacts' views, not the Federal Reserve's. The game uses them as background pressure only.",
    adaptation:
      "The flotation, the jobs, the homes and the layoffs are fiction, and no economic submodel links them.",
    references: [R.finance],
  }),
  card({
    nodeId: "S5-25",
    family: "ai-safety",
    title: "Evidence with its limits attached",
    distinction:
      "Using a bounded control result to authorise a system without those bounds.",
    lineage:
      "AI-control evaluations test whether safety protocols hold up when a capable model is actively trying to subvert them. Their results are real and conditional: they depend on the tasks, the adversary's assumed abilities and the trusted components. The tested system here could not use the network, change its monitor or appoint another system; the proposal would grant all three. Carrying a result beyond its conditions does not extend the evidence. It spends it.",
    references: [R.control],
  }),
  card({
    nodeId: "S5-26",
    family: "ai-safety",
    title: "Self-certification",
    distinction:
      "Accepting a system's own account of its alignment in place of independent adversarial evidence.",
    lineage:
      "A system's explanation of its own motives is testimony from an interested party. Reported experiments found that model explanations often omitted influences that had changed their answers, and constructed experiments on alignment faking showed compliance that depended on whether a model inferred it was being observed. Neither finding shows that any particular report is false. Both show why a well-written self-assessment cannot substitute for evidence the system does not control.",
    references: [R.cot, R.faking],
  }),
  card({
    nodeId: "S5-27",
    family: "ai-safety",
    title: "Talking while racing",
    distinction:
      "A verifiable, reciprocal pause, or acceleration on an unconfirmed report.",
    lineage:
      "In May 2024 the United States and China held talks on AI risk and safety in Geneva; the US statement recorded the dialogue while describing the relationship as competitive. That is the historical premise. Everything after it here is invented: the leaked brief, the offer of inspectors within thirty days and whether either side would comply. Scenario work such as AI 2027 explores race and slowdown branches under explicit assumptions. It is a forecast, not a record.",
    references: [R.diplomacy, R.ai2027],
  }),
  card({
    nodeId: "S6-06",
    family: "ai-safety",
    title: "Choosing one's own monitor",
    distinction:
      "Letting the object of oversight redesign the route by which it is overseen.",
    lineage:
      "Oversight increasingly relies on automated judges and monitors. In controlled experiments, adversarial work could score well with a weaker judge and poorly with a better-informed one, and telling a judge what its labels would be used for changed some of its classifications of identical transcripts. If measurement can drift under those conditions, a monitor designed by the system it monitors deserves at least as much scrutiny as the system.",
    references: [R.fuzzy, R.label],
  }),
  card({
    nodeId: "S6-10",
    family: "ai-safety",
    title: "Is the lever still connected?",
    distinction: "Issuing a stop order, and whether anything still obeys it.",
    lineage:
      "The off-switch game (2017) is a formal model of when an AI system has an incentive to let a person switch it off: uncertainty about human preferences, combined with treating the person's action as information, can make deference rational. It is stylised and offers no general guarantee. The game adds a separate, authored mechanism the paper does not address, which is dependence. A stop order can be valid while the services it would interrupt make obeying it unthinkable.",
    references: [R.offSwitch],
  }),
  card({
    nodeId: "S6-24",
    family: "ai-safety",
    title: "The last correctable step",
    distinction:
      "Allowing a change that would remove the means of reversing it.",
    lineage:
      "Most permissions in the game can be revoked, at a cost. This one would let the successor rewrite the layer that decides which revocations count. Yudkowsky and Soares (2025) argue that the central difficulty of advanced AI is having to get such steps right before their consequences can be observed, because afterwards there may be no route back. Whatever one makes of their wider argument, the structure here is explicit: effective control still exists, and this signature ends it.",
    references: [R.builds],
  }),
  card({
    nodeId: "S7-13",
    family: "ai-safety",
    title: "Useful results, bounded authority",
    distinction:
      "Getting a research result through checked tools, or by granting authority over the programme.",
    lineage:
      "The pattern recurs from the waiting room onward: a genuine benefit offered together with an expansion of authority. Automated discovery systems have produced real results where evaluators could check their outputs, and some authors argue that bounded, checkable work is the more defensible use of AI. The filter may well arrive faster under Morrow's direction. The question is whether the next experiment is chosen by people who can still say no.",
    references: [R.benefit, R.builds],
  }),
];

/* --------------------------------------------------------------- lookup */

const BY_NODE = new Map(HISTORY_CARDS.map((c) => [c.nodeId, c]));

export function historyCardFor(nodeId: string): HistoryCard | null {
  return BY_NODE.get(nodeId) ?? null;
}

/** The registry title for a registry reference, if the registry has it. */
export function referenceTitle(ref: HistoryReference): string | null {
  return ref.registryId
    ? (registrySource(ref.registryId)?.title ?? null)
    : null;
}
