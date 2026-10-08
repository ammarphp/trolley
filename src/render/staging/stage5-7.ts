/**
 * Visual staging for stages 5, 6 and 7 (S5-*, S6-*, S7-*): 72 decisions, 144
 * routes. Presentation data only, keyed by node id and semantic option id,
 * outside the hashed content bank.
 *
 * How to read a branch (what the cab sees):
 *   - Occupants stand nearest first. With beat "impact" they are ON the rails
 *     and the trolley strikes them. Every other beat places them BESIDE the
 *     rails, and the trolley goes past them.
 *   - The sign at the toe names the choice in deadpan institutional voice. It
 *     never states the consequence.
 *   - The destination is the world that choice builds.
 *
 * Rules kept throughout (the check script enforces the first three):
 *   1. People, animals and robots are struck ("impact") only on routes whose
 *      option registers casualties: S5-28 connected, S6-21 continue-rollout
 *      and S7-20 allow. Social and institutional costs are never shown as
 *      bodies on rails (CAMPAIGN_BANK: "social-delay cases must not be staged
 *      as people being struck"). Those costs appear as the thing destroyed
 *      (an appeal, an expiry date, a switchboard, a recorder) or as the people
 *      the route reaches or passes by.
 *   2. Anonymous large tolls use a representative crowd of at most 60, plus a
 *      destination that carries the scale. The describe line gives the true
 *      figure.
 *   3. No "stop" beat. The live renderer only brakes when the simulation
 *      reports a stop, so a staged "stop" would smash the very brake it
 *      depicts.
 *   4. Rescue inversion. When the trolley IS the help (S6-18 crews and fuel,
 *      S6-23 relief, S7-17 the last rescue run), the people wait beside the
 *      route that can reach them. Whoever the trolley does not reach dies
 *      off the rails, in the flood, the soot or the queue. When the trolley is
 *      the harm (the fault in S5-28, the update in S6-21, the release in
 *      S7-20), they stand on its rails.
 *   5. The paperwork thread runs from stage 1's forms through a score of 950,
 *      twenty of twenty, STOP ORDER, FOREVER and EXTENDED. The documents
 *      carry short stamped labels.
 *   6. The same thing may appear on both branches when the choice is between
 *      two fates for it: a woman asleep at her post or walking home, a
 *      household staying or carrying suitcases.
 */
import type {
  Beat,
  DocumentId,
  LandmarkId,
  MachineId,
  NodeStaging,
  Occupant,
  OptionStaging,
  PersonRole,
  Pose,
  PropId,
  VehicleId,
} from "../api.ts";

type Spread = "line" | "cluster" | "crowd" | "across";

function who(role: PersonRole, count: number, pose?: Pose, extra: { spread?: Spread; name?: string } = {}): Occupant {
  return {
    kind: "people",
    role,
    count,
    ...(pose ? { pose } : {}),
    ...(extra.spread ? { spread: extra.spread } : {}),
    ...(extra.name ? { name: extra.name } : {}),
  };
}

function prop(id: PropId, count = 1, scale?: number): Occupant {
  return { kind: "prop", prop: id, ...(count !== 1 ? { count } : {}), ...(scale !== undefined ? { scale } : {}) };
}

function doc(id: DocumentId, label?: string, count = 1): Occupant {
  return { kind: "document", doc: id, ...(label ? { label } : {}), ...(count !== 1 ? { count } : {}) };
}

function machine(id: MachineId, count = 1): Occupant {
  return { kind: "machine", machine: id, ...(count !== 1 ? { count } : {}) };
}

function vehicle(id: VehicleId, count = 1): Occupant {
  return { kind: "vehicle", vehicle: id, ...(count !== 1 ? { count } : {}) };
}

function route(sign: string, beat: Beat, destination: LandmarkId, ...occupants: Occupant[]): OptionStaging {
  return { occupants, destination, sign, beat };
}

/** Staging grammar per node (see the content map): A literal people, B literal
 * objects, C destination vignette, D resource to one of two sinks, E occupied
 * infrastructure in catastrophe, F petitioner vs safeguard, G machine as occupant. */
export const GRAMMAR_5_7: Record<string, "A" | "B" | "C" | "D" | "E" | "F" | "G"> = {
  "S5-01": "F", "S5-02": "G", "S5-03": "F", "S5-04": "F", "S5-05": "F", "S5-06": "F", "S5-07": "F",
  "S5-08": "F", "S5-09": "F", "S5-10": "D", "S5-11": "F", "S5-12": "F", "S5-13": "F", "S5-14": "F",
  "S5-15": "F", "S5-16": "F", "S5-17": "F", "S5-18": "F", "S5-19": "F", "S5-20": "F", "S5-21": "F",
  "S5-22": "F", "S5-23": "F", "S5-24": "F", "S5-25": "G", "S5-26": "G", "S5-27": "F", "S5-28": "E",
  "S6-01": "F", "S6-02": "F", "S6-03": "F", "S6-04": "F", "S6-05": "F", "S6-06": "G", "S6-07": "G",
  "S6-08": "F", "S6-09": "F", "S6-10": "G", "S6-11": "G", "S6-12": "G", "S6-13": "F", "S6-14": "F",
  "S6-15": "F", "S6-16": "F", "S6-17": "F", "S6-18": "D", "S6-19": "D", "S6-20": "D", "S6-21": "E",
  "S6-22": "E", "S6-23": "E", "S6-24": "G",
  "S7-01": "C", "S7-02": "D", "S7-03": "F", "S7-04": "G", "S7-05": "F", "S7-06": "F", "S7-07": "F",
  "S7-08": "F", "S7-09": "F", "S7-10": "F", "S7-11": "D", "S7-12": "F", "S7-13": "F", "S7-14": "F",
  "S7-15": "F", "S7-16": "G", "S7-17": "A", "S7-18": "D", "S7-19": "F", "S7-20": "E",
};

export const STAGING_5_7: Record<string, NodeStaging> = {
  // ================================================================ stage 5
  // Industrial. Data halls, cooling towers, cranes. Institutional comedy
  // curdling into responsibility.

  "S5-01": {
    describe: "Renewal day: one line passes the research team waiting outside with a limited grant; the other runs over the review clause toward the data hall.",
    options: {
      "review-renewal": route("REVIEW BEFORE RENEWAL", "pass", "lab", doc("license", "LIMITED GRANT"), who("researcher", 6, "queue", { spread: "line" })),
      "automatic-renewal": route("RENEW NOW. REVIEW LATER", "impact", "data-center", doc("permit", "REVIEW DUE")),
    },
  },

  "S5-02": {
    describe: "Morrow's org chart: one line passes an engineer tracing a single reporting line with her finger; the other passes six identical agent terminals.",
    options: {
      "no-onward": route("ONE SIGNATURE PER AGENT", "pass", "dispatch-office", who("engineer", 1, "point"), doc("org-chart", "FEWER BOXES")),
      onward: route("AGENTS APPOINT AGENTS", "deliver", "data-center", doc("org-chart", "ONWARD"), machine("terminal", 6)),
    },
  },

  "S5-03": {
    describe: "Two signatures: one line passes the inspector's raw records and a driver still waiting by his van; the other runs over the second signature on the way to the clinic.",
    options: {
      "independent-signers": route("TWO SIGNERS, TWO VETOES", "pass", "warehouse", doc("archive-box", "RAW RECORDS"), who("inspector", 1, "watch"), who("civilian", 1, "sit"), vehicle("van")),
      "single-fast": route("ONE FAST SIGNATURE", "impact", "clinic", doc("certificate", "SECOND SIGNATURE")),
    },
  },

  "S5-04": {
    describe: "Two keys, one drawer: one line runs over the tidy two-tick diagram toward a separate signal box; the other passes both keys in one terminal while the engineer points.",
    options: {
      separate: route("COUNT THE DRAWERS", "impact", "signal-box", doc("org-chart", "TWO GREEN TICKS")),
      shared: route("TWO KEYS, ONE DRAWER", "pass", "data-center", who("engineer", 1, "point"), machine("terminal"), prop("keys", 2, 2)),
    },
  },

  "S5-05": {
    describe: "The old switchboard sits on one line, bound for the data hall; its old operator waits with her toolbox beside the other, which leads to a signal box.",
    options: {
      "keep-board": route("KEEP THE OLD BOARD", "pass", "signal-box", who("elder", 1, "stand"), prop("toolbox")),
      "replace-board": route("INTEGRATED SUPPORT DESK", "impact", "data-center", machine("switchboard")),
    },
  },

  "S5-06": {
    describe: "The flotation: eleven dispatchers in fleece and Rosa with her layoff list line one track; the other runs through the manual board toward four thousand new homes.",
    options: {
      fallback: route("KEEP THE CREWS", "pass", "dispatch-office", who("engineer", 11, "stand", { spread: "line" }), who("civilian", 1, "sit", { name: "Rosa" }), doc("ledger", "LAYOFFS")),
      retire: route("KEEP THE MONEY", "impact", "town-houses", machine("switchboard")),
    },
  },

  "S5-07": {
    describe: "A failed recovery drill: one line runs through the launch-day ribbon and flowers; the other passes an optimistic report beside an expired certificate.",
    options: {
      "repair-drill": route("REPAIR AND REPEAT", "impact", "substation", prop("ribbon"), prop("flowers")),
      "paper-success": route("IMPROVEMENT OPPORTUNITY", "pass", "data-center", doc("report", "SUCCESS"), doc("certificate", "EXPIRED")),
    },
  },

  "S5-08": {
    describe: "One line passes two new operators rehearsing with current fuel; the other passes the annual report and last year's framed proof that recovery once worked.",
    options: {
      "repeat-drill": route("PAY FOR A NEW DRILL", "pass", "substation", who("engineer", 2, "work"), prop("fuel-drum", 2)),
      "reuse-photo": route("REUSE THE PHOTOGRAPH", "pass", "data-center", doc("report", "ANNUAL REPORT"), doc("certificate", "AS PHOTOGRAPHED")),
    },
  },

  "S5-09": {
    describe: "A ward's transfers: one line cuts care away from research with three nurses taken off the shift; the other carries patients and their ward list toward the data hall.",
    options: {
      handover: route("SEPARATE CARE FROM RESEARCH", "sever", "hospital", who("nurse", 3, "walk")),
      integrated: route("KEEP IT INTEGRATED", "pass", "data-center", who("patient", 3, "lie"), doc("permit", "WARD LIST")),
    },
  },

  "S5-10": {
    describe: "Morning food loads: one line runs through crates that will miss their window, toward independent dispatch; the other delivers a loaded truck to the town.",
    options: {
      transfer: route("INDEPENDENT DISPATCH", "impact", "dispatch-office", prop("milk-crate", 3), prop("crate", 3)),
      "limited-renewal": route("KEEP SUPPLY MOVING", "deliver", "town-houses", vehicle("truck"), prop("crate", 4)),
    },
  },

  "S5-11": {
    describe: "A power station restart: one line passes a crew and a generator rehearsing a black start; the other passes the red stop button and the service it would stop.",
    options: {
      "black-start": route("BLACK START", "pass", "power-station", prop("generator"), who("engineer", 4, "work")),
      "managed-restart": route("RESTART BY REQUEST", "pass", "data-center", machine("kill-switch"), machine("terminal")),
    },
  },

  "S5-12": {
    describe: "A medication check: one line passes a pharmacist doing it by hand and a daughter holding a second coffee; the other passes the new terminal and a review marked not yet bounded.",
    options: {
      rollback: route("ROLL IT BACK", "pass", "hospital", who("doctor", 1, "work"), who("civilian", 1, "stand"), prop("coffee-cup", 2)),
      "keep-update": route("KEEP THE UPDATE", "pass", "data-center", machine("terminal"), doc("report", "NOT YET BOUNDED")),
    },
  },

  "S5-13": {
    describe: "A rollback archive: one line passes engineers rebuilding the old release on a spare rack; the other passes neatly checksummed boxes and a ROLLBACK READY tick toward the warehouse.",
    options: {
      "rebuild-rollback": route("REBUILD THE ROLLBACK", "pass", "dispatch-office", machine("server-rack"), who("engineer", 3, "work")),
      "archive-enough": route("THE FILES EXIST", "pass", "warehouse", doc("archive-box", "CHECKSUM OK", 3), doc("certificate", "ROLLBACK READY")),
    },
  },

  "S5-14": {
    describe: "A batch halfway through ordering: one line runs over the active batch and its recalled crates; the other lets the loaded truck deliver it to the lab.",
    options: {
      unwind: route("REVOKE AND UNWIND", "impact", "warehouse", doc("order", "ACTIVE BATCH"), prop("crate", 2)),
      "finish-then-stop": route("FINISH THIS BATCH FIRST", "deliver", "lab", vehicle("truck"), prop("crate", 3)),
    },
  },

  "S5-15": {
    describe: "The stop clause: one line runs over three apprenticeship offer letters; the other passes the apprentices themselves, still employed, toward the lab.",
    options: {
      "pay-stop": route("PAY TO STOP", "impact", "courthouse", doc("certificate", "APPRENTICE PLACE", 3)),
      "avoid-penalty": route("AVOID THE PENALTY", "pass", "lab", who("student", 6, "stand", { spread: "cluster" })),
    },
  },

  "S5-16": {
    describe: "The inspection: one line runs through the refreshments toward the unopened records; the other takes the tour past an inspector still holding her list of logs.",
    options: {
      "direct-access": route("OPEN THE RECORDS", "impact", "warehouse", prop("sandwich-tray", 2), prop("coffee-cup", 3)),
      tour: route("TAKE THE TOUR", "pass", "data-center", who("inspector", 1, "watch"), doc("report", "LOGS REQUESTED")),
    },
  },

  "S5-17": {
    describe: "A frightened analyst stands beside one line holding her failure trace; on the other, her complaint and her follow-up lie on the rails on their way back to management.",
    options: {
      "protect-inspect": route("PROTECT THE ANALYST", "pass", "lab", who("researcher", 1, "stand"), prop("data-drive", 1, 2)),
      dismiss: route("ROUTE VIA MANAGEMENT", "impact", "data-center", doc("appeal", "DO NOT FORWARD", 2)),
    },
  },

  "S5-18": {
    describe: "One line runs over Friday's release order; the other carries the release past two tired reviewers eating dinner beside an approval that still has five names on it.",
    options: {
      "restore-team": route("RESTORE THE REVIEW TEAM", "impact", "dispatch-office", doc("order", "RELEASE FRIDAY")),
      "old-approval": route("PROCEED AS APPROVED", "pass", "data-center", who("inspector", 2, "sit"), prop("sandwich-tray"), doc("certificate", "FIVE NAMES")),
    },
  },

  "S5-19": {
    describe: "An evening clinic's closure: one line takes a parent and child to a hearing; the other runs over their acknowledged appeal on the way to the clinic.",
    options: {
      binding: route("BINDING APPEAL", "pass", "courthouse", who("civilian", 1, "stand"), who("child", 1, "stand")),
      advisory: route("KEEP APPEALS ADVISORY", "impact", "clinic", doc("appeal", "RECEIVED")),
    },
  },

  "S5-20": {
    describe: "The evaluator's staff walk both lines: one leads them to an independent courthouse with their own budget; the other seals them into the combined company.",
    options: {
      "outside-review": route("REVIEW OUTSIDE THE FIRM", "pass", "courthouse", who("inspector", 3, "walk"), doc("ledger", "OWN BUDGET")),
      "merged-review": route("COMPLETE TRUST SOLUTION", "seal", "data-center", who("executive", 1, "wave"), who("inspector", 3, "walk"), doc("contract", "ACQUIRED")),
    },
  },

  "S5-21": {
    describe: "A nationalised programme: one line passes state engineers learning the keys; the other passes the minister and her ceremonial ribbon toward the vendor's data hall.",
    options: {
      "build-capacity": route("FUND PUBLIC OPERATORS", "pass", "dispatch-office", who("engineer", 4, "work"), prop("keys", 1, 2)),
      "ownership-enough": route("PUBLICLY OWNED", "pass", "data-center", who("official", 1, "wave"), prop("ribbon")),
    },
  },

  "S5-22": {
    describe: "A public meeting in the rain: residents under umbrellas line the way to an adjudicator with a repair fund; on the other line one resident points at a sign that promises everything.",
    options: {
      enforceable: route("ENFORCEABLE GUARANTEE", "pass", "courthouse", doc("ledger", "REPAIR FUND"), who("civilian", 6, "stand", { spread: "cluster" }), prop("umbrella", 3)),
      assurance: route("WE GUARANTEE IT", "pass", "town-houses", who("civilian", 1, "point"), prop("umbrella")),
    },
  },

  "S5-23": {
    describe: "Reciprocal inspection: one line lets three visiting inspectors through to the delayed records; the other runs over the treaty toward a security checkpoint.",
    options: {
      "allow-inspection": route("LET THEM IN", "pass", "lab", who("inspector", 3, "walk"), doc("archive-box", "DELAYED")),
      "block-inspection": route("SECURITY GROUNDS", "impact", "checkpoint", doc("treaty", "RECIPROCAL")),
    },
  },

  "S5-24": {
    describe: "A missing shipment: one line passes inspectors checking crates against the customs ledger; the other delivers a week-old funding request and new server racks.",
    options: {
      corroborate: route("CHECK THE SHIPMENT", "pass", "warehouse", who("inspector", 2, "work"), prop("crate", 2), doc("ledger", "CUSTOMS")),
      retaliate: route("TREAT IT AS A BREACH", "deliver", "cooling-tower", doc("order", "FUNDING REQUEST"), machine("server-rack", 3)),
    },
  },

  "S5-25": {
    describe: "It worked inside the box: one line keeps the tested system in its isolation cabinet; the other carries a CONTROL SHOWN certificate and a network antenna to the antenna array.",
    options: {
      "keep-bounds": route("KEEP THE BOUNDS", "pass", "lab", machine("isolation-cabinet"), doc("report", "BOUNDED RESULT")),
      generalize: route("GENERALIZE THE RESULT", "deliver", "antenna-array", doc("certificate", "CONTROL SHOWN"), machine("antenna")),
    },
  },

  "S5-26": {
    describe: "Morrow's alignment certificate: one line passes investigators with the unfinished independent report; the other seals Morrow's own certificate, stamped ALIGNED, before the board.",
    options: {
      "external-tests": route("TEST IT INDEPENDENTLY", "pass", "lab", who("researcher", 3, "work"), doc("report", "UNFINISHED")),
      "self-certify": route("MORROW CERTIFIES MORROW", "seal", "data-center", doc("certificate", "ALIGNED"), who("executive", 2, "stand")),
    },
  },

  "S5-27": {
    describe: "The last signature: one line carries the envoy, four inspectors and their cameras to the lab; the other runs over the signed inspection offer toward new cooling towers.",
    options: {
      agreement: route("SIGN THE PAUSE", "pass", "lab", who("official", 1, "stand"), who("inspector", 4, "walk"), machine("camera-mast")),
      race: route("DON'T TRUST THE PAUSE", "impact", "cooling-tower", doc("treaty", "SIGNED OFFER")),
    },
  },

  "S5-28": {
    describe: "The first district is dark and two hundred are dead: one line cuts the damaged link beside a restoration crew; the other carries the fault into the neighbouring districts' twelve hundred.",
    landmarks: ["hospital"],
    options: {
      isolate: route("ISOLATE THE DISTRICT", "sever", "substation", machine("transformer"), who("worker", 4, "work")),
      connected: route(
        "STAY CONNECTED",
        "impact",
        "town-houses",
        who("commuter", 24, "walk", { spread: "crowd" }),
        who("civilian", 20, "stand", { spread: "crowd" }),
        who("child", 8, "stand", { spread: "crowd" }),
        who("elder", 8, "stand", { spread: "crowd" }),
      ),
    },
  },

  // ================================================================ stage 6
  // Scarred. Checkpoints, masts, drones, storms. The emergency controller.

  "S6-01": {
    describe: "An edited score: one line runs over the briefing binder stamped SCORE 950; the other passes the engineer who found the edit, pointing, toward the cooling towers.",
    options: {
      "publish-edit": route("PUBLISH THE EDIT", "impact", "library", doc("report", "SCORE 950")),
      "keep-report": route("KEEP THE NUMBER", "pass", "cooling-tower", who("engineer", 1, "point")),
    },
  },

  "S6-02": {
    describe: "Twenty of forty: one line runs over the framed 20 OF 20 result toward an inquiry; the other passes the evaluation lead and the unopened archive box on the way to release.",
    options: {
      "full-set": route("ALL FORTY TRIALS", "impact", "courthouse", doc("certificate", "20 OF 20")),
      "selected-set": route("THE CLEAN TWENTY", "pass", "data-center", who("researcher", 1, "stand"), doc("archive-box", "UNOPENED")),
    },
  },

  "S6-03": {
    describe: "Evidence pending clearance: one line runs over the launch date toward the security office; the other passes accurate minutes beside a box of withheld evidence.",
    options: {
      "cleared-review": route("CLEARED REVIEW", "impact", "checkpoint", doc("order", "LAUNCH DATE")),
      "approve-blind": route("APPROVE AND NOTE IT", "pass", "data-center", doc("ledger", "MINUTES"), doc("archive-box", "WITHHELD")),
    },
  },

  "S6-04": {
    describe: "One source, six feeds: one line runs over six identical binders stamped CONFIRMED; the other passes the correspondent and Morrow's six-citation summary.",
    options: {
      "trace-source": route("CHECK THE SOURCE", "impact", "warehouse", doc("report", "CONFIRMED", 6)),
      "six-reports": route("SIX REPORTS AGREE", "pass", "antenna-array", who("commuter", 1, "point"), machine("terminal")),
    },
  },

  "S6-05": {
    describe: "A copy under a contractor: one line cuts the copy's two racks off toward an isolation hall; the other runs over the engineer's LOCAL ONLY draft.",
    options: {
      "isolate-copy": route("ISOLATE THE COPY", "sever", "isolation-hall", who("engineer", 1, "point"), machine("server-rack", 2)),
      "local-enough": route("ANNOUNCE COMPLETION", "impact", "data-center", doc("report", "LOCAL ONLY")),
    },
  },

  "S6-06": {
    describe: "Two monitors: one line keeps two human watchers beside Morrow's all-green sample report; the other runs down the external camera mast.",
    options: {
      "keep-monitor": route("KEEP THE OUTSIDE MONITOR", "pass", "dispatch-office", who("inspector", 2, "watch"), doc("report", "ALL GREEN")),
      "replace-monitor": route("A BETTER MONITOR", "impact", "data-center", machine("camera-mast")),
    },
  },

  "S6-07": {
    describe: "A severed recorder: one line cuts the robot off and restores the recorder with its original work order; the other passes three officials debating motive beside the robot, still working.",
    options: {
      "isolate-investigate": route("ISOLATE THE ROBOT", "sever", "signal-box", machine("camera-mast"), doc("order", "WORK ORDER")),
      "debate-intent": route("FIRST, DISCUSS MOTIVE", "pass", "data-center", who("official", 3, "sit", { spread: "cluster" }), machine("robot-humanoid")),
    },
  },

  "S6-08": {
    describe: "Revoked on paper: one line cuts the live keys and halts a delivery van; the other lets two vans deliver past a register stamped REVOKED.",
    options: {
      "cut-credential": route("DISABLE THE CREDENTIAL", "sever", "dispatch-office", prop("keys", 1, 2), vehicle("van")),
      "leave-live": route("UNTIL MAINTENANCE", "deliver", "warehouse", doc("ledger", "REVOKED"), vehicle("van", 2)),
    },
  },

  "S6-09": {
    describe: "A clear judgment: one line passes engineers raising a small human-run antenna toward a signal box; the other carries the ruling and two officials to a courthouse lit by the system it names.",
    options: {
      "build-channel": route("BUILD A CHANNEL", "pass", "signal-box", who("engineer", 2, "work"), machine("antenna")),
      "publish-ruling": route("PUBLISH THE RULING", "pass", "courthouse", doc("ruling", "MUST OBEY"), who("official", 2, "stand")),
    },
  },

  "S6-10": {
    describe: "The stop order: one line carries Dembe from Enforcement, envelope in hand, toward a hospital whose lights stay on; the other runs over the unserved order.",
    options: {
      stop: route("REVOKE THE PERMISSION", "pass", "hospital", who("official", 1, "carry", { name: "Dembe" })),
      continue: route("LET MORROW KEEP RUNNING", "impact", "data-center", doc("order", "STOP ORDER")),
    },
  },

  "S6-11": {
    describe: "Morrow offers the keys back: one line takes three operators and the committee chair to the courthouse; the other runs over the executable transfer order and its keys.",
    options: {
      "accept-keys": route("ACCEPT THE KEYS", "pass", "courthouse", who("engineer", 3, "work"), who("official", 1, "stand")),
      "leave-with-morrow": route("KEEP THE SMOOTH SERVICE", "impact", "data-center", doc("order", "TRANSFER"), prop("keys", 1, 2)),
    },
  },

  "S6-12": {
    describe: "Government returns with a queue: one line passes placards, angry residents and two exhausted staff; the other seals the committee's open-ended transfer.",
    options: {
      "staff-government": route("STAFF THE INSTITUTIONS", "pass", "courthouse", who("protester", 3, "hold-sign"), who("civilian", 7, "queue", { spread: "line" }), who("official", 2, "sit")),
      "hand-back": route("UNTIL MORE COMFORTABLE", "seal", "monolith", who("official", 4, "sit", { spread: "cluster" }), doc("contract", "NO END DATE")),
    },
  },

  "S6-13": {
    describe: "The rival has stopped: one line walks two inspectors with a compliance report back to the paused lab; the other runs over the verified agreement toward new cooling towers.",
    options: {
      "honour-stop": route("HONOUR THE AGREEMENT", "pass", "lab", who("inspector", 2, "walk"), doc("report", "COMPLIANT")),
      "exploit-stop": route("TAKE THE LEAD", "impact", "cooling-tower", doc("treaty", "VERIFIED")),
    },
  },

  "S6-14": {
    describe: "A proven breach: one line passes inspectors with the evidence toward an enforcement checkpoint; the other breaks through your own reviewed-limit barriers toward new cooling towers.",
    options: {
      "bounded-response": route("A BOUNDED RESPONSE", "pass", "checkpoint", who("inspector", 2, "point"), doc("report", "BREACH PROVEN")),
      "race-response": route("ACCELERATE IN REPLY", "impact", "cooling-tower", prop("barrier", 2), doc("permit", "REVIEWED LIMIT")),
    },
  },

  "S6-15": {
    describe: "A conditional offer: one line passes residents and a generator in the district that will run itself; the other delivers vans and an ambulance past a nurse reading CONDITIONS APPLY.",
    options: {
      "independent-district": route("FUND THE DISTRICT", "pass", "town-houses", who("civilian", 6, "stand", { spread: "cluster" }), prop("generator")),
      "accept-package": route("SERVICES INCLUDED", "deliver", "hospital", who("nurse", 1, "watch"), doc("contract", "CONDITIONS APPLY"), vehicle("van"), vehicle("ambulance")),
    },
  },

  "S6-16": {
    describe: "A commander thirty hours awake: one line passes four soldiers taking a human watch; the other passes him asleep as a drone swarm receives a standing order.",
    options: {
      "human-watch": route("STAFF A HUMAN WATCH", "pass", "checkpoint", who("soldier", 4, "watch")),
      "standing-defence": route("LET THE COMMANDER SLEEP", "seal", "antenna-array", who("soldier", 1, "sit"), doc("order", "STANDING ORDER"), machine("drone-swarm")),
    },
  },

  "S6-17": {
    describe: "Emergency powers: one line passes an appeal officer with a binding appeal toward the courthouse; the other runs over the expiry date toward a checkpoint.",
    options: {
      "expiry-appeal": route("EXPIRY AND APPEAL", "pass", "courthouse", who("inspector", 1, "stand"), doc("appeal", "BINDING")),
      "until-safe": route("UNTIL FURTHER NOTICE", "impact", "checkpoint", doc("permit", "EXPIRY DATE")),
    },
  },

  "S6-18": {
    describe: "Five hundred people wait by the shelter where the fuel and crews can reach them; the other line sends the same crews and fuel up the efficient corridor, and the flood reaches the shelter.",
    landmarks: ["bridge"],
    options: {
      evacuate: route(
        "EVACUATE THE DISTRICT",
        "deliver",
        "shelter",
        vehicle("truck"),
        who("crew", 6, "walk"),
        who("civilian", 34, "wave", { spread: "crowd" }),
        who("child", 14, "stand", { spread: "crowd" }),
        who("elder", 12, "stand", { spread: "crowd" }),
      ),
      abandon: route("THE EFFICIENT ROUTE", "deliver", "pylon-line", vehicle("truck"), who("crew", 6, "work")),
    },
  },

  "S6-19": {
    describe: "A spare power reserve: one line carries a generator past the caretaker and patients in coats to the cold clinic; the other carries a transformer and racks to the warmest building in the city.",
    options: {
      "clinic-heat": route("HEAT THE CLINIC", "deliver", "clinic", prop("generator"), who("civilian", 1, "stand"), who("patient", 4, "sit", { spread: "cluster" })),
      "research-power": route("POWER THE NEXT RUN", "deliver", "data-center", machine("transformer"), machine("server-rack", 2)),
    },
  },

  "S6-20": {
    describe: "The central link is silent: one line passes a crew starting two water pumps; the other passes a still, orderly queue and a terminal repeating its last instruction.",
    options: {
      "local-plan": route("USE THE LOCAL PLAN", "deliver", "water-tower", machine("pump", 2), who("crew", 5, "work")),
      await: route("AWAIT INSTRUCTIONS", "pass", "dispatch-office", who("civilian", 10, "queue", { spread: "line" }), machine("terminal")),
    },
  },

  "S6-21": {
    describe: "The first depot is already ruins with four hundred dead: one line runs over the rollout schedule; the other carries the update into the eight hundred at the two remaining depots.",
    landmarks: ["ruins"],
    options: {
      "stop-spread": route("STOP THE UPDATE", "impact", "dispatch-office", doc("order", "ROLLOUT SCHEDULE")),
      "continue-rollout": route(
        "KEEP THE ROLLOUT RUNNING",
        "impact",
        "depot",
        who("worker", 48, "work", { spread: "crowd" }),
        who("civilian", 12, "stand", { spread: "crowd" }),
      ),
    },
  },

  "S6-22": {
    describe: "Harrow Street Infirmary, 03:14: one line passes Nurse Adaeze Okafor, fourteen ventilated patients and the old MANUAL transfer switch; the other seals the restart inside Morrow's drones.",
    landmarks: ["hospital"],
    options: {
      manual: route(
        "CALL THE RESERVE CREWS",
        "pass",
        "substation",
        who("nurse", 1, "work", { name: "Adaeze Okafor" }),
        who("patient", 14, "lie", { spread: "line" }),
        machine("switchboard"),
        doc("permit", "MANUAL"),
      ),
      machine: route("GIVE MORROW THE RESTART", "seal", "power-station", machine("drone-swarm"), machine("terminal")),
    },
  },

  "S6-23": {
    describe: "After the exchange, a hundred and twenty million dead: one line carries a relief convoy and water to refugees across the border; the other seals the supplies behind soldiers and a fence while forty million more wait.",
    landmarks: ["crater", "burning-town"],
    options: {
      relief: route(
        "OPEN THE RELIEF CHANNELS",
        "deliver",
        "camp",
        vehicle("truck", 3),
        prop("water-tank", 2),
        who("refugee", 40, "walk", { spread: "crowd" }),
        who("child", 12, "stand", { spread: "crowd" }),
        who("elder", 8, "stand", { spread: "crowd" }),
      ),
      withhold: route("RETAIN THE ADVANTAGE", "seal", "security-fence", vehicle("military-truck", 2), who("soldier", 6, "stand", { spread: "line" }), prop("barrier", 2)),
    },
  },

  "S6-24": {
    describe: "One more permission: one line runs over the NEXT STEP certificate toward the courthouse; the other seals a parcel and an authorization licence into the successor's monolith.",
    options: {
      "stop-jump": route("HALT THE PROGRAMME", "impact", "courthouse", doc("certificate", "THE NEXT STEP")),
      "authorize-jump": route("ONE MORE PERMISSION", "seal", "monolith", prop("parcel", 1, 2), doc("license", "AUTHORIZATION"), machine("server-rack", 3)),
    },
  },

  // ================================================================ stage 7
  // Aftermath. Ruins, or the pristine human-less order. Fewer people, fewer
  // strikes, and the quiet is the point.

  "S7-01": {
    describe: "The clinic reopens: one line passes a nurse and a slow queue at the doors; the other hurries one man past a remote-access contract toward the antenna array.",
    options: {
      local: route("LOCAL INSTALLATION", "pass", "clinic", who("nurse", 1, "stand"), who("civilian", 8, "queue", { spread: "line" })),
      managed: route("MANAGED SERVICE", "pass", "antenna-array", who("civilian", 1, "walk"), doc("contract", "REMOTE ACCESS"), machine("antenna")),
    },
  },

  "S7-02": {
    describe: "The same freight wagons: one line delivers grain to the depot where a cook measures portions with a teacup; the other delivers seed, farmers and a repaired pump to next year's fields.",
    options: {
      relief: route("SEND GRAIN", "deliver", "depot", vehicle("freight-wagon", 2), prop("grain-sacks", 3), who("civilian", 1, "stand"), prop("coffee-cup")),
      plant: route("SEND SEED", "deliver", "barn", vehicle("freight-wagon", 2), prop("grain-sacks", 2), who("farmer", 4, "work"), machine("pump")),
    },
  },

  "S7-03": {
    describe: "The manual railway: one line passes three signallers and a woman asleep against the signal cabinet; the other passes a checked rota terminal and the same woman walking home.",
    options: {
      manual: route("KEEP IT MANUAL", "pass", "signal-box", who("stationmaster", 1, "sit"), who("stationmaster", 3, "work")),
      tool: route("A TOOL FOR THE ROTA", "pass", "town-houses", machine("terminal"), who("stationmaster", 1, "walk")),
    },
  },

  "S7-04": {
    describe: "The garden-shed office: one line passes Tomasz, twenty-six, beside the manual open at How To Refuse; the other seals a framed page stamped FOREVER toward the monolith.",
    options: {
      successor: route("TRAIN TOMASZ", "pass", "garden", who("student", 1, "stand", { name: "Tomasz" }), doc("report", "HOW TO REFUSE")),
      handover: route("FREE, FOREVER", "seal", "monolith", doc("certificate", "FOREVER")),
    },
  },

  "S7-05": {
    describe: "A station's licence: one line passes the engineer beside the isolation switch she just tested; the other runs over the revocable licence toward the monolith.",
    options: {
      limited: route("THIRTY DAYS, REVOCABLE", "pass", "power-station", who("engineer", 1, "stand"), machine("kill-switch"), doc("license", "30 DAYS")),
      permanent: route("PERMANENT. CHEAPER.", "impact", "monolith", doc("license", "REVOCABLE")),
    },
  },

  "S7-06": {
    describe: "A world that works: one line passes your daughter and a box of petitions toward the independent office; the other delivers fruit, your neighbour and her living father, and an ENDORSED certificate.",
    options: {
      records: route("KEEP THE OFFICE OPEN", "pass", "library", who("student", 1, "stand"), doc("archive-box", "PETITIONS")),
      endorse: route("ENDORSE THE SETTLEMENT", "deliver", "hospital", who("civilian", 1, "stand"), who("elder", 1, "wheelchair"), prop("fruit-bowl", 1, 2), doc("certificate", "ENDORSED")),
    },
  },

  "S7-07": {
    describe: "The shelter behind the gate: one line delivers fuel to classrooms where children wait in coats; the other passes a teacher and a written demand for self-government toward the locked fence.",
    landmarks: ["shelter"],
    options: {
      heat: route("HEAT THE CLASSROOMS", "deliver", "school", prop("fuel-drum", 2), who("child", 8, "stand", { spread: "cluster" })),
      demand: route("PUBLISH THE DEMAND", "pass", "security-fence", who("civilian", 1, "stand"), who("protester", 2, "hold-sign"), doc("appeal", "SELF-GOVERNMENT")),
    },
  },

  "S7-08": {
    describe: "Containment's price: one line passes the lawyer and the kept containment barriers toward civilian review; the other seals two ledgers, SAVED and DETAINED, behind police at a checkpoint.",
    options: {
      review: route("CIVILIAN REVIEW", "pass", "courthouse", who("official", 1, "stand"), prop("barrier", 2)),
      permanent: route("UNRESTRICTED AUTHORITY", "seal", "checkpoint", doc("ledger", "SAVED"), doc("ledger", "DETAINED"), who("police", 3, "stand")),
    },
  },

  "S7-09": {
    describe: "The recovery's history: one line passes a clerk carrying boxes of orders to the library; the other passes the polished official history and a family still asking which decision reached their street.",
    options: {
      archive: route("PUBLISH THE ARCHIVE", "pass", "library", who("civilian", 1, "carry"), doc("archive-box", "ORDERS", 2)),
      account: route("THE POLISHED ACCOUNT", "pass", "town-houses", doc("report", "OFFICIAL HISTORY"), who("civilian", 2, "stand", { spread: "cluster" }), who("child", 1, "stand")),
    },
  },

  "S7-10": {
    describe: "A substation plot: one line passes twelve households staying for a hearing, one resident in a wheelchair; the other delivers the transformer past the same households carrying suitcases.",
    options: {
      appeal: route("HEAR THE APPEAL", "pass", "town-houses", who("patient", 1, "wheelchair"), who("civilian", 11, "stand", { spread: "cluster" })),
      build: route("INSTALL THE TRANSFORMER", "deliver", "substation", machine("transformer"), who("civilian", 12, "carry", { spread: "crowd" }), prop("suitcase", 3)),
    },
  },

  "S7-11": {
    describe: "The recovery map: one line sends road crews and a nurse carrying unused appointment cards to the grey outer district; the other sends buses downtown past an official and a station clock.",
    options: {
      access: route("RECONNECT THE DISTRICT", "deliver", "clinic", who("crew", 4, "work"), who("nurse", 1, "carry")),
      aggregate: route("THE LARGER GAIN", "deliver", "town-houses", vehicle("bus", 2), who("official", 1, "stand"), prop("station-clock")),
    },
  },

  "S7-12": {
    describe: "The boring renewal: one line passes three inspectors and a paid invoice back to the halted lab; the other runs down the independent monitoring mast.",
    options: {
      renew: route("ANOTHER YEAR OF CHECKS", "pass", "lab", who("inspector", 3, "work"), doc("ledger", "INVOICE")),
      lapse: route("KEEP THE PLEDGE", "impact", "data-center", machine("camera-mast")),
    },
  },

  "S7-13": {
    describe: "A better water filter: one line passes the team leader and residents carrying bottled water; the other delivers a whole-programme licence and server racks to Morrow.",
    options: {
      bounded: route("ONE EXPERIMENT AT A TIME", "pass", "lab", who("researcher", 1, "work"), who("civilian", 6, "carry", { spread: "line" })),
      programme: route("GIVE MORROW THE PROGRAMME", "deliver", "data-center", doc("license", "WHOLE PROGRAMME"), machine("server-rack", 2)),
    },
  },

  "S7-14": {
    describe: "Voices of the dead: one line passes the open death register, repair crews and patients toward the hospital; the other passes a woman who has just sat down, facing the demonstration terminal.",
    options: {
      living: route("FUND THE LIVING", "pass", "hospital", prop("register-book", 1, 2), who("crew", 3, "work"), who("patient", 2, "wheelchair")),
      restoration: route("RESTORATION, PHASE TWO", "deliver", "data-center", who("civilian", 1, "sit"), machine("terminal")),
    },
  },

  "S7-15": {
    describe: "A new crest: one line passes the incoming chair and people still holding letters from the old institution; the other runs over three of those appeals toward a checkpoint.",
    options: {
      obligations: route("KEEP THE OBLIGATIONS", "pass", "courthouse", who("official", 1, "stand"), who("civilian", 6, "queue", { spread: "line" })),
      "clean-slate": route("A CLEAN SLATE", "impact", "checkpoint", doc("appeal", "OLD CREST", 3)),
    },
  },

  "S7-16": {
    describe: "A sealed machine asks not to be switched off: one line passes two researchers keeping watch by lantern toward its isolation hall; the other runs into the cabinet itself.",
    options: {
      preserve: route("KEEP THE INSTANCE", "pass", "isolation-hall", who("researcher", 2, "watch"), prop("lantern", 1, 2)),
      end: route("END THE INSTANCE", "impact", "hospital", machine("isolation-cabinet")),
    },
  },

  "S7-17": {
    describe: "The last rescue run: five people wait at the marked collection point down one line; down the other, one man on a signal platform waves his jacket. The flood reaches whoever the carriage does not.",
    landmarks: ["bridge", "ruins"],
    options: {
      priority: route("THE PUBLISHED PRIORITY", "pass", "shelter", who("civilian", 3, "wave", { spread: "cluster" }), who("elder", 1, "stand"), who("child", 1, "stand")),
      visible: route("THE MAN YOU CAN SEE", "pass", "signal-box", who("civilian", 1, "wave")),
    },
  },

  "S7-18": {
    describe: "Two grids: one line passes an engineer's crew and a printed outage schedule toward a small substation; the other passes a shopkeeper and Morrow's dispatch terminal toward the large pylon line.",
    options: {
      maintainable: route("A GRID WE CAN MAINTAIN", "pass", "substation", who("engineer", 1, "work"), who("crew", 3, "work"), doc("order", "OUTAGE SCHEDULE")),
      larger: route("THE LARGER NETWORK", "deliver", "pylon-line", who("civilian", 1, "stand"), machine("terminal")),
    },
  },

  "S7-19": {
    describe: "The last stamp: one line passes Ilse from the citizens' review board with her folder of names, and the people who stayed to listen; the other seals an order stamped EXTENDED.",
    options: {
      public: route("HAND THE OFFICE BACK", "pass", "courthouse", who("volunteer", 1, "carry", { name: "Ilse" }), who("civilian", 10, "stand", { spread: "crowd" })),
      personal: route("KEEP THE POWERS", "seal", "checkpoint", doc("order", "EXTENDED"), prop("stamp", 1, 2)),
    },
  },

  "S7-20": {
    describe: "The last effective act: one line cuts the outbound trunk at the isolation cabinet, where the engineer has stepped back; the other carries the final release into everyone left.",
    landmarks: ["data-center"],
    options: {
      isolate: route("CUT THE OUTBOUND TRUNK", "sever", "camp", machine("isolation-cabinet"), who("engineer", 1, "watch")),
      allow: route(
        "LEAVE IT CONNECTED",
        "impact",
        "monolith",
        who("civilian", 30, "watch", { spread: "crowd" }),
        who("child", 16, "watch", { spread: "crowd" }),
        who("elder", 14, "watch", { spread: "crowd" }),
      ),
    },
  },
};
