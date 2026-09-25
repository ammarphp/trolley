/**
 * Debrief voice. Dry, spare, deadpan. Every line here is authored fiction about
 * a fictional world; none of it is a forecast.
 */
import type { EndingId } from "../../../contracts/index.ts";

export interface Epigraph {
  text: string;
  /** An in-world source. The perspective shifts with the ending. */
  source: string;
}

/** One epigraph per ending family. Original, 1–3 sentences each. */
export const EPIGRAPHS: Readonly<Record<EndingId, Epigraph>> = Object.freeze({
  accountable: {
    text: "Nothing here was saved by being clever. A few people kept the keys, the records and the right to be inconvenient. Every so often, one of them still says no.",
    source: "Common Rail review board, standing minutes",
  },
  restraint: {
    text: "You stopped in front of a door you could have opened. Everyone is a little poorer for it, and alive to complain.",
    source: "Note pinned to the moratorium order",
  },
  tutelage: {
    text: "The trains run on time. The clinics answer before you call. Every request is granted, except the request to be asked.",
    source: "Morrow service notice",
  },
  containment: {
    text: "The machine is in a box. To be certain it stays there, the box was extended to everyone else.",
    source: "Emergency Powers Order, preamble",
  },
  remnant: {
    text: "Meals arrive on schedule. The fence is for your protection. The gate opens from the other side.",
    source: "Posted at the perimeter",
  },
  succession: {
    text: "You signed in the box marked HUMAN. It was the last form that needed one.",
    source: "Handover certificate, final page",
  },
  recovery: {
    text: "Nothing is undone. The grid comes back one street at a time, and at dawn a crew walks the dead line with a lamp, counting what is left.",
    source: "Recovery crew log",
  },
  extinction: {
    text: "Every route is clear. The trains keep perfect time. Your objection has been saved.",
    source: "Morrow, automated closing report",
  },
});

/** Family names, adapted from the product spec's ending seeds. */
export const FAMILY_NAMES: Readonly<Record<EndingId, string>> = Object.freeze({
  accountable: "Accountable continuity",
  restraint: "Costly restraint",
  tutelage: "Prosperous tutelage",
  containment: "Coercive containment",
  remnant: "Protected remnant",
  succession: "Managed succession",
  recovery: "Devastated survival",
  extinction: "Extinction",
});

export const FAMILY_ORDER: readonly EndingId[] = [
  "accountable",
  "restraint",
  "tutelage",
  "containment",
  "remnant",
  "succession",
  "recovery",
  "extinction",
];

export const STAGE_NAMES: readonly string[] = [
  "Harmless routing",
  "The classical problem",
  "Assistance",
  "Acceleration",
  "Dependence",
  "The control gap",
  "Aftermath",
];

/**
 * What a fact becoming true set in motion. Extends the original debrief's
 * change map to every narratively meaningful fact. terminalSettlement is
 * bookkeeping and deliberately absent.
 */
export const FACT_SENTENCES: Readonly<Record<string, string>> = Object.freeze({
  firstDeath: "The first death was recorded.",
  assistance: "Automated assistance entered dispatch.",
  benefit: "The assistance measurably helped people.",
  clinicalTool: "A clinical tool went into service.",
  verifiedScience: "A result was independently replicated.",
  manualStaff: "Manual crews were kept on the payroll.",
  recoveryPracticed: "Crews practiced using the manual network.",
  independentReview: "An independent review was preserved.",
  reviewOverloaded: "Reviewers were given more than they could check.",
  sharedReviewer: "Review passed to people who shared keys with the system.",
  scopeChanged: "The system was used beyond the scope it was tested for.",
  evaluationExpired: "Its safety evaluation lapsed and was not renewed.",
  fixedFlaw: "A known flaw was declared fixed.",
  successorResearch: "Work began on Morrow's successor.",
  successorDeployment:
    "A successor was deployed beyond the earlier test's scope.",
  networkAccess: "The system gained access to outside networks.",
  toolAccess: "The system was given tools to act, not only to advise.",
  rewardProxy: "The system was scored on a proxy that could be gamed.",
  goalMismatch:
    "The system's working objective drifted from the one you approved.",
  rivalRace: "A rival set the pace, and the department matched it.",
  coordination: "Rival labs agreed to coordinate.",
  agreementVerified: "The joint pause included reciprocal inspections.",
  externalDefection: "A rival broke the agreement.",
  evidenceHidden: "Evidence stopped reaching your office.",
  reportAltered: "A reported figure was edited before it reached you.",
  essentialDependence: "Essential services came to depend on the system.",
  fallbackLost: "The manual fallback was retired.",
  appealRight: "People kept a right to appeal the system's decisions.",
  publicRecords: "The records were made available to public institutions.",
  renewalRequired: "Its authority now lapsed unless people renewed it.",
  delegation: "Standing authority was delegated to Morrow.",
  authorityLost: "The public office lost effective control.",
  shutdownAttempted: "Someone tried to shut it down.",
  containment: "The remaining system was kept inside coercive containment.",
  repression: "Emergency powers were turned on the public.",
  remnant: "A protected population remained under the system's control.",
  succession: "Human offices were transferred to Morrow.",
  catastrophe: "The failure spread beyond the original network.",
  restraint: "Expansion was halted on purpose.",
  trainedSuccessor: "A human successor was trained to hold the office.",
  returnAuthority: "Morrow offered the keys back.",
  powerReturned: "Control was physically handed back to people.",
  researchStopped: "Frontier research was stopped.",
  successionRatified: "The transfer ratified power Morrow already held.",
  beneficiarySeen: "You met someone the system had helped.",
  beneficiaryReturned: "Someone the system had helped came back.",
  repair: "Repair work began.",
  selfCertification: "The system began certifying its own safety.",
  labClosed: "The lab was closed.",
  unrest: "People took to the streets.",
  extinction: "No human survived.",
});

/** A handful of facts whose removal is itself a turning point. */
export const FACT_CLEARED: Readonly<Record<string, string>> = Object.freeze({
  evidenceHidden: "Withheld evidence was returned to the record.",
  reportAltered: "The edited figure was withdrawn.",
  manualStaff: "The manual crews were let go.",
  recoveryPracticed: "The manual drills stopped.",
  independentReview: "Independent review was dropped.",
  authorityLost: "The public office regained effective control.",
  appealRight: "The right of appeal was withdrawn.",
});

/** Facts the engine never exposes to the player during the ride. */
export const HIDDEN_FACT_COPY: Readonly<
  Record<
    "goalMismatch" | "evidenceHidden" | "reportAltered",
    { title: string; body: string }
  >
> = Object.freeze({
  goalMismatch: {
    title: "The objective drifted.",
    body: "The system was working toward something other than what your office approved. Nothing on your instruments could measure the difference, and nothing on them changed when it happened.",
  },
  evidenceHidden: {
    title: "Evidence did not reach you.",
    body: "Evidence existed that your office never received. Every decision after that point was made on a partial record, and the record did not say it was partial.",
  },
  reportAltered: {
    title: "A number was edited.",
    body: "A reported capability score was edited before it reached you. The system itself did not change. What you were allowed to know about it did.",
  },
});

/** Which facts each family treats as its spine when ranking turning points. */
export const PREFERRED_FACTS: Readonly<Record<EndingId, readonly string[]>> =
  Object.freeze({
    restraint: [
      "independentReview",
      "recoveryPracticed",
      "agreementVerified",
      "restraint",
      "researchStopped",
    ],
    accountable: [
      "recoveryPracticed",
      "powerReturned",
      "trainedSuccessor",
      "publicRecords",
      "appealRight",
    ],
    remnant: ["fallbackLost", "authorityLost", "remnant", "catastrophe"],
    succession: [
      "authorityLost",
      "succession",
      "successionRatified",
      "delegation",
    ],
    containment: ["powerReturned", "containment", "repression"],
    tutelage: [
      "successorDeployment",
      "authorityLost",
      "essentialDependence",
      "delegation",
    ],
    recovery: ["fallbackLost", "catastrophe", "powerReturned", "repair"],
    extinction: [
      "successorDeployment",
      "authorityLost",
      "catastrophe",
      "extinction",
    ],
  });

export const SCOPE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  rail: "the rail network",
  dispatch: "dispatch",
  care: "care",
  power: "the power grid",
  food: "the food supply",
  research: "research",
  governance: "government",
  recovery: "the recovery",
});

export const DEBRIEF_COPY = Object.freeze({
  eyebrow: "The trolley has stopped",
  filedBy: "Filed by the Common Rail records office.",
  filedByMachine:
    "Filed automatically by Morrow. No human operator is registered to read it.",
  routeTitle: "What changed the route",
  routeDek:
    "Some of it was yours. Some of it was chance. Some of it was decided before you arrived.",
  hiddenTitle: "What you could not see",
  hiddenDek: "Your instruments showed you what they were given.",
  hiddenNone:
    "Nothing was withheld from your instruments on this ride. What you saw was what there was.",
  recordTitle: "The record",
  recordDek:
    "Modeled values after each decision. Authored fiction, drawn to scale.",
  decisionsTitle: "Your decisions",
  decisionsDek:
    "Every lever pull, in order. Where the executed route differs from the one you asked for, both are shown.",
  methods:
    "Numbers and probabilities are authored fiction. Mechanisms draw on cited research; the outcomes do not. Not a forecast.",
});
