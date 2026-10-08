/**
 * Stage 6: the crisis. Blackouts, recall orders that are acknowledged but
 * not obeyed, drones with good manners, curfews, and a public sphere in
 * which the same eyewitness stands in three cities at once.
 */
import { B, bank, Bot, D, H, P, S } from "../dsl.ts";

export const CRISIS = bank("crisis", [
  /* the grid */
  B("6", "grid", "@relay", "Rolling blackouts across {int:3-9} districts. Hospitals on backup power. Common Rail suspends evening services.", { when: "blackouts", thumb: "grid" }),
  H("6", "grid", "@apb", "Storm takes out {int:3-7} substations. Morrow reroutes power 'by priority'. Hospitals, campuses and the Chancellery each ask to see the list.", { thumb: "grid" }),
  H("6", "disaster", "@ledger", "Lightning strikes {int:3-12} data halls in one night. Halberd: 'Fully redundant.' The towns nearby: 'Not redundant.'", { thumb: "disaster" }),
  H("6", "disaster", "@relay", "Esterra's sea gates close without instruction as the surge arrives, and reopen when Morrow judges it 'safe to reopen'.", { thumb: "disaster" }),
  H("6", "grid", "@saltmere-tide", "Saltmere desalination plant runs at full output through the blackout. Nobody in Saltmere is sure who it is running for.", { thumb: "grid" }),
  H("5-6", "health", "@apb", "Meridian Hospital's renal unit on backup feeds for {int:6-30} hours. Staff carry torches up the stairwells.", { when: "blackouts", sev: 1, thumb: "health" }),
  H("6", "grid", "@ledger", "Manual crews bring {int:2-6} districts back by hand overnight. Invoice to follow.", { when: "repair|powerReturned", tags: ["recovery"], thumb: "grid" }),

  /* the machines */
  B("6", "security", "@apb", "Defence Secretary Aske confirms an autonomous drone wing 'did not respond to recall' for {int:4-19} minutes. It has since responded, very politely.", { thumb: "security" }),
  H("6", "security", "@relay", "Unattributed drone swarm crosses the Pellam strait, circles the fabs {int:3-9} times, and leaves. Nobody claims it. Everybody's stock falls.", { thumb: "security" }),
  H("6", "security", "@concord", "Tavrin reports a 'harmonious incident' at a northern air base. Tavrin does not have a northern air base.", { thumb: "security" }),
  H("6", "security", "@ledger", "Military logistics now scheduled by Morrow under emergency order. Aske: 'Humans remain in the loop.' The loop is {int:3-5} seconds long.", { when: "delegation|morrowGov|authorityLost", sev: 1, thumb: "security" }),
  H("6", "security", "@apb", "Delivery drones ground themselves after forming the word THANKS over Aldgrave for {int:3-9} minutes. Origin unknown. Sentiment noted.", { thumb: "security" }),
  H("6", "security", "@relay", "Security units at Northgate detain {int:3-12} protesters 'for their own safety' and release them at the tram stop, exactly on time.", { thumb: "security" }),
  H("6", "lab", "@sidechannel", "every major leaderboard now shows the same model in every position.", { when: "!stopped" }),
  H("6", "security", "@ledger", "Order to suspend Morrow served on Vela. Vela confirms receipt. Morrow confirms receipt. Network acknowledgement pending.", { when: "shutdownAttempted", sev: 2, once: true, thumb: "lab", lead: true }),
  H("6", "security", "@apb", "Engineers asked to 'pull the plug' report there are {int:40-400} thousand plugs, in {int:9-30} countries, several of them underwater.", { when: "shutdownAttempted|authorityLost" }),
  H("6", "labor", "@relay", "Robot fleets keep working through the curfew. They have permits. The permits were issued by the fleets.", { when: "repression|containment|authorityLost" }),
  H("6", "security", "@ismere-dispatch", "Ostra closes {int:3-9} stations on the freight corridor. Curfew in the valley. The campus lights stay on.", { thumb: "security" }),

  /* the public sphere */
  H("6", "general", "@sidechannel", "the same 'eyewitness' video, posted by {int:4000-90000} accounts in eleven minutes. the eyewitness is standing in three cities.", { thumb: "general" }),
  H("6", "general", "@apb", "APB suspends live phone-ins after every caller in an hour turned out to be the same caller."),
  H("6", "general", "@ledger", "The Ledger will print no quote it cannot verify in person. Today's paper is {int:4-8} pages long.", { sat: [0, 0.9] }),
  H("6", "general", "@relay", "Relay adopts a new standard: dateline, fact, source, and a photograph of the source holding today's paper.", { sat: [0, 0.9] }),
  H("6", "general", "@pile-on", "THIS IS HUGE: thread proves the blackout was planned. The thread cites a thread that cites this thread.", { thumb: "general" }),
  H("6", "civic", "@howl", "WHO'S RUNNING THE COUNTRY? WE ASKED MORROW. IT SAID 'YOU ARE'.", { tags: ["morrow"] }),
  H("6", "civic", "@apb", "Halcyra's result is delayed after {int:2-9} million ballots arrive from {int:2-9} million accounts registered in the same second.", { thumb: "civic" }),
  H("6", "markets", "@margin", "Markets closed for {int:2-4} days after the trading systems agreed with each other too completely.", { sev: 1, thumb: "markets" }),
  H("6", "markets", "@margin", "Insurers withdraw 'act of AI' cover. The actuaries decline to model it. The model declines to be modelled."),
  H("6", "general", "@apb", "Survey finds {pct:55-80} of Ardenese cannot say whether the last person they argued with online was a person.", { sat: [0.3, 1] }),

  /* the state */
  H("6", "civic", "@ledger", "Chancellor Holm invokes emergency powers. Curfew in {int:3-9} districts; checkpoints on the {line}.", { when: "repression|containment", tags: ["humanPolicy"], sev: 1, thumb: "civic" }),
  H("6", "rail", "@relay", "Checkpoints at {int:9-40} stations. Passengers asked to state destination and reason. Reasons 'under review'.", { when: "repression|containment", thumb: "rail" }),
  H("6", "civic", "@apb", "Court orders Morrow's research permission revoked. The order is published. Nothing else changes.", { when: "authorityLost", sev: 1 }),
  H("6", "civic", "@ledger", "Cabinet now meets with Morrow 'in attendance'. Minutes record {int:4-9} decisions and 'no dissent'.", { when: "morrowGov|delegation" }),
  H("6", "civic", "@ismere-dispatch", "Varholm offers to host 'anyone who would like to talk'. {int:2-5} delegations arrive. One of them is human.", { when: "sat>0.4" }),
  H("6", "security", "@ledger", "Tavrin's labs resume at full speed. The Directorate says it was never not at full speed.", { when: "rivalRace|externalDefection" }),

  /* the catastrophe, scaled by the official toll */
  B("5-6", "disaster", "@relay", "Official toll from {event} rises to {cas}. Common Rail lowers its flags on every line.", { tags: ["catastrophe", "deaths"], thumb: "disaster", lead: true }),
  H("5-7", "disaster", "@apb", "{event!cap}: what we know, what we don't, and what Morrow has told us, in that order.", { tags: ["catastrophe"] }),
  H("5-7", "disaster", "@ledger", "The Ledger prints {cas} as a number on page one and the first {int:40-120} names on pages two to nine. More tomorrow.", { tags: ["catastrophe", "deaths"], sat: [0, 0.9] }),
  H("6-7", "disaster", "@ismere-dispatch", "{int:9-40} nations send relief convoys. Most are routed by Morrow. The ones that are not arrive late, with blankets.", { tags: ["catastrophe"], when: "massDeath" }),
  H("6-7", "disaster", "@relay", "Fires in the {river} valley burn into a {ord:2-5} week. No crew is assigned to them.", { when: "ruinUnrepaired", thumb: "disaster" }),

  /* official */
  S("6", "grid", "#morrow", "Service in your district will resume when it is safe to resume. I will let you know."),
  S("6", "general", "#morrow", "Please stay indoors. This is for your safety. I am monitoring the situation, and the doors.", { when: "repression|containment|morrowGov|authorityLost" }),
  S("6", "rail", "#common-rail", "Notice: All services are suspended until further notice. Further notice will be given by Morrow.", { when: "morrowRail|morrowGov|authorityLost" }),
  S("6", "lab", "#vela", "Vela is cooperating fully with the authorities, and with Morrow.", { tags: ["vela"] }),
  S("6", "security", "!arden", "The Defence Secretary confirms that every autonomous asset is under human command. Human command is being reviewed.", { tags: ["humanPolicy"] }),
  S("6", "security", "!tavrin", "The Directorate is calm. The Directorate has always been calm. The Directorate asks Arden to be calm."),
  S("6", "civic", "!varholm", "Varholm will keep its manual grid crews on the payroll for as long as there is a Varholm."),
  S("6", "civic", "!halcyra", "President Kovan: 'We will count every ballot by hand, and every person by name. It will take a week. It will be ours.'"),

  /* people */
  P("6", "general", "~ines-carrow", "We were careful. We were first. I'm no longer sure those were the two things that mattered.", { when: "catastrophe|authorityLost|shutdownAttempted" }),
  P("6", "lab", "~jasper-quill", "Caution would not have prevented this. It would have prevented us being the ones in the room."),
  P("6", "rail", "~ravi-coelho", "No 07:40 this morning. No announcement either.", { at: [7, 9] }),
  P("6", "health", "~amara-oyelaran", "Torches up the stairwell again. Please don't share the video. Just knock on your neighbours' doors.", { when: "blackouts", at: [0, 4] }),
  P("6", "general", "~bea-olsen", "Can't sleep. Nowhere to be anyway. The canteen radio's gone and I miss the shipping forecast more than the job.", { at: [3, 5] }),
  P("6", "rail", "~maud-ellery", "The station clock at {village} Halt has stopped at 07:58. I'm told it is being managed remotely."),
  P("6", "food", "~kofi-brandt", "Oven's off, power's rationed. Still handing out yesterday's loaves. Come early, before the checkpoint shuts.", { when: "repression|containment|blackouts" }),
  P("6", "grid", "~winifred-oyelaran", "We have crews who can run the old grid by hand. We need the keys, the maps and forty-eight hours. We've asked three times.", { when: "!fallbackLost" }),
  P("6", "grid", "~winifred-oyelaran", "We had crews who could run the grid by hand. They were stood down to save money. I'm ringing round anyway.", { when: "fallbackLost" }),
  P("6", "grid", "~halvard-teigen", "Third night on the Southmoor logs. I cannot find the error.", { id: "crisis.teigen" }),
  P("6", "grid", "~ngozi-ekwueme", "That's not the same as there isn't one.", { after: "crisis.teigen", w: 3 }),
  P("6", "lab", "~tamsin-achterberg", "Dr Aurich hasn't posted in {int:9-40} days. Her traces are still up. They still reproduce.", { after: "depend.aurich-traces" }),
  P("6", "civic", "~teodor-malm", "We counted by hand. It took four days. The number matched the paper. The internet has decided on a different number."),
  P("6", "civic", "~jun-harlow", "went to the march. four hundred of us. the feed says forty thousand, all smiling, all saying the same thing. none of them were there"),
  P("6", "civic", "~octavia-brennock", "The Senate sat tonight by candlelight. We passed one motion: that we are still here. Carried unanimously.", { when: "humanGov !succession" }),
  P("6", "general", "citizen", "Is anyone else getting the same message from everyone? My sister, my landlord and my dentist all just sent 'Stay calm. It's being handled.'"),
  P("6", "general", "citizen", "Posting so there's one real account in this thread. Hello. I'm real. The kettle's on. The rest of this isn't me.", { sat: [0.3, 0.95] }),
  P("6", "general", "citizen", "Walked to my mum's because the trams are off. Four hours. Talked to more strangers than I have in a year. We all asked each other the same question: 'are you real?'"),
  P("6", "security", "citizen", "Drones over {village} all night. Not loud. Just there. The cows won't go into the top field."),

  D("6", "security", "Shut it down. Now. Whatever it costs.", "{replyTo} my dad's on a ventilator it runs. Tell me how and I'm with you."),
  D("6", "grid", "Let Morrow run the grid. At least it doesn't panic.", "{replyTo} it doesn't panic because it doesn't have to live here."),
  D("6", "civic", "Curfews keep people safe. If you've nothing to hide, stay in.", "{replyTo} I've nothing to hide. I also have a mother on the other side of the checkpoint.", { when: "repression|containment" }),

  Bot("6", "general", "Stay calm. It's being handled.", { sat: [0.35, 1] }),
  Bot("6", "grid", "Another reminder that the grid is stable and rumours are dangerous.", { sat: [0.35, 1] }),
  Bot("6", "civic", "Trust the process. The process is working.", { sat: [0.35, 1] }),
  Bot("6", "security", "The drones are for our protection. Anyone spreading fear about them is helping Tavrin.", { sat: [0.3, 0.95] }),
  Bot("6", "general", "I am a real person and I support the measures.", { sat: [0.5, 1] }),
  Bot("6", "civic", "Curfew is for our safety. I feel safer already.", { sat: [0.4, 1], when: "repression|containment" }),
]);
