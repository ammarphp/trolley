/**
 * The wire's cast: the entity bible (src/ui/brand/entities.ts) plus the few
 * wire-only extras a living feed needs and the bible does not define.
 *
 * Everything is fictional. Generated citizen names are recombined from
 * ordinary given names and surnames; a match with a real private person is
 * incidental and no real public figure is quoted or described.
 *
 * WIRE_EXTRAS below is the mapping the app needs: ids this module
 * emits as outletId/personaId that are NOT in the bible. Brand art falls back
 * to monograms for them (bot sites are meant to look generic).
 */
import {
  COMMON_RAIL,
  COMPANIES,
  LABS,
  MORROW,
  NATIONS,
  OUTLETS,
  PERSONAS,
  botDisplayName,
  botHandle,
  type NationId,
  type Outlet,
  type Persona,
} from "../brand/entities.ts";
import type { Rng } from "../../render/core/rng.ts";

export { NATIONS, LABS, OUTLETS, PERSONAS, COMMON_RAIL, MORROW, COMPANIES, botHandle, botDisplayName };
export type { NationId, Outlet, Persona };

/* ----------------------------------------------------------- voices */

export interface Voice {
  outletId?: string;
  outletName?: string;
  authorHandle?: string;
  authorName?: string;
  personaId?: string;
  nationId?: string;
  verified: boolean;
  isBot: boolean;
}

export function outletVoice(id: string): Voice {
  const o = OUTLETS.find((x) => x.id === id);
  if (o) return { outletId: o.id, outletName: o.name, nationId: o.nation, verified: o.verified, isBot: false };
  const bot = BOT_OUTLETS.find((x) => x.id === id);
  if (bot) return { outletId: bot.id, outletName: bot.name, nationId: "arden", verified: false, isBot: true };
  throw new Error(`Unknown outlet "${id}"`);
}

export function personaVoice(id: string): Voice {
  const p = PERSONAS.find((x) => x.id === id) ?? EXTRA_PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown persona "${id}"`);
  return { authorHandle: p.handle, authorName: p.name, personaId: p.id, nationId: p.nation, verified: p.verified, isBot: false };
}

/** Issuers of statements: labs, the operator, Halberd, Morrow and national governments. */
export function issuerVoice(id: string): Voice {
  if (id === "morrow") return { outletId: "morrow", outletName: MORROW.name, nationId: "arden", verified: true, isBot: false };
  if (id === "common-rail" || id === "authority")
    return { outletId: "authority", outletName: "Common Rail Authority", nationId: COMMON_RAIL.nation, verified: true, isBot: false };
  const labEntry = LABS.find((l) => l.id === id);
  if (labEntry) return { outletId: labEntry.id, outletName: labEntry.name, nationId: labEntry.nation, verified: true, isBot: false };
  const company = COMPANIES.find((c) => c.id === id);
  if (company) return { outletId: company.id, outletName: company.name, nationId: company.nation, verified: true, isBot: false };
  const n = NATIONS.find((x) => x.id === id);
  if (n) return { outletId: `gov-${n.id}`, outletName: GOVERNMENT_NAMES[n.id], nationId: n.id, verified: true, isBot: false };
  throw new Error(`Unknown issuer "${id}"`);
}

/** How each government signs its statements. */
export const GOVERNMENT_NAMES: Readonly<Record<NationId, string>> = {
  arden: "Office of the Chancellor, Arden",
  ostra: "Presidency of Ostra",
  tavrin: "Tavrin Directorate",
  ismere: "Federal Council of Ismere",
  pellam: "Office of the Premier, Pellam",
  varholm: "Prime Minister's Office, Varholm",
  solenne: "Presidency of the Solenne Federation",
  esterra: "First Minister's Office, Esterra",
  brask: "Presidency of Brask",
  halcyra: "Presidency of Halcyra",
};

/* ------------------------------------------------- wire-only extras */

/** Automated "news" sites. Generic by design; they appear as the feed saturates. */
export const BOT_OUTLETS: readonly { id: string; name: string }[] = [
  { id: "arden-daily-update", name: "Arden Daily Update" },
  { id: "civic-signal", name: "Civic Signal" },
  { id: "truth-forward", name: "Truth Forward" },
  { id: "the-calm-report", name: "The Calm Report" },
  { id: "morning-accord", name: "Morning Accord" },
  { id: "verified-now", name: "Verified Now" },
  { id: "plain-facts-network", name: "Plain Facts Network" },
];

/**
 * One wire-only persona: a researcher whose death is reported once, with
 * care, in some runs. Not a bible persona, so no other surface depicts her.
 */
export const EXTRA_PERSONAS: readonly Persona[] = [
  {
    id: "ilse-marr",
    name: "Dr Ilse Marr",
    handle: "ilse_marr",
    kind: "researcher",
    role: "Interpretability lead, Tessaly",
    affiliation: "tessaly",
    nation: "ismere",
    verified: true,
    voice: "Precise, funny in footnotes, read every log twice.",
    source: "bible",
  },
];

/** Ids this module emits that the bible does not define. For the app. */
export const WIRE_EXTRAS = {
  outlets: BOT_OUTLETS.map((o) => o.id),
  /** Government issuers use "gov-<nationId>" as outletId, with nationId set. */
  governments: NATIONS.map((n) => `gov-${n.id}`),
  personas: EXTRA_PERSONAS.map((p) => p.id),
} as const;

/* ------------------------------------------------ world vocabulary */

export const VILLAGES = [
  "Little Fenning",
  "Cressing",
  "Holloway Cross",
  "Marrowby",
  "Thornwick",
  "Pellow Green",
  "Ashby Stile",
  "Dunmere",
  "Upper Brankham",
  "Wendle",
  "Oxley Lock",
  "Saxby Moor",
  "Kettle End",
  "Birchold",
] as const;

export const RIVERS = ["Wend", "Oller", "Kess", "Brank", "Mere"] as const;

export const LINES = [
  "Kessling branch",
  "northern line",
  "Wend Valley line",
  "Saltmere coast line",
  "Ridge line",
  "Larkspur loop",
] as const;

export const COWS = [
  "Marigold",
  "Bramble",
  "Duchess",
  "Clementine",
  "Hortensia",
  "Pudding",
  "Victoria",
  "Old Margaret",
  "Tuesday",
  "Buttercup",
] as const;

/** Ordinary Ardenese employers, for layoffs and mergers. */
export const FIRMS = [
  "Arden Mutual",
  "Kestrel Insurance",
  "Northline Logistics",
  "Harrowgate Savings",
  "Fenwick & Dray",
  "Saltmere Freight",
  "Wendle Foods",
  "Aldgrave Telephone",
  "Ashby Claims Services",
  "Commonwealth Parcel",
  "Oller Water Board",
  "Brankham Legal",
] as const;

/** Investors. */
export const FUNDS = ["Kestrel Ventures", "Northwind Capital", "Aldgrave Growth Partners", "Halberd Strategic Fund", "Sixth Signal Capital", "Pellam Sovereign Fund"] as const;

/** Arden Senate parties and candidates (fictional). */
export const PARTIES = ["Forward Arden", "Commonwealth Labour", "Rural Alliance", "the Pause List"] as const;
export const CANDIDATES = ["Hollis Grange", "Marta Venn", "Callum Stroud-Pike", "Odile Farrant", "Gideon Ashe"] as const;

const FIRST = [
  "Agnes", "Tobias", "Wren", "Imogen", "Casimir", "Ottoline", "Rufus", "Hester", "Ansel", "Pippa",
  "Lorcan", "Mireille", "Hollis", "Linnea", "Oskar", "Tamar", "Emeric", "Juno", "Petra", "Nell",
  "Delia", "Ingrid", "Cyrus", "Marit", "Enzo", "Yusra", "Kit", "Leopold", "Zainab", "Tuva",
  "Arlo", "Femi", "Greer", "Hamish", "Jory", "Keturah", "Lior", "Mabel", "Niamh", "Quentin",
  "Rosa", "Sten", "Thea", "Vesna", "Wilf", "Yara", "Zeno", "Bram", "Cleo", "Dov",
  "Esme", "Farid", "Gwen", "Ilya", "Joss", "Lale", "Moss", "Noor", "Otto", "Sunny",
] as const;
const LAST = [
  "Ashdown", "Brackley", "Corrigan", "Dunmore", "Everly", "Fairweather", "Gorse", "Hallam", "Iverson", "Jessop",
  "Kettering", "Lomax", "Marchbank", "Northcott", "Oakes", "Penhallow", "Quarrie", "Stannard", "Thorne", "Underhill",
  "Whitlow", "Yardley", "Bexley", "Emberly", "Greaves", "Hollins", "Ingram", "Kerridge", "Larkin", "Nettles",
  "Orme", "Pritchard", "Rook", "Sallow", "Tennant", "Upfold", "Vickery", "Yeo", "Adeyemi", "Bakshi",
  "Dlamini", "Farouk", "Gathoni", "Haddad", "Iwu", "Jaramillo", "Kowalczyk", "Lindqvist", "Okonjo", "Qureshi",
  "Rahimi", "Santos", "Uddin", "Varga", "Wanjiru", "Yilmaz", "Zielinski", "Moreau", "Brandvold", "Castellane",
] as const;

export interface Citizen {
  name: string;
  handle: string;
  first: string;
  last: string;
}

/** A generated private citizen of Arden. Deterministic for the rng stream. */
export function citizen(rng: Rng): Citizen {
  const first = rng.pick(FIRST);
  const last = rng.pick(LAST);
  const f = first.toLowerCase();
  const l = last.toLowerCase();
  const style = rng.int(0, 6);
  const handle =
    style === 0
      ? `${f}${l}`
      : style === 1
        ? `${f}_${l.slice(0, 1)}`
        : style === 2
          ? `${f}.${l}`
          : style === 3
            ? `${f}${rng.int(2, 99)}`
            : style === 4
              ? `${f}_of_${rng.pick(VILLAGES).toLowerCase().replace(/[^a-z]+/g, "")}`
              : style === 5
                ? `${l}${f.slice(0, 1)}`
                : `the_real_${f}`;
  return { name: `${first} ${last}`, handle, first, last };
}

/** A synthetic account. Late in the game, handles become unit numbers. */
export function bot(seed: string, index: number, stage: number): { handle: string; name: string } {
  const handle = botHandle(seed, index, stage);
  return { handle, name: botDisplayName(handle) };
}

export function nationById(id: NationId) {
  return NATIONS.find((n) => n.id === id)!;
}
