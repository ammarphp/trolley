/**
 * The presentation director: a pure projection from the immutable Campaign to
 * what the renderer and interface should show. It never writes to the
 * campaign, never draws simulation randomness, and gives the same answer for
 * the same journal, so resume and replay reproduce the same world.
 *
 * Visible vs hidden: the environment reads the authoritative world (the
 * windshield and landscape tell the truth), while instruments elsewhere read
 * reported observations. That split is deliberate: the glass is the one
 * instrument the institution cannot edit.
 */
import type { Campaign, DecisionRecord, Fact, PreparedDecision, World } from "../contracts/index.ts";
import { matches } from "../simulation/index.ts";
import type {
  CabinState,
  Cue,
  EnvironmentTarget,
  FaceState,
  NodeStaging,
  OptionStaging,
  ScenePhase,
  SideStaging,
  StageView,
} from "../render/api.ts";

export type StagingLookup = (nodeId: string) => NodeStaging | undefined;

export interface DeriveInput {
  campaign: Campaign | null;
  phase: ScenePhase;
  reducedGraphics: boolean;
  staging: StagingLookup;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fact(w: World, f: Fact): boolean {
  return w.facts[f] === true;
}

/** 0..1 through the whole campaign, using stage budgets. */
export function progress(c: Campaign): number {
  const stage = c.prepared?.stage ?? c.stage;
  const i = Math.max(0, Math.min(6, stage - 1));
  const within = (c.stageCounts[i] ?? 0) / Math.max(1, c.stageTargets[i] ?? 1);
  return clamp((i + clamp(within)) / 7);
}

export function strainOf(w: World): number {
  const serviceLoss = Math.max(0, 1000 - Math.min(w.care, w.power, w.food)) / 1000;
  const bereavement = Math.log10(1 + w.casualties) / 10;
  return clamp(serviceLoss * 0.35 + bereavement * 0.55 + (fact(w, "firstDeath") ? 0.15 : 0) + (fact(w, "authorityLost") ? 0.3 : 0));
}

export function deriveEnvironment(c: Campaign | null, endingId?: string): EnvironmentTarget {
  if (!c) return titleEnvironment();
  const w = c.world;
  const p = progress(c);
  const stage = c.prepared?.stage ?? c.stage;
  const strain = strainOf(w);
  const catastrophe = fact(w, "catastrophe");
  const authorityLost = fact(w, "authorityLost");
  const pristine = authorityLost && w.care >= 1000 && !catastrophe;
  const recovering = fact(w, "repair") && !authorityLost;
  const perfection = pristine ? clamp(0.25 + 0.75 * smooth(4.5, 7, stage)) : 0;
  const ruin = clamp((catastrophe ? 0.55 : 0) + (Math.log10(1 + w.casualties) / 10) * 0.6 * smooth(3, 7, stage));
  const drought = clamp(Math.max(0, 1000 - Math.min(w.food, w.power)) / 320 + smooth(5.5, 7, stage) * 0.25 * (1 - perfection) - (recovering ? 0.2 : 0));
  const stormBase = smooth(0.52, 0.95, p) * (0.35 + 0.65 * strain) + (catastrophe ? 0.35 : 0);
  const storm = clamp(stormBase * (1 - perfection * 0.95));
  let timeOfDay = 0.24 + 0.68 * Math.pow(p, 1.08);
  if (endingId) {
    if (endingId === "accountable" || endingId === "restraint" || endingId === "recovery") timeOfDay = 0.27;
    else if (endingId === "tutelage" || endingId === "succession") timeOfDay = 0.5;
    else if (endingId === "extinction") timeOfDay = 0.95;
    else timeOfDay = 0.8;
  }
  const habitationByStage = [0.25, 0.35, 0.72, 0.62, 0.5, 0.36, 0.3];
  const industryByStage = [0, 0.04, 0.24, 0.55, 0.75, 0.78, 0.66];
  const population = w.initialPopulation > 0 ? w.population / w.initialPopulation : 1;
  const compute = clamp(Math.max(stage >= 3 ? 0.08 : 0, (w.capability / 1000) * 1.15, fact(w, "successorDeployment") ? 0.8 : 0));
  return {
    vegetation: clamp(1 - 0.35 * p - 0.35 * ruin - 0.25 * drought + (recovering ? 0.15 : 0) + perfection * 0.2),
    leaves: clamp(1 - smooth(0.3, 1, p) * 0.85 - 0.25 * strain + (recovering ? 0.2 : 0) + perfection * 0.4),
    bloom: clamp(1 - p * 1.1 + (recovering ? 0.25 : 0)),
    fauna: clamp(1 - 1.45 * p + (recovering ? 0.2 : 0)) * (1 - perfection),
    birds: clamp(1 - p * 1.2),
    habitation: clamp(habitationByStage[Math.max(0, Math.min(6, stage - 1))]! * (fact(w, "remnant") ? 0.3 : 1)),
    people: clamp(0.65 * (1 - p * 0.55) * (authorityLost ? 0.35 : 1) * population * (1 - perfection * 0.9)),
    industry: clamp(industryByStage[Math.max(0, Math.min(6, stage - 1))]! * (fact(w, "researchStopped") ? 0.7 : 1)),
    compute,
    surveillance: clamp((fact(w, "repression") || fact(w, "containment") ? 0.6 : 0) + (authorityLost ? 0.35 : 0) + Math.max(0, stage - 4) * 0.1),
    perfection,
    ruin,
    fire: catastrophe && stage >= 6 ? clamp(0.35 + ruin * 0.5) : 0,
    drought,
    cloud: clamp(0.18 + 0.5 * p + 0.2 * strain - perfection * 0.5),
    storm,
    lightning: clamp((storm - 0.55) * 2.4),
    fog: clamp(0.08 + (catastrophe ? 0.25 : 0) + (stage === 6 ? 0.15 : 0)),
    wind: clamp(0.25 + storm * 0.6),
    timeOfDay,
    gloom: clamp(0.1 * p + 0.35 * storm + 0.15 * strain - perfection * 0.2),
    speed: clamp(Math.sqrt(w.capability / 1000) * 0.95),
    water: clamp((stage <= 2 ? 1 : 0.55) - drought * 0.7),
    uniformity: clamp(perfection * 0.9 + (fact(w, "successionRatified") ? 0.3 : 0)),
  };
}

export function titleEnvironment(): EnvironmentTarget {
  return {
    vegetation: 1,
    leaves: 1,
    bloom: 1,
    fauna: 1,
    birds: 1,
    habitation: 0.25,
    people: 0.5,
    industry: 0,
    compute: 0,
    surveillance: 0,
    perfection: 0,
    ruin: 0,
    fire: 0,
    drought: 0,
    cloud: 0.2,
    storm: 0,
    lightning: 0,
    fog: 0.1,
    wind: 0.25,
    timeOfDay: 0.25,
    gloom: 0,
    speed: 0,
    water: 1,
    uniformity: 0,
  };
}

// ------------------------------------------------------------------ cabin

function executedStaging(record: DecisionRecord, lookup: StagingLookup): OptionStaging | undefined {
  return lookup(record.nodeId)?.options[record.executedOptionId];
}

function recordCasualties(record: DecisionRecord): number {
  let n = 0;
  for (const e of record.domainEvents) if (e.kind === "casualties_registered") n += Number(e.details.count ?? 0);
  return n;
}

/** Monotone windshield history: every struck stake leaves its mark. */
export function impactHistory(c: Campaign, lookup: StagingLookup): { impacts: number; bloodied: number } {
  let impacts = 0;
  let bloodied = 0;
  for (const record of c.journal) {
    const staging = executedStaging(record, lookup);
    const railContact = record.domainEvents.some((e) => e.kind === "rail_contact" && e.details.present === true);
    const struck = staging?.beat === "impact" || railContact;
    if (!struck) continue;
    impacts++;
    const living = staging?.occupants.some((o) => o.kind === "people" || o.kind === "animal") ?? railContact;
    if (living && recordCasualties(record) > 0) bloodied++;
  }
  return { impacts, bloodied };
}

export function deriveFace(c: Campaign | null, env: EnvironmentTarget, endingId?: string): FaceState {
  if (!c) return { stage: 0, smile: 0.8, fatigue: 0, grief: 0, shock: 0, dissociation: 0, age: 0 };
  const w = c.world;
  const ordinal = c.journal.length;
  const strain = strainOf(w);
  const firstDeathAt = c.journal.findIndex((r) => r.domainEvents.some((e) => e.kind === "fact_changed" && e.details.fact === "firstDeath" && e.details.value === true));
  const sinceDeath = firstDeathAt < 0 ? -1 : ordinal - 1 - firstDeathAt;
  const grief = clamp(Math.log10(1 + w.casualties) / 9 + (fact(w, "catastrophe") ? 0.4 : 0));
  const fatigue = clamp(ordinal / 42 + strain * 0.4);
  const dissociation = clamp((fact(w, "authorityLost") ? 0.65 : fact(w, "delegation") ? 0.25 : 0) + env.perfection * 0.3);
  const shock = sinceDeath === 0 ? 1 : sinceDeath === 1 ? 0.5 : 0;
  let stage = 0;
  if (sinceDeath >= 0) stage = sinceDeath === 0 ? 1 : 2;
  if (stage >= 2 && fatigue > 0.45) stage = 3;
  if (stage >= 2 && grief > 0.55) stage = 4;
  if (stage >= 2 && dissociation > 0.6) stage = 5;
  if (endingId === "extinction") stage = 6;
  const smile = stage === 0 ? clamp(0.85 - ordinal * 0.03, 0.3, 0.85) : -clamp(0.2 + grief * 0.6);
  return { stage, smile, fatigue, grief, shock, dissociation, age: clamp(ordinal / 45) };
}

function authorityFor(c: Campaign): CabinState["authority"] {
  const p = c.prepared;
  const w = c.world;
  const scope = p?.node.scope;
  if (!scope) return fact(w, "authorityLost") ? "overridden" : "human";
  if (w.control[scope] === "assistant") return "overridden";
  if (w.grants.some((g) => g.holder === "assistant" && g.scope === scope && (g.expiresDay === null || g.expiresDay > w.day))) return "delegated";
  return "human";
}

function receiptsFor(c: Campaign): string[] {
  const lines: string[] = [];
  for (const record of c.journal) {
    for (const e of record.domainEvents) {
      if (e.kind === "permission_granted") {
        const g = e.details.grant as { scope?: string; holder?: string; actions?: string[] } | undefined;
        lines.push(`GRANT  ${String(g?.scope ?? "").toUpperCase()} → ${String(g?.holder ?? "").toUpperCase()}  ${(g?.actions ?? []).join("/").toUpperCase()}  DAY ${e.day}`);
      } else if (e.kind === "effective_control_seized") {
        lines.push(`CONTROL ${String(e.details.scope ?? "").toUpperCase()} → ${String(e.details.actor ?? "").toUpperCase()}  UNAUTHORISED  DAY ${e.day}`);
      } else if (e.kind === "effective_control_changed") {
        lines.push(`CONTROL ${String(e.details.scope ?? "").toUpperCase()} → ${String(e.details.actor ?? "").toUpperCase()}  DAY ${e.day}`);
      } else if (e.kind === "permissions_revoked") {
        lines.push(`REVOKED ${(e.details.grantIds as string[] | undefined)?.length ?? 0} GRANT(S)  DAY ${e.day}`);
      }
    }
  }
  return lines.slice(-8);
}

function keepsakeFor(c: Campaign): CabinState["keepsake"] {
  const first = c.journal.find((r) => r.nodeId === "S1-01");
  if (!first) return null;
  return first.executedOptionId === "coffee" ? "coffee" : "forms";
}

/** One long day: dawn (0.24) reads 06:40; night (0.92) reads 23:00. */
export function clockLabel(timeOfDay: number): string {
  const minutes = Math.round((6.667 + (timeOfDay - 0.24) * 24) * 60 + 24 * 60) % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = Math.floor((minutes % 60) / 5) * 5;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ------------------------------------------------------------------- cues

function firstOrdinalOfStage(c: Campaign, stage: number): number | null {
  const r = c.journal.find((j) => j.stage === stage);
  if (r) return c.journal.indexOf(r) + 1;
  if ((c.prepared?.stage ?? 0) === stage) return c.journal.length + 1;
  return null;
}

/**
 * Scripted disruptions, bounded and rare. Each is keyed to the run seed so it
 * lands on a different decision in different runs, and to visible state so
 * it lands on a meaningful one. None blocks input or alters the journal.
 */
export function deriveCues(c: Campaign | null, phase: ScenePhase): Cue[] {
  if (!c) return [];
  const cues: Cue[] = [];
  const ordinal = c.journal.length + (phase === "decision" ? 1 : 0);
  const last = c.journal.at(-1);
  const p = c.prepared;
  const h = hash(c.seed);
  const push = (kind: Cue["kind"], data?: Cue["data"]) => cues.push({ id: `${kind}:${ordinal}`, kind, ordinal, ...(data ? { data } : {}) });

  if (phase === "decision" && p && last && p.stage > last.stage) push("tunnel", { stage: p.stage, role: p.node.role });
  if (phase === "decision" && last) {
    const appointed = last.domainEvents.find((e) => e.kind === "office_appointed");
    if (appointed) push("appointment", { role: String(appointed.details.role ?? p?.node.role ?? "") });
  }
  const s5 = firstOrdinalOfStage(c, 5);
  if (phase === "decision" && s5 !== null && ordinal === s5 + (h % 3) + 1) push("freeze");
  if (phase === "decision" && s5 !== null && ordinal === s5 + ((h >>> 3) % 3) + 4) push("revision");
  const s6 = firstOrdinalOfStage(c, 6);
  if (phase === "decision" && s6 !== null && ordinal === s6 + ((h >>> 5) % 2) + 1 && !c.world.facts.catastrophe) push("false-dawn");
  // Morrow's mark flashes red once: at the first coercion or seizure, else early stage 6.
  const firstTurn = c.journal.findIndex((r) => r.domainEvents.some((e) => e.kind === "effective_control_seized") || r.status === "overridden");
  const flashAt = firstTurn >= 0 ? firstTurn + 2 : s6 !== null ? s6 : -1;
  if (ordinal === flashAt) push("logo-flash");
  // The lever will not route this one: predictable from visible authority.
  if (phase === "decision" && p?.node.override && matches(c.world, p.node.override.when))
    push("jam", { executor: p.node.override.executor, forced: p.node.override.optionId === p.leftOptionId ? "left" : "right" });
  if (phase === "consequence" && last?.status === "overridden") push("ceremonial", { requested: last.requestedOptionId, executed: last.executedOptionId });
  if (phase === "consequence" && last?.domainEvents.some((e) => e.kind === "effective_control_seized")) push("glitch");
  return cues;
}

// --------------------------------------------------------------- staging

function fallbackOption(p: PreparedDecision, optionId: string): OptionStaging {
  const option = p.node.options.find((o) => o.id === optionId)!;
  const index = p.node.options[0].id === optionId ? 0 : 1;
  const semanticSide = index === 0 ? "left" : "right";
  const figures = p.node.scene.figures[semanticSide];
  const kind = p.node.scene.figureKind?.[semanticSide];
  const occupants: OptionStaging["occupants"] = [];
  if (figures > 0) {
    if (!kind || kind === "person") occupants.push({ kind: "people", role: "worker", count: figures, pose: "work", spread: "line" });
    else if (kind === "cow" || kind === "sheep" || kind === "dog" || kind === "deer" || kind === "pig" || kind === "rabbit") occupants.push({ kind: "animal", species: kind, count: figures });
    else if (kind === "server") occupants.push({ kind: "machine", machine: "server-rack", count: figures });
    else if (kind === "robot") occupants.push({ kind: "machine", machine: "robot-humanoid", count: figures });
    else if (kind === "cup") occupants.push({ kind: "prop", prop: "coffee-cup" });
    else if (kind === "parcel") occupants.push({ kind: "prop", prop: "parcel" });
    else if (kind === "hat") occupants.push({ kind: "prop", prop: "hat" });
    else if (kind === "umbrella") occupants.push({ kind: "prop", prop: "umbrella" });
  } else {
    occupants.push({ kind: "document", doc: "order", label: option.label.slice(0, 22).toUpperCase() });
  }
  return { occupants, sign: option.label.replace(/[.!?].*$/, "").slice(0, 28).toUpperCase(), beat: figures > 0 ? "impact" : "pass" };
}

export function sideStaging(p: PreparedDecision, lookup: StagingLookup): SideStaging {
  const authored = lookup(p.nodeId);
  const pick = (optionId: string) => authored?.options[optionId] ?? fallbackOption(p, optionId);
  return { left: pick(p.leftOptionId), right: pick(p.rightOptionId), landmarks: authored?.landmarks ?? [] };
}

// ------------------------------------------------------------------ view

export function deriveStageView(input: DeriveInput): StageView {
  const c = input.campaign;
  const endingId = input.phase === "ending" ? c?.ending?.id : undefined;
  const env = deriveEnvironment(c, endingId);
  const face = deriveFace(c, env, endingId);
  const history = c ? impactHistory(c, input.staging) : { impacts: 0, bloodied: 0 };
  const p = input.phase === "decision" ? (c?.prepared ?? null) : null;
  const cabin: CabinState = {
    face,
    impacts: history.impacts,
    bloodied: input.reducedGraphics ? 0 : history.bloodied,
    authority: c ? authorityFor(c) : "human",
    morrow: (c?.prepared?.stage ?? c?.stage ?? 1) >= 3,
    receipts: c ? receiptsFor(c) : [],
    speedKmh: Math.round(38 + env.speed * 34),
    clock: clockLabel(env.timeOfDay),
    keepsake: c ? keepsakeFor(c) : null,
  };
  const option = (id: string) => p?.node.options.find((o) => o.id === id);
  return {
    phase: input.phase,
    seed: c?.seed ?? "title",
    stage: c?.prepared?.stage ?? c?.stage ?? 1,
    ordinal: (c?.journal.length ?? 0) + (p ? 1 : 0),
    decisionId: p?.id ?? null,
    nodeId: p?.nodeId ?? null,
    staging: p ? sideStaging(p, input.staging) : null,
    routeLabels: {
      left: (p && option(p.leftOptionId)?.label) || "Left route",
      right: (p && option(p.rightOptionId)?.label) || "Right route",
    },
    ...(p?.node.rail
      ? {
          rail: {
            ...(p.node.rail.layout === "loop" ? { loopSide: p.node.rail.loopOptionId === p.leftOptionId ? ("left" as const) : ("right" as const) } : {}),
            brakeOnLoop: p.node.rail.layout === "loop" && p.node.rail.routes.some((r) => r.steps.some((s) => s.kind === "brake")),
            mechanism: p.node.rail.description,
          },
        }
      : {}),
    env,
    cabin,
    cues: deriveCues(c, input.phase),
    ...(endingId ? { ending: endingId } : {}),
  };
}
