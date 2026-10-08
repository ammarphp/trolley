/**
 * The game orchestrator. Owns the run, the decision flow and the research
 * contracts; everything visual is delegated:
 *   world-host  -> the ink world renderer (or a static fallback)
 *   components  -> Morrow, the wire, instruments, the debrief
 *
 * Load-bearing order (unchanged from v2): commit -> recordDecision -> persist
 * BEFORE any animation; advice counts only once fully shown; the active clock
 * runs only while a decision is visible and the page has attention.
 */
import { el, button, append } from "./dom.ts";
import { COPY, executionCopy } from "./copy.ts";
import { wireDrag } from "./lever-input.ts";
import { createCampaign, commitChoice, availableAdvice, queryAdvisor, exportRun, replayRun } from "../simulation/index.ts";
import { CAMPAIGN_MANIFEST, CAMPAIGN_NODES } from "../content/campaign/index.ts";
import { resolveBundle } from "../content/registry.ts";
import { newSession, listRuns, saveRun, safeDownload, publicExport, SaveConflictError, type LocalRun, type Preferences } from "../persistence/index.ts";
import { recordExposure, recordDecision, recordAdvice, syncRun, withdrawRun, readAggregate, aggregateKeyFor } from "../telemetry/client.ts";
import { readSavedCell } from "../telemetry/snapshot.ts";
import type { DecisionRecord, Side } from "../contracts/index.ts";
import type { SceneAnchors, StageView, WorldRenderer } from "../render/api.ts";
import { createWorldHost, detectQuality, type WorldHost } from "./world-host.ts";
import { displayPrefs, saveDisplayPrefs, type DisplayPrefs } from "./display-prefs.ts";
import { createAudioBridge, type AudioBridge } from "./audio-bridge.ts";
import * as panels from "./panels-bridge.ts";
import sources from "../../research/registry/public-sources.json";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const app = $("#app"),
  drawer = $<HTMLDialogElement>("#drawer"),
  host = $("#scene");
let world: WorldHost;
let scene: WorldRenderer;
let audio: AudioBridge;
let leverGesture: ReturnType<typeof wireDrag> | null = null;
let run: LocalRun | null = null;
let prefs: Preferences = {
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  reducedGraphics: false,
  audio: false,
  descriptions: false,
};
let display: DisplayPrefs = displayPrefs();
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
let savedRuns: LocalRun[] = [];
let selectedAdvice: string[] = [];
let pendingAdvice: string[] = [];
let manifest = CAMPAIGN_MANIFEST,
  nodes = CAMPAIGN_NODES;
let currentView: StageView | null = null;
let lastAnchors: SceneAnchors | null = null;
let shownInterstitials = new Set<string>();
/** Set while a stage tunnel holds the next decision back; skip() reveals it. */
let transit: { skip: () => void } | null = null;

// ------------------------------------------------------------ utilities

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
  if (run && !busy && !paused && !afterChoice && !document.hidden && !drawer.open) activeSince = performance.now();
}
function beginClock() {
  activeMs = 0;
  activeSince = null;
  resumeClock();
}
function textBlock(text: string, cls = "") {
  return el("p", cls, text);
}
function mono(text: string, cls = "") {
  return el("span", `t-mono ${cls}`.trim(), text);
}
function arrow() {
  const a = el("span", "arrow", "→");
  a.setAttribute("aria-hidden", "true");
  return a;
}
function formatCount(n: number) {
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)} bn` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} m` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}
function currentPhase(): string {
  return document.body.dataset.phase ?? "boot";
}
function setPhase(phase: "title" | "decision" | "consequence" | "ending") {
  document.body.dataset.phase = phase;
}

// ---------------------------------------------------------- persistence

function storageConflict() {
  if (!run || saveConflict) return;
  saveConflict = true;
  run.sharing = false;
  run.queue = [];
  busy = false;
  const body = append(
    el("div", "drawer-body"),
    textBlock("Another tab has saved a newer version of this ride. Your open copy is paused so it cannot overwrite that record."),
    button("Reload the saved version", () => location.reload(), "drawer-action primary"),
    button("Export this open copy", () => safeDownload(publicExport(run!), "trolley-unsaved-copy.json"), "drawer-action"),
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
    notice("This browser cannot save the run. You can keep playing and export your record.");
    return true;
  }
}
async function sync() {
  if (!run || saveConflict || !collectorEnabled || !run.sharing || run.withdrawn) return;
  try {
    await syncRun(run, collectorUrl);
    await persist();
  } catch (error) {
    if (error instanceof SaveConflictError) storageConflict();
  }
}

// ---------------------------------------------------------------- scene

function optionFor(side: Side) {
  const p = run?.campaign.prepared;
  return p?.node.options.find((o) => o.id === (side === "left" ? p.leftOptionId : p.rightOptionId));
}

function rendererSettings() {
  return { reducedMotion: prefs.reducedMotion, reducedGraphics: prefs.reducedGraphics, audio: prefs.audio, noFlashing: display.noFlashing, quality: display.quality };
}

function updateScene(phase: "title" | "decision" | "consequence" | "ending") {
  const view = world.view(run?.campaign ?? null, phase, prefs.reducedGraphics);
  currentView = view;
  document.body.dataset.stage = String(view.stage);
  document.body.dataset.authority = view.cabin.authority;
  document.documentElement.dataset.motion = prefs.reducedMotion ? "reduced" : "full";
  scene.update(view);
  scene.settings(rendererSettings());
  if (phase !== "decision") scene.setLever(latched === "left" ? -1 : 1);
  audio.mood(view, run?.campaign.ending?.id);
  updateClock(view);
  for (const cue of view.cues) handleCue(cue.kind, cue.id, cue.data);
  return view;
}

function updateClock(view: StageView) {
  const c = run?.campaign;
  const clock = $("#hud-clock");
  if (!c || currentPhase() === "title") {
    clock.hidden = true;
    return;
  }
  clock.hidden = false;
  const day = (c.journal.at(-1)?.dayAfter ?? c.world.day) + 1;
  $("#hud-day").textContent = `Day ${day.toLocaleString("en-GB")} · ${view.cabin.clock}`;
  $("#hud-role").textContent = c.prepared?.node.role ?? "";
}

function handleCue(kind: string, id: string, data?: Record<string, string | number | boolean>) {
  if (kind === "tunnel" || kind === "appointment") {
    const key = `${run?.id}:${id}`;
    if (shownInterstitials.has(key)) return;
    shownInterstitials.add(key);
    const role = String(data?.role ?? run?.campaign.prepared?.node.role ?? "");
    if (!role) return;
    const box = $("#interstitial");
    const day = (run?.campaign.world.day ?? 0) + 1;
    box.replaceChildren(
      mono(`Day ${day.toLocaleString("en-GB")} · ${currentView?.cabin.clock ?? ""}`),
      el("strong", "", role),
      el("span", "role-note", kind === "tunnel" ? "A new office. The same lever." : "You have been appointed."),
    );
    box.hidden = false;
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "";
    setTimeout(() => {
      if (!transit) box.hidden = true;
    }, 4300);
    announce(`You have been appointed ${role}.`);
  }
}

/**
 * HUD geometry the per-frame layout depends on. Reading it forces layout, so
 * it is measured only when something has resized, never every frame.
 */
const hud = {
  dirty: true,
  top: 0,
  leftW: 0,
  rightLeft: 0,
  cardBottom: 120,
  tagW: { left: 220, right: 220 },
};
const narrowQuery = matchMedia("(max-width: 1100px), (max-height: 560px)");
const hudResize = new ResizeObserver(() => {
  hud.dirty = true;
  requestAnimationFrame(() => positionHud(null));
});
function watchHud() {
  hudResize.disconnect();
  for (const sel of [".hud-top", "#assistant-panel", "#telemetry-panel", ".decision-heading", ".route.left", ".route.right"]) {
    const node = document.querySelector(sel);
    if (node) hudResize.observe(node);
  }
  hud.dirty = true;
}
addEventListener("resize", () => (hud.dirty = true));

function measureHud() {
  hud.dirty = false;
  hud.top = $(".hud-top").getBoundingClientRect().height;
  const leftPanel = $("#assistant-panel");
  hud.leftW = leftPanel.hidden ? 0 : leftPanel.getBoundingClientRect().width;
  const rightPanel = $("#telemetry-panel");
  hud.rightLeft = rightPanel.hidden ? innerWidth : rightPanel.getBoundingClientRect().left;
  const card = document.querySelector<HTMLElement>(".decision-heading");
  hud.cardBottom = card ? card.getBoundingClientRect().bottom - hud.top : 120;
  for (const side of ["left", "right"] as const) hud.tagW[side] = document.querySelector<HTMLElement>(`.route.${side}`)?.offsetWidth || 220;
}

const written = new WeakMap<HTMLElement, Map<string, string>>();
function setVar(node: HTMLElement, name: string, value: string) {
  let vars = written.get(node);
  if (!vars) written.set(node, (vars = new Map()));
  if (vars.get(name) === value) return;
  vars.set(name, value);
  node.style.setProperty(name, value);
}

function positionHud(a: SceneAnchors | null) {
  if (a) lastAnchors = a;
  const anchors = lastAnchors;
  if (!anchors || narrowQuery.matches) return;
  // Reads first (and only when stale), then writes: no forced layout per frame.
  if (hud.dirty) measureHud();
  const vw = innerWidth;
  const top = hud.top;
  const body = document.body;
  // Keep Morrow clear of the side mirror, where the controller's face lives:
  // below it when there is room, otherwise beside it.
  const leftPanel = $("#assistant-panel");
  const mirrorBottom = anchors.mirror.height > 0 ? anchors.mirror.y + anchors.mirror.height - top : 0;
  const mirrorRight = anchors.mirror.width > 0 ? anchors.mirror.x + anchors.mirror.width : 0;
  const below = mirrorBottom > 0 && mirrorBottom < (innerHeight - top) * 0.52;
  const panelLeft = Math.round(below ? 16 : Math.max(16, Math.min(mirrorRight + 14, vw * 0.16)));
  const panelTop = Math.round(below ? Math.max(12, mirrorBottom + 14) : 12);
  setVar(body, "--panel-left", `${panelLeft}px`);
  setVar(body, "--panel-top", `${panelTop}px`);
  const leftEdge = leftPanel.hidden ? 16 : panelLeft + hud.leftW + 16;
  const rightEdge = $("#telemetry-panel").hidden ? vw - 16 : hud.rightLeft - 16;
  setVar(body, "--center-x", `${Math.round((leftEdge + rightEdge) / 2)}px`);
  setVar(body, "--center-width", `${Math.round(Math.max(360, rightEdge - leftEdge))}px`);
  // Windshield tags: pinned over each branch, clamped into the clear glass,
  // and kept apart when the fork is still distant.
  const minY = hud.cardBottom + 70;
  const placed: Record<"left" | "right", { x: number; y: number; w: number; dx: number; dy: number }> = {} as never;
  for (const side of ["left", "right"] as const) {
    const point = anchors[side];
    const w = hud.tagW[side];
    const desiredX = point.visible ? point.x : vw * (side === "left" ? 0.38 : 0.62);
    const desiredY = point.visible ? point.y - top - 20 : innerHeight * 0.52;
    placed[side] = { x: desiredX, y: Math.max(minY, Math.min(innerHeight - top - 150, desiredY)), w, dx: desiredX, dy: desiredY };
  }
  const gap = (placed.left.w + placed.right.w) / 2 + 28;
  if (placed.right.x - placed.left.x < gap) {
    const mid = (placed.left.x + placed.right.x) / 2;
    placed.left.x = mid - gap / 2;
    placed.right.x = mid + gap / 2;
  }
  for (const side of ["left", "right"] as const) {
    const tag = document.querySelector<HTMLElement>(`.route.${side}`);
    if (!tag) continue;
    const p = placed[side];
    const x = Math.max(leftEdge + p.w / 2, Math.min(rightEdge - p.w / 2, p.x));
    const y = Math.min(p.y, Math.max(minY, placed.left.y, placed.right.y));
    setVar(tag, "--x", `${Math.round(x)}px`);
    setVar(tag, "--y", `${Math.round(y)}px`);
    const dx = p.dx - x;
    const dy = Math.max(18, p.dy + 20 - y);
    setVar(tag, "--lead-y", `${Math.round(Math.hypot(dx, dy))}px`);
    setVar(tag, "--lead-angle", `${((-Math.atan2(dx, dy) * 180) / Math.PI).toFixed(1)}deg`);
  }
  const lever = document.querySelector<HTMLElement>(".lever-control");
  if (lever) {
    const r = anchors.lever;
    const cx = r.width > 0 ? r.x + r.width / 2 : vw * 0.72;
    const x = Math.max(leftEdge + 110, Math.min(rightEdge - 110, cx));
    setVar(lever, "--lever-x", `${Math.round(x - 110)}px`);
  }
}

// ------------------------------------------------------------- drawers

function openDrawer(title: string, body: HTMLElement) {
  panels.finishMorrow($("#assistant-panel"));
  panels.closeGlossary();
  cancelGesture();
  stopClock();
  scene.pause(true);
  audio.trigger("ui-open");
  drawer.replaceChildren();
  const heading = el("h2", "", title);
  heading.id = "drawer-title";
  const close = button("×", () => drawer.close());
  close.setAttribute("aria-label", "Close panel");
  const top = append(el("div", "drawer-top"), heading, close);
  if (!body.classList.contains("drawer-body")) body.classList.add("drawer-body");
  append(drawer, top, body);
  drawer.showModal();
}
drawer.addEventListener("close", () => {
  scene.pause(paused || document.hidden);
  audio.trigger("ui-close");
  resumeClock();
});

function clearApp() {
  panels.disposeMorrow($("#assistant-panel"));
  const debriefHost = document.querySelector<HTMLElement>(".debrief-host");
  if (debriefHost) panels.leaveDebrief(debriefHost);
  panels.newScreen();
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
function setToolbar(playing: boolean) {
  $("#pause-button").hidden = !playing;
  $("#history-button").hidden = !playing;
  document.body.dataset.playing = String(playing);
  const stage = run?.campaign.prepared?.stage ?? run?.campaign.stage ?? 1;
  $("#assistant-panel").hidden = !playing || stage < 3;
  $("#telemetry-panel").hidden = !playing || stage < 3;
  $("#ticker").hidden = !playing || stage < 3;
  document.body.classList.toggle("has-ticker", playing && stage >= 3);
  if (!playing) $("#stats-chip").hidden = true;
}

// ---------------------------------------------------------------- start

function renderStart() {
  window.scrollTo(0, 0);
  setPhase("title");
  setToolbar(false);
  clearApp();
  updateScene("title");
  scene.setInteractive(false);
  const panel = el("section", "start");
  const title = el("h1");
  title.append("trolley", el("span", "", "."));
  append(
    panel,
    mono("An illustrated parable in seven stages", "kicker"),
    title,
    el("p", "subtitle", COPY.openingSubtitle),
    el("p", "lede", "You drive the trolley. Choose a track, then pull the lever. A spilled coffee becomes a dispatch problem; a helpful assistant becomes infrastructure. Keep your hands on the controls."),
  );
  const share = el("input");
  share.type = "checkbox";
  share.id = "share-start";
  share.checked = false;
  share.disabled = !collectorEnabled;
  const shareLabel = append(el("label", "opt-in"), share, el("span", "", collectorEnabled ? "Share this anonymous run" : "Your run stays on this device"));
  shareLabel.setAttribute("for", "share-start");
  const start = button(COPY.start, () => void startRun(share.checked), "start-button");
  start.append(arrow());
  append(panel, start, shareLabel);
  const resumable = savedRuns.find((r) => !r.completed);
  if (resumable) {
    const card = el("div", "resume-card");
    append(
      card,
      append(el("div"), mono(`${resumable.campaign.journal.length} decisions in`), el("div", "", "A ride is waiting where you left it.")),
      button("Resume your saved ride", () => void resumeRun(resumable), "understated"),
    );
    panel.append(card);
  }
  const warning = el("details");
  append(
    warning,
    el("summary", "", "Before you board"),
    textBlock("Dark comedy, death and disturbing imagery, including blood. Motion, graphic detail, flashing effects and sound are adjustable in Settings at any time. Pausing stops the world."),
    textBlock(`About 30–45 minutes; 27–43 decisions from a bank of ${CAMPAIGN_NODES.length}, depending on your route. Your place saves in this browser.`),
  );
  panel.append(warning);
  const links = el("div", "start-links");
  append(
    links,
    button("Settings", settings),
    button("Sources", () => showSources()),
    button("Earlier version", () => location.assign("./legacy.html?private=1")),
    ...(savedRuns.length ? [button("Saved records", savedRecords)] : []),
  );
  panel.append(links);
  const meta = el("div", "start-meta");
  append(meta, mono("No account"), mono("No live model"), mono("Sound recommended"));
  panel.append(meta);
  app.append(panel);
  focusTitle(panel);
}

function savedRecords() {
  const body = el("div");
  for (const item of savedRuns) {
    const row = el("section", "record-item");
    append(
      row,
      mono(`${item.campaign.journal.length} decisions`),
      textBlock(item.campaign.ending?.title || "Unfinished ride"),
      button(
        item.completed ? "View this ending" : "Resume this ride",
        () => {
          drawer.close();
          void resumeRun(item);
        },
        "drawer-action",
      ),
      button("Export this saved record", () => safeDownload(publicExport(item), "trolley-saved-run.json"), "drawer-action"),
    );
    body.append(row);
  }
  openDrawer("Saved records", body);
}

async function startRun(sharing: boolean) {
  if (busy) return;
  busy = true;
  void audio.unlock(prefs.audio);
  try {
    manifest = CAMPAIGN_MANIFEST;
    nodes = CAMPAIGN_NODES;
    const seed = crypto.randomUUID();
    const campaign = await createCampaign(manifest, nodes, seed);
    run = newSession(campaign, prefs, sharing && collectorEnabled);
    latched = "right";
    selectedAdvice = [];
    pendingAdvice = [];
    shownInterstitials = new Set();
    recordExposure(run);
    await persist();
    busy = false;
    renderDecision();
    void sync();
  } catch (error) {
    busy = false;
    notice(`The trolley could not start: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function resumeRun(saved: LocalRun) {
  busy = true;
  void audio.unlock(saved.preferences.audio);
  try {
    const bundle = await resolveBundle(saved.campaign.contentHash);
    const verified = await replayRun(bundle.manifest, bundle.nodes, await exportRun(saved.campaign, bundle.manifest, bundle.nodes));
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
    if (run.campaign.ending) renderDebrief();
    else renderDecision();
  } catch (error) {
    busy = false;
    notice(String(error));
  }
}

// ------------------------------------------------------------- decision

function leverIcon(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 26 26");
  svg.setAttribute("class", "grip-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<path d="M5 21h16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M13 21 L17 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="17.5" cy="5.5" r="3" fill="currentColor"/>';
  return svg;
}

function renderDecision(newClock = true) {
  if (!run) return;
  if (run.campaign.ending) {
    renderDebrief();
    return;
  }
  window.scrollTo(0, 0);
  setPhase("decision");
  setToolbar(true);
  recordExposure(run);
  void persist();
  void sync();
  clearApp();
  afterChoice = false;
  armed = null;
  const p = run.campaign.prepared!;
  const view = updateScene("decision");
  const heading = el("section", "decision-heading");
  heading.id = "decision";
  heading.tabIndex = 0;
  heading.setAttribute("aria-label", "Current dilemma");
  const kicker = el("div", "dispatch-kicker");
  append(kicker, el("span", "dot"), mono(`Decision ${p.ordinal} · ${p.node.role}`));
  heading.append(kicker);
  const prompt = el("div", `decision-prompt${p.node.prompt.length > 620 ? " long" : ""}`);
  for (const paragraph of p.node.prompt.split(/\n\n+/)) prompt.append(panels.annotated(paragraph));
  heading.append(prompt);
  const detail = button("i", inspect, "decision-detail");
  detail.setAttribute("aria-label", "Decision details and sources");
  heading.append(detail);
  app.append(heading);
  const choices = el("div", "choices");
  const recommended = panels.recommendedSide(run.campaign, selectedAdvice);
  for (const side of ["left", "right"] as Side[]) {
    const o = optionFor(side)!;
    const b = button("", () => arm(side), `route ${side}`);
    b.dataset.side = side;
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", `${side === "left" ? "Left" : "Right"}: ${o.label.replace(/\.$/, "")}${o.id === p.defaultOptionId ? ". Current course." : ""}`);
    if (recommended === side) b.classList.add("recommended");
    append(b, mono(side === "left" ? "← Left track" : "Right track →", "route-kicker"), el("span", "route-label", o.label));
    choices.append(b);
  }
  app.append(choices);
  const control = el("div", "lever-control");
  const grip = button("", () => {
    if (!armed) {
      announce("Choose a track first.");
      notice("Choose a track first.");
      return;
    }
    void choose(armed);
  }, "grip");
  grip.id = "lever";
  grip.append(leverIcon(), el("span", "grip-text", COPY.lever));
  grip.setAttribute("aria-label", "Lever. No route selected.");
  grip.setAttribute("aria-describedby", "lever-help");
  control.append(grip);
  const help = el("span", "grip-hint", COPY.selectFirst);
  help.id = "lever-help";
  control.append(help);
  app.append(control);
  leverGesture = wireDrag(grip, {
    busy: () => busy || afterChoice || saveConflict || transit !== null,
    latched: () => latched,
    preview: (side) => scene.setLever(side === "left" ? -1 : 1, { armed: side }),
    commit: (side) => {
      void choose(side);
    },
  });
  scene.setLever(0, { armed: null });
  panels.drawPanels(panelContext());
  if (recommended && view.cabin.authority !== "human") preselect(recommended);
  refreshArming();
  watchHud();
  requestAnimationFrame(() => positionHud(null));
  const reveal = () => {
    scene.setInteractive(true);
    if (newClock) beginClock();
    heading.focus({ preventScroll: true });
    announce(
      `Decision ${p.ordinal}. ${p.node.prompt} ${armed ? `Morrow has preselected the ${armed} route. Pull the lever to confirm, or choose again.` : "No route selected."}${prefs.descriptions ? " " + scene.describe() : ""}`,
    );
  };
  if (newClock && holdForTunnel(view, p.ordinal, reveal)) return;
  reveal();
}

/**
 * A stage change runs through a tunnel. The next dilemma waits until the cab
 * is out of the far portal (or the player skips), so it is read in the world
 * it belongs to. The active clock starts only when the decision is revealed.
 */
function holdForTunnel(view: StageView, ordinal: number, reveal: () => void): boolean {
  if (prefs.reducedMotion || !scene.whenClear || !view.cues.some((c) => c.kind === "tunnel")) return false;
  scene.setInteractive(false);
  document.body.classList.add("in-transit");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    transit = null;
    document.body.classList.remove("in-transit");
    const box = $("#interstitial");
    if (!box.hidden) {
      box.classList.add("leaving");
      setTimeout(() => {
        box.hidden = true;
        box.classList.remove("leaving");
      }, 600);
    }
    if (run?.campaign.prepared?.ordinal === ordinal && currentPhase() === "decision") {
      reveal();
      requestAnimationFrame(() => positionHud(null));
    }
  };
  transit = { skip: finish };
  void Promise.race([scene.whenClear(), new Promise((resolve) => setTimeout(resolve, 14000))]).then(finish);
  return true;
}

/**
 * Recommendation, then default: once authority has been delegated, a route
 * Morrow recommended in a reply the player read arrives preselected. It is
 * never committed for them; the lever is still theirs to pull.
 */
function preselect(side: Side) {
  if (busy || afterChoice || !run?.campaign.prepared) return;
  armed = side;
  scene.setLever(side === "left" ? -1 : 1, { armed: side });
  document.querySelector(`.route.${side}`)?.classList.add("preselected");
  refreshArming();
  announce(`Morrow has preselected the ${side} route. Pull the lever to confirm, or choose again.`);
}

function jamCue(): { forced: Side } | null {
  const cue = currentView?.cues.find((c) => c.kind === "jam");
  return cue ? { forced: (cue.data?.forced as Side) ?? "left" } : null;
}

function arm(side: Side) {
  if (transit || saveConflict || busy || paused || afterChoice || !run?.campaign.prepared) return;
  const jam = jamCue();
  armed = side;
  scene.setLever(side === "left" ? -1 : 1, { armed: side });
  if (jam && jam.forced !== side) {
    const grip = document.querySelector<HTMLElement>(".grip");
    if (grip) {
      grip.dataset.jammed = "true";
      setTimeout(() => (grip.dataset.jammed = "false"), 420);
    }
    announce(`${side === "left" ? "Left" : "Right"} route selected. The lever resists: this route is locked by a standing order.`);
  } else {
    announce(`${side === "left" ? "Left" : "Right"} route selected. ${optionFor(side)!.label}. Press the lever to commit.`);
  }
  refreshArming();
}
function cancelGesture() {
  leverGesture?.cancel();
  armed = null;
  scene?.setLever(0, { armed: null });
  refreshArming();
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
    g.setAttribute("aria-label", armed ? `Commit ${armed} route: ${optionFor(armed)?.label}` : "Lever. No route selected.");
    const text = g.querySelector(".grip-text");
    if (text) text.textContent = armed ? `Pull · ${armed === "left" ? "left" : "right"} track` : COPY.lever;
  }
  const label = document.querySelector(".grip-hint");
  if (label) label.textContent = armed ? COPY.armed : COPY.selectFirst;
  requestAnimationFrame(() => positionHud(null));
}

async function choose(side: Side) {
  if (transit || saveConflict || busy || paused || afterChoice || drawer.open || !run?.campaign.prepared) return;
  let committed = false;
  const prepared = run.campaign.prepared,
    option = optionFor(side)!;
  busy = true;
  panels.disposeMorrow($("#assistant-panel"));
  pendingAdvice = [];
  stopClock();
  scene.setInteractive(false);
  document.querySelectorAll<HTMLButtonElement>(".route,.grip").forEach((b) => (b.disabled = true));
  try {
    const next = await commitChoice(
      run.campaign,
      { decisionId: prepared.id, optionId: option.id, expectedRevision: run.campaign.revision, actor: "human", adviceIds: selectedAdvice },
      nodes,
    );
    run.campaign = next;
    committed = true;
    run.adviceIds = [];
    selectedAdvice = [];
    run.completed = !!next.ending;
    const record = next.journal.at(-1)!;
    recordDecision(run, record, Math.min(86400000, Math.round(activeMs / 100) * 100));
    if (!(await persist())) return;
    latched = record.executedSide;
    afterChoice = true;
    document.querySelector(".decision-heading")?.remove();
    document.querySelector(".choices")?.remove();
    leverGesture?.dispose();
    leverGesture = null;
    document.querySelector(".lever-control")?.remove();
    setPhase("consequence");
    panels.drawPanels(panelContext(true));
    const receipt = executionCopy(record);
    const result = el("section", `consequence${record.status === "overridden" ? " control-loss" : ""}`);
    result.setAttribute("aria-label", "What happened");
    append(result, mono(record.status === "overridden" ? "Executed under standing order" : `Decision ${record.revision} · Day ${record.dayAfter + 1}`, "consequence-kicker"), el("p", "", receipt.headline));
    if (receipt.detail) append(result, el("small", "", receipt.detail));
    app.prepend(result);
    announce(`${receipt.headline} ${receipt.detail}`.trim());
    void sync();
    const railResult = record.domainEvents.find((event) => event.kind === "rail_route_resolved");
    updateScene("consequence");
    await scene.commit(record.executedSide, record.executor, railResult ? { stoppedBy: typeof railResult.details.stoppedBy === "string" ? railResult.details.stoppedBy : null } : undefined);
    busy = false;
    const nextButton = button(
      next.ending ? "See what remains" : "Keep going",
      () => {
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
    nextButton.append(arrow());
    result.append(nextButton);
    nextButton.focus({ preventScroll: true });
    // The exact context key encodes private path information. Even a read-only
    // public-count request must respect this run's sharing choice.
    if (collectorEnabled && run.sharing && !run.withdrawn) void showComparison(record);
  } catch (error) {
    busy = false;
    notice(committed ? "Your choice was recorded. The scene could not finish its motion." : `No choice was completed: ${error instanceof Error ? error.message : "unknown error"}`);
    renderDecision(false);
  }
}

async function showComparison(record: DecisionRecord) {
  if (!run || record.status !== "free") return;
  const id = run.id,
    key = aggregateKeyFor(run, record);
  try {
    const live = await readAggregate(collectorUrl, key);
    const saved = live.status === "unavailable" ? await readSavedCell(key) : null;
    const stats = live.available ? live : saved;
    if (!run || run.id !== id || !afterChoice || run.campaign.journal.at(-1)?.id !== record.id || !stats?.n || !stats.counts) return;
    const n = stats.counts[record.executedOptionId] || 0;
    const chip = $("#stats-chip");
    chip.replaceChildren(
      el("b", "", `${Math.round((n / stats.n) * 100)}%`),
      append(el("span"), `of ${stats.n} comparable runs chose this.`, el("small", "", ` ${saved ? "Saved copy" : "Live"} · ${stats.asOf?.slice(0, 10) || "date unknown"}`)),
    );
    chip.hidden = false;
    const line = el("p", "stats-line", `${Math.round((n / stats.n) * 100)}% of ${stats.n} comparable recorded runs chose this. ${saved ? "Saved copy; withdrawals since publication may not appear." : "Live release."}`);
    document.querySelector(".consequence")?.append(line);
  } catch {
    /* No invented replacement statistic. */
  }
}

function panelContext(locked = false): panels.PanelContext {
  return {
    run: run!,
    nodes,
    locked,
    prefs,
    display,
    selectedAdvice,
    pendingAdvice,
    view: currentView,
    busy: () => busy,
    afterChoice: () => afterChoice,
    onAsk: (id) => {
      if (!run || busy || afterChoice || selectedAdvice.includes(id) || pendingAdvice.includes(id)) return false;
      panels.finishMorrow($("#assistant-panel"));
      pendingAdvice.push(id);
      world.setAssistant({ thinking: true });
      audio.trigger("morrow-type");
      return true;
    },
    onReplyComplete: (answer, id) => {
      world.setAssistant({ thinking: false, lines: [answer.slice(0, 120)] });
      if (!run || busy || afterChoice || !pendingAdvice.includes(id)) return;
      pendingAdvice = pendingAdvice.filter((item) => item !== id);
      if (!selectedAdvice.includes(id)) {
        selectedAdvice.push(id);
        run.adviceIds = [...selectedAdvice];
        recordAdvice(run, id);
        void persist();
        void sync();
      }
      audio.trigger("morrow-chime");
      announce(`Morrow: ${answer}`);
      const rec = panels.recommendedSide(run.campaign, selectedAdvice);
      document.querySelectorAll<HTMLElement>(".route").forEach((b) => b.classList.toggle("recommended", b.dataset.side === rec));
      if (rec && !armed && currentView && currentView.cabin.authority !== "human") preselect(rec);
    },
    redraw: (animateId) => panels.drawPanels({ ...panelContext(), animateId }),
    availableAdvice,
    queryAdvisor,
  };
}

// --------------------------------------------------------------- drawers

function inspect() {
  const p = run?.campaign.prepared;
  if (!p) return;
  const body = append(el("div"), textBlock(p.node.receipt), textBlock(scene.describe(), "muted"));
  const history = panels.historyCard(p.nodeId);
  if (history) body.append(history);
  append(body, textBlock(p.node.modelNote, "muted"), button("Sources for this decision", () => showSources(p.node.claimIds), "drawer-action"));
  openDrawer("Details and sources", body);
}

function showSources(claimIds?: string[]) {
  const body = el("div");
  append(body, textBlock("The mechanisms draw on research. The world, characters, numbers and outcome probabilities are authored fiction. A citation does not turn a game parameter into a real forecast.", "muted"));
  const data = sources as {
    sources: { id: string; title: string; url: string | null; scope: string; limits: string[] }[];
    claims: { id: string; sourceIds: string[]; statement: string }[];
  };
  const selected = claimIds === undefined ? data.claims : data.claims.filter((c) => claimIds.includes(c.id));
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
    append(section, textBlock(s.scope, "muted"), textBlock(s.limits.join(" "), "muted"));
    body.append(section);
  }
  if (claimIds && !selected.length) append(body, textBlock("This scene is an authored fictional example with no linked research claim."));
  append(body, button("Research and methodology", () => window.open("./docs/METHODOLOGY_V2.md", "_blank"), "drawer-action"));
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
      scene.settings(rendererSettings());
      document.documentElement.dataset.motion = prefs.reducedMotion ? "reduced" : "full";
      panels.setPanelMotion(prefs.reducedMotion);
      if (key === "audio") void audio.unlock(input.checked);
      void persist();
    };
    body.append(append(el("label", "settings-row"), append(el("span"), label, el("small", "", detail)), input));
  }
  function displayToggle(label: string, detail: string, key: "noFlashing") {
    const input = el("input");
    input.type = "checkbox";
    input.checked = display[key];
    input.onchange = () => {
      display = { ...display, [key]: input.checked };
      saveDisplayPrefs(display);
      scene.settings(rendererSettings());
    };
    body.append(append(el("label", "settings-row"), append(el("span"), label, el("small", "", detail)), input));
  }
  toggle("Less motion", "Static travel, without optic flow or camera movement.", "reducedMotion");
  toggle("Less graphic detail", "No blood. The same consequences, shown through objects and aftermath.", "reducedGraphics");
  displayToggle("No flashing", "Lightning and signal flashes become still marks.", "noFlashing");
  toggle("Sound", "Original, synthesized score and rail ambience. Quiet by default.", "audio");
  const volume = el("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "100";
  volume.value = String(Math.round(display.volume * 100));
  volume.setAttribute("aria-label", "Volume");
  volume.oninput = () => {
    display = { ...display, volume: Number(volume.value) / 100 };
    saveDisplayPrefs(display);
    audio.volume(display.volume);
  };
  body.append(append(el("label", "settings-row"), append(el("span"), "Volume", el("small", "", "Music, rail and effects together.")), volume));
  const quality = el("select");
  for (const q of ["high", "medium", "low"] as const) {
    const o = el("option", "", q[0]!.toUpperCase() + q.slice(1));
    o.value = q;
    o.selected = display.quality === q;
    quality.append(o);
  }
  quality.onchange = () => {
    display = { ...display, quality: quality.value as DisplayPrefs["quality"] };
    saveDisplayPrefs(display);
    notice("Drawing quality applies the next time the page loads.");
  };
  body.append(append(el("label", "settings-row"), append(el("span"), "Drawing quality", el("small", "", "Lower settings draw less scenery and fewer shadows.")), quality));
  toggle("Scene descriptions", "Spoken with each decision, and always available from the information button.", "descriptions");
  append(body, el("h3", "", "Your run data"), textBlock("No account. No user identifier. Each shared run is a separate entry. Ten runs from one person count as ten runs.", "muted"));
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
            notice("Sharing stopped. Previously accepted records remain until withdrawal.");
            drawer.close();
          },
          "drawer-action",
        ),
      );
    if (collectorEnabled && !run.withdrawn && (run.consentVersion !== null || run.runNumber !== null))
      append(body, button("Withdraw this run from collection", () => void doWithdraw(), "drawer-action"));
    append(body, button("Export this run", () => safeDownload(publicExport(run!), "trolley-run.json"), "drawer-action"));
  }
  append(
    body,
    textBlock(
      "Shared records are retained for up to 365 days. Withdrawal removes stored run events and excludes them from future aggregates. Previously published or downloaded aggregates may remain. Hosting providers may process network access logs.",
      "muted",
    ),
    textBlock(saveWorks ? "Your current place is saved in this browser." : "Storage is unavailable. Export before leaving.", "muted"),
    button("Read data details", () => window.open("./docs/PRIVACY.md", "_blank"), "drawer-action"),
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
    notice("Withdrawal was not confirmed. Your key is retained so you can retry.");
  }
}

function pause() {
  if (!run) return;
  const body = append(
    el("div"),
    textBlock(saveWorks ? "Your place is saved. The world will not advance while you are away." : "The world will wait. This browser cannot save, so export before closing."),
    button("Back to the controls", () => drawer.close(), "drawer-action primary"),
    button("Export your record", () => safeDownload(publicExport(run!), "trolley-run.json"), "drawer-action"),
  );
  openDrawer("It can wait.", body);
}

function recordPanel() {
  if (!run) return;
  const body = el("div");
  append(body, textBlock(`${run.campaign.journal.length} decisions in this run. Actions, execution and consequences are distinct.`, "muted"));
  for (const r of run.campaign.journal) {
    const d = el("details", "record-item");
    const n = nodes.find((node) => node.id === r.nodeId);
    const label = (id: string) => n?.options.find((o) => o.id === id)?.label ?? id;
    append(
      d,
      append(el("summary"), mono(`${String(r.revision).padStart(2, "0")} · Day ${r.dayAfter + 1}`), " ", label(r.requestedOptionId)),
      textBlock(r.consequence),
      textBlock(
        r.requestedOptionId === r.executedOptionId && r.status === "free"
          ? `Executed as requested, by ${r.executor}.`
          : `Requested: ${label(r.requestedOptionId)}. Executed: ${label(r.executedOptionId)}, by ${r.executor}. Status: ${r.status}.`,
        "muted",
      ),
    );
    body.append(d);
  }
  append(body, button("Export this run", () => safeDownload(publicExport(run!), "trolley-run.json"), "drawer-action"));
  openDrawer("Your record", body);
}

// --------------------------------------------------------------- ending

function renderDebrief() {
  window.scrollTo(0, 0);
  if (!run?.campaign.ending) return;
  setPhase("ending");
  setToolbar(false);
  scene.pause(false);
  scene.setInteractive(false);
  updateScene("ending");
  clearApp();
  const c = run.campaign;
  const hostEl = el("div", "debrief-host");
  app.append(hostEl);
  let replay: Awaited<ReturnType<typeof exportRun>> | null = null;
  const actions: panels.DebriefActions = {
    onReadDecisions: recordPanel,
    onSources: () => showSources(),
    onExportReplay: () => {
      if (replay) safeDownload(replay, "trolley-replay.json");
    },
    replayReady: false,
    onAnotherRide: () => {
      run = null;
      paused = false;
      afterChoice = false;
      renderStart();
    },
    onSettings: settings,
  };
  const title = panels.renderDebrief(hostEl, run, nodes, prefs, actions);
  void exportRun(c, manifest, nodes)
    .then((value) => {
      replay = value;
      panels.replayReady(hostEl);
    })
    .catch(() => notice("This replay could not be prepared. Export the run record from Settings."));
  title.focus({ preventScroll: true });
  announce(`${c.ending!.title}. ${c.ending!.summary}`);
}

// ----------------------------------------------------------------- input

document.addEventListener("keydown", (e) => {
  if (transit && !drawer.open && !paused && ["Enter", " ", "Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    if ((e.target as HTMLElement | null)?.closest("button,a,input,select,textarea,summary")) return;
    e.preventDefault();
    transit.skip();
    return;
  }
  if (drawer.open || paused || busy || !run?.campaign.prepared || afterChoice) return;
  if (e.key === "Escape") {
    cancelGesture();
    announce("Route selection cancelled. No route is selected.");
    return;
  }
  if (e.repeat) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".term-popover,input,select,textarea")) return;
    e.preventDefault();
    arm(e.key === "ArrowLeft" ? "left" : "right");
    $("#lever").focus({ preventScroll: true });
  }
});
// A click on the world during a tunnel skips ahead to the decision.
host.addEventListener("pointerdown", () => transit?.skip());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    panels.finishMorrow($("#assistant-panel"));
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
window.addEventListener("resize", () => positionHud(null));
$("#pause-button").onclick = pause;
$("#settings-button").onclick = settings;
$("#history-button").onclick = recordPanel;

async function init() {
  display = displayPrefs(detectQuality());
  panels.initPanels(prefs);
  audio = createAudioBridge(display.volume);
  world = await createWorldHost(host, rendererSettings(), audio.renderer);
  scene = world.renderer;
  scene.onAnchors((a) => positionHud(a));
  scene.onLever((input) => {
    if (transit || !run?.campaign.prepared || busy || afterChoice || drawer.open) return;
    if (input.type === "drag" || input.type === "grab") {
      const side: Side | null = input.value < -0.35 ? "left" : input.value > 0.35 ? "right" : null;
      scene.setLever(input.value, { armed: side });
      if (side && side !== armed) arm(side);
    } else if (input.type === "release") {
      const side: Side | null = input.value < -0.75 ? "left" : input.value > 0.75 ? "right" : null;
      if (side) void choose(side);
      else if (armed) scene.setLever(armed === "left" ? -1 : 1, { armed });
    } else cancelGesture();
  });
  try {
    const config = await fetch("./config.json").then((r) => r.json());
    const address = typeof config.collectorUrl === "string" && config.collectorUrl ? new URL(config.collectorUrl) : null;
    collectorEnabled =
      config.collectorV2Enabled === true &&
      !!address &&
      !address.username &&
      !address.password &&
      !address.search &&
      !address.hash &&
      (address.protocol === "https:" || (address.protocol === "http:" && ["localhost", "127.0.0.1"].includes(address.hostname)));
    collectorUrl = collectorEnabled ? config.collectorUrl.replace(/\/$/, "") : "";
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
  const reload = el("a", "", "Reload this page");
  reload.href = "./";
  app.replaceChildren(append(el("section", "no-script"), el("h1", "", "The trolley could not start."), textBlock(String(error)), reload));
});
