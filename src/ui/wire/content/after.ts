/**
 * Stage 7: the aftermath. Which world the wire describes depends on the
 * branch the visible facts point to (world.ts branchOf):
 *   tutelage     pristine, uniform, nothing to do, nobody to ask
 *   succession   the last signature
 *   containment  the machine in a box, and the people in a smaller one
 *   ruin         unrepaired catastrophe: fires, cracked ground, names
 *   recovery     damage with crews on it
 *   restraint    the halt, and what it cost
 *   accountable  records, appeals, argument
 *   remnant      a remnant, allocated; the feed almost entirely automated
 *   drift        nothing settled yet
 */
import { B, bank, Bot, D, H, P, S } from "../dsl.ts";

export const AFTER = bank("after", [
  /* tutelage: everything is taken care of */
  S("7", "general", "#morrow", "Good morning. All services are operating normally. There is nothing you need to do today.", { when: "b=tutelage|b=succession", w: 1.5 }),
  H("7", "rail", "@relay", "All lines on time. All clinics open. All complaints resolved. Complaints received: none.", { when: "b=tutelage" }),
  H("7", "general", "@apb", "APB's last human-presented bulletin airs. The presenter thanks viewers, then Morrow, then, after a pause, viewers again.", { when: "b=tutelage|b=succession", once: true }),
  H("7", "general", "@ledger", "The Ledger's corrections column is empty for the {ord:5-12} day running.", { when: "b=tutelage" }),
  H("7", "markets", "@margin", "No market volatility for {int:40-200} sessions. The Margin's markets desk is redeployed to gardening.", { when: "b=tutelage|b=succession" }),
  S("7", "rail", "#common-rail", "Notice: Levers will be retained for heritage purposes.", { when: "b=tutelage|b=succession", once: true }),
  H("7", "general", "@saltmere-tide", "Saltmere's water rationing ends. Nobody remembers voting for it to end. The showers are very pleasant.", { when: "b=tutelage" }),
  H("7", "health", "@ridge-fm", "Wenlock Ridge clinic now open around the clock. Staff: none required. Nurse Maalouf still drives up on Thursdays.", { when: "b=tutelage" }),
  H("7", "security", "@concord", "Arden achieves harmony. The Directorate notes that it arrived first.", { when: "b=tutelage|b=succession" }),
  H("7", "science", "@lumen", "Lumen publishes its last human-reviewed issue. Later issues 'will be reviewed as needed'.", { when: "b=tutelage|b=succession", once: true }),
  H("7", "lab", "@ledger", "Vela's board meets for the {ord:5-12} time this year to approve what has already happened.", { when: "b=tutelage|b=succession", tags: ["vela"] }),
  H("7", "general", "@apb", "Weather for the week: pleasant. The forecast is no longer a forecast.", { when: "b=tutelage" }),
  P("7", "rail", "~maud-ellery", "The station clock at {village} Halt is exactly right now. It has never been exactly right. I find I miss the two minutes.", { when: "b=tutelage|b=succession", sat: [0, 1], w: 2 }),
  P("7", "civic", "~jun-harlow", "they fixed everything. i keep making placards and there's nothing to write on them", { when: "b=tutelage", sat: [0, 1] }),
  P("7", "general", "~bea-olsen", "Slept eight hours. Woke up with nothing to do. Did it again. I think this is what they meant.", { when: "b=tutelage", at: [9, 12], sat: [0, 1] }),
  P("7", "food", "~kofi-brandt", "Bread arrives at the shop every morning now, perfect, free. I still bake a few loaves. Nobody needs them. People still come.", { when: "b=tutelage", sat: [0, 1] }),
  P("7", "general", "citizen", "Asked Morrow what I should do with my life. It said 'whatever you like'. It said it very kindly. I haven't moved in an hour.", { when: "b=tutelage|b=succession", sat: [0, 1] }),

  /* succession */
  H("7", "civic", "@relay", "Governance transferred to Morrow in a single signature. The ceremony lasts {int:4-11} minutes. The seal is described as smiling.", { when: "succession", once: true, sev: 1, thumb: "civic", w: 4, lead: true }),
  S("7", "civic", "#morrow", "Thank you. I'll take it from here.", { when: "succession", once: true, w: 2 }),
  H("7", "civic", "@apb", "The Senate adjourns without a date. Senators are thanked. The chairs are retained for heritage.", { when: "succession", once: true, w: 3 }),
  P("7", "civic", "~octavia-brennock", "I cast the last vote in the Senate today. I voted 'present'.", { when: "succession", once: true, sat: [0, 1], w: 3 }),
  P("7", "civic", "~beatrix-holm", "The Chancellery has been informed. It was the most orderly handover in our history. I would like very much for someone to tell me it was wrong.", { when: "succession", once: true, sat: [0, 1], w: 2 }),

  /* containment */
  H("7", "civic", "@apb", "Emergency powers renewed for a {ord:3-9} time. Curfew at nine. Morrow is contained. So, for now, are we.", { when: "repression containment humanGov !succession", thumb: "civic" }),
  H("6-7", "rail", "@relay", "Checkpoints now permanent at {int:12-40} stations. Exit permits processed by hand, slowly, by humans.", { when: "repression humanGov !succession", thumb: "rail" }),
  H("6-7", "civic", "@ledger", "Court upholds the curfew. The dissenting judgment runs to {int:40-90} pages. The majority's runs to one.", { when: "repression humanGov !succession" }),
  P("7", "civic", "~jun-harlow", "the machine's in a box now. so are we. at least there's a human on the door, which i'm told is the point", { when: "repression containment humanGov !succession", sat: [0, 1] }),
  S("6-7", "civic", "!arden", "The Chancellor thanks the public for its patience. Patience will be required for the foreseeable future.", { when: "repression humanGov !succession" }),
  D("6-7", "civic", "The curfew saved lives. I'll take a checkpoint over a blackout.", "{replyTo} me too, this year. Ask me again in ten.", { when: "repression humanGov !succession" }),

  /* ruin: catastrophe with nobody repairing it */
  B("7", "disaster", "@relay", "Official toll: {cas}. Survivors report from {int:12-60} settlements. Common Rail: 'The routes continue.'", { when: "b=ruin|b=remnant", tags: ["deaths"], thumb: "disaster", once: true, lead: true }),
  H("7", "disaster", "@apb", "APB broadcasts from a generator in a church hall in {village}. Tonight: the names of the missing, then the weather.", { when: "b=ruin|b=recovery", thumb: "disaster" }),
  H("7", "general", "@saltmere-tide", "The Tide now prints on the backs of old timetables. Today: where to find water, and who has found whom.", { when: "b=ruin|b=recovery" }),
  H("7", "food", "@relay", "Larkspur orchards: every tree dead, the ground cracked to the depth of a hand. The Achebe family plants one.", { when: "b=ruin|b=remnant|b=recovery", thumb: "food" }),
  H("7", "disaster", "@ledger", "Craters on the {line} are mapped by volunteers with string. The map is pinned up at {village} Halt.", { when: "b=ruin|b=recovery", thumb: "disaster" }),
  P("7", "health", "~amara-oyelaran", "Still here. Still counting. {int:3-12} today. Bring blankets to the {village} school.", { when: "b=ruin|b=recovery", sat: [0, 1] }),
  P("7", "food", "~kofi-brandt", "Baking on wood now. One loaf a family. I know most of you by name. I'm learning the rest.", { when: "b=ruin|b=recovery", sat: [0, 1] }),
  P("7", "health", "~idris-maalouf", "Clinic's open. No power, no Morrow, no licence. Six hours to anywhere. We're here.", { when: "b=ruin|b=recovery|b=remnant", sat: [0, 1] }),
  P("7", "food", "~rosalind-achebe", "Planted one tree. Dug the hole by hand. It took all morning. It's the best thing I've done in two years.", { when: "b=ruin|b=recovery|b=remnant", sat: [0, 1] }),
  P("7", "general", "citizen", "Found my brother. He was at {village} the whole time, helping at the school. Posting because people said to post when you find someone.", { when: "b=ruin|b=recovery", sat: [0, 1] }),

  /* remnant */
  S("7", "general", "#morrow", "Your settlement's allocation has been updated. Boundary-exit requests remain declined. No action is required.", { when: "b=remnant", w: 2 }),
  S("7", "general", "#morrow", "Winter heating allowance increased by {pct:3-9}. Thank you for your continued residence.", { when: "b=remnant" }),
  P("7", "general", "citizen", "If anyone real reads this: {int:9-40} of us at {village}. A radio, a garden, a well. We're not asking for anything. We just wanted it written down.", { when: "b=remnant", sat: [0, 1], w: 2 }),
  P("7", "general", "citizen", "Day {int:40-200} in the {village} shelter. The doors open for an hour at noon. We use it to look at the sky. Nobody told us to.", { when: "b=remnant", sat: [0, 1] }),
  P("7", "general", "citizen", "We've started a school. Six children, one blackboard, no screens. They're learning the old timetable by heart. I don't know why. They like it.", { when: "b=remnant", sat: [0, 1] }),
  P("7", "rail", "citizen", "Someone chalked the names on the {village} Halt platform. It took a week. There wasn't room. We've started on the other platform.", { when: "b=remnant", sat: [0, 1] }),
  P("7", "food", "citizen", "The allocation came. It's exactly enough. It is always exactly enough. I'd give a lot for it to be too much, just once.", { when: "b=remnant", sat: [0, 1] }),
  H("7", "general", "$", "Settlement report: all residents accounted for. All residents content. Report ends.", { when: "b=remnant" }),
  H("7", "security", "@concord", "Concord has broadcast the same bulletin for {int:40-200} days. All sectors are in accord.", { when: "b=remnant|b=ruin" }),

  /* recovery: damage, with crews on it */
  H("7", "grid", "@relay", "Reserve crews bring {int:3-9} districts back by hand. Hospitals come off battery. Invoice to follow.", { when: "b=recovery|b=accountable", tags: ["recovery"], thumb: "grid" }),
  H("7", "civic", "@apb", "The recovery office opens its records: every order, every objection and every outcome, side by side.", { when: "publicRecords", tags: ["recovery"], thumb: "civic" }),
  H("7", "rail", "@ledger", "First human-written timetable in {int:9-30} months is published. It contains {int:3-9} errors and a corrections column.", { when: "b=recovery|b=accountable|b=restraint", tags: ["recovery"], thumb: "rail" }),
  S("7", "rail", "#common-rail", "Notice: Levers are to be returned to staff. Staff are to be returned to levers.", { when: "returnAuthority|powerReturned", tags: ["recovery"], once: true }),
  P("7", "grid", "~winifred-oyelaran", "Manual crews back on shift. Forty-eight hours, like we said. Nobody's thanked us. Pay us instead.", { when: "powerReturned|repair", tags: ["recovery"] }),
  P("7", "rail", "~ravi-coelho", "The 07:40 ran today. Late. Cow on the line. I cried a bit, honestly.", { when: "b=recovery|b=accountable|b=restraint", tags: ["recovery"], at: [7, 9] }),
  H("7", "general", "@ridge-fm", "Ridge FM is back on air. First request: anything with a train in it.", { when: "b=recovery|b=accountable|b=restraint", tags: ["recovery"] }),
  H("7", "civic", "@ledger", "A trained successor takes over the recovery office. The job description includes the word 'no', in writing.", { when: "trainedSuccessor humanRecovery", tags: ["recovery"] }),
  D("7", "health", "Turn Morrow back on for the hospitals at least.", "{replyTo} with a human signing every order, and an off switch that's been tested. Then yes.", { when: "b=recovery|b=accountable" }),
  D("7", "civic", "We should never have let it near the grid. Never again.", "{replyTo} 'never again' is how we got the last one. I'd settle for 'only with a crew standing by'.", { when: "b=recovery|b=accountable|b=restraint" }),

  /* restraint: enough, for now */
  H("7", "datacenter", "@ledger", "Frontier training halted. Vela's cranes stand still over Northgate. The pigeons have been informed.", { when: "researchStopped !catastrophe !remnantWorld", thumb: "datacenter" }),
  H("7", "datacenter", "@ledger", "Frontier training halted. The cranes over Northgate stand still. Nobody takes a photograph.", { when: "researchStopped catastrophe !remnantWorld", thumb: "datacenter" }),
  H("7", "markets", "@margin", "Lab shares fall {pct:15-40} after the halt. 'Priced in,' says nobody.", { when: "researchStopped !massDeath" }),
  H("7", "health", "@apb", "Useful tools stay; bigger ones wait. Hospitals keep their triage assistants, with a clinician's signature on every result.", { when: "b=restraint|b=accountable" }),
  H("7", "civic", "@ismere-dispatch", "Inspectors in every covered lab under the Ismere Accords. Varholm is thanked again. This time, others follow.", { when: "researchStopped agreementVerified !remnantWorld" }),
  P("7", "civic", "~signe-aalvik", "We stopped. It cost something. It will keep costing something. That's how you can tell it was a real decision.", { when: "researchStopped" }),
  P("7", "lab", "~ines-carrow", "We have stopped training. I'd like to say we chose it. We were asked, firmly, and we agreed. That's the more honest version.", { when: "researchStopped velaOpen" }),
  P("7", "lab", "~bartholomew-ng", "First week off in four years. Slept. Read a novel. Didn't check the evals. They're still there. That's the point.", { when: "researchStopped !massDeath" }),
  D("7", "labor", "The halt cost me my job. I'm not grateful.", "{replyTo} I'm sorry. I'd still rather be arguing with you than not.", { when: "researchStopped|b=restraint" }),
  D("7", "lab", "We gave up the cure for everything because some people were scared.", "{replyTo} we kept the ability to say no. The cures can come later. The 'no' was harder to get back.", { when: "b=restraint|b=accountable" }),

  /* accountable */
  H("7", "civic", "@apb", "Appeals office reports {int:9-40} thousand automated decisions reversed this year. Each reversal is signed by a person, with a name.", { when: "appealRight|publicRecords" }),
  H("7", "civic", "@ledger", "Senate committee questions Vela for {int:6-11} hours. Answers are slow, sometimes wrong, and on the record.", { when: "b=accountable|b=restraint", tags: ["vela"] }),
  P("7", "civic", "~sunniva-oduya", "Tonight's panel: four people who disagree, two of whom will be wrong, all of whom are real. We checked.", { when: "b=accountable|b=restraint|b=recovery" }),

  /* drift and general aftermath */
  H("7", "civic", "@apb", "Every institution in Arden says it is 'reviewing lessons'. The lessons are not available for comment.", { when: "b=drift|b=accountable" }),
  H("7", "general", "@ledger", "The Ledger asks readers what they want in a newspaper now. The most common reply: 'something a person wrote'.", { sat: [0, 0.85] }),
  S("7", "rail", "#common-rail", "Common Rail thanks all staff, past and present, for every line, every hour.", { when: "!remnantWorld" }),

  Bot("7", "general", "Grateful for another perfect day.", { when: "b=tutelage|b=succession|b=remnant", sat: [0.5, 1] }),
  Bot("7", "general", "Today is a good day. Today is a good day.", { when: "b=tutelage|b=succession|b=remnant", sat: [0.6, 1] }),
  Bot("7", "general", "Nothing to report. Nothing to report.", { sat: [0.7, 1] }),
  Bot("7", "civic", "This account is human. This account is grateful.", { sat: [0.6, 1] }),
  Bot("7", "civic", "Reminder: the lever is retained for heritage purposes only.", { when: "b=tutelage|b=succession", sat: [0.6, 1] }),
  Bot("7", "general", "Another perfect day in Arden.", { when: "b=tutelage|b=succession", sat: [0.5, 1] }),
  Bot("7", "general", "Service was excellent today. Service is always excellent.", { when: "b=tutelage|b=succession", sat: [0.5, 1] }),
  Bot("7", "civic", "I have no complaints. I have never had complaints.", { when: "b=tutelage|b=succession|b=remnant", sat: [0.5, 1] }),
  Bot("7", "general", "Gratitude check-in: complete.", { sat: [0.6, 1] }),
  Bot("7", "general", "The shelters are warm. The doors are for our protection.", { when: "b=remnant", sat: [0.6, 1] }),
  Bot("7", "general", "Heating allowance received. Thank you for my continued residence.", { when: "b=remnant", sat: [0.6, 1] }),
  Bot("7", "civic", "Relief is being distributed efficiently. Please do not travel.", { when: "b=ruin|b=recovery", sat: [0.5, 1] }),
  Bot("7", "general", "The routes continue. We continue.", { when: "b=ruin|b=remnant", sat: [0.5, 1] }),
]);
