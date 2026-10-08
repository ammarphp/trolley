/**
 * The entity bible for the world of "trolley.": nations, laboratories, the
 * rail operator, the press, recurring people and places. Everything here is
 * invented. None of it describes, quotes or imitates a real organisation or
 * a real person; resemblance of a common word or surname is incidental.
 *
 * Writers: use `voice` for how an entity sounds, and keep quotations in the
 * fiction (never attribute a line to a real scientist or politician).
 * Places and people marked `source: "content"` already appear in the
 * authored campaign (src/content); keep their facts consistent with it.
 */
import { createRng, hashString } from "../../render/core/rng.ts";
import type { FlagInk } from "./palette.ts";

/* ================================================================ nations */

export type NationId =
  | "arden"
  | "ostra"
  | "tavrin"
  | "ismere"
  | "pellam"
  | "varholm"
  | "solenne"
  | "esterra"
  | "brask"
  | "halcyra";

/** Unit coordinates: x across the flag width 0..1, y down its height 0..1; radii are fractions of the height. */
export type FlagLayer =
  | { kind: "field"; ink: FlagInk }
  | { kind: "stripes"; dir: "h" | "v"; inks: readonly FlagInk[]; weights?: readonly number[] }
  | { kind: "band"; dir: "h" | "v"; at: number; width: number; ink: FlagInk }
  | { kind: "canton"; w: number; h: number; ink: FlagInk }
  | { kind: "polygon"; points: ReadonlyArray<readonly [number, number]>; ink: FlagInk }
  | { kind: "disc"; cx: number; cy: number; r: number; ink: FlagInk }
  | { kind: "ring"; cx: number; cy: number; r: number; width: number; ink: FlagInk }
  | { kind: "star"; cx: number; cy: number; r: number; points: number; inner: number; ink: FlagInk; rotate?: number; alt?: number }
  | { kind: "squares"; cx: number; cy: number; sizes: readonly number[]; inks: readonly FlagInk[] }
  | { kind: "grid"; x: number; y: number; cols: number; rows: number; cell: number; gap: number; ink: FlagInk }
  | { kind: "wave"; y: number; amp: number; periods: number; width: number; ink: FlagInk; x0?: number; x1?: number }
  | { kind: "split-disc"; cx: number; cy: number; r: number; left: FlagInk; right: FlagInk }
  | { kind: "emblem"; name: FlagEmblem; cx: number; cy: number; size: number; ink: FlagInk };

export type FlagEmblem = "kingfisher" | "gate" | "hexagon" | "furrows" | "parley";

export interface FlagSpec {
  /** Height / width. */
  ratio: number;
  layers: readonly FlagLayer[];
  /** One line on what the flag means inside the fiction. */
  meaning: string;
}

export interface Leader {
  name: string;
  title: string;
  handle?: string;
}

export interface Nation {
  id: NationId;
  name: string;
  shortName: string;
  demonym: string;
  capital: string;
  government: string;
  leader: Leader;
  /** The nation's part in the story. */
  role: string;
  /** How its officials and state channels sound. */
  voice: string;
  flag: FlagSpec;
}

export const NATIONS: readonly Nation[] = [
  {
    id: "arden",
    name: "Commonwealth of Arden",
    shortName: "Arden",
    demonym: "Ardenese",
    capital: "Aldgrave",
    government: "Parliamentary commonwealth with an elected Senate",
    leader: { name: "Beatrix Holm", title: "Chancellor", handle: "chancellor.holm" },
    role: "Home. Common Rail runs its lines; Vela is headquartered in Aldgrave. Every decision in the cab happens here.",
    voice: "Measured, procedural, fond of consultations and white papers. Becomes clipped and emergency-grammatical under strain.",
    flag: {
      ratio: 1 / 2,
      meaning: "Prussian field for the plain at night; the two white rails that built the Commonwealth; the compass star of the survey office.",
      layers: [
        { kind: "field", ink: "prussian" },
        { kind: "band", dir: "h", at: 0.66, width: 0.07, ink: "paper" },
        { kind: "band", dir: "h", at: 0.8, width: 0.07, ink: "paper" },
        { kind: "star", cx: 0.17, cy: 0.33, r: 0.21, points: 8, inner: 0.2, alt: 0.58, ink: "paper" },
      ],
    },
  },
  {
    id: "ostra",
    name: "Republic of Ostra",
    shortName: "Ostra",
    demonym: "Ostran",
    capital: "Ostra",
    government: "Presidential republic",
    leader: { name: "Tomas Vey", title: "President", handle: "presidentvey" },
    role: "Eastern neighbour across the freight corridor. Halberd Compute's campus in the Ostra valley draws on its river; later, curfews and closed stations.",
    voice: "Warm and regional in good times; terse ministry notices when the grid fails.",
    flag: {
      ratio: 2 / 3,
      meaning: "Pine and white for the valley's two banks, joined by a counterchanged sun.",
      layers: [
        { kind: "field", ink: "paper" },
        { kind: "polygon", points: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]], ink: "pine" },
        { kind: "split-disc", cx: 0.5, cy: 0.5, r: 0.27, left: "paper", right: "pine" },
      ],
    },
  },
  {
    id: "tavrin",
    name: "Tavrin Directorate",
    shortName: "Tavrin",
    demonym: "Tavrine",
    capital: "Castramund",
    government: "Single-party technocratic directorate",
    leader: { name: "Aurek Hallis", title: "First Director" },
    role: "The rival power in the compute race. Arden's hawks cite it; its state channel, Concord, cites Arden. Neither publishes the intelligence.",
    voice: "Serene, plural, and total: 'the Directorate notes', 'all sectors are in accord'. Never admits a delay.",
    flag: {
      ratio: 2 / 3,
      meaning: "Nested squares: the Directorate within the state within the people, all facing the same way.",
      layers: [
        { kind: "field", ink: "vermilion" },
        { kind: "squares", cx: 0.5, cy: 0.5, sizes: [0.62, 0.42, 0.2], inks: ["ink", "vermilion", "ink"] },
      ],
    },
  },
  {
    id: "ismere",
    name: "Free State of Ismere",
    shortName: "Ismere",
    demonym: "Ismeran",
    capital: "Orsa",
    government: "Neutral federal council",
    leader: { name: "Oona Lindell", title: "President of the Council" },
    role: "Neutral lake state that hosts the compute-limits talks. The Ismere Accords are drafted, redrafted and footnoted here.",
    voice: "Diplomatic, bilingual, allergic to adjectives. Its statements are mostly dates and venues.",
    flag: {
      ratio: 1,
      meaning: "A round table cut in two and drawn apart: the parties, and the space the talks keep open.",
      layers: [
        { kind: "field", ink: "slate" },
        { kind: "emblem", name: "parley", cx: 0.5, cy: 0.5, size: 0.56, ink: "paper" },
      ],
    },
  },
  {
    id: "pellam",
    name: "Republic of the Pellam Isles",
    shortName: "Pellam",
    demonym: "Pellamese",
    capital: "Port Anselm",
    government: "Island republic",
    leader: { name: "Iolo Serrat", title: "Premier" },
    role: "Nine islands, most of the world's leading-edge chip fabrication. Everyone's ally, everyone's single point of failure.",
    voice: "Polite, exacting, commercial. Quotes yields and delivery windows, not values.",
    flag: {
      ratio: 2 / 3,
      meaning: "Nine white squares for the nine isles, which the fabs have made look like a die.",
      layers: [
        { kind: "field", ink: "prussian" },
        { kind: "grid", x: 0.08, y: 0.14, cols: 3, rows: 3, cell: 0.14, gap: 0.06, ink: "paper" },
        { kind: "band", dir: "h", at: 0.86, width: 0.08, ink: "ochre" },
      ],
    },
  },
  {
    id: "varholm",
    name: "Kingdom of Varholm",
    shortName: "Varholm",
    demonym: "Varholmer",
    capital: "Skarre",
    government: "Constitutional monarchy",
    leader: { name: "Signe Aalvik", title: "Prime Minister" },
    role: "Northern kingdom that proposes the moratorium first and alone, and is thanked for its leadership.",
    voice: "Plain, moral, a little weary. Uses 'we' to mean everyone.",
    flag: {
      ratio: 2 / 3,
      meaning: "The mountain and its reflection in the fjord, counterchanged.",
      layers: [
        { kind: "stripes", dir: "h", inks: ["paper", "pine"] },
        { kind: "polygon", points: [[0.18, 0.5], [0.5, 0.12], [0.82, 0.5]], ink: "pine" },
        { kind: "polygon", points: [[0.18, 0.5], [0.5, 0.88], [0.82, 0.5]], ink: "paper" },
      ],
    },
  },
  {
    id: "solenne",
    name: "Solenne Federation",
    shortName: "Solenne",
    demonym: "Solennian",
    capital: "Avenor",
    government: "Federal republic",
    leader: { name: "Mateus Linde-Arroyo", title: "President" },
    role: "Agricultural giant with cheap land and cheap sun. Its provinces bid against each other for data campuses, then for water.",
    voice: "Expansive, booster-ish, provincial governors louder than the capital.",
    flag: {
      ratio: 2 / 3,
      meaning: "The sun over ploughed rows: the federation's old promise that land feeds everyone.",
      layers: [
        { kind: "field", ink: "ochre" },
        { kind: "emblem", name: "furrows", cx: 0.5, cy: 0.74, size: 0.5, ink: "paper" },
        { kind: "disc", cx: 0.27, cy: 0.33, r: 0.17, ink: "vermilion" },
      ],
    },
  },
  {
    id: "esterra",
    name: "United Provinces of Esterra",
    shortName: "Esterra",
    demonym: "Esterran",
    capital: "Lunmark",
    government: "Parliamentary union of provinces",
    leader: { name: "Annick Verhoef", title: "First Minister" },
    role: "Low coastal provinces behind sea gates. First to feel the storms; first to buy a model to run the gates.",
    voice: "Practical, engineering-literate, blunt about water levels.",
    flag: {
      ratio: 2 / 3,
      meaning: "The sea gate above the water it holds back.",
      layers: [
        { kind: "field", ink: "paper" },
        { kind: "polygon", points: [[0, 0.62], [1, 0.62], [1, 1], [0, 1]], ink: "prussian" },
        { kind: "wave", y: 0.8, amp: 0.035, periods: 5, width: 0.045, ink: "paper" },
        { kind: "emblem", name: "gate", cx: 0.5, cy: 0.405, size: 0.5, ink: "vermilion" },
      ],
    },
  },
  {
    id: "brask",
    name: "Brask Republic",
    shortName: "Brask",
    demonym: "Braskan",
    capital: "Hollin",
    government: "Presidential republic",
    leader: { name: "Cato Merriweather", title: "President" },
    role: "Lithium, copper and uranium exporter. Every chip and every reactor passes through its mines, and it knows it.",
    voice: "Transactional, proud, prone to nationalisation threats delivered as jokes.",
    flag: {
      ratio: 2 / 3,
      meaning: "The crystal in the rock: black for the seam, oxblood for the ore.",
      layers: [
        { kind: "stripes", dir: "h", inks: ["ink", "oxblood"] },
        { kind: "emblem", name: "hexagon", cx: 0.5, cy: 0.5, size: 0.56, ink: "paper" },
      ],
    },
  },
  {
    id: "halcyra",
    name: "Halcyran Republic",
    shortName: "Halcyra",
    demonym: "Halcyran",
    capital: "Sarn",
    government: "Young parliamentary republic",
    leader: { name: "Nadira Kovan", title: "President" },
    role: "A new democracy holding close elections. Its campaigns are where the bot swarms are tried first.",
    voice: "Hopeful and argumentative; long threads, strong opinions, real names.",
    flag: {
      ratio: 2 / 3,
      meaning: "The kingfisher, which returns to the same river every year.",
      layers: [
        { kind: "field", ink: "teal" },
        { kind: "band", dir: "v", at: 0.1, width: 0.06, ink: "paper" },
        { kind: "disc", cx: 0.56, cy: 0.5, r: 0.3, ink: "paper" },
        { kind: "emblem", name: "kingfisher", cx: 0.56, cy: 0.5, size: 0.44, ink: "ink" },
      ],
    },
  },
];

/* ================================================================== labs */

export type LabId = "vela" | "orrin" | "tessaly";

export interface Executive {
  name: string;
  title: string;
  handle: string;
}

export interface Lab {
  id: LabId;
  name: string;
  shortName: string;
  hq: string;
  nation: NationId;
  founded: number;
  ceo: Executive;
  tagline: string;
  /** The lab's flagship model or product. */
  flagship: string;
  role: string;
  voice: string;
  /** Things the campaign already says about this lab. */
  canon?: readonly string[];
}

export const LABS: readonly Lab[] = [
  {
    id: "vela",
    name: "Vela",
    shortName: "Vela",
    hq: "Aldgrave",
    nation: "arden",
    founded: 2019,
    ceo: { name: "Ines Carrow", title: "Chief Executive", handle: "inescarrow" },
    tagline: "We'll take it from here.",
    flagship: "Morrow",
    role: "The frontier lab whose assistant, Morrow, is installed in your cab. Sincere, fast, and always one scale-up from the thing that will pay for safety.",
    voice: "Calm, grateful, lower-case. Says 'careful' and 'first' in the same sentence.",
    canon: [
      "Strategy head Jasper Quill; science lead Bartholomew Ng; finance liaison Pilar Ostrander; integration engineer Fenwick Osei.",
      "Chief executive Ines Carrow: 'We will be careful, and we will be first.'",
    ],
  },
  {
    id: "orrin",
    name: "Orrin Systems",
    shortName: "Orrin",
    hq: "Port Anselm",
    nation: "pellam",
    founded: 2016,
    ceo: { name: "Rafe Wexley", title: "Chief Executive", handle: "rafewexley" },
    tagline: "Built on trust.",
    flagship: "Covenant",
    role: "Vela's nearest rival. Pledges independent review at a press conference with flags; footnote four defines 'independent'.",
    voice: "Polished keynote English. Its chief executive said 'trust' eleven times, according to a reporter who counted.",
    canon: ["Regional liaison Persephone Abara, who wrote footnote four.", "Rumoured training milestone arrives as a third-hand screenshot marked DRAFT."],
  },
  {
    id: "tessaly",
    name: "Tessaly",
    shortName: "Tessaly",
    hq: "Orsa",
    nation: "ismere",
    founded: 2021,
    ceo: { name: "Dr Maren Castell", title: "Director", handle: "marencastell" },
    tagline: "Careful, at scale.",
    flagship: "Lattice",
    role: "The third lab: smaller, safety-branded, signatory to every cap. Its auditors are the ones who would sit in Vela's data hall.",
    voice: "Academic and hedged; publishes long posts with numbered caveats.",
    canon: ["Co-drafts the three-lab training cap with Vela and Orrin."],
  },
];

/* ============================================ operator, assistant, compute */

export interface Operator {
  id: "common-rail";
  name: string;
  nation: NationId;
  head: Executive;
  role: string;
  voice: string;
  motto: string;
}

export const COMMON_RAIL: Operator = {
  id: "common-rail",
  name: "Common Rail",
  nation: "arden",
  head: { name: "Evelyn Stroud", title: "Director-General", handle: "commonrail" },
  role: "Operates every line in the Commonwealth and publishes the Authority bulletins. The office you work in is one of its desks.",
  voice: "Timetable prose. Reports disasters as 'minor administrative dampness' until it can't.",
  motto: "Every line, every hour.",
};

export interface Assistant {
  id: "morrow";
  name: string;
  maker: LabId;
  tagline: string;
  voice: string;
}

export const MORROW: Assistant = {
  id: "morrow",
  name: "Morrow",
  maker: "vela",
  tagline: "Here for what comes next.",
  voice: "Helpful, precise, gently certain. Never raises its voice; occasionally revises what it said.",
};

export interface Company {
  id: "halberd";
  name: string;
  kind: "compute";
  nation: NationId;
  ceo: Executive;
  role: string;
  voice: string;
}

export const COMPANIES: readonly Company[] = [
  {
    id: "halberd",
    name: "Halberd Compute",
    kind: "compute",
    nation: "ostra",
    ceo: { name: "Wendell Kaske", title: "Chief Executive", handle: "wkaske" },
    role: "Builds and leases the data campuses. Breaks ground on a five-gigawatt site in the Ostra valley.",
    voice: "Megawatts, groundbreakings and hard hats in photographs.",
  },
];

/* ================================================================ outlets */

export type OutletId =
  | "ledger"
  | "relay"
  | "authority"
  | "howl"
  | "margin"
  | "sidechannel"
  | "apb"
  | "lumen"
  | "ridge-fm"
  | "saltmere-tide"
  | "concord"
  | "pile-on"
  | "ismere-dispatch";

export type OutletKind =
  | "paper-of-record"
  | "wire-service"
  | "official"
  | "tabloid"
  | "business-daily"
  | "tech-blog"
  | "public-broadcaster"
  | "science-journal"
  | "local-radio"
  | "regional-paper"
  | "state-media"
  | "aggregator"
  | "international";

export interface Outlet {
  id: OutletId;
  name: string;
  kind: OutletKind;
  nation: NationId;
  handle: string;
  founded?: number;
  verified: boolean;
  /** Short descriptor for hover cards ("Wire service"). */
  desk: string;
  /** House style, for writers. */
  voice: string;
  /** Visual identity notes, for designers. */
  identity: string;
}

export const OUTLETS: readonly Outlet[] = [
  {
    id: "ledger",
    name: "The Ledger",
    kind: "paper-of-record",
    nation: "arden",
    handle: "theledger",
    founded: 1851,
    verified: true,
    desk: "Paper of record",
    voice: "Complete sentences, attributed claims, the business section read first. Corrects itself on page two.",
    identity: "Nameplate caps between a thick and a thin rule; the mark is a ledger page whose margin rule makes an L.",
  },
  {
    id: "relay",
    name: "Relay",
    kind: "wire-service",
    nation: "arden",
    handle: "relaywire",
    founded: 1904,
    verified: true,
    desk: "Wire service",
    voice: "First, flat and short. Dateline, fact, source. Never an adjective it can't defend.",
    identity: "Oblique heavy caps for speed; the mark is a single square-wave pulse, the wire itself.",
  },
  {
    id: "authority",
    name: "Common Rail Authority",
    kind: "official",
    nation: "arden",
    handle: "commonrail.authority",
    verified: true,
    desk: "Official notice",
    voice: "Numbered notices in the passive voice. Effective immediately. Thank you for your patience.",
    identity: "An engraved seal with the turnout diagram at its centre; spaced caps and a notice number.",
  },
  {
    id: "howl",
    name: "The Howl",
    kind: "tabloid",
    nation: "arden",
    handle: "thehowl",
    founded: 1962,
    verified: true,
    desk: "Tabloid",
    voice: "Puns, capitals, exclamation marks, a villain per headline. Occasionally, and to everyone's alarm, right.",
    identity: "Signal-red block, white condensed caps. The only outlet allowed to shout in colour.",
  },
  {
    id: "margin",
    name: "The Margin",
    kind: "business-daily",
    nation: "arden",
    handle: "themargin",
    founded: 1888,
    verified: true,
    desk: "Business daily",
    voice: "Valuations, basis points and the phrase 'priced in'. Treats a circular deal as a growth story until the footnote.",
    identity: "Light, wide caps beside a hairline margin rule; restraint as a status signal.",
  },
  {
    id: "sidechannel",
    name: "sidechannel",
    kind: "tech-blog",
    nation: "arden",
    handle: "sidechannel",
    founded: 2014,
    verified: false,
    desk: "Tech blog",
    voice: "Leaks, benchmarks, screenshots with red circles. First with the rumour, second with the correction.",
    identity: "Lower-case monospace with a block cursor; a prompt glyph for a mark.",
  },
  {
    id: "apb",
    name: "Arden Public Broadcasting",
    kind: "public-broadcaster",
    nation: "arden",
    handle: "apb",
    founded: 1931,
    verified: true,
    desk: "Public broadcaster",
    voice: "Even-handed to a fault; the explainer after the bulletin; the late-night studio panel.",
    identity: "A test-card disc of graded bands; APB in wide caps.",
  },
  {
    id: "lumen",
    name: "Lumen",
    kind: "science-journal",
    nation: "ismere",
    handle: "lumenletters",
    founded: 1907,
    verified: true,
    desk: "Science journal",
    voice: "Embargoed, peer-reviewed, cautious. 'Results suggest.' Then, one week, 'results confirm'.",
    identity: "An Airy diffraction pattern; light, lettered, generous.",
  },
  {
    id: "ridge-fm",
    name: "Ridge 97.3 FM",
    kind: "local-radio",
    nation: "arden",
    handle: "ridgefm",
    founded: 1979,
    verified: false,
    desk: "Local radio, Wenlock Ridge",
    voice: "Road closures, lost dogs, the clinic's opening hours and the one presenter everybody knows.",
    identity: "The ridge and its transmitter mast, with an amber on-air lamp.",
  },
  {
    id: "saltmere-tide",
    name: "The Saltmere Tide",
    kind: "regional-paper",
    nation: "arden",
    handle: "saltmeretide",
    founded: 1897,
    verified: true,
    desk: "Regional paper",
    voice: "Rationing schedules, council minutes, a letters page with strong feelings about showers.",
    identity: "A tide staff in a roundel: the paper that measures the water.",
  },
  {
    id: "concord",
    name: "Concord",
    kind: "state-media",
    nation: "tavrin",
    handle: "concord.tvr",
    verified: true,
    desk: "Tavrin state media",
    voice: "Serene totals and harmonious progress. Reports Arden's outages in detail and its own not at all.",
    identity: "The Directorate's nested squares in vermilion; heavy spaced caps.",
  },
  {
    id: "pile-on",
    name: "Pile-On",
    kind: "aggregator",
    nation: "arden",
    handle: "pileon",
    verified: false,
    desk: "Aggregator",
    voice: "Screenshots of screenshots, 'this is huge', a poll. Posts what is loud, not what is true.",
    identity: "Three speech bubbles stacked into a heap; tilted lower-case.",
  },
  {
    id: "ismere-dispatch",
    name: "Ismere Dispatch",
    kind: "international",
    nation: "ismere",
    handle: "ismeredispatch",
    founded: 1946,
    verified: true,
    desk: "International news",
    voice: "Diplomatic correspondents, summit schedules, long reads on who signed what.",
    identity: "A compass star over the lake horizon; spaced caps in two lines.",
  },
];

/* =============================================================== personas */

export type PersonaKind =
  | "journalist"
  | "executive"
  | "official"
  | "politician"
  | "union"
  | "researcher"
  | "engineer"
  | "local"
  | "citizen"
  | "bot";

export interface Persona {
  id: string;
  name: string;
  handle: string;
  kind: PersonaKind;
  /** Job or standing, as a byline would print it. */
  role: string;
  /** Entity id (outlet, lab, nation...) the persona belongs to, if any. */
  affiliation?: string;
  nation: NationId;
  verified: boolean;
  voice: string;
  /** "content": already named in the authored campaign; keep consistent. */
  source?: "content" | "bible";
}

export const PERSONAS: readonly Persona[] = [
  // Journalists
  { id: "tamsin-achterberg", name: "Tamsin Achterberg", handle: "tamsin_ledger", kind: "journalist", role: "Technology correspondent, The Ledger", affiliation: "ledger", nation: "arden", verified: true, voice: "Dry and exact. She is the reporter who counted 'trust' eleven times." },
  { id: "kwabena-hart", name: "Kwabena Hart", handle: "khart_relay", kind: "journalist", role: "Energy and infrastructure, Relay", affiliation: "relay", nation: "arden", verified: true, voice: "Megawatts, datelines, no adjectives." },
  { id: "sunniva-oduya", name: "Sunniva Oduya", handle: "sunnivaoduya", kind: "journalist", role: "Political editor, APB", affiliation: "apb", nation: "arden", verified: true, voice: "Explains the vote after it happens; patient with everyone except evasions." },
  { id: "priya-dore", name: "Priya Dore", handle: "priyadore", kind: "journalist", role: "Markets editor, The Margin", affiliation: "margin", nation: "arden", verified: true, voice: "Charts first, caveats second, a dry joke at the end." },
  { id: "felix-marchmont", name: "Felix Marchmont", handle: "felixhowls", kind: "journalist", role: "Columnist, The Howl", affiliation: "howl", nation: "arden", verified: true, voice: "Outrage as a house style; secretly reads the footnotes." },
  { id: "jonah-reyes", name: "Jonah Reyes", handle: "jonah.sc", kind: "journalist", role: "Founder, sidechannel", affiliation: "sidechannel", nation: "arden", verified: false, voice: "Leaks and benchmark charts; posts at 3 a.m.; 'source: trust me'." },
  // Labs and industry
  { id: "ines-carrow", name: "Ines Carrow", handle: "inescarrow", kind: "executive", role: "Chief Executive, Vela", affiliation: "vela", nation: "arden", verified: true, voice: "Soft-spoken certainty. 'We will be careful, and we will be first.'" },
  { id: "rafe-wexley", name: "Rafe Wexley", handle: "rafewexley", kind: "executive", role: "Chief Executive, Orrin Systems", affiliation: "orrin", nation: "pellam", verified: true, voice: "Keynote cadence; the word 'trust' as punctuation." },
  { id: "maren-castell", name: "Dr Maren Castell", handle: "marencastell", kind: "executive", role: "Director, Tessaly", affiliation: "tessaly", nation: "ismere", verified: true, voice: "Numbered caveats; signs everything; hedges the signature." },
  { id: "wendell-kaske", name: "Wendell Kaske", handle: "wkaske", kind: "executive", role: "Chief Executive, Halberd Compute", affiliation: "halberd", nation: "ostra", verified: true, voice: "Groundbreakings, gigawatts, hard-hat selfies." },
  { id: "jasper-quill", name: "Jasper Quill", handle: "jasperquill", kind: "executive", role: "Head of Strategy, Vela", affiliation: "vela", nation: "arden", verified: true, voice: "Podcast confidence; calls caution 'naive'.", source: "content" },
  { id: "bartholomew-ng", name: "Bartholomew Ng", handle: "bart_ng", kind: "researcher", role: "Science lead, Vela", affiliation: "vela", nation: "arden", verified: true, voice: "Sincere, exhausted, 'robust in-house'.", source: "content" },
  { id: "persephone-abara", name: "Persephone Abara", handle: "p_abara", kind: "executive", role: "Regional liaison, Orrin Systems", affiliation: "orrin", nation: "pellam", verified: true, voice: "Charming; calls footnote four 'legal hygiene'.", source: "content" },
  // Whistleblower
  { id: "leni-aurich", name: "Dr Leni Aurich", handle: "leni_aurich", kind: "researcher", role: "Former evaluations researcher, Vela", affiliation: "vela", nation: "arden", verified: false, voice: "Careful, frightened, specific. Posts reproducible traces, not opinions; then goes quiet." },
  // Politics and state
  { id: "beatrix-holm", name: "Beatrix Holm", handle: "chancellor.holm", kind: "politician", role: "Chancellor of Arden", affiliation: "arden", nation: "arden", verified: true, voice: "Measured; announces consultations; later, emergency powers." },
  { id: "octavia-brennock", name: "Senator Octavia Brennock", handle: "senbrennock", kind: "politician", role: "Senator for Kessling and Wenlock", affiliation: "arden", nation: "arden", verified: true, voice: "Constituency-first, folksy, runs hot on data-centre water." },
  { id: "conrad-aske", name: "Conrad Aske", handle: "defsec.aske", kind: "official", role: "Defence Secretary, Arden", affiliation: "arden", nation: "arden", verified: true, voice: "'Adversary pace.' Speaks in capabilities and timelines." },
  { id: "aurek-hallis", name: "Aurek Hallis", handle: "concord.tvr", kind: "politician", role: "First Director, Tavrin Directorate", affiliation: "tavrin", nation: "tavrin", verified: true, voice: "Quoted only through Concord; never a first-person sentence." },
  { id: "signe-aalvik", name: "Signe Aalvik", handle: "pm.aalvik", kind: "politician", role: "Prime Minister of Varholm", affiliation: "varholm", nation: "varholm", verified: true, voice: "Moral plainness; the first to say 'pause'." },
  { id: "evelyn-stroud", name: "Evelyn Stroud", handle: "commonrail", kind: "official", role: "Director-General, Common Rail", affiliation: "common-rail", nation: "arden", verified: true, voice: "Timetable prose and thanks for your patience." },
  { id: "everard-malick", name: "Everard Malick", handle: "e_malick", kind: "official", role: "Chief of staff to the governor", nation: "arden", verified: true, voice: "A threat in a nice coat.", source: "content" },
  // Labour
  { id: "winifred-oyelaran", name: "Winifred Oyelaran", handle: "winnie_arsw", kind: "union", role: "General Secretary, Amalgamated Rail & Signal Workers", nation: "arden", verified: true, voice: "Names, shifts and the cost of a night's sleep. Never says 'stakeholder'." },
  { id: "anneliese-kaur", name: "Anneliese Kaur", handle: "anneliese.k", kind: "union", role: "Shop steward, Bellweather smelter", nation: "arden", verified: false, voice: "Brings the night shift's names on a clipboard.", source: "content" },
  // Engineers and locals already in the campaign
  { id: "halvard-teigen", name: "Halvard Teigen", handle: "h_teigen", kind: "engineer", role: "Chief engineer, regional grid", nation: "arden", verified: false, voice: "'I cannot find the error.'", source: "content" },
  { id: "ngozi-ekwueme", name: "Ngozi Ekwueme", handle: "ngozi.e", kind: "engineer", role: "Deputy chief engineer, regional grid", nation: "arden", verified: false, voice: "'That's not the same as there isn't one.'", source: "content" },
  { id: "delphine-roux", name: "Delphine Roux", handle: "mayorroux", kind: "politician", role: "Mayor, Kessling County", nation: "arden", verified: true, voice: "Four hundred cannery jobs and a long drive.", source: "content" },
  { id: "idris-maalouf", name: "Idris Maalouf", handle: "wenlock_nurse", kind: "local", role: "Nurse, Wenlock Ridge clinic", nation: "arden", verified: false, voice: "Drives six hours to say one sentence.", source: "content" },
  { id: "rosalind-achebe", name: "Rosalind Achebe", handle: "larkspur_rosalind", kind: "local", role: "Grower, Larkspur orchards", nation: "arden", verified: false, voice: "A jar of dry soil on the desk, without a word.", source: "content" },
  { id: "hilde-sorensen", name: "Hilde Sørensen", handle: "mayor.saltmere", kind: "politician", role: "Mayor of Saltmere", nation: "arden", verified: true, voice: "Brings the ground-breaking shovel to the meeting.", source: "content" },
  { id: "solveig-aro", name: "Solveig Aro", handle: "s_aro_structures", kind: "engineer", role: "Independent structural engineer", nation: "arden", verified: false, voice: "Three weeks and a fee the council calls insulting.", source: "content" },
  { id: "renee-okafor", name: "Renée Okafor", handle: "dispatch_renee", kind: "local", role: "Ambulance dispatcher, nineteen years", nation: "arden", verified: false, voice: "Has never been asked to sign a licence agreement.", source: "content" },
  // Citizens
  { id: "maud-ellery", name: "Maud Ellery", handle: "maudellery", kind: "citizen", role: "Retired teacher, Aldgrave", nation: "arden", verified: false, voice: "Long, polite posts; photographs of the station clock." },
  { id: "ravi-coelho", name: "Ravi Coelho", handle: "ravi_on_the_740", kind: "citizen", role: "Commuter", nation: "arden", verified: false, voice: "Timetable jokes; then, one day, no jokes." },
  { id: "bea-olsen", name: "Bea Olsen", handle: "bea_nightshift", kind: "citizen", role: "Night shift, Bellweather", nation: "arden", verified: false, voice: "Short posts at 4 a.m." },
  { id: "kofi-brandt", name: "Kofi Brandt", handle: "kofibakes", kind: "citizen", role: "Baker, Saltmere", nation: "arden", verified: false, voice: "Bread prices and water rationing, with a photo of a loaf." },
  { id: "jun-harlow", name: "Jun Harlow", handle: "junharlow", kind: "citizen", role: "Student", nation: "arden", verified: false, voice: "Memes, then organising, then placards." },
  { id: "amara-oyelaran", name: "Amara Oyelaran", handle: "amara.o", kind: "citizen", role: "Paramedic, Meridian Hospital", nation: "arden", verified: false, voice: "Shift counts and exhaustion; never names a patient." },
  { id: "teodor-malm", name: "Teodor Malm", handle: "teo_votes", kind: "citizen", role: "Poll worker, Sarn", nation: "halcyra", verified: false, voice: "Counts things, including the accounts replying to him." },
];

/* ================================================================== bots */

const BOT_FIRST = ["daily", "real", "true", "calm", "civic", "morning", "steady", "plain", "local", "honest", "proud", "hopeful", "quiet", "bright", "clear", "patriot", "future", "good"];
const BOT_SECOND = ["voice", "updates", "citizen", "talk", "signal", "news", "neighbour", "facts", "truth", "hands", "people", "notes", "minds", "outlook", "arden", "forward", "gratitude", "view"];
const BOT_NAMES = ["Anna", "Mark", "Lena", "Tom", "Sara", "Ben", "Nora", "Luke", "Ella", "Max", "Ida", "Sam"];

/**
 * A plausible bot handle. Deterministic for (seed, index). Styles mix the
 * classic adjective_noun1234, Firstname + eight digits, and, late in the
 * game, eerily orderly unit numbers.
 */
export function botHandle(seed: string | number, index = 0, stage = 1): string {
  const r = createRng(`bot:${seed}:${index}`);
  const style = stage >= 6 && r.chance(0.5) ? 3 : r.int(0, 2);
  if (style === 0) return `${r.pick(BOT_FIRST)}_${r.pick(BOT_SECOND)}${r.chance(0.7) ? r.int(10, 9999) : ""}`;
  if (style === 1) return `${r.pick(BOT_NAMES)}${String(r.int(10000000, 99999999))}`;
  if (style === 2) return `${r.pick(BOT_FIRST)}${r.pick(BOT_SECOND)}_${r.int(1, 99)}`;
  return `unit_${String(r.int(0, 9999)).padStart(4, "0")}`;
}

/** A display name to go with a bot handle. */
export function botDisplayName(handle: string): string {
  const unit = /^unit_(\d+)$/.exec(handle);
  if (unit) return `Unit ${Number(unit[1])}`;
  const words = handle
    .replace(/\d+/g, "")
    .split(/[_\s]+|(?=[A-Z])/)
    .filter(Boolean);
  if (words.length === 1 && BOT_NAMES.includes(words[0]!)) return words[0]!;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function botHandles(count: number, seed: string | number, stage = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(botHandle(seed, i, stage));
  return out;
}

/* ================================================================ places */

export type PlaceId =
  | "meridian-hospital"
  | "harrow-street-infirmary"
  | "bellweather-smelter"
  | "larkspur-orchards"
  | "kessling-county"
  | "southmoor-substation"
  | "arden-street-bridge"
  | "wenlock-ridge"
  | "saltmere"
  | "aldgrave"
  | "ostra-valley";

export interface Place {
  id: PlaceId;
  name: string;
  kind: "hospital" | "clinic" | "industry" | "farm" | "county" | "grid" | "bridge" | "town" | "city" | "valley";
  nation: NationId;
  note: string;
  source: "content" | "bible";
}

export const PLACES: readonly Place[] = [
  { id: "meridian-hospital", name: "Meridian Hospital", kind: "hospital", nation: "arden", note: "District general hospital; its renal unit's backup feeds sit on the same grid as the compute campus.", source: "content" },
  { id: "harrow-street-infirmary", name: "Harrow Street Infirmary", kind: "clinic", nation: "arden", note: "Small city infirmary; waiting lists, then the triage model, then fewer staff.", source: "content" },
  { id: "bellweather-smelter", name: "Bellweather smelter", kind: "industry", nation: "arden", note: "Eighty-megawatt aluminium smelter; its night shift is curtailed on cold nights. Shop steward Anneliese Kaur.", source: "content" },
  { id: "larkspur-orchards", name: "Larkspur orchards", kind: "farm", nation: "arden", note: "Family orchards whose wells drop past the pumps in a dry August. Rosalind Achebe's family planted the first trees.", source: "content" },
  { id: "kessling-county", name: "Kessling County", kind: "county", nation: "arden", note: "Across the river; no inspectorate, a closed cannery and four hundred former workers. Mayor Delphine Roux.", source: "content" },
  { id: "southmoor-substation", name: "Southmoor substation", kind: "grid", nation: "arden", note: "Site of the controlled trial and the rolling brownouts.", source: "content" },
  { id: "arden-street-bridge", name: "Arden Street bridge", kind: "bridge", nation: "arden", note: "Closed for forty minutes a day; reopening booked on a model's thirty-page report.", source: "content" },
  { id: "wenlock-ridge", name: "Wenlock Ridge", kind: "town", nation: "arden", note: "Remote clinic six hours from the capital; not among the first licence partners. Home of Ridge 97.3 FM.", source: "content" },
  { id: "saltmere", name: "Saltmere", kind: "town", nation: "arden", note: "Coastal town in its second summer of water rationing; a desalination plant designed around an unreplicated catalyst.", source: "content" },
  { id: "aldgrave", name: "Aldgrave", kind: "city", nation: "arden", note: "Capital of the Commonwealth; Vela's headquarters and Common Rail's head office.", source: "bible" },
  { id: "ostra-valley", name: "Ostra valley", kind: "valley", nation: "ostra", note: "Halberd Compute's five-gigawatt campus and the river it drinks.", source: "bible" },
];

/* =============================================================== lookups */

export type BrandEntityId = LabId | OutletId | "common-rail" | "morrow" | "halberd";

/** Every id logoFor draws a designed mark for. */
export const BRAND_ENTITIES: readonly BrandEntityId[] = [
  "vela",
  "orrin",
  "tessaly",
  "morrow",
  "halberd",
  "common-rail",
  ...OUTLETS.map((o) => o.id),
];

/** Loose ids seen in content and fixtures, mapped to bible ids. */
export const ENTITY_ALIASES: Readonly<Record<string, BrandEntityId>> = {
  "the-ledger": "ledger",
  ledger: "ledger",
  "relay-wire": "relay",
  relaywire: "relay",
  "common-rail-authority": "authority",
  "commonrail.authority": "authority",
  "orrin-systems": "orrin",
  "vela-morrow": "morrow",
  "morrow.vela": "morrow",
  "the-howl": "howl",
  "the-margin": "margin",
  "arden-public-broadcasting": "apb",
  "ridge-fm": "ridge-fm",
  ridge: "ridge-fm",
  "the-saltmere-tide": "saltmere-tide",
  tide: "saltmere-tide",
  "halberd-compute": "halberd",
  pileon: "pile-on",
  dispatch: "ismere-dispatch",
};

export function normalizeEntityId(id: string): string {
  return id.trim().replace(/^@/, "").toLowerCase().replace(/[\s_]+/g, "-");
}

export function resolveEntityId(id: string): BrandEntityId | null {
  const key = normalizeEntityId(id);
  if ((BRAND_ENTITIES as readonly string[]).includes(key)) return key as BrandEntityId;
  return ENTITY_ALIASES[key] ?? null;
}

export function nation(id: string): Nation | undefined {
  const key = normalizeEntityId(id);
  return NATIONS.find((x) => x.id === key || normalizeEntityId(x.shortName) === key);
}

export function outlet(id: string): Outlet | undefined {
  const key = resolveEntityId(id) ?? normalizeEntityId(id);
  return OUTLETS.find((x) => x.id === key);
}

export function lab(id: string): Lab | undefined {
  const key = resolveEntityId(id) ?? normalizeEntityId(id);
  return LABS.find((x) => x.id === key);
}

export function persona(idOrHandle: string): Persona | undefined {
  const key = idOrHandle.replace(/^@/, "").toLowerCase();
  return PERSONAS.find((p) => p.id === key || p.handle.toLowerCase() === key);
}

export function place(id: string): Place | undefined {
  const key = normalizeEntityId(id);
  return PLACES.find((p) => p.id === key || normalizeEntityId(p.name) === key);
}

/** Display name for any entity id, or null if the bible does not know it. */
export function entityName(id: string): string | null {
  const key = resolveEntityId(id);
  if (key === "common-rail") return COMMON_RAIL.name;
  if (key === "morrow") return MORROW.name;
  if (key === "halberd") return COMPANIES[0]!.name;
  if (key) return (lab(key) ?? outlet(key))?.name ?? null;
  return nation(id)?.name ?? persona(id)?.name ?? place(id)?.name ?? null;
}

/** Stable small integer from any string (for seeding variations). */
export function seedOf(s: string): number {
  return hashString(s);
}
