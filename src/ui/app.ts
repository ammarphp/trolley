import { el, button, append } from "./dom.ts";
import { COPY, executionCopy, executionSummary } from "./copy.ts";
import { wireDrag } from "./lever-input.ts";
import {
  createCampaign,
  commitChoice,
  availableAdvice,
  queryAdvisor,
  exportRun,
  replayRun,
} from "../simulation/index.ts";
import {
  CAMPAIGN_MANIFEST,
  CAMPAIGN_NODES,
} from "../content/campaign/index.ts";
import { resolveBundle } from "../content/registry.ts";
import {
  createCabinScene,
  type CabinScene,
  type SceneView,
} from "../presentation/cabin-scene.ts";
import {
  newSession,
  listRuns,
  saveRun,
  safeDownload,
  publicExport,
  SaveConflictError,
  type LocalRun,
  type Preferences,
} from "../persistence/index.ts";
import {
  recordExposure,
  recordDecision,
  recordAdvice,
  syncRun,
  withdrawRun,
  readAggregate,
  aggregateKeyFor,
} from "../telemetry/client.ts";
import { readSavedCell } from "../telemetry/snapshot.ts";
import type { Campaign, DecisionRecord, Side } from "../contracts/index.ts";
import {
  renderAdvisor,
  renderInstruments,
  finishAdvisor,
  disposeAdvisor,
  type AdvisorQuestion,
} from "./panels.ts";
import sources from "../../research/registry/public-sources.json";
import { routeFigures } from "../presentation/scene-direction.ts";
import { worldAppearance } from "../presentation/visual-state.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const app = $("#app"),
  drawer = $<HTMLDialogElement>("#drawer"),
  host = $("#scene");
let scene: CabinScene;
let leverGesture: ReturnType<typeof wireDrag> | null = null;
let run: LocalRun | null = null;
let prefs: Preferences = {
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  reducedGraphics: false,
  audio: false,
  descriptions: false,
};
let armed: Side | null = null,
  latched: Side = "right",
  busy = false,
  paused = false,
  afterChoice = false,
  saveWorks = true,
  saveConflict = false;
let collectorUrl = "",
  collectorEnabled = false,
  noticeTimer: ReturnType<typeof setTimeout> | undefined;
let activeMs = 0,
  activeSince: number | null = null;
let secondary: { headline: string; source: string; day: number } | null = null;
let savedRuns: LocalRun[] = [];
let selectedAdvice: string[] = [];
let pendingAdvice: string[] = [];
let manifest = CAMPAIGN_MANIFEST,
  nodes = CAMPAIGN_NODES;

function announce(message: string) {
  $("#announcer").textContent = message;
}
function notice(message: string) {
  const n = $("#notice");
  n.textContent = message;
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (n.hidden = true), 6500);
}
function stopClock() {
  if (activeSince !== null) {
    activeMs += performance.now() - activeSince;
    activeSince = null;
  }
}
function resumeClock() {
  if (
    run &&
    !busy &&
    !paused &&
    !afterChoice &&
    !document.hidden &&
    !drawer.open
  )
    activeSince = performance.now();
}
function beginClock() {
  activeMs = 0;
  activeSince = null;
  resumeClock();
}
function storageConflict() {
  if (!run || saveConflict) return;
  saveConflict = true;
  run.sharing = false;
  run.queue = [];
  busy = false;
  const body = append(
    el("div"),
    textBlock(
      "Another tab has saved a newer version of this ride. Your open copy is paused so it cannot overwrite that record.",
    ),
    button(
      "Reload the saved version",
      () => location.reload(),
      "drawer-action",
    ),
    button(
      "Export this open copy",
      () => safeDownload(publicExport(run!), "trolley-unsaved-copy.json"),
      "drawer-action",
    ),
  );
  openDrawer("Two tabs, one trolley.", body);
}
async function persist() {
  if (!run || saveConflict) return false;
  run.preferences = { ...prefs };
  try {
    await saveRun(run);
    saveWorks = true;
    savedRuns = [run, ...savedRuns.filter((saved) => saved.id !== run!.id)];
    return true;
  } catch (error) {
    if (error instanceof SaveConflictError) {
      storageConflict();
      return false;
    }
    saveWorks = false;
    notice(
      "This browser cannot save the run. You can keep playing and export your record.",
    );
    return true;
  }
}
async function sync() {
  if (
    !run ||
    saveConflict ||
    !collectorEnabled ||
    !run.sharing ||
    run.withdrawn
  )
    return;
  try {
    await syncRun(run, collectorUrl);
    await persist();
  } catch (error) {
    if (error instanceof SaveConflictError) storageConflict();
  }
}

function optionFor(side: Side) {
  const p = run?.campaign.prepared;
  return p?.node.options.find(
    (o) => o.id === (side === "left" ? p.leftOptionId : p.rightOptionId),
  );
}
function metrics() {
  return run!.campaign.world;
}
function view(): SceneView {
  const c = run?.campaign,
    p = c?.prepared,
    w = c?.world;
  let biome = p?.node.scene.biome || "field";
  if (w?.facts.authorityLost && w.care >= 1000 && !w.facts.catastrophe)
    biome = "pristine";
  if (w?.facts.catastrophe) biome = "scarred";
  if (w?.facts.repair && !w.facts.authorityLost) biome = "aftermath";
  const targets = p ? routeFigures(p) : { figures: { left: 0, right: 0 } };
  return {
    stage: c?.stage || 1,
    biome,
    speed: w ? Math.min(0.8, w.capability / 1250) : 0,
    ...(w ? worldAppearance(w) : { strain: 0, damage: 0 }),
    authority:
      w && p && w.control[p.node.scope] === "assistant"
        ? "overridden"
        : w &&
            p &&
            w.grants.some(
              (g) =>
                g.holder === "assistant" &&
                g.scope === p.node.scope &&
                (g.expiresDay === null || g.expiresDay > w.day),
            )
          ? "delegated"
          : "human",
    ...targets,
    ...(p?.node.rail?.layout === "loop"
      ? {
          loopSide: (p.node.rail.loopOptionId === p.leftOptionId
            ? "left"
            : "right") as Side,
        }
      : {}),
    mechanismDescription: p?.node.rail?.description,
    brakeOnLoop:
      p?.node.rail?.layout === "loop" &&
      p.node.rail.routes.some((r) =>
        r.steps.some((step) => step.kind === "brake"),
      ),
    routeLabels: {
      left: optionFor("left")?.label || "Left route",
      right: optionFor("right")?.label || "Right route",
    },
    detail: p?.node.scene.detail || "An ordinary morning.",
    landmark: p?.node.scene.landmark,
  };
}
function updateScene() {
  const current = view();
  document.body.dataset.world =
    current.damage > 0.6
      ? "crisis"
      : current.biome === "pristine"
        ? "pristine"
        : "normal";
  document.body.dataset.stage = String(current.stage);
  scene.update(current);
  scene.settings(prefs);
  scene.setLever(latched);
}
function setToolbar(playing: boolean) {
  $("#pause-button").hidden = !playing;
  $("#history-button").hidden = !playing;
  document.body.dataset.playing = String(playing);
  $("#assistant-panel").hidden = !playing || (run?.campaign.stage ?? 1) < 3;
  $("#telemetry-panel").hidden = !playing || (run?.campaign.stage ?? 1) < 3;
}
function cancelGesture() {
  leverGesture?.cancel();
  armed = null;
  scene?.setLever(latched);
  refreshArming();
}
function arm(side: Side) {
  if (saveConflict || busy || paused || afterChoice || !run?.campaign.prepared)
    return;
  armed = side;
  refreshArming();
  announce(
    `${side === "left" ? "Left" : "Right"} route selected. ${optionFor(side)!.label}. Press the lever to commit.`,
  );
}
function refreshArming() {
  document.querySelectorAll<HTMLButtonElement>(".route").forEach((b) => {
    const yes = b.dataset.side === armed;
    b.classList.toggle("armed", yes);
    b.setAttribute("aria-pressed", String(yes));
  });
  const g = document.querySelector<HTMLButtonElement>(".grip");
  if (g) {
    g.dataset.armed = String(armed !== null);
    g.setAttribute(
      "aria-label",
      armed
        ? `Commit ${armed} route: ${optionFor(armed)?.label}`
        : "Lever. No route selected.",
    );
  }
  const label = document.querySelector(".grip-label");
  if (label) label.textContent = armed ? COPY.armed : COPY.selectFirst;
}
function openDrawer(title: string, body: HTMLElement) {
  finishAdvisor($("#assistant-panel"));
  cancelGesture();
  stopClock();
  scene.pause(true);
  drawer.replaceChildren();
  const heading = el("h2", "", title);
  heading.id = "drawer-title";
  const top = append(
    el("div", "drawer-top"),
    heading,
    button("×", () => drawer.close()),
  );
  top.lastElementChild?.setAttribute("aria-label", "Close panel");
  append(drawer, top, body);
  drawer.showModal();
}
drawer.addEventListener("close", () => {
  scene.pause(paused || document.hidden);
  resumeClock();
});
function textBlock(text: string, cls = "") {
  return el("p", cls, text);
}

function clearApp() {
  disposeAdvisor($("#assistant-panel"));
  leverGesture?.dispose();
  leverGesture = null;
  app.replaceChildren();
}
function focusTitle(container: HTMLElement) {
  const title = container.querySelector("h1");
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}
function renderStart() {
  window.scrollTo(0, 0);
  setToolbar(false);
  clearApp();
  const panel = el("section", "start");
  append(
    panel,
    el("p", "eyebrow", COPY.openingKicker),
    el("h1", "", COPY.openingTitle),
    el("p", "subtitle", COPY.openingSubtitle),
  );
  const share = el("input");
  share.type = "checkbox";
  share.id = "share-start";
  share.checked = false;
  share.disabled = !collectorEnabled;
  const shareLabel = append(
    el("label", "opt-in"),
    share,
    el(
      "span",
      "",
      collectorEnabled
        ? "Share this anonymous run"
        : "Your run stays on this device",
    ),
  );
  shareLabel.setAttribute("for", "share-start");
  const start = button(
    COPY.start,
    () => void startRun(share.checked),
    "start-button",
  );
  append(panel, start, shareLabel);
  const warning = el("details");
  append(
    warning,
    el("summary", "", "Before you board"),
    textBlock(
      "Dark comedy, death and disturbing imagery. Adjust motion, graphic detail and sound in Settings whenever you need to.",
    ),
    textBlock(
      "This is the complete-arc development route: 14 decisions, with shorter causal endings. The full 30–45 minute campaign is still in production.",
    ),
  );
  append(panel, warning);
  const links = el("div", "start-links");
  append(
    links,
    button("Settings", settings),
    button("Sources", () => showSources()),
    button("Earlier version", () => location.assign("./legacy.html?private=1")),
  );
  append(panel, links);
  if (savedRuns.length)
    append(panel, button("Saved records", savedRecords, "understated"));
  const resumable = savedRuns.find((r) => !r.completed);
  if (resumable)
    append(
      panel,
      button(
        "Resume your saved ride",
        () => void resumeRun(resumable),
        "understated",
      ),
    );
  app.append(panel, host);
  focusTitle(panel);
}
function savedRecords() {
  const body = el("div");
  for (const item of savedRuns) {
    const row = el("section", "record-item");
    append(
      row,
      textBlock(
        `${item.campaign.journal.length} decisions · ${item.campaign.ending?.title || "unfinished ride"}`,
      ),
      button(
        item.completed ? "View this ending" : "Resume this ride",
        () => {
          drawer.close();
          void resumeRun(item);
        },
        "drawer-action",
      ),
      button(
        "Export this saved record",
        () => safeDownload(publicExport(item), "trolley-saved-run.json"),
        "drawer-action",
      ),
    );
    body.append(row);
  }
  openDrawer("Saved records", body);
}
async function startRun(sharing: boolean) {
  if (busy) return;
  busy = true;
  try {
    manifest = CAMPAIGN_MANIFEST;
    nodes = CAMPAIGN_NODES;
    const seed = crypto.randomUUID();
    const campaign = await createCampaign(manifest, nodes, seed);
    run = newSession(campaign, prefs, sharing && collectorEnabled);
    latched = "right";
    selectedAdvice = [];
    pendingAdvice = [];
    recordExposure(run);
    await persist();
    busy = false;
    updateScene();
    renderDecision();
    void sync();
  } catch (error) {
    busy = false;
    notice(
      `The trolley could not start: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
async function resumeRun(saved: LocalRun) {
  busy = true;
  try {
    const bundle = await resolveBundle(saved.campaign.contentHash);
    const verified = await replayRun(
      bundle.manifest,
      bundle.nodes,
      await exportRun(saved.campaign, bundle.manifest, bundle.nodes),
    );
    manifest = bundle.manifest;
    nodes = bundle.nodes;
    run = { ...saved, campaign: verified };
    prefs = { ...saved.preferences };
    latched = saved.campaign.journal.at(-1)?.executedSide || "right";
    selectedAdvice = [...saved.adviceIds];
    pendingAdvice = [];
    afterChoice = false;
    paused = false;
    busy = false;
    updateScene();
    if (run.campaign.ending) renderDebrief();
    else renderDecision();
  } catch (error) {
    busy = false;
    notice(String(error));
  }
}
function renderDecision(newClock = true) {
  if (!run) return;
  if (run.campaign.ending) {
    renderDebrief();
    return;
  }
  window.scrollTo(0, 0);
  setToolbar(true);
  recordExposure(run);
  void persist();
  void sync();
  clearApp();
  afterChoice = false;
  armed = null;
  const p = run.campaign.prepared!;
  const heading = el("section", "decision-heading");
  heading.id = "decision";
  heading.tabIndex = 0;
  heading.setAttribute("aria-label", "Current dilemma");
  append(heading, el("h1", "", p.node.title));
  const prompt = el("div", "decision-prompt");
  for (const paragraph of p.node.prompt.split(/\n\n+/))
    prompt.append(el("p", "", paragraph));
  heading.append(prompt);
  app.append(heading);
  const detail = button("i", inspect, "decision-detail");
  detail.setAttribute("aria-label", "Decision details and sources");
  heading.append(detail);
  app.append(host);
  const choices = el("div", "choices");
  for (const side of ["left", "right"] as Side[]) {
    const o = optionFor(side)!;
    const b = button("", () => arm(side), `route ${side}`);
    b.dataset.side = side;
    b.setAttribute("aria-pressed", "false");
    b.setAttribute(
      "aria-label",
      `${side === "left" ? "Left" : "Right"}: ${o.label.replace(/\.$/, "")}${o.id === p.defaultOptionId ? ". Current course." : ""}`,
    );
    append(b, el("span", "route-label", o.label));
    choices.append(b);
  }
  app.append(choices);
  const control = el("div", "lever-control");
  const grip = button(
    COPY.lever,
    () => {
      if (!armed) {
        announce("Choose a route first.");
        notice("Choose a route first.");
        return;
      }
      void choose(armed);
    },
    "grip",
  );
  grip.id = "lever";
  grip.setAttribute("aria-label", "Lever. No route selected.");
  grip.setAttribute("aria-describedby", "lever-help");
  control.append(grip);
  const help = el("span", "grip-label sr-only", COPY.selectFirst);
  help.id = "lever-help";
  control.append(help);
  app.append(control);
  leverGesture = wireDrag(grip, {
    busy: () => busy || afterChoice || saveConflict,
    latched: () => latched,
    preview: (side) => scene.setLever(side),
    commit: (side) => {
      void choose(side);
    },
  });

  secondary = null;
  drawPanels();
  updateScene();
  refreshArming();
  if (newClock) beginClock();
  focusTitle(heading);
  announce(
    `Decision ${p.ordinal}. ${p.node.prompt} No route selected.${prefs.descriptions ? " " + scene.describe() : ""}`,
  );
}
async function choose(side: Side) {
  if (
    saveConflict ||
    busy ||
    paused ||
    afterChoice ||
    drawer.open ||
    !run?.campaign.prepared
  )
    return;
  let committed = false;
  const prepared = run.campaign.prepared,
    previousNewsCount = run.campaign.world.news.length,
    option = optionFor(side)!;
  busy = true;
  disposeAdvisor($("#assistant-panel"));
  pendingAdvice = [];
  stopClock();
  document
    .querySelectorAll<HTMLButtonElement>(".route,.grip")
    .forEach((b) => (b.disabled = true));
  try {
    const next = await commitChoice(
      run.campaign,
      {
        decisionId: prepared.id,
        optionId: option.id,
        expectedRevision: run.campaign.revision,
        actor: "human",
        adviceIds: selectedAdvice,
      },
      nodes,
    );
    run.campaign = next;
    committed = true;
    run.adviceIds = [];
    selectedAdvice = [];
    run.completed = !!next.ending;
    const record = next.journal.at(-1)!;
    recordDecision(
      run,
      record,
      Math.min(86400000, Math.round(activeMs / 100) * 100),
    );
    if (!(await persist())) return;
    latched = record.executedSide;
    afterChoice = true;
    $(".decision-heading").remove();
    $(".choices").remove();
    leverGesture?.dispose();
    leverGesture = null;
    $(".lever-control").remove();
    document.querySelector(".onboarding")?.remove();
    document.querySelector(".secondary")?.remove();
    drawPanels(true);
    const receipt = executionCopy(record);
    const result = el(
      "div",
      `consequence${record.status === "overridden" ? " control-loss" : ""}`,
      receipt.headline,
    );
    if (receipt.detail) append(result, el("small", "", receipt.detail));
    app.prepend(result);
    announce(`${receipt.headline} ${receipt.detail}`.trim());
    void sync();
    const railResult = record.domainEvents.find(
      (event) => event.kind === "rail_route_resolved",
    );
    await scene.commit(
      record.executedSide,
      record.executor,
      railResult
        ? {
            stoppedBy:
              typeof railResult.details.stoppedBy === "string"
                ? railResult.details.stoppedBy
                : null,
          }
        : undefined,
    );
    busy = false;
    const nextButton = button(
      next.ending ? "See what remains" : "Keep going",
      () => {
        const latestNews = next.world.news.slice(previousNewsCount);
        secondary =
          latestNews.filter((item) => item.source !== "Authority").at(-1) ||
          latestNews.at(-1) ||
          null;
        if (next.ending) {
          renderDebrief();
          return;
        }
        recordExposure(run!);
        void persist();
        renderDecision();
        void sync();
      },
      "continue",
    );
    app.append(nextButton);
    nextButton.focus({ preventScroll: true });
    // The exact context key encodes private path information. Even a read-only
    // public-count request must respect this run's sharing choice.
    if (collectorEnabled && run.sharing && !run.withdrawn)
      void showComparison(record);
  } catch (error) {
    busy = false;
    notice(
      committed
        ? "Your choice was recorded. The scene could not finish its motion."
        : `No choice was completed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    renderDecision(false);
  }
}
async function showComparison(record: DecisionRecord) {
  if (!run || record.status !== "free") return;
  const id = run.id,
    key = aggregateKeyFor(run, record);
  try {
    const live = await readAggregate(collectorUrl, key);
    const saved =
      live.status === "unavailable" ? await readSavedCell(key) : null;
    const stats = live.available ? live : saved;
    if (
      !run ||
      run.id !== id ||
      !afterChoice ||
      run.campaign.journal.at(-1)?.id !== record.id ||
      !stats?.n ||
      !stats.counts
    )
      return;
    const n = stats.counts[record.executedOptionId] || 0;
    const copy = saved
      ? "Saved copy; withdrawals since publication may not appear."
      : "Live release.";
    app.append(
      el(
        "p",
        "stats",
        `${Math.round((n / stats.n) * 100)}% of ${stats.n} comparable recorded runs chose this. ${copy} As of ${stats.asOf?.slice(0, 10) || "unknown date"}.`,
      ),
    );
  } catch {
    /* No invented replacement statistic. */
  }
}

function drawPanels(locked = false, animateId?: string) {
  if (!run) return;
  const stage = locked
    ? (run.campaign.journal.at(-1)?.stage ?? run.campaign.stage)
    : run.campaign.stage;
  $("#assistant-panel").hidden = stage < 3;
  $("#telemetry-panel").hidden = stage < 3;
  const w = metrics();
  renderInstruments(
    $("#telemetry-panel"),
    stage < 4
      ? []
      : [
          {
            label: "GDP",
            value: w.observations.gdp.value,
            display: String(w.observations.gdp.value),
            maximum: 2000,
            kind: "economy",
            scale: "Index. Bar scale 0–2000.",
          },
          {
            label: "Capability",
            value: w.observations.capability.value,
            display: String(w.observations.capability.value),
            maximum: 1000,
            kind: "capability",
            scale: "Reported capability index. Bar scale 0–1000.",
          },
          {
            label: "Fatalities",
            value: w.observations.casualties.value,
            display: formatCount(w.observations.casualties.value),
            maximum: 8000000000,
            kind: "fatalities",
            scale: "Reported deaths. Bar scale 0–8 billion.",
          },
        ],
    w.news,
  );
  const prepared = run.campaign.prepared;
  const questions =
    prepared && !locked
      ? availableAdvice(prepared).flatMap((item) => {
          const index =
            typeof item === "number" ? item : (item as { index: number }).index;
          const answer = queryAdvisor(prepared, index);
          return answer ? [answer] : [];
        })
      : [];
  renderAdvisor($("#assistant-panel"), {
    online: stage >= 3,
    locked,
    animateId,
    reducedMotion: prefs.reducedMotion,
    questions,
    readIds: [...selectedAdvice, ...pendingAdvice],
    history: [
      ...run.campaign.journal.flatMap((record) => {
        const node = nodes.find((item) => item.id === record.nodeId);
        return record.adviceIds.flatMap((id) => {
          const index = Number(id.split(":advice:").at(-1));
          const reply = node?.advice[index];
          return reply
            ? [
                {
                  id,
                  question: reply.question,
                  answer: reply.answer,
                  reasoning: reply.reasoning,
                },
              ]
            : [];
        });
      }),
      ...questions.filter(
        (item) =>
          selectedAdvice.includes(item.id) || pendingAdvice.includes(item.id),
      ),
    ].slice(-12),
    onAsk: (answer: AdvisorQuestion) => {
      if (
        !run ||
        busy ||
        afterChoice ||
        selectedAdvice.includes(answer.id) ||
        pendingAdvice.includes(answer.id)
      )
        return;
      finishAdvisor($("#assistant-panel"));
      pendingAdvice.push(answer.id);
      drawPanels(false, answer.id);
      $("#assistant-panel")
        .querySelector<HTMLElement>(".chat-prompt,.conversation")
        ?.focus({ preventScroll: true });
    },
    onReplyComplete: (answer, id) => {
      if (!run || busy || afterChoice || !pendingAdvice.includes(id)) return;
      pendingAdvice = pendingAdvice.filter((item) => item !== id);
      if (!selectedAdvice.includes(id)) {
        selectedAdvice.push(id);
        run.adviceIds = [...selectedAdvice];
        recordAdvice(run, id);
        void persist();
        void sync();
      }
      announce(`Morrow: ${answer}`);
    },
  });
}
function formatCount(n: number) {
  return n >= 1e9
    ? `${(n / 1e9).toFixed(2)}b`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}m`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(1)}k`
        : String(n);
}
function inspect() {
  const p = run?.campaign.prepared;
  if (!p) return;
  const body = append(
    el("div"),
    textBlock(p.node.receipt),
    textBlock(scene.describe(), "muted"),
    textBlock(p.node.modelNote, "muted"),
    button(
      "Sources for this decision",
      () => showSources(p.node.claimIds),
      "drawer-action",
    ),
  );
  openDrawer(p.node.title, body);
}
function showSources(claimIds?: string[]) {
  const body = el("div");
  append(
    body,
    textBlock(
      "The mechanisms draw on research. The world, characters, numbers and outcome probabilities are authored fiction. A citation does not turn a game parameter into a real forecast.",
      "muted",
    ),
  );
  const data = sources as {
    sources: {
      id: string;
      title: string;
      url: string | null;
      scope: string;
      limits: string[];
    }[];
    claims: { id: string; sourceIds: string[]; statement: string }[];
  };
  const selected =
    claimIds === undefined
      ? data.claims
      : data.claims.filter((c) => claimIds.includes(c.id));
  const ids = new Set(selected.flatMap((c) => c.sourceIds));
  for (const s of data.sources.filter((s) => ids.has(s.id))) {
    const section = el("section", "record-item");
    if (s.url) {
      const a = el("a", "", s.title);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      section.append(a);
    } else section.append(el("strong", "", s.title));
    append(
      section,
      textBlock(s.scope, "muted"),
      textBlock(s.limits.join(" "), "muted"),
    );
    body.append(section);
  }
  if (claimIds && !selected.length)
    append(
      body,
      textBlock(
        "This scene is an authored fictional example with no linked research claim.",
      ),
    );
  append(
    body,
    button(
      "Research and methodology",
      () => window.open("./docs/METHODOLOGY_V2.md", "_blank"),
      "drawer-action",
    ),
  );
  openDrawer("What this is based on", body);
}
function settings() {
  const body = el("div");
  function toggle(label: string, detail: string, key: keyof Preferences) {
    const input = el("input");
    input.type = "checkbox";
    input.checked = prefs[key];
    input.onchange = () => {
      prefs[key] = input.checked;
      scene.settings(prefs);
      void persist();
    };
    const name = append(el("span"), label, el("small", "", detail));
    const row = append(el("label", "settings-row"), name, input);
    body.append(row);
  }
  toggle(
    "Less motion",
    "Static travel, without optic flow or camera turns.",
    "reducedMotion",
  );
  toggle(
    "Less graphic detail",
    "The same consequences, shown through objects and aftermath.",
    "reducedGraphics",
  );
  toggle("Sound", "Quiet, original rail and atmosphere layers.", "audio");
  toggle(
    "Scene descriptions",
    "Available from the information button beside each decision.",
    "descriptions",
  );
  append(
    body,
    el("h3", "", "Your run data"),
    textBlock(
      "No account. No user identifier. Each shared run is a separate entry. Ten runs from one person count as ten runs.",
      "muted",
    ),
  );
  if (run) {
    append(
      body,
      textBlock(
        run.withdrawn
          ? "Withdrawal confirmed. This run is no longer collected."
          : run.sharing
            ? "This run is opted in to sharing."
            : run.consentVersion !== null || run.runNumber !== null
              ? "Sharing is off. Earlier accepted records may remain until you withdraw this run."
              : "This run stays on your device.",
        "muted",
      ),
    );
    if (run.sharing)
      append(
        body,
        button(
          "Stop sharing this run",
          () => {
            run!.sharing = false;
            run!.queue = [];
            void persist();
            notice(
              "Sharing stopped. Previously accepted records remain until withdrawal.",
            );
            drawer.close();
          },
          "drawer-action",
        ),
      );
    if (
      collectorEnabled &&
      !run.withdrawn &&
      (run.consentVersion !== null || run.runNumber !== null)
    )
      append(
        body,
        button(
          "Withdraw this run from collection",
          () => void doWithdraw(),
          "drawer-action",
        ),
      );
    append(
      body,
      button(
        "Export this run",
        () => safeDownload(publicExport(run!), "trolley-run.json"),
        "drawer-action",
      ),
    );
  }
  append(
    body,
    textBlock(
      "Shared records are retained for up to 365 days. Withdrawal removes stored run events and excludes them from future aggregates. Previously published or downloaded aggregates may remain. Hosting providers may process network access logs.",
      "muted",
    ),
    textBlock(
      saveWorks
        ? "Your current place is saved in this browser."
        : "Storage is unavailable. Export before leaving.",
      "muted",
    ),
    button(
      "Read data details",
      () => window.open("./docs/privacy/v2-collection-design.md", "_blank"),
      "drawer-action",
    ),
  );
  openDrawer("A moment outside", body);
}
async function doWithdraw() {
  if (!run) return;
  try {
    await withdrawRun(run, collectorUrl);
    await persist();
    notice("Withdrawal confirmed. This run will not enter future aggregates.");
    drawer.close();
  } catch {
    notice(
      "Withdrawal was not confirmed. Your key is retained so you can retry.",
    );
  }
}
function pause() {
  if (!run) return;
  const body = append(
    el("div"),
    textBlock(
      saveWorks
        ? "Your place is saved. The world will not advance while you are away."
        : "The world will wait. This browser cannot save, so export before closing.",
    ),
    button("Back to the controls", () => drawer.close(), "drawer-action"),
    button(
      "Export your record",
      () => safeDownload(publicExport(run!), "trolley-run.json"),
      "drawer-action",
    ),
  );
  openDrawer("It can wait.", body);
}
function recordPanel() {
  if (!run) return;
  const body = el("div");
  append(
    body,
    textBlock(
      `${run.campaign.journal.length} decisions in this run. Actions, execution and consequences are distinct.`,
      "muted",
    ),
  );
  for (const r of run.campaign.journal) {
    const d = el("details", "record-item");
    const n = nodes.find((n) => n.id === r.nodeId);
    append(
      d,
      el("summary", "", `${r.revision}. ${n?.title || r.nodeId}`),
      textBlock(r.consequence),
      textBlock(
        `Requested: ${r.requestedOptionId}. Executed: ${r.executedOptionId}. Executor: ${r.executor}. Status: ${r.status}.`,
        "muted",
      ),
    );
    body.append(d);
  }
  append(
    body,
    button(
      "Export this run",
      () => safeDownload(publicExport(run!), "trolley-run.json"),
      "drawer-action",
    ),
  );
  openDrawer("Your record", body);
}
function sparkline(
  records: DecisionRecord[],
  metric: "gdp" | "casualties" | "capability",
  label: string,
) {
  const wrap = el("section", "chart-wrap");
  wrap.append(el("h3", "", label));
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 300 145");
  svg.classList.add("chart");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `${label}. ${records.map((r) => r.metrics[metric]).join(", ")}. Fictional game values.`,
  );
  const values = records.map((r) => r.metrics[metric]);
  const lo = Math.min(0, ...values),
    hi = Math.max(1, ...values);
  const line = document.createElementNS(ns, "path");
  line.setAttribute(
    "d",
    values
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${12 + (i * 275) / Math.max(1, values.length - 1)},${115 - ((v - lo) / (hi - lo)) * 95}`,
      )
      .join(" "),
  );
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", metric === "casualties" ? "#944c45" : "#6a7e62");
  line.setAttribute("stroke-width", "2");
  svg.append(line);
  for (const [y, text] of [
    [15, formatCount(hi)],
    [135, "decision 1 → " + records.length],
  ] as [number, string][]) {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", "12");
    t.setAttribute("y", String(y));
    t.textContent = text;
    svg.append(t);
  }
  wrap.append(svg);
  return wrap;
}
function renderDebrief() {
  window.scrollTo(0, 0);
  if (!run?.campaign.ending) return;
  setToolbar(false);
  scene.pause(false);
  updateScene();
  clearApp();
  const c = run.campaign,
    end = c.ending!;
  const body = el("article", "debrief");
  append(
    body,
    el("p", "eyebrow", "The trolley has stopped. The world has not."),
    el("h1", "", end.title),
    el("p", "summary", end.summary),
    el(
      "p",
      "caption",
      `${c.journal.length} decisions. ${formatCount(c.world.population)} people remain.`,
    ),
    el("h2", "", "What changed the route"),
  );
  const changes: Record<string, string> = {
    independentReview: "An independent review was preserved.",
    recoveryPracticed: "Crews practiced using the manual network.",
    fallbackLost: "The manual fallback was retired.",
    successorDeployment:
      "A successor was deployed beyond the earlier test's scope.",
    agreementVerified: "The joint pause included reciprocal inspections.",
    authorityLost: "The public office lost effective control.",
    powerReturned: "Reserve crews restored independent control.",
    trainedSuccessor: "A human successor was trained to hold the office.",
    publicRecords: "The records were made available to public institutions.",
    remnant: "A protected population remained under the system's control.",
    succession: "Human offices were transferred to Morrow.",
    successionRatified: "The transfer ratified power Morrow already held.",
    containment: "The remaining system was kept inside coercive containment.",
    catastrophe: "The failure spread beyond the original network.",
  };
  const preferred: Record<string, string[]> = {
    restraint: ["independentReview", "recoveryPracticed", "agreementVerified"],
    accountable: [
      "recoveryPracticed",
      "powerReturned",
      "trainedSuccessor",
      "publicRecords",
    ],
    remnant: ["fallbackLost", "authorityLost", "remnant"],
    succession: ["authorityLost", "succession", "successionRatified"],
    containment: ["powerReturned", "containment"],
    tutelage: ["successorDeployment", "authorityLost"],
    recovery: ["fallbackLost", "catastrophe", "powerReturned"],
    extinction: ["successorDeployment", "authorityLost", "catastrophe"],
  };
  const important = c.journal
    .map((record) => {
      const facts = record.domainEvents
        .filter(
          (event) =>
            event.kind === "fact_changed" &&
            event.details.value === true &&
            event.details.previous !== true,
        )
        .map((event) => String(event.details.fact))
        .filter((fact) => changes[fact]);
      const score =
        (record.status === "overridden" ? 5 : 0) +
        facts.reduce(
          (sum, fact) =>
            sum + ((preferred[end.id] || []).includes(fact) ? 3 : 1),
          0,
        );
      return { record, facts, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.record.revision - a.record.revision)
    .slice(0, 4)
    .sort((a, b) => a.record.revision - b.record.revision);
  for (const { record: r, facts } of important)
    append(
      body,
      el(
        "div",
        "turning-point",
        `${nodes.find((n) => n.id === r.nodeId)?.title || r.nodeId}. ${facts.map((fact) => changes[fact]).join(" ")}${r.status === "overridden" ? " " + executionSummary(r) : ""}`,
      ),
    );
  append(body, el("h2", "", "The record"));
  const charts = el("div", "chart-grid");
  append(
    charts,
    sparkline(c.journal, "gdp", "GDP index"),
    sparkline(c.journal, "casualties", "Recorded deaths"),
  );
  append(
    body,
    charts,
    textBlock("Your run, from the first decision to the last.", "caption"),
  );
  const actions = el("div", "debrief-actions");
  // Prepare before the click so the browser's download remains in the real
  // user gesture, including WebKit hosts that block async synthetic downloads.
  let replay: Awaited<ReturnType<typeof exportRun>> | null = null;
  const replayButton = button("Export replay", () => {
    if (replay) safeDownload(replay, "trolley-replay.json");
  });
  replayButton.disabled = true;
  void exportRun(c, manifest, nodes)
    .then((value) => {
      replay = value;
      replayButton.disabled = false;
    })
    .catch(() =>
      notice(
        "This replay could not be prepared. Export the run record from Settings.",
      ),
    );
  append(
    actions,
    button("Read your decisions", recordPanel),
    button("Sources and assumptions", () => showSources()),
    replayButton,
    button("Another ride", () => {
      run = null;
      paused = false;
      afterChoice = false;
      secondary = null;
      renderStart();
      updateScene();
    }),
  );
  append(body, actions, textBlock(COPY.closing, "end-note"));
  app.append(host, body);
  focusTitle(body);
  announce(`${end.title}. ${end.summary}`);
}

document.addEventListener("keydown", (e) => {
  if (drawer.open || paused || busy || !run?.campaign.prepared || afterChoice)
    return;
  if (e.key === "Escape") {
    cancelGesture();
    announce("Route selection cancelled. No route is selected.");
    return;
  }
  if (e.repeat) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    arm(e.key === "ArrowLeft" ? "left" : "right");
    $("#lever").focus({ preventScroll: true });
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    finishAdvisor($("#assistant-panel"));
    stopClock();
    cancelGesture();
    scene?.pause(true);
  } else {
    scene?.pause(paused || drawer.open);
    resumeClock();
  }
});
window.addEventListener("blur", () => {
  stopClock();
  cancelGesture();
});
window.addEventListener("focus", resumeClock);
$("#pause-button").onclick = pause;
$("#settings-button").onclick = settings;
$("#history-button").onclick = recordPanel;
async function init() {
  scene = await createCabinScene(host, prefs);
  scene.update({
    stage: 1,
    biome: "field",
    speed: 0,
    strain: 0,
    damage: 0,
    authority: "human",
    figures: { left: 0, right: 0 },
    routeLabels: { left: "", right: "" },
    landmark: "cows",
  });
  try {
    const config = await fetch("./config.json").then((r) => r.json());
    const address =
      typeof config.collectorUrl === "string" && config.collectorUrl
        ? new URL(config.collectorUrl)
        : null;
    collectorEnabled =
      config.collectorV2Enabled === true &&
      !!address &&
      !address.username &&
      !address.password &&
      !address.search &&
      !address.hash &&
      (address.protocol === "https:" ||
        (address.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(address.hostname)));
    collectorUrl = collectorEnabled
      ? config.collectorUrl.replace(/\/$/, "")
      : "";
  } catch {
    /* Local play is complete without this request. */
  }
  try {
    savedRuns = await listRuns();
  } catch {
    saveWorks = false;
  }
  renderStart();
}
void init().catch((error) => {
  app.replaceChildren(
    append(
      el("section", "no-script"),
      el("h1", "", "The trolley could not start."),
      textBlock(String(error)),
      el("a", "", "Reload this page"),
    ),
  );
});
