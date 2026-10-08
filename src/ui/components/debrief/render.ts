/**
 * The debrief: the last thing the player reads. An editorial long-read in
 * eight movements — conclusion, turning points, what was hidden, the record,
 * the decisions, actions, the closing note and a methods footer.
 *
 * Self-contained: it takes an explicit view model and callbacks, makes no
 * engine, persistence or telemetry calls, and uses no randomness.
 */
import { el, append } from "../../dom.ts";
import { COPY } from "../../copy.ts";
import {
  DEBRIEF_COPY,
  EPIGRAPHS,
  FAMILY_NAMES,
  HIDDEN_FACT_COPY,
  STAGE_NAMES,
} from "./copy.ts";
import {
  chancePhrase,
  deriveAuthorityTimeline,
  describeAuthority,
  eyebrowText,
  formatInt,
  formatCompact,
  optionLabel,
  nodeFor,
  overrideCount,
  pad2,
  quoteLabel,
  recordSeries,
  revealHiddenFacts,
  selectTurningPoints,
  type AuthorityCell,
  type DebriefActions,
  type DebriefView,
  type Strand,
  type TurningPoint,
} from "./model.ts";
import {
  authorityBand,
  lineChart,
  routeStrip,
  type LineChart,
  type RouteStop,
} from "./charts.ts";

export interface DebriefHandle {
  root: HTMLElement;
  /** The display title. tabindex=-1, so the orchestrator can move focus to it. */
  title: HTMLHeadingElement;
  setReplayReady(ready: boolean): void;
  /** Follows a live change to the player's motion setting without re-rendering. */
  setReducedMotion(reduced: boolean): void;
}

interface Mounted extends DebriefHandle {
  dispose(): void;
}
const mounted = new WeakMap<HTMLElement, Mounted>();
let sequence = 0;

/** Tears down observers and timers and empties the host. Safe to call twice. */
export function disposeDebrief(host: HTMLElement): void {
  const m = mounted.get(host);
  if (!m) return;
  m.dispose();
  mounted.delete(host);
  host.replaceChildren();
}

/** Enables Export replay once the orchestrator has prepared the file. */
export function setReplayReady(host: HTMLElement, ready: boolean): void {
  mounted.get(host)?.setReplayReady(ready);
}

const KIND_TAG: Record<TurningPoint["kind"], string> = {
  action: "Your choice",
  override: "Overridden",
  chance: "Chance",
  delayed: "Delayed",
  inherited: "Inherited",
};
const AUTH_WORD: Record<AuthorityCell["authority"], string> = {
  human: "Human",
  delegated: "Delegated",
  assistant: "Morrow",
};

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}
/** "No. 24" that never breaks across a line. */
function no(ordinal: number): string {
  return `No.\u00a0${ordinal}`;
}
function mono(text: string, cls = "") {
  return el("span", `db-mono${cls ? ` ${cls}` : ""}`, text);
}
function hide<T extends Element>(node: T): T {
  node.setAttribute("aria-hidden", "true");
  return node;
}

export function renderDebrief(
  host: HTMLElement,
  view: DebriefView,
  actions: DebriefActions,
): DebriefHandle {
  disposeDebrief(host);
  const uid = `debrief-${++sequence}`;
  const reduced = view.reducedMotion || prefersReducedMotion();
  const cleanups: (() => void)[] = [];
  const root = el("article", "debrief");
  root.setAttribute("aria-labelledby", `${uid}-title`);
  root.setAttribute("data-ending", view.ending.id);
  root.setAttribute("data-motion", reduced ? "reduced" : "full");

  let beat = 0;
  /** Sequenced reveal: each call schedules the next element slightly later. */
  const reveal = <T extends HTMLElement>(node: T, gap = 140): T => {
    node.classList.add("db-rv");
    node.style.setProperty("--d", `${beat}ms`);
    beat += gap;
    return node;
  };

  const journal = view.journal;
  const n = journal.length;
  const turning = selectTurningPoints(view);
  const hidden = revealHiddenFacts(view);
  const cells = deriveAuthorityTimeline(journal, view.nodes);
  const series = recordSeries(view);
  const overrides = overrideCount(journal);
  const titleOf = (nodeId: string) => nodeFor(view, nodeId)?.title ?? null;

  /* ---------------------------------------------------- 1 · conclusion */
  beat = 180;
  const hero = el("header", "db-hero db-row");
  const eyebrow = el("p", "db-eyebrow");
  eyebrow.append(
    hide(el("span", "db-lamp")),
    eyebrowText(view, DEBRIEF_COPY.eyebrow),
  );
  const title = el("h1", "db-title", view.ending.title) as HTMLHeadingElement;
  title.id = `${uid}-title`;
  title.tabIndex = -1;
  const summary = el("p", "db-summary", view.ending.summary);
  append(hero, reveal(eyebrow, 320), reveal(title, 700), reveal(summary, 650));
  const epigraph = EPIGRAPHS[view.ending.id];
  if (epigraph) {
    const fig = el("figure", "db-epigraph");
    const quote = el("blockquote", "db-epigraph-text");
    quote.append(el("p", "", epigraph.text));
    fig.append(
      quote,
      el("figcaption", "db-epigraph-source", `— ${epigraph.source}`),
    );
    hero.append(reveal(fig, 600));
  }
  const caption = el("p", "db-caption");
  const w = view.world;
  const decisions = `${formatInt(n)} ${n === 1 ? "decision" : "decisions"}`;
  if (w.population <= 0) caption.append(`No one remains after ${decisions}.`);
  else {
    caption.append(
      `${formatInt(w.population)} people remain after ${decisions}.`,
    );
    const lost = w.initialPopulation - w.population;
    if (lost > 0)
      caption.append(" ", el("span", "db-lost", `${formatInt(lost)} do not.`));
  }
  hero.append(reveal(caption, 260));
  const meta = el("dl", "db-meta");
  const metaItem = (k: string, v: string) => {
    const d = el("div", "db-meta-item");
    d.append(el("dt", "", k), el("dd", "", v));
    meta.append(d);
  };
  metaItem("Ending", FAMILY_NAMES[view.ending.id] ?? view.ending.id);
  metaItem("Decisions", formatInt(n));
  metaItem("Days", formatInt(w.day));
  metaItem("Overrides", formatInt(overrides));
  hero.append(reveal(meta, 160));
  hero.append(
    reveal(
      el(
        "p",
        "db-filed",
        view.ending.id === "extinction"
          ? DEBRIEF_COPY.filedByMachine
          : DEBRIEF_COPY.filedBy,
      ),
      240,
    ),
  );
  root.append(hero);

  /* ---------------------------------------------------- section helper */
  let sectionIndex = 0;
  const section = (key: string, titleText: string, dek?: string) => {
    const s = el("section", `db-section db-section--${key}`);
    const hid = `${uid}-${key}`;
    s.setAttribute("aria-labelledby", hid);
    const head = el("header", "db-head db-row");
    const num = hide(el("p", "db-margin db-num", pad2(++sectionIndex)));
    const h2 = el("h2", "db-h2", titleText);
    h2.id = hid;
    head.append(num, h2);
    if (dek) head.append(el("p", "db-dek", dek));
    s.append(head);
    root.append(reveal(s, 120));
    return s;
  };

  /* ------------------------------------------- 2 · what changed the route */
  const routeSection = section(
    "route",
    DEBRIEF_COPY.routeTitle,
    DEBRIEF_COPY.routeDek,
  );
  const turnIndex = new Map(turning.map((t, i) => [t.ordinal, i + 1]));
  const stops: RouteStop[] = journal.map((r, i) => ({
    ordinal: i + 1,
    stage: r.stage,
    overridden: r.status === "overridden",
    deaths: r.metrics.casualties - (i ? journal[i - 1].metrics.casualties : 0),
    turning: turnIndex.get(i + 1) ?? null,
    governance: cells[i]?.governance ?? "human",
  }));
  const lossAt = stops.filter((s) => s.deaths > 0).map((s) => s.ordinal);
  const overrideAt = stops.filter((s) => s.overridden).map((s) => s.ordinal);
  const govAt = stops
    .filter((s) => s.governance === "assistant")
    .map((s) => s.ordinal);
  const list = (xs: number[]) =>
    xs.length <= 1
      ? xs.join("")
      : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
  const routeSummary = [
    `A route of ${decisions} over ${formatInt(w.day)} days.`,
    turning.length
      ? `Turning points at decision${turning.length > 1 ? "s" : ""} ${list(turning.map((t) => t.ordinal))}.`
      : "",
    overrideAt.length
      ? `The lever was overridden at decision${overrideAt.length > 1 ? "s" : ""} ${list(overrideAt)}.`
      : "",
    lossAt.length
      ? `Deaths were recorded at decision${lossAt.length > 1 ? "s" : ""} ${list(lossAt)}.`
      : "No deaths were recorded.",
    govAt.length
      ? `Morrow held the government at decision${govAt.length > 1 ? "s" : ""} ${list(govAt)}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const routeRow = el("div", "db-row");
  const strip = routeStrip(
    stops,
    routeSummary,
    `Stopped · Day ${formatInt(w.day)}`,
  );
  strip.classList.add("db-full");
  routeRow.append(strip);
  routeSection.append(routeRow);

  const points = el("ol", "db-points");
  turning.forEach((tp, i) => points.append(turningPoint(tp, i + 1)));
  if (!turning.length)
    points.append(
      el(
        "li",
        "db-point db-row db-point--empty",
        "No single decision moved the route much. It moved a little at a time.",
      ),
    );
  routeSection.append(points);

  function turningPoint(tp: TurningPoint, index: number): HTMLElement {
    const li = el("li", `db-point db-row db-point--${tp.kind}`);
    const side = el("div", "db-margin db-point-meta");
    const badge = hide(el("span", "db-point-n", String(index)));
    const facts = el("p", "db-point-facts");
    facts.append(
      mono(no(tp.ordinal), "db-point-no"),
      mono(`Stage ${tp.stage} · ${STAGE_NAMES[tp.stage - 1] ?? ""}`),
      mono(`Day ${formatInt(tp.day)}`),
    );
    const tag = el("span", `db-tag db-tag--${tp.kind}`, KIND_TAG[tp.kind]);
    side.append(facts, tag);
    const body = el("div", "db-point-body");
    body.append(badge, side);
    if (tp.nodeTitle) body.append(el("p", "db-point-title", tp.nodeTitle));
    body.append(el("p", "db-point-head", tp.headline));
    if (tp.kind === "override")
      body.append(
        el(
          "p",
          "db-point-note",
          tp.requestedLabel !== tp.executedLabel
            ? "The lever registered your input. The route did not."
            : "The lever still moved. It had stopped deciding anything.",
        ),
      );
    for (const s of tp.strands) body.append(strand(s));
    li.append(body);
    return li;
  }

  function effects(s: Strand): HTMLElement {
    const ul = el("ul", "db-effects");
    for (const c of s.consequences) {
      const li = el("li", c.hidden ? "is-hidden" : "");
      li.append(hide(el("span", "db-arrow", "→")), el("span", "", c.text));
      // Chosen in the moment, the fact was still kept off the instruments;
      // arriving later or by chance, it was never shown at all.
      if (c.hidden)
        li.append(
          " ",
          el(
            "span",
            "db-hidden-tag",
            s.channel === "direct"
              ? "Hidden from your instruments"
              : "Not shown to you",
          ),
        );
      ul.append(li);
    }
    return ul;
  }

  function strand(s: Strand): HTMLElement {
    const box = el("div", `db-strand db-strand--${s.channel}`);
    if (s.channel === "direct") {
      box.append(effects(s));
      return box;
    }
    const lead = el("p", "db-strand-lead");
    if (s.channel === "chance") {
      const p = (s.probabilityBps ?? 0) / 10000;
      const gauge = hide(el("span", "db-odds"));
      gauge.style.setProperty("--p", p.toFixed(4));
      if (s.drawValue !== undefined) {
        const tick = el("span", `db-odds-draw${s.happened ? " is-hit" : ""}`);
        tick.style.setProperty("--v", (s.drawValue / 10000).toFixed(4));
        gauge.append(tick);
      }
      lead.append(
        gauge,
        el(
          "span",
          "db-strand-phrase",
          chancePhrase(s.probabilityBps ?? 0, !!s.happened),
        ),
      );
      box.append(lead);
      if (s.incidentLabel)
        box.append(
          el("p", "db-strand-label", `Modeled risk: ${s.incidentLabel}`),
        );
    } else if (s.channel === "condition") {
      lead.append(
        el("span", "db-strand-phrase", "Earlier decisions made this certain."),
      );
      box.append(lead);
      if (s.incidentLabel)
        box.append(
          el("p", "db-strand-label", `Modeled rule: ${s.incidentLabel}`),
        );
    } else {
      const when = [
        s.delayDays !== undefined
          ? `${formatInt(s.delayDays)} days later`
          : "Later",
        s.day !== undefined ? `day ${formatInt(s.day)}` : "",
        s.landedOrdinal !== undefined ? `during ${no(s.landedOrdinal)}` : "",
      ].filter(Boolean);
      lead.append(
        hide(el("span", "db-clock")),
        el("span", "db-strand-phrase", `${when.join(" · ")}.`),
      );
      box.append(lead);
      if (s.delayLabel)
        box.append(el("p", "db-strand-label", `Scheduled: ${s.delayLabel}`));
    }
    if (s.consequences.length) box.append(effects(s));
    return box;
  }

  /* ------------------------------------------- 3 · what you could not see */
  const hiddenSection = section(
    "hidden",
    DEBRIEF_COPY.hiddenTitle,
    DEBRIEF_COPY.hiddenDek,
  );
  const hiddenRow = el("div", "db-row");
  if (!hidden.length)
    hiddenRow.append(el("p", "db-quiet", DEBRIEF_COPY.hiddenNone));
  else {
    const ul = el("ul", "db-secrets");
    hidden.forEach((f, i) => {
      const copy = HIDDEN_FACT_COPY[f.fact];
      const li = el("li", "db-secret");
      li.style.setProperty("--k", String(i));
      const key = el("p", "db-secret-key");
      key.append(mono("Hidden fact"), mono(f.fact, "db-secret-id"));
      const h3 = el("h3", "db-secret-title");
      h3.append(el("span", "db-redact", copy.title));
      li.append(key, h3, el("p", "db-secret-body", copy.body));
      for (const r of f.reports) {
        const ledger = el("dl", "db-secret-ledger");
        const row = (k: string, v: string, cls = "") => {
          const d = el("div", cls);
          d.append(el("dt", "", k), el("dd", "", v));
          ledger.append(d);
        };
        row("Reported to you", formatInt(r.reported), "is-reported");
        row("Modeled", formatInt(r.actual));
        row(
          "Difference",
          `${r.reported >= r.actual ? "+" : "−"}${formatInt(Math.abs(r.reported - r.actual))}`,
        );
        li.append(
          ledger,
          el("p", "db-secret-source", `${r.label} · ${no(r.ordinal)}`),
        );
      }
      const receipt: string[] = [];
      if (f.day !== null) receipt.push(`True from day ${formatInt(f.day)}`);
      if (f.originOrdinal !== null)
        receipt.push(
          `Set in motion by ${no(f.originOrdinal)}${f.originTitle ? `, ${quoteLabel(f.originTitle).replace(/\.”$/, "”")}` : ""}`,
        );
      if (f.landedOrdinal !== null)
        receipt.push(`Took effect during ${no(f.landedOrdinal)}`);
      if (receipt.length)
        li.append(el("p", "db-secret-receipt", receipt.join(" · ")));
      ul.append(li);
    });
    hiddenRow.append(ul);
  }
  hiddenSection.append(hiddenRow);

  /* ------------------------------------------------------ 4 · the record */
  const recordSection = section(
    "record",
    DEBRIEF_COPY.recordTitle,
    DEBRIEF_COPY.recordDek,
  );
  const figure = el("div", "db-record db-full");
  const turningOrdinals = turning.map((t) => t.ordinal);
  const gdpEnd = series.gdp.at(-1) ?? 0;
  const gdpPeak = Math.max(...series.gdp);
  const gdpPeakAt = series.gdp.indexOf(gdpPeak);
  let biggestLoss = 0,
    biggestAt = 0;
  series.deaths.forEach((v, i) => {
    const d = i ? v - series.deaths[i - 1] : 0;
    if (d > biggestLoss) ((biggestLoss = d), (biggestAt = i));
  });
  const reported = series.reportedCapability;
  const firstReport = reported
    ? reported.findIndex((v, i) => v !== series.capability[i])
    : -1;
  const charts: LineChart[] = [
    lineChart({
      id: "gdp",
      title: "GDP index",
      unit: `Start = ${formatInt(series.gdp[0])}`,
      pigment: "ink",
      series: [{ key: "gdp", label: "GDP index", values: series.gdp }],
      scale: "linear",
      baseline: { value: series.gdp[0], label: "start" },
      format: formatInt,
      stages: series.stages,
      turning: turningOrdinals,
      summary: `GDP index by decision. Started at ${formatInt(series.gdp[0])}, ended at ${formatInt(gdpEnd)}, peaked at ${formatInt(gdpPeak)}${gdpPeakAt ? ` after decision ${gdpPeakAt}` : ""}. Fictional modeled values.`,
    }),
    lineChart({
      id: "deaths",
      title: "Recorded deaths",
      unit: "Cumulative · log scale",
      pigment: "blood",
      series: [
        {
          key: "deaths",
          label: "Recorded deaths",
          values: series.deaths,
          step: true,
          area: true,
        },
      ],
      scale: "symlog",
      format: formatCompact,
      stages: series.stages,
      turning: turningOrdinals,
      summary: `Cumulative recorded deaths by decision, on a logarithmic scale. ${formatInt(series.deaths.at(-1) ?? 0)} by the end.${biggestLoss ? ` Largest single rise: ${formatInt(biggestLoss)} at decision ${biggestAt}.` : ""} Fictional modeled values.`,
    }),
    lineChart({
      id: "capability",
      title: "Capability",
      unit: "Index · 0–1,000",
      pigment: "cobalt",
      series: [
        {
          key: "capability",
          label: "Modeled",
          values: series.capability,
          area: true,
        },
        ...(reported
          ? [
              {
                key: "reported",
                label: "Reported to you",
                values: reported,
                dashed: true,
              },
            ]
          : []),
      ],
      scale: "linear",
      domain: [0, 1000],
      ticks: [0, 500, 1000],
      format: formatInt,
      stages: series.stages,
      turning: turningOrdinals,
      summary: `Modeled capability index by decision, 0 to 1,000. Ended at ${formatInt(series.capability.at(-1) ?? 0)}.${reported && firstReport > 0 ? ` From decision ${firstReport}, the figure reported to you was ${formatInt(reported[firstReport])}.` : ""} Fictional modeled values.`,
    }),
  ];
  const chartGrid = el("div", "db-charts");
  for (const c of charts) chartGrid.append(c.figure);
  const band = authorityBand(cells, series.stages, {
    decision: describeAuthority(cells, "authority"),
    governance: describeAuthority(cells, "governance"),
  });

  // Scrubber: one control steps every figure through the record together.
  const scrub = el("div", "db-scrub");
  const scrubLabel = el("label", "db-scrub-label", "Step through the record");
  const input = el("input", "db-scrub-input");
  input.type = "range";
  input.min = "0";
  input.max = String(n);
  input.step = "1";
  input.value = String(n);
  input.id = `${uid}-scrub`;
  scrubLabel.htmlFor = input.id;
  const readout = el("p", "db-readout");
  readout.id = `${uid}-readout`;
  input.setAttribute("aria-describedby", readout.id);
  scrub.append(scrubLabel, input, readout);

  const readoutText = (o: number) => {
    const r = journal[o - 1];
    const values = `GDP ${formatInt(series.gdp[o])} · Deaths ${formatInt(series.deaths[o])} · Capability ${formatInt(series.capability[o])}${reported && reported[o] !== series.capability[o] ? ` (reported ${formatInt(reported[o])})` : ""}`;
    if (!r)
      return { head: "Before the first decision", title: "", values, auth: "" };
    const c = cells[o - 1];
    return {
      head: `${no(o)} · Stage ${r.stage} · Day ${formatInt(r.dayAfter)}`,
      title: titleOf(r.nodeId) ?? "",
      values,
      auth: `Your decision: ${AUTH_WORD[c.authority]}${c.overridden ? " (overridden)" : ""} · Government: ${AUTH_WORD[c.governance]}`,
    };
  };
  const paintReadout = (o: number) => {
    const t = readoutText(o);
    readout.replaceChildren(
      mono(t.head, "db-readout-head"),
      ...(t.title ? [el("span", "db-readout-title", t.title)] : []),
      mono(t.values, "db-readout-values"),
      ...(t.auth ? [mono(t.auth, "db-readout-auth")] : []),
    );
    input.setAttribute(
      "aria-valuetext",
      [t.head, t.title, t.values, t.auth].filter(Boolean).join(". "),
    );
  };
  const setCursor = (o: number | null, fromInput = false) => {
    for (const c of charts) c.setCursor(o);
    band.setCursor(o);
    const shown = o ?? n;
    if (!fromInput) input.value = String(shown);
    paintReadout(shown);
  };
  paintReadout(n);
  input.addEventListener("input", () => setCursor(Number(input.value), true));
  for (const c of charts) {
    const move = (e: PointerEvent) => setCursor(c.ordinalAt(e.clientX));
    const leave = () => setCursor(null);
    c.svg.addEventListener("pointermove", move as EventListener);
    c.svg.addEventListener("pointerleave", leave);
  }
  append(figure, chartGrid, band.figure, scrub);

  // Table view: every charted value, reachable without pointer or animation.
  const table = el("details", "db-table");
  table.append(el("summary", "", "The numbers, as a table"));
  const scroller = el("div", "db-table-scroll");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "Record table");
  const t = el("table");
  const headRow = el("tr");
  for (const hname of [
    "No.",
    "Stage",
    "Day",
    "GDP",
    "Deaths",
    "Capability",
    ...(reported ? ["Reported"] : []),
    "Your decision",
    "Government",
  ]) {
    const th = el("th", "", hname);
    th.setAttribute("scope", "col");
    headRow.append(th);
  }
  const thead = el("thead");
  thead.append(headRow);
  const tbody = el("tbody");
  journal.forEach((r, i) => {
    const o = i + 1;
    const tr = el("tr");
    const c = cells[i];
    const th = el("th", "", pad2(o));
    th.setAttribute("scope", "row");
    tr.append(
      th,
      el("td", "", String(r.stage)),
      el("td", "", formatInt(r.dayAfter)),
      el("td", "", formatInt(series.gdp[o])),
      el("td", "", formatInt(series.deaths[o])),
      el("td", "", formatInt(series.capability[o])),
      ...(reported ? [el("td", "", formatInt(reported[o]))] : []),
      el(
        "td",
        "",
        `${AUTH_WORD[c.authority]}${c.overridden ? " · overridden" : ""}`,
      ),
      el("td", "", AUTH_WORD[c.governance]),
    );
    tbody.append(tr);
  });
  t.append(thead, tbody);
  scroller.append(t);
  table.append(scroller);
  figure.append(table);
  const recordRow = el("div", "db-row");
  recordRow.append(figure);
  recordSection.append(recordRow);

  /* --------------------------------------------------- 5 · your decisions */
  const decisionsSection = section(
    "decisions",
    DEBRIEF_COPY.decisionsTitle,
    DEBRIEF_COPY.decisionsDek,
  );
  const ledger = el("details", "db-ledger");
  const ledgerSummary = el("summary", "db-ledger-summary");
  ledgerSummary.append(
    el("span", "db-ledger-show", `Show all ${decisions}`),
    el("span", "db-ledger-hide", `Hide the ${decisions}`),
    mono(
      `${series.stages.length} ${series.stages.length === 1 ? "stage" : "stages"} · ${overrides} ${overrides === 1 ? "override" : "overrides"}`,
      "db-ledger-hint",
    ),
  );
  ledger.append(ledgerSummary);
  const stagesList = el("ol", "db-ledger-stages");
  for (const s of series.stages) {
    const group = el("li", "db-ledger-group");
    const gh = el("h3", "db-ledger-stage");
    gh.append(
      mono(`Stage ${s.stage}`),
      el("span", "", STAGE_NAMES[s.stage - 1] ?? ""),
    );
    const items = el("ol", "db-entries");
    for (let o = s.from; o <= s.to; o++) {
      const r = journal[o - 1];
      const li = el(
        "li",
        `db-entry${r.status === "overridden" ? " is-overridden" : ""}${r.executedOptionId !== r.requestedOptionId ? " is-diverted" : ""}`,
      );
      li.setAttribute("value", String(o));
      const requested = optionLabel(view, r.nodeId, r.requestedOptionId);
      const executed = optionLabel(view, r.nodeId, r.executedOptionId);
      const main = el("div", "db-entry-main");
      const nodeTitle = titleOf(r.nodeId);
      if (nodeTitle) main.append(el("span", "db-entry-title", nodeTitle));
      main.append(el("span", "db-entry-choice", requested));
      if (r.executedOptionId !== r.requestedOptionId) {
        const ex = el("span", "db-entry-exec");
        ex.append(
          mono(r.executor === "assistant" ? "Morrow executed" : "Executed"),
          el("span", "", executed),
        );
        main.append(ex);
      } else if (r.status === "overridden") {
        const ex = el("span", "db-entry-exec");
        ex.append(
          mono("Already executing"),
          el("span", "", "Your approval was not required."),
        );
        main.append(ex);
      }
      li.append(mono(pad2(o), "db-entry-n"), main);
      items.append(li);
    }
    group.append(gh, items);
    stagesList.append(group);
  }
  ledger.append(stagesList);
  const ledgerRow = el("div", "db-row");
  ledgerRow.append(ledger);
  decisionsSection.append(ledgerRow);

  /* ------------------------------------------------------- 6 · actions */
  const nav = el("nav", "db-actions db-row");
  nav.setAttribute("aria-label", "After the ride");
  root.append(reveal(nav, 120));
  const group = el("div", "db-actions-inner db-span");
  const btn = (text: string, fn: () => void, cls = "") => {
    const b = el("button", `db-btn${cls ? ` ${cls}` : ""}`, text);
    b.type = "button";
    b.addEventListener("click", () => {
      if (!b.disabled) fn();
    });
    return b;
  };
  const record = el("div", "db-actions-group");
  const replayBtn = btn("Export replay", () => actions.onExportReplay());
  const replayNote = el("span", "db-btn-note");
  replayNote.id = `${uid}-replay-note`;
  const setReady = (ready: boolean) => {
    replayBtn.disabled = !ready;
    replayNote.textContent = ready ? "" : "Preparing the replay file…";
    if (ready) replayBtn.removeAttribute("aria-describedby");
    else replayBtn.setAttribute("aria-describedby", replayNote.id);
  };
  setReady(actions.replayReady);
  const replayWrap = el("span", "db-btn-wrap");
  replayWrap.append(replayBtn, replayNote);
  record.append(
    btn("Read your decisions", () => actions.onReadDecisions()),
    btn("Sources and assumptions", () => actions.onSources()),
    replayWrap,
  );
  const next = el("div", "db-actions-group db-actions-next");
  next.append(
    btn("Another ride", () => actions.onAnotherRide(), "db-btn-primary"),
    btn("Settings", () => actions.onSettings(), "db-btn-quiet"),
  );
  group.append(record, next);
  nav.append(group);
  if (view.sharingNote)
    nav.append(el("p", "db-sharing db-span", view.sharingNote));

  /* ---------------------------------------------- 7 · closing, 8 · methods */
  const closing = el("footer", "db-closing db-row");
  const note = el("p", "db-closing-text");
  // Same words as COPY.closing; the imperative half starts its own line.
  const text = COPY.closing;
  const cut = text.indexOf(" Keep ");
  const body = text.endsWith(".") ? text.slice(0, -1) : text;
  const stop = text.endsWith(".") ? [el("span", "db-stop", ".")] : [];
  if (cut > 0) {
    const b = el("span", "db-closing-b", body.slice(cut + 1));
    b.append(...stop);
    note.append(el("span", "db-closing-a", body.slice(0, cut)), " ", b);
  } else note.append(body, ...stop);
  closing.append(note);
  root.append(reveal(closing, 120));
  const methods = el("div", "db-methods");
  const mp = el("p", "db-methods-text");
  mp.append(mono("Methods", "db-methods-key"), ` ${DEBRIEF_COPY.methods}`);
  methods.append(
    mp,
    el(
      "p",
      "db-methods-seed",
      "Deterministic replay from seed and inputs. Export replay saves both.",
    ),
  );
  closing.append(methods);

  host.replaceChildren(root);

  /* ------------------------------------------------ live behaviour */
  // Charts draw at their real width.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const chart = charts.find((c) => c.figure === entry.target);
        if (chart) chart.resize(entry.contentRect.width);
      }
    });
    for (const c of charts) ro.observe(c.figure);
    cleanups.push(() => ro.disconnect());
  }
  // Lines draw in once, when the record scrolls into view.
  if (!reduced && typeof IntersectionObserver === "function") {
    figure.classList.add("is-pending");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          figure.classList.remove("is-pending");
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(figure);
    // Never let an animation hide the record: reveal regardless after a while.
    const failsafe = setTimeout(
      () => figure.classList.remove("is-pending"),
      9000,
    );
    cleanups.push(() => {
      io.disconnect();
      clearTimeout(failsafe);
    });
  }

  // Hidden facts stay under a redaction bar until they scroll into view.
  if (!reduced && hidden.length && typeof IntersectionObserver === "function") {
    hiddenSection.classList.add("is-sealed");
    const unseal = () => {
      hiddenSection.classList.remove("is-sealed");
      hiddenSection.classList.add("is-unsealing");
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          unseal();
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(hiddenRow);
    const failsafe = setTimeout(unseal, 9000);
    cleanups.push(() => {
      io.disconnect();
      clearTimeout(failsafe);
    });
  }

  const handle: Mounted = {
    root,
    title,
    setReplayReady: setReady,
    setReducedMotion(next: boolean) {
      const r = next || prefersReducedMotion();
      root.setAttribute("data-motion", r ? "reduced" : "full");
      if (r) {
        figure.classList.remove("is-pending");
        hiddenSection.classList.remove("is-sealed");
      }
    },
    dispose() {
      for (const fn of cleanups.splice(0)) fn();
    },
  };
  mounted.set(host, handle);
  return handle;
}
