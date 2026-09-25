/**
 * The seam between the orchestrator and the interface components: Morrow's
 * window, the instrument cluster, the wire, the glossary and the debrief.
 */
import { el, button, append } from "./dom.ts";
import { COPY, executionSummary } from "./copy.ts";
import type { Campaign, DecisionRecord, Node, PreparedDecision } from "../contracts/index.ts";
import type { LocalRun, Preferences } from "../persistence/index.ts";
import type { StageView } from "../render/api.ts";
import type { DisplayPrefs } from "./display-prefs.ts";
import { renderAdvisor, renderInstruments, finishAdvisor, disposeAdvisor } from "./panels.ts";

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

export function finishMorrow(host: HTMLElement): void {
  finishAdvisor(host);
}
export function disposeMorrow(host: HTMLElement): void {
  disposeAdvisor(host);
}

/** Which side Morrow has recommended in replies the player has read. */
export function recommendedSide(c: Campaign, readIds: string[]): "left" | "right" | null {
  const p = c.prepared;
  if (!p) return null;
  for (const id of [...readIds].reverse()) {
    const index = Number(id.split(":advice:").at(-1));
    const rec = p.node.advice[index]?.recommends;
    if (rec) return rec === p.leftOptionId ? "left" : rec === p.rightOptionId ? "right" : null;
  }
  return null;
}

export function annotated(paragraph: string): HTMLElement {
  return el("p", "", paragraph);
}

export function historyCard(_nodeId: string): HTMLElement | null {
  return null;
}

function formatCount(n: number) {
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)} bn` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} m` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}

export function drawPanels(ctx: PanelContext): void {
  const run = ctx.run;
  const stage = ctx.locked ? (run.campaign.journal.at(-1)?.stage ?? run.campaign.stage) : run.campaign.stage;
  $("#assistant-panel").hidden = stage < 3;
  $("#telemetry-panel").hidden = stage < 3;
  const w = run.campaign.world;
  renderInstruments(
    $("#wire"),
    stage < 4
      ? []
      : [
          { label: "GDP", value: w.observations.gdp.value, display: String(w.observations.gdp.value), maximum: 2000, kind: "economy", scale: "Index. Bar scale 0–2000." },
          { label: "Capability", value: w.observations.capability.value, display: String(w.observations.capability.value), maximum: 1000, kind: "capability", scale: "Reported capability index." },
          { label: "Fatalities", value: w.observations.casualties.value, display: formatCount(w.observations.casualties.value), maximum: 8000000000, kind: "fatalities", scale: "Reported deaths." },
        ],
    w.news,
  );
  const prepared = run.campaign.prepared;
  const questions =
    prepared && !ctx.locked
      ? ctx.availableAdvice(prepared).flatMap((item) => {
          const index = typeof item === "number" ? item : item.index;
          const answer = ctx.queryAdvisor(prepared, index);
          return answer ? [answer] : [];
        })
      : [];
  renderAdvisor($("#assistant-panel"), {
    online: stage >= 3,
    locked: ctx.locked,
    ...(ctx.animateId ? { animateId: ctx.animateId } : {}),
    reducedMotion: ctx.prefs.reducedMotion,
    questions,
    readIds: [...ctx.selectedAdvice, ...ctx.pendingAdvice],
    history: [
      ...run.campaign.journal.flatMap((record) => {
        const node = ctx.nodes.find((item) => item.id === record.nodeId);
        return record.adviceIds.flatMap((id) => {
          const index = Number(id.split(":advice:").at(-1));
          const reply = node?.advice[index];
          return reply ? [{ id, question: reply.question, answer: reply.answer, reasoning: reply.reasoning }] : [];
        });
      }),
      ...questions.filter((item) => ctx.selectedAdvice.includes(item.id) || ctx.pendingAdvice.includes(item.id)),
    ].slice(-12),
    onAsk: (answer) => {
      if (ctx.onAsk(answer.id)) {
        ctx.redraw(answer.id);
        $("#assistant-panel").querySelector<HTMLElement>(".chat-prompt,.conversation")?.focus({ preventScroll: true });
      }
    },
    onReplyComplete: (answer, id) => ctx.onReplyComplete(answer, id),
  });
}

// ----------------------------------------------------------------- debrief

function sparkline(records: DecisionRecord[], metric: "gdp" | "casualties" | "capability", label: string) {
  const wrap = el("section", "chart-wrap");
  wrap.append(el("h3", "", label));
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 300 145");
  svg.classList.add("chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${label}. ${records.map((r) => r.metrics[metric]).join(", ")}. Fictional game values.`);
  const values = records.map((r) => r.metrics[metric]);
  const lo = Math.min(0, ...values),
    hi = Math.max(1, ...values);
  const line = document.createElementNS(ns, "path");
  line.setAttribute("d", values.map((v, i) => `${i ? "L" : "M"}${12 + (i * 275) / Math.max(1, values.length - 1)},${115 - ((v - lo) / (hi - lo)) * 95}`).join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", metric === "casualties" ? "#9e0d12" : "#111214");
  line.setAttribute("stroke-width", "1.6");
  svg.append(line);
  wrap.append(svg);
  return wrap;
}

export function renderDebrief(host: HTMLElement, run: LocalRun, _nodes: Node[], _prefs: Preferences, actions: DebriefActions): void {
  const c = run.campaign,
    end = c.ending!;
  const body = el("article", "debrief");
  append(
    body,
    el("p", "eyebrow", "The trolley has stopped. The world has not."),
    el("h1", "", end.title),
    el("p", "summary", end.summary),
    el("p", "caption", `${c.journal.length} decisions. ${formatCount(c.world.population)} people remain.`),
  );
  for (const r of c.journal.filter((r) => r.status === "overridden").slice(0, 3)) body.append(el("div", "turning-point", executionSummary(r)));
  const charts = el("div", "chart-grid");
  append(charts, sparkline(c.journal, "gdp", "GDP index"), sparkline(c.journal, "casualties", "Recorded deaths"));
  body.append(charts);
  const replay = button("Export replay", actions.onExportReplay);
  replay.disabled = true;
  replay.dataset.replay = "true";
  const row = el("div", "debrief-actions");
  append(row, button("Read your decisions", actions.onReadDecisions), button("Sources and assumptions", actions.onSources), replay, button("Another ride", actions.onAnotherRide));
  append(body, row, el("p", "end-note", COPY.closing));
  host.append(body);
}

export function replayReady(host: HTMLElement): void {
  const b = host.querySelector<HTMLButtonElement>("[data-replay]");
  if (b) b.disabled = false;
}
