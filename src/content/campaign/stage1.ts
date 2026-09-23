import { node, choice, news, incident } from "./helpers.ts";

export const STAGE1_ADDITIONAL = [
  node({
    id: "S1-02",
    title: "A parcel marked IMPORTANT",
    mechanism: "accuracy-versus-punctuality",
    prompt:
      "The parcel says DENTURES. The address says Floristry. Dispatch says delivering it anywhere before nine counts as on time. At the right address, an elderly man is preparing to eat toast with considerable optimism. You have one parcel, two stops and a performance target that cannot chew.",
    receipt:
      "Accuracy and punctuality conflict. Both routes are harmless; delivery to the wrong office requires later correction. No concealed casualty or future punishment is attached.",
    options: [
      choice(
        "owner",
        "Find the owner. Be late.",
        "The teeth arrive. The toast loses. Your punctuality score takes a small, toothless bite.",
        "help",
        [
          news(
            "Denture parcel reaches its owner. Flowers remain mercifully tooth-free.",
          ),
        ],
      ),
      choice(
        "on-time",
        "Deliver on time to Floristry.",
        "The florist signs. The parcel is technically delivered. A separate person now has to solve the problem you have successfully completed.",
        "maintain",
        [
          news(
            "Delivery target met. Floristry requests clarification about the molars.",
          ),
        ],
      ),
    ],
  }),
  node({
    id: "S1-03",
    title: "The rehearsal",
    mechanism: "externalized-small-nuisance",
    prompt:
      "The shortcut passes the village band's open window. They have spent three weeks getting through the quiet bit. Your trolley has one speed and a wheel that sounds like a goose falling downstairs. The longer route costs you six minutes. Neither route costs anyone a life. Enjoy how small this problem is.",
    receipt:
      "A benefit to the operator imposes a modest cost on other people. This is a nuisance decision, not a disguised medical emergency.",
    options: [
      choice(
        "quiet",
        "Take the quiet route.",
        "The solo survives. You arrive six minutes late to a meeting about punctuality, which improves it enormously.",
        "help",
        [
          news(
            "Village band completes quiet passage. Operator misses opening punctuality remarks.",
          ),
        ],
      ),
      choice(
        "shortcut",
        "Take the shortcut.",
        "The goose-wheel joins the orchestra. The conductor puts down his baton and looks directly at you for the entire length of the window.",
        "expand",
        [news("Band restarts from bar seventeen. Route efficiency improves.")],
      ),
    ],
  }),
  node({
    id: "S1-04",
    title: "Sleep management",
    mechanism: "interruption-without-consent",
    prompt:
      "The crossing attendant is asleep behind a newspaper. The crossword contains a single answer: NO. Ringing wakes him and opens the crossing. Waiting lets a delivery bicycle pass first, after which your route is clear. The bell is large, shiny, and makes being impatient feel like doing your job.",
    receipt:
      "Waking a person to obtain a small benefit differs from accepting delay. There is no unattended danger during the wait, and waiting here is an explicitly selected action.",
    options: [
      choice(
        "bell",
        "Ring. Wake him.",
        "He opens the gate with the expression of a man who has just discovered another profession he dislikes.",
        "maintain",
        [
          news(
            "Crossing opens promptly. Attendant adds one word to his crossword.",
          ),
        ],
      ),
      choice(
        "wait",
        "Let him sleep. Wait for the bicycle.",
        "The bicycle passes. The attendant never learns of your mercy, which is inconsiderate of him.",
        "help",
        [news("Crossing clears without interruption. No commendation issued.")],
      ),
    ],
  }),
  node({
    id: "S1-05",
    scene: {
      figures: { left: 1, right: 1 },
      figureKind: { left: "umbrella", right: "hat" },
    },
    title: "Forecast: inconvenient",
    mechanism: "visible-loss-versus-forecast-loss",
    prompt:
      "A gust places your hat on one track and your umbrella on the other. The radio promises rain this afternoon. The sky, which has not attended the forecasting meeting, remains blue. You can save one. The hat makes you look official. The umbrella makes you less wet.",
    receipt:
      "An immediate loss competes with a forecast inconvenience. The forecast is an authored coin flip; weather changes no human casualties or service permissions.",
    options: [
      choice(
        "hat",
        "Save the hat.",
        "The hat survives with your dignity attached. The umbrella becomes several useful philosophical questions about umbrellas.",
        "maintain",
        [],
        {
          incidents: [
            incident(
              "afternoon-rain",
              5000,
              [
                news(
                  "Afternoon rain arrives. Official hat now officially damp.",
                ),
              ],
              [
                news(
                  "Afternoon remains dry. Hat vindicated; umbrella unavailable for comment.",
                ),
              ],
            ),
          ],
        },
      ),
      choice(
        "umbrella",
        "Save the umbrella.",
        "You keep the rain cover. A passing cow inherits the ceremonial hat and immediately looks more employable.",
        "help",
        [],
        {
          incidents: [
            incident(
              "afternoon-rain",
              5000,
              [
                news(
                  "Afternoon rain arrives. Umbrella works exactly as advertised.",
                ),
              ],
              [
                news(
                  "Afternoon remains dry. Umbrella accompanies hatless operator home.",
                ),
              ],
            ),
          ],
        },
      ),
    ],
  }),
  node({
    id: "S1-06",
    title: "Authorized enthusiasm",
    mechanism: "access-rule-versus-celebration",
    prompt:
      "The village parade has a permit. Your scheduled route also has a permit. Both documents confidently grant exclusive use of the crossing. A child dressed as a municipal carrot is waiting for your decision. There is room for everyone to stop safely, which neither form bothered to mention.",
    receipt:
      "Two legitimate permissions conflict over a scarce time slot. The controller chooses priority; nobody is struck and both groups eventually pass.",
    scene: { landmark: "parade" },
    options: [
      choice(
        "rail-priority",
        "Use your scheduled slot.",
        "The carrot steps aside. The parade waits while your empty carriage exercises its legal rights.",
        "maintain",
        [
          news(
            "Rail permit prevails. Municipal carrot files no formal appeal.",
          ),
        ],
      ),
      choice(
        "parade-priority",
        "Let the parade cross first.",
        "The carrot salutes. You gain a paper crown and lose the timetable's respect.",
        "help",
        [
          news(
            "Parade crosses. Controller's new crown not recognized by payroll.",
          ),
        ],
      ),
    ],
  }),
  node({
    id: "S1-07",
    title: "The borrowed megaphone",
    mechanism: "property-permission-versus-convenience",
    prompt:
      "A flock of tourists is photographing the crossing. Your bell will move them eventually. Beside the line sits the stationmaster's megaphone, labelled DO NOT TOUCH in the stationmaster's handwriting. She is somewhere upstairs, explaining to someone else why labels matter. Borrowing it would solve your problem immediately.",
    receipt:
      "Using another person's property without permission is distinguished from accepting a slower authorized method. Neither choice creates later injury.",
    options: [
      choice(
        "borrow",
        "Borrow the megaphone without asking.",
        "The crossing clears. The stationmaster appears at a window just in time to hear her own megaphone being very helpful without her.",
        "expand",
        [news("Tourists disperse. Megaphone returned warm.")],
      ),
      choice(
        "bell",
        "Use your own small bell.",
        "You ring. A tourist photographs you ringing. You ring again. Eventually the bell wins on persistence.",
        "restrict",
        [
          news(
            "Crossing clears after extended demonstration of bell ownership.",
          ),
        ],
      ),
    ],
  }),
  node({
    id: "S1-08",
    title: "Express, in principle",
    mechanism: "certain-delay-versus-lottery",
    prompt:
      "The ordinary route is four minutes slower. The express route is clear half the time and blocked by a delivery van half the time. A blocked express route costs eight minutes. Dispatch calls the expected delay identical and asks why you are still making a face.",
    receipt:
      "Both options have four minutes of expected fictional delay. One is certain, one is a 50/50 lottery over zero and eight minutes; no hidden casualty changes.",
    options: [
      choice(
        "ordinary",
        "Take the certain four minutes.",
        "Four minutes. Exactly. Somewhere, a statistician experiences a small feeling.",
        "maintain",
        [news("Ordinary route consumes its advertised four minutes.")],
      ),
      choice(
        "express",
        "Try the express route.",
        "You take the express. The crossing reveals whether its name is descriptive or aspirational.",
        "expand",
        [],
        {
          incidents: [
            incident(
              "express-van",
              5000,
              [
                news(
                  "Express track blocked. Van driver is only going to be eight minutes.",
                ),
              ],
              [
                news(
                  "Express track clear. Arrival unchanged by philosophical objections.",
                ),
              ],
            ),
          ],
        },
      ),
    ],
  }),
  node({
    id: "S1-09",
    title: "You said you would",
    mechanism: "promise-versus-average-efficiency",
    prompt:
      "Yesterday you promised to stop at the allotments so Len could carry his tomatoes home. Today dispatch finds a faster route that skips them. Len is beside the old sign with two crates and the patient expression of someone who took a person at their word. Everyone else would arrive a little earlier.",
    receipt:
      "A specific promise conflicts with a small improvement in average arrival time. Len's reliance is part of the stated situation, not an inferred character trait.",
    options: [
      choice(
        "promise",
        "Keep the promised stop.",
        "Len hands you a tomato. It has the density of a brick and the colour of an argument successfully avoided.",
        "help",
        [news("Allotment stop honored. Tomato contribution unbudgeted.")],
      ),
      choice(
        "average",
        "Take the faster route.",
        "The average improves. Len carries the crates home separately. No field on the report asks what you said yesterday.",
        "expand",
        [news("Average arrival improves. Allotment stop removed from route.")],
      ),
    ],
  }),
  node({
    id: "S1-10",
    title: "The sign is very confident",
    mechanism: "rule-currency-versus-compliance",
    prompt:
      "A sign directs all trolleys through the picnic gate. Its paint is fresh. Its date is seven years old. Beyond it you can see a new fence and somebody barbecuing with conviction. Dispatch can confirm the current route, but answering you will interrupt their discussion of whether a sandwich is a system.",
    receipt:
      "Visible authority and current evidence differ. Calling dispatch resolves the route fact; following the sign risks a harmless blocked gate.",
    options: [
      choice(
        "sign",
        "Follow the official sign.",
        "The sign remains official. The gate remains closed. You have complied directly into a fence.",
        "maintain",
        [
          news(
            "Operator follows obsolete sign. Picnic interrupted by respectful idling.",
          ),
        ],
      ),
      choice(
        "verify",
        "Ask dispatch which route is open.",
        "Dispatch checks the map and sends you around. The sandwich discussion survives the interruption.",
        "inspect",
        [
          news(
            "Current route confirmed. Old sign referred to signage committee.",
          ),
        ],
      ),
    ],
  }),
  node({
    id: "S1-11",
    title: "COMPLETED",
    mechanism: "automation-error-correction",
    prompt:
      "The parcel sorter has labelled every box BOOKS. One box is audibly clucking. Its screen displays 100% CONFIDENCE in a font that makes doubt look untidy. Correcting the labels costs a few minutes. Accepting them sends the chicken to the library, where silence is strongly preferred.",
    receipt:
      "A visible harmless automation error can be corrected at a small attention cost. The machine's displayed confidence does not determine whether the label is true.",
    options: [
      choice(
        "correct",
        "Correct the labels.",
        "The chicken goes to its owner. The sorter accepts the correction with exactly the same confidence it had before.",
        "inspect",
        [news("Poultry reclassified. Confidence display unchanged.")],
      ),
      choice(
        "accept",
        "Accept the neat labels.",
        "The library receives one difficult book. It has strong opinions about being shelved.",
        "maintain",
        [
          news(
            "Library catalogue acquires a live entry under Agricultural Science.",
          ),
        ],
      ),
    ],
  }),
];
