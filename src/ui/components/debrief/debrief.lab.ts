/**
 * Debrief lab. Plays real campaigns through the engine with scripted policies
 * (lab only; the component itself never calls the engine) and renders the
 * resulting endings.
 *
 *   node scripts/lab-shot.mjs debrief-succession --file src/ui/components/debrief/debrief.lab.ts --out shot.png
 *   params: {"reduced":true}  static, no reveal motion (the default for lab-shot stills,
 *                             which pass ?t=; use {"motion":true} to capture the reveal)
 *           {"full":true}     let the page grow for a full-page capture
 *           {"panel":360}     render inside a narrow side-panel host of that width
 *           {"scroll":1200}   scroll the stage (px) after render
 *           {"open":true}     open the decisions ledger and the table view
 */
import "../../theme.css";
import "./debrief.css";
import type { LabContext, LabScene } from "../../../render/lab/types.ts";
import type { Campaign, Option } from "../../../contracts/index.ts";
import {
  CAMPAIGN_MANIFEST,
  CAMPAIGN_NODES,
} from "../../../content/campaign/index.ts";
import {
  createCampaign,
  commitChoice,
  draw,
} from "../../../simulation/index.ts";
import { renderDebrief, setReplayReady } from "./render.ts";

type Policy = "cautious" | "reckless" | "random" | "mixed" | "mixc";
const CAUTIOUS = new Set([
  "restrict",
  "inspect",
  "recover",
  "coordinate",
  "maintain",
]);
const RECKLESS = new Set(["expand", "delegate", "help"]);

/** A scripted policy: an intent preference, with optional fixed answers for named nodes. */
async function play(
  seed: string,
  policy: Policy,
  force: Record<string, string> = {},
): Promise<Campaign> {
  let c = await createCampaign(CAMPAIGN_MANIFEST, CAMPAIGN_NODES, seed);
  while (c.prepared) {
    const p = c.prepared;
    const opts = p.node.options;
    const pick = (set: Set<string>): Option | undefined =>
      opts.find((o) => set.has(o.intent));
    let o: Option = opts[await draw(c.seed, "pol", p.id, "choice", 2)];
    if (policy === "cautious") o = pick(CAUTIOUS) ?? o;
    else if (policy === "reckless") o = pick(RECKLESS) ?? o;
    else if (policy === "mixed" || policy === "mixc") {
      const r = await draw(c.seed, "pol", p.id, "mix", 10);
      const lean = policy === "mixed" ? RECKLESS : CAUTIOUS;
      const other = policy === "mixed" ? CAUTIOUS : RECKLESS;
      o = (r < 7 ? pick(lean) : pick(other)) ?? o;
    }
    const forced = force[p.nodeId];
    if (forced) o = opts.find((x) => x.id === forced) ?? o;
    c = await commitChoice(
      c,
      {
        decisionId: p.id,
        expectedRevision: c.revision,
        actor: "human",
        optionId: o.id,
      },
      CAMPAIGN_NODES,
    );
  }
  return c;
}

async function mount(
  ctx: LabContext,
  seed: string,
  policy: Policy,
  force?: Record<string, string>,
) {
  const stage = ctx.domStage();
  const params = ctx.params as {
    reduced?: boolean;
    motion?: boolean;
    full?: boolean;
    panel?: number;
    scroll?: number;
    open?: boolean;
  };
  // A still frame should show the finished page, not the first frame of its reveal.
  const still = params.motion
    ? false
    : (params.reduced ?? new URL(location.href).searchParams.has("t"));
  if (params.full) {
    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";
    stage.style.position = "absolute";
    stage.style.height = "auto";
    stage.style.overflow = "visible";
  }
  const campaign = await play(seed, policy, force);
  let host: HTMLElement = stage;
  if (params.panel) {
    stage.style.background = "#eeeeeb";
    const panel = document.createElement("div");
    panel.style.cssText = `width:${params.panel}px;margin:0 0 0 auto;min-height:100%;border-left:1px solid rgba(17,18,20,.12);box-shadow:0 18px 48px -18px rgba(17,18,20,.35)`;
    stage.append(panel);
    host = panel;
  }
  const log = (name: string) => () => console.log(`[debrief] ${name}`);
  renderDebrief(
    host,
    {
      ending: campaign.ending!,
      journal: campaign.journal,
      nodes: CAMPAIGN_NODES,
      world: campaign.world,
      seed: campaign.seed,
      reducedMotion: still,
      startingGDP: CAMPAIGN_MANIFEST.startingGDP,
      sharingNote: "This ride stayed on this device. Nothing was uploaded.",
    },
    {
      onReadDecisions: log("read decisions"),
      onSources: log("sources"),
      onExportReplay: log("export replay"),
      replayReady: false,
      onAnotherRide: log("another ride"),
      onSettings: log("settings"),
    },
  );
  // Mirrors the orchestrator: the replay file becomes ready a moment later.
  setReplayReady(host, true);
  if (params.open)
    for (const d of Array.from(
      host.querySelectorAll<HTMLDetailsElement>("details"),
    ))
      d.open = true;
  await document.fonts?.ready;
  if (params.scroll) stage.scrollTop = params.scroll;
}

// S6-01 "keep-report" keeps an inserted capability score in the briefing.
const KEEP_REPORT = { "S6-01": "keep-report" };
const ENDINGS: Array<
  [string, string, string, Policy, Record<string, string>?]
> = [
  [
    "debrief-succession",
    "Managed succession: reckless policy, delayed loss of control, an override and a battery crisis.",
    "lab-reckless-1",
    "reckless",
  ],
  [
    "debrief-restraint",
    "Costly restraint: cautious policy, independent review, a verified pause.",
    "lab-cautious-3",
    "cautious",
  ],
  [
    "debrief-extinction",
    "Extinction: reckless policy; the 18% chance happens.",
    "lab-reckless-0",
    "reckless",
  ],
  [
    "debrief-remnant",
    "Protected remnant: random policy; an empty reserve and edited reports.",
    "lab-random-8",
    "random",
  ],
  [
    "debrief-containment",
    "Coercive containment: cautious-leaning mix with an override that changed the route.",
    "lab-mixc-2",
    "mixc",
  ],
  [
    "debrief-tutelage",
    "Prosperous tutelage: reckless-leaning mix; the briefing keeps an inserted score.",
    "lab-mixed-30",
    "mixed",
    KEEP_REPORT,
  ],
  [
    "debrief-accountable",
    "Accountable continuity: random policy; the briefing keeps an inserted score.",
    "lab-random-29",
    "random",
    KEEP_REPORT,
  ],
  [
    "debrief-recovery",
    "Devastated survival: cautious-leaning mix, a diverted override and an edited report.",
    "lab-mixc-12",
    "mixc",
    KEEP_REPORT,
  ],
];

export const scenes: LabScene[] = ENDINGS.map(
  ([name, description, seed, policy, force]) => ({
    name,
    description,
    build: (ctx: LabContext) => mount(ctx, seed, policy, force),
  }),
);
