/**
 * Morrow's window: a small conversation app for a fictional assistant.
 *
 * Authored dialogue only. Players ask pre-written questions from chips; the
 * reply shows a thinking state, streams in word chunks, and exposes an
 * authored "Considered" assessment. This is written fiction, not a view into
 * any real model's reasoning, and it makes no model call.
 *
 * Research contract (inherited from renderAdvisor):
 *  - onReplyComplete(answer, id) fires exactly once per id per host lifetime
 *    (between disposeMorrow calls), and only when the complete reply is on
 *    screen: after streaming ends, after "Show full reply", after
 *    finishMorrow, or synchronously under reduced motion.
 *  - A reply hidden by minimizing is paused; if it is completed while hidden
 *    the notification waits until the window is expanded again.
 *  - disposeMorrow cancels every timer; a cancelled reply never completes.
 *
 * The log is diffed by exchange id: re-rendering never restarts a reply that
 * is already streaming and never rebuilds exchanges that have not changed.
 */
import { el } from "../../dom.ts";
import { morrowMark } from "./mark.ts";
import {
  chipsLabel,
  composerText,
  introLine,
  modelSuffix,
  morrowStage,
  noticeRef,
  recommendationKey,
  revisionLine,
  sideLabel,
  statusLine,
  thoughtLabel,
  thoughtSeconds,
  type MorrowAuthority,
  type MorrowTone,
} from "./copy.ts";
import {
  planReveal,
  stepText,
  toParagraphs,
  type RevealPlan,
  type RevealStep,
} from "./reveal.ts";

export type { MorrowAuthority, MorrowTone };

export interface MorrowRecommendation {
  side: "left" | "right";
  label: string;
}

export interface MorrowReply {
  id: string;
  question: string;
  answer: string;
  reasoning?: string;
  tone: MorrowTone;
  recommends?: MorrowRecommendation | null;
}

export interface MorrowCues {
  /** Rising edge: the title-bar mark flashes signal red once (~600 ms). */
  logoFlash?: boolean;
  /** Rising edge: the next reply streams a withdrawn draft first. */
  revision?: boolean;
  /** Photosensitivity: replace the flash with a static red outline for 1 s. */
  noFlashing?: boolean;
}

export interface MorrowView {
  stage: number;
  online: boolean;
  locked: boolean;
  reducedMotion: boolean;
  authority: MorrowAuthority;
  /** Questions available for the current decision. */
  questions: MorrowReply[];
  /** Exchanges to show, oldest first. */
  history: MorrowReply[];
  /** Question ids already asked (hidden from the chips). */
  readIds: string[];
  /** The id just asked; its reply is revealed. */
  animateId?: string;
  cues?: MorrowCues;
  onAsk(q: MorrowReply): void;
  onReplyComplete?(answer: string, id: string): void;
  /** Optional: the reader minimized or expanded the window. */
  onMinimizedChange?(minimized: boolean): void;
}

type Timer = ReturnType<typeof setTimeout>;

interface Exchange {
  id: string;
  key: string;
  entry: MorrowReply;
  root: HTMLElement;
  divider: HTMLElement;
  reply: HTMLElement;
  thought: HTMLElement;
  considered: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement;
  recKey: HTMLElement | null;
  live: { root: HTMLElement; label: HTMLElement; show: HTMLButtonElement } | null;
  thoughtDone: boolean;
}

interface Active {
  x: Exchange;
  plan: RevealPlan;
  next: number;
  timer: Timer | undefined;
  paused: boolean;
}

interface Chrome {
  mark: HTMLElement;
  model: HTMLElement;
  status: HTMLElement;
  extra: HTMLElement;
  toggle: HTMLButtonElement | null;
}

interface Parts {
  main: HTMLElement;
  log: HTMLElement;
  intro: HTMLElement;
  introLine: HTMLElement;
  dock: HTMLElement;
  chipsLabel: HTMLElement;
  chips: HTMLElement;
  composer: HTMLElement;
  composerText: HTMLElement;
}

interface State {
  host: HTMLElement;
  root: HTMLElement;
  offline: boolean;
  view: MorrowView;
  chrome: Chrome;
  parts: Parts | null;
  exchanges: Map<string, Exchange>;
  chips: Map<string, { button: HTMLButtonElement; text: HTMLElement; item: MorrowReply }>;
  completed: Set<string>;
  revised: Map<string, string>;
  active: Active | undefined;
  deferred: { answer: string; id: string } | undefined;
  minimized: boolean;
  lastFlash: boolean;
  lastRevision: boolean;
  revisionArmed: boolean;
  cueTimer: Timer | undefined;
}

const states = new WeakMap<HTMLElement, State>();
let uid = 0;
const FOLLOW_PX = 90;
const SVG_NS = "http://www.w3.org/2000/svg";

/* ------------------------------------------------------------------ API */

/** Draw or update Morrow's window inside `host`. Safe to call on every state change. */
export function renderMorrow(host: HTMLElement, view: MorrowView): void {
  let s = states.get(host);
  if (s && (s.root.parentNode !== host || s.offline !== !view.online)) {
    stopTimers(s);
    states.delete(host);
    s = undefined;
  }
  if (!s) s = create(host, view);
  s.view = view;
  const reduced = view.reducedMotion || prefersReducedMotion();
  updateChrome(s, reduced);
  if (s.offline || !s.parts) return;
  const parts = s.parts;

  applyCues(s, view);

  const history = dedupe(view.history);
  const present = new Set(history.map((entry) => entry.id));
  const target =
    view.animateId && !s.completed.has(view.animateId)
      ? history.find((entry) => entry.id === view.animateId)
      : undefined;

  // A reply that is no longer in the log is cancelled; one displaced by a
  // newer question but still in the log is completed (it stays readable).
  if (s.active) {
    const activeId = s.active.x.id;
    if (!present.has(activeId)) cancelActive(s);
    else if (view.animateId && view.animateId !== activeId) completeActive(s);
    else if (reduced) completeActive(s);
  }

  // A new question always gets the reader's eyes.
  if (target && s.minimized && s.active?.x.id !== target.id) setMinimized(s, false);

  let draft: string | null = null;
  const starting = !!target && s.active?.x.id !== target.id;
  if (starting && s.revisionArmed) {
    draft = revisionLine(target!.id);
    s.revisionArmed = false;
    s.revised.set(target!.id, draft);
  }

  const firstPaint = s.exchanges.size === 0 && !parts.log.firstChild;
  const added = reconcile(s, history, starting ? target!.id : undefined, !reduced);

  if (starting && target) {
    const x = s.exchanges.get(target.id)!;
    if (reduced) fire(s, target.answer, target.id);
    else startReveal(s, x, planReveal({ id: target.id, answer: target.answer, tone: target.tone, draft }));
  }

  renderChips(s, view);
  renderComposer(s, view, history);
  updateChrome(s, reduced);

  if (firstPaint || added) parts.log.scrollTop = parts.log.scrollHeight;
}

/** Complete any reply that is still thinking or streaming (pause, drawer, commit). */
export function finishMorrow(host: HTMLElement): void {
  const s = states.get(host);
  if (s?.active) completeActive(s);
}

/** Cancel every timer. A reply in flight is abandoned and will not complete. */
export function disposeMorrow(host: HTMLElement): void {
  const s = states.get(host);
  if (!s) return;
  stopTimers(s);
  states.delete(host);
}

/* ------------------------------------------------------------ structure */

function create(host: HTMLElement, view: MorrowView): State {
  const id = ++uid;
  const root = el("div", "mw");
  root.setAttribute("data-morrow", "");
  const offline = !view.online;
  if (offline) root.setAttribute("data-offline", "");

  const bar = el("header", "mw-bar");
  const markBox = el("span", "mw-bar-mark");
  markBox.append(morrowMark({ size: 30 }));
  const title = el("div", "mw-title");
  const name = el("h2", "mw-name", "Morrow");
  const model = el("span", "mw-model");
  name.append(model);
  const status = el("p", "mw-status");
  const dot = el("span", "mw-dot");
  dot.setAttribute("aria-hidden", "true");
  const statusText = el("span", "mw-status-text");
  const extra = el("span", "mw-status-extra");
  status.append(dot, statusText, extra);
  const by = el("span", "mw-by", "by Vela");
  title.append(name, status, by);
  bar.append(markBox, title);

  const s: State = {
    host,
    root,
    offline,
    view,
    chrome: { mark: markBox, model, status: statusText, extra, toggle: null },
    parts: null,
    exchanges: new Map(),
    chips: new Map(),
    completed: new Set(),
    revised: new Map(),
    active: undefined,
    deferred: undefined,
    minimized: false,
    lastFlash: false,
    lastRevision: false,
    revisionArmed: false,
    cueTimer: undefined,
  };

  if (!offline) {
    const toggle = el("button", "mw-toggle");
    toggle.type = "button";
    toggle.append(icon("chevron"));
    toggle.onclick = () => {
      if (states.get(host) === s) setMinimized(s, !s.minimized);
    };
    bar.append(toggle);
    s.chrome.toggle = toggle;

    const main = el("div", "mw-main");
    main.id = `mw-main-${id}`;
    toggle.setAttribute("aria-controls", main.id);

    const log = el("div", "mw-log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "off");
    log.setAttribute("aria-label", "Conversation with Morrow");
    log.tabIndex = 0;

    const intro = el("div", "mw-intro");
    const introMark = el("span", "mw-intro-mark");
    introMark.append(morrowMark({ size: 60 }));
    const introName = el("p", "mw-intro-name", "Morrow");
    const introText = el("p", "mw-intro-line");
    intro.append(introMark, introName, introText);

    const dock = el("div", "mw-dock");
    const label = el("p", "mw-chips-label");
    label.id = `mw-chips-label-${id}`;
    const chips = el("div", "mw-chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-labelledby", label.id);
    const composer = el("div", "mw-composer");
    const composerText = el("span", "mw-composer-text");
    const send = el("span", "mw-send");
    send.setAttribute("aria-hidden", "true");
    send.append(icon("send"));
    composer.append(composerText, send);
    // Mouse affordance only: the chips are the input and are already in the tab order.
    composer.onclick = () => {
      if (states.get(host) !== s) return;
      for (const chip of s.chips.values())
        if (!chip.button.disabled) {
          chip.button.focus();
          return;
        }
    };
    dock.append(label, chips, composer);
    main.append(log, dock);
    root.append(bar, main);
    s.parts = {
      main,
      log,
      intro,
      introLine: introText,
      dock,
      chipsLabel: label,
      chips,
      composer,
      composerText,
    };
  } else {
    root.append(bar);
  }
  host.replaceChildren(root);
  states.set(host, s);
  return s;
}

function updateChrome(s: State, reduced: boolean) {
  const v = s.view;
  const stage = morrowStage(v.stage);
  const root = s.root;
  root.setAttribute("data-stage", String(stage));
  root.setAttribute("data-authority", v.authority);
  if (reduced) root.setAttribute("data-motion", "reduced");
  else root.removeAttribute("data-motion");
  if (s.offline) {
    setText(s.chrome.model, "");
    setText(s.chrome.status, "Not installed.");
    setText(s.chrome.extra, "");
    return;
  }
  setText(s.chrome.model, ` ${modelSuffix(stage)}`);
  const waiting = !!(s.minimized && (s.active || s.deferred));
  setText(s.chrome.status, waiting ? "Reply waiting." : statusLine(stage, v.authority));
  setText(s.chrome.extra, "");
  flag(root, "data-waiting", waiting);
  flag(root, "data-minimized", s.minimized);
  const toggle = s.chrome.toggle;
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!s.minimized));
    toggle.setAttribute("aria-label", s.minimized ? "Expand Morrow" : "Minimize Morrow");
    toggle.title = s.minimized ? "Expand" : "Minimize";
  }
  const parts = s.parts;
  if (parts) {
    flag(parts.main, "hidden", s.minimized);
    setText(parts.introLine, introLine(stage, v.authority));
  }
}

function setMinimized(s: State, minimized: boolean) {
  if (s.minimized === minimized) return;
  s.minimized = minimized;
  const a = s.active;
  if (a) {
    if (minimized) {
      a.paused = true;
      clearTimeout(a.timer);
      a.timer = undefined;
    } else {
      a.paused = false;
      schedule(s);
    }
  }
  updateChrome(s, s.view.reducedMotion || prefersReducedMotion());
  if (!minimized && s.deferred) {
    const { answer, id } = s.deferred;
    s.deferred = undefined;
    if (s.parts) s.parts.log.scrollTop = s.parts.log.scrollHeight;
    fire(s, answer, id);
  }
  s.view.onMinimizedChange?.(minimized);
}

/* ---------------------------------------------------------------- cues */

function applyCues(s: State, view: MorrowView) {
  const cues = view.cues ?? {};
  const flash = !!cues.logoFlash;
  if (flash && !s.lastFlash) {
    clearTimeout(s.cueTimer);
    const kind = cues.noFlashing ? "outline" : "flash";
    s.root.setAttribute("data-cue", kind);
    s.cueTimer = setTimeout(
      () => {
        s.cueTimer = undefined;
        s.root.removeAttribute("data-cue");
      },
      kind === "outline" ? 1000 : 620,
    );
  }
  s.lastFlash = flash;
  const revision = !!cues.revision;
  if (revision && !s.lastRevision) s.revisionArmed = true;
  s.lastRevision = revision;
}

/* ------------------------------------------------------------ exchanges */

/**
 * Bring the log in line with `history`, keyed by id. Unchanged exchanges keep
 * their nodes. `startId` (a reply about to be revealed) is always rebuilt:
 * empty and pending when it will stream, complete when it will not.
 */
function reconcile(
  s: State,
  history: MorrowReply[],
  startId: string | undefined,
  stream: boolean,
): boolean {
  const parts = s.parts!;
  const log = parts.log;
  let added = false;
  const keep = new Set(history.map((entry) => entry.id));
  for (const [id, x] of s.exchanges)
    if (!keep.has(id)) {
      x.root.remove();
      s.exchanges.delete(id);
    }
  const desired: HTMLElement[] = [];
  if (!history.length) desired.push(parts.intro);
  for (const entry of history) {
    let x = s.exchanges.get(entry.id);
    const key = signature(entry);
    const isActive = s.active?.x.id === entry.id;
    const starting = entry.id === startId && !isActive;
    if (!x || (!isActive && (x.key !== key || starting))) {
      const fresh = buildExchange(s, entry, key, starting && stream);
      if (x) x.root.remove();
      else added = true;
      s.exchanges.set(entry.id, fresh);
      x = fresh;
    }
    desired.push(x.root);
  }
  if (history.length) parts.intro.remove();
  desired.forEach((node, i) => {
    const current = log.children[i] ?? null;
    if (current !== node) log.insertBefore(node, current);
  });
  while (log.children.length > desired.length) log.children[desired.length]!.remove();

  // Group by decision so older advice never reads as advice for this choice.
  const current = currentDecision(s.view, history);
  let previous: string | null = null;
  history.forEach((entry, i) => {
    const x = s.exchanges.get(entry.id)!;
    const key = decisionKey(entry.id);
    const past = current !== "" && key !== current;
    x.root.classList.toggle("is-past", past);
    if (x.recKey) setText(x.recKey, recommendationKey(entry.tone, past));
    const boundary = i === 0 ? past : key !== previous;
    if (boundary && (past || i > 0)) {
      x.divider.removeAttribute("hidden");
      setText(x.divider, past ? "Earlier decision" : "This decision");
    } else x.divider.setAttribute("hidden", "");
    previous = key;
  });
  return added;
}

function buildExchange(s: State, entry: MorrowReply, key: string, pending: boolean): Exchange {
  const root = el("article", "mw-x");
  root.setAttribute("data-id", entry.id);
  const divider = el("p", "mw-divider");
  divider.setAttribute("hidden", "");

  const user = el("div", "mw-user");
  const bubble = el("p", "mw-bubble");
  const who = el("span", "mw-sr", "You asked: ");
  bubble.append(who, entry.question);
  user.append(bubble);

  const reply = el("div", "mw-reply");
  reply.setAttribute("data-tone", entry.tone);
  const speaker = el("div", "mw-speaker");
  const thought = el("span", "mw-thought");
  if (entry.tone === "coercive") {
    // An institutional notice: no face, a filing reference, a signal rule.
    const head = el("div", "mw-notice-head");
    head.append(el("span", "mw-notice-k", "Notice"), el("span", "mw-notice-ref", noticeRef(entry.id)));
    reply.append(head);
    speaker.classList.add("mw-speaker-notice");
    speaker.append(thought);
  } else {
    const avatar = el("span", "mw-avatar");
    avatar.append(morrowMark({ size: 20 }));
    speaker.append(avatar, el("span", "mw-speaker-name", "Morrow"), thought);
  }
  const considered = el("div", "mw-considered");
  considered.id = `mw-considered-${++uid}`;
  considered.setAttribute("hidden", "");
  const body = el("div", "mw-body");
  const foot = el("div", "mw-foot");
  reply.append(speaker, considered, body, foot);
  root.append(divider, user, reply);

  const x: Exchange = {
    id: entry.id,
    key,
    entry,
    root,
    divider,
    reply,
    thought,
    considered,
    body,
    foot,
    recKey: null,
    live: null,
    thoughtDone: false,
  };
  if (pending) {
    root.setAttribute("aria-busy", "true");
    reply.setAttribute("data-phase", "thinking");
    const thinking = el("span", "mw-thinking");
    if (entry.tone === "coercive") {
      const mark = el("span", "mw-think-mark");
      mark.append(morrowMark({ size: 16 }));
      thinking.append(mark);
    }
    thinking.append(el("span", "mw-think-label", "Thinking"));
    thought.append(thinking);
    const live = el("div", "mw-live");
    const label = el("span", "mw-live-label");
    const show = el("button", "mw-show", "Show full reply");
    show.type = "button";
    show.onclick = () => {
      if (states.get(s.host) !== s || s.active?.x !== x) return;
      if (s.parts) s.parts.log.scrollTop = s.parts.log.scrollHeight;
      completeActive(s, true);
    };
    live.append(label, show);
    foot.append(live);
    x.live = { root: live, label, show };
  } else {
    finalize(s, x);
  }
  return x;
}

function showThought(x: Exchange) {
  if (x.thoughtDone) return;
  x.thoughtDone = true;
  const entry = x.entry;
  const label = thoughtLabel(thoughtSeconds(entry));
  const reasoning = entry.reasoning?.trim();
  if (reasoning) {
    // A plain disclosure: the authored assessment stays in the DOM, hidden
    // until the reader asks for it.
    const toggle = el("button", "mw-thought-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", x.considered.id);
    toggle.append(el("span", "mw-thought-label", label), icon("chevron-small"));
    toggle.onclick = () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      flag(x.considered, "hidden", !open);
    };
    x.considered.replaceChildren(el("p", "mw-considered-k", "Considered"));
    for (const text of toParagraphs(reasoning)) x.considered.append(el("p", "mw-considered-p", text));
    x.thought.replaceChildren(toggle);
  } else {
    x.thought.replaceChildren(el("span", "mw-thought-label", label));
  }
}

function setBody(x: Exchange, text: string, live: boolean) {
  const parts = text ? toParagraphs(text) : live ? [""] : [];
  const body = x.body;
  while (body.children.length > parts.length) body.children[body.children.length - 1]!.remove();
  parts.forEach((part, i) => {
    let p = body.children[i] as HTMLElement | undefined;
    if (!p) {
      p = el("p");
      body.append(p);
    }
    if (p.textContent !== part) p.textContent = part;
    p.className = live && i === parts.length - 1 ? "is-live" : "";
  });
}

/** Draw the complete reply: text, recommendation, and any edit history. */
function finalize(s: State, x: Exchange) {
  const entry = x.entry;
  x.root.removeAttribute("aria-busy");
  x.reply.setAttribute("data-phase", "done");
  x.body.classList.remove("is-draft");
  showThought(x);
  setBody(x, entry.answer, false);
  x.live?.root.remove();
  x.live = null;
  x.foot.replaceChildren();
  x.recKey = null;
  if (entry.recommends) {
    const rec = el("p", "mw-rec");
    rec.setAttribute("data-side", entry.recommends.side);
    const k = el("span", "mw-rec-k", recommendationKey(entry.tone, false));
    const sep = el("span", "mw-rec-sep", " · ");
    const value = el("span", "mw-rec-v");
    const arrow = el("span", "mw-rec-arrow", entry.recommends.side === "left" ? "←" : "→");
    arrow.setAttribute("aria-hidden", "true");
    value.append(arrow, el("strong", "", sideLabel(entry.recommends.side)));
    if (entry.recommends.label) value.append(` — ${entry.recommends.label}`);
    rec.append(k, sep, value);
    x.foot.append(rec);
    x.recKey = k;
  }
  if (entry.tone === "coercive") x.foot.append(el("p", "mw-notice-foot", "No reply required."));
  const draft = s.revised.get(entry.id);
  if (draft) {
    // Both versions stay recoverable: the withdrawn draft and what was sent.
    const edited = el("div", "mw-edited");
    const toggle = el("button", "mw-edited-toggle");
    toggle.type = "button";
    const body = el("div", "mw-edited-body");
    body.id = `mw-edited-${++uid}`;
    body.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", body.id);
    toggle.append(el("span", "", "Edited"), icon("chevron-small"));
    toggle.onclick = () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      flag(body, "hidden", !open);
    };
    const withdrawn = el("p", "mw-edited-draft");
    withdrawn.append(el("del", "", draft));
    const final = el("div", "mw-edited-final");
    for (const text of toParagraphs(entry.answer)) final.append(el("p", "", text));
    body.append(
      el("p", "mw-edited-k", "Withdrawn draft"),
      withdrawn,
      el("p", "mw-edited-k", "Sent"),
      final,
    );
    edited.append(toggle, body);
    x.foot.append(edited);
  }
}

/* --------------------------------------------------------------- reveal */

function startReveal(s: State, x: Exchange, plan: RevealPlan) {
  s.active = { x, plan, next: 1, timer: undefined, paused: s.minimized };
  applyStep(s.active, plan.steps[0]!);
  if (!s.minimized) schedule(s);
}

function schedule(s: State) {
  const a = s.active;
  if (!a || a.paused) return;
  const step = a.plan.steps[a.next];
  if (!step) {
    completeActive(s);
    return;
  }
  clearTimeout(a.timer);
  a.timer = setTimeout(() => tick(s), step.delay);
}

function tick(s: State) {
  const a = s.active;
  if (!a || a.paused) return;
  a.timer = undefined;
  if (!s.host.isConnected || states.get(s.host) !== s) {
    cancelActive(s);
    return;
  }
  const step = a.plan.steps[a.next++]!;
  if (step.phase === "done") {
    completeActive(s);
    return;
  }
  // Decide before the new text lands: a long chunk must not break the follow.
  const log = s.parts!.log;
  const follow = nearBottom(log);
  applyStep(a, step);
  if (follow) log.scrollTop = log.scrollHeight;
  schedule(s);
}

function applyStep(a: Active, step: RevealStep) {
  const x = a.x;
  x.reply.setAttribute("data-phase", step.phase);
  if (step.phase === "thinking") {
    x.body.replaceChildren();
    if (x.live) setText(x.live.label, "");
    return;
  }
  showThought(x);
  const drafting = step.phase === "draft" || step.phase === "erase";
  x.body.classList.toggle("is-draft", drafting);
  setBody(x, stepText(a.plan, step), true);
  if (x.live) setText(x.live.label, step.phase === "erase" ? "Revising" : "Writing");
}

/** Show the whole reply now and notify (or defer while minimized). */
function completeActive(s: State, follow?: boolean) {
  const a = s.active;
  if (!a) return;
  clearTimeout(a.timer);
  s.active = undefined;
  const log = s.parts!.log;
  const stay = follow ?? nearBottom(log);
  const show = a.x.live?.show;
  if (show && document.activeElement === show) log.focus({ preventScroll: true });
  finalize(s, a.x);
  if (stay) log.scrollTop = log.scrollHeight;
  if (s.minimized) {
    s.deferred = { answer: a.x.entry.answer, id: a.x.id };
    updateChrome(s, s.view.reducedMotion || prefersReducedMotion());
  } else fire(s, a.x.entry.answer, a.x.id);
}

function cancelActive(s: State) {
  const a = s.active;
  if (!a) return;
  clearTimeout(a.timer);
  s.active = undefined;
}

function fire(s: State, answer: string, id: string) {
  if (s.completed.has(id)) return;
  s.completed.add(id);
  s.view.onReplyComplete?.(answer, id);
}

function stopTimers(s: State) {
  if (s.active) {
    clearTimeout(s.active.timer);
    s.active = undefined;
  }
  clearTimeout(s.cueTimer);
  s.cueTimer = undefined;
  s.deferred = undefined;
}

/* ---------------------------------------------------------------- dock */

function renderChips(s: State, view: MorrowView) {
  const parts = s.parts!;
  const read = new Set(view.readIds);
  const seen = new Set<string>();
  const remaining = view.questions.filter((item) => {
    if (read.has(item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const focused = document.activeElement;
  let lostFocusAt = -1;
  const order = [...s.chips.keys()];
  for (const [id, chip] of s.chips)
    if (!seen.has(id)) {
      if (focused === chip.button) lostFocusAt = order.indexOf(id);
      chip.button.remove();
      s.chips.delete(id);
    }
  remaining.forEach((item, i) => {
    let chip = s.chips.get(item.id);
    if (!chip) {
      const button = el("button", "mw-chip");
      button.type = "button";
      const text = el("span", "mw-chip-text");
      const go = el("span", "mw-chip-go");
      go.setAttribute("aria-hidden", "true");
      go.append(icon("send"));
      button.append(text, go);
      const record = { button, text, item };
      button.onclick = () => {
        if (states.get(s.host) !== s || s.view.locked || button.disabled) return;
        s.view.onAsk(record.item);
      };
      s.chips.set(item.id, record);
      chip = record;
    }
    chip.item = item;
    setText(chip.text, item.question);
    chip.button.disabled = view.locked;
    const current = parts.chips.children[i] ?? null;
    if (current !== chip.button) parts.chips.insertBefore(chip.button, current);
  });
  const stage = morrowStage(view.stage);
  setText(parts.chipsLabel, chipsLabel(stage, view.authority));
  flag(parts.chipsLabel, "hidden", !remaining.length);
  flag(parts.chips, "hidden", !remaining.length);
  if (lostFocusAt >= 0) {
    const next = [...s.chips.values()].map((c) => c.button).filter((b) => !b.disabled);
    const target = next[Math.min(lostFocusAt, next.length - 1)];
    if (target) target.focus({ preventScroll: true });
    else parts.log.focus({ preventScroll: true });
  }
}

function renderComposer(s: State, view: MorrowView, history: MorrowReply[]) {
  const parts = s.parts!;
  const last = history[history.length - 1];
  const coercive = view.authority === "overridden" || last?.tone === "coercive";
  const remaining = s.chips.size;
  setText(parts.composerText, composerText({ locked: view.locked, coercive, remaining }));
  flag(parts.composer, "data-coercive", coercive);
  s.root.setAttribute("data-latest-tone", last?.tone ?? "none");
}

/* -------------------------------------------------------------- helpers */

/** The decision an advice id belongs to: "decision:advice:2" → "decision". */
export function decisionKey(id: string): string {
  const at = id.lastIndexOf(":advice:");
  return at >= 0 ? id.slice(0, at) : "";
}

function currentDecision(view: MorrowView, history: MorrowReply[]): string {
  const probe = view.questions[0]?.id ?? view.animateId ?? history[history.length - 1]?.id;
  return probe ? decisionKey(probe) : "";
}

function signature(entry: MorrowReply): string {
  const rec = entry.recommends ? `${entry.recommends.side}|${entry.recommends.label}` : "";
  return [entry.question, entry.answer, entry.reasoning ?? "", entry.tone, rec].join("␞");
}

function dedupe(history: MorrowReply[]): MorrowReply[] {
  const seen = new Set<string>();
  return history.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function nearBottom(log: HTMLElement) {
  return log.scrollHeight - log.scrollTop - log.clientHeight < FOLLOW_PX;
}

function flag(node: HTMLElement, name: string, on: boolean) {
  if (on) {
    if (!node.hasAttribute(name)) node.setAttribute(name, "");
  } else if (node.hasAttribute(name)) node.removeAttribute(name);
}

function setText(node: HTMLElement, text: string) {
  if (node.textContent !== text) node.textContent = text;
}

function prefersReducedMotion(): boolean {
  try {
    return !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function icon(kind: "chevron" | "chevron-small" | "send"): HTMLElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  const size = kind === "chevron-small" ? 12 : 16;
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("class", `mw-icon mw-icon-${kind}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    kind === "send" ? "M8 13V3.5M3.75 7.5 8 3.25l4.25 4.25" : "M4 6.25 8 10.25l4-4",
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", kind === "send" ? "1.6" : "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg as unknown as HTMLElement;
}
