/**
 * The seam between the orchestrator and the interface components: Morrow's
 * window, the instrument cluster, the wire, the glossary and the debrief.
 * Everything here is presentation: it reads the campaign, never writes it.
 */
import { el } from "./dom.ts";
import type { Campaign, Metric, Node, PreparedDecision } from "../contracts/index.ts";
import type { LocalRun, Preferences } from "../persistence/index.ts";
import type { StageView } from "../render/api.ts";
import type { DisplayPrefs } from "./display-prefs.ts";
import { renderMorrow, finishMorrow as finishWindow, disposeMorrow as disposeWindow, type MorrowReply } from "./components/morrow/index.ts";
import { renderInstruments } from "./components/instruments/index.ts";
import { renderWire, toWireView } from "./components/wire/index.ts";
import { renderDebrief as renderDebriefView, setReplayReady, disposeDebrief } from "./components/debrief/index.ts";
import { annotate, mountGlossary, renderHistoryCard, type GlossaryPopoverController } from "./components/glossary/index.ts";
import { historyCardFor } from "./content/history.ts";
import { ambientFor, botSaturationFor, tickerForCampaign, factoidForCampaign, type AmbientLog } from "./ambient-log.ts";
import { setWireBrand } from "./components/wire/brand-bridge.ts";
import { brandForWire } from "./brand/wire-adapter.ts";

export interface PanelContext {
  run: LocalRun;
  nodes: Node[];
  locked: boolean;
  prefs: Preferences;
  display: DisplayPrefs;
  selectedAdvice: string[];
  pendingAdvice: string[];
  view: StageView | null;
  animateId?: string;
  busy(): boolean;
  afterChoice(): boolean;
  /** Returns true if the ask was accepted (then redraw with animateId). */
  onAsk(id: string): boolean;
  onReplyComplete(answer: string, id: string): void;
  redraw(animateId?: string): void;
  availableAdvice(p: PreparedDecision): Array<{ index: number } | number>;
  queryAdvisor(p: PreparedDecision, index: number): { id: string; question: string; answer: string; reasoning?: string; recommends?: string | null; tone?: string } | null;
}

export interface DebriefActions {
  onReadDecisions(): void;
  onSources(): void;
  onExportReplay(): void;
  replayReady: boolean;
  onAnotherRide(): void;
  onSettings(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let glossary: GlossaryPopoverController | null = null;
let seenTerms = new Set<string>();
const wireRead = new Set<string>();
const ambient: AmbientLog = { runId: "", items: [], upTo: 0 };

export function initPanels(prefs: Preferences): void {
  glossary ??= mountGlossary({ root: document, reducedMotion: prefs.reducedMotion });
  setWireBrand(brandForWire() as Parameters<typeof setWireBrand>[0]);
}
export function setPanelMotion(reduced: boolean): void {
  glossary?.setReducedMotion(reduced);
}
export function closeGlossary(): void {
  glossary?.close();
}
export function newScreen(): void {
  glossary?.close();
  seenTerms = new Set();
}

export function finishMorrow(host: HTMLElement): void {
  finishWindow(host);
}
export function disposeMorrow(host: HTMLElement): void {
  disposeWindow(host);
}

/** Which side Morrow has recommended in replies the player has read. */
export function recommendedSide(c: Campaign, readIds: string[]): "left" | "right" | null {
  const p = c.prepared;
  if (!p) return null;
  for (const id of [...readIds].reverse()) {
    if (!id.startsWith(`${p.id}:advice:`)) continue;
    const index = Number(id.split(":advice:").at(-1));
    const rec = p.node.advice[index]?.recommends;
    if (rec) return rec === p.leftOptionId ? "left" : rec === p.rightOptionId ? "right" : null;
  }
  return null;
}

/** A prompt paragraph with its glossary terms highlighted (first use only). */
export function annotated(paragraph: string): HTMLElement {
  const p = el("p");
  p.append(annotate(paragraph, { seen: seenTerms, max: 4 }));
  return p;
}

export function historyCard(nodeId: string): HTMLElement | null {
  const card = historyCardFor(nodeId);
  if (!card) return null;
  const host = el("div", "history-host");
  renderHistoryCard(host, card, { expanded: false, surface: "plain", seen: seenTerms, headingLevel: 3 });
  return host;
}

// ------------------------------------------------------------------ panels

function side(p: PreparedDecision, optionId: string | null | undefined): "left" | "right" | null {
  if (!optionId) return null;
  return optionId === p.leftOptionId ? "left" : optionId === p.rightOptionId ? "right" : null;
}

function reply(node: Node | undefined, p: PreparedDecision | null, id: string): MorrowReply | null {
  const index = Number(id.split(":advice:").at(-1));
  const advice = node?.advice[index];
  if (!advice) return null;
  const s = p && p.nodeId === node!.id ? side(p, advice.recommends) : null;
  const label = advice.recommends ? node!.options.find((o) => o.id === advice.recommends)?.label : undefined;
  return {
    id,
    question: advice.question,
    answer: advice.answer,
    ...(advice.reasoning ? { reasoning: advice.reasoning } : {}),
    tone: advice.tone,
    recommends: s && label ? { side: s, label } : null,
  };
}

/** Reported values per decision: truth, except where an institutional report has overwritten it (sticky). */
function reportedHistory(c: Campaign, metric: Metric): number[] {
  let altered: number | null = null;
  return c.journal.map((r) => {
    for (const e of r.domainEvents) if (e.kind === "report_issued" && e.details.metric === metric) altered = Number(e.details.value);
    return altered ?? r.metrics[metric];
  });
}

export function drawPanels(ctx: PanelContext): void {
  const run = ctx.run;
  const c = run.campaign;
  const stage = ctx.locked ? (c.journal.at(-1)?.stage ?? c.stage) : (c.prepared?.stage ?? c.stage);
  $("#assistant-panel").hidden = stage < 3;
  $("#telemetry-panel").hidden = stage < 3;
  const w = c.world;
  const day = (c.journal.at(-1)?.dayAfter ?? w.day) + 1;

  // Instruments (stage 4+). Reported readings, with their provenance.
  const metric = (key: Metric, label: string, extra: { scaleMax?: number; unit?: string } = {}) => {
    const o = w.observations[key];
    const history = [...reportedHistory(c, key), o.value];
    return { key, label, value: o.value, history, altered: o.altered, source: o.altered ? o.coverage : o.source, ...extra };
  };
  renderInstruments($("#instruments"), {
    stage,
    day,
    dateLabel: ctx.view?.cabin.clock ?? "",
    reducedMotion: ctx.prefs.reducedMotion,
    metrics: [metric("gdp", "GDP index"), metric("capability", "AI capability", { scaleMax: 1000 }), metric("casualties", "Fatalities", { scaleMax: w.initialPopulation })],
    secondary: [metric("population", "Population", { scaleMax: w.initialPopulation }), metric("power", "Power"), metric("care", "Care"), metric("food", "Food")],
  });

  // The wire: authored news plus the ambient world, newest first.
  const items = ambientFor(ambient, c);
  const wireView = toWireView(w.news, items, {
    stage,
    botSaturation: botSaturationFor(c),
    reducedMotion: ctx.prefs.reducedMotion,
    today: w.day,
    readIds: [...wireRead],
  });
  renderWire(
    $("#wire"),
    { ...wireView, ticker: tickerForCampaign(c), factoid: stage >= 4 ? factoidForCampaign(c) : null },
    {
      tickerHost: $("#ticker"),
      onRead: (ids) => ids.forEach((id) => wireRead.add(id)),
    },
  );

  // Morrow.
  const prepared = c.prepared;
  const questions: MorrowReply[] =
    prepared && !ctx.locked
      ? ctx.availableAdvice(prepared).flatMap((item) => {
          const index = typeof item === "number" ? item : item.index;
          const answer = ctx.queryAdvisor(prepared, index);
          const r = answer ? reply(prepared.node, prepared, answer.id) : null;
          return r ? [r] : [];
        })
      : [];
  const history: MorrowReply[] = [
    ...c.journal.flatMap((record) => {
      const node = ctx.nodes.find((n) => n.id === record.nodeId);
      return record.adviceIds.flatMap((id) => {
        const r = reply(node, null, id);
        return r ? [r] : [];
      });
    }),
    ...questions.filter((q) => ctx.selectedAdvice.includes(q.id) || ctx.pendingAdvice.includes(q.id)),
  ].slice(-14);
  const cues = ctx.view?.cues ?? [];
  renderMorrow($("#assistant-panel"), {
    stage,
    online: stage >= 3,
    locked: ctx.locked,
    reducedMotion: ctx.prefs.reducedMotion,
    authority: ctx.view?.cabin.authority ?? "human",
    questions,
    history,
    readIds: [...ctx.selectedAdvice, ...ctx.pendingAdvice],
    ...(ctx.animateId ? { animateId: ctx.animateId } : {}),
    cues: { logoFlash: cues.some((q) => q.kind === "logo-flash"), revision: cues.some((q) => q.kind === "revision"), noFlashing: ctx.display.noFlashing },
    onAsk: (q) => {
      if (ctx.onAsk(q.id)) ctx.redraw(q.id);
    },
    onReplyComplete: (answer, id) => ctx.onReplyComplete(answer, id),
  });
}

// ----------------------------------------------------------------- debrief

export function renderDebrief(host: HTMLElement, run: LocalRun, nodes: Node[], prefs: Preferences, actions: DebriefActions): HTMLElement {
  const c = run.campaign;
  disposeDebrief(host);
  const handle = renderDebriefView(
    host,
    {
      ending: c.ending!,
      journal: c.journal,
      nodes: nodes.map((n) => ({
        id: n.id,
        stage: n.stage,
        role: n.role,
        scope: n.scope,
        title: n.title,
        options: n.options.map((o) => ({ id: o.id, label: o.label, incidents: o.incidents.map((i) => ({ id: i.id, label: i.label })) })),
      })),
      world: { population: c.world.population, initialPopulation: c.world.initialPopulation, casualties: c.world.casualties, day: c.world.day, facts: c.world.facts, control: c.world.control },
      seed: c.seed,
      reducedMotion: prefs.reducedMotion,
    },
    actions,
  );
  return handle.title;
}

export function replayReady(host: HTMLElement): void {
  setReplayReady(host, true);
}

export function leaveDebrief(host: HTMLElement): void {
  disposeDebrief(host);
}
