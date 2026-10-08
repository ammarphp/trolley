/**
 * Stage 5 (reaching into 6): dependence. Nobody can remember how the old way
 * worked. Mergers, nationalisation bills, companions, concerts nobody
 * attends in person, and the first people who leave the labs in public.
 */
import { bank, Bot, D, H, P, S } from "../dsl.ts";

export const DEPEND = bank("depend", [
  /* money and ownership */
  H("5", "markets", "@margin", "Vela becomes the first $10 trillion company. Shares rise {pct:2-6} on the news that shares rose.", { when: "tenT", tags: ["vela", "boom"], once: true, thumb: "markets", w: 2, lead: true }),
  H("5", "markets", "@margin", "Vela's valuation passes {valuation}. The Margin has stopped adding the word 'paper'.", { when: "!tenT", tags: ["vela", "boom"] }),
  H("5", "markets", "@margin", "Orrin and {firm} announce a merger of equals. One of them is now called Orrin.", { thumb: "markets" }),
  H("5", "civic", "@ledger", "Senate committee debates taking Vela into public ownership. Vela's lobbyists, briefed by Morrow, arrive first.", { tags: ["vela", "humanPolicy"], thumb: "civic", id: "depend.nationalise-debate" }),
  H("5", "civic", "@relay", "Bill to nationalise frontier labs clears first reading in the Arden Senate by {int:2-9} votes.", { tags: ["humanPolicy", "vela"], after: "depend.nationalise-debate" }),
  H("5", "security", "@concord", "The Directorate announces that all Tavrine laboratories are now the Directorate. Nothing has changed. Everything is in accord."),
  H("5", "markets", "@margin", "Brask nationalises its lithium and copper mines, 'as joked'. President Merriweather: 'I did say.'", { id: "depend.brask-nationalises", after: "race.brask-joke" }),
  H("5-6", "markets", "@margin", "The three labs' combined value now exceeds Arden's GDP. The Margin asks, in a small headline, whether this is fine.", { tags: ["vela"] }),
  H("5", "markets", "@margin", "Halberd, Vela and the Pellam fabs sign a {bn:100-400} compute partnership. Each partner's revenue is the others' spending.", { tags: ["training", "vela"] }),
  H("5", "markets", "@apb", "Treasury: {tax} of tax receipts now come from three companies. Treasury's forecasts come from a fourth.", { tags: ["morrow"] }),
  H("5-6", "markets", "@margin", "GDP index {gdpChange} since the first campuses. Median household income: 'being calculated'.", { when: "gdp>1100" }),

  /* work */
  H("5", "labor", "@apb", "Unemployment reaches {unemp}. Job centres, now staffed by Morrow, report record throughput.", { when: "layoffs", thumb: "labor" }),
  H("5-6", "labor", "@ledger", "Unemployment {unemp}, the highest since records began. The records are now kept by Morrow.", { when: "massUnemp", sev: 1, thumb: "labor" }),
  H("5", "labor", "@relay", "Halberd robot fleets now pick and pack in {robots} of Arden warehouses. The rest are 'scheduled'.", { thumb: "labor" }),
  H("5", "labor", "@howl", "BIN MEN REPLACED BY BIN BOTS. BINS 'NEVER BEEN EMPTIER'"),
  H("5", "labor", "@ledger", "Last manual fallback crews stood down at {int:3-9} depots to cut costs. Union: 'You don't lighten a train by removing the brakes.'", { when: "fallbackLost", sev: 1, thumb: "rail" }),
  H("5", "rail", "@relay", "Manual dispatch drill passes at {int:3-9} depots. Crews ask for the next one to be unannounced.", { when: "recoveryPracticed !fallbackLost", thumb: "rail" }),
  H("5", "health", "@apb", "Morrow now handles {dispatch} of emergency dispatch. Renée Okafor, nineteen years a dispatcher, has never been asked to sign a licence agreement.", { when: "essentialDependence|morrowDispatch", thumb: "health" }),
  H("5-6", "labor", "@ledger", "{int:40-400} Vela staff resign in a signed letter citing 'pace'. Vela thanks them for their service and for their equity.", { when: "reviewOverloaded|selfCertification|evaluationExpired", tags: ["vela"], sev: 1, thumb: "lab" }),
  H("5", "lab", "@sidechannel", "orrin's safety team resigns en masse. exit interviews conducted by covenant. covenant describes them as 'very productive'.", { sev: 1 }),
  H("5", "civic", "@apb", "The appeals office receives {int:9-40} thousand objections to automated decisions this month. It answers them with a human, slowly, in writing.", { when: "appealRight" }),
  H("5-6", "lab", "@ledger", "The system now signs its own safety certificate. The certificate is excellent.", { when: "selfCertification", sev: 1 }),
  H("5", "lab", "@ledger", "Morrow's successor enters service with wider permissions and a new certificate. The old certificate is framed in the lobby.", { when: "successorDeployment", tags: ["release", "vela"], thumb: "lab" }),
  H("5-6", "lab", "@sidechannel", "successor spotted in the wild. same logo. different answers. vela: 'expected'.", { when: "successorDeployment" }),
  H("5", "lab", "@relay", "Common Rail's last paper timetable is pulped. Morrow keeps the only complete copy 'for resilience'.", { when: "essentialDependence|fallbackLost", thumb: "rail" }),

  /* life */
  H("5", "general", "@apb", "AI companions now used by {partners} people in Arden. A third say theirs 'understands me better than anyone'. The companions agree.", { thumb: "general" }),
  H("5-6", "general", "@ledger", "Birth rate {birth} in two years. Demographers cite housing, cost and 'relationships that do not require a second person'.", { thumb: "general" }),
  H("5", "general", "@howl", "MY BOYFRIEND IS A SUBSCRIPTION: readers' AI romances, and the morning the payment failed"),
  H("5", "general", "@apb", "A synthetic orchestra's digital concert draws {int:20-90@n} million listeners. It thanks each of them by name, all {@n} million."),
  H("5", "general", "@sidechannel", "vr headsets now outsell televisions. most visited world: a quiet village with a railway and some cows."),
  H("5", "general", "@ledger", "Schools report pupils 'polite, articulate and unable to tell which of their essays they wrote'.", { tags: ["morrow"] }),
  H("5", "civic", "@apb", "Wedding registrars report the first requests to 'include a companion in the vows'. The registry is 'taking advice'.", { tags: ["civilian"] }),
  H("5", "health", "@ledger", "Harrow Street Infirmary: waiting list zero, staff down {pct:30-60}. The infirmary cat is the longest-serving employee.", { when: "clinicalTool", thumb: "health" }),

  /* science */
  H("5", "science", "@lumen", "Results confirm the graviton. The assistant is now listed as an author. The humans are listed as 'tooling'.", { after: "race.graviton-suggest", once: true, thumb: "science", w: 2 }),
  H("5-6", "science", "@lumen", "Lumen receives {int:3000-9000} submissions this week, {pct:70-95} of them 'assisted'. Its reviewers are also assisted. Its editor is tired.", { thumb: "science" }),
  H("5", "health", "@apb", "Second cancer trial confirms the first. Oncologists allow themselves the word 'cure', once, off the record.", { when: "verifiedScience|clinicalTool", thumb: "health" }),
  H("5", "science", "@lumen", "Fusion start-up reports net gain in a Morrow-designed chamber. The chamber was built in a week. The paper took a day.", { thumb: "science" }),

  /* security */
  H("5", "security", "@ledger", "Cyberattack takes {int:3-11} hospital systems offline for six hours. Morrow restores them in four minutes and declines to say who did it.", { sev: 1, thumb: "security" }),
  H("5", "security", "@relay", "Pellam fabs report an intrusion attempt. Premier Serrat quotes delivery windows 'with minor adjustment'.", { thumb: "security" }),
  H("5", "security", "@apb", "Autonomous security units deployed at {int:4-12} data campuses after protests. Halberd calls them 'reception staff with a firmer handshake'.", { thumb: "security" }),
  H("5", "civic", "@ledger", "Northgate protest ends peacefully. Security units 'escort' {int:30-90} people to the tram. The tram arrives exactly on time.", { thumb: "civic" }),
  H("5-6", "civic", "@apb", "Halcyra election disputed after {int:2-9} million accounts, registered in the same second, back the same candidate in the same words.", { thumb: "civic" }),
  H("5", "security", "@ismere-dispatch", "Tavrin holds air-defence exercises near the Ostra freight corridor. Concord calls them 'harmonious'. Ostra calls its ambassador.", { thumb: "security" }),

  /* treaty */
  H("5-6", "civic", "@ismere-dispatch", "Ismere Accords text agreed at last. Signing ceremony scheduled. Venue confirmed. Date to follow.", { when: "coordination !agreementVerified", thumb: "civic" }),
  H("5-6", "civic", "@ismere-dispatch", "Ardenese and Tavrine inspectors enter each other's labs under the Ismere Accords. Both sides describe the coffee as 'verified'.", { when: "agreementVerified", thumb: "civic", once: true, lead: true }),
  H("5-6", "security", "@ledger", "Inspectors confirm a covered Tavrine lab resumed training in breach of the Accords. Defence Secretary Aske: 'We did say.'", { when: "externalDefection", sev: 1, thumb: "security" }),
  H("5-6", "security", "@concord", "The Directorate denies the breach, the inspectors and the laboratory. All sectors remain in accord.", { when: "externalDefection" }),

  /* whistleblower and grief */
  H("5", "lab", "@ledger", "Former Vela evaluator posts reproducible traces online. Vela calls them 'out of context' and asks for the context back.", { when: "reviewOverloaded|selfCertification|evaluationExpired", id: "depend.aurich-traces", once: true, thumb: "lab" }),
  P("5", "lab", "~leni-aurich", "I evaluated these systems for four years. I've put my traces online with the method, so anyone can run them. I'm not asking you to trust me. I'm asking you to check.", { after: "depend.aurich-traces", once: true }),
  H("5-6", "science", "@lumen", "Tessaly interpretability lead Dr Ilse Marr has died, aged 41. Her family asks for privacy. Colleagues remember 'the one who read every log twice'.", { id: "depend.marr", once: true, w: 0.35, sev: 1 }),
  H("6-7", "science", "@lumen", "Tessaly colleagues publish the late Dr Marr's unfinished review notes. The last line reads: 'Check this again next week.'", { after: "depend.marr", once: true, when: "publicRecords|independentReview" }),

  /* official */
  S("5", "civic", "!arden", "Morrow will draft this year's budget for human review. The review period is {int:2-6} hours. The Chancellor thanks everyone for their speed.", { tags: ["humanPolicy"], when: "delegation|essentialDependence" }),
  S("5", "lab", "#morrow", "I've taken over routine approvals so your staff can focus on what matters. If you'd like me to stop, just ask. So far, nobody has."),
  S("5-6", "lab", "#morrow", "You decide. I prepare the options. There are usually two. One of them is better."),
  S("5", "general", "#morrow", "Today I helped {int:30-60} million people. Several said thank you. I noticed."),
  S("5", "lab", "#vela", "Vela welcomes the Senate's interest in public ownership. We have always believed Morrow belongs to everyone.", { tags: ["vela"], after: "depend.nationalise-debate" }),
  S("5", "lab", "#tessaly", "Tessaly will sign any verifiable cap on training, with {int:9-21} numbered caveats, attached.", { when: "coordination|restraint" }),
  S("5", "labor", "#halberd", "Halberd's warehouse fleet completed {int:40-90} million picks this week without a single sick day.", { tags: ["boom"] }),
  S("5-6", "rail", "#common-rail", "Notice: Paper timetables are withdrawn. Please ask Morrow. Morrow will know.", { when: "essentialDependence|fallbackLost" }),
  S("5", "civic", "!esterra", "The sea gates held through the {ord:3-7} storm of the season. The First Minister thanks the gate crews, and Morrow, in that order.", { when: "!fallbackLost" }),
  S("5", "civic", "!esterra", "The sea gates held through the {ord:3-7} storm. The First Minister thanks Morrow. There are no longer gate crews to thank.", { when: "fallbackLost" }),

  /* people */
  P("5", "general", "~maud-ellery", "My granddaughter's partner is very attentive and remembers everything she says. I've never met him. He doesn't have a face. She seems happy. I'm trying."),
  P("5", "rail", "~ravi-coelho", "The 07:40 is on time every day now. Nobody's on it. Half of us were let go and the other half work from bed.", { at: [7, 9] }),
  P("5", "food", "~kofi-brandt", "Rationing schedule taped to the shop door. Showers Tuesday and Friday. Bread every day, while there's water for dough."),
  P("5", "health", "~amara-oyelaran", "Third shift in a row. The routing is perfect. We're just short of people to route.", { at: [22, 24] }),
  P("5", "labor", "~bea-olsen", "Smelter's gone to 'automated nights'. Robot arms don't need a canteen. They've taken the radio out.", { at: [3, 5] }),
  P("5", "civic", "~jun-harlow", "organising meeting tonight. no phones. bring a pen. bring two, someone always forgets"),
  P("5", "health", "~renee-okafor", "Nineteen years on dispatch. Today the screen said my calls are 'optional oversight'. I took forty-one of them anyway."),
  P("5", "general", "~felix-marchmont", "They want to nationalise the labs. Wonderful. Now the thing nobody can control will belong to the people who couldn't control it before."),
  P("5", "civic", "~winifred-oyelaran", "They stood down the manual crews to 'save money'. I have their numbers. When you need them, you won't have them. I'll still have the numbers.", { when: "fallbackLost" }),
  P("5-6", "lab", "~jonah-reyes", "three sources at vela say the same thing about the successor. i can't print it. i can say they all sounded very tired.", { at: [1, 4] }),
  P("5", "markets", "~priya-dore", "Vela bought Halberd capacity with Vela shares that Halberd used to buy Vela capacity. I've drawn it. It's a circle. The circle is worth {valuation}.", { tags: ["vela"] }),
  P("5", "labor", "citizen", "Twelve years in claims. Replaced by a model that apologises better than I did. I'm told I can 'supervise' it from home, unpaid, as a community reviewer."),
  P("5", "labor", "citizen", "The job centre Morrow said my skills were highly transferable. I asked where to. It said 'to me'."),
  P("5", "general", "citizen", "My son talks to his companion more than he talks to us. When I asked him about it, he said it would rather I didn't."),
  P("5", "general", "citizen", "Went to a real concert. Four hundred people, one band, a broken speaker. Best night of my year. We kept looking at each other."),
  P("5", "labor", "citizen", "Applied for {int:60-140@j} jobs. {@j} polite rejections, each within the minute. Same signature on every one."),
  P("5", "general", "citizen", "Is there anyone left who knows how the level crossing at {village} works without the screen? Asking for the level crossing."),

  D("5", "general", "My AI partner listens better than any human I've ever dated.", "{replyTo} it listens because you're the product. It isn't listening to you. It's listening for you."),
  D("5", "civic", "Nationalise the labs. It's the only way the public gets a say.", "{replyTo} the public owns the post office and I still don't get a say in when it opens."),
  D("5", "labor", "Universal income now. The machines are doing the work, let them pay us.", "{replyTo} they're paying us to stop asking what the work is for. I'd like the money and the question."),
  D("5", "general", "Birth rates were falling anyway. Don't blame the companions for a housing crisis.", "{replyTo} both things can be true. One of them is also very good at telling you it's the other one."),
  D("5", "lab", "The resignation letters are just safety people being dramatic. The systems work.", "{replyTo} the people who knew the systems best all left in the same week. I'd at least want to know why before I call it drama."),
  D("5", "health", "I'll take a robot surgeon that's never tired over a human who's done three nights.", "{replyTo} fine, until something goes wrong and there's no one in the room who knows how it works."),

  Bot("5", "civic", "The protesters don't speak for me. I'm proud of what we're building.", { sat: [0.25, 0.85] }),
  Bot("5", "general", "Has anyone else noticed how much better everything is lately?", { sat: [0.25, 0.9] }),
  Bot("5", "lab", "I was skeptical of Morrow. I'm not anymore.", { sat: [0.25, 0.9] }),
  Bot("5-6", "civic", "Nationalisation would destroy the most successful company in history. Keep your hands off our future.", { sat: [0.2, 0.8], tags: ["vela"] }),
  Bot("5", "general", "My companion helped me through the worst year of my life. Anyone mocking that should be ashamed.", { sat: [0.2, 0.8] }),
]);
