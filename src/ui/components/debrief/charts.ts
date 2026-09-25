/**
 * Ink-style figures for the debrief: hairlines, mono axes, one pigment each.
 * Line charts are SVG drawn at their true pixel width (redrawn on resize) so
 * type stays crisp at every size. The authority band and route strip are
 * HTML so they reflow without scaling text.
 */
import {
  formatCompact,
  formatInt,
  type AuthorityCell,
  type RecordSeries,
} from "./model.ts";

const SVG = "http://www.w3.org/2000/svg";

type Attrs = Record<string, string | number>;
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text?: string,
) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* -------------------------------------------------------------- scales */

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (
    (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) *
    mag
  );
}
export function linearTicks(
  lo: number,
  hi: number,
  count = 3,
): { domain: [number, number]; ticks: number[] } {
  if (hi <= lo) hi = lo + 1;
  const step = niceStep(hi - lo, count);
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step)
    ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [a, b], ticks };
}
/** log10(1 + v): zero stays at the baseline, one death is visible, eight billion fits. */
export const symlog = (v: number) => Math.log10(1 + Math.max(0, v));
export function symlogTicks(max: number): {
  domain: [number, number];
  ticks: number[];
} {
  const top = Math.max(2, Math.ceil(symlog(max) - 1e-9));
  // Every decade for small tolls; every third decade (thousand, million, billion) for large.
  const decades = top <= 4 ? [1, 10, 100, 1e3, 1e4] : [1e3, 1e6, 1e9];
  const ticks = [0, ...decades.filter((t) => Math.log10(t) <= top + 1e-9)];
  return { domain: [0, top], ticks };
}

/* ---------------------------------------------------------- line chart */

export type Pigment = "ink" | "blood" | "cobalt";
export interface LineSeries {
  key: string;
  label: string;
  values: number[];
  dashed?: boolean;
  area?: boolean;
  step?: boolean;
}
export interface LineChartSpec {
  id: string;
  title: string;
  unit: string;
  pigment: Pigment;
  series: LineSeries[];
  scale: "linear" | "symlog";
  domain?: [number, number];
  ticks?: number[];
  baseline?: { value: number; label: string };
  format: (v: number) => string;
  stages: RecordSeries["stages"];
  turning: number[];
  summary: string;
}
export interface LineChart {
  figure: HTMLElement;
  svg: SVGSVGElement;
  resize(width: number): void;
  setCursor(ordinal: number | null): void;
  /** Maps a clientX within the svg to the nearest decision (0..N). */
  ordinalAt(clientX: number): number;
}

const H = 206;
const M = { top: 38, right: 52, bottom: 26, left: 0 };

export function lineChart(spec: LineChartSpec): LineChart {
  const figure = h("figure", `db-chart db-chart--${spec.pigment}`);
  figure.setAttribute("data-chart", spec.id);
  const head = h("figcaption", "db-chart-head");
  head.append(
    h("span", "db-chart-title", spec.title),
    h("span", "db-chart-unit", spec.unit),
  );
  figure.append(head);
  const root = svg("svg", {
    class: "chart",
    role: "img",
    "aria-label": spec.summary,
    height: H,
  });
  root.setAttribute("data-pigment", spec.pigment);
  figure.append(root);
  // Plots align across the small multiples; any legend sits beneath.
  if (spec.series.length > 1) {
    const legend = h("ul", "db-legend");
    legend.setAttribute("aria-label", `${spec.title} legend`);
    for (const s of spec.series) {
      const li = h("li", `db-legend-item${s.dashed ? " is-dashed" : ""}`);
      const key = h("span", "db-legend-key");
      key.setAttribute("aria-hidden", "true");
      li.append(key, h("span", "", s.label));
      legend.append(li);
    }
    figure.append(legend);
  }

  const n = Math.max(1, (spec.series[0]?.values.length ?? 1) - 1);
  const all = spec.series.flatMap((s) => s.values);
  let domain: [number, number];
  let ticks: number[];
  if (spec.scale === "symlog")
    ({ domain, ticks } = symlogTicks(Math.max(...all, 1)));
  else if (spec.domain) {
    domain = spec.domain;
    ticks = spec.ticks ?? linearTicks(domain[0], domain[1]).ticks;
  } else {
    const lo = Math.min(...all, spec.baseline?.value ?? Infinity);
    const hi = Math.max(...all, spec.baseline?.value ?? -Infinity);
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
    ({ domain, ticks } = linearTicks(lo - pad, hi + pad));
  }
  const t = (v: number) => (spec.scale === "symlog" ? symlog(v) : v);
  let width = 340;
  let cursor: number | null = null;
  let layer: SVGGElement | null = null;

  const x = (i: number) => M.left + (i / n) * (width - M.left - M.right);
  const y = (v: number) =>
    M.top +
    (1 - (t(v) - domain[0]) / (domain[1] - domain[0] || 1)) *
      (H - M.top - M.bottom);

  function pathFor(s: LineSeries): string {
    let d = `M${x(0).toFixed(1)},${y(s.values[0]).toFixed(1)}`;
    for (let i = 1; i < s.values.length; i++)
      d += s.step
        ? `H${x(i).toFixed(1)}V${y(s.values[i]).toFixed(1)}`
        : `L${x(i).toFixed(1)},${y(s.values[i]).toFixed(1)}`;
    return d;
  }

  function draw() {
    root.replaceChildren();
    root.setAttribute("viewBox", `0 0 ${width} ${H}`);
    root.setAttribute("width", String(width));
    const plotBottom = H - M.bottom;
    // Stage bands: alternate stages sit on a faint paper tone.
    const bands = svg("g", { class: "db-c-stages" });
    for (const s of spec.stages) {
      const x0 = x(s.from - 1),
        x1 = x(s.to);
      if (s.stage % 2 === 0)
        bands.append(
          svg("rect", {
            x: x0,
            y: M.top - 8,
            width: Math.max(0, x1 - x0),
            height: plotBottom - M.top + 8,
            class: "db-c-band",
          }),
        );
      if (x1 - x0 >= 12)
        bands.append(
          svg(
            "text",
            {
              x: (x0 + x1) / 2,
              y: H - 8,
              class: "db-c-stage",
              "text-anchor": "middle",
            },
            String(s.stage),
          ),
        );
    }
    bands.append(
      svg(
        "text",
        { x: x(n) + 8, y: H - 8, class: "db-c-stage db-c-stage-key" },
        "stage",
      ),
    );
    root.append(bands);
    // Gridlines with labels sitting on them.
    const grid = svg("g", { class: "db-c-grid" });
    let lastLabel = Infinity;
    for (const v of ticks) {
      const gy = y(v);
      grid.append(
        svg("line", {
          x1: M.left,
          x2: x(n),
          y1: gy,
          y2: gy,
          class: v === ticks[0] ? "db-c-axis" : "db-c-rule",
        }),
      );
      // Labels sit on their rule; skip one that would crowd its neighbour.
      if (lastLabel - gy < 13) continue;
      lastLabel = gy;
      grid.append(
        svg(
          "text",
          { x: M.left, y: gy - 4, class: "db-c-tick" },
          spec.scale === "symlog" ? formatCompact(v) : formatInt(v),
        ),
      );
    }
    if (spec.baseline) {
      const by = y(spec.baseline.value);
      grid.append(
        svg("line", {
          x1: M.left,
          x2: x(n),
          y1: by,
          y2: by,
          class: "db-c-baseline",
        }),
      );
      // The head already names the start; label it here only when no tick does.
      if (!ticks.includes(spec.baseline.value))
        grid.append(
          svg(
            "text",
            { x: M.left, y: by - 4, class: "db-c-tick" },
            spec.baseline.label,
          ),
        );
    }
    root.append(grid);
    // Turning points: numbered hairlines.
    const turns = svg("g", { class: "db-c-turns" });
    // Neighbours that would touch stagger onto a second row.
    let prevX = -Infinity;
    let raised = false;
    spec.turning.forEach((ordinal, i) => {
      const tx = x(ordinal);
      raised = tx - prevX < 15 ? !raised : false;
      prevX = tx;
      const cy = raised ? 8 : 22;
      turns.append(
        svg("line", {
          x1: tx,
          x2: tx,
          y1: cy + 6.5,
          y2: plotBottom,
          class: "db-c-turn",
        }),
      );
      turns.append(
        svg("circle", { cx: tx, cy, r: 6.5, class: "db-c-turn-dot" }),
      );
      turns.append(
        svg(
          "text",
          { x: tx, y: cy + 3, class: "db-c-turn-n", "text-anchor": "middle" },
          String(i + 1),
        ),
      );
    });
    root.append(turns);
    // Series.
    const marks = svg("g", { class: "db-c-marks" });
    spec.series.forEach((s, si) => {
      const d = pathFor(s);
      if (s.area)
        marks.append(
          svg("path", { d: `${d}V${plotBottom}H${x(0)}Z`, class: "db-c-area" }),
        );
      marks.append(
        svg("path", {
          d,
          class: `db-c-line${s.dashed ? " is-dashed" : ""}${si ? " is-secondary" : ""}`,
          pathLength: 1,
        }),
      );
    });
    // End dot and label on the primary series only; the legend names the rest.
    const primary = spec.series[0];
    if (primary) {
      const last = primary.values.length - 1;
      const ex = x(last),
        ey = y(primary.values[last]);
      marks.append(
        svg("circle", { cx: ex, cy: ey, r: 3.5, class: "db-c-end" }),
      );
      marks.append(
        svg(
          "text",
          { x: ex + 8, y: ey + 3.5, class: "db-c-value" },
          spec.format(primary.values[last]),
        ),
      );
      const other = spec.series[1];
      if (other && Math.abs(y(other.values[last]) - ey) > 14)
        marks.append(
          svg(
            "text",
            {
              x: ex + 8,
              y: y(other.values[last]) + 3.5,
              class: "db-c-value is-secondary",
            },
            spec.format(other.values[last]),
          ),
        );
    }
    root.append(marks);
    layer = svg("g", { class: "db-c-cursor", "aria-hidden": "true" });
    root.append(layer);
    paintCursor();
  }

  function paintCursor() {
    if (!layer) return;
    layer.replaceChildren();
    if (cursor === null) return;
    const cx = x(cursor);
    layer.append(
      svg("line", {
        x1: cx,
        x2: cx,
        y1: M.top - 8,
        y2: H - M.bottom,
        class: "db-c-crosshair",
      }),
    );
    spec.series.forEach((s, si) => {
      const v = s.values[cursor!];
      if (v === undefined) return;
      layer!.append(
        svg("circle", {
          cx,
          cy: y(v),
          r: 4,
          class: `db-c-hit${si ? " is-secondary" : ""}`,
        }),
      );
    });
  }

  draw();
  return {
    figure,
    svg: root,
    resize(next: number) {
      const w = Math.max(220, Math.round(next));
      if (w === width) return;
      width = w;
      draw();
    },
    setCursor(ordinal) {
      cursor = ordinal === null ? null : Math.max(0, Math.min(n, ordinal));
      paintCursor();
    },
    ordinalAt(clientX: number) {
      const rect = root.getBoundingClientRect();
      const scale = rect.width ? width / rect.width : 1;
      const px = (clientX - rect.left) * scale;
      return Math.max(
        0,
        Math.min(
          n,
          Math.round(((px - M.left) / (width - M.left - M.right)) * n),
        ),
      );
    },
  };
}

/* ------------------------------------------------------- authority band */

export interface AuthorityBand {
  figure: HTMLElement;
  setCursor(ordinal: number | null): void;
}
const AUTH_LABEL: Record<AuthorityCell["authority"], string> = {
  human: "Human",
  delegated: "Delegated to Morrow",
  assistant: "Morrow",
};
export function authorityBand(
  cells: readonly AuthorityCell[],
  stages: RecordSeries["stages"],
  summaries: { decision: string; governance: string },
): AuthorityBand {
  const figure = h("figure", "db-band");
  const head = h("figcaption", "db-chart-head");
  head.append(
    h("span", "db-chart-title", "Who held the controls"),
    h(
      "span",
      "db-chart-unit",
      "Per decision · derived from the permission record",
    ),
  );
  figure.append(head);
  const grid = h("div", "db-band-grid");
  grid.style.setProperty("--n", String(cells.length));
  const rows: HTMLElement[][] = [];
  const rowDefs: {
    key: "authority" | "governance";
    label: string;
    summary: string;
  }[] = [
    { key: "authority", label: "Your decision", summary: summaries.decision },
    { key: "governance", label: "Government", summary: summaries.governance },
  ];
  for (const def of rowDefs) {
    const label = h("span", "db-band-label", def.label);
    label.setAttribute("aria-hidden", "true");
    const row = h("div", "db-band-row");
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", `${def.label}: ${def.summary}.`);
    const list: HTMLElement[] = [];
    for (const c of cells) {
      const cell = h("span", `db-cell is-${c[def.key]}`);
      if (def.key === "authority" && c.overridden)
        cell.classList.add("is-overridden");
      cell.title = `No. ${c.ordinal} · ${AUTH_LABEL[c[def.key]]}${def.key === "authority" && c.overridden ? " · overridden" : ""}`;
      row.append(cell);
      list.push(cell);
    }
    rows.push(list);
    grid.append(label, row);
  }
  // Stage numerals beneath, spanning their decisions.
  const axisLabel = h("span", "db-band-label db-band-axis-label", "Stage");
  axisLabel.setAttribute("aria-hidden", "true");
  const axis = h("div", "db-band-axis");
  axis.setAttribute("aria-hidden", "true");
  for (const s of stages) {
    const tick = h("span", "db-band-stage", String(s.stage));
    tick.style.gridColumn = `${s.from} / ${s.to + 1}`;
    axis.append(tick);
  }
  grid.append(axisLabel, axis);
  figure.append(grid);
  const legend = h("ul", "db-legend db-band-legend");
  legend.setAttribute("aria-label", "Legend");
  for (const [cls, text] of [
    ["is-human", "Human"],
    ["is-delegated", "Delegated to Morrow"],
    ["is-assistant", "Morrow"],
    ["is-overridden", "Lever overridden"],
  ] as const) {
    const li = h("li", "db-legend-item");
    const sw = h("span", `db-swatch ${cls}`);
    sw.setAttribute("aria-hidden", "true");
    li.append(sw, h("span", "", text));
    legend.append(li);
  }
  figure.append(legend);
  let current: number | null = null;
  return {
    figure,
    setCursor(ordinal) {
      for (const row of rows) {
        if (current !== null) row[current - 1]?.classList.remove("is-cursor");
        if (ordinal !== null && ordinal > 0)
          row[ordinal - 1]?.classList.add("is-cursor");
      }
      current = ordinal !== null && ordinal > 0 ? ordinal : null;
    },
  };
}

/* ---------------------------------------------------------- route strip */

export interface RouteStop {
  ordinal: number;
  stage: number;
  overridden: boolean;
  deaths: number;
  turning: number | null;
  /** Who governed when this decision was taken; the rails turn cobalt under Morrow. */
  governance: AuthorityCell["governance"];
}
/** The ride as a length of track: one sleeper per decision, ending at a buffer stop. */
export function routeStrip(
  stops: readonly RouteStop[],
  summary: string,
  endLabel: string,
): HTMLElement {
  const figure = h("figure", "db-route");
  const track = h("div", "db-route-track");
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", summary);
  const sleepers = h("ol", "db-route-sleepers");
  sleepers.setAttribute("aria-hidden", "true");
  sleepers.style.setProperty("--n", String(stops.length));
  let lastStage = 0;
  let lastTurn = -Infinity;
  let raised = false;
  for (const s of stops) {
    const li = h("li", "db-sleeper");
    if (s.stage !== lastStage) {
      li.classList.add("is-stage-start");
      li.append(h("span", "db-sleeper-stage", String(s.stage)));
      lastStage = s.stage;
    }
    if (s.overridden) li.classList.add("is-overridden");
    if (s.governance !== "human") li.classList.add(`gov-${s.governance}`);
    if (s.turning !== null) {
      // Neighbouring flags stagger so they never collide at phone widths.
      raised = s.ordinal - lastTurn <= 2 ? !raised : false;
      lastTurn = s.ordinal;
      li.classList.add("is-turning");
      if (raised) li.classList.add("is-raised");
      li.append(h("span", "db-flag", String(s.turning)));
    }
    if (s.deaths > 0) {
      const dot = h("span", "db-loss");
      const size = Math.min(22, 3 + 2.1 * Math.log10(1 + s.deaths));
      dot.style.setProperty("--s", `${size.toFixed(1)}px`);
      li.append(dot);
    }
    sleepers.append(li);
  }
  // Buffer stop, as a track schematic draws it: a heavy bar across both rails.
  const stop = svg("svg", {
    class: "db-buffer",
    viewBox: "0 0 14 28",
    width: 14,
    height: 28,
    "aria-hidden": "true",
  });
  stop.append(
    svg("rect", { x: 5, y: 0, width: 4, height: 28 }),
    svg("rect", { x: 0, y: 13, width: 5, height: 2 }),
  );
  track.append(sleepers, stop);
  figure.append(track);
  const cap = h("figcaption", "db-route-caption");
  const legend = h("ul", "db-legend");
  legend.setAttribute("aria-label", "Legend");
  const morrow = stops.some((s) => s.governance === "assistant");
  for (const [cls, text] of [
    ["is-flag", "Turning point"],
    ...(morrow
      ? ([["is-morrow", "Rails in blue: Morrow governed"]] as const)
      : []),
    ["is-overridden", "Lever overridden"],
    ["is-loss", "Deaths recorded · size by order of magnitude"],
  ] as const) {
    const li = h("li", "db-legend-item");
    const sw = h("span", `db-route-key ${cls}`);
    sw.setAttribute("aria-hidden", "true");
    li.append(sw, h("span", "", text));
    legend.append(li);
  }
  cap.append(legend, h("span", "db-route-end", endLabel));
  figure.append(cap);
  return figure;
}
