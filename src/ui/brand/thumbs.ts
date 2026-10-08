/**
 * thumbnailFor(topic, seed): small pen-and-ink news plates for the wire.
 *
 * Every plate is a 160 x 100 line drawing: paper, ink contours, hatching
 * from the light, and at most one pigment where it means something (a
 * server lamp, a fire, Morrow's cobalt, a falling market's red arrow).
 * Topics are normalised through a generous alias table, so desk labels like
 * "economy", "datacenter" or "unrest" land on a sensible plate.
 */
import { createRng } from "../../render/core/rng.ts";
import { Pen } from "./pen.ts";
import { PAPER } from "./palette.ts";
import { el, svgDoc } from "./svg.ts";
import { PH, PW } from "./kit.ts";
import { city, dataCentre, grid, morrowBillboard, nuclear, protest, rail, storm, type Plate } from "./thumbs-a.ts";
import { ballot, concert, courthouse, factory, hospital, memorial, parliament, pram, press, queue, resignation, treaty } from "./thumbs-b.ts";
import { chartDown, chartUp, chip, cyber, drone, drought, fire, flood, lab, medicine, missile, money, orchard, physics, robots, satellite, swarm, ticker } from "./thumbs-c.ts";

export type ThumbTopic =
  | "data-centre"
  | "protest"
  | "city"
  | "grid"
  | "storm"
  | "rail"
  | "nuclear"
  | "morrow"
  | "parliament"
  | "courthouse"
  | "press-conference"
  | "treaty"
  | "ballot"
  | "unemployment-queue"
  | "concert-vr"
  | "memorial"
  | "birth-rate"
  | "resignation"
  | "hospital"
  | "factory"
  | "chart-up"
  | "chart-down"
  | "stock-ticker"
  | "ai-chip"
  | "satellite"
  | "drone"
  | "drone-swarm"
  | "robot"
  | "missile"
  | "lab"
  | "medicine"
  | "physics"
  | "cyber"
  | "flood"
  | "fire"
  | "drought"
  | "orchard"
  | "money";

const PLATES: Record<ThumbTopic, Plate> = {
  "data-centre": dataCentre,
  protest,
  city,
  grid,
  storm,
  rail,
  nuclear,
  morrow: morrowBillboard,
  parliament,
  courthouse,
  "press-conference": press,
  treaty,
  ballot,
  "unemployment-queue": queue,
  "concert-vr": concert,
  memorial,
  "birth-rate": pram,
  resignation,
  hospital,
  factory,
  "chart-up": chartUp,
  "chart-down": chartDown,
  "stock-ticker": ticker,
  "ai-chip": chip,
  satellite,
  drone,
  "drone-swarm": swarm,
  robot: robots,
  missile,
  lab,
  medicine,
  physics,
  cyber,
  flood,
  fire,
  drought,
  orchard,
  money,
};

export const THUMB_TOPICS: readonly ThumbTopic[] = Object.keys(PLATES) as ThumbTopic[];

const ALIASES: Record<string, ThumbTopic> = {
  // compute and industry
  datacenter: "data-centre",
  "data-center": "data-centre",
  datacentre: "data-centre",
  compute: "data-centre",
  campus: "data-centre",
  "server-farm": "data-centre",
  industry: "factory",
  manufacturing: "factory",
  smelter: "factory",
  jobs: "unemployment-queue",
  unemployment: "unemployment-queue",
  labor: "unemployment-queue",
  labour: "unemployment-queue",
  layoffs: "unemployment-queue",
  queue: "unemployment-queue",
  work: "unemployment-queue",
  chip: "ai-chip",
  chips: "ai-chip",
  semiconductor: "ai-chip",
  gpu: "ai-chip",
  hardware: "ai-chip",
  fab: "ai-chip",
  // civic
  unrest: "protest",
  march: "protest",
  strike: "protest",
  riot: "protest",
  civic: "protest",
  election: "ballot",
  elections: "ballot",
  vote: "ballot",
  voting: "ballot",
  "senate-race": "ballot",
  poll: "ballot",
  politics: "parliament",
  senate: "parliament",
  legislature: "parliament",
  government: "parliament",
  nationalization: "parliament",
  nationalisation: "parliament",
  regulation: "parliament",
  moratorium: "parliament",
  court: "courthouse",
  law: "courthouse",
  ruling: "courthouse",
  lawsuit: "courthouse",
  trial: "courthouse",
  statement: "press-conference",
  press: "press-conference",
  announcement: "press-conference",
  agi: "press-conference",
  ceo: "press-conference",
  keynote: "press-conference",
  handshake: "treaty",
  partnership: "treaty",
  deal: "treaty",
  merger: "treaty",
  accord: "treaty",
  diplomacy: "treaty",
  geopolitics: "treaty",
  summit: "treaty",
  // markets
  markets: "chart-up",
  economy: "chart-up",
  growth: "chart-up",
  ipo: "chart-up",
  valuation: "chart-up",
  "market-cap": "chart-up",
  rally: "chart-up",
  crash: "chart-down",
  recession: "chart-down",
  inflation: "chart-down",
  prices: "chart-down",
  "electricity-prices": "chart-down",
  selloff: "chart-down",
  stocks: "stock-ticker",
  ticker: "stock-ticker",
  "stock-market": "stock-ticker",
  trading: "stock-ticker",
  finance: "money",
  vc: "money",
  investment: "money",
  funding: "money",
  "circular-financing": "money",
  // city and infrastructure
  skyline: "city",
  urban: "city",
  power: "grid",
  energy: "grid",
  electricity: "grid",
  pylons: "grid",
  blackout: "grid",
  brownout: "grid",
  substation: "grid",
  reactor: "nuclear",
  "power-station": "nuclear",
  "nuclear-power": "nuclear",
  trolley: "rail",
  transport: "rail",
  train: "rail",
  railway: "rail",
  "common-rail": "rail",
  // health and science
  health: "hospital",
  clinic: "hospital",
  care: "hospital",
  ambulance: "hospital",
  "cancer-cure": "medicine",
  cancer: "medicine",
  cure: "medicine",
  drug: "medicine",
  biotech: "medicine",
  vaccine: "medicine",
  research: "lab",
  science: "lab",
  chemistry: "lab",
  "lab-leak": "lab",
  graviton: "physics",
  "physics-breakthrough": "physics",
  particle: "physics",
  space: "satellite",
  orbit: "satellite",
  // security
  military: "missile",
  war: "missile",
  weapons: "missile",
  defence: "missile",
  defense: "missile",
  drones: "drone",
  surveillance: "drone",
  swarm: "drone-swarm",
  "ai-swarm": "drone-swarm",
  swarms: "drone-swarm",
  robots: "robot",
  "robot-fleet": "robot",
  murderbots: "robot",
  automation: "robot",
  cybersecurity: "cyber",
  hack: "cyber",
  breach: "cyber",
  "cyber-attack": "cyber",
  // weather and land
  weather: "storm",
  lightning: "storm",
  hurricane: "storm",
  climate: "flood",
  rain: "flood",
  "sea-level": "flood",
  wildfire: "fire",
  fires: "fire",
  heat: "drought",
  "heat-wave": "drought",
  water: "drought",
  rationing: "drought",
  agriculture: "orchard",
  farm: "orchard",
  farming: "orchard",
  food: "orchard",
  harvest: "orchard",
  // society
  "birth-rates": "birth-rate",
  births: "birth-rate",
  family: "birth-rate",
  "ai-partners": "birth-rate",
  demographics: "birth-rate",
  concert: "concert-vr",
  vr: "concert-vr",
  "virtual-reality": "concert-vr",
  culture: "concert-vr",
  entertainment: "concert-vr",
  "digital-concert": "concert-vr",
  resignations: "resignation",
  "mass-resignation": "resignation",
  quits: "resignation",
  whistleblower: "resignation",
  obituary: "memorial",
  death: "memorial",
  vigil: "memorial",
  mourning: "memorial",
  // the wire's own desk labels
  security: "drone",
  disaster: "flood",
  general: "city",
  baby: "birth-rate",
  babies: "birth-rate",
  pram: "birth-rate",
  murderbot: "robot",
  humanoid: "robot",
  rocket: "missile",
  missiles: "missile",
  "space-launch": "missile",
  // the assistant
  assistant: "morrow",
  vela: "morrow",
  ai: "morrow",
  model: "morrow",
  launch: "morrow",
};

export function thumbTopic(topic: string): ThumbTopic {
  const key = topic.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if ((THUMB_TOPICS as readonly string[]).includes(key)) return key as ThumbTopic;
  return ALIASES[key] ?? ALIASES[key.replace(/s$/, "")] ?? "press-conference";
}

export interface ThumbnailOptions {
  /** Rendered width in px (height follows 16:10). Default 160. */
  width?: number;
  /** Override height (the plate is cropped with xMidYMid slice). */
  height?: number;
  title?: string;
}

/** A line-art news thumbnail for a topic family, varied by seed. */
export function thumbnailFor(topic: string, seed: string | number = 0, options: ThumbnailOptions = {}): string {
  const key = thumbTopic(topic);
  const rng = createRng(`thumb:${key}:${seed}`);
  const pen = new Pen(rng);
  const variant = rng.int(0, 1);
  pen.raw(el("rect", { x: 0, y: 0, width: PW, height: PH, fill: PAPER }));
  PLATES[key](pen, rng, variant);
  const width = options.width ?? PW;
  const height = options.height ?? (width * PH) / PW;
  // Plates never need sub-0.1-unit precision (0.2 px at double size).
  const body = pen.toString().replace(/-?\d+\.\d{2,}/g, (m) => String(Math.round(Number(m) * 10) / 10));
  return svgDoc(body, {
    viewBox: [0, 0, PW, PH],
    width,
    height,
    title: options.title,
    className: "brand-thumb",
    preserveAspectRatio: "xMidYMid slice",
    extra: { "data-topic": key },
  });
}
