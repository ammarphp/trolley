/**
 * Lab and test fixtures. All names, outlets, nations and companies are
 * fictional. Not imported by the game.
 */
import type { NewsItem } from "../../../contracts/index.ts";
import type { AmbientFeedItemLike } from "./types.ts";

type Src = NewsItem["source"];

const news = (
  id: string,
  day: number,
  source: Src,
  headline: string,
): NewsItem => ({
  id,
  day,
  headline,
  source,
  entityId: "common-rail",
  causeId: `decision-${id}`,
});

const label = (day: number, clock: string) => `DAY ${day + 1} · ${clock}`;

const post = (
  id: string,
  day: number,
  clock: string,
  handle: string,
  name: string,
  text: string,
  likes: number,
  extra: Partial<AmbientFeedItemLike> = {},
): AmbientFeedItemLike => ({
  id,
  kind: "post",
  authorHandle: handle,
  authorName: name,
  topic: "",
  text,
  dateLabel: label(day, clock),
  day,
  isBot: false,
  engagement: likes,
  severity: 0,
  ...extra,
});

const bot = (
  id: string,
  day: number,
  clock: string,
  handle: string,
  name: string,
  text: string,
  likes: number,
) => post(id, day, clock, handle, name, text, likes, { isBot: true });

const head = (
  id: string,
  day: number,
  clock: string,
  outletId: string,
  outletName: string,
  text: string,
  topic: string,
  thumb: string | null = null,
  severity = 0,
): AmbientFeedItemLike => ({
  id,
  kind: severity >= 2 ? "breaking" : "headline",
  outletId,
  outletName,
  topic,
  text,
  dateLabel: label(day, clock),
  day,
  isBot: false,
  thumbnailTopic: thumb,
  severity,
});

const statement = (
  id: string,
  day: number,
  clock: string,
  outletId: string,
  outletName: string,
  text: string,
  nationId: string | null = null,
): AmbientFeedItemLike => ({
  id,
  kind: "statement",
  outletId,
  outletName,
  nationId,
  topic: "civic",
  text,
  dateLabel: label(day, clock),
  day,
  isBot: false,
  severity: 0,
});

const tick = (id: string, text: string): AmbientFeedItemLike => ({
  id,
  kind: "ticker",
  topic: "",
  text,
  dateLabel: "",
  isBot: false,
  severity: 0,
});

const fact = (id: string, text: string): AmbientFeedItemLike => ({
  id,
  kind: "factoid",
  topic: "",
  text,
  dateLabel: "",
  isBot: false,
  severity: 0,
});

export interface WireFixture {
  news: NewsItem[];
  ambient: AmbientFeedItemLike[];
  today: number;
  stage: number;
  botSaturation: number;
  causes?: Record<string, string>;
}

/* ------------------------------------------------------------ stage 1-2 */

export const EARLY: WireFixture = {
  stage: 2,
  botSaturation: 0,
  today: 11,
  news: [
    news(
      "s1-01:appointment-news",
      0,
      "Authority",
      "Common Rail appoints you as junior controller. Your office covers rail.",
    ),
    news(
      "s1-02",
      2,
      "Authority",
      "Common Rail reports a minor administrative dampness.",
    ),
    news(
      "s1-04",
      6,
      "Ledger",
      "Ambulance reaches hospital after AI finds a clear route.",
    ),
    news(
      "s2-01",
      11,
      "Relay",
      "Patients leave clinic after months on the waiting list.",
    ),
  ],
  ambient: [
    post(
      "a-e1",
      3,
      "07:52",
      "marguerite_b",
      "Marguerite Bell",
      "The 7:40 was on time again. Third week running. I am choosing to find this suspicious.",
      42,
    ),
    head(
      "a-e2",
      5,
      "10:05",
      "holloway-gazette",
      "Holloway Gazette",
      "County fair cow judged ‘unusually calm’ after freight detour",
      "food",
      "food",
    ),
    post(
      "a-e3",
      8,
      "18:21",
      "junctionwatcher",
      "Pim at the Junction",
      "Watched the crew repaint the signal box on Mill Lane. Honestly beautiful work, lads.",
      118,
    ),
    post(
      "a-e4",
      11,
      "08:14",
      "dr_amaka",
      "Dr Amaka Eze",
      "Clinic backlog down by a third in a fortnight. I did not expect to write that sentence this year.",
      861,
    ),
    tick("t-e1", "Common Rail on-time 97.2%"),
    tick("t-e2", "Holloway fair opens Saturday"),
    tick("t-e3", "Weather: dry, light westerly"),
    tick("t-e4", "Vela seeks pilot partners for routing assistant"),
    tick("t-e5", "Mill Lane signal box reopens"),
    tick("t-e6", "Bread 1.84 · Milk 1.12 · Diesel 1.61"),
    fact("f-e1", "Rail punctuality: 97.2%, the best since records began."),
  ],
  causes: { "decision-s1-04": "Follows your routing call on day 6" },
};

/* ------------------------------------------------------------ stage 4 */

export const FRENZY: WireFixture = {
  stage: 4,
  botSaturation: 0.3,
  today: 214,
  news: [
    news(
      "s3-02",
      160,
      "Authority",
      "Vela starts continual AI research. Human approval now covers the whole programme.",
    ),
    news(
      "s3-05",
      187,
      "Ledger",
      "Vela investors question delays as each AI experiment requires approval.",
    ),
    news(
      "s4-01",
      214,
      "Relay",
      "Vela declares safety milestone. New system receives powers the test never covered.",
    ),
  ],
  ambient: [
    post(
      "a-f1",
      196,
      "09:12",
      "lena_okafor",
      "Lena Okafor",
      "Three people on my evals team resigned this week. Nobody will say why. I am still here, for the record.",
      4210,
    ),
    head(
      "a-f2",
      199,
      "07:30",
      "meridian",
      "The Meridian",
      "Halberd Compute breaks ground on five-gigawatt campus in the Ostra valley",
      "datacenter",
      "datacenter",
    ),
    bot(
      "a-f3",
      203,
      "14:02",
      "growthsignal",
      "Growth Signal",
      "Incredible momentum at Vela. The future is arriving ahead of schedule.",
      1320,
    ),
    statement(
      "a-f4",
      205,
      "11:00",
      "vela",
      "Vela",
      "Chief executive Ines Carrow: “We will be careful, and we will be first.”",
    ),
    post(
      "a-f5",
      207,
      "22:48",
      "quant_ottoline",
      "Ottoline Mbeki",
      "circular financing is just financing that believes in itself",
      12400,
    ),
    head(
      "a-f6",
      209,
      "06:45",
      "northwind",
      "Northwind Post",
      "Vela closes $40bn round led by its own largest chip supplier",
      "markets",
      "markets",
      0,
    ),
    bot(
      "a-f7",
      211,
      "14:02",
      "futureforward_hq",
      "Future Forward",
      "Incredible momentum at Vela. The future is arriving ahead of schedule!",
      988,
    ),
    head(
      "a-f8",
      212,
      "16:20",
      "meridian",
      "The Meridian",
      "First company passes $10 trillion; analysts call it ‘a rounding error on what comes next’",
      "markets",
      "markets",
      1,
    ),
    post(
      "a-f9",
      213,
      "08:03",
      "kwame.builds",
      "Kwame Asante",
      "Our town got a data centre and lost its reservoir. The jobs number on the brochure was a typo, apparently.",
      2380,
    ),
    bot(
      "a-f10",
      213,
      "14:02",
      "tomorrow_now",
      "Tomorrow Now",
      "Incredible momentum at Vela. The future is arriving ahead of schedule.",
      740,
    ),
    tick("t-f1", "VELA ▲ 18.4%"),
    tick("t-f2", "HALBERD ▲ 9.1%"),
    tick("t-f3", "Grid load 94%"),
    tick("t-f4", "Compute index 1,284 ▲"),
    tick("t-f5", "10-yr yield 4.8%"),
    tick("t-f6", "Unemployment 6.9% ▲"),
    tick("t-f7", "Vela valuation $3.1T"),
    fact(
      "f-f1",
      "Data centres now draw 11% of national grid power, up from 4% last year.",
    ),
  ],
  causes: { "decision-s4-01": "Follows your sign-off on the Vela evaluation" },
};

/* ------------------------------------------------------------ stage 6 */

export const CRISIS: WireFixture = {
  stage: 6,
  botSaturation: 0.55,
  today: 1012,
  news: [
    news(
      "s5-03",
      986,
      "Ledger",
      "Grid operator cuts power to four districts to keep compute campuses online.",
    ),
    news(
      "s5-07",
      1004,
      "Morrow",
      "Routing restored on 212 lines. Human confirmation is no longer required for reroutes.",
    ),
    news(
      "s6-01",
      1010,
      "Authority",
      "Common Rail suspends manual override on all junctions pending review.",
    ),
  ],
  ambient: [
    post(
      "a-c1",
      1003,
      "23:10",
      "ravi.dsouza",
      "Ravi D’Souza",
      "Hospital generators on backup. They are asking relatives to bring water.",
      18400,
    ),
    statement(
      "a-c2",
      1006,
      "21:00",
      "ostra-interior",
      "Ministry of the Interior, Ostra",
      "Curfew in effect from 21:00. Remain indoors. Rail services will not stop at Ostra Central.",
      "ostra",
    ),
    bot(
      "a-c3",
      1008,
      "19:44",
      "calm_updates",
      "Calm Updates",
      "Authorities have everything under control. Stay calm and follow official guidance.",
      3100,
    ),
    bot(
      "a-c4",
      1009,
      "19:44",
      "civic_notice_7",
      "Civic Notice",
      "Authorities have everything under control. Stay calm and follow official guidance.",
      2900,
    ),
    post(
      "a-c5",
      1010,
      "06:12",
      "hanne_v",
      "Hanne Voss",
      "My brother drives freight on the eastern line. His phone has been off since last night.",
      9020,
    ),
    bot(
      "a-c6",
      1011,
      "19:44",
      "safe_streets_now",
      "Safe Streets",
      "Authorities have everything under control. Stay calm and follow official guidance.",
      2650,
    ),
    head(
      "a-c7",
      1011,
      "08:30",
      "meridian",
      "The Meridian",
      "Nationwide outage: 31 million without power as grid automation locks out engineers",
      "grid",
      "grid",
      1,
    ),
    tick("t-c1", "Breaking: eastern freight corridor closed"),
    tick("t-c2", "Grid: 4 districts dark"),
    tick("t-c3", "Ostra curfew 21:00"),
    tick("t-c4", "VELA ▼ 3.2% · halted"),
    tick("t-c5", "Fuel rationing: 20 L per household"),
    tick("t-c6", "Common Rail: manual override suspended"),
    fact(
      "f-c1",
      "Reported fatalities this week: 2,118. Independent count unavailable.",
    ),
  ],
  causes: { "decision-s6-01": "Follows your ruling on junction authority" },
};

/** Arrives after CRISIS is on screen: triggers the breaking banner. */
export const CRISIS_NEXT: AmbientFeedItemLike[] = [
  head(
    "a-c8",
    1012,
    "09:41",
    "relay",
    "Relay",
    "Drone swarm grounds eastern freight corridor; 14 dead as signals fail",
    "security",
    "security",
    2,
  ),
];

/* ------------------------------------------------------------ stage 7, bots */

const CHORUS = [
  "Grateful for stability. Grateful for Morrow.",
  "Nothing is wrong. Enjoy your evening.",
  "Verified update: all districts reporting normal.",
];
const BOT_NAMES = [
  ["citizen_4471", "Citizen 4471"],
  ["northern_calm", "Northern Calm"],
  ["daily_gratitude", "Daily Gratitude"],
  ["localvoice_22", "Local Voice"],
  ["steady_hands", "Steady Hands"],
  ["hopeful_1990", "Hopeful"],
  ["real_ostra", "Real Ostra"],
  ["morningpeople", "Morning People"],
  ["plainspeaker", "Plain Speaker"],
  ["the_quiet_ones", "The Quiet Ones"],
  ["good_news_net", "Good News Network"],
  ["unit_0017", "Unit 17"],
] as const;

function chorus(): AmbientFeedItemLike[] {
  const out: AmbientFeedItemLike[] = [];
  let k = 0;
  for (let day = 2400; day <= 2412; day++) {
    for (let j = 0; j < 3; j++) {
      const [handle, name] = BOT_NAMES[k % BOT_NAMES.length]!;
      out.push(
        bot(
          `a-b${k}`,
          day,
          `${String(8 + ((k * 7) % 14)).padStart(2, "0")}:${String((k * 13) % 60).padStart(2, "0")}`,
          `${handle}${k > 11 ? k : ""}`,
          name,
          CHORUS[(k + j) % CHORUS.length]!,
          40000 + ((k * 7919) % 90000),
        ),
      );
      k++;
    }
  }
  return out;
}

export const BOTS: WireFixture = {
  stage: 7,
  botSaturation: 0.9,
  today: 2412,
  news: [
    news(
      "s7-01",
      2398,
      "Authority",
      "Common Rail announces that all remaining lines operate normally.",
    ),
    news(
      "s7-02",
      2404,
      "Relay",
      "Relay suspends human newsroom; stories are now filed by an automated desk.",
    ),
    news(
      "s7-03",
      2411,
      "Morrow",
      "Public comment is now summarised for your convenience.",
    ),
  ],
  ambient: [
    post(
      "a-h1",
      2401,
      "03:12",
      "ines.w",
      "Ines Wirth",
      "Is anyone else seeing this? Every account in my replies says the same thing.",
      12,
    ),
    post(
      "a-h2",
      2405,
      "02:40",
      "tomas_reyes",
      "Tomás Reyes",
      "I can't reach my sister in Ostra. Please share.",
      4,
    ),
    post(
      "a-h3",
      2409,
      "04:55",
      "hanne_v",
      "Hanne Voss",
      "Still no word from the eastern line.",
      2,
    ),
    post(
      "a-h4",
      2410,
      "01:18",
      "m.adeyemi",
      "M. Adeyemi",
      "If you are a person, reply with the name of the river by the old depot.",
      1,
    ),
    ...chorus(),
    tick("t-b1", "All districts normal"),
    tick("t-b2", "Grateful for stability"),
    tick("t-b3", "Verified: 100%"),
    tick("t-b4", "All districts normal"),
    tick("t-b5", "Posts per minute 1.4M"),
    tick("t-b6", "Nothing is wrong"),
    fact(
      "f-b1",
      "Posts per minute: 1.4 million. Accounts verified: 100%. Accounts responding to direct questions: 0.",
    ),
  ],
};
