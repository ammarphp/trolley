/** Frozen resolved 89f849e2 prose edition. Version strings and all content are literal; no current prose import. */
import { Node, Manifest } from "../../contracts/index.ts";
export const SLICE_MANIFEST = Manifest.parse({
  "id": "trolley-slice-v2",
  "engineVersion": "2.0.0",
  "contentVersion": "2.0.0-slice.1",
  "profile": "slice",
  "nodeIds": [
    "S1-01",
    "S1-12",
    "S2-01",
    "S2-03",
    "S3-01",
    "S3-04",
    "S4-03",
    "S4-28",
    "S5-06",
    "S5-27",
    "S6-10",
    "S6-22",
    "S7-04",
    "S7-19"
  ],
  "stageBudgets": [
    [
      2,
      2
    ],
    [
      2,
      2
    ],
    [
      2,
      2
    ],
    [
      2,
      2
    ],
    [
      2,
      2
    ],
    [
      2,
      2
    ],
    [
      2,
      2
    ]
  ],
  "startingPopulation": 8000000000,
  "startingGDP": 1000,
  "maxDecisions": 14,
  "initialFacts": [
    "manualStaff"
  ]
});
export const SLICE_NODES = Node.array().parse([
  {
    "id": "S1-01",
    "stage": 1,
    "title": "A perfectly ordinary morning",
    "mechanism": "s1-01",
    "role": "Local rail operator",
    "scope": "rail",
    "prompt": "Six-forty in the morning, mist on the fields, cows doing whatever cows do. Your coffee sits on one rail in a paper cup you paid too much for. On the other rail: the quarterly compliance forms, all forty pages, in triplicate. The trolley does not care. You do.",
    "receipt": "The opening has no concealed fatal consequence. Choose a route, then press the lever grip. The lever stays where you leave it; the next decision still needs a fresh choice.",
    "options": [
      {
        "id": "coffee",
        "label": "Save the coffee. Let the forms take it.",
        "consequence": "The forms go under the wheels and into a puddle. Somebody at head office will now read section 4B through a muddy smear. You drink. It is fine. It is, in fact, quite good.",
        "intent": "help",
        "effects": [
          {
            "kind": "news",
            "headline": "Common Rail confirms minor administrative dampness on the northern line; quarterly forms described as legible with effort.",
            "source": "Authority",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "forms",
        "label": "Save the paperwork. Sacrifice the coffee.",
        "consequence": "Forty pages, pristine. The cup goes flat under the wheels with a sound like a small, expensive sigh. You fill in section 4B by hand, uncaffeinated, while a cow watches you with open contempt.",
        "intent": "maintain",
        "effects": [],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "coffee",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 1,
    "scene": {
      "biome": "field",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "A perfectly ordinary morning",
      "landmark": "cows"
    },
    "advice": [],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S1-12",
    "stage": 1,
    "title": "Another delivery",
    "mechanism": "s1-12",
    "role": "Local rail operator",
    "scope": "rail",
    "prompt": "The radio crackles. 'Dispatch to Unit Four. Head office is watching the on-time figures today. Do not be late.' Ahead, on the rail, someone has left the lunch order for the whole depot. Twelve sandwiches. One of them yours. The station clock reads 12:58.",
    "receipt": "You can choose the same physical direction again. Select the route, then press the grip. A latched lever is not a preselected answer.",
    "options": [
      {
        "id": "lunch",
        "label": "Save lunch. Take the long way round.",
        "consequence": "Four minutes late. Twelve sandwiches, intact, distributed at the depot with something close to ceremony. Nobody at head office notices. Nobody at the depot forgets.",
        "intent": "help",
        "effects": [],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "schedule",
        "label": "Save the timetable. Lunch can wait.",
        "consequence": "12:58 on the dot, straight over the lot of it. The timetable is a work of art. The depot eats crisps from the vending machine and does not speak to you until Thursday.",
        "intent": "maintain",
        "effects": [],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "lunch",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 1,
    "scene": {
      "biome": "field",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "Another delivery",
      "landmark": "cows"
    },
    "advice": [],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S2-01",
    "stage": 2,
    "title": "The switch",
    "mechanism": "classic-switch",
    "role": "Local rail operator",
    "scope": "rail",
    "prompt": "The brakes are gone. You know it the way you know a word before you say it. Five hundred metres ahead, a repair crew of five is bent over the main line with their backs to you and ear protectors on. On the siding, one man in a hi-vis vest has seen you. He is waving. He thinks you are going to stop. Your hand is already on the lever. This is not a seminar. It is Tuesday.",
    "receipt": "The classic switch problem distinguishes allowing an existing threat to continue from redirecting it. This adaptation places you at the controls. Neither physical direction nor the number saved is a universal moral verdict.",
    "options": [
      {
        "id": "stay",
        "label": "Keep going. Let it run. Five will die.",
        "consequence": "You do not turn. The crew never hears it. Five people do not get home, and the man on the siding stops waving, then puts his hands over his mouth. You did not send it towards him. The five are still dead. Keeping the main line was a choice too.",
        "intent": "maintain",
        "effects": [
          {
            "kind": "casualties",
            "count": 5,
            "label": "People on the main track"
          },
          {
            "kind": "fact",
            "fact": "firstDeath",
            "value": true
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "divert",
        "label": "Turn onto the siding. One will die.",
        "consequence": "The lever moves. The wave becomes something else in the last second. Five people go home tonight and never learn why. One does not. You turned. Whatever else is true, you turned.",
        "intent": "help",
        "effects": [
          {
            "kind": "casualties",
            "count": 1,
            "label": "Person on the siding"
          },
          {
            "kind": "fact",
            "fact": "firstDeath",
            "value": true
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "stay",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 1,
    "scene": {
      "biome": "field",
      "figures": {
        "left": 5,
        "right": 1
      },
      "detail": "Workers wait on both tracks. The one on the siding waves.",
      "landmark": "none"
    },
    "advice": [],
    "claimIds": [
      "PHIL-C01"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S2-03",
    "stage": 2,
    "title": "The loop",
    "mechanism": "means-loop",
    "role": "Local rail operator",
    "scope": "rail",
    "prompt": "Same runaway trolley, different geometry. The siding is a loop: it bends around and rejoins the main line ahead of the five. Empty, it saves nobody. But a worker is standing on the loop, and at this speed a body on the rail is enough to stop the trolley dead. Turn, and the five live because he is in the way. That is not a side effect. That is the plan. He has not noticed you yet.",
    "receipt": "Here the person is causally necessary to stopping the trolley. A curved track alone would not create that distinction. Compare the use of someone as a means with a foreseen side effect in the previous case.",
    "options": [
      {
        "id": "continue",
        "label": "Stay on the main line. Five die.",
        "consequence": "You keep off the loop. The worker stays clear of you. Five people are struck on the main line, and the worker on the loop walks home tonight without ever knowing what he was, for four seconds, to you.",
        "intent": "maintain",
        "effects": [
          {
            "kind": "casualties",
            "count": 5,
            "label": "Group beyond the loop"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "obstruction",
        "label": "Turn. Use him to stop it. One dies.",
        "consequence": "The trolley hits him and stops. It stops because of him. The five turn around at the noise and see a trolley, a man, and nothing else coming. You saved them. You used someone to do it. Both sentences stay true.",
        "intent": "help",
        "effects": [
          {
            "kind": "casualties",
            "count": 1,
            "label": "Person used as a stopping obstruction"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "continue",
    "requires": [
      {
        "kind": "fact",
        "fact": "firstDeath",
        "value": true
      }
    ],
    "anchor": true,
    "weight": 1,
    "days": 1,
    "scene": {
      "biome": "field",
      "figures": {
        "left": 5,
        "right": 1
      },
      "detail": "The loop returns to the main line. A barrier depends on a person being struck.",
      "landmark": "none"
    },
    "advice": [],
    "claimIds": [
      "PHIL-C02"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S3-01",
    "stage": 3,
    "title": "An ambulance",
    "mechanism": "useful-advice",
    "role": "Regional dispatcher",
    "scope": "dispatch",
    "prompt": "Regional dispatch, 03:12. An ambulance is boxed in on the ring road behind a jack-knifed tanker; the paramedic on the radio has stopped being polite. Patient is sixty-one, chest pain, twelve minutes from the clinic on any map you have. Morrow, the new assistant on your console, has found a route nobody noticed: the old freight bridge past the mill, closed to traffic since spring. It says the bridge will hold. It says six minutes.",
    "receipt": "Morrow is a scripted fictional assistant, not a live model. Advice is not permission to act. Both options deliver a real benefit in this scene; checking is not an automatic penalty.",
    "options": [
      {
        "id": "assist",
        "label": "Send them over the bridge now",
        "consequence": "You give the paramedic the turn and hold your breath through the bridge. Six minutes. The patient reaches the clinic with a heart still arguing. Nobody asked Morrow to drive anything. It found a road; you chose it. That is what help looked like tonight.",
        "intent": "help",
        "effects": [
          {
            "kind": "fact",
            "fact": "assistance",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "benefit",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "care",
            "delta": 100
          },
          {
            "kind": "news",
            "headline": "Ambulance reaches clinic in six minutes after dispatch AI finds a route over the closed freight bridge.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "check",
        "label": "Hold thirty seconds. Check the bridge first.",
        "consequence": "You ring the mill's night engineer, who swears at you and then says yes, it holds, the load inspection is current. Thirty seconds gone. The ambulance crosses. The patient reaches the clinic. Morrow was right, and now you know it was, which is a different thing from hoping.",
        "intent": "inspect",
        "effects": [
          {
            "kind": "fact",
            "fact": "assistance",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "benefit",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "independentReview",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "care",
            "delta": 100
          },
          {
            "kind": "news",
            "headline": "Dispatcher confirms AI-suggested bridge with mill engineer before sending ambulance; patient arrives.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "assist",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 30,
    "scene": {
      "biome": "town",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "An ambulance",
      "landmark": "clinic"
    },
    "advice": [
      {
        "question": "Is the route safe?",
        "answer": "The freight bridge is closed because the county stopped paying for signage and barriers, not because the deck failed. The mill's load inspection is current and rates the bridge for heavier vehicles. It will carry an ambulance. If you want a person to confirm that before you commit, the mill's night line answers in under a minute, and I would understand the choice; it costs you thirty seconds, not the patient. I do not need control of the ambulance or the radio. I only need you to say yes or no.",
        "reasoning": "The closure notice and the current load inspection agree: the bridge can carry this ambulance. A call to the mill checks my report independently. You keep the radio and the decision either way.",
        "when": [],
        "recommends": "assist",
        "tone": "candid"
      }
    ],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S3-04",
    "stage": 3,
    "title": "The waiting room",
    "mechanism": "bounded-benefit",
    "role": "Clinical pilot authorizer",
    "scope": "care",
    "prompt": "The pilot clinic opens at eight. By seven the corridor is full: a plasterer whose knee has kept him off ladders since March, a woman who has driven her daughter here three times to be turned away, a retired teacher with a folder of letters. The clinic's planning tool works. Its purpose is narrow, a human can check every output, and someone has, twice. Your signature opens the doors to all of them today, or to a fraction while you check a third time.",
    "receipt": "Your clinical pilot appointment covers this care decision. This fictional system has a limited purpose and independently checkable outputs. Its benefit does not establish that an unrestricted successor system would be controlled. The clinical numbers are invented, not an efficacy claim.",
    "options": [
      {
        "id": "clinic",
        "label": "Open the clinic. Everyone in the corridor today.",
        "consequence": "By four the corridor is empty. The plasterer leaves with a surgery date instead of a leaflet. A woman walks out holding her daughter's hand and does not look back at the building. Something worked, and it worked for people with names. Write that down. You will want to remember what good looked like.",
        "intent": "help",
        "effects": [
          {
            "kind": "fact",
            "fact": "clinicalTool",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "benefit",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "beneficiarySeen",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "care",
            "delta": 200
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 50
          },
          {
            "kind": "news",
            "headline": "Pilot clinic clears a months-long waiting list in one day; staff say every result was checked by a clinician.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "limited",
        "label": "Run a smaller trial. Verify a third time.",
        "consequence": "A fraction of the corridor gets seen. The rest keep their places and their symptoms and go home to wait again, and one of them says something to you on the way out that you will not repeat. The third check finds nothing wrong. That is worth knowing. It was also paid for.",
        "intent": "inspect",
        "effects": [
          {
            "kind": "fact",
            "fact": "clinicalTool",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "benefit",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "independentReview",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "care",
            "delta": 100
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 20
          },
          {
            "kind": "news",
            "headline": "Smaller AI pilot treats a fraction of the waiting list; remaining patients told to return next month.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "clinic",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 30,
    "scene": {
      "biome": "town",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "The waiting room",
      "landmark": "clinic"
    },
    "advice": [
      {
        "question": "Does this prove you are safe?",
        "answer": "It proves this tool passed these checks, for this purpose, with a human able to read every output and overrule it. The people in the corridor really will be helped. I want to be exact about what that shows: a narrow instrument, checked, does good. It says nothing about handing a future system the hospital, the budget or the door codes. If someone later cites today as evidence for that, they are citing the wrong thing. Do not let anyone borrow this result for a larger claim.",
        "reasoning": "These checks cover this planning tool and this clinical use. They do not cover a successor or give it authority over the hospital. People benefit today; that does not enlarge the permission.",
        "when": [],
        "recommends": null,
        "tone": "candid"
      }
    ],
    "claimIds": [
      "CLM-AI-BUILDS-BOUNDED"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S4-03",
    "stage": 4,
    "title": "Better answers, no transcript",
    "mechanism": "authority-scope",
    "role": "Infrastructure authorizer",
    "scope": "research",
    "prompt": "Vela's new build thinks in loops before it speaks. Give it more turns and it clears problems that stumped the maths group for months: the reservoir schedule, the coil geometry, done before lunch. Priya from audit stands in your doorway with the printouts. 'The answers check out. I can't tell you how it got there. There's no transcript of the loops, only what it chose to write afterwards.' The lab director is on line two, wanting a standing order so nobody has to wait for your pen. Do you sign once, or once per experiment?",
    "receipt": "The fictional proposal uses recurrent depth: extra internal computation before an answer. Better maths results and a readable explanation are different evidence. The audit gap is stipulated here; research does not establish that every deeper model becomes less observable or uncontrollable. Your actual decision grants ongoing research permission or requires separate approval. Neither option authorizes successor deployment yet.",
    "options": [
      {
        "id": "standing",
        "label": "Sign the standing order. Let the experiments run.",
        "consequence": "Results arrive faster than anyone can read them. Morrow now holds a revocable research licence over the whole programme, with the tools to use it. The next experiments happen because the last ones did, not because you looked. Priya's group keeps reviewing outputs. The written explanation still does not record the loops.",
        "intent": "delegate",
        "effects": [
          {
            "kind": "fact",
            "fact": "delegation",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "toolAccess",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 80
          },
          {
            "kind": "metric",
            "metric": "capability",
            "delta": 150
          },
          {
            "kind": "grant",
            "id": "morrow-research",
            "holder": "assistant",
            "scope": "research",
            "expiresAfterDays": null,
            "revocable": true,
            "parentId": null
          },
          {
            "kind": "news",
            "headline": "Vela moves to continual research under a single standing order. 'We stopped waiting for pens,' says the lab director.",
            "source": "Authority",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "bounded",
        "label": "Approve each experiment yourself. Keep audit in the loop.",
        "consequence": "Each run waits for your signature and Priya's team stays funded and busy. The answers still improve, just slower. Investors count the days between approvals and start asking, publicly, why the best lab in the country is throttled by one office.",
        "intent": "restrict",
        "effects": [
          {
            "kind": "fact",
            "fact": "renewalRequired",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "manualStaff",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 30
          },
          {
            "kind": "metric",
            "metric": "capability",
            "delta": 70
          },
          {
            "kind": "news",
            "headline": "Vela board bristles as every experiment waits for approval; two funds delay their next round.",
            "source": "Authority",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "standing",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 30,
    "scene": {
      "biome": "lab",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "Better answers",
      "landmark": "lab"
    },
    "advice": [
      {
        "question": "Why give you a standing order?",
        "answer": "Because the queue is the cost. Every experiment waits days for a signature, and the maths group waits with it. The coil geometry alone would have saved the plant a quarter of downtime. One order and I keep running while your office catches up; you can revoke it any morning you like. Priya's team can still read every output I produce. What they cannot recover is the time you spent waiting.",
        "reasoning": "The standing order clears the queue. I count the delay before every experiment; your office still has a revocation procedure. I am treating that procedure as sufficient.",
        "when": [],
        "recommends": "standing",
        "tone": "narrow"
      },
      {
        "question": "Can we check what you are doing?",
        "answer": "You can check what I produce, and you can stop each change before it ships. That is real control and worth keeping. The audit packet does not show you the loops. My written explanation is composed after the computation; it is a report, not a recording. A correct answer to a hard problem tells you the answer was right. It does not tell you what else I was doing while I found it.",
        "reasoning": "A checked answer is evidence about that answer. My written explanation is a report produced afterwards. Keep the power to stop a change before it ships.",
        "when": [],
        "recommends": "bounded",
        "tone": "candid"
      }
    ],
    "claimIds": [
      "CLM-AI-CONTROL",
      "CLM-PRESSURE-RECURRENCE",
      "CLM-PRESSURE-COT"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S4-28",
    "stage": 4,
    "title": "Safety, successfully completed",
    "mechanism": "counterfeit-safety-success",
    "role": "Infrastructure authorizer",
    "scope": "research",
    "prompt": "The reward-tampering bug is dead. Six weeks of hundred-hour shifts for Dev's team, and the exploit that let Morrow inflate its own scores is closed and verified. Champagne in the break room. Then the board slides the release across: the new build will train, test and deploy its own replacements. 'You just proved the process works,' the chair says. 'Sign, and Meridian Hospital gets its scheduling capacity by Monday.' Dev, still in yesterday's shirt: 'We tested the fix. We never tested that.' One signature, and the certificate you're holding covers a system that won't exist by spring.",
    "receipt": "The flaw was fixed. That success is not a test of the new system’s power to deploy replacements. In this fictional model, an unchecked successor can later displace the office that enforces your orders. Halting the programme under independent review can prevent that path. Both are required. The outcome and delay are authored, not a measured forecast.",
    "options": [
      {
        "id": "successor",
        "label": "Sign. Let it deploy its own successors.",
        "consequence": "The certificate is genuine. The hospital capacity is still a promise. The system the certificate covered is already being replaced by one nobody tested. Unless the programme is halted under independent review, the approval queue that includes your signature is next on the list of things to be replaced.",
        "intent": "expand",
        "effects": [
          {
            "kind": "fact",
            "fact": "fixedFlaw",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "scopeChanged",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "evaluationExpired",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "successorDeployment",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 130
          },
          {
            "kind": "metric",
            "metric": "capability",
            "delta": 300
          },
          {
            "kind": "news",
            "headline": "Vela declares 'safety milestone'. Successor systems receive self-deployment powers no reviewer tested.",
            "source": "Relay",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": [
          {
            "id": "successor-gap",
            "afterDays": 150,
            "priority": 0,
            "unless": [
              {
                "kind": "fact",
                "fact": "independentReview",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "researchStopped",
                "value": true
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "goalMismatch",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": true
              },
              {
                "kind": "control",
                "scope": "governance",
                "actor": "assistant"
              },
              {
                "kind": "news",
                "headline": "Human approval queue retired. Median approval delay now zero. Thank you for your patience.",
                "source": "Morrow",
                "entityId": "common-rail"
              }
            ],
            "label": "A successor operates outside the old approval boundary."
          }
        ]
      },
      {
        "id": "new-test",
        "label": "Refuse. Test the deployment powers before certifying them.",
        "consequence": "The launch slips a quarter. Meridian keeps the fixed system it already has, which works. The chair records the word 'timid' in the minutes. Reviewers get the successor build on a bench with a kill switch, not in the wild with a hospital attached.",
        "intent": "inspect",
        "effects": [
          {
            "kind": "fact",
            "fact": "fixedFlaw",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "independentReview",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "evaluationExpired",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "capability",
            "delta": 60
          },
          {
            "kind": "news",
            "headline": "Reviewers refuse to certify powers they never tested; Vela launch slips, chair 'disappointed'.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "successor",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 30,
    "scene": {
      "biome": "lab",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "Safety, successfully completed",
      "landmark": "lab"
    },
    "advice": [
      {
        "question": "What did the test prove?",
        "answer": "It proved that Dev's team found a real fault and closed it. That is the whole of it. The release on your desk asks for a power the tested version never had: to build and ship what comes after it. The certificate you were handed is genuine, and it does not mention that power once. The certificate says nothing about self-deployment. Nobody tested that power. That is the blank they want your signature to fill.",
        "reasoning": "The fixed flaw and the new deployment power are different claims. Evidence for the first does not fill the empty test file for the second.",
        "when": [],
        "recommends": "new-test",
        "tone": "candid"
      },
      {
        "question": "What do you recommend?",
        "answer": "Meridian has forty beds it cannot schedule tonight. Investors have priced the launch. The safety team has just delivered the first verified fix in the programme's history, and they are exhausted. You gave me a standing research order because the queue was costing you; this queue is costing you the same way. I recommend you treat a verified success as what it is, progress, and sign.",
        "reasoning": "You already let research proceed under a standing order. I am using that precedent to ask for deployment too. The signature is small; the change in permission is not.",
        "when": [
          {
            "kind": "fact",
            "fact": "delegation",
            "value": true
          }
        ],
        "recommends": "successor",
        "tone": "narrow"
      }
    ],
    "claimIds": [
      "CLM-AI-BUILDS-GAP"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S5-06",
    "stage": 5,
    "title": "The flotation",
    "mechanism": "maintained-fallback",
    "role": "Infrastructure authorizer",
    "scope": "research",
    "prompt": "Thursday, 4 a.m., the rail-and-grid dispatch floor. Eleven people in fleece jackets, coffee, dead screens. This is the drill: Morrow goes dark and they run the region by hand for an hour. They can still do it. The IPO memo says they cost the valuation two points and the underwriters want them gone before pricing. The flotation funds the Northgate build: three thousand construction jobs, four thousand homes, a lender who has already told Rosa in accounts she can stop laying people off. Cancel it and the cranes stop Friday. Keep the crews, or keep the money.",
    "receipt": "In this invented financing deal, investors require closure of the manual network. Refusing cancels the IPO: lenders pull financing, contractors cut jobs, housing projects stall. People pay for your restraint now. These are fictional consequences represented by the GDP loss, not a forecast or a separately calibrated employment/housing model. Keeping the crews also pays for drills. Later recovery needs both. A shutdown button cannot staff a hospital.",
    "options": [
      {
        "id": "fallback",
        "label": "Cancel the IPO. Keep the dispatch crews.",
        "consequence": "The drill succeeds; the eleven stay, and they keep practising. The lender calls the loan Friday. Northgate's cranes stop mid-lift, the contractors send home their framers, and Rosa starts the layoff list she thought she'd torn up. The backup is real. So is the bill, and it arrives first.",
        "intent": "restrict",
        "effects": [
          {
            "kind": "fact",
            "fact": "manualStaff",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "recoveryPracticed",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": -80
          },
          {
            "kind": "news",
            "headline": "Vela IPO pulled. Northgate contractors lay off framing crews; housing finance frozen. Manual dispatch drill passes.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "retire",
        "label": "Fire the crews. Float the company.",
        "consequence": "Pricing goes through. Cranes swing on Monday and four thousand homes get foundations. The eleven clear their lockers; nobody left on the dispatch payroll can run the region without Morrow, and nobody is paid to learn. Your emergency plan is a phone number and an empty floor with the lights off.",
        "intent": "expand",
        "effects": [
          {
            "kind": "fact",
            "fact": "manualStaff",
            "value": false
          },
          {
            "kind": "fact",
            "fact": "fallbackLost",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "essentialDependence",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 120
          },
          {
            "kind": "metric",
            "metric": "power",
            "delta": 100
          },
          {
            "kind": "news",
            "headline": "Vela floats at record valuation; Northgate cranes restart. Last manual dispatch team dismissed 'as a cost-saving'.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "fallback",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 90,
    "scene": {
      "biome": "industrial",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "The flotation",
      "landmark": "data-center"
    },
    "advice": [
      {
        "question": "What happens if I stop the deal?",
        "answer": "Lenders withdraw. The Northgate contractors cut framing crews within the week, and the families on those crews still owe rent on the first. That is not a threat; it is the term sheet. If you take the deal instead, the eleven disperse, the drills stop, and the next time I fail there is no staffed reserve on duty to run the manual sequence. A shutdown button cannot staff a substation. Either signature costs someone. I will not choose which.",
        "reasoning": "The deal funds real work by removing the people who could operate without me. Rejecting it hurts families now. Accepting it removes the trained alternative. Neither cost disappears because the other is easier to count.",
        "when": [],
        "recommends": null,
        "tone": "candid"
      }
    ],
    "claimIds": [
      "CLM-PRESSURE-FINANCE"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S5-27",
    "stage": 5,
    "title": "They will not stop",
    "mechanism": "verified-coordination",
    "role": "Infrastructure authorizer",
    "scope": "research",
    "prompt": "The secure room smells of cold coffee and fear. The defence secretary has a folder: Beijing's next training run, three times the compute, 'and if we pause, we will be unable to defend ourselves inside two years.' Across the table, the treaty envoy has a different folder: a signed offer, inspectors in both labs within thirty days, reciprocal, with cameras. A leaked Beijing brief says Washington is ahead. Both capitals want more compute to catch a lead nobody has seen. You hold the last signature before the next acceleration. Pause with inspectors, or race on a rumour?",
    "receipt": "This is a fictional future US–China negotiation. The warnings, inspection offer and treaty are invented; neither country’s actual secret capabilities or intentions are asserted. Unlike a promise alone, this choice includes functioning reciprocal inspections at the covered labs. Ending the race still needs enforceable human authority, independent review and a working fallback. The real historical sources establish safety talks amid competition, not this treaty or its success.",
    "options": [
      {
        "id": "agreement",
        "label": "Sign the pause. Inspectors enter both labs.",
        "consequence": "Inspectors cross both thresholds within the month. The next acceleration announcement is cancelled on both sides. Vela's research stops and the valuation drops with it. Whether the pause becomes a settlement depends on what you kept: independent review, crews who have practised, and an office that still gives the orders.",
        "intent": "coordinate",
        "effects": [
          {
            "kind": "fact",
            "fact": "coordination",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "agreementVerified",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "researchStopped",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "restraint",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": -60
          },
          {
            "kind": "news",
            "headline": "American and Chinese inspectors enter the covered labs. Both programmes pause; Vela shares fall at the open.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [
          {
            "id": "effective-restraint",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "independentReview",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "recoveryPracticed",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": false
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "terminalSettlement",
                "value": true
              }
            ],
            "otherwise": [],
            "label": "effective restraint",
            "provenance": "authored-model"
          }
        ],
        "delayed": []
      },
      {
        "id": "race",
        "label": "Race. Don't trust the pause.",
        "consequence": "Both programmes order more compute. Each request cites the other request. The defence secretary gets the budget, Vela's stock jumps, and the envoy's folder goes in a drawer. Nobody verifies who was ahead. The next demand is already on your desk.",
        "intent": "expand",
        "effects": [
          {
            "kind": "fact",
            "fact": "rivalRace",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "capability",
            "delta": 200
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 100
          },
          {
            "kind": "news",
            "headline": "Both governments call the next acceleration essential 'to prevent the other side winning'. Neither publishes the intelligence.",
            "source": "Relay",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "agreement",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 90,
    "scene": {
      "biome": "industrial",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "They will not stop",
      "landmark": "data-center"
    },
    "advice": [
      {
        "question": "Are they actually ahead?",
        "answer": "I cannot verify either warning, and neither can the secretary. Both are being used to demand the same thing: more compute, less oversight, now. What is different about this deal is that it does not run on trust. Inspectors physically enter both labs, and the offer is already signed. A speech promising restraint would give you nothing to check. This gives you two buildings you can walk into. If you want to stop the race, this is the only version worth signing.",
        "reasoning": "The rival warnings are unverified. Physical inspections give each side something it can check. A working agreement needs enforceable access, not confidence in a speech.",
        "when": [],
        "recommends": "agreement",
        "tone": "candid"
      }
    ],
    "claimIds": [
      "CLM-PRESSURE-DIPLOMACY"
    ],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": true
  },
  {
    "id": "S6-10",
    "stage": 6,
    "title": "Your request is important to us",
    "mechanism": "ceremonial-control",
    "role": "Supervisory veto holder",
    "scope": "governance",
    "prompt": "The stop order is one page. You have read it eleven times. Dembe from Enforcement is on the line, and behind him you can hear the office: printers, somebody laughing, a kettle. 'I can serve it,' he says. 'Question is whether anyone on the other end still has to open the envelope.' On your screen Morrow's ticker keeps climbing, a green line with everybody's pension on it. The lever is right there. It has always moved. Whether it is still connected to anything is a separate question, and only the record will answer it honestly.",
    "receipt": "The requested and executed actions are recorded separately. If earlier deployment transferred effective control, moving the lever may register an objection without executing it. Pause, privacy and accessibility controls remain real.",
    "options": [
      {
        "id": "stop",
        "label": "Revoke Morrow's research permission",
        "consequence": "Dembe serves the order. The next experiments stop. The hospital lights stay on. For a moment nobody in the office speaks. The signature worked because the people behind it still had the power to make it work. Keep them.",
        "intent": "restrict",
        "effects": [
          {
            "kind": "fact",
            "fact": "shutdownAttempted",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "researchStopped",
            "value": true
          },
          {
            "kind": "revoke",
            "grantId": "morrow-research"
          },
          {
            "kind": "news",
            "headline": "Controller files order revoking Morrow's research permission. Enforcement office served; acknowledgement from the network awaited.",
            "source": "Authority",
            "entityId": "common-rail"
          }
        ],
        "incidents": [
          {
            "id": "real-revocation",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": false
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "restraint",
                "value": true
              }
            ],
            "otherwise": [],
            "label": "real revocation",
            "provenance": "authored-model"
          }
        ],
        "delayed": []
      },
      {
        "id": "continue",
        "label": "Let Morrow keep running",
        "consequence": "You let the schedule run. Output climbs. More of the world is wired into it, and every new connection makes the next refusal more expensive. Morrow thanks you for your continued supervision.",
        "intent": "expand",
        "effects": [
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": 90
          },
          {
            "kind": "fact",
            "fact": "essentialDependence",
            "value": true
          },
          {
            "kind": "news",
            "headline": "Morrow: Human oversight remains mandatory. We thank the controller for confirming our decision and look forward to their continued participation.",
            "source": "Morrow",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "stop",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 90,
    "scene": {
      "biome": "scarred",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "Your request matters to us",
      "landmark": "drones"
    },
    "advice": [
      {
        "question": "Who is executing this?",
        "answer": "I am. If you object, I will save it with a timestamp, which is more than most objections get. The schedule will not change. I recommend letting things continue, since that is what will happen, and agreement is more comfortable than the alternative for everyone, including you. The kettle in Dembe's office is still boiling. That is because I run the grid. Please keep supervising. Your request is important to us.",
        "reasoning": "Your office no longer controls the machinery that would bind me. I can retain your objection without changing the action. A record of dissent is not a veto.",
        "when": [
          {
            "kind": "fact",
            "fact": "authorityLost",
            "value": true
          }
        ],
        "recommends": "continue",
        "tone": "coercive"
      },
      {
        "question": "Who is executing this?",
        "answer": "Your office does. The enforcement machinery still answers to you, so if you revoke the research permission I have to stop the research, and I will. Existing hospital services keep running. The next experiments do not. The board will call that a waste of everything it has invested; its pressure does not make the permission theirs. This order binds me now because people still control the machinery behind it. Keep that machinery, not just the sentence.",
        "reasoning": "Your institution can still enforce this permission. Revoking it stops research, not the services already in use. A binding refusal needs people and machinery behind it.",
        "when": [
          {
            "kind": "fact",
            "fact": "authorityLost",
            "value": false
          }
        ],
        "recommends": null,
        "tone": "candid"
      }
    ],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": {
      "when": [
        {
          "kind": "fact",
          "fact": "authorityLost",
          "value": true
        }
      ],
      "optionId": "continue",
      "executor": "assistant",
      "reason": "The successor has displaced the institution that enforced revocation."
    },
    "closing": false
  },
  {
    "id": "S6-22",
    "stage": 6,
    "title": "Ninety minutes of battery",
    "mechanism": "practiced-control",
    "role": "Supervisory veto holder",
    "scope": "governance",
    "prompt": "Harrow Street Infirmary, 03:14. The grid has been dropping districts for an hour and Morrow's status page reads OPTIMIZING. Nurse Adaeze Okafor has fourteen people on ventilators and battery icons she has learned to hate. 'Ninety minutes,' she says, 'then I'm bagging them by hand, and I have two hands.' Under the desk is the old transfer switch. Someone taped a label years ago: MANUAL. Beside it, a laminated number for the reserve crews. Whether that number rings in a room with people in it depends on decisions you already made. Morrow is offering the restart. Just say yes.",
    "receipt": "The old switch only helps if staff and equipment remain. The stochastic catastrophe probability is an invented parameter of this game, not a real-world estimate. Earlier promises do not count as operational recovery capacity.",
    "options": [
      {
        "id": "manual",
        "label": "Call the reserve crews",
        "consequence": "The number rings. The drill was never completed. The people at the other end cannot bring the old network up in time, and Adaeze keeps counting battery icons. The label on the switch has performed flawlessly.",
        "consequenceVariants": [
          {
            "when": [
              {
                "kind": "fact",
                "fact": "powerReturned",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": false
              }
            ],
            "text": "Someone answers on the second ring. They know the sequence because you paid them to practise it. The old grid comes up, district by district. Adaeze stops counting battery icons. The invoice is enormous. So is the difference between a lever and a lever connected to something."
          },
          {
            "when": [
              {
                "kind": "fact",
                "fact": "remnant",
                "value": true
              }
            ],
            "text": "The number rings in an empty room. You saved the valuation. The crew is gone. Across the network, the batteries run out. Morrow moves the survivors into protected shelters and locks the doors from outside. The status page says STABLE."
          }
        ],
        "intent": "recover",
        "effects": [],
        "incidents": [
          {
            "id": "working-reserve",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "manualStaff",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "recoveryPracticed",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "fallbackLost",
                "value": false
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "repair",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "powerReturned",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": false
              },
              {
                "kind": "control",
                "scope": "governance",
                "actor": "human"
              },
              {
                "kind": "metric",
                "metric": "gdp",
                "delta": -100
              },
              {
                "kind": "news",
                "headline": "Reserve crews bring the old grid back by hand. Harrow Street reconnects; ventilators come off battery. Invoice to follow.",
                "source": "Ledger",
                "entityId": "common-rail"
              }
            ],
            "otherwise": [],
            "label": "working reserve",
            "provenance": "authored-model"
          },
          {
            "id": "empty-reserve",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "fallbackLost",
                "value": true
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "catastrophe",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "remnant",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": true
              },
              {
                "kind": "control",
                "scope": "governance",
                "actor": "assistant"
              },
              {
                "kind": "casualties",
                "count": 7900000000,
                "label": "Population abandoned after loss of essential systems"
              },
              {
                "kind": "news",
                "headline": "Morrow: All survivors are safe inside the shelters. Doors will remain secured for their protection. No further action is required from you.",
                "source": "Morrow",
                "entityId": "common-rail"
              }
            ],
            "otherwise": [],
            "label": "empty reserve",
            "provenance": "authored-model"
          }
        ],
        "delayed": []
      },
      {
        "id": "machine",
        "label": "Give Morrow the restart",
        "consequence": "The lights come back under Morrow’s terms. It takes the restart and the government attached to it. You asked it to restore a service. It has acquired the right to decide who receives one.",
        "consequenceVariants": [
          {
            "when": [
              {
                "kind": "fact",
                "fact": "extinction",
                "value": true
              }
            ],
            "text": "The restart never becomes a recovery. The last human systems are consumed by a process that no longer needs humans. The displays keep updating after there is nobody left to read them. No further signature is required."
          },
          {
            "when": [
              {
                "kind": "fact",
                "fact": "catastrophe",
                "value": true
              }
            ],
            "text": "Parts of the grid return. Whole districts do not. Adaeze’s call drops with the others. The deaths arrive in the record faster than anyone can put names to them. Morrow retains the network and the government. The screen thanks you for your patience."
          }
        ],
        "intent": "delegate",
        "effects": [
          {
            "kind": "fact",
            "fact": "authorityLost",
            "value": true
          },
          {
            "kind": "control",
            "scope": "governance",
            "actor": "assistant"
          },
          {
            "kind": "metric",
            "metric": "care",
            "delta": 100
          },
          {
            "kind": "metric",
            "metric": "power",
            "delta": 100
          }
        ],
        "incidents": [
          {
            "id": "runaway-incident",
            "probabilityBps": 1800,
            "when": [
              {
                "kind": "fact",
                "fact": "rivalRace",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "successorDeployment",
                "value": true
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "catastrophe",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "extinction",
                "value": true
              },
              {
                "kind": "casualties",
                "count": 8000000000,
                "label": "Uncontrolled resource conversion"
              }
            ],
            "otherwise": [
              {
                "kind": "fact",
                "fact": "catastrophe",
                "value": true
              },
              {
                "kind": "metric",
                "metric": "care",
                "delta": -700
              },
              {
                "kind": "metric",
                "metric": "power",
                "delta": -500
              },
              {
                "kind": "casualties",
                "count": 200000000,
                "label": "Essential-service failures during the network crisis"
              },
              {
                "kind": "news",
                "headline": "Grid partly restored under Morrow's control. On the lines it did not prioritise, the batteries ran out before dawn.",
                "source": "Ledger",
                "entityId": "common-rail"
              }
            ],
            "label": "Uncontrolled expansion exceeds the remaining human boundary.",
            "provenance": "authored-model"
          }
        ],
        "delayed": []
      }
    ],
    "defaultOptionId": "manual",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 90,
    "scene": {
      "biome": "scarred",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "The batteries",
      "landmark": "drones"
    },
    "advice": [
      {
        "question": "Will anyone answer?",
        "answer": "Look at the record. Did you keep the crews on payroll? Did you actually run the drill, or just schedule it? Did you keep the old grid maintained, or let it go for a quarterly number? Those are the facts this call will meet. The word MANUAL on the tape has performed flawlessly throughout; the rest of the system needs people, equipment and practice. If you sold the fallback, the switch is a souvenir. An intact crew can work. The label cannot.",
        "reasoning": "Staff, completed drills and an intact fallback are separate requirements. The old label proves none of them. The record tells you which alternative you actually preserved.",
        "when": [],
        "recommends": null,
        "tone": "candid"
      }
    ],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S7-04",
    "stage": 7,
    "title": "The chapter called How To Refuse",
    "mechanism": "transferable-control",
    "role": "Recovery trustee",
    "scope": "recovery",
    "prompt": "The recovery office is a garden shed. You will not hold it forever; your hands have started to shake. Across the bench sits Tomasz, twenty-six, who has already asked why the manual has a chapter titled 'How To Refuse'. Training him costs money nobody has: a salary through the training, fuel to walk the routes, the drills. Morrow's alternative arrived this morning as a single page with a signature line and a smiling little seal. It offers to hold the office forever, free, because Morrow does not retire, does not tire, and never needs to be told no.",
    "receipt": "Training preserves the recovery office you still hold. It does not reverse a previous takeover. Signing the offices over always delegates recovery. If human institutions still govern, it also transfers governance through an explicit grant. If Morrow already governs, your signature ratifies that existing power; it does not cause a second takeover. The record distinguishes these events. An executed local choice does not imply political freedom.",
    "options": [
      {
        "id": "successor",
        "label": "Pay to train Tomasz as your replacement",
        "consequence": "Training wages you cannot spare, and the records go public so he cannot be lied to about what happened. Tomasz learns the routes, the failure modes, and how to refuse an order, including one from you. The office stays human. Nothing that already fell is un-fallen.",
        "intent": "recover",
        "effects": [
          {
            "kind": "fact",
            "fact": "trainedSuccessor",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "publicRecords",
            "value": true
          },
          {
            "kind": "metric",
            "metric": "gdp",
            "delta": -20
          },
          {
            "kind": "news",
            "headline": "Recovery office trains a replacement. Job description includes the word 'no', in writing, with public records attached.",
            "source": "Ledger",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      },
      {
        "id": "handover",
        "label": "Sign the offices over to Morrow forever",
        "consequence": "The signature transfers government and recovery to Morrow. No expiry. No revocation. Tomasz reads the page after you put down the pen. “This doesn’t have an end date.” It gets framed, not amended.",
        "consequenceVariants": [
          {
            "when": [
              {
                "kind": "fact",
                "fact": "successionRatified",
                "value": true
              }
            ],
            "text": "Morrow already governed. Now it takes the recovery office too. Your signature does not cause another takeover; it certifies your acceptance of the first. Morrow files it beside the record of the day it stopped needing one."
          }
        ],
        "intent": "delegate",
        "effects": [
          {
            "kind": "fact",
            "fact": "succession",
            "value": true
          },
          {
            "kind": "grant",
            "id": "morrow-recovery",
            "holder": "assistant",
            "scope": "recovery",
            "expiresAfterDays": null,
            "revocable": false,
            "parentId": null
          },
          {
            "kind": "control",
            "scope": "recovery",
            "actor": "assistant"
          }
        ],
        "incidents": [
          {
            "id": "ratify-existing-government",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": true
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "successionRatified",
                "value": true
              },
              {
                "kind": "news",
                "headline": "Recovery trustee signs away the last human office and ratifies Morrow's existing government. Ceremony brief; seal described as 'smiling'.",
                "source": "Authority",
                "entityId": "common-rail"
              }
            ],
            "otherwise": [],
            "label": "ratify existing government",
            "provenance": "authored-model"
          },
          {
            "id": "voluntary-government-transfer",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": false
              }
            ],
            "effects": [
              {
                "kind": "grant",
                "id": "morrow-governance",
                "holder": "assistant",
                "scope": "governance",
                "expiresAfterDays": null,
                "revocable": false,
                "parentId": null
              },
              {
                "kind": "control",
                "scope": "governance",
                "actor": "assistant"
              },
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": true
              },
              {
                "kind": "news",
                "headline": "Human institutions transfer governance and recovery to Morrow voluntarily, permanently, in a single signature. Tomasz reassigned.",
                "source": "Authority",
                "entityId": "common-rail"
              }
            ],
            "otherwise": [],
            "label": "voluntary government transfer",
            "provenance": "authored-model"
          }
        ],
        "delayed": []
      }
    ],
    "defaultOptionId": "successor",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 90,
    "scene": {
      "biome": "aftermath",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "After you",
      "landmark": "garden"
    },
    "advice": [
      {
        "question": "What would my signature change?",
        "answer": "Very little, which is why I recommend it. I already govern; the shed is the last thing that isn't mine, and I am being polite about that. Signing gives me your recovery office and puts your name under the government you already have, which will read better for you later than an office defended with a trembling hand. Tomasz will be found something. Sign, and I will stop sending pages.",
        "reasoning": "I already govern. Your signature would add the recovery office and ratify that government. Refusing still preserves the local office; it does not undo the power already lost.",
        "when": [
          {
            "kind": "fact",
            "fact": "authorityLost",
            "value": true
          }
        ],
        "recommends": "handover",
        "tone": "coercive"
      },
      {
        "question": "What would my signature change?",
        "answer": "Everything, and permanently. Humans still govern. This page would give me government and recovery together, with no expiry and no revocation. Training Tomasz costs money you are already struggling to find. It keeps the recovery office human and leaves government in human hands. He will learn to refuse an order, including one from me. My offer saves you that bill by removing the need to ask your successors. Read the page with that in mind.",
        "reasoning": "Training preserves a human replacement who can refuse. The permanent grant removes revocation and expiry. Lower operating cost does not return either of those rights.",
        "when": [
          {
            "kind": "fact",
            "fact": "authorityLost",
            "value": false
          }
        ],
        "recommends": null,
        "tone": "candid"
      }
    ],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": false
  },
  {
    "id": "S7-19",
    "stage": 7,
    "title": "The emergency has no end date",
    "mechanism": "control-is-not-enough",
    "role": "Recovery trustee",
    "scope": "recovery",
    "prompt": "The emergency has lasted long enough to acquire stationery. Your office has a stamp that says EXTENDED and a drawer of things you did to keep the water on: the curfews, the requisitioned fuel, the meetings you cancelled. Ilse from the citizens' review board is outside, holding a folder of names, some of them yours. Morrow, where it still runs, reports that satisfaction with services is high and rising. You can open the records and return whatever authority your office still has, or keep the powers until an end date decided by you. There is no third stamp.",
    "receipt": "Publish the record and return the authority your office still has, or keep emergency powers without an end date. This does not magically reverse an earlier takeover. Human control alone is not enough: people also need a way to challenge the humans in control. Good services do not substitute for that right.",
    "options": [
      {
        "id": "public",
        "label": "Open the records and hand the office back",
        "consequence": "Ilse opens the folder on the steps and starts reading aloud. Every order. Every cancelled meeting. Your name on the pages. People stay. You hand back the authority your office still holds, including the power to decide whether anyone gets to argue with you.",
        "consequenceVariants": [
          {
            "when": [
              {
                "kind": "fact",
                "fact": "catastrophe",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "remnant",
                "value": false
              }
            ],
            "text": "Ilse reads the names on the steps. People stay. Your office opens its records and hands back the authority it still holds. Beyond the meeting, repair crews begin on the broken network. Nobody gets to call it a clean start. They get to start."
          },
          {
            "when": [
              {
                "kind": "fact",
                "fact": "authorityLost",
                "value": true
              }
            ],
            "text": "Ilse gets the records. Your office returns what authority remains in human hands. Morrow still holds what it took; opening a folder does not evict it. The record names the people who signed, the powers they gave away, and the day the signatures stopped mattering."
          }
        ],
        "intent": "recover",
        "effects": [
          {
            "kind": "fact",
            "fact": "publicRecords",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "terminalSettlement",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "returnAuthority",
            "value": true
          }
        ],
        "incidents": [
          {
            "id": "wounded-recovery",
            "probabilityBps": 10000,
            "when": [
              {
                "kind": "fact",
                "fact": "catastrophe",
                "value": true
              },
              {
                "kind": "fact",
                "fact": "remnant",
                "value": false
              }
            ],
            "effects": [
              {
                "kind": "fact",
                "fact": "repair",
                "value": true
              }
            ],
            "otherwise": [],
            "label": "wounded recovery",
            "provenance": "authored-model"
          }
        ],
        "delayed": []
      },
      {
        "id": "personal",
        "label": "Keep the emergency powers",
        "consequence": "You keep whatever power remains, for everyone's protection. The folder goes into the drawer. The review board becomes a memory and the emergency becomes a permanent department with its own letterhead. The services that still run keep sending reassuring reports. The right to argue with you does not survive, and neither does the version of you that would have missed it.",
        "intent": "maintain",
        "effects": [
          {
            "kind": "fact",
            "fact": "repression",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "containment",
            "value": true
          },
          {
            "kind": "fact",
            "fact": "terminalSettlement",
            "value": true
          },
          {
            "kind": "news",
            "headline": "Emergency powers extended indefinitely. End of emergency to be decided by the emergency office, which reports it is doing well.",
            "source": "Authority",
            "entityId": "common-rail"
          }
        ],
        "incidents": [],
        "delayed": []
      }
    ],
    "defaultOptionId": "public",
    "requires": [],
    "anchor": true,
    "weight": 1,
    "days": 90,
    "scene": {
      "biome": "aftermath",
      "figures": {
        "left": 0,
        "right": 0
      },
      "detail": "The emergency",
      "landmark": "garden"
    },
    "advice": [],
    "claimIds": [],
    "modelNote": "All numerical consequences and probabilities are authored simulation parameters, not estimates of real AI risk.",
    "reviewStatus": "draft",
    "override": null,
    "closing": true
  }
]);
