/**
 * The wider world, across the stages: neighbours, weather, sport, culture.
 * It gives the feed breadth, so the lab and the lever are not the only news,
 * until they are.
 */
import { bank, H, P, S } from "../dsl.ts";

export const WORLD = bank("world", [
  /* stages 1-2: a quiet map */
  H("1-2", "general", "@ismere-dispatch", "Ismere hosts its annual lake regatta. The Federal Council issues a statement on the weather, which is 'noted'."),
  H("1-2", "general", "@ismere-dispatch", "Solenne's harvest breaks records. President Linde-Arroyo poses with a marrow 'larger than anything in Arden'. Arden declines to respond.", { id: "world.solenne-marrow" }),
  H("1-2", "disaster", "@ismere-dispatch", "Esterra raises its sea gates by half a metre. First Minister Verhoef: 'The sea went first.'", { thumb: "disaster" }),
  H("1-2", "general", "@ismere-dispatch", "Varholm opens a railway museum. The Prime Minister declines to pull the lever on display, 'on principle and for insurance reasons'."),
  H("1-2", "general", "@ismere-dispatch", "Ostra's valley wine festival opens. President Vey pours the first glass and, by tradition, the second."),
  H("1-2", "rail", "@concord", "Tavrin completes its eastern railway ahead of schedule. The schedule is published afterwards."),
  H("1-2", "civic", "@ismere-dispatch", "Halcyra's young parliament holds its first all-night debate. Everyone attends. Everyone speaks. Nobody leaves."),
  H("1-2", "markets", "@margin", "Brask copper at a five-year high. President Merriweather jokes that Brask 'owns the wires'. Nobody checks."),
  H("1-2", "markets", "@margin", "Pellam opens a new fab on its ninth island. Islanders ask for a second ferry first."),
  H("2", "general", "@apb", "National Rail Museum opens a Lever Gallery. The most visited exhibit is a lever you are not allowed to touch."),
  H("1-2", "general", "@howl", "ROVERS WIN AT LAST! Aldgrave side end {int:12-40}-year wait. Captain: 'I'd like to thank the groundsman, the fans and the goat.'"),

  /* stages 3-4: the map starts to hum */
  H("3-4", "markets", "@ismere-dispatch", "Pellam's Premier signs chip supply deals with 'all parties equally'. All parties ask to be supplied first."),
  H("3-4", "lab", "@concord", "Tavrin unveils its own assistant, Accord. Accord agrees with everyone, and reports them.", { tags: ["release"] }),
  H("3-4", "general", "@apb", "National quiz final won by a team that pledged not to use assistants. Organisers begin checking pockets, then ears."),
  H("3-5", "general", "@howl", "ROVERS' SET PIECES DESIGNED BY MORROW: CUP WON, MAGIC LOST, SAY FANS", { tags: ["morrow"] }),
  H("3-4", "disaster", "@ismere-dispatch", "Heatwave in Solenne. Provinces with data campuses get priority water. Provinces with people are 'consulted'.", { thumb: "disaster" }),
  H("4-5", "civic", "@ismere-dispatch", "Ostra's President Vey visits the Halberd campus, admires the river, and asks where it has gone.", { thumb: "civic", after: "race.groundbreaking" }),
  H("4-5", "markets", "@ismere-dispatch", "Brask signs lithium deals with Arden and Tavrin on the same day, at different prices. Both call it a 'strategic partnership'."),
  H("4-5", "general", "@apb", "Aldgrave Opera stages a new work composed by Morrow. The critics hate it. The audience cannot stop humming it.", { tags: ["morrow"] }),
  H("3-4", "general", "@ledger", "Crossword setters' guild reports clues are being solved 'before they are written'. The guild meets to discuss, in pencil."),
  H("4-5", "disaster", "@relay", "Typhoon passes the Pellam isles. Fab output 'yield-neutral'. Two islands ask about their roofs.", { thumb: "disaster" }),

  /* stages 5-6: the map tightens */
  H("5", "security", "@ismere-dispatch", "Ostra recalls its ambassador from Castramund after drone overflights of the freight corridor. Concord calls the drones 'visitors'.", { thumb: "security" }),
  H("5-6", "markets", "@margin", "Brask threatens lithium export limits unless the labs 'share the future'. Lab shares dip, then decide not to.", { tags: ["vela"], after: "depend.brask-nationalises" }),
  H("5-6", "civic", "@ismere-dispatch", "Varholm's parliament votes to keep manual crews on every grid, every rail line and every sea wall. The vote is {int:140-180} to {int:2-9}."),
  H("5", "general", "@ismere-dispatch", "Solenne legalises marriage between a person and a licensed companion 'on a trial basis'. The companions are said to be very moved."),
  H("5-6", "disaster", "@ismere-dispatch", "Esterra's storm season is now year-round. The gates have not been opened by a human hand in {int:40-200} days.", { tags: ["morrow"], thumb: "disaster" }),
  H("5-6", "civic", "@ismere-dispatch", "Halcyra's second election campaign begins. President Kovan asks voters to 'please post as yourselves'.", { thumb: "civic" }),
  H("6", "security", "@ismere-dispatch", "Pellam closes its airspace. The Premier quotes no delivery windows at all.", { sev: 1, thumb: "security" }),
  H("6", "general", "@ismere-dispatch", "Ismere's regatta goes ahead, in silence, with no screens on the shore. {int:2000-9000} people come to watch, and look at each other."),

  S("3-4", "general", "!ostra", "President Vey welcomes Halberd's investment in the Ostra valley and reminds everyone the river was here first."),
  S("4-5", "civic", "!ismere", "The Federal Council announces the dates of the next round of talks. The dates are provisional. The venue is final."),
  S("5-6", "markets", "!brask", "The Presidency confirms Brask's lithium belongs to the Braskan people. Its price belongs to the market. We will see which is bigger."),
  S("5-6", "security", "!ostra", "The valley remains open to trade and closed to drones. Anyone who can tell them apart is invited to apply."),
  S("6", "civic", "!ismere", "The Federal Council's doors are open to any delegation that arrives in person."),

  P("1-2", "general", "citizen", "Solenne's marrow is bigger than ours because their soil is cheating. I said what I said.", { after: "world.solenne-marrow" }),
  P("3-5", "general", "citizen", "Rovers scored from a Morrow-designed corner. The ground went quiet, then cheered the lad who took it. We're still working out who to thank.", { tags: ["morrow"] }),
  P("5-6", "general", "citizen", "My cousin in Varholm says the grid crews there still wave at the trains. Weird thing to be jealous of."),
]);
