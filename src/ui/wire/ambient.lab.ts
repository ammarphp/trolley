/**
 * Ambient wire lab. Runs the real engine in the page (seeded, with a fixed
 * choice policy), feeds every decision through the campaign adapter and
 * prints the resulting feed, so the whole arc can be read end to end.
 *
 *   node scripts/lab-shot.mjs ambient-run --file src/ui/wire/ambient.lab.ts --out run.png --w 1600 --h 1400 \
 *     --params '{"seed":"probe-4","from":1,"to":12}'
 *   node scripts/lab-shot.mjs ambient-panel --file src/ui/wire/ambient.lab.ts --out panel.png --params '{"seed":"probe-14","at":34}'
 *
 * params: seed (engine seed), from/to (ordinals shown), cols (text columns),
 * at (ordinal for the panel scene).
 */
import "../theme.css";
import "../components/wire/wire.css";
import { CAMPAIGN_MANIFEST, CAMPAIGN_NODES } from "../../content/campaign/index.ts";
import type { Campaign } from "../../contracts/index.ts";
import { commitChoice, createCampaign, draw } from "../../simulation/index.ts";
import type { LabContext, LabScene } from "../../render/lab/types.ts";
import { renderWire, toWireView } from "../components/wire/index.ts";
import { ambientGenerator, ambientHistory, ambientInputFor, botSaturationForCampaign, factoidForCampaign } from "./campaign.ts";
import { readWorld } from "./world.ts";
import { botSaturation } from "./saturation.ts";
import type { FeedItem } from "./types.ts";

interface Step {
  ordinal: number;
  stage: number;
  day: number;
  sat: number;
  branch: string;
  engine: { source: string; headline: string }[];
  items: FeedItem[];
  banner: string;
  metrics: { cap: number; cas: number; gdp: number };
}

interface Run {
  seed: string;
  steps: Step[];
  ending: string | null;
  campaigns: Campaign[];
}

/** Play the campaign to the end with a seeded coin-flip policy, recording the wire at every decision. */
async function play(seed: string): Promise<Run> {
  let c = await createCampaign(CAMPAIGN_MANIFEST, CAMPAIGN_NODES, seed);
  const steps: Step[] = [];
  const campaigns: Campaign[] = [];
  while (c.prepared) {
    const p = c.prepared;
    const o = c.journal.length + 1;
    const input = ambientInputFor(c, o);
    const sat = botSaturation(input);
    const world = readWorld(input, sat);
    steps.push({
      ordinal: o,
      stage: p.stage,
      day: input.day,
      sat,
      branch: world.branch,
      engine: (input.lastEngineNews ?? []).map((n) => ({ source: n.source, headline: n.headline })),
      items: ambientGenerator(c, o),
      banner: factoidForCampaign(c),
      metrics: { cap: input.metrics.capability, cas: input.metrics.casualties, gdp: input.metrics.gdp },
    });
    campaigns.push(c);
    const option = p.node.options[await draw(c.seed, "probe-policy", p.id, "choice", 2)]!;
    c = await commitChoice(c, { decisionId: p.id, optionId: option.id, expectedRevision: c.revision, actor: "human" }, CAMPAIGN_NODES);
  }
  return { seed, steps, ending: c.ending?.id ?? null, campaigns };
}

const STAGE_NAMES = ["", "Pastoral", "The lecture hall", "Assistants arrive", "The race", "Dependence", "Crisis", "Aftermath"];

const CSS = `
.aw { font-family: var(--font-sans); color: var(--ink); background: var(--paper); padding: 22px 26px 40px; }
.aw h1 { font: 600 20px/1.2 var(--font-sans); margin: 0 0 2px; letter-spacing: -0.01em; }
.aw .sub { font: 500 11px/1.4 var(--font-mono); color: var(--ink-3); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.06em; }
.aw .cols { column-gap: 26px; }
.aw .step { break-inside: avoid; border-top: 1.5px solid var(--ink); padding: 7px 0 12px; }
.aw .hd { display: flex; justify-content: space-between; gap: 8px; font: 600 10.5px/1.3 var(--font-mono); letter-spacing: 0.04em; text-transform: uppercase; }
.aw .hd .meta { color: var(--ink-3); font-weight: 500; }
.aw .sat { display: inline-block; width: 46px; height: 5px; border: 1px solid var(--ink-3); vertical-align: middle; margin-left: 5px; position: relative; }
.aw .sat i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ink); }
.aw .eng { font: 400 10.5px/1.35 var(--font-mono); color: var(--ink-3); margin: 4px 0 2px; padding-left: 8px; border-left: 2px solid var(--paper-3); }
.aw .it { display: grid; grid-template-columns: 70px 1fr; gap: 0 8px; margin-top: 6px; font-size: 12.5px; line-height: 1.38; }
.aw .when { font: 500 9.5px/1.5 var(--font-mono); color: var(--ink-3); padding-top: 1px; }
.aw .who { font: 600 10.5px/1.3 var(--font-sans); color: var(--ink-2); letter-spacing: 0.01em; }
.aw .who .h { font-weight: 400; color: var(--ink-3); }
.aw .who .tag { font: 600 8.5px/1 var(--font-mono); letter-spacing: 0.08em; padding: 1px 3px 1px; border: 1px solid currentColor; margin-left: 4px; vertical-align: 1px; }
.aw .k-headline .tx, .aw .k-breaking .tx { font-weight: 600; letter-spacing: -0.005em; }
.aw .k-breaking .who { color: var(--signal); }
.aw .k-breaking .tx::before { content: "BREAKING "; font: 700 9px/1 var(--font-mono); color: var(--signal); letter-spacing: 0.08em; }
.aw .k-statement .tx { font-style: normal; }
.aw .k-statement.morrow .who { color: var(--cobalt); }
.aw .k-statement.morrow .tx { color: #1d2fa0; }
.aw .k-post.bot .tx { color: var(--ink-2); }
.aw .k-post.bot .who .tag { color: var(--ink-3); }
.aw .k-ticker .tx { font: 500 11px/1.4 var(--font-mono); text-transform: uppercase; letter-spacing: 0.02em; }
.aw .k-factoid .tx { font-style: italic; color: var(--ink-2); }
.aw .eng-ct { font: 500 10px/1.3 var(--font-mono); color: var(--ink-3); margin-top: 6px; }
.aw .banner { margin-top: 7px; font: 400 11px/1.35 var(--font-mono); color: var(--ink-2); background: var(--paper-2); padding: 4px 6px; }
.aw .ending { margin-top: 10px; font: 600 12px/1.3 var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; }
`;

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderItem(item: FeedItem): HTMLElement {
  const row = el("div", `it k-${item.kind}${item.isBot ? " bot" : ""}${item.outletId === "morrow" ? " morrow" : ""}`);
  row.append(el("div", "when", item.dateLabel.replace(/^DAY /, "D")));
  const body = el("div");
  const who = el("div", "who");
  if (item.kind === "ticker") who.textContent = "Ticker";
  else if (item.kind === "factoid") who.textContent = "Factoid";
  else if (item.authorName) {
    who.textContent = item.authorName;
    who.append(el("span", "h", ` @${item.authorHandle}`));
  } else who.textContent = item.outletName ?? item.outletId ?? "";
  if (item.isBot) who.append(el("span", "tag", "BOT"));
  if (item.engagement && item.kind === "post") who.append(el("span", "h", `  ♥ ${item.engagement.likes.toLocaleString("en-GB")} · ↻ ${item.engagement.reposts.toLocaleString("en-GB")} · ↩ ${item.engagement.replies}`));
  if ((item.sharedBy ?? 1) > 3) who.append(el("span", "h", `  · carried by ${item.sharedBy}`));
  body.append(who, el("div", "tx", item.text));
  row.append(body);
  return row;
}

async function runScene(ctx: LabContext): Promise<void> {
  const seed = typeof ctx.params.seed === "string" ? ctx.params.seed : "probe-4";
  const from = Number(ctx.params.from) || 1;
  const to = Number(ctx.params.to) || 999;
  const cols = Number(ctx.params.cols) || 3;
  const showEngine = ctx.params.engine !== false;
  const run = await play(seed);
  const root = ctx.domStage();
  const style = document.createElement("style");
  style.textContent = CSS;
  root.append(style);
  const wrap = el("div", "aw");
  const shown = run.steps.filter((s) => s.ordinal >= from && s.ordinal <= to);
  const stages = [...new Set(shown.map((s) => s.stage))];
  wrap.append(el("h1", undefined, `The ambient wire · seed ${seed}`));
  wrap.append(
    el(
      "div",
      "sub",
      `Decisions ${shown[0]?.ordinal ?? "-"}–${shown.at(-1)?.ordinal ?? "-"} of ${run.steps.length} · stages ${stages.join(", ")} (${stages.map((s) => STAGE_NAMES[s]).join(" · ")}) · ending: ${run.ending ?? "open"} · ${shown.reduce((n, s) => n + s.items.length, 0)} items`,
    ),
  );
  const colsEl = el("div", "cols");
  colsEl.style.columnCount = String(cols);
  for (const s of shown) {
    const box = el("section", "step");
    const hd = el("div", "hd");
    hd.append(el("span", undefined, `#${s.ordinal} · Stage ${s.stage} · Day ${s.day + 1}`));
    const meta = el("span", "meta", `${s.branch} · cap ${s.metrics.cap} · bots ${s.sat.toFixed(2)}`);
    const bar = el("span", "sat");
    const fill = el("i");
    fill.style.width = `${Math.round(s.sat * 100)}%`;
    bar.append(fill);
    meta.append(bar);
    hd.append(meta);
    box.append(hd);
    if (showEngine) for (const n of s.engine) box.append(el("div", "eng", `engine · ${n.source}: ${n.headline}`));
    for (const item of s.items) box.append(renderItem(item));
    if (s.banner) box.append(el("div", "banner", `Banner — ${s.banner}`));
    colsEl.append(box);
  }
  wrap.append(colsEl);
  if (to >= run.steps.length) wrap.append(el("div", "ending", `Ending: ${run.ending ?? "open"}`));
  root.append(wrap);
}

async function panelScene(ctx: LabContext): Promise<void> {
  const seed = typeof ctx.params.seed === "string" ? ctx.params.seed : "probe-14";
  const run = await play(seed);
  const at = Math.min(run.campaigns.length, Math.max(1, Number(ctx.params.at) || run.campaigns.length));
  const c = run.campaigns[at - 1]!;
  const root = ctx.domStage();
  root.style.background = "var(--paper-2)";
  const host = el("div");
  host.style.cssText = "position:absolute;top:24px;right:24px;bottom:64px;width:380px;display:flex;flex-direction:column";
  const ticker = el("div");
  ticker.style.cssText = "position:absolute;left:24px;right:24px;bottom:18px";
  const label = el("div");
  label.style.cssText = "position:absolute;left:28px;top:26px;max-width:640px;font:500 12px/1.5 var(--font-mono);color:var(--ink-2)";
  const s = run.steps[at - 1]!;
  label.textContent = `seed ${seed} · decision ${at} · stage ${s.stage} · ${s.branch} · bot saturation ${botSaturationForCampaign(c).toFixed(2)}`;
  const banner = el("div");
  banner.style.cssText = "position:absolute;left:28px;top:52px;max-width:640px;font:400 15px/1.45 var(--font-sans);color:var(--ink)";
  banner.textContent = factoidForCampaign(c);
  root.append(label, banner, host, ticker);
  const view = toWireView(c.world.news, ambientHistory(c), {
    stage: s.stage,
    botSaturation: botSaturationForCampaign(c),
    reducedMotion: true,
    today: c.world.day,
  });
  renderWire(host, view, { tickerHost: ticker });
  await new Promise((r) => setTimeout(r, 900));
}

export const scenes: LabScene[] = [
  {
    name: "ambient-run",
    description: "A whole engine run's ambient feed, as plain text, decision by decision.",
    build: runScene,
  },
  {
    name: "ambient-panel",
    description: "The same feed through the real wire panel at one decision.",
    build: panelScene,
  },
];
