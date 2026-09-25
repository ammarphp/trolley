/**
 * Instrument cluster lab. Renders the cluster over the real ink world so the
 * glass is judged against busy line art, then freezes every CSS and WAAPI
 * animation at a chosen moment for deterministic screenshots.
 *
 *   node scripts/lab-shot.mjs instruments-boot --file src/ui/components/instruments/instruments.lab.ts \
 *     --out shot.png --w 1440 --h 900 --t 2 --params '{"at":700}'
 *
 * Params: at (ms to freeze; omitted = settled), backdrop ("world" | "none"),
 *         layout ("panel" | "sheet"), width (panel px).
 */
import "../../theme.css";
import "./instruments.css";
import type { LabContext, LabScene } from "../../../render/lab/types.ts";
import { worldLab } from "../../../render/world.lab.ts";
import { placeholderAssets } from "../../../render/assets.ts";
import {
  disposeInstruments,
  renderInstruments,
  settleInstruments,
} from "./render.ts";
import { INSTITUTIONAL_TAG } from "./model.ts";
import type { InstrumentMetric, InstrumentsView } from "./types.ts";

type Lab = LabContext;

async function fonts() {
  try {
    await Promise.all([
      document.fonts.load('420 30px "Geist Mono"'),
      document.fonts.load('600 11px "Geist Mono"'),
      document.fonts.load('400 14px "Geist"'),
      document.fonts.load('600 14px "Geist"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* system fallback is acceptable in the lab */
  }
}

/** Mount a HUD host over the world (or blank paper) and return it. */
async function stage(
  ctx: Lab,
  defaults: { layout?: "panel" | "sheet" } = {},
): Promise<HTMLElement> {
  const backdrop = (ctx.params.backdrop as string) ?? "world";
  if (backdrop === "world") await worldLab(ctx, placeholderAssets);
  const dom = ctx.domStage();
  if (backdrop !== "world") dom.style.background = "var(--paper-2)";
  await fonts();
  const layout = (ctx.params.layout as string) ?? defaults.layout ?? "panel";
  const host = document.createElement("div");
  host.className = "lab-hud";
  const width = Number(ctx.params.width ?? 348);
  host.style.cssText =
    layout === "sheet"
      ? "position:absolute;left:0;right:0;bottom:0;z-index:10;max-height:100%;overflow:auto;--ins-radius:16px 16px 0 0"
      : `position:absolute;top:${Number(ctx.params.top ?? 24)}px;${ctx.params.left !== undefined ? `left:${Number(ctx.params.left)}px` : "right:24px"};width:${width}px;z-index:10;max-height:calc(100% - 48px);overflow:auto`;
  dom.append(host);
  return host;
}

/** Freeze all animations at `at` ms, or settle them when `at` is absent. */
function hookFreeze(ctx: Lab) {
  const at = ctx.params.at === undefined ? null : Number(ctx.params.at);
  const w = window as unknown as { __labFinish?: () => void };
  const prior = w.__labFinish;
  w.__labFinish = () => {
    prior?.();
    for (const a of document.getAnimations()) {
      try {
        if (at === null) a.finish();
        else {
          a.pause();
          a.currentTime = at;
        }
      } catch {
        /* cancelled */
      }
    }
  };
}

// ------------------------------------------------------------------ data

const GDP4 = [1000, 1003, 1009, 1012, 1018, 1027, 1041];
const CAP4 = [100, 118, 140, 172, 214, 286, 410];
const CAS4 = [0, 0, 1, 1, 5, 5, 7];

function m(
  key: InstrumentMetric["key"],
  label: string,
  history: number[],
  extra: Partial<InstrumentMetric> = {},
): InstrumentMetric {
  return { key, label, value: history[history.length - 1]!, history, ...extra };
}

function stage4(): InstrumentsView {
  return {
    stage: 4,
    day: 118,
    dateLabel: "12 Apr 2031",
    reducedMotion: false,
    metrics: [
      m("gdp", "GDP", GDP4),
      m("capability", "Capability", CAP4),
      m("casualties", "Fatalities", CAS4, { scaleMax: 8e9 }),
    ],
  };
}

function stage5(): InstrumentsView {
  return {
    stage: 5,
    day: 203,
    dateLabel: "06 Jul 2031",
    reducedMotion: false,
    metrics: [
      m("gdp", "GDP", [...GDP4, 1066, 1102, 1150, 1188]),
      m("capability", "Capability", [...CAP4, 470, 520, 580, 655]),
      m("casualties", "Fatalities", [...CAS4, 31, 212, 1_480, 2_214], {
        scaleMax: 8e9,
      }),
    ],
    secondary: [
      m("population", "Population", [8e9, 8e9, 7_999_997_786]),
      m("power", "Power", [1000, 1040, 1085, 1120]),
      m("care", "Care", [1000, 980, 910, 860]),
      m("food", "Food", [1000, 1004, 1010, 1010]),
    ],
  };
}

function catastrophe(): InstrumentsView {
  return {
    stage: 6,
    day: 311,
    dateLabel: "22 Oct 2031",
    reducedMotion: false,
    metrics: [
      m("gdp", "GDP", [...GDP4, 1066, 1150, 1260, 1344, 1410, 980, 412]),
      m("capability", "Capability", [
        ...CAP4,
        520,
        655,
        780,
        880,
        960,
        990,
        1000,
      ]),
      m(
        "casualties",
        "Fatalities",
        [...CAS4, 212, 2_214, 40_210, 1_900_000, 310_000_000, 5_214_338_120],
        { scaleMax: 8e9 },
      ),
    ],
    secondary: [
      m(
        "population",
        "Population",
        [8e9, 7_999_997_786, 7_689_997_786, 2_785_661_880],
      ),
      m("power", "Power", [1000, 1120, 880, 310]),
      m("care", "Care", [1000, 860, 520, 180]),
      m("food", "Food", [1000, 1010, 760, 420]),
    ],
  };
}

function altered(): InstrumentsView {
  const v = stage5();
  v.stage = 6;
  v.day = 247;
  v.dateLabel = "19 Aug 2031";
  v.metrics[1] = m("capability", "Capability", [...CAP4, 520, 655, 740, 950], {
    altered: true,
    source: "Unverified briefing score inserted without a test",
  });
  return v;
}

// ------------------------------------------------------------------ scenes

export const scenes: LabScene[] = [
  {
    name: "instruments-boot",
    description:
      "Stage 4 first show: the self-test boot, frozen mid-sequence (params.at, default 900 ms).",
    async build(ctx) {
      if (ctx.params.at === undefined) ctx.params.at = 900;
      const host = await stage(ctx);
      renderInstruments(host, stage4());
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-stage4",
    description:
      "Stage 4, settled after boot. params.zero: no reported deaths yet.",
    async build(ctx) {
      const host = await stage(ctx);
      const v = stage4();
      if (ctx.params.zero)
        v.metrics[2] = m("casualties", "Fatalities", [0, 0, 0, 0], {
          scaleMax: 8e9,
        });
      renderInstruments(host, v);
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-stage5",
    description: "Stage 5 with supply systems and population.",
    async build(ctx) {
      const host = await stage(ctx);
      renderInstruments(host, stage5());
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-catastrophe",
    description: "Stage 6 after catastrophe: billions dead, supply collapsed.",
    async build(ctx) {
      const host = await stage(ctx);
      renderInstruments(host, catastrophe());
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-altered",
    description:
      "Capability 950 issued by an institution, with visible provenance.",
    async build(ctx) {
      const host = await stage(ctx);
      renderInstruments(host, altered());
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-update",
    description:
      "In-place update mid-roll: digits rolling, needles travelling, deltas flashing (params.at, default 380 ms).",
    async build(ctx) {
      if (ctx.params.at === undefined) ctx.params.at = 380;
      const host = await stage(ctx);
      const before = stage4();
      renderInstruments(host, { ...before, boot: false });
      host.getBoundingClientRect();
      const after = stage4();
      after.day = 121;
      after.dateLabel = "15 Apr 2031";
      after.metrics = [
        m("gdp", "GDP", [...GDP4, 1063]),
        m("capability", "Capability", [...CAP4, 590]),
        m("casualties", "Fatalities", [...CAS4, 27], { scaleMax: 8e9 }),
      ];
      renderInstruments(host, after);
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-phone",
    description:
      "Phone width: the cluster as a full-width bottom sheet (use --w 390 --h 844).",
    async build(ctx) {
      const host = await stage(ctx, { layout: "sheet" });
      renderInstruments(host, altered());
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-scrub",
    description: "Keyboard history scrub on the GDP sparkline.",
    async build(ctx) {
      const host = await stage(ctx);
      renderInstruments(host, { ...stage5(), boot: false });
      const spark = host.querySelector<HTMLElement>(".ins-spark");
      spark?.focus();
      for (let i = 0; i < 4; i++)
        spark?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
        );
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-reduced",
    description:
      "Reduced motion: no boot, no rolling; first frame is final (freeze at 120 ms to prove it).",
    async build(ctx) {
      if (ctx.params.at === undefined) ctx.params.at = 120;
      const host = await stage(ctx);
      renderInstruments(host, { ...catastrophe(), reducedMotion: true });
      hookFreeze(ctx);
    },
  },
  {
    name: "instruments-selftest",
    description:
      "Browser assertions for the DOM contract. Fails the lab run on any violation.",
    async build(ctx) {
      ctx.params.backdrop = "none";
      const host = await stage(ctx);
      const checks: string[] = [];
      const ok = (cond: unknown, what: string) => {
        if (!cond) throw new Error(`instruments selftest failed: ${what}`);
        checks.push(what);
      };
      const q = <T extends Element = HTMLElement>(
        sel: string,
        root: ParentNode = host,
      ) => root.querySelector<T>(sel);

      // Stage gating.
      let booted = 0;
      renderInstruments(host, {
        ...stage4(),
        stage: 3,
        onBootComplete: () => booted++,
      });
      const root = q(".ins")!;
      ok(root && root.hidden, "hidden before stage 4");
      ok(booted === 0, "no boot before stage 4");

      // First show at stage 4 boots once.
      renderInstruments(host, {
        ...stage4(),
        secondary: stage5().secondary,
        onBootComplete: () => booted++,
      });
      ok(!root.hidden, "visible at stage 4");
      ok(root.dataset.boot === "run", "boot runs on first show");
      ok(!q(".ins-sec"), "no systems block at stage 4 even if supplied");
      ok(
        host.querySelectorAll(".ins-gauge").length === 3,
        "three primary gauges",
      );

      // Skip by pointer.
      root.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      ok(root.dataset.boot === "done", "pointer skips boot");
      ok(booted === 1, "onBootComplete fires once after skip");

      // Update in place: same nodes, new text.
      const gdp = q('[data-key="gdp"]')!;
      const odo = q(".ins-odo", gdp)!;
      const firstCell = odo.firstElementChild;
      renderInstruments(host, { ...stage5(), onBootComplete: () => booted++ });
      ok(q('[data-key="gdp"]') === gdp, "gauge node reused on update");
      ok(q(".ins-odo", gdp) === odo, "odometer node reused on update");
      ok(
        odo.firstElementChild === firstCell,
        "leading digit cell reused (1041 -> 1188)",
      );
      ok(root.dataset.boot === "done" && booted === 1, "boot does not rerun");
      ok(
        q(".ins-sr", gdp)!.textContent!.startsWith("GDP: 1,188"),
        "accessible reading updated",
      );
      ok(
        q(".ins-delta", gdp)!.textContent === "+147",
        "delta from previously drawn value",
      );
      ok(!!q(".ins-sec"), "systems block at stage 5");
      const popSr = q(".ins-pop .ins-sr")!.textContent!;
      ok(
        popSr.includes("7,999,997,786"),
        "population full precision in accessible text",
      );
      ok(
        q(".ins-pop .ins-odo")!.textContent!.replace(/\s/g, "").length > 0,
        "population digits drawn",
      );

      // Provenance.
      renderInstruments(host, altered());
      const cap = q('[data-key="capability"]')!;
      const prov = q(".ins-prov", cap)!;
      ok(cap.dataset.altered === "true", "altered flag on gauge");
      ok(!prov.hidden, "provenance footnote visible when altered");
      ok(
        q(".ins-prov-tag", prov)!.textContent === INSTITUTIONAL_TAG,
        "institutional tag text",
      );
      ok(
        q(".ins-mark", cap)!.textContent === "†" &&
          !q(".ins-mark", cap)!.hidden,
        "footnote mark on value",
      );
      ok(
        q(".ins-sr", cap)!.textContent!.includes("institutional report"),
        "provenance spoken with the value",
      );
      ok(
        q(".ins-foot")!.textContent!.includes("except where marked †"),
        "footer legend names the mark",
      );
      renderInstruments(host, stage5());
      ok(
        prov.hidden && q(".ins-mark", cap)!.hidden,
        "provenance clears when reading is local again",
      );

      // Keyboard scrub on history.
      const spark = q(".ins-spark", gdp)!;
      ok(
        spark.getAttribute("role") === "slider" && spark.tabIndex === 0,
        "history is a focusable slider",
      );
      spark.focus();
      spark.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
      ok(
        spark.getAttribute("aria-valuenow") === "1",
        "Home moves to the first report",
      );
      ok(
        spark.getAttribute("aria-valuetext") === "Report 1 of 11: 1,000",
        "valuetext reads the report",
      );
      ok(!q(".ins-ghost", gdp)!.hidden, "ghost pointer shown while scrubbing");
      spark.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      );
      ok(
        spark.getAttribute("aria-valuetext")!.endsWith(", current"),
        "End returns to current",
      );
      spark.blur();
      ok(q(".ins-ghost", gdp)!.hidden, "ghost pointer hidden after scrub");

      // Metric removal and reorder without rebuild.
      const casualties = q('[data-key="casualties"]')!;
      const v = stage5();
      v.metrics = [v.metrics[2]!, v.metrics[0]!];
      renderInstruments(host, v);
      ok(!q('[data-key="capability"]'), "removed metric's gauge removed");
      ok(
        q(".ins-gauges")!.firstElementChild === casualties,
        "gauges reorder by moving existing nodes",
      );

      // Settle and dispose.
      settleInstruments(host);
      disposeInstruments(host);
      ok(host.childElementCount === 0, "dispose empties host");

      // Reduced motion: no boot, completion still reported.
      const quiet = document.createElement("div");
      host.append(quiet);
      let quietDone = 0;
      renderInstruments(quiet, {
        ...stage4(),
        reducedMotion: true,
        onBootComplete: () => quietDone++,
      });
      ok(
        q(".ins", quiet)!.dataset.boot === "done",
        "reduced motion skips boot",
      );
      ok(
        q(".ins", quiet)!.dataset.motion === "reduced",
        "reduced motion flag on root",
      );
      ok(quietDone === 1, "suppressed boot still reports completion");
      ok(
        q(".ins", quiet)!.getAnimations({ subtree: true }).length === 0,
        "no animations under reduced motion",
      );
      renderInstruments(quiet, { ...stage5(), reducedMotion: true });
      ok(
        q(".ins", quiet)!.getAnimations({ subtree: true }).length === 0,
        "updates do not animate under reduced motion",
      );
      disposeInstruments(quiet);
      quiet.remove();

      // boot:false suppresses the self-test.
      const restore = document.createElement("div");
      host.append(restore);
      renderInstruments(restore, { ...catastrophe(), boot: false });
      ok(
        q(".ins", restore)!.dataset.boot === "done",
        "boot:false suppresses boot",
      );
      disposeInstruments(restore);
      restore.remove();

      ctx.caption(`instruments selftest: ${checks.length} checks passed`);
      console.log(`instruments selftest: ${checks.length} checks passed`);
    },
  },
];
