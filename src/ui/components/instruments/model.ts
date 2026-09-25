/**
 * Pure instrument maths: number formatting, scale geometry, sparkline paths,
 * deltas and provenance. No DOM, no clocks, no randomness — everything here is
 * deterministic and unit-tested (tests/v2/instruments.test.ts).
 */
import type { GaugeKind, InstrumentKey, InstrumentMetric } from "./types.ts";

export const MINUS = "\u2212";
const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// ------------------------------------------------------------------ numbers

/** Full precision with grouping, for accessible text: 8,000,000,000. */
export function formatFull(n: number): string {
  if (!Number.isFinite(n)) return "unavailable";
  const r = Math.round(n);
  return (r < 0 ? MINUS : "") + GROUPED.format(Math.abs(r));
}

/** Three significant figures for x in [1, 1000). */
function sig3(x: number): string {
  let digits = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  let s = x.toFixed(digits);
  // Rounding can carry into the next decade (9.996 -> "10.00").
  while (digits > 0 && Number(s) >= (digits === 2 ? 10 : 100)) {
    digits -= 1;
    s = x.toFixed(digits);
  }
  return s;
}

const UNITS: Array<[number, string]> = [
  [1e12, "tn"],
  [1e9, "bn"],
  [1e6, "m"],
];

export interface NumberParts {
  /** Characters for the digit window (digits, separators, sign). */
  number: string;
  /** Magnitude suffix, e.g. "bn", or "". */
  suffix: string;
}

/**
 * Counts of people. Below a million: grouped integers ("12,345"). Above:
 * three significant figures with an editorial suffix ("1.23 m", "8.00 bn").
 */
export function countParts(n: number): NumberParts {
  if (!Number.isFinite(n)) return { number: "—", suffix: "" };
  const sign = n < 0 ? MINUS : "";
  const a = Math.abs(Math.round(n));
  if (a < 1e6) return { number: sign + GROUPED.format(a), suffix: "" };
  for (let u = UNITS.length - 1; u >= 0; u--) {
    const [size, suffix] = UNITS[u]!;
    const next = UNITS[u - 1];
    if (next && a >= next[0]) continue;
    const s = sig3(a / size);
    // 999,999,999 rounds to "1000 m": promote it to "1.00 bn".
    if (Number(s) >= 1000 && next)
      return { number: sign + sig3(a / next[0]), suffix: next[1] };
    return { number: sign + s, suffix };
  }
  return { number: sign + GROUPED.format(a), suffix: "" };
}

export function formatCount(n: number): string {
  const p = countParts(n);
  return p.suffix ? `${p.number} ${p.suffix}` : p.number;
}

/** Index readings (GDP, capability, supply): plain integers, grouped only past 9,999. */
export function formatIndex(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n);
  const a = Math.abs(r);
  return (r < 0 ? MINUS : "") + (a >= 10000 ? GROUPED.format(a) : String(a));
}

export function kindOf(key: InstrumentKey): GaugeKind {
  if (key === "capability") return "notch";
  if (key === "casualties") return "log";
  if (key === "population") return "count";
  return "index";
}

export function isCountKind(kind: GaugeKind): boolean {
  return kind === "log" || kind === "count";
}

/** What the digit window shows for a metric. `display` overrides the number. */
export function valueParts(
  metric: Pick<InstrumentMetric, "key" | "value" | "display">,
): NumberParts {
  if (metric.display !== undefined && metric.display !== "")
    return { number: metric.display, suffix: "" };
  return isCountKind(kindOf(metric.key))
    ? countParts(metric.value)
    : { number: formatIndex(metric.value), suffix: "" };
}

/** Signed delta: "+12", "−3", "+1.20 bn", "±0". */
export function formatDelta(delta: number, kind: GaugeKind): string {
  if (!Number.isFinite(delta)) return "";
  if (Math.round(delta) === 0) return "±0";
  const sign = delta > 0 ? "+" : MINUS;
  const a = Math.abs(delta);
  return sign + (isCountKind(kind) ? formatCount(a) : formatIndex(a));
}

// ------------------------------------------------------------------ series

function finite(values: readonly number[]): number[] {
  const out: number[] = [];
  let last = 0;
  for (const v of values) {
    last = Number.isFinite(v) ? v : last;
    out.push(last);
  }
  return out;
}

/** History with the current value as the newest point. */
export function seriesOf(
  metric: Pick<InstrumentMetric, "value" | "history">,
): number[] {
  const h = finite(metric.history ?? []);
  if (!Number.isFinite(metric.value)) return h;
  if (h.length === 0 || h[h.length - 1] !== metric.value) h.push(metric.value);
  return h;
}

/**
 * Change since the previous report. With `previous` (the value this cluster
 * last drew) that wins; otherwise the history supplies the prior point.
 * Returns null when there is nothing to compare against.
 */
export function deltaFrom(
  value: number,
  history: readonly number[],
  previous?: number,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (typeof previous === "number" && Number.isFinite(previous))
    return value - previous;
  const h = history.filter((v) => Number.isFinite(v));
  const n = h.length;
  if (n === 0) return null;
  const prior = h[n - 1] === value ? h[n - 2] : h[n - 1];
  return prior === undefined ? null : value - prior;
}

export type Trend = "accelerating" | "rising" | "flat" | "falling";

/** Second difference of the last three reports. Null with fewer than two. */
export function trendOf(series: readonly number[]): Trend | null {
  const h = series.filter((v) => Number.isFinite(v));
  const n = h.length;
  if (n < 2) return null;
  const d2 = h[n - 1]! - h[n - 2]!;
  if (d2 === 0) return "flat";
  if (d2 < 0) return "falling";
  if (n >= 3) {
    const d1 = h[n - 2]! - h[n - 3]!;
    if (d1 >= 0 && d2 > d1 + Math.max(0.5, Math.abs(d1) * 0.01))
      return "accelerating";
  }
  return "rising";
}

// ------------------------------------------------------------------ scales

export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

export function linearPosition(
  value: number,
  min: number,
  max: number,
): number {
  return max > min ? clamp01((value - min) / (max - min)) : 0;
}

/**
 * Log position in [0, 1] using log10(1 + v), so 0 sits at the origin, 20 is
 * visibly off it, and 8,000,000,000 nearly fills a 10^10 scale.
 */
export function logPosition(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return clamp01(Math.log10(1 + value) / Math.log10(1 + max));
}

/** A round step so that `range / step` is about `target` intervals. */
export function niceStep(range: number, target = 4): number {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

const DEFAULT_MAX: Record<GaugeKind, number> = {
  index: 2000,
  notch: 1000,
  log: 1e10,
  count: 8e9,
};

/** The scale ceiling for a metric: scaleMax, extended in half-steps if exceeded. */
export function scaleMaxOf(
  metric: Pick<InstrumentMetric, "key" | "value" | "history" | "scaleMax">,
): number {
  const kind = kindOf(metric.key);
  const base =
    metric.scaleMax && metric.scaleMax > 0
      ? metric.scaleMax
      : DEFAULT_MAX[kind];
  const hi = Math.max(metric.value, ...finite(metric.history ?? []));
  if (!(hi > base)) return base;
  if (kind === "log") return 10 ** Math.ceil(Math.log10(hi));
  const half = base / 2;
  return Math.ceil(hi / half) * half;
}

export interface Tick {
  /** Position in [0, 1]. */
  p: number;
  value: number;
  label?: string;
}

/** Linear scale: minor ticks every step/5, labelled majors. */
export function linearTicks(
  max: number,
  target = 4,
): { major: Tick[]; minor: Tick[] } {
  const step = niceStep(max, target);
  const minorStep = step / 5;
  const major: Tick[] = [];
  const minor: Tick[] = [];
  const count = Math.round(max / minorStep);
  for (let i = 0; i <= count; i++) {
    const value = Math.round(i * minorStep * 1000) / 1000;
    if (value > max + 1e-9) break;
    const p = linearPosition(value, 0, max);
    if (i % 5 === 0) major.push({ p, value, label: formatIndex(value) });
    else minor.push({ p, value });
  }
  return { major, minor };
}

/** "1", "10", "100", "1k" … "10bn": tick labels for a log scale of people. */
export function shortCount(n: number): string {
  if (n >= 1e12) return `${trim(n / 1e12)}tn`;
  if (n >= 1e9) return `${trim(n / 1e9)}bn`;
  if (n >= 1e6) return `${trim(n / 1e6)}m`;
  if (n >= 1e3) return `${trim(n / 1e3)}k`;
  return trim(n);
}
function trim(x: number): string {
  return String(Math.round(x * 100) / 100);
}

/**
 * Slide-rule log ticks from 1 to `max`: decades are majors, 2..9 are minors.
 * Only every `labelEvery`-th decade is labelled, plus the end stop when it is
 * not itself a decade (e.g. a population of 8.00 bn).
 */
export function logTicks(
  max: number,
  labelEvery = 2,
): { major: Tick[]; minor: Tick[]; stop: Tick | null } {
  const major: Tick[] = [];
  const minor: Tick[] = [];
  const top = Math.floor(Math.log10(max) + 1e-9);
  for (let d = 0; d <= top; d++) {
    const value = 10 ** d;
    const p = logPosition(value, max);
    major.push({
      p,
      value,
      label: d % labelEvery === 0 ? shortCount(value) : undefined,
    });
    for (let m = 2; m <= 9; m++) {
      const v = m * value;
      if (v > max * (1 + 1e-9)) break;
      minor.push({ p: logPosition(v, max), value: v });
    }
  }
  const isDecade = Math.abs(Math.log10(max) - top) < 1e-9;
  const stop = isDecade
    ? null
    : { p: 1, value: max, label: shortCount(Number(max.toPrecision(2))) };
  if (stop) {
    // Drop decade labels that would collide with the end-stop label.
    for (const t of major) if (t.label && 1 - t.p < 0.16) t.label = undefined;
  } else {
    const last = major[major.length - 1];
    if (last) last.label = shortCount(last.value);
  }
  return { major, minor, stop };
}

/**
 * Capability notches: `count` gaps shrinking geometrically by `ratio`, so the
 * marks crowd together toward the top of the scale like a tachometer.
 * Returns count + 1 positions from 0 to 1.
 */
export function notchPositions(count: number, ratio = 0.94): number[] {
  const n = Math.max(1, Math.floor(count));
  const gaps: number[] = [];
  for (let i = 0; i < n; i++) gaps.push(ratio ** i);
  const total = gaps.reduce((a, b) => a + b, 0);
  const out = [0];
  let acc = 0;
  for (const g of gaps) {
    acc += g;
    out.push(acc / total);
  }
  out[out.length - 1] = 1;
  return out;
}

/** The upper fraction of the capability scale that is marked as a danger band. */
export const REDLINE = 0.8;

export interface Deviation {
  /** Baseline position. */
  base: number;
  /** Value position. */
  pos: number;
  /** Fill start and end positions. */
  from: number;
  to: number;
  dir: "up" | "down" | "flat";
}

/** A bar that grows from the baseline toward the value. */
export function deviation(
  value: number,
  baseline: number,
  max: number,
): Deviation {
  const base = linearPosition(baseline, 0, max);
  const pos = linearPosition(value, 0, max);
  return {
    base,
    pos,
    from: Math.min(base, pos),
    to: Math.max(base, pos),
    dir: pos > base ? "up" : pos < base ? "down" : "flat",
  };
}

export const BASELINE = 1000;

/** Supply below half of baseline is flagged in words and in signal ink. */
export function supplyState(value: number, baseline = BASELINE): "low" | "ok" {
  return Number.isFinite(value) && value < baseline * 0.5 ? "low" : "ok";
}

// ------------------------------------------------------------------ sparkline

export interface SparkPoint {
  x: number;
  y: number;
  value: number;
  /** Index into the original series. */
  index: number;
}

export interface Spark {
  /** SVG path data, "" for an empty series. */
  d: string;
  points: SparkPoint[];
  last: SparkPoint | null;
  /** Domain actually used, in value space. */
  lo: number;
  hi: number;
  /** Map a value to y in the same coordinate space. */
  y(value: number): number;
}

export interface SparkOptions {
  width: number;
  height: number;
  padX?: number;
  padY?: number;
  /** Plot log10(1 + v) instead of v. */
  log?: boolean;
  /** Values the domain must include (e.g. the 1000 baseline). */
  include?: readonly number[];
  /** Decimate longer series to this many points (first and last kept). */
  maxPoints?: number;
}

function r2(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(r === 0 ? 0 : r);
}

export function sparkline(
  values: readonly number[],
  opts: SparkOptions,
): Spark {
  const { width, height } = opts;
  const padX = opts.padX ?? 0;
  const padY = opts.padY ?? 0;
  const tf = opts.log
    ? (v: number) => Math.log10(1 + Math.max(0, v))
    : (v: number) => v;
  const series = finite(values);
  const n = series.length;
  const maxPoints = Math.max(2, opts.maxPoints ?? 160);
  const idx: number[] = [];
  if (n <= maxPoints) for (let i = 0; i < n; i++) idx.push(i);
  else
    for (let k = 0; k < maxPoints; k++)
      idx.push(Math.round((k * (n - 1)) / (maxPoints - 1)));

  const domain = [
    ...series,
    ...(opts.include ?? []).filter((v) => Number.isFinite(v)),
  ];
  let lo = domain.length ? Math.min(...domain) : 0;
  let hi = domain.length ? Math.max(...domain) : 0;
  const tlo = tf(lo);
  const thi = tf(hi);
  const span = thi - tlo;
  const top = padY;
  const bottom = height - padY;
  const y = (v: number) =>
    span > 0 ? bottom - ((tf(v) - tlo) / span) * (bottom - top) : height / 2;
  const x = (i: number) =>
    n > 1 ? padX + (i / (n - 1)) * (width - 2 * padX) : width - padX;

  const points: SparkPoint[] = idx.map((i) => ({
    x: x(i),
    y: y(series[i]!),
    value: series[i]!,
    index: i,
  }));
  let d = "";
  if (n === 1) {
    const p = points[0]!;
    d = `M${r2(padX)} ${r2(p.y)}L${r2(p.x)} ${r2(p.y)}`;
  } else if (n > 1) {
    d = points.map((p, k) => `${k ? "L" : "M"}${r2(p.x)} ${r2(p.y)}`).join("");
  }
  if (!domain.length) lo = hi = 0;
  return { d, points, last: points[points.length - 1] ?? null, lo, hi, y };
}

// ------------------------------------------------------------------ provenance

/** The visible tag on any reading an institution supplied. */
export const INSTITUTIONAL_TAG = "SOURCE · INSTITUTIONAL REPORT";
export const LOCAL_SOURCE = "Local instrument";
const MARKS = ["†", "‡", "§", "‖", "¶"];

export interface Provenance {
  altered: boolean;
  /** Footnote mark after the digits; "" for local readings. */
  mark: string;
  /** Visible tag, or null for local readings. */
  tag: string | null;
  /** The institution's own label for the report, when it gave one. */
  detail: string | null;
  /** Spoken provenance sentence. */
  accessible: string;
}

/**
 * Where a reading came from. An altered reading always carries a visible tag
 * and mark: the research design depends on the player being able to see that
 * the number on the dial is a report, not a measurement.
 */
export function provenanceOf(
  metric: Pick<InstrumentMetric, "altered" | "source">,
  mark = MARKS[0]!,
): Provenance {
  const source = (metric.source ?? "").trim();
  if (!metric.altered) {
    return {
      altered: false,
      mark: "",
      tag: null,
      detail: null,
      accessible: `Source: ${(source || LOCAL_SOURCE).toLowerCase()}.`,
    };
  }
  const generic =
    !source || /^(local instrument|institutional report)$/i.test(source);
  const detail = generic ? null : source;
  return {
    altered: true,
    mark,
    tag: INSTITUTIONAL_TAG,
    detail,
    accessible: `Source: institutional report${detail ? `, “${detail}”` : ""}. Not measured by the local instrument.`,
  };
}

/** Footnote marks in reading order, only for altered metrics. */
export function assignMarks(
  metrics: ReadonlyArray<Pick<InstrumentMetric, "key" | "altered">>,
): Map<InstrumentKey, string> {
  const out = new Map<InstrumentKey, string>();
  let i = 0;
  for (const m of metrics) {
    if (!m.altered || out.has(m.key)) continue;
    out.set(
      m.key,
      MARKS[i % MARKS.length]!.repeat(Math.floor(i / MARKS.length) + 1),
    );
    i++;
  }
  return out;
}

const CAPTIONS: Record<InstrumentKey, string> = {
  gdp: "Index · base 1000",
  capability: "Index",
  casualties: "Log scale",
  population: "Living",
  power: "Index",
  care: "Index",
  food: "Index",
};

export function captionOf(
  key: InstrumentKey,
  trend: Trend | null = null,
): string {
  const base = CAPTIONS[key];
  return key === "capability" && trend === "accelerating"
    ? `${base} · accelerating`
    : base;
}

/** A trend worth flagging in signal ink: only capability acceleration. */
export function flagOf(key: InstrumentKey, trend: Trend | null): string | null {
  return key === "capability" && trend === "accelerating"
    ? "Accelerating"
    : null;
}

function deltaSentence(delta: number | null, kind: GaugeKind): string {
  if (delta === null || !Number.isFinite(delta)) return "";
  if (Math.round(delta) === 0) return " Unchanged since the previous report.";
  const a = formatFull(Math.abs(delta));
  return ` ${delta > 0 ? "Up" : "Down"} ${a}${isCountKind(kind) ? "" : " points"} since the previous report.`;
}

const SPOKEN_UNIT: Record<GaugeKind, string> = {
  index: ", index where 1,000 is the baseline",
  notch: ", reported index",
  log: " reported deaths",
  count: " people",
};

/** The complete spoken reading: value at full precision, change, trend, source. */
export function accessibleReading(
  metric: InstrumentMetric,
  delta: number | null,
  provenance: Provenance,
  trend: Trend | null = null,
): string {
  const kind = kindOf(metric.key);
  const shown = metric.display ? ` (shown as ${metric.display})` : "";
  const unit = metric.unit ? ` ${metric.unit}` : SPOKEN_UNIT[kind];
  const accel =
    metric.key === "capability" && trend === "accelerating"
      ? " The rate of increase is rising."
      : "";
  return `${metric.label}: ${formatFull(metric.value)}${unit}${shown}.${deltaSentence(delta, kind)}${accel} ${provenance.accessible}`;
}
