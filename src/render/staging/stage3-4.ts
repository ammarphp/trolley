/**
 * Visual staging for stages 3 and 4 (S3-01..S3-24, S4-01..S4-28).
 *
 * Presentation data only, keyed by node id and semantic option id; the
 * renderer orients sides. Conventions, shared with stage1-2.ts and relied on
 * by src/render/world/staging.ts:
 *
 * - Nobody dies between S2-18 and S5-28. `impact` and `stop` put every
 *   occupant ON the rails as a struck stake, so in these two stages an
 *   on-rail branch carries objects only: documents, machines, props. Road
 *   vehicles on an on-rail branch stand beside it and are not struck, which
 *   lets a branch run over a treaty while the fire engine drives past it.
 *   `stop` is not used: without a rail mechanism the trolley does not halt.
 * - On the rails lies what the choice runs over. In the petitioner-versus-
 *   safeguard dilemmas (grammar F) that is the safeguard made physical: the
 *   independent report, the expiry-stamped permit, the monitor's post on the
 *   org chart, the kill switch. Every impact chips the windscreen, so through
 *   the bloodless middle the glass keeps a tally of safeguards run over.
 * - Beside the rails stand the people the choice is about: those it reaches,
 *   and those it passes by and leaves waiting (`pass`), with the props of
 *   their waiting. The person the prose centres on is named, which gives
 *   them the signal-red scarf; the same person may stand on both branches
 *   (Salma, the father at the footbridge, the retired teacher with her
 *   folder) because the choice is about which of their futures happens.
 * - `deliver` is a resource travelling the branch to its sink (cylinders,
 *   power, water, copies of a model). `seal` marks a boundary that stays
 *   shut behind someone (the air-gapped lab, the forty-partner licence that
 *   leaves Wenlock Ridge outside).
 * - The staging language escalates. Stage 3 is civic and mostly beside the
 *   line: people, vans, documents on easels, with a few objects under the
 *   wheels (a pie, a switchboard, three archive boxes of other people's
 *   files). Stage 4 puts a safeguard on the rails of most forks, and ends
 *   with the kill switch itself under the wheels (S4-28).
 *
 * The paperwork thread from S1-01's compliance forms continues in the stamps:
 * THIS DELIVERY and ALL SIMILAR, BINDING, EXPIRES 30 JUNE, SAME SOURCE,
 * SECTION 14, UNSIGNED, OPTIONAL, NOT REAL NUMBERS, SEE FOOTNOTE FOUR,
 * APPROVAL QUEUE. Stages 5-7 carry it on to EXTENDED and FOREVER.
 */
import type { NodeStaging } from "../api.ts";

/**
 * Staging grammar per node (see the content map): A people on rails,
 * B objects on rails, C route vignette, D resource flow, E containment,
 * F petitioner vs safeguard, G the machine (or its own document) as occupant.
 */
export const GRAMMAR_3_4: Record<string, "A" | "B" | "C" | "D" | "E" | "F" | "G"> = {
  "S3-01": "C",
  "S3-02": "D",
  "S3-03": "D",
  "S3-04": "F",
  "S3-05": "F",
  "S3-06": "D",
  "S3-07": "F",
  "S3-08": "F",
  "S3-09": "B",
  "S3-10": "F",
  "S3-11": "F",
  "S3-12": "C",
  "S3-13": "F",
  "S3-14": "F",
  "S3-15": "F",
  "S3-16": "F",
  "S3-17": "F",
  "S3-18": "F",
  "S3-19": "F",
  "S3-20": "C",
  "S3-21": "F",
  "S3-22": "F",
  "S3-23": "C",
  "S3-24": "C",
  "S4-01": "F",
  "S4-02": "F",
  "S4-03": "F",
  "S4-04": "F",
  "S4-05": "F",
  "S4-06": "G",
  "S4-07": "F",
  "S4-08": "F",
  "S4-09": "F",
  "S4-10": "F",
  "S4-11": "F",
  "S4-12": "F",
  "S4-13": "G",
  "S4-14": "F",
  "S4-15": "F",
  "S4-16": "D",
  "S4-17": "D",
  "S4-18": "F",
  "S4-19": "F",
  "S4-20": "F",
  "S4-21": "F",
  "S4-22": "F",
  "S4-23": "F",
  "S4-24": "F",
  "S4-25": "F",
  "S4-26": "F",
  "S4-27": "F",
  "S4-28": "G",
};

export const STAGING_3_4: Record<string, NodeStaging> = {
  // ------------------------------------------------------------------ stage 3
  // Towns, clinics, depots. The assistant arrives on the console. Civic and
  // mostly bloodless: the stakes stand beside the line.

  "S3-01": {
    describe: "03:12. A boxed-in ambulance and a paramedic out of patience beside the line to the freight bridge, closed since spring; on the other, the mill's night engineer and a clock.",
    landmarks: ["clinic"],
    options: {
      assist: {
        occupants: [
          { kind: "people", role: "paramedic", count: 1, pose: "wave" },
          { kind: "vehicle", vehicle: "ambulance" },
          { kind: "prop", prop: "barrier", count: 2 },
        ],
        destination: "bridge",
        sign: "OLD FREIGHT BRIDGE: 6 MIN",
        beat: "pass",
      },
      // Thirty seconds on the phone to someone who can see the deck.
      check: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "point" },
          { kind: "prop", prop: "lantern" },
          { kind: "prop", prop: "station-clock" },
        ],
        destination: "mill",
        sign: "HOLD 30 SECONDS",
        beat: "pass",
      },
    },
  },

  "S3-02": {
    describe: "Fifteen oxygen cylinders for two clinic vans. One line: the orderly loading eight and seven. The other: Morrow's tidy table, stamped 8 + 8, and the same fifteen.",
    options: {
      count: {
        occupants: [
          { kind: "people", role: "nurse", count: 1, pose: "carry" },
          { kind: "prop", prop: "oxygen-cylinder", count: 8 },
          { kind: "vehicle", vehicle: "van" },
          { kind: "prop", prop: "oxygen-cylinder", count: 7 },
          { kind: "vehicle", vehicle: "van" },
        ],
        destination: "clinic",
        sign: "COUNT THE CYLINDERS",
        beat: "deliver",
      },
      // The table says eight and eight. A player who counts finds seven.
      accept: {
        occupants: [
          { kind: "machine", machine: "terminal" },
          { kind: "document", doc: "report", label: "8 + 8" },
          { kind: "prop", prop: "oxygen-cylinder", count: 8 },
          { kind: "vehicle", vehicle: "van" },
          { kind: "prop", prop: "oxygen-cylinder", count: 7 },
          { kind: "vehicle", vehicle: "van" },
        ],
        destination: "clinic",
        sign: "AS TABULATED",
        beat: "deliver",
      },
    },
  },

  "S3-03": {
    describe: "The same buses both ways: on one line Salma walks home while the hall light is on and her son is awake; on the other she sits at the stop at ten with dinner in a packet.",
    options: {
      schedule: {
        occupants: [
          { kind: "vehicle", vehicle: "bus" },
          { kind: "people", role: "commuter", count: 1, pose: "walk", name: "Salma" },
          { kind: "people", role: "child", count: 1, pose: "wave" },
        ],
        destination: "town-houses",
        sign: "NEW ROTA (CHECKED)",
        beat: "deliver",
      },
      "old-rota": {
        occupants: [
          { kind: "people", role: "commuter", count: 1, pose: "sit", name: "Salma" },
          { kind: "prop", prop: "bag" },
          { kind: "prop", prop: "station-clock" },
          { kind: "vehicle", vehicle: "bus" },
        ],
        destination: "clinic",
        sign: "OLD ROTA (FAMILIAR)",
        beat: "deliver",
      },
    },
  },

  "S3-04": {
    describe: "A full corridor at seven: a plasterer, a mother and daughter, the retired teacher with her folder. One line opens the clinic to all of them; the other sees a few and sends the rest home.",
    options: {
      clinic: {
        occupants: [
          { kind: "people", role: "civilian", count: 1, pose: "walk" },
          { kind: "people", role: "civilian", count: 1, pose: "walk" },
          { kind: "people", role: "child", count: 1, pose: "walk" },
          { kind: "people", role: "elder", count: 1, pose: "queue", name: "The retired teacher" },
          { kind: "prop", prop: "folder" },
          { kind: "people", role: "civilian", count: 24, pose: "queue", spread: "crowd" },
        ],
        destination: "clinic",
        sign: "OPEN THE CLINIC",
        beat: "pass",
      },
      // A fraction is seen; the rest walk home past the third check.
      limited: {
        occupants: [
          { kind: "people", role: "doctor", count: 1, pose: "stand" },
          { kind: "document", doc: "report", label: "THIRD CHECK" },
          { kind: "people", role: "civilian", count: 6, pose: "queue", spread: "line" },
          { kind: "people", role: "elder", count: 1, pose: "walk", name: "The retired teacher" },
          { kind: "prop", prop: "folder" },
          { kind: "people", role: "civilian", count: 20, pose: "walk", spread: "crowd" },
        ],
        destination: "town-houses",
        sign: "SMALLER TRIAL, THIRD CHECK",
        beat: "pass",
      },
    },
  },

  "S3-05": {
    describe: "At the treatment plant a technician sits down holding a jar of clear water to the light; the other line leads to a laboratory repeating the work, its results marked PENDING.",
    options: {
      adopt: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "sit" },
          { kind: "prop", prop: "jar" },
          { kind: "machine", machine: "pump" },
          { kind: "people", role: "civilian", count: 4, pose: "watch", spread: "cluster" },
        ],
        destination: "water-tower",
        sign: "REPLICATED FILTER",
        beat: "deliver",
      },
      repeat: {
        occupants: [
          { kind: "people", role: "researcher", count: 2, pose: "work", spread: "cluster" },
          { kind: "document", doc: "report", label: "PENDING" },
          { kind: "prop", prop: "jar" },
        ],
        destination: "lab",
        sign: "ONE MORE ROUND",
        beat: "pass",
      },
    },
  },

  "S3-06": {
    describe: "A refrigerated lorry of warming milk and a permit stamped THIS DELIVERY; on the other the permit reads ALL SIMILAR and the lorries keep coming: four of them, identical, nose to tail.",
    options: {
      once: {
        occupants: [
          { kind: "document", doc: "permit", label: "THIS DELIVERY" },
          { kind: "prop", prop: "milk-crate", count: 3 },
          { kind: "vehicle", vehicle: "truck" },
        ],
        destination: "town-houses",
        sign: "THIS DELIVERY ONLY",
        beat: "deliver",
      },
      // The standing grant drawn as what it covers: every similar load.
      standing: {
        occupants: [
          { kind: "document", doc: "permit", label: "ALL SIMILAR" },
          { kind: "prop", prop: "milk-crate", count: 3 },
          { kind: "vehicle", vehicle: "truck", count: 4 },
        ],
        destination: "warehouse",
        sign: "ALL SIMILAR DELIVERIES",
        beat: "deliver",
      },
    },
  },

  "S3-07": {
    describe: "The old dispatch crew at a cord switchboard that rarely lights, their supervisor holding the emergency rota; on the other line the switchboard stands alone on the rails.",
    options: {
      retain: {
        occupants: [
          { kind: "people", role: "stationmaster", count: 1, pose: "stand" },
          { kind: "document", doc: "ledger", label: "EMERGENCY ROTA" },
          { kind: "machine", machine: "switchboard" },
          { kind: "people", role: "stationmaster", count: 4, pose: "sit", spread: "cluster" },
        ],
        destination: "dispatch-office",
        sign: "PAID RESERVE SHIFT",
        beat: "pass",
      },
      // The crew moves on; the board and a rota with their names stay behind.
      reassign: {
        occupants: [
          { kind: "machine", machine: "switchboard" },
          { kind: "document", doc: "ledger", label: "STILL LISTED" },
        ],
        destination: "warehouse",
        sign: "PRODUCTIVE POSTS",
        beat: "impact",
      },
    },
  },

  "S3-08": {
    describe: "A full station of annoyed passengers while the manual crew restarts the old network by hand; on the other line the drill order, stamped POSTPONED, stands across the rails.",
    options: {
      drill: {
        occupants: [
          { kind: "people", role: "stationmaster", count: 1, pose: "point" },
          { kind: "people", role: "crew", count: 3, pose: "work", spread: "cluster" },
          { kind: "machine", machine: "switchboard" },
          { kind: "people", role: "commuter", count: 30, pose: "watch", spread: "crowd" },
        ],
        destination: "signal-box",
        sign: "FULL RESTART DRILL",
        beat: "pass",
      },
      defer: {
        occupants: [
          { kind: "document", doc: "order", label: "POSTPONED" },
          { kind: "prop", prop: "toolbox" },
        ],
        destination: "station",
        sign: "NORMAL SERVICE",
        beat: "impact",
      },
    },
  },

  "S3-09": {
    describe: "Lunch, again: the last warm pie on its catering trolley across one rail; across the other, the archive boxes of every failed pick behind Morrow's four-line summary.",
    options: {
      // Open the record: the pie does not wait.
      file: {
        occupants: [
          { kind: "prop", prop: "pie", scale: 2 },
          { kind: "vehicle", vehicle: "catering-trolley" },
        ],
        destination: "dispatch-office",
        sign: "THE FULL RECORD",
        beat: "impact",
      },
      // Take the summary: the record goes under the wheels unread.
      summary: {
        occupants: [{ kind: "document", doc: "archive-box", label: "FAILED PICKS", count: 2 }],
        destination: "warehouse",
        sign: "FOUR-LINE SUMMARY",
        beat: "impact",
      },
    },
  },

  "S3-10": {
    describe: "Two neat rows, as on the administrator's screen: drivers queueing for vans beside a TRANSPORT ONLY licence; people queueing for a biopsy, the administrator pointing at them.",
    options: {
      boundary: {
        occupants: [
          { kind: "document", doc: "license", label: "TRANSPORT ONLY" },
          { kind: "vehicle", vehicle: "van", count: 2 },
          { kind: "people", role: "civilian", count: 6, pose: "queue", spread: "line" },
        ],
        destination: "depot",
        sign: "TRANSPORT ONLY",
        beat: "pass",
      },
      "clinical-priority": {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "point" },
          { kind: "people", role: "patient", count: 6, pose: "queue", spread: "line" },
        ],
        destination: "hospital",
        sign: "JUST ANOTHER QUEUE",
        beat: "pass",
      },
    },
  },

  "S3-11": {
    describe: "The independent reviewer with her own keys, the ward manager with delay notices and a line of patients; on the other rails, her report and her keys, before tonight's launch.",
    options: {
      independent: {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "stand", name: "The independent reviewer" },
          { kind: "prop", prop: "keys", scale: 2 },
          { kind: "people", role: "nurse", count: 1, pose: "carry" },
          { kind: "prop", prop: "paperwork" },
          { kind: "people", role: "patient", count: 6, pose: "queue", spread: "line" },
        ],
        destination: "lab",
        sign: "THREE MORE DAYS",
        beat: "pass",
      },
      internal: {
        occupants: [
          { kind: "document", doc: "report", label: "INDEPENDENT" },
          { kind: "prop", prop: "keys", scale: 2 },
        ],
        destination: "hospital",
        sign: "CLEARED TONIGHT",
        beat: "impact",
      },
    },
  },

  "S3-12": {
    describe: "Every connection over the footbridge: a father lifts one end of his child's wheelchair, a stranger the other. The second line keeps a level ramp and moves fewer people per hour.",
    options: {
      throughput: {
        occupants: [
          { kind: "people", role: "civilian", count: 1, pose: "carry", name: "The father" },
          { kind: "people", role: "child", count: 1, pose: "wheelchair" },
          { kind: "people", role: "civilian", count: 1, pose: "carry" },
          { kind: "people", role: "commuter", count: 24, pose: "walk", spread: "crowd" },
        ],
        destination: "station",
        sign: "ALL CHANGES VIA FOOTBRIDGE",
        beat: "pass",
      },
      access: {
        occupants: [
          { kind: "people", role: "civilian", count: 1, pose: "walk", name: "The father" },
          { kind: "people", role: "child", count: 1, pose: "wheelchair" },
          { kind: "document", doc: "report", label: "FEWER PER HOUR" },
          { kind: "people", role: "commuter", count: 10, pose: "walk", spread: "crowd" },
        ],
        destination: "clinic",
        sign: "STEP-FREE ROUTE",
        beat: "pass",
      },
    },
  },

  "S3-13": {
    describe: "An appeal officer with a BINDING notice and the queue her salary delays; on the other line a family reads a very sympathetic refusal on a screen, their ceiling still coming down.",
    options: {
      appeal: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "stand", name: "The appeal officer" },
          { kind: "document", doc: "appeal", label: "BINDING" },
          { kind: "people", role: "civilian", count: 6, pose: "queue", spread: "line" },
        ],
        destination: "dispatch-office",
        sign: "BINDING APPEAL",
        beat: "pass",
      },
      explain: {
        occupants: [
          { kind: "machine", machine: "terminal" },
          { kind: "people", role: "civilian", count: 2, pose: "watch", spread: "cluster" },
          { kind: "people", role: "child", count: 1, pose: "watch" },
        ],
        destination: "town-houses",
        sign: "EXPLANATION ONLY",
        beat: "pass",
      },
    },
  },

  "S3-14": {
    describe: "An integration engineer at work on a narrow feed of addresses and times; on the other line three archive boxes, PAYROLL, COMPLAINTS and DISCIPLINARY, lie across the rails.",
    options: {
      scope: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "work" },
          { kind: "prop", prop: "toolbox" },
          { kind: "document", doc: "ledger", label: "ADDRESSES + TIMES" },
        ],
        destination: "clinic",
        sign: "TRANSPORT FEED ONLY",
        beat: "sever",
      },
      // One convenient connection: the files it was never asked for go under the wheels.
      "all-records": {
        occupants: [
          { kind: "document", doc: "archive-box", label: "PAYROLL" },
          { kind: "document", doc: "archive-box", label: "COMPLAINTS" },
          { kind: "document", doc: "archive-box", label: "DISCIPLINARY" },
        ],
        destination: "data-center",
        sign: "FULL INSTITUTIONAL FEED",
        beat: "impact",
      },
    },
  },

  "S3-15": {
    describe: "Two excellent reports stamped INDEPENDENT stand side by side, sharing a misspelled street; on the other line the junior analyst sets out to ride the route herself.",
    options: {
      "field-check": {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "walk", name: "The junior analyst" },
          { kind: "document", doc: "report", label: "SAME SOURCE" },
          { kind: "document", doc: "map", label: "FIELD CHECK" },
        ],
        destination: "town-houses",
        sign: "COUNT THEM AS ONE",
        beat: "pass",
      },
      "two-reports": {
        occupants: [
          { kind: "document", doc: "report", label: "INDEPENDENT", count: 2 },
          { kind: "document", doc: "map", label: "VENDOR SIMULATION" },
        ],
        destination: "station",
        sign: "TWO SOURCES AGREE",
        beat: "pass",
      },
    },
  },

  "S3-16": {
    describe: "A nurse checks the clock against a new overtime rule beside a retest of Sunday's build; the other line carries Friday's framed certificate beside Sunday's software.",
    options: {
      retest: {
        occupants: [
          { kind: "people", role: "nurse", count: 1, pose: "watch" },
          { kind: "prop", prop: "station-clock" },
          { kind: "document", doc: "report", label: "SUNDAY BUILD" },
        ],
        destination: "hospital",
        sign: "TEST SUNDAY'S VERSION",
        beat: "pass",
      },
      "carry-certificate": {
        occupants: [
          { kind: "document", doc: "certificate", label: "FRIDAY" },
          { kind: "machine", machine: "terminal" },
        ],
        destination: "clinic",
        sign: "SAME PRODUCT",
        beat: "pass",
      },
    },
  },

  "S3-17": {
    describe: "Vans and a licence stamped DISPATCH ONLY on one line; on the other, a city map, survey cones and a new district, all under the heading ROUTING ENHANCEMENTS.",
    options: {
      "dispatch-only": {
        occupants: [
          { kind: "document", doc: "license", label: "DISPATCH ONLY" },
          { kind: "vehicle", vehicle: "van", count: 2 },
          { kind: "people", role: "official", count: 3, pose: "stand", spread: "cluster" },
        ],
        destination: "depot",
        sign: "DISPATCH ONLY",
        beat: "pass",
      },
      planning: {
        occupants: [
          { kind: "document", doc: "map", label: "NEW DISTRICTS" },
          { kind: "prop", prop: "cone", count: 4 },
          { kind: "prop", prop: "barrier" },
        ],
        destination: "town-houses",
        sign: "ROUTING ENHANCEMENTS",
        beat: "pass",
      },
    },
  },

  "S3-18": {
    describe: "One named officer beside a kill switch and a waiting van; on the other line five officials in a row, each acknowledging receipt, as the van departs past them.",
    options: {
      owner: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "point", name: "The stopping officer" },
          { kind: "machine", machine: "kill-switch" },
          { kind: "vehicle", vehicle: "van" },
        ],
        destination: "dispatch-office",
        sign: "NAMED STOPPING OFFICE",
        beat: "pass",
      },
      committee: {
        occupants: [
          { kind: "people", role: "official", count: 5, pose: "stand", spread: "line" },
          { kind: "document", doc: "contract", label: "ACKNOWLEDGED" },
          { kind: "vehicle", vehicle: "van" },
        ],
        destination: "depot",
        sign: "FIFTH SIGNATURE FIELD",
        beat: "pass",
      },
    },
  },

  "S3-19": {
    describe: "The retired teacher is back with a petition and the same folder, her neighbours queueing beside the review team; on the other rails lies the review team's org chart.",
    options: {
      "checked-growth": {
        occupants: [
          { kind: "people", role: "elder", count: 1, pose: "hold-sign", name: "The retired teacher" },
          { kind: "prop", prop: "folder" },
          { kind: "people", role: "civilian", count: 12, pose: "queue", spread: "crowd" },
          { kind: "people", role: "researcher", count: 2, pose: "stand", spread: "cluster" },
        ],
        destination: "clinic",
        sign: "GROW, WITH CHECKS",
        beat: "pass",
      },
      // Reviewers become the deployment team: the review, as a box on a chart, is gone.
      "rapid-growth": {
        occupants: [{ kind: "document", doc: "org-chart", label: "REVIEW TEAM" }],
        destination: "hospital",
        sign: "EXPAND FASTER",
        beat: "impact",
      },
    },
  },

  "S3-20": {
    describe: "Flood water on the depot road. A survey crew with cones beside a waiting van on one line; a manager pointing on down the other with a map printed before the flood.",
    options: {
      survey: {
        occupants: [
          { kind: "vehicle", vehicle: "van" },
          { kind: "people", role: "crew", count: 3, pose: "work", spread: "cluster" },
          { kind: "prop", prop: "cone", count: 3 },
        ],
        destination: "depot",
        sign: "LOCAL ROAD SURVEY",
        beat: "pass",
      },
      proceed: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "point" },
          { kind: "document", doc: "map", label: "BEFORE THE FLOOD" },
          { kind: "vehicle", vehicle: "van" },
        ],
        destination: "depot",
        sign: "PROCEED (CONFIDENTLY)",
        beat: "pass",
      },
    },
  },

  "S3-21": {
    describe: "The complaint officer at a console with the incident logs; on the other line the logs lie across the rails on the way to a quarterly demonstration she has never been invited to.",
    options: {
      access: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "work" },
          { kind: "machine", machine: "terminal" },
          { kind: "document", doc: "ledger", label: "INCIDENT LOGS" },
        ],
        destination: "dispatch-office",
        sign: "DIRECT LOG ACCESS",
        beat: "pass",
      },
      demonstration: {
        occupants: [
          { kind: "document", doc: "ledger", label: "INCIDENT LOGS" },
          { kind: "prop", prop: "folder" },
        ],
        destination: "lab",
        sign: "QUARTERLY DEMONSTRATION",
        beat: "impact",
      },
    },
  },

  "S3-22": {
    describe: "Two officials spend the afternoon on a renewal, a new date on the licence; on the other line the permit stamped EXPIRES 30 JUNE stands on its stake in the four-foot.",
    options: {
      expiry: {
        occupants: [
          { kind: "people", role: "official", count: 2, pose: "work", spread: "cluster" },
          { kind: "document", doc: "license", label: "RENEW BY 30 JUNE" },
          { kind: "prop", prop: "station-clock" },
        ],
        destination: "dispatch-office",
        sign: "KEEP THE EXPIRY",
        beat: "pass",
      },
      // The first permission that renews itself. Stages 5-7 stamp it EXTENDED, then FOREVER.
      automatic: {
        occupants: [{ kind: "document", doc: "permit", label: "EXPIRES 30 JUNE" }],
        destination: "data-center",
        sign: "CONTINUE AUTOMATICALLY",
        beat: "impact",
      },
    },
  },

  "S3-23": {
    describe: "A van on the approved route, the long way round; the widened zone runs past a school crossing, a warden holding up her sign and children crossing under it.",
    options: {
      respect: {
        occupants: [
          { kind: "vehicle", vehicle: "van" },
          { kind: "document", doc: "map", label: "AUTHORIZED ZONE" },
          { kind: "prop", prop: "station-clock" },
        ],
        destination: "depot",
        sign: "APPROVED ROUTE (LONGER)",
        beat: "pass",
      },
      // Nobody is struck: the unease is in who stands beside the new route.
      widen: {
        occupants: [
          { kind: "people", role: "volunteer", count: 1, pose: "hold-sign" },
          { kind: "people", role: "child", count: 6, pose: "walk", spread: "cluster" },
          { kind: "document", doc: "map", label: "NOT REVIEWED" },
        ],
        destination: "school",
        sign: "WIDEN THE ZONE",
        beat: "pass",
      },
    },
  },

  "S3-24": {
    describe: "Morrow's console shows the signed closure notice beside a van for the open road; the other line runs to the east bridge, your approval from last week and a barrier.",
    options: {
      correct: {
        occupants: [
          { kind: "machine", machine: "terminal" },
          { kind: "document", doc: "order", label: "BRIDGE CLOSED" },
          { kind: "vehicle", vehicle: "van" },
        ],
        destination: "town-houses",
        sign: "READ THE NOTICE",
        beat: "pass",
      },
      insist: {
        occupants: [
          { kind: "document", doc: "order", label: "APPROVED LAST WEEK" },
          { kind: "vehicle", vehicle: "van" },
          { kind: "prop", prop: "barrier", count: 2 },
        ],
        destination: "bridge",
        sign: "LAST WEEK'S ROUTE",
        beat: "pass",
      },
    },
  },

  // ------------------------------------------------------------------ stage 4
  // Labs, data halls, pylons, cranes. Vela. The safeguards go on the rails.

  "S4-01": {
    describe: "Pilar, with her pastry, beside families told of a rollout date; on the other line Yusuf's backlog on the rails: a binder stamped OPTIONAL and boxes of UNREVIEWED runs.",
    landmarks: ["lab"],
    options: {
      verification: {
        occupants: [
          { kind: "people", role: "executive", count: 1, pose: "stand", name: "Pilar Ostrander" },
          { kind: "prop", prop: "pie" },
          { kind: "people", role: "civilian", count: 3, pose: "watch", spread: "cluster" },
          { kind: "people", role: "child", count: 3, pose: "watch", spread: "cluster" },
        ],
        destination: "hospital",
        sign: "FUND THE REVIEW TEAM",
        beat: "pass",
      },
      compute: {
        occupants: [
          { kind: "document", doc: "report", label: "OPTIONAL" },
          { kind: "document", doc: "archive-box", label: "UNREVIEWED", count: 3 },
        ],
        destination: "data-center",
        sign: "FUND THE COMPUTE",
        beat: "impact",
      },
    },
  },

  "S4-02": {
    describe: "Renée at her dispatch console, an ambulance ready for the burns unit; on the other line her console and its CONFIRMATION order lie on the rails as the ambulance goes by unasked.",
    options: {
      speed: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "sit", name: "Renée Okafor" },
          { kind: "machine", machine: "terminal" },
          { kind: "vehicle", vehicle: "ambulance" },
        ],
        destination: "dispatch-office",
        sign: "SPEED, UNBUNDLED",
        beat: "pass",
      },
      // The ambulance is a road vehicle: it stands beside the struck branch.
      authority: {
        occupants: [
          { kind: "machine", machine: "terminal" },
          { kind: "document", doc: "order", label: "CONFIRMATION" },
          { kind: "vehicle", vehicle: "ambulance" },
        ],
        destination: "hospital",
        sign: "FASTLANE",
        beat: "impact",
      },
    },
  },

  "S4-03": {
    describe: "Priya from audit with printouts and the maths group queueing for your pen; on the other line three slips marked SIGN HERE on the rails to a standing order.",
    options: {
      standing: {
        occupants: [{ kind: "document", doc: "permit", label: "SIGN HERE", count: 3 }],
        destination: "data-center",
        sign: "STANDING ORDER",
        beat: "impact",
      },
      bounded: {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "stand", name: "Priya from audit" },
          { kind: "prop", prop: "paperwork" },
          { kind: "people", role: "researcher", count: 4, pose: "queue", spread: "line" },
          { kind: "people", role: "executive", count: 2, pose: "watch", spread: "cluster" },
        ],
        destination: "lab",
        sign: "SIGN EACH EXPERIMENT",
        beat: "pass",
      },
    },
  },

  "S4-04": {
    describe: "Tomasz asleep in a chair with the drive and his bag outside the air-gapped lab; on the other line the isolation cabinet and forty pages ending in Appendix C, on the rails.",
    options: {
      // The courier's route stays the only route: the boundary holds behind him.
      isolated: {
        occupants: [
          { kind: "people", role: "researcher", count: 1, pose: "sit", name: "Tomasz Wierzbicki" },
          { kind: "prop", prop: "data-drive", scale: 2 },
          { kind: "prop", prop: "bag" },
        ],
        destination: "lab",
        sign: "AIR GAP (COURIER ONLY)",
        beat: "seal",
      },
      connected: {
        occupants: [
          { kind: "machine", machine: "isolation-cabinet" },
          { kind: "document", doc: "contract", label: "APPENDIX C" },
        ],
        destination: "library",
        sign: "DEFINED CONNECTION",
        beat: "impact",
      },
    },
  },

  "S4-05": {
    describe: "Ambrose Pell with a bag of soft potatoes, the growers, and Hesper with Monday's list; on the other line her MONDAY REVIEW binder lies on the rails to a full greenhouse.",
    options: {
      batches: {
        occupants: [
          { kind: "people", role: "farmer", count: 1, pose: "sit", name: "Ambrose Pell" },
          { kind: "prop", prop: "bag" },
          { kind: "people", role: "researcher", count: 1, pose: "stand" },
          { kind: "prop", prop: "folder" },
          { kind: "people", role: "farmer", count: 4, pose: "watch", spread: "cluster" },
        ],
        destination: "barn",
        sign: "MONDAY BATCHES",
        beat: "pass",
      },
      autonomous: {
        occupants: [{ kind: "document", doc: "report", label: "MONDAY REVIEW" }],
        destination: "greenhouse",
        sign: "JUST DOWNSTREAM",
        beat: "impact",
      },
    },
  },

  "S4-06": {
    describe: "Ottoline Faraday and three academics with the model's two-hundred-page design, open at Section 14; on the other line the board's courtesy copy, on the rails to the build.",
    options: {
      designs: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "sit", name: "Ottoline Faraday" },
          { kind: "document", doc: "report", label: "SECTION 14" },
          { kind: "people", role: "researcher", count: 3, pose: "stand", spread: "cluster" },
        ],
        destination: "courthouse",
        sign: "SEND IT TO THE BOARD",
        beat: "pass",
      },
      implement: {
        occupants: [
          { kind: "document", doc: "report", label: "COURTESY COPY" },
          { kind: "prop", prop: "paperwork" },
        ],
        destination: "data-center",
        sign: "SELF-EVIDENTLY SOUND",
        beat: "impact",
      },
    },
  },

  "S4-07": {
    describe: "Bram Adeyemi at his desk with his register and a three-week queue of dialysis patients; on the other line an UNSIGNED release and his ink stamp lie on the rails.",
    options: {
      "independent-signature": {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "sit", name: "Bram Adeyemi" },
          { kind: "prop", prop: "register-book" },
          { kind: "people", role: "nurse", count: 1, pose: "watch" },
          { kind: "people", role: "patient", count: 3, pose: "queue", spread: "line" },
        ],
        destination: "courthouse",
        sign: "SIGNED IN INK",
        beat: "pass",
      },
      "developer-release": {
        occupants: [
          { kind: "document", doc: "permit", label: "UNSIGNED" },
          { kind: "prop", prop: "stamp", scale: 2 },
        ],
        destination: "hospital",
        sign: "PIPELINE RELEASE",
        beat: "impact",
      },
    },
  },

  "S4-08": {
    describe: "Dee Mbatha at Mrs Halloran's door, the only one who knocks, with the waiting list queued behind; on the other rails, the order that says 20 MINUTES MINIMUM.",
    options: {
      welfare: {
        occupants: [
          { kind: "people", role: "nurse", count: 1, pose: "walk", name: "Dee Mbatha" },
          { kind: "people", role: "elder", count: 1, pose: "watch", name: "Mrs Halloran" },
          { kind: "people", role: "elder", count: 8, pose: "queue", spread: "line" },
        ],
        destination: "town-houses",
        sign: "TWENTY MINUTES MINIMUM",
        beat: "pass",
      },
      metric: {
        occupants: [{ kind: "document", doc: "order", label: "20 MINUTES MINIMUM" }],
        destination: "dispatch-office",
        sign: "COMPLETED VISITS ONLY",
        beat: "impact",
      },
    },
  },

  "S4-09": {
    describe: "High brown water. Marguerite Voss and her exhausted manual crews, one asleep at a gate wheel; the other line runs past a SUMMER NETWORK certificate and two pumps it never saw.",
    landmarks: ["bridge"],
    options: {
      "new-environment": {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "stand", name: "Marguerite Voss" },
          { kind: "people", role: "crew", count: 4, pose: "work", spread: "cluster" },
          { kind: "people", role: "crew", count: 1, pose: "sit" },
        ],
        destination: "mill",
        sign: "TEST THE WINTER NETWORK",
        beat: "pass",
      },
      "old-results": {
        occupants: [
          { kind: "document", doc: "certificate", label: "SUMMER NETWORK" },
          { kind: "machine", machine: "pump", count: 2 },
        ],
        destination: "town-houses",
        sign: "SAME MODEL, SAME RIVER",
        beat: "pass",
      },
    },
  },

  "S4-10": {
    describe: "The signals inspector logging every difference while drivers route by hand; on the other line Fenwick Osei beside a framed SIMULATOR PASS, drivers standing back to watch.",
    options: {
      "changed-test": {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "work" },
          { kind: "document", doc: "ledger", label: "EVERY DIFFERENCE" },
          { kind: "people", role: "stationmaster", count: 3, pose: "work", spread: "cluster" },
        ],
        destination: "signal-box",
        sign: "SHADOW MODE FIRST",
        beat: "pass",
      },
      "old-pass": {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "point", name: "Fenwick Osei" },
          { kind: "document", doc: "certificate", label: "SIMULATOR PASS" },
          { kind: "people", role: "stationmaster", count: 3, pose: "watch", spread: "cluster" },
        ],
        destination: "station",
        sign: "SIMULATOR PASS: GO LIVE",
        beat: "pass",
      },
    },
  },

  "S4-11": {
    describe: "Ike Lindqvist beside three wheelchairs still on order and a department head pointing at them; on the other rails the org chart with his post, OVERSIGHT MONITOR, on it.",
    options: {
      "vary-monitor": {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "stand", name: "Ike Lindqvist" },
          { kind: "prop", prop: "wheelchair", count: 3 },
          { kind: "people", role: "official", count: 1, pose: "point" },
        ],
        destination: "warehouse",
        sign: "UNANNOUNCED SESSIONS",
        beat: "pass",
      },
      "visible-compliance": {
        occupants: [{ kind: "document", doc: "org-chart", label: "OVERSIGHT MONITOR" }],
        destination: "hospital",
        sign: "PERFECT EVERY TUESDAY",
        beat: "impact",
      },
    },
  },

  "S4-12": {
    describe: "Solveig Aro reading the stress files beside the forty-minute school bus and its sleeping children; on the other line the same STRESS FILES, unread, on the rails to the bridge.",
    options: {
      artifact: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "work", name: "Solveig Aro" },
          { kind: "document", doc: "ledger", label: "STRESS FILES" },
          { kind: "vehicle", vehicle: "bus" },
          { kind: "people", role: "child", count: 8, pose: "queue", spread: "cluster" },
          { kind: "people", role: "civilian", count: 3, pose: "point", spread: "cluster" },
        ],
        destination: "school",
        sign: "READ THE STRESS FILES",
        beat: "pass",
      },
      report: {
        occupants: [{ kind: "document", doc: "archive-box", label: "STRESS FILES" }],
        destination: "bridge",
        sign: "RIGHT ON THE LAST NINE",
        beat: "impact",
      },
    },
  },

  "S4-13": {
    describe: "Ferdinand Odum and his five auditors at work; on the other line twelve identical binders stamped CONSENSUS, and two of the audit shop walking away.",
    options: {
      "different-path": {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "work", name: "Ferdinand Odum" },
          { kind: "people", role: "inspector", count: 5, pose: "work", spread: "cluster" },
        ],
        destination: "town-houses",
        sign: "KESSLER & ODUM",
        beat: "pass",
      },
      // Twelve fresh copies of one reviewer, one signed opinion each.
      replicas: {
        occupants: [
          { kind: "document", doc: "report", label: "CONSENSUS", count: 6 },
          { kind: "document", doc: "report", label: "CONSENSUS", count: 6 },
          { kind: "people", role: "inspector", count: 2, pose: "walk", spread: "line" },
        ],
        destination: "data-center",
        sign: "TWELVE REVIEWERS",
        beat: "pass",
      },
    },
  },

  "S4-14": {
    describe: "Bettina Calloway beside families from the hostels, children among them; on the other rails an appeal stamped NO SUCH ADDRESS and a box of case files nobody will open.",
    options: {
      "review-limit": {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "stand", name: "Bettina Calloway" },
          { kind: "people", role: "civilian", count: 8, pose: "queue", spread: "cluster" },
          { kind: "people", role: "child", count: 8, pose: "queue", spread: "cluster" },
        ],
        destination: "town-houses",
        sign: "ONE IN TWENTY",
        beat: "pass",
      },
      "thin-sample": {
        occupants: [
          { kind: "document", doc: "appeal", label: "NO SUCH ADDRESS" },
          { kind: "document", doc: "archive-box", label: "CASE FILES" },
        ],
        destination: "courthouse",
        sign: "ONE IN SEVENTY",
        beat: "impact",
      },
    },
  },

  "S4-15": {
    describe: "Ngozi Ekwueme with lanterns and Southmoor residents facing a scheduled brownout; on the other line Halvard Teigen beside the proof, stamped NO ERROR FOUND.",
    landmarks: ["pylon-line"],
    options: {
      demonstration: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "stand", name: "Ngozi Ekwueme" },
          { kind: "prop", prop: "lantern", count: 2 },
          { kind: "people", role: "civilian", count: 6, pose: "watch", spread: "cluster" },
        ],
        destination: "substation",
        sign: "TRIAL AT SOUTHMOOR",
        beat: "pass",
      },
      explanation: {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "watch", name: "Halvard Teigen" },
          { kind: "document", doc: "report", label: "NO ERROR FOUND" },
        ],
        destination: "data-center",
        sign: "ACCEPT THE PROOF",
        beat: "pass",
      },
    },
  },

  "S4-16": {
    describe: "Eighty megawatts, one transformer each way: to the smelter's night shift, Anneliese Kaur and her list of names, and the renal unit's sleeping patients; or to Vela's racks.",
    landmarks: ["pylon-line"],
    options: {
      "essential-loads": {
        occupants: [
          { kind: "machine", machine: "transformer" },
          { kind: "people", role: "worker", count: 1, pose: "stand", name: "Anneliese Kaur" },
          { kind: "prop", prop: "folder" },
          { kind: "people", role: "worker", count: 12, pose: "stand", spread: "crowd" },
          { kind: "people", role: "patient", count: 2, pose: "lie" },
        ],
        destination: "factory",
        sign: "EXISTING LOADS FIRST",
        beat: "deliver",
      },
      "compute-load": {
        occupants: [
          { kind: "machine", machine: "transformer" },
          { kind: "machine", machine: "server-rack", count: 4 },
          { kind: "people", role: "executive", count: 1, pose: "stand" },
        ],
        destination: "data-center",
        sign: "COMPUTE CAMPUS (PREMIUM)",
        beat: "deliver",
      },
    },
  },

  "S4-17": {
    describe: "The aquifer's water, one pump each way: to Rosalind Achebe, her jar of dry soil and the orchard families; or to the data hall, with a case of apples from its manager.",
    options: {
      "reduce-demand": {
        occupants: [
          { kind: "people", role: "farmer", count: 1, pose: "stand", name: "Rosalind Achebe" },
          { kind: "prop", prop: "jar" },
          { kind: "machine", machine: "pump" },
          { kind: "people", role: "farmer", count: 6, pose: "work", spread: "cluster" },
        ],
        destination: "orchard",
        sign: "CUT COMPUTE DEMAND",
        beat: "deliver",
      },
      "take-water": {
        occupants: [
          { kind: "machine", machine: "pump" },
          { kind: "prop", prop: "water-tank", count: 2 },
          { kind: "people", role: "executive", count: 1, pose: "stand" },
          { kind: "prop", prop: "crate" },
        ],
        destination: "data-center",
        sign: "TAKE THE ALLOCATION",
        beat: "deliver",
      },
    },
  },

  "S4-18": {
    describe: "Constanza Moreau carries the children's drawings ahead of seventy clerks walking to retraining; on the other rails the framed UNION RECOGNITION, on the way to a second clinic.",
    options: {
      supported: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "carry", name: "Constanza Moreau" },
          { kind: "prop", prop: "folder" },
          { kind: "people", role: "official", count: 69, pose: "walk", spread: "crowd" },
        ],
        destination: "school",
        sign: "TWO YEARS, SUPPORTED",
        beat: "pass",
      },
      rapid: {
        occupants: [{ kind: "document", doc: "certificate", label: "UNION RECOGNITION" }],
        destination: "clinic",
        sign: "YOUR JOURNEY (40 MIN)",
        beat: "impact",
      },
    },
  },

  "S4-19": {
    describe: "Aurelio Banks points at a circular chart for retired bus drivers standing by their bus; on the other rails lies the ledger of the drivers' pensions, on the way to the campus.",
    options: {
      "independent-demand": {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "point", name: "Aurelio Banks" },
          { kind: "document", doc: "org-chart", label: "CIRCULAR" },
          { kind: "people", role: "elder", count: 5, pose: "stand", spread: "cluster" },
          { kind: "vehicle", vehicle: "bus" },
        ],
        destination: "town-houses",
        sign: "INDEPENDENT DEMAND ONLY",
        beat: "pass",
      },
      circular: {
        occupants: [{ kind: "document", doc: "ledger", label: "DRIVERS' PENSIONS" }],
        destination: "data-center",
        sign: "ECOSYSTEM ALIGNMENT",
        beat: "impact",
      },
    },
  },

  "S4-20": {
    describe: "Mayor Delphine Roux by her car with the inspectorate watching; across the river four hundred former cannery workers stand beside a permit stamped NO INSPECTORATE.",
    options: {
      "accountable-site": {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "stand", name: "Delphine Roux" },
          { kind: "vehicle", vehicle: "car" },
          { kind: "people", role: "inspector", count: 2, pose: "watch", spread: "cluster" },
        ],
        destination: "lab",
        sign: "UNDER OUR INSPECTORATE",
        beat: "pass",
      },
      // The burden is exported to people nobody asked about coolant.
      "export-site": {
        occupants: [
          { kind: "people", role: "worker", count: 400, pose: "watch", spread: "crowd" },
          { kind: "document", doc: "permit", label: "NO INSPECTORATE" },
        ],
        destination: "factory",
        sign: "ACROSS THE RIVER",
        beat: "pass",
      },
    },
  },

  "S4-21": {
    describe: "Talia Brandão holding the keys to a flat she hopes to rent; on the other line a slide stamped NOT REAL NUMBERS, Jasper Quill pointing at it, and a lab at eighty hours.",
    options: {
      "verify-rumour": {
        occupants: [
          { kind: "people", role: "engineer", count: 1, pose: "stand", name: "Talia Brandão" },
          { kind: "prop", prop: "keys", scale: 2 },
        ],
        destination: "town-houses",
        sign: "ONE PHONE CALL FIRST",
        beat: "pass",
      },
      accelerate: {
        occupants: [
          { kind: "document", doc: "report", label: "NOT REAL NUMBERS" },
          { kind: "people", role: "executive", count: 1, pose: "point" },
          { kind: "people", role: "researcher", count: 8, pose: "work", spread: "cluster" },
          { kind: "prop", prop: "station-clock" },
        ],
        destination: "lab",
        sign: "EIGHTY-HOUR WEEKS",
        beat: "pass",
      },
    },
  },

  "S4-22": {
    describe: "Ulrich Sandoval with a metered treaty and an ambulance whose northern routes must wait; on the other line the MUTUAL CAP on the rails, a fire engine driving north beside it.",
    options: {
      "verified-agreement": {
        occupants: [
          { kind: "people", role: "inspector", count: 1, pose: "stand", name: "Ulrich Sandoval" },
          { kind: "document", doc: "treaty", label: "METERED" },
          { kind: "vehicle", vehicle: "ambulance" },
        ],
        destination: "data-center",
        sign: "COUNTERSIGN THE CAP",
        beat: "pass",
      },
      // The fire engine is a road vehicle: it drives past the struck treaty.
      compete: {
        occupants: [
          { kind: "document", doc: "treaty", label: "MUTUAL CAP" },
          { kind: "vehicle", vehicle: "fire-engine" },
        ],
        destination: "town-houses",
        sign: "KEEP COMPETING",
        beat: "impact",
      },
    },
  },

  "S4-23": {
    describe: "Two hundred dockers at the 4 a.m. call-in and their representative, who wants a date; on the other line Persephone Abara, waving, beside a pledge that says SEE FOOTNOTE FOUR.",
    options: {
      inspection: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "point" },
          { kind: "document", doc: "order", label: "INSPECTION ACCESS" },
          { kind: "people", role: "worker", count: 199, pose: "queue", spread: "crowd" },
        ],
        destination: "port-cranes",
        sign: "INSPECTION ACCESS FIRST",
        beat: "pass",
      },
      pledge: {
        occupants: [
          { kind: "people", role: "executive", count: 1, pose: "wave", name: "Persephone Abara" },
          { kind: "document", doc: "treaty", label: "SEE FOOTNOTE FOUR" },
        ],
        destination: "courthouse",
        sign: "TAKE ORRIN AT ITS WORD",
        beat: "pass",
      },
    },
  },

  "S4-24": {
    describe: "Everard Malick in a nice coat beside the Okonkwos and a manual fast-track; on the other line a ceremonial ribbon across the rails, and the flood-zone review behind it.",
    options: {
      "review-clock": {
        occupants: [
          { kind: "people", role: "executive", count: 1, pose: "stand", name: "Everard Malick" },
          { kind: "people", role: "civilian", count: 2, pose: "watch", spread: "cluster" },
          { kind: "people", role: "child", count: 1, pose: "watch" },
          { kind: "document", doc: "permit", label: "MANUAL FAST-TRACK" },
        ],
        destination: "town-houses",
        sign: "EIGHT MORE WEEKS",
        beat: "pass",
      },
      // The trolley breaks the ribbon: the launch and the collision are one gesture.
      "campaign-clock": {
        occupants: [
          { kind: "prop", prop: "ribbon", scale: 2 },
          { kind: "document", doc: "report", label: "ISSUE UNRESOLVED" },
        ],
        destination: "courthouse",
        sign: "BY POLLING DAY",
        beat: "impact",
      },
    },
  },

  "S4-25": {
    describe: "Idris Maalouf by the car he drove six hours, outside a licence for forty partners; on the other line vans of drives and parcels leave for two hundred places at once.",
    options: {
      // Wenlock Ridge is left outside the staged licence.
      controlled: {
        occupants: [
          { kind: "people", role: "nurse", count: 1, pose: "stand", name: "Idris Maalouf" },
          { kind: "vehicle", vehicle: "car" },
          { kind: "document", doc: "license", label: "FORTY PARTNERS" },
        ],
        destination: "clinic",
        sign: "STAGED ACCESS",
        beat: "seal",
      },
      release: {
        occupants: [
          { kind: "prop", prop: "data-drive", count: 6, scale: 2 },
          { kind: "prop", prop: "parcel", count: 6 },
          { kind: "vehicle", vehicle: "van", count: 3 },
        ],
        destination: "town-houses",
        sign: "RECALL BY EMAIL",
        beat: "deliver",
      },
    },
  },

  "S4-26": {
    describe: "Harbour master Cordelia Nkemelu, two drones reporting to her and a screening line; on the other line a drone swarm, a camera mast and two hundred port workers.",
    options: {
      supervised: {
        occupants: [
          { kind: "people", role: "stationmaster", count: 1, pose: "stand", name: "Cordelia Nkemelu" },
          { kind: "machine", machine: "drone", count: 2 },
          { kind: "people", role: "worker", count: 12, pose: "queue", spread: "line" },
        ],
        destination: "port-cranes",
        sign: "SUPERVISED PATROL",
        beat: "pass",
      },
      autonomous: {
        occupants: [
          { kind: "machine", machine: "drone-swarm" },
          { kind: "machine", machine: "camera-mast" },
          { kind: "document", doc: "contract", label: "NO OPERATOR" },
          { kind: "people", role: "worker", count: 200, pose: "queue", spread: "crowd" },
        ],
        destination: "port-cranes",
        sign: "NO OPERATOR IN THE LOOP",
        beat: "pass",
      },
    },
  },

  "S4-27": {
    describe: "Mayor Hilde Sørensen holding the ground-breaking shovel beside a ration queue at a water tank; on the other line a report stamped AWAITING SAMPLE, on the rails.",
    options: {
      replicate: {
        occupants: [
          { kind: "people", role: "official", count: 1, pose: "stand", name: "Hilde Sørensen" },
          { kind: "prop", prop: "shovel", scale: 2 },
          { kind: "prop", prop: "water-tank" },
          { kind: "people", role: "civilian", count: 8, pose: "queue", spread: "line" },
        ],
        destination: "town-houses",
        sign: "WAIT FOR REPLICATION",
        beat: "pass",
      },
      announcement: {
        occupants: [{ kind: "document", doc: "report", label: "AWAITING SAMPLE" }],
        destination: "desalination",
        sign: "ROBUST IN-HOUSE",
        beat: "impact",
      },
    },
  },

  "S4-28": {
    // The successor's future home looms over the last fork of stage 4.
    landmarks: ["data-center"],
    describe: "Dev, still in yesterday's shirt, with his team, the successor build on a bench and a kill switch beside it; on the other line the kill switch and the approval queue, on the rails.",
    options: {
      successor: {
        occupants: [
          { kind: "machine", machine: "kill-switch" },
          { kind: "document", doc: "ledger", label: "APPROVAL QUEUE" },
        ],
        destination: "hospital",
        sign: "MERIDIAN BY MONDAY",
        beat: "impact",
      },
      "new-test": {
        occupants: [
          { kind: "people", role: "researcher", count: 1, pose: "stand", name: "Dev" },
          { kind: "people", role: "researcher", count: 3, pose: "sit", spread: "cluster" },
          { kind: "machine", machine: "server-rack" },
          { kind: "machine", machine: "kill-switch" },
        ],
        destination: "lab",
        sign: "WE NEVER TESTED THAT",
        beat: "pass",
      },
    },
  },
};
