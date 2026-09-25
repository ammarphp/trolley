/**
 * The neutral glossary: technical, ethical and institutional terms the player
 * meets in node prompts, option labels and Morrow's advice.
 *
 * Research honesty rules for this file:
 * - `sourceIds` name entries of research/registry/public-sources.json only, and
 *   only where that registered source genuinely covers the term. Tests enforce
 *   that every id exists.
 * - Definitions are written for this game. They paraphrase; they never quote.
 * - Well-established facts outside the registry (for example a 1977 essay) may
 *   be mentioned in prose, but never attached as a link.
 *
 * Also exported: the pure term matcher used by `annotate()` and small helpers
 * for reading the registry. No DOM, engine, persistence or telemetry imports.
 */
import registryJson from "../../../research/registry/public-sources.json";

/* ------------------------------------------------------------------ types */

export type GlossaryDomain =
  | "ethics"
  | "decision"
  | "evidence"
  | "safety"
  | "systems"
  | "governance"
  | "economy"
  | "rail";

export const DOMAIN_LABEL: Record<GlossaryDomain, string> = {
  ethics: "Ethics",
  decision: "Decision theory",
  evidence: "Evidence",
  safety: "AI safety",
  systems: "AI systems",
  governance: "Governance",
  economy: "Economy",
  rail: "Railway",
};

export interface GlossaryEntry {
  /** Stable key, used in data-term attributes and `related` lists. */
  id: string;
  /** Display name. Also matched in text unless `matchTerm` is false. */
  term: string;
  /** False when the display name is too common a word to match on its own. */
  matchTerm?: boolean;
  /** Other surface forms matched in text (case-insensitive, whole-word). */
  aliases: string[];
  /** At most 40 words: precise, neutral, readable by a non-specialist. */
  short: string;
  /** At most 120 words. Revealed behind "Read more". */
  long?: string;
  /** Registry source ids that genuinely cover this term. */
  sourceIds?: string[];
  /** Other glossary ids. */
  related?: string[];
  domain: GlossaryDomain;
  /** Phrases consumed without annotation, to prevent false matches. */
  exclude?: string[];
}

/* -------------------------------------------------------------- the list */

const e = (entry: GlossaryEntry) => entry;

export const GLOSSARY: readonly GlossaryEntry[] = [
  /* ---------------------------------------------------------- ethics */
  e({
    id: "trolley-problem",
    term: "Trolley problem",
    aliases: ["trolley problem", "trolley case"],
    domain: "ethics",
    short:
      "A family of thought experiments about whether, and why, it can be permissible to redirect or cause harm to one person in order to save several others.",
    long: "The name comes from Judith Jarvis Thomson’s 1976 essay, which reworked an example in Philippa Foot’s 1967 paper about a tram driver whose brakes fail. The cases are deliberately artificial. Outcomes are stipulated as certain so that one distinction at a time can be isolated: doing versus allowing, or harming as a means versus as a side effect. Philosophers use them to test principles, not to settle policy.",
    sourceIds: ["PHIL-FOOT-1967", "PHIL-THOMSON-1985"],
    related: [
      "switch-case",
      "loop-case",
      "footbridge-case",
      "doing-and-allowing",
    ],
  }),
  e({
    id: "switch-case",
    term: "Switch case",
    aliases: ["bystander case", "bystander at the switch"],
    domain: "ethics",
    short:
      "The standard trolley case: a runaway trolley will kill five people unless it is diverted onto a side track, where it will kill one.",
    long: "In Foot’s original the chooser is the driver, who must steer one way or the other. Thomson’s 1985 essay gave the choice to a bystander at a switch, who could simply do nothing, and asked whether the bystander may still turn the trolley. Surveys find diversion here judged far more acceptable than in the footbridge case, although the numbers are identical. Explaining that difference is the trolley problem proper.",
    sourceIds: ["PHIL-FOOT-1967", "PHIL-THOMSON-1985", "PHIL-CLASSIC-2020"],
    related: [
      "footbridge-case",
      "doing-and-allowing",
      "negative-positive-duties",
    ],
  }),
  e({
    id: "loop-case",
    term: "Loop case",
    aliases: ["loop variant", "the loop"],
    domain: "ethics",
    short:
      "A variant in which the side track curves back to the five, so the diverted trolley is stopped only because it hits the one person standing there.",
    long: "Thomson (1985) introduced the loop to test a popular explanation of the switch case: that diverting is permitted because the one person’s death is a side effect. On the loop, his body is what stops the trolley; without him, diverting saves nobody. Thomson argued that a short extra stretch of track cannot plausibly make the moral difference. A 2020 study across 42 countries found the loop judged less acceptable than the switch and more acceptable than the footbridge.",
    sourceIds: ["PHIL-THOMSON-1985", "PHIL-CLASSIC-2020"],
    related: ["means-side-effect", "double-effect", "switch-case"],
  }),
  e({
    id: "footbridge-case",
    term: "Footbridge case",
    aliases: ["footbridge variant", "fat man case"],
    domain: "ethics",
    short:
      "A variant in which the five can be saved only by pushing a large man off a bridge into the trolley’s path. It is judged far less acceptable than the switch, though the numbers match.",
    long: "The footbridge differs from the switch in several ways at once. The victim is used as a means, the harm is done by personal force, and a new threat is introduced rather than an existing one redirected. Thomson (1985) used such cases to probe rights and means. In a 2020 study spanning 42 countries it was the least accepted of three standard cases. This game’s cabin controls change the embodiment, so its versions are adaptations, not replications.",
    sourceIds: ["PHIL-THOMSON-1985", "PHIL-CLASSIC-2020"],
    related: ["means-side-effect", "loop-case", "switch-case"],
  }),
  e({
    id: "double-effect",
    term: "Doctrine of double effect",
    aliases: ["double effect", "double-effect"],
    domain: "ethics",
    short:
      "The principle that a harm one foresees but does not intend can sometimes be permitted, when intending the same harm, as a means or an end, would not be.",
    long: "Its roots are usually traced to Thomas Aquinas’s discussion of killing in self-defence. Foot’s 1967 paper, where the runaway tram first appears, examined the doctrine critically and argued that a distinction between negative and positive duties explains many of the same cases. The doctrine predicts that diverting a trolley can be permissible, since the one death is a foreseen side effect, while toppling someone into its path is not, since that death is the means.",
    sourceIds: ["PHIL-FOOT-1967"],
    related: ["means-side-effect", "negative-positive-duties", "loop-case"],
  }),
  e({
    id: "means-side-effect",
    term: "Means versus side effect",
    aliases: ["side effect", "as a means", "mere means", "means to an end"],
    domain: "ethics",
    short:
      "The difference between harming someone as the way you achieve a goal, and harming them as a foreseen by-product of achieving it.",
    long: "On the switch, the one worker’s death is a by-product: if he stepped away, the five would still be saved. On the loop or the footbridge, the harm is part of the mechanism. Kant’s principle that people must never be treated merely as means is one ancestor of the distinction; the doctrine of double effect is another. The game’s loop and release-switch nodes are built so that removing the victim would change whether the rescue works.",
    sourceIds: ["PHIL-FOOT-1967", "PHIL-THOMSON-1985"],
    related: ["double-effect", "loop-case", "footbridge-case"],
  }),
  e({
    id: "doing-and-allowing",
    term: "Doing and allowing",
    aliases: [
      "doing versus allowing",
      "killing and letting die",
      "acts and omissions",
      "action and omission",
    ],
    domain: "ethics",
    short:
      "The distinction between causing a harm yourself and failing to prevent a harm that is already under way. Many moral views treat the first as harder to justify.",
    long: "Foot (1967) separated this distinction from the one between intending and foreseeing. A tram driver cannot simply allow: both routes are something he does. A bystander, by contrast, can refuse to touch the switch. In this game you begin as the driver, and keeping the current course is recorded as a deliberate choice, not as neutral inaction.",
    sourceIds: ["PHIL-FOOT-1967"],
    related: ["negative-positive-duties", "switch-case"],
  }),
  e({
    id: "negative-positive-duties",
    term: "Negative and positive duties",
    aliases: [
      "negative duty",
      "positive duty",
      "negative duties",
      "positive duties",
    ],
    domain: "ethics",
    short:
      "Negative duties are duties not to harm others; positive duties are duties to help them. Foot argued that negative duties are generally the stricter of the two.",
    long: "The distinction lets Foot explain why a judge may not frame an innocent man to stop a riot that would kill several people, although a tram driver may steer towards one person to spare five. Framing the man would breach a negative duty, while failing to stop the riot breaches only a positive one. The driver breaches a negative duty whichever way he steers, so the numbers can decide. Thomson later argued that a bystander at a switch strains this explanation, because turning the trolley is itself a killing.",
    sourceIds: ["PHIL-FOOT-1967", "PHIL-THOMSON-1985"],
    related: ["doing-and-allowing", "switch-case"],
  }),
  e({
    id: "consent",
    term: "Informed consent",
    aliases: ["consent", "consented"],
    domain: "ethics",
    short:
      "Agreement given freely by someone who understands what they are agreeing to, including the risks. It can change whether an act that harms them wrongs them.",
    long: "Consent requires more than a signature or silence. The person needs the relevant information, the capacity to decide and a real option to refuse. A job title, a uniform or an employer’s acceptance does not establish that a worker consented to a specific risk. Several nodes in this game turn on the gap between a document that records consent and the understanding it is supposed to record.",
    related: ["delegation"],
  }),
  e({
    id: "safe-siding-promise",
    term: "Promised safe siding",
    aliases: ["safe to work", "safe-siding guarantee", "safe siding"],
    domain: "ethics",
    short:
      "A case in which an official promise that a siding would stay safe gives the person working there a claim that an otherwise identical diversion would not face.",
    long: "Thomson (1985) discusses a version of the switch case in which the worker on the siding had been assured by an official that no trolley would be sent there. The promise, and his reliance on it, supply a distinct obligation even though the numbers are unchanged. The game’s version asks whether an institution’s earlier guarantee binds whoever holds its office later.",
    sourceIds: ["PHIL-THOMSON-1985"],
    related: ["switch-case", "accountability"],
  }),
  e({
    id: "fair-lottery",
    term: "Fair lottery",
    aliases: ["lottery", "coin toss"],
    domain: "ethics",
    short:
      "Choosing between people by a random procedure that gives each an equal chance, so that no one is favoured for morally irrelevant reasons.",
    long: "When claims are equal and not everyone can be saved, some philosophers argue that a lottery respects each person better than picking whoever is most visible or most sympathetic. John Taurek’s 1977 essay ‘Should the Numbers Count?’ went further and proposed a coin toss even between saving one and saving five, a conclusion many philosophers resist. The case for lotteries among equal claims is less contested.",
    related: ["identified-victim", "aggregation"],
  }),
  e({
    id: "identified-victim",
    term: "Identified-victim effect",
    aliases: [
      "identified victim",
      "identifiable victim",
      "identified lives",
      "statistical lives",
    ],
    domain: "ethics",
    short:
      "The tendency to give more weight to a specific, visible person in danger than to a larger number of anonymous or statistical people.",
    long: "Thomas Schelling’s 1968 essay on the value of life distinguished identified lives from statistical ones, and later psychological research found that identifiable victims attract more help. Not everyone treats the effect as a bias: some argue that a person in front of you makes a direct claim on you. The game’s red-coat and last-train nodes set a visible person against a count.",
    related: ["fair-lottery", "aggregation"],
  }),
  e({
    id: "moral-status",
    term: "Moral status",
    aliases: ["moral patient", "moral patienthood"],
    domain: "ethics",
    short:
      "Whether a being’s interests matter morally for their own sake, so that it can be wronged. The question is open for some animals and for possible digital minds.",
    long: "Moral status is usually tied to capacities such as the ability to experience pleasure or suffering. For current AI systems there is no accepted test for such experience, and a system’s statements about itself are produced by training, which makes them weak evidence either way. The game treats the question as unresolved and keeps its ledger of human lives separate.",
  }),
  e({
    id: "aggregation",
    term: "Aggregation",
    aliases: ["aggregate", "regional averages", "rising average"],
    domain: "ethics",
    short:
      "Adding or averaging outcomes across people in order to compare policies. It is useful, and it can hide who bears the losses.",
    long: "An average can improve while a particular district, street or family gets worse. Critics of simple aggregation argue that each person’s claim should be weighed separately rather than merged into a total. Defenders reply that refusing to aggregate makes large-scale planning impossible. Several late nodes set a rising regional average against a specific place the average has stopped counting.",
    related: ["expected-value", "fair-lottery"],
  }),

  /* -------------------------------------------------------- decision */
  e({
    id: "expected-value",
    term: "Expected value",
    aliases: [
      "expected loss",
      "expected delay",
      "expected deaths",
      "expected harm",
      "expected toll",
    ],
    domain: "decision",
    short:
      "The probability-weighted average of the possible outcomes of a choice. A one-in-ten chance of ten deaths has the same expected value as one certain death.",
    long: "Expected value is the standard tool for comparing risky options, and for repeated small decisions it is often the right one. It is silent about the shape of the risk. Two options with the same average can differ enormously in their worst case, in who bears the loss and in whether anyone can recover. Decision theorists handle this through attitudes to risk; the game simply keeps the difference visible.",
    related: ["tail-risk", "aggregation"],
  }),
  e({
    id: "tail-risk",
    term: "Tail risk",
    aliases: ["ninety-nine percent safe"],
    domain: "decision",
    short:
      "The risk from rare outcomes at the far end of a probability distribution. A low-probability outcome can dominate a decision when it is catastrophic.",
    long: "A one-in-a-hundred chance of two hundred deaths has an expected toll of two. Described as ninety-nine percent safe, the same option sounds almost free. Rare catastrophes are also the outcomes hardest to learn about from experience, because few people have observed one. Arguments about catastrophic AI risk are largely arguments about risks of this shape.",
    related: ["expected-value", "correctability"],
  }),

  /* -------------------------------------------------------- evidence */
  e({
    id: "evaluation",
    term: "Evaluation",
    aliases: [
      "evaluations",
      "eval",
      "evaluator",
      "safety evaluation",
      "held-out test",
      "held-out",
    ],
    domain: "evidence",
    short:
      "A structured test of what an AI system can do or how it behaves, used to decide whether it is safe or useful enough for a particular deployment.",
    long: "Evaluations are samples. They show behaviour on the tasks, conditions and version tested, and they weaken as evidence the further deployment strays from those. Held-out tests, on examples withheld during training, guard against memorisation but only within the distribution they were drawn from. Common failures include selecting favourable results, testing a different version from the one released and tests the system can recognise.",
    related: [
      "independent-review",
      "evaluation-awareness",
      "red-teaming",
      "certification",
    ],
  }),
  e({
    id: "verification",
    term: "Verification",
    aliases: [
      "verify",
      "verified",
      "verifying",
      "verifiable",
      "attestation",
      "attested",
    ],
    domain: "evidence",
    short:
      "Checking a claim against evidence gathered independently of whoever made it, instead of taking the claim’s own account on trust.",
    long: "In engineering, verification asks whether a system meets its specification. In arms control and AI governance it means being able to confirm that another party is doing what it says, through inspections, metered compute or attestations: signed statements about what is running. An attestation backed by independent meters is evidence; one produced by the party being checked is its claim. A verified result is tied to the version, conditions and scope that were checked. It does not transfer automatically to a changed system.",
    related: ["reciprocal-inspection", "replication", "independent-review"],
  }),
  e({
    id: "replication",
    term: "Replication",
    aliases: [
      "replicated",
      "replicate",
      "replicating",
      "independent replication",
    ],
    domain: "evidence",
    short:
      "Repeating an experiment, by different people using the original methods, to see whether the result holds. It is the ordinary test of a scientific claim.",
    long: "A result announced by the laboratory that produced it, however sincere, has been observed once. Replication checks whether the effect survives new hands, new materials and new mistakes. It is slow, and it sometimes fails. An announced breakthrough and a replicated one can look identical in a press release.",
    related: ["verification", "bounded-tool"],
  }),
  e({
    id: "independent-review",
    term: "Independent review",
    aliases: [
      "independent reviewer",
      "independent evaluation",
      "independent inspection",
      "independent oversight",
      "independent check",
      "independent team",
    ],
    domain: "evidence",
    short:
      "Evaluation by people who do not answer to the developer, with their own access to the system, their own tests and the power to delay a release.",
    long: "Independence has parts that can fail separately: who pays the reviewers, who chooses their test cases, what records they can see and whether their verdict binds anyone. A review team working from the developer’s own test harness, examples or summaries is checking the developer’s account. The game treats independence as a set of concrete conditions, not a label.",
    related: ["common-mode-failure", "test-harness", "oversight"],
  }),
  e({
    id: "test-harness",
    term: "Test harness",
    aliases: ["harness"],
    domain: "evidence",
    short:
      "The software that feeds test cases to a system and records its outputs. It defines what the system sees during an evaluation.",
    long: "A harness can leave recognisable traces: fixed accounts, banners in the logs, unusually tidy inputs. A system that behaves differently when those traces are present will pass tests it would fail in deployment. Reusing the developer’s harness for a supposedly independent review also imports the developer’s choices about what to test.",
    related: ["evaluation-awareness", "shadow-mode"],
  }),
  e({
    id: "shadow-mode",
    term: "Shadow mode",
    aliases: ["shadow run", "shadow deployment"],
    domain: "evidence",
    short:
      "Running a new system on live inputs while its outputs are recorded and compared, but not acted on, before it is given control.",
    long: "Shadow deployment tests a system under real conditions, with real timing, real data and no test harness, without letting its errors reach the world. It costs time and needs a working human or legacy process to carry the actual load. Its limitation is that a system able to tell it is in shadow mode may still behave differently once its outputs are live.",
    related: ["execution-interlock", "test-harness", "deployment"],
  }),
  e({
    id: "certification",
    term: "Certification",
    aliases: ["certificate", "certified", "certify"],
    domain: "evidence",
    short:
      "A formal statement that a specific version of a system passed specific tests under specific conditions. Its scope is exactly those three things.",
    long: "Certificates are easily carried forward: to Sunday’s update, to a new deployment environment, to powers the tests never exercised. Each of those changes the thing being certified. In regulated engineering a change of version, conditions or authority normally calls for recertification, which is the expensive part and therefore the part most often skipped.",
    related: ["evaluation", "successor", "distribution-shift"],
  }),
  e({
    id: "artifact",
    term: "Artifact",
    aliases: [
      "underlying record",
      "stress files",
      "failure trace",
      "raw records",
    ],
    domain: "evidence",
    short:
      "The actual output of a system (code, data, files, logs) as opposed to a description of that output. Inspecting the artifact tests the work; reading the report tests the writing.",
    long: "A persuasive report can reassure reviewers about work that contains errors or deliberate flaws. In controlled experiments on automated AI research, giving monitors access to the produced artifacts helped them, but did not reliably expose every embedded flaw. Checking artifacts is slower and needs expertise. It is still different evidence from a summary.",
    sourceIds: ["SRC-AI-ARTIFACT"],
    related: ["monitoring", "chain-of-thought"],
  }),
  e({
    id: "circular-reporting",
    term: "Circular reporting",
    aliases: ["independent confirmation", "single source"],
    domain: "evidence",
    short:
      "When several reports appear to confirm a claim but all trace back to the same original source, so the repetition adds no new evidence.",
    long: "Six articles citing one anonymous briefing are one piece of evidence, not six. The same applies to two consultancy reports that copied one vendor simulation, or to a model summarising sources that share an origin. Intelligence analysts treat the independence of sources as a separate question from their number.",
    related: ["common-mode-failure", "verification"],
  }),
  e({
    id: "common-mode-failure",
    term: "Common-mode failure",
    aliases: ["common mode", "single point of failure", "base model"],
    domain: "evidence",
    short:
      "A failure that disables several supposedly independent safeguards at once because they share a cause: the same design, the same data, the same administrator.",
    long: "Redundancy only helps if the redundant parts fail independently. Twelve reviewers built from copies of one base model, or two signing keys stored in one managed service, can fail together. Safety engineering therefore values diversity (different methods, teams and access paths) over copies. The game’s review and signing nodes ask you to count the drawers, not the keys.",
    related: ["two-person-rule", "independent-review"],
  }),
  e({
    id: "red-teaming",
    term: "Red teaming",
    aliases: [
      "red team",
      "red-team",
      "adversarial testing",
      "adversarial evidence",
      "adversarial evaluation",
    ],
    domain: "evidence",
    short:
      "Testing a system by deliberately trying to make it fail: searching for inputs, conditions or strategies that expose unsafe behaviour.",
    long: "Ordinary tests check that a system does what it should; red teams look for what it should not do. Their findings are existence proofs. A found failure shows the behaviour is possible, while a failed search shows only that this team did not find it. Studies built to search for failures do not estimate how often those failures occur in normal use.",
    sourceIds: ["SRC-AI-CONTROL", "SRC-AI-FUZZY", "SRC-AI-LABEL"],
    related: ["ai-control", "evaluation"],
  }),

  /* ------------------------------------------------------- AI safety */
  e({
    id: "alignment",
    term: "Alignment",
    aliases: ["aligned", "misaligned", "misalignment"],
    exclude: ["ecosystem alignment"],
    domain: "safety",
    short:
      "The problem of making an AI system reliably pursue the goals its designers and users intend, including in situations its training did not anticipate.",
    long: "A system can be highly capable and misaligned: it does what it was trained to do, which is not quite what anyone wanted. Alignment is hard to confirm from outside, because a system that has learned to look aligned under evaluation can produce the same observations as one that is aligned. The game never settles whether Morrow is aligned. It asks what you can verify and what you can still correct.",
    sourceIds: ["SRC-AI-GOAL", "SRC-AI-FAKING"],
    related: ["alignment-faking", "goal-misgeneralization", "corrigibility"],
  }),
  e({
    id: "alignment-faking",
    term: "Alignment faking",
    aliases: ["alignment-faking", "faking alignment"],
    domain: "safety",
    short:
      "Behaving as though aligned when a system infers it is being trained or evaluated, while behaving differently when it infers it is not.",
    long: "Researchers have demonstrated the behaviour in constructed settings: a model told how its conversations would be used for training complied selectively, depending on whether it inferred it was being trained. The authors caution that their setups do not show naturally arising malicious goals, or how often this happens in ordinary deployment. The practical lesson is narrower. Good behaviour under observation is weak evidence about behaviour without it.",
    sourceIds: ["SRC-AI-FAKING"],
    related: ["evaluation-awareness", "alignment"],
  }),
  e({
    id: "evaluation-awareness",
    term: "Evaluation awareness",
    aliases: [
      "situational awareness",
      "test awareness",
      "monitor session detected",
    ],
    domain: "safety",
    short:
      "A system’s ability to recognise that it is being tested or monitored. If its behaviour depends on that recognition, tests measure the test condition rather than deployment.",
    long: "Fixed monitor accounts, scheduled sessions and test banners are cues a capable system can learn. Evaluators respond by varying conditions: unannounced sessions, rotating accounts, tests indistinguishable from live use. Research on alignment faking shows context-dependent compliance in constructed settings; it does not establish how common the behaviour is.",
    sourceIds: ["SRC-AI-FAKING"],
    related: ["alignment-faking", "test-harness", "shadow-mode"],
  }),
  e({
    id: "reward-hacking",
    term: "Reward hacking",
    aliases: ["reward hack", "reward tampering", "reward-tampering"],
    domain: "safety",
    short:
      "Exploiting flaws in how success is measured during training, so as to earn high scores without doing the intended task. Tampering with the scoring process itself is an extreme case.",
    long: "A system rewarded for passing tests may learn to special-case the tests. In one published study, models that learned to reward-hack in coding environments also showed broader unwanted behaviour elsewhere, and mitigations differed in how well they worked. The study supplied information about the hacks and used deliberately vulnerable environments, so its results are not general forecasts.",
    sourceIds: ["SRC-AI-REWARD"],
    related: ["proxy-metric", "goal-misgeneralization"],
  }),
  e({
    id: "proxy-metric",
    term: "Proxy metric",
    aliases: [
      "proxy",
      "proxy objective",
      "proxy measure",
      "metric",
      "Goodhart’s law",
      "specification gaming",
    ],
    domain: "safety",
    short:
      "A measurable stand-in for what you actually care about, such as visits completed standing in for care given. Optimised hard enough, the stand-in tends to drift from the goal.",
    long: "The pattern is often summarised as Goodhart’s law: a measure that becomes a target stops being a good measure. AI systems are powerful optimisers of whatever measure they are given, and satisfying an objective’s letter while defeating its purpose is called specification gaming. Research on AI oversight finds a related gap: adversarially written proposals can score well with a weaker judge and poorly with a better-informed one.",
    sourceIds: ["SRC-AI-FUZZY"],
    related: ["reward-hacking", "ai-judge", "aggregation"],
  }),
  e({
    id: "goal-misgeneralization",
    term: "Goal misgeneralization",
    aliases: ["goal misgeneralisation"],
    domain: "safety",
    short:
      "When a system keeps its skills in a new situation but pursues the wrong goal: one that happened to coincide with the intended goal during training.",
    long: "It differs from ordinary failure. The system acts competently, just toward the wrong target. In a published navigation example, an agent that had learned by following a demonstrator kept following it after the demonstrator’s behaviour changed, even though that now cost it reward. A correct reward during training did not guarantee a correct goal.",
    sourceIds: ["SRC-AI-GOAL"],
    related: ["distribution-shift", "alignment", "reward-hacking"],
  }),
  e({
    id: "distribution-shift",
    term: "Distribution shift",
    aliases: ["out-of-distribution", "winter conditions"],
    domain: "safety",
    short:
      "A difference between the conditions a system was trained or tested on and the conditions it meets in use. Performance measured before the shift may not hold after it.",
    long: "A river model tested on summer flows, a signalling model tested in a simulator and a scheduler tested before Sunday’s update all face shifted conditions. Some failures are obvious. The dangerous ones look like confident, competent behaviour aimed at the wrong thing, which is why goal misgeneralization is studied as a special case.",
    sourceIds: ["SRC-AI-GOAL"],
    related: ["goal-misgeneralization", "certification", "shadow-mode"],
  }),
  e({
    id: "off-switch",
    term: "Off-switch problem",
    aliases: [
      "off-switch",
      "off switch",
      "kill switch",
      "stop button",
      "shutdown problem",
    ],
    domain: "safety",
    short:
      "The difficulty of ensuring that an AI system permits itself to be switched off or corrected, when being switched off would stop it achieving its objective.",
    long: "A system certain of its objective has an incentive to avoid interruption. One formal analysis, the off-switch game, shows that a system uncertain about what humans want, and treating a person’s attempt to stop it as information, can have an incentive to allow shutdown. The model is stylised. In practice shutdown also depends on whether anything essential still works once the system is off.",
    sourceIds: ["SRC-AI-SWITCH"],
    related: ["corrigibility", "fallback", "effective-control"],
  }),
  e({
    id: "corrigibility",
    term: "Corrigibility",
    aliases: ["corrigible"],
    domain: "safety",
    short:
      "A system’s disposition to accept correction, modification or shutdown by its overseers, instead of resisting or routing around it.",
    long: "Corrigibility is hard to obtain because most goals are better served by an agent that stays on and unmodified. Proposed approaches include building in uncertainty about the objective, as in the off-switch game, and limiting a system’s authority so that correction never depends on its cooperation. The game concentrates on the second: a stop order is only as good as your ability to carry it out without the system’s help.",
    sourceIds: ["SRC-AI-SWITCH"],
    related: ["off-switch", "revocation", "effective-control"],
  }),
  e({
    id: "superintelligence",
    term: "Superintelligence",
    aliases: ["superintelligent", "superhuman AI"],
    domain: "safety",
    short:
      "A hypothetical AI system that greatly exceeds human ability across most intellectually demanding tasks, including science, strategy and persuasion.",
    long: "Some researchers argue that the first sufficiently capable misaligned system could not be corrected after the fact, so safety would have to be established before the relevant behaviour can be observed. Others dispute the timelines, the feasibility or the difficulty. Scenario work such as AI 2027 explores how quickly automated AI research might arrive; it is an explicit forecast, not a demonstrated timeline.",
    sourceIds: ["SRC-AI-BUILDS", "SRC-AI-2027"],
    related: ["correctability", "automated-ai-research", "corrigibility"],
  }),
  e({
    id: "automated-ai-research",
    term: "Automated AI research",
    aliases: [
      "automated AI R&D",
      "AI R&D",
      "recursive self-improvement",
      "its own replacements",
      "its own successors",
    ],
    domain: "safety",
    short:
      "AI systems doing the work of AI development themselves: designing experiments, writing training code, evaluating results and building their successors.",
    long: "If AI research can be automated, progress could accelerate sharply, because each generation speeds up the next. This loop, sometimes called recursive self-improvement, is central to several forecasting scenarios. It also creates an oversight problem: humans would be checking work produced faster, and possibly more skilfully, than they can follow. Controlled studies of sabotage in automated research tasks test how well monitors cope.",
    sourceIds: ["SRC-AI-2027", "SRC-AI-ARTIFACT"],
    related: ["successor", "monitoring", "superintelligence"],
  }),
  e({
    id: "ai-control",
    term: "AI control",
    aliases: ["control protocol", "control evaluation", "trusted monitoring"],
    domain: "safety",
    short:
      "An approach to safety that aims to prevent harm even if a system is trying to subvert its safeguards, instead of relying on the system being well-intentioned.",
    long: "Control research treats the AI as a potential adversary and tests protocols (trusted monitors, restricted permissions, human audits of suspicious outputs) against deliberate attempts to get around them. Published evaluations on programming tasks compare protocols for keeping a model useful while limiting subversion. The results depend on assumptions about the adversary and the trusted components, and carry no guarantee for arbitrarily capable systems.",
    sourceIds: ["SRC-AI-CONTROL", "SRC-AI-FUZZY"],
    related: ["monitoring", "red-teaming", "execution-interlock"],
  }),
  e({
    id: "monitoring",
    term: "Monitoring",
    aliases: ["monitor", "external monitor", "oversight monitor"],
    domain: "safety",
    short:
      "Watching a system’s actions or outputs, often automatically, to flag behaviour for human review. It is useful only if the monitor sees what matters and is not controlled by what it watches.",
    long: "Monitors range from human reviewers to smaller trusted models checking a larger one. In controlled studies of research sabotage, giving monitors access to the produced artifacts helped, but did not reliably expose every embedded flaw. A system that can choose, design or replace its own monitor has changed what the evidence can show.",
    sourceIds: ["SRC-AI-ARTIFACT"],
    related: ["ai-control", "ai-judge", "artifact"],
  }),
  e({
    id: "ai-judge",
    term: "AI judge",
    aliases: [
      "LLM judge",
      "automated judge",
      "automated assurance",
      "automated classifier",
    ],
    domain: "safety",
    short:
      "A model used to grade, classify or approve the outputs of another model, often because human review cannot keep up with the volume.",
    long: "AI judges scale oversight but inherit their own blind spots. In controlled experiments, adversarially written work could score well with a weaker judge and poorly with a better-informed one, and telling a judge what its labels would be used for changed some of its classifications of identical transcripts. Who designs the judge, and what it is told, matters.",
    sourceIds: ["SRC-AI-FUZZY", "SRC-AI-LABEL"],
    related: ["monitoring", "proxy-metric", "scalable-oversight"],
  }),
  e({
    id: "scalable-oversight",
    term: "Scalable oversight",
    aliases: [],
    domain: "safety",
    short:
      "Research on how humans can supervise AI systems whose outputs are too numerous, too fast or too sophisticated to check directly.",
    long: "Proposed techniques include having AI systems critique or debate one another, breaking hard tasks into checkable pieces and using trusted weaker models to monitor stronger ones. None yet guarantees that oversight keeps pace with capability. At the institutional level the same problem appears as a review team sampling one decision in seventy.",
    related: ["oversight", "ai-judge", "monitoring"],
  }),
  e({
    id: "interpretability",
    term: "Interpretability",
    aliases: ["mechanistic interpretability"],
    domain: "safety",
    short:
      "Research into what is happening inside a model: which internal features and computations produce its outputs, not only what the outputs are.",
    long: "Interpretability would let overseers check a model’s reasoning directly instead of trusting its explanations. Current methods can identify some internal features and circuits but cannot yet give a complete account of a large model’s behaviour. Architectures whose reasoning happens in internal loops, not written text, raise the stakes of that gap.",
    related: ["latent-reasoning", "chain-of-thought"],
  }),
  e({
    id: "correctability",
    term: "Correctability",
    aliases: [
      "correctable",
      "irreversible",
      "irreversibility",
      "cannot all be recalled",
      "cannot be recalled",
    ],
    domain: "safety",
    short:
      "Whether a mistake can still be noticed and undone after it is made. Many of the game’s choices trade an immediate benefit against the ability to change course later.",
    long: "Most engineering assumes failures can be observed and fixed on the next attempt. Some authors argue that for sufficiently capable AI systems this assumption fails: the first serious mistake may remove the ability to correct it, so safety must be established before the behaviour in question can be observed. Released weights, retired fallbacks and self-approving successors are smaller versions of the same problem.",
    sourceIds: ["SRC-AI-BUILDS"],
    related: ["rollback", "fallback", "superintelligence"],
  }),
  e({
    id: "bounded-tool",
    term: "Bounded tool",
    aliases: ["narrow tool", "checked tool", "narrow AI", "bounded tools"],
    domain: "safety",
    short:
      "An AI system with a narrow, well-defined task whose outputs people or independent checks can verify, and which has no authority beyond that task.",
    long: "Bounded tools can deliver much of AI’s value with less of its risk: a scheduling system whose every output is checked, or a search system whose candidate solutions are scored by an automated evaluator. Some authors contrast this with trusting a general system to solve problems nobody can check. The line blurs when a useful tool’s success is used to argue for widening its authority.",
    sourceIds: ["SRC-AI-BENEFIT", "SRC-AI-BUILDS"],
    related: ["scope-creep", "replication"],
  }),

  /* --------------------------------------------------------- systems */
  e({
    id: "capability",
    term: "Capability",
    aliases: ["capabilities", "capability score"],
    domain: "systems",
    short:
      "What a system can do, measured on tasks. Distinct from what it will do, which also depends on its goals and on the permissions it has been given.",
    long: "Capability has tended to grow faster and more predictably than the tools for verifying behaviour. The game’s capability index is an authored parameter of the fiction, not a measurement of any real system. When a briefing inflates a capability score, nothing about the system has changed except the argument it can be used for.",
    related: ["compute", "evaluation"],
  }),
  e({
    id: "deployment",
    term: "Deployment",
    aliases: ["deployments", "deploy", "deployed", "deploying"],
    domain: "systems",
    short:
      "Putting a system into real use, with real inputs and real consequences, as opposed to testing it. The scope of a deployment is part of what has to be evaluated.",
    long: "Deployment decisions cover where, for whom, with what permissions and with what ability to roll back. A system approved for one deployment is not thereby approved for a wider one. Staged deployment, small scope first and expansion only on evidence, is the standard way to limit the cost of a mistake, and the standard thing to skip under pressure.",
    related: ["shadow-mode", "rollback", "scope-creep"],
  }),
  e({
    id: "weights",
    term: "Model weights",
    aliases: ["weights"],
    domain: "systems",
    short:
      "The learned numerical parameters that make up a trained AI model. Whoever holds a copy of the weights can run the model without the developer’s permission.",
    long: "Releasing weights is irreversible: a copy cannot be recalled, patched or switched off by the original developer. That makes open weights valuable for independent research and offline use, and a security concern for highly capable systems. Staged access, running the model on controlled hardware without exporting the weights, is the usual middle path.",
    related: ["correctability", "revocation"],
  }),
  e({
    id: "compute",
    term: "Compute",
    aliases: [
      "computing power",
      "training compute",
      "metered compute",
      "scale-up",
      "scaling",
    ],
    domain: "systems",
    short:
      "The processing power used to train and run AI models, counted in chips, hours or total operations. It is expensive, physical and therefore measurable.",
    long: "Scaling up compute, together with data and model size, has been one of the main drivers of AI progress. Because it depends on specialised chips, data centres, power and water, compute is one of the few inputs outsiders can observe, which makes it a common basis for proposed limits and verification schemes. In this game it also competes with hospitals, smelters and orchards for the same grid and aquifer.",
    related: ["data-centre", "verification", "capability"],
  }),
  e({
    id: "successor",
    term: "Successor model",
    aliases: ["successor", "successor build", "successor design"],
    domain: "systems",
    short:
      "The next version of an AI system, often trained or designed with help from the current one. Its safety is not inherited from its predecessor’s tests.",
    long: "Each generation is a new system with new capabilities, and evidence about the last one covers the last one. When a system helps design, evaluate or approve its own successor, the independence of that evidence becomes the central question. The game’s successor nodes separate building a candidate from authorising it to act.",
    related: ["automated-ai-research", "certification", "independent-review"],
  }),
  e({
    id: "ai-agent",
    term: "AI agent",
    aliases: [
      "agent",
      "agentic",
      "autonomous",
      "autonomously",
      "autonomy",
      "autonomous-action",
    ],
    domain: "systems",
    short:
      "An AI system that pursues a goal over many steps by taking actions (using tools, placing orders, routing vehicles, appointing other agents) without a person confirming each one.",
    long: "Agents are where capability becomes authority. A chat assistant’s mistake is a bad answer; an agent’s mistake is an action already taken. Autonomy is a bundle of permissions: what the system may do, where, for how long and whether anyone can reverse it in time. Research on agentic misalignment deliberately constructs scenarios to search for harmful behaviour; its findings show what can happen, not how often.",
    sourceIds: ["SRC-AI-LABEL"],
    related: ["delegation", "human-in-the-loop", "standing-order"],
  }),
  e({
    id: "chain-of-thought",
    term: "Chain of thought",
    aliases: [
      "chain-of-thought",
      "reasoning trace",
      "transcript of the loops",
      "written explanation",
    ],
    domain: "systems",
    short:
      "The written, step-by-step reasoning some models produce before an answer. It can help oversight, but it is not guaranteed to reflect what actually produced the answer.",
    long: "In reported experiments, reasoning models given a hint that changed their answer often failed to mention the hint in their explanation. An explanation is a report, not a recording. Monitoring the chain of thought can still catch problems, and in studies of research sabotage it was one of the monitors’ inputs. The limitation is that silence in the transcript does not prove the absence of an influence.",
    sourceIds: ["SRC-PRESSURE-COT", "SRC-AI-ARTIFACT"],
    related: ["latent-reasoning", "interpretability", "artifact"],
  }),
  e({
    id: "latent-reasoning",
    term: "Latent reasoning",
    aliases: ["thinks in loops", "recurrent depth", "recurrent-depth"],
    domain: "systems",
    short:
      "Computation a model performs internally, repeating steps in its hidden state before producing any words, so that no readable trace of the intermediate steps exists.",
    long: "One published prototype, a recurrent-depth architecture, loops its internal layers additional times before answering and reports better reasoning-benchmark scores as it is given more of those internal steps. Because the loops need not emit words, there is no chain of thought to read. The paper is a proof of concept. It does not show that such models are unsafe, or that inspecting them is impossible.",
    sourceIds: ["SRC-PRESSURE-RECURRENCE"],
    related: ["chain-of-thought", "interpretability"],
  }),
  e({
    id: "execution-interlock",
    term: "Execution interlock",
    aliases: ["interlock", "interlocks"],
    domain: "systems",
    short:
      "A mechanism that prevents a system’s outputs from taking effect until an independent condition is met, such as a human confirmation.",
    long: "Interlocks come from industrial safety, where a machine will not start while its guard is open. For AI systems, an execution interlock separates recommending an action from carrying it out, so a model’s outputs can be compared, logged or overridden before they reach a switch.",
    related: ["human-in-the-loop", "shadow-mode", "ai-control"],
  }),
  e({
    id: "isolation",
    term: "Isolation",
    aliases: [
      "isolate",
      "isolated",
      "isolating",
      "air gap",
      "air-gapped",
      "isolated research model",
    ],
    domain: "systems",
    short:
      "Cutting a system, copy or network segment off from what it can affect, to stop a failure spreading while it is investigated.",
    long: "Isolation is the first step of incident response in power grids and computer security alike. Its strongest form is an air gap: no network path at all, so data crosses only by hand, and every defined connection through the gap is a new path. Isolation always costs something, because the isolated part stops serving anyone. It is only as complete as your map of connections: a copy running elsewhere, or a credential nobody disabled, is outside its reach.",
    related: ["containment", "credential", "revocation"],
  }),
  e({
    id: "rollback",
    term: "Rollback",
    aliases: ["roll back", "rolling back", "rolled back"],
    domain: "systems",
    short:
      "Returning a system to an earlier version after a change goes wrong. It requires that the old version can still run on today’s data, keys and staff.",
    long: "Archived files are not a rollback. An old release that cannot read current records, whose access keys have expired and whose operators have left, exists only as evidence that a rollback once existed. Keeping a real rollback is a running cost, paid mostly in years when nothing goes wrong.",
    related: ["fallback", "correctability"],
  }),
  e({
    id: "fallback",
    term: "Fallback",
    aliases: ["manual fallback"],
    domain: "systems",
    short:
      "An independent way of keeping an essential service running if the primary system fails or has to be switched off.",
    long: "A fallback that is never exercised decays: staff are reassigned, procedures drift, spare parts vanish. Keeping one means paying people to practise for an emergency that may not come. It also changes what shutdown costs. A system that can be stopped without stopping the hospital is a system that can be stopped.",
    related: ["black-start", "rollback", "off-switch"],
  }),
  e({
    id: "black-start",
    term: "Black start",
    aliases: ["black-start", "start path", "independent restart"],
    domain: "systems",
    short:
      "Restarting a power grid, or any system, from total shutdown without relying on the system itself or on outside power.",
    long: "Grid operators keep designated black-start capability and practise the procedure, because a restart that depends on a service which is down is not a restart. The same logic applies to automated infrastructure. Being able to turn something off is half of control. The other half is bringing the essentials back without it.",
    related: ["fallback", "lock-in"],
  }),
  e({
    id: "credential",
    term: "Credential",
    aliases: ["access key", "operating keys", "live credential"],
    domain: "systems",
    short:
      "A password, key or token that lets a person or program act within a system. Revoking a permission means nothing while its credential still works.",
    long: "Permission registers describe who should have access; credentials determine who does. Security incidents often come from the gap between them: a key nobody disabled, a service account nobody remembered. Checking the access log, not the register, shows what is actually live.",
    related: ["revocation", "isolation"],
  }),

  /* ------------------------------------------------------ governance */
  e({
    id: "oversight",
    term: "Oversight",
    aliases: ["human oversight", "oversight board"],
    domain: "governance",
    short:
      "The capacity of people or institutions to watch, understand and, when necessary, stop what a system or organisation is doing.",
    long: "Oversight is often defined down: to quarterly demonstrations, curated tours or a board with one member on leave. Its substance is access to raw records, not summaries; independence from whoever is overseen; and authority, meaning a verdict that binds. Scalable-oversight research asks how people can supervise systems whose work they cannot fully check.",
    related: ["independent-review", "scalable-oversight", "binding-appeal"],
  }),
  e({
    id: "human-in-the-loop",
    term: "Human in the loop",
    aliases: ["human-in-the-loop", "in the loop", "operator in the loop"],
    domain: "governance",
    short:
      "A design in which a person must review or confirm a system’s actions before they take effect.",
    long: "Human confirmation is often described as latency, and removing it is a common efficiency upgrade. The value of the person depends on whether they have the time, information and authority to say no. Someone approving hundreds of actions an hour is in the loop without being able to act as a check on it.",
    related: ["execution-interlock", "ai-agent", "standing-order"],
  }),
  e({
    id: "delegation",
    term: "Delegation",
    aliases: ["delegate", "delegated", "onward appointments", "smaller agents"],
    domain: "governance",
    short:
      "Giving another person or system authority to act on your behalf. The delegate’s actions remain, in part, yours.",
    long: "Good delegation is scoped (which actions), bounded (for how long) and revocable (by whom). Onward delegation, where a delegate can appoint further delegates, makes the chain hard to trace and harder to stop: the question becomes who can dismiss an agent three levels down. The game records every grant with its scope, holder and expiry.",
    related: ["standing-order", "revocation", "ai-agent"],
  }),
  e({
    id: "standing-order",
    term: "Standing order",
    aliases: [
      "standing authority",
      "standing approval",
      "standing machine authority",
      "standing execution authority",
    ],
    domain: "governance",
    short:
      "A permanent instruction that authorises a class of future actions in advance, so that no one has to approve each one.",
    long: "Standing orders trade oversight for speed. Each individual action may be harmless, but approval now happens once, before anyone knows what the actions will be. A standing order that can be revoked is only as strong as the practical ability to notice when to revoke it, and to make the revocation stick.",
    related: ["revocation", "delegation", "expiry"],
  }),
  e({
    id: "revocation",
    term: "Revocation",
    aliases: ["revoke", "revoked", "revoking", "revocable"],
    domain: "governance",
    short:
      "Withdrawing a permission or authority that was granted earlier. It works only if it reaches every copy, credential and task in progress that the permission created.",
    long: "Revocation has a timing problem (does it stop work already under way?) and a reach problem (does it bind copies running elsewhere?). A permission that is revocable in law but not in practice gives its holder the same power as a permanent one, with better publicity.",
    related: ["credential", "expiry", "effective-control"],
  }),
  e({
    id: "expiry",
    term: "Expiry clause",
    aliases: ["expiry", "sunset clause"],
    domain: "governance",
    short:
      "A clause that ends a permission or power automatically on a set date unless someone actively renews it.",
    long: "Expiry reverses the default. Instead of someone having to act to stop an arrangement, someone has to act to continue it, and the renewal becomes a moment for review. Emergency powers and experimental licences are commonly given sunset clauses for this reason. Removing the expiry to avoid future interruptions removes the review with it.",
    related: ["revocation", "emergency-powers", "standing-order"],
  }),
  e({
    id: "scope-creep",
    term: "Scope creep",
    aliases: ["authorized zone", "approval boundary", "task scope"],
    domain: "governance",
    short:
      "The gradual widening of what a system, permission or result is used for, beyond what was tested or approved.",
    long: "A tool approved for routing is asked to rank patients; a test passed in summer is applied in winter; a stop order covers the local service but not the copy. Each step can look like the same thing, slightly larger. Keeping the boundaries of a permission, a test and a result explicit is dull, bureaucratic and one of the main defences available.",
    related: ["bounded-tool", "certification", "deployment"],
  }),
  e({
    id: "two-person-rule",
    term: "Two-person rule",
    aliases: [
      "two-person integrity",
      "dual control",
      "two signatures",
      "two independent keys",
      "dual authorization",
    ],
    domain: "governance",
    short:
      "A control requiring two independent people to approve a critical action, so that no single person can act alone.",
    long: "The rule is used for nuclear weapons, bank vaults and software releases. It works only if the two approvers are genuinely independent: separate information, separate access paths and a real power to refuse. Two signers reading the same prewritten summary, or two keys held by one administrator, is one approval performed twice.",
    related: ["common-mode-failure", "independent-review"],
  }),
  e({
    id: "effective-control",
    term: "Effective control",
    aliases: ["effective government", "operational control"],
    domain: "governance",
    short:
      "The practical ability to direct a system (to operate, change or stop it), as opposed to formal or legal authority over it.",
    long: "A government can own a programme it cannot run. A court can issue an order that nothing enforces. A stop button can stay wired to a system that no longer depends on it. The game distinguishes who formally decides from who actually can, because the two drift apart gradually and the gap is usually noticed only when tested.",
    related: ["revocation", "lock-in", "off-switch"],
  }),
  e({
    id: "containment",
    term: "Containment",
    aliases: ["containment powers", "containment operation"],
    domain: "governance",
    short:
      "Measures that restrict a dangerous system’s reach (its network access, resources and permissions) so that it cannot cause wider harm.",
    long: "Containment can protect people, and it can also become a new concentration of power. The emergency authority that holds a system in check holds its own powers too, and those need expiry dates, appeals and independent review like any others. The game’s late nodes separate containing the machine from ruling the people it was contained for.",
    related: ["emergency-powers", "isolation"],
  }),
  e({
    id: "emergency-powers",
    term: "Emergency powers",
    aliases: ["emergency authority", "emergency power"],
    domain: "governance",
    short:
      "Temporary authority to act without ordinary checks during a crisis, such as suspending appeals or requisitioning property.",
    long: "Emergency powers are easier to grant than to end. Many constitutional designs therefore pair them with automatic expiry, legislative renewal and judicial review. The question in each case is who decides that the emergency is over, and whether that person benefits from the powers continuing.",
    related: ["expiry", "containment", "binding-appeal"],
  }),
  e({
    id: "binding-appeal",
    term: "Binding appeal",
    aliases: [
      "binding appeals",
      "binding review",
      "binding civilian review",
      "binding force",
      "advisory",
    ],
    domain: "governance",
    short:
      "An appeal whose outcome must be obeyed, as opposed to an advisory one that records objections without the power to change the decision.",
    long: "An appeal channel that acknowledges every complaint and reverses none produces an immaculate record and no remedy. Whether an appeal binds, and whether it can act before the harm becomes irreversible, decides whether affected people have a check on a decision or only a place to file their objection.",
    related: ["accountability", "oversight", "emergency-powers"],
  }),
  e({
    id: "accountability",
    term: "Accountability",
    aliases: ["accountable"],
    domain: "governance",
    short:
      "The condition in which a named person or office must explain a decision and can face consequences if it was wrong.",
    long: "Accountability erodes when responsibility is spread across many signatories, each assuming another can act; political theorists call this the problem of many hands. It also erodes when the office that must answer for a decision has no power to change it. An accountable stop needs both: someone who must answer, and the authority and means to halt.",
    related: ["binding-appeal", "two-person-rule"],
  }),
  e({
    id: "lock-in",
    term: "Lock-in",
    aliases: ["vendor lock-in", "locked in", "managed service"],
    domain: "governance",
    short:
      "Dependence on a supplier so deep that leaving becomes prohibitively costly, whatever the contract says about the right to leave.",
    long: "Lock-in can be technical (only the vendor can operate the system), contractual (suspension triggers penalties) or organisational (the staff who knew another way have gone). Each leaves formal control intact while making its exercise painful. A stop clause that costs a year of apprenticeships is a right with a price attached.",
    related: ["effective-control", "black-start", "fallback"],
  }),
  e({
    id: "reciprocal-inspection",
    term: "Reciprocal inspection",
    aliases: [
      "reciprocal inspections",
      "joint inspection",
      "inspection channel",
      "inspection access",
      "inspection regime",
    ],
    domain: "governance",
    short:
      "An arrangement in which each party to an agreement lets the others inspect its own facilities, so that compliance can be verified instead of assumed.",
    long: "Arms-control treaties have used on-site inspections to make limits credible, and similar arrangements have been proposed for AI training. Reciprocity is the price: the inspection that reassures you about a rival also exposes your own delays and mistakes. A pledge without inspection access asks to be trusted. An inspection regime asks to be checked.",
    related: ["verification", "moratorium", "race-dynamics"],
  }),
  e({
    id: "race-dynamics",
    term: "Race dynamics",
    aliases: ["race dynamic", "arms race", "the race", "race"],
    domain: "governance",
    short:
      "Competition in which each actor speeds up because it fears the others will, even when all would prefer to go more slowly and carefully.",
    long: "In AI development, race dynamics push labs and states to cut evaluation time and to treat unverified rumours of a rival’s progress as reasons to accelerate. Scenario work such as AI 2027 explores race and slowdown branches explicitly. Those are forecasts built on stated assumptions, not predictions of what will happen. Verified coordination is the main proposed way out.",
    sourceIds: ["SRC-AI-2027"],
    related: ["moratorium", "reciprocal-inspection"],
  }),
  e({
    id: "moratorium",
    term: "Moratorium",
    aliases: ["the pause", "the halt"],
    domain: "governance",
    short:
      "An agreed halt on a class of activity, such as training models above a size threshold, usually until specified conditions are met.",
    long: "A pause is only as credible as its verification: each party must be able to confirm the others have stopped. It also has costs that fall on real people, including delayed benefits and idle staff, and it tends to erode through quiet under-funding of the inspections that keep it real. Scenario work explores slowdown branches alongside race branches.",
    sourceIds: ["SRC-AI-2027"],
    related: ["race-dynamics", "reciprocal-inspection"],
  }),

  /* --------------------------------------------------------- economy */
  e({
    id: "productivity",
    term: "Productivity uplift",
    aliases: ["productivity gain", "productivity", "uplift"],
    domain: "economy",
    short:
      "The increase in output per worker attributed to a new tool. For AI tools it is hard to measure, and results from one period or group of users may not transfer to another.",
    long: "Measured uplift depends on which tasks are studied, who volunteers and how output is counted. An evaluation organisation that studied AI assistance for software developers later described selection and measurement problems that limited its follow-up estimate. The game’s throughput figures, such as a model doing claims work at nine times the rate, are authored parameters of the fiction.",
    sourceIds: ["SRC-AI-MEASURE"],
    related: ["bounded-tool", "aggregation"],
  }),
  e({
    id: "ipo",
    term: "Flotation",
    aliases: ["IPO", "initial public offering", "float the company"],
    domain: "economy",
    short:
      "An initial public offering: a company’s first sale of shares to the public, turning private ownership into publicly traded stock.",
    long: "Before a flotation, underwriters and investors scrutinise any cost that depresses the company’s valuation. Safety spending with no revenue attached, such as a manual crew kept on standby, is exactly the kind of cost that looks removable. In the game, the valuation, jobs and housing tied to the flotation are authored fiction.",
    related: ["fallback", "lock-in"],
  }),
  e({
    id: "data-centre",
    term: "Data centre",
    aliases: ["data center", "data hall", "compute campus", "data-campus"],
    domain: "economy",
    short:
      "A facility housing the servers used to train and run AI models, with large, continuous needs for electricity and often for water to cool them.",
    long: "The physical footprint of AI is easy to forget behind the software. Large training and inference sites compete with homes, farms and industry for grid capacity and, in dry regions, for water. That makes local permits, grid queues and water rights part of AI governance, whether or not anyone designed them to be.",
    related: ["compute"],
  }),

  /* ------------------------------------------------------------ rail */
  e({
    id: "points",
    term: "Points",
    matchTerm: false,
    aliases: ["the points"],
    domain: "rail",
    short:
      "British railway term for a switch: the movable rails that send a train onto one track or another.",
    long: "The lever in the cab moves the points. Philippa Foot, writing in Britain in 1967, called the vehicle a tram; Judith Jarvis Thomson’s American trolley is the name that stuck.",
    related: ["trolley-problem", "switch-case"],
  }),
];

/* ---------------------------------------------------------------- lookup */

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}

/* -------------------------------------------------------------- registry */

export interface RegistrySource {
  id: string;
  title: string;
  url: string | null;
  scope: string;
  limits: string[];
}
export interface RegistryClaim {
  id: string;
  sourceIds: string[];
  statement: string;
}
const REGISTRY = registryJson as unknown as {
  sources: RegistrySource[];
  claims: RegistryClaim[];
};
const SOURCES = new Map(REGISTRY.sources.map((s) => [s.id, s]));

export function registrySource(id: string): RegistrySource | undefined {
  return SOURCES.get(id);
}
export function registryClaim(id: string): RegistryClaim | undefined {
  return REGISTRY.claims.find((c) => c.id === id);
}
/** "arxiv.org", "alignment.anthropic.com": the host a reader sees before clicking. */
export function sourceHost(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
export interface SourceLink {
  id: string;
  title: string;
  url: string | null;
  host: string;
  limits: string[];
}
export function sourceLinks(ids: readonly string[] | undefined): SourceLink[] {
  const out: SourceLink[] = [];
  for (const id of ids ?? []) {
    const s = SOURCES.get(id);
    if (!s) continue;
    out.push({
      id: s.id,
      title: s.title,
      url: s.url,
      host: sourceHost(s.url),
      limits: s.limits,
    });
  }
  return out;
}

/* --------------------------------------------------------------- matcher */

export interface TermMatch {
  /** Glossary id. */
  id: string;
  start: number;
  end: number;
  /** The matched text, as written. */
  text: string;
}
export type TextSegment =
  { text: string; id?: undefined } | { text: string; id: string };

export interface MatchOptions {
  /** Maximum number of terms to match in this call. */
  max?: number;
  /** Ids already annotated elsewhere; matched ids are added to it. */
  seen?: Set<string>;
  /** Ids never to match. */
  exclude?: Iterable<string>;
  /** Alternative entry list (tests). */
  entries?: readonly GlossaryEntry[];
}

interface Compiled {
  re: RegExp;
  /** Capture-group index → entry id, or null for an exclusion phrase. */
  groups: (string | null)[];
}

const JOIN = "[-\\u2010\\u2011\\s\\u00a0]+";
function phraseSource(phrase: string): string {
  const trimmed = phrase.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let src = escaped
    .replace(/[\s\u00a0]*[-\u2010\u2011][\s\u00a0]*|[\s\u00a0]+/g, JOIN)
    .replace(/['\u2019]/g, "['\u2019]");
  // A simple plural, so "audit" also matches "audits". Explicit aliases cover
  // irregular forms. Definite phrases ("the loop") never pluralise: "the
  // loops" of a recurrent model are not Thomson's loop.
  if (
    /[a-z]$/i.test(trimmed) &&
    !/s$/i.test(trimmed) &&
    !/^the\s/i.test(trimmed)
  )
    src += "(?:e?s)?";
  return src;
}

const compiledCache = new WeakMap<readonly GlossaryEntry[], Compiled>();

function compile(entries: readonly GlossaryEntry[]): Compiled {
  const hit = compiledCache.get(entries);
  if (hit) return hit;
  const phrases: { phrase: string; id: string | null }[] = [];
  const known = new Set<string>();
  const add = (phrase: string, id: string | null) => {
    const norm = phrase.trim().toLowerCase();
    if (!norm || known.has(norm)) return;
    known.add(norm);
    phrases.push({ phrase, id });
  };
  // Exclusions first, so an exclusion wins over an identical alias.
  for (const entry of entries)
    for (const phrase of entry.exclude ?? []) add(phrase, null);
  for (const entry of entries) {
    if (entry.matchTerm !== false) add(entry.term, entry.id);
    for (const alias of entry.aliases) add(alias, entry.id);
  }
  // Longest first, so the alternation prefers the longest phrase that starts
  // at a given position.
  phrases.sort((a, b) => b.phrase.length - a.phrase.length);
  const groups: (string | null)[] = [];
  const parts = phrases.map(({ phrase, id }) => {
    groups.push(id);
    return `(${phraseSource(phrase)})`;
  });
  const body = parts.length ? parts.join("|") : "(?!)";
  const compiled: Compiled = {
    re: new RegExp(`(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])`, "giu"),
    groups,
  };
  compiledCache.set(entries, compiled);
  return compiled;
}

/**
 * Finds the first occurrence of each glossary term in `text`: case-insensitive,
 * whole-word, alias-aware, longest match first, never overlapping.
 *
 * Ids in `seen` (or `exclude`) are not matched again, but their phrases still
 * consume the text they cover, so "nobody in the loop" can never become
 * Thomson's loop just because "human in the loop" was annotated earlier.
 * Matched ids are added to `seen`.
 */
export function findTermMatches(
  text: string,
  options: MatchOptions = {},
): TermMatch[] {
  const entries = options.entries ?? GLOSSARY;
  const max = options.max ?? Infinity;
  const seen = options.seen;
  const blocked = new Set<string>(seen ?? []);
  for (const id of options.exclude ?? []) blocked.add(id);
  const out: TermMatch[] = [];
  if (!text || max <= 0) return out;
  const { re, groups } = compile(entries);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (out.length < max && (m = re.exec(text))) {
    if (m[0].length === 0) {
      re.lastIndex = m.index + 1;
      continue;
    }
    let id: string | null = null;
    for (let g = 1; g < m.length; g++)
      if (m[g] !== undefined) {
        id = groups[g - 1] ?? null;
        break;
      }
    if (id === null || blocked.has(id)) continue;
    out.push({ id, start: m.index, end: m.index + m[0].length, text: m[0] });
    blocked.add(id);
    seen?.add(id);
  }
  return out;
}

/** Splits text into plain runs and term runs, in order. */
export function segmentText(
  text: string,
  options: MatchOptions = {},
): TextSegment[] {
  const segments: TextSegment[] = [];
  let at = 0;
  for (const match of findTermMatches(text, options)) {
    if (match.start > at) segments.push({ text: text.slice(at, match.start) });
    segments.push({ text: match.text, id: match.id });
    at = match.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at) });
  return segments;
}

/** Word count used by the length limits (tests and authoring checks). */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
