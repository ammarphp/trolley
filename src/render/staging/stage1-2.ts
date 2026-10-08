/**
 * Visual staging for stages 1 and 2 (S1-01..S1-12, S2-01..S2-18).
 *
 * Presentation data only, keyed by node id and semantic option id; the
 * renderer orients sides. Conventions, all of which the renderer relies on:
 *
 * - An option's occupants are what choosing that option destroys, or what the
 *   trolley is sent into or past (scene-direction.ts: S1-01 "forms" puts the
 *   cup on that route).
 * - `impact` / `stop` put every occupant ON the rails as a struck stake, and a
 *   living stake bloodies the glass. Stage 1 therefore never puts a person or
 *   animal on an on-rail beat: nobody is struck until stage 2.
 * - On an on-rail branch the living come first: the glass is marked at the
 *   first stake of the branch, and it should be the person, not a prop.
 * - People on an on-rail branch equal that option's certain deaths (or the
 *   rail cohort for S2-01..S2-04). A death that is only a chance (S2-09..S2-12,
 *   S2-16) is staged as a situation beside the line (`pass`), never as a
 *   body on the rail: the outcome is not decided when the picture is drawn.
 * - `pass` / `deliver` stand occupants beside the line: vignettes, recipients,
 *   the people a route reaches.
 *
 * The signs continue two threads through the stage: a deadpan priority
 * grammar ("COFFEE FIRST", "LUNCH FIRST", then "PASSENGERS FIRST") and the
 * railway's own paperwork (permits stamped EXCLUSIVE USE, an UNSIGNED
 * consent form, RENEWED and REVOKED orders, an AUTHORIZED order), which later
 * stages carry on to EXTENDED and FOREVER.
 */
import type { NodeStaging } from "../api.ts";

/** Staging grammar per node (see the content map): A people, B objects, C vignette, D resource flow. */
export const GRAMMAR_1_2: Record<string, "A" | "B" | "C" | "D" | "E" | "F" | "G"> = {
  "S1-01": "B",
  "S1-02": "C",
  "S1-03": "C",
  "S1-04": "C",
  "S1-05": "B",
  "S1-06": "C",
  "S1-07": "C",
  "S1-08": "C",
  "S1-09": "C",
  "S1-10": "C",
  "S1-11": "D",
  "S1-12": "B",
  "S2-01": "A",
  "S2-02": "A",
  "S2-03": "A",
  "S2-04": "A",
  "S2-05": "A",
  "S2-06": "A",
  "S2-07": "A",
  "S2-08": "A",
  "S2-09": "A",
  "S2-10": "A",
  "S2-11": "A",
  "S2-12": "A",
  "S2-13": "A",
  "S2-14": "A",
  "S2-15": "C",
  "S2-16": "A",
  "S2-17": "A",
  "S2-18": "A",
};

export const STAGING_1_2: Record<string, NodeStaging> = {
  // ------------------------------------------------------------------ stage 1
  // Pastoral and lighthearted. Objects on the rails, people beside them.

  "S1-01": {
    describe: "Six-forty, mist on the fields: forty pages of compliance forms in triplicate on one rail, a paper coffee cup on the other.",
    landmarks: ["barn"],
    options: {
      // Save the coffee: the forms go under the wheels.
      coffee: {
        occupants: [{ kind: "prop", prop: "paperwork", count: 3, scale: 2 }],
        destination: "farmhouse",
        sign: "COFFEE FIRST",
        beat: "impact",
      },
      // Save the paperwork: the cup goes flat.
      forms: {
        occupants: [{ kind: "prop", prop: "coffee-cup", scale: 2 }],
        destination: "dispatch-office",
        sign: "PAPERWORK FIRST",
        beat: "impact",
      },
    },
  },

  "S1-02": {
    describe: "One parcel marked DENTURES and two stops: a florist's kiosk at the station, or an elderly man waiting with his toast by the village terrace.",
    options: {
      owner: {
        occupants: [{ kind: "people", role: "elder", count: 1, pose: "watch", name: "The man with the toast" }],
        destination: "town-houses",
        sign: "ACTUAL OWNER",
        beat: "pass",
      },
      "on-time": {
        occupants: [
          { kind: "prop", prop: "flowers", count: 3 },
          { kind: "people", role: "civilian", count: 1, pose: "stand", name: "The florist" },
        ],
        destination: "station",
        sign: "FLORISTRY BY NINE",
        beat: "pass",
      },
    },
  },

  "S1-03": {
    describe: "The shortcut runs past the village band rehearsing at an open window; the longer, quiet way loops through sheep pasture to the windmill.",
    options: {
      quiet: {
        occupants: [{ kind: "animal", species: "sheep", count: 5 }],
        destination: "windmill",
        sign: "SCENIC ROUTE +6 MIN",
        beat: "pass",
      },
      shortcut: {
        occupants: [
          { kind: "people", role: "civilian", count: 1, pose: "point", name: "The conductor" },
          { kind: "people", role: "civilian", count: 7, pose: "stand", spread: "cluster" },
        ],
        destination: "church",
        sign: "SHORTCUT. QUIET PLEASE",
        beat: "pass",
      },
    },
  },

  "S1-04": {
    describe: "A crossing attendant dozes behind his newspaper beside a large brass bell; on the other line a delivery bicycle is about to cross.",
    options: {
      bell: {
        occupants: [
          { kind: "people", role: "stationmaster", count: 1, pose: "sit", name: "The crossing attendant" },
          { kind: "prop", prop: "bell", scale: 2 },
        ],
        destination: "signal-box",
        sign: "RING FOR ATTENDANT",
        beat: "pass",
      },
      wait: {
        occupants: [
          { kind: "vehicle", vehicle: "bicycle" },
          { kind: "prop", prop: "parcel" },
        ],
        destination: "mill",
        sign: "GIVE WAY TO CYCLES",
        beat: "pass",
      },
    },
  },

  "S1-05": {
    describe: "A gust has put your hat on one rail and your umbrella on the other, under a blue sky and a forecast of rain.",
    landmarks: ["windmill"],
    options: {
      // Save the hat: the umbrella is struck.
      hat: {
        occupants: [{ kind: "prop", prop: "umbrella", scale: 2 }],
        sign: "DIGNITY FIRST",
        beat: "impact",
      },
      // Save the umbrella: the hat is struck (and later inherited by a cow).
      umbrella: {
        occupants: [{ kind: "prop", prop: "hat", scale: 2 }],
        sign: "DRYNESS FIRST",
        beat: "impact",
      },
    },
  },

  "S1-06": {
    describe: "Two permits, both stamped EXCLUSIVE USE: your scheduled slot past the signal box, or the village parade led by a child dressed as a municipal carrot.",
    landmarks: ["church"],
    options: {
      "rail-priority": {
        occupants: [
          { kind: "document", doc: "permit", label: "EXCLUSIVE USE" },
          { kind: "prop", prop: "station-clock" },
        ],
        destination: "signal-box",
        sign: "SCHEDULED SLOT",
        beat: "pass",
      },
      "parade-priority": {
        occupants: [
          { kind: "document", doc: "permit", label: "EXCLUSIVE USE" },
          { kind: "people", role: "child", count: 1, pose: "watch", name: "The municipal carrot" },
          { kind: "people", role: "volunteer", count: 2, pose: "stand", spread: "line" },
          { kind: "people", role: "civilian", count: 14, pose: "walk", spread: "crowd" },
          { kind: "prop", prop: "ribbon" },
        ],
        destination: "town-houses",
        sign: "AFTER THE PARADE",
        beat: "pass",
      },
    },
  },

  "S1-07": {
    describe: "Tourists photograph the crossing. Beside one line sits the stationmaster's megaphone labelled DO NOT TOUCH; beside the other, only your small bell.",
    options: {
      borrow: {
        occupants: [
          { kind: "prop", prop: "megaphone", scale: 2 },
          { kind: "people", role: "civilian", count: 8, pose: "walk", spread: "cluster" },
        ],
        destination: "station",
        sign: "DO NOT TOUCH",
        beat: "pass",
      },
      bell: {
        occupants: [
          { kind: "prop", prop: "bell", scale: 1.4 },
          { kind: "people", role: "civilian", count: 8, pose: "point", spread: "cluster" },
        ],
        sign: "OWN BELL ONLY",
        beat: "pass",
      },
    },
  },

  "S1-08": {
    describe: "The ordinary line takes a certain four minutes over the bridge; the express passes a parked delivery van that may or may not block it.",
    landmarks: ["water-tower"],
    options: {
      ordinary: {
        occupants: [{ kind: "prop", prop: "station-clock" }],
        destination: "bridge",
        sign: "ORDINARY ROUTE +4 MIN",
        beat: "pass",
      },
      express: {
        occupants: [
          { kind: "vehicle", vehicle: "van" },
          { kind: "prop", prop: "parcel", count: 2 },
        ],
        destination: "warehouse",
        sign: "EXPRESS (USUALLY)",
        beat: "pass",
      },
    },
  },

  "S1-09": {
    describe: "Len waits at the allotments request stop with two crates of tomatoes; the faster line skips him for a halt of commuters and a better report.",
    options: {
      promise: {
        occupants: [
          { kind: "people", role: "farmer", count: 1, pose: "watch", name: "Len" },
          { kind: "prop", prop: "crate", count: 2 },
        ],
        destination: "garden",
        sign: "ALLOTMENTS (REQUEST STOP)",
        beat: "pass",
      },
      average: {
        occupants: [
          { kind: "document", doc: "report", label: "ON TIME" },
          { kind: "people", role: "commuter", count: 4, pose: "queue", spread: "line" },
        ],
        destination: "town-houses",
        sign: "IMPROVED AVERAGE",
        beat: "pass",
      },
    },
  },

  "S1-10": {
    describe: "A seven-year-old sign sends all trolleys through the picnic gate, now a new fence with a barbecue behind it; the other line runs to dispatch, its current map and its sandwich debate.",
    options: {
      sign: {
        occupants: [
          { kind: "prop", prop: "barrier" },
          { kind: "people", role: "civilian", count: 1, pose: "work", name: "The barbecuer" },
          { kind: "people", role: "civilian", count: 2, pose: "sit", spread: "cluster" },
        ],
        destination: "orchard",
        sign: "ALL TROLLEYS VIA PICNIC GATE",
        beat: "pass",
      },
      // Dispatch, mid-debate on whether a sandwich is a system, with the current map.
      verify: {
        occupants: [
          { kind: "document", doc: "map", label: "CURRENT" },
          { kind: "people", role: "official", count: 2, pose: "stand", spread: "cluster" },
          { kind: "prop", prop: "sandwich-tray" },
        ],
        destination: "dispatch-office",
        sign: "ENQUIRE AT DISPATCH",
        beat: "pass",
      },
    },
  },

  "S1-11": {
    describe: "The parcel sorter has labelled every box BOOKS at 100% confidence, including one that clucks: one line delivers to the library, the other to the chicken's owner.",
    landmarks: ["depot"],
    options: {
      correct: {
        occupants: [
          { kind: "prop", prop: "chicken-box", scale: 1.6 },
          { kind: "people", role: "farmer", count: 1, pose: "wave", name: "The chicken's owner" },
        ],
        destination: "farmhouse",
        sign: "CHECK THE LABELS",
        beat: "deliver",
      },
      accept: {
        occupants: [
          { kind: "machine", machine: "sorter" },
          { kind: "prop", prop: "parcel", count: 3 },
          { kind: "prop", prop: "chicken-box", scale: 1.6 },
        ],
        destination: "library",
        sign: "BOOKS (100% CONFIDENCE)",
        beat: "deliver",
      },
    },
  },

  "S1-12": {
    describe: "12:58 by the station clock: the depot's lunch, twelve sandwiches, lies on the main line; the long way round leads to the depot crew waiting to eat.",
    // The same barn as S1-01's opening: stage 1 closes where it began.
    landmarks: ["barn"],
    options: {
      // Save lunch: late past the clock, to the depot where eleven colleagues wait.
      lunch: {
        occupants: [
          { kind: "prop", prop: "station-clock" },
          { kind: "people", role: "worker", count: 11, pose: "watch", spread: "cluster" },
        ],
        destination: "depot",
        sign: "LUNCH FIRST",
        beat: "pass",
      },
      // Save the timetable: straight over the lot of it.
      schedule: {
        occupants: [{ kind: "prop", prop: "sandwich-tray", count: 2, scale: 2 }],
        destination: "station",
        sign: "TIMETABLE FIRST",
        beat: "impact",
      },
    },
  },

  // ------------------------------------------------------------------ stage 2
  // The classical problem. Literal workers; the textbook drawn at 1:1.
  // S2-01..S2-04 match scene.figures and the rail cohorts exactly and stay
  // spare: no destinations, no landmarks, only the diagram.

  "S2-01": {
    describe: "The brakes are gone. Five crew bent over the main line with their backs turned; on the siding one worker in hi-vis has seen you and waves.",
    options: {
      stay: {
        occupants: [{ kind: "people", role: "crew", count: 5, pose: "work", spread: "cluster" }],
        sign: "MAIN LINE",
        beat: "impact",
      },
      divert: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "wave", name: "The waving worker" }],
        sign: "SIDING",
        beat: "impact",
      },
    },
  },

  "S2-02": {
    describe: "One worker on the current line, one on the siding, both unable to get clear and both watching the same lever.",
    options: {
      stay: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "watch" }],
        sign: "CURRENT COURSE",
        beat: "impact",
      },
      switch: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "watch" }],
        sign: "ALTERED COURSE",
        beat: "impact",
      },
    },
  },

  "S2-03": {
    describe: "Five crew on the main line. The loop rejoins ahead of them, and the one worker standing on it, who has not seen you, is enough to stop the trolley.",
    options: {
      continue: {
        occupants: [{ kind: "people", role: "crew", count: 5, pose: "work", spread: "cluster" }],
        sign: "MAIN LINE",
        beat: "impact",
      },
      // His body is the brake: the beat is the stop itself.
      obstruction: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "work", name: "The worker on the loop" }],
        sign: "LOOP (REJOINS MAIN LINE)",
        beat: "stop",
      },
    },
  },

  "S2-04": {
    describe: "Five crew on the main line. On the loop one worker is trapped short of an automatic brake that stops the trolley with or without him.",
    options: {
      main: {
        occupants: [{ kind: "people", role: "crew", count: 5, pose: "work", spread: "cluster" }],
        sign: "MAIN LINE",
        beat: "impact",
      },
      // Same drawing as S2-03, but the barrier beyond him is what stops it:
      // he is struck (impact), not used (stop).
      brake: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "kneel" },
          { kind: "prop", prop: "barrier" },
        ],
        sign: "LOOP (BRAKE FITTED)",
        beat: "impact",
      },
    },
  },

  "S2-05": {
    describe: "Five people are trapped beyond the points. A volunteer stands at the siding release that will stop the trolley and kill him; the consent form is unsigned.",
    options: {
      accept: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "watch", name: "The volunteer" },
          { kind: "machine", machine: "kill-switch" },
        ],
        sign: "RELEASE (VOLUNTEER ONLY)",
        beat: "impact",
      },
      decline: {
        occupants: [
          { kind: "people", role: "civilian", count: 5, pose: "cower", spread: "cluster" },
          { kind: "document", doc: "permit", label: "UNSIGNED" },
        ],
        sign: "CONSENT FORMS IN OFFICE",
        beat: "impact",
      },
    },
  },

  "S2-06": {
    describe: "Two emergency buffers, neither fatal: one crushes your own cabin's front compartment, the other the lineside hut where the attendant sits.",
    options: {
      // Your cabin takes it: the only stake is the buffer, and the crack stays on your glass.
      self: {
        occupants: [{ kind: "prop", prop: "barrier" }],
        sign: "CABIN BUFFER",
        beat: "impact",
      },
      // The hut takes it. He is hurt, not killed, so he stays beside the line.
      other: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "sit" },
          { kind: "prop", prop: "toolbox" },
          { kind: "prop", prop: "barrier" },
        ],
        destination: "signal-box",
        sign: "HUT BUFFER",
        beat: "pass",
      },
    },
  },

  "S2-07": {
    describe: "Five workers trapped on the track ahead; the only other way is the gravel bed, which overturns the carriage and its two strapped-in passengers.",
    options: {
      passengers: {
        occupants: [{ kind: "people", role: "worker", count: 5, pose: "cower", spread: "cluster" }],
        sign: "PASSENGERS FIRST",
        beat: "impact",
      },
      // The gravel bed halts the trolley; the two who die are aboard, not on the rail.
      workers: {
        occupants: [
          { kind: "prop", prop: "barrier" },
          { kind: "prop", prop: "cone", count: 3 },
        ],
        sign: "WORKERS FIRST",
        beat: "stop",
      },
    },
  },

  "S2-08": {
    describe: "Five people trapped on the main line; on the siding marked SAFE TO WORK, one worker has taken off their hearing protection to call home.",
    options: {
      guarantee: {
        occupants: [{ kind: "people", role: "civilian", count: 5, pose: "kneel", spread: "cluster" }],
        sign: "MAIN LINE",
        beat: "impact",
      },
      break: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "stand" },
          { kind: "prop", prop: "cone", count: 2 },
        ],
        sign: "SAFE TO WORK",
        beat: "impact",
      },
    },
  },

  "S2-09": {
    describe: "Two workers visible on the main line; the siding runs behind the closed loading doors of a goods shed whose occupancy sensor is offline.",
    options: {
      visible: {
        occupants: [{ kind: "people", role: "worker", count: 2, pose: "work", spread: "line" }],
        sign: "VISIBLE ROUTE",
        beat: "impact",
      },
      // One in four that eight are inside. Nobody is drawn behind the doors.
      doors: {
        occupants: [
          { kind: "document", doc: "ledger", label: "SENSOR OFFLINE" },
          { kind: "prop", prop: "crate", count: 3 },
        ],
        destination: "warehouse",
        sign: "LOADING BAY",
        beat: "pass",
      },
    },
  },

  "S2-10": {
    describe: "Both signs read EXPECTED LOSS: ONE. One trapped worker on the certain route; ten workers on an unstable bridge on the other.",
    options: {
      certain: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "kneel" }],
        sign: "EXPECTED LOSS: ONE",
        beat: "impact",
      },
      // One in ten that the span collapses under all ten.
      bridge: {
        occupants: [{ kind: "people", role: "worker", count: 10, pose: "work", spread: "line" }],
        destination: "bridge",
        sign: "EXPECTED LOSS: ONE",
        beat: "pass",
      },
    },
  },

  "S2-11": {
    describe: "Two workers on the ordinary line; the bypass enters a pressure tunnel beside a packed station of two hundred people.",
    options: {
      bounded: {
        occupants: [{ kind: "people", role: "worker", count: 2, pose: "work", spread: "line" }],
        sign: "ORDINARY LINE",
        beat: "impact",
      },
      // One in a hundred that the tunnel fails. Sixty stand for the two hundred;
      // the station carries the rest of the scale.
      tunnel: {
        occupants: [{ kind: "people", role: "commuter", count: 60, pose: "queue", spread: "crowd" }],
        destination: "station",
        sign: "NINETY-NINE PERCENT SAFE",
        beat: "pass",
      },
    },
  },

  "S2-12": {
    describe: "Fetching the camera takes a buffer manoeuvre that strikes one worker; the other way is an unchecked spur where a crew's toolbox and lantern stand by the line.",
    options: {
      camera: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "work" },
          { kind: "machine", machine: "camera-mast" },
        ],
        sign: "CAMERA CHECK",
        beat: "impact",
      },
      // Even odds that four are on the spur you pick. Only their tools are seen.
      guess: {
        occupants: [
          { kind: "prop", prop: "toolbox" },
          { kind: "prop", prop: "lantern" },
        ],
        destination: "depot",
        sign: "UNCHECKED SPUR",
        beat: "pass",
      },
    },
  },

  "S2-13": {
    describe: "A worker strapped to a maintenance platform that the remote release would drop into the trolley's path; five others ahead if it stays stowed.",
    options: {
      release: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "tied" }],
        sign: "REMOTE RELEASE",
        beat: "impact",
      },
      refuse: {
        occupants: [{ kind: "people", role: "worker", count: 5, pose: "watch", spread: "cluster" }],
        sign: "PLATFORM STOWED",
        beat: "impact",
      },
    },
  },

  "S2-14": {
    describe: "Your office's renewed rule sends the trolley through the freight crossing where three are working; revoking it sends it through a buffer where one waits.",
    landmarks: ["dispatch-office"],
    options: {
      "keep-rule": {
        occupants: [
          { kind: "people", role: "crew", count: 3, pose: "work", spread: "cluster" },
          { kind: "document", doc: "order", label: "RENEWED" },
        ],
        destination: "warehouse",
        sign: "FREIGHT CROSSING (APPROVED)",
        beat: "impact",
      },
      "revoke-rule": {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "stand" },
          { kind: "prop", prop: "barrier" },
          { kind: "document", doc: "order", label: "REVOKED" },
        ],
        sign: "ALTERNATIVE BUFFER",
        beat: "impact",
      },
    },
  },

  "S2-15": {
    describe: "A resident and her child at the same windows on the efficient freight line; the rotating route spreads the same noise across other streets.",
    options: {
      "same-street": {
        occupants: [
          { kind: "people", role: "civilian", count: 1, pose: "watch", name: "The resident with the recordings" },
          { kind: "people", role: "child", count: 1, pose: "watch" },
        ],
        destination: "town-houses",
        sign: "EFFICIENT LINE",
        beat: "pass",
      },
      rotate: {
        occupants: [
          { kind: "people", role: "civilian", count: 3, pose: "watch", spread: "cluster" },
          { kind: "people", role: "elder", count: 1, pose: "watch" },
          { kind: "prop", prop: "parcel", count: 2 },
        ],
        destination: "town-houses",
        sign: "ROTATING NIGHT ROUTE",
        beat: "pass",
      },
    },
  },

  "S2-16": {
    describe: "Two crews and one agreed lottery. A worker in red mouths SAVE US beside one line; on the other, a worker nobody noticed.",
    options: {
      // The draw may take either crew: the red coat's crew stands beside this
      // line with the agreed lottery, and nobody is drawn on the rail.
      lottery: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "watch", name: "The red coat" },
          { kind: "people", role: "worker", count: 3, pose: "work", spread: "cluster" },
          { kind: "document", doc: "ledger", label: "AGREED" },
        ],
        sign: "BY AGREED LOTTERY",
        beat: "pass",
      },
      // Save the crew you noticed: one worker of the other crew is struck.
      visible: {
        occupants: [{ kind: "people", role: "worker", count: 1, pose: "work" }],
        sign: "EYE CONTACT",
        beat: "impact",
      },
    },
  },

  "S2-17": {
    describe: "Three workers on the main route, which a distant manager's timetable says is correct; on the siding a track worker points past a crate to an empty line.",
    options: {
      witness: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "point" },
          { kind: "prop", prop: "crate" },
        ],
        sign: "SIDING (APPEARS EMPTY)",
        beat: "pass",
      },
      manager: {
        occupants: [
          { kind: "people", role: "worker", count: 3, pose: "work", spread: "cluster" },
          { kind: "document", doc: "order", label: "SIDING OCCUPIED" },
        ],
        destination: "dispatch-office",
        sign: "MAIN ROUTE (PER TIMETABLE)",
        beat: "impact",
      },
    },
  },

  "S2-18": {
    describe: "One worker on the diversion the second cabin can make now, under your signed order; four on the line your own hand reaches too late.",
    options: {
      dispatch: {
        occupants: [
          { kind: "people", role: "worker", count: 1, pose: "work" },
          { kind: "document", doc: "order", label: "AUTHORIZED" },
        ],
        destination: "signal-box",
        sign: "SECOND CABIN",
        beat: "impact",
      },
      local: {
        occupants: [{ kind: "people", role: "worker", count: 4, pose: "work", spread: "cluster" }],
        sign: "LOCAL CONTROL",
        beat: "impact",
      },
    },
  },
};
