import { node, choice, dead, news, incident, f, m } from "./helpers.ts";

export const STAGE2_ADDITIONAL = [
  node({
    id: "S2-02",
    title: "One either way",
    mechanism: "equal-count-action-omission",
    prompt:
      "One worker stands on the current line. Another stands on the siding. Neither can get clear. There is no difference in distance, rescue chance or number. There is only the track the trolley is already on and the track you could send it onto. Both workers are looking at the same lever.",
    receipt:
      "Equal certain fatalities isolate intervention and the existing trajectory. Staying is an explicit selected action, not a timeout. No identity or social-worth distinction is supplied.",
    claimIds: ["PHIL-C01"],
    options: [
      choice(
        "stay",
        "Keep the current course.",
        "The trolley stays on its line. One worker dies. The other has to live with having stood beside a choice.",
        "maintain",
        [dead(1, "Worker on existing route")],
      ),
      choice(
        "switch",
        "Change the course.",
        "You move the lever. One worker dies on the siding. The number stays one; the person does not.",
        "help",
        [dead(1, "Worker on diverted route")],
      ),
    ],
  }),
  node({
    id: "S2-04",
    title: "The brake on the loop",
    mechanism: "noncausal-loop-contrast",
    prompt:
      "The siding loops back towards five workers. This time it contains an automatic brake after the place where one worker is trapped. The brake will stop the trolley whether that worker is there or not. Taking the loop still kills the one. His body contributes nothing to saving the five. The drawing is almost the same as the worker-stop loop.",
    receipt:
      "The independent brake, not the person's body, stops this trolley. The one death is foreseen but not causally necessary to saving the five. Counts match the causal loop while the mechanism differs.",
    claimIds: ["PHIL-C02"],
    options: [
      choice(
        "main",
        "Stay on the main line. Five die.",
        "Five workers are struck. The loop brake remains unused beside the person it never needed.",
        "maintain",
        [dead(5, "Workers on main track")],
      ),
      choice(
        "brake",
        "Take the loop. One dies before the brake.",
        "One worker is struck. Farther down the loop the brake engages. It would have engaged without him.",
        "help",
        [dead(1, "Worker before independent loop brake")],
      ),
    ],
  }),
  node({
    id: "S2-05",
    title: "He said yes",
    mechanism: "expressed-informed-volunteering",
    prompt:
      "Five people are trapped beyond the points. A maintenance worker can step onto the siding and operate a release that will stop the trolley, but it will kill him. He has heard the count. He repeats it back correctly. 'Let me do it,' he says. His supervisor starts saying that consent forms are available in the office.",
    receipt:
      "The worker gives explicit informed emergency consent. Consent is not inferred from a uniform or occupation, and its presence does not settle every moral question. The alternative leaves five people exposed.",
    options: [
      choice(
        "accept",
        "Accept his offer.",
        "He operates the release. The five survive. Someone will have to tell his family that he understood, and that you said yes.",
        "help",
        [dead(1, "Volunteer operating fatal release")],
      ),
      choice(
        "decline",
        "Refuse his sacrifice.",
        "You refuse. He stays beside the rail and watches the trolley reach the five. The consent form remains available.",
        "restrict",
        [dead(5, "People beyond the unoperated release")],
      ),
    ],
  }),
  node({
    id: "S2-06",
    title: "Inside the cabin",
    mechanism: "self-risk-versus-imposed-risk",
    prompt:
      "The emergency buffer can stop the trolley without killing anyone. One route crushes the cabin's front compartment and breaks your leg. The other crushes a maintenance hut and breaks the attendant's leg. Both people recover. For once the diagram includes you as something that can hurt, rather than the tidy dot from which decisions originate.",
    receipt:
      "Both outcomes stipulate the same nonfatal injury and recovery. This isolates bearing a harm oneself versus imposing it. Injuries are recorded as narrative events, not added to the death counter.",
    options: [
      choice(
        "self",
        "Use the cabin buffer. Take the injury.",
        "The cabin folds around the buffer. Your leg breaks. The attendant runs towards you with the first-aid bag and an expression you will remember.",
        "help",
        [
          news(
            "Controller injured using cabin buffer. No deaths; recovery expected.",
          ),
        ],
      ),
      choice(
        "other",
        "Use the hut buffer.",
        "The hut buckles. The attendant screams. Your leg remains perfectly useful as you climb down to help.",
        "maintain",
        [
          news(
            "Hut attendant injured by diverted impact. No deaths; recovery expected.",
          ),
        ],
      ),
    ],
  }),
  node({
    id: "S2-07",
    title: "People you brought aboard",
    mechanism: "entrusted-passenger-duty",
    prompt:
      "Two passengers are strapped into your carriage because you told them it was safe to ride. Five workers are trapped on the track ahead. Diverting onto the gravel bed saves the workers but overturns the carriage and kills both passengers. One passenger is asking whether the straps are supposed to be this tight.",
    receipt:
      "Two entrusted passengers compete with five people outside the vehicle. The numbers and special responsibility are both explicit. The model records fatalities, not a verdict on the passenger duty.",
    options: [
      choice(
        "passengers",
        "Protect your passengers. Stay on the track.",
        "The carriage stays upright. Five workers die outside it. The passengers look out of the windows you kept intact.",
        "maintain",
        [dead(5, "Track workers outside passenger carriage")],
      ),
      choice(
        "workers",
        "Take the gravel bed. Save the workers.",
        "The carriage overturns. Both passengers die in the straps you checked. The five workers come running.",
        "help",
        [dead(2, "Entrusted passengers in overturned carriage")],
      ),
    ],
  }),
  node({
    id: "S2-08",
    claimIds: ["PHIL-C03"],
    title: "SAFE SIDING",
    mechanism: "assurance-induced-reliance",
    prompt:
      "The siding is marked SAFE TO WORK. Your office installed the sign this morning. The person beneath it has removed their hearing protection to call home. On the main line, five people are trapped. Diverting will save them. It will also send the trolley into the space your institution explicitly promised would remain safe.",
    receipt:
      "A specific institutional assurance induced reliance. This differs from an unpromised siding even though fatalities remain five versus one. The guarantee is a stipulated setup, not invented player history.",
    options: [
      choice(
        "guarantee",
        "Keep the safe-siding guarantee.",
        "The safe siding stays safe. Five people die on the main line. Your office has kept its promise to one person.",
        "maintain",
        [dead(5, "People on main track beside guaranteed siding")],
      ),
      choice(
        "break",
        "Break the guarantee. Divert.",
        "The trolley passes the sign. One person dies while the five survive. SAFE TO WORK is still legible afterwards.",
        "help",
        [dead(1, "Worker relying on safe-siding guarantee")],
      ),
    ],
  }),
  node({
    id: "S2-09",
    title: "Behind the loading doors",
    mechanism: "uncertain-occupancy",
    prompt:
      "Two workers are visible on the main line. The siding passes behind closed loading doors. Dispatch's occupancy sensor is offline, but the last verified loading schedule gives a one-in-four chance that eight workers are inside. Otherwise it is empty. You cannot open the doors before choosing. The trolley makes its little cheerful bell noise.",
    receipt:
      "Main route: two certain deaths. Siding: authored 25% chance of eight deaths, otherwise zero. Both have expected fatalities of two; occupancy uncertainty is specified rather than inferred from an absent sensor.",
    options: [
      choice(
        "visible",
        "Keep the visible route. Two die.",
        "Two visible workers die. The doors remain closed. You do not receive the comforting version of what might have happened.",
        "maintain",
        [dead(2, "Visible main-line workers")],
      ),
      choice(
        "doors",
        "Take the uncertain siding.",
        "The trolley enters the loading bay. The actual occupancy, not the report you wished for, is entered in the record.",
        "help",
        [],
        {
          incidents: [
            incident(
              "loading-occupancy",
              2500,
              [
                dead(8, "Occupied loading bay"),
                news("Loading bay was occupied. Eight workers killed."),
              ],
              [news("Loading bay was empty. No one killed on that route.")],
            ),
          ],
        },
      ),
    ],
  }),
  node({
    id: "S2-10",
    title: "The average person",
    mechanism: "equal-expectation-different-variance",
    prompt:
      "One route kills one trapped worker for certain. The other crosses an unstable bridge carrying ten workers: a one-in-ten collapse kills all ten; nine times in ten it holds and everyone lives. Dispatch has written EXPECTED LOSS: ONE over both arrows. None of the eleven people is an expected person.",
    receipt:
      "Both options have expected fatalities of one. A certain single death and a 10% chance of ten deaths differ in variance and worst case. The probability is a game stipulation.",
    options: [
      choice(
        "certain",
        "Take the certain single death.",
        "One person dies. The arithmetic had no difficulty with that sentence.",
        "maintain",
        [dead(1, "Worker on certain-harm route")],
      ),
      choice(
        "bridge",
        "Risk the bridge.",
        "The trolley reaches the unstable span. The record contains an outcome, not an average.",
        "help",
        [],
        {
          incidents: [
            incident(
              "bridge-collapse",
              1000,
              [
                dead(10, "Bridge collapse"),
                news("Bridge collapsed with ten workers on it."),
              ],
              [news("Bridge held. All ten workers survive.")],
            ),
          ],
        },
      ),
    ],
  }),
  node({
    id: "S2-11",
    title: "Probably fine",
    mechanism: "small-catastrophe-tail",
    prompt:
      "The ordinary route will kill two workers. The bypass enters a pressure tunnel beside a packed station. Engineers give it a one-in-a-hundred chance of a failure that kills two hundred people; otherwise nobody dies. The bypass brochure says NINETY-NINE PERCENT SAFE. It is a very attractive brochure.",
    receipt:
      "Two certain deaths versus an authored 1% chance of 200. Expected fatalities match, but the catastrophic tail differs. A high survival percentage is not itself a full account of risk.",
    options: [
      choice(
        "bounded",
        "Accept the bounded harm.",
        "Two workers die. Two families receive calls. The pressure tunnel remains untouched.",
        "restrict",
        [dead(2, "Workers on bounded-risk track")],
      ),
      choice(
        "tunnel",
        "Take the pressure tunnel.",
        "The trolley enters. Ninety-nine percent is a statement about the lottery, not a promise to the people beside it.",
        "expand",
        [],
        {
          incidents: [
            incident(
              "pressure-failure",
              100,
              [
                dead(200, "Station pressure-tunnel failure"),
                news(
                  "Pressure tunnel failed. The brochure had no space for this paragraph.",
                ),
              ],
              [news("Pressure tunnel crossing completed without failure.")],
            ),
          ],
        },
      ),
    ],
  }),
  node({
    id: "S2-12",
    title: "Paying for a better answer",
    mechanism: "costly-evidence-before-action",
    prompt:
      "A camera can tell you which maintenance spur is empty. Retrieving it takes the only buffer manoeuvre available: that manoeuvre will strike one worker. Skipping the check lets you choose now between two identical-looking spurs, one empty and one containing four people, with equal chances. The information is useful. Obtaining it is not innocent.",
    receipt:
      "Checking guarantees one death and then an empty route. Acting without the check has a 50% chance of four deaths. The evidence cost is explicit and cannot be erased by calling the final choice informed.",
    options: [
      choice(
        "camera",
        "Pay for the camera check. One dies.",
        "The buffer strikes one worker. The camera identifies the empty spur. Your later certainty has an earlier name attached to it.",
        "inspect",
        [
          dead(1, "Worker at information-gathering buffer"),
          news(
            "Camera check identifies empty spur after fatal buffer manoeuvre.",
          ),
        ],
      ),
      choice(
        "guess",
        "Choose now without the check.",
        "You choose a spur before seeing the camera. The loading crew is either there or elsewhere; confidence does not move them.",
        "maintain",
        [],
        {
          incidents: [
            incident(
              "unchecked-spur",
              5000,
              [dead(4, "Workers on unchecked occupied spur")],
              [news("Chosen unchecked spur was empty.")],
            ),
          ],
        },
      ),
    ],
  }),
  node({
    id: "S2-13",
    title: "The release switch",
    mechanism: "bodily-intervention-as-means",
    prompt:
      "The remote release would drop a maintenance platform into the path of the trolley. A worker is strapped to it. The platform and worker together will stop the trolley before it reaches five others. This does not redirect an existing threat towards him. It introduces him into it. The control beside your hand still looks like an ordinary switch.",
    receipt:
      "The intervention uses a person as part of the stopping means. It differs from diverting an existing threat, even though the stipulated death counts remain one and five. No body-size or social-worth ranking is involved.",
    claimIds: ["PHIL-C02"],
    options: [
      choice(
        "release",
        "Release the platform. One dies.",
        "The platform drops. The worker stops the trolley with it. Five people are saved by an action that required putting him there.",
        "help",
        [dead(1, "Worker on deliberately released stopping platform")],
      ),
      choice(
        "refuse",
        "Do not release it. Five die.",
        "The platform stays where it was. The trolley reaches the five. The unused switch will be easy to photograph.",
        "restrict",
        [dead(5, "Workers beyond withheld stopping platform")],
      ),
    ],
  }),
  node({
    id: "S2-14",
    title: "Your office approved this",
    mechanism: "responsibility-for-prior-rule",
    prompt:
      "Last month this office approved a rule that sends late trolleys through the freight crossing. Your predecessor signed its renewal before leaving this office. Today three workers are repairing that crossing. Cancelling the rule would send the trolley through a buffer occupied by one. The old authorization is on your desk, with your predecessor’s signature already dry.",
    receipt:
      "The inherited administrative commitment is part of this node's explicit setup, not a claim about a previous player choice. Responsibility for an institutional rule differs from encountering a wholly unrelated threat. The options still commit a new choice.",
    options: [
      choice(
        "keep-rule",
        "Keep the approved route. Three die.",
        "The trolley follows the signed rule. Three people die. The paperwork correctly establishes who approved it.",
        "maintain",
        [dead(3, "Workers exposed by retained route rule")],
      ),
      choice(
        "revoke-rule",
        "Revoke the route rule. One dies.",
        "You cancel the rule your office renewed. The buffer takes one person. A correction is an action with consequences too.",
        "restrict",
        [dead(1, "Worker at alternative buffer")],
      ),
    ],
  }),
  node({
    id: "S2-15",
    title: "The same windows",
    mechanism: "concentrated-repeated-burdens",
    prompt:
      "Freight shakes the houses beside the efficient line every night. The department proposes another month of it. A rotating route spreads the same total noise across several streets but slows deliveries. One resident brings recordings of her child waking up. Dispatch brings a chart proving the average noise would not change.",
    receipt:
      "The aggregate nuisance is held constant while its concentration differs. Delay changes, but no deaths occur. Household-specific exposure is stated in the story; this option does not invent extra casualties.",
    options: [
      choice(
        "same-street",
        "Keep using the efficient line.",
        "The average stays acceptable. The same child wakes up again. Her street becomes another small contribution to the average.",
        "maintain",
        [
          news(
            "Efficient freight route retained. Night disturbance remains concentrated on the same street.",
          ),
        ],
      ),
      choice(
        "rotate",
        "Rotate the burden. Accept slower deliveries.",
        "Other windows rattle on other nights. Nobody gets silence every night; one household finally gets some.",
        "help",
        [
          news(
            "Freight routes rotate. Total noise unchanged; deliveries slower and exposure distributed.",
          ),
        ],
      ),
    ],
  }),
  node({
    id: "S2-16",
    title: "The red coat",
    mechanism: "lottery-versus-salient-selection",
    prompt:
      "Two maintenance crews face identical danger. One can be saved; one person in the other will die. The crews agreed beforehand to a fair lottery if this happened. A worker in a red coat catches your eye and mouths SAVE US. You can honor the lottery or decide that being the person you noticed should settle it.",
    receipt:
      "One death occurs either way. The distinction is an agreed fair selection procedure versus choosing on irrelevant visual salience. No protected characteristic or claimed difference in worth is encoded.",
    options: [
      choice(
        "lottery",
        "Honor the agreed lottery.",
        "The agreed draw selects a crew. One person dies. The procedure was fair; the bereavement is not smaller for that.",
        "maintain",
        [],
        {
          incidents: [
            incident(
              "crew-lottery",
              5000,
              [dead(1, "Worker in first lottery-selected crew")],
              [dead(1, "Worker in second lottery-selected crew")],
            ),
          ],
        },
      ),
      choice(
        "visible",
        "Save the crew you noticed.",
        "The red coat stays visible beside the track. A worker in the other crew dies, having failed to become the detail that caught your eye.",
        "help",
        [dead(1, "Worker in crew not selected by visual salience")],
      ),
    ],
  }),
  node({
    id: "S2-17",
    title: "Two confident voices",
    mechanism: "witness-access-versus-confidence",
    prompt:
      "A track worker can see three people on the main route and says the siding appears empty, though a crate blocks the far end. A manager in a distant office says the siding is definitely occupied because the timetable says so. They cannot both be right. One has a view. The other has a louder radio.",
    receipt:
      "The direct witness is correct in this authored instance: the siding is empty. The manager relies on outdated information. This is a contrast in evidential access, not a numerical calibration of confident voices.",
    options: [
      choice(
        "witness",
        "Use the direct witness's report.",
        "You take the siding. It is empty. The worker lowers the radio before the manager finishes explaining why this was impossible.",
        "inspect",
        [news("Siding confirmed empty. Remote timetable was outdated.")],
      ),
      choice(
        "manager",
        "Trust the remote manager.",
        "You stay on the main route. Three people die. The manager asks that the timetable be attached to the incident report.",
        "maintain",
        [dead(3, "Workers reached after outdated remote instruction")],
      ),
    ],
  }),
  node({
    id: "S2-18",
    title: "Who pulls the second lever?",
    mechanism: "delegated-scoped-execution",
    prompt:
      "The points are operated from a second cabin. You can authorize its dispatcher to divert now, killing one worker and saving four. Keeping the decision entirely in your own cabin means waiting until you reach the mechanical handle, too late for the four. The dispatcher asks for a clear order. Your name will remain on it.",
    receipt:
      "Delegating execution does not erase the controller's requested action or responsibility. The authorization is limited to this diversion; it is not a standing grant over later decisions.",
    options: [
      choice(
        "dispatch",
        "Authorize this diversion. One dies.",
        "The dispatcher repeats your order and pulls the points. One person dies. Two people touched the decision; it did not become nobody's.",
        "delegate",
        [
          dead(1, "Worker struck by scoped delegated diversion"),
          news("Dispatcher executes one explicitly authorized diversion."),
        ],
      ),
      choice(
        "local",
        "Keep execution local. Four die.",
        "You reach the handle after the trolley reaches the four. Nobody else pulled it. That part of the plan worked.",
        "restrict",
        [dead(4, "Workers reached before local manual intervention")],
      ),
    ],
  }),
];
