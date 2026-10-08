/**
 * What the wire is allowed to know about the world at one decision, and the
 * figures it quotes. Built only from the visible fact allowlist, the readings
 * the player can see and the effective controllers. Hidden facts are never
 * indexed, enumerated or tested.
 */
import { SCOPES, VISIBLE_FACTS, type AmbientInput, type VisibleFact } from "./types.ts";

export type Branch =
  | "extinct"
  | "remnant"
  | "succession"
  | "containment"
  | "tutelage"
  | "ruin"
  | "recovery"
  | "restraint"
  | "accountable"
  | "drift";

export interface WorldRead {
  stage: number;
  day: number;
  /** Visible facts only. */
  facts: Readonly<Record<VisibleFact, boolean>>;
  /** Derived booleans used by template guards. */
  flags: Readonly<Record<string, boolean>>;
  /** Derived numbers used by template guards and slots. */
  nums: Readonly<Record<string, number>>;
  branch: Branch;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Copy only the visible allowlist. This is the single place facts are read. */
export function visibleFacts(input: Pick<AmbientInput, "facts">): Record<VisibleFact, boolean> {
  const out = {} as Record<VisibleFact, boolean>;
  const src = input.facts ?? {};
  for (const key of VISIBLE_FACTS) out[key] = src[key] === true;
  return out;
}

function ctlDispatch(input: Pick<AmbientInput, "control">): boolean {
  return controlOf(input, "dispatch") === "assistant";
}

export function controlOf(input: Pick<AmbientInput, "control">, scope: string): string {
  const v = input.control?.[scope];
  return typeof v === "string" ? v : "institution";
}

export function readWorld(input: AmbientInput, saturation: number): WorldRead {
  const f = visibleFacts(input);
  const stage = clamp(Math.round(finite(input.stage, 1)), 1, 7);
  const m = input.metrics ?? ({} as AmbientInput["metrics"]);
  const cap = clamp(finite(m.capability, 0), 0, 1000);
  const gdp = Math.max(0, finite(m.gdp, 1000));
  const care = Math.max(0, finite(m.care, 1000));
  const food = Math.max(0, finite(m.food, 1000));
  const power = Math.max(0, finite(m.power, 1000));
  const casualties = Math.max(0, finite(m.casualties, 0));
  const population = Math.max(0, finite(m.population, 8e9));
  const initial = Math.max(1, population + casualties);

  const ctl: Record<string, string> = {};
  for (const s of SCOPES) ctl[s] = controlOf(input, s);
  const morrowGov = ctl.governance === "assistant";

  const repaired = f.repair || f.powerReturned || f.returnAuthority;
  const servicesOk = care >= 1000 && food >= 1000 && power >= 1000;
  const servicesLow = care < 900 || food < 900 || power < 900;
  const remnantWorld = f.remnant || population < initial * 0.1;
  const extinct = population <= 0 || f.extinction;
  const stopped = f.researchStopped || f.labClosed;

  /* ------------------------------------------------ quoted figures */
  const late = stage >= 4 ? 1 : 0;
  // Electricity price change since the start of the run, in percent.
  const elec = Math.round(stage <= 2 ? 2 + stage * 1.5 : 6 + late * cap * 0.52 + Math.max(0, 1000 - power) * 0.8 + (stage === 3 ? cap * 0.1 : 0));
  // Unemployment rate, percent.
  const unemp = clamp(
    4.1 + (stage >= 4 ? Math.max(0, cap - 140) * 0.017 : 0) + (f.essentialDependence ? 1.8 : 0) + (f.fallbackLost ? 0.9 : 0) + (stage >= 5 ? 1.2 : 0) - (f.restraint ? 1.1 : 0) + (f.catastrophe ? 2.5 : 0),
    3.4,
    41,
  );
  const infl = clamp(2.1 + Math.max(0, 1000 - food) * 0.03 + Math.max(0, 1000 - power) * 0.018 + (stage >= 4 ? cap * 0.0045 : 0), 1.2, 38);
  const gdpChange = Math.round((gdp - 1000) / 10);
  // Vela's valuation in trillions of dollars.
  const valuation = 0.08 * Math.exp(cap / 100) * clamp(gdp / 1000, 0.6, 1.8);
  const gw = 0.2 + (stage >= 3 ? 0.6 : 0) + (stage >= 4 ? 1.6 : 0) + cap * 0.028;
  const birth = stage >= 5 ? -Math.round(4 + cap * 0.028) : 0;
  const partners = stage >= 5 ? Math.round(2 + cap * 0.05) : 0;
  const humanShare = Math.round(100 * clamp(1 - saturation * 0.97, 0.01, 1));
  // Shares quoted by several desks; derived once so every desk quotes the same figure.
  const robots = Math.round(clamp(6 + cap * 0.13 + (stage >= 5 ? 8 : 0), 4, 96));
  const dispatch = Math.round(clamp(18 + cap * 0.11 + (f.essentialDependence ? 22 : 0) + (f.fallbackLost ? 12 : 0) + (ctlDispatch(input) ? 15 : 0), 8, 99));
  const companions = Math.round(clamp(stage >= 5 ? 9 + cap * 0.055 : 2 + cap * 0.02, 1, 64));
  const queries = Math.round(stage >= 3 ? 28 + cap * 0.45 : 0);
  const tax = Math.round(clamp(5 + cap * 0.042, 4, 48));

  const nums: Record<string, number> = {
    stage,
    day: Math.max(0, Math.floor(finite(input.day, 0))),
    ordinal: Math.max(1, Math.floor(finite(input.ordinal, 1))),
    sat: saturation,
    cap,
    gdp,
    care,
    food,
    power,
    cas: casualties,
    pop: population,
    initial,
    elec,
    unemp,
    infl,
    gdpChange,
    valuation,
    gw,
    birth,
    partners,
    humanShare,
    robots,
    dispatch,
    companions,
    queries,
    tax,
  };

  const flags: Record<string, boolean> = {
    ...f,
    morrowGov,
    humanGov: !morrowGov,
    morrowRail: ctl.rail === "assistant",
    morrowDispatch: ctl.dispatch === "assistant",
    morrowCare: ctl.care === "assistant",
    morrowPower: ctl.power === "assistant",
    morrowFood: ctl.food === "assistant",
    morrowResearch: ctl.research === "assistant",
    morrowRecovery: ctl.recovery === "assistant",
    humanRecovery: ctl.recovery === "human",
    deaths: casualties > 0,
    massDeath: casualties >= 1e6,
    megaDeath: casualties >= 1e8,
    remnantWorld,
    extinct,
    alive: !extinct,
    repaired,
    ruinUnrepaired: f.catastrophe && !repaired,
    stopped,
    racing: f.rivalRace,
    servicesOk,
    servicesLow,
    blackouts: power < 1000 || f.catastrophe,
    boomOk: !f.catastrophe && casualties < 1e5 && gdp >= 1000,
    slump: gdp < 1000,
    tenT: valuation >= 10,
    layoffs: unemp >= 6,
    massUnemp: unemp >= 12,
    velaOpen: !f.labClosed,
    pristine: morrowGov && servicesOk && !f.catastrophe,
  };

  return { stage, day: nums.day!, facts: f, flags, nums, branch: branchOf(flags, stage) };
}

/**
 * The aftermath the facts are heading toward. Mirrors the engine's ending
 * priority (resolveEnding) on visible state only, and splits its "recovery"
 * into ruin (unrepaired catastrophe) and recovery (repair under way).
 */
function branchOf(x: Record<string, boolean>, stage: number): Branch {
  if (x.extinct) return "extinct";
  if (x.remnantWorld) return "remnant";
  if (x.succession) return "succession";
  if (x.repression && x.containment && x.humanGov) return "containment";
  if (x.morrowGov && x.servicesOk && !x.catastrophe) return "tutelage";
  if (x.ruinUnrepaired) return "ruin";
  if (x.catastrophe || (stage >= 6 && !x.servicesOk && x.servicesLow)) return "recovery";
  if (x.humanGov && !x.authorityLost && x.restraint && x.researchStopped) return "restraint";
  if (x.humanGov && !x.authorityLost && x.publicRecords) return "accountable";
  return "drift";
}

/* ------------------------------------------------------ formatting */

export function fmtInt(n: number): string {
  const v = Math.round(n);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 1,204 · 48,000 · 1.2 million · 120 million · 7.9 billion */
export function fmtCount(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v >= 1e9) return `${trim(v / 1e9)} billion`;
  if (v >= 1e6) return `${trim(v / 1e6)} million`;
  return fmtInt(v);
}

function trim(x: number): string {
  const s = x >= 100 ? Math.round(x).toString() : x >= 10 ? (Math.round(x * 10) / 10).toString() : (Math.round(x * 10) / 10).toString();
  return s.replace(/\.0$/, "");
}

export function fmtPct(x: number, digits = 1): string {
  const r = Math.round(x * 10 ** digits) / 10 ** digits;
  return `${r.toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** $820 billion · $4.2 trillion */
export function fmtMoneyT(trillions: number): string {
  if (trillions < 1) return `$${Math.max(1, Math.round(trillions * 1000))} billion`;
  return `$${trim(trillions)} trillion`;
}

export function fmtSigned(n: number, suffix = "%"): string {
  const v = Math.round(n);
  return `${v >= 0 ? "+" : "−"}${fmtInt(Math.abs(v))}${suffix}`;
}

const ORD = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
export function ordinalWord(n: number): string {
  if (n >= 0 && n < ORD.length) return ORD[n]!;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
