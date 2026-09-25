import test from "node:test";
import assert from "node:assert/strict";
import {
  MINUS,
  INSTITUTIONAL_TAG,
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
  kindOf,
  linearTicks,
  logPosition,
  logTicks,
  niceStep,
  notchPositions,
  provenanceOf,
  scaleMaxOf,
  seriesOf,
  sparkline,
  supplyState,
  trendOf,
  valueParts,
} from "../../src/ui/components/instruments/model.ts";
import { planCells } from "../../src/ui/components/instruments/odometer-plan.ts";
import type { InstrumentMetric } from "../../src/ui/components/instruments/types.ts";

// ------------------------------------------------------------ formatting

test("counts: grouped below a million, three significant figures above", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(20), "20");
  assert.equal(formatCount(12345), "12,345");
  assert.equal(formatCount(999999), "999,999");
  assert.equal(formatCount(1_000_000), "1.00 m");
  assert.equal(formatCount(1_234_567), "1.23 m");
  assert.equal(formatCount(45_600_000), "45.6 m");
  assert.equal(formatCount(123_400_000), "123 m");
  assert.equal(formatCount(8_000_000_000), "8.00 bn");
  assert.equal(formatCount(7_994_000_000), "7.99 bn");
  assert.equal(formatCount(5_214_338_120), "5.21 bn");
});

test("counts: rounding never shows 1000 m or 10.00 bn", () => {
  assert.equal(formatCount(999_999_999), "1.00 bn");
  assert.equal(formatCount(9_996_000_000), "10.0 bn");
  assert.equal(formatCount(99_960_000), "100 m");
  assert.equal(formatCount(999_600_000), "1.00 bn");
});

test("counts: negatives use a true minus and parts split the suffix", () => {
  assert.equal(formatCount(-12), `${MINUS}12`);
  assert.deepEqual(countParts(8e9), { number: "8.00", suffix: "bn" });
  assert.deepEqual(countParts(20), { number: "20", suffix: "" });
  assert.deepEqual(countParts(Number.NaN), { number: "—", suffix: "" });
});

test("full precision accessible text", () => {
  assert.equal(formatFull(8_000_000_000), "8,000,000,000");
  assert.equal(formatFull(20), "20");
  assert.equal(formatFull(-1500), `${MINUS}1,500`);
  assert.equal(formatFull(Number.POSITIVE_INFINITY), "unavailable");
});

test("index readings are plain integers until five digits", () => {
  assert.equal(formatIndex(1000), "1000");
  assert.equal(formatIndex(1012.4), "1012");
  assert.equal(formatIndex(950), "950");
  assert.equal(formatIndex(12500), "12,500");
});

test("value parts follow the gauge kind, and display overrides", () => {
  assert.equal(kindOf("gdp"), "index");
  assert.equal(kindOf("capability"), "notch");
  assert.equal(kindOf("casualties"), "log");
  assert.equal(kindOf("population"), "count");
  assert.deepEqual(valueParts({ key: "gdp", value: 1012 }), {
    number: "1012",
    suffix: "",
  });
  assert.deepEqual(valueParts({ key: "casualties", value: 8e9 }), {
    number: "8.00",
    suffix: "bn",
  });
  assert.deepEqual(
    valueParts({ key: "capability", value: 950, display: "950?" }),
    { number: "950?", suffix: "" },
  );
});

// ------------------------------------------------------------ log scale

test("log scale: zero at origin, 20 readable, 8 bn near the top", () => {
  const max = 1e10;
  assert.equal(logPosition(0, max), 0);
  assert.equal(logPosition(-5, max), 0);
  assert.equal(logPosition(max, max), 1);
  const twenty = logPosition(20, max);
  assert.ok(twenty > 0.1 && twenty < 0.2, `20 sits at ${twenty}`);
  const eight = logPosition(8e9, max);
  assert.ok(eight > 0.98 && eight < 1, `8 bn sits at ${eight}`);
  // Monotonic across the whole range.
  let prev = -1;
  for (const v of [0, 1, 5, 20, 400, 1e4, 1e6, 3e8, 8e9, 1e10]) {
    const p = logPosition(v, max);
    assert.ok(p > prev, `${v} -> ${p} not above ${prev}`);
    prev = p;
  }
  // Values past the ceiling clamp.
  assert.equal(logPosition(5e10, max), 1);
});

test("log ticks: decades are majors, 2..9 minors, and a non-decade end stop", () => {
  const t = logTicks(1e10);
  assert.equal(t.major.length, 11);
  assert.equal(t.minor.length, 80);
  assert.equal(t.stop, null);
  assert.deepEqual(
    t.major.filter((m) => m.label).map((m) => m.label),
    ["1", "100", "10k", "1m", "100m", "10bn"],
  );
  const pop = logTicks(8e9);
  assert.ok(pop.stop);
  assert.equal(pop.stop!.label, "8bn");
  assert.equal(pop.stop!.p, 1);
  // No decade label crowds the end stop.
  assert.ok(pop.major.every((m) => !m.label || 1 - m.p >= 0.16));
  // No minor tick past the population.
  assert.ok(pop.minor.every((m) => m.value <= 8e9));
});

test("linear ticks and scale ceilings", () => {
  assert.equal(niceStep(2000), 500);
  assert.equal(niceStep(1000), 250);
  const g = linearTicks(2000);
  assert.deepEqual(
    g.major.map((m) => m.label),
    ["0", "500", "1000", "1500", "2000"],
  );
  assert.equal(g.minor.length, 16);
  assert.equal(scaleMaxOf({ key: "gdp", value: 1012, history: [1000] }), 2000);
  assert.equal(scaleMaxOf({ key: "gdp", value: 2350, history: [1000] }), 3000);
  assert.equal(
    scaleMaxOf({ key: "capability", value: 950, history: [] }),
    1000,
  );
  assert.equal(
    scaleMaxOf({ key: "capability", value: 1180, history: [] }),
    1500,
  );
  assert.equal(
    scaleMaxOf({ key: "casualties", value: 20, history: [], scaleMax: 8e9 }),
    8e9,
  );
  assert.equal(scaleMaxOf({ key: "casualties", value: 20, history: [] }), 1e10);
});

test("capability notches crowd together toward the top", () => {
  const n = notchPositions(36);
  assert.equal(n.length, 37);
  assert.equal(n[0], 0);
  assert.equal(n[36], 1);
  for (let i = 2; i < n.length; i++) {
    const a = n[i - 1]! - n[i - 2]!;
    const b = n[i]! - n[i - 1]!;
    assert.ok(b > 0 && b < a, `gap ${i} (${b}) should be smaller than ${a}`);
  }
});

test("supply deviation grows from the baseline", () => {
  const up = deviation(1500, 1000, 2000);
  assert.deepEqual([up.base, up.from, up.to, up.dir], [0.5, 0.5, 0.75, "up"]);
  const down = deviation(400, 1000, 2000);
  assert.deepEqual([down.from, down.to, down.dir], [0.2, 0.5, "down"]);
  assert.equal(deviation(1000, 1000, 2000).dir, "flat");
  assert.equal(supplyState(499), "low");
  assert.equal(supplyState(500), "ok");
});

// ------------------------------------------------------------ sparkline

test("sparkline path maps oldest-left, highest-top, rounded to 0.01", () => {
  const s = sparkline([0, 50, 100], { width: 100, height: 20 });
  assert.equal(s.d, "M0 20L50 10L100 0");
  assert.deepEqual(s.last, { x: 100, y: 0, value: 100, index: 2 });
  assert.equal(s.lo, 0);
  assert.equal(s.hi, 100);
  const padded = sparkline([1, 2, 4], {
    width: 90,
    height: 30,
    padX: 3,
    padY: 3,
  });
  assert.equal(padded.d, "M3 27L45 19L87 3");
  const third = sparkline([0, 1, 2, 3], { width: 10, height: 3 });
  assert.equal(third.d, "M0 3L3.33 2L6.67 1L10 0");
});

test("sparkline edge cases: empty, single point, flat, non-finite", () => {
  const empty = sparkline([], { width: 100, height: 20 });
  assert.equal(empty.d, "");
  assert.equal(empty.last, null);
  const one = sparkline([42], { width: 100, height: 20, padX: 2 });
  assert.equal(one.d, "M2 10L98 10");
  assert.equal(one.last!.x, 98);
  const flat = sparkline([5, 5, 5], { width: 10, height: 8 });
  assert.equal(flat.d, "M0 4L5 4L10 4");
  const gaps = sparkline([10, Number.NaN, 30], { width: 10, height: 10 });
  assert.equal(gaps.d, "M0 10L5 10L10 0");
});

test("sparkline domain includes the baseline and supports log", () => {
  const s = sparkline([1010, 1020], { width: 10, height: 10, include: [1000] });
  assert.equal(s.lo, 1000);
  assert.equal(s.y(1000), 10);
  const log = sparkline([0, 9, 99], { width: 10, height: 10, log: true });
  // log10(1+9)=1 is exactly half of log10(1+99)=2
  assert.equal(log.d, "M0 10L5 5L10 0");
});

test("sparkline decimates long series but keeps both ends", () => {
  const long = Array.from({ length: 500 }, (_, i) => i);
  const s = sparkline(long, { width: 100, height: 10, maxPoints: 50 });
  assert.equal(s.points.length, 50);
  assert.equal(s.points[0]!.index, 0);
  assert.equal(s.last!.index, 499);
  assert.equal(s.last!.x, 100);
});

test("series appends the current value when history lags", () => {
  assert.deepEqual(
    seriesOf({ value: 1012, history: [1000, 1004] }),
    [1000, 1004, 1012],
  );
  assert.deepEqual(
    seriesOf({ value: 1004, history: [1000, 1004] }),
    [1000, 1004],
  );
  assert.deepEqual(seriesOf({ value: 7, history: [] }), [7]);
});

// ------------------------------------------------------------ deltas

test("delta from the previously drawn value wins", () => {
  assert.equal(deltaFrom(1012, [1000, 1012], 1000), 12);
  assert.equal(deltaFrom(997, [1000], 1000), -3);
  assert.equal(deltaFrom(1000, [1000], 1000), 0);
});

test("delta from history when nothing was drawn yet", () => {
  assert.equal(deltaFrom(1012, [1000, 1012]), 12);
  assert.equal(deltaFrom(1012, [1000, 1004]), 8);
  assert.equal(deltaFrom(1012, [1012]), null);
  assert.equal(deltaFrom(1012, []), null);
  assert.equal(deltaFrom(Number.NaN, [1, 2]), null);
});

test("delta formatting is signed, with true minus and compact counts", () => {
  assert.equal(formatDelta(12, "index"), "+12");
  assert.equal(formatDelta(-3, "index"), `${MINUS}3`);
  assert.equal(formatDelta(0.2, "index"), "±0");
  assert.equal(formatDelta(20, "log"), "+20");
  assert.equal(formatDelta(1.2e9, "log"), "+1.20 bn");
  assert.equal(formatDelta(-12_000_000, "count"), `${MINUS}12.0 m`);
});

test("capability trend reads acceleration from the second difference", () => {
  assert.equal(trendOf([100]), null);
  assert.equal(trendOf([100, 140, 200]), "accelerating");
  assert.equal(trendOf([100, 160, 200]), "rising");
  assert.equal(trendOf([100, 140, 180]), "rising");
  assert.equal(trendOf([200, 200]), "flat");
  assert.equal(trendOf([300, 250]), "falling");
  assert.equal(captionOf("capability", "accelerating"), "Index · accelerating");
  assert.equal(captionOf("capability", "rising"), "Index");
  assert.equal(flagOf("capability", "accelerating"), "Accelerating");
  assert.equal(flagOf("capability", "rising"), null);
  assert.equal(flagOf("gdp", "accelerating"), null);
});

// ------------------------------------------------------------ provenance

test("local readings carry no tag or mark", () => {
  const p = provenanceOf({ altered: false, source: "Local instrument" });
  assert.equal(p.altered, false);
  assert.equal(p.mark, "");
  assert.equal(p.tag, null);
  assert.equal(p.detail, null);
  assert.equal(p.accessible, "Source: local instrument.");
});

test("altered readings always carry the institutional tag, mark and label", () => {
  const p = provenanceOf({
    altered: true,
    source: "Unverified briefing score inserted without a test",
  });
  assert.equal(p.altered, true);
  assert.equal(p.tag, INSTITUTIONAL_TAG);
  assert.equal(p.tag, "SOURCE · INSTITUTIONAL REPORT");
  assert.equal(p.mark, "†");
  assert.equal(p.detail, "Unverified briefing score inserted without a test");
  assert.match(p.accessible, /institutional report/);
  assert.match(p.accessible, /Not measured by the local instrument/);
});

test("altered readings keep the tag even with a missing or generic source", () => {
  for (const source of [
    undefined,
    "",
    "Institutional report",
    "Local instrument",
  ]) {
    const p = provenanceOf({ altered: true, source });
    assert.equal(p.tag, INSTITUTIONAL_TAG, `source ${String(source)}`);
    assert.equal(p.detail, null);
    assert.ok(p.mark.length > 0);
  }
});

test("footnote marks are assigned in reading order to altered metrics only", () => {
  const marks = assignMarks([
    { key: "gdp", altered: false },
    { key: "capability", altered: true },
    { key: "casualties", altered: true },
    { key: "care", altered: true },
  ]);
  assert.equal(marks.has("gdp"), false);
  assert.equal(marks.get("capability"), "†");
  assert.equal(marks.get("casualties"), "‡");
  assert.equal(marks.get("care"), "§");
  const many = assignMarks(
    (
      [
        "gdp",
        "capability",
        "casualties",
        "population",
        "power",
        "care",
      ] as const
    ).map((key) => ({ key, altered: true })),
  );
  assert.equal(many.get("care"), "††");
});

test("accessible reading has full precision, change and provenance", () => {
  const metric: InstrumentMetric = {
    key: "casualties",
    label: "Fatalities",
    value: 8_000_000_000,
    history: [0, 20],
  };
  const text = accessibleReading(metric, 7_999_999_980, provenanceOf(metric));
  assert.equal(
    text,
    "Fatalities: 8,000,000,000 reported deaths. Up 7,999,999,980 since the previous report. Source: local instrument.",
  );
  const cap: InstrumentMetric = {
    key: "capability",
    label: "Capability",
    value: 950,
    history: [600, 700, 950],
    altered: true,
    source: "Unverified briefing score inserted without a test",
  };
  const capText = accessibleReading(
    cap,
    250,
    provenanceOf(cap),
    trendOf(seriesOf(cap)),
  );
  assert.match(
    capText,
    /^Capability: 950, reported index\. Up 250 points since the previous report\. The rate of increase is rising\./,
  );
  assert.match(
    capText,
    /institutional report, “Unverified briefing score inserted without a test”/,
  );
});

// ------------------------------------------------------------ odometer plan

test("odometer reconciles digits right-aligned and rolls the short way", () => {
  // 1,009 -> 1,012: thousands and comma reused, tens 0->1, units 9->2 rolls up through 0.
  const plan = planCells(["1", ",", "0", "0", "9"], "1,012", 1);
  assert.deepEqual(
    plan.map((c) => [c.char, c.reuse, c.from, c.to]),
    [
      ["1", true, 1, 1],
      [",", true, null, null],
      ["0", true, 0, 0],
      ["1", true, 0, 1],
      ["2", true, 9, 12],
    ],
  );
  // Decrease: 0 -> 9 rolls down one step (10 -> 9).
  const down = planCells(["2", "0"], "19", -1);
  assert.deepEqual(
    down.map((c) => [c.from, c.to]),
    [
      [12, 11],
      [10, 9],
    ],
  );
  // Growth adds new cells on the left that start from zero.
  const grow = planCells(["9", "9", "9"], "1,000", 1);
  assert.deepEqual(
    grow.map((c) => [c.char, c.reuse]),
    [
      ["1", false],
      [",", false],
      ["0", true],
      ["0", true],
      ["0", true],
    ],
  );
  assert.equal(grow[0]!.from, 0);
});
