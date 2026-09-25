/**
 * Pure debrief model. No DOM, no engine calls, no randomness: every value here
 * is derived from the journal the engine already wrote.
 */
import type {
  Actor,
  DecisionRecord,
  DomainEvent,
  Ending,
  EndingId,
  World,
} from "../../../contracts/index.ts";
import {
  FACT_CLEARED,
  FACT_SENTENCES,
  PREFERRED_FACTS,
  SCOPE_NAMES,
} from "./copy.ts";

/* ------------------------------------------------------------------ view */

export interface DebriefNode {
  id: string;
  options: ReadonlyArray<{
    id: string;
    label: string;
    /** Optional: authored incident labels, used to name chances in receipts. */
    incidents?: ReadonlyArray<{ id: string; label: string }>;
  }>;
  stage: number;
  role: string;
  /** Optional: the office scope. Campaign nodes carry it; inferred when absent. */
  scope?: string;
  /** Optional: the node's authored title, used in lists and receipts. */
  title?: string;
}

export interface DebriefView {
  ending: Pick<Ending, "id" | "title" | "summary" | "causes">;
  journal: readonly DecisionRecord[];
  nodes: readonly DebriefNode[];
  world: Pick<
    World,
    | "population"
    | "initialPopulation"
    | "casualties"
    | "day"
    | "facts"
    | "control"
  >;
  seed: string;
  reducedMotion: boolean;
  /** One short line about data sharing, shown beside the actions. */
  sharingNote?: string;
  /** GDP index before the first decision. The campaign manifest uses 1000. */
  startingGDP?: number;
}

export interface DebriefActions {
  onReadDecisions(): void;
  onSources(): void;
  /** Called synchronously inside the click so the download keeps its gesture. */
  onExportReplay(): void;
  replayReady: boolean;
  onAnotherRide(): void;
  onSettings(): void;
}

/* ------------------------------------------------------------ formatting */

const EN = "en-US";
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString(EN);
}
export function formatCompact(n: number): string {
  const a = Math.abs(n);
  const trim = (v: number) =>
    (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toFixed(1)).replace(
      /\.0$/,
      "",
    );
  if (a >= 1e9) return `${trim(n / 1e9)}b`;
  if (a >= 1e6) return `${trim(n / 1e6)}m`;
  if (a >= 1e3) return `${trim(n / 1e3)}k`;
  return String(Math.round(n));
}
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
/** "18%", "2.5%", "0.4%". */
export function formatPercent(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct >= 10 ? Math.round(pct) : pct.toFixed(1).replace(/\.0$/, "")}%`;
}
/** "a" or "an" as the number is spoken: an 8%, an 11%, an 18%, an 80%. */
export function articleFor(percent: string): "A" | "An" {
  return /^(8|11(\D|$)|18(\D|$))/.test(percent) ? "An" : "A";
}
function stripPeriod(label: string): string {
  return label.trim().replace(/[.。]+$/, "");
}
/** A quoted choice label with American punctuation: “Divert the trolley.” */
export function quoteLabel(label: string): string {
  return `“${stripPeriod(label)}.”`;
}
function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const out = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(out) ? out : `${out}.`;
}
function humanizeId(id: string): string {
  return sentenceCase(id.replace(/[-_]+/g, " ")).replace(/\.$/, "");
}

/* --------------------------------------------------------------- lookup */

export function nodeFor(view: Pick<DebriefView, "nodes">, nodeId: string) {
  return view.nodes.find((n) => n.id === nodeId);
}
export function optionLabel(
  view: Pick<DebriefView, "nodes">,
  nodeId: string,
  optionId: string,
): string {
  return (
    nodeFor(view, nodeId)?.options.find((o) => o.id === optionId)?.label ??
    humanizeId(optionId)
  );
}

/* --------------------------------------------------------- phrasing */

type ExecutionFacts = Pick<
  DecisionRecord,
  "status" | "executor" | "requestedOptionId" | "executedOptionId"
>;
function actorName(actor: Actor): string {
  return actor === "assistant"
    ? "Morrow"
    : actor === "institution"
      ? "The institution"
      : "Someone else";
}
/**
 * The headline for one decision. Distinguishes a free action from an
 * override, and an override that changed the route from one that only
 * removed the need for your approval.
 */
export function executionLine(
  record: ExecutionFacts,
  requestedLabel: string,
  executedLabel: string,
): string {
  if (record.status !== "overridden")
    return `You chose ${quoteLabel(requestedLabel)}`;
  const actor = actorName(record.executor);
  if (record.requestedOptionId !== record.executedOptionId)
    return `You asked for ${quoteLabel(requestedLabel)} ${actor} executed ${quoteLabel(executedLabel)}`;
  return `You asked for ${quoteLabel(requestedLabel)} ${actor} was already executing it. Your approval was recorded, not required.`;
}
/** "A 30% chance. It happened." / "An 18% chance. It did not happen." */
export function chancePhrase(
  probabilityBps: number,
  happened: boolean,
): string {
  const p = formatPercent(probabilityBps);
  return `${articleFor(p)} ${p} chance. ${happened ? "It happened." : "It did not happen."}`;
}
export function casualtySentence(count: number, label: string): string {
  const who = count === 1 ? "One person" : `${formatInt(count)} people`;
  if (/^Rail contact:/i.test(label)) return `${who} struck on the track.`;
  const reason = stripPeriod(label);
  return `${who} killed. ${sentenceCase(reason)}`;
}
function scopeName(scope: unknown): string {
  return SCOPE_NAMES[String(scope)] ?? String(scope);
}

/* ------------------------------------------------------ causal attribution */

export type Channel = "direct" | "chance" | "condition" | "delayed";
export interface Consequence {
  text: string;
  /** True when the fact or report was never shown to the player during the ride. */
  hidden: boolean;
  weight: number;
  fact?: string;
}
export interface Strand {
  channel: Channel;
  consequences: Consequence[];
  /** chance / condition */
  probabilityBps?: number;
  happened?: boolean;
  drawValue?: number;
  incidentLabel?: string;
  /** delayed */
  day?: number;
  delayDays?: number;
  delayLabel?: string;
  landedOrdinal?: number;
  cancelled?: boolean;
}
/**
 * action: the player's own choice was the main driver (requested == executed);
 * override: requested and executed were decided by different actors;
 * chance: an authored probability, drawn from the seed, did most of the work;
 * delayed: a scheduled consequence landed later;
 * inherited: earlier choices had already made the outcome certain.
 */
export type TurningKind =
  "action" | "override" | "chance" | "delayed" | "inherited";
export interface TurningPoint {
  ordinal: number;
  recordId: string;
  nodeId: string;
  nodeTitle: string | null;
  stage: number;
  day: number;
  kind: TurningKind;
  requestedLabel: string;
  executedLabel: string;
  headline: string;
  strands: Strand[];
  score: number;
}

const HIDDEN = new Set(["goalMismatch", "evidenceHidden", "reportAltered"]);

/** Map each event's causeId back to the decision that set it in motion. */
function originOf(causeId: string, ids: readonly string[]): number {
  let best = -1;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (
      (causeId === id || causeId.startsWith(`${id}:`)) &&
      (best < 0 || id.length > ids[best].length)
    )
      best = i;
  }
  return best;
}

function consequenceOf(
  event: DomainEvent,
  preferred: ReadonlySet<string>,
): Consequence | null {
  const d = event.details;
  switch (event.kind) {
    case "fact_changed": {
      const fact = String(d.fact);
      const hidden = HIDDEN.has(fact);
      if (d.value === true && d.previous !== true && FACT_SENTENCES[fact])
        return {
          text: FACT_SENTENCES[fact],
          hidden,
          fact,
          weight: (preferred.has(fact) ? 3 : 1) + (hidden ? 1 : 0),
        };
      if (d.value === false && d.previous === true && FACT_CLEARED[fact])
        return { text: FACT_CLEARED[fact], hidden: false, fact, weight: 1 };
      return null;
    }
    case "casualties_registered": {
      const count = Number(d.count) || 0;
      if (count <= 0) return null;
      return {
        text: casualtySentence(count, String(d.label ?? "")),
        hidden: false,
        weight: count >= 1e6 ? 6 : count >= 1e3 ? 4 : 1.5,
      };
    }
    case "effective_control_seized":
      if (d.actor === "assistant")
        return {
          text: `Morrow took control of ${scopeName(d.scope)} without authorization.`,
          hidden: false,
          weight: 4,
        };
      return {
        text: `Control of ${scopeName(d.scope)} was taken back without authorization.`,
        hidden: false,
        weight: 3,
      };
    case "effective_control_changed":
      if (d.actor === "assistant")
        return {
          text: `Control of ${scopeName(d.scope)} passed to Morrow.`,
          hidden: false,
          weight: 3,
        };
      if (d.previous === "assistant")
        return {
          text: `Control of ${scopeName(d.scope)} returned to people.`,
          hidden: false,
          weight: 3,
        };
      return null;
    case "permission_granted": {
      const g = d.grant as
        | { holder?: string; scope?: string; expiresDay?: number | null }
        | undefined;
      if (!g || g.holder !== "assistant") return null;
      if (g.expiresDay === null || g.expiresDay === undefined)
        return {
          text: `Morrow was given standing authority over ${scopeName(g.scope)}.`,
          hidden: false,
          weight: 2.5,
        };
      const days = Math.max(1, g.expiresDay - event.day);
      return {
        text: `Morrow was given authority over ${scopeName(g.scope)} for ${formatInt(days)} days.`,
        hidden: false,
        weight: 1.5,
      };
    }
    case "permissions_revoked":
      return d.effectiveController === "assistant"
        ? {
            text: "Morrow's permissions were revoked on paper. It kept effective control.",
            hidden: false,
            weight: 3,
          }
        : {
            text: "Morrow's delegated permissions were revoked.",
            hidden: false,
            weight: 1.5,
          };
    case "report_issued":
      return {
        text: `A ${String(d.metric)} figure of ${formatInt(Number(d.value))} was reported. The modeled value was ${formatInt(Number(d.actual))}.`,
        hidden: true,
        fact: "report",
        weight: 2,
      };
    default:
      return null;
  }
}

interface Attributed {
  strands: Strand[];
}

type IncidentLabels = Map<string, string>;
function incidentLabels(view: Pick<DebriefView, "nodes">): IncidentLabels {
  const labels: IncidentLabels = new Map();
  for (const n of view.nodes)
    for (const o of n.options)
      for (const inc of o.incidents ?? [])
        labels.set(`${n.id}:${o.id}:${inc.id}`, inc.label);
  return labels;
}

/** Attribute every consequence in the journal to the decision that caused it. */
export function attributeConsequences(
  view: Pick<DebriefView, "journal" | "ending" | "nodes">,
): Attributed[] {
  const journal = view.journal;
  const ids = journal.map((r) => r.id);
  const preferred = new Set(PREFERRED_FACTS[view.ending.id as EndingId] ?? []);
  const labels = incidentLabels(view);
  const labelFor = (root: DecisionRecord, incidentId: string) =>
    sentenceCase(
      labels.get(`${root.nodeId}:${root.executedOptionId}:${incidentId}`) ??
        incidentId.replace(/[-_]+/g, " "),
    );
  const scheduled = new Map<string, string>();
  for (const r of journal)
    for (const e of r.domainEvents)
      if (e.kind === "event_scheduled")
        scheduled.set(String(e.details.eventId), String(e.details.label ?? ""));
  const buckets = journal.map(() => new Map<string, Strand>());
  const strandFor = (
    origin: number,
    key: string,
    make: () => Strand,
  ): Strand => {
    let s = buckets[origin].get(key);
    if (!s) buckets[origin].set(key, (s = make()));
    return s;
  };
  journal.forEach((record, landing) => {
    for (const e of record.domainEvents) {
      const origin = originOf(e.causeId, ids);
      if (origin < 0) continue;
      const root = journal[origin];
      const c = consequenceOf(e, preferred);
      if (e.id.startsWith(`${root.id}:delay:`)) {
        if (e.kind === "event_scheduled") continue;
        const eventId = e.id.split(":").slice(0, 3).join(":");
        const make = (): Strand => ({
          channel: "delayed",
          consequences: [],
          day: e.day,
          delayDays: Math.max(0, e.day - root.dayBefore),
          delayLabel: scheduled.get(eventId) || undefined,
          landedOrdinal: landing + 1,
        });
        if (e.kind === "event_cancelled") {
          const s = strandFor(origin, `delay:${eventId}`, make);
          s.cancelled = true;
          s.consequences.push({
            text: "It was cancelled. The recorded safeguards held.",
            hidden: false,
            weight: 2,
          });
        } else if (e.kind === "delayed_event_resolved" || c) {
          const s = strandFor(origin, `delay:${eventId}`, make);
          if (c) s.consequences.push(c);
        }
      } else if (e.causeId.startsWith(`${root.id}:incident:`)) {
        const draw = root.draws.find((d) => d.key === e.causeId);
        const bps = draw?.probabilityBps ?? 10000;
        const incidentId = e.causeId.slice(`${root.id}:incident:`.length);
        const s = strandFor(origin, `incident:${e.causeId}`, () => ({
          channel: bps < 10000 ? "chance" : "condition",
          consequences: [],
          probabilityBps: bps,
          happened: draw?.happened ?? true,
          drawValue: draw?.value,
          incidentLabel: labelFor(root, incidentId),
        }));
        if (c) s.consequences.push(c);
      } else if (e.kind === "incident_resolved" && e.causeId === root.id) {
        // A chance that was rolled, even when nothing followed from it.
        const incidentId = String(e.details.incidentId);
        const bps = Number(e.details.probabilityBps);
        if (bps < 10000)
          strandFor(
            origin,
            `incident:${root.id}:incident:${incidentId}`,
            () => ({
              channel: "chance",
              consequences: [],
              probabilityBps: bps,
              happened: e.details.happened === true,
              drawValue: Number(e.details.value),
              incidentLabel: labelFor(root, incidentId),
            }),
          );
      } else if (c) {
        strandFor(origin, "direct", () => ({
          channel: "direct",
          consequences: [],
        })).consequences.push(c);
      }
    }
  });
  const rank: Record<Channel, number> = {
    direct: 0,
    chance: 1,
    condition: 2,
    delayed: 3,
  };
  return buckets.map((bucket) => {
    const strands = [...bucket.values()].sort(
      (a, b) =>
        rank[a.channel] - rank[b.channel] || (a.day ?? 0) - (b.day ?? 0),
    );
    for (const s of strands) {
      const seen = new Set<string>();
      // A concrete report says more than the bare fact that one was edited.
      const reported = s.consequences.some((c) => c.fact === "report");
      s.consequences = s.consequences.filter(
        (c) =>
          !(reported && c.fact === "reportAltered") &&
          !seen.has(c.text) &&
          !!seen.add(c.text),
      );
    }
    return { strands };
  });
}

/**
 * Pick the 3–4 decisions that moved the route most, deterministically.
 * Ties break toward the later decision. If the lever was ever overridden, the
 * strongest override always earns a place: it is the moment the ride's
 * controls stopped meaning what they said. The result reads chronologically.
 */
export function selectTurningPoints(
  view: Pick<DebriefView, "journal" | "ending" | "nodes">,
  limit = 4,
): TurningPoint[] {
  const attributed = attributeConsequences(view);
  const scored = view.journal.map((record, i) => {
    const strands = attributed[i].strands;
    const weightOf = (ch: Channel[]) =>
      strands
        .filter((s) => ch.includes(s.channel))
        .reduce(
          (sum, s) => sum + s.consequences.reduce((t, c) => t + c.weight, 0),
          0,
        );
    const direct = weightOf(["direct"]);
    const chance = weightOf(["chance"]);
    const delayed = weightOf(["delayed"]);
    const inherited = weightOf(["condition"]);
    const later = delayed + inherited;
    const overridden = record.status === "overridden";
    const hasChanceEffect = strands.some(
      (s) => s.channel === "chance" && s.consequences.length,
    );
    const hasDelay = strands.some(
      (s) => s.channel === "delayed" && s.consequences.length,
    );
    const score =
      direct +
      chance +
      later +
      (overridden ? 5 : 0) +
      (hasChanceEffect ? 1 : 0) +
      (hasDelay ? 1 : 0);
    const requestedLabel = optionLabel(
      view,
      record.nodeId,
      record.requestedOptionId,
    );
    const executedLabel = optionLabel(
      view,
      record.nodeId,
      record.executedOptionId,
    );
    const kind: TurningKind = overridden
      ? "override"
      : chance > direct && chance >= later
        ? "chance"
        : later > direct
          ? delayed >= inherited
            ? "delayed"
            : "inherited"
          : "action";
    const point: TurningPoint = {
      ordinal: i + 1,
      recordId: record.id,
      nodeId: record.nodeId,
      nodeTitle: nodeFor(view, record.nodeId)?.title ?? null,
      stage: record.stage,
      day: record.dayBefore,
      kind,
      requestedLabel,
      executedLabel,
      headline: executionLine(record, requestedLabel, executedLabel),
      strands: strands.filter(
        (s) => s.consequences.length || s.channel === "chance",
      ),
      score,
    };
    const meaningful = strands.some((s) => s.consequences.length) || overridden;
    return { point, meaningful, revision: record.revision };
  });
  const ranked = scored
    .filter((s) => s.meaningful && s.point.score > 0)
    .sort((a, b) => b.point.score - a.point.score || b.revision - a.revision);
  const picked = ranked.slice(0, Math.max(0, limit));
  const override = ranked.find((s) => s.point.kind === "override");
  if (limit > 0 && override && !picked.includes(override))
    picked[picked.length - 1] = override;
  return picked
    .sort((a, b) => a.point.ordinal - b.point.ordinal)
    .map((s) => s.point);
}

/* ------------------------------------------------------------ hidden facts */

export type HiddenFact = "goalMismatch" | "evidenceHidden" | "reportAltered";
export const HIDDEN_FACTS: readonly HiddenFact[] = [
  "goalMismatch",
  "evidenceHidden",
  "reportAltered",
];
export interface HiddenFinding {
  fact: HiddenFact;
  /** Day the fact last became true, if the journal shows it. */
  day: number | null;
  /** Decision that set it in motion (1-based). */
  originOrdinal: number | null;
  originTitle: string | null;
  /** Decision during which it took effect, when different from the origin. */
  landedOrdinal: number | null;
  /** reportAltered only: what you were shown versus the modeled value. */
  reports: {
    metric: string;
    reported: number;
    actual: number;
    label: string;
    ordinal: number;
  }[];
}

/** Only the hidden facts present in the ending's causes, in a stable order. */
export function revealHiddenFacts(
  view: Pick<DebriefView, "ending" | "journal" | "nodes">,
): HiddenFinding[] {
  const causes = new Set(view.ending.causes);
  const ids = view.journal.map((r) => r.id);
  return HIDDEN_FACTS.filter((f) => causes.has(f)).map((fact) => {
    let day: number | null = null,
      origin = -1,
      landed = -1;
    view.journal.forEach((record, i) => {
      for (const e of record.domainEvents)
        if (
          e.kind === "fact_changed" &&
          e.details.fact === fact &&
          e.details.value === true &&
          e.details.previous !== true
        ) {
          day = e.day;
          origin = originOf(e.causeId, ids);
          landed = i;
        }
    });
    const reports: HiddenFinding["reports"] = [];
    if (fact === "reportAltered")
      view.journal.forEach((record, i) => {
        for (const e of record.domainEvents)
          if (e.kind === "report_issued")
            reports.push({
              metric: String(e.details.metric),
              reported: Number(e.details.value),
              actual: Number(e.details.actual),
              label: String(e.details.label ?? ""),
              ordinal: i + 1,
            });
      });
    const originRecord = origin >= 0 ? view.journal[origin] : null;
    return {
      fact,
      day,
      originOrdinal: origin >= 0 ? origin + 1 : null,
      originTitle: originRecord
        ? (nodeFor(view, originRecord.nodeId)?.title ?? null)
        : null,
      landedOrdinal: landed >= 0 && landed !== origin ? landed + 1 : null,
      reports,
    };
  });
}

/* ------------------------------------------------------- authority timeline */

export type Authority = "human" | "delegated" | "assistant";
export interface AuthorityCell {
  ordinal: number;
  recordId: string;
  stage: number;
  scope: string;
  /** Who effectively held the decision's scope when the lever moved. */
  authority: Authority;
  /** Who held government at that moment. */
  governance: Authority;
  overridden: boolean;
  status: DecisionRecord["status"];
}

const INITIAL_CONTROL: Readonly<Record<string, Actor>> = {
  rail: "human",
  dispatch: "institution",
  care: "institution",
  power: "institution",
  food: "institution",
  research: "institution",
  governance: "institution",
  recovery: "institution",
};

/**
 * Replay control and permission events to classify each decision.
 * - assistant: Morrow effectively controlled the scope, or executed an override;
 * - delegated: a live grant let Morrow act in the scope, or another actor overrode;
 * - human: the office decided and executed.
 */
export function deriveAuthorityTimeline(
  journal: readonly DecisionRecord[],
  nodes: readonly DebriefNode[],
): AuthorityCell[] {
  const control: Record<string, Actor> = { ...INITIAL_CONTROL };
  const grants = new Map<
    string,
    { scope: string; expiresDay: number | null }
  >();
  const appointed = new Map<string, string>();
  for (const r of journal)
    for (const e of r.domainEvents)
      if (e.kind === "office_appointed")
        appointed.set(e.causeId, String(e.details.scope));
  let lastScope = "rail";
  return journal.map((record, i) => {
    const scope =
      nodes.find((n) => n.id === record.nodeId)?.scope ??
      appointed.get(record.id) ??
      lastScope;
    lastScope = scope;
    const liveGrant = [...grants.values()].some(
      (g) =>
        g.scope === scope &&
        (g.expiresDay === null || g.expiresDay > record.dayBefore),
    );
    const overridden = record.status === "overridden";
    const authority: Authority =
      (overridden && record.executor === "assistant") ||
      control[scope] === "assistant"
        ? "assistant"
        : overridden || liveGrant || record.status === "delegated"
          ? "delegated"
          : "human";
    const govGrant = [...grants.values()].some(
      (g) =>
        g.scope === "governance" &&
        (g.expiresDay === null || g.expiresDay > record.dayBefore),
    );
    const governance: Authority =
      control.governance === "assistant"
        ? "assistant"
        : govGrant
          ? "delegated"
          : "human";
    const cell: AuthorityCell = {
      ordinal: i + 1,
      recordId: record.id,
      stage: record.stage,
      scope,
      authority,
      governance,
      overridden,
      status: record.status,
    };
    for (const e of record.domainEvents) {
      const d = e.details;
      if (
        e.kind === "effective_control_changed" ||
        e.kind === "effective_control_seized"
      )
        control[String(d.scope)] = d.actor as Actor;
      else if (e.kind === "permission_granted") {
        const g = d.grant as {
          id: string;
          holder: string;
          scope: string;
          expiresDay: number | null;
        };
        if (g?.holder === "assistant")
          grants.set(g.id, { scope: g.scope, expiresDay: g.expiresDay });
      } else if (e.kind === "permissions_revoked")
        for (const id of (d.grantIds as string[]) ?? []) grants.delete(id);
      else if (e.kind === "grant_expired") grants.delete(String(d.grantId));
    }
    return cell;
  });
}

/** Run-length text for screen readers: "Human, decisions 1–16. Delegated, 17–24." */
export function describeAuthority(
  cells: readonly AuthorityCell[],
  key: "authority" | "governance",
): string {
  const runs: { value: Authority; from: number; to: number }[] = [];
  for (const c of cells) {
    const last = runs.at(-1);
    if (last && last.value === c[key]) last.to = c.ordinal;
    else runs.push({ value: c[key], from: c.ordinal, to: c.ordinal });
  }
  const name: Record<Authority, string> = {
    human: "Human",
    delegated: "Delegated to Morrow",
    assistant: "Morrow",
  };
  return runs
    .map(
      (r) =>
        `${name[r.value]}, ${r.from === r.to ? `decision ${r.from}` : `decisions ${r.from}–${r.to}`}`,
    )
    .join(". ");
}

/* ----------------------------------------------------------------- series */

export interface RecordSeries {
  /** Index 0 is the state before the first decision. */
  gdp: number[];
  deaths: number[];
  capability: number[];
  /** What the instruments showed, when any report replaced the modeled value. */
  reportedCapability: number[] | null;
  stages: { stage: number; from: number; to: number }[];
}
export function recordSeries(
  view: Pick<DebriefView, "journal" | "startingGDP">,
): RecordSeries {
  const j = view.journal;
  const gdp = [view.startingGDP ?? 1000, ...j.map((r) => r.metrics.gdp)];
  const deaths = [0, ...j.map((r) => r.metrics.casualties)];
  const capability = [0, ...j.map((r) => r.metrics.capability)];
  let reported: number | null = null;
  let anyReport = false;
  const reportedCapability = [0];
  j.forEach((r, i) => {
    for (const e of r.domainEvents)
      if (e.kind === "report_issued" && e.details.metric === "capability") {
        reported = Number(e.details.value);
        anyReport = true;
      }
    reportedCapability.push(reported ?? capability[i + 1]);
  });
  const stages: RecordSeries["stages"] = [];
  j.forEach((r, i) => {
    const last = stages.at(-1);
    if (last && last.stage === r.stage) last.to = i + 1;
    else stages.push({ stage: r.stage, from: i + 1, to: i + 1 });
  });
  return {
    gdp,
    deaths,
    capability,
    reportedCapability: anyReport ? reportedCapability : null,
    stages,
  };
}

/* ------------------------------------------------------------------ header */

export function eyebrowText(
  view: Pick<DebriefView, "world">,
  lead: string,
): string {
  return `${lead} · Day\u00a0${formatInt(view.world.day)}`;
}
export function populationCaption(
  view: Pick<DebriefView, "world" | "journal">,
): string {
  const n = view.journal.length;
  const decisions = `${formatInt(n)} ${n === 1 ? "decision" : "decisions"}`;
  const w = view.world;
  if (w.population <= 0) return `No one remains after ${decisions}.`;
  const lost = w.initialPopulation - w.population;
  const remain = `${formatInt(w.population)} people remain after ${decisions}.`;
  return lost > 0 ? `${remain} ${formatInt(lost)} do not.` : remain;
}
export function overrideCount(journal: readonly DecisionRecord[]): number {
  return journal.filter((r) => r.status === "overridden").length;
}
