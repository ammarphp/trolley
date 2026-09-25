/**
 * The instrument cluster: reported readings drawn as ink instruments on a
 * glass panel. Built once per host, then updated in place so digits roll,
 * needles travel and deltas flash without rebuilding the DOM.
 *
 * Read-only by design. No engine calls, persistence or telemetry: the app's
 * orchestrator passes an InstrumentsView and this module draws it.
 */
import { el } from "../../dom.ts";
import type {
  GaugeKind,
  InstrumentKey,
  InstrumentMetric,
  InstrumentsView,
} from "./types.ts";
import {
  BASELINE,
  REDLINE,
  accessibleReading,
  assignMarks,
  captionOf,
  countParts,
  deltaFrom,
  deviation,
  flagOf,
  formatCount,
  formatDelta,
  formatFull,
  formatIndex,
  isCountKind,
  kindOf,
  linearPosition,
  linearTicks,
  logPosition,
  logTicks,
  notchPositions,
  provenanceOf,
  scaleMaxOf,
  seriesOf,
  shortCount,
  sparkline,
  supplyState,
  trendOf,
  valueParts,
  type Tick,
} from "./model.ts";
import { Odometer } from "./odometer.ts";

const NS = "http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
function setText(node: Element, text: string) {
  if (node.textContent !== text) node.textContent = text;
}
function pct(p: number) {
  return `${(Math.round(p * 100000) / 1000).toString()}%`;
}
const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

interface Motion {
  /** Animate value changes (false under reduced motion). */
  animate: boolean;
  /** This render is the first-show self-test. */
  boot: boolean;
  /** Boot delay for this gauge, ms. */
  delay: number;
}

/** Tick scale height in px (also the SVG viewBox height, so y is in px). */
const TH = 14;
const SW = 100;
const SH = 34;

// =================================================================== scales

interface Scale {
  el: HTMLElement;
  update(metric: InstrumentMetric, motion: Motion): void;
  /** Show a ghost pointer at a historical value while the history is scrubbed. */
  ghost(value: number | null): void;
}

function scaleShell(kind: GaugeKind) {
  const root = el("div", "ins-scale");
  root.dataset.kind = kind;
  root.setAttribute("aria-hidden", "true");
  const ticks = svg("svg", {
    class: "ins-ticks",
    viewBox: `0 0 1000 ${TH}`,
    preserveAspectRatio: "none",
    focusable: "false",
  });
  const fill = el("span", "ins-fill");
  const needle = el("span", "ins-needle");
  needle.append(el("span", "ins-needle-cap"));
  const ghostEl = el("span", "ins-ghost");
  ghostEl.hidden = true;
  const labels = el("ol", "ins-scale-labels");
  root.append(ticks, fill, ghostEl, needle, labels);
  const ghost = (p: number | null) => {
    ghostEl.hidden = p === null;
    if (p !== null) ghostEl.style.left = pct(p);
  };
  return { root, ticks, fill, needle, labels, ghost };
}

function tickPath(ticks: Tick[], height: number): string {
  return ticks
    .map((t) => `M${Math.round(t.p * 10000) / 10} ${TH}V${TH - height}`)
    .join("");
}

function drawLabels(list: HTMLElement, ticks: Tick[], emphasis?: number) {
  const items = ticks.filter((t) => t.label);
  list.replaceChildren(
    ...items.map((t, i) => {
      const li = el("li", "", t.label);
      li.style.left = pct(t.p);
      li.style.setProperty("--p", String(Math.round(t.p * 1000) / 1000));
      if (i === 0 && t.p < 0.04) li.dataset.edge = "start";
      if (i === items.length - 1 && t.p > 0.96) li.dataset.edge = "end";
      if (emphasis !== undefined && t.value === emphasis)
        li.dataset.emphasis = "true";
      return li;
    }),
  );
}

function baseLine(ticks: SVGSVGElement) {
  ticks.append(svg("path", { class: "ins-rule", d: `M0 ${TH - 0.5}H1000` }));
}

/** GDP and other index readings: linear scale, fill grows from the 1000 baseline. */
function linearScale(kind: "index" | "count"): Scale {
  const s = scaleShell(kind);
  let max = 0;
  return {
    el: s.root,
    update(m, motion) {
      const next = scaleMaxOf(m);
      if (next !== max) {
        max = next;
        const t = kind === "index" ? linearTicks(max) : linearCountTicks(max);
        s.ticks.replaceChildren();
        baseLine(s.ticks);
        s.ticks.append(
          svg("path", { class: "ins-tick", d: tickPath(t.minor, 3.5) }),
          svg("path", {
            class: "ins-tick ins-tick-major",
            d: tickPath(t.major, 7),
          }),
        );
        if (kind === "index") {
          // The datum: a full-height mark at 1000 that rises above the scale.
          const bp = Math.round(linearPosition(BASELINE, 0, max) * 10000) / 10;
          s.ticks.append(
            svg("path", { class: "ins-tick ins-datum", d: `M${bp} ${TH}V-3` }),
          );
        }
        drawLabels(s.labels, t.major, kind === "index" ? BASELINE : undefined);
      }
      const dev =
        kind === "index"
          ? deviation(m.value, BASELINE, max)
          : deviation(m.value, 0, max);
      s.root.style.setProperty("--x", String(dev.pos));
      s.root.style.setProperty("--from", String(dev.from));
      s.root.style.setProperty("--to", String(dev.to));
      s.root.dataset.dir = dev.dir;
      void motion;
    },
    ghost(v) {
      s.ghost(v === null ? null : linearPosition(v, 0, max));
    },
  };
}

function linearCountTicks(max: number) {
  const t = linearTicks(max);
  for (const tick of t.major)
    tick.label =
      tick.value === 0 ? "0" : formatCount(tick.value).replace(" ", "");
  return t;
}

/** Capability: notches that crowd together toward the top, with a danger band. */
function notchScale(): Scale {
  const s = scaleShell("notch");
  const positions = notchPositions(36, 0.935);
  baseLine(s.ticks);
  s.ticks.append(
    svg("path", {
      class: "ins-redline",
      d: `M${REDLINE * 1000} ${TH - 0.5}H1000`,
    }),
  );
  const notches = positions.map((p, i) => {
    const h = 4 + 9 * p ** 1.4;
    const line = svg("path", {
      class: "ins-notch",
      d: `M${Math.round(p * 10000) / 10} ${TH}V${TH - h}`,
    });
    if (p >= REDLINE - 1e-9) line.classList.add("is-red");
    line.style.setProperty("--p", String(p));
    line.style.setProperty("--i", String(i));
    s.ticks.append(line);
    return line;
  });
  let max = 0;
  return {
    el: s.root,
    update(m) {
      const next = scaleMaxOf(m);
      if (next !== max) {
        max = next;
        const t = linearTicks(max);
        drawLabels(s.labels, t.major);
      }
      const pos = linearPosition(m.value, 0, max);
      notches.forEach((n, i) =>
        n.classList.toggle(
          "is-lit",
          m.value > 0 && positions[i]! <= pos + 1e-9,
        ),
      );
      s.root.style.setProperty("--x", String(pos));
      s.root.style.setProperty("--from", "0");
      s.root.style.setProperty("--to", String(pos));
      s.root.dataset.dir = "up";
      s.root.dataset.red = pos >= REDLINE ? "true" : "false";
    },
    ghost(v) {
      s.ghost(v === null ? null : linearPosition(v, 0, max));
    },
  };
}

/** Fatalities: a slide-rule log scale from one person to everyone. */
function logScale(): Scale {
  const s = scaleShell("log");
  let max = 0;
  return {
    el: s.root,
    update(m) {
      const next = scaleMaxOf(m);
      if (next !== max) {
        max = next;
        const t = logTicks(max);
        s.ticks.replaceChildren();
        baseLine(s.ticks);
        const isFive = (v: number) =>
          Math.abs(v / 10 ** Math.floor(Math.log10(v) + 1e-9) - 5) < 1e-6;
        s.ticks.append(
          svg("path", {
            class: "ins-tick ins-tick-minor",
            d: tickPath(
              t.minor.filter((x) => !isFive(x.value)),
              2.5,
            ),
          }),
          svg("path", {
            class: "ins-tick",
            d: tickPath(
              t.minor.filter((x) => isFive(x.value)),
              4.5,
            ),
          }),
          svg("path", {
            class: "ins-tick ins-tick-major",
            d: tickPath(t.major, 7),
          }),
        );
        const labelled = [...t.major];
        if (t.stop) {
          s.ticks.append(
            svg("path", {
              class: "ins-tick ins-tick-stop",
              d: `M999 ${TH}V0M994 ${TH}V3`,
            }),
          );
          labelled.push(t.stop);
        }
        drawLabels(s.labels, labelled);
      }
      const pos = logPosition(m.value, max);
      s.root.style.setProperty("--x", String(pos));
      s.root.style.setProperty("--from", "0");
      s.root.style.setProperty("--to", String(pos));
      s.root.dataset.dir = "up";
    },
    ghost(v) {
      s.ghost(v === null ? null : logPosition(v, max));
    },
  };
}

// =================================================================== sparkline

type Fmt = (v: number) => string;

class Sparkline {
  readonly el: HTMLDivElement;
  private area = svg("path", { class: "ins-spark-area" });
  private base = svg("path", { class: "ins-spark-base" });
  private line = svg("path", { class: "ins-spark-line" });
  private alt = svg("path", { class: "ins-spark-alt" });
  private dot = el("span", "ins-spark-dot");
  private ping = el("span", "ins-spark-ping");
  private probe = el("span", "ins-spark-probe");
  private probeDot = el("span", "ins-spark-probe-dot");
  private tip = el("span", "ins-spark-tip");
  /** Told which historical value is under the probe (null when released). */
  onScrub: ((value: number | null) => void) | null = null;
  private points: Array<{ x: number; y: number; value: number }> = [];
  private scrub: number | null = null;
  private fmt: Fmt = String;
  private label = "";

  constructor() {
    this.el = el("div", "ins-spark");
    this.el.tabIndex = 0;
    this.el.setAttribute("role", "slider");
    this.el.setAttribute("aria-orientation", "horizontal");
    const plot = svg("svg", {
      class: "ins-spark-svg",
      viewBox: `0 0 ${SW} ${SH}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true",
      focusable: "false",
    });
    plot.append(this.area, this.base, this.line, this.alt);
    this.dot.setAttribute("aria-hidden", "true");
    this.ping.setAttribute("aria-hidden", "true");
    this.probe.setAttribute("aria-hidden", "true");
    this.tip.setAttribute("aria-hidden", "true");
    this.probeDot.setAttribute("aria-hidden", "true");
    this.el.append(
      plot,
      this.probe,
      this.ping,
      this.dot,
      this.probeDot,
      this.tip,
    );

    this.el.addEventListener("keydown", (e) => this.onKey(e));
    this.el.addEventListener("pointermove", (e) => this.onPointer(e));
    this.el.addEventListener("pointerdown", (e) => this.onPointer(e));
    this.el.addEventListener("pointerleave", () => {
      if (document.activeElement !== this.el) this.setScrub(null);
    });
    this.el.addEventListener("focus", () =>
      this.setScrub(this.scrub ?? this.points.length - 1),
    );
    this.el.addEventListener("blur", () => this.setScrub(null));
  }

  update(
    series: number[],
    o: {
      log: boolean;
      include?: number[];
      altered: boolean;
      label: string;
      fmt: Fmt;
      fresh: boolean;
      animate: boolean;
    },
  ) {
    this.fmt = o.fmt;
    this.label = o.label;
    const sp = sparkline(series, {
      width: SW,
      height: SH,
      padX: 3,
      padY: 5,
      log: o.log,
      include: o.include,
      maxPoints: 120,
    });
    this.points = sp.points;
    const n = sp.points.length;
    const lastAltered = o.altered && n >= 2;
    if (lastAltered) {
      // The institutional report is the last hop: draw it dashed.
      const pts = sp.points;
      const a = pts[n - 2]!;
      const b = pts[n - 1]!;
      const main = pts.slice(0, n - 1);
      this.line.setAttribute(
        "d",
        main
          .map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(""),
      );
      this.alt.setAttribute(
        "d",
        `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
      );
    } else {
      this.line.setAttribute("d", sp.d);
      this.alt.setAttribute("d", "");
    }
    if (n > 1) {
      const first = sp.points[0]!;
      const last = sp.last!;
      this.area.setAttribute(
        "d",
        `${sp.d}L${last.x.toFixed(2)} ${SH}L${first.x.toFixed(2)} ${SH}Z`,
      );
    } else this.area.setAttribute("d", "");
    const baseY = o.include?.length ? sp.y(o.include[0]!) : null;
    this.base.setAttribute(
      "d",
      baseY === null || n === 0 ? "" : `M0 ${baseY.toFixed(2)}H${SW}`,
    );
    if (sp.last) {
      this.dot.hidden = false;
      this.dot.style.left = pct(sp.last.x / SW);
      this.dot.style.top = pct(sp.last.y / SH);
      this.ping.style.left = this.dot.style.left;
      this.ping.style.top = this.dot.style.top;
    } else this.dot.hidden = true;
    this.el.dataset.altered = String(o.altered);
    this.el.setAttribute("aria-label", `${o.label} history`);
    this.el.setAttribute("aria-valuemin", n ? "1" : "0");
    this.el.setAttribute("aria-valuemax", String(n));
    if (this.scrub !== null && this.scrub >= n) this.scrub = n - 1;
    this.setScrub(this.scrub);
    if (o.fresh && o.animate && typeof this.ping.animate === "function") {
      this.ping.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0.9 },
          { transform: "translate(-50%, -50%) scale(2.6)", opacity: 0 },
        ],
        { duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }

  private setScrub(i: number | null) {
    const n = this.points.length;
    this.scrub = i === null || n === 0 ? null : Math.max(0, Math.min(n - 1, i));
    const at = this.scrub ?? n - 1;
    const p = this.points[at];
    this.el.setAttribute("aria-valuenow", String(n ? at + 1 : 0));
    this.el.setAttribute(
      "aria-valuetext",
      p
        ? `Report ${at + 1} of ${n}: ${formatFull(p.value)}${at === n - 1 ? ", current" : ""}`
        : "No reports",
    );
    if (this.scrub === null || !p) {
      this.el.dataset.scrub = "false";
      this.onScrub?.(null);
      return;
    }
    this.el.dataset.scrub = "true";
    this.onScrub?.(p.value);
    this.probe.style.left = pct(p.x / SW);
    this.probeDot.style.left = pct(p.x / SW);
    this.probeDot.style.top = pct(p.y / SH);
    const tipText = `${at + 1}/${n} · ${this.fmt(p.value)}`;
    setText(this.tip, tipText);
    const x = p.x / SW;
    this.tip.dataset.align = x > 0.6 ? "end" : x < 0.4 ? "start" : "center";
    this.tip.style.left = pct(x);
  }

  private onKey(e: KeyboardEvent) {
    const n = this.points.length;
    if (!n) return;
    const cur = this.scrub ?? n - 1;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + 1;
    else if (e.key === "PageDown") next = cur - 5;
    else if (e.key === "PageUp") next = cur + 5;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    this.setScrub(next);
  }

  private onPointer(e: PointerEvent) {
    const n = this.points.length;
    if (!n) return;
    const r = this.el.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * SW;
    let best = 0;
    let dist = Infinity;
    this.points.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    this.setScrub(best);
  }
}

// =================================================================== deltas

function deltaTone(key: InstrumentKey, delta: number): "blood" | "ink" {
  if (key === "casualties" && delta > 0) return "blood";
  if (key === "population" && delta < 0) return "blood";
  return "ink";
}

function flash(node: HTMLElement, tone: "blood" | "ink") {
  if (typeof node.animate !== "function") return;
  const bg = tone === "blood" ? "var(--blood)" : "var(--ink)";
  node.animate(
    [
      { backgroundColor: bg, color: "var(--paper)", offset: 0 },
      { backgroundColor: bg, color: "var(--paper)", offset: 0.45 },
      { backgroundColor: "transparent", offset: 1 },
    ],
    { duration: 2200, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
  );
}

function renderDelta(
  node: HTMLElement,
  key: InstrumentKey,
  delta: number | null,
  fresh: boolean,
  animate: boolean,
) {
  if (delta === null || Math.round(delta) === 0) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  const kind = kindOf(key);
  setText(node, formatDelta(delta, kind));
  const tone = deltaTone(key, delta);
  node.dataset.tone = tone;
  node.dataset.dir = delta > 0 ? "up" : "down";
  if (fresh && animate) flash(node, tone);
}

// =================================================================== gauge

class Gauge {
  readonly el: HTMLLIElement;
  private labelEl: HTMLHeadingElement;
  private captionEl: HTMLSpanElement;
  private flagEl = el("span", "ins-g-flag");
  private deltaEl: HTMLSpanElement;
  private odo = new Odometer();
  private suffixEl = el("span", "ins-suffix");
  private unitEl = el("span", "ins-unit");
  private markEl = el("span", "ins-mark");
  private srEl = el("span", "ins-sr");
  private spark = new Sparkline();
  private scale: Scale;
  private prov: HTMLElement;
  private provMark = el("span", "ins-prov-mark");
  private provTag = el("span", "ins-prov-tag");
  private provDetail = el("span", "ins-prov-detail");
  private drawn: number | undefined;
  private delta: number | null = null;

  constructor(
    readonly key: InstrumentKey,
    id: string,
  ) {
    const kind = kindOf(key);
    this.el = el("li", "ins-gauge");
    this.el.dataset.key = key;
    this.el.dataset.kind = kind;
    const head = el("div", "ins-g-head");
    this.labelEl = el("h3", "ins-g-label");
    this.labelEl.id = `${id}-${key}`;
    this.captionEl = el("span", "ins-g-caption");
    this.captionEl.setAttribute("aria-hidden", "true");
    this.flagEl.setAttribute("aria-hidden", "true");
    this.flagEl.hidden = true;
    this.deltaEl = el("span", "ins-delta");
    this.deltaEl.setAttribute("aria-hidden", "true");
    this.deltaEl.hidden = true;
    head.append(this.labelEl, this.captionEl, this.flagEl, this.deltaEl);

    const read = el("div", "ins-g-read");
    const value = el("p", "ins-value");
    for (const n of [this.suffixEl, this.unitEl, this.markEl])
      n.setAttribute("aria-hidden", "true");
    value.append(
      this.odo.el,
      this.suffixEl,
      this.unitEl,
      this.markEl,
      this.srEl,
    );
    read.append(value, this.spark.el);

    this.scale =
      kind === "notch"
        ? notchScale()
        : kind === "log"
          ? logScale()
          : linearScale(kind);

    this.prov = el("p", "ins-prov");
    this.prov.setAttribute("aria-hidden", "true");
    this.prov.hidden = true;
    this.provMark.setAttribute("aria-hidden", "true");
    this.prov.append(this.provMark, this.provTag, this.provDetail);

    this.el.append(head, read, this.scale.el, this.prov);
    this.spark.onScrub = (v) => {
      this.scale.ghost(v);
      this.el.dataset.scrubbing = String(v !== null);
    };
  }

  update(m: InstrumentMetric, mark: string, motion: Motion) {
    const kind = kindOf(m.key);
    const series = seriesOf(m);
    const first = this.drawn === undefined;
    const changed = !first && m.value !== this.drawn;
    if (first) this.delta = deltaFrom(m.value, m.history);
    else if (changed) this.delta = deltaFrom(m.value, m.history, this.drawn);
    const trend = trendOf(series);
    const prov = provenanceOf(m, mark || undefined);

    setText(this.labelEl, m.label);
    setText(this.captionEl, captionOf(m.key));
    const flag = flagOf(m.key, trend);
    setText(this.flagEl, flag ?? "");
    this.flagEl.hidden = !flag;
    this.el.dataset.trend = trend ?? "none";
    this.el.dataset.altered = String(prov.altered);
    this.el.dataset.tone = kind === "log" && m.value > 0 ? "blood" : "ink";
    this.el.dataset.signal = Number.isFinite(m.value) ? "ok" : "none";

    const parts = valueParts(m);
    this.odo.set(parts.number, {
      animate: motion.animate && (motion.boot || changed),
      dir: motion.boot ? 1 : sign(m.value - (this.drawn ?? 0)),
      spin: motion.boot,
      delay: motion.boot ? motion.delay + 220 : 0,
      stagger: motion.boot ? 70 : 24,
      duration: motion.boot ? 1150 : 760,
    });
    setText(this.suffixEl, parts.suffix);
    this.suffixEl.hidden = !parts.suffix;
    setText(this.unitEl, m.unit ?? "");
    this.unitEl.hidden = !m.unit;
    setText(this.markEl, prov.mark);
    this.markEl.hidden = !prov.mark;

    renderDelta(
      this.deltaEl,
      m.key,
      this.delta,
      changed,
      motion.animate && !motion.boot,
    );

    this.prov.hidden = !prov.altered;
    if (prov.altered) {
      setText(this.provMark, prov.mark);
      setText(this.provTag, prov.tag ?? "");
      setText(
        this.provDetail,
        prov.detail
          ? `“${prov.detail}”`
          : "Not measured by the local instrument.",
      );
    }
    setText(this.srEl, accessibleReading(m, this.delta, prov, trend));

    const fmt: Fmt = isCountKind(kind) ? formatCount : formatIndex;
    this.spark.update(series, {
      log: kind === "log",
      // Log: include 1 as well so a series of zeros lies on the floor, not mid-air.
      include:
        kind === "index" ? [BASELINE] : kind === "log" ? [0, 1] : undefined,
      altered: prov.altered,
      label: m.label,
      fmt,
      fresh: changed,
      animate: motion.animate && !motion.boot,
    });
    this.scale.update(m, motion);
    this.el.style.setProperty("--bd", `${motion.delay}ms`);
    this.drawn = m.value;
  }

  finish() {
    this.odo.finish();
  }
}

// =================================================================== secondary

class SupplyRow {
  readonly el: HTMLLIElement;
  private labelEl = el("span", "ins-row-label");
  private lowEl = el("span", "ins-row-low", "Low");
  private bar = el("span", "ins-row-bar");
  private odo = new Odometer("ins-row-odo");
  private markEl = el("span", "ins-mark");
  private srEl = el("span", "ins-sr");
  private drawn: number | undefined;

  constructor(readonly key: InstrumentKey) {
    this.el = el("li", "ins-row");
    this.el.dataset.key = key;
    this.lowEl.setAttribute("aria-hidden", "true");
    this.markEl.setAttribute("aria-hidden", "true");
    this.bar.setAttribute("aria-hidden", "true");
    const ticks = svg("svg", {
      class: "ins-row-ticks",
      viewBox: "0 0 1000 12",
      preserveAspectRatio: "none",
      focusable: "false",
    });
    ticks.append(
      svg("path", { class: "ins-rule", d: "M0 11.5H1000" }),
      svg("path", {
        class: "ins-tick ins-tick-minor",
        d: "M125 12V9.5M375 12V9.5M625 12V9.5M875 12V9.5",
      }),
      svg("path", {
        class: "ins-tick",
        d: "M0 12V7M250 12V8.5M750 12V8.5M1000 12V7",
      }),
      svg("path", { class: "ins-tick ins-datum", d: "M500 12V-1" }),
    );
    this.bar.append(
      ticks,
      el("span", "ins-row-fill"),
      el("span", "ins-row-tip"),
    );
    const label = el("span", "ins-row-name");
    label.append(this.labelEl, this.lowEl);
    label.setAttribute("aria-hidden", "true");
    const value = el("span", "ins-row-value");
    value.setAttribute("aria-hidden", "true");
    value.append(this.odo.el, this.markEl);
    this.el.append(label, this.bar, value, this.srEl);
  }

  private delta: number | null = null;

  update(m: InstrumentMetric, mark: string, motion: Motion) {
    const first = this.drawn === undefined;
    const changed = !first && m.value !== this.drawn;
    if (first) this.delta = deltaFrom(m.value, m.history);
    else if (changed) this.delta = deltaFrom(m.value, m.history, this.drawn);
    const delta = this.delta;
    const prov = provenanceOf(m, mark || undefined);
    const max = Math.max(2 * BASELINE, scaleMaxOf(m));
    const dev = deviation(m.value, BASELINE, max);
    const state = supplyState(m.value);
    setText(this.labelEl, m.label);
    this.lowEl.hidden = state !== "low";
    this.el.dataset.state = state;
    this.el.dataset.altered = String(prov.altered);
    this.bar.style.setProperty("--x", String(dev.pos));
    this.bar.style.setProperty("--from", String(dev.from));
    this.bar.style.setProperty("--to", String(dev.to));
    this.bar.style.setProperty("--base", String(dev.base));
    this.bar.dataset.dir = dev.dir;
    this.odo.set(valueParts(m).number, {
      animate: motion.animate && (motion.boot || changed),
      dir: motion.boot ? 1 : sign(m.value - (this.drawn ?? 0)),
      spin: motion.boot,
      delay: motion.boot ? motion.delay + 160 : 0,
      stagger: motion.boot ? 60 : 24,
      duration: motion.boot ? 1000 : 700,
    });
    setText(this.markEl, prov.mark);
    this.markEl.hidden = !prov.mark;
    const low = state === "low" ? " Below half of baseline." : "";
    setText(this.srEl, accessibleReading(m, delta, prov) + low);
    this.el.style.setProperty("--bd", `${motion.delay}ms`);
    this.drawn = m.value;
  }

  finish() {
    this.odo.finish();
  }
}

class Population {
  readonly el: HTMLDivElement;
  private ledger = el("span", "ins-pop-bar");
  private ofEl = el("span", "ins-pop-of");
  private labelEl = el("span", "ins-pop-label");
  private odo = new Odometer("ins-pop-odo");
  private suffixEl = el("span", "ins-suffix");
  private markEl = el("span", "ins-mark");
  private deltaEl = el("span", "ins-delta");
  private srEl = el("span", "ins-sr");
  private drawn: number | undefined;
  private delta: number | null = null;

  constructor() {
    this.el = el("div", "ins-pop");
    this.labelEl.setAttribute("aria-hidden", "true");
    for (const n of [this.suffixEl, this.markEl, this.deltaEl])
      n.setAttribute("aria-hidden", "true");
    const value = el("span", "ins-pop-value");
    value.setAttribute("aria-hidden", "true");
    value.append(this.odo.el, this.suffixEl, this.markEl);
    this.deltaEl.hidden = true;
    const line = el("div", "ins-pop-line");
    line.append(this.labelEl, value, this.deltaEl);
    // The ledger: everyone who was alive at the start. Living in ink hatch,
    // the dead in blood from the right. Linear, so small losses stay small.
    const ledger = el("div", "ins-pop-ledger");
    ledger.setAttribute("aria-hidden", "true");
    this.ledger.append(
      el("span", "ins-pop-living"),
      el("span", "ins-pop-lost"),
    );
    ledger.append(this.ledger, this.ofEl);
    this.el.append(line, ledger, this.srEl);
  }

  update(m: InstrumentMetric, mark: string, motion: Motion) {
    const first = this.drawn === undefined;
    const changed = !first && m.value !== this.drawn;
    if (first) this.delta = deltaFrom(m.value, m.history);
    else if (changed) this.delta = deltaFrom(m.value, m.history, this.drawn);
    const prov = provenanceOf(m, mark || undefined);
    setText(this.labelEl, m.label);
    const parts = m.display
      ? { number: m.display, suffix: "" }
      : countParts(m.value);
    this.odo.set(parts.number, {
      animate: motion.animate && (motion.boot || changed),
      dir: motion.boot ? 1 : sign(m.value - (this.drawn ?? 0)),
      spin: motion.boot,
      delay: motion.boot ? motion.delay + 120 : 0,
      stagger: motion.boot ? 60 : 24,
      duration: motion.boot ? 1000 : 760,
    });
    setText(this.suffixEl, parts.suffix);
    this.suffixEl.hidden = !parts.suffix;
    setText(this.markEl, prov.mark);
    this.markEl.hidden = !prov.mark;
    this.el.dataset.altered = String(prov.altered);
    renderDelta(
      this.deltaEl,
      "population",
      this.delta,
      changed,
      motion.animate && !motion.boot,
    );
    const total = scaleMaxOf(m);
    const living = linearPosition(m.value, 0, total);
    this.ledger.style.setProperty("--living", String(living));
    setText(this.ofEl, `of ${shortCount(Number(total.toPrecision(3)))}`);
    const lost = Math.max(0, total - m.value);
    setText(
      this.srEl,
      `${accessibleReading(m, this.delta, prov)} ${formatFull(lost)} fewer than the starting ${formatFull(total)}.`,
    );
    this.el.style.setProperty("--bd", `${motion.delay}ms`);
    this.drawn = m.value;
  }

  finish() {
    this.odo.finish();
  }
}

class Secondary {
  readonly el: HTMLElement;
  private pop = new Population();
  private list = el("ul", "ins-rows");
  private rows = new Map<InstrumentKey, SupplyRow>();
  private notes = el("ol", "ins-notes");

  constructor(id: string) {
    this.el = el("section", "ins-sec");
    const head = el("div", "ins-sec-head");
    const title = el("h3", "ins-sec-title", "Systems");
    title.id = `${id}-sys`;
    const cap = el("span", "ins-sec-caption", "1000 = baseline");
    cap.setAttribute("aria-hidden", "true");
    head.append(title, cap);
    this.el.setAttribute("aria-labelledby", title.id);
    this.list.setAttribute("role", "list");
    this.notes.setAttribute("aria-hidden", "true");
    this.el.append(head, this.pop.el, this.list, this.notes);
  }

  update(
    metrics: InstrumentMetric[],
    marks: Map<InstrumentKey, string>,
    motion: Motion,
  ) {
    const pop = metrics.find((m) => m.key === "population");
    this.pop.el.hidden = !pop;
    if (pop) this.pop.update(pop, marks.get("population") ?? "", motion);
    const rows = metrics.filter((m) => m.key !== "population");
    const keep = new Set(rows.map((m) => m.key));
    for (const [key, row] of this.rows)
      if (!keep.has(key)) {
        row.el.remove();
        this.rows.delete(key);
      }
    rows.forEach((m, i) => {
      let row = this.rows.get(m.key);
      if (!row) {
        row = new SupplyRow(m.key);
        this.rows.set(m.key, row);
      }
      row.update(m, marks.get(m.key) ?? "", {
        ...motion,
        delay: motion.delay + (i + 1) * 90,
      });
    });
    const order = rows.map((m) => this.rows.get(m.key)!.el);
    if (order.some((node, i) => this.list.children[i] !== node))
      this.list.append(...order);
    // Footnotes for altered supply readings, in mark order.
    const altered = metrics.filter((m) => m.altered);
    this.notes.hidden = altered.length === 0;
    this.notes.replaceChildren(
      ...altered.map((m) => {
        const p = provenanceOf(m, marks.get(m.key));
        const li = el("li", "ins-prov");
        li.append(
          el("span", "ins-prov-mark", p.mark),
          el("span", "ins-prov-tag", p.tag ?? ""),
        );
        li.append(
          el(
            "span",
            "ins-prov-detail",
            `${m.label}${p.detail ? `: “${p.detail}”` : ""}`,
          ),
        );
        return li;
      }),
    );
  }

  finish() {
    this.pop.finish();
    for (const r of this.rows.values()) r.finish();
  }
}

// =================================================================== cluster

interface State {
  root: HTMLElement;
  id: string;
  day: HTMLElement;
  date: HTMLTimeElement;
  list: HTMLUListElement;
  gauges: Map<InstrumentKey, Gauge>;
  secondary: Secondary | null;
  foot: HTMLElement;
  booting: boolean;
  notified: boolean;
  skip: (() => void) | null;
  onBootComplete?: () => void;
}

const states = new WeakMap<HTMLElement, State>();
const booted = new WeakSet<HTMLElement>();
let uid = 0;

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

function create(host: HTMLElement): State {
  const id = `ins${++uid}`;
  const root = el("section", "ins");
  root.setAttribute("aria-labelledby", `${id}-title`);
  const head = el("header", "ins-head");
  const titles = el("div", "ins-titles");
  const title = el("h2", "ins-title", "Instruments");
  title.id = `${id}-title`;
  titles.append(title, el("p", "ins-subtitle", "As reported"));
  const when = el("p", "ins-when");
  const day = el("span", "ins-day");
  const date = el("time", "ins-date");
  when.append(day, date);
  head.append(titles, when);
  const list = el("ul", "ins-gauges");
  list.setAttribute("role", "list");
  const foot = el("p", "ins-foot");
  foot.textContent = "Source: local instrument.";
  root.append(head, list, foot);
  host.replaceChildren(root);
  return {
    root,
    id,
    day,
    date,
    list,
    gauges: new Map(),
    secondary: null,
    foot,
    booting: false,
    notified: false,
    skip: null,
  };
}

function finishAll(st: State) {
  for (const g of st.gauges.values()) g.finish();
  st.secondary?.finish();
  if (typeof st.root.getAnimations === "function")
    for (const a of st.root.getAnimations({ subtree: true })) {
      try {
        a.finish();
      } catch {
        /* infinite or cancelled */
      }
    }
}

function notify(st: State) {
  if (st.notified) return;
  st.notified = true;
  st.onBootComplete?.();
}

function startBoot(st: State) {
  st.booting = true;
  st.root.dataset.boot = "run";
  const done = () => {
    if (!st.booting) return;
    st.booting = false;
    st.root.dataset.boot = "done";
    if (st.skip) {
      st.root.removeEventListener("pointerdown", st.skip);
      st.root.removeEventListener("keydown", st.skip);
      st.skip = null;
    }
    notify(st);
  };
  const skip = () => {
    finishAll(st);
    done();
  };
  st.skip = skip;
  st.root.addEventListener("pointerdown", skip);
  st.root.addEventListener("keydown", skip);
  // Settles when every boot animation has finished (or was cancelled/skipped).
  const anims = st.root.getAnimations({ subtree: true });
  void Promise.allSettled(anims.map((a) => a.finished)).then(done);
}

/**
 * Draw (or update in place) the instrument cluster inside `host`.
 * Hidden before stage 4. The first visible render per host runs the
 * self-test boot unless motion is reduced or `view.boot === false`.
 */
export function renderInstruments(
  host: HTMLElement,
  view: InstrumentsView,
): void {
  let st = states.get(host);
  if (!st) {
    st = create(host);
    states.set(host, st);
  }
  const root = st.root;
  st.onBootComplete = view.onBootComplete;
  const reduced = view.reducedMotion || prefersReducedMotion();
  root.dataset.motion = reduced ? "reduced" : "full";
  root.dataset.stage = String(view.stage);
  root.hidden = view.stage < 4;
  if (root.hidden) return;

  const canAnimate =
    typeof root.getAnimations === "function" &&
    typeof root.animate === "function";
  const firstShow = !booted.has(host);
  booted.add(host);
  const boot = firstShow && !reduced && view.boot !== false && canAnimate;

  setText(st.day, `Day ${view.day}`);
  setText(st.date, view.dateLabel);

  const secondary = view.stage >= 5 ? (view.secondary ?? []) : [];
  const marks = assignMarks([...view.metrics, ...secondary]);
  root.dataset.altered = String(marks.size > 0);
  setText(
    st.foot,
    marks.size > 0
      ? `Source: local instrument, except where marked ${[...marks.values()].join(" ")}.`
      : "Source: local instrument.",
  );
  const casualties = view.metrics.find((m) => m.key === "casualties");
  root.dataset.consequence =
    casualties && casualties.value > 0 ? "true" : "false";

  const keep = new Set(view.metrics.map((m) => m.key));
  for (const [key, gauge] of st.gauges)
    if (!keep.has(key)) {
      gauge.el.remove();
      st.gauges.delete(key);
    }
  view.metrics.forEach((m, i) => {
    let g = st!.gauges.get(m.key);
    if (!g) {
      g = new Gauge(m.key, st!.id);
      st!.gauges.set(m.key, g);
    }
    g.update(m, marks.get(m.key) ?? "", {
      animate: !reduced,
      boot,
      delay: 200 + i * 170,
    });
  });
  const order = view.metrics.map((m) => st!.gauges.get(m.key)!.el);
  if (order.some((node, i) => st!.list.children[i] !== node))
    st.list.append(...order);

  if (secondary.length) {
    if (!st.secondary) {
      st.secondary = new Secondary(st.id);
      root.insertBefore(st.secondary.el, st.foot);
    }
    st.secondary.update(secondary, marks, {
      animate: !reduced,
      boot,
      delay: 200 + view.metrics.length * 170,
    });
  } else if (st.secondary) {
    st.secondary.el.remove();
    st.secondary = null;
  }

  if (boot) startBoot(st);
  else if (!st.booting) {
    root.dataset.boot = "done";
    // Boot suppressed (reduced motion, boot: false): still report it once.
    if (firstShow) notify(st);
  }
}

/** Skip the boot sequence (if running) and settle every rolling digit. */
export function settleInstruments(host: HTMLElement): void {
  const st = states.get(host);
  if (!st) return;
  if (st.booting && st.skip) st.skip();
  else finishAll(st);
}

/** Remove the cluster from `host` and release its state. */
export function disposeInstruments(host: HTMLElement): void {
  const st = states.get(host);
  if (!st) return;
  if (st.skip) {
    st.root.removeEventListener("pointerdown", st.skip);
    st.root.removeEventListener("keydown", st.skip);
  }
  st.booting = false;
  st.onBootComplete = undefined;
  if (typeof st.root.getAnimations === "function")
    for (const a of st.root.getAnimations({ subtree: true })) a.cancel();
  st.root.remove();
  states.delete(host);
}
